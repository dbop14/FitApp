#!/bin/bash
# Production Deployment Script
# This script deploys the production environment from GitHub main branch

cd "$(dirname "$0")"

echo "🚀 Deploying FitApp Production Environment..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your actual values."
        echo ""
        echo "❌ ERROR: You must configure .env before deploying to production!"
        exit 1
    else
        echo "❌ Error: .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Verify critical environment variables
echo "🔍 Verifying environment variables..."
source .env

if [ -z "$BOT_PASSWORD" ] || [ "$BOT_PASSWORD" = "your_production_bot_password_here" ]; then
    echo "❌ ERROR: BOT_PASSWORD not set in .env file!"
    echo "   Please edit .env and set BOT_PASSWORD"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" = "your_google_client_id" ]; then
    echo "❌ ERROR: GOOGLE_CLIENT_ID not set in .env file!"
    exit 1
fi

echo "✅ Environment variables verified"
echo ""

# Stop existing containers
echo "🛑 Stopping existing production containers..."
docker-compose down

# Build images from GitHub main branch
echo "📥 Building images from GitHub main branch..."
echo "   This may take several minutes..."
docker-compose build --no-cache --build-arg GIT_BRANCH=main

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Start containers
echo "▶️  Starting production containers..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Show status
echo ""
echo "📊 Production Container Status:"
docker-compose ps

echo ""
echo "✅ Production deployment complete!"
echo ""
echo "🌐 Frontend: http://localhost:5173"
echo "🔌 Backend:  http://localhost:3000"
echo "💬 Chat:     http://localhost:8008"
echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f [service-name]"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"

