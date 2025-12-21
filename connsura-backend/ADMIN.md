# Connsura Admin API (backend)

Admin seed (dev):
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before starting the API.
- If unset, the API skips seeding a default admin user.

Auth
- POST `/admin/login` { email, password } → { token, admin }
- Use `Authorization: Bearer <token>` for all admin endpoints.

Agent controls
- GET `/admin/agents` → list agents (status, suspension, review flags included)
- GET `/admin/agents/:id` → agent detail
- POST `/admin/agents/:id/approve` → status=approved, unsuspend, clear review
- POST `/admin/agents/:id/reject` → status=rejected
- POST `/admin/agents/:id/review` → mark under review (status=pending)
- POST `/admin/agents/:id/suspend` → suspend agent (status=suspended)
- POST `/admin/agents/:id/restore` → clear suspension, status=approved
- PUT `/admin/agents/:id` → update profile fields (bio, phone, address, products, languages, states, status, flags)
- DELETE `/admin/agents/:id` → delete agent (removes linked user)

Client controls
- GET `/admin/clients` → list clients
- GET `/admin/clients/:id` → client detail
- PUT `/admin/clients/:id` → update profile fields / sharing / disable flag
- POST `/admin/clients/:id/disable` → disable client account
- POST `/admin/clients/:id/enable` → re-enable client account
- POST `/admin/clients/:id/unshare` → revoke agent sharing and preferred agent
- DELETE `/admin/clients/:id` → delete client (removes linked user)

Audit
- GET `/admin/audit` → latest audit logs (who, what, when, diff)

Notes
- New agents are created with `status=pending`, `underReview=true`; admin approval sets `approved`.
- Agents marked pending/suspended are redirected to onboarding on login.
