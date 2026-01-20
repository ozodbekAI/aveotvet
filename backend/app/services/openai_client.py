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
    prompt_tokens: int = 0
    completion_tokens: int = 0


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
        # The OpenAI Python SDK returns usage differently depending on API/model.
        # We keep this tolerant and default to 0 when unavailable.
        prompt_tokens = 0
        completion_tokens = 0
        usage = getattr(resp, "usage", None)
        if usage is not None:
            # Responses API typically reports input_tokens / output_tokens.
            prompt_tokens = int(getattr(usage, "input_tokens", 0) or 0)
            completion_tokens = int(getattr(usage, "output_tokens", 0) or 0)
            # Fallback names
            if not prompt_tokens:
                prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
            if not completion_tokens:
                completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)

        return OpenAIResult(
            text=(getattr(resp, "output_text", None) or "").strip(),
            model=model,
            response_id=getattr(resp, "id", None),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
