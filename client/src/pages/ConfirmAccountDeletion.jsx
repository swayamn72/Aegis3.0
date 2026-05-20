import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertOctagon, Trash2, Home, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../utils/axiosConfig';

const ConfirmAccountDeletion = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmDeletion = async () => {
    setIsDeleting(true);
    setError('');

    try {
      const response = await axiosInstance.post('/api/auth/confirm-account-deletion', { token });
      setIsSuccess(true);
      toast.success(response.data.message || 'Account successfully deleted');
      
      // Clear any local storage auth state if they happened to be logged in
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete account. The link may have expired.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-red-900/10 blur-[120px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-zinc-900/60 backdrop-blur-xl py-10 px-6 sm:px-12 rounded-3xl shadow-2xl border border-zinc-800/50 text-center">
          
          {isSuccess ? (
            <div className="py-8">
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-white mb-4">Account Deleted</h2>
              <p className="text-zinc-400 mb-8 max-w-sm mx-auto">
                Your Aegis account and all associated data have been permanently removed from our servers. We're sorry to see you go!
              </p>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all"
              >
                <Home className="w-5 h-5" />
                Return to Homepage
              </Link>
            </div>
          ) : (
            <>
              <div className="mx-auto w-24 h-24 bg-red-500/10 border-2 border-red-500/30 rounded-full flex items-center justify-center mb-6">
                <AlertOctagon className="w-12 h-12 text-red-500" />
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                Final Confirmation
              </h2>
              
              <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5 mb-8 text-left">
                <p className="text-red-400 font-medium mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Irreversible Action
                </p>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  You are about to permanently delete your account. This action cannot be undone. All your personal data, teams, statistics, and history will be wiped or anonymized.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/')}
                  disabled={isDeleting}
                  className="px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all w-full sm:w-auto disabled:opacity-50 flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeletion}
                  disabled={isDeleting}
                  className={`px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold transition-all w-full sm:w-auto flex items-center justify-center gap-2 flex-1 ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default ConfirmAccountDeletion;
