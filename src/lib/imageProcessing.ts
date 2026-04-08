import { Detection } from './types';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE_MB = 20;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Unsupported format. Please upload a JPG, PNG, or WebP image.';
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
  }
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });
}

/**
 * Draw the original image + bounding boxes onto a canvas.
 * `naturalW/H` are the model's coordinate space dimensions.
 * The canvas can be any display size; boxes are scaled accordingly.
 */
export function renderDetections(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  detections: Detection[],
  naturalW: number,
  naturalH: number,
  highlightId?: number | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const displayW = canvas.width;
  const displayH = canvas.height;
  const scaleX = displayW / naturalW;
  const scaleY = displayH / naturalH;

  ctx.clearRect(0, 0, displayW, displayH);
  ctx.drawImage(img, 0, 0, displayW, displayH);

  detections.forEach((det) => {
    const [x1, y1, x2, y2] = det.bbox;
    const sx = x1 * scaleX;
    const sy = y1 * scaleY;
    const sw = (x2 - x1) * scaleX;
    const sh = (y2 - y1) * scaleY;

    const isHighlighted = highlightId === det.id;
    const alpha = isHighlighted ? 0.25 : 0.12;
    const strokeColor = isHighlighted ? '#f97316' : '#ef4444';
    const strokeWidth = isHighlighted ? 3 : 2;

    // Fill
    ctx.fillStyle = isHighlighted
      ? `rgba(249,115,22,${alpha})`
      : `rgba(239,68,68,${alpha})`;
    ctx.fillRect(sx, sy, sw, sh);

    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeRect(sx, sy, sw, sh);

    // Corner accents
    const cornerLen = Math.min(sw, sh, 14);
    ctx.lineWidth = strokeWidth + 1;
    ctx.beginPath();
    // TL
    ctx.moveTo(sx, sy + cornerLen);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + cornerLen, sy);
    // TR
    ctx.moveTo(sx + sw - cornerLen, sy);
    ctx.lineTo(sx + sw, sy);
    ctx.lineTo(sx + sw, sy + cornerLen);
    // BR
    ctx.moveTo(sx + sw, sy + sh - cornerLen);
    ctx.lineTo(sx + sw, sy + sh);
    ctx.lineTo(sx + sw - cornerLen, sy + sh);
    // BL
    ctx.moveTo(sx + cornerLen, sy + sh);
    ctx.lineTo(sx, sy + sh);
    ctx.lineTo(sx, sy + sh - cornerLen);
    ctx.stroke();

    // Label
    const label = `#${det.id}  ${(det.confidence * 100).toFixed(0)}%`;
    const fontSize = Math.max(10, Math.min(13, sw / 6));
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    const textW = ctx.measureText(label).width;
    const labelH = fontSize + 6;
    const lx = Math.max(0, Math.min(sx, displayW - textW - 10));
    const ly = sy > labelH + 2 ? sy - labelH - 2 : sy + sh + 2;

    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.roundRect(lx, ly, textW + 10, labelH, 3);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, lx + 5, ly + fontSize);
  });
}

/**
 * Export the canvas as a PNG data URL.
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Trigger a browser download of a data URL.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Trigger a browser download of a JSON object.
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}
