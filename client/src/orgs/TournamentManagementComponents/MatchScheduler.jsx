import React, { useState, useEffect } from 'react';
import { Plus, Clock, MessageSquare, Users, X, Check, AlertCircle, Calendar, Target, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight, Lock, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from '../../utils/axiosConfig';
import aegisLogo from '../../assets/logo.png';
import erangelImg from '../../assets/mapImages/erangel.jpg';
import miramarImg from '../../assets/mapImages/miramar.webp';
import sanhokImg from '../../assets/mapImages/sanhok.webp';
import vikendiImg from '../../assets/mapImages/vikendi.jpg';
import rondoImg from '../../assets/mapImages/rondo.webp';

const phaseToCode = (phaseName = '') => {
  const normalized = phaseName.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();

  const roundMatch = normalized.match(/\b(?:round|r)\s*(\d+)\b/);
  if (roundMatch) {
    return `R${roundMatch[1]}`;
  }

  if (normalized.includes('pre quarter')) return 'PQ';
  if (normalized.includes('quarter')) return 'QF';
  if (normalized.includes('semi')) return 'SE';
  if (normalized.includes('grand final') || normalized === 'final' || normalized.includes(' finals')) {
    return 'GF';
  }

  return normalized.replace(/\s+/g, '').toUpperCase() || 'R1';
};

const MatchScheduler = ({ tournament, onUpdate }) => {
  const [scheduledMatches, setScheduledMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const isValorant = tournament?.gameTitle === 'VALORANT';
  const [formData, setFormData] = useState({
    tournamentPhase: '',
    scheduledDate: '',
    scheduledTime: '',
    map: isValorant ? 'Ascent' : 'Erangel'
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  // teamId → teamName lookup (populated from phase-teams API)
  const [teamNameMap, setTeamNameMap] = useState({});
  // Per-match open slot dropdowns: matchId → Set of groupIds
  const [openSlotDropdowns, setOpenSlotDropdowns] = useState({});
  const MATCHES_PER_PAGE = 10;

  const phases = tournament.phases || [];
  const allGroups = phases.flatMap(phase => phase.groups || []);

  // Derive map list from tournament data for Valorant; fall back to BGMI defaults otherwise
  const VALORANT_MAPS = ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'];
  const BGMI_MAPS = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Livik', 'Nusa', 'Rondo'];
  const maps = isValorant
    ? (tournament?.gameSettings?.maps?.length ? tournament.gameSettings.maps : VALORANT_MAPS)
    : BGMI_MAPS;

  useEffect(() => {
    setCurrentPage(1);
    fetchScheduledMatches(1);
  }, [tournament._id]);

  // Fetch team names for all phases so we can resolve slotList ObjectIds
  useEffect(() => {
    const fetchAllTeamNames = async () => {
      try {
        const phases = tournament.phases || [];
        const nameMap = {};
        await Promise.all(
          phases.map(async (phase) => {
            const res = await axios.get(
              `/api/org-tournaments/${tournament._id}/phase-teams`,
              { params: { phase: phase.name, all: true } }
            );
            const teams = res.data?.teams || res.data || [];
            teams.forEach(t => {
              if (t._id) nameMap[t._id.toString()] = t.teamName || t.name || t._id;
            });
          })
        );
        setTeamNameMap(nameMap);
      } catch {
        // silently fail — slot list will show IDs if names unavailable
      }
    };
    fetchAllTeamNames();
  }, [tournament._id]);

  useEffect(() => {
    const teams = selectedGroups.reduce((total, groupId) => {
      const group = allGroups.find(g =>
        (g._id?.toString?.() === groupId) || (g.id === groupId) || (g.name === groupId)
      );
      return total + (group?.teamCount || group?.teams?.length || 0);
    }, 0);
    setTotalTeams(teams);
  }, [selectedGroups, allGroups]);

  const fetchScheduledMatches = async (page = currentPage) => {
    try {
      setLoading(true);
      const offset = (page - 1) * MATCHES_PER_PAGE;
      const response = await axios.get(`/api/matches/scheduled/${tournament._id}`, {
        params: {
          limit: MATCHES_PER_PAGE,
          offset: offset
        }
      });
      setScheduledMatches(response.data.matches || []);
      setTotalMatches(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching scheduled matches:', error);
      toast.error('Failed to load scheduled matches');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchScheduledMatches(newPage);
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getNextMatchNumber = () => {
    const nextFromTotal = (Number(totalMatches) || 0) + 1;
    return Math.max(1, nextFromTotal);
  };

  const extractGroupCode = (groupName = '') => {
    const numericPart = groupName.match(/\d+/)?.[0];
    if (numericPart) return numericPart;
    return groupName.replace(/\s+/g, '').toUpperCase();
  };

  const generateMatchName = () => {
    const matchNumber = getNextMatchNumber();
    const phaseCode = phaseToCode(formData.tournamentPhase);
    const phaseGroups = getGroupsForPhase();

    const selectedGroupCodes = selectedGroups
      .map((groupId) => phaseGroups.find((g) =>
        (g._id?.toString?.() === groupId) || (g.id === groupId) || (g.name === groupId)
      ))
      .filter(Boolean)
      .map((group) => extractGroupCode(group.name))
      .filter(Boolean);

    const uniqueGroupCodes = [...new Set(selectedGroupCodes)];
    const groupCode = uniqueGroupCodes.length > 0
      ? uniqueGroupCodes.join('-')
      : 'NA';

    return `M${matchNumber}G${groupCode}${phaseCode}`;
  };

  const validateForm = () => {
    if (!formData.tournamentPhase) {
      toast.error('Please select a phase');
      return false;
    }
    if (!formData.scheduledDate || !formData.scheduledTime) {
      toast.error('Please select date and time');
      return false;
    }
    if (selectedGroups.length === 0) {
      toast.error('Please select at least one group');
      return false;
    }
    // For BGMI (battle royale), enforce 24-team lobby cap. Valorant is always 1v1 (2 teams).
    if (!isValorant && totalTeams > 24) {
      toast.error('Total teams cannot exceed 24');
      return false;
    }

    return true;
  };


  const handleScheduleMatch = async () => {
    if (!validateForm()) return;

    try {
      const scheduledDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
      const autoMatchName = generateMatchName();

      const matchData = {
        matchName: autoMatchName,
        tournament: tournament._id,
        tournamentPhase: formData.tournamentPhase,
        map: formData.map,
        scheduledStartTime: scheduledDateTime.toISOString(),
        status: 'scheduled',
        participatingGroups: selectedGroups.map(String),
        matchType: 'scheduled'
      };

      const response = await axios.post('/api/matches/schedule', matchData);

      // Refresh matches and go to first page to see new match
      setCurrentPage(1);
      fetchScheduledMatches(1);

      if (onUpdate) {
        onUpdate();
      }

      setFormData({
        tournamentPhase: '',
        scheduledDate: '',
        scheduledTime: '',
        map: 'Erangel'
      });
      setSelectedGroups([]);
      setShowScheduleForm(false);
      setShowSuccessModal(true);
      toast.success('Match scheduled successfully');
    } catch (error) {
      console.error('Error scheduling match:', error);
      toast.error('Failed to schedule match');
    }
  };

  const handleDeleteScheduledMatch = (matchId) => {
    setMatchToDelete(matchId);
    setShowDeleteModal(true);
  };

  const confirmDeleteScheduledMatch = async () => {
    if (!matchToDelete) return;

    try {
      setIsDeleting(true);
      await axios.delete(`/api/matches/scheduled/${matchToDelete}`);

      // If we're on a page that will become empty after deletion, go back one page
      const isLastOnPage = scheduledMatches.length === 1 && currentPage > 1;
      const pageToFetch = isLastOnPage ? currentPage - 1 : currentPage;

      if (isLastOnPage) setCurrentPage(pageToFetch);
      fetchScheduledMatches(pageToFetch);

      toast.success('Scheduled match deleted');
      setShowDeleteModal(false);
      setMatchToDelete(null);
    } catch (error) {
      console.error('Error deleting scheduled match:', error);
      toast.error(error.response?.data?.error || 'Failed to delete scheduled match');
    } finally {
      setIsDeleting(false);
    }
  };

  const getGroupsForPhase = () => {
    if (!formData.tournamentPhase) return [];
    const phase = phases.find(p => p.name === formData.tournamentPhase);
    return phase?.groups || [];
  };

  const toggleSlotDropdown = (matchId, groupId) => {
    setOpenSlotDropdowns(prev => {
      const matchSet = new Set(prev[matchId] || []);
      if (matchSet.has(groupId)) matchSet.delete(groupId);
      else matchSet.add(groupId);
      return { ...prev, [matchId]: matchSet };
    });
  };

  const resolveTeamName = (teamRef) => {
    if (!teamRef) return '—';
    if (typeof teamRef === 'object' && (teamRef.teamName || teamRef.name)) {
      return teamRef.teamName || teamRef.name;
    }
    const id = typeof teamRef === 'object' ? teamRef._id?.toString() : teamRef.toString();
    return teamNameMap[id] || id;
  };

  // ── Canvas-based PNG generator (async: loads images before drawing) ─────
  const downloadSlotListPNG = async (match, group, slotList) => {
    const MAP_IMGS = {
      erangel: erangelImg, miramar: miramarImg, sanhok: sanhokImg,
      vikendi: vikendiImg, rondo: rondoImg,
    };

    const loadImg = (src) => new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => res(null);   // graceful fallback if unavailable
      img.src = src;
    });

    const mapKey = (match.map || 'erangel').toLowerCase();
    const mapSrc = MAP_IMGS[mapKey] || erangelImg;

    // Load all images in parallel
    const [mapImg, orgLogoImg, aegisLogoImg] = await Promise.all([
      loadImg(mapSrc),
      // Try tournament logo first, then tournament cover, then null
      (tournament.media?.logo || tournament.media?.coverImage)
        ? loadImg(tournament.media.logo || tournament.media.coverImage)
        : Promise.resolve(null),
      loadImg(aegisLogo),
    ]);

    const SLOT_ROWS = slotList.length;
    const ROW_H = 48;
    const HEADER_H = 250;  // taller header for bigger logos
    const FOOTER_H = 72;
    const W = 720;
    const H = HEADER_H + ROW_H * SLOT_ROWS + FOOTER_H + 20;
    const SCALE = 2;

    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // ── 1. Map image (full bleed, clearly visible) ──
    if (mapImg) {
      const ratio = Math.max(W / mapImg.width, H / mapImg.height);
      const mw = mapImg.width * ratio, mh = mapImg.height * ratio;
      ctx.globalAlpha = 1;
      ctx.drawImage(mapImg, (W - mw) / 2, (H - mh) / 2, mw, mh);
    }

    // ── 2. Dark overlay (lighter so map shows through) ──
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0, 'rgba(6,6,12,0.78)');
    overlay.addColorStop(0.4, 'rgba(8,8,16,0.82)');
    overlay.addColorStop(1, 'rgba(6,6,12,0.88)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    // ── 3. Diagonal grid texture ──
    ctx.save();
    ctx.strokeStyle = 'rgba(255,100,0,0.045)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 28) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }
    ctx.restore();

    // ── 4. Top accent bar (orange gradient) ──
    const topBar = ctx.createLinearGradient(0, 0, W, 0);
    topBar.addColorStop(0, '#c73a00'); topBar.addColorStop(0.5, '#ff6a00'); topBar.addColorStop(1, '#c73a00');
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, W, 5);

    // ── 5. Aegis logo top-left (large) ──
    if (aegisLogoImg) {
      const lh = 52, lw = lh * (aegisLogoImg.width / aegisLogoImg.height);
      ctx.globalAlpha = 1;
      ctx.drawImage(aegisLogoImg, 20, 10, lw, lh);
    } else {
      ctx.fillStyle = '#ff6a00';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('⬡ AEGIS', 20, 38);
    }

    // ── 6. Tournament / Org logo top-right (large, rounded) ──
    if (orgLogoImg) {
      const olSize = 76;
      const olX = W - olSize - 20, olY = 8;
      // Drop-shadow behind it
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.01)'; // transparent fill just to trigger shadow
      ctx.beginPath(); ctx.roundRect(olX, olY, olSize, olSize, 12); ctx.fill();
      ctx.restore();
      // Clip + draw
      ctx.save();
      ctx.beginPath(); ctx.roundRect(olX, olY, olSize, olSize, 12); ctx.clip();
      ctx.globalAlpha = 1;
      ctx.drawImage(orgLogoImg, olX, olY, olSize, olSize);
      ctx.restore();
      // Orange border
      ctx.strokeStyle = 'rgba(255,106,0,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(olX, olY, olSize, olSize, 12); ctx.stroke();
    }

    // ── 7. Tournament name (centred, glow) ──
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,106,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.fillText(
      (tournament.tournamentName || 'TOURNAMENT').toUpperCase(),
      W / 2, 88
    );
    ctx.shadowBlur = 0;

    // ── 8. Match + Group pills ──
    const pillW = 178, pillH = 28, pillY = 102;
    const PILL_M1X = W / 2 - pillW - 6;
    const PILL_M2X = W / 2 + 6;

    [[PILL_M1X, match.matchName?.toUpperCase() || 'MATCH', true],
    [PILL_M2X, group.name?.toUpperCase() || 'GROUP', false]]
      .forEach(([px, label, isOrange]) => {
        ctx.fillStyle = isOrange ? 'rgba(255,106,0,0.25)' : 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.roundRect(px, pillY, pillW, pillH, 6); ctx.fill();
        ctx.strokeStyle = isOrange ? 'rgba(255,106,0,0.6)' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(px, pillY, pillW, pillH, 6); ctx.stroke();
        ctx.fillStyle = isOrange ? '#ffaa55' : '#dddddd';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, px + pillW / 2, pillY + 19);
      });

    // ── 9. Meta strip (date · time · map) ──
    const dt = match.scheduledStartTime ? new Date(match.scheduledStartTime) : null;
    const dateStr = dt ? dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const timeStr = dt ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
    const mapLabel = (match.map || 'ERANGEL').toUpperCase();

    const metaY = 142;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, metaY, W, 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, metaY); ctx.lineTo(W, metaY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, metaY + 40); ctx.lineTo(W, metaY + 40); ctx.stroke();

    ctx.fillStyle = '#b0b0b0';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const segW = W / 3;
    [`📅  ${dateStr}`, `🕐  ${timeStr}`, `🗺️  MAP: ${mapLabel}`].forEach((seg, i) => {
      ctx.fillText(seg, segW * i + segW / 2, metaY + 25);
    });

    // ── 10. Column header ──
    const colHeaderY = metaY + 40;
    ctx.fillStyle = 'rgba(10,10,20,0.88)';
    ctx.fillRect(0, colHeaderY, W, 40);
    ctx.strokeStyle = 'rgba(255,106,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, colHeaderY + 40); ctx.lineTo(W, colHeaderY + 40); ctx.stroke();
    // left orange accent bar
    ctx.fillStyle = '#ff6a00';
    ctx.fillRect(0, colHeaderY, 4, 40);

    ctx.fillStyle = '#ff9040';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SLOT', 75, colHeaderY + 26);
    ctx.fillText('TEAM NAME', W / 2 + 40, colHeaderY + 26);

    // vertical divider
    ctx.strokeStyle = 'rgba(255,106,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(140, colHeaderY); ctx.lineTo(140, colHeaderY + 40); ctx.stroke();

    // ── 11. Slot rows ──
    slotList.forEach((entry, i) => {
      const y = HEADER_H + i * ROW_H;
      const isEven = i % 2 === 0;

      ctx.fillStyle = isEven ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y, W, ROW_H);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + ROW_H); ctx.lineTo(W, y + ROW_H); ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(140, y + ROW_H); ctx.stroke();

      // Slot number badge
      ctx.fillStyle = 'rgba(255,106,0,0.2)';
      ctx.beginPath(); ctx.roundRect(46, y + 11, 58, 26, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,106,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(46, y + 11, 58, 26, 5); ctx.stroke();
      ctx.fillStyle = '#ffaa55';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(entry.slot), 75, y + 29);

      // Team name
      const teamName = resolveTeamName(entry.team);
      ctx.fillStyle = '#f5f5f5';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(teamName.toUpperCase(), W / 2 + 40, y + 29);
    });

    // ── 12. Footer ──
    const footY = HEADER_H + SLOT_ROWS * ROW_H + 6;
    // dark footer bg
    ctx.fillStyle = 'rgba(4,4,10,0.92)';
    ctx.fillRect(0, footY, W, FOOTER_H);
    // top border bar
    const footBar = ctx.createLinearGradient(0, 0, W, 0);
    footBar.addColorStop(0, '#c73a00'); footBar.addColorStop(0.5, '#ff6a00'); footBar.addColorStop(1, '#c73a00');
    ctx.fillStyle = footBar;
    ctx.fillRect(0, footY, W, 5);

    // Aegis logo centred in footer (large)
    if (aegisLogoImg) {
      const fh = 36, fw = fh * (aegisLogoImg.width / aegisLogoImg.height);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(aegisLogoImg, W / 2 - fw / 2, footY + 10, fw, fh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Powered by Aegis  ·  aegis.gg', W / 2, footY + 58);

    // ── 13. Download ──
    const link = document.createElement('a');
    const safeName = `${tournament.tournamentName || 'tournament'}_${match.matchName || 'match'}_${group.name || 'group'}`
      .replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    link.download = `slot_list_${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading scheduled matches...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-xl font-semibold text-white">Match Scheduling</h3>
        <button
          onClick={() => setShowScheduleForm(!showScheduleForm)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 w-fit"
        >
          {showScheduleForm ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Form
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Schedule Match
            </>
          )}
        </button>
      </div>

      {/* Inline Schedule Form */}
      {showScheduleForm && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">Schedule New Match</h2>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Phase *</label>
                <select
                  value={formData.tournamentPhase}
                  onChange={(e) => handleInputChange('tournamentPhase', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select Phase</option>
                  {phases.map(phase => (
                    <option key={phase._id || phase.id} value={phase.name}>{phase.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Match Name</label>
                <div className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-orange-400 font-semibold">
                  {generateMatchName()}
                </div>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Date *</label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Time *</label>
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Map</label>
                <select
                  value={formData.map}
                  onChange={(e) => handleInputChange('map', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  {maps.map(map => (
                    <option key={map} value={map}>{map}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Group Selection */}
            {formData.tournamentPhase && (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Participating Groups *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto bg-zinc-900/50 p-3 rounded-lg border border-zinc-700">
                  {getGroupsForPhase().map((group) => {
                    const groupKey = group._id?.toString() || group.id || group.name;
                    const isSelected = selectedGroups.includes(groupKey);
                    const isLocked = group.isLocked || false;

                    return (
                      <button
                        key={groupKey}
                        onClick={() => handleGroupToggle(groupKey)}
                        className={`p-3 rounded-lg text-sm transition-colors border ${isSelected
                          ? 'bg-orange-500/20 border-orange-400/50 text-orange-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                          }`}
                      >
                        <div className="flex items-center gap-1.5 font-medium justify-center">
                          {isLocked && <Lock className="w-3 h-3 opacity-70" />}
                          {group.name}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {getGroupsForPhase().length === 0 && (
                  <p className="text-zinc-500 text-sm mt-2">No groups available for this phase</p>
                )}
              </div>
            )}


            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-700">
              <button
                onClick={() => {
                  setShowScheduleForm(false);
                  setFormData({
                    tournamentPhase: '',
                    scheduledDate: '',
                    scheduledTime: '',
                    map: 'Erangel'
                  });
                  setSelectedGroups([]);
                }}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              {(() => {
                const selectedPhaseObj = phases.find(p => p.name === formData.tournamentPhase);
                const isPhaseCompleted = selectedPhaseObj?.status === 'completed';

                return (
                  <button
                    onClick={handleScheduleMatch}
                    disabled={selectedGroups.length === 0 || isPhaseCompleted}
                    title={isPhaseCompleted ? "Cannot schedule new matches in a completed phase." : ""}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Schedule & Notify Teams
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Matches List */}
      <div className="space-y-4">
        {scheduledMatches.length > 0 ? (
          scheduledMatches.map(match => (
            <div key={match._id} className="bg-zinc-800/50 rounded-lg p-6 border border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-white">{match.matchName}</h4>
                    <p className="text-zinc-400 text-sm">{match.tournamentPhase} • {match.map}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                    Scheduled
                  </span>
                  <button
                    onClick={() => handleDeleteScheduledMatch(match._id)}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete scheduled match"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-zinc-400 text-sm">Scheduled Time</p>
                  <p className="text-white font-medium">
                    {new Date(match.scheduledStartTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Participating Groups</p>
                  <p className="text-white font-medium">{match.participatingGroups?.length || 0} groups</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Total Teams</p>
                  <p className="text-white font-medium">
                    {
                      (match.results && match.results.length > 0)
                        ? match.results.length
                        : (match.teams && match.teams.length > 0)
                          ? match.teams.length
                          : (match.participatingGroups?.reduce((total, groupId) => {
                            const group = allGroups.find(g =>
                              (g._id?.toString?.() === groupId) ||
                              (g.id === groupId) ||
                              (g.name === groupId)
                            );
                            return total + (group?.teams?.length || 0);
                          }, 0) || 0)
                    } teams
                  </p>
                </div>
              </div>

              {match.participatingGroups?.length > 0 && (
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <p className="text-zinc-400 text-sm mb-2">Participating Groups:</p>
                  <div className="space-y-2">
                    {match.participatingGroups.map(groupId => {
                      const group = allGroups.find(g =>
                        (g._id?.toString?.() === groupId) ||
                        (g.id === groupId) ||
                        (g.name === groupId)
                      );
                      if (!group) return null;

                      const slotList = (group.slotList || [])
                        .slice()
                        .sort((a, b) => a.slot - b.slot);

                      const isOpen = openSlotDropdowns[match._id]?.has(groupId);

                      return (
                        <div key={groupId} className="bg-zinc-800/60 rounded-lg overflow-hidden">
                          {/* Group header / dropdown trigger */}
                          <button
                            onClick={() => toggleSlotDropdown(match._id, groupId)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-400/30 text-orange-400 rounded-md text-xs font-medium flex items-center gap-1">
                                {group.isLocked && <Lock className="w-2.5 h-2.5" />}
                                {group.name}
                              </span>
                              <span className="text-zinc-500 text-xs">{slotList.length} slots</span>
                            </div>
                            {slotList.length > 0 && (
                              isOpen
                                ? <ChevronUp className="w-4 h-4 text-zinc-400" />
                                : <ChevronDown className="w-4 h-4 text-zinc-400" />
                            )}
                          </button>
                          {/* Collapsible slot list */}
                          {isOpen && slotList.length > 0 && (
                            <div className="border-t border-zinc-700/50">
                              {/* Download button row — slot list is BGMI-specific, hide for Valorant */}
                              {!isValorant && (
                              <div className="flex justify-end px-3 pt-2 pb-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); downloadSlotListPNG(match, group, slotList); }}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-400/30 text-orange-400 rounded-lg transition-colors font-medium"
                                  title="Download slot list as PNG"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download PNG
                                </button>
                              </div>
                              )}
                              <div className="px-3 pb-2 space-y-1">
                                {slotList.map(entry => (
                                  <div key={entry.slot} className="flex items-center gap-3 text-xs py-0.5">
                                    <span className="w-14 font-bold text-orange-400 flex-shrink-0">Slot {entry.slot}</span>
                                    <span className="text-zinc-100">{resolveTeamName(entry.team)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {isOpen && slotList.length === 0 && (
                            <p className="px-3 pb-2 text-zinc-500 text-xs">No slot list yet — assign groups first</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Matches Scheduled</h3>
            <p className="text-zinc-400">Schedule your first match to get started.</p>
          </div>
        )}
        {/* Pagination Controls */}
        {Math.ceil(totalMatches / MATCHES_PER_PAGE) > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-700">
            <div className="text-sm text-zinc-400">
              Showing <span className="text-white font-medium">{(currentPage - 1) * MATCHES_PER_PAGE + 1}</span> to{' '}
              <span className="text-white font-medium">
                {Math.min(currentPage * MATCHES_PER_PAGE, totalMatches)}
              </span> of{' '}
              <span className="text-white font-medium">{totalMatches}</span> scheduled matches
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {[...Array(Math.ceil(totalMatches / MATCHES_PER_PAGE))].map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`w-10 h-10 rounded-lg border transition-all font-medium ${currentPage === i + 1
                    ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(totalMatches / MATCHES_PER_PAGE)}
                className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-900 border border-red-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Delete Scheduled Match?</h3>
                  <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
                    Are you sure you want to delete this scheduled match? This will remove the schedule and notify participating teams.
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setMatchToDelete(null);
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-all font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteScheduledMatch}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50 hover:scale-[1.02] transform active:scale-[0.98]"
                  >
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Success Confirmation Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-900 border border-green-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl shadow-green-500/10 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Match Scheduled!</h3>
                  <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
                    The match has been successfully created and all participating teams have been notified via their captain's dashboard.
                  </p>
                </div>
                <div className="w-full pt-4">
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all font-bold shadow-lg shadow-green-500/20 hover:scale-[1.02] transform active:scale-[0.98]"
                  >
                    Great!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchScheduler;