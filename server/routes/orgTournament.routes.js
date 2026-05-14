import express from 'express';
import mongoose from 'mongoose';
import Tournament from '../models/tournament.model.js';
import Team from '../models/team.model.js';
import Player from '../models/player.model.js';
import Match from '../models/match.model.js';
import Registration from '../models/registration.model.js';
import PhaseStanding from '../models/phaseStanding.model.js';
import cloudinary from '../config/cloudinary.js';
import upload from '../config/multer.js';
import { verifyApprovedOrgToken } from '../middleware/orgAuth.js';
import TournamentAnnouncement from '../models/tournamentAnnouncement.model.js';
import ChatMessage from '../models/chat.model.js';
import { recalculateStatsForTeams } from './match.routes.js';
import notificationService from '../services/notification.service.js';

const router = express.Router();

async function sendPhaseOutcomeNotifications({
  tournamentId,
  tournamentName,
  phaseName,
  nextPhaseName,
  qualifiedTeamIds,
}) {
  const phaseRegs = await Registration.find({
    tournament: tournamentId,
    phase: phaseName,
    status: { $in: ['approved', 'checked_in'] },
  })
    .select('team roster')
    .lean();

  if (!phaseRegs.length) return;

  const teamIds = phaseRegs.map((r) => r.team.toString());
  const qualifiedSet = new Set((qualifiedTeamIds || []).map((id) => id.toString()));
  const eliminatedSet = new Set(teamIds.filter((id) => !qualifiedSet.has(id)));

  const teams = await Team.find({ _id: { $in: teamIds } })
    .select('teamName')
    .lean();
  const teamNameById = new Map(teams.map((t) => [t._id.toString(), t.teamName || 'Your team']));

  const qualifiedDocs = [];
  const eliminatedDocs = [];
  const qualifiedPlayerIds = new Set();
  const eliminatedPlayerIds = new Set();

  for (const reg of phaseRegs) {
    const teamId = reg.team.toString();
    const players = (reg.roster || [])
      .map((slot) => slot.player?.toString())
      .filter(Boolean);

    if (!players.length) continue;

    const isQualified = qualifiedSet.has(teamId);
    const teamName = teamNameById.get(teamId) || 'Your team';

    const message = isQualified
      ? `✅ ${teamName} has qualified from ${phaseName}${nextPhaseName ? ` to ${nextPhaseName}` : ''} in ${tournamentName}.`
      : `❌ ${teamName} did not qualify from ${phaseName} in ${tournamentName}.`;

    const targetDocs = isQualified ? qualifiedDocs : eliminatedDocs;
    const targetPlayers = isQualified ? qualifiedPlayerIds : eliminatedPlayerIds;

    for (const playerId of players) {
      targetPlayers.add(playerId);
      targetDocs.push({
        senderId: 'system',
        receiverId: playerId,
        message,
        messageType: 'system',
        tournamentId,
        metadata: {
          type: isQualified ? 'phase_qualified' : 'phase_eliminated',
          phaseName,
          nextPhaseName: nextPhaseName || null,
          teamId,
        },
        timestamp: new Date(),
      });
    }
  }

  if (qualifiedDocs.length > 0) {
    await ChatMessage.insertMany(qualifiedDocs, { ordered: false });
  }
  if (eliminatedDocs.length > 0) {
    await ChatMessage.insertMany(eliminatedDocs, { ordered: false });
  }

  const notifyPromises = [];

  if (qualifiedPlayerIds.size > 0) {
    notifyPromises.push(
      notificationService.sendToMultiplePlayers(
        [...qualifiedPlayerIds],
        'Phase Qualified',
        `${phaseName} completed. You qualified${nextPhaseName ? ` to ${nextPhaseName}` : ''}.`,
        {
          type: 'phase_qualified',
          phaseName,
          nextPhaseName: nextPhaseName || '',
          tournamentId: tournamentId.toString(),
        }
      )
    );
  }

  if (eliminatedPlayerIds.size > 0) {
    notifyPromises.push(
      notificationService.sendToMultiplePlayers(
        [...eliminatedPlayerIds],
        'Phase Result',
        `${phaseName} completed. Your team did not qualify this phase.`,
        {
          type: 'phase_eliminated',
          phaseName,
          tournamentId: tournamentId.toString(),
        }
      )
    );
  }

  if (notifyPromises.length > 0) {
    await Promise.allSettled(notifyPromises);
  }

  console.log(
    `📣 Phase outcome notifications sent for ${phaseName}: qualifiedTeams=${qualifiedSet.size}, eliminatedTeams=${eliminatedSet.size}, qualifiedPlayers=${qualifiedPlayerIds.size}, eliminatedPlayers=${eliminatedPlayerIds.size}`
  );
}

const normalizePhaseDirectInvites = (directInvites, totalSlots = 0) => {
  const rawMode = directInvites?.mode;
  const mode = ['decide_later', 'none', 'fixed_count'].includes(rawMode)
    ? rawMode
    : 'decide_later';

  if (mode !== 'fixed_count') {
    return { mode, targetCount: null };
  }

  const parsed = Number.parseInt(directInvites?.targetCount, 10);
  const targetCount = Number.isFinite(parsed) ? parsed : null;
  return { mode, targetCount };
};

const validatePhaseDirectInvites = (phases, totalSlots = 0) => {
  const errors = [];
  if (!Array.isArray(phases)) return errors;

  phases.forEach((phase, idx) => {
    const invitePlan = normalizePhaseDirectInvites(phase?.directInvites, totalSlots);

    if (invitePlan.mode === 'fixed_count') {
      if (!invitePlan.targetCount || invitePlan.targetCount < 1) {
        errors.push(`Phase ${idx + 1}: invite target must be at least 1 when mode is fixed_count`);
      }
      if (totalSlots > 0 && invitePlan.targetCount > totalSlots) {
        errors.push(`Phase ${idx + 1}: invite target cannot exceed tournament total slots (${totalSlots})`);
      }
    }
  });

  return errors;
};

const buildStructureSuggestion = (approvedCount) => {
  const n = Number(approvedCount || 0);

  if (n <= 32) {
    return {
      reason: 'low_registration',
      suggestedFormat: 'single_phase_finals',
      notes: 'Run a compact finals-only structure to keep quality and avoid empty groups.',
      phases: [
        {
          name: 'Grand Finals',
          type: 'final_stage',
          groups: 1,
          teamsPerGroup: Math.max(8, Math.min(32, n || 16)),
          qualificationRules: [],
        },
      ],
    };
  }

  if (n <= 128) {
    return {
      reason: 'medium_registration',
      suggestedFormat: 'two_stage',
      notes: 'Keep one qualifier stage, then finals for cleaner progression.',
      phases: [
        {
          name: 'Round 1',
          type: 'qualifiers',
          groups: Math.max(2, Math.ceil(n / 16)),
          teamsPerGroup: 16,
          qualificationRules: [{ source: 'from_each_group', numberOfTeams: 8, nextPhase: 'Grand Finals' }],
        },
        {
          name: 'Grand Finals',
          type: 'final_stage',
          groups: 1,
          teamsPerGroup: Math.max(16, Math.ceil(n / 2)),
          qualificationRules: [],
        },
      ],
    };
  }

  return {
    reason: 'sufficient_registration',
    suggestedFormat: 'current_plan_ok',
    notes: 'Current multi-phase structure is acceptable for the present team count.',
    phases: [],
  };
};

// Get tournaments for organization dashboard (optimized for OrgDashboard component)
router.get('/my-tournaments', verifyApprovedOrgToken, async (req, res) => {
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
router.post('/:tournamentId/advance-phase', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;
    const { phaseName } = req.body;
    let responsePayload = null;
    let phaseTeamIdsForStats = [];
    let phaseOutcomeNotificationContext = null;

    console.log('=== ADVANCE PHASE START ===');
    console.log('Tournament ID:', tournamentId);
    console.log('Phase Name:', phaseName);

    await session.withTransaction(async () => {

      // Fetch tournament with teams populated
      const tournament = await Tournament.findById(tournamentId)
        .session(session)
        .select('phases organizer status prizePool participatingTeams tier importanceScore status finalStandings')
        .populate('phases.teams', 'teamName teamTag logo');

      if (!tournament) {
        throw new Error('TOURNAMENT_NOT_FOUND');
      }

      // Authorization check
      if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
        throw new Error('NOT_AUTHORIZED');
      }

      // Check if tournament is concluded
      if (tournament.status === 'completed') {
        throw new Error('TOURNAMENT_ALREADY_COMPLETED');
      }

      // Find the phase
      const phaseIndex = tournament.phases.findIndex(p => p.name === phaseName);
      if (phaseIndex === -1) {
        throw new Error('PHASE_NOT_FOUND');
      }

      const currentPhase = tournament.phases[phaseIndex];
      console.log('Current phase:', currentPhase.name, 'Status:', currentPhase.status);

      // 1. Double-check if phase is already completed
      if (currentPhase.status === 'completed') {
        throw new Error('PHASE_ALREADY_COMPLETED');
      }

      // 2. Sequence Guard: Ensure all previous phases are completed
      const previousPhases = tournament.phases.slice(0, phaseIndex);
      const incompletePrevious = previousPhases.find(p => p.status !== 'completed');
      if (incompletePrevious) {
        const err = new Error('PHASE_SEQUENCE_VIOLATION');
        err.meta = { incompletePreviousName: incompletePrevious.name, currentPhaseName: currentPhase.name };
        throw err;
      }

      // Fetch all matches for this phase
      const matches = await Match.find({
        tournament: tournamentId,
        tournamentPhase: phaseName
      })
        .session(session)
        .populate('results.team', 'teamName teamTag logo')
        .lean();

      console.log(`Total matches: ${matches.length}`);

      // Calculate standings from matches
      const teamStandings = {};

      // Get teams in this phase from Registration (single source of truth)
      const phaseRegistrations = await Registration.find({
        tournament: tournamentId,
        phase: phaseName,
        status: { $in: ['approved', 'checked_in'] }
      })
        .session(session)
        .select('team group')
        .lean();

      const phaseTeamIds = phaseRegistrations.map(r => r.team.toString());
      phaseTeamIdsForStats = [...phaseTeamIds];

      // **AUTOMATION: Mark all matches in this phase as completed**
      // This ensures that "in_progress" or "scheduled" matches are finalized when advancing.
      await Match.updateMany(
        {
          tournament: tournamentId,
          tournamentPhase: phaseName,
          status: { $ne: 'completed' }
        },
        { $set: { status: 'completed' } },
        { session }
      );

      // Build a group map from registrations for later group assignment
      const registrationGroupMap = {};
      phaseRegistrations.forEach(r => {
        if (r.group) registrationGroupMap[r.team.toString()] = r.group;
      });

      const phaseGroupMap = {};
      (currentPhase.groups || []).forEach((group) => {
        (group.teams || []).forEach((teamId) => {
          phaseGroupMap[teamId.toString()] = group.name;
        });
      });

      // Initialize standings for all teams in phase — single batch query
      const phaseTeams = await Team.find({ _id: { $in: phaseTeamIds } })
        .session(session)
        .select('teamName teamTag logo')
        .lean();

      for (const team of phaseTeams) {
        const teamId = team._id.toString();
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

      // Process matches and calculate points
      matches.forEach(match => {
        match.results?.forEach(teamResult => {
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

      // Assign groups to standings using registrationGroupMap (built from Registration.group above)
      // Registration.group is source of truth; phase-group mapping is a fallback.
      Object.keys(teamStandings).forEach(teamId => {
        teamStandings[teamId].group = registrationGroupMap[teamId] || phaseGroupMap[teamId] || null;
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
        throw new Error('NO_STANDINGS_CALCULATED');
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

              if (qualifiedTeamIds.length === 0) {
                qualifiedTeamIds = overallStandings
                  .slice(0, numberOfTeams)
                  .map(s => s.team._id.toString());
                console.warn('⚠️ from_each_group produced 0 teams; fallback to overall top teams applied.');
              }
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

            // Batch-update all advanced teams in a single bulkWrite instead of N queries
            const bulkOps = teamsAdvanced.map((teamId) => ({
              updateOne: {
                filter: {
                  tournament: tournamentId,
                  team: teamId,
                  status: { $in: ['approved', 'checked_in'] }
                },
                update: {
                  $set: {
                    phase: teamToNextPhaseMap[teamId],
                    currentStage: teamToNextPhaseMap[teamId]
                  }
                }
              }
            }));

            await Registration.bulkWrite(bulkOps, { ordered: false, session });
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
            },
            { session }
          );

          advancementDetails.push({
            rule: 'All teams advance',
            nextPhase: nextPhase.name,
            teamsQualified: allTeamIds.length
          });

          console.log(`✅ Advanced all ${allTeamIds.length} teams to ${nextPhase.name}`);
        }

      } else if (currentPhase.type === 'final_stage') {
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
          },
          { session }
        );

        // Set final positions in registrations
        const finalPosBulkOps = overallStandings.map((standing, i) => ({
          updateOne: {
            filter: { tournament: tournamentId, team: standing.teamId },
            update: { $set: { finalPosition: i + 1 } }
          }
        }));
        if (finalPosBulkOps.length > 0) {
          await Registration.bulkWrite(finalPosBulkOps, { ordered: false, session });
        }

        console.log('✅ Updated final standings and registrations');
      } else {
        // Last phase but not final_stage - can't advance, can't conclude
        throw new Error('LAST_PHASE_NOT_FINAL_STAGE');
      }

      await PhaseStanding.findOneAndUpdate(
        {
          tournament: tournamentId,
          phase: phaseName
        },
        {
          $set: {
            status: 'completed',
            topTeams: overallStandings.map((s, idx) => ({
              team: s.team._id || s.teamId,
              position: idx + 1,
              points: s.points,
              kills: s.kills,
              positionPoints: s.positionPoints || 0,
              killPoints: s.killPoints || 0,
              chickenDinners: s.chickenDinners,
              matchesPlayed: s.matchesPlayed,
              group: s.group || null
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
        { upsert: true, new: true, session }
      );
      console.log('✅ Updated PhaseStanding');

      // Save tournament
      await tournament.save({ session });
      console.log('✅ Tournament saved successfully');

      // Prepare response with standings (returned after successful commit)
      const nextPhaseCandidates = [...new Set(advancementDetails.map((d) => d.nextPhase).filter(Boolean))];
      phaseOutcomeNotificationContext = {
        tournamentId,
        tournamentName: tournament.tournamentName,
        phaseName,
        nextPhaseName: nextPhaseCandidates.length > 0 ? nextPhaseCandidates[0] : null,
        qualifiedTeamIds: teamsAdvanced,
      };

      responsePayload = {
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
        responsePayload.finalStandings = tournament.finalStandings;
      }
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });

    // **AUTOMATION: Refresh all statistics (Player, Team, and Registration)**
    // This runs after a committed transaction so downstream reads never see partial state.
    if (phaseTeamIdsForStats.length > 0) {
      recalculateStatsForTeams(phaseTeamIdsForStats).catch(err =>
        console.warn('⚠️ Automated stats recalculation failed (non-critical):', err.message)
      );
    }

    if (phaseOutcomeNotificationContext) {
      sendPhaseOutcomeNotifications(phaseOutcomeNotificationContext).catch((err) => {
        console.warn('⚠️ Phase outcome notifications failed (non-critical):', err.message);
      });
    }

    console.log('=== ADVANCE PHASE END ===');
    return res.json(responsePayload);

  } catch (error) {
    console.error('❌ Error advancing phase:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (error.message === 'NOT_AUTHORIZED') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (error.message === 'TOURNAMENT_ALREADY_COMPLETED') {
      return res.status(400).json({ error: 'Tournament is completed. Cannot advance phases.' });
    }
    if (error.message === 'PHASE_NOT_FOUND') {
      return res.status(404).json({ error: 'Phase not found' });
    }
    if (error.message === 'PHASE_ALREADY_COMPLETED') {
      return res.status(400).json({ error: 'This phase has already been advanced.' });
    }
    if (error.message === 'PHASE_SEQUENCE_VIOLATION') {
      return res.status(400).json({
        error: `Cannot advance "${error.meta.currentPhaseName}" until "${error.meta.incompletePreviousName}" is completed.`
      });
    }
    if (error.message === 'NO_STANDINGS_CALCULATED') {
      return res.status(400).json({
        error: 'No team standings calculated. Ensure teams participated in matches.'
      });
    }
    if (error.message === 'LAST_PHASE_NOT_FINAL_STAGE') {
      return res.status(400).json({
        error: 'Cannot advance/conclude.',
        message: 'This is the last defined phase but its type is not "final_stage". Please add the next phase or change this phase type to "final_stage" to conclude.'
      });
    }

    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic phase advancement.'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    res.status(500).json({
      error: 'Failed to advance phase',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await session.endSession();
  }
});

// **CONCLUDE TOURNAMENT** - Marks tournament as completed and sets final standings
router.post('/:tournamentId/conclude', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;
    const { phaseName } = req.body;
    let tournamentResponse = null;
    let phaseTeamIdsForStats = [];

    await session.withTransaction(async () => {
      const tournament = await Tournament.findById(tournamentId).session(session);
      if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

      if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
        throw new Error('NOT_AUTHORIZED');
      }

      const phase = tournament.phases.find(p => p.name === phaseName);
      if (!phase) {
        const error = new Error('PHASE_NOT_FOUND');
        error.meta = { phaseName };
        throw error;
      }
      if (phase.type !== 'final_stage') {
        throw new Error('PHASE_NOT_FINAL_STAGE');
      }

      if (tournament.status === 'completed') {
        throw new Error('TOURNAMENT_ALREADY_COMPLETED');
      }

      const matches = await Match.find({
        tournament: tournamentId,
        tournamentPhase: phaseName
      }).session(session).lean();

      const phaseRegistrations = await Registration.find({
        tournament: tournamentId,
        phase: phaseName,
        status: { $in: ['approved', 'checked_in'] }
      }).session(session).select('team group').lean();

      const teamStandings = {};
      const phaseTeamIds = phaseRegistrations.map(r => r.team.toString());
      phaseTeamIdsForStats = phaseTeamIds;
      const phaseTeams = await Team.find({ _id: { $in: phaseTeamIds } })
        .session(session)
        .select('teamName teamTag logo')
        .lean();

      for (const team of phaseTeams) {
        teamStandings[team._id.toString()] = {
          team,
          teamId: team._id.toString(),
          points: 0,
          positionPoints: 0,
          killPoints: 0,
          kills: 0,
          chickenDinners: 0,
          matchesPlayed: 0,
          placements: []
        };
      }

      matches.forEach(match => {
        match.results?.forEach(teamResult => {
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

      const overallStandings = Object.values(teamStandings).sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.positionPoints !== b.positionPoints) return b.positionPoints - a.positionPoints;
        if (a.chickenDinners !== b.chickenDinners) return b.chickenDinners - a.chickenDinners;
        return b.kills - a.kills;
      });

      tournament.finalStandings = overallStandings.map((standing, index) => ({
        position: index + 1,
        team: standing.teamId,
        tournamentPointsAwarded: standing.points,
        kills: standing.kills,
        chickenDinners: standing.chickenDinners,
        matchesPlayed: standing.matchesPlayed,
        statistics: {
          totalPoints: standing.points,
          totalKills: standing.kills,
          averagePlacement: standing.placements.length > 0 ? standing.placements.reduce((a, b) => a + b, 0) / standing.placements.length : 0,
          chickenDinners: standing.chickenDinners
        }
      }));

      tournament.status = 'completed';
      phase.status = 'completed';

      await tournament.save({ session });

      const finalPosBulkOps = overallStandings.map((standing, i) => ({
        updateOne: {
          filter: { tournament: tournamentId, team: standing.teamId },
          update: { $set: { finalPosition: i + 1, currentStage: 'Completed' } }
        }
      }));

      if (finalPosBulkOps.length > 0) {
        await Registration.bulkWrite(finalPosBulkOps, { ordered: false, session });
      }

      await PhaseStanding.findOneAndUpdate(
        { tournament: tournamentId, phase: phaseName },
        {
          $set: {
            status: 'completed',
            topTeams: overallStandings.map((s, idx) => ({
              team: s.teamId,
              position: idx + 1,
              points: s.points,
              kills: s.kills,
              positionPoints: s.positionPoints || 0,
              killPoints: s.killPoints || 0,
              chickenDinners: s.chickenDinners,
              matchesPlayed: s.matchesPlayed,
              group: null
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
        { upsert: true, session }
      );

      tournamentResponse = tournament;
    });

    if (phaseTeamIdsForStats.length > 0) {
      recalculateStatsForTeams(phaseTeamIdsForStats).catch(err =>
        console.warn('⚠️ Stats recalculation failed in conclude:', err.message)
      );
    }

    res.json({ success: true, message: 'Tournament concluded successfully', tournament: tournamentResponse });
  } catch (error) {
    console.error('Error concluding tournament:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (error.message === 'NOT_AUTHORIZED') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (error.message === 'PHASE_NOT_FOUND') {
      return res.status(404).json({ error: `Phase "${error.meta?.phaseName}" not found` });
    }
    if (error.message === 'PHASE_NOT_FINAL_STAGE') {
      return res.status(400).json({ error: 'Only a tournament in the "final_stage" can be concluded. Use "Advance Phase" for preliminary stages.' });
    }
    if (error.message === 'TOURNAMENT_ALREADY_COMPLETED') {
      return res.status(400).json({ error: 'Tournament is already completed' });
    }
    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic tournament conclusion.'
      });
    }

    res.status(500).json({ error: 'Failed to conclude tournament' });
  } finally {
    await session.endSession();
  }
});

// ============================================================================
// LOCK REGISTRATIONS — assign all approved teams to phase 1 in bulk.
// Call this after registration closes and before group assignment starts.
// Safe to call multiple times (idempotent for already-assigned teams).
// ============================================================================

router.post('/:tournamentId/lock-registrations', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    let responsePayload = null;

    await session.withTransaction(async () => {
      const tournament = await Tournament.findById(tournamentId)
        .session(session)
        .select('organizer.organizationRef phases slots status')
        .lean();

      if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
      if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
        throw new Error('NOT_AUTHORIZED');
      }
      if (tournament.status === 'completed') {
        throw new Error('TOURNAMENT_ALREADY_COMPLETED');
      }
      if (!tournament.phases || tournament.phases.length === 0) {
        throw new Error('NO_PHASES_DEFINED');
      }

      const firstPhaseName = tournament.phases[0].name;

      const statusCounts = await Registration.aggregate([
        { $match: { tournament: new mongoose.Types.ObjectId(tournamentId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).session(session);

      const countMap = Object.fromEntries(statusCounts.map(s => [s._id, s.count]));
      const approvedCount = (countMap['approved'] || 0) + (countMap['checked_in'] || 0);
      const pendingCount = countMap['pending'] || 0;
      const totalCount = Object.values(countMap).reduce((a, b) => a + b, 0);

      const expectedSlots = tournament.slots?.total || 0;
      const fillRate = expectedSlots > 0
        ? parseFloat(((approvedCount / expectedSlots) * 100).toFixed(1))
        : 0;

      let recommendation;
      if (fillRate < 50) recommendation = 'restructure';
      else if (fillRate < 80) recommendation = 'warn';
      else recommendation = 'proceed';
      const suggestedStructure = buildStructureSuggestion(approvedCount);

      const bulkResult = await Registration.updateMany(
        {
          tournament: tournamentId,
          status: { $in: ['approved', 'checked_in'] },
          $or: [{ phase: null }, { phase: '' }, { phase: { $exists: false } }]
        },
        {
          $set: { phase: firstPhaseName, currentStage: firstPhaseName }
        },
        { session }
      );

      await Tournament.findByIdAndUpdate(
        tournamentId,
        { $set: { status: 'registration_closed' } },
        { session }
      );

      const alreadyAssigned = approvedCount - bulkResult.modifiedCount;

      responsePayload = {
        success: true,
        assignedToPhase: firstPhaseName,
        teamsAssigned: bulkResult.modifiedCount,
        alreadyAssigned,
        stats: {
          expected: expectedSlots,
          actualApproved: approvedCount,
          pending: pendingCount,
          total: totalCount,
          fillRate
        },
        recommendation,
        suggestedStructure,
        message: [
          `${bulkResult.modifiedCount} approved team(s) assigned to "${firstPhaseName}".`,
          alreadyAssigned > 0 ? `${alreadyAssigned} team(s) were already assigned.` : '',
          pendingCount > 0 ? `${pendingCount} pending registration(s) not yet assigned — approve or reject them first.` : ''
        ].filter(Boolean).join(' ')
      };
    });

    res.json(responsePayload);
  } catch (error) {
    console.error('Error locking registrations:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (error.message === 'NOT_AUTHORIZED') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (error.message === 'TOURNAMENT_ALREADY_COMPLETED') {
      return res.status(400).json({ error: 'Tournament is already completed' });
    }
    if (error.message === 'NO_PHASES_DEFINED') {
      return res.status(400).json({
        error: 'No phases defined. Add at least one phase before locking registrations.'
      });
    }
    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic registration lock.'
      });
    }

    res.status(500).json({ error: 'Failed to lock registrations' });
  } finally {
    await session.endSession();
  }
});

// ============================================================================
// REGISTRATION MANAGEMENT — list, approve, reject, bulk actions
// ============================================================================

// GET /:tournamentId/registrations?status=pending&page=1&limit=20
router.get('/:tournamentId/registrations', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef')
      .lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const filter = { tournament: tournamentId };
    if (status && status !== 'all') filter.status = status;

    // Handle search by team name or teamId
    const { search } = req.query;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingTeams = await Team.find({
        $or: [
          { teamName: searchRegex },
          { teamId: search.toUpperCase() }
        ]
      }).select('_id').lean();

      const matchingTeamIds = matchingTeams.map(t => t._id);
      filter.team = { $in: matchingTeamIds };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .populate('team', 'teamName teamTag logo region primaryGame')
        .select('team status qualifiedThrough currentStage phase group registeredAt approvedAt rejectedAt rejectionReason')
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Registration.countDocuments(filter)
    ]);

    // Status summary counts (for badge display)
    const counts = await Registration.aggregate([
      { $match: { tournament: new mongoose.Types.ObjectId(tournamentId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusCounts = Object.fromEntries(counts.map(c => [c._id, c.count]));

    res.json({
      registrations,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      statusCounts
    });
  } catch (error) {
    console.error('Error listing registrations:', error);
    res.status(500).json({ error: 'Failed to list registrations' });
  }
});

// PATCH /:tournamentId/registrations/:regId — approve or reject a single registration
router.patch('/:tournamentId/registrations/:regId', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId, regId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }
    if (!mongoose.Types.ObjectId.isValid(tournamentId) || !mongoose.Types.ObjectId.isValid(regId)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    let responsePayload = null;

    await session.withTransaction(async () => {
      const tournament = await Tournament.findById(tournamentId)
        .session(session)
        .select('organizer.organizationRef status slots')
        .lean();

      if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
      if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
        throw new Error('NOT_AUTHORIZED');
      }
      if (tournament.status === 'completed') {
        throw new Error('TOURNAMENT_COMPLETED');
      }

      const reg = await Registration.findOne({ _id: regId, tournament: tournamentId }).session(session);
      if (!reg) throw new Error('REGISTRATION_NOT_FOUND');

      if (action === 'approve') {
        const approvedCount = await Registration.countDocuments({
          tournament: tournamentId,
          status: { $in: ['approved', 'checked_in'] }
        }).session(session);

        if (approvedCount >= tournament.slots.total) {
          throw new Error('TOURNAMENT_FULL');
        }

        reg.status = 'approved';
        reg.approvedAt = new Date();
        reg.approvedBy = req.organization._id;
      } else {
        reg.status = 'rejected';
        reg.rejectedAt = new Date();
        reg.rejectedBy = req.organization._id;
        if (rejectionReason) reg.rejectionReason = rejectionReason;
      }

      await reg.save({ session });
      responsePayload = { success: true, registration: { _id: reg._id, status: reg.status } };
    });

    res.json(responsePayload);
  } catch (error) {
    console.error('Error updating registration:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (error.message === 'NOT_AUTHORIZED') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (error.message === 'TOURNAMENT_COMPLETED') {
      return res.status(400).json({ error: 'Tournament is completed' });
    }
    if (error.message === 'REGISTRATION_NOT_FOUND') {
      return res.status(404).json({ error: 'Registration not found' });
    }
    if (error.message === 'TOURNAMENT_FULL') {
      return res.status(400).json({ error: 'Tournament is full — cannot approve more teams' });
    }
    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic registration updates.'
      });
    }

    res.status(500).json({ error: 'Failed to update registration' });
  } finally {
    await session.endSession();
  }
});

// POST /:tournamentId/registrations/bulk — bulk approve / reject
// Body: { action: 'approve_all' | 'reject_all' | 'approve_selected' | 'reject_selected', ids?: string[] }
router.post('/:tournamentId/registrations/bulk', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;
    const { action, ids, rejectionReason } = req.body;

    const validActions = ['approve_all', 'reject_all', 'approve_selected', 'reject_selected'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
    }

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    let responsePayload = null;

    await session.withTransaction(async () => {
      const tournament = await Tournament.findById(tournamentId)
        .session(session)
        .select('organizer.organizationRef status slots')
        .lean();

      if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
      if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
        throw new Error('NOT_AUTHORIZED');
      }
      if (tournament.status === 'completed') {
        throw new Error('TOURNAMENT_COMPLETED');
      }

      const isApprove = action.startsWith('approve');
      const isAll = action.endsWith('_all');

      let filter = { tournament: tournamentId, status: 'pending' };
      if (!isAll) {
        if (!Array.isArray(ids) || ids.length === 0) {
          throw new Error('MISSING_SELECTED_IDS');
        }
        filter._id = { $in: ids.filter(id => mongoose.Types.ObjectId.isValid(id)) };
      }

      if (isApprove) {
        const approvedCount = await Registration.countDocuments({
          tournament: tournamentId,
          status: { $in: ['approved', 'checked_in'] }
        }).session(session);

        const available = tournament.slots.total - approvedCount;
        if (available <= 0) {
          throw new Error('TOURNAMENT_FULL');
        }

        const pending = await Registration.find(filter)
          .session(session)
          .select('_id')
          .sort({ registeredAt: 1 })
          .limit(available)
          .lean();

        if (pending.length === 0) {
          responsePayload = { success: true, modified: 0, message: 'No pending registrations to approve' };
          return;
        }

        const result = await Registration.updateMany(
          { _id: { $in: pending.map(r => r._id) } },
          { $set: { status: 'approved', approvedAt: new Date(), approvedBy: req.organization._id } },
          { session }
        );

        const remainingPending = await Registration.countDocuments(filter).session(session);

        responsePayload = {
          success: true,
          modified: result.modifiedCount,
          capped: pending.length < remainingPending,
          message: `${result.modifiedCount} team(s) approved.${result.modifiedCount < available ? '' : ' Remaining pending registrations exceed available slots.'}`
        };
        return;
      }

      const result = await Registration.updateMany(
        filter,
        {
          $set: {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: req.organization._id,
            ...(rejectionReason ? { rejectionReason } : {})
          }
        },
        { session }
      );

      responsePayload = { success: true, modified: result.modifiedCount, message: `${result.modifiedCount} team(s) rejected.` };
    });

    return res.json(responsePayload);
  } catch (error) {
    console.error('Error bulk updating registrations:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (error.message === 'NOT_AUTHORIZED') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (error.message === 'TOURNAMENT_COMPLETED') {
      return res.status(400).json({ error: 'Tournament is completed' });
    }
    if (error.message === 'MISSING_SELECTED_IDS') {
      return res.status(400).json({ error: '"ids" array required for selected bulk actions' });
    }
    if (error.message === 'TOURNAMENT_FULL') {
      return res.status(400).json({ error: 'Tournament is full — no slots available' });
    }
    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic bulk registration updates.'
      });
    }

    res.status(500).json({ error: 'Failed to bulk update registrations' });
  } finally {
    await session.endSession();
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

router.get('/:tournamentId', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // Fetch tournament — no longer populate phases.teams; Registration is the source of truth
    const tournament = await Tournament.findById(tournamentId)
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check authorization
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Fetch all related data in parallel (highly optimized)
    const [statusCounts, phaseCounts, phaseStandings, matchCount] = await Promise.all([
      // Registration counts by status
      Registration.aggregate([
        { $match: { tournament: new mongoose.Types.ObjectId(tournamentId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // Approved counts per phase
      Registration.aggregate([
        {
          $match: {
            tournament: new mongoose.Types.ObjectId(tournamentId),
            status: { $in: ['approved', 'checked_in'] }
          }
        },
        { $group: { _id: '$phase', count: { $sum: 1 } } }
      ]),

      // All phase standings summaries
      PhaseStanding.find({ tournament: tournamentId })
        .populate('topTeams.team', 'teamName teamTag logo')
        .select('phase topTeams groups')
        .sort({ phase: 1 })
        .lean(),

      // Total matches count
      Match.countDocuments({ tournament: tournamentId })
    ]);

    const statusMap = Object.fromEntries(statusCounts.map(c => [c._id, c.count]));
    const phaseCountMap = Object.fromEntries(phaseCounts.map(c => [c._id || 'unassigned', c.count]));
    const activeTeamsCount = (statusMap['approved'] || 0) + (statusMap['checked_in'] || 0);

    // Organize standings by phase and group from phase standings
    const standingsByPhase = {};
    phaseStandings.forEach(phaseStanding => {
      standingsByPhase[phaseStanding.phase] = {};

      if (phaseStanding.topTeams && phaseStanding.topTeams.length > 0) {
        // Overall standings — all teams sorted by position
        standingsByPhase[phaseStanding.phase].overall = phaseStanding.topTeams
          .slice()
          .sort((a, b) => a.position - b.position)
          .map(team => ({
            team: team.team,
            phase: phaseStanding.phase,
            group: team.group || null,
            position: team.position,
            points: team.points,
            kills: team.kills,
            positionPoints: team.positionPoints || 0,
            killPoints: team.killPoints || 0,
            chickenDinners: team.chickenDinners,
            matchesPlayed: team.matchesPlayed
          }));

        // Derive per-group standings from topTeams where group is set
        const groupMap = {};
        phaseStanding.topTeams.forEach(team => {
          if (team.group) {
            if (!groupMap[team.group]) groupMap[team.group] = [];
            groupMap[team.group].push({
              team: team.team,
              phase: phaseStanding.phase,
              group: team.group,
              position: team.position,
              points: team.points,
              kills: team.kills,
              positionPoints: team.positionPoints || 0,
              killPoints: team.killPoints || 0,
              chickenDinners: team.chickenDinners,
              matchesPlayed: team.matchesPlayed
            });
          }
        });
        Object.entries(groupMap).forEach(([groupName, teams]) => {
          standingsByPhase[phaseStanding.phase][groupName] = teams
            .slice()
            .sort((a, b) => a.points !== b.points ? b.points - a.points : b.kills - a.kills)
            .map((t, i) => ({ ...t, position: i + 1 }));
        });
      }
    });

    // Build enriched tournament response
    const enrichedTournament = {
      ...tournament,
      participatingTeams: [], // Serviced via paginated endpoints
      participatingTeamsCount: activeTeamsCount,

      // phases: metadata + standings + counts
      phases: (tournament.phases || []).map(phase => ({
        ...phase,
        teamCount: phaseCountMap[phase.name] || 0,
        standings: standingsByPhase[phase.name] || {}
      })),

      // Summary stats
      stats: {
        totalRegistrations: Object.values(statusMap).reduce((a, b) => a + b, 0),
        activeTeams: activeTeamsCount,
        pendingRegistrations: statusMap['pending'] || 0,
        totalMatches: matchCount
      }
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

router.put('/:tournamentId', verifyApprovedOrgToken, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;

    // Parse update data
    let rawUpdateData = req.body;
    if (req.body.tournamentData) {
      try {
        rawUpdateData = typeof req.body.tournamentData === 'string'
          ? JSON.parse(req.body.tournamentData)
          : req.body.tournamentData;
      } catch (e) {
        console.error('Error parsing tournamentData:', e);
        return res.status(400).json({ error: 'Invalid tournament data format' });
      }
    }

    // STRICTLY filter allowed fields for this generic update route
    const allowedFields = [
      'tournamentName', 'shortName', 'description', 'gameTitle',
      'region', 'tier', 'startDate', 'endDate', 'isOpenForAll',
      'requiresApproval', 'registrationStartDate', 'registrationEndDate',
      'slots', 'prizePool', 'rulesetDocument', 'websiteLink',
      'gameSettings', 'streamLinks', 'socialMedia', 'format', 'formatDetails',
      'media', 'phases'
    ];
    const updateData = {};

    allowedFields.forEach(field => {
      if (rawUpdateData[field] !== undefined) {
        updateData[field] = rawUpdateData[field];
      }
    });



    // Fetch tournament
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef media status phases._id phases.name startDate endDate slots.total')
      .lean();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is completed and cannot be edited.' });
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
      if (updateData.startDate) startDate.setUTCHours(0, 0, 0, 0);

      const endDate = updateData.endDate ?
        new Date(updateData.endDate) : new Date(tournament.endDate);
      if (updateData.endDate) endDate.setUTCHours(23, 59, 59, 999);

      if (endDate <= startDate) {
        return res.status(400).json({
          error: 'End date must be after start date'
        });
      }
    }

    if (Array.isArray(updateData.phases)) {
      const totalSlotsForValidation = Number(updateData?.slots?.total || tournament?.slots?.total || 0);
      const phaseInviteErrors = validatePhaseDirectInvites(updateData.phases, totalSlotsForValidation);
      if (phaseInviteErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: phaseInviteErrors
        });
      }

      updateData.phases = updateData.phases.map((phase) => ({
        ...phase,
        directInvites: normalizePhaseDirectInvites(phase?.directInvites, totalSlotsForValidation)
      }));
    }

    let updatedTournament;

    await session.withTransaction(async () => {
      updatedTournament = await Tournament.findByIdAndUpdate(
        tournamentId,
        { $set: updateData },
        { new: true, runValidators: true, session }
      )
        .select('-__v')
        .lean();

      // ── Phase rename migration ──────────────────────────────────────────────
      // If the org renamed any phase, existing Registration documents still carry
      // the old phase name and would become invisible to group-assignment and
      // standings queries. Detect renames by matching on phase._id and bulk-update.
      if (updateData.phases && Array.isArray(updateData.phases) && tournament.phases?.length > 0) {
        const renameBulkOps = [];
        for (const oldPhase of tournament.phases) {
          // Match by _id (string comparison — incoming payload may send _id as string)
          const newPhase = updateData.phases.find(
            p => p._id && p._id.toString() === oldPhase._id.toString()
          );
          if (newPhase && newPhase.name && newPhase.name !== oldPhase.name) {
            renameBulkOps.push({
              updateMany: {
                filter: { tournament: tournamentId, phase: oldPhase.name },
                update: { $set: { phase: newPhase.name, currentStage: newPhase.name } }
              }
            });
          }
        }
        if (renameBulkOps.length > 0) {
          await Registration.bulkWrite(renameBulkOps, { ordered: false, session });
          console.log(`✅ Migrated registrations for ${renameBulkOps.length} renamed phase(s)`);
        }
      }
      // ───────────────────────────────────────────────────────────────────────
    });

    res.json({
      success: true,
      message: 'Tournament updated successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('Error updating tournament:', error);

    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic tournament updates.'
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
      error: 'Failed to update tournament',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await session.endSession();
  }
});

// ============================================================================
// GET TEAMS IN A PHASE (from Registration — single source of truth)
// ============================================================================

router.get('/:tournamentId/phase-teams', verifyApprovedOrgToken, async (req, res) => {
  console.log(`[API] GET /phase-teams?phase=${req.query.phase}&page=${req.query.page}&limit=${req.query.limit}`);
  try {
    const { tournamentId } = req.params;
    const { phase } = req.query;

    if (!phase) {
      return res.status(400).json({ error: '"phase" query param is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    // Auth check (minimal select)
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef phases')
      .lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Verify phase exists
    if (!tournament.phases?.some(p => p.name === phase)) {
      return res.status(404).json({ error: `Phase "${phase}" not found` });
    }

    const { page = 1, limit = 50, all = 'false' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isAll = all === 'true';

    // Registration is the authority — one query, no stale data
    const query = Registration.find({
      tournament: tournamentId,
      phase,
      status: { $nin: ['rejected', 'withdrawn'] }
    })
      .populate('team', 'teamName teamTag logo')
      .select('team group status registeredAt');

    if (!isAll) {
      query.skip(skip).limit(parseInt(limit));
    }

    const [registrations, total] = await Promise.all([
      query.lean(),
      Registration.countDocuments({
        tournament: tournamentId,
        phase,
        status: { $nin: ['rejected', 'withdrawn'] }
      })
    ]);

    res.json({
      phase,
      total,
      page: isAll ? 1 : parseInt(page),
      limit: isAll ? total : parseInt(limit),
      teams: registrations
        .filter(r => r.team) // Safely ignore broken references
        .map(r => ({
          _id: r.team._id,
          teamName: r.team.teamName,
          teamTag: r.team.teamTag,
          logo: r.team.logo,
          group: r.group || null,
          status: r.status,
          registrationId: r._id
        }))
    });
  } catch (err) {
    console.error('Error fetching phase teams:', err);
    require('fs').writeFileSync('api-error.log', err.message + '\n' + err.stack);
    res.status(500).json({ error: 'Failed to fetch phase teams' });
  }
});

// ============================================================================
// ASSIGN GROUPS (writes to Registration.group — single source of truth)
// ============================================================================

router.put('/:tournamentId/assign-groups', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tournamentId } = req.params;
    const { phase, groups } = req.body;

    if (!phase || !Array.isArray(groups)) {
      return res.status(400).json({ error: '"phase" and "groups" array are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    // Auth check
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef phases status')
      .lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament is completed. Groups are locked.' });
    }

    const phaseDoc = tournament.phases?.find(p => p.name === phase);
    if (!phaseDoc) return res.status(404).json({ error: `Phase "${phase}" not found` });

    // Guard: reject edits to any group that is currently locked
    // (a match is scheduled for it — delete that match first to unlock)
    const lockedGroupNames = new Set(
      (phaseDoc.groups || []).filter(g => g.isLocked).map(g => g.name)
    );
    for (const group of groups) {
      if (lockedGroupNames.has(group.name)) {
        return res.status(400).json({
          error: `Group "${group.name}" is locked — a match has been scheduled for it. Delete the scheduled match first to unlock.`
        });
      }
    }

    // Build bulkWrite — one updateOne per team, all in a single round-trip
    const bulkOps = [];
    for (const group of groups) {
      if (!group.name || !Array.isArray(group.teams)) continue;
      for (const teamId of group.teams) {
        if (!mongoose.Types.ObjectId.isValid(teamId)) continue;
        bulkOps.push({
          updateOne: {
            filter: { tournament: tournamentId, team: teamId, phase },
            update: { $set: { group: group.name } }
          }
        });
      }
    }

    // Clear group on any team in this phase that wasn't included in the payload
    // (handles teams removed from a group via the UI)
    const allIncludedTeamIds = groups.flatMap(g => g.teams);
    bulkOps.push({
      updateMany: {
        filter: {
          tournament: tournamentId,
          phase,
          team: { $nin: allIncludedTeamIds.filter(id => mongoose.Types.ObjectId.isValid(id)) }
        },
        update: { $set: { group: '' } }
      }
    });

    let responsePayload = null;

    await session.withTransaction(async () => {
      if (bulkOps.length > 0) {
        await Registration.bulkWrite(bulkOps, { ordered: false, session });
      }

      // Build group metadata for tournament doc.
      // - Generate slotList from the ordered teams in the payload (slot 1 = teams[0], …)
      // - Preserve existing isLocked value (only the schedule/delete-match routes change it)
      const groupMetadata = groups
        .filter(g => g.name)
        .map(g => {
          const existingGroup = (phaseDoc.groups || []).find(eg => eg.name === g.name);
          const slotList = (g.teams || [])
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map((teamId, idx) => {
              // BGMI lobby convention:
              //   slot 1     → reserved (never assigned)
              //   slot 2     → 24th team only (last / extra team)
              //   slots 3-25 → teams 1-23 in order
              const slot = idx < 23 ? idx + 3 : 2;
              return { slot, team: teamId };
            });

          return {
            name: g.name,
            teams: [],                                   // Membership lives in Registration
            isLocked: existingGroup?.isLocked || false,  // Preserve existing lock state
            slotList
          };
        });

      await Tournament.updateOne(
        { _id: tournamentId, 'phases._id': phaseDoc._id },
        { $set: { 'phases.$.groups': groupMetadata } },
        { session }
      );

      responsePayload = {
        success: true,
        message: `Groups saved for phase "${phase}"`,
        groupsCreated: groups.length,
        teamsAssigned: allIncludedTeamIds.length
      };
    });

    res.json(responsePayload);
  } catch (err) {
    console.error('Error assigning groups:', err);

    if (err.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic group assignments.'
      });
    }

    res.status(500).json({ error: 'Failed to assign groups' });
  } finally {
    await session.endSession();
  }
});

// ============================================================================
// GET GROUP SLOT LIST — returns groups with their slotList populated with
// team names/logos for a given phase. Used by TeamGrouping & MatchScheduler.
// ============================================================================

router.get('/:tournamentId/group-slot-list', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { phase } = req.query;

    if (!phase) {
      return res.status(400).json({ error: '"phase" query parameter is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef phases')
      .lean();

    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const phaseDoc = tournament.phases?.find(p => p.name === phase);
    if (!phaseDoc) return res.status(404).json({ error: `Phase "${phase}" not found` });

    const groups = phaseDoc.groups || [];

    // Collect all unique team IDs across all group slotLists in one pass
    const allTeamIds = groups.flatMap(g =>
      (g.slotList || []).map(s => s.team).filter(Boolean)
    );

    // Single batch populate for all teams
    const teamDocs = await Team.find({ _id: { $in: allTeamIds } })
      .select('teamName teamTag logo')
      .lean();

    const teamMap = Object.fromEntries(teamDocs.map(t => [t._id.toString(), t]));

    const enrichedGroups = groups.map(g => ({
      name: g.name,
      isLocked: g.isLocked || false,
      slotList: (g.slotList || [])
        .sort((a, b) => a.slot - b.slot)
        .map(s => ({
          slot: s.slot,
          team: s.team ? (teamMap[s.team.toString()] || { _id: s.team }) : null
        }))
    }));

    res.json({ groups: enrichedGroups });
  } catch (err) {
    console.error('Error fetching group slot list:', err);
    res.status(500).json({ error: 'Failed to fetch group slot list' });
  }
});

// ============================================================================
// ADD TEAM TO PHASE (UPDATED FOR NEW SCHEMA)
// ============================================================================

router.post('/:tournamentId/phases/:phase/teams', verifyApprovedOrgToken, async (req, res) => {
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

    // Registration is the single source of truth — update phase & optional group
    await Registration.findByIdAndUpdate(registration._id, {
      $set: {
        phase,
        currentStage: phase,
        ...(group && { group })
      }
    });

    res.json({
      success: true,
      message: 'Team added to phase successfully'
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

router.delete('/:tournamentId/phases/:phase/teams/:teamId', verifyApprovedOrgToken, async (req, res) => {
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

    // Check if team is actually assigned to this phase (Registration is the authority)
    const teamRegistration = await Registration.findOne({
      tournament: tournamentId,
      team: teamId,
      phase
    }).select('_id').lean();

    if (!teamRegistration) {
      return res.status(400).json({ error: 'Team is not in this phase' });
    }

    // Registration is the single source of truth — clear phase & group
    await Registration.updateOne(
      { tournament: tournamentId, team: teamId },
      { $set: { phase: '', currentStage: 'Registered', group: '' } }
    );

    res.json({
      success: true,
      message: 'Team removed from phase successfully'
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
  verifyApprovedOrgToken,
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
        startDate.setUTCHours(0, 0, 0, 0); // 12 AM UTC

        const endDate = new Date(tournamentData.endDate);
        endDate.setUTCHours(23, 59, 59, 999); // 11:59 PM UTC

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setUTCHours(0, 0, 0, 0);

        if (startDate < startOfToday) {
          validationErrors.push('Start date cannot be in the past');
        }
        if (endDate <= startDate) {
          validationErrors.push(`End date must be after start date. (Start: ${startDate.toISOString()}, End: ${endDate.toISOString()})`);
        }

        // Registration dates validation
        if (tournamentData.registrationStartDate && tournamentData.registrationEndDate) {
          const regStart = new Date(tournamentData.registrationStartDate);
          const regEnd = new Date(tournamentData.registrationEndDate);

          // Only normalize if date-only (length <= 10). 
          // Datetime-local (length > 10) strings keep their specific times.
          if (tournamentData.registrationStartDate.length <= 10) regStart.setUTCHours(0, 0, 0, 0);
          if (tournamentData.registrationEndDate.length <= 10) regEnd.setUTCHours(23, 59, 59, 999);

          // Rule: Registration must end on or before the tournament start day.
          const startDateMidnight = new Date(startDate);
          startDateMidnight.setUTCHours(0, 0, 0, 0);
          const regEndMidnight = new Date(regEnd);
          regEndMidnight.setUTCHours(0, 0, 0, 0);

          if (regEndMidnight > startDateMidnight) {
            validationErrors.push('Registration must end on or before the tournament start date.');
          }
          if (regStart >= regEnd) {
            validationErrors.push('Registration end date must be after registration start date');
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
        if (total > 4096) {
          validationErrors.push('Maximum 4096 teams allowed per tournament');
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

      const totalSlotsForValidation = Number(tournamentData?.slots?.total || 0);
      const phaseInviteErrors = validatePhaseDirectInvites(tournamentData?.phases, totalSlotsForValidation);
      if (phaseInviteErrors.length > 0) {
        validationErrors.push(...phaseInviteErrors);
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
          website: req.organization.orgSocial?.website || ''
        },

        // Sponsors (if provided)
        sponsors: Array.isArray(tournamentData.sponsors) ?
          tournamentData.sponsors : [],

        // Timeline
        announcementDate: tournamentData.announcementDate || new Date(),
        startDate: (() => {
          const d = new Date(tournamentData.startDate);
          d.setUTCHours(0, 0, 0, 0);
          return d;
        })(),
        endDate: (() => {
          const d = new Date(tournamentData.endDate);
          d.setUTCHours(23, 59, 59, 999);
          return d;
        })(),
        registrationStartDate: tournamentData.registrationStartDate ?
          new Date(tournamentData.registrationStartDate) : null,
        registrationEndDate: tournamentData.registrationEndDate ?
          new Date(tournamentData.registrationEndDate) : null,

        status: 'announced',
        isOpenForAll: tournamentData.isOpenForAll || false,
        // When true: open registrations go to 'pending' for org review
        // When false (default): auto-approved on sign-up (first-come-first-served)
        requiresApproval: (tournamentData.isOpenForAll && tournamentData.requiresApproval) ? true : false,

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
            startDate: phase.startDate ? (() => {
              const d = new Date(phase.startDate);
              d.setUTCHours(0, 0, 0, 0);
              return d;
            })() : null,
            endDate: phase.endDate ? (() => {
              const d = new Date(phase.endDate);
              d.setUTCHours(23, 59, 59, 999);
              return d;
            })() : null,
            status: 'upcoming',
            details: phase.details || '',
            directInvites: normalizePhaseDirectInvites(phase?.directInvites, Number(tournamentData.slots?.total || 0)),
            teams: [],
            groups: Array.isArray(phase.groups) ? phase.groups : [],
            qualificationRules: Array.isArray(phase.qualificationRules) ?
              phase.qualificationRules : []
          })) : [],

        // Prize pool
        prizePool: {
          total: Number(tournamentData.prizePool?.total) || 0,
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
        // Game settings (game-aware: always enforce correct matchFormat from registry)
        gameSettings: (() => {
          const gameKey = tournamentData.gameTitle || 'BGMI';
          // Start from frontend-provided settings or build defaults
          const base = tournamentData.gameSettings || {};
          if (gameKey === 'VALORANT') {
            return {
              serverRegion: base.serverRegion || tournamentData.region || 'India',
              gameMode: base.gameMode || 'Standard',
              maps: Array.isArray(base.maps) ? base.maps : [],
              teamSize: base.teamSize || 5,
              matchFormat: '1v1',   // ALWAYS enforce — schema only allows '1v1' or '1vAll'
              bestOf: base.bestOf || 1,
              pointsSystem: base.pointsSystem || undefined,
            };
          }
          // BGMI / default
          return {
            serverRegion: base.serverRegion || tournamentData.region || 'India',
            gameMode: base.gameMode || 'TPP Squad',
            maps: Array.isArray(base.maps) ? base.maps : ['Erangel', 'Miramar'],
            teamSize: base.teamSize || 4,
            matchFormat: '1vAll',   // ALWAYS enforce
            pointsSystem: base.pointsSystem || {
              killPoints: 1,
              placementPoints: {
                1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
              }
            }
          };
        })(),

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
      console.log(`✅ Tournament creation requested. Prize pool data:`, tournamentData.prizePool);
      console.log(`✅ Payload prizePool:`, tournamentPayload.prizePool);
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

// ============================================================================
// UPLOAD MATCH RESULT SCREENSHOT (OCR Integration - Currently using random data)
// ============================================================================

/**
 * @route   POST /api/org-tournaments/matches/:matchId/upload-result
 * @desc    Process match result screenshot with OCR (or random data for now)
 * @access  Organization (must own the tournament)
 */
router.post(
  '/matches/:matchId/upload-result',
  verifyApprovedOrgToken,
  upload.single('screenshot'),
  async (req, res) => {
    try {
      const { matchId } = req.params;

      // Validate file upload
      if (!req.file) {
        return res.status(400).json({ error: 'No screenshot file uploaded' });
      }

      // Fetch match with tournament data
      const match = await Match.findById(matchId)
        .populate('tournament', 'organizer tournamentName gameSettings phases status');

      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      // Verify organization owns this tournament
      if (match.tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
        return res.status(403).json({ error: 'Not authorized to update this match' });
      }

      // Check if tournament is concluded
      if (match.tournament.status === 'completed') {
        return res.status(400).json({ error: 'Tournament is concluded. Results are locked.' });
      }

      // Get teams from participatingGroups via Registration collection
      const phase = match.tournament.phases?.find(p => p.name === match.tournamentPhase);
      if (!phase) {
        return res.status(400).json({ error: 'Tournament phase not found' });
      }

      // Get group names from participatingGroups
      const groupNames = match.participatingGroups?.map(groupId => {
        const group = phase.groups?.find(g =>
          g?._id?.toString() === groupId ||
          g?.id?.toString?.() === groupId ||
          g?.name === groupId
        );
        return group?.name;
      }).filter(Boolean) || [];

      // Fetch teams from Registration collection
      const registrations = await Registration.find({
        tournament: match.tournament._id,
        phase: match.tournamentPhase,
        group: { $in: groupNames },
        status: { $in: ['approved', 'checked_in'] }
      }).populate('team', 'teamName teamTag logo').populate('roster.player', 'username');

      if (!registrations || registrations.length === 0) {
        return res.status(400).json({ error: 'No teams found for this match' });
      }

      // TODO: Replace this with actual OCR processing
      // Pass req.file.buffer to your OCR service here
      // For now, using random data to populate match results
      const processedResults = generateRandomMatchResults(registrations, match.tournament.gameSettings);

      // Update match with processed results
      match.results = processedResults.teams;
      match.status = 'completed';
      match.matchStats = processedResults.matchStats;

      // Mark as processed (no screenshot storage)
      if (!match.metadata) {
        match.metadata = {};
      }
      match.metadata.ocrProcessed = true;
      match.metadata.ocrProcessedAt = new Date();

      await match.save();

      // Fetch updated match with populated teams for response
      const updatedMatch = await Match.findById(matchId)
        .populate('results.team', 'teamName teamTag logo')
        .populate('results.kills.breakdown.player', 'username');

      res.json({
        success: true,
        message: 'Match results processed successfully',
        match: updatedMatch,
        note: 'Currently using simulated data. OCR integration pending.'
      });

    } catch (error) {
      console.error('Error processing match result screenshot:', error);
      res.status(500).json({
        error: 'Failed to process match result',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Helper function to generate random match results
 * This will be replaced with actual OCR processing
 * @param {Array} registrations - Array of registration documents with team and roster info
 * @param {Object} gameSettings - Tournament game settings with points system
 */
function generateRandomMatchResults(registrations, gameSettings) {
  const numTeams = registrations.length;

  // Generate random positions (1 to numTeams, shuffled)
  const positions = Array.from({ length: numTeams }, (_, i) => i + 1);

  // Shuffle positions using Fisher-Yates algorithm
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // Get points system from gameSettings or use default
  const placementPointsMap = gameSettings?.pointsSystem?.placementPoints || {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
  };
  const killPointsValue = gameSettings?.pointsSystem?.killPoints || 1;

  let totalMatchKills = 0;
  let mostKillsPlayer = null;
  let maxKills = 0;

  // Build results array from registrations
  const teams = registrations.map((registration, index) => {
    const position = positions[index];
    const placementPoints = placementPointsMap[position] || 0;

    // Generate random kills for the team (0-20, higher probability for top positions)
    const baseKills = position <= 5
      ? Math.floor(Math.random() * 15) + 5  // 5-20 kills for top 5
      : Math.floor(Math.random() * 12);     // 0-12 kills for others

    const killPoints = baseKills * killPointsValue;

    // Distribute kills among players in the roster
    const killBreakdown = [];
    if (baseKills > 0 && registration.roster && registration.roster.length > 0) {
      const killDistribution = distributeKillsAmongPlayers(baseKills, registration.roster.length);

      registration.roster.forEach((rosterPlayer, playerIndex) => {
        const playerKills = killDistribution[playerIndex] || 0;
        if (playerKills > 0) {
          killBreakdown.push({
            player: rosterPlayer.player,
            kills: playerKills
          });

          // Track most kills player
          if (playerKills > maxKills) {
            maxKills = playerKills;
            mostKillsPlayer = {
              player: rosterPlayer.player,
              kills: playerKills
            };
          }
        }
      });
    }

    totalMatchKills += baseKills;

    return {
      team: registration.team._id,
      finalPosition: position,
      chickenDinner: position === 1,
      points: {
        placementPoints,
        killPoints,
        totalPoints: placementPoints + killPoints
      },
      kills: {
        total: baseKills,
        breakdown: killBreakdown
      }
    };
  });

  return {
    teams,
    matchStats: {
      totalKills: totalMatchKills,
      mostKillsPlayer: mostKillsPlayer
    }
  };
}

/**
 * Helper function to distribute kills among players
 */
function distributeKillsAmongPlayers(totalKills, numPlayers) {
  const distribution = Array(numPlayers).fill(0);

  // Randomly distribute kills
  for (let i = 0; i < totalKills; i++) {
    const randomPlayer = Math.floor(Math.random() * numPlayers);
    distribution[randomPlayer]++;
  }

  return distribution;
}

// ============================================================================
// TOURNAMENT ANNOUNCEMENTS (ORG)
// ============================================================================

// POST /api/org-tournaments/:id/announcements
// Create an announcement and optionally DM all affected players
router.post('/:id/announcements', verifyApprovedOrgToken, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: tournamentId } = req.params;
    const { title, message, targetType, targetTeams, targetPhase, targetGroup } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const validTargetTypes = ['general', 'specific_teams', 'phase', 'group'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({ error: 'Invalid targetType' });
    }

    let announcementResponse = null;
    let chatDocsForEmit = [];
    let shouldEmit = false;

    // Validate target-specific fields
    if (targetType === 'specific_teams' && (!targetTeams || targetTeams.length === 0)) {
      return res.status(400).json({ error: 'Specify at least one team for specific_teams targeting' });
    }
    if ((targetType === 'phase' || targetType === 'group') && !targetPhase) {
      return res.status(400).json({ error: 'targetPhase is required for phase/group targeting' });
    }
    if (targetType === 'group' && !targetGroup) {
      return res.status(400).json({ error: 'targetGroup is required for group targeting' });
    }

    await session.withTransaction(async () => {
      const tournament = await Tournament.findOne({
        _id: tournamentId,
        'organizer.organizationRef': req.organization._id,
      }).session(session).select('tournamentName');

      if (!tournament) {
        throw new Error('TOURNAMENT_NOT_FOUND_OR_ACCESS_DENIED');
      }

      const announcement = new TournamentAnnouncement({
        tournamentId,
        organizationId: req.organization._id,
        title: title.trim(),
        message: message.trim(),
        targetType,
        targetTeams: targetType === 'specific_teams' ? targetTeams : [],
        targetPhase: (targetType === 'phase' || targetType === 'group') ? targetPhase : undefined,
        targetGroup: targetType === 'group' ? targetGroup : undefined,
      });

      await announcement.save({ session });

      if (targetType !== 'general') {
        let teamIds = [];

        if (targetType === 'specific_teams') {
          teamIds = targetTeams;
        } else if (targetType === 'phase') {
          const regs = await Registration.find({
            tournament: tournamentId,
            phase: targetPhase,
            status: { $in: ['approved', 'checked_in'] },
          }).session(session).select('team');
          teamIds = regs.map((r) => r.team);
        } else if (targetType === 'group') {
          const regs = await Registration.find({
            tournament: tournamentId,
            phase: targetPhase,
            group: targetGroup,
            status: { $in: ['approved', 'checked_in'] },
          }).session(session).select('team');
          teamIds = regs.map((r) => r.team);
        }

        if (teamIds.length > 0) {
          const teams = await Team.find({ _id: { $in: teamIds } }).session(session).select('players captain');
          const playerIdSet = new Set();
          teams.forEach((t) => {
            t.players.forEach((p) => playerIdSet.add(p.toString()));
            if (t.captain) playerIdSet.add(t.captain.toString());
          });
          const playerIds = [...playerIdSet];

          if (playerIds.length > 0) {
            const dmMessage = `[${tournament.tournamentName}] ${title.trim()}: ${message.trim()}`;
            const metadata = {
              type: 'tournament_announcement',
              announcementId: announcement._id.toString(),
              title: title.trim(),
              tournamentId: tournamentId.toString(),
              tournamentName: tournament.tournamentName,
              targetType,
            };

            chatDocsForEmit = playerIds.map((pid) => ({
              senderId: 'system',
              receiverId: pid,
              message: dmMessage,
              messageType: 'announcement',
              metadata,
              timestamp: new Date(),
            }));

            await ChatMessage.insertMany(chatDocsForEmit, { session });

            announcement.dmsSent = playerIds.length;
            await announcement.save({ session });
            shouldEmit = true;
          }
        }
      }

      announcementResponse = announcement;
    });

    if (shouldEmit && chatDocsForEmit.length > 0) {
      const io = req.app.get('io');
      if (io) {
        chatDocsForEmit.forEach((doc) => {
          io.to(doc.receiverId).emit('receiveMessage', {
            _id: `ann_${announcementResponse._id}_${doc.receiverId}`,
            senderId: 'system',
            receiverId: doc.receiverId,
            message: doc.message,
            messageType: 'announcement',
            metadata: doc.metadata,
            timestamp: doc.timestamp,
          });
        });
      }
    }

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement: announcementResponse,
    });
  } catch (error) {
    console.error('Error creating announcement:', error);

    if (error.message === 'TOURNAMENT_NOT_FOUND_OR_ACCESS_DENIED') {
      return res.status(404).json({ error: 'Tournament not found or access denied' });
    }
    if (error.message?.includes('Transaction numbers are only allowed')) {
      return res.status(500).json({
        error: 'Database transaction not supported by current MongoDB topology',
        message: 'Enable replica set or sharded cluster for atomic announcement delivery.'
      });
    }

    res.status(500).json({ error: 'Failed to create announcement' });
  } finally {
    await session.endSession();
  }
});

// GET /api/org-tournaments/:id/announcements
// Org: list all announcements for their tournament (newest first)
router.get('/:id/announcements', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { id: tournamentId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Verify ownership
    const tournament = await Tournament.findOne({
      _id: tournamentId,
      'organizer.organizationRef': req.organization._id,
    }).select('_id');

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found or access denied' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [announcements, total] = await Promise.all([
      TournamentAnnouncement.find({ tournamentId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('targetTeams', 'teamName teamTag logo')
        .lean(),
      TournamentAnnouncement.countDocuments({ tournamentId }),
    ]);

    res.json({ announcements, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// SWISS SYSTEM ROUTES (Valorant)
// ─────────────────────────────────────────────────────────────────────────────

import {
  calculateStandings,
  generateSwissMatchups,
  getSwissStatus,
} from '../utils/standingsCalculator.js';
import { getGameConfig } from '../config/gameRegistry.js';

// ── GET /api/org-tournaments/:tournamentId/standings ──────────────────────────
// Returns current standings for the active phase (game-aware)
router.get('/:tournamentId/standings', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { phase } = req.query; // optional: filter by phase name

    const tournament = await Tournament.findOne({
      _id: tournamentId,
      organization: req.organization._id, // verifyApprovedOrgToken sets req.organization
    }).lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const matchQuery = { tournament: tournamentId, status: 'completed' };
    if (phase) matchQuery.tournamentPhase = phase;

    const matches = await Match.find(matchQuery)
      .populate('vsResults.teamA', 'teamName teamTag logo')
      .populate('vsResults.teamB', 'teamName teamTag logo')
      .populate('vsResults.winner', 'teamName')
      .populate('results.team', 'teamName')
      .lean();

    const gameConfig = getGameConfig(tournament.gameTitle);
    const useBuchholz = gameConfig?.swiss?.useBuchholz ?? false;

    const standings = calculateStandings(tournament.gameTitle, matches, {
      includeBuchholz: useBuchholz,
    });

    res.json({ standings, gameTitle: tournament.gameTitle, matchCount: matches.length });
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// ── POST /api/org-tournaments/:tournamentId/swiss/next-round ──────────────────
// Generate matchups for the next Swiss round
router.post('/:tournamentId/swiss/next-round', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { phase, scheduledStartTime, bestOf = 1 } = req.body;

    const tournament = await Tournament.findOne({
      _id: tournamentId,
      organization: req.organization._id,
    }).lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.gameTitle !== 'VALORANT') {
      return res.status(400).json({ error: 'Swiss system is only available for Valorant tournaments' });
    }

    const gameConfig = getGameConfig('VALORANT');
    const swissCfg = gameConfig.swiss;

    // Get current standings
    const completedMatches = await Match.find({
      tournament: tournamentId,
      tournamentPhase: phase,
      status: 'completed',
    })
      .populate('vsResults.teamA', 'teamName')
      .populate('vsResults.teamB', 'teamName')
      .populate('vsResults.winner')
      .lean();

    const standings = calculateStandings('VALORANT', completedMatches, { includeBuchholz: true });
    const { active, advanced, eliminated } = getSwissStatus(standings, swissCfg.winsToAdvance, swissCfg.lossesToEliminate);

    if (active.length < 2) {
      return res.status(400).json({
        error: 'Not enough active teams to generate a new round',
        advanced,
        eliminated,
      });
    }

    // Generate matchups from active teams only
    const activeStandings = standings.filter(s => active.includes(s.teamId));
    const matchups = generateSwissMatchups(activeStandings, { avoidRematches: true });

    if (matchups.length === 0) {
      return res.status(400).json({ error: 'Could not generate matchups — all combinations may be rematches' });
    }

    // Determine round number from existing matches in this phase
    const existingMatches = await Match.find({ tournament: tournamentId, tournamentPhase: phase }).lean();
    // Safe round number — reduce handles empty array correctly (no spread of empty)
    const roundNumber = existingMatches.reduce((max, m) => Math.max(max, m.bracketRound || 0), 0) + 1;

    // Idempotency guard: abort if scheduled matches already exist for this round
    const alreadyScheduled = await Match.countDocuments({
      tournament: tournamentId,
      tournamentPhase: phase,
      bracketRound: roundNumber,
      status: 'scheduled',
    });
    if (alreadyScheduled > 0) {
      return res.status(409).json({ error: `Round ${roundNumber} already has ${alreadyScheduled} scheduled match(es). Complete them first.` });
    }

    // Create Match documents
    const matchDocs = [];
    for (let i = 0; i < matchups.length; i++) {
      const { teamA, teamB } = matchups[i];
      const teamADoc = await Team.findById(teamA).select('teamName teamTag').lean();
      const teamBDoc = await Team.findById(teamB).select('teamName teamTag').lean();

      matchDocs.push({
        matchNumber: existingMatches.length + i + 1,
        tournament: tournamentId,
        tournamentPhase: phase,
        scheduledStartTime: scheduledStartTime || new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'scheduled',
        gameTitle: 'VALORANT',
        map: 'TBD',
        bracketRound: roundNumber,
        metadata: { bestOf, swissRound: roundNumber },
        vsResults: {
          teamA,
          teamB,
          teamAName: teamADoc?.teamName,
          teamBName: teamBDoc?.teamName,
        },
      });
    }

    const created = await Match.insertMany(matchDocs);

    // The vetoWindowScheduler cron picks up new matches automatically on its next tick (every minute)

    res.status(201).json({
      message: `Round ${roundNumber} generated`,
      matchups: created.length,
      matches: created,
      roundNumber,
      swissStatus: { active: active.length, advanced: advanced.length, eliminated: eliminated.length },
    });
  } catch (error) {
    console.error('Error generating Swiss round:', error);
    res.status(500).json({ error: 'Failed to generate Swiss round' });
  }
});

// ── POST /api/org-tournaments/:tournamentId/swiss/advance ─────────────────────
// Advance the Swiss stage — move qualifying teams to the next phase
router.post('/:tournamentId/swiss/advance', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { fromPhase, toPhase } = req.body;

    if (!fromPhase || !toPhase) {
      return res.status(400).json({ error: 'fromPhase and toPhase are required' });
    }

    const tournament = await Tournament.findOne({ _id: tournamentId, organization: req.organization._id }).lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Check any matches still pending in this phase
    const pendingMatches = await Match.countDocuments({
      tournament: tournamentId,
      tournamentPhase: fromPhase,
      status: { $in: ['scheduled', 'in_progress'] },
    });
    if (pendingMatches > 0) {
      return res.status(400).json({ error: `${pendingMatches} match(es) in '${fromPhase}' are still pending. Complete them before advancing.` });
    }

    const completedMatches = await Match.find({
      tournament: tournamentId,
      tournamentPhase: fromPhase,
      status: 'completed',
    })
      .populate('vsResults.teamA vsResults.teamB vsResults.winner results.team')
      .lean();

    const standings = calculateStandings(tournament.gameTitle, completedMatches, { includeBuchholz: true });
    const gameConfig = getGameConfig(tournament.gameTitle);
    const swissCfg = gameConfig?.swiss;

    let qualifiedTeamIds;
    if (swissCfg) {
      const { advanced } = getSwissStatus(standings, swissCfg.winsToAdvance, swissCfg.lossesToEliminate);
      qualifiedTeamIds = advanced;
    } else {
      // Default: top N based on points
      const topN = req.body.topN || Math.ceil(standings.length / 2);
      qualifiedTeamIds = standings.slice(0, topN).map(s => s.teamId);
    }

    if (qualifiedTeamIds.length === 0) {
      return res.status(400).json({ error: 'No teams have qualified yet' });
    }

    // Register qualified teams in the next phase
    const currentRegs = await Registration.find({
      tournament: tournamentId,
      team: { $in: qualifiedTeamIds },
    }).lean();

    const regUpdates = [];
    for (const reg of currentRegs) {
      if (!qualifiedTeamIds.includes(reg.team.toString())) continue;
      regUpdates.push(
        Registration.findByIdAndUpdate(reg._id, { $addToSet: { phases: toPhase } }, { new: true })
      );
    }
    await Promise.all(regUpdates);

    // Send notifications
    await sendPhaseOutcomeNotifications({
      tournamentId,
      tournamentName: tournament.tournamentName,
      phaseName: fromPhase,
      nextPhaseName: toPhase,
      qualifiedTeamIds,
    });

    res.json({
      message: `${qualifiedTeamIds.length} team(s) advanced from '${fromPhase}' to '${toPhase}'`,
      qualifiedTeamIds,
      standings: standings.slice(0, 10),
    });
  } catch (error) {
    console.error('Error advancing Swiss phase:', error);
    res.status(500).json({ error: 'Failed to advance phase' });
  }
});

export default router;
