import { useState } from "react";

export function ItemThumb({
  url,
  name,
  className = "",
}: {
  url: string | null | undefined;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const show = url && !broken;

  return (
    <span
      className={`relative block overflow-hidden bg-transparent ${className}`}
      aria-label={name}
    >
      {show ? (
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-white/20">
          sem foto
        </span>
      )}
    </span>
  );
}
