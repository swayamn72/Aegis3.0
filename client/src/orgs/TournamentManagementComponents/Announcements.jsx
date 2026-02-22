import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Megaphone, Send, Globe, Users, Target, Grid3x3,
    Clock, CheckCircle, X, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';

// ─── helpers ─────────────────────────────────────────────────────────────────

const TARGET_TYPES = [
    {
        id: 'general',
        label: 'Everyone',
        description: 'Visible to all on the tournament page — no DM sent',
        icon: Globe,
        color: 'blue',
    },
    {
        id: 'specific_teams',
        label: 'Specific Teams',
        description: 'DM sent to all players of the selected teams',
        icon: Users,
        color: 'purple',
    },
    {
        id: 'phase',
        label: 'Phase Teams',
        description: 'DM sent to all players whose team is in a phase',
        icon: Target,
        color: 'orange',
    },
    {
        id: 'group',
        label: 'Group Teams',
        description: 'DM sent to all players in a specific group',
        icon: Grid3x3,
        color: 'green',
    },
];

const COLOR_MAP = {
    blue: { pill: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: 'bg-blue-500/20 text-blue-400', ring: 'ring-blue-500' },
    purple: { pill: 'bg-purple-500/20 text-purple-400 border-purple-500/40', icon: 'bg-purple-500/20 text-purple-400', ring: 'ring-purple-500' },
    orange: { pill: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: 'bg-orange-500/20 text-orange-400', ring: 'ring-orange-500' },
    green: { pill: 'bg-green-500/20 text-green-400 border-green-500/40', icon: 'bg-green-500/20 text-green-400', ring: 'ring-green-500' },
};

function targetLabel(ann) {
    if (ann.targetType === 'general') return { label: '🌐 Everyone', color: 'blue' };
    if (ann.targetType === 'specific_teams') return { label: `👥 ${ann.targetTeams?.length ?? 0} Team(s)`, color: 'purple' };
    if (ann.targetType === 'phase') return { label: `🏁 Phase: ${ann.targetPhase}`, color: 'orange' };
    if (ann.targetType === 'group') return { label: `📦 ${ann.targetPhase} › ${ann.targetGroup}`, color: 'green' };
    return { label: ann.targetType, color: 'blue' };
}

// ─── Announcement history card ────────────────────────────────────────────────

function AnnouncementCard({ ann }) {
    const [expanded, setExpanded] = useState(false);
    const { label, color } = targetLabel(ann);
    const colors = COLOR_MAP[color];

    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-all">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors.pill}`}>
                            {label}
                        </span>
                        {ann.dmsSent > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600">
                                {ann.dmsSent} DMs sent
                            </span>
                        )}
                    </div>
                    <h4 className="text-white font-semibold text-sm">{ann.title}</h4>
                    <p className={`text-gray-400 text-sm mt-1 ${expanded ? '' : 'line-clamp-2'}`}>
                        {ann.message}
                    </p>
                    {ann.message.length > 120 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-xs text-orange-400 hover:text-orange-300 mt-1 flex items-center gap-1"
                        >
                            {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
                        </button>
                    )}
                    {ann.targetType === 'specific_teams' && ann.targetTeams?.length > 0 && expanded && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {ann.targetTeams.map((t) => (
                                <span key={t._id} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                                    {t.teamName}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                    {new Date(ann.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                    })}
                </span>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const Announcements = ({ tournament }) => {
    const tournamentId = tournament?._id;
    const queryClient = useQueryClient();

    // ── Form state
    const [targetType, setTargetType] = useState('general');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetPhase, setTargetPhase] = useState('');
    const [targetGroup, setTargetGroup] = useState('');
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);

    // ── Fetch past announcements
    const {
        data,
        isLoading: historyLoading,
    } = useQuery({
        queryKey: ['org-announcements', tournamentId],
        queryFn: async () => {
            const { data } = await axiosInstance.get(
                `/api/org-tournaments/${tournamentId}/announcements`
            );
            return data;
        },
        enabled: !!tournamentId,
        staleTime: 15 * 1000,
    });

    const announcements = data?.announcements || [];

    // ── Create mutation
    const createMutation = useMutation({
        mutationFn: async (payload) => {
            const { data } = await axiosInstance.post(
                `/api/org-tournaments/${tournamentId}/announcements`,
                payload
            );
            return data;
        },
        onSuccess: (data) => {
            const sent = data.announcement?.dmsSent;
            toast.success(
                sent > 0
                    ? `Announcement sent! ${sent} player(s) notified via DM.`
                    : 'Announcement posted!'
            );
            queryClient.invalidateQueries(['org-announcements', tournamentId]);
            // Reset form
            setTitle('');
            setMessage('');
            setTargetPhase('');
            setTargetGroup('');
            setSelectedTeamIds([]);
            setTargetType('general');
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Failed to send announcement');
        },
    });

    // ── Derived data from tournament
    const phases = tournament?.phases || [];
    const groupsForPhase = phases.find((p) => p.name === targetPhase)?.groups || [];

    // Participating teams (populated from registration)
    const participatingTeams = (tournament?.participatingTeams || []).map((pt) => ({
        _id: (pt.team?._id || pt._id || pt)?.toString(),
        teamName: pt.team?.teamName || pt.teamName || 'Unknown Team',
        teamTag: pt.team?.teamTag || pt.teamTag || '',
        logo: pt.team?.logo || pt.logo || null,
    }));

    const toggleTeam = (teamId) => {
        setSelectedTeamIds((prev) =>
            prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            toast.error('Title and message are required');
            return;
        }
        if (targetType === 'specific_teams' && selectedTeamIds.length === 0) {
            toast.error('Select at least one team');
            return;
        }
        if ((targetType === 'phase' || targetType === 'group') && !targetPhase) {
            toast.error('Select a phase');
            return;
        }
        if (targetType === 'group' && !targetGroup) {
            toast.error('Select a group');
            return;
        }

        createMutation.mutate({
            title: title.trim(),
            message: message.trim(),
            targetType,
            targetTeams: targetType === 'specific_teams' ? selectedTeamIds : [],
            targetPhase: (targetType === 'phase' || targetType === 'group') ? targetPhase : undefined,
            targetGroup: targetType === 'group' ? targetGroup : undefined,
        });
    };

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">Announcements</h2>
                    <p className="text-gray-400 text-sm">Send targeted messages to teams or broadcast to everyone</p>
                </div>
            </div>

            {/* Create Form */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
                    <Send className="w-4 h-4 text-orange-400" />
                    New Announcement
                </h3>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Target type selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Audience</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {TARGET_TYPES.map((t) => {
                                const Icon = t.icon;
                                const colors = COLOR_MAP[t.color];
                                const active = targetType === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            setTargetType(t.id);
                                            setSelectedTeamIds([]);
                                            setTargetPhase('');
                                            setTargetGroup('');
                                        }}
                                        className={`p-3 rounded-xl border text-left transition-all ${active
                                                ? `${colors.pill} ring-1 ${colors.ring}`
                                                : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
                                            }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${active ? colors.icon : 'bg-gray-600 text-gray-400'}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <p className="text-xs font-semibold">{t.label}</p>
                                        <p className="text-[10px] mt-0.5 opacity-70 leading-tight">{t.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Specific teams picker */}
                    {targetType === 'specific_teams' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Select Teams <span className="text-gray-500">({selectedTeamIds.length} selected)</span>
                            </label>
                            {participatingTeams.length === 0 ? (
                                <div className="bg-gray-700/50 rounded-lg p-4 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    No registered teams found
                                </div>
                            ) : (
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                    {participatingTeams.map((team) => {
                                        const checked = selectedTeamIds.includes(team._id);
                                        return (
                                            <label
                                                key={team._id}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${checked
                                                        ? 'bg-purple-500/10 border-purple-500/40'
                                                        : 'bg-gray-700/40 border-gray-600 hover:border-gray-500'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleTeam(team._id)}
                                                    className="accent-purple-500 w-4 h-4 shrink-0"
                                                />
                                                {team.logo ? (
                                                    <img src={team.logo} alt={team.teamName} className="w-8 h-8 rounded-md object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gray-600 rounded-md flex items-center justify-center text-xs font-bold text-gray-300">
                                                        {team.teamTag?.slice(0, 2) || team.teamName?.slice(0, 2)}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-white text-sm font-medium">{team.teamName}</p>
                                                    {team.teamTag && <p className="text-gray-400 text-xs">[{team.teamTag}]</p>}
                                                </div>
                                                {checked && <CheckCircle className="w-4 h-4 text-purple-400 ml-auto shrink-0" />}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phase selector */}
                    {(targetType === 'phase' || targetType === 'group') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Phase</label>
                            {phases.length === 0 ? (
                                <div className="bg-gray-700/50 rounded-lg p-3 text-center text-gray-400 text-sm">
                                    No phases configured for this tournament
                                </div>
                            ) : (
                                <select
                                    value={targetPhase}
                                    onChange={(e) => { setTargetPhase(e.target.value); setTargetGroup(''); }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="">-- Select a phase --</option>
                                    {phases.map((p, i) => (
                                        <option key={i} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Group selector */}
                    {targetType === 'group' && targetPhase && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Group</label>
                            {groupsForPhase.length === 0 ? (
                                <div className="bg-gray-700/50 rounded-lg p-3 text-center text-gray-400 text-sm">
                                    No groups in this phase
                                </div>
                            ) : (
                                <select
                                    value={targetGroup}
                                    onChange={(e) => setTargetGroup(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">-- Select a group --</option>
                                    {groupsForPhase.map((g, i) => (
                                        <option key={i} value={g.name}>{g.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={200}
                            placeholder="e.g. Match Schedule Update"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={2000}
                            rows={4}
                            placeholder="Write your announcement here..."
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                        <p className="text-right text-xs text-gray-500 mt-1">{message.length}/2000</p>
                    </div>

                    {/* Preview badge */}
                    <div className="bg-gray-700/40 border border-gray-600 rounded-lg px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-gray-500" />
                        {targetType === 'general'
                            ? 'This will be publicly visible on the tournament page. No DMs will be sent.'
                            : `A system DM will be sent to every player in the selected ${targetType === 'specific_teams' ? 'teams' : targetType === 'phase' ? 'phase' : 'group'}.`}
                    </div>

                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                    >
                        {createMutation.isPending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Send Announcement
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* History */}
            <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    Announcement History
                    {announcements.length > 0 && (
                        <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{announcements.length}</span>
                    )}
                </h3>

                {historyLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 animate-pulse">
                                <div className="h-3 w-24 bg-gray-700 rounded mb-2" />
                                <div className="h-4 w-48 bg-gray-700 rounded mb-2" />
                                <div className="h-3 w-full bg-gray-700 rounded" />
                            </div>
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-16 bg-gray-800/30 border border-gray-700 rounded-xl">
                        <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No announcements yet</p>
                        <p className="text-gray-500 text-sm mt-1">Create your first announcement above</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {announcements.map((ann) => (
                            <AnnouncementCard key={ann._id} ann={ann} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Announcements;
