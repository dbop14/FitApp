# Quick Start Guide - Development Workflow

## Initial Setup (One-Time)

✅ **Completed:**
- Git repository initialized
- Branching strategy set up (`main` and `develop` branches)
- `.gitignore` configured
- `.env.example` template created
- Version v1.0.0 tagged

## Daily Development Workflow

### Starting Work on a New Feature

```bash
# 1. Switch to develop and update
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/my-new-feature

# 3. Make changes, commit frequently
git add .
git commit -m "Add feature: description"

# 4. Push to remote (if using remote repository)
git push -u origin feature/my-new-feature
```

### Finishing a Feature

```bash
# 1. Ensure all changes are committed
git status

# 2. Switch to develop and merge
git checkout develop
git merge feature/my-new-feature

# 3. Push develop
git push origin develop

# 4. Delete feature branch
git branch -d feature/my-new-feature
```

### Deploying to Production

```bash
# 1. Create release branch
git checkout develop
git checkout -b release/v1.1.0

# 2. Test, update version numbers, CHANGELOG.md

# 3. Merge to main
git checkout main
git merge release/v1.1.0
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main --tags

# 4. Merge back to develop
git checkout develop
git merge release/v1.1.0
git push origin develop
```

## Current Branch Status

- **Current Branch**: `develop` (for ongoing development)
- **Production Branch**: `main` (tagged as v1.0.0)
- **Next Steps**: Create feature branches from `develop` for new work

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your actual values
3. Never commit `.env` files

## Need Help?

- See `docs/DEVELOPMENT_WORKFLOW.md` for detailed workflow
- See `CHANGELOG.md` for version history

