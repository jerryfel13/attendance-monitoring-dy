# Force Railway Redeploy for CORS Fix

## Steps to Force Redeploy:

### 1. Add Environment Variable in Railway
- Go to Railway Dashboard
- Click on your project
- Go to "Variables" tab
- Add: `FRONTEND_URL=https://v0-attendance-system-design-eight.vercel.app`

### 2. Commit and Push Changes
```bash
git add .
git commit -m "Fix CORS configuration for Vercel frontend"
git push origin main
```

### 3. Force Redeploy (if needed)
- Go to Railway Dashboard
- Click "Deployments" tab
- Click "Deploy" button to force new deployment

### 4. Check Deployment Logs
- Monitor the deployment logs
- Look for CORS configuration messages
- Verify the server starts successfully

### 5. Test CORS
After deployment, test the health endpoint:
```
GET https://hospitable-essence.railway.app/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Attendance API is running",
  "cors": {
    "allowedOrigins": ["http://localhost:3000", "https://v0-attendance-system-design-eight.vercel.app", ...],
    "frontendUrl": "https://v0-attendance-system-design-eight.vercel.app"
  }
}
```

### 6. Test Frontend Connection
Once deployed, your frontend should be able to:
- Register users
- Login users
- Access all API endpoints

## Troubleshooting:
- If CORS still fails, check Railway logs for CORS messages
- Verify FRONTEND_URL is set correctly
- Ensure the deployment completed successfully 