import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Check, Star, Trophy, Calendar, MapPin, Users, Target, TrendingUp,
    Award, Gamepad2, Settings, Share2, MessageCircle, UserPlus,
    ArrowUp, ArrowDown, Activity, Clock, Zap, Shield, Sword,
    Medal, Crown, ChevronRight, ExternalLink, Hash, Globe, Mail,
    Flame, Timer, Crosshair, Eye, BarChart3, Percent, Sparkles
} from 'lucide-react';
import { FaDiscord, FaTwitch, FaYoutube, FaTwitter } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { getPlayerById } from '../api/players';
import { fetchPlayerMatches } from '../api/playerMatches';


const DetailedPlayerProfile = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('overview');
    const [showCopyMessage, setShowCopyMessage] = useState(false);
    // Matches tab state
    const [matches, setMatches] = useState([]);
    const [matchesSkip, setMatchesSkip] = useState(0);
    const [matchesHasMore, setMatchesHasMore] = useState(true);
    const [matchesLoading, setMatchesLoading] = useState(false);

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
    // Use backend teamMembers array for grid
    const teamMembers = playerResp?.teamMembers || [];

    // Fetch matches when matches tab is activated
    const loadMatches = async (skip = 0, initial = false) => {
        setMatchesLoading(true);
        try {
            const { matches: newMatches, hasMore, nextSkip } = await fetchPlayerMatches({ playerId: id, limit: 5, skip });
            if (initial) {
                setMatches(newMatches);
            } else {
                setMatches(prev => [...prev, ...newMatches]);
            }
            setMatchesSkip(nextSkip);
            setMatchesHasMore(hasMore);
        } catch (err) {
            setMatchesHasMore(false);
        }
        setMatchesLoading(false);
    };

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    useEffect(() => {
        if (activeTab === 'matches' && matches.length === 0 && id) {
            loadMatches(0, true);
        }
        // eslint-disable-next-line
    }, [activeTab, id]);

    // Loading and error states (must be after all hooks)
    if (playerLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="text-xl font-bold">Loading profile...</div>
            </div>
        );
    }
    if (playerError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="text-xl font-bold text-red-500">Error loading profile</div>
            </div>
        );
    }

    // Tournament history - placeholder until API is ready
    const tournamentHistory = playerData.tournaments || [];

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
            case 'VALO': return 'from-red-500 to-orange-500';
            case 'CS2': return 'from-blue-500 to-cyan-500';
            case 'BGMI': return 'from-yellow-500 to-orange-500';
            default: return 'from-zinc-500 to-zinc-600';
        }
    };

    const getStatusDisplay = () => {
        const statusConfig = {
            'in a team': { icon: Shield, text: 'In Team', color: 'from-green-500 to-emerald-500' },
            'looking for a team': { icon: Users, text: 'LFT', color: 'from-blue-500 to-cyan-500' },
            'open for offers': { icon: Star, text: 'Open', color: 'from-purple-500 to-pink-500' }
        };

        const status = statusConfig[playerData?.teamStatus];
        if (!status) return null;

        const Icon = status.icon;
        return (
            <div className={`absolute top-6 right-6 z-10 bg-gradient-to-r ${status.color} px-4 py-2 rounded-full flex items-center gap-2 shadow-lg`}>
                <Icon className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">{status.text}</span>
            </div>
        );
    };

    const tabList = ['overview', 'matches', 'tournaments', 'achievements'];

    return (
        <div className="min-h-screen bg-black text-white font-[Inter] pt-[100px] pb-16 relative overflow-hidden">

            {/* Grid Pattern Background */}
            <div className="absolute inset-0 z-0 opacity-[0.25]">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3f3f46" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-black/40 to-black pointer-events-none"></div>

            <div className="relative z-10 max-w-[1400px] mx-auto px-6">

                {/* Hero Section */}
                <div className="mb-8 bg-zinc-950 border border-zinc-900 rounded-lg overflow-hidden">
                    <div className="relative p-8">

                        {/* Status Badge - Top Right */}
                        {getStatusDisplay()}

                        {/* Verified Badge - Top Left */}
                        {playerData.verified && (
                            <div className="absolute top-6 left-6 flex items-center gap-2 bg-[#FF4500]/10 border border-[#FF4500]/30 rounded-lg px-3 py-2">
                                <Check className="w-4 h-4 text-[#FF4500]" />
                                <span className="text-[#FF4500] text-sm font-semibold">Verified</span>
                            </div>
                        )}

                        <div className="flex flex-col lg:flex-row gap-8 items-start mt-12">

                            {/* Profile Picture */}
                            <div className="relative flex-shrink-0">
                                <img
                                    src={playerData.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerData.username}`}
                                    alt={playerData.inGameName}
                                    className="w-32 h-32 lg:w-40 lg:h-40 rounded-lg object-cover border-2 border-zinc-800 bg-zinc-900"
                                />
                                {playerData.verified && (
                                    <div className="absolute -bottom-2 -right-2 bg-[#FF4500] p-2 rounded-full shadow-lg">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">
                                    {playerData.inGameName || playerData.username}
                                </h1>

                                {playerData.realName && (
                                    <p className="text-xl text-zinc-400 mb-4">{playerData.realName}</p>
                                )}

                                <div className="flex flex-wrap gap-4 text-zinc-500 text-sm mb-6">
                                    {playerData.location && (
                                        <span className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            {playerData.location}
                                        </span>
                                    )}
                                    {playerData.age && (
                                        <span className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            {playerData.age} years
                                        </span>
                                    )}
                                    {playerData.languages?.length > 0 && (
                                        <span className="flex items-center gap-2">
                                            <Globe className="w-4 h-4" />
                                            {playerData.languages.join(', ')}
                                        </span>
                                    )}
                                    {playerData.primaryGame && (
                                        <span className={`flex items-center gap-2 ${getGameColor()}`}>
                                            <Gamepad2 className="w-4 h-4" />
                                            {playerData.primaryGame}
                                        </span>
                                    )}
                                </div>

                                {playerData.bio && (
                                    <p className="text-zinc-400 mb-6 max-w-3xl leading-relaxed">{playerData.bio}</p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-3 relative">
                                    <button
                                        onClick={handleShare}
                                        className="bg-[#FF4500] hover:bg-[#FF4500]/90 text-white px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 text-sm font-semibold"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        Share Profile
                                    </button>
                                    {showCopyMessage && (
                                        <div className="absolute top-full mt-2 left-0 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg animate-fade-in">
                                            Player profile copied!
                                        </div>
                                    )}
                                </div>

                                {/* Social Links */}
                                {(playerData.discordTag || playerData.twitch || playerData.youtube || playerData.twitter) && (
                                    <div className="flex flex-wrap gap-2 mt-6">
                                        {playerData.discordTag && (
                                            <a href={`https://discord.com/users/${playerData.discordTag}`} target="_blank" rel="noopener noreferrer"
                                                className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 rounded-lg px-3 py-2 transition-all flex items-center gap-2 text-xs font-semibold">
                                                <FaDiscord className="w-4 h-4" />
                                                {playerData.discordTag}
                                            </a>
                                        )}
                                        {playerData.twitch && (
                                            <a href={playerData.twitch} target="_blank" rel="noopener noreferrer"
                                                className="bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 rounded-lg px-3 py-2 transition-all flex items-center gap-2 text-xs font-semibold">
                                                <FaTwitch className="w-4 h-4" />
                                                Twitch
                                            </a>
                                        )}
                                        {playerData.youtube && (
                                            <a href={playerData.youtube} target="_blank" rel="noopener noreferrer"
                                                className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg px-3 py-2 transition-all flex items-center gap-2 text-xs font-semibold">
                                                <FaYoutube className="w-4 h-4" />
                                                YouTube
                                            </a>
                                        )}
                                        {playerData.twitter && (
                                            <a href={playerData.twitter} target="_blank" rel="noopener noreferrer"
                                                className="bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 rounded-lg px-3 py-2 transition-all flex items-center gap-2 text-xs font-semibold">
                                                <FaTwitter className="w-4 h-4" />
                                                Twitter
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-r from-[#FF4500] to-orange-500 h-1"></div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 hover:border-purple-500/50 transition-all group">
                        <div className="flex items-center gap-2 mb-2">
                            <Gamepad2 className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Matches</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-400">{playerData.statistics?.matchesPlayed || 0}</div>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 hover:border-amber-500/50 transition-all group">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Tournaments</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-400">{playerData.statistics?.tournamentsPlayed || 0}</div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {tabList.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 font-bold rounded-xl transition-all text-sm whitespace-nowrap ${activeTab === tab
                                ? 'bg-gradient-to-r from-[#FF4500] to-orange-600 text-white shadow-lg shadow-[#FF4500]/50'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Current Team */}
                            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                    <Users className="w-5 h-5 text-[#FF4500]" />
                                    Current Team
                                </h3>
                                {currentTeam ? (
                                    <div
                                        onClick={() => navigate(`/team/${currentTeam._id}`)}
                                        className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 hover:border-[#FF4500]/50 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-zinc-700 group-hover:border-[#FF4500] transition-all shrink-0">
                                                {currentTeam.logo ? (
                                                    <img src={currentTeam.logo} alt={currentTeam.teamName} className="w-full h-full object-cover" />
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
                                                <div className="flex flex-wrap gap-3 mt-3">
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <Users className="w-4 h-4 text-blue-400" />
                                                        <span className="text-zinc-400">Players:</span>
                                                        <span className="text-white font-bold">{teamMembers.length}/5</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <MapPin className="w-4 h-4 text-green-400" />
                                                        <span className="text-zinc-400">Region:</span>
                                                        <span className="text-white font-bold">{currentTeam.region}</span>
                                                    </div>
                                                </div>
                                                {/* Team Members Grid (from backend) */}
                                                <div className="mt-6 grid grid-cols-5 gap-4">
                                                    {teamMembers.map((member, idx) => {
                                                        const isCurrent = member._id === playerData._id;
                                                        const isCaptain = currentTeam.captain && member._id === currentTeam.captain._id;
                                                        return (
                                                            <div key={member._id} className={`flex flex-col items-center ${isCurrent ? 'border-2 border-[#FF4500] bg-zinc-900 shadow-lg scale-105' : 'bg-zinc-800 border border-zinc-700'} rounded-xl p-2 transition-all`}>
                                                                <img
                                                                    src={member.profilePicture}
                                                                    alt={member.inGameName || member.username}
                                                                    className={`w-12 h-12 rounded-full object-cover mb-2 ${isCurrent ? 'border-2 border-[#FF4500]' : ''}`}
                                                                />
                                                                <span className={`text-xs font-bold ${isCurrent ? 'text-[#FF4500]' : 'text-zinc-300'}`}>{member.inGameName || member.username}</span>
                                                                {isCaptain && (
                                                                    <span className="mt-2 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs rounded-full font-extrabold flex items-center gap-2 shadow-lg border-2 border-yellow-500">
                                                                        <Crown className="w-4 h-4 text-black" />
                                                                        CAPTAIN
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-[#FF4500] transition-colors" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 text-center">
                                        <Users className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                                        <p className="text-zinc-500">Not currently in a team</p>
                                    </div>
                                )}

                                {/* Previous Teams */}
                                {playerData.previousTeams?.length > 0 && (
                                    <div className="mt-6">
                                        <h4 className="text-base font-semibold mb-4 text-zinc-400">Previous Teams</h4>
                                        <div className="space-y-3">
                                            {playerData.previousTeams.slice(0, 3).map((prevTeam, idx) => (
                                                <div key={idx} className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-white font-medium text-sm">{prevTeam.name || `Team #${idx + 1}`}</span>
                                                        <span className="text-zinc-500 text-xs">{prevTeam.reason || 'Left'}</span>
                                                    </div>
                                                    {prevTeam.endDate && (
                                                        <span className="text-zinc-600 text-xs">
                                                            Until {new Date(prevTeam.endDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Player Info */}
                            <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-6">Player Info</h3>
                                <div className="space-y-5">
                                    {playerData.inGameRole?.length > 0 && (
                                        <div>
                                            <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-3">Roles</p>
                                            <div className="flex flex-wrap gap-2">
                                                {playerData.inGameRole.map((role, idx) => (
                                                    <span key={idx} className="bg-[#FF4500]/10 border border-[#FF4500]/30 px-3 py-1.5 rounded-lg text-[#FF4500] text-xs font-semibold">
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-3">Member Since</p>
                                        <p className="text-white text-sm font-medium">{new Date(playerData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                                <Gamepad2 className="w-5 h-5 text-[#FF4500]" />
                                Recent Matches
                            </h2>
                            {matchesLoading && matches.length === 0 ? (
                                <div className="text-center py-16">
                                    <Gamepad2 className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                                    <p className="text-zinc-500">Loading matches...</p>
                                </div>
                            ) : matches.length > 0 ? (
                                <>
                                    <div className="space-y-4">
                                        {matches.map((match) => (
                                            <div
                                                key={match._id}
                                                onClick={() => navigate(`/matches/${match._id}`)}
                                                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 hover:border-[#FF4500]/50 transition-all cursor-pointer group"
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h4 className="text-white font-semibold group-hover:text-[#FF4500] transition-colors">{match.tournament?.name || 'Tournament'}</h4>
                                                        <p className="text-zinc-500 text-xs mt-1">{match.map} • {match.time || ''}</p>
                                                    </div>
                                                    {/* You can add more match info here if needed */}
                                                </div>
                                                {/* Add more match stats here if available */}
                                            </div>
                                        ))}
                                    </div>
                                    {matchesHasMore && (
                                        <div className="flex justify-center mt-6">
                                            <button
                                                onClick={() => loadMatches(matchesSkip)}
                                                className="flex items-center gap-2 px-6 py-2 bg-[#FF4500] hover:bg-[#FF4500]/90 text-white rounded-lg font-semibold text-sm shadow-lg disabled:opacity-60"
                                                disabled={matchesLoading}
                                            >
                                                {matchesLoading ? 'Loading...' : 'Load More'}
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <Gamepad2 className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                                    <p className="text-zinc-500">No recent matches found</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tournaments' && (
                        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                                <Trophy className="w-5 h-5 text-[#FF4500]" />
                                Tournament History
                            </h2>
                            {tournamentHistory.length > 0 ? (
                                <div className="space-y-4">
                                    {tournamentHistory.map((tournament) => (
                                        <div
                                            key={tournament._id}
                                            onClick={() => navigate(`/tournament/${tournament._id}`)}
                                            className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 hover:border-[#FF4500]/50 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Trophy className="w-6 h-6 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-white font-semibold group-hover:text-[#FF4500] transition-colors truncate">{tournament.name}</h4>
                                                    <p className="text-zinc-500 text-xs mt-1">
                                                        {new Date(tournament.startDate).toLocaleDateString()} • {tournament.placement || 'Participated'}
                                                    </p>
                                                </div>
                                                {tournament.prize && (
                                                    <div className="text-right">
                                                        <div className="text-green-400 font-bold text-lg">₹{tournament.prize}</div>
                                                        <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">Prize</div>
                                                    </div>
                                                )}
                                                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-[#FF4500] transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <Trophy className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                                    <p className="text-zinc-500">No tournament history found</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'achievements' && (
                        <div className="bg-gradient-to-r from-zinc-900 via-black to-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-8">
                            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-yellow-400" />
                                Career Highlights
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {playerData.achievements?.map((achievement, idx) => {
                                    // Use Trophy icon for all achievements if no icon provided
                                    const Icon = achievement.icon ? achievement.icon : Trophy;
                                    return (
                                        <div key={idx} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 hover:border-[#FF4500]/50 transition-all text-center">
                                            <Icon className="w-8 h-8 text-[#FF4500] mx-auto mb-2" />
                                            <div className="text-2xl font-black text-white mb-1">{achievement.count}</div>
                                            <div className="text-xs text-zinc-400 font-semibold">{achievement.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetailedPlayerProfile;