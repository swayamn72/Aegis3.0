import React from 'react';
import Navbar from '../components/Navbar';
import { Mail, HelpCircle, ShieldAlert } from 'lucide-react';

const SupportPage = () => {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Navbar />
      <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-[#00FFFF]">
          Aegis 3.0 Support
        </h1>
        <p className="text-zinc-400 text-sm md:text-base font-medium mb-12">
          Encountered an issue? Our team is here to assist you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* General Support */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-xl hover:border-[#00FFFF] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FFFF]/10 blur-[50px] group-hover:bg-[#00FFFF]/20 transition-colors"></div>
            <HelpCircle className="w-8 h-8 text-[#00FFFF] mb-4 relative z-10" />
            <h3 className="text-xl font-bold uppercase tracking-wide mb-2 relative z-10">General Inquiries</h3>
            <p className="text-zinc-400 text-sm mb-6 relative z-10">
              For questions regarding account setup, tournament registration, or general platform usage.
            </p>
            <a 
              href="mailto:swayamsn123@gmail.com" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-[#00FFFF] transition-colors rounded relative z-10"
            >
              <Mail className="w-4 h-4" />
              swayamsn123@gmail.com
            </a>
          </div>

          {/* Technical Support */}
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-xl hover:border-[#FF4500] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4500]/10 blur-[50px] group-hover:bg-[#FF4500]/20 transition-colors"></div>
            <ShieldAlert className="w-8 h-8 text-[#FF4500] mb-4 relative z-10" />
            <h3 className="text-xl font-bold uppercase tracking-wide mb-2 relative z-10">Technical Issues</h3>
            <p className="text-zinc-400 text-sm mb-6 relative z-10">
              For bug reports, data synchronization errors, or suspicious activity reports.
            </p>
            <a 
              href="mailto:swayamsn123@gmail.com" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-[#FF4500] transition-colors rounded relative z-10"
            >
              <Mail className="w-4 h-4" />
              swayamsn123@gmail.com
            </a>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg text-sm text-zinc-500">
          <p className="mb-2"><strong className="text-zinc-300">Note:</strong> Please include your Aegis 3.0 username and relevant screenshots when submitting a support ticket to help us resolve your issue faster.</p>
          <p>Expected response time: 24-48 business hours.</p>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
