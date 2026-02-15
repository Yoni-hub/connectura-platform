# Notification Logs

## Overview
Notification Logs provide an immutable audit trail whenever Connsura generates or attempts to deliver a notification. The log is append-only (status may update from `QUEUED` to `SENT`/`FAILED` when a provider response is received).

## What Is Logged
- Channel: `EMAIL` or `IN_APP`
- Event type (examples below)
- Severity: `INFO`, `SECURITY`, `LEGAL`
- Timestamp (`createdAt`)
- Recipient metadata: user ID (if known) and recipient email
- Delivery details: provider, provider message ID, status, failure reason
- Required vs optional flag
- Preference snapshot for optional notifications (email toggles at send time)
- Minimal metadata for auditing (no sensitive profile content). Security events may include IP address and user agent.

## What Is NOT Logged
- Full email bodies or rendered HTML
- Full profile data, forms, or snapshots
- Passwords, secrets, OTP codes, tokens, or recovery data
- Sensitive PII beyond what is required for auditing

## Event Types (Current)
- `LOGIN_ALERT` - New sign-in detected
- `PASSWORD_CHANGED` - Password updated
- `EMAIL_CHANGED` - Account email changed
- `EMAIL_VERIFICATION` - Verification OTP sent
- `NAME_CHANGE_VERIFICATION` - Name change OTP sent
- `PASSWORD_CHANGE_VERIFICATION` - Password change OTP sent
- `EMAIL_VERIFIED` - Email verified confirmation
- `LEGAL_POLICY_UPDATE` - Legal document published
- `PROFILE_SHARED` - Profile share created
- `ACCESS_REVOKED` - Shared access revoked
- `PROFILE_UPDATED_BY_RECIPIENT` - Recipient submitted edits
- `PROFILE_UPDATED` - Profile updated by user (optional)
- `FEATURE_UPDATE` - Feature broadcast (optional)
- `MARKETING` - Marketing broadcast (optional)
- `ACCOUNT_DELETED` - Account deletion confirmation
- `ACCOUNT_DEACTIVATED` - Account deactivation confirmation
- `TWO_FACTOR_ENABLED` - 2FA enabled
- `TWO_FACTOR_DISABLED` - 2FA disabled
- `LOGOUT_OTHER_DEVICES` - Session revoke confirmation
- `IN_APP_NOTICE` - In-app notification shown

## Admin UI Usage
- Navigate to Admin -> Notification Logs.
- Search by free text (subject, recipient email, provider message ID, correlation ID).
- Filter by date range, channel, event type, status, required flag, user ID, and recipient email.
- Click a row to view full details, metadata, and preference snapshot.
- Export the current filtered results to CSV using the Export button.

## Export Notes
- Exports are rate limited per admin session and capped at 5000 rows per request.
- CSV includes a compact JSON string for metadata.

## Retention Recommendation
- Keep Notification Logs for 12-24 months for compliance and incident response.
- If a purge is required, delete by date range with a privileged admin task and log the purge action in audit logs.
