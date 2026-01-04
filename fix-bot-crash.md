# Fix Bot Crash Issues

## Problem
The fitness bot is crashing due to:
1. **Rate limiting (429 errors)** - Too many login attempts
2. **Authentication failures (403 errors)** - Invalid bot credentials
3. **No retry logic** - Bot exits immediately on failure

## Solution

### 1. Stop the Bot
First, stop the crashing bot:

```bash
docker-compose stop fitness-bot
```

### 2. Create Environment File
Create a `.env` file in your project root:

```bash
# Bot Configuration
BOT_PASSWORD=your_secure_bot_password_here
BOT_USERNAME=fitness_motivator

# Matrix Configuration
MATRIX_HOMESERVER_URL=http://localhost:8008
SYNAPSE_SERVER_NAME=fitapp.local

# Database
MONGO_URI=mongodb://mongoosedb:27017/fitapp
```

### 3. Create Bot User in Matrix
The bot user needs to exist in the Matrix server:

```bash
# Access Matrix container
docker exec -it fitapp-synapse bash

# Create bot user
register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

# Enter these details when prompted:
# Username: fitness_motivator
# Password: [your_bot_password_from_env]
# Make admin: no
# Confirm: yes
```

### 4. Restart Services
Restart all services to pick up the new configuration:

```bash
docker-compose down
docker-compose up -d
```

### 5. Monitor Bot Logs
Check if the bot is working:

```bash
docker-compose logs -f fitness-bot
```

## What's Fixed

### ✅ Retry Logic
- Bot now retries connections with exponential backoff
- Handles rate limiting gracefully
- Waits appropriate time between retry attempts

### ✅ Better Error Handling
- Clear error messages for authentication issues
- Helpful instructions for fixing problems
- Graceful handling of Matrix server errors

### ✅ Connection Stability
- Separate MongoDB and Matrix connection logic
- Proper connection state tracking
- Graceful shutdown handling

## Troubleshooting

### Still Getting Rate Limited?
```bash
# Wait a few minutes, then restart
docker-compose restart fitness-bot
```

### Authentication Still Failing?
```bash
# Check if bot user exists
docker exec -it fitapp-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

# If user exists, you'll see an error
# If not, create it with the same credentials
```

### Matrix Server Not Responding?
```bash
# Check Matrix logs
docker-compose logs synapse

# Restart Matrix
docker-compose restart synapse
```

## Manual Setup Script

If you prefer automated setup, run:

```bash
chmod +x setup-bot-user.sh
./setup-bot-user.sh
```

This script will:
- Create the `.env` file
- Set up the bot user in Matrix
- Restart the bot with proper configuration

## Expected Behavior

After fixing, you should see:
```
🤖 Fitness Bot starting...
✅ Connected to MongoDB
🔄 Attempting to connect to Matrix (attempt 1/10)...
✅ Connected to Matrix
🤖 Fitness Bot is running!
```

Instead of the previous crash messages. 