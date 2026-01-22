#!/bin/bash
# Script to initialize MongoDB replica set
# Run this after MongoDB container is up and healthy

echo "Initializing MongoDB replica set..."

# Wait for MongoDB to be ready
until mongo --port 27017 --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
  echo "Waiting for MongoDB to be ready..."
  sleep 2
done

# Check if replica set is already initialized
if mongo --port 27017 --eval "rs.status()" --quiet > /dev/null 2>&1; then
  echo "Replica set already initialized"
  mongo --port 27017 --eval "rs.status().set" --quiet
else
  echo "Initializing replica set..."
  mongo --port 27017 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongoosedb:27017'}]})" --quiet
  echo "Replica set initialized. Waiting for it to become ready..."
  sleep 5
  mongo --port 27017 --eval "rs.status().set" --quiet
fi
