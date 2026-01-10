# Connsura E2E (Playwright)

These tests automate the core customer journey (signup, profile creation, share flows).

## Prereqs
- Node.js + npm
- Local backend + frontend running, or enable `E2E_START_SERVERS=true`
- Admin credentials available in `connsura-backend/.env` or via env vars

## Install
```powershell
cd e2e
npm install
npx playwright install
```

## Run
```powershell
npm test
```

Run headed:
```powershell
npm run test:headed
```

## Environment variables
- `E2E_BASE_URL` (default `http://localhost:5173`)
- `E2E_API_URL` (default `http://localhost:8000`)
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
  - If not set, tests fall back to `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `connsura-backend/.env`.
- `E2E_START_SERVERS=true` to auto-start frontend/backend.

## Notes
- Tests create a new customer account each run (`e2e+<timestamp>@example.com`).
- Email verification uses the admin OTP endpoint.
