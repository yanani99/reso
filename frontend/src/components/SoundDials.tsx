interface SoundDialsProps {
  popularityAvg: number;
  explicitRatio: number;
  eraCenter: number;
}

function normalizeEra(year: number): number {
  const min = 1970;
  const max = 2025;
  return Math.max(0, Math.min(100, ((year - min) / (max - min)) * 100));
}

interface FaderProps {
  leftLabel: string;
  rightLabel: string;
  value: number;
  delay: number;
}

function Fader({ leftLabel, rightLabel, value, delay }: FaderProps) {
  return (
    <div
      className="space-y-1.5"
      style={{ animation: `fadeIn 0.5s ease-out ${delay}s both` }}
    >
      <div className="relative h-7 flex items-center">
        <div className="absolute inset-x-0 h-[2px] bg-border rounded-full">
          {[25, 50, 75].map((pos) => (
            <div
              key={pos}
              className="absolute top-1/2 -translate-y-1/2 w-[1px] h-1.5 bg-text-muted/20"
              style={{ left: `${pos}%` }}
            />
          ))}
        </div>

        <div
          className="absolute left-0 h-[2px] bg-gradient-to-r from-amber/30 to-amber rounded-full"
          style={{
            width: `${value}%`,
            animation: `faderSlide 1s ease-out ${delay + 0.2}s both`,
          }}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-[18px] rounded-sm"
          style={{
            left: `${value}%`,
            background:
              "linear-gradient(to bottom, var(--color-amber-light), var(--color-amber))",
            boxShadow: "0 0 10px rgba(212, 148, 58, 0.35)",
            animation: `fadeIn 0.4s ease-out ${delay + 0.5}s both`,
          }}
        />
      </div>

      <div className="flex justify-between text-[10px] tracking-wide">
        <span className="text-text-muted/50">{leftLabel}</span>
        <span className="text-text-muted/50">{rightLabel}</span>
      </div>
    </div>
  );
}

export default function SoundDials({
  popularityAvg,
  explicitRatio,
  eraCenter,
}: SoundDialsProps) {
  return (
    <div className="space-y-4 py-1">
      <Fader
        leftLabel="Underground"
        rightLabel="Mainstream"
        value={popularityAvg}
        delay={0.1}
      />
      <Fader
        leftLabel="Clean"
        rightLabel="Explicit"
        value={explicitRatio * 100}
        delay={0.2}
      />
      <Fader
        leftLabel="Retro"
        rightLabel="Modern"
        value={normalizeEra(eraCenter)}
        delay={0.3}
      />
    </div>
  );
}
