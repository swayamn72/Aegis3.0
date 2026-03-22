import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, ChevronLeft, ChevronRight, Loader2, Shield, Star, AlertCircle, Search } from 'lucide-react';
import { getAegisLeaderboard } from '../api/players';
import { getRatingBadge } from '../utils/aegisRatingUtils';

const AegisLeaderboard = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [brokenImages, setBrokenImages] = useState({});
  const limit = 25;

  const handleImageError = (id) => {
    setBrokenImages(prev => ({ ...prev, [id]: true }));
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['aegis-leaderboard', page],
    queryFn: () => getAegisLeaderboard(page, limit),
    keepPreviousData: true,
  });

  const players = data?.players || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-[#FF4500]/10 rounded-xl border border-[#FF4500]/20">
              <Trophy className="w-7 h-7 text-[#FF4500]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Aegis Leaderboard</h1>
              <p className="text-zinc-400 text-sm">{data?.total || 0} rated players</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_120px_100px] md:grid-cols-[60px_1fr_120px_100px_100px] items-center px-4 py-3 bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider font-semibold border-b border-zinc-800">
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-center">Rating</span>
            <span className="text-center">Tier</span>
            <span className="hidden md:block text-center">Matches</span>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[#FF4500] animate-spin" />
              <span className="ml-3 text-zinc-400">Loading leaderboard...</span>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex items-center justify-center py-20 text-zinc-400">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              Failed to load leaderboard
            </div>
          )}

          {/* Rows */}
          {!isLoading && !isError && players.map((player, index) => {
            const rank = (page - 1) * limit + index + 1;
            const badge = getRatingBadge(player.aegisRating);
            const isTop3 = rank <= 3;
            const rankColors = { 1: 'text-yellow-400', 2: 'text-zinc-300', 3: 'text-orange-400' };

            return (
              <div
                key={player._id}
                onClick={() => navigate(`/player/${player.username}`)}
                className={`grid grid-cols-[60px_1fr_120px_100px] md:grid-cols-[60px_1fr_120px_100px_100px] items-center px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer ${isTop3 ? 'bg-zinc-800/20' : ''}`}
              >
                {/* Rank */}
                <div className="text-center">
                  <span className={`font-bold text-lg ${rankColors[rank] || 'text-zinc-400'}`}>
                    {rank}
                  </span>
                </div>

                {/* Player Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 border border-zinc-700">
                    {player.profilePicture && !brokenImages[player._id] ? (
                      <img 
                        src={player.profilePicture} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={() => handleImageError(player._id)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-zinc-500 text-sm font-bold">
                        {player.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm truncate">{player.username}</p>
                      {player.verified && <Shield className="w-3.5 h-3.5 text-[#FF4500] flex-shrink-0" />}
                      {player.aegisIsProvisional && <span className="text-[10px] text-zinc-500">⏳</span>}
                    </div>
                    {player.team && (
                      <p className="text-xs text-zinc-500 truncate">{player.team.teamTag || player.team.teamName}</p>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="text-center">
                  <span className="font-bold text-lg" style={{ color: badge.color }}>
                    {player.aegisRating}
                  </span>
                </div>

                {/* Tier Badge */}
                <div className="flex items-center justify-center gap-1.5">
                  <img src={badge.badge} alt={badge.tier} className="w-5 h-5" />
                  <span className={`text-xs font-semibold ${badge.textClass}`}>{badge.tier}</span>
                </div>

                {/* Matches (desktop) */}
                <div className="hidden md:block text-center text-sm text-zinc-400">
                  {player.aegisMatchesRated || 0}
                </div>
              </div>
            );
          })}

          {/* Empty */}
          {!isLoading && !isError && players.length === 0 && (
            <div className="text-center py-20 text-zinc-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No rated players yet</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-zinc-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AegisLeaderboard;
