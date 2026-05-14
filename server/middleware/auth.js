import jwt from "jsonwebtoken";
import extractToken from '../utils/extractToken.js';

// Middleware to protect routes
export default function auth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set req.user to decoded payload with all available info
    req.user = decoded;

    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Named export alias — used by new routes (mapVeto, matchRoom, resultSubmission)
// The default export and this named export are the same function.
export { auth as verifyToken };

