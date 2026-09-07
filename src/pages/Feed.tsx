import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Wand2,
  CheckCircle2,
  SlidersHorizontal,
  Shirt,
  Sparkle,
  ShoppingBag,
  Eye,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toastManager } from "../components/ui/toast";
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
  scanMarketCatalog,
  fetchUploads,
  cloneAssetToGroup,
  type AssetLook,
  type FeedQuery,
  type FeedResponse,
  type GroupStore,
  type ExecutiveReportResponse,
  type LiveGroupItem,
  type MarketScanParams,
  type MarketScanResult,
  type ScannedMarketItem,
  type UploadGroup,
  type UploadJob,
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
  const navigate = useNavigate();

  // Market Scanner specific states (Matching uploaded UI screenshot)
  const [scanStrategy, setScanStrategy] = useState<"bestselling" | "favorited" | "recent" | "sales" | "price_asc">("bestselling");
  const [timePeriod, setTimePeriod] = useState<"all" | "day" | "week" | "month">("all");
  const [keywords, setKeywords] = useState("y2k");
  const [groupId, setGroupId] = useState("");
  const [scanMode, setScanMode] = useState<"fixed" | "rotation">("fixed");
  const [totalItems, setTotalItems] = useState(10);
  const [rotationKeywords, setRotationKeywords] = useState("y2k, grunge, anime, streetwear, gothic, cyber");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  const [assetType, setAssetType] = useState<"both" | "shirts" | "pants" | "tshirts" | "ugc">("both");
  const [shirtPantsRatio, setShirtPantsRatio] = useState(50);
  const [isScanningMarket, setIsScanningMarket] = useState(false);
  const [marketScanResult, setMarketScanResult] = useState<MarketScanResult | null>(null);
  const [marketScanError, setMarketScanError] = useState<string | null>(null);

  // Group Select Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [userGroups, setUserGroups] = useState<UploadGroup[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState<LiveGroupItem[]>([]);
  const [modalSearching, setModalSearching] = useState(false);

  // Copied item toast
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  // Clone & Post to Group Modal states
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneModalItem, setCloneModalItem] = useState<ScannedMarketItem | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [clonePrice, setClonePrice] = useState(5);
  const [cloneGroupId, setCloneGroupId] = useState<string>("");
  const [customGroupIdInput, setCustomGroupIdInput] = useState("");
  const [cloneMethod, setCloneMethod] = useState<"original" | "ai_remake">("original");
  const [isCloning, setIsCloning] = useState(false);
  const [cloneSuccessJob, setCloneSuccessJob] = useState<UploadJob | null>(null);
  const [cloneDownloadedUrl, setCloneDownloadedUrl] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccessMessage, setCloneSuccessMessage] = useState<string | null>(null);

  // View switch: "scanner" (primary) vs other analytical tabs
  const [scannerView, setScannerView] = useState<"results" | "clusters" | "groups" | "blueprints">("results");

  // Legacy Feed Query & Engine states
  const [query, setQuery] = useState<FeedQuery>(emptyQuery);
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(Date.now());

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

  // Load user account to populate connected groups
  useEffect(() => {
    fetchUploads()
      .then((board) => setUserGroups(board.groups || []))
      .catch(() => {});
  }, []);

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

  // Execute Market Scan
  const handleMarketScan = async () => {
    setIsScanningMarket(true);
    setMarketScanError(null);
    try {
      const rotKeywords = rotationKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const params: MarketScanParams = {
        strategy: scanStrategy,
        timePeriod,
        keywords: keywords.trim(),
        groupId: groupId.trim() || undefined,
        scanMode,
        limit: totalItems,
        assetType,
        shirtPantsRatio,
        rotationKeywords: rotKeywords,
      };

      const result = await scanMarketCatalog(params);
      setMarketScanResult(result);
      setScannerView("results");
    } catch (err: any) {
      setMarketScanError(err?.message || "Falha ao escanear catálogo.");
    } finally {
      setIsScanningMarket(false);
    }
  };

  // Perform initial scan on component mount
  useEffect(() => {
    handleMarketScan();
  }, []);

  // Search live groups for modal
  const handleModalSearchGroups = async (term: string) => {
    if (!term.trim()) return;
    setModalSearching(true);
    try {
      const res = await searchLiveGroups(term, 10);
      setModalSearchResults(res.groups || []);
    } catch {
      // ignore
    } finally {
      setModalSearching(false);
    }
  };

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
    if (scannerView === "groups" && groupSearchResults.length === 0) {
      handleSearchGroups(groupSearchQuery);
    }
  }, [scannerView]);

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

  async function copyItemId(id: number) {
    await navigator.clipboard.writeText(String(id));
    setCopiedItemId(id);
    toastManager.success("ID Copiado!", `Asset ID #${id} copiado para a área de transferência.`);
    window.setTimeout(() => setCopiedItemId(null), 1500);
  }

  // Open Clone & Post to Group Modal
  const handleOpenCloneModal = (item: ScannedMarketItem) => {
    setCloneModalItem(item);
    setCloneName(item.name);
    setClonePrice(item.price === 5 || item.price <= 10 ? 5 : item.price);
    const defaultGroup = groupId || (userGroups.length > 0 ? String(userGroups[0].id) : "");
    setCloneGroupId(defaultGroup);
    setCustomGroupIdInput(defaultGroup && !userGroups.some((g) => String(g.id) === defaultGroup) ? defaultGroup : "");
    setCloneMethod("original");
    setIsCloning(false);
    setCloneSuccessJob(null);
    setCloneDownloadedUrl(null);
    setCloneError(null);
    setCloneSuccessMessage(null);
    setShowCloneModal(true);
  };

  // Execute Clone & Post to Group
  const handleExecuteClone = async () => {
    if (!cloneModalItem) return;
    setIsCloning(true);
    setCloneError(null);
    setCloneSuccessMessage(null);

    const targetGroupId = cloneGroupId === "custom" ? customGroupIdInput.trim() : cloneGroupId.trim();

    try {
      const res = await cloneAssetToGroup({
        assetId: cloneModalItem.id,
        name: cloneName.trim() || cloneModalItem.name,
        kind: cloneModalItem.assetType === 12 || String(cloneModalItem.assetTypeName || "").toLowerCase().includes("pant")
          ? "pants"
          : cloneModalItem.assetType === 2 || String(cloneModalItem.assetTypeName || "").toLowerCase().includes("t-shirt")
          ? "tshirt"
          : "shirt",
        price: clonePrice,
        groupId: targetGroupId ? Number(targetGroupId) : null,
        mode: cloneMethod,
      });

      if (!res.ok) {
        throw new Error(res.error || "Falha ao copiar item para o grupo.");
      }

      setCloneSuccessJob(res.job || null);
      if (res.templateDataUrl) {
        setCloneDownloadedUrl(res.templateDataUrl);
      }
      const successMsg = res.message || "Peça copiada e enviada para a fila de publicação do grupo!";
      setCloneSuccessMessage(successMsg);
      toastManager.success("Roupa Copiada com Sucesso!", `Peça "${cloneName.trim() || cloneModalItem.name}" enviada para o grupo.`);
    } catch (err: any) {
      const errorMsg = err?.message || "Erro ao processar cópia.";
      setCloneError(errorMsg);
      toastManager.error("Falha ao Copiar Roupa", errorMsg);
    } finally {
      setIsCloning(false);
    }
  };

  // Download Extracted Template
  const handleDownloadExtractedTemplate = () => {
    if (!cloneDownloadedUrl || !cloneModalItem) return;
    const a = document.createElement("a");
    a.href = cloneDownloadedUrl;
    a.download = `${(cloneName || cloneModalItem.name).replace(/[^a-zA-Z0-9]/g, "_")}_template.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toastManager.success("Download Concluído", "Molde PNG salvo com sucesso.");
  };

  const clusters = data?.cycle?.clusters || [];
  const csv = useMemo(() => exportHref(query), [query]);

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
    <div className="h-full overflow-y-auto p-5 sm:p-7 md:p-8 space-y-6 pb-24 text-white select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* 1. Header Bar with Serif Italic Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-wide text-white/95">
            Market Scanner
          </h1>
          <p className="text-xs text-white/40 mt-1 font-medium">
            Roblox Catalog Deep Intelligence &bull; Filtre concorrentes, descubra peças vencedoras e copie padrões de alta demanda.
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
        </div>
      </motion.div>

      {/* 2. Authentic Market Scanner Control Panel (Matching User Uploaded UI) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-2xl bg-[#0a0a0a] border border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-2xl relative"
      >
        {/* Header Bar: Title, Live Status, Big Action Scan Button & Collapse/Expand Arrow */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
          <div
            onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title={isConfigCollapsed ? "Clique para expandir configurações" : "Clique para minimizar configurações"}
          >
            <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/70 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide group-hover:text-emerald-300 transition-colors">
                  Filtros &amp; Configurações do Scanner
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                  Live Engine
                </span>
              </div>
              <p className="text-[11px] text-white/40">
                {isConfigCollapsed
                  ? "Configurações minimizadas — clique para expandir ou use o botão ao lado"
                  : "Ajuste a estratégia, período, nichos e palavras-chave de busca"}
              </p>
            </div>
          </div>

          {/* Quick Action & Collapse Toggle Controls */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Super prominent, high-contrast SCAN BUTTON (Always visible at top!) */}
            <button
              type="button"
              onClick={handleMarketScan}
              disabled={isScanningMarket}
              className="relative group px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(52,211,153,0.4)] hover:shadow-[0_0_35px_rgba(52,211,153,0.7)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shrink-0"
              title="Iniciar varredura do catálogo do Roblox"
            >
              {isScanningMarket ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin text-black" />
                  <span className="font-extrabold">ESCANEANDO...</span>
                </>
              ) : (
                <>
                  <Radar className="w-4 h-4 text-black animate-pulse" />
                  <span className="font-extrabold">INICIAR SCANNER</span>
                </>
              )}
            </button>

            {/* Minimize / Expand Arrow Button */}
            <button
              type="button"
              onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
              className="px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/80 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
              title={isConfigCollapsed ? "Expandir configurações" : "Minimizar configurações"}
            >
              <span className="hidden sm:inline text-[11px] text-white/60">
                {isConfigCollapsed ? "Expandir" : "Minimizar"}
              </span>
              {isConfigCollapsed ? (
                <ChevronDown className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-white/70" />
              )}
            </button>
          </div>
        </div>

        {/* Compact summary pill when collapsed */}
        {isConfigCollapsed && (
          <div
            onClick={() => setIsConfigCollapsed(false)}
            className="flex flex-wrap items-center gap-2 pt-1 pb-1 text-xs cursor-pointer hover:opacity-90 transition-opacity"
            title="Clique para abrir e editar as configurações completas"
          >
            <span className="text-[11px] text-white/40 font-mono">Filtros ativos:</span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 font-medium">
              Estratégia: <strong className="text-white capitalize">{scanStrategy}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 font-medium">
              Período: <strong className="text-white capitalize">{timePeriod}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 font-medium">
              Nicho: <strong className="text-emerald-300">"{keywords}"</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 font-medium">
              Modo: <strong className="text-white">{scanMode === "fixed" ? `${totalItems} itens` : "Rotação"}</strong>
            </span>
            {groupId && (
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium font-mono">
                Grupo: {groupId}
              </span>
            )}
            <span className="text-[11px] text-emerald-400 font-semibold underline ml-1">
              (Clique para abrir)
            </span>
          </div>
        )}

        {/* Collapsible Full Settings Area */}
        <AnimatePresence>
          {!isConfigCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-5 overflow-hidden"
            >
              {/* Row 1: Scan Strategy & Time Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                    SCAN STRATEGY
                  </label>
                  <select
                    value={scanStrategy}
                    onChange={(e) => setScanStrategy(e.target.value as any)}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer"
                  >
                    <option value="bestselling">Bestselling (Trending)</option>
                    <option value="favorited">Most Favorited</option>
                    <option value="recent">Recently Updated / New Releases</option>
                    <option value="sales">High Velocity (Sales Spike)</option>
                    <option value="price_asc">Price Ascending / 5 Robux Gems</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                    TIME PERIOD
                  </label>
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value as any)}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer"
                  >
                    <option value="all">All Time</option>
                    <option value="day">Past Day</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Keywords */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    KEYWORDS
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                    {["y2k", "grunge", "streetwear", "cyber", "baggy", "gothic", "anime"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setKeywords(tag)}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                          keywords.toLowerCase() === tag
                            ? "bg-white text-black font-bold"
                            : "bg-white/[0.04] text-white/50 hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. y2k, vintage, techwear, anime hoodie..."
                  className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all"
                />
              </div>

              {/* Row 3: Group ID & Select Group Button */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                  GROUP ID
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    placeholder="Digite o ID do grupo (ex: 12556581) ou deixe vazio para escanear todo o catálogo"
                    className="flex-1 bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(true)}
                    className="px-4 py-3 bg-[#181818] hover:bg-[#222222] border border-white/[0.1] rounded-xl text-xs font-semibold text-white/80 hover:text-white flex items-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95"
                  >
                    <Users className="w-4 h-4 text-white/60" />
                    <span>SELECT GROUP</span>
                  </button>
                </div>
              </div>

              {/* Row 4: Scan Mode Tabs */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                  SCAN MODE
                </label>
                <div className="grid grid-cols-2 border-b border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setScanMode("fixed")}
                    className={`py-3 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
                      scanMode === "fixed" ? "text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    FIXED AMOUNT
                    {scanMode === "fixed" && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e07a5f]" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode("rotation")}
                    className={`py-3 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
                      scanMode === "rotation" ? "text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    KEYWORD ROTATION
                    {scanMode === "rotation" && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e07a5f]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Row 5: Total Items or Rotation Input */}
              {scanMode === "fixed" ? (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                    TOTAL ITEMS TO FETCH
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={totalItems}
                    onChange={(e) => setTotalItems(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                    KEYWORDS TO ROTATE (SEPARATED BY COMMA)
                  </label>
                  <input
                    type="text"
                    value={rotationKeywords}
                    onChange={(e) => setRotationKeywords(e.target.value)}
                    placeholder="e.g. y2k, cyber, goth, grunge, anime, streetwear"
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-mono"
                  />
                </div>
              )}

              {/* Row 6: Advanced Options (Collapsible) */}
              <div className="border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <span>{showAdvanced ? "▲" : "▼"}</span>
                  <span>ADVANCED OPTIONS</span>
                </button>

                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 space-y-4 pt-2"
                  >
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                        ASSET TYPE
                      </label>
                      <select
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value as any)}
                        className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer"
                      >
                        <option value="both">Shirts + Pants</option>
                        <option value="shirts">Shirts Only</option>
                        <option value="pants">Pants Only</option>
                        <option value="tshirts">T-Shirts</option>
                        <option value="ugc">UGC 3D Accessories</option>
                      </select>
                    </div>

                    {assetType === "both" && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                            SHIRT / PANTS RATIO
                          </label>
                          <span className="text-xs font-mono text-white/60">
                            {shirtPantsRatio}% Shirts / {100 - shirtPantsRatio}% Pants
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={shirtPantsRatio}
                          onChange={(e) => setShirtPantsRatio(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-[#e07a5f]"
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Row 7: Big Glowing Bottom START SCAN Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleMarketScan}
                  disabled={isScanningMarket}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-sm tracking-widest uppercase shadow-[0_0_30px_rgba(52,211,153,0.35)] hover:shadow-[0_0_45px_rgba(52,211,153,0.6)] transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
                >
                  {isScanningMarket ? (
                    <>
                      <LoaderCircle className="w-5 h-5 animate-spin text-black" />
                      <span className="tracking-wider">ESCANEANDO CATÁLOGO DO ROBLOX...</span>
                    </>
                  ) : (
                    <>
                      <Radar className="w-5 h-5 text-black animate-pulse" />
                      <span className="tracking-wider">INICIAR SCANNER DE MERCADO</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {marketScanError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {marketScanError}
          </div>
        )}
      </motion.div>

      {/* 3. Navigation View Switcher (Results vs Market Analysis) */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 pt-2">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setScannerView("results")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              scannerView === "results"
                ? "bg-white text-black shadow-md"
                : "bg-white/[0.04] text-white/50 hover:text-white"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Itens Escaneados ({marketScanResult?.total || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setScannerView("clusters")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              scannerView === "clusters"
                ? "bg-white text-black shadow-md"
                : "bg-white/[0.04] text-white/50 hover:text-white"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Clusters &amp; Oportunidades</span>
          </button>

          <button
            type="button"
            onClick={() => setScannerView("groups")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              scannerView === "groups"
                ? "bg-white text-black shadow-md"
                : "bg-white/[0.04] text-white/50 hover:text-white"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Radar de Concorrentes</span>
          </button>

          <button
            type="button"
            onClick={() => setScannerView("blueprints")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              scannerView === "blueprints"
                ? "bg-white text-black shadow-md"
                : "bg-white/[0.04] text-white/50 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sugestões de Lançamento</span>
          </button>
        </div>

        <span className="text-[11px] text-white/40 hidden sm:inline">
          {data?.cycle?.finishedAt ? `Atualizado ${formatWhen(data.cycle.finishedAt)}` : "Online"}
        </span>
      </div>

      {/* 4. VIEW 1: SCANNED ITEMS RESULTS (Primary View) */}
      {scannerView === "results" && (
        <div className="space-y-5">
          {marketScanResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 sm:p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {marketScanResult.total} Itens Identificados
                  </h3>
                  <p className="text-xs text-white/50">
                    Estratégia: <span className="text-white/80 capitalize">{marketScanResult.options.strategy}</span> &bull; Termo: <span className="text-white/80 font-mono">"{marketScanResult.options.keywords || 'todos'}"</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs overflow-x-auto [scrollbar-width:none]">
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center shrink-0">
                  <span className="text-white/40 block text-[10px] uppercase font-semibold">Preço Médio</span>
                  <span className="font-bold text-emerald-400 font-mono">{marketScanResult.summary.avgPrice} R$</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center shrink-0">
                  <span className="text-white/40 block text-[10px] uppercase font-semibold">Total Favoritos</span>
                  <span className="font-bold text-amber-400 font-mono">★ {marketScanResult.summary.totalFavorites.toLocaleString()}</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-white/[0.025] border border-white/[0.06] text-center shrink-0">
                  <span className="text-white/40 block text-[10px] uppercase font-semibold">Distribuição</span>
                  <span className="font-bold text-white/90 font-mono">{marketScanResult.summary.shirtCount} Camisas / {marketScanResult.summary.pantsCount} Calças</span>
                </div>
              </div>
            </motion.div>
          )}

          {isScanningMarket && !marketScanResult && (
            <div className="py-20 text-center space-y-3 rounded-2xl bg-[#0a0a0a] border border-white/[0.06]">
              <LoaderCircle className="w-7 h-7 animate-spin text-white/50 mx-auto" />
              <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">
                Consultando dados do catálogo Roblox ao vivo...
              </p>
            </div>
          )}

          {marketScanResult && marketScanResult.items.length === 0 && (
            <div className="py-16 text-center text-xs text-white/40 rounded-2xl bg-[#0a0a0a] border border-white/[0.06]">
              Nenhum item encontrado com esses filtros. Tente alterar a palavra-chave ou o tipo de asset.
            </div>
          )}

          {marketScanResult && marketScanResult.items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {marketScanResult.items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-[#0a0a0a] border border-white/[0.08] hover:border-purple-500/40 p-3 flex flex-col justify-between gap-2.5 transition-all group relative overflow-hidden"
                >
                  {/* Top Thumbnail with Type Badge */}
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

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-bold tracking-wider uppercase text-white/80 border border-white/10">
                      {item.assetTypeName}
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-950/80 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      {item.price != null ? `${item.price} R$` : "Grátis"}
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
                        ★ {item.favoriteCount >= 1000 ? `${(item.favoriteCount / 1000).toFixed(1)}k` : item.favoriteCount}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenCloneModal(item)}
                      title="Copiar e postar no meu grupo"
                      className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-100 border border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold shadow-sm active:scale-95"
                    >
                      <Copy className="w-3 h-3 text-emerald-400" />
                      <span>Copiar &amp; Postar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyItemId(item.id)}
                      title="Copiar ID"
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all cursor-pointer"
                    >
                      {copiedItemId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    <a
                      href={`https://www.roblox.com/catalog/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir no Roblox"
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. VIEW 2: CLUSTERS & OPORTUNIDADES (Preserved Market Intelligence) */}
      {scannerView === "clusters" && (
        <div className="space-y-5">
          {/* Executive AI Market Intelligence Card */}
          <div className="rounded-2xl bg-gradient-to-b from-blue-950/20 via-[#0a0a0a] to-[#0a0a0a] border border-blue-500/20 p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Análise de Mercado
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      Tempo Real
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">
                    Tendências do catálogo, oportunidades de 5 R$ vs 3D e melhores horários de lançamento.
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
                    <span>Gerando Relatório...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 text-blue-200" />
                    <span>Gerar Relatório de Mercado</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Clusters Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Clusters de Alta Demanda</h3>
              <span className="text-xs text-white/40">{clusters.length} nichos mapeados</span>
            </div>

            {clusters.length === 0 ? (
              <div className="py-12 text-center text-xs text-white/40 rounded-2xl bg-[#0a0a0a] border border-white/[0.06]">
                Nenhum cluster ativo no momento. Execute uma varredura para calibrar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusters.map((cluster) => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. VIEW 3: RADAR DE CONCORRENTES */}
      {scannerView === "groups" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#0a0a0a] p-5 sm:p-6 border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">Radar de Grupos Concorrentes &amp; Referência</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Pesquise e espione grupos de roupas e marcas UGC no Roblox ao vivo.
                </p>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
                {["clothing aesthetic", "y2k clothing", "goth", "streetwear", "ugc accessories"].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setGroupSearchQuery(term);
                      handleSearchGroups(term);
                    }}
                    className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
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

      {/* 7. VIEW 4: BLUEPRINTS DE DROPS */}
      {scannerView === "blueprints" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#0a0a0a] p-5 sm:p-6 border border-white/[0.08] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Ideias e Sugestões de Lançamento (Próximas 48h)</h3>
              <p className="text-xs text-white/40 mt-0.5">
                Peças com alto potencial de busca e margem de lucro em Robux.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Alta Procura
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
                    onClick={() => {
                      navigator.clipboard.writeText(bp.tags.join(" "));
                      setCopiedBlueprintTags(bp.id);
                      toastManager.success("Tags Copiadas!", "Palavras-chave SEO copiadas para a área de transferência.");
                      setTimeout(() => setCopiedBlueprintTags(null), 1800);
                    }}
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

      {/* 8. Modal de Seleção de Grupo (Connected Groups & Live Search) */}
      <AnimatePresence>
        {showGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-[#0a0a0a] border border-white/[0.1] p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Selecionar Grupo Roblox</h3>
                    <p className="text-[11px] text-white/40">Selecione um de seus grupos conectados ou pesquise</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Connected Groups from Account */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Seus Grupos Vinculados
                </span>
                {userGroups && userGroups.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto [scrollbar-width:none]">
                    {userGroups.map((grp) => (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => {
                          setGroupId(String(grp.id));
                          setShowGroupModal(false);
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          groupId === String(grp.id)
                            ? "bg-white/10 border-white/20 text-white"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/80"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{grp.name}</div>
                          <div className="text-[10px] text-white/40 font-mono">ID: {grp.id}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-[10px] text-purple-300 shrink-0">
                          {grp.reason === "Owner" || grp.rank === 255 ? "Dono" : grp.role || "Membro"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-white/40 text-center">
                    Nenhum grupo vinculado na conta conectada.
                  </div>
                )}
              </div>

              {/* Search any Roblox group */}
              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Pesquisar Outro Grupo no Roblox
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="Nome do grupo concorrente..."
                    className="flex-1 bg-[#141414] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleModalSearchGroups(modalSearchTerm)}
                    disabled={modalSearching}
                    className="px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 cursor-pointer disabled:opacity-50"
                  >
                    {modalSearching ? "..." : "Buscar"}
                  </button>
                </div>

                {modalSearchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto [scrollbar-width:none] pt-1">
                    {modalSearchResults.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => {
                          setGroupId(String(res.id));
                          setShowGroupModal(false);
                        }}
                        className="w-full p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-left transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate text-white">{res.name}</div>
                          <div className="text-[10px] text-white/40 font-mono">ID: {res.id}</div>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {res.memberCount.toLocaleString()} membros
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white/70 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clone & Post to Group Modal */}
        {showCloneModal && cloneModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-[#0c0c0e] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto [scrollbar-width:none]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Copy className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Copiar &amp; Postar no Grupo
                    </h3>
                    <p className="text-[11px] text-white/50">
                      Clone esta peça diretamente para o seu grupo no Roblox
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Item Card Overview */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#141416] border border-white/[0.06]">
                <div className="w-16 h-16 rounded-lg bg-black border border-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                  {cloneModalItem.thumbnailUrl ? (
                    <img
                      src={cloneModalItem.thumbnailUrl}
                      alt={cloneModalItem.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Shirt className="w-6 h-6 text-white/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.08] text-white/80">
                      {(cloneModalItem.assetTypeName || "CLOTHING").toUpperCase()}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      ★ {cloneModalItem.favoriteCount.toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white truncate" title={cloneModalItem.name}>
                    {cloneModalItem.name}
                  </h4>
                  <p className="text-[10px] text-white/40 truncate">
                    Criador original: {cloneModalItem.creatorName} &bull; ID: {cloneModalItem.id}
                  </p>
                </div>
              </div>

              {/* Success Result View */}
              {cloneSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-300">
                        {cloneSuccessJob ? "Peça Agendada com Sucesso!" : "Molde Extraído com Sucesso!"}
                      </h4>
                      <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">
                        {cloneSuccessMessage}
                      </p>
                    </div>
                  </div>

                  {cloneSuccessJob && (
                    <div className="p-3 rounded-lg bg-black/40 border border-emerald-500/20 text-xs space-y-1 font-mono">
                      <div className="text-white/60 text-[11px]">
                        Status na Fila: <span className="text-emerald-400 font-bold uppercase">{cloneSuccessJob.status}</span>
                      </div>
                      <div className="text-white/60 text-[11px]">
                        Preço: <span className="text-white font-bold">{cloneSuccessJob.price} Robux</span>
                      </div>
                      {cloneSuccessJob.groupId && (
                        <div className="text-white/60 text-[11px]">
                          Grupo: <span className="text-white font-bold">{cloneSuccessJob.groupId}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {cloneDownloadedUrl && (
                      <button
                        type="button"
                        onClick={handleDownloadExtractedTemplate}
                        className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar Molde PNG (585x559)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate("/painel/uploads")}
                      className="px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver Fila de Uploads</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCloneModal(false)}
                      className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 text-xs font-semibold ml-auto cursor-pointer"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              ) : (
                /* Configuration Form */
                <div className="space-y-4">
                  {/* Field 1: New Item Name */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
                      Nome da Peça no seu Grupo
                    </label>
                    <input
                      type="text"
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                      placeholder="Ex: Y2K Oversized Cyber Hoodie..."
                      className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 transition-all font-medium"
                    />
                  </div>

                  {/* Field 2: Target Group */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
                      Grupo de Destino (Roblox Group)
                    </label>
                    <div className="space-y-2">
                      <select
                        value={cloneGroupId}
                        onChange={(e) => setCloneGroupId(e.target.value)}
                        className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 transition-all cursor-pointer font-medium"
                      >
                        {userGroups.length > 0 ? (
                          userGroups.map((grp) => (
                            <option key={grp.id} value={String(grp.id)}>
                              {grp.name} (ID: {grp.id}) {grp.role ? `• ${grp.role}` : ""}
                            </option>
                          ))
                        ) : (
                          <option value="">Nenhum grupo detectado automaticamente</option>
                        )}
                        <option value="custom">-- Digitar ID de Outro Grupo --</option>
                      </select>

                      {(cloneGroupId === "custom" || userGroups.length === 0) && (
                        <input
                          type="text"
                          value={customGroupIdInput}
                          onChange={(e) => setCustomGroupIdInput(e.target.value)}
                          placeholder="Digite o ID numérico do seu grupo (ex: 35320581)"
                          className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                        />
                      )}
                    </div>
                  </div>

                  {/* Field 3: Sale Price in Robux */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                        Preço de Venda (Robux)
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[5, 7, 10, 15].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setClonePrice(p)}
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                              clonePrice === p
                                ? "bg-emerald-500 text-black"
                                : "bg-white/[0.05] text-white/50 hover:text-white"
                            }`}
                          >
                            {p} R$
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min={5}
                        max={10000}
                        value={clonePrice}
                        onChange={(e) => setClonePrice(Math.max(5, Number(e.target.value) || 5))}
                        className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-white/20 transition-all"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-emerald-400 font-mono">
                        Robux
                      </span>
                    </div>
                  </div>

                  {/* Field 4: Extraction Method */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
                      Modo de Extração
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCloneMethod("original")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          cloneMethod === "original"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-[#121212] border-white/[0.06] text-white/50 hover:text-white"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>Molde Original 1:1</span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-1">
                          Extrai o template PNG oficial idêntico
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCloneMethod("ai_remake")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          cloneMethod === "ai_remake"
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
                            : "bg-[#121212] border-white/[0.06] text-white/50 hover:text-white"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>🎨</span>
                          <span>Remake IA Anti-Ban</span>
                        </div>
                        <p className="text-[10px] text-white/40 mt-1">
                          Variação estilizada anti-moderação
                        </p>
                      </button>
                    </div>
                  </div>

                  {cloneError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <span>{cloneError}</span>
                        {cloneError.includes("Conta") && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => navigate("/painel/conta")}
                              className="text-emerald-400 hover:underline font-bold text-[11px]"
                            >
                              Ir para a aba Conta &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Submit Actions */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleExecuteClone}
                      disabled={isCloning}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(52,211,153,0.35)] transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isCloning ? (
                        <>
                          <LoaderCircle className="w-4 h-4 animate-spin text-black" />
                          <span>PROCESSANDO E PUBLICANDO...</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-black" />
                          <span>PUBLICAR NO MEU GRUPO AGORA</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-white/40 pt-1">
                      <span>Roblox Upload Fee: 80 R$ (se aplicável pelo grupo)</span>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/painel/ugc-creator?prompt=${encodeURIComponent(
                              `Crie uma versão alternativa estilo ${cloneModalItem.name}`
                            )}`
                          )
                        }
                        className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Abrir no Studio UGC AI</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
