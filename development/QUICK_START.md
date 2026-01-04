# Development Environment - Quick Start

## First Time Setup

1. **Navigate to development directory:**
   ```bash
   cd development
   ```

2. **Create .env file:**
   ```bash
   # Copy the example
   cp .env.example .env
   
   # Edit with your values
   nano .env  # or use your preferred editor
   ```

3. **Fill in required values in .env:**
   - `BOT_PASSWORD` - Your bot password
   - `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` - Your Google OAuth secret
   - `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` - Push notification keys

4. **Deploy:**
   ```bash
   # Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh
   
   # Windows PowerShell
   .\deploy.ps1
   ```

## Daily Usage

### Start Development Environment
```bash
docker-compose up -d
```

### Stop Development Environment
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
```

### Restart After Code Changes
```bash
# Usually not needed - hot reload handles it
# But if needed:
docker-compose restart backend
```

## Access Points

- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3001
- **Chat Server**: http://localhost:8009
- **Database**: localhost:27017

## Development Workflow

1. Make changes to code in:
   - `../fitapp-backend/` - Backend changes
   - `../fitapp-frontend/` - Frontend changes
   - `../fitapp-bot/` - Bot changes

2. Changes are automatically reflected (hot reload)

3. Test your changes

4. Commit to `develop` branch:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin develop
   ```

5. When ready, merge to `main` for production

## Troubleshooting

### Port Already in Use
If ports 3000, 5173, or 8008 are already in use:
- Stop other containers using those ports
- Or modify ports in `docker-compose.yml`

### Changes Not Reflecting
- Check that volumes are mounted correctly
- Restart the service: `docker-compose restart [service]`
- Check file permissions

### Database Issues
- Database is isolated in `mongo_data_dev` volume
- To reset: `docker-compose down -v` (WARNING: deletes data)

