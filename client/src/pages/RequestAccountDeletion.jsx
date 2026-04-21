import React, { useState } from 'react';
import { Mail, AlertTriangle, ArrowRight, Home } from 'lucide-react';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosConfig';

const RequestAccountDeletion = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axiosInstance.post('/api/auth/request-account-deletion', { email });
      setIsSuccess(true);
      toast.success(response.data.message || 'Request sent successfully');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit request. Please try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-red-900/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-orange-900/10 blur-[100px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-20 bg-gradient-to-b from-red-500 via-red-600 to-orange-600 rounded-t-full rounded-b-lg border border-red-400/50 shadow-[0_0_30px_rgba(239,68,68,0.4)] flex items-center justify-center">
            <AlertTriangle className="text-white w-8 h-8 drop-shadow-md" />
          </div>
        </div>
        <h2 className="mt-8 text-center text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
          Delete Your Account
        </h2>
        <p className="mt-3 text-center text-sm text-zinc-400 max-w-sm mx-auto">
          Enter your email address below to request permanent deletion of your Aegis account and data.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-zinc-900/60 backdrop-blur-xl py-10 px-6 sm:px-10 rounded-3xl shadow-2xl border border-zinc-800/50">
          
          {isSuccess ? (
            <div className="text-center">
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mb-6">
                <Mail className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Check Your Email</h3>
                <p className="text-zinc-400 text-sm">
                  If an account exists with this email, we've sent a confirmation link to proceed with the deletion.
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all"
              >
                <Home className="w-5 h-5" />
                Return Home
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                  Email address
                </label>
                <div className="mt-2 relative rounded-xl shadow-sm group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-zinc-500 group-focus-within:text-red-400 transition-colors" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                    placeholder="Enter your registered email"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={\`w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-zinc-900 transition-all \${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}\`}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Request Deletion <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center text-sm text-zinc-500">
            Having trouble? <a href="mailto:support@aegis.com" className="text-red-400 hover:text-red-300 font-medium transition-colors">Contact Support</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestAccountDeletion;
