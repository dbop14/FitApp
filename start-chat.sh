#!/bin/bash

echo "🚀 Starting Fitness Challenge Chat System..."

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

# Check if Matrix data volume exists
if ! docker volume ls | grep -q synapse_data; then
    echo "🔧 Initializing Matrix server..."
    docker run -it --rm \
        -v synapse_data:/data \
        -e SYNAPSE_SERVER_NAME=fitapp.local \
        -e SYNAPSE_REPORT_STATS=no \
        matrixdotorg/synapse:latest generate
    echo "✅ Matrix server initialized"
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
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 Fitness Challenge Chat System is starting!"
echo ""
echo "📋 Next steps:"
echo "1. Wait for all services to be healthy (check with: docker-compose ps)"
echo "2. Create bot user in Matrix (see setup-chat.md for instructions)"
echo "3. Access your app at: http://localhost:5173"
echo "4. Check Matrix server at: http://localhost:8008"
echo ""
echo "📚 For detailed setup instructions, see: setup-chat.md"
echo "🐛 For troubleshooting, run: docker-compose logs [service-name]" 