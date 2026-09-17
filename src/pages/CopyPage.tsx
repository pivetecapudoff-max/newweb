import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy,
  Download,
  ExternalLink,
  Sparkles,
  Box,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FolderArchive,
  ArrowRight,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { ripUgcItem, mutateImageHash, type UgcRipResult } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { SeoOptimizationModal } from "../components/SeoOptimizationModal";
import { toastManager } from "@/components/ui/toast";
import { RobloxAvatar3D } from "../components/RobloxAvatar3D";

interface HistoryItem {
  assetId: string;
  name: string;
  type: string;
  creator: string;
  thumbnailUrl: string;
  zipUrl: string;
  textureUrl?: string;
  objUrl?: string;
  isClothing: boolean;
  copiedAt: string;
}

export function CopyPage() {
  const navigate = useNavigate();
  const [inputVal, setInputVal] = useState("");
  const [customCookie, setCustomCookie] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UgcRipResult | null>(null);
  const [currentTextureUrl, setCurrentTextureUrl] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [hashMutated, setHashMutated] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("farol_ugc_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveToHistory = (res: UgcRipResult) => {
    const newItem: HistoryItem = {
      assetId: res.assetId,
      name: res.name,
      type: res.type,
      creator: res.creator,
      thumbnailUrl: res.thumbnailUrl,
      zipUrl: res.zipUrl,
      textureUrl: res.textureUrl,
      objUrl: res.objUrl,
      isClothing: res.isClothing,
      copiedAt: new Date().toISOString(),
    };
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.assetId !== res.assetId);
      const updated = [newItem, ...filtered].slice(0, 12);
      try {
        localStorage.setItem("farol_ugc_history", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("farol_ugc_history");
    } catch {}
  };

  const handleRip = async (target?: string) => {
    const raw = (target !== undefined ? target : inputVal).trim();
    if (!raw) {
      setError("Insira a URL ou ID do catálogo do Roblox.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await ripUgcItem({
        urlOrId: raw,
        cookie: customCookie.trim() || undefined,
      });

      if (!res.success) {
        throw new Error("Não foi possível processar o asset.");
      }

      setResult(res);
      setCurrentTextureUrl(res.textureUrl || null);
      setHashMutated(false);
      saveToHistory(res);
      toastManager.success(
        "Item Extraído com Sucesso!",
        `Arquivos de "${res.name || "Item"}" prontos para uso.`
      );
    } catch (err: any) {
      const errorMsg = err?.message || "Erro inesperado ao copiar o item UGC.";
      setError(errorMsg);
      toastManager.error("Falha ao Extrair 3D", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMutateHash = async () => {
    if (!currentTextureUrl) return;
    setMutating(true);
    try {
      let b64 = currentTextureUrl;
      if (b64.startsWith("http") || b64.startsWith("/")) {
        const resp = await fetch(b64);
        const blob = await resp.blob();
        b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      const res = await mutateImageHash(b64);
      if (res.success) {
        setCurrentTextureUrl(res.mutatedDataUrl);
        setHashMutated(true);
        toastManager.success("Mutação Anti-Ban Aplicada!", "Hash SHA-256 alterado com micro-ruído imperceptível.");
      }
    } catch (err: any) {
      toastManager.error("Erro na Mutação", err.message || "Falha ao mutar imagem.");
    } finally {
      setMutating(false);
    }
  };

  const handleSendToUpload2D = () => {
    if (!result || !currentTextureUrl) return;
    const isPants = result.type.toLowerCase().includes("calça") || result.type.toLowerCase().includes("pants");
    navigate("/painel/upload", {
      state: {
        mode: "2d",
        image: currentTextureUrl,
        name: result.name,
        kind: isPants ? "pants" : "shirt",
      },
    });
  };

  const handleSendToUploadUgc = async () => {
    if (!result) return;
    const objFile = result.files.find((f) => f.type === "obj");
    const texFile = result.files.find((f) => f.type === "texture");
    if (!objFile || !texFile) {
      toastManager.error("Arquivos Faltando", "O item não possui malha OBJ e textura PNG.");
      return;
    }
    try {
      const readBlobAsB64 = (url: string): Promise<string> =>
        fetch(url)
          .then((r) => r.blob())
          .then(
            (b) =>
              new Promise((resolve) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result as string);
                r.readAsDataURL(b);
              })
          );
      const [objData, texData] = await Promise.all([readBlobAsB64(objFile.url), readBlobAsB64(texFile.url)]);
      navigate("/painel/upload", {
        state: {
          mode: "ugc",
          mesh: objData,
          meshName: objFile.name,
          texture: texData,
          textureName: texFile.name,
          name: result.name,
          accessoryType: result.type,
          meshId: result.meshId,
          textureId: result.textureId,
        },
      });
    } catch (err: any) {
      toastManager.error("Erro ao carregar", err.message || "Não foi possível preparar o envio.");
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="border-b border-white/[0.08] pb-6">
        <div className="blur-glow-aura">
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="text-shiny-blue">Copy &amp; Cloner de Catálogo</span>
            <span className="text-xs font-normal px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono">
              2D &amp; 3D Ready
            </span>
          </h1>
          <p className="text-sm text-white/50 mt-1 max-w-2xl">
            Extraia o modelo 3D (.OBJ, .MTL) e texturas originais (.PNG) de qualquer item ou roupa clássica do catálogo com 1 clique.
          </p>
        </div>
      </div>

      {/* Main Action Box */}
      <div className="relative rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] p-6 lg:p-8 shadow-2xl overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
              URL do Catálogo ou Asset ID Numérico
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                  <Box className="w-5 h-5 text-blue-400" />
                </div>
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleRip()}
                  placeholder="Ex: https://www.roblox.com/catalog/4849184439/Butterfly-Hat ou 4849184439"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-white/30"
                />
              </div>

              <div className="shrink-0 flex items-center justify-center">
                <LiquidMetalButton
                  onClick={() => handleRip()}
                  disabled={loading}
                  width={200}
                  icon={
                    loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-blue-400" />
                    )
                  }
                  label={loading ? "Extraindo 3D..." : "Copiar / Ripar Item"}
                />
              </div>
            </div>
          </div>



          {/* Advanced Accordion */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Opções Avançadas (Cookie Manual .ROBLOSECURITY)</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <label className="block text-xs font-medium text-white/60">
                  Cookie .ROBLOSECURITY personalizado (opcional)
                </label>
                <input
                  type="password"
                  value={customCookie}
                  onChange={(e) => setCustomCookie(e.target.value)}
                  placeholder="_|WARNING:-DO-NOT-SHARE-THIS..."
                  className="w-full px-3.5 py-2 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-white/40">
                  O Farol já injeta automaticamente a sessão da sua conta conectada para acessar moldes de camisas e itens restritos. Preencha aqui apenas se desejar usar uma conta alternativa.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Animation Card */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl bg-blue-500/[0.03] border border-blue-500/20 p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Extraindo asset do catálogo Roblox...</h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Baixando malha 3D, decodificando compressão Draco, gerando .OBJ e empacotando texturas .PNG em alta resolução.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-5 flex items-start gap-3 backdrop-blur-xl">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-300">Falha na extração</h4>
            <p className="text-xs text-rose-200/70 mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Result Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] p-6 lg:p-8 shadow-2xl space-y-6"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.1] overflow-hidden shrink-0 flex items-center justify-center">
                  {result.thumbnailUrl ? (
                    <img
                      src={result.thumbnailUrl}
                      alt={result.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Box className="w-8 h-8 text-white/30" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-500/15 border border-blue-500/30 text-blue-400">
                      {result.type || "Asset UGC"}
                    </span>
                    <span className="text-xs text-white/40 font-mono">ID: {result.assetId}</span>
                  </div>

                  <h3 className="text-lg lg:text-xl font-bold text-white mt-1">{result.name}</h3>
                  <p className="text-xs text-white/50">Criador: <span className="text-white/80 font-medium">{result.creator}</span></p>
                </div>
              </div>

              {/* Primary Download Button & SEO Optimizer */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSeoModalOpen(true)}
                  className="flex h-11 items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-all shadow-lg"
                >
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Otimizar SEO &amp; Títulos</span>
                </button>

                <LiquidMetalButton
                  href={result.zipUrl}
                  download
                  width={195}
                  icon={<FolderArchive className="w-4 h-4 text-blue-400" />}
                  label="Baixar Pacote .ZIP"
                />
              </div>
            </div>

            {/* Notice if any */}
            {result.notice && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
                {result.notice}
              </div>
            )}

            {/* 3D Roblox Avatar Preview for Clothing */}
            {result.isClothing && currentTextureUrl && (
              <div className="rounded-2xl border border-white/[0.08] bg-black/50 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-400" />
                    Visualização no Avatar Oficial Roblox (R6 &amp; R15)
                  </span>
                  <span className="text-[10px] uppercase font-mono text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    Molde 585×559 Mapeado
                  </span>
                </div>

                <div className="w-full flex justify-center">
                  <RobloxAvatar3D
                    templateDataUrl={currentTextureUrl}
                    kind={result.type.toLowerCase().includes("calça") || result.type.toLowerCase().includes("pants") ? "pants" : "shirt"}
                    title={result.name}
                    className="w-full max-w-lg h-[400px]"
                  />
                </div>
              </div>
            )}

            {/* Extracted Files Grid */}
            <div>
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Arquivos Extraídos no Pacote
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {result.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
                        {file.type === "obj" && <Box className="w-4 h-4 text-amber-400" />}
                        {file.type === "texture" && <ImageIcon className="w-4 h-4 text-blue-400" />}
                        {file.type === "mtl" && <Layers className="w-4 h-4 text-blue-400" />}
                        {file.type === "mesh" && <Box className="w-4 h-4 text-blue-400" />}
                        {file.type === "zip" && <FolderArchive className="w-4 h-4 text-blue-400" />}
                        {file.type === "other" && <Box className="w-4 h-4 text-white/40" />}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium text-white truncate">{file.name}</div>
                        <div className="text-[10px] text-white/40 uppercase font-mono">{file.type}</div>
                      </div>
                    </div>

                    <a
                      href={file.url}
                      download={file.name}
                      title={`Baixar ${file.name}`}
                      className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white transition-all shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Footer & Direct Pipeline Buttons */}
            <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <a
                  href={`https://www.roblox.com/catalog/${result.assetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver no Catálogo Roblox</span>
                </a>

                {result.logs && result.logs.length > 0 && (
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors cursor-pointer ml-2"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{showLogs ? "Ocultar Logs" : "Ver Logs do Ripper"}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Anti-Ban Hash Mutation Button */}
                {currentTextureUrl && (
                  <button
                    type="button"
                    onClick={handleMutateHash}
                    disabled={mutating}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                      hashMutated
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-purple-500/15 border-purple-500/30 text-purple-200 hover:bg-purple-500/25"
                    }`}
                  >
                    {mutating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span>{hashMutated ? "✓ Hash Mutado (Anti-Ban)" : "Mutação Anti-Ban (Hash)"}</span>
                  </button>
                )}

                {/* Direct 1-Click Action to Upload */}
                {result.isClothing ? (
                  <button
                    onClick={handleSendToUpload2D}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <span>Enviar para Publicar Roupa (2D)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendToUploadUgc}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <span>Enviar para Publicar UGC 3D (Tectonic)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Terminal Logs Viewer */}
            {showLogs && result.logs && (
              <div className="p-4 rounded-xl bg-black/70 border border-white/[0.08] font-mono text-[11px] text-blue-400/90 max-h-48 overflow-y-auto space-y-1">
                {result.logs.map((line, idx) => (
                  <div key={idx} className="leading-relaxed">{line}</div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent History Grid */}
      {history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Itens Copiados Recentemente ({history.length})
            </h3>

            <button
              onClick={clearHistory}
              className="text-xs text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Limpar Histórico
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {history.map((item) => (
              <div
                key={item.assetId}
                className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/[0.08] p-4 hover:border-white/[0.15] transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Box className="w-6 h-6 text-white/30" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-white/40 truncate">{item.creator}</div>
                    <div className="text-[9px] text-blue-400 font-mono mt-0.5">{item.type}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <a
                    href={item.zipUrl}
                    download
                    className="flex-1 py-1.5 px-3 rounded-lg bg-white/[0.05] hover:bg-blue-600/80 text-white/80 hover:text-white text-xs font-medium transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar .ZIP</span>
                  </a>

                  <button
                    onClick={() => {
                      setInputVal(item.assetId);
                      handleRip(item.assetId);
                    }}
                    title="Recopiar este item"
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-blue-600/80 text-white/60 hover:text-white transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <SeoOptimizationModal
          isOpen={seoModalOpen}
          onClose={() => setSeoModalOpen(false)}
          assetId={result.assetId}
          imageUrl={result.thumbnailUrl}
          currentTitle={result.name}
          itemType={result.type}
        />
      )}
    </div>
  );
}
