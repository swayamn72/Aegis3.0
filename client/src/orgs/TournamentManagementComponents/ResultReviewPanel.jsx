/**
 * ResultReviewPanel — Org Portal Component
 *
 * Lists all pending/processed result submissions for a tournament.
 * Shows:
 *   - Screenshot previews
 *   - OCR-parsed result with confidence bar
 *   - Approve (with optional manual edit) or Dispute buttons
 *   - Dispute resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';

const C = {
  bg: '#0C0C0C', surface: '#111111', card: '#1A1A1A', card2: '#1F1F1F',
  border: '#242424', accent: '#00E5FF', red: '#FF4655', amber: '#FFB800',
  green: '#00C853', textPrimary: '#F0F0F0', textSecondary: '#888888', textMuted: '#444444',
};

const STATUS_COLORS = {
  pending: { bg: '#1A2030', text: '#00E5FF', label: 'Pending OCR' },
  ocr_processed: { bg: '#1A2A1A', text: '#FFB800', label: 'Needs Review' },
  approved: { bg: '#0A2A0A', text: '#00C853', label: 'Approved' },
  disputed: { bg: '#2A0A0A', text: '#FF4655', label: 'Disputed' },
  cancelled: { bg: '#1A1A1A', text: '#444444', label: 'Cancelled' },
};

export default function ResultReviewPanel({ tournament }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ocr_processed');
  const [reviewing, setReviewing] = useState(null); // submissionId being reviewed
  const [manualEdit, setManualEdit] = useState({}); // { winner, scoreA, scoreB, notes }
  const [reprocessing, setReprocessing] = useState(null);

  const fetchSubmissions = useCallback(async () => {
    if (!tournament?._id) return;
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(
        `/result-submissions/org/${tournament._id}?status=${filter}`
      );
      setSubmissions(data.submissions || []);
    } catch (e) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [tournament?._id, filter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleReview = async (submissionId, action) => {
    setReviewing(submissionId);
    try {
      const edit = manualEdit[submissionId] || {};
      await axiosInstance.patch(`/result-submissions/${submissionId}/review`, {
        action,
        notes: edit.notes,
        manualResult: (edit.winner || edit.scoreA !== undefined)
          ? { winner: edit.winner, scoreA: Number(edit.scoreA), scoreB: Number(edit.scoreB), notes: edit.notes }
          : undefined,
      });
      toast.success(action === 'approve' ? '✅ Result approved & match updated' : '❌ Submission marked as disputed');
      fetchSubmissions();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Review failed');
    } finally {
      setReviewing(null);
    }
  };

  const handleReprocess = async (submissionId) => {
    setReprocessing(submissionId);
    try {
      await axiosInstance.post(`/result-submissions/${submissionId}/ocr-reprocess`);
      toast.info('OCR re-processing started — refresh in ~30 seconds');
    } catch (e) {
      toast.error('Failed to start re-processing');
    } finally {
      setReprocessing(null);
    }
  };

  const setManual = (id, field, val) => {
    setManualEdit(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: val } }));
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.textPrimary }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ocr_processed', 'pending', 'disputed', 'approved', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            background: filter === s ? C.accent + '20' : C.card,
            border: `1px solid ${filter === s ? C.accent : C.border}`,
            color: filter === s ? C.accent : C.textSecondary,
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {s === 'ocr_processed' ? '⏳ Needs Review'
              : s === 'pending' ? '🔄 Pending OCR'
              : s === 'disputed' ? '⚠️ Disputed'
              : s === 'approved' ? '✅ Approved'
              : 'All'}
          </button>
        ))}
        <button onClick={fetchSubmissions} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.textSecondary, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading submissions…</div>
      ) : submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, color: C.textSecondary }}>No submissions for this filter</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {submissions.map(sub => {
            const ocr = sub.ocrData;
            const parsed = ocr?.parsedResult;
            const manual = manualEdit[sub._id] || {};
            const statusCfg = STATUS_COLORS[sub.status] || STATUS_COLORS.pending;
            const isProcessing = reviewing === sub._id;
            const match = sub.match;

            return (
              <div key={sub._id} style={{
                background: C.card, border: `1px solid ${sub.status === 'disputed' ? C.red : C.border}`,
                borderRadius: 14, overflow: 'hidden',
              }}>
                {/* Sub header */}
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                      Match #{match?.matchNumber || '?'} — {sub.submittedByTeam?.teamName}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 3 }}>
                      Submitted by {sub.submittedByPlayer?.inGameName || sub.submittedByPlayer?.username} &nbsp;·&nbsp;
                      {new Date(sub.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: statusCfg.bg, color: statusCfg.text }}>
                    {statusCfg.label}
                  </span>
                </div>

                {/* Screenshots row */}
                <div style={{ padding: '12px 18px', display: 'flex', gap: 10, overflowX: 'auto' }}>
                  {(sub.screenshots || []).map((ss, i) => (
                    <a key={i} href={ss.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                      <img src={ss.url} alt={ss.label} style={{ height: 90, borderRadius: 8, border: `1px solid ${C.border}`, objectFit: 'cover', cursor: 'pointer' }} />
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>{ss.label}</div>
                    </a>
                  ))}
                </div>

                {/* OCR Results */}
                {ocr?.processed && (
                  <div style={{ padding: '0 18px 14px' }}>
                    {/* Confidence */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>OCR Confidence</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: (ocr.confidence || 0) > 0.6 ? C.green : C.amber }}>
                          {Math.round((ocr.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${(ocr.confidence || 0) * 100}%`, background: (ocr.confidence || 0) > 0.6 ? C.green : C.amber, borderRadius: 2 }} />
                      </div>
                    </div>

                    {/* Parsed score */}
                    {parsed && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        <OcrField label="Winner" value={parsed.winner === 'teamA' ? `Team A (${match?.vsResults?.teamA?.teamName || 'A'})` : `Team B (${match?.vsResults?.teamB?.teamName || 'B'})`} />
                        <OcrField label="Score" value={`${parsed.scoreA ?? '?'} – ${parsed.scoreB ?? '?'}`} />
                        <OcrField label="Rounds" value={parsed.totalRounds} />
                        <OcrField label="Players Detected" value={parsed.playerStats?.length ?? 0} />
                      </div>
                    )}

                    {/* OCR errors */}
                    {ocr.errors?.length > 0 && (
                      <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                        {ocr.errors.map((e, i) => (
                          <div key={i} style={{ fontSize: 12, color: C.amber }}>⚠ {e}</div>
                        ))}
                      </div>
                    )}

                    {/* Manual override */}
                    {sub.status === 'ocr_processed' && (
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                        <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>✏️ Override (optional)</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <select
                            value={manual.winner || ''}
                            onChange={e => setManual(sub._id, 'winner', e.target.value)}
                            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                          >
                            <option value="">Winner (use OCR)</option>
                            <option value="teamA">Team A ({match?.vsResults?.teamA?.teamName || 'A'})</option>
                            <option value="teamB">Team B ({match?.vsResults?.teamB?.teamName || 'B'})</option>
                          </select>
                          <input type="number" placeholder="Score A" min="0" max="25" value={manual.scoreA ?? ''} onChange={e => setManual(sub._id, 'scoreA', e.target.value)}
                            style={{ width: 80, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
                          <input type="number" placeholder="Score B" min="0" max="25" value={manual.scoreB ?? ''} onChange={e => setManual(sub._id, 'scoreB', e.target.value)}
                            style={{ width: 80, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
                          <input placeholder="Notes…" value={manual.notes || ''} onChange={e => setManual(sub._id, 'notes', e.target.value)}
                            style={{ flex: 1, minWidth: 120, background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {(sub.status === 'ocr_processed' || sub.status === 'disputed') && (
                  <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => handleReview(sub._id, 'approve')}
                      disabled={isProcessing}
                      style={{ background: C.green, color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: isProcessing ? 'wait' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
                    >
                      ✅ Approve & Confirm
                    </button>
                    <button
                      onClick={() => handleReview(sub._id, 'reject')}
                      disabled={isProcessing}
                      style={{ background: C.red + '20', color: C.red, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: isProcessing ? 'wait' : 'pointer' }}
                    >
                      ⚠️ Mark as Disputed
                    </button>
                    {!ocr?.processed && (
                      <button
                        onClick={() => handleReprocess(sub._id)}
                        disabled={reprocessing === sub._id}
                        style={{ background: C.card2, color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}
                      >
                        🔄 {reprocessing === sub._id ? 'Starting…' : 'Re-run OCR'}
                      </button>
                    )}
                  </div>
                )}

                {sub.status === 'disputed' && sub.disputeReason && (
                  <div style={{ padding: '10px 18px', background: `${C.red}08`, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.red }}>
                    ⚠ Dispute reason: {sub.disputeReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OcrField({ label, value }) {
  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', minWidth: 80 }}>
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginTop: 2 }}>{value ?? '—'}</div>
    </div>
  );
}
