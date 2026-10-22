import React from 'react';
import { ViewState } from '../types';
import { FileSearch, LayoutDashboard, Upload } from 'lucide-react';

interface HeaderProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export default function Header({ currentView, setView }: HeaderProps) {
  return (
    <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-16 h-20 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-8">
        <button 
          onClick={() => setView('LANDING')} 
          className="font-display text-3xl font-bold tracking-tighter text-blue-300 cursor-pointer hover:opacity-90 transition-opacity"
        >
          PARA AI
        </button>
        <div className="hidden h-full items-center gap-5 text-sm md:flex">
          <button 
            onClick={() => setView('CITIZEN_DASHBOARD')}
            className={`flex items-center gap-2 font-medium transition-colors hover:text-blue-400 cursor-pointer ${
              currentView === 'CITIZEN_DASHBOARD' ? 'text-blue-300 border-b-2 border-blue-400 pb-1' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard size={15} />
            Dashboard
          </button>
          <button 
            onClick={() => setView('CONSOLE')}
            className={`flex items-center gap-2 font-medium transition-colors hover:text-blue-400 cursor-pointer ${
              currentView === 'CONSOLE' ? 'text-blue-300 border-b-2 border-blue-400 pb-1' : 'text-slate-400'
            }`}
          >
            <FileSearch size={15} />
            Evidence Log
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setView('UPLOAD')}
          className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-medium px-4 py-2 rounded-lg border border-blue-500/30 transition-all duration-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] cursor-pointer"
        >
          <Upload size={16} />
          Upload Footage
        </button>
        
      </div>
    </nav>
  );
}
