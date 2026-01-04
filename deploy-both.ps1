# Deploy Both Production and Development Environments
# Run this script from the root directory

Write-Host "Deploying FitApp Production and Development Environments" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "production") -or -not (Test-Path "development")) {
    Write-Host "Error: production/ or development/ directory not found" -ForegroundColor Red
    Write-Host "Please run this script from the fitapp root directory" -ForegroundColor Yellow
    exit 1
}

# Deploy Production
Write-Host "Step 1: Deploying Production Environment..." -ForegroundColor Cyan
Write-Host "----------------------------------------------" -ForegroundColor Gray
Set-Location production

if (-not (Test-Path ".env")) {
    Write-Host "Warning: production/.env not found" -ForegroundColor Yellow
    Write-Host "Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Please edit production/.env with your values" -ForegroundColor Yellow
        Write-Host "Then run this script again" -ForegroundColor Yellow
        exit 1
    }
}

if (Test-Path "deploy.ps1") {
    .\deploy.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Production deployment failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: deploy.ps1 not found in production/" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "Production deployment complete!" -ForegroundColor Green
Write-Host ""

# Wait a moment
Start-Sleep -Seconds 5

# Deploy Development
Write-Host "Step 2: Deploying Development Environment..." -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Gray
Set-Location development

if (-not (Test-Path ".env")) {
    Write-Host "Warning: development/.env not found" -ForegroundColor Yellow
    Write-Host "Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Please edit development/.env with your values" -ForegroundColor Yellow
        Write-Host "Then run this script again" -ForegroundColor Yellow
        exit 1
    }
}

if (Test-Path "deploy.ps1") {
    .\deploy.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Development deployment failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: deploy.ps1 not found in development/" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "Both environments deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Production:" -ForegroundColor Yellow
Write-Host "    Frontend: http://localhost:5173 (https://fitapp.herringm.com)" -ForegroundColor Gray
Write-Host "    Backend:  http://localhost:3000 (https://fitappbackend.herringm.com)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Development:" -ForegroundColor Yellow
Write-Host "    Frontend: http://localhost:5174 (https://fitappdev.herringm.com)" -ForegroundColor Gray
Write-Host "    Backend:  http://localhost:3001 (https://fitappbackenddev.herringm.com)" -ForegroundColor Gray
Write-Host ""
Write-Host "Both environments are running and can be used simultaneously!" -ForegroundColor Green

