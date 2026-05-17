import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Loader2, Swords, ExternalLink, Calendar, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  getTournamentMatchesAPI, createMatchAPI,
  getPhaseTeamsAPI
} from '../../api/adminApi';
import { BGMI_MAPS, VALORANT_MAPS } from '../../constants/gameConstants';

const MatchesTab = ({ tournamentId, tournament, onRefresh }) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState('');

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTournamentMatchesAPI(tournamentId);
      setMatches(data.matches || []);
    } catch (err) {
      toast.error('Failed to load matches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const filtered = phaseFilter ? matches.filter(m => m.tournamentPhase === phaseFilter) : matches;
  const phases = tournament?.phases || [];

  const statusBadge = (s) => {
    const colors = {
      scheduled: 'bg-blue-500/20 text-blue-400',
      in_progress: 'bg-red-500/20 text-red-400',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-zinc-700 text-zinc-400',
    };
    return colors[s] || 'bg-zinc-700 text-zinc-400';
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Match
        </button>
        <select
          value={phaseFilter}
          onChange={e => setPhaseFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
        >
          <option value="">All Phases</option>
          {phases.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
        </select>
        <span className="text-zinc-500 text-sm ml-auto">{filtered.length} match(es)</span>
      </div>

      {/* Create Match Form */}
      {showCreate && (
        <CreateMatchForm
          tournamentId={tournamentId}
          tournament={tournament}
          onCreated={() => { fetchMatches(); onRefresh(); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Matches List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg p-12 border border-zinc-800 text-center">
          <Swords className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No matches found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.sort((a, b) => a.matchNumber - b.matchNumber).map(match => (
            <div key={match._id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-orange-400 font-bold text-sm">
                    #{match.matchNumber}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      Match {match.matchNumber} — {match.map}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                      <span>{match.tournamentPhase}</span>
                      {match.participatingGroups?.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-orange-400/70">{match.participatingGroups.join(', ')}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(match.scheduledStartTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span>{match.results?.length || 0} teams</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded ${statusBadge(match.status)}`}>
                    {match.status?.replace(/_/g, ' ')}
                  </span>
                  {match.status !== 'completed' && (
                    <button
                      onClick={() => navigate('/admin/live-scoring')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors border border-zinc-700"
                    >
                      <ExternalLink className="w-3 h-3" /> Live Score
                    </button>
                  )}
                </div>
              </div>
              {match.status === 'completed' && match.results?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-2">
                  {match.results.slice(0, 5).sort((a, b) => (a.finalPosition || 99) - (b.finalPosition || 99)).map((r, i) => (
                    <span key={i} className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                      #{r.finalPosition || '?'} {r.team?.teamTag || r.team?.teamName || 'Team'} — {r.points?.totalPoints || 0}pts
                    </span>
                  ))}
                  {match.results.length > 5 && <span className="text-xs text-zinc-600">+{match.results.length - 5} more</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Create Match Form (group-based) ────────────────────────────────────────
const CreateMatchForm = ({ tournamentId, tournament, onCreated, onClose }) => {
  const [form, setForm] = useState({
    phase: tournament?.phases?.[0]?.name || '',
    map: '',
    scheduledStartTime: '',
    matchNumber: 1,
  });
  const [phaseTeams, setPhaseTeams] = useState([]);   // all teams in selected phase
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]); // group names selected
  const [submitting, setSubmitting] = useState(false);

  const isValorant = tournament?.gameTitle === 'VALORANT';
  const maps = isValorant ? VALORANT_MAPS : BGMI_MAPS;

  // Get groups defined in selected phase
  const currentPhaseObj = (tournament?.phases || []).find(p => p.name === form.phase);
  const definedGroups = currentPhaseObj?.groups || [];

  // Load all teams in phase when phase changes
  useEffect(() => {
    if (!form.phase) return;
    setSelectedGroups([]);
    setPhaseTeams([]);
    (async () => {
      setLoadingTeams(true);
      try {
        const data = await getPhaseTeamsAPI(tournamentId, form.phase);
        setPhaseTeams(data.teams || []);
      } catch { /* ignore */ }
      finally { setLoadingTeams(false); }
    })();
  }, [form.phase, tournamentId]);

  const toggleGroup = (groupName) => {
    setSelectedGroups(prev =>
      prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName]
    );
  };

  // Derive the teamIds from selected groups
  const teamsInSelectedGroups = phaseTeams.filter(t =>
    selectedGroups.length === 0
      ? false
      : selectedGroups.includes(t.group)
  );

  const hasGroups = definedGroups.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phase || !form.map || !form.scheduledStartTime) {
      toast.error('Phase, map and scheduled time are required');
      return;
    }

    let teamIds = [];

    if (hasGroups) {
      if (selectedGroups.length === 0) {
        toast.error('Select at least one group');
        return;
      }
      teamIds = teamsInSelectedGroups.map(t => t._id);
      if (teamIds.length === 0) {
        toast.error('Selected groups have no teams assigned. Assign teams to groups first.');
        return;
      }
    } else {
      // No groups defined — fall back to all teams in the phase
      teamIds = phaseTeams.map(t => t._id);
      if (teamIds.length === 0) {
        toast.error('No teams in this phase. Add teams to the phase first.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createMatchAPI(tournamentId, {
        tournamentPhase: form.phase,
        map: form.map,
        scheduledStartTime: form.scheduledStartTime,
        matchNumber: parseInt(form.matchNumber) || 1,
        participatingGroups: selectedGroups,
        teamIds,
        gameTitle: tournament?.gameTitle || 'BGMI',
      });
      toast.success('Match created');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create match');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Create Match</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Phase *</label>
            <select
              value={form.phase}
              onChange={e => { setForm({ ...form, phase: e.target.value }); setSelectedGroups([]); }}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            >
              {(tournament?.phases || []).map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Map *</label>
            <select
              value={form.map}
              onChange={e => setForm({ ...form, map: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="">Select map</option>
              {maps.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Match # *</label>
            <input
              type="number" min="1" value={form.matchNumber}
              onChange={e => setForm({ ...form, matchNumber: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Scheduled Time *</label>
            <input
              type="datetime-local" value={form.scheduledStartTime}
              onChange={e => setForm({ ...form, scheduledStartTime: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Group / Team Selection */}
        <div>
          {loadingTeams ? (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading teams...
            </div>
          ) : !hasGroups ? (
            /* No groups defined — info banner with fallback */
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
              <p className="text-yellow-400 text-sm font-medium">⚠ No groups defined for this phase</p>
              <p className="text-zinc-400 text-xs">
                Go to the <span className="text-white font-medium">Phases</span> tab, expand this phase,
                and use <span className="text-white font-medium">Manage Groups</span> to create groups and assign teams.
                The match will include all {phaseTeams.length} phase teams as a fallback.
              </p>
              {phaseTeams.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {phaseTeams.map(t => (
                    <span key={t._id} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">
                      {t.teamTag || t.teamName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Groups available — pick which groups play in this match */
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-zinc-400">
                  Select Groups ({selectedGroups.length} selected
                  {selectedGroups.length > 0 && ` — ${teamsInSelectedGroups.length} teams`})
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedGroups(definedGroups.map(g => g.name))}
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  Select All
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {definedGroups.map((group, gi) => {
                  const teamsInGroup = phaseTeams.filter(t => t.group === group.name);
                  const selected = selectedGroups.includes(group.name);
                  return (
                    <button
                      key={gi}
                      type="button"
                      onClick={() => toggleGroup(group.name)}
                      className={`flex flex-col items-start p-3 rounded-lg text-left transition-colors border ${
                        selected
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <span className="text-sm font-medium">{group.name}</span>
                      <span className="text-xs mt-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {teamsInGroup.length} teams
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedGroups.length > 0 && teamsInSelectedGroups.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {teamsInSelectedGroups.map(t => (
                    <span key={t._id} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">
                      {t.teamTag || t.teamName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            : <><Plus className="w-4 h-4" /> Create Match</>
          }
        </button>
      </form>
    </div>
  );
};

export default MatchesTab;
