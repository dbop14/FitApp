# Remote Repository Setup Guide

## What is a Remote Repository?

A remote repository is a copy of your Git repository hosted on a service like GitHub, GitLab, or Bitbucket. It provides:
- **Backup**: Your code is stored in the cloud
- **Collaboration**: Multiple people can work on the same project
- **Access**: Work from different computers
- **Deployment**: Many services can deploy directly from a remote repository

## Setting Up a Remote Repository

### Option 1: GitHub (Recommended)

1. **Create a GitHub account** (if you don't have one)
   - Go to https://github.com
   - Sign up for a free account

2. **Create a new repository**
   - Click the "+" icon in the top right
   - Select "New repository"
   - Name it: `fitapp` (or your preferred name)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
   - Choose Public or Private
   - Click "Create repository"

3. **Add the remote to your local repository**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/fitapp.git
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

4. **Push your branches and tags**
   ```bash
   # Push main branch
   git checkout main
   git push -u origin main
   
   # Push develop branch
   git checkout develop
   git push -u origin develop
   
   # Push all tags
   git push origin --tags
   ```

### Option 2: GitLab

1. **Create a GitLab account** (if you don't have one)
   - Go to https://gitlab.com
   - Sign up for a free account

2. **Create a new project**
   - Click "New project"
   - Choose "Create blank project"
   - Name it: `fitapp`
   - **DO NOT** initialize with README
   - Choose visibility level
   - Click "Create project"

3. **Add the remote**
   ```bash
   git remote add origin https://gitlab.com/YOUR_USERNAME/fitapp.git
   ```

4. **Push your branches and tags** (same as GitHub)

### Option 3: Bitbucket

1. **Create a Bitbucket account**
   - Go to https://bitbucket.org
   - Sign up for a free account

2. **Create a new repository**
   - Click "Create repository"
   - Name it: `fitapp`
   - Choose Private or Public
   - **DO NOT** initialize with README
   - Click "Create repository"

3. **Add the remote**
   ```bash
   git remote add origin https://bitbucket.org/YOUR_USERNAME/fitapp.git
   ```

4. **Push your branches and tags** (same as GitHub)

## Verify Remote Setup

After adding the remote, verify it's configured correctly:

```bash
# View configured remotes
git remote -v

# Should show:
# origin  https://github.com/YOUR_USERNAME/fitapp.git (fetch)
# origin  https://github.com/YOUR_USERNAME/fitapp.git (push)
```

## Authentication

### HTTPS (Easiest)
- GitHub/GitLab will prompt for username and password
- For GitHub, you'll need a Personal Access Token instead of password
- Generate token: GitHub Settings → Developer settings → Personal access tokens

### SSH (More Secure)
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to GitHub/GitLab: Settings → SSH Keys
3. Use SSH URL: `git@github.com:YOUR_USERNAME/fitapp.git`

## Daily Workflow with Remote

```bash
# Pull latest changes
git pull origin develop

# Push your changes
git push origin develop

# Create and push a feature branch
git checkout -b feature/new-feature
# ... make changes ...
git push -u origin feature/new-feature
```

## Current Status

Your local repository is ready to push. You have:
- ✅ `main` branch (tagged v1.0.0)
- ✅ `develop` branch
- ✅ All application code committed
- ✅ Configuration files committed
- ✅ Documentation committed

**Next step**: Create a repository on your chosen platform and run the commands above!

