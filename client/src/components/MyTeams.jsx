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

// ...existing code...

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



    // Redirect: If user has a team, navigate directly to team page
    useEffect(() => {
        if (!authLoading && user?.team) {
            const teamId = user.team._id || user.team;
            navigate(`/team/${teamId}`, { replace: true });
        }
    }, [authLoading, user, navigate]);

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

    if (authLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center pt-24">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-zinc-400">Loading your teams...</p>
                </div>
            </div>
        );
    }

    // Only show the create/join UI if user has no team
    return (
        <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4">
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
            </div>
        </div>
    );
};

export default MyTeams;