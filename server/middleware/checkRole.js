// Middleware to check if user is a player
export const requirePlayer = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role !== 'player') {
        return res.status(403).json({
            message: "Access denied. This resource is only accessible to players."
        });
    }

    next();
};

// Middleware to check if user is an organization
export const requireOrganization = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role !== 'organization') {
        return res.status(403).json({
            message: "Access denied. This resource is only accessible to organizations."
        });
    }

    next();
};

// Middleware to check if user is either player or organization
export const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    if (!['player', 'organization'].includes(req.user.role)) {
        return res.status(403).json({ message: "Invalid user role" });
    }

    next();
};
