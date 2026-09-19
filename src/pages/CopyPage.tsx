import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
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
  Plus,
  Check,
  RotateCw,
  Shuffle,
  Sliders,
  Copy,
  FileCode,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ripUgcItem,
  uniqueifyUgcAsset,
  claimAssetOwnership,
  queueUgcAccessory,
  queueUpload,
  fetchUploads,
  type UgcRipResult,
  type UploadBoard,
  type UploadJob,
} from "../lib/api";
import { toastManager } from "@/components/ui/toast";
import { SeoOptimizationModal } from "../components/SeoOptimizationModal";
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

const ACCESSORY_TYPES = [
  "Auto-detect from source",
  "Hat",
  "Hair",
  "Face",
  "Neck",
  "Shoulder",
  "Front",
  "Back",
  "Waist",
];

export function CopyPage() {
  const navigate = useNavigate();

  // Source & Fetch state
  const [inputVal, setInputVal] = useState("");
  const [customCookie, setCustomCookie] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UgcRipResult | null>(null);
  const [currentTextureUrl, setCurrentTextureUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "fetching" | "ready" | "queuing" | "queued" | "error">("idle");

  // Publish target state
  const [board, setBoard] = useState<UploadBoard | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [customGroupIdInput, setCustomGroupIdInput] = useState(false);
  const [nameOverride, setNameOverride] = useState("");
  const [priceOverride, setPriceOverride] = useState<number>(75);
  const [accessoryType, setAccessoryType] = useState<string>("Auto-detect from source");
  const [description, setDescription] = useState("");

  // Uniqueification state
  const [uvRotation, setUvRotation] = useState(false);
  const [faceShuffle, setFaceShuffle] = useState(true);
  const [vertexJitter, setVertexJitter] = useState(true);
  const [pngSalt, setPngSalt] = useState(true);
  const [jitterEpsilon, setJitterEpsilon] = useState(0.00002);

  // Uniqueification output cache
  const [uniqueifiedResult, setUniqueifiedResult] = useState<{
    obj: string;
    objText: string;
    texture: string;
    hash?: string;
    originalHash?: string;
    applied: string[];
    mutatedZipUrl?: string;
    mutatedObjUrl?: string;
    mutatedTextureUrl?: string;
    mutatedRbxmxUrl?: string;
  } | null>(null);
  const [uniqueifying, setUniqueifying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedOwnership, setClaimedOwnership] = useState<{
    meshId: number | string;
    textureId: number | string;
    rbxmxUrl: string;
    zipUrl: string;
    message: string;
  } | null>(null);

  // Queuing & Other state
  const [queuing, setQueuing] = useState(false);
  const [queuedJob, setQueuedJob] = useState<UploadJob | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [seoModalOpen, setSeoModalOpen] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("farol_ugc_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load upload groups on mount
  useEffect(() => {
    fetchUploads()
      .then((b) => {
        setBoard(b);
        if (b.lastGroupId && b.groups.some((g) => g.id === b.lastGroupId)) {
          setTargetGroupId(String(b.lastGroupId));
        } else if (b.groups.length > 0) {
          const firstCanPost = b.groups.find((g) => g.canPost) || b.groups[0];
          setTargetGroupId(String(firstCanPost.id));
        }
      })
      .catch(() => {});
  }, []);

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
    setStatus("fetching");
    setUniqueifiedResult(null);
    setQueuedJob(null);

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
      setNameOverride(res.name || "");
      setPriceOverride(res.price && res.price > 0 ? res.price : 75);
      setDescription(
        res.description ||
          `${res.name} — High quality UGC accessory recreated for the community.`
      );

      // Set accessory type if detected
      if (res.type && res.type !== "UGC" && res.type !== "Item") {
        const found = ACCESSORY_TYPES.find(
          (t) => t.toLowerCase() === res.type.toLowerCase()
        );
        setAccessoryType(found || "Auto-detect from source");
      } else {
        setAccessoryType("Auto-detect from source");
      }

      setStatus("ready");
      saveToHistory(res);
      toastManager.success(
        "Asset Carregado!",
        `"${res.name || "Item"}" pronto para clonagem e publicação.`
      );
    } catch (err: any) {
      const errorMsg = err?.message || "Erro inesperado ao copiar o item UGC.";
      setError(errorMsg);
      setStatus("error");
      toastManager.error("Falha ao Extrair Asset", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const executeUniqueify = async () => {
    if (!result) return null;
    const objFile = result.files.find((f) => f.type === "obj");
    const texFile = result.files.find((f) => f.type === "texture");

    if (!objFile) {
      toastManager.error("Erro", "Arquivo OBJ não encontrado no asset.");
      return null;
    }

    setUniqueifying(true);
    try {
      const readUrlAsText = async (url: string) => {
        const r = await fetch(url);
        return r.text();
      };
      const readUrlAsBase64 = async (url: string) => {
        const r = await fetch(url);
        const b = await r.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(b);
        });
      };

      const objData = await readUrlAsText(objFile.url);
      const texData = currentTextureUrl
        ? currentTextureUrl.startsWith("data:")
          ? currentTextureUrl
          : await readUrlAsBase64(currentTextureUrl)
        : texFile
        ? await readUrlAsBase64(texFile.url)
        : "";

      const uRes = await uniqueifyUgcAsset({
        obj: objData,
        texture: texData,
        config: {
          uvRotation,
          faceShuffle,
          vertexJitter,
          pngSalt,
          jitterEpsilon,
        },
        assetId: result.assetId,
      });

      if (uRes.success) {
        setUniqueifiedResult(uRes);
        setCurrentTextureUrl(uRes.texture);
        toastManager.success(
          "Anti-Ban Aplicado!",
          `Hash SHA-256 e vértices modificados: ${uRes.applied.join(", ")}`
        );
        return uRes;
      }
    } catch (err: any) {
      toastManager.error("Erro no Uniqueifier", err.message || "Falha ao aplicar modificações.");
    } finally {
      setUniqueifying(false);
    }
    return null;
  };

  // Auto-run uniqueifier on changes for 3D items
  useEffect(() => {
    if (result && !result.isClothing && result.files.some((f) => f.type === "obj")) {
      const timer = setTimeout(() => {
        executeUniqueify();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [result, uvRotation, faceShuffle, vertexJitter, pngSalt, jitterEpsilon]);

  const handleAddToQueue = async () => {
    if (!result) {
      toastManager.error("Aviso", "Extraia um item UGC primeiro.");
      return;
    }

    setQueuing(true);
    setStatus("queuing");
    setError(null);

    try {
      const cleanName = (nameOverride.trim() || result.name).slice(0, 50);
      const cleanDesc = (
        description.trim() ||
        `${cleanName} — UGC Accessory.`
      ).slice(0, 500);

      // Check if 2D clothing
      if (result.isClothing) {
        const tex = currentTextureUrl || result.textureUrl;
        if (!tex) throw new Error("Textura do molde 2D não encontrada.");
        const isPants =
          result.type.toLowerCase().includes("calça") ||
          result.type.toLowerCase().includes("pants");

        const job = await queueUpload({
          name: cleanName,
          description: cleanDesc,
          kind: isPants ? "pants" : "shirt",
          price: priceOverride || 5,
          groupId: targetGroupId ? Number(targetGroupId) : null,
          fileName: `${cleanName.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`,
          image: tex,
        });

        setQueuedJob(job);
        setStatus("queued");
        toastManager.success(
          "Roupa Adicionada à Fila!",
          `"${cleanName}" agendada para publicação no grupo.`
        );
        return;
      }

      // 3D UGC Accessory flow
      const objFile = result.files.find((f) => f.type === "obj");
      const texFile = result.files.find((f) => f.type === "texture");

      if (!objFile) {
        throw new Error("Malha .OBJ não encontrada no item copiado.");
      }

      const hasUniqueification = uvRotation || faceShuffle || vertexJitter || pngSalt;
      let finalMeshB64 = "";
      let finalTexB64 = "";

      if (hasUniqueification) {
        let uRes = uniqueifiedResult;
        if (!uRes) {
          uRes = await executeUniqueify();
        }
        if (uRes && uRes.success) {
          finalMeshB64 = uRes.obj;
          finalTexB64 = uRes.texture;
        }
      }

      if (!finalMeshB64 || !finalTexB64) {
        // Fallback to source raw files
        const readUrlAsBase64 = async (url: string) => {
          const r = await fetch(url);
          const b = await r.blob();
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(b);
          });
        };

        finalMeshB64 = await readUrlAsBase64(objFile.url);
        finalTexB64 = currentTextureUrl
          ? currentTextureUrl.startsWith("data:")
            ? currentTextureUrl
            : await readUrlAsBase64(currentTextureUrl)
          : texFile
          ? await readUrlAsBase64(texFile.url)
          : "";
      }

      const targetType =
        accessoryType === "Auto-detect from source" ? result.type : accessoryType;

      const job = await queueUgcAccessory({
        name: cleanName,
        description: cleanDesc,
        groupId: targetGroupId ? Number(targetGroupId) : null,
        mesh: finalMeshB64,
        meshName: `${cleanName.replace(/[^a-zA-Z0-9_-]/g, "_")}.obj`,
        texture: finalTexB64,
        textureName: `${cleanName.replace(/[^a-zA-Z0-9_-]/g, "_")}_unique.png`,
        accessoryType: targetType,
        priceInRobux: priceOverride,
        meshId: claimedOwnership?.meshId || null,
        textureId: claimedOwnership?.textureId || null,
      });

      setQueuedJob(job);
      setStatus("queued");
      toastManager.success(
        "UGC Adicionado à Fila!",
        `"${cleanName}" adicionado à fila de publicação com Anti-Ban ativo.`
      );
    } catch (err: any) {
      setStatus("error");
      const msg = err?.message || "Falha ao adicionar à fila de upload.";
      setError(msg);
      toastManager.error("Erro na Fila", msg);
    } finally {
      setQueuing(false);
    }
  };

  const handleClaimOwnership = async () => {
    if (!result) return;
    setClaiming(true);
    try {
      let uRes = uniqueifiedResult;
      if (!uRes) {
        uRes = await executeUniqueify();
      }
      const targetType =
        accessoryType === "Auto-detect from source" ? result.type : accessoryType;
      const cleanName = (nameOverride || result.name || "Asset").replace(/[^a-zA-Z0-9_-]/g, "_");

      const claimRes = await claimAssetOwnership({
        assetId: result.assetId,
        groupId: targetGroupId ? Number(targetGroupId) : null,
        name: cleanName,
        accessoryType: targetType,
      });

      setClaimedOwnership(claimRes);
      if (uniqueifiedResult) {
        setUniqueifiedResult({
          ...uniqueifiedResult,
          mutatedRbxmxUrl: claimRes.rbxmxUrl,
          mutatedZipUrl: claimRes.zipUrl,
        });
      }

      toastManager.success(
        "Assets Registrados com Sucesso!",
        `Mesh: ${claimRes.meshId} • Textura: ${claimRes.textureId}. O arquivo .RBXMX foi baixado e agora é 100% seu para publicar no site!`
      );

      const a = document.createElement("a");
      a.href = claimRes.rbxmxUrl;
      a.download = `${cleanName}_studio.rbxmx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toastManager.error("Erro no Registro de Propriedade", err?.message || "Falha ao registrar assets.");
    } finally {
      setClaiming(false);
    }
  };

  const downloadMutatedZip = async () => {
    let uRes = uniqueifiedResult;
    if (!uRes?.mutatedZipUrl) {
      uRes = await executeUniqueify();
    }
    const targetUrl = uRes?.mutatedZipUrl || result?.zipUrl;
    if (targetUrl) {
      const a = document.createElement("a");
      a.href = targetUrl;
      const cleanName = (nameOverride || result?.name || "Asset").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${cleanName}_mutated.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toastManager.success("Download Iniciado", "Baixando pacote UGC com mutação anti-ban.");
    } else {
      toastManager.error("Erro", "Não foi possível gerar o pacote mutado.");
    }
  };

  const downloadMutatedRbxmx = async () => {
    let uRes = uniqueifiedResult;
    if (!uRes?.mutatedRbxmxUrl) {
      uRes = await executeUniqueify();
    }
    const targetUrl = uRes?.mutatedRbxmxUrl || result?.files.find((f) => f.type === "rbxmx")?.url;
    if (targetUrl) {
      const a = document.createElement("a");
      a.href = targetUrl;
      const cleanName = (nameOverride || result?.name || "Asset").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${cleanName}_studio.rbxmx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toastManager.success("Download Concluído", "Arquivo .RBXMX Studio-Ready baixado.");
    } else {
      toastManager.error("Aviso", "Arquivo .RBXMX não disponível.");
    }
  };

  const downloadMutatedObj = async () => {
    let uRes = uniqueifiedResult;
    if (!uRes?.mutatedObjUrl && !uRes?.obj) {
      uRes = await executeUniqueify();
    }
    const targetUrl = uRes?.mutatedObjUrl || uRes?.obj || result?.files.find((f) => f.type === "obj")?.url;
    if (targetUrl) {
      const a = document.createElement("a");
      a.href = targetUrl;
      const cleanName = (nameOverride || result?.name || "Asset").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${cleanName}_mutated.obj`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toastManager.success("Download Concluído", "Malha 3D (.OBJ) com mutação anti-ban baixada.");
    } else {
      toastManager.error("Aviso", "Arquivo .OBJ não disponível.");
    }
  };

  const downloadMutatedTexture = async () => {
    let uRes = uniqueifiedResult;
    if (!uRes?.mutatedTextureUrl && !uRes?.texture) {
      uRes = await executeUniqueify();
    }
    const targetUrl = uRes?.mutatedTextureUrl || uRes?.texture || currentTextureUrl || result?.textureUrl;
    if (targetUrl) {
      const a = document.createElement("a");
      a.href = targetUrl;
      const cleanName = (nameOverride || result?.name || "Asset").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${cleanName}_texture_mutated.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toastManager.success("Download Concluído", "Textura PNG com rotação 90° e hash único baixada.");
    } else {
      toastManager.error("Aviso", "Textura não disponível.");
    }
  };

  const downloadOriginalZip = () => {
    if (!result?.zipUrl) return;
    const a = document.createElement("a");
    a.href = result.zipUrl;
    const cleanName = (nameOverride || result.name).replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `${cleanName}_original.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Status indicator styling
  const statusColor =
    status === "fetching" || loading
      ? "bg-amber-400 animate-pulse"
      : status === "queuing" || queuing
      ? "bg-blue-400 animate-pulse"
      : status === "queued"
      ? "bg-emerald-400"
      : status === "error"
      ? "bg-rose-500"
      : status === "ready"
      ? "bg-[#d96b52]"
      : "bg-white/30";

  const statusLabel =
    status === "fetching" || loading
      ? "FETCHING..."
      : status === "queuing" || queuing
      ? "QUEUING..."
      : status === "queued"
      ? "QUEUED"
      : status === "error"
      ? "ERROR"
      : status === "ready"
      ? "READY"
      : "IDLE";

  return (
    <div className="min-h-screen bg-[#0d0c0b] text-[#eae0d5] p-5 lg:p-8 max-w-6xl mx-auto space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#26221f] pb-5">
        <div>
          <h1 className="text-3xl lg:text-4xl font-serif italic text-[#ede8e1] tracking-tight">
            UGC Cloner
          </h1>
          <p className="text-xs text-[#9a9186] font-mono mt-1">
            Clone, uniqueify, and re-publish UGC catalog assets to your group.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#161413] border border-[#2b2622] font-mono text-xs">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-[#d5cec6] uppercase tracking-wider font-semibold">
              {statusLabel}
            </span>
          </div>

          {/* Claim Ownership / Prepare for Site Button */}
          {result && !result.isClothing && (
            <button
              type="button"
              onClick={handleClaimOwnership}
              disabled={claiming || loading}
              className="h-9 px-4 rounded-md bg-[#162033] hover:bg-[#1e293b] active:bg-[#0f172a] border border-blue-500/40 text-blue-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
              title="Registra a textura e a malha no seu grupo para que o .rbxmx seja 100% seu e não dê erro de propriedade no site do Roblox"
            >
              {claiming ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Sincronizar Propriedade (Site)</span>
                </>
              )}
            </button>
          )}

          {/* Primary Action Button: ADD TO QUEUE */}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={!result || queuing || loading}
            className="h-9 px-5 rounded-md bg-[#d96b52] hover:bg-[#e0755d] active:bg-[#c25941] disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-bold uppercase tracking-widest transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            {queuing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Queuing...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 2-Column Section: SOURCE ASSET | PUBLISH TARGET */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: SOURCE ASSET */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d96b52]" />
            <span className="font-mono text-xs text-[#9c948a] uppercase tracking-widest font-semibold">
              Source Asset
            </span>
          </div>

          {/* Input field + FETCH button */}
          <div className="rounded-xl bg-[#141211] border border-[#292421] p-4 space-y-3 shadow-lg">
            <div>
              <label className="block font-mono text-[10px] text-[#8a8277] uppercase tracking-wider mb-1.5">
                Catalog URL or Asset ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleRip()}
                  placeholder="https://www.roblox.com/catalog/... or asset ID"
                  className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs placeholder:text-[#635c54] focus:outline-none focus:border-[#d96b52] transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleRip()}
                  disabled={loading}
                  className="h-[38px] px-4 rounded-lg bg-[#1c1917] hover:bg-[#292421] active:bg-[#161413] border border-[#3a3430] text-[#eae0d5] font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#d96b52]" />
                  ) : null}
                  <span>Fetch</span>
                </button>
              </div>
            </div>

            {/* Optional Cookie Accordion */}
            <div className="pt-2 border-t border-[#231f1c]">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-[#736b63] hover:text-[#a0978d] transition-colors cursor-pointer"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>Advanced Cookie (.ROBLOSECURITY)</span>
              </button>

              {showAdvanced && (
                <div className="mt-2 space-y-1.5">
                  <input
                    type="password"
                    value={customCookie}
                    onChange={(e) => setCustomCookie(e.target.value)}
                    placeholder="_|WARNING:-DO-NOT-SHARE-THIS..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0e0d0c] border border-[#26221f] text-xs font-mono text-white placeholder:text-[#524c45] focus:outline-none focus:border-[#d96b52]"
                  />
                  <p className="text-[10px] text-[#736b63] font-mono">
                    Uses your connected Roblox account by default. Only paste if using an alternate account.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="rounded-xl bg-rose-950/30 border border-rose-800/40 p-3.5 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Fetched Asset Details Card */}
          {result && (
            <div className="rounded-xl bg-[#141211] border border-[#292421] p-4 space-y-4 shadow-lg">
              <div className="flex items-start gap-4">
                {/* Square Thumbnail */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-[#0a0908] border border-[#2e2925] overflow-hidden shrink-0 flex items-center justify-center">
                  {result.thumbnailUrl ? (
                    <img
                      src={result.thumbnailUrl}
                      alt={result.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Box className="w-8 h-8 text-[#575048]" />
                  )}
                </div>

                {/* Info & Badges */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-base font-semibold text-[#f0ece6] leading-tight line-clamp-2">
                    {result.name}
                  </div>

                  <div className="font-mono text-[11px] text-[#d96b52] flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 bg-[#d96b52]" />
                    <span className="uppercase tracking-wider font-semibold">
                      {result.type || "ACCESSORY"} by {result.creator}
                    </span>
                  </div>

                  {/* 4 Metadata Values */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-[#24201d] text-[11px] font-mono">
                    <div className="text-[#7d756c]">
                      Asset ID:{" "}
                      <span className="text-[#ded8d0] font-bold">{result.assetId}</span>
                    </div>
                    <div className="text-[#7d756c]">
                      Price:{" "}
                      <span className="text-[#ded8d0] font-bold">
                        {result.price && result.price > 0
                          ? `${result.price} R$`
                          : "Off-sale"}
                      </span>
                    </div>
                    <div className="text-[#7d756c] truncate">
                      MeshId:{" "}
                      <span className="text-[#ded8d0] font-bold">
                        {result.meshId || result.assetId}
                      </span>
                    </div>
                    <div className="text-[#7d756c] truncate">
                      TextureId:{" "}
                      <span className="text-[#ded8d0] font-bold">
                        {result.textureId || "Embedded"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3D Clothing Avatar Preview if 2D clothing */}
              {result.isClothing && currentTextureUrl && (
                <div className="rounded-lg border border-[#28231f] bg-[#0a0908] p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#91877b]">
                    <span>Official Roblox Avatar (R6 / R15)</span>
                    <span className="text-[#d96b52]">585×559 UV</span>
                  </div>
                  <RobloxAvatar3D
                    templateDataUrl={currentTextureUrl}
                    kind={
                      result.type.toLowerCase().includes("calça") ||
                      result.type.toLowerCase().includes("pants")
                        ? "pants"
                        : "shirt"
                    }
                    title={result.name}
                    className="w-full h-[280px]"
                  />
                </div>
              )}

              {/* Action Buttons in Source Card */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#231f1c]">
                {result.files.some((f) => f.type === "rbxmx") && (
                  <button
                    type="button"
                    onClick={downloadMutatedRbxmx}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#d96b52]" />
                    <span>.RBXMX Studio-Ready</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={downloadMutatedZip}
                  className="px-3 py-1.5 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3 text-[#d96b52]" />
                  <span>.ZIP Mutado (Anti-Ban)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSeoModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Optimize SEO</span>
                </button>

                <a
                  href={`https://www.roblox.com/catalog/${result.assetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#91877b] hover:text-[#eae0d5] flex items-center gap-1.5 transition-colors ml-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Roblox</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: PUBLISH TARGET */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d96b52]" />
            <span className="font-mono text-xs text-[#9c948a] uppercase tracking-widest font-semibold">
              Publish Target
            </span>
          </div>

          <div className="rounded-xl bg-[#141211] border border-[#292421] p-4 space-y-4 shadow-lg">
            {/* Target Group ID */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10px] text-[#8a8277] uppercase tracking-wider">
                  Target Group ID
                </label>
                <button
                  type="button"
                  onClick={() => setCustomGroupIdInput(!customGroupIdInput)}
                  className="text-[10px] font-mono text-[#d96b52] hover:underline cursor-pointer"
                >
                  {customGroupIdInput ? "Select from list" : "Type manual ID"}
                </button>
              </div>

              {customGroupIdInput ? (
                <input
                  type="number"
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs focus:outline-none focus:border-[#d96b52]"
                />
              ) : (
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs focus:outline-none focus:border-[#d96b52] cursor-pointer"
                >
                  <option value="">Nenhum (Upload Pessoal / Sem Grupo)</option>
                  {board?.groups && board.groups.length > 0 ? (
                    board.groups.map((group) => (
                      <option key={group.id} value={String(group.id)}>
                        {group.name} ({group.id}) {group.canPost ? "— [Can Post]" : ""}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Nenhum grupo encontrado (conecte a conta em Account)
                    </option>
                  )}
                </select>
              )}
            </div>

            {/* Name Override */}
            <div>
              <label className="block font-mono text-[10px] text-[#8a8277] uppercase tracking-wider mb-1.5">
                Name Override
              </label>
              <input
                type="text"
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                maxLength={50}
                placeholder="Item name on Roblox"
                className="w-full px-3.5 py-2 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs focus:outline-none focus:border-[#d96b52]"
              />
            </div>

            {/* Price & Accessory Type Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-[#8a8277] uppercase tracking-wider mb-1.5">
                  Price (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs focus:outline-none focus:border-[#d96b52]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] text-[#8a8277] uppercase tracking-wider mb-1.5">
                  Accessory Type
                </label>
                <select
                  value={accessoryType}
                  onChange={(e) => setAccessoryType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs focus:outline-none focus:border-[#d96b52] cursor-pointer"
                >
                  {ACCESSORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[10px] text-[#8a8277] uppercase tracking-wider">
                  Description
                </label>
                <span className="text-[10px] font-mono text-[#6e665d]">
                  {description.length}/500
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Description shown on Roblox item page..."
                className="w-full px-3.5 py-2 rounded-lg bg-[#0e0d0c] border border-[#2c2724] text-white font-mono text-xs focus:outline-none focus:border-[#d96b52] resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: UNIQUEIFICATION */}
      <div className="space-y-4">
        {/* Header line matching media_1789766963519.png */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d96b52] inline-block shadow-[0_0_8px_rgba(217,107,82,0.6)]" />
            <span className="font-mono text-xs text-[#ede8e1] uppercase tracking-widest font-bold">
              UNIQUEIFICATION
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#8a8277]">
            Apply non-destructive algorithmic modifications to avoid duplicate mesh/texture hash detection.
          </span>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: UV & TEXTURE ROTATION */}
          <div
            onClick={() => setUvRotation(!uvRotation)}
            className={`rounded-xl border p-4 transition-all cursor-pointer select-none flex flex-col justify-between min-h-[145px] ${
              uvRotation
                ? "bg-[#161210] border-[#4a2e26] ring-1 ring-[#d96b52]/30 shadow-md"
                : "bg-[#120f0e] border-[#26201b] opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-xs font-bold text-[#ede8e1] tracking-wider uppercase">
                UV &amp; TEXTURE ROTATION
              </div>
              <div
                className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  uvRotation ? "bg-[#d96b52]" : "border border-[#38312a] bg-[#1a1715]"
                }`}
              >
                {uvRotation && (
                  <svg className="w-3 h-3 stroke-white stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className="text-[11px] text-[#91877b] leading-relaxed my-2">
              Rotação 90° e remapeamento UV (desativado por padrão para preservar alinhamento da textura oficial)
            </div>
            <div className="pt-1 flex items-center justify-between font-mono text-[10px]">
              <span className="text-[#d96b52] font-semibold">[90° CW]</span>
              <span className="text-[#6e665d]">Re-maps UV coords</span>
            </div>
          </div>

          {/* Card 2: FACE SHUFFLE */}
          <div
            onClick={() => setFaceShuffle(!faceShuffle)}
            className={`rounded-xl border p-4 transition-all cursor-pointer select-none flex flex-col justify-between min-h-[145px] ${
              faceShuffle
                ? "bg-[#161210] border-[#4a2e26] ring-1 ring-[#d96b52]/30 shadow-md"
                : "bg-[#120f0e] border-[#26201b] opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-xs font-bold text-[#ede8e1] tracking-wider uppercase">
                FACE SHUFFLE
              </div>
              <div
                className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  faceShuffle ? "bg-[#d96b52]" : "border border-[#38312a] bg-[#1a1715]"
                }`}
              >
                {faceShuffle && (
                  <svg className="w-3 h-3 stroke-white stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className="text-[11px] text-[#91877b] leading-relaxed my-2">
              Permutes triangle order
            </div>
            <div className="pt-1 flex items-center justify-between font-mono text-[10px]">
              <span className="text-[#d96b52] font-semibold">[PRNG]</span>
              <span className="text-[#6e665d]">Geometry unchanged</span>
            </div>
          </div>

          {/* Card 3: VERTEX MICRO-JITTER */}
          <div
            onClick={() => setVertexJitter(!vertexJitter)}
            className={`rounded-xl border p-4 transition-all cursor-pointer select-none flex flex-col justify-between min-h-[145px] ${
              vertexJitter
                ? "bg-[#161210] border-[#4a2e26] ring-1 ring-[#d96b52]/30 shadow-md"
                : "bg-[#120f0e] border-[#26201b] opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-xs font-bold text-[#ede8e1] tracking-wider uppercase">
                VERTEX MICRO-JITTER
              </div>
              <div
                className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  vertexJitter ? "bg-[#d96b52]" : "border border-[#38312a] bg-[#1a1715]"
                }`}
              >
                {vertexJitter && (
                  <svg className="w-3 h-3 stroke-white stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className="text-[11px] text-[#91877b] leading-relaxed my-2">
              Sub-micron noise on vertex coordinates
            </div>
            <div className="pt-1 flex items-center justify-between font-mono text-[10px]">
              <span className="text-[#d96b52] font-semibold">[±EPSILON]</span>
              <span className="text-[#6e665d]">Changes vertex stream</span>
            </div>
          </div>

          {/* Card 4: PNG CHUNK SALT */}
          <div
            onClick={() => setPngSalt(!pngSalt)}
            className={`rounded-xl border p-4 transition-all cursor-pointer select-none flex flex-col justify-between min-h-[145px] ${
              pngSalt
                ? "bg-[#161210] border-[#4a2e26] ring-1 ring-[#d96b52]/30 shadow-md"
                : "bg-[#120f0e] border-[#26201b] opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-xs font-bold text-[#ede8e1] tracking-wider uppercase">
                PNG CHUNK SALT
              </div>
              <div
                className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  pngSalt ? "bg-[#d96b52]" : "border border-[#38312a] bg-[#1a1715]"
                }`}
              >
                {pngSalt && (
                  <svg className="w-3 h-3 stroke-white stroke-[2.5]" viewBox="0 0 24 24" fill="none">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div className="text-[11px] text-[#91877b] leading-relaxed my-2">
              Injects random private chunk &amp; LSB noise for unique file hash
            </div>
            <div className="pt-1 flex items-center justify-between font-mono text-[10px]">
              <span className="text-[#d96b52] font-semibold">[SHA-256]</span>
              <span className="text-[#6e665d]">Unique binary hash</span>
            </div>
          </div>
        </div>

        {/* Jitter Epsilon Slider Box (when vertexJitter is active) */}
        {vertexJitter && (
          <div className="rounded-xl bg-[#141211] border border-[#292421] p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs font-bold uppercase tracking-wider text-[#ded8d0]">
                JITTER EPSILON
              </label>
              <div className="px-3 py-1 rounded bg-[#1c1917] border border-[#332c26] font-mono text-xs text-[#d96b52] font-bold">
                {jitterEpsilon.toFixed(6)}
              </div>
            </div>

            <input
              type="range"
              min={0.000005}
              max={0.0001}
              step={0.000005}
              value={jitterEpsilon}
              onChange={(e) => setJitterEpsilon(parseFloat(e.target.value))}
              className="w-full accent-[#d96b52] cursor-pointer"
            />

            <p className="text-[11px] text-[#7d756c] font-mono leading-relaxed">
              Controls the maximum displacement applied to vertex positions. Small values preserve visual fidelity while completely changing the vertex binary stream.
            </p>
          </div>
        )}

        {/* Uniqueification Results & Download Suite */}
        {result && (
          <div className="rounded-xl bg-[#141211] border border-[#292421] p-4 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-mono text-xs font-bold text-[#ede8e1] uppercase tracking-wider flex items-center gap-2">
                    <span>Status Anti-Ban: {uniqueifiedResult ? "Mutado & Protegido" : "Pronto para Mutação"}</span>
                    {uniqueifying && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#d96b52]" />}
                  </div>
                  <div className="text-[11px] text-[#91877b] font-mono">
                    {uniqueifiedResult?.applied?.length
                      ? `Algoritmos ativos: ${uniqueifiedResult.applied.join(" • ")}`
                      : "Selecione as opções de uniqueification acima para gerar hash exclusivo."}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={executeUniqueify}
                disabled={uniqueifying}
                className="px-3.5 py-1.5 rounded-lg bg-[#1e1a17] hover:bg-[#2c2420] border border-[#3d322b] text-xs font-mono text-[#d96b52] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{uniqueifying ? "Calculando..." : "Regerar Mutação"}</span>
              </button>
            </div>

            {/* Hash Comparison */}
            {uniqueifiedResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#231f1c] font-mono text-[11px]">
                <div className="p-2.5 rounded-lg bg-[#0e0d0c] border border-[#26221f] space-y-1">
                  <div className="text-[#7d756c] text-[10px] uppercase tracking-wider">Hash SHA-256 Original</div>
                  <div className="text-[#a89f91] truncate font-bold">
                    {uniqueifiedResult.originalHash || "Original Roblox Hash"}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141d14] border border-[#264426] space-y-1">
                  <div className="text-emerald-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <span>Hash SHA-256 Mutado (Único)</span>
                    <Check className="w-3 h-3" />
                  </div>
                  <div className="text-emerald-300 truncate font-bold">
                    {uniqueifiedResult.hash || "Novo Hash Gerado"}
                  </div>
                </div>
              </div>
            )}

            {/* DOWNLOAD BUTTONS */}
            <div className="pt-3 border-t border-[#231f1c] flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadMutatedZip}
                className="px-4 py-2 rounded-lg bg-[#d96b52] hover:bg-[#c45a42] text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar UGC Mutado (.ZIP Anti-Ban)</span>
              </button>

              <button
                type="button"
                onClick={downloadMutatedRbxmx}
                className="px-3.5 py-2 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-[#d96b52]" />
                <span>.RBXMX Studio-Ready</span>
              </button>

              <button
                type="button"
                onClick={downloadMutatedObj}
                className="px-3 py-2 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Box className="w-3.5 h-3.5 text-amber-400" />
                <span>.OBJ Mutado</span>
              </button>

              <button
                type="button"
                onClick={downloadMutatedTexture}
                className="px-3 py-2 rounded-lg bg-[#1a1715] hover:bg-[#26211e] border border-[#332c26] text-xs font-mono text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Textura .PNG</span>
              </button>

              <button
                type="button"
                onClick={downloadOriginalZip}
                className="px-3 py-2 rounded-lg bg-[#141211] hover:bg-[#1f1b18] border border-[#2b2521] text-xs font-mono text-[#8a8277] hover:text-[#ded8d0] flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Original (.ZIP)</span>
              </button>
            </div>

            {/* Direct Roblox Creator Dashboard (Site) Upload Ready Card */}
            {!result.isClothing && (
              <div className="pt-3.5 border-t border-[#231f1c] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span className="font-mono text-xs font-bold text-blue-300 uppercase tracking-wider">
                      Publicar no Site do Roblox (Creator Dashboard)
                    </span>
                  </div>
                  {claimedOwnership && (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-bold">
                      Assets Vinculados [100% Livre de Erro]
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[#91877b] font-mono leading-relaxed">
                  Para publicar em <strong>create.roblox.com &rarr; Itens de avatar</strong> sem o erro{" "}
                  <code className="text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/30">
                    Make sure all assets are owned by the current user
                  </code>
                  , clique abaixo. O Farol envia a malha e a textura direto pela API para a sua conta/grupo e atualiza o <code className="text-blue-300 font-bold">.rbxmx</code> com IDs legítimos.
                </p>

                {claimedOwnership ? (
                  <div className="p-3.5 rounded-lg bg-[#0e1626] border border-blue-500/30 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[#8a99b5]">Mesh ID Próprio:</span>{" "}
                        <span className="text-white font-bold">{claimedOwnership.meshId}</span>{" "}
                        <span className="text-emerald-400 font-semibold">[Aprovado]</span>
                      </div>
                      <div>
                        <span className="text-[#8a99b5]">Texture ID Próprio:</span>{" "}
                        <span className="text-white font-bold">{claimedOwnership.textureId}</span>{" "}
                        <span className="text-emerald-400 font-semibold">[Aprovado]</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-900/40">
                      <a
                        href={claimedOwnership.rbxmxUrl}
                        download={`${(nameOverride || result.name || "Asset").replace(/[^a-zA-Z0-9_-]/g, "_")}_studio.rbxmx`}
                        className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar .RBXMX Pronto p/ o Site (Livre de Erro)</span>
                      </a>
                      <span className="text-[11px] text-emerald-300 font-mono">
                        &larr; Envie este arquivo no Creator Dashboard!
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaimOwnership}
                    disabled={claiming}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#162033] hover:bg-[#1e293b] active:bg-[#0f172a] border border-blue-500/40 text-blue-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {claiming ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                        <span>Registrando Textura e Malha no seu Grupo...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        <span>Registrar Propriedade dos Assets no Grupo (Evitar Erro no Site)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Studio Texture Guide Card */}
        {result && !result.isClothing && (
          <div className="rounded-xl bg-[#0e1219] border border-[#1d273d] p-4 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                <span className="font-mono text-xs font-bold text-sky-300 uppercase tracking-wider">
                  Como usar no Roblox Studio (Evitar Modelo Branco)
                </span>
              </div>
              {result.textureId && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`rbxassetid://${result.textureId}`);
                    toastManager.success("Copiado!", `rbxassetid://${result.textureId} copiado.`);
                  }}
                  className="px-2.5 py-1 rounded bg-[#171e30] hover:bg-[#222d47] border border-[#2a3a5e] text-[10px] font-mono text-sky-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copiar Texture ID: {result.textureId}</span>
                </button>
              )}
            </div>
            <div className="text-[11px] text-[#93a2bd] leading-relaxed space-y-1">
              <p>
                &bull; <strong>Modo 1 (Recomendado):</strong> Arraste o arquivo <code className="text-sky-300 font-mono">.rbxmx</code> direto para a janela do Roblox Studio. Ele já vem configurado como Accessory oficial com textura carregada!
              </p>
              <p>
                &bull; <strong>Modo 2 (Ao importar .OBJ):</strong> Arquivos .OBJ não salvam imagem internamente. No Studio, selecione a MeshPart &rarr; Propriedades &rarr; campo <code className="text-sky-300 font-mono">TextureID</code> &rarr; clique em <strong>Add Image...</strong> e escolha o arquivo <code className="text-sky-300 font-mono">texture_mutated.png</code> da pasta.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Queued Job Notification Banner */}
      {queuedJob && (
        <div className="rounded-xl bg-emerald-950/30 border border-emerald-800/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-300">
                Item UGC enfileirado com sucesso!
              </div>
              <div className="text-xs text-emerald-200/70 font-mono">
                Job ID: {queuedJob.id} &bull; Status: {queuedJob.status.toUpperCase()} &bull; Grupo: {queuedJob.groupId || "Pessoal"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/painel/upload")}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
          >
            <span>Ver na Fila</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* History Section: RECENTLY CLONED */}
      {history.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-[#26221f]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#d96b52]" />
              <span className="font-mono text-xs text-[#9c948a] uppercase tracking-widest font-semibold">
                Recently Cloned ({history.length})
              </span>
            </div>
            <button
              type="button"
              onClick={clearHistory}
              className="text-[11px] font-mono text-[#6e665d] hover:text-rose-400 transition-colors cursor-pointer"
            >
              Clear History
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {history.map((item) => (
              <div
                key={item.assetId}
                className="rounded-xl bg-[#141211] border border-[#292421] p-3 hover:border-[#3d3630] transition-all flex items-center gap-3 group"
              >
                <div className="w-12 h-12 rounded-lg bg-[#0a0908] border border-[#2b2622] overflow-hidden shrink-0 flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Box className="w-5 h-5 text-[#544d45]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#f0ece6] truncate group-hover:text-[#d96b52] transition-colors">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-[#7a7268] truncate font-mono">
                    {item.creator}
                  </div>
                  <div className="text-[9px] text-[#d96b52] font-mono mt-0.5 uppercase">
                    {item.type}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInputVal(item.assetId);
                    handleRip(item.assetId);
                  }}
                  title="Recarregar este item"
                  className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-[#292421] border border-[#332c26] text-[#eae0d5] transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEO Optimization Modal */}
      {result && (
        <SeoOptimizationModal
          isOpen={seoModalOpen}
          onClose={() => setSeoModalOpen(false)}
          assetId={result.assetId}
          imageUrl={result.thumbnailUrl}
          currentTitle={nameOverride || result.name}
          itemType={accessoryType === "Auto-detect from source" ? result.type : accessoryType}
          onApply={(d) => {
            setNameOverride(d.title);
            setDescription(d.description);
          }}
        />
      )}
    </div>
  );
}
