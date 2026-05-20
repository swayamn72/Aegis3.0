/**
 * Result Submission Routes
 *
 * Team-side:
 *   POST   /api/result-submissions/:matchId          — Submit screenshot(s)
 *   GET    /api/result-submissions/:matchId          — Get submissions for a match
 *   POST   /api/result-submissions/:submissionId/dispute — Dispute a result
 *
 * Org-side:
 *   GET    /api/result-submissions/org/:tournamentId — List all pending submissions
 *   PATCH  /api/result-submissions/:submissionId/review — Approve/reject (triggers match update)
 *   POST   /api/result-submissions/:submissionId/ocr-reprocess — Force OCR retry
 */

import express from 'express';
import multer from 'multer';
import { createHash } from 'crypto';
import cloudinary from '../config/cloudinary.js';
import { verifyToken } from '../middleware/auth.js';
import { verifyApprovedOrgToken } from '../middleware/orgAuth.js';
import ResultSubmission from '../models/resultSubmission.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import { processSubmissionOcr } from '../services/valorantOcr.service.js';
import notificationService from '../services/notification.service.js';
import logger from '../config/logger.js';
import { validateUploadedImage } from '../utils/imageValidation.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// ── Helper: upload buffer to Cloudinary ──────────────────────────────────────
async function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'aegis/result-submissions', resource_type: 'image', public_id: filename },
      (err, res) => err ? reject(err) : resolve(res.secure_url)
    );
    stream.end(buffer);
  });
}

// Hash-based filename to avoid exposing internal IDs in Cloudinary
function buildFilename(matchId, teamId, index) {
  const raw = `${matchId}:${teamId}:${index}:${Date.now()}`;
  return 'rs_' + createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

// ── Helper: verify player is in this match ────────────────────────────────────
async function getPlayerTeamForMatch(matchId, playerId) {
  const match = await Match.findById(matchId).select('tournament vsResults').lean();
  if (!match) return null;

  const reg = await Registration.findOne({
    tournament: match.tournament,
    'roster.player': playerId,
    status: { $in: ['approved', 'checked_in'] },
  }).select('team').lean();

  if (!reg) return null;
  return { match, teamId: reg.team.toString() };
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/result-submissions/:matchId
// Team member submits screenshots for a completed match
// ────────────────────────────────────────────────────────────────────────────
router.post('/:matchId', verifyToken, upload.array('screenshots', 5), async (req, res) => {
  try {
    const { matchId } = req.params;
    const playerId = req.user.id; // verifyToken sets req.user

    const ctx = await getPlayerTeamForMatch(matchId, playerId);
    if (!ctx) return res.status(403).json({ error: 'You are not registered in this match' });
    const { match, teamId } = ctx;

    if (match.status === 'cancelled') {
      return res.status(400).json({ error: 'Match is cancelled' });
    }

    // Check for existing pending/processed submission from this team
    const existing = await ResultSubmission.findOne({
      match: matchId,
      submittedByTeam: teamId,
      status: { $in: ['pending', 'ocr_processed', 'approved'] },
    });
    if (existing) {
      return res.status(409).json({
        error: 'Your team has already submitted a result for this match',
        submissionId: existing._id,
        status: existing.status,
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one screenshot is required' });
    }

    // Upload all screenshots to Cloudinary
    const screenshots = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      await validateUploadedImage(file, { maxBytes: 10 * 1024 * 1024 });
      const url = await uploadToCloudinary(
        file.buffer,
        buildFilename(matchId, teamId, i)
      );
      screenshots.push({
        url,
        label: req.body[`label_${i}`] || `Screenshot ${i + 1}`,
      });
    }

    const submission = await ResultSubmission.create({
      match: matchId,
      tournament: match.tournament,
      submittedByTeam: teamId,
      submittedByPlayer: playerId,
      screenshots,
    });

    // Kick off OCR on ALL screenshots asynchronously (not just the first)
    for (const ss of screenshots) {
      processSubmissionOcr(submission._id.toString(), ss.url)
        .catch(err => logger.error('ocr_background_error', { submissionId: submission._id, url: ss.url, error: err.message }));
    }

    // Notify org
    notificationService.notifyOrgForTournament(match.tournament, {
      title: '📸 Result Submitted',
      body: `A team has submitted a result for match #${match.matchNumber || matchId.slice(-4)}. Review required.`,
      data: { type: 'result_submission', matchId, submissionId: submission._id.toString() },
    }).catch(() => {});

    res.status(201).json({
      message: 'Screenshots uploaded. OCR processing in background.',
      submissionId: submission._id,
      status: submission.status,
    });
  } catch (err) {
    logger.error('result_submit_error', { error: err.message });
    res.status(500).json({ error: 'Failed to submit result' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/result-submissions/org/:tournamentId
// Org admin views all pending submissions for their tournament
// MUST be registered BEFORE /:matchId to avoid route shadowing
// ────────────────────────────────────────────────────────────────────────────
router.get('/org/:tournamentId', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { status = 'ocr_processed' } = req.query;
    const ALL_STATUSES = ['pending', 'ocr_processed', 'approved', 'disputed', 'cancelled'];

    const submissions = await ResultSubmission.find({
      tournament: req.params.tournamentId,
      status: status === 'all' ? { $in: ALL_STATUSES } : status,
    })
      .populate('match', 'matchNumber vsResults scheduledStartTime status map')
      .populate('submittedByTeam', 'teamName logo')
      .populate('submittedByPlayer', 'username inGameName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ submissions, count: submissions.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/result-submissions/:matchId
// Players + orgs can view submissions for a match
// ────────────────────────────────────────────────────────────────────────────
router.get('/:matchId', verifyToken, async (req, res) => {
  try {
    const submissions = await ResultSubmission.find({ match: req.params.matchId })
      .populate('submittedByTeam', 'teamName logo')
      .populate('submittedByPlayer', 'username inGameName profilePicture')
      .sort({ createdAt: -1 })
      .lean();

    // Strip ocrData.rawText from player-facing response (org-only debug field)
    const sanitized = submissions.map(s => {
      if (s.ocrData) {
        const { rawText, ...ocrSafe } = s.ocrData;
        return { ...s, ocrData: ocrSafe };
      }
      return s;
    });
    res.json({ submissions: sanitized });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/result-submissions/:submissionId/dispute
// Opposing team disputes the result
// ────────────────────────────────────────────────────────────────────────────
router.post('/:submissionId/dispute', verifyToken, async (req, res) => {
  try {
    const sub = await ResultSubmission.findById(req.params.submissionId).lean();
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (sub.status !== 'ocr_processed' && sub.status !== 'pending') {
      return res.status(400).json({ error: 'Can only dispute a pending or processed submission' });
    }

    const ctx = await getPlayerTeamForMatch(sub.match, req.user.id); // verifyToken sets req.user
    if (!ctx) return res.status(403).json({ error: 'Not authorized for this match' });

    // Can only dispute the other team's submission
    if (ctx.teamId === sub.submittedByTeam.toString()) {
      return res.status(400).json({ error: 'You cannot dispute your own team\'s submission' });
    }

    await ResultSubmission.findByIdAndUpdate(req.params.submissionId, {
      status: 'disputed',
      disputeRaisedBy: ctx.teamId,
      disputeReason: req.body.reason || 'No reason provided',
    });

    // Notify org about dispute
    notificationService.notifyOrgForTournament(sub.tournament, {
      title: '⚠️ Result Disputed',
      body: `A team has disputed a result submission. Manual review required.`,
      data: { type: 'result_disputed', submissionId: sub._id.toString(), matchId: sub.match.toString() },
    }).catch(() => {});

    res.json({ message: 'Dispute raised. Org admin will review.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to raise dispute' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/result-submissions/org/:tournamentId moved above /:matchId — see above
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/result-submissions/:submissionId/review
// Org admin approves or rejects — approval triggers match update
// ────────────────────────────────────────────────────────────────────────────
router.patch('/:submissionId/review', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { action, notes, manualResult } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }

    const sub = await ResultSubmission.findById(req.params.submissionId)
      .populate('match')
      .lean();
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    const update = {
      status: action === 'approve' ? 'approved' : 'disputed',
      reviewedBy: req.organization._id, // verifyApprovedOrgToken sets req.organization
      reviewedAt: new Date(),
      reviewNotes: notes,
    };

    // Use manual override if provided, else use OCR result
    const result = manualResult || sub.ocrData?.parsedResult || {};

    if (action === 'approve') {
      // Determine winner ObjectId from teamA/teamB string
      const match = await Match.findById(sub.match._id || sub.match);
      const teamAId = match.vsResults?.teamA?.toString();
      const teamBId = match.vsResults?.teamB?.toString();

      const winnerKey = manualResult?.winner || result?.winner;
      const winnerId = winnerKey === 'teamA' ? teamAId : teamBId;

      // Update the Match document
      await Match.findByIdAndUpdate(sub.match._id || sub.match, {
        status: 'completed',
        'vsResults.scoreA': result?.scoreA ?? 0,
        'vsResults.scoreB': result?.scoreB ?? 0,
        'vsResults.winner': winnerId,
        'vsResults.totalRounds': result?.totalRounds ?? 0,
        'metadata.ocrProcessed': !manualResult,
        'metadata.ocrProcessedAt': new Date(),
        'metadata.manuallyEntered': !!manualResult,
      });

      // Store player stats if available
      if (result?.playerStats?.length > 0) {
        // Map player IGNs to Player ObjectIds (best-effort)
        const regs = await Registration.find({
          tournament: sub.tournament,
          team: { $in: [teamAId, teamBId] },
        }).populate('roster.player', 'inGameName username').lean();

        const playersByName = new Map();
        for (const reg of regs) {
          const isTeamA = reg.team.toString() === teamAId;
          for (const slot of reg.roster || []) {
            if (!slot.player) continue;
            const key = (slot.player.inGameName || slot.player.username || '').toLowerCase();
            playersByName.set(key, { id: slot.player._id, team: isTeamA ? teamAId : teamBId });
          }
        }

        const mappedStats = result.playerStats.map(stat => {
          const key = (stat.playerName || '').toLowerCase();
          const found = playersByName.get(key);
          return {
            player: found?.id || null,
            team: stat.team === 'teamA' ? teamAId : teamBId,
            kills: stat.kills || 0,
            deaths: stat.deaths || 0,
            assists: stat.assists || 0,
            agent: stat.agent,
            acs: stat.acs || 0,
            adr: stat.adr || 0,
          };
        }).filter(s => s.player); // only include matched players

        if (mappedStats.length > 0) {
          await Match.findByIdAndUpdate(sub.match._id || sub.match, {
            'vsResults.playerStats': mappedStats,
          });
        }
      }

      if (manualResult) update.manualResult = manualResult;

      // Notify both teams — reuse match already fetched above
      const teamIds = [sub.submittedByTeam.toString()];
      const otherTeamId = match.vsResults?.teamA?.toString() === sub.submittedByTeam.toString()
        ? match.vsResults?.teamB?.toString()
        : match.vsResults?.teamA?.toString();
      if (otherTeamId) teamIds.push(otherTeamId);

      notificationService.notifyTeams(teamIds, sub.tournament, {
        title: '✅ Match Result Confirmed',
        body: 'The result for your match has been confirmed by the organizer.',
        data: { type: 'result_approved', matchId: (sub.match._id || sub.match).toString() },
      }).catch(() => {});
    }

    await ResultSubmission.findByIdAndUpdate(req.params.submissionId, update);

    res.json({ message: `Submission ${action === 'approve' ? 'approved' : 'rejected'}`, action });
  } catch (err) {
    logger.error('result_review_error', { error: err.message });
    res.status(500).json({ error: 'Review failed' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/result-submissions/:submissionId/ocr-reprocess
// Org can force a re-run of OCR (e.g., after image quality issues)
// ────────────────────────────────────────────────────────────────────────────
router.post('/:submissionId/ocr-reprocess', verifyApprovedOrgToken, async (req, res) => {
  try {
    const sub = await ResultSubmission.findById(req.params.submissionId).lean();
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    const primaryUrl = sub.screenshots?.[0]?.url;
    if (!primaryUrl) return res.status(400).json({ error: 'No screenshot to process' });

    // Async — do not block response
    processSubmissionOcr(sub._id.toString(), primaryUrl)
      .catch(err => logger.error('ocr_reprocess_error', { submissionId: sub._id, error: err.message }));

    res.json({ message: 'OCR re-processing started', submissionId: sub._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start re-processing' });
  }
});

export default router;
