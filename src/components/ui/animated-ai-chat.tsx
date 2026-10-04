import React, { useEffect, useRef, useCallback, useState, useTransition } from "react";
import { cn } from "../../lib/utils";
import {
  Film,
  Sparkles,
  Sliders,
  Download,
  Flame,
  Paperclip,
  SendIcon,
  XIcon,
  LoaderIcon,
  Command,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
  action?: () => void;
}

interface AnimatedAIChatProps {
  onSendMessage?: (message: string) => void;
  onSelectCommand?: (commandPrefix: string) => void;
  onFileUpload?: (file: File) => void;
  isProcessing?: boolean;
  customSuggestions?: CommandSuggestion[];
  placeholder?: string;
  className?: string;
}

export function AnimatedAIChat({
  onSendMessage,
  onSelectCommand,
  onFileUpload,
  isProcessing = false,
  customSuggestions,
  placeholder = "Descreva a dança/movimento ou use /mocap...",
  className = "",
}: AnimatedAIChatProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [internalTyping, setInternalTyping] = useState(false);
  const [, startTransition] = useTransition();
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 180,
  });

  const defaultSuggestions: CommandSuggestion[] = [
    {
      icon: <Film className="w-4 h-4 text-blue-400" />,
      label: "Processar Vídeo Mocap",
      description: "Extrai poses 3D de arquivo de vídeo para Roblox R15",
      prefix: "/mocap",
    },
    {
      icon: <Flame className="w-4 h-4 text-amber-400" />,
      label: "Preset de Emote",
      description: "Carrega coreografia rítmica ou acrobática de teste",
      prefix: "/preset",
    },
    {
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      label: "Anti-Jitter (1€ Filter)",
      description: "Aplica estabilização temporal de curvas e articulações",
      prefix: "/smooth",
    },
    {
      icon: <Sliders className="w-4 h-4 text-purple-400" />,
      label: "Ground Foot Pinning (IK)",
      description: "Trava pés no solo eliminando deslizamento de animação",
      prefix: "/foot-ik",
    },
    {
      icon: <Download className="w-4 h-4 text-sky-400" />,
      label: "Exportar RBXMX Studio",
      description: "Gera arquivo KeyframeSequence oficial do Roblox",
      prefix: "/export",
    },
  ];

  const commandSuggestions = customSuggestions || defaultSuggestions;

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandPalette(true);
      const matching = commandSuggestions.findIndex((cmd) => cmd.prefix.startsWith(value));
      setActiveSuggestion(matching >= 0 ? matching : -1);
    } else {
      setShowCommandPalette(false);
    }
  }, [value, commandSuggestions]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const cmdBtn = document.querySelector("[data-mocap-command-button]");
      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !cmdBtn?.contains(target)
      ) {
        setShowCommandPalette(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev < commandSuggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev > 0 ? prev - 1 : commandSuggestions.length - 1));
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          selectCommandSuggestion(activeSuggestion);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = () => {
    const msg = value.trim();
    if (!msg) return;

    if (onSendMessage) {
      onSendMessage(msg);
    }

    startTransition(() => {
      setInternalTyping(true);
      setTimeout(() => {
        setInternalTyping(false);
        setValue("");
        adjustHeight(true);
      }, 1200);
    });
  };

  const selectCommandSuggestion = (index: number) => {
    const cmd = commandSuggestions[index];
    setValue(cmd.prefix + " ");
    setShowCommandPalette(false);
    if (cmd.action) cmd.action();
    if (onSelectCommand) onSelectCommand(cmd.prefix);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachments((prev) => [...prev, file.name]);
      if (onFileUpload) onFileUpload(file);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const isBusy = isProcessing || internalTyping;

  return (
    <div className={cn("w-full relative flex flex-col items-center", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-full relative">
        <motion.div
          className="relative backdrop-blur-2xl bg-[#09090b]/80 rounded-2xl border border-white/[0.08] shadow-2xl transition-all"
          initial={{ scale: 0.99, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Command Palette Dropdown */}
          <AnimatePresence>
            {showCommandPalette && (
              <motion.div
                ref={commandPaletteRef}
                className="absolute left-3 right-3 bottom-full mb-2 backdrop-blur-xl bg-[#0a0a0c]/95 rounded-xl z-50 shadow-2xl border border-blue-500/20 overflow-hidden"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
              >
                <div className="p-1.5 space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-blue-400/80 font-bold border-b border-white/[0.05]">
                    Comandos Rápidos Farol Mocap
                  </div>
                  {commandSuggestions.map((suggestion, index) => (
                    <motion.div
                      key={suggestion.prefix}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                        activeSuggestion === index
                          ? "bg-blue-600/20 text-white border border-blue-500/30"
                          : "text-white/70 hover:bg-white/5 border border-transparent"
                      )}
                      onClick={() => selectCommandSuggestion(index)}
                    >
                      <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                        {suggestion.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white/95">{suggestion.label}</div>
                        <div className="text-[11px] text-white/40 truncate">{suggestion.description}</div>
                      </div>
                      <div className="text-[10px] font-mono text-blue-400/80 px-2 py-0.5 rounded bg-blue-500/10">
                        {suggestion.prefix}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Textarea Area */}
          <div className="p-3 sm:p-4">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={placeholder}
              rows={1}
              className={cn(
                "w-full px-2 py-1.5 resize-none bg-transparent border-none text-white text-sm outline-none placeholder:text-white/30",
                "focus:ring-0 focus:outline-none"
              )}
            />
          </div>

          {/* File Attachments */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                className="px-4 pb-3 flex gap-2 flex-wrap"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {attachments.map((file, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-2 text-xs bg-blue-500/10 border border-blue-500/20 py-1 px-2.5 rounded-lg text-blue-200"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Film className="w-3.5 h-3.5 text-blue-400" />
                    <span className="truncate max-w-[200px]">{file}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Toolbar */}
          <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-between gap-3 bg-white/[0.01]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAttachClick}
                className="p-2 text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer group relative"
                title="Carregar vídeo de referência (MP4/WebM)"
              >
                <Paperclip className="w-4 h-4 text-blue-400" />
              </button>

              <button
                type="button"
                data-mocap-command-button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCommandPalette((prev) => !prev);
                }}
                className={cn(
                  "p-2 text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs",
                  showCommandPalette && "bg-blue-600/20 text-blue-300"
                )}
                title="Abrir Comandos Rápidos"
              >
                <Command className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] text-white/50 font-mono">/comandos</span>
              </button>
            </div>

            <motion.button
              type="button"
              onClick={handleSendMessage}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isBusy || (!value.trim() && attachments.length === 0)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                value.trim() || attachments.length > 0
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              )}
            >
              {isBusy ? (
                <LoaderIcon className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <SendIcon className="w-3.5 h-3.5" />
              )}
              <span>{isBusy ? "Processando..." : "Gerar Emote"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Ambient Subtle Glow */}
        {inputFocused && (
          <motion.div
            className="fixed w-[36rem] h-[36rem] rounded-full pointer-events-none z-0 opacity-[0.03] bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 blur-[110px]"
            animate={{
              x: mousePosition.x - 300,
              y: mousePosition.y - 300,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 150,
              mass: 0.5,
            }}
          />
        )}
      </div>
    </div>
  );
}
