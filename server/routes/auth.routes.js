import express from 'express';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import auth from '../middleware/auth.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { sendVerificationEmail, generateVerificationCode } from '../config/email.js';

const router = express.Router();

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingEmail = await Player.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const existingUsername = await Player.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verificationCode = generateVerificationCode();
    const hashedCode = await bcrypt.hash(verificationCode, 10);
    const codeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const newPlayer = await Player.create({
      email,
      password: hashedPassword,
      username,
      isEmailVerified: false,
      verificationCode: hashedCode,
      verificationCodeExpires: codeExpiry,
      lastVerificationEmailSent: new Date(),
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, username, verificationCode);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but notify user
      return res.status(201).json({
        success: true,
        message: "Registration successful, but failed to send verification email. Please try resending.",
        email: newPlayer.email,
        userId: newPlayer._id,
        requiresVerification: true,
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

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
//   PLAYER LOGIN ROUTE
// ==========================
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await Player.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if email is verified (only for local auth users)
    if (user.authProvider.includes('local') && !user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        requiresVerification: true,
        email: user.email,
        userId: user._id,
      });
    }

    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google login only" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: 'player' },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
//   GOOGLE OAUTH LOGIN
// ==========================
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, userInfo } = req.body;

    if (!credential && !userInfo) {
      return res.status(400).json({ message: "Google credential or user info is required" });
    }

    let googleId, email, name, picture;

    // If userInfo is provided directly (from useGoogleLogin hook)
    if (userInfo) {
      googleId = userInfo.sub;
      email = userInfo.email;
      name = userInfo.name;
      picture = userInfo.picture;
    } else {
      // Verify the Google ID token (from GoogleLogin component)
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

    // Check if user exists with this Google ID
    let user = await Player.findOne({ googleId });

    if (!user) {
      // Check if user exists with this email (from regular signup)
      user = await Player.findOne({ email });

      if (user) {
        // User exists with email but not Google ID - link accounts
        user.googleId = googleId;

        // Add 'google' to authProvider array if not already present
        if (!user.authProvider.includes('google')) {
          user.authProvider.push('google');
        }

        if (picture && !user.profilePicture) {
          user.profilePicture = picture;
        }
        await user.save();
      } else {
        // Create new user
        const username = email.split('@')[0] + '_' + Date.now();

        user = await Player.create({
          email,
          googleId,
          username,
          realName: name || '',
          profilePicture: picture || '',
          authProvider: ['google'],
          verified: true, // Google users are pre-verified
          isEmailVerified: true, // Google emails are verified
          usernameCustomized: false, // Flag to prompt username selection
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: 'player' },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Google login successful",
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
        profilePicture: user.profilePicture,
        usernameCustomized: user.usernameCustomized,
      },
    });

  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

// ==========================
// ORGANIZATION SIGNUP ROUTE
// ==========================
router.post('/organization/signup', async (req, res) => {
  try {
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
      ownerSocial
    } = req.body;

    // Validation
    if (!orgName || !ownerName || !email || !password || !country) {
      return res.status(400).json({
        message: "Organization name, owner name, email, password, and country are required"
      });
    }

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
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organization with pending status
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
      socials: { website: website || '' },
      approvalStatus: 'pending',
      emailVerified: false,
    });

    res.status(201).json({
      message: "Organization registration submitted successfully. Please wait for admin approval.",
      organization: {
        id: newOrg._id,
        orgName: newOrg.orgName,
        email: newOrg.email,
        approvalStatus: newOrg.approvalStatus,
      },
    });

  } catch (error) {
    console.error("Organization signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
// ORGANIZATION LOGIN ROUTE
// ==========================
router.post('/organization/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find organization and include password field
    const org = await Organization.findOne({ email }).select('+password');
    if (!org) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password first (regardless of approval status)
    const isPasswordValid = await bcrypt.compare(password, org.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT with role (allow login for all approval statuses)
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

  } catch (error) {
    console.error("Organization login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
//   EMAIL VERIFICATION ROUTES
// ==========================

// Verify email with 6-digit code
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

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

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Server error during verification" });
  }
});

// Resend verification code
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

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

    // Send verification email
    try {
      await sendVerificationEmail(email, user.username, verificationCode);

      res.status(200).json({
        success: true,
        message: "Verification code sent! Please check your email.",
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(500).json({
        message: "Failed to send verification email. Please try again later.",
      });
    }

  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

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

// --- Logout Route (Same for all users) ---
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});


export default router;
