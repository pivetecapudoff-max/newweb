import React, { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DotButton } from "../components/ui/DotButton";
import {
  deleteUpload,
  fetchUploads,
  lookupGroupStore,
  queueUpload,
  retryUpload,
  uploadFileHref,
  type AssetLook,
  type ClothingKind,
  type GroupStore,
  type UploadBoard,
  type UploadJob,
} from "../lib/api";
import { ItemThumb } from "../components/ItemThumb";
import {
  ShoppingBag,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Layers,
  FileText,
  Trash2,
  Plus,
  Tag,
  Sparkles,
} from "lucide-react";
import { SeoOptimizationModal } from "../components/SeoOptimizationModal";

const KINDS: { id: ClothingKind; label: string; hint: string }[] = [
  { id: "shirt", label: "Camisa (Shirt)", hint: "Template clássico de camisa &bull; 585×559" },
  { id: "pants", label: "Calça (Pants)", hint: "Template clássico de calça &bull; 585×559" },
  { id: "tshirt", label: "T-shirt", hint: "Imagem quadrada central estampada na camiseta" },
];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function UploadPage() {
  const [board, setBoard] = useState<UploadBoard | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "upload" | "queue">("catalog");
  const [catalogItems, setCatalogItems] = useState<AssetLook[]>([]);
  const [catalogStore, setCatalogStore] = useState<GroupStore | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ClothingKind>("shirt");
  const [price, setPrice] = useState(5);
  const [groupId, setGroupId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optBanner, setOptBanner] = useState<string | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [seoModalProps, setSeoModalProps] = useState<{
    assetId?: number | string;
    imageUrl?: string;
    imageBase64?: string;
    currentTitle?: string;
    itemType?: string;
    groupName?: string;
    onApply?: (data: { title: string; description: string; tags: string[] }) => void;
  }>({});

  const loadUploads = () => {
    fetchUploads()
      .then((b) => {
        setBoard(b);
        if (b.groups?.length && !groupId) {
          setGroupId(String(b.groups[0].id));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const loadCatalog = async () => {
    if (!groupId) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const store = await lookupGroupStore(groupId);
      setCatalogStore(store);
      setCatalogItems(store.items);
    } catch (err) {
      setCatalogStore(null);
      setCatalogItems([]);
      setCatalogError(err instanceof Error ? err.message : "Não foi possível carregar o catálogo.");
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadUploads();
    const poll = setInterval(loadUploads, 5000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (groupId) void loadCatalog();
  }, [groupId]);

  async function onFile(next: File | null) {
    setFile(next);
    setPreview(null);
    if (!next) return;
    const base64 = await readFile(next);
    setPreview(base64);
    if (!name.trim()) {
      const cleanName = next.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .slice(0, 45);
      setName(cleanName);
    }
  }

  function generateAiDesc(titleToUse?: string) {
    const t = (titleToUse || name || file?.name?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "UGC Clothing").trim();
    setSeoModalProps({
      imageBase64: preview || undefined,
      currentTitle: t,
      itemType: kind === "tshirt" ? "Classic T-Shirt" : kind === "pants" ? "Classic Pants" : "Classic Shirt",
      groupName,
      onApply: (d) => {
        setName(d.title);
        setDescription(d.description);
      },
    });
    setSeoModalOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !preview) {
      setError("Selecione um arquivo PNG ou JPEG do template da roupa primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await queueUpload({
        name,
        description,
        kind,
        price,
        groupId: groupId ? Number(groupId) : null,
        fileName: file.name,
        image: preview,
      });
      setFile(null);
      setPreview(null);
      setName("");
      setDescription("");
      setActiveTab("queue");
      loadUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const handleCopy = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOptimizeAll = async () => {
    if (!groupId) {
      setOptBanner("⚠️ Selecione um grupo conectado antes de otimizar.");
      return;
    }
    setOptimizing(true);
    setOptBanner(`Otimizando as ${catalogItems.length} peças carregadas diretamente do Roblox...`);
    try {
      const res = await fetch("/api/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: Number(groupId) }),
      });
      const json = await res.json();
      if (res.ok) {
        setOptBanner(`✅ ${json.result?.updated ?? 0} de ${json.result?.total ?? catalogItems.length} peças atualizadas; ${json.result?.errors ?? 0} erro(s).`);
        loadCatalog();
      } else {
        setOptBanner(`⚠️ Erro: ${json.error || "Falha na otimização"}`);
      }
    } catch (e: any) {
      setOptBanner(`❌ Erro de conexão: ${e.message}`);
    } finally {
      setOptimizing(false);
      setTimeout(() => setOptBanner(null), 8000);
    }
  };

  const clothingTypeIds = new Set([2, 11, 12]);
  const clothingCount = catalogItems.filter((item) => clothingTypeIds.has(item.assetTypeId)).length;
  const ugcCount = catalogItems.length - clothingCount;
  const knownPrices = catalogItems.map((item) => item.price).filter((value): value is number => typeof value === "number");
  const minPrice = knownPrices.length ? Math.min(...knownPrices) : null;
  const maxPrice = knownPrices.length ? Math.max(...knownPrices) : null;
  const seoCount = catalogItems.filter((item) => item.description.trim().length >= 15).length;
  const seoPercent = catalogItems.length ? Math.round((seoCount / catalogItems.length) * 100) : null;
  const queueCount = (board?.jobs || []).filter((job) => job.status === "queued" || job.status === "uploading").length;
  const activeGroup = board?.groups.find((group) => String(group.id) === groupId);
  const groupName = catalogStore?.groupName || activeGroup?.name || "Grupo selecionado";

  return (
    <div className="h-full space-y-7 overflow-y-auto bg-transparent p-6 pb-16 font-sans text-white backdrop-blur-[2px] md:p-8 [&>*]:mx-auto [&>*]:max-w-[1480px]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[28px]">
            <ShoppingBag className="h-5 w-5 text-blue-400" />
            <span>Projetos &amp; Catálogo UGC</span>
            {groupId && (
              <span className="border-l border-white/15 pl-3 text-xs font-medium text-white/45">
                {groupName}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-white/45 mt-1">
            Gestão de peças, itens 3D UGC, novos uploads de roupas clássicas e controle de moderação no Roblox.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOptimizeAll}
            disabled={optimizing}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/[0.09] bg-[#0a0a0a] px-3 text-xs font-semibold text-white/75 transition-colors hover:border-white/15 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-white/45 ${optimizing ? "animate-spin" : ""}`} />
            <span>{optimizing ? "Otimizando..." : "Otimizar SEO em Lote"}</span>
          </button>

          <button
            onClick={() => setActiveTab("upload")}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-semibold text-black transition-colors hover:bg-white/90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Upload</span>
          </button>
        </div>
      </div>

      {optBanner && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
            optBanner.includes("✅")
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-200"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{optBanner}</span>
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Total Peças Ativas</p>
          <p className="text-2xl font-bold text-white mt-1">{catalogStore ? catalogStore.itemCount : "—"}</p>
          <p className="text-[11px] text-emerald-400 mt-0.5">{catalogStore ? `${clothingCount} roupas 2D · ${ugcCount} itens 3D` : "Aguardando catálogo"}</p>
        </div>

        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Preços no Catálogo</p>
          <p className="text-2xl font-bold text-white mt-1">{minPrice == null ? "—" : minPrice === maxPrice ? `${minPrice} R$` : `${minPrice} a ${maxPrice} R$`}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{knownPrices.length} preços informados pela Roblox</p>
        </div>

        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Status de SEO</p>
          <p className="mt-1 text-2xl font-semibold text-white">{seoPercent == null ? "—" : `${seoPercent}%`}</p>
          <p className="mt-0.5 text-[11px] text-emerald-300/75">{catalogStore ? `${seoCount} descrições completas` : "Aguardando catálogo"}</p>
        </div>

        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Fila de Publicação</p>
          <p className="mt-1 text-2xl font-semibold text-white">{board ? queueCount : "—"}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{board ? `${board.jobs.length} uploads registrados` : "Aguardando servidor"}</p>
        </div>
      </div>

      {/* Modern Tab Switcher */}
      <div className="flex items-center gap-2 pb-3">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "catalog"
              ? "bg-[#1a1a1a] text-white shadow-sm"
              : "text-white/40 hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Catálogo do Grupo ({catalogStore?.itemCount ?? "—"})</span>
        </button>

        <button
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "upload"
              ? "bg-[#1a1a1a] text-white shadow-sm"
              : "text-white/40 hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Publicar Nova Roupa</span>
        </button>

        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "queue"
              ? "bg-[#1a1a1a] text-white shadow-sm"
              : "text-white/40 hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Fila de Uploads ({(board?.jobs || []).length})</span>
        </button>
      </div>

      {/* Tab 1: Active Catalog Grid */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">
              Itens sincronizados com {groupName} · ID {groupId || "—"}
            </span>
            <button
              onClick={loadCatalog}
              className="flex cursor-pointer items-center gap-1 text-xs text-blue-400/75 hover:text-blue-300"
            >
              <RefreshCw className={`w-3 h-3 ${catalogLoading ? "animate-spin" : ""}`} />
              <span>Atualizar lista</span>
            </button>
          </div>

          {catalogError && (
            <div className="flex items-center justify-between rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-100/80">
              <span>{catalogError}</span>
              <button onClick={loadCatalog} className="font-semibold text-white hover:underline">Tentar novamente</button>
            </div>
          )}

          {catalogLoading && catalogItems.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-label="Carregando catálogo">
              {Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-xl border border-white/[0.06] bg-[#0d0d0d]" />)}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {catalogItems.map((item) => {
              const isUgc =
                item.assetTypeId >= 41 ||
                item.assetType.toLowerCase().includes("hair") ||
                item.name?.toLowerCase().includes("hair");
              const priceDisplay = typeof item.price === "number" ? `${item.price} R$` : "Preço indisponível";
              const typeLabel = isUgc ? `UGC 3D ${item.assetType}` : item.assetType || "Clothing";

              return (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-md transition-colors hover:border-white/15 hover:bg-white/[0.04]"
                >
                  {/* Thumbnail Preview */}
                  <div className="relative aspect-square overflow-hidden bg-transparent">
                    <ItemThumb url={item.thumbnailUrl} name={item.name} className="h-full w-full" />
                    {/* Type badge overlay */}
                    <span
                      className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${
                        isUgc
                          ? "bg-blue-600/25 text-blue-400 border border-blue-500/30"
                          : "bg-black/60 text-white/70"
                      }`}
                    >
                      {typeLabel}
                    </span>
                    {/* SEO badge overlay */}
                    <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${item.description.trim().length >= 15 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300"}`}>
                      {item.description.trim().length >= 15 ? "Descrição completa" : "Descrição pendente"}
                    </span>
                  </div>

                  {/* Card Info */}
                  <div className="border-t border-white/[0.055] bg-black/10 p-3 backdrop-blur-sm">
                    <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-white transition-colors group-hover:text-blue-200">
                      {item.name}
                    </h3>

                    <div className="flex items-center justify-between mt-2.5">
                      <span className={`text-xs font-bold ${isUgc ? "text-blue-400" : "text-white"}`}>
                        {priceDisplay}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSeoModalProps({
                              assetId: item.id,
                              imageUrl: item.thumbnailUrl,
                              currentTitle: item.name,
                              itemType: typeLabel,
                              groupName,
                            });
                            setSeoModalOpen(true);
                          }}
                          title="Analisar Imagem & Otimizar SEO com IA"
                          className="p-1 rounded-md hover:bg-blue-500/20 text-blue-400/80 hover:text-blue-300 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleCopy(item.id)}
                          title="Copiar ID"
                          className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          {copiedId === item.id ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>

                        <a
                          href={`https://www.roblox.com/catalog/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir no Roblox"
                          className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Tab 2: Publish New Clothing */}
      {activeTab === "upload" && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: File Dropzone */}
          <div className="lg:col-span-5">
            <label className="group relative flex h-[360px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-6 text-center transition-colors hover:border-white/15 hover:bg-[#0d0d0d]">
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => void onFile(e.target.files?.[0] || null)}
              />

              {preview ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <img
                    src={preview}
                    alt="Preview do Template"
                    className="max-h-[260px] object-contain rounded-lg shadow-xl"
                  />
                  <span className="mt-3 text-[11px] font-medium text-blue-400/75">
                    Clique para trocar o template
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors group-hover:text-blue-300">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-white">Arraste o template aqui</p>
                  <p className="text-xs text-white/40 mt-1">Suporta arquivos PNG e JPEG</p>
                  <span className="text-[10px] text-white/30 font-mono mt-4 px-2.5 py-1 rounded-full bg-white/[0.04]">
                    585 × 559 px
                  </span>
                </div>
              )}
            </label>
          </div>

          {/* Right Column: Fields */}
          <div className="lg:col-span-7 space-y-4 bg-[#0a0a0a] p-6 rounded-2xl shadow-lg">
            {/* Kind Switcher */}
            <div>
              <label className="text-xs font-medium text-white/60 block mb-2">Tipo de Peça</label>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      kind === k.id
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">
                {KINDS.find((k) => k.id === kind)?.hint}
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1.5">Nome da Roupa</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: y2k emo goth girl cargo pants"
                required
                className="w-full bg-[#0f0f0f] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
              />
            </div>

            {/* Description with AI generator */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white/60">Descrição & Tags SEO</label>
                <button
                  type="button"
                  onClick={() => generateAiDesc()}
                  disabled={generatingDesc}
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-blue-400/75 hover:text-blue-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${generatingDesc ? "animate-spin" : ""}`} />
                  <span>{generatingDesc ? "Gerando com IA..." : "Auto-preencher com IA & SEO"}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição estética com tags..."
                className="w-full bg-[#0f0f0f] rounded-lg p-3 text-xs text-white focus:outline-none font-mono transition-all resize-none"
              />
            </div>

            {/* Price & Group */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-white/60 block mb-1.5">Preço (Robux)</label>
                <input
                  type="number"
                  min={kind === "tshirt" ? 0 : 5}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-[#0f0f0f] rounded-lg px-4 py-2 text-sm text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/60 block mb-1.5">Publicar em</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-[#0f0f0f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                >
                  {(board?.groups || []).map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name} ({g.id})
                    </option>
                  ))}
                  <option value="">Minha Conta Pessoal</option>
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg">{error}</p>}

            <DotButton
              type="submit"
              disabled={busy || !file}
              wrapperClassName="w-full"
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-white text-black hover:bg-neutral-200 shadow-lg"
            >
              {busy ? "Publicando no Roblox..." : "Publicar Roupa no Catálogo"}
            </DotButton>
          </div>
        </form>
      )}

      {/* Tab 3: Upload Queue */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {(board?.jobs || []).length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0a0a0a]">
              <Layers className="w-8 h-8 text-white/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-white/60">Nenhum upload pendente na fila.</p>
              <button
                onClick={() => setActiveTab("upload")}
                className="mt-2 inline-block text-xs text-blue-400/75 hover:text-blue-300 hover:underline"
              >
                + Criar novo upload de roupa
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#0a0a0a] overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-white/40 text-[11px] font-mono uppercase">
                    <th className="py-3 px-4">Peça</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {board!.jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {job.name}
                        {job.assetId && (
                          <span className="block text-[10px] text-white/40 font-mono">
                            ID: {job.assetId}
                          </span>
                        )}
                        {job.error && (
                          <span className="block text-[11px] text-rose-400 mt-0.5">
                            {job.error.includes("{") ? "Erro na taxa de upload do Roblox" : job.error}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-white/60 font-mono uppercase text-[11px]">
                        {job.kind}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            job.status === "live"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : job.status === "uploading"
                              ? "bg-blue-600/15 text-blue-300 animate-pulse"
                              : job.status === "queued"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {job.status === "live"
                            ? "Publicado"
                            : job.status === "uploading"
                            ? "Enviando..."
                            : job.status === "queued"
                            ? "Na Fila"
                            : "Falhou"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={uploadFileHref(job.id)}
                            download
                            className="px-2 py-1 rounded bg-white/[0.05] hover:bg-white/10 text-white/70 hover:text-white text-[11px] transition-colors"
                          >
                            Download
                          </a>

                          {job.status === "failed" && (
                            <button
                              onClick={() => retryUpload(job.id).then(loadUploads)}
                              className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] transition-colors"
                            >
                              Tentar de novo
                            </button>
                          )}

                          <button
                            onClick={() => deleteUpload(job.id).then(loadUploads)}
                            className="p-1.5 rounded text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <SeoOptimizationModal
        isOpen={seoModalOpen}
        onClose={() => setSeoModalOpen(false)}
        {...seoModalProps}
      />
    </div>
  );
}
