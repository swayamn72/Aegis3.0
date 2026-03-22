import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Trophy, Users, Calendar, Settings, Upload, Bell, CheckCircle, XCircle, Clock } from 'lucide-react';
import Overview from './components/Overview';
import Tournaments from './components/Tournaments';
import { lazy, Suspense } from 'react';
const Teams = lazy(() => import('./components/Teams'));
const SettingsTab = lazy(() => import('./components/Settings'));
import CreateTournamentModal from './components/CreateTournamentModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from 'react-toastify';
import ToastConfig from '../components/ToastConfig';
import axiosInstance from '../utils/axiosConfig';

// Query functions
const fetchOrganizationData = async () => {
    const { data } = await axiosInstance.get('/api/organizations/profile');
    return data.organization;
};

const fetchTournaments = async () => {
    const { data } = await axiosInstance.get('/api/org-tournaments/my-tournaments');
    return data.tournaments || [];
};

const OrgDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const { logout } = useAuth();
    const queryClient = useQueryClient();

    // TanStack Query: Fetch organization data
    const {
        data: organization,
        isLoading: loading,
        isError,
        error: errorDetails,
    } = useQuery({
        queryKey: ['organizationProfile'],
        queryFn: fetchOrganizationData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    // TanStack Query: Fetch tournaments (only if org is approved)
    const {
        data: tournaments = [],
        isLoading: tournamentsLoading,
    } = useQuery({
        queryKey: ['organizationTournaments'],
        queryFn: fetchTournaments,
        enabled: organization?.approvalStatus === 'approved',
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    // Mutation: Upload logo
    const uploadLogoMutation = useMutation({
        mutationFn: async (formData) => {
            const { data } = await axiosInstance.post('/api/organizations/upload-logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return data;
        },
        onSuccess: (data) => {
            toast.success('Logo uploaded successfully!');
            queryClient.setQueryData(['organizationProfile'], (old) => ({
                ...old,
                logo: data.logoUrl,
            }));
        },
        onError: (err) => {
            console.error('Logo upload error:', err);
            toast.error('Error uploading logo: ' + (err.message || err.error));
        },
    });

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    const handleLogoChange = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('logo', file);

            await uploadLogoMutation.mutateAsync(uploadFormData);
            toast.success('Organization logo updated!');
        } catch (error) {
            console.error('Error uploading logo:', error);
            toast.error(error.response?.data?.message || 'Failed to upload logo');
        } finally {
            setUploading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock, text: 'Pending Approval' },
            approved: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, text: 'Approved' },
            rejected: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, text: 'Rejected' }
        };

        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${badge.color}`}>
                <Icon className="w-3 h-3" />
                {badge.text}
            </span>
        );
    };

    const getTournamentStatusBadge = (status) => {
        const colors = {
            announced: 'bg-blue-500/20 text-blue-400',
            registration_open: 'bg-green-500/20 text-green-400',
            in_progress: 'bg-red-500/20 text-red-400',
            completed: 'bg-gray-500/20 text-gray-400'
        };

        return (
            <span className={`px-2 py-1 text-xs rounded-full ${colors[status] || colors.announced}`}>
                {status?.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    if (loading || tournamentsLoading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
    }

    if (isError) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-500">Error: {errorDetails?.message || 'Failed to fetch organization profile'}</div>;
    }

    if (!organization) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">No organization data available.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <ToastConfig />
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-8 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">{organization.orgName}</h1>
                        {getStatusBadge(organization.approvalStatus)}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold transition"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-8">
                    <nav className="flex gap-6">
                        {(organization.approvalStatus === 'approved' ? ['overview', 'tournaments', 'teams', 'settings'] : ['overview']).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 px-2 border-b-2 transition ${activeTab === tab
                                    ? 'border-orange-500 text-orange-500'
                                    : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-8">
                {activeTab === 'overview' && (
                    <Overview
                        organization={organization}
                        tournaments={tournaments}
                        uploading={uploading}
                        handleLogoChange={handleLogoChange}
                        handleFileUpload={handleFileUpload}
                        fileInputRef={fileInputRef}
                        getStatusBadge={getStatusBadge}
                    />
                )}

                {activeTab === 'tournaments' && (
                    <Tournaments
                        tournaments={tournaments}
                        organization={organization}
                        setShowCreateModal={setShowCreateModal}
                        navigate={navigate}
                        getTournamentStatusBadge={getTournamentStatusBadge}
                    />
                )}

                {activeTab === 'teams' && (
                    <Suspense fallback={<div className="text-white">Loading Teams...</div>}>
                        <Teams organization={organization} />
                    </Suspense>
                )}

                {activeTab === 'settings' && (
                    <Suspense fallback={<div className="text-white">Loading Settings...</div>}>
                        <SettingsTab />
                    </Suspense>
                )}
            </main>

            {/* Create Tournament Modal */}
            {showCreateModal && (
                <CreateTournamentModal
                    organization={organization}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                    }}
                // Pass additional props as needed
                />
            )}

        </div>
    );
};

// ...existing code...
export default OrgDashboard;