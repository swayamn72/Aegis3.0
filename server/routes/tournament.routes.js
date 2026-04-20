import mongoose from 'mongoose';
import express from 'express';
import Tournament from '../models/tournament.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import Match from '../models/match.model.js';
import Team from '../models/team.model.js';
import TournamentAnnouncement from '../models/tournamentAnnouncement.model.js';
import auth from '../middleware/auth.js';

const router = express.Router();
// ============================================================================
// GET ALL TOURNAMENTS (WITH FILTERS AND PAGINATION)
// ============================================================================

router.get('/all', async (req, res) => {
  try {
    const { page = 1, game, region, status, tier, subRegion } = req.query;
    // Clamp limit: default 20, max 100 — prevents large scans via user-controlled input
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 100);

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

    // PARALLELIZED: Run all four queries simultaneously instead of sequentially
    const [tournaments, liveTournaments, upcomingTournaments, total] = await Promise.all([
      // Query 1: Main filtered tournaments
      Tournament.find(filter)
        .sort({ startDate: -1, featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(`
          tournamentName shortName gameTitle region subRegion tier status startDate endDate
          prizePool media.logo organizer participatingTeamsCount slots featured verified tags
        `)
        .lean(),

      // Query 2: Live tournaments
      Tournament.findLive(10)
        .select(`
          tournamentName shortName gameTitle region subRegion tier status startDate endDate
          prizePool media.logo organizer participatingTeamsCount streamLinks tags
        `)
        .lean(),

      // Query 3: Upcoming tournaments
      Tournament.findUpcoming(20)
        .select(`
          tournamentName shortName gameTitle region subRegion tier status startDate endDate
          prizePool media.logo organizer participatingTeamsCount slots registrationStartDate registrationEndDate tags
        `)
        .lean(),

      // Query 4: Total count for pagination
      Tournament.countDocuments(filter),
    ]);

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
    const enrichedTournaments = tournaments.map(tournament => {
      const actualCount = getParticipantCount(tournament);
      return {
        ...tournament,
        // Get accurate participant count
        participantCount: actualCount,
        participatingTeamsCount: actualCount, // Sync with DB field for frontend consistency
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
      };
    });

    // Enrich live tournaments
    const enrichedLiveTournaments = liveTournaments.map(tournament => {
      const actualCount = getParticipantCount(tournament);
      return {
        ...tournament,
        participantCount: actualCount,
        participatingTeamsCount: actualCount,
        isLive: isLive(tournament),
        hasActiveStreams: tournament.streamLinks?.length > 0,
        registrationStatus: calculateRegistrationStatus(tournament)
      };
    });

    // Enrich upcoming tournaments
    const enrichedUpcomingTournaments = upcomingTournaments.map(tournament => {
      const actualCount = getParticipantCount(tournament);
      return {
        ...tournament,
        participantCount: actualCount,
        participatingTeamsCount: actualCount,
        totalSlots: tournament.slots?.total || null,
        registrationStatus: calculateRegistrationStatus(tournament),
        daysUntilStart: tournament.startDate ?
          Math.ceil((new Date(tournament.startDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
      };
    });

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
      .populate({
        path: 'phases.groups.teams',
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
      // Get all approved registrations in ONE query (no nested loops later)
      Registration.find({
        tournament: id,
        status: { $in: ['approved', 'checked_in'] }
      })
        .populate('team', 'teamName teamTag logo primaryGame region establishedDate')
        .select('team qualifiedThrough currentStage phase group')
        .lean(),

      // Get phase standings
      tournament.phases && tournament.phases.length > 0 ?
        PhaseStanding.find({ tournament: id })
          .populate('topTeams.team', 'teamName teamTag logo')
          .lean() :
        Promise.resolve([]),

      // Fetch recent matches
      includeMatches === 'true' ?
        Match.find({ tournament: id, status: 'completed' })
          .sort({ scheduledStartTime: -1 })
          .limit(mobile === 'true' ? 10 : 20)
          .populate('results.team', 'teamName teamTag')
          .select(`
            matchNumber matchType tournamentPhase scheduledStartTime actualStartTime 
            actualEndTime status map results matchStats participatingGroups
          `)
          .lean() :
        Promise.resolve([]),

      // Global match stats
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
      teams: registrations.length || tournament.participatingTeamsCount || 0,
      participatingTeamsCount: registrations.length || tournament.participatingTeamsCount || 0,
      participantCount: registrations.length || tournament.participatingTeamsCount || 0,
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

      description: tournament.description || '',

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

    // Build groups data from pre-fetched registrations and standings (OPTIMIZED)
    const groupsData = {};
    if (tournament.phases && tournament.phases.length > 0) {
      tournament.phases.forEach(phase => {
        if (phase.groups && phase.groups.length > 0) {
          groupsData[phase.name] = {};

          phase.groups.forEach(group => {
            const groupKey = group.name?.replace('Group ', '') || '1';

            // Find the master standing document for this phase
            const phaseStandingDoc = phaseStandings.find(ps => ps.phase === phase.name);

            groupsData[phase.name][groupKey] = {
              groupId: group._id,
              standings: (phaseStandingDoc?.topTeams || [])
                .filter(s => !group.name || s.group === group.name) // Filter by group if specific group requested
                .slice()
                .sort((a, b) => a.position - b.position)
                .map(s => ({
                  team: {
                    _id: s.team?._id,
                    name: s.team?.teamName,
                    tag: s.team?.teamTag,
                    logo: s.team?.logo
                  },
                  position: s.position,
                  matchesPlayed: s.matchesPlayed || 0,
                  points: s.points || 0,
                  killPoints: s.killPoints || 0,
                  positionPoints: s.positionPoints || 0,
                  kills: s.kills || 0,
                  chickenDinners: s.chickenDinners || 0
                }))
            };
          });
        }
      });
    }

    res.json({
      tournamentData,
      scheduleData: includeMatches === 'true' ? scheduleData : [],
      groupsData,
      tournamentStats: tournamentData.statistics,
      streamLinks: tournamentData.streamLinks,
      // Map teamName to name and teamTag to tag for frontend consistency
      phaseStandings: phaseStandings.map(ps => ({
        ...ps,
        topTeams: ps.topTeams?.map(s => ({
          ...s,
          team: s.team ? {
            _id: s.team._id,
            name: s.team.teamName,
            tag: s.team.teamTag,
            logo: s.team.logo
          } : null
        }))
      }))
    });

  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({ error: 'Failed to fetch tournament details' });
  }
});

// Get teams for a specific phase/group with pagination (Public)
router.get('/:id/teams', async (req, res) => {
  try {
    const { id } = req.params;
    const { phase, group, page = 1, limit = 24 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const currentPage = parseInt(page);
    const pageLimit = parseInt(limit);
    const skip = (currentPage - 1) * pageLimit;

    // 1. Fetch tournament to check for slotList (historical accuracy)
    const tournament = await Tournament.findById(id).select('phases').lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    let teamIdsFromSlots = [];
    let slotMap = {}; // teamId -> slotNumber

    if (phase && tournament.phases) {
      const phaseDoc = tournament.phases.find(p => p.name === phase);
      if (phaseDoc && phaseDoc.groups) {
        // If a specific group is requested
        if (group && group !== 'All') {
          const groupNum = group.replace('Group ', '').trim();
          const targetGroup = phaseDoc.groups.find(g => {
            const gNum = g.name?.replace('Group ', '').trim();
            return gNum === groupNum || g.name === group;
          });

          if (targetGroup?.slotList?.length > 0) {
            targetGroup.slotList.forEach(s => {
              if (s.team) {
                const tId = s.team.toString();
                teamIdsFromSlots.push(s.team);
                slotMap[tId] = s.slot;
              }
            });
          }
        } 
        // If "All Groups" or no group specified for the phase
        else {
          phaseDoc.groups.forEach(g => {
            if (g.slotList?.length > 0) {
              g.slotList.forEach(s => {
                if (s.team) {
                  const tId = s.team.toString();
                  // Avoid duplicates if a team is somehow in multiple groups
                  if (!slotMap[tId]) {
                    teamIdsFromSlots.push(s.team);
                    slotMap[tId] = s.slot;
                  }
                }
              });
            }
          });
        }
      }
    }

    let registrations = [];
    let total = 0;

    // 2. If we have slot-based team IDs, use them (Preserves History)
    if (teamIdsFromSlots.length > 0) {
      total = teamIdsFromSlots.length;
      const paginatedIds = teamIdsFromSlots.slice(skip, skip + pageLimit);
      
      registrations = await Registration.find({
        tournament: id,
        team: { $in: paginatedIds },
        status: { $nin: ['rejected', 'withdrawn', 'pending'] }
      })
      .populate('team', 'teamName teamTag logo')
      .lean();

      // Sort registrations to match the slotList order
      registrations.sort((a, b) => {
        const slotA = slotMap[a.team?._id?.toString()] || 999;
        const slotB = slotMap[b.team?._id?.toString()] || 999;
        return slotA - slotB;
      });
    } 
    // 3. Fallback: Query Registration (Dynamic current roster)
    else {
      const query = {
        tournament: id,
        phase,
        status: { $nin: ['rejected', 'withdrawn', 'pending'] }
      };

      if (group && group !== 'All') {
        query.group = group.startsWith('Group ') ? group : `Group ${group}`;
      }

      [registrations, total] = await Promise.all([
        Registration.find(query)
          .populate('team', 'teamName teamTag logo')
          .skip(skip)
          .limit(pageLimit)
          .lean(),
        Registration.countDocuments(query)
      ]);
    }

    res.json({
      teams: registrations.map(reg => ({
        _id: reg.team?._id,
        name: reg.team?.teamName || 'Unknown Team',
        tag: reg.team?.teamTag || '',
        logo: reg.team?.logo || null,
        slot: slotMap[reg.team?._id?.toString()] || null
      })),
      total,
      page: currentPage,
      totalPages: Math.ceil(total / pageLimit)
    });
  } catch (error) {
    console.error('Error fetching tournament teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
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

    // Check authorization — only the tournament's organization can update groups
    if (tournament.organization && req.user && tournament.organization.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the tournament organizer can update groups' });
    }

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

// ============================================================================
// GET /api/tournaments/:id/announcements
// Players: returns general announcements + announcements targeted at the
// requesting player's team(s) in this tournament.
// Unauthenticated requests only receive general announcements.
// ============================================================================
router.get('/:id/announcements', async (req, res) => {
  try {
    const { id: tournamentId } = req.params;
    const { page = 1, limit = 30 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    // Attempt to resolve the authenticated user (optional auth)
    let userId = null;
    try {
      await new Promise((resolve, reject) => {
        auth(req, res, (err) => (err ? reject(err) : resolve()));
      });
      userId = req.user?.id || req.user?._id;
    } catch (_) {
      // Not authenticated — only general announcements will be shown
    }

    // Fetch ALL announcements for this tournament (we'll filter in JS)
    const all = await TournamentAnnouncement.find({ tournamentId })
      .sort({ createdAt: -1 })
      .populate('targetTeams', 'teamName teamTag logo')
      .lean();

    if (!userId) {
      // Unauthenticated: only general announcements
      const general = all.filter((a) => a.targetType === 'general');
      return res.json({ announcements: general });
    }

    // Find all teams this player belongs to
    const playerTeams = await Team.find({ players: userId }).select('_id').lean();
    const playerTeamIds = playerTeams.map((t) => t._id.toString());

    // Find active registrations those teams have in this tournament
    const registrations = await Registration.find({
      tournament: tournamentId,
      team: { $in: playerTeams.map((t) => t._id) },
      status: { $in: ['approved', 'checked_in'] },
    })
      .select('team phase group')
      .lean();

    const registeredTeamIds = new Set(registrations.map((r) => r.team.toString()));

    // Build a set of phase+group combos the player participates in
    const playerPhases = new Set(registrations.map((r) => r.phase).filter(Boolean));
    const playerGroupKeys = new Set(
      registrations
        .filter((r) => r.phase && r.group)
        .map((r) => `${r.phase}__${r.group}`)
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const visible = all.filter((ann) => {
      if (ann.targetType === 'general') return true;

      if (ann.targetType === 'specific_teams') {
        return ann.targetTeams.some((t) =>
          registeredTeamIds.has((t._id || t).toString())
        );
      }

      if (ann.targetType === 'phase') {
        return playerPhases.has(ann.targetPhase);
      }

      if (ann.targetType === 'group') {
        return playerGroupKeys.has(`${ann.targetPhase}__${ann.targetGroup}`);
      }

      return false;
    });

    const paginated = visible.slice(skip, skip + parseInt(limit));

    res.json({ announcements: paginated, total: visible.length });
  } catch (error) {
    console.error('Error fetching tournament announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

export default router;