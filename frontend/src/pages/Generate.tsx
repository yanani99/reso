import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { TasteProfile, PromptData, SSEEvent } from "../api/client";
import { startGeneration, submitCaptchaSolution } from "../api/client";
import PromptEditor from "../components/PromptEditor";
import CaptchaSolver from "../components/CaptchaSolver";

const STAGES: Record<string, { label: string; progress: number }> = {
  building_prompt: { label: "Crafting your sound profile...", progress: 20 },
  generating: { label: "Generating your track...", progress: 60 },
};

export default function Generate() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = (location.state as { profile?: TasteProfile })?.profile;

  const [platform, setPlatform] = useState<"suno" | "lyria">("suno");
  const [prompts, setPrompts] = useState<PromptData | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [stageMessage, setStageMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [captchaData, setCaptchaData] = useState<{
    image: string;
    prompt: string;
  } | null>(null);
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);

  const handleCaptchaSolve = useCallback(
    async (coordinates: { x: number; y: number }[]) => {
      setCaptchaSubmitting(true);
      try {
        await submitCaptchaSolution(coordinates);
        setCaptchaData(null);
        setStageMessage("Generating your track...");
        setProgress(60);
      } catch (e) {
        console.error("CAPTCHA solve failed:", e);
      } finally {
        setCaptchaSubmitting(false);
      }
    },
    []
  );

  const handleGenerate = () => {
    setGenerating(true);
    setError("");
    setStage("");
    setProgress(0);

    startGeneration(
      platform,
      editedPrompt || undefined,
      0.2,
      (event: SSEEvent) => {
        switch (event.type) {
          case "status": {
            const s = event.data.stage as string;
            setStage(s);
            setStageMessage(event.data.message as string);
            setProgress(STAGES[s]?.progress || 50);
            break;
          }
          case "prompt_ready": {
            const pd = event.data as unknown as PromptData;
            setPrompts(pd);
            if (!editedPrompt) {
              setEditedPrompt(pd.suno_prompt);
            }
            setProgress(40);
            break;
          }
          case "complete": {
            setProgress(100);
            navigate("/result", {
              state: {
                audio_url: event.data.audio_url,
                image_url: event.data.image_url,
                track_id: event.data.track_id,
                title: event.data.title,
                suno_url: event.data.suno_url,
                prompts,
                song_concept: prompts?.song_concept || "",
              },
            });
            break;
          }
          case "captcha_required": {
            setCaptchaData({
              image: event.data.image as string,
              prompt: event.data.prompt as string,
            });
            setStageMessage("Solve the CAPTCHA to continue");
            setProgress(50);
            break;
          }
          case "error": {
            setError(event.data.message as string);
            setGenerating(false);
            setCaptchaData(null);
            break;
          }
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold mb-8">
        Generate Your Song
      </h2>

      <div className="w-full max-w-xl space-y-6">
        {/* Platform toggle */}
        <div className="flex gap-2 bg-bg-card border border-border rounded-xl p-1.5">
          <button
            onClick={() => setPlatform("suno")}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${
              platform === "suno"
                ? "bg-amber text-bg"
                : "text-text-muted hover:text-text"
            }`}
          >
            Suno
          </button>
          <button
            disabled
            className="flex-1 py-2.5 rounded-lg font-medium text-text-muted/40 cursor-not-allowed text-sm relative"
          >
            Lyria
            <span className="absolute -top-2 -right-1 text-[10px] bg-rose/20 text-rose px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          </button>
        </div>

        {/* Prompt editor (collapsible) */}
        {prompts && (
          <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-bg-hover transition-colors"
            >
              <span className="font-medium text-sm">Edit Prompt</span>
              <svg
                className={`w-4 h-4 text-text-muted transition-transform ${showEditor ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showEditor && (
              <div className="px-6 pb-6">
                <PromptEditor
                  value={editedPrompt}
                  onChange={setEditedPrompt}
                />
              </div>
            )}
            {prompts.song_concept && (
              <div className="px-6 pb-4 text-sm text-text-muted">
                <span className="text-amber-light font-medium">Concept:</span>{" "}
                {prompts.song_concept}
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        {!generating ? (
          <button
            onClick={handleGenerate}
            className="w-full py-4 bg-amber hover:bg-amber-light text-bg font-bold text-lg rounded-2xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(212,148,58,0.25)]"
          >
            Generate
          </button>
        ) : (
          <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-end gap-1 h-10 justify-center">
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-gradient-to-t from-amber to-amber-light rounded-full"
                  style={{
                    animation: `waveform 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.04}s`,
                    height: "100%",
                  }}
                />
              ))}
            </div>

            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber to-rose rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-text-muted text-sm text-center">
              {stageMessage || "Preparing..."}
            </p>
          </div>
        )}

        {captchaData && (
          <CaptchaSolver
            image={captchaData.image}
            prompt={captchaData.prompt}
            onSolve={handleCaptchaSolve}
            submitting={captchaSubmitting}
          />
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
