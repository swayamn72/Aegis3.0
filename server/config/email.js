import nodemailer from 'nodemailer';
import { verificationEmailTemplate, verificationEmailPlainText } from './emailTemplates.js';

// Create reusable transporter
const createTransporter = () => {
    // Using port 587 with STARTTLS (more reliable than port 465)
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for 587 (uses STARTTLS)
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD, // Use App Password, not your regular password
        },
        tls: {
            rejectUnauthorized: false // Accept self-signed certificates
        }
    });
};

/**
 * Generate a 6-digit verification code
 */
export const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send verification email to user
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {string} code - 6-digit verification code
 * @returns {Promise<Object>} - Email send result
 */
export const sendVerificationEmail = async (email, username, code) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Aegis'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email - Aegis Gaming Platform',
            html: verificationEmailTemplate(username, code),
            text: verificationEmailPlainText(username, code),
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Verification email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        throw new Error('Failed to send verification email. Please try again later.');
    }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {string} resetLink - Password reset link
 * @returns {Promise<Object>} - Email send result
 */
export const sendPasswordResetEmail = async (email, username, resetLink) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Aegis'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset Your Password - Aegis',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${username},</p>
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #FF4500; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">Aegis Gaming Platform</p>
        </div>
      `,
            text: `Hi ${username},\n\nYou requested to reset your password. Click the link below:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        throw new Error('Failed to send password reset email.');
    }
};

/**
 * Test email configuration
 * @returns {Promise<boolean>} - True if configuration is valid
 */
export const testEmailConfig = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Email configuration is valid');
        return true;
    } catch (error) {
        console.error('❌ Email configuration error:', error.message);
        return false;
    }
};

export default {
    sendVerificationEmail,
    sendPasswordResetEmail,
    generateVerificationCode,
    testEmailConfig,
};
