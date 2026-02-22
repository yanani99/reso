import { useState, useRef, useCallback } from "react";

interface CaptchaSolverProps {
  image: string;
  prompt: string;
  onSolve: (coordinates: { x: number; y: number }[]) => void;
  submitting: boolean;
}

interface Marker {
  x: number;
  y: number;
  pctX: number;
  pctY: number;
}

export default function CaptchaSolver({
  image,
  prompt,
  onSolve,
  submitting,
}: CaptchaSolverProps) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const naturalSize = useRef<{ w: number; h: number } | null>(null);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      naturalSize.current = {
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      };
    }
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (submitting) return;
      const img = imgRef.current;
      if (!img || !naturalSize.current) return;

      const rect = img.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const scaleX = naturalSize.current.w / rect.width;
      const scaleY = naturalSize.current.h / rect.height;

      setMarkers((prev) => [
        ...prev,
        {
          x: Math.round(clickX * scaleX),
          y: Math.round(clickY * scaleY),
          pctX: (clickX / rect.width) * 100,
          pctY: (clickY / rect.height) * 100,
        },
      ]);
    },
    [submitting]
  );

  const handleUndo = useCallback(() => {
    setMarkers((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (markers.length === 0) return;
    onSolve(markers.map((m) => ({ x: m.x, y: m.y })));
    setMarkers([]);
  }, [markers, onSolve]);

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-violet-light">
          CAPTCHA Verification Required
        </p>
        <p className="text-text font-semibold">{prompt}</p>
        <p className="text-xs text-text-muted">
          Click on the correct areas, then submit
        </p>
      </div>

      <div className="relative inline-block w-full select-none">
        <img
          ref={imgRef}
          src={`data:image/png;base64,${image}`}
          alt="CAPTCHA challenge"
          onLoad={handleImageLoad}
          onClick={handleClick}
          draggable={false}
          className="w-full rounded-lg cursor-crosshair border border-border"
        />
        {markers.map((m, i) => (
          <div
            key={i}
            className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-violet/80 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white pointer-events-none"
            style={{ left: `${m.pctX}%`, top: `${m.pctY}%` }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleUndo}
          disabled={markers.length === 0 || submitting}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Undo
        </button>
        <button
          onClick={handleSubmit}
          disabled={markers.length === 0 || submitting}
          className="flex-[2] py-2.5 rounded-xl bg-violet hover:bg-violet-light text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : `Submit (${markers.length})`}
        </button>
      </div>
    </div>
  );
}
