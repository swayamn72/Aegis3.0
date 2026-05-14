import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axiosInstance from '../utils/axiosConfig';
import { Gamepad2, ArrowRight, Shield, AlertCircle, Search, CheckCircle } from 'lucide-react';
import BGMILogo from '../assets/gameLogos/BGMI_LOGO.png';
import ValorantLogo from '../assets/gameLogos/valorant2.png';

const OnboardingPage = () => {
    const navigate = useNavigate();
    const [selectedGame, setSelectedGame] = useState(null);
    const [riotName, setRiotName] = useState('');
    const [riotTag, setRiotTag] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [verifiedAccount, setVerifiedAccount] = useState(null);

    useEffect(() => {
        // Quick check to ensure we need onboarding
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.primaryGame || (user.gameIds && user.gameIds.length > 0)) {
                navigate('/dashboard'); // or login/my-profile
            }
        }
    }, [navigate]);

    const handleVerifyValorant = async () => {
        if (!riotName.trim() || !riotTag.trim()) {
            toast.error("Please enter both your Riot Name and Tag");
            return;
        }

        setIsVerifying(true);
        try {
            const res = await axiosInstance.get(`/api/players/verify-valorant`, {
                params: { name: riotName, tag: riotTag }
            });
            setVerifiedAccount(res.data.account);
            toast.success(`Account verified: ${res.data.account.name}#${res.data.account.tag}`);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to verify account");
            setVerifiedAccount(null);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCompleteOnboarding = async () => {
        if (!selectedGame) {
            toast.error("Please select a game first.");
            return;
        }

        if (selectedGame === 'VALORANT' && !verifiedAccount) {
            toast.error("Please verify your Valorant ID before continuing.");
            return;
        }

        setIsSaving(true);
        try {
            // Update profile
            await axiosInstance.put('/api/players/update-profile', {
                primaryGame: selectedGame
            });

            if (selectedGame === 'VALORANT' && verifiedAccount) {
                try {
                    await axiosInstance.post('/api/players/game-ids', {
                        game: 'VALORANT',
                        inGameName: `${verifiedAccount.name}#${verifiedAccount.tag}`,
                        characterId: verifiedAccount.puuid || `${verifiedAccount.name}#${verifiedAccount.tag}`,
                        isPrimary: true
                    });
                } catch (gameIdErr) {
                    // If user already has a Valorant ID (e.g. re-doing onboarding), continue anyway
                    const msg = gameIdErr.response?.data?.message || '';
                    if (!msg.includes('Maximum')) {
                        throw gameIdErr; // rethrow unexpected errors
                    }
                    console.warn('Valorant ID already exists, skipping:', msg);
                }
            }

            // Fetch user again to update context/localstorage
            const res = await axiosInstance.get('/api/players/me');
            if (res.data) {
                localStorage.setItem('user', JSON.stringify(res.data.player || res.data.user || res.data));
            }

            toast.success("Welcome to Aegis!");
            setTimeout(() => {
                window.location.href = '/my-profile';
            }, 1000);

        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to complete onboarding");
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Dynamic Background */}
            <div className={`absolute inset-0 transition-opacity duration-700 ${selectedGame === 'BGMI' ? 'opacity-30' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-900/40 via-black to-black" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
            </div>
            
            <div className={`absolute inset-0 transition-opacity duration-700 ${selectedGame === 'VALORANT' ? 'opacity-30' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f1923] via-black to-black" />
                <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl">
                
                <div className="text-center mb-10">
                    <div className="w-16 h-16 mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center mb-4">
                        <Gamepad2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">Initialize Matrix</h1>
                    <p className="text-zinc-400 font-medium">Select your primary battleground to calibrate your dashboard.</p>
                </div>

                {/* Game Selection Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => setSelectedGame('BGMI')}
                        className={`group relative overflow-hidden rounded-2xl transition-all duration-300 border-2 text-left p-6 ${
                            selectedGame === 'BGMI' 
                            ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_30px_rgba(255,69,0,0.15)]' 
                            : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
                        }`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br from-orange-600/20 to-transparent transition-opacity duration-300 ${selectedGame === 'BGMI' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                        <img src={BGMILogo} alt="BGMI" className={`w-12 h-12 object-contain mb-3 relative z-10 opacity-80 ${selectedGame === 'BGMI' ? 'opacity-100' : 'grayscale group-hover:grayscale-0'}`} />
                        <h3 className={`text-2xl font-black italic tracking-widest relative z-10 ${selectedGame === 'BGMI' ? 'text-orange-400' : 'text-zinc-300'}`}>BGMI</h3>
                        <p className="text-sm text-zinc-500 mt-2 font-medium relative z-10">Gritty, raw battle royale action.</p>
                    </button>

                    <button
                        onClick={() => setSelectedGame('VALORANT')}
                        className={`group relative overflow-hidden rounded-2xl transition-all duration-300 border-2 text-left p-6 ${
                            selectedGame === 'VALORANT' 
                            ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(0,255,255,0.15)]' 
                            : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
                        }`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-transparent transition-opacity duration-300 ${selectedGame === 'VALORANT' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                        <img src={ValorantLogo} alt="Valorant" className={`w-12 h-12 object-contain mb-3 relative z-10 opacity-80 ${selectedGame === 'VALORANT' ? 'opacity-100' : 'grayscale group-hover:grayscale-0'}`} />
                        <h3 className={`text-2xl font-black tracking-widest relative z-10 ${selectedGame === 'VALORANT' ? 'text-cyan-400' : 'text-zinc-300'}`}>VALORANT</h3>
                        <p className="text-sm text-zinc-500 mt-2 font-medium relative z-10">Precise, tactical 5v5 shooter.</p>
                    </button>
                </div>

                {/* Valorant Form */}
                <div className={`transition-all duration-500 overflow-hidden ${selectedGame === 'VALORANT' ? 'max-h-96 opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'}`}>
                    <div className="bg-[#0f1923] border border-cyan-500/30 rounded-2xl p-6 relative">
                        <div className="absolute top-0 right-0 w-2 h-full bg-cyan-400 rounded-r-2xl" />
                        
                        <h4 className="text-cyan-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            Link Riot ID
                        </h4>
                        
                        {verifiedAccount ? (
                            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center gap-4">
                                <img src={verifiedAccount.card?.small} alt="Banner" className="w-12 h-12 rounded object-cover" />
                                <div className="flex-1">
                                    <h5 className="text-white font-bold text-lg">{verifiedAccount.name} <span className="text-cyan-500">#{verifiedAccount.tag}</span></h5>
                                    <p className="text-zinc-400 text-sm">Level {verifiedAccount.account_level} • Region: {verifiedAccount.region?.toUpperCase()}</p>
                                </div>
                                <CheckCircle className="w-8 h-8 text-cyan-400" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 relative">
                                        <input 
                                            type="text" 
                                            placeholder="Riot Name (e.g. TenZ)"
                                            value={riotName}
                                            onChange={e => setRiotName(e.target.value)}
                                            className="w-full bg-black/50 border border-zinc-700 focus:border-cyan-400 text-white px-4 py-3 rounded-xl outline-none transition-all font-medium"
                                        />
                                    </div>
                                    <div className="w-full sm:w-32 relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">#</span>
                                        <input 
                                            type="text" 
                                            placeholder="Tag"
                                            value={riotTag}
                                            onChange={e => setRiotTag(e.target.value)}
                                            className="w-full bg-black/50 border border-zinc-700 focus:border-cyan-400 text-white pl-8 pr-4 py-3 rounded-xl outline-none transition-all font-medium"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleVerifyValorant}
                                    disabled={isVerifying || !riotName || !riotTag}
                                    className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-sm"
                                >
                                    {isVerifying ? (
                                        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Search className="w-4 h-4" /> Verify Riot ID
                                        </>
                                    )}
                                </button>
                                <p className="text-xs text-zinc-500 text-center font-medium flex items-center justify-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Verified via Henrikdev community API
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleCompleteOnboarding}
                    disabled={isSaving || !selectedGame || (selectedGame === 'VALORANT' && !verifiedAccount)}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 ${
                        !selectedGame || (selectedGame === 'VALORANT' && !verifiedAccount)
                        ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                        : selectedGame === 'BGMI'
                        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(255,69,0,0.4)]'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,255,255,0.4)]'
                    }`}
                >
                    {isSaving ? 'Initializing...' : 'Enter the Matrix'}
                    {!isSaving && <ArrowRight className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
};

export default OnboardingPage;
