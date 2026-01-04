# PowerShell Development Deployment Script
# This script starts the development environment with hot reload

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# #region agent log
$logPath = "o:\fitapp\.cursor\debug.log"
$logEntry = @{
    sessionId = "debug-session"
    runId = "run1"
    hypothesisId = "A"
    location = "deploy.ps1:7"
    message = "Script started"
    data = @{
        scriptPath = $scriptPath
        currentDir = (Get-Location).Path
    }
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $logEntry
# #endregion

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

# #region agent log
$logEntry = @{
    sessionId = "debug-session"
    runId = "run1"
    hypothesisId = "B"
    location = "deploy.ps1:24"
    message = "Checking docker-compose.yml existence"
    data = @{
        composeExists = (Test-Path "docker-compose.yml")
        composePath = (Resolve-Path "docker-compose.yml" -ErrorAction SilentlyContinue).Path
    }
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $logEntry
# #endregion

# Stop existing containers
Write-Host "Stopping existing development containers..." -ForegroundColor Cyan
docker-compose down

# #region agent log
$synapseVolumeName = "development_synapse_data_dev"
$volumeList = docker volume ls --format "{{.Name}}" | Out-String
$synapseVolumeExists = $volumeList -match $synapseVolumeName
$logEntry = @{
    sessionId = "debug-session"
    runId = "run1"
    hypothesisId = "C"
    location = "deploy.ps1:30"
    message = "Checking synapse_data_dev volume existence"
    data = @{
        volumeList = $volumeList
        synapseVolumeExists = $synapseVolumeExists
        volumeName = $synapseVolumeName
    }
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $logEntry
# #endregion

# #region agent log
$logEntry = @{
    sessionId = "debug-session"
    runId = "run1"
    hypothesisId = "D"
    location = "deploy.ps1:35"
    message = "Checking if homeserver.yaml exists in volume"
    data = @{
        checkAttempt = "before_init"
        volumeName = $synapseVolumeName
    }
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $logEntry
# #endregion

# Check if Synapse needs initialization
$needsInit = $true
if ($synapseVolumeExists) {
    # #region agent log
    $logEntry = @{
        sessionId = "debug-session"
        runId = "run1"
        hypothesisId = "E"
        location = "deploy.ps1:45"
        message = "Synapse volume found, checking config file"
        data = @{
            volumes = $synapseVolumeName
        }
        timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    
    # Try to check if homeserver.yaml exists in the volume
    $checkResult = docker run --rm -v "${synapseVolumeName}:/data" matrixdotorg/synapse:latest test -f /data/homeserver.yaml 2>&1
    if ($LASTEXITCODE -eq 0) {
        $needsInit = $false
        # #region agent log
        $logEntry = @{
            sessionId = "debug-session"
            runId = "run1"
            hypothesisId = "E"
            location = "deploy.ps1:55"
            message = "homeserver.yaml exists, no init needed"
            data = @{
                checkResult = $checkResult
            }
            timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Compress
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
    } else {
        # #region agent log
        $logEntry = @{
            sessionId = "debug-session"
            runId = "run1"
            hypothesisId = "A"
            location = "deploy.ps1:60"
            message = "homeserver.yaml missing, init needed"
            data = @{
                checkResult = $checkResult
                exitCode = $LASTEXITCODE
            }
            timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Compress
        Add-Content -Path $logPath -Value $logEntry
        # #endregion
    }
} else {
    # #region agent log
    $logEntry = @{
        sessionId = "debug-session"
        runId = "run1"
        hypothesisId = "A"
        location = "deploy.ps1:70"
        message = "No synapse volume found, init needed"
        data = @{
            expectedVolume = $synapseVolumeName
        }
        timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
}

if ($needsInit) {
    Write-Host "Initializing Synapse server..." -ForegroundColor Cyan
    # #region agent log
    $logEntry = @{
        sessionId = "debug-session"
        runId = "run1"
        hypothesisId = "B"
        location = "deploy.ps1:78"
        message = "Starting Synapse initialization"
        data = @{
            serverName = "fitapp.local"
            volumeName = $synapseVolumeName
        }
        timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    
    $initResult = docker run --rm `
        -v "${synapseVolumeName}:/data" `
        -e SYNAPSE_SERVER_NAME=fitapp.local `
        -e SYNAPSE_REPORT_STATS=no `
        matrixdotorg/synapse:latest generate 2>&1
    
    # #region agent log
    $logEntry = @{
        sessionId = "debug-session"
        runId = "run1"
        hypothesisId = "B"
        location = "deploy.ps1:90"
        message = "Synapse initialization completed"
        data = @{
            exitCode = $LASTEXITCODE
            initOutput = $initResult
        }
        timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress
    Add-Content -Path $logPath -Value $logEntry
    # #endregion
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Synapse server initialized successfully" -ForegroundColor Green
    } else {
        Write-Host "Warning: Synapse initialization may have failed" -ForegroundColor Yellow
        Write-Host $initResult
    }
}

# Build and start containers
Write-Host "Building and starting development containers..." -ForegroundColor Cyan
Write-Host "(This may take a few minutes on first run)" -ForegroundColor Gray

# #region agent log
$logEntry = @{
    sessionId = "debug-session"
    runId = "run1"
    hypothesisId = "C"
    location = "deploy.ps1:110"
    message = "Starting docker-compose up"
    data = @{
        beforeStart = "true"
    }
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $logEntry
# #endregion

docker-compose up -d --build

# #region agent log
$logEntry = @{
    sessionId = "debug-session"
    runId = "run1"
    hypothesisId = "C"
    location = "deploy.ps1:115"
    message = "docker-compose up completed"
    data = @{
        exitCode = $LASTEXITCODE
    }
    timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $logEntry
# #endregion

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

