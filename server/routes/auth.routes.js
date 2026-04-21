import express from 'express';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import Team from '../models/team.model.js';
import LFTPost from '../models/lftPost.model.js';
import LFPPost from '../models/lfpPost.model.js';
import DirectMessageRequest from '../models/directMessageRequest.model.js';
import TeamInvitation from '../models/teamInvitation.model.js';
import TeamApplication from '../models/teamApplication.model.js';
import RecruitmentApproach from '../models/recruitmentApproach.model.js';
import Notification from '../models/notification.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import auth from '../middleware/auth.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { sendVerificationEmail, generateVerificationCode, sendPasswordResetEmail, sendAccountDeletionEmail } from '../config/email.js';
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

const GOOGLE_ALLOWED_CLIENT_IDS = [
  process.env.GOOGLE_CLIENT_ID,
  ...(process.env.GOOGLE_ALLOWED_CLIENT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
].filter(Boolean);

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error('Missing idToken');
  }

  const audiences = GOOGLE_ALLOWED_CLIENT_IDS.length
    ? GOOGLE_ALLOWED_CLIENT_IDS
    : [undefined];

  let lastError;
  for (const audience of audiences) {
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        ...(audience ? { audience } : {}),
      });
      return ticket.getPayload();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to verify Google ID token');
}

// Strict rate limiter for auth endpoints (login/signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// ==========================
//   PLAYER SIGNUP ROUTE
// ==========================
router.post('/signup', authLimiter, validatePlayerSignup, asyncHandler(async (req, res) => {
  const { email, password, username, agreedToGuidelines } = req.body;

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
    agreedToGuidelines,
    guidelinesAcceptedAt: new Date(),
    isEmailVerified: false,
    verificationCode: hashedCode,
    verificationCodeExpires: codeExpiry,
    lastVerificationEmailSent: new Date(),
  });

  try {
    await sendVerificationEmail(email, username, verificationCode);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    await newPlayer.updateOne({ $unset: { lastVerificationEmailSent: 1 } });
    return res.status(502).json({
      success: false,
      message: "Account created, but we couldn't send the verification code. Please tap resend.",
      requiresVerification: true,
      email: newPlayer.email,
      emailSent: false,
    });
  }

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
      profilePicture: user.profilePicture,
      age: user.age,
      location: user.location,
      country: user.country,
      primaryGame: user.primaryGame,
      teamStatus: user.teamStatus,
      availability: user.availability,
      discordTag: user.discordTag,
      instagram: user.instagram,
      youtube: user.youtube,
      twitter: user.twitter,
      agreedToGuidelines: user.agreedToGuidelines ?? false,
    },
  });
}));

// ==========================
//   GOOGLE OAUTH LOGIN
// ==========================
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, idToken, accessToken, role = 'player' } = req.body;
    const effectiveIdToken = idToken || credential;
    const effectiveAccessToken = accessToken || (!idToken ? credential : null);

    if (!effectiveIdToken && !effectiveAccessToken) {
      return res.status(400).json({ message: "Google token is required" });
    }

    let googleId, email, name, picture;

    // Verify server-side.
    // Path 1: ID token verification with one of the allowed client IDs.
    // Path 2: Access token lookup via Google UserInfo endpoint.
    try {
      const payload = await verifyGoogleIdToken(effectiveIdToken);
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } catch (idTokenError) {
      console.log('idToken verification failed, trying access_token path:', idTokenError.message);

      if (!effectiveAccessToken) {
        return res.status(401).json({
          message: "Invalid Google idToken",
          error: idTokenError.message,
        });
      }

      try {
        const { default: fetch } = await import('node-fetch');
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${effectiveAccessToken}` } }
        );

        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          console.error('Google UserInfo API failed:', userInfoResponse.status, errorText);
          return res.status(401).json({ message: "Invalid Google credential", details: errorText });
        }

        const payload = await userInfoResponse.json();

        if (!payload.sub || !payload.email) {
          console.error('Google UserInfo response missing sub/email:', payload);
          return res.status(401).json({ message: "Invalid Google credential — missing user info" });
        }

        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (accessTokenError) {
        console.error('Google verification failed (Access Token Path):', accessTokenError.message);
        return res.status(401).json({ message: "Invalid Google credential", error: accessTokenError.message });
      }
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
        discordTag: user.discordTag,
        instagram: user.instagram,
        youtube: user.youtube,
        twitter: user.twitter,
        agreedToGuidelines: user.agreedToGuidelines ?? false,
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
    ownerSocial,
    agreedToGuidelines
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
    agreedToGuidelines,
    guidelinesAcceptedAt: new Date(),
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

  try {
    await sendVerificationEmail(email, orgName, verificationCode);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    await newOrg.updateOne({ $unset: { lastVerificationEmailSent: 1 } });
    return res.status(502).json({
      success: false,
      message: "Organization created, but we couldn't send the verification code. Please tap resend.",
      requiresVerification: true,
      email: newOrg.email,
      emailSent: false,
    });
  }

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

  try {
    await sendVerificationEmail(email, user.username, verificationCode);
  } catch (err) {
    console.error('Failed to send verification email:', err);
    user.lastVerificationEmailSent = undefined;
    await user.save();
    return res.status(502).json({
      success: false,
      message: "Couldn't send verification code right now. Please try again.",
      emailSent: false,
    });
  }

  res.status(200).json({
    success: true,
    message: "Verification code sent! Please check your email.",
  });
}));

// Check verification status
// Bug #10: Returns a generic response regardless of whether the user exists
// to prevent email enumeration attacks.
router.get('/verification-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await Player.findOne({ email }).select('isEmailVerified').lean();

    // Always return 200 to prevent email enumeration — if user doesn't exist,
    // simply report unverified.
    res.status(200).json({
      isVerified: user?.isEmailVerified ?? false,
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

    const org = await Organization.findById(req.organization._id);

    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

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

    if (!org.orgSocial) org.orgSocial = {};
    if (!org.ownerSocial) org.ownerSocial = {};

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

// ==========================

// Helper function to process account deletion
async function processAccountDeletion(id, role) {
  const deletionEmail = `deleted_${id}_${Date.now()}@deleted.aegis`;
  const randomSecret = crypto.randomBytes(48).toString('hex');
  const randomizedHash = await bcrypt.hash(randomSecret, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  if (role === 'organization') {
    const org = await Organization.findById(id);
    if (!org) return false;

    org.orgName = `deleted_org_${String(id).slice(-8)}_${Date.now()}`;
    org.ownerName = 'Deleted Organization';
    org.email = deletionEmail;
    org.password = randomizedHash;
    org.googleId = undefined;
    org.logo = '';
    org.country = 'Deleted';
    org.headquarters = '';
    org.description = '';
    org.contactPhone = '';
    org.isEmailVerified = false;
    org.profileCustomized = false;
    org.orgSocial = {
      instagram: '', twitter: '', facebook: '', linkedin: '', youtube: '', website: ''
    };
    org.ownerSocial = {
      instagram: '', twitter: '', facebook: '', linkedin: '', youtube: '', website: ''
    };
    org.verificationCode = undefined;
    org.verificationCodeExpires = undefined;
    org.verificationCodeAttempts = 0;
    org.lastVerificationEmailSent = undefined;
    org.resetPasswordToken = null;
    org.resetPasswordExpiry = null;
    org.deleteAccountToken = null;
    org.deleteAccountExpiry = null;

    await org.save();

    await Team.updateMany(
      { organization: id },
      { $set: { organization: null } }
    );
  } else {
    const player = await Player.findById(id).select('+password');
    if (!player) return false;

    await LFTPost.deleteMany({ player: id });

    await Team.updateMany(
      { players: id },
      { $pull: { players: id } }
    );

    const teamsToProcess = await Team.find({ captain: id });
    for (const team of teamsToProcess) {
      if (team.players.length > 0) {
        team.captain = team.players[0];
        await team.save();
      } else {
        team.status = 'disbanded';
        team.lookingForPlayers = false;
        await team.save();
        await LFPPost.deleteMany({ team: team._id });
      }
    }

    await RecruitmentApproach.deleteMany({ 
      $or: [{ player: id }, { 'targetTeam.captain': id }] 
    });

    await DirectMessageRequest.deleteMany({
      $or: [{ requester: id }, { recipient: id }]
    });

    await TeamInvitation.deleteMany({
      $or: [{ player: id }, { invitedBy: id }]
    });
    await TeamApplication.deleteMany({
      player: id
    });

    player.email = deletionEmail;
    player.realName = '';
    player.age = null;
    player.password = randomizedHash;
    player.googleId = undefined;
    player.profilePicture = '';
    player.discordTag = '';
    player.instagram = '';
    player.youtube = '';
    player.twitter = '';
    player.bio = '';
    player.location = '';
    player.fcmToken = null;
    player.isEmailVerified = false;
    player.authProvider = ['local'];
    player.verificationCode = undefined;
    player.verificationCodeExpires = undefined;
    player.verificationCodeAttempts = 0;
    player.lastVerificationEmailSent = undefined;
    player.resetPasswordToken = null;
    player.resetPasswordExpiry = null;
    player.deleteAccountToken = null;
    player.deleteAccountExpiry = null;

    await player.save();
  }

  await Notification.deleteMany({ recipient: id });
  return true;
}


// DELETE ACCOUNT (Player/Organization)
// ==========================
router.delete('/delete-account', auth, asyncHandler(async (req, res) => {
  const { id, role } = req.user;

  if (role !== 'organization' && role !== 'player') {
    return res.status(403).json({ message: 'Unsupported account type' });
  }

  const success = await processAccountDeletion(id, role);
  if (!success) {
      return res.status(404).json({ message: 'Account not found' });
  }

  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
}));

// ==========================
// REQUEST ACCOUNT DELETION (Unauthenticated via Email)
// ==========================
const requestDeletionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: 'Too many deletion requests. Please try again later.' }
});

router.post('/request-account-deletion', requestDeletionLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
  }

  // Find user (Player or Organization)
  let user = await Player.findOne({ email });
  let role = 'player';
  
  if (!user) {
      user = await Organization.findOne({ email });
      role = 'organization';
  }

  // Always return success to prevent email enumeration
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists, a deletion link has been sent.',
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  user.deleteAccountToken = hashedToken;
  user.deleteAccountExpiry = Date.now() + 15 * 60 * 1000; // 15 mins
  await user.save({ validateBeforeSave: false });

  const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-delete-account/${token}`;

  try {
      await sendAccountDeletionEmail(email, user.username || user.orgName, confirmUrl);
      res.status(200).json({
          success: true,
          message: 'If an account exists, a deletion link has been sent.',
      });
  } catch (error) {
      user.deleteAccountToken = null;
      user.deleteAccountExpiry = null;
      await user.save({ validateBeforeSave: false });
      
      console.error('Failed to send account deletion email:', error);
      return res.status(500).json({
          success: false,
          message: 'Failed to send account deletion email. Please try again later.',
      });
  }
}));

// ==========================
// CONFIRM ACCOUNT DELETION
// ==========================
router.post('/confirm-account-deletion', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  let user = await Player.findOne({
      deleteAccountToken: hashedToken,
      deleteAccountExpiry: { $gt: Date.now() },
  });
  let role = 'player';

  if (!user) {
      user = await Organization.findOne({
          deleteAccountToken: hashedToken,
          deleteAccountExpiry: { $gt: Date.now() },
      });
      role = 'organization';
  }

  if (!user) {
      return res.status(400).json({
          success: false,
          message: 'Invalid or expired deletion token.',
      });
  }

  const success = await processAccountDeletion(user._id, role);
  if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to process deletion' });
  }

  res.status(200).json({
      success: true,
      message: 'Your account has been permanently deleted.',
  });
}));

// --- Logout Route (Same for all users) ---
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});


export default router;
