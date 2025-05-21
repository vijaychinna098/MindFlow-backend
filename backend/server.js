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
const syncRoutes = require("./routes/syncRoutes"); // Add sync routes
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

// Enhanced CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

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
app.use("/api/sync", syncRoutes);                          // Sync routes

// DIRECT ACCOUNT DELETION ENDPOINT - REMOVED (now in authRoutes.js)

// Health check and status endpoints
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

app.get("/status", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get("/ping", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "pong",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/ping", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "API is online",
    timestamp: new Date().toISOString()
  });
});

app.get("/healthcheck", async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        web: "ok",
        database: mongoStatus,
        uptime: Math.floor(process.uptime())
      }
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      success: false,
      error: "Error performing health check"
    });
  }
});

// Register all route handlers
app.use('/api/users', usersRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sync', syncRoutes);

// Backward compatibility routes
app.use('/api/user', usersRoutes);  // Map /api/user to usersRoutes as well
app.use('/users', usersRoutes);     // Map /users to usersRoutes too

// Catch-all route for user profile requests
app.get("/api/user/profile/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`Catch-all profile request for: ${normalizedEmail}`);
    
    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        phone: user.phone,
        address: user.address,
        age: user.age,
        medicalInfo: user.medicalInfo || {},
        lastSyncTime: user.lastSyncTime || new Date()
      }
    });
  } catch (error) {
    console.error('Error in catch-all profile route:', error);
    res.status(500).json({
      success: false, 
      message: 'Server error', 
      error: error.message
    });
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
