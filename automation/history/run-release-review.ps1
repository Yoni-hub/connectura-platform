param(
  [string]$RepoRoot = "C:\Users\yonat\OneDrive\Desktop\connsura",
  [Parameter(Mandatory = $true)][string]$RevRange
)

$today = Get-Date -Format "yyyy-MM-dd"
$output = Join-Path $RepoRoot "docs\history\release-review-$today.md"
$json = Join-Path $RepoRoot "docs\history\release-review-$today.json"
$script = Join-Path $RepoRoot "automation\history\history_analysis.py"

python $script --repo $RepoRoot --mode release --rev-range $RevRange --output $output --json-output $json
