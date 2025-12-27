import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import Organization from '../models/organization.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
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

// **ADVANCE PHASE ROUTE** - Calculates standings from completed matches
router.post('/:tournamentId/advance-phase', verifyOrgAuth, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { phaseName } = req.body;

    console.log('=== ADVANCE PHASE START ===');
    console.log('Tournament ID:', tournamentId);
    console.log('Phase Name:', phaseName);

    // Fetch tournament with teams populated
    const tournament = await Tournament.findById(tournamentId)
      .select('phases organizer status prizePool participatingTeams')
      .populate('phases.teams', 'teamName teamTag logo');

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Authorization check
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find the phase
    const phaseIndex = tournament.phases.findIndex(p => p.name === phaseName);
    if (phaseIndex === -1) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    const currentPhase = tournament.phases[phaseIndex];
    console.log('Current phase:', currentPhase.name, 'Status:', currentPhase.status);

    // Fetch all matches for this phase
    const matches = await Match.find({
      tournament: tournamentId,
      tournamentPhase: phaseName
    })
      .populate('participatingTeams.team', 'teamName teamTag logo')
      .lean();

    console.log(`Total matches: ${matches.length}`);

    // Calculate standings from matches
    const teamStandings = {};

    // Get teams in this phase
    const phaseTeamIds = currentPhase.teams?.map(t => t._id?.toString() || t.toString()) || [];

    // Initialize standings for all teams in phase
    for (const teamId of phaseTeamIds) {
      const team = await Team.findById(teamId).select('teamName teamTag logo').lean();
      if (team) {
        teamStandings[teamId] = {
          team: team,
          teamId: teamId,
          points: 0,
          positionPoints: 0,
          killPoints: 0,
          kills: 0,
          chickenDinners: 0,
          matchesPlayed: 0,
          placements: [],
          group: null
        };
      }
    }

    // Process matches and calculate points
    matches.forEach(match => {
      match.participatingTeams?.forEach(teamResult => {
        const teamId = (teamResult.team?._id || teamResult.team)?.toString();

        if (teamId && teamStandings[teamId]) {
          const position = teamResult.finalPosition;
          const kills = teamResult.kills?.total || 0;

          if (position || kills > 0) {
            const placementPoints = getPlacementPoints(position);

            teamStandings[teamId].positionPoints += placementPoints;
            teamStandings[teamId].killPoints += kills;
            teamStandings[teamId].points += (placementPoints + kills);
            teamStandings[teamId].kills += kills;
            teamStandings[teamId].matchesPlayed += 1;

            if (position) teamStandings[teamId].placements.push(position);
            if (teamResult.chickenDinner) teamStandings[teamId].chickenDinners += 1;
          }
        }
      });
    });

    // Get group assignments from tournament phase groups
    const teamGroupMap = {};
    if (currentPhase.groups && currentPhase.groups.length > 0) {
      currentPhase.groups.forEach(group => {
        const groupName = group.name;
        group.teams?.forEach(teamId => {
          teamGroupMap[teamId.toString()] = groupName;
        });
      });
    }

    // Assign groups to standings
    Object.keys(teamStandings).forEach(teamId => {
      teamStandings[teamId].group = teamGroupMap[teamId] || null;
    });

    // Convert to array and sort by: totalPoints → positionPoints → chickenDinners → kills
    const overallStandings = Object.values(teamStandings).sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.positionPoints !== b.positionPoints) return b.positionPoints - a.positionPoints;
      if (a.chickenDinners !== b.chickenDinners) return b.chickenDinners - a.chickenDinners;
      return b.kills - a.kills;
    });

    // Assign positions
    overallStandings.forEach((standing, index) => {
      standing.position = index + 1;
    });

    // Calculate group standings
    const groupStandings = [];
    const standingsByGroup = {};

    overallStandings.forEach(standing => {
      if (standing.group) {
        if (!standingsByGroup[standing.group]) {
          standingsByGroup[standing.group] = [];
        }
        standingsByGroup[standing.group].push(standing);
      }
    });

    // Sort each group
    Object.entries(standingsByGroup).forEach(([groupName, standings]) => {
      standings.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.positionPoints !== b.positionPoints) return b.positionPoints - a.positionPoints;
        if (a.chickenDinners !== b.chickenDinners) return b.chickenDinners - a.chickenDinners;
        return b.kills - a.kills;
      });
      groupStandings.push(...standings);
    });

    console.log(`Overall standings: ${overallStandings.length} teams`);
    console.log(`Group standings: ${groupStandings.length} entries`);

    if (overallStandings.length === 0) {
      return res.status(400).json({
        error: 'No team standings calculated. Ensure teams participated in matches.'
      });
    }

    // Mark current phase as completed
    currentPhase.status = 'completed';
    console.log('✅ Marked phase as completed');

    // Advance teams to next phase
    const teamsAdvanced = [];
    const advancementDetails = [];

    if (phaseIndex + 1 < tournament.phases.length) {
      console.log('📊 Processing qualification rules...');

      if (currentPhase.qualificationRules && currentPhase.qualificationRules.length > 0) {
        const qualifiedTeamsSet = new Set();

        for (const rule of currentPhase.qualificationRules) {
          const numberOfTeams = rule.numberOfTeams || 0;
          const source = rule.source || 'overall';
          const nextPhaseName = rule.nextPhase;

          console.log(`Rule: ${numberOfTeams} teams from ${source} to ${nextPhaseName}`);

          // Find next phase by name
          const nextPhaseIndex = tournament.phases.findIndex(p => p.name === nextPhaseName);
          if (nextPhaseIndex === -1) {
            console.warn(`⚠️ Next phase "${nextPhaseName}" not found`);
            continue;
          }

          const nextPhase = tournament.phases[nextPhaseIndex];
          let qualifiedTeamIds = [];

          if (source === 'overall') {
            // Take top N teams from overall standings
            qualifiedTeamIds = overallStandings
              .slice(0, numberOfTeams)
              .map(s => s.team._id.toString());

            console.log(`  → ${qualifiedTeamIds.length} teams from overall`);
          } else if (source === 'from_each_group') {
            // Take top N teams from each group
            Object.entries(standingsByGroup).forEach(([groupName, standings]) => {
              const topFromGroup = standings
                .slice(0, numberOfTeams)
                .map(s => s.team._id.toString());

              qualifiedTeamIds.push(...topFromGroup);
              console.log(`  → ${topFromGroup.length} teams from ${groupName}`);
            });
          }

          // Add to qualified set
          qualifiedTeamIds.forEach(teamId => qualifiedTeamsSet.add(teamId));

          // Initialize next phase teams array if needed
          if (!nextPhase.teams) nextPhase.teams = [];

          // Add teams to next phase (avoid duplicates)
          const newTeams = qualifiedTeamIds.filter(
            teamId => !nextPhase.teams.some(t => t.toString() === teamId)
          );

          nextPhase.teams.push(...newTeams);
          nextPhase.status = 'upcoming';

          advancementDetails.push({
            rule: `${numberOfTeams} from ${source}`,
            nextPhase: nextPhaseName,
            teamsQualified: qualifiedTeamIds.length
          });

          console.log(`  ✅ Added ${newTeams.length} new teams to ${nextPhaseName}`);
        }

        teamsAdvanced.push(...Array.from(qualifiedTeamsSet));

        // Update Registration collection with new phase info
        if (teamsAdvanced.length > 0) {
          // Build map from advancement details
          const teamToNextPhaseMap = {};

          for (const detail of advancementDetails) {
            const nextPhaseIndex = tournament.phases.findIndex(p => p.name === detail.nextPhase);
            if (nextPhaseIndex !== -1) {
              const nextPhase = tournament.phases[nextPhaseIndex];
              nextPhase.teams.forEach(teamId => {
                teamToNextPhaseMap[teamId.toString()] = detail.nextPhase;
              });
            }
          }

          // Update each team individually
          const updatePromises = teamsAdvanced.map(async (teamId) => {
            const nextPhaseName = teamToNextPhaseMap[teamId];
            return Registration.findOneAndUpdate(
              {
                tournament: tournamentId,
                team: teamId,
                status: { $in: ['approved', 'checked_in'] }
              },
              {
                $set: {
                  phase: nextPhaseName,
                  currentStage: nextPhaseName
                }
              }
            );
          });

          await Promise.all(updatePromises);
          console.log(`✅ Updated ${teamsAdvanced.length} registrations`);
        }

      } else {
        // No qualification rules - advance all teams
        console.log('⚠️ No qualification rules - advancing all teams');
        const nextPhase = tournament.phases[phaseIndex + 1];
        const allTeamIds = overallStandings.map(s => s.teamId);

        if (!nextPhase.teams) nextPhase.teams = [];

        const newTeams = allTeamIds.filter(
          teamId => !nextPhase.teams.some(t => t.toString() === teamId)
        );

        nextPhase.teams.push(...newTeams);
        nextPhase.status = 'upcoming';

        teamsAdvanced.push(...allTeamIds);

        // Update registrations
        await Registration.updateMany(
          {
            tournament: tournamentId,
            team: { $in: allTeamIds },
            status: { $in: ['approved', 'checked_in'] }
          },
          {
            $set: {
              phase: nextPhase.name,
              currentStage: nextPhase.name
            }
          }
        );

        advancementDetails.push({
          rule: 'All teams advance',
          nextPhase: nextPhase.name,
          teamsQualified: allTeamIds.length
        });

        console.log(`✅ Advanced all ${allTeamIds.length} teams to ${nextPhase.name}`);
      }

    } else {
      // This is the final phase - update final standings
      console.log('🏆 This is the final phase - updating final standings');

      tournament.finalStandings = overallStandings.map((standing, index) => ({
        position: index + 1,
        team: standing.team._id || standing.teamId,
        tournamentPointsAwarded: standing.points,
        kills: standing.kills,
        chickenDinners: standing.chickenDinners,
        matchesPlayed: standing.matchesPlayed,
        statistics: {
          totalPoints: standing.points,
          totalKills: standing.kills,
          averagePlacement: standing.placements.length > 0
            ? standing.placements.reduce((a, b) => a + b, 0) / standing.placements.length
            : 0,
          chickenDinners: standing.chickenDinners
        }
      }));

      tournament.status = 'completed';

      // Mark all qualified teams as having completed tournament
      await Registration.updateMany(
        {
          tournament: tournamentId,
          status: { $in: ['approved', 'checked_in'] }
        },
        {
          $set: {
            currentStage: 'Completed'
          }
        }
      );

      // Set final positions in registrations
      for (let i = 0; i < overallStandings.length; i++) {
        await Registration.findOneAndUpdate(
          {
            tournament: tournamentId,
            team: overallStandings[i].teamId
          },
          {
            $set: {
              finalPosition: i + 1,
              totalTournamentPoints: overallStandings[i].points,
              totalTournamentKills: overallStandings[i].kills
            }
          }
        );
      }

      console.log('✅ Updated final standings and registrations');
    }

    // Update or create PhaseStanding summary
    try {
      await PhaseStanding.findOneAndUpdate(
        {
          tournament: tournamentId,
          phase: phaseName
        },
        {
          $set: {
            status: 'completed',
            topTeams: overallStandings.slice(0, 10).map(s => ({
              team: s.team._id || s.teamId,
              position: s.position,
              points: s.points,
              kills: s.kills,
              chickenDinners: s.chickenDinners,
              matchesPlayed: s.matchesPlayed
            })),
            statistics: {
              totalTeams: overallStandings.length,
              totalMatches: matches.length,
              totalPoints: overallStandings.reduce((sum, s) => sum + s.points, 0),
              totalKills: overallStandings.reduce((sum, s) => sum + s.kills, 0)
            },
            lastCalculated: new Date()
          }
        },
        { upsert: true, new: true }
      );
      console.log('✅ Updated PhaseStanding');
    } catch (phaseStandingError) {
      console.warn('⚠️ Failed to update PhaseStanding:', phaseStandingError.message);
    }

    // Save tournament
    await tournament.save();
    console.log('✅ Tournament saved successfully');

    // Prepare response with standings
    const response = {
      success: true,
      message: 'Phase advanced successfully',
      phase: {
        name: currentPhase.name,
        status: 'completed',
        completedAt: new Date()
      },
      standings: {
        overall: overallStandings.map((s, i) => ({
          position: i + 1,
          team: s.team,
          points: s.points,
          positionPoints: s.positionPoints,
          killPoints: s.killPoints,
          kills: s.kills,
          chickenDinners: s.chickenDinners,
          matchesPlayed: s.matchesPlayed
        })),
        byGroup: Object.keys(standingsByGroup).length > 0
          ? Object.entries(standingsByGroup).reduce((acc, [groupName, standings]) => {
            acc[groupName] = standings.map((s, i) => ({
              position: i + 1,
              team: s.team,
              points: s.points,
              kills: s.kills,
              chickenDinners: s.chickenDinners
            }));
            return acc;
          }, {})
          : null
      },
      advancement: {
        teamsAdvanced: teamsAdvanced.length,
        details: advancementDetails,
        nextPhases: [...new Set(advancementDetails.map(d => d.nextPhase))]
      },
      stats: {
        matchesProcessed: matches.length,
        standingsCalculated: overallStandings.length,
        isFinalPhase: phaseIndex + 1 >= tournament.phases.length
      }
    };

    // If final phase, include final standings
    if (tournament.status === 'completed') {
      response.finalStandings = tournament.finalStandings;
    }

    console.log('=== ADVANCE PHASE END ===');
    res.json(response);

  } catch (error) {
    console.error('❌ Error advancing phase:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    res.status(500).json({
      error: 'Failed to advance phase',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function (if not already defined)
function getPlacementPoints(position) {
  const pointsMap = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
  };
  return pointsMap[position] || 0;
}


// ============================================================================
// GET SPECIFIC TOURNAMENT (OPTIMIZED FOR NEW SCHEMA)
// ============================================================================

router.get('/:tournamentId', verifyOrgAuth, async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // Fetch tournament with minimal data
    const tournament = await Tournament.findById(tournamentId)
      .populate('phases.teams', 'teamName teamTag logo')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check authorization
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Fetch all related data in parallel
    const [registrations, phaseStandings, matches] = await Promise.all([
      // Get all registrations with team data
      Registration.find({ tournament: tournamentId })
        .populate('team', 'teamName teamTag logo primaryGame region')
        .select('team status qualifiedThrough currentStage phase group totalTournamentPoints totalTournamentKills registeredAt')
        .sort({ totalTournamentPoints: -1 })
        .lean(),

      // Get all phase standings for this tournament
      PhaseStanding.find({ tournament: tournamentId })
        .populate('topTeams.team', 'teamName teamTag logo')
        .select('phase topTeams groups')
        .sort({ phase: 1 })
        .lean(),

      // Get pending invitations
      // Invitation.find({
      //   tournament: tournamentId,
      //   status: 'pending'
      // })
      //   .populate('team', 'teamName teamTag logo')
      //   .select('team phase message invitedAt expiresAt')
      //   .lean(),

      // Get match count
      Match.countDocuments({ tournament: tournamentId })
    ]);

    // Organize standings by phase and group from phase standings
    const standingsByPhase = {};
    phaseStandings.forEach(phaseStanding => {
      standingsByPhase[phaseStanding.phase] = {};

      // Add top teams to overall standings
      if (phaseStanding.topTeams && phaseStanding.topTeams.length > 0) {
        standingsByPhase[phaseStanding.phase].overall = phaseStanding.topTeams.map(team => ({
          team: team.team,
          phase: phaseStanding.phase,
          group: null,
          position: team.position,
          points: team.points,
          kills: team.kills,
          chickenDinners: team.chickenDinners,
          matchesPlayed: team.matchesPlayed
        }));
      }

      // Add group standings if available
      if (phaseStanding.groups && phaseStanding.groups.length > 0) {
        phaseStanding.groups.forEach(group => {
          if (group.standings && group.standings.length > 0) {
            standingsByPhase[phaseStanding.phase][group.name] = group.standings.map(team => ({
              team: team.team,
              phase: phaseStanding.phase,
              group: group.name,
              position: team.position,
              points: team.points,
              kills: team.kills,
              chickenDinners: team.chickenDinners,
              matchesPlayed: team.matchesPlayed
            }));
          }
        });
      }
    });


    // Build enriched tournament response
    const enrichedTournament = {
      ...tournament,

      // Replace participatingTeams array with registrations
      participatingTeams: registrations.map(reg => ({
        team: reg.team,
        status: reg.status,
        qualifiedThrough: reg.qualifiedThrough,
        currentStage: reg.currentStage,
        phase: reg.phase,
        group: reg.group,
        totalTournamentPoints: reg.totalTournamentPoints,
        totalTournamentKills: reg.totalTournamentKills,
        registeredAt: reg.registeredAt
      })),

      // Add standings organized by phase/group
      phases: tournament.phases?.map(phase => ({
        ...phase,
        teams: phase.teams || [],
        // Add standings for this phase
        standings: standingsByPhase[phase.name] || {},
        // Add groups with their standings
        groups: phase.groups?.map(group => ({
          ...group,
          standings: standingsByPhase[phase.name]?.[group.name] || []
        })) || []
      })) || [],

      // Add summary stats
      stats: {
        totalRegistrations: registrations.length,
        activeTeams: registrations.filter(r =>
          ['approved', 'checked_in'].includes(r.status)
        ).length,
        pendingRegistrations: registrations.filter(r =>
          r.status === 'pending'
        ).length,
        // pendingInvitations: invitations.length,
        totalMatches: matches
      },

      // Include pending invitations
      // pendingInvitations: invitations
    };

    res.json({ tournament: enrichedTournament });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({
      error: 'Failed to fetch tournament',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// UPDATE TOURNAMENT (OPTIMIZED FOR NEW SCHEMA)
// ============================================================================

router.put('/:tournamentId', verifyOrgAuth, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // Parse update data
    let updateData = req.body.tournamentData ?
      JSON.parse(req.body.tournamentData) : req.body;

    if (updateData.phases && typeof updateData.phases === 'string') {
      updateData.phases = JSON.parse(updateData.phases);
    }

    // Fetch tournament (minimal fields for auth check)
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef media')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check authorization
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Process image uploads in parallel
    const mediaUrls = {};
    if (req.files) {
      const uploadPromises = Object.entries(req.files).map(async ([key, files]) => {
        if (files && files[0]) {
          try {
            const result = await new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                {
                  folder: `tournaments/${req.organization._id}`,
                  public_id: `${tournamentId}_${key}_${Date.now()}`,
                  overwrite: true,
                  transformation: [
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
              stream.end(files[0].buffer);
            });
            mediaUrls[key] = result.secure_url;
          } catch (error) {
            console.error(`Error uploading ${key}:`, error);
          }
        }
      });

      await Promise.all(uploadPromises);
    }

    // Merge media URLs
    if (Object.keys(mediaUrls).length > 0) {
      updateData.media = {
        ...tournament.media,
        ...mediaUrls
      };
    }

    // Validation for dates if being updated
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate ?
        new Date(updateData.startDate) : new Date(tournament.startDate);
      const endDate = updateData.endDate ?
        new Date(updateData.endDate) : new Date(tournament.endDate);

      if (endDate <= startDate) {
        return res.status(400).json({
          error: 'End date must be after start date'
        });
      }
    }

    // Update tournament
    const updatedTournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean();

    res.json({
      success: true,
      message: 'Tournament updated successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('Error updating tournament:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      error: 'Failed to update tournament',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// ADD TEAM TO PHASE (UPDATED FOR NEW SCHEMA)
// ============================================================================

router.post('/:tournamentId/phases/:phase/teams', verifyOrgAuth, async (req, res) => {
  try {
    const { tournamentId, phase } = req.params;
    const { teamId, group } = req.body; // Added group parameter

    // Fetch tournament
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef phases')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check authorization
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if phase exists
    const phaseExists = tournament.phases?.some(p => p.name === phase);
    if (!phaseExists) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    // Check if team is registered
    const registration = await Registration.findOne({
      tournament: tournamentId,
      team: teamId,
      status: { $in: ['approved', 'checked_in'] }
    });

    if (!registration) {
      return res.status(400).json({
        error: 'Team must be registered and approved to join a phase'
      });
    }

    // Update the tournament's phase teams array
    await Tournament.updateOne(
      {
        _id: tournamentId,
        'phases.name': phase
      },
      {
        $addToSet: { 'phases.$.teams': teamId }
      }
    );

    // Update registration with phase and group info
    registration.phase = phase;
    registration.currentStage = phase;
    if (group) registration.group = group;
    await Registration.findByIdAndUpdate(registration._id, {
      phase: phase,
      currentStage: phase,
      ...(group && { group: group })
    });

    // Note: PhaseStanding is updated automatically via recalculation
    // Individual team standings are managed through the PhaseStanding.recalculate() method


    // Fetch updated tournament
    const updatedTournament = await Tournament.findById(tournamentId)
      .populate('phases.teams', 'teamName teamTag logo')
      .lean();

    res.json({
      success: true,
      message: 'Team added to phase successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('Error adding team to phase:', error);
    res.status(500).json({
      error: 'Failed to add team to phase',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// REMOVE TEAM FROM PHASE (UPDATED FOR NEW SCHEMA)
// ============================================================================

router.delete('/:tournamentId/phases/:phase/teams/:teamId', verifyOrgAuth, async (req, res) => {
  try {
    const { tournamentId, phase, teamId } = req.params;

    // Fetch tournament
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef phases')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check authorization
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if phase exists
    const phaseData = tournament.phases?.find(p => p.name === phase);
    if (!phaseData) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    // Check if team is in phase
    const teamInPhase = phaseData.teams?.some(t => t.toString() === teamId);
    if (!teamInPhase) {
      return res.status(400).json({ error: 'Team not in this phase' });
    }

    // Remove team from phase teams array
    await Tournament.updateOne(
      {
        _id: tournamentId,
        'phases.name': phase
      },
      {
        $pull: { 'phases.$.teams': teamId }
      }
    );

    // Update registration - clear phase info
    await Registration.updateOne(
      {
        tournament: tournamentId,
        team: teamId
      },
      {
        $set: {
          phase: null,
          currentStage: 'Registered',
          group: null
        }
      }
    );

    // Note: PhaseStanding will be recalculated automatically
    // Individual team standings are managed through the PhaseStanding.recalculate() method


    // Fetch updated tournament
    const updatedTournament = await Tournament.findById(tournamentId)
      .populate('phases.teams', 'teamName teamTag logo')
      .lean();

    res.json({
      success: true,
      message: 'Team removed from phase successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('Error removing team from phase:', error);
    res.status(500).json({
      error: 'Failed to remove team from phase',
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
