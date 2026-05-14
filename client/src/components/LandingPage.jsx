import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Trophy, Shield, Zap, Search, Activity, 
  ChevronRight, Gamepad2, Target, Users, Code, Lock
} from 'lucide-react';

import BGMILogo from '../assets/gameLogos/BGMI_LOGO.png';
import ValorantLogo from '../assets/gameLogos/valorant2.png';
import Navbar from './Navbar';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#00FFFF]/30 selection:text-white relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden mix-blend-screen z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#FF4500]/[0.03] blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#00FFFF]/[0.03] blur-[150px] rounded-full"></div>
        <div className="absolute inset-0 bg-[url('/grid-dark.svg')] opacity-[0.08]"></div>
      </div>

      {/* Header */}
      <Navbar isLandingPage={true} />

      {/* Main Content */}
      <main className="relative z-10">
        
        {/* Hero Section */}
        <section className="pt-24 pb-32 px-6 max-w-[1400px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">System Online • Ready for Deployment</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-none mb-6 drop-shadow-2xl">
            The Ultimate <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4500] to-[#00FFFF]">Esports Pipeline</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-zinc-400 text-sm md:text-base font-medium tracking-wide mb-12">
            Track your matches, scout top-tier talent, and dominate competitive circuits.
            Join and participate in tournaments, search for players and teams, and make Aegis 3.0 your centralized command hub for amateur to pro esports progression.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 bg-[#00FFFF] text-black text-sm font-black uppercase tracking-widest hover:bg-white hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(0,255,255,0.3)] flex items-center justify-center gap-2"
            >
              Sign Up
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 bg-zinc-900 border border-zinc-800 text-white text-sm font-black uppercase tracking-widest hover:border-zinc-600 transition-all duration-300"
            >
              Login
            </button>
          </div>
        </section>

        {/* Supported Operations (Games) */}
        <section className="py-24 bg-zinc-950 border-y border-zinc-900 relative overflow-hidden">
          {/* Subtle grid pattern behind the section */}
          <div className="absolute inset-0 bg-[url('/diagonal-stripes.svg')] opacity-5 mix-blend-overlay"></div>
          
          <div className="max-w-[1400px] mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">Supported Operations</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Multi-title intelligence gathering</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* BGMI Card */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-xl relative overflow-hidden group hover:border-[#FF4500] transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4500]/10 blur-[50px] group-hover:bg-[#FF4500]/20 transition-colors"></div>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Gamepad2 className="w-6 h-6 text-[#FF4500]" />
                      BGMI
                    </h3>
                    <span className="px-2.5 py-1 bg-[#FF4500]/10 text-[#FF4500] text-[9px] font-black uppercase tracking-widest border border-[#FF4500]/20 rounded-md">Primary Integration</span>
                  </div>
                  <img src={BGMILogo} alt="BGMI" className="h-12 object-contain opacity-80" />
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  Full ecosystem support including real-time <span className="text-white font-bold">Aegis Rating</span> ladders, team recruitment, 
                  and tournament circuits.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF4500]"></div>
                    Dynamic Rating & MMR tracking
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF4500]"></div>
                    Complete match & kill analytics
                  </div>
                </div>
              </div>

              {/* VALORANT Card */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-xl relative overflow-hidden group hover:border-[#00FFFF] transition-colors">
                <div className="absolute top-0 left-0 w-32 h-32 bg-[#00FFFF]/10 blur-[50px] group-hover:bg-[#00FFFF]/20 transition-colors"></div>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Target className="w-6 h-6 text-[#00FFFF]" />
                      VALORANT
                    </h3>
                    <span className="px-2.5 py-1 bg-[#00FFFF]/10 text-[#00FFFF] text-[9px] font-black uppercase tracking-widest border border-[#00FFFF]/20 rounded-md">Archive & Intel</span>
                  </div>
                  <img src={ValorantLogo} alt="Valorant" className="h-10 object-contain opacity-80" />
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  Detailed match history and combat analytics. <br/>
                  <span className="text-zinc-500 italic text-xs mt-2 block">* Aegis Rating ladder is exclusively for BGMI. Valorant features focus on historical match tracking.</span>
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00FFFF]"></div>
                    Live Match Archives & Win Rates
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00FFFF]"></div>
                    K/D, ACS, & Agent Analytics
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Matrix */}
        <section className="py-32 px-6 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-zinc-900/30 p-8 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
              <Trophy className="w-8 h-8 text-amber-500 mb-6" />
              <h4 className="text-lg font-black uppercase tracking-wide mb-3">Active Circuits</h4>
              <p className="text-zinc-500 text-sm">Discover and enroll in upcoming tournaments. Track prize pools, slots, and your team's progression in the bracket.</p>
            </div>
            <div className="bg-zinc-900/30 p-8 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
              <Users className="w-8 h-8 text-emerald-500 mb-6" />
              <h4 className="text-lg font-black uppercase tracking-wide mb-3">Recruitment Intel</h4>
              <p className="text-zinc-500 text-sm">Scout for free agents or join an organization. Our Intel Hub connects the right players with the right roles.</p>
            </div>
            <div className="bg-zinc-900/30 p-8 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
              <Activity className="w-8 h-8 text-purple-500 mb-6" />
              <h4 className="text-lg font-black uppercase tracking-wide mb-3">Tactical Logs</h4>
              <p className="text-zinc-500 text-sm">Every match recorded. Analyze your points, kills, and positioning to refine your strategy for the next drop.</p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer with Privacy Policy & Safety */}
      <footer className="relative z-10 border-t border-zinc-900 bg-black pt-16 pb-8">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-600" />
            <span className="text-zinc-600 font-black tracking-widest uppercase text-xs">AEGIS 3.0</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/child-safety" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Lock className="w-3.5 h-3.5" />
              Child Safety
            </Link>
            <Link to="/support" className="hover:text-white transition-colors">Support</Link>
          </div>
        </div>
        
        <div className="max-w-[1400px] mx-auto px-6 mt-8 text-center md:text-left text-zinc-700 text-[10px] uppercase tracking-widest font-mono">
          © {new Date().getFullYear()} Aegis Esports Platform. Non-affiliated with Riot Games or Krafton.
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
