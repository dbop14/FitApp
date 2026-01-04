#!/bin/bash
# Script to set up remote repository for FitApp
# Usage: ./setup-remote.sh <repository-url>

if [ -z "$1" ]; then
    echo "❌ Error: Repository URL required"
    echo ""
    echo "Usage: ./setup-remote.sh <repository-url>"
    echo ""
    echo "Examples:"
    echo "  ./setup-remote.sh https://github.com/yourusername/fitapp.git"
    echo "  ./setup-remote.sh https://gitlab.com/yourusername/fitapp.git"
    echo ""
    echo "First, create a repository on GitHub/GitLab/Bitbucket, then run this script with the URL."
    exit 1
fi

REPO_URL=$1

echo "🚀 Setting up remote repository..."
echo "Repository URL: $REPO_URL"
echo ""

# Add remote
echo "📡 Adding remote 'origin'..."
git remote add origin "$REPO_URL"

if [ $? -ne 0 ]; then
    echo "❌ Failed to add remote. It may already exist."
    echo "To update existing remote, run:"
    echo "  git remote set-url origin $REPO_URL"
    exit 1
fi

# Verify remote
echo "✅ Remote added successfully!"
echo ""
echo "📋 Current remotes:"
git remote -v
echo ""

# Push main branch
echo "📤 Pushing main branch..."
git checkout main
git push -u origin main

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Failed to push main branch"
    echo "You may need to authenticate or check your repository URL"
    exit 1
fi

# Push develop branch
echo "📤 Pushing develop branch..."
git checkout develop
git push -u origin develop

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Failed to push develop branch"
    exit 1
fi

# Push tags
echo "📤 Pushing tags..."
git push origin --tags

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Failed to push tags"
    exit 1
fi

echo ""
echo "✅ Success! Remote repository set up complete!"
echo ""
echo "Your repository is now available at: $REPO_URL"
echo ""
echo "Current branch: develop"
echo "To switch branches: git checkout <branch-name>"
echo "To pull latest: git pull origin develop"
echo "To push changes: git push origin develop"

