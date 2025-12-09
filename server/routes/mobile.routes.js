import express from 'express';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// GET /api/mobile/me - current logged-in player (mobile-friendly)
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    let user = await Player.findById(userId)
      .select(
        [
          // core identity
          "username","email","profilePicture","bio","age","country","location","realName","inGameName","primaryGame","inGameRole","languages",
          // status / meta
          "aegisRating","teamStatus","profileVisibility","cardTheme","coins","statistics","createdAt",
          // socials
          "discordTag","twitch","youtube","twitter",
          // team ref
          "team",
        ].join(" ")
      )
      .populate({
        path: "team",
        select: [
          "teamName","teamTag","logo","primaryGame","region","bio",
          "status","profileVisibility","aegisRating","totalEarnings",
          "lookingForPlayers","openRoles","establishedDate","statistics","winRatePercentage",
          "averageKillsPerMatch","players","captain",
        ].join(" "),
        populate: {
          path: "captain",
          select: "username profilePicture primaryGame aegisRating inGameName", 
        },
      })
      .lean(); // return plain object, not Mongoose doc

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Shape team data a bit for mobile
    if (user.team) {
      const team = user.team;

      const memberCount = Array.isArray(team.players) ? team.players.length : 0;

      // We don't need full players list here, just count
      delete team.players;

      user.team = {
        ...team,
        memberCount,
      };
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// GET /api/mobile/team/:id - Fetch team data (private route - only team members and captain)
router.get('/team/:id', auth, async (req, res) => {
  try {
    const teamId = req.params.id.trim();

    const team = await Team.findById(teamId)
      .populate('captain', 'username inGameName')
      .populate('players', 'username inGameName')
      .select('teamName teamTag logo captain players primaryGame bio establishedDate statistics recentResults socials status');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check if user is captain or a player in the team
    const isCaptain = team.captain._id.toString() === req.user.id.toString();
    const isPlayer = team.players.some(player => player._id.toString() === req.user.id.toString());

    if (!isCaptain && !isPlayer) {
      return res.status(403).json({ message: 'Access denied. Only team members can view this data.' });
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ message: 'Server error fetching team' });
  }
});


export default router;
