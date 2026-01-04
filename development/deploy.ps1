# PowerShell Development Deployment Script
# This script starts the development environment with hot reload

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Development Deployment Script for FitApp" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Created .env file. Please edit it with your actual values." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "Error: .env.example not found. Please create .env manually." -ForegroundColor Red
        exit 1
    }
}

# Stop existing containers
Write-Host "Stopping existing development containers..." -ForegroundColor Cyan
docker-compose down

# Build and start containers
Write-Host "Building and starting development containers..." -ForegroundColor Cyan
Write-Host "(This may take a few minutes on first run)" -ForegroundColor Gray
docker-compose up -d --build

# Wait a moment for containers to start
Start-Sleep -Seconds 5

# Show status
Write-Host ""
Write-Host "Development Container Status:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "Development environment deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:5174" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Yellow
Write-Host "Chat:     http://localhost:8009" -ForegroundColor Yellow
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Gray
Write-Host "  docker-compose logs -f [service-name]" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop:" -ForegroundColor Gray
Write-Host "  docker-compose down" -ForegroundColor Gray
Write-Host ""
Write-Host "Changes to code will automatically reload!" -ForegroundColor Green

