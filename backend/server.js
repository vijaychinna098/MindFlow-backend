const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const authRoutes = require("./routes/authRoutes");
const caregiverAuthRoutes = require("./routes/caregiverAuthRoutes"); // ✅ NEW
const notificationRoutes = require("./routes/notificationRoutes"); // Add notification routes
const usersRoutes = require("./routes/usersRoutes"); // Add users routes
const profileRoutes = require("./routes/profileRoutes"); // Add profile routes
const User = require("./models/user"); // Import User model directly
const protect = require("./middlewares/protect"); // Import the protect middleware
const emailRoutes = require("./routes/emailRoutes");

// Load environment variables first
dotenv.config();

// Debugging: Check email credentials
console.log("==== EMAIL CONFIGURATION ====");
console.log("Email User: ", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log("Email Password: ", process.env.EMAIL_PASSWORD ? "✅ Set" : "❌ Missing");
console.log("============================");

// Initialize Firebase
require('./firebaseConfig'); // Initialize Firebase

// Initialize Express
const app = express();

// Security headers for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, 'uploads/profile-images');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory for profile images');
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://MindFlow:donthaveaim@cluster0.jwxwiys.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const MONGODB_AUTH_SOURCE = process.env.MONGODB_AUTH_SOURCE || "admin";

mongoose.connect(MONGODB_URI, {
  // MongoDB Atlas doesn't require authSource
  ...(MONGODB_URI.includes('127.0.0.1') ? { authSource: MONGODB_AUTH_SOURCE } : {})
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// Test route for email sending
app.get("/api/test-email", async (req, res) => {
  try {
    console.log("Email test credentials:", process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
    
    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    // Test email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to self for testing
      subject: "Test Email from Alzheimer's App",
      html: "<h1>Test Email</h1><p>This is a test email to verify nodemailer configuration.</p>"
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Test email sent:", info.response);
    
    res.status(200).json({
      success: true,
      message: "Test email sent successfully",
      emailInfo: info.response
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message
    });
  }
});

// Routes
app.use("/api/auth", authRoutes);                          // User auth
app.use("/api/caregivers", caregiverAuthRoutes);           // ✅ Caregiver auth
app.use("/api/notifications", notificationRoutes);         // Notification services
app.use("/api/email", emailRoutes);                        // Email services
app.use("/api/users", usersRoutes);                        // Users routes for profiles and updates
app.use("/api/profile", profileRoutes);                    // Profile routes for cloud storage
app.use("/api/user", require("./routes/user"));            // ✅ User routes for getting user info and activities

// Only new user profile sync endpoints remain
// Upsert user profile (create or update with latest data)
app.post('/api/user/profile', async (req, res) => {
  try {
    const { email, name, profileImage, phone, address, age, medicalInfo, homeLocation, reminders, memories, emergencyContacts } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });
    const now = new Date();
    if (user) {
      // Only update if incoming data is newer
      if (!user.lastSyncTime || (req.body.lastSyncTime && new Date(req.body.lastSyncTime) > user.lastSyncTime)) {
        user.name = name || user.name;
        user.profileImage = profileImage || user.profileImage;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        user.age = age || user.age;
        user.medicalInfo = medicalInfo || user.medicalInfo;
        user.homeLocation = homeLocation || user.homeLocation;
        user.reminders = reminders || user.reminders;
        user.memories = memories || user.memories;
        user.emergencyContacts = emergencyContacts || user.emergencyContacts;
        user.lastSyncTime = req.body.lastSyncTime ? new Date(req.body.lastSyncTime) : now;
        await user.save();
      }
    } else {
      user = await User.create({
        email: normalizedEmail,
        name,
        profileImage,
        phone,
        address,
        age,
        medicalInfo,
        homeLocation,
        reminders,
        memories,
        emergencyContacts,
        lastSyncTime: req.body.lastSyncTime ? new Date(req.body.lastSyncTime) : now
      });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Profile upsert error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch latest user profile by email
app.get('/api/user/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
    path: req.path
  });
});

// Handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start Server
// Use different ports for development vs production
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || (isDev ? 3001 : 5000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 User login:       /api/auth/login`);
  console.log(`🔗 Caregiver login:  /api/caregivers/login`);
  console.log(`🔗 Test email:       /api/test-email`);
  console.log(`🔗 Delete account:   /api/auth/deleteAccount`);
  
  // List all registered routes for debugging with more details
  console.log("\n📋 All registered routes:");
  
  // Print routes in the main app
  app._router.stack.forEach(middleware => {
    if(middleware.route) { // It's a route
      console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if(middleware.name === 'router') { // It's a router
      console.log(`\n  Router: ${middleware.regexp}`);
      middleware.handle.stack.forEach(handler => {
        if(handler.route) {
          const path = handler.route.path;
          const fullPath = middleware.regexp.toString().includes('/api/auth') 
                        ? `/api/auth${path}` 
                        : (middleware.regexp.toString().includes('/api/caregivers') 
                          ? `/api/caregivers${path}` 
                          : path);
          const method = Object.keys(handler.route.methods).join(', ').toUpperCase();
          console.log(`    ${method} ${fullPath}`);
        }
      });
    }
  });
  
  console.log("\n✅ Server successfully started!");
});
