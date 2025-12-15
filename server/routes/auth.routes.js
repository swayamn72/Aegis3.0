import express from 'express';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyOrgToken } from '../middleware/orgAuth.js';

const router = express.Router();

// ==========================
//   PLAYER SIGNUP ROUTE
// ==========================
router.post('/signup', async (req, res) => {
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

    const newPlayer = await Player.create({
      email,
      password: hashedPassword,
      username,
    });

    const token = jwt.sign({ id: newPlayer._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    res.status(201).json({
      message: "Signup successful",
      token,
      player: {
        id: newPlayer._id,
        email: newPlayer.email,
        username: newPlayer.username,
      },
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================
//   PLAYER LOGIN ROUTE
// ==========================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await Player.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
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

// --- Logout Route (Same for all users) ---
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});


export default router;
