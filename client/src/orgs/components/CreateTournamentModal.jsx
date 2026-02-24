import React, { useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';
import PhaseStructureSuggester from './PhaseStructureSuggester';

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
        gameSettings: {
            serverRegion: 'India',
            gameMode: 'TPP Squad',
            maps: ['Erangel', 'Miramar'],
            pointsSystem: {
                killPoints: 1,
                placementPoints: { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 }
            }
        }
    });
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
            const formDataToSend = new FormData();
            console.log('Sending tournament data:', formData);
            formDataToSend.append('tournamentData', JSON.stringify(formData));


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
                                        placeholder="BGMI Winter Championship 2024"
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
                                    <input
                                        type="text"
                                        value="BGMI"
                                        disabled
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white opacity-70 cursor-not-allowed"
                                    />
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
                                    <label className="block text-sm font-medium mb-2">Total Slots * <span className="text-gray-400 font-normal text-xs">(min 16, e.g. 64, 128, 4096)</span></label>
                                    <input
                                        type="number"
                                        value={formData.slots.total}
                                        onChange={(e) => handleNestedChange('slots', 'total', parseInt(e.target.value) || 16)}
                                        className={`w-full bg-gray-700 border rounded px-3 py-2 text-white ${formData.slots.total < 16 ? 'border-red-500' : 'border-gray-600'
                                            }`}
                                        min="16"
                                    />
                                    {formData.slots.total < 16 && (
                                        <p className="text-red-400 text-xs mt-1">Minimum 16 teams required.</p>
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
                                                        <option value="qualifiers">Qualifiers</option>
                                                        <option value="final_stage">Final Stage</option>
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
                                        if (!formData.slots.total || formData.slots.total < 16) {
                                            toast.error('Total Slots must be at least 16.');
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
