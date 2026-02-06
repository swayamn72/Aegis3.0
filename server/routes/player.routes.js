import express from 'express';
import Player from '../models/player.model.js';
import Team from '../models/team.model.js';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import Match from '../models/match.model.js';
import auth from '../middleware/auth.js';
import upload from '../config/multer.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// Get current user profile
router.get("/me", auth, async (req, res) => {
  try {
    // req.user.id is set by the auth middleware
    const userId = req.user.id;

    const user = await Player.findById(userId)
      .select(
        [
          // User fields
          "_id", "realName", "age", "location", "bio", "languages", "profilePicture", "inGameName", "earnings", "inGameRole", "teamStatus", "availability", "discordTag", "twitch", "youtube", "profileVisibility", "cardTheme", "username", "country", "aegisRating", "verified", "createdAt", "previousTeams", "team", "primaryGame", "tournamentsPlayed", "matchesPlayed"
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
        'participatingTeams.team': { $in: teamIds },
        status: 'completed'
      })
        .select('participatingTeams map actualEndTime scheduledStartTime tournament')
        .sort({ actualEndTime: -1 })
        .limit(parseInt(matchLimit))
        .populate('participatingTeams.team', 'teamName')
        .populate('tournament', 'tournamentName')
        .lean();

      console.log('🎮 Matches found:', matches.length);

      // Process matches efficiently
      const teamIdStrings = new Set(teamIds.map(id => id.toString()));

      dashboardData.matches = matches
        .map(match => {
          // Find player's team using Set for O(1) lookup
          const playerTeam = match.participatingTeams.find(team =>
            team.team && teamIdStrings.has(team.team._id.toString())
          );

          if (!playerTeam) {
            console.log('⚠️ Player team not found in match:', match._id);
            return null;
          }

          const otherTeams = match.participatingTeams.filter(
            team => team.team && !teamIdStrings.has(team.team._id.toString())
          );

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
      status: 'completed'
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
    const limit = parseInt(req.query.limit) || 5;
    const skip = parseInt(req.query.skip) || 0;

    // Verify player exists
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Find player's team
    const team = await Team.findOne({ players: id }).select('_id');

    if (!team) {
      // Player has no team, return empty matches
      return res.json({ matches: [] });
    }

    // Find matches where the player's team participated
    const matches = await Match.find({
      $or: [
        { 'team1._id': team._id },
        { 'team2._id': team._id }
      ]
    })
      .populate('tournament', 'name game')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ matches });
  } catch (error) {
    console.error('Error fetching player matches:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/players/:id/profile - Get player profile details (excluding matches, tournaments, achievements)
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const player = await Player.findById(id)
      .select('_id username inGameName realName profilePicture verified primaryGame country location age teamStatus inGameRole team bio languages previousTeams createdAt discordTag twitch youtube twitter')
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
        .select('_id username inGameName profilePicture')
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



export default router;
