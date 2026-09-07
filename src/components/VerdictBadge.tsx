import { BADGE_LABEL, VERDICT_LABEL, type Badge, type Verdict } from "../lib/labels";

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const styles: Record<Verdict, string> = {
    subir: "bg-blue-500/15 text-blue-400 font-semibold",
    vale: "bg-blue-600/15 text-blue-400 font-semibold",
    olho: "bg-amber-500/15 text-amber-300 font-semibold",
    passar: "bg-white/10 text-white/40 font-medium",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider ${
        styles[verdict] || "bg-white/10 text-white/70"
      }`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function SignalBadge({ badge }: { badge: Badge }) {
  const styles: Record<Badge, string> = {
    ganhando_forca: "bg-blue-500/15 text-blue-300",
    achado: "bg-blue-600/15 text-blue-400",
    referencia: "bg-pink-500/15 text-pink-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
        styles[badge] || "bg-white/10 text-white/70"
      }`}
    >
      {BADGE_LABEL[badge]}
    </span>
  );
}
