interface GlyphProps {
  size?: number;
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: false,
} as const;

export function ShuffleGlyph({ size = 22, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none">
      <path
        d="M4 7h2.1c1.9 0 3 .9 4.1 2.5l3.6 5c1.1 1.6 2.2 2.5 4.1 2.5H20"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M17 4.8 20 7.8l-3 3"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17h2.1c1.9 0 3-.9 4.1-2.5l3.6-5c1.1-1.6 2.2-2.5 4.1-2.5H20"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="m17 13.2 3 3-3 3"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PreviousGlyph({ size = 22, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="4.2" y="5.5" width="2.2" height="13" rx="1.1" fill="currentColor" />
      <path
        d="M18.7 6.3v11.4c0 1.1-1.2 1.8-2.1 1.2l-8.4-5.7a1.4 1.4 0 0 1 0-2.4l8.4-5.7c.9-.6 2.1.1 2.1 1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function NextGlyph({ size = 22, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="17.6" y="5.5" width="2.2" height="13" rx="1.1" fill="currentColor" />
      <path
        d="M5.3 6.3v11.4c0 1.1 1.2 1.8 2.1 1.2l8.4-5.7a1.4 1.4 0 0 0 0-2.4L7.4 5.1c-.9-.6-2.1.1-2.1 1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlayGlyph({ size = 24, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path
        d="M8.3 5.8c0-1.2 1.3-1.9 2.3-1.3l8 5.2c.9.6.9 1.9 0 2.5l-8 5.2c-1 .6-2.3-.1-2.3-1.3V5.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PauseGlyph({ size = 24, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="7" y="5.5" width="3.4" height="13" rx="1.7" fill="currentColor" />
      <rect x="13.6" y="5.5" width="3.4" height="13" rx="1.7" fill="currentColor" />
    </svg>
  );
}

export function OrderGlyph({ size = 21, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none">
      <path
        d="M4 6.5h16M4 12h10M4 17.5h16"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QueueGlyph({ size = 22, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none">
      <path
        d="M4 6.8h11M4 11.8h8M4 16.8h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17.8" cy="16.7" r="2.6" fill="currentColor" />
      <path
        d="M20.4 16.7V8.2l2.1 1.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LocateGlyph({ size = 21, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className} fill="none">
      <circle cx="12" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <path
        d="M12 2.2v3.2M12 18.6v3.2M2.2 12h3.2M18.6 12h3.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoreGlyph({ size = 21, className }: GlyphProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
