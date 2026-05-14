import { useState, useEffect, useRef } from 'react';
import { getAgentImages } from '../constants/valorantAgents';

const C = {
  bg: '#0C0C0C', surface: '#111111', card: '#1A1A1A', card2: '#1F1F1F',
  border: '#242424', accent: '#00E5FF', red: '#FF4655', amber: '#FFB800',
  green: '#00C853', purple: '#9B6DFF', textPrimary: '#F0F0F0',
  textSecondary: '#888888', textMuted: '#444444',
};

// Map splash images from valorant-api.com
const MAP_SPLASHES = {
  Ascent: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png',
  Bind: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png',
  Haven: 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png',
  Split: 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png',
  Icebox: 'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png',
  Breeze: 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png',
  Fracture: 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png',
  Pearl: 'https://media.valorant-api.com/maps/33bb57b4-4f60-8f6f-5c6d-bfb7031e9b98/splash.png',
  Lotus: 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png',
  Sunset: 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39f7a8e41b8e/splash.png',
  Abyss: 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png',
};

function useCountdown(deadline) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setSecs(Math.max(0, Math.ceil((new Date(deadline) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);
  return secs;
}

export default function MapVeto({ matchId, vetoState, myTeamId, teamA, teamB, onAction }) {
  const [hovered, setHovered] = useState(null);
  const secs = useCountdown(vetoState?.stepDeadline);

  if (!vetoState) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textSecondary }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Map Veto Not Started</div>
        <div style={{ fontSize: 14 }}>The veto window opens 30 minutes before match time. Stay ready!</div>
      </div>
    );
  }

  // Window open — waiting for both teams
  if (vetoState.status === 'window_open') {
    return <WaitingPanel vetoState={vetoState} myTeamId={myTeamId} teamA={teamA} teamB={teamB} />;
  }

  // Completed
  if (vetoState.status === 'completed') {
    return <CompletedPanel vetoState={vetoState} teamA={teamA} teamB={teamB} />;
  }

  // In progress
  const isMyTurn = vetoState.currentTeam === myTeamId;
  const currentAction = vetoState.currentAction;
  const currentTeamName = vetoState.currentTeam === vetoState.teamA?.id
    ? vetoState.teamA?.name : vetoState.teamB?.name;

  return (
    <div style={{ padding: '16px 20px', fontFamily: "'Inter', sans-serif" }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>
            Step {vetoState.currentStep + 1} of {vetoState.totalSteps}
          </span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>
            {vetoState.pickedMaps.length} map{vetoState.pickedMaps.length !== 1 ? 's' : ''} picked
          </span>
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
          <div style={{
            height: '100%', borderRadius: 2, background: C.accent,
            width: `${(vetoState.currentStep / vetoState.totalSteps) * 100}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Turn indicator */}
      <div style={{
        background: isMyTurn ? C.accent + '15' : C.card,
        border: `1px solid ${isMyTurn ? C.accent : C.border}`,
        borderRadius: 12, padding: '14px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {isMyTurn ? '👆 Your turn' : `${currentTeamName}'s turn`}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: isMyTurn ? C.accent : C.textPrimary, marginTop: 2 }}>
            {currentAction === 'ban' ? '❌ Ban a map' : currentAction === 'pick' ? '✅ Pick a map' : '🎯 Choose decider'}
          </div>
        </div>
        {/* Countdown */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: `3px solid ${secs <= 10 ? C.red : C.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: secs <= 10 ? C.red : C.accent,
          transition: 'all 0.5s',
          animation: secs <= 10 ? 'pulse 0.8s ease infinite' : 'none',
        }}>
          {secs}
        </div>
      </div>

      {/* Map grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {vetoState.mapPool.map(mapName => {
          const isBanned = vetoState.bannedMaps.includes(mapName);
          const isPicked = vetoState.pickedMaps.includes(mapName);
          const isAvailable = vetoState.remainingMaps.includes(mapName);
          const isHovered = hovered === mapName && isMyTurn && isAvailable;

          return (
            <MapCard
              key={mapName}
              name={mapName}
              splash={MAP_SPLASHES[mapName]}
              isBanned={isBanned}
              isPicked={isPicked}
              isAvailable={isAvailable}
              isHovered={isHovered}
              isMyTurn={isMyTurn}
              currentAction={currentAction}
              onHover={setHovered}
              onClick={() => isMyTurn && isAvailable && onAction(mapName)}
            />
          );
        })}
      </div>

      {/* Veto history */}
      {vetoState.history.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: C.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Veto History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vetoState.history.map((h, i) => {
              const isA = h.team === vetoState.teamA?.id;
              const teamName = isA ? vetoState.teamA?.name : h.team === 'system' ? 'System' : vetoState.teamB?.name;
              const icon = h.type === 'ban' ? '❌' : h.type === 'pick' ? '✅' : '🎯';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 10px', background: C.card, borderRadius: 8 }}>
                  <span>{icon}</span>
                  <span style={{ color: C.textSecondary, minWidth: 60 }}>{teamName}</span>
                  <span style={{ fontWeight: 600, color: h.type === 'ban' ? C.red : C.green }}>{h.map}</span>
                  <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 'auto', textTransform: 'uppercase' }}>{h.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.05)} }
      `}</style>
    </div>
  );
}

function MapCard({ name, splash, isBanned, isPicked, isAvailable, isHovered, isMyTurn, currentAction, onHover, onClick }) {
  const actionColor = currentAction === 'ban' ? C.red : C.green;

  return (
    <div
      onMouseEnter={() => onHover(name)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        position: 'relative', borderRadius: 10, overflow: 'hidden',
        aspectRatio: '16/9', cursor: isMyTurn && isAvailable ? 'pointer' : 'default',
        border: `2px solid ${isPicked ? C.green : isBanned ? C.red : isHovered ? actionColor : C.border}`,
        transition: 'all 0.2s ease',
        transform: isHovered && isAvailable ? 'scale(1.03)' : 'scale(1)',
        boxShadow: isHovered && isAvailable ? `0 0 16px ${actionColor}40` : 'none',
        opacity: !isAvailable ? 0.45 : 1,
        filter: isBanned ? 'grayscale(80%)' : 'none',
      }}
    >
      {/* Splash image */}
      {splash ? (
        <img src={splash} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>{name}</span>
        </div>
      )}

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isBanned ? 'rgba(255,70,85,0.5)' : isPicked ? 'rgba(0,200,83,0.3)' : isHovered ? `${actionColor}25` : 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 8,
      }}>
        {isBanned && <span style={{ fontSize: 18 }}>✕</span>}
        {isPicked && <span style={{ fontSize: 18 }}>✓</span>}
        {isHovered && isAvailable && !isBanned && !isPicked && (
          <span style={{ fontSize: 13, fontWeight: 700, color: actionColor }}>{currentAction?.toUpperCase()}</span>
        )}
      </div>

      {/* Map name */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'center', letterSpacing: 0.5,
      }}>
        {name}
      </div>
    </div>
  );
}

function WaitingPanel({ vetoState, myTeamId, teamA, teamB }) {
  const teamAReady = vetoState.readyTeams?.includes(vetoState.teamA?.id);
  const teamBReady = vetoState.readyTeams?.includes(vetoState.teamB?.id);

  return (
    <div style={{ padding: 32, textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>Veto Window Open</div>
      <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 28 }}>
        Waiting for both teams to join the veto room…
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <TeamReadyCard name={vetoState.teamA?.name} ready={teamAReady} />
        <TeamReadyCard name={vetoState.teamB?.name} ready={teamBReady} />
      </div>
      <div style={{ marginTop: 24, fontSize: 13, color: C.textMuted }}>
        You've been marked as present. Veto starts when the opposing team joins.
      </div>
    </div>
  );
}

function TeamReadyCard({ name, ready }) {
  return (
    <div style={{
      background: ready ? C.green + '15' : C.card,
      border: `1px solid ${ready ? C.green : C.border}`,
      borderRadius: 12, padding: '16px 24px', minWidth: 130,
      transition: 'all 0.3s',
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{ready ? '✅' : '⏳'}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: ready ? C.green : C.textSecondary }}>{name}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{ready ? 'Ready' : 'Waiting…'}</div>
    </div>
  );
}

function CompletedPanel({ vetoState, teamA, teamB }) {
  return (
    <div style={{ padding: '24px 20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>Map Veto Complete</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
          {vetoState.pickedMaps.length} map{vetoState.pickedMaps.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vetoState.pickedMaps.map((map, i) => (
          <div key={map} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            overflow: 'hidden',
          }}>
            {MAP_SPLASHES[map] && (
              <img src={MAP_SPLASHES[map]} alt={map} style={{ width: 80, height: 50, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{map}</div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>
                Map {i + 1}{i === vetoState.pickedMaps.length - 1 && vetoState.pickedMaps.length > 1 ? ' (Decider)' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {vetoState.bannedMaps.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Banned</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {vetoState.bannedMaps.map(m => (
              <span key={m} style={{ fontSize: 12, color: C.red, background: C.red + '15', border: `1px solid ${C.red}30`, borderRadius: 6, padding: '4px 10px', textDecoration: 'line-through' }}>{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
