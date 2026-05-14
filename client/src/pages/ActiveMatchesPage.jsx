import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/axiosConfig';

const C = {
  bg: '#0C0C0C',
  surface: '#111111',
  card: '#1A1A1A',
  border: '#242424',
  accent: '#00E5FF',
  red: '#FF4655',
  amber: '#FFB800',
  purple: '#9B6DFF',
  green: '#00C853',
  textPrimary: '#F0F0F0',
  textSecondary: '#888888',
  textMuted: '#555555',
};

const statusColors = {
  scheduled: { bg: '#1A2A3A', text: '#00E5FF', label: 'Scheduled' },
  in_progress: { bg: '#1A2A1A', text: '#00C853', label: 'Live' },
  window_open: { bg: '#2A2A1A', text: '#FFB800', label: 'Veto Open' },
};

function timeUntil(date) {
  const diff = new Date(date) - Date.now();
  if (diff <= 0) return 'Started';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export default function ActiveMatchesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { on } = useSocket();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vetoAlerts, setVetoAlerts] = useState({}); // matchId → true if veto window open
  const intervalRef = useRef(null);

  const fetchMatches = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/api/match-rooms/my-matches');
      setMatches(data.matches || []);
      setError(null);
    } catch (err) {
      setError('Failed to load matches. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    intervalRef.current = setInterval(fetchMatches, 30000); // refresh every 30s
    return () => clearInterval(intervalRef.current);
  }, [fetchMatches]);

  // Listen for veto window open notifications
  useEffect(() => {
    const unsub = on('mapVeto:window_open', ({ matchId }) => {
      setVetoAlerts(prev => ({ ...prev, [matchId]: true }));
      fetchMatches(); // refresh match status
    });
    return unsub;
  }, [on, fetchMatches]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 900, margin: '0 auto' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: C.textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: 0.3 }}>My Active Matches</h1>
            <p style={{ margin: 0, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
              {matches.length} match{matches.length !== 1 ? 'es' : ''} scheduled
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {error && (
          <div style={{ background: '#2A1A1A', border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: C.red, fontSize: 14 }}>
            {error}
          </div>
        )}

        {matches.length === 0 && !error ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map(match => (
              <MatchCard
                key={match._id}
                match={match}
                hasVetoAlert={vetoAlerts[match._id]}
                onEnter={() => navigate(`/match-room/${match._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match, hasVetoAlert, onEnter }) {
  const [hovered, setHovered] = useState(false);
  const tournament = match.tournament;
  const isValorant = tournament?.gameTitle === 'VALORANT';

  const teamA = match.vsResults?.teamA;
  const teamB = match.vsResults?.teamB;
  const statusCfg = hasVetoAlert ? statusColors.window_open : (statusColors[match.status] || statusColors.scheduled);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#1F1F1F' : C.card,
        border: `1px solid ${hasVetoAlert ? C.amber : C.border}`,
        borderRadius: 14,
        padding: '20px 24px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hasVetoAlert ? `0 0 20px rgba(255,184,0,0.15)` : hovered ? '0 4px 20px rgba(0,0,0,0.4)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={onEnter}
    >
      {/* Veto alert glow bar */}
      {hasVetoAlert && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${C.amber}, transparent)`,
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Left: Tournament + Match info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {tournament?.orgLogo && (
              <img src={tournament.orgLogo} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />
            )}
            <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {tournament?.tournamentName}
            </span>
            {isValorant && (
              <span style={{ fontSize: 10, background: '#FF455520', color: C.red, border: `1px solid ${C.red}40`, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                VALORANT
              </span>
            )}
          </div>

          {/* Team matchup */}
          {teamA && teamB ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TeamChip team={teamA} isPlayer={match._playerTeamId === teamA._id} />
              <span style={{ color: C.textMuted, fontSize: 13, fontWeight: 700 }}>VS</span>
              <TeamChip team={teamB} isPlayer={match._playerTeamId === teamB._id} />
            </div>
          ) : (
            <span style={{ fontSize: 14, color: C.textSecondary }}>Match #{match.matchNumber}</span>
          )}

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              🗓 {formatDate(match.scheduledStartTime)}
            </span>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
              {timeUntil(match.scheduledStartTime)}
            </span>
            {match.map && match.map !== 'TBD' && (
              <span style={{ fontSize: 12, color: C.textMuted }}>
                📍 {match.map}
              </span>
            )}
          </div>
        </div>

        {/* Right: Status + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
            background: statusCfg.bg, color: statusCfg.text, letterSpacing: 0.5,
          }}>
            {hasVetoAlert ? '🗺 VETO OPEN' : statusCfg.label.toUpperCase()}
          </span>
          <button
            style={{
              background: hasVetoAlert ? C.amber : C.accent,
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.3,
              transition: 'opacity 0.15s',
            }}
          >
            {hasVetoAlert ? '🗺 Join Veto' : 'Enter Room →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamChip({ team, isPlayer }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {team.logo ? (
        <img src={team.logo} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 26, height: 26, borderRadius: 6, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.accent }}>
          {(team.teamTag || team.teamName || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <span style={{ fontSize: 14, fontWeight: isPlayer ? 700 : 500, color: isPlayer ? C.textPrimary : C.textSecondary }}>
        {team.teamName}
      </span>
      {isPlayer && <span style={{ fontSize: 10, color: C.accent }}>YOU</span>}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.textPrimary }}>No Active Matches</h3>
      <p style={{ margin: '8px 0 0', color: C.textSecondary, fontSize: 14 }}>
        You have no upcoming matches right now. Register for a tournament to get started.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 24 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: C.card, borderRadius: 14, height: 120, marginBottom: 12, animation: 'pulse 1.5s ease infinite' }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
