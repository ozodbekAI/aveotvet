from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
import logging

import httpx

from app.core.config import settings


log = logging.getLogger(__name__)


class WBContentClient:
    """Async client for Wildberries Content API.

    Uses the same API key token header as other WB APIs (Authorization: <token>).

    Rate limits for the Content category (official docs): 100 requests per minute,
    600ms interval, burst 5.
    """

    base_url = "https://content-api.wildberries.ru"

    def __init__(self, token: str, *, locale: str = "ru"):
        self.token = token
        self.locale = locale
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={
                "Authorization": self.token,
                "Content-Type": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, url: str, *, json: Any | None = None, params: dict | None = None) -> dict:
        # simple bounded retry on 429/5xx with respect to Retry-After
        for attempt in range(1, settings.WB_MAX_RETRIES + 1):
            r = await self._client.request(method, url, json=json, params=params)
            if settings.DEBUG_PRODUCT_CARDS:
                log.info(
                    "[wb-content] %s %s attempt=%s status=%s",
                    method,
                    url,
                    attempt,
                    r.status_code,
                )
            if r.status_code in (429, 500, 502, 503, 504):
                retry_after = r.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else min(2.0 ** attempt, 10.0)
                if settings.DEBUG_PRODUCT_CARDS:
                    log.warning(
                        "[wb-content] retryable status=%s retry_after=%s delay=%.2fs",
                        r.status_code,
                        retry_after,
                        delay,
                    )
                await asyncio.sleep(delay)
                continue
            r.raise_for_status()
            data = r.json()
            if settings.DEBUG_PRODUCT_CARDS:
                cards_n = len((data or {}).get("cards") or [])
                cursor = (data or {}).get("cursor") or {}
                log.info(
                    "[wb-content] ok cards=%s cursor.total=%s cursor.updatedAt=%s cursor.nmID=%s",
                    cards_n,
                    cursor.get("total"),
                    cursor.get("updatedAt"),
                    cursor.get("nmID"),
                )
            return data
        # last attempt
        r.raise_for_status()
        return {}

    @staticmethod
    def _dt_to_wb(dt: datetime) -> str:
        # WB examples use Z suffix
        s = dt.isoformat()
        if s.endswith("+00:00"):
            s = s.replace("+00:00", "Z")
        return s

    async def cards_list(
        self,
        *,
        cursor_updated_at: datetime | None = None,
        cursor_nm_id: int | None = None,
        limit: int = 100,
        with_photo: int = -1,
        text_search: str | None = None,
        ascending: bool = False,
    ) -> dict:
        """POST /content/v2/get/cards/list

        Cursor pagination requires passing updatedAt + nmID from previous response cursor.
        """
        body: dict[str, Any] = {
            "settings": {
                "cursor": {"limit": int(limit)},
                "filter": {"withPhoto": int(with_photo)},
                "sort": {"ascending": bool(ascending)},
            }
        }

        if text_search:
            body["settings"]["filter"]["textSearch"] = str(text_search)

        if cursor_updated_at is not None and cursor_nm_id is not None:
            body["settings"]["cursor"].update(
                {
                    "updatedAt": self._dt_to_wb(cursor_updated_at),
                    "nmID": int(cursor_nm_id),
                }
            )

        if settings.DEBUG_PRODUCT_CARDS:
            cur = body["settings"].get("cursor") or {}
            flt = body["settings"].get("filter") or {}
            log.info(
                "[wb-content] cards_list request limit=%s cursor.updatedAt=%s cursor.nmID=%s withPhoto=%s ascending=%s",
                cur.get("limit"),
                cur.get("updatedAt"),
                cur.get("nmID"),
                flt.get("withPhoto"),
                (body["settings"].get("sort") or {}).get("ascending"),
            )

        # Throttle to respect interval limits.
        if settings.WB_CONTENT_MIN_INTERVAL_SEC > 0:
            await asyncio.sleep(settings.WB_CONTENT_MIN_INTERVAL_SEC)

        return await self._request("POST", "/content/v2/get/cards/list", json=body, params={"locale": self.locale})
