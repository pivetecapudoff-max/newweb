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
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { PromptInput, type PromptInputMeta } from "../components/ui/ai-chat-input";
import { LiquidMetalButton } from "../components/ui/liquid-metal-button";
import {
  createUgcWithAi,
  fetchAccount,
  fetchUploads,
  queueUpload,
  analyzeGroupSales,
  optimizeCatalog,
  type AccountPublic,
  type UploadGroup,
  type UploadJob,
  type GroupSalesAnalysis,
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
  groupAnalysis?: GroupSalesAnalysis;
}

export function UgcCreatorView() {
  const [selectedStyle, setSelectedStyle] = useState<string>("syn_night_shop");
  const [messages, setMessages] = useState<UgcChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Olá! Eu sou o seu **Designer de Moda & UGC com IA** para o Roblox, 100% adaptado para **funcionar com qualquer grupo ou loja**. Você pode selecionar o seu grupo no topo, escolher o estilo estético desejado (como o estilo Moe / Jirai Kei da Syn night shop, Y2K Baggy ou Goth) e a IA vai gerar o molde oficial 2D, as tags e a descrição personalizada para a **sua própria marca** por 5 Robux!\n\nDescreva a peça desejada, clique em um dos atalhos de inspiração abaixo ou anexe uma foto de referência:",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAnalyzingGroup, setIsAnalyzingGroup] = useState(false);
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

      const activeGroup = groups.find((g) => g.id === selectedGroupId);

      // Call AI design engine with target group and aesthetic style
      const res = await createUgcWithAi({
        prompt,
        attachments: formattedAttachments,
        effort: meta?.effort || "Detalhada",
        groupId: selectedGroupId,
        groupName: activeGroup?.name || undefined,
        stylePreset: selectedStyle,
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

  const handleAnalyzeGroup = async () => {
    if (isAnalyzingGroup) return;
    setIsAnalyzingGroup(true);
    const targetName = groups.find((g) => g.id === selectedGroupId)?.name || (selectedGroupId ? `Grupo #${selectedGroupId}` : "Grupo Ativo");
    setMessages((prev) => [
      ...prev,
      {
        id: "user-" + Date.now(),
        role: "user",
        text: `Analise o desempenho das roupas e itens do grupo "${targetName}". Por que alguns itens vendem e outros não?`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    try {
      const res = await analyzeGroupSales(selectedGroupId || undefined);
      if (res && res.analysis) {
        setMessages((prev) => [
          ...prev,
          {
            id: "analysis-" + Date.now(),
            role: "assistant",
            text: res.analysis.aiDiagnosis,
            timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            groupAnalysis: res.analysis,
          },
        ]);
      } else {
        throw new Error("Não foi possível processar a auditoria do catálogo.");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "error-" + Date.now(),
          role: "assistant",
          text: `⚠️ Não foi possível analisar o grupo: ${err.message || "Erro de conexão com a API da Roblox"}.`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsAnalyzingGroup(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-3 sm:px-4 pb-2 pt-1 relative overflow-hidden">
      {/* Top Header & Settings Bar with Liquid Glass */}
      <div className="liquid-glass flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl mb-3 shrink-0 shadow-2xl relative">
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md">
            <Wand2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
              <span>Criador UGC com IA</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/35 text-purple-300 backdrop-blur-md shadow-sm">
                Multi-Grupos 3D/2D
              </span>
              <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 backdrop-blur-md shadow-sm flex items-center gap-1">
                <span>🎯 Alvo: {groups.find((g) => g.id === selectedGroupId)?.name || "Minha Loja Roblox"}</span>
              </span>
            </h1>
            <p className="text-xs text-white/60">
              Gere roupas de alta conversão para <strong>qualquer grupo ou marca</strong>, com moldes 2D oficiais a 5 R$, SEO dinâmico e auto-publicação.
            </p>
          </div>
        </div>

        {/* Global Controls: Auto-Post Toggle, Group Selector, Style Preset & Group Analysis */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Group Sales Analysis Button with Liquid Glass */}
          <button
            type="button"
            onClick={handleAnalyzeGroup}
            disabled={isAnalyzingGroup || loading}
            className="liquid-glass flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 backdrop-blur-md shadow-[0_0_12px_rgba(168,85,247,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all cursor-pointer disabled:opacity-50"
            title="Analisar por que alguns itens vendem e outros não no seu grupo"
          >
            {isAnalyzingGroup ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>{isAnalyzingGroup ? "Auditando..." : "Analisar Vendas do Grupo"}</span>
          </button>

          {/* Target Group Selector */}
          <div className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] px-3 py-1.5 rounded-xl text-xs backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all">
            <ShoppingBag className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedGroupId || ""}
              onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer max-w-[140px] truncate"
              title="Selecione o grupo onde a peça será lançada"
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

          {/* Aesthetic Style Preset Selector */}
          <div className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] px-3 py-1.5 rounded-xl text-xs backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer max-w-[150px] truncate"
              title="Escolha o estilo estético desejado para o seu grupo"
            >
              <option value="syn_night_shop" className="bg-[#0f0f0f] text-white">
                🎀 Estilo Syn Night (Moe / Jirai)
              </option>
              <option value="y2k_streetwear" className="bg-[#0f0f0f] text-white">
                🔥 Y2K Baggy Streetwear
              </option>
              <option value="goth_alt" className="bg-[#0f0f0f] text-white">
                🕷️ Gothic & Opium Dark
              </option>
              <option value="coquette_cute" className="bg-[#0f0f0f] text-white">
                ✨ Coquette & Cutecore
              </option>
              <option value="auto" className="bg-[#0f0f0f] text-white">
                🌐 Estilo Livre (Do Prompt)
              </option>
            </select>
          </div>

          {/* Auto-Post Switch */}
          <button
            type="button"
            onClick={() => setAutoPost(!autoPost)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border backdrop-blur-md transition-all cursor-pointer ${
              autoPost
                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(255,255,255,0.15)]"
                : "bg-white/[0.04] border-white/[0.1] text-white/50 hover:text-white/75"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoPost ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" : "bg-white/20"}`} />
            <span>Auto-Postar no Roblox</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1.5 mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`w-full flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-center"
            } ${messages.length <= 1 ? "my-auto py-6" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-1">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-2xl w-full space-y-3 flex flex-col ${msg.role === "user" ? "items-end" : "items-center"}`}>
              {/* Message bubble */}
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600/20 border border-purple-500/30 text-white rounded-tr-none ml-auto"
                    : "bg-[#0a0a0a] border border-white/[0.08] text-white/90 rounded-2xl shadow-xl w-full text-left"
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

              {/* Group Sales Analysis Diagnostic Card */}
              {msg.groupAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-[#080808]/90 border border-purple-500/30 p-5 space-y-5 shadow-2xl backdrop-blur-xl w-full max-w-2xl text-left"
                >
                  {/* Card Header & Health Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/35">
                          Diagnóstico de Vendas Roblox
                        </span>
                        <span className="text-xs text-white/50 font-mono">
                          ID {msg.groupAnalysis.group.id}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1">
                        {msg.groupAnalysis.group.name}
                      </h3>
                      <p className="text-xs text-white/50">
                        {msg.groupAnalysis.group.memberCount.toLocaleString("pt-BR")} membros no grupo
                      </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 rounded-xl">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-white/40">Saúde do Catálogo</div>
                        <div
                          className={`text-base font-extrabold ${
                            msg.groupAnalysis.metrics.healthScore >= 75
                              ? "text-emerald-400"
                              : msg.groupAnalysis.metrics.healthScore >= 50
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {msg.groupAnalysis.metrics.healthScore}/100
                        </div>
                      </div>
                      <div
                        className={`w-3 h-3 rounded-full animate-pulse ${
                          msg.groupAnalysis.metrics.healthScore >= 75
                            ? "bg-emerald-400"
                            : msg.groupAnalysis.metrics.healthScore >= 50
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Metric Highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="text-[10px] text-white/40 uppercase font-semibold">Peças Analisadas</div>
                      <div className="text-sm font-bold text-white mt-0.5">{msg.groupAnalysis.metrics.totalItems}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="text-[10px] text-white/40 uppercase font-semibold">Preço Médio</div>
                      <div className="text-sm font-bold text-white mt-0.5">{msg.groupAnalysis.metrics.avgPrice} R$</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="text-[10px] text-rose-300/70 uppercase font-semibold">Preço &gt; 5 R$</div>
                      <div className="text-sm font-bold text-rose-300 mt-0.5">
                        {msg.groupAnalysis.metrics.overpricedCount} peças
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="text-[10px] text-amber-300/70 uppercase font-semibold">Títulos Vagos</div>
                      <div className="text-sm font-bold text-amber-300 mt-0.5">
                        {msg.groupAnalysis.metrics.vagueTitleCount} peças
                      </div>
                    </div>
                  </div>

                  {/* Comparison: Why some sell vs Why others don't */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>🏆 Peças que Vendem / Têm Tração ({msg.groupAnalysis.topSellingItems.length})</span>
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {msg.groupAnalysis.topSellingItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white truncate max-w-[240px]">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                                {item.price} R$
                              </span>
                              {item.favorites > 0 && (
                                <span className="text-[10px] text-white/50">{item.favorites} favs</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.reasonsForSuccess.map((r, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
                              >
                                ✓ {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-rose-400 pt-2">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>⚠️ Peças Paradas / Sem Vendas ({msg.groupAnalysis.stagnantItems.length})</span>
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {msg.groupAnalysis.stagnantItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white truncate max-w-[240px]">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                                  item.price > 5
                                    ? "bg-rose-500/20 text-rose-300 font-bold"
                                    : "bg-white/10 text-white/70"
                                }`}
                              >
                                {item.price} R$
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {item.reasonsWhyItFails.map((r, idx) => (
                              <div key={idx} className="text-[10px] text-rose-300/80 flex items-center gap-1">
                                <span>• {r}</span>
                              </div>
                            ))}
                            <div className="text-[10px] text-white/60 bg-black/40 p-1.5 rounded border border-white/[0.05]">
                              <strong className="text-purple-300">Solução recomendada:</strong> {item.suggestedFix}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-2 border-t border-white/[0.08] flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const topItem = msg.groupAnalysis?.topSellingItems[0];
                        if (topItem) {
                          setInputVal(
                            `Crie uma calça cargo baggy preta estilosa Y2K para combinar com a peça "${topItem.name}" e formar um conjunto completo de alta conversão.`
                          );
                        } else {
                          setInputVal(
                            "Crie um conjunto completo de roupa clássica (camisa + calça cargo baggy) na estética Y2K mais vendida."
                          );
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Criar Peça Complementar com IA</span>
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          await optimizeCatalog(selectedGroupId || undefined);
                          alert("Otimização de SEO iniciada! As descrições e tags do catálogo estão sendo atualizadas com IA.");
                        } catch (e: any) {
                          alert(e.message || "Erro ao disparar otimização.");
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white/80 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                      <span>Otimizar Tags das Peças Paradas</span>
                    </button>
                  </div>
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
          <div className="w-full flex justify-center py-2">
            <div className="flex gap-3 items-center text-xs text-purple-300 bg-[#0a0a0a] border border-purple-500/20 p-4 rounded-2xl shadow-xl">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>Consultando modelo e arquitetando o molde 2D do Roblox...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Inspiration Chips (Compatible with any group) */}
      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="text-[10px] uppercase font-bold text-purple-400/80 tracking-wider flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span>Inspirações Virais:</span>
        </span>
        {[
          { label: "🎀 Off-Shoulder Bow Top", prompt: "uwu off shoulder top white com laço delicado e decote ombro a ombro" },
          { label: "🕷️ Misa Alt Matching", prompt: "death note misa black off shoulder match com aquecedores de braço listrados e choker" },
          { label: "🐾 Cat Shirt Match (g)", prompt: "cutesy cat shirt match (g) 🎀 estampa de gatinho e laço fofo Moe Jirai Kei" },
          { label: "⭐ Batman PJs Da Hood", prompt: "batman pjs pajamas da hood y2k (girl) com padrão de estrelas aconchegante" },
          { label: "🖤 Saia Plissada com Pins", prompt: "saia plissada preta estilo Jirai Kei com alfinete de segurança e cinto Y2K" },
          { label: "🔥 Calça Cargo Baggy Y2K", prompt: "calça cargo baggy preta streetwear com correntes e bolsos utilitários" },
        ].map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setInputVal(chip.prompt);
              handleSendPrompt(chip.prompt);
            }}
            disabled={loading}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-purple-500/15 border border-white/[0.08] hover:border-purple-500/30 text-white/70 hover:text-purple-200 transition-all cursor-pointer backdrop-blur-sm shadow-sm active:scale-95 disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Component (Exact from Photo 2, pinned cleanly at bottom) */}
      <div className="shrink-0 pt-1 pb-1">
        <PromptInput
          value={inputVal}
          onChange={(val) => setInputVal(val)}
          onSubmit={(val, meta) => handleSendPrompt(val, meta)}
          loading={loading}
          placeholder={`Descreva a roupa ou item UGC para ${groups.find((g) => g.id === selectedGroupId)?.name || 'sua loja'} (ex: calça cargo baggy ou off shoulder top)...`}
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
