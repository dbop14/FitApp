# Verifying OAuth Credentials Are Loaded

## Quick Verification Steps

### 1. Check Environment Variables in Containers

**Backend:**
```bash
cd development
docker-compose exec backend env | grep GOOGLE
```

You should see:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=your_redirect_uri_here
```

**Frontend:**
```bash
docker-compose exec frontend env | grep VITE
```

You should see:
```
VITE_API_URL=your_api_url
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

### 2. Check Backend Logs

```bash
docker-compose logs backend | grep -i "google\|oauth\|client"
```

Look for:
- The Client ID being used (first 20 characters)
- Any errors about missing credentials
- OAuth redirect URLs

### 3. Restart Containers After Updating .env

**IMPORTANT:** After updating `.env` file, you MUST restart containers:

```bash
cd development
docker-compose down
docker-compose up -d
```

Or restart just the affected services:
```bash
docker-compose restart backend frontend
```

### 4. Rebuild Frontend if Environment Variables Changed

If you added new `VITE_*` environment variables, you may need to rebuild the frontend:

```bash
docker-compose up -d --build frontend
```

## Common Issues

### Issue: "deleted_client" error persists after updating credentials

**Possible causes:**
1. Containers not restarted after updating `.env`
2. Frontend using cached build with old credentials
3. Wrong credentials in `.env` file
4. Credentials not matching what's in Google Cloud Console

**Solution:**
```bash
# 1. Verify .env file has correct values
cat development/.env | grep GOOGLE

# 2. Stop and restart all containers
cd development
docker-compose down
docker-compose up -d

# 3. Rebuild frontend to pick up new VITE_* variables
docker-compose up -d --build frontend

# 4. Check logs
docker-compose logs backend | tail -20
```

### Issue: Backend shows "YOUR_CLIENT_ID" or "MISSING"

**Solution:**
- Check that `.env` file exists in `development/` directory
- Verify variable names match exactly (case-sensitive)
- Make sure there are no quotes around values in `.env`
- Restart backend container

### Issue: Frontend can't find VITE_GOOGLE_CLIENT_ID

**Solution:**
- Add `VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}` to frontend environment in docker-compose.yml
- Rebuild frontend container
- Check browser console for the actual value being used

## Debugging Commands

**Check what credentials backend is using:**
```bash
docker-compose exec backend node -e "console.log('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID?.substring(0,20) + '...'); console.log('Has Secret:', !!process.env.GOOGLE_CLIENT_SECRET);"
```

**Check backend OAuth route:**
```bash
curl http://localhost:3001/api/auth/google
# Should redirect to Google (not show error)
```

**View all environment variables:**
```bash
docker-compose exec backend env | sort
```

## Verification Checklist

- [ ] `.env` file exists in `development/` directory
- [ ] `GOOGLE_CLIENT_ID` is set in `.env`
- [ ] `GOOGLE_CLIENT_SECRET` is set in `.env`
- [ ] `GOOGLE_REDIRECT_URI` matches Google Cloud Console
- [ ] Containers restarted after updating `.env`
- [ ] Backend logs show correct Client ID (first 20 chars)
- [ ] No "MISSING" or "YOUR_CLIENT_ID" in logs
- [ ] Google Cloud Console has matching Client ID
- [ ] Redirect URI in Google Cloud Console matches `.env`

