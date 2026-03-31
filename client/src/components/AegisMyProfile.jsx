import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTeam, usePlayerMatches, usePlayerTournaments } from '../hooks/useProfile';
import { getRatingBadge } from '../utils/aegisRatingUtils';
import {
  User, MapPin, Calendar, Globe, Users, Trophy,
  Gamepad2, Share2, Edit,
  Clock, Medal, ChevronRight, Hash,
  ExternalLink, Check, X, Shield, Eye,
  Sword, Instagram, Twitter, Youtube,
  Loader2, AlertCircle, ChevronDown, Flame, Map
} from 'lucide-react';

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

  const mapImage = MAP_IMAGES[match.map] || ErangelMap;

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
        <img src={mapImage} alt="" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
      </div>

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isWin ? 'bg-yellow-400' : 'bg-zinc-600'}`} />
            <Link
              to={`/tournament/${match.tournament?._id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-white font-medium text-sm truncate hover:text-cyan-400 transition-colors"
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
            <TournamentStatus status={tournament.status} />
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

// ─── Main Component ───────────────────────────────────────────────────────────

const AegisMyProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [teamLogoError, setTeamLogoError] = useState(false);

  const isLoading = !user || !user.username;

  const teamId = user?.team ? (typeof user.team === 'object' ? user.team._id : user.team) : null;

  const { data: team, isLoading: teamLoading } = useTeam(teamId);

  // Match history — only fetch when matches tab is active (or overview) to avoid cold-start delay
  const {
    data: matchPages,
    isLoading: matchesLoading,
    isError: matchesError,
    fetchNextPage: fetchMoreMatches,
    hasNextPage: hasMoreMatches,
    isFetchingNextPage: matchesFetchingMore,
  } = usePlayerMatches(user?._id, 10);

  // Tournament history
  const {
    data: tournamentPages,
    isLoading: tournamentsLoading,
    isError: tournamentsError,
    fetchNextPage: fetchMoreTournaments,
    hasNextPage: hasMoreTournaments,
    isFetchingNextPage: tournamentsFetchingMore,
  } = usePlayerTournaments(user?._id, 5);

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


  useEffect(() => { setImageError(false); }, [user?.profilePicture]);
  useEffect(() => { setTeamLogoError(false); }, [team?.logo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  const userData = {
    realName: user.realName || 'Not provided',
    username: user.username || '',
    primaryGameId: user.gameIds?.find(g => g.isPrimary)?.inGameName || null,
    age: user.age || 'N/A',
    location: user.location || 'Not provided',
    country: user.country || 'Not provided',
    bio: user.bio || 'No bio yet',
    languages: user.languages || [],
    aegisRating: user.aegisRating || 1200,
    verified: user.verified || false,
    joinDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
      month: 'short', year: 'numeric'
    }) : 'Recently',
    primaryGame: user.primaryGame || 'Not selected',
    earnings: user.earnings || 0,
    inGameRole: user.inGameRole || [],
    teamStatus: user.teamStatus || 'Not specified',
    availability: user.availability || 'Not specified',
    discordTag: user.discordTag || '',
    instagram: user?.instagram || '',
    youtube: user.youtube || '',
    profileVisibility: user.profileVisibility || 'public',
    profilePicture: user.profilePicture || null,
    statistics: user.statistics || {
      tournamentsPlayed: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      totalKills: 0,
      winRate: 0,
      averagePlacement: 0,
    }
  };

  const StatBox = ({ icon: Icon, label, value, color = 'cyan' }) => (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 bg-${color}-500/10 rounded-lg`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <span className="text-zinc-400 text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
    </div>
  );


  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-12">

      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-white">Share Your Profile</h2>
            <div className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between mb-4">
              <input
                type="text"
                value={`${window.location.origin}/player/${user.username}`}
                readOnly
                className="bg-transparent text-zinc-300 text-sm w-full outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/player/${user.username}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="ml-3 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.open(`/player/${user.username}`, '_blank')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors"
              >
                Open Profile
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">

        {/* Profile Header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
          <div className="h-32 bg-gradient-to-r from-cyan-600/20 via-purple-600/20 to-pink-600/20" />
          <div className="px-4 pb-6 md:px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-12 md:-mt-16 mb-6">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                <div className="relative">
                  {userData.profilePicture && !imageError ? (
                    <img
                      src={userData.profilePicture}
                      alt="Profile"
                      className="w-24 h-24 md:w-28 md:h-28 rounded-xl border-4 border-zinc-900 object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl border-4 border-zinc-900 bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <User className="w-10 h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  )}
                  {userData.verified && (
                    <div className="absolute -bottom-1 -right-1 bg-cyan-500 p-1.5 rounded-full border-2 border-zinc-900">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="mb-2 w-full md:w-auto">
                  <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-2 md:mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-white break-words">{userData.username}</h1>
                    {(() => {
                      const badge = getRatingBadge(userData.aegisRating);
                      return (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${badge.bg} ${badge.border}`}>
                          <img src={badge.badge} alt={badge.tier} className="w-5 h-5" />
                          <span className={`text-sm font-bold ${badge.textClass}`}>{userData.aegisRating}</span>
                        </div>
                      );
                    })()}
                    {user.aegisIsProvisional && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">⏳ Provisional</span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm md:text-base">{userData.realName}</p>
                  {userData.primaryGameId && (
                    <p className="text-cyan-400 text-sm md:text-base">@{userData.primaryGameId}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-center md:justify-start gap-2 mt-6 md:mt-0">
                <button
                  onClick={() => navigate('/settings')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit Profile</span>
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-sm text-zinc-400 mb-6">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {userData.location}, {userData.country}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {userData.age} years
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Joined {userData.joinDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className={`w-4 h-4 ${userData.profileVisibility === 'public' ? 'text-green-400' : 'text-yellow-400'}`} />
                {userData.profileVisibility}
              </span>
            </div>
            <p className="text-zinc-300 text-center md:text-left mb-6 max-w-2xl">{userData.bio}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              {userData.primaryGame !== 'Not selected' && (
                <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-400 text-xs">
                  {userData.primaryGame}
                </span>
              )}
              {userData.teamStatus !== 'Not specified' && (
                <span className={`px-3 py-1 border rounded-full text-xs ${userData.teamStatus === 'looking for a team' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                    userData.teamStatus === 'in a team' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                      'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                  }`}>
                  {userData.teamStatus}
                </span>
              )}
              {userData.inGameRole.map(role => (
                <span key={role} className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-xs capitalize">
                  {role}
                </span>
              ))}
              {userData.languages.map(lang => (
                <span key={lang} className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 text-xs">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatBox icon={Gamepad2} label="Total Matches" value={totalMatches || userData.statistics.matchesPlayed || 0} color="purple" />
          <StatBox icon={Medal} label="Tournaments" value={totalTournaments || userData.statistics.tournamentsPlayed || 0} color="amber" />
          <StatBox icon={Sword} label="Total Kills" value={userData.statistics.totalKills || 0} color="red" />
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 transition-all hover:bg-zinc-900">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#FF4500]/10 rounded-lg">
                {(() => { const b = getRatingBadge(userData.aegisRating); return <img src={b.badge} alt={b.tier} className="w-5 h-5" />; })()}
              </div>
              <span className="text-zinc-400 text-sm">Aegis Rating</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold" style={{ color: getRatingBadge(userData.aegisRating).color }}>{userData.aegisRating || 1000}</div>
              <span className="text-xs text-zinc-500">{getRatingBadge(userData.aegisRating).tier}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6 sticky top-20 z-30 shadow-2xl backdrop-blur-xl bg-zinc-900/80">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5 mask-fade-right">
            {['overview', 'matches', 'tournaments'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${activeTab === tab
                    ? 'bg-cyan-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {/* Show counts on tabs */}
                {tab === 'matches' && totalMatches > 0 && (
                  <span className="ml-1.5 bg-cyan-500/20 text-cyan-400 text-xs px-1.5 py-0.5 rounded-full">
                    {totalMatches}
                  </span>
                )}
                {tab === 'tournaments' && totalTournaments > 0 && (
                  <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
                    {totalTournaments}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <>
                {/* Team Info (Moved from sidebar) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    Current Team
                  </h3>
                  {team ? (
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-6">
                      <Link to={`/team/${teamId}`} className="block shrink-0">
                        {team.logo && !teamLogoError ? (
                          <img
                            src={team.logo}
                            alt={`${team.teamName} logo`}
                            className="w-24 h-24 rounded-xl object-cover border-2 border-zinc-700 hover:border-cyan-500 transition-all"
                            onError={() => setTeamLogoError(true)}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <span className="text-white font-bold text-2xl">{team.teamName.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                          <h4 className="text-2xl font-black text-white">{team.teamName}</h4>
                          <span className="bg-zinc-700 px-2 py-1 rounded text-xs font-bold text-zinc-300">{team.teamTag}</span>
                        </div>
                        <p className="text-zinc-400 mb-4 max-w-md">{team.bio || 'Representing with pride.'}</p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-zinc-400">Members:</span>
                            <span className="text-white font-bold">{team.players?.length || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-green-400" />
                            <span className="text-zinc-400">Region:</span>
                            <span className="text-white font-bold">{team.region || 'India'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/team/${teamId}`)}
                          className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 mx-auto md:mx-0"
                        >
                          View Team Profile <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Shield}
                      title="No Team"
                      subtitle="You are not currently in a team"
                      cta="Join a Team"
                      onCta={() => navigate('/recruitment')}
                    />
                  )}
                </div>

                {/* Social Links (Integrated into Overview) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Hash className="w-5 h-5 text-cyan-400" />
                    Social Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SocialLinkCard icon={Hash} platform="Discord" value={userData.discordTag} color="indigo" />
                    <SocialLinkCard icon={Twitter} platform="Twitter" value={userData.twitter} color="blue" />
                    <SocialLinkCard icon={Instagram} platform="Instagram" value={userData.instagram} color="pink" />
                    <SocialLinkCard icon={Youtube} platform="YouTube" value={userData.youtube} color="red" />
                  </div>
                </div>
              </>
            )}

            {/* MATCHES TAB */}
            {activeTab === 'matches' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-cyan-400" />
                  Match History
                </h2>
                {totalMatches > 0 && (
                  <p className="text-zinc-500 text-sm mb-4">{totalMatches} matches total</p>
                )}
                <div className="space-y-3">
                  {matchesLoading ? (
                    [1, 2, 3].map(i => <SkeletonCard key={i} rows={2} />)
                  ) : matchesError ? (
                    <ErrorState message="Could not load match history. Please try again." />
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
                    <EmptyState
                      icon={Gamepad2}
                      title="No matches played yet"
                      subtitle="Matches from your tournaments will appear here once results are entered"
                    />
                  )}
                </div>
              </div>
            )}

            {/* TOURNAMENTS TAB */}
            {activeTab === 'tournaments' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Tournament History
                </h2>
                {totalTournaments > 0 && (
                  <p className="text-zinc-500 text-sm mb-4">{totalTournaments} tournaments total</p>
                )}
                <div className="space-y-3">
                  {tournamentsLoading ? (
                    [1, 2].map(i => <SkeletonCard key={i} rows={3} />)
                  ) : tournamentsError ? (
                    <ErrorState message="Could not load tournament history. Please try again." />
                  ) : allTournaments.length > 0 ? (
                    <>
                      {allTournaments.map(t => (
                        <TournamentHistoryCard key={t.registrationId} tournament={t} />
                      ))}
                      <LoadMoreButton
                        onClick={fetchMoreTournaments}
                        isLoading={tournamentsFetchingMore}
                        hasNextPage={hasMoreTournaments}
                      />
                    </>
                  ) : (
                    <EmptyState
                      icon={Trophy}
                      title="No tournaments yet"
                      subtitle="Tournaments your team registers for will appear here"
                      cta="Browse Tournaments"
                      onCta={() => navigate('/tournaments')}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Earnings */}
            {userData.earnings > 0 && (
              <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-800/30 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2 text-green-400">Total Earnings</h3>
                <p className="text-3xl font-bold text-white">₹{userData.earnings.toLocaleString()}</p>
              </div>
            )}
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

export default AegisMyProfile;