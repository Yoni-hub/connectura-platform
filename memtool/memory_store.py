from __future__ import annotations

from pathlib import Path
from typing import Dict, Any

import click

from .config import repo_root
from .utils import read_json, write_json, ensure_parent, path_str

MEMORY_FILES = {
    "global": repo_root() / "project_memory" / "project_memory.json",
    "frontend": repo_root() / "project_memory" / "memory_frontend.json",
    "backend": repo_root() / "project_memory" / "memory_backend.json",
    "data": repo_root() / "project_memory" / "memory_data.json",
}

DEFAULT_MEMORY: Dict[str, Any] = {
    "long_term_memory": "",
    "messages": [],
    "docs_index": {
        "embedding_model": "text-embedding-3-small",
        "chunks": [],
    },
}


def memory_path(domain: str) -> Path:
    if domain not in MEMORY_FILES:
        raise click.ClickException(f"Unknown domain '{domain}'")
    return MEMORY_FILES[domain]


def load_memory(domain: str) -> Dict[str, Any]:
    path = memory_path(domain)
    data = read_json(path, DEFAULT_MEMORY)
    # Ensure required keys
    for key, value in DEFAULT_MEMORY.items():
        if key not in data:
            data[key] = value
    if "docs_index" not in data or not isinstance(data["docs_index"], dict):
        data["docs_index"] = DEFAULT_MEMORY["docs_index"]
    if "chunks" not in data["docs_index"]:
        data["docs_index"]["chunks"] = []
    return data


def save_memory(domain: str, memory: Dict[str, Any]) -> Path:
    path = memory_path(domain)
    ensure_parent(path)
    write_json(path, memory)
    return path


def ensure_memory_files() -> None:
    for path in MEMORY_FILES.values():
        ensure_parent(path)
        if not path.exists():
            write_json(path, DEFAULT_MEMORY)
