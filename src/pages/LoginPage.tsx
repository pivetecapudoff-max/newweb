import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AuthForm } from "../components/ui/sign-in-1";
import { discordLoginHref, fetchAccount } from "../lib/api";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { CloudflareTurnstile } from "../components/CloudflareTurnstile";

const IconDiscord = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [verifyingTurnstile, setVerifyingTurnstile] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAccount()
      .then((acc) => {
        if (!alive) return;
        if (acc && acc.discord) {
          const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/painel/dashboard";
          navigate(from, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setChecking(false);
      });

    return () => {
      alive = false;
    };
  }, [navigate, location]);

  const handleTurnstileSuccess = async (token: string) => {
    setGateError(null);
    setVerifyingTurnstile(true);
    try {
      const res = await fetch("/api/turnstile/verify-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTurnstileToken(token);
      } else {
        setGateError(data.error || "Falha na validação de segurança. Tente novamente.");
        setTurnstileToken(null);
      }
    } catch {
      setTurnstileToken(token);
    } finally {
      setVerifyingTurnstile(false);
    }
  };

  const handleDiscordLogin = () => {
    if (!turnstileToken) {
      setGateError("Por favor, conclua a confirmação que é humano no desafio acima.");
      return;
    }
    window.location.href = discordLoginHref();
  };

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-transparent select-none">
        <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-transparent select-none relative z-10">
      <div className="w-full max-w-sm mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Voltar para o inicio</span>
        </Link>
      </div>

      {gateError && (
        <div className="w-full max-w-sm mb-3 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-medium animate-in fade-in">
          ⚠️ {gateError}
        </div>
      )}

      <div className="w-full max-w-sm mb-3">
        <CloudflareTurnstile
          onSuccess={handleTurnstileSuccess}
          onError={(err) => {
            setTurnstileToken(null);
            setGateError(err || "Erro no desafio Cloudflare.");
          }}
          onExpire={() => {
            setTurnstileToken(null);
            setGateError("A verificação expirou. Clique novamente para confirmar.");
          }}
        />
      </div>

      <AuthForm
        className="w-full"
        logoSrc="/favicon.svg"
        logoAlt="Illusions AI"
        title="Acessar Illusions AI"
        description="O login é obrigatório para acessar a plataforma. Conecte sua conta Discord para continuar."
        primaryAction={{
          label: verifyingTurnstile
            ? "Verificando proteção Cloudflare..."
            : turnstileToken
            ? "Entrar com Discord"
            : "Confirme que é humano acima",
          icon: turnstileToken ? (
            <IconDiscord className="mr-2.5 h-5 w-5 fill-white" />
          ) : (
            <Lock className="mr-2.5 h-4 w-4 text-white/40" />
          ),
          onClick: handleDiscordLogin,
          disabled: !turnstileToken || verifyingTurnstile,
        }}
        footerContent={
          <div className="space-y-3">
            <p className="text-xs text-white/40 leading-relaxed">
              {turnstileToken ? (
                <span className="text-emerald-400 flex items-center justify-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verificação concluída. Clique acima para entrar.
                </span>
              ) : (
                "O acesso aos módulos operacionais é restrito aos usuários que concluem a verificação de segurança."
              )}
            </p>
            <div className="flex items-center justify-center gap-3 text-[11px] text-white/30">
              <a href="#" className="hover:text-blue-400 transition-colors">Termos de Uso</a>
              <span>•</span>
              <a href="#" className="hover:text-blue-400 transition-colors">Privacidade</a>
              <span>•</span>
              <a href="#" className="hover:text-blue-400 transition-colors">Suporte</a>
            </div>
          </div>
        }
      />
    </div>
  );
}

export default LoginPage;
