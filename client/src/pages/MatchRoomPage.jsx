import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/axiosConfig';
import MapVeto from '../components/MapVeto';
import ResultSubmissionModal from '../components/ResultSubmissionModal';

const C = {
  bg: '#0C0C0C', surface: '#111111', card: '#1A1A1A', card2: '#1F1F1F',
  border: '#242424', accent: '#00E5FF', red: '#FF4655', amber: '#FFB800',
  green: '#00C853', purple: '#9B6DFF', textPrimary: '#F0F0F0',
  textSecondary: '#888888', textMuted: '#444444',
};

function formatTime(date) {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(date));
}

export default function MatchRoomPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { emitEvent, onEvent } = useSocket();

  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [vetoState, setVetoState] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'veto' | 'info'
  const [sending, setSending] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [myTeamId, setMyTeamId] = useState(null);
  const bottomRef = useRef(null);

  // Load match + messages
  useEffect(() => {
    const load = async () => {
      try {
        const [matchRes, msgRes] = await Promise.all([
          axiosInstance.get(`/api/matches/${matchId}`),
          axiosInstance.get(`/api/match-rooms/${matchId}/messages`),
        ]);
        setMatch(matchRes.data);
        setMessages(msgRes.data.messages || []);

        // Determine player's team
        const m = matchRes.data;
        const reg = m._playerTeamId || null;
        setMyTeamId(reg);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId]);

  // Join match room + veto room via socket
  useEffect(() => {
    emitEvent('joinMatchRoom', matchId);
    if (myTeamId) emitEvent('mapVeto:ready', { matchId });

    return () => {
      emitEvent('leaveMatchRoom', matchId);
      emitEvent('mapVeto:left', { matchId });
    };
  }, [matchId, myTeamId, emitEvent]);

  // Socket subscriptions
  useEffect(() => {
    const subs = [
      onEvent('matchRoom:message', (msg) => {
        setMessages(prev => [...prev, msg]);
      }),
      onEvent('mapVeto:window_open', (state) => {
        setVetoState(state);
        setActiveTab('veto');
      }),
      onEvent('mapVeto:started', (state) => {
        setVetoState(state);
        setActiveTab('veto');
      }),
      onEvent('mapVeto:updated', (state) => setVetoState(state)),
      onEvent('mapVeto:completed', (state) => {
        setVetoState(state);
        // Update match map list
        setMatch(prev => prev ? { ...prev, pickedMaps: state.pickedMaps } : prev);
      }),
      onEvent('mapVeto:team_ready', (data) => {
        setVetoState(prev => prev ? { ...prev, readyTeams: data.readyTeams } : prev);
      }),
    ];
    return () => subs.forEach(u => u && u());
  }, [onEvent]);

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    emitEvent('sendMatchRoomMessage', { matchId, message: text });
    setSending(false);
  }, [input, sending, matchId, emitEvent]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (loading) return <Loader />;
  if (!match) return <div style={{ color: C.textPrimary, padding: 40, textAlign: 'center' }}>Match not found.</div>;

  const teamA = match.vsResults?.teamA;
  const teamB = match.vsResults?.teamB;
  const isValorant = match.gameTitle === 'VALORANT';
  const hasVeto = isValorant && vetoState;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/my-matches')} style={{ background: 'none', border: 'none', color: C.textSecondary, cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          {/* Team matchup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <TeamBadge team={teamA} side="A" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1 }}>VS</div>
              {match.scheduledStartTime && (
                <div style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>
                  {formatTime(match.scheduledStartTime)}
                </div>
              )}
            </div>
            <TeamBadge team={teamB} side="B" />
          </div>
          {/* Status pill */}
          <StatusPill status={match.status} vetoStatus={vetoState?.status} />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {[
            { key: 'chat', label: '💬 Chat' },
            ...(isValorant ? [{ key: 'veto', label: `🗺 Veto${vetoState?.status === 'window_open' ? ' 🔴' : ''}` }] : []),
            { key: 'info', label: 'ℹ Info' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: activeTab === tab.key ? C.accent + '20' : 'transparent',
              border: `1px solid ${activeTab === tab.key ? C.accent : C.border}`,
              color: activeTab === tab.key ? C.accent : C.textSecondary,
              borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {activeTab === 'chat' && (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((msg, i) => (
                <ChatBubble key={msg._id || i} msg={msg} isOwn={msg.sender?._id === user?._id || msg.sender === user?._id} />
              ))}
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 14, marginTop: 40 }}>
                  No messages yet. Say hello to your opponents! 👋
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  maxLength={500}
                  style={{
                    flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                    color: C.textPrimary, padding: '10px 14px', fontSize: 14, resize: 'none',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  style={{
                    background: input.trim() ? C.accent : C.border, color: '#000',
                    border: 'none', borderRadius: 10, padding: '10px 18px',
                    fontWeight: 700, fontSize: 14, cursor: input.trim() ? 'pointer' : 'default',
                    transition: 'background 0.15s', flexShrink: 0,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'veto' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <MapVeto
              matchId={matchId}
              vetoState={vetoState}
              myTeamId={myTeamId}
              teamA={teamA}
              teamB={teamB}
              onAction={(mapName) => emitEvent('mapVeto:action', { matchId, map: mapName })}
            />
          </div>
        )}

        {activeTab === 'info' && (
          <>
            {/* Submit result button — only for Valorant matches in progress or completed */}
            {isValorant && (match.status === 'in_progress' || match.status === 'completed') && (
              <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
                <button
                  onClick={() => setShowSubmitModal(true)}
                  style={{
                    width: '100%', background: `${C.green}18`, border: `1px solid ${C.green}50`,
                    color: C.green, borderRadius: 10, padding: '12px 16px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  📸 Submit Match Result (Screenshot)
                </button>
              </div>
            )}
            <MatchInfoPanel match={match} vetoState={vetoState} />
          </>
        )}

        {showSubmitModal && (
          <ResultSubmissionModal
            matchId={matchId}
            matchNumber={match.matchNumber}
            onClose={() => setShowSubmitModal(false)}
            onSubmitted={() => setShowSubmitModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function ChatBubble({ msg, isOwn }) {
  const sender = msg.sender;
  const isSystem = msg.messageType === 'system' || msg.messageType === 'veto_update';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, padding: '4px 0' }}>
        — {msg.message} —
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
      {!isOwn && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.card2, overflow: 'hidden', flexShrink: 0 }}>
          {sender?.profilePicture
            ? <img src={sender.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.accent, fontWeight: 700 }}>
                {(sender?.username || '?')[0].toUpperCase()}
              </div>
          }
        </div>
      )}
      <div style={{ maxWidth: '68%' }}>
        {!isOwn && (
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3, marginLeft: 4 }}>
            {sender?.inGameName || sender?.username || 'Unknown'}
          </div>
        )}
        <div style={{
          background: isOwn ? C.accent + '20' : C.card,
          border: `1px solid ${isOwn ? C.accent + '40' : C.border}`,
          borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding: '10px 14px', fontSize: 14, color: C.textPrimary, lineHeight: 1.5,
        }}>
          {msg.message}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3, textAlign: isOwn ? 'right' : 'left', marginLeft: isOwn ? 0 : 4 }}>
          {formatTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ team, side }) {
  if (!team) return <div style={{ width: 80 }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: side === 'B' ? 'flex-end' : 'flex-start' }}>
      {side === 'A' && (team.logo
        ? <img src={team.logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
        : <TeamIcon tag={team.teamTag} />
      )}
      <div style={{ textAlign: side === 'B' ? 'right' : 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{team.teamName}</div>
        {team.teamTag && <div style={{ fontSize: 11, color: C.textSecondary }}>{team.teamTag}</div>}
      </div>
      {side === 'B' && (team.logo
        ? <img src={team.logo} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
        : <TeamIcon tag={team.teamTag} />
      )}
    </div>
  );
}

function TeamIcon({ tag }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: 8, background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.accent }}>
      {(tag || '??').slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatusPill({ status, vetoStatus }) {
  const cfg = vetoStatus === 'window_open' ? { color: C.amber, label: '🗺 Veto Open' }
    : vetoStatus === 'in_progress' ? { color: C.amber, label: '🗺 Veto Live' }
    : status === 'in_progress' ? { color: C.green, label: '🟢 Live' }
    : { color: C.accent, label: '🔵 Scheduled' };

  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.color + '20', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function MatchInfoPanel({ match, vetoState }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
      <InfoCard title="Tournament">
        <InfoRow label="Name" value={match.tournament?.tournamentName} />
        <InfoRow label="Phase" value={match.tournamentPhase} />
        <InfoRow label="Format" value={match.metadata?.bestOf ? `Best of ${match.metadata.bestOf}` : 'Best of 1'} />
        <InfoRow label="Scheduled" value={match.scheduledStartTime ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(match.scheduledStartTime)) : '—'} />
      </InfoCard>

      {vetoState?.pickedMaps?.length > 0 && (
        <InfoCard title="Maps">
          {vetoState.pickedMaps.map((map, i) => (
            <div key={map} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < vetoState.pickedMaps.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 12, color: C.textMuted, width: 20 }}>#{i + 1}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{map}</span>
              {i === vetoState.pickedMaps.length - 1 && vetoState.bestOf > 1 && (
                <span style={{ fontSize: 10, color: C.amber, marginLeft: 'auto' }}>DECIDER</span>
              )}
            </div>
          ))}
        </InfoCard>
      )}

      {vetoState?.bannedMaps?.length > 0 && (
        <InfoCard title="Banned Maps">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {vetoState.bannedMaps.map(map => (
              <span key={map} style={{ fontSize: 12, color: C.red, background: C.red + '15', border: `1px solid ${C.red}30`, borderRadius: 6, padding: '4px 10px', textDecoration: 'line-through' }}>
                {map}
              </span>
            ))}
          </div>
        </InfoCard>
      )}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{value || '—'}</span>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
