import dicomParser from 'dicom-parser';

export interface DicomInfo {
  rows: number;
  cols: number;
  windowCenter: number;
  windowWidth: number;
  bitsAllocated: number;
  patientName?: string;
  modality?: string;
  studyDate?: string;
}

export interface DicomResult {
  dataUrl: string;
  info: DicomInfo;
}

/**
 * Parse a DICOM ArrayBuffer, apply windowing, and return a JPEG data URL
 * suitable for the existing image upload pipeline.
 */
export function parseDicomBuffer(
  buffer: ArrayBuffer,
  windowCenter?: number,
  windowWidth?: number
): DicomResult {
  const byteArray = new Uint8Array(buffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const rows = dataSet.uint16('x00280010') ?? 512;
  const cols = dataSet.uint16('x00280011') ?? 512;
  const bitsAllocated = dataSet.uint16('x00280100') ?? 16;
  const pixelRepresentation = dataSet.uint16('x00280103') ?? 0; // 0=unsigned, 1=signed
  const samplesPerPixel = dataSet.uint16('x00280002') ?? 1;

  // Window / Level — prefer caller override, then DICOM tags, then bone defaults
  const dicomWc = (dataSet.floatString('x00281050') as unknown as number) || 300;
  const dicomWw = (dataSet.floatString('x00281051') as unknown as number) || 1500;
  const wc = windowCenter ?? dicomWc;
  const ww = windowWidth ?? dicomWw;

  const rescaleSlope = (dataSet.floatString('x00281053') as unknown as number) || 1;
  const rescaleIntercept = (dataSet.floatString('x00281052') as unknown as number) || 0;

  const pixelDataElement = dataSet.elements['x7fe00010'];
  if (!pixelDataElement) throw new Error('No pixel data found in DICOM file.');

  const pixelOffset = pixelDataElement.dataOffset;
  const pixelLength = pixelDataElement.length;

  let pixelArray: Int16Array | Uint16Array | Uint8Array;

  if (bitsAllocated === 16) {
    const rawBuffer = byteArray.buffer.slice(pixelOffset, pixelOffset + pixelLength);
    pixelArray =
      pixelRepresentation === 1
        ? new Int16Array(rawBuffer)
        : new Uint16Array(rawBuffer);
  } else {
    pixelArray = byteArray.slice(pixelOffset, pixelOffset + pixelLength);
  }

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context.');

  const imageData = ctx.createImageData(cols, rows);
  const data = imageData.data;

  const lower = wc - ww / 2;
  const upper = wc + ww / 2;

  const totalPixels = rows * cols;
  for (let i = 0; i < totalPixels; i++) {
    const rawVal = samplesPerPixel === 1 ? Number(pixelArray[i]) : Number(pixelArray[i * samplesPerPixel]);
    const hu = rawVal * rescaleSlope + rescaleIntercept;
    let gray = Math.round(((hu - lower) / (upper - lower)) * 255);
    gray = Math.max(0, Math.min(255, gray));
    const idx = i * 4;
    data[idx] = gray;
    data[idx + 1] = gray;
    data[idx + 2] = gray;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  const info: DicomInfo = {
    rows,
    cols,
    windowCenter: wc,
    windowWidth: ww,
    bitsAllocated,
    patientName: dataSet.string('x00100010'),
    modality: dataSet.string('x00080060'),
    studyDate: dataSet.string('x00080020'),
  };

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.95), info };
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read DICOM file.'));
    reader.readAsArrayBuffer(file);
  });
}
