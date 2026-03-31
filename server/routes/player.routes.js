import express from 'express';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import Match from '../models/match.model.js';
import RatingEvent from '../models/ratingEvent.model.js';
import auth from '../middleware/auth.js';
import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';
import bcrypt from 'bcrypt';
import { AUTH_CONSTANTS } from '../config/constants.js';

// ============================================================================
// PHASE STATUS HELPER (mirrors team.routes.js)
// ============================================================================
function computePhaseStatus(registration, tournament) {
   const { phase: teamPhase, status: regStatus, finalPosition } = registration;
   const tStatus = tournament.status;
   const phases  = tournament.phases || [];
 
   if (regStatus === 'disqualified') return { label: 'Disqualified', type: 'eliminated' };
   if (regStatus === 'withdrawn')    return { label: 'Withdrawn',    type: 'neutral'   };
 
   if (tStatus === 'completed') {
     if (finalPosition) return { label: `#${finalPosition} Final`, type: 'completed' };
     return { label: 'Completed', type: 'completed' };
   }
 
   // Active tournament — derive current competition phase
   const teamPhaseDoc  = phases.find(p => p.name === teamPhase);
   const activePhase   = phases.find(p => p.status === 'in_progress');
   const startedPhases = phases.filter(p => p.status !== 'upcoming');
   const lastPhase     = startedPhases[startedPhases.length - 1];
 
   // SCALABILITY OPTIMIZATION for 1 Lakh+ users:
   // We use the indexed registration.phase string instead of scanning phase.teams[].
   const isTeamInActivePhase = teamPhaseDoc?.status === 'in_progress';
 
   if (isTeamInActivePhase) return { label: `In Phase: ${teamPhase}`, type: 'active' };
 
   if (teamPhaseDoc?.status === 'upcoming') {
     return { label: `Phase: ${teamPhase}`, type: 'pending' };
   }
 
   if (activePhase) {
     const isLastPhase = lastPhase && teamPhase && lastPhase.name === teamPhase;
     if (isLastPhase) {
       if (finalPosition) return { label: `#${finalPosition} Final`, type: 'completed' };
       return { label: `Phase: ${teamPhase}`, type: 'pending' };
     }
     const eliminatedAt = teamPhase || 'Qualifiers';
     return { label: `Eliminated: ${eliminatedAt}`, type: 'eliminated' };
   }

  if (tStatus === 'in_progress') {
    if (teamPhase) return { label: `Phase: ${teamPhase}`, type: 'pending' };
    return { label: 'In Progress', type: 'pending' };
  }

  return { label: tStatus?.replace(/_/g, ' ') || 'Unknown', type: 'neutral' };
}

const router = express.Router();

// ============================================================================
// AEGIS RATING ENDPOINTS (must be before /:id catch-all)
// ============================================================================

// GET /api/players/leaderboard/aegis — Paginated Aegis Rating leaderboard
router.get('/leaderboard/aegis', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const [total, players] = await Promise.all([
      Player.countDocuments({ aegisMatchesRated: { $gt: 0 } }),
      Player.find({ aegisMatchesRated: { $gt: 0 } })
        .select('username profilePicture aegisRating aegisRatingPeak aegisIsProvisional aegisMatchesRated tournamentsPlayed matchesPlayed team primaryGame inGameRole verified')
        .populate('team', 'teamName teamTag logo')
        .sort({ aegisRating: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    res.json({ players, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching Aegis leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get("/me", auth, async (req, res) => {
  try {
    // req.user.id is set by the auth middleware
    const userId = req.user.id;

    const user = await Player.findById(userId)
      .select(
        [
          // User fields
          "_id", "realName", "age", "location", "bio", "languages", "profilePicture", "gameIds", "earnings", "inGameRole", "teamStatus", "availability", "discordTag", "instagram", "youtube", "profileVisibility", "cardTheme", "username", "country", "aegisRating", "aegisRatingPeak", "aegisMatchesRated", "aegisIsProvisional", "sChampionships", "aChampionships", "sTopThree", "verified", "createdAt", "previousTeams", "team", "primaryGame", "tournamentsPlayed", "matchesPlayed", "statistics"
        ].join(" ")
      )
      .populate({
        path: 'team',
        select: [
          "_id", "teamName", "teamTag", "logo", "primaryGame", "region", "bio", "players", "captain"
        ].join(" "),
        populate: {
          path: 'captain',
          select: ["_id", "username", "profilePicture"].join(" ")
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



// Check username availability
router.get("/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        available: false,
        message: "Invalid username format"
      });
    }

    // Check if username exists
    const existingUser = await Player.findOne({ username });

    res.status(200).json({
      available: !existingUser,
      username
    });

  } catch (error) {
    console.error("Check username error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Update Profile Route ---
router.put("/update-profile", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = { ...req.body };

    // NEVER allow country to be changed — always India
    delete updateData.country;
    // NEVER allow primaryGame to be changed — always BGMI
    delete updateData.primaryGame;
    // inGameName is no longer a top-level field
    delete updateData.inGameName;

    // Sanitize empty strings to avoid validation errors with enums or numbers
    const fieldsToSanitize = ['teamStatus', 'availability', 'age', 'location', 'realName'];
    fieldsToSanitize.forEach(field => {
      if (updateData[field] === '') {
        delete updateData[field];
      }
    });

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

// --- Change Password Route ---
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    // Find player and include password for comparison
    const player = await Player.findById(userId).select("+password");
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Check if player has a password (might be Google OAuth only)
    if (!player.password) {
      return res.status(400).json({ 
        message: "Your account uses Google login. Please use 'Forgot Password' to set a local password first." 
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, player.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS || 10);
    player.password = hashedPassword;
    
    // Ensure 'local' is in authProvider if not already
    if (!player.authProvider.includes('local')) {
      player.authProvider.push('local');
    }

    await player.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================================================
// DASHBOARD DATA ENDPOINT (OPTIMIZED)
// ============================================================================

router.get('/dashboard-data', auth, async (req, res) => {
  try {
    console.log('🔍 Dashboard data endpoint hit');
    console.log('User from auth middleware:', req.user);

    // Validate user authentication
    if (!req.user || !req.user.id) {
      console.log('❌ No user found in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const playerId = req.user.id;
    const { tournamentLimit = 3, matchLimit = 3 } = req.query;

    console.log('✅ Player ID:', playerId);
    console.log('📊 Fetching dashboard data...');

    // PARALLEL EXECUTION: Run all queries simultaneously
    const [playerTeams, openTournaments] = await Promise.all([
      // Query 1: Get player's teams (needed for matches)
      Team.find({ players: playerId })
        .select('_id teamName')
        .lean(),

      // Query 2: Get open tournaments (independent query)
      Tournament.find({
        isOpenForAll: true,
        visibility: 'public',
        registrationStartDate: { $lte: new Date() },
        registrationEndDate: { $gte: new Date() }
      })
        .sort({ startDate: 1 })
        .limit(parseInt(tournamentLimit))
        .select(`
          tournamentName shortName gameTitle region subRegion tier status 
          startDate endDate prizePool media organizer participatingTeamsCount
          statistics slots registrationStartDate registrationEndDate tags
        `)
        .lean()
    ]);

    console.log('📋 Player teams found:', playerTeams.length);

    // Initialize response object
    const dashboardData = {
      tournaments: [],
      matches: [],
      playerTeamCount: playerTeams.length
    };

    // Get registration counts for each tournament (in parallel)
    const tournamentIds = openTournaments.map(t => t._id);
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

    // Create a map for quick lookup
    const countMap = new Map(
      registrationCounts.map(r => [r._id.toString(), r.count])
    );

    // Process tournaments with open registration status
    dashboardData.tournaments = openTournaments
      .filter(t => {
        const now = new Date();
        const participantCount = countMap.get(t._id.toString()) || t.participatingTeamsCount || 0;
        return now >= new Date(t.registrationStartDate) &&
          now <= new Date(t.registrationEndDate) &&
          participantCount < (t.slots?.total || 0);
      })
      .map(tournament => {
        const participantCount = countMap.get(tournament._id.toString()) ||
          tournament.participatingTeamsCount || 0;

        return {
          _id: tournament._id,
          tournamentName: tournament.tournamentName,
          shortName: tournament.shortName,
          gameTitle: tournament.gameTitle,
          region: tournament.region,
          subRegion: tournament.subRegion,
          tier: tournament.tier,
          status: tournament.status,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          prizePool: tournament.prizePool,
          media: tournament.media,
          organizer: tournament.organizer,
          participantCount,
          totalSlots: tournament.slots?.total || null,
          registrationStatus: 'Open',
          registrationStartDate: tournament.registrationStartDate,
          registrationEndDate: tournament.registrationEndDate,
          tags: tournament.tags,
          statistics: tournament.statistics
        };
      });

    // Only fetch matches if player has teams
    if (playerTeams.length > 0) {
      const teamIds = playerTeams.map(team => team._id);
      console.log('🎯 Searching for matches with team IDs:', teamIds);

      // Query 3: Get recent matches (only if player has teams)
      const matches = await Match.find({
        'results.team': { $in: teamIds },
        status: { $in: ['completed', 'in_progress'] }
      })
        .select('results map actualEndTime scheduledStartTime tournament')
        .sort({ actualEndTime: -1 })
        .limit(parseInt(matchLimit))
        .populate('results.team', 'teamName')
        .populate('tournament', 'tournamentName')
        .lean();

      console.log('🎮 Matches found:', matches.length);

      // Process matches efficiently
      const teamIdStrings = new Set(teamIds.map(id => id.toString()));

      dashboardData.matches = matches
        .map(match => {
          // Find player's team using Set for O(1) lookup
          const playerTeam = match.results?.find(team =>
            team.team && teamIdStrings.has(team.team._id.toString())
          );

          if (!playerTeam) {
            console.log('⚠️ Player team not found in match:', match._id);
            return null;
          }

          const otherTeams = match.results?.filter(
            team => team.team && !teamIdStrings.has(team.team._id.toString())
          ) || [];

          // Calculate score
          let score;
          if (playerTeam.finalPosition === 1) {
            score = 'Won #1';
          } else {
            const playerKills = playerTeam.kills?.total || 0;
            const otherKills = otherTeams.reduce((sum, t) => sum + (t.kills?.total || 0), 0);
            score = `${playerKills} - ${otherKills}`;
          }

          // Format time
          const date = match.actualEndTime || match.scheduledStartTime;
          const time = date
            ? new Date(date).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
            : 'Recent';

          return {
            _id: match._id,
            time,
            map: match.map || 'Unknown',
            team1: playerTeam.team?.teamName || 'Your Team',
            score,
            team2: otherTeams[0]?.team?.teamName || 'Others',
            tournamentName: match.tournament?.tournamentName || 'Unknown Tournament',
            finalPosition: playerTeam.finalPosition,
            kills: playerTeam.kills?.total || 0
          };
        })
        .filter(Boolean); // Remove null entries
    } else {
      console.log('⚠️ Player has no teams - skipping match query');
    }

    console.log('✅ Dashboard data compiled successfully');
    console.log('📊 Summary:', {
      tournaments: dashboardData.tournaments.length,
      matches: dashboardData.matches.length,
      teams: dashboardData.playerTeamCount
    });

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// ============================================================================
// GET RECENT OPEN TOURNAMENTS
// ============================================================================

router.get('/get-recent3-tourney', async (req, res) => {
  try {
    const { limit = 3 } = req.query;

    // Get tournaments with open registration
    const tournaments = await Tournament.find({
      isOpenForAll: true,
      visibility: 'public',
      registrationStartDate: { $lte: new Date() },
      registrationEndDate: { $gte: new Date() }
    })
      .sort({ startDate: 1 })
      .limit(parseInt(limit))
      .select(`
        tournamentName shortName gameTitle region subRegion tier status startDate endDate
        prizePool media organizer participatingTeamsCount statistics slots 
        registrationStartDate registrationEndDate tags
      `)
      .lean();

    // Get actual registration counts for these tournaments
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

    // Create map for quick lookup
    const countMap = new Map(
      registrationCounts.map(r => [r._id.toString(), r.count])
    );

    // Filter tournaments that are actually open
    const now = new Date();
    const openTournaments = tournaments.filter(t => {
      const participantCount = countMap.get(t._id.toString()) || t.participatingTeamsCount || 0;
      return now >= new Date(t.registrationStartDate) &&
        now <= new Date(t.registrationEndDate) &&
        participantCount < (t.slots?.total || 0);
    });

    // Enrich tournaments with participant data
    const enrichedTournaments = openTournaments.map(tournament => {
      const participantCount = countMap.get(tournament._id.toString()) ||
        tournament.participatingTeamsCount || 0;

      return {
        ...tournament,
        participantCount,
        totalSlots: tournament.slots?.total || null,
        registrationStatus: 'Open'
      };
    });

    res.json({ tournaments: enrichedTournaments });
  } catch (error) {
    console.error('Error fetching recent 3 tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch recent 3 tournaments' });
  }
});

router.get('/recent3matches', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const playerId = req.user.id;
    const playerTeams = await Team.find({ players: playerId })
      .select('_id teamName')
      .lean();

    const teamIds = playerTeams.map(team => team._id);

    if (teamIds.length === 0) {
      return res.json({ matches: [] });
    }

    const matches = await Match.find({
      'participatingTeams.team': { $in: teamIds },
      status: { $in: ['completed', 'in_progress'] }
    })
      .select('participatingTeams map actualEndTime scheduledStartTime tournament')
      .sort({ actualEndTime: -1 })
      .limit(3)
      .populate('participatingTeams.team', 'teamName')
      .populate('tournament', 'tournamentName')
      .lean();

    const teamIdStrings = new Set(teamIds.map(id => id.toString()));

    const formattedMatches = matches
      .map(match => {
        const playerTeam = match.participatingTeams.find(team =>
          team.team && teamIdStrings.has(team.team._id.toString())
        );

        if (!playerTeam) return null;

        const otherTeams = match.participatingTeams.filter(
          team => team.team && !teamIdStrings.has(team.team._id.toString())
        );

        let score;
        if (playerTeam.finalPosition === 1) {
          score = 'Won #1';
        } else {
          const playerKills = playerTeam.kills?.total || 0;
          const otherKills = otherTeams.reduce((sum, t) => sum + (t.kills?.total || 0), 0);
          score = `${playerKills} - ${otherKills}`;
        }

        const date = match.actualEndTime || match.scheduledStartTime;
        const time = date
          ? new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
          : 'Recent';

        return {
          _id: match._id,
          time,
          map: match.map || 'Unknown',
          team1: playerTeam.team?.teamName || 'Your Team',
          score,
          team2: otherTeams[0]?.team?.teamName || 'Others'
        };
      })
      .filter(Boolean);

    res.json({ matches: formattedMatches });

  } catch (error) {
    console.error('Error fetching recent matches:', error);
    res.status(500).json({
      error: 'Failed to fetch recent matches',
      details: error.message
    });
  }
});

// GET /api/players/:id/matches - Get player's match history with pagination
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Verify player exists (lean for speed)
    const player = await Player.findById(id).select('_id previousTeams').lean();
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Collect all team IDs: current + previous teams
    const currentTeams = await Team.find({ players: id }).select('_id').lean();
    const currentTeamIds = currentTeams.map(t => t._id);
    const previousTeamIds = (player.previousTeams || [])
      .map(pt => pt.team)
      .filter(Boolean);
    const allTeamIds = [...currentTeamIds, ...previousTeamIds];

    if (allTeamIds.length === 0) {
      return res.json({ matches: [], total: 0, page, totalPages: 0 });
    }

    // Use the correct schema field: results[].team (has an existing index)
    const filter = {
      'results.team': { $in: allTeamIds },
      status: { $in: ['completed', 'in_progress'] },
      visibility: 'public',
    };

    const [total, matches] = await Promise.all([
      Match.countDocuments(filter),
      Match.find(filter)
        .select('map tournamentPhase scheduledStartTime results tournament matchNumber')
        .sort({ scheduledStartTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tournament', 'tournamentName shortName media')
        .populate('results.team', 'teamName teamTag logo')
        .lean(),
    ]);

    // Strip results down to only the player's team entry per match
    const allTeamIdStrings = new Set(allTeamIds.map(t => t.toString()));
    const formattedMatches = matches.map(match => {
      const teamResult = (match.results || []).find(
        r => r.team && allTeamIdStrings.has(r.team._id.toString())
      );
      return {
        _id: match._id,
        matchNumber: match.matchNumber,
        map: match.map,
        tournamentPhase: match.tournamentPhase,
        scheduledStartTime: match.scheduledStartTime,
        tournament: match.tournament,
        teamResult: teamResult
          ? {
              team: teamResult.team,
              finalPosition: teamResult.finalPosition,
              kills: teamResult.kills?.total || 0,
              placementPoints: teamResult.points?.placementPoints || 0,
              killPoints: teamResult.points?.killPoints || 0,
              totalPoints: teamResult.points?.totalPoints || 0,
              chickenDinner: teamResult.chickenDinner || false,
            }
          : null,
      };
    });

    res.json({
      matches: formattedMatches,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching player matches:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/players/:id/tournaments - Get player's tournament history with pagination
router.get('/:id/tournaments', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const player = await Player.findById(id).select('_id previousTeams').lean();
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Collect all team IDs (current + previous)
    const currentTeams = await Team.find({ players: id }).select('_id').lean();
    const currentTeamIds = currentTeams.map(t => t._id);
    const previousTeamIds = (player.previousTeams || [])
      .map(pt => pt.team)
      .filter(Boolean);
    const allTeamIds = [...currentTeamIds, ...previousTeamIds];

    if (allTeamIds.length === 0) {
      return res.json({ tournaments: [], total: 0, page, totalPages: 0 });
    }

    // Registration is the single source of truth for team <-> tournament participation
    const filter = {
      team: { $in: allTeamIds },
      status: { $in: ['approved', 'checked_in', 'disqualified', 'withdrawn'] },
    };

    const [total, registrations] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .select('team status phase currentStage finalPosition prizeWon totalTournamentPoints totalTournamentKills matchesPlayed registeredAt')
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'tournament',
          select: 'tournamentName shortName gameTitle tier region status startDate endDate prizePool media finalStandings phases.name phases.status',
        })
        .populate('team', 'teamName teamTag logo')
        .lean(),
    ]);

    const tournaments = registrations
      .filter(reg => reg.tournament)
      .map(reg => {
        const standing = (reg.tournament.finalStandings || []).find(
          s => s.team && s.team.toString() === reg.team?._id?.toString()
        );
        return {
          _id: reg.tournament._id,
          registrationId: reg._id,
          tournamentName: reg.tournament.tournamentName,
          shortName: reg.tournament.shortName,
          gameTitle: reg.tournament.gameTitle,
          tier: reg.tournament.tier,
          region: reg.tournament.region,
          status: reg.tournament.status,
          startDate: reg.tournament.startDate,
          endDate: reg.tournament.endDate,
          prizePool: reg.tournament.prizePool?.total || 0,
          currency: reg.tournament.prizePool?.currency || 'INR',
          media: reg.tournament.media,
          team: reg.team,
          registrationStatus: reg.status,
          finalPosition: standing?.position || reg.finalPosition || null,
          prizeWon: reg.prizeWon?.amount || standing?.prize?.amount || 0,
          teamPhase: reg.phase,
          phaseStatus: computePhaseStatus(reg, reg.tournament),
          stats: {
            totalPoints: reg.totalTournamentPoints || 0,
            totalKills: reg.totalTournamentKills || 0,
            matchesPlayed: reg.matchesPlayed || 0,
          },
        };
      });

    res.json({
      tournaments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching player tournament history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/players/:id/profile - Get player profile details (excluding matches, tournaments, achievements)
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const player = await Player.findById(id)
      .select('_id username gameIds realName profilePicture verified primaryGame country location age teamStatus inGameRole team bio languages previousTeams createdAt discordTag instagram youtube twitter aegisRating aegisRatingPeak aegisRatingFloor aegisPrestigeFloor aegisMatchesRated aegisIsProvisional aegisLastRatedMatchAt sChampionships aChampionships sTopThree statistics')
      .populate({
        path: 'team',
        select: '_id teamName teamTag logo primaryGame region players captain',
        populate: {
          path: 'captain',
          select: '_id username profilePicture'
        }
      });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    // For team members grid, you may want to populate team.players with minimal info
    let teamMembers = [];
    if (player.team && player.team.players) {
      teamMembers = await Player.find({ _id: { $in: player.team.players } })
        .select('_id username profilePicture')
        .lean();
    }
    res.json({
      player,
      teamMembers
    });
  } catch (error) {
    console.error('Error fetching player profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/players/:id/rating-history — Paginated Aegis Rating history
router.get('/:id/rating-history', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [player, total, events] = await Promise.all([
      Player.findById(req.params.id)
        .select('aegisRating aegisRatingPeak aegisRatingFloor aegisPrestigeFloor aegisMatchesRated aegisIsProvisional aegisLastRatedMatchAt sChampionships aChampionships sTopThree')
        .lean(),
      RatingEvent.countDocuments({ player: req.params.id }),
      RatingEvent.find({ player: req.params.id })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('match', 'matchNumber map tournamentPhase')
        .populate('tournament', 'tournamentName tier')
        .lean(),
    ]);

    if (!player) return res.status(404).json({ message: 'Player not found' });
    res.json({ ...player, events, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching rating history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================================
// GAME ID MANAGEMENT ROUTES
// ============================================================================

// Helper function to check if player is in ongoing tournament
async function isPlayerInOngoingTournament(playerId) {
  try {
    // Find teams this player is in
    const teams = await Team.find({ players: playerId }).select('_id').lean();

    if (!teams || teams.length === 0) {
      return { inTournament: false };
    }

    const teamIds = teams.map(t => t._id);

    // Check if any of these teams are in ongoing tournaments
    const ongoingRegistration = await Registration.findOne({
      team: { $in: teamIds },
      status: { $in: ['approved', 'checked_in'] }
    })
      .populate('tournament', 'tournamentName status startDate endDate')
      .lean();

    if (!ongoingRegistration) {
      return { inTournament: false };
    }

    const tournament = ongoingRegistration.tournament;
    const now = new Date();

    // Check if tournament is actually ongoing
    const isOngoing =
      tournament &&
      (tournament.status === 'in_progress' ||
        (tournament.status === 'registration_open' && new Date(tournament.startDate) <= now) ||
        (new Date(tournament.startDate) <= now && new Date(tournament.endDate) >= now));

    if (isOngoing) {
      return {
        inTournament: true,
        tournamentName: tournament.tournamentName,
        tournamentId: tournament._id
      };
    }

    return { inTournament: false };
  } catch (error) {
    console.error('Error checking ongoing tournament:', error);
    return { inTournament: false };
  }
}

// Get player's game IDs
router.get('/game-ids', auth, async (req, res) => {
  try {
    const player = await Player.findById(req.user.id)
      .select('gameIds lastGameIdUpdate')
      .lean();

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Check if player is in ongoing tournament
    const tournamentStatus = await isPlayerInOngoingTournament(req.user.id);

    // Calculate next allowed update date
    let nextUpdateAllowed = null;
    if (player.lastGameIdUpdate) {
      nextUpdateAllowed = new Date(player.lastGameIdUpdate);
      nextUpdateAllowed.setMonth(nextUpdateAllowed.getMonth() + 1);
    }

    const canUpdate = !tournamentStatus.inTournament &&
      (!player.lastGameIdUpdate || new Date() >= nextUpdateAllowed);

    res.json({
      gameIds: player.gameIds || [],
      canUpdate,
      reason: !canUpdate ? (
        tournamentStatus.inTournament
          ? `Cannot update while participating in ${tournamentStatus.tournamentName}`
          : `Can update again after ${nextUpdateAllowed?.toLocaleDateString()}`
      ) : null,
      lastUpdate: player.lastGameIdUpdate,
      nextUpdateAllowed,
      tournamentStatus
    });
  } catch (error) {
    console.error('Error fetching game IDs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new game ID
router.post('/game-ids', auth, async (req, res) => {
  try {
    const { inGameName, characterId, isPrimary } = req.body;

    if (!inGameName || !characterId) {
      return res.status(400).json({ message: 'In-game name and character ID are required' });
    }

    const player = await Player.findById(req.user.id);

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Check if player already has 2 game IDs
    if (player.gameIds && player.gameIds.length >= 2) {
      return res.status(400).json({ message: 'Maximum 2 game IDs allowed. Please delete one to add another.' });
    }

    // Check if player is in ongoing tournament
    const tournamentStatus = await isPlayerInOngoingTournament(req.user.id);
    if (tournamentStatus.inTournament) {
      return res.status(403).json({
        message: `Cannot add game ID while participating in ${tournamentStatus.tournamentName}`,
        tournamentName: tournamentStatus.tournamentName
      });
    }

    // If this is the first game ID or isPrimary is true, make it primary
    const shouldBePrimary = !player.gameIds || player.gameIds.length === 0 || isPrimary;

    // If setting as primary, unset other primaries
    if (shouldBePrimary && player.gameIds) {
      player.gameIds.forEach(gameId => {
        gameId.isPrimary = false;
      });
    }

    // Add new game ID
    player.gameIds.push({
      inGameName: inGameName.trim(),
      characterId: characterId.trim(),
      isPrimary: shouldBePrimary,
      createdAt: new Date(),
      lastUpdatedAt: new Date()
    });

    await player.save();

    res.json({
      message: 'Game ID added successfully',
      gameIds: player.gameIds
    });
  } catch (error) {
    console.error('Error adding game ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update existing game ID
router.put('/game-ids/:gameIdIndex', auth, async (req, res) => {
  try {
    const { gameIdIndex } = req.params;
    const { inGameName, characterId } = req.body;

    if (!inGameName || !characterId) {
      return res.status(400).json({ message: 'In-game name and character ID are required' });
    }

    const player = await Player.findById(req.user.id);

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const index = parseInt(gameIdIndex);
    if (isNaN(index) || index < 0 || index >= player.gameIds.length) {
      return res.status(400).json({ message: 'Invalid game ID index' });
    }

    // Check if player is in ongoing tournament
    const tournamentStatus = await isPlayerInOngoingTournament(req.user.id);
    if (tournamentStatus.inTournament) {
      return res.status(403).json({
        message: `Cannot update game ID while participating in ${tournamentStatus.tournamentName}`,
        tournamentName: tournamentStatus.tournamentName
      });
    }

    // Check if update is allowed (once per month)
    if (player.lastGameIdUpdate) {
      const nextUpdateAllowed = new Date(player.lastGameIdUpdate);
      nextUpdateAllowed.setMonth(nextUpdateAllowed.getMonth() + 1);

      if (new Date() < nextUpdateAllowed) {
        return res.status(403).json({
          message: `You can update your game ID again after ${nextUpdateAllowed.toLocaleDateString()}`,
          nextUpdateAllowed
        });
      }
    }

    // Save old game ID to history
    const oldGameId = {
      inGameName: player.gameIds[index].inGameName,
      characterId: player.gameIds[index].characterId
    };

    player.gameIdUpdateHistory.push({
      updateDate: new Date(),
      oldGameId,
      newGameId: {
        inGameName: inGameName.trim(),
        characterId: characterId.trim()
      }
    });

    // Update game ID
    player.gameIds[index].inGameName = inGameName.trim();
    player.gameIds[index].characterId = characterId.trim();
    player.gameIds[index].lastUpdatedAt = new Date();
    player.lastGameIdUpdate = new Date();

    await player.save();

    res.json({
      message: 'Game ID updated successfully',
      gameIds: player.gameIds,
      nextUpdateAllowed: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
  } catch (error) {
    console.error('Error updating game ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete game ID
router.delete('/game-ids/:gameIdIndex', auth, async (req, res) => {
  try {
    const { gameIdIndex } = req.params;

    const player = await Player.findById(req.user.id);

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const index = parseInt(gameIdIndex);
    if (isNaN(index) || index < 0 || index >= player.gameIds.length) {
      return res.status(400).json({ message: 'Invalid game ID index' });
    }

    // Check if player is in ongoing tournament
    const tournamentStatus = await isPlayerInOngoingTournament(req.user.id);
    if (tournamentStatus.inTournament) {
      return res.status(403).json({
        message: `Cannot delete game ID while participating in ${tournamentStatus.tournamentName}`,
        tournamentName: tournamentStatus.tournamentName
      });
    }

    // Remove game ID
    const wasPrimary = player.gameIds[index].isPrimary;
    player.gameIds.splice(index, 1);

    // If deleted game ID was primary, make the first remaining one primary
    if (wasPrimary && player.gameIds.length > 0) {
      player.gameIds[0].isPrimary = true;
    }

    await player.save();

    res.json({
      message: 'Game ID deleted successfully',
      gameIds: player.gameIds
    });
  } catch (error) {
    console.error('Error deleting game ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set primary game ID
router.put('/game-ids/:gameIdIndex/set-primary', auth, async (req, res) => {
  try {
    const { gameIdIndex } = req.params;

    const player = await Player.findById(req.user.id);

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const index = parseInt(gameIdIndex);
    if (isNaN(index) || index < 0 || index >= player.gameIds.length) {
      return res.status(400).json({ message: 'Invalid game ID index' });
    }

    // Unset all primaries
    player.gameIds.forEach(gameId => {
      gameId.isPrimary = false;
    });

    // Set new primary
    player.gameIds[index].isPrimary = true;

    await player.save();

    res.json({
      message: 'Primary game ID updated successfully',
      gameIds: player.gameIds
    });
  } catch (error) {
    console.error('Error setting primary game ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;
