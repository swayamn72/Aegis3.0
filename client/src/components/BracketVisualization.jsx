import { useState, useEffect } from 'react';

const C = {
  bg: '#0C0C0C', surface: '#111111', card: '#1A1A1A', card2: '#1F1F1F',
  border: '#242424', accent: '#00E5FF', red: '#FF4655', amber: '#FFB800',
  green: '#00C853', purple: '#9B6DFF', textPrimary: '#F0F0F0',
  textSecondary: '#888888', textMuted: '#444444',
};

// ─── Entry: picks format from tournament data ─────────────────────────────────
export default function BracketVisualization({ tournament, matches, standings }) {
  const format = tournament?.phases?.[0]?.format || 'Best of 1';
  const isSwiss = format === 'Swiss';
  const isDoubleElim = format === 'Double Elimination';

  if (isSwiss) {
    return <SwissStandings standings={standings} tournament={tournament} matches={matches} />;
  }
  return <EliminationBracket matches={matches} tournament={tournament} isDouble={isDoubleElim} />;
}

// ─── Swiss Standings ──────────────────────────────────────────────────────────
function SwissStandings({ standings = [], tournament, matches = [] }) {
  const [activeRecord, setActiveRecord] = useState(null);
  const config = tournament?.gameTitle === 'VALORANT'
    ? { winsToAdvance: 3, lossesToEliminate: 3 }
    : { winsToAdvance: null, lossesToEliminate: null };

  const grouped = {};
  for (const entry of standings) {
    const key = `${entry.wins}-${entry.losses}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }
  const recordKeys = Object.keys(grouped).sort((a, b) => {
    const [aw] = a.split('-').map(Number);
    const [bw] = b.split('-').map(Number);
    return bw - aw;
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>Swiss Standings</div>
        {config.winsToAdvance && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Tag color={C.green} label={`${config.winsToAdvance} wins → Advance`} />
            <Tag color={C.red} label={`${config.lossesToEliminate} losses → Eliminated`} />
          </div>
        )}
      </div>

      {/* Full table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
          <span>Team</span><span style={{ textAlign: 'center' }}>W-L</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
          <span style={{ textAlign: 'center' }}>RD</span>
          <span style={{ textAlign: 'center' }}>Buchholz</span>
          <span style={{ textAlign: 'center' }}>Status</span>
        </div>
        {standings.map((entry, i) => {
          const isAdvanced = config.winsToAdvance && entry.wins >= config.winsToAdvance;
          const isElim = config.lossesToEliminate && entry.losses >= config.lossesToEliminate;
          return (
            <div key={entry.teamId} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: i < standings.length - 1 ? `1px solid ${C.border}` : 'none',
              background: isAdvanced ? `${C.green}08` : isElim ? `${C.red}08` : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.textMuted, width: 20 }}>#{i + 1}</span>
                {entry.teamLogo && <img src={entry.teamLogo} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{entry.teamName}</span>
              </div>
              <WLBadge wins={entry.wins} losses={entry.losses} />
              <Cell val={entry.points} highlight />
              <Cell val={entry.roundDiff > 0 ? `+${entry.roundDiff}` : entry.roundDiff} color={entry.roundDiff > 0 ? C.green : entry.roundDiff < 0 ? C.red : C.textMuted} />
              <Cell val={entry.buchholz} />
              <div style={{ textAlign: 'center' }}>
                {isAdvanced && <Tag color={C.green} label="Advanced" small />}
                {isElim && <Tag color={C.red} label="Eliminated" small />}
                {!isAdvanced && !isElim && <Tag color={C.amber} label="Active" small />}
              </div>
            </div>
          );
        })}
        {standings.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textMuted, fontSize: 14 }}>No standings yet. Matches will appear here once results are entered.</div>
        )}
      </div>

      {/* Group cards by record */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>Record Groups</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {recordKeys.map(record => {
          const [w, l] = record.split('-').map(Number);
          const isAdvGroup = config.winsToAdvance && w >= config.winsToAdvance;
          const isElimGroup = config.lossesToEliminate && l >= config.lossesToEliminate;
          return (
            <div key={record} style={{
              background: isAdvGroup ? `${C.green}10` : isElimGroup ? `${C.red}10` : C.card,
              border: `1px solid ${isAdvGroup ? C.green : isElimGroup ? C.red : C.border}`,
              borderRadius: 10, padding: '10px 14px', minWidth: 110,
              cursor: 'pointer',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: isAdvGroup ? C.green : isElimGroup ? C.red : C.textPrimary, letterSpacing: 1 }}>{record}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{grouped[record].length} team{grouped[record].length !== 1 ? 's' : ''}</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {grouped[record].map(t => (
                  <div key={t.teamId} style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.teamName}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Elimination Bracket ──────────────────────────────────────────────────────
function EliminationBracket({ matches = [], tournament, isDouble = false }) {
  // Group matches by round number
  const rounds = {};
  for (const m of matches) {
    const r = m.bracketRound || m.matchNumber || 1;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push(m);
  }
  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  if (roundKeys.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 16, color: C.textSecondary }}>Bracket matches will appear here once generated.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', minWidth: roundKeys.length * 220 }}>
        {roundKeys.map((round, rIdx) => (
          <div key={round} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Round header */}
            <div style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>
              {getRoundLabel(round, roundKeys.length, rIdx)}
            </div>
            {/* Matches in this round */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '16px 8px', gap: 12 }}>
              {rounds[round].map(match => (
                <MatchCard key={match._id} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRoundLabel(round, total, idx) {
  if (idx === total - 1) return 'Grand Final';
  if (idx === total - 2) return 'Semi Finals';
  if (idx === total - 3) return 'Quarter Finals';
  return `Round ${round}`;
}

function MatchCard({ match }) {
  const vsResults = match.vsResults || {};
  const teamA = vsResults.teamA;
  const teamB = vsResults.teamB;
  const winner = vsResults.winner;
  const winnerId = winner?._id || winner;
  const teamAId = teamA?._id || teamA;
  const teamBId = teamB?._id || teamB;

  const statusColor = match.status === 'completed' ? C.green : match.status === 'in_progress' ? C.amber : C.border;

  return (
    <div style={{
      background: C.card, border: `1px solid ${statusColor}`,
      borderRadius: 10, overflow: 'hidden', position: 'relative',
      boxShadow: match.status === 'in_progress' ? `0 0 12px ${C.amber}30` : 'none',
    }}>
      {match.status === 'in_progress' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.amber, animation: 'pulse 1s ease infinite' }} />
      )}
      <TeamRow team={teamA} score={vsResults.scoreA} isWinner={winnerId === (teamAId?.toString?.() || teamAId)} isComplete={match.status === 'completed'} />
      <div style={{ height: 1, background: C.border }} />
      <TeamRow team={teamB} score={vsResults.scoreB} isWinner={winnerId === (teamBId?.toString?.() || teamBId)} isComplete={match.status === 'completed'} />
      {match.map && match.map !== 'TBD' && (
        <div style={{ padding: '4px 10px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 10, color: C.textMuted }}>📍 {match.map}</span>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

function TeamRow({ team, score, isWinner, isComplete }) {
  const name = team?.teamName || 'TBD';
  const logo = team?.logo;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      background: isWinner ? `${C.green}12` : 'transparent',
    }}>
      {logo
        ? <img src={logo} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
        : <div style={{ width: 22, height: 22, borderRadius: 5, background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
            {name.slice(0, 2).toUpperCase()}
          </div>
      }
      <span style={{ flex: 1, fontSize: 12, fontWeight: isWinner ? 700 : 500, color: isWinner ? C.textPrimary : C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      {isComplete && score !== undefined && (
        <span style={{ fontSize: 14, fontWeight: 800, color: isWinner ? C.green : C.textMuted, minWidth: 20, textAlign: 'right' }}>{score}</span>
      )}
      {isWinner && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function WLBadge({ wins, losses }) {
  return (
    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
      <span style={{ color: C.green }}>{wins}</span>
      <span style={{ color: C.textMuted }}> - </span>
      <span style={{ color: C.red }}>{losses}</span>
    </div>
  );
}
function Cell({ val, highlight, color }) {
  return <div style={{ textAlign: 'center', fontSize: 13, fontWeight: highlight ? 700 : 500, color: color || (highlight ? C.accent : C.textSecondary) }}>{val ?? '—'}</div>;
}
function Tag({ color, label, small }) {
  return (
    <span style={{ fontSize: small ? 10 : 11, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}40`, borderRadius: 5, padding: small ? '2px 6px' : '3px 8px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}
