import React, { useEffect, useRef, useState } from "react";
import { BrandMark } from "../components/Logo";
import { PromptInput, type PromptInputMeta } from "../components/ui/ai-chat-input";
import { fetchAccount } from "../lib/api";
import {
  User,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Terminal,
  TrendingUp,
  Target,
  Tags,
  BarChart3,
  Shirt,
  ArrowUpRight,
} from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: string[];
}

export interface AiLog {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  action: string;
  message: string;
  details?: any;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

let cachedChatMessages: ChatMessage[] = [];
let cachedChatLogs: AiLog[] = [];

export function AiAssistantView({ userName }: { userName?: string }) {
  const [activeTab, setActiveTab] = useState<"chat" | "logs">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(() => cachedChatMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AiLog[]>(() => cachedChatLogs);
  const [accountName, setAccountName] = useState(userName || "Conta Roblox");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cachedChatMessages = messages;
  }, [messages]);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/ai/logs");
      if (res.ok) {
        const data = await res.json();
        const incomingLogs = data.logs || [];
        cachedChatLogs = incomingLogs;
        setLogs(incomingLogs);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAccount()
      .then((account) => setAccountName(account.displayName || account.username || account.discord?.name || "Conta Roblox"))
      .catch(() => setAccountName(userName || "Conta Roblox"));
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSend = async (textToSend?: string, meta?: PromptInputMeta) => {
    const text = (textToSend || input).trim();
    const attachedFiles = meta?.attachments || [];
    if ((!text && attachedFiles.length === 0) || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      attachments: attachedFiles.map((file) => file.name),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const attachments = await Promise.all(
        attachedFiles.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          data: await readFileAsBase64(file),
        }))
      );
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, effort: meta?.effort, attachments }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: String(Date.now() + 1),
          role: "assistant",
          content: data.reply || "Resposta recebida do consultor estratégico.",
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (data.logs) setLogs(data.logs);
      } else {
        const errData = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: "assistant",
            content: `⚠️ Erro na resposta: ${errData.error || "Falha na comunicação com o servidor de estratégia."}`,
            timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: `❌ Falha ao conectar ao servidor do Farol: ${err.message}`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
      void fetchLogs();
    }
  };

  const errorCount = logs.filter((l) => l.level === "error").length;

  const starters: {
    title: string;
    description: string;
    prompt: string;
    icon: typeof TrendingUp;
    featured?: boolean;
  }[] = [
    {
      title: "Diagnóstico de Vendas do Grupo",
      description: "Descubra exatamente por que algumas peças vendem e outras não.",
      prompt: "Analise o desempenho das roupas e itens do meu grupo no Roblox. Identifique exatamente por que alguns itens vendem e outros não, comparando títulos, tags, preços e relevância no Catalog Avatar Creator.",
      icon: BarChart3,
      featured: true,
    },
    {
      title: "O que criar agora",
      description: "Tendências de Halloween, peças 2D, acessórios UGC e termos de busca.",
      prompt: "Quais são as principais tendências de Halloween que estão chegando no Roblox para o meu grupo criar agora? Me dê ideias de roupas 2D a 5 R$, acessórios 3D UGC a 65 R$ e as tags virais de SEO.",
      icon: TrendingUp,
    },
    {
      title: "Rumo a 1.000 Robux/dia",
      description: "Priorize as ações com maior impacto na receita.",
      prompt: "Como posso fazer o grupo bater 1.000 Robux por dia?",
      icon: Target,
    },
    {
      title: "Tags e SEO",
      description: "Revise títulos e descrições do catálogo.",
      prompt: "Otimize as descrições e tags do meu catálogo agora",
      icon: Tags,
    },
    {
      title: "Vendas e desempenho",
      description: "Leia o faturamento e os resultados recentes.",
      prompt: "Quanto vendemos hoje e qual nosso faturamento recente?",
      icon: BarChart3,
    },
    {
      title: "Outfits para o CAC",
      description: "Encontre combinações e estilos com potencial.",
      prompt: "Quais estilos e drops de roupas estão em alta no Roblox hoje?",
      icon: Shirt,
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent font-sans text-white">
      <header className="relative z-10 border-b border-white/[0.08] px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400/65">Consultoria</p>
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-white">Estratégia &amp; Crescimento</h1>
          </div>

          <div className="flex items-center gap-5" role="tablist" aria-label="Áreas da consultoria">
          <button
            onClick={() => setActiveTab("chat")}
            role="tab"
            aria-selected={activeTab === "chat"}
            className={`border-b pb-2 text-xs font-medium transition-colors ${
              activeTab === "chat"
                ? "border-white text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            Estratégia
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            role="tab"
            aria-selected={activeTab === "logs"}
            className={`flex items-center gap-1.5 border-b pb-2 text-xs font-medium transition-colors ${
              activeTab === "logs"
                ? "border-white text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Status e logs</span>
            {errorCount > 0 && <span className="text-[10px] font-semibold text-rose-300">{errorCount}</span>}
          </button>

          {messages.length > 0 && activeTab === "chat" && (
            <button
              onClick={() => setMessages([])}
              title="Limpar conversa"
              className="ml-1 flex items-center gap-1.5 text-xs text-white/35 transition-colors hover:text-white/70"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Limpar</span>
            </button>
          )}
          </div>
        </div>
      </header>

      {activeTab === "chat" ? (
        <div
          className={`min-h-0 flex-1 overflow-y-auto scroll-smooth px-5 md:px-8 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${messages.length === 0 ? "flex" : "block"}`}
        >
          {messages.length === 0 ? (
            <section className="mx-auto grid w-full max-w-[1080px] items-center gap-10 py-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14">
              <div className="max-w-md">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] backdrop-blur-md">
                  <BrandMark className="h-6 w-6 text-blue-300" />
                </div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Painel de decisão de {accountName}</p>
                <h2 className="text-3xl font-semibold leading-[1.08] tracking-[-0.05em] text-white sm:text-[38px]">
                  Decisões melhores para o próximo drop.
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/50">
                  Cruze catálogo, vendas e tendências para escolher o que criar, como publicar e onde concentrar esforço.
                </p>
                <div className="mt-7 grid grid-cols-2 gap-5 border-t border-white/[0.08] pt-5">
                  <div>
                    <span className="block text-[10px] uppercase tracking-[0.12em] text-white/30">Meta diária</span>
                    <strong className="mt-1 block text-sm font-semibold text-white/80">1.000 Robux</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-[0.12em] text-white/30">Contexto</span>
                    <strong className="mt-1 block text-sm font-semibold text-white/80">Catálogo + vendas</strong>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/80">Comece por uma análise</h3>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-white/25">5 atalhos</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {starters.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        onClick={() => handleSend(item.prompt)}
                        className={`group rounded-xl border bg-black/25 backdrop-blur-md p-4 text-left transition-all hover:bg-white/[0.06] hover:border-blue-400/30 ${
                          item.featured ? "border-blue-400/20 sm:col-span-2" : "border-white/[0.09]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-white/55 transition-colors group-hover:text-blue-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 text-white/20 transition-colors group-hover:text-blue-300/70" />
                        </div>
                        <strong className="mt-4 block text-sm font-semibold text-white/90">{item.title}</strong>
                        <span className="mt-1.5 block text-xs leading-5 text-white/40">{item.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 py-8">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] backdrop-blur-md">
                      <BrandMark className="h-4 w-4 text-blue-300" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl border p-4 text-sm leading-relaxed backdrop-blur-md ${
                      m.role === "user"
                        ? "border-white/[0.12] bg-white/10 text-white shadow-sm"
                        : "border-white/[0.08] bg-black/40 text-white/90 shadow-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.attachments.map((name) => (
                          <span
                            key={name}
                            className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] text-white/45"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="mt-2 block text-right text-[10px] text-white/25">
                      {m.timestamp}
                    </span>
                  </div>
                  {m.role === "user" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/10 backdrop-blur-md text-white/70">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="mx-auto flex w-full max-w-3xl justify-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] backdrop-blur-md">
                    <BrandMark className="h-4 w-4 text-blue-300" />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md p-4 text-sm text-white/45 shadow-sm">
                    <RotateCcw className="h-3.5 w-3.5 animate-spin text-blue-300/70" />
                    <span>Consultando os dados da loja...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto px-5 py-8 md:px-8 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mb-5 flex items-end justify-between border-b border-white/[0.08] pb-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Atividade técnica</p>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white/85">
                <Terminal className="h-4 w-4 text-blue-400/80" />
                Histórico de execução
              </h3>
            </div>
            <span className="text-xs text-white/35">{logs.length} eventos</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {logs.length === 0 && (
              <div className="border-l border-white/15 py-2 pl-4 text-white/35">Nenhum evento registrado nesta sessão.</div>
            )}
            {logs.map((log) => {
              const icon =
                log.level === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                ) : log.level === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : log.level === "error" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400/80" />
                );

              const badgeColor =
                log.level === "success"
                  ? "text-blue-300"
                  : log.level === "warn"
                  ? "text-amber-300"
                  : log.level === "error"
                  ? "text-rose-300"
                  : "text-blue-300/80";

              return (
                <div key={log.id} className="flex items-start gap-3 border-b border-white/[0.06] px-1 py-3 last:border-b-0">
                  {icon}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] text-white/30">{log.timestamp}</span>
                      <span className={`text-[10px] font-semibold ${badgeColor}`}>{log.action}</span>
                    </div>
                    <p className="break-words leading-relaxed text-white/70">{log.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="relative z-20 border-t border-white/[0.08] bg-transparent px-5 py-3 md:px-8">
        <PromptInput
          value={input}
          onChange={setInput}
          loading={loading}
          onSubmit={(message, meta) => handleSend(message, meta)}
          placeholder="Pergunte sobre vendas, catálogo ou o próximo drop..."
        />
      </footer>
    </div>
  );
}
