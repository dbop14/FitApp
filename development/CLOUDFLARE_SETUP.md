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
GOOGLE_REDIRECT_URI=https://fitappdev.herringm.com/api/auth/google/callback
```

## Google OAuth Setup

If you're using Google OAuth, you'll need to:

1. **Add authorized redirect URIs in Google Cloud Console:**
   - `https://fitappdev.herringm.com/api/auth/google/callback`

2. **Update your Google OAuth client:**
   - Go to Google Cloud Console
   - APIs & Services → Credentials
   - Edit your OAuth 2.0 Client
   - Add the dev redirect URI to authorized redirect URIs

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

