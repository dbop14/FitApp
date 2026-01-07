# OAuth2 Backend Flow Implementation

## Overview

This implementation switches from Google Identity Services (frontend popup) to backend OAuth2 flow to enable 30-day authentication with refresh tokens.

## Changes Made

### Backend Changes

1. **`fitapp-backend/routes/auth.js`**
   - Completed OAuth2 callback handler
   - Added JWT token generation
   - Redirects to frontend with token in query parameters
   - Stores refresh tokens in database for 30-day sync

2. **`fitapp-backend/index.js`**
   - Mounted auth routes at `/api` (line 3078)
   - Auth routes now accessible at `/api/auth/google` and `/api/auth/google/callback`

### Frontend Changes

1. **`fitapp-frontend/src/pages/OAuthCallback.jsx`** (NEW)
   - Handles OAuth redirect from backend
   - Extracts JWT token from query parameters
   - Fetches user data from backend
   - Completes login process

2. **`fitapp-frontend/src/App.jsx`**
   - Added `/auth/callback` route for OAuth callback handling

3. **`fitapp-frontend/src/components/GoogleLoginButton.jsx`**
   - Changed from Google Identity Services popup to backend redirect
   - Now redirects to `/api/auth/google` instead of using `initTokenClient`

### Configuration Changes

1. **`development/docker-compose.yml`**
   - Added `FRONTEND_URL` environment variable
   - Added `JWT_SECRET` environment variable

2. **`development/CLOUDFLARE_SETUP.md`**
   - Updated environment variables documentation
   - Added notes about local vs production URLs

## OAuth Flow

1. User clicks "Continue with Google" → Redirects to `/api/auth/google` (backend)
2. Backend redirects to Google OAuth consent screen
3. User grants permissions → Google redirects to `/api/auth/google/callback` (backend)
4. Backend exchanges code for tokens (gets refresh token!)
5. Backend stores refresh token in database
6. Backend generates JWT and redirects to `/auth/callback?token=JWT&googleId=...` (frontend)
7. Frontend `OAuthCallback` component:
   - Extracts token from query params
   - Fetches user data from backend
   - Calls `login()` to set user state
   - Redirects to `/dashboard`

## Environment Variables Required

### Backend (.env or docker-compose.yml)
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://fitappbackenddev.herringm.com/api/auth/google/callback
FRONTEND_URL=https://fitappdev.herringm.com
JWT_SECRET=your_jwt_secret_here
```

### Frontend (.env)
```env
VITE_API_URL=https://fitappbackenddev.herringm.com
```

## Google Cloud Console Configuration

### Authorized Redirect URIs
Add these redirect URIs in Google Cloud Console:
- `https://fitappbackenddev.herringm.com/api/auth/google/callback` (development)
- `https://fitappbackend.herringm.com/api/auth/google/callback` (production)
- `http://localhost:3001/api/auth/google/callback` (local development)

### Authorized JavaScript Origins
These are still needed for other parts of the app:
- `https://fitappdev.herringm.com`
- `https://fitapp.herringm.com`
- `http://localhost:5174`
- `http://localhost:5173`

## Testing Checklist

- [ ] Set environment variables in `.env` file
- [ ] Update Google Cloud Console with redirect URIs
- [ ] Start development environment: `cd development && ./deploy.sh`
- [ ] Test login flow:
  - [ ] Click "Continue with Google"
  - [ ] Should redirect to Google consent screen
  - [ ] After granting permissions, should redirect back to app
  - [ ] Should land on dashboard with user logged in
- [ ] Verify refresh token is stored in database
- [ ] Test 30-day sync (wait 1 hour and verify token refresh works)
- [ ] Test error handling (deny permissions, network errors, etc.)

## Benefits

1. **30-Day Authentication**: Users get refresh tokens that allow 30+ days of sync without re-authentication
2. **Better Security**: Refresh tokens stored server-side, not in localStorage
3. **No Popups**: Full-page redirect instead of popup (better for mobile/PWA)
4. **More Reliable**: Backend manages token lifecycle

## Migration Notes

- Old users logged in via Google Identity Services won't have refresh tokens
- They'll need to log in again to get refresh tokens
- Existing users with refresh tokens will continue to work

## Troubleshooting

### "Missing code" error
- Check that `GOOGLE_REDIRECT_URI` matches exactly in Google Cloud Console
- Verify the redirect URI is in the authorized list

### "Authentication failed" error
- Check backend logs for OAuth errors
- Verify `JWT_SECRET` is set
- Check that user is created in database

### Redirect loop
- Verify `FRONTEND_URL` is set correctly
- Check that `/auth/callback` route is working
- Verify JWT token is being generated correctly

