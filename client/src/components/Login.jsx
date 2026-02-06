import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Shield, CheckCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const AegisLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'player' // Default to player
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const AegisLoginMascot = () => (
    <div className="relative">
      <div className="w-16 h-20 bg-gradient-to-b from-blue-400 via-purple-500 to-indigo-600 rounded-t-full rounded-b-lg border-2 border-blue-300 relative overflow-hidden shadow-lg shadow-blue-500/50">
        <div className="absolute inset-0">
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-cyan-300/30 rounded-full" />
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-200/40 rounded-full" />
        </div>

        <div className="absolute inset-1 bg-gradient-to-b from-blue-300/20 to-purple-400/20 rounded-t-full rounded-b-lg border border-cyan-400/30" />

        <div className="absolute top-6 left-3 w-2 h-2 bg-cyan-300 rounded-full animate-pulse shadow-lg shadow-cyan-400/80" />
        <div className="absolute top-6 right-3 w-2 h-2 bg-cyan-300 rounded-full animate-pulse shadow-lg shadow-cyan-400/80" />

        <div className="absolute top-9 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-cyan-200/90 rounded-full shadow-sm shadow-cyan-300/60" />
      </div>

      <div className="absolute top-6 -left-2 w-3 h-6 bg-gradient-to-b from-blue-300 to-purple-400 rounded-full transform rotate-45 shadow-md shadow-blue-400/50" />
      <div className="absolute top-8 -right-2 w-3 h-6 bg-gradient-to-b from-blue-300 to-purple-400 rounded-full transform -rotate-12 shadow-md shadow-blue-400/50" />

      <div className="absolute -top-1 left-0 w-1 h-1 bg-cyan-400 rounded-full animate-ping" />
      <div className="absolute -top-2 left-2 w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
      <div className="absolute top-0 -left-1 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />

      <div className="absolute inset-0 bg-blue-400/40 rounded-t-full rounded-b-lg blur-md -z-10 animate-pulse" />
      <div className="absolute inset-0 bg-purple-500/20 rounded-t-full rounded-b-lg blur-lg -z-20" />

      <div className="absolute -inset-1 bg-gradient-to-b from-cyan-400/30 via-blue-400/30 to-purple-500/30 rounded-t-full rounded-b-lg blur-sm -z-30 animate-pulse" style={{ animationDuration: '2s' }} />
    </div>
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setIsLoading(true);

    const result = await login(formData.email, formData.password, formData.role);

    setIsLoading(false);

    if (result.success) {
      toast.success('Login successful! Redirecting...');

      // Navigate based on role and status
      if (result.role === 'organization') {
        // All organizations go to pending approval page
        // The page will show different UI based on approval status
        navigate('/org/pending-approval');
      } else {
        // Player navigation
        if (result.isProfileComplete) {
          navigate('/my-profile');
        } else {
          navigate('/settings');
        }
      }
    } else {
      // Check if email verification is required
      if (result.requiresVerification && result.email) {
        toast.warning('📧 Please verify your email first');
        setTimeout(() => {
          navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
        }, 1500);
        return;
      }

      setErrors({ general: result.message });
      toast.error(result.message || 'Login failed');
    }
  };

  const handleForgotPassword = () => {
    alert('Forgot password clicked');
  };

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);

      // Send the credential to your backend
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/google`,
        { credential: credentialResponse.credential },
        { withCredentials: true }
      );

      if (response.data.token) {
        // Store authentication data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.player));
        localStorage.setItem('userRole', 'player'); // Critical: Set the user role

        toast.success('Google login successful!');

        // Navigate with full page reload
        setTimeout(() => {
          // Check if username needs to be customized
          if (response.data.player.usernameCustomized === false) {
            window.location.href = '/setup-username';
          } else if (response.data.player.primaryGame) {
            window.location.href = '/my-profile';
          } else {
            window.location.href = '/settings';
          }
        }, 100);
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error(error.response?.data?.message || 'Google login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLoginError = () => {
    toast.error('Google login failed. Please try again.');
  };

  // Alternative Google login using useGoogleLogin hook
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setIsLoading(true);

        // Get user info from Google
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );

        // Send to backend with the access token to verify
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/api/auth/google`,
          {
            credential: tokenResponse.access_token,
            userInfo: userInfo.data
          },
          { withCredentials: true }
        );

        if (response.data.token) {
          // Store authentication data
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.player));
          localStorage.setItem('userRole', 'player'); // Critical: Set the user role

          toast.success('Google login successful!');

          // Small delay to ensure storage is complete
          setTimeout(() => {
            // Check if username needs to be customized
            if (response.data.player.usernameCustomized === false) {
              window.location.href = '/setup-username';
            } else if (response.data.player.primaryGame) {
              window.location.href = '/my-profile';
            } else {
              window.location.href = '/settings';
            }
          }, 100);
        }
      } catch (error) {
        console.error('Google login error:', error);
        toast.error(error.response?.data?.message || 'Google login failed');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login failed. Please try again.');
    }
  });

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
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-gradient-to-l from-purple-500/25 to-cyan-500/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute -bottom-40 left-1/4 w-72 h-72 bg-gradient-to-t from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* Left Column: Marketing Text & Mascot */}
        <div className="flex-1 flex flex-col justify-center items-center text-center px-4 py-8 sm:px-8 lg:px-16 xl:px-24 max-w-2xl">
          <div className="mb-6 lg:mb-8 transform scale-75 sm:scale-90 lg:scale-100">
            <AegisLoginMascot />
          </div>

          <div className="space-y-4 lg:space-y-6">
            <div className="space-y-2 lg:space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-none tracking-tight">
                Welcome
                <span className="block bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                  Back, Player.
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                <span>Instant Access</span>
              </div>
              <div className="hidden sm:block w-1 h-1 bg-gray-500 rounded-full" />
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <span>Secure Login</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8 lg:py-0">
          <div className="w-full max-w-md space-y-6 lg:space-y-8 bg-black/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/10">

            <div className="text-center space-y-2 lg:space-y-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Sign In</h2>
              <p className="text-sm sm:text-base text-gray-400">Enter your credentials to continue</p>
            </div>

            <div className="space-y-6">

              {/* Role Selector */}
              <div className="space-y-2 lg:space-y-3">
                <label className="block text-xs sm:text-sm font-semibold text-gray-300">I am logging in as...</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'player' }))}
                    className={`p-2 sm:p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 hover:scale-105 ${formData.role === 'player'
                      ? 'border-blue-500 bg-blue-500/20 text-white shadow-lg shadow-blue-500/30'
                      : 'border-gray-600/50 bg-gray-900/30 text-gray-300 hover:border-gray-500/70'
                      }`}
                  >
                    <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-medium text-sm sm:text-base">Player</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'organization' }))}
                    className={`p-2 sm:p-3 rounded-xl border-2 transition-all duration-300 flex items-center justify-center space-x-1 sm:space-x-2 hover:scale-105 ${formData.role === 'organization'
                      ? 'border-blue-500 bg-blue-500/20 text-white shadow-lg shadow-blue-500/30'
                      : 'border-gray-600/50 bg-gray-900/30 text-gray-300 hover:border-gray-500/70'
                      }`}
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-medium text-sm sm:text-base">Organization</span>
                  </button>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-200">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email address"
                  className={`w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-3 sm:py-4 bg-gray-900/30 backdrop-blur-sm border-2 rounded-xl text-white text-base sm:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.email
                    ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-400'
                    : 'border-gray-600/50 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-500/70'
                    }`}
                />
              </div>

              <div className="relative group">
                <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-200">
                  <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className={`w-full pl-12 sm:pl-16 pr-12 sm:pr-16 py-3 sm:py-4 bg-gray-900/30 backdrop-blur-sm border-2 rounded-xl text-white text-base sm:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.password
                    ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-400'
                    : 'border-gray-600/50 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-500/70'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 sm:right-6 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-400 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              </div>

              {errors.general && (
                <div className="text-red-400 text-sm text-center">
                  {errors.general}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <label className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-2 transition-all duration-200 ${rememberMe
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-500 group-hover:border-blue-400'
                    }`}>
                    {rememberMe && (
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white -m-0.5" />
                    )}
                  </div>
                  <span className="text-gray-300 text-xs sm:text-sm group-hover:text-white transition-colors">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 hover:from-blue-600 hover:via-purple-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 text-white text-base sm:text-lg font-bold py-3 sm:py-5 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/30 disabled:scale-100 disabled:shadow-none flex items-center justify-center space-x-2 sm:space-x-3 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform duration-200" />
                  </>
                )}
              </button>

              {/* Google login only for players */}
              {formData.role === 'player' && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-black/20 text-gray-400">Or continue with</span>
                    </div>
                  </div>

                  {/* Custom Google Button */}
                  <button
                    onClick={() => googleLogin()}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-200 text-gray-900 font-semibold py-3 sm:py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl disabled:scale-100 disabled:shadow-none flex items-center justify-center space-x-2 sm:space-x-3 group text-sm sm:text-base"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              )}
            </div>

            <div className="text-center text-sm sm:text-base text-gray-400">
              Don't have an account?{' '}
              <NavLink to="/signup" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Sign up
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AegisLogin;