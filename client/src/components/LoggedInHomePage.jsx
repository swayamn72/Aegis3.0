import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, Users, Activity, TrendingUp, Target,
  MapPin, Shield, Zap, Search, Bell, Flame,
  ChevronRight, Gamepad2, Star, Clock, Calendar, Coins
} from 'lucide-react';

// Import map assets for backgrounds
import ErangelMap from '../assets/mapImages/erangel.jpg';
import MiramarMap from '../assets/mapImages/miramar.webp';
import SanhokMap from '../assets/mapImages/sanhok.webp';
import VikendiMap from '../assets/mapImages/vikendi.jpg';
import RondoMap from '../assets/mapImages/rondo.webp';

const MAP_BG = {
  Erangel: ErangelMap,
  Miramar: MiramarMap,
  Sanhok: SanhokMap,
  Vikendi: VikendiMap,
  Rondo: RondoMap,
  Unknown: ErangelMap,
};
import { getRatingBadge, formatDelta } from '../utils/aegisRatingUtils';

const API_URL = import.meta.env.VITE_BACKEND_URL;

// --- Sub-components (Widgets) ---

const StatCard = ({ label, value, icon: Icon, color, trend }) => (
  <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-4 hover:border-zinc-700/50 transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-[0.03] -mr-8 -mt-8 rounded-full blur-2xl group-hover:opacity-[0.06] transition-opacity`}></div>
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">{label}</p>
        <p className="text-2xl font-black text-white">{value}</p>
        {trend && (
          <p className="text-[10px] font-bold text-green-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> {trend}
          </p>
        )}
      </div>
      <div className={`p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/50 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </div>
);

const SectionHeader = ({ title, icon: Icon, color, actionLabel, onAction }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300">{title}</h2>
    </div>
    {actionLabel && (
      <button
        onClick={onAction}
        className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 group"
      >
        {actionLabel}
        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </button>
    )}
  </div>
);

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-black pt-[120px] px-6 max-w-[1400px] mx-auto animate-pulse">
    <div className="h-10 w-64 bg-zinc-900 rounded mb-8"></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-zinc-900 rounded-xl"></div>)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="h-96 bg-zinc-900 rounded-xl"></div>
        <div className="h-64 bg-zinc-900 rounded-xl"></div>
      </div>
      <div className="space-y-6">
        <div className="h-80 bg-zinc-900 rounded-xl"></div>
        <div className="h-80 bg-zinc-900 rounded-xl"></div>
      </div>
    </div>
  </div>
);

// --- Main Component ---

const LoggedInHomepage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    data: dashboard,
    isLoading,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      const resp = await fetch(`${API_URL}/api/players/dashboard-data`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Failed to fetch dashboard data');
      const result = await resp.json();
      return result.data;
    },
    enabled: !!user,
  });

  if (isLoading) return <DashboardSkeleton />;

  const player = dashboard?.player || user;
  const ratingInfo = getRatingBadge(player?.aegisRating);
  const tournaments = dashboard?.tournaments || [];
  const matches = dashboard?.matches || [];
  const ratingHistory = dashboard?.ratingHistory || [];
  const registrations = dashboard?.activeRegistrations || [];
  const playerTeams = dashboard?.playerTeams || [];
  const stats = dashboard?.stats || { teamCount: 0, activeTournaments: 0, pendingApplications: 0 };

  return (
    <div className="min-h-screen bg-black text-white font-[Inter] pt-[110px] pb-16 relative overflow-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF4500]/[0.03] blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/[0.03] blur-[150px] rounded-full"></div>
        <div className="absolute inset-0 bg-[url('/grid-dark.svg')] opacity-[0.05]"></div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6">

        {/* Welcome & Top Notifications */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-black tracking-widest text-[#FF4500] uppercase">
                System Online
              </span>
              <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-2">
              WELCOME BACK, <span className="text-[#FF4500]">{player?.username}</span>
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">
              The competitive matrix is ready for initialization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Action buttons removed as requested */}
          </div>
        </div>

        {/* Global Hub Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Aegis Rating"
            value={player?.aegisRating || 1200}
            icon={TrendingUp}
            color="text-[#FF4500]"
          />
          <StatCard
            label="Primary Team"
            value={playerTeams[0]?.teamName || 'No Team'}
            icon={Users}
            color="text-cyan-400"
          />
          <StatCard
            label="Tournaments Played"
            value={stats.activeTournaments}
            icon={Trophy}
            color="text-purple-400"
          />
          <StatCard
            label="Win Rate"
            value={`${player?.statistics?.winRate || 0}%`}
            icon={Flame}
            color="text-green-400"
          />
        </div>

        {/* Main Dashboard Interaction */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT: Rating & Performance (4 Cols) */}
          <div className="lg:col-span-4 space-y-8">

            {/* Aegis Rating Card - THE HERO PIECE */}
            <div className={`relative rounded-3xl p-8 border ${ratingInfo.border} ${ratingInfo.bg} overflow-hidden group`}>
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
                <img src={ratingInfo.badge} alt="Tier" className="w-32 h-32 blur-[2px]" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <img src={ratingInfo.badge} alt="Badge" className="w-12 h-12 drop-shadow-[0_0_15px_rgba(255,69,0,0.5)]" />
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${ratingInfo.textClass}`}>Tier Classification</p>
                    <h2 className="text-2xl font-black text-white italic">{ratingInfo.tier}</h2>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-end justify-between mb-2">
                    <p className="text-4xl font-black text-white">{player?.aegisRating}</p>
                    <p className="text-zinc-400 text-xs font-bold mb-1 uppercase tracking-widest">Peak: {player?.aegisRatingPeak || 0}</p>
                  </div>
                  {/* Tier Progress Bar */}
                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full bg-gradient-to-r from-transparent to-white/60 transition-all duration-1000`}
                      style={{ width: `${Math.min(((player?.aegisRating || 0) % 500) / 5, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 backdrop-blur-md rounded-xl p-3 border border-white/5">
                    <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Matches Rated</p>
                    <p className="text-sm font-bold text-white tracking-widest">{player?.aegisMatchesRated || 0}</p>
                  </div>
                  <div className="bg-black/30 backdrop-blur-md rounded-xl p-3 border border-white/5">
                    <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Status</p>
                    <p className={`text-sm font-black tracking-widest ${player?.aegisIsProvisional ? 'text-yellow-500' : 'text-green-500'}`}>
                      {player?.aegisIsProvisional ? 'PROVISIONAL' : 'ESTABLISHED'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance History Chart (Sparkline simulation) */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-3xl p-6">
              <SectionHeader title="Performance Flow" icon={Activity} color="text-green-400" />
              <div className="space-y-4">
                {ratingHistory.length > 0 ? ratingHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${h.delta > 0 ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                      <div>
                        <p className="text-[11px] font-bold text-white">{new Date(h.date).toLocaleDateString()}</p>
                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{h.tier} TIER MATCH</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black ${h.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {h.delta > 0 ? '+' : ''}{h.delta}
                      </p>
                      <p className="text-[10px] text-zinc-700 font-bold">{h.ratingAfter} AR</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-8 text-zinc-700 text-xs italic">No rating events detected.</p>
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE: Global Events & Live Streams (5 Cols) */}
          <div className="lg:col-span-8 space-y-8">

            {/* Live Competition Matrix */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4500]/[0.02] blur-[80px] rounded-full -mr-32 -mt-32"></div>

              <SectionHeader
                title="Competition Matrix"
                icon={Gamepad2}
                color="text-purple-400"
                actionLabel="View Tournament Board"
                onAction={() => navigate('/tournaments')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {tournaments.length > 0 ? tournaments.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => navigate(`/tournament/${t._id}`)}
                    className="bg-zinc-950/60 border border-zinc-800/50 hover:border-zinc-700 p-5 rounded-2xl transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                          <Gamepad2 className="w-4 h-4 text-zinc-500" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-[#FF4500] truncate max-w-[120px]">{t.shortName || t.tournamentName}</h3>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                        {t.tier} Tier
                      </span>
                    </div>

                    <div className="space-y-3 mb-5">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-zinc-500 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Start</span>
                        <span className="text-white">{new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-zinc-500 flex items-center gap-1.5"><Coins className="w-3 h-3" /> Pot</span>
                        <span className="text-[#FF4500]">₹{t.prizePool?.total?.toLocaleString() || 'TBD'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-zinc-500 flex items-center gap-1.5"><Users className="w-3 h-3" /> Slots</span>
                        <span className="text-white">{t.participantCount}/{t.totalSlots}</span>
                      </div>
                    </div>

                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#FF4500] to-purple-500 transition-all duration-1000"
                        style={{ width: `${(t.participantCount / t.totalSlots) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-2 py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
                    <Zap className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                    <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">No Active Circuits Detected</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recruitment & Tactical Log */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Recruitment Matrix */}
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-6">
                <SectionHeader
                  title="Recruitment Matrix"
                  icon={Target}
                  color="text-cyan-400"
                  actionLabel="Search All"
                  onAction={() => navigate('/recruitment')}
                />
                <div className="space-y-4">
                  {dashboard?.opportunities?.length > 0 ? dashboard.opportunities.map((opp) => (
                    <div
                      key={opp._id}
                      onClick={() => navigate('/recruitment')}
                      className="p-3 bg-zinc-950/40 border border-zinc-800/40 rounded-xl hover:bg-zinc-900 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded bg-zinc-800 overflow-hidden border border-zinc-700">
                          {opp.logo ? <img src={opp.logo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-600">{opp.teamTag}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black text-white truncate uppercase">{opp.teamName}</p>
                          <p className="text-[8px] text-zinc-600 font-bold uppercase">{opp.game} Division</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {opp.roles?.map(role => (
                          <span key={role} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">{role}</span>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center">
                      <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">No active scouts detected</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Tactical Log */}
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-6">
                <SectionHeader title="Tactical Log" icon={Activity} color="text-zinc-500" />
                <div className="space-y-4">
                  {matches.length > 0 ? matches.map(match => (
                    <div
                      key={match._id}
                      className="group relative bg-zinc-950 border border-zinc-800/50 hover:border-[#FF4500]/30 rounded-2xl transition-all overflow-hidden"
                    >
                      {/* Map Background with Overlay */}
                      <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                        <img
                          src={MAP_BG[match.map] || MAP_BG.Unknown}
                          alt={match.map}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
                      </div>

                      <div className="relative z-10 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-[#FF4500] uppercase tracking-widest mb-1 drop-shadow-md">
                              {match.tournamentPhase} • {match.map}
                            </p>
                            <h3 className="text-[11px] font-bold text-white truncate uppercase tracking-wider">
                              {match.tournamentName}
                            </h3>
                          </div>
                          <div className={`px-2 py-1 rounded-md text-[10px] font-black italic tracking-tighter ${match.isWin ? 'bg-[#FF4500] text-black shadow-[0_0_15px_rgba(255,69,0,0.3)]' : 'bg-zinc-800/80 backdrop-blur-sm text-zinc-400'}`}>
                            {match.isWin ? 'CHICKEN DINNER' : `#${match.finalPosition || 'TBD'}`}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-black/60 backdrop-blur-md rounded-lg p-2 border border-white/5 text-center">
                            <p className="text-[8px] text-zinc-500 font-black uppercase mb-0.5">Kill Pts</p>
                            <p className="text-xs font-bold text-white">{match.points?.kills || 0}</p>
                          </div>
                          <div className="bg-black/60 backdrop-blur-md rounded-lg p-2 border border-white/5 text-center">
                            <p className="text-[8px] text-zinc-500 font-black uppercase mb-0.5">Posi Pts</p>
                            <p className="text-xs font-bold text-white">{match.points?.position || 0}</p>
                          </div>
                          <div className="bg-black/60 backdrop-blur-md rounded-lg p-2 border border-[#FF4500]/20 text-center relative overflow-hidden group/pts">
                            <div className="absolute inset-0 bg-[#FF4500]/5 opacity-0 group-hover/pts:opacity-100 transition-opacity"></div>
                            <p className="text-[8px] text-[#FF4500] font-black uppercase mb-0.5 relative z-10">Total</p>
                            <p className="text-xs font-black text-white relative z-10">{match.points?.total || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center">
                      <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">No recent engagements</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoggedInHomepage;

