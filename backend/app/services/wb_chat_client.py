from __future__ import annotations

from typing import Any
import asyncio

import httpx


BUYER_CHAT_BASE_URL = "https://buyer-chat-api.wildberries.ru"


class WBChatApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, payload: Any | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class WBChatClient:
    def __init__(self, token: str, timeout: float = 30.0):
        self._token = token
        self._client = httpx.AsyncClient(
            base_url=BUYER_CHAT_BASE_URL,
            timeout=httpx.Timeout(timeout),
            headers={"Authorization": token},
        )

    async def aclose(self):
        await self._client.aclose()

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        max_tries = 5
        for attempt in range(1, max_tries + 1):
            resp = await self._client.request(method, url, **kwargs)
            if resp.status_code == 429:
                await asyncio.sleep(min(2 ** (attempt - 1), 10))
                continue
            if resp.status_code >= 500:
                await asyncio.sleep(min(2 ** (attempt - 1), 10))
                continue
            return resp
        raise WBChatApiError(f"WB chat request failed after retries: {method} {url}")

    async def chats_list(self) -> dict:
        resp = await self._request("GET", "/api/v1/seller/chats")
        if resp.status_code != 200:
            raise WBChatApiError("WB chat list failed", resp.status_code, resp.text)
        return resp.json()

    async def events(self, next_ms: int | None = None) -> dict:
        params = {}
        if next_ms is not None:
            params["next"] = next_ms
        resp = await self._request("GET", "/api/v1/seller/events", params=params)
        if resp.status_code != 200:
            raise WBChatApiError("WB chat events failed", resp.status_code, resp.text)
        return resp.json()

    async def send_message(self, *, reply_sign: str, message: str | None = None, files: list[tuple[str, bytes, str]] | None = None) -> dict:
        # WB expects multipart/form-data with fields: replySign, message, file[]
        data = {"replySign": reply_sign}
        if message is not None:
            data["message"] = message

        mfiles = []
        if files:
            # files: [(filename, bytes, content_type)]
            for filename, blob, content_type in files:
                mfiles.append(("file", (filename, blob, content_type)))

        resp = await self._request("POST", "/api/v1/seller/message", data=data, files=mfiles if mfiles else None)
        if resp.status_code != 200:
            raise WBChatApiError("WB send message failed", resp.status_code, resp.text)
        return resp.json()

    async def download(self, download_id: str) -> httpx.Response:
        # returns binary stream
        resp = await self._request("GET", f"/api/v1/seller/download/{download_id}")
        if resp.status_code != 200:
            raise WBChatApiError("WB download failed", resp.status_code, resp.text)
        return resp
