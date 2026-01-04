#!/bin/bash

# Script to increase the system file watcher limit
# This fixes the ENOSPC error when running nodemon

echo "Current file watcher limit:"
cat /proc/sys/fs/inotify/max_user_watches

echo "Increasing file watcher limit to 524288..."
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

echo "New file watcher limit:"
cat /proc/sys/fs/inotify/max_user_watches

echo "File watcher limit increased successfully!"

