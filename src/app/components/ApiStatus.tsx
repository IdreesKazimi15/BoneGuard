'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getStoredApiUrl,
  setApiUrl,
  resetApiUrl,
  getDefaultApiUrl,
} from '@/lib/api';

type Status = 'checking' | 'online' | 'degraded' | 'offline';

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> = {
  checking: { label: 'Checking...', dot: 'bg-slate-500 animate-pulse', text: 'text-slate-400' },
  online:   { label: 'API Online',  dot: 'bg-emerald-400 animate-pulse-slow', text: 'text-emerald-400' },
  degraded: { label: 'Degraded',    dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400' },
  offline:  { label: 'API Offline', dot: 'bg-red-500 animate-pulse', text: 'text-red-400' },
};

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const ping = useCallback(async () => {
    const url = getStoredApiUrl();
    setCurrentUrl(url);
    setStatus('checking');
    const start = performance.now();
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      const ms = Math.round(performance.now() - start);
      setLatencyMs(ms);
      if (res.ok) {
        setStatus(ms > 2000 ? 'degraded' : 'online');
      } else {
        setStatus('degraded');
      }
    } catch {
      setLatencyMs(null);
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    ping();
    timerRef.current = setInterval(ping, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ping]);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  function handleToggle() {
    if (!isOpen) {
      const live = getStoredApiUrl();
      setCurrentUrl(live);
      setDraftUrl(live);
      setSaveMsg(null);
    }
    setIsOpen(!isOpen);
  }

  function handleSave() {
    const trimmed = draftUrl.trim().replace(/\/$/, '');
    if (!trimmed) {
      setSaveMsg('URL cannot be empty');
      return;
    }
    if (!/^https?:\/\//.test(trimmed)) {
      setSaveMsg('URL must start with http:// or https://');
      return;
    }
    setApiUrl(trimmed);
    setCurrentUrl(trimmed);
    setSaveMsg('Saved. Re-checking...');
    ping();
    setTimeout(() => setSaveMsg(null), 2500);
  }

  function handleReset() {
    resetApiUrl();
    const def = getDefaultApiUrl();
    setDraftUrl(def);
    setCurrentUrl(def);
    setSaveMsg('Reset to default. Re-checking...');
    ping();
    setTimeout(() => setSaveMsg(null), 2500);
  }

  const meta = STATUS_META[status];

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={handleToggle}
        title="Click to manage the backend URL"
        className={`
          flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all
          ${status === 'online'   ? 'border-emerald-500/25 bg-emerald-500/8 hover:bg-emerald-500/15' : ''}
          ${status === 'degraded' ? 'border-yellow-500/25 bg-yellow-500/8 hover:bg-yellow-500/15'   : ''}
          ${status === 'offline'  ? 'border-red-500/25 bg-red-500/8 hover:bg-red-500/15'             : ''}
          ${status === 'checking' ? 'border-slate-600/40 bg-slate-800/50'                            : ''}
          ${isOpen ? 'ring-1 ring-accent/40' : ''}
        `}
      >
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className={meta.text}>{meta.label}</span>
        {latencyMs !== null && status === 'online' && (
          <span className="text-slate-600">{latencyMs} ms</span>
        )}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-navy-500/60 bg-navy-900/95 p-4 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Backend URL</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-300"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-3 rounded-lg bg-navy-800/50 px-3 py-2 font-mono text-[11px] text-slate-400 break-all">
            {currentUrl || 'not set'}
          </div>

          <label className="mb-1 block text-xs font-medium text-slate-300">
            Override URL
          </label>
          <input
            type="text"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://your-tunnel.trycloudflare.com"
            className="mb-3 w-full rounded-lg border border-navy-500/60 bg-navy-800/60 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-medium text-accent-light hover:bg-accent/25"
            >
              Save & Test
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-navy-500/60 bg-navy-800/40 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-navy-800/80"
            >
              Reset
            </button>
            <button
              onClick={ping}
              title="Re-check connection"
              className="rounded-lg border border-navy-500/60 bg-navy-800/40 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-navy-800/80"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {saveMsg && (
            <div className="mt-3 text-xs text-emerald-400">{saveMsg}</div>
          )}

          <div className="mt-3 border-t border-navy-600/50 pt-2 text-[10px] text-slate-500">
            Override is stored per-session. Resetting clears it.
          </div>
        </div>
      )}
    </div>
  );
}
