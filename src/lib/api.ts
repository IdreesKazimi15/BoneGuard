import { PredictionResponse } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;

function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('boneguard_api_url');
    if (stored) return stored.replace(/\/$/, '');
  }
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8000'
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
      'http://localhost:8000'
    );
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
          'Request timed out after 30 s. Check that the backend is running and reachable.'
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
