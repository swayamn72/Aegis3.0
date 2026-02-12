import React from 'react';

const Teams = ({ organization }) => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Organization Teams</h2>
            {organization.teams && organization.teams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {organization.teams.map((team) => (
                        <div key={team._id} className="bg-gray-800 rounded-lg p-4 flex items-center gap-4">
                            <div className="w-16 h-16 bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                                {team.logo ? (
                                    <img src={team.logo} alt={team.teamName} className="object-contain max-h-full" />
                                ) : (
                                    <span>Team Icon</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">{team.teamName}</h3>
                                <p className="text-gray-400 text-sm">{team.teamTag}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg p-12 text-center">
                    <span>Team Icon</span>
                    <p className="text-gray-400">No teams available</p>
                </div>
            )}
        </div>
    );
};

export default Teams;
