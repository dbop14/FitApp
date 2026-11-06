# Synology NAS SSH Setup Guide

This guide helps you set up easy SSH access to your Synology NAS using the `mynas` function in Cursor.

## ✅ What's Already Configured

1. **SSH Config Enhanced** (`~/.ssh/config`)
   - Added connection optimization settings
   - Configured for better Cursor integration
   - Set up key-based authentication

2. **Cursor Functions** (`.cursor/functions.json`)
   - `mynas` - Basic SSH connection
   - `mynas-sftp` - SFTP file transfer
   - `mynas-rsync` - File synchronization
   - `mynas-docker-logs` - View Docker logs
   - `mynas-docker-status` - Check Docker status
   - `mynas-restart-services` - Restart services

3. **Helper Scripts** (`scripts/`)
   - `mynas-connect.sh` - Interactive SSH connection
   - `mynas-sync.sh` - File synchronization
   - `mynas-docker.sh` - Docker management

## 🔧 Setup Steps

### 1. Fix SSH Key Authentication

The SSH connection is currently failing due to authentication. You need to:

**Option A: Add your public key to the NAS**
```bash
# Copy your public key
cat ~/.ssh/id_rsa.pub

# Then add it to your NAS user account:
# 1. SSH into your NAS (using password if needed)
# 2. Create/edit ~/.ssh/authorized_keys
# 3. Paste your public key there
```

**Option B: Use password authentication temporarily**
```bash
# Edit ~/.ssh/config and temporarily add:
Host mynas
  # ... existing config ...
  PreferredAuthentications password,publickey
```

### 2. Test the Connection

```bash
# Test basic connection
ssh mynas

# Test with a command
ssh mynas 'echo "Hello from NAS!"'
```

### 3. Use Cursor Functions

In Cursor, you can now use these functions:

- **`mynas`** - Opens SSH terminal to your NAS
- **`mynas-sftp`** - Opens SFTP for file transfers
- **`mynas-rsync`** - Syncs your project to the NAS
- **`mynas-docker-logs`** - Views Docker container logs
- **`mynas-docker-status`** - Shows Docker container status
- **`mynas-restart-services`** - Restarts all services

### 4. Use Helper Scripts

```bash
# Connect to NAS
./scripts/mynas-connect.sh

# Execute a command on NAS
./scripts/mynas-connect.sh "docker ps"

# Sync files to NAS
./scripts/mynas-sync.sh up

# Sync files from NAS
./scripts/mynas-sync.sh down

# Check Docker status
./scripts/mynas-docker.sh status

# View logs
./scripts/mynas-docker.sh logs

# Restart services
./scripts/mynas-docker.sh restart
```

## 🚀 Quick Start

1. **Fix SSH authentication** (see step 1 above)
2. **Test connection**: `ssh mynas`
3. **Use in Cursor**: Type `mynas` in Cursor's command palette
4. **Sync your project**: `./scripts/mynas-sync.sh up`

## 🔍 Troubleshooting

### SSH Connection Issues
- Check if your public key is in the NAS user's `~/.ssh/authorized_keys`
- Verify the NAS user has proper permissions
- Check if SSH service is enabled on the NAS

### Permission Denied
- Ensure your SSH key has the correct permissions (600)
- Check if the NAS user account is active
- Verify the key format is correct

### Connection Timeout
- Check if the NAS IP address is correct
- Verify the port (22) is open
- Check firewall settings

## 📁 File Structure

```
/Volumes/docker/fitapp/
├── .cursor/
│   └── functions.json          # Cursor function definitions
├── scripts/
│   ├── mynas-connect.sh        # SSH connection script
│   ├── mynas-sync.sh           # File sync script
│   └── mynas-docker.sh         # Docker management script
└── docs/deployment/NAS_SSH_SETUP.md  # This guide
```

## 🎯 Next Steps

1. Complete the SSH key setup
2. Test the connection
3. Start using the `mynas` function in Cursor
4. Set up automated syncing if needed

Your Synology NAS is now ready for easy access through Cursor! 🎉
