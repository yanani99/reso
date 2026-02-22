const API_BASE = import.meta.env.VITE_API_URL || "";

export interface TasteProfile {
  top_genres: string[];
  genre_clusters: string[];
  era_range: string;
  era_center: number;
  sample_top_tracks: string[];
  sample_top_artists: string[];
  popularity_avg: number;
  explicit_ratio: number;
  track_count: number;
  confidence: string;
}

export interface PromptData {
  suno_prompt: string;
  lyria_prompt: string;
  song_concept: string;
  mood: string;
  tempo_feel: string;
  energy_estimate: number;
  valence_estimate: number;
}

export interface GenerationResult {
  audio_url: string;
  image_url: string;
  track_id: string;
}

export interface SSEEvent {
  type: "status" | "prompt_ready" | "complete" | "error" | "captcha_required";
  data: Record<string, unknown>;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getLoginUrl(): Promise<{ auth_url: string }> {
  return apiFetch("/api/auth/login", { method: "POST" });
}

export async function analyzeProfile(): Promise<TasteProfile> {
  return apiFetch("/api/profile/analyze");
}

export function startGeneration(
  platform: string,
  customPrompt?: string,
  noveltyLevel = 0.2,
  onEvent?: (event: SSEEvent) => void
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      custom_prompt_override: customPrompt || null,
      novelty_level: noveltyLevel,
    }),
    signal: controller.signal,
  }).then(async (response) => {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ") && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent?.({ type: currentEvent as SSEEvent["type"], data });
          } catch {
            // skip malformed data
          }
          currentEvent = "";
        }
      }
    }
  });

  return controller;
}

export async function submitCaptchaSolution(
  coordinates: { x: number; y: number }[]
): Promise<{ ok: boolean }> {
  return apiFetch("/api/captcha/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates }),
  });
}

export async function submitFeedback(
  trackId: string,
  rating: number
): Promise<void> {
  await apiFetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_id: trackId, rating }),
  });
}
