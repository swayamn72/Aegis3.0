import Organization from '../models/organization.model.js';
import { VerificationService } from '../services/verification.service.js';
import { AUTH_CONSTANTS } from '../config/constants.js';

// POST /organization/resend-verification
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        await VerificationService.resendCode(
            Organization,
            email,
            'orgName',
            AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES.ORGANIZATION,
            'organization'
        );

        res.status(200).json({
            success: true,
            message: "Verification code sent! Please check your email."
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                message: error.message,
                ...(error.retryAfter && { retryAfter: error.retryAfter })
            });
        }
        console.error("Org resend verification error:", error);
        res.status(500).json({ message: "Server error during resend" });
    }
};

// POST /organization/verify-email
export const verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: "Email and verification code are required" });
        }

        // Verify email using service
        const updatedOrg = await VerificationService.verifyEmail(
            Organization,
            email,
            code,
            'organization'
        );

        // Generate JWT token
        const token = VerificationService.generateToken(updatedOrg._id, 'organization');
        const cookieOptions = VerificationService.getCookieOptions();

        res.cookie("token", token, cookieOptions);

        res.status(200).json({
            success: true,
            message: "Email verified successfully!",
            token,
            organization: {
                id: updatedOrg._id,
                email: updatedOrg.email,
                orgName: updatedOrg.orgName,
                isEmailVerified: true,
            },
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                message: error.message,
                ...(error.expired && { expired: error.expired }),
                ...(error.tooManyAttempts && { tooManyAttempts: error.tooManyAttempts }),
                ...(error.attemptsLeft !== undefined && { attemptsLeft: error.attemptsLeft })
            });
        }
        console.error("Org email verification error:", error);
        res.status(500).json({ message: "Server error during verification" });
    }
};
