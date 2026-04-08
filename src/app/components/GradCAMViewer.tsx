'use client';

import { useState } from 'react';
import { Detection, getConfidenceTier, LESION_CLASS_LABELS } from '@/lib/types';

interface GradCAMViewerProps {
  detections: Detection[];
  imageBase64: string;
  highlightId: number | null;
}

type ViewMode = 'heatmap' | 'original' | 'overlay';

export default function GradCAMViewer({
  detections,
  imageBase64,
  highlightId,
}: GradCAMViewerProps) {
  const withCam = detections.filter((d) => d.grad_cam);
  const [activeId, setActiveId] = useState<number>(
    withCam[0]?.id ?? detections[0]?.id ?? 0
  );
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [opacity, setOpacity] = useState(0.65);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync active ID with highlight from table
  useState(() => {
    if (highlightId !== null && detections.some((d) => d.id === highlightId)) {
      setActiveId(highlightId);
    }
  });

  const active = detections.find((d) => d.id === activeId);
  const hasGradCam = !!active?.grad_cam;

  if (detections.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between group"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-orange-400">
            <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
          </svg>
          Grad-CAM Explanation
          {hasGradCam && (
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              ACTIVE
            </span>
          )}
        </h3>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-3 animate-fade-in">
          {/* Detection selector */}
          {detections.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {detections.map((det) => {
                const hasCam = !!det.grad_cam;
                const isActive = det.id === activeId;
                const tier = getConfidenceTier(det.class_confidence);
                const dotColor =
                  tier === 'high'
                    ? 'bg-emerald-400'
                    : tier === 'medium'
                    ? 'bg-yellow-400'
                    : 'bg-red-400';
                return (
                  <button
                    key={det.id}
                    onClick={() => setActiveId(det.id)}
                    className={`
                      flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all
                      ${isActive
                        ? 'border-accent/60 bg-accent/15 text-accent-light'
                        : 'border-navy-500 bg-navy-700 text-slate-400 hover:border-navy-400 hover:text-slate-300'
                      }
                      ${!hasCam ? 'opacity-50' : ''}
                    `}
                    title={hasCam ? '' : 'No Grad-CAM for this detection'}
                  >
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    Lesion #{det.id}
                    {!hasCam && (
                      <span className="text-slate-600">(no cam)</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* View mode toggle */}
          {hasGradCam && (
            <div className="flex items-center gap-1 rounded-xl border border-navy-600/50 bg-navy-800 p-1">
              {(['heatmap', 'overlay', 'original'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`
                    flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all
                    ${viewMode === mode
                      ? 'bg-navy-700 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300'
                    }
                  `}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {/* Image display */}
          <div className="relative overflow-hidden rounded-xl border border-navy-600/50 bg-black">
            {hasGradCam ? (
              <div className="relative">
                {/* Base: always show original or heatmap */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    viewMode === 'original'
                      ? imageBase64
                      : `data:image/png;base64,${active!.grad_cam}`
                  }
                  alt={viewMode === 'original' ? 'Original ROI' : 'Grad-CAM heatmap'}
                  className="w-full object-contain max-h-64"
                />

                {/* Overlay mode */}
                {viewMode === 'overlay' && (
                  <div className="absolute inset-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageBase64}
                      alt="Original overlay"
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ opacity: 1 - opacity }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${active!.grad_cam}`}
                      alt="Heatmap overlay"
                      className="absolute inset-0 w-full h-full object-contain mix-blend-screen"
                      style={{ opacity }}
                    />
                  </div>
                )}

                {/* Mode badge */}
                <div className="absolute top-2 left-2">
                  <span className={`
                    rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm
                    ${viewMode === 'heatmap'
                      ? 'border-orange-500/40 bg-orange-500/20 text-orange-400'
                      : viewMode === 'overlay'
                      ? 'border-purple-500/40 bg-purple-500/20 text-purple-400'
                      : 'border-navy-500/40 bg-navy-800/80 text-slate-400'
                    }
                  `}>
                    {viewMode}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-navy-500 bg-navy-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-500">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-400">No Grad-CAM available</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    The backend did not return a heatmap for lesion #{activeId}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Opacity slider (overlay mode) */}
          {viewMode === 'overlay' && hasGradCam && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500 w-20 shrink-0">Heatmap opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="flex-1 h-1.5 appearance-none rounded-full bg-navy-600 accent-accent cursor-pointer"
              />
              <span className="text-slate-400 w-10 text-right tabular-nums">
                {Math.round(opacity * 100)}%
              </span>
            </div>
          )}

          {/* Active detection info */}
          {active && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-navy-600/50 bg-navy-800/50 px-3 py-2">
                <p className="text-slate-500 mb-1">Detection conf.</p>
                <p className="font-semibold text-white tabular-nums">
                  {(active.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-navy-600/50 bg-navy-800/50 px-3 py-2">
                <p className="text-slate-500 mb-1">Classification</p>
                <p className="font-semibold text-white capitalize truncate">
                  {LESION_CLASS_LABELS[active.class_predicted] ?? active.class_predicted}
                </p>
              </div>
              <div className="rounded-lg border border-navy-600/50 bg-navy-800/50 px-3 py-2">
                <p className="text-slate-500 mb-1">Class conf.</p>
                <p className="font-semibold text-white tabular-nums">
                  {(active.class_confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-navy-600/50 bg-navy-800/50 px-3 py-2">
                <p className="text-slate-500 mb-1">BBox</p>
                <p className="font-mono text-[10px] text-white leading-relaxed">
                  [{active.bbox.map((v) => Math.round(v)).join(', ')}]
                </p>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Grad-CAM highlights regions that most influenced the classification. Warmer colors (red/yellow) indicate higher model attention. For research use only — not a clinical tool.
          </p>
        </div>
      )}
    </div>
  );
}
