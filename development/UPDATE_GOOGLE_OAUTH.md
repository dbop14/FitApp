# Updating Google OAuth Credentials

## Error: deleted_client

If you're seeing the error "Error 401: deleted_client", it means your OAuth client was deleted from Google Cloud Console and you need to update your credentials.

## Steps to Fix

### 1. Get New Google OAuth Credentials

1. **Go to Google Cloud Console:**
   - Navigate to: https://console.cloud.google.com/
   - Select your project
   - Go to **APIs & Services** → **Credentials**

2. **Create a New OAuth 2.0 Client ID:**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - If prompted, configure the OAuth consent screen first
   - Application type: **Web application**
   - Name: `FitApp Development` (or your preferred name)

3. **Configure Authorized JavaScript origins:**
   Add these origins:
   ```
   https://fitappdev.herringm.com
   https://fitapp.herringm.com
   http://localhost:5174
   http://localhost:5173
   ```

4. **Configure Authorized redirect URIs:**
   Add these redirect URIs:
   ```
   https://fitappbackenddev.herringm.com/api/auth/google/callback
   https://fitappbackend.herringm.com/api/auth/google/callback
   http://localhost:3001/api/auth/google/callback
   http://localhost:3000/api/auth/google/callback
   ```

5. **Save and Copy Credentials:**
   - Click **CREATE**
   - Copy the **Client ID** (looks like: `123456789-abc123def456.apps.googleusercontent.com`)
   - Copy the **Client secret** (looks like: `GOCSPX-abc123def456`)

### 2. Update Environment Variables

Update your `development/.env` file with the new credentials:

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_new_client_id_here
GOOGLE_CLIENT_SECRET=your_new_client_secret_here
GOOGLE_REDIRECT_URI=https://fitappbackenddev.herringm.com/api/auth/google/callback

# Frontend also needs the client ID
VITE_GOOGLE_CLIENT_ID=your_new_client_id_here
```

**For local development, use:**
```env
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

### 3. Restart Development Environment

After updating the `.env` file:

```bash
cd development
docker-compose down
docker-compose up -d
```

Or if using the deploy script:
```bash
cd development
./deploy.sh  # Linux/Mac
# or
.\deploy.ps1  # Windows
```

### 4. Verify Configuration

1. Check that containers are running:
   ```bash
   docker-compose ps
   ```

2. Check backend logs for OAuth configuration:
   ```bash
   docker-compose logs backend | grep -i "google\|oauth"
   ```

3. Test the login flow:
   - Navigate to your frontend URL
   - Click "Continue with Google"
   - Should redirect to Google consent screen (not show deleted_client error)

## Troubleshooting

### Still seeing "deleted_client" error

1. **Verify .env file exists and has correct values:**
   ```bash
   cd development
   cat .env | grep GOOGLE
   ```

2. **Check that containers picked up new environment variables:**
   ```bash
   docker-compose exec backend env | grep GOOGLE
   ```

3. **Restart containers to reload environment:**
   ```bash
   docker-compose restart backend frontend
   ```

### "redirect_uri_mismatch" error

- Verify the redirect URI in `.env` matches exactly what's in Google Cloud Console
- Check for trailing slashes (should NOT have them)
- Verify protocol (http vs https) matches

### "invalid_client" error

- Double-check that Client ID and Client Secret are correct
- Make sure there are no extra spaces or quotes in `.env` file
- Verify the OAuth client is enabled in Google Cloud Console

## Important Notes

- **Never commit `.env` files to git** - they contain sensitive credentials
- **Use different OAuth clients for development and production** (recommended)
- **Keep your Client Secret secure** - treat it like a password
- **Changes in Google Cloud Console may take a few minutes to propagate**

## Quick Reference

**Where credentials are used:**
- `development/.env` → Loaded by docker-compose.yml
- `development/docker-compose.yml` → Passes to backend container
- Frontend may also need `VITE_GOOGLE_CLIENT_ID` in `.env` (if using Google Identity Services)

**Files that reference Google OAuth:**
- `fitapp-backend/routes/auth.js` - Uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `fitapp-frontend/src/components/GoogleLoginButton.jsx` - May use `VITE_GOOGLE_CLIENT_ID` (if not using backend OAuth)

