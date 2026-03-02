import React, { useState, useEffect } from 'react';
import { Plus, Clock, MessageSquare, Users, X, Check, AlertCircle, Calendar, Target, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from '../../utils/axiosConfig';

const MatchScheduler = ({ tournament, onUpdate }) => {
  const [scheduledMatches, setScheduledMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [formData, setFormData] = useState({
    matchName: '',
    tournamentPhase: '',
    scheduledDate: '',
    scheduledTime: '',
    map: 'Erangel'
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const MATCHES_PER_PAGE = 10;

  const phases = tournament.phases || [];
  const allGroups = phases.flatMap(phase => phase.groups || []);
  const maps = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Livik', 'Nusa', 'Rondo'];

  useEffect(() => {
    setCurrentPage(1);
    fetchScheduledMatches(1);
  }, [tournament._id]);

  useEffect(() => {
    const teams = selectedGroups.reduce((total, groupId) => {
      const group = allGroups.find(g =>
        (g._id?.toString?.() === groupId) || (g.id === groupId) || (g.name === groupId)
      );
      return total + (group?.teamCount || group?.teams?.length || 0);
    }, 0);
    setTotalTeams(teams);
  }, [selectedGroups, allGroups]);

  const fetchScheduledMatches = async (page = currentPage) => {
    try {
      setLoading(true);
      const offset = (page - 1) * MATCHES_PER_PAGE;
      const response = await axios.get(`/api/matches/scheduled/${tournament._id}`, {
        params: {
          limit: MATCHES_PER_PAGE,
          offset: offset
        }
      });
      setScheduledMatches(response.data.matches || []);
      setTotalMatches(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching scheduled matches:', error);
      toast.error('Failed to load scheduled matches');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchScheduledMatches(newPage);
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.matchName.trim()) {
      toast.error('Match name is required');
      return false;
    }
    if (!formData.tournamentPhase) {
      toast.error('Please select a phase');
      return false;
    }
    if (!formData.scheduledDate || !formData.scheduledTime) {
      toast.error('Please select date and time');
      return false;
    }
    if (selectedGroups.length === 0) {
      toast.error('Please select at least one group');
      return false;
    }
    if (totalTeams > 24) {
      toast.error('Total teams cannot exceed 24');
      return false;
    }

    return true;
  };


  const handleScheduleMatch = async () => {
    if (!validateForm()) return;

    try {
      const scheduledDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);

      const matchData = {
        matchName: formData.matchName,
        tournament: tournament._id,
        tournamentPhase: formData.tournamentPhase,
        map: formData.map,
        scheduledStartTime: scheduledDateTime.toISOString(),
        status: 'scheduled',
        participatingGroups: selectedGroups.map(String),
        matchType: 'scheduled'
      };

      const response = await axios.post('/api/matches/schedule', matchData);

      // Refresh matches and go to first page to see new match
      setCurrentPage(1);
      fetchScheduledMatches(1);

      if (onUpdate) {
        onUpdate();
      }

      setFormData({
        matchName: '',
        tournamentPhase: '',
        scheduledDate: '',
        scheduledTime: '',
        map: 'Erangel'
      });
      setSelectedGroups([]);
      setShowScheduleForm(false);
      toast.success('Match scheduled successfully');
    } catch (error) {
      console.error('Error scheduling match:', error);
      toast.error('Failed to schedule match');
    }
  };

  const handleDeleteScheduledMatch = (matchId) => {
    setMatchToDelete(matchId);
    setShowDeleteModal(true);
  };

  const confirmDeleteScheduledMatch = async () => {
    if (!matchToDelete) return;

    try {
      setIsDeleting(true);
      await axios.delete(`/api/matches/scheduled/${matchToDelete}`);

      // If we're on a page that will become empty after deletion, go back one page
      const isLastOnPage = scheduledMatches.length === 1 && currentPage > 1;
      const pageToFetch = isLastOnPage ? currentPage - 1 : currentPage;

      if (isLastOnPage) setCurrentPage(pageToFetch);
      fetchScheduledMatches(pageToFetch);

      toast.success('Scheduled match deleted');
      setShowDeleteModal(false);
      setMatchToDelete(null);
    } catch (error) {
      console.error('Error deleting scheduled match:', error);
      toast.error(error.response?.data?.error || 'Failed to delete scheduled match');
    } finally {
      setIsDeleting(false);
    }
  };

  const getGroupsForPhase = () => {
    if (!formData.tournamentPhase) return [];
    const phase = phases.find(p => p.name === formData.tournamentPhase);
    return phase?.groups || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading scheduled matches...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-xl font-semibold text-white">Match Scheduling</h3>
        <button
          onClick={() => setShowScheduleForm(!showScheduleForm)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 w-fit"
        >
          {showScheduleForm ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Form
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Schedule Match
            </>
          )}
        </button>
      </div>

      {/* Inline Schedule Form */}
      {showScheduleForm && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">Schedule New Match</h2>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Match Name *</label>
                <input
                  type="text"
                  value={formData.matchName}
                  onChange={(e) => handleInputChange('matchName', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  placeholder="e.g., Match 1"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Phase *</label>
                <select
                  value={formData.tournamentPhase}
                  onChange={(e) => handleInputChange('tournamentPhase', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select Phase</option>
                  {phases.map(phase => (
                    <option key={phase._id || phase.id} value={phase.name}>{phase.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Date *</label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Time *</label>
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Map</label>
                <select
                  value={formData.map}
                  onChange={(e) => handleInputChange('map', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                >
                  {maps.map(map => (
                    <option key={map} value={map}>{map}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Group Selection */}
            {formData.tournamentPhase && (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Participating Groups *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto bg-zinc-900/50 p-3 rounded-lg border border-zinc-700">
                  {getGroupsForPhase().map((group) => {
                    const groupKey = group._id?.toString() || group.id || group.name;
                    const isSelected = selectedGroups.includes(groupKey);
                    const groupTeamCount = group.teamCount || group.teams?.length || 0;

                    return (
                      <button
                        key={groupKey}
                        onClick={() => handleGroupToggle(groupKey)}
                        className={`p-3 rounded-lg text-sm transition-colors border ${isSelected
                          ? 'bg-orange-500/20 border-orange-400/50 text-orange-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                          }`}
                      >
                        <div className="font-medium">{group.name}</div>
                      </button>
                    );
                  })}
                </div>

                {getGroupsForPhase().length === 0 && (
                  <p className="text-zinc-500 text-sm mt-2">No groups available for this phase</p>
                )}
              </div>
            )}


            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-700">
              <button
                onClick={() => {
                  setShowScheduleForm(false);
                  setFormData({
                    matchName: '',
                    tournamentPhase: '',
                    scheduledDate: '',
                    scheduledTime: '',
                    map: 'Erangel'
                  });
                  setSelectedGroups([]);
                }}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleMatch}
                disabled={selectedGroups.length === 0}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Schedule & Notify Teams
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Matches List */}
      <div className="space-y-4">
        {scheduledMatches.length > 0 ? (
          scheduledMatches.map(match => (
            <div key={match._id} className="bg-zinc-800/50 rounded-lg p-6 border border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-white">{match.matchName}</h4>
                    <p className="text-zinc-400 text-sm">{match.tournamentPhase} • {match.map}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                    Scheduled
                  </span>
                  <button
                    onClick={() => handleDeleteScheduledMatch(match._id)}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete scheduled match"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-zinc-400 text-sm">Scheduled Time</p>
                  <p className="text-white font-medium">
                    {new Date(match.scheduledStartTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Participating Groups</p>
                  <p className="text-white font-medium">{match.participatingGroups?.length || 0} groups</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Total Teams</p>
                  <p className="text-white font-medium">
                    {
                      (match.results && match.results.length > 0)
                        ? match.results.length
                        : (match.teams && match.teams.length > 0)
                          ? match.teams.length
                          : (match.participatingGroups?.reduce((total, groupId) => {
                            const group = allGroups.find(g =>
                              (g._id?.toString?.() === groupId) ||
                              (g.id === groupId) ||
                              (g.name === groupId)
                            );
                            return total + (group?.teams?.length || 0);
                          }, 0) || 0)
                    } teams
                  </p>
                </div>
              </div>

              {match.participatingGroups?.length > 0 && (
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <p className="text-zinc-400 text-sm mb-2">Participating Groups:</p>
                  <div className="flex flex-wrap gap-2">
                    {match.participatingGroups.map(groupId => {
                      const group = allGroups.find(g =>
                        (g._id?.toString?.() === groupId) ||
                        (g.id === groupId) ||
                        (g.name === groupId)
                      );
                      return group ? (
                        <span key={groupId} className="px-2 py-1 bg-orange-500/20 border border-orange-400/30 text-orange-400 rounded-md text-xs">
                          {group.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Matches Scheduled</h3>
            <p className="text-zinc-400">Schedule your first match to get started.</p>
          </div>
        )}
        {/* Pagination Controls */}
        {Math.ceil(totalMatches / MATCHES_PER_PAGE) > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-700">
            <div className="text-sm text-zinc-400">
              Showing <span className="text-white font-medium">{(currentPage - 1) * MATCHES_PER_PAGE + 1}</span> to{' '}
              <span className="text-white font-medium">
                {Math.min(currentPage * MATCHES_PER_PAGE, totalMatches)}
              </span> of{' '}
              <span className="text-white font-medium">{totalMatches}</span> scheduled matches
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {[...Array(Math.ceil(totalMatches / MATCHES_PER_PAGE))].map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`w-10 h-10 rounded-lg border transition-all font-medium ${currentPage === i + 1
                    ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(totalMatches / MATCHES_PER_PAGE)}
                className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-900 border border-red-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Delete Scheduled Match?</h3>
                  <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
                    Are you sure you want to delete this scheduled match? This will remove the schedule and notify participating teams.
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setMatchToDelete(null);
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-all font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteScheduledMatch}
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
    </div>
  );
};

export default MatchScheduler;