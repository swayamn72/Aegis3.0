import React, { useState } from 'react';
import { toast } from 'react-toastify';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PHASE_NAMES_FROM_END = ['Grand Finals', 'Semi Finals', 'Quarter Finals', 'Pre-Quarter Finals'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const assignSuggestedNames = (phases) => {
    const total = phases.length;
    const earlyCount = Math.max(0, total - PHASE_NAMES_FROM_END.length);
    return phases.map((phase, i) => {
        const idxFromEnd = total - 1 - i;
        let name;
        if (idxFromEnd < PHASE_NAMES_FROM_END.length) {
            name = PHASE_NAMES_FROM_END[idxFromEnd];
        } else {
            const earlyIdx = i;
            name = earlyCount === 1 ? 'Qualifiers' : `Round ${earlyIdx + 1}`;
        }
        return { ...phase, name, type: idxFromEnd === 0 ? 'final_stage' : 'qualifiers' };
    });
};

export const computeFullSuggestion = (totalTeams, lobbySize, topQualify, finalLobbySize) => {
    if (!totalTeams || totalTeams <= 0 || lobbySize <= 0 || topQualify <= 0) return [];
    if (totalTeams <= finalLobbySize) {
        return assignSuggestedNames([{
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
        if (teamsOut >= teamsIn) break; // guard: would diverge if topQualify >= lobbySize
        teamsIn = teamsOut;
    }
    // final lobby
    phases.push({
        teamsIn,
        numGroups: Math.max(1, Math.ceil(teamsIn / lobbySize)),
        topQualify: null,
        teamsOut: null,
    });
    return assignSuggestedNames(phases);
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PhaseStructureSuggester
 *
 * Displays an expandable panel that auto-generates a bracket structure from
 * `totalTeams`. Calls `onApply(phases)` with a ready-to-use phases array when
 * the organiser clicks "Apply This Structure".
 *
 * Config:
 *   - Lobby Size    : teams per match lobby (2–24, default 16)
 *   - Top Qualify   : how many teams advance from each lobby (default 8)
 *   - Final Lobby   : target number of teams in the Grand Finals (2–24, default 16)
 *
 * The organiser can override "top qualify" per phase; all downstream phases
 * recalculate automatically as a cascade.
 */
const PhaseStructureSuggester = ({ totalTeams, onApply }) => {
    const [showSuggester, setShowSuggester] = useState(false);
    const [config, setConfig] = useState({ lobbySize: 16, topQualify: 8, finalLobbySize: 16 });
    const [phases, setPhases] = useState([]);

    // ── Open / refresh ────────────────────────────────────────────────────
    const open = () => {
        setPhases(computeFullSuggestion(totalTeams, config.lobbySize, config.topQualify, config.finalLobbySize));
        setShowSuggester(true);
    };

    const reset = () => {
        setPhases(computeFullSuggestion(totalTeams, config.lobbySize, config.topQualify, config.finalLobbySize));
    };

    // ── Config change → recompute all ────────────────────────────────────
    const handleConfigChange = (field, raw) => {
        let value = parseInt(raw) || 0;
        if (field === 'lobbySize') value = clamp(value, 2, 24);
        if (field === 'topQualify') value = clamp(value, 1, 99);
        if (field === 'finalLobbySize') value = clamp(value, 2, 24);
        const next = { ...config, [field]: value };
        setConfig(next);
        setPhases(computeFullSuggestion(totalTeams, next.lobbySize, next.topQualify, next.finalLobbySize));
    };

    // ── Per-phase top-qualify edit → cascade downstream ──────────────────
    const handleTopQualifyChange = (idx, raw) => {
        const newVal = clamp(parseInt(raw) || 1, 1, 99);
        let currentPhases = phases.map(p => ({ ...p }));

        // Update the current phase
        currentPhases[idx].topQualify = newVal;
        currentPhases[idx].teamsOut = currentPhases[idx].numGroups * newVal;

        // Start from the current phase and rebuild downstream
        const newPhases = currentPhases.slice(0, idx + 1);
        let teamsIn = currentPhases[idx].teamsOut;
        let safety = 0;

        while (teamsIn > config.finalLobbySize && safety++ < 15) {
            const numGroups = Math.max(1, Math.ceil(teamsIn / config.lobbySize));
            const topQualify = config.topQualify; // Use default for subsequent phases
            const teamsOut = numGroups * topQualify;
            newPhases.push({ teamsIn, numGroups, topQualify, teamsOut });
            if (teamsOut >= teamsIn) break;
            teamsIn = teamsOut;
        }

        // Add final lobby
        newPhases.push({
            teamsIn,
            numGroups: Math.max(1, Math.ceil(teamsIn / config.lobbySize)),
            topQualify: null,
            teamsOut: null,
        });

        setPhases(assignSuggestedNames(newPhases));
    };

    // ── Apply → convert to formData.phases shape ─────────────────────────
    const apply = () => {
        const converted = phases.map((sp, i) => ({
            name: sp.name,
            type: sp.type,
            startDate: '',
            endDate: '',
            status: 'upcoming',
            directInvites: {
                mode: 'decide_later',
                targetCount: null,
            },
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

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="bg-gray-700/40 border border-orange-500/20 rounded-lg overflow-hidden">
            {/* Toggle header */}
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
                    {/* Config row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">
                                Lobby Size
                                <span className="text-gray-500 ml-1">(2–24)</span>
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
                                Final Lobby Size
                                <span className="text-gray-500 ml-1">(2–24)</span>
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

                    {/* Phase rows */}
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

                    {/* Mismatch warning */}
                    {finalMismatch && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-400">
                            ⚠️ Final lobby will have <strong>{finalTeamsIn}</strong> teams (target: {config.finalLobbySize}).
                            Adjust the "top qualify" values above or proceed as-is.
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={reset}
                            className="px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            onClick={apply}
                            className="flex-1 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 rounded transition-colors"
                        >
                            ✓ Apply This Structure
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PhaseStructureSuggester;
