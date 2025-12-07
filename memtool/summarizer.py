from __future__ import annotations

import math
from typing import Dict, Any, List

import click
from openai import OpenAI

from .token_budget import messages_token_count


SUMMARY_MIN = 220
SUMMARY_MAX = 350


def summarize_if_needed(
    client: OpenAI,
    memory: Dict[str, Any],
    model: str,
    hard_budget_tokens: int,
) -> Dict[str, Any]:
    messages: List[Dict[str, str]] = memory.get("messages", [])
    if not messages:
        return memory

    if messages_token_count(messages) <= math.floor(hard_budget_tokens * 0.7):
        return memory

    half = max(1, len(messages) // 2)
    to_summarize = messages[:half]
    remaining = messages[half:]

    system_prompt = (
        "You are a senior software engineer. Summarize the following conversation into long-term memory.\n"
        f"Target {SUMMARY_MIN}-{SUMMARY_MAX} tokens. Preserve file/function names, interfaces, constraints, TODOs.\n"
        "Use EXACT headings: Data model, APIs, Decisions, Open questions, Next steps."
    )
    user_content = (
        f"[EXISTING LONG TERM]\n{memory.get('long_term_memory', '')}\n\n"
        "[MESSAGES TO SUMMARIZE]\n"
        + "\n".join(f"{m.get('role')}: {m.get('content')}" for m in to_summarize)
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        )
    except Exception as exc:  # pragma: no cover - network
        raise click.ClickException(f"OpenAI summarization failed: {exc}") from exc

    summary = resp.choices[0].message.content.strip()
    lt = memory.get("long_term_memory", "")
    new_long_term = f"{lt}\n\n{summary}".strip()
    memory["long_term_memory"] = new_long_term
    memory["messages"] = remaining
    return memory
