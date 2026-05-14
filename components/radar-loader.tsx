'use client';

interface RadarLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: '360' | 'enrich';
}

const sizeMap = {
  sm: { outer: 32, cross: 10, dot: 3 },
  md: { outer: 48, cross: 14, dot: 4 },
  lg: { outer: 64, cross: 18, dot: 5 },
};

const variantColors = {
  '360': {
    base:   'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.35)',
    sweep1: 'rgba(99,102,241,0.5)',
    sweep2: 'rgba(99,102,241,0)',
    ring:   'rgba(99,102,241,0.4)',
    dot:    '#818cf8',
    label:  'text-indigo-400',
    glow:   'rgba(99,102,241,0.15)',
  },
  enrich: {
    base:   'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    sweep1: 'rgba(16,185,129,0.45)',
    sweep2: 'rgba(16,185,129,0)',
    ring:   'rgba(16,185,129,0.35)',
    dot:    '#34d399',
    label:  'text-emerald-400',
    glow:   'rgba(16,185,129,0.12)',
  },
};

export default function RadarLoader({
  label,
  size = 'md',
  variant = '360',
}: RadarLoaderProps) {
  const s = sizeMap[size];
  const c = variantColors[variant];
  const half = s.outer / 2;

  return (
    <span className="inline-flex flex-col items-center justify-center gap-1.5">
      {/* Radar disc */}
      <span
        className="relative flex-shrink-0"
        style={{ width: s.outer, height: s.outer }}
      >
        {/* Glow background */}
        <span
          className="radar-glow absolute inset-0 rounded-full"
          style={{ background: c.glow, filter: 'blur(6px)' }}
        />

        {/* Pulse rings — 3 staggered */}
        <span
          className="radar-ping-1 absolute inset-0 rounded-full"
          style={{ border: `1px solid ${c.ring}` }}
        />
        <span
          className="radar-ping-2 absolute inset-0 rounded-full"
          style={{ border: `1px solid ${c.ring}` }}
        />
        <span
          className="radar-ping-3 absolute inset-0 rounded-full"
          style={{ border: `1px solid ${c.ring}` }}
        />

        {/* Radar base circle */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: c.base,
            border: `1px solid ${c.border}`,
          }}
        />

        {/* Cross-hair lines */}
        <span
          className="absolute"
          style={{
            top: half - 0.5,
            left: half - s.cross / 2,
            width: s.cross,
            height: 1,
            background: c.border,
            opacity: 0.4,
          }}
        />
        <span
          className="absolute"
          style={{
            left: half - 0.5,
            top: half - s.cross / 2,
            height: s.cross,
            width: 1,
            background: c.border,
            opacity: 0.4,
          }}
        />

        {/* Sweep — rotating conic gradient wedge */}
        <span
          className="radar-sweep absolute inset-0 rounded-full overflow-hidden"
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 270deg, ${c.sweep1} 0deg, ${c.sweep2} 75deg, transparent 75deg)`,
            }}
          />
        </span>

        {/* Centre dot */}
        <span
          className="absolute rounded-full"
          style={{
            width: s.dot,
            height: s.dot,
            top: half - s.dot / 2,
            left: half - s.dot / 2,
            background: c.dot,
            boxShadow: `0 0 6px 2px ${c.dot}66`,
          }}
        />
      </span>

      {/* Optional label */}
      {label && (
        <span
          className={`text-[9px] font-medium tracking-wide ${c.label} opacity-70`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
