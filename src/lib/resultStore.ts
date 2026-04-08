import { AnalysisResult } from './types';

// In-memory store for the analysis result — avoids sessionStorage quota issues
// on mobile devices where the 5 MB limit is easily exceeded by base64 images.
let _result: AnalysisResult | null = null;

export function setResult(r: AnalysisResult) {
  _result = r;
}

export function getResult(): AnalysisResult | null {
  return _result;
}

export function clearResult() {
  _result = null;
}
