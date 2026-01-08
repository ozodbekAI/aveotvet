from __future__ import annotations

import orjson


def dumps(v) -> str:
    return orjson.dumps(v).decode("utf-8")


def loads(s: str):
    return orjson.loads(s)
