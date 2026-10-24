// LLM client for Gemma 4. Two keys, two jobs:
//
//   AI_API_KEY  – the Gemini API (Google AI Studio) serving Gemma 4 as
//                 `gemma-4-26b-a4b-it`. Used for help: small steps, learning help,
//                 ProblemHunt, teacher-rating summaries and tone checks.
//                 Free key: https://aistudio.google.com/apikey
//   DO_API_KEY  – DigitalOcean Gradient AI serverless inference (OpenAI-compatible,
//                 https://inference.do-ai.run/v1) serving Gemma 4 as `gemma-4-31B-it`.
//                 Used for prioritization: Begin and the AI-sorted Inbox.
//                 Key: DigitalOcean control panel → Serverless inference → Model access keys.
//
// If one provider fails, the other one is tried, then the rule-based fallback.
// Other values for AI_PROVIDER:
//   openai       – any OpenAI-compatible server running Gemma 4: Ollama (gemma4:e4b), vLLM…
//   digitalocean – run everything on DigitalOcean (AI_API_KEY = model access key)
//   none         – no model; every feature uses its rule-based fallback.

export type Provider = "gemini" | "openai" | "digitalocean" | "none";

export interface LlmConfig {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  jsonMode: boolean;
  thinking: "minimal" | "high";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Optional images as data URLs (Gemma 4 is multimodal). */
  images?: string[];
}

export interface ChatOptions {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const env = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
};

export const DO_BASE_URL = "https://inference.do-ai.run/v1";
export const DO_MODEL = "gemma-4-31B-it";
const DEFAULTS: Record<Exclude<Provider, "none">, { baseUrl: string; model: string }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemma-4-26b-a4b-it" },
  openai: { baseUrl: "http://localhost:11434/v1", model: "gemma4:e4b" },
  digitalocean: { baseUrl: DO_BASE_URL, model: DO_MODEL },
};
const doKey = (): string | undefined => env("DO_API_KEY") ?? env("DIGITALOCEAN_MODEL_ACCESS_KEY") ?? env("MODEL_ACCESS_KEY");
const shared = () => ({
  timeoutMs: Number(env("AI_TIMEOUT_MS") ?? 60000),
  jsonMode: (env("AI_JSON_MODE") ?? "true") !== "false",
  thinking: (env("AI_THINKING") === "high" ? "high" : "minimal") as LlmConfig["thinking"],
});

/** The main provider (AI_PROVIDER, default Gemini API). */
export const getLlmConfig = (): LlmConfig => {
  const raw = env("AI_PROVIDER") ?? "gemini";
  const provider = (["gemini", "openai", "digitalocean", "none"].includes(raw) ? raw : "gemini") as Provider;
  const d = DEFAULTS[provider === "none" ? "gemini" : provider];
  return {
    provider,
    baseUrl: (env("AI_BASE_URL") ?? d.baseUrl).replace(/\/+$/, ""),
    model: env("AI_MODEL") ?? d.model,
    apiKey:
      env("AI_API_KEY") ?? env("GEMINI_API_KEY") ?? env("GOOGLE_API_KEY") ?? (provider === "digitalocean" ? (doKey() ?? "") : ""),
    ...shared(),
  };
};

/** DigitalOcean Gradient AI serverless inference, when DO_API_KEY is set. */
export const getDoConfig = (): LlmConfig | undefined => {
  const apiKey = doKey();
  if (!apiKey) return undefined;
  return {
    provider: "digitalocean",
    baseUrl: (env("DO_BASE_URL") ?? DO_BASE_URL).replace(/\/+$/, ""),
    model: env("DO_MODEL") ?? DO_MODEL,
    apiKey,
    ...shared(),
  };
};

export type Job = "help" | "priority";

const usable = (c: LlmConfig): boolean => c.provider !== "none" && (c.provider === "openai" || Boolean(c.apiKey));

/** Providers to try, in order: prioritization prefers DigitalOcean, everything else the main provider. */
export const chainFor = (job: Job): LlmConfig[] => {
  const main = getLlmConfig();
  const dOcean = getDoConfig();
  const order = job === "priority" ? [dOcean, main] : [main, dOcean];
  const seen = new Set<string>();
  const list = order.filter((c): c is LlmConfig => {
    if (!c || !usable(c)) return false;
    const k = `${c.provider}|${c.baseUrl}|${c.model}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return list.length ? list : [main]; // keeps a clear error ("AI_API_KEY is not set")
};

export const providerLabel = (p: string): string =>
  ({ gemini: "Gemini API", digitalocean: "DigitalOcean", openai: "OpenAI-compatible", none: "—" })[p] ?? p;

export class LlmError extends Error {}

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    const err = e as Error;
    throw new LlmError(
      err.name === "AbortError" ? `AI request timed out after ${timeoutMs} ms` : `AI server unreachable (${err.message})`,
    );
  } finally {
    clearTimeout(timer);
  }
};

const splitDataUrl = (url: string): { mimeType: string; data: string } | undefined => {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(url);
  return m ? { mimeType: m[1], data: m[2] } : undefined;
};

// Some servers/models reject structured-output flags; remember and stop sending them.
const jsonUnsupported = new Set<string>();

// ---------------------------------------------------------------- Gemini API (Gemma 4)

const chatGemini = async (cfg: LlmConfig, messages: ChatMessage[], opts: ChatOptions): Promise<string> => {
  if (!cfg.apiKey) throw new LlmError("AI_API_KEY is not set (Gemini API key from aistudio.google.com)");

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        ...(m.images ?? [])
          .map(splitDataUrl)
          .filter((x) => x !== undefined)
          .map((inlineData) => ({ inlineData })),
        { text: m.content },
      ],
    }));

  const key = `gemini:${cfg.model}`;
  const send = (useJson: boolean, useThinking: boolean) =>
    withTimeout(
      `${cfg.baseUrl}/models/${encodeURIComponent(cfg.model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: {
            temperature: opts.temperature ?? 0.3,
            maxOutputTokens: opts.maxTokens ?? 2048,
            ...(useJson ? { responseMimeType: "application/json" } : {}),
            ...(useThinking ? { thinkingConfig: { thinkingLevel: cfg.thinking } } : {}),
          },
        }),
      },
      opts.timeoutMs ?? cfg.timeoutMs,
    );

  let useJson = Boolean(opts.json && cfg.jsonMode && !jsonUnsupported.has(key));
  let useThinking = !jsonUnsupported.has(`${key}:thinking`);
  let res = await send(useJson, useThinking);
  // If the model rejects an optional flag (JSON mode, thinking level), drop it,
  // remember that for this model, and retry: first JSON mode, then thinking.
  while (res.status === 400 && (useJson || useThinking)) {
    const body = await res.text().catch(() => "");
    if (/api.?key|permission|unauthori[sz]ed|quota/i.test(body)) {
      throw new LlmError(`Gemini API returned 400: ${body.slice(0, 240)}`);
    }
    const blamesThinking = /thinking/i.test(body);
    if (useJson && !blamesThinking) {
      jsonUnsupported.add(key);
      useJson = false;
    } else {
      jsonUnsupported.add(`${key}:thinking`);
      useThinking = false;
    }
    res = await send(useJson, useThinking);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 401 ? " (key rejected — create a new key at aistudio.google.com/apikey)" : res.status === 429 ? " (rate limit — wait a minute)" : "";
    throw new LlmError(`Gemini API returned ${res.status}${hint}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) throw new LlmError(`Blocked by Gemini API: ${data.promptFeedback.blockReason}`);
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  if (!text) throw new LlmError(`Gemini API returned no text (${data.candidates?.[0]?.finishReason ?? "unknown"})`);
  return text;
};

// ---------------------------------------------------------------- OpenAI-compatible (Ollama, vLLM…)

const chatOpenAi = async (cfg: LlmConfig, messages: ChatMessage[], opts: ChatOptions): Promise<string> => {
  if (cfg.provider === "digitalocean" && !cfg.apiKey) throw new LlmError("DO_API_KEY is not set (DigitalOcean model access key)");
  const body = (useJson: boolean) =>
    JSON.stringify({
      model: cfg.model,
      messages: messages.map((m) =>
        m.images?.length
          ? {
              role: m.role,
              content: [{ type: "text", text: m.content }, ...m.images.map((url) => ({ type: "image_url", image_url: { url } }))],
            }
          : { role: m.role, content: m.content },
      ),
      temperature: opts.temperature ?? 0.3,
      // DigitalOcean deprecated max_tokens in favour of max_completion_tokens.
      ...(cfg.provider === "digitalocean" ? { max_completion_tokens: opts.maxTokens ?? 2048 } : { max_tokens: opts.maxTokens ?? 2048 }),
      stream: false,
      ...(useJson ? { response_format: { type: "json_object" } } : {}),
    });
  const key = `${cfg.provider}:${cfg.model}`;
  const send = (useJson: boolean) =>
    withTimeout(
      `${cfg.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: body(useJson),
      },
      opts.timeoutMs ?? cfg.timeoutMs,
    );
  const wantJson = Boolean(opts.json && cfg.jsonMode && !jsonUnsupported.has(key));
  let res = await send(wantJson);
  if (!res.ok && wantJson && res.status === 400) {
    jsonUnsupported.add(key);
    res = await send(false);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const who = cfg.provider === "digitalocean" ? "DigitalOcean" : "AI server";
    const hint = res.status === 401 || res.status === 403 ? " (check the model access key)" : res.status === 429 ? " (rate limit — wait a minute)" : "";
    throw new LlmError(`${who} returned ${res.status}${hint}: ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("AI returned an empty response");
  return content;
};

/** Send a chat to the configured Gemma 4 endpoint and return the text reply. */
export const chat = async (
  messages: ChatMessage[],
  opts: ChatOptions = {},
  cfg: LlmConfig = getLlmConfig(),
): Promise<string> => {
  if (cfg.provider === "none") throw new LlmError("AI is disabled (AI_PROVIDER=none)");
  const raw = cfg.provider === "gemini" ? await chatGemini(cfg, messages, opts) : await chatOpenAi(cfg, messages, opts);
  return stripThinking(raw);
};

export interface Completion {
  text: string;
  provider: Provider;
  model: string;
  /** Error from a provider that was tried first and failed. */
  fallbackFrom?: string;
}

/** Run a job on its provider chain (e.g. DigitalOcean, then the Gemini API). */
export const complete = async (messages: ChatMessage[], opts: ChatOptions, job: Job = "help"): Promise<Completion> => {
  const errors: string[] = [];
  for (const cfg of chainFor(job)) {
    try {
      const text = await chat(messages, opts, cfg);
      return { text, provider: cfg.provider, model: cfg.model, ...(errors.length ? { fallbackFrom: errors.join(" · ") } : {}) };
    } catch (e) {
      errors.push(`${providerLabel(cfg.provider)}: ${(e as Error).message}`);
    }
  }
  throw new LlmError(errors.join(" · "));
};

/** What features accept for testing: a fake that returns text, or a full completion. */
export type ChatFn = (messages: ChatMessage[], opts: ChatOptions) => Promise<string | Completion>;
export const runChat = async (fn: ChatFn, messages: ChatMessage[], opts: ChatOptions, job: Job): Promise<Completion> => {
  const r = await fn(messages, opts);
  if (typeof r !== "string") return r;
  const cfg = chainFor(job)[0];
  return { text: r, provider: cfg.provider, model: cfg.model };
};
export const helpChat: ChatFn = (m, o) => complete(m, o, "help");
export const priorityChat: ChatFn = (m, o) => complete(m, o, "priority");

/** Remove reasoning traces some runtimes leave in the content. */
export const stripThinking = (text: string): string =>
  text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel\|?>thought[\s\S]*?<\|?channel\|>/gi, "")
    .trim();

export interface AiStatus {
  provider: Provider;
  model: string;
  online: boolean;
  message: string;
}

const statusCache = new Map<string, { at: number; value: AiStatus }>();

/** Cheap reachability check (cached 30 s) for the header status pill. */
export const checkAiStatus = async (cfg: LlmConfig = getLlmConfig()): Promise<AiStatus> => {
  const cacheKey = `${cfg.provider}|${cfg.baseUrl}|${cfg.model}|${cfg.apiKey.slice(-6)}`;
  const hit = statusCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 30000) return hit.value;
  const base = { provider: cfg.provider, model: cfg.model };
  let value: AiStatus;
  try {
    if (cfg.provider === "none") {
      value = { ...base, online: false, message: "AI disabled — rule-based mode" };
    } else if (cfg.provider === "gemini") {
      if (!cfg.apiKey) {
        value = { ...base, online: false, message: "Set AI_API_KEY (Gemini API key) in .env" };
      } else {
        const res = await withTimeout(
          `${cfg.baseUrl}/models/${encodeURIComponent(cfg.model)}`,
          { headers: { "x-goog-api-key": cfg.apiKey } },
          5000,
        );
        const body = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 160);
        value = res.ok
          ? { ...base, online: true, message: "Gemma 4 via Gemini API" }
          : {
              ...base,
              online: false,
              message:
                res.status === 401
                  ? `Gemini API 401 — the key was rejected (${body}). Create a new key at aistudio.google.com/apikey.`
                  : `Gemini API returned ${res.status} — check AI_API_KEY / AI_MODEL (${body})`,
            };
      }
    } else if (cfg.provider === "digitalocean" && !cfg.apiKey) {
      value = { ...base, online: false, message: "Set DO_API_KEY (DigitalOcean model access key) in .env" };
    } else {
      const res = await withTimeout(
        `${cfg.baseUrl}/models`,
        { headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {} },
        cfg.provider === "digitalocean" ? 6000 : 3000,
      );
      const who = cfg.provider === "digitalocean" ? "DigitalOcean" : "AI server";
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 160);
        value = {
          ...base,
          online: false,
          message: res.status === 401 || res.status === 403 ? `${who} ${res.status} — the key was rejected (${body})` : `${who} returned ${res.status} (${body})`,
        };
      } else {
        const data = (await res.json().catch(() => ({}))) as { data?: { id: string }[] };
        const ids = (data.data ?? []).map((m) => m.id.toLowerCase());
        value =
          ids.length === 0 || ids.includes(cfg.model.toLowerCase())
            ? { ...base, online: true, message: cfg.provider === "digitalocean" ? "Gemma 4 via DigitalOcean serverless inference" : "Model ready" }
            : {
                ...base,
                online: false,
                message:
                  cfg.provider === "digitalocean"
                    ? `Model "${cfg.model}" is not in your DigitalOcean model list — check DO_MODEL`
                    : `Model "${cfg.model}" not found — try: ollama pull ${cfg.model}`,
              };
      }
    }
  } catch (e) {
    value = { ...base, online: false, message: (e as Error).message };
  }
  statusCache.set(cacheKey, { at: Date.now(), value });
  return value;
};

/** Status of the main (help) provider and of the prioritization provider. */
export const checkAllStatus = async (): Promise<AiStatus & { priority: AiStatus }> => {
  const main = getLlmConfig();
  const pri = chainFor("priority")[0];
  const [a, b] = await Promise.all([checkAiStatus(main), checkAiStatus(pri)]);
  return { ...a, priority: b };
};
