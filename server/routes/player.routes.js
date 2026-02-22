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
          "_id", "realName", "age", "location", "bio", "languages", "profilePicture", "gameIds", "earnings", "inGameRole", "teamStatus", "availability", "discordTag", "twitch", "youtube", "profileVisibility", "cardTheme", "username", "country", "aegisRating", "verified", "createdAt", "previousTeams", "team", "primaryGame", "tournamentsPlayed", "matchesPlayed"
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
        status: 'completed'
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
      .select('_id username gameIds realName profilePicture verified primaryGame country location age teamStatus inGameRole team bio languages previousTeams createdAt discordTag twitch youtube twitter')
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
