# Development Deployment Guide

## Step-by-Step Deployment

### 1. Set Bot Password

**IMPORTANT:** You must set `BOT_PASSWORD` in `development/.env` before deploying.

```bash
# Edit the .env file
# Replace 'your_bot_password_here' with your actual password
```

See `SETUP_BOT_PASSWORD.md` for detailed instructions.

### 2. Test Your Setup

Before deploying, test your configuration:

```bash
cd development

# Windows
.\test-deployment.ps1

# Linux/Mac
chmod +x test-deployment.sh
./test-deployment.sh
```

This will check:
- ✅ .env file exists
- ✅ Docker is installed
- ✅ Required directories exist
- ✅ Ports are available

### 3. Deploy Development Environment

```bash
cd development

# Windows
.\deploy.ps1

# Linux/Mac
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Check/create .env file
2. Stop existing containers
3. Build and start all services
4. Show container status

### 4. Verify Deployment

Check that all containers are running:

```bash
docker-compose ps
```

You should see all services as "Up":
- fitapp-dev-db (MongoDB)
- fitapp-dev-synapse (Matrix)
- fitapp-dev-bot (Fitness Bot)
- fitapp-dev-backend (Backend API)
- fitapp-dev-frontend (Frontend)

### 5. Check Logs

View logs to ensure everything started correctly:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f fitness-bot
```

### 6. Access Your Application

- **Frontend**: http://localhost:5174 (or https://fitappdev.herringm.com)
- **Backend API**: http://localhost:3001 (or https://fitappbackenddev.herringm.com)
- **Chat Server**: http://localhost:8009

## Troubleshooting

### Containers Won't Start

1. **Check logs:**
   ```bash
   docker-compose logs
   ```

2. **Verify .env file:**
   ```bash
   # Make sure BOT_PASSWORD is set
   cat .env | grep BOT_PASSWORD
   ```

3. **Check ports:**
   ```bash
   # Make sure ports aren't in use
   netstat -an | findstr "3000 5173 8008"
   ```

### Bot Connection Issues

If the bot can't connect to Matrix:

1. **Verify Matrix is running:**
   ```bash
   docker-compose ps synapse
   ```

2. **Check bot password:**
   ```bash
   # Make sure password in .env matches Matrix user
   ```

3. **Create bot user if needed:**
   ```bash
   docker exec -it fitapp-dev-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
   ```

### Changes Not Reflecting

Development uses hot reload, but sometimes you need to:

```bash
# Restart a service
docker-compose restart backend

# Or restart all
docker-compose restart
```

## Daily Workflow

1. **Start development:**
   ```bash
   cd development
   docker-compose up -d
   ```

2. **Make code changes** in `../fitapp-backend`, `../fitapp-frontend`, etc.

3. **Changes auto-reload** (no rebuild needed)

4. **View logs if needed:**
   ```bash
   docker-compose logs -f
   ```

5. **Stop when done:**
   ```bash
   docker-compose down
   ```

## Next Steps

After successful deployment:
- ✅ Test your application at http://localhost:5173
- ✅ Make code changes and see them reflect immediately
- ✅ Commit changes to `develop` branch when ready
- ✅ Deploy to production when ready for users

