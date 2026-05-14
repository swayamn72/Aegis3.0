import React, { useState, useEffect, useMemo } from 'react';
import { Users, Shuffle, Save, AlertCircle, Grid3x3, Loader2, Plus, Trash2, ArrowRightLeft, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';

// ─── TeamCard ────────────────────────────────────────────────────────────────
const TeamCard = ({ team, groupName, allGroups, onRemove, onMove, isLocked }) => {
    const [showMove, setShowMove] = useState(false);
    const otherGroups = allGroups.filter(g => g.name !== groupName);

    return (
        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all group">
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
            {/* Move / Remove only shown when group is not locked */}
            {!isLocked && (
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {otherGroups.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMove(v => !v)}
                                className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                                title="Move to group"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            {showMove && (
                                <div className="absolute right-0 top-7 z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-[130px] py-1">
                                    <p className="text-gray-500 text-xs px-3 py-1">Move to…</p>
                                    {otherGroups.map(g => (
                                        <button
                                            key={g.name}
                                            onClick={() => { onMove(groupName, team._id, g.name); setShowMove(false); }}
                                            className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-gray-700 transition-colors"
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => onRemove(groupName, team._id)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors text-lg leading-none"
                        title="Remove from group"
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── GroupCard ────────────────────────────────────────────────────────────────
const GroupCard = ({ group, phaseTeamMap, allGroups, unassignedTeams, onRemove, onMove, onAddTeam, onDeleteGroup, index, slotData, isValorant }) => {
    const [addingTeam, setAddingTeam] = useState(false);
    const groupNumber = group.name?.match(/\d+/)?.[0] || (index + 1);
    const isLocked = slotData?.isLocked || false;
    // Sort: slot 2 always last (BGMI lobby convention — 24th-team spot)
    const slotList = [...(slotData?.slotList || [])].sort((a, b) =>
        a.slot === 2 ? 1 : b.slot === 2 ? -1 : a.slot - b.slot
    );

    return (
        <div className={`bg-gray-800/50 rounded-xl border p-5 ${isLocked ? 'border-orange-500/40' : 'border-gray-700'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-orange-400 font-bold text-sm">{groupNumber}</span>
                    </div>
                    {group.name}
                    {isLocked && (
                        <span
                            className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 border border-orange-400/40 rounded-full text-orange-400 text-xs"
                            title="Locked — a match has been scheduled for this group. Delete the scheduled match to unlock."
                        >
                            <Lock className="w-3 h-3" />
                            Locked
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">{group.teams.length} teams</span>
                    {!isLocked && (
                        <button
                            onClick={() => onDeleteGroup(group.name)}
                            className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                            title="Delete group"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Slot list — shown when group has been saved with slot assignments */}
            {slotList.length > 0 ? (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 mb-3">
                    {slotList.map(entry => (
                        <div
                            key={entry.slot}
                            className="flex items-center gap-3 px-3 py-2 bg-gray-700/50 rounded-lg"
                        >
                            <span className="flex-shrink-0 w-16 text-xs font-bold text-orange-400">
                                Slot {entry.slot}
                            </span>
                            <span className="text-white text-sm truncate">
                                {entry.team?.teamName || '—'}
                            </span>
                            {entry.team?.teamTag && (
                                <span className="text-gray-500 text-xs">[{entry.team.teamTag}]</span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                /* Fallback: no slot list yet — show team list */
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {group.teams.map((teamId, idx) => {
                        const team = phaseTeamMap[teamId];
                        if (!team) return null;
                        // BGMI: teams 1-23 → slots 3-25, team 24 → slot 2. Slot numbers are irrelevant for Valorant.
                        const slotNum = idx < 23 ? idx + 3 : 2;
                        return (
                            <div
                                key={teamId}
                                className="flex items-center gap-3 px-3 py-2 bg-gray-700/50 rounded-lg"
                            >
                                {/* Only show slot numbers for BGMI (BR convention) */}
                                {!isValorant && (
                                    <span className="flex-shrink-0 w-16 text-xs font-bold text-orange-400">
                                        Slot {slotNum}
                                    </span>
                                )}
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    {team.logo ? (
                                        <img src={team.logo} alt={team.teamName} className="w-6 h-6 rounded flex-shrink-0 object-cover" />
                                    ) : null}
                                    <span className="text-white text-sm truncate">{team.teamName}</span>
                                    {team.teamTag && <span className="text-gray-500 text-xs">[{team.teamTag}]</span>}
                                </div>
                                {/* Remove button — only when unlocked */}
                                {!isLocked && (
                                    <button
                                        onClick={() => onRemove(group.name, teamId)}
                                        className="p-1 text-gray-500 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
                                        title="Remove from group"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {group.teams.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">No teams in this group</p>
                    )}
                </div>
            )}

            {/* Add team — only when not locked and there are unassigned teams */}
            {!isLocked && unassignedTeams.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                    {addingTeam ? (
                        <div className="flex gap-2">
                            <select
                                autoFocus
                                defaultValue=""
                                onChange={e => {
                                    if (e.target.value) {
                                        onAddTeam(group.name, e.target.value);
                                        setAddingTeam(false);
                                    }
                                }}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                                <option value="" disabled>Pick a team…</option>
                                {unassignedTeams.map(t => (
                                    <option key={t._id} value={t._id}>{t.teamName}{t.teamTag ? ` [${t.teamTag}]` : ''}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setAddingTeam(false)}
                                className="px-2 py-1 text-gray-400 hover:text-white text-sm"
                            >Cancel</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingTeam(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-sm text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add team
                        </button>
                    )}
                </div>
            )}

            {/* Locked hint */}
            {isLocked && (
                <p className="mt-3 pt-3 border-t border-orange-500/20 text-xs text-orange-400/70 text-center">
                    🔒 Delete the scheduled match to edit this group
                </p>
            )}
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const TeamGrouping = ({ tournament, onUpdate }) => {
    const queryClient = useQueryClient();
    const isValorant = tournament?.gameTitle === 'VALORANT';
    const [selectedPhase, setSelectedPhase] = useState('');
    const [groups, setGroups] = useState([]);
    // Valorant: default 4 teams per group (GSL/RR style); BGMI: 16 (BR lobby)
    const [teamsPerGroup, setTeamsPerGroup] = useState(isValorant ? 4 : 16);
    const [groupsPage, setGroupsPage] = useState(1);
    const GROUPS_PER_PAGE = 6;

    // ── Fetch phase teams with React Query
    const { data: phaseTeams = [], isLoading: phaseLoading } = useQuery({
        queryKey: ['phaseTeams', tournament?._id, selectedPhase],
        queryFn: async () => {
            const { data } = await axiosInstance.get(
                `/api/org-tournaments/${tournament._id}/phase-teams`,
                { params: { phase: selectedPhase, all: true } }
            );
            return data.teams || [];
        },
        enabled: !!tournament?._id && !!selectedPhase,
        staleTime: 5 * 60 * 1000,
    });

    // ── Fetch slot list (isLocked + slotList per group)
    const { data: slotListData } = useQuery({
        queryKey: ['groupSlotList', tournament?._id, selectedPhase],
        queryFn: async () => {
            const { data } = await axiosInstance.get(
                `/api/org-tournaments/${tournament._id}/group-slot-list`,
                { params: { phase: selectedPhase } }
            );
            return data.groups || [];
        },
        enabled: !!tournament?._id && !!selectedPhase,
        staleTime: 30 * 1000, // 30s — lock state can change when matches are scheduled/deleted
    });

    // Build a map: groupName -> { isLocked, slotList } for O(1) lookup in GroupCard
    const slotDataByGroup = useMemo(() => {
        const map = {};
        (slotListData || []).forEach(g => { map[g.name] = g; });
        return map;
    }, [slotListData]);

    // Whether ANY group is locked (determines if we need to show a global warning)
    const hasLockedGroups = useMemo(
        () => (slotListData || []).some(g => g.isLocked),
        [slotListData]
    );

    // ── Save groups mutation
    const { mutate: saveGroups, isPending: saving } = useMutation({
        mutationFn: async (newGroups) => {
            await axiosInstance.put(
                `/api/org-tournaments/${tournament._id}/assign-groups`,
                {
                    phase: selectedPhase,
                    groups: newGroups.map(g => ({ name: g.name, teams: g.teams }))
                }
            );
        },
        onSuccess: () => {
            toast.success('Groups saved successfully');
            queryClient.invalidateQueries(['phaseTeams', tournament?._id, selectedPhase]);
            queryClient.invalidateQueries(['groupSlotList', tournament?._id, selectedPhase]);
            if (onUpdate) onUpdate();
        },
        onError: (err) => {
            console.error('Error saving groups:', err);
            toast.error(err?.response?.data?.error || 'Failed to save groups');
        }
    });

    // ── Lookup map: teamId → team object (for O(1) render)
    const phaseTeamMap = useMemo(() =>
        Object.fromEntries(phaseTeams.map(t => [t._id.toString(), t])),
        [phaseTeams]
    );

    // ── Sync phaseTeams result to local editable groups state
    useEffect(() => {
        if (!selectedPhase) {
            setGroups([]);
            setGroupsPage(1);
            return;
        }

        const groupMap = {};
        phaseTeams.forEach(t => {
            if (t.group) {
                if (!groupMap[t.group]) groupMap[t.group] = [];
                groupMap[t.group].push(t._id.toString());
            }
        });

        const existingGroups = Object.keys(groupMap)
            .sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, '')) || 0;
                const numB = parseInt(b.replace(/^\D+/g, '')) || 0;
                return numA - numB || a.localeCompare(b);
            })
            .map(name => ({ name, teams: groupMap[name] }));

        setGroups(existingGroups);
        setGroupsPage(1);
    }, [phaseTeams, selectedPhase]);

    // ── Auto-allocate: split all phase teams into N groups of `teamsPerGroup`
    const handleAutoAllocate = () => {
        if (phaseTeams.length === 0) {
            toast.error('No teams available in this phase');
            return;
        }
        const shuffled = [...phaseTeams].sort(() => Math.random() - 0.5);
        const numGroups = Math.ceil(shuffled.length / teamsPerGroup);
        const newGroups = Array.from({ length: numGroups }, (_, i) => ({
            name: `Group ${i + 1}`,
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

    // ── Remove from group → goes back to unassigned
    const handleRemoveFromGroup = (groupName, teamId) => {
        setGroups(prev =>
            prev.map(g =>
                g.name === groupName
                    ? { ...g, teams: g.teams.filter(id => id !== teamId) }
                    : g
            )
        );
    };

    // ── Move a team from one group to another
    const handleMoveTeam = (fromGroup, teamId, toGroup) => {
        setGroups(prev =>
            prev.map(g => {
                if (g.name === fromGroup) return { ...g, teams: g.teams.filter(id => id !== teamId) };
                if (g.name === toGroup) return { ...g, teams: [...g.teams, teamId] };
                return g;
            })
        );
    };

    // ── Add an unassigned team into a specific group
    const handleAddTeamToGroup = (groupName, teamId) => {
        setGroups(prev =>
            prev.map(g =>
                g.name === groupName
                    ? { ...g, teams: [...g.teams, teamId] }
                    : g
            )
        );
    };

    // ── Add a new empty group
    const handleAddGroup = () => {
        // Find next numeric gap or next highest number
        const existingNums = groups.map(g => parseInt(g.name.replace(/^\D+/g, ''))).filter(n => !isNaN(n));
        const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
        const newName = `Group ${maxNum + 1}`;

        if (groups.find(g => g.name === newName)) {
            toast.error(`${newName} already exists`);
            return;
        }
        setGroups(prev => [...prev, { name: newName, teams: [] }]);
        toast.success(`Added ${newName}`);
    };

    // ── Delete a group (teams return to unassigned pool)
    const handleDeleteGroup = (groupName) => {
        setGroups(prev => prev.filter(g => g.name !== groupName));
        toast.info(`Removed ${groupName} — teams are now unassigned`);
    };

    // ── Save: write to Registration.group via PUT /assign-groups
    const handleSave = () => {
        if (!selectedPhase) { toast.error('Select a phase first'); return; }
        if (groups.length === 0) { toast.error('Create groups first (use Auto Allocate)'); return; }

        // Prevent saving if any group is locked
        const lockedGroup = groups.find(g => slotDataByGroup[g.name]?.isLocked);
        if (lockedGroup) {
            toast.error(`Group "${lockedGroup.name}" is locked — delete the scheduled match first`);
            return;
        }

        saveGroups(groups);
    };

    // ── Derived: teams not yet assigned to any group
    const assignedIds = new Set(groups.flatMap(g => g.teams));
    const unassignedTeams = phaseTeams.filter(t => !assignedIds.has(t._id.toString()));

    const totalGroupsPages = Math.ceil(groups.length / GROUPS_PER_PAGE);
    const paginatedGroups = groups.slice((groupsPage - 1) * GROUPS_PER_PAGE, groupsPage * GROUPS_PER_PAGE);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Team Grouping</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {isValorant
                            ? 'Organise teams into groups or brackets for playoff play'
                            : 'Organise teams into groups for round-robin matches'
                        }
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !selectedPhase || groups.length === 0 || tournament.status === 'completed'}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving…' : (tournament.status === 'completed' ? 'Groups Locked' : 'Save Groups')}
                </button>
            </div>

            {/* Locked-group global warning banner */}
            {hasLockedGroups && (
                <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-300 text-sm">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    Some groups are locked because matches are scheduled for them. Delete the scheduled match to unlock a group.
                </div>
            )}

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
                                disabled={phaseTeams.length === 0 || tournament.status === 'completed' || hasLockedGroups}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Grid3x3 className="w-4 h-4" />
                                Auto Allocate
                            </button>

                            <button
                                onClick={handleShuffle}
                                disabled={groups.length === 0 || tournament.status === 'completed' || hasLockedGroups}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Shuffle className="w-4 h-4" />
                                Shuffle
                            </button>

                            <button
                                onClick={handleAddGroup}
                                disabled={phaseTeams.length === 0 || tournament.status === 'completed' || hasLockedGroups}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Group
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
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedGroups.map((group) => (
                                    <GroupCard
                                        key={group.name}
                                        group={group}
                                        phaseTeamMap={phaseTeamMap}
                                        allGroups={groups}
                                        unassignedTeams={unassignedTeams}
                                        onRemove={handleRemoveFromGroup}
                                        onMove={handleMoveTeam}
                                        onAddTeam={handleAddTeamToGroup}
                                        onDeleteGroup={handleDeleteGroup}
                                        index={groups.findIndex(g => g.name === group.name)}
                                        slotData={slotDataByGroup[group.name]}
                                        isValorant={isValorant}
                                    />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalGroupsPages > 1 && (
                                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700">
                                    <div className="text-sm text-gray-400">
                                        Showing <span className="text-white font-medium">{(groupsPage - 1) * GROUPS_PER_PAGE + 1}</span> to{' '}
                                        <span className="text-white font-medium">
                                            {Math.min(groupsPage * GROUPS_PER_PAGE, groups.length)}
                                        </span> of{' '}
                                        <span className="text-white font-medium">{groups.length}</span> groups
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setGroupsPage(prev => Math.max(1, prev - 1))}
                                            disabled={groupsPage === 1}
                                            className="p-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setGroupsPage(prev => Math.min(totalGroupsPages, prev + 1))}
                                            disabled={groupsPage === totalGroupsPages}
                                            className="p-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : phaseTeams.length === 0 ? (
                        <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-gray-700">
                            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-white mb-2">No Teams in Phase</h3>
                            <p className="text-gray-400 max-w-sm mx-auto">
                                Teams are not assigned to <strong>{selectedPhase}</strong> yet.
                                Go to the <strong>Phases</strong> tab and click{' '}
                                <strong>Lock Registrations</strong> to assign all approved teams to this phase before grouping.
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