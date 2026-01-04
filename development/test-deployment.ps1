# Test Deployment Script
# This script helps verify your development environment setup

Write-Host "Testing Development Environment Setup..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file first:" -ForegroundColor Yellow
    Write-Host "   Copy .env.example to .env and fill in values" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ .env file found" -ForegroundColor Green

# Check if BOT_PASSWORD is set
$envContent = Get-Content ".env" -Raw
if ($envContent -match "your_bot_password_here" -or $envContent -notmatch "BOT_PASSWORD=.*[^here]") {
    Write-Host "⚠️  Warning: BOT_PASSWORD may not be set correctly" -ForegroundColor Yellow
    Write-Host "   Please edit .env and set BOT_PASSWORD" -ForegroundColor Yellow
} else {
    Write-Host "✅ BOT_PASSWORD appears to be set" -ForegroundColor Green
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

# Check if required directories exist
Write-Host ""
Write-Host "Checking source directories..." -ForegroundColor Cyan
$requiredDirs = @("../fitapp-backend", "../fitapp-frontend", "../fitapp-bot")
$allExist = $true

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Host "✅ Found: $dir" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $dir" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host ""
    Write-Host "❌ Some required directories are missing" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the development/ directory" -ForegroundColor Yellow
    exit 1
}

# Check if ports are available
Write-Host ""
Write-Host "Checking if ports are available..." -ForegroundColor Cyan
$ports = @(3001, 5174, 8009, 27017)
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
    Write-Host "   Or modify ports in docker-compose.yml" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Setup check complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Ready to deploy? Run:" -ForegroundColor Cyan
Write-Host "   .\deploy.ps1" -ForegroundColor Yellow

