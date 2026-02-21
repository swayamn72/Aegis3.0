import express from 'express';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import auth from '../middleware/auth.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { sendVerificationEmail, generateVerificationCode, sendPasswordResetEmail } from '../config/email.js';
import { regenerateVerificationCode } from '../utils/verificationHelper.js';
import { AUTH_CONSTANTS } from '../config/constants.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateLogin,
  validatePlayerSignup,
  validateOrgSignup,
  validateVerificationCode,
  validateResendCode,
  validateForgotPassword,
  validateResetPassword
} from '../middleware/validate.js';
import {
  checkAccountLock,
  incrementLoginAttempts,
  resetLoginAttempts
} from '../utils/bruteForceProtection.js';

const router = express.Router();

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Strict rate limiter for auth endpoints (login/signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// ==========================
//   PLAYER SIGNUP ROUTE
// ==========================
router.post('/signup', authLimiter, validatePlayerSignup, asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  const existingEmail = await Player.findOne({ email });
  if (existingEmail) {
    return res.status(400).json({ message: "Email already in use" });
  }

  const existingUsername = await Player.findOne({ username });
  if (existingUsername) {
    return res.status(400).json({ message: "Username already taken" });
  }

  const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  // Generate 6-digit verification code
  const verificationCode = generateVerificationCode();
  const hashedCode = await bcrypt.hash(verificationCode, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
  const codeExpiry = new Date(Date.now() + AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES.PLAYER * 60 * 1000);

  const newPlayer = await Player.create({
    email,
    password: hashedPassword,
    username,
    isEmailVerified: false,
    verificationCode: hashedCode,
    verificationCodeExpires: codeExpiry,
    lastVerificationEmailSent: new Date(),
  });

  // Send verification email (non-blocking)
  sendVerificationEmail(email, username, verificationCode).catch(emailError => {
    console.error('Failed to send verification email:', emailError);
  });

  res.status(201).json({
    success: true,
    message: "Registration successful! Please check your email for the verification code.",
    email: newPlayer.email,
    userId: newPlayer._id,
    requiresVerification: true,
    emailSent: true,
  });
}));

// ==========================
//   PLAYER LOGIN ROUTE
// ==========================
router.post('/login', authLimiter, validateLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find player and include all needed fields in ONE query
  const user = await Player.findOne({ email }).select('+password +verificationCode +verificationCodeExpires +lastVerificationEmailSent +loginAttempts +lockUntil');
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Check account lock status
  const lockCheck = checkAccountLock(user);
  if (lockCheck) {
    return res.status(lockCheck.status).json({
      message: lockCheck.message,
      locked: lockCheck.locked
    });
  }

  if (!user.password) {
    return res.status(400).json({ message: "This account uses Google login only" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    // Increment failed login attempts
    await incrementLoginAttempts(user);
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Check if email is verified (only for local auth users)
  if (user.authProvider.includes('local') && !user.isEmailVerified) {
    const result = await regenerateVerificationCode(user, user.username, AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES.PLAYER);
    return res.status(result.status).json({
      message: result.message,
      requiresVerification: result.requiresVerification,
      email: result.email,
      emailSent: result.emailSent,
    });
  }

  // Reset login attempts on successful login
  await resetLoginAttempts(user);

  const token = jwt.sign(
    { id: user._id, role: 'player' },
    process.env.JWT_SECRET,
    { expiresIn: AUTH_CONSTANTS.JWT_EXPIRY }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax',
    maxAge: AUTH_CONSTANTS.COOKIE_MAX_AGE,
  };

  res.cookie("token", token, cookieOptions);

  res.status(200).json({
    message: "Login successful",
    token,
    player: {
      _id: user._id,
      id: user._id,
      email: user.email,
      username: user.username,
      realName: user.realName,
      age: user.age,
      location: user.location,
      country: user.country,
      primaryGame: user.primaryGame,
      teamStatus: user.teamStatus,
      availability: user.availability,
    },
  });
}));

// ==========================
//   GOOGLE OAUTH LOGIN
// ==========================
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, userInfo, role = 'player' } = req.body;

    if (!credential && !userInfo) {
      return res.status(400).json({ message: "Google credential or user info is required" });
    }

    let googleId, email, name, picture;

    // Logic to verify Google credential...
    if (userInfo) {
      googleId = userInfo.sub;
      email = userInfo.email;
      name = userInfo.name;
      picture = userInfo.picture;
    } else {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    }

    const Model = role === 'organization' ? Organization : Player;
    const roleType = role === 'organization' ? 'organization' : 'player';

    // Check if user exists with this Google ID in the specified role
    let user = await Model.findOne({ googleId });

    if (!user) {
      // Check if user exists with this email in the specified role
      user = await Model.findOne({ email });

      if (user) {
        // User exists with email but not Google ID - link accounts
        user.googleId = googleId;

        // Add authProvider logic
        if (roleType === 'player') {
          if (!user.authProvider.includes('google')) {
            user.authProvider.push('google');
          }
          if (picture && !user.profilePicture) {
            user.profilePicture = picture;
          }
        } else {
          // Organizations might not have authProvider array yet, but they have googleId
          if (picture && !user.logo) {
            user.logo = picture;
          }
        }
        await user.save();
      } else {
        // Create new user based on role
        if (roleType === 'player') {
          const username = email.split('@')[0] + '_' + Date.now();
          user = await Player.create({
            email,
            googleId,
            username,
            realName: name || '',
            profilePicture: picture || '',
            authProvider: ['google'],
            verified: true,
            isEmailVerified: true,
            usernameCustomized: false,
          });
        } else {
          // Organization registration via Google
          user = await Organization.create({
            email,
            googleId,
            orgName: name ? `${name}'s Org` : email.split('@')[0],
            ownerName: name || 'Google User',
            country: 'TBD', // Placeholder, needs setup
            isEmailVerified: true,
            approvalStatus: 'pending',
            profileCustomized: false,
            logo: picture || '',
          });
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: roleType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);

    const responseData = {
      message: "Google login successful",
      token,
    };

    if (roleType === 'player') {
      responseData.player = {
        _id: user._id,
        id: user._id,
        email: user.email,
        username: user.username,
        realName: user.realName,
        profilePicture: user.profilePicture,
        usernameCustomized: user.usernameCustomized,
        primaryGame: user.primaryGame,
      };
    } else {
      responseData.organization = {
        id: user._id,
        orgName: user.orgName,
        ownerName: user.ownerName,
        email: user.email,
        approvalStatus: user.approvalStatus,
        profileCustomized: user.profileCustomized,
      };
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

// ==========================
// ORGANIZATION SIGNUP ROUTE
// ==========================
router.post('/organization/signup', authLimiter, validateOrgSignup, asyncHandler(async (req, res) => {
  const {
    orgName,
    ownerName,
    email,
    password,
    country,
    headquarters,
    description,
    contactPhone,
    website,
    orgInstagram,
    ownerSocial
  } = req.body;

  // Check if organization email already exists
  const existingOrg = await Organization.findOne({ email });
  if (existingOrg) {
    return res.status(400).json({ message: "Email already registered" });
  }

  // Check if organization name already exists
  const existingOrgName = await Organization.findOne({ orgName });
  if (existingOrgName) {
    return res.status(400).json({ message: "Organization name already taken" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  // Generate 6-digit verification code
  const verificationCode = generateVerificationCode();
  const hashedCode = await bcrypt.hash(verificationCode, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
  const codeExpiry = new Date(Date.now() + AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES.ORGANIZATION * 60 * 1000);

  // Create organization with pending status and verification fields
  const newOrg = await Organization.create({
    orgName,
    ownerName,
    email,
    password: hashedPassword,
    country,
    headquarters: headquarters || '',
    description: description || '',
    contactPhone: contactPhone || '',
    ownerSocial: ownerSocial || {},
    orgSocial: {
      instagram: orgInstagram || '',
      website: website || ''
    },
    approvalStatus: 'pending',
    isEmailVerified: false,
    verificationCode: hashedCode,
    verificationCodeExpires: codeExpiry,
    verificationCodeAttempts: 0,
    lastVerificationEmailSent: new Date(),
  });

  // Send verification email (non-blocking)
  sendVerificationEmail(email, orgName, verificationCode).catch(emailError => {
    console.error('Failed to send verification email:', emailError);
  });

  res.status(201).json({
    success: true,
    message: "Organization registration submitted successfully. Please verify your email.",
    email: newOrg.email,
    orgId: newOrg._id,
    requiresVerification: true,
    emailSent: true,
    organization: {
      id: newOrg._id,
      orgName: newOrg.orgName,
      approvalStatus: newOrg.approvalStatus,
    },
  });
}));

// ==========================
// ORGANIZATION LOGIN ROUTE
// ==========================
router.post('/organization/login', authLimiter, validateLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find organization and include all needed fields in ONE query
  const org = await Organization.findOne({ email }).select('+password +isEmailVerified +verificationCode +verificationCodeExpires +lastVerificationEmailSent +loginAttempts +lockUntil');
  if (!org) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Check account lock status
  const lockCheck = checkAccountLock(org);
  if (lockCheck) {
    return res.status(lockCheck.status).json({
      message: lockCheck.message,
      locked: lockCheck.locked
    });
  }

  // Verify password first
  const isPasswordValid = await bcrypt.compare(password, org.password);
  if (!isPasswordValid) {
    // Increment failed login attempts
    await incrementLoginAttempts(org);
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Block login if email is not verified
  if (!org.isEmailVerified) {
    const result = await regenerateVerificationCode(org, org.orgName, AUTH_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES.ORGANIZATION);
    return res.status(result.status).json({
      message: result.message,
      requiresVerification: result.requiresVerification,
      email: result.email,
      emailSent: result.emailSent,
    });
  }

  // Reset login attempts on successful login
  await resetLoginAttempts(org);

  // Generate JWT with role
  const token = jwt.sign(
    { id: org._id, role: 'organization' },
    process.env.JWT_SECRET,
    { expiresIn: AUTH_CONSTANTS.JWT_EXPIRY }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax',
    maxAge: AUTH_CONSTANTS.COOKIE_MAX_AGE,
  };

  res.cookie("token", token, cookieOptions);

  res.status(200).json({
    message: "Login successful",
    token,
    organization: {
      id: org._id,
      orgName: org.orgName,
      ownerName: org.ownerName,
      email: org.email,
      country: org.country,
      logo: org.logo,
      approvalStatus: org.approvalStatus,
      rejectionReason: org.rejectionReason,
    },
  });
}));

// ==========================
//   EMAIL VERIFICATION ROUTES
// ==========================

// Verify email with 6-digit code
router.post('/verify-email', authLimiter, validateVerificationCode, asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  // Find user and include verification fields
  const user = await Player.findOne({ email }).select('+verificationCode +verificationCodeExpires +verificationCodeAttempts');

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({ message: "Email is already verified" });
  }

  if (!user.verificationCode || !user.verificationCodeExpires) {
    return res.status(400).json({ message: "No verification code found. Please request a new one." });
  }

  // Check if code has expired
  if (new Date() > user.verificationCodeExpires) {
    return res.status(400).json({
      message: "Verification code has expired. Please request a new one.",
      expired: true,
    });
  }

  // Check attempt limit (max 5 attempts per code)
  if (user.verificationCodeAttempts >= 5) {
    return res.status(429).json({
      message: "Too many attempts. Please request a new verification code.",
      tooManyAttempts: true,
    });
  }

  // Verify the code
  const isCodeValid = await bcrypt.compare(code, user.verificationCode);

  if (!isCodeValid) {
    // Increment failed attempts
    user.verificationCodeAttempts += 1;
    await user.save();

    const attemptsLeft = 5 - user.verificationCodeAttempts;
    return res.status(400).json({
      message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
      attemptsLeft,
    });
  }

  // Verification successful!
  user.isEmailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  user.verificationCodeAttempts = 0;
  await user.save();

  // Generate JWT token for auto-login
  const token = jwt.sign(
    { id: user._id, role: 'player' },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax',
    maxAge: AUTH_CONSTANTS.COOKIE_MAX_AGE,
  };

  res.cookie("token", token, cookieOptions);

  res.status(200).json({
    success: true,
    message: "Email verified successfully!",
    token,
    player: {
      _id: user._id,
      email: user.email,
      username: user.username,
      isEmailVerified: true,
    },
  });
}));

// Resend verification code
router.post('/resend-verification', authLimiter, validateResendCode, asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await Player.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({ message: "Email is already verified" });
  }

  // Rate limiting: Check last email sent time (max 1 email per minute)
  if (user.lastVerificationEmailSent) {
    const timeSinceLastEmail = Date.now() - user.lastVerificationEmailSent.getTime();
    const oneMinute = 60 * 1000;

    if (timeSinceLastEmail < oneMinute) {
      const secondsLeft = Math.ceil((oneMinute - timeSinceLastEmail) / 1000);
      return res.status(429).json({
        message: `Please wait ${secondsLeft} seconds before requesting another code`,
        retryAfter: secondsLeft,
      });
    }
  }

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  const hashedCode = await bcrypt.hash(verificationCode, 10);
  const codeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  user.verificationCode = hashedCode;
  user.verificationCodeExpires = codeExpiry;
  user.verificationCodeAttempts = 0; // Reset attempts
  user.lastVerificationEmailSent = new Date();
  await user.save();

  // Send verification email (non-blocking)
  sendVerificationEmail(email, user.username, verificationCode).catch(err => {
    console.error('Failed to send verification email:', err);
  });

  res.status(200).json({
    success: true,
    message: "Verification code sent! Please check your email.",
  });
}));

// Check verification status
router.get('/verification-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await Player.findOne({ email }).select('isEmailVerified email username');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      email: user.email,
      username: user.username,
      isVerified: user.isEmailVerified,
    });

  } catch (error) {
    console.error("Verification status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// ==========================
// FORGOT PASSWORD - Request Password Reset
// ==========================
router.post('/forgot-password', authLimiter, validateForgotPassword, asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find player by email
  const player = await Player.findOne({ email }).select('+password +resetPasswordToken +resetPasswordExpiry');

  // Always return success message to prevent email enumeration attacks
  if (!player) {
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  }

  // Check if user uses Google OAuth and doesn't have a password
  if (!player.password && player.authProvider.includes('google') && !player.authProvider.includes('local')) {
    return res.status(400).json({
      success: false,
      message: "This account uses Google login only. Please sign in with Google.",
    });
  }

  // Check if a reset was recently requested (rate limiting)
  if (player.resetPasswordExpiry && player.resetPasswordExpiry > Date.now()) {
    const timeRemaining = Math.ceil((player.resetPasswordExpiry - Date.now()) / 1000 / 60);
    if (timeRemaining > 55) { // If less than 5 minutes have passed since last request
      return res.status(429).json({
        success: false,
        message: `Please wait ${timeRemaining - 55} more minute(s) before requesting another reset link.`,
      });
    }
  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Save hashed token and expiry to database
  player.resetPasswordToken = hashedToken;
  player.resetPasswordExpiry = Date.now() + AUTH_CONSTANTS.PASSWORD_RESET_TOKEN_EXPIRY;
  await player.save({ validateBeforeSave: false });

  // Create reset URL
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

  try {
    // Send password reset email
    await sendPasswordResetEmail(email, player.username, resetUrl);

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (emailError) {
    // If email fails, clear the reset token
    player.resetPasswordToken = null;
    player.resetPasswordExpiry = null;
    await player.save({ validateBeforeSave: false });

    console.error('Failed to send password reset email:', emailError);
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email. Please try again later.",
    });
  }
}));

// ==========================
// RESET PASSWORD - Reset Password with Token
// ==========================
router.post('/reset-password', authLimiter, validateResetPassword, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  // Hash the incoming token to compare with database
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find player with valid token and non-expired expiry
  const player = await Player.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiry: { $gt: Date.now() }, // Token must not be expired
  }).select('+password');

  if (!player) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired password reset token. Please request a new one.",
    });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  // Update password and clear reset token fields
  player.password = hashedPassword;
  player.resetPasswordToken = null;
  player.resetPasswordExpiry = null;

  // Add 'local' to authProvider if not already present (for Google users linking account)
  if (!player.authProvider.includes('local')) {
    player.authProvider.push('local');
  }

  await player.save();

  res.status(200).json({
    success: true,
    message: "Password has been reset successfully! You can now log in with your new password.",
  });
}));

// ==========================
// ORGANIZATION FORGOT PASSWORD - Request Password Reset
// ==========================
router.post('/organization/forgot-password', authLimiter, validateForgotPassword, asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find organization by email
  const org = await Organization.findOne({ email }).select('+password +resetPasswordToken +resetPasswordExpiry');

  // Always return success message to prevent email enumeration attacks
  if (!org) {
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  }

  // Check if a reset was recently requested (rate limiting)
  if (org.resetPasswordExpiry && org.resetPasswordExpiry > Date.now()) {
    const timeRemaining = Math.ceil((org.resetPasswordExpiry - Date.now()) / 1000 / 60);
    if (timeRemaining > 55) { // If less than 5 minutes have passed since last request
      return res.status(429).json({
        success: false,
        message: `Please wait ${timeRemaining - 55} more minute(s) before requesting another reset link.`,
      });
    }
  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Save hashed token and expiry to database
  org.resetPasswordToken = hashedToken;
  org.resetPasswordExpiry = Date.now() + AUTH_CONSTANTS.PASSWORD_RESET_TOKEN_EXPIRY;
  await org.save({ validateBeforeSave: false });

  // Create reset URL for organizations
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/organization/reset-password/${resetToken}`;

  try {
    // Send password reset email
    await sendPasswordResetEmail(email, org.orgName, resetUrl);

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (emailError) {
    // If email fails, clear the reset token
    org.resetPasswordToken = null;
    org.resetPasswordExpiry = null;
    await org.save({ validateBeforeSave: false });

    console.error('Failed to send password reset email:', emailError);
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email. Please try again later.",
    });
  }
}));

// ==========================
// ORGANIZATION RESET PASSWORD - Reset Password with Token
// ==========================
router.post('/organization/reset-password', authLimiter, validateResetPassword, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  // Hash the incoming token to compare with database
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find organization with valid token and non-expired expiry
  const org = await Organization.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiry: { $gt: Date.now() }, // Token must not be expired
  }).select('+password');

  if (!org) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired password reset token. Please request a new one.",
    });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  // Update password and clear reset token fields
  org.password = hashedPassword;
  org.resetPasswordToken = null;
  org.resetPasswordExpiry = null;

  await org.save();

  res.status(200).json({
    success: true,
    message: "Password has been reset successfully! You can now log in with your new password.",
  });
}));

// ==========================
// SET CUSTOM USERNAME (One-time for Google OAuth users)
// ==========================
router.post('/set-username', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.id;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    // Validate username format (3-20 chars, alphanumeric + underscore)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message: "Username must be 3-20 characters long and contain only letters, numbers, and underscores"
      });
    }

    const user = await Player.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if username already customized
    if (user.usernameCustomized) {
      return res.status(403).json({ message: "Username has already been set and cannot be changed" });
    }

    // Check if username is already taken
    const existingUser = await Player.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    // Update username and mark as customized
    user.username = username;
    user.usernameCustomized = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Username set successfully!",
      username: user.username,
    });

  } catch (error) {
    console.error("Set username error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// COMPLETE ORG PROFILE ROUTE
// ==========================
router.post('/complete-org-profile', verifyOrgToken, asyncHandler(async (req, res) => {
  try {
    const {
      orgName,
      ownerName,
      country,
      headquarters,
      description,
      contactPhone,
      website,
      orgInstagram,
      ownerInstagram
    } = req.body;

    const org = req.organization;

    if (!orgName || !ownerName || !country) {
      return res.status(400).json({ message: "Organization name, owner name and country are required" });
    }

    // Check if new orgName is already taken (if changed)
    if (orgName !== org.orgName) {
      const nameExists = await Organization.findOne({ orgName });
      if (nameExists) {
        return res.status(400).json({ message: "Organization name is already taken" });
      }
    }

    // Update fields
    org.orgName = orgName;
    org.ownerName = ownerName;
    org.country = country;
    org.headquarters = headquarters || '';
    org.description = description || '';
    org.contactPhone = contactPhone || '';
    org.orgSocial.website = website || '';
    org.orgSocial.instagram = orgInstagram || '';
    org.ownerSocial.instagram = ownerInstagram || '';

    // Mark as customized
    org.profileCustomized = true;

    await org.save();

    res.status(200).json({
      success: true,
      message: "Organization profile completed successfully!",
      organization: {
        id: org._id,
        orgName: org.orgName,
        approvalStatus: org.approvalStatus,
        profileCustomized: org.profileCustomized
      },
    });

  } catch (error) {
    console.error("Complete org profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
}));

// --- Logout Route (Same for all users) ---
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});


export default router;
