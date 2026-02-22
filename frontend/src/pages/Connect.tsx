import { useState } from "react";
import { getLoginUrl } from "../api/client";

export default function Connect() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { auth_url } = await getLoginUrl();
      window.location.href = auth_url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="text-center max-w-md">
        <h1 className="font-[family-name:var(--font-display)] text-6xl font-bold tracking-tight bg-gradient-to-r from-violet to-violet-light bg-clip-text text-transparent mb-4">
          Reso
        </h1>
        <p className="text-xl text-text-muted mb-12 font-light">
          Music that gets you.
        </p>

        <button
          onClick={handleConnect}
          disabled={loading}
          className="group relative px-8 py-4 bg-violet hover:bg-violet-light text-white font-semibold rounded-full transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] disabled:opacity-60 disabled:cursor-not-allowed text-lg"
        >
          {loading ? (
            <span className="flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Connect Spotify
            </span>
          )}
        </button>

        <p className="mt-8 text-sm text-text-muted/60 max-w-sm mx-auto leading-relaxed">
          We analyze your listening history to generate a song built for your
          ears. We don't store your Spotify data beyond this session.
          <br />
          Built by YA
        </p>
      </div>
    </div>
  );
}
