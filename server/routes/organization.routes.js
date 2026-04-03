import express from 'express';
import Organization from '../models/organization.model.js';
import { verifyOrgToken } from '../middleware/orgAuth.js';
import { verifyAdminToken } from '../middleware/adminAuth.js';
import cloudinary from '../config/cloudinary.js';
import upload from '../config/multer.js';
import { validateUploadedImage } from '../utils/imageValidation.js';

const router = express.Router();

// Get all pending organizations (for admin review)
router.get('/pending', verifyAdminToken, async (req, res) => {
  try {
    // Use index and lean for performance
    const pendingOrgs = await Organization.find({ approvalStatus: 'pending' })
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .lean();

    res.success({ organizations: pendingOrgs });
  } catch (error) {
    console.error('Error fetching pending organizations:', error);
    res.fail(500, 'Error fetching pending organizations');
  }
});

// Get current organization profile (for session check)
router.get('/me', verifyOrgToken, async (req, res) => {
  try {
    const org = await Organization.findById(req.organization._id)
      .select('-password')
      .lean();
    if (!org) {
      return res.fail(404, 'Organization not found');
    }
    res.success(org);
  } catch (error) {
    res.fail(500, 'Server error');
  }
});

// Get organization profile
router.get('/profile', verifyOrgToken, async (req, res) => {
  try {
    const organization = await Organization.findById(req.organization._id)
      .populate('teams', 'teamName logo');

    res.success({ organization });

  } catch (error) {
    console.error('Error fetching organization profile:', error);
    res.fail(500, 'Error fetching profile', { error: error.message });
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
        return res.fail(400, 'No file uploaded');
      }

      await validateUploadedImage(req.file);

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

      // Save URL — use findByIdAndUpdate because req.organization is a plain
      // object (from the JWT middleware), NOT a Mongoose document
      await Organization.findByIdAndUpdate(
        req.organization._id,
        { logo: uploadResult.secure_url },
        { new: true }
      );

      res.success({
        message: 'Logo uploaded successfully',
        logoUrl: uploadResult.secure_url
      }, 200);
    } catch (error) {
      console.error('Logo upload error:', error);
      if (error.message?.includes('image')) {
        return res.fail(400, error.message);
      }
      res.fail(500, 'Error uploading logo');
    }
  }
);

export default router;