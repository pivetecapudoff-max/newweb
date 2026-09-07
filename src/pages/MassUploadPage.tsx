import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shirt,
  Sparkles,
  TrendingUp,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  cloneAssetToGroup,
  fetchUploads,
  scanMarketCatalog,
  type ClothingKind,
  type ScannedMarketItem,
  type UploadGroup,
} from "../lib/api";

const MAX_BATCH = 8;

type CatalogFilter = "both" | "shirts" | "pants" | "tshirts";
type BatchState = {
  state: "waiting" | "creating" | "queued" | "failed";
  message: string;
};

const FILTERS: Array<{ value: CatalogFilter; label: string }> = [
  { value: "both", label: "Camisas + calças" },
  { value: "shirts", label: "Camisas" },
  { value: "pants", label: "Calças" },
  { value: "tshirts", label: "T-shirts" },
];

function candidateKind(item: ScannedMarketItem): ClothingKind {
  if (item.assetType === 12 || item.assetTypeName.toLowerCase().includes("pant") || item.category === "pants") return "pants";
  if (item.assetType === 2 || item.assetTypeName.toLowerCase().includes("t-shirt") || item.category === "tshirts") return "tshirt";
  return "shirt";
}

function demandValue(item: ScannedMarketItem): number {
  return item.saleCount != null ? item.saleCount : item.favoriteCount;
}

function demandLabel(item: ScannedMarketItem): string {
  return item.saleCount != null ? "vendas públicas" : "favoritos";
}

function formatFav(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}m`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function statusIcon(status?: BatchState) {
  if (!status || status.state === "waiting") return <Clock3 className="h-3.5 w-3.5" />;
  if (status.state === "creating") return <LoaderCircle className="h-3.5 w-3.5 animate-spin" />;
  if (status.state === "queued") return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <XCircle className="h-3.5 w-3.5" />;
}

export function MassUploadPage() {
  const [items, setItems] = useState<ScannedMarketItem[]>([]);
  const [groups, setGroups] = useState<UploadGroup[]>([]);
  const [connected, setConnected] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [filter, setFilter] = useState<CatalogFilter>("both");
  const [price, setPrice] = useState(5);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [antiBan, setAntiBan] = useState(true);
  const [batch, setBatch] = useState<Record<number, BatchState>>({});

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected]
  );

  const estimatedFee = useMemo(
    () => selectedItems.reduce((sum, item) => sum + (candidateKind(item) === "tshirt" ? 0 : 10), 0),
    [selectedItems]
  );

  async function refreshTrends(nextFilter: CatalogFilter = filter) {
    setLoading(true);
    setError(null);
    setBatch({});
    try {
      const result = await scanMarketCatalog({
        strategy: "bestselling",
        timePeriod: "week",
        assetType: nextFilter,
        limit: 30,
        shirtPantsRatio: 50,
      });
      const ranked = [...result.items]
        .filter((item) => {
          const type = Number(item.assetType);
          if ([2, 11, 12].includes(type)) return true;
          const name = (item.assetTypeName || "").toLowerCase();
          if (name.includes("shirt") || name.includes("pant")) return true;
          return item.category === "shirts" || item.category === "pants" || item.category === "tshirts";
        })
        .sort((a, b) => demandValue(b) - demandValue(a));
      setItems(ranked);
      setSelected(new Set(ranked.slice(0, Math.min(4, MAX_BATCH)).map((item) => item.id)));
      setUpdatedAt(new Date());
      if (!ranked.length) {
        setError("O catálogo não retornou roupas para esse filtro. Tente atualizar novamente.");
      }
    } catch (err) {
      setItems([]);
      setSelected(new Set());
      setError(err instanceof Error ? err.message : "Não foi possível consultar o catálogo ao vivo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUploads()
      .then((board) => {
        const available = board.groups.filter((group) => group.canPost !== false);
        setConnected(board.connected);
        setGroups(available);
        setGroupId(available[0]?.id ?? null);
      })
      .catch(() => {
        setConnected(false);
        setGroups([]);
      });
    void refreshTrends("both");
  }, []);

  function toggleItem(id: number) {
    if (running) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_BATCH) {
        next.add(id);
      }
      return next;
    });
  }

  function selectTop() {
    setSelected(new Set(items.slice(0, MAX_BATCH).map((item) => item.id)));
  }

  async function runMassUpload() {
    if (!connected) {
      setError("Conecte sua conta Roblox antes de iniciar o lote.");
      return;
    }
    if (!groupId) {
      setError("Escolha um grupo em que sua conta tenha permissão para publicar.");
      return;
    }
    if (!selectedItems.length) {
      setError("Selecione pelo menos uma peça em alta.");
      return;
    }

    setRunning(true);
    setError(null);

    for (const item of selectedItems.slice(0, MAX_BATCH)) {
      setBatch((current) => ({
        ...current,
        [item.id]: { state: "creating", message: "Copiando molde real..." },
      }));

      try {
        const kind = candidateKind(item);
        const result = await cloneAssetToGroup({
          assetId: item.id,
          name: item.name,
          kind,
          price,
          groupId,
          mode: antiBan ? "ai_remake" : "original",
        });

        if (!result.ok) {
          throw new Error(result.error || "Falha ao copiar molde da peça.");
        }

        setBatch((current) => ({
          ...current,
          [item.id]: {
            state: "queued",
            message: result.job?.name ? `Na fila: ${result.job.name}` : "Molde copiado com sucesso!",
          },
        }));
      } catch (err) {
        setBatch((current) => ({
          ...current,
          [item.id]: {
            state: "failed",
            message: err instanceof Error ? err.message : "Falha ao copiar esta peça.",
          },
        }));
      }
    }
    setRunning(false);
  }

  const queuedCount = Object.values(batch).filter((entry) => entry.state === "queued").length;
  const failedCount = Object.values(batch).filter((entry) => entry.state === "failed").length;

  return (
    <div className="h-full overflow-y-auto px-6 py-7 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] pb-16">
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                <Layers3 className="h-4 w-4" />
                Mass Upload
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Tendências reais, cópia em massa.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
                O scanner busca as roupas mais vendidas do catálogo, extrai os moldes 585x559 reais e publica diretamente no seu grupo com proteção Anti-Ban.
              </p>
            </div>

            <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[430px]">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Selecionadas</div>
                <div className="mt-1 text-xl font-semibold text-emerald-400">{selected.size}/{MAX_BATCH}</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Taxa estimada</div>
                <div className="mt-1 text-xl font-semibold text-white">{estimatedFee} R$</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Fonte</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ao vivo
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 w-full rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Mais vendidos desta semana
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Consultando catálogo Roblox"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filter}
                  disabled={running}
                  onChange={(event) => {
                    const value = event.target.value as CatalogFilter;
                    setFilter(value);
                    void refreshTrends(value);
                  }}
                  className="rounded-xl border border-white/[0.08] bg-[#121212] px-3 py-2 text-xs text-white/80 outline-none focus:border-emerald-500/50"
                >
                  {FILTERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                </select>
                <button
                  type="button"
                  disabled={loading || running}
                  onClick={() => void refreshTrends()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 text-xs font-medium text-white/80 transition disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
                <button
                  type="button"
                  disabled={running || !items.length}
                  onClick={selectTop}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-xs font-medium text-emerald-300 transition disabled:opacity-40"
                >
                  Selecionar top {Math.min(MAX_BATCH, items.length)}
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-5 flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 p-4"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "14px",
              }}
            >
              {loading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
                  ))
                : items.map((item, index) => {
                    const checked = selected.has(item.id);
                    const status = batch[item.id];
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`rounded-2xl bg-[#0a0a0a] p-3 flex flex-col justify-between gap-2.5 transition-all text-left w-full group relative overflow-hidden border cursor-pointer ${
                          checked
                            ? "border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                            : "border-white/[0.08] hover:border-white/[0.18]"
                        }`}
                      >
                        {/* Top Thumbnail with Type and Price Badges */}
                        <div className="relative aspect-square w-full rounded-xl bg-black/60 overflow-hidden flex items-center justify-center border border-white/[0.04]">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <Shirt className="w-10 h-10 text-white/20" />
                          )}

                          {/* Type Badge - Top Left */}
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-bold tracking-wider uppercase text-white/80 border border-white/10">
                            {item.assetTypeName}
                          </div>

                          {/* Price Badge - Top Right */}
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-950/80 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            {item.price != null ? `${item.price} R$` : "5 R$"}
                          </div>

                          {/* Ranking Badge - Bottom Left */}
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-bold text-white/60 border border-white/10">
                            #{index + 1}
                          </div>

                          {/* Selection Checkmark - Bottom Right */}
                          <div className={`absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                            checked
                              ? "border-emerald-400 bg-emerald-500 text-black shadow-sm scale-110"
                              : "border-white/20 bg-black/60 text-transparent group-hover:border-white/40"
                          }`}>
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        </div>

                        {/* Item Metadata */}
                        <div className="space-y-1">
                          <h4
                            className="text-xs font-semibold text-white/90 line-clamp-2 leading-tight group-hover:text-purple-300 transition-colors"
                            title={item.name}
                          >
                            {item.name}
                          </h4>

                          <div className="flex items-center justify-between text-[10px] text-white/40 pt-1">
                            <span className="truncate max-w-[100px] font-medium" title={item.creatorName}>
                              {item.creatorName}
                            </span>
                            <span className="text-amber-400/90 font-mono shrink-0">
                              ★ {formatFav(demandValue(item))}
                            </span>
                          </div>
                        </div>

                        {/* Selection / Action Button */}
                        <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-1 w-full">
                          <div
                            className={`p-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-[10px] font-bold shadow-sm ${
                              checked
                                ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/50"
                                : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-100 border border-emerald-500/30 hover:border-emerald-500/50"
                            }`}
                          >
                            {checked ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Selecionada</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-emerald-400" />
                                <span>Selecionar</span>
                              </>
                            )}
                          </div>

                          {status && (
                            <div className={`mt-1 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] ${
                              status.state === "queued"
                                ? "bg-emerald-400/10 border-emerald-500/30 text-emerald-300"
                                : status.state === "failed"
                                ? "bg-rose-400/10 border-rose-500/30 text-rose-300"
                                : "bg-blue-400/10 border-blue-500/30 text-blue-200"
                            }`}>
                              {statusIcon(status)}
                              <span className="line-clamp-1">{status.message}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
            </div>
          </div>

          <aside className="w-full lg:w-[340px] shrink-0 h-fit rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 space-y-4 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <UploadCloud className="h-4 w-4 text-emerald-400" />
              Configurar publicação
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/40">Grupo de destino</label>
              <select
                value={groupId ?? ""}
                disabled={running || !connected}
                onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
                className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#121212] px-3.5 py-3 text-sm text-white/80 outline-none focus:border-emerald-500/50 disabled:opacity-50"
              >
                <option value="">Selecione um grupo</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/40">Preço por peça</label>
              <div className="mt-2 flex items-center rounded-xl border border-white/[0.08] bg-[#121212] px-3.5">
                <input
                  type="number"
                  min={5}
                  max={999}
                  value={price}
                  disabled={running}
                  onChange={(event) => setPrice(Math.max(5, Math.floor(Number(event.target.value) || 5)))}
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none"
                />
                <span className="text-xs font-semibold text-emerald-400">Robux</span>
              </div>
            </div>

            <button
              type="button"
              disabled={running}
              onClick={() => setAntiBan((value) => !value)}
              className="flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05] p-3 text-left transition"
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${antiBan ? "border-emerald-400 bg-emerald-500 text-black" : "border-white/20 bg-black/40 text-transparent"}`}>
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Proteção Anti-Ban Ativa
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-white/40">
                  Aplica mutação microscópica e altera o hash do PNG para impedir detecção de duplicata pelo Roblox.
                </span>
              </span>
            </button>

            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-200">
                <ShieldCheck className="h-4 w-4" />
                Antes de publicar
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-white/40">
                Camisas e calças cobram 10 R$ de taxa de upload do Roblox. O molde é copiado e enviado diretamente para a fila do seu grupo.
              </p>
            </div>

            {!connected ? (
              <Link to="/painel/conta" className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-3.5 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
                Conectar conta Roblox <ExternalLink className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled={running || selected.size === 0 || !groupId}
                onClick={() => void runMassUpload()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-3.5 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}
                {running ? "Copiando lote..." : `Copiar e publicar ${selected.size} peça${selected.size === 1 ? "" : "s"} no grupo`}
              </button>
            )}

            {(queuedCount > 0 || failedCount > 0) && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-xs text-white/55">
                <div className="font-medium text-white/80">Lote processado</div>
                <div className="mt-2 flex gap-4">
                  <span className="text-emerald-300 font-semibold">{queuedCount} na fila</span>
                  {failedCount > 0 && <span className="text-rose-300 font-semibold">{failedCount} falharam</span>}
                </div>
                <Link to="/painel/upload" className="mt-2.5 inline-flex items-center gap-1 font-medium text-emerald-400 hover:text-emerald-300">
                  Acompanhar fila <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
