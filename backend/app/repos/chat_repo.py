from __future__ import annotations

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatSession, ChatEvent, ChatDraft


class ChatRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert_session(self, shop_id: int, payload: dict) -> ChatSession:
        chat_id = payload.get("chatID")
        reply_sign = payload.get("replySign")
        if not chat_id or not reply_sign:
            raise ValueError("WB chat payload missing chatID/replySign")

        res = await self.session.execute(
            select(ChatSession).where(ChatSession.shop_id == shop_id, ChatSession.chat_id == chat_id)
        )
        existing = res.scalar_one_or_none()
        if existing:
            cs = existing
        else:
            cs = ChatSession(shop_id=shop_id, chat_id=chat_id, reply_sign=reply_sign)
            self.session.add(cs)

        cs.reply_sign = reply_sign
        cs.client_id = payload.get("clientID")
        cs.client_name = payload.get("clientName")
        cs.good_card = payload.get("goodCard")
        cs.last_message = payload.get("lastMessage")

        await self.session.flush()
        return cs

    async def list_sessions(self, shop_id: int, limit: int, offset: int) -> list[ChatSession]:
        q = (
            select(ChatSession)
            .where(ChatSession.shop_id == shop_id)
            .order_by(desc(ChatSession.updated_at), desc(ChatSession.id))
            .limit(limit)
            .offset(offset)
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def add_event(self, shop_id: int, ev: dict) -> ChatEvent:
        event_id = ev.get("eventID")
        chat_id = ev.get("chatID")
        event_type = ev.get("eventType")
        if not event_id or not chat_id or not event_type:
            raise ValueError("WB event missing eventID/chatID/eventType")

        # de-dup by unique constraint
        existing = await self.session.execute(
            select(ChatEvent).where(ChatEvent.shop_id == shop_id, ChatEvent.event_id == event_id)
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one_or_none()

        msg = ev.get("message") or {}
        add_ts = None
        if isinstance(msg, dict):
            add_ts = msg.get("addTimestamp")

        ce = ChatEvent(
            shop_id=shop_id,
            event_id=event_id,
            chat_id=chat_id,
            event_type=event_type,
            is_new_chat=bool(ev.get("isNewChat", False)),
            add_timestamp_ms=add_ts,
            message=msg if isinstance(msg, dict) else None,
            raw=ev,
        )
        self.session.add(ce)
        await self.session.flush()
        return ce

    async def list_events(self, shop_id: int, chat_id: str, limit: int, offset: int) -> list[ChatEvent]:
        q = (
            select(ChatEvent)
            .where(ChatEvent.shop_id == shop_id, ChatEvent.chat_id == chat_id)
            .order_by(desc(ChatEvent.add_timestamp_ms).nullslast(), desc(ChatEvent.id))
            .limit(limit)
            .offset(offset)
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def get_session_by_chat_id(self, shop_id: int, chat_id: str) -> ChatSession | None:
        res = await self.session.execute(
            select(ChatSession).where(ChatSession.shop_id == shop_id, ChatSession.chat_id == chat_id)
        )
        return res.scalar_one_or_none()

    async def create_draft(self, shop_id: int, chat_id: str, text: str, openai_model: str | None, openai_response_id: str | None) -> ChatDraft:
        d = ChatDraft(
            shop_id=shop_id,
            chat_id=chat_id,
            text=text,
            openai_model=openai_model,
            openai_response_id=openai_response_id,
        )
        self.session.add(d)
        await self.session.flush()
        return d

    async def latest_draft(self, shop_id: int, chat_id: str) -> ChatDraft | None:
        res = await self.session.execute(
            select(ChatDraft)
            .where(ChatDraft.shop_id == shop_id, ChatDraft.chat_id == chat_id)
            .order_by(desc(ChatDraft.id))
            .limit(1)
        )
        return res.scalar_one_or_none()
