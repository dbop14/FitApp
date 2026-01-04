#!/bin/bash

echo "🤖 Fitness Bot Setup Script"
echo "=========================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Bot Configuration
BOT_PASSWORD=fitapp_bot_password_$(date +%s)
BOT_USERNAME=fitness_motivator

# Matrix Configuration
MATRIX_HOMESERVER_URL=http://localhost:8008
SYNAPSE_SERVER_NAME=fitapp.local

# Database
MONGO_URI=mongodb://mongoosedb:27017/fitapp
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Source the .env file
source .env

echo ""
echo "🔧 Setting up Matrix bot user..."

# Check if Matrix container is running
if ! docker ps | grep -q fitapp-synapse; then
    echo "❌ Matrix container (fitapp-synapse) is not running!"
    echo "💡 Please start your services first:"
    echo "   docker-compose up -d"
    exit 1
fi

echo "✅ Matrix container is running"

# Wait for Matrix to be ready
echo "⏳ Waiting for Matrix server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8008/_matrix/client/versions > /dev/null 2>&1; then
        echo "✅ Matrix server is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Matrix server is not responding after 30 seconds"
        exit 1
    fi
    echo "   Attempt $i/30..."
    sleep 2
done

# Create bot user
echo ""
echo "👤 Creating bot user: $BOT_USERNAME"
echo "   Password: $BOT_PASSWORD"

# Use expect to automate the user creation
cat > /tmp/create_bot_user.exp << EOF
#!/usr/bin/expect -f
set timeout 30

spawn docker exec -it fitapp-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

expect "New user localpart \\\[fitness_motivator\\\]: "
send "$BOT_USERNAME\r"

expect "Password: "
send "$BOT_PASSWORD\r"

expect "Confirm password: "
send "$BOT_PASSWORD\r"

expect "Make admin \\\[no\\\]: "
send "no\r"

expect "Success!"
expect eof
EOF

chmod +x /tmp/create_bot_user.exp

# Run the expect script
if /tmp/create_bot_user.exp; then
    echo "✅ Bot user created successfully!"
else
    echo "❌ Failed to create bot user"
    echo "💡 You may need to create the user manually:"
    echo "   docker exec -it fitapp-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008"
    echo "   Username: $BOT_USERNAME"
    echo "   Password: $BOT_PASSWORD"
    echo "   Make admin: no"
fi

# Clean up
rm -f /tmp/create_bot_user.exp

echo ""
echo "🚀 Starting bot..."
echo "💡 The bot will now attempt to connect with retry logic"
echo "📊 You can monitor the logs with: docker-compose logs -f fitness-bot"

# Restart the bot container to pick up new environment
docker-compose restart fitness-bot

echo ""
echo "✅ Setup complete!"
echo "📝 Bot credentials saved in .env file"
echo "🔍 Check bot logs: docker-compose logs -f fitness-bot" 