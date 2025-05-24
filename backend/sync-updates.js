// Final integrated server.js configuration with all fixed endpoints
// This ensures all endpoints are properly registered and synchronized

// This file should be merged into server.js after code review

// Ensure all API endpoints are accessible
app.use("/api/users/sync", (req, res, next) => {
  console.log("API sync endpoint accessed");
  
  // Forward to the sync endpoint in user.js
  const userRouter = require("./routes/user");
  
  // Call the sync function directly
  if (req.method === "POST") {
    userRouter.syncHandler(req, res, next);
  } else {
    res.status(405).json({
      success: false,
      message: "Method not allowed - use POST for sync"
    });
  }
});

// Create direct sync endpoint for aggressive device-to-device sync
app.post("/api/sync/direct-device", async (req, res) => {
  try {
    const { userData, deviceId, timestamp, lastSyncTime } = req.body;
    
    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sync data provided'
      });
    }
    
    const email = userData.email.toLowerCase().trim();
    console.log(`Direct device sync request for user: ${email} from device: ${deviceId}`);
    
    // Find existing user in database
    const User = require('./models/user');
    let user = await User.findOne({ email });
    
    if (user) {
      console.log(`Existing user found for direct sync: ${email}`);
      
      // Handle profile image to ensure consistency
      if (!userData.profileImage && user.profileImage) {
        console.log('Client missing profile image, will return server image');
        userData.profileImage = user.profileImage;
      } else if (userData.profileImage && !user.profileImage) {
        console.log('Server missing profile image, using client image');
      }
      
      // Special handling for name fields
      if (!userData.name && user.name) {
        console.log('Client missing name, will return server name');
        userData.name = user.name;
      } else if (userData.name && !user.name) {
        console.log('Server missing name, using client name');
      }
      
      // Update with merged fields
      user = await User.findOneAndUpdate(
        { email },
        { 
          $set: {
            ...userData,
            lastSyncTime: new Date(),
            lastSyncDevice: deviceId
          }
        },
        { new: true }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Direct sync successful',
        userData: user
      });
    } else {
      console.log(`User not found for direct sync: ${email}, creating new user`);
      
      // Create new user from client data
      user = await User.create({
        ...userData,
        email,
        lastSyncTime: new Date(),
        lastSyncDevice: deviceId
      });
      
      return res.status(200).json({
        success: true,
        message: 'User created via direct sync',
        userData: user
      });
    }
  } catch (error) {
    console.error('Error in direct device sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in direct device sync',
      error: error.message
    });
  }
});

// Add the aggressive image sync endpoint
app.post("/api/sync/aggressive-image", async (req, res) => {
  try {
    const { email, profileImage } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Aggressive image sync for user: ${normalizedEmail}`);
    
    // Find user in database
    const User = require('./models/user');
    let user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let updatedImage = user.profileImage;
    
    // Update user's profile image if provided
    if (profileImage && profileImage !== user.profileImage) {
      console.log(`Updating profile image for: ${normalizedEmail}`);
      
      user = await User.findOneAndUpdate(
        { email: normalizedEmail },
        { 
          $set: {
            profileImage: profileImage,
            lastSyncTime: new Date()
          }
        },
        { new: true }
      );
      
      updatedImage = profileImage;
    } else if (!profileImage && user.profileImage) {
      // Client wants image but doesn't have one
      console.log(`Client requested image for: ${normalizedEmail}`);
      updatedImage = user.profileImage;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Aggressive image sync successful',
      profileImage: updatedImage,
      name: user.name // Also return name for consistency
    });
  } catch (error) {
    console.error('Error in aggressive image sync:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in aggressive image sync',
      error: error.message
    });
  }
});

// One-way image download endpoint
app.get("/api/sync/image/:email", async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Image download request for user: ${normalizedEmail}`);
    
    // Find user in database
    const User = require('./models/user');
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.profileImage) {
      return res.status(404).json({
        success: false,
        message: 'User has no profile image'
      });
    }
    
    return res.status(200).json({
      success: true,
      profileImage: user.profileImage,
      name: user.name
    });
  } catch (error) {
    console.error('Error in image download:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in image download',
      error: error.message
    });
  }
});
