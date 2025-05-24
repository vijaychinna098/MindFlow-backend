# Enhanced Profile Sync System Deployment Guide

This document provides instructions for deploying the enhanced profile synchronization system for MindFlow, which addresses the synchronization issues where the same email login on different devices shows inconsistent user data (profile name, image).

## System Components

1. **Backend Sync Services**
   - Enhanced profile synchronization API endpoints
   - Profile image storage and synchronization
   - Conflict resolution for user data

2. **Frontend Sync Services**
   - Enhanced profile sync during login
   - Automatic sync when app is resumed
   - Redundant profile image storage

## Deployment Steps

### 1. Backend Deployment on Render.com

1. Login to your Render.com account
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: MindFlow-Backend
   - **Root Directory**: `/backend`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Starter (or higher based on needs)

5. Add the following environment variables:
   - `NODE_ENV`: production
   - `PORT`: 5000
   - `MONGODB_URI`: [your MongoDB connection string]
   - `JWT_SECRET`: [your JWT secret]
   - `EMAIL_USER`: [your email user]
   - `EMAIL_PASSWORD`: [your email password]
   - `BASE_URL`: [your Render.com service URL]

6. Click "Create Web Service"

### 2. Update Frontend Configuration

1. Update the API base URL in `/MindFlow/config.js` to point to your Render.com service URL:
   ```javascript
   export const API_BASE_URL = 'https://mindflow-backend.onrender.com';
   ```

2. If you're using multiple deployment environments, add a fallback mechanism:
   ```javascript
   export const getActiveServerUrl = () => {
     const urls = [
       'https://mindflow-backend.onrender.com',
       'https://mindflow-backup.onrender.com'
     ];
     // Add logic to select the best server
     return urls[0]; // For now, just return the primary server
   };
   ```

### 3. Test Cross-Device Synchronization

1. Install the app on two different devices
2. Login with the same email on both devices
3. Make profile changes on one device (name or profile image)
4. Check that the changes are properly synchronized to the other device

## Monitoring and Troubleshooting

### Monitoring Sync Status

1. The enhanced sync system includes detailed logging
2. Check the server logs on Render.com for sync-related issues
3. On the mobile app, sync errors are logged to the console

### Common Issues and Solutions

#### Profile Image Not Syncing

1. Ensure the uploads directory exists on the server
2. Check file permissions for the uploads directory
3. Verify that the BASE_URL environment variable is correctly set

#### Inconsistent User Names

1. Check the lastNameUpdate timestamps in the database
2. Force a profile sync through the admin interface
3. Verify that the user document in MongoDB has the correct name field

## Additional Information

For more details about the enhanced sync system, refer to the following files:

- `/backend/sync-updates.js`: Core synchronization logic
- `/backend/routes/enhancedSyncRoutes.js`: API endpoints for synchronization
- `/MindFlow/services/ImprovedProfileSyncService.js`: Frontend sync implementation