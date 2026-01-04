# FitApp Production Environment

This directory contains the production environment setup for FitApp. The production environment pulls code from GitHub `main` branch and builds Docker images for deployment.

## ⚠️ Important Notes

- **Production uses `main` branch** - Only deploy tested, stable code
- **No hot reload** - Code is baked into Docker images
- **Separate from development** - Uses different ports, volumes, and network
- **Requires rebuild** - Must rebuild images to update code

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- GitHub repository accessible
- Environment variables configured
- `main` branch up to date on GitHub

### First Time Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   Edit `.env` and fill in your **production** values:
   - Bot password
   - Google OAuth credentials (production)
   - VAPID keys
   - Production URLs

3. **Test your setup:**
   ```bash
   # Windows
   .\test-deployment.ps1
   
   # Linux/Mac
   chmod +x test-deployment.sh
   ./test-deployment.sh
   ```

4. **Deploy:**
   ```bash
   # Windows
   .\deploy.ps1
   
   # Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh
   ```

## Deployment Process

The deployment script:
1. Verifies `.env` file and critical variables
2. Stops existing containers
3. Builds Docker images from GitHub `main` branch
4. Starts all production services
5. Shows container status

## Updating Production

When you want to deploy updates:

1. **Merge to main branch:**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Update environment variables (if needed):**
   - Edit `.env` file in the `production/` directory
   - Update `GOOGLE_CLIENT_ID` if OAuth client changed
   - Update any other changed variables

3. **Deploy:**
   ```bash
   cd production
   ./deploy.ps1  # or ./deploy.sh
   ```

This will rebuild images with the latest code from `main` branch.

**Note:** The backend CORS configuration includes production domains (`https://fitapp.herringm.com`, `https://fitappbackend.herringm.com`) and will be included automatically when you rebuild from the latest `main` branch.

## Ports

Production uses different ports to avoid conflicts with development:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **Database**: localhost:27017
- **Synapse Chat**: http://localhost:8008

## Environment Variables

**Critical variables (must be set in `.env` file):**
- `BOT_PASSWORD` - Must be set
- `GOOGLE_CLIENT_ID` - Production OAuth client ID (currently: `200010665728-2vbrbqaqi1jmpps0m8tallirllsa84hd.apps.googleusercontent.com`)
- `GOOGLE_CLIENT_SECRET` - Production OAuth secret
- `GOOGLE_REDIRECT_URI` - Production callback URL (e.g., `https://fitapp.herringm.com/api/auth/google/callback`)
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` - Push notification keys
- `VITE_API_URL` - Production API URL (e.g., `https://fitappbackend.herringm.com`)

**⚠️ Important:** If you get "OAuth client was deleted" errors, update your `.env` file with the new client ID above and rebuild containers.

## Usage

### Start Production Environment

```bash
docker-compose up -d
```

### Stop Production Environment

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f fitness-bot
```

### Restart a Service

```bash
docker-compose restart backend
```

### Rebuild After Code Changes

After pushing to `main` branch:

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Differences from Development

| Feature | Production | Development |
|---------|------------|-------------|
| Code Source | GitHub (main branch) | Local volumes |
| Hot Reload | ❌ No | ✅ Yes |
| Rebuild on Changes | ✅ Yes | ❌ No |
| Database Volume | `mongo_data_prod` | `mongo_data_dev` |
| Network | `fitapp_prod` | `fitapp_dev` |
| Container Names | `fitapp-prod-*` | `fitapp-dev-*` |
| Ports | 3000, 5173, 8008 | 3001, 5174, 8009 |

## Production Checklist

Before deploying to production:

- [ ] All code tested on `develop` branch
- [ ] Code merged to `main` branch
- [ ] `main` branch pushed to GitHub
- [ ] `.env` file configured with production values
- [ ] Environment variables verified
- [ ] Ports are available
- [ ] Database backup (if updating existing deployment)
- [ ] Cloudflare tunnel configured for production ports

## Troubleshooting

### Build Fails

- Check GitHub repository is accessible
- Verify `main` branch exists
- Check Docker has enough resources
- Review build logs: `docker-compose build --no-cache`

### Containers Won't Start

- Check logs: `docker-compose logs`
- Verify `.env` file has all required variables
- Check ports aren't in use
- Verify database volume exists

### Bot Connection Issues

- Verify bot password matches Matrix user
- Check Matrix container is running
- Review bot logs: `docker-compose logs fitness-bot`

### OAuth Errors (401: deleted_client or CORS errors)

If you see "OAuth client was deleted" or CORS errors:

1. **Update `.env` file** with the new client ID:
   ```
   GOOGLE_CLIENT_ID=200010665728-2vbrbqaqi1jmpps0m8tallirllsa84hd.apps.googleusercontent.com
   ```

2. **Rebuild containers** to get the latest code with CORS fixes:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. **Verify Google Cloud Console** has the correct authorized origins:
   - `https://fitapp.herringm.com`
   - `https://fitappbackend.herringm.com`
   - And authorized redirect URIs:
   - `https://fitapp.herringm.com/api/auth/google/callback`

## Security Notes

- **Never commit `.env` file** - It contains sensitive credentials
- **Use strong passwords** - Especially for bot and database
- **Keep secrets secure** - Rotate keys regularly
- **Monitor logs** - Check for unauthorized access

## Backup

Before major updates, backup your data:

```bash
# Backup database
docker exec fitapp-prod-db mongodump --out /data/backup

# Backup volumes
docker run --rm -v fitapp_mongo_data_prod:/data -v $(pwd):/backup alpine tar czf /backup/mongo_backup.tar.gz /data
```

