# Connection test report: Fitbit and Google Fit

Run on 2026-11-09 against the dev stack (`fitapp-dev-backend`), read-only. No sync code was changed.

## Verdicts

| Source | Auth | Steps | Weight | Evidence | Verdict |
|---|---|---|---|---|---|
| `fitbit` | **410 Gone** | not reachable (needs a token) | not reachable (needs a token) | `POST https://api.fitbit.com/oauth2/token` with the dev app's real client ID/secret returned `410` and: *"The legacy Fitbit Web API and OAuth 2.0 endpoints were decommissioned on October 30, 2026. Please migrate your integration to the Google Health APIs"*. No user can get or refresh a Fitbit token, so no step or weight call can succeed. | **Broken** |
| `google-fit` | **200** refresh | **200** | **200** | Re-run 2026-11-09 after a real sign-in on dev (one user, `dataSource: google-fit`). (a) `POST oauth2.googleapis.com/token` refresh → `200`, scopes `fitness.activity.read`, `fitness.body.read`, `openid`, `userinfo.email`, `userinfo.profile`, `expires_in: 3599`. (b) `POST fitness/v1/users/me/dataset:aggregate` for `com.google.step_count.delta`, today → `200`, 1 bucket, 1 point, `dataTypeName: com.google.step_count.delta`, `value: [{intVal}]`. (c) same endpoint for `com.google.weight` over 90 days → `200`, `dataTypeName: com.google.weight.summary`, `value: [{fpVal: avg}, {fpVal: max}, {fpVal: min}]` in kg. The refreshed token was not saved. | **Working** (until Google Fit shuts down at the end of 2026) |

### Notes

- The first run found no dev users. Dev sign-in then failed with `redirect_uri_mismatch` until `https://fitappdevbackend.herringm.com/api/auth/google/callback` was added to the OAuth client; after that, the Google Fit test above passed.
- **Fitbit needs no further test.** The OAuth endpoint itself is gone.
- Google says the Google Fit APIs are available "until the end of 2026" with no exact date published, so even if the Google Fit test passes, that path has weeks left.

## Backend log summary

- **Dev (30 minutes after sign-in):** 0 sync errors. 21 step-point syncs and history writes for 2026-10-19 → 2026-11-09, all from `google-fit`.
- **Privacy finding:** the existing sync code logs the user's email on every history write (`Storing fitness history for <email> …`). Phase 3 replaces those log lines with the Google ID suffix.
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
