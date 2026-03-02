#!/usr/bin/env python3
import argparse
import collections
import datetime as dt
import json
import re
import subprocess
from pathlib import Path

CATEGORY_PATTERNS = {
    "feature": re.compile(r"\b(feat|feature|add|introduce)\b", re.IGNORECASE),
    "bugfix": re.compile(r"\b(fix|bug|hotfix|patch|regress)\b", re.IGNORECASE),
    "security": re.compile(r"\b(security|auth|otp|rate\s*limit|csrf|xss|jwt|password)\b", re.IGNORECASE),
    "docs": re.compile(r"\b(docs?|readme|runbook|decision)\b", re.IGNORECASE),
    "infra": re.compile(r"\b(chore|deploy|docker|nginx|ci|staging|ops|infra|monitor)\b", re.IGNORECASE),
    "refactor": re.compile(r"\b(refactor|cleanup|rename|rework)\b", re.IGNORECASE),
}

KEY_RISK_PATTERNS = [
    re.compile(r"\b(auth|password|otp|jwt|security|rate\s*limit)\b", re.IGNORECASE),
    re.compile(r"\b(prisma|migration|postgres|database|sql)\b", re.IGNORECASE),
    re.compile(r"\b(deploy|docker|nginx|staging|production|rollback)\b", re.IGNORECASE),
]


def run_git(repo: Path, args: list[str]) -> str:
    cmd = ["git", "-C", str(repo), *args]
    return subprocess.check_output(cmd, text=True, encoding="utf-8", errors="replace")


def get_commits(repo: Path, rev_range: str | None, since: str | None, until: str | None):
    pretty = "%H%x1f%an%x1f%ad%x1f%s"
    cmd = ["log", "--date=short", f"--pretty=format:{pretty}", "--name-only"]
    if since:
        cmd.append(f"--since={since}")
    if until:
        cmd.append(f"--until={until}")
    if rev_range:
        cmd.append(rev_range)

    raw = run_git(repo, cmd).splitlines()

    commits = []
    cur = None
    for line in raw:
        if not line.strip():
            continue
        parts = line.split("\x1f")
        if len(parts) == 4:
            if cur:
                commits.append(cur)
            cur = {
                "hash": parts[0],
                "author": parts[1],
                "date": parts[2],
                "subject": parts[3],
                "files": [],
            }
            continue
        if cur:
            cur["files"].append(line.strip())
    if cur:
        commits.append(cur)
    return commits


def classify(subject: str) -> str:
    for category, pattern in CATEGORY_PATTERNS.items():
        if pattern.search(subject):
            return category
    return "other"


def is_risk(subject: str) -> bool:
    return any(pattern.search(subject) for pattern in KEY_RISK_PATTERNS)


def top_counts(counter: collections.Counter, limit: int = 10):
    return [{"name": k, "count": v} for k, v in counter.most_common(limit)]


def dir_of(path: str) -> str:
    if "/" not in path:
        return "(root)"
    return path.split("/", 1)[0]


def summarize(commits: list[dict]):
    authors = collections.Counter()
    files = collections.Counter()
    dirs = collections.Counter()
    categories = collections.Counter()
    risk_commits = []

    for c in commits:
        authors[c["author"]] += 1
        categories[classify(c["subject"])] += 1
        if is_risk(c["subject"]):
            risk_commits.append(c)
        for f in c["files"]:
            if not f:
                continue
            nf = f.replace("\\", "/")
            files[nf] += 1
            dirs[dir_of(nf)] += 1

    return {
        "total_commits": len(commits),
        "authors": top_counts(authors),
        "categories": dict(categories),
        "top_files": top_counts(files),
        "top_dirs": top_counts(dirs),
        "risk_commits": risk_commits[:15],
    }


def render_markdown(mode: str, period_label: str, summary: dict, commits: list[dict]) -> str:
    lines = []
    today = dt.date.today().isoformat()
    lines.append(f"# {mode.title()} History Analysis ({today})")
    lines.append("")
    lines.append(f"Period: {period_label}")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append(f"- Total commits: {summary['total_commits']}")
    lines.append(f"- Active authors: {len(summary['authors'])}")
    lines.append(f"- Files touched: {len({f for c in commits for f in c['files']})}")
    lines.append("")

    lines.append("## Commit Categories")
    if summary["categories"]:
        for k, v in sorted(summary["categories"].items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"- {k}: {v}")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## Top Churn Directories")
    if summary["top_dirs"]:
        for item in summary["top_dirs"]:
            lines.append(f"- {item['name']}: {item['count']} file touches")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## Top Churn Files")
    if summary["top_files"]:
        for item in summary["top_files"]:
            lines.append(f"- {item['name']}: {item['count']} touches")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## Risk-Relevant Commits")
    if summary["risk_commits"]:
        for c in summary["risk_commits"]:
            lines.append(f"- {c['date']} {c['hash'][:10]} {c['subject']}")
    else:
        lines.append("- None detected by keyword heuristics")
    lines.append("")

    lines.append("## Recent Commits (Newest First)")
    for c in commits[:20]:
        lines.append(f"- {c['date']} {c['hash'][:10]} {c['subject']}")

    lines.append("")
    lines.append("## Next Actions")
    lines.append("- Verify top churn files have matching tests for recent bugfix/security changes.")
    lines.append("- Check docs alignment when infra/auth/database related commits appear.")
    lines.append("- Use this report as input for sprint or release risk review.")
    lines.append("")
    return "\n".join(lines)


def build_period_label(mode: str, args) -> str:
    if mode == "full":
        return "Repository inception -> HEAD"
    if mode == "weekly":
        return f"Last {args.days} day(s) -> HEAD"
    if mode == "release":
        if args.rev_range:
            return f"Revision range {args.rev_range}"
        return "Release review window"
    return "Custom window"


def main():
    parser = argparse.ArgumentParser(description="Generate Connsura history analysis report")
    parser.add_argument("--repo", required=True, help="Path to git repository")
    parser.add_argument("--mode", choices=["full", "weekly", "release"], required=True)
    parser.add_argument("--output", required=True, help="Markdown output path")
    parser.add_argument("--json-output", required=False, help="Optional JSON output path")
    parser.add_argument("--days", type=int, default=7, help="Days for weekly mode")
    parser.add_argument("--rev-range", help="Git revision range (e.g., v1.2.0..HEAD)")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    since = None
    until = None
    rev_range = args.rev_range

    if args.mode == "weekly":
        since = f"{args.days} days ago"

    commits = get_commits(repo, rev_range=rev_range, since=since, until=until)
    summary = summarize(commits)
    period_label = build_period_label(args.mode, args)
    md = render_markdown(args.mode, period_label, summary, commits)
    output.write_text(md, encoding="utf-8")

    if args.json_output:
        json_path = Path(args.json_output).resolve()
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps({"mode": args.mode, "period": period_label, "summary": summary}, indent=2), encoding="utf-8")

    print(f"Wrote report: {output}")
    if args.json_output:
        print(f"Wrote JSON summary: {args.json_output}")


if __name__ == "__main__":
    main()
