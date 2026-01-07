# Cloudflare Tunnel Setup for Development

## Development Subdomains

The development environment uses separate subdomains to avoid conflicts with production:

- **Frontend**: `fitappdev.herringm.com`
- **Backend**: `fitappbackenddev.herringm.com`

## Cloudflare Tunnel Configuration

You need to configure your Cloudflare tunnel to route these subdomains to your development containers:

### Frontend Route
```
fitappdev.herringm.com → localhost:5174
```

### Backend Route
```
fitappbackenddev.herringm.com → localhost:3001
```

## Configuration Steps

1. **Access Cloudflare Dashboard**
   - Go to your Cloudflare dashboard
   - Navigate to Zero Trust → Networks → Tunnels
   - Select your tunnel

2. **Add Public Hostname for Frontend**
   - Service: `http://localhost:5174`
   - Public hostname: `fitappdev.herringm.com`

3. **Add Public Hostname for Backend**
   - Service: `http://localhost:3001`
   - Public hostname: `fitappbackenddev.herringm.com`

## Environment Variables

Make sure your `.env` file has:

```env
VITE_API_URL=https://fitappbackenddev.herringm.com
GOOGLE_REDIRECT_URI=https://fitappbackenddev.herringm.com/api/auth/google/callback
FRONTEND_URL=https://fitappdev.herringm.com
JWT_SECRET=your_jwt_secret_here
```

**Note:** For local development, use:
```env
VITE_API_URL=http://localhost:3001
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:5174
JWT_SECRET=your_jwt_secret_here
```

## Google OAuth Setup

If you're using Google OAuth, you'll need to configure your OAuth 2.0 Client in Google Cloud Console:

### Steps:

1. **Go to Google Cloud Console:**
   - Navigate to: https://console.cloud.google.com/
   - Select your project
   - Go to **APIs & Services** → **Credentials**

2. **Edit your OAuth 2.0 Client ID:**
   - Find your OAuth client: `200010665728-2vbrbqaqi1jmpps0m8tallirllsa84hd.apps.googleusercontent.com`
   - Click **Edit** (pencil icon)

3. **Add Authorized JavaScript origins:**
   These are required for the client-side Google Identity Services flow:
   - `https://fitappdev.herringm.com`
   - `https://fitapp.herringm.com` (production)
   - `http://localhost:5174` (local development)
   - `http://localhost:5173` (local development - root docker-compose)

4. **Add Authorized redirect URIs:**
   These are required if you're using server-side OAuth flows:
   - `https://fitappdev.herringm.com/api/auth/google/callback`
   - `https://fitapp.herringm.com/api/auth/google/callback` (production)
   - `http://localhost:3001/api/auth/google/callback` (local development)
   - `http://localhost:3000/api/auth/google/callback` (local development - root docker-compose)

5. **Save the changes**

### Important Notes:

- **Authorized JavaScript origins** must match exactly (including protocol `https://` or `http://`)
- **No trailing slashes** in the origins
- Changes may take a few minutes to propagate
- Make sure you're editing the correct OAuth client (the new one with the updated client ID)

## Testing

After configuring the tunnel:

1. Start development environment:
   ```bash
   cd development
   ./deploy.sh
   ```

2. Access via subdomains:
   - Frontend: https://fitappdev.herringm.com
   - Backend API: https://fitappbackenddev.herringm.com

3. Or access locally:
   - Frontend: http://localhost:5174
   - Backend: http://localhost:3001

## Notes

- Development and production can run simultaneously
- Development uses different ports (3001, 5174, 8009)
- Development uses different subdomains (fitappdev, fitappbackenddev)
- No conflicts with production environment

