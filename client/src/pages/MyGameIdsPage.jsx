import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../utils/axiosConfig';
import Navbar from '../components/Navbar';
import {
    Gamepad2, Plus, Edit, Trash2, Star, AlertCircle,
    Trophy, Calendar, Shield, X, Lock, CheckCircle, Search
} from 'lucide-react';
import BGMILogo from '../assets/gameLogos/BGMI_LOGO.png';
import ValorantLogo from '../assets/gameLogos/valorant2.png';

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
const GameIdModal = ({ mode, game, initialData, onClose, onSubmit, isLoading }) => {
    // game is 'BGMI' or 'VALORANT'
    const [formData, setFormData] = useState(
        initialData || { inGameName: '', characterId: '', isPrimary: false, game }
    );
    const [riotName, setRiotName] = useState('');
    const [riotTag, setRiotTag] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedAccount, setVerifiedAccount] = useState(null);

    const handleVerifyValorant = async () => {
        if (!riotName.trim() || !riotTag.trim()) {
            toast.error("Please enter both your Riot Name and Tag");
            return;
        }

        setIsVerifying(true);
        try {
            const res = await axiosInstance.get(`/api/players/verify-valorant`, {
                params: { name: riotName, tag: riotTag }
            });
            setVerifiedAccount(res.data.account);
            setFormData(prev => ({ 
                ...prev, 
                inGameName: `${res.data.account.name}#${res.data.account.tag}`,
                characterId: res.data.account.puuid
            }));
            toast.success(`Account verified: ${res.data.account.name}#${res.data.account.tag}`);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to verify account");
            setVerifiedAccount(null);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSubmit = () => {
        if (!formData.inGameName.trim() || !formData.characterId.trim()) {
            toast.error('Please fill in all fields (verify Riot ID if applicable)');
            return;
        }
        onSubmit(formData);
    };

    const isValorant = game === 'VALORANT';
    const accentColor = isValorant ? '#00FFFF' : '#FF4500';
    const accentClass = isValorant ? 'text-cyan-400' : 'text-[#FF4500]';
    const borderClass = isValorant ? 'border-cyan-400/50' : 'border-[#FF4500]/50';
    const ringClass = isValorant ? 'focus:ring-cyan-400/30' : 'focus:ring-[#FF4500]/30';
    const bgButtonClass = isValorant ? 'bg-cyan-500 hover:bg-cyan-400 text-black' : 'bg-[#FF4500] hover:bg-[#FF4500]/90 text-white';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className={`relative bg-zinc-950 border ${borderClass} rounded-2xl w-full max-w-md overflow-hidden shadow-2xl`}>
                {/* Top accent bar */}
                <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-md flex items-center justify-center`} style={{ backgroundColor: `${accentColor}20`, border: `1px solid ${accentColor}50` }}>
                                <Gamepad2 className="w-4 h-4" style={{ color: accentColor }} />
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-white">
                                {mode === 'add' ? `ADD ${game} ID` : `UPDATE ${game} ID`}
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {isValorant && !verifiedAccount ? (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-widest ${accentClass} mb-2`}>
                                        Riot Name
                                    </label>
                                    <input
                                        type="text"
                                        value={riotName}
                                        onChange={(e) => setRiotName(e.target.value)}
                                        className={`w-full bg-zinc-950 border border-zinc-800 focus:${borderClass} rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none ${ringClass} font-mono text-sm transition-all`}
                                        placeholder="e.g. TenZ"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-widest ${accentClass} mb-2`}>
                                        Tag (Without #)
                                    </label>
                                    <input
                                        type="text"
                                        value={riotTag}
                                        onChange={(e) => setRiotTag(e.target.value)}
                                        className={`w-full bg-zinc-950 border border-zinc-800 focus:${borderClass} rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none ${ringClass} font-mono text-sm transition-all`}
                                        placeholder="e.g. NA1"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleVerifyValorant}
                                    disabled={isVerifying || !riotName || !riotTag}
                                    className={`w-full ${bgButtonClass} px-4 py-3 rounded-lg font-bold uppercase tracking-wider text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all`}
                                >
                                    {isVerifying ? (
                                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <><Search className="w-4 h-4" /> Verify Riot ID</>
                                    )}
                                </button>
                                <p className="text-xs text-zinc-500 text-center font-medium flex items-center justify-center gap-1">
                                    <Shield className="w-3 h-3" /> Securely connected to Riot Network
                                </p>
                            </div>
                        ) : isValorant && verifiedAccount ? (
                            <div className="bg-cyan-500/10 border border-cyan-400/30 p-4 rounded-xl flex items-center gap-4">
                                <img src={verifiedAccount.card?.small} alt="banner" className="w-12 h-12 rounded object-cover border border-cyan-400/50" />
                                <div>
                                    <p className="text-white font-bold text-lg leading-tight">{verifiedAccount.name} <span className="text-cyan-400">#{verifiedAccount.tag}</span></p>
                                    <p className="text-xs text-zinc-400 font-medium">Level {verifiedAccount.account_level} • Region: {verifiedAccount.region?.toUpperCase()}</p>
                                </div>
                                <CheckCircle className="w-6 h-6 text-cyan-400 ml-auto" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                        In-Game Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.inGameName}
                                        onChange={(e) => setFormData({ ...formData, inGameName: e.target.value })}
                                        className={`w-full bg-zinc-900 border border-zinc-800 focus:${borderClass} rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none ${ringClass} transition-all font-mono text-sm`}
                                        placeholder="In-Game Name"
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
                                        className={`w-full bg-zinc-900 border border-zinc-800 focus:${borderClass} rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none ${ringClass} transition-all font-mono text-sm`}
                                        placeholder="000000000"
                                    />
                                </div>
                            </>
                        )}

                        {mode === 'add' && (
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isPrimary: !formData.isPrimary })}
                                className={`w-full flex items-center gap-3 rounded-lg p-3 border transition-all text-sm font-semibold ${formData.isPrimary
                                        ? `bg-zinc-900 ${borderClass} ${accentClass}`
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
                            disabled={isLoading || (isValorant && !verifiedAccount)}
                            className={`flex-1 ${bgButtonClass} disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2`}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
    const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', index?: number, game: 'BGMI' | 'VALORANT' }

    const { data, isLoading } = useQuery({
        queryKey: ['gameIds'],
        queryFn: fetchGameIds,
        staleTime: 2 * 60 * 1000,
        onError: () => toast.error('Failed to load game IDs'),
    });

    const gameIds = data?.gameIds || [];
    const bgmiIds = gameIds.filter(g => g.game === 'BGMI' || !g.game);
    const valoIds = gameIds.filter(g => g.game === 'VALORANT');

    const canUpdate = data?.canUpdate ?? true;
    const updateReason = data?.reason;
    const nextUpdateAllowed = data?.nextUpdateAllowed;
    const tournamentStatus = data?.tournamentStatus;
    const locked = tournamentStatus?.inTournament;

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

    const renderGameIdCard = (gameId, index, isValorant) => {
        const accentClass = isValorant ? 'text-cyan-400' : 'text-[#FF4500]';
        const borderClass = isValorant ? 'border-cyan-400/40' : 'border-[#FF4500]/40';
        const bgHoverClass = isValorant ? 'hover:bg-cyan-500/5' : 'hover:bg-[#FF4500]/5';

        return (
            <div
                key={index}
                className={`relative bg-zinc-900/50 border rounded-xl overflow-hidden transition-all group ${gameId.isPrimary ? borderClass : 'border-zinc-800 hover:border-zinc-700'}`}
            >
                {gameId.isPrimary && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isValorant ? 'bg-cyan-400' : 'bg-[#FF4500]'}`} />
                )}

                <div className="p-5 pl-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                <h3 className="text-xl font-black text-white tracking-tight">
                                    {gameId.inGameName}
                                </h3>
                                {gameId.isPrimary && (
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isValorant ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30' : 'bg-[#FF4500]/10 text-[#FF4500] border border-[#FF4500]/30'}`}>
                                        <Star className="w-3 h-3 fill-current" />
                                        PRIMARY
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1">
                                <div>
                                    {!isValorant && (
                                        <>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Character ID</p>
                                            <p className="text-sm font-mono text-zinc-300 truncate" title={gameId.characterId}>{gameId.characterId}</p>
                                        </>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Added</p>
                                    <p className="text-sm text-zinc-400">{new Date(gameId.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            {!gameId.isPrimary && !locked && (
                                <button
                                    onClick={() => primaryMutation.mutate(index)}
                                    disabled={primaryMutation.isLoading}
                                    title="Set as primary"
                                    className={`p-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-500 hover:${accentClass} hover:${borderClass} ${bgHoverClass} transition-all`}
                                >
                                    <Star className="w-4 h-4" />
                                </button>
                            )}

                            <button
                                onClick={() => setModal({ mode: 'edit', index, game: isValorant ? 'VALORANT' : 'BGMI' })}
                                disabled={!canUpdate || locked}
                                title={!canUpdate ? updateReason : locked ? 'Locked during tournament' : 'Edit game ID'}
                                className={`p-2 rounded-lg border transition-all ${canUpdate && !locked
                                        ? `bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 hover:bg-zinc-800`
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
                <div className={`h-px w-0 group-hover:w-full transition-all duration-500 ${isValorant ? 'bg-gradient-to-r from-cyan-400 to-transparent' : 'bg-gradient-to-r from-[#FF4500] to-transparent'}`} />
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-zinc-800 border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">LOADING GAME IDS...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans pt-20">
            <Navbar />
            <div className="max-w-5xl mx-auto px-4 py-12">
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
                        Connected Accounts
                    </h1>
                    <p className="text-zinc-400 font-medium">
                        Manage your identities across the Aegis ecosystem.
                    </p>
                </div>

                {/* Status Bar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                    <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${locked ? 'bg-red-500/10' : canUpdate ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                            {locked ? <Trophy className="w-6 h-6 text-red-500" /> : <Shield className={`w-6 h-6 ${canUpdate ? 'text-green-500' : 'text-yellow-500'}`} />}
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Update Status</p>
                            <p className="text-lg font-black text-white">
                                {locked ? 'TOURNAMENT LOCK' : canUpdate ? 'UNLOCKED' : 'COOLDOWN'}
                            </p>
                        </div>
                    </div>
                    
                    {!canUpdate && !locked && nextUpdateAllowed && (
                        <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 flex items-center gap-4">
                            <Calendar className="w-6 h-6 text-yellow-500" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-yellow-500/70 mb-1">Next Update</p>
                                <p className="text-lg font-black text-yellow-400">
                                    {new Date(nextUpdateAllowed).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* BGMI SECTION */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF4500] to-orange-400" />
                        
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <img src={BGMILogo} alt="BGMI Logo" className="h-8 object-contain" />
                                <h2 className="text-3xl font-black italic text-orange-400 tracking-widest">BGMI</h2>
                            </div>
                            <p className="text-zinc-500 text-sm font-medium mb-6">Battlegrounds Mobile India • Max 2 Accounts</p>
                            
                            <div className="space-y-4 mb-6 relative z-10">
                                {bgmiIds.map((id) => renderGameIdCard(id, gameIds.indexOf(id), false))}
                                {bgmiIds.length === 0 && (
                                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
                                        <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">No BGMI ID Linked</p>
                                    </div>
                                )}
                            </div>

                            {bgmiIds.length < 2 && !locked && (
                                <button
                                    onClick={() => setModal({ mode: 'add', game: 'BGMI' })}
                                    className="w-full relative z-10 bg-zinc-900 hover:bg-[#FF4500]/10 border border-zinc-800 hover:border-[#FF4500]/50 text-zinc-400 hover:text-[#FF4500] font-bold uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                >
                                    <Plus className="w-5 h-5" /> Add BGMI ID
                                </button>
                            )}
                        </div>
                    </div>

                    {/* VALORANT SECTION */}
                    <div className="bg-[#0f1923] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
                        
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <img src={ValorantLogo} alt="Valorant Logo" className="h-8 object-contain" />
                                <h2 className="text-3xl font-black text-cyan-400 tracking-widest">VALORANT</h2>
                            </div>
                            <p className="text-zinc-500 text-sm font-medium mb-6">Riot Games Ecosystem • Max 1 Account</p>
                            
                            <div className="space-y-4 mb-6 relative z-10">
                                {valoIds.map((id) => renderGameIdCard(id, gameIds.indexOf(id), true))}
                                {valoIds.length === 0 && (
                                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
                                        <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">No Valorant ID Linked</p>
                                    </div>
                                )}
                            </div>

                            {valoIds.length < 1 && !locked && (
                                <button
                                    onClick={() => setModal({ mode: 'add', game: 'VALORANT' })}
                                    className="w-full relative z-10 bg-black hover:bg-cyan-500/10 border border-zinc-800 hover:border-cyan-400/50 text-zinc-400 hover:text-cyan-400 font-bold uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                >
                                    <Shield className="w-5 h-5" /> Connect Riot ID
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {modal && (
                <GameIdModal
                    mode={modal.mode}
                    game={modal.game}
                    initialData={modal.mode === 'edit' ? {
                        inGameName: gameIds[modal.index]?.inGameName || '',
                        characterId: gameIds[modal.index]?.characterId || '',
                        isPrimary: gameIds[modal.index]?.isPrimary || false,
                        game: modal.game
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