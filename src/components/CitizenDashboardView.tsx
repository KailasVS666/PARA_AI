import React from 'react';
import { ViewState, DashboardStats } from '../types';
import {
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Zap,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

interface CitizenDashboardViewProps {
  setView: (view: ViewState) => void;
  stats: DashboardStats;
}

export default function CitizenDashboardView({
  setView,
  stats,
}: CitizenDashboardViewProps) {
  const hasActivity = stats.submitted > 0;
  const hasRewards = stats.rewards > 0;

  const statCards = [
    {
      label: 'Submitted',
      value: stats.submitted,
      note: 'Total reports',
      color: 'text-slate-100',
    },
    {
      label: 'Verified',
      value: stats.verified,
      note: 'Approved reports',
      color: 'text-emerald-400',
    },
    {
      label: 'Pending',
      value: stats.pending,
      note: 'Awaiting review',
      color: 'text-amber-400',
    },
    {
      label: 'Rejected',
      value: stats.rejected,
      note: 'Rejected reports',
      color: 'text-slate-400',
    },
    {
      label: 'Rewards Credits',
      value: stats.rewards,
      note: 'Earned credits',
      color: 'text-emerald-300',
    },
  ];

  return (
    <div className="min-h-screen flex-grow overflow-y-auto bg-slate-950 pb-16">
      {/* Welcome banner */}
      <section className="border-b border-slate-900/40 px-6 pb-7 pt-24 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-sm font-bold text-emerald-200">
            PA
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">
              PARA AI overview
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              AI-Based Road Violation Detection System
            </p>
          </div>
        </div>

        <button
          onClick={() => setView('UPLOAD')}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          <Zap size={14} />
          Analyze New Footage
        </button>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-7 px-6 py-7 sm:px-8 lg:px-10">
        {/* Real dashboard statistics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="glass-panel flex min-h-24 flex-col justify-between rounded-xl border border-slate-800/40 p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {card.label}
              </span>

              <div className="mt-4">
                <div
                  className={`font-display text-2xl font-bold tracking-tight ${card.color}`}
                >
                  {card.value.toLocaleString()}
                </div>

                <p className="mt-1 text-[11px] text-slate-500">
                  {card.note}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Analytics: honest empty states until real data is available */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Safety score */}
          <div className="glass-panel flex min-h-44 flex-col rounded-xl border border-slate-800/40 p-5">
            <ShieldCheck size={21} className="mb-3 text-emerald-400" />

            <h3 className="font-display text-base font-bold text-white">
              Precinct Safety Score
            </h3>

            <div className="flex flex-1 flex-col items-center justify-center py-3 text-center">
              <span className="text-2xl font-bold text-slate-500">
                --
              </span>

              <p className="text-xs text-slate-400 mt-2">
                No verified safety data available
              </p>
            </div>

            <p className="border-t border-slate-800 pt-3 text-[11px] text-slate-500">
              A safety score requires a defined calculation using real
              analysis results.
            </p>
          </div>

          {/* Violation distribution */}
          <div className="glass-panel flex min-h-44 flex-col rounded-xl border border-slate-800/40 p-5">
            <BarChart3 size={21} className="mb-3 text-emerald-400" />

            <h3 className="font-display text-base font-bold text-white">
              Violation Distribution
            </h3>

            <p className="text-xs text-slate-400 mt-2">
              Breakdown of detected road violations
            </p>

            <div className="flex flex-1 flex-col items-center justify-center py-3 text-center">
              <p className="text-sm text-slate-400">
                {hasActivity
                  ? 'Incident breakdown is not available in the current dashboard data.'
                  : 'No analysis results yet.'}
              </p>

              <p className="text-xs text-slate-500 mt-2">
                Real incident counts will be needed to calculate percentages.
              </p>
            </div>
          </div>

          {/* Rewards */}
          <div className="glass-panel flex min-h-44 flex-col rounded-xl border border-slate-800/40 p-5">
            <TrendingUp size={21} className="mb-3 text-emerald-400" />

            <h3 className="font-display text-base font-bold text-white">
              Rewards Overview
            </h3>

            <div className="flex flex-1 flex-col items-center justify-center py-3 text-center">
              <Sparkles size={28} className="text-slate-500 mb-3" />

              <p className="text-2xl font-black text-emerald-300">
                {stats.rewards.toLocaleString()} Cr
              </p>

              <p className="text-xs text-slate-400 mt-2">
                {hasRewards
                  ? 'Total reward credits reported by the backend.'
                  : 'No reward credits recorded yet.'}
              </p>
            </div>

            <p className="text-[10px] text-slate-500 border-t border-slate-800 pt-3">
              A historical earnings chart is not available yet.
            </p>
          </div>
        </section>

        {/* Recent activity */}
        <section className="glass-panel rounded-2xl p-6 border border-slate-800/40 space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Recent Verification Activity
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                Analysis activity
              </p>
            </div>

            <button
              onClick={() => setView('CONSOLE')}
              className="text-xs text-blue-300 hover:text-blue-400 flex items-center gap-1 font-semibold"
            >
              Go to Console
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">
              {hasActivity
                ? 'Activity history is not available in the current dashboard data.'
                : 'No activity recorded yet.'}
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Upload and analyze footage to get started.
            </p>

            <button
              onClick={() => setView('UPLOAD')}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold"
            >
              Analyze Footage
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}