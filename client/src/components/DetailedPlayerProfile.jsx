import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    Check, Star, Trophy, Calendar, MapPin, Users, Target, TrendingUp,
    Award, Gamepad2, Settings, Share2, MessageCircle, UserPlus,
    ArrowUp, ArrowDown, Activity, Clock, Zap, Shield, Sword,
    Medal, Crown, ChevronRight, ExternalLink, Hash, Globe, Mail,
    Flame, Timer, Crosshair, Eye, BarChart3, Percent, Sparkles,
    Map, Loader2, AlertCircle, ChevronDown, Instagram, Twitter, Youtube
} from 'lucide-react';
import { FaDiscord, FaInstagram, FaYoutube, FaTwitter } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { getPlayerById } from '../api/players';
import { fetchPlayerMatches } from '../api/playerMatches';
import { usePlayerMatches, usePlayerTournaments } from '../hooks/useProfile';
import { getRatingBadge, formatDelta } from '../utils/aegisRatingUtils';

import ErangelMap from '../assets/mapImages/erangel.jpg';
import MiramarMap from '../assets/mapImages/miramar.webp';
import SanhokMap from '../assets/mapImages/sanhok.webp';
import VikendiMap from '../assets/mapImages/vikendi.jpg';
import RondoMap from '../assets/mapImages/rondo.webp';

const MAP_IMAGES = {
    Erangel: ErangelMap,
    Miramar: MiramarMap,
    Sanhok: SanhokMap,
    Vikendi: VikendiMap,
    Rondo: RondoMap,
    Livik: ErangelMap,
    Nusa: ErangelMap,
};

// ─── Tier Badge ───────────────────────────────────────────────────────────────

const TierBadge = ({ tier }) => {
    const colors = {
        S: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
        A: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
        B: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
        C: 'bg-zinc-500/20 border-zinc-500/40 text-zinc-400',
        Community: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
    };
    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${colors[tier] || colors.Community}`}>
            {tier || 'C'}
        </span>
    );
};

// ─── Tournament Status Pill ────────────────────────────────────────────────────

const TournamentStatus = ({ status }) => {
    const map = {
        completed: 'bg-green-500/15 text-green-400',
        in_progress: 'bg-yellow-500/15 text-yellow-400',
        cancelled: 'bg-red-500/15 text-red-400',
        postponed: 'bg-orange-500/15 text-orange-400',
    };
    const label = {
        completed: 'Completed',
        in_progress: 'Live',
        cancelled: 'Cancelled',
        postponed: 'Postponed',
        announced: 'Announced',
        registration_open: 'Registration Open',
        registration_closed: 'Registration Closed',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || 'bg-zinc-700/50 text-zinc-400'}`}>
            {label[status] || status}
        </span>
    );
};

// ─── Phase Status Pill ─────────────────────────────────────────────────────────

const PhaseStatusPill = ({ phaseStatus, tournamentStatus }) => {
    // If no phaseStatus from backend, fall back to raw tournament status
    if (!phaseStatus) {
        const fallbackMap = {
            completed: { cls: 'bg-zinc-700/50 text-zinc-400', text: 'Completed' },
            in_progress: { cls: 'bg-yellow-500/15 text-yellow-400', text: 'Live' },
            cancelled: { cls: 'bg-red-500/15 text-red-400', text: 'Cancelled' },
        };
        const fb = fallbackMap[tournamentStatus];
        if (!fb) return null;
        return <span className={`text-xs px-2 py-0.5 rounded-full ${fb.cls}`}>{fb.text}</span>;
    }

    const styleMap = {
        active: 'bg-green-500/15 text-green-400 border border-green-500/25',
        eliminated: 'bg-red-500/15 text-red-400 border border-red-500/25',
        completed: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
        pending: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
        neutral: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30',
    };
    const iconMap = {
        active: <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1" />,
        eliminated: <span className="mr-1">✕</span>,
        completed: <span className="mr-1">🏆</span>,
        pending: <span className="mr-1">⏳</span>,
        neutral: null,
    };
    const cls = styleMap[phaseStatus.type] || styleMap.neutral;
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 ${cls}`}>
            {iconMap[phaseStatus.type]}
            {phaseStatus.label}
        </span>
    );
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

const SkeletonCard = ({ rows = 3 }) => (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 animate-pulse">
        <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-zinc-700 rounded w-1/3" />
            <div className="h-3 bg-zinc-800 rounded w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-3 bg-zinc-800 rounded w-full mb-2" />
        ))}
    </div>
);

// ─── Match Card ───────────────────────────────────────────────────────────────

const MatchCard = ({ match }) => {
    const navigate = useNavigate();
    const [mapImageError, setMapImageError] = useState(false);
    const isWin = match.teamResult?.finalPosition === 1;
    const isChicken = match.teamResult?.chickenDinner;
    const position = match.teamResult?.finalPosition;

    const positionColor =
        position === 1 ? 'text-yellow-400' :
            position === 2 ? 'text-zinc-300' :
                position === 3 ? 'text-orange-400' :
                    'text-zinc-400';

    const dateStr = match.scheduledStartTime
        ? new Date(match.scheduledStartTime).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        })
        : '—';

    const mapImage = !mapImageError && MAP_IMAGES[match.map] ? MAP_IMAGES[match.map] : ErangelMap;

    return (
        <div
            onClick={() => navigate(`/matches/${match._id}`)}
            className={`relative group bg-zinc-900/50 border rounded-lg p-4 transition-all duration-300 hover:bg-zinc-900 cursor-pointer overflow-hidden ${isWin ? 'border-yellow-500/30' : 'border-zinc-800 hover:border-zinc-700'
                }`}
        >
            {/* Map Background Overlay */}
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-all duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-zinc-950/40 group-hover:bg-zinc-950/20 transition-colors" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/50" />
                <img
                    src={mapImage}
                    alt=""
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                    onError={() => setMapImageError(true)}
                />
            </div>

            <div className="relative z-10">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isWin ? 'bg-yellow-400' : 'bg-zinc-600'}`} />
                        <Link
                            to={`/tournament/${match.tournament?._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-white font-medium text-sm truncate hover:text-[#FF4500] transition-colors"
                        >
                            {match.tournament?.tournamentName || 'Unknown Tournament'}
                        </Link>
                        {isChicken && <span className="text-base leading-none">🐔</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {match.status === 'in_progress' && (
                            <span className="bg-yellow-500/15 text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/20 animate-pulse">
                                LIVE
                            </span>
                        )}
                        <span className="text-zinc-500 text-xs">{dateStr}</span>
                    </div>
                </div>

                {/* Phase + Map */}
                <div className="flex items-center gap-3 mb-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                        <Map className="w-3 h-3" />
                        {match.map || '—'}
                    </span>
                    <span>{match.tournamentPhase || '—'}</span>
                    <span>Match #{match.matchNumber}</span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-zinc-800/60 rounded-lg py-2 border border-zinc-700/30">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">Position</p>
                        <p className={`font-bold text-sm ${positionColor}`}>
                            {position != null ? `#${position}` : '—'}
                        </p>
                    </div>
                    <div className="bg-zinc-800/60 rounded-lg py-2 border border-zinc-700/30">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">Kills</p>
                        <p className="text-cyan-400 font-bold text-sm flex items-center justify-center gap-1">
                            <Flame className="w-3 h-3" />
                            {match.teamResult?.kills ?? '—'}
                        </p>
                    </div>
                    <div className="bg-zinc-800/60 rounded-lg py-2 border border-zinc-700/30">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-0.5">Points</p>
                        <p className="text-purple-400 font-bold text-sm">
                            {match.teamResult?.totalPoints ?? '—'}
                        </p>
                    </div>
                </div>

                {/* Team name */}
                {match.teamResult?.team?.teamName && (
                    <div className="mt-2 text-[10px] text-zinc-600 text-right italic">
                        via {match.teamResult.team.teamName}
                        {match.status === 'in_progress' && ' (Current)'}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Tournament History Card ──────────────────────────────────────────────────

const TournamentHistoryCard = ({ tournament }) => {
    const [logoError, setLogoError] = useState(false);
    const position = tournament.finalPosition;
    const isTopThree = position && position <= 3;
    const positionEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;

    const dateRange = (() => {
        if (!tournament.startDate) return '—';
        const start = new Date(tournament.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const end = tournament.endDate
            ? new Date(tournament.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '';
        return end ? `${start} – ${end}` : start;
    })();

    return (
        <div className={`bg-zinc-900/50 border rounded-xl p-4 transition-colors hover:bg-zinc-900 ${isTopThree ? 'border-yellow-500/30' : 'border-zinc-800'
            }`}>
            <div className="flex items-start gap-3">
                {/* Logo or placeholder */}
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    {tournament.media?.logo && !logoError ? (
                        <img
                            src={tournament.media.logo}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={() => setLogoError(true)}
                        />
                    ) : (
                        <Trophy className="w-5 h-5 text-zinc-600" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link
                            to={`/tournament/${tournament._id}`}
                            className="text-white font-semibold text-sm truncate hover:text-amber-400 transition-colors"
                        >
                            {tournament.tournamentName}
                        </Link>
                        {positionEmoji && (
                            <span className="text-base leading-none">{positionEmoji}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        <TierBadge tier={tournament.tier} />
                        <span className="text-xs text-zinc-500">{tournament.gameTitle}</span>
                        <PhaseStatusPill
                            phaseStatus={tournament.phaseStatus}
                            tournamentStatus={tournament.status}
                        />
                    </div>

                    <p className="text-zinc-500 text-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {dateRange}
                    </p>
                </div>

                {/* Position badge */}
                <div className="flex-shrink-0 text-right">
                    {position != null ? (
                        <div className={`text-lg font-bold ${position === 1 ? 'text-yellow-400' :
                            position === 2 ? 'text-zinc-300' :
                                position === 3 ? 'text-orange-400' : 'text-zinc-400'
                            }`}>
                            #{position}
                        </div>
                    ) : (
                        <span className="text-zinc-600 text-xs">No result</span>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-800/60 rounded-lg py-1.5">
                    <p className="text-zinc-500 text-xs">Matches</p>
                    <p className="text-white font-semibold text-sm">{tournament.stats?.matchesPlayed || '—'}</p>
                </div>
                <div className="bg-zinc-800/60 rounded-lg py-1.5">
                    <p className="text-zinc-500 text-xs">Kills</p>
                    <p className="text-cyan-400 font-semibold text-sm">{tournament.stats?.totalKills || '—'}</p>
                </div>
                <div className="bg-zinc-800/60 rounded-lg py-1.5">
                    <p className="text-zinc-500 text-xs">Points</p>
                    <p className="text-purple-400 font-semibold text-sm">{tournament.stats?.totalPoints || '—'}</p>
                </div>
            </div>

            {/* Prize won */}
            {tournament.prizeWon > 0 && (
                <div className="mt-2 text-right text-xs text-green-400 font-medium">
                    Prize: ₹{tournament.prizeWon.toLocaleString()}
                </div>
            )}
        </div>
    );
};

// ─── Load More Button ─────────────────────────────────────────────────────────

const LoadMoreButton = ({ onClick, isLoading, hasNextPage }) => {
    if (!hasNextPage) return null;
    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className="w-full py-2.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
            {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                : <><ChevronDown className="w-4 h-4" /> Load More</>
            }
        </button>
    );
};

// ─── Error State ──────────────────────────────────────────────────────────────

const ErrorState = ({ message = 'Failed to load data' }) => (
    <div className="flex items-center gap-3 text-zinc-500 py-8 justify-center">
        <AlertCircle className="w-5 h-5 text-red-500/60" />
        <p className="text-sm">{message}</p>
    </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ icon: Icon, title, subtitle, cta, onCta }) => (
    <div className="text-center py-12 text-zinc-400">
        <Icon className="w-14 h-14 mx-auto mb-3 opacity-30" />
        <p className="font-medium mb-1">{title}</p>
        {subtitle && <p className="text-sm text-zinc-600 mb-3">{subtitle}</p>}
        {cta && (
            <button onClick={onCta} className="text-cyan-400 hover:text-cyan-300 text-sm">
                {cta}
            </button>
        )}
    </div>
);


// ─── Team Member Avatar ───────────────────────────────────────────────────────

const TeamMemberAvatar = ({ member }) => {
    const [isBroken, setIsBroken] = useState(false);
    const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.username || 'player')}`;

    return (
        <div className="flex flex-col items-center p-2 rounded-lg border border-zinc-800/50 bg-zinc-900/50">
            <img
                src={(!isBroken && member.profilePicture) ? member.profilePicture : fallback}
                alt={member.username}
                className="w-10 h-10 rounded-full border border-zinc-700 mb-1.5 object-cover"
                onError={() => setIsBroken(true)}
            />
            <span className="text-[10px] font-bold text-zinc-400 truncate w-16 text-center">
                {member.username}
            </span>
        </div>
    );
};

const DetailedPlayerProfile = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('overview');
    const [showCopyMessage, setShowCopyMessage] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Fetch player profile data
    const {
        data: playerResp,
        isLoading: playerLoading,
        error: playerError,
    } = useQuery({
        queryKey: ['playerProfile', id],
        queryFn: () => getPlayerById(id),
        enabled: !!id,
    });

    // Use backend structure: playerResp = { player, teamMembers }
    const playerData = playerResp?.player || {};
    const currentTeam = playerData.team || null;
    const teamMembers = playerResp?.teamMembers || [];

    // Match history
    const {
        data: matchPages,
        isLoading: matchesLoading,
        isError: matchesError,
        fetchNextPage: fetchMoreMatches,
        hasNextPage: hasMoreMatches,
        isFetchingNextPage: matchesFetchingMore,
    } = usePlayerMatches(id, 10);

    // Tournament history
    const {
        data: tournamentPages,
        isLoading: tournamentsLoading,
        isError: tournamentsError,
        fetchNextPage: fetchMoreTournaments,
        hasNextPage: hasMoreTournaments,
        isFetchingNextPage: tournamentsFetchingMore,
    } = usePlayerTournaments(id, 5);

    // Flatten pages into lists
    const allMatches = useMemo(
        () => matchPages?.pages?.flatMap(p => p.matches) ?? [],
        [matchPages]
    );
    const allTournaments = useMemo(
        () => tournamentPages?.pages?.flatMap(p => p.tournaments) ?? [],
        [tournamentPages]
    );
    const totalMatches = matchPages?.pages?.[0]?.total ?? 0;
    const totalTournaments = tournamentPages?.pages?.[0]?.total ?? 0;

    useEffect(() => { setImageError(false); }, [playerData?.profilePicture]);

    // Loading and error states
    if (playerLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-[#FF4500]/30 border-t-[#FF4500] rounded-full mx-auto mb-4"></div>
                    <p className="text-zinc-400">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (playerError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <ErrorState message="Error loading profile. Please try again." />
            </div>
        );
    }

    const handleShare = async () => {
        const currentUrl = window.location.href;
        try {
            await navigator.clipboard.writeText(currentUrl);
            setShowCopyMessage(true);
            setTimeout(() => setShowCopyMessage(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getGameColor = () => {
        switch (playerData?.primaryGame) {
            case 'VALO': return 'text-red-400';
            case 'CS2': return 'text-blue-400';
            case 'BGMI': return 'text-yellow-400';
            default: return 'text-zinc-400';
        }
    };

    const tabList = ['overview', 'matches', 'tournaments'];

    return (
        <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4">

                {/* Profile Header (Refined to match AegisMyProfile) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
                    <div className="h-32 bg-gradient-to-r from-[#FF4500]/20 via-purple-600/20 to-pink-600/20" />
                    <div className="px-4 pb-6 md:px-6">
                        <div className="flex flex-col md:flex-row items-center md:items-end md:justify-between -mt-16 md:-mt-16 mb-4">
                            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                                <div className="relative">
                                    {playerData.profilePicture && !imageError ? (
                                        <img
                                            src={playerData.profilePicture}
                                            alt="Profile"
                                            className="w-28 h-28 lg:w-32 lg:h-32 rounded-xl border-4 border-zinc-900 object-cover"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-xl border-4 border-zinc-900 bg-gradient-to-br from-[#FF4500] to-orange-600 flex items-center justify-center">
                                            <Gamepad2 className="w-12 h-12 text-white" />
                                        </div>
                                    )}
                                    {playerData.verified && (
                                        <div className="absolute -bottom-1 -right-1 bg-[#FF4500] p-1.5 rounded-full border-2 border-zinc-900 shadow-lg">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="mb-2 w-full md:w-auto">
                                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-2 md:mb-1">
                                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                                            {playerData.username}
                                        </h1>
                                        {(() => {
                                            const badge = getRatingBadge(playerData.aegisRating);
                                            return (
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${badge.bg} ${badge.border} scale-90 md:scale-100`}>
                                                    <img src={badge.badge} alt={badge.tier} className="w-5 h-5" />
                                                    <span className={`text-sm font-bold ${badge.textClass}`}>{playerData.aegisRating || 1000}</span>
                                                </div>
                                            );
                                        })()}
                                        {playerData.aegisIsProvisional && (
                                            <span className="text-[10px] md:text-xs text-zinc-500 flex items-center gap-1">⏳ Provisional</span>
                                        )}
                                    </div>
                                    <p className="text-zinc-400 text-sm md:text-base">{playerData.realName}</p>
                                    {playerData.gameIds?.find(g => g.isPrimary) && (
                                        <p className="text-[#FF4500] text-xs md:text-sm">@{playerData.gameIds.find(g => g.isPrimary).inGameName}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4 md:mt-0">
                                <button
                                    onClick={handleShare}
                                    className="px-6 py-2.5 bg-[#FF4500] hover:bg-[#FF4500]/90 text-white rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg shadow-[#FF4500]/20"
                                >
                                    <Share2 className="w-4 h-4" />
                                    {showCopyMessage ? 'Copied!' : 'Share Profile'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mb-4">
                            {playerData.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4" />
                                    {playerData.location}
                                </span>
                            )}
                            {playerData.age && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    {playerData.age} years
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                Joined {new Date(playerData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                        </div>

                        <p className="text-zinc-300 mb-4 max-w-3xl">{playerData.bio || 'No bio provided'}</p>

                        <div className="flex flex-wrap gap-2">
                            {playerData.primaryGame && (
                                <span className={`px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-semibold ${getGameColor()}`}>
                                    {playerData.primaryGame}
                                </span>
                            )}
                            {playerData.teamStatus && (
                                <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${playerData.teamStatus === 'looking for a team' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                    playerData.teamStatus === 'in a team' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                        'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                                    }`}>
                                    {playerData.teamStatus}
                                </span>
                            )}
                            {playerData.inGameRole?.map(role => (
                                <span key={role} className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-xs capitalize">
                                    {role}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Gamepad2 className="w-5 h-5 text-purple-400" />
                            </div>
                            <span className="text-zinc-400 text-sm">Total Matches</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{totalMatches || playerData.statistics?.matchesPlayed || 0}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <Trophy className="w-5 h-5 text-amber-400" />
                            </div>
                            <span className="text-zinc-400 text-sm">Tournaments</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{totalTournaments || playerData.statistics?.tournamentsPlayed || 0}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                                <Target className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="text-zinc-400 text-sm">Kills</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{playerData.statistics?.totalKills || 0}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[#FF4500]/10 rounded-lg">
                                {(() => { const b = getRatingBadge(playerData.aegisRating); return <img src={b.badge} alt={b.tier} className="w-5 h-5" />; })()}
                            </div>
                            <span className="text-zinc-400 text-sm">Aegis Rating</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-2xl font-bold" style={{ color: getRatingBadge(playerData.aegisRating).color }}>
                                {playerData.aegisRating || 1000}
                            </div>
                            <span className="text-xs text-zinc-500">{getRatingBadge(playerData.aegisRating).tier}</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6 sticky top-20 z-30 shadow-2xl backdrop-blur-xl bg-zinc-900/80">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5 mask-fade-right">
                        {tabList.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${activeTab === tab
                                    ? 'bg-[#FF4500] text-white shadow-lg shadow-[#FF4500]/20'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'matches' && totalMatches > 0 && (
                                    <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {totalMatches}
                                    </span>
                                )}
                                {tab === 'tournaments' && totalTournaments > 0 && (
                                    <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        {totalTournaments}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <>
                                {/* Current Team */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-[#FF4500]" />
                                        Current Team
                                    </h2>
                                    {currentTeam ? (
                                        <div
                                            onClick={() => navigate(`/team/${currentTeam._id}`)}
                                            className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-6 hover:border-[#FF4500]/50 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-zinc-700 group-hover:border-[#FF4500] transition-all shrink-0">
                                                    {currentTeam.logo ? (
                                                        <img
                                                            src={currentTeam.logo}
                                                            alt={currentTeam.teamName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.target.src = `https://placehold.co/128x128/1a1a1a/71717a?text=${encodeURIComponent(currentTeam.teamTag || currentTeam.teamName || 'T')}`; }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                                                            <Users className="w-8 h-8 text-zinc-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-2xl font-black text-white group-hover:text-[#FF4500] transition-colors">{currentTeam.teamName}</h4>
                                                        <span className="bg-zinc-700 px-2 py-1 rounded text-xs font-bold text-zinc-300">{currentTeam.teamTag}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-4 mt-3">
                                                        <div className="flex items-center gap-1.5 text-sm">
                                                            <Users className="w-4 h-4 text-blue-400" />
                                                            <span className="text-zinc-400">Players:</span>
                                                            <span className="text-white font-bold">{teamMembers.length || 1}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-sm">
                                                            <MapPin className="w-4 h-4 text-green-400" />
                                                            <span className="text-zinc-400">Region:</span>
                                                            <span className="text-white font-bold">{currentTeam.region || 'India'}</span>
                                                        </div>
                                                    </div>
                                                    {/* Team Members Grid */}
                                                    <div className="mt-6 flex flex-wrap gap-3">
                                                        {teamMembers.slice(0, 5).map((member) => (
                                                            <TeamMemberAvatar key={member._id} member={member} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-[#FF4500] transition-colors" />
                                            </div>
                                        </div>
                                    ) : (
                                        <EmptyState icon={Users} title="Free Agent" subtitle="Not currently part of any team" />
                                    )}
                                </div>

                                {/* Social Links (Integrated into Overview) */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Hash className="w-5 h-5 text-cyan-400" />
                                        Social Links
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <SocialLinkCard icon={Hash} platform="Discord" value={playerData.discordTag} color="indigo" />
                                        <SocialLinkCard icon={Instagram} platform="Instagram" value={playerData.instagram} color="pink" />
                                        <SocialLinkCard icon={Youtube} platform="YouTube" value={playerData.youtube} color="red" />
                                        <SocialLinkCard icon={Twitter} platform="Twitter" value={playerData.twitter} color="blue" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* MATCHES TAB */}
                        {activeTab === 'matches' && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                                    <Gamepad2 className="w-5 h-5 text-cyan-400" />
                                    Full Match History
                                </h2>
                                <p className="text-zinc-500 text-sm mb-4">{totalMatches} matches found</p>
                                <div className="space-y-3">
                                    {matchesLoading && allMatches.length === 0 ? (
                                        [1, 2, 3].map(i => <SkeletonCard key={i} rows={2} />)
                                    ) : matchesError ? (
                                        <ErrorState message="Error loading match history" />
                                    ) : allMatches.length > 0 ? (
                                        <>
                                            {allMatches.map(match => <MatchCard key={match._id} match={match} />)}
                                            <LoadMoreButton
                                                onClick={fetchMoreMatches}
                                                isLoading={matchesFetchingMore}
                                                hasNextPage={hasMoreMatches}
                                            />
                                        </>
                                    ) : (
                                        <EmptyState icon={Gamepad2} title="No match history" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TOURNAMENTS TAB */}
                        {activeTab === 'tournaments' && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-400" />
                                    Tournament Career
                                </h2>
                                <p className="text-zinc-500 text-sm mb-4">{totalTournaments} tournaments joined</p>
                                <div className="space-y-3">
                                    {tournamentsLoading && allTournaments.length === 0 ? (
                                        [1, 2].map(i => <SkeletonCard key={i} rows={3} />)
                                    ) : tournamentsError ? (
                                        <ErrorState message="Error loading tournament history" />
                                    ) : allTournaments.length > 0 ? (
                                        <>
                                            {allTournaments.map(t => <TournamentHistoryCard key={t.registrationId} tournament={t} />)}
                                            <LoadMoreButton
                                                onClick={fetchMoreTournaments}
                                                isLoading={tournamentsFetchingMore}
                                                hasNextPage={hasMoreTournaments}
                                            />
                                        </>
                                    ) : (
                                        <EmptyState icon={Trophy} title="No tournament entries" />
                                    )}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-6">
                        {/* Info Block */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                            <h3 className="text-lg font-bold mb-4">Player Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mb-1.5">Game Roles</p>
                                    <div className="flex flex-wrap gap-2">
                                        {playerData.inGameRole?.length > 0 ? playerData.inGameRole.map((role) => (
                                            <span key={role} className="bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded text-cyan-400 text-[10px] font-bold uppercase truncate">
                                                {role}
                                            </span>
                                        )) : <span className="text-zinc-600 text-xs italic">No roles specified</span>}
                                    </div>
                                </div>
                                {playerData.previousTeams?.length > 0 && (
                                    <div>
                                        <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mb-2">Previous Orgs</p>
                                        <div className="space-y-2">
                                            {playerData.previousTeams.map((team, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-zinc-800/50 rounded border border-zinc-700/50">
                                                    <span className="text-zinc-300 font-medium">{team.name}</span>
                                                    <span className="text-zinc-600 font-bold">{new Date(team.startDate).getFullYear()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};

const SocialLinkCard = ({ icon: Icon, platform, value, color }) => {
    const urlPrefixMap = {
        'Instagram': 'https://instagram.com/',
        'Twitter': 'https://twitter.com/',
        'YouTube': 'https://youtube.com/@',
        'Discord': 'https://discord.gg/',
    };

    const cleanValue = value ? String(value).replace(/^@+/, '') : '';
    let finalUrl = value;
    if (value && !String(value).startsWith('http')) {
        const prefix = urlPrefixMap[platform] || 'https://';
        finalUrl = `${prefix}${cleanValue}`;
    }

    return (
        <div className={`p-4 rounded-lg border ${value
            ? `bg-${color}-500/10 border-${color}-500/30`
            : 'bg-zinc-800/50 border-zinc-700'
            }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${value ? `text-${color}-400` : 'text-zinc-500'}`} />
                    <div>
                        <p className="text-white font-medium">{platform}</p>
                        <p className={`text-sm ${value ? `text-${color}-300` : 'text-zinc-500 italic'}`}>
                            {value || 'Not connected'}
                        </p>
                    </div>
                </div>
                {value && (
                    <a
                        href={finalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-4 h-4 text-zinc-400" />
                    </a>
                )}
            </div>
        </div>
    );
};

export default DetailedPlayerProfile;