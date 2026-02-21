# Implementation Plan: Registration as Single Source of Truth

## Problem Summary
Two places store the same fact ("team X is in phase Y"):
- `Tournament.phases[x].teams[]` — read by **Groups tab** (`TeamGrouping.jsx`)
- `Registration.phase` — read by **Teams tab** (via `GET /:tournamentId` → `participatingTeams`)

Any code that registers a team must write to both places. If one write is missed the data diverges (as just happened with the manually-registered 31st team).

---

## Goal
`Registration` is the **only** place team-phase and team-group assignments live.
`Tournament.phases[x]` keeps only **metadata** (name, type, dates, status, matches, qualificationRules).

---

## Files Changed

| # | File | Change Type |
|---|------|-------------|
| 1 | `server/scripts/fixPhaseTeams6998.js` | **Run once** — migrate existing data to Registration |
| 2 | `server/routes/teamTournament.routes.js` | **Revert hotfix** — remove the $push we just added (no longer needed) |
| 3 | `server/routes/orgTournament.routes.js` | **Two new endpoints** + update GET response |
| 4 | `server/routes/orgTournament.routes.js` | **Update** add/remove-team-to-phase routes to NOT touch `phases.$.teams` |
| 5 | `client/src/orgs/TournamentManagementComponents/TeamGrouping.jsx` | **Rewrite** — fetch from API instead of reading prop |
| 6 | `server/scripts/fixPhaseTeams6998.js` | **Delete** after successful migration |

---

## Step-by-Step Instructions

---

### STEP 0 — Run the one-time data migration

**File:** `server/scripts/fixPhaseTeams6998.js` (already written)

This script already finds all registrations for the tournament that are missing from `phases[0].teams` and pushes them in. This fixes the 31st team right now.

```bash
# In server/
node scripts/fixPhaseTeams6998.js
```

Expected output:
```
✓   Teams already in phase: 30
⚠️   Teams MISSING from phase: 1
✅  Fixed! phases[0].teams now has: 31 teams
```

After this step is confirmed working, the migration is complete and we proceed with making sure it never happens again.

---

### STEP 1 — Add two new backend endpoints to `orgTournament.routes.js`

Add these two routes **before** the existing `add team to phase` route (before line ~868).

---

#### Endpoint A: `GET /:tournamentId/phase-teams`
Returns all registered teams for a given phase, read from `Registration`.
This replaces `TeamGrouping.jsx` reading `tournament.phases[x].teams`.

```js
// GET /api/org-tournaments/:tournamentId/phase-teams?phase=Qualifiers
router.get('/:tournamentId/phase-teams', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { phase } = req.query;

    if (!phase) {
      return res.status(400).json({ error: 'phase query param is required' });
    }

    // Auth check
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef')
      .lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Single Registration query — the authoritative source
    const registrations = await Registration.find({
      tournament: tournamentId,
      phase: phase,               // ← Registration.phase is the source of truth
      status: { $nin: ['rejected', 'withdrawn'] }
    })
      .populate('team', 'teamName teamTag logo')
      .select('team group status registeredAt')
      .lean();

    res.json({
      phase,
      teams: registrations.map(r => ({
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
    res.status(500).json({ error: 'Failed to fetch phase teams' });
  }
});
```

---

#### Endpoint B: `PUT /:tournamentId/assign-groups`
Bulk-assigns teams to groups by updating `Registration.group`.
This replaces writing to `tournament.phases[x].groups[x].teams`.

```js
// PUT /api/org-tournaments/:tournamentId/assign-groups
// Body: { phase: 'Qualifiers', groups: [{ name: 'Group A', teams: ['teamId1', 'teamId2'] }, ...] }
router.put('/:tournamentId/assign-groups', verifyApprovedOrgToken, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { phase, groups } = req.body;

    if (!phase || !Array.isArray(groups)) {
      return res.status(400).json({ error: 'phase and groups[] are required' });
    }

    // Auth check
    const tournament = await Tournament.findById(tournamentId)
      .select('organizer.organizationRef phases')
      .lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.organizer.organizationRef?.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Verify phase exists
    const phaseExists = tournament.phases?.some(p => p.name === phase);
    if (!phaseExists) return res.status(404).json({ error: `Phase "${phase}" not found` });

    // Build bulkWrite operations — one updateOne per team
    const bulkOps = [];
    for (const group of groups) {
      for (const teamId of group.teams) {
        bulkOps.push({
          updateOne: {
            filter: { tournament: tournamentId, team: teamId, phase },
            update: { $set: { group: group.name } }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await Registration.bulkWrite(bulkOps, { ordered: false });
    }

    // Also persist the group names (not teams) into tournament.phases[x].groups
    // so the schema still knows which group names exist for this phase
    const phaseObj = tournament.phases.find(p => p.name === phase);
    if (phaseObj) {
      const groupMetadata = groups.map(g => ({ name: g.name, teams: [] })); // no team IDs stored
      await Tournament.updateOne(
        { _id: tournamentId, 'phases._id': phaseObj._id },
        { $set: { 'phases.$.groups': groupMetadata } }
      );
    }

    res.json({ success: true, message: `Groups saved for phase "${phase}"` });
  } catch (err) {
    console.error('Error assigning groups:', err);
    res.status(500).json({ error: 'Failed to assign groups' });
  }
});
```

**Note:** We still store group *names* in `phases[x].groups` (so `PhaseManager` and `PointsTable` have group names available), but we no longer store team ObjectIds there.

---

### STEP 2 — Update existing `add/remove team to phase` routes

**File:** `server/routes/orgTournament.routes.js`

**`POST /:tournamentId/phases/:phase/teams`** (line ~868)
Currently updates BOTH `phases.$.teams` AND `Registration.phase`. After refactor, only update `Registration`. Remove the `Tournament.updateOne(... $addToSet)` call.

**`DELETE /:tournamentId/phases/:phase/teams/:teamId`** (line ~954)
Currently pulls from `phases.$.teams` AND clears `Registration.phase`. After refactor, only update `Registration`. Remove the `Tournament.updateOne(... $pull)` call.

---

### STEP 3 — Update `GET /:tournamentId` response

**File:** `server/routes/orgTournament.routes.js` (line ~598)

Currently the route populates `phases.teams` (which is the stale array) and sends it to the frontend in `phases: [..., teams: phase.teams]`.

After the refactor, the Groups tab no longer needs `phases[x].teams` at all (it fetches from the API). The Teams tab already uses `participatingTeams` from `Registration`. So:

1. Remove `.populate('phases.teams', 'teamName teamTag logo')` from the `Tournament.findById` query.
2. In the response builder, change `phases: tournament.phases?.map(phase => ({ ...phase, teams: phase.teams || [] ...}))` to simply spread `phase` without the `teams` field, or set `teams: undefined`.

This prevents the frontend from ever accidentally reading the stale `phases[x].teams` array.

---

### STEP 4 — Rewrite `TeamGrouping.jsx`

**File:** `client/src/orgs/TournamentManagementComponents/TeamGrouping.jsx`

**Current behavior:**
- `getPhaseTeams()` reads from `tournament.phases[x].teams` (the prop)
- `handleSave()` calls `PUT /api/tournaments/:id/groups` with group definitions

**New behavior:**
- On phase selection, `useEffect` fetches `GET /api/org-tournaments/:id/phase-teams?phase=X`
- `handleSave()` calls `PUT /api/org-tournaments/:id/assign-groups` with `{ phase, groups: [{name, teams: [teamId, ...]}] }`
- Internally, `phaseTeams` is local state populated from the API

**Key state changes:**
```js
// New state
const [phaseTeams, setPhaseTeams] = useState([]);   // fetched from API
const [phaseLoading, setPhaseLoading] = useState(false);

// Replace getPhaseTeams() function with a useEffect that fetches:
useEffect(() => {
  if (!selectedPhase) { setPhaseTeams([]); return; }
  setPhaseLoading(true);
  axiosInstance
    .get(`/api/org-tournaments/${tournament._id}/phase-teams?phase=${encodeURIComponent(selectedPhase)}`)
    .then(r => setPhaseTeams(r.data.teams))
    .catch(() => toast.error('Failed to load phase teams'))
    .finally(() => setPhaseLoading(false));
}, [selectedPhase, tournament._id]);
```

**handleSave() new body:**
```js
await axiosInstance.put(
  `/api/org-tournaments/${tournament._id}/assign-groups`,
  { phase: selectedPhase, groups: groups.map(g => ({ name: g.name, teams: g.teams })) }
);
```

The group cards display logic stays the same — they just source from `phaseTeams` state instead of `getPhaseTeams()`.

---

### STEP 5 — Revert the hotfix in `teamTournament.routes.js`

**File:** `server/routes/teamTournament.routes.js`

Remove the `Tournament.updateOne(... $push: { 'phases.$.teams': req.team._id })` block we added in the previous conversation. After this refactor, registrations do NOT need to touch `phases[x].teams` at all — `Registration.phase` is sufficient.

---

### STEP 6 — Update `advance-phase` route (minor)

**File:** `server/routes/orgTournament.routes.js` (the `POST /:tournamentId/advance-phase` route)

Currently it reads teams from `currentPhase.teams`. After refactor change this to:
```js
// Instead of:
const phaseTeamIds = currentPhase.teams?.map(t => t._id?.toString() || t.toString()) || [];

// Use Registration:
const phaseRegistrations = await Registration.find({
  tournament: tournamentId,
  phase: phaseName,
  status: { $in: ['approved', 'checked_in'] }
}).select('team').lean();
const phaseTeamIds = phaseRegistrations.map(r => r.team.toString());
```

---

## Implementation Order

```
STEP 0  → Run migration script (fixPhaseTeams6998.js)  ← do this NOW
STEP 1  → Add 2 new backend endpoints
STEP 2  → Update add/remove team routes (remove phases.$.teams writes)
STEP 3  → Update GET /:tournamentId (remove phases.teams population)
STEP 4  → Rewrite TeamGrouping.jsx
STEP 5  → Revert hotfix in teamTournament.routes.js
STEP 6  → Fix advance-phase route (reads from Registration, not phases.teams)
```

Steps 1–6 should be done in one session since they're interdependent.
Steps 1, 2, 3, 5, 6 are backend-only and safe to do first.
Step 4 is frontend and can be tested once Steps 1–3 are done.

---

## What Does NOT Change

- `Registration` model — no schema changes
- `Tournament` model — `phases[x].teams` and `phases[x].groups` arrays remain in schema (still used for group name storage), we just stop writing team ObjectIds into them
- `PhaseManager.jsx` — unchanged
- `PointsTable.jsx` — reads from `registrations` in the tournament data, unaffected
- `MatchScheduler.jsx` / `MatchManagement.jsx` — use match documents, unaffected
- `teamTournament.routes.js` registration route overall — only the hotfix `$push` is removed

---

## Testing Checklist

After all steps:
- [ ] Register a new team manually → appears in Teams tab AND Groups tab (phase-teams API)
- [ ] Groups auto-allocate → assigns groups in Registration (check via DB or API)
- [ ] Groups save → `Registration.group` updated, not `phases[x].groups.teams`
- [ ] Advance phase → reads team list from Registration correctly
- [ ] Re-fetch tournament → `phases[x].teams` is empty/unused — Groups tab still populates from API
- [ ] Remove team from phase → Registration.phase cleared, team disappears from Groups tab
