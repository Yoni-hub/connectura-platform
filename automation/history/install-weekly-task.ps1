param(
  [string]$RepoRoot = "C:\Users\yonat\OneDrive\Desktop\connsura",
  [string]$TaskName = "ConnsuraHistoryWeekly",
  [string]$Time = "09:00"
)

$scriptPath = Join-Path $RepoRoot "automation\history\run-weekly.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -RepoRoot `"$RepoRoot`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $Time
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description "Weekly Connsura git history scan" -Force

Write-Host "Scheduled task '$TaskName' registered for Mondays at $Time"
