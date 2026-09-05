import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Download,
  LoaderCircle,
  Radar,
  Search,
  Building2,
  Sparkles,
  Clock,
  Layers,
  Heart,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  X,
  TrendingUp,
  Brain,
  Compass,
  Flame,
  Tag,
  Lightbulb,
  Users,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DotButton } from "../components/ui/DotButton";
import { ClusterCard } from "../components/ClusterCard";
import { ItemThumb } from "../components/ItemThumb";
import {
  exportHref,
  fetchFeed,
  lookupAsset,
  lookupGroupStore,
  startScan,
  generateAiMarketReport,
  searchLiveGroups,
  type AssetLook,
  type FeedQuery,
  type FeedResponse,
  type GroupStore,
  type ExecutiveReportResponse,
  type LiveGroupItem,
} from "../lib/api";
import { BADGE_LABEL, CATEGORY_LABEL, VERDICT_LABEL } from "../lib/labels";

const emptyQuery: FeedQuery = {
  q: "",
  verdict: "",
  category: "",
  badge: "",
  sort: "oportunidade",
  flagged: false,
  isolados: false,
  minSales: "",
  maxSales: "",
  minFavorites: "",
};

const SALES_MIN = [
  ["", "Vendas mín."],
  ["1", "1+ vendas"],
  ["10", "10+ vendas"],
  ["50", "50+ vendas"],
  ["100", "100+ vendas"],
  ["500", "500+ vendas"],
] as const;

const SALES_MAX = [
  ["", "Vendas máx."],
  ["10", "≤ 10 vendas"],
  ["50", "≤ 50 vendas"],
  ["100", "≤ 100 vendas"],
  ["500", "≤ 500 vendas"],
] as const;

const FAV_MIN = [
  ["", "Favoritos mín."],
  ["10", "10+ favs"],
  ["50", "50+ favs"],
  ["100", "100+ favs"],
  ["500", "500+ favs"],
] as const;

function formatWhen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function Feed() {
  const [query, setQuery] = useState<FeedQuery>(emptyQuery);
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<"clusters" | "groups" | "blueprints">("clusters");

  // Executive AI Report states
  const [reportData, setReportData] = useState<ExecutiveReportResponse | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  // Group Radar live search states
  const [groupSearchQuery, setGroupSearchQuery] = useState("clothing aesthetic");
  const [groupSearchResults, setGroupSearchResults] = useState<LiveGroupItem[]>([]);
  const [searchingGroups, setSearchingGroups] = useState(false);

  // Inspector tool states
  const [inspectorTab, setInspectorTab] = useState<"asset" | "group">("asset");
  const [showInspector, setShowInspector] = useState(false);
  const [idDraft, setIdDraft] = useState("");
  const [look, setLook] = useState<AssetLook | null>(null);
  const [lookError, setLookError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");
  const [groupStore, setGroupStore] = useState<GroupStore | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedBlueprintTags, setCopiedBlueprintTags] = useState<string | null>(null);

  const load = async (next = query) => {
    setError(null);
    try {
      setData(await fetchFeed(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    load();
    const poll = window.setInterval(() => load(query), 7000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft === (query.q || "")) return;
      const next = { ...query, q: draft };
      setQuery(next);
    }, 280);
    return () => window.clearTimeout(handle);
  }, [draft, query]);

  // Handle generating executive market report with AI
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await generateAiMarketReport();
      setReportData(res);
      setShowFullReport(true);
    } catch (err: any) {
      setError(err?.message || "Erro ao gerar relatório com IA.");
    } finally {
      setGeneratingReport(false);
    }
  };

  // Handle live groups search
  const handleSearchGroups = async (term: string) => {
    setSearchingGroups(true);
    try {
      const res = await searchLiveGroups(term, 12);
      setGroupSearchResults(res.groups || []);
    } catch {
      // ignore
    } finally {
      setSearchingGroups(false);
    }
  };

  useEffect(() => {
    if (activeTab === "groups" && groupSearchResults.length === 0) {
      handleSearchGroups(groupSearchQuery);
    }
  }, [activeTab]);

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      await startScan();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    const q = idDraft.trim();
    if (!q) return;
    setLooking(true);
    setLookError(null);
    try {
      setLook(await lookupAsset(q));
    } catch (err) {
      setLook(null);
      setLookError(err instanceof Error ? err.message : String(err));
    } finally {
      setLooking(false);
    }
  }

  async function lookupGroup(event?: FormEvent, targetGroup?: string) {
    if (event) event.preventDefault();
    const q = (targetGroup || groupDraft).trim();
    if (!q) return;
    setGroupBusy(true);
    setGroupError(null);
    try {
      setGroupStore(await lookupGroupStore(q));
      setShowInspector(true);
      setInspectorTab("group");
    } catch (err) {
      setGroupStore(null);
      setGroupError(err instanceof Error ? err.message : String(err));
    } finally {
      setGroupBusy(false);
    }
  }

  async function copyGroupLinks() {
    if (!groupStore?.items.length) return;
    const text = groupStore.items
      .map((item) => `${item.id}\t${item.assetType}\t${item.name}\t${item.storeUrl}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const copyReportText = async () => {
    if (!reportData?.report) return;
    await navigator.clipboard.writeText(reportData.report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const copyTags = async (tags: string[], id: string) => {
    await navigator.clipboard.writeText(tags.join(" "));
    setCopiedBlueprintTags(id);
    setTimeout(() => setCopiedBlueprintTags(null), 1800);
  };

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = { ...query, q: draft };
    setQuery(next);
    load(next);
  }

  function patch(partial: Partial<FeedQuery>) {
    const next = { ...query, ...partial };
    setQuery(next);
    load(next);
  }

  const clusters = data?.cycle?.clusters || [];
  const csv = useMemo(() => exportHref(query), [query]);
  const nextMs = data?.health.nextRunAt
    ? new Date(data.health.nextRunAt).getTime() - now
    : null;
  const nextLabel = data?.health.scanning
    ? "escaneando agora"
    : nextMs == null
    ? data?.settings.autoScan
      ? "a qualquer instante"
      : "pausado"
    : nextMs <= 0
    ? "a qualquer instante"
    : `${Math.floor(nextMs / 60000)}m ${Math.floor((nextMs % 60000) / 1000)
        .toString()
        .padStart(2, "0")}s`;

  const defaultBlueprints = [
    {
      id: "bp-1",
      name: "Y2K Grunge Zip Hoodie & Baggy Fit",
      category: "Classic Shirt (2D)",
      price: 5,
      margin: "3,5 R$ líquidos",
      strategy: "Alto volume de busca orgânica. Combine com calça flare preta no CAC.",
      tags: ["#y2k", "#grunge", "#streetwear", "#cyberpunk", "#robloxclothing", "#5robux"],
    },
    {
      id: "bp-2",
      name: "Coquette Vintage Lace Corset Duo",
      category: "Classic Pants / Top (2D)",
      price: 5,
      margin: "7,0 R$ no par",
      strategy: "Venda casada: top e saia com laço de veludo compram juntos.",
      tags: ["#coquette", "#lace", "#matching", "#duofit", "#aesthetic", "#cutecore"],
    },
    {
      id: "bp-3",
      name: "Spooky Vampire Goth Choker & Horns",
      category: "Face / Neck (UGC 3D)",
      price: 65,
      margin: "45,5 R$ líquidos",
      strategy: "Janela sazonal de Halloween. Alta margem por venda única.",
      tags: ["#ugc", "#spooky", "#vampire", "#goth", "#halloween", "#3daccessory"],
    },
    {
      id: "bp-4",
      name: "Aesthetic Bicolor Anime Spooky Hair",
      category: "Hair Accessory (UGC 3D)",
      price: 85,
      margin: "59,5 R$ líquidos",
      strategy: "Maior volume de buscas no marketplace 3D. Mechas preto e roxo bruxa.",
      tags: ["#ugchair", "#animehair", "#robloxhair", "#spookyhair", "#aesthetic", "#ugc"],
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6 pb-24 text-white select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* 1. Top Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Inteligência de Mercado &bull; UGC Reports</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Relatórios &amp; Tendências de Mercado
          </h1>
          <p className="text-xs text-white/40 mt-1 font-medium">
            Radar de inteligência com dados ao vivo do catálogo, análise de grupos concorrentes e blueprints gerados por IA.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <DotButton
            type="button"
            onClick={() => setShowInspector(!showInspector)}
            className={`px-4 py-2.5 rounded-full font-semibold text-xs gap-2 ${
              showInspector
                ? "bg-white text-black shadow-sm"
                : "bg-[#141414] hover:bg-[#1f1f1f] text-white/80"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{showInspector ? "Ocultar Inspetor" : "Inspecionar Peça/Grupo"}</span>
          </DotButton>

          <DotButton
            asAnchor
            href={csv}
            className="px-4 py-2.5 rounded-full font-semibold text-xs text-white/70 hover:text-white bg-[#141414] hover:bg-[#1f1f1f] gap-2 shadow-sm"
            title="Exportar CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </DotButton>

          <DotButton
            type="button"
            onClick={scan}
            disabled={scanning || data?.health.scanning}
            className="px-5 py-2.5 rounded-full font-semibold text-xs text-black bg-white hover:bg-white/90 gap-2 shadow-sm cursor-pointer"
            title="Escanear catálogo agora"
          >
            {scanning || data?.health.scanning ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin text-black" />
            ) : (
              <Radar className="w-3.5 h-3.5 text-black" />
            )}
            <span>{scanning || data?.health.scanning ? "Escaneando..." : "Escanear Agora"}</span>
          </DotButton>
        </div>
      </motion.div>

      {/* 2. Executive AI Market Intelligence Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-[24px] bg-gradient-to-b from-blue-950/20 via-[#0a0a0a] to-[#0a0a0a] border border-blue-500/20 p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.5)] space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Briefing Estratégico de Inteligência (IA)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  Tempo Real
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Diagnóstico preditivo de catálogo, oportunidades de 5 R$ vs 3D e timing de lançamento.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="px-5 py-2.5 rounded-full font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {generatingReport ? (
              <>
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span>Compilando Mercado...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>Gerar Relatório com IA</span>
              </>
            )}
          </button>
        </div>

        {/* 4 Key Intelligence Signals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-white/40 tracking-wider">Top Nicho</div>
              <div className="text-xs font-bold text-white truncate mt-0.5">
                {clusters[0]?.label || "Y2K / Aesthetic"}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-white/40 tracking-wider">Oceano Azul</div>
              <div className="text-xs font-bold text-white truncate mt-0.5">
                {clusters[1]?.label || "Coquette / Duo Fit"}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-white/40 tracking-wider">Preço Ideal</div>
              <div className="text-xs font-bold text-white truncate mt-0.5">5 R$ (2D) &bull; 65-85 R$ (3D)</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-white/40 tracking-wider">Volume Rastreado</div>
              <div className="text-xs font-bold text-white truncate mt-0.5">
                {data ? `${data.health.lastItemCount || data.cycle?.itemCount || 0} peças` : "Conectado"}
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Executive Report View */}
        <AnimatePresence>
          {showFullReport && reportData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-4 pt-4 border-t border-white/[0.08] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Gerado em: {new Date(reportData.generatedAt).toLocaleTimeString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyReportText}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{reportCopied ? "Copiado!" : "Copiar Relatório"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFullReport(false)}
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-colors cursor-pointer"
                    title="Recolher"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-black/60 border border-white/[0.08] text-xs leading-relaxed text-white/90 whitespace-pre-wrap font-sans space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-h-[460px] overflow-y-auto">
                {reportData.report}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 3. Tab Selector Buttons */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("clusters")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "clusters"
              ? "bg-white text-black shadow-sm"
              : "bg-[#141414] text-white/60 hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tendências &amp; Clusters ({clusters.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "groups"
              ? "bg-white text-black shadow-sm"
              : "bg-[#141414] text-white/60 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Radar de Grupos Concorrentes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blueprints")}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "blueprints"
              ? "bg-white text-black shadow-sm"
              : "bg-[#141414] text-white/60 hover:text-white"
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Blueprints de Drops (IA)</span>
        </button>
      </div>

      {/* 4. Quick Inspector Tool (Asset & Group Lookup) */}
      <AnimatePresence>
        {showInspector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-[24px] bg-[#0a0a0a] p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.45)] space-y-4 overflow-hidden border border-white/[0.08]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectorTab("asset")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    inspectorTab === "asset"
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#141414] text-white/60 hover:text-white"
                  }`}
                >
                  Inspecionar Roupa (ID ou Link)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("group")}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    inspectorTab === "group"
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#141414] text-white/60 hover:text-white"
                  }`}
                >
                  Buscar Roupas de Grupo
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowInspector(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectorTab === "asset" ? (
              <form onSubmit={lookup} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={idDraft}
                    onChange={(event) => setIdDraft(event.target.value)}
                    placeholder="Cole o ID da peça ou link create.roblox.com/store/asset/..."
                    className="w-full bg-[#121212] focus:bg-[#161616] text-white placeholder-white/30 text-xs rounded-full pl-11 pr-4 py-3 focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={looking}
                  className="px-6 py-3 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-sm"
                >
                  {looking ? "Consultando..." : "Inspecionar"}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => lookupGroup(e)} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Building2 className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={groupDraft}
                    onChange={(event) => setGroupDraft(event.target.value)}
                    placeholder="Cole o link ou ID do grupo (ex: roblox.com/groups/338505510)"
                    className="w-full bg-[#121212] focus:bg-[#161616] text-white placeholder-white/30 text-xs rounded-full pl-11 pr-4 py-3 focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={groupBusy}
                  className="px-6 py-3 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-sm"
                >
                  {groupBusy ? "Lendo grupo..." : "Buscar Roupas"}
                </button>
                {groupStore ? (
                  <button
                    type="button"
                    onClick={copyGroupLinks}
                    className="px-4 py-3 rounded-full text-xs font-semibold bg-[#1a1a1a] hover:bg-[#252525] text-white cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "IDs Copiados!" : "Copiar IDs"}</span>
                  </button>
                ) : null}
              </form>
            )}

            {/* Asset Lookup Result */}
            {lookError && <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl">{lookError}</p>}
            {look && (
              <div className="p-4 rounded-2xl bg-[#141414] flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#1a1a1a] shrink-0">
                  <ItemThumb url={look.thumbnailUrl} name={look.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase font-semibold">
                    <span>{look.assetType}</span>
                    <span>&bull;</span>
                    <span>ID: {look.id}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate mt-0.5">{look.name}</h4>
                  <p className="text-xs text-white/40 mt-0.5 font-medium">
                    {look.creatorName ? `${look.creatorName}` : "Criador público"}
                    {look.price != null ? ` &bull; ${look.price} R$` : ""}
                    {look.sales != null ? ` &bull; ${look.sales} vendas` : ""}
                    {look.favorites != null ? ` &bull; ${look.favorites} favs` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={look.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all flex items-center gap-1"
                  >
                    <span>Store</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={look.catalogUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all flex items-center gap-1"
                  >
                    <span>Catálogo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Group Store Lookup Result */}
            {groupError && <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl">{groupError}</p>}
            {groupStore && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    Grupo: <strong className="text-white">{groupStore.groupName}</strong> ({groupStore.itemCount} roupas públicas)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {groupStore.items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-[#141414] flex flex-col gap-2 group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-[#1a1a1a]">
                        <ItemThumb url={item.thumbnailUrl} name={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-white truncate">{item.name}</p>
                        <div className="flex items-center justify-between text-[10px] text-white/50 mt-0.5">
                          <span>{item.assetType}</span>
                          {item.sales != null && item.sales > 0 ? (
                            <span className="text-emerald-400 font-bold">{item.sales} vendas</span>
                          ) : item.favorites != null && item.favorites > 0 ? (
                            <span className="text-pink-400 font-medium flex items-center gap-0.5">
                              <Heart className="w-2.5 h-2.5 fill-pink-400/20" />
                              <span>{item.favorites >= 1000 ? `${(item.favorites / 1000).toFixed(1)}k` : item.favorites}</span>
                            </span>
                          ) : item.price != null ? (
                            <span className="text-amber-400 font-medium">{item.price} R$</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. TAB 1: CLUSTERS & NICHES */}
      {activeTab === "clusters" && (
        <div className="space-y-6">
          {/* Live Telemetry Bar */}
          <div className="rounded-[22px] bg-[#0a0a0a] p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex flex-wrap items-center justify-between gap-4 border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    data?.health.scanning ? "bg-blue-500" : "bg-emerald-400"
                  } opacity-75`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    data?.health.scanning ? "bg-blue-600" : "bg-emerald-500"
                  }`}
                />
              </span>

              <div className="text-xs">
                <span className="font-semibold text-white">
                  {data?.health.scanning
                    ? "Varredura do Catálogo em Andamento"
                    : data?.settings.autoScan
                    ? "Varredura Automática Ativa"
                    : "Varredura Pausada"}
                </span>
                <span className="text-white/40 ml-2 font-medium">
                  Próxima em: <strong className="text-white/80">{nextLabel}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <div className="px-3 py-1.5 rounded-full bg-[#141414] flex items-center gap-1.5 font-medium">
                <Layers className="w-3 h-3 text-white/40" />
                <span>{data ? `${data.health.lastItemCount || data.cycle?.itemCount || 0} itens` : "Aguardando dados"}</span>
              </div>

              {data?.demand ? (
                <div className="px-3 py-1.5 rounded-full bg-[#141414] flex items-center gap-1.5 font-medium">
                  <Heart className="w-3 h-3 text-pink-400" />
                  <span>{data.demand.favoritesTotal.toLocaleString("pt-BR")} favoritos</span>
                </div>
              ) : null}

              <div className="px-3 py-1.5 rounded-full bg-[#141414] flex items-center gap-1.5 font-medium text-white/40">
                <Clock className="w-3 h-3 text-white/30" />
                <span>Última: {formatWhen(data?.health.lastSuccessAt || null)}</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Controls */}
          <div className="rounded-[24px] bg-[#0a0a0a] p-5 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-4 border border-white/[0.06]">
            {/* Search Input */}
            <form onSubmit={applyFilters} className="relative flex items-center">
              <Search className="w-4 h-4 text-white/40 absolute left-4 pointer-events-none" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Buscar por nicho viral (ex: y2k, anime, gothic, cute, grunge, dark academia)..."
                className="w-full bg-[#121212] focus:bg-[#161616] text-white placeholder-white/30 text-xs rounded-full pl-11 pr-24 py-3 focus:outline-none transition-all"
                aria-label="Buscar temas virais"
              />
              {draft && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    patch({ q: "" });
                  }}
                  className="absolute right-20 text-white/40 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <DotButton
                type="submit"
                wrapperClassName="absolute right-1"
                className="px-4 py-1.5 rounded-full font-semibold text-xs text-black bg-white hover:bg-white/90 shadow-sm"
              >
                Buscar
              </DotButton>
            </form>

            {/* Dropdowns Row */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="relative inline-flex items-center">
                <select
                  value={query.minSales === "" || query.minSales == null ? "" : String(query.minSales)}
                  onChange={(event) =>
                    patch({ minSales: event.target.value === "" ? "" : Number(event.target.value) })
                  }
                  className="bg-[#141414] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-full px-3.5 py-2 pr-7 focus:outline-none cursor-pointer appearance-none transition-colors"
                >
                  {SALES_MIN.map(([val, label]) => (
                    <option key={val || "any"} value={val} className="bg-[#121212] text-white">
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 pointer-events-none" />
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={query.maxSales === "" || query.maxSales == null ? "" : String(query.maxSales)}
                  onChange={(event) =>
                    patch({ maxSales: event.target.value === "" ? "" : Number(event.target.value) })
                  }
                  className="bg-[#141414] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-full px-3.5 py-2 pr-7 focus:outline-none cursor-pointer appearance-none transition-colors"
                >
                  {SALES_MAX.map(([val, label]) => (
                    <option key={val || "any"} value={val} className="bg-[#121212] text-white">
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 pointer-events-none" />
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={query.minFavorites === "" || query.minFavorites == null ? "" : String(query.minFavorites)}
                  onChange={(event) =>
                    patch({ minFavorites: event.target.value === "" ? "" : Number(event.target.value) })
                  }
                  className="bg-[#141414] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-full px-3.5 py-2 pr-7 focus:outline-none cursor-pointer appearance-none transition-colors"
                >
                  {FAV_MIN.map(([val, label]) => (
                    <option key={val || "any-fav"} value={val} className="bg-[#121212] text-white">
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 pointer-events-none" />
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={query.verdict}
                  onChange={(event) => patch({ verdict: event.target.value })}
                  className="bg-[#141414] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-full px-3.5 py-2 pr-7 focus:outline-none cursor-pointer appearance-none transition-colors"
                >
                  <option value="" className="bg-[#121212] text-white">Todos os vereditos</option>
                  {Object.entries(VERDICT_LABEL).map(([key, label]) => (
                    <option key={key} value={key} className="bg-[#121212] text-white">
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 pointer-events-none" />
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={query.category}
                  onChange={(event) => patch({ category: event.target.value })}
                  className="bg-[#141414] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-full px-3.5 py-2 pr-7 focus:outline-none cursor-pointer appearance-none transition-colors"
                >
                  <option value="" className="bg-[#121212] text-white">Todas as categorias</option>
                  {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <option key={key} value={key} className="bg-[#121212] text-white">
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 pointer-events-none" />
              </div>

              <div className="relative inline-flex items-center">
                <select
                  value={query.sort}
                  onChange={(event) => patch({ sort: event.target.value })}
                  className="bg-[#141414] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-full px-3.5 py-2 pr-7 focus:outline-none cursor-pointer appearance-none transition-colors"
                >
                  <option value="oportunidade" className="bg-[#121212] text-white">Ordenar: Oportunidade</option>
                  <option value="tamanho" className="bg-[#121212] text-white">Ordenar: Tamanho</option>
                  <option value="velocidade" className="bg-[#121212] text-white">Ordenar: Velocidade</option>
                  <option value="aceleracao" className="bg-[#121212] text-white">Ordenar: Aceleração</option>
                  <option value="pureza" className="bg-[#121212] text-white">Ordenar: Pureza</option>
                  <option value="criadores" className="bg-[#121212] text-white">Ordenar: Criadores</option>
                  <option value="vendas" className="bg-[#121212] text-white">Ordenar: Vendas</option>
                </select>
                <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() => patch({ flagged: !query.flagged })}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  query.flagged
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-[#141414] hover:bg-[#1c1c1c] text-white/60 hover:text-white"
                }`}
              >
                Apenas Alertas
              </button>
            </div>

            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-white/40 font-medium mr-1">Sinais:</span>
              <button
                type="button"
                onClick={() => {
                  const isHalloween = (draft || "").toLowerCase() === "halloween";
                  setDraft(isHalloween ? "" : "halloween");
                  patch({ q: isHalloween ? "" : "halloween" });
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  (draft || "").toLowerCase() === "halloween"
                    ? "bg-orange-500 text-black font-bold shadow-sm"
                    : "bg-orange-500/15 hover:bg-orange-500/25 text-orange-400"
                }`}
              >
                <span>🎃 Radar Halloween 2026</span>
              </button>

              {Object.entries(BADGE_LABEL).map(([key, label]) => {
                const active = query.badge === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patch({ badge: active ? "" : key })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? "bg-white text-black shadow-sm font-semibold"
                        : "bg-[#161616] hover:bg-[#202020] text-white/60 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clusters Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {clusters.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB 2: LIVE GROUPS RADAR */}
      {activeTab === "groups" && (
        <div className="space-y-5">
          <div className="rounded-[24px] bg-[#0a0a0a] p-5 sm:p-6 border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">Radar de Grupos Concorrentes &amp; Referência</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Pesquise e espione grupos de roupas e marcas UGC no Roblox ao vivo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {["clothing aesthetic", "y2k clothing", "goth", "streetwear", "ugc accessories"].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setGroupSearchQuery(term);
                      handleSearchGroups(term);
                    }}
                    className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchGroups(groupSearchQuery);
              }}
              className="flex gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Pesquise por nome ou nicho de grupo (ex: aesthetic, y2k, goth, drain)..."
                  className="w-full bg-[#121212] focus:bg-[#161616] text-white placeholder-white/30 text-xs rounded-full pl-11 pr-4 py-3 focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={searchingGroups}
                className="px-6 py-3 rounded-full text-xs font-bold bg-white text-black hover:bg-white/90 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-sm"
              >
                {searchingGroups ? "Buscando..." : "Pesquisar"}
              </button>
            </form>
          </div>

          {/* Group Results Grid */}
          {groupSearchResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-white/40 rounded-2xl bg-[#0a0a0a] border border-white/[0.06]">
              {searchingGroups ? "Consultando grupos ao vivo no Roblox..." : "Nenhum grupo encontrado com este termo."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupSearchResults.map((grp) => (
                <div
                  key={grp.id}
                  className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] hover:border-blue-500/30 transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                          {grp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                            {grp.name}
                          </h4>
                          <span className="text-[10px] text-white/40 font-mono">ID: {grp.id}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-[10px] font-semibold text-emerald-400 shrink-0">
                        {grp.memberCount.toLocaleString("pt-BR")} membros
                      </span>
                    </div>

                    <p className="text-[11px] text-white/50 line-clamp-3 leading-relaxed">
                      {grp.description || "Grupo sem descrição pública."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => lookupGroup(undefined, String(grp.id))}
                      className="flex-1 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-all cursor-pointer text-center"
                    >
                      Inspecionar Catálogo
                    </button>
                    <a
                      href={`https://www.roblox.com/groups/${grp.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors cursor-pointer"
                      title="Abrir no Roblox"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 3: BLUEPRINTS DE DROPS (IA) */}
      {activeTab === "blueprints" && (
        <div className="space-y-5">
          <div className="rounded-[24px] bg-[#0a0a0a] p-5 sm:p-6 border border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Blueprints de Criação Imediata (Próximas 48h)</h3>
              <p className="text-xs text-white/40 mt-0.5">
                Peças calculadas para maximizar algoritmo, CTR e margem líquida em Robux.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Recomendado pela IA
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {defaultBlueprints.map((bp) => (
              <div
                key={bp.id}
                className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {bp.category}
                    </span>
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      {bp.price} Robux &bull; <span className="text-white/40 font-normal">{bp.margin}</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white">{bp.name}</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{bp.strategy}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bp.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-white/[0.035] text-[10px] text-white/50 border border-white/[0.06]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Pronto para upload</span>
                  <button
                    type="button"
                    onClick={() => copyTags(bp.tags, bp.id)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedBlueprintTags === bp.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Tags Copiadas!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar Tags SEO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
