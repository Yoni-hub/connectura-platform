from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any

import click
from openai import OpenAI
from rich import print as rprint
from rich.table import Table

from .config import load_settings
from .memory_store import load_memory, save_memory, ensure_memory_files
from .summarizer import summarize_if_needed
from .retrieval import retrieve_chunks, index_files
from .token_budget import messages_token_count, trim_messages_to_budget, count_tokens
from .git_ops import ensure_repo_and_pull, commit_and_push, require_clean_worktree, push_only

DEFAULT_COMMIT_MSG = "chore(memory): update project memory"


def _domain_option(f):
    return click.option(
        "--domain",
        type=click.Choice(["global", "frontend", "backend", "data"]),
        default="global",
        show_default=True,
        help="Select memory file to operate on.",
    )(f)


@click.group()
def cli() -> None:
    """memtool CLI for GitHub-backed project memory."""


def build_chat_messages(memory: Dict[str, Any], user_prompt: str, retrieved: List[str], settings) -> List[Dict[str, str]]:
    system_msgs: List[Dict[str, str]] = [{"role": "system", "content": "You are a senior software engineer. Be precise and safe."}]
    if memory.get("long_term_memory"):
        system_msgs.append({"role": "system", "content": "[PROJECT MEMORY]\n" + memory["long_term_memory"]})
    if retrieved:
        system_msgs.append({"role": "system", "content": "[RETRIEVED CONTEXT]\n" + "\n\n".join(retrieved)})

    history = list(memory.get("messages", []))
    history.append({"role": "user", "content": user_prompt})

    # Trim history to fit budget minus system + headroom.
    system_tokens = sum(count_tokens(m["content"]) for m in system_msgs)
    allowed_for_history = max(0, settings.hard_budget_tokens - system_tokens - 800)
    trimmed_history = trim_messages_to_budget(history, allowed_for_history)

    return system_msgs + trimmed_history


@cli.command()
@_domain_option
@click.option("--prompt", required=True, help="User prompt for chat.")
@click.option("--k", default=6, show_default=True, help="Top-K chunks to retrieve.")
@click.option("--temperature", default=0.2, show_default=True, help="Model temperature.")
@click.option("--branch", default=None, help="Branch to operate on (default: current).")
def chat(domain: str, prompt: str, k: int, temperature: float, branch: str | None) -> None:
    """Chat with project memory, auto-syncing with GitHub."""
    settings = load_settings()
    client = OpenAI()
    ensure_repo_and_pull(branch)
    ensure_memory_files()
    memory = load_memory(domain)

    memory = summarize_if_needed(client, memory, settings.summary_model, settings.hard_budget_tokens)

    retrieved = retrieve_chunks(client, memory, prompt, settings.embed_model, k)
    messages = build_chat_messages(memory, prompt, retrieved, settings)

    try:
        resp = client.chat.completions.create(
            model=settings.chat_model,
            temperature=temperature,
            messages=messages,
        )
    except Exception as exc:  # pragma: no cover - network
        raise click.ClickException(f"Chat completion failed: {exc}") from exc

    answer = resp.choices[0].message.content.strip()
    memory.setdefault("messages", []).append({"role": "user", "content": prompt})
    memory["messages"].append({"role": "assistant", "content": answer})

    save_memory(domain, memory)
    commit_and_push(DEFAULT_COMMIT_MSG, branch)
    rprint(answer)


@cli.command("index-files")
@_domain_option
@click.option("--chunk-size", default=800, show_default=True, help="Chunk size in tokens (approx).")
@click.option("--overlap", default=150, show_default=True, help="Token overlap between chunks.")
@click.option("--dry-run", is_flag=True, help="Show what would be indexed without embedding.")
@click.option("--branch", default=None, help="Branch to operate on (default: current).")
@click.argument("paths", nargs=-1)
def index_files_cmd(domain: str, chunk_size: int, overlap: int, dry_run: bool, branch: str | None, paths: tuple[str, ...]) -> None:
    """Index files into the project memory docs_index with secret scrubbing."""
    if not paths:
        raise click.ClickException("Provide at least one path to index.")
    settings = load_settings()
    client = OpenAI()
    ensure_repo_and_pull(branch)
    ensure_memory_files()
    path_objs = []
    for p in paths:
        if any(char in p for char in ["*", "?", "["]):
            path_objs.extend(Path(".").glob(p))
        else:
            path_objs.append(Path(p))
    memory = load_memory(domain)
    memory = index_files(client, memory, path_objs, settings.embed_model, chunk_size, overlap, dry_run=dry_run)
    if not dry_run:
        save_memory(domain, memory)
        commit_and_push(DEFAULT_COMMIT_MSG, branch)
        click.echo("Indexing complete and pushed.")


@cli.command()
@_domain_option
@click.option("--force", is_flag=True, help="Force summarization even if under budget.")
@click.option("--branch", default=None, help="Branch to operate on (default: current).")
def summarize(domain: str, force: bool, branch: str | None) -> None:
    """Summarize older messages into long_term_memory."""
    settings = load_settings()
    client = OpenAI()
    ensure_repo_and_pull(branch)
    ensure_memory_files()
    memory = load_memory(domain)
    if force:
        memory = summarize_if_needed(client, memory, settings.summary_model, 0)
    else:
        memory = summarize_if_needed(client, memory, settings.summary_model, settings.hard_budget_tokens)
    save_memory(domain, memory)
    commit_and_push(DEFAULT_COMMIT_MSG, branch)
    click.echo("Summary saved and pushed.")


@cli.command()
@_domain_option
@click.option("--branch", default=None, help="Branch to operate on (default: current).")
def show(domain: str, branch: str | None) -> None:
    """Show memory stats and recent messages (no commit)."""
    settings = load_settings()
    ensure_repo_and_pull(branch)
    ensure_memory_files()
    memory = load_memory(domain)

    lt_tokens = count_tokens(memory.get("long_term_memory", ""))
    msg_tokens = messages_token_count(memory.get("messages", []))
    click.echo(f"Long term tokens: {lt_tokens}")
    click.echo(f"Message tokens: {msg_tokens}")
    click.echo(f"Docs chunks: {len(memory.get('docs_index', {}).get('chunks', []))}")

    table = Table(title="Last 5 Messages")
    table.add_column("Role")
    table.add_column("Content")
    for m in memory.get("messages", [])[-5:]:
        table.add_row(m.get("role", ""), m.get("content", "")[:200])
    rprint(table)


@cli.command("git-commit")
@click.option("--message", default=DEFAULT_COMMIT_MSG, show_default=True, help="Commit message.")
@click.option("--branch", default=None, help="Branch to operate on (default: current).")
def git_commit_cmd(message: str, branch: str | None) -> None:
    """Stage allowed paths, safety check, commit, and push."""
    ensure_repo_and_pull(branch)
    commit_and_push(message, branch)
    click.echo("Committed and pushed.")


@cli.command("git-push")
@click.option("--branch", default=None, help="Branch to operate on (default: current).")
def git_push_cmd(branch: str | None) -> None:
    """Push current branch after ensuring clean tree."""
    ensure_repo_and_pull(branch)
    require_clean_worktree()
    push_only(branch)
    click.echo("Push complete.")


if __name__ == "__main__":
    cli()
