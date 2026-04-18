import React, { useState, useEffect } from 'react';
import { Calendar, Save, AlertCircle, Trash2, ChevronDown, ChevronUp, Share2, Key, Trophy, Upload, Image, Users, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [expandedTeams, setExpandedTeams] = useState(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalMatches, setTotalMatches] = useState(0);
    // OCR state
    const [ocrStep, setOcrStep] = useState(1);          // 1 = upload, 2 = review
    const [ocrResults, setOcrResults] = useState([]);   // rows returned by server
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [applyingOcr, setApplyingOcr] = useState(false);
    const MATCHES_PER_PAGE = 10;

    // Helper to resolve group names from IDs
    const getGroupName = (groupId) => {
        if (!groupId) return '';
        if (groupId.length < 20) return groupId; // Already a name or short string

        for (const phase of tournament.phases || []) {
            const group = phase.groups?.find(g => g._id === groupId || g.id === groupId);
            if (group) return group.name;
        }
        return `Group ${groupId.substring(0, 4)}...`; // Fallback
    };

    useEffect(() => {
        setCurrentPage(1);
        fetchMatches(1);
    }, [tournament._id, selectedPhase]);

    const fetchMatches = async (page = currentPage) => {
        try {
            setLoading(true);
            const offset = (page - 1) * MATCHES_PER_PAGE;
            const response = await axios.get(`/api/matches/tournament/${tournament._id}`, {
                params: {
                    limit: MATCHES_PER_PAGE,
                    offset: offset,
                    phase: selectedPhase || undefined
                }
            });

            const data = response.data;
            if (data.matches) {
                setMatches(data.matches);
                setTotalMatches(data.pagination?.total || 0);
            } else {
                // Fallback for older API versions
                const matchesList = Array.isArray(data) ? data : [];
                setMatches(matchesList);
                setTotalMatches(matchesList.length);
            }
        } catch (err) {
            setError('Error connecting to server');
            console.error('Error fetching matches:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        fetchMatches(newPage);
        // Scroll to top of match list
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const handleDeleteMatch = (matchId) => {
        setMatchToDelete(matchId);
        setShowDeleteModal(true);
    };

    const confirmDeleteMatch = async () => {
        if (!matchToDelete) return;

        try {
            setIsDeleting(true);
            await axios.delete(`/api/matches/${matchToDelete}`);

            // If we're on a page that will become empty after deletion, go back one page
            const isLastOnPage = matches.length === 1 && currentPage > 1;
            const pageToFetch = isLastOnPage ? currentPage - 1 : currentPage;

            if (isLastOnPage) setCurrentPage(pageToFetch);
            fetchMatches(pageToFetch);

            toast.success('Match deleted successfully');
            setShowDeleteModal(false);
            setMatchToDelete(null);
        } catch (err) {
            toast.error('Error deleting match');
            console.error('Error deleting match:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (files.length > 12) {
            toast.error('You can upload up to 12 screenshots at a time');
            return;
        }

        const validFiles = [];
        const newPreviewUrls = [];

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                toast.error(`${file.name} is not an image file`);
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error(`${file.name} is too large (max 5MB)`);
                continue;
            }
            validFiles.push(file);
            newPreviewUrls.push(URL.createObjectURL(file));
        }

        if (validFiles.length > 0) {
            setSelectedFiles(validFiles.slice(0, 12));
            setPreviewUrls(newPreviewUrls.slice(0, 12));
        }
    };

    // ── OCR upload: send image to server and get editable results ──
    const handleUploadScreenshot = async () => {
        if (selectedFiles.length === 0 || !selectedMatch) {
            toast.error('Please select at least one screenshot first');
            return;
        }
        try {
            setOcrProcessing(true);
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('screenshots', file);
            });

            const response = await axios.post(
                `/api/matches/${selectedMatch._id}/upload-result`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            // Initialise editable rows from server response
            setOcrResults(
                response.data.ocrResults.map(r => ({
                    ...r,
                    // Make editable copies of numeric fields
                    position: r.position ?? '',
                    kills: r.kills ?? 0,
                }))
            );
            setOcrStep(2);
        } catch (err) {
            const msg = err.response?.data?.error || 'OCR processing failed. Try a clearer screenshot.';
            const hint = err.response?.data?.hint || '';
            toast.error(hint ? `${msg} ${hint}` : msg);
        } finally {
            setOcrProcessing(false);
        }
    };

    // ── OCR confirm: apply (possibly-edited) rows via existing results endpoint ──
    const handleApplyOcrResults = async () => {
        if (!selectedMatch || ocrResults.length === 0) return;
        try {
            setApplyingOcr(true);

            const results = ocrResults.map(r => ({
                teamId: r.teamId,
                position: parseInt(r.position) || null,
                kills: parseInt(r.kills) || 0,
                unmatchedKills: r.unmatchedKills || 0,
                // Send full breakdown with isPlaying flags
                playerBreakdown: (r.playerBreakdown || []).map(bd => ({
                    player: bd.player,
                    kills: bd.kills || 0,
                    isPlaying: bd.isPlaying !== undefined ? bd.isPlaying : true,
                })),
                // Also send simple array as fallback
                playerKills: r.playerKills || [],
            }));

            const response = await axios.put(
                `/api/matches/${selectedMatch._id}/results`,
                { results }
            );

            setMatches(prev => prev.map(m => m._id === selectedMatch._id ? response.data : m));
            toast.success('Match results applied successfully!');
            closeUploadModal();
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to apply results');
        } finally {
            setApplyingOcr(false);
        }
    };


    const openUploadModal = (match) => {
        setSelectedMatch(match);
        setShowUploadModal(true);
        setSelectedFile(null);
        setPreviewUrl(null);
        setOcrStep(1);
        setOcrResults([]);
    };

    const closeUploadModal = () => {
        if (ocrProcessing || applyingOcr) return; // prevent close during async ops
        setShowUploadModal(false);
        setSelectedMatch(null);
        setSelectedFile(null);
        setOcrStep(1);
        setOcrResults([]);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
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
    const totalPages = Math.ceil(totalMatches / MATCHES_PER_PAGE);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-white">Loading matches...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
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
                {matches.length > 0 ? (
                    matches.map(match => (
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
                                            {match.participatingGroups && match.participatingGroups.length > 0 && (
                                                <>
                                                    <span className="text-gray-400 text-sm">•</span>
                                                    <span className="text-orange-400 text-sm">
                                                        {match.participatingGroups.length === 1 
                                                            ? (() => {
                                                                const name = getGroupName(match.participatingGroups[0]);
                                                                return name.startsWith('Group') ? name : `Group ${name}`;
                                                              })()
                                                            : `Groups: ${match.participatingGroups.map(id => getGroupName(id)).join(', ')}`
                                                        }
                                                    </span>
                                                </>
                                            )}
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
                                        disabled={tournament.status === 'completed'}
                                        className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Upload & OCR match result screenshot"
                                    >
                                        <Upload className="w-4 h-4" />
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
                                                                            let playerName = `Player ${playerIndex + 1}`;
                                                                            let secondaryName = '';
                                                                            
                                                                            let p = playerData?.player;
                                                                            if (!p && teamEntry.roster && teamEntry.roster[playerIndex]) {
                                                                                p = teamEntry.roster[playerIndex].player;
                                                                            }

                                                                            if (p) {
                                                                                const gameIds = p.gameIds || [];
                                                                                if (gameIds.length > 0) {
                                                                                    playerName = gameIds[0].inGameName;
                                                                                    if (gameIds.length > 1) {
                                                                                        secondaryName = ` (alt: ${gameIds[1].inGameName})`;
                                                                                    }
                                                                                } else {
                                                                                    playerName = p.inGameName || p.username || playerName;
                                                                                }
                                                                            }
                                                                            const playerKills = playerData?.kills || 0;
                                                                            const playerKillsKey = `${match._id}-${teamId}-player${playerIndex}-kills`;
                                                                            const currentPlayerKills = pendingChanges[playerKillsKey] !== undefined
                                                                                ? pendingChanges[playerKillsKey]
                                                                                : playerKills;

                                                                            return (
                                                                                <div key={playerIndex} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <span className="text-sm text-gray-300">
                                                                                            {playerName}
                                                                                            {secondaryName && <span className="text-xs text-gray-500 ml-1">{secondaryName}</span>}
                                                                                        </span>
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-all duration-300">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h3 className="text-2xl font-bold text-white mb-2">Share Room Credentials</h3>
                        <p className="text-gray-400 mb-8 text-sm">
                            The following credentials will be shared with all teams participating in <span className="text-white font-medium">Match #{selectedMatch?.matchNumber}</span>.
                        </p>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Room ID</label>
                                <input
                                    type="text"
                                    value={credentialsForm.roomId}
                                    onChange={(e) => setCredentialsForm({ ...credentialsForm, roomId: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-lg font-mono tracking-wider"
                                    placeholder="Enter room ID"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Room Password</label>
                                <input
                                    type="text"
                                    value={credentialsForm.roomPassword}
                                    onChange={(e) => setCredentialsForm({ ...credentialsForm, roomPassword: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-lg font-mono tracking-wider"
                                    placeholder="Enter room password"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => {
                                    setShowCredentialsModal(false);
                                    setSelectedMatch(null);
                                    setCredentialsForm({ roomId: '', roomPassword: '' });
                                }}
                                className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleShareCredentials}
                                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all font-bold shadow-lg shadow-blue-500/20"
                            >
                                Share Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700">
                    <div className="text-sm text-gray-400">
                        Showing <span className="text-white font-medium">{(currentPage - 1) * MATCHES_PER_PAGE + 1}</span> to{' '}
                        <span className="text-white font-medium">
                            {Math.min(currentPage * MATCHES_PER_PAGE, totalMatches)}
                        </span> of{' '}
                        <span className="text-white font-medium">{totalMatches}</span> matches
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => handlePageChange(i + 1)}
                                className={`w-10 h-10 rounded-lg border transition-all font-medium ${currentPage === i + 1
                                    ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                                    : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-white'
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Screenshot Modal — 2-step OCR flow */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-8 shadow-2xl overflow-y-auto max-h-[90vh]">

                        {/* ── Step header ── */}
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold text-white">
                                {ocrStep === 1 ? 'Upload Result Screenshot' : 'Review OCR Results'}
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">Match #{selectedMatch?.matchNumber}</span>
                                <div className="flex gap-1">
                                    <span className={`w-2 h-2 rounded-full ${ocrStep >= 1 ? 'bg-orange-500' : 'bg-gray-600'}`} />
                                    <span className={`w-2 h-2 rounded-full ${ocrStep >= 2 ? 'bg-orange-500' : 'bg-gray-600'}`} />
                                </div>
                            </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-6">
                            {ocrStep === 1
                                ? 'Upload a clear BGMI results screenshot. The slot list is loaded automatically from the tournament.'
                                : 'Review the detected data. Edit any incorrect values before applying.'}
                        </p>

                        {/* ════ STEP 1: File picker ════ */}
                        {ocrStep === 1 && (
                            <div className="space-y-4">
                                <div
                                    className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-orange-500 transition-colors cursor-pointer"
                                    onClick={() => document.getElementById('screenshot-upload').click()}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const files = Array.from(e.dataTransfer.files || []);
                                        if (files.length > 0) {
                                            const ev = { target: { files: files } };
                                            handleFileSelect(ev);
                                        }
                                    }}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        id="screenshot-upload"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <Image className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                                    <p className="text-white font-medium mb-1">
                                        {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Click or drag to upload screenshots (up to 12)'}
                                    </p>
                                    <p className="text-gray-500 text-sm">JPEG · PNG · WebP · up to 5 MB each</p>
                                </div>

                                {previewUrls.length > 0 && (
                                    <div className="bg-gray-800 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-white text-sm font-medium">Preview ({previewUrls.length}/12)</p>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFiles([]);
                                                    setPreviewUrls([]);
                                                }}
                                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {previewUrls.map((url, i) => (
                                                <div key={i} className="relative group aspect-[4/3]">
                                                    <img
                                                        src={url}
                                                        alt={`Preview ${i + 1}`}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                    <div className="flex items-start gap-2 text-blue-300 text-xs">
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
                                        <div>
                                            <p className="font-medium text-blue-400 mb-1">How OCR works</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                <li>Upload a clear end-of-match result screenshot</li>
                                                <li>Slot list is auto-loaded from the tournament phase groups</li>
                                                <li>AWS Rekognition reads positions, player names &amp; kills</li>
                                                <li>Review and edit results before applying</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => { setShowUploadModal(false); setSelectedFiles([]); setPreviewUrls([]); }}
                                        className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUploadScreenshot}
                                        disabled={selectedFiles.length === 0 || ocrProcessing}
                                        className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                                    >
                                        {ocrProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Processing…
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5" />
                                                Run OCR
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ════ STEP 2: Editable results table ════ */}
                        {ocrStep === 2 && (
                            <div className="space-y-4">
                                <div className="overflow-x-auto rounded-xl border border-gray-700">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                                                <th className="px-4 py-3 text-left">Team</th>
                                                <th className="px-4 py-3 text-center">Position</th>
                                                <th className="px-4 py-3 text-center">Kills</th>
                                                <th className="px-4 py-3 text-center">Pos Pts</th>
                                                <th className="px-4 py-3 text-center">Kill Pts</th>
                                                <th className="px-4 py-3 text-center">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {ocrResults.map((row, idx) => {
                                                const POSITION_POINTS = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
                                                const pos = parseInt(row.position) || null;
                                                const kills = parseInt(row.kills) || 0;
                                                const posPts = POSITION_POINTS[pos] || 0;
                                                const total = posPts + kills;
                                                const breakdown = row.playerBreakdown || [];
                                                const playingPlayers = breakdown.filter(bd => bd.isPlaying && bd.player);
                                                const unmatchedPlayers = breakdown.filter(bd => !bd.player);

                                                return (
                                                    <React.Fragment key={row.teamId}>
                                                        <tr className="bg-gray-800/40 hover:bg-gray-700/40 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <p className="text-white font-medium">{row.teamName}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${playingPlayers.length > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-500'}`}>
                                                                        {playingPlayers.length} matched
                                                                    </span>
                                                                    {(row.unmatchedKills || 0) > 0 && (
                                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                                                            +{row.unmatchedKills} unmatched kills
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    value={row.position}
                                                                    min="1" max="25"
                                                                    onChange={e => setOcrResults(prev => prev.map((r, i) => i === idx ? { ...r, position: e.target.value } : r))}
                                                                    className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mx-auto block"
                                                                    placeholder="1-25"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    value={row.kills}
                                                                    min="0"
                                                                    onChange={e => setOcrResults(prev => prev.map((r, i) => i === idx ? { ...r, kills: e.target.value } : r))}
                                                                    className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mx-auto block"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-blue-400 font-medium">{posPts}</td>
                                                            <td className="px-4 py-3 text-center text-green-400 font-medium">{kills}</td>
                                                            <td className="px-4 py-3 text-center text-orange-400 font-bold">{total}</td>
                                                        </tr>
                                                        {/* Player-level breakdown rows */}
                                                        {breakdown.length > 0 && (
                                                            <tr className="bg-gray-900/30">
                                                                <td colSpan="6" className="px-4 py-2">
                                                                    <div className="space-y-1.5">
                                                                        {breakdown.map((bd, bIdx) => {
                                                                            const scoreColor = bd.matchScore >= 80
                                                                                ? 'text-green-400 bg-green-500/15 border-green-500/30'
                                                                                : bd.matchScore >= 65
                                                                                    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                                                                                    : 'text-red-400 bg-red-500/15 border-red-500/30';
                                                                            return (
                                                                                <div key={bIdx} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-gray-800/50">
                                                                                    {/* isPlaying toggle */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOcrResults(prev => prev.map((r, rIdx) => {
                                                                                                if (rIdx !== idx) return r;
                                                                                                const newBreakdown = [...(r.playerBreakdown || [])];
                                                                                                newBreakdown[bIdx] = { ...newBreakdown[bIdx], isPlaying: !newBreakdown[bIdx].isPlaying };
                                                                                                return { ...r, playerBreakdown: newBreakdown };
                                                                                            }));
                                                                                        }}
                                                                                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${bd.isPlaying ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-gray-700 border-gray-600 text-gray-500'}`}
                                                                                        title={bd.isPlaying ? 'Playing — click to mark as not playing' : 'Not playing — click to mark as playing'}
                                                                                    >
                                                                                        {bd.isPlaying ? '✓' : '✕'}
                                                                                    </button>

                                                                                    {/* OCR detected name */}
                                                                                    <span className="text-gray-400 min-w-0 truncate max-w-[120px]" title={bd.detectedName || '—'}>
                                                                                        {bd.detectedName || '(not detected)'}
                                                                                    </span>

                                                                                    {/* Match confidence badge */}
                                                                                    {bd.detectedName && (
                                                                                        <>
                                                                                            <span className="text-gray-600">→</span>
                                                                                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${scoreColor}`}>
                                                                                                {bd.matchScore}%
                                                                                            </span>
                                                                                        </>
                                                                                    )}

                                                                                    {/* Player status */}
                                                                                    {bd.player ? (
                                                                                        <span className="text-gray-300 truncate max-w-[100px]" title="Matched roster player">
                                                                                            ✓ Roster
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-gray-500 italic">unmatched</span>
                                                                                    )}

                                                                                    {/* Kills */}
                                                                                    <span className="ml-auto text-gray-300 font-medium">
                                                                                        {bd.kills} kill{bd.kills !== 1 ? 's' : ''}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {ocrResults.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        No team data detected. Go back and try a different screenshot.
                                    </div>
                                )}

                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                                    <div>
                                        <p className="font-medium text-amber-400 mb-1">Review carefully</p>
                                        <ul className="list-disc list-inside space-y-0.5 text-amber-300/80">
                                            <li>Green ✓ = player matched to roster. Yellow/Red = needs review.</li>
                                            <li>Toggle the ✓/✕ button to control if a player's rating is affected.</li>
                                            <li>Unmatched kills count toward team total but no individual player.</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => { setOcrStep(1); setOcrResults([]); }}
                                        disabled={applyingOcr}
                                        className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all font-medium disabled:opacity-50"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={handleApplyOcrResults}
                                        disabled={applyingOcr || ocrResults.length === 0}
                                        className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                                    >
                                        {applyingOcr ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Applying…
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                Apply Results
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-gray-900 border border-red-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Delete Match?</h3>
                                <p className="text-gray-400 mt-2 text-sm leading-relaxed">
                                    Are you sure you want to delete this match? This action cannot be undone and all results will be permanently removed.
                                </p>
                            </div>
                            <div className="flex gap-3 w-full pt-4">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setMatchToDelete(null);
                                    }}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteMatch}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50 hover:scale-[1.02] transform active:scale-[0.98]"
                                >
                                    {isDeleting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Delete'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatchManagement;