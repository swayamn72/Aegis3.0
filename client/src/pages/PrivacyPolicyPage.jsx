import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';

const PrivacyPolicyPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans">
            <Navbar />
            <div className="container mx-auto px-6 py-24 max-w-4xl">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 md:p-12 shadow-xl">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-amber-500 text-transparent bg-clip-text mb-6">
                        Privacy Policy
                    </h1>
                    <p className="text-zinc-400 mb-8 border-b border-zinc-800 pb-6">Last Updated: April 2026</p>

                    <div className="prose prose-invert prose-orange max-w-none space-y-6 text-zinc-300">
                        <p>
                            Welcome to Aegis Esports ("we", "us", or "our"). This Privacy Policy explains how we collect, use,
                            disclose, and safeguard your information when you visit our mobile application (the "App") and backend
                            services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy
                            policy, please do not access the application.
                        </p>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Information We Collect</h2>
                        <p>We may collect information about you in a variety of ways. The information we may collect via the App includes:</p>

                        <h3 className="text-xl font-medium text-orange-400 mt-6 mb-2">Personal Data</h3>
                        <p>Demographic and other personally identifiable information (such as your name and email address) that you voluntarily give to us when choosing to participate in various activities related to the App.</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li><strong className="text-white">Identifiers:</strong> Real name, username, email address, password.</li>
                            <li><strong className="text-white">Esports Data:</strong> In-game names, match stats.</li>
                            <li><strong className="text-white">Profile Data:</strong> Profile pictures, age, location, social tags.</li>
                        </ul>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. How We Use Your Information</h2>
                        <p>Specifically, we may use information collected about you via the App to:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>Create and manage your account.</li>
                            <li>Match you with teams, players, and organizations.</li>
                            <li>Track and display your esports statistics and Aegis Rating.</li>
                            <li>Enable user-to-user communications.</li>
                        </ul>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Account Deletion and Data Retention</h2>
                        <h3 className="text-xl font-medium text-orange-400 mt-6 mb-2">Right to Deletion</h3>
                        <p>
                            You have the right to request the deletion of your personal data. We provide an in-app "Delete Account"
                            feature within the Settings page of the Aegis Esports mobile application and the web platform.
                        </p>

                        <h3 className="text-xl font-medium text-orange-400 mt-6 mb-2">What Happens When You Delete Your Account:</h3>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>To comply with data privacy laws and App Store/Play Store regulations, initiating the account deletion process permanently removes your Personally Identifiable Information (PII) from our active systems.</li>
                            <li>Your email, real name, age, Google identity links, social handles, and password will be irreversibly scrambled or removed (Anonymization).</li>
                            <li>Your Aegis Rating, game IDs, generic username, and historical stats may be anonymized rather than deleted entirely to ensure that past tournaments, team histories, and chat logs remain structurally intact.</li>
                            <li>Once an account is deleted, it cannot be recovered.</li>
                        </ul>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Contact Us</h2>
                        <p>If you have questions or comments about this Privacy Policy, please contact us at <a href="mailto:swayamsn123@gmail.com" className="text-orange-400 hover:text-orange-300 transition-colors">swayamsn123@gmail.com</a>.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
