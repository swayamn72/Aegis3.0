import React from 'react';

const Overview = ({ organization, tournaments, uploading, handleLogoChange, handleFileUpload, fileInputRef, getStatusBadge }) => {
    return (
        <div className="space-y-6">
            {/* Organization Profile */}
            <div className="bg-gray-800 rounded-lg p-6 flex gap-6">
                <div
                    className="w-48 h-48 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer hover:bg-gray-600 transition"
                    onClick={handleLogoChange}
                    title="Click to upload logo"
                >
                    {organization.logo ? (
                        <img
                            src={organization.logo}
                            alt={`${organization.orgName} logo`}
                            className="object-contain max-h-full"
                        />
                    ) : (
                        <span>Upload Logo</span>
                    )}
                    {uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <span className="text-white font-semibold">Uploading...</span>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
                <div className="flex-1 space-y-2">
                    <p className="text-gray-300">{organization.description || 'No description provided.'}</p>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <p className="text-gray-400 text-sm">Owner</p>
                            <p className="font-semibold">{organization.ownerName}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Country</p>
                            <p className="font-semibold">{organization.country}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Headquarters</p>
                            <p className="font-semibold">{organization.headquarters || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Established</p>
                            <p className="font-semibold">
                                {new Date(organization.establishedDate).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-4">
                    <div className="bg-orange-500/20 p-3 rounded-lg">
                        {/* Trophy Icon */}
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Tournaments</p>
                        <p className="text-2xl font-bold">{tournaments.length}</p>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-4">
                    <div className="bg-blue-500/20 p-3 rounded-lg">
                        {/* Users Icon */}
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Teams</p>
                        <p className="text-2xl font-bold">{organization.teams?.length || 0}</p>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 flex items-center gap-4">
                    <div className="bg-green-500/20 p-3 rounded-lg">
                        {/* Calendar Icon */}
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Active Tournaments</p>
                        <p className="text-2xl font-bold">
                            {tournaments.filter(t => t.status === 'in_progress' || t.status === 'registration_open').length}
                        </p>
                    </div>
                </div>
            </div>
            {/* Approval Status Message */}
            {organization.approvalStatus === 'pending' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-400 font-semibold">⏳ Pending Admin Approval</p>
                    <p className="text-gray-300 text-sm mt-1">
                        Your organization is awaiting approval from an administrator. You'll be able to access all features once approved.
                    </p>
                </div>
            )}
            {organization.approvalStatus === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 font-semibold">❌ Registration Rejected</p>
                    <p className="text-gray-300 text-sm mt-1">
                        <strong>Reason:</strong> {organization.rejectionReason || 'Not specified'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Overview;
