# PowerShell script to set up remote repository for FitApp
# Usage: .\setup-remote.ps1 <repository-url>

param(
    [Parameter(Mandatory=$true)]
    [string]$RepositoryUrl
)

Write-Host "🚀 Setting up remote repository..." -ForegroundColor Cyan
Write-Host "Repository URL: $RepositoryUrl" -ForegroundColor Yellow
Write-Host ""

# Check if remote already exists
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "⚠️  Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $update = Read-Host "Do you want to update it? (y/n)"
    if ($update -eq 'y' -or $update -eq 'Y') {
        git remote set-url origin $RepositoryUrl
        Write-Host "✅ Remote URL updated" -ForegroundColor Green
    } else {
        Write-Host "❌ Cancelled. Remote not updated." -ForegroundColor Red
        exit 1
    }
} else {
    # Add remote
    Write-Host "📡 Adding remote 'origin'..." -ForegroundColor Cyan
    git remote add origin $RepositoryUrl
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to add remote" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Remote added successfully!" -ForegroundColor Green
}

# Verify remote
Write-Host ""
Write-Host "📋 Current remotes:" -ForegroundColor Cyan
git remote -v
Write-Host ""

# Push main branch
Write-Host "📤 Pushing main branch..." -ForegroundColor Cyan
git checkout main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to checkout main branch" -ForegroundColor Red
    exit 1
}

git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to push main branch" -ForegroundColor Yellow
    Write-Host "You may need to authenticate or check your repository URL" -ForegroundColor Yellow
    exit 1
}

# Push develop branch
Write-Host "📤 Pushing develop branch..." -ForegroundColor Cyan
git checkout develop
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to checkout develop branch" -ForegroundColor Red
    exit 1
}

git push -u origin develop
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to push develop branch" -ForegroundColor Yellow
    exit 1
}

# Push tags
Write-Host "📤 Pushing tags..." -ForegroundColor Cyan
git push origin --tags
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to push tags" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Success! Remote repository set up complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your repository is now available at: $RepositoryUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Current branch: develop" -ForegroundColor Yellow
Write-Host "To switch branches: git checkout branch-name" -ForegroundColor Gray
Write-Host "To pull latest: git pull origin develop" -ForegroundColor Gray
Write-Host "To push changes: git push origin develop" -ForegroundColor Gray

