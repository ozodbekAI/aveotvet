from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings


@dataclass
class OpenAIResult:
    text: str
    model: str
    response_id: str | None = None


class OpenAIService:
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set")
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT_SEC)

    async def generate_text(self, *, model: str, instructions: str, input_text: str) -> OpenAIResult:
        # Using Responses API.
        resp = await self._client.responses.create(
            model=model,
            instructions=instructions,
            input=input_text,
        )
        return OpenAIResult(
            text=(resp.output_text or "").strip(),
            model=model,
            response_id=getattr(resp, "id", None),
        )
