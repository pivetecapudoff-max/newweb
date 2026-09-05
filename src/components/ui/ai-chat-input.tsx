import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Gauge,
  ImagePlus,
  LoaderCircle,
  Mic,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPRING = "all 420ms cubic-bezier(0.175, 0.885, 0.32, 1.15)";

interface Attachment {
  id: string;
  file: File;
  url: string;
}

export interface PromptInputMeta {
  model: "Illusions Intelligence";
  effort: "Rápida" | "Detalhada" | "Profunda";
  attachments: File[];
}

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string, meta: PromptInputMeta) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  loading?: boolean;
  maxAttachments?: number;
}

function AttachmentPreview({
  attachment,
  onOpen,
  onRemove,
}: {
  attachment: Attachment;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
      <button type="button" onClick={onOpen} className="h-full w-full" aria-label={`Visualizar ${attachment.file.name}`}>
        <img src={attachment.url} alt={attachment.file.name} className="h-full w-full object-cover" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white/70 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus:opacity-100"
        aria-label={`Remover ${attachment.file.name}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder = "Pergunte sobre vendas, catálogo ou o próximo drop...",
      className,
      loading = false,
      maxAttachments = 3,
    },
    forwardedRef
  ) => {
    const [expanded, setExpanded] = useState(false);
    const [effortIndex, setEffortIndex] = useState(1);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [preview, setPreview] = useState<Attachment | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevels, setAudioLevels] = useState([0.25, 0.45, 0.7, 0.42, 0.3]);
    const [voiceError, setVoiceError] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const recognitionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const frameRef = useRef<number | null>(null);
    const urlsRef = useRef(new Set<string>());
    const efforts: PromptInputMeta["effort"][] = ["Rápida", "Detalhada", "Profunda"];
    const hasContent = value.trim().length > 0 || attachments.length > 0;

    const setWrapperRef = (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const stopRecording = useCallback(() => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.stop();
      } catch {}
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      setIsRecording(false);
    }, []);

    useEffect(() => {
      return () => {
        stopRecording();
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      };
    }, [stopRecording]);

    useEffect(() => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      textarea.style.height = "0px";
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 56), 150)}px`;
    }, [value, expanded]);

    const addFiles = (files: FileList | null) => {
      if (!files) return;
      setVoiceError("");
      const remaining = Math.max(0, maxAttachments - attachments.length);
      const accepted = Array.from(files)
        .filter((file) => file.type.startsWith("image/") && file.size <= 2 * 1024 * 1024)
        .slice(0, remaining);
      const next = accepted.map((file) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        return { id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, url };
      });
      if (next.length) {
        setAttachments((current) => [...current, ...next]);
        setExpanded(true);
      }
      if (accepted.length < Array.from(files).length) {
        setVoiceError("Use até 3 imagens de no máximo 2 MB cada.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (id: string) => {
      setAttachments((current) => {
        const target = current.find((item) => item.id === id);
        if (target) {
          URL.revokeObjectURL(target.url);
          urlsRef.current.delete(target.url);
          if (preview?.id === target.id) setPreview(null);
        }
        return current.filter((item) => item.id !== id);
      });
    };

    const startRecording = useCallback(async () => {
      setVoiceError("");
      setExpanded(true);
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Recognition || !navigator.mediaDevices?.getUserMedia) {
        setVoiceError("Ditado por voz não está disponível neste navegador.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const updateLevels = () => {
          analyser.getByteFrequencyData(data);
          const step = Math.max(1, Math.floor(data.length / 5));
          setAudioLevels(Array.from({ length: 5 }, (_, index) => Math.max(0.16, data[index * step] / 255)));
          frameRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();

        const recognition = new Recognition();
        recognition.lang = "pt-BR";
        recognition.continuous = true;
        recognition.interimResults = true;
        const startingValue = value.trim();
        let committed = "";
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const transcript = event.results[index][0].transcript;
            if (event.results[index].isFinal) committed += `${transcript} `;
            else interim += transcript;
          }
          onChange([startingValue, committed.trim(), interim.trim()].filter(Boolean).join(" "));
        };
        recognition.onerror = () => {
          setVoiceError("Não consegui ouvir. Verifique a permissão do microfone.");
          stopRecording();
        };
        recognition.onend = stopRecording;
        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
      } catch {
        setVoiceError("Permita o acesso ao microfone para usar o ditado.");
        stopRecording();
      }
    }, [onChange, stopRecording, value]);

    const submit = async () => {
      if (!hasContent || loading || isRecording) return;
      const files = attachments.map((item) => item.file);
      await onSubmit(value.trim(), {
        model: "Illusions Intelligence",
        effort: efforts[effortIndex],
        attachments: files,
      });
      attachments.forEach((item) => {
        URL.revokeObjectURL(item.url);
        urlsRef.current.delete(item.url);
      });
      setAttachments([]);
      setPreview(null);
      setExpanded(false);
    };

    return (
      <>
        <div
          ref={setWrapperRef}
          onFocus={() => setExpanded(true)}
          onBlur={(event) => {
            if (wrapperRef.current?.contains(event.relatedTarget as Node)) return;
            if (!hasContent && !isRecording) setExpanded(false);
          }}
          className={cn("relative mx-auto w-full", className)}
          style={{ maxWidth: expanded ? 760 : 620, transition: SPRING }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
          />

          <div
            className={cn(
              "mx-4 overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#111111] px-3 transition-all duration-300",
              attachments.length && expanded ? "h-[68px] py-2 opacity-100" : "h-0 py-0 opacity-0"
            )}
          >
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                  onOpen={() => setPreview(attachment)}
                  onRemove={() => removeAttachment(attachment.id)}
                />
              ))}
            </div>
          </div>

          <div
            className="relative overflow-hidden border border-white/[0.12] bg-[#0b0b0b] shadow-[0_18px_50px_rgba(0,0,0,0.32)] focus-within:border-blue-400/30 focus-within:shadow-[0_18px_60px_rgba(37,99,235,0.06)]"
            style={{ minHeight: expanded ? 118 : 52, borderRadius: expanded ? 22 : 18, transition: SPRING }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
                if (event.key === "Escape" && !hasContent) setExpanded(false);
              }}
              onClick={() => setExpanded(true)}
              disabled={loading || isRecording}
              placeholder={placeholder}
              aria-label="Consulta para a Illusions Intelligence"
              rows={1}
              className={cn(
                "w-full resize-none bg-transparent px-4 text-sm leading-6 text-white outline-none placeholder:text-white/30 disabled:opacity-60 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                expanded ? "min-h-14 pb-12 pt-3.5" : "h-[50px] py-3.5 pr-14"
              )}
              style={{ transition: SPRING }}
            />

            <div
              className={cn(
                "absolute bottom-2.5 left-3 flex items-center gap-1 transition-all duration-300",
                expanded ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 pointer-events-none"
              )}
            >
              <div className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-white/45">
                <Sparkles className="h-3 w-3 text-blue-300/80" />
                Illusions Intelligence
              </div>
              <button
                type="button"
                onClick={() => setEffortIndex((current) => (current + 1) % efforts.length)}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/75"
                aria-label={`Nível da análise: ${efforts[effortIndex]}`}
              >
                <Gauge className="h-3 w-3" />
                {efforts[effortIndex]}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= maxAttachments}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/75 disabled:pointer-events-none disabled:opacity-25"
                aria-label="Anexar imagens"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
            </div>

            {isRecording && (
              <div className="absolute bottom-3 left-4 flex h-7 items-center gap-[3px]" aria-label="Gravando áudio">
                {audioLevels.map((level, index) => (
                  <span
                    key={index}
                    className="w-1 rounded-full bg-blue-300 transition-[height] duration-75"
                    style={{ height: `${Math.max(5, level * 24)}px` }}
                  />
                ))}
                <span className="ml-2 text-[11px] font-medium text-white/45">Ouvindo...</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (loading) return;
                if (isRecording) stopRecording();
                else if (hasContent) void submit();
                else void startRecording();
              }}
              disabled={loading}
              className={cn(
                "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50",
                hasContent && !isRecording
                  ? "bg-white text-black hover:scale-105 hover:bg-blue-50"
                  : "bg-white/[0.08] text-white/55 hover:bg-white/[0.12] hover:text-white"
              )}
              aria-label={loading ? "Processando" : isRecording ? "Parar gravação" : hasContent ? "Enviar consulta" : "Usar voz"}
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-3 w-3 fill-current" />
              ) : hasContent ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </div>

          {voiceError && <p className="mt-2 px-4 text-[11px] text-amber-200/70">{voiceError}</p>}
        </div>

        {preview && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={`Prévia de ${preview.file.name}`}
            onClick={() => setPreview(null)}
          >
            <img
              src={preview.url}
              alt={preview.file.name}
              className="max-h-[82vh] max-w-[88vw] rounded-2xl border border-white/10 object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/60 transition-colors hover:text-white"
              aria-label="Fechar prévia"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </>
    );
  }
);

PromptInput.displayName = "PromptInput";
