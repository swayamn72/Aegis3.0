import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Trash2, UserPlus, Loader2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getTournamentRegistrationsAPI, adminRegisterTeamAPI, removeRegistrationAPI,
  searchTeamsAPI, createShadowTeamAPI
} from '../../api/adminApi';

const TeamsTab = ({ tournamentId, tournament, onRefresh }) => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTournamentRegistrationsAPI(tournamentId);
      setRegistrations(data.registrations || []);
    } catch (err) {
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { fetchRegistrations(); }, [fetchRegistrations]);

  // Debounced team search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchTeamsAPI(searchQuery);
        const regTeamIds = new Set(registrations.map(r => r.team?._id));
        setSearchResults((data.teams || []).filter(t => !regTeamIds.has(t._id)));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, registrations]);

  const handleRegisterTeam = async (teamId) => {
    setActionLoading(true);
    try {
      await adminRegisterTeamAPI(tournamentId, teamId);
      toast.success('Team registered');
      fetchRegistrations();
      onRefresh();
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register team');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveTeam = async (teamId) => {
    if (!window.confirm('Remove this team from the tournament?')) return;
    try {
      await removeRegistrationAPI(tournamentId, teamId);
      toast.success('Team removed');
      fetchRegistrations();
      onRefresh();
    } catch (err) {
      toast.error('Failed to remove team');
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setShowAddTeam(!showAddTeam); setShowCreateTeam(false); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Search className="w-4 h-4" /> Search & Add Team
        </button>
        <button onClick={() => { setShowCreateTeam(!showCreateTeam); setShowAddTeam(false); }}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700">
          <Plus className="w-4 h-4" /> Create New Team
        </button>
        <span className="text-zinc-500 text-sm ml-auto">{registrations.length} team(s) registered</span>
      </div>

      {/* Search & Add Existing Team */}
      {showAddTeam && (
        <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Search Existing Teams</h3>
            <button onClick={() => setShowAddTeam(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by team name, tag, or ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500" />
          </div>
          {searching && <div className="flex items-center gap-2 text-zinc-400 text-sm mt-3"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map(team => (
                <div key={team._id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center gap-3">
                    <img src={team.logo || 'https://placehold.co/40x40/1a1a1a/fff?text=T'} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    <div>
                      <p className="text-white text-sm font-medium">{team.teamName}</p>
                      <p className="text-zinc-500 text-xs">{team.teamTag} • {team.primaryGame} • {team.players?.length || 0} players</p>
                    </div>
                  </div>
                  <button onClick={() => handleRegisterTeam(team._id)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50">
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-zinc-500 text-sm mt-3">No matching teams found. Try creating a new team.</p>
          )}
        </div>
      )}

      {/* Create New Team */}
      {showCreateTeam && (
        <CreateTeamForm
          tournament={tournament}
          tournamentId={tournamentId}
          onCreated={() => { fetchRegistrations(); onRefresh(); setShowCreateTeam(false); }}
          onClose={() => setShowCreateTeam(false)}
        />
      )}

      {/* Registered Teams List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
      ) : registrations.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg p-12 border border-zinc-800 text-center">
          <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No teams registered yet</p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50 border-b border-zinc-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Team</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Phase</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Players</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Points</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {registrations.map(reg => (
                <tr key={reg._id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={reg.team?.logo || 'https://placehold.co/36x36/1a1a1a/fff?text=T'} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      <div>
                        <p className="text-white text-sm font-medium">{reg.team?.teamName || 'Unknown'}</p>
                        <p className="text-zinc-500 text-xs">{reg.team?.teamTag}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-300">{reg.phase || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${reg.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                      {reg.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-400">{reg.roster?.length || 0}</td>
                  <td className="px-5 py-3 text-sm text-zinc-300 font-medium">{reg.totalTournamentPoints || 0}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleRemoveTeam(reg.team?._id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Inline Create Team + Shadow Players Form
const CreateTeamForm = ({ tournament, tournamentId, onCreated, onClose }) => {
  const [form, setForm] = useState({ teamName: '', teamTag: '', logoFile: null, primaryGame: tournament?.gameTitle || 'BGMI' });
  const [players, setPlayers] = useState([
    { inGameName: '', characterId: '', inGameRole: '', realName: '', pfpFile: null },
    { inGameName: '', characterId: '', inGameRole: '', realName: '', pfpFile: null },
    { inGameName: '', characterId: '', inGameRole: '', realName: '', pfpFile: null },
    { inGameName: '', characterId: '', inGameRole: '', realName: '', pfpFile: null }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addPlayer = () => { if (players.length < 5) setPlayers([...players, { inGameName: '', characterId: '', inGameRole: '', realName: '', pfpFile: null }]); };
  const removePlayer = (i) => { if (players.length > 4) setPlayers(players.filter((_, idx) => idx !== i)); };
  const updatePlayer = (i, field, val) => { const p = [...players]; p[i][field] = val; setPlayers(p); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teamName.trim() || !form.teamTag.trim()) { toast.error('Team name and tag required'); return; }
    const validPlayers = players.filter(p => p.inGameName.trim());
    if (validPlayers.length < 1) { toast.error('At least 1 player with IGN is required'); return; }

    setSubmitting(true);
    try {
      const teamFormData = new FormData();
      teamFormData.append('teamName', form.teamName.trim());
      teamFormData.append('teamTag', form.teamTag.trim().toUpperCase());
      teamFormData.append('primaryGame', form.primaryGame);
      teamFormData.append('players', JSON.stringify(validPlayers));
      if (form.logoFile) teamFormData.append('logo', form.logoFile);
      validPlayers.forEach((p, idx) => {
        const originalIndex = players.findIndex(op => op === p);
        if (originalIndex !== -1 && players[originalIndex].pfpFile) {
          teamFormData.append('playerPfps', players[originalIndex].pfpFile, `player_${idx}`);
        }
      });

      const teamRes = await createShadowTeamAPI(teamFormData);

      // Register team to tournament
      await adminRegisterTeamAPI(tournamentId, teamRes.team._id);
      toast.success(`Team "${form.teamName}" created and registered`);
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || err.error || 'Failed to create team');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Create New Team & Players</h3>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Team Name *</label>
            <input type="text" value={form.teamName} onChange={e => setForm({ ...form, teamName: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" placeholder="e.g. Team Soul" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Team Tag *</label>
            <input type="text" value={form.teamTag} onChange={e => setForm({ ...form, teamTag: e.target.value })} maxLength={6}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 uppercase" placeholder="e.g. SOUL" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Logo</label>
            <input type="file" accept="image/*" onChange={e => setForm({ ...form, logoFile: e.target.files[0] })}
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-orange-500 file:text-white hover:file:bg-orange-600" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Game</label>
            <select value={form.primaryGame} onChange={e => setForm({ ...form, primaryGame: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="BGMI">BGMI</option>
              <option value="VALORANT">VALORANT</option>
            </select>
          </div>
        </div>

        {/* Players */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-zinc-400">Players (shadow profiles — only IGN needed, min 1, max 5)</label>
            {players.length < 5 && (
              <button type="button" onClick={addPlayer} className="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Add Player
              </button>
            )}
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700/50 relative">
                <span className="text-zinc-600 text-xs w-6">{i + 1}.</span>
                <input type="text" value={p.inGameName} onChange={e => updatePlayer(i, 'inGameName', e.target.value)}
                  className="w-full sm:w-auto flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder={`Player ${i + 1} IGN`} />
                <input type="text" value={p.characterId} onChange={e => updatePlayer(i, 'characterId', e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="Character ID (opt)" />
                <input type="text" value={p.realName} onChange={e => updatePlayer(i, 'realName', e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="Real Name (opt)" />
                <select value={p.inGameRole} onChange={e => updatePlayer(i, 'inGameRole', e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500">
                  <option value="">Role (opt)</option>
                  <option value="IGL">IGL</option>
                  <option value="Fragger">Fragger</option>
                  <option value="Support">Support</option>
                  <option value="Assaulter">Assaulter</option>
                  <option value="Sniper">Sniper</option>
                  <option value="Flex">Flex</option>
                  <option value="Coach">Coach</option>
                  <option value="Analyst">Analyst</option>
                </select>
                <input type="file" accept="image/*" onChange={e => updatePlayer(i, 'pfpFile', e.target.files[0])}
                  className="w-full sm:w-auto text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-zinc-700 file:text-white hover:file:bg-zinc-600" title="Player Avatar" />
                {players.length > 4 && (
                  <button type="button" onClick={() => removePlayer(i)} className="text-red-400 hover:text-red-300 p-1"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={submitting}
          className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create & Register</>}
        </button>
      </form>
    </div>
  );
};

export default TeamsTab;
