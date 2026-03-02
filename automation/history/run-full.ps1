param(
  [string]$RepoRoot = "C:\Users\yonat\OneDrive\Desktop\connsura"
)

$today = Get-Date -Format "yyyy-MM-dd"
$output = Join-Path $RepoRoot "docs\history\full-history-$today.md"
$json = Join-Path $RepoRoot "docs\history\full-history-$today.json"
$script = Join-Path $RepoRoot "automation\history\history_analysis.py"

python $script --repo $RepoRoot --mode full --output $output --json-output $json
