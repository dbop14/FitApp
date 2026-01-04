# Test Production Deployment Script
# This script helps verify your production environment setup

Write-Host "Testing Production Environment Setup..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file first:" -ForegroundColor Yellow
    Write-Host "   Copy .env.example to .env and fill in values" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ .env file found" -ForegroundColor Green

# Check critical environment variables
$envContent = Get-Content ".env" -Raw
$errors = @()

if ($envContent -match "your_production_bot_password_here" -or $envContent -notmatch "BOT_PASSWORD=.*[^here]") {
    Write-Host "❌ ERROR: BOT_PASSWORD not set correctly" -ForegroundColor Red
    $errors += "BOT_PASSWORD"
} else {
    Write-Host "✅ BOT_PASSWORD is set" -ForegroundColor Green
}

if ($envContent -match "your_google_client_id") {
    Write-Host "❌ ERROR: GOOGLE_CLIENT_ID not set" -ForegroundColor Red
    $errors += "GOOGLE_CLIENT_ID"
} else {
    Write-Host "✅ GOOGLE_CLIENT_ID is set" -ForegroundColor Green
}

if ($envContent -match "your_google_client_secret") {
    Write-Host "❌ ERROR: GOOGLE_CLIENT_SECRET not set" -ForegroundColor Red
    $errors += "GOOGLE_CLIENT_SECRET"
} else {
    Write-Host "✅ GOOGLE_CLIENT_SECRET is set" -ForegroundColor Green
}

if ($envContent -match "your_vapid_public_key") {
    Write-Host "⚠️  Warning: VAPID keys may not be set" -ForegroundColor Yellow
} else {
    Write-Host "✅ VAPID keys appear to be set" -ForegroundColor Green
}

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Critical errors found. Please fix before deploying:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "   - $error" -ForegroundColor Red
    }
    exit 1
}

# Check Docker
Write-Host ""
Write-Host "Checking Docker..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker is installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check Docker Compose
Write-Host ""
Write-Host "Checking Docker Compose..." -ForegroundColor Cyan
try {
    $composeVersion = docker-compose --version
    Write-Host "✅ Docker Compose is installed: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if ports are available
Write-Host ""
Write-Host "Checking if ports are available..." -ForegroundColor Cyan
$ports = @(3000, 5173, 8008, 27017)
$portsInUse = @()

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "⚠️  Port $port is in use" -ForegroundColor Yellow
        $portsInUse += $port
    } else {
        Write-Host "✅ Port $port is available" -ForegroundColor Green
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Some ports are in use. You may need to stop other containers:" -ForegroundColor Yellow
    Write-Host "   docker-compose down (in other directories)" -ForegroundColor Yellow
}

# Check GitHub access
Write-Host ""
Write-Host "Checking GitHub repository access..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://github.com/dbop14/FitApp" -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ GitHub repository is accessible" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: Could not verify GitHub repository access" -ForegroundColor Yellow
    Write-Host "   Make sure you can access: https://github.com/dbop14/FitApp" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Setup check complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Ready to deploy? Run:" -ForegroundColor Cyan
Write-Host "   .\deploy.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANT: Production deployment pulls from GitHub main branch" -ForegroundColor Yellow
Write-Host "   Make sure main branch is up to date before deploying!" -ForegroundColor Yellow

