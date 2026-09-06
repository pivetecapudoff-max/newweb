import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Bot,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Lock,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { DotButton } from "./ui/DotButton";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  discordName?: string;
  discordAvatar?: string | null;
  isRobloxConnected?: boolean;
}

export function OnboardingModal({
  isOpen,
  onClose,
  discordName,
  discordAvatar,
  isRobloxConnected = false,
}: OnboardingModalProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem("illusions_onboarding_dismissed", "true");
    }
    onClose();
  };

  const handleGoToAccount = () => {
    handleFinish();
    navigate("/painel/conta");
  };

  const steps = [
    {
      badge: "Boas-vindas",
      title: `Bem-vindo ao Illusions AI${discordName ? `, @${discordName}` : ""}!`,
      subtitle: "Sua central definitiva de inteligência UGC, métricas de vendas e automação no Roblox.",
      icon: Sparkles,
      iconColor: "text-purple-400 bg-purple-500/15 border-purple-500/30",
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
            O <strong>Illusions AI</strong> foi desenvolvido para criadores e marcas acelerarem seus resultados no catálogo do Roblox. Aqui você tem controle total sobre suas receitas, posicionamento de busca e auditoria de grupos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Métricas em Tempo Real</h4>
                <p className="text-[11px] text-white/50 mt-0.5">Vendas, Robux pendentes e faturamento detalhado por grupo.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Otimização SEO com IA</h4>
                <p className="text-[11px] text-white/50 mt-0.5">Títulos magnéticos e tags geradas para ranquear no catálogo.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Multi-Grupos</h4>
                <p className="text-[11px] text-white/50 mt-0.5">Gerencie lojas principais, cargos de membros e permissões de postagem.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Segurança Blindada</h4>
                <p className="text-[11px] text-white/50 mt-0.5">Autenticação OAuth2 Discord com cookies protegidos em trânsito.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "Passo 1 de 3",
      title: "Como Conectar sua Conta Roblox",
      subtitle: "Para puxar seu catálogo e dados de vendas, você precisa autenticar sua conta.",
      icon: Lock,
      iconColor: "text-blue-400 bg-blue-500/15 border-blue-500/30",
      content: (
        <div className="space-y-4 text-left">
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 leading-relaxed">
            <span className="font-semibold text-white">Importante:</span> O Illusions usa a credencial <code>.ROBLOSECURITY</code> apenas para consultar as APIs oficiais do Roblox e sincronizar seus grupos e catálogo.
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-6 h-6 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="text-xs text-white/80">
                Abra o <a href="https://www.roblox.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">roblox.com <ExternalLink className="w-3 h-3" /></a> no navegador onde sua conta está logada.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-6 h-6 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="text-xs text-white/80">
                Pressione <strong>F12</strong> (ou botão direito &gt; <em>Inspecionar</em>). Acesse a aba <strong>Application</strong> (ou <em>Armazenamento</em>) &gt; <strong>Cookies</strong> &gt; <code>https://www.roblox.com</code>.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-6 h-6 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="text-xs text-white/80">
                Localize <strong>.ROBLOSECURITY</strong>. Dê <strong>dois cliques</strong> no campo de valor, aperte <strong>Ctrl + A</strong> (para selecionar todo o texto sem truncar) e <strong>Ctrl + C</strong>.
                <p className="text-[11px] text-white/40 mt-1">
                  O valor deve começar com <code>_|WARNING:-DO-NOT-SHARE-THIS...</code> e ter mais de 800 caracteres.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-6 h-6 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0">
                4
              </div>
              <div className="text-xs text-white/80">
                Vá até a aba <strong>Perfil &amp; Contas</strong> e cole o cookie no formulário para sincronizar instantaneamente!
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "Passo 2 de 3",
      title: "Otimizador SEO & IA Gemini",
      subtitle: "Aumente as visualizações e vendas dos seus itens usando inteligência artificial.",
      icon: Bot,
      iconColor: "text-purple-400 bg-purple-500/15 border-purple-500/30",
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
            Com nosso motor de SEO inteligente, você atualiza itens individuais ou coleções inteiras com descrições ricas em palavras-chave que o algoritmo de busca do Roblox adora.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Motor Duplo de Publicação</span>
              </div>
              <p className="text-[11px] text-white/60 mt-1">
                Suporta tanto o endpoint clássico (<code>develop.roblox.com</code>) quanto a nova API Open Cloud (<code>apis.roblox.com</code>) para acessórios 3D UGC.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                <span>Análise de Tendências do Catálogo</span>
              </div>
              <p className="text-[11px] text-white/60 mt-1">
                Veja quais termos estão gerando mais cliques e adapte o inventário do seu grupo antes da concorrência.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "Passo 3 de 3",
      title: "Tudo Pronto para Começar!",
      subtitle: "Sua conta do Discord está conectada. Agora é só sincronizar o Roblox.",
      icon: CheckCircle2,
      iconColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      content: (
        <div className="space-y-4 text-center py-2">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-white">Ambiente Preparado</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Você pode rever estas instruções a qualquer momento clicando no botão <strong>Guia da Plataforma</strong> no menu lateral.
            </p>
          </div>

          <div className="pt-3">
            <DotButton
              type="button"
              onClick={handleGoToAccount}
              wrapperClassName="w-full max-w-sm mx-auto"
              className="w-full py-3.5 rounded-full bg-white text-black font-bold text-xs hover:bg-white/90 gap-2 shadow-lg"
            >
              <span>{isRobloxConnected ? "Acessar Painel de Controle" : "Conectar Minha Conta Roblox Agora"}</span>
              <ArrowRight className="w-4 h-4" />
            </DotButton>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];
  const IconComponent = current.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-xl rounded-[28px] bg-[#0a0a0a] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-6 sm:p-8 overflow-hidden text-white flex flex-col max-h-[90vh]"
        >
          {/* Subtle Ambient Light */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row */}
          <div className="relative flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${current.iconColor}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                  {current.badge}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                  {current.title}
                </h3>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtitle */}
          <div className="pt-3 pb-2 text-xs text-white/50 font-medium">
            {current.subtitle}
          </div>

          {/* Body Content */}
          <div className="py-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {current.content}
          </div>

          {/* Footer Controls */}
          <div className="pt-4 mt-2 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Dots navigation */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStep ? "w-6 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`Ir para passo ${idx + 1}`}
                />
              ))}
              <span className="text-[11px] text-white/30 ml-2 font-mono">
                {currentStep + 1} de {steps.length}
              </span>
            </div>

            {/* Next / Prev Buttons */}
            <div className="flex items-center gap-2 justify-end">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-2 rounded-full text-xs font-semibold text-white/70 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                  className="px-4 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-white/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>Próximo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-4 py-2 rounded-full text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer"
                >
                  <span>Concluir Tour</span>
                </button>
              )}
            </div>
          </div>

          {/* Don't show again checkbox */}
          <div className="pt-3 flex items-center justify-between text-[11px] text-white/40">
            <label className="flex items-center gap-2 cursor-pointer hover:text-white/60">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0 cursor-pointer"
              />
              <span>Não exibir este guia automaticamente no login</span>
            </label>

            <button
              onClick={handleFinish}
              className="text-white/40 hover:text-white/70 underline underline-offset-2 cursor-pointer"
            >
              Pular introdução
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
