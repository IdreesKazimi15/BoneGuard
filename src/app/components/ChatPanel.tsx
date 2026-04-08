'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalysisResult, LESION_CLASS_LABELS } from '@/lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  analysisResult?: AnalysisResult | null;
}

const SUGGESTED_QUESTIONS = [
  'What does osteolytic mean?',
  'How reliable is the confidence score?',
  'What is Grad-CAM showing me?',
  'What should I do next with these findings?',
];

function buildScanContext(result: AnalysisResult): string {
  const dets = result.predictions.detections ?? [];
  if (dets.length === 0) {
    return `File: ${result.filename}\nResult: No lesions detected.\nProcessing time: ${result.predictions.processing_time_ms}ms`;
  }
  const lines = [
    `File: ${result.filename}`,
    `Image: ${result.imageWidth}×${result.imageHeight}px`,
    `Processing time: ${result.predictions.processing_time_ms}ms`,
    `Detections: ${dets.length} lesion(s) found`,
    '',
    ...dets.map((d) =>
      `Lesion #${d.id}: ${LESION_CLASS_LABELS[d.class_predicted] ?? d.class_predicted} — ` +
      `classification confidence ${(d.class_confidence * 100).toFixed(1)}%, ` +
      `detection confidence ${(d.confidence * 100).toFixed(1)}%, ` +
      `bbox [${d.bbox.map((v) => Math.round(v)).join(', ')}]` +
      (d.grad_cam ? ', Grad-CAM available' : '')
    ),
  ];
  return lines.join('\n');
}

const MIN_W = 380;
const MAX_W = 960;
const MIN_H = 400;

export default function ChatPanel({ analysisResult }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('qwen2:0.5b');
  const [size, setSize] = useState({ width: 520, height: 560 });
  const [isResizing, setIsResizing] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Resize drag handlers ──────────────────────────────────────────────────
  function startResize(e: React.MouseEvent, direction: 'both' | 'horizontal' | 'vertical') {
    e.preventDefault();
    setIsResizing(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };

    const maxH = window.innerHeight * 0.92;

    function onMove(ev: MouseEvent) {
      const dx = dragOrigin.current.x - ev.clientX; // drag left → wider
      const dy = dragOrigin.current.y - ev.clientY; // drag up   → taller
      setSize((prev) => ({
        width:  direction !== 'vertical'   ? Math.max(MIN_W, Math.min(MAX_W, dragOrigin.current.width  + dx)) : prev.width,
        height: direction !== 'horizontal' ? Math.max(MIN_H, Math.min(maxH,  dragOrigin.current.height + dy)) : prev.height,
      }));
    }

    function onUp() {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Greet on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = analysisResult
        ? `Hello! I've loaded your scan results for **${analysisResult.filename}** — ${analysisResult.predictions.detections?.length ?? 0} lesion(s) detected. Ask me anything about the findings, lesion types, or how the AI works.`
        : `Hello! I'm the BoneGuard Assistant. Upload a scan and run analysis to get context-aware answers, or ask me anything about bone lesions and radiology AI.`;
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [isOpen, analysisResult, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      const userMsg: Message = { role: 'user', content: trimmed };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
      setIsStreaming(true);

      // Placeholder for streaming response
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      abortRef.current = new AbortController();

      try {
        const scanContext = analysisResult ? buildScanContext(analysisResult) : null;

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            scanContext,
            model,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || `Server error ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: accumulated,
            };
            return updated;
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // user cancelled — keep partial response
        } else {
          const msg =
            err instanceof Error ? err.message : 'Unknown error occurred.';
          setError(msg);
          setMessages((prev) => prev.slice(0, -1)); // remove empty placeholder
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, analysisResult, model]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  function handleClear() {
    setMessages([]);
    setError(null);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`
          fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-200
          ${isOpen
            ? 'bg-navy-700 border border-navy-500 text-slate-300 hover:bg-navy-600'
            : 'bg-accent hover:bg-accent-hover text-white shadow-glow-blue hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]'
          }
        `}
        title={isOpen ? 'Close assistant' : 'Open BoneGuard Assistant'}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.9a.5.5 0 00.625.624l3.768-1.008A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zM8 13a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        )}

        {/* Unread dot when closed and has context */}
        {!isOpen && analysisResult && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-navy-900 bg-emerald-400" />
        )}
      </button>

      {/* Panel */}
      <div
        style={{ width: size.width, height: size.height }}
        className={`
          fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl border border-navy-600/60 bg-navy-900 shadow-[0_8px_40px_rgba(0,0,0,0.6)]
          transition-[opacity,transform] duration-300 origin-bottom-right
          ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'}
          ${isResizing ? 'select-none' : ''}
        `}
      >
        {/* ── Resize handles ── */}
        {/* Top edge — vertical resize */}
        <div
          onMouseDown={(e) => startResize(e, 'vertical')}
          className="absolute -top-1 left-4 right-4 h-3 cursor-ns-resize group z-10"
        >
          <div className="absolute top-1 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-navy-600 group-hover:bg-accent/60 transition-colors" />
        </div>

        {/* Left edge — horizontal resize */}
        <div
          onMouseDown={(e) => startResize(e, 'horizontal')}
          className="absolute top-4 bottom-4 -left-1 w-3 cursor-ew-resize group z-10"
        >
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-navy-600 group-hover:bg-accent/60 transition-colors" />
        </div>

        {/* Top-left corner — diagonal resize */}
        <div
          onMouseDown={(e) => startResize(e, 'both')}
          className="absolute -top-1 -left-1 h-5 w-5 cursor-nwse-resize z-20 group flex items-center justify-center"
        >
          <svg viewBox="0 0 10 10" className="h-3 w-3 text-navy-500 group-hover:text-accent/70 transition-colors rotate-0">
            <path d="M1 9 L9 1 M5 9 L9 5 M1 5 L5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-navy-600/50 bg-navy-800/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/30">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent-light">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.9a.5.5 0 00.625.624l3.768-1.008A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-white leading-none">BoneGuard Assistant</p>
              <p className="mt-1 text-xs text-slate-500">
                {process.env.NEXT_PUBLIC_USE_GROQ === 'true' ? 'Groq Cloud' : 'Ollama Local'} · {model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Model picker */}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-navy-500 bg-navy-700 px-2 py-1 text-[10px] text-slate-400 focus:outline-none focus:border-accent/50"
            >
              <option value="qwen2:0.5b">qwen2:0.5b (light)</option>
              <option value="llama3.2">llama3.2</option>
              <option value="llama3.1">llama3.1</option>
              <option value="mistral">mistral</option>
              <option value="gemma2">gemma2</option>
              <option value="phi3">phi3</option>
            </select>
            <button
              onClick={handleClear}
              title="Clear conversation"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-navy-700 hover:text-slate-300 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scan context badge */}
        {analysisResult && (
          <div className="flex items-center gap-2 border-b border-navy-600/30 bg-emerald-500/8 px-5 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400">
              Scan loaded · {analysisResult.predictions.detections?.length ?? 0} detection(s) · {analysisResult.filename}
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`
                flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold mt-0.5
                ${msg.role === 'user'
                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                  : 'bg-navy-700 text-slate-400 border border-navy-600'
                }
              `}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>

              {/* Bubble */}
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-3 text-base leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-accent/15 text-white border border-accent/20 rounded-tr-sm'
                  : 'bg-navy-800 text-slate-200 border border-navy-600/50 rounded-tl-sm'
                }
              `}>
                {msg.content === '' && isStreaming && i === messages.length - 1 ? (
                  <span className="flex gap-1 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-400">
              <p className="font-semibold mb-1">Connection Error</p>
              <p className="leading-relaxed">{error}</p>
              {error.includes('Ollama') && (
                <p className="mt-2 font-mono text-[10px] text-red-500/70">
                  → Run: <span className="text-red-400">ollama serve</span>
                </p>
              )}
              {error.includes('Model') && (
                <p className="mt-1 font-mono text-[10px] text-red-500/70">
                  → Run: <span className="text-red-400">ollama pull {model}</span>
                </p>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions — only shown at start */}
        {messages.length <= 1 && !isStreaming && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="rounded-full border border-navy-600/60 bg-navy-800/50 px-3.5 py-2 text-xs text-slate-400 hover:border-accent/40 hover:text-accent-light transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-navy-600/50 p-4">
          <div className="flex items-end gap-3 rounded-xl border border-navy-600/50 bg-navy-800 px-4 py-3 focus-within:border-accent/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the scan results..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent text-base text-white placeholder-slate-500 focus:outline-none disabled:opacity-50 max-h-40 leading-relaxed"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Stop generating"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed"
                title="Send (Enter)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-slate-600">
            Enter to send · Shift+Enter for new line · Not for clinical use
          </p>
        </div>
      </div>
    </>
  );
}
