'use client';

import { useState } from 'react';
import {
  Detection,
  getConfidenceTier,
  CONFIDENCE_STYLES,
  LESION_CLASS_LABELS,
} from '@/lib/types';

interface ResultsTableProps {
  detections: Detection[];
  processingTimeMs: number;
  onHighlight: (id: number | null) => void;
  highlightId: number | null;
}

function ConfidenceBadge({ score }: { score: number }) {
  const tier = getConfidenceTier(score);
  const pct = (score * 100).toFixed(1);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${CONFIDENCE_STYLES[tier]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tier === 'high'
            ? 'bg-emerald-400'
            : tier === 'medium'
            ? 'bg-yellow-400'
            : 'bg-red-400'
        }`}
      />
      {pct}%
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const tier = getConfidenceTier(score);
  const color =
    tier === 'high'
      ? 'bg-emerald-500'
      : tier === 'medium'
      ? 'bg-yellow-500'
      : 'bg-red-500';
  return (
    <div className="h-1 w-full rounded-full bg-navy-600 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${score * 100}%` }}
      />
    </div>
  );
}

export default function ResultsTable({
  detections,
  processingTimeMs,
  onHighlight,
  highlightId,
}: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<'id' | 'confidence' | 'class'>('id');
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...detections].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'id') cmp = a.id - b.id;
    else if (sortKey === 'confidence') cmp = a.class_confidence - b.class_confidence;
    else cmp = a.class_predicted.localeCompare(b.class_predicted);
    return sortAsc ? cmp : -cmp;
  });

  function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3 w-3 transition-colors ${active ? 'text-accent-light' : 'text-slate-600'}`}>
        {active ? (
          asc ? (
            <path d="M8 4l-4 6h8L8 4z" />
          ) : (
            <path d="M8 12l4-6H4l4 6z" />
          )
        ) : (
          <>
            <path d="M8 4l-3 4h6L8 4z" opacity=".4" />
            <path d="M8 12l3-4H5l3 4z" opacity=".4" />
          </>
        )}
      </svg>
    );
  }

  if (detections.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-light">
            <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
          </svg>
          Classification Results
        </h3>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-navy-600/50 bg-navy-800/50 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-400">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">No lesions detected</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The model found no suspicious regions in this radiograph
            </p>
          </div>
          <span className="text-xs text-slate-600 font-mono">
            Processed in {processingTimeMs} ms
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-light">
            <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
          </svg>
          Classification Results
        </h3>
        <span className="text-xs text-slate-500 font-mono">
          {detections.length} finding{detections.length > 1 ? 's' : ''}
          &nbsp;·&nbsp;{processingTimeMs} ms
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-navy-600/50">
        {/* Column headers */}
        <div className="grid grid-cols-[40px_1fr_auto_auto] gap-0 border-b border-navy-600/50 bg-navy-800/80 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <button onClick={() => toggleSort('id')} className="flex items-center gap-1 hover:text-slate-300 transition-colors text-left">
            ID <SortIcon active={sortKey === 'id'} asc={sortAsc} />
          </button>
          <button onClick={() => toggleSort('class')} className="flex items-center gap-1 hover:text-slate-300 transition-colors text-left">
            Class <SortIcon active={sortKey === 'class'} asc={sortAsc} />
          </button>
          <button onClick={() => toggleSort('confidence')} className="flex items-center gap-1 hover:text-slate-300 transition-colors">
            Confidence <SortIcon active={sortKey === 'confidence'} asc={sortAsc} />
          </button>
          <span>Action</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-navy-600/30">
          {sorted.map((det) => {
            const isHl = highlightId === det.id;
            return (
              <div
                key={det.id}
                className={`
                  grid grid-cols-[40px_1fr_auto_auto] gap-0 items-center px-4 py-3 transition-colors cursor-pointer
                  ${isHl
                    ? 'bg-accent/10 border-l-2 border-l-accent-light'
                    : 'bg-navy-800/30 hover:bg-navy-700/50 border-l-2 border-l-transparent'
                  }
                `}
                onClick={() => onHighlight(isHl ? null : det.id)}
              >
                {/* ID */}
                <div
                  className={`
                    flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold
                    ${isHl
                      ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
                      : 'bg-lesion-red/20 text-red-400'
                    }
                  `}
                >
                  {det.id}
                </div>

                {/* Class info */}
                <div className="min-w-0 px-3">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white capitalize">
                      {LESION_CLASS_LABELS[det.class_predicted] ?? det.class_predicted}
                    </p>
                  </div>
                  <div className="mt-1.5">
                    <ConfidenceBar score={det.class_confidence} />
                  </div>
                </div>

                {/* Confidence badge */}
                <div className="px-2">
                  <ConfidenceBadge score={det.class_confidence} />
                </div>

                {/* Highlight action */}
                <div className="pl-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onHighlight(isHl ? null : det.id); }}
                    className={`
                      flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all
                      ${isHl
                        ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                        : 'bg-navy-700 text-slate-400 hover:bg-navy-600 hover:text-white'
                      }
                    `}
                    title={isHl ? 'Clear highlight' : 'Highlight on image'}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3a1 1 0 011 1v2h2a1 1 0 110 2H9a1 1 0 01-1-1V6a1 1 0 011-1z" />
                    </svg>
                    {isHl ? 'Clear' : 'Focus'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> ≥ 90% High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> 70–89% Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" /> &lt; 70% Low
        </span>
      </div>
    </div>
  );
}
