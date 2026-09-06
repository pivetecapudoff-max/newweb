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
  Users,
  DollarSign,
  Building2,
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

  function enter(path = "/painel") {
    navigate(path);
  }

  useEffect(() => {
    fetchAccount()
      .then((account) => setDiscordEnabled(Boolean(account.discordEnabled)))
      .catch(() => setDiscordEnabled(false));
  }, []);

  const navLinks = [
    { label: "Radar de Vendas", href: "#triage" },
    { label: "Depoimentos", href: "#testimonials" },
    { label: "Preços", href: "#pricing" },
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

      {/* Section 4 — Realistic App Dashboard Mockup */}
      <section id="mockup" className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="relative rounded-2xl overflow-hidden bg-[#000000] border border-white/[0.08] backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
        >
          {/* Title Bar */}
          <div className="h-10 px-4 bg-black/60 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e] inline-block" />
              <span className="w-3 h-3 rounded-full bg-[#28c840] inline-block" />
            </div>
            <span className="text-xs text-white/50 font-mono flex items-center gap-1.5">
              <span>Dashboard • Welcome, why</span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline font-mono">Live</span>
            </div>
          </div>

          {/* Real Dashboard Representation */}
          <div className="p-4 sm:p-7 space-y-6 text-left bg-[#000000] select-none">
            {/* Dashboard Subheader */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Dashboard • Welcome,</span>
                  <span className="text-blue-400">why</span>
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  why • Loja Principal • Visão Global
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 bg-[#121212] border border-white/[0.08] px-3.5 py-1.5 rounded-full text-xs text-white/80 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>why</span>
                  <span className="text-[10px] text-white/40 font-mono">(1458096)</span>
                </div>

                <button
                  type="button"
                  onClick={() => enter("/painel")}
                  className="inline-flex items-center gap-1.5 bg-white text-black font-semibold text-xs px-3.5 py-1.5 rounded-full shadow-lg hover:bg-neutral-200 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>Otimizar Catálogo</span>
                </button>
              </div>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Card 1 */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-1">
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="font-semibold">Receita Robux</span>
                </div>
                <div className="text-2xl font-extrabold text-white pt-1 tracking-tight">0 R$</div>
                <div className="text-[11px] text-white/35 font-medium">+0 R$ hoje • 321 R$ (7 dias)</div>
              </div>

              {/* Card 2 */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-1">
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="font-semibold">Membros do Grupo</span>
                </div>
                <div className="text-2xl font-extrabold text-white pt-1 tracking-tight">12.480</div>
                <div className="text-[11px] text-white/35 font-medium">why • Loja Principal</div>
                <div className="text-[10px] text-white/20">Total consolidado de membros</div>
              </div>

              {/* Card 3 */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-1">
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="font-semibold">Vendas (Roupas &amp; UGC)</span>
                </div>
                <div className="text-2xl font-extrabold text-white pt-1 tracking-tight">13.370</div>
                <div className="text-[11px] text-white/35 font-medium">+42 hoje • transações Roblox</div>
                <div className="text-[10px] text-white/20">Histórico acumulado de vendas</div>
              </div>

              {/* Card 4 */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-1">
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="font-semibold">Catálogo Ativo</span>
                </div>
                <div className="text-2xl font-extrabold text-white pt-1 tracking-tight">8 peças</div>
                <div className="text-[11px] text-white/35 font-medium">8 roupas 2D • 0 itens 3D</div>
                <div className="text-[10px] text-white/20">Catálogo do grupo principal (why)</div>
              </div>
            </div>

            {/* Glowing Wave Chart Card */}
            <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/[0.06] text-white/90 flex items-center gap-1.5 border border-white/[0.08]">
                    <span>Receita Robux</span>
                    <ChevronRight className="w-3 h-3 text-white/40" />
                    <span className="text-blue-400">Catálogo Sincronizado</span>
                    <span className="text-white/30">•</span>
                    <span className="text-amber-400">Meta: 1.000 R$/dia</span>
                  </span>
                </div>
                <span className="text-[11px] text-white/40 font-mono bg-white/[0.04] px-3 py-1 rounded-full w-fit">
                  Últimos 7 dias
                </span>
              </div>

              {/* SVG Wave Chart Matching media_1788662500987.png */}
              <div className="relative w-full h-48 sm:h-56">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 900 220"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="dashWaveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="35%" stopColor="#60a5fa" />
                      <stop offset="70%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>

                    <linearGradient id="dashAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                      <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                    </linearGradient>

                    <radialGradient id="peakGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                    </radialGradient>

                    <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line x1="40" y1="25" x2="880" y2="25" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x="25" y="28" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace" textAnchor="end">208</text>

                  <line x1="40" y1="65" x2="880" y2="65" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x="25" y="68" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace" textAnchor="end">156</text>

                  <line x1="40" y1="105" x2="880" y2="105" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x="25" y="108" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace" textAnchor="end">104</text>

                  <line x1="40" y1="145" x2="880" y2="145" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x="25" y="148" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace" textAnchor="end">52</text>

                  <line x1="40" y1="185" x2="880" y2="185" stroke="rgba(255,255,255,0.08)" />
                  <text x="25" y="188" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace" textAnchor="end">0</text>

                  {/* Warm Peak Ambient Halo Glow at 05 de set (x=730, y=65) */}
                  <circle cx="730" cy="65" r="50" fill="url(#peakGlow)" />

                  {/* Shaded Area Under Wave */}
                  <path
                    d="M 60 148 C 120 148, 140 185, 190 185 C 240 185, 270 180, 320 180 C 370 180, 400 162, 450 162 C 500 162, 530 168, 580 168 C 640 168, 680 65, 730 65 C 780 65, 820 188, 860 188 L 860 195 L 60 195 Z"
                    fill="url(#dashAreaGradient)"
                  />

                  {/* Main Glowing Bezier Wave Path */}
                  <path
                    d="M 60 148 C 120 148, 140 185, 190 185 C 240 185, 270 180, 320 180 C 370 180, 400 162, 450 162 C 500 162, 530 168, 580 168 C 640 168, 680 65, 730 65 C 780 65, 820 188, 860 188"
                    fill="none"
                    stroke="url(#dashWaveGradient)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    filter="url(#waveGlow)"
                  />

                  {/* Data Point Dots */}
                  <circle cx="60" cy="148" r="4" fill="#ffffff" stroke="#3b82f6" strokeWidth="2" />
                  <circle cx="190" cy="185" r="3.5" fill="#ffffff" stroke="#3b82f6" strokeWidth="2" />
                  <circle cx="320" cy="180" r="3.5" fill="#ffffff" stroke="#60a5fa" strokeWidth="2" />
                  <circle cx="450" cy="162" r="3.5" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" />
                  <circle cx="580" cy="168" r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
                  
                  {/* Peak Point: Highlight Dot */}
                  <circle cx="730" cy="65" r="5.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                  <circle cx="860" cy="188" r="3.5" fill="#ffffff" stroke="#ffffff" strokeWidth="2" />
                </svg>
              </div>

              {/* X Axis Dates */}
              <div className="grid grid-cols-7 text-center text-[11px] font-mono text-white/40 pt-1 border-t border-white/[0.04]">
                <span>31 de ago</span>
                <span>01 de set</span>
                <span>02 de set</span>
                <span>03 de set</span>
                <span>04 de set</span>
                <span className="text-amber-300 font-semibold">05 de set</span>
                <span className="text-white/80">Hoje</span>
              </div>
            </div>

            {/* Recent Sales Live Feed */}
            <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Atividades Recentes de Vendas • Transações Roblox</span>
                </span>
                <span className="text-[11px] text-white/40 font-mono">why</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 font-bold text-xs">
                      ⚡
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">Cyberpunk Tactical Jacket</p>
                      <p className="text-[10px] text-white/40">why • há 4 min</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0 font-mono">+5 R$</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 font-bold text-xs">
                      ⚡
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">Baggy Y2K Grunge Cargo</p>
                      <p className="text-[10px] text-white/40">why • há 14 min</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0 font-mono">+5 R$</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 font-bold text-xs">
                      ⚡
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">Oversized Vintage Hoodie</p>
                      <p className="text-[10px] text-white/40">why • há 28 min</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0 font-mono">+5 R$</span>
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
