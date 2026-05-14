import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getMySquad } from '../api/fantasy';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function FantasyLeaderboard() {
  const { contestId } = useParams();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({ queryKey: ['fantasyLeaderboard', contestId], queryFn: () => getLeaderboard(contestId) });
  const { data: mySquadData } = useQuery({ queryKey: ['mySquad', contestId], queryFn: () => getMySquad(contestId), retry: false });

  const squads = data?.leaderboard || [];
  const mySquad = mySquadData?.squad;

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] px-4 py-6 max-w-3xl mx-auto">
      <Link to={`/fantasy/${contestId}`} className="text-purple-400 text-sm hover:text-purple-300 mb-4 inline-block">← Back to Contest</Link>
      <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">Leaderboard</h1>

      {/* My Position */}
      {mySquad && (
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-4 mb-6 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-purple-400">#{mySquad.rank || '—'}</span>
              <div>
                <p className="text-white font-semibold">Your Squad</p>
                <p className="text-zinc-400 text-xs">{mySquad.squadName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">{mySquad.totalPoints || 0}</p>
              <p className="text-zinc-400 text-xs">points</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {isLoading ? (
        <div className="text-zinc-400 text-center py-12">Loading leaderboard...</div>
      ) : squads.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-5xl mb-4">📊</p>
          <p>No entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {squads.map((squad, idx) => {
            const isMe = squad.user?._id === user?._id;
            const rank = squad.rank || idx + 1;
            return (
              <div key={squad._id} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isMe ? 'bg-purple-600/15 border border-purple-500/30' : 'bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/50'}`}>
                <div className="w-10 text-center">
                  {getMedalEmoji(rank) ? (
                    <span className="text-xl">{getMedalEmoji(rank)}</span>
                  ) : (
                    <span className="text-zinc-400 font-bold text-sm">{rank}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {squad.user?.profilePicture ? (
                    <img src={squad.user.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-sm font-bold">{(squad.user?.username || '?')[0].toUpperCase()}</div>
                  )}
                  <div className="min-w-0">
                    <p className={`font-medium text-sm truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>{squad.user?.username || 'Unknown'} {isMe && '(You)'}</p>
                    <p className="text-zinc-600 text-xs">{squad.squadName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${rank <= 3 ? 'text-lg text-white' : 'text-zinc-300'}`}>{squad.totalPoints || 0}</p>
                  <p className="text-zinc-600 text-[10px]">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
