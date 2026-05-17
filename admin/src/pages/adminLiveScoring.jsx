import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLiveMatchAPI, startLiveScoringAPI, knockLivePlayerAPI, finishLivePlayerAPI, reviveLivePlayerAPI, eliminateTeamAPI, endLiveScoringAPI, finalizeMatchAPI, submitValorantResultsAPI, undoLiveActionAPI } from '../api/adminApi';
import { Undo2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import TournamentMatchPicker from '../components/TournamentMatchPicker';
import { toast } from 'react-toastify';
import { Radio, Play, Square, Crosshair, Skull, Trophy, RefreshCw, Swords, Save, ArrowLeft } from 'lucide-react';

export default function AdminLiveScoring() {
  const qc = useQueryClient();
  const [matchId, setMatchId] = useState('');
  const [killerTeamId, setKillerTeamId] = useState('');
  const [killerPlayerId, setKillerPlayerId] = useState('');
  const [victimTeamId, setVictimTeamId] = useState('');
  const [victimPlayerId, setVictimPlayerId] = useState('');
  const [valResult, setValResult] = useState({ scoreA: 0, scoreB: 0, winner: '' });

  const { data: matchData, isLoading: matchLoading, refetch } = useQuery({
    queryKey: ['liveMatch', matchId],
    queryFn: () => getLiveMatchAPI(matchId),
    enabled: !!matchId && matchId.length === 24,
    refetchInterval: (query) => query.state.data?.match?.liveState?.isLiveScoring ? 5000 : false,
  });

  const match = matchData?.match;
  const live = matchData?.live;
  const isLive = match?.liveState?.isLiveScoring;
  const isValorant = match?.gameTitle === 'VALORANT' || match?.tournament?.gameTitle === 'VALORANT';

  // BGMI mutations
  const startMutation = useMutation({ mutationFn: () => startLiveScoringAPI(matchId), onSuccess: () => { toast.success('Live scoring started!'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const knockMutation = useMutation({ mutationFn: (d) => knockLivePlayerAPI(matchId, d), onSuccess: () => { refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed to knock player') });
  const finishMutation = useMutation({ mutationFn: (d) => finishLivePlayerAPI(matchId, d), onSuccess: () => { refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed to record finish') });
  const reviveMutation = useMutation({ mutationFn: (d) => reviveLivePlayerAPI(matchId, d), onSuccess: () => { refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed to revive player') });
  const eliminateMutation = useMutation({ mutationFn: (teamId) => eliminateTeamAPI(matchId, teamId), onSuccess: (d) => { toast.success(`Team eliminated! Position: #${d.position}`); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const endMutation = useMutation({ mutationFn: () => endLiveScoringAPI(matchId), onSuccess: () => { toast.success('Live scoring ended'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const finalizeMutation = useMutation({ mutationFn: () => finalizeMatchAPI(matchId), onSuccess: () => { toast.success('Match finalized! Standings & ratings updated.'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const undoMutation = useMutation({ mutationFn: () => undoLiveActionAPI(matchId), onSuccess: (d) => { toast.success(d.message || 'Action undone!'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed to undo') });

  // Valorant result submission
  const valResultMutation = useMutation({
    mutationFn: (data) => submitValorantResultsAPI(matchId, data),
    onSuccess: () => { toast.success('Valorant results saved!'); refetch(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save Valorant results'),
  });

  const teamsAlive = match?.results?.filter(r => !r.isEliminated)?.length || 0;
  const totalTeams = match?.results?.length || 0;

  const getPlayerStatus = (teamId, playerId) => {
    const liveTeam = live?.teams?.find(t => (t.team?._id || t.team)?.toString() === teamId?.toString());
    const livePlayer = liveTeam?.players?.find(p => (p.player?._id || p.player)?.toString() === playerId?.toString());
    return livePlayer?.status || 'alive';
  };

  const killerTeams = match?.results || [];
  const killerTeam = killerTeams.find(r => (r.team?._id || r.team)?.toString() === killerTeamId) || null;
  const killerPlayers = killerTeam?.kills?.breakdown?.filter(b => b.isPlaying !== false) || [];

  const victimTeams = match?.results || [];
  const victimTeam = victimTeams.find(r => (r.team?._id || r.team)?.toString() === victimTeamId) || null;
  const victimPlayers = victimTeam?.kills?.breakdown?.filter(b => b.isPlaying !== false) || [];

  const actionLog = live?.actionLog || [];
  const lastAction = actionLog[actionLog.length - 1];

  useEffect(() => {
    if (!match || killerTeamId) return;
    const firstTeam = (match.results || [])[0];
    const firstTeamId = firstTeam?.team?._id || firstTeam?.team;
    if (firstTeamId) {
      setKillerTeamId(firstTeamId.toString());
      const firstPlayer = firstTeam?.kills?.breakdown?.find(b => b.isPlaying !== false);
      const firstPlayerId = firstPlayer?.player?._id || firstPlayer?.player;
      if (firstPlayerId) setKillerPlayerId(firstPlayerId.toString());
    }
  }, [match, killerTeamId]);

  const handleValSubmit = () => {
    if (!valResult.winner) { toast.error('Select a winner'); return; }
    valResultMutation.mutate({ scoreA: valResult.scoreA, scoreB: valResult.scoreB, winner: valResult.winner });
  };

  const handleSelectMatch = (id) => {
    setMatchId(id);
    setKillerTeamId('');
    setKillerPlayerId('');
    setVictimTeamId('');
    setVictimPlayerId('');
    setValResult({ scoreA: 0, scoreB: 0, winner: '' });
  };

  return (
    <AdminLayout>
      <div className="py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Radio className="w-8 h-8 text-red-500" /> Live Scoring</h1>
            <p className="text-zinc-400 mt-1">Select a tournament, pick a match, and manage live scoring</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Tournament/Match Picker */}
          <div className="lg:col-span-1">
            <TournamentMatchPicker onSelectMatch={handleSelectMatch} selectedMatchId={matchId} />
          </div>

          {/* Right: Match Details & Scoring */}
          <div className="lg:col-span-2 space-y-4">
            {!matchId && (
              <div className="bg-zinc-900 rounded-xl p-12 border border-zinc-800 text-center">
                <Radio className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-zinc-400 text-lg font-medium mb-2">No Match Selected</h3>
                <p className="text-zinc-600 text-sm">Select a tournament and match from the left panel to begin scoring.</p>
              </div>
            )}

            {matchId && matchLoading && (
              <div className="bg-zinc-900 rounded-xl p-12 border border-zinc-800 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
                <p className="text-zinc-400 text-sm">Loading match...</p>
              </div>
            )}

            {match && (
              <>
                {/* Match Header */}
                <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => { setMatchId(''); }} className="text-zinc-500 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></button>
                        <h2 className="text-lg font-bold text-white">Match #{match.matchNumber} — {match.tournamentPhase}</h2>
                      </div>
                      <p className="text-zinc-400 text-sm">
                        {isValorant && <span className="text-red-400 font-semibold mr-2">VALORANT</span>}
                        {!isValorant && <span className="text-yellow-400 font-semibold mr-2">BGMI</span>}
                        Map: {match.map} · Status: <span className={isLive ? 'text-red-400 font-semibold' : 'text-zinc-300'}>{match.status}</span>
                      </p>
                      {isLive && !isValorant && <p className="text-green-400 text-sm mt-1">🔴 LIVE — {teamsAlive}/{totalTeams} teams alive</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!isValorant && (
                        <>
                          {!isLive && match.status !== 'completed' && (
                            <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 text-sm"><Play className="w-4 h-4" /> Start Live</button>
                          )}
                          {isLive && (
                            <button onClick={() => { if (confirm('End live scoring?')) endMutation.mutate(); }} disabled={endMutation.isPending} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 text-sm"><Square className="w-4 h-4" /> End Live</button>
                          )}
                        </>
                      )}
                      {match.status !== 'completed' && !isLive && (match.results?.some(r => r.finalPosition) || match.vsResults?.winner) && (
                        <button onClick={() => { if (confirm('Finalize match?')) finalizeMutation.mutate(); }} disabled={finalizeMutation.isPending} className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1.5 text-sm"><Trophy className="w-4 h-4" /> Finalize</button>
                      )}
                      <button onClick={() => refetch()} className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 flex items-center gap-1.5 text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
                    </div>
                  </div>
                </div>

                {/* VALORANT RESULT ENTRY */}
                {isValorant && match.status !== 'completed' && (
                  <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Swords className="w-5 h-5 text-red-400" /> Enter Valorant Result</h3>
                    {match.results?.length >= 2 ? (
                      <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              {match.results[0]?.team?.logo && <img src={match.results[0].team.logo} alt="" className="w-8 h-8 rounded" />}
                              <span className="text-white font-bold">{match.results[0]?.team?.teamName || 'Team A'}</span>
                            </div>
                            <input type="number" min="0" max="25" value={valResult.scoreA} onChange={e => setValResult(prev => ({ ...prev, scoreA: parseInt(e.target.value) || 0 }))} className="w-20 mx-auto text-center text-3xl font-black bg-zinc-800 text-white rounded-lg border border-zinc-700 py-3" />
                          </div>
                          <div className="text-center text-zinc-500 text-2xl font-bold">VS</div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              {match.results[1]?.team?.logo && <img src={match.results[1].team.logo} alt="" className="w-8 h-8 rounded" />}
                              <span className="text-white font-bold">{match.results[1]?.team?.teamName || 'Team B'}</span>
                            </div>
                            <input type="number" min="0" max="25" value={valResult.scoreB} onChange={e => setValResult(prev => ({ ...prev, scoreB: parseInt(e.target.value) || 0 }))} className="w-20 mx-auto text-center text-3xl font-black bg-zinc-800 text-white rounded-lg border border-zinc-700 py-3" />
                          </div>
                        </div>
                        <div>
                          <label className="text-zinc-400 text-sm mb-2 block">Winner</label>
                          <div className="flex gap-3">
                            {match.results.slice(0, 2).map((r, idx) => {
                              const teamId = r.team?._id || r.team;
                              const teamName = r.team?.teamName || `Team ${idx + 1}`;
                              return (
                                <button key={teamId} type="button" onClick={() => setValResult(prev => ({ ...prev, winner: teamId }))}
                                  className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors border ${valResult.winner === teamId ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                                >{teamName}</button>
                              );
                            })}
                          </div>
                        </div>
                        <button onClick={handleValSubmit} disabled={valResultMutation.isPending} className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                          <Save className="w-5 h-5" />{valResultMutation.isPending ? 'Saving...' : 'Save Valorant Result'}
                        </button>
                      </div>
                    ) : (<p className="text-zinc-500">Match needs at least 2 teams to enter results.</p>)}
                  </div>
                )}

                {/* Valorant existing results */}
                {isValorant && match.vsResults && (
                  <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" /> Current Results</h3>
                    <div className="flex items-center justify-center gap-8 py-4">
                      <div className="text-center">
                        <div className="text-white font-bold mb-2">{match.vsResults.teamA?.teamName || 'Team A'}</div>
                        <div className={`text-4xl font-black ${match.vsResults.scoreA > match.vsResults.scoreB ? 'text-green-400' : 'text-zinc-400'}`}>{match.vsResults.scoreA}</div>
                      </div>
                      <span className="text-zinc-600 text-2xl font-bold">:</span>
                      <div className="text-center">
                        <div className="text-white font-bold mb-2">{match.vsResults.teamB?.teamName || 'Team B'}</div>
                        <div className={`text-4xl font-black ${match.vsResults.scoreB > match.vsResults.scoreA ? 'text-green-400' : 'text-zinc-400'}`}>{match.vsResults.scoreB}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* BGMI TEAMS GRID */}
                {!isValorant && (
                  <div>
                    {isLive && (
                      <div className="bg-zinc-900 rounded-xl p-5 mb-4 border border-zinc-800 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-white flex items-center gap-2"><Swords className="w-5 h-5 text-red-500" /> Action Control Center</h3>
                          {lastAction && (
                            <button onClick={() => undoMutation.mutate()} disabled={undoMutation.isPending} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg hover:bg-zinc-700 hover:text-white border border-zinc-700 flex items-center gap-2 transition-colors disabled:opacity-50">
                              <Undo2 className="w-3.5 h-3.5" /> Undo Last Action ({lastAction.actionType})
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                          <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500 z-10">VS</div>
                          
                          {/* Killer Side */}
                          <div className="bg-zinc-950/50 p-4 rounded-xl border border-emerald-500/20">
                            <h4 className="text-emerald-400 font-semibold text-sm mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4" /> Attacker (Killer)</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-zinc-500 font-medium">Team</label>
                              <select value={killerTeamId} onChange={(e) => { 
                                  setKillerTeamId(e.target.value); 
                                  if (e.target.value === 'playzone') setKillerPlayerId('playzone');
                                  else setKillerPlayerId(''); 
                                }} className="mt-1 w-full px-3 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-emerald-500 outline-none text-sm">
                                  <option value="">Select team</option>
                                  <option value="playzone" className="text-blue-400 font-bold">☣️ Playzone</option>
                                  {(match?.results || []).map((r) => {
                                    const t = r.team;
                                    const id = (t?._id || t)?.toString();
                                    const name = t?.teamName || t?.teamTag || id?.slice(-6);
                                    return <option key={id} value={id}>{name}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-zinc-500 font-medium">Player</label>
                                <select disabled={killerTeamId === 'playzone'} value={killerPlayerId} onChange={(e) => setKillerPlayerId(e.target.value)} className="mt-1 w-full px-3 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-emerald-500 outline-none text-sm disabled:opacity-50">
                                  {killerTeamId === 'playzone' ? (
                                    <option value="playzone">Playzone</option>
                                  ) : (
                                    <>
                                      <option value="">Select player</option>
                                      {killerPlayers.map((entry) => {
                                        const p = entry.player;
                                        const id = (p?._id || p)?.toString();
                                        const name = p?.gameIds?.[0]?.inGameName || p?.realName || p?.username || 'Player';
                                        return <option key={id} value={id}>{name}</option>;
                                      })}
                                    </>
                                  )}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Victim Side */}
                          <div className="bg-zinc-950/50 p-4 rounded-xl border border-red-500/20">
                            <h4 className="text-red-400 font-semibold text-sm mb-3 flex items-center gap-2"><Skull className="w-4 h-4" /> Target (Victim)</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-zinc-500 font-medium">Team</label>
                                <select value={victimTeamId} onChange={(e) => { setVictimTeamId(e.target.value); setVictimPlayerId(''); }} className="mt-1 w-full px-3 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-red-500 outline-none text-sm">
                                  <option value="">Select team</option>
                                  {(match?.results || []).map((r) => {
                                    const t = r.team;
                                    const id = (t?._id || t)?.toString();
                                    const name = t?.teamName || t?.teamTag || id?.slice(-6);
                                    return <option key={id} value={id}>{name}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-zinc-500 font-medium">Player</label>
                                <select value={victimPlayerId} onChange={(e) => setVictimPlayerId(e.target.value)} className="mt-1 w-full px-3 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-red-500 outline-none text-sm">
                                  <option value="">Select player</option>
                                  {victimPlayers.map((entry) => {
                                    const p = entry.player;
                                    const id = (p?._id || p)?.toString();
                                    const name = p?.gameIds?.[0]?.inGameName || p?.realName || p?.username || 'Player';
                                    return <option key={id} value={id}>{name}</option>;
                                  })}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-center gap-4">
                          <button 
                            onClick={() => {
                              if (!victimTeamId || !victimPlayerId) return toast.error('Select target victim');
                              knockMutation.mutate({ teamId: victimTeamId, playerId: victimPlayerId, isPlayzone: killerTeamId === 'playzone' });
                            }} 
                            disabled={knockMutation.isPending || !victimPlayerId} 
                            className="px-8 py-2.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 border border-orange-500/30 rounded-lg font-bold tracking-wider uppercase text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
                            <Crosshair className="w-4 h-4" /> Knock Target
                          </button>
                          <button 
                            onClick={() => {
                              if (!killerTeamId || !killerPlayerId || !victimTeamId || !victimPlayerId) return toast.error('Select both killer and victim');
                              finishMutation.mutate({ killerTeamId, killerPlayerId, victimTeamId, victimPlayerId, isPlayzone: killerTeamId === 'playzone' });
                              setVictimPlayerId(''); // clear victim for next action
                            }} 
                            disabled={finishMutation.isPending || !killerPlayerId || !victimPlayerId} 
                            className="px-8 py-2.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 rounded-lg font-bold tracking-wider uppercase text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
                            <Skull className="w-4 h-4" /> Finish Target
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(match.results || []).sort((a, b) => {
                      if (a.isEliminated && !b.isEliminated) return 1;
                      if (!a.isEliminated && b.isEliminated) return -1;
                      return (a.finalPosition || 999) - (b.finalPosition || 999);
                    }).map((teamResult) => {
                      const team = teamResult.team;
                      const teamName = team?.teamName || team?.teamTag || teamResult.team?.toString()?.slice(-6);
                      return (
                        <div key={teamResult.team?._id || teamResult.team} className={`rounded-xl border p-4 ${teamResult.isEliminated ? 'bg-zinc-900/50 border-zinc-800 opacity-60' : 'bg-zinc-900 border-zinc-700'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {team?.logo && <img src={team.logo} alt="" className="w-6 h-6 rounded" />}
                              <h3 className="text-white font-bold">{teamName}</h3>
                              {teamResult.chickenDinner && <span className="text-yellow-400 text-xs">🏆</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-orange-400 font-bold text-lg">{teamResult.kills?.total || 0} kills</span>
                              {teamResult.finalPosition && <span className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300">#{teamResult.finalPosition}</span>}
                            </div>
                          </div>

                          <div className="space-y-2 mb-3">
                            {(teamResult.kills?.breakdown || []).filter(b => b.isPlaying !== false).map((entry) => {
                              const player = entry.player;
                              const playerName = typeof player === 'object' ? (player?.gameIds?.[0]?.inGameName || player?.realName || player?.username || 'Player') : 'Player';
                              const playerId = entry.player?._id || entry.player;
                              const tId = teamResult.team?._id || teamResult.team;
                              const status = getPlayerStatus(tId, playerId);
                              const statusColor = status === 'alive' ? 'bg-green-500' : status === 'knocked' ? 'bg-red-500' : 'bg-zinc-500';
                              return (
                                <div key={entry.player?._id || entry.player} className="flex flex-col gap-2 bg-zinc-800/50 rounded-lg px-3 py-2 border border-zinc-700/50">
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2.5 h-2.5 shrink-0 rounded-full shadow-sm ${statusColor}`} />
                                      <span className="text-zinc-200 text-sm font-medium truncate" title={playerName}>{playerName}</span>
                                    </div>
                                    <div className="bg-zinc-950/50 px-2 py-0.5 rounded border border-zinc-700 shrink-0">
                                      <span className="text-orange-400 font-mono font-black text-sm">{entry.kills}</span>
                                      <span className="text-zinc-500 text-[10px] ml-1 uppercase font-bold">Kills</span>
                                    </div>
                                  </div>
                                  {isLive && !teamResult.isEliminated && (
                                    <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-700/50">
                                      <button onClick={() => knockMutation.mutate({ teamId: tId, playerId })} disabled={knockMutation.isPending || status === 'eliminated'} className="flex-1 py-1.5 bg-red-600/10 text-red-400 text-[10px] uppercase font-bold tracking-wider rounded hover:bg-red-600/20 border border-red-500/20 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"><Crosshair className="w-3 h-3 shrink-0" /> Knock</button>
                                      <button onClick={() => {
                                        if (!killerTeamId || !killerPlayerId) { toast.error('Select killer team and player'); return; }
                                        finishMutation.mutate({ killerTeamId, killerPlayerId, victimTeamId: tId, victimPlayerId: playerId });
                                      }} disabled={finishMutation.isPending || status === 'eliminated'} className="flex-1 py-1.5 bg-emerald-600/10 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded hover:bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"><Skull className="w-3 h-3 shrink-0" /> Finish</button>
                                      {status === 'knocked' && (
                                        <button onClick={() => reviveMutation.mutate({ teamId: tId, playerId })} disabled={reviveMutation.isPending} className="flex-1 py-1.5 bg-blue-600/10 text-blue-400 text-[10px] uppercase font-bold tracking-wider rounded hover:bg-blue-600/20 border border-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors">Revive</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {isLive && !teamResult.isEliminated && (
                            <button onClick={() => { if (confirm(`Eliminate ${teamName}?`)) eliminateMutation.mutate(teamResult.team?._id || teamResult.team); }}
                              disabled={eliminateMutation.isPending}
                              className="w-full py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 flex items-center justify-center gap-2 text-sm font-medium">
                              <Skull className="w-4 h-4" /> Eliminate Team
                            </button>
                          )}

                          {teamResult.isEliminated && (
                            <div className="text-center py-2 text-zinc-500 text-sm">Eliminated — #{teamResult.finalPosition}</div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
