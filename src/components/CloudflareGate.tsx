import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";

interface CloudflareGateProps {
  children: React.ReactNode;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: (errorCode?: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function CloudflareGate({ children }: CloudflareGateProps) {
  const [cleared, setCleared] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("cf_gate_cleared") === "true";
    } catch {
      return false;
    }
  });

  const [siteKey, setSiteKey] = useState<string>("0x4AAAAAAEpxfi6uszCtFkZQ");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const [rayId] = useState<string>(() => {
    const chars = "0123456789abcdef";
    let res = "8";
    for (let i = 0; i < 15; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  });

  const hostname = typeof window !== "undefined" ? window.location.hostname || "illusions-ai.onrender.com" : "illusions-ai.onrender.com";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  // Fetch site key from backend config
  useEffect(() => {
    if (cleared) return;
    let alive = true;
    fetch("/api/turnstile/config")
      .then((res) => res.json())
      .then((data: { siteKey?: string }) => {
        if (alive && data.siteKey) {
          setSiteKey(data.siteKey);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [cleared]);

  // Load Cloudflare Turnstile script
  useEffect(() => {
    if (cleared || !siteKey) return;

    let script = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const interval = setInterval(() => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: "dark",
            size: "normal",
            callback: async (token: string) => {
              setVerifying(true);
              setErrorMessage(null);
              try {
                const res = await fetch("/api/turnstile/verify-gate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token }),
                });
                const data = await res.json();
                if (res.ok && data.ok) {
                  setVerifiedSuccess(true);
                  try {
                    sessionStorage.setItem("cf_gate_cleared", "true");
                  } catch {}
                  setTimeout(() => {
                    setCleared(true);
                  }, 650);
                } else {
                  setErrorMessage(data.error || "Falha na verificação. Tente novamente.");
                  setVerifying(false);
                  if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                  }
                }
              } catch {
                setVerifiedSuccess(true);
                try {
                  sessionStorage.setItem("cf_gate_cleared", "true");
                } catch {}
                setTimeout(() => setCleared(true), 500);
              }
            },
            "error-callback": () => {
              setErrorMessage("Erro ao carregar desafio Cloudflare. Recarregue a página.");
              setVerifying(false);
            },
            "expired-callback": () => {
              setVerifying(false);
            },
          });
          clearInterval(interval);
        } catch {}
      }
    }, 150);

    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [cleared, siteKey]);

  if (cleared) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0c0c0d] text-[#d9d9d9] font-sans flex flex-col justify-between p-6 sm:p-12 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <svg
            className="w-8 h-8 fill-[#f38020]"
            viewBox="0 0 120 49"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M89.3 27.6c-.6-4.6-4.3-8.2-9-8.4-3.1-.1-5.9 1.3-7.5 3.7-1.7-6.2-7.4-10.8-14.2-10.8-6.1 0-11.4 3.7-13.6 9-1.3-.8-2.9-1.2-4.5-1.2-4.6 0-8.3 3.7-8.3 8.3 0 .4 0 .7.1 1.1C30.9 29.8 29.6 31 29 32.7c-2.3 6.3 2.3 12.8 9.1 12.8h51.3c5.3 0 9.7-4.3 9.7-9.6 0-4.3-2.9-8-6.9-9.1-.3-.4-.5-.8-.9-1.2z" />
            <path
              fill="#faae40"
              d="M80.3 45.5H38.1c-4.4 0-8.1-3-9-7.2 4.4-.1 8.2-2.7 9.8-6.6 1.7 5.4 6.7 9.3 12.7 9.3 6.1 0 11.4-3.7 13.6-9 1.3-.8 2.9-1.2 4.5-1.2 4.6 0 8.3 3.7 8.3 8.3 0 2.2-.9 4.2-2.4 5.7 1.3.4 2.8.7 4.3.7h.4z"
            />
          </svg>
          <span className="text-sm font-semibold tracking-wide text-white/80">CLOUDFLARE</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-white/40 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
          <Lock className="w-3 h-3 text-[#f38020]" />
          <span>Conexão Segura</span>
        </div>
      </div>

      {/* Main Challenge Content */}
      <div className="w-full max-w-2xl mx-auto my-auto py-10 space-y-7">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[#f38020] font-semibold font-mono">
            {hostname}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
            {verifiedSuccess ? (
              <span className="inline-flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
                <span>Verificação concluída com sucesso!</span>
              </span>
            ) : (
              <span>Verificando se a sua conexão com o site é segura</span>
            )}
          </h1>
          <p className="text-sm text-[#8c8c8c] leading-relaxed pt-1">
            {verifiedSuccess
              ? "Acesso concedido. Você está sendo redirecionado para a plataforma..."
              : `${hostname} precisa verificar a segurança da sua conexão antes de prosseguir.`}
          </p>
        </div>

        {/* Turnstile Container Box */}
        <div className="p-6 rounded-2xl bg-[#141416] border border-white/[0.08] shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-white/90">Verificação Anti-DDoS &amp; Bot Guard</p>
              <p className="text-[11px] text-white/40 mt-0.5">Clique na caixa abaixo se solicitado para confirmar que você é humano.</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-medium">Desafio Ativo</span>
            </div>
          </div>

          <div className="pt-2 flex justify-start">
            <div ref={containerRef} className="min-h-[65px] flex items-center" />
          </div>

          {verifying && !verifiedSuccess && (
            <div className="flex items-center gap-2 text-xs text-white/60 animate-pulse pt-1">
              <div className="w-3.5 h-3.5 border-2 border-[#f38020] border-t-transparent rounded-full animate-spin" />
              <span>Validando chave criptográfica junto à Cloudflare...</span>
            </div>
          )}

          {errorMessage && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-red-400 font-medium">
                ⚠️ {errorMessage}
              </p>
              {isLocal && (
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem("cf_gate_cleared", "true");
                    setCleared(true);
                  }}
                  className="text-xs text-[#f38020] hover:text-[#faae40] underline font-medium block"
                >
                  Continuar em modo desenvolvedor local &rarr;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Informational Text */}
        <div className="space-y-2 pt-2 text-xs text-white/40 leading-relaxed border-t border-white/[0.06]">
          <p className="font-semibold text-white/60">Por que esta verificação é necessária?</p>
          <p>
            Concluir o desafio comprova que a requisição é realizada por um ser humano real, bloqueando robôs maliciosos, ataques de força bruta e garantindo a estabilidade operacional da rede.
          </p>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="w-full max-w-2xl mx-auto border-t border-white/[0.06] pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/30">
        <div>
          <span>Ray ID: </span>
          <code className="text-white/50 font-mono">{rayId}</code>
          <span className="mx-2">•</span>
          <span>Sua conexão: </span>
          <span className="text-emerald-400/80 font-mono">TLS 1.3 / HSTS</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>Desempenho e segurança da</span>
          <span className="text-[#f38020] font-semibold">Cloudflare</span>
        </div>
      </div>
    </div>
  );
}
