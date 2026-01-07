# FitApp Development Environment

This directory contains the development environment setup for FitApp. The development environment uses local volume mounts for hot reload, allowing you to see changes immediately without rebuilding containers.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git repository cloned locally
- Environment variables configured

### First Time Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   Edit `.env` and fill in your actual values (bot password, Google OAuth credentials, etc.)

3. **Deploy:**
   ```bash
   # Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh
   
   # Windows PowerShell
   .\deploy.ps1
   ```

## Usage

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
docker-compose logs -f fitness-bot
```

### Restart a Service

```bash
docker-compose restart backend
docker-compose restart frontend
```

## Development Features

- **Hot Reload**: Changes to code are automatically reflected (no rebuild needed)
- **Local Volumes**: Code is mounted from `../fitapp-backend`, `../fitapp-frontend`, etc.
- **Separate Database**: Uses `mongo_data_dev` volume (won't conflict with production)
- **Separate Network**: Uses `fitapp_dev` network (isolated from production)

## Ports

- **Frontend**: http://localhost:5174
- **Backend**: http://localhost:3001
- **Database**: localhost:27017
- **Synapse Chat**: http://localhost:8009

## Environment Variables

See `.env.example` for all required environment variables. Copy it to `.env` and fill in your values.

## Workflow

1. Make changes to code in `../fitapp-backend`, `../fitapp-frontend`, or `../fitapp-bot`
2. Changes are automatically reflected (hot reload)
3. Test your changes locally
4. Commit to `develop` branch when ready
5. Merge to `main` when ready for production

## Troubleshooting

### Containers won't start
- Check if ports are already in use
- Verify `.env` file exists and has correct values
- Check logs: `docker-compose logs`

### OAuth "deleted_client" error
- Your Google OAuth client was deleted - see `UPDATE_GOOGLE_OAUTH.md` for instructions
- Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` file
- Restart containers after updating credentials

### Changes not reflecting
- Make sure volumes are mounted correctly
- Restart the service: `docker-compose restart [service]`
- Check file permissions

### Database issues
- Database data is stored in `mongo_data_dev` volume
- To reset: `docker-compose down -v` (WARNING: deletes all data)

## Differences from Production

| Feature | Development | Production |
|---------|------------|------------|
| Code Source | Local volumes | GitHub (main branch) |
| Hot Reload | ✅ Yes | ❌ No |
| Rebuild on Changes | ❌ No | ✅ Yes |
| Database Volume | `mongo_data_dev` | `mongo_data_prod` |
| Network | `fitapp_dev` | `fitapp_prod` |
| Container Names | `fitapp-dev-*` | `fitapp-prod-*` |

