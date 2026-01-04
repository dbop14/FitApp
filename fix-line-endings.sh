#!/bin/bash
# Fix line endings for shell scripts on Linux/Unix
# Run this on your Synology NAS

echo "Fixing line endings in shell scripts..."

# Find and fix all .sh files
find . -name "*.sh" -type f -exec sed -i 's/\r$//' {} \;

echo "✅ Line endings fixed!"
echo ""
echo "You can now run:"
echo "  ./deploy-both.sh"
echo "  or"
echo "  cd production && ./deploy.sh"
echo "  cd development && ./deploy.sh"

