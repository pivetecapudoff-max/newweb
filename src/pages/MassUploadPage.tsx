import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Images,
  Layers3,
  LoaderCircle,
  Shirt,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  fetchUploads,
  prepareUpload,
  queueUpload,
  type ClothingKind,
  type UploadGroup,
} from "../lib/api";
import { renderAvatarPreview } from "../lib/ugcTemplate";
import { toastManager } from "../components/ui/toast";

const MAX_BATCH = 8;

type FileState = "preparing" | "ready" | "queued" | "failed";

interface BatchFile {
  id: string;
  file: File;
  rawImage: string;
  templateImage: string | null;
  mannequinImage: string | null;
  kind: ClothingKind;
  name: string;
  price: number;
  state: FileState;
  error: string | null;
}

const KIND_LABEL: Record<ClothingKind, string> = {
  shirt: "Camisa",
  pants: "Calça",
  tshirt: "T-shirt",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function cleanFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

function newBatchFile(file: File): BatchFile {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    rawImage: "",
    templateImage: null,
    mannequinImage: null,
    kind: "shirt",
    name: cleanFileName(file.name) || "Classic Roblox Clothing",
    price: 5,
    state: "preparing",
    error: null,
  };
}

export function MassUploadPage() {
  const [items, setItems] = useState<BatchFile[]>([]);
  const [groups, setGroups] = useState<UploadGroup[]>([]);
  const [connected, setConnected] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUploads()
      .then((board) => {
        const available = board.groups.filter((group) => group.canPost !== false);
        setConnected(board.connected);
        setGroups(available);
        const preferred = board.lastGroupId && available.some((group) => group.id === board.lastGroupId)
          ? board.lastGroupId
          : null;
        setGroupId(preferred);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar a conta."))
      .finally(() => setLoadingAccount(false));
  }, []);

  const readyItems = items.filter((item) => item.state === "ready");
  const estimatedUploadFee = useMemo(
    () => readyItems.reduce((total, item) => total + (item.kind === "tshirt" ? 0 : 10), 0),
    [readyItems]
  );

  function patchItem(id: string, patch: Partial<BatchFile>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function prepareOne(initial: BatchFile) {
    try {
      if (/\.(rbxm|rbxmx|rbxl|rbxlx|fbx|obj|mesh|blend)$/i.test(initial.file.name)) {
        throw new Error("Arquivo 3D exige o Studio (Save to Roblox → Avatar Asset).");
      }
      if (!/\.(png|jpe?g)$/i.test(initial.file.name)) {
        throw new Error("Use um arquivo PNG ou JPEG.");
      }
      const rawImage = await fileToDataUrl(initial.file);
      const prepared = await prepareUpload({
        image: rawImage,
        fileName: initial.file.name,
      });
      const mannequinImage = await renderAvatarPreview(prepared.image, prepared.kind);
      patchItem(initial.id, {
        rawImage,
        templateImage: prepared.image,
        mannequinImage,
        kind: prepared.kind,
        name: prepared.suggestedName,
        price: prepared.suggestedPrice,
        state: "ready",
        error: null,
      });
    } catch (err) {
      patchItem(initial.id, {
        state: "failed",
        error: err instanceof Error ? err.message : "Não foi possível preparar este arquivo.",
      });
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    const freeSlots = Math.max(0, MAX_BATCH - items.length);
    if (!freeSlots) {
      setError(`O limite é de ${MAX_BATCH} arquivos por lote.`);
      return;
    }
    const accepted = incoming.slice(0, freeSlots).map(newBatchFile);
    if (incoming.length > freeSlots) {
      setError(`Somente ${freeSlots} arquivo(s) foram adicionados; o limite é ${MAX_BATCH}.`);
    } else {
      setError(null);
    }
    setItems((current) => [...current, ...accepted]);
    accepted.forEach((item) => void prepareOne(item));
  }

  async function changeKind(item: BatchFile, kind: ClothingKind) {
    if (!item.rawImage || publishing) return;
    patchItem(item.id, { kind, state: "preparing", error: null });
    try {
      const prepared = await prepareUpload({
        image: item.rawImage,
        fileName: item.file.name,
        kind,
      });
      patchItem(item.id, {
        kind: prepared.kind,
        templateImage: prepared.image,
        mannequinImage: await renderAvatarPreview(prepared.image, prepared.kind),
        price: prepared.kind === "tshirt" ? 0 : Math.max(5, item.price),
        state: "ready",
      });
    } catch (err) {
      patchItem(item.id, {
        state: "failed",
        error: err instanceof Error ? err.message : "Não foi possível trocar o tipo.",
      });
    }
  }

  async function publishBatch() {
    if (!connected) {
      setError("Conecte sua conta Roblox antes de publicar.");
      return;
    }
    if (!readyItems.length) {
      setError("Adicione pelo menos um arquivo válido.");
      return;
    }

    setPublishing(true);
    setError(null);
    let queued = 0;
    let failed = 0;

    for (const item of readyItems) {
      if (!item.templateImage) continue;
      patchItem(item.id, { state: "preparing", error: null });
      try {
        await queueUpload({
          image: item.templateImage,
          fileName: item.file.name,
          name: item.name,
          description: `${item.name} — classic ${item.kind}.`,
          kind: item.kind,
          price: item.price,
          groupId,
        });
        queued += 1;
        patchItem(item.id, { state: "queued" });
      } catch (err) {
        failed += 1;
        patchItem(item.id, {
          state: "failed",
          error: err instanceof Error ? err.message : "Falha ao adicionar à fila.",
        });
      }
    }

    setPublishing(false);
    if (queued) {
      toastManager.success("Lote adicionado", `${queued} peça(s) foram enviadas para a fila.`);
    }
    if (failed) {
      toastManager.error("Lote incompleto", `${failed} peça(s) falharam.`);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-7 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] pb-16">
        <section className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
                <Layers3 className="h-4 w-4" />
                Lote de arquivos próprios
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Upload em Massa
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/50">
                Solte até {MAX_BATCH} texturas ou templates PNG/JPEG. UGC 3D (mesh + textura) fica em
                Products → UGC 3D: o app monta o Accessory.
              </p>
            </div>
            <div className="grid min-w-full grid-cols-3 gap-2 sm:min-w-[430px]">
              <Stat label="Arquivos" value={`${items.length}/${MAX_BATCH}`} />
              <Stat label="Prontos" value={String(readyItems.length)} />
              <Stat label="Taxa estimada" value={`${estimatedUploadFee} R$`} />
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-4">
            <label
              className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0a0a0a] p-7 text-center transition hover:border-blue-400/50 hover:bg-blue-500/[0.03]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
            >
              <input
                type="file"
                accept="image/png,image/jpeg"
                multiple
                hidden
                disabled={publishing || items.length >= MAX_BATCH}
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <UploadCloud className="h-8 w-8 text-blue-400" />
              <p className="mt-3 text-sm font-semibold text-white">Solte seus arquivos aqui</p>
              <p className="mt-1 text-xs text-white/40">PNG/JPEG próprio · textura ou template 585×559</p>
            </label>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-10 text-center">
                <Images className="mx-auto h-9 w-9 text-white/20" />
                <p className="mt-3 text-sm text-white/45">Nenhum arquivo no lote.</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4">
                    <div className="flex gap-3">
                      <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/40">
                        {item.state === "preparing" ? (
                          <LoaderCircle className="h-6 w-6 animate-spin text-blue-400" />
                        ) : item.mannequinImage ? (
                          <img src={item.mannequinImage} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <Shirt className="h-8 w-8 text-white/20" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <input
                            value={item.name}
                            maxLength={50}
                            disabled={publishing || item.state === "queued"}
                            onChange={(event) => patchItem(item.id, { name: event.target.value })}
                            className="min-w-0 flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white outline-none"
                          />
                          <button
                            type="button"
                            disabled={publishing}
                            onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                            className="rounded-lg p-2 text-white/30 transition hover:bg-rose-500/10 hover:text-rose-300"
                            title="Remover arquivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-2 flex gap-1.5">
                          {(["shirt", "pants", "tshirt"] as ClothingKind[]).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              disabled={publishing || item.state === "preparing" || item.state === "queued"}
                              onClick={() => void changeKind(item, kind)}
                              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                                item.kind === kind
                                  ? "bg-white text-black"
                                  : "bg-white/[0.04] text-white/45 hover:text-white"
                              }`}
                            >
                              {KIND_LABEL[kind]}
                            </button>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={item.kind === "tshirt" ? 0 : 5}
                            value={item.price}
                            disabled={publishing || item.state === "queued"}
                            onChange={(event) =>
                              patchItem(item.id, {
                                price: item.kind === "tshirt"
                                  ? Math.max(0, Number(event.target.value) || 0)
                                  : Math.max(5, Number(event.target.value) || 5),
                              })
                            }
                            className="w-20 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none"
                          />
                          <span className="text-[10px] text-white/35">Robux</span>
                          <StateLabel item={item} />
                        </div>
                      </div>
                    </div>

                    {item.templateImage && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[10px] text-blue-300/70">Ver template UV normalizado</summary>
                        <img src={item.templateImage} alt="Template UV" className="mt-2 max-h-52 w-full object-contain" />
                      </details>
                    )}
                    {item.error && <p className="mt-3 text-[11px] text-rose-300">{item.error}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="h-fit space-y-4 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 lg:sticky lg:top-4">
            <h2 className="text-sm font-semibold text-white">Destino da publicação</h2>
            <select
              value={groupId ?? ""}
              disabled={publishing || loadingAccount}
              onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#121212] px-3.5 py-3 text-sm text-white/80 outline-none"
            >
              <option value="">Minha conta pessoal</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>

            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-[11px] leading-4 text-white/45">
              O Roblox cobra a taxa oficial e faz a moderação. Camisa/calça: 10 R$ por arquivo;
              t-shirt: 0 R$.
            </div>

            {!connected ? (
              <Link
                to="/painel/conta"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Conectar conta Roblox <ExternalLink className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled={publishing || readyItems.length === 0}
                onClick={() => void publishBatch()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {publishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}
                {publishing ? "Enviando lote..." : `Publicar ${readyItems.length} arquivo(s)`}
              </button>
            )}

            {items.some((item) => item.state === "queued") && (
              <Link
                to="/painel/upload"
                className="flex items-center justify-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Acompanhar fila <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function StateLabel({ item }: { item: BatchFile }) {
  if (item.state === "preparing") {
    return <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-300"><LoaderCircle className="h-3 w-3 animate-spin" /> Preparando</span>;
  }
  if (item.state === "queued") {
    return <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-300"><CheckCircle2 className="h-3 w-3" /> Na fila</span>;
  }
  if (item.state === "failed") {
    return <span className="ml-auto flex items-center gap-1 text-[10px] text-rose-300"><XCircle className="h-3 w-3" /> Falhou</span>;
  }
  return <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Pronto</span>;
}
