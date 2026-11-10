# Phase 0: admin and debug endpoint lockdown

Branch `feature/points-v2`. Tests: `fitapp-backend/test/security.test.js` (`npm test` in the backend container).

## What changed

**New config.** `fitapp-backend/config/auth.js` is the one place that reads `JWT_SECRET` and the new `ADMIN_GOOGLE_IDS` (comma-separated Google IDs). If `ADMIN_GOOGLE_IDS` is unset, nobody is an app admin and every admin route returns 403. The bot's `x-bot-secret` identity is never an admin.

**Admin and debug endpoints now require a JWT and an app admin** (`authenticateJWT, requireAdmin`):

| Endpoint | Before | Writes steps/weight/points? |
|---|---|---|
| `POST /api/debug-log` | open; appended to a file on disk | no |
| `GET /api/test-env` | open | no |
| `GET /api/test-google-fit/:googleId` | open; used any user's Google token | no |
| `GET /api/debug/user/:googleId` | open | no |
| `POST /api/admin/add-yesterday-step-point` | open | **points** |
| `GET /api/admin/check-user-status/:email` | open | no |
| `GET /api/admin/debug-stuck-user` | open | no |
| `POST /api/admin/fix-stuck-user` | open | **steps, points** |
| `POST /api/admin/add-today-step-point` | open | **points** |
| `POST /api/admin/fix-session-contamination` | open | **steps, points** |
| `POST /api/admin/force-remove-from-test-leaderboard` | open | participants |
| `DELETE /api/admin/delete-all-challenges` | open; deleted every challenge | everything |
| `POST /api/admin/fix-weight-date` | open | **weight** |
| `POST /api/admin/add-historical-weight` | open | **weight, points** |
| `POST /api/admin/update-starting-weight` | open | **weight, points** |

**Holes outside the admin list, fixed because they undermined the JWT itself:**

- `POST /api/auth/token` signed a JWT for any `googleId` in the body, so anyone could become anyone. It now only swaps a JWT we signed (expired is fine, but issued within the last 30 days) for a fresh one for the same user. Sign-in still goes through the Google OAuth callback. The frontend sends the old token, and signs the user out if renewal is refused.
- `GET /api/auth/refresh-google-fit-token/:googleId` returned any user's Google access token to anyone. It now needs that user's own JWT.
- `POST /api/save-user` (no auth) accepted any user's steps, weight and OAuth tokens. It now needs the user's own JWT.
- `POST /api/user/userdata` had a JWT but no ownership check. It now accepts only the caller's own `googleId` (or the bot).
- Startup warns when `JWT_SECRET` is unset or a known placeholder, and refuses to start when `NODE_ENV=production`.

**Testability.** `index.js` only connects to MongoDB, schedules cron jobs and listens when run directly, and exports `app`, so tests can load it.

## Action needed from you

1. **Production `JWT_SECRET`.** `production/docker-compose.yml` does not pass `JWT_SECRET` and `production/.env.example` did not list it, so production very likely signs tokens with the hard-coded `your_jwt_secret`, which means anyone can forge a token. Check Portainer's `stack.env`. Setting a new secret signs everyone out once. Once this branch reaches production it will refuse to start without one.
2. **`ADMIN_GOOGLE_IDS`.** Add your Google ID to `development/.env` and production's `stack.env` if you want to use the admin endpoints.
3. Dev now has a random `JWT_SECRET` in `development/.env`, so dev users sign in again once.

## Still open (flagged, not changed)

These accept unauthenticated requests or trust an ID from the URL/body. Fixing them means moving every route in `routes/challenge.js` and `routes/leaderboard.js` to `req.user.googleId`, with matching frontend changes, so it is a separate piece of work.

| Endpoint | Risk |
|---|---|
| `POST /api/update-participant/:challengeId/:googleId` | no auth; recomputes and saves a participant's points |
| `GET /api/sync-google-fit/:googleId` | no auth; triggers a sync and history write with that user's tokens |
| `PUT /api/challenge/:challengeId` (index.js) | no auth; admin check uses `userGoogleId` from the body |
| `routes/challenge.js` (mounted without auth) | create/update/delete challenges, photos, join; `PUT /:challengeId/participant/:userId/weight` **writes weight** for any user; admin checks trust `userGoogleId` from the body |
| `routes/leaderboard.js` (mounted without auth) | add/remove participants for any user |
| `GET /api/user/userdata?googleId=` | JWT required, but any user can trigger a sync of, and read, another user's data |
