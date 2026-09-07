import { Link } from "react-router-dom";
import type { Cluster } from "../lib/api";
import { CATEGORY_LABEL, demandNoun, formatDemand } from "../lib/labels";
import { ItemThumb } from "./ItemThumb";
import { SignalBadge, VerdictBadge } from "./VerdictBadge";
import { Flame, TrendingUp, Users, ArrowUpRight, Sparkles, AlertTriangle } from "lucide-react";

export function ClusterCard({ cluster }: { cluster: Cluster }) {
  const demandLabel = demandNoun(cluster.metrics.demandField);
  const previews = cluster.previews || [];
  const topPreview = previews[0];

  return (
    <Link
      to={`/painel/tema/${cluster.id}`}
      className="block group rounded-[24px] bg-[#0a0a0a] hover:bg-[#121212] p-5 sm:p-6 transition-all duration-300 shadow-[0_12px_36px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 text-white select-none relative overflow-hidden"
    >
      {/* Subtle Ambient Glow in Corner on Hover */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-600/5 group-hover:bg-blue-600/10 blur-2xl transition-all pointer-events-none" />

      {/* Top Bar: Category, Alert & Verdict */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-[11px] font-semibold uppercase tracking-wider">
            {CATEGORY_LABEL[cluster.category]}
          </span>
          {cluster.flagged && (
            <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Alerta Viral</span>
            </span>
          )}
        </div>
        <VerdictBadge verdict={cluster.verdict} />
      </div>

      {/* 4 Previews Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          {previews.slice(0, 4).map((preview) => (
            <div
              key={`${preview.itemType}-${preview.id}`}
              className="aspect-square rounded-xl bg-[#141414] overflow-hidden relative shadow-inner"
            >
              <ItemThumb
                url={preview.thumbnailUrl}
                name={preview.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      )}

      {/* Title & Arrow */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
          {cluster.label}
        </h3>
        <div className="w-7 h-7 rounded-full bg-white/5 group-hover:bg-white group-hover:text-black text-white/50 flex items-center justify-center transition-all shrink-0 mt-0.5">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>

      {/* Badges / Chips */}
      {cluster.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {cluster.badges.map((badge) => (
            <SignalBadge key={badge} badge={badge} />
          ))}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 py-3 px-3.5 rounded-xl bg-[#121212] mb-3 text-xs">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div>
            <div className="font-extrabold text-white text-sm leading-none">
              {(cluster.metrics.demandTotal ?? 0).toLocaleString("pt-BR")}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5 font-medium">
              {demandLabel.toLowerCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div>
            <div className="font-extrabold text-white text-sm leading-none">
              {cluster.metrics.acceleration.toFixed(2)}x
            </div>
            <div className="text-[10px] text-white/40 mt-0.5 font-medium">
              velocidade
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <div>
            <div className="font-extrabold text-white text-sm leading-none">
              {cluster.metrics.uniqueCreators}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5 font-medium">
              criadores
            </div>
          </div>
        </div>
      </div>

      {/* Top Performer Snippet */}
      {topPreview && (
        <div className="text-[11px] text-white/50 bg-[#121212] px-3 py-2 rounded-xl flex items-center justify-between gap-2 mb-3.5">
          <span className="truncate">
            <strong className="text-white/80 font-medium">Top {formatDemand(
              topPreview.demandField === "vendas"
                ? topPreview.saleCount || 0
                : topPreview.favoriteCount || 0,
              topPreview.demandField
            )}:</strong> {cluster.metrics.topSellerName || topPreview.name}
          </span>
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
        </div>
      )}

      {/* Keyword tags */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {cluster.keywords.slice(0, 5).map((row) => (
          <span
            key={row.term}
            className="px-2.5 py-1 rounded-full bg-[#161616] group-hover:bg-[#1a1a1a] text-white/60 text-[11px] font-medium transition-colors"
          >
            {row.term}
          </span>
        ))}
      </div>
    </Link>
  );
}
