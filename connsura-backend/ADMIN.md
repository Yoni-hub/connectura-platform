# Connsura Admin API (backend)

Admin seed (dev):
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before starting the API.
- If unset, the API skips seeding a default admin user.

Auth
- POST `/admin/login` { email, password } â†’ { token, admin }
- Use `Authorization: Bearer <token>` for all admin endpoints.

Agent controls
- GET `/admin/agents` â†’ list agents (status, suspension, review flags included)
- GET `/admin/agents/:id` â†’ agent detail
- POST `/admin/agents/:id/approve` â†’ status=approved, unsuspend, clear review
- POST `/admin/agents/:id/reject` â†’ status=rejected
- POST `/admin/agents/:id/review` â†’ mark under review (status=pending)
- POST `/admin/agents/:id/suspend` â†’ suspend agent (status=suspended)
- POST `/admin/agents/:id/restore` â†’ clear suspension, status=approved
- PUT `/admin/agents/:id` â†’ update profile fields (bio, phone, address, products, languages, states, status, flags)
- DELETE `/admin/agents/:id` â†’ delete agent (removes linked user)

Client controls
- GET `/admin/clients` â†’ list clients
- GET `/admin/clients/:id` â†’ client detail
- PUT `/admin/clients/:id` â†’ update profile fields / disable flag
- POST `/admin/clients/:id/disable` â†’ disable client account
- POST `/admin/clients/:id/enable` â†’ re-enable client account
- DELETE `/admin/clients/:id` â†’ delete client (removes linked user)

Audit
- GET `/admin/audit` â†’ latest audit logs (who, what, when, diff)

Notes
- New agents are created with `status=pending`, `underReview=true`; admin approval sets `approved`.
- Agents marked pending/suspended are redirected to onboarding on login.

