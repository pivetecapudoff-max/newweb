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
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  createUgcWithAi,
  fetchUploads,
  queueUpload,
  scanMarketCatalog,
  type ClothingKind,
  type ScannedMarketItem,
  type UploadGroup,
} from "../lib/api";
import { renderRobloxTemplate, type UgcDesignSpec } from "../lib/ugcTemplate";

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
  if (item.assetType === 12 || item.assetTypeName.toLowerCase().includes("pant")) return "pants";
  if (item.assetType === 2 || item.assetTypeName.toLowerCase().includes("t-shirt")) return "tshirt";
  return "shirt";
}

function demandValue(item: ScannedMarketItem): number {
  return item.saleCount != null ? item.saleCount : item.favoriteCount;
}

function demandLabel(item: ScannedMarketItem): string {
  return item.saleCount != null ? "vendas públicas" : "favoritos";
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
  const [confirmedOriginal, setConfirmedOriginal] = useState(false);
  const [batch, setBatch] = useState<Record<number, BatchState>>({});

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected]
  );

  const estimatedFee = useMemo(
    () => selectedItems.reduce((sum, item) => sum + (candidateKind(item) === "tshirt" ? 0 : 80), 0),
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
        .filter((item) => [2, 11, 12].includes(Number(item.assetType)))
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
    if (!confirmedOriginal) {
      setError("Confirme que o lote será usado apenas para designs originais.");
      return;
    }
    if (!selectedItems.length) {
      setError("Selecione pelo menos uma tendência.");
      return;
    }

    setRunning(true);
    setError(null);
    const group = groups.find((entry) => entry.id === groupId);

    for (const item of selectedItems.slice(0, MAX_BATCH)) {
      setBatch((current) => ({
        ...current,
        [item.id]: { state: "creating", message: "Criando uma variação original..." },
      }));

      try {
        const kind = candidateKind(item);
        const result = await createUgcWithAi({
          prompt: [
            `Crie uma roupa Roblox 2D ORIGINAL do tipo ${kind}.`,
            `Use somente como sinal de tendência o tema do item \"${item.name}\" (${formatNumber(demandValue(item))} ${demandLabel(item)}).`,
            "Não copie arte, logotipo, personagem, texto, marca, molde ou nome do item de referência.",
            "Crie composição, paleta, estampa, título e descrição inéditos, comerciais e adequados às regras do Roblox.",
          ].join(" "),
          effort: "Detalhada",
          groupId,
          groupName: group?.name,
          stylePreset: "market_original",
        });

        const design = result.design;
        const spec: UgcDesignSpec = {
          title: design.title,
          kind,
          shirtStyle: design.shirtStyle,
          price,
          description: design.description,
          tags: [design.theme, ...design.details],
          theme: design.theme,
          graphicTheme: design.graphicTheme,
          graphicText: design.graphicText,
          primaryColor: design.primaryColor,
          secondaryColor: design.secondaryColor,
          accentColor: design.accentColor,
          pattern: design.pattern,
          details: design.details,
        };
        const image = await renderRobloxTemplate(spec);
        const job = await queueUpload({
          name: design.title,
          description: design.description,
          kind,
          price,
          groupId,
          fileName: `${design.title.replace(/[^a-zA-Z0-9]/g, "_")}_original.png`,
          image,
        });
        setBatch((current) => ({
          ...current,
          [item.id]: { state: "queued", message: `Na fila: ${job.name}` },
        }));
      } catch (err) {
        setBatch((current) => ({
          ...current,
          [item.id]: {
            state: "failed",
            message: err instanceof Error ? err.message : "Falha ao criar esta peça.",
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
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-black/20 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-300/80">
                <Layers3 className="h-4 w-4" />
                Mass Upload
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Tendência real, coleção original.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
                O scanner encontra roupas em alta no catálogo, a IA cria variações inéditas e a fila publica o lote no seu grupo.
              </p>
            </div>

            <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[430px]">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/35">Selecionadas</div>
                <div className="mt-1 text-xl font-semibold text-white">{selected.size}/{MAX_BATCH}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/35">Taxa estimada</div>
                <div className="mt-1 text-xl font-semibold text-white">{estimatedFee} R$</div>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-white/35">Fonte</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ao vivo
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-[24px] border border-white/[0.08] bg-black/20 backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Mais vendidos desta semana
                </div>
                <p className="mt-1 text-xs text-white/35">
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
                  className="rounded-xl border border-white/[0.08] bg-[#0b0b10] px-3 py-2 text-xs text-white/75 outline-none focus:border-blue-400/40"
                >
                  {FILTERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                </select>
                <button
                  type="button"
                  disabled={loading || running}
                  onClick={() => void refreshTrends()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.09] disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
                <button
                  type="button"
                  disabled={running || !items.length}
                  onClick={selectTop}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-400/10 disabled:opacity-40"
                >
                  Selecionar top {Math.min(MAX_BATCH, items.length)}
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-5 flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-3">
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-80 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]" />
                  ))
                : items.map((item, index) => {
                    const checked = selected.has(item.id);
                    const status = batch[item.id];
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`group overflow-hidden rounded-2xl border text-left transition ${
                          checked
                            ? "border-blue-400/45 bg-blue-500/[0.08] shadow-[0_0_0_1px_rgba(96,165,250,0.08)]"
                            : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.045]"
                        }`}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-[1.03]" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-white/20"><Layers3 className="h-8 w-8" /></div>
                          )}
                          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/70 backdrop-blur-md">
                            #{index + 1} em alta
                          </div>
                          <div className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md ${checked ? "border-blue-300/60 bg-blue-500 text-white" : "border-white/15 bg-black/40 text-transparent"}`}>
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="line-clamp-1 text-sm font-semibold text-white/90">{item.name}</div>
                          <div className="mt-1 line-clamp-1 text-xs text-white/35">por {item.creatorName}</div>
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold text-emerald-300">{formatNumber(demandValue(item))}</div>
                              <div className="text-[10px] uppercase tracking-wider text-white/30">{demandLabel(item)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-white/60">{item.assetTypeName}</div>
                              <div className="mt-0.5 text-[10px] text-white/30">{item.price ?? 0} R$ no catálogo</div>
                            </div>
                          </div>
                          {status && (
                            <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] ${status.state === "queued" ? "bg-emerald-400/10 text-emerald-300" : status.state === "failed" ? "bg-rose-400/10 text-rose-300" : "bg-blue-400/10 text-blue-200"}`}>
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

          <aside className="h-fit rounded-[24px] border border-white/[0.08] bg-black/25 p-5 backdrop-blur-xl xl:sticky xl:top-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <UploadCloud className="h-4 w-4 text-blue-400" />
              Configurar publicação
            </div>

            <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-white/35">Grupo de destino</label>
            <select
              value={groupId ?? ""}
              disabled={running || !connected}
              onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
              className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0b0b10] px-3 py-3 text-sm text-white/80 outline-none focus:border-blue-400/40 disabled:opacity-50"
            >
              <option value="">Selecione um grupo</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>

            <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-white/35">Preço por peça</label>
            <div className="mt-2 flex items-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-3">
              <input
                type="number"
                min={5}
                max={999}
                value={price}
                disabled={running}
                onChange={(event) => setPrice(Math.max(5, Math.floor(Number(event.target.value) || 5)))}
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none"
              />
              <span className="text-xs font-medium text-white/35">Robux</span>
            </div>

            <button
              type="button"
              disabled={running}
              onClick={() => setConfirmedOriginal((value) => !value)}
              className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-left"
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${confirmedOriginal ? "border-emerald-300/60 bg-emerald-400 text-black" : "border-white/20 bg-black/20 text-transparent"}`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="block text-xs font-medium text-white/75">Somente designs originais</span>
                <span className="mt-1 block text-[11px] leading-4 text-white/35">As peças em alta servem como sinal de demanda; a arte gerada não copia o item de outro criador.</span>
              </span>
            </button>

            <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-200">
                <ShieldCheck className="h-4 w-4" />
                Antes de publicar
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/40">
                Camisas e calças podem cobrar 80 R$ de taxa por upload. O Roblox ainda pode moderar cada arquivo.
              </p>
            </div>

            {!connected ? (
              <Link to="/painel/conta" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                Conectar conta Roblox <ExternalLink className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled={running || selected.size === 0 || !groupId || !confirmedOriginal}
                onClick={() => void runMassUpload()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {running ? "Criando lote..." : `Criar e publicar ${selected.size} peça${selected.size === 1 ? "" : "s"}`}
              </button>
            )}

            {(queuedCount > 0 || failedCount > 0) && (
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-xs text-white/55">
                <div className="font-medium text-white/80">Lote processado</div>
                <div className="mt-2 flex gap-4">
                  <span className="text-emerald-300">{queuedCount} na fila</span>
                  {failedCount > 0 && <span className="text-rose-300">{failedCount} falharam</span>}
                </div>
                <Link to="/painel/upload" className="mt-3 inline-flex items-center gap-1 font-medium text-blue-300 hover:text-blue-200">
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
