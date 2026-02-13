# Deployment

## Environments
- Staging server: AWS EC2 Ubuntu 22.04.5 LTS (us-east-1) with Elastic IP.
- Orchestration host: Windows 11 runs the automation scripts.

## Automation flow
1) Fill `automation/.env` with SSH, domain, and repo settings.
2) Run `automation/master.ps1 -SkipDns` for routine deploys.
3) Optional Squarespace DNS automation runs via Playwright.
4) Server provisioning installs Docker, Nginx, Certbot, and configures HTTPS.
5) Deployment pulls the repo, builds images, and starts containers with Docker Compose.

## Ports and routing
- Frontend container: 4173 (Vite preview).
- Backend container: 8000 (Express API).
- Nginx terminates TLS and proxies to the containers on 80/443.

## Deployment logs
- Server log: `/opt/connsura/deployments.log`
- Orchestrator log: `automation/deployments.log`
