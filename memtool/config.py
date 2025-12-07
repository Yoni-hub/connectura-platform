import os
from dataclasses import dataclass
from pathlib import Path

import click
from dotenv import load_dotenv


@dataclass
class Settings:
    openai_api_key: str
    chat_model: str = "gpt-4o-mini"
    summary_model: str = "gpt-4o-mini"
    embed_model: str = "text-embedding-3-small"
    hard_budget_tokens: int = 6000
    default_branch: str | None = None


def load_settings() -> Settings:
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise click.ClickException("OPENAI_API_KEY is required (set in environment or .env, never committed).")

    return Settings(
        openai_api_key=api_key,
        chat_model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        summary_model=os.getenv("OPENAI_SUMMARY_MODEL", "gpt-4o-mini"),
        embed_model=os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
        hard_budget_tokens=int(os.getenv("HARD_BUDGET_TOKENS", "6000")),
        default_branch=os.getenv("MEMTOOL_DEFAULT_BRANCH"),
    )


def repo_root() -> Path:
    return Path.cwd()
