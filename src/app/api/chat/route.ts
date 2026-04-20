import { NextRequest } from 'next/server';

const OLLAMA_URL  = process.env.OLLAMA_URL   || 'http://127.0.0.1:11434';
const GROQ_KEY    = process.env.GROQ_API_KEY || '';
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';

// Default models per provider
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2:0.5b';
const DEFAULT_GROQ_MODEL   = process.env.GROQ_MODEL   || 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are BoneGuard Assistant, an AI helper built into the BoneGuard bone lesion detection and classification system. BoneGuard uses YOLOv8 for detection and EfficientNet-B3 for classification, with Grad-CAM for visual explanations.

You help radiologists, researchers, and medical students understand:
- AI-detected bone lesion findings from the current scan
- What lesion types (osteolytic, osteoblastic, mixed, benign, malignant) mean clinically
- How to interpret detection confidence scores and Grad-CAM heatmaps
- General musculoskeletal radiology education
- How the underlying AI models work

Guidelines:
- Be concise and clear — 2-4 sentences per response unless a detailed explanation is needed
- When scan results are provided, reference them specifically in your answers
- Always end clinical interpretations with a reminder that this is a research tool and findings must be reviewed by a qualified radiologist
- Do not diagnose — educate and explain
- If asked something outside radiology/AI scope, politely redirect`;

// ── Groq (cloud, free tier) ────────────────────────────────────────────────
async function streamGroq(messages: object[], model: string): Promise<Response> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 512,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error('Invalid GROQ_API_KEY. Check your environment variable.');
    if (res.status === 429) throw new Error('Groq rate limit reached. Wait a moment and try again.');
    if (res.status === 404) throw new Error(`Groq model "${model}" not found. Try llama-3.1-8b-instant.`);
    throw new Error(`Groq error ${res.status}: ${text}`);
  }

  // Groq streams OpenAI-format SSE: data: {"choices":[{"delta":{"content":"..."}}]}
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); break; }

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const trimmed = line.replace(/^data: /, '').trim();
          if (!trimmed || trimmed === '[DONE]') continue;
          try {
            const json = JSON.parse(trimmed);
            const token = json?.choices?.[0]?.delta?.content ?? '';
            if (token) controller.enqueue(new TextEncoder().encode(token));
          } catch { /* partial line */ }
        }
      }
    },
    cancel() { reader.cancel(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Provider': 'groq',
    },
  });
}

// ── Ollama (local) ─────────────────────────────────────────────────────────
async function streamOllama(messages: object[], model: string): Promise<Response> {
  let ollamaRes: Response;
  try {
    console.log(`[ollama] Fetching ${OLLAMA_URL}/api/chat with model ${model}`);
    ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature: 0.7, num_predict: 512 },
      }),
    });
  } catch {
    throw new Error(
      `Cannot reach Ollama at ${OLLAMA_URL}. Make sure Ollama is running: start the Ollama app or run "ollama serve".`
    );
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text();
    if (ollamaRes.status === 404 || text.includes('model')) {
      throw new Error(`Model "${model}" not found. Run: ollama pull ${model}`);
    }
    throw new Error(`Ollama error: ${text}`);
  }

  const reader = ollamaRes.body!.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); break; }

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n').filter(Boolean)) {
          try {
            const json = JSON.parse(line);
            const token = json?.message?.content ?? '';
            if (token) controller.enqueue(new TextEncoder().encode(token));
            if (json?.done) { controller.close(); return; }
          } catch { /* partial line */ }
        }
      }
    },
    cancel() { reader.cancel(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Provider': 'ollama',
    },
  });
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, scanContext, model } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const systemContent = scanContext
      ? `${SYSTEM_PROMPT}\n\n--- CURRENT SCAN RESULTS ---\n${scanContext}\n---`
      : SYSTEM_PROMPT;

    const fullMessages = [
      { role: 'system', content: systemContent },
      ...messages,
    ];

    // Groq takes priority when API key is set (works in deployment)
    if (GROQ_KEY) {
      const GROQ_MODELS = ['llama-3.1-8b-instant','llama-3.3-70b-versatile','mixtral-8x7b-32768','gemma2-9b-it'];
      const groqModel = model && GROQ_MODELS.includes(model) ? model : DEFAULT_GROQ_MODEL;
      return await streamGroq(fullMessages, groqModel);
    }

    // Fall back to local Ollama (local dev)
    const ollamaModel = model || DEFAULT_OLLAMA_MODEL;
    console.log(`[chat] Using Ollama at ${OLLAMA_URL} with model ${ollamaModel}`);
    return await streamOllama(fullMessages, ollamaModel);

  } catch (err) {
    console.error('[chat] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
