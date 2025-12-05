import express from 'express';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import auth from '../middleware/auth.js';
import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';


const router = express.Router();

// Get current user profile
router.get("/me", auth, async (req, res) => {
  try {
    // req.user.id is set by the auth middleware
    const userId = req.user.id;

    const user = await Player.findById(userId).select("-password").populate({
      path: 'team',
      populate: {
        path: 'captain'
      }
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Update Profile Route ---
router.put("/update-profile", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Validate required fields if provided
    if (updateData.age && (updateData.age < 13 || updateData.age > 99)) {
      return res.status(400).json({ message: "Age must be between 13 and 99" });
    }

    // Update the player document
    const updatedPlayer = await Player.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      player: updatedPlayer
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// --- Upload Profile Picture Route ---
router.post("/upload-pfp", auth, upload.single('profilePicture'), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'aegis-pfps',
          public_id: `pfp-${userId}-${Date.now()}`,
          transformation: [{ width: 300, height: 300, crop: 'fill' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    // Update player with new PFP URL
    const updatedPlayer = await Player.findByIdAndUpdate(
      userId,
      { $set: { profilePicture: result.secure_url } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      profilePicture: result.secure_url,
      player: updatedPlayer
    });
  } catch (error) {
    console.error("Upload PFP error:", error);
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
