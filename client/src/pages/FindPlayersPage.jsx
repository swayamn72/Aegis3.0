import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, MessageCircle, User, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import ChatAvatar from '../components/ChatAvatar';
import { fetchDiscoverPlayers } from '../api/players';

const ROLE_OPTIONS = ['', 'IGL', 'Assaulter', 'Fragger', 'Support', 'Sniper', 'Substitute', 'Player'];

export default function FindPlayersPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [searchInput, setSearchInput] = useState('');
    const [q, setQ] = useState('');
    const [role, setRole] = useState('');
    const [sortBy, setSortBy] = useState('aegisRating');
    const [sortOrder, setSortOrder] = useState('desc');
    const [page, setPage] = useState(1);

    const query = useQuery({
        queryKey: ['discoverPlayers', q, role, sortBy, sortOrder, page],
        queryFn: () =>
            fetchDiscoverPlayers({
                q,
                role,
                sortBy,
                sortOrder,
                page,
                limit: 20,
            }),
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
    });

    const players = query.data?.players || [];
    const pagination = query.data?.pagination || { page: 1, totalPages: 1, total: 0 };

    const resultSummary = useMemo(() => {
        if (query.isLoading) return 'Searching players...';
        return `${pagination.total || 0} players found`;
    }, [query.isLoading, pagination.total]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        setQ(searchInput.trim());
    };

    const handleSendMessage = (playerId) => {
        navigate('/chat', { state: { selectedUserId: playerId } });
        toast.info('Open chat and send your first message. If needed, a request will be created automatically.');
        queryClient.invalidateQueries({ queryKey: ['incomingMessageRequests'] });
    };

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 text-white pt-24 px-4 md:px-8 pb-10">
                <section className="max-w-7xl mx-auto space-y-5">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Find Players</h1>
                                <p className="text-zinc-400 mt-1">Search players, sort by rating or role, and start chat directly.</p>
                            </div>
                            <button
                                onClick={() => navigate('/chat')}
                                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm"
                            >
                                Open Chat Inbox
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSearch} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 md:p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-5 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search by username or real name"
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500"
                                />
                            </div>

                            <select
                                value={role}
                                onChange={(e) => {
                                    setRole(e.target.value);
                                    setPage(1);
                                }}
                                className="md:col-span-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white"
                            >
                                {ROLE_OPTIONS.map((value) => (
                                    <option key={value || 'all-roles'} value={value}>
                                        {value || 'All roles'}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={sortBy}
                                onChange={(e) => {
                                    setSortBy(e.target.value);
                                    setPage(1);
                                }}
                                className="md:col-span-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white"
                            >
                                <option value="aegisRating">Sort: Rating</option>
                                <option value="username">Sort: Username</option>
                                <option value="createdAt">Sort: Newest</option>
                            </select>

                            <button
                                type="button"
                                onClick={() => {
                                    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                                    setPage(1);
                                }}
                                className="md:col-span-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
                                title="Toggle sort order"
                            >
                                <SlidersHorizontal className="w-4 h-4 inline mr-1" />
                                {sortOrder === 'desc' ? 'Desc' : 'Asc'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-sm text-zinc-400">{resultSummary}</p>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-sm font-semibold"
                            >
                                Search
                            </button>
                        </div>
                    </form>

                    {query.isLoading && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-zinc-300">Loading players...</div>
                    )}

                    {!query.isLoading && players.length === 0 && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-zinc-400">No players match your filters.</div>
                    )}

                    {!query.isLoading && players.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {players.map((player) => (
                                <article key={player._id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                                    <div className="flex items-start gap-4">
                                        <ChatAvatar
                                            src={player.profilePicture}
                                            fallbackSeed={player.username}
                                            alt={player.username}
                                            className="w-14 h-14 rounded-xl border border-zinc-700"
                                        />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-semibold text-white truncate">{player.realName || player.username}</h3>
                                                {player.verified && (
                                                    <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">Verified</span>
                                                )}
                                            </div>

                                            <p className="text-sm text-zinc-400 truncate">@{player.username}</p>

                                            <div className="mt-2 flex items-center gap-3 text-sm flex-wrap">
                                                <span className="inline-flex items-center gap-1 text-amber-300">
                                                    <Star className="w-4 h-4" />
                                                    {Math.round(player.aegisRating || 0)}
                                                </span>
                                                {player.primaryGame && <span className="text-zinc-400">{player.primaryGame}</span>}
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {(player.inGameRole || []).slice(0, 4).map((r) => (
                                                    <span key={r} className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs">{r}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => navigate(`/detailed/${player._id}`)}
                                            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm flex items-center justify-center gap-2"
                                        >
                                            <User className="w-4 h-4" />
                                            View Profile
                                        </button>

                                        <button
                                            onClick={() => handleSendMessage(player._id)}
                                            className="px-3 py-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-center gap-2"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            Send Message
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <p className="text-sm text-zinc-400">Page {pagination.page || 1} of {pagination.totalPages || 1}</p>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={(pagination.page || 1) >= (pagination.totalPages || 1)}
                            className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </section>
            </main>
        </>
    );
}
