import { AnalysisResult, getConfidenceTier, LESION_CLASS_LABELS } from './types';

/**
 * Generate and download a structured PDF report.
 * jsPDF is imported dynamically so it never runs server-side.
 */
export async function downloadPdfReport(
  result: AnalysisResult,
  annotatedImageUrl?: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function line(color = '#1e3a6e') {
    doc.setDrawColor(color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  }

  function text(
    str: string,
    x: number,
    fontSize = 10,
    color = '#e2e8f0',
    style: 'normal' | 'bold' = 'normal'
  ) {
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    doc.setFont('helvetica', style);
    doc.text(str, x, y);
  }

  function newLine(h = 6) { y += h; }

  function checkPageBreak(needed = 20) {
    if (y + needed > 280) {
      doc.addPage();
      y = MARGIN;
      renderPageBg();
    }
  }

  function renderPageBg() {
    // Dark background
    doc.setFillColor('#050d1f');
    doc.rect(0, 0, 210, 297, 'F');
    // Accent top stripe
    doc.setFillColor('#3b82f6');
    doc.rect(0, 0, 210, 1.5, 'F');
  }

  // ── Page 1 background ─────────────────────────────────────────────────────
  renderPageBg();

  // ── Logo / Header ──────────────────────────────────────────────────────────
  doc.setFillColor('#0f2040');
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'F');

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#ffffff');
  doc.text('BoneGuard', MARGIN + 6, y + 9);

  doc.setFontSize(18);
  doc.setTextColor('#60a5fa');
  doc.text('AI', MARGIN + 43, y + 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#64748b');
  doc.text('Bone Lesion Detection & Classification Report', MARGIN + 6, y + 16);

  // Report tag top-right
  doc.setFontSize(7);
  doc.setTextColor('#3b82f6');
  doc.text('RESEARCH USE ONLY', PAGE_W - MARGIN - 4, y + 7, { align: 'right' });
  doc.setTextColor('#475569');
  doc.text('YOLOv8 + EfficientNet-B3', PAGE_W - MARGIN - 4, y + 13, { align: 'right' });

  y += 28;

  // ── Scan Metadata ──────────────────────────────────────────────────────────
  doc.setFillColor('#0a1628');
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, 'F');
  doc.setDrawColor('#1e3a6e');
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, 'S');

  const metaY = y + 6;
  const col2 = MARGIN + CONTENT_W / 2 + 5;

  const rows: [string, string][] = [
    ['File', result.filename],
    ['Analysed', new Date(result.timestamp).toLocaleString()],
    ['Dimensions', `${result.imageWidth} × ${result.imageHeight} px`],
    ['Processing time', `${result.predictions.processing_time_ms} ms`],
  ];

  rows.forEach(([label, value], i) => {
    const isRight = i >= 2;
    const lx = isRight ? col2 : MARGIN + 5;
    const ry = metaY + (i % 2) * 8;

    doc.setFontSize(7);
    doc.setTextColor('#64748b');
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), lx, ry);

    doc.setFontSize(9);
    doc.setTextColor('#e2e8f0');
    doc.setFont('helvetica', 'bold');
    doc.text(value, lx, ry + 4.5);
  });

  y += 34;

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const detections = result.predictions.detections ?? [];
  const statBoxW = (CONTENT_W - 9) / 4;
  const stats = [
    { label: 'Lesions Found', value: String(detections.length), color: detections.length > 0 ? '#f87171' : '#34d399' },
    {
      label: 'Avg Confidence',
      value: detections.length
        ? `${((detections.reduce((s, d) => s + d.class_confidence, 0) / detections.length) * 100).toFixed(1)}%`
        : '—',
      color: '#60a5fa',
    },
    { label: 'Processing', value: `${result.predictions.processing_time_ms} ms`, color: '#c084fc' },
    { label: 'Heatmaps', value: String(detections.filter((d) => d.grad_cam).length), color: '#fb923c' },
  ];

  stats.forEach((s, i) => {
    const bx = MARGIN + i * (statBoxW + 3);
    doc.setFillColor('#0f2040');
    doc.roundedRect(bx, y, statBoxW, 16, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor('#64748b');
    doc.setFont('helvetica', 'normal');
    doc.text(s.label, bx + 4, y + 5.5);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(s.color);
    doc.text(s.value, bx + 4, y + 13);
  });

  y += 22;

  // ── Annotated Image ────────────────────────────────────────────────────────
  if (annotatedImageUrl) {
    checkPageBreak(70);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#94a3b8');
    doc.text('ANNOTATED RADIOGRAPH', MARGIN, y);
    y += 4;
    line('#1e3a6e');

    const imgMaxH = 75;
    const aspect = result.imageWidth / result.imageHeight;
    const imgW = Math.min(CONTENT_W, imgMaxH * aspect);
    const imgH = imgW / aspect;
    const imgX = MARGIN + (CONTENT_W - imgW) / 2;

    doc.setFillColor('#000000');
    doc.rect(imgX - 1, y - 1, imgW + 2, imgH + 2, 'F');
    doc.addImage(annotatedImageUrl, 'JPEG', imgX, y, imgW, imgH);
    y += imgH + 6;
  }

  // ── Findings Table ─────────────────────────────────────────────────────────
  checkPageBreak(30);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#94a3b8');
  doc.text('FINDINGS', MARGIN, y);
  y += 4;
  line('#1e3a6e');

  if (detections.length === 0) {
    doc.setFillColor('#052e16');
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor('#34d399');
    doc.setFont('helvetica', 'bold');
    doc.text('No lesions detected in this radiograph.', MARGIN + 5, y + 9);
    y += 20;
  } else {
    // Table header
    const cols = [
      { label: 'ID', x: MARGIN + 2, w: 10 },
      { label: 'Classification', x: MARGIN + 14, w: 45 },
      { label: 'Det. Conf.', x: MARGIN + 61, w: 28 },
      { label: 'Class Conf.', x: MARGIN + 91, w: 28 },
      { label: 'Bounding Box', x: MARGIN + 121, w: 53 },
    ];

    doc.setFillColor('#0f2040');
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#64748b');
    cols.forEach((c) => doc.text(c.label, c.x, y + 5.5));
    y += 8;

    detections.forEach((det, idx) => {
      checkPageBreak(14);
      const rowBg = idx % 2 === 0 ? '#0a1628' : '#080f1e';
      doc.setFillColor(rowBg);
      doc.rect(MARGIN, y, CONTENT_W, 11, 'F');

      const tier = getConfidenceTier(det.class_confidence);
      const confColor =
        tier === 'high' ? '#34d399' : tier === 'medium' ? '#fbbf24' : '#f87171';

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#f87171');
      doc.text(`#${det.id}`, cols[0].x, y + 7.5);

      doc.setTextColor('#e2e8f0');
      doc.setFont('helvetica', 'normal');
      doc.text(
        LESION_CLASS_LABELS[det.class_predicted] ?? det.class_predicted,
        cols[1].x,
        y + 7.5
      );

      doc.setTextColor(confColor);
      doc.text(`${(det.confidence * 100).toFixed(1)}%`, cols[2].x, y + 7.5);
      doc.text(`${(det.class_confidence * 100).toFixed(1)}%`, cols[3].x, y + 7.5);

      doc.setTextColor('#64748b');
      doc.setFontSize(6.5);
      doc.text(
        `[${det.bbox.map((v) => Math.round(v)).join(', ')}]`,
        cols[4].x,
        y + 7.5
      );

      y += 11;
    });
    y += 4;
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor('#1e3a6e');
    doc.setFont('helvetica', 'normal');
    doc.text(
      `BoneGuard AI  ·  Generated ${new Date().toLocaleString()}  ·  Page ${p} of ${pageCount}`,
      PAGE_W / 2,
      290,
      { align: 'center' }
    );
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const ts = new Date(result.timestamp).toISOString().slice(0, 19).replace(/[:.]/g, '-');
  doc.save(`boneguard_report_${ts}.pdf`);
}
