import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Lock, Eye, EyeOff, Shield, CheckCircle, ArrowRight, KeyRound, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

const ResetPasswordPage = () => {
    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);

    const { token } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Check if it's organization reset from URL path
    const isOrgReset = location.pathname.includes('/organization/reset-password');

    useEffect(() => {
        if (!token) {
            toast.error('Invalid reset link');
            navigate('/login');
        }
    }, [token, navigate]);

    const AegisSecurityMascot = () => (
        <div className="relative">
            <div className="w-16 h-20 bg-gradient-to-b from-green-400 via-emerald-500 to-teal-600 rounded-t-full rounded-b-lg border-2 border-green-300 relative overflow-hidden shadow-lg shadow-green-500/50">
                <div className="absolute inset-0">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-green-300/30 rounded-full" />
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-emerald-200/40 rounded-full" />
                </div>

                <div className="absolute inset-1 bg-gradient-to-b from-green-300/20 to-emerald-400/20 rounded-t-full rounded-b-lg border border-green-400/30" />

                <div className="absolute top-6 left-3 w-2 h-2 bg-green-300 rounded-full animate-pulse shadow-lg shadow-green-400/80" />
                <div className="absolute top-6 right-3 w-2 h-2 bg-green-300 rounded-full animate-pulse shadow-lg shadow-green-400/80" />

                <div className="absolute top-9 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-green-200/90 rounded-full shadow-sm shadow-green-300/60" />

                <KeyRound className="absolute top-11 left-1/2 transform -translate-x-1/2 w-4 h-4 text-green-200/90" />
            </div>

            <div className="absolute top-6 -left-2 w-3 h-6 bg-gradient-to-b from-green-300 to-emerald-400 rounded-full transform rotate-45 shadow-md shadow-green-400/50" />
            <div className="absolute top-8 -right-2 w-3 h-6 bg-gradient-to-b from-green-300 to-emerald-400 rounded-full transform -rotate-12 shadow-md shadow-emerald-400/50" />

            <div className="absolute -top-1 left-0 w-1 h-1 bg-green-400 rounded-full animate-ping" />
            <div className="absolute -top-2 left-2 w-1 h-1 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute top-0 -left-1 w-1 h-1 bg-teal-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />

            <div className="absolute inset-0 bg-green-400/40 rounded-t-full rounded-b-lg blur-md -z-10 animate-pulse" />
            <div className="absolute inset-0 bg-emerald-500/20 rounded-t-full rounded-b-lg blur-lg -z-20" />
        </div>
    );

    const calculatePasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        return strength;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'newPassword') {
            setPasswordStrength(calculatePasswordStrength(value));
        }

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.newPassword) {
            newErrors.newPassword = 'Password is required';
        } else if (formData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
            newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = validateForm();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);

        try {
            const endpoint = isOrgReset
                ? '/api/auth/organization/reset-password'
                : '/api/auth/reset-password';

            const response = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}${endpoint}`,
                {
                    token,
                    newPassword: formData.newPassword
                }
            );

            if (response.data.success) {
                setIsSuccess(true);
                toast.success('Password reset successful! Redirecting to login...');
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to reset password. Please try again.';
            setErrors({ general: errorMessage });
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const getStrengthColor = () => {
        if (passwordStrength <= 25) return 'bg-red-500';
        if (passwordStrength <= 50) return 'bg-orange-500';
        if (passwordStrength <= 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getStrengthText = () => {
        if (passwordStrength <= 25) return 'Weak';
        if (passwordStrength <= 50) return 'Fair';
        if (passwordStrength <= 75) return 'Good';
        return 'Strong';
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 relative overflow-hidden flex items-center justify-center px-4">
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
                        <h2 className="text-3xl font-bold text-white">Password Reset Successful!</h2>
                        <p className="text-gray-300 text-base">
                            Your password has been reset successfully.
                        </p>
                        <p className="text-green-400 font-semibold">
                            Redirecting to login page...
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                    >
                        Go to Login
                    </button>
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
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/3 -right-40 w-96 h-96 bg-gradient-to-l from-emerald-500/25 to-teal-500/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="absolute -bottom-40 left-1/4 w-72 h-72 bg-gradient-to-t from-teal-500/20 to-green-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />

            <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
                {/* Left Column: Marketing Text & Mascot */}
                <div className="flex-1 flex flex-col justify-center items-center text-center px-4 py-8 sm:px-8 lg:px-16 xl:px-24 max-w-2xl">
                    <div className="mb-6 lg:mb-8 transform scale-75 sm:scale-90 lg:scale-100">
                        <AegisSecurityMascot />
                    </div>

                    <div className="space-y-4 lg:space-y-6">
                        <div className="space-y-2 lg:space-y-4">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-none tracking-tight">
                                Create New
                                <span className="block bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                                    Password
                                </span>
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                            <div className="flex items-center space-x-2">
                                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                                <span>Secure Reset</span>
                            </div>
                            <div className="hidden sm:block w-1 h-1 bg-gray-500 rounded-full" />
                            <div className="flex items-center space-x-2">
                                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                                <span>Protected</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Reset Password Form */}
                <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8 lg:py-0">
                    <div className="w-full max-w-md space-y-6 lg:space-y-8 bg-black/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/10">
                        <div className="text-center space-y-2 lg:space-y-3">
                            <h2 className="text-2xl sm:text-3xl font-bold text-white">Reset Password</h2>
                            <p className="text-sm sm:text-base text-gray-400">
                                Enter your new password below
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* New Password Input */}
                            <div className="space-y-2">
                                <label className="block text-xs sm:text-sm font-semibold text-gray-300">New Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-green-400 transition-colors duration-200">
                                        <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </div>
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        placeholder="Enter new password"
                                        className={`w-full pl-12 sm:pl-16 pr-12 sm:pr-16 py-3 sm:py-4 bg-gray-900/30 backdrop-blur-sm border-2 rounded-xl text-white text-base sm:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.newPassword
                                                ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-400'
                                                : 'border-gray-600/50 focus:ring-green-500/20 focus:border-green-400 hover:border-gray-500/70'
                                            }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-4 sm:right-6 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors duration-200"
                                    >
                                        {showNewPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </button>
                                </div>
                                {formData.newPassword && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Password Strength:</span>
                                            <span className={`font-semibold ${passwordStrength >= 75 ? 'text-green-400' : passwordStrength >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {getStrengthText()}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${getStrengthColor()} transition-all duration-300`}
                                                style={{ width: `${passwordStrength}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {errors.newPassword && (
                                    <p className="text-red-400 text-xs flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.newPassword}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password Input */}
                            <div className="space-y-2">
                                <label className="block text-xs sm:text-sm font-semibold text-gray-300">Confirm Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-green-400 transition-colors duration-200">
                                        <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </div>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        placeholder="Confirm new password"
                                        className={`w-full pl-12 sm:pl-16 pr-12 sm:pr-16 py-3 sm:py-4 bg-gray-900/30 backdrop-blur-sm border-2 rounded-xl text-white text-base sm:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.confirmPassword
                                                ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-400'
                                                : 'border-gray-600/50 focus:ring-green-500/20 focus:border-green-400 hover:border-gray-500/70'
                                            }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 sm:right-6 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors duration-200"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-red-400 text-xs flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.confirmPassword}
                                    </p>
                                )}
                            </div>

                            {/* Password Requirements */}
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                <p className="text-xs sm:text-sm text-gray-300 space-y-1">
                                    <span className="block font-semibold text-green-400">Password must contain:</span>
                                    <span className="block">✓ At least 8 characters</span>
                                    <span className="block">✓ One uppercase letter (A-Z)</span>
                                    <span className="block">✓ One lowercase letter (a-z)</span>
                                    <span className="block">✓ One number (0-9)</span>
                                </p>
                            </div>

                            {errors.general && (
                                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2">
                                    {errors.general}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-700 text-white text-base sm:text-lg font-bold py-3 sm:py-5 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/30 disabled:scale-100 disabled:shadow-none flex items-center justify-center space-x-2 sm:space-x-3 group"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Resetting...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Reset Password</span>
                                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform duration-200" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Back to Login */}
                        <div className="text-center text-sm sm:text-base text-gray-400">
                            Remember your password?{' '}
                            <NavLink to="/login" className="text-green-400 hover:text-green-300 font-semibold transition-colors">
                                Back to Login
                            </NavLink>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
