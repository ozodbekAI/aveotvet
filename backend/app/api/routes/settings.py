from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import logging

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole
from app.models.feedback import Feedback
from app.repos.shop_repo import ShopRepo
from app.repos.signature_repo import SignatureRepo
from app.services.openai_client import OpenAIService
from app.services.drafting import generate_draft_text
from app.services.prompt_store import get_global_bundle
from app.schemas.settings import SettingsOut, SettingsUpdate, ReviewPreviewsOut

router = APIRouter()
log = logging.getLogger(__name__)


def _coerce_bool(value, *, field_path: str) -> bool | None:
    """Coerce common boolean representations coming from UI."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("true", "1", "yes", "y", "on"):
            return True
        if v in ("false", "0", "no", "n", "off"):
            return False
    raise HTTPException(status_code=422, detail=f"{field_path} must be boolean")


def deep_merge_config(existing: dict, updates: dict) -> dict:
    """Deep merge config objects, preserving existing values not in updates."""
    result = existing.copy()
    
    for key, value in updates.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            # Deep merge nested dicts
            result[key] = deep_merge_config(result[key], value)
        else:
            # Overwrite with new value (including None to clear values)
            result[key] = value
    
    return result


def validate_and_merge_config(existing_config: dict, new_config: dict) -> dict:
    """Validate new config and merge with existing, preserving unmodified values."""
    if not isinstance(new_config, dict):
        raise HTTPException(status_code=422, detail="config must be an object")
    
    # Start with existing config
    result = existing_config.copy() if existing_config else {}
    
    # Process advanced settings
    if "advanced" in new_config:
        adv = new_config["advanced"]
        if not isinstance(adv, dict):
            raise HTTPException(status_code=422, detail="config.advanced must be an object")
        
        # Get existing advanced or empty dict
        existing_adv = result.get("advanced", {})
        updated_adv = existing_adv.copy()
        
        # Address format (dynamic code)
        if "address_format" in adv:
            af = adv["address_format"]
            if af is None:
                updated_adv["address_format"] = None
            else:
                if isinstance(af, dict) and "value" in af:
                    af = af.get("value")
                if isinstance(af, str):
                    v = af.strip().lower()
                    aliases = {
                        "vy": "vy_caps",
                        "vycaps": "vy_caps",
                        "vy-caps": "vy_caps",
                        "vy_upper": "vy_caps",
                        "vyupper": "vy_caps",
                        "vy_cap": "vy_caps",
                        "vy_lowercase": "vy_lower",
                        "vylower": "vy_lower",
                        "vy-lower": "vy_lower",
                        "вы": "vy_lower",
                        "вы!": "vy_lower",
                        "ты": "ty",
                    }
                    af = aliases.get(v, v)
                # do NOT restrict to a fixed enum — keep as code
                if isinstance(af, str) and af.strip():
                    updated_adv["address_format"] = af.strip().lower()[:64]
        
        # Boolean flags
        for key in ("use_buyer_name", "mention_product_name", "emoji_enabled", "photo_reaction_enabled"):
            if key in adv:
                try:
                    updated_adv[key] = _coerce_bool(adv[key], field_path=f"advanced.{key}")
                except HTTPException:
                    pass
        
        # Answer length (dynamic code)
        if "answer_length" in adv:
            al = adv["answer_length"]
            if al is None:
                updated_adv["answer_length"] = None
            else:
                if isinstance(al, dict) and "value" in al:
                    al = al.get("value")
                if isinstance(al, str) and al.strip():
                    updated_adv["answer_length"] = al.strip().lower()[:64]
        
        # Delivery method
        if "delivery_method" in adv:
            dm = adv["delivery_method"]
            if dm is None:
                updated_adv["delivery_method"] = None
            elif isinstance(dm, str):
                updated_adv["delivery_method"] = dm.strip() if dm.strip() else None
        
        # Tone of voice
        if "tone_of_voice" in adv:
            tov = adv["tone_of_voice"]
            if tov is None:
                updated_adv["tone_of_voice"] = None
            elif isinstance(tov, dict):
                existing_tov = updated_adv.get("tone_of_voice", {}) or {}
                updated_tov = existing_tov.copy() if isinstance(existing_tov, dict) else {}
                
                for key in ("positive", "neutral", "negative", "question"):
                    if key in tov:
                        val = tov[key]
                        if val is None or (isinstance(val, str) and val.strip()):
                            updated_tov[key] = val.strip() if isinstance(val, str) else val
                
                updated_adv["tone_of_voice"] = updated_tov
        
        # Stop words
        if "stop_words" in adv:
            sw = adv["stop_words"]
            if sw is None:
                updated_adv["stop_words"] = []
            elif isinstance(sw, list):
                stop_words = []
                for word in sw:
                    if isinstance(word, str) and word.strip():
                        stop_words.append(word.strip()[:100])
                updated_adv["stop_words"] = stop_words
        
        result["advanced"] = updated_adv
    
    # Process chat settings
    if "chat" in new_config:
        chat = new_config["chat"]
        if not isinstance(chat, dict):
            raise HTTPException(status_code=422, detail="config.chat must be an object")
        
        existing_chat = result.get("chat", {})
        updated_chat = existing_chat.copy()
        
        for key in ("confirm_send", "confirm_ai_insert"):
            if key in chat:
                try:
                    updated_chat[key] = _coerce_bool(chat[key], field_path=f"chat.{key}")
                except HTTPException:
                    pass
        
        result["chat"] = updated_chat
    
    # Process recommendations
    if "recommendations" in new_config:
        rec = new_config["recommendations"]
        if not isinstance(rec, dict):
            raise HTTPException(status_code=422, detail="config.recommendations must be an object")
        
        existing_rec = result.get("recommendations", {})
        updated_rec = existing_rec.copy()
        
        if "enabled" in rec:
            try:
                updated_rec["enabled"] = _coerce_bool(rec["enabled"], field_path="recommendations.enabled")
            except HTTPException:
                pass
        
        result["recommendations"] = updated_rec

    # Process onboarding (UI-only)
    if "onboarding" in new_config:
        ob = new_config["onboarding"]
        if not isinstance(ob, dict):
            raise HTTPException(status_code=422, detail="config.onboarding must be an object")

        existing_ob = result.get("onboarding", {})
        updated_ob = existing_ob.copy() if isinstance(existing_ob, dict) else {}

        for key in ("done", "dashboard_intro_seen"):
            if key in ob:
                try:
                    updated_ob[key] = _coerce_bool(ob[key], field_path=f"onboarding.{key}")
                except HTTPException:
                    pass

        result["onboarding"] = updated_ob
    
    return result


@router.get("/{shop_id}", response_model=SettingsOut)
async def get_settings(shop_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)
    shop = access.shop
    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")
    return s




@router.get("/{shop_id}/preview/reviews", response_model=ReviewPreviewsOut)
async def preview_review_replies(shop_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Manager+ can preview; generation is not charged.
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop

    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")

    # If generation is disabled at config level, fail fast.
    cfg = getattr(s, "config", None) or {}
    if isinstance(cfg, dict) and cfg.get("advanced", {}).get("generation_disabled") is True:
        raise HTTPException(status_code=403, detail="Generation is disabled in settings")

    bundle = await get_global_bundle(db)

    try:
        openai = OpenAIService()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    now = datetime.now(timezone.utc)

    samples = [
        (
            "negative",
            1,
            "Заказ пришёл с браком. Упаковка помята, товар не работает как надо. Очень разочарован.",
            None,
            "Брак/не работает, упаковка помята",
        ),
        (
            "neutral",
            3,
            "Товар нормальный, но ожидал чуть лучше. Доставка была немного дольше обещанного.",
            "В целом соответствует описанию",
            "Доставка дольше, чем ожидал",
        ),
        (
            "positive",
            5,
            "Отличное качество! Всё подошло идеально, доставка быстрая. Спасибо!",
            "Качество, скорость доставки",
            None,
        ),
    ]

    items = []
    for kind, rating, text, pros, cons in samples:
        fb = Feedback(
            id=0,
            shop_id=shop_id,
            wb_id=f"preview_{kind}",
            created_date=now,
            product_valuation=int(rating),
            text=text,
            pros=pros,
            cons=cons,
            user_name="Покупатель",
            product_details={
                "brandName": "DemoBrand",
                "productName": "Демонстрационный товар",
                "subjectName": "Категория",
            },
        )
        reply_text, model, response_id, prompt_tokens, completion_tokens = await generate_draft_text(openai, fb, s, bundle=bundle)
        items.append(
            {
                "kind": kind,
                "rating": int(rating),
                "review_text": text,
                "pros": pros,
                "cons": cons,
                "reply_text": reply_text,
                "model": model,
            }
        )

    return {"items": items}

@router.put("/{shop_id}", response_model=SettingsOut)
async def update_settings(
    shop_id: int, 
    payload: SettingsUpdate,
    request: Request, 
    db: AsyncSession = Depends(get_db), 
    user=Depends(get_current_user)
):
    # Settings are sensitive and should only be editable by managers/owners.
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)
    shop = access.shop

    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")

    data = payload.model_dump(exclude_unset=True)

    # v1 RBAC: "advanced" settings are owner-only
    if "config" in data and isinstance(data.get("config"), dict):
        cfg = data.get("config") or {}
        if "advanced" in cfg and not access.at_least(ShopMemberRole.owner.value):
            raise HTTPException(status_code=403, detail="Advanced settings are owner-only")
    
    log.info(f"[settings] UPDATE shop_id={shop_id} - received fields: {list(data.keys())}")

    # Signatures are stored in a separate table.
    # We accept the same API shape, but we DO NOT set ShopSettings.signatures.
    signatures_payload: list[dict] | None = None
    if "signatures" in data:
        sigs = data.get("signatures")
        if sigs is None:
            sigs = []
        if not isinstance(sigs, list):
            raise HTTPException(status_code=422, detail="signatures must be a list")

        cleaned: list[dict] = []
        for item in sigs:
            if isinstance(item, str):
                t = item.strip()
                if t:
                    cleaned.append({"text": t[:300], "type": "all", "brand": "all", "is_active": True})
                continue
            if isinstance(item, dict):
                text = item.get("text")
                if not isinstance(text, str) or not text.strip():
                    raise HTTPException(status_code=422, detail="signature item must have non-empty 'text'")

                tp = str(item.get("type") or "all").strip().lower()[:16]
                if tp not in ("all", "review", "question", "chat"):
                    tp = "all"

                brand = str(item.get("brand") or "all").strip()[:128] or "all"

                is_active = item.get("is_active")
                if not isinstance(is_active, bool):
                    is_active = True

                cleaned.append({"text": text.strip()[:300], "type": tp, "brand": brand, "is_active": is_active})
                continue

            raise HTTPException(status_code=422, detail="signatures items must be strings or objects")

        signatures_payload = cleaned
        data.pop("signatures", None)

    # Validate and merge config
    if "config" in data:
        new_config = data["config"]
        if new_config is None:
            data["config"] = {}
        else:
            existing_config = s.config or {}
            log.info(f"[settings] BEFORE merge - existing config: {existing_config}")
            log.info(f"[settings] BEFORE merge - new config: {new_config}")
            
            merged_config = validate_and_merge_config(existing_config, new_config)
            
            log.info(f"[settings] AFTER merge - merged config: {merged_config}")
            data["config"] = merged_config

    # Apply all changes (except signatures)
    for k, v in data.items():
        log.info(f"[settings] Setting {k} = {v}")
        setattr(s, k, v)

    # Persist signatures
    if signatures_payload is not None:
        await SignatureRepo(db).replace_all(shop_id=shop_id, items=signatures_payload)

    await db.commit()
    
    log.info(f"[settings] FINAL config in DB: {s.config}")
    
    # Re-read via repo so signatures are injected from table
    return await ShopRepo(db).get_settings(shop_id)