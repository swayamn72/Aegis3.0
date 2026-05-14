/**
 * Valorant Standings Panel
 *
 * Org portal component for Valorant tournaments.
 * Shows:
 *   - W/L/RD/Buchholz standings table
 *   - Swiss record groups
 *   - "Generate Next Round" button (Swiss only)
 *   - "Advance Phase" button when 3W/3L complete
 *   - Bracket visualization for elimination phases
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';
import BracketVisualization from '../../components/BracketVisualization';

const C = {
  bg: '#0C0C0C', surface: '#111111', card: '#1A1A1A',
  border: '#252525', accent: '#00E5FF', red: '#FF4655',
  amber: '#FFB800', green: '#00C853', purple: '#9B6DFF',
  textPrimary: '#F0F0F0', textSecondary: '#888888', textMuted: '#444444',
};

export default function ValorantStandingsPanel({ tournament, onUpdate }) {
  const [standings, setStandings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');

  const phases = tournament?.phases || [];
  const activePhase = phases.find(p => p.name === selectedPhase);
  const isSwiss = activePhase?.format === 'Swiss';

  useEffect(() => {
    if (phases.length > 0 && !selectedPhase) {
      setSelectedPhase(phases[0].name);
    }
  }, [phases]);

  useEffect(() => {
    if (selectedPhase) fetchData();
  }, [selectedPhase]);

  const fetchData = useCallback(async () => {
    if (!tournament?._id || !selectedPhase) return;
    setLoading(true);
    try {
      const [standingsRes, matchesRes] = await Promise.all([
        axiosInstance.get(`/org-tournaments/${tournament._id}/standings?phase=${encodeURIComponent(selectedPhase)}`),
        axiosInstance.get(`/org-tournaments/${tournament._id}/matches?phase=${encodeURIComponent(selectedPhase)}`),
      ]);
      setStandings(standingsRes.data.standings || []);
      setMatches(matchesRes.data.matches || matchesRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tournament?._id, selectedPhase]);

  const handleGenerateRound = async () => {
    if (!selectedPhase) return;
    setGenerating(true);
    try {
      const res = await axiosInstance.post(`/org-tournaments/${tournament._id}/swiss/next-round`, {
        phase: selectedPhase,
        scheduledStartTime: scheduleTime || undefined,
        bestOf: activePhase?.bestOf || 1,
      });
      toast.success(`Round ${res.data.roundNumber} generated — ${res.data.matchups} matches`);
      fetchData();
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate round');
    } finally {
      setGenerating(false);
    }
  };

  const handleAdvancePhase = async () => {
    const nextPhase = phases[phases.findIndex(p => p.name === selectedPhase) + 1];
    if (!nextPhase) { toast.error('No next phase defined'); return; }
    if (!window.confirm(`Advance qualifying teams from "${selectedPhase}" to "${nextPhase.name}"?`)) return;
    setAdvancing(true);
    try {
      const res = await axiosInstance.post(`/org-tournaments/${tournament._id}/swiss/advance`, {
        fromPhase: selectedPhase,
        toPhase: nextPhase.name,
      });
      toast.success(res.data.message);
      fetchData();
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to advance phase');
    } finally {
      setAdvancing(false);
    }
  };

  const advanced = standings.filter(s => s.wins >= 3);
  const eliminated = standings.filter(s => s.losses >= 3);
  const active = standings.filter(s => s.wins < 3 && s.losses < 3);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.textPrimary }}>
      {/* Phase selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {phases.map(p => (
          <button key={p.name} onClick={() => setSelectedPhase(p.name)} style={{
            background: selectedPhase === p.name ? C.accent + '20' : C.card,
            border: `1px solid ${selectedPhase === p.name ? C.accent : C.border}`,
            color: selectedPhase === p.name ? C.accent : C.textSecondary,
            borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{p.name}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading standings…</div>
      ) : (
        <>
          {/* Swiss controls */}
          {isSwiss && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>Schedule next round</div>
                <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' }}
                />
              </div>
              <Btn onClick={handleGenerateRound} loading={generating} color={C.accent}>
                ⚡ Generate Next Round
              </Btn>
              {advanced.length > 0 && (
                <Btn onClick={handleAdvancePhase} loading={advancing} color={C.green}>
                  ✅ Advance {advanced.length} Teams →
                </Btn>
              )}
            </div>
          )}

          {/* Status bar */}
          {isSwiss && standings.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatusBadge color={C.green} count={advanced.length} label="Advanced (3-0 / 3-1 / 3-2)" />
              <StatusBadge color={C.amber} count={active.length} label="Still Active" />
              <StatusBadge color={C.red} count={eliminated.length} label="Eliminated" />
            </div>
          )}

          {/* Visualization — Swiss table or bracket */}
          <BracketVisualization
            tournament={{ ...tournament, phases: tournament?.phases?.filter(p => p.name === selectedPhase) }}
            matches={matches}
            standings={standings}
          />
        </>
      )}
    </div>
  );
}

function Btn({ onClick, loading, color, children }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: color, color: '#000', border: 'none',
      borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700,
      cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
      flexShrink: 0,
    }}>
      {loading ? 'Processing…' : children}
    </button>
  );
}

function StatusBadge({ color, count, label }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}40`, borderRadius: 6, padding: '4px 10px' }}>
      {count} {label}
    </span>
  );
}
