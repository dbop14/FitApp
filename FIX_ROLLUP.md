# Fix Rollup Error in Docker Container

## Quick Fix (Inside Container)

1. **Enter the frontend container:**
   ```bash
   docker exec -it fitapp-frontend sh
   ```

2. **Inside the container, run:**
   ```bash
   cd /app
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Exit the container:**
   ```bash
   exit
   ```

4. **Restart the container:**
   ```bash
   docker restart fitapp-frontend
   ```

## Alternative: Rebuild Container (Clean Slate)

If the above doesn't work, rebuild the container:

```bash
cd /Volumes/docker/fitapp
docker-compose stop frontend
docker-compose rm -f frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Why This Happens

This is a known npm bug with optional dependencies in Alpine Linux (musl). The `@rollup/rollup-linux-x64-musl` package should be installed automatically but sometimes npm fails to install optional dependencies correctly.

## Permanent Fix (Optional)

If this keeps happening, you can update the Dockerfile to explicitly install the missing package:

```dockerfile
RUN npm install --silent --no-audit --no-fund && \
    npm install @rollup/rollup-linux-x64-musl --save-optional || true
```

