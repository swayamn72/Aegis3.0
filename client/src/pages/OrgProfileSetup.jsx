import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, AlertCircle, Loader2, Sparkles, User, Globe, Phone, MapPin, AlignLeft, Instagram, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function OrgProfileSetup() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        orgName: '',
        ownerName: '',
        country: '',
        headquarters: '',
        description: '',
        contactPhone: '',
        website: '',
        orgInstagram: '',
        ownerInstagram: ''
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Redirect if organization already has customized profile
    useEffect(() => {
        if (user?.profileCustomized) {
            navigate('/org/pending-approval');
        }
    }, [user, navigate]);

    // Initialize with existing user data if available from Google
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                orgName: user.orgName || '',
                ownerName: user.ownerName || '',
                country: user.country === 'TBD' ? '' : (user.country || ''),
            }));
        }
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.orgName.trim()) newErrors.orgName = 'Organization name is required';
        if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
        if (!formData.country.trim()) newErrors.country = 'Country is required';

        if (formData.contactPhone && !/^[\d\s\+\-\(\)]+$/.test(formData.contactPhone)) {
            newErrors.contactPhone = 'Please enter a valid phone number';
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

        setLoading(true);

        try {
            // Trim leading '@' from social handles
            const submissionData = {
                ...formData,
                orgInstagram: formData.orgInstagram ? String(formData.orgInstagram).replace(/^@+/, '') : '',
                ownerInstagram: formData.ownerInstagram ? String(formData.ownerInstagram).replace(/^@+/, '') : ''
            };

            const response = await axios.post(`${API_URL}/api/auth/complete-org-profile`, submissionData, {
                withCredentials: true,
            });

            if (response.data.success) {
                toast.success('🎉 Profile completed successfully!');

                // Update local storage user data
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedOrg = response.data.organization;
                Object.assign(storedUser, updatedOrg);
                localStorage.setItem('user', JSON.stringify(storedUser));

                // Redirect to pending approval
                setTimeout(() => {
                    window.location.href = '/org/pending-approval';
                }, 1500);
            }
        } catch (err) {
            console.error('Org profile setup error:', err);
            toast.error(err.response?.data?.message || 'Failed to complete profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const AegisMascot = () => (
        <div className="relative">
            <div className="w-16 h-20 bg-gradient-to-b from-blue-400 via-purple-500 to-cyan-600 rounded-t-full rounded-b-lg border-2 border-blue-300 relative overflow-hidden shadow-lg shadow-blue-500/50">
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
            <div className="absolute inset-0 bg-blue-400/40 rounded-t-full rounded-b-lg blur-md -z-10 animate-pulse" />
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-[#0c0a09] via-[#1c1917] to-[#0c0a09] relative overflow-hidden flex items-center justify-center py-12 px-4 sm:px-6">
            {/* Background effects */}
            <div className="absolute inset-0 opacity-20">
                {[...Array(80)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-blue-400 rounded-full animate-pulse"
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

            {/* Main content */}
            <div className="relative z-10 w-full max-w-2xl">
                <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border-2 border-blue-500/30 p-6 sm:p-10 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <AegisMascot />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                            Complete Organization Profile
                            <Sparkles className="w-6 h-6 text-blue-400" />
                        </h1>
                        <p className="text-gray-400">Tell us more about your organization to get approved</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Org Name */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Organization Name *</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="orgName"
                                        value={formData.orgName}
                                        onChange={handleInputChange}
                                        placeholder="Team Aegis"
                                        className={`w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 transition-all ${errors.orgName ? 'border-red-500/50 focus:ring-red-500/20' : 'border-gray-600/50 focus:ring-blue-500/20 focus:border-blue-400'}`}
                                    />
                                </div>
                                {errors.orgName && <p className="text-red-400 text-xs mt-1">{errors.orgName}</p>}
                            </div>

                            {/* Owner Name */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Owner Name *</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="ownerName"
                                        value={formData.ownerName}
                                        onChange={handleInputChange}
                                        placeholder="John Doe"
                                        className={`w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 transition-all ${errors.ownerName ? 'border-red-500/50 focus:ring-red-500/20' : 'border-gray-600/50 focus:ring-blue-500/20 focus:border-blue-400'}`}
                                    />
                                </div>
                                {errors.ownerName && <p className="text-red-400 text-xs mt-1">{errors.ownerName}</p>}
                            </div>

                            {/* Country */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Country *</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="country"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        placeholder="India"
                                        className={`w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 transition-all ${errors.country ? 'border-red-500/50 focus:ring-red-500/20' : 'border-gray-600/50 focus:ring-blue-500/20 focus:border-blue-400'}`}
                                    />
                                </div>
                                {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country}</p>}
                            </div>

                            {/* Headquarters */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Headquarters</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="headquarters"
                                        value={formData.headquarters}
                                        onChange={handleInputChange}
                                        placeholder="Mumbai, Maharashtra"
                                        className="w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Contact Phone */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Contact Phone</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="contactPhone"
                                        value={formData.contactPhone}
                                        onChange={handleInputChange}
                                        placeholder="+91 9876543210"
                                        className={`w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 transition-all ${errors.contactPhone ? 'border-red-500/50 focus:ring-red-500/20' : 'border-gray-600/50 focus:ring-blue-500/20 focus:border-blue-400'}`}
                                    />
                                </div>
                                {errors.contactPhone && <p className="text-red-400 text-xs mt-1">{errors.contactPhone}</p>}
                            </div>

                            {/* Website */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Website</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <ExternalLink className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleInputChange}
                                        placeholder="https://aegis.com"
                                        className="w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Org Instagram */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Org Instagram</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <Instagram className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="orgInstagram"
                                        value={formData.orgInstagram}
                                        onChange={handleInputChange}
                                        placeholder="@aegis_esports"
                                        className="w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Owner Instagram */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-blue-300">Owner Instagram</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                        <Instagram className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="ownerInstagram"
                                        value={formData.ownerInstagram}
                                        onChange={handleInputChange}
                                        placeholder="@john_aegis"
                                        className="w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-blue-300">Description</label>
                            <div className="relative group">
                                <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-blue-400 transition-colors">
                                    <AlignLeft className="w-5 h-5" />
                                </div>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows="4"
                                    placeholder="Tell us about your organization's history, goals and achievements..."
                                    className="w-full pl-12 pr-4 py-3 bg-zinc-800 border-2 border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                                />
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-blue-500/50 flex items-center justify-center gap-2 mt-8"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving Profile...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Confirm & Submit for Approval
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
