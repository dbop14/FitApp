# PowerShell script to create the fitness_motivator bot user in production Synapse

Write-Host "🤖 Creating Fitness Bot User in Production Synapse" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file with BOT_PASSWORD set" -ForegroundColor Yellow
    exit 1
}

# Read .env file
$envContent = Get-Content ".env" | Where-Object { $_ -match '^\s*[^#]' }
foreach ($line in $envContent) {
    if ($line -match '^\s*([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$BOT_USERNAME = if ($env:BOT_USERNAME) { $env:BOT_USERNAME } else { "fitness_motivator" }
$BOT_PASSWORD = $env:BOT_PASSWORD

if (-not $BOT_PASSWORD) {
    Write-Host "❌ Error: BOT_PASSWORD not set in .env file!" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Bot User Details:" -ForegroundColor Cyan
Write-Host "   Username: $BOT_USERNAME" -ForegroundColor White
Write-Host "   Password: [from .env]" -ForegroundColor White
Write-Host ""

# Check if Synapse container is running
$synapseRunning = docker ps --format "{{.Names}}" | Select-String "fitapp-prod-synapse"
if (-not $synapseRunning) {
    Write-Host "❌ Error: Synapse container (fitapp-prod-synapse) is not running!" -ForegroundColor Red
    Write-Host "   Please start it first: docker-compose up -d synapse" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Synapse container is running" -ForegroundColor Green

# Wait for Synapse to be ready
Write-Host "⏳ Waiting for Synapse to be ready..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    $result = docker exec fitapp-prod-synapse curl -s http://localhost:8008/_matrix/client/versions 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Synapse is ready" -ForegroundColor Green
        $ready = $true
        break
    }
    Write-Host "   Attempt $i/30..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Host "❌ Synapse is not responding after 30 seconds" -ForegroundColor Red
    exit 1
}

# Create bot user using interactive command
Write-Host ""
Write-Host "👤 Creating bot user: $BOT_USERNAME" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  This will run interactively. Please enter:" -ForegroundColor Yellow
Write-Host "   - Username: $BOT_USERNAME" -ForegroundColor White
Write-Host "   - Password: [your BOT_PASSWORD from .env]" -ForegroundColor White
Write-Host "   - Make admin: no" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to continue..." -ForegroundColor Yellow
$null = Read-Host

# Run the registration command
Write-Host "Running registration command..." -ForegroundColor Cyan
docker exec -it fitapp-prod-synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Bot user created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Restarting bot container..." -ForegroundColor Cyan
    docker-compose restart fitness-bot
    Write-Host ""
    Write-Host "✅ Done! The bot should now be able to connect." -ForegroundColor Green
    Write-Host "📝 Check bot logs: docker-compose logs -f fitness-bot" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "⚠️  Registration may have failed or user already exists" -ForegroundColor Yellow
    Write-Host "📝 Check bot logs to verify connection: docker-compose logs -f fitness-bot" -ForegroundColor Cyan
}

