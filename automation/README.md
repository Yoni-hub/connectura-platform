# Connsura Automation (Windows 11 Orchestrator)

This folder contains the automation scripts to deploy Connsura to an Ubuntu 22.04.5 LTS server via SSH and manage Squarespace DNS via Playwright.

## Prereqs
- Windows 11 with OpenSSH Client enabled.
- Node.js installed locally (for Playwright).
- Router port forwarding: 22, 80, 443 -> your server LAN IP.
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

## Verification
After the run completes:
- Visit `https://staging.connsura.com`
- Visit `https://api.staging.connsura.com/`

## Deployment logs
- Server log: `/opt/connsura/deployments.log`
- Orchestrator log: `automation/deployments.log`
