# Connsura Admin API (backend)

Admin seed (dev):
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before starting the API.
- If unset, the API skips seeding a default admin user.

Auth
- POST `/admin/login` { email, password } â†’ { token, admin }
- Use `Authorization: Bearer <token>` for all admin endpoints.

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
- Admin tooling supports client account administration only.

