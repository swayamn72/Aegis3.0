import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTournamentsAPI } from '../api/adminApi';
import { createFantasyContestAPI, fetchFantasyContestsAdminAPI, updateContestStatusAPI, setPlayerPoolAPI, triggerFantasyScoringAPI } from '../api/adminApi';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'react-toastify';
import { Gamepad2, Plus, Play, Square, Trophy, Users, X } from 'lucide-react';

const STATUS_COLORS = { draft: 'bg-zinc-600', upcoming: 'bg-blue-500', live: 'bg-red-500', scoring: 'bg-yellow-500', completed: 'bg-green-500', cancelled: 'bg-zinc-500' };

export default function AdminFantasy() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContest, setSelectedContest] = useState(null);
  const [poolJson, setPoolJson] = useState('');
  const [form, setForm] = useState({
    tournament: '', phase: '', name: '', description: '', lockTime: '', squadSize: 4,
    maxFromSameTeam: 2, budgetCap: 100, maxSquads: 1000, matches: '',
  });

  const { data: contests, isLoading } = useQuery({ queryKey: ['adminFantasy'], queryFn: () => fetchFantasyContestsAdminAPI() });
  const { data: tournaments } = useQuery({ queryKey: ['tournamentsForFantasy'], queryFn: () => fetchTournamentsAPI({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: createFantasyContestAPI,
    onSuccess: () => { toast.success('Contest created!'); qc.invalidateQueries(['adminFantasy']); setShowCreate(false); },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateContestStatusAPI(id, status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries(['adminFantasy']); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const poolMutation = useMutation({
    mutationFn: ({ id, players }) => setPlayerPoolAPI(id, players),
    onSuccess: () => { toast.success('Player pool updated'); setPoolJson(''); setSelectedContest(null); },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  const scoreMutation = useMutation({
    mutationFn: (id) => triggerFantasyScoringAPI(id),
    onSuccess: (d) => { toast.success(`Scoring complete! ${d.scoredSquads || d.totalScored} squads scored`); qc.invalidateQueries(['adminFantasy']); },
    onError: (e) => toast.error(e.message || 'Scoring failed'),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    const matchesArr = form.matches ? form.matches.split(',').map(s => s.trim()).filter(Boolean) : [];
    createMutation.mutate({ ...form, matches: matchesArr });
  };

  const handleSetPool = () => {
    try {
      const players = JSON.parse(poolJson);
      if (!Array.isArray(players)) throw new Error('Must be array');
      poolMutation.mutate({ id: selectedContest._id, players });
    } catch (e) { toast.error('Invalid JSON: ' + e.message); }
  };

  const inputCls = "w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none";

  return (
    <AdminLayout>
      <div className="py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Gamepad2 className="w-8 h-8 text-purple-500" /> Fantasy Management</h1>
            <p className="text-zinc-400 mt-1">Create and manage fantasy contests</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Create Contest</button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">Create Fantasy Contest</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Tournament</label>
                <select value={form.tournament} onChange={e => setForm({ ...form, tournament: e.target.value })} className={inputCls} required>
                  <option value="">Select tournament</option>
                  {(tournaments?.tournaments || []).map(t => <option key={t._id} value={t._id}>{t.tournamentName}</option>)}
                </select>
              </div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Phase</label><input value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} className={inputCls} placeholder="e.g. Grand Finals" required /></div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Contest Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Lock Time</label><input type="datetime-local" value={form.lockTime} onChange={e => setForm({ ...form, lockTime: e.target.value })} className={inputCls} required /></div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Squad Size</label><input type="number" value={form.squadSize} onChange={e => setForm({ ...form, squadSize: +e.target.value })} className={inputCls} /></div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Budget Cap</label><input type="number" value={form.budgetCap} onChange={e => setForm({ ...form, budgetCap: +e.target.value })} className={inputCls} /></div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Max From Same Team</label><input type="number" value={form.maxFromSameTeam} onChange={e => setForm({ ...form, maxFromSameTeam: +e.target.value })} className={inputCls} /></div>
              <div><label className="text-sm text-zinc-400 mb-1 block">Match IDs (comma separated)</label><input value={form.matches} onChange={e => setForm({ ...form, matches: e.target.value })} className={inputCls} placeholder="id1, id2, id3" /></div>
              <div className="md:col-span-2"><label className="text-sm text-zinc-400 mb-1 block">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} /></div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">{createMutation.isPending ? 'Creating...' : 'Create Contest'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Player Pool Modal */}
        {selectedContest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-2xl border border-zinc-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Set Player Pool: {selectedContest.name}</h3>
                <button onClick={() => setSelectedContest(null)}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <p className="text-zinc-400 text-sm mb-3">JSON array: [{"{"}"player":"id","team":"id","displayName":"Name","teamTag":"TAG","cost":10{"}"}]</p>
              <textarea value={poolJson} onChange={e => setPoolJson(e.target.value)} rows={8} className={`${inputCls} font-mono text-sm`} placeholder='[{"player": "playerId", "team": "teamId", "displayName": "PlayerName", "teamTag": "TAG", "cost": 10}]' />
              <div className="flex gap-3 mt-4">
                <button onClick={handleSetPool} disabled={poolMutation.isPending} className="px-6 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50">{poolMutation.isPending ? 'Setting...' : 'Set Pool'}</button>
                <button onClick={() => setSelectedContest(null)} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Contests List */}
        <div className="space-y-4">
          {isLoading && <div className="text-zinc-400 text-center py-8">Loading contests...</div>}
          {!isLoading && (!contests?.contests || contests.contests.length === 0) && <div className="bg-zinc-900 rounded-xl p-8 text-center text-zinc-400 border border-zinc-800">No contests yet. Create your first one!</div>}
          {(contests?.contests || []).map(c => (
            <div key={c._id} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-bold text-lg">{c.name}</h3>
                    <span className={`px-2 py-0.5 text-xs text-white rounded-full ${STATUS_COLORS[c.status] || 'bg-zinc-600'}`}>{c.status}</span>
                  </div>
                  <p className="text-zinc-400 text-sm">{c.tournament?.tournamentName || 'Unknown'} · {c.phase} · {c.currentSquads || 0} squads · Budget: {c.budgetCap}</p>
                  <p className="text-zinc-500 text-xs mt-1">Lock: {c.lockTime ? new Date(c.lockTime).toLocaleString() : '-'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedContest(c)} className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700"><Users className="w-3.5 h-3.5 inline mr-1" />Pool</button>
                  {c.status === 'draft' && <button onClick={() => statusMutation.mutate({ id: c._id, status: 'upcoming' })} className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30">Publish</button>}
                  {c.status === 'upcoming' && <button onClick={() => statusMutation.mutate({ id: c._id, status: 'live' })} className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"><Play className="w-3.5 h-3.5 inline mr-1" />Go Live</button>}
                  {(c.status === 'live' || c.status === 'scoring') && <button onClick={() => scoreMutation.mutate(c._id)} disabled={scoreMutation.isPending} className="px-3 py-1.5 text-xs bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30"><Trophy className="w-3.5 h-3.5 inline mr-1" />Score</button>}
                  {c.status === 'scoring' && <button onClick={() => statusMutation.mutate({ id: c._id, status: 'completed' })} className="px-3 py-1.5 text-xs bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30">Complete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
