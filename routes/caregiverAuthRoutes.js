// caregiverAuthRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Caregiver = require('../models/Caregiver');
const router = express.Router();

// Store reset codes in memory
const resetCodes = {};
// Add storage for email verification codes
const emailVerificationCodes = {};

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_secure_secret_here', {
    expiresIn: '1h',
  });
};

// Add email verification endpoint
router.post("/send-email-verification", async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log("Received caregiver email verification request for:", email);

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
    
    console.log("Generated caregiver email verification code for", email, ":", verificationCode);
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
          name: "MindFlow",
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: "Your Caregiver Email Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #D9534F; text-align: center;">Caregiver Email Verification</h2>
            <p>Thank you for signing up as a caregiver for MindFlow!</p>
            <p>Your verification code is: <strong style="font-size: 24px; color: #D9534F;">${verificationCode}</strong></p>
            <p><em>This code is valid for 10 minutes.</em></p>
            <p>If you didn't sign up for a caregiver account, please ignore this email.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Caregiver verification email sent successfully:", info.response);

      // Return success and the verification code in the response
      res.status(200).json({
        success: true,
        message: "Verification code sent to email",
        // Only include verification code in development mode
        ...(process.env.NODE_ENV === 'development' && { verificationCode })
      });
    } catch (emailError) {
      console.error("Caregiver email sending error:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code email, please try again",
        error: emailError.message
      });
    }
  } catch (error) {
    console.error("Caregiver email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: error.message
    });
  }
});

// Add endpoint to verify email verification code
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log("Verifying code for email:", email);

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required"
      });
    }

    // Get the stored verification code
    const storedData = emailVerificationCodes[email.toLowerCase()];
    
    // Check if the code exists and is valid
    if (!storedData) {
      console.log("No verification code found for email:", email);
      return res.status(400).json({
        success: false,
        message: "No verification code found or code expired"
      });
    }
    
    if (storedData.code !== code || Date.now() > storedData.expiresAt) {
      console.log("Invalid or expired verification code for email:", email);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code"
      });
    }

    // Code is valid, remove it from storage (one-time use)
    delete emailVerificationCodes[email.toLowerCase()];
    
    console.log("Verification code validated successfully for:", email);
    return res.status(200).json({
      success: true,
      message: "Verification code validated successfully"
    });
  } catch (error) {
    console.error("Error verifying email code:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify email code",
      error: error.message
    });
  }
});

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const existing = await Caregiver.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    const newCG = await Caregiver.create({ 
      name, 
      email: email.toLowerCase(), 
      password,
      phone: phoneNumber || '' // Save the phone number
    });
    const token = signToken(newCG._id);
    res.status(201).json({
      success: true,
      token,
      caregiver: { 
        id: newCG._id, 
        name: newCG.name, 
        email: newCG.email,
        phone: newCG.phone 
      },
    });
  } catch (err) {
    console.error('Caregiver Signup Error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const cg = await Caregiver.findOne({ email: email.toLowerCase() }).select('+password');
    if (!cg || !(await cg.correctPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if the connected patient still exists
    if (cg.patientEmail) {
      console.log(`Caregiver ${cg.email} is connected to patient ${cg.patientEmail}. Verifying patient exists...`);
      const User = require('../models/user');
      const patientExists = await User.findOne({ email: cg.patientEmail.toLowerCase() });
      
      if (!patientExists) {
        console.log(`Patient ${cg.patientEmail} not found. Removing connection from caregiver ${cg.email}`);
        cg.patientEmail = null;
        await cg.save();
      }
    }
    
    const token = signToken(cg._id);
    cg.password = undefined;
    res.status(200).json({
      success: true,
      token,
      caregiver: { 
        id: cg._id, 
        name: cg.name, 
        email: cg.email, 
        phone: cg.phone || '',
        patientEmail: cg.patientEmail 
      },
    });
  } catch (err) {
    console.error('Caregiver Login Error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Forgot Password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Received caregiver forgot password request for:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const caregiver = await Caregiver.findOne({ email: email.toLowerCase() });
    if (!caregiver) {
      console.log("Caregiver email not found in database:", email);
      // We return success even if the email doesn't exist for security reasons
      return res.status(200).json({
        success: true,
        message: "If the email exists, a reset code has been sent"
      });
    }

    // Generate a 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes[email.toLowerCase()] = {
      code: resetCode,
      expiresAt: Date.now() + 600000 // 10 minutes expiration
    };

    console.log("Generated caregiver reset code for", email, ":", resetCode);
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
          name: "MindFlow",
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: "Caregiver Password Reset Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #D9534F; text-align: center;">Caregiver Password Reset</h2>
            <p>You've requested a password reset for your MindFlow caregiver account.</p>
            <p>Your reset code is: <strong style="font-size: 24px; color: #D9534F;">${resetCode}</strong></p>
            <p><em>This code is valid for 10 minutes.</em></p>
            <p>If you didn't request a password reset, please ignore this email or contact support.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Caregiver reset email sent successfully:", info.response);
      
      // Return success without the reset code
      res.status(200).json({
        success: true,
        message: "Reset code sent to email"
      });
    } catch (emailError) {
      console.error("Caregiver email sending error:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset code email, please try again",
        error: emailError.message
      });
    }
  } catch (error) {
    console.error("Caregiver Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message
    });
  }
});

// Reset Password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const emailLower = email.toLowerCase();
    const storedData = resetCodes[emailLower];
    
    // Check if the code exists and is valid
    if (!storedData || storedData.code !== code || Date.now() > storedData.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code"
      });
    }

    const caregiver = await Caregiver.findOne({ email: emailLower }).select('+password');
    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: "Caregiver not found"
      });
    }

    // Update the password
    caregiver.password = newPassword;
    await caregiver.save();
    
    // Remove the used reset code
    delete resetCodes[emailLower];

    // Generate a new token for the user
    const token = signToken(caregiver._id);

    res.status(200).json({
      success: true,
      token,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error("Caregiver Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed"
    });
  }
});

// New endpoint to connect caregiver with a patient account
router.post('/connect', async (req, res) => {
  try {
    const { caregiverId, patientEmail } = req.body;
    if (!patientEmail) {
      return res.status(400).json({ success: false, message: 'Patient email is required' });
    }

    // Verify that a patient with this email exists in the User collection
    const User = require('../models/user');
    const patientExists = await User.findOne({ email: patientEmail.toLowerCase() });
    
    if (!patientExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found. This account may have been deleted or does not exist.' 
      });
    }

    const caregiver = await Caregiver.findByIdAndUpdate(
      caregiverId,
      { patientEmail: patientEmail.toLowerCase() },
      { new: true }
    );
    if (!caregiver) {
      return res.status(404).json({ success: false, message: 'Caregiver not found' });
    }
    res.status(200).json({ success: true, message: 'Connected to patient successfully', caregiver });
  } catch (err) {
    console.error('Caregiver Connect Error:', err);
    res.status(500).json({ success: false, message: 'Failed to connect to patient' });
  }
});

// Add a cleanup function to be called when a patient account is deleted
const clearPatientConnections = async (patientEmail) => {
  try {
    if (!patientEmail) return;
    
    console.log(`[CLEANUP] Clearing all caregiver connections to patient: ${patientEmail}`);
    const normalizedEmail = patientEmail.toLowerCase();
    
    // Find all caregivers connected to this patient
    const connectedCaregivers = await Caregiver.find({ patientEmail: normalizedEmail });
    console.log(`[CLEANUP] Found ${connectedCaregivers.length} caregivers connected to patient: ${patientEmail}`);
    
    // Clear the connection for each caregiver
    for (const caregiver of connectedCaregivers) {
      console.log(`[CLEANUP] Removing patient connection from caregiver: ${caregiver.email}`);
      caregiver.patientEmail = null;
      await caregiver.save();
    }
    
    console.log(`[CLEANUP] Successfully removed all caregiver connections to patient: ${patientEmail}`);
    return true;
  } catch (error) {
    console.error(`[CLEANUP] Error clearing caregiver connections: ${error.message}`);
    return false;
  }
};

// Export the cleanup function so it can be used in other routes
exports.clearPatientConnections = clearPatientConnections;

// New endpoint to check if a patient exists by their email
router.get('/check-patient/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      console.log("Check patient called without an email");
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required',
        exists: false 
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Checking if patient exists: ${normalizedEmail}`);
    
    // Use the User model to check if the patient exists
    const User = require('../models/user');
    
    try {
      const patient = await User.findOne({ email: normalizedEmail });
      
      const exists = !!patient;
      console.log(`Patient check result: ${exists ? 'Found' : 'Not found'}`);
      
      return res.status(200).json({
        success: true,
        exists: exists,
        message: patient ? 'Patient found' : 'Patient not found or account deleted',
        // Don't return patient data for security reasons
      });
    } catch (dbError) {
      console.error(`Database error checking patient ${normalizedEmail}:`, dbError);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error checking patient',
        exists: false,
        error: dbError.message 
      });
    }
  } catch (error) {
    console.error("Error checking patient existence:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error checking patient',
      exists: false,
      error: error.message
    });
  }
});

// Disconnect caregiver from a patient
router.post('/disconnect', async (req, res) => {
  try {
    const { caregiverId, patientEmail } = req.body;
    if (!caregiverId || !patientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Caregiver ID and patient email are required' 
      });
    }

    // Find the caregiver
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Caregiver not found' 
      });
    }

    // Check if this caregiver is connected to this patient
    if (caregiver.patientEmail !== patientEmail.toLowerCase()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Caregiver is not connected to this patient' 
      });
    }

    // Remove the connection
    caregiver.patientEmail = null;
    await caregiver.save();

    return res.status(200).json({
      success: true,
      message: 'Caregiver disconnected from patient successfully'
    });
  } catch (error) {
    console.error("Error disconnecting caregiver from patient:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error disconnecting from patient' 
    });
  }
});

// Verify all patient connections for a caregiver
router.get('/verify-connections/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    if (!caregiverId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Caregiver ID is required' 
      });
    }

    // Find the caregiver
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Caregiver not found' 
      });
    }

    // If they have a patient connection, verify it
    if (caregiver.patientEmail) {
      const User = require('../models/user');
      const patient = await User.findOne({ email: caregiver.patientEmail });
      
      if (!patient) {
        // Patient doesn't exist, clear the connection
        caregiver.patientEmail = null;
        await caregiver.save();
        
        return res.status(200).json({
          success: true,
          valid: false,
          message: 'Removed connection to non-existent patient'
        });
      }
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: 'All connections are valid'
    });
  } catch (error) {
    console.error("Error verifying patient connections:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error verifying connections' 
    });
  }
});

// Verify a specific connection between caregiver and patient
router.get('/verify-connection/:caregiverId/:patientEmail', async (req, res) => {
  try {
    const { caregiverId, patientEmail } = req.params;
    if (!caregiverId || !patientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Caregiver ID and patient email are required',
        connected: false
      });
    }

    // Normalize email
    const normalizedEmail = patientEmail.toLowerCase().trim();
    
    // Find the caregiver
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Caregiver not found',
        connected: false
      });
    }

    // Check if this caregiver is connected to this specific patient
    const isConnected = caregiver.patientEmail === normalizedEmail;
    
    console.log(`Verifying connection: Caregiver ${caregiverId} to Patient ${normalizedEmail} - Result: ${isConnected ? 'Connected' : 'Not Connected'}`);
    
    // Also verify patient exists in the User collection
    if (isConnected) {
      const User = require('../models/user');
      const patient = await User.findOne({ email: normalizedEmail });
      
      if (!patient) {
        console.log(`Patient ${normalizedEmail} does not exist - clearing connection`);
        // Patient doesn't exist, clear the connection
        caregiver.patientEmail = null;
        await caregiver.save();
        
        return res.status(200).json({
          success: true,
          connected: false,
          message: 'Patient account no longer exists. Connection removed.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Connected to patient' : 'Not connected to this patient'
    });
  } catch (error) {
    console.error("Error verifying patient connection:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error verifying connection',
      connected: false
    });
  }
});

// Delete Account endpoint
router.post('/deleteAccount', async (req, res) => {
  try {
    const { caregiverId } = req.body;
    
    if (!caregiverId) {
      return res.status(400).json({
        success: false,
        message: "Caregiver ID is required"
      });
    }

    // Find and delete the caregiver
    const deletedCaregiver = await Caregiver.findByIdAndDelete(caregiverId);
    
    if (!deletedCaregiver) {
      return res.status(404).json({
        success: false,
        message: "Caregiver not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Caregiver account deleted successfully"
    });
  } catch (error) {
    console.error("Caregiver Delete Account Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete caregiver account"
    });
  }
});

// Add endpoint to get caregiver info by email for emergency alerts
router.get('/info/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Find the caregiver by email
    const caregiver = await Caregiver.findOne({ email: email.toLowerCase() });
    
    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver not found'
      });
    }
    
    // Return only the necessary information for sending alerts
    return res.status(200).json({
      success: true,
      caregiver: {
        name: caregiver.name,
        email: caregiver.email
      }
    });
  } catch (error) {
    console.error('Error getting caregiver info:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Add new endpoint to verify caregiver's connected patient
router.get('/verify-patient-connection/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    if (!caregiverId) {
      return res.status(400).json({ success: false, message: 'Caregiver ID is required' });
    }

    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      return res.status(404).json({ success: false, message: 'Caregiver not found' });
    }

    // If no patient is connected, return true (no issues)
    if (!caregiver.patientEmail) {
      return res.status(200).json({
        success: true,
        hasValidPatient: false,
        message: 'No patient connected'
      });
    }

    // Check if the connected patient exists
    const User = require('../models/user');
    const patientExists = await User.findOne({ email: caregiver.patientEmail.toLowerCase() });

    if (!patientExists) {
      // Patient doesn't exist, update caregiver record
      console.log(`Patient ${caregiver.patientEmail} not found. Removing connection from caregiver ${caregiver.email}`);
      caregiver.patientEmail = null;
      await caregiver.save();

      return res.status(200).json({
        success: true,
        hasValidPatient: false,
        message: 'Connected patient no longer exists and has been removed'
      });
    }

    // Patient exists
    return res.status(200).json({
      success: true,
      hasValidPatient: true,
      patientEmail: caregiver.patientEmail,
      message: 'Connected patient exists'
    });
  } catch (error) {
    console.error('Verify Patient Connection Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify patient connection' });
  }
});

module.exports = router;
