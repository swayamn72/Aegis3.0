import express from 'express';
import Organization from '../models/organization.model.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import cloudinary from '../config/cloudinary.js';
import upload from '../config/multer.js';

const router = express.Router();

// Get current organization profile (for session check)
router.get('/me', verifyOrgToken, async (req, res) => {
  try {
    const org = await Organization.findById(req.organization._id).select('-password');
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    res.json(org);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get organization profile
router.get('/profile', verifyOrgToken, async (req, res) => {
  try {
    const organization = await Organization.findById(req.organization._id)
      .populate('teams', 'teamName logo');

    res.json({ organization });

  } catch (error) {
    console.error('Error fetching organization profile:', error);
    res.status(500).json({
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// POST /api/organizations/upload-logo
router.post(
  '/upload-logo',
  verifyOrgToken,
  upload.single('logo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Basic file type validation
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: 'Only image files are allowed' });
      }

      const organization = req.organization;

      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'organization_logos',
            public_id: `org_${organization._id}`, // deterministic ID
            overwrite: true,                     // replaces old logo
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      // Save URL
      organization.logo = uploadResult.secure_url;
      await organization.save();

      res.status(200).json({
        message: 'Logo uploaded successfully',
        logoUrl: uploadResult.secure_url
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      res.status(500).json({
        message: 'Error uploading logo'
      });
    }
  }
);

export default router;