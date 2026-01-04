# Fitness Challenge Chat Setup Guide

## Overview

This setup creates a real-time chat system for fitness challenges using:
- **Matrix/Synapse** - Decentralized chat server
- **Fitness Bot** - Motivational bot with scheduled reminders
- **Frontend Chat Interface** - React-based chat UI

## Features

### 🤖 Motivational Bot
- **Scheduled Reminders**: Daily step goals, weight logging, morning motivation
- **Interactive Commands**: `!help`, `!motivate`, `!stats`, `!goals`, `!remind`
- **Random Motivation**: Sends encouraging messages during conversations
- **Challenge Integration**: Connects to your existing challenge system

### 💬 Real-time Chat
- **Matrix Protocol**: Decentralized, secure messaging
- **Challenge Rooms**: Each challenge gets its own chat room
- **User Management**: Automatic participant invitations
- **Modern UI**: Clean, responsive chat interface

## Setup Instructions

### 1. Environment Variables

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

### 2. Initialize Matrix Server

First time setup for Matrix:

```bash
# Create Matrix configuration
docker run -it --rm \
  -v synapse_data:/data \
  -e SYNAPSE_SERVER_NAME=fitapp.local \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

# Start the services
docker-compose up -d
```

### 3. Create Bot User

After Matrix is running, create the bot user:

```bash
# Access Matrix container
docker exec -it fitapp-synapse bash

# Create bot user
register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

# Enter details:
# Username: fitness_motivator
# Password: [your_bot_password]
# Make admin: no
# Confirm: yes
```

### 4. Install Dependencies

```bash
# Backend dependencies
cd fitapp-backend
npm install

# Bot dependencies
cd ../fitapp-bot
npm install

# Frontend dependencies
cd ../fitapp-frontend
npm install
```

### 5. Start All Services

```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps
```

## Usage

### Creating Challenges with Chat

When you create a challenge through your app, it will:
1. Create a Matrix chat room for the challenge
2. Invite all participants automatically
3. Start the motivational bot in that room

### Bot Commands

Users can interact with the bot using these commands:

- `!help` - Show available commands
- `!motivate` - Get a motivational message
- `!stats` - Show challenge statistics
- `!goals` - Show current challenge goals
- `!remind` - Set daily reminders

### Scheduled Reminders

The bot automatically sends:
- **8 AM**: Morning motivation + weight logging reminder
- **9 AM**: Step goal reminder
- **6 PM**: Evening check-in
- **Random**: Motivational messages during conversations

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Fitness Bot   │
│   (React)       │◄──►│   (Express)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Matrix        │    │   MongoDB       │    │   Cron Jobs     │
│   (Synapse)     │    │   (Challenges)  │    │   (Reminders)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Troubleshooting

### Matrix Connection Issues

```bash
# Check Matrix logs
docker-compose logs synapse

# Restart Matrix
docker-compose restart synapse
```

### Bot Connection Issues

```bash
# Check bot logs
docker-compose logs fitness-bot

# Verify bot user exists
docker exec -it fitapp-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
```

### Database Issues

```bash
# Check MongoDB connection
docker-compose logs mongoosedb

# Access MongoDB
docker exec -it mongoosedb mongosh
```

## Security Considerations

1. **Bot Password**: Use a strong, unique password for the bot
2. **Matrix Security**: Configure Matrix with proper security settings
3. **Environment Variables**: Never commit `.env` files to version control
4. **Network Access**: Consider firewall rules for Matrix ports

## Scaling Considerations

- **Matrix Federation**: Can federate with other Matrix servers
- **Bot Scaling**: Multiple bot instances for high-traffic challenges
- **Database**: Consider MongoDB clustering for large deployments
- **Load Balancing**: Use reverse proxy for multiple Matrix instances

## Next Steps

1. **Real Matrix Integration**: Replace simulated chat with actual Matrix client
2. **Advanced Bot Features**: Add AI-powered responses, progress tracking
3. **Push Notifications**: Integrate with mobile push notifications
4. **Voice/Video**: Enable Matrix voice/video calls for challenges
5. **Analytics**: Track engagement and motivation effectiveness

## Support

For issues or questions:
1. Check the logs: `docker-compose logs [service-name]`
2. Verify environment variables are set correctly
3. Ensure all services are running: `docker-compose ps`
4. Check Matrix documentation: https://matrix.org/docs/ 