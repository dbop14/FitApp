#!/bin/bash

# Script to run chat duplicate cleanup - auto-detects container name
# Usage: ./run-cleanup-chat.sh <CHALLENGE_ID>

CHALLENGE_ID=$1

if [ -z "$CHALLENGE_ID" ]; then
    echo "❌ Error: Challenge ID is required"
    echo "Usage: ./run-cleanup-chat.sh <CHALLENGE_ID>"
    exit 1
fi

# Try to find the backend container
CONTAINER_NAME=""

# Check for different possible container names
if docker ps --format "{{.Names}}" | grep -q "^fitapp-prod-backend$"; then
    CONTAINER_NAME="fitapp-prod-backend"
elif docker ps --format "{{.Names}}" | grep -q "^fitapp-dev-backend$"; then
    CONTAINER_NAME="fitapp-dev-backend"
elif docker ps --format "{{.Names}}" | grep -q "^fitapp-backend$"; then
    CONTAINER_NAME="fitapp-backend"
else
    echo "❌ Error: Could not find backend container"
    echo "Available containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

echo "✅ Found container: $CONTAINER_NAME"
echo "🚀 Running cleanup script for challenge: $CHALLENGE_ID"
echo ""

docker exec $CONTAINER_NAME node cleanup-chat-duplicates.js $CHALLENGE_ID

