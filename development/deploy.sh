#!/bin/bash
# Development Deployment Script
# This script starts the development environment with hot reload

cd "$(dirname "$0")"

# #region agent log
LOG_DIR="../.cursor"
LOG_PATH="$LOG_DIR/debug.log"
mkdir -p "$LOG_DIR"
log_entry() {
    local hypothesis_id=$1
    local location=$2
    local message=$3
    local data=$4
    local timestamp=$(date +%s%3N 2>/dev/null || echo $(($(date +%s) * 1000)))
    echo "{\"sessionId\":\"debug-session\",\"runId\":\"run1\",\"hypothesisId\":\"$hypothesis_id\",\"location\":\"$location\",\"message\":\"$message\",\"data\":$data,\"timestamp\":$timestamp}" >> "$LOG_PATH"
}
log_entry "A" "deploy.sh:7" "Script started" "{\"scriptPath\":\"$(pwd)\",\"currentDir\":\"$(pwd)\"}"
# #endregion

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

# #region agent log
if [ -f docker-compose.yml ]; then
    COMPOSE_EXISTS="true"
    COMPOSE_PATH=$(readlink -f docker-compose.yml 2>/dev/null || realpath docker-compose.yml 2>/dev/null || echo "docker-compose.yml")
else
    COMPOSE_EXISTS="false"
    COMPOSE_PATH=""
fi
log_entry "B" "deploy.sh:24" "Checking docker-compose.yml existence" "{\"composeExists\":$COMPOSE_EXISTS,\"composePath\":\"$COMPOSE_PATH\"}"
# #endregion

# Stop existing containers
echo "🛑 Stopping existing development containers..."
docker-compose down

# #region agent log
VOLUME_LIST=$(docker volume ls --format "{{.Name}}" 2>/dev/null)
SYNAPSE_VOLUME_EXISTS=false
SYNAPSE_VOLUME_NAME="development_synapse_data_dev"
if echo "$VOLUME_LIST" | grep -q "$SYNAPSE_VOLUME_NAME"; then
    SYNAPSE_VOLUME_EXISTS=true
fi
log_entry "C" "deploy.sh:30" "Checking synapse_data_dev volume existence" "{\"volumeList\":\"$VOLUME_LIST\",\"synapseVolumeExists\":$SYNAPSE_VOLUME_EXISTS,\"volumeName\":\"$SYNAPSE_VOLUME_NAME\"}"
# #endregion

# #region agent log
log_entry "D" "deploy.sh:35" "Checking if homeserver.yaml exists in volume" "{\"checkAttempt\":\"before_init\",\"volumeName\":\"$SYNAPSE_VOLUME_NAME\"}"
# #endregion

# Check if Synapse needs initialization
NEEDS_INIT=true
if [ "$SYNAPSE_VOLUME_EXISTS" = true ]; then
    # #region agent log
    log_entry "E" "deploy.sh:45" "Synapse volume found, checking config file" "{\"volumes\":\"$SYNAPSE_VOLUME_NAME\"}"
    # #endregion
    
    # Try to check if homeserver.yaml exists in the volume
    CHECK_RESULT=$(docker run --rm -v "$SYNAPSE_VOLUME_NAME":/data matrixdotorg/synapse:latest test -f /data/homeserver.yaml 2>&1)
    CHECK_EXIT=$?
    if [ $CHECK_EXIT -eq 0 ]; then
        NEEDS_INIT=false
        # #region agent log
        log_entry "E" "deploy.sh:55" "homeserver.yaml exists, no init needed" "{\"checkResult\":\"$CHECK_RESULT\"}"
        # #endregion
    else
        # #region agent log
        log_entry "A" "deploy.sh:60" "homeserver.yaml missing, init needed" "{\"checkResult\":\"$CHECK_RESULT\",\"exitCode\":$CHECK_EXIT}"
        # #endregion
    fi
else
    # #region agent log
    log_entry "A" "deploy.sh:70" "No synapse volume found, init needed" "{\"expectedVolume\":\"$SYNAPSE_VOLUME_NAME\"}"
    # #endregion
fi

if [ "$NEEDS_INIT" = true ]; then
    echo "🔧 Initializing Synapse server..."
    # #region agent log
    log_entry "B" "deploy.sh:78" "Starting Synapse initialization" "{\"serverName\":\"fitapp.local\",\"volumeName\":\"$SYNAPSE_VOLUME_NAME\"}"
    # #endregion
    
    INIT_RESULT=$(docker run --rm \
        -v "$SYNAPSE_VOLUME_NAME":/data \
        -e SYNAPSE_SERVER_NAME=fitapp.local \
        -e SYNAPSE_REPORT_STATS=no \
        matrixdotorg/synapse:latest generate 2>&1)
    INIT_EXIT=$?
    
    # #region agent log
    log_entry "B" "deploy.sh:90" "Synapse initialization completed" "{\"exitCode\":$INIT_EXIT,\"initOutput\":\"$INIT_RESULT\"}"
    # #endregion
    
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

# #region agent log
log_entry "C" "deploy.sh:110" "Starting docker-compose up" "{\"beforeStart\":\"true\"}"
# #endregion

docker-compose up -d --build
COMPOSE_EXIT=$?

# #region agent log
log_entry "C" "deploy.sh:115" "docker-compose up completed" "{\"exitCode\":$COMPOSE_EXIT}"
# #endregion

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

