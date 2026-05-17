import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { Trophy, Users, Swords, Layers, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { getTournamentAPI, updateTournamentStatusAPI } from '../api/adminApi';
import TeamsTab from '../components/tournamentDetail/TeamsTab';
import MatchesTab from '../components/tournamentDetail/MatchesTab';
import PhasesTab from '../components/tournamentDetail/PhasesTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Trophy },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'matches', label: 'Matches', icon: Swords },
  { id: 'phases', label: 'Phases', icon: Layers },
];

const statusColors = {
  announced: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  registration_open: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  registration_closed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  postponed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const AdminTournamentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusChanging, setStatusChanging] = useState(false);

  const fetchTournament = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTournamentAPI(id);
      setTournament({ ...data.tournament, registrationStats: data.registrationStats });
    } catch (err) {
      toast.error('Failed to load tournament');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTournament(); }, [fetchTournament]);

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Change status to "${newStatus.replace(/_/g, ' ')}"?`)) return;
    setStatusChanging(true);
    try {
      await updateTournamentStatusAPI(id, newStatus);
      toast.success('Status updated');
      fetchTournament();
    } catch (err) {
      toast.error(err.error || 'Failed to update status');
    } finally {
      setStatusChanging(false);
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!tournament) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-400 text-lg mb-4">Tournament not found</p>
            <button onClick={() => navigate('/admin/tournaments')} className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">Go Back</button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-zinc-950 p-6">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate('/admin/tournaments')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Tournaments
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{tournament.tournamentName}</h1>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-orange-400 font-medium">{tournament.gameTitle}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{tournament.tier} Tier</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{fmt(tournament.startDate)} — {fmt(tournament.endDate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchTournament} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Refresh">
                <RefreshCw className="w-5 h-5" />
              </button>
              <select
                value={tournament.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusChanging}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50"
              >
                {['announced','registration_open','registration_closed','in_progress','completed','cancelled','postponed'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <span className={`px-3 py-1.5 text-xs font-medium rounded border ${statusColors[tournament.status] || 'bg-zinc-700 text-zinc-300'}`}>
                {tournament.status?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewContent tournament={tournament} fmt={fmt} />
        )}
        {activeTab === 'teams' && (
          <TeamsTab tournamentId={id} tournament={tournament} onRefresh={fetchTournament} />
        )}
        {activeTab === 'matches' && (
          <MatchesTab tournamentId={id} tournament={tournament} onRefresh={fetchTournament} />
        )}
        {activeTab === 'phases' && (
          <PhasesTab tournamentId={id} tournament={tournament} onRefresh={fetchTournament} />
        )}
      </div>
    </AdminLayout>
  );
};

const OverviewContent = ({ tournament, fmt }) => {
  const t = tournament;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Format', value: t.format },
          { label: 'Region', value: t.region },
          { label: 'Teams', value: `${t.participatingTeamsCount || 0} / ${t.slots?.total || 0}` },
          { label: 'Prize Pool', value: t.prizePool?.total ? `₹${t.prizePool.total.toLocaleString()}` : 'TBD', color: 'text-green-400' },
        ].map((card, i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
            <p className={`text-lg font-semibold ${card.color || 'text-white'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Phases Overview */}
      {t.phases?.length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h3 className="text-white font-semibold mb-4">Tournament Phases</h3>
          <div className="space-y-3">
            {t.phases.map((phase, i) => (
              <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div>
                  <p className="text-white font-medium">{phase.name}</p>
                  <p className="text-xs text-zinc-500">{phase.type?.replace(/_/g, ' ')} • {phase.teams?.length || 0} teams</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded ${
                  phase.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  phase.status === 'in_progress' ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {phase.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {t.description && (
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h3 className="text-white font-semibold mb-2">Description</h3>
          <p className="text-zinc-400 text-sm whitespace-pre-wrap">{t.description}</p>
        </div>
      )}

      {/* Organizer */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h3 className="text-white font-semibold mb-3">Organizer</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-zinc-500">Name:</span> <span className="text-white ml-2">{t.organizer?.name || 'Aegis'}</span></div>
          {t.organizer?.contactEmail && <div><span className="text-zinc-500">Email:</span> <span className="text-white ml-2">{t.organizer.contactEmail}</span></div>}
          {t.organizer?.website && <div><span className="text-zinc-500">Website:</span> <a href={t.organizer.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 ml-2">{t.organizer.website}</a></div>}
        </div>
      </div>
    </div>
  );
};

export default AdminTournamentDetail;
