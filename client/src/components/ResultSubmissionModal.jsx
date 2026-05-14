import { useState, useRef } from 'react';
import axiosInstance from '../utils/axiosConfig';

const C = {
  bg: '#0C0C0C', surface: '#111111', card: '#1A1A1A', card2: '#1F1F1F',
  border: '#242424', accent: '#00E5FF', red: '#FF4655', amber: '#FFB800',
  green: '#00C853', textPrimary: '#F0F0F0', textSecondary: '#888888', textMuted: '#444444',
};

export default function ResultSubmissionModal({ matchId, matchNumber, onClose, onSubmitted }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [labels, setLabels] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileRef = useRef(null);

  const handleFiles = (selected) => {
    const arr = Array.from(selected).slice(0, 5);
    setFiles(arr);
    setPreviews(arr.map(f => URL.createObjectURL(f)));
    setLabels(arr.map((_, i) => i === 0 ? 'Final Scoreboard' : `Screenshot ${i + 1}`));
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (files.length === 0) { setError('Please add at least one screenshot.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      files.forEach((f, i) => {
        form.append('screenshots', f);
        form.append(`label_${i}`, labels[i] || `Screenshot ${i + 1}`);
      });
      await axiosInstance.post(`/api/result-submissions/${matchId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('✅ Screenshots submitted! The organizer will review and confirm the result.');
      onSubmitted?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        fontFamily: "'Inter', sans-serif", color: C.textPrimary,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Submit Match Result</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSecondary }}>
              Match #{matchNumber} — Upload scoreboard screenshot(s)
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textSecondary, cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {success ? (
          <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <p style={{ margin: 0, color: C.green, fontWeight: 600, fontSize: 15 }}>{success}</p>
            <button onClick={onClose} style={{ marginTop: 16, background: C.green, color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Instructions */}
            <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.accent, fontWeight: 600 }}>📸 Screenshot Tips</p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: C.textSecondary, lineHeight: 1.8 }}>
                <li>Include the <strong style={{ color: C.textPrimary }}>end-of-game scoreboard</strong> showing all K/D/A</li>
                <li>Make sure the <strong style={{ color: C.textPrimary }}>final score</strong> (e.g. 13-7) is visible</li>
                <li>Up to 5 screenshots supported (e.g. one per map for Bo3)</li>
              </ul>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${files.length > 0 ? C.accent : C.border}`,
                borderRadius: 12, padding: '24px 16px', textAlign: 'center',
                cursor: 'pointer', marginBottom: 16, transition: 'border-color 0.2s',
                background: files.length > 0 ? `${C.accent}08` : 'transparent',
              }}
            >
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              <div style={{ fontSize: 32, marginBottom: 8 }}>{files.length > 0 ? '📁' : '📤'}</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: files.length > 0 ? C.accent : C.textSecondary }}>
                {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Click or drag screenshots here'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>PNG/JPG, max 10MB each</p>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                {previews.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
                    <input
                      value={labels[i] || ''}
                      onChange={e => { const l = [...labels]; l[i] = e.target.value; setLabels(l); }}
                      style={{
                        marginTop: 4, width: '100%', background: C.card, border: `1px solid ${C.border}`,
                        color: C.textPrimary, borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box',
                      }}
                      placeholder="Label…"
                    />
                    <button
                      onClick={e => { e.stopPropagation(); const f = [...files]; const p = [...previews]; const l = [...labels]; f.splice(i,1); p.splice(i,1); l.splice(i,1); setFiles(f); setPreviews(p); setLabels(l); }}
                      style={{ position: 'absolute', top: 4, right: 4, background: C.red, border: 'none', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: C.red }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ background: C.card, color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || files.length === 0}
                style={{
                  background: files.length > 0 && !submitting ? C.accent : C.border,
                  color: '#000', border: 'none', borderRadius: 8,
                  padding: '9px 24px', fontSize: 13, fontWeight: 700,
                  cursor: submitting || files.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Uploading…' : '📤 Submit Result'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
