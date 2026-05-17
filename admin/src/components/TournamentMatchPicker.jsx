import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTournamentsAPI, fetchMatchesAPI } from '../api/adminApi';
import { Trophy, ChevronRight, Radio, Calendar, MapPin, Search, ArrowLeft } from 'lucide-react';

const statusColors = {
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const gameColors = {
  BGMI: 'bg-yellow-500/20 text-yellow-400',
  VALORANT: 'bg-red-500/20 text-red-400',
};

export default function TournamentMatchPicker({ onSelectMatch, selectedMatchId }) {
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [search, setSearch] = useState('');

  const { data: tournamentData, isLoading: tournamentsLoading } = useQuery({
    queryKey: ['adminTournamentsList'],
    queryFn: () => fetchTournamentsAPI({ limit: 100, sortBy: 'startDate', sortOrder: 'desc' }),
  });

  const { data: matchData, isLoading: matchesLoading } = useQuery({
    queryKey: ['adminTournamentMatches', selectedTournament?._id],
    queryFn: () => fetchMatchesAPI({ tournament: selectedTournament._id, limit: 100 }),
    enabled: !!selectedTournament?._id,
  });

  const tournaments = tournamentData?.tournaments || [];
  const matches = matchData?.matches || [];

  const filtered = search
    ? tournaments.filter(t =>
        t.tournamentName?.toLowerCase().includes(search.toLowerCase()) ||
        t.shortName?.toLowerCase().includes(search.toLowerCase())
      )
    : tournaments;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  // Tournament list view
  if (!selectedTournament) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-3">Select Tournament</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tournaments..."
              className="w-full bg-zinc-800 text-white pl-10 pr-4 py-2 rounded-lg border border-zinc-700 text-sm focus:border-orange-500 outline-none"
            />
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-800">
          {tournamentsLoading && <div className="text-zinc-400 text-center py-8 text-sm">Loading tournaments...</div>}
          {!tournamentsLoading && filtered.length === 0 && <div className="text-zinc-500 text-center py-8 text-sm">No tournaments found</div>}
          {filtered.map(t => (
            <button
              key={t._id}
              onClick={() => setSelectedTournament(t)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors flex items-center justify-between group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gameColors[t.gameTitle] || gameColors.BGMI}`}>
                    {t.gameTitle || 'BGMI'}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusColors[t.status] || statusColors.scheduled}`}>
                    {t.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-white font-medium text-sm truncate">{t.tournamentName}</div>
                <div className="text-zinc-500 text-xs mt-0.5">
                  {formatDate(t.startDate)} — {formatDate(t.endDate)}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Match list view for selected tournament
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800">
      <div className="p-4 border-b border-zinc-800">
        <button
          onClick={() => setSelectedTournament(null)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tournaments
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-orange-500" />
          <div>
            <h3 className="text-white font-semibold text-sm">{selectedTournament.tournamentName}</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gameColors[selectedTournament.gameTitle] || gameColors.BGMI}`}>
              {selectedTournament.gameTitle || 'BGMI'}
            </span>
          </div>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-800">
        {matchesLoading && <div className="text-zinc-400 text-center py-8 text-sm">Loading matches...</div>}
        {!matchesLoading && matches.length === 0 && <div className="text-zinc-500 text-center py-8 text-sm">No matches in this tournament</div>}
        {matches.map(m => {
          const id = m._id;
          const isSelected = id === selectedMatchId;
          const isLive = m.status === 'in_progress';
          return (
            <button
              key={id}
              onClick={() => onSelectMatch(id)}
              className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between group ${
                isSelected ? 'bg-orange-500/10 border-l-2 border-l-orange-500' : 'hover:bg-zinc-800/60 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">#{m.matchNumber}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">Match #{m.matchNumber}</span>
                    {isLive && <span className="flex items-center gap-1 text-red-400 text-[10px] font-bold"><Radio className="w-3 h-3 animate-pulse" />LIVE</span>}
                  </div>
                  <div className="flex items-center gap-3 text-zinc-500 text-xs mt-0.5">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.map || 'TBD'}</span>
                    <span>{m.tournamentPhase}</span>
                    <span>{m.results?.length || m.participatingTeams?.length || 0} teams</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusColors[m.status] || statusColors.scheduled}`}>
                  {m.status?.replace(/_/g, ' ')}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
