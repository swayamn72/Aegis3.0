import React, { useState } from 'react';
import { AlertCircle, Crosshair, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Rank colour map ──────────────────────────────────────────────────────────
const RANK_STYLE = {
    Iron:      { grad: 'from-zinc-700 to-zinc-600',    accent: '#9ca3af', glow: 'shadow-zinc-500/20' },
    Bronze:    { grad: 'from-amber-900 to-amber-700',  accent: '#d97706', glow: 'shadow-amber-500/20' },
    Silver:    { grad: 'from-zinc-500 to-zinc-400',    accent: '#d1d5db', glow: 'shadow-zinc-300/20' },
    Gold:      { grad: 'from-yellow-700 to-yellow-500',accent: '#fbbf24', glow: 'shadow-yellow-400/30' },
    Platinum:  { grad: 'from-teal-700 to-teal-500',   accent: '#2dd4bf', glow: 'shadow-teal-400/30' },
    Diamond:   { grad: 'from-blue-700 to-violet-600', accent: '#818cf8', glow: 'shadow-violet-400/30' },
    Ascendant: { grad: 'from-emerald-700 to-emerald-500', accent: '#34d399', glow: 'shadow-emerald-400/30' },
    Immortal:  { grad: 'from-red-800 to-rose-600',    accent: '#f87171', glow: 'shadow-red-400/30' },
    Radiant:   { grad: 'from-yellow-400 to-amber-300',accent: '#fde68a', glow: 'shadow-yellow-300/40' },
};

export const getRankStyle = (tierName) => {
    if (!tierName) return RANK_STYLE.Iron;
    const base = tierName.split(' ')[0];
    return RANK_STYLE[base] || RANK_STYLE.Iron;
};

// ─── ValorantRankCard ─────────────────────────────────────────────────────────
export const ValorantRankCard = ({ rank, riotId, isLoading, error, onSync, syncing }) => {
    if (isLoading) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-zinc-700 rounded w-1/2 mb-4" />
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-700" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 bg-zinc-700 rounded w-2/3" />
                        <div className="h-3 bg-zinc-800 rounded w-1/2" />
                    </div>
                </div>
            </div>
        );
    }

    const style = rank ? getRankStyle(rank.tier) : RANK_STYLE.Iron;
    const rrPct = Math.min(rank?.rr ?? 0, 100);
    const isPositive = (rank?.lastChange ?? 0) >= 0;

    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg ${style.glow}`}>
            <div className={`h-1.5 w-full bg-gradient-to-r ${style.grad}`} />
            <div className="p-5">
                <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-2">
                    <span style={{ color: style.accent }}>◆</span>
                    Valorant Rank
                    {onSync && (
                        <button onClick={onSync} disabled={syncing}
                            className="ml-auto p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Sync rank">
                            <svg className={`w-3.5 h-3.5 text-zinc-400 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                    {riotId && <span className="ml-auto text-[10px] text-zinc-600 font-mono">{riotId}</span>}
                </h3>

                {error || !rank ? (
                    <div className="flex items-center gap-3 text-zinc-600 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error || 'Rank not available — try syncing'}</span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${style.grad} p-0.5 flex-shrink-0`}>
                                <div className="w-full h-full rounded-full bg-zinc-950/60 flex items-center justify-center overflow-hidden">
                                    {rank.iconUrl ? (
                                        <img src={rank.iconUrl} alt={rank.tier}
                                            className="w-12 h-12 object-contain drop-shadow-lg"
                                            onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                        <span className="text-2xl font-black" style={{ color: style.accent }}>
                                            {(rank.tier || '?')[0]}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xl font-black tracking-wide" style={{ color: style.accent }}>
                                    {rank.tier || 'Unranked'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-white font-bold text-sm">{rank.rr ?? '—'} RR</span>
                                    {rank.lastChange != null && (
                                        <span className={`text-xs font-bold flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {isPositive ? '+' : ''}{rank.lastChange}
                                        </span>
                                    )}
                                </div>
                                {rank.peakRank && <p className="text-zinc-500 text-[10px] mt-0.5">Peak: {rank.peakRank}</p>}
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                                <span>Ranked Rating</span><span>{rrPct}/100 RR</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-gradient-to-r ${style.grad} transition-all duration-700`}
                                    style={{ width: `${rrPct}%` }} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Map name → accent colour (fallback when no image)
const MAP_ACCENT = {
    Ascent: '#4ade80', Bind: '#fb923c', Haven: '#a78bfa', Split: '#38bdf8',
    Fracture: '#f472b6', Pearl: '#67e8f9', Icebox: '#93c5fd', Breeze: '#fbbf24',
    Lotus: '#f87171', Sunset: '#fb923c', Abyss: '#818cf8', Default: '#71717a',
};

// ─── ValorantMatchRow ─────────────────────────────────────────────────────────
// Displays one match in the in-game scoreboard style:
//   [Win stripe] [Agent face portrait] [Map thumb + name] | [Score] | [K/D/A] | [ACS]
export const ValorantMatchRow = ({ match }) => {
    const [agentErr, setAgentErr] = useState(false);
    const [mapErr, setMapErr] = useState(false);
    const kd = parseFloat(match.kd);
    const kdColor = kd >= 2 ? '#facc15' : kd >= 1 ? '#34d399' : '#f87171';
    const mapAccent = MAP_ACCENT[match.map] || MAP_ACCENT.Default;

    // Priority: killfeed portrait (face, from Henrik CDN) → displayicon (square icon from valorant-api.com)
    const agentSrc = !agentErr ? (match.agentKillfeed || match.agentIcon || null) : null;
    const hasMapImg = !mapErr && !!match.mapImage;

    return (
        <div className={`flex items-stretch rounded-lg border overflow-hidden transition-all duration-150 ${
            match.won
                ? 'bg-emerald-950/20 border-emerald-500/20 hover:border-emerald-400/40 hover:bg-emerald-950/30'
                : 'bg-red-950/20 border-red-500/15 hover:border-red-400/35 hover:bg-red-950/30'
        }`}>

            {/* Win/Loss stripe */}
            <div className={`w-1 flex-shrink-0 ${match.won ? 'bg-emerald-500' : 'bg-red-500'}`} />

            {/* Agent portrait — contain so the full face shows without zooming */}
            <div className="relative flex-shrink-0 w-14 overflow-hidden bg-zinc-800 border-r border-zinc-800/50"
                style={{ minHeight: '64px' }}>
                {agentSrc ? (
                    <img
                        src={agentSrc}
                        alt={match.agent || ''}
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={() => setAgentErr(true)}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <Crosshair className="w-5 h-5 text-zinc-600" />
                    </div>
                )}
                {/* Agent name badge at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-3 pb-0.5">
                    <span className="text-[7px] font-black text-white uppercase tracking-widest leading-none block text-center truncate px-0.5">
                        {match.agent || ''}
                    </span>
                </div>
            </div>

            {/* Map thumbnail + info */}
            <div className="flex items-center gap-2.5 px-3 py-2 flex-1 min-w-0">
                <div className="flex-shrink-0">
                    {hasMapImg ? (
                        <div className="w-10 h-8 rounded overflow-hidden border border-zinc-700/50">
                            <img
                                src={match.mapImage}
                                alt={match.map || ''}
                                className="w-full h-full object-cover"
                                onError={() => setMapErr(true)}
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-8 rounded border border-zinc-800 flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${mapAccent}22, ${mapAccent}06)` }}>
                            <span className="text-[9px] font-black" style={{ color: mapAccent }}>
                                {(match.map || '??').slice(0, 3).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <span className={`text-[11px] font-black uppercase tracking-wider block ${match.won ? 'text-emerald-400' : 'text-red-400'}`}>
                        {match.won ? 'VICTORY' : 'DEFEAT'}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold" style={{ color: mapAccent }}>{match.map || '—'}</span>
                        <span className="text-zinc-600 text-[9px]">·</span>
                        <span className="text-zinc-500 text-[10px]">{match.mode || 'Competitive'}</span>
                    </div>
                </div>
            </div>

            {/* Stat columns — Score | K/D/A | ACS */}
            <div className="flex items-center flex-shrink-0 border-l border-zinc-800/50">
                <div className="flex flex-col items-center justify-center px-3 py-2 border-r border-zinc-800/40 min-w-[56px] hidden sm:flex">
                    <span className="text-white text-sm font-black">{match.score}</span>
                    <span className="text-zinc-600 text-[8px] uppercase tracking-widest">Rounds</span>
                </div>
                <div className="flex flex-col items-center justify-center px-3 py-2 border-r border-zinc-800/40 min-w-[76px]">
                    <div className="flex items-center gap-0.5 text-sm font-black font-mono">
                        <span className="text-emerald-400">{match.kills}</span>
                        <span className="text-zinc-600 font-normal text-xs">/</span>
                        <span className="text-red-400">{match.deaths}</span>
                        <span className="text-zinc-600 font-normal text-xs">/</span>
                        <span className="text-zinc-300">{match.assists}</span>
                    </div>
                    <span className="text-[8px] uppercase tracking-widest font-bold" style={{ color: kdColor }}>
                        {match.kd} K/D
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center px-3 py-2 min-w-[48px]">
                    <span className="text-purple-400 text-sm font-black">{match.acs}</span>
                    <span className="text-zinc-600 text-[8px] uppercase tracking-widest">ACS</span>
                </div>
            </div>
        </div>
    );
};

// ─── GameViewSwitcher ─────────────────────────────────────────────────────────
export const GameViewSwitcher = ({ gameView, setGameView, hasBgmiId, hasValorantId, valoLoading, riotId }) => {
    const hasMultiple = hasBgmiId && hasValorantId;
    // Only show if player has at least one game ID
    if (!hasBgmiId && !hasValorantId) return null;
    // If only one game, no need to switch — but still show label
    return (
        <div className="mt-5 flex items-center gap-3 flex-wrap">
            {/* Capsule toggle */}
            <div className="inline-flex items-center p-1 bg-zinc-900 border border-zinc-700/60 rounded-full shadow-inner gap-0.5">
                {/* BGMI option */}
                <button
                    onClick={() => hasBgmiId && setGameView('bgmi')}
                    disabled={!hasBgmiId}
                    title={!hasBgmiId ? 'No BGMI ID linked' : 'Switch to BGMI stats'}
                    className={`relative px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                        gameView === 'bgmi'
                            ? 'bg-yellow-500 text-zinc-900 shadow-lg shadow-yellow-500/40'
                            : hasBgmiId
                                ? 'text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800/80'
                                : 'text-zinc-700 cursor-not-allowed'
                    }`}
                >
                    <span className="text-[10px]">🔫</span>
                    BGMI
                </button>

                {/* VALORANT option */}
                <button
                    onClick={() => hasValorantId && setGameView('valorant')}
                    disabled={!hasValorantId}
                    title={!hasValorantId ? 'No Valorant ID linked' : 'Switch to Valorant stats'}
                    className={`relative px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                        gameView === 'valorant'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                            : hasValorantId
                                ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80'
                                : 'text-zinc-700 cursor-not-allowed'
                    }`}
                >
                    <span className="text-[10px]">◆</span>
                    VALORANT
                    {valoLoading && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                </button>
            </div>

            {/* Riot ID label */}
            {gameView === 'valorant' && riotId && (
                <span className="text-zinc-600 text-[10px] font-mono tracking-wide">{riotId}</span>
            )}
        </div>
    );
};
