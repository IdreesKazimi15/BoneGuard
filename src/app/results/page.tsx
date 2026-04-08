'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import DetectionCanvas from '../components/DetectionCanvas';
import ResultsTable from '../components/ResultsTable';
import GradCAMViewer from '../components/GradCAMViewer';
import ErrorMessage from '../components/ErrorMessage';
import { AnalysisResult, SESSION_KEY } from '@/lib/types';
import ChatPanel from '../components/ChatPanel';
import { downloadDataUrl, downloadJson } from '@/lib/imageProcessing';
import { downloadPdfReport } from '@/lib/pdf';

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [annotatedPngUrl, setAnnotatedPngUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) { router.replace('/'); return; }
      setResult(JSON.parse(raw) as AnalysisResult);
    } catch {
      setLoadError('Failed to load analysis results. Please run a new analysis.');
    }
  }, [router]);

  const handleCanvasReady = useCallback((dataUrl: string) => {
    setAnnotatedPngUrl(dataUrl);
  }, []);

  function handleDownloadPng() {
    if (!annotatedPngUrl || !result) return;
    const ts = new Date(result.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadDataUrl(annotatedPngUrl, `boneguard_${ts}.png`);
  }

  function handleDownloadJson() {
    if (!result) return;
    const ts = new Date(result.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(
      {
        filename: result.filename,
        timestamp: result.timestamp,
        confidence_threshold_applied: confidenceThreshold,
        image_dimensions: { width: result.imageWidth, height: result.imageHeight },
        ...result.predictions,
        detections: filteredDetections,
      },
      `boneguard_${ts}.json`
    );
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setIsPdfGenerating(true);
    try {
      await downloadPdfReport({ ...result, predictions: { ...result.predictions, detections: filteredDetections } }, annotatedPngUrl ?? undefined);
    } finally {
      setIsPdfGenerating(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-navy-900 bg-grid">
        <Header />
        <div className="mx-auto max-w-2xl px-4 pt-20">
          <ErrorMessage title="Could Not Load Results" message={loadError} onRetry={() => router.push('/')} />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-t-accent border-r-transparent border-b-transparent border-l-transparent" />
      </div>
    );
  }

  const { predictions, imageBase64, imageWidth, imageHeight, filename, timestamp } = result;
  const allDetections = predictions.detections ?? [];
  const filteredDetections = allDetections.filter(
    (d) => d.class_confidence >= confidenceThreshold
  );
  const formattedTime = new Date(timestamp).toLocaleString();

  return (
    <div className="min-h-screen bg-navy-900 bg-grid">
      <Header showNewAnalysis />

      <main className="w-full px-6 pb-16 pt-8 sm:px-10 lg:px-16 xl:px-24">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Analysis Results</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M2 6a2 2 0 012-2h8a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                {filename}
              </span>
              <span>·</span>
              <span>{formattedTime}</span>
              <span>·</span>
              <span className="font-mono">{imageWidth} × {imageHeight}</span>
            </div>
          </div>

          {/* Download buttons */}
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-2 rounded-xl border border-navy-500 bg-navy-800 px-4 py-2 text-sm font-medium text-slate-300 hover:border-accent/50 hover:text-accent-light transition-all"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              JSON
            </button>

            <button
              onClick={handleDownloadPng}
              disabled={!annotatedPngUrl}
              className="flex items-center gap-2 rounded-xl border border-navy-500 bg-navy-800 px-4 py-2 text-sm font-medium text-slate-300 hover:border-accent/50 hover:text-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              PNG
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-blue hover:shadow-[0_0_24px_rgba(59,130,246,0.4)]"
            >
              {isPdfGenerating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Building PDF...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  PDF Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in [animation-delay:0.05s]">
          {[
            {
              label: 'Lesions Found',
              value: `${filteredDetections.length}${confidenceThreshold > 0 ? ` / ${allDetections.length}` : ''}`,
              color: filteredDetections.length === 0 ? 'text-emerald-400' : 'text-red-400',
              bg: filteredDetections.length === 0 ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-red-500/20 bg-red-500/8',
            },
            {
              label: 'Avg Confidence',
              value: filteredDetections.length
                ? `${((filteredDetections.reduce((s, d) => s + d.class_confidence, 0) / filteredDetections.length) * 100).toFixed(1)}%`
                : '—',
              color: 'text-accent-light',
              bg: 'border-accent/20 bg-accent/8',
            },
            {
              label: 'Processing Time',
              value: `${predictions.processing_time_ms} ms`,
              color: 'text-purple-400',
              bg: 'border-purple-500/20 bg-purple-500/8',
            },
            {
              label: 'Heatmaps',
              value: filteredDetections.filter((d) => d.grad_cam).length,
              color: 'text-orange-400',
              bg: 'border-orange-500/20 bg-orange-500/8',
            },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`card-inner flex flex-col gap-1 px-4 py-3 border ${bg}`}>
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* ── Confidence threshold slider ── */}
        <div className="mb-6 card p-4 animate-fade-in [animation-delay:0.08s]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-light">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-white whitespace-nowrap">
                Confidence Filter
              </span>
            </div>

            <div className="flex-1 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={confidenceThreshold}
                onChange={(e) => {
                  setConfidenceThreshold(parseFloat(e.target.value));
                  setHighlightId(null);
                }}
                className="flex-1 accent-accent"
              />
              <span className="w-12 text-right text-sm font-mono font-semibold text-accent-light tabular-nums">
                {Math.round(confidenceThreshold * 100)}%
              </span>
            </div>

            <div className="shrink-0 flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">Showing</span>
              <span className={`font-semibold tabular-nums ${filteredDetections.length < allDetections.length ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {filteredDetections.length}/{allDetections.length}
              </span>
              <span className="hidden sm:inline">detections</span>
            </div>

            {confidenceThreshold > 0 && (
              <button
                onClick={() => setConfidenceThreshold(0)}
                className="shrink-0 text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Reset
              </button>
            )}
          </div>

          {/* Tier markers */}
          <div className="mt-2 flex justify-between px-1 text-[10px] text-slate-600 select-none pointer-events-none">
            <span>0%</span>
            <span className="text-red-500/60">Low &lt;70%</span>
            <span className="text-yellow-500/60">Medium 70%</span>
            <span className="text-emerald-500/60">High 90%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-slide-up [animation-delay:0.1s]">
          {/* Left: Canvas */}
          <div className="card p-5 sm:p-6 space-y-4">
            <DetectionCanvas
              imageBase64={imageBase64}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              detections={filteredDetections}
              highlightId={highlightId}
              onCanvasReady={handleCanvasReady}
            />
          </div>

          {/* Right: Table + Grad-CAM */}
          <div className="space-y-6">
            <div className="card p-5 sm:p-6">
              <ResultsTable
                detections={filteredDetections}
                processingTimeMs={predictions.processing_time_ms}
                onHighlight={setHighlightId}
                highlightId={highlightId}
              />
            </div>

            {filteredDetections.length > 0 && (
              <div className="card p-5 sm:p-6">
                <GradCAMViewer
                  detections={filteredDetections}
                  imageBase64={imageBase64}
                  highlightId={highlightId}
                />
              </div>
            )}
          </div>
        </div>

        <ChatPanel analysisResult={result} />

      </main>
    </div>
  );
}
