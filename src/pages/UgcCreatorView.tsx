import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Wand2,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Download,
  Copy,
  Layers,
  ShoppingBag,
  Send,
  AlertCircle,
  Tag,
  Eye,
  Sliders,
  Check,
} from "lucide-react";
import { PromptInput, type PromptInputMeta } from "../components/ui/ai-chat-input";
import { LiquidMetalButton } from "../components/ui/liquid-metal-button";
import {
  createUgcWithAi,
  fetchAccount,
  fetchUploads,
  queueUpload,
  type AccountPublic,
  type UploadGroup,
  type UploadJob,
} from "../lib/api";
import { renderRobloxTemplate, type UgcDesignSpec } from "../lib/ugcTemplate";

interface UgcChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  attachments?: string[];
  design?: UgcDesignSpec & {
    templateDataUrl: string;
    uploadJob?: UploadJob | null;
    uploading?: boolean;
    uploadError?: string | null;
  };
}

export function UgcCreatorView() {
  const [messages, setMessages] = useState<UgcChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Olá! Eu sou o seu **Designer de Moda & UGC com IA** do Roblox. Descreva em linguagem natural a peça que deseja criar (ex: *calça cargo baggy Y2K preta com correntes* ou *jaqueta puffer cyberpunk com chamas*) ou anexe uma foto de referência do Pinterest ou Discord. Eu desenvolvo o design, gero o molde oficial do Roblox e posso publicar automaticamente no seu grupo!",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoPost, setAutoPost] = useState(true);
  const [groups, setGroups] = useState<UploadGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountPublic | null>(null);
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = searchParams.get("prompt");
    if (p) {
      setInputVal(p);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAccount()
      .then((acc) => setAccount(acc))
      .catch(() => {});

    fetchUploads()
      .then((board) => {
        const postable = (board.groups || []).filter((g) => g.canPost);
        setGroups(postable);
        if (postable.length > 0) {
          setSelectedGroupId(postable[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendPrompt = async (textToSend?: string, meta?: PromptInputMeta) => {
    const prompt = (textToSend || inputVal).trim();
    const attachedFiles = meta?.attachments || [];
    if ((!prompt && attachedFiles.length === 0) || loading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: UgcChatMessage = {
      id: userMsgId,
      role: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      attachments: attachedFiles.map((f) => f.name),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setLoading(true);

    try {
      // Convert attached files to base64
      let referenceImageDataUrl: string | undefined = undefined;
      const formattedAttachments = await Promise.all(
        attachedFiles.map(async (file) => {
          const dataUrl = await readFileAsBase64(file);
          if (!referenceImageDataUrl && file.type.startsWith("image/")) {
            referenceImageDataUrl = dataUrl;
          }
          return {
            name: file.name,
            mimeType: file.type,
            data: dataUrl,
          };
        })
      );

      // Call AI design engine
      const res = await createUgcWithAi({
        prompt,
        attachments: formattedAttachments,
        effort: meta?.effort || "Detalhada",
      });

      const designData = res.design;

      // Synthesize official 585x559 Roblox template in browser canvas
      const spec: UgcDesignSpec = {
        title: designData.title,
        kind: designData.kind,
        price: designData.price || 5,
        description: designData.description,
        tags: [designData.theme, ...designData.details],
        theme: designData.theme,
        primaryColor: designData.primaryColor,
        secondaryColor: designData.secondaryColor,
        accentColor: designData.accentColor,
        pattern: designData.pattern,
        details: designData.details,
        referenceImageDataUrl,
      };

      const templateDataUrl = await renderRobloxTemplate(spec);

      let initialJob: UploadJob | null = null;
      let uploadErr: string | null = null;

      // If auto-post is enabled and account connected, queue upload to Roblox immediately!
      if (autoPost) {
        try {
          initialJob = await queueUpload({
            name: designData.title,
            description: designData.description,
            kind: designData.kind,
            price: designData.price || 5,
            groupId: selectedGroupId,
            fileName: `${designData.title.replace(/[^a-zA-Z0-9]/g, "_")}_template.png`,
            image: templateDataUrl,
          });
        } catch (upErr: any) {
          uploadErr = upErr?.message || "Não foi possível conectar a conta Roblox para upload automático.";
        }
      }

      const assistantMsg: UgcChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        text: designData.reply,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        design: {
          ...spec,
          templateDataUrl,
          uploadJob: initialJob,
          uploading: false,
          uploadError: uploadErr,
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: `⚠️ Desculpe, tive um problema ao gerar o modelo: ${err?.message || "Erro desconhecido"}. Tente novamente com mais detalhes!`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleManualPublish = async (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg?.design) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.design
          ? { ...m, design: { ...m.design, uploading: true, uploadError: null } }
          : m
      )
    );

    try {
      const job = await queueUpload({
        name: targetMsg.design.title,
        description: targetMsg.design.description,
        kind: targetMsg.design.kind,
        price: targetMsg.design.price,
        groupId: selectedGroupId,
        fileName: `${targetMsg.design.title.replace(/[^a-zA-Z0-9]/g, "_")}_template.png`,
        image: targetMsg.design.templateDataUrl,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.design
            ? { ...m, design: { ...m.design, uploading: false, uploadJob: job } }
            : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.design
            ? { ...m, design: { ...m.design, uploading: false, uploadError: err.message || "Falha ao publicar" } }
            : m
        )
      );
    }
  };

  const handleDownloadTemplate = (templateDataUrl: string, title: string) => {
    const a = document.createElement("a");
    a.href = templateDataUrl;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_template.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    "Calça cargo baggy Y2K preta com correntes prateadas",
    "Jaqueta puffer cyberpunk oversized neon",
    "Camisa grunge vintage listrada com capuz",
    "Top coquette aesthetic rosa com laços e renda",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-6xl mx-auto px-4 py-2 relative">
      {/* Top Header & Settings Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] mb-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Wand2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Criador UGC com IA</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                Roblox 3D/2D Studio
              </span>
            </h1>
            <p className="text-xs text-white/50">
              Descreva a peça ou anexe foto de referência. A IA desenvolve o design e publica automaticamente no Roblox.
            </p>
          </div>
        </div>

        {/* Global Controls: Auto-Post Toggle & Group Selector */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Target Group Selector */}
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs">
            <ShoppingBag className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedGroupId || ""}
              onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-[#0f0f0f] text-white">
                Minha Conta Pessoal
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-[#0f0f0f] text-white">
                  Grupo: {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Post Switch */}
          <button
            type="button"
            onClick={() => setAutoPost(!autoPost)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              autoPost
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-white/[0.03] border-white/[0.08] text-white/50"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoPost ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
            <span>Auto-Postar no Roblox</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 scrollbar-thin scrollbar-thumb-white/10">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-1">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-2xl space-y-3 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {/* Message bubble */}
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600/20 border border-purple-500/30 text-white rounded-tr-none ml-auto"
                    : "bg-[#0a0a0a] border border-white/[0.08] text-white/90 rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* User attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 flex flex-wrap gap-2 text-[11px] text-white/60">
                    <span className="font-semibold text-white/40">Anexo:</span>
                    {msg.attachments.map((name, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white/10 font-mono">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1.5 text-[10px] text-white/30 text-right">{msg.timestamp}</div>
              </div>

              {/* Generated UGC Design Card */}
              {msg.design && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-[#080808] border border-purple-500/30 p-5 space-y-4 shadow-2xl backdrop-blur-xl max-w-xl"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {msg.design.kind === "shirt" ? "Camisa 2D" : msg.design.kind === "pants" ? "Calça 2D" : "T-Shirt 2D"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {msg.design.price} Robux
                        </span>
                        <span className="text-[10px] text-white/40 font-mono uppercase">
                          {msg.design.theme}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{msg.design.title}</h3>
                    </div>
                  </div>

                  {/* Template Visual Preview */}
                  <div className="relative rounded-xl overflow-hidden bg-black/60 border border-white/[0.06] p-3 flex flex-col items-center justify-center">
                    <div className="text-[11px] font-mono text-white/40 mb-2 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>Molde Oficial Roblox (585 × 559 px)</span>
                    </div>
                    <img
                      src={msg.design.templateDataUrl}
                      alt={msg.design.title}
                      className="w-full max-w-sm rounded-lg object-contain shadow-inner border border-white/10 hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* English SEO Description & Tags Box */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white/60 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-purple-400" />
                        <span>Descrição & Tags Virais (Inglês Global)</span>
                      </span>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.design!.description)}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === msg.id ? "Copiado!" : "Copiar"}</span>
                      </button>
                    </div>
                    <pre className="text-[11px] text-white/70 font-mono whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto bg-black/40 p-2.5 rounded-lg border border-white/[0.04]">
                      {msg.design.description}
                    </pre>
                  </div>

                  {/* Publish Status or Manual Action */}
                  <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
                    {msg.design.uploadJob ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold w-full sm:w-auto">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Na fila de publicação Roblox!</span>
                        {msg.design.uploadJob.catalogUrl && (
                          <a
                            href={msg.design.uploadJob.catalogUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 underline flex items-center gap-1 text-white hover:text-emerald-300"
                          >
                            <span>Ver no Catálogo</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ) : msg.design.uploading ? (
                      <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enviando para o Roblox...</span>
                      </div>
                    ) : (
                      <LiquidMetalButton
                        label="Publicar no Roblox"
                        onClick={() => handleManualPublish(msg.id)}
                        width={180}
                        icon={<UploadCloud className="w-4 h-4 text-purple-400" />}
                      />
                    )}

                    {/* Download Template Button */}
                    <button
                      onClick={() => handleDownloadTemplate(msg.design!.templateDataUrl, msg.design!.title)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-white/60" />
                      <span>Baixar Molde (.PNG)</span>
                    </button>
                  </div>

                  {msg.design.uploadError && (
                    <div className="text-[11px] text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{msg.design.uploadError}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0 mt-1 font-bold text-xs">
                {account?.displayName?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center text-xs text-purple-300 bg-[#0a0a0a] border border-purple-500/20 p-4 rounded-2xl w-fit">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Consultando modelo e arquitetando o molde 2D do Roblox...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
        <span className="text-[11px] text-white/40 shrink-0 font-medium">Sugestões:</span>
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendPrompt(q)}
            disabled={loading}
            className="px-3 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white text-xs whitespace-nowrap transition-all cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Component (Exact from Photo 2) */}
      <div className="shrink-0">
        <PromptInput
          value={inputVal}
          onChange={(val) => setInputVal(val)}
          onSubmit={(val, meta) => handleSendPrompt(val, meta)}
          loading={loading}
          placeholder="Descreva a roupa ou item UGC que deseja criar (ex: calça cargo baggy Y2K preta com correntes)..."
          className="w-full"
        />
      </div>
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
