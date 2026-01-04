#!/bin/bash

# mynas-sync.sh - Sync files to/from Synology NAS
# Usage: ./scripts/mynas-sync.sh [direction] [path]
# direction: up (local to NAS) or down (NAS to local)
# path: optional specific path to sync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

LOCAL_PATH="/Volumes/docker/fitapp"
NAS_PATH="/volume1/docker/fitapp"
DIRECTION=${1:-up}
SYNC_PATH=${2:-""}

echo -e "${BLUE}🔄 Syncing files to/from Synology NAS...${NC}"

# Add SSH key if not loaded
if ! ssh-add -l &>/dev/null; then
    echo -e "${YELLOW}⚠️  SSH key not loaded. Adding key to agent...${NC}"
    ssh-add /Users/dherring/.ssh/id_rsa
fi

# Build paths
if [ -n "$SYNC_PATH" ]; then
    LOCAL_SYNC_PATH="$LOCAL_PATH/$SYNC_PATH"
    NAS_SYNC_PATH="$NAS_PATH/$SYNC_PATH"
else
    LOCAL_SYNC_PATH="$LOCAL_PATH/"
    NAS_SYNC_PATH="$NAS_PATH/"
fi

case $DIRECTION in
    "up")
        echo -e "${GREEN}📤 Syncing from local to NAS...${NC}"
        echo -e "From: $LOCAL_SYNC_PATH"
        echo -e "To: mynas:$NAS_SYNC_PATH"
        rsync -avz --progress --exclude='node_modules' --exclude='.git' --exclude='*.log' "$LOCAL_SYNC_PATH" "mynas:$NAS_SYNC_PATH"
        ;;
    "down")
        echo -e "${GREEN}📥 Syncing from NAS to local...${NC}"
        echo -e "From: mynas:$NAS_SYNC_PATH"
        echo -e "To: $LOCAL_SYNC_PATH"
        rsync -avz --progress --exclude='node_modules' --exclude='.git' --exclude='*.log' "mynas:$NAS_SYNC_PATH" "$LOCAL_SYNC_PATH"
        ;;
    *)
        echo -e "${RED}❌ Invalid direction. Use 'up' or 'down'${NC}"
        echo -e "Usage: $0 [up|down] [path]"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Sync completed!${NC}"
