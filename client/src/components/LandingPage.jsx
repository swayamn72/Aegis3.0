import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Trophy, Shield, Zap, Search, Activity,
  ChevronRight, Gamepad2, Target, Users, Code, Lock, ArrowUpRight
} from 'lucide-react';

import BGMILogo from '../assets/gameLogos/BGMI_LOGO.png';
import ValorantLogo from '../assets/gameLogos/valorant2.png';
import Navbar from './Navbar';

/* ─── Noise SVG for grain overlay ─────────────────────────────────────────── */
const NoiseSVG = () => (
  <svg className="fixed inset-0 w-full h-full pointer-events-none z-[1] opacity-[0.035]" style={{ mixBlendMode: 'overlay' }}>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#noise)" />
  </svg>
);

/* ─── Animated counter ─────────────────────────────────────────────────────── */
const Counter = ({ target, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      let start = 0;
      const step = Math.ceil(target / 60);
      const t = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(t); }
        else setCount(start);
      }, 16);
      observer.disconnect();
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const LandingPage = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  /* subtle parallax on hero text */
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      heroRef.current.style.transform = `translateY(${window.scrollY * 0.12}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');

        :root {
          --orange: #FF4500;
          --cyan: #00E5FF;
          --surface: #111111;
          --border: rgba(255,255,255,0.06);
        }

        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.04em; }
        .font-mono-custom { font-family: 'Space Mono', monospace; }

        .glow-orange { text-shadow: 0 0 40px rgba(255,69,0,0.5); }
        .glow-cyan   { text-shadow: 0 0 40px rgba(0,229,255,0.5); }

        .card-shine {
          position: relative;
          overflow: hidden;
        }
        .card-shine::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%);
          pointer-events: none;
        }

        .btn-primary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }
        .btn-primary:hover::after { transform: translateX(100%); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,229,255,0.35); }

        .tag-badge {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 2px;
        }

        .game-card {
          transition: transform 0.4s cubic-bezier(0.23,1,0.32,1), border-color 0.3s ease;
        }
        .game-card:hover { transform: translateY(-6px); }

        .feature-card {
          transition: all 0.35s cubic-bezier(0.23,1,0.32,1);
        }
        .feature-card:hover { transform: translateY(-4px); }

        .scanline {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.03) 2px,
            rgba(0,0,0,0.03) 4px
          );
        }

        .stat-item {
          border-right: 1px solid var(--border);
        }
        .stat-item:last-child { border-right: none; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .animate-slide-in { animation: slide-in 0.8s ease forwards; }

        .divider-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        }

        .hero-chip {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
        }
      `}</style>

      <NoiseSVG />

      {/* ── Ambient blobs ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,69,0,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,69,0,0.03) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        {/* grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      </div>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <Navbar isLandingPage={true} />

      <main className="relative z-10">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-28 pb-36 px-6 max-w-[1400px] mx-auto text-center">
          <div ref={heroRef}>

            {/* status chip */}
            <div className="inline-flex items-center gap-2.5 hero-chip px-4 py-1.5 rounded-full mb-10 animate-slide-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.9)' }}></span>
              </span>
              <span className="font-mono-custom text-[9px] tracking-[0.2em] text-zinc-400 uppercase">System Online — Ready for Deployment</span>
            </div>

            {/* headline */}
            <h1 className="font-display text-[clamp(64px,12vw,140px)] leading-[0.92] mb-8 animate-slide-in" style={{ animationDelay: '0.1s', opacity: 0 }}>
              The Ultimate<br />
              <span className="relative inline-block">
                <span className="text-transparent" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.15)' }}>Esports</span>
                <span className="absolute inset-0 text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(90deg, #FF4500 0%, #FF7A00 40%, #00E5FF 100%)' }}>
                  Esports
                </span>
              </span>{' '}
              Pipeline
            </h1>

            <p className="max-w-xl mx-auto text-zinc-400 text-[15px] leading-relaxed font-medium mb-14 animate-slide-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
              Track matches, scout top-tier talent, and dominate competitive circuits.
              Your centralized command hub — from amateur grind to pro stage.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
              <button
                onClick={() => navigate('/signup')}
                className="btn-primary w-full sm:w-auto px-9 py-4 text-black text-[11px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #00E5FF, #00B8D4)', boxShadow: '0 0 24px rgba(0,229,255,0.25)' }}>
                Get Started <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-9 py-4 text-white text-[11px] font-bold tracking-[0.2em] uppercase border transition-all duration-300 hover:bg-white/5"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                Login
              </button>
            </div>
          </div>

          {/* stats bar */}
          <div className="mt-24 grid grid-cols-3 max-w-xl mx-auto animate-slide-in" style={{ animationDelay: '0.5s', opacity: 0 }}>
            {[
              { val: 12400, suffix: '+', label: 'Players' },
              { val: 380, suffix: '+', label: 'Tournaments' },
              { val: 2, suffix: '', label: 'Titles' },
            ].map((s) => (
              <div key={s.label} className="stat-item py-5 px-6 text-center">
                <div className="font-display text-4xl text-white mb-1">
                  <Counter target={s.val} suffix={s.suffix} />
                </div>
                <div className="font-mono-custom text-[9px] tracking-[0.18em] text-zinc-500 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="divider-line" />

        {/* ── Games Section ─────────────────────────────────────────────────── */}
        <section className="py-28 relative overflow-hidden" style={{ background: '#0A0A0A' }}>
          <div className="scanline absolute inset-0 pointer-events-none" />

          <div className="max-w-[1400px] mx-auto px-6 relative z-10">
            <div className="flex items-end justify-between mb-16">
              <div>
                <p className="font-mono-custom text-[9px] tracking-[0.22em] text-[#FF4500] uppercase mb-3">// Supported Operations</p>
                <h2 className="font-display text-[clamp(36px,6vw,72px)] leading-none text-white">Multi-Title<br />Intelligence</h2>
              </div>
              <p className="hidden md:block text-zinc-600 text-xs max-w-[200px] text-right leading-relaxed font-mono-custom">
                Two ecosystems.<br />One command center.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* BGMI Card */}
              <div className="game-card card-shine rounded-2xl p-8 border relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(255,69,0,0.06) 0%, rgba(17,17,17,1) 60%)', borderColor: 'rgba(255,69,0,0.2)' }}>
                <div className="absolute top-0 right-0 w-48 h-48 animate-pulse-glow"
                  style={{ background: 'radial-gradient(circle, rgba(255,69,0,0.15) 0%, transparent 70%)' }} />

                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="tag-badge bg-[#FF4500]/10 text-[#FF4500] border border-[#FF4500]/20 mb-4 inline-block">
                      Primary Integration
                    </div>
                    <h3 className="font-display text-5xl text-white flex items-center gap-3">
                      <Gamepad2 className="w-7 h-7 text-[#FF4500]" />
                      BGMI
                    </h3>
                  </div>
                  <img src={BGMILogo} alt="BGMI" className="h-14 object-contain opacity-70 animate-float mt-2" />
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                  Full ecosystem with real-time <span className="text-white font-semibold">Aegis Rating</span> ladders,
                  team recruitment, and tournament circuits.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {['Aegis Rating & MMR', 'Match & Kill Analytics', 'Team Recruitment', 'Live Tournaments'].map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-xs text-zinc-300 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FF4500', boxShadow: '0 0 6px rgba(255,69,0,0.8)' }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Valorant Card */}
              <div className="game-card card-shine rounded-2xl p-8 border relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(17,17,17,1) 60%)', borderColor: 'rgba(0,229,255,0.15)' }}>
                <div className="absolute bottom-0 left-0 w-48 h-48 animate-pulse-glow"
                  style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, transparent 70%)' }} />

                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="tag-badge bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 mb-4 inline-block">
                      Archive & Intel
                    </div>
                    <h3 className="font-display text-5xl text-white flex items-center gap-3">
                      <Target className="w-7 h-7 text-[#00E5FF]" />
                      VALORANT
                    </h3>
                  </div>
                  <img src={ValorantLogo} alt="Valorant" className="h-12 object-contain opacity-70 animate-float mt-2" style={{ animationDelay: '1s' }} />
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed mb-2">
                  Detailed match history and combat analytics for every agent and map.
                </p>
                <p className="text-zinc-600 text-xs italic mb-8">
                  * Aegis Rating is exclusive to BGMI. Valorant focuses on historical match tracking.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {['Match Archives', 'Win Rate Tracking', 'K/D & ACS Stats', 'Agent Analytics'].map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-xs text-zinc-300 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00E5FF', boxShadow: '0 0 6px rgba(0,229,255,0.8)' }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="divider-line" />

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section className="py-28 px-6 max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <p className="font-mono-custom text-[9px] tracking-[0.22em] text-[#00E5FF] uppercase mb-3">// Feature Matrix</p>
            <h2 className="font-display text-[clamp(36px,5vw,64px)] text-white">Built for Competitors</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <Trophy className="w-6 h-6" />,
                color: '#F59E0B',
                title: 'Active Circuits',
                desc: 'Discover and enroll in upcoming tournaments. Track prize pools, slots, and your team\'s progression through every bracket.',
                tag: 'Tournaments'
              },
              {
                icon: <Users className="w-6 h-6" />,
                color: '#10B981',
                title: 'Recruitment Intel',
                desc: 'Scout free agents or join an org. The Intel Hub connects the right players with the right roles at every skill tier.',
                tag: 'Team Builder'
              },
              {
                icon: <Activity className="w-6 h-6" />,
                color: '#A78BFA',
                title: 'Tactical Logs',
                desc: 'Every match recorded. Analyze points, kills, and positioning to refine your strategy before the next deployment.',
                tag: 'Analytics'
              },
            ].map((f) => (
              <div key={f.title}
                className="feature-card card-shine rounded-xl p-7 border group cursor-default"
                style={{ background: '#0E0E0E', borderColor: 'rgba(255,255,255,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${f.color}30`}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${f.color}15`, color: f.color }}>
                    {f.icon}
                  </div>
                  <span className="tag-badge" style={{ background: `${f.color}10`, color: f.color, border: `1px solid ${f.color}20` }}>
                    {f.tag}
                  </span>
                </div>
                <h4 className="font-display text-2xl text-white mb-3">{f.title}</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ color: f.color }}>
                  Learn more <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Banner ────────────────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-[1400px] mx-auto">
            <div className="rounded-2xl p-12 text-center relative overflow-hidden border"
              style={{ background: 'linear-gradient(135deg, rgba(255,69,0,0.08) 0%, rgba(0,0,0,0) 50%, rgba(0,229,255,0.08) 100%)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="absolute inset-0 scanline pointer-events-none" />
              <p className="font-mono-custom text-[9px] tracking-[0.22em] text-zinc-500 uppercase mb-4">// Join the Circuit</p>
              <h3 className="font-display text-[clamp(40px,7vw,90px)] leading-none mb-6 text-white">
                Ready to <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #FF4500, #00E5FF)' }}>Compete?</span>
              </h3>
              <p className="text-zinc-500 text-sm mb-10 max-w-md mx-auto">Sign up free and join the fastest-growing esports community in South Asia.</p>
              <button
                onClick={() => navigate !== undefined && navigate('/signup')}
                className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-black text-[11px] font-bold tracking-[0.2em] uppercase rounded-sm"
                style={{ background: 'linear-gradient(135deg, #FF4500, #FF7A00)', boxShadow: '0 0 30px rgba(255,69,0,0.3)' }}>
                Create Free Account <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', background: '#060606' }}>
        <div className="max-w-[1400px] mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-zinc-600" />
            <span className="font-display text-lg tracking-wider text-zinc-500">AEGIS 3.0</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-[10px] font-mono-custom tracking-wider text-zinc-600 uppercase">
            <Link to="/privacy-policy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
            <Link to="/child-safety" className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
              <Lock className="w-3 h-3" /> Child Safety
            </Link>
            <Link to="/support" className="hover:text-zinc-300 transition-colors">Support</Link>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="font-mono-custom text-[9px] tracking-[0.18em] text-zinc-700 uppercase">
              © {new Date().getFullYear()} Aegis Esports Platform
            </p>
            <p className="font-mono-custom text-[9px] tracking-[0.12em] text-zinc-700 uppercase text-center">
              Non-affiliated with Riot Games or Krafton. All trademarks belong to their respective owners.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;