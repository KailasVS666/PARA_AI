import {
  LayoutDashboard,
  FileSearch,
  HelpCircle,
  Home,
  ShieldCheck,
} from 'lucide-react';

import type { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export default function Sidebar({
  currentView,
  setView,
}: SidebarProps) {
  const navigation = [
    {
      label: 'Overview',
      icon: LayoutDashboard,
      view: 'CITIZEN_DASHBOARD' as ViewState,
    },
    {
      label: 'Evidence Log',
      icon: FileSearch,
      view: 'CONSOLE' as ViewState,
    },
  ];

  return (
    <aside className="flex h-full min-h-screen w-60 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950 text-slate-200">
      {/* Brand */}
      <button
        type="button"
        onClick={() => setView('LANDING')}
        className="flex items-center gap-3 border-b border-slate-800/80 px-5 py-6 text-left transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset"
        aria-label="Return to PARA home"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <ShieldCheck size={24} />
        </div>

        <div>
          <div className="text-lg font-bold tracking-wide text-white">
            PARA
          </div>
          <div className="text-xs text-slate-500">
            Verification Console
          </div>
        </div>
      </button>

      {/* Navigation */}
      <nav
        className="flex-1 space-y-1.5 px-3 py-6"
        aria-label="Main navigation"
      >
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Workspace
        </p>

        {navigation.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.view;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setView(item.view)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                active
                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span>{item.label}</span>

              {active && (
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Help */}
      <div className="border-t border-slate-800/80 p-4">
        <div className="mb-3 rounded-lg bg-slate-900/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <HelpCircle size={17} className="text-emerald-400" />
            Need help?
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Use the Evidence Log to review detected incidents and
            approve or reject individual findings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setView('LANDING')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Home size={18} />
          <span>Return to Home</span>
        </button>

        <div className="px-3 pb-2 pt-4 text-xs text-slate-600">
          PARA · Demonstration Console
        </div>
      </div>
    </aside>
  );
}