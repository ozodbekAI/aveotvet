from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.gpt_usage import GptUsage


@dataclass
class Pricing:
    input_per_1k_usd: Decimal
    output_per_1k_usd: Decimal


def _get_pricing_for_model(model: str) -> Pricing | None:
    """Return pricing for a model from settings.MODEL_PRICING.

    settings.MODEL_PRICING is expected to be a dict:
    {
      "gpt-4.1-mini": {"input_per_1k_usd": 0.15, "output_per_1k_usd": 0.6}
    }

    If not configured, returns None.
    """
    mp = getattr(settings, "MODEL_PRICING", None)
    if not isinstance(mp, dict):
        return None
    cfg = mp.get(model)
    if not isinstance(cfg, dict):
        return None
    try:
        return Pricing(
            input_per_1k_usd=Decimal(str(cfg.get("input_per_1k_usd", 0) or 0)),
            output_per_1k_usd=Decimal(str(cfg.get("output_per_1k_usd", 0) or 0)),
        )
    except Exception:
        return None


def estimate_cost_usd(*, model: str, prompt_tokens: int, completion_tokens: int) -> Decimal:
    pricing = _get_pricing_for_model(model)
    if pricing is None:
        return Decimal("0")
    pt = Decimal(prompt_tokens) / Decimal(1000)
    ct = Decimal(completion_tokens) / Decimal(1000)
    return (pt * pricing.input_per_1k_usd) + (ct * pricing.output_per_1k_usd)


def usd_to_rub(cost_usd: Decimal) -> Decimal:
    rate = Decimal(str(getattr(settings, "USD_TO_RUB", 0) or 0))
    if rate <= 0:
        return Decimal("0")
    return cost_usd * rate


async def record_gpt_usage(
    session: AsyncSession,
    *,
    shop_id: int,
    model: str,
    operation_type: str,
    prompt_tokens: int,
    completion_tokens: int,
    response_id: str | None,
) -> GptUsage:
    """Insert a GPT usage row. Caller should commit."""
    cost_usd = estimate_cost_usd(model=model, prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)
    cost_rub = usd_to_rub(cost_usd)

    row = GptUsage(
        shop_id=int(shop_id),
        model=str(model),
        operation_type=str(operation_type),
        prompt_tokens=int(prompt_tokens or 0),
        completion_tokens=int(completion_tokens or 0),
        cost_usd=float(cost_usd),
        cost_rub=float(cost_rub),
        response_id=response_id,
    )
    session.add(row)
    await session.flush()
    return row
