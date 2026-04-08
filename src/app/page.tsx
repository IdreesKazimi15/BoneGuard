'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import ChatPanel from './components/ChatPanel';
import { analyzeImage, setApiUrl, getStoredApiUrl } from '@/lib/api';
import { loadImage } from '@/lib/imageProcessing';
import { AnalysisResult, SESSION_KEY } from '@/lib/types';
import { setResult } from '@/lib/resultStore';

export default function HomePage() {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrlState] = useState('http://localhost:8000');
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setApiUrlState(getStoredApiUrl());
  }, []);

  const handleApiUrlChange = useCallback((url: string) => {
    setApiUrlState(url);
    setApiUrl(url);
  }, []);

  const handleImageReady = useCallback((dataUrl: string, file: File) => {
    setPreviewUrl(dataUrl);
    setCurrentFile(file);
    setError(null);
  }, []);

  const handleLoadExample = useCallback(async () => {
    setError(null);
    try {
      // Load the local sample image
      const res = await fetch('/sample-xray.jpg');
      if (!res.ok) throw new Error('Sample image not found. Add sample-xray.jpg to /public.');
      const blob = await res.blob();
      const file = new File([blob], 'sample-xray.jpg', { type: 'image/jpeg' });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreviewUrl(dataUrl);
        setCurrentFile(file);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load example image. Add sample-xray.jpg to the /public folder.'
      );
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!previewUrl || !currentFile || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const predictions = await analyzeImage(previewUrl);

      // Get image natural dimensions
      const img = await loadImage(previewUrl);

      const result: AnalysisResult = {
        imageBase64: previewUrl,
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
        predictions,
        timestamp: new Date().toISOString(),
        filename: currentFile.name,
      };

      setResult(result);
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
      } catch {
        // sessionStorage quota exceeded (common on mobile) — in-memory store is enough
      }
      router.push('/results');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
      setIsLoading(false);
    }
  }, [previewUrl, currentFile, isLoading, router]);

  const handleRetry = useCallback(() => {
    setError(null);
    handleSubmit();
  }, [handleSubmit]);

  const infoCards = [
    {
      title: 'Fast Inference',
      desc: 'Sub-second detection and classification on GPU-accelerated hardware.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
    },
    {
      title: 'Explainable AI',
      desc: 'Grad-CAM visualizations show which regions drove each classification decision.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
    },
    {
      title: 'Research Ready',
      desc: 'Export as JSON, annotated PNG, or a full PDF report with findings table.',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />,
    },
  ];

  return (
    <>
    <div className="min-h-screen bg-navy-900 bg-grid">
      <Header />

      <main className="w-full px-6 pb-20 pt-10 sm:px-10 lg:px-16 xl:px-24">

        {/* ── Two-column layout on lg+ ── */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14 xl:gap-20">

          {/* ── Left: Hero + pills + info cards ── */}
          <div className="flex flex-col lg:sticky lg:top-24 lg:w-[46%] animate-fade-in">

            {/* Badge */}
            <div className="mb-6 inline-flex w-fit items-center gap-2.5 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-light">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-light" />
              Research Demo · v1.0
            </div>

            {/* Heading */}
            <h1 className="text-5xl font-extrabold tracking-tight text-white lg:text-5xl xl:text-6xl 2xl:text-7xl leading-[1.1]">
              Bone Lesion{' '}
              <span className="text-gradient">Detection &amp; Analysis</span>
            </h1>

            <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-xl">
              Upload a radiograph and let BoneGuard AI detect, classify, and
              explain bone lesions using{' '}
              <span className="text-accent-light font-semibold">YOLOv8</span> +{' '}
              <span className="text-accent-light font-semibold">EfficientNet-B0</span>{' '}
              with Grad-CAM visual explanations.
            </p>

            {/* Feature pills */}
            <div className="mt-7 flex flex-wrap gap-2.5">
              {[
                { icon: '🔍', label: 'Lesion Detection' },
                { icon: '🏷️', label: 'Classification' },
                { icon: '🔥', label: 'Grad-CAM' },
                { icon: '📊', label: 'Confidence Scoring' },
                { icon: '⬇️', label: 'Export JSON / PDF' },
                { icon: '🩻', label: 'DICOM Support' },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-navy-600/60 bg-navy-800/50 px-4 py-2 text-sm text-slate-300"
                >
                  <span>{icon}</span>
                  {label}
                </span>
              ))}
            </div>

            {/* Info cards — desktop only */}
            <div className="mt-10 hidden lg:grid grid-cols-1 gap-4">
              {infoCards.map(({ title, desc, icon }) => (
                <div key={title} className="card-inner flex items-start gap-5 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-accent-light">
                      {icon}
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 hidden lg:block text-sm text-slate-600 leading-relaxed">
              Research demonstration only.
            </p>
          </div>

          {/* ── Right: Upload card ── */}
          <div className="flex-1 animate-slide-up [animation-delay:0.1s]">
            <div className="card p-7 sm:p-8">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <ImageUploader
                  onImageReady={handleImageReady}
                  isLoading={isLoading}
                  apiUrl={apiUrl}
                  onApiUrlChange={handleApiUrlChange}
                  onSubmit={handleSubmit}
                  previewUrl={previewUrl}
                  onLoadExample={handleLoadExample}
                />
              )}
            </div>

            {error && !isLoading && (
              <div className="mt-5">
                <ErrorMessage
                  message={error}
                  onRetry={previewUrl ? handleRetry : undefined}
                  onDismiss={() => setError(null)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Info cards — mobile only */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:hidden animate-fade-in [animation-delay:0.2s]">
          {infoCards.map(({ title, desc, icon }) => (
            <div key={title} className="card-inner flex flex-col gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5 text-accent-light">
                  {icon}
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-600 leading-relaxed lg:hidden">
          Research demonstration only.
        </p>

      </main>
    </div>

    <ChatPanel />
    </>
  );
}
