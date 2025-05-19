const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/send-email", async (req, res) => {
  console.log("=== EMAIL SENDING REQUEST RECEIVED ===");
  const { to, subject, text } = req.body;
  
  console.log(`Email recipient: ${to}`);
  console.log(`Email subject: ${subject}`);
  console.log(`Email length: ${text ? text.length : 0} characters`);

  if (!to || !subject || !text) {
    console.error("Missing required email fields:", { to, subject, text: text ? "provided" : "missing" });
    return res.status(400).json({
      success: false,
      message: "To, subject, and text are required fields",
    });
  }

  try {
    console.log("Creating email transporter with credentials:");
    console.log(`Email user: ${process.env.EMAIL_USER ? process.env.EMAIL_USER : 'NOT SET - CHECK ENV VARS'}`);
    console.log(`Email password: ${process.env.EMAIL_PASSWORD ? 'PROVIDED' : 'NOT SET - CHECK ENV VARS'}`);
    
    // Check if email credentials are available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error("Email credentials are missing in environment variables");
      return res.status(500).json({
        success: false,
        message: "Email service not properly configured",
      });
    }
    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: {
        name: "MindFlow",
        address: process.env.EMAIL_USER
      },
      to,
      subject,
      text,
    };

    console.log("Sending email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
    console.log("Response:", info.response);

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId
    });
  } catch (error) {
    console.error("Error sending email:", error);
    // Provide more detailed error information
    let errorMessage = "Failed to send email";
    let errorDetails = error.message;
    
    if (error.code === 'EAUTH') {
      errorMessage = "Authentication error - check email credentials";
    } else if (error.code === 'ESOCKET') {
      errorMessage = "Network error when connecting to email server";
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: errorDetails
    });
  }
});

module.exports = router;