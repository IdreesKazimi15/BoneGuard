'use client';

import { useEffect, useRef, useState } from 'react';
import { getStoredApiUrl } from '@/lib/api';

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function ping() {
    const url = getStoredApiUrl();
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
  }

  useEffect(() => {
    ping();
    timerRef.current = setInterval(ping, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const meta = STATUS_META[status];

  return (
    <button
      onClick={ping}
      title="Click to re-check API status"
      className={`
        hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all
        ${status === 'online'   ? 'border-emerald-500/25 bg-emerald-500/8 hover:bg-emerald-500/15' : ''}
        ${status === 'degraded' ? 'border-yellow-500/25 bg-yellow-500/8 hover:bg-yellow-500/15'   : ''}
        ${status === 'offline'  ? 'border-red-500/25 bg-red-500/8 hover:bg-red-500/15'             : ''}
        ${status === 'checking' ? 'border-slate-600/40 bg-slate-800/50'                            : ''}
      `}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      <span className={meta.text}>{meta.label}</span>
      {latencyMs !== null && status === 'online' && (
        <span className="text-slate-600">{latencyMs} ms</span>
      )}
    </button>
  );
}
