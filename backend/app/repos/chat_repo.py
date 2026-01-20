from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, desc, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop

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

        # WB payload may include unread counters with different key names.
        unread = (
            payload.get("unread")
            if isinstance(payload.get("unread"), int)
            else payload.get("unreadCount")
            if isinstance(payload.get("unreadCount"), int)
            else payload.get("unreadMessages")
            if isinstance(payload.get("unreadMessages"), int)
            else payload.get("unreadMessagesCount")
            if isinstance(payload.get("unreadMessagesCount"), int)
            else None
        )
        try:
            cs.unread_count = int(unread or 0)
        except Exception:
            cs.unread_count = 0

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

    async def list_sessions_page(
        self,
        *,
        shop_ids: list[int],
        limit: int,
        offset: int,
        dt_from: datetime | None = None,
        dt_to: datetime | None = None,
        unread: bool | None = None,
    ) -> tuple[int, list[tuple[ChatSession, str]]]:
        """Returns (total_count, rows), where each row is (session, shop_name)."""

        cond = [ChatSession.shop_id.in_(shop_ids)]
        if dt_from is not None:
            cond.append(ChatSession.updated_at >= dt_from)
        if dt_to is not None:
            cond.append(ChatSession.updated_at <= dt_to)
        if unread is True:
            cond.append(ChatSession.unread_count > 0)
        elif unread is False:
            cond.append(ChatSession.unread_count == 0)

        total = int(
            (await self.session.execute(select(func.count()).select_from(ChatSession).where(and_(*cond)))).scalar_one()
            or 0
        )

        q = (
            select(ChatSession, Shop.name)
            .join(Shop, Shop.id == ChatSession.shop_id)
            .where(and_(*cond))
            .order_by(desc(ChatSession.updated_at), desc(ChatSession.id))
            .limit(limit)
            .offset(offset)
        )
        res = await self.session.execute(q)
        rows = [(r[0], r[1]) for r in res.all()]
        return total, rows

    async def add_event(self, shop_id: int, ev: dict) -> ChatEvent:
        event_id = ev.get("eventID")
        chat_id = ev.get("chatID")
        event_type = ev.get("eventType")
        if not event_id or not chat_id or not event_type:
            raise ValueError("WB event missing eventID/chatID/eventType")

        existing = await self.session.execute(
            select(ChatEvent).where(ChatEvent.shop_id == shop_id, ChatEvent.event_id == event_id)
        )
        if existing.scalar_one_or_none():
            return existing.scalar_one_or_none()

        # WB /api/v1/seller/events returns addTimestamp on the event object.
        # Some payloads may also include it inside message, so we fall back.
        msg = ev.get("message") or {}
        add_ts = ev.get("addTimestamp")
        if add_ts is None and isinstance(msg, dict):
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
