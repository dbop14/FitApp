# FitApp Development Workflow Guide

This document outlines the Git workflow and branching strategy for FitApp development.

## Branch Structure

```
main (production)
  └── develop (integration branch)
       ├── feature/new-feature-name
       ├── feature/another-feature
       └── hotfix/critical-bug-fix
```

## Branch Purposes

### `main` (Production)
- **Purpose**: Contains only production-ready, tested code
- **Protection**: Should be protected and require pull requests
- **Deployment**: Automatically deployed to production (if CI/CD is set up)
- **Merges**: Only from `develop` (releases) or `hotfix/*` branches

### `develop` (Development Integration)
- **Purpose**: Integration branch for all new features
- **Status**: Should always be in a deployable state
- **Merges**: Receives all feature branches and hotfixes

### `feature/*` (New Features)
- **Purpose**: Development of new features
- **Naming**: `feature/user-profile-enhancement`, `feature/leaderboard-improvements`
- **Lifecycle**: Created from `develop`, merged back to `develop`, then deleted

### `hotfix/*` (Critical Production Fixes)
- **Purpose**: Urgent fixes for production issues
- **Naming**: `hotfix/critical-bug`, `hotfix/security-patch`
- **Lifecycle**: Created from `main`, merged to both `main` and `develop`

### `release/*` (Release Preparation)
- **Purpose**: Preparing a new version for release
- **Naming**: `release/v1.1.0`
- **Lifecycle**: Created from `develop`, merged to `main` and back to `develop`

## Workflow Processes

### Starting a New Feature

```bash
# 1. Ensure you're on develop and it's up to date
git checkout develop
git pull origin develop

# 2. Create a new feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit frequently
git add .
git commit -m "Add feature: description of changes"

# 4. Push the feature branch
git push -u origin feature/your-feature-name

# 5. Create a Pull Request to develop (if using GitHub/GitLab)
# OR merge locally:
git checkout develop
git merge feature/your-feature-name
git push origin develop

# 6. Delete the feature branch (after merge)
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Preparing a Release

```bash
# 1. Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v1.1.0

# 2. Update version numbers, CHANGELOG.md, etc.
# 3. Test thoroughly
# 4. Fix any bugs found during testing

# 5. Merge to main
git checkout main
git pull origin main
git merge release/v1.1.0
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin main --tags

# 6. Merge back to develop
git checkout develop
git merge release/v1.1.0
git push origin develop

# 7. Delete release branch
git branch -d release/v1.1.0
git push origin --delete release/v1.1.0
```

### Creating a Hotfix

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix the critical bug
git add .
git commit -m "Fix: description of the fix"

# 3. Merge to main and tag
git checkout main
git merge hotfix/critical-bug
git tag -a v1.0.1 -m "Hotfix: critical bug description"
git push origin main --tags

# 4. Merge to develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop

# 5. Delete hotfix branch
git branch -d hotfix/critical-bug
git push origin --delete hotfix/critical-bug
```

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
Add feature: User profile picture upload
Fix: Leaderboard calculation error
Update: Improve error handling in API routes
Refactor: Simplify challenge creation logic
Docs: Update deployment instructions
```

## Version Tagging

We use [Semantic Versioning](https://semver.org/):
- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.1.0): New features, backwards compatible
- **PATCH** (v1.0.1): Bug fixes, backwards compatible

### Creating a Tag

```bash
# Annotated tag (recommended)
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tags to remote
git push origin v1.0.0

# Push all tags
git push origin --tags
```

### Viewing Tags

```bash
# List all tags
git tag -l

# View tag details
git show v1.0.0
```

## Pre-Deployment Checklist

Before merging to `main`:

- [ ] All code reviewed (if working in a team)
- [ ] All tests pass (if you have tests)
- [ ] No debug code or console.logs in production code
- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations tested (if any)
- [ ] Version numbers updated
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Docker images built and tested
- [ ] Manual testing completed

## Environment Management

### Development
- Use `.env` file (not committed to Git)
- Copy from `.env.example` and fill in values
- Use `NODE_ENV=development`

### Production
- Set environment variables in Docker Compose or deployment platform
- Use `NODE_ENV=production`
- Never commit production secrets

## Quick Reference Commands

```bash
# Check current branch
git branch

# View commit history
git log --oneline --graph --all

# View differences
git diff

# Stash changes (save for later)
git stash
git stash pop

# Undo last commit (keep changes)
git reset --soft HEAD~1

# View remote branches
git branch -r

# Fetch latest from remote
git fetch origin

# Update current branch
git pull origin develop
```

## Troubleshooting

### Merge Conflicts
```bash
# If you have conflicts during merge
git status  # See conflicted files
# Edit files to resolve conflicts
git add <resolved-files>
git commit
```

### Undo Last Commit
```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes, undo commit
git reset --hard HEAD~1
```

### Switch Branches with Uncommitted Changes
```bash
# Save changes temporarily
git stash
git checkout other-branch
# Later, restore changes
git stash pop
```

## Best Practices

1. **Commit Often**: Small, logical commits are easier to review and revert
2. **Write Clear Messages**: Future you (and your team) will thank you
3. **Keep develop Stable**: Only merge tested, working code
4. **Use Feature Branches**: Never commit directly to `main` or `develop`
5. **Test Before Merging**: Always test your changes before merging
6. **Update Documentation**: Keep docs in sync with code changes
7. **Tag Releases**: Always tag production releases for easy rollback

