#!/bin/bash
# Development Deployment Script
# This script starts the development environment with hot reload

cd "$(dirname "$0")"

echo "🔧 Deploying FitApp Development Environment..."
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

