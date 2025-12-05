import jwt from "jsonwebtoken";

// Middleware to protect routes
export default function auth(req, res, next) {
  let token = req.cookies.token; // read cookie

  // If no cookie token, check Authorization header
  if (!token) {
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set req.user to decoded payload (player info)
    req.user = { id: decoded.id };

    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}
