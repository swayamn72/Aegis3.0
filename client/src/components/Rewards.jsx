import React, { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";
import { Coins, Gift, TrendingUp, Award, Zap, Trophy, Calendar, Star, Lock, ChevronRight, Crown } from "lucide-react";

export default function RewardsPage() {
    const { user } = useAuth();
    const [coins, setCoins] = useState(user?.coins || 1250);
    const [streak, setStreak] = useState(7);
    const [lastClaimDate, setLastClaimDate] = useState(null);
    const [redeemed, setRedeemed] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showClaimAnimation, setShowClaimAnimation] = useState(false);

    // Updated rewards list with image paths and rarity
    const rewards = [
        {
            _id: "1",
            name: "Gaming Headset Voucher",
            points: 5000,
            image: "/assets/rewards/headset.png",
            description: "Premium gaming headset with 7.1 surround sound",
            rarity: "legendary"
        },
        {
            _id: "2",
            name: "Tournament Entry Pass",
            points: 2000,
            image: "/assets/rewards/tournament.png",
            description: "VIP access to exclusive tournaments",
            rarity: "epic"
        },
        {
            _id: "3",
            name: "XP Booster (7 Days)",
            points: 1000,
            image: "/assets/rewards/xp-boost.png",
            description: "Double XP for all matches",
            rarity: "rare"
        },
        {
            _id: "4",
            name: "Custom Profile Theme",
            points: 1500,
            image: "/assets/rewards/theme.png",
            description: "Exclusive animated profile backgrounds",
            rarity: "epic"
        },
        {
            _id: "5",
            name: "Aegis Merchandise",
            points: 3000,
            image: "/src/assets/rewards/aegisTshirt.png",
            description: "Limited edition apparel and accessories",
            rarity: "legendary"
        },
        {
            _id: "6",
            name: "Premium Badge",
            points: 800,
            image: "/assets/rewards/badge.png",
            description: "Showcase your elite status",
            rarity: "rare"
        },
    ];

    const rarityColors = {
        legendary: "from-yellow-500 to-orange-500",
        epic: "from-purple-500 to-pink-500",
        rare: "from-blue-500 to-cyan-500"
    };

    const rarityBorders = {
        legendary: "border-yellow-500/50",
        epic: "border-purple-500/50",
        rare: "border-blue-500/50"
    };

    const handleDailyCheckIn = async () => {
        try {
            setLoading(true);

            const today = new Date().toDateString();
            if (lastClaimDate === today) {
                toast.error("You've already claimed your daily reward today!");
                setLoading(false);
                return;
            }

            const baseReward = 50;
            const bonusReward = streak >= 7 ? 100 : 0;
            const totalReward = baseReward + bonusReward;

            setShowClaimAnimation(true);
            setTimeout(() => setShowClaimAnimation(false), 2000);

            setCoins((prev) => prev + totalReward);
            setStreak((prev) => prev + 1);
            setLastClaimDate(today);

            toast.success(`Claimed ${totalReward} coins! 🎉`);
        } catch (err) {
            toast.error("Error claiming reward");
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = (reward) => {
        if (coins < reward.points) {
            toast.error("Not enough coins 💸");
            return;
        }
        setCoins((prev) => prev - reward.points);
        setRedeemed((prev) => [...prev, reward._id]);
        toast.success(`Redeemed ${reward.name}! 🎉`);
    };

    const canAfford = (points) => coins >= points;

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-black text-white pt-24 pb-16">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Rewards</h1>
                        <p className="text-zinc-400 text-sm">Complete challenges and redeem exclusive rewards</p>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Left Column - Stats & Daily */}
                        <div className="space-y-6">

                            {/* Coin Balance */}
                            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm text-zinc-400 font-medium">Aegis Coins</span>
                                    <Coins className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div className="text-4xl font-bold text-white mb-1">
                                    {coins.toLocaleString()}
                                </div>
                                <p className="text-xs text-zinc-500">Available balance</p>
                            </div>

                            {/* Daily Check-in */}
                            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-5 h-5 text-[#FF4500]" />
                                    <h3 className="text-lg font-semibold text-white">Daily Check-in</h3>
                                </div>

                                {/* Streak Info */}
                                <div className="bg-black/50 rounded-lg p-4 mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-zinc-400">Current Streak</span>
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp className="w-4 h-4 text-[#FF4500]" />
                                            <span className="text-lg font-bold text-[#FF4500]">{streak} days</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-[#FF4500] to-orange-500 h-full transition-all duration-500"
                                            style={{ width: `${Math.min((streak / 30) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        {streak >= 7 ? "🔥 Bonus unlocked!" : `${7 - streak} more days for bonus`}
                                    </p>
                                </div>

                                {/* Claim Button */}
                                <button
                                    onClick={handleDailyCheckIn}
                                    disabled={loading || lastClaimDate === new Date().toDateString()}
                                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${lastClaimDate === new Date().toDateString()
                                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                        : "bg-[#FF4500] hover:bg-[#FF4500]/90 text-white"
                                        }`}
                                >
                                    {lastClaimDate === new Date().toDateString()
                                        ? "Claimed Today ✓"
                                        : loading
                                            ? "Claiming..."
                                            : `Claim ${streak >= 7 ? "150" : "50"} Coins`
                                    }
                                </button>

                                {showClaimAnimation && (
                                    <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3 animate-[fadeIn_0.3s_ease-out]">
                                        <p className="text-green-400 text-sm font-medium text-center">
                                            +{streak >= 7 ? "150" : "50"} coins claimed! 🎉
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Quick Stats */}
                            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                                <h3 className="text-sm font-semibold text-white mb-4">Your Progress</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-400">Rewards Claimed</span>
                                        <span className="text-sm font-semibold text-white">{redeemed.length}/{rewards.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-400">Total Earned</span>
                                        <span className="text-sm font-semibold text-yellow-500">{coins + redeemed.reduce((sum, id) => {
                                            const reward = rewards.find(r => r._id === id);
                                            return sum + (reward?.points || 0);
                                        }, 0)} coins</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-400">Longest Streak</span>
                                        <span className="text-sm font-semibold text-[#FF4500]">{streak} days</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Rewards Grid */}
                        <div className="lg:col-span-2">
                            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-semibold text-white">Available Rewards</h2>
                                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                                            <span>Rare</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                                            <span>Epic</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                                            <span>Legendary</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {rewards.map((reward) => {
                                        const isRedeemed = redeemed.includes(reward._id);
                                        // Merchandise reward is always affordable
                                        const affordable = reward._id === "5" ? true : canAfford(reward.points);

                                        return (
                                            <div
                                                key={reward._id}
                                                className={`relative group bg-black rounded-lg overflow-hidden border transition-all duration-300 ${isRedeemed
                                                    ? "border-green-500/30"
                                                    : affordable
                                                        ? `${rarityBorders[reward.rarity]} hover:shadow-lg`
                                                        : "border-zinc-800 opacity-60"
                                                    }`}
                                            >
                                                {/* Rarity Glow */}
                                                {!isRedeemed && affordable && (
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${rarityColors[reward.rarity]} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                                                )}

                                                {/* Image Section */}
                                                <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                                                    <img
                                                        src={reward.image}
                                                        alt={reward.name}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div className="hidden absolute inset-0 items-center justify-center bg-zinc-900">
                                                        <Award className="w-16 h-16 text-zinc-700" />
                                                    </div>

                                                    {/* Rarity Badge */}
                                                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-md bg-black/80 backdrop-blur-sm border ${rarityBorders[reward.rarity]}`}>
                                                        <span className={`text-[10px] font-bold uppercase bg-gradient-to-r ${rarityColors[reward.rarity]} bg-clip-text text-transparent`}>
                                                            {reward.rarity}
                                                        </span>
                                                    </div>

                                                    {/* Locked/Redeemed Overlay */}
                                                    {!affordable && !isRedeemed && (
                                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                                                            <Lock className="w-8 h-8 text-zinc-600" />
                                                        </div>
                                                    )}

                                                    {isRedeemed && (
                                                        <div className="absolute inset-0 bg-green-500/20 backdrop-blur-[1px] flex items-center justify-center">
                                                            <div className="bg-green-500 rounded-full p-2">
                                                                <Star className="w-6 h-6 text-white fill-white" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content Section */}
                                                <div className="p-4">
                                                    <h3 className="font-semibold text-white text-sm mb-1 line-clamp-1">
                                                        {reward.name}
                                                    </h3>
                                                    <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
                                                        {reward.description}
                                                    </p>

                                                    {/* Price & Button */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Coins className="w-4 h-4 text-yellow-500" />
                                                            <span className="text-sm font-bold text-yellow-500">
                                                                {reward.points.toLocaleString()}
                                                            </span>
                                                        </div>

                                                        <div className="relative group">
                                                            <button
                                                                onClick={() => handleRedeem(reward)}
                                                                disabled={isRedeemed || !affordable}
                                                                className={`px-4 py-2 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${isRedeemed
                                                                    ? "bg-green-500/20 text-green-400 cursor-default"
                                                                    : affordable
                                                                        ? "bg-[#FF4500] hover:bg-[#FF4500]/90 text-white"
                                                                        : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                                                    }`}
                                                                onMouseEnter={e => {
                                                                    if (affordable && reward._id === "5") {
                                                                        const tooltip = e.currentTarget.nextSibling;
                                                                        if (tooltip) tooltip.style.display = 'block';
                                                                    }
                                                                }}
                                                                onMouseLeave={e => {
                                                                    if (affordable && reward._id === "5") {
                                                                        const tooltip = e.currentTarget.nextSibling;
                                                                        if (tooltip) tooltip.style.display = 'none';
                                                                    }
                                                                }}
                                                            >
                                                                {isRedeemed ? (
                                                                    <>
                                                                        <Star className="w-3 h-3" />
                                                                        Claimed
                                                                    </>
                                                                ) : affordable ? (
                                                                    <>
                                                                        Redeem
                                                                        <ChevronRight className="w-3 h-3" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Lock className="w-3 h-3" />
                                                                        Locked
                                                                    </>
                                                                )}
                                                            </button>
                                                            {/* Tooltip for Merchandise Redeem */}
                                                            {affordable && reward._id === "5" && !isRedeemed && (
                                                                <div style={{ display: 'none' }} className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 rounded bg-zinc-800 text-xs text-white shadow-lg whitespace-nowrap z-10">
                                                                    Redeem Merchandise
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}