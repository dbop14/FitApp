# Creating the Bot User in Matrix/Synapse

The bot user `fitness_motivator` needs to be created in the Matrix server for the bot to authenticate and send messages.

## Quick Command (Run on SSH Server)

```bash
cd production
docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
```

When prompted, enter:
- **Username**: `fitness_motivator`
- **Password**: `fitapp_bot_password` (or whatever is in your .env BOT_PASSWORD)
- **Make admin**: `no`

## Verify Bot User Was Created

After creating the user, restart the bot container:

```bash
cd production
docker-compose restart fitness-bot
```

Then check the bot logs to verify it connected:

```bash
docker-compose logs -f fitness-bot
```

You should see:
```
✅ Connected to Matrix
```

## If User Already Exists

If you see "User ID already taken", the user already exists and you can skip creation. Just restart the bot:

```bash
docker-compose restart fitness-bot
```

## Troubleshooting

If the bot still can't connect after creating the user:
1. Verify the password matches exactly what's in `.env` file
2. Check bot logs: `docker-compose logs fitness-bot`
3. Verify Matrix is running: `docker ps | grep synapse`

