import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Trophy, Calendar, MapPin, Shield,
  Award, Star, Target, TrendingUp, Share2, MessageCircle,
  Check, Gamepad2, Briefcase, Copy, Twitter, Youtube,
  Twitch, Lock, Edit, UserPlus, Upload,
  Search, X, Send, Crown, AlertCircle, User, Medal
} from 'lucide-react';
import { FaDiscord } from "react-icons/fa";

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

  // Captain functionality states
  const [showEditLogoModal, setShowEditLogoModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [kickPlayerData, setKickPlayerData] = useState(null);

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
          {player.profilePicture ? (
            <img
              src={player.profilePicture}
              alt={player.username}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700"
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
                    {teamData.logo ? (
                      <img
                        src={teamData.logo}
                        alt={teamData.teamName}
                        className="w-24 h-24 rounded-xl object-cover border border-zinc-700"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Shield className="w-12 h-12 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h1 className="text-3xl font-bold text-white">{teamData.teamName}</h1>
                      {teamData.teamTag && (
                        <span className="bg-cyan-500/20 border border-cyan-500/30 rounded-lg px-3 py-1 text-cyan-400 font-bold">
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
                      <div className="bg-zinc-800/30 rounded-lg p-3 mb-4">
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
                      {teamData.socials?.twitch && (
                        <button className="flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-400 hover:bg-purple-600/30 transition-colors text-sm">
                          <Twitch className="w-4 h-4" />
                          Twitch
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6">
          <div className="flex gap-1">
            {['matches', 'tournaments', 'achievements'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-2.5 rounded-lg font-medium transition-colors ${activeTab === tab
                  ? 'bg-cyan-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                {tab === 'matches' ? 'Match History' : tab === 'tournaments' ? 'Tournaments' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === 'matches' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-cyan-400" />
                Recent Match History
              </h2>
              <div className="space-y-3">
                {[
                  { map: 'Erangel', date: '2 days ago', tournament: 'BGMI Pro League', phase: 'Week 4', kills: 18, placement: 1, points: 28, chickenDinner: true },
                  { map: 'Miramar', date: '3 days ago', tournament: 'BGMI Masters', phase: 'Finals', kills: 15, placement: 2, points: 23, chickenDinner: false },
                  { map: 'Sanhok', date: '5 days ago', tournament: 'BMOC', phase: 'Semi-Finals', kills: 12, placement: 8, points: 14, chickenDinner: false },
                  { map: 'Vikendi', date: '1 week ago', tournament: 'Skyesports Championship', phase: 'Grand Finals', kills: 16, placement: 1, points: 26, chickenDinner: true },
                  { map: 'Erangel', date: '1 week ago', tournament: 'ESL India Premiership', phase: 'Playoffs', kills: 9, placement: 12, points: 9, chickenDinner: false },
                  { map: 'Miramar', date: '2 weeks ago', tournament: 'NODWIN Invitational', phase: 'Group Stage', kills: 14, placement: 3, points: 20, chickenDinner: false },
                  { map: 'Sanhok', date: '2 weeks ago', tournament: 'BGMI Masters', phase: 'Qualifiers', kills: 11, placement: 5, points: 15, chickenDinner: false },
                ].map((match, idx) => (
                  <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center font-bold ${match.placement <= 3
                          ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                          : match.placement <= 10
                            ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                            : 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                          }`}>
                          <div className="text-center">
                            <div className="text-xs text-zinc-400">Rank</div>
                            <div className="text-xl">#{match.placement}</div>
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-semibold text-lg">{match.map}</h3>
                            {match.chickenDinner && (
                              <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded border border-amber-500/50">
                                🍗 WINNER
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              {match.tournament}
                            </span>
                            <span>•</span>
                            <span className="text-cyan-400 font-medium">{match.phase}</span>
                            <span>•</span>
                            <span>{match.date}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 text-center">
                        <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-700">
                          <div className="text-xl font-bold text-red-400">{match.kills}</div>
                          <div className="text-xs text-zinc-500">Kills</div>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-700">
                          <div className="text-xl font-bold text-purple-400">#{match.placement}</div>
                          <div className="text-xs text-zinc-500">Position</div>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg px-4 py-2 border border-zinc-700">
                          <div className="text-xl font-bold text-cyan-400">{match.points}</div>
                          <div className="text-xs text-zinc-500">Points</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tournaments' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                Tournament History
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: 'BGMI Masters Series',
                    phase: 'Season 3 Finals',
                    placement: '1st',
                    prize: '₹25,00,000',
                    date: 'Jan 2026',
                    participants: 24,
                    kills: 156,
                    matches: 18,
                    chickenDinners: 7,
                    avgPlacement: 3.2,
                    eliminated: 'Champions'
                  },
                  {
                    name: 'BMOC',
                    phase: 'Grand Finals',
                    placement: '2nd',
                    prize: '₹12,50,000',
                    date: 'Dec 2025',
                    participants: 32,
                    kills: 142,
                    matches: 15,
                    chickenDinners: 5,
                    avgPlacement: 4.1,
                    eliminated: 'Grand Finals'
                  },
                  {
                    name: 'Skyesports Championship',
                    phase: 'Winter Series',
                    placement: '3rd',
                    prize: '₹8,00,000',
                    date: 'Nov 2025',
                    participants: 20,
                    kills: 98,
                    matches: 12,
                    chickenDinners: 3,
                    avgPlacement: 5.8,
                    eliminated: 'Finals'
                  },
                  {
                    name: 'ESL India Premiership',
                    phase: 'Winter Finals',
                    placement: '1st',
                    prize: '₹20,00,000',
                    date: 'Oct 2025',
                    participants: 24,
                    kills: 203,
                    matches: 21,
                    chickenDinners: 9,
                    avgPlacement: 2.8,
                    eliminated: 'Champions'
                  },
                  {
                    name: 'NODWIN Gaming Invitational',
                    phase: 'Playoffs',
                    placement: '4th',
                    prize: '₹4,50,000',
                    date: 'Sep 2025',
                    participants: 16,
                    kills: 87,
                    matches: 10,
                    chickenDinners: 2,
                    avgPlacement: 7.2,
                    eliminated: 'Semi-Finals'
                  },
                  {
                    name: 'Pro League India',
                    phase: 'Stage 2',
                    placement: '2nd',
                    prize: '₹15,00,000',
                    date: 'Aug 2025',
                    participants: 20,
                    kills: 178,
                    matches: 14,
                    chickenDinners: 6,
                    avgPlacement: 3.9,
                    eliminated: 'Finals'
                  },
                ].map((tournament, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-zinc-800/80 to-zinc-800/40 border border-zinc-700 rounded-lg p-5 hover:border-amber-500/50 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg mb-1 group-hover:text-cyan-400 transition-colors">
                          {tournament.name}
                        </h3>
                        <div className="text-sm text-cyan-400 font-medium mb-2">{tournament.phase}</div>
                        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                          <Calendar className="w-4 h-4" />
                          {tournament.date}
                        </div>
                        <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${tournament.eliminated === 'Champions'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                          {tournament.eliminated === 'Champions' ? '🏆 Champions' : `❌ Eliminated: ${tournament.eliminated}`}
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-lg font-bold text-lg ${tournament.placement === '1st'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : tournament.placement === '2nd'
                          ? 'bg-zinc-400/20 text-zinc-300 border border-zinc-400/50'
                          : tournament.placement === '3rd'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        }`}>
                        {tournament.placement}
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 rounded-lg p-3 mb-3 border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-400 text-sm">Prize Money</span>
                        <span className="text-green-400 font-bold text-lg">{tournament.prize}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Participants</span>
                        <span className="text-white font-medium">{tournament.participants} teams</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-700">
                        <div className="text-xl font-bold text-red-400">{tournament.kills}</div>
                        <div className="text-xs text-zinc-500">Kills</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-700">
                        <div className="text-xl font-bold text-amber-400">{tournament.chickenDinners}</div>
                        <div className="text-xs text-zinc-500">Dinners</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center border border-zinc-700">
                        <div className="text-xl font-bold text-cyan-400">{tournament.avgPlacement}</div>
                        <div className="text-xs text-zinc-500">Avg Rank</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-400" />
                Achievements & Awards
              </h2>

              {(!teamData.qualifiedEvents || teamData.qualifiedEvents.length === 0) ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                    <Award className="w-10 h-10 text-zinc-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No achievements yet</h3>
                  <p className="text-zinc-400">Team achievements and awards will be displayed here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamData.qualifiedEvents.map((event, index) => (
                    <div key={index} className="bg-zinc-800/50 border border-amber-500/30 rounded-lg p-4 hover:border-amber-500/50 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{event}</h3>
                          <p className="text-zinc-400 text-sm">Qualified Event</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-zinc-800/50 rounded-xl flex items-center justify-center border border-zinc-700 overflow-hidden">
                      {selectedFile ? (
                        <img
                          src={URL.createObjectURL(selectedFile)}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Upload className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm mb-4">
                      Upload a new logo for your team (PNG, JPG, max 5MB)
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700"
                  />

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowEditLogoModal(false);
                        setSelectedFile(null);
                      }}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogoUpload}
                      disabled={!selectedFile || uploadLogoMutation.isLoading}
                      className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {uploadLogoMutation.isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Logo
                        </>
                      )}
                    </button>
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
                        handlePlayerSearch(e.target.value);
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
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedPlayer?._id === player._id
                          ? 'bg-cyan-500/20 border border-cyan-500/30'
                          : 'bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          {player.profilePicture ? (
                            <img
                              src={player.profilePicture}
                              alt={player.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="text-white font-medium">{player.inGameName || player.username}</div>
                            <div className="text-zinc-400 text-sm">{player.realName}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-400 text-sm font-medium">
                              Rating: {player.aegisRating || 0}
                            </div>
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
      </div>
    </div>
  );
};

export default DetailedTeamInfo;