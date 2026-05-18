import { PredictionResponse } from './types';

// HuggingFace Spaces cold starts can take 60-120s; warm inference ~15-25s.
// Set timeout high enough to cover a cold start without false aborts.
const DEFAULT_TIMEOUT_MS = 120_000;
const WARMUP_TIMEOUT_MS = 5_000;

// Hardcoded production backend so the deployed site works even if the Vercel
// NEXT_PUBLIC_API_URL env var is missing. Local dev should override via
// .env.local (NEXT_PUBLIC_API_URL=http://localhost:8000).
const DEFAULT_API_URL = 'https://gunsleuth-boneguard-backend.hf.space';

function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('boneguard_api_url');
    if (stored) return stored.replace(/\/$/, '');
  }
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    DEFAULT_API_URL
  );
}

export function setApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('boneguard_api_url', url.replace(/\/$/, ''));
  }
}

export function getStoredApiUrl(): string {
  if (typeof window !== 'undefined') {
    return (
      sessionStorage.getItem('boneguard_api_url') ||
      process.env.NEXT_PUBLIC_API_URL ||
      DEFAULT_API_URL
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
}

/**
 * Fire-and-forget ping to wake a sleeping HF Spaces container.
 * Safe to call on every page mount: only does network work the first time
 * the user lands on a page that needs the backend.
 */
export async function warmupBackend(): Promise<void> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS);
    await fetch(`${getApiBase()}/health`, { signal: controller.signal });
  } catch {
    // Swallow errors — warmup is best-effort
  }
}

export async function analyzeImage(
  imageBase64: string
): Promise<PredictionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  try {
    const res = await fetch(`${getApiBase()}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let detail = `Server error ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || body.error || detail;
      } catch {
        // ignore parse errors
      }
      throw new Error(detail);
    }

    const data: PredictionResponse = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Inference failed on the server.');
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error(
          'Request timed out after 2 minutes. The backend may be cold-starting; please try again.'
        );
      }
      if (
        err.message.includes('fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Failed to fetch')
      ) {
        throw new Error(
          `Cannot reach the backend at ${getApiBase()}. Make sure the FastAPI server is running.`
        );
      }
      throw err;
    }
    throw new Error('An unexpected error occurred.');
  }
}
