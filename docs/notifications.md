# Notifications

This document summarizes Connsura notification preferences, required vs optional delivery, email routing rules, and event triggers.

## Preferences
Notification preferences are stored per user in `NotificationPreferences`.

Optional email toggles (defaults):
- `email_profile_updates_enabled`: true
- `email_feature_updates_enabled`: true
- `email_marketing_enabled`: false

Required items are always sent and are not toggleable.

## API
Authenticated endpoints:
- `GET /api/notifications/preferences`
  - Returns current optional preferences + required items.
- `PATCH /api/notifications/preferences`
  - Accepts optional toggles only (booleans).

Legacy endpoint compatibility:
- `GET /customers/:id/notification-preferences`
- `PUT /customers/:id/notification-preferences`
These map legacy `email` levels to the new boolean fields.

## Email routing rules
System emails are sent from `noreply@connsura.com` with a friendly display name:
- `Connsura (contact@connsura.com)`

Reply-To routing by category:
- Security: `security@connsura.com`
- Legal/policy: `legal@connsura.com`
- Privacy/data sharing: `privacy@connsura.com`
- Product/feature updates: `support@connsura.com`
- Marketing: `info@connsura.com`

## SES configuration
Required environment variables:
- `AWS_REGION` or `SES_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Optional:
- `SES_DRY_RUN=true` to log payloads instead of sending
- `NOTIFICATION_FROM` to override the default From display

## Event triggers
Required emails:
- Login alerts: when a new device token is seen or IP prefix changes (new sign-in detected wording).
- Password or email changes: when password or email changes.
- Legal & policy updates: when legal documents are published via admin endpoints.
- Profile sharing activity: share created, access revoked, recipient submits edits.

Optional emails (respect user toggles):
- Insurance profile updates: sent on profile updates and profile completion.
- Feature updates & improvements: admin broadcast.
- Marketing: admin broadcast with unsubscribe footer.

## Broadcasts
Admin endpoint for broadcast:
- `POST /admin/notifications/broadcast`
  - Body: `{ "type": "feature" | "marketing", "title": "...", "summary": "..." }`

## In-app notifications
In-app "Dashboard reminders & activity badges" are always enabled. UI displays these as required in Settings -> Notifications.

## GeoIP
Login alerts, login activity, and active sessions include city-level location using the GeoLite2 City database. See `docs/geoip.md` for setup.
