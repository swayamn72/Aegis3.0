import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Clock, XCircle, Mail, AlertTriangle, LogOut, Building2, User, MapPin, Phone, Calendar, MessageSquare } from 'lucide-react';

const AegisOrgPendingApproval = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const approvalStatus = user?.approvalStatus || 'pending';

  // Redirect approved organizations to dashboard
  useEffect(() => {
    if (approvalStatus === 'approved') {
      navigate('/org/dashboard', { replace: true });
    }
  }, [approvalStatus, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@aegis.com?subject=Organization Registration Inquiry';
  };

  // Configuration for pending and rejected states only
  const statusConfig = {
    pending: {
      icon: Clock,
      iconColor: 'text-blue-400',
      bgColor: 'from-blue-950 via-indigo-950 to-purple-950',
      accentColor: 'blue',
      glowColor: 'blue-500',
      title: 'Approval Pending',
      subtitle: 'Your registration is under review',
      message: 'Your organization registration is currently being reviewed by our admin team.',
      subMessage: 'This usually takes 24-48 hours. We\'ll send you an email notification once the review is complete.',
    },
    rejected: {
      icon: XCircle,
      iconColor: 'text-red-400',
      bgColor: 'from-red-950 via-orange-950 to-gray-950',
      accentColor: 'red',
      glowColor: 'red-500',
      title: 'Registration Rejected',
      subtitle: 'Your application was not approved',
      message: user?.rejectionReason || 'Unfortunately, your organization registration was not approved at this time.',
      subMessage: 'If you believe this was an error or have additional information, please contact our support team.',
    },
  };

  const config = statusConfig[approvalStatus] || statusConfig.pending;
  const Icon = config.icon;

  // Show loading while redirecting approved orgs
  if (approvalStatus === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.bgColor} relative overflow-hidden`}>
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 bg-${config.accentColor}-400 rounded-full animate-pulse`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <div className={`absolute -top-40 -left-40 w-80 h-80 bg-${config.glowColor}/20 rounded-full blur-3xl animate-pulse`} />
      <div className={`absolute top-1/3 -right-40 w-96 h-96 bg-${config.glowColor}/15 rounded-full blur-3xl animate-pulse`} style={{ animationDelay: '2s' }} />
      <div className={`absolute -bottom-40 left-1/4 w-72 h-72 bg-${config.glowColor}/15 rounded-full blur-3xl animate-pulse`} style={{ animationDelay: '4s' }} />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <div className="bg-black/30 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-12 space-y-8 shadow-2xl">

            {/* Status Icon & Title */}
            <div className="text-center space-y-6">
              <div className={`mx-auto w-24 h-24 rounded-full bg-${config.accentColor}-500/10 border-2 border-${config.accentColor}-500/30 flex items-center justify-center backdrop-blur-sm`}>
                <Icon className={`w-12 h-12 ${config.iconColor}`} />
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-black text-white">{config.title}</h1>
                <p className="text-xl text-gray-300">{config.subtitle}</p>
              </div>
            </div>

            {/* Organization Info Badge */}
            <div className="flex flex-col items-center space-y-2">
              <h2 className="text-2xl font-bold text-white">{user?.orgName}</h2>
              <p className="text-gray-400">{user?.email}</p>
              <div className={`inline-flex items-center space-x-2 bg-${config.accentColor}-500/10 border border-${config.accentColor}-500/30 px-6 py-2 rounded-full backdrop-blur-sm`}>
                <div className={`w-2 h-2 rounded-full bg-${config.accentColor}-400 animate-pulse`}></div>
                <span className="text-sm font-semibold text-white uppercase tracking-wider">
                  {approvalStatus}
                </span>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-6 bg-${config.accentColor}-500/10 backdrop-blur-sm rounded-2xl border border-${config.accentColor}-500/20 space-y-3`}>
              <div className="flex items-start gap-4">
                <Icon className={`w-6 h-6 ${config.iconColor} mt-1 flex-shrink-0`} />
                <div className="space-y-2 flex-1">
                  <p className="text-lg font-medium text-white">{config.message}</p>
                  <p className="text-sm text-gray-300">{config.subMessage}</p>
                </div>
              </div>
            </div>

            {/* Rejection Reason (Only for rejected status) */}
            {approvalStatus === 'rejected' && user?.rejectionReason && (
              <div className="p-6 bg-red-500/10 backdrop-blur-sm rounded-2xl border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-red-300 font-semibold mb-2">Reason for Rejection:</h3>
                    <p className="text-red-200">{user.rejectionReason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Organization Details Grid */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="flex items-center space-x-3 p-4 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
                  <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Organization Name</p>
                    <p className="text-sm text-white font-medium truncate">{user?.orgName}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
                  <User className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Owner Name</p>
                    <p className="text-sm text-white font-medium truncate">{user?.ownerName}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
                  <MapPin className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Country</p>
                    <p className="text-sm text-white font-medium truncate">{user?.country}</p>
                  </div>
                </div>

                {user?.contactPhone && (
                  <div className="flex items-center space-x-3 p-4 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50">
                    <Phone className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">Contact Phone</p>
                      <p className="text-sm text-white font-medium truncate">{user.contactPhone}</p>
                    </div>
                  </div>
                )}

                {user?.headquarters && (
                  <div className="flex items-center space-x-3 p-4 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 md:col-span-2">
                    <MapPin className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">Headquarters</p>
                      <p className="text-sm text-white font-medium truncate">{user.headquarters}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3 p-4 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 md:col-span-2">
                  <Calendar className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Registration Date</p>
                    <p className="text-sm text-white font-medium">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Notification Info (Pending only) */}
            {approvalStatus === 'pending' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-300 font-medium mb-1">Email Notification</p>
                    <p className="text-xs text-gray-300">
                      We'll send an email to <span className="font-semibold text-white">{user?.email}</span> once your organization is reviewed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {approvalStatus === 'rejected' && (
                <button
                  onClick={handleContactSupport}
                  className={`inline-flex items-center justify-center space-x-2 px-6 py-3 bg-${config.accentColor}-600 hover:bg-${config.accentColor}-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Contact Support</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Help Footer */}
            <div className="pt-6 border-t border-gray-700/50 text-center">
              <p className="text-xs text-gray-400">
                Need help? Contact us at{' '}
                <a
                  href="mailto:support@aegis.com"
                  className={`text-${config.accentColor}-400 hover:text-${config.accentColor}-300 font-medium transition-colors`}
                >
                  support@aegis.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AegisOrgPendingApproval;