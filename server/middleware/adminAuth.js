import jwt from "jsonwebtoken";

export const adminAuth = (req,res,next) => {

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token, not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }



};

// Generate JWT token for admin
export const generateAdminToken = (adminId) => {
  return jwt.sign({ adminId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Verify admin token middleware
export const verifyAdminToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token, not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Check admin permissions middleware
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin || !req.admin.permissions) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!req.admin.permissions.includes(permission)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};
