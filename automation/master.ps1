param(
  [switch]$SkipDns,
  [switch]$SkipProvision,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Missing .env file at $Path. Copy automation\\.env.example to automation\\.env and fill it in."
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Get-RequiredEnv {
  param([string]$Name)
  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required env var: $Name"
  }
  return $value
}

function Get-OptionalEnv {
  param([string]$Name)
  return [Environment]::GetEnvironmentVariable($Name, "Process")
}

function Wait-DnsRecord {
  param(
    [string]$Name,
    [string]$ExpectedIp,
    [int]$TimeoutSeconds = 900
  )

  $start = Get-Date
  do {
    $records = Resolve-DnsName -Name $Name -Type A -ErrorAction SilentlyContinue
    if ($records -and ($records.IPAddress -contains $ExpectedIp)) {
      return $true
    }
    Start-Sleep -Seconds 15
  } while ((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds

  return $false
}

function Quote-BashValue {
  param([string]$Value)
  if ($null -eq $Value) { return "''" }
  $replacement = "'" + '"' + "'" + '"' + "'"
  $escaped = $Value -replace "'", $replacement
  return "'" + $escaped + "'"
}

function Assert-LastExit {
  param([string]$Message)
  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

$scriptRoot = $PSScriptRoot
$envPath = Join-Path $scriptRoot ".env"
Import-DotEnv -Path $envPath

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH client not found. Install OpenSSH Client in Windows Features."
}
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  throw "OpenSSH scp not found. Install OpenSSH Client in Windows Features."
}

$sshHost = Get-RequiredEnv "SSH_HOST"
$sshPort = Get-RequiredEnv "SSH_PORT"
$sshUser = Get-RequiredEnv "SSH_USER"
$sshKey = Get-RequiredEnv "SSH_KEY_PATH"

if (-not (Test-Path $sshKey)) {
  throw "SSH key not found at $sshKey. Run automation\\01_setup_ssh_key.ps1 first."
}

$domain = Get-RequiredEnv "DOMAIN"
$apiDomain = Get-RequiredEnv "API_DOMAIN"
$rootDomain = Get-OptionalEnv "ROOT_DOMAIN"
$publicIp = Get-RequiredEnv "PUBLIC_IP"
$letsencryptEmail = Get-RequiredEnv "LETSENCRYPT_EMAIL"
$repoUrl = Get-RequiredEnv "REPO_URL"
$repoBranch = Get-RequiredEnv "REPO_BRANCH"

$jwtSecret = Get-OptionalEnv "JWT_SECRET"
$adminEmail = Get-OptionalEnv "ADMIN_EMAIL"
$adminPassword = Get-OptionalEnv "ADMIN_PASSWORD"
$sesSmtpHost = Get-OptionalEnv "SES_SMTP_HOST"
$sesSmtpPort = Get-OptionalEnv "SES_SMTP_PORT"
$sesSmtpUser = Get-OptionalEnv "SES_SMTP_USER"
$sesSmtpPass = Get-OptionalEnv "SES_SMTP_PASS"
$emailFrom = Get-OptionalEnv "EMAIL_FROM"
$emailReplyTo = Get-OptionalEnv "EMAIL_REPLY_TO"
$emailSupportInbox = Get-OptionalEnv "EMAIL_SUPPORT_INBOX"

$sshTarget = "$sshUser@$sshHost"
$sshArgs = @("-i", $sshKey, "-p", $sshPort, "-o", "StrictHostKeyChecking=accept-new")
$sshTty = Get-OptionalEnv "SSH_TTY"
$sshRunArgs = $sshArgs
if ($sshTty -eq "1") {
  $sshRunArgs = $sshArgs + @("-t")
}
$scpArgs = @("-i", $sshKey, "-P", $sshPort, "-o", "StrictHostKeyChecking=accept-new")

Write-Host "Using SSH target: $sshTarget"

if (-not $SkipDns) {
  $null = Get-RequiredEnv "SS_EMAIL"
  $null = Get-RequiredEnv "SS_PASSWORD"

  Write-Host "Installing automation deps (Playwright)..."
  Push-Location $scriptRoot
  if (-not (Test-Path (Join-Path $scriptRoot "node_modules"))) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed in automation folder." }
  }
  if (-not (Test-Path (Join-Path $scriptRoot "node_modules\\.bin\\playwright.cmd"))) {
    npx playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw "Playwright install failed." }
  }
  Write-Host "Running Squarespace DNS automation..."
  npm run dns:squarespace
  if ($LASTEXITCODE -ne 0) { throw "Squarespace DNS automation failed." }
  Pop-Location

  Write-Host "Waiting for DNS propagation..."
  if (-not (Wait-DnsRecord -Name $domain -ExpectedIp $publicIp)) {
    throw "DNS for $domain did not resolve to $publicIp within timeout."
  }
  if (-not (Wait-DnsRecord -Name $apiDomain -ExpectedIp $publicIp)) {
    throw "DNS for $apiDomain did not resolve to $publicIp within timeout."
  }
}

$remoteEnvPath = Join-Path $scriptRoot "_remote.env"
$remoteEnv = @()
$remoteEnv += "ROOT_DOMAIN=$(Quote-BashValue $rootDomain)"
$remoteEnv += "DOMAIN=$(Quote-BashValue $domain)"
$remoteEnv += "API_DOMAIN=$(Quote-BashValue $apiDomain)"
$remoteEnv += "PUBLIC_IP=$(Quote-BashValue $publicIp)"
$remoteEnv += "LETSENCRYPT_EMAIL=$(Quote-BashValue $letsencryptEmail)"
$remoteEnv += "REPO_URL=$(Quote-BashValue $repoUrl)"
$remoteEnv += "REPO_BRANCH=$(Quote-BashValue $repoBranch)"
if (-not [string]::IsNullOrWhiteSpace($jwtSecret)) { $remoteEnv += "JWT_SECRET=$(Quote-BashValue $jwtSecret)" }
if (-not [string]::IsNullOrWhiteSpace($adminEmail)) { $remoteEnv += "ADMIN_EMAIL=$(Quote-BashValue $adminEmail)" }
if (-not [string]::IsNullOrWhiteSpace($adminPassword)) { $remoteEnv += "ADMIN_PASSWORD=$(Quote-BashValue $adminPassword)" }
if (-not [string]::IsNullOrWhiteSpace($sesSmtpHost)) { $remoteEnv += "SES_SMTP_HOST=$(Quote-BashValue $sesSmtpHost)" }
if (-not [string]::IsNullOrWhiteSpace($sesSmtpPort)) { $remoteEnv += "SES_SMTP_PORT=$(Quote-BashValue $sesSmtpPort)" }
if (-not [string]::IsNullOrWhiteSpace($sesSmtpUser)) { $remoteEnv += "SES_SMTP_USER=$(Quote-BashValue $sesSmtpUser)" }
if (-not [string]::IsNullOrWhiteSpace($sesSmtpPass)) { $remoteEnv += "SES_SMTP_PASS=$(Quote-BashValue $sesSmtpPass)" }
if (-not [string]::IsNullOrWhiteSpace($emailFrom)) { $remoteEnv += "EMAIL_FROM=$(Quote-BashValue $emailFrom)" }
if (-not [string]::IsNullOrWhiteSpace($emailReplyTo)) { $remoteEnv += "EMAIL_REPLY_TO=$(Quote-BashValue $emailReplyTo)" }
if (-not [string]::IsNullOrWhiteSpace($emailSupportInbox)) { $remoteEnv += "EMAIL_SUPPORT_INBOX=$(Quote-BashValue $emailSupportInbox)" }

$remoteEnvText = ($remoteEnv -join "`n") + "`n"
[System.IO.File]::WriteAllText($remoteEnvPath, $remoteEnvText, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Uploading environment file..."
& scp @scpArgs $remoteEnvPath "$sshTarget`:/tmp/connsura.env"
Assert-LastExit "Failed to upload environment file to $sshTarget."

if (-not $SkipProvision) {
  Write-Host "Uploading provision script..."
  & scp @scpArgs (Join-Path $scriptRoot "ssh\\provision.sh") "$sshTarget`:/tmp/connsura_provision.sh"
  Assert-LastExit "Failed to upload provision script to $sshTarget."
  Write-Host "Running provision script..."
  & ssh @sshRunArgs $sshTarget "chmod +x /tmp/connsura_provision.sh && bash /tmp/connsura_provision.sh"
  Assert-LastExit "Provision script failed on $sshTarget."
}

if (-not $SkipDeploy) {
  Write-Host "Uploading deploy script..."
  & scp @scpArgs (Join-Path $scriptRoot "ssh\\deploy.sh") "$sshTarget`:/tmp/connsura_deploy.sh"
  Assert-LastExit "Failed to upload deploy script to $sshTarget."
  Write-Host "Running deploy script..."
  & ssh @sshRunArgs $sshTarget "chmod +x /tmp/connsura_deploy.sh && bash /tmp/connsura_deploy.sh"
  Assert-LastExit "Deploy script failed on $sshTarget."

  try {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $remoteSha = (& ssh @sshArgs $sshTarget "git -C /opt/connsura/app rev-parse HEAD").Trim()
    if ([string]::IsNullOrWhiteSpace($remoteSha)) { $remoteSha = "unknown" }
    $logPath = Join-Path $scriptRoot "deployments.log"
    $logLine = "timestamp=$timestamp target=$sshTarget sha=$remoteSha branch=$repoBranch domain=$domain api_domain=$apiDomain"
    Add-Content -Path $logPath -Value $logLine
  } catch {
    Write-Host "Warning: failed to append deployment log locally."
  }
}

Remove-Item -Force $remoteEnvPath
Write-Host "Done."
