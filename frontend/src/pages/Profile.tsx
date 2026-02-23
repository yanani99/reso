import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TasteProfile } from "../api/client";
import { analyzeProfile } from "../api/client";
import SoundDials from "../components/SoundDials";
import GenreCloud from "../components/GenreCloud";

function Waveform() {
  return (
    <div className="flex items-end gap-1 h-12 justify-center">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="w-1 bg-amber rounded-full"
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
          className="text-amber hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <h2
        className="font-[family-name:var(--font-display)] text-3xl font-bold mb-2 text-center"
        style={{ animation: "fadeSlideUp 0.5s ease-out 0.05s both" }}
      >
        Your Musical DNA
      </h2>
      <p
        className="text-text-muted mb-10 text-center"
        style={{ animation: "fadeSlideUp 0.5s ease-out 0.1s both" }}
      >
        Based on {profile.track_count} tracks analyzed
        <span className="ml-2 text-xs px-2 py-0.5 bg-amber/15 text-amber-light rounded-full">
          {profile.confidence} confidence
        </span>
      </p>

      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="bg-bg-card border border-border rounded-2xl p-6"
          style={{ animation: "fadeSlideUp 0.5s ease-out 0.15s both" }}
        >
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Your Genres
          </h3>
          <GenreCloud genres={profile.top_genres} />
        </div>

        <div
          className="bg-bg-card border border-border rounded-2xl p-6"
          style={{ animation: "fadeSlideUp 0.5s ease-out 0.25s both" }}
        >
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Your Sound
          </h3>
          <SoundDials
            popularityAvg={profile.popularity_avg}
            explicitRatio={profile.explicit_ratio}
            eraCenter={profile.era_center}
          />
        </div>

        <div
          className="bg-bg-card border border-border rounded-2xl p-6"
          style={{ animation: "fadeSlideUp 0.5s ease-out 0.35s both" }}
        >
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Your Era
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-light">
              {profile.era_range}
            </span>
          </div>
          <p className="text-text-muted text-sm mt-1">
            Sweet spot around{" "}
            <span className="text-text font-medium">{profile.era_center}</span>
          </p>
        </div>

        <div
          className="bg-bg-card border border-border rounded-2xl p-6"
          style={{ animation: "fadeSlideUp 0.5s ease-out 0.45s both" }}
        >
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Your Artists
          </h3>
          <div className="space-y-2">
            {profile.sample_top_artists.slice(0, 5).map((artist, i) => (
              <div key={artist} className="flex items-center gap-3">
                <span className="text-amber/30 text-xs font-mono w-5 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    i === 0
                      ? "text-base font-semibold text-text"
                      : "text-sm text-text-muted"
                  }
                >
                  {artist}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate("/generate", { state: { profile } })}
        className="mt-10 px-8 py-4 bg-amber hover:bg-amber-light text-bg font-semibold rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,148,58,0.25)] text-lg"
        style={{ animation: "fadeSlideUp 0.5s ease-out 0.55s both" }}
      >
        Generate My Song &rarr;
      </button>
    </div>
  );
}
