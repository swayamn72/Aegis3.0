import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Trophy, Users, Calendar, ArrowLeft, Eye, Settings,
    Target, Play, CheckCircle, Clock, Award, BarChart3, Grid3x3, Edit, Bell, Lock,
    ClipboardList, CheckCheck, XCircle, ChevronLeft, ChevronRight, Plus, ChevronUp, ChevronDown
} from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../utils/axiosConfig';
import PhaseManager from './TournamentManagementComponents/PhaseManager';
import MatchScheduler from './TournamentManagementComponents/MatchScheduler';
import PointsTable from './TournamentManagementComponents/PointsTable';
import TeamGrouping from './TournamentManagementComponents/TeamGrouping';
import MatchManagement from './TournamentManagementComponents/MatchManagement';
import TeamSelector from './TournamentManagementComponents/TeamSelector';
import PrizeDistributionForm from './TournamentManagementComponents/PrizeDistributionForm';
import TournamentForm from './TournamentManagementComponents/TournamentForm';
import Announcements from './TournamentManagementComponents/Announcements';

const TournamentManagementPageOrg = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, userRole } = useAuth();
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('overview');
    const [isPhaseManagerOpen, setIsPhaseManagerOpen] = useState(false);
    const [isPrizeFormOpen, setIsPrizeFormOpen] = useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState('');
    const [lockLoading, setLockLoading] = useState(false);
    const [lockResult, setLockResult] = useState(null); // result from lock-registrations

    // Teams tab state
    const [teamsList, setTeamsList] = useState([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    const [teamsPage, setTeamsPage] = useState(1);
    const [teamsTotal, setTeamsTotal] = useState(0);
    const [showAddTeamSelector, setShowAddTeamSelector] = useState(false);
    const [regStatusFilter, setRegStatusFilter] = useState('pending');
    const [regList, setRegList] = useState([]);
    const [regLoading, setRegLoading] = useState(false);
    const [regPage, setRegPage] = useState(1);
    const [regTotal, setRegTotal] = useState(0);
    const [regStatusCounts, setRegStatusCounts] = useState({});
    const [regActionLoading, setRegActionLoading] = useState(null);
    const [bulkApproving, setBulkApproving] = useState(false);

    useEffect(() => {
        if (id && user && userRole === 'organization') {
            fetchTournament();
        }
    }, [id, user, userRole]);

    const fetchTournament = async () => {
        try {
            setLoading(true);
            const { data } = await axiosInstance.get(`/api/org-tournaments/${id}`);
            setTournament(data.tournamentData || data.tournament);
        } catch (error) {
            console.error('Error fetching tournament:', error);
            toast.error(error.message || 'Error loading tournament');
            navigate('/org/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (formData) => {
        try {
            await axiosInstance.put(`/api/org-tournaments/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Tournament updated successfully');
            fetchTournament();
            setIsEditFormOpen(false);
        } catch (error) {
            console.error('Error updating tournament:', error);
            toast.error(error.message || 'Failed to update tournament');
        }
    };

    const fetchRegistrations = async (status = regStatusFilter, page = 1) => {
        if (!id) return;
        setRegLoading(true);
        try {
            const { data } = await axiosInstance.get(`/api/org-tournaments/${id}/registrations`, {
                params: { status: status !== 'all' ? status : undefined, page, limit: 20 }
            });
            setRegList(data.registrations || []);
            setRegTotal(data.total || 0);
            setRegPage(page);
            setRegStatusCounts(data.statusCounts || {});
        } catch (e) {
            toast.error('Failed to load registrations');
        } finally {
            setRegLoading(false);
        }
    };

    const handleRegAction = async (regId, action) => {
        setRegActionLoading(regId);
        try {
            await axiosInstance.patch(`/api/org-tournaments/${id}/registrations/${regId}`, { action });
            toast.success(action === 'approve' ? 'Team approved ✔' : 'Team rejected');
            // Update list in-place; refresh counts
            setRegList(prev => prev.map(r =>
                r._id === regId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r
            ));
            fetchTournament();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Action failed');
        } finally {
            setRegActionLoading(null);
        }
    };

    const handleBulkApprove = async () => {
        setBulkApproving(true);
        try {
            const { data } = await axiosInstance.post(`/api/org-tournaments/${id}/registrations/bulk`, { action: 'approve_all' });
            toast.success(data.message);
            fetchRegistrations(regStatusFilter, 1);
            fetchTournament();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Bulk approve failed');
        } finally {
            setBulkApproving(false);
        }
    };

    const fetchTeams = async (phase = selectedPhase, page = 1) => {
        if (!id) return;
        setTeamsLoading(true);
        try {
            if (phase && phase !== 'all') {
                const { data } = await axiosInstance.get(`/api/org-tournaments/${id}/phase-teams`, {
                    params: { phase, page, limit: 18 }
                });
                setTeamsList(data.teams || []);
                setTeamsTotal(data.total || 0);
            } else {
                const { data } = await axiosInstance.get(`/api/org-tournaments/${id}/registrations`, {
                    params: { status: 'approved', page, limit: 18 }
                });
                setTeamsList(data.registrations?.map(r => ({
                    ...r.team,
                    group: r.group,
                    status: r.status,
                    registrationId: r._id
                })) || []);
                setTeamsTotal(data.statusCounts?.approved || data.total || 0);
            }
            setTeamsPage(page);
        } catch (e) {
            toast.error('Failed to load teams');
        } finally {
            setTeamsLoading(false);
        }
    };

    // Fetch data whenever tabs or filters change
    useEffect(() => {
        if (activeSection === 'registrations') {
            fetchRegistrations(regStatusFilter, 1);
        } else if (activeSection === 'teams') {
            fetchTeams(selectedPhase, 1);
        }
    }, [activeSection, regStatusFilter, selectedPhase]);

    const handleLockRegistrations = async () => {
        if (lockLoading) return;
        setLockLoading(true);
        try {
            const { data } = await axiosInstance.post(`/api/org-tournaments/${id}/lock-registrations`);
            setLockResult(data);
            await fetchTournament(); // re-sync phase teamCounts
            if (data.recommendation === 'restructure') {
                toast.warn(`Registrations locked. Fill rate is only ${data.stats.fillRate}% — consider restructuring phases.`);
            } else {
                toast.success(`Registrations locked. ${data.teamsAssigned} team(s) assigned to "${data.assignedToPhase}".`);
            }
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to lock registrations';
            toast.error(msg);
        } finally {
            setLockLoading(false);
        }
    };

    const handleOrgAddTeamToPhase = async (team, phase) => {
        try {
            await axiosInstance.post(
                `/api/org-tournaments/${id}/phases/${phase}/teams`,
                { teamId: team._id }
            );
            await fetchTournament(); // re-sync phase teamCounts from Registration
            toast.success(`Team added to ${phase}`);
        } catch (error) {
            console.error('Error adding team:', error);
            toast.error(error.message || 'Failed to add team');
        }
    };

    const handleOrgRemoveTeamFromPhase = async (team, phase) => {
        try {
            await axiosInstance.delete(
                `/api/org-tournaments/${id}/phases/${phase}/teams/${team._id}`
            );
            await fetchTournament(); // re-sync phase teamCounts from Registration
            toast.success(`Team removed from ${phase}`);
        } catch (error) {
            console.error('Error removing team:', error);
            toast.error(error.message || 'Failed to remove team');
        }
    };

    const getCurrentPhase = () => {
        return tournament?.phases?.find(p => p.status === 'in_progress') ||
            tournament?.phases?.find(p => p.status === 'upcoming') ||
            tournament?.phases?.[0];
    };

    const getPhaseProgress = (phase) => {
        if (!phase) return 0;
        const total = phase.matches?.length || 0;
        const completed = phase.matches?.filter(m => m.status === 'completed').length || 0;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading tournament...</p>
                </div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Tournament not found</p>
                </div>
            </div>
        );
    }

    const currentPhase = getCurrentPhase();
    const navigation = [
        { id: 'overview', name: 'Overview', icon: BarChart3 },
        { id: 'phases', name: 'Phases', icon: Target },
        { id: 'schedule', name: 'Schedule', icon: Clock },
        { id: 'matches', name: 'Matches', icon: Calendar },
        { id: 'teams', name: 'Teams', icon: Users },
        { id: 'registrations', name: 'Registrations', icon: ClipboardList },
        { id: 'groups', name: 'Groups', icon: Grid3x3 },
        { id: 'standings', name: 'Standings', icon: Trophy },
        { id: 'prizes', name: 'Prizes', icon: Award },
        { id: 'announcements', name: 'Announcements', icon: Bell },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Top Bar */}
            <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/org/dashboard')}
                                className="p-2 hover:bg-gray-800 rounded-lg transition-all"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-400" />
                            </button>
                            <div className="flex items-center gap-3">
                                {tournament.media?.logo ? (
                                    <img
                                        src={tournament.media.logo}
                                        alt="Logo"
                                        className="w-10 h-10 rounded-lg object-cover ring-2 ring-gray-700"
                                    />
                                ) : (
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center ring-2 ring-gray-700">
                                        <Trophy className="w-5 h-5 text-white" />
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-lg font-bold text-white">{tournament.tournamentName}</h1>
                                    <p className="text-sm text-gray-400">{tournament.gameTitle} • {tournament.region}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsEditFormOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all text-sm"
                            >
                                <Edit className="w-4 h-4" />
                                <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                                onClick={() => window.open(`/tournament/${id}`, '_blank')}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all text-sm"
                            >
                                <Eye className="w-4 h-4" />
                                <span className="hidden sm:inline">View Public</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:border-orange-500/50 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <Users className="w-6 h-6 text-orange-400" />
                            <span className="text-2xl font-bold text-white">
                                {tournament.stats?.activeTeams || tournament.participatingTeams?.length || tournament.participatingTeamsCount || 0}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm">Teams</p>
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:border-blue-500/50 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <Target className="w-6 h-6 text-blue-400" />
                            <span className="text-2xl font-bold text-white">
                                {tournament.phases?.length || 0}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm">Phases</p>
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:border-green-500/50 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <Calendar className="w-6 h-6 text-green-400" />
                            <span className="text-2xl font-bold text-white">
                                {tournament.stats?.totalMatches || tournament.phases?.reduce((acc, p) => acc + (p.matches?.length || 0), 0) || 0}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm">Matches</p>
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:border-yellow-500/50 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <Award className="w-6 h-6 text-yellow-400" />
                            <span className="text-2xl font-bold text-white">
                                ₹{((tournament.prizePool?.total || 0) / 1000).toFixed(0)}K
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm">Prize Pool</p>
                    </div>
                </div>

                {/* Current Phase Card */}
                {currentPhase && (
                    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-5 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                                    <Play className="w-5 h-5 text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">{currentPhase.name}</h3>
                                    <p className="text-gray-400 text-sm">
                                        {currentPhase.teamCount ?? 0} teams • {currentPhase.matches?.length || 0} matches
                                    </p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentPhase.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                                currentPhase.status === 'in_progress' ? 'bg-green-500/20 text-green-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                {currentPhase.status.replace('_', ' ')}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all"
                                    style={{ width: `${getPhaseProgress(currentPhase)}%` }}
                                ></div>
                            </div>
                            <span className="text-sm text-gray-400 min-w-[3rem] text-right">
                                {getPhaseProgress(currentPhase)}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Navigation Tabs */}
                <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-xl mb-6 overflow-x-auto">
                    <div className="flex">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${activeSection === item.id
                                        ? 'text-orange-400 border-orange-400 bg-orange-500/5'
                                        : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800/50'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{item.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
                    {activeSection === 'overview' && (
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-white mb-6">Tournament Overview</h2>

                            {/* Timeline */}
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-4">Tournament Timeline</h3>
                                <div className="space-y-3">
                                    {tournament.phases?.map((phase, index) => (
                                        <div key={index} className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${phase.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                phase.status === 'in_progress' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-gray-700 text-gray-400'
                                                }`}>
                                                {phase.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : index + 1}
                                            </div>
                                            <div className="flex-1 bg-gray-700/50 rounded-lg p-4">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <div>
                                                        <h4 className="text-white font-medium">{phase.name}</h4>
                                                        <p className="text-sm text-gray-400">
                                                            {phase.startDate ? new Date(phase.startDate).toLocaleDateString() : 'TBD'}
                                                        </p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${phase.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                        phase.status === 'in_progress' ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-gray-600/20 text-gray-400'
                                                        }`}>
                                                        {phase.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setActiveSection('phases')}
                                    className="p-5 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl text-left hover:border-orange-500 transition-all group"
                                >
                                    <Settings className="w-8 h-8 text-orange-400 mb-3 group-hover:scale-110 transition-transform" />
                                    <h4 className="text-white font-semibold mb-1">Manage Phases</h4>
                                    <p className="text-sm text-gray-400">Setup tournament structure and advancement rules</p>
                                </button>

                                <button
                                    onClick={() => setActiveSection('schedule')}
                                    className="p-5 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl text-left hover:border-blue-500 transition-all group"
                                >
                                    <Clock className="w-8 h-8 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                                    <h4 className="text-white font-semibold mb-1">Schedule Matches</h4>
                                    <p className="text-sm text-gray-400">Create and manage match schedules</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSection === 'phases' && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                                <h2 className="text-2xl font-bold text-white">Tournament Phases</h2>
                                <div className="flex items-center gap-2">
                                    {/* Lock Registrations — assigns all approved teams to phase 1.
                                        Must be done before group assignment is possible. */}
                                    {tournament.status !== 'completed' && tournament.phases?.length > 0 && (
                                        <button
                                            onClick={handleLockRegistrations}
                                            disabled={lockLoading}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Lock className="w-4 h-4" />
                                            {lockLoading ? 'Locking…' : 'Lock Registrations'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsPhaseManagerOpen(true)}
                                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all flex items-center gap-2"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Manage Phases
                                    </button>
                                </div>
                            </div>

                            {/* Lock result banner */}
                            {lockResult && (
                                <div className={`mb-5 rounded-xl border px-5 py-4 ${lockResult.recommendation === 'restructure'
                                    ? 'bg-yellow-500/10 border-yellow-500/30'
                                    : lockResult.recommendation === 'warn'
                                        ? 'bg-orange-500/10 border-orange-500/30'
                                        : 'bg-green-500/10 border-green-500/30'
                                    }`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className={`font-semibold text-sm mb-1 ${lockResult.recommendation === 'restructure' ? 'text-yellow-300' :
                                                lockResult.recommendation === 'warn' ? 'text-orange-300' : 'text-green-300'
                                                }`}>
                                                {lockResult.recommendation === 'restructure' && '⚠ Low fill rate — consider restructuring phases'}
                                                {lockResult.recommendation === 'warn' && '⚡ Below expected fill — proceed with caution'}
                                                {lockResult.recommendation === 'proceed' && '✓ Registrations locked successfully'}
                                            </p>
                                            <p className="text-gray-300 text-sm">
                                                {lockResult.stats.actualApproved} / {lockResult.stats.expected} slots filled
                                                &nbsp;({lockResult.stats.fillRate}% fill rate)
                                                &nbsp;·&nbsp;
                                                {lockResult.teamsAssigned} team(s) assigned to <strong>&ldquo;{lockResult.assignedToPhase}&rdquo;</strong>
                                            </p>
                                            {lockResult.stats.pending > 0 && (
                                                <p className="text-yellow-400 text-xs mt-1">
                                                    {lockResult.stats.pending} pending registration(s) not yet assigned — approve or reject them first.
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setLockResult(null)}
                                            className="text-gray-500 hover:text-white text-lg leading-none shrink-0"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            )}

                            {tournament.phases?.length > 0 ? (
                                <div className="space-y-4">
                                    {tournament.phases.map((phase, index) => (
                                        <div key={index} className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                                                        <Target className="w-6 h-6 text-white" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white text-lg font-semibold">{phase.name}</h3>
                                                        <p className="text-gray-400 text-sm">{phase.type.replace('_', ' ')}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${phase.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                                                    phase.status === 'in_progress' ? 'bg-green-500/20 text-green-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {phase.status.replace('_', ' ')}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-gray-400 text-sm">Teams</p>
                                                    <p className="text-white font-medium">{phase.teamCount ?? 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 text-sm">Matches</p>
                                                    <p className="text-white font-medium">{phase.matches?.length || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 text-sm">Duration</p>
                                                    <p className="text-white font-medium text-sm">
                                                        {phase.startDate ? new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-white mb-2">No Phases Configured</h3>
                                    <p className="text-gray-400 mb-6">Create phases to organize your tournament</p>
                                    <button
                                        onClick={() => setIsPhaseManagerOpen(true)}
                                        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                                    >
                                        Create First Phase
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'schedule' && (
                        <MatchScheduler tournament={tournament} onUpdate={fetchTournament} />
                    )}

                    {activeSection === 'matches' && (
                        <MatchManagement tournament={tournament} onUpdate={fetchTournament} />
                    )}

                    {activeSection === 'teams' && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Teams Management</h2>
                                    <p className="text-gray-400 text-sm mt-1">Viewing {teamsTotal} approved teams</p>
                                </div>
                                {tournament.phases?.length > 0 && (
                                    <select
                                        value={selectedPhase}
                                        onChange={(e) => setSelectedPhase(e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        <option value="">All Approved Teams</option>
                                        {tournament.phases.map((phase, idx) => (
                                            <option key={idx} value={phase.name}>{phase.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {selectedPhase && (
                                <div className="mb-6">
                                    <button
                                        onClick={() => setShowAddTeamSelector(!showAddTeamSelector)}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 rounded-lg hover:bg-orange-500/20 transition-all text-sm font-medium border border-orange-500/20"
                                    >
                                        {showAddTeamSelector ? <ChevronUp size={16} /> : <Plus size={16} />}
                                        {showAddTeamSelector ? 'Close Selector' : `Add Teams to ${selectedPhase}`}
                                    </button>

                                    {showAddTeamSelector && (
                                        <div className="mt-4 bg-gray-800/40 rounded-xl border border-gray-700 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-white font-semibold flex items-center gap-2">
                                                    <Users size={18} className="text-orange-500" />
                                                    Select teams for {selectedPhase}
                                                </h3>
                                                <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Only approved teams</span>
                                            </div>
                                            <TeamSelector
                                                selectedPhase={selectedPhase}
                                                tournament={tournament}
                                                onSelect={(team) => {
                                                    handleOrgAddTeamToPhase(team, selectedPhase);
                                                    // Refresh the list after adding
                                                    setTimeout(() => fetchTeams(selectedPhase, teamsPage), 800);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {teamsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <ClipboardList className="w-12 h-12 text-gray-700 animate-pulse" />
                                    <p className="text-gray-400">Loading teams...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                        {teamsList.length > 0 ? (
                                            teamsList.map((team, index) => {
                                                const teamName = team?.teamName || 'Unknown Team';
                                                const teamLogo = team?.logo;
                                                const teamId = team?._id;
                                                const status = team?.status || 'approved';
                                                const group = team?.group;

                                                const statusColors = {
                                                    'pending': 'bg-yellow-500/20 text-yellow-400',
                                                    'approved': 'bg-green-500/20 text-green-400',
                                                    'checked_in': 'bg-blue-500/20 text-blue-400',
                                                    'rejected': 'bg-red-500/20 text-red-400',
                                                    'withdrawn': 'bg-gray-500/20 text-gray-400'
                                                };

                                                return (
                                                    <div
                                                        key={teamId || index}
                                                        className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-orange-500/50 transition-all flex flex-col justify-between"
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-3">
                                                                {teamLogo ? (
                                                                    <img src={teamLogo} alt={teamName} className="w-12 h-12 rounded-lg object-cover" />
                                                                ) : (
                                                                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                                                                        <Users className="text-gray-500" />
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                    <h3 className="text-white font-semibold truncate">{teamName}</h3>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${statusColors[status] || statusColors.approved}`}>
                                                                            {status}
                                                                        </span>
                                                                        {group && (
                                                                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                                                                                {group}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 uppercase">#{teamId?.slice(-6) || '—'}</span>
                                                            <div className="flex items-center gap-3">
                                                                {selectedPhase && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleOrgRemoveTeamFromPhase({ _id: teamId }, selectedPhase);
                                                                            setTimeout(() => fetchTeams(selectedPhase, teamsPage), 800);
                                                                        }}
                                                                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                                                                        title="Remove from Phase"
                                                                    >
                                                                        <XCircle size={14} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => navigate(`/teams/${teamId}`)}
                                                                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
                                                                >
                                                                    View Profile
                                                                    <ChevronRight size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full py-20 text-center bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
                                                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                                <p className="text-gray-400 font-medium">No teams found</p>
                                                <p className="text-gray-500 text-sm mt-1">
                                                    {selectedPhase ? `No approved teams are assigned to "${selectedPhase}" yet.` : 'No teams have been approved for this tournament yet.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pagination */}
                                    {teamsTotal > 18 && (
                                        <div className="flex items-center justify-between bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                                            <p className="text-xs text-gray-400">
                                                Showing <span className="text-white font-medium">{((teamsPage - 1) * 18) + 1}</span> to <span className="text-white font-medium">{Math.min(teamsPage * 18, teamsTotal)}</span> of <span className="text-white font-medium">{teamsTotal}</span> teams
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    disabled={teamsPage <= 1}
                                                    onClick={() => fetchTeams(selectedPhase, teamsPage - 1)}
                                                    className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all border border-gray-600"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <button
                                                    disabled={teamsPage * 18 >= teamsTotal}
                                                    onClick={() => fetchTeams(selectedPhase, teamsPage + 1)}
                                                    className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all border border-gray-600"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeSection === 'registrations' && (
                        <div className="p-6 space-y-5">
                            {/* Header row */}
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Registrations</h2>
                                    <p className="text-sm text-gray-400 mt-0.5">
                                        {tournament.requiresApproval
                                            ? 'Manual approval mode — review each team before they are accepted'
                                            : 'Auto-approve mode — teams are accepted on sign-up'}
                                    </p>
                                </div>
                                {(regStatusCounts['pending'] || 0) > 0 && (
                                    <button
                                        onClick={handleBulkApprove}
                                        disabled={bulkApproving}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <CheckCheck size={15} />
                                        {bulkApproving ? 'Approving…' : `Approve All Pending (${regStatusCounts['pending']})`}
                                    </button>
                                )}
                            </div>

                            {/* Status filter chips */}
                            <div className="flex flex-wrap gap-2">
                                {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([val, label]) => (
                                    <button
                                        key={val}
                                        onClick={() => setRegStatusFilter(val)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${regStatusFilter === val
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {label}
                                        {val !== 'all' && regStatusCounts[val] != null
                                            ? ` (${regStatusCounts[val]})`
                                            : val === 'all' && regTotal > 0
                                                ? ` (${regTotal})`
                                                : ''}
                                    </button>
                                ))}
                            </div>

                            {/* Table */}
                            <div className="bg-gray-800/60 rounded-xl overflow-hidden border border-gray-700/50">
                                {regLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : regList.length === 0 ? (
                                    <div className="text-center py-16 text-gray-500">
                                        <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">No {regStatusFilter !== 'all' ? regStatusFilter : ''} registrations found</p>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-700/70">
                                                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">Team</th>
                                                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Status</th>
                                                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Registered</th>
                                                <th className="text-right text-xs text-gray-400 font-medium px-5 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700/40">
                                            {regList.map((reg) => (
                                                <tr key={reg._id} className="hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-3">
                                                            {reg.team?.logo ? (
                                                                <img src={reg.team.logo} alt="" className="w-8 h-8 rounded-md object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-md bg-gray-700 flex items-center justify-center">
                                                                    <Users size={14} className="text-gray-500" />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-white text-sm font-medium leading-tight">{reg.team?.teamName || 'Unknown'}</p>
                                                                <p className="text-gray-500 text-xs">{reg.team?.teamTag || ''}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${reg.status === 'approved' ? 'bg-green-500/20 text-green-400'
                                                            : reg.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                                                                : reg.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
                                                                    : 'bg-gray-600/40 text-gray-400'
                                                            }`}>
                                                            {reg.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-400">
                                                        {reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString() : '—'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        {reg.status === 'pending' && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    disabled={regActionLoading === reg._id}
                                                                    onClick={() => handleRegAction(reg._id, 'approve')}
                                                                    className="flex items-center gap-1 px-2.5 py-1 bg-green-600/80 hover:bg-green-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
                                                                >
                                                                    <CheckCircle size={12} />
                                                                    {regActionLoading === reg._id ? '…' : 'Approve'}
                                                                </button>
                                                                <button
                                                                    disabled={regActionLoading === reg._id}
                                                                    onClick={() => handleRegAction(reg._id, 'reject')}
                                                                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600/70 hover:bg-red-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
                                                                >
                                                                    <XCircle size={12} />
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                        {reg.status === 'approved' && (
                                                            <button
                                                                disabled={regActionLoading === reg._id}
                                                                onClick={() => handleRegAction(reg._id, 'reject')}
                                                                className="flex items-center gap-1 px-2.5 py-1 bg-red-600/70 hover:bg-red-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
                                                            >
                                                                <XCircle size={12} />
                                                                Reject
                                                            </button>
                                                        )}
                                                        {reg.status === 'rejected' && (
                                                            <button
                                                                disabled={regActionLoading === reg._id}
                                                                onClick={() => handleRegAction(reg._id, 'approve')}
                                                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600/80 hover:bg-green-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors"
                                                            >
                                                                <CheckCircle size={12} />
                                                                Approve
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Pagination */}
                            {!regLoading && regTotal > 20 && (
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">
                                        Showing {((regPage - 1) * 20) + 1}–{Math.min(regPage * 20, regTotal)} of {regTotal}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={regPage <= 1}
                                            onClick={() => fetchRegistrations(regStatusFilter, regPage - 1)}
                                            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white"
                                        >
                                            <ChevronLeft size={15} />
                                        </button>
                                        <button
                                            disabled={regPage * 20 >= regTotal}
                                            onClick={() => fetchRegistrations(regStatusFilter, regPage + 1)}
                                            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white"
                                        >
                                            <ChevronRight size={15} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'groups' && (
                        <TeamGrouping tournament={tournament} onUpdate={fetchTournament} />
                    )}

                    {activeSection === 'standings' && (
                        <PointsTable tournament={tournament} onUpdate={fetchTournament} />
                    )}

                    {activeSection === 'announcements' && (
                        <Announcements tournament={tournament} />
                    )}

                    {activeSection === 'prizes' && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">Prize Pool</h2>
                                <button
                                    onClick={() => setIsPrizeFormOpen(true)}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all flex items-center gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    Configure
                                </button>
                            </div>

                            {tournament.prizePool?.distribution && tournament.prizePool.distribution.length > 0 ? (
                                <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-700/50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Position</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">%</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700">
                                                {tournament.prizePool.distribution.map((prize, index) => {
                                                    const percentage = tournament.prizePool.total
                                                        ? ((prize.amount / tournament.prizePool.total) * 100).toFixed(1)
                                                        : 0;
                                                    return (
                                                        <tr key={index} className="hover:bg-gray-700/30">
                                                            <td className="px-6 py-4">
                                                                <span className="text-white font-medium">
                                                                    {prize.position === 1 ? '🥇 1st' :
                                                                        prize.position === 2 ? '🥈 2nd' :
                                                                            prize.position === 3 ? '🥉 3rd' :
                                                                                `${prize.position}th`}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-white font-medium">
                                                                ₹{prize.amount?.toLocaleString() || '0'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[100px]">
                                                                        <div
                                                                            className="bg-orange-500 h-2 rounded-full"
                                                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-gray-400 text-sm">{percentage}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-white mb-2">No Prize Distribution Set</h3>
                                    <p className="text-gray-400 mb-6">Configure prize distribution for your tournament</p>
                                    <button
                                        onClick={() => setIsPrizeFormOpen(true)}
                                        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                                    >
                                        Set Up Prizes
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {isPhaseManagerOpen && (
                <PhaseManager
                    isOpen={isPhaseManagerOpen}
                    onClose={() => setIsPhaseManagerOpen(false)}
                    onSave={async (phases) => {
                        try {
                            const formData = new FormData();
                            formData.append('tournamentData', JSON.stringify({ phases }));

                            await axiosInstance.put(`/api/org-tournaments/${id}`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });

                            toast.success('Phases updated successfully');
                            fetchTournament();
                            setIsPhaseManagerOpen(false);
                        } catch (error) {
                            console.error('Error updating phases:', error);
                            toast.error('Failed to update phases');
                        }
                    }}
                    initialPhases={tournament.phases || []}
                />
            )}

            {isPrizeFormOpen && (
                <PrizeDistributionForm
                    isOpen={isPrizeFormOpen}
                    onClose={() => setIsPrizeFormOpen(false)}
                    onSave={async (distribution, individualAwards) => {
                        try {
                            const updatedPrizePool = {
                                ...tournament.prizePool,
                                distribution,
                                individualAwards
                            };

                            await axiosInstance.put(`/api/org-tournaments/${id}`, {
                                prizePool: updatedPrizePool
                            });

                            toast.success('Prize distribution updated successfully');
                            fetchTournament();
                            setIsPrizeFormOpen(false);
                        } catch (error) {
                            console.error('Error updating prize distribution:', error);
                            toast.error('Failed to update prize distribution');
                        }
                    }}
                    initialDistribution={tournament.prizePool?.distribution || []}
                    initialIndividualAwards={tournament.prizePool?.individualAwards || []}
                    totalPrizePool={tournament.prizePool?.total || 0}
                />
            )}

            {isEditFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Edit Tournament</h2>
                            <button
                                onClick={() => setIsEditFormOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6">
                            <TournamentForm
                                tournament={tournament}
                                onSubmit={handleSave}
                                isEditing={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentManagementPageOrg;