from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Dict, Any

import click
from openai import OpenAI

from .token_budget import count_tokens, cosine_similarity
from .secret_scrubber import mask, mostly_masked, is_excluded_path
from .utils import path_str


@dataclass
class Chunk:
    id: str
    text: str
    embedding: List[float]


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    tokens = text.split()
    chunks: List[str] = []
    start = 0
    while start < len(tokens):
        end = min(len(tokens), start + chunk_size)
        chunk_tokens = tokens[start:end]
        if chunk_tokens:
            chunks.append(" ".join(chunk_tokens))
        if end == len(tokens):
            break
        start = end - overlap
        if start < 0:
            start = 0
    return chunks


def embed_texts(client: OpenAI, model: str, texts: List[str]) -> List[List[float]]:
    try:
        resp = client.embeddings.create(model=model, input=texts)
    except Exception as exc:  # pragma: no cover - network
        raise click.ClickException(f"Embedding failed: {exc}") from exc
    vectors = [d.embedding for d in resp.data]
    return vectors


def index_files(
    client: OpenAI,
    memory: Dict[str, Any],
    paths: Iterable[Path],
    model: str,
    chunk_size: int,
    overlap: int,
    dry_run: bool = False,
) -> Dict[str, Any]:
    paths = list(paths)
    valid_files: List[Path] = []
    for p in paths:
        if p.is_dir():
            for fp in p.rglob("*"):
                if fp.is_file():
                    valid_files.append(fp)
        elif p.is_file():
            valid_files.append(p)
        else:
            click.echo(f"Skipping missing path: {path_str(p)}")

    filtered: List[Path] = []
    for f in valid_files:
        if is_excluded_path(f):
            click.echo(f"Excluded by policy: {path_str(f)}")
            continue
        filtered.append(f)

    new_chunks: List[Chunk] = []
    for f in filtered:
        text = f.read_text(encoding="utf-8", errors="ignore")
        masked = mask(text)
        if mostly_masked(text, masked):
            click.echo(f"Skipping mostly-masked file: {path_str(f)}")
            continue
        pieces = chunk_text(masked, chunk_size=chunk_size, overlap=overlap)
        for idx, piece in enumerate(pieces):
            star_ratio = piece.count("*") / max(1, len(piece))
            if star_ratio >= 0.6:
                continue
            new_chunks.append(Chunk(id=f"{path_str(f)}:{idx}", text=piece, embedding=[]))

    if dry_run:
        click.echo(f"Would index {len(new_chunks)} chunks from {len(filtered)} files.")
        return memory

    if not new_chunks:
        click.echo("No chunks to index.")
        return memory

    embeds = embed_texts(client, model, [c.text for c in new_chunks])
    for chunk, emb in zip(new_chunks, embeds):
        chunk.embedding = emb

    idx = memory.setdefault("docs_index", {"embedding_model": model, "chunks": []})
    idx["embedding_model"] = model
    idx["chunks"].extend({"id": c.id, "text": c.text, "embedding": c.embedding} for c in new_chunks)
    return memory


def retrieve_chunks(
    client: OpenAI,
    memory: Dict[str, Any],
    query: str,
    model: str,
    k: int,
) -> List[str]:
    idx = memory.get("docs_index", {})
    chunks = idx.get("chunks") or []
    if not chunks:
        return []
    query_emb = embed_texts(client, model, [query])[0]
    scored = []
    for ch in chunks:
        score = cosine_similarity(query_emb, ch.get("embedding", []))
        scored.append((score, ch.get("text", "")))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [text for _, text in scored[:k] if text]
