import React, { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { DotButton } from "../components/ui/DotButton";
import { toastManager } from "../components/ui/toast";
import {
  deleteUpload,
  fetchAccount,
  fetchUploads,
  lookupGroupStore,
  prepareUgcAccessory,
  prepareUpload,
  queueUgcAccessory,
  queueUpload,
  retryUpload,
  uploadFileHref,
  type AssetLook,
  type ClothingKind,
  type GroupStore,
  type UploadBoard,
  type PreFlightReport,
} from "../lib/api";
import { ItemThumb } from "../components/ItemThumb";
import {
  ShoppingBag,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Copy,
  Layers,
  Trash2,
  Plus,
  Sparkles,
  Box,
  AlertTriangle,
  ShieldCheck,
  Wand2,
  Calculator,
  Coins,
  Check,
  ArrowRight,
  TrendingUp,
  Download,
} from "lucide-react";
import { SeoOptimizationModal } from "../components/SeoOptimizationModal";
import { renderAvatarPreview } from "../lib/ugcTemplate";
import { RobloxUgcViewer3D, type UgcMeshGeometry } from "../components/RobloxUgcViewer3D";
import { RobloxAvatar3D } from "../components/RobloxAvatar3D";
import { renderUgcMeshPreview } from "../lib/ugcMeshPreview";

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

const ATTACHMENT_MAP: Record<string, string> = {
  Hat: "HatAttachment",
  Hair: "HairAttachment",
  Face: "FaceFrontAttachment",
  Neck: "NeckAttachment",
  Shoulder: "RightCollarAttachment",
  Front: "BodyFrontAttachment",
  Back: "BodyBackAttachment",
  Waist: "WaistBackAttachment",
};

export function UploadPage() {
  const location = useLocation();
  const [board, setBoard] = useState<UploadBoard | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "upload" | "ugc" | "queue">("ugc");
  const [ugcMesh, setUgcMesh] = useState<{ file: File; data: string } | null>(null);
  const [ugcTexture, setUgcTexture] = useState<{ file: File; data: string } | null>(null);
  const [ugcMeshId, setUgcMeshId] = useState<string | number | null>(null);
  const [ugcTextureId, setUgcTextureId] = useState<string | number | null>(null);
  const [ugcPreview, setUgcPreview] = useState<string | null>(null);
  const [ugcGeometry, setUgcGeometry] = useState<UgcMeshGeometry | null>(null);
  const [ugcTextureUrl, setUgcTextureUrl] = useState<string | null>(null);
  const [ugcRbxmx, setUgcRbxmx] = useState<string | null>(null);
  const ugcFileInputRef = useRef<HTMLInputElement>(null);
  const [ugcType, setUgcType] = useState("Hat");
  const [ugcTriangles, setUgcTriangles] = useState<number | null>(null);
  const [ugcBusy, setUgcBusy] = useState(false);
  const [preFlight, setPreFlight] = useState<PreFlightReport | null>(null);
  const [autoRepairing, setAutoRepairing] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(500);
  const [ugcPrice, setUgcPrice] = useState(120);
  const [multiBodyView, setMultiBodyView] = useState<"classic" | "slender" | "rthro">("classic");
  const [catalogItems, setCatalogItems] = useState<AssetLook[]>([]);
  const [catalogStore, setCatalogStore] = useState<GroupStore | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [robloxConnected, setRobloxConnected] = useState<boolean | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ClothingKind>("shirt");
  const [price, setPrice] = useState(5);
  const [groupId, setGroupId] = useState("");
  const destinationInitialized = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mannequin, setMannequin] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
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
        if (!destinationInitialized.current) {
          const preferred = b.lastGroupId && b.groups.some((g) => g.id === b.lastGroupId)
            ? String(b.lastGroupId)
            : "";
          setGroupId(preferred);
          destinationInitialized.current = true;
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
    fetchAccount()
      .then((account) => setRobloxConnected(account.connected))
      .catch(() => setRobloxConnected(false));
  }, []);

  useEffect(() => {
    if (groupId) void loadCatalog();
  }, [groupId]);

  async function onFile(next: File | null) {
    setFile(next);
    setRawImage(null);
    setPreview(null);
    setMannequin(null);
    setError(null);
    if (!next) return;
    if (/\.(rbxm|rbxmx|rbxl|fbx|obj|mesh)$/i.test(next.name)) {
      setError("Arquivo 3D não publica neste fluxo. Envie PNG/JPEG da sua roupa clássica.");
      setFile(null);
      return;
    }
    setPreparing(true);
    try {
      const raw = await readFile(next);
      setRawImage(raw);
      const prepared = await prepareUpload({ image: raw, fileName: next.name });
      setKind(prepared.kind);
      setPreview(prepared.image);
      setPrice(prepared.suggestedPrice);
      if (!name.trim()) setName(prepared.suggestedName);
      if (!description.trim()) setDescription(`${prepared.suggestedName} — classic ${prepared.kind}.`);
      const pose = await renderAvatarPreview(prepared.image, prepared.kind);
      setMannequin(pose);
    } catch (err) {
      setFile(null);
      setRawImage(null);
      setError(err instanceof Error ? err.message : "Não foi possível preparar o template.");
    } finally {
      setPreparing(false);
    }
  }

  async function onKindChange(nextKind: ClothingKind) {
    setKind(nextKind);
    setPrice(nextKind === "tshirt" ? 0 : Math.max(5, price));
    if (!file || !rawImage) return;
    setPreparing(true);
    setError(null);
    try {
      const prepared = await prepareUpload({
        image: rawImage,
        fileName: file.name,
        kind: nextKind,
      });
      setPreview(prepared.image);
      setMannequin(await renderAvatarPreview(prepared.image, prepared.kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar o tipo da peça.");
    } finally {
      setPreparing(false);
    }
  }

  useEffect(() => {
    if (location.state) {
      const s = location.state as any;
      if (s.mode === "ugc" && s.mesh && s.texture) {
        setActiveTab("ugc");
        const m = { file: new File([], s.meshName || "model.obj"), data: s.mesh };
        const t = { file: new File([], s.textureName || "texture.png"), data: s.texture };
        setUgcMesh(m);
        setUgcTexture(t);
        if (s.name) setName(s.name);
        if (s.accessoryType) setUgcType(s.accessoryType);
        if (s.meshId || s.assetId) setUgcMeshId(s.meshId || s.assetId);
        if (s.textureId || s.assetId) setUgcTextureId(s.textureId || s.assetId);
        void refreshUgcPreview(m, t, s.accessoryType || ugcType);
      } else if (s.mode === "2d" && s.image) {
        setActiveTab("upload");
        setRawImage(s.image);
        setPreview(s.image);
        if (s.name) setName(s.name);
        if (s.kind) setKind(s.kind);
      }
    }
  }, [location.state]);

  async function refreshUgcPreview(
    mesh: { file: File; data: string },
    texture: { file: File; data: string },
    type = ugcType,
    autoRepair = false
  ) {
    setPreparing(true);
    setError(null);
    try {
      const prepared = await prepareUgcAccessory({
        mesh: mesh.data,
        meshName: mesh.file.name,
        texture: texture.data,
        textureName: texture.file.name,
        accessoryType: type,
        name,
        autoRepair,
      });
      setUgcType(prepared.accessoryType);
      setUgcTriangles(prepared.triangleCount || null);
      if (prepared.preFlight) {
        setPreFlight(prepared.preFlight);
      }
      if (prepared.rbxmx) {
        setUgcRbxmx(prepared.rbxmx);
      }
      if (!name.trim()) setName(prepared.suggestedName);
      if (!description.trim()) {
        setDescription(`${prepared.suggestedName} — UGC Accessory (${prepared.accessoryType}).`);
      }
      if (prepared.geometry) {
        setUgcGeometry(prepared.geometry);
      }
      if (prepared.texture) {
        setUgcTextureUrl(prepared.texture);
      } else if (texture.data) {
        setUgcTextureUrl(texture.data);
      }
      if (prepared.geometry && prepared.texture) {
        setUgcPreview(await renderUgcMeshPreview(prepared.geometry, prepared.texture));
      }
      if (autoRepair) {
        toastManager.success("Auto-Repair Aplicado", "Malha decimada para o teto de 4.000 triângulos e textura normalizada!");
      }
    } catch (err) {
      setUgcPreview(null);
      setUgcGeometry(null);
      setUgcTextureUrl(null);
      setUgcRbxmx(null);
      setError(err instanceof Error ? err.message : "Não foi possível montar o UGC.");
    } finally {
      setPreparing(false);
    }
  }

  function onDownloadAssembledRbxmx() {
    if (!ugcRbxmx) return;
    const blob = new Blob([ugcRbxmx], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (name || "accessory").replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `${safeName}.rbxmx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastManager.success("Download Concluído", "Accessory .rbxmx baixado! Abra no Roblox Studio para publicar.");
  }

  async function onAutoRepair() {
    if (!ugcMesh || !ugcTexture) return;
    setAutoRepairing(true);
    try {
      await refreshUgcPreview(ugcMesh, ugcTexture, ugcType, true);
    } finally {
      setAutoRepairing(false);
    }
  }

  async function onUgcFiles(list: FileList | File[] | null) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setError(null);
    let nextMesh = ugcMesh;
    let nextTexture = ugcTexture;
    let detectedType = ugcType;
    for (const file of files) {
      if (/\.(obj|mesh)$/i.test(file.name)) {
        nextMesh = { file, data: await readFile(file) };
        const lower = file.name.toLowerCase();
        if (/\b(hair|cabelo|pelo|loirinha|brunette|blonde|wig)\b/i.test(lower)) {
          detectedType = "Hair";
          setUgcType("Hair");
        } else if (/\b(face|rosto|mask|mascara|oculos|glasses)\b/i.test(lower)) {
          detectedType = "Face";
          setUgcType("Face");
        } else if (/\b(neck|pescoco|colar|chain)\b/i.test(lower)) {
          detectedType = "Neck";
          setUgcType("Neck");
        } else if (/\b(shoulder|ombro|wing|asa)\b/i.test(lower)) {
          detectedType = "Shoulder";
          setUgcType("Shoulder");
        } else if (/\b(back|costas|cape|capa|sword|espada)\b/i.test(lower)) {
          detectedType = "Back";
          setUgcType("Back");
        } else if (/\b(front|peito|chest)\b/i.test(lower)) {
          detectedType = "Front";
          setUgcType("Front");
        } else if (/\b(waist|cintura|belt|cinto)\b/i.test(lower)) {
          detectedType = "Waist";
          setUgcType("Waist");
        } else if (/\b(hat|bone|cap|beanie|chapeu|chapéu)\b/i.test(lower)) {
          detectedType = "Hat";
          setUgcType("Hat");
        }
      } else if (/\.(png|jpe?g)$/i.test(file.name)) {
        nextTexture = { file, data: await readFile(file) };
      } else if (/\.(rbxm|rbxmx)$/i.test(file.name)) {
        setError("RBXM pronto ainda sobe, mas o fluxo novo é mesh + textura. O app monta o Accessory.");
      } else if (/\.(fbx|blend)$/i.test(file.name)) {
        setError("Exporte o mesh como OBJ. O app monta o Accessory a partir do OBJ + PNG.");
      }
    }
    setUgcMesh(nextMesh);
    setUgcTexture(nextTexture);
    if (nextMesh && nextTexture) {
      await refreshUgcPreview(nextMesh, nextTexture, detectedType);
    }
  }

  async function onSubmitUgc(event: FormEvent) {
    event.preventDefault();
    if (!ugcMesh || !ugcTexture) {
      setError("Mande o mesh (OBJ/.mesh) e a textura PNG. O app monta o Accessory.");
      return;
    }
    setUgcBusy(true);
    setError(null);
    try {
      await queueUgcAccessory({
        name,
        description,
        groupId: groupId ? Number(groupId) : null,
        mesh: ugcMesh.data,
        meshName: ugcMesh.file.name,
        texture: ugcTexture.data,
        textureName: ugcTexture.file.name,
        accessoryType: ugcType,
        isLimited,
        totalQuantity: isLimited ? totalQuantity : undefined,
        priceInRobux: ugcPrice,
        meshId: ugcMeshId,
        textureId: ugcTextureId,
      });
      toastManager.success("UGC na fila", `${name || ugcMesh.file.name} montado e enviado.`);
      setUgcMesh(null);
      setUgcTexture(null);
      setUgcMeshId(null);
      setUgcTextureId(null);
      setUgcPreview(null);
      setUgcGeometry(null);
      setUgcTextureUrl(null);
      setUgcTriangles(null);
      setPreFlight(null);
      setUgcRbxmx(null);
      setName("");
      setDescription("");
      setActiveTab("queue");
      loadUploads();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toastManager.error("Erro no UGC", msg);
    } finally {
      setUgcBusy(false);
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
      toastManager.error("Arquivo Faltando", "Selecione a imagem PNG/JPEG do molde da roupa.");
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
      toastManager.success(
        "Roupa Adicionada à Fila!",
        `Item "${name || file.name}" agendado para publicação no grupo.`
      );
      setFile(null);
      setRawImage(null);
      setPreview(null);
      setMannequin(null);
      setName("");
      setDescription("");
      setActiveTab("queue");
      loadUploads();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toastManager.error("Erro no Upload", msg);
    } finally {
      setBusy(false);
    }
  }

  const handleCopy = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setCopiedId(id);
    toastManager.success("ID Copiado!", `Asset #${id} copiado para a área de transferência.`);
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
            <span>Publicar UGC</span>
            {groupId && (
              <span className="border-l border-white/15 pl-3 text-xs font-medium text-white/45">
                {groupName}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-white/45 mt-1">
            Publica o teu arquivo: acessório 3D (mesh + textura) ou roupa clássica 2D. Vai pra tua conta/grupo — não é item de catálogo de terceiros.
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
            onClick={() => setActiveTab("ugc")}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-semibold text-black transition-colors hover:bg-white/90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publicar UGC</span>
          </button>
        </div>
      </div>

      {robloxConnected === false && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <span>Conecta o cookie da tua conta Roblox pra publicar UGC neste app.</span>
          <Link
            to="/painel/conta"
            className="shrink-0 rounded-lg bg-amber-200 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-100"
          >
            Abrir Users
          </Link>
        </div>
      )}

      {optBanner && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
            optBanner.includes("✅")
              ? "bg-blue-500/10 text-blue-300"
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
          <p className="text-[11px] text-blue-400 mt-0.5">{catalogStore ? `${clothingCount} roupas 2D · ${ugcCount} itens 3D` : "Aguardando catálogo"}</p>
        </div>

        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Preços no Catálogo</p>
          <p className="text-2xl font-bold text-white mt-1">{minPrice == null ? "—" : minPrice === maxPrice ? `${minPrice} R$` : `${minPrice} a ${maxPrice} R$`}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{knownPrices.length} preços informados pela Roblox</p>
        </div>

        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Status de SEO</p>
          <p className="mt-1 text-2xl font-semibold text-white">{seoPercent == null ? "—" : `${seoPercent}%`}</p>
          <p className="mt-0.5 text-[11px] text-blue-300/75">{catalogStore ? `${seoCount} descrições completas` : "Aguardando catálogo"}</p>
        </div>

        <div className="rounded-xl border border-white/[0.09] bg-[#0a0a0a] p-4">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Fila de Publicação</p>
          <p className="mt-1 text-2xl font-semibold text-white">{board ? queueCount : "—"}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{board ? `${board.jobs.length} uploads registrados` : "Aguardando servidor"}</p>
        </div>
      </div>

      {/* Modern Tab Switcher with Tectonic Highlight */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <Link
          to="/painel/copy"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-[#d96b52]/40 bg-[#d96b52]/10 text-[#d96b52] hover:bg-[#d96b52]/20 shadow-[0_0_15px_rgba(217,107,82,0.2)]"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>UGC Cloner (Anti-Ban)</span>
          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-[#d96b52] text-white font-mono">
            Novo
          </span>
        </Link>

        <button
          onClick={() => setActiveTab("ugc")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            activeTab === "ugc"
              ? "bg-blue-600/20 border-blue-500/50 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] backdrop-blur-md"
              : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06]"
          }`}
        >
          <Box className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-shiny-blue font-extrabold">Publicar UGC 3D (Tectonic)</span>
          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40 font-mono">
            Pipeline
          </span>
        </button>

        <button
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === "upload"
              ? "bg-[#1a1a1a] border-white/20 text-white shadow-sm"
              : "border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5 text-white/70" />
          <span>Publicar 2D (Roupas Clássicas)</span>
        </button>

        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === "catalog"
              ? "bg-[#1a1a1a] border-white/20 text-white shadow-sm"
              : "border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-white/70" />
          <span>Catálogo do Grupo ({catalogStore?.itemCount ?? "—"})</span>
        </button>

        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === "queue"
              ? "bg-[#1a1a1a] border-white/20 text-white shadow-sm"
              : "border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-white/70" />
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
                    <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${item.description.trim().length >= 15 ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-300"}`}>
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
                            <CheckCircle2 className="w-3 h-3 text-blue-400" />
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
          {/* Left Column: File Dropzone with Authentic 3D Avatar */}
          <div className="lg:col-span-5">
            <label
              className={`group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0a0a] text-center transition-colors hover:border-white/15 hover:bg-[#0d0d0d] ${
                preview ? "p-3 min-h-[450px]" : "p-6 h-[360px]"
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void onFile(event.dataTransfer.files?.[0] || null);
              }}
            >
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => void onFile(e.target.files?.[0] || null)}
              />

              {preparing ? (
                <p className="text-sm text-white/60">Normalizando template 585×559…</p>
              ) : preview ? (
                <div className="w-full h-full flex flex-col space-y-3">
                  <div className="w-full h-[400px] rounded-xl overflow-hidden bg-[#000000] border border-white/[0.08] shadow-2xl relative">
                    <RobloxAvatar3D templateDataUrl={preview} kind={kind} />
                  </div>
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-[11px] font-mono text-blue-400 font-semibold">
                      Preview Oficial Roblox 3D (R6 &amp; R15)
                    </span>
                    <span className="text-[11px] text-white/50 underline hover:text-white">
                      Trocar Arquivo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors group-hover:text-blue-300">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-white">Solte sua textura ou template 585×559</p>
                  <p className="text-xs text-white/40 mt-1">PNG ou JPEG da sua peça. Sem URL de catálogo.</p>
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
                    onClick={() => void onKindChange(k.id)}
                    disabled={preparing}
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
              disabled={busy || preparing || !file || !preview}
              wrapperClassName="w-full"
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-white text-black hover:bg-neutral-200 shadow-lg"
            >
              {preparing ? "Preparando template..." : busy ? "Publicando no Roblox..." : "Publicar Roupa no Catálogo"}
            </DotButton>
          </div>
        </form>
      )}

      {activeTab === "ugc" && (
        <div className="space-y-6">
          {/* Tectonic Pipeline Hero Header */}
          <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-950/20 via-black/40 to-blue-950/20 p-5 sm:p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300">
                    Tectonic Engine
                  </span>
                  <span className="text-xs text-white/50 font-mono">Roblox 3D UGC Fleet</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 flex items-center gap-2">
                  <span className="text-shiny-blue">Pipeline Tectonic 3D UGC</span>
                </h2>
                <p className="text-xs text-white/60 mt-1 max-w-2xl leading-relaxed">
                  Ingestão de geometria, validação local Pre-Flight, Auto-Repair de triângulos, rigging de attachment e fee ledger — publique acessórios e Limiteds sem abrir o Roblox Studio.
                </p>
                <div className="mt-2.5">
                  <Link
                    to="/painel/copy"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d96b52]/15 border border-[#d96b52]/30 text-[#d96b52] text-[11px] font-mono font-bold hover:bg-[#d96b52]/25 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Abrir UGC Cloner (Anti-Ban, Rotação UV 90°, Jitter &amp; Salt)</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* 5-Stage Step Indicators */}
              <div className="flex items-center gap-1.5 flex-wrap bg-white/[0.03] border border-white/[0.08] p-1.5 rounded-xl">
                {[
                  { n: "1", label: "Ingest", done: Boolean(ugcMesh && ugcTexture) },
                  { n: "2", label: "Pre-Flight", done: Boolean(preFlight?.overallPassed) },
                  { n: "3", label: "Auto-Repair", done: Boolean(preFlight?.repaired || (ugcTriangles && ugcTriangles <= 4000)) },
                  { n: "4", label: "Fit & Rig", done: Boolean(ugcType) },
                  { n: "5", label: "Publish", done: false },
                ].map((st) => (
                  <div
                    key={st.n}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      st.done
                        ? "bg-blue-500/20 border border-blue-400/40 text-blue-300"
                        : "bg-white/[0.02] text-white/40 border border-transparent"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                      {st.done ? "✓" : st.n}
                    </span>
                    <span>{st.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={onSubmitUgc} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Ingest Dropzone & Multi-Body Fitting */}
            <div className="lg:col-span-5 space-y-4">
              <input
                ref={ugcFileInputRef}
                type="file"
                accept=".obj,.mesh,image/png,image/jpeg"
                multiple
                hidden
                onChange={(e) => void onUgcFiles(e.target.files)}
              />

              {preparing ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.09] bg-[#0a0a0a] p-6 text-center shadow-lg">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-sm font-semibold text-white">Analisando malha e calculando Pre-Flight…</p>
                  <span className="text-xs text-white/40 font-mono">Lendo polígonos, escala e coordenadas UV</span>
                </div>
              ) : ugcGeometry ? (
                <div className="space-y-3">
                  <div className="w-full h-[420px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#050508] shadow-2xl">
                    <RobloxUgcViewer3D
                      geometry={ugcGeometry}
                      textureUrl={ugcTextureUrl}
                      accessoryType={ugcType}
                      multiBodyView={multiBodyView}
                      onReplaceClick={() => ugcFileInputRef.current?.click()}
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 text-xs font-mono border border-blue-500/25 flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5" />
                        {ugcMesh?.file.name}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-mono border border-emerald-500/25 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {ugcTexture?.file.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => ugcFileInputRef.current?.click()}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-medium transition-colors"
                    >
                      Trocar Arquivos
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  className="group relative flex min-h-[380px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/[0.12] bg-[#0a0a0a] p-6 text-center transition-all hover:border-blue-500/40 hover:bg-[#0d0d0d] shadow-lg"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void onUgcFiles(event.dataTransfer.files);
                  }}
                  onClick={() => ugcFileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-105 transition-transform shadow-inner">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <p className="text-base font-bold text-white">Solte o Mesh 3D e a Textura</p>
                    <p className="mt-1 text-xs text-white/50 max-w-xs">
                      Arraste o arquivo <strong className="text-white/80">.OBJ</strong> ou <strong className="text-white/80">.mesh</strong> acompanhado da textura <strong className="text-white/80">.PNG</strong>.
                    </p>
                    <div className="mt-5 flex items-center gap-2">
                      <span className="text-[11px] text-white/50 font-mono px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        Mesh: {ugcMesh ? "✓ Pronto" : "Pendente"}
                      </span>
                      <span className="text-[11px] text-white/50 font-mono px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        Textura: {ugcTexture ? "✓ Pronta" : "Pendente"}
                      </span>
                    </div>
                    <div className="mt-4 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                      Clique para Selecionar do Computador
                    </div>
                  </div>
                </label>
              )}

              {/* Multi-Body Fitting & Preview Switcher */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-blue-400" />
                    Fitting Multi-Corpo
                  </span>
                  <span className="text-[10px] font-mono text-white/40">Pré-visualização</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "classic", label: "Classic R6/R15" },
                    { id: "slender", label: "Slender / Woman" },
                    { id: "rthro", label: "Rthro" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setMultiBodyView(b.id as any)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all border text-center ${
                        multiBodyView === b.id
                          ? "bg-blue-600/25 border-blue-500/50 text-blue-200"
                          : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attachment Solver Card */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    Attachment Solver
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Auto-Encaixe Ativo</span>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">Slot do Acessório</label>
                  <select
                    value={ugcType}
                    onChange={(e) => {
                      setUgcType(e.target.value);
                      if (ugcMesh && ugcTexture) void refreshUgcPreview(ugcMesh, ugcTexture, e.target.value);
                    }}
                    className="w-full rounded-xl bg-[#0f0f0f] border border-white/[0.08] px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    {["Hat", "Hair", "Face", "Neck", "Shoulder", "Front", "Back", "Waist"].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="text-white/50">Socket de Conexão:</span>
                  <span className="font-mono text-blue-300 font-semibold">{ATTACHMENT_MAP[ugcType] || "HatAttachment"}</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Posicionamento e rotação calculados diretamente a partir da geometria sem precisar abrir o Accessory Fitting Tool do Studio.
                </p>
              </div>
            </div>

            {/* Right Column: Pre-Flight Validator Matrix, Auto-Repair, Fee Ledger & Submission */}
            <div className="lg:col-span-7 space-y-5">
              {/* Pre-Flight Validator Matrix */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      Pre-Flight Validator (Roblox Compliance)
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5">Validação local antes de gastar um único Robux na API.</p>
                  </div>

                  {preFlight && (
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border font-mono ${
                        preFlight.overallPassed
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      {preFlight.overallPassed ? "Pre-Flight Passed" : "Falha na Validação"}
                    </span>
                  )}
                </div>

                {/* 4 Cards Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {/* Card 1: Triangle Budget */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-white/40 uppercase font-mono block">Triangle Budget</span>
                    <strong className="text-sm font-bold text-white block">
                      {ugcTriangles != null ? `${ugcTriangles.toLocaleString()} tris` : "—"}
                    </strong>
                    <span
                      className={`text-[10px] font-semibold block ${
                        ugcTriangles != null && ugcTriangles <= 4000 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {ugcTriangles != null ? (ugcTriangles <= 4000 ? "✓ Teto 4k OK" : "⚠ Excede 4.000") : "Aguardando"}
                    </span>
                  </div>

                  {/* Card 2: Texture Compliance */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-white/40 uppercase font-mono block">Texture Ceiling</span>
                    <strong className="text-sm font-bold text-white block">
                      {preFlight ? `${preFlight.textureWidth}×${preFlight.textureHeight}` : "1024×1024"}
                    </strong>
                    <span
                      className={`text-[10px] font-semibold block ${
                        preFlight ? (preFlight.texturePassed ? "text-emerald-400" : "text-rose-400") : "text-white/40"
                      }`}
                    >
                      {preFlight ? (preFlight.texturePassed ? "✓ Conforme" : "⚠ Oversized") : "Máx 1024px"}
                    </span>
                  </div>

                  {/* Card 3: Bounding Box */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-white/40 uppercase font-mono block">Bounding Box</span>
                    <strong className="text-sm font-bold text-white block">
                      {preFlight?.boundingBox
                        ? `${preFlight.boundingBox.width}×${preFlight.boundingBox.height}st`
                        : "—"}
                    </strong>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      {preFlight?.boundsPassed ? "✓ Em escala" : "Slot compatível"}
                    </span>
                  </div>

                  {/* Card 4: UV Integrity */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] text-white/40 uppercase font-mono block">UV Integrity</span>
                    <strong className="text-sm font-bold text-white block">Coordenadas UV</strong>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      {preFlight?.uvIntegrity ? "✓ Normalizado" : "Validação ativa"}
                    </span>
                  </div>
                </div>

                {/* Auto-Repair Suite Trigger (if over budget or requested) */}
                {((ugcTriangles && ugcTriangles > 4000) || (preFlight && !preFlight.overallPassed)) && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-md">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-300">Auto-Repair Disponível</h4>
                        <p className="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
                          O modelo ultrapassa o limite de 4.000 triângulos ou 1024px. Clique no botão ao lado para decimar a malha mantendo a silhueta.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onAutoRepair()}
                      disabled={autoRepairing}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-lg"
                    >
                      {autoRepairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      <span>Decimar para 4.000 tris</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Economics & Fee Ledger */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-400" />
                    Upload Fee Ledger &amp; Projeção de ROI
                  </h3>
                  <span className="text-[10px] uppercase font-mono text-white/40">Robux Ledger</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-white/40 uppercase font-mono block">Custo de Publicação</span>
                    <strong className="text-base font-bold text-white mt-1 block">750 Robux</strong>
                    <span className="text-[10px] text-white/40">Taxa cobrada pelo Roblox</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-white/40 uppercase font-mono block">Preço de Venda</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        min={50}
                        value={ugcPrice}
                        onChange={(e) => setUgcPrice(Number(e.target.value))}
                        className="w-20 bg-black/60 border border-white/10 rounded-lg px-2 py-0.5 text-sm font-bold text-white font-mono"
                      />
                      <span className="text-xs text-white/60 font-bold">R$</span>
                    </div>
                    <span className="text-[10px] text-blue-400">70% líquido = {Math.floor(ugcPrice * 0.7)} R$</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-500/[0.04] border border-blue-500/20">
                    <span className="text-[10px] text-blue-300/70 uppercase font-mono block">Break-Even Estimado</span>
                    <strong className="text-base font-bold text-blue-300 mt-1 block">
                      {Math.ceil(750 / Math.max(1, Math.floor(ugcPrice * 0.7)))} vendas
                    </strong>
                    <span className="text-[10px] text-white/40">Para cobrir o upload e lucrar</span>
                  </div>
                </div>

                {/* Limited UGC Desk Toggle */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLimited}
                        onChange={(e) => setIsLimited(e.target.checked)}
                        className="rounded bg-black border-white/20 text-blue-500"
                      />
                      <span>Publicar como UGC Limited (Estoque Fixo)</span>
                    </label>
                    <p className="text-[11px] text-white/40 mt-0.5 ml-5">
                      Define uma quantidade finita de cópias com suporte a mercado secundário.
                    </p>
                  </div>

                  {isLimited && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Estoque:</span>
                      <input
                        type="number"
                        min={1}
                        value={totalQuantity}
                        onChange={(e) => setTotalQuantity(Number(e.target.value))}
                        className="w-24 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* General Metadata Fields */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 shadow-xl space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">Nome do Item UGC</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Y2K Cyber Angel Wings 3D"
                    required
                    className="w-full rounded-xl bg-[#0f0f0f] border border-white/[0.08] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-white/60">Descrição &amp; Tags SEO</label>
                    <button
                      type="button"
                      onClick={() => generateAiDesc(name)}
                      disabled={generatingDesc}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gerar SEO com IA</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição estética do acessório com palavras-chave de busca..."
                    className="w-full resize-none rounded-xl bg-[#0f0f0f] border border-white/[0.08] p-3 text-xs text-white outline-none font-mono focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">Conta ou Grupo Alvo</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full rounded-xl bg-[#0f0f0f] border border-white/[0.08] px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    {(board?.groups || []).map((g) => (
                      <option key={g.id} value={String(g.id)}>
                        {g.name} ({g.id})
                      </option>
                    ))}
                    <option value="">Minha Conta Pessoal</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Mesh ID (Malha 3D)
                    </label>
                    <input
                      type="text"
                      value={ugcMeshId ? String(ugcMeshId) : ""}
                      onChange={(e) => setUgcMeshId(e.target.value.trim() || null)}
                      placeholder="ID da malha (auto se clonado)"
                      className="w-full rounded-xl bg-[#0f0f0f] border border-white/[0.08] px-3.5 py-2.5 text-xs text-white outline-none font-mono focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Texture ID (Original)
                    </label>
                    <input
                      type="text"
                      value={ugcTextureId ? String(ugcTextureId) : ""}
                      onChange={(e) => setUgcTextureId(e.target.value.trim() || null)}
                      placeholder="Auto na sua conta (ou ID original)"
                      className="w-full rounded-xl bg-[#0f0f0f] border border-white/[0.08] px-3.5 py-2.5 text-xs text-white outline-none font-mono focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Sub-Asset Ownership Guidance */}
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-xs text-blue-300 space-y-1 backdrop-blur-sm">
                  <div className="flex items-center gap-2 font-bold text-blue-200">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Titularidade de IDs (Roblox Studio &amp; Marketplace)</span>
                  </div>
                  <p className="text-[11px] text-blue-200/75 leading-relaxed">
                    O Roblox exige que todos os sub-assets pertençam à conta que vai postar. O Farol envia a textura na sua conta gerando um Image Asset ID autêntico (sem erro de Asset Type no Studio). A malha é configurada para validação limpa sem erro de Asset '0'.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {ugcRbxmx && (
                    <button
                      type="button"
                      onClick={onDownloadAssembledRbxmx}
                      className="w-full rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 py-3.5 text-xs font-bold text-blue-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Download className="w-4 h-4 text-blue-400" />
                      <span>Baixar .rbxmx Studio-Ready</span>
                    </button>
                  )}

                  <DotButton
                    type="submit"
                    disabled={ugcBusy || preparing || !ugcMesh || !ugcTexture}
                    wrapperClassName={ugcRbxmx ? "w-full" : "w-full sm:col-span-2"}
                    className="w-full rounded-xl bg-white py-3.5 text-xs font-bold text-black hover:bg-neutral-200 transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {preparing ? (
                      "Processando malha no Tectonic..."
                    ) : ugcBusy ? (
                      "Publicando na frota Roblox..."
                    ) : (
                      <>
                        <span>Publicar UGC 3D no Roblox</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </DotButton>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Upload Queue */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {(board?.jobs || []).length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0a0a0a]">
              <Layers className="w-8 h-8 text-white/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-white/60">Nenhum upload pendente na fila.</p>
              <button
                onClick={() => setActiveTab("ugc")}
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
                        <div className="flex items-center gap-3">
                          {job.thumbnailUrl ? (
                            <img src={job.thumbnailUrl} alt="" className="h-10 w-10 rounded-md object-cover bg-white/5" />
                          ) : job.status === "live" ? (
                            <span className="text-[10px] text-white/35 font-normal">Thumb pendente</span>
                          ) : null}
                          <div>
                            <span className="block">{job.name}</span>
                            {job.assetId && (
                              <span className="block text-[10px] text-white/40 font-mono">
                                ID: {job.assetId}
                              </span>
                            )}
                            {job.saleWarning && (
                              <span className="block text-[11px] text-amber-300 mt-0.5">
                                {job.saleWarning}
                              </span>
                            )}
                            {job.error && (
                              <span className="block text-[11px] text-rose-400 mt-0.5">
                                {job.error.includes("{") ? "Erro na taxa de upload do Roblox" : job.error}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-white/60 font-mono uppercase text-[11px]">
                        {job.kind === "accessory" ? `UGC ${job.accessoryType || "Accessory"}` : job.kind}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            job.status === "live"
                              ? "bg-blue-500/15 text-blue-300"
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
                            : job.status === "moderated"
                            ? "Moderado"
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

                          {(job.status === "failed" || job.status === "moderated") && (
                            <button
                              onClick={() => retryUpload(job.id).then(loadUploads)}
                              className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] transition-colors"
                            >
                              Tentar de novo
                            </button>
                          )}

                          {job.catalogUrl && (
                            <a
                              href={job.catalogUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 text-[11px] transition-colors"
                            >
                              Abrir
                            </a>
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
