import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import AdminLayout from '../components/AdminLayout';
import {
    Trophy,
    Search,
    Filter,
    CheckCircle,
    XCircle,
    Eye,
    Calendar,
    Users,
    DollarSign,
    Building2,
    AlertCircle,
    Clock,
    X,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    TrendingUp,
    Globe,
    MapPin
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
    fetchTournamentsAPI,
    getTournamentAPI,
    approveTournamentAPI,
    rejectTournamentAPI,
    updateTournamentStatusAPI
} from '../api/adminApi';

const AdminTournaments = () => {
    const { admin } = useAdmin();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Filters state
    const [filters, setFilters] = useState({
        approvalStatus: 'pending',
        status: '',
        tier: '',
        gameTitle: '',
        search: '',
        page: 1,
        limit: 20
    });

    // Pagination & stats state
    const [pagination, setPagination] = useState({
        current: 1,
        totalPages: 1,
        total: 0,
        hasNext: false,
        hasPrev: false
    });

    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        total: 0
    });

    // Fetch tournaments with current filters
    const fetchTournaments = useCallback(async () => {
        setLoading(true);
        try {
            // SECURITY: Clean filters before sending
            const cleanFilters = Object.fromEntries(
                Object.entries(filters).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
            );

            const data = await fetchTournamentsAPI(cleanFilters);
            setTournaments(data.tournaments || []);
            setPagination(data.pagination || {});
            setStats(data.stats || {});
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            toast.error(error.error || 'Failed to load tournaments');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    // Handle page change
    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    // View tournament details
    const handleViewDetails = async (tournament) => {
        try {
            setActionLoading(true);
            const data = await getTournamentAPI(tournament._id);
            setSelectedTournament({ ...data.tournament, registrationStats: data.registrationStats });
            setShowDetailModal(true);
        } catch (error) {
            console.error('Error fetching tournament details:', error);
            toast.error('Failed to load tournament details');
        } finally {
            setActionLoading(false);
        }
    };

    // Approve tournament
    const handleApprove = async (tournamentId) => {
        // SECURITY: Confirm action
        if (!window.confirm('Are you sure you want to approve this tournament?')) {
            return;
        }

        setActionLoading(true);
        try {
            await approveTournamentAPI(tournamentId);
            toast.success('Tournament approved successfully!');
            fetchTournaments();
            setShowDetailModal(false);
            setSelectedTournament(null);
        } catch (error) {
            console.error('Error approving tournament:', error);
            toast.error(error.error || 'Failed to approve tournament');
        } finally {
            setActionLoading(false);
        }
    };

    // Open reject modal
    const handleRejectClick = (tournament) => {
        setSelectedTournament(tournament);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    // Reject tournament
    const handleReject = async () => {
        // SECURITY: Validate reason on client side
        const trimmedReason = rejectionReason.trim();
        if (!trimmedReason || trimmedReason.length < 10) {
            toast.error('Rejection reason must be at least 10 characters');
            return;
        }

        if (trimmedReason.length > 500) {
            toast.error('Rejection reason must not exceed 500 characters');
            return;
        }

        setActionLoading(true);
        try {
            await rejectTournamentAPI(selectedTournament._id, trimmedReason);
            toast.success('Tournament rejected successfully!');
            fetchTournaments();
            setShowRejectModal(false);
            setShowDetailModal(false);
            setSelectedTournament(null);
            setRejectionReason('');
        } catch (error) {
            console.error('Error rejecting tournament:', error);
            toast.error(error.error || 'Failed to reject tournament');
        } finally {
            setActionLoading(false);
        }
    };

    // Update tournament status
    const handleStatusChange = async (tournamentId, newStatus) => {
        // SECURITY: Confirm action
        if (!window.confirm(`Are you sure you want to change the status to "${newStatus}"?`)) {
            return;
        }

        setActionLoading(true);
        try {
            await updateTournamentStatusAPI(tournamentId, newStatus);
            toast.success('Tournament status updated successfully!');
            fetchTournaments();
            if (showDetailModal && selectedTournament?._id === tournamentId) {
                setShowDetailModal(false);
                setSelectedTournament(null);
            }
        } catch (error) {
            console.error('Error updating tournament status:', error);
            toast.error(error.error || 'Failed to update tournament status');
        } finally {
            setActionLoading(false);
        }
    };

    // Get status badge styling
    const getApprovalStatusStyle = (status) => {
        switch (status) {
            case 'pending':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'approved':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'rejected':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getTournamentStatusStyle = (status) => {
        switch (status) {
            case 'in_progress':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'registration_open':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'announced':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'completed':
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            case 'cancelled':
                return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
            default:
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        }
    };

    const getTierBadgeStyle = (tier) => {
        switch (tier) {
            case 'S':
                return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
            case 'A':
                return 'bg-gradient-to-r from-gray-300 to-gray-400 text-zinc-900';
            case 'B':
                return 'bg-gradient-to-r from-orange-700 to-orange-600 text-white';
            case 'C':
                return 'bg-zinc-600 text-white';
            case 'Community':
                return 'bg-blue-600 text-white';
            default:
                return 'bg-gray-500 text-white';
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Predefined rejection reasons
    const predefinedReasons = [
        'Incomplete tournament information',
        'Invalid prize pool details',
        'Unauthorized organizer',
        'Conflicting tournament schedule',
        'Insufficient registration details',
        'Missing contact information'
    ];

    return (
        <AdminLayout>
            <div className="min-h-screen bg-zinc-950 p-6">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Tournament Management</h1>
                            <p className="text-zinc-400">Review and manage tournament submissions</p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-zinc-400 text-sm mb-1">Pending Approval</p>
                                    <p className="text-3xl font-bold text-orange-400">{stats.pending}</p>
                                </div>
                                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-orange-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-zinc-400 text-sm mb-1">Approved</p>
                                    <p className="text-3xl font-bold text-green-400">{stats.approved}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-zinc-400 text-sm mb-1">Total Tournaments</p>
                                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                    <Trophy className="w-6 h-6 text-blue-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters Section */}
                    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                            {/* Search */}
                            <div className="lg:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="Search tournaments..."
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            {/* Approval Status */}
                            <select
                                value={filters.approvalStatus}
                                onChange={(e) => handleFilterChange('approvalStatus', e.target.value)}
                                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                            >
                                <option value="">All Approvals</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>

                            {/* Tournament Status */}
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                            >
                                <option value="">All Status</option>
                                <option value="announced">Announced</option>
                                <option value="registration_open">Registration Open</option>
                                <option value="registration_closed">Registration Closed</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>

                            {/* Tier */}
                            <select
                                value={filters.tier}
                                onChange={(e) => handleFilterChange('tier', e.target.value)}
                                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                            >
                                <option value="">All Tiers</option>
                                <option value="S">S Tier</option>
                                <option value="A">A Tier</option>
                                <option value="B">B Tier</option>
                                <option value="C">C Tier</option>
                                <option value="Community">Community</option>
                            </select>

                            {/* Game */}
                            <select
                                value={filters.gameTitle}
                                onChange={(e) => handleFilterChange('gameTitle', e.target.value)}
                                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                            >
                                <option value="">All Games</option>
                                <option value="BGMI">BGMI</option>
                                <option value="Multi-Game">Multi-Game</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tournaments Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-zinc-400">Loading tournaments...</p>
                        </div>
                    </div>
                ) : tournaments.length === 0 ? (
                    <div className="bg-zinc-900 rounded-lg p-12 border border-zinc-800 text-center">
                        <Trophy className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">No Tournaments Found</h3>
                        <p className="text-zinc-400">No tournaments match your current filters.</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-800 border-b border-zinc-700">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Tournament
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Organizer
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Dates
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Slots
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Prize Pool
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {tournaments.map((tournament) => (
                                            <tr key={tournament._id} className="hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                                                                <Trophy className="w-6 h-6 text-white" />
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-white truncate">
                                                                {tournament.tournamentName}
                                                            </p>
                                                            <div className="flex items-center space-x-2 mt-1">
                                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTierBadgeStyle(tournament.tier)}`}>
                                                                    {tournament.tier}
                                                                </span>
                                                                <span className="text-xs text-zinc-500">{tournament.gameTitle}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        <Building2 className="w-4 h-4 text-zinc-500" />
                                                        <span className="text-sm text-zinc-300">
                                                            {tournament.organizer?.name || 'N/A'}
                                                        </span>
                                                    </div>
                                                    {tournament.region && (
                                                        <div className="flex items-center space-x-1 mt-1">
                                                            <MapPin className="w-3 h-3 text-zinc-600" />
                                                            <span className="text-xs text-zinc-500">{tournament.region}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getApprovalStatusStyle(tournament._approvalStatus)}`}>
                                                            {tournament._approvalStatus}
                                                        </span>
                                                        <br />
                                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getTournamentStatusStyle(tournament.status)}`}>
                                                            {tournament.status?.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex items-center text-zinc-400">
                                                            <Calendar className="w-3 h-3 mr-1" />
                                                            <span>{formatDate(tournament.startDate)}</span>
                                                        </div>
                                                        <div className="text-zinc-500">
                                                            to {formatDate(tournament.endDate)}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        <Users className="w-4 h-4 text-zinc-500" />
                                                        <span className="text-sm text-zinc-300">
                                                            {tournament.slotsInfo?.filled || 0}/{tournament.slotsInfo?.total || 0}
                                                        </span>
                                                    </div>
                                                    {tournament.slotsInfo?.fillPercentage > 0 && (
                                                        <div className="mt-1">
                                                            <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                                                <div
                                                                    className="bg-orange-500 h-1.5 rounded-full"
                                                                    style={{ width: `${tournament.slotsInfo.fillPercentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        <DollarSign className="w-4 h-4 text-green-500" />
                                                        <span className="text-sm font-medium text-green-400">
                                                            {tournament.prizePoolDisplay || 'TBD'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleViewDetails(tournament)}
                                                            disabled={actionLoading}
                                                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {tournament._approvalStatus === 'pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleApprove(tournament._id)}
                                                                    disabled={actionLoading}
                                                                    className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectClick(tournament)}
                                                                    disabled={actionLoading}
                                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Reject"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between">
                                <div className="text-sm text-zinc-400">
                                    Showing {((pagination.current - 1) * filters.limit) + 1} to{' '}
                                    {Math.min(pagination.current * filters.limit, pagination.total)} of{' '}
                                    {pagination.total} tournaments
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handlePageChange(pagination.current - 1)}
                                        disabled={!pagination.hasPrev}
                                        className="px-3 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="px-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-800">
                                        Page {pagination.current} of {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(pagination.current + 1)}
                                        disabled={!pagination.hasNext}
                                        className="px-3 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Detail Modal */}
                {showDetailModal && selectedTournament && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                        <div className="bg-zinc-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-zinc-800">
                            {/* Modal Header */}
                            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between z-10">
                                <h2 className="text-2xl font-bold text-white">Tournament Details</h2>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-6">
                                {/* Tournament Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-zinc-500">Tournament Name</label>
                                                <p className="text-white font-medium">{selectedTournament.tournamentName}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Short Name</label>
                                                <p className="text-white">{selectedTournament.shortName || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Game Title</label>
                                                <p className="text-white">{selectedTournament.gameTitle}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Tier</label>
                                                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${getTierBadgeStyle(selectedTournament.tier)}`}>
                                                    {selectedTournament.tier}
                                                </span>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Region</label>
                                                <p className="text-white">{selectedTournament.region}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Format</label>
                                                <p className="text-white">{selectedTournament.format}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-4">Organizer Details</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-zinc-500">Organizer Name</label>
                                                <p className="text-white font-medium">{selectedTournament.organizer?.name || 'N/A'}</p>
                                            </div>
                                            {selectedTournament.organizer?.contactEmail && (
                                                <div>
                                                    <label className="text-xs text-zinc-500">Contact Email</label>
                                                    <p className="text-white">{selectedTournament.organizer.contactEmail}</p>
                                                </div>
                                            )}
                                            {selectedTournament.organizer?.website && (
                                                <div>
                                                    <label className="text-xs text-zinc-500">Website</label>
                                                    <a
                                                        href={selectedTournament.organizer.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300"
                                                    >
                                                        {selectedTournament.organizer.website}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Dates & Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-zinc-800 rounded-lg p-4">
                                        <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
                                        <p className="text-white font-medium">{formatDate(selectedTournament.startDate)}</p>
                                    </div>
                                    <div className="bg-zinc-800 rounded-lg p-4">
                                        <label className="text-xs text-zinc-500 block mb-1">End Date</label>
                                        <p className="text-white font-medium">{formatDate(selectedTournament.endDate)}</p>
                                    </div>
                                    <div className="bg-zinc-800 rounded-lg p-4">
                                        <label className="text-xs text-zinc-500 block mb-1">Prize Pool</label>
                                        <p className="text-green-400 font-medium">{selectedTournament.prizePoolDisplay || 'TBD'}</p>
                                    </div>
                                </div>

                                {/* Slots Info */}
                                <div className="bg-zinc-800 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3">Slots Information</h3>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-500">Total</label>
                                            <p className="text-white font-medium text-lg">{selectedTournament.slotsInfo?.total || 0}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500">Filled</label>
                                            <p className="text-green-400 font-medium text-lg">{selectedTournament.slotsInfo?.filled || 0}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500">Registered</label>
                                            <p className="text-blue-400 font-medium text-lg">{selectedTournament.slotsInfo?.registered || 0}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500">Available</label>
                                            <p className="text-zinc-400 font-medium text-lg">{selectedTournament.slotsInfo?.available || 0}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Registration Stats */}
                                {selectedTournament.registrationStats && (
                                    <div className="bg-zinc-800 rounded-lg p-4">
                                        <h3 className="text-sm font-semibold text-white mb-3">Registration Statistics</h3>
                                        <div className="grid grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-xs text-zinc-500">Pending</label>
                                                <p className="text-orange-400 font-medium text-lg">{selectedTournament.registrationStats.pending || 0}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Approved</label>
                                                <p className="text-green-400 font-medium text-lg">{selectedTournament.registrationStats.approved || 0}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Rejected</label>
                                                <p className="text-red-400 font-medium text-lg">{selectedTournament.registrationStats.rejected || 0}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-zinc-500">Checked In</label>
                                                <p className="text-blue-400 font-medium text-lg">{selectedTournament.registrationStats.checked_in || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Approval Status Section */}
                                <div className="bg-zinc-800 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3">Approval Information</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-zinc-500">Status</label>
                                            <div className="mt-1">
                                                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded border ${getApprovalStatusStyle(selectedTournament._approvalStatus)}`}>
                                                    {selectedTournament._approvalStatus}
                                                </span>
                                            </div>
                                        </div>
                                        {selectedTournament._approvedBy && (
                                            <div>
                                                <label className="text-xs text-zinc-500">Approved By</label>
                                                <p className="text-white">{selectedTournament._approvedBy.username} ({selectedTournament._approvedBy.email})</p>
                                                <p className="text-xs text-zinc-500">{formatDate(selectedTournament._approvedAt)}</p>
                                            </div>
                                        )}
                                        {selectedTournament._rejectedBy && (
                                            <>
                                                <div>
                                                    <label className="text-xs text-zinc-500">Rejected By</label>
                                                    <p className="text-white">{selectedTournament._rejectedBy.username} ({selectedTournament._rejectedBy.email})</p>
                                                    <p className="text-xs text-zinc-500">{formatDate(selectedTournament._rejectedAt)}</p>
                                                </div>
                                                {selectedTournament._rejectionReason && (
                                                    <div>
                                                        <label className="text-xs text-zinc-500">Rejection Reason</label>
                                                        <p className="text-red-400 italic">{selectedTournament._rejectionReason}</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800">
                                    {selectedTournament._approvalStatus === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleApprove(selectedTournament._id)}
                                                disabled={actionLoading}
                                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                <span>Approve Tournament</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowDetailModal(false);
                                                    handleRejectClick(selectedTournament);
                                                }}
                                                disabled={actionLoading}
                                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                                            >
                                                <XCircle className="w-5 h-5" />
                                                <span>Reject Tournament</span>
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="px-6 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reject Modal */}
                {showRejectModal && selectedTournament && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                        <div className="bg-zinc-900 rounded-lg max-w-2xl w-full border border-zinc-800">
                            {/* Modal Header */}
                            <div className="border-b border-zinc-800 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                            <AlertCircle className="w-6 h-6 text-red-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Reject Tournament</h2>
                                            <p className="text-sm text-zinc-400">{selectedTournament.tournamentName}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowRejectModal(false)}
                                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Rejection Reason <span className="text-red-400">*</span>
                                    </label>
                                    <p className="text-xs text-zinc-500 mb-3">
                                        Please provide a detailed reason (minimum 10 characters, maximum 500)
                                    </p>

                                    {/* Predefined Reasons */}
                                    <div className="mb-3">
                                        <label className="block text-xs text-zinc-500 mb-2">Quick Select:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {predefinedReasons.map((reason, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setRejectionReason(reason)}
                                                    className="px-3 py-1 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                                                >
                                                    {reason}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={6}
                                        maxLength={500}
                                        placeholder="Enter detailed rejection reason..."
                                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 resize-none"
                                    />
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-zinc-500">
                                            {rejectionReason.length}/500 characters
                                        </p>
                                        {rejectionReason.length > 0 && rejectionReason.length < 10 && (
                                            <p className="text-xs text-red-400">
                                                Minimum 10 characters required
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end space-x-3 pt-4">
                                    <button
                                        onClick={() => setShowRejectModal(false)}
                                        disabled={actionLoading}
                                        className="px-6 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={actionLoading || rejectionReason.trim().length < 10}
                                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {actionLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Rejecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-5 h-5" />
                                                <span>Confirm Rejection</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminTournaments;
