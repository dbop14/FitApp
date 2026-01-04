# Fix "vite: not found" Error

## Quick Fix - Install Dependencies in Container

Run this command to install all dependencies (including vite) inside the running container:

```bash
docker exec -it fitapp-frontend sh -c "cd /app && npm install"
```

Then restart the container:

```bash
docker restart fitapp-frontend
```

## Better Solution - Add node_modules Volume (Prevents Future Issues)

Update `docker-compose.yml` to use a named volume for node_modules (like the backend does):

```yaml
frontend:
  # ... existing config ...
  volumes:
    - ./fitapp-frontend:/app
    - node_modules_frontend:/app/node_modules  # Add this line
```

And add to the volumes section:
```yaml
volumes:
  # ... existing volumes ...
  node_modules_frontend:  # Add this
```

Then rebuild:
```bash
docker-compose stop frontend
docker-compose build frontend
docker-compose up -d frontend
```

## Why This Happens

The volume mount `./fitapp-frontend:/app` overwrites the container's `/app` directory, including `node_modules` that were installed during the Docker build. The local directory doesn't have `node_modules`, so vite isn't found.

