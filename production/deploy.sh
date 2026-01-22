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

# Check if Synapse needs initialization
SYNAPSE_VOLUME_NAME="production_synapse_data_prod"
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

# Wait for MongoDB to be ready and initialize replica set if needed
echo "⏳ Waiting for MongoDB to be ready..."
MONGO_READY=false
MONGO_CONTAINER="fitapp-prod-db"
for i in {1..30}; do
    if docker exec "$MONGO_CONTAINER" mongo --port 27017 --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
        MONGO_READY=true
        echo "✅ MongoDB is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  MongoDB is not responding after 30 seconds"
        echo "   Replica set initialization will be skipped"
        MONGO_READY=false
        break
    fi
    sleep 1
done

# Initialize MongoDB replica set if needed
if [ "$MONGO_READY" = true ]; then
    echo "🔍 Checking MongoDB replica set status..."
    
    # Check if replica set is already initialized
    RS_STATUS=$(docker exec "$MONGO_CONTAINER" mongo --port 27017 --eval "try { rs.status().set; } catch(err) { print('NOT_INIT'); }" --quiet 2>/dev/null)
    
    if echo "$RS_STATUS" | grep -q "rs0"; then
        echo "✅ MongoDB replica set already initialized: rs0"
    else
        echo "🔧 Initializing MongoDB replica set..."
        INIT_RESULT=$(docker exec "$MONGO_CONTAINER" mongo --port 27017 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongoosedb:27017'}]})" --quiet 2>&1)
        INIT_EXIT=$?
        
        if [ $INIT_EXIT -eq 0 ]; then
            echo "✅ MongoDB replica set initialized successfully"
            echo "⏳ Waiting for replica set to become ready..."
            sleep 5
            
            # Verify initialization
            RS_VERIFY=$(docker exec "$MONGO_CONTAINER" mongo --port 27017 --eval "rs.status().set" --quiet 2>/dev/null)
            if echo "$RS_VERIFY" | grep -q "rs0"; then
                echo "✅ Replica set verified: rs0"
            else
                echo "⚠️  Warning: Replica set initialization may not have completed"
            fi
        else
            echo "⚠️  Warning: Replica set initialization may have failed"
            echo "$INIT_RESULT"
        fi
    fi
fi

# Wait for Synapse to be ready
echo "⏳ Waiting for Synapse server to be ready..."
SYNAPSE_READY=false
for i in {1..30}; do
    if docker exec fitapp-prod-synapse curl -s http://localhost:8008/_matrix/client/versions > /dev/null 2>&1; then
        SYNAPSE_READY=true
        echo "✅ Synapse server is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Synapse server is not responding after 30 seconds"
        echo "   Bot user creation will be skipped. You may need to create it manually."
        SYNAPSE_READY=false
        break
    fi
    sleep 2
done

# Create bot user if Synapse is ready
if [ "$SYNAPSE_READY" = true ]; then
    echo ""
    echo "🤖 Checking if bot user exists..."
    
    # Source .env to get bot credentials
    source .env
    BOT_USERNAME=${BOT_USERNAME:-fitness_motivator}
    
    # Check if user exists by trying to query it (non-destructive check)
    USER_EXISTS=$(docker exec fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008 --help 2>&1 | grep -q "register_new_matrix_user" && echo "check_needed" || echo "unknown")
    
    # Try to create bot user using expect if available
    if command -v expect &> /dev/null; then
        echo "👤 Creating bot user: $BOT_USERNAME"
        cat > /tmp/create_bot_user_prod.exp << EOF
#!/usr/bin/expect -f
set timeout 30

spawn docker exec -i fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

expect {
    "New user localpart" {
        send "$BOT_USERNAME\r"
        exp_continue
    }
    "Password:" {
        send "$BOT_PASSWORD\r"
        exp_continue
    }
    "Confirm password:" {
        send "$BOT_PASSWORD\r"
        exp_continue
    }
    "Make admin" {
        send "no\r"
        exp_continue
    }
    "Success!" {
        exit 0
    }
    "User ID already taken" {
        exit 0
    }
    timeout {
        exit 1
    }
    eof
}
EOF
        chmod +x /tmp/create_bot_user_prod.exp
        
        if /tmp/create_bot_user_prod.exp > /dev/null 2>&1; then
            echo "✅ Bot user created or already exists"
        else
            echo "⚠️  Could not create bot user automatically"
            echo "💡 You may need to create it manually:"
            echo "   docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
            echo "   Username: $BOT_USERNAME"
            echo "   Password: [your BOT_PASSWORD from .env]"
        fi
        rm -f /tmp/create_bot_user_prod.exp
    else
        echo "⚠️  'expect' command not found. Bot user creation skipped."
        echo "💡 Please create the bot user manually:"
        echo "   docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
        echo "   Username: $BOT_USERNAME"
        echo "   Password: [your BOT_PASSWORD from .env]"
        echo "   Make admin: no"
    fi
fi

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

