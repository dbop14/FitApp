#!/bin/bash
# Quick script to create the fitness_motivator bot user in production Synapse

cd "$(dirname "$0")"

echo "🤖 Creating Fitness Bot User in Production Synapse"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create .env file with BOT_PASSWORD set"
    exit 1
fi

# Source .env to get credentials
source .env

BOT_USERNAME=${BOT_USERNAME:-fitness_motivator}

if [ -z "$BOT_PASSWORD" ]; then
    echo "❌ Error: BOT_PASSWORD not set in .env file!"
    exit 1
fi

echo "📋 Bot User Details:"
echo "   Username: $BOT_USERNAME"
echo "   Password: [from .env]"
echo ""

# Check if Synapse container is running
if ! docker ps | grep -q fitapp-prod-synapse; then
    echo "❌ Error: Synapse container (fitapp-prod-synapse) is not running!"
    echo "   Please start it first: docker-compose up -d synapse"
    exit 1
fi

echo "✅ Synapse container is running"

# Wait for Synapse to be ready
echo "⏳ Waiting for Synapse to be ready..."
for i in {1..30}; do
    if docker exec fitapp-prod-synapse curl -s http://localhost:8008/_matrix/client/versions > /dev/null 2>&1; then
        echo "✅ Synapse is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Synapse is not responding after 30 seconds"
        exit 1
    fi
    sleep 2
done

# Check if expect is available
if ! command -v expect &> /dev/null; then
    echo ""
    echo "⚠️  'expect' command not found. Please create the user manually:"
    echo ""
    echo "   docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
    echo ""
    echo "   When prompted:"
    echo "   - Username: $BOT_USERNAME"
    echo "   - Password: $BOT_PASSWORD"
    echo "   - Make admin: no"
    exit 1
fi

# Create bot user using expect
echo ""
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
        puts "User already exists"
        exit 0
    }
    timeout {
        exit 1
    }
    eof
}
EOF

chmod +x /tmp/create_bot_user_prod.exp

if /tmp/create_bot_user_prod.exp; then
    echo "✅ Bot user created successfully!"
    echo ""
    echo "🔄 Restarting bot container..."
    docker-compose restart fitness-bot
    echo ""
    echo "✅ Done! The bot should now be able to connect."
    echo "📝 Check bot logs: docker-compose logs -f fitness-bot"
else
    echo "❌ Failed to create bot user"
    echo ""
    echo "💡 Try creating it manually:"
    echo "   docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
fi

rm -f /tmp/create_bot_user_prod.exp

