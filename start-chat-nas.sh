#!/bin/bash

echo "🚀 Starting Fitness Challenge Chat System on NAS..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from /volume1/docker/fitapp"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Bot Configuration
BOT_PASSWORD=fitapp_bot_password_$(date +%s)
BOT_USERNAME=fitness_motivator

# Matrix Configuration
MATRIX_HOMESERVER_URL=http://localhost:8008
SYNAPSE_SERVER_NAME=fitapp.local

# Database
MONGO_URI=mongodb://mongoosedb:27017/fitapp
EOF
    echo "✅ Created .env file with default values"
    echo "⚠️  Please update BOT_PASSWORD in .env file for production use"
fi

# Stop any running services
echo "🛑 Stopping any running services..."
docker-compose down

# Remove existing Matrix volume if it exists (to start fresh)
echo "🧹 Cleaning up existing Matrix data..."
docker volume rm fitapp_synapse_data 2>/dev/null || echo "No existing Matrix volume to remove"

# Initialize Matrix server
echo "🔧 Initializing Matrix server..."
docker run -it --rm \
    -v fitapp_synapse_data:/data \
    -e SYNAPSE_SERVER_NAME=fitapp.local \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:latest generate

if [ $? -eq 0 ]; then
    echo "✅ Matrix server initialized successfully"
else
    echo "❌ Failed to initialize Matrix server"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."

if [ -d "fitapp-backend" ]; then
    echo "Installing backend dependencies..."
    cd fitapp-backend && npm install && cd ..
fi

if [ -d "fitapp-bot" ]; then
    echo "Installing bot dependencies..."
    cd fitapp-bot && npm install && cd ..
fi

if [ -d "fitapp-frontend" ]; then
    echo "Installing frontend dependencies..."
    cd fitapp-frontend && npm install && cd ..
fi

# Start services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 15

# Check service status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 Fitness Challenge Chat System is starting!"
echo ""
echo "📋 Next steps:"
echo "1. Wait for all services to be healthy (check with: docker-compose ps)"
echo "2. Create bot user in Matrix (see instructions below)"
echo "3. Access your app at: http://localhost:5173"
echo "4. Check Matrix server at: http://localhost:8008"
echo ""
echo "🤖 To create the bot user, run:"
echo "   docker exec -it fitapp-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
echo "   Username: fitness_motivator"
echo "   Password: [use the BOT_PASSWORD from .env file]"
echo "   Make admin: no"
echo "   Confirm: yes"
echo ""
echo "📚 For detailed setup instructions, see: setup-chat.md"
echo "🐛 For troubleshooting, run: docker-compose logs [service-name]" 