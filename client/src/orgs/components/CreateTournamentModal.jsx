import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '../../utils/axiosConfig';

const CreateTournamentModal = ({ organization, onClose, onSuccess }) => {
    const IndiaFlag = () => <span role="img" aria-label="India" className="ml-2">🇮🇳</span>;
    const [step, setStep] = useState(1);
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
            toast.error('Error creating tournament: ' + (error.message || error.error));
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
            groups: []
        };
        setFormData(prev => ({
            ...prev,
            phases: [...prev.phases, newPhase]
        }));
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

    const handleSubmit = async () => {
        try {
            if (!formData.tournamentName || formData.tournamentName.trim() === '') {
                toast.error('Tournament Name is required.');
                return;
            }
            const formDataToSend = new FormData();
            formDataToSend.append('tournamentData', JSON.stringify(formData));

            if (files.logo) formDataToSend.append('logo', files.logo);
            if (files.banner) formDataToSend.append('banner', files.banner);
            if (files.coverImage) formDataToSend.append('coverImage', files.coverImage);

            await createTournamentMutation.mutateAsync(formDataToSend);
        } catch (error) {
            // Error already handled in mutation
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
                                    <label className="block text-sm font-medium mb-2">Total Slots *</label>
                                    <input
                                        type="number"
                                        value={formData.slots.total}
                                        onChange={(e) => handleNestedChange('slots', 'total', parseInt(e.target.value))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                        min="2"
                                    />
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
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={formData.isOpenForAll || false}
                                    onChange={(e) => handleInputChange('isOpenForAll', e.target.checked)}
                                    className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                                />
                                <label className="text-sm font-medium text-gray-300">
                                    Is this tournament open for all?
                                </label>
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
                                    onChange={(e) => handleNestedChange('prizePool', 'total', parseInt(e.target.value))}
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

                            {formData.phases.length === 0 ? (
                                <div className="bg-gray-700 rounded-lg p-8 text-center">
                                    <p className="text-gray-400">No phases added yet. Click "Add Phase" to create tournament stages.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.phases.map((phase, index) => (
                                        <div key={index} className="bg-gray-700 rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-semibold">Phase {index + 1}</h4>
                                                <button
                                                    onClick={() => removePhase(index)}
                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-sm mb-1">Phase Name</label>
                                                    <input
                                                        type="text"
                                                        value={phase.name}
                                                        onChange={(e) => updatePhase(index, 'name', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm mb-1">Type</label>
                                                    <select
                                                        value={phase.type}
                                                        onChange={(e) => updatePhase(index, 'type', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                                                    >
                                                        <option value="qualifiers">Qualifiers</option>
                                                        <option value="final_stage">Final Stage</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm mb-1">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={phase.startDate}
                                                        onChange={(e) => updatePhase(index, 'startDate', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm mb-1">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={phase.endDate}
                                                        onChange={(e) => updatePhase(index, 'endDate', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="block text-sm mb-1">Details (e.g., "Top 8 teams qualify")</label>
                                                    <input
                                                        type="text"
                                                        value={phase.details}
                                                        onChange={(e) => updatePhase(index, 'details', e.target.value)}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                                                        placeholder="Top 8 teams advance to next round"
                                                    />
                                                </div>
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
                                onClick={() => setStep(step + 1)}
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
