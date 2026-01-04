#!/bin/bash
# Test Deployment Script
# This script helps verify your development environment setup

echo "Testing Development Environment Setup..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create .env file first:"
    echo "   cp .env.example .env"
    echo "   Then edit .env and fill in values"
    exit 1
fi

echo "✅ .env file found"

# Check if BOT_PASSWORD is set
if grep -q "your_bot_password_here" .env 2>/dev/null; then
    echo "⚠️  Warning: BOT_PASSWORD may not be set correctly"
    echo "   Please edit .env and set BOT_PASSWORD"
else
    echo "✅ BOT_PASSWORD appears to be set"
fi

# Check Docker
echo ""
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✅ Docker is installed: $DOCKER_VERSION"
else
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Check Docker Compose
echo ""
echo "Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo "✅ Docker Compose is installed: $COMPOSE_VERSION"
else
    echo "❌ Docker Compose is not installed or not in PATH"
    exit 1
fi

# Check if required directories exist
echo ""
echo "Checking source directories..."
REQUIRED_DIRS=("../fitapp-backend" "../fitapp-frontend" "../fitapp-bot")
ALL_EXIST=true

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ Found: $dir"
    else
        echo "❌ Missing: $dir"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = false ]; then
    echo ""
    echo "❌ Some required directories are missing"
    echo "   Make sure you're running this from the development/ directory"
    exit 1
fi

# Check if ports are available (basic check)
echo ""
echo "Checking if ports are available..."
PORTS=(3001 5174 8009 27017)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        echo "⚠️  Port $port may be in use"
    else
        echo "✅ Port $port appears available"
    fi
done

echo ""
echo "✅ Setup check complete!"
echo ""
echo "Ready to deploy? Run:"
echo "   ./deploy.sh"

