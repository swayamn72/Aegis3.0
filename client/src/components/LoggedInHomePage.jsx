import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, Users, Activity, TrendingUp, Target,
  MapPin, Shield, Zap, Search, Bell, Flame,
  ChevronRight, Gamepad2, Star, Clock, Calendar, Coins,
  Swords, Crosshair
} from 'lucide-react';

// Import map assets for backgrounds
import ErangelMap from '../assets/mapImages/erangel.jpg';
import MiramarMap from '../assets/mapImages/miramar.webp';
import SanhokMap from '../assets/mapImages/sanhok.webp';
import VikendiMap from '../assets/mapImages/vikendi.jpg';
import RondoMap from '../assets/mapImages/rondo.webp';

import BGMILogo from '../assets/gameLogos/BGMI_LOGO.png';
import ValorantLogo from '../assets/gameLogos/valorant2.png';

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
  
  const [selectedGame, setSelectedGame] = useState(user?.primaryGame || 'BGMI');

  const {
    data: dashboard,
    isLoading,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['dashboard', user?.id, selectedGame],
    queryFn: async () => {
      const resp = await fetch(`${API_URL}/api/players/dashboard-data?game=${selectedGame}`, { credentials: 'include' });
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
  const dashboardOpportunities = dashboard?.opportunities || [];
  const playerTeams = dashboard?.playerTeams || [];
  
  // Calculate dynamic stats based on filtered data
  const dynamicWinRate = matches.length > 0 ? ((matches.filter(m => m.isWin).length / matches.length) * 100).toFixed(1) : 0;
  
  // Theme Engine
  const isBGMI = selectedGame === 'BGMI';
  
  const theme = {
    bg: isBGMI ? 'bg-[#0a0a0a]' : 'bg-[#0f1923]', // True black vs Valorant dark blue
    primaryText: isBGMI ? 'text-[#FF4500]' : 'text-[#00FFFF]', // Orange vs Valo Cyan
    secondaryText: isBGMI ? 'text-zinc-500' : 'text-[#ece8e1]/60', // Valo off-white
    cardBg: isBGMI ? 'bg-zinc-900/40' : 'bg-[#1f2933]/60',
    cardBorder: isBGMI ? 'border-zinc-800 border-2' : 'border-[#ece8e1]/10',
    cardRounded: isBGMI ? 'rounded-none' : 'rounded-lg',
    fontTitle: isBGMI ? 'font-black tracking-tighter uppercase' : 'font-bold tracking-widest uppercase font-sans',
    fontBody: isBGMI ? 'font-mono' : 'font-sans',
    glow: isBGMI ? 'shadow-[8px_8px_0px_rgba(255,69,0,0.5)]' : 'shadow-[0_0_20px_rgba(0,255,255,0.3)]',
    ambientGlow: isBGMI ? 'bg-[#FF4500]' : 'bg-[#00FFFF]',
    accentBg: isBGMI ? 'bg-[#FF4500]' : 'bg-[#00FFFF]',
    accentText: isBGMI ? 'text-black' : 'text-[#0f1923]',
  };

  const StatCard = ({ label, value, icon: Icon, trend }) => (
    <div className={`${theme.cardBg} ${theme.cardBorder} ${theme.cardRounded} p-5 hover:border-${isBGMI?'[#FF4500]':'[#00FFFF]'} transition-all group relative overflow-hidden`}>
      {/* Aesthetic accents */}
      {isBGMI && <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#FF4500] opacity-0 group-hover:opacity-100 transition-opacity"></div>}
      {!isBGMI && <div className="absolute top-0 left-0 w-1 h-full bg-[#00FFFF] opacity-0 group-hover:opacity-100 transition-opacity"></div>}
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className={`${theme.secondaryText} text-[10px] uppercase tracking-[0.2em] font-bold mb-2`}>{label}</p>
          <p className={`text-3xl ${theme.fontTitle} text-white`}>{value}</p>
        </div>
        <div className={`p-3 ${isBGMI ? 'bg-zinc-950 rounded-none' : 'bg-[#0f1923] rounded-xl'} border ${theme.cardBorder} group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${theme.primaryText}`} />
        </div>
      </div>
    </div>
  );

  const SectionHeader = ({ title, icon: Icon, actionLabel, onAction }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${isBGMI ? 'rounded-none' : 'rounded-lg'} bg-black/40 border ${theme.cardBorder}`}>
          <Icon className={`w-4 h-4 ${theme.primaryText}`} />
        </div>
        <h2 className={`text-lg ${theme.fontTitle} text-white`}>{title}</h2>
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          className={`text-[10px] font-black uppercase tracking-widest ${theme.secondaryText} hover:text-white transition-colors flex items-center gap-1.5 group`}
        >
          {actionLabel}
          <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </button>
      )}
    </div>
  );

  const CurrentGameIcon = ({ className }) => {
    return isBGMI ? (
      <img src={BGMILogo} alt="BGMI" className={`${className} object-contain`} />
    ) : (
      <img src={ValorantLogo} alt="Valorant" className={`${className} object-contain`} />
    );
  };

  return (
    <div className={`min-h-screen ${theme.bg} text-white ${theme.fontBody} pt-[110px] pb-16 relative overflow-hidden transition-colors duration-700`}>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden mix-blend-screen">
        <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] ${theme.ambientGlow}/[0.05] blur-[120px] rounded-full transition-colors duration-1000`}></div>
        <div className={`absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] ${isBGMI ? 'bg-purple-500' : 'bg-[#00FFFF]'}/[0.03] blur-[150px] rounded-full transition-colors duration-1000`}></div>
        {isBGMI ? (
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.1]"></div>
        ) : (
          <div className="absolute inset-0 bg-[url('/grid-dark.svg')] opacity-[0.08]"></div>
        )}
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6">

        {/* Top Header & Game Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 ${isBGMI ? 'rounded-none' : 'rounded'} bg-black/50 border ${theme.cardBorder} text-[10px] font-black tracking-widest ${theme.primaryText} uppercase`}>
                System Online
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            </div>
            <h1 className={`text-4xl md:text-5xl ${theme.fontTitle} mb-2 flex items-center gap-3`}>
              WELCOME, <span className={theme.primaryText}>{player?.username}</span>
            </h1>
            <p className={`${theme.secondaryText} text-xs font-bold uppercase tracking-[0.2em]`}>
              The matrix is calibrated to your exact specifications.
            </p>
          </div>

          {/* SENSOR THEME SWITCHER */}
          <div className={`p-1.5 bg-black/60 backdrop-blur-md border ${theme.cardBorder} ${isBGMI ? 'rounded-none' : 'rounded-full'} flex items-center shadow-xl`}>
            <button
              onClick={() => setSelectedGame('BGMI')}
              className={`px-6 py-2.5 ${isBGMI ? 'rounded-none bg-[#FF4500] text-black font-black' : 'rounded-full text-zinc-500 font-bold hover:text-white'} text-xs tracking-widest uppercase transition-all duration-300 flex items-center gap-2`}
            >
              <Crosshair className="w-3 h-3" />
              BGMI
            </button>
            <button
              onClick={() => setSelectedGame('VALORANT')}
              className={`px-6 py-2.5 ${!isBGMI ? 'rounded-full bg-[#00FFFF] text-[#0f1923] font-black' : 'rounded-none text-zinc-500 font-bold hover:text-white'} text-xs tracking-widest uppercase transition-all duration-300 flex items-center gap-2`}
            >
              <Zap className="w-3 h-3" />
              VALORANT
            </button>
          </div>
        </div>

        {/* Global Hub Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          <StatCard label="Aegis Rating" value={player?.aegisRating || 1200} icon={TrendingUp} />
          <StatCard label={`${selectedGame} Team`} value={playerTeams[0]?.teamTag || 'No Team'} icon={Users} />
          <StatCard label="Active Circuits" value={tournaments.length} icon={Trophy} />
          <StatCard label="Recent Win Rate" value={`${dynamicWinRate}%`} icon={Flame} />
        </div>

        {/* Main Dashboard Interaction */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT: Rating & Performance (4 Cols) */}
          <div className="lg:col-span-4 space-y-8">

            {/* Aegis Rating Card - THE HERO PIECE */}
            <div className={`relative ${isBGMI ? 'rounded-none border-4' : 'rounded-3xl border'} ${theme.cardBorder} ${theme.cardBg} p-8 overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0"></div>
              
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700 z-0">
                <img src={ratingInfo.badge} alt="Tier" className="w-40 h-40 blur-[4px]" />
              </div>

              {/* Decorative elements */}
              {isBGMI && (
                <>
                  <div className="absolute top-4 left-4 w-12 h-2 bg-[#FF4500] z-10"></div>
                  <div className="absolute bottom-4 right-4 w-12 h-2 bg-zinc-600 z-10"></div>
                  <div className="absolute inset-0 bg-[url('/diagonal-stripes.svg')] opacity-5 z-0 mix-blend-overlay"></div>
                </>
              )}
              {!isBGMI && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00FFFF] to-transparent z-10"></div>
              )}

              <div className="relative z-10 pt-4">
                <div className="flex items-center gap-4 mb-8">
                  <div className={`p-1 bg-black/50 backdrop-blur-md ${isBGMI ? 'rounded-none' : 'rounded-2xl'} border ${theme.cardBorder}`}>
                    <img src={ratingInfo.badge} alt="Badge" className="w-16 h-16 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
                  </div>
                  <div>
                    <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${theme.secondaryText}`}>Global Tier</p>
                    <h2 className={`text-3xl ${theme.fontTitle} text-white italic drop-shadow-md`}>{ratingInfo.tier}</h2>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-end justify-between mb-3">
                    <p className={`text-5xl ${theme.fontTitle} text-white`}>{player?.aegisRating}</p>
                    <p className={`${theme.secondaryText} text-[10px] font-bold uppercase tracking-widest`}>Peak: <span className="text-white">{player?.aegisRatingPeak || 0}</span></p>
                  </div>
                  {/* Tier Progress Bar */}
                  <div className={`h-2.5 w-full bg-black/60 overflow-hidden ${isBGMI ? 'rounded-none border border-zinc-800' : 'rounded-full'}`}>
                    <div
                      className={`h-full ${theme.accentBg} transition-all duration-1000 ${isBGMI ? 'shadow-[0_0_10px_#FF4500]' : ''}`}
                      style={{ width: `${Math.min(((player?.aegisRating || 0) % 500) / 5, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`bg-black/50 backdrop-blur-md p-4 ${isBGMI ? 'rounded-none border-l-2 border-[#FF4500]' : 'rounded-xl border border-[#ece8e1]/10'}`}>
                    <p className={`text-[9px] ${theme.secondaryText} font-black uppercase tracking-widest mb-1.5`}>Rated</p>
                    <p className="text-lg font-bold text-white tracking-widest">{player?.aegisMatchesRated || 0}</p>
                  </div>
                  <div className={`bg-black/50 backdrop-blur-md p-4 ${isBGMI ? 'rounded-none border-l-2 border-[#FF4500]' : 'rounded-xl border border-[#ece8e1]/10'}`}>
                    <p className={`text-[9px] ${theme.secondaryText} font-black uppercase tracking-widest mb-1.5`}>Status</p>
                    <p className={`text-sm font-black tracking-widest mt-1 ${player?.aegisIsProvisional ? 'text-yellow-500' : 'text-green-500'}`}>
                      {player?.aegisIsProvisional ? 'PROV' : 'ACTIVE'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* MIDDLE: Global Events & Live Streams (8 Cols) */}
          <div className="lg:col-span-8 space-y-8">

            {/* Live Competition Matrix */}
            <div className={`${theme.cardBg} border ${theme.cardBorder} ${isBGMI ? 'rounded-none' : 'rounded-3xl'} p-8 relative overflow-hidden group/matrix`}>
              <div className={`absolute top-0 right-0 w-64 h-64 ${theme.ambientGlow}/[0.05] blur-[80px] rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover/matrix:scale-150`}></div>

              <SectionHeader
                title={`${selectedGame} Circuits`}
                icon={CurrentGameIcon}
                actionLabel="View All"
                onAction={() => navigate('/tournaments')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                {tournaments.length > 0 ? tournaments.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => navigate(`/tournament/${t._id}`)}
                    className={`bg-black/60 border ${theme.cardBorder} hover:border-${isBGMI?'[#FF4500]':'[#00FFFF]'} p-5 ${isBGMI ? 'rounded-none hover:translate-x-1' : 'rounded-2xl hover:-translate-y-1'} transition-all cursor-pointer`}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${isBGMI ? 'rounded-none' : 'rounded-xl'} bg-zinc-900 border ${theme.cardBorder} flex items-center justify-center`}>
                          <Trophy className={`w-5 h-5 ${theme.primaryText}`} />
                        </div>
                        <h3 className={`text-sm ${theme.fontTitle} text-white truncate max-w-[140px]`}>{t.shortName || t.tournamentName}</h3>
                      </div>
                      <span className={`text-[9px] font-black px-2.5 py-1 ${isBGMI ? 'rounded-none' : 'rounded'} bg-white/5 ${theme.primaryText} border ${theme.cardBorder} uppercase tracking-widest`}>
                        {t.tier} Tier
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`${theme.secondaryText} flex items-center gap-2`}><Calendar className="w-3.5 h-3.5" /> Start Date</span>
                        <span className="text-white">{new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`${theme.secondaryText} flex items-center gap-2`}><Coins className="w-3.5 h-3.5" /> Prize Pool</span>
                        <span className={theme.primaryText}>₹{t.prizePool?.total?.toLocaleString() || 'TBD'}</span>
                      </div>
                    </div>

                    <div className={`w-full h-1.5 bg-black overflow-hidden ${isBGMI ? 'rounded-none border border-zinc-800' : 'rounded-full'}`}>
                      <div
                        className={`h-full ${theme.accentBg} transition-all duration-1000`}
                        style={{ width: `${(t.participantCount / t.totalSlots) * 100}%` }}
                      ></div>
                    </div>
                    <div className="mt-2 text-right">
                       <span className={`${theme.secondaryText} text-[9px] font-bold tracking-widest uppercase`}>{t.participantCount} / {t.totalSlots} Slots Filled</span>
                    </div>
                  </div>
                )) : (
                  <div className={`col-span-2 py-24 text-center border-2 border-dashed ${theme.cardBorder} ${isBGMI ? 'rounded-none' : 'rounded-2xl'}`}>
                    <Search className={`w-12 h-12 ${theme.secondaryText} mx-auto mb-4 opacity-50`} />
                    <p className={`${theme.primaryText} font-black uppercase tracking-[0.2em] text-sm`}>No Active Circuits</p>
                    <p className={`${theme.secondaryText} text-xs mt-2 uppercase tracking-widest`}>Awaiting deployment orders</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recruitment Matrix */}
            <div className={`${theme.cardBg} border ${theme.cardBorder} ${isBGMI ? 'rounded-none' : 'rounded-3xl'} p-8`}>
              <SectionHeader
                title={`${selectedGame} Intel Hub`}
                icon={Target}
                actionLabel="Scout All"
                onAction={() => navigate('/recruitment')}
              />
              <div className="space-y-4">
                {dashboardOpportunities?.length > 0 ? dashboardOpportunities.map((opp) => (
                  <div
                    key={opp._id}
                    onClick={() => navigate('/recruitment')}
                    className={`p-4 bg-black/40 border ${theme.cardBorder} ${isBGMI ? 'rounded-none hover:border-[#FF4500]' : 'rounded-xl hover:border-[#00FFFF]'} transition-colors cursor-pointer flex items-center justify-between group`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${isBGMI ? 'rounded-none' : 'rounded-lg'} bg-zinc-900 overflow-hidden border ${theme.cardBorder} shrink-0`}>
                        {opp.logo ? <img src={opp.logo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">{opp.teamTag}</div>}
                      </div>
                      <div>
                        <p className={`text-sm ${theme.fontTitle} text-white uppercase`}>{opp.teamName}</p>
                        <p className={`text-[10px] ${theme.secondaryText} font-bold uppercase tracking-widest mt-0.5`}>Scouting for roles</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 max-w-[200px]">
                      {opp.roles?.slice(0, 3).map(role => (
                        <span key={role} className={`text-[9px] font-black px-2 py-1 ${isBGMI ? 'rounded-none' : 'rounded'} bg-black ${theme.primaryText} border ${theme.cardBorder} uppercase`}>{role}</span>
                      ))}
                      {opp.roles?.length > 3 && <span className={`text-[9px] font-black px-2 py-1 ${isBGMI ? 'rounded-none' : 'rounded'} bg-black ${theme.secondaryText} border ${theme.cardBorder}`}>+{opp.roles.length - 3}</span>}
                    </div>
                  </div>
                )) : (
                  <div className={`py-12 text-center bg-black/20 border border-white/5 ${isBGMI ? 'rounded-none' : 'rounded-xl'}`}>
                    <p className={`text-[11px] ${theme.secondaryText} font-black uppercase tracking-widest`}>No intel gathered on scouts</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Tactical Log */}
            <div className={`${theme.cardBg} border ${theme.cardBorder} ${isBGMI ? 'rounded-none' : 'rounded-3xl'} p-8`}>
              <SectionHeader title={`${selectedGame} Tactical Log`} icon={Activity} />
              <div className="space-y-4">
                {matches.length > 0 ? matches.map(match => (
                  <div
                    key={match._id}
                    className={`group relative ${isBGMI ? 'bg-black/80 rounded-none' : 'bg-[#0f1923] rounded-2xl'} border ${theme.cardBorder} hover:border-${isBGMI?'[#FF4500]':'[#00FFFF]'} transition-all overflow-hidden`}
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

                    <div className="relative z-10 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] ${theme.fontTitle} ${theme.primaryText} uppercase tracking-widest mb-1.5 drop-shadow-md`}>
                            {match.tournamentPhase} • {match.map}
                          </p>
                          <h3 className={`text-sm ${theme.fontTitle} text-white truncate uppercase tracking-wider`}>
                            {match.tournamentName}
                          </h3>
                        </div>
                        <div className={`px-3 py-1.5 ${isBGMI ? 'rounded-none' : 'rounded-lg'} text-[10px] font-black italic tracking-tighter ${match.isWin ? `${theme.accentBg} ${theme.accentText} ${theme.glow}` : 'bg-black/80 backdrop-blur-sm text-zinc-400 border border-white/5'}`}>
                          {match.isWin ? 'VICTORY' : `#${match.finalPosition || 'TBD'}`}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className={`bg-black/60 backdrop-blur-md ${isBGMI ? 'rounded-none border-l-2 border-zinc-600' : 'rounded-xl'} p-3 border border-white/5 text-center`}>
                          <p className={`text-[9px] ${theme.secondaryText} font-black uppercase tracking-widest mb-1`}>Kill Pts</p>
                          <p className="text-sm font-bold text-white">{match.points?.kills || 0}</p>
                        </div>
                        <div className={`bg-black/60 backdrop-blur-md ${isBGMI ? 'rounded-none border-l-2 border-zinc-600' : 'rounded-xl'} p-3 border border-white/5 text-center`}>
                          <p className={`text-[9px] ${theme.secondaryText} font-black uppercase tracking-widest mb-1`}>Posi Pts</p>
                          <p className="text-sm font-bold text-white">{match.points?.position || 0}</p>
                        </div>
                        <div className={`bg-black/60 backdrop-blur-md ${isBGMI ? `rounded-none border-l-2 border-[#FF4500]` : `rounded-xl border border-[#00FFFF]/20`} p-3 text-center relative overflow-hidden group/pts`}>
                          <div className={`absolute inset-0 ${theme.ambientGlow}/10 opacity-0 group-hover/pts:opacity-100 transition-opacity`}></div>
                          <p className={`text-[9px] ${theme.primaryText} font-black uppercase tracking-widest mb-1 relative z-10`}>Total</p>
                          <p className="text-sm font-black text-white relative z-10">{match.points?.total || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className={`py-12 text-center bg-black/20 border border-white/5 ${isBGMI ? 'rounded-none' : 'rounded-xl'}`}>
                    <p className={`text-[11px] ${theme.secondaryText} font-black uppercase tracking-widest`}>No recent engagements</p>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default LoggedInHomepage;
