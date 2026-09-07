import React, { useEffect, useState } from "react";
import { AlertCircle, CircleCheck, Info, LoaderCircle, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;
let activeToasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notifyListeners() {
  listeners.forEach((listener) => listener([...activeToasts]));
}

export const toastManager = {
  add(toast: Omit<ToastItem, "id">): string {
    const id = "toast_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    const item: ToastItem = { ...toast, id };
    activeToasts = [...activeToasts, item];
    notifyListeners();

    const duration = toast.duration ?? (toast.type === "error" ? 5000 : 4000);
    if (toast.type !== "loading" && duration > 0) {
      setTimeout(() => {
        toastManager.dismiss(id);
      }, duration);
    }
    return id;
  },

  success(title: string, description?: string, options?: { duration?: number }): string {
    return toastManager.add({
      type: "success",
      title,
      description,
      duration: options?.duration ?? 4000,
    });
  },

  error(title: string, description?: string, options?: { duration?: number }): string {
    return toastManager.add({
      type: "error",
      title,
      description,
      duration: options?.duration ?? 5500,
    });
  },

  info(title: string, description?: string, options?: { duration?: number }): string {
    return toastManager.add({
      type: "info",
      title,
      description,
      duration: options?.duration ?? 4000,
    });
  },

  loading(title: string, description?: string): string {
    return toastManager.add({
      type: "loading",
      title,
      description,
      duration: 0,
    });
  },

  update(id: string, patch: Partial<Omit<ToastItem, "id">>) {
    activeToasts = activeToasts.map((t) => (t.id === id ? { ...t, ...patch } : t));
    notifyListeners();

    const duration = patch.duration ?? (patch.type === "error" ? 5000 : 4000);
    if (patch.type && patch.type !== "loading" && duration > 0) {
      setTimeout(() => {
        toastManager.dismiss(id);
      }, duration);
    }
  },

  dismiss(id: string) {
    activeToasts = activeToasts.filter((t) => t.id !== id);
    notifyListeners();
  },

  promise<T>(
    promise: Promise<T>,
    options: {
      loading: { title: string; description?: string };
      success: (data: T) => { title: string; description?: string };
      error: (err: any) => { title: string; description?: string };
    }
  ): Promise<T> {
    const id = toastManager.loading(options.loading.title, options.loading.description);
    return promise
      .then((data) => {
        const res = options.success(data);
        toastManager.update(id, {
          type: "success",
          title: res.title,
          description: res.description,
          duration: 4000,
        });
        return data;
      })
      .catch((err) => {
        const res = options.error(err);
        toastManager.update(id, {
          type: "error",
          title: res.title,
          description: res.description,
          duration: 5500,
        });
        throw err;
      });
  },
};

export const toast = toastManager;
export const CircleCheckIcon = CircleCheck;

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: ToastListener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      {/* Toast container in the bottom-right corner */}
      <aside
        aria-live="polite"
        aria-label="Avisos do sistema"
        className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none max-w-[380px] w-full px-3 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {items.map((t) => {
            const isSuccess = t.type === "success";
            const isError = t.type === "error";
            const isLoading = t.type === "loading";
            const accentBg = isSuccess
              ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
              : isError
              ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
              : isLoading
              ? "bg-blue-500 shadow-[0_0_8px_#3b82f6]"
              : "bg-purple-500 shadow-[0_0_8px_#a855f7]";

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.9, transition: { duration: 0.16 } }}
                className="pointer-events-auto w-full select-none rounded-2xl border border-white/[0.12] bg-[#0a0a0a]/95 text-white shadow-2xl shadow-black/90 backdrop-blur-2xl p-3.5 flex items-start gap-3 transition-colors hover:border-white/[0.22] relative overflow-hidden group"
              >
                <div className={"absolute left-0 top-0 bottom-0 w-1 " + accentBg} />

                <div className="shrink-0 mt-0.5 pl-1">
                  {isSuccess && (
                    <CircleCheck className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                  )}
                  {isError && (
                    <AlertCircle className="w-5 h-5 text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                  )}
                  {isLoading && (
                    <LoaderCircle className="w-5 h-5 text-blue-400 animate-spin" />
                  )}
                  {!isSuccess && !isError && !isLoading && (
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <div className="text-xs font-bold text-white tracking-tight leading-snug">
                    {t.title}
                  </div>
                  {t.description && (
                    <div className="text-[11px] text-white/60 leading-relaxed mt-0.5 break-words">
                      {t.description}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toastManager.dismiss(t.id)}
                  className="shrink-0 text-white/30 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors -mr-1 -mt-1 cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </aside>
    </>
  );
}
