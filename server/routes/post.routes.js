// POST /api/posts
import express from 'express';
import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.js'; // assume configured in ./config/cloudinary.js
import auth from '../middleware/auth.js';
import upload from '../config/multer.js'; // your multer memoryStorage
import Post from '../models/post.model.js';
import Player from '../models/player.model.js';
import sanitizeHtml from 'sanitize-html';

const router = express.Router();

// Helpers
const isVideo = (mimetype) => mimetype.startsWith('video/');
const isImage = (mimetype) => mimetype.startsWith('image/');
const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.slice(0, 20);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 20);
  } catch (e) {
    // fallback: allow comma separated string "tag1,tag2"
    return String(raw).split(',').map(t => t.trim()).filter(Boolean).slice(0, 20);
  }
  return [];
};

// POST /api/posts
router.post('/', auth, upload.array('media', 5), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rawCaption = (req.body.caption || '').trim();
    if (!rawCaption) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Caption is required' });
    }

    // sanitize caption (strip scripts, keep basic formatting if you want)
    const caption = sanitizeHtml(rawCaption, {
      allowedTags: ['b','i','em','strong','a','p','br'],
      allowedAttributes: { 'a': ['href','target','rel'] },
    });

    // parse tags robustly
    const tags = parseTags(req.body.tags);

    // Validate files (extra checks)
    const files = req.files || [];
    if (files.length > 5) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Max 5 media files allowed' });
    }

    // Upload in parallel but limit concurrency to avoid spikes
    // We'll create an array of upload promises and run Promise.allSettled so one failure won't kill all
    const uploadPromises = files.map(file => {
      return new Promise((resolve) => {
        const resource_type = isVideo(file.mimetype) ? 'video' : 'image';
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type,
            folder: 'aegis_posts',
            transformation: resource_type === 'image' ? [{ width: 1600, quality: 'auto' }] : undefined,
            // for videos you may want eager thumbnails, but that can be handled separately
          },
          (error, result) => {
            if (error) return resolve({ ok: false, error: error.message });
            resolve({
              ok: true,
              url: result.secure_url,
              public_id: result.public_id,
              resource_type,
              bytes: result.bytes,
              format: result.format,
              width: result.width,
              height: result.height,
            });
          }
        );
        stream.end(file.buffer);
      });
    });

    const uploadResults = files.length ? await Promise.allSettled(uploadPromises) : [];

    // Collect successful uploads and record failures
    const media = [];
    const failedUploads = [];
    for (const r of uploadResults) {
      if (r.status === 'fulfilled' && r.value && r.value.ok) {
        media.push({
          type: r.value.resource_type === 'video' ? 'video' : 'image',
          url: r.value.url,
          publicId: r.value.public_id,
          meta: {
            bytes: r.value.bytes,
            format: r.value.format,
            width: r.value.width,
            height: r.value.height
          }
        });
      } else {
        failedUploads.push(r.status === 'fulfilled' ? r.value.error : (r.reason && r.reason.message) || 'unknown');
      }
    }

    // If all uploads failed -> abort
    if (files.length > 0 && media.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(502).json({ message: 'Failed to upload media', details: failedUploads });
    }

    // Create post doc
    const newPost = new Post({
      author: req.user.id,
      caption,
      media,
      tags,
      createdAt: new Date(),
      visibility: req.body.visibility || 'public'
    });

    await newPost.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Optionally populate minimal author info
    await newPost.populate('author', 'username profilePicture');

    // If there were some failed uploads, still return 201 but mention partial failure
    if (failedUploads.length) {
      return res.status(201).json({
        message: 'Post created with some upload failures',
        post: newPost,
        uploadWarnings: failedUploads
      });
    }

    return res.status(201).json({ message: 'Post created successfully', post: newPost });
  } catch (error) {
    console.error('Error creating post:', error);

    try { await session.abortTransaction(); } catch (_) {}
    session.endSession();

    // If any uploads succeeded but DB failed, you may want to queue cleanup of those public_ids
    return res.status(500).json({ message: 'Error creating post', error: error.message });
  }
});

// GET /api/posts/player/:id?page=1&limit=20&includeMedia=true
router.get('/player/:id', async (req, res) => {
  try {
    const { id: playerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ message: 'Invalid player id' });
    }

    // Pagination & query params
    const rawPage = parseInt(req.query.page, 10) || 1;
    const rawLimit = parseInt(req.query.limit, 10) || 20;
    const page = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), 100); // cap at 100

    const includeMedia = req.query.includeMedia === 'true'; // default false (reduce payload)

    // check profile visibility
    const player = await Player.findById(playerId).select('profileVisibility _id');
    if (!player) return res.status(404).json({ message: 'Player not found' });
    if (player.profileVisibility === 'private') {
      // optionally require auth to access private profile
      return res.status(403).json({ message: 'Player profile is private' });
    }

    // Build projection to reduce payload
    const fields = [
      'author',
      'caption',
      'createdAt',
      'likesCount',
      'commentsCount',
      'tags',
      'visibility'
    ];
    if (includeMedia) fields.push('media');

    const projection = fields.join(' ');

    // total count (fast if indexed by author)
    const [total, posts] = await Promise.all([
      Post.countDocuments({ author: playerId }),
      Post.find({ author: playerId })
        .select(projection)
        .populate('author', 'username inGameName profilePicture') // minimal author
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const totalPages = Math.ceil(total / limit);

    // Optionally add simple caching headers (client/CDN)
    res.set('Cache-Control', 'public, max-age=60'); // 60s caching; tune as needed
    res.set('X-Total-Count', String(total));

    return res.json({
      meta: {
        page,
        limit,
        total,
        totalPages
      },
      posts
    });
  } catch (error) {
    console.error('Error fetching player posts:', error);
    return res.status(500).json({ message: "Error fetching player's posts" });
  }
});

export default router;
