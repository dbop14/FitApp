# Migrating sync to the Google Health API

Status as of 2026-11-09: the legacy Fitbit Web API and Fitbit OAuth return **410 Gone** (decommissioned October 30, 2026). Google Fit's APIs run until the end of 2026. Both paths move to the Google Health API (`https://health.googleapis.com/v4`), which uses Google OAuth 2.0. See [CONNECTION_TEST_REPORT.md](CONNECTION_TEST_REPORT.md) for evidence.

Key constraints from Google's [migration guide](https://developers.google.com/health/migration):

- Existing Fitbit access and refresh tokens **cannot be transferred**. Every Fitbit user must consent again.
- A user must never have a legacy Fitbit connection and a Google Health connection active at the same time.
- **Legacy Fitbit accounts** (a Fitbit login not yet moved to a Google account) cannot use the Google Health API. Those users must migrate their Fitbit account to a Google account first. If consent returns `ACCOUNT_NOT_LINKED`, keep their old connection state and tell them to migrate.
- After re-consent, history can be backfilled from the Google Health API as long as the device kept syncing to the Google Health app.

## Bridge design

### `oauthType` per user

Add to `User` (additive; existing documents read as today):

```js
oauthType: { type: String, enum: ['fitbit', 'google'], default: undefined },
googleHealthAccessToken: String,
googleHealthRefreshToken: String,
googleHealthTokenExpiry: Number,
googleHealthConnectedAt: Date,
```

- `oauthType` unset or `fitbit` → legacy path (Fitbit or Google Fit, as `dataSource` says today).
- `oauthType: 'google'` → Google Health path, regardless of the device brand.
- Set to `google` only after a successful Google Health consent **and** a successful test read. Then revoke the legacy tokens and clear them.

Google Health tokens are stored separately from the sign-in tokens (`accessToken`/`refreshToken`). Sign-in keeps its own minimal scopes, so a user can sign in without granting health access, and revoking one does not break the other.

### Health-service abstraction

`fitapp-backend/services/health/` (built in Phase 3):

```
HealthSource interface
  getDailySteps(user, startDate, endDate)  -> [{ date, steps | null, provisional }]
  getWeights(user, startDate, endDate)     -> [{ date, weightLbs }]
  getWorkouts(user, startDate, endDate)    -> [{ start, end, type, moderateMinutes, vigorousMinutes, effortPoints, isStrength }]

getHealthSource(user) -> picks the adapter from oauthType / dataSource
  google-fit    (legacy, Classic only, until Google Fit shuts down)
  fitbit        (legacy, now 410: returns "reconnect needed")
  google-health (behind GOOGLE_HEALTH_ENABLED)
  whoop
```

Sync jobs, the 23:55 pull, the morning backfill and `/api/user/userdata` call `getHealthSource(user)` and never import a provider directly.

### In-app re-consent prompt

- Backend: `GET /api/user/datasource` returns `needsReconnect: true` when the user's source is `fitbit` (410) or the stored Google Health refresh fails with `invalid_grant`.
- Frontend: a dismissible banner on Dashboard and a "Reconnect" button in Data Source Settings that starts `GET /api/auth/google-health` (JWT required; the state parameter carries a signed nonce for the user).
- After a successful connect, the banner disappears and Settings shows "Connected via Google Health".

### Backfill after re-consent

On the callback, after the test read succeeds, queue a backfill of the last 30 days, or since the start of the user's earliest active challenge if longer, into `FitnessHistory` with `source: 'google-health'`, using the same "never overwrite a manual weigh-in" rule as `smartUpsertFitnessHistory`. Then run the hourly recount for that user's challenges.

### Revoking legacy tokens

After cutover, revoke the old token where the provider still accepts revocation (Fitbit's endpoint is gone, so just clear the fields), then `$unset` `fitbitAccessToken`, `fitbitRefreshToken`, `fitbitTokenExpiry`. Keep `fitbitUserId` for audit. Never log token values.

## Files to change

| File | Change |
|---|---|
| `fitapp-backend/models/User.js` | `oauthType`, Google Health token fields; `dataSource` enum gains `google-health`, `whoop` |
| `fitapp-backend/models/FitnessHistory.js` | `source` enum gains `google-health`, `whoop` |
| `fitapp-backend/routes/auth.js` | new `/api/auth/google-health` + callback; Fitbit connect returns a "use Google Health" message |
| `fitapp-backend/utils/googleHealthAuth.js` (new) | token exchange and refresh |
| `fitapp-backend/services/health/*` (new) | interface, `google-fit`, `fitbit`, `google-health`, `whoop` adapters |
| `fitapp-backend/services/fitbitService.js`, `utils/fitbitAuth.js` | wrapped by the `fitbit` adapter; detect 410 and flag reconnect |
| `fitapp-backend/scripts/backfillStepHistoryAndPoints.js` | call `getHealthSource(user)` |
| `fitapp-backend/routes/user.js`, `index.js` sync paths | call `getHealthSource(user)` |
| `fitapp-frontend/src/pages/DataSourceSettings.jsx`, `Settings.jsx`, `OAuthCallback.jsx` | Google Health and Whoop options, reconnect state |
| `fitapp-frontend/src/pages/Dashboard.jsx` | reconnect banner |
| `fitapp-frontend/src/context/UserContext.jsx`, `src/hooks/useGoogleFit.js` | stop calling Google Fit from the browser for Google Health users |
| `fitapp-frontend/src/pages/PrivacyPolicy.jsx` | list the new scopes and Whoop |

## Configuration

New environment variables (names only):

| Name | Purpose |
|---|---|
| `GOOGLE_HEALTH_ENABLED` | `true` turns on the adapter and the connect button |
| `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET` | OAuth client for health access (may be the same Web client as sign-in) |
| `GOOGLE_HEALTH_REDIRECT_URI` | callback URL below |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REDIRECT_URI` | Whoop OAuth |

Redirect URIs to register in the Google Cloud console (Web application client):

| Stack | URI |
|---|---|
| Dev | `https://fitappdevbackend.herringm.com/api/auth/google-health/callback` |
| Production | `https://fitappbackend.herringm.com/api/auth/google-health/callback` |

And for Whoop: `https://fitappdevbackend.herringm.com/api/auth/whoop/callback` and `https://fitappbackend.herringm.com/api/auth/whoop/callback`.

Scopes to request (and to add on the consent screen):

- `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly` (steps, exercise, active zone minutes)
- `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly` (weight, heart rate)

No sleep scopes. All Google Health scopes are classed as Restricted, so check the user cap for unverified apps and the publishing status (apps left in Testing get refresh tokens that expire after 7 days).

Note: the backend CORS list and OAuth host checks still name `fitappbackenddev.herringm.com`; the live dev tunnel is `fitappdevbackend.herringm.com`. Fix that alongside these changes.
