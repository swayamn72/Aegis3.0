import mongoose from 'mongoose';
import express from 'express';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import Match from '../models/match.model.js';

const router = express.Router();
// ============================================================================
// GET ALL TOURNAMENTS (WITH FILTERS AND PAGINATION)
// ============================================================================

router.get('/all', async (req, res) => {
  try {
    const { page = 1, limit = 50, game, region, status, tier, subRegion } = req.query;

    // Build filter query
    const filter = {
      visibility: 'public'
    };

    if (game) filter.gameTitle = game;
    if (region) filter.region = region;
    if (subRegion) filter.subRegion = subRegion;
    if (status) filter.status = status;
    if (tier) filter.tier = tier;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch main tournaments (without participatingTeams population)
    const tournaments = await Tournament.find(filter)
      .sort({ startDate: -1, featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(`
        tournamentName shortName gameTitle region subRegion tier status startDate endDate
        prizePool media.logo organizer participatingTeamsCount slots featured verified tags
      `)
      .lean();

    // Fetch live tournaments
    const liveTournaments = await Tournament.findLive(10)
      .select(`
        tournamentName shortName gameTitle region subRegion tier status startDate endDate
        prizePool media.logo organizer participatingTeamsCount streamLinks tags
      `)
      .lean();

    // Fetch upcoming tournaments
    const upcomingTournaments = await Tournament.findUpcoming(20)
      .select(`
        tournamentName shortName gameTitle region subRegion tier status startDate endDate
        prizePool media.logo organizer participatingTeamsCount slots registrationStartDate registrationEndDate tags
      `)
      .lean();

    // Get all tournament IDs for batch registration count query
    const allTournamentIds = [
      ...tournaments.map(t => t._id),
      ...liveTournaments.map(t => t._id),
      ...upcomingTournaments.map(t => t._id)
    ];

    // Fetch actual registration counts in one query (OPTIMIZED)
    const registrationCounts = await Registration.aggregate([
      {
        $match: {
          tournament: { $in: allTournamentIds },
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

    // Helper function to get participant count
    const getParticipantCount = (tournament) => {
      return countMap.get(tournament._id.toString()) ||
        tournament.participatingTeamsCount ||
        0;
    };

    // Calculate additional fields for main tournaments
    const enrichedTournaments = tournaments.map(tournament => ({
      ...tournament,
      // Get accurate participant count
      participantCount: getParticipantCount(tournament),
      totalSlots: tournament.slots?.total || null,
      // Format dates properly
      startDate: tournament.startDate ? new Date(tournament.startDate).toISOString() : null,
      endDate: tournament.endDate ? new Date(tournament.endDate).toISOString() : null,
      // Ensure media has default values
      media: {
        logo: tournament.media?.logo || null,
        banner: tournament.media?.banner || null,
        coverImage: tournament.media?.coverImage || null
      },
      // Ensure organizer has default
      organizer: {
        name: tournament.organizer?.name || 'Unknown Organizer'
      },
      // Calculate registration status
      registrationStatus: calculateRegistrationStatus(tournament)
    }));

    // Enrich live tournaments
    const enrichedLiveTournaments = liveTournaments.map(tournament => ({
      ...tournament,
      participantCount: getParticipantCount(tournament),
      isLive: isLive(tournament),
      hasActiveStreams: tournament.streamLinks?.length > 0,
      registrationStatus: calculateRegistrationStatus(tournament)
    }));

    // Enrich upcoming tournaments
    const enrichedUpcomingTournaments = upcomingTournaments.map(tournament => ({
      ...tournament,
      participantCount: getParticipantCount(tournament),
      totalSlots: tournament.slots?.total || null,
      registrationStatus: calculateRegistrationStatus(tournament),
      daysUntilStart: tournament.startDate ?
        Math.ceil((new Date(tournament.startDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
    }));

    const total = await Tournament.countDocuments(filter);

    res.json({
      success: true,
      tournaments: enrichedTournaments,
      liveTournaments: enrichedLiveTournaments,
      upcomingTournaments: enrichedUpcomingTournaments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + enrichedTournaments.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournaments',
      message: error.message
    });
  }
});

// ============================================================================
// GET SINGLE TOURNAMENT BY ID (COMPREHENSIVE DATA)
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mobile, includeMatches = 'true' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    // Fetch tournament (no participatingTeams population)
    const tournament = await Tournament.findById(id)
      .populate({
        path: 'phases.teams',
        select: 'teamName logo teamTag',
        options: { limit: mobile === 'true' ? 20 : 100 }
      })
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Parallel queries for optimal performance
    const [
      registrations,
      phaseStandings,
      recentMatches,
      matchStats
    ] = await Promise.all([
      // Get all registrations for this tournament
      Registration.find({
        tournament: id,
        status: { $in: ['approved', 'checked_in'] }
      })
        .populate('team', mobile === 'true' ?
          'teamName teamTag logo' :
          'teamName teamTag logo primaryGame region establishedDate'
        )
        .select('team qualifiedThrough currentStage phase group')
        .limit(mobile === 'true' ? 50 : 500)
        .lean(),

      // Get phase standings if phases exist
      tournament.phases && tournament.phases.length > 0 ?
        PhaseStanding.find({ tournament: id })
          .populate('topTeams.team', 'teamName teamTag logo')
          .lean() :
        Promise.resolve([]),

      // Fetch matches only if needed
      includeMatches === 'true' ?
        Match.find({ tournament: id })
          .sort({ scheduledStartTime: -1 })
          .limit(mobile === 'true' ? 10 : 20)
          .populate('participatingTeams.team', 'teamName teamTag')
          .select(`
            matchNumber matchType tournamentPhase scheduledStartTime actualStartTime 
            actualEndTime status map participatingTeams matchStats
          `)
          .lean() :
        Promise.resolve([]),

      // Match stats aggregation
      Match.aggregate([
        { $match: { tournament: new mongoose.Types.ObjectId(id), status: 'completed' } },
        {
          $group: {
            _id: null,
            totalMatches: { $sum: 1 },
            totalKills: { $sum: '$matchStats.totalKills' },
            totalDamage: { $sum: '$matchStats.totalDamage' },
            avgMatchDuration: { $avg: '$matchStats.matchDuration' }
          }
        }
      ])
    ]);

    const liveStats = matchStats[0] || {};

    // Build tournament data
    const tournamentData = {
      _id: tournament._id,
      name: tournament.tournamentName,
      shortName: tournament.shortName,
      game: tournament.gameTitle,
      region: tournament.region,
      tier: tournament.tier,
      status: tournament.status,
      currentPhase: tournament.currentCompetitionPhase,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      registrationStartDate: tournament.registrationStartDate,
      registrationEndDate: tournament.registrationEndDate,
      teams: registrations.length,
      totalSlots: tournament.slots?.total || 0,

      // Participating teams from Registration collection
      participatingTeams: registrations.map(reg => ({
        team: {
          _id: reg.team._id,
          teamName: reg.team.teamName,
          teamTag: reg.team.teamTag,
          logo: reg.team.logo,
          ...(mobile !== 'true' && {
            primaryGame: reg.team.primaryGame,
            region: reg.team.region,
            establishedDate: reg.team.establishedDate
          })
        },
        group: reg.group,
        qualifiedThrough: reg.qualifiedThrough,
        currentStage: reg.currentStage,
        phase: reg.phase
      })),

      description: tournament.description ||
        `${tournament.tournamentName} is a competitive ${tournament.gameTitle} tournament featuring top teams from ${tournament.region}.`,

      media: {
        banner: tournament.media?.banner || null,
        coverImage: tournament.media?.coverImage || null,
        logo: tournament.media?.logo || null
      },

      organizer: {
        name: tournament.organizer?.name || 'AEGIS Esports',
        website: tournament.organizer?.website || null,
        contactEmail: tournament.organizer?.contactEmail || null
      },

      format: tournament.format || 'Battle Royale Points System',
      formatDetails: tournament.formatDetails,

      gameSettings: tournament.gameSettings || {
        serverRegion: tournament.region || 'Asia',
        gameMode: 'TPP Squad',
        maps: ['Erangel', 'Miramar', 'Sanhok'],
        pointsSystem: {
          killPoints: 1,
          placementPoints: {
            1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
          }
        }
      },

      prizePool: tournament.prizePool || {
        total: 0,
        currency: 'INR',
        distribution: [],
        individualAwards: []
      },

      phases: tournament.phases?.map(phase => ({
        _id: phase._id,
        name: phase.name,
        type: phase.type,
        status: phase.status,
        startDate: phase.startDate,
        endDate: phase.endDate,
        description: phase.details,
        teams: phase.teams || [],
        groups: phase.groups?.map(g => ({
          name: g.name,
          teams: g.teams || []
          // Standings removed - will be fetched separately
        })) || []
      })) || [],

      statistics: {
        totalMatches: liveStats.totalMatches || 0,
        totalParticipatingTeams: registrations.length,
        totalKills: liveStats.totalKills || 0,
        totalDamage: liveStats.totalDamage || 0,
        avgMatchDuration: liveStats.avgMatchDuration || 0,
        ...(tournament.statistics?.viewership && {
          viewership: tournament.statistics.viewership
        })
      },

      streamLinks: tournament.streamLinks?.map(stream => ({
        platform: stream.platform,
        url: stream.url,
        language: stream.language,
        isOfficial: stream.isOfficial || false
      })) || [],

      socialMedia: tournament.socialMedia || {},

      featured: tournament.featured || false,
      verified: tournament.verified || false
    };

    // Build schedule data
    const scheduleData = recentMatches.map(match => ({
      _id: match._id,
      phase: match.tournamentPhase || 'Group Stage',
      match: `Match ${match.matchNumber}`,
      matchType: match.matchType,
      teams: match.participatingTeams?.slice(0, 2).map(pt =>
        pt.team?.teamName || 'TBD'
      ).join(' vs ') || 'TBD vs TBD',
      map: match.map,
      date: match.scheduledStartTime ?
        new Date(match.scheduledStartTime).toISOString().split('T')[0] : null,
      time: match.scheduledStartTime ?
        new Date(match.scheduledStartTime).toTimeString().slice(0, 5) : null,
      status: match.status,
      actualStartTime: match.actualStartTime,
      actualEndTime: match.actualEndTime
    }));

    // Build groups data with standings from Standing collection
    const groupsData = {};
    if (tournament.phases && tournament.phases.length > 0) {
      for (const phase of tournament.phases) {
        if (phase.groups && phase.groups.length > 0) {
          groupsData[phase.name] = {};

          for (const group of phase.groups) {
            const groupKey = group.name?.replace('Group ', '') || 'A';

            // Fetch standings for this group
            const standings = await Standing.find({
              tournament: id,
              phase: phase.name,
              group: group.name
            })
              .sort({ position: 1 })
              .populate('team', 'teamName teamTag logo')
              .select('team position matchesPlayed points kills chickenDinners')
              .lean();

            groupsData[phase.name][groupKey] = {
              teams: group.teams?.map(team => ({
                _id: team._id,
                name: team.teamName || 'Unknown Team',
                tag: team.teamTag,
                logo: team.logo || null
              })) || [],
              standings: standings.map(standing => ({
                team: {
                  _id: standing.team._id,
                  name: standing.team.teamName,
                  tag: standing.team.teamTag,
                  logo: standing.team.logo
                },
                position: standing.position,
                matchesPlayed: standing.matchesPlayed || 0,
                points: standing.points || 0,
                kills: standing.kills || 0,
                chickenDinners: standing.chickenDinners || 0
              }))
            };
          }
        }
      }
    }

    res.json({
      tournamentData,
      scheduleData: includeMatches === 'true' ? scheduleData : [],
      groupsData,
      tournamentStats: tournamentData.statistics,
      streamLinks: tournamentData.streamLinks,
      phaseStandings: phaseStandings // Include phase summaries
    });

  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({ error: 'Failed to fetch tournament details' });
  }
});

// Update groups for a specific phase
router.put('/:id/groups', async (req, res) => {
  try {
    const { id } = req.params;
    const { groups, phaseId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(phaseId)) {
      return res.status(400).json({ error: 'Invalid tournament or phase ID' });
    }

    if (!groups || !Array.isArray(groups)) {
      return res.status(400).json({ error: 'Groups must be a non-empty array' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check authorization (admin only for now) - temporarily disabled for testing
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required to update groups' });
    // }

    // Validate phase exists
    const phaseIndex = tournament.phases.findIndex(p => p._id.toString() === phaseId);
    if (phaseIndex === -1) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    // Validate team IDs
    for (const group of groups) {
      for (const teamId of group.teams) {
        if (!mongoose.Types.ObjectId.isValid(teamId)) {
          return res.status(400).json({ error: `Invalid team ID: ${teamId}` });
        }
      }
    }

    // Ensure teams are ObjectIds
    const validatedGroups = groups.map(group => ({
      ...group,
      teams: group.teams.map(teamId => new mongoose.Types.ObjectId(teamId))
    }));

    // Update the specific phase's groups using arrayFilters
    const updatedTournament = await Tournament.findOneAndUpdate(
      { _id: id },
      { $set: { 'phases.$[phase].groups': validatedGroups } },
      {
        arrayFilters: [{ 'phase._id': phaseId }],
        new: true,
        runValidators: true
      }
    );

    if (!updatedTournament) {
      return res.status(500).json({ error: 'Failed to update groups' });
    }

    res.json({
      message: 'Groups updated successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('Error updating groups:', error);
    res.status(500).json({ error: 'Failed to update groups', details: error.message });
  }
}); 

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Calculate registration status (replaces virtual)
function calculateRegistrationStatus(tournament) {
  const now = new Date();

  if (!tournament.status) return 'Unknown';
  if (tournament.status === 'cancelled') return 'Cancelled';
  if (tournament.status === 'completed') return 'Completed';
  if (tournament.status === 'in_progress') return 'Live';

  if (!tournament.registrationStartDate || !tournament.registrationEndDate) {
    return 'Closed';
  }

  const regStart = new Date(tournament.registrationStartDate);
  const regEnd = new Date(tournament.registrationEndDate);

  if (now < regStart) return 'Upcoming';

  if (now >= regStart && now <= regEnd) {
    const participantCount = tournament.participantCount ||
      tournament.participatingTeamsCount || 0;
    if (participantCount >= (tournament.slots?.total || 0)) {
      return 'Slots Full';
    }
    return 'Open';
  }

  if (now > regEnd) return 'Closed';

  return 'Unknown';
}

// Check if tournament is live (replaces method)
function isLive(tournament) {
  const now = new Date();
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);

  return (startDate <= now && endDate >= now &&
    ['in_progress', 'qualifiers_in_progress', 'group_stage', 'playoffs', 'finals']
      .includes(tournament.status));
}

export default router;