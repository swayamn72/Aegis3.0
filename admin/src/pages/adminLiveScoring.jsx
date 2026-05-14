import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLiveMatchAPI, startLiveScoringAPI, addLiveKillAPI, eliminateTeamAPI, endLiveScoringAPI, finalizeMatchAPI, submitValorantResultsAPI } from '../api/adminApi';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'react-toastify';
import { Radio, Play, Square, Crosshair, Skull, Trophy, RefreshCw, Swords, Save } from 'lucide-react';

export default function AdminLiveScoring() {
  const qc = useQueryClient();
  const [matchId, setMatchId] = useState('');

  // Valorant result entry state
  const [valResult, setValResult] = useState({ scoreA: 0, scoreB: 0, winner: '' });

  const { data: matchData, isLoading: matchLoading, refetch } = useQuery({
    queryKey: ['liveMatch', matchId],
    queryFn: () => getLiveMatchAPI(matchId),
    enabled: !!matchId && matchId.length === 24,
    refetchInterval: matchData?.match?.liveState?.isLiveScoring ? 5000 : false,
  });

  const match = matchData?.match;
  const isLive = match?.liveState?.isLiveScoring;
  const isValorant = match?.gameTitle === 'VALORANT' || match?.tournament?.gameTitle === 'VALORANT';

  // BGMI mutations
  const startMutation = useMutation({ mutationFn: () => startLiveScoringAPI(matchId), onSuccess: () => { toast.success('Live scoring started!'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const killMutation = useMutation({ mutationFn: (d) => addLiveKillAPI(matchId, d), onSuccess: () => { refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed to add kill') });
  const eliminateMutation = useMutation({ mutationFn: (teamId) => eliminateTeamAPI(matchId, teamId), onSuccess: (d) => { toast.success(`Team eliminated! Position: #${d.position}`); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const endMutation = useMutation({ mutationFn: () => endLiveScoringAPI(matchId), onSuccess: () => { toast.success('Live scoring ended'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });
  const finalizeMutation = useMutation({ mutationFn: () => finalizeMatchAPI(matchId), onSuccess: () => { toast.success('Match finalized! Standings & ratings updated.'); refetch(); }, onError: (e) => toast.error(e.response?.data?.error || 'Failed') });

  // Valorant result submission
  const valResultMutation = useMutation({
    mutationFn: (data) => submitValorantResultsAPI(matchId, data),
    onSuccess: () => { toast.success('Valorant results saved!'); refetch(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save Valorant results'),
  });

  const teamsAlive = match?.results?.filter(r => !r.isEliminated)?.length || 0;
  const totalTeams = match?.results?.length || 0;

  const handleValSubmit = () => {
    if (!valResult.winner) {
      toast.error('Select a winner');
      return;
    }
    valResultMutation.mutate({
      scoreA: valResult.scoreA,
      scoreB: valResult.scoreB,
      winner: valResult.winner,
    });
  };

  return (
    <AdminLayout>
      <div className="py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Radio className="w-8 h-8 text-red-500" /> Live Scoring</h1>
            <p className="text-zinc-400 mt-1">Real-time match scoring — add kills, eliminate teams, or enter Valorant results</p>
          </div>
        </div>

        {/* Match Selector */}
        <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">Select Match</h3>
          <div className="flex gap-4">
            <input value={matchId} onChange={e => setMatchId(e.target.value)} placeholder="Enter Match ID (24 characters)" className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 font-mono" />
            <button onClick={() => refetch()} disabled={matchId.length !== 24} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Load</button>
          </div>
        </div>

        {matchLoading && <div className="text-zinc-400 text-center py-8">Loading match...</div>}

        {match && (
          <>
            {/* Match Header */}
            <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Match #{match.matchNumber} — {match.tournamentPhase}</h2>
                  <p className="text-zinc-400">
                    {isValorant && <span className="text-red-400 font-semibold mr-2">VALORANT</span>}
                    {!isValorant && <span className="text-yellow-400 font-semibold mr-2">BGMI</span>}
                    Map: {match.map} · Status: <span className={isLive ? 'text-red-400 font-semibold' : 'text-zinc-300'}>{match.status}</span>
                  </p>
                  {isLive && !isValorant && <p className="text-green-400 text-sm mt-1">🔴 LIVE — {teamsAlive}/{totalTeams} teams alive</p>}
                </div>
                <div className="flex gap-3">
                  {/* BGMI controls */}
                  {!isValorant && (
                    <>
                      {!isLive && match.status !== 'completed' && (
                        <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"><Play className="w-4 h-4" /> Start Live</button>
                      )}
                      {isLive && (
                        <button onClick={() => { if (confirm('End live scoring?')) endMutation.mutate(); }} disabled={endMutation.isPending} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Square className="w-4 h-4" /> End Live</button>
                      )}
                    </>
                  )}
                  {match.status !== 'completed' && !isLive && (match.results?.some(r => r.finalPosition) || match.vsResults?.winner) && (
                    <button onClick={() => { if (confirm('Finalize match? This will calculate standings and ratings.')) finalizeMutation.mutate(); }} disabled={finalizeMutation.isPending} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"><Trophy className="w-4 h-4" /> Finalize</button>
                  )}
                </div>
              </div>
            </div>

            {/* ===== VALORANT RESULT ENTRY ===== */}
            {isValorant && match.status !== 'completed' && (
              <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Swords className="w-5 h-5 text-red-400" /> Enter Valorant Result
                </h3>

                {/* Teams from match results */}
                {match.results?.length >= 2 ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      {/* Team A */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          {match.results[0]?.team?.logo && <img src={match.results[0].team.logo} alt="" className="w-8 h-8 rounded" />}
                          <span className="text-white font-bold">{match.results[0]?.team?.teamName || 'Team A'}</span>
                        </div>
                        <input
                          type="number"
                          min="0" max="25"
                          value={valResult.scoreA}
                          onChange={e => setValResult(prev => ({ ...prev, scoreA: parseInt(e.target.value) || 0 }))}
                          className="w-20 mx-auto text-center text-3xl font-black bg-zinc-800 text-white rounded-lg border border-zinc-700 py-3"
                        />
                      </div>

                      {/* VS */}
                      <div className="text-center text-zinc-500 text-2xl font-bold">VS</div>

                      {/* Team B */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          {match.results[1]?.team?.logo && <img src={match.results[1].team.logo} alt="" className="w-8 h-8 rounded" />}
                          <span className="text-white font-bold">{match.results[1]?.team?.teamName || 'Team B'}</span>
                        </div>
                        <input
                          type="number"
                          min="0" max="25"
                          value={valResult.scoreB}
                          onChange={e => setValResult(prev => ({ ...prev, scoreB: parseInt(e.target.value) || 0 }))}
                          className="w-20 mx-auto text-center text-3xl font-black bg-zinc-800 text-white rounded-lg border border-zinc-700 py-3"
                        />
                      </div>
                    </div>

                    {/* Winner selector */}
                    <div>
                      <label className="text-zinc-400 text-sm mb-2 block">Winner</label>
                      <div className="flex gap-3">
                        {match.results.slice(0, 2).map((r, idx) => {
                          const teamId = r.team?._id || r.team;
                          const teamName = r.team?.teamName || `Team ${idx + 1}`;
                          return (
                            <button
                              key={teamId}
                              type="button"
                              onClick={() => setValResult(prev => ({ ...prev, winner: teamId }))}
                              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors border ${
                                valResult.winner === teamId
                                  ? 'bg-green-600/20 border-green-500 text-green-400'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                              }`}
                            >
                              {teamName}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleValSubmit}
                      disabled={valResultMutation.isPending}
                      className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-5 h-5" />
                      {valResultMutation.isPending ? 'Saving...' : 'Save Valorant Result'}
                    </button>
                  </div>
                ) : (
                  <p className="text-zinc-500">Match needs at least 2 teams to enter results.</p>
                )}
              </div>
            )}

            {/* Valorant — already submitted results display */}
            {isValorant && match.vsResults && (
              <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" /> Current Results
                </h3>
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

            {/* ===== BGMI TEAMS GRID ===== */}
            {!isValorant && (
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

                      {/* Player Kill Breakdown */}
                      <div className="space-y-2 mb-3">
                        {(teamResult.kills?.breakdown || []).filter(b => b.isPlaying !== false).map((entry) => {
                          const player = entry.player;
                          const playerName = typeof player === 'object' ? (player?.gameIds?.[0]?.inGameName || player?.realName || player?.username || 'Player') : 'Player';
                          return (
                            <div key={entry.player?._id || entry.player} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                              <span className="text-zinc-300 text-sm">{playerName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-mono font-bold">{entry.kills}</span>
                                {isLive && !teamResult.isEliminated && (
                                  <button onClick={() => killMutation.mutate({ teamId: teamResult.team?._id || teamResult.team, playerId: entry.player?._id || entry.player, kills: 1 })}
                                    disabled={killMutation.isPending}
                                    className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded hover:bg-red-600/30 flex items-center gap-1">
                                    <Crosshair className="w-3 h-3" /> +Kill
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Eliminate Button */}
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
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
