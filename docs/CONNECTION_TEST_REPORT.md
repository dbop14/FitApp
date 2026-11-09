# Connection test report: Fitbit and Google Fit

Run on 2026-11-09 against the dev stack (`fitapp-dev-backend`), read-only. No sync code was changed.

## Verdicts

| Source | Auth | Steps | Weight | Evidence | Verdict |
|---|---|---|---|---|---|
| `fitbit` | **410 Gone** | not reachable (needs a token) | not reachable (needs a token) | `POST https://api.fitbit.com/oauth2/token` with the dev app's real client ID/secret returned `410` and: *"The legacy Fitbit Web API and OAuth 2.0 endpoints were decommissioned on October 30, 2026. Please migrate your integration to the Google Health APIs"*. No user can get or refresh a Fitbit token, so no step or weight call can succeed. | **Broken** |
| `google-fit` | OAuth client valid | Unknown | Unknown | `POST https://oauth2.googleapis.com/token` with the dev client and a fake refresh token returned `400 invalid_grant` (client accepted, token rejected), so Google sign-in still works. Data calls to `www.googleapis.com/fitness/v1` answered `401` without a token, which only proves the host is up. A real step/weight call needs a connected user (below). | **Unknown** |

### Why some results are Unknown

- **The dev database has no users** (`users` and `fitnesshistories` are empty), so there was no stored token to refresh and no account to request today's steps or weight for.
- **To finish the Google Fit test:** sign in once on dev at https://fitappdev.herringm.com with a Google account that has Google Fit data, then ask me to re-run the test. I will request one day of steps and one weight reading through the existing code path and record the status and response shape.
- **Fitbit needs no further test.** The OAuth endpoint itself is gone.
- Google says the Google Fit APIs are available "until the end of 2026" with no exact date published, so even if the Google Fit test passes, that path has weeks left.

## Backend log summary

- **Dev:** no sync errors to count. The dev DB has no users, so nothing syncs, and the container was recreated during Phase 0 (new `JWT_SECRET`), which reset its log.
- **Production:** not read. Reading production containers is blocked in this session. To get counts by status and source, run this on the NAS and share the output, or allow me to read production logs:

```bash
docker logs --since 168h fitapp-backend 2>&1 | grep -oE "(Fitbit|Google Fit|fitbit|google-fit)[^0-9]{0,60}(4[0-9]{2}|5[0-9]{2})" | sed -E 's/[^0-9]*([0-9]{3})$/ \1/' | sort | uniq -c
```

## Code that talks to Fitbit or Google Fit

| Area | Files |
|---|---|
| OAuth flows | `fitapp-backend/routes/auth.js` (`/api/auth/google`, `/api/auth/google/callback`, `/api/auth/fitbit`, `/api/auth/fitbit/callback`) |
| Token storage (User model) | `fitapp-backend/models/User.js`: `accessToken`, `refreshToken`, `tokenExpiry` (Google); `fitbitAccessToken`, `fitbitRefreshToken`, `fitbitTokenExpiry`, `fitbitUserId`; `dataSource` (`google-fit` \| `fitbit`) |
| Refresh logic | `fitapp-backend/utils/googleAuth.js` (`ensureValidGoogleTokens`), `fitapp-backend/utils/fitbitAuth.js` (`ensureValidFitbitTokens`), `GET /api/auth/refresh-google-fit-token/:googleId` in `index.js` |
| Sync functions | `fitapp-backend/services/fitbitService.js` (`fetchFitbitSteps`, `fetchFitbitWeight`, `fetchFitbitData`, `syncFitbitHistory`); `fitapp-backend/routes/user.js` (`GET/POST /api/user/userdata`); `index.js` (`GET /api/sync-google-fit/:googleId`, `/api/test-google-fit/:googleId`) |
| 23:55 pull | `index.js` cron `55 23 * * *` → `fitapp-backend/scripts/backfillStepHistoryAndPoints.js` (`syncGoogleFitHistoryForUser`, `syncFitbitHistoryForUser`) |
| Bot daily sync | `fitapp-bot/index.js` `syncAllUsersData` → `GET /api/user/userdata` |
| FitnessHistory writes | `index.js` (5 sites), `routes/user.js` (4), `routes/challenge.js` (1, manual weight), `services/fitbitService.js` (1), `scripts/backfillStepHistoryAndPoints.js` (`smartUpsertFitnessHistory`), `scripts/fix-weight-date.js` |
| Frontend (calls Google Fit directly from the browser) | `fitapp-frontend/src/context/UserContext.jsx`, `src/hooks/useGoogleFit.js`; data-source UI in `src/pages/DataSourceSettings.jsx`, `Settings.jsx`, `AccountPage.jsx`, `OAuthCallback.jsx`; also `Dashboard.jsx`, `StepsHistory.jsx`, `WeightInputModal.jsx`, `utils/apiService.js`, `PrivacyPolicy.jsx` |

### External hostnames called

| Host | Used for |
|---|---|
| `www.googleapis.com/fitness/v1/users/me/dataset:aggregate`, `/dataSources`, `/dataSources/{id}/datasets/{range}` | Google Fit steps and weight (backend and browser) |
| `oauth2.googleapis.com`, `accounts.google.com` (via `googleapis` library) | Google OAuth and refresh |
| `www.fitbit.com/oauth2/authorize` | Fitbit consent |
| `api.fitbit.com/oauth2/token` | Fitbit token exchange and refresh (**410**) |
| `api.fitbit.com/1/user/{id}/activities/steps/date/...` | Fitbit steps |
| `api.fitbit.com/1/user/{id}/body/log/weight/date/...` | Fitbit weight |
| `api.fitbit.com/1/user/-/profile.json` | Fitbit profile at connect |

## OAuth configuration

Environment variable **names** (values not shown):

| Name | Used by |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | backend Google OAuth (`routes/auth.js`, `utils/googleAuth.js`) |
| `VITE_GOOGLE_CLIENT_ID` | frontend (set from `GOOGLE_CLIENT_ID` in dev compose) |
| `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `FITBIT_REDIRECT_URI` | backend Fitbit OAuth |
| `FRONTEND_URL`, `VITE_API_URL` | where OAuth callbacks send the user back |

Current Google scopes: `fitness.activity.read`, `fitness.body.read`, `profile`, `email` (offline access, forced consent). Fitbit scopes: `activity`, `weight`, `profile`.

Dev redirect URIs: `https://fitappdevbackend.herringm.com/api/auth/google/callback` and `.../api/auth/fitbit/callback`.

**Look up in the Google Cloud console** (APIs & Services → Credentials / OAuth consent screen) for the client in `GOOGLE_CLIENT_ID`:

1. **Client type:** must be *Web application*.
2. **Authorized redirect URIs:** must include the dev and production `/api/auth/google/callback` URLs exactly.
3. **Scopes on the consent screen:** today the two `fitness.*` scopes; the Google Health API needs the `googlehealth.*` scopes instead (see the migration doc).
4. **Publishing status:** *Testing* or *In production*. In Testing, refresh tokens expire after 7 days and only listed test users can sign in.
5. Whether the **Google Health API** is enabled on the same project.

## Google Health API: data types for Points v2

From Google's API specifications and data-type pages (verified 2026-11-09):

| Data | Exists? | Data type ID | Scope |
|---|---|---|---|
| Steps | Yes | `steps` (interval) | `googlehealth.activity_and_fitness.readonly` |
| Weight | Yes | `weight` (sample, `weightGrams`) | `googlehealth.health_metrics_and_measurements.readonly` |
| Exercise sessions | Yes | `exercise` (session: start/end, `exerciseType`, `metricsSummary`) | `googlehealth.activity_and_fitness.readonly` |
| Active zone minutes | Yes | `active-zone-minutes` (interval, read-only) | `googlehealth.activity_and_fitness.readonly` |
| Heart rate | Yes | `heart-rate` | `googlehealth.health_metrics_and_measurements.readonly` |

Full scope URIs are `https://www.googleapis.com/auth/googlehealth.<name>`.

**Deriving Effort Points for Fitbit and Google users.** Fitbit's Active Zone Minutes are already weighted the way Effort Points are: 1 per fat-burn (moderate) minute and 2 per cardio or peak (vigorous) minute. Each `exercise` session carries `metricsSummary.activeZoneMinutes`, so:

- For each exercise session of 10+ minutes (from its start/end), Effort Points = that session's `activeZoneMinutes`. This applies the "workouts only" rule directly, with no heart-rate math.
- Moderate and vigorous minutes are not split out per session in the docs I could read. If the split is needed for display, the `active-zone-minutes` intervals inside the session window give it. The scoring formula only needs the weighted total.
- The max-heart-rate fallback in Settings is only needed if `metricsSummary.activeZoneMinutes` is missing for some sessions. Decide that against real responses once credentials exist.
- Strength sessions: the docs list only a few `exerciseType` values (`RUNNING`, `WALKING`, `BIKING`, `AEROBIC_WORKOUT`). Confirm the weightlifting value from the API reference or a real response.

Sources: [Google Health API migration guide](https://developers.google.com/health/migration), [API specifications](https://developers.google.com/health/migration/api-specifications), [Workouts data type](https://developers.google.com/health/data-types/workouts), [Steps data type](https://developers.google.com/health/data-types/steps), [Fitbit developer site](https://dev.fitbit.com/build/), [Android Central on the Google Fit API deadline](https://www.androidcentral.com/apps-software/google-has-set-a-deadline-to-shut-down-the-google-fit-api).
