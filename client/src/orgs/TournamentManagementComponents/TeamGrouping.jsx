import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shuffle, Save, AlertCircle, Grid3x3, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';

// ─── TeamCard ────────────────────────────────────────────────────────────────
const TeamCard = ({ team, groupName, onRemove }) => (
    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all">
        <div className="flex items-center gap-2 flex-1 min-w-0">
            {team.logo ? (
                <img src={team.logo} alt={team.teamName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            ) : (
                <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-gray-400" />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-white text-sm truncate">{team.teamName}</p>
                {team.teamTag && <p className="text-gray-500 text-xs">[{team.teamTag}]</p>}
            </div>
        </div>
        <button
            onClick={() => onRemove(groupName, team._id)}
            className="text-gray-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0 text-lg leading-none"
            title="Remove from group"
        >
            ×
        </button>
    </div>
);

// ─── GroupCard ────────────────────────────────────────────────────────────────
const GroupCard = ({ group, phaseTeamMap, onRemove, index }) => {
    const letter = String.fromCharCode(65 + index);
    return (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-orange-400 font-bold text-sm">{letter}</span>
                    </div>
                    {group.name}
                </h3>
                <span className="text-gray-400 text-sm">{group.teams.length} teams</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {group.teams.map(teamId => {
                    const team = phaseTeamMap[teamId];
                    if (!team) return null;
                    return (
                        <TeamCard
                            key={teamId}
                            team={team}
                            groupName={group.name}
                            onRemove={onRemove}
                        />
                    );
                })}
                {group.teams.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No teams in this group</p>
                )}
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const TeamGrouping = ({ tournament, onUpdate }) => {
    const [selectedPhase, setSelectedPhase] = useState('');
    const [phaseTeams, setPhaseTeams] = useState([]);  // fetched from API
    const [groups, setGroups] = useState([]);
    const [teamsPerGroup, setTeamsPerGroup] = useState(16);
    const [phaseLoading, setPhaseLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // ── Lookup map: teamId → team object (for O(1) render)
    const phaseTeamMap = Object.fromEntries(phaseTeams.map(t => [t._id.toString(), t]));

    // ── Fetch teams for the selected phase from Registration (single source of truth)
    const fetchPhaseTeams = useCallback(async (phase) => {
        if (!phase || !tournament?._id) return;
        setPhaseLoading(true);
        try {
            const { data } = await axiosInstance.get(
                `/api/org-tournaments/${tournament._id}/phase-teams`,
                { params: { phase } }
            );
            setPhaseTeams(data.teams || []);

            // Restore existing group layout from Registration.group field
            const groupMap = {};
            (data.teams || []).forEach(t => {
                if (t.group) {
                    if (!groupMap[t.group]) groupMap[t.group] = [];
                    groupMap[t.group].push(t._id.toString());
                }
            });
            // Convert map to array sorted by group name; alphabetical
            const existingGroups = Object.keys(groupMap)
                .sort()
                .map(name => ({ name, teams: groupMap[name] }));
            setGroups(existingGroups);
        } catch (err) {
            console.error('Error fetching phase teams:', err);
            toast.error('Failed to load teams for this phase');
            setPhaseTeams([]);
            setGroups([]);
        } finally {
            setPhaseLoading(false);
        }
    }, [tournament?._id]);

    useEffect(() => {
        if (selectedPhase) fetchPhaseTeams(selectedPhase);
        else { setPhaseTeams([]); setGroups([]); }
    }, [selectedPhase, fetchPhaseTeams]);

    // ── Auto-allocate: split all phase teams into N groups of `teamsPerGroup`
    const handleAutoAllocate = () => {
        if (phaseTeams.length === 0) {
            toast.error('No teams available in this phase');
            return;
        }
        const shuffled = [...phaseTeams].sort(() => Math.random() - 0.5);
        const numGroups = Math.ceil(shuffled.length / teamsPerGroup);
        const newGroups = Array.from({ length: numGroups }, (_, i) => ({
            name: `Group ${String.fromCharCode(65 + i)}`,
            teams: shuffled
                .slice(i * teamsPerGroup, (i + 1) * teamsPerGroup)
                .map(t => t._id.toString())
        }));
        setGroups(newGroups);
        toast.success(`Created ${numGroups} group${numGroups > 1 ? 's' : ''}`);
    };

    // ── Shuffle: keep same group structure, re-randomise team assignments
    const handleShuffle = () => {
        if (groups.length === 0) { toast.error('Allocate groups first'); return; }
        const shuffled = [...phaseTeams].sort(() => Math.random() - 0.5);
        const perGroup = Math.ceil(shuffled.length / groups.length);
        const newGroups = groups.map((g, i) => ({
            ...g,
            teams: shuffled.slice(i * perGroup, (i + 1) * perGroup).map(t => t._id.toString())
        }));
        setGroups(newGroups);
        toast.success('Teams shuffled');
    };

    // ── Remove from group (local state only — persisted on Save)
    const handleRemoveFromGroup = (groupName, teamId) => {
        setGroups(prev =>
            prev.map(g =>
                g.name === groupName
                    ? { ...g, teams: g.teams.filter(id => id !== teamId) }
                    : g
            )
        );
    };

    // ── Save: write to Registration.group via PUT /assign-groups
    const handleSave = async () => {
        if (!selectedPhase) { toast.error('Select a phase first'); return; }
        if (groups.length === 0) { toast.error('Create groups first (use Auto Allocate)'); return; }

        setSaving(true);
        try {
            await axiosInstance.put(
                `/api/org-tournaments/${tournament._id}/assign-groups`,
                {
                    phase: selectedPhase,
                    groups: groups.map(g => ({ name: g.name, teams: g.teams }))
                }
            );
            toast.success('Groups saved successfully');
            if (onUpdate) onUpdate(); // re-fetch tournament metadata (group names)
        } catch (err) {
            console.error('Error saving groups:', err);
            toast.error(err?.response?.data?.error || 'Failed to save groups');
        } finally {
            setSaving(false);
        }
    };

    // ── Derived: teams not yet assigned to any group
    const assignedIds = new Set(groups.flatMap(g => g.teams));
    const unassignedTeams = phaseTeams.filter(t => !assignedIds.has(t._id.toString()));

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Team Grouping</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Organise teams into groups for round-robin matches
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !selectedPhase || groups.length === 0}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save Groups'}
                </button>
            </div>

            {/* Phase Selector */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 mb-6">
                <label className="block text-sm text-gray-400 mb-2">Select Phase</label>
                <select
                    value={selectedPhase}
                    onChange={e => { setSelectedPhase(e.target.value); }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    <option value="">Choose a phase…</option>
                    {tournament.phases?.map((phase, idx) => (
                        <option key={idx} value={phase.name}>
                            {phase.name} ({phase.teamCount ?? phase.teams?.length ?? 0} teams)
                        </option>
                    ))}
                </select>
            </div>

            {/* Loading state */}
            {phaseLoading && (
                <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Loading teams…</span>
                </div>
            )}

            {/* Phase content */}
            {selectedPhase && !phaseLoading && (
                <>
                    {/* Controls bar */}
                    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 mb-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3">
                                <label className="text-sm text-gray-400">Teams per group:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={phaseTeams.length || 1}
                                    value={teamsPerGroup}
                                    onChange={e => setTeamsPerGroup(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <button
                                onClick={handleAutoAllocate}
                                disabled={phaseTeams.length === 0}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Grid3x3 className="w-4 h-4" />
                                Auto Allocate
                            </button>

                            <button
                                onClick={handleShuffle}
                                disabled={groups.length === 0}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Shuffle className="w-4 h-4" />
                                Shuffle
                            </button>

                            <div className="ml-auto flex items-center gap-4 text-sm text-gray-400">
                                <span>{phaseTeams.length} total</span>
                                {unassignedTeams.length > 0 && (
                                    <span className="text-yellow-400">
                                        {unassignedTeams.length} unassigned
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Groups grid */}
                    {groups.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groups.map((group, idx) => (
                                <GroupCard
                                    key={group.name}
                                    group={group}
                                    phaseTeamMap={phaseTeamMap}
                                    onRemove={handleRemoveFromGroup}
                                    index={idx}
                                />
                            ))}
                        </div>
                    ) : phaseTeams.length === 0 ? (
                        <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-gray-700">
                            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-white mb-2">No Teams in Phase</h3>
                            <p className="text-gray-400">
                                Add teams to the <strong>{selectedPhase}</strong> phase first via the Teams tab.
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-gray-700">
                            <Grid3x3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-white mb-2">No Groups Yet</h3>
                            <p className="text-gray-400 mb-6">
                                {phaseTeams.length} teams ready — use Auto Allocate to create groups
                            </p>
                            <button
                                onClick={handleAutoAllocate}
                                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                            >
                                Auto Allocate Groups
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Empty state: no phase selected */}
            {!selectedPhase && !phaseLoading && (
                <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-gray-700">
                    <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Select a Phase</h3>
                    <p className="text-gray-400">Choose a phase above to manage its team groups</p>
                </div>
            )}
        </div>
    );
};

export default TeamGrouping;