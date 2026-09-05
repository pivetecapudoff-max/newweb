export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <g transform="rotate(22 12 12)">
        <circle cx="7.3" cy="3.4" r="1.45" />
        <rect x="5.5" y="4.8" width="3.6" height="14.6" rx="1.8" />
        <rect x="14.9" y="4.8" width="3.6" height="14.6" rx="1.8" />
        <circle cx="16.7" cy="3.4" r="1.45" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <>
      Illusions
      <span className="logo-suffix">UGC Bot</span>
    </>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <BrandMark />
      {!compact && <Wordmark />}
    </span>
  );
}
