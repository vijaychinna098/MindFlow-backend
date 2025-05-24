# MindFlow Backend Deployment Guide

This guide explains how to deploy the MindFlow backend to Render.com.

## Deployment Steps for Render.com

1. **Create a New Web Service**
   - Log in to your Render.com dashboard
   - Click "New +" and select "Web Service"

2. **Connect Your Repository**
   - Select the GitHub repository that contains your MindFlow backend code
   - Make sure you're selecting the repository that contains the `backend` folder

3. **Configure the Service**
   - **Name**: mindflow-backend (or your preferred name)
   - **Root Directory**: backend
   - **Environment**: Node.js
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Add Environment Variables**
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Secret for JWT tokens
   - `EMAIL_USER` - Email user for notifications
   - `EMAIL_PASSWORD` - Email password
   - `BASE_URL` - Your deployed service URL (important for profile images)
   - `NODE_ENV` - Set to "production"

5. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your application

## Troubleshooting

If you encounter the "Cannot find module '/opt/render/project/src/server.js'" error:
   
1. **Make sure you've set the Root Directory correctly**
   - It should be set to "backend" to tell Render to look in that folder

2. **Check your package.json**
   - The "main" field should be set to "index.js"
   - The "start" script should be "node index.js" or "node --max-old-space-size=4096 index.js"

3. **Verify your index.js file**
   - The backend folder should contain an index.js file that requires the server.js file

## Enhanced Profile Synchronization

The backend includes an enhanced profile synchronization system that ensures user profile data (name, profile image) remains consistent across devices. This system is critical for users who log in with the same email on different devices.

### Key Features

1. **Conflict Resolution**: Automatically resolves conflicts when user data is changed on multiple devices
2. **Profile Image Sync**: Ensures profile images are properly synchronized across devices
3. **Redundant Storage**: Multiple fallback mechanisms to prevent data loss
4. **Enhanced Login Sync**: Special sync process during login to ensure immediate consistency

### Important API Endpoints

- `/api/enhanced-sync/profile` - Main profile synchronization endpoint
- `/api/enhanced-sync/upload-profile-image` - Profile image upload endpoint
- `/api/enhanced-sync/force-profile-sync` - Force sync across all devices
- `/api/enhanced-sync/notify-profile-update` - Notify other devices about updates
- `/api/enhanced-sync/check-sync` - Check if sync is needed

For more detailed information about the enhanced sync system, please refer to:
`ENHANCED_SYNC_DEPLOYMENT.md`

## Troubleshooting

If you encounter errors during deployment:

1. Check the logs in the Render dashboard
2. Ensure your package.json has the correct "main" and "start" script
3. Verify that you've set the Root Directory to "backend"
4. Make sure all your dependencies are properly listed in package.json

## Important Notes

- The server.js file is the main entry point for the application
- The backend requires Node.js version 14 or higher
- Make sure all dependencies are listed in package.json
