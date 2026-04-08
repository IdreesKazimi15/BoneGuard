'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Detection } from '@/lib/types';
import { renderDetections, loadImage, canvasToDataUrl } from '@/lib/imageProcessing';

interface DetectionCanvasProps {
  imageBase64: string;
  imageWidth: number;
  imageHeight: number;
  detections: Detection[];
  highlightId?: number | null;
  onCanvasReady?: (dataUrl: string) => void;
}

export default function DetectionCanvas({
  imageBase64,
  imageWidth,
  imageHeight,
  detections,
  highlightId,
  onCanvasReady,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load image element once
  useEffect(() => {
    setIsLoading(true);
    loadImage(imageBase64)
      .then((img) => {
        setImgEl(img);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [imageBase64]);

  // Redraw whenever relevant state changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imgEl) return;

    // Size canvas to container width, maintain aspect ratio
    const containerW = container.clientWidth;
    const aspect = imageWidth / imageHeight;
    canvas.width = containerW;
    canvas.height = Math.round(containerW / aspect);

    if (showOverlay && detections.length > 0) {
      renderDetections(canvas, imgEl, detections, imageWidth, imageHeight, highlightId ?? null);
    } else {
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    }

    if (onCanvasReady) {
      onCanvasReady(canvasToDataUrl(canvas));
    }
  }, [imgEl, detections, showOverlay, imageWidth, imageHeight, highlightId, onCanvasReady]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [redraw]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-light">
            <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          Radiograph
        </h3>
        {detections.length > 0 && (
          <button
            onClick={() => setShowOverlay((v) => !v)}
            className={`
              flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all
              ${showOverlay
                ? 'border-lesion-red/40 bg-lesion-red/10 text-red-400 hover:bg-lesion-red/20'
                : 'border-navy-500 bg-navy-700 text-slate-400 hover:border-accent/40 hover:text-accent-light'
              }
            `}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              {showOverlay ? (
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
                <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              )}
            </svg>
            {showOverlay ? 'Hide boxes' : 'Show boxes'}
          </button>
        )}
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl bg-black border border-navy-600/50"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-900">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-accent border-r-transparent border-b-transparent border-l-transparent" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>

      {/* Detection count badge */}
      {!isLoading && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {detections.length === 0
              ? 'No lesions detected'
              : `${detections.length} lesion${detections.length > 1 ? 's' : ''} detected`}
          </span>
          <span className="font-mono">
            {imageWidth} × {imageHeight} px
          </span>
        </div>
      )}
    </div>
  );
}
