# Setting Up Your Remote Repository - Step by Step

## Quick Setup (Choose Your Platform)

### Option 1: GitHub (Most Popular) ⭐

#### Step 1: Create GitHub Account (if needed)
- Go to https://github.com
- Sign up for a free account

#### Step 2: Create New Repository
1. Click the **"+"** icon in the top right corner
2. Select **"New repository"**
3. Fill in:
   - **Repository name**: `fitapp` (or your preferred name)
   - **Description**: "Fitness challenge app with step tracking and leaderboards"
   - **Visibility**: Choose **Public** or **Private**
   - ⚠️ **IMPORTANT**: **DO NOT** check:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   (We already have these files!)
4. Click **"Create repository"**

#### Step 3: Copy the Repository URL
After creating, GitHub will show you the repository URL. It will look like:
```
https://github.com/YOUR_USERNAME/fitapp.git
```
**Copy this URL** - you'll need it in the next step.

#### Step 4: Add Remote and Push
Run these commands in your terminal:

```bash
cd O:\fitapp

# Add the remote (replace with your actual URL)
git remote add origin https://github.com/YOUR_USERNAME/fitapp.git

# Push main branch
git checkout main
git push -u origin main

# Push develop branch
git checkout develop
git push -u origin develop

# Push tags
git push origin --tags
```

**OR** use the helper script:
```bash
./setup-remote.sh https://github.com/YOUR_USERNAME/fitapp.git
```

---

### Option 2: GitLab

#### Step 1: Create GitLab Account
- Go to https://gitlab.com
- Sign up for a free account

#### Step 2: Create New Project
1. Click **"New project"**
2. Choose **"Create blank project"**
3. Fill in:
   - **Project name**: `fitapp`
   - **Project slug**: `fitapp` (auto-filled)
   - **Visibility**: Choose your preference
   - ⚠️ **DO NOT** initialize with README
4. Click **"Create project"**

#### Step 3: Copy Repository URL
Copy the HTTPS URL shown (e.g., `https://gitlab.com/YOUR_USERNAME/fitapp.git`)

#### Step 4: Add Remote and Push
Same commands as GitHub, just use your GitLab URL.

---

### Option 3: Bitbucket

#### Step 1: Create Bitbucket Account
- Go to https://bitbucket.org
- Sign up for a free account

#### Step 2: Create Repository
1. Click **"Create"** → **"Repository"**
2. Fill in:
   - **Repository name**: `fitapp`
   - **Access level**: Private or Public
   - ⚠️ **DO NOT** initialize with README
3. Click **"Create repository"**

#### Step 3: Copy Repository URL
Copy the HTTPS URL shown

#### Step 4: Add Remote and Push
Same commands as GitHub, just use your Bitbucket URL.

---

## Authentication

### HTTPS (Easiest - Recommended for First Time)

When you run `git push`, you'll be prompted for credentials:

**For GitHub:**
- Username: Your GitHub username
- Password: **Use a Personal Access Token** (not your password)
  - Generate token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  - Select scopes: `repo` (full control)
  - Copy the token and use it as your password

**For GitLab/Bitbucket:**
- Username: Your username
- Password: Your account password (or app password if 2FA is enabled)

### SSH (More Secure - For Later)

If you want to use SSH instead:
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add public key to your platform (Settings → SSH Keys)
3. Use SSH URL: `git@github.com:YOUR_USERNAME/fitapp.git`

---

## Verify Setup

After pushing, verify everything worked:

```bash
# Check remotes
git remote -v

# Should show:
# origin  https://github.com/YOUR_USERNAME/fitapp.git (fetch)
# origin  https://github.com/YOUR_USERNAME/fitapp.git (push)

# Check branches on remote
git branch -r

# Should show:
# origin/main
# origin/develop

# Check tags
git ls-remote --tags origin

# Should show v1.0.0
```

---

## Troubleshooting

### "Remote 'origin' already exists"
If you've already added a remote, update it:
```bash
git remote set-url origin <new-url>
```

### "Authentication failed"
- Make sure you're using the correct credentials
- For GitHub, use a Personal Access Token instead of password
- Check that 2FA isn't blocking access

### "Repository not found"
- Verify the repository URL is correct
- Make sure the repository exists on the platform
- Check that you have access permissions

### "Permission denied"
- Verify your username and password/token
- Check repository visibility settings
- Make sure you're the owner or have write access

---

## Next Steps After Setup

Once your remote is set up:

1. **Visit your repository** on GitHub/GitLab/Bitbucket
2. **Verify all files are there** - you should see all your code
3. **Start developing**:
   ```bash
   git checkout develop
   git checkout -b feature/my-new-feature
   # ... make changes ...
   git push -u origin feature/my-new-feature
   ```

4. **Daily workflow**:
   ```bash
   # Pull latest changes
   git pull origin develop
   
   # Push your changes
   git push origin develop
   ```

---

## Need Help?

- See `docs/REMOTE_REPOSITORY_SETUP.md` for more details
- Check your platform's documentation:
  - GitHub: https://docs.github.com
  - GitLab: https://docs.gitlab.com
  - Bitbucket: https://support.atlassian.com/bitbucket-cloud

