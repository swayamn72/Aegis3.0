import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../utils/axiosConfig';
import Navbar from '../components/Navbar';
import {
    Gamepad2, Plus, Edit, Trash2, Star, AlertCircle,
    Trophy, Calendar, Shield, X, Zap, Lock, CheckCircle
} from 'lucide-react';

// ─── API Functions ──────────────────────────────────────────────
const fetchGameIds = async () => {
    const { data } = await axiosInstance.get('/api/players/game-ids');
    return data;
};

const addGameId = async (payload) => {
    const { data } = await axiosInstance.post('/api/players/game-ids', payload);
    return data;
};

const updateGameId = async ({ index, payload }) => {
    const { data } = await axiosInstance.put(`/api/players/game-ids/${index}`, payload);
    return data;
};

const deleteGameId = async (index) => {
    const { data } = await axiosInstance.delete(`/api/players/game-ids/${index}`);
    return data;
};

const setPrimaryGameId = async (index) => {
    const { data } = await axiosInstance.put(`/api/players/game-ids/${index}/set-primary`);
    return data;
};

// ─── Modal Component ─────────────────────────────────────────────
const GameIdModal = ({ mode, initialData, onClose, onSubmit, isLoading }) => {
    const [formData, setFormData] = useState(
        initialData || { inGameName: '', characterId: '', isPrimary: false }
    );

    const handleSubmit = () => {
        if (!formData.inGameName.trim() || !formData.characterId.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {/* Scanline overlay */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,69,0,0.015) 2px, rgba(255,69,0,0.015) 4px)' }} />

            <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden">
                {/* Top accent bar */}
                <div className="h-1 w-full bg-gradient-to-r from-[#FF4500] via-orange-400 to-transparent" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-[#FF4500]/10 border border-[#FF4500]/30 flex items-center justify-center">
                                <Gamepad2 className="w-4 h-4 text-[#FF4500]" />
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-white">
                                {mode === 'add' ? 'ADD GAME ID' : 'UPDATE GAME ID'}
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                In-Game Name
                            </label>
                            <input
                                type="text"
                                value={formData.inGameName}
                                onChange={(e) => setFormData({ ...formData, inGameName: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#FF4500]/50 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF4500]/30 transition-all font-mono text-sm"
                                placeholder="YourGameTag#1234"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                Character ID
                            </label>
                            <input
                                type="text"
                                value={formData.characterId}
                                onChange={(e) => setFormData({ ...formData, characterId: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#FF4500]/50 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#FF4500]/30 transition-all font-mono text-sm"
                                placeholder="000000000"
                            />
                        </div>

                        {mode === 'add' && (
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isPrimary: !formData.isPrimary })}
                                className={`w-full flex items-center gap-3 rounded-lg p-3 border transition-all text-sm font-semibold ${formData.isPrimary
                                        ? 'bg-[#FF4500]/10 border-[#FF4500]/40 text-[#FF4500]'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                    }`}
                            >
                                <Star className={`w-4 h-4 ${formData.isPrimary ? 'fill-current' : ''}`} />
                                SET AS PRIMARY GAME ID
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wider"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="flex-1 bg-[#FF4500] hover:bg-[#FF4500]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>{mode === 'add' ? <Plus className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}</>
                            )}
                            {mode === 'add' ? 'ADD' : 'UPDATE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────
const MyGameIdsPage = () => {
    const queryClient = useQueryClient();
    const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', index?: number }

    const { data, isLoading } = useQuery({
        queryKey: ['gameIds'],
        queryFn: fetchGameIds,
        staleTime: 2 * 60 * 1000,
        onError: () => toast.error('Failed to load game IDs'),
    });

    const gameIds = data?.gameIds || [];
    const canUpdate = data?.canUpdate ?? true;
    const updateReason = data?.reason;
    const nextUpdateAllowed = data?.nextUpdateAllowed;
    const tournamentStatus = data?.tournamentStatus;

    const invalidate = () => queryClient.invalidateQueries(['gameIds']);

    const addMutation = useMutation({
        mutationFn: addGameId,
        onSuccess: () => { toast.success('Game ID added!'); invalidate(); setModal(null); },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to add game ID'),
    });

    const updateMutation = useMutation({
        mutationFn: updateGameId,
        onSuccess: () => { toast.success('Game ID updated!'); invalidate(); setModal(null); },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update game ID'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteGameId,
        onSuccess: () => { toast.success('Game ID deleted'); invalidate(); },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete game ID'),
    });

    const primaryMutation = useMutation({
        mutationFn: setPrimaryGameId,
        onSuccess: () => { toast.success('Primary game ID updated'); invalidate(); },
        onError: () => toast.error('Failed to set primary game ID'),
    });

    const handleDelete = (index) => {
        if (!window.confirm('Are you sure you want to delete this game ID?')) return;
        deleteMutation.mutate(index);
    };

    const handleModalSubmit = (formData) => {
        if (modal.mode === 'add') {
            addMutation.mutate(formData);
        } else {
            updateMutation.mutate({
                index: modal.index,
                payload: { inGameName: formData.inGameName, characterId: formData.characterId }
            });
        }
    };

    const isMutating = addMutation.isLoading || updateMutation.isLoading;
    const locked = tournamentStatus?.inTournament;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="relative mx-auto w-16 h-16 mb-6">
                        <div className="absolute inset-0 rounded-full border-2 border-[#FF4500]/20 animate-ping" />
                        <div className="absolute inset-2 rounded-full border-2 border-[#FF4500]/40 animate-spin border-t-[#FF4500]" />
                        <Gamepad2 className="absolute inset-0 m-auto w-6 h-6 text-[#FF4500]" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">LOADING GAME IDS...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-zinc-950 text-white font-sans pt-20 overflow-hidden">
            <Navbar />
            {/* Grid pattern background */}
            <div className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,69,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,69,0,0.03) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }} />

            {/* Radial glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center top, rgba(255,69,0,0.06) 0%, transparent 70%)' }} />

            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* ── Page Header ── */}
                <div className="mb-10">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF4500] mb-2 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> IDENTITY MANAGEMENT
                    </p>
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-3">
                        MY GAME IDs
                    </h1>
                    <p className="text-zinc-500 text-sm">
                        Manage your in-game identities. Up to 2 game IDs supported.
                    </p>
                </div>

                {/* ── Stats Bar ── */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'REGISTERED', value: gameIds.length, max: 2, color: 'text-[#FF4500]', ring: 'ring-[#FF4500]', bg: 'bg-[#FF4500]/10' },
                        { label: 'SLOTS LEFT', value: 2 - gameIds.length, max: 2, color: 'text-cyan-400', ring: 'ring-cyan-400', bg: 'bg-cyan-500/10' },
                        { label: 'STATUS', value: locked ? 'LOCKED' : canUpdate ? 'ACTIVE' : 'COOLDOWN', color: locked ? 'text-red-400' : canUpdate ? 'text-green-400' : 'text-yellow-400', ring: locked ? 'ring-red-400' : canUpdate ? 'ring-green-400' : 'ring-yellow-400', bg: locked ? 'bg-red-500/10' : canUpdate ? 'bg-green-500/10' : 'bg-yellow-500/10' },
                    ].map((stat) => (
                        <div key={stat.label} className={`${stat.bg} border border-zinc-800 rounded-xl p-4 ring-1 ${stat.ring}/20`}>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">{stat.label}</p>
                            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Alert Banners ── */}
                {locked && (
                    <div className="flex items-start gap-3 bg-orange-500/5 border border-orange-500/30 rounded-xl p-4 mb-4">
                        <Trophy className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-orange-300 font-bold text-sm uppercase tracking-wider mb-1">TOURNAMENT LOCK ACTIVE</p>
                            <p className="text-orange-200/70 text-sm">
                                Registered in <strong className="text-orange-300">{tournamentStatus.tournamentName}</strong>. Game IDs are locked until this tournament ends.
                            </p>
                        </div>
                    </div>
                )}

                {!canUpdate && !locked && nextUpdateAllowed && (
                    <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 mb-4">
                        <Calendar className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-yellow-300 font-bold text-sm uppercase tracking-wider mb-1">MONTHLY LIMIT REACHED</p>
                            <p className="text-yellow-200/70 text-sm">
                                Next update available on <strong className="text-yellow-300">{new Date(nextUpdateAllowed).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-8">
                    <AlertCircle className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                    <p className="text-zinc-600 text-xs leading-relaxed">
                        Game IDs can be updated <span className="text-zinc-400 font-semibold">once per month</span>. IDs cannot be changed during active tournaments. Your primary ID is used for all tournament registrations.
                    </p>
                </div>

                {/* ── Game IDs List ── */}
                <div className="space-y-4 mb-6">
                    {gameIds.length === 0 ? (
                        <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center">
                            <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-zinc-700" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-600 mb-2">NO GAME IDS REGISTERED</h3>
                            <p className="text-zinc-700 text-sm mb-6">Add your game ID to register for tournaments</p>
                            {!locked && (
                                <button
                                    onClick={() => setModal({ mode: 'add' })}
                                    className="inline-flex items-center gap-2 bg-[#FF4500] hover:bg-[#FF4500]/90 text-white px-6 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wider"
                                >
                                    <Plus className="w-4 h-4" />
                                    ADD FIRST GAME ID
                                </button>
                            )}
                        </div>
                    ) : (
                        gameIds.map((gameId, index) => (
                            <div
                                key={index}
                                className={`relative bg-zinc-900/50 border rounded-xl overflow-hidden transition-all group ${gameId.isPrimary ? 'border-[#FF4500]/40' : 'border-zinc-800 hover:border-zinc-700'
                                    }`}
                            >
                                {/* Primary indicator bar */}
                                {gameId.isPrimary && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#FF4500] to-orange-600" />
                                )}

                                <div className="p-5 pl-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Name + Badge */}
                                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                <h3 className="text-xl font-black text-white tracking-tight">
                                                    {gameId.inGameName}
                                                </h3>
                                                {gameId.isPrimary && (
                                                    <span className="inline-flex items-center gap-1.5 bg-[#FF4500]/10 text-[#FF4500] border border-[#FF4500]/30 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        PRIMARY
                                                    </span>
                                                )}
                                            </div>

                                            {/* Meta */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Character ID</p>
                                                    <p className="text-sm font-mono text-zinc-300">{gameId.characterId}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Added</p>
                                                    <p className="text-sm text-zinc-400">{new Date(gameId.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                {gameId.lastUpdatedAt && gameId.lastUpdatedAt !== gameId.createdAt && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Last Updated</p>
                                                        <p className="text-sm text-zinc-400">{new Date(gameId.lastUpdatedAt).toLocaleDateString()}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {!gameId.isPrimary && !locked && (
                                                <button
                                                    onClick={() => primaryMutation.mutate(index)}
                                                    disabled={primaryMutation.isLoading}
                                                    title="Set as primary"
                                                    className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-500 hover:text-[#FF4500] hover:border-[#FF4500]/40 hover:bg-[#FF4500]/5 transition-all"
                                                >
                                                    <Star className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setModal({ mode: 'edit', index })}
                                                disabled={!canUpdate || locked}
                                                title={!canUpdate ? updateReason : locked ? 'Locked during tournament' : 'Edit game ID'}
                                                className={`p-2 rounded-lg border transition-all ${canUpdate && !locked
                                                        ? 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-500/5'
                                                        : 'bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed'
                                                    }`}
                                            >
                                                {canUpdate && !locked ? <Edit className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                            </button>

                                            <button
                                                onClick={() => handleDelete(index)}
                                                disabled={locked || deleteMutation.isLoading}
                                                title={locked ? 'Cannot delete during tournament' : 'Delete game ID'}
                                                className={`p-2 rounded-lg border transition-all ${!locked
                                                        ? 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-400/40 hover:bg-red-500/5'
                                                        : 'bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed'
                                                    }`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom accent on hover */}
                                <div className="h-px w-0 group-hover:w-full bg-gradient-to-r from-[#FF4500] to-transparent transition-all duration-500" />
                            </div>
                        ))
                    )}
                </div>

                {/* ── Add Button ── */}
                {gameIds.length > 0 && gameIds.length < 2 && !locked && (
                    <button
                        onClick={() => setModal({ mode: 'add' })}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-900/50 hover:bg-[#FF4500]/10 border border-dashed border-zinc-800 hover:border-[#FF4500]/40 text-zinc-600 hover:text-[#FF4500] px-6 py-4 rounded-xl transition-all text-sm font-bold uppercase tracking-wider group"
                    >
                        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        ADD ANOTHER GAME ID ({2 - gameIds.length} SLOT REMAINING)
                    </button>
                )}
            </div>

            {/* ── Modal ── */}
            {modal && (
                <GameIdModal
                    mode={modal.mode}
                    initialData={modal.mode === 'edit' ? {
                        inGameName: gameIds[modal.index]?.inGameName || '',
                        characterId: gameIds[modal.index]?.characterId || '',
                        isPrimary: gameIds[modal.index]?.isPrimary || false,
                    } : undefined}
                    onClose={() => setModal(null)}
                    onSubmit={handleModalSubmit}
                    isLoading={isMutating}
                />
            )}
        </div>
    );
};

export default MyGameIdsPage;