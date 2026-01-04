# PowerShell Production Deployment Script
# This script deploys the production environment from GitHub main branch

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Production Deployment Script for FitApp" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Created .env file. Please edit it with your actual values." -ForegroundColor Green
        Write-Host ""
        Write-Host "ERROR: You must configure .env before deploying to production!" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Error: .env.example not found. Please create .env manually." -ForegroundColor Red
        exit 1
    }
}

# Verify critical environment variables
Write-Host "Verifying environment variables..." -ForegroundColor Cyan
$envContent = Get-Content ".env" -Raw

if ($envContent -match "your_production_bot_password_here" -or $envContent -notmatch "BOT_PASSWORD=.*[^here]") {
    Write-Host "ERROR: BOT_PASSWORD not set in .env file!" -ForegroundColor Red
    Write-Host "Please edit .env and set BOT_PASSWORD" -ForegroundColor Yellow
    exit 1
}

if ($envContent -match "your_google_client_id") {
    Write-Host "ERROR: GOOGLE_CLIENT_ID not set in .env file!" -ForegroundColor Red
    exit 1
}

Write-Host "Environment variables verified" -ForegroundColor Green
Write-Host ""

# Stop existing containers
Write-Host "Stopping existing production containers..." -ForegroundColor Cyan
docker-compose down

# Check if Synapse needs initialization
$synapseVolumeName = "production_synapse_data_prod"
$volumeList = docker volume ls --format "{{.Name}}" | Out-String
$synapseVolumeExists = $volumeList -match $synapseVolumeName

$needsInit = $true
if ($synapseVolumeExists) {
    # Try to check if homeserver.yaml exists in the volume
    docker run --rm -v "${synapseVolumeName}:/data" matrixdotorg/synapse:latest test -f /data/homeserver.yaml 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $needsInit = $false
    }
}

if ($needsInit) {
    Write-Host "Initializing Synapse server..." -ForegroundColor Cyan
    $initResult = docker run --rm `
        -v "${synapseVolumeName}:/data" `
        -e SYNAPSE_SERVER_NAME=fitapp.local `
        -e SYNAPSE_REPORT_STATS=no `
        matrixdotorg/synapse:latest generate 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Synapse server initialized successfully" -ForegroundColor Green
    } else {
        Write-Host "Warning: Synapse initialization may have failed" -ForegroundColor Yellow
        Write-Host $initResult
    }
}

# Build images from GitHub main branch
Write-Host "Building images from GitHub main branch..." -ForegroundColor Cyan
Write-Host "This may take several minutes..." -ForegroundColor Gray
docker-compose build --no-cache --build-arg GIT_BRANCH=main

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Start containers
Write-Host "Starting production containers..." -ForegroundColor Cyan
docker-compose up -d

# Wait for services to start
Write-Host "Waiting for services to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Wait for Synapse to be ready
Write-Host "Waiting for Synapse server to be ready..." -ForegroundColor Cyan
$synapseReady = $false
for ($i = 1; $i -le 30; $i++) {
    docker exec fitapp-prod-synapse curl -s http://localhost:8008/_matrix/client/versions 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $synapseReady = $true
        Write-Host "Synapse server is ready" -ForegroundColor Green
        break
    }
    if ($i -eq 30) {
        Write-Host "Synapse server is not responding after 30 seconds" -ForegroundColor Yellow
        Write-Host "Bot user creation will be skipped. You may need to create it manually." -ForegroundColor Yellow
        break
    }
    Start-Sleep -Seconds 2
}

# Create bot user if Synapse is ready
if ($synapseReady) {
    Write-Host ""
    Write-Host "Checking if bot user exists..." -ForegroundColor Cyan
    
    # Get bot credentials from .env
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "BOT_USERNAME=(\S+)") {
        $botUsername = $matches[1]
    } else {
        $botUsername = "fitness_motivator"
    }
    
    Write-Host "Bot user creation requires manual interaction on Windows." -ForegroundColor Yellow
    Write-Host "Please create the bot user manually:" -ForegroundColor Cyan
    Write-Host "  docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008" -ForegroundColor Gray
    Write-Host "  Username: $botUsername" -ForegroundColor Gray
    Write-Host "  Password: [your BOT_PASSWORD from .env]" -ForegroundColor Gray
    Write-Host "  Make admin: no" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternatively, you can use the setup-bot-user.sh script from the root directory" -ForegroundColor Yellow
    Write-Host "if you have WSL or a Linux environment available." -ForegroundColor Yellow
}

# Show status
Write-Host ""
Write-Host "Production Container Status:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "Production deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "Chat:     http://localhost:8008" -ForegroundColor Yellow
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Gray
Write-Host "  docker-compose logs -f [service-name]" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop:" -ForegroundColor Gray
Write-Host "  docker-compose down" -ForegroundColor Gray

