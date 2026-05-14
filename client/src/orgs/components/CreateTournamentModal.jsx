import React, { useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';
import PhaseStructureSuggester from './PhaseStructureSuggester';

// ─── Game-specific configuration (mirrors server gameRegistry) ───
const GAME_CONFIG = {
    BGMI: {
        displayName: 'BGMI',
        maps: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'],
        formats: ['Battle Royale Points System', 'Elimination Format', 'Custom'],
        gameModes: ['TPP Squad', 'FPP Squad', 'Custom'],
        teamSize: 4,
        maxTeamsPerMatch: 25,
        defaultGameSettings: {
            serverRegion: 'India',
            gameMode: 'TPP Squad',
            maps: ['Erangel', 'Miramar'],
            pointsSystem: {
                killPoints: 1,
                placementPoints: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 }
            }
        },
        phaseTypes: ['qualifiers', 'final_stage'],
        defaultFormat: 'Battle Royale Points System',
        minSlots: 16,
    },
    VALORANT: {
        displayName: 'Valorant',
        // Full pool (all maps in game)
        maps: ['Ascent', 'Bind', 'Breeze', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset', 'Abyss'],
        // Current active competitive rotation — Season 26 Act 3 (updated April 29, 2026)
        // Ascent returned, Bind removed. Source: Liquipedia / Riot
        activeRotation: ['Ascent', 'Breeze', 'Fracture', 'Haven', 'Lotus', 'Pearl', 'Split'],
        // Map veto REQUIRES exactly 7 maps (ban×6 + 1 decider)
        requiredMapCount: 7,
        formats: ['Best of 1', 'Best of 3', 'Best of 5', 'Round Robin', 'Swiss', 'Double Elimination', 'Custom'],
        gameModes: ['Standard', 'Custom'],
        teamSize: 5,
        maxTeamsPerMatch: 2,
        // Max 256 teams — above this, bracket logistics become unmanageable for Valorant
        maxSlots: 256,
        defaultGameSettings: {
            serverRegion: 'India',
            gameMode: 'Standard',
            // Default to the active rotation so veto works out of the box
            maps: ['Ascent', 'Breeze', 'Fracture', 'Haven', 'Lotus', 'Pearl', 'Split'],
            matchFormat: '1v1',
        },
        phaseTypes: ['qualifiers', 'group_stage', 'playoffs', 'final_stage'],
        defaultFormat: 'Best of 3',
        minSlots: 4,
    },
};

const PHASE_INVITE_MODES = ['decide_later', 'none', 'fixed_count'];
const normalizePhaseDirectInvites = (directInvites) => {
    const mode = PHASE_INVITE_MODES.includes(directInvites?.mode)
        ? directInvites.mode
        : 'decide_later';

    if (mode !== 'fixed_count') {
        return { mode, targetCount: null };
    }

    const parsed = parseInt(directInvites?.targetCount, 10);
    return {
        mode,
        targetCount: Number.isFinite(parsed) ? parsed : null,
    };
};

const CreateTournamentModal = ({ organization, onClose, onSuccess }) => {
    const IndiaFlag = () => <span role="img" aria-label="India" className="ml-2">🇮🇳</span>;
    const [step, setStep] = useState(1);
    const isSubmittingRef = React.useRef(false);
    const [formData, setFormData] = useState({
        tournamentName: '',
        shortName: '',
        gameTitle: 'BGMI',
        tier: 'Community',
        region: 'India',
        startDate: '',
        endDate: '',
        registrationStartDate: '',
        registrationEndDate: '',
        description: '',
        format: 'Battle Royale Points System',
        slots: { total: 16, invited: 0, fromQualifiers: 0, openRegistrations: 16 },
        prizePool: { total: 0, currency: 'INR', distribution: [] },
        phases: [],
        gameSettings: { ...GAME_CONFIG.BGMI.defaultGameSettings }
    });

    // Derived: current game config
    const gameConfig = GAME_CONFIG[formData.gameTitle] || GAME_CONFIG.BGMI;

    const handleGameChange = (newGame) => {
        const config = GAME_CONFIG[newGame];
        if (!config) return;
        setFormData(prev => ({
            ...prev,
            gameTitle: newGame,
            format: config.defaultFormat,
            gameSettings: { ...config.defaultGameSettings },
            slots: {
                ...prev.slots,
                total: Math.max(prev.slots.total, config.minSlots),
            },
            phases: [], // reset phases when game changes
        }));
    };
    const [files, setFiles] = useState({ logo: null, banner: null, coverImage: null });
    const queryClient = useQueryClient();

    // Mutation: Create tournament
    const createTournamentMutation = useMutation({
        mutationFn: async (formDataToSend) => {
            const response = await axiosInstance.post('/api/org-tournaments/create-tournament', formDataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success('Tournament submitted for admin approval!');
            queryClient.invalidateQueries({ queryKey: ['organizationTournaments'] });
            onSuccess();
        },
        onError: (error) => {
            console.error('Error creating tournament:', error);

            // Handle different error response formats (axios config returns data directly)
            let serverError = 'Unknown error occurred';
            let validationErrors = null;

            if (typeof error === 'string') {
                serverError = error;
            } else if (error && typeof error === 'object') {
                serverError = error.error || error.message || serverError;
                validationErrors = error.errors;
            }

            if (validationErrors && Array.isArray(validationErrors)) {
                toast.error(`Validation Failed: ${validationErrors.join('. ')}`);
            } else {
                toast.error(`Error: ${serverError}`);
            }
        },
    });

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNestedChange = (parent, field, value) => {
        setFormData(prev => ({
            ...prev,
            [parent]: { ...prev[parent], [field]: value }
        }));
    };

    const handleMapToggle = (mapName) => {
        setFormData(prev => {
            const config = GAME_CONFIG[prev.gameTitle];
            const requiredCount = config?.requiredMapCount || null;
            const currentMaps = prev.gameSettings.maps || [];
            const isSelected = currentMaps.includes(mapName);

            // For games with a fixed required count, block adding beyond the limit
            if (!isSelected && requiredCount && currentMaps.length >= requiredCount) {
                toast.warn(`Valorant map veto requires exactly ${requiredCount} maps. Deselect one first.`);
                return prev;
            }

            const newMaps = isSelected
                ? currentMaps.filter(m => m !== mapName)
                : [...currentMaps, mapName];

            return {
                ...prev,
                gameSettings: { ...prev.gameSettings, maps: newMaps }
            };
        });
    };

    const handleFileChange = (field, file) => {
        setFiles(prev => ({ ...prev, [field]: file }));
    };

    const addPhase = () => {
        const newPhase = {
            name: `Phase ${formData.phases.length + 1}`,
            type: 'qualifiers',
            startDate: '',
            endDate: '',
            status: 'upcoming',
            directInvites: {
                mode: 'decide_later',
                targetCount: null,
            },
            details: '',
            rulesetSpecifics: '',
            groups: [],
            qualificationRules: []
        };
        setFormData(prev => ({
            ...prev,
            phases: [...prev.phases, newPhase]
        }));
    };

    const addQualificationRule = (phaseIndex) => {
        const updatedPhases = [...formData.phases];
        const nextPhaseName = phaseIndex + 1 < formData.phases.length
            ? formData.phases[phaseIndex + 1].name
            : '';
        updatedPhases[phaseIndex] = {
            ...updatedPhases[phaseIndex],
            qualificationRules: [
                ...(updatedPhases[phaseIndex].qualificationRules || []),
                { numberOfTeams: 8, source: 'overall', nextPhase: nextPhaseName }
            ]
        };
        setFormData(prev => ({ ...prev, phases: updatedPhases }));
    };

    const removeQualificationRule = (phaseIndex, ruleIndex) => {
        const updatedPhases = [...formData.phases];
        updatedPhases[phaseIndex] = {
            ...updatedPhases[phaseIndex],
            qualificationRules: updatedPhases[phaseIndex].qualificationRules.filter((_, i) => i !== ruleIndex)
        };
        setFormData(prev => ({ ...prev, phases: updatedPhases }));
    };

    const updateQualificationRule = (phaseIndex, ruleIndex, field, value) => {
        const updatedPhases = [...formData.phases];
        const rules = [...updatedPhases[phaseIndex].qualificationRules];
        rules[ruleIndex] = { ...rules[ruleIndex], [field]: value };
        updatedPhases[phaseIndex] = { ...updatedPhases[phaseIndex], qualificationRules: rules };
        setFormData(prev => ({ ...prev, phases: updatedPhases }));
    };

    const updatePhase = (index, field, value) => {
        const updatedPhases = [...formData.phases];
        updatedPhases[index] = { ...updatedPhases[index], [field]: value };
        setFormData(prev => ({ ...prev, phases: updatedPhases }));
    };

    const updatePhaseDirectInviteMode = (index, mode) => {
        const updatedPhases = [...formData.phases];
        const previous = normalizePhaseDirectInvites(updatedPhases[index]?.directInvites);
        updatedPhases[index] = {
            ...updatedPhases[index],
            directInvites: mode === 'fixed_count'
                ? { mode, targetCount: previous.targetCount || 1 }
                : { mode, targetCount: null }
        };
        setFormData(prev => ({ ...prev, phases: updatedPhases }));
    };

    const updatePhaseDirectInviteCount = (index, rawValue) => {
        const value = parseInt(rawValue, 10);
        const updatedPhases = [...formData.phases];
        const previous = normalizePhaseDirectInvites(updatedPhases[index]?.directInvites);
        updatedPhases[index] = {
            ...updatedPhases[index],
            directInvites: {
                mode: 'fixed_count',
                targetCount: Number.isFinite(value) ? value : null,
            }
        };
        if (previous.mode !== 'fixed_count') {
            updatedPhases[index].directInvites.mode = 'fixed_count';
        }
        setFormData(prev => ({ ...prev, phases: updatedPhases }));
    };

    const removePhase = (index) => {
        setFormData(prev => ({
            ...prev,
            phases: prev.phases.filter((_, i) => i !== index)
        }));
    };

    // ────────────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        try {
            if (!formData.tournamentName || formData.tournamentName.trim() === '') {
                toast.error('Tournament Name is required.');
                return;
            }
            const hasFinalStage = formData.phases?.some(p => p.type === 'final_stage');
            if (!hasFinalStage) {
                toast.error('At least one phase must be set as "Final Stage" before submitting.');
                return;
            }
            const selectedMaps = formData.gameSettings?.maps || [];
            const requiredMapCount = GAME_CONFIG[formData.gameTitle]?.requiredMapCount;
            if (requiredMapCount) {
                if (selectedMaps.length !== requiredMapCount) {
                    toast.error(`Valorant map veto requires exactly ${requiredMapCount} maps. You have selected ${selectedMaps.length}.`);
                    return;
                }
            } else if (selectedMaps.length === 0) {
                toast.error('Please select at least one map.');
                return;
            }
            const totalSlots = Number(formData.slots?.total || 0);
            for (let i = 0; i < (formData.phases || []).length; i++) {
                const phase = formData.phases[i];
                const invitePlan = normalizePhaseDirectInvites(phase?.directInvites);
                if (invitePlan.mode === 'fixed_count') {
                    if (!invitePlan.targetCount || invitePlan.targetCount < 1) {
                        toast.error(`Phase ${i + 1}: invite target must be at least 1.`);
                        return;
                    }
                    if (totalSlots > 0 && invitePlan.targetCount > totalSlots) {
                        toast.error(`Phase ${i + 1}: invite target cannot exceed total slots (${totalSlots}).`);
                        return;
                    }
                }
            }

            const normalizedPhases = (formData.phases || []).map((phase) => ({
                ...phase,
                directInvites: normalizePhaseDirectInvites(phase?.directInvites)
            }));
            const formDataToSend = new FormData();
            const normalizedPayload = {
                ...formData,
                phases: normalizedPhases,
            };
            formDataToSend.append('tournamentData', JSON.stringify(normalizedPayload));


            if (files.logo) formDataToSend.append('logo', files.logo);
            if (files.banner) formDataToSend.append('banner', files.banner);
            if (files.coverImage) formDataToSend.append('coverImage', files.coverImage);

            await createTournamentMutation.mutateAsync(formDataToSend);
        } catch (error) {
            // Error already handled in mutation
        } finally {
            isSubmittingRef.current = false;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
                    <h2 className="text-2xl font-bold">Create Tournament</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= s ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
                                    }`}>
                                    {s}
                                </div>
                                {s < 3 && <div className={`w-12 h-1 ${step > s ? 'bg-orange-500' : 'bg-gray-700'}`} />}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Basic Info */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold mb-4">Basic Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Tournament Name *</label>
                                    <input
                                        type="text"
                                        value={formData.tournamentName}
                                        onChange={(e) => handleInputChange('tournamentName', e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                        placeholder={`${gameConfig.displayName} Championship 2025`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Short Name</label>
                                    <input
                                        type="text"
                                        value={formData.shortName}
                                        onChange={(e) => handleInputChange('shortName', e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                        placeholder="BWC 2024"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Game *</label>
                                    <select
                                        value={formData.gameTitle}
                                        onChange={(e) => handleGameChange(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                    >
                                        {Object.entries(GAME_CONFIG).map(([key, cfg]) => (
                                            <option key={key} value={key}>{cfg.displayName}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Tier</label>
                                    <select
                                        value={formData.tier}
                                        onChange={(e) => handleInputChange('tier', e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                    >
                                        <option value="Community">Community</option>
                                        <option value="C">C-Tier</option>
                                        <option value="B">B-Tier</option>
                                        <option value="A">A-Tier</option>
                                        <option value="S">S-Tier</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 flex items-center">Region * <IndiaFlag /></label>
                                    <input
                                        type="text"
                                        value="India"
                                        disabled
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white opacity-70 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Total Slots *{' '}
                                        <span className="text-gray-400 font-normal text-xs">
                                            (min {gameConfig.minSlots}
                                            {gameConfig.maxSlots ? `, max ${gameConfig.maxSlots}` : ''}
                                            )
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.slots.total}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || gameConfig.minSlots;
                                            const clamped = gameConfig.maxSlots ? Math.min(val, gameConfig.maxSlots) : val;
                                            handleNestedChange('slots', 'total', clamped);
                                        }}
                                        className={`w-full bg-gray-700 border rounded px-3 py-2 text-white ${
                                            formData.slots.total < gameConfig.minSlots || (gameConfig.maxSlots && formData.slots.total > gameConfig.maxSlots)
                                                ? 'border-red-500'
                                                : 'border-gray-600'
                                        }`}
                                        min={gameConfig.minSlots}
                                        max={gameConfig.maxSlots || undefined}
                                    />
                                    {formData.slots.total < gameConfig.minSlots && (
                                        <p className="text-red-400 text-xs mt-1">Minimum {gameConfig.minSlots} teams required.</p>
                                    )}
                                    {gameConfig.maxSlots && formData.slots.total > gameConfig.maxSlots && (
                                        <p className="text-red-400 text-xs mt-1">Maximum {gameConfig.maxSlots} teams allowed for {gameConfig.displayName}.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Start Date *</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">End Date *</label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            {/* Map Selection — dynamic per game */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium">
                                        Maps *
                                        {gameConfig.requiredMapCount && (
                                            <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${
                                                (formData.gameSettings.maps?.length || 0) === gameConfig.requiredMapCount
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-red-500/20 text-red-400'
                                            }`}>
                                                {formData.gameSettings.maps?.length || 0}/{gameConfig.requiredMapCount} selected
                                            </span>
                                        )}
                                    </label>
                                    {gameConfig.activeRotation && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                gameSettings: { ...prev.gameSettings, maps: [...gameConfig.activeRotation] }
                                            }))}
                                            className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30 transition-colors"
                                        >
                                            ⚡ Use Current Rotation
                                        </button>
                                    )}
                                </div>

                                {gameConfig.requiredMapCount && (
                                    <p className="text-xs text-gray-400 mb-3">
                                        Map veto requires exactly {gameConfig.requiredMapCount} maps (6 bans + 1 decider).
                                        Active rotation is pre-selected.
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    {gameConfig.maps.map((mapName) => {
                                        const isSelected = formData.gameSettings.maps?.includes(mapName);
                                        const isInRotation = gameConfig.activeRotation?.includes(mapName);
                                        const isAtLimit = gameConfig.requiredMapCount &&
                                            (formData.gameSettings.maps?.length || 0) >= gameConfig.requiredMapCount &&
                                            !isSelected;
                                        return (
                                            <button
                                                key={mapName}
                                                type="button"
                                                onClick={() => handleMapToggle(mapName)}
                                                disabled={isAtLimit}
                                                title={!isInRotation && gameConfig.activeRotation ? `${mapName} (not in current rotation)` : mapName}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
                                                    isSelected
                                                        ? 'bg-orange-500 text-white border border-orange-500'
                                                        : isAtLimit
                                                            ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'
                                                            : isInRotation
                                                                ? 'bg-gray-700 text-gray-200 border border-blue-600/40 hover:border-blue-500'
                                                                : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500 opacity-60'
                                                }`}
                                            >
                                                {mapName}
                                                {isInRotation && !isSelected && (
                                                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400" title="In current rotation" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {gameConfig.activeRotation && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
                                        Blue dot = in current competitive rotation
                                    </p>
                                )}

                                {gameConfig.requiredMapCount && (
                                    (formData.gameSettings.maps?.length || 0) === gameConfig.requiredMapCount
                                        ? <p className="text-green-400 text-xs mt-2">✓ Map pool complete — veto system ready.</p>
                                        : <p className="text-red-400 text-xs mt-2">
                                            Select exactly {gameConfig.requiredMapCount} maps.
                                            {(formData.gameSettings.maps?.length || 0) > 0 &&
                                                ` (${gameConfig.requiredMapCount - (formData.gameSettings.maps?.length || 0)} more needed)`
                                            }
                                          </p>
                                )}
                            </div>

                            {/* Open for All Checkbox */}
                            <div className="space-y-2">
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        id="isOpenForAll"
                                        checked={formData.isOpenForAll || false}
                                        onChange={(e) => handleInputChange('isOpenForAll', e.target.checked)}
                                        className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                                    />
                                    <label htmlFor="isOpenForAll" className="text-sm font-medium text-gray-300">
                                        Open for public registration
                                    </label>
                                </div>
                                {formData.isOpenForAll && (
                                    <div className="flex items-center space-x-3 ml-7">
                                        <input
                                            type="checkbox"
                                            id="requiresApproval"
                                            checked={formData.requiresApproval || false}
                                            onChange={(e) => handleInputChange('requiresApproval', e.target.checked)}
                                            className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                        />
                                        <label htmlFor="requiresApproval" className="text-sm text-gray-400">
                                            Require manual approval per team
                                            <span className="ml-1 text-xs text-gray-500">(default: auto-approve on sign-up)</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Conditional Registration Dates */}
                            {formData.isOpenForAll && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Registration Start Date & Time</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.registrationStartDate}
                                            onChange={(e) => handleInputChange('registrationStartDate', e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Registration End Date & Time</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.registrationEndDate}
                                            onChange={(e) => handleInputChange('registrationEndDate', e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-24"
                                    placeholder="Describe your tournament..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Prize Pool (INR)</label>
                                <input
                                    type="number"
                                    value={formData.prizePool.total}
                                    onChange={(e) => handleNestedChange('prizePool', 'total', parseInt(e.target.value) || 0)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                    min="0"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Phases */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold">Tournament Phases</h3>
                                <button
                                    onClick={addPhase}
                                    className="bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded text-sm flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Add Phase
                                </button>
                            </div>

                            {/* ── Phase Structure Suggester ── */}
                            <PhaseStructureSuggester
                                totalTeams={formData.slots.total}
                                gameTitle={formData.gameTitle}
                                onApply={(phases) => setFormData(prev => ({ ...prev, phases }))}
                            />

                            {formData.phases.length === 0 ? (
                                <div className="bg-gray-700 rounded-lg p-8 text-center">
                                    <p className="text-gray-400">No phases added yet. Click "Add Phase" to create tournament stages.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.phases.map((phase, index) => (
                                        <div key={index} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                            {/* Phase header */}
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                                        <span className="text-orange-400 text-xs font-bold">{index + 1}</span>
                                                    </div>
                                                    <h4 className="font-semibold text-white">{phase.name || `Phase ${index + 1}`}</h4>
                                                </div>
                                                <button
                                                    onClick={() => removePhase(index)}
                                                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            {/* Core fields */}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Phase Name *</label>
                                                    <input
                                                        type="text"
                                                        value={phase.name}
                                                        onChange={(e) => updatePhase(index, 'name', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                        placeholder="e.g. Qualifiers"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Type</label>
                                                    <select
                                                        value={phase.type}
                                                        onChange={(e) => updatePhase(index, 'type', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    >
                                                        {gameConfig.phaseTypes.map(pt => (
                                                            <option key={pt} value={pt}>
                                                                {pt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={phase.startDate}
                                                        onChange={(e) => updatePhase(index, 'startDate', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={phase.endDate}
                                                        onChange={(e) => updatePhase(index, 'endDate', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="block text-xs text-gray-400 mb-1">Phase Details</label>
                                                    <input
                                                        type="text"
                                                        value={phase.details}
                                                        onChange={(e) => updatePhase(index, 'details', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                        placeholder="e.g. Top 16 teams advance to Final Stage"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="block text-xs text-gray-400 mb-1">Ruleset Specifics</label>
                                                    <textarea
                                                        value={phase.rulesetSpecifics || ''}
                                                        onChange={(e) => updatePhase(index, 'rulesetSpecifics', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                                                        rows={2}
                                                        placeholder="e.g. Best of 12 matches, all maps, ERMMM format"
                                                    />
                                                </div>

                                                <div className="col-span-2 bg-gray-800/40 border border-gray-600 rounded-lg p-3">
                                                    <label className="block text-xs text-gray-300 mb-2">Direct Team Invites (Optional)</label>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                                        <div>
                                                            <label className="block text-xs text-gray-400 mb-1">Invite Plan</label>
                                                            <select
                                                                value={normalizePhaseDirectInvites(phase.directInvites).mode}
                                                                onChange={(e) => updatePhaseDirectInviteMode(index, e.target.value)}
                                                                className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                            >
                                                                <option value="decide_later">Decide Later</option>
                                                                <option value="none">No Direct Invites</option>
                                                                <option value="fixed_count">Invite Fixed Count</option>
                                                            </select>
                                                        </div>
                                                        {normalizePhaseDirectInvites(phase.directInvites).mode === 'fixed_count' && (
                                                            <div>
                                                                <label className="block text-xs text-gray-400 mb-1">Invite Count</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max={formData.slots?.total || 4096}
                                                                    value={normalizePhaseDirectInvites(phase.directInvites).targetCount ?? ''}
                                                                    onChange={(e) => updatePhaseDirectInviteCount(index, e.target.value)}
                                                                    className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                                    placeholder="e.g. 64"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        Use "Decide Later" when you are unsure now. You can update this phase plan any time before execution.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Team Advancement Rules */}
                                            <div className="border-t border-gray-600 pt-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-medium text-gray-300">Team Advancement Rules</span>
                                                    <button
                                                        onClick={() => addQualificationRule(index)}
                                                        className="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-orange-500/10 transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" /> Add Rule
                                                    </button>
                                                </div>

                                                {(phase.qualificationRules || []).length === 0 ? (
                                                    <p className="text-xs text-gray-500 text-center py-3 border border-dashed border-gray-600 rounded">
                                                        No advancement rules — all teams stay in this phase.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {(phase.qualificationRules || []).map((rule, ruleIdx) => (
                                                            <div key={ruleIdx} className="bg-gray-600/60 rounded-lg p-3 border border-gray-500">
                                                                <div className="grid grid-cols-3 gap-2 mb-2">
                                                                    <div>
                                                                        <label className="block text-xs text-gray-400 mb-1">No. of Teams</label>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            value={rule.numberOfTeams}
                                                                            onChange={(e) => updateQualificationRule(index, ruleIdx, 'numberOfTeams', parseInt(e.target.value) || 1)}
                                                                            className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-gray-400 mb-1">Source</label>
                                                                        <select
                                                                            value={rule.source}
                                                                            onChange={(e) => updateQualificationRule(index, ruleIdx, 'source', e.target.value)}
                                                                            className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                                        >
                                                                            <option value="overall">Overall Standings</option>
                                                                            <option value="from_each_group">From Each Group</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-gray-400 mb-1">Next Phase</label>
                                                                        <select
                                                                            value={rule.nextPhase}
                                                                            onChange={(e) => updateQualificationRule(index, ruleIdx, 'nextPhase', e.target.value)}
                                                                            className="w-full bg-gray-700 border border-gray-500 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                                        >
                                                                            <option value="">Select…</option>
                                                                            {formData.phases.map((p, pIdx) => pIdx > index ? (
                                                                                <option key={pIdx} value={p.name}>{p.name || `Phase ${pIdx + 1}`}</option>
                                                                            ) : null)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs text-gray-400">
                                                                        Top <strong className="text-white">{rule.numberOfTeams}</strong> teams from{' '}
                                                                        <strong className="text-white">
                                                                            {rule.source === 'overall' ? 'overall standings' : 'each group'}
                                                                        </strong>{' '}advance to{' '}
                                                                        <strong className="text-orange-400">{rule.nextPhase || '—'}</strong>
                                                                    </p>
                                                                    <button
                                                                        onClick={() => removeQualificationRule(index, ruleIdx)}
                                                                        className="text-red-400 hover:text-red-300 transition-colors ml-2 flex-shrink-0"
                                                                        title="Remove rule"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Media & Review */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold mb-4">Media & Final Review</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Tournament Logo</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange('logo', e.target.files[0])}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Banner Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange('banner', e.target.files[0])}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Cover Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange('coverImage', e.target.files[0])}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-700 rounded-lg p-4 mt-6">
                                <h4 className="font-semibold mb-3">Tournament Summary</h4>
                                <div className="space-y-2 text-sm">
                                    <p><span className="text-gray-400">Name:</span> {formData.tournamentName}</p>
                                    <p><span className="text-gray-400">Game:</span> {formData.gameTitle}</p>
                                    <p><span className="text-gray-400">Region:</span> {formData.region}</p>
                                    <p><span className="text-gray-400">Slots:</span> {formData.slots.total} teams</p>
                                    <p><span className="text-gray-400">Prize Pool:</span> ₹{formData.prizePool.total.toLocaleString()}</p>
                                    <p><span className="text-gray-400">Phases:</span> {formData.phases.length}</p>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                                <p className="text-yellow-400 text-sm font-semibold">⚠️ Admin Approval Required</p>
                                <p className="text-gray-300 text-sm mt-1">
                                    Your tournament will be submitted for admin approval. Once approved, it will be visible to teams and you can start inviting participants.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-4 border-t border-gray-700">
                        <button
                            onClick={() => setStep(Math.max(1, step - 1))}
                            disabled={step === 1}
                            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>

                        {step < 3 ? (
                            <button
                                onClick={() => {
                                    if (step === 1) {
                                        if (!formData.tournamentName || formData.tournamentName.trim() === '') {
                                            toast.error('Tournament Name is required.');
                                            return;
                                        }
                                        const minS = gameConfig.minSlots;
                                        const maxS = gameConfig.maxSlots;
                                        if (!formData.slots.total || formData.slots.total < minS) {
                                            toast.error(`Total Slots must be at least ${minS}.`);
                                            return;
                                        }
                                        if (maxS && formData.slots.total > maxS) {
                                            toast.error(`${gameConfig.displayName} tournaments are limited to ${maxS} teams.`);
                                            return;
                                        }
                                    }
                                    setStep(step + 1);
                                }}
                                className="px-4 py-2 bg-orange-500 rounded hover:bg-orange-600"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={createTournamentMutation.isPending}
                                className="px-4 py-2 bg-green-500 rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                {createTournamentMutation.isPending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit for Approval'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateTournamentModal;
