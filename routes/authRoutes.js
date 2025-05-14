const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/user");
const protect = require("../middlewares/protect");
const router = express.Router();

const resetCodes = {};
const emailVerificationCodes = {};

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "your_secure_secret_here", {
    expiresIn: "1h"
  });
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide email and password" 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    
    if (!user) {
      // This message is shown when the user does not exist in the database
      // This could be because the account was deleted or never existed
      return res.status(401).json({ 
        success: false,
        message: "Account not found. Please sign up to create an account." 
      });
    }
    
    // Check password only if user exists
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    const token = signToken(user._id);
    user.password = undefined;

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage || null,
      phone: user.phone || '',
      address: user.address || '',
      age: user.age || '',
      medicalInfo: user.medicalInfo || {
        conditions: '',
        medications: '',
        allergies: '',
        bloodType: ''
      },
      homeLocation: user.homeLocation || null
    };

    res.status(200).json({ 
      success: true,
      token,
      user: userData
    });
    
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Login failed"
    });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required" 
      });
    }

    if (!email.toLowerCase().endsWith("@gmail.com")) {
      return res.status(400).json({ 
        success: false,
        message: "Only Gmail addresses are allowed" 
      });
    }

    const normalizedEmail = email.toLowerCase();
    
    // Check if the email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "Email already exists" 
      });
    }

    // If we get here, the email is available for signup (either never used or was deleted)
    console.log(`Creating new user account for email: ${normalizedEmail}`);
    
    const newUser = new User({
      name,
      email: normalizedEmail,
      password,
      profileImage: null,
      phone: phone || '', // Save the phone number passed from the client
      address: '',
      age: '',
      medicalInfo: {
        conditions: '',
        medications: '',
        allergies: '',
        bloodType: ''
      },
      homeLocation: null
    });

    await newUser.save();

    const token = signToken(newUser._id);

    const userData = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      profileImage: newUser.profileImage,
      phone: newUser.phone,
      address: newUser.address,
      age: newUser.age,
      medicalInfo: newUser.medicalInfo,
      homeLocation: newUser.homeLocation
    };

    console.log(`New user account created successfully: ${normalizedEmail}`);

    res.status(201).json({ 
      success: true,
      token,
      message: "User registered successfully",
      user: userData
    });

  } catch (error) {
    console.error("Registration Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: "Email already exists" 
      });
    }
    res.status(500).json({ 
      success: false,
      message: "Registration failed"
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Received forgot password request for:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("Email not found in database:", email);
      // We still return success for security reasons
      return res.status(200).json({
        success: true,
        message: "If the email exists, a reset code has been sent"
      });
    }

    // Generate a 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes[email] = {
      code: resetCode,
      expiresAt: Date.now() + 300000 // 5 minutes expiration
    };
    
    console.log("Generated reset code for", email, ":", resetCode);
    console.log("Using email credentials:", process.env.EMAIL_USER);

    try {
      // Setup enhanced email transporter with more options
      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Send the email with the reset code
      const mailOptions = {
        from: {
          name: "Alzheimer's App",
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: "Your Password Reset Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #005BBB; text-align: center;">Password Reset</h2>
            <p>You've requested a password reset for your Alzheimer's App account.</p>
            <p>Your reset code is: <strong style="font-size: 24px; color: #005BBB;">${resetCode}</strong></p>
            <p><em>This code is valid for 5 minutes.</em></p>
            <p>If you didn't request a password reset, please ignore this email or contact support.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.response);

      // Return success response without including the reset code
      res.status(200).json({
        success: true,
        message: "Reset code sent to email"
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset code email, please try again",
        error: emailError.message
      });
    }
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const storedData = resetCodes[email];
    if (!storedData || storedData.code !== code || Date.now() > storedData.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code"
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.password = newPassword;
    await user.save();
    delete resetCodes[email];

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      token,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed"
    });
  }
});

// DELETE ACCOUNT ROUTE - Direct version without authentication middleware
router.post("/deleteAccount", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    console.log(`[DIRECT DELETE] Attempting to delete account for user ID: ${userId}`);

    // Find the user first to get their email
    const user = await User.findById(userId);
    if (!user) {
      console.log(`[DIRECT DELETE] User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const userEmail = user.email;
    console.log(`[DIRECT DELETE] Found user: ${userEmail} (ID: ${userId})`);

    // Clean up references to this user from caregivers 
    try {
      // Import the clearPatientConnections function from caregiverAuthRoutes
      const caregiverRoutes = require('./caregiverAuthRoutes');
      
      // Call the function to clean up all caregiver connections
      const cleanupResult = await caregiverRoutes.clearPatientConnections(userEmail);
      
      if (cleanupResult) {
        console.log(`[DIRECT DELETE] Successfully removed all caregiver connections to: ${userEmail}`);
      } else {
        console.log(`[DIRECT DELETE] Failed to clean up some caregiver connections for: ${userEmail}`);
      }
    } catch (cleanupError) {
      console.error(`[DIRECT DELETE] Error cleaning up caregiver connections: ${cleanupError.message}`);
      // Continue with deletion even if cleanup fails
    }

    // Delete the user from the database
    const deleteResult = await User.findByIdAndDelete(userId);
    
    if (!deleteResult) {
      console.error(`[DIRECT DELETE] Failed to delete user: ${userEmail}`);
      return res.status(500).json({
        success: false,
        message: "Failed to delete account"
      });
    }

    // Verify the user is actually deleted
    const checkUser = await User.findOne({ email: userEmail });
    if (checkUser) {
      console.error(`[DIRECT DELETE] User still exists after deletion attempt: ${userEmail}`);
      return res.status(500).json({
        success: false,
        message: "Failed to completely remove account"
      });
    }

    console.log(`[DIRECT DELETE] User account successfully deleted: ${userEmail} (ID: ${userId})`);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (error) {
    console.error("[DIRECT DELETE] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account"
    });
  }
});

router.get("/verify-token", protect, async (req, res) => {
  try {
    // If we get here, the token is valid and the middleware has already verified it
    // We just need to check if the user still exists
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // User exists and token is valid
    return res.status(200).json({
      success: true,
      message: "Token is valid and user exists"
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying token"
    });
  }
});

// Add new endpoint for email verification
router.post("/send-email-verification", async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log("Received email verification request for:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Store the code with expiration time
    const verificationCode = code || Math.floor(100000 + Math.random() * 900000).toString();
    emailVerificationCodes[email.toLowerCase()] = {
      code: verificationCode,
      expiresAt: Date.now() + 600000 // 10 minutes expiration
    };
    
    console.log("Generated email verification code for", email, ":", verificationCode);
    console.log("Using email credentials:", process.env.EMAIL_USER);

    try {
      // Setup email transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Send the email with the verification code
      const mailOptions = {
        from: {
          name: "Alzheimer's App",
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: "Your Email Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #005BBB; text-align: center;">Email Verification</h2>
            <p>Thank you for signing up for the Alzheimer's App!</p>
            <p>Your verification code is: <strong style="font-size: 24px; color: #005BBB;">${verificationCode}</strong></p>
            <p><em>This code is valid for 10 minutes.</em></p>
            <p>If you didn't sign up for an account, please ignore this email.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Verification email sent successfully:", info.response);

      // Return success and the verification code in the response
      res.status(200).json({
        success: true,
        message: "Verification code sent to email",
        verificationCode: verificationCode // For testing purposes
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code email, please try again",
        error: emailError.message
      });
    }
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: error.message
    });
  }
});

module.exports = router;
