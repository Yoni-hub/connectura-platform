# Staging Readiness Test Plan

Goal: determine whether the current local Connsura app is ready for deployment to the existing staging environment.

## Preflight Checks (Windows Local)
- Confirm required tools are installed:
  - `git --version`
  - `node -v`
  - `npm -v`
  - `npx -v`
  - `docker --version`
- Confirm repository path is correct: `C:\Users\yonat\OneDrive\Desktop\connsura`.
- Confirm you can reach the local Postgres instance if needed (DATABASE_URL configured).

## Build / Package Checks (Windows Local)
- Frontend build:
  - `cd connsura-frontend`
  - `npm ci` (or `npm install` if lockfile missing)
  - `npm run build`
- Backend build / production start:
  - `cd connsura-backend`
  - `npm ci` (or `npm install`)
  - Start in production mode (confirm it boots):
    - `set NODE_ENV=production`
    - `npm run start` (or the prod start script defined in package.json)

## Config / Secrets Checks
- Ensure no secrets are committed:
  - `git status --porcelain` shows no tracked secrets (no `.env` files or keys).
- Scan for staging-incompatible config:
  - Search for `localhost`, `127.0.0.1`, and dev URLs in frontend/backend configs.
  - Confirm `VITE_API_URL` is not hardcoded to localhost for production builds.
- Confirm backend CORS config allows `https://staging.connsura.com`.

## DB / Migrations Checks (Prisma)
- `cd connsura-backend`
- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate status`
- Drift detection (requires DATABASE_URL):
  - `npx prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --exit-code`

## Core User Journey Tests (Local)
Run locally against the local backend and frontend:
1) Auth
   - Sign up or sign in.
   - Confirm `/auth/me` returns 200 after login.
   - Confirm email OTP gating behavior is present where required.
2) Create profile
   - Complete Create Profile sections (Household, Address, Vehicle, Business).
   - Confirm data saves and summary cards render.
3) Share profile
   - Create a read-only share link.
   - Create an editable share link.
   - Verify link with code + recipient name when set.
   - Submit edits as recipient and confirm pending approval flow.
   - Approve and verify data persistence.

## Docker Build Tests (Staging Dockerfiles)
From repo root:
- Backend image:
  - `docker build -f deploy/Dockerfile.backend -t connsura-backend:staging .`
- Frontend image:
  - `docker build -f deploy/Dockerfile.frontend --build-arg VITE_API_URL=https://api.staging.connsura.com -t connsura-frontend:staging .`

## Staging Deployment Smoke Tests (Ubuntu)
Requires SSH access and sudo for docker commands:
- Nginx config check:
  - `sudo nginx -t`
- Container status:
  - `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml ps`
  - `sudo docker ps`
- Health checks (local to host):
  - `curl -I http://127.0.0.1:4173`
  - `curl -I http://127.0.0.1:8000`
- Public endpoints:
  - `curl -I https://staging.connsura.com`
  - `curl -I https://api.staging.connsura.com`
- Logs:
  - `sudo docker logs --tail=200 deploy-backend-1`
  - `sudo docker logs --tail=200 deploy-frontend-1`
  - `sudo docker logs --tail=200 deploy-postgres-1`

## Rollback Procedure (Staging)
- SSH to staging host.
- Identify previous known-good commit or image tag.
- Option A (Git-based rollback):
  - `cd /opt/connsura/app`
  - `git log --oneline -n 5`
  - `git checkout <known-good-commit>`
  - `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml up -d --build`
- Option B (Image-tag rollback, if images are tagged):
  - `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml down`
  - Update compose to known-good tags
  - `sudo docker compose -f /opt/connsura/app/deploy/docker-compose.yml up -d`
- Verify health and public endpoints after rollback.

## Exit Report Template
- Status: PASS / FAIL
- Failures:
  - (List failures with evidence)
- Blockers:
  - (List missing access/artifacts)
- Evidence:
  - (Key command outputs, build logs, versions)
- Next actions to reach PASS:
  - (Specific fixes, owners, and rerun steps)
