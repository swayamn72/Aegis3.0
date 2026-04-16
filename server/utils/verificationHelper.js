import bcrypt from 'bcrypt';
import { sendVerificationEmail, generateVerificationCode } from '../config/email.js';
import { AUTH_CONSTANTS } from '../config/constants.js';

/**
 * Helper to regenerate and send verification code during login
 * @param {Object} user - User/Organization document with verification fields
 * @param {string} displayName - Name for email (username or orgName)
 * @param {number} expiryMinutes - Code expiry time in minutes
 * @returns {Object} Response object with message and status
 */
export async function regenerateVerificationCode(user, displayName, expiryMinutes = 10) {
    const now = new Date();
    const codeExpired = !user.verificationCodeExpires || now > user.verificationCodeExpires;

    // If code is not expired, don't regenerate
    if (!codeExpired) {
        return {
            status: 403,
            requiresVerification: true,
            email: user.email,
            emailSent: true,
            message: "Please verify your email before logging in. Check your email for the verification code.",
        };
    }

    // Rate limiting: prevent spam (1 min cooldown)
    if (user.lastVerificationEmailSent && (now - user.lastVerificationEmailSent < AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN_MS)) {
        const secondsLeft = Math.ceil((AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN_MS - (now - user.lastVerificationEmailSent)) / 1000);
        return {
            status: 429,
            requiresVerification: true,
            email: user.email,
            emailSent: false,
            message: `Please wait ${secondsLeft} seconds before requesting another code.`,
        };
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const hashedCode = await bcrypt.hash(verificationCode, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
    const codeExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

    user.verificationCode = hashedCode;
    user.verificationCodeExpires = codeExpiry;
    user.verificationCodeAttempts = 0;
    user.lastVerificationEmailSent = now;
    await user.save();

    try {
        // sendVerificationEmail signature: (email, username/displayName, code)
        await sendVerificationEmail(user.email, displayName, verificationCode);
    } catch (emailError) {
        console.error('Failed to send verification email during login:', emailError);
        return {
            status: 500,
            requiresVerification: true,
            email: user.email,
            emailSent: false,
            message: 'Unable to send verification code right now. Please try again in a moment.',
        };
    }

    return {
        status: 403,
        requiresVerification: true,
        email: user.email,
        emailSent: true,
        message: "Please verify your email. A new verification code has been sent.",
    };
}
