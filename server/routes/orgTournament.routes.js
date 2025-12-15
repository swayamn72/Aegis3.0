import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import cloudinary from '../config/cloudinary.js';
import upload from '../config/multer.js';

const router = express.Router();

const verifyOrgAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.role !== 'organization') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const organization = await Organization.findById(decoded.id);
    if (!organization || organization.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Organization not approved' });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get tournaments for organization dashboard (optimized for OrgDashboard component)
router.get('/my-tournaments', verifyOrgAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Build filter
    const filter = { 'organizer.organizationRef': req.organization._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch tournaments with ONLY the fields your component uses
    const tournaments = await Tournament.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(`
        _id
        tournamentName
        status
        startDate
        endDate
        media.banner
        slots.total
        participatingTeamsCount
        _approvalStatus
        _rejectionReason
      `)
      .lean();

    // Get total count for pagination (your component doesn't use this but included for completeness)
    const total = await Tournament.countDocuments(filter);

    // Get registration counts only if needed for display
    const tournamentIds = tournaments.map(t => t._id);
    const registrationCounts = await Registration.aggregate([
      {
        $match: {
          tournament: { $in: tournamentIds },
          status: { $in: ['approved', 'checked_in'] }
        }
      },
      {
        $group: {
          _id: '$tournament',
          count: { $sum: 1 }
        }
      }
    ]);

    // Create lookup map
    const countMap = new Map(
      registrationCounts.map(r => [r._id.toString(), r.count])
    );

    // Enrich tournaments with actual team counts
    const enrichedTournaments = tournaments.map(tournament => {
      const actualTeamCount = countMap.get(tournament._id.toString()) || 
                             tournament.participatingTeamsCount || 0;
      
      return {
        _id: tournament._id,
        tournamentName: tournament.tournamentName,
        status: tournament.status,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        media: {
          banner: tournament.media?.banner || null
        },
        slots: {
          total: tournament.slots?.total || 0
        },
        participatingTeams: {
          length: actualTeamCount // Your component expects this structure
        },
        _approvalStatus: tournament._approvalStatus,
        _rejectionReason: tournament._rejectionReason || null
      };
    });

    res.json({
      tournaments: enrichedTournaments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tournaments',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post(
  '/create-tournament',
  verifyOrgAuth,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      // ---------- SAFE JSON PARSE ----------
      let tournamentData;
      try {
        tournamentData = JSON.parse(req.body.tournamentData);
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid tournament data JSON',
          details: process.env.NODE_ENV === 'development' ? parseError.message : undefined
        });
      }

      // ---------- COMPREHENSIVE VALIDATION ----------
      const validationErrors = [];

      // Required fields
      if (!tournamentData.tournamentName?.trim()) {
        validationErrors.push('Tournament name is required');
      }
      if (!tournamentData.gameTitle) {
        validationErrors.push('Game title is required');
      }
      if (!tournamentData.startDate) {
        validationErrors.push('Start date is required');
      }
      if (!tournamentData.endDate) {
        validationErrors.push('End date is required');
      }

      // Date validation
      if (tournamentData.startDate && tournamentData.endDate) {
        const startDate = new Date(tournamentData.startDate);
        const endDate = new Date(tournamentData.endDate);
        const now = new Date();

        if (startDate < now) {
          validationErrors.push('Start date cannot be in the past');
        }
        if (endDate <= startDate) {
          validationErrors.push('End date must be after start date');
        }

        // Registration dates validation
        if (tournamentData.registrationStartDate && tournamentData.registrationEndDate) {
          const regStart = new Date(tournamentData.registrationStartDate);
          const regEnd = new Date(tournamentData.registrationEndDate);

          if (regEnd > startDate) {
            validationErrors.push('Registration must end before tournament starts');
          }
          if (regStart >= regEnd) {
            validationErrors.push('Registration end date must be after start date');
          }
        }
      }

      // Slots validation
      if (tournamentData.slots) {
        const total = tournamentData.slots.total;
        const invited = tournamentData.slots.invited || 0;
        const openReg = tournamentData.slots.openRegistrations || 0;

        if (!total || total < 2) {
          validationErrors.push('Tournament must have at least 2 team slots');
        }
        if (total > 1000) {
          validationErrors.push('Maximum 1000 teams allowed per tournament');
        }
        if (invited + openReg > total) {
          validationErrors.push('Invited + open registration slots cannot exceed total slots');
        }
      }

      // Prize pool validation
      if (tournamentData.prizePool?.total) {
        if (tournamentData.prizePool.total < 0) {
          validationErrors.push('Prize pool cannot be negative');
        }
        if (tournamentData.prizePool.total > 10000000000) { // 10 billion max
          validationErrors.push('Prize pool amount is unrealistic');
        }
      }

      // Return validation errors
      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: validationErrors
        });
      }

      // ---------- CHECK FOR DUPLICATE TOURNAMENT NAME ----------
      const existingTournament = await Tournament.findOne({
        tournamentName: new RegExp(`^${tournamentData.tournamentName.trim()}$`, 'i'),
        'organizer.organizationRef': req.organization._id
      }).select('_id').lean();

      if (existingTournament) {
        return res.status(409).json({
          error: 'A tournament with this name already exists for your organization'
        });
      }

      // ---------- PROCESS IMAGE UPLOADS ----------
      const mediaUrls = {};
      const uploadErrors = [];

      if (req.files) {
        const uploadPromises = Object.entries(req.files).map(async ([key, files]) => {
          const file = files?.[0];
          if (!file) return;

          // MIME validation
          if (!file.mimetype.startsWith('image/')) {
            uploadErrors.push(`${key} must be an image`);
            return;
          }

          // Size validation (5MB max)
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (file.size > maxSize) {
            uploadErrors.push(`${key} must be less than 5MB`);
            return;
          }

          try {
            const uploadResult = await new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                {
                  folder: `tournaments/${req.organization._id}`,
                  public_id: `${tournamentData.shortName || tournamentData.tournamentName}_${key}_${Date.now()}`,
                  overwrite: true,
                  resource_type: 'image',
                  transformation: [
                    // Optimize images
                    { width: key === 'logo' ? 500 : 1920, crop: 'limit' },
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                  ]
                },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              );
              stream.end(file.buffer);
            });

            mediaUrls[key] = uploadResult.secure_url;
          } catch (uploadError) {
            console.error(`Error uploading ${key}:`, uploadError);
            uploadErrors.push(`Failed to upload ${key}`);
          }
        });

        await Promise.all(uploadPromises);

        if (uploadErrors.length > 0) {
          return res.status(400).json({
            error: 'Image upload failed',
            errors: uploadErrors
          });
        }
      }

      // ---------- PREPARE TOURNAMENT DATA ----------
      const tournamentPayload = {
        // Basic info
        tournamentName: tournamentData.tournamentName.trim(),
        shortName: tournamentData.shortName?.trim() || 
                   tournamentData.tournamentName.trim().substring(0, 50),
        gameTitle: tournamentData.gameTitle,
        description: tournamentData.description?.trim() || '',

        // Classification
        tier: tournamentData.tier || 'Community',
        region: tournamentData.region || 'India',
        subRegion: tournamentData.subRegion?.trim() || '',

        // Organizer info
        organizer: {
          name: req.organization.orgName,
          organizationRef: req.organization._id,
          contactEmail: req.organization.email,
          website: req.organization.socials?.website || ''
        },

        // Sponsors (if provided)
        sponsors: Array.isArray(tournamentData.sponsors) ? 
                 tournamentData.sponsors : [],

        // Timeline
        announcementDate: tournamentData.announcementDate || new Date(),
        startDate: new Date(tournamentData.startDate),
        endDate: new Date(tournamentData.endDate),
        registrationStartDate: tournamentData.registrationStartDate ? 
                              new Date(tournamentData.registrationStartDate) : null,
        registrationEndDate: tournamentData.registrationEndDate ? 
                            new Date(tournamentData.registrationEndDate) : null,
        
        status: 'announced',
        isOpenForAll: tournamentData.isOpenForAll || false,

        // Structure
        format: tournamentData.format || 'Battle Royale Points System',
        formatDetails: tournamentData.formatDetails || '',
        
        slots: {
          total: tournamentData.slots?.total || 16,
          invited: tournamentData.slots?.invited || 0,
          openRegistrations: tournamentData.slots?.openRegistrations || 0,
          registered: 0
        },

        // Phases (if provided)
        phases: Array.isArray(tournamentData.phases) ? 
               tournamentData.phases.map(phase => ({
                 name: phase.name,
                 type: phase.type || 'qualifiers',
                 startDate: phase.startDate ? new Date(phase.startDate) : null,
                 endDate: phase.endDate ? new Date(phase.endDate) : null,
                 status: 'upcoming',
                 details: phase.details || '',
                 teams: [],
                 groups: Array.isArray(phase.groups) ? phase.groups : [],
                 qualificationRules: Array.isArray(phase.qualificationRules) ? 
                                    phase.qualificationRules : []
               })) : [],

        // Prize pool
        prizePool: {
          total: tournamentData.prizePool?.total || 0,
          currency: tournamentData.prizePool?.currency || 'INR',
          distribution: Array.isArray(tournamentData.prizePool?.distribution) ? 
                       tournamentData.prizePool.distribution : [],
          individualAwards: []
        },

        // Media
        media: {
          logo: mediaUrls.logo || tournamentData.media?.logo || '',
          banner: mediaUrls.banner || tournamentData.media?.banner || '',
          coverImage: mediaUrls.coverImage || tournamentData.media?.coverImage || ''
        },

        // Stream links (if provided)
        streamLinks: Array.isArray(tournamentData.streamLinks) ? 
                    tournamentData.streamLinks : [],

        // Social media (if provided)
        socialMedia: tournamentData.socialMedia || {},

        // Game settings
        gameSettings: tournamentData.gameSettings || {
          serverRegion: tournamentData.region || 'India',
          gameMode: 'TPP Squad',
          maps: ['Erangel', 'Miramar'],
          pointsSystem: {
            killPoints: 1,
            placementPoints: {
              1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
            }
          }
        },

        // Documentation
        rulesetDocument: tournamentData.rulesetDocument || '',
        websiteLink: tournamentData.websiteLink || '',

        // Administrative
        visibility: 'private', // Private until approved
        featured: false,
        verified: false,
        tags: Array.isArray(tournamentData.tags) ? tournamentData.tags : [],
        
        // Approval tracking
        _approvalStatus: 'pending',
        _submittedBy: req.organization._id,
        _submittedAt: new Date(),

        // Initialize stats
        participatingTeamsCount: 0,
        statistics: {
          totalMatches: 0,
          totalParticipatingTeams: 0,
          totalKills: 0,
          viewership: {
            currentViewers: 0,
            peakViewers: 0,
            averageViewers: 0,
            totalViews: 0,
            totalHoursWatched: 0
          }
        }
      };

      // ---------- CREATE TOURNAMENT ----------
      const newTournament = new Tournament(tournamentPayload);
      await newTournament.save();

      // ---------- LOG CREATION ----------
      console.log(`✅ Tournament created: ${newTournament.tournamentName} (${newTournament._id}) by ${req.organization.orgName}`);

      // ---------- SEND RESPONSE ----------
      res.status(201).json({
        success: true,
        message: 'Tournament submitted for admin approval',
        tournament: {
          _id: newTournament._id,
          tournamentName: newTournament.tournamentName,
          slug: newTournament.slug,
          status: newTournament.status,
          approvalStatus: newTournament._approvalStatus,
          startDate: newTournament.startDate,
          endDate: newTournament.endDate,
          media: newTournament.media
        }
      });

    } catch (error) {
      console.error('❌ Error creating tournament:', error);
      
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({
          error: `A tournament with this ${field} already exists`
        });
      }

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          error: 'Validation failed',
          errors
        });
      }

      res.status(500).json({
        error: 'Failed to create tournament',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


export default router;