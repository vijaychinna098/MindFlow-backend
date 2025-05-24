# MindFlow Backend Deployment Guide

This guide explains how to deploy the MindFlow backend to Render.com.

## Deployment Steps

1. Push your code to GitHub (ensure the backend folder contains all necessary files)
2. Log in to your Render dashboard
3. Create a new Web Service
4. Connect your GitHub repository
5. Configure the following settings:

   - **Name**: mindflow-backend
   - **Environment**: Node.js
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` or `node server.js`
   - **Root Directory**: `backend` (important!)

6. Add any required environment variables in the Environment section:
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Secret for JWT tokens
   - `EMAIL_USER` - Email user for notifications
   - `EMAIL_PASSWORD` - Email password
   - `BASE_URL` - Your deployed service URL (important for profile images)

7. Set up the following paths to be persisted (important for profile images):
   - `/uploads`

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
