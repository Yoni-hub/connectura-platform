from __future__ import annotations

import math
from typing import Iterable, List, Dict, Any

try:
    import tiktoken
except ImportError:  # pragma: no cover - optional
    tiktoken = None


def _encode(text: str) -> List[int]:
    if not tiktoken:
        # Rough fallback: 1.3 tokens per word approximation.
        return [0] * max(1, int(len(text.split()) * 1.3))
    enc = tiktoken.get_encoding("cl100k_base")
    return enc.encode(text)


def count_tokens(text: str) -> int:
    return len(_encode(text or ""))


def messages_token_count(messages: Iterable[Dict[str, Any]]) -> int:
    return sum(count_tokens(m.get("content", "")) for m in messages)


def trim_messages_to_budget(messages: List[Dict[str, Any]], budget: int, reserve: int = 0) -> List[Dict[str, Any]]:
    """Drop oldest messages until token count fits within budget minus reserve."""
    result = list(messages)
    while result and messages_token_count(result) > max(0, budget - reserve):
        result.pop(0)
    return result


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return -1.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return -1.0
    return dot / (norm_a * norm_b)
