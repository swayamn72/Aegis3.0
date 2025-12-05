import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users, AlertCircle, Crown, History, Star, MapPin, Calendar,
    Trophy, Target, Zap, TrendingUp, Award, Shield, Plus,
    MessageCircle, ChevronRight, Medal, Activity, BarChart3,
    Gamepad2, X, Check, RefreshCw, User
} from 'lucide-react';

const API_URL = import.meta.env.VITE_BACKEND_URL;

// Fetch functions for TanStack Query
const fetchTeamData = async (teamId) => {
    const response = await fetch(`${API_URL}/api/teams/${teamId}`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch team data');
    return response.json();
};

const fetchTeamInvitations = async () => {
    const response = await fetch(`${API_URL}/api/teams/invitations/received`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch invitations');
    const data = await response.json();
    return data.invitations || [];
};

const MyTeams = () => {
    const { user, loading: authLoading, refreshUser } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState('current');
    const [showInvitations, setShowInvitations] = useState(false);
    const [invitationsData, setInvitationsData] = useState([]);
    const [loadingInvitations, setLoadingInvitations] = useState(false);

    const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
    const [createTeamForm, setCreateTeamForm] = useState({
        teamName: '',
        teamTag: '',
        primaryGame: 'BGMI', // ✅ Fixed to BGMI - not user selectable
        region: 'India', // ✅ Fixed to India - not user selectable
        bio: '',
        logo: ''
    });
    const [createTeamError, setCreateTeamError] = useState('');

    const [showKickConfirm, setShowKickConfirm] = useState(false);
    const [kickPlayerData, setKickPlayerData] = useState(null);

    // TanStack Query: Fetch team data
    const {
        data: teamDataResponse,
        isLoading: teamLoading,
        isError: teamError,
        error: teamErrorDetails,
    } = useQuery({
        queryKey: ['teamData', user?.team?._id || user?.team],
        queryFn: () => fetchTeamData(user.team._id || user.team),
        enabled: !!user?.team && !authLoading,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    // Manual fetch for invitations
    const handleRefreshInvitations = async () => {
        setLoadingInvitations(true);
        try {
            const data = await fetchTeamInvitations();
            setInvitationsData(data);
            setShowInvitations(true);
            toast.success('Invitations refreshed!');
        } catch (error) {
            toast.error('Failed to fetch invitations');
            console.error(error);
        } finally {
            setLoadingInvitations(false);
        }
    };

    // Extract team data with fallbacks
    const teamData = teamDataResponse?.team || null;

    // Mutation: Create Team
    const createTeamMutation = useMutation({
        mutationFn: async (teamData) => {
            const response = await fetch(`${API_URL}/api/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(teamData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create team');
            }
            return response.json();
        },
        onSuccess: async (data) => {
            toast.success(`Team "${data.team.teamName}" created successfully! 🎉`);
            setShowCreateTeamModal(false);
            setCreateTeamForm({ teamName: '', teamTag: '', primaryGame: 'BGMI', region: 'India', bio: '', logo: '' });
            await refreshUser();
            queryClient.invalidateQueries(['teamData']);
            navigate(`/team/${data.team._id}`);
        },
        onError: (error) => {
            setCreateTeamError(error.message);
        },
    });

    // Mutation: Accept Invitation
    const acceptInvitationMutation = useMutation({
        mutationFn: async (invitationId) => {
            const response = await fetch(`${API_URL}/api/teams/invitations/${invitationId}/accept`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to accept invitation');
            return response.json();
        },
        onSuccess: async () => {
            toast.success('Invitation accepted successfully!');
            await refreshUser();
            queryClient.invalidateQueries({ queryKey: ['teamData'] });
            handleRefreshInvitations();
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to accept invitation');
        },
    });

    // Mutation: Decline Invitation
    const declineInvitationMutation = useMutation({
        mutationFn: async (invitationId) => {
            const response = await fetch(`${API_URL}/api/teams/invitations/${invitationId}/decline`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to decline invitation');
            return response.json();
        },
        onSuccess: () => {
            toast.success('Invitation declined');
            handleRefreshInvitations();
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to decline invitation');
        },
    });

    // Mutation: Kick Player (updated to use correct DELETE endpoint)
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
            queryClient.invalidateQueries({ queryKey: ['teamData'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to kick player');
        },
    });

    // Mutation: Leave Team (updated to use correct DELETE endpoint)
    const leaveTeamMutation = useMutation({
        mutationFn: async ({ teamId, playerId }) => {
            const response = await fetch(`${API_URL}/api/teams/${teamId}/players/${playerId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to leave team');
            return response.json();
        },
        onSuccess: async () => {
            toast.success('You have left the team');
            await refreshUser();
            queryClient.invalidateQueries({ queryKey: ['teamData'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to leave team');
        },
    });

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        if (!createTeamForm.teamName.trim()) {
            setCreateTeamError('Team name is required');
            return;
        }
        const captainId = user?._id || user?.id;
        if (!captainId) {
            setCreateTeamError('User not authenticated');
            return;
        }
        setCreateTeamError('');
        createTeamMutation.mutate(createTeamForm);
    };

    const handleAcceptInvitation = (invitationId) => {
        acceptInvitationMutation.mutate(invitationId);
    };

    const handleDeclineInvitation = (invitationId) => {
        declineInvitationMutation.mutate(invitationId);
    };

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

    const handleLeaveTeam = (teamId) => {
        if (window.confirm('Are you sure you want to leave this team?')) {
            leaveTeamMutation.mutate({ teamId, playerId: user?.id });
        }
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

    const renderTeamCard = (team, isCurrent = false) => (
        <div
            key={team._id}
            onClick={() => navigate(`/team/${team._id}`)}
            className={`bg-zinc-900 border ${isCurrent ? 'border-cyan-500/50' : 'border-zinc-800'} rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all cursor-pointer`}
        >
            {isCurrent && (
                <div className="bg-gradient-to-r from-cyan-600/20 to-purple-600/20 px-4 py-2 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 text-sm font-medium">CURRENT TEAM</span>
                </div>
            )}

            <div className="p-6 space-y-4">
                {/* Team Header */}
                <div className="flex items-start gap-4">
                    {team.logo ? (
                        <img
                            src={team.logo}
                            alt={`${team.teamName} logo`}
                            className="w-16 h-16 rounded-lg object-cover border border-zinc-700"
                        />
                    ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                    )}

                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1">{team.teamName}</h3>
                        {team.tag && (
                            <span className="inline-block px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 text-sm font-medium">
                                [{team.tag}]
                            </span>
                        )}
                    </div>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Gamepad2 className="w-4 h-4 text-blue-400" />
                            <span className="text-zinc-400 text-xs">GAME</span>
                        </div>
                        <span className="text-white font-medium text-sm">{team.primaryGame}</span>
                    </div>

                    <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-green-400" />
                            <span className="text-zinc-400 text-xs">MEMBERS</span>
                        </div>
                        <span className="text-white font-medium text-sm">{team.players?.length || 0}/5</span>
                    </div>

                    <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Crown className="w-4 h-4 text-amber-400" />
                            <span className="text-zinc-400 text-xs">CAPTAIN</span>
                        </div>
                        <span className="text-white font-medium text-sm truncate">{team.captain?.username || 'TBD'}</span>
                    </div>

                    <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-purple-400" />
                            <span className="text-zinc-400 text-xs">REGION</span>
                        </div>
                        <span className="text-white font-medium text-sm">{team.region || 'N/A'}</span>
                    </div>
                </div>

                {/* Bio */}
                {team.bio && (
                    <div className="bg-zinc-800/30 rounded-lg p-3">
                        <p className="text-zinc-300 text-sm">{team.bio}</p>
                    </div>
                )}

                {/* Team Members */}
                {team.players && team.players.length > 0 && (
                    <div className="bg-zinc-800/30 rounded-lg p-3">
                        <h4 className="text-zinc-300 font-medium text-sm mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Team Members ({team.players.length}/5)
                        </h4>
                        <div className="space-y-2">
                            {team.players.map((player) => (
                                <div key={player._id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-2">
                                    <div className="flex items-center gap-3">
                                        {player.profilePicture ? (
                                            <img
                                                src={player.profilePicture}
                                                alt={player.username}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                                                <User className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-white text-sm font-medium flex items-center gap-2">
                                                <span>{player.username}</span>
                                                {team.captain && team.captain._id === player._id && (
                                                    <Crown className="w-3 h-3 text-amber-400" />
                                                )}
                                            </div>
                                            <div className="text-zinc-400 text-xs">{player.primaryGame}</div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {player && team.captain && team.captain._id === player._id && (
                                        <span className="text-amber-400 text-xs font-medium">Captain</span>
                                    )}
                                    {player && team.captain && team.captain._id !== player._id && player._id === user?.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLeaveTeam(team._id);
                                            }}
                                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                                        >
                                            Leave
                                        </button>
                                    )}
                                    {player && team.captain && team.captain._id === user?.id && team.captain._id !== player._id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleKickPlayer(team._id, player._id, player.username);
                                            }}
                                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                                        >
                                            Kick
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Aegis Rating */}
                {team.aegisRating > 0 && (
                    <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-cyan-400" />
                                <span className="text-cyan-400 font-medium">Aegis Rating</span>
                            </div>
                            <div className="text-2xl font-bold text-cyan-400">{team.aegisRating}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (authLoading || teamLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-zinc-400">Loading your teams...</p>
                </div>
            </div>
        );
    }

    if (teamError) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
                    <h2 className="text-xl font-bold text-white">Failed to load team data</h2>
                    <p className="text-red-400">{teamErrorDetails?.message}</p>
                    <button
                        onClick={() => queryClient.invalidateQueries(['teamData'])}
                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">My Teams</h1>
                        <p className="text-zinc-400">Manage your esports journey</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleRefreshInvitations}
                            disabled={loadingInvitations}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingInvitations ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Invitations</span>
                        </button>
                        <button
                            onClick={() => navigate('/opportunities')}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline">Find Team</span>
                        </button>
                        <button
                            onClick={() => setShowCreateTeamModal(true)}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Create Team</span>
                        </button>
                    </div>
                </div>

                {/* Team Invitations */}
                {invitationsData.length > 0 && showInvitations && (
                    <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <MessageCircle className="w-6 h-6 text-blue-400" />
                                <h2 className="text-xl font-bold">Team Invitations</h2>
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                    {invitationsData.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowInvitations(false)}
                                className="text-zinc-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {invitationsData.map((invitation) => (
                                <div key={invitation._id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                                    <div className="flex items-start gap-3 mb-4">
                                        {invitation.team.logo ? (
                                            <img
                                                src={invitation.team.logo}
                                                alt={invitation.team.teamName}
                                                className="w-12 h-12 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                                <Shield className="w-6 h-6 text-white" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <h3 className="text-white font-medium">{invitation.team.teamName}</h3>
                                            <p className="text-zinc-400 text-sm">From {invitation.fromPlayer.username}</p>
                                            <p className="text-zinc-500 text-xs">{new Date(invitation.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAcceptInvitation(invitation._id)}
                                            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Check className="w-4 h-4" />
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => handleDeclineInvitation(invitation._id)}
                                            className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                                        >
                                            <X className="w-4 h-4" />
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats */}
                {(teamData || (user?.previousTeams && user.previousTeams.length > 0)) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <StatBox
                            icon={Users}
                            label="Total Teams"
                            value={(teamData ? 1 : 0) + (user?.previousTeams?.length || 0)}
                            color="cyan"
                        />
                        <StatBox
                            icon={Trophy}
                            label="Tournaments"
                            value="12"
                            color="amber"
                        />
                        <StatBox
                            icon={Target}
                            label="Win Rate"
                            value="73%"
                            color="green"
                        />
                        <StatBox
                            icon={Medal}
                            label="MVP Awards"
                            value="8"
                            color="purple"
                        />
                    </div>
                )}

                {/* Tabs */}
                {(teamData || (user?.previousTeams && user.previousTeams.length > 0)) && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6">
                        <div className="flex gap-1">
                            {['current', 'history', 'achievements'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 px-6 py-2.5 rounded-lg font-medium transition-colors ${activeTab === tab
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                {!teamData && (!user?.previousTeams || user.previousTeams.length === 0) ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto mb-6 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center">
                            <Users className="w-10 h-10 text-zinc-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">No Teams Yet</h2>
                        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
                            Start your esports journey by joining or creating a team
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => navigate('/opportunities')}
                                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                            >
                                Find Teams
                            </button>
                            <button
                                onClick={() => setShowCreateTeamModal(true)}
                                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                            >
                                Create Team
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {activeTab === 'current' && teamData && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Crown className="w-6 h-6 text-cyan-400" />
                                    Current Team
                                </h2>
                                <div className="max-w-3xl">
                                    {renderTeamCard(teamData, true)}
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && user?.previousTeams && user.previousTeams.length > 0 && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <History className="w-6 h-6 text-zinc-400" />
                                    Team History
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {user.previousTeams.map((team) => renderTeamCard(team, false))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'achievements' && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Award className="w-6 h-6 text-amber-400" />
                                    Achievements
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { title: 'Champion', desc: 'Won Winter Circuit 2024', icon: Trophy },
                                        { title: 'MVP', desc: 'Regional Qualifier MVP', icon: Star },
                                        { title: 'Team Player', desc: '50+ matches with team', icon: Users },
                                        { title: 'Clutch Master', desc: '10 clutch victories', icon: Target },
                                        { title: 'Veteran', desc: '1 year on Aegis', icon: Medal }
                                    ].map((achievement, index) => (
                                        <div key={index} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                                                    <achievement.icon className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-medium">{achievement.title}</h3>
                                                    <p className="text-zinc-400 text-sm">{achievement.desc}</p>
                                                </div>
                                            </div>
                                            <p className="text-zinc-500 text-xs">Earned 2 days ago</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Team Modal */}
            {showCreateTeamModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Create New Team</h2>
                                <button
                                    onClick={() => setShowCreateTeamModal(false)}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateTeam} className="space-y-4">
                                {createTeamError && (
                                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                                        <p className="text-red-400 text-sm">{createTeamError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-zinc-300 text-sm font-medium mb-2">
                                        Team Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={createTeamForm.teamName}
                                        onChange={(e) => setCreateTeamForm(prev => ({ ...prev, teamName: e.target.value }))}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                                        placeholder="Enter team name"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-zinc-300 text-sm font-medium mb-2">
                                        Team Tag (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={createTeamForm.teamTag}
                                        onChange={(e) => setCreateTeamForm(prev => ({ ...prev, teamTag: e.target.value }))}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                                        placeholder="e.g., ESP, PRO"
                                        maxLength={5}
                                    />
                                </div>

                                {/* ✅ Primary Game - Display only (not editable) */}
                                <div>
                                    <label className="block text-zinc-300 text-sm font-medium mb-2">
                                        Primary Game
                                    </label>
                                    <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 flex items-center gap-2">
                                        <Gamepad2 className="w-4 h-4" />
                                        <span>BGMI</span>
                                        <span className="ml-auto text-xs text-zinc-500">(Default)</span>
                                    </div>
                                </div>

                                {/* ✅ Region - Display only (not editable) */}
                                <div>
                                    <label className="block text-zinc-300 text-sm font-medium mb-2">
                                        Region
                                    </label>
                                    <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" />
                                        <span>India</span>
                                        <span className="ml-auto text-xs text-zinc-500">(Default)</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-zinc-300 text-sm font-medium mb-2">
                                        Team Bio (Optional)
                                    </label>
                                    <textarea
                                        value={createTeamForm.bio}
                                        onChange={(e) => setCreateTeamForm(prev => ({ ...prev, bio: e.target.value }))}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                                        placeholder="Tell us about your team..."
                                        rows={3}
                                        maxLength={200}
                                    />
                                    <p className="text-zinc-500 text-xs mt-1">{createTeamForm.bio.length}/200</p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateTeamModal(false)}
                                        className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createTeamMutation.isLoading}
                                        className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {createTeamMutation.isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Trophy className="w-4 h-4" />
                                                Create Team
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
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
                                        className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmKickPlayer}
                                        disabled={kickPlayerMutation.isLoading}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    );
};

export default MyTeams;