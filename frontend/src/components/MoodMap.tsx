interface MoodMapProps {
  energy: number;   // 0–1; X axis: calm → energetic
  valence: number;  // 0–1; Y axis: dark → bright
}

export default function MoodMap({ energy, valence }: MoodMapProps) {
  const x = Math.max(0, Math.min(1, energy)) * 100;
  const y = (1 - Math.max(0, Math.min(1, valence))) * 100;

  return (
    <div className="relative w-full aspect-square max-w-[220px] mx-auto">
      {/* Grid */}
      <div className="absolute inset-0 border border-border rounded-xl overflow-hidden">
        {/* Quadrant labels */}
        <span className="absolute top-2 left-3 text-[10px] text-text-muted/60 uppercase tracking-wider">
          Melancholic
        </span>
        <span className="absolute top-2 right-3 text-[10px] text-text-muted/60 uppercase tracking-wider">
          Euphoric
        </span>
        <span className="absolute bottom-2 left-3 text-[10px] text-text-muted/60 uppercase tracking-wider">
          Calm
        </span>
        <span className="absolute bottom-2 right-3 text-[10px] text-text-muted/60 uppercase tracking-wider">
          Intense
        </span>

        {/* Crosshairs */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />

        {/* Axis labels */}
        <span className="absolute -bottom-5 left-0 text-[9px] text-text-muted/40">
          Calm
        </span>
        <span className="absolute -bottom-5 right-0 text-[9px] text-text-muted/40">
          Energetic
        </span>
        <span className="absolute -left-1 top-0 text-[9px] text-text-muted/40 -translate-x-full">
          Bright
        </span>
        <span className="absolute -left-1 bottom-0 text-[9px] text-text-muted/40 -translate-x-full">
          Dark
        </span>

        {/* Glowing dot */}
        <div
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="absolute inset-0 bg-violet rounded-full animate-ping opacity-30" />
          <div className="absolute inset-0 bg-violet rounded-full shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        </div>
      </div>
    </div>
  );
}
