import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TasteProfile, PromptData } from "../api/client";
import { analyzeProfile } from "../api/client";
import MoodMap from "../components/MoodMap";
import GenreCloud from "../components/GenreCloud";

function Waveform() {
  return (
    <div className="flex items-end gap-1 h-12 justify-center">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="w-1 bg-violet rounded-full"
          style={{
            animation: `waveform 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.05}s`,
            height: "100%",
          }}
        />
      ))}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    analyzeProfile()
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to analyze profile");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <Waveform />
        <p className="text-text-muted text-lg animate-pulse">
          Reading your musical DNA...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="text-violet hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const isUnderground = profile.popularity_avg < 50;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold mb-2 text-center">
        Your Musical DNA
      </h2>
      <p className="text-text-muted mb-10 text-center">
        Based on {profile.track_count} tracks analyzed
        <span className="ml-2 text-xs px-2 py-0.5 bg-violet/20 text-violet-light rounded-full">
          {profile.confidence} confidence
        </span>
      </p>

      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Your Genres
          </h3>
          <GenreCloud genres={profile.top_genres} />
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Your Mood Space
          </h3>
          <MoodMap energy={0.5} valence={0.5} />
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Your Era
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-violet-light">
              {profile.era_range}
            </span>
          </div>
          <p className="text-text-muted text-sm mt-1">
            Sweet spot around{" "}
            <span className="text-text font-medium">{profile.era_center}</span>
          </p>
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Your Vibe
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-lg font-semibold ${isUnderground ? "text-violet-light" : "text-coral"}`}
            >
              {isUnderground ? "Underground" : "Mainstream"}
            </span>
          </div>
          <p className="text-text-muted text-sm">
            Avg. popularity:{" "}
            <span className="text-text font-medium">
              {profile.popularity_avg.toFixed(0)}/100
            </span>
          </p>
          <p className="text-text-muted text-sm">
            Explicit ratio:{" "}
            <span className="text-text font-medium">
              {(profile.explicit_ratio * 100).toFixed(0)}%
            </span>
          </p>
        </div>
      </div>

      <button
        onClick={() =>
          navigate("/generate", { state: { profile } })
        }
        className="mt-10 px-8 py-4 bg-violet hover:bg-violet-light text-white font-semibold rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] text-lg"
      >
        Generate My Song →
      </button>
    </div>
  );
}
