import {
  ArrowUp,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Telescope,
  Trash2,
  X,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Info,
  Terminal,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AiLog {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  action: string;
  message: string;
  details?: any;
}

export interface AiChatModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AiChatModal({ isOpen: externalIsOpen, onClose }: AiChatModalProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const handleClose = () => {
    if (onClose) onClose();
    setInternalIsOpen(false);
  };
  const [activeTab, setActiveTab] = useState<"chat" | "status">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "That's the classic streaming scroll problem. Wrap your message list in `MessageScroller` and turn on `autoScroll` — the viewport pins to the bottom as tokens arrive so users always see the latest sentence.\n\nThe real trick is disabling auto-scrolls while the user is actively reading off the bottom. The simplest pattern is tracking whether `scrollTop + clientHeight >= scrollHeight - 30px` right before you append a new token. If they scrolled up, stay put; if they're near the bottom, glide down. That prevents jarring jumps.",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [optimizing, setOptimizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  // Close plus menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll logs periodically
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/ai/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchLogs();
      const interval = setInterval(fetchLogs, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: String(Date.now() + 1),
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (data.logs) setLogs(data.logs);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: "assistant",
            content: `⚠️ Erro: ${errData.error || "Falha na resposta da IA."}`,
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
          content: `⚠️ Erro de conexão: ${err.message}`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
      void fetchLogs();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "fresh",
        role: "assistant",
        content: "Chat reiniciado! Como posso ajudar você hoje com o catálogo ou grupo?",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleClearLogs = async () => {
    try {
      await fetch("/api/ai/logs", { method: "DELETE" });
      setLogs([]);
    } catch {
      // ignore
    }
  };

  const handleTriggerOptimize = async () => {
    setShowPlusMenu(false);
    setActiveTab("status");
    setOptimizing(true);
    try {
      await fetch("/api/ai/optimize", { method: "POST" });
      await fetchLogs();
    } catch {
      // ignore
    } finally {
      setOptimizing(false);
    }
  };

  const errorCount = logs.filter((l) => l.level === "error").length;

  return (
    <>
      {/* Floating launcher button in bottom right if closed */}
      {/* Floating launcher button in bottom right if closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setInternalIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-neutral-900 to-black px-4 py-3 text-sm font-medium text-white shadow-2xl hover:scale-105 transition-all"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span>AI Assistant</span>
          {errorCount > 0 && (
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[11px] font-semibold text-rose-400">
              {errorCount}
            </span>
          )}
        </button>
      )}

      {/* Main Chat / Status Window (matches the uploaded image precisely) */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[640px] w-[390px] flex-col overflow-hidden rounded-[26px] bg-[#121212] text-white shadow-2xl backdrop-blur-2xl">
          {/* Top Header */}
          <div className="flex items-start justify-between bg-[#161616]/70 px-5 pt-4 pb-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-white">New Chat</h2>
              <p className="text-[12.5px] text-[#78909c]">How can I help you today?</p>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Reset/Reload Button */}
              <button
                type="button"
                onClick={handleClearChat}
                title="Reset Chat"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-neutral-400 hover:bg-white/10 hover:text-white transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                title="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-neutral-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs: Chat vs Status & Erros */}
          <div className="flex bg-[#141414] px-4 py-1.5 text-[12px]">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 rounded-lg py-1.5 font-medium transition ${
                activeTab === "chat" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("status")}
              className={`flex-1 rounded-lg py-1.5 font-medium flex items-center justify-center gap-1.5 transition ${
                activeTab === "status" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Status & Erros</span>
              {errorCount > 0 && (
                <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] text-rose-400">
                  {errorCount}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: CHAT VIEW */}
          {activeTab === "chat" && (
            <div className="relative flex flex-1 flex-col overflow-hidden">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col">
                    {msg.role === "user" ? (
                      <div className="ml-auto max-w-[85%] rounded-[18px] bg-[#272727] px-4 py-3 text-[13.5px] leading-relaxed text-[#f0f0f0] shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="mr-auto max-w-[95%] text-[13.5px] leading-relaxed text-[#cfcfcf] whitespace-pre-line">
                        {msg.content}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-[12px] text-sky-400 animate-pulse">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>IA executando ação e registrando status...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Plus Button Action Menu (Popup like image) */}
              {showPlusMenu && (
                <div
                  ref={plusMenuRef}
                  className="absolute bottom-16 left-4 z-50 w-56 overflow-hidden rounded-2xl bg-[#1e1e1e] p-1.5 shadow-2xl backdrop-blur-xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      handleSend("Otimize as descrições e SEO de todas as roupas do meu grupo agora.");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/5 hover:text-white"
                  >
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span>Otimizar Catálogo (SEO)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      handleSend("Quanto o grupo faturou hoje e nos últimos 7 dias?");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/5 hover:text-white"
                  >
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    <span>Ver Faturamento & Vendas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      handleSend("Quais roupas e palavras-chave estão em alta no catálogo hoje?");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/5 hover:text-white"
                  >
                    <Telescope className="h-4 w-4 text-blue-500" />
                    <span>Deep Research (Tendências)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      handleSend("Me dê ideias de 3 avatares virais para postar no TikTok do meu grupo.");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/5 hover:text-white"
                  >
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span>Ideias de Vídeo TikTok</span>
                  </button>
                </div>
              )}

              {/* Bottom Input Pill Container (Exact style from image) */}
              <div className="p-3 bg-gradient-to-t from-[#121212] via-[#121212]/90 to-transparent">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center rounded-full bg-[#222222] p-1.5 pl-3 transition shadow-inner"
                >
                  {/* Circular '+' Button */}
                  <button
                    type="button"
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  {/* Input */}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte ou peça uma ação à IA…"
                    className="flex-1 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-500"
                  />

                  {/* Circular Up Arrow Send Button */}
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition shrink-0"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: STATUS & ERROS VIEW (Requested by User) */}
          {activeTab === "status" && (
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              {/* Status Header Actions */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">Feed de Ações & Erros</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-neutral-300">
                    {logs.length} logs
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchLogs}
                    title="Atualizar Logs"
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    title="Limpar Logs"
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Action Button inside Status */}
              <div className="mb-3">
                <button
                  type="button"
                  disabled={optimizing}
                  onClick={handleTriggerOptimize}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-400/20 py-2 text-[12.5px] font-medium text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50 transition"
                >
                  <Zap className={`h-3.5 w-3.5 ${optimizing ? "animate-spin" : ""}`} />
                  <span>{optimizing ? "Otimizando catálogo..." : "Forçar Varredura & Otimização de SEO"}</span>
                </button>
              </div>

              {/* Live Logs Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11.5px]">
                {logs.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 font-sans text-[13px]">
                    Nenhum log registrado ainda.
                  </div>
                ) : (
                  logs.map((log) => {
                    let badgeColor = "bg-blue-600/20 text-blue-400";
                    let icon = <Info className="h-3 w-3" />;

                    if (log.level === "success") {
                      badgeColor = "bg-emerald-500/20 text-emerald-400";
                      icon = <CheckCircle2 className="h-3 w-3" />;
                    } else if (log.level === "warn") {
                      badgeColor = "bg-amber-500/20 text-amber-400";
                      icon = <AlertTriangle className="h-3 w-3" />;
                    } else if (log.level === "error") {
                      badgeColor = "bg-rose-500/20 text-rose-400";
                      icon = <AlertTriangle className="h-3 w-3" />;
                    }

                    return (
                      <div
                        key={log.id}
                        className="rounded-xl bg-[#171717] p-2.5 space-y-1 transition hover:bg-[#1f1f1f]"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor}`}>
                            {icon}
                            <span>{log.action}</span>
                          </span>
                          <span className="text-[10px] text-neutral-500">{log.timestamp}</span>
                        </div>
                        <p className="text-[#dcdcdc] leading-relaxed font-sans">{log.message}</p>
                        {log.details && (
                          <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-1 text-[10px] text-neutral-400">
                            {typeof log.details === "object"
                              ? JSON.stringify(log.details, null, 2)
                              : String(log.details)}
                          </pre>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
