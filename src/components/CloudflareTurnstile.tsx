import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";

interface CloudflareTurnstileProps {
  onSuccess: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  siteKey?: string;
  className?: string;
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

export function CloudflareTurnstile({
  onSuccess,
  onError,
  onExpire,
  siteKey: propSiteKey,
  className = "",
}: CloudflareTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string>(propSiteKey || "");
  const [verified, setVerified] = useState(false);
  const [loadingScript, setLoadingScript] = useState(true);

  // Fetch siteKey from API if not provided via props
  useEffect(() => {
    if (propSiteKey) {
      setSiteKey(propSiteKey);
      return;
    }
    let alive = true;
    fetch("/api/turnstile/config")
      .then((res) => res.json())
      .then((cfg: { siteKey?: string }) => {
        if (alive && cfg.siteKey) {
          setSiteKey(cfg.siteKey);
        }
      })
      .catch(() => {
        // Default to Cloudflare always-pass testing key
        if (alive) setSiteKey("1x00000000000000000000AA");
      });

    return () => {
      alive = false;
    };
  }, [propSiteKey]);

  // Load Cloudflare Turnstile script
  useEffect(() => {
    if (!siteKey) return;

    let script = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => setLoadingScript(false);
      document.head.appendChild(script);
    } else {
      setLoadingScript(false);
    }

    let interval: NodeJS.Timeout | null = null;

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              setVerified(true);
              onSuccess(token);
            },
            "error-callback": (err?: string) => {
              setVerified(false);
              onError?.(err);
            },
            "expired-callback": () => {
              setVerified(false);
              onExpire?.();
            },
            theme: "dark",
            size: "normal",
          });
        } catch {
          // Already rendered or unmounted
        }
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      interval = setInterval(() => {
        if (window.turnstile) {
          if (interval) clearInterval(interval);
          renderWidget();
        }
      }, 150);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return (
    <div className={`space-y-2 select-none ${className}`}>
      {/* Cloudflare Security Header */}
      <div className="flex items-center justify-between text-[11px] text-white/50 px-1 font-medium">
        <div className="flex items-center gap-1.5 text-blue-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-semibold">Proteção Cloudflare Turnstile</span>
        </div>
        <span className="text-[10px] text-white/30">Anti-DDoS &amp; Bot Guard</span>
      </div>

      {/* Widget Container */}
      <div className="flex items-center justify-center p-2 rounded-2xl bg-[#0e0e0e] border border-white/[0.06] min-h-[68px]">
        {loadingScript && !verified && (
          <div className="flex items-center gap-2 text-xs text-white/40 py-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>Iniciando verificação de segurança...</span>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  );
}
