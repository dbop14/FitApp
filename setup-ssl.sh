#!/bin/bash

# FitApp SSL Setup Script
# This script sets up SSL certificates and configures Nginx for HTTPS

set -e

echo "🚀 Setting up SSL for FitApp..."

# Check if domain is provided
DOMAIN="fitapp.herringm.com"
EMAIL="dbop@herringm.com"  # Updated email for SSL setup

echo "📧 Using email: $EMAIL"
echo "🌐 Domain: $DOMAIN"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p ssl
mkdir -p certbot/conf
mkdir -p certbot/www

# Create initial Nginx configuration for certificate challenge
echo "⚙️  Creating initial Nginx configuration..."
cat > nginx-init.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Certbot challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other requests to HTTPS (will work after SSL is set up)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

# Start Nginx with initial configuration
echo "🚀 Starting Nginx with initial configuration..."
docker-compose -f docker-compose-ssl.yml down 2>/dev/null || true
docker-compose -f docker-compose-ssl.yml up -d nginx

# Wait for Nginx to be ready
echo "⏳ Waiting for Nginx to be ready..."
sleep 10

# Generate SSL certificate
echo "🔐 Generating SSL certificate..."
docker-compose -f docker-compose-ssl.yml run --rm certbot

# Copy SSL certificates to the ssl directory
echo "📋 Copying SSL certificates..."
docker cp fitapp-nginx-ssl:/etc/letsencrypt/live/$DOMAIN/fullchain.pem ./ssl/
docker cp fitapp-nginx-ssl:/etc/letsencrypt/live/$DOMAIN/privkey.pem ./ssl/

# Set proper permissions
chmod 644 ./ssl/fullchain.pem
chmod 600 ./ssl/privkey.pem

# Update Nginx configuration to use SSL
echo "⚙️  Updating Nginx configuration for SSL..."
cp nginx-ssl.conf nginx.conf

# Restart Nginx with SSL configuration
echo "🔄 Restarting Nginx with SSL configuration..."
docker-compose -f docker-compose-ssl.yml restart nginx

# Create SSL renewal script
echo "📝 Creating SSL renewal script..."
cat > renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

echo "🔄 Renewing SSL certificates..."

# Stop Nginx temporarily
docker-compose -f docker-compose-ssl.yml stop nginx

# Renew certificates
docker-compose -f docker-compose-ssl.yml run --rm certbot renew

# Copy renewed certificates
docker cp fitapp-nginx-ssl:/etc/letsencrypt/live/fitapp.herringm.com/fullchain.pem ./ssl/
docker cp fitapp-nginx-ssl:/etc/letsencrypt/live/fitapp.herringm.com/privkey.pem ./ssl/

# Set proper permissions
chmod 644 ./ssl/fullchain.pem
chmod 600 ./ssl/privkey.pem

# Restart Nginx
docker-compose -f docker-compose-ssl.yml start nginx

echo "✅ SSL certificates renewed successfully!"
EOF

chmod +x renew-ssl.sh

# Create cron job for automatic renewal
echo "⏰ Setting up automatic SSL renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * cd $(pwd) && ./renew-ssl.sh") | crontab -

echo "✅ SSL setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your DNS to point $DOMAIN to this server's IP address"
echo "2. Make sure ports 80 and 443 are open on your firewall"
echo "3. Test your site: https://$DOMAIN"
echo ""
echo "🔄 SSL certificates will automatically renew every 60 days"
echo "📝 To manually renew: ./renew-ssl.sh"
echo ""
echo "🚀 Your FitApp is now accessible via HTTPS!"
