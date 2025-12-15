import jwt from 'jsonwebtoken';
import Organization from '../models/organization.model.js';

// Generate JWT token for organization
export const generateOrgToken = (orgId, orgName) => {
    return jwt.sign(
        {
            id: orgId,
            role: 'organization',
            orgName: orgName
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Middleware: verify organization JWT token (allows all approval statuses)
export const verifyOrgToken = async (req, res, next) => {
    try {
        let token = req.cookies.token;
        if (!token) {
            const authHeader = req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.replace('Bearer ', '');
            }
        }
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'organization') {
            return res.status(401).json({ message: 'Invalid token type' });
        }
        const organization = await Organization.findById(decoded.id);
        if (!organization) {
            return res.status(401).json({ message: 'Organization not found' });
        }
        req.organization = organization;
        req.user = {
            id: organization._id,
            role: 'organization',
            orgName: organization.orgName
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please login again.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token. Please login again.' });
        }
        console.error('Organization auth error:', error);
        res.status(500).json({ message: 'Internal server error during authentication.' });
    }
};

// Optional org auth (for routes that work with or without org)
export const optionalOrgAuth = async (req, res, next) => {
    try {
        let token = req.cookies.token;
        if (!token) {
            const authHeader = req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.replace('Bearer ', '');
            }
        }
        if (!token) {
            req.organization = null;
            req.user = null;
            return next();
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'organization') {
            req.organization = null;
            req.user = null;
            return next();
        }
        const organization = await Organization.findById(decoded.id);
        if (organization) {
            req.organization = organization;
            req.user = {
                id: organization._id,
                role: 'organization',
                orgName: organization.orgName
            };
        } else {
            req.organization = null;
            req.user = null;
        }
        next();
    } catch {
        req.organization = null;
        req.user = null;
        next();
    }
};
