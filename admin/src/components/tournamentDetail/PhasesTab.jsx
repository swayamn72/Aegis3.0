import React, { useState, useCallback } from 'react';
import {
  Layers, Play, CheckCircle, Loader2, ChevronDown, ChevronUp,
  Trophy, Users, Target, Plus, X, Save, Settings2, ArrowRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import { advancePhaseAPI, getPhaseTeamsAPI, assignGroupsAPI } from '../../api/adminApi';

// ─── Group Manager (inline within expanded phase) ────────────────────────────
const GroupManager = ({ tournamentId, phase, onSaved }) => {
  const [teams, setTeams] = useState(null);      // null = not loaded yet
  const [groups, setGroups] = useState([]);       // [{ name, teams: [id,...] }]
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(false);

  const loadTeams = useCallback(async () => {
    if (teams !== null) return; // already loaded
    setLoading(true);
    try {
      const data = await getPhaseTeamsAPI(tournamentId, phase.name);
      const phaseTeams = data.teams || [];
      setTeams(phaseTeams);

      // Re-hydrate groups from existing data
      const groupMap = {};
      phaseTeams.forEach(t => {
        const g = t.group || '__unassigned__';
        if (!groupMap[g]) groupMap[g] = [];
        groupMap[g].push(t._id.toString());
      });

      // Build groups array from phase.groups metadata (preserves order)
      const existingGroups = (phase.groups || []).map(g => ({
        name: g.name,
        teams: groupMap[g.name] || []
      }));

      // Add any group that appears in registrations but not in phase.groups
      Object.keys(groupMap).forEach(gName => {
        if (gName !== '__unassigned__' && !existingGroups.find(g => g.name === gName)) {
          existingGroups.push({ name: gName, teams: groupMap[gName] });
        }
      });

      setGroups(existingGroups);
    } catch {
      toast.error('Failed to load phase teams');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, phase, teams]);

  const handleOpen = () => {
    setOpened(true);
    loadTeams();
  };

  const unassignedTeams = teams
    ? teams.filter(t => !groups.some(g => g.teams.includes(t._id.toString())))
    : [];

  const addGroup = () => {
    let name = newGroupName.trim();
    if (!name) {
      // Auto-generate name if empty
      const nextLetter = String.fromCharCode(65 + groups.length);
      name = `Group ${nextLetter}`;
    }
    if (groups.find(g => g.name === name)) { toast.warn('Group name already exists'); return; }
    setGroups(prev => [...prev, { name, teams: [] }]);
    setNewGroupName('');
  };

  const autoAssign = () => {
    if (!teams || teams.length === 0) {
      toast.warn('No teams available');
      return;
    }
    const MAX_PER_GROUP = 16; // Adjust based on common needs
    const numGroups = Math.ceil(teams.length / MAX_PER_GROUP);
    const newGroups = Array.from({ length: numGroups }, (_, i) => ({
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: []
    }));

    // Randomize slightly or just distribute sequentially
    teams.forEach((t, idx) => {
      newGroups[idx % numGroups].teams.push(t._id.toString());
    });

    setGroups(newGroups);
    toast.success(`Auto-assigned into ${numGroups} groups`);
  };

  const removeGroup = (idx) => {
    setGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const moveTeamToGroup = (teamId, targetGroupName) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      teams: g.name === targetGroupName
        ? [...new Set([...g.teams, teamId])]
        : g.teams.filter(id => id !== teamId)
    })));
  };

  const removeTeamFromGroup = (teamId, groupName) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      teams: g.name === groupName ? g.teams.filter(id => id !== teamId) : g.teams
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await assignGroupsAPI(tournamentId, phase.name, groups);
      toast.success('Groups saved successfully');
      // Re-load to sync
      setTeams(null);
      setOpened(false);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save groups');
    } finally {
      setSaving(false);
    }
  };

  if (!opened) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" /> Manage Groups
      </button>
    );
  }

  const teamById = (id) => teams?.find(t => t._id.toString() === id);

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-900/50 mt-3">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
        <span className="text-sm font-medium text-white flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-orange-400" /> Group Manager — {phase.name}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Groups
          </button>
          <button onClick={() => setOpened(false)} className="text-zinc-500 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-zinc-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading teams...
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Add new group */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGroup()}
              placeholder="New group name (e.g. Group A)"
              className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={addGroup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Add Group
            </button>
            <button
              onClick={autoAssign}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" /> Auto Assign
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Unassigned pool */}
            <div className="bg-zinc-800/60 rounded-xl border border-zinc-700 p-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">
                Unassigned ({unassignedTeams.length})
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {unassignedTeams.length === 0 && (
                  <p className="text-xs text-zinc-600 italic">All teams assigned</p>
                )}
                {unassignedTeams.map(team => (
                  <div key={team._id} className="flex items-center justify-between bg-zinc-900 rounded-lg p-2 border border-zinc-700/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={team.logo || 'https://placehold.co/24x24/1a1a1a/fff?text=T'}
                        alt="" className="w-6 h-6 rounded object-cover flex-shrink-0"
                      />
                      <span className="text-xs text-zinc-300 truncate">{team.teamTag || team.teamName}</span>
                    </div>
                    {groups.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) moveTeamToGroup(team._id.toString(), e.target.value); }}
                        className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-400 focus:outline-none focus:border-orange-500 ml-1"
                      >
                        <option value="" disabled>→ Group</option>
                        {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Group columns */}
            {groups.length === 0 ? (
              <div className="lg:col-span-2 flex items-center justify-center py-8 text-zinc-600 text-sm">
                Add a group above to start assigning teams
              </div>
            ) : (
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groups.map((group, gi) => (
                  <div key={group.name} className="bg-zinc-800/60 rounded-xl border border-zinc-700 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-orange-400 uppercase">
                        {group.name} ({group.teams.length})
                      </p>
                      <button
                        onClick={() => removeGroup(gi)}
                        className="text-red-500 hover:text-red-400 p-0.5"
                        title="Delete group (teams return to unassigned)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {group.teams.length === 0 && (
                        <p className="text-xs text-zinc-600 italic">No teams yet</p>
                      )}
                      {group.teams.map(tid => {
                        const team = teamById(tid);
                        if (!team) return null;
                        return (
                          <div key={tid} className="flex items-center justify-between bg-zinc-900 rounded-lg p-2 border border-zinc-700/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={team.logo || 'https://placehold.co/24x24/1a1a1a/fff?text=T'}
                                alt="" className="w-5 h-5 rounded object-cover flex-shrink-0"
                              />
                              <span className="text-xs text-zinc-300 truncate">{team.teamTag || team.teamName}</span>
                            </div>
                            <button
                              onClick={() => removeTeamFromGroup(tid, group.name)}
                              className="text-zinc-600 hover:text-red-400 p-0.5 flex-shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {teams && teams.length > 0 && (
            <p className="text-xs text-zinc-600">
              {teams.length - unassignedTeams.length}/{teams.length} teams assigned to groups
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main PhasesTab ───────────────────────────────────────────────────────────
const PhasesTab = ({ tournamentId, tournament, onRefresh }) => {
  const [advancingPhase, setAdvancingPhase] = useState(null);
  const [advanceResult, setAdvanceResult] = useState(null);
  const [expandedPhase, setExpandedPhase] = useState(null);

  const phases = tournament?.phases || [];

  const handleAdvance = async (phaseName) => {
    if (!window.confirm(
      `Advance phase "${phaseName}"?\n\nThis will:\n• Mark all matches as completed\n• Calculate standings\n• Advance qualified teams to next phase`
    )) return;

    setAdvancingPhase(phaseName);
    setAdvanceResult(null);
    try {
      const result = await advancePhaseAPI(tournamentId, phaseName);
      toast.success(result.message || 'Phase advanced');
      setAdvanceResult(result);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || err.error || 'Failed to advance phase');
    } finally {
      setAdvancingPhase(null);
    }
  };

  const getPhaseIcon = (type) => {
    switch (type) {
      case 'qualifiers': return <Target className="w-5 h-5" />;
      case 'group_stage': return <Users className="w-5 h-5" />;
      case 'final_stage': return <Trophy className="w-5 h-5" />;
      default: return <Layers className="w-5 h-5" />;
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-zinc-700/50 text-zinc-400 border-zinc-600';
    }
  };

  const canAdvance = (phase, index) => {
    if (phase.status === 'completed') return false;
    if (tournament.status === 'completed') return false;
    for (let i = 0; i < index; i++) {
      if (phases[i].status !== 'completed') return false;
    }
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <p className="text-zinc-400 text-sm">
          <span className="text-orange-400 font-medium">Workflow: </span>
          Assign teams to phases → Create groups within each phase → Schedule matches per group → Advance phase when done.
        </p>
      </div>

      {/* Phases List */}
      {phases.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg p-12 border border-zinc-800 text-center">
          <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No phases configured. Edit the tournament to add phases.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const isExpanded = expandedPhase === index;
            const advanceable = canAdvance(phase, index);

            return (
              <div key={index} className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                {/* Phase Header */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedPhase(isExpanded ? null : index)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      phase.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      phase.status === 'in_progress' ? 'bg-red-500/20 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {getPhaseIcon(phase.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-white font-medium">{phase.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusStyle(phase.status)}`}>
                          {phase.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {phase.type?.replace(/_/g, ' ')} • {phase.teams?.length || 0} teams •{' '}
                        {phase.matches?.length || 0} matches •{' '}
                        {phase.groups?.length || 0} group(s)
                        {phase.qualificationRules?.length > 0 && ` • ${phase.qualificationRules.length} advancement rule(s)`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {advanceable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAdvance(phase.name); }}
                        disabled={advancingPhase === phase.name}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {advancingPhase === phase.name
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Advancing...</>
                          : <><Play className="w-4 h-4" /> Advance Phase</>
                        }
                      </button>
                    )}
                    {phase.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                  </div>
                </div>

                {/* Expanded Phase Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-zinc-800 pt-4 space-y-4">
                    {phase.details && <p className="text-zinc-400 text-sm">{phase.details}</p>}

                    {/* Qualification Rules */}
                    {phase.qualificationRules?.length > 0 && (
                      <div>
                        <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Advancement Rules</h4>
                        <div className="space-y-2">
                          {phase.qualificationRules.map((rule, ri) => (
                            <div key={ri} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 text-sm flex items-center gap-2">
                              <ArrowRight className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                              <span className="text-zinc-300">
                                Top <span className="text-orange-400 font-medium">{rule.numberOfTeams}</span> teams from{' '}
                                <span className="text-white font-medium">{rule.source === 'overall' ? 'overall standings' : 'each group'}</span>
                                {' '}advance to{' '}
                                <span className="text-orange-400 font-medium">{rule.nextPhase || 'next phase'}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Teams in phase */}
                    {phase.teams?.length > 0 && (
                      <div>
                        <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Teams ({phase.teams.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {phase.teams.map((team, ti) => (
                            <span key={ti} className="px-2.5 py-1 bg-zinc-800 rounded text-xs text-zinc-300 border border-zinc-700">
                              {typeof team === 'object' ? (team.teamTag || team.teamName) : `Team ${ti + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Groups summary */}
                    {phase.groups?.length > 0 && (
                      <div>
                        <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Current Groups</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {phase.groups.map((group, gi) => (
                            <div key={gi} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                              <p className="text-white text-sm font-medium mb-0.5">{group.name}</p>
                              <p className="text-xs text-zinc-500">
                                {group.slotList?.length || 0} teams
                                {group.isLocked && ' • 🔒 locked'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Group Manager */}
                    <GroupManager
                      tournamentId={tournamentId}
                      phase={phase}
                      onSaved={onRefresh}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Advancement Result */}
      {advanceResult && (
        <div className="bg-zinc-900 rounded-lg p-5 border border-green-500/30">
          <h3 className="text-green-400 font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Phase Advanced Successfully
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Teams Advanced</p>
              <p className="text-white font-semibold text-lg">{advanceResult.advancement?.teamsAdvanced || 0}</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Tournament Status</p>
              <p className="text-white font-semibold">{advanceResult.tournamentStatus?.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {advanceResult.standings?.length > 0 && (
            <div>
              <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Final Standings</h4>
              <div className="bg-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-zinc-400">#</th>
                      <th className="px-4 py-2 text-left text-xs text-zinc-400">Team</th>
                      <th className="px-4 py-2 text-right text-xs text-zinc-400">Points</th>
                      <th className="px-4 py-2 text-right text-xs text-zinc-400">Kills</th>
                      <th className="px-4 py-2 text-right text-xs text-zinc-400">🍗</th>
                      <th className="px-4 py-2 text-right text-xs text-zinc-400">Matches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {advanceResult.standings.map((s, i) => (
                      <tr key={i} className={i < 3 ? 'bg-orange-500/5' : ''}>
                        <td className="px-4 py-2 text-zinc-300 font-medium">{s.position}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <img src={s.team?.logo || 'https://placehold.co/24x24/1a1a1a/fff?text=T'} alt="" className="w-6 h-6 rounded object-cover" />
                            <span className="text-white">{s.team?.teamTag || s.team?.teamName || 'Team'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-orange-400 font-medium">{s.points}</td>
                        <td className="px-4 py-2 text-right text-zinc-300">{s.kills}</td>
                        <td className="px-4 py-2 text-right text-zinc-300">{s.chickenDinners}</td>
                        <td className="px-4 py-2 text-right text-zinc-400">{s.matchesPlayed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhasesTab;
