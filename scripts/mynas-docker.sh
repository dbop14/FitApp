#!/bin/bash

# mynas-docker.sh - Docker management on Synology NAS
# Usage: ./scripts/mynas-docker.sh [command] [service]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

COMMAND=${1:-status}
SERVICE=${2:-""}

echo -e "${BLUE}🐳 Docker management on Synology NAS...${NC}"

# Add SSH key if not loaded
if ! ssh-add -l &>/dev/null; then
    echo -e "${YELLOW}⚠️  SSH key not loaded. Adding key to agent...${NC}"
    ssh-add /Users/dherring/.ssh/id_rsa
fi

case $COMMAND in
    "status")
        echo -e "${GREEN}📊 Checking Docker container status...${NC}"
        ssh mynas 'cd /volume1/docker/fitapp && docker-compose ps'
        ;;
    "logs")
        if [ -n "$SERVICE" ]; then
            echo -e "${GREEN}📋 Viewing logs for $SERVICE...${NC}"
            ssh mynas "cd /volume1/docker/fitapp && docker-compose logs -f $SERVICE"
        else
            echo -e "${GREEN}📋 Viewing all logs...${NC}"
            ssh mynas 'cd /volume1/docker/fitapp && docker-compose logs -f'
        fi
        ;;
    "restart")
        if [ -n "$SERVICE" ]; then
            echo -e "${GREEN}🔄 Restarting $SERVICE...${NC}"
            ssh mynas "cd /volume1/docker/fitapp && docker-compose restart $SERVICE"
        else
            echo -e "${GREEN}🔄 Restarting all services...${NC}"
            ssh mynas 'cd /volume1/docker/fitapp && docker-compose restart'
        fi
        ;;
    "stop")
        if [ -n "$SERVICE" ]; then
            echo -e "${GREEN}⏹️  Stopping $SERVICE...${NC}"
            ssh mynas "cd /volume1/docker/fitapp && docker-compose stop $SERVICE"
        else
            echo -e "${GREEN}⏹️  Stopping all services...${NC}"
            ssh mynas 'cd /volume1/docker/fitapp && docker-compose stop'
        fi
        ;;
    "start")
        if [ -n "$SERVICE" ]; then
            echo -e "${GREEN}▶️  Starting $SERVICE...${NC}"
            ssh mynas "cd /volume1/docker/fitapp && docker-compose start $SERVICE"
        else
            echo -e "${GREEN}▶️  Starting all services...${NC}"
            ssh mynas 'cd /volume1/docker/fitapp && docker-compose start'
        fi
        ;;
    "up")
        echo -e "${GREEN}🚀 Starting all services (docker-compose up)...${NC}"
        ssh mynas 'cd /volume1/docker/fitapp && docker-compose up -d'
        ;;
    "down")
        echo -e "${GREEN}🛑 Stopping all services (docker-compose down)...${NC}"
        ssh mynas 'cd /volume1/docker/fitapp && docker-compose down'
        ;;
    *)
        echo -e "${RED}❌ Invalid command. Available commands:${NC}"
        echo -e "  status    - Show container status"
        echo -e "  logs      - Show logs (optionally for specific service)"
        echo -e "  restart   - Restart services (optionally specific service)"
        echo -e "  stop      - Stop services (optionally specific service)"
        echo -e "  start     - Start services (optionally specific service)"
        echo -e "  up        - Start all services with docker-compose up"
        echo -e "  down      - Stop all services with docker-compose down"
        echo -e ""
        echo -e "Usage: $0 [command] [service]"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Command completed!${NC}"
