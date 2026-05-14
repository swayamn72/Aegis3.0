import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, Clock, MapPin, Trophy, Target, Crown,
    Calendar, Users, Activity, AlertCircle, CheckCircle,
    Zap, BarChart3, Hash, ExternalLink, Shield, Medal
} from 'lucide-react';

import ErangelMap from '../assets/mapImages/erangel.jpg';
import MiramarMap from '../assets/mapImages/miramar.webp';
import SanhokMap from '../assets/mapImages/sanhok.webp';
import VikendiMap from '../assets/mapImages/vikendi.jpg';
import { fetchMatchById } from '../api/matches';

// ─── constants ────────────────────────────────────────────────────────────────

const MAP_IMAGES = {
    Erangel: ErangelMap,
    Miramar: MiramarMap,
    Sanhok: SanhokMap,
    Vikendi: VikendiMap,
    Livik: ErangelMap,
    Nusa: ErangelMap,
    Rondo: ErangelMap,
};

const STATUS_CONFIG = {
    scheduled: { color: 'blue', text: 'Scheduled', Icon: Clock, pulse: false },
    in_progress: { color: 'red', text: 'Live', Icon: Activity, pulse: true },
    completed: { color: 'green', text: 'Completed', Icon: CheckCircle, pulse: false },
    cancelled: { color: 'zinc', text: 'Cancelled', Icon: AlertCircle, pulse: false },
};

const PLACEMENT_STYLES = [
    'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-amber-500/40',
    'bg-gradient-to-r from-zinc-300 to-zinc-400   text-black shadow-zinc-400/40',
    'bg-gradient-to-r from-amber-700 to-amber-600  text-white shadow-amber-700/40',
];

// ─── small reusable pieces ────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;
    const { Icon, color, text, pulse } = cfg;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
      bg-${color}-500/15 border border-${color}-500/30 text-${color}-400`}>
            <Icon className={`w-3.5 h-3.5 ${pulse ? 'animate-pulse' : ''}`} />
            {text}
        </span>
    );
};

const PositionBadge = ({ position }) => {
    const style = position >= 1 && position <= 3
        ? PLACEMENT_STYLES[position - 1]
        : 'bg-zinc-700 text-zinc-200';
    return (
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shadow-lg ${style}`}>
            {position}
        </span>
    );
};

const TeamLogo = ({ src, alt, tag, className = 'w-10 h-10 rounded-lg' }) => {
    const fallback = `https://placehold.co/40x40/27272a/71717a?text=${encodeURIComponent((tag || alt || '?')[0])}`;
    return (
        <img
            src={src || fallback}
            alt={alt}
            className={`${className} object-cover border border-zinc-700 bg-zinc-800`}
            onError={(e) => { e.target.src = fallback; }}
        />
    );
};

const StatCard = ({ label, value, icon: Icon, color = 'orange' }) => (
    <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-4 text-center">
        <Icon className={`w-6 h-6 text-${color}-400 mx-auto mb-2`} />
        <div className={`text-2xl font-bold text-${color}-400 mb-1`}>{value}</div>
        <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</div>
    </div>
);

const sortResults = (results) =>
    [...results].sort((a, b) => {
        const ptDiff = (b.points?.totalPoints ?? 0) - (a.points?.totalPoints ?? 0);
        if (ptDiff !== 0) return ptDiff;
        const posA = a.finalPosition ?? 99;
        const posB = b.finalPosition ?? 99;
        return posA - posB;
    });

// ── Valorant Head-to-Head Scorecard ─────────────────────────────────────────
const ValorantScorecard = ({ match }) => {
    const vs = match.vsResults;
    if (!vs) return null;

    const teamA = vs.teamA;
    const teamB = vs.teamB;
    const winnerId = vs.winner?.toString();
    const teamAId = (teamA?._id || teamA)?.toString();
    const teamBId = (teamB?._id || teamB)?.toString();
    const teamAWon = winnerId === teamAId;
    const teamBWon = winnerId === teamBId;

    const playerStats = vs.playerStats || [];
    const teamAPlayers = playerStats.filter(ps => (ps.team?._id || ps.team)?.toString() === teamAId);
    const teamBPlayers = playerStats.filter(ps => (ps.team?._id || ps.team)?.toString() === teamBId);

    const TeamSide = ({ team, score, won, players, align = 'left' }) => (
        <div className={`flex-1 ${align === 'right' ? 'text-right' : ''}`}>
            <div className={`flex items-center gap-3 mb-4 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                <TeamLogo src={team?.logo} alt={team?.teamName} tag={team?.teamTag} className="w-12 h-12 rounded-xl" />
                <div>
                    <div className="text-white font-bold text-lg">{team?.teamName || 'TBD'}</div>
                    <div className="text-zinc-500 text-xs">{team?.teamTag || ''}</div>
                </div>
            </div>
            {players.length > 0 && (
                <div className="space-y-1">
                    {players.sort((a, b) => (b.acs || 0) - (a.acs || 0)).map((ps, i) => {
                        const p = ps.player;
                        const name = typeof p === 'object' ? (p?.username || p?.inGameName || 'Player') : 'Player';
                        return (
                            <div key={i} className={`flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 text-sm ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                                <span className="text-zinc-300 font-medium w-28 truncate">{name}</span>
                                {ps.agent && <span className="text-xs text-zinc-500">{ps.agent}</span>}
                                <span className="text-green-400 font-mono">{ps.kills || 0}</span>
                                <span className="text-zinc-600">/</span>
                                <span className="text-red-400 font-mono">{ps.deaths || 0}</span>
                                <span className="text-zinc-600">/</span>
                                <span className="text-blue-400 font-mono">{ps.assists || 0}</span>
                                <span className="ml-auto text-orange-400 font-bold">{ps.acs || 0} ACS</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Score Header */}
            <div className="flex items-center justify-center gap-6 py-8 px-6 bg-gradient-to-r from-zinc-900 via-zinc-800/50 to-zinc-900">
                <div className="flex items-center gap-4 flex-1 justify-end">
                    <div className="text-right">
                        <div className={`text-xl font-bold ${teamAWon ? 'text-green-400' : 'text-white'}`}>{teamA?.teamName || 'Team A'}</div>
                        <div className="text-zinc-500 text-xs">{teamAWon ? 'WINNER' : ''}</div>
                    </div>
                    <TeamLogo src={teamA?.logo} alt={teamA?.teamName} tag={teamA?.teamTag} className="w-14 h-14 rounded-xl" />
                </div>

                <div className="flex items-center gap-3 px-6">
                    <span className={`text-4xl font-black ${teamAWon ? 'text-green-400' : 'text-zinc-400'}`}>{vs.scoreA ?? 0}</span>
                    <span className="text-zinc-600 text-2xl font-bold">:</span>
                    <span className={`text-4xl font-black ${teamBWon ? 'text-green-400' : 'text-zinc-400'}`}>{vs.scoreB ?? 0}</span>
                </div>

                <div className="flex items-center gap-4 flex-1">
                    <TeamLogo src={teamB?.logo} alt={teamB?.teamName} tag={teamB?.teamTag} className="w-14 h-14 rounded-xl" />
                    <div>
                        <div className={`text-xl font-bold ${teamBWon ? 'text-green-400' : 'text-white'}`}>{teamB?.teamName || 'Team B'}</div>
                        <div className="text-zinc-500 text-xs">{teamBWon ? 'WINNER' : ''}</div>
                    </div>
                </div>
            </div>

            {/* Map & Details */}
            <div className="flex items-center justify-center gap-4 py-3 px-6 border-t border-zinc-800 bg-zinc-900/80 text-sm text-zinc-400">
                {match.map && <span>Map: <strong className="text-zinc-200">{match.map}</strong></span>}
                {vs.duration && <span>· Duration: <strong className="text-zinc-200">{Math.round(vs.duration / 60)}m</strong></span>}
                {match.tournamentPhase && <span>· {match.tournamentPhase}</span>}
            </div>

            {/* Player Stats */}
            {playerStats.length > 0 && (
                <div className="p-6 border-t border-zinc-800">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-orange-400" /> Player Performance
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <TeamSide team={teamA} score={vs.scoreA} won={teamAWon} players={teamAPlayers} />
                        <TeamSide team={teamB} score={vs.scoreB} won={teamBWon} players={teamBPlayers} align="right" />
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Leaderboard ──────────────────────────────────────────────────────────────
const LeaderboardTab = ({ results, map }) => {
    const sorted = useMemo(() => sortResults(results), [results]);

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" /> Final Standings
                </h2>
                <div className="w-20 h-13 rounded-lg overflow-hidden border border-zinc-700">
                    <img
                        src={MAP_IMAGES[map] ?? ErangelMap}
                        alt={map}
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>

            {sorted.length === 0 ? (
                <div className="py-20 text-center text-zinc-500">
                    <Trophy className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                    <p className="font-medium">No results yet</p>
                    <p className="text-xs mt-1">Results will appear once the match is completed</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50">
                                <th className="py-3 px-4 text-left">Rank</th>
                                <th className="py-3 px-4 text-left">Team</th>
                                <th className="py-3 px-3 text-center">Kills</th>
                                <th className="py-3 px-3 text-center">Placement Pts</th>
                                <th className="py-3 px-3 text-center">Kill Pts</th>
                                <th className="py-3 px-3 text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((entry, idx) => {
                                const team = entry.team;
                                const isTop3 = (entry.finalPosition ?? 99) <= 3;
                                const isWinner = entry.chickenDinner;
                                return (
                                    <tr
                                        key={team?._id ?? idx}
                                        className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30
                      ${isWinner ? 'bg-gradient-to-r from-amber-500/8 to-yellow-500/5' : isTop3 ? 'bg-zinc-800/15' : ''}`}
                                    >
                                        <td className="py-3.5 px-4">
                                            {entry.finalPosition
                                                ? <PositionBadge position={entry.finalPosition} />
                                                : <span className="text-zinc-600 text-xs">—</span>
                                            }
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <TeamLogo src={team?.logo} alt={team?.teamName} tag={team?.teamTag} />
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-white font-medium">{team?.teamName ?? 'Unknown'}</span>
                                                        {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                                                    </div>
                                                    <span className="text-zinc-500 text-xs">{team?.teamTag ?? '—'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-3 text-center font-bold text-red-400">
                                            {entry.kills?.total ?? 0}
                                        </td>
                                        <td className="py-3.5 px-3 text-center font-semibold text-green-400">
                                            {entry.points?.placementPoints ?? 0}
                                        </td>
                                        <td className="py-3.5 px-3 text-center font-semibold text-blue-400">
                                            {entry.points?.killPoints ?? entry.kills?.total ?? 0}
                                        </td>
                                        <td className="py-3.5 px-3 text-center">
                                            <span className={`font-bold text-base ${isTop3 ? 'text-orange-400' : 'text-zinc-200'}`}>
                                                {entry.points?.totalPoints ?? 0}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ── Overview ─────────────────────────────────────────────────────────────────
const OverviewTab = ({ match, results }) => {
    const winner = results.find(r => r.chickenDinner) ?? results.find(r => r.finalPosition === 1);
    const topKills = results.reduce((acc, r) => (r.kills?.total ?? 0) > (acc.kills?.total ?? 0) ? r : acc, results[0]);

    const dateStr = match.scheduledStartTime
        ? new Date(match.scheduledStartTime).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
        : 'TBD';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {winner && (
                    <div className="bg-gradient-to-br from-amber-500/15 to-orange-600/10 border border-amber-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4 text-amber-400 text-sm font-semibold uppercase tracking-wide">
                            <Crown className="w-4 h-4" /> Chicken Dinner Winner
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <TeamLogo
                                    src={winner.team?.logo} alt={winner.team?.teamName} tag={winner.team?.teamTag}
                                    className="w-14 h-14 rounded-xl"
                                />
                                <div>
                                    <div className="text-xl font-bold text-white">{winner.team?.teamName ?? '—'}</div>
                                    <div className="text-amber-400/70 text-sm">{winner.team?.teamTag}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black text-amber-400">{winner.points?.totalPoints ?? 0}</div>
                                <div className="text-zinc-400 text-xs">Total Points</div>
                                <div className="text-red-400 text-sm mt-0.5">{winner.kills?.total ?? 0} Kills</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <StatCard label="Total Kills" value={match.matchStats?.totalKills ?? results.reduce((s, r) => s + (r.kills?.total ?? 0), 0)} icon={Target} color="red" />
                    <StatCard label="Teams" value={results.length} icon={Users} color="blue" />
                    <StatCard label="Map" value={match.map ?? '—'} icon={MapPin} color="green" />
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-orange-400" /> Highlights
                    </h3>
                    <div className="space-y-3 text-sm">
                        {winner && (
                            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                                <span className="text-zinc-400">Chicken Dinner</span>
                                <span className="text-amber-400 font-semibold">{winner.team?.teamName}</span>
                            </div>
                        )}
                        {topKills && (
                            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                                <span className="text-zinc-400">Most Kills (Team)</span>
                                <span className="text-red-400 font-semibold">
                                    {topKills.team?.teamName} — {topKills.kills?.total ?? 0}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center justify-between py-2">
                            <span className="text-zinc-400">Phase</span>
                            <span className="text-zinc-200 font-medium">{match.tournamentPhase ?? '—'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    <img
                        src={MAP_IMAGES[match.map] ?? ErangelMap}
                        alt={match.map}
                        className="w-full h-32 object-cover"
                    />
                    <div className="p-5 space-y-3 text-sm">
                        <Row label="Date" value={dateStr} />
                        <Row label="Map" value={match.map ?? '—'} />
                        <Row label="Phase" value={match.tournamentPhase ?? '—'} />
                        <Row label="Status">
                            <StatusBadge status={match.status} />
                        </Row>
                        <Row label="Match #" value={match.matchNumber} />
                        {match.tournament?.tournamentName && (
                            <Row label="Tournament" value={match.tournament.tournamentName} />
                        )}
                    </div>
                </div>

                {match.streamUrls?.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-red-400" /> Streams
                        </h3>
                        <div className="space-y-2">
                            {match.streamUrls.map((s, i) => (
                                <a
                                    key={i}
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white
                    bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-2 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    {s.platform} {s.language ? `(${s.language})` : ''}
                                    {s.isMain && <span className="ml-auto text-xs text-orange-400">Main</span>}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Statistics ────────────────────────────────────────────────────────────────
const StatisticsTab = ({ results, matchStats }) => {
    const sorted = useMemo(() => sortResults(results), [results]);
    const maxKills = Math.max(...results.map(r => r.kills?.total ?? 0), 1);
    const totalKills = results.reduce((s, r) => s + (r.kills?.total ?? 0), 0);

    const players = useMemo(() => {
        return results.flatMap(team =>
            (team.kills?.breakdown || []).map(b => ({
                ...b,
                teamName: team.team?.teamName,
                teamTag: team.team?.teamTag,
                teamLogo: team.team?.logo
            }))
        ).sort((a, b) => (b.kills || 0) - (a.kills || 0));
    }, [results]);

    const mvp = useMemo(() => {
        const topFromBreakdown = players[0];
        const topFromServer = matchStats?.mostKillsPlayer;

        if (topFromBreakdown && (!topFromServer || topFromBreakdown.kills >= (topFromServer.kills || 0))) {
            return {
                player: topFromBreakdown.player,
                kills: topFromBreakdown.kills
            };
        }
        return topFromServer;
    }, [players, matchStats]);

    const mvpPlayer = mvp?.player;
    const mvpKills = mvp?.kills;

    return (
        <div className="space-y-8">
            {mvpPlayer && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Trophy className="w-32 h-32 text-amber-500" />
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="relative">
                            <img
                                src={mvpPlayer.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mvpPlayer.username || 'player')}`}
                                alt={mvpPlayer.username}
                                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border-2 border-amber-500/50 shadow-2xl"
                                onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mvpPlayer.username || 'player')}`; }}
                            />
                            <div className="absolute -bottom-2 -right-2 bg-amber-500 text-black p-2 rounded-lg shadow-lg">
                                <Medal className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <div className="text-amber-400 font-bold uppercase tracking-widest text-xs mb-2">Match MVP</div>
                            <h2 className="text-3xl font-black text-white mb-1">{mvpPlayer.inGameName || mvpPlayer.username}</h2>
                            <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                                <div className="bg-zinc-800/80 rounded-xl px-4 py-3 border border-zinc-700">
                                    <div className="text-red-400 font-black text-2xl">{mvpKills || 0}</div>
                                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-tighter">Eliminations</div>
                                </div>
                                <div className="bg-zinc-800/80 rounded-xl px-4 py-3 border border-zinc-700">
                                    <div className="text-amber-400 font-black text-2xl">#1</div>
                                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-tighter">Performance</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-400" /> Team Performance
                    </h2>
                    <div className="space-y-3">
                        {sorted.slice(0, 5).map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800/70 transition-colors">
                                <PositionBadge position={entry.finalPosition || idx + 1} />
                                <TeamLogo src={entry.team?.logo} alt={entry.team?.teamName} tag={entry.team?.teamTag} className="w-9 h-9 rounded-lg" />
                                <span className="flex-1 text-white font-medium text-sm truncate">{entry.team?.teamName ?? '—'}</span>
                                <div className="text-right shrink-0">
                                    <div className="text-orange-400 font-bold text-sm">{entry.points?.totalPoints ?? 0} pts</div>
                                    <div className="text-red-400 text-xs">{entry.kills?.total ?? 0} kills</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                        <Target className="w-5 h-5 text-red-400" /> Top Fraggers
                    </h2>
                    <div className="space-y-3">
                        {players.length > 0 ? players.slice(0, 5).map((p, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800/70 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-bold text-sm">{p.player?.inGameName || p.player?.username || 'Player'}</div>
                                    <div className="text-[10px] text-zinc-500 font-medium uppercase">{p.teamName}</div>
                                </div>
                                <div className="bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                                    <span className="text-red-400 font-bold">{p.kills || 0}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 text-zinc-600">
                                <Hash className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Detailed player stats unavailable</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── helper ────────────────────────────────────────────────────────────────────
const Row = ({ label, value, children }) => (
    <div className="flex items-start justify-between gap-2">
        <span className="text-zinc-500 shrink-0">{label}</span>
        {children ?? <span className="text-white font-medium text-right">{String(value ?? '—')}</span>}
    </div>
);

const TABS = [
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'overview', label: 'Overview' },
    { id: 'statistics', label: 'Statistics' },
];

const DetailedMatchInfo = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('leaderboard');

    const { data: match, isLoading, isError, error } = useQuery({
        queryKey: ['match', id],
        queryFn: () => fetchMatchById(id),
        enabled: !!id,
        staleTime: 60_000,
        select: (raw) => raw?.match ?? raw,
    });

    const isValorant = !!match?.vsResults;

    const results = useMemo(() => {
        if (!match?.results?.length) return [];
        return sortResults(match.results);
    }, [match]);

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen pt-[100px] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Loading match data…</p>
                </div>
            </div>
        );
    }

    if (isError || !match) {
        return (
            <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen pt-[100px] flex items-center justify-center px-4">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">
                        {isError ? 'Failed to load match' : 'Match not found'}
                    </h2>
                    {isError && <p className="text-zinc-400 text-sm mb-6">{error?.message ?? 'Something went wrong'}</p>}
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg transition-colors font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    const winner = results.find(r => r.chickenDinner) ?? results.find(r => r.finalPosition === 1);
    const dateStr = match.scheduledStartTime
        ? new Date(match.scheduledStartTime).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
        : 'TBD';

    return (
        <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans pt-[100px] pb-16">
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-zinc-300" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-white truncate">
                            Match #{match.matchNumber}
                            {match.map && <span className="text-zinc-400 font-normal text-lg"> · {match.map}</span>}
                        </h1>
                        <p className="text-zinc-500 text-sm truncate">
                            {match.tournament?.tournamentName ?? 'Tournament'}
                            {match.tournamentPhase && ` · ${match.tournamentPhase}`}
                        </p>
                    </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-zinc-800">
                    <img
                        src={MAP_IMAGES[match.map] ?? ErangelMap}
                        alt={match.map}
                        className="w-full h-44 sm:h-56 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />

                    <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                            {winner ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0">
                                        <Crown className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-amber-400 font-semibold uppercase tracking-wide mb-0.5">
                                            {winnerLabel}
                                        </div>
                                        <div className="text-xl font-black text-white">{winner.team?.teamName ?? '—'}</div>
                                        <div className="text-zinc-400 text-xs flex items-center gap-3 mt-0.5">
                                            <span>{winner.points?.totalPoints ?? 0} pts</span>
                                            <span>·</span>
                                            <span>{winner.kills?.total ?? 0} kills</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <Shield className="w-8 h-8 text-zinc-500" />
                                    <div>
                                        <div className="text-white font-bold text-lg">Match #{match.matchNumber}</div>
                                        <div className="text-zinc-400 text-sm">{match.tournamentPhase}</div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2.5">
                                <StatusBadge status={match.status} />
                                <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> {match.map}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5">
                                    <Users className="w-3.5 h-3.5" /> {results.length} teams
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5">
                                    <Calendar className="w-3.5 h-3.5" /> {dateStr}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 border-b border-zinc-800 pb-0 overflow-x-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2.5 text-sm font-semibold transition-all rounded-t-lg whitespace-nowrap
                ${activeTab === tab.id
                                    ? 'bg-orange-500/15 border border-orange-500/40 border-b-transparent text-orange-400'
                                    : 'text-zinc-500 hover:text-zinc-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {isValorant ? (
                        <ValorantScorecard match={match} />
                    ) : (
                        <>
                            {activeTab === 'leaderboard' && <LeaderboardTab results={results} map={match.map} />}
                            {activeTab === 'overview' && <OverviewTab match={match} results={results} />}
                            {activeTab === 'statistics' && <StatisticsTab results={results} matchStats={match.matchStats} />}
                        </>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DetailedMatchInfo;
