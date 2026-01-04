#!/bin/bash

echo "🔄 Restarting FitApp services..."

# Stop all services
echo "⏹️  Stopping services..."
docker-compose down

# Start all services
echo "▶️  Starting services..."
docker-compose up -d

# Wait a moment for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service status:"
docker-compose ps

echo "✅ Services restarted!"
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend: http://localhost:3000"
echo "💬 Matrix: http://localhost:8008" 