import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { discordLoginHref, fetchAccount } from "../lib/api";
import {
  ChevronRight,
  Search,
  Menu,
  X,
  Sparkles,
  Paperclip,
  Check,
  BarChart3,
  Layers,
  Shield,
  Reply,
  Forward,
  Archive,
  Trash2,
  MoreHorizontal,
  Tag,
  TrendingUp,
  ShoppingBag,
  Zap,
} from "lucide-react";

// Shared Primitives

export function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="white" className={className}>
      <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
    </svg>
  );
}

export function PrimaryButton({
  label = "Acessar Painel",
  full = false,
  onClick,
}: {
  label?: string;
  full?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-semibold text-sm px-6 py-3 transition-all hover:bg-white/90 active:scale-[0.98] cursor-pointer shadow-[0_10px_30px_rgba(255,255,255,0.15)] ${
        full ? "w-full" : ""
      }`}
    >
      <span>{label}</span>
      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[2px] shrink-0" />
    </button>
  );
}

export function SectionEyebrow({
  label,
  tag,
}: {
  label: string;
  tag?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      <span className="text-xs font-semibold uppercase tracking-wider text-white">
        {label}
      </span>
      {tag && (
        <span className="px-2 py-0.5 rounded-full  text-white/50 text-[11px] font-mono">
          {tag}
        </span>
      )}
    </div>
  );
}

const gradientStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, #2563eb 0%, #3b82f6 20%, #60a5fa 35%, #bfdbfe 50%, #60a5fa 65%, #3b82f6 80%, #2563eb 100%)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

export function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(0);

  function enter(path = "/painel") {
    navigate(path);
  }

  useEffect(() => {
    fetchAccount()
      .then((account) => setDiscordEnabled(Boolean(account.discordEnabled)))
      .catch(() => setDiscordEnabled(false));
  }, []);

  const navLinks = [
      { label: "Catálogo", href: "#mockup" },
      { label: "Radar de Vendas", href: "#triage" },
      { label: "Depoimentos", href: "#testimonials" },
      { label: "Preços", href: "#pricing" },
  ];

  const messages = [
    {
      sender: "Seu Grupo Roblox",
      subject: "Relatório Semanal de Receita",
      preview: "Seu grupo faturou 24.415 R$ com 102 vendas líquidas nesta semana...",
      time: "9:41 AM",
      unread: true,
      category: "Shirts",
    },
    {
      sender: "Cyberpunk Jacket",
      subject: "Nicho em explosão no CAC",
      preview: "Alta procura no Catalog Avatar Creator: +180% em buscas orgânicas...",
      time: "8:12 AM",
      unread: true,
      category: "Shirts",
    },
    {
      sender: "Baggy Cargo Pants",
      subject: "Estoque reposto com sucesso",
      preview: "Nova cor Black/Grey indexada com preço fixo de 5 Robux...",
      time: "Ontem",
      unread: false,
      category: "Pants",
    },
    {
      sender: "Roblox Open Cloud",
      subject: "Webhook de venda confirmada",
      preview: "Item #10354649 comprado por usuário VIP na loja do grupo...",
      time: "Ontem",
      unread: false,
      category: "Limiteds",
    },
    {
      sender: "Varredura de Integridade",
      subject: "Catálogo seguro e verificado",
      preview: "Zero infrações de copyright e proteção ativa contra cópias...",
      time: "Seg",
      unread: false,
      category: "Shirts",
    },
    {
      sender: "Syn Strategy Bot",
      subject: "Meta 1.000 R$/dia aprovada",
      preview: "Recomendação de novos drops temáticos para o próximo fim de semana...",
      time: "Seg",
      unread: false,
      category: "Outfits CAC",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-white selection:bg-brand/30">
      {/* Global SVG Noise Filters */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <filter id="c3-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"
          />
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>
      </svg>

      {/* Subtle vignette gradient over WebGL Silk shader */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/50 via-transparent to-black/80" />



      {/* Section 1 — Navbar */}
      <header className="relative z-20 pt-6">
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-6xl mx-auto px-6 flex items-center justify-between"
        >
          {/* Left: LogoMark only */}
          <div
            onClick={() => enter("/painel")}
            className="cursor-pointer flex items-center gap-3 group"
          >
            <LogoMark className="w-8 h-8 transition-transform group-hover:scale-105" />
            <span className="font-semibold text-sm tracking-tight text-white/90 hidden sm:inline font-mono">
              ILLUSIONS
            </span>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
                className="text-white/70 text-sm font-medium hover:text-white transition-colors"
              >
                {link.label}
              </motion.a>
            ))}
          </div>

          {/* Right Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <PrimaryButton label="Acessar Painel" onClick={() => enter("/painel")} />
          </div>

          {/* Mobile menu icon button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-10 h-10 rounded-full  bg-white/5 flex items-center justify-center text-white"
            aria-label="Abrir Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </motion.nav>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden mt-3 mx-6 rounded-2xl liquid-glass p-6 space-y-4 "
            >
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block text-sm font-medium text-white/80 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2">
                <PrimaryButton label="Acessar Painel" full onClick={() => enter("/painel")} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Section 2 — Hero */}
      <section className="relative z-10 pt-16 md:pt-28 pb-20 text-center flex flex-col items-center max-w-6xl mx-auto px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl md:text-7xl font-semibold tracking-tight leading-[0.9]"
        >
          <span className="block text-white">Your catalog.</span>
          <span className="animate-shiny inline-block mt-2" style={gradientStyle}>
            Revitalized
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="mt-8 text-white/60 max-w-md text-base leading-[1.5] mx-auto"
        >
          Illusions UGC é a plataforma definitiva de inteligência de catálogo para Roblox.
          Analisa tendências, acelera vendas e escala seu grupo rumo a 1.000 Robux/dia.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <PrimaryButton label="Acessar Painel" onClick={() => enter("/painel")} />
          <span className="text-xs text-white/40">
            Inteligência de Catálogo • Roblox UGC &amp; Moda
          </span>
        </motion.div>
      </section>

      {/* Section 4 — Realistic App Mockup */}
      <section id="mockup" className="relative z-10 max-w-6xl mx-auto px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="relative rounded-2xl overflow-hidden  bg-[#0e1014]/90 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
        >
          {/* Title Bar */}
          <div className="h-10 px-4 bg-black/40  flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#28c840] inline-block" />
            </div>
            <span className="text-xs text-white/50 font-mono">
              Illusions UGC — Radar de Catálogo & Receita
            </span>
            <div className="w-12" />
          </div>

          {/* Mockup Body */}
          <div className="grid grid-cols-12 h-[520px] text-xs">
            {/* Column 1: Sidebar (col-span-3) */}
            <div className="col-span-3  bg-black/30 p-3.5 flex flex-col justify-between">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => enter("/painel/upload")}
                  className="rounded-lg bg-white text-black text-xs font-semibold px-3 py-2 flex items-center justify-center gap-1.5 w-full cursor-pointer hover:bg-neutral-200 transition-all shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>Publicar no Catálogo</span>
                </button>

                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-white/10 text-white font-medium">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                      <span>Radar de Nichos</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white/15 px-1.5 py-0.2 rounded-full">
                      12
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-white/60 hover:bg-white/5 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Receita & Vendas</span>
                    </div>
                    <span className="text-[10px] font-mono text-blue-500">3</span>
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-white/60 hover:bg-white/5 cursor-pointer">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Roupas Publicadas</span>
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-white/60 hover:bg-white/5 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Fila de Upload</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">2</span>
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-white/60 hover:bg-white/5 cursor-pointer">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Grupos Vinculados (22)</span>
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-white/60 hover:bg-white/5 cursor-pointer">
                    <Archive className="w-3.5 h-3.5" />
                    <span>Histórico / Arquivo</span>
                  </div>
                </div>

                {/* Categories */}
                <div className="pt-2  space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-2 font-mono">
                    CATEGORIAS
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1 text-white/70">
                      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
                      <span>Shirts</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 text-white/70">
                      <span className="w-2 h-2 rounded-full bg-[#A4F4FD]" />
                      <span>Pants</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 text-white/70">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      <span>Outfits CAC</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 text-white/70">
                      <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                      <span>Limiteds</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2  flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>Seu Catálogo</span>
                <span className="text-emerald-400">● 24.415 R$</span>
              </div>
            </div>

            {/* Column 2: Message/Item List (col-span-4) */}
            <div className="col-span-4  flex flex-col">
              {/* Search Header */}
              <div className="p-2.5  flex items-center gap-2 bg-black/20">
                <Search className="w-3.5 h-3.5 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar no catálogo Roblox..."
                  readOnly
                  value=""
                  className="bg-transparent text-xs text-white placeholder-white/40 focus:outline-none w-full cursor-default"
                />
              </div>

              {/* Items List */}
              <div className="overflow-y-auto flex-1">
                {messages.map((item, idx) => (
                  <div
                    key={item.subject}
                    onClick={() => setSelectedMessage(idx)}
                    className={`p-3 transition-colors cursor-pointer text-left ${
                      selectedMessage === idx
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-semibold text-xs ${
                          item.unread ? "text-white" : "text-white/70"
                        }`}
                      >
                        {item.sender}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">{item.time}</span>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        item.unread ? "text-white font-medium" : "text-white/60"
                      }`}
                    >
                      {item.subject}
                    </p>
                    <p className="text-[11px] text-white/40 truncate mt-0.5">{item.preview}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: Reader (col-span-5) */}
            <div className="col-span-5 flex flex-col bg-[#0b0c10]/95">
              {/* Reader Toolbar */}
              <div className="h-10 px-4  flex items-center justify-between text-white/50">
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center hover:text-white transition-colors">
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center hover:text-white transition-colors">
                    <Forward className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center hover:text-white transition-colors">
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center hover:text-white transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center hover:text-white transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Reader Content */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1 text-left">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Relatório Semanal de Receita</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2563eb] to-[#0B2551] flex items-center justify-center text-[10px] font-bold text-white shadow-md">
                        S
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-white">Seu Grupo no Roblox</div>
                        <div className="text-[10px] text-white/40 font-mono">
                          to Criador • 9:41 AM
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-600/10 text-blue-400  font-mono">
                    Shirts
                  </span>
                </div>

                {/* AI / Radar Summary Card */}
                <div className="p-3.5 rounded-xl bg-blue-600/5  space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-500 font-semibold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-[#A4F4FD]" />
                    <span>Resumo do Radar de Mercado</span>
                  </div>
                  <p className="text-[11px] text-white/80 leading-relaxed">
                    Seu grupo fechou a semana com 102 vendas líquidas, 24.415 R$ acumulados e 2
                    novas peças indexadas no top 5 do CAC. Peça mais vendida: Cyberpunk Jacket. Nenhuma
                    ação manual necessária.
                  </p>
                </div>

                {/* Message Body */}
                <div className="space-y-2 text-xs text-white/70 leading-relaxed font-sans">
                  <p>Olá Criador,</p>
                  <p>
                    Aqui está o consolidado semanal do seu grupo no Roblox. Esta foi uma
                    semana de forte aceleração rumo à meta de 1.000 Robux/dia.
                  </p>
                  <p>
                    Cento e duas vendas foram concretizadas, o ticket médio manteve-se em 5 Robux e as
                    tags comunitárias geraram mais de 4.800 impressões orgânicas no Catalog Avatar
                    Creator.
                  </p>
                  <p className="text-white/40 pt-2">— Equipe Illusions UGC</p>
                </div>

                {/* Attachment */}
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5  text-xs text-white/70 hover:bg-white/10 cursor-pointer transition-colors">
                    <Paperclip className="w-3 h-3 text-blue-500" />
                    <span>relatorio-vendas-syn.pdf</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Section 5 — FeatureTriage (Radar de Catálogo) */}
      <section id="triage" className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-left"
          >
            <SectionEyebrow label="Radar" tag="Inteligência de Mercado" />
            <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02] text-white">
              Domine o catálogo <br />
              em tempo real.
            </h2>
            <p className="mt-6 text-white/60 text-base leading-[1.6] max-w-md">
              Illusions UGC varre milhões de itens públicos do Roblox, compreende o comportamento de
              busca dos jogadores e separa o ruído das oportunidades de alto volume. Foque em criar
              roupas que vendem — o radar cuida do resto.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {[
                "Auto-categorização",
                "Detecção de Nichos",
                "Proteção Anti-Cópia",
                "Tags Otimizadas CAC",
              ].map((chip) => (
                <span
                  key={chip}
                  className="text-xs text-white/70 px-3 py-1.5 rounded-full  bg-white/[0.03]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right Column: Liquid-Glass Card */}
          <div className="liquid-glass rounded-2xl p-5 text-left">
            <div className="text-xs text-white/50 font-mono mb-4">
              Hoje • 42 nichos e peças triadas
            </div>

            <div className="space-y-3">
              {/* Priority */}
              <div className="liquid-glass rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-white mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>Prioridade (Alta Aceleração)</span>
                  </div>
                  <span className="font-mono text-white/60">4</span>
                </div>
                <div className="text-xs text-white/70 space-y-1 font-mono">
                  <div>• Cyberpunk Jackets (+180% em buscas no CAC)</div>
                  <div>• Y2K Star Hoodies (45 vendas/h no mercado)</div>
                </div>
              </div>

              {/* Follow-up */}
              <div className="liquid-glass rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#e5e5e5] mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>Demanda Constante</span>
                  </div>
                  <span className="font-mono text-white/60">7</span>
                </div>
                <div className="text-xs text-white/70 space-y-1 font-mono">
                  <div>• Baggy Cargo Pants (Preço 5 R$, alta retenção)</div>
                  <div>• Gothic Tops (Compradores fiéis de 5+ peças)</div>
                </div>
              </div>

              {/* Updates */}
              <div className="liquid-glass rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#a3a3a3] mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Em Monitoramento</span>
                  </div>
                  <span className="font-mono text-white/60">18</span>
                </div>
                <div className="text-xs text-white/60 space-y-1 font-mono">
                  <div>• Streetwear Sets — Análise de concorrência ativa</div>
                  <div>• Anime Outfits — Testando keywords de busca</div>
                </div>
              </div>

              {/* Archived */}
              <div className="liquid-glass rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#525252] mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                    <span>Nichos Saturados (Descartados)</span>
                  </div>
                  <span className="font-mono text-white/40">13</span>
                </div>
                <div className="text-xs text-white/40 font-mono">
                  Basic Camo Tees • Peças copiadas • Margem nula
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 — Testimonials */}
      <section id="testimonials" className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28 ">
        <div className="grid md:grid-cols-3 gap-6 text-left">
          <figure className="liquid-glass rounded-2xl p-6 flex flex-col justify-between">
            <blockquote className="text-sm text-white/80 leading-[1.6]">
              "O Illusions UGC devolveu quatro horas da nossa semana. Ele identifica as peças em alta
              no catálogo antes mesmo dos grandes estúdios perceberem."
            </blockquote>
            <figcaption className="mt-6 pt-5 ">
              <div className="text-sm font-semibold text-white">Lucas Ramos</div>
              <div className="text-xs text-white/50">Lead UGC Designer</div>
              <div className="text-xs text-white font-semibold tracking-wide uppercase mt-1">
                UGC STUDIO PARTNER
              </div>
            </figcaption>
          </figure>

          <figure className="liquid-glass rounded-2xl p-6 flex flex-col justify-between">
            <blockquote className="text-sm text-white/80 leading-[1.6]">
              "O sistema de tags e SEO automático para o Catalog Avatar Creator triplicou nossas
              vendas orgânicas em 14 dias. Não imagino gerenciar o grupo sem ele."
            </blockquote>
            <figcaption className="mt-6 pt-5 ">
              <div className="text-sm font-semibold text-white">Rafael Mendes</div>
              <div className="text-xs text-white/50">Diretor Criativo</div>
              <div className="text-xs text-white font-semibold tracking-wide uppercase mt-1">
                ILLUSIONS STUDIO
              </div>
            </figcaption>
          </figure>

          <figure className="liquid-glass rounded-2xl p-6 flex flex-col justify-between">
            <blockquote className="text-sm text-white/80 leading-[1.6]">
              "A análise de concorrência e velocidade de vendas tirou nosso time do escuro. Bater a
              meta diária de Robux virou rotina operacional."
            </blockquote>
            <figcaption className="mt-6 pt-5 ">
              <div className="text-sm font-semibold text-white">Matheus Castro</div>
              <div className="text-xs text-white/50">Estrategista de Monetização</div>
              <div className="text-xs text-white font-semibold tracking-wide uppercase mt-1">
                NOVA UGC
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Section 8 — Pricing */}
      <section id="pricing" className="c3-pricing-section">
        {/* Pricing specific filter */}
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
          <filter id="c3-noise-pricing">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.5"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.075" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" result="noise" />
            <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
          </filter>
        </svg>

        {/* Watermark */}
        <div className="c3-watermark-container">
          <div className="c3-watermark-main">
            <span className="c3-watermark-line-1">Your catalog.</span>
            <span className="c3-watermark-line-2">Revitalized</span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="c3-grid">
          {/* Card 1: Free */}
          <div className="c3-card text-left">
            <div className="c3-tier-small">Gratuito</div>
            <div className="c3-tier-large">0 R$</div>
            <div className="c3-desc">
              Para criadores e designers iniciando sua jornada de roupas e UGC no Roblox.
            </div>
            <ul className="c3-list">
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Até 5 uploads/mês no grupo</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Radar de nichos básico</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Análise de até 3 grupos Roblox</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Histórico de vendas em 24h</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Acesso via Web e Painel Desktop</span>
              </li>
            </ul>
            <button type="button" onClick={() => enter("/painel")} className="c3-btn">
              Começar Grátis
            </button>
          </div>

          {/* Card 2: Creator */}
          <div className="c3-card text-left">
            <div className="c3-tier-small">Creator</div>
            <div className="c3-tier-large">
              {yearly ? "R$ 39,90/m" : "R$ 49,90/m"}
            </div>
            <div className="c3-desc">
              Para criadores independentes e pequenos grupos focados em escala rápida.
            </div>
            <ul className="c3-list">
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Uploads ilimitados no grupo</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Radar de tendências em tempo real</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>SEO automatizado para CAC</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Até 10 grupos monitorados</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Alertas instantâneos no Discord</span>
              </li>
            </ul>
            <button type="button" onClick={() => enter("/painel")} className="c3-btn">
              Escolher Plano
            </button>
          </div>

          {/* Card 3: Pro */}
          <div className="c3-card c3-card-pro text-left">
            <div className="c3-tier-small">Studio Pro</div>
            <div className="c3-tier-large">
              {yearly ? "R$ 79,90/m" : "R$ 99,90/m"}
            </div>
            <div className="c3-desc">
              Para grupos consolidados acelerando rumo a 1.000+ Robux/dia.
            </div>
            <ul className="c3-list">
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Radar preditivo completo de catálogo</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>22+ grupos e contas ilimitadas</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Otimização em lote de templates</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Consultor estratégico personalizado</span>
              </li>
              <li>
                <span className="c3-check">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Webhooks e relatórios em tempo real</span>
              </li>
            </ul>
            <button type="button" onClick={() => enter("/painel")} className="c3-btn">
              Acelerar Grupo
            </button>
          </div>
        </div>

        {/* Yearly Toggle */}
        <div className="c3-toggle-wrap">
          <span className="text-xs text-white/70 font-medium">Anual (20% OFF)</span>
          <button
            type="button"
            onClick={() => setYearly(!yearly)}
            className={`c3-toggle ${yearly ? "active" : ""}`}
            aria-label="Alternar faturamento anual"
          >
            <span className="c3-toggle-knob" />
          </button>
        </div>
      </section>

      {/* Section 9 — FinalCTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 md:py-24 text-center "
        >
          {/* Radial glow overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(600px circle at 50% 0%, rgba(255,255,255,0.15), transparent 70%)",
            }}
          />

          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] text-white">
            Abandone o improviso. <br />
            Escale seu catálogo.
          </h2>

          <p className="mt-6 text-white/60 max-w-md mx-auto text-sm leading-[1.6]">
            Junte-se a criadores, designers e estúdios que tratam o Roblox como uma verdadeira
            empresa digital.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton label="Acessar Painel" onClick={() => enter("/painel")} />
            {discordEnabled ? (
              <a
                href={discordLoginHref()}
                className="inline-flex items-center gap-2 rounded-full  text-white text-sm font-medium px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span>Conectar Discord</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => enter("/painel")}
                className="inline-flex items-center gap-2 rounded-full  text-white text-sm font-medium px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span>Acessar painel</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </section>

      {/* Subtle Footer */}
      <footer className="relative z-10  py-8 text-center text-xs text-white/40 font-mono">
        <p>© 2026 Illusions UGC • SaaS Platform • All rights reserved.</p>
      </footer>
    </div>
  );
}
