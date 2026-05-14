import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createTournamentAPI } from '../api/adminApi';
import AdminLayout from '../components/AdminLayout';
import { toast } from 'react-toastify';
import { Trophy, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';

const TIERS = ['S', 'A', 'B', 'C', 'Community'];
const GAME_CONFIGS = {
  BGMI: {
    displayName: 'BGMI',
    formats: ['Battle Royale Points System', 'Elimination Format', 'Custom'],
    gameModes: ['TPP Squad', 'FPP Squad', 'Custom'],
    maps: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'],
    defaultSlots: 16,
    teamSize: 4,
  },
  VALORANT: {
    displayName: 'Valorant',
    formats: ['Best of 1', 'Best of 3', 'Best of 5', 'Round Robin', 'Swiss', 'Double Elimination', 'Custom'],
    gameModes: ['Standard', 'Custom'],
    maps: ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'],
    defaultSlots: 8,
    teamSize: 5,
  },
};
const PHASE_TYPES = ['qualifiers', 'group_stage', 'quarter_finals', 'semi_finals', 'finals', 'final_stage'];

export default function AdminTournamentCreate() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    tournamentName: '', shortName: '', gameTitle: 'BGMI', tier: 'Community', region: 'India',
    format: 'Battle Royale Points System', startDate: '', endDate: '', description: '', importanceScore: 50,
    prizePool: { total: 0, currency: 'INR', distribution: [] },
    phases: [], slots: { total: 16, invited: 0, openRegistrations: 16 },
    registrationStartDate: '', registrationEndDate: '', isOpenForAll: true,
    gameSettings: { serverRegion: 'India', gameMode: 'TPP Squad', maps: [], teamSize: 4, matchFormat: '1vAll' },
  });

  const gameConfig = GAME_CONFIGS[form.gameTitle] || GAME_CONFIGS.BGMI;

  // When game changes, reset game-dependent fields
  const handleGameChange = (newGame) => {
    const config = GAME_CONFIGS[newGame];
    setForm(f => ({
      ...f,
      gameTitle: newGame,
      format: config.formats[0],
      slots: { ...f.slots, total: config.defaultSlots, openRegistrations: config.defaultSlots },
      gameSettings: {
        serverRegion: 'India',
        gameMode: config.gameModes[0],
        maps: [],
        teamSize: config.teamSize,
        matchFormat: newGame === 'BGMI' ? '1vAll' : '1v1',
        bestOf: newGame === 'VALORANT' ? 1 : null,
      },
    }));
  };

  const createMutation = useMutation({
    mutationFn: createTournamentAPI,
    onSuccess: (d) => { toast.success('Tournament created!'); setStep(4); },
    onError: (e) => toast.error(e.response?.data?.error || e.message || 'Failed'),
  });

  const addPhase = () => {
    setForm(f => ({ ...f, phases: [...f.phases, { name: '', type: 'qualifiers', startDate: '', endDate: '', details: '', groups: [] }] }));
  };
  const removePhase = (i) => setForm(f => ({ ...f, phases: f.phases.filter((_, idx) => idx !== i) }));
  const updatePhase = (i, field, value) => {
    setForm(f => ({ ...f, phases: f.phases.map((p, idx) => idx === i ? { ...p, [field]: value } : p) }));
  };
  const addGroup = (phaseIdx) => {
    setForm(f => ({
      ...f, phases: f.phases.map((p, i) => i === phaseIdx ? { ...p, groups: [...p.groups, { name: `Group ${String.fromCharCode(65 + p.groups.length)}`, teams: [] }] } : p)
    }));
  };

  const handleSubmit = () => createMutation.mutate(form);

  const inputCls = "w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-orange-500 outline-none";
  const labelCls = "text-sm font-medium text-zinc-300 mb-1 block";

  return (
    <AdminLayout>
      <div className="py-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-8"><Trophy className="w-8 h-8 text-orange-500" /> Create Tournament</h1>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-8">
          {['Basic Info', 'Phases & Roadmap', 'Review & Create', 'Done'].map((s, i) => (
            <div key={i} className={`flex-1 h-2 rounded-full ${i + 1 <= step ? 'bg-orange-500' : 'bg-zinc-800'}`} />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Tournament Name *</label><input value={form.tournamentName} onChange={e => setForm({ ...form, tournamentName: e.target.value })} className={inputCls} placeholder="Masters Series 2026" /></div>
              <div><label className={labelCls}>Short Name</label><input value={form.shortName} onChange={e => setForm({ ...form, shortName: e.target.value })} className={inputCls} placeholder="VCT 2026" /></div>
              <div>
                <label className={labelCls}>Game Title *</label>
                <div className="flex gap-2">
                  {Object.entries(GAME_CONFIGS).map(([key, cfg]) => (
                    <button key={key} type="button" onClick={() => handleGameChange(key)}
                      className={`flex-1 px-4 py-2 rounded-lg border font-medium transition-all ${
                        form.gameTitle === key
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}>
                      {cfg.displayName}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className={labelCls}>Tier</label><select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className={inputCls}>{TIERS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={labelCls}>Format</label><select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })} className={inputCls}>{gameConfig.formats.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
              <div><label className={labelCls}>Start Date *</label><input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>End Date *</label><input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Region</label><input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Importance Score (0-100)</label><input type="number" min={0} max={100} value={form.importanceScore} onChange={e => setForm({ ...form, importanceScore: +e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Total Slots</label><input type="number" value={form.slots.total} onChange={e => setForm({ ...form, slots: { ...form.slots, total: +e.target.value } })} className={inputCls} /></div>
              <div><label className={labelCls}>Prize Pool (₹)</label><input type="number" value={form.prizePool.total} onChange={e => setForm({ ...form, prizePool: { ...form.prizePool, total: +e.target.value } })} className={inputCls} /></div>
              {form.gameTitle === 'VALORANT' && (
                <div><label className={labelCls}>Best Of</label><select value={form.gameSettings.bestOf || 1} onChange={e => setForm({ ...form, gameSettings: { ...form.gameSettings, bestOf: +e.target.value } })} className={inputCls}><option value={1}>Bo1</option><option value={3}>Bo3</option><option value={5}>Bo5</option></select></div>
              )}
              <div className="md:col-span-2"><label className={labelCls}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} /></div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
              Team Size: {gameConfig.teamSize} players | Match Format: {form.gameTitle === 'BGMI' ? 'Battle Royale (25 teams)' : 'Head-to-Head (2 teams)'}
            </div>
            <div className="flex justify-end"><button onClick={() => setStep(2)} disabled={!form.tournamentName || !form.startDate || !form.endDate} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">Next <ChevronRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {/* Step 2: Phases */}
        {step === 2 && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Phases & Roadmap</h2>
              <button onClick={addPhase} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Phase</button>
            </div>
            {form.phases.length === 0 && <p className="text-zinc-500 text-center py-8">No phases yet. Add at least one phase.</p>}
            {form.phases.map((phase, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-white font-medium">Phase {i + 1}</h3>
                  <button onClick={() => removePhase(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input placeholder="Phase Name (e.g. Qualifiers)" value={phase.name} onChange={e => updatePhase(i, 'name', e.target.value)} className={inputCls} />
                  <select value={phase.type} onChange={e => updatePhase(i, 'type', e.target.value)} className={inputCls}>{PHASE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
                  <input type="datetime-local" value={phase.startDate} onChange={e => updatePhase(i, 'startDate', e.target.value)} className={inputCls} />
                  <input type="datetime-local" value={phase.endDate} onChange={e => updatePhase(i, 'endDate', e.target.value)} className={inputCls} />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Groups ({phase.groups.length})</span>
                    <button onClick={() => addGroup(i)} className="text-xs text-orange-400 hover:text-orange-300">+ Add Group</button>
                  </div>
                  {phase.groups.map((g, gi) => (
                    <div key={gi} className="mt-1 bg-zinc-800 rounded px-3 py-1.5 text-zinc-300 text-sm">{g.name}</div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button onClick={() => setStep(3)} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2">Review <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Review & Create</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-zinc-400">Game</div><div className="text-white font-medium">{GAME_CONFIGS[form.gameTitle]?.displayName || form.gameTitle}</div>
              <div className="text-zinc-400">Name</div><div className="text-white font-medium">{form.tournamentName}</div>
              <div className="text-zinc-400">Tier</div><div className="text-white">{form.tier}</div>
              <div className="text-zinc-400">Format</div><div className="text-white">{form.format}</div>
              <div className="text-zinc-400">Dates</div><div className="text-white">{form.startDate} → {form.endDate}</div>
              <div className="text-zinc-400">Prize Pool</div><div className="text-white">₹{form.prizePool.total?.toLocaleString()}</div>
              <div className="text-zinc-400">Slots</div><div className="text-white">{form.slots.total}</div>
              <div className="text-zinc-400">Phases</div><div className="text-white">{form.phases.map(p => p.name).join(' → ') || 'None'}</div>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(2)} className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending} className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold">{createMutation.isPending ? 'Creating...' : '🚀 Create Tournament'}</button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">Tournament Created!</h2>
            <p className="text-zinc-400 mb-6">Your tournament is live and ready for match scheduling.</p>
            <button onClick={() => { setStep(1); setForm({ tournamentName: '', shortName: '', gameTitle: 'BGMI', tier: 'Community', region: 'India', format: 'Battle Royale Points System', startDate: '', endDate: '', description: '', importanceScore: 50, prizePool: { total: 0, currency: 'INR', distribution: [] }, phases: [], slots: { total: 16, invited: 0, openRegistrations: 16 }, registrationStartDate: '', registrationEndDate: '', isOpenForAll: true, gameSettings: { serverRegion: 'India', gameMode: 'TPP Squad', maps: [], teamSize: 4, matchFormat: '1vAll' } }); }} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Create Another</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
