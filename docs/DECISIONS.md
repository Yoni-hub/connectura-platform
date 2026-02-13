# Decisions

- 2026-02: Staging moved to AWS EC2 (Ubuntu 22.04.5 LTS, us-east-1) with Elastic IP; deploys via automation/master.ps1 -SkipDns.
- 2025-12: Use Docker Compose with Nginx as a reverse proxy.
- 2025-12: Use PostgreSQL for staging persistence.
- 2025-12: Serve the frontend via Vite preview on port 4173 behind Nginx.
- 2025-12: Use staging.connsura.com and api.staging.connsura.com for staging.
