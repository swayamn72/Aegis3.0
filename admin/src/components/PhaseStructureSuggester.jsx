import React, { useState } from 'react';
import { toast } from 'react-toastify';

// ─── Shared helpers ────────────────────────────────────────────────────────────

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ═══════════════════════════════════════════════════════════════════════════════
// BGMI — Lobby-based suggester (battle royale: groups of teams per lobby)
// ═══════════════════════════════════════════════════════════════════════════════

const BGMI_PHASE_NAMES = ['Grand Finals', 'Semi Finals', 'Quarter Finals', 'Pre-Quarter Finals'];

const assignBgmiNames = (phases) => {
    const total = phases.length;
    const earlyCount = Math.max(0, total - BGMI_PHASE_NAMES.length);
    return phases.map((phase, i) => {
        const idxFromEnd = total - 1 - i;
        const name = idxFromEnd < BGMI_PHASE_NAMES.length
            ? BGMI_PHASE_NAMES[idxFromEnd]
            : (earlyCount === 1 ? 'Qualifiers' : `Round ${i + 1}`);
        return { ...phase, name, type: idxFromEnd === 0 ? 'final_stage' : 'qualifiers' };
    });
};

export const computeFullSuggestion = (totalTeams, lobbySize, topQualify, finalLobbySize) => {
    if (!totalTeams || totalTeams <= 0 || lobbySize <= 0 || topQualify <= 0) return [];
    if (totalTeams <= finalLobbySize) {
        return assignBgmiNames([{
            teamsIn: totalTeams,
            numGroups: Math.max(1, Math.ceil(totalTeams / lobbySize)),
            topQualify: null,
            teamsOut: null,
        }]);
    }
    const phases = [];
    let teamsIn = totalTeams;
    let safety = 0;
    while (teamsIn > finalLobbySize && safety++ < 15) {
        const numGroups = Math.max(1, Math.ceil(teamsIn / lobbySize));
        const teamsOut = numGroups * topQualify;
        phases.push({ teamsIn, numGroups, topQualify, teamsOut });
        if (teamsOut >= teamsIn) break;
        teamsIn = teamsOut;
    }
    phases.push({
        teamsIn,
        numGroups: Math.max(1, Math.ceil(teamsIn / lobbySize)),
        topQualify: null,
        teamsOut: null,
    });
    return assignBgmiNames(phases);
};

const BgmiSuggester = ({ totalTeams, onApply }) => {
    const [showSuggester, setShowSuggester] = useState(false);
    const [config, setConfig] = useState({ lobbySize: 16, topQualify: 8, finalLobbySize: 16 });
    const [phases, setPhases] = useState([]);

    const open = () => {
        setPhases(computeFullSuggestion(totalTeams, config.lobbySize, config.topQualify, config.finalLobbySize));
        setShowSuggester(true);
    };

    const reset = () => {
        setPhases(computeFullSuggestion(totalTeams, config.lobbySize, config.topQualify, config.finalLobbySize));
    };

    const handleConfigChange = (field, raw) => {
        let value = parseInt(raw) || 0;
        if (field === 'lobbySize') value = clamp(value, 2, 24);
        if (field === 'topQualify') value = clamp(value, 1, 99);
        if (field === 'finalLobbySize') value = clamp(value, 2, 24);
        const next = { ...config, [field]: value };
        setConfig(next);
        setPhases(computeFullSuggestion(totalTeams, next.lobbySize, next.topQualify, next.finalLobbySize));
    };

    const handleTopQualifyChange = (idx, raw) => {
        const newVal = clamp(parseInt(raw) || 1, 1, 99);
        const currentPhases = phases.map(p => ({ ...p }));
        currentPhases[idx].topQualify = newVal;
        currentPhases[idx].teamsOut = currentPhases[idx].numGroups * newVal;

        const newPhases = currentPhases.slice(0, idx + 1);
        let teamsIn = currentPhases[idx].teamsOut;
        let safety = 0;
        while (teamsIn > config.finalLobbySize && safety++ < 15) {
            const numGroups = Math.max(1, Math.ceil(teamsIn / config.lobbySize));
            const teamsOut = numGroups * config.topQualify;
            newPhases.push({ teamsIn, numGroups, topQualify: config.topQualify, teamsOut });
            if (teamsOut >= teamsIn) break;
            teamsIn = teamsOut;
        }
        newPhases.push({
            teamsIn,
            numGroups: Math.max(1, Math.ceil(teamsIn / config.lobbySize)),
            topQualify: null,
            teamsOut: null,
        });
        setPhases(assignBgmiNames(newPhases));
    };

    const apply = () => {
        const converted = phases.map((sp, i) => ({
            name: sp.name,
            type: sp.type,
            startDate: '',
            endDate: '',
            status: 'upcoming',
            directInvites: { mode: 'decide_later', targetCount: null },
            details: sp.type === 'final_stage'
                ? `Grand Finals — ${sp.teamsIn} teams, 1 lobby`
                : `${sp.teamsIn} teams · ${sp.numGroups} group${sp.numGroups !== 1 ? 's' : ''} · top ${sp.topQualify} per group qualify`,
            rulesetSpecifics: '',
            groups: [],
            qualificationRules: (sp.type !== 'final_stage' && phases[i + 1])
                ? [{ numberOfTeams: sp.topQualify, source: 'from_each_group', nextPhase: phases[i + 1].name }]
                : [],
        }));
        onApply(converted);
        setShowSuggester(false);
        toast.success('Phase structure applied! Customize each phase below if needed.');
    };

    const finalTeamsIn = phases.length > 0 ? phases[phases.length - 1].teamsIn : 0;
    const finalMismatch = phases.length > 0 && finalTeamsIn !== config.finalLobbySize;

    return (
        <div className="bg-gray-700/40 border border-orange-500/20 rounded-lg overflow-hidden">
            <button
                onClick={() => showSuggester ? setShowSuggester(false) : open()}
                className="w-full flex items-center justify-between px-4 py-3 bg-orange-500/10 hover:bg-orange-500/15 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-orange-400">✨</span>
                    <span className="text-sm font-semibold text-orange-300">Auto-suggest Phase Structure</span>
                    <span className="text-xs text-gray-400">— based on {totalTeams} total slots</span>
                </div>
                <span className="text-xs text-gray-400">{showSuggester ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showSuggester && (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">
                                Lobby Size <span className="text-gray-500">(2–24)</span>
                            </label>
                            <input
                                type="number" min="2" max="24"
                                value={config.lobbySize}
                                onChange={(e) => handleConfigChange('lobbySize', e.target.value)}
                                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Default Top Qualify</label>
                            <input
                                type="number" min="1"
                                value={config.topQualify}
                                onChange={(e) => handleConfigChange('topQualify', e.target.value)}
                                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">
                                Final Lobby Size <span className="text-gray-500">(2–24)</span>
                            </label>
                            <input
                                type="number" min="2" max="24"
                                value={config.finalLobbySize}
                                onChange={(e) => handleConfigChange('finalLobbySize', e.target.value)}
                                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <p className="text-xs text-gray-500 mt-0.5">Target teams in Grand Finals lobby</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {phases.map((sp, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${sp.type === 'final_stage'
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-gray-600/40 border-gray-500/40'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-semibold ${sp.type === 'final_stage' ? 'text-amber-300' : 'text-white'}`}>
                                        {sp.name}
                                    </span>
                                    <span className="text-xs text-gray-400 ml-2">
                                        {sp.teamsIn} teams · {sp.numGroups} group{sp.numGroups !== 1 ? 's' : ''}
                                        {sp.type !== 'final_stage' && ` · ~${Math.ceil(sp.teamsIn / sp.numGroups)} per lobby`}
                                    </span>
                                </div>
                                {sp.type !== 'final_stage' ? (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-xs text-gray-400">top</span>
                                        <input
                                            type="number" min="1"
                                            value={sp.topQualify}
                                            onChange={(e) => handleTopQualifyChange(i, e.target.value)}
                                            className="w-12 bg-gray-700 border border-gray-500 rounded px-1.5 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                        <span className="text-xs text-gray-400">qualify</span>
                                        <span className="text-xs font-semibold text-orange-400 ml-1">→ {sp.teamsOut}</span>
                                    </div>
                                ) : (
                                    <span className="text-amber-400 text-xs font-bold flex-shrink-0">🏆 Grand Final</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {finalMismatch && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-400">
                            ⚠️ Final lobby will have <strong>{finalTeamsIn}</strong> teams (target: {config.finalLobbySize}).
                            Adjust the "top qualify" values above or proceed as-is.
                        </div>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button onClick={reset} className="px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded transition-colors">
                            Reset
                        </button>
                        <button onClick={apply} className="flex-1 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 rounded transition-colors">
                            ✓ Apply This Structure
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALORANT — Bracket-based suggester (5v5: single/double elim, Swiss, RR)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a phase list for a given Valorant bracket format.
 * Returns ready-to-use formData.phases-compatible objects.
 */
const buildValorantPhases = (format, totalTeams) => {
    switch (format) {
        case 'single_elimination': {
            // Power-of-2 rounds: R16 → QF → SF → GF
            const rounds = [];
            let teamsIn = totalTeams;
            while (teamsIn > 2) {
                const teamsOut = Math.ceil(teamsIn / 2);
                rounds.push({ teamsIn, teamsOut });
                teamsIn = teamsOut;
            }
            rounds.push({ teamsIn: 2, teamsOut: 1 }); // Grand Final
            // Name rounds from the end
            const ROUND_NAMES = ['Grand Final', 'Semi Finals', 'Quarter Finals', 'Round of 16', 'Round of 32', 'Round of 64'];
            return rounds.reverse().map((r, i) => {
                const idxFromEnd = i;
                const name = idxFromEnd < ROUND_NAMES.length ? ROUND_NAMES[idxFromEnd] : `Round ${rounds.length - i}`;
                return {
                    name,
                    type: idxFromEnd === 0 ? 'final_stage' : 'playoffs',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: `${r.teamsIn} teams · Single Elimination · Best of ${idxFromEnd === 0 ? '3–5' : '1–3'}`,
                    rulesetSpecifics: '',
                    groups: [],
                    qualificationRules: [],
                };
            }).reverse();
        }

        case 'double_elimination': {
            return [
                {
                    name: 'Group Stage',
                    type: 'group_stage',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: `${totalTeams} teams · Round Robin groups · top teams advance`,
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
                {
                    name: 'Upper Bracket',
                    type: 'playoffs',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: 'Upper bracket — winners advance, losers drop to lower bracket',
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
                {
                    name: 'Lower Bracket',
                    type: 'playoffs',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: 'Lower bracket — second chance for teams dropped from upper bracket',
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
                {
                    name: 'Grand Final',
                    type: 'final_stage',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: 'Grand Final — Upper bracket winner vs Lower bracket winner · Best of 5',
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
            ];
        }

        case 'swiss': {
            // Standard Swiss: ceil(log2(teams)) rounds, top 50% advance
            const rounds = Math.max(3, Math.ceil(Math.log2(totalTeams)));
            const phases = [];
            for (let r = 1; r <= rounds; r++) {
                phases.push({
                    name: `Swiss Round ${r}`,
                    type: r === rounds ? 'playoffs' : 'group_stage',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: `Swiss Round ${r} of ${rounds} · ${totalTeams} teams · Best of 3`,
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                });
            }
            phases.push({
                name: 'Playoffs',
                type: 'final_stage',
                startDate: '', endDate: '', status: 'upcoming',
                directInvites: { mode: 'decide_later', targetCount: null },
                details: 'Top teams from Swiss · Single Elimination · Best of 3–5',
                rulesetSpecifics: '', groups: [], qualificationRules: [],
            });
            return phases;
        }

        case 'round_robin_plus_finals': {
            return [
                {
                    name: 'Round Robin',
                    type: 'group_stage',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: `${totalTeams} teams · All teams play each other · Best of 3`,
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
                {
                    name: 'Semi Finals',
                    type: 'playoffs',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: 'Top 4 teams from Round Robin · Best of 3',
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
                {
                    name: 'Grand Final',
                    type: 'final_stage',
                    startDate: '', endDate: '', status: 'upcoming',
                    directInvites: { mode: 'decide_later', targetCount: null },
                    details: 'Top 2 teams · Best of 5',
                    rulesetSpecifics: '', groups: [], qualificationRules: [],
                },
            ];
        }

        default:
            return [];
    }
};

const VALORANT_FORMATS = [
    {
        id: 'single_elimination',
        label: 'Single Elimination',
        icon: '⚔️',
        desc: 'One loss = eliminated. Fast-paced, decisive.',
        bestFor: 'Small fields (8–16 teams)',
    },
    {
        id: 'double_elimination',
        label: 'Double Elimination',
        icon: '🔄',
        desc: 'Upper + Lower bracket. Two losses = out. Forgiving format.',
        bestFor: 'Medium fields (8–32 teams)',
    },
    {
        id: 'swiss',
        label: 'Swiss System',
        icon: '🔀',
        desc: `${Math.ceil(Math.log2(16))}-round Swiss then playoffs. Every team plays the same number of matches.`,
        bestFor: 'Large fields (16–64 teams)',
    },
    {
        id: 'round_robin_plus_finals',
        label: 'Round Robin + Finals',
        icon: '🏟️',
        desc: 'All teams play each other then top 4 go to playoffs.',
        bestFor: 'Small elite fields (4–8 teams)',
    },
];

const ValorantSuggester = ({ totalTeams, onApply }) => {
    const [showSuggester, setShowSuggester] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState('double_elimination');

    const preview = buildValorantPhases(selectedFormat, totalTeams);

    const apply = () => {
        onApply(preview);
        setShowSuggester(false);
        toast.success('Valorant bracket structure applied! Customize dates and details below.');
    };

    return (
        <div className="bg-gray-700/40 border border-blue-500/20 rounded-lg overflow-hidden">
            <button
                onClick={() => setShowSuggester(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/15 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-blue-400">✨</span>
                    <span className="text-sm font-semibold text-blue-300">Auto-suggest Bracket Structure</span>
                    <span className="text-xs text-gray-400">— Valorant · {totalTeams} teams</span>
                </div>
                <span className="text-xs text-gray-400">{showSuggester ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showSuggester && (
                <div className="p-4 space-y-4">
                    {/* Format picker */}
                    <div>
                        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Select Tournament Format</p>
                        <div className="grid grid-cols-2 gap-2">
                            {VALORANT_FORMATS.map(fmt => (
                                <button
                                    key={fmt.id}
                                    onClick={() => setSelectedFormat(fmt.id)}
                                    className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${selectedFormat === fmt.id
                                        ? 'bg-blue-500/20 border-blue-500/60 text-white'
                                        : 'bg-gray-600/40 border-gray-500/40 text-gray-300 hover:border-blue-500/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span>{fmt.icon}</span>
                                        <span className="text-xs font-semibold">{fmt.label}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400">{fmt.desc}</p>
                                    <p className="text-[10px] text-blue-400/70 mt-0.5">Best for: {fmt.bestFor}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Phase preview */}
                    <div>
                        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Preview</p>
                        <div className="space-y-1.5">
                            {preview.map((phase, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-3 px-3 py-2 rounded-lg border text-sm ${phase.type === 'final_stage'
                                        ? 'bg-amber-500/10 border-amber-500/30'
                                        : phase.type === 'playoffs'
                                            ? 'bg-blue-500/10 border-blue-500/20'
                                            : 'bg-gray-600/30 border-gray-500/30'
                                        }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className={`font-semibold ${phase.type === 'final_stage' ? 'text-amber-300' : 'text-white'}`}>
                                            {phase.name}
                                        </span>
                                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${phase.type === 'final_stage'
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : phase.type === 'playoffs'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-gray-500/30 text-gray-400'
                                            }`}>
                                            {phase.type.replace('_', ' ')}
                                        </span>
                                        <p className="text-xs text-gray-400 mt-0.5">{phase.details}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => setShowSuggester(false)}
                            className="px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={apply}
                            className="flex-1 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        >
                            ✓ Apply {VALORANT_FORMATS.find(f => f.id === selectedFormat)?.label} Structure
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — routes to the correct suggester based on gameTitle prop
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PhaseStructureSuggester
 *
 * Game-aware phase auto-suggester:
 *   - BGMI     → lobby-based calculator (group lobbies, top-qualify cascade)
 *   - VALORANT → bracket-format picker (Single/Double Elim, Swiss, RR+Finals)
 *
 * Props:
 *   totalTeams {number}  — formData.slots.total
 *   gameTitle  {string}  — formData.gameTitle  ('BGMI' | 'VALORANT')
 *   onApply    {fn}      — called with phases[] to set into formData
 */
const PhaseStructureSuggester = ({ totalTeams, gameTitle, onApply }) => {
    if (gameTitle === 'VALORANT') {
        return <ValorantSuggester totalTeams={totalTeams} onApply={onApply} />;
    }
    // Default: BGMI lobby-based
    return <BgmiSuggester totalTeams={totalTeams} onApply={onApply} />;
};

export default PhaseStructureSuggester;
