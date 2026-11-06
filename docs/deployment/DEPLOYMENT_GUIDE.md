# Complete Deployment Guide - Production & Development

This guide will help you deploy both production and development environments on your Synology NAS.

## Prerequisites

✅ Both `.env` files are configured
✅ Git repository is up to date
✅ Docker and Docker Compose installed on NAS

## Deployment Order

**Recommended:** Deploy production first, then development (they can run simultaneously).

---

## Step 1: Deploy Production Environment

### On Your Synology NAS:

```bash
# SSH into your NAS
ssh admin@your-nas-ip

# Navigate to the production directory
cd /volume1/docker/fitapp/production

# Test the setup first
chmod +x test-deployment.sh
./test-deployment.sh

# If test passes, deploy
chmod +x deploy.sh
./deploy.sh
```

### What This Does:

1. ✅ Verifies `.env` file and environment variables
2. ✅ Stops any existing production containers
3. ✅ Builds Docker images from GitHub `main` branch
4. ✅ Starts all production services
5. ✅ Shows container status

### Expected Output:

```
✅ Production deployment complete!
🌐 Frontend: http://localhost:5173
🔌 Backend:  http://localhost:3000
💬 Chat:     http://localhost:8008
```

### Verify Production:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Check specific service
docker-compose logs -f backend
```

---

## Step 2: Deploy Development Environment

### On Your Synology NAS:

```bash
# Navigate to development directory
cd /volume1/docker/fitapp/development

# Test the setup first
chmod +x test-deployment.sh
./test-deployment.sh

# If test passes, deploy
chmod +x deploy.sh
./deploy.sh
```

### What This Does:

1. ✅ Verifies `.env` file
2. ✅ Stops any existing development containers
3. ✅ Builds and starts services with local volume mounts
4. ✅ Enables hot reload for development

### Expected Output:

```
✅ Development environment deployed!
🌐 Frontend: http://localhost:5174
🔌 Backend:  http://localhost:3001
💬 Chat:     http://localhost:8009
```

### Verify Development:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

---

## Step 3: Configure Cloudflare Tunnel

### Production Routes (Already configured):
- `fitapp.herringm.com` → `localhost:5173`
- `fitappbackend.herringm.com` → `localhost:3000`

### Development Routes (Need to add):
- `fitappdev.herringm.com` → `localhost:5174`
- `fitappbackenddev.herringm.com` → `localhost:3001`

### Add Development Routes:

1. Go to Cloudflare Dashboard
2. Zero Trust → Networks → Tunnels
3. Select your tunnel
4. Add public hostname:
   - **Service**: `http://localhost:5174`
   - **Public hostname**: `fitappdev.herringm.com`
5. Add another public hostname:
   - **Service**: `http://localhost:3001`
   - **Public hostname**: `fitappbackenddev.herringm.com`

---

## Access Your Applications

### Production:
- **Frontend**: https://fitapp.herringm.com
- **Backend API**: https://fitappbackend.herringm.com
- **Local**: http://localhost:5173 (frontend), http://localhost:3000 (backend)

### Development:
- **Frontend**: https://fitappdev.herringm.com (after Cloudflare setup)
- **Backend API**: https://fitappbackenddev.herringm.com (after Cloudflare setup)
- **Local**: http://localhost:5174 (frontend), http://localhost:3001 (backend)

---

## Troubleshooting

### Production Build Fails

**Issue**: GitHub clone fails
**Solution**: Make sure repository is public (the production Dockerfiles clone it anonymously)

**Issue**: Node.js version error
**Solution**: Already fixed - using Node.js 20

### Development Containers Won't Start

**Issue**: Port conflicts
**Solution**: 
```bash
# Check what's using the ports
netstat -tulpn | grep -E '3001|5174|8009'

# Stop conflicting containers
docker-compose down
```

### Bot Connection Issues

**Issue**: Bot can't connect to Matrix
**Solution**:
1. Verify bot password in `.env` matches Matrix user
2. Create bot user if needed:
   ```bash
   docker exec -it fitapp-dev-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
   ```

---

## Quick Commands Reference

### Production

```bash
cd /volume1/docker/fitapp/production

# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild (after code changes)
./deploy.sh
```

### Development

```bash
cd /volume1/docker/fitapp/development

# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart
# (No rebuild needed - hot reload handles changes)
```

---

## Both Environments Running

Once both are deployed, you can:

✅ **Use production** for real users at `fitapp.herringm.com`
✅ **Develop features** in development at `fitappdev.herringm.com`
✅ **Test changes** without affecting production
✅ **Deploy updates** by merging to `main` and rebuilding production

---

## Next Steps After Deployment

1. **Test production** - Verify everything works at production URLs
2. **Test development** - Verify development environment works
3. **Configure Google OAuth** - Add dev redirect URI if needed
4. **Monitor logs** - Check both environments are running smoothly
5. **Set up backups** - Consider backing up database volumes

---

## Need Help?

- Check logs: `docker-compose logs -f [service-name]`
- Check status: `docker-compose ps`
- Review documentation in `production/README.md` and `development/README.md`

