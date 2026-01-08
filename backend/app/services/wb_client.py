from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import asyncio

import httpx


WB_BASE_URL = "https://feedbacks-api.wildberries.ru"


class WBApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, payload: Any | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass
class WBRateLimit:
    retry_after_sec: int | None = None


class WBClient:
    def __init__(self, token: str, timeout: float = 30.0):
        self._token = token
        self._client = httpx.AsyncClient(
            base_url=WB_BASE_URL,
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
                retry = resp.headers.get("X-Ratelimit-Retry")
                sleep_s = int(float(retry)) if retry else 1
                await asyncio.sleep(min(max(sleep_s, 1), 10))
                continue
            if resp.status_code >= 500:
                await asyncio.sleep(min(2 ** (attempt - 1), 10))
                continue
            return resp
        raise WBApiError(f"WB request failed after retries: {method} {url}")

    async def feedbacks_list(
        self,
        *,
        is_answered: bool,
        take: int,
        skip: int,
        order: str = "dateDesc",
        date_from: int | None = None,
        date_to: int | None = None,
        nm_id: int | None = None,
    ) -> dict:
        params: dict[str, Any] = {
            "isAnswered": str(is_answered).lower(),
            "take": take,
            "skip": skip,
            "order": order,
        }
        if date_from is not None:
            params["dateFrom"] = date_from
        if date_to is not None:
            params["dateTo"] = date_to
        if nm_id is not None:
            params["nmId"] = nm_id

        resp = await self._request("GET", "/api/v1/feedbacks", params=params)
        if resp.status_code != 200:
            raise WBApiError("WB feedbacks list failed", resp.status_code, resp.text)
        return resp.json()

    async def feedback_get(self, wb_id: str) -> dict:
        resp = await self._request("GET", "/api/v1/feedback", params={"id": wb_id})
        if resp.status_code != 200:
            raise WBApiError("WB feedback get failed", resp.status_code, resp.text)
        return resp.json()

    async def feedback_answer_create(self, wb_id: str, text: str) -> None:
        payload = {"id": wb_id, "text": text}
        resp = await self._request("POST", "/api/v1/feedbacks/answer", json=payload)
        if resp.status_code != 204:
            raise WBApiError("WB feedback answer failed", resp.status_code, resp.text)

    async def feedback_answer_edit(self, wb_id: str, text: str) -> None:
        payload = {"id": wb_id, "text": text}
        resp = await self._request("PATCH", "/api/v1/feedbacks/answer", json=payload)
        if resp.status_code != 204:
            raise WBApiError("WB feedback answer edit failed", resp.status_code, resp.text)

    # Questions API
    async def questions_list(
        self,
        *,
        is_answered: bool,
        take: int,
        skip: int,
        order: str = "dateDesc",
        date_from: int | None = None,
        date_to: int | None = None,
        nm_id: int | None = None,
    ) -> dict:
        params: dict[str, Any] = {
            "isAnswered": str(is_answered).lower(),
            "take": take,
            "skip": skip,
            "order": order,
        }
        if date_from is not None:
            params["dateFrom"] = date_from
        if date_to is not None:
            params["dateTo"] = date_to
        if nm_id is not None:
            params["nmId"] = nm_id

        resp = await self._request("GET", "/api/v1/questions", params=params)
        if resp.status_code != 200:
            raise WBApiError("WB questions list failed", resp.status_code, resp.text)
        return resp.json()

    async def question_get(self, wb_id: str) -> dict:
        resp = await self._request("GET", "/api/v1/question", params={"id": wb_id})
        if resp.status_code != 200:
            raise WBApiError("WB question get failed", resp.status_code, resp.text)
        return resp.json()

    async def question_view(self, wb_id: str, was_viewed: bool = True) -> None:
        payload = {"id": wb_id, "wasViewed": bool(was_viewed)}
        resp = await self._request("PATCH", "/api/v1/questions", json=payload)
        if resp.status_code != 204:
            raise WBApiError("WB question view failed", resp.status_code, resp.text)

    async def question_answer_or_edit(self, wb_id: str, text: str) -> None:
        # Official docs show PATCH /api/v1/questions; request body differs by action.
        # For answer/edit we send id + text.
        payload = {"id": wb_id, "text": text}
        resp = await self._request("PATCH", "/api/v1/questions", json=payload)
        if resp.status_code != 204:
            raise WBApiError("WB question answer/edit failed", resp.status_code, resp.text)

    async def question_reject(self, wb_id: str) -> None:
        # Best-effort per docs: PATCH /api/v1/questions (reject action)
        payload = {"id": wb_id, "state": "rejected"}
        resp = await self._request("PATCH", "/api/v1/questions", json=payload)
        if resp.status_code != 204:
            raise WBApiError("WB question reject failed", resp.status_code, resp.text)

    # Pins API
    async def pins_list(self, *, date_from: str | None = None, date_to: str | None = None, next_: int | None = None, limit: int = 100) -> dict:
        params: dict[str, Any] = {"limit": limit}
        if date_from:
            params["dateFrom"] = date_from
        if date_to:
            params["dateTo"] = date_to
        if next_ is not None:
            params["next"] = next_
        resp = await self._request("GET", "/api/feedbacks/v1/pins", params=params)
        if resp.status_code != 200:
            raise WBApiError("WB pins list failed", resp.status_code, resp.text)
        return resp.json()

    async def pins_limits(self) -> dict:
        resp = await self._request("GET", "/api/feedbacks/v1/pins/limits")
        if resp.status_code != 200:
            raise WBApiError("WB pins limits failed", resp.status_code, resp.text)
        return resp.json()

    async def pin_feedback(self, feedback_id: str, pin_on: str = "imt") -> dict:
        resp = await self._request("POST", "/api/feedbacks/v1/pins", json={"feedbackId": int(feedback_id), "pinOn": pin_on})
        if resp.status_code != 200:
            raise WBApiError("WB pin failed", resp.status_code, resp.text)
        return resp.json()

    async def unpin_feedback(self, pin_id: int) -> None:
        resp = await self._request("DELETE", "/api/feedbacks/v1/pins", params={"pinId": pin_id})
        if resp.status_code != 204:
            raise WBApiError("WB unpin failed", resp.status_code, resp.text)
