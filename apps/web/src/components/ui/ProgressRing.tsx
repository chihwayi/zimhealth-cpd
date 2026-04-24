import { useEffect, useState } from 'react';

interface Props {
  value: number; // 0–100 (percentage)
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export function ProgressRing({
  value,
  size = 160,
  strokeWidth = 12,
  label,
  sublabel,
  color = '#3b82f6',
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference - (value / 100) * circumference;

  // Animate from empty (circumference) to target on mount and value change
  const [displayOffset, setDisplayOffset] = useState(circumference);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplayOffset(targetOffset));
    return () => cancelAnimationFrame(raf);
  }, [targetOffset]);

  const strokeColor = value >= 100 ? '#16a34a' : color;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={displayOffset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute text-center">
        {label && (
          <div className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">
            {label}
          </div>
        )}
        {sublabel && <div className="text-xs text-slate-500 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
