import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function UsernameSetup() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Redirect if user already has custom username
    useEffect(() => {
        if (user?.usernameCustomized) {
            navigate('/settings');
        }
    }, [user, navigate]);

    // Generate suggested username from email
    useEffect(() => {
        if (user?.email) {
            const suggested = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
            setUsername(suggested);
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (username.length < 3 || username.length > 20) {
            setError('Username must be 3-20 characters');
            return;
        }

        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/auth/set-username`, {
                username,
            }, {
                withCredentials: true,
            });

            if (response.data.success) {
                toast.success(`🎉 Welcome, ${username}!`);

                // Update local storage user data
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                storedUser.username = username;
                storedUser.usernameCustomized = true;
                localStorage.setItem('user', JSON.stringify(storedUser));

                // Redirect to settings to complete profile
                setTimeout(() => {
                    window.location.href = '/settings';
                }, 1500);
            }
        } catch (err) {
            console.error('Username setup error:', err);
            setError(err.response?.data?.message || 'Failed to set username. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const AegisMascot = () => (
        <div className="relative">
            <div className="w-16 h-20 bg-gradient-to-b from-orange-400 via-red-500 to-amber-600 rounded-t-full rounded-b-lg border-2 border-orange-300 relative overflow-hidden shadow-lg shadow-orange-500/50">
                <div className="absolute inset-0">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-yellow-300/30 rounded-full" />
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-orange-200/40 rounded-full" />
                </div>
                <div className="absolute inset-1 bg-gradient-to-b from-orange-300/20 to-red-400/20 rounded-t-full rounded-b-lg border border-yellow-400/30" />
                <div className="absolute top-6 left-3 w-2 h-2 bg-yellow-300 rounded-full animate-pulse shadow-lg shadow-yellow-400/80" />
                <div className="absolute top-6 right-3 w-2 h-2 bg-yellow-300 rounded-full animate-pulse shadow-lg shadow-yellow-400/80" />
                <div className="absolute top-9 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-yellow-200/90 rounded-full shadow-sm shadow-yellow-300/60" />
            </div>
            <div className="absolute top-6 -left-2 w-3 h-6 bg-gradient-to-b from-orange-300 to-red-400 rounded-full transform rotate-45 shadow-md shadow-orange-400/50" />
            <div className="absolute top-8 -right-2 w-3 h-6 bg-gradient-to-b from-orange-300 to-red-400 rounded-full transform -rotate-12 shadow-md shadow-orange-400/50" />
            <div className="absolute inset-0 bg-orange-400/40 rounded-t-full rounded-b-lg blur-md -z-10 animate-pulse" />
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-amber-950 via-orange-950 to-red-950 relative overflow-hidden flex items-center justify-center">
            {/* Background effects */}
            <div className="absolute inset-0 opacity-30">
                {[...Array(80)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-amber-400 rounded-full animate-pulse"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${1.5 + Math.random() * 4}s`
                        }}
                    />
                ))}
            </div>

            <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/3 -right-40 w-96 h-96 bg-gradient-to-l from-red-500/25 to-amber-500/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

            {/* Main content */}
            <div className="relative z-10 w-full max-w-md px-6">
                <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border-2 border-orange-500/30 p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <AegisMascot />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                            Choose Your Username
                            <Sparkles className="w-6 h-6 text-orange-400" />
                        </h1>
                        <p className="text-gray-400">This will be your permanent identity on Aegis</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <label className="block text-sm font-semibold text-orange-300 mb-2">
                                Username *
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-orange-400 transition-colors">
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value.toLowerCase());
                                        setError(''); // Clear error on change
                                    }}
                                    placeholder="your_username"
                                    maxLength={20}
                                    className={`w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 transition-all ${error
                                            ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-400'
                                            : 'border-gray-600/50 focus:ring-orange-500/20 focus:border-orange-400'
                                        }`}
                                    disabled={loading}
                                />
                            </div>

                            {/* Helper text */}
                            <div className="mt-2">
                                <p className="text-xs text-gray-500">
                                    3-20 characters • Letters, numbers and underscores only
                                </p>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Warning */}
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                            <p className="text-sm text-orange-300 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>
                                    <strong>Important:</strong> Your username cannot be changed after setting it. Choose wisely!
                                </span>
                            </p>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={loading || !username}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-orange-500/50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Setting username...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Confirm Username
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
