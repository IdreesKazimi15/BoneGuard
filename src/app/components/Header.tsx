'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SESSION_KEY } from '@/lib/types';
import ApiStatus from './ApiStatus';

interface HeaderProps {
  showNewAnalysis?: boolean;
}

export default function Header({ showNewAnalysis = false }: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleNewAnalysis() {
    sessionStorage.removeItem(SESSION_KEY);
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-navy-600/50 bg-navy-900/80 backdrop-blur-md">
      <div className="flex w-full items-center justify-between px-6 py-5 sm:px-10 lg:px-16 xl:px-24">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/30 group-hover:bg-accent/20 transition-colors">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-7 w-7 text-accent-light"
              aria-hidden="true"
            >
              <path
                d="M7 3C5.34 3 4 4.34 4 6c0 1.1.6 2.05 1.5 2.6L9 12l-3.5 3.4A3 3 0 0 0 4 18c0 1.66 1.34 3 3 3s3-1.34 3-3c0-.55-.16-1.06-.43-1.5L12 13l2.43 2.5A2.99 2.99 0 0 0 14 17c0 1.66 1.34 3 3 3s3-1.34 3-3a3 3 0 0 0-1.5-2.6L15 11l3.5-3.4A2.99 2.99 0 0 0 20 6c0-1.66-1.34-3-3-3s-3 1.34-3 3c0 .55.16 1.06.43 1.5L12 10 9.57 7.5C9.84 7.06 10 6.55 10 6c0-1.66-1.34-3-3-3z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-tight text-white">
              Bone<span className="text-accent-light">Guard</span>
            </span>
            <span className="hidden rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-accent-light sm:inline">
              AI
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 sm:flex">
          <ApiStatus />
          <span className="text-sm text-navy-400 font-mono">
            YOLOv8 + EfficientNet-B0
          </span>
          {showNewAnalysis && (
            <button
              onClick={handleNewAnalysis}
              className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent-light transition-all hover:bg-accent/20 hover:border-accent/60 hover:shadow-glow-blue"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              New Analysis
            </button>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
        </nav>

        {/* Mobile menu button */}
        <button
          className="sm:hidden text-slate-400 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-navy-600/50 bg-navy-900/95 px-4 py-3">
          {showNewAnalysis && (
            <button
              onClick={handleNewAnalysis}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent-light mb-3"
            >
              New Analysis
            </button>
          )}
          <div className="text-xs text-center text-navy-400 font-mono">
            YOLOv8 + EfficientNet-B0
          </div>
        </div>
      )}
    </header>
  );
}
