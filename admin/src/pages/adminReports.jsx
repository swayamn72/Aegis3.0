import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, Filter, ShieldAlert } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { fetchReportsAPI, updateReportStatusAPI } from '../api/adminApi';

const STATUS_OPTIONS = ['open', 'in_review', 'actioned', 'dismissed'];

const statusBadgeClass = (status) => {
    switch (status) {
        case 'open':
            return 'bg-red-500/20 text-red-300 border-red-500/30';
        case 'in_review':
            return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        case 'actioned':
            return 'bg-green-500/20 text-green-300 border-green-500/30';
        case 'dismissed':
            return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
        default:
            return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
    }
};

const AdminReports = () => {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('');
    const [reasonFilter, setReasonFilter] = useState('');
    const [noteDraft, setNoteDraft] = useState({});

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['adminReports', statusFilter, reasonFilter],
        queryFn: () => fetchReportsAPI({ status: statusFilter || undefined, reason: reasonFilter || undefined, limit: 50 }),
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000,
    });

    const updateStatusMutation = useMutation({
        mutationFn: updateReportStatusAPI,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminReports'] });
        },
    });

    const reports = useMemo(() => data?.reports || [], [data]);

    const handleStatusUpdate = (reportId, status) => {
        updateStatusMutation.mutate({
            reportId,
            status,
            adminNotes: noteDraft[reportId] || '',
        });
    };

    return (
        <AdminLayout>
            <div className="py-6 space-y-6">
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert className="w-6 h-6 text-orange-400" />
                        <h1 className="text-2xl font-bold text-white">Moderation Reports</h1>
                    </div>
                    <p className="text-zinc-400 text-sm">Review and action user abuse reports submitted from profile and chat surfaces.</p>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="flex items-center gap-2 text-zinc-300 text-sm">
                        <Filter className="w-4 h-4" />
                        Filters
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                        <option value="">All statuses</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <input
                        value={reasonFilter}
                        onChange={(e) => setReasonFilter(e.target.value)}
                        placeholder="Reason (e.g. harassment)"
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white md:w-72"
                    />
                </div>

                {isLoading && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-zinc-300">Loading reports...</div>
                )}

                {isError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
                        {error?.error || error?.message || 'Failed to load reports'}
                    </div>
                )}

                {!isLoading && !isError && reports.length === 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-zinc-400">No reports found.</div>
                )}

                {!isLoading && !isError && reports.length > 0 && (
                    <div className="space-y-4">
                        {reports.map((report) => (
                            <div key={report._id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div>
                                        <div className="text-white font-semibold">{report.reason}</div>
                                        <div className="text-xs text-zinc-400">Reported {new Date(report.createdAt).toLocaleString()}</div>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full border w-fit ${statusBadgeClass(report.status)}`}>
                                        {report.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3">
                                        <div className="text-zinc-400 text-xs mb-1">Reporter</div>
                                        <div className="text-white">{report.reporter?.username || 'Unknown'}</div>
                                    </div>
                                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3">
                                        <div className="text-zinc-400 text-xs mb-1">Target</div>
                                        <div className="text-white">{report.target?.user?.username || 'Unknown'}</div>
                                    </div>
                                </div>

                                {report.details ? (
                                    <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-3 text-zinc-200 text-sm whitespace-pre-wrap">
                                        {report.details}
                                    </div>
                                ) : (
                                    <div className="text-xs text-zinc-500">No additional details provided.</div>
                                )}

                                <textarea
                                    value={noteDraft[report._id] ?? report.adminNotes ?? ''}
                                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [report._id]: e.target.value }))}
                                    rows={2}
                                    placeholder="Admin notes"
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm text-white"
                                />

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleStatusUpdate(report._id, 'in_review')}
                                        className="px-3 py-1.5 rounded-lg bg-yellow-600/20 border border-yellow-500/40 text-yellow-300 text-sm flex items-center gap-1"
                                    >
                                        <Clock3 className="w-4 h-4" /> In Review
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(report._id, 'actioned')}
                                        className="px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/40 text-green-300 text-sm flex items-center gap-1"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Actioned
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(report._id, 'dismissed')}
                                        className="px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-500/40 text-zinc-300 text-sm flex items-center gap-1"
                                    >
                                        <AlertTriangle className="w-4 h-4" /> Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminReports;
