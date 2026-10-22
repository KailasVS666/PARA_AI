import React, { useEffect, useRef, useState } from 'react';
import { ApiRequestError, type ApiReport } from '../api';
import type { ViewState, Incident } from '../types';
import {
  Check,
  X,
  Sparkles,
  Eye,
  Cpu,
  Search,
  Filter,
  ShieldAlert,
  FileSearch,
  Upload,
  Video,
} from 'lucide-react';

interface ConsoleViewProps {
  setView: (view: ViewState) => void;
  report: ApiReport | null;
  incidents: Incident[];
  onReview: (
    incidentId: string,
    action: 'APPROVE' | 'REJECT'
  ) => Promise<Incident>;
  onSubmit: () => Promise<void>;
  canSubmit: boolean;
}

const INCIDENT_TYPES = [
  'All',
  'Helmet Violations',
  'Potholes',
  'Other',
];

function formatConfidence(value: number): string {
  if (!Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function getOcrStatus(incident: Incident): string {
  const plate = incident.licensePlate?.trim().toUpperCase();
  const confidence = incident.ocrConfidence;

  if (
    !plate ||
    plate === 'UNKNOWN' ||
    plate === '--' ||
    plate === 'N/A'
  ) {
    return 'Plate not recognized';
  }

  if (typeof confidence !== 'number' || confidence <= 0) {
    return 'Recognition confidence unavailable';
  }

  return `OCR confidence: ${confidence.toFixed(1)}%`;
}

export default function ConsoleView({
  setView,
  report,
  incidents,
  onReview,
  onSubmit,
  canSubmit,
}: ConsoleViewProps) {
  const [selectedId, setSelectedId] = useState<string>(
    incidents[0]?.id || ''
  );
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [evidenceLoadError, setEvidenceLoadError] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeIncident =
    incidents.find((incident) => incident.id === selectedId) ||
    incidents[0];

  const countPendingByType = (type: string) =>
    incidents.filter(
      (incident) =>
        incident.type === type && incident.status === 'Pending'
    ).length;

  const pendingCount = incidents.filter(
    (incident) => incident.status === 'Pending'
  ).length;

  const verifiedCount = incidents.filter(
    (incident) => incident.status === 'Verified'
  ).length;

  const rejectedCount = incidents.filter(
    (incident) => incident.status === 'Rejected'
  ).length;

  useEffect(() => {
    if (!incidents.some((incident) => incident.id === selectedId)) {
      setSelectedId(incidents[0]?.id || '');
    }
  }, [incidents, selectedId]);

  useEffect(() => {
    const incident = incidents.find(
      (item) => item.id === selectedId
    );

    const player = videoRef.current;

    if (!incident || !player || typeof incident.timestampSeconds !== 'number' || !Number.isFinite(incident.timestampSeconds)) return;

    const seek = () => {
      try {
        player.currentTime = Math.max(0, incident.timestampSeconds ?? 0);
      } catch {
        // The video may not be ready to seek yet.
      }
    };

    if (player.readyState >= 1) {
      seek();
      return;
    }

    player.addEventListener('loadedmetadata', seek, { once: true });
    return () => player.removeEventListener('loadedmetadata', seek);
  }, [incidents, selectedId]);

  useEffect(() => {
    setEvidenceLoadError(false);
    setVideoLoadError(false);
  }, [activeIncident?.id, activeIncident?.evidenceUrl, activeIncident?.videoUrl]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToastMessage(message);

    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  };

  const handleAction = async (
    id: string,
    action: 'APPROVE' | 'REJECT'
  ) => {
    const incident = incidents.find((item) => item.id === id);

    if (!incident) return;

    if (incident.status !== 'Pending') {
      showToast(`This incident is already ${incident.status.toLowerCase()}.`);
      return;
    }

    if (reviewingId) return;

    setReviewingId(id);

    try {
      const reviewedIncident = await onReview(id, action);

      showToast(
        action === 'APPROVE'
          ? `Incident approved.${reviewedIncident.rewardCr > 0 ? ` +${reviewedIncident.rewardCr} credits.` : ''}`
          : 'Incident rejected as a false positive.'
      );

    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        showToast('This incident was already reviewed elsewhere. Its status was refreshed.');
      } else if (error instanceof TypeError) {
        showToast('Network error while saving the review. Please try again.');
      } else {
        showToast(error instanceof Error ? error.message : 'Unable to save the review.');
      }
    } finally {
      setReviewingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Report submission failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredIncidents = incidents.filter((incident) => {
    const matchesFilter =
      filterType === 'All' || incident.type === filterType;

    const searchableText = [
      incident.title,
      incident.licensePlate,
      incident.trackingId,
      incident.type,
      incident.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      matchesFilter &&
      searchableText.includes(normalizedSearch)
    );
  });

  const ocrStatus = activeIncident
    ? getOcrStatus(activeIncident)
    : '';

  const jumpToIncident = () => {
    const player = videoRef.current;
    const timestamp = activeIncident?.timestampSeconds;

    if (!player || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      showToast('No valid backend timestamp is available for this incident.');
      return;
    }

    const seek = () => {
      player.currentTime = Math.max(0, timestamp);
      void player.play().catch(() => showToast('Unable to play the video. Try the video controls.'));
    };

    if (player.readyState >= 1) {
      seek();
    } else {
      player.addEventListener('loadedmetadata', seek, { once: true });
    }
  };

  const hasActiveReport = Boolean(report);
  const analysisComplete = report?.status === 'READY_FOR_REVIEW';

  return (
    <div className="min-h-screen min-w-0 flex-1 overflow-y-auto bg-slate-950 text-slate-200">
      {/* Toast notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 top-6 z-50 flex max-w-md items-center gap-3 rounded-xl border border-blue-400/30 bg-slate-900 px-5 py-3 text-blue-300 shadow-2xl"
        >
          <Sparkles size={18} />
          <span className="text-sm font-semibold">
            {toastMessage}
          </span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-slate-800/70 bg-slate-950/95 px-6 py-4 backdrop-blur-xl lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <ShieldAlert size={21} />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-white">
              Evidence Log
            </h1>
            <p className="max-w-[min(52vw,34rem)] truncate text-xs text-slate-500">
              {report?.filename || 'No report selected'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isSubmitting}
              aria-describedby={!canSubmit ? 'submit-report-help' : undefined}
              title={canSubmit ? 'Submit the approved incidents in this report.' : 'Approve at least one incident to enable submission.'}
              className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
                canSubmit
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60'
                  : 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-500'
              }`}
            >
              {isSubmitting ? 'Submitting…' : 'Submit Verified Report'}
            </button>
            {!canSubmit && (
              <span id="submit-report-help" className="hidden max-w-44 text-[11px] leading-4 text-slate-500 lg:inline">
                Approve an incident to enable submission.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setView('UPLOAD')}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Upload size={14} />
            Upload New Video
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Pending', pendingCount, 'text-blue-300'],
            ['Verified', verifiedCount, 'text-emerald-300'],
            ['Rejected', rejectedCount, 'text-red-300'],
            ['Total', incidents.length, 'text-white'],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-1 py-3 sm:block sm:border-b-0 sm:border-l sm:px-5 first:sm:border-l-0 first:sm:pl-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
              <span className={`text-2xl font-bold ${color}`}>{hasActiveReport ? value : '—'}</span>
            </div>
          ))}
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(280px,340px)]">
          <section className="min-w-0 xl:sticky xl:top-28">
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <FileSearch size={15} className="text-emerald-400" />
                Incidents
              </div>
                {report ? (
                  <>
                    <p className="truncate text-sm font-semibold text-slate-200" title={report.filename}>
                      {report.filename}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-600" title={report.id}>
                      Report {report.id}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-400">No report selected</p>
                )}
            </div>

            <div className="space-y-3 pb-1">
            <div className="relative shrink-0">
              <Search
                className="absolute left-3.5 top-3 text-slate-500"
                size={16}
              />

              <input
                type="search"
                aria-label="Search incidents"
                placeholder="Search plate, type, ID, or status…"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-3 pl-10 pr-4 text-xs font-medium text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
              />
            </div>

            <div className="flex flex-wrap gap-2 pb-1">
              {INCIDENT_TYPES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilterType(category)}
                  aria-pressed={filterType === category}
                  className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    filterType === category
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                      : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {category === 'Helmet Violations' ? 'Helmet' : category}
                </button>
              ))}
            </div>
            </div>

          <div className="max-h-[min(62vh,680px)] min-h-0 space-y-3 overflow-y-auto overflow-x-hidden px-1 pb-2 pr-3 [scrollbar-gutter:stable]">
            {incidents.length === 0 ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
                <FileSearch
                  size={38}
                  className="mb-4 text-slate-700"
                />
                <h3 className="font-semibold text-slate-300">
                  {!hasActiveReport
                    ? 'No report selected'
                    : analysisComplete
                      ? 'No incidents detected'
                      : 'No incidents to review'}
                </h3>
                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                  {!hasActiveReport
                    ? 'Upload road footage and run an analysis to review detected incidents.'
                    : analysisComplete
                      ? 'The completed analysis returned no incidents requiring review.'
                      : 'Run the analysis to see detected incidents here.'}
                </p>
                <button
                  type="button"
                  onClick={() => setView('UPLOAD')}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  <Upload size={14} />
                  Upload Video
                </button>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Filter
                  size={30}
                  className="mx-auto mb-3 opacity-40"
                />
                <p className="text-xs">
                  No incidents match your search or filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('All');
                    setSearchQuery('');
                  }}
                  className="mt-3 text-xs text-blue-300 hover:text-blue-200"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const selected = selectedId === incident.id;

                return (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => setSelectedId(incident.id)}
                    aria-pressed={selected}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selected
                        ? 'border-emerald-500/50 bg-emerald-500/[0.06] shadow-[inset_3px_0_0_rgba(52,211,153,0.8)]'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              incident.severity === 'High'
                                ? 'bg-red-400'
                                : incident.severity === 'Medium'
                                  ? 'bg-amber-400'
                                  : 'bg-blue-400'
                            }`}
                          />

                          <h3 className="text-sm font-bold leading-5 text-slate-200">
                            {incident.title}
                          </h3>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-semibold text-emerald-300">{incident.type}</span>
                          <span aria-hidden="true">·</span>
                          <span>{incident.trackingId}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{incident.time}</span>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                          incident.status === 'Verified'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : incident.status === 'Rejected'
                              ? 'border-red-500/20 bg-red-500/10 text-red-400'
                              : 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                        }`}
                      >
                        {incident.status}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/70 pt-3 text-[11px]">
                      <span className="text-slate-500">
                        Plate:{' '}
                        <span className="font-mono font-semibold text-slate-200">
                          {incident.licensePlate || 'UNKNOWN'}
                        </span>
                      </span>

                      <span className="text-slate-500">
                        Detection:{' '}
                        <span className="font-mono font-bold text-blue-300">
                          {formatConfidence(incident.confidence)}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          </section>

          <section className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Eye size={15} className="text-emerald-400" />
                  Evidence review
                </div>
                <h2 className="mt-1 truncate text-lg font-bold text-white">
                  {activeIncident?.title || 'Select an incident'}
                </h2>
              </div>
              {activeIncident && <span className="shrink-0 font-mono text-xs text-slate-500">{activeIncident.time}</span>}
            </div>

            {activeIncident ? (
              <div className="space-y-5">
                <div className="relative flex aspect-video min-h-[240px] max-h-[430px] items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/5">
                  {activeIncident.evidenceUrl && !evidenceLoadError ? (
                    <img
                      key={activeIncident.evidenceUrl}
                      src={activeIncident.evidenceUrl}
                      alt={`Evidence for ${activeIncident.title}`}
                      className="h-full w-full object-contain"
                      onError={() => setEvidenceLoadError(true)}
                    />
                  ) : (
                    <div className="px-6 text-center">
                      <FileSearch size={40} className="mx-auto mb-3 text-slate-700" />
                      <p className="text-sm text-slate-400">
                        {evidenceLoadError
                          ? 'The evidence image could not be loaded.'
                          : 'No evidence image is available for this incident.'}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs leading-5 text-slate-500">Evidence is shown without an overlay because verified coordinates are not available for reliable alignment.</p>

                {activeIncident.videoUrl && !videoLoadError && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Video size={16} className="text-emerald-400" />Source video</div>
                      <span className="text-xs text-slate-500">Incident at {activeIncident.time}</span>
                    </div>
                    <video ref={videoRef} key={activeIncident.videoUrl} src={activeIncident.videoUrl} controls preload="metadata" onError={() => setVideoLoadError(true)} className="max-h-[240px] w-full rounded-xl bg-black shadow-lg">
                      Your browser does not support video playback.
                    </video>
                    <button type="button" onClick={jumpToIncident} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/10">
                      Jump to incident · {activeIncident.time}
                    </button>
                  </div>
                )}
                {activeIncident.videoUrl && videoLoadError && (
                  <p className="rounded-lg bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
                    The source video could not be loaded. The incident timestamp is {activeIncident.time}.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-slate-900/50 px-6 text-center ring-1 ring-white/5"><div><FileSearch size={38} className="mx-auto mb-4 text-slate-700" /><p className="text-sm font-semibold text-slate-300">{hasActiveReport ? 'No incident selected' : 'No report selected'}</p><p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{hasActiveReport ? 'Choose an incident from the list to inspect its evidence.' : 'Upload road footage and run an analysis to review detected incidents.'}</p>{!hasActiveReport && <button type="button" onClick={() => setView('UPLOAD')} className="mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400">Upload Video</button>}</div></div>
            )}
          </section>

          <aside className="min-w-0 xl:sticky xl:top-28">
            {activeIncident ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incident details</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${activeIncident.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-300' : activeIncident.status === 'Rejected' ? 'bg-red-500/10 text-red-300' : 'bg-blue-500/10 text-blue-300'}`}>{activeIncident.status}</span>
                  </div>
                  <p className="break-all font-mono text-[10px] text-slate-600">ID {activeIncident.id}</p>
                </div>

                <dl className="space-y-4 text-sm">
                  <div><dt className="text-xs text-slate-500">Category</dt><dd className="mt-1 font-semibold text-slate-200">{activeIncident.type}</dd></div>
                  <div><dt className="text-xs text-slate-500">Title</dt><dd className="mt-1 font-semibold text-slate-200">{activeIncident.title}</dd></div>
                  <div className="grid grid-cols-2 gap-4"><div><dt className="text-xs text-slate-500">Timestamp</dt><dd className="mt-1 font-mono text-slate-200">{activeIncident.time}</dd></div><div><dt className="text-xs text-slate-500">Plate</dt><dd className="mt-1 break-words font-mono font-semibold text-slate-200">{activeIncident.licensePlate || 'UNKNOWN'}</dd></div></div>
                </dl>

                <div>
                  <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Detection confidence</span><span className="font-mono font-bold text-blue-300">{formatConfidence(activeIncident.confidence)}</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, Math.max(0, activeIncident.confidence))}%` }} /></div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">This is incident detection confidence, not OCR confidence.</p>
                </div>

                <div className="border-t border-slate-800/80 pt-4"><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Plate reading</span><span className="text-xs text-slate-400">{ocrStatus}</span></div><p className="mt-2 font-mono text-lg font-bold tracking-wide text-slate-100">{activeIncident.licensePlate || 'UNKNOWN'}</p></div>

                <div className="border-t border-slate-800/80 pt-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><Cpu size={14} className="text-emerald-400" />Analysis</div><p className="text-xs leading-5 text-slate-400">{activeIncident.aiAnalysis || 'No additional model details are available.'}</p></div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-5">
                  <button type="button" onClick={() => void handleAction(activeIncident.id, 'REJECT')} disabled={activeIncident.status !== 'Pending' || reviewingId !== null} className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"><X size={15} />{reviewingId === activeIncident.id ? 'Saving…' : 'Reject'}</button>
                  <button type="button" onClick={() => void handleAction(activeIncident.id, 'APPROVE')} disabled={activeIncident.status !== 'Pending' || reviewingId !== null} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-3 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"><Check size={15} />{reviewingId === activeIncident.id ? 'Saving…' : 'Approve'}</button>
                </div>
              </div>
            ) : <p className="text-sm text-slate-500">Incident details will appear here after selection.</p>}
          </aside>
        </div>
      </main>
    </div>
  );
}