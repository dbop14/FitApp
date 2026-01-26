# Environment Variables Checklist

This document helps ensure all required environment variables are configured for both **Development** and **Production** environments.

## Quick Setup

1. **Development**: Copy `development/.env.example` to `development/.env` and fill in your values
2. **Production**: Copy `production/.env.example` to `production/.env` and fill in your values

## Required Variables

### 🔴 Critical (Must Be Set)

#### Bot Configuration
- `BOT_PASSWORD` - Matrix/Synapse bot password (see `development/SETUP_BOT_PASSWORD.md`)

#### Google OAuth
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL
  - Development: `https://fitappdev.herringm.com/api/auth/google/callback`
  - Production: `https://fitapp.herringm.com/api/auth/google/callback`

#### Fitbit OAuth (Optional - for Fitbit data source)
- `FITBIT_CLIENT_ID` - Fitbit OAuth Client ID (from https://dev.fitbit.com/apps)
- `FITBIT_CLIENT_SECRET` - Fitbit OAuth Client Secret
- `FITBIT_REDIRECT_URI` - Fitbit OAuth callback URL
  - Development: `https://fitappbackenddev.herringm.com/api/auth/fitbit/callback`
  - Production: `https://fitappbackend.herringm.com/api/auth/fitbit/callback`

#### Push Notifications (VAPID Keys)
- `VAPID_PUBLIC_KEY` - Generate using: `node fitapp-backend/scripts/generate-vapid-keys.js`
- `VAPID_PRIVATE_KEY` - Generate using: `node fitapp-backend/scripts/generate-vapid-keys.js`

#### Frontend Variables
- `VITE_API_URL` - Backend API URL
  - Development: `https://fitappbackenddev.herringm.com`
  - Production: `https://fitappbackend.herringm.com`
- `VITE_GOOGLE_CLIENT_ID` - Same as `GOOGLE_CLIENT_ID`

### 🟡 Optional (Have Defaults)

- `BOT_USERNAME` - Defaults to `fitness_motivator`
- `MONGO_URI` - Defaults to `mongodb://mongoosedb:27017/fitapp`
- `JWT_SECRET` - Has default but should be set in production
- `MATRIX_HOMESERVER_URL` - Defaults to `http://synapse:8008`
- `MATRIX_SERVER_NAME` - Defaults to `fitapp.local`
- `NODE_ENV` - Set automatically by docker-compose
- `FITBIT_CLIENT_ID` - Optional, only needed if using Fitbit data source
- `FITBIT_CLIENT_SECRET` - Optional, only needed if using Fitbit data source
- `FITBIT_REDIRECT_URI` - Optional, only needed if using Fitbit data source

## Environment-Specific URLs

### Development
- Frontend: `https://fitappdev.herringm.com` (or `http://localhost:5174`)
- Backend: `https://fitappbackenddev.herringm.com` (or `http://localhost:3001`)
- Chat: `http://localhost:8009`

### Production
- Frontend: `https://fitapp.herringm.com` (or `http://localhost:5173`)
- Backend: `https://fitappbackend.herringm.com` (or `http://localhost:3000`)
- Chat: `http://localhost:8008`

## OAuth Setup

### Google OAuth Setup

Make sure your Google Cloud Console OAuth 2.0 Client has:

### Authorized JavaScript Origins
- `https://fitappdev.herringm.com` (development)
- `https://fitapp.herringm.com` (production)
- `http://localhost:5174` (local development)
- `http://localhost:5173` (local production)

### Authorized Redirect URIs
- `https://fitappdev.herringm.com/api/auth/google/callback` (development)
- `https://fitapp.herringm.com/api/auth/google/callback` (production)
- `http://localhost:3001/api/auth/google/callback` (local development)
- `http://localhost:3000/api/auth/google/callback` (local production)

### Fitbit OAuth Setup

To set up Fitbit OAuth:

1. **Create Fitbit Developer Account**
   - Go to https://dev.fitbit.com/
   - Sign up/login with a Fitbit account

2. **Register Your Application**
   - Navigate to "Manage" → "Register an App"
   - Fill in application details:
     - **Application Name**: FitApp (or your preferred name)
     - **Description**: Fitness tracking application
     - **Application Website**: Your app URL
     - **Organization**: Your organization name
     - **OAuth 2.0 Application Type**: **Server**
     - **Callback URL**: 
       - Development: `https://fitappbackenddev.herringm.com/api/auth/fitbit/callback`
       - Production: `https://fitappbackend.herringm.com/api/auth/fitbit/callback`
     - **Default Access Type**: Read Only (for steps and weight)

3. **Required Scopes**
   - Select these OAuth scopes:
     - `activity` - Read activity data (steps)
     - `weight` - Read weight data
     - `profile` - Read basic profile info

4. **Get Credentials**
   - After registration, you'll receive:
     - **Client ID** (OAuth 2.0 Client ID)
     - **Client Secret** (OAuth 2.0 Client Secret)
   - Copy these to your `.env` files

## Verification Steps

### Before Deploying Development
- [ ] `development/.env` file exists
- [ ] `BOT_PASSWORD` is set
- [ ] `GOOGLE_CLIENT_ID` is set
- [ ] `GOOGLE_CLIENT_SECRET` is set
- [ ] `GOOGLE_REDIRECT_URI` matches development URL
- [ ] `VAPID_PUBLIC_KEY` is set
- [ ] `VAPID_PRIVATE_KEY` is set
- [ ] `VITE_API_URL` matches development backend URL
- [ ] `VITE_GOOGLE_CLIENT_ID` matches `GOOGLE_CLIENT_ID`
- [ ] `FITBIT_CLIENT_ID` is set (if using Fitbit data source)
- [ ] `FITBIT_CLIENT_SECRET` is set (if using Fitbit data source)
- [ ] `FITBIT_REDIRECT_URI` matches development URL (if using Fitbit)

### Before Deploying Production
- [ ] `production/.env` file exists
- [ ] `BOT_PASSWORD` is set (production bot password)
- [ ] `GOOGLE_CLIENT_ID` is set (production OAuth client)
- [ ] `GOOGLE_CLIENT_SECRET` is set (production OAuth secret)
- [ ] `GOOGLE_REDIRECT_URI` matches production URL
- [ ] `VAPID_PUBLIC_KEY` is set
- [ ] `VAPID_PRIVATE_KEY` is set
- [ ] `VITE_API_URL` matches production backend URL
- [ ] `VITE_GOOGLE_CLIENT_ID` matches `GOOGLE_CLIENT_ID`
- [ ] Google Cloud Console has production domains configured
- [ ] `FITBIT_CLIENT_ID` is set (if using Fitbit data source)
- [ ] `FITBIT_CLIENT_SECRET` is set (if using Fitbit data source)
- [ ] `FITBIT_REDIRECT_URI` matches production URL (if using Fitbit)

## Generating VAPID Keys

If you need to generate VAPID keys:

```bash
cd fitapp-backend
node scripts/generate-vapid-keys.js
```

Copy the generated keys to your `.env` files.

## Testing Your Configuration

### Development
```bash
cd development
.\test-deployment.ps1  # Windows
# or
./test-deployment.sh   # Linux/Mac
```

### Production
```bash
cd production
.\test-deployment.ps1  # Windows
# or
./test-deployment.sh   # Linux/Mac
```

## Troubleshooting

### Missing Variables
If containers fail to start, check:
1. `.env` file exists in the correct directory
2. All required variables are set (not using placeholder values)
3. No typos in variable names
4. File encoding is correct (UTF-8)

### OAuth Errors
If you see "OAuth client was deleted" or CORS errors:
1. **Google OAuth**: 
   - Verify `GOOGLE_CLIENT_ID` matches your Google Cloud Console
   - Check authorized origins/redirect URIs in Google Cloud Console
   - Ensure `GOOGLE_REDIRECT_URI` matches exactly (including protocol)
2. **Fitbit OAuth**:
   - Verify `FITBIT_CLIENT_ID` matches your Fitbit Developer Portal
   - Check callback URL in Fitbit app settings matches `FITBIT_REDIRECT_URI` exactly
   - Ensure application type is set to "Server" in Fitbit Developer Portal

### Bot Connection Issues
If the bot can't connect:
1. Verify `BOT_PASSWORD` is correct
2. Check Matrix/Synapse container is running
3. Ensure bot user exists in Matrix server

## Notes

- **Never commit `.env` files** - They contain sensitive credentials
- **`.env.example` files are safe to commit** - They're templates without real values
- **Use different values for dev/prod** - Especially for OAuth and bot passwords
- **VAPID keys can be shared** - Same keys work for both environments, or use separate ones

