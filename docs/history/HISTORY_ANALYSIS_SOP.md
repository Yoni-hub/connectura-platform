# History Analysis SOP

## Purpose
Provide repeatable git-history analysis for Connsura with two operating modes:
- Weekly light scan every Monday morning.
- Release review run immediately before production release.

## Scope
- Repository: `C:\Users\yonat\OneDrive\Desktop\connsura`
- Branch: current checked-out branch (normally `main` for release review).
- Inputs:
  - Full git history or bounded revision ranges.
  - Commit metadata (author/date/subject/files touched).
  - Existing operations/architecture decision docs for interpretation.

## Outputs
Reports are written to `docs/history/`:
- `full-history-YYYY-MM-DD.md` + `.json`
- `weekly-YYYY-MM-DD.md` + `.json`
- `release-review-YYYY-MM-DD.md` + `.json`

Each markdown report includes:
- Executive summary.
- Commit category distribution.
- Top churn directories and files.
- Risk-relevant commits (auth/security/db/deploy keywords).
- Recent commit feed.
- Next actions.

## Execution Commands
From repo root:

```powershell
# Full baseline history analysis
powershell -NoProfile -ExecutionPolicy Bypass -File automation\history\run-full.ps1

# Weekly light scan (default last 7 days)
powershell -NoProfile -ExecutionPolicy Bypass -File automation\history\run-weekly.ps1

# Release review (required before production release)
powershell -NoProfile -ExecutionPolicy Bypass -File automation\history\run-release-review.ps1 -RevRange "<last-prod-tag>..HEAD"
```

Example release run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\history\run-release-review.ps1 -RevRange "v0.9.4..HEAD"
```

## Schedule Policy
1. Weekly scan:
- Run every Monday morning at 09:00 America/New_York.
- Script: `automation/history/run-weekly.ps1`.
- Preferred automation: Windows Task Scheduler.

2. Pre-release review:
- Run on release day before production deployment.
- Required input: revision range from last production tag to current release commit.
- Script: `automation/history/run-release-review.ps1`.

## Windows Task Scheduler Setup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\history\install-weekly-task.ps1
```

This registers task `ConnsuraHistoryWeekly` for Monday at 09:00.

## Definition of Done
- Weekly: report generated for current date in `docs/history/`.
- Pre-release: release-review report generated and read before deployment.
- Report contains at least one explicit risk check action for top churn or security/auth/database/deploy commits.

## Guardrails
- Heuristic classification is keyword-based; use engineering review for final risk decisions.
- If commit messages are low quality, inspect commit diffs for high-risk files.
- Keep release review tied to exact rev range to avoid false confidence.
