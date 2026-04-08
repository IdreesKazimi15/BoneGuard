'use client';

import { useCallback, useRef, useState } from 'react';
import {
  validateImageFile,
  fileToDataUrl,
  ACCEPTED_TYPES,
  MAX_FILE_SIZE_MB,
} from '@/lib/imageProcessing';
import { parseDicomBuffer, readFileAsArrayBuffer, type DicomInfo } from '@/lib/dicom';

const ALL_ACCEPTED = [...ACCEPTED_TYPES, '.dcm', 'application/dicom'];

interface ImageUploaderProps {
  onImageReady: (dataUrl: string, file: File) => void;
  isLoading: boolean;
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  onSubmit: () => void;
  previewUrl: string | null;
  onLoadExample: () => void;
}

export default function ImageUploader({
  onImageReady,
  isLoading,
  apiUrl,
  onApiUrlChange,
  onSubmit,
  previewUrl,
  onLoadExample,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDicom, setIsDicom] = useState(false);
  const [dicomInfo, setDicomInfo] = useState<DicomInfo | null>(null);
  const [dicomBuffer, setDicomBuffer] = useState<ArrayBuffer | null>(null);
  const [dicomFile, setDicomFile] = useState<File | null>(null);
  const [wc, setWc] = useState(300);
  const [ww, setWw] = useState(1500);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processDicom = useCallback(
    async (file: File, windowCenter: number, windowWidth: number, buffer?: ArrayBuffer) => {
      setValidationError(null);
      try {
        const buf = buffer ?? (await readFileAsArrayBuffer(file));
        if (!buffer) setDicomBuffer(buf);
        const { dataUrl, info } = parseDicomBuffer(buf, windowCenter, windowWidth);
        setDicomInfo(info);
        setIsDicom(true);
        setDicomFile(file);
        // Build a synthetic File from the converted JPEG for the pipeline
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const jpegFile = new File([blob], file.name.replace(/\.dcm$/i, '.jpg'), {
          type: 'image/jpeg',
        });
        onImageReady(dataUrl, jpegFile);
      } catch (err) {
        setValidationError(
          err instanceof Error ? err.message : 'Failed to parse DICOM file.'
        );
      }
    },
    [onImageReady]
  );

  const processRegular = useCallback(
    async (file: File) => {
      setValidationError(null);
      const err = validateImageFile(file);
      if (err) { setValidationError(err); return; }
      try {
        const dataUrl = await fileToDataUrl(file);
        setIsDicom(false);
        setDicomInfo(null);
        onImageReady(dataUrl, file);
      } catch {
        setValidationError('Failed to read the image file. Please try again.');
      }
    },
    [onImageReady]
  );

  const processFile = useCallback(
    async (file: File) => {
      if (file.name.toLowerCase().endsWith('.dcm') || file.type === 'application/dicom') {
        const buffer = await readFileAsArrayBuffer(file);
        setDicomBuffer(buffer);
        await processDicom(file, wc, ww, buffer);
      } else {
        await processRegular(file);
      }
    },
    [processDicom, processRegular, wc, ww]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // Re-render DICOM when sliders change
  const handleWindowChange = useCallback(
    (newWc: number, newWw: number) => {
      setWc(newWc);
      setWw(newWw);
      if (dicomBuffer && dicomFile) {
        processDicom(dicomFile, newWc, newWw, dicomBuffer);
      }
    },
    [dicomBuffer, dicomFile, processDicom]
  );

  return (
    <div className="w-full space-y-5">
      {/* Drop zone */}
      <div
        className={`
          relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-accent bg-accent/10 shadow-glow-blue scale-[1.01]'
            : previewUrl
            ? 'border-accent/40 bg-navy-800'
            : 'border-navy-500 bg-navy-800/50 hover:border-accent/60 hover:bg-navy-800'
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !previewUrl && fileInputRef.current?.click()}
        role="button"
        aria-label="Upload image or DICOM file"
      >
        {previewUrl ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded radiograph preview"
              className="w-full max-h-96 object-contain bg-black rounded-2xl"
            />
            {/* DICOM badge */}
            {isDicom && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300 backdrop-blur-sm">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M2 2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H2zm0 1h12a1 1 0 011 1v1H1V4a1 1 0 011-1zm13 3v6a1 1 0 01-1 1H2a1 1 0 01-1-1V6h14z"/>
                </svg>
                DICOM
                {dicomInfo?.modality && ` · ${dicomInfo.modality}`}
              </div>
            )}
            {/* Change overlay */}
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Change image
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 px-8 py-20 text-center">
            <div className={`
              flex h-20 w-20 items-center justify-center rounded-2xl border-2 transition-colors
              ${isDragging ? 'border-accent bg-accent/20 text-accent-light' : 'border-navy-500 bg-navy-700 text-slate-400'}
            `}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-9 w-9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">
                {isDragging ? 'Drop image here' : 'Drag & drop radiograph'}
              </p>
              <p className="mt-2 text-base text-slate-400">
                or{' '}
                <span className="text-accent-light underline underline-offset-2">click to browse</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              <span>JPG · PNG · WebP</span>
              <span className="text-navy-600">·</span>
              <span className="flex items-center gap-1.5 text-purple-400">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M2 2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H2zm0 1h12a1 1 0 011 1v1H1V4a1 1 0 011-1zm13 3v6a1 1 0 01-1 1H2a1 1 0 01-1-1V6h14z"/>
                </svg>
                DICOM
              </span>
              <span className="text-navy-600">·</span>
              <span>Max {MAX_FILE_SIZE_MB} MB</span>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALL_ACCEPTED.join(',')}
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {/* DICOM window/level controls */}
      {isDicom && previewUrl && (
        <div className="rounded-xl border border-purple-500/25 bg-purple-500/8 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
              </svg>
              DICOM Window / Level
            </p>
            {/* Bone preset button */}
            <button
              onClick={() => handleWindowChange(300, 1500)}
              className="rounded-lg border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-[10px] font-semibold text-purple-300 hover:bg-purple-500/25 transition-colors"
            >
              Bone preset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Window Center */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Window Center (L)</span>
                <span className="font-mono text-purple-300 tabular-nums">{wc}</span>
              </div>
              <input
                type="range" min={-1000} max={3000} step={10} value={wc}
                onChange={(e) => handleWindowChange(parseInt(e.target.value), ww)}
                className="w-full accent-purple-400"
              />
            </div>
            {/* Window Width */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Window Width (W)</span>
                <span className="font-mono text-purple-300 tabular-nums">{ww}</span>
              </div>
              <input
                type="range" min={1} max={4000} step={10} value={ww}
                onChange={(e) => handleWindowChange(wc, parseInt(e.target.value))}
                className="w-full accent-purple-400"
              />
            </div>
          </div>

          {dicomInfo && (
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 pt-1 border-t border-purple-500/15">
              <span>{dicomInfo.cols} × {dicomInfo.rows} px</span>
              <span>{dicomInfo.bitsAllocated}-bit</span>
              {dicomInfo.modality && <span>Modality: {dicomInfo.modality}</span>}
              {dicomInfo.studyDate && <span>Study: {dicomInfo.studyDate}</span>}
            </div>
          )}
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-in">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {validationError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!previewUrl || isLoading}
          className={`
            flex-1 flex items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-semibold transition-all duration-200
            ${!previewUrl || isLoading
              ? 'cursor-not-allowed bg-navy-700 text-slate-500 border border-navy-600'
              : 'bg-accent hover:bg-accent-hover text-white shadow-glow-blue hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] active:scale-95'
            }
          `}
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
              </svg>
              Analyze Radiograph
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onLoadExample}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-xl border border-navy-500 bg-navy-800 px-6 py-4 text-base font-medium text-slate-300 transition-all hover:border-accent/50 hover:text-accent-light hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          Try Example
        </button>
      </div>
    </div>
  );
}
