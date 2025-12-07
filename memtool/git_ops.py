from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterable, List

import click

from .config import repo_root
from .secret_scrubber import staged_has_excluded


def _run_git(args: list[str], check: bool = True, capture_output: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=repo_root(),
        check=check,
        capture_output=capture_output,
        text=True,
    )


def ensure_repo_and_pull(branch: str | None = None) -> None:
    try:
        _run_git(["rev-parse", "--is-inside-work-tree"])
    except subprocess.CalledProcessError:
        raise click.ClickException("Not inside a git repository. Run memtool from within a repo.")

    status = _run_git(["status", "--porcelain"], capture_output=True).stdout.strip()
    if branch:
        if status:
            raise click.ClickException("Working tree is dirty. Commit or stash changes before switching branch.")
        _run_git(["checkout", branch])
    _run_git(["fetch", "--all", "--prune"])
    try:
        _run_git(["pull", "--rebase"])
    except subprocess.CalledProcessError as exc:
        raise click.ClickException("git pull --rebase failed (possible conflicts). Resolve conflicts then retry.") from exc


def stage_allowed() -> None:
    allowed = [
        "project_memory/*.json",
        "memtool/**",
        "README.md",
        ".env.example",
        ".gitignore",
    ]
    _run_git(["add", *allowed])


def ensure_no_excluded_staged() -> None:
    staged = _run_git(["diff", "--cached", "--name-only"], capture_output=True).stdout.splitlines()
    bad = staged_has_excluded(staged)
    if bad:
        raise click.ClickException(f"Refusing to commit excluded paths: {', '.join(bad)}")


def commit_and_push(message: str, branch: str | None = None) -> None:
    stage_allowed()
    ensure_no_excluded_staged()
    staged = _run_git(["diff", "--cached", "--name-only"], capture_output=True).stdout.strip()
    if not staged:
        return
    _run_git(["commit", "-m", message])
    try:
        _run_git(["push"] + (["origin", branch] if branch else []))
        return
    except subprocess.CalledProcessError:
        # retry once after rebase
        _run_git(["fetch", "--all", "--prune"])
        try:
            _run_git(["pull", "--rebase"])
        except subprocess.CalledProcessError as exc:
            raise click.ClickException("Push rejected and rebase failed. Resolve manually and retry.") from exc
        try:
            _run_git(["push"] + (["origin", branch] if branch else []))
        except subprocess.CalledProcessError as exc:
            raise click.ClickException("Push failed after retry. Resolve manually then rerun.") from exc


def require_clean_worktree() -> None:
    status = _run_git(["status", "--porcelain"], capture_output=True).stdout.strip()
    if status:
        raise click.ClickException("Working tree must be clean for this operation.")


def push_only(branch: str | None = None) -> None:
    try:
        _run_git(["push"] + (["origin", branch] if branch else []))
    except subprocess.CalledProcessError as exc:
        raise click.ClickException("Push failed. Fetch/pull to resolve, then retry.") from exc
