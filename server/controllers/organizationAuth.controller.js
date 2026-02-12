import Organization from '../models/organization.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, generateVerificationCode } from '../config/email.js';

// POST /organization/resend-verification
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const org = await Organization.findOne({ email }).select('+lastVerificationEmailSent +emailVerified');
        if (!org) {
            return res.status(404).json({ message: "Organization not found" });
        }
        if (org.emailVerified) {
            return res.status(400).json({ message: "Email is already verified" });
        }
        // Cooldown: 1 min between resends
        const now = new Date();
        if (org.lastVerificationEmailSent && (now - org.lastVerificationEmailSent < 60 * 1000)) {
            const secondsLeft = Math.ceil((60 * 1000 - (now - org.lastVerificationEmailSent)) / 1000);
            return res.status(429).json({ message: `Please wait ${secondsLeft} seconds before resending.` });
        }
        // Generate new code
        const code = generateVerificationCode();
        const hashedCode = await bcrypt.hash(code, 10);
        org.verificationCode = hashedCode;
        org.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
        org.verificationCodeAttempts = 0;
        org.lastVerificationEmailSent = now;
        await org.save();
        // Send email
        await sendVerificationEmail(org.email, code, org.orgName);
        res.status(200).json({
            success: true,
            message: "Verification email resent"
        });
    } catch (error) {
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
        // Find org and include verification fields
        const org = await Organization.findOne({ email }).select('+verificationCode +verificationCodeExpires +verificationCodeAttempts');
        if (!org) {
            return res.status(404).json({ message: "Organization not found" });
        }
        if (org.emailVerified) {
            return res.status(400).json({ message: "Email is already verified" });
        }
        if (!org.verificationCode || !org.verificationCodeExpires) {
            return res.status(400).json({ message: "No verification code found. Please request a new one." });
        }
        // Check if code has expired
        if (new Date() > org.verificationCodeExpires) {
            return res.status(400).json({
                message: "Verification code has expired. Please request a new one.",
                expired: true,
            });
        }
        // Check attempt limit (max 5 attempts per code)
        if (org.verificationCodeAttempts >= 5) {
            return res.status(429).json({
                message: "Too many attempts. Please request a new verification code.",
                tooManyAttempts: true,
            });
        }
        // Verify the code
        const isCodeValid = await bcrypt.compare(code, org.verificationCode);
        if (!isCodeValid) {
            org.verificationCodeAttempts += 1;
            await org.save();
            const attemptsLeft = 5 - org.verificationCodeAttempts;
            return res.status(400).json({
                message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
                attemptsLeft,
            });
        }
        // Verification successful!
        org.emailVerified = true;
        org.verificationCode = undefined;
        org.verificationCodeExpires = undefined;
        org.verificationCodeAttempts = 0;
        await org.save();
        // Generate JWT token for auto-login (optional)
        const token = jwt.sign(
            { id: org._id, role: 'organization' },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(200).json({
            success: true,
            message: "Email verified successfully!",
            token,
            organization: {
                id: org._id,
                email: org.email,
                orgName: org.orgName,
                emailVerified: true,
            },
        });
    } catch (error) {
        console.error("Org email verification error:", error);
        res.status(500).json({ message: "Server error during verification" });
    }
};
