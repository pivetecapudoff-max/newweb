import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCluster, itemPreviewHref, type ClusterDetail } from "../lib/api";
import {
  CATEGORY_LABEL,
  VERDICT_LABEL,
  demandCaption,
  demandNoun,
  formatDemand,
} from "../lib/labels";
import { ItemThumb } from "../components/ItemThumb";
import { SignalBadge, VerdictBadge } from "../components/VerdictBadge";
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Flame,
  TrendingUp,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

function catalogUrl(item: ClusterDetail["items"][number]): string {
  return item.itemType === "Bundle"
    ? `https://www.roblox.com/bundles/${item.id}`
    : `https://www.roblox.com/catalog/${item.id}`;
}

export function ClusterPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<ClusterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCluster(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6 md:p-8 space-y-4 text-white">
        <Link
          to="/painel/feed"
          className="inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Tendências
        </Link>
        <div className="p-4 rounded-2xl bg-rose-500/15 text-rose-300 text-xs font-medium">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-white select-none">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-white/50">Carregando detalhes do nicho...</p>
        </div>
      </div>
    );
  }

  const { cluster, items, history } = data;
  const m = cluster.metrics;

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6 pb-24 text-white select-none">
      {/* Back link */}
      <div>
        <Link
          to="/painel/feed"
          className="inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white bg-[#141414] hover:bg-[#1f1f1f] px-4 py-2 rounded-full transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Tendências</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[24px] bg-[#0a0a0a] p-6 sm:p-7 shadow-[0_12px_36px_rgba(0,0,0,0.4)] space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-[11px] font-semibold uppercase tracking-wider">
                {CATEGORY_LABEL[cluster.category]}
              </span>
              {cluster.flagged && (
                <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
                  Alerta Viral
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {cluster.label}
            </h1>
          </div>
          <VerdictBadge verdict={cluster.verdict} />
        </div>

        {cluster.badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cluster.badges.map((badge) => (
              <SignalBadge key={badge} badge={badge} />
            ))}
          </div>
        )}

        {cluster.matchedIp && (
          <p className="text-xs text-white/50 bg-[#141414] p-3 rounded-xl">
            Referência combinada: <strong className="text-white">{cluster.matchedIp}</strong> &bull; {data.overlaySource}
          </p>
        )}

        {/* 5 Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#121212]">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-medium mb-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Demanda</span>
            </div>
            <div className="text-xl font-extrabold text-white">
              {(m.demandTotal ?? 0).toLocaleString("pt-BR")}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{demandNoun(m.demandField)}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121212]">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-medium mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Aceleração</span>
            </div>
            <div className="text-xl font-extrabold text-white">
              {m.acceleration.toFixed(2)}x
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">ritmo de crescimento</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121212]">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-medium mb-1">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>Criadores</span>
            </div>
            <div className="text-xl font-extrabold text-white">{m.uniqueCreators}</div>
            <div className="text-[10px] text-white/40 mt-0.5">designers no nicho</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121212]">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-medium mb-1">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Tamanho</span>
            </div>
            <div className="text-xl font-extrabold text-white">{m.size}</div>
            <div className="text-[10px] text-white/40 mt-0.5">peças catalogadas</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121212]">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-medium mb-1">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Velocidade</span>
            </div>
            <div className="text-xl font-extrabold text-white">{m.velocity}</div>
            <div className="text-[10px] text-white/40 mt-0.5">giro por ciclo</div>
          </div>
        </div>

        <p className="text-xs text-white/40 pt-1">
          {demandCaption(m.demandField)}. Vendas na economia: {m.salesTotal ?? 0}
          {m.itemsWithSales ? ` em ${m.itemsWithSales} item(s)` : ""}. Favoritos no catálogo:{" "}
          {m.favoritesTotal ?? 0}.
          {m.topSellerName ? ` Maior demanda: ${m.topSellerName} (${m.topSellerDemand}).` : ""}
        </p>
      </motion.div>

      {/* Cluster Words / Keywords */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-[24px] bg-[#0a0a0a] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-3"
      >
        <h3 className="text-sm font-bold text-white tracking-tight">Palavras-Chave do Cluster</h3>
        <div className="flex flex-wrap gap-2">
          {cluster.keywords.map((row) => (
            <span
              key={row.term}
              className="px-3 py-1 rounded-full bg-[#141414] text-white/70 text-xs font-medium flex items-center gap-2"
            >
              <span>{row.term}</span>
              <span className="text-[10px] text-white/30 font-mono">
                {row.weight.toFixed(2)}
              </span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* Item Previews */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-[24px] bg-[#0a0a0a] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-4"
      >
        <h3 className="text-sm font-bold text-white tracking-tight">Roupas em Destaque no Nicho</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={`${item.itemType}-${item.id}`}
              className="rounded-2xl bg-[#121212] p-3.5 flex flex-col justify-between group hover:bg-[#161616] transition-all"
            >
              <div>
                <div className="aspect-square rounded-xl overflow-hidden bg-[#1a1a1a] mb-3">
                  <ItemThumb
                    url={item.thumbnailUrl}
                    name={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <p className="text-xs font-bold text-white truncate">{item.name}</p>
                <p className="text-[11px] text-white/40 mt-1 font-medium">
                  {formatDemand(
                    item.demandField === "vendas"
                      ? item.saleCount || 0
                      : item.favoriteCount || 0,
                    item.demandField
                  )}
                  {item.demandField === "vendas" && item.favoriteCount
                    ? ` &bull; ${item.favoriteCount} fav`
                    : ""}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5 truncate">
                  {item.creatorName}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-3 mt-2 border-t border-white/5">
                <a
                  href={catalogUrl(item)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-1.5 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Catálogo</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                {item.thumbnailUrl ? (
                  <a
                    href={itemPreviewHref(item.id)}
                    download
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                    title="Baixar preview"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Cycle History Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-[24px] bg-[#0a0a0a] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-4"
      >
        <h3 className="text-sm font-bold text-white tracking-tight">Histórico de Ciclos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-white/40 font-medium border-b border-white/5 pb-2">
                <th className="pb-3 px-3">Data / Hora</th>
                <th className="pb-3 px-3">Veredito</th>
                <th className="pb-3 px-3">Tamanho</th>
                <th className="pb-3 px-3">Vel.</th>
                <th className="pb-3 px-3">Aceleração</th>
                <th className="pb-3 px-3">Pureza</th>
                <th className="pb-3 px-3 text-right">Demanda</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr
                  key={row.cycleId}
                  className="hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]"
                >
                  <td className="py-3 px-3 text-white/70 font-mono text-[11px]">
                    {new Date(row.finishedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="py-3 px-3 font-semibold text-white/90">
                    {VERDICT_LABEL[row.verdict]}
                  </td>
                  <td className="py-3 px-3 text-white/60">{row.metrics.size}</td>
                  <td className="py-3 px-3 text-white/60">{row.metrics.velocity}</td>
                  <td className="py-3 px-3 text-blue-400 font-semibold">
                    {row.metrics.acceleration.toFixed(2)}x
                  </td>
                  <td className="py-3 px-3 text-white/60">{row.metrics.purity.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-white font-bold">
                    {row.metrics.demandTotal ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
