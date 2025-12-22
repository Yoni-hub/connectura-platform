param(
  [string]$KeyPath = "$env:USERPROFILE\.ssh\connsura_deploy",
  [string]$SshUser = "connsura-master",
  [string]$SshHost = "173.66.0.69",
  [int]$SshPort = 22
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Split-Path $KeyPath))) {
  New-Item -ItemType Directory -Path (Split-Path $KeyPath) | Out-Null
}

if (-not (Test-Path $KeyPath)) {
  $cmd = "ssh-keygen -t ed25519 -C `"connsura-deploy`" -f `"$KeyPath`" -N `"`"`""
  cmd /c $cmd
  Write-Host "Created SSH key: $KeyPath"
} else {
  Write-Host "SSH key already exists: $KeyPath"
}

$pubKeyPath = "$KeyPath.pub"
if (-not (Test-Path $pubKeyPath)) {
  throw "Public key not found at $pubKeyPath"
}

$installCmd = "type `"$pubKeyPath`" | ssh -p $SshPort -o StrictHostKeyChecking=accept-new $SshUser@$SshHost `"mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`""

Write-Host ""
Write-Host "Run this to install the public key on the server:"
Write-Host $installCmd
Write-Host ""

$choice = Read-Host "Run install command now? (y/n)"
if ($choice -match "^[Yy]") {
  cmd /c $installCmd
  Write-Host "Key installed. Try: ssh -i `"$KeyPath`" -p $SshPort $SshUser@$SshHost"
}
