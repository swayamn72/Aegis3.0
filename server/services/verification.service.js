import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, generateVerificationCode } from '../config/email.js';
import { AUTH_CONSTANTS } from '../config/constants.js';

/**
 * Unified Verification Service
 * Handles email verification for both Players and Organizations
 */
export class VerificationService {
    /**
     * Verify email with code - works for both Player and Organization
     * @param {Model} Model - Mongoose model (Player or Organization)
     * @param {string} email - User email
     * @param {string} code - Verification code
     * @param {string} role - 'player' or 'organization'
     * @returns {Object} Updated user document
     */
    static async verifyEmail(Model, email, code, role = 'player') {
        const user = await Model.findOne({ email }).select(
            '+verificationCode +verificationCodeExpires +verificationCodeAttempts'
        );

        if (!user) {
            throw {
                status: 404,
                message: `${role === 'organization' ? 'Organization' : 'User'} not found`
            };
        }

        if (user.isEmailVerified) {
            throw { status: 400, message: 'Email is already verified' };
        }

        if (!user.verificationCode || !user.verificationCodeExpires) {
            throw {
                status: 400,
                message: 'No verification code found. Please request a new one.'
            };
        }

        if (new Date() > user.verificationCodeExpires) {
            throw {
                status: 400,
                message: 'Verification code has expired. Please request a new one.',
                expired: true
            };
        }

        if (user.verificationCodeAttempts >= AUTH_CONSTANTS.MAX_VERIFICATION_ATTEMPTS) {
            throw {
                status: 429,
                message: 'Too many attempts. Please request a new verification code.',
                tooManyAttempts: true
            };
        }

        const isCodeValid = await bcrypt.compare(code, user.verificationCode);

        if (!isCodeValid) {
            await user.updateOne({ $inc: { verificationCodeAttempts: 1 } });
            const attemptsLeft = AUTH_CONSTANTS.MAX_VERIFICATION_ATTEMPTS - (user.verificationCodeAttempts + 1);
            throw {
                status: 400,
                message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
                attemptsLeft
            };
        }

        // Update user - mark as verified (atomic operation)
        const updatedUser = await Model.findOneAndUpdate(
            { email },
            {
                $set: {
                    isEmailVerified: true,
                    verificationCodeAttempts: 0
                },
                $unset: {
                    verificationCode: 1,
                    verificationCodeExpires: 1
                }
            },
            { new: true }
        );

        return updatedUser;
    }

    /**
     * Resend verification code
     * @param {Model} Model - Mongoose model (Player or Organization)
     * @param {string} email - User email
     * @param {string} displayNameField - Field name for display (username or orgName)
     * @param {number} expiryMinutes - Code expiry time in minutes
     * @param {string} role - 'player' or 'organization'
     * @returns {Object} Success response
     */
    static async resendCode(Model, email, displayNameField, expiryMinutes, role = 'player') {
        const user = await Model.findOne({ email }).select(
            '+lastVerificationEmailSent +isEmailVerified'
        );

        if (!user) {
            throw {
                status: 404,
                message: `${role === 'organization' ? 'Organization' : 'User'} not found`
            };
        }

        if (user.isEmailVerified) {
            throw { status: 400, message: 'Email is already verified' };
        }

        // Rate limiting check
        const now = new Date();
        if (user.lastVerificationEmailSent) {
            const timeSinceLastEmail = now - user.lastVerificationEmailSent;
            if (timeSinceLastEmail < AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN_MS) {
                const secondsLeft = Math.ceil((AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN_MS - timeSinceLastEmail) / 1000);
                throw {
                    status: 429,
                    message: `Please wait ${secondsLeft} seconds before requesting another code`,
                    retryAfter: secondsLeft
                };
            }
        }

        // Generate new code
        const verificationCode = generateVerificationCode();
        const hashedCode = await bcrypt.hash(verificationCode, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
        const codeExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

        await user.updateOne({
            $set: {
                verificationCode: hashedCode,
                verificationCodeExpires: codeExpiry,
                verificationCodeAttempts: 0,
                lastVerificationEmailSent: now
            }
        });

        try {
            await sendVerificationEmail(email, user[displayNameField], verificationCode);
        } catch (err) {
            console.error('Failed to send verification email:', err);
            await user.updateOne({ $unset: { lastVerificationEmailSent: 1 } });
            throw {
                status: 502,
                message: 'Unable to send verification email right now. Please try again.',
            };
        }

        return { success: true };
    }

    /**
     * Generate JWT token for authenticated user
     * @param {string} userId - User ID
     * @param {string} role - User role ('player' or 'organization')
     * @returns {string} JWT token
     */
    static generateToken(userId, role) {
        return jwt.sign(
            { id: userId, role },
            process.env.JWT_SECRET,
            { expiresIn: AUTH_CONSTANTS.JWT_EXPIRY }
        );
    }

    /**
     * Get cookie options based on environment
     * @returns {Object} Cookie options
     */
    static getCookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: AUTH_CONSTANTS.COOKIE_MAX_AGE,
        };
    }
}
