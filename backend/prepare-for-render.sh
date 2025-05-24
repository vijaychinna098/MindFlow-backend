#!/bin/zsh
# Script to prepare MindFlow backend for deployment

echo "Preparing MindFlow backend for deployment..."

# Navigate to the backend directory
cd /Users/sanjeet/Desktop/MindFlow/backend

# Make sure the index.js file is correct
echo "// This file redirects to the actual server.js
console.log('Starting MindFlow backend server...');
require('./server.js');" > index.js

# Update package.json to use index.js as the main entry point
sed -i '' 's/"main": "server.js"/"main": "index.js"/g' package.json
sed -i '' 's/"start": "node --max-old-space-size=4096 server.js"/"start": "node --max-old-space-size=4096 index.js"/g' package.json
sed -i '' 's/"dev": "nodemon --max-old-space-size=4096 server.js"/"dev": "nodemon --max-old-space-size=4096 index.js"/g' package.json

# Update Procfile
echo "web: node index.js" > Procfile

# Ensure uploads directory exists
mkdir -p uploads/profile-images

echo "Deployment preparation complete."
echo ""
echo "IMPORTANT: When deploying to Render.com:"
echo "1. Set the Root Directory to 'backend'"
echo "2. Build command: npm install"
echo "3. Start command: npm start"
echo ""
echo "Don't forget to set your environment variables!"
