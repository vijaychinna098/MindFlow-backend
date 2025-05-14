const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const authRoutes = require("./routes/authRoutes");
const caregiverAuthRoutes = require("./routes/caregiverAuthRoutes"); // ✅ NEW
const notificationRoutes = require("./routes/notificationRoutes"); // Add notification routes
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
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://vijaykumar:donthaveaim@127.0.0.1:27017/alz";
const MONGODB_AUTH_SOURCE = process.env.MONGODB_AUTH_SOURCE || "admin";

mongoose.connect(MONGODB_URI, {
  authSource: MONGODB_AUTH_SOURCE,
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
app.use("/api/auth", authRoutes);                         // User auth
app.use("/api/caregivers", caregiverAuthRoutes);      // ✅ Caregiver auth
app.use("/api/notifications", notificationRoutes);         // Notification services
app.use("/api/email", emailRoutes);
app.use("/api/user", require("./routes/user"));           // ✅ User routes for getting user info and activities

// DIRECT ACCOUNT DELETION ENDPOINT - REMOVED (now in authRoutes.js)

// Ping endpoint for testing connectivity
app.get("/ping", (req, res) => {
  res.status(200).json({ message: "Server is reachable", timestamp: new Date().toISOString() });
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Server is running");
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
