import React from 'react';

const Tournaments = ({ tournaments, organization, setShowCreateModal, navigate, getTournamentStatusBadge }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">My Tournaments</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    disabled={organization.approvalStatus !== 'approved'}
                >
                    {/* Plus Icon */}
                    Create Tournament
                </button>
            </div>
            {tournaments.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-12 text-center">
                    {/* Trophy Icon */}
                    <h3 className="text-xl font-semibold mb-2">No Tournaments Yet</h3>
                    <p className="text-gray-400">Create your first tournament to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournaments.map((tournament) => {
                        const isPending = tournament._approvalStatus === 'pending';
                        const isRejected = tournament._approvalStatus === 'rejected';
                        const isApproved = tournament._approvalStatus === 'approved';
                        return (
                            <div key={tournament._id} className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition relative">
                                <div className="h-32 bg-gradient-to-br from-orange-500 to-red-500 relative">
                                    {tournament.media?.banner && (
                                        <img src={tournament.media.banner} alt="" className="w-full h-full object-cover" />
                                    )}
                                </div>
                                {/* Status Box for Pending/Rejected */}
                                {(isPending || isRejected) && (
                                    <div className={`absolute top-4 left-4 right-4 z-10 rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg border ${isPending ? 'bg-yellow-900/80 border-yellow-500/40' : 'bg-red-900/80 border-red-500/40'}`}>
                                        {isPending && <span className="text-yellow-300 font-semibold">Pending Admin Approval</span>}
                                        {isRejected && <span className="text-red-300 font-semibold">Rejected</span>}
                                        {isRejected && tournament.rejectionReason && (
                                            <span className="ml-2 text-xs text-red-200">Reason: {tournament.rejectionReason}</span>
                                        )}
                                    </div>
                                )}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-bold text-lg">{tournament.tournamentName}</h3>
                                        {getTournamentStatusBadge(tournament.status)}
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4">
                                        {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">
                                            {tournament.participatingTeams?.length || 0}/{tournament.slots?.total || 0} Teams
                                        </span>
                                        {isApproved && (
                                            <button
                                                onClick={() => navigate(`/org/tournament/${tournament._id}`)}
                                                className="text-orange-500 hover:text-orange-400"
                                            >
                                                Manage →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Tournaments;
