import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, MapPin, Users, Trophy, Clock, Gamepad2, Target,
  TrendingUp, Award, Eye, Share2, MessageCircle, Star,
  ChevronRight, ExternalLink, Copy, Play, Pause, Volume2,
  Medal, Crown, Shield, Zap, Activity, BarChart3, Globe,
  CheckCircle, XCircle, AlertCircle, ArrowRight, Download,
  Youtube, Twitter, Instagram, Hash, X, ChevronDown,
  ChevronUp, UserPlus, Send, Bell, Megaphone, ChevronLeft
} from 'lucide-react';
import ErangelMap from '../assets/mapImages/erangel.jpg';
import MiramarMap from '../assets/mapImages/miramar.webp';
import SanhokMap from '../assets/mapImages/sanhok.webp';
import VikendiMap from '../assets/mapImages/vikendi.jpg';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../utils/axiosConfig';
import { toast } from 'react-toastify';

const fetchTournament = async (id) => {
  const { data } = await axiosInstance.get(`/api/tournaments/${id}`);
  return data;
};

const fetchUserTeam = async () => {
  const { data } = await axiosInstance.get('/api/teams/user/my-teams');
  return data;
};

const fetchMatches = async (id) => {
  const { data } = await axiosInstance.get(`/api/matches/tournament/${id}`);
  return data.matches || [];
};

const fetchTeamRegistrationStatus = async (tournamentId, teamId) => {
  if (!teamId || !tournamentId) return null;
  try {
    const { data } = await axiosInstance.get(`/api/team-tournaments/registration-status/${tournamentId}/${teamId}`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

const fetchTournamentAnnouncements = async (tournamentId) => {
  const { data } = await axiosInstance.get(`/api/tournaments/${tournamentId}/announcements`);
  return data.announcements || [];
};

const DetailedTournamentInfo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedPhase, setSelectedPhase] = useState('');
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({ agreedToTerms: false });
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showNonCaptainModal, setShowNonCaptainModal] = useState(false);
  const [sendingReference, setSendingReference] = useState(false);
  const [referenceSentSuccess, setReferenceSentSuccess] = useState(false);
  const [teamsPage, setTeamsPage] = useState(1);
  const TEAMS_PER_PAGE = 24;
  const [phaseDropdownOpen, setPhaseDropdownOpen] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  const {
    data: tournamentResp,
    isLoading: tournamentLoading,
    error: tournamentError,
    refetch: refetchTournament,
  } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => fetchTournament(id),
    enabled: !!id,
  });

  const {
    data: userTeamResp,
    isLoading: userTeamLoading,
    error: userTeamError,
  } = useQuery({
    queryKey: ['userTeam'],
    queryFn: fetchUserTeam,
    enabled: !!user,
  });

  const [matchPhase, setMatchPhase] = useState('');
  const [matchGroup, setMatchGroup] = useState('All');
  const [matchPage, setMatchPage] = useState(1);
  const MATCHES_PER_PAGE = 12;

  const {
    data: matchesDataResp,
    isLoading: matchesLoading,
    error: matchesError,
  } = useQuery({
    queryKey: ['matches', id, matchPhase, matchGroup, matchPage],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/matches/tournament/${id}`, {
        params: {
          phase: matchPhase === 'All' ? '' : matchPhase,
          group: matchGroup === 'All' ? '' : matchGroup,
          status: 'completed',
          limit: MATCHES_PER_PAGE,
          offset: (matchPage - 1) * MATCHES_PER_PAGE
        }
      });
      return data;
    },
    enabled: !!id,
  });

  const matchesData = matchesDataResp?.matches || [];
  const matchesPagination = matchesDataResp?.pagination || null;

  const userTeam = userTeamResp?.teams?.[0] || null;

  const {
    data: registrationStatus,
    isLoading: registrationStatusLoading,
    refetch: refetchRegistrationStatus,
  } = useQuery({
    queryKey: ['teamRegistrationStatus', id, userTeam?._id],
    queryFn: () => fetchTeamRegistrationStatus(id, userTeam?._id),
    enabled: !!id && !!userTeam?._id,
  });

  const {
    data: announcementsData = [],
    isLoading: announcementsLoading,
  } = useQuery({
    queryKey: ['tournamentAnnouncements', id],
    queryFn: () => fetchTournamentAnnouncements(id),
    enabled: !!id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: paginatedTeamsData,
    isLoading: paginatedTeamsLoading,
  } = useQuery({
    queryKey: ['tournamentTeams', id, selectedPhase, selectedGroup, teamsPage],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/tournaments/${id}/teams`, {
        params: {
          phase: selectedPhase,
          group: selectedGroup === 'All' ? '' : selectedGroup,
          page: teamsPage,
          limit: 24,
        }
      });
      return data;
    },
    enabled: !!id && !!selectedPhase && activeTab === 'teams',
    placeholderData: (previousData) => previousData,
  });

  const tournamentData = tournamentResp?.tournamentData || null;
  const scheduleData = tournamentResp?.scheduleData || [];
  const groupsData = tournamentResp?.groupsData || {};
  const tournamentStats = tournamentResp?.tournamentStats || null;
  const streamLinks = tournamentResp?.streamLinks || [];

  const isCaptain = userTeam && user && userTeam.captain?._id?.toString() === user._id?.toString();
  const registrationClosed = tournamentData?.registrationEndDate && new Date(tournamentData.registrationEndDate) < new Date();
  const isTeamRegistered = !!registrationStatus?.registration;
  const registrationPending = registrationStatus?.registration?.status === 'pending';
  const registrationApproved = ['approved', 'checked_in'].includes(registrationStatus?.registration?.status);

  useEffect(() => {
    console.log('Registration Status Data:', registrationStatus);
  }, [registrationStatus]);

  useEffect(() => {
    if (groupsData[selectedPhase]) {
      const availableGroups = Object.keys(groupsData[selectedPhase]);
      if (availableGroups.length > 0 && selectedGroup !== 'All' && !availableGroups.includes(selectedGroup)) {
        setSelectedGroup(availableGroups[0]);
      }
    }
  }, [selectedPhase, groupsData, selectedGroup]);

  useEffect(() => {
    setTeamsPage(1);
  }, [selectedGroup]);

  useEffect(() => {
    setTeamsPage(1);
  }, [selectedPhase]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  useEffect(() => {
    if (tournamentData?.phases?.length > 0) {
      const currentPhase = tournamentData.phases.find(p => p.status === 'in_progress') ||
        tournamentData.phases[0];
      setSelectedPhase(currentPhase.name);
      setMatchPhase(currentPhase.name); // Set initial match phase too
    }
  }, [tournamentData]);

  const sendTournamentReferenceToCaptain = async () => {
    if (!userTeam || !userTeam.captain) return;
    setSendingReference(true);
    try {
      const messagePayload = {
        receiverId: userTeam.captain._id,
        captainId: userTeam.captain._id,
        messageType: 'tournament_reference',
        message: `Please register our team for the tournament: ${tournamentData.name}`,
        tournamentId: tournamentData._id,
        tournamentName: tournamentData.name,
        tournamentDate: tournamentData.startDate,
        prizePool: tournamentData.prizePool?.total || 0,
        totalSlots: tournamentData.teams || 0,
      };
      await axiosInstance.post(`/api/chat/tournament-reference/${tournamentData._id}`, messagePayload);
      setReferenceSentSuccess(true);
    } catch (error) {
      console.error('Error sending tournament reference:', error);
      alert('Failed to send tournament reference message. Please try again later.');
    } finally {
      setSendingReference(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setRegistrationLoading(true);
    setRegistrationError('');

    if (!registrationForm.agreedToTerms) {
      setRegistrationError('You must agree to the terms and conditions to register.');
      setRegistrationLoading(false);
      return;
    }

    try {
      if (!userTeam) throw new Error('User team data not available.');

      const allPlayers = userTeam.players ? [...userTeam.players] : [];
      if (userTeam.substitute) allPlayers.push(userTeam.substitute);

      const registrationData = {
        tournamentId: id,
        teamId: userTeam._id,
        teamName: userTeam.teamName,
        teamTag: userTeam.teamTag,
        teamLogo: userTeam.logo,
        captainName: userTeam.captain?.name || '',
        captainEmail: userTeam.captain?.email || '',
        captainPhone: userTeam.captain?.phone || '',
        players: allPlayers.map(player => player.name || player),
      };

      const response = await axiosInstance.post(`/api/team-tournaments/register/${id}`, registrationData);
      setRegistrationSuccess(true);
      setShowRegistrationModal(false);
      setRegistrationForm({ agreedToTerms: false });
      await refetchRegistrationStatus();
      await refetchTournament();
    } catch (error) {
      setRegistrationError(error.error || error.message || 'Registration failed');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const mapImages = {
    'Erangel': ErangelMap,
    'Miramar': MiramarMap,
    'Sanhok': SanhokMap,
    'Vikendi': VikendiMap,
    'Livik': ErangelMap,
    'Nusa': ErangelMap,
    'Rondo': ErangelMap,
  };

  const groupKeys = useMemo(() => {
    if (!groupsData[selectedPhase]) return [];
    const keys = Object.keys(groupsData[selectedPhase]).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB || a.localeCompare(b);
    });
    return ['All', ...keys];
  }, [groupsData, selectedPhase]);

  // Derived standings data for completed phases
  const phaseStandings = tournamentResp?.phaseStandings || [];
  const standingsData = useMemo(() => {
    const phaseDoc = tournamentData?.phases?.find(p => p.name === selectedPhase);
    if (phaseDoc?.status !== 'completed') return [];

    if (selectedGroup === 'All') {
      const ps = phaseStandings.find(p => p.phase === selectedPhase);
      return (ps?.topTeams || []).map(s => ({
        ...s,
        team: s.team, // already populated in backend
        points: s.points,
        killPoints: s.killPoints || 0,
        positionPoints: s.positionPoints || 0,
        chickenDinners: s.chickenDinners || 0
      }));
    }

    return groupsData[selectedPhase]?.[selectedGroup]?.standings || [];
  }, [selectedPhase, selectedGroup, groupsData, phaseStandings, tournamentData]);

  const TabButton = ({ id, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${isActive
        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30'
        : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50 hover:text-white'
        }`}
    >
      {label}
    </button>
  );

  const StatCard = ({ icon: Icon, label, value, sublabel, color = 'orange' }) => (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 shadow-lg hover:scale-105 transition-transform">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 text-${color}-400`} />
      </div>
      <div className={`text-xl font-bold text-${color}-400 mb-1`}>{value}</div>
      <div className="text-zinc-400 text-xs">{label}</div>
      {sublabel && <div className="text-zinc-500 text-xs mt-0.5">{sublabel}</div>}
    </div>
  );

  const StatusBadge = ({ status }) => {
    const getStatusConfig = (status) => {
      const liveStatuses = ['in_progress', 'qualifiers_in_progress', 'group_stage', 'playoffs', 'finals'];
      const completedStatuses = ['completed'];
      const upcomingStatuses = ['announced', 'registration_open', 'registration_closed', 'scheduled'];
      if (liveStatuses.includes(status)) return { color: 'red', text: 'Live', icon: Activity, pulse: true };
      if (completedStatuses.includes(status)) return { color: 'green', text: 'Completed', icon: CheckCircle, pulse: false };
      if (upcomingStatuses.includes(status)) return { color: 'blue', text: 'Upcoming', icon: Clock, pulse: false };
      return { color: 'gray', text: 'Unknown', icon: AlertCircle, pulse: false };
    };
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-${config.color}-500/20 border border-${config.color}-500/30 text-${config.color}-400`}>
        <Icon className={`w-3.5 h-3.5 ${config.pulse ? 'animate-pulse' : ''}`} />
        {config.text}
      </div>
    );
  };

  const MatchCard = ({ match }) => {
    const navigate = useNavigate();
    const mapImages = {
      'Erangel': ErangelMap,
      'Miramar': MiramarMap,
      'Sanhok': SanhokMap,
      'Vikendi': VikendiMap
    };
    const mapImage = mapImages[match.map] || ErangelMap;
    const winnerTeam = match.results?.find(pt => pt.finalPosition === 1 || pt.chickenDinner)?.team || match.winner?.team;

    return (
      <div
        onClick={() => navigate(`/matches/${match._id}`)}
        className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 hover:border-orange-500/50 hover:bg-zinc-800/60 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {match.matchNumber}
            </div>
            <div>
              <div className="text-white font-medium text-sm">{match.tournamentPhase || match.phase}</div>
              <div className="text-zinc-400 text-xs">Match {match.matchNumber}</div>
            </div>
          </div>
          <StatusBadge status={match.status} />
        </div>
        <div className="flex gap-3 mb-3">
          <div className="relative shrink-0">
            <img
              src={mapImage}
              alt={match.map}
              className="w-16 h-14 rounded-lg object-cover"
              onError={(e) => { e.target.src = `https://placehold.co/64x56/1a1a1a/ffffff?text=${match.map || 'MAP'}`; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-lg" />
            <div className="absolute bottom-1 left-1 text-white text-xs font-medium">{match.map}</div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {match.groupNames?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {match.groupNames.map((name, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-300 text-[10px] uppercase tracking-wider font-semibold border border-zinc-600/30">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <div className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold italic">
              Battle Royale • {match.map}
            </div>
          </div>
        </div>
        {match.status === 'completed' && winnerTeam && (
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-medium text-xs">Winner • Match Champion</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <img
                src={winnerTeam.logo || `https://placehold.co/32x32/1a1a1a/fb923c?text=${encodeURIComponent((winnerTeam.teamTag || winnerTeam.teamName || winnerTeam.name || '?')[0])}`}
                alt={winnerTeam.teamName || winnerTeam.name}
                className="w-6 h-6 rounded object-cover border border-amber-500/20"
                onError={(e) => { e.target.src = `https://placehold.co/32x32/1a1a1a/fb923c?text=${encodeURIComponent((winnerTeam.teamTag || winnerTeam.teamName || winnerTeam.name || '?')[0])}`; }}
              />
              <span className="text-white font-bold text-sm tracking-tight">{winnerTeam.teamName || winnerTeam.name}</span>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-3 pt-2 border-t border-zinc-700">
          <div className="flex items-center gap-1 text-orange-400 text-xs group-hover:text-orange-300 transition-colors">
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  };

  const formatPrizePool = (prizePool) => {
    if (!prizePool || !prizePool.total || prizePool.total === 0) return 'TBD';
    const amount = prizePool.total;
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return 'TBD'; }
  };

  if (tournamentLoading || userTeamLoading || matchesLoading) {
    return (
      <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-orange-400 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (tournamentError || userTeamError || matchesError) {
    return (
      <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans pt-24 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">Error loading tournament data</div>
          <p className="text-zinc-400 mb-4">{tournamentError?.message || userTeamError?.message || matchesError?.message}</p>
          <button onClick={() => window.location.reload()} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  if (!tournamentData) {
    return (
      <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans pt-24 flex items-center justify-center">
        <p className="text-zinc-400">Tournament not found</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans pt-[100px]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Header Banner ───────────────────────────────────────── */}
        <div className="relative mb-6 rounded-2xl overflow-hidden">
          <img
            src={tournamentData?.media?.coverImage || tournamentData?.media?.banner || 'https://placehold.co/1200x400/1a1a1a/ffffff?text=Tournament+Banner'}
            alt="Tournament Banner"
            className="w-full h-48 sm:h-64 md:h-80 object-cover"
            onError={(e) => { e.target.src = 'https://placehold.co/1200x400/1a1a1a/ffffff?text=Tournament+Banner'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent" />

          <div className="absolute bottom-4 sm:bottom-8 left-4 sm:left-8 right-4 sm:right-8">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-3 sm:gap-6 flex-1 min-w-0">
                <img
                  src={tournamentData?.media?.logo || 'https://placehold.co/96x96/1a1a1a/ffffff?text=LOGO'}
                  alt="Tournament Logo"
                  className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl border-2 border-orange-400 shadow-lg shrink-0"
                  onError={(e) => { e.target.src = 'https://placehold.co/96x96/1a1a1a/ffffff?text=LOGO'; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                    <StatusBadge status={tournamentData?.status} />
                    <span className="text-orange-400 font-medium text-xs sm:text-sm hidden sm:block">{tournamentData?.currentPhase || 'Tournament'}</span>
                    <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-700/50 border border-zinc-500/30 rounded text-xs font-medium text-zinc-300">
                      {tournamentData?.tier ? `Tier ${tournamentData.tier}` : 'Tournament'}
                    </div>
                  </div>
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2 truncate">{tournamentData?.name || 'Tournament Name'}</h1>
                  <div className="hidden sm:flex flex-wrap items-center gap-3 sm:gap-6 text-zinc-300 text-sm">
                    <span className="flex items-center gap-1.5"><Gamepad2 className="w-4 h-4 text-orange-400" />{tournamentData?.game || 'Game'}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-orange-400" />{tournamentData?.region || 'Region'}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-orange-400" />{formatDate(tournamentData?.startDate)} – {formatDate(tournamentData?.endDate)}</span>
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-orange-400" />{tournamentData?.teams || 0} Teams</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex gap-2 shrink-0">
                <button
                  onClick={handleCopyLink}
                  className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg transition-colors group"
                  title="Copy Link"
                >
                  <Share2 className="w-4 h-4 text-zinc-300 group-hover:text-orange-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile meta row */}
        <div className="flex flex-wrap gap-3 sm:hidden mb-4 text-xs text-zinc-300">
          <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5 text-orange-400" />{tournamentData?.game}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-orange-400" />{tournamentData?.region}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-orange-400" />{tournamentData?.teams || 0} Teams</span>
        </div>

        {/* ── Quick Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Trophy} label="Prize Pool" value={formatPrizePool(tournamentData?.prizePool)} sublabel={tournamentData?.prizePool?.currency || 'INR'} color="green" />
          <StatCard icon={Gamepad2} label="Matches" value={tournamentStats?.completedMatches || 0} sublabel="Completed" color="blue" />
          <StatCard icon={Target} label="Total Kills" value={formatNumber(tournamentStats?.totalKills)} sublabel={`Avg: ${tournamentStats?.averageKills || 0}/match`} color="red" />
          <StatCard icon={Trophy} label="Status" value={tournamentData?.status?.replace('_', ' ') || 'Upcoming'} sublabel="Tournament Status" color="orange" />
        </div>

        {/* ── Navigation Tabs ──────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 mb-6">
          <div className="flex gap-2 min-w-max sm:flex-wrap sm:min-w-0">
            <TabButton id="overview" label="Overview" isActive={activeTab === 'overview'} onClick={setActiveTab} />
            <TabButton id="schedule" label="Schedule" isActive={activeTab === 'schedule'} onClick={setActiveTab} />
            <TabButton id="teams" label="Standings" isActive={activeTab === 'teams'} onClick={setActiveTab} />
            <TabButton id="matches" label="All Matches" isActive={activeTab === 'matches'} onClick={setActiveTab} />
            <TabButton id="announcements" label="Announcements" isActive={activeTab === 'announcements'} onClick={setActiveTab} />
          </div>
        </div>

        {/* ── Tab Content ──────────────────────────────────────────── */}
        <div className="min-h-[600px]">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Tournament Information</h2>
                  {tournamentData.description && (
                    <p className="text-zinc-300 mb-6 leading-relaxed text-sm sm:text-base">
                      {tournamentData.description}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Details</h3>
                      <div className="space-y-2.5 text-sm">
                        {[
                          ['Organizer', tournamentData?.organizer?.name || 'Unknown'],
                          ['Format', tournamentData?.format || 'Battle Royale'],
                          ['Game Mode', tournamentData?.gameSettings?.gameMode || 'TPP Squad'],
                          ['Maps', tournamentData?.gameSettings?.maps?.join(', ') || 'Erangel, Miramar'],
                          ['Server', tournamentData?.gameSettings?.serverRegion || 'Asia'],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-2">
                            <span className="text-zinc-400 shrink-0">{label}</span>
                            <span className="text-white font-medium text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Prize Distribution</h3>
                      <div className="space-y-3">
                        {tournamentData?.prizePool?.distribution?.length > 0 ? (
                          <div className="space-y-2">
                            {tournamentData.prizePool.distribution.slice(0, 3).map((prize, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-zinc-800/50 rounded-lg text-sm">
                                <span className="text-zinc-300">{prize.position}</span>
                                <span className="text-green-400 font-medium">₹{prize.amount?.toLocaleString() || '0'}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-zinc-400 text-sm">Prize distribution TBD</div>
                        )}
                        {tournamentData?.prizePool?.individualAwards?.length > 0 && (
                          <div className="space-y-2">
                            {tournamentData.prizePool.individualAwards.slice(0, 2).map((award, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-zinc-800/50 rounded-lg">
                                <div>
                                  <div className="text-zinc-300 text-sm font-medium">{award.name}</div>
                                  <div className="text-zinc-500 text-xs">{award.description}</div>
                                </div>
                                <span className="text-amber-400 font-medium text-sm">₹{award.amount?.toLocaleString() || '0'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {tournamentData?.prizePool?.distribution?.length > 0 && (
                          <button onClick={() => setShowPrizeModal(true)} className="text-orange-400 text-sm hover:text-orange-300 transition-colors">
                            View full prize breakdown →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {tournamentData.phases?.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Tournament Phases</h3>
                      <div className="space-y-2">
                        {tournamentData.phases.map((phase, index) => (
                          <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-zinc-800/50 rounded-lg">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-medium text-sm">{phase.name}</span>
                                <StatusBadge status={phase.status} />
                              </div>
                              {phase.description && <div className="text-zinc-400 text-xs mt-0.5">{phase.description}</div>}
                            </div>
                            <div className="text-zinc-300 text-xs shrink-0">{formatDate(phase.startDate)}{phase.endDate !== phase.startDate && ` – ${formatDate(phase.endDate)}`}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>


              </div>

              {/* Sidebar */}
              <div className="space-y-5">

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                  <div className="space-y-2.5">
                    {user ? (
                      registrationClosed ? (
                        <div className="w-full bg-red-600 text-white font-medium px-4 py-3 rounded-lg text-center text-sm">Registration Closed</div>
                      ) : userTeam ? (
                        isTeamRegistered ? (
                          registrationPending ? (
                            <div className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-medium px-4 py-3 rounded-lg text-center flex items-center justify-center gap-2 text-sm">
                              <Clock className="w-4 h-4 animate-pulse" />Registration Pending Approval
                            </div>
                          ) : (
                            <div className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium px-4 py-3 rounded-lg text-center flex items-center justify-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4" />Team Already Registered
                            </div>
                          )
                        ) : isCaptain ? (
                          <button onClick={() => setShowRegistrationModal(true)} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium px-4 py-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm">
                            <UserPlus className="w-4 h-4" />Register Team
                          </button>
                        ) : (
                          <button onClick={() => setShowNonCaptainModal(true)} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium px-4 py-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm">
                            <Shield className="w-4 h-4" />Register Team
                          </button>
                        )
                      ) : (
                        <button onClick={() => navigate('/my-teams')} className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium px-4 py-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm">
                          <Users className="w-4 h-4" />Join a team first
                        </button>
                      )
                    ) : (
                      <button onClick={() => navigate('/login')} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-4 py-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm">
                        <UserPlus className="w-4 h-4" />Login to Register
                      </button>
                    )}
                    <button
                      onClick={handleCopyLink}
                      className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-medium px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Copy className="w-4 h-4" />Copy Tournament URL
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-white mb-4">Points System</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Kill Points</span>
                      <span className="text-orange-400 font-bold">{tournamentData?.gameSettings?.pointsSystem?.killPoints || 1} per kill</span>
                    </div>
                    <div>
                      <div className="text-zinc-400 text-sm mb-2">Placement Points</div>
                      <div className="grid grid-cols-2 gap-1.5 text-sm">
                        {[1, 2, 3, 4].map(position => (
                          <div key={position} className="flex justify-between">
                            <span className="text-zinc-500">#{position}:</span>
                            <span className={position === 1 ? 'text-amber-400' : 'text-zinc-400'}>
                              {tournamentData?.gameSettings?.pointsSystem?.placementPoints?.[position] || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Tournament Schedule</h2>
                {tournamentData.phases?.length > 0 ? (
                  tournamentData.phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="mb-8">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-white">{phase.name}</h3>
                        <StatusBadge status={phase.status} />
                        <span className="text-zinc-400 text-sm">{formatDate(phase.startDate)} – {formatDate(phase.endDate)}</span>
                      </div>
                      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                        <p className="text-zinc-400 text-center text-sm">Detailed match schedules are available in the "All Matches" section.</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8"><p className="text-zinc-400">Schedule will be updated soon</p></div>
                )}
              </div>
            </div>
          )}

          {/* ── GROUPS / TEAMS ── */}
          {activeTab === 'teams' && (
            <div className="space-y-5">

              {/* Control Bar */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">

                {/* Phase dropdown */}
                {tournamentData?.phases?.length > 0 && (
                  <div className="relative">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Phase</div>
                    <button
                      onClick={() => { setPhaseDropdownOpen(o => !o); setGroupDropdownOpen(false); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 hover:border-orange-500/60 rounded-xl text-sm font-medium text-white transition-all min-w-[180px] justify-between group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                        {selectedPhase || 'Select Phase'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${phaseDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                    </button>
                    {phaseDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPhaseDropdownOpen(false)} />
                        <div className="absolute top-full mt-2 left-0 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden min-w-[220px]">
                          {tournamentData.phases.map((phase) => (
                            <button
                              key={phase.name}
                              onClick={() => { setSelectedPhase(phase.name); setPhaseDropdownOpen(false); setGroupSearch(''); }}
                              className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors ${selectedPhase === phase.name ? 'bg-orange-500/15 text-orange-400' : 'text-zinc-300 hover:bg-zinc-800'
                                }`}
                            >
                              <span className="font-medium">{phase.name}</span>
                              <StatusBadge status={phase.status} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Group dropdown — searchable, shows all groups */}
                <div className="relative">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Group</div>
                  <button
                    onClick={() => { setGroupDropdownOpen(o => !o); setPhaseDropdownOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 hover:border-orange-500/60 rounded-xl text-sm font-medium text-white transition-all min-w-[160px] justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-400">
                        {selectedGroup === 'All' ? '∞' : selectedGroup}
                      </span>
                      {selectedGroup === 'All' ? 'All Groups' : `Group ${selectedGroup}`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${groupDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                  </button>

                  {groupDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setGroupDropdownOpen(false)} />
                      <div className="absolute top-full mt-2 left-0 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/60 w-64">
                        {/* Search */}
                        <div className="p-2 border-b border-zinc-800">
                          <input
                            autoFocus
                            type="text"
                            value={groupSearch}
                            onChange={e => setGroupSearch(e.target.value)}
                            placeholder="Search group number…"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/60"
                          />
                        </div>
                        {/* Group list */}
                        <div className="max-h-64 overflow-y-auto p-1.5">
                          {groupKeys.length === 0 ? (
                            <div className="px-4 py-5 text-zinc-500 text-sm text-center">No groups available</div>
                          ) : (
                            groupKeys
                              .filter(k => !groupSearch || k.toLowerCase().includes(groupSearch.toLowerCase()))
                              .map((groupKey) => {
                                const isActive = selectedGroup === groupKey;
                                let count = 0;
                                if (groupKey === 'All') {
                                  // Sum up all teams in all groups for this phase
                                  count = Object.values(groupsData[selectedPhase] || {}).reduce((acc, curr) => {
                                    return acc + (curr.teams?.length ?? (curr.standings?.length ?? 0));
                                  }, 0);
                                } else {
                                  count = groupsData[selectedPhase]?.[groupKey]?.teams?.length ?? (groupsData[selectedPhase]?.[groupKey]?.standings?.length ?? 0);
                                }

                                return (
                                  <button
                                    key={groupKey}
                                    onClick={() => { setSelectedGroup(groupKey); setGroupDropdownOpen(false); setGroupSearch(''); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-orange-500 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                                      }`}
                                  >
                                    <span className="font-medium">{groupKey === 'All' ? 'All Groups' : `Group ${groupKey}`}</span>
                                    {count > 0 && (
                                      <span className={`text-xs ${isActive ? 'text-orange-100' : 'text-zinc-500'}`}>
                                        {count} {count === 1 ? 'team' : 'teams'}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                          )}
                          {groupKeys.filter(k => !groupSearch || k.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                            <div className="px-4 py-4 text-zinc-500 text-sm text-center">No groups match "{groupSearch}"</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Stats summary */}
                <div className="sm:ml-auto flex items-center gap-4 py-1">
                  <div className="text-center">
                    <div className="text-base font-bold text-white">{groupKeys.length}</div>
                    <div className="text-xs text-zinc-500">Groups</div>
                  </div>
                  <div className="w-px h-7 bg-zinc-700" />
                  <div className="text-center">
                    <div className="text-base font-bold text-orange-400">{paginatedTeamsData?.total ?? 0}</div>
                    <div className="text-xs text-zinc-500">{selectedGroup === 'All' ? 'Total teams' : 'In group'}</div>
                  </div>
                </div>
              </div>

              {/* Summary Header */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-3">
                  {selectedPhase} · {selectedGroup === 'All' ? 'Full Roster' : `Group ${selectedGroup}`}
                  {tournamentData?.phases?.find(p => p.name === selectedPhase)?.status === 'completed' ? ' (Points Table)' : ' (Slot List)'}
                </span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              {/* Conditional Content: Points Table or Slot List */}
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl overflow-hidden">
                {paginatedTeamsLoading ? (
                  <div className="divide-y divide-zinc-800">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                        <div className="w-6 h-4 bg-zinc-700 rounded" />
                        <div className="w-8 h-8 bg-zinc-700 rounded-md shrink-0" />
                        <div className="flex-1 h-3.5 bg-zinc-700 rounded" />
                        <div className="w-12 h-5 bg-zinc-700 rounded" />
                      </div>
                    ))}
                  </div>
                ) : tournamentData?.phases?.find(p => p.name === selectedPhase)?.status === 'completed' ? (
                  /* ── POINTS TABLE VIEW ── */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/60 border-b border-zinc-800">
                          <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-12 text-center">#</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Team</th>
                          <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center w-10">M</th>
                          <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center w-12">WWCD</th>
                          <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center w-16">Placement</th>
                          <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center w-14">Kills</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-orange-500/80 uppercase tracking-wider text-center w-16 bg-orange-500/5">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {(selectedGroup === 'All' ? (standingsData || []) : (standingsData || [])).slice((teamsPage - 1) * 24, teamsPage * 24).map((teamEntry, index) => {
                          const team = teamEntry.team;
                          return (
                            <tr key={team._id || index} className="hover:bg-zinc-700/30 transition-colors group">
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 && teamsPage === 1 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                                  index === 1 && teamsPage === 1 ? 'bg-zinc-400/20 text-zinc-400 border border-zinc-400/30' :
                                    index === 2 && teamsPage === 1 ? 'bg-orange-700/20 text-orange-700 border border-orange-700/30' :
                                      'text-zinc-500'
                                  }`}>
                                  {(teamsPage - 1) * 24 + index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={team.logo || `https://placehold.co/32x32/27272a/71717a?text=${encodeURI((team.tag || team.name || '?')[0])}`}
                                    className="w-8 h-8 rounded-md border border-zinc-700 shrink-0"
                                    alt={team.name}
                                    onError={(e) => { e.target.src = `https://placehold.co/32x32/27272a/71717a?text=${encodeURI((team.tag || team.name || '?')[0])}`; }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-white text-sm font-bold truncate group-hover:text-orange-400 transition-colors">{team.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono tracking-tighter">{team.tag || 'NO TAG'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center text-zinc-300 text-sm font-medium">{teamEntry.matchesPlayed || 0}</td>
                              <td className="px-2 py-3 text-center text-amber-400 text-sm font-bold">{teamEntry.chickenDinners || 0}</td>
                              <td className="px-2 py-3 text-center text-zinc-400 text-sm">{teamEntry.positionPoints || 0}</td>
                              <td className="px-2 py-3 text-center text-zinc-400 text-sm">{teamEntry.killPoints || 0}</td>
                              <td className="px-4 py-3 text-center text-white text-sm font-black bg-orange-500/5">{teamEntry.points || 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : paginatedTeamsData?.teams?.length > 0 ? (
                  /* ── SLOT LIST VIEW (FOR ACTIVE/UPCOMING PHASES) ── */
                  <div className="divide-y divide-zinc-800/70">
                    {paginatedTeamsData.teams.map((team, index) => (
                      <div
                        key={team._id || index}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-700/30 transition-colors"
                      >
                        <span className="w-6 text-center text-xs font-bold text-zinc-600 shrink-0">
                          {team.slot || (teamsPage - 1) * 24 + index + 1}
                        </span>
                        <img
                          src={team.logo || `https://placehold.co/32x32/27272a/71717a?text=${encodeURIComponent((team.tag || team.name || '?')[0])}`}
                          alt={team.name}
                          className="w-8 h-8 rounded-md object-cover border border-zinc-700 shrink-0"
                          onError={(e) => { e.target.src = `https://placehold.co/32x32/27272a/71717a?text=${encodeURIComponent((team.tag || team.name || '?')[0])}`; }}
                        />
                        <span className="flex-1 text-white text-sm font-medium truncate">{team.name}</span>
                        {team.tag && (
                          <span className="text-xs font-mono text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 shrink-0">
                            {team.tag}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400 font-medium">No teams or standings found</p>
                    <p className="text-zinc-500 text-sm mt-1">
                      {selectedPhase ? `${selectedPhase} · Group ${selectedGroup}` : 'Select a phase and group above'}
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination — only shown if >1 page */}
              {((tournamentData?.phases?.find(p => p.name === selectedPhase)?.status === 'completed' ? Math.ceil((standingsData?.length || 0) / 24) : paginatedTeamsData?.totalPages) > 1) && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setTeamsPage(p => Math.max(1, p - 1))}
                    disabled={teamsPage === 1}
                    className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  {Array.from({ length: (tournamentData?.phases?.find(p => p.name === selectedPhase)?.status === 'completed' ? Math.ceil((standingsData?.length || 0) / 24) : paginatedTeamsData?.totalPages) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setTeamsPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === teamsPage ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setTeamsPage(p => Math.min((tournamentData?.phases?.find(p => p.name === selectedPhase)?.status === 'completed' ? Math.ceil((standingsData?.length || 0) / 24) : paginatedTeamsData?.totalPages), p + 1))}
                    disabled={teamsPage === (tournamentData?.phases?.find(p => p.name === selectedPhase)?.status === 'completed' ? Math.ceil((standingsData?.length || 0) / 24) : paginatedTeamsData?.totalPages)}
                    className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="space-y-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Tournament Matches</h2>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Phase Selector */}
                    <div className="flex items-center gap-2 bg-zinc-800/80 p-1 rounded-lg border border-zinc-700">
                      <select
                        value={matchPhase}
                        onChange={(e) => { setMatchPhase(e.target.value); setMatchPage(1); }}
                        className="bg-transparent text-sm text-zinc-300 outline-none px-2 py-1 cursor-pointer hover:text-white"
                      >
                        <option value="All">All Phases</option>
                        {tournamentData?.phases?.map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Group Selector */}
                    <div className="flex items-center gap-2 bg-zinc-800/80 p-1 rounded-lg border border-zinc-700">
                      <select
                        value={matchGroup}
                        onChange={(e) => { setMatchGroup(e.target.value); setMatchPage(1); }}
                        className="bg-transparent text-sm text-zinc-300 outline-none px-2 py-1 cursor-pointer hover:text-white"
                      >
                        <option value="All">All Groups</option>
                        {matchPhase !== 'All' && groupsData[matchPhase] && Object.keys(groupsData[matchPhase]).map(g => (
                          <option key={g} value={groupsData[matchPhase][g].groupId || g}>Group {g}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {matchesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-48 bg-zinc-800/50 rounded-xl animate-pulse border border-zinc-700/30" />
                    ))}
                  </div>
                ) : matchesData.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                      {matchesData.map((match) => (
                        <MatchCard key={match._id} match={match} />
                      ))}
                    </div>

                    {/* Pagination */}
                    {matchesPagination?.total > MATCHES_PER_PAGE && (
                      <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-800">
                        <button
                          onClick={() => setMatchPage(p => Math.max(1, p - 1))}
                          disabled={matchPage === 1}
                          className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" /> Prev
                        </button>
                        <span className="text-zinc-500 text-sm px-4">
                          Page {matchPage} of {Math.ceil(matchesPagination.total / MATCHES_PER_PAGE)}
                        </span>
                        <button
                          onClick={() => setMatchPage(p => p + 1)}
                          disabled={!matchesPagination.hasMore}
                          className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16">
                    <Gamepad2 className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Matches Found</h3>
                    <p className="text-zinc-400">Try adjusting your filters or check back later</p>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* ── ANNOUNCEMENTS ── */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Announcements</h2>
                  <p className="text-zinc-400 text-sm">Official updates from the organizer</p>
                </div>
              </div>
              {announcementsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 animate-pulse">
                      <div className="h-3 w-24 bg-zinc-700 rounded mb-2" />
                      <div className="h-4 w-48 bg-zinc-700 rounded mb-2" />
                      <div className="h-3 w-full bg-zinc-700 rounded" />
                    </div>
                  ))}
                </div>
              ) : announcementsData.length === 0 ? (
                <div className="text-center py-20 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                  <Bell className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 font-medium">No announcements yet</p>
                  <p className="text-zinc-500 text-sm mt-1">Check back later for updates from the organizer</p>
                </div>
              ) : (
                announcementsData.map((ann) => {
                  const targetBadge = (() => {
                    if (ann.targetType === 'general') return { text: '🌐 General', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
                    if (ann.targetType === 'specific_teams') return { text: '👥 Your Team', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
                    if (ann.targetType === 'phase') return { text: `🏁 ${ann.targetPhase}`, cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
                    if (ann.targetType === 'group') return { text: `📦 ${ann.targetPhase} › ${ann.targetGroup}`, cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
                    return { text: ann.targetType, cls: 'bg-zinc-700 text-zinc-400 border-zinc-600' };
                  })();
                  return (
                    <div key={ann._id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${targetBadge.cls}`}>{targetBadge.text}</span>
                        <span className="text-xs text-zinc-500 whitespace-nowrap shrink-0">
                          {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-white font-semibold mb-2">{ann.title}</h3>
                      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{ann.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div >

      {/* ── Registration Modal ── */}
      {
        showRegistrationModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 sm:p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Register Team for Tournament</h2>
                  <button onClick={() => setShowRegistrationModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleRegistration} className="p-5 sm:p-6 space-y-6">
                {userTeam ? (
                  <>
                    <div className="text-white">
                      <h3 className="text-base font-semibold mb-2">Team Information</h3>
                      <p className="text-sm text-zinc-300"><strong className="text-white">Name:</strong> {userTeam.teamName}</p>
                      <p className="text-sm text-zinc-300"><strong className="text-white">Tag:</strong> {userTeam.teamTag}</p>
                      {userTeam.logo ? (
                        <img
                          src={userTeam.logo}
                          alt="Team Logo"
                          className="w-16 h-16 rounded-lg mt-2 object-cover border border-zinc-700"
                          onError={(e) => { e.target.src = `https://placehold.co/64x64/27272a/ffffff?text=${encodeURIComponent((userTeam.teamTag || userTeam.teamName || '?')[0])}`; }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg mt-2 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-500">
                          {(userTeam.teamTag || userTeam.teamName || '?')[0]}
                        </div>
                      )}
                    </div>
                    <div className="text-white">
                      <h3 className="text-base font-semibold mb-2">Captain Information</h3>
                      <p className="text-sm text-zinc-300"><strong className="text-white">Username:</strong> {userTeam.captain?.username || 'N/A'}</p>
                    </div>
                    <div className="text-white">
                      <h3 className="text-base font-semibold mb-2">Team Players ({userTeam.players?.length || 0})</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {userTeam.players?.map((player, index) => (
                          <li key={index} className="text-sm text-zinc-300">{player.username || player.name || player}</li>
                        ))}
                        {userTeam.substitute && <li className="text-sm text-zinc-300">{userTeam.substitute.username || userTeam.substitute.name || userTeam.substitute} (Substitute)</li>}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-red-400 text-sm">User team data not available.</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    checked={registrationForm.agreedToTerms || false}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, agreedToTerms: e.target.checked })}
                    className="w-4 h-4"
                    required
                  />
                  <label htmlFor="agreeTerms" className="text-zinc-300 text-sm">I confirm my registration and agree to the terms and conditions.</label>
                </div>
                {registrationError && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-medium text-sm">Error</span>
                    </div>
                    <p className="text-red-300 text-sm">{registrationError}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-4 border-t border-zinc-700">
                  <button type="button" onClick={() => setShowRegistrationModal(false)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium px-5 py-3 rounded-lg transition-colors text-sm">Cancel</button>
                  <button type="submit" disabled={registrationLoading || !registrationForm.agreedToTerms} className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-zinc-600 disabled:to-zinc-700 text-white font-medium px-5 py-3 rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    {registrationLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Registering...</> : <><UserPlus className="w-4 h-4" />Register Team</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* ── Non-Captain Modal ── */}
      {
        showNonCaptainModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Team Registration</h2>
                <p className="text-zinc-400 mb-6 text-sm">Only team captains can register for tournaments. Send a reference message to your captain to request registration.</p>
                {referenceSentSuccess ? (
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-green-400 font-medium">Reference Sent!</span>
                    </div>
                    <p className="text-green-300 text-sm mt-1">Your captain has been notified.</p>
                  </div>
                ) : (
                  <button onClick={sendTournamentReferenceToCaptain} disabled={sendingReference} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-zinc-600 disabled:to-zinc-700 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4 text-sm">
                    {sendingReference ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Reference to Captain</>}
                  </button>
                )}
                <button onClick={() => setShowNonCaptainModal(false)} className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm">Close</button>
              </div>
            </div>
          </div>
        )
      }

      {/* ── Success Modal ── */}
      {
        registrationSuccess && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Registration Successful!</h2>
                <p className="text-zinc-400 mb-6 text-sm">Your team has been successfully registered for this tournament. You will receive further instructions via email.</p>
                <button onClick={() => setRegistrationSuccess(false)} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm">Continue</button>
              </div>
            </div>
          </div>
        )
      }

      {/* ── Prize Breakdown Modal ── */}
      {
        showPrizeModal && tournamentData?.prizePool?.distribution && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 sm:p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Full Prize Breakdown</h2>
                  <button onClick={() => setShowPrizeModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-5 h-5 text-zinc-400" /></button>
                </div>
              </div>
              <div className="p-5 sm:p-6 space-y-8">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-green-400 mb-2">{formatPrizePool(tournamentData.prizePool)}</div>
                  <div className="text-zinc-400 text-sm">Total Prize Pool</div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Team Prizes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tournamentData.prizePool.distribution.map((prize, index) => (
                      <div key={index} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-400 text-sm">{prize.position}</span>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-zinc-400 text-white' : index === 2 ? 'bg-amber-600 text-white' : 'bg-zinc-600 text-white'}`}>{index + 1}</div>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-green-400 mb-1">₹{prize.amount?.toLocaleString() || '0'}</div>
                        <div className="text-zinc-400 text-xs">{prize.percentage || 0}% of total pool</div>
                      </div>
                    ))}
                  </div>
                </div>
                {tournamentData.prizePool.individualAwards?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">Individual Awards</h3>
                    <div className="space-y-3">
                      {tournamentData.prizePool.individualAwards.map((award, index) => (
                        <div key={index} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="text-white font-medium mb-0.5">{award.name}</div>
                              <div className="text-zinc-400 text-sm">{award.description}</div>
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-amber-400 shrink-0">₹{award.amount?.toLocaleString() || '0'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default DetailedTournamentInfo;