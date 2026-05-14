import { useQuery } from '@tanstack/react-query';
import { getFantasyContests, getFeaturedContests, getMyContests } from '../api/fantasy';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const STATUS_STYLES = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  live: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  scoring: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function ContestCard({ contest }) {
  const isLocked = new Date() >= new Date(contest.lockTime);
  const timeLeft = new Date(contest.lockTime) - new Date();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  const minsLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));

  return (
    <Link to={`/fantasy/${contest._id}`} className="block group">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800/50 rounded-2xl border border-zinc-700/50 overflow-hidden hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
        {/* Header Banner */}
        <div className="h-24 bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-blue-600/30 relative flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-white font-bold text-lg group-hover:text-purple-300 transition-colors">{contest.name}</h3>
            <p className="text-zinc-400 text-xs mt-0.5">{contest.tournament?.tournamentName || 'Tournament'} · {contest.phase}</p>
          </div>
          <span className={`absolute top-3 right-3 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${STATUS_STYLES[contest.status] || 'bg-zinc-700 text-zinc-300'}`}>{contest.status}</span>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-zinc-500 text-[10px] uppercase font-medium">Squad Size</p><p className="text-white font-bold">{contest.squadSize}</p></div>
            <div><p className="text-zinc-500 text-[10px] uppercase font-medium">Budget</p><p className="text-white font-bold">{contest.budgetCap}</p></div>
            <div><p className="text-zinc-500 text-[10px] uppercase font-medium">Entries</p><p className="text-white font-bold">{contest.currentSquads || 0}</p></div>
          </div>

          {/* Timer / Status */}
          <div className="flex items-center justify-between text-sm">
            {!isLocked && contest.status === 'upcoming' ? (
              <span className="text-purple-400">⏱ {hoursLeft}h {minsLeft}m left</span>
            ) : isLocked ? (
              <span className="text-zinc-500">🔒 Locked</span>
            ) : (
              <span className="text-red-400">🔴 Live</span>
            )}
            <span className="text-zinc-500 text-xs">{contest.entryType === 'free' ? 'Free Entry' : `${contest.entryFee?.amount} coins`}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function FantasyPage() {
  const [tab, setTab] = useState('featured');

  const { data: featured } = useQuery({ queryKey: ['fantasyFeatured'], queryFn: getFeaturedContests });
  const { data: upcoming } = useQuery({ queryKey: ['fantasyContests', 'upcoming'], queryFn: () => getFantasyContests({ status: 'upcoming' }), enabled: tab === 'upcoming' });
  const { data: live } = useQuery({ queryKey: ['fantasyContests', 'live'], queryFn: () => getFantasyContests({ status: 'live' }), enabled: tab === 'live' });
  const { data: myContests } = useQuery({ queryKey: ['fantasyMyContests'], queryFn: getMyContests, enabled: tab === 'my' });
  const { data: completed } = useQuery({ queryKey: ['fantasyContests', 'completed'], queryFn: () => getFantasyContests({ status: 'completed' }), enabled: tab === 'results' });

  const tabs = [
    { key: 'featured', label: '⭐ Featured' },
    { key: 'upcoming', label: '🎯 Upcoming' },
    { key: 'live', label: '🔴 Live' },
    { key: 'my', label: '👤 My Contests' },
    { key: 'results', label: '🏆 Results' },
  ];

  const getContests = () => {
    switch (tab) {
      case 'featured': return featured?.contests || [];
      case 'upcoming': return upcoming?.contests || [];
      case 'live': return live?.contests || [];
      case 'my': return (myContests?.contests || []).map(s => s.contest).filter(Boolean);
      case 'results': return completed?.contests || [];
      default: return [];
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] px-4 py-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 mb-2">Fantasy Esports</h1>
        <p className="text-zinc-400">Build your dream BGMI squad · Earn points from real matches</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contest Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {getContests().map(c => <ContestCard key={c._id} contest={c} />)}
      </div>

      {getContests().length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-5xl mb-4">🎮</p>
          <p className="text-lg">No contests here yet</p>
          <p className="text-sm mt-1">Check back soon for exciting fantasy contests!</p>
        </div>
      )}
    </div>
  );
}
