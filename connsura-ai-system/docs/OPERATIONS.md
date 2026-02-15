1. Authority

This document defines production and staging operations for Connsura.
It is authoritative for hosting, database strategy, retention, logging, monitoring, real-time messaging, and staging seeding.
PostgreSQL is the only supported database for local, staging, and production. SQLite is not used.

2. Production Environment / Hosting Plan
2.1 Decision Summary

- Production runs on a single Ubuntu host behind Nginx with TLS.
- Services are Docker Compose-based (frontend, backend, postgres, monitoring).
- Access is via SSH over a locked-down firewall; VPN is optional but SSH allowlist is required.
- Domains: connsura.com and api.connsura.com.

2.2 Rationale

- Matches current staging model to minimize drift.
- Docker Compose keeps deployments repeatable and portable to VPS providers.
- Nginx handles TLS, routing, and static content efficiently.

2.3 Security Constraints (Non-Negotiable)

- HTTPS only for public endpoints; HTTP allowed only internally.
- SSH access restricted to a fixed IP allowlist.
- Secrets never committed to git; only environment files on server.
- No database ports exposed publicly.

2.4 Implementation Plan

- Host OS: Ubuntu 22.04 LTS (self-host or VPS).
- Nginx reverse proxy:
  - connsura.com -> frontend container (Vite preview or static build)
  - api.connsura.com -> backend container (Express)
- TLS via Let's Encrypt (certbot or acme.sh).
- Firewall:
  - allow 22/tcp (SSH) from allowlisted IPs
  - allow 80/443 (HTTP/HTTPS) from all
  - deny all other inbound
- Secrets:
  - /opt/connsura/env/backend.env
  - /opt/connsura/env/frontend.env
  - /opt/connsura/env/postgres.env
- Docker volumes:
  - /opt/connsura/postgres (Postgres data)
  - /opt/connsura/uploads (uploads)
  - /opt/connsura/forms (forms)

2.5 Upgrade Path (Self-Host -> VPS)

- Keep Docker Compose, env files, and volumes identical.
- Move /opt/connsura directory to new host.
- Repoint DNS to new host IP.
- Re-issue TLS certificates.

2.6 Prod Readiness Checklist

- DNS: connsura.com and api.connsura.com point to prod IP.
- TLS: valid certs installed and auto-renew enabled.
- Secrets: env files exist and are not in git.
- Backups: daily DB backups and uploads backup configured.
- Monitoring: uptime and resource alerts configured.
- Logging: JSON logs with request_id and rotation enabled.
- Incident response: on-call contact and rollback plan documented.

2.7 Done / Acceptance Checks

- `curl -I https://connsura.com` returns 200/301 with valid cert.
- `curl -I https://api.connsura.com/health` returns 200.
- `ssh user@prod-host` works only from allowlisted IPs.
- `docker compose ps` shows all services healthy.

3. Production DB Strategy + Migration Plan
3.1 Decision Summary

- PostgreSQL is used for dev, staging, and production.
- Prisma is the only migration mechanism.
- Migrations are rehearsed in staging before production.

3.2 Rationale

- Single database engine reduces operational risk.
- Prisma migrations provide deterministic schema changes.

3.3 Security Constraints (Non-Negotiable)

- No manual schema edits in production.
- No first-run migrations in production.
- Always take a backup before destructive migrations.
- DATABASE_URL and credentials are only in server env files.

3.4 Implementation Plan

- Dev workflow:
  - `npx prisma migrate dev`
  - `npx prisma generate`
- Staging rehearsal:
  - Deploy app
  - `npx prisma migrate deploy`
  - Validate queries and smoke tests
- Production rollout:
  - Take backup
  - `npx prisma migrate deploy`
  - Verify health and critical flows
- Recommended Postgres basics:
  - `max_connections=100` (adjust per host size)
  - `shared_buffers=256MB` (adjust per host size)
  - Use connection pooling if concurrency grows (PgBouncer).

3.5 Migration Safety Rules

- No manual DDL in production.
- No `prisma migrate dev` against production.
- All destructive changes require a backup first.
- Prefer additive migrations over destructive ones.

3.6 Rollback Plan

- Restore the last known good backup.
- Re-deploy the prior application release.
- Forward-fix with a new migration (no down migrations).

3.7 Done / Acceptance Checks

- `npx prisma migrate status` shows no pending migrations.
- Backup exists for the current production timestamp.
- Smoke tests pass after deploy.

4. Data Retention + Backups
4.1 Decision Summary

- Retention is role- and data-type specific.
- Backups are daily, encrypted, and stored locally plus offsite.
- Deletions respect user requests while preserving audit logs.

4.2 Rationale

- Reduces risk of data loss and uncontrolled growth.
- Meets basic operational and compliance expectations.

4.3 Security Constraints (Non-Negotiable)

- Backups are encrypted at rest.
- No secrets are stored inside backups beyond required DB data.
- Offsite storage is access-controlled.

4.4 Retention Policy

- Accounts (User/Customer): retain until deletion request; 30-day recovery window.
- Profile shares: retain 90 days after status becomes closed/revoked.
- Messages: retain 24 months.
- Audit logs: retain 24 months minimum.
- Uploads: retain while account active; purge 30 days after account deletion.
- Forms: retain while account active; purge 30 days after account deletion.

4.5 Backup Strategy

- Database:
  - Nightly `pg_dump` (full)
  - Encrypt with GPG using BACKUP_GPG_KEY_ID
  - Store locally in /opt/connsura/backups/db
  - Sync offsite (rsync to NAS or low-cost object storage)
- Uploads/forms:
  - Daily tar + GPG
  - Store in /opt/connsura/backups/files
- Restore testing:
  - Monthly restore to a local/staging instance.

4.6 Minimal Implementation (Scripts + Timers)

- Scripts live in `automation/ops/`:
  - `backup_postgres.sh`
  - `backup_uploads.sh`
  - `retention_prune.sh`
  - `restore_postgres.sh`
- Systemd timers on Ubuntu:
  - `connsura-backup.service` (calls backup scripts)
  - `connsura-backup.timer` (daily at 02:00)
  - `connsura-retention.service` (calls retention script)
  - `connsura-retention.timer` (weekly Sunday 03:00)

4.7 Done / Acceptance Checks

- Latest encrypted backup exists in /opt/connsura/backups/db.
- Offsite sync completes without errors.
- Monthly restore test logs success.

5. Logging + Monitoring
5.1 Decision Summary

- Backend logs structured JSON with request_id correlation.
- Logs are rotated on the host.
- Monitoring uses a low-cost self-host stack.

5.2 Rationale

- JSON logs are easy to parse and search.
- Lightweight self-hosted monitoring avoids costly services.

5.3 Security Constraints (Non-Negotiable)

- Never log secrets, OTPs, or passwords.
- Mask IP addresses and PII where possible.
- Logs are not publicly accessible.

5.4 Logging Implementation Plan

- Backend:
  - Use a JSON logger (pino or equivalent).
  - Generate `request_id` if `X-Request-Id` is missing.
  - Log schema: timestamp, level, request_id, route, status, latency.
- Nginx:
  - Access logs enabled, rotated weekly.
- Log rotation:
  - Use logrotate or Docker log limits.

5.5 Monitoring Implementation Plan

- Uptime: Uptime Kuma for HTTP checks (connsura.com, api.connsura.com).
- Metrics: Prometheus + node-exporter.
- Dashboards: Grafana (optional but recommended).
- Storage: /opt/connsura/monitoring.

5.6 Alert Thresholds

- Uptime: 2 consecutive failures (2 min) -> alert.
- CPU: >85% for 10 minutes -> alert.
- Memory: >85% for 10 minutes -> alert.
- Disk: >80% used -> alert.
- API 5xx rate: >2% over 5 minutes -> alert.

5.7 Done / Acceptance Checks

- Uptime Kuma shows green for all endpoints.
- Prometheus scrapes node-exporter.
- Grafana dashboards show CPU/memory/disk.
- Log rotation keeps log files under size limits.

6. Real-Time Messaging + Notifications
6.1 Decision Summary

- Use Socket.IO for real-time chat with polling fallback.
- Delivery is at-least-once with server acknowledgements.
- Unread counts are computed server-side and stored in DB.

6.2 Rationale

- Socket.IO fits the Node stack and supports fallback transports.
- Server-authoritative counts avoid client drift.

6.3 Security Constraints (Non-Negotiable)

- Socket connections require JWT auth.
- Rate limiting on message send and connection attempts.
- Validate message payloads server-side.

6.4 Implementation Plan

- Transport:
  - Socket.IO on the backend.
  - Fallback: polling `/messages` endpoint every 30s.
- Auth:
  - JWT token passed during socket handshake.
  - Reject unauthenticated sockets.
- Delivery:
  - Client sends message; server writes to DB then emits to recipient.
  - Server sends ack; client retries on timeout.
- Unread counts:
  - Add a `MessageReadState` table keyed by senderId/recipientId.
  - Store `lastReadAt` and `unreadCount`.
  - On new message, increment unreadCount for the recipient.
  - On conversation open, set lastReadAt and reset unreadCount.
- Notifications:
  - In-app badges for unread counts.
  - Email notifications for critical events (password reset, share approval).
  - Push notifications are future scope.

6.5 Done / Acceptance Checks

- Socket connection rejects unauthenticated clients.
- New messages appear in real-time for both roles.
- Unread counts match server state after refresh.
- Polling fallback works when sockets fail.

7. Staging Data Seeding
7.1 Decision Summary

- Staging data is synthetic only.
- Prisma seeding generates realistic edge cases.
- One-command reset is required.

7.2 Rationale

- Avoids production data leakage.
- Improves QA coverage for edge cases.

7.3 Security Constraints (Non-Negotiable)

- No production data in staging.
- Seed data must not include real emails or phone numbers.

7.4 Implementation Plan

- Seed generator:
  - Users (customers/admins), messages, audit logs, profile shares.
  - Edge cases: long names, missing fields, multi-language arrays.
- Use Prisma seed:
  - Seed script in `connsura-backend/prisma/seed.js`.
- One-command reset (run on staging host):
  - `docker compose exec backend sh -c "npx prisma migrate reset --force && npx prisma db seed"`

7.5 Done / Acceptance Checks

- Staging DB contains synthetic customers/admins/messages.
- App UI loads without null-data errors.
- Reset command completes without prompts.
