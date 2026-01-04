# Script to fix commit 3b56a6e that contains hardcoded secrets
# This will use interactive rebase to edit the commit

Write-Host "This script will help fix commit 3b56a6e that contains hardcoded secrets" -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps:" -ForegroundColor Cyan
Write-Host "1. Start interactive rebase from commit before 3b56a6e" -ForegroundColor Gray
Write-Host "2. Mark commit 3b56a6e for editing" -ForegroundColor Gray
Write-Host "3. Fix docker-compose.yml to use environment variables" -ForegroundColor Gray
Write-Host "4. Amend the commit" -ForegroundColor Gray
Write-Host "5. Continue rebase" -ForegroundColor Gray
Write-Host ""

# Checkout the commit before the problematic one
$baseCommit = "09f38fa"
Write-Host "Starting interactive rebase from $baseCommit..." -ForegroundColor Cyan
Write-Host ""
Write-Host "When the editor opens, change 'pick' to 'edit' for commit 3b56a6e" -ForegroundColor Yellow
Write-Host "Then run the commands shown after the rebase starts" -ForegroundColor Yellow
Write-Host ""

# Note: We can't fully automate interactive rebase, so we'll provide instructions
Write-Host "Manual steps required:" -ForegroundColor Red
Write-Host "1. Run: git rebase -i $baseCommit" -ForegroundColor White
Write-Host "2. In the editor, change 'pick 3b56a6e' to 'edit 3b56a6e'" -ForegroundColor White
Write-Host "3. Save and close the editor" -ForegroundColor White
Write-Host "4. The rebase will stop at commit 3b56a6e" -ForegroundColor White
Write-Host "5. Fix docker-compose.yml (it should already be fixed in current state)" -ForegroundColor White
Write-Host "6. Run: git add docker-compose.yml" -ForegroundColor White
Write-Host "7. Run: git commit --amend --no-edit" -ForegroundColor White
Write-Host "8. Run: git rebase --continue" -ForegroundColor White
Write-Host ""

