#!/bin/bash
# Development Deployment Script
# This script starts the development environment with hot reload

cd "$(dirname "$0")"

echo "🚀 Development Deployment Script for FitApp"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your actual values."
        echo ""
    else
        echo "❌ Error: .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Stop existing containers
echo "🛑 Stopping existing development containers..."
docker-compose down

# Check if Synapse needs initialization
SYNAPSE_VOLUME_NAME="development_synapse_data_dev"
VOLUME_LIST=$(docker volume ls --format "{{.Name}}" 2>/dev/null)
SYNAPSE_VOLUME_EXISTS=false
if echo "$VOLUME_LIST" | grep -q "$SYNAPSE_VOLUME_NAME"; then
    SYNAPSE_VOLUME_EXISTS=true
fi

NEEDS_INIT=true
if [ "$SYNAPSE_VOLUME_EXISTS" = true ]; then
    # Try to check if homeserver.yaml exists in the volume
    CHECK_RESULT=$(docker run --rm -v "$SYNAPSE_VOLUME_NAME":/data matrixdotorg/synapse:latest test -f /data/homeserver.yaml 2>&1)
    CHECK_EXIT=$?
    if [ $CHECK_EXIT -eq 0 ]; then
        NEEDS_INIT=false
    fi
fi

if [ "$NEEDS_INIT" = true ]; then
    echo "🔧 Initializing Synapse server..."
    INIT_RESULT=$(docker run --rm \
        -v "$SYNAPSE_VOLUME_NAME":/data \
        -e SYNAPSE_SERVER_NAME=fitapp.local \
        -e SYNAPSE_REPORT_STATS=no \
        matrixdotorg/synapse:latest generate 2>&1)
    INIT_EXIT=$?
    
    if [ $INIT_EXIT -eq 0 ]; then
        echo "✅ Synapse server initialized successfully"
    else
        echo "⚠️  Warning: Synapse initialization may have failed"
        echo "$INIT_RESULT"
    fi
fi

# Build and start containers
echo "🔨 Building and starting development containers..."
echo "   (This may take a few minutes on first run)"
docker-compose up -d --build

# Wait a moment for containers to start
sleep 5

# Show status
echo ""
echo "📊 Development Container Status:"
docker-compose ps

echo ""
echo "✅ Development environment deployed!"
echo ""
echo "🌐 Frontend: http://localhost:5174"
echo "🔌 Backend:  http://localhost:3001"
echo "💬 Chat:     http://localhost:8009"
echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f [service-name]"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
echo ""
echo "🔄 Changes to code will automatically reload!"
