from __future__ import annotations

import asyncio
import time
import logging
from typing import Any

import httpx


log = logging.getLogger(__name__)


class WBAnalyticsClient:
    """Wildberries Seller Analytics API client.

    Currently used for fetching canonical brand list for signature mapping.
    """

    base_url = "https://seller-analytics-api.wildberries.ru"

    def __init__(
        self,
        token: str,
        *,
        timeout: float = 20.0,
    ):
        self.token = (token or "").strip()
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers={
                # WB APIs expect raw token in Authorization header (not Bearer)
                "Authorization": self.token,
                "Accept": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self.client.aclose()

    async def list_brands(self) -> list[str]:
        """GET /api/v1/analytics/brand-share/brands

        Expected response:
        {"data": ["Avemod", "Uni ty", ...]}
        """

        url = "/api/v1/analytics/brand-share/brands"

        # Simple retry strategy for transient errors / rate limits.
        for attempt in range(1, 4):
            try:
                r = await self.client.get(url)
                if r.status_code in (429, 500, 502, 503, 504):
                    raise httpx.HTTPStatusError("transient", request=r.request, response=r)
                r.raise_for_status()
                data: Any = r.json()
                raw = data.get("data") if isinstance(data, dict) else None
                if not isinstance(raw, list):
                    return []
                out: list[str] = []
                for x in raw:
                    if isinstance(x, str) and x.strip():
                        out.append(x.strip())
                # Keep deterministic ordering; WB usually already returns stable order.
                return out
            except Exception as e:
                if attempt >= 3:
                    log.warning("[wb-analytics] list_brands failed: %s", e)
                    return []
                await asyncio.sleep(0.4 * attempt)


# In-process TTL cache (safe fallback; avoids extra WB calls from UI refreshes)
_BRANDS_CACHE: dict[int, tuple[float, list[str]]] = {}


def cache_get(shop_id: int) -> list[str] | None:
    now = time.time()
    item = _BRANDS_CACHE.get(int(shop_id))
    if not item:
        return None
    exp, brands = item
    if exp < now:
        _BRANDS_CACHE.pop(int(shop_id), None)
        return None
    return brands


def cache_set(shop_id: int, brands: list[str], *, ttl_seconds: int = 600) -> None:
    _BRANDS_CACHE[int(shop_id)] = (time.time() + int(ttl_seconds), brands)
