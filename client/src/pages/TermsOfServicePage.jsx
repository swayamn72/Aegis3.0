import React from 'react';
import Navbar from '../components/Navbar';

const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar />
      <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-8 text-[#FF4500]">
          Terms of Service
        </h1>
        <div className="space-y-6 text-zinc-400 leading-relaxed text-sm">
          <p>
            Welcome to Aegis 3.0. By accessing or using our platform, you agree to be bound by these Terms of Service.
            Please read them carefully before utilizing our services.
          </p>
          
          <h2 className="text-xl font-bold text-white uppercase mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By creating an account, participating in tournaments, or using the Aegis 3.0 platform, you agree to comply with and be bound by these Terms.
          </p>

          <h2 className="text-xl font-bold text-white uppercase mt-8 mb-4">2. User Conduct & Fair Play</h2>
          <p>
            Aegis 3.0 is dedicated to fostering a fair and competitive environment. Any form of cheating, hacking, smurfing (where explicitly prohibited), or toxic behavior is strictly forbidden and may result in an immediate and permanent ban from the platform.
          </p>

          <h2 className="text-xl font-bold text-white uppercase mt-8 mb-4">3. Aegis Rating System</h2>
          <p>
            The Aegis Rating System is our proprietary method for assessing player skill in BGMI. By participating in rated matches, you agree that your performance data will be processed and used to update your public ranking. Manipulating this system is a violation of these terms.
          </p>

          <h2 className="text-xl font-bold text-white uppercase mt-8 mb-4">4. Third-Party Game Publishers</h2>
          <p>
            Aegis 3.0 is an independent esports platform. We are not affiliated with, endorsed by, or sponsored by Riot Games, Krafton, or any other game publisher. All game-related assets, trademarks, and copyrights belong to their respective owners.
          </p>

          <h2 className="text-xl font-bold text-white uppercase mt-8 mb-4">5. Account Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. Aegis 3.0 is not liable for any loss or damage arising from unauthorized access to your account.
          </p>

          <p className="mt-12 text-xs text-zinc-600 font-mono">
            Last Updated: May 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
