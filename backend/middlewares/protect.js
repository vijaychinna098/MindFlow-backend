// protect.js
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }

  try {
    // Check if JWT_SECRET is available
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      console.error("JWT_SECRET is not set in production environment");
      return res
        .status(500)
        .json({ success: false, message: "Server configuration error" });
    }
    
    const jwtSecret = process.env.JWT_SECRET || "your_secure_secret_here";
    const decoded = jwt.verify(token, jwtSecret);
    
    // Attach the user data to req.user, excluding the password field
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    next();
  } catch (error) {
    console.error("JWT verification error:", error.message);
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

module.exports = protect;
