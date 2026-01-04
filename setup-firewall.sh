#!/bin/bash

# Firewall Setup Script for FitApp SSL
# This script configures the firewall to allow HTTP and HTTPS traffic

echo "🔥 Setting up firewall for FitApp SSL..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Detect OS and configure firewall accordingly
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - Check for UFW or iptables
    if command -v ufw &> /dev/null; then
        echo "🔧 Configuring UFW firewall..."
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 22/tcp  # SSH
        ufw --force enable
        echo "✅ UFW configured successfully"
    elif command -v firewall-cmd &> /dev/null; then
        echo "🔧 Configuring firewalld..."
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --reload
        echo "✅ firewalld configured successfully"
    else
        echo "⚠️  No supported firewall detected. Please manually configure:"
        echo "   - Allow port 80 (HTTP)"
        echo "   - Allow port 443 (HTTPS)"
        echo "   - Allow port 22 (SSH)"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 macOS detected - configuring pf firewall..."
    
    # Create pf configuration
    cat > /etc/pf.conf << 'EOF'
# FitApp Firewall Configuration
set skip on lo

# Allow established connections
pass out proto tcp from any to any keep state
pass out proto udp from any to any keep state

# Allow incoming HTTP, HTTPS, and SSH
pass in proto tcp from any to any port { 80, 443, 22 } keep state

# Block all other incoming traffic
block in proto tcp from any to any
block in proto udp from any to any
EOF

    # Enable pf firewall
    pfctl -e -f /etc/pf.conf
    echo "✅ macOS pf firewall configured successfully"
else
    echo "⚠️  Unsupported OS. Please manually configure firewall:"
    echo "   - Allow port 80 (HTTP)"
    echo "   - Allow port 443 (HTTPS)"
    echo "   - Allow port 22 (SSH)"
fi

echo ""
echo "🌐 Firewall configured for FitApp SSL setup!"
echo "📋 Ports opened:"
echo "   - 80 (HTTP) - Required for Let's Encrypt verification"
echo "   - 443 (HTTPS) - Required for SSL traffic"
echo "   - 22 (SSH) - Required for server access"
echo ""
echo "✅ You can now proceed with SSL setup!"
