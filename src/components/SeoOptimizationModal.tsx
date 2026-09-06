import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Check,
  Copy,
  X,
  ExternalLink,
  Layers,
  TrendingUp,
  Star,
  RefreshCw,
  AlertCircle,
  Eye,
  Tag,
  CheckCircle2,
} from "lucide-react";

export interface SeoOptimizationData {
  visualAnalysis: string;
  strongKeywords: string[];
  titleOptions: { title: string; score: number; reason: string }[];
  bestTitle: string;
  finalDescription: string;
  tags: string[];
  rawText?: string;
}

interface SeoOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId?: number | string;
  imageUrl?: string;
  imageBase64?: string;
  currentTitle?: string;
  itemType?: string;
  groupName?: string;
  onApply?: (data: { title: string; description: string; tags: string[] }) => void;
}

export function SeoOptimizationModal({
  isOpen,
  onClose,
  assetId,
  imageUrl,
  imageBase64,
  currentTitle,
  itemType,
  groupName,
  onApply,
}: SeoOptimizationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SeoOptimizationData | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [selectedDescription, setSelectedDescription] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchSeo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/optimize-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          imageUrl,
          imageBase64,
          title: currentTitle,
          groupName,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.result) {
        throw new Error(json.error || "Falha ao gerar SEO multimodal com IA");
      }
      const r: SeoOptimizationData = json.result;
      setData(r);
      setSelectedTitle(r.bestTitle || currentTitle || "");
      setSelectedDescription(r.finalDescription || "");
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao analisar imagem");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchSeo();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, assetId, imageUrl, imageBase64]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    if (!data) return;
    const fullText = `TÍTULO: ${selectedTitle}\n\nDESCRIÇÃO:\n${selectedDescription}\n\nTAGS:\n${data.tags.join(" ")}`;
    copyToClipboard(fullText, "all");
  };

  const imageSrc = imageBase64
    ? (imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`)
    : imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0a0a0e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Otimização Visual de SEO &amp; Títulos com IA
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Visão Multimodal Ativa
                </span>
              </h2>
              <p className="text-xs text-white/40">
                A IA analisa diretamente a imagem da peça, identifica o estilo estético e ranqueia as melhores opções para o Marketplace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/40 bg-blue-500/10 text-blue-400">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-white">Analisando imagem e mercado UGC...</h3>
              <p className="mt-1 max-w-sm text-xs text-white/40">
                Identificando cores, caimento, estética, termos de busca de alta conversão e calculando notas para 5 variações de título.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-200">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Falha na Análise Visual
              </div>
              <p className="mt-1 text-xs text-rose-200/80">{error}</p>
              <button
                type="button"
                onClick={fetchSeo}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-400/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-400/30"
              >
                <RefreshCw className="h-3 w-3" /> Tentar novamente
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Image Preview & Selected Metadata */}
              <div className="lg:col-span-5 space-y-5">
                {/* Image card */}
                <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center justify-between">
                    <span>Item Analisado</span>
                    {itemType && <span className="text-blue-300">{itemType}</span>}
                  </div>
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/50 flex items-center justify-center">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt="UGC Preview"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="text-center text-white/30">
                        <Layers className="h-10 w-10 mx-auto mb-1 opacity-50" />
                        <span className="text-xs">Visualizando via ID Roblox #{assetId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Selected Title */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-white/80">Título Selecionado</label>
                    <span className={`text-[10px] font-mono ${selectedTitle.length > 50 ? "text-rose-400 font-bold" : "text-white/40"}`}>
                      {selectedTitle.length}/50 caracteres
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedTitle}
                      onChange={(e) => setSelectedTitle(e.target.value.slice(0, 50))}
                      className="flex-1 rounded-xl border border-white/[0.08] bg-[#0b0b10] px-3 py-2 text-xs font-medium text-white outline-none focus:border-blue-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedTitle, "title")}
                      title="Copiar título"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/60 hover:text-white"
                    >
                      {copiedField === "title" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-white/35">
                    Máximo 50 caracteres para garantir 100% de visibilidade sem corte no aplicativo móvel do Roblox.
                  </p>
                </div>

                {/* Description Box */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-white/80">Descrição &amp; Tags</label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedDescription, "desc")}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300"
                    >
                      {copiedField === "desc" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedField === "desc" ? "Copiado!" : "Copiar Descrição"}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={selectedDescription}
                    onChange={(e) => setSelectedDescription(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0b0b10] p-3 text-xs text-white/80 font-mono outline-none focus:border-blue-400/50 resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Visual Analysis, Keywords & 5 Title Options */}
              <div className="lg:col-span-7 space-y-5">
                {/* Visual Analysis Box */}
                {data.visualAnalysis && (
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.04] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 mb-1.5">
                      <Eye className="h-4 w-4 text-blue-400" />
                      ANÁLISE VISUAL DA IA
                    </div>
                    <p className="text-xs leading-relaxed text-white/70 whitespace-pre-line">
                      {data.visualAnalysis}
                    </p>
                  </div>
                )}

                {/* Strong Keywords */}
                {data.strongKeywords?.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/80 mb-2">
                      <Tag className="h-3.5 w-3.5 text-emerald-400" />
                      PALAVRAS-CHAVE MAIS FORTES
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.strongKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/80"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5 Title Options with Scores */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      5 OPÇÕES DE TÍTULOS (Ranqueadas por Potencial Comercial)
                    </div>
                    <span className="text-[10px] text-white/35">Clique para selecionar</span>
                  </div>

                  <div className="space-y-2.5">
                    {data.titleOptions?.map((opt, idx) => {
                      const isSelected = selectedTitle === opt.title;
                      const isWinner = opt.title.toLowerCase() === data.bestTitle.toLowerCase() || idx === 0;

                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setSelectedTitle(opt.title)}
                          className={`group w-full rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-blue-400/60 bg-blue-500/[0.08] shadow-[0_0_0_1px_rgba(96,165,250,0.2)]"
                              : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/40 font-mono">#{idx + 1}</span>
                                <span className="text-xs font-semibold text-white group-hover:text-blue-200">
                                  {opt.title}
                                </span>
                                {isWinner && (
                                  <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                                    Vencedor
                                  </span>
                                )}
                              </div>
                              {opt.reason && (
                                <p className="mt-1 text-[11px] leading-4 text-white/45">
                                  {opt.reason}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="flex items-center gap-0.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs font-bold text-emerald-300 font-mono">
                                <Star className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                                {opt.score}/10
                              </span>
                              <span className="text-[10px] text-white/30 font-mono">
                                {opt.title.length} chars
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags preview */}
                {data.tags?.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white/80">TAGS OTIMIZADAS</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(data.tags.join(" "), "tags")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        {copiedField === "tags" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedField === "tags" ? "Tags Copiadas!" : "Copiar Apenas Tags"}
                      </button>
                    </div>
                    <div className="text-xs text-white/50 font-mono leading-relaxed bg-[#0b0b10] p-3 rounded-xl border border-white/[0.06]">
                      {data.tags.join(" ")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-black/40 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!data || loading}
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.09] disabled:opacity-35"
            >
              {copiedField === "all" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copiedField === "all" ? "Tudo Copiado!" : "Copiar Pacote Completo"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={fetchSeo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.09] disabled:opacity-35"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Recalcular com IA
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white"
            >
              Fechar
            </button>

            {onApply && (
              <button
                type="button"
                disabled={!data || loading}
                onClick={() => {
                  if (data) {
                    onApply({
                      title: selectedTitle,
                      description: selectedDescription,
                      tags: data.tags,
                    });
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                Aplicar no Formulário
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
