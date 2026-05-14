import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContestDetails, getMySquad, createSquad, updateSquad } from '../api/fantasy';
import { useParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { toast } from 'react-toastify';

export default function FantasySquadBuilder() {
  const { contestId } = useParams();
  const qc = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState({ team: '', role: '', search: '' });

  const { data, isLoading } = useQuery({ queryKey: ['contestDetail', contestId], queryFn: () => getContestDetails(contestId) });
  const { data: mySquadData } = useQuery({ queryKey: ['mySquad', contestId], queryFn: () => getMySquad(contestId), retry: false, onError: () => {} });

  const contest = data?.contest;
  const pool = data?.playerPool || [];
  const existingSquad = mySquadData?.squad;
  const isLocked = contest && new Date() >= new Date(contest.lockTime);

  // Init selected from existing squad
  useState(() => {
    if (existingSquad?.players) {
      setSelected(existingSquad.players.map(p => ({
        poolEntry: pool.find(pp => pp.player?._id === (p.player?._id || p.player)),
        role: p.role, ...p,
      })));
    }
  }, [existingSquad]);

  const createMutation = useMutation({
    mutationFn: (d) => existingSquad ? updateSquad(contestId, d) : createSquad(contestId, d),
    onSuccess: () => { toast.success(existingSquad ? 'Squad updated!' : 'Squad created!'); qc.invalidateQueries(['mySquad', contestId]); },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
  });

  const budgetUsed = selected.reduce((sum, s) => sum + (s.cost || 0), 0);
  const budgetLeft = (contest?.budgetCap || 100) - budgetUsed;

  const teamCounts = useMemo(() => {
    const counts = {};
    selected.forEach(s => { const tid = (s.team?._id || s.team || '').toString(); counts[tid] = (counts[tid] || 0) + 1; });
    return counts;
  }, [selected]);

  const filteredPool = useMemo(() => {
    return pool.filter(p => {
      if (filter.team && (p.team?._id || p.team) !== filter.team) return false;
      if (filter.role && p.inGameRole !== filter.role) return false;
      if (filter.search && !p.displayName?.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [pool, filter]);

  const teams = useMemo(() => [...new Set(pool.map(p => JSON.stringify({ id: p.team?._id || p.team, tag: p.teamTag })))].map(s => JSON.parse(s)), [pool]);

  const togglePlayer = (poolEntry) => {
    const idx = selected.findIndex(s => (s.player?._id || s.player) === (poolEntry.player?._id || poolEntry.player));
    if (idx >= 0) {
      setSelected(s => s.filter((_, i) => i !== idx));
    } else {
      if (selected.length >= (contest?.squadSize || 4)) return toast.warning('Squad is full');
      if (budgetLeft < poolEntry.cost) return toast.warning('Not enough budget');
      const tid = (poolEntry.team?._id || poolEntry.team || '').toString();
      if ((teamCounts[tid] || 0) >= (contest?.maxFromSameTeam || 2)) return toast.warning(`Max ${contest?.maxFromSameTeam} from same team`);
      setSelected(s => [...s, { player: poolEntry.player?._id || poolEntry.player, team: poolEntry.team?._id || poolEntry.team, cost: poolEntry.cost, role: 'player', poolEntry }]);
    }
  };

  const setRole = (idx, role) => {
    setSelected(s => s.map((item, i) => {
      if (i === idx) return { ...item, role };
      if (role === 'captain' && item.role === 'captain') return { ...item, role: 'player' };
      if (role === 'vice_captain' && item.role === 'vice_captain') return { ...item, role: 'player' };
      return item;
    }));
  };

  const handleSubmit = () => {
    const captains = selected.filter(s => s.role === 'captain');
    const vcs = selected.filter(s => s.role === 'vice_captain');
    if (captains.length !== 1) return toast.error('Select exactly 1 Captain');
    if (vcs.length !== 1) return toast.error('Select exactly 1 Vice-Captain');
    createMutation.mutate({ players: selected.map(s => ({ player: s.player?._id || s.player, role: s.role })) });
  };

  const isSelected = (playerId) => selected.some(s => (s.player?._id || s.player) === playerId);

  if (isLoading) return <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center text-zinc-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a1a] px-4 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/fantasy" className="text-purple-400 text-sm hover:text-purple-300 mb-1 inline-block">← Back to Contests</Link>
          <h1 className="text-2xl font-bold text-white">{contest?.name}</h1>
          <p className="text-zinc-400 text-sm">{contest?.tournament?.tournamentName} · {contest?.phase}</p>
        </div>
        <Link to={`/fantasy/${contestId}/leaderboard`} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-sm">🏆 Leaderboard</Link>
      </div>

      {/* Budget Bar */}
      <div className="bg-zinc-900 rounded-xl p-4 mb-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-400 text-sm">Budget: <span className="text-white font-bold">{budgetLeft}</span> / {contest?.budgetCap}</span>
          <span className="text-zinc-400 text-sm">Players: <span className="text-white font-bold">{selected.length}</span> / {contest?.squadSize}</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${(budgetUsed / (contest?.budgetCap || 100)) * 100}%` }} />
        </div>
      </div>

      {/* Selected Squad */}
      {selected.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Your Squad</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {selected.map((s, i) => {
              const pe = s.poolEntry || pool.find(p => (p.player?._id || p.player) === (s.player?._id || s.player));
              return (
                <div key={i} className={`rounded-xl p-3 border text-center relative ${s.role === 'captain' ? 'bg-yellow-500/10 border-yellow-500/40' : s.role === 'vice_captain' ? 'bg-blue-500/10 border-blue-500/40' : 'bg-zinc-900 border-zinc-700'}`}>
                  <button onClick={() => togglePlayer(pe || s)} className="absolute top-1 right-2 text-zinc-500 hover:text-red-400 text-lg">×</button>
                  {pe?.profilePicture ? <img src={pe.profilePicture} className="w-12 h-12 rounded-full mx-auto mb-2 object-cover" alt="" /> : <div className="w-12 h-12 rounded-full bg-zinc-700 mx-auto mb-2 flex items-center justify-center text-zinc-400">{(pe?.displayName || '?')[0]}</div>}
                  <p className="text-white font-medium text-sm truncate">{pe?.displayName || 'Player'}</p>
                  <p className="text-zinc-500 text-xs">{pe?.teamTag} · ₹{s.cost}</p>
                  <div className="flex gap-1 mt-2 justify-center">
                    <button onClick={() => setRole(i, 'captain')} className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${s.role === 'captain' ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>C</button>
                    <button onClick={() => setRole(i, 'vice_captain')} className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${s.role === 'vice_captain' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>VC</button>
                  </div>
                </div>
              );
            })}
          </div>
          {!isLocked && (
            <button onClick={handleSubmit} disabled={createMutation.isPending || selected.length !== (contest?.squadSize || 4)} className="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all text-lg">
              {createMutation.isPending ? 'Saving...' : existingSquad ? '✏️ Update Squad' : '🚀 Submit Squad'}
            </button>
          )}
          {isLocked && <p className="text-center text-zinc-500 mt-3">🔒 Contest is locked — no more edits</p>}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Search players..." className="flex-1 min-w-[200px] px-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-800 text-sm" />
        <select value={filter.team} onChange={e => setFilter({ ...filter, team: e.target.value })} className="px-3 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-800 text-sm">
          <option value="">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.tag || 'Team'}</option>)}
        </select>
      </div>

      {/* Player Pool */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredPool.map(p => {
          const pid = p.player?._id || p.player;
          const sel = isSelected(pid);
          return (
            <button key={pid} onClick={() => !isLocked && togglePlayer(p)} disabled={isLocked} className={`text-left rounded-xl p-4 border transition-all ${sel ? 'bg-purple-600/10 border-purple-500/50 ring-1 ring-purple-500/30' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'} ${isLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="flex items-center gap-3">
                {p.profilePicture ? <img src={p.profilePicture} className="w-10 h-10 rounded-full object-cover" alt="" /> : <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold">{(p.displayName || '?')[0]}</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{p.displayName}</p>
                  <p className="text-zinc-500 text-xs">{p.teamTag} · {p.inGameRole || 'Player'}</p>
                </div>
                <div className="text-right">
                  <p className="text-purple-400 font-bold">{p.cost}</p>
                  {p.selectionPercentage > 0 && <p className="text-zinc-600 text-[10px]">{p.selectionPercentage}% picked</p>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
