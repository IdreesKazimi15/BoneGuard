export interface Detection {
  id: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] in image-space pixels
  confidence: number;
  class_predicted: string;
  class_confidence: number;
  grad_cam?: string; // base64-encoded heatmap PNG
}

export interface PredictionResponse {
  success: boolean;
  detections: Detection[];
  processing_time_ms: number;
  error?: string;
}

export interface AnalysisResult {
  imageBase64: string; // original image as data URL
  imageWidth: number;
  imageHeight: number;
  predictions: PredictionResponse;
  timestamp: string;
  filename: string;
}

export type ConfidenceTier = 'high' | 'medium' | 'low';

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

export const CONFIDENCE_STYLES: Record<ConfidenceTier, string> = {
  high: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  low: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export const LESION_CLASS_LABELS: Record<string, string> = {
  osteolytic: 'Osteolytic',
  osteoblastic: 'Osteoblastic',
  mixed: 'Mixed',
  benign: 'Benign',
  malignant: 'Malignant',
  normal: 'Normal',
};

export const SESSION_KEY = 'boneguard_analysis_result';
