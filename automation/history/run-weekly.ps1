param(
  [string]$RepoRoot = "C:\Users\yonat\OneDrive\Desktop\connsura",
  [int]$Days = 7
)

$today = Get-Date -Format "yyyy-MM-dd"
$output = Join-Path $RepoRoot "docs\history\weekly-$today.md"
$json = Join-Path $RepoRoot "docs\history\weekly-$today.json"
$script = Join-Path $RepoRoot "automation\history\history_analysis.py"

python $script --repo $RepoRoot --mode weekly --days $Days --output $output --json-output $json
