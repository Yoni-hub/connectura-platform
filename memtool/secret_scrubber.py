from __future__ import annotations

import fnmatch
import re
from pathlib import Path
from typing import Iterable

MASK = "********"

# Files to exclude from indexing/committing.
EXCLUDED_PATTERNS = [
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "id_rsa*",
    "credentials*",
    "*secrets*",
    "config.local*",
    "*.p12",
    "*.pfx",
    "*.keystore",
    "*.jks",
    "node_modules/**",
    "dist/**",
    "build/**",
]

SECRET_PATTERNS = [
    re.compile(r"sk_live_[A-Za-z0-9]+"),
    re.compile(r"AIza[0-9A-Za-z\-_]{35}"),
    re.compile(r"xox[ab]-[A-Za-z0-9\-]+"),
    re.compile(r"ghp_[A-Za-z0-9]{36,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)aws_secret_access_key\s*=\s*[A-Za-z0-9\/+=]{40}"),
    re.compile(r"Bearer\s+[A-Za-z0-9\-\._]+"),
    re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
    re.compile(r"(?i)(password|passwd|pwd|secret|token|apikey|api_key|auth|authorization)\s*[:=]\s*[\"']?[^\"'\s]+[\"']?"),
    re.compile(r"\w+://[^:\s]+:[^@\s]+@[^/\s]+"),
    re.compile(r"postgres(?:ql)?://[^:\s]+:[^@\s]+@[^/\s]+"),
]


def is_excluded_path(path: Path) -> bool:
    path_posix = path.as_posix()
    parts = list(path.parts)
    for pattern in EXCLUDED_PATTERNS:
        if fnmatch.fnmatch(path_posix, pattern):
            return True
        if any(fnmatch.fnmatch(part, pattern) for part in parts):
            return True
    return False


def mask(text: str) -> str:
    masked = text
    for pattern in SECRET_PATTERNS:
        masked = pattern.sub(MASK, masked)
    return masked


def mostly_masked(original: str, masked: str, threshold: float = 0.6) -> bool:
    if not original:
        return True
    if original == masked:
        return False
    masked_count = masked.count("*")
    return (masked_count / max(1, len(original))) >= threshold


def staged_has_excluded(paths: Iterable[str]) -> list[str]:
    bad = []
    for p in paths:
        if is_excluded_path(Path(p)):
            bad.append(p)
    return bad
