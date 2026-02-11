# Messaging (WhatsApp-style)

This doc covers the new 1:1 messaging system between a single Client and a single Agent.

## Requirements Recap
- One-to-one only (Client ↔ Agent)
- Text-only messages
- Realtime updates via Socket.IO
- Postgres storage via Prisma
- Strict authorization
- Relationship gating (must have an active profile share)

## Backend Setup
### Environment Variables
- `DATABASE_URL` (Postgres)
- `JWT_SECRET`
- `FRONTEND_URL` (for CORS + Socket.IO)
- `SESSION_COOKIE_NAME` (optional, default `connsura_session`)

### Migrations
Run this on staging/production:
```bash
cd connsura-backend
npx prisma migrate deploy
npx prisma generate
```

### Run
```bash
cd connsura-backend
npm install
npm run start
```

### REST Endpoints
Base path: `/api/messages`
- `GET /api/messages/conversations`
- `POST /api/messages/conversations`
- `GET /api/messages/conversations/:id/messages?cursor=<createdAt>&limit=30`
- `POST /api/messages/conversations/:id/messages`
- `POST /api/messages/conversations/:id/read`

Pagination order: **newest → oldest** (descending). The frontend reverses for display.

### Socket.IO
Socket.IO runs on the same backend origin/port. Make sure the reverse proxy passes WebSocket headers.

## Frontend Setup
### Environment Variables
- `VITE_API_URL` (should match backend base URL, e.g. `https://api.staging.connsura.com`)

### Run
```bash
cd connsura-frontend
npm install
npm run dev
```

## Relationship Gating
Messaging is allowed only when a ProfileShare exists with:
- `customerId = clientId`
- `agentId = agentId`
- `status = "active"`

## QA Checklist
- Desktop: two-pane layout (list + thread) with sticky header/composer.
- Mobile: list-only view and thread-only view at `/messages/:conversationId`.
- Search filters conversation list locally.
- Unread badges increment when new message arrives in other conversation.
- Opening a conversation marks it read and clears unread badge.
- Auto-scroll only when user is near bottom; otherwise "Jump to latest" appears.
- Enter sends message; Shift+Enter inserts newline.
- Relationship gating enforced (no conversation unless share exists).
- Mobile overflow regression: at 375px wide, send a long URL with no spaces, a 200+ character unbroken string, and a multiline message; verify no horizontal scroll and bubbles still align left/right.

## Tests
Backend tests use Node's built-in test runner.

```bash
cd connsura-backend
npm test
```

Notes:
- Requires `DATABASE_URL` and `JWT_SECRET`.
- Tests create and clean up their own data.
