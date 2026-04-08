import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BoneGuard AI — Bone Lesion Detection',
  description:
    'AI-powered bone lesion detection and classification using YOLOv8 + EfficientNet-B0. Upload a radiograph to detect and classify bone lesions with Grad-CAM explanations.',
  keywords: ['bone lesion', 'AI radiology', 'YOLOv8', 'medical imaging', 'osteolytic', 'classification'],
  authors: [{ name: 'BoneGuard' }],
  openGraph: {
    title: 'BoneGuard AI — Bone Lesion Detection',
    description: 'AI-powered radiograph analysis with bounding boxes, classification, and Grad-CAM heatmaps.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-navy-900">{children}</body>
    </html>
  );
}
