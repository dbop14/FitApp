# FitApp SSL Setup Guide

This guide will help you set up SSL certificates and configure Nginx for HTTPS access to your FitApp.

## 🎯 What We'll Accomplish

- ✅ Set up SSL certificates using Let's Encrypt (free)
- ✅ Configure Nginx to serve HTTPS traffic
- ✅ Automatically redirect HTTP to HTTPS
- ✅ Set up automatic SSL certificate renewal
- ✅ Configure proper security headers

## 📋 Prerequisites

1. **Domain Name**: You must own `fitappdev.herringm.com`
2. **DNS Configuration**: Point your domain to this server's IP address
3. **Server Access**: SSH access to your server
4. **Docker**: Docker and Docker Compose must be installed
5. **Ports**: Ports 80 and 443 must be accessible from the internet

## 🚀 Quick Setup

### Step 1: Update Email Address

Edit `docker-compose-ssl.yml` and change the email address:
```bash
# Replace "your-email@example.com" with your actual email
EMAIL="your-actual-email@example.com"
```

### Step 2: Configure Firewall

```bash
# Make the script executable
chmod +x setup-firewall.sh

# Run as root (sudo)
sudo ./setup-firewall.sh
```

### Step 3: Run SSL Setup

```bash
# Make the script executable
chmod +x setup-ssl.sh

# Run the SSL setup
./setup-ssl.sh
```

## 🔧 Manual Setup (Alternative)

If you prefer to set up manually or troubleshoot issues:

### 1. Create Directories
```bash
mkdir -p ssl
mkdir -p certbot/conf
mkdir -p certbot/www
```

### 2. Start Nginx with Initial Config
```bash
# Use the initial configuration for certificate challenge
cp nginx-init.conf nginx.conf

# Start services
docker-compose -f docker-compose-ssl.yml up -d nginx
```

### 3. Generate SSL Certificate
```bash
docker-compose -f docker-compose-ssl.yml run --rm certbot
```

### 4. Switch to SSL Configuration
```bash
# Copy SSL configuration
cp nginx-ssl.conf nginx.conf

# Restart Nginx
docker-compose -f docker-compose-ssl.yml restart nginx
```

## 🌐 DNS Configuration

Ensure your domain points to your server:

```bash
# Check your server's public IP
curl ifconfig.me

# Add these DNS records:
# Type: A
# Name: fitappdev.herringm.com
# Value: YOUR_SERVER_IP

# Type: A  
# Name: www.fitappdev.herringm.com
# Value: YOUR_SERVER_IP
```

## 🔍 Troubleshooting

### Common Issues

1. **Certificate Generation Fails**
   - Check if port 80 is accessible from internet
   - Verify DNS is pointing to correct IP
   - Check firewall settings

2. **Nginx Won't Start**
   - Check SSL certificate paths
   - Verify file permissions
   - Check Docker container logs

3. **HTTPS Not Working**
   - Ensure port 443 is open
   - Check SSL certificate validity
   - Verify Nginx configuration

### Debug Commands

```bash
# Check Nginx logs
docker logs fitapp-nginx-ssl

# Check SSL certificate
openssl x509 -in ssl/fullchain.pem -text -noout

# Test HTTPS connection
curl -I https://fitappdev.herringm.com

# Check firewall status
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-all  # CentOS/RHEL
```

## 🔄 SSL Renewal

SSL certificates automatically renew every 60 days via cron job.

**Manual renewal:**
```bash
./renew-ssl.sh
```

**Check renewal status:**
```bash
docker-compose -f docker-compose-ssl.yml run --rm certbot certificates
```

## 🛡️ Security Features

The SSL configuration includes:

- **HSTS**: Forces HTTPS for 1 year
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Modern TLS**: TLS 1.2 and 1.3 only
- **Strong Ciphers**: ECDHE with AES-GCM
- **Automatic Redirects**: HTTP → HTTPS

## 📁 File Structure

```
fitapp/
├── nginx-ssl.conf          # SSL-enabled Nginx configuration
├── docker-compose-ssl.yml  # Docker Compose with SSL services
├── setup-ssl.sh           # Automated SSL setup script
├── setup-firewall.sh      # Firewall configuration script
├── renew-ssl.sh           # SSL renewal script
├── ssl/                   # SSL certificates directory
└── certbot/               # Let's Encrypt data
    ├── conf/              # Certificate configuration
    └── www/               # Webroot for challenges
```

## 🎉 Success!

After setup, your FitApp will be accessible at:
- **HTTPS**: https://fitappdev.herringm.com
- **HTTP**: Automatically redirects to HTTPS

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Docker container logs
3. Verify firewall and DNS settings
4. Ensure all prerequisites are met

---

**Note**: This setup uses Let's Encrypt, which provides free SSL certificates valid for 90 days with automatic renewal.
