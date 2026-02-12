import express from 'express';
import rateLimit from 'express-rate-limit';
import { resendVerification, verifyEmail } from '../controllers/organizationAuth.controller.js';
import { validateVerificationCode, validateResendCode } from '../middleware/validate.js';

const router = express.Router();

// Strict rate limiter for auth endpoints (login/signup)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
});

// Organization email verification routes
router.post('/resend-verification', authLimiter, validateResendCode, resendVerification);
router.post('/verify-email', authLimiter, validateVerificationCode, verifyEmail);

export default router;
