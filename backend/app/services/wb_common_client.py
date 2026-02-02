from __future__ import annotations

from typing import Any
import asyncio

import httpx


WB_COMMON_BASE_URL = "https://common-api.wildberries.ru"


class WBCommonApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, payload: Any | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class WBCommonClient:
    """Small client for Wildberries Common API (seller-info)."""

    def __init__(self, token: str, timeout: float = 20.0):
        self._client = httpx.AsyncClient(
            base_url=WB_COMMON_BASE_URL,
            timeout=httpx.Timeout(timeout),
            headers={"Authorization": token, "Content-Type": "application/json"},
        )

    async def aclose(self):
        await self._client.aclose()

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        # Simple retry on 429 and transient 5xx.
        max_tries = 5
        for attempt in range(1, max_tries + 1):
            resp = await self._client.request(method, url, **kwargs)
            if resp.status_code == 429:
                retry = resp.headers.get("Retry-After") or resp.headers.get("X-Ratelimit-Retry")
                sleep_s = int(float(retry)) if retry else 1
                await asyncio.sleep(min(max(sleep_s, 1), 10))
                continue
            if resp.status_code >= 500:
                await asyncio.sleep(min(2 ** (attempt - 1), 10))
                continue
            return resp
        raise WBCommonApiError(f"WB Common API request failed after retries: {method} {url}")

    async def seller_info(self) -> dict:
        resp = await self._request("GET", "/api/v1/seller-info")
        if resp.status_code != 200:
            raise WBCommonApiError("WB seller-info failed", resp.status_code, resp.text)
        data = resp.json()
        if not isinstance(data, dict):
            raise WBCommonApiError("WB seller-info: unexpected payload", resp.status_code, data)
        return data
