#!/bin/bash

# mynas-connect.sh - Connect to Synology NAS
# Usage: ./scripts/mynas-connect.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔗 Connecting to Synology NAS...${NC}"

# Check if SSH key is loaded
if ! ssh-add -l &>/dev/null; then
    echo -e "${YELLOW}⚠️  SSH key not loaded. Adding key to agent...${NC}"
    ssh-add /Users/dherring/.ssh/id_rsa
fi

# If a command is provided, execute it on the NAS
if [ $# -gt 0 ]; then
    echo -e "${GREEN}📡 Executing command on NAS: $*${NC}"
    ssh mynas "$*"
else
    echo -e "${GREEN}🚀 Opening interactive SSH session...${NC}"
    ssh mynas
fi
