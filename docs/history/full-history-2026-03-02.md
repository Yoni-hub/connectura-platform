# Full History Analysis (2026-03-02)

Period: Repository inception -> HEAD

## Executive Summary
- Total commits: 189
- Active authors: 1
- Files touched: 513

## Commit Categories
- feature: 72
- other: 64
- bugfix: 24
- infra: 16
- security: 8
- docs: 3
- refactor: 2

## Top Churn Directories
- connsura-frontend: 514 file touches
- connsura-backend: 440 file touches
- connectura-backend: 132 file touches
- connectura-frontend: 131 file touches
- project_memory: 44 file touches
- automation: 34 file touches
- (root): 27 file touches
- docs: 23 file touches
- connsura-ai-system: 22 file touches
- legal: 19 file touches

## Top Churn Files
- connsura-frontend/src/pages/ClientDashboard.jsx: 52 touches
- connsura-frontend/src/pages/CreateProfile.jsx: 39 touches
- connsura-backend/src/routes/admin.js: 30 touches
- connsura-frontend/src/router/AppRouter.jsx: 29 touches
- connsura-backend/prisma/schema.prisma: 28 touches
- connsura-frontend/src/pages/Admin.jsx: 24 touches
- connsura-backend/login_signup_system/auth.js: 21 touches
- connsura-frontend/src/pages/AgentDashboard.jsx: 19 touches
- connsura-backend/src/routes/customers.js: 17 touches
- automation/ssh/deploy.sh: 15 touches

## Risk-Relevant Commits
- 2026-02-28 64e6ed09a6 chore(scripts): add staging form sync helper
- 2026-02-24 d4674a1f4e fix(mobile): prevent input auto-zoom and add SQL helper
- 2026-02-23 761c457375 security(auth): add strict request rate limits for login and recovery endpoints
- 2026-02-23 ebebb3e5f2 chore(staging): redirect api subdomain traffic to /api path
- 2026-02-22 af28d094fb Add staging EC2 auto-recovery and reboot alarm runbook
- 2026-02-22 5bccb7849f Route staging /api paths to backend in nginx
- 2026-02-22 d7dd3f070e Fix admin client layout, auth flows, and password policy
- 2026-02-21 b04ec00a8d feat(auth-ui): add inline password requirement indicators
- 2026-02-21 4f7504db39 security(auth): harden login/password flows and remove admin hash exposure
- 2026-02-20 d3b6a691c4 feat(auth): add OTP account recovery and simplify signup consent
- 2026-02-20 083abfcb13 chore(deploy): use same-origin /api for staging frontend
- 2026-02-18 4e242d8018 Use prisma migrate deploy in backend deploy entrypoint
- 2026-02-16 619b4fe48b Remove legacy Agent/Message tables and align global staging rules
- 2026-02-16 148f93cec9 Add form section load and admin OTP lookup
- 2026-02-15 2debb27bfc chore(deploy): drop compose version field

## Recent Commits (Newest First)
- 2026-03-01 70e986ecb7 feat(admin-forms): show active API URL in forms content manager
- 2026-02-28 64e6ed09a6 chore(scripts): add staging form sync helper
- 2026-02-27 fc22650705 feat(home): add pricing and trust sections from landing
- 2026-02-24 91d21355f9 feat(admin-forms): add section rename editor and fix hook deps
- 2026-02-24 d4674a1f4e fix(mobile): prevent input auto-zoom and add SQL helper
- 2026-02-23 761c457375 security(auth): add strict request rate limits for login and recovery endpoints
- 2026-02-23 f7b16115fd fix(passport): clamp helper tooltip within mobile viewport
- 2026-02-23 ebebb3e5f2 chore(staging): redirect api subdomain traffic to /api path
- 2026-02-23 8613523181 feat(forms): add section reorder controls and improve helper tooltip
- 2026-02-23 d6d5786a02 feat(forms): add per-question helper tooltip text
- 2026-02-23 532e0876b4 feat(forms): add product-scoped question overrides for shared mappings
- 2026-02-23 25368d178c fix(legal): use ascii separator in legal header metadata
- 2026-02-22 af28d094fb Add staging EC2 auto-recovery and reboot alarm runbook
- 2026-02-22 5bccb7849f Route staging /api paths to backend in nginx
- 2026-02-22 33ae9982c1 Fix email normalization in client/admin login and signup
- 2026-02-22 d7dd3f070e Fix admin client layout, auth flows, and password policy
- 2026-02-22 9ab996d992 admin(clients): render passport summary in user-facing section format
- 2026-02-22 b903f0cd61 admin(clients): remove legacy fields from client modal and show passport summary
- 2026-02-21 b04ec00a8d feat(auth-ui): add inline password requirement indicators
- 2026-02-21 4f7504db39 security(auth): harden login/password flows and remove admin hash exposure

## Next Actions
- Verify top churn files have matching tests for recent bugfix/security changes.
- Check docs alignment when infra/auth/database related commits appear.
- Use this report as input for sprint or release risk review.
