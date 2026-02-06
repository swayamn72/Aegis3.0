import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function EmailVerification() {
    const [searchParams] = useSearchParams();
    const emailFromUrl = searchParams.get('email');
    const navigate = useNavigate();
    const { login } = useAuth();

    // State
    const [email, setEmail] = useState(emailFromUrl || '');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [attemptsLeft, setAttemptsLeft] = useState(5);

    // Refs for input fields
    const inputRefs = [
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
        useRef(null),
    ];

    // Countdown timer for resend button
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Auto-paste detection
    useEffect(() => {
        const handlePaste = (e) => {
            const pastedData = e.clipboardData.getData('text').replace(/\s/g, '');
            if (/^\d{6}$/.test(pastedData)) {
                e.preventDefault();
                const digits = pastedData.split('');
                setCode(digits);
                inputRefs[5].current?.focus();
                // Auto-submit after paste
                setTimeout(() => handleVerify(digits), 100);
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, []);

    const handleInputChange = (index, value) => {
        // Only allow digits
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1); // Take only last character
        setCode(newCode);
        setError('');

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs[index + 1].current?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (newCode.every(digit => digit !== '') && index === 5) {
            setTimeout(() => handleVerify(newCode), 100);
        }
    };

    const handleKeyDown = (index, e) => {
        // Handle backspace
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
        // Handle arrow keys
        if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
        if (e.key === 'ArrowRight' && index < 5) {
            inputRefs[index + 1].current?.focus();
        }
    };

    const handleVerify = async (codeArray = code) => {
        const verificationCode = codeArray.join('');

        if (verificationCode.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        if (!email) {
            setError('Email is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${API_URL}/api/auth/verify-email`, {
                email,
                code: verificationCode,
            }, {
                withCredentials: true,
            });

            if (response.data.success) {
                setSuccess(true);
                toast.success('Email verified successfully! 🎉');

                // Store token and user data
                if (response.data.token) {
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify(response.data.player));
                    localStorage.setItem('userRole', 'player');
                }

                // Redirect after 1.5 seconds
                setTimeout(() => {
                    // Check if profile is complete, redirect accordingly
                    window.location.href = '/settings';
                }, 1500);
            }
        } catch (err) {
            console.error('Verification error:', err);

            if (err.response?.data?.expired) {
                setError('Code expired. Please request a new one.');
            } else if (err.response?.data?.tooManyAttempts) {
                setError('Too many attempts. Please request a new code.');
            } else if (err.response?.data?.attemptsLeft !== undefined) {
                const left = err.response.data.attemptsLeft;
                setAttemptsLeft(left);
                setError(`Invalid code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`);
            } else {
                setError(err.response?.data?.message || 'Verification failed. Please try again.');
            }

            // Clear code on error
            setCode(['', '', '', '', '', '']);
            inputRefs[0].current?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            setError('Email is required');
            return;
        }

        if (countdown > 0) {
            return;
        }

        setResending(true);
        setError('');

        try {
            const response = await axios.post(`${API_URL}/api/auth/resend-verification`, {
                email,
            }, {
                withCredentials: true,
            });

            if (response.data.success) {
                toast.success('New code sent! Check your email 📧');
                setCountdown(60); // 60 second cooldown
                setCode(['', '', '', '', '', '']);
                setAttemptsLeft(5);
                inputRefs[0].current?.focus();
            }
        } catch (err) {
            console.error('Resend error:', err);

            if (err.response?.data?.retryAfter) {
                setCountdown(err.response.data.retryAfter);
                setError(`Please wait ${err.response.data.retryAfter} seconds before resending.`);
            } else {
                setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
            }
        } finally {
            setResending(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Email Verified! 🎉</h1>
                    <p className="text-zinc-400 mb-6">Your account is now active. Redirecting you...</p>
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Login</span>
                </button>

                {/* Card */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
                    {/* Icon */}
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-8 h-8 text-white" />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold text-white text-center mb-2">
                        Verify Your Email
                    </h1>
                    <p className="text-zinc-400 text-center mb-8">
                        We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
                    </p>

                    {/* Code Input */}
                    <div className="flex justify-center gap-3 mb-6">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={inputRefs[index]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleInputChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-12 h-14 text-center text-2xl font-bold bg-zinc-800/50 border-2 border-zinc-700 rounded-lg text-white focus:border-orange-500 focus:outline-none transition-all"
                                disabled={loading}
                            />
                        ))}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Attempts Left */}
                    {attemptsLeft < 5 && !error.includes('Too many') && (
                        <div className="text-center text-sm text-zinc-500 mb-4">
                            {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
                        </div>
                    )}

                    {/* Verify Button */}
                    <button
                        onClick={() => handleVerify()}
                        disabled={loading || code.some(d => !d)}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Verify Email'
                        )}
                    </button>

                    {/* Resend Code */}
                    <div className="mt-6 text-center">
                        <p className="text-zinc-500 text-sm mb-2">Didn't receive the code?</p>
                        <button
                            onClick={handleResend}
                            disabled={resending || countdown > 0}
                            className="text-orange-500 hover:text-orange-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {resending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </span>
                            ) : countdown > 0 ? (
                                `Resend in ${countdown}s`
                            ) : (
                                'Resend Code'
                            )}
                        </button>
                    </div>

                    {/* Expiry Info */}
                    <div className="mt-6 text-center text-xs text-zinc-600">
                        Code expires in 5 minutes
                    </div>
                </div>
            </div>
        </div>
    );
}
