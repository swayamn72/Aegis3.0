import React, { useState, useEffect } from 'react';
import { Calendar, Save, AlertCircle, Trash2, ChevronDown, ChevronUp, Share2, Key, Trophy, Upload, Image, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from '../../utils/axiosConfig';

const MatchManagement = ({ tournament, onUpdate }) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pendingChanges, setPendingChanges] = useState({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [expandedMatches, setExpandedMatches] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState('');
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [credentialsForm, setCredentialsForm] = useState({ roomId: '', roomPassword: '' });
    const [uploadingScreenshot, setUploadingScreenshot] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [expandedTeams, setExpandedTeams] = useState(new Set());

    useEffect(() => {
        fetchMatches();
    }, [tournament._id]);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/matches/tournament/${tournament._id}`);
            const matchesData = response.data;
            setMatches(Array.isArray(matchesData) ? matchesData : (matchesData.matches || []));
        } catch (err) {
            setError('Error connecting to server');
            console.error('Error fetching matches:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (matchId, teamId, field, value) => {
        const safeTeamId = teamId || 'unknown';
        const key = `${matchId}-${safeTeamId}-${field}`;

        setPendingChanges(prev => ({
            ...prev,
            [key]: value
        }));

        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (saving) return;

        try {
            setSaving(true);
            setError(null);

            const updatesByMatch = {};

            Object.keys(pendingChanges).forEach(key => {
                const parts = key.split('-');
                const matchId = parts[0];
                const teamId = parts[1];

                if (!updatesByMatch[matchId]) {
                    updatesByMatch[matchId] = {};
                }
                if (!updatesByMatch[matchId][teamId]) {
                    updatesByMatch[matchId][teamId] = { kills: null, position: null, playerKills: [] };
                }

                if (parts.length === 3) {
                    const field = parts[2];
                    if (field === 'kills') {
                        updatesByMatch[matchId][teamId].kills = parseInt(pendingChanges[key]) || 0;
                    } else if (field === 'position') {
                        updatesByMatch[matchId][teamId].position = parseInt(pendingChanges[key]) || null;
                    }
                } else if (parts.length === 4 && parts[2].startsWith('player') && parts[3] === 'kills') {
                    const playerIndex = parseInt(parts[2].replace('player', ''));
                    updatesByMatch[matchId][teamId].playerKills[playerIndex] = parseInt(pendingChanges[key]) || 0;
                }
            });

            const updatePromises = Object.keys(updatesByMatch).map(async (matchId) => {
                const match = matches.find(m => m._id === matchId);
                if (!match) return null;

                // Use results if available, otherwise teams
                const matchTeams = match.results && match.results.length > 0 ? match.results : (match.teams || []);

                const results = matchTeams.map(team => {
                    const actualTeamId = team.team?._id ? team.team._id.toString() : team.team?.toString() || team._id?.toString();
                    const teamUpdates = updatesByMatch[matchId][actualTeamId];

                    const currentKills = team.kills?.total || 0;
                    const currentPosition = team.finalPosition || null;

                    const kills = teamUpdates?.kills !== null && teamUpdates?.kills !== undefined ? teamUpdates.kills : currentKills;
                    const position = teamUpdates?.position !== null && teamUpdates?.position !== undefined ? teamUpdates.position : currentPosition;

                    // Build player kills array (4 players)
                    const playerKills = [0, 1, 2, 3].map(playerIndex => {
                        if (teamUpdates?.playerKills && teamUpdates.playerKills[playerIndex] !== undefined) {
                            return teamUpdates.playerKills[playerIndex];
                        }
                        return team.kills?.breakdown?.[playerIndex]?.kills || 0;
                    });

                    return {
                        teamId: actualTeamId,
                        position: position,
                        kills: kills,
                        playerKills: playerKills
                    };
                });

                const response = await axios.put(`/api/matches/${matchId}/results`, { results });
                const updatedMatch = response.data;
                return {
                    matchId,
                    updatedMatch: {
                        ...updatedMatch,
                        results: updatedMatch.results?.map(team => ({
                            ...team,
                            team: team.team || team
                        })) || [],
                        teams: updatedMatch.teams || []
                    }
                };
            });

            const results = await Promise.all(updatePromises);

            const updatedMatches = [...matches];
            results.forEach(result => {
                if (result) {
                    const index = updatedMatches.findIndex(m => m._id === result.matchId);
                    if (index !== -1) {
                        updatedMatches[index] = result.updatedMatch;
                    }
                }
            });

            setMatches(updatedMatches);
            setPendingChanges({});
            setHasUnsavedChanges(false);
            toast.success('Match results saved successfully');

            if (onUpdate) onUpdate();
        } catch (err) {
            setError(`Error saving changes: ${err.message}`);
            toast.error('Failed to save changes');
            console.error('Error saving changes:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleShareCredentials = async () => {
        if (!selectedMatch || !credentialsForm.roomId.trim() || !credentialsForm.roomPassword.trim()) {
            toast.error('Please fill in both room ID and password');
            return;
        }

        try {
            const response = await axios.post(`/api/matches/${selectedMatch._id}/share-credentials`, {
                roomId: credentialsForm.roomId,
                password: credentialsForm.roomPassword
            });
            const updatedMatch = response.data;
            setMatches(matches.map(match =>
                match._id === selectedMatch._id ? updatedMatch : match
            ));
            toast.success('Room credentials shared successfully');
            setShowCredentialsModal(false);
            setSelectedMatch(null);
            setCredentialsForm({ roomId: '', roomPassword: '' });
        } catch (error) {
            console.error('Error sharing credentials:', error);
            toast.error('Failed to share credentials');
        }
    };

    const handleDeleteMatch = async (matchId) => {
        if (!window.confirm('Are you sure you want to delete this match?')) return;

        try {
            await axios.delete(`/api/matches/${matchId}`);
            setMatches(matches.filter(match => match._id !== matchId));
            toast.success('Match deleted successfully');
        } catch (err) {
            toast.error('Error deleting match');
            console.error('Error deleting match:', err);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size should be less than 5MB');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUploadScreenshot = async () => {
        if (!selectedFile || !selectedMatch) {
            toast.error('Please select a file');
            return;
        }

        try {
            setUploadingScreenshot(selectedMatch._id);

            const formData = new FormData();
            formData.append('screenshot', selectedFile);

            const response = await axios.post(
                `/api/org-tournaments/matches/${selectedMatch._id}/upload-result`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            // Update the match in the list
            setMatches(matches.map(match =>
                match._id === selectedMatch._id ? response.data.match : match
            ));

            toast.success('Match results processed successfully! ' + (response.data.note || ''));
            setShowUploadModal(false);
            setSelectedMatch(null);
            setSelectedFile(null);
            setPreviewUrl(null);

            // Refresh matches to get updated data
            await fetchMatches();

            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Error uploading screenshot:', err);
            toast.error(err.response?.data?.error || 'Failed to upload screenshot');
        } finally {
            setUploadingScreenshot(null);
        }
    };

    const openUploadModal = (match) => {
        setSelectedMatch(match);
        setShowUploadModal(true);
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const closeUploadModal = () => {
        setShowUploadModal(false);
        setSelectedMatch(null);
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
    };

    const toggleMatchExpansion = (matchId) => {
        setExpandedMatches(prev => {
            const newSet = new Set(prev);
            if (newSet.has(matchId)) {
                newSet.delete(matchId);
            } else {
                newSet.add(matchId);
            }
            return newSet;
        });
    };

    const toggleTeamExpansion = (teamKey) => {
        setExpandedTeams(prev => {
            const newSet = new Set(prev);
            if (newSet.has(teamKey)) {
                newSet.delete(teamKey);
            } else {
                newSet.add(teamKey);
            }
            return newSet;
        });
    };

    const getPlacementPoints = (position) => {
        const pointsMap = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
        return pointsMap[position] || 0;
    };

    const availablePhases = tournament.phases?.map(p => p.name) || [];
    const filteredMatches = selectedPhase
        ? matches.filter(m => m.tournamentPhase === selectedPhase)
        : matches;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-white">Loading matches...</div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-white">Match Results</h3>
                    <p className="text-gray-400 text-sm mt-1">Enter kills and positions for each team</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedPhase}
                        onChange={(e) => setSelectedPhase(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                        <option value="">All Phases</option>
                        {availablePhases.map((phase, idx) => (
                            <option key={idx} value={phase}>{phase}</option>
                        ))}
                    </select>
                </div>
            </div>

            {tournament.status === 'completed' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center gap-3 mb-6">
                    <Trophy className="w-5 h-5 text-blue-400" />
                    <div>
                        <p className="text-blue-400 font-medium">Tournament Completed</p>
                        <p className="text-blue-500/70 text-sm">This tournament is concluded. Results are locked and can no longer be edited.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-2 mb-6">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400">{error}</span>
                </div>
            )}

            {hasUnsavedChanges && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                        <span className="text-orange-400">You have unsaved changes</span>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || tournament.status === 'completed'}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save All Changes
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {filteredMatches.length > 0 ? (
                    filteredMatches.map(match => (
                        <div key={match._id} className="bg-gray-800/50 rounded-xl border border-gray-700">
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <button
                                        onClick={() => toggleMatchExpansion(match._id)}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                    >
                                        {expandedMatches.has(match._id) ? (
                                            <ChevronUp className="w-5 h-5" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5" />
                                        )}
                                    </button>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-white font-medium">Match #{match.matchNumber}</h4>
                                            <span className="text-gray-400 text-sm">•</span>
                                            <span className="text-gray-400 text-sm">{match.tournamentPhase}</span>
                                            <span className="text-gray-400 text-sm">•</span>
                                            <span className="text-gray-400 text-sm">{match.map}</span>
                                        </div>
                                        <p className="text-gray-500 text-sm">
                                            {new Date(match.scheduledStartTime).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${match.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                                        match.status === 'in_progress' ? 'bg-green-500/20 text-green-400' :
                                            match.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                                                'bg-red-500/20 text-red-400'
                                        }`}>
                                        {(match.status || 'unknown').replace('_', ' ')}
                                    </span>
                                    <button
                                        onClick={() => openUploadModal(match)}
                                        disabled={uploadingScreenshot === match._id || tournament.status === 'completed'}
                                        className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Upload match result screenshot"
                                    >
                                        {uploadingScreenshot === match._id ? (
                                            <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedMatch(match);
                                            setShowCredentialsModal(true);
                                        }}
                                        disabled={tournament.status === 'completed'}
                                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                                        title="Share room credentials"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        <span>Share Room Credentials</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteMatch(match._id)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete match"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {match.roomCredentials && (
                                <div className="px-4 pb-4">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Key className="w-4 h-4 text-blue-400" />
                                            <span className="text-blue-400 font-medium text-sm">Room Credentials</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <span className="text-gray-400">ID:</span>
                                                <span className="text-white ml-2 font-mono">{match.roomCredentials.roomId}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Password:</span>
                                                <span className="text-white ml-2 font-mono">{match.roomCredentials.password}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {match.metadata?.ocrProcessed && (
                                <div className="px-4 pb-4">
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <Image className="w-4 h-4 text-green-400" />
                                            <span className="text-green-400 font-medium text-sm">Results Processed</span>
                                            <span className="text-gray-500 text-xs ml-auto">
                                                {new Date(match.metadata.ocrProcessedAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {expandedMatches.has(match._id) && (
                                <div className="border-t border-gray-700 p-4">
                                    <div className="space-y-3">
                                        {(() => {
                                            // Use results if available, otherwise use teams array
                                            const matchTeams = match.results && match.results.length > 0
                                                ? match.results
                                                : (match.teams || []);

                                            return matchTeams && matchTeams.length > 0 ? (
                                                matchTeams.map((teamEntry, index) => {
                                                    const teamData = teamEntry.team || teamEntry;
                                                    const teamId = teamData._id || teamData.id;
                                                    const teamName = teamData.teamName || teamData.name || 'Unknown Team';

                                                    // Ensure nested structures exist for display
                                                    if (!teamEntry.points) teamEntry.points = { placementPoints: 0, killPoints: 0, totalPoints: 0 };
                                                    if (!teamEntry.kills) teamEntry.kills = { total: 0, breakdown: [] };

                                                    const teamKey = `${match._id}-${teamId}`;

                                                    const killsKey = `${match._id}-${teamId}-kills`;
                                                    const positionKey = `${match._id}-${teamId}-position`;

                                                    const currentKills = pendingChanges[killsKey] !== undefined ? pendingChanges[killsKey] : (teamEntry.kills?.total || 0);
                                                    const currentPosition = pendingChanges[positionKey] !== undefined ? pendingChanges[positionKey] : (teamEntry.finalPosition || '');
                                                    const currentPoints = teamEntry.points?.totalPoints || 0;

                                                    return (
                                                        <div key={teamId || index} className="bg-gray-700/50 rounded-lg overflow-hidden">
                                                            {/* Team Header Row */}
                                                            <div className="flex items-center gap-3 p-3">
                                                                <button
                                                                    onClick={() => toggleTeamExpansion(teamKey)}
                                                                    className="p-1 text-gray-400 hover:text-white transition-colors"
                                                                >
                                                                    {expandedTeams.has(teamKey) ? (
                                                                        <ChevronUp className="w-4 h-4" />
                                                                    ) : (
                                                                        <ChevronDown className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-white font-medium truncate block">{teamName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-gray-400 text-sm">Kills:</label>
                                                                    <input
                                                                        type="number"
                                                                        value={currentKills}
                                                                        onChange={(e) => handleInputChange(match._id, teamId, 'kills', parseInt(e.target.value) || 0)}
                                                                        disabled={tournament.status === 'completed'}
                                                                        className="w-16 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40"
                                                                        min="0"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-gray-400 text-sm">Position:</label>
                                                                    <input
                                                                        type="number"
                                                                        value={currentPosition}
                                                                        onChange={(e) => handleInputChange(match._id, teamId, 'position', parseInt(e.target.value) || '')}
                                                                        disabled={tournament.status === 'completed'}
                                                                        className="w-16 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40"
                                                                        min="1"
                                                                        max="25"
                                                                        placeholder="1-25"
                                                                    />
                                                                </div>
                                                                <div className="w-20 text-center">
                                                                    <span className="text-orange-400 font-medium text-sm">{currentPoints} pts</span>
                                                                </div>
                                                                {teamEntry.chickenDinner && (
                                                                    <Trophy className="w-5 h-5 text-yellow-400" />
                                                                )}
                                                            </div>

                                                            {/* Player Breakdown (Expandable) */}
                                                            {expandedTeams.has(teamKey) && (
                                                                <div className="border-t border-gray-600 bg-gray-800/50 p-3">
                                                                    <p className="text-xs text-gray-400 mb-2 font-medium">Player Breakdown:</p>
                                                                    <div className="space-y-2">
                                                                        {[0, 1, 2, 3].map((playerIndex) => {
                                                                            const playerData = teamEntry.kills?.breakdown?.[playerIndex];
                                                                            const playerName = playerData?.player?.username ||
                                                                                playerData?.player?.name ||
                                                                                `Player ${playerIndex + 1}`;
                                                                            const playerKills = playerData?.kills || 0;
                                                                            const playerKillsKey = `${match._id}-${teamId}-player${playerIndex}-kills`;
                                                                            const currentPlayerKills = pendingChanges[playerKillsKey] !== undefined
                                                                                ? pendingChanges[playerKillsKey]
                                                                                : playerKills;

                                                                            return (
                                                                                <div key={playerIndex} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <span className="text-sm text-gray-300">{playerName}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <label className="text-gray-500 text-xs">Kills:</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            value={currentPlayerKills}
                                                                                            onChange={(e) => {
                                                                                                const value = parseInt(e.target.value) || 0;
                                                                                                handleInputChange(match._id, teamId, `player${playerIndex}-kills`, value);
                                                                                            }}
                                                                                            disabled={tournament.status === 'completed'}
                                                                                            className="w-14 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-center text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40"
                                                                                            min="0"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-8">
                                                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                                    <p className="text-gray-400 text-sm">No teams in this match</p>
                                                    <p className="text-gray-500 text-xs mt-1">Teams are assigned when scheduling matches</p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12">
                        <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No matches found</p>
                    </div>
                )}
            </div>

            {/* Credentials Modal */}
            {showCredentialsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Share Room Credentials</h3>
                        <p className="text-gray-400 mb-4 text-sm">
                            Share credentials for Match #{selectedMatch?.matchNumber}
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Room ID</label>
                                <input
                                    type="text"
                                    value={credentialsForm.roomId}
                                    onChange={(e) => setCredentialsForm({ ...credentialsForm, roomId: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Enter room ID"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Room Password</label>
                                <input
                                    type="text"
                                    value={credentialsForm.roomPassword}
                                    onChange={(e) => setCredentialsForm({ ...credentialsForm, roomPassword: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Enter room password"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowCredentialsModal(false);
                                    setSelectedMatch(null);
                                    setCredentialsForm({ roomId: '', roomPassword: '' });
                                }}
                                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleShareCredentials}
                                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                                Share
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Screenshot Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-xl max-w-2xl w-full p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Upload Match Result Screenshot</h3>
                        <p className="text-gray-400 mb-4 text-sm">
                            Upload a screenshot to process match results for Match #{selectedMatch?.matchNumber}
                            <br />
                            <span className="text-orange-400 text-xs">⚠️ OCR is being fine-tuned. Currently using simulated data for demonstration.</span>
                            <br />
                            <span className="text-gray-500 text-xs">Screenshot will be processed but not stored.</span>
                        </p>

                        <div className="space-y-4">
                            {/* File Input Area */}
                            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-orange-500 transition-colors">
                                <input
                                    type="file"
                                    id="screenshot-upload"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="screenshot-upload"
                                    className="cursor-pointer flex flex-col items-center"
                                >
                                    <Image className="w-12 h-12 text-gray-500 mb-3" />
                                    <span className="text-white font-medium mb-1">
                                        {selectedFile ? selectedFile.name : 'Click to select a screenshot'}
                                    </span>
                                    <span className="text-gray-500 text-sm">
                                        PNG, JPG up to 5MB
                                    </span>
                                </label>
                            </div>

                            {/* Preview */}
                            {previewUrl && (
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <p className="text-white font-medium mb-2">Preview:</p>
                                    <img
                                        src={previewUrl}
                                        alt="Screenshot preview"
                                        className="w-full h-auto max-h-96 object-contain rounded-lg"
                                    />
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-blue-400 text-xs">
                                        <p className="font-medium mb-1">How it works:</p>
                                        <ul className="list-disc list-inside space-y-1 text-blue-300">
                                            <li>Upload a clear screenshot of match results</li>
                                            <li>System will process and extract team positions and kills</li>
                                            <li>Points will be automatically calculated and assigned</li>
                                            <li>Review and confirm the results before finalizing</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={closeUploadModal}
                                disabled={uploadingScreenshot === selectedMatch?._id}
                                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadScreenshot}
                                disabled={!selectedFile || uploadingScreenshot === selectedMatch?._id}
                                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {uploadingScreenshot === selectedMatch?._id ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Upload & Process
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatchManagement;