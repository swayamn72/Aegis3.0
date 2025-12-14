import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, XCircle, CheckCircle, Mail, AlertTriangle } from 'lucide-react';

const AegisOrgPendingApproval = () => {
  const { user, logout } = useAuth();

  const approvalStatus = user?.approvalStatus || 'pending';

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'blue',
      title: 'Approval Pending',
      message: 'Your organization registration is under review by our admin team.',
      subMessage: 'This usually takes 24-48 hours. You\'ll receive an email once approved.',
    },
    rejected: {
      icon: XCircle,
      color: 'red',
      title: 'Registration Rejected',
      message: user?.rejectionReason || 'Your organization registration was not approved.',
      subMessage: 'Please contact support for more information or submit a new application.',
    },
    approved: {
      icon: CheckCircle,
      color: 'green',
      title: 'Organization Approved!',
      message: 'Your organization has been approved and is ready to use.',
      subMessage: 'You now have full access to all organization features.',
    },
  };

  const config = statusConfig[approvalStatus];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-3xl border border-gray-700/50 p-8 md:p-12 text-center space-y-8">

          {/* Icon */}
          <div className={`mx-auto w-24 h-24 rounded-full bg-${config.color}-500/10 flex items-center justify-center`}>
            <Icon className={`w-12 h-12 text-${config.color}-500`} />
          </div>

          {/* Organization Info */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white">{user?.orgName}</h1>
            <p className="text-gray-400">{user?.email}</p>
          </div>

          {/* Status Message */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">{config.title}</h2>
            <p className="text-lg text-gray-300">{config.message}</p>
            <p className="text-sm text-gray-400">{config.subMessage}</p>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center space-x-2 bg-gray-700/50 px-6 py-3 rounded-full">
            <div className={`w-3 h-3 rounded-full bg-${config.color}-500 animate-pulse`}></div>
            <span className="text-sm font-medium text-white uppercase tracking-wider">
              {approvalStatus}
            </span>
          </div>

          {/* Additional Info */}
          {approvalStatus === 'pending' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-blue-300 font-medium">Check your email</p>
                  <p className="text-xs text-gray-400 mt-1">
                    We'll send you an email at <span className="font-medium text-white">{user?.email}</span> once your organization is reviewed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {approvalStatus === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-red-300 font-medium">Rejection Reason</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {user?.rejectionReason || 'No specific reason provided. Please contact support.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {approvalStatus === 'rejected' && (
              <button
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                onClick={() => window.location.href = 'mailto:support@aegis.com'}
              >
                Contact Support
              </button>
            )}
            <button
              onClick={logout}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Help Section */}
          <div className="pt-6 border-t border-gray-700/50">
            <p className="text-xs text-gray-500">
              Having issues? Contact us at{' '}
              <a href="mailto:support@aegis.com" className="text-blue-400 hover:text-blue-300">
                support@aegis.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AegisOrgPendingApproval;