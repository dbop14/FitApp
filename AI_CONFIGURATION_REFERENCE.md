# AI CONFIGURATION REFERENCE - DO NOT MODIFY EXISTING SETUP

## ⚠️ CRITICAL WARNING FOR AI ASSISTANTS ⚠️
**DO NOT CHANGE THE EXISTING TUNNEL CONFIGURATION OR HOSTNAMES**
**DO NOT ADD NEW CLOUDFLARED CONTAINERS**
**DO NOT MODIFY EXISTING ENVIRONMENT VARIABLES**

## Existing Tunnel Configuration
The user already has a working Cloudflare tunnel setup with these **FIXED** hostnames:

- **Frontend**: `fitapp.herringm.com` → Maps to localhost:5173
- **Backend API**: `fitappbackend.herringm.com` → Maps to localhost:3000
- **Chat**: `chat.fitapp.herringm.com` → Maps to localhost:8008

## Docker Services Configuration
- **Container Names**: Use the exact names from docker-compose.yml
- **Frontend Service**: `frontend` (not fitapp-frontend)
- **Backend Service**: `backend` (not fitapp-backend)
- **Database Service**: `mongoosedb`
- **Chat Service**: `synapse`
- **Bot Service**: `fitness-bot`

## Environment Variables - DO NOT CHANGE
- **VITE_API_URL**: Must remain `https://fitappbackend.herringm.com`
- **VITE_MATRIX_URL**: Must remain `http://synapse:8008`

## Port Mappings
- Frontend: 5173
- Backend: 3000
- Database: 27017
- Chat: 8008

## Network Configuration
- **Network Name**: `fitapp_default`
- **External Access**: Through existing Cloudflare tunnel (NOT through new containers)

## When Adding New Services
1. **NEVER** create new cloudflared containers
2. **NEVER** change existing hostnames
3. **NEVER** modify existing environment variables
4. **ALWAYS** use the existing tunnel for external access
5. **ALWAYS** add new routes through Cloudflare dashboard, not docker-compose

## Existing Tunnel Container
- **Name**: `cloudflare-synology-tunnel`
- **Status**: Already running and configured
- **Authentication**: Token-based (not config file)
- **Location**: Separate from fitapp docker-compose

## Troubleshooting
If services are not accessible:
1. Check if containers are running: `sudo docker ps`
2. Verify local access: `curl http://localhost:5173`
3. Check Cloudflare dashboard for tunnel status
4. **DO NOT** recreate tunnels or change hostnames

## Summary for AI Assistants
- ✅ Use existing tunnel configuration
- ✅ Keep existing hostnames
- ✅ Keep existing environment variables
- ✅ Add new services to existing tunnel through dashboard
- ❌ Don't create new tunnels
- ❌ Don't change existing URLs
- ❌ Don't modify existing environment variables
