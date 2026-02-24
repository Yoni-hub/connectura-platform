# Connsura Automation (Windows 11 Orchestrator)

This folder contains the automation scripts to deploy Connsura to an Ubuntu 22.04.5 LTS server via SSH and manage Squarespace DNS via Playwright.

## Current staging (AWS)
- Staging is hosted on AWS EC2 (us-east-1) with an Elastic IP.
- `automation/.env` points to the AWS host for deploys.
- Routine flow: test locally -> commit/push -> run:
  - `.\automation\master.ps1 -SkipDns`
- Use the full script (no `-SkipDns`) only when DNS changes are needed.

## Prereqs
- Windows 11 with OpenSSH Client enabled.
- Node.js installed locally (for Playwright).
- Router port forwarding: 22, 80, 443 -> your server LAN IP (only needed for home server hosting).
- Squarespace login for `connsura.com`.

## 1) Fill .env
Copy `automation/.env.example` to `automation/.env` and fill in:
- SSH connection values
- Domains
- LetsEncrypt email
- Squarespace credentials
- Optional `SS_DNS_URL` if you want to skip navigation and open the DNS settings page directly
- Optional admin seed creds

Security note: `.env` contains secrets. Keep it local only.

## 2) Set up SSH key (one-time)
Run:
```powershell
.\automation\01_setup_ssh_key.ps1
```
Follow the prompt to install the public key on the server.

## 3) Run the master automation
```powershell
.\automation\master.ps1
```

Optional flags:
- `-SkipDns` to skip Squarespace DNS automation.
- `-SkipProvision` to skip server provisioning.
- `-SkipDeploy` to skip app deployment.

If Squarespace prompts for MFA/OTP, complete it in the browser and press Enter in the terminal when asked.

## What the scripts do
- Playwright logs in to Squarespace and creates A records for:
  - `staging.connsura.com`
  - `api.staging.connsura.com`
- Server provisioning installs Docker + Nginx + Certbot, configures firewall, and sets up HTTPS.
- Deployment pulls the repo, builds frontend/backend containers, and starts them with Docker Compose.
- Deployment starts a PostgreSQL container (localhost-only), writes DB creds to `/opt/connsura/env/backend.env`,
  and creates a read-only user stored in `/opt/connsura/env/db_readonly.env`.

## Verification
After the run completes:
- Visit `https://staging.connsura.com`
- Visit `https://api.staging.connsura.com/`

## Deployment logs
- Server log: `/opt/connsura/deployments.log`
- Orchestrator log: `automation/deployments.log`

## EC2 auto-recovery (staging)
- Region: `us-east-1`
- Instance: `i-0d9447cfa53e1ed9d`
- Auto-recover alarm: `connsura-staging-ec2-system-auto-recover` (`StatusCheckFailed_System` -> `ec2:recover`)
- Auto-reboot alarm: `connsura-staging-ec2-instance-auto-reboot` (`StatusCheckFailed_Instance` -> `ec2:reboot`)
- Check alarm status:
  - `aws cloudwatch describe-alarms --region us-east-1 --alarm-names connsura-staging-ec2-system-auto-recover connsura-staging-ec2-instance-auto-reboot`

## Database access (staging)
- SSH tunnel: `ssh -L 5432:localhost:5432 <user>@<host>` then connect to `localhost:5432`.
- Read-only creds live at `/opt/connsura/env/db_readonly.env` (chmod 600).

## Local SQL helper (PowerShell)
- Use `automation/Invoke-ConnsuraSql.ps1` to run SQL against the local Docker Postgres container without PowerShell quote escaping issues.
- It pipes SQL over stdin to `psql`, so quoted identifiers (for example `"SiteContent"` and `"lastUpdated"`) work reliably.

Examples:

```powershell
@'
SELECT slug, title, "lastUpdated"
FROM "SiteContent"
ORDER BY slug;
'@ | .\automation\Invoke-ConnsuraSql.ps1
```

```powershell
.\automation\Invoke-ConnsuraSql.ps1 -FilePath .\query.sql
```
