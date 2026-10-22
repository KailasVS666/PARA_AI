import React from 'react';
import { ViewState } from '../types';
import { SubmissionSummary } from '../types';
import { Home, Receipt, Clock, AlertCircle, Sparkles } from 'lucide-react';

interface SuccessViewProps {
  setView: (view: ViewState) => void;
  fileName: string;
  submission: SubmissionSummary | null;
}

export default function SuccessView({ setView, fileName, submission }: SuccessViewProps) {
  // Dynamic Local Time Extraction
  const getSubmissionTime = () => {
    const now = submission?.submittedAt ? new Date(submission.submittedAt) : new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 md:p-12">
      {/* Background Atmospheric Glow */}
      <div className="absolute inset-0 w-full h-full ambient-glow pointer-events-none z-0"></div>

      {/* Main Success Card */}
      <main className="relative z-10 flex w-full max-w-2xl flex-col items-center rounded-2xl border border-slate-800/60 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl md:p-10">
        
        {/* Animated Checkmark */}
        <div className="mb-8 check-wrapper">
          <svg className="w-24 h-24" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
            <circle className="check-circle" cx="26" cy="26" r="25"></circle>
            <path className="check-path" d="M14.1 27.2l7.1 7.2 16.7-16.8"></path>
          </svg>
        </div>

        {/* Header Information */}
        <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 text-center tracking-tight">
          {submission?.deliveryMode === 'mock' ? 'Mock Government Report Ready' : 'Report Delivered Successfully'}
        </h1>

        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 py-1.5 px-4 rounded-full mb-10">
          <Receipt size={14} className="text-blue-300" />
          <span className="font-display text-[10px] text-blue-300 font-bold uppercase tracking-wider">
            {submission?.deliveryMode === 'mock' ? 'Mock reference' : 'Government receipt'}: {submission?.trackingId || 'Accepted — no tracking ID returned'}
          </span>
        </div>

        <p className="-mt-6 mb-8 max-w-full truncate text-center text-xs text-slate-400" title={fileName}>
          Source video: <span className="font-mono text-slate-200">{fileName || 'Filename unavailable'}</span>
        </p>

        {/* Details Bento Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {/* Bento Box: Submission Time */}
          <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/40 flex flex-col items-center sm:items-start text-center sm:text-left hover:bg-slate-900/50 transition-colors duration-300">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-slate-500" />
              <span className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Submission Time
              </span>
            </div>
            <span className="font-display text-lg font-bold text-slate-100 mt-1">
              {getSubmissionTime()}
            </span>
          </div>

          {/* Bento Box: Incidents Reported */}
          <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/40 flex flex-col items-center sm:items-start text-center sm:text-left hover:bg-slate-900/50 transition-colors duration-300">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-slate-500" />
              <span className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Incidents Detected
              </span>
            </div>
            <span className="font-display text-lg font-bold text-slate-100 mt-1">
              {submission?.incidentCount ?? 0}
            </span>
          </div>

          {/* Bento Box: Reward Status */}
          <div className="bg-slate-950/50 rounded-xl p-5 border border-emerald-500/20 relative overflow-hidden flex flex-col items-center sm:items-start text-center sm:text-left hover:bg-slate-900/50 transition-colors duration-300">
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-emerald-400" />
              <span className="font-display text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                {submission?.deliveryMode === 'mock'
                  ? 'Demo reward status'
                  : submission?.rewardCredits
                    ? 'Reward awarded'
                    : 'Reward total'}
              </span>
            </div>
            <span className="font-display text-lg font-bold text-emerald-300 mt-1">
              {submission?.deliveryMode === 'mock'
                ? 'Not issued'
                : `${submission?.rewardCredits ?? 0} Cr`}
            </span>
          </div>
        </div>

        {submission?.governmentResponse && <p className="mt-6 text-center text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{submission.governmentResponse}</p>}
        {submission?.reportText && <pre className="mt-4 w-full whitespace-pre-wrap text-left text-xs leading-5 text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-4 font-sans">{submission.reportText}</pre>}

        {/* Action Button */}
        <div className="flex w-full justify-center">
          <button 
            onClick={() => setView('CITIZEN_DASHBOARD')}
            className="bg-blue-500 hover:bg-blue-400 text-white hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_4px_20px_rgba(59,130,246,0.2)] hover:shadow-[0_4px_25px_rgba(59,130,246,0.3)] px-8 py-3.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home size={16} />
            Return to Dashboard
          </button>
          
        </div>
      </main>
    </div>
  );
}
