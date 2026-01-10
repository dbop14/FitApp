# This script forces a clean rebuild and restart of the frontend service
# to ensure the latest code is served.

Write-Host "--- Force Refreshing Frontend ---" -ForegroundColor Cyan

Write-Host "Step 1: Stopping all running services..." -ForegroundColor Yellow
docker-compose down
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error stopping services. Please check your Docker setup." -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Forcing a clean rebuild of the frontend container (this may take a moment)..." -ForegroundColor Yellow
docker-compose build --no-cache frontend
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building frontend. Please check your Docker setup and Dockerfile." -ForegroundColor Red
    exit 1
}

Write-Host "Step 3: Starting all services..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error starting services." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Frontend has been refreshed!" -ForegroundColor Green
Write-Host "Please clear your browser cache thoroughly to see the changes."
