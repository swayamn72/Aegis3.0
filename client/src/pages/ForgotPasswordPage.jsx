import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Mail, Shield, CheckCircle, ArrowRight, KeyRound, Lock } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('player'); // Default to player
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const AegisSecurityMascot = () => (
        <div className="relative">
            <div className="w-16 h-20 bg-gradient-to-b from-purple-400 via-indigo-500 to-blue-600 rounded-t-full rounded-b-lg border-2 border-purple-300 relative overflow-hidden shadow-lg shadow-purple-500/50">
                <div className="absolute inset-0">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-purple-300/30 rounded-full" />
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-indigo-200/40 rounded-full" />
                </div>

                <div className="absolute inset-1 bg-gradient-to-b from-purple-300/20 to-indigo-400/20 rounded-t-full rounded-b-lg border border-purple-400/30" />

                <div className="absolute top-6 left-3 w-2 h-2 bg-purple-300 rounded-full animate-pulse shadow-lg shadow-purple-400/80" />
                <div className="absolute top-6 right-3 w-2 h-2 bg-purple-300 rounded-full animate-pulse shadow-lg shadow-purple-400/80" />

                <div className="absolute top-9 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-purple-200/90 rounded-full shadow-sm shadow-purple-300/60" />

                {/* Lock icon overlay */}
                <Lock className="absolute top-11 left-1/2 transform -translate-x-1/2 w-4 h-4 text-purple-200/90" />
            </div>

            <div className="absolute top-6 -left-2 w-3 h-6 bg-gradient-to-b from-purple-300 to-indigo-400 rounded-full transform rotate-45 shadow-md shadow-purple-400/50" />
            <div className="absolute top-8 -right-2 w-3 h-6 bg-gradient-to-b from-purple-300 to-indigo-400 rounded-full transform -rotate-12 shadow-md shadow-purple-400/50" />

            <div className="absolute -top-1 left-0 w-1 h-1 bg-purple-400 rounded-full animate-ping" />
            <div className="absolute -top-2 left-2 w-1 h-1 bg-indigo-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute top-0 -left-1 w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />

            <div className="absolute inset-0 bg-purple-400/40 rounded-t-full rounded-b-lg blur-md -z-10 animate-pulse" />
            <div className="absolute inset-0 bg-indigo-500/20 rounded-t-full rounded-b-lg blur-lg -z-20" />

            <div className="absolute -inset-1 bg-gradient-to-b from-purple-400/30 via-indigo-400/30 to-blue-500/30 rounded-t-full rounded-b-lg blur-sm -z-30 animate-pulse" style={{ animationDuration: '2s' }} />
        </div>
    );

    const validateEmail = (email) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Email is required');
            return;
        }

        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);

        try {
            const endpoint = role === 'organization'
                ? '/api/auth/organization/forgot-password'
                : '/api/auth/forgot-password';

            const response = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}${endpoint}`,
                { email }
            );

            if (response.data.success) {
                setEmailSent(true);
                toast.success('Password reset link sent! Check your email.');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to send reset link. Please try again.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (emailSent) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 relative overflow-hidden flex items-center justify-center px-4">
                {/* Background Animations */}
                <div className="absolute inset-0 opacity-30">
                    {[...Array(80)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                animationDuration: `${1.5 + Math.random() * 4}s`
                            }}
                        />
                    ))}
                </div>

                <div className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-md p-8 rounded-2xl border border-white/10 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-green-400" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-bold text-white">Check Your Email</h2>
                        <p className="text-gray-300 text-base">
                            We've sent a password reset link to
                        </p>
                        <p className="text-purple-400 font-semibold text-lg break-all">{email}</p>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-left">
                        <p className="text-sm text-gray-300 space-y-2">
                            <span className="block">📧 Check your inbox and spam folder</span>
                            <span className="block">⏰ The link expires in 1 hour</span>
                            <span className="block">🔒 Keep your reset link secure</span>
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 hover:from-blue-600 hover:via-purple-600 hover:to-cyan-600 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                        >
                            Back to Login
                        </button>

                        <button
                            onClick={() => {
                                setEmailSent(false);
                                setEmail('');
                            }}
                            className="w-full text-gray-400 hover:text-white transition-colors text-sm"
                        >
                            Send to a different email
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 relative overflow-hidden">
            {/* Background Animations */}
            <div className="absolute inset-0 opacity-30">
                {[...Array(80)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${1.5 + Math.random() * 4}s`
                        }}
                    />
                ))}
            </div>
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-purple-500/30 to-indigo-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/3 -right-40 w-96 h-96 bg-gradient-to-l from-indigo-500/25 to-purple-500/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute -bottom-40 left-1/4 w-72 h-72 bg-gradient-to-t from-purple-500/20 to-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />

            <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
                {/* Left Column: Marketing Text & Mascot */}
                <div className="flex-1 flex flex-col justify-center items-center text-center px-4 py-8 sm:px-8 lg:px-16 xl:px-24 max-w-2xl">
                    <div className="mb-6 lg:mb-8 transform scale-75 sm:scale-90 lg:scale-100">
                        <AegisSecurityMascot />
                    </div>

                    <div className="space-y-4 lg:space-y-6">
                        <div className="space-y-2 lg:space-y-4">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-none tracking-tight">
                                Reset Your
                                <span className="block bg-gradient-to-r from-purple-400 via-indigo-500 to-blue-500 bg-clip-text text-transparent">
                                    Password
                                </span>
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                            <div className="flex items-center space-x-2">
                                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                                <span>Secure Process</span>
                            </div>
                            <div className="hidden sm:block w-1 h-1 bg-gray-500 rounded-full" />
                            <div className="flex items-center space-x-2">
                                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                                <span>Quick Recovery</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Forgot Password Form */}
                <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8 lg:py-0">
                    <div className="w-full max-w-md space-y-6 lg:space-y-8 bg-black/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/10">
                        <div className="text-center space-y-2 lg:space-y-3">
                            <h2 className="text-2xl sm:text-3xl font-bold text-white">Forgot Password?</h2>
                            <p className="text-sm sm:text-base text-gray-400">
                                No worries, we'll send you reset instructions
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Role Selector */}
                            <div className="space-y-2 lg:space-y-3">
                                <label className="block text-xs sm:text-sm font-semibold text-gray-300">Account Type</label>
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole('player')}
                                        className={`p-2 sm:p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 hover:scale-105 ${role === 'player'
                                                ? 'border-purple-500 bg-purple-500/20 text-white shadow-lg shadow-purple-500/30'
                                                : 'border-gray-600/50 bg-gray-900/30 text-gray-300 hover:border-gray-500/70'
                                            }`}
                                    >
                                        <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span className="font-medium text-sm sm:text-base">Player</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('organization')}
                                        className={`p-2 sm:p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 hover:scale-105 ${role === 'organization'
                                                ? 'border-purple-500 bg-purple-500/20 text-white shadow-lg shadow-purple-500/30'
                                                : 'border-gray-600/50 bg-gray-900/30 text-gray-300 hover:border-gray-500/70'
                                            }`}
                                    >
                                        <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span className="font-medium text-sm sm:text-base">Organization</span>
                                    </button>
                                </div>
                            </div>

                            {/* Email Input */}
                            <div className="relative group">
                                <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-purple-400 transition-colors duration-200">
                                    <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="Enter your email address"
                                    className={`w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-3 sm:py-4 bg-gray-900/30 backdrop-blur-sm border-2 rounded-xl text-white text-base sm:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300 ${error
                                            ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-400'
                                            : 'border-gray-600/50 focus:ring-purple-500/20 focus:border-purple-400 hover:border-gray-500/70'
                                        }`}
                                />
                            </div>

                            {error && (
                                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2">
                                    {error}
                                </div>
                            )}

                            {/* Info Box */}
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                <p className="text-xs sm:text-sm text-gray-300">
                                    💡 <strong>Note:</strong> You'll receive an email with a link to reset your password. The link will be valid for 1 hour.
                                </p>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:via-indigo-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white text-base sm:text-lg font-bold py-3 sm:py-5 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30 disabled:scale-100 disabled:shadow-none flex items-center justify-center space-x-2 sm:space-x-3 group"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Send Reset Link</span>
                                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform duration-200" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Back to Login */}
                        <div className="text-center text-sm sm:text-base text-gray-400">
                            Remember your password?{' '}
                            <NavLink to="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                                Back to Login
                            </NavLink>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
