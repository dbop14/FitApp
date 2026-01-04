# Setting Up Bot Password

The bot password is required for the fitness bot to connect to Matrix/Synapse chat server.

## Option 1: Use Existing Bot Password

If you already have a bot password set up (from your current docker-compose setup), you can use that same password.

1. **Find your existing password:**
   - Check if you have a `.env` file in the root directory
   - Or check your current docker-compose.yml environment variables

2. **Set it in development/.env:**
   ```bash
   # Edit development/.env
   # Replace 'your_bot_password_here' with your actual password
   BOT_PASSWORD=your_actual_password_here
   ```

## Option 2: Create New Bot Password

If you don't have a bot password yet, you'll need to:

1. **Set a password in development/.env:**
   ```bash
   # Edit development/.env
   BOT_PASSWORD=your_secure_password_here
   ```

2. **Start the development environment:**
   ```bash
   cd development
   docker-compose up -d
   ```

3. **Wait for Matrix to be ready** (about 30 seconds)

4. **Create the bot user in Matrix:**
   ```bash
   # Access the Matrix container
   docker exec -it fitapp-dev-synapse bash
   
   # Create the bot user
   register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
   
   # When prompted:
   # Username: fitness_motivator
   # Password: [use the same password from .env]
   # Make admin: no
   # Confirm: yes
   ```

5. **Restart the bot:**
   ```bash
   docker-compose restart fitness-bot
   ```

## Quick Setup Script

You can also use the setup script from the root directory:

```bash
# From root directory
./setup-bot-user.sh
```

This will create the bot user automatically.

## Verify Bot Password

After setting the password, verify it works:

```bash
cd development
docker-compose logs fitness-bot
```

You should see:
```
✅ Connected to Matrix
```

If you see errors about authentication, the password is incorrect.

