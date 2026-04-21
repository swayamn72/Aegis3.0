import nodemailer from 'nodemailer';
import { verificationEmailTemplate, verificationEmailPlainText } from './emailTemplates.js';

// Create reusable transporter
const createTransporter = () => {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
    const rejectUnauthorized = (process.env.SMTP_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false';

    if (!smtpUser || !smtpPass) {
        throw new Error('Missing SMTP credentials. Set SMTP_USER/SMTP_PASSWORD (or EMAIL_USER/EMAIL_PASSWORD).');
    }

    return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        tls: {
            rejectUnauthorized,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
    });
};

const getFromAddress = () => {
    const sender = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    return `"${process.env.APP_NAME || 'Aegis'}" <${sender}>`;
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
            from: getFromAddress(),
            to: email,
            subject: 'Verify Your Email - Aegis',
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

        const { passwordResetEmailTemplate, passwordResetEmailPlainText } = await import('./emailTemplates.js');

        const mailOptions = {
            from: getFromAddress(),
            to: email,
            subject: 'Reset Your Password - Aegis',
            html: passwordResetEmailTemplate(username, resetLink),
            text: passwordResetEmailPlainText(username, resetLink),
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

/**
 * Send tournament registration email
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {string} teamName - User's team name
 * @param {string} tournamentName - Name of the registered tournament
 * @returns {Promise<Object>} - Email send result
 */
export const sendTournamentRegistrationEmail = async (email, username, teamName, tournamentName) => {
    try {
        const transporter = createTransporter();
        const { tournamentRegistrationEmailTemplate, tournamentRegistrationEmailPlainText } = await import('./emailTemplates.js');

        const mailOptions = {
            from: getFromAddress(),
            to: email,
            subject: `Registration Accepted - ${tournamentName}`,
            html: tournamentRegistrationEmailTemplate(username, teamName, tournamentName),
            text: tournamentRegistrationEmailPlainText(username, teamName, tournamentName),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Tournament registration email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending tournament registration email:', error);
        throw new Error('Failed to send tournament registration email.');
    }
};

/**
 * Send approval email for tournament
 * @param {string} email - Recipient email address
 * @param {string} orgName - Name of the organization
 * @param {string} tournamentName - Name of the tournament
 * @returns {Promise<Object>} - Email send result
 */
export const sendTournamentApprovalEmail = async (email, orgName, tournamentName) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: getFromAddress(),
        to: email,
        subject: `Tournament Approved - ${tournamentName} | Aegis`,
        html: `
            <h2>Congratulations, ${orgName}!</h2>
            <p>Your tournament <b>${tournamentName}</b> has been <b>approved</b> by the Aegis admin team.</p>
            <p>You can now manage your tournament and invite teams/players.</p>
            <p>If you have any questions, contact us at <a href="mailto:support@aegis.com">support@aegis.com</a>.</p>
            <p>Best of luck for your event!</p>
        `,
        text: `Congratulations, ${orgName}!
Your tournament ${tournamentName} has been approved by the Aegis admin team.
You can now manage your tournament and invite teams/players.
If you have any questions, contact us at support@aegis.com.
Best of luck for your event!`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Tournament approval email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
};

/**
 * Send approval email for organization application
 * @param {string} email - Recipient email address
 * @param {string} orgName - Name of the organization
 * @returns {Promise<Object>} - Email send result
 */
export const sendApprovalEmail = async (email, orgName) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: getFromAddress(),
        to: email,
        subject: 'Organization Application Approved - Aegis',
        html: `
            <h2>Congratulations, ${orgName}!</h2>
            <p>Your organization application has been <b>approved</b> by the Aegis admin team.</p>
            <p>You can now access your organization dashboard and start conducting tournaments and events.</p>
            <p>If you have any questions, contact us at <a href="mailto:support@aegis.com">support@aegis.com</a>.</p>
            <p>Welcome to Aegis!</p>
        `,
        text: `Congratulations, ${orgName}!
Your organization application has been approved by the Aegis admin team.
You can now access your organization dashboard and start participating in tournaments and events.
If you have any questions, contact us at support@aegis.com.
Welcome to Aegis!`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Approval email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
};

/**
 * Send account deletion email
 * @param {string} email - Recipient email address
 * @param {string} username - User's username
 * @param {string} confirmLink - Deletion confirmation link
 * @returns {Promise<Object>} - Email send result
 */
export const sendAccountDeletionEmail = async (email, username, confirmLink) => {
    try {
        const transporter = createTransporter();
        const { accountDeletionEmailTemplate, accountDeletionEmailPlainText } = await import('./emailTemplates.js');

        const mailOptions = {
            from: getFromAddress(),
            to: email,
            subject: 'Confirm Your Account Deletion - Aegis',
            html: accountDeletionEmailTemplate(username, confirmLink),
            text: accountDeletionEmailPlainText(username, confirmLink),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Account deletion email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending account deletion email:', error);
        throw new Error('Failed to send account deletion email.');
    }
};

export default {
    sendAccountDeletionEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendTournamentRegistrationEmail,
    sendTournamentApprovalEmail,
    sendApprovalEmail,
    generateVerificationCode,
    testEmailConfig,
};