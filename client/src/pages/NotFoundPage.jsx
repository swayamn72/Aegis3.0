import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
    const navigate = useNavigate();

    const AegisMascot = () => (
        <div className="relative">
            <div className="w-32 h-36 bg-gradient-to-b from-orange-400 via-red-500 to-amber-600 rounded-t-full rounded-b-lg border-2 border-orange-300 relative overflow-hidden shadow-2xl shadow-orange-500/50 animate-bounce">
                <div className="absolute inset-0">
                    <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-yellow-300/30 rounded-full" />
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-orange-200/40 rounded-full" />
                </div>

                {/* Sad eyes */}
                <div className="absolute top-12 left-8 w-3 h-4 bg-yellow-300 rounded-full" />
                <div className="absolute top-12 right-8 w-3 h-4 bg-yellow-300 rounded-full" />

                {/* Sad mouth */}
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-8 h-2 border-b-2 border-yellow-200/90 rounded-full rotate-180" />
            </div>

            {/* Glowing effect */}
            <div className="absolute -inset-2 bg-gradient-to-b from-yellow-400/30 via-orange-400/30 to-red-500/30 rounded-t-full rounded-b-lg blur-md -z-10 animate-pulse" />
        </div>
    );

    return (
        <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
            {/* Animated background grid */}
            <div className="absolute inset-0 z-0">
                <svg className="w-full h-full opacity-10">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FF4500" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-black/40 to-black pointer-events-none"></div>

            <div className="relative z-10 text-center px-6 max-w-2xl">
                {/* Aegis Mascot */}
                <div className="flex justify-center mb-8">
                    <AegisMascot />
                </div>

                {/* 404 Text */}
                <h1 className="text-8xl md:text-9xl font-black mb-4">
                    <span className="bg-gradient-to-r from-[#FF4500] via-orange-500 to-red-600 bg-clip-text text-transparent">
                        404
                    </span>
                </h1>

                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Page Not Found
                </h2>

                <p className="text-zinc-400 text-lg mb-8 max-w-md mx-auto">
                    Oops! The page you're looking for seems to have wandered off the battlefield.
                    Let's get you back to safety.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-semibold transition-all duration-300 border border-zinc-700 hover:border-zinc-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Go Back
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF4500] to-orange-600 hover:from-[#FF4500]/90 hover:to-orange-600/90 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg shadow-[#FF4500]/20"
                    >
                        <Home className="w-5 h-5" />
                        Return Home
                    </button>
                </div>

                {/* Additional Info */}
                <div className="mt-12 pt-8 border-t border-zinc-800">
                    <p className="text-zinc-500 text-sm">
                        Error Code: 404 | Page Not Found
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
