import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { PromptData } from "../api/client";
import { submitFeedback } from "../api/client";
import AudioPlayer from "../components/AudioPlayer";

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    audio_url: string;
    image_url: string;
    track_id: string;
    title: string;
    suno_url: string;
    prompts: PromptData | null;
    song_concept: string;
  };

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!state?.audio_url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-text-muted">No track to display</p>
        <button
          onClick={() => navigate("/generate")}
          className="text-amber hover:underline"
        >
          Go generate one
        </button>
      </div>
    );
  }

  const handleRate = async (stars: number) => {
    setRating(stars);
    try {
      await submitFeedback(state.track_id, stars);
      setSubmitted(true);
    } catch {
      // rating saved locally even on failure
    }
  };

  const handleCopyPrompt = () => {
    const text = state.prompts?.suno_prompt || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      {/* Album art */}
      <div className="relative w-full max-w-md mb-8">
        {state.image_url && (
          <>
            <div
              className="absolute inset-0 blur-3xl opacity-30 scale-110"
              style={{
                backgroundImage: `url(${state.image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <img
              src={state.image_url}
              alt="Album art"
              className="relative w-full aspect-square object-cover rounded-2xl shadow-2xl"
            />
          </>
        )}
      </div>

      {/* Song info */}
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold mb-2 text-center">
        {state.title || "Your Reso Track"}
      </h2>
      {state.song_concept && (
        <p className="text-text-muted text-sm mb-2 text-center max-w-md">
          {state.song_concept}
        </p>
      )}
      {state.suno_url && (
        <a
          href={state.suno_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber hover:text-amber-light text-sm mb-6 transition-colors"
        >
          View on Suno
        </a>
      )}

      {/* Audio player */}
      <div className="w-full max-w-md mb-8">
        <AudioPlayer src={state.audio_url} />
      </div>

      {/* Rating */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <p className="text-sm text-text-muted">
          {submitted ? "Thanks for rating!" : "How does it sound?"}
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => handleRate(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <svg
                className={`w-8 h-8 ${
                  star <= (hoverRating || rating)
                    ? "text-amber fill-amber"
                    : "text-border fill-border"
                } transition-colors`}
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        {(submitted || rating > 0) && (
          <button
            onClick={() => navigate("/generate")}
            className="px-6 py-3 bg-amber hover:bg-amber-light text-bg font-semibold rounded-full transition-all duration-300"
          >
            Regenerate
          </button>
        )}
        <button
          onClick={handleCopyPrompt}
          className="px-6 py-3 border border-border hover:border-amber text-text-muted hover:text-text font-semibold rounded-full transition-all duration-300"
        >
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
      </div>
    </div>
  );
}
