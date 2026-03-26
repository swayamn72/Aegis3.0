import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Trophy, Calendar, MapPin, Shield,
  Award, Star, Target, TrendingUp, Share2, MessageCircle,
  Check, Gamepad2, Briefcase, Copy, Twitter, Youtube, Instagram, Lock, Edit, UserPlus, Upload,
  Search, X, Send, Crown, AlertCircle, User, Medal, Globe, Save, ChevronDown, Loader2, Zap
} from 'lucide-react';
import { FaDiscord } from "react-icons/fa";
import axiosInstance from '../utils/axiosConfig';
import { fetchTeamMatches, fetchTeamTournaments } from '../api/teamMatches';
import { teamKeys } from '../hooks/queryKeys';

// Map Images
import ErangelMap from '../assets/mapImages/erangel.jpg';
import MiramarMap from '../assets/mapImages/miramar.webp';
import SanhokMap from '../assets/mapImages/sanhok.webp';
import VikendiMap from '../assets/mapImages/vikendi.jpg';

const MAP_IMAGES = {
  Erangel: ErangelMap,
  Miramar: MiramarMap,
  Sanhok: SanhokMap,
  Vikendi: VikendiMap,
  Livik: ErangelMap,
  Nusa: ErangelMap,
  Rondo: ErangelMap,
};
const API_URL = import.meta.env.VITE_BACKEND_URL;

// Fetch function for team data
const fetchTeamData = async (teamId) => {
  const response = await fetch(`${API_URL}/api/teams/${teamId}`, {
    credentials: 'include',
  });

  if (response.status === 403) {
    const errorData = await response.json();
    throw { isPrivate: true, message: errorData.message || 'This team profile is private' };
  }

  if (!response.ok) {
    throw new Error('Failed to fetch team data');
  }

  return response.json();
};

const DetailedTeamInfo = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('matches');

  // Pagination state for "Load more" — 0 means not triggered yet (uses cache data)
  const [matchPage, setMatchPage] = useState(0);
  const [tournamentPage, setTournamentPage] = useState(0);
  // Accumulated extra items fetched via Load more
  const [extraMatches, setExtraMatches] = useState([]);
  const [extraTournaments, setExtraTournaments] = useState([]);

  // Captain functionality states
  const [showEditLogoModal, setShowEditLogoModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editTeamForm, setEditTeamForm] = useState({
    bio: '',
    socials: { discord: '', twitter: '', instagram: '', youtube: '', website: '' }
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [kickPlayerData, setKickPlayerData] = useState(null);
  const [brokenImages, setBrokenImages] = useState({});

  const handleImageError = (id) => {
    setBrokenImages(prev => ({ ...prev, [id]: true }));
  };

  // TanStack Query: Fetch team data with caching
  const {
    data: teamDataResponse,
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: ['teamData', id],
    queryFn: () => fetchTeamData(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const teamData = teamDataResponse?.team || null;
  const isPrivate = error?.isPrivate || false;

  // Initial data comes FREE from the existing team query — zero extra requests
  const initialMatches     = teamDataResponse?.recentMatches     ?? [];
  const initialOngoing     = teamDataResponse?.ongoingTournaments ?? [];
  const initialTournaments = teamDataResponse?.recentTournaments  ?? [];

  // ── Paginated match query (only fires when user clicks "Load more") ──────────
  const {
    data: moreMatchData,
    isFetching: loadingMoreMatches,
  } = useQuery({
    queryKey: teamKeys.matches(id, matchPage),
    queryFn: () => fetchTeamMatches({ teamId: id, page: matchPage, limit: 10 }),
    enabled: matchPage > 1,          // only runs after first "Load more" click
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      setExtraMatches(prev => [...prev, ...(data?.matches ?? [])]);
    },
  });

  // ── Paginated tournament query (only fires when user clicks "Load more") ─────
  const {
    data: moreTournamentData,
    isFetching: loadingMoreTournaments,
  } = useQuery({
    queryKey: teamKeys.tournaments(id, tournamentPage),
    queryFn: () => fetchTeamTournaments({ teamId: id, page: tournamentPage, limit: 10 }),
    enabled: tournamentPage > 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      setExtraTournaments(prev => [...prev, ...(data?.tournaments ?? [])]);
    },
  });

  const hasMoreMatches     = moreMatchData     ? matchPage     < moreMatchData.totalPages     : true;
  const hasMoreTournaments = moreTournamentData ? tournamentPage < moreTournamentData.totalPages : true;

  const handleLoadMoreMatches = () => {
    const next = matchPage < 2 ? 2 : matchPage + 1;
    setMatchPage(next);
  };

  const handleLoadMoreTournaments = () => {
    const next = tournamentPage < 2 ? 2 : tournamentPage + 1;
    setTournamentPage(next);
  };

  // Check if current user is the captain
  const isCaptain = user && teamData && teamData.captain && user._id === teamData.captain._id;

  // Mutation: Upload Logo
  const uploadLogoMutation = useMutation({
    mutationFn: async (formData) => {
      const response = await fetch(`${API_URL}/api/teams/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update team logo');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Team logo updated successfully!');
      setShowEditLogoModal(false);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['teamData', id] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload logo');
    },
  });

  // Mutation: Edit Team
  const editTeamMutation = useMutation({
    mutationFn: async (formData) => {
      const response = await fetch(`${API_URL}/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update team details');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Team details updated successfully!');
      setShowEditTeamModal(false);
      queryClient.invalidateQueries({ queryKey: ['teamData', id] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update team details');
    },
  });

  const openEditTeamModal = () => {
    setEditTeamForm({
      bio: teamData?.bio || '',
      socials: {
        discord: teamData?.socials?.discord || '',
        twitter: teamData?.socials?.twitter || '',
        instagram: teamData?.socials?.instagram || '',
        youtube: teamData?.socials?.youtube || '',
        website: teamData?.socials?.website || '',
      }
    });
    setShowEditTeamModal(true);
  };

  const handleEditTeamSubmit = (e) => {
    e.preventDefault();
    editTeamMutation.mutate(editTeamForm);
  };

  // Mutation: Send Invitation
  const sendInvitationMutation = useMutation({
    mutationFn: async ({ playerId, message }) => {
      const response = await fetch(`${API_URL}/api/teams/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playerId, message }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send invitation');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Invitation sent successfully!');
      setShowInviteModal(false);
      setSelectedPlayer(null);
      setInviteMessage('');
      setSearchQuery('');
      setSearchResults([]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  // Mutation: Kick Player
  const kickPlayerMutation = useMutation({
    mutationFn: async ({ teamId, playerId }) => {
      const response = await fetch(`${API_URL}/api/teams/${teamId}/players/${playerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to kick player');
      return response.json();
    },
    onSuccess: () => {
      toast.success(`${kickPlayerData.playerUsername} has been kicked from the team`);
      setShowKickConfirm(false);
      setKickPlayerData(null);
      queryClient.invalidateQueries({ queryKey: ['teamData', id] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to kick player');
    },
  });

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('logo', selectedFile);
    uploadLogoMutation.mutate(formData);
  };

  // Handle player search
  const handlePlayerSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/teams/search/${encodeURIComponent(query)}?searchType=players`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.players || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Handle player search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      handlePlayerSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle sending invitation
  const handleSendInvitation = async () => {
    if (!selectedPlayer) {
      toast.error('Please select a player to invite');
      return;
    }

    sendInvitationMutation.mutate({
      playerId: selectedPlayer._id,
      message: inviteMessage || `Join ${teamData.teamName}!`,
    });
  };

  // Handle kick player
  const handleKickPlayer = (teamId, playerId, playerUsername) => {
    setKickPlayerData({ teamId, playerId, playerUsername });
    setShowKickConfirm(true);
  };

  const confirmKickPlayer = () => {
    if (!kickPlayerData) return;
    kickPlayerMutation.mutate({
      teamId: kickPlayerData.teamId,
      playerId: kickPlayerData.playerId,
    });
  };

  // ── Phase Status Pill ────────────────────────────────────────────────────────
  const PhaseStatusPill = ({ phaseStatus, tournamentStatus }) => {
    if (!phaseStatus) {
      const fallbacks = {
        completed:   { cls: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30', text: 'Completed' },
        in_progress: { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25', text: 'Live' },
        cancelled:   { cls: 'bg-red-500/15 text-red-400 border-red-500/25', text: 'Cancelled' },
      };
      const fb = fallbacks[tournamentStatus];
      if (!fb) return null;
      return <span className={`text-xs px-2 py-0.5 rounded-full border ${fb.cls}`}>{fb.text}</span>;
    }
    const styleMap = {
      active:    'bg-green-500/15 text-green-400 border-green-500/25',
      eliminated:'bg-red-500/15 text-red-400 border-red-500/25',
      completed: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
      pending:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
      neutral:   'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
    };
    const iconMap = {
      active:    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />,
      eliminated:<span>✕</span>,
      completed: <span>🏆</span>,
      pending:   <span>⏳</span>,
      neutral:   null,
    };
    const cls = styleMap[phaseStatus.type] || styleMap.neutral;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${cls}`}>
        {iconMap[phaseStatus.type]}
        {phaseStatus.label}
      </span>
    );
  };

  const StatBox = ({ icon: Icon, label, value, color = "cyan" }) => (

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

  const PlayerCard = ({ player, showActions = false }) => (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-cyan-500/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {player.profilePicture && !brokenImages[player._id] ? (
            <img
              src={player.profilePicture}
              alt={player.username}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700"
              onError={() => handleImageError(player._id)}
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-semibold">{player.inGameName || player.username}</span>
              {teamData.captain && teamData.captain._id === player._id && (
                <Crown className="w-4 h-4 text-amber-400" title="Team Captain" />
              )}
              {player.verified && (
                <Shield className="w-4 h-4 text-cyan-400" title="Verified Player" />
              )}
            </div>
            <div className="text-zinc-400 text-sm">{player.realName || player.username}</div>
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div>
            {teamData.captain && teamData.captain._id === player._id ? (
              <span className="text-amber-400 text-xs font-medium px-3 py-1 bg-amber-500/10 rounded-lg">
                Captain
              </span>
            ) : isCaptain && player._id !== user._id ? (
              <button
                onClick={() => handleKickPlayer(teamData._id, player._id, player.username)}
                className="text-red-400 hover:text-red-300 text-xs px-3 py-1 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/30"
              >
                Kick
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <div className="text-xs text-zinc-400 mb-1">Role</div>
          <div className="text-cyan-400 font-medium text-sm">
            {player.inGameRole?.join(', ') || 'Player'}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <div className="text-xs text-zinc-400 mb-1">Rating</div>
          <div className="text-cyan-400 font-medium text-sm">{player.aegisRating || 0}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="text-zinc-400 flex items-center gap-1">
          <Trophy className="w-3 h-3 text-amber-400" />
          {player.tournamentsPlayed || 0} Tournaments
        </div>
        <div className="text-zinc-400 flex items-center gap-1">
          <Target className="w-3 h-3 text-green-400" />
          {player.matchesPlayed || 0} Matches
        </div>
      </div>
    </div>
  );

  const SocialLinkCard = ({ icon: Icon, platform, value, color }) => {
    const colorMap = {
      indigo: { bg: 'bg-indigo-600/20', border: 'border-indigo-500/30', text: 'text-indigo-400', hover: 'hover:bg-indigo-600/30' },
      pink:   { bg: 'bg-pink-600/20',   border: 'border-pink-500/30',   text: 'text-pink-400',   hover: 'hover:bg-pink-600/30'   },
      blue:   { bg: 'bg-blue-600/20',   border: 'border-blue-500/30',   text: 'text-blue-400',   hover: 'hover:bg-blue-600/30'   },
      red:    { bg: 'bg-red-600/20',    border: 'border-red-500/30',    text: 'text-red-400',    hover: 'hover:bg-red-600/30'    },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
      <div className={`${c.bg} border ${c.border} rounded-xl p-5 flex flex-col items-center gap-3 ${value ? c.hover : 'opacity-40 cursor-not-allowed'} transition-colors`}>
        <Icon className={`w-8 h-8 ${c.text}`} />
        <div className="text-center">
          <div className="text-white font-semibold mb-1">{platform}</div>
          {value ? (
            <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
              className={`text-sm ${c.text} hover:underline break-all`}>
              {value}
            </a>
          ) : (
            <span className="text-zinc-600 text-sm">Not linked</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading team information...</p>
        </div>
      </div>
    );
  }

  if (isPrivate) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-zinc-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Private Team Profile</h2>
          <p className="text-zinc-400 mb-6">
            {error?.message || 'This team profile is set to private and can only be viewed by team members.'}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isError && !isPrivate) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Failed to load team data</h2>
          <p className="text-red-400">{error?.message || 'Unknown error occurred'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['teamData', id] })}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
        <div className="text-center">
          <p className="text-zinc-400 text-lg">Team not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-300" />
            </button>
            <div>
              <h1 className="text-4xl font-bold">Team Profile</h1>
              <p className="text-zinc-400">Professional Esports Team</p>
            </div>
          </div>

          {/* Captain Actions */}
          {isCaptain && (
            <div className="flex gap-3">
              <button
                onClick={openEditTeamModal}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors flex items-center gap-2"
                title="Edit Team Details"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit Details</span>
              </button>
              <button
                onClick={() => setShowEditLogoModal(true)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors flex items-center gap-2"
                title="Edit Team Logo"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit Logo</span>
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors flex items-center gap-2"
                title="Invite Players"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Invite Player</span>
              </button>
            </div>
          )}
        </div>

        {/* Team Header Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-8">
          {/* Banner/Accent */}
          <div className="bg-gradient-to-r from-cyan-600/20 to-purple-600/20 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">TEAM PROFILE</span>
            </div>
            {teamData.verified && (
              <div className="flex items-center gap-2 text-cyan-400 text-sm">
                <Shield className="w-4 h-4" />
                <span>Verified</span>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Side - Team Info */}
              <div className="flex-1">
                <div className="flex items-start gap-6 mb-6">
                  <div className="relative">
                    {teamData.logo && !brokenImages['team-logo'] ? (
                      <img
                        src={teamData.logo}
                        alt={teamData.teamName}
                        className="w-24 h-24 rounded-xl object-cover border border-zinc-700"
                        onError={() => handleImageError('team-logo')}
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Shield className="w-12 h-12 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full md:w-auto text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center gap-3 mb-4 md:mb-3">
                      <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-0">{teamData.teamName}</h1>
                      {teamData.teamTag && (
                        <span className="bg-cyan-500/20 border border-cyan-500/30 rounded-lg px-3 py-1 text-cyan-400 font-bold text-sm md:text-base">
                          [{teamData.teamTag}]
                        </span>
                      )}
                    </div>

                    {/* Team Meta Info */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Gamepad2 className="w-4 h-4 text-blue-400" />
                          <span className="text-zinc-400 text-xs">GAME</span>
                        </div>
                        <span className="text-white font-medium text-sm">{teamData.primaryGame}</span>
                      </div>

                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-green-400" />
                          <span className="text-zinc-400 text-xs">MEMBERS</span>
                        </div>
                        <span className="text-white font-medium text-sm">{teamData.players?.length || 0}/5</span>
                      </div>

                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Crown className="w-4 h-4 text-amber-400" />
                          <span className="text-zinc-400 text-xs">CAPTAIN</span>
                        </div>
                        <span className="text-white font-medium text-sm truncate">
                          {teamData.captain?.username || 'TBD'}
                        </span>
                      </div>

                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span className="text-zinc-400 text-xs">REGION</span>
                        </div>
                        <span className="text-white font-medium text-sm">{teamData.region || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Bio */}
                    {teamData.bio && (
                      <div className="bg-zinc-800/30 rounded-lg p-3 mb-4 max-w-2xl mx-auto md:mx-0">
                        <p className="text-zinc-300 text-sm">{teamData.bio}</p>
                      </div>
                    )}

                    {/* Social Links */}
                    <div className="flex flex-wrap gap-2">
                      {teamData.socials?.discord && (
                        <button className="flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg px-3 py-2 text-indigo-400 hover:bg-indigo-600/30 transition-colors text-sm">
                          <FaDiscord className="w-4 h-4" />
                          Discord
                        </button>
                      )}
                      {teamData.socials?.twitter && (
                        <button className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-lg px-3 py-2 text-blue-400 hover:bg-blue-600/30 transition-colors text-sm">
                          <Twitter className="w-4 h-4" />
                          Twitter
                        </button>
                      )}
                      {teamData.socials?.youtube && (
                        <button className="flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 hover:bg-red-600/30 transition-colors text-sm">
                          <Youtube className="w-4 h-4" />
                          YouTube
                        </button>
                      )}
                      {teamData.socials?.instagram && (
                        <button className="flex items-center gap-2 bg-pink-600/20 border border-pink-500/30 rounded-lg px-3 py-2 text-pink-400 hover:bg-pink-600/30 transition-colors text-sm">
                          <Instagram className="w-4 h-4" />
                          Instagram
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Stats */}
              <div className="lg:w-80">
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Award className="w-5 h-5 text-cyan-400" />
                    Team Overview
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Established</span>
                      <span className="text-white font-medium">
                        {new Date(teamData.establishedDate).getFullYear()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Roster Size</span>
                      <span className="text-cyan-400 font-medium">
                        {teamData.players?.length || 0}/5
                      </span>
                    </div>
                    {teamData.organization && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Organization</span>
                        <span className="text-blue-400 font-medium">
                          {teamData.organization.orgName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 hover:border-blue-500/50 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/30 group-hover:bg-blue-500/20 transition-colors">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{teamData.players?.length || 0}</div>
                </div>
                <div className="text-sm text-zinc-400">Active Players</div>
                <div className="mt-2 text-xs text-blue-400">{5 - (teamData.players?.length || 0)} slots open</div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 hover:border-green-500/50 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center border border-green-500/30 group-hover:bg-green-500/20 transition-colors">
                    <Target className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{teamData.matchesWon || 0}</div>
                </div>
                <div className="text-sm text-zinc-400">Matches Won</div>
                <div className="mt-2 text-xs text-green-400">
                  {teamData.matchesPlayed ? Math.round((teamData.matchesWon || 0) / teamData.matchesPlayed * 100) : 0}% win rate
                </div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 hover:border-amber-500/50 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/30 group-hover:bg-amber-500/20 transition-colors">
                    <Trophy className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{teamData.tournamentsWon || 0}</div>
                </div>
                <div className="text-sm text-zinc-400">Tournaments Won</div>
                <div className="mt-2 text-xs text-amber-400">{teamData.tournamentsPlayed || 0} participated</div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Roster - Always Visible */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-400" />
              Current Roster ({teamData.players?.length || 0}/5)
            </h2>
            {isCaptain && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Invite Player
              </button>
            )}
          </div>

          {(!teamData.players || teamData.players.length === 0) ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                <Users className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No roster information available</h3>
              <p className="text-zinc-400">Team roster will be displayed here once available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamData.players.map(player => (
                <PlayerCard key={player._id} player={player} showActions={true} />
              ))}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6 sticky top-20 z-30 shadow-2xl backdrop-blur-xl bg-zinc-900/80">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5 mask-fade-right">
            {['matches', 'tournaments', 'social'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 md:px-6 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === tab
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                {tab === 'matches' ? 'Match History' : tab === 'tournaments' ? 'Tournaments' : 'Social'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === 'matches' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Target className="w-6 h-6 text-cyan-400" />
                  Match History
                </h2>
                <span className="text-zinc-500 text-sm">{initialMatches.length + extraMatches.length} matches</span>
              </div>

              {/* Empty state */}
              {initialMatches.length === 0 && extraMatches.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                    <Target className="w-10 h-10 text-zinc-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Matches Yet</h3>
                  <p className="text-zinc-400">This team hasn't played any recorded matches yet.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {[...initialMatches, ...extraMatches].map((match, idx) => {
                      const pos = match.position;
                      const placementColor = pos <= 3
                        ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                        : pos <= 10
                          ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                          : 'bg-red-500/20 text-red-400 border-2 border-red-500/50';
                      const matchDate = match.date
                        ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(match.date))
                        : '—';
                      const tournamentName = match.tournament?.tournamentName || match.tournament?.shortName || '—';
                      return (
                        <div key={match._id ?? idx} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`w-16 h-16 rounded-lg flex items-center justify-center font-bold flex-shrink-0 relative overflow-hidden ${pos ? placementColor : 'bg-zinc-700/50 text-zinc-400 border-2 border-zinc-600'}`}>
                                <img 
                                  src={MAP_IMAGES[match.map] || ErangelMap} 
                                  alt={match.map} 
                                  className="absolute inset-0 w-full h-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-110"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                                <div className="relative z-10 text-center">
                                  <div className={`text-[10px] uppercase tracking-tighter leading-none mb-1 ${pos ? 'text-white' : 'text-zinc-400'}`}>Rank</div>
                                  <div className="text-xl leading-none">{pos ? `#${pos}` : '—'}</div>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="text-white font-semibold text-lg">{match.map || 'Unknown Map'}</h3>
                                  {match.matchType && (
                                    <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded border border-cyan-500/20">
                                      {match.matchType}
                                    </span>
                                  )}
                                  {match.chickenDinner && (
                                    <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded border border-amber-500/50">
                                      🍗 WINNER
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-zinc-400 flex-wrap">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    {match.tournament?.media?.logo ? (
                                      <img 
                                        src={match.tournament.media.logo} 
                                        alt={tournamentName}
                                        className="w-4 h-4 rounded-sm object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <Trophy className="w-3 h-3 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{tournamentName}</span>
                                  </span>
                                  <span>•</span>
                                  <span>{matchDate}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3 text-center flex-shrink-0">
                              <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-700">
                                <div className="text-xl font-bold text-red-400">{match.kills ?? 0}</div>
                                <div className="text-xs text-zinc-500">Kills</div>
                              </div>
                              {pos && (
                                <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-700">
                                  <div className="text-xl font-bold text-purple-400">#{pos}</div>
                                  <div className="text-xs text-zinc-500">Position</div>
                                </div>
                              )}
                              <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-700">
                                <div className="text-xl font-bold text-cyan-400">{match.points ?? 0}</div>
                                <div className="text-xs text-zinc-500">Points</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load more */}
                  {(hasMoreMatches || loadingMoreMatches) && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={handleLoadMoreMatches}
                        disabled={loadingMoreMatches}
                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                      >
                        {loadingMoreMatches
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
                          : <><ChevronDown className="w-4 h-4" />Load more matches</>}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'tournaments' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  Tournament History
                </h2>
                <span className="text-zinc-500 text-sm">
                  {initialOngoing.length + initialTournaments.length + extraTournaments.length} tournaments
                </span>
              </div>

              {/* Empty state */}
              {initialOngoing.length === 0 && initialTournaments.length === 0 && extraTournaments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-zinc-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Tournaments Yet</h3>
                  <p className="text-zinc-400">This team hasn't participated in any tournaments yet.</p>
                </div>
              ) : (
                <>
                  {/* Ongoing tournaments */}
                  {initialOngoing.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">Currently Active</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {initialOngoing.map((t, idx) => {
                          const startDate = t.startDate ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(t.startDate)) : '—';
                          return (
                            <div key={t._id ?? idx} className="bg-gradient-to-br from-green-900/20 to-zinc-800/40 border border-green-700/40 rounded-lg p-5 hover:border-green-500/50 transition-all group">
                              <div className="flex items-start justify-between mb-3">
                              <div className="flex gap-4">
                                {t.media?.logo ? (
                                  <div className="flex-shrink-0">
                                    <img 
                                      src={t.media.logo} 
                                      alt={t.tournamentName}
                                      className="w-16 h-16 rounded-lg object-cover border border-zinc-700/50 shadow-lg group-hover:border-green-500/30 transition-colors"
                                      onError={(e) => { e.target.src = '/default-tournament.png'; e.target.onerror = null; }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-8 h-8 text-zinc-600" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                      LIVE
                                    </span>
                                    {t.phaseStatus && (
                                      <PhaseStatusPill phaseStatus={t.phaseStatus} tournamentStatus={t.status} />
                                    )}
                                  </div>
                                  <h3 className="text-white font-bold text-lg group-hover:text-cyan-400 transition-colors truncate">
                                    {t.tournamentName || t.shortName || 'Tournament'}
                                  </h3>
                                  {t.shortName && t.shortName !== t.tournamentName && (
                                    <div className="text-sm text-cyan-400 font-medium">{t.shortName}</div>
                                  )}
                                  <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                                    <Calendar className="w-3 h-3" />
                                    Started {startDate}
                                  </div>
                                </div>
                              </div>
                                {t.tier && (
                                  <span className="text-xs font-bold px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 ml-2 flex-shrink-0">
                                    {t.tier}
                                  </span>
                                )}
                              </div>
                              {t.prizePool?.totalPrizePool > 0 && (
                                <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-700">
                                  <div className="text-xs text-zinc-400 mb-0.5">Prize Pool</div>
                                  <div className="text-green-400 font-bold">₹{t.prizePool.totalPrizePool.toLocaleString('en-IN')}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Past tournaments */}
                  {(initialTournaments.length > 0 || extraTournaments.length > 0) && (
                    <div>
                      {initialOngoing.length > 0 && (
                        <div className="flex items-center gap-2 mb-4">
                          <Trophy className="w-4 h-4 text-zinc-500" />
                          <span className="text-zinc-500 text-sm font-semibold uppercase tracking-wider">Past Tournaments</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...initialTournaments, ...extraTournaments].map((t, idx) => {
                          const endDate = t.endDate ? new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(t.endDate)) : '—';
                          return (
                            <div key={t._id ?? idx} className="bg-gradient-to-br from-zinc-800/80 to-zinc-800/40 border border-zinc-700 rounded-lg p-5 hover:border-amber-500/50 transition-all group">
                              <div className="flex items-start justify-between mb-3">
                              <div className="flex gap-4">
                                {t.media?.logo ? (
                                  <div className="flex-shrink-0">
                                    <img 
                                      src={t.media.logo} 
                                      alt={t.tournamentName}
                                      className="w-16 h-16 rounded-lg object-cover border border-zinc-700/50 shadow-lg group-hover:border-amber-500/30 transition-colors"
                                      onError={(e) => { e.target.src = '/default-tournament.png'; e.target.onerror = null; }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-8 h-8 text-zinc-600" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-white font-bold text-lg mb-1 group-hover:text-cyan-400 transition-colors truncate">
                                    {t.tournamentName || t.shortName || 'Tournament'}
                                  </h3>
                                  {t.shortName && t.shortName !== t.tournamentName && (
                                    <div className="text-sm text-cyan-400 font-medium mb-1">{t.shortName}</div>
                                  )}
                                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                                    <Calendar className="w-3 h-3" />
                                    {endDate}
                                  </div>
                                </div>
                              </div>
                                <div className="flex flex-col items-end gap-2 ml-2 flex-shrink-0">
                                  {t.tier && (
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                      {t.tier}
                                    </span>
                                  )}
                                  <PhaseStatusPill phaseStatus={t.phaseStatus} tournamentStatus={t.status} />
                                </div>
                              </div>

                              {t.prizePool?.totalPrizePool > 0 && (
                                <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-zinc-400 text-sm">Prize Pool</span>
                                    <span className="text-green-400 font-bold">₹{t.prizePool.totalPrizePool.toLocaleString('en-IN')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Load more */}
                  {(hasMoreTournaments || loadingMoreTournaments) && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={handleLoadMoreTournaments}
                        disabled={loadingMoreTournaments}
                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                      >
                        {loadingMoreTournaments
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
                          : <><ChevronDown className="w-4 h-4" />Load more tournaments</>}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'social' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                Social Media & Community
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SocialLinkCard 
                  icon={FaDiscord} 
                  platform="Discord" 
                  value={teamData.socials?.discord} 
                  color="indigo" 
                />
                <SocialLinkCard 
                  icon={Instagram} 
                  platform="Instagram" 
                  value={teamData.socials?.instagram} 
                  color="pink" 
                />
                <SocialLinkCard 
                  icon={Twitter} 
                  platform="Twitter" 
                  value={teamData.socials?.twitter} 
                  color="blue" 
                />
                <SocialLinkCard 
                  icon={Youtube} 
                  platform="YouTube" 
                  value={teamData.socials?.youtube} 
                  color="red" 
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Section */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium px-8 py-3 rounded-lg transition-colors flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Contact Team
          </button>
          <button className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-8 py-3 rounded-lg transition-colors border border-zinc-700 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Follow Team
          </button>
          <button className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-6 py-3 rounded-lg transition-colors border border-zinc-700 flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Team URL copied to clipboard!');
            }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-6 py-3 rounded-lg transition-colors border border-zinc-700 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy URL
          </button>
        </div>

        {/* Edit Logo Modal */}
        {showEditLogoModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Edit Team Logo</h3>
                  <button
                    onClick={() => {
                      setShowEditLogoModal(false);
                      setSelectedFile(null);
                    }}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden mb-4 border border-zinc-700">
                      {selectedFile ? (
                        <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-12 h-12 text-zinc-600" />
                      )}
                    </div>
                    <input
                      type="file"
                      id="team-logo-edit-input"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="hidden"
                    />
                    <label
                      htmlFor="team-logo-edit-input"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg cursor-pointer transition-all active:scale-95 mb-6"
                    >
                      <Upload className="w-4 h-4" />
                      {selectedFile ? 'Change Image' : 'Select Image'}
                    </label>
                    
                    {selectedFile && (
                      <div className="w-full flex gap-3">
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => {
                            const formData = new FormData();
                            formData.append('logo', selectedFile);
                            uploadLogoMutation.mutate(formData, {
                              onSuccess: () => {
                                setSelectedFile(null);
                                setShowEditLogoModal(false);
                              }
                            });
                          }}
                          disabled={uploadLogoMutation.isLoading}
                          className="flex-[2] py-3 bg-zinc-100 hover:bg-white text-black font-bold rounded-lg transition-all disabled:opacity-50"
                        >
                          {uploadLogoMutation.isLoading ? 'Uploading...' : 'Confirm Upload'}
                        </button>
                      </div>
                    )}

                    {!selectedFile && (
                      <button
                        onClick={() => setShowEditLogoModal(false)}
                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invite Players Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Invite Players</h3>
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      setSelectedPlayer(null);
                      setInviteMessage('');
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search players by username or name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:border-cyan-500 focus:outline-none"
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {searchResults.map(player => (
                      <div
                        key={player._id}
                        onClick={() => setSelectedPlayer(player)}
                        className={`p-3 rounded-lg cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${selectedPlayer?._id === player._id
                          ? 'bg-cyan-500/20 border border-cyan-500/50 ring-1 ring-cyan-500/30'
                          : 'bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-500'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {player.profilePicture && !brokenImages[`search-${player._id}`] ? (
                              <img
                                src={player.profilePicture}
                                alt={player.username}
                                className="w-12 h-12 rounded-full object-cover border-2 border-zinc-700"
                                onError={() => handleImageError(`search-${player._id}`)}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center border-2 border-zinc-700">
                                <User className="w-6 h-6 text-white" />
                              </div>
                            )}
                            {player.verified && (
                              <div className="absolute -bottom-1 -right-1 bg-zinc-900 rounded-full p-0.5">
                                <Shield className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-white font-semibold truncate">{player.inGameName || player.username}</div>
                              {player.aegisRating >= 1500 && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                                  PRO
                                </span>
                              )}
                            </div>
                            <div className="text-zinc-500 text-sm truncate">{player.realName || `@${player.username}`}</div>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <div className="text-cyan-400 text-sm font-bold">
                              {player.aegisRating || 0}
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Rating</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {searchQuery && searchResults.length === 0 && !searching && (
                      <div className="text-center py-8 text-zinc-400">
                        No players found matching "{searchQuery}"
                      </div>
                    )}
                    {!searchQuery && (
                      <div className="text-center py-8 text-zinc-400">
                        Start typing to search for players
                      </div>
                    )}
                  </div>

                  {selectedPlayer && (
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-3">Invitation Details</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-zinc-400 text-sm mb-1">Inviting:</label>
                          <div className="text-white font-medium">{selectedPlayer.inGameName || selectedPlayer.username}</div>
                        </div>
                        <div>
                          <label className="block text-zinc-400 text-sm mb-1">Custom Message (Optional):</label>
                          <textarea
                            value={inviteMessage}
                            onChange={(e) => setInviteMessage(e.target.value)}
                            placeholder={`Join ${teamData.teamName}!`}
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:border-cyan-500 focus:outline-none resize-none"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowInviteModal(false);
                        setSelectedPlayer(null);
                        setInviteMessage('');
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendInvitation}
                      disabled={!selectedPlayer || sendInvitationMutation.isLoading}
                      className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {sendInvitationMutation.isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Invitation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kick Player Confirmation Modal */}
        {showKickConfirm && kickPlayerData && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <h2 className="text-xl font-bold">Kick Player</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowKickConfirm(false);
                      setKickPlayerData(null);
                    }}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">
                      Are you sure you want to kick <span className="font-bold text-white">{kickPlayerData.playerUsername}</span> from the team?
                      This action cannot be undone.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowKickConfirm(false);
                        setKickPlayerData(null);
                      }}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmKickPlayer}
                      disabled={kickPlayerMutation.isLoading}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {kickPlayerMutation.isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Kicking...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          Kick Player
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Team Modal */}
        {showEditTeamModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
                <div className="flex items-center gap-3">
                  <Edit className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-xl font-bold">Edit Team Details</h2>
                </div>
                <button onClick={() => setShowEditTeamModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleEditTeamSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-zinc-300 text-sm font-medium mb-2">Team Bio</label>
                  <textarea
                    value={editTeamForm.bio}
                    onChange={(e) => setEditTeamForm(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                    placeholder="Tell us about your team..."
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-zinc-500 text-xs mt-1">{editTeamForm.bio.length}/500</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-cyan-400" />
                    Social Links
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1 flex items-center gap-2">
                        <FaDiscord className="w-4 h-4 text-indigo-400" /> Discord
                      </label>
                      <input type="text" value={editTeamForm.socials.discord} onChange={(e) => setEditTeamForm(prev => ({ ...prev, socials: { ...prev.socials, discord: e.target.value } }))} placeholder="Discord Server URL" className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1 flex items-center gap-2">
                        <Twitter className="w-4 h-4 text-blue-400" /> Twitter
                      </label>
                      <input type="text" value={editTeamForm.socials.twitter} onChange={(e) => setEditTeamForm(prev => ({ ...prev, socials: { ...prev.socials, twitter: e.target.value } }))} placeholder="Twitter Profile URL" className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1 flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-pink-400" /> Instagram
                      </label>
                      <input type="text" value={editTeamForm.socials.instagram} onChange={(e) => setEditTeamForm(prev => ({ ...prev, socials: { ...prev.socials, instagram: e.target.value } }))} placeholder="Instagram Profile URL" className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500" />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1 flex items-center gap-2">
                        <Youtube className="w-4 h-4 text-red-400" /> YouTube
                      </label>
                      <input type="text" value={editTeamForm.socials.youtube} onChange={(e) => setEditTeamForm(prev => ({ ...prev, socials: { ...prev.socials, youtube: e.target.value } }))} placeholder="YouTube Channel URL" className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-zinc-400 text-sm mb-1 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-zinc-400" /> Website
                      </label>
                      <input type="text" value={editTeamForm.socials.website} onChange={(e) => setEditTeamForm(prev => ({ ...prev, socials: { ...prev.socials, website: e.target.value } }))} placeholder="Team Website URL" className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-500" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-zinc-800">
                  <button type="button" onClick={() => setShowEditTeamModal(false)} className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={editTeamMutation.isLoading} className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                    {editTeamMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editTeamMutation.isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedTeamInfo;