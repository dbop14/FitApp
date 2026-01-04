# Production Environment - Quick Start

## First Time Setup

1. **Navigate to production directory:**
   ```bash
   cd production
   ```

2. **Create .env file:**
   ```bash
   # Copy the example
   cp .env.example .env
   
   # Edit with your PRODUCTION values
   nano .env  # or use your preferred editor
   ```

3. **Fill in required values in .env:**
   - `BOT_PASSWORD` - Your production bot password
   - `GOOGLE_CLIENT_ID` - Production Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` - Production Google OAuth secret
   - `GOOGLE_REDIRECT_URI` - Production callback URL (https://fitapp.herringm.com/api/auth/google/callback)
   - `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` - Push notification keys
   - `VITE_API_URL` - Production API URL (https://fitappbackend.herringm.com)

4. **Test your setup:**
   ```bash
   # Windows
   .\test-deployment.ps1
   
   # Linux/Mac
   chmod +x test-deployment.sh
   ./test-deployment.sh
   ```

5. **Deploy:**
   ```bash
   # Windows
   .\deploy.ps1
   
   # Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh
   ```

## Updating Production

When you want to deploy new code:

1. **Merge to main branch:**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Update `.env` file if needed:**
   - If OAuth client changed, update `GOOGLE_CLIENT_ID` in `.env`
   - Set your Google OAuth client ID in the `.env` file

3. **Deploy:**
   ```bash
   cd production
   ./deploy.ps1  # or ./deploy.sh
   ```

**Note:** The backend CORS configuration includes production domains and will be included when you rebuild from the latest `main` branch.

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Chat Server**: http://localhost:8008

## Important Notes

- ⚠️ **Production pulls from GitHub `main` branch**
- ⚠️ **Must rebuild to update code** (no hot reload)
- ⚠️ **Uses production environment variables**
- ⚠️ **Separate from development** (different ports/volumes)

## Quick Commands

```bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop environment
docker-compose down

# Restart a service
docker-compose restart backend

# Rebuild after code changes
docker-compose build --no-cache
docker-compose up -d
```

