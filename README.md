# memtool — GitHub-backed project memory CLI

`memtool` keeps project memory in the repo, summarizes early, scrubs secrets, and auto syncs with GitHub on each write.

## Setup
1) `pip install openai tiktoken click python-dotenv rich`
2) `cp .env.example .env` and set `OPENAI_API_KEY` locally (never commit).  
3) Ensure git credential helper or `GITHUB_TOKEN/GH_TOKEN` is already configured; memtool never prompts for creds.

## Commands
- `memtool show [--domain global|frontend|backend|data]` — fetch/rebase, display token counts + last 5 messages.
- `memtool chat --prompt "..." [--k 6] [--temperature 0.2] [--domain ...]` — fetch/rebase, summarize if needed, retrieve, answer, save, commit, push.
- `memtool index-files --domain ... [--chunk-size 800] [--overlap 150] [--dry-run] <paths...>` — scrub, chunk, embed, save, commit, push.
- `memtool summarize --domain ... [--force]` — summarize oldest half into long_term_memory, save, commit, push.
- `memtool git-commit [--message "..."]` — stage allowed files, safety-check exclusions, commit, push.
- `memtool git-push` — ensure clean tree, fetch/rebase, push (no commit).

## Memory model
`project_memory/<domain>.json`:
```json
{
  "long_term_memory": "",
  "messages": [],
  "docs_index": { "embedding_model": "text-embedding-3-small", "chunks": [] }
}
```
Summaries use headings: Data model, APIs, Decisions, Open questions, Next steps.

## Safety & scrubbing
- Excludes from indexing/commit: .env, .env.*, *.pem, *.key, id_rsa*, credentials*, *secrets*, config.local*, *.p12, *.pfx, *.keystore, *.jks, node_modules/**, dist/**, build/**.
- Masks before embedding: Stripe keys, Google API keys, Slack tokens, GitHub tokens, AWS keys, JWT/Bearer tokens, generic password/token patterns, URLs with embedded creds, DB URLs (password masked).
- Aborts commit if excluded paths are staged.

## Quickstart
```bash
memtool show
memtool chat --prompt "Summarize our project goals"
memtool index-files --domain backend backend/**/*.py --dry-run
memtool summarize --domain global
memtool git-commit -m "chore(memory): bootstrap"
memtool git-push
```
