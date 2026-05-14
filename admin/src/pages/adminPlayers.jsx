import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchShadowPlayersAPI, createShadowPlayerAPI, updateShadowPlayerAPI, claimShadowPlayerAPI, searchPlayersAPI, bulkCreateShadowPlayersAPI } from '../api/adminApi';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'react-toastify';
import { Users, Plus, Search, UserCheck, Upload, Edit, ChevronDown, ChevronUp, X } from 'lucide-react';

export default function AdminPlayers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [claimedFilter, setClaimedFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [claimTarget, setClaimTarget] = useState(null);
  const [claimSearch, setClaimSearch] = useState('');
  const [editPlayer, setEditPlayer] = useState(null);

  // Form state
  const [form, setForm] = useState({ realName: '', inGameName: '', characterId: '', inGameRole: '', profilePicture: '', teamId: '' });
  const [bulkJson, setBulkJson] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shadowPlayers', page, search, claimedFilter],
    queryFn: () => fetchShadowPlayersAPI({ page, limit: 20, search: search || undefined, claimed: claimedFilter || undefined }),
  });

  const { data: searchResults } = useQuery({
    queryKey: ['searchPlayers', claimSearch],
    queryFn: () => searchPlayersAPI(claimSearch),
    enabled: claimSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: createShadowPlayerAPI,
    onSuccess: () => { toast.success('Shadow player created'); qc.invalidateQueries(['shadowPlayers']); setShowCreate(false); setForm({ realName: '', inGameName: '', characterId: '', inGameRole: '', profilePicture: '', teamId: '' }); },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateShadowPlayerAPI(id, data),
    onSuccess: () => { toast.success('Player updated'); qc.invalidateQueries(['shadowPlayers']); setEditPlayer(null); },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
  });

  const claimMutation = useMutation({
    mutationFn: ({ shadowId, realId }) => claimShadowPlayerAPI(shadowId, realId),
    onSuccess: () => { toast.success('Profile claimed successfully!'); qc.invalidateQueries(['shadowPlayers']); setClaimTarget(null); setClaimSearch(''); },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Claim failed'),
  });

  const bulkMutation = useMutation({
    mutationFn: (players) => bulkCreateShadowPlayersAPI(players),
    onSuccess: (d) => { toast.success(`Created ${d.created} players`); qc.invalidateQueries(['shadowPlayers']); setShowBulk(false); setBulkJson(''); },
    onError: (e) => toast.error(e.message || 'Bulk create failed'),
  });

  const handleCreate = (e) => { e.preventDefault(); createMutation.mutate(form); };
  const handleBulk = () => {
    try { const players = JSON.parse(bulkJson); if (!Array.isArray(players)) throw new Error('Must be array'); bulkMutation.mutate(players); }
    catch (e) { toast.error('Invalid JSON: ' + e.message); }
  };

  const players = data?.players || [];
  const pagination = data?.pagination || {};

  return (
    <AdminLayout>
      <div className="py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Users className="w-8 h-8 text-orange-500" /> Pro Players (Shadow)</h1>
            <p className="text-zinc-400 mt-1">Manage professional player profiles</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowBulk(!showBulk)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 flex items-center gap-2"><Upload className="w-4 h-4" /> Bulk Import</button>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"><Plus className="w-4 h-4" /> Create Player</button>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">Create Shadow Player</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Real Name" value={form.realName} onChange={e => setForm({ ...form, realName: e.target.value })} className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none" />
              <input placeholder="In-Game Name *" required value={form.inGameName} onChange={e => setForm({ ...form, inGameName: e.target.value })} className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none" />
              <input placeholder="Character ID *" required value={form.characterId} onChange={e => setForm({ ...form, characterId: e.target.value })} className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none" />
              <input placeholder="Role (e.g. IGL, Assaulter)" value={form.inGameRole} onChange={e => setForm({ ...form, inGameRole: e.target.value })} className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none" />
              <input placeholder="Profile Picture URL" value={form.profilePicture} onChange={e => setForm({ ...form, profilePicture: e.target.value })} className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none" />
              <input placeholder="Team ID (optional)" value={form.teamId} onChange={e => setForm({ ...form, teamId: e.target.value })} className="bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none" />
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">{createMutation.isPending ? 'Creating...' : 'Create Player'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Import */}
        {showBulk && (
          <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-2">Bulk Import (JSON)</h3>
            <p className="text-zinc-400 text-sm mb-3">Paste an array: [{"{"}"inGameName":"Name","characterId":"123"{"}"}]</p>
            <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)} rows={6} className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 font-mono text-sm" placeholder='[{"inGameName": "Player1", "characterId": "12345"}]' />
            <div className="flex gap-3 mt-3">
              <button onClick={handleBulk} disabled={bulkMutation.isPending} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">{bulkMutation.isPending ? 'Importing...' : 'Import'}</button>
              <button onClick={() => setShowBulk(false)} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700">Cancel</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-zinc-500" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, IGN, or character ID..." className="w-full pl-10 pr-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-800 focus:border-orange-500 outline-none" />
          </div>
          <select value={claimedFilter} onChange={e => { setClaimedFilter(e.target.value); setPage(1); }} className="bg-zinc-900 text-white px-4 py-2 rounded-lg border border-zinc-800">
            <option value="">All</option><option value="false">Unclaimed</option><option value="true">Claimed</option>
          </select>
        </div>

        {/* Claim Modal */}
        {claimTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-lg border border-zinc-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Claim Profile: {claimTarget.gameIds?.[0]?.inGameName}</h3>
                <button onClick={() => { setClaimTarget(null); setClaimSearch(''); }}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <p className="text-zinc-400 text-sm mb-4">Search for the real player account to transfer this shadow profile's data into:</p>
              <input value={claimSearch} onChange={e => setClaimSearch(e.target.value)} placeholder="Search by username, email, or IGN..." className="w-full px-4 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 mb-4" />
              {searchResults?.players?.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {searchResults.players.map(p => (
                    <div key={p._id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg hover:bg-zinc-750">
                      <div>
                        <p className="text-white font-medium">{p.username}</p>
                        <p className="text-zinc-400 text-sm">{p.email} · Rating: {p.aegisRating || 1000}</p>
                      </div>
                      <button onClick={() => { if (confirm(`Transfer shadow data to ${p.username}?`)) claimMutation.mutate({ shadowId: claimTarget._id, realId: p._id }); }}
                        className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50" disabled={claimMutation.isPending}>
                        {claimMutation.isPending ? '...' : 'Claim'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {claimSearch.length >= 2 && (!searchResults?.players || searchResults.players.length === 0) && (
                <p className="text-zinc-500 text-sm">No players found</p>
              )}
            </div>
          </div>
        )}

        {/* Players Table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-400">Loading...</div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No shadow players found</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Player</th>
                  <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Character ID</th>
                  <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Team</th>
                  <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Rating</th>
                  <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {players.map(p => (
                  <tr key={p._id} className="hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.profilePicture ? <img src={p.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 text-sm">{(p.gameIds?.[0]?.inGameName || '?')[0]}</div>}
                        <div>
                          <p className="text-white font-medium">{p.gameIds?.[0]?.inGameName || p.realName || 'Unknown'}</p>
                          {p.realName && <p className="text-zinc-500 text-xs">{p.realName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300 font-mono text-sm">{p.gameIds?.[0]?.characterId || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300">{p.team?.teamTag || p.team?.teamName || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300">{p.aegisRating || 1000}</td>
                    <td className="px-6 py-4">
                      {p.claimedBy ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Claimed by {p.claimedBy.username}</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Unclaimed</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {!p.claimedBy && (
                          <>
                            <button onClick={() => setClaimTarget(p)} className="px-3 py-1 text-xs bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30"><UserCheck className="w-3.5 h-3.5 inline mr-1" />Claim</button>
                            <button onClick={() => setEditPlayer(p)} className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600"><Edit className="w-3.5 h-3.5 inline mr-1" />Edit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-50 hover:bg-zinc-700">Prev</button>
            <span className="px-4 py-2 text-zinc-400">{page} / {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-50 hover:bg-zinc-700">Next</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
