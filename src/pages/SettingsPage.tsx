import React, { FormEvent, useEffect, useState } from "react";
import { fetchSettings, saveSettings, type Settings } from "../lib/api";
import { CATEGORY_LABEL, type Category } from "../lib/labels";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings as SettingsIcon,
  Zap,
  Sliders,
  Check,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Bell,
  Sparkles,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const next = await saveSettings(settings);
      setSettings(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(key: Category) {
    if (!settings) return;
    const exists = settings.categories.includes(key);
    setSettings({
      ...settings,
      categories: exists
        ? settings.categories.filter((item) => item !== key)
        : [...settings.categories, key],
    });
  }

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-transparent">
        <div className="flex items-center gap-3 text-white/60 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          <span>Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="h-full overflow-y-auto p-6 md:p-8 space-y-6 pb-24 bg-transparent text-white select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent animate-gradient-x flex items-center gap-2.5"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #8b5cf6, #c084fc, #a855f7, #6d28d9, #8b5cf6)",
              backgroundSize: "200% auto",
            }}
          >
            <span>Configurações</span>
          </h1>
          <p className="text-xs sm:text-sm text-white/40 mt-1 font-medium">
            Preferências do radar, automação e inteligência do seu catálogo
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={busy}
          className={`px-5 py-2.5 rounded-full font-semibold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
            saved
              ? "bg-emerald-500 text-black shadow-emerald-500/20"
              : "bg-white hover:bg-white/90 text-black active:scale-95"
          }`}
        >
          {busy ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{saved ? "Salvo com sucesso!" : busy ? "Salvando..." : "Salvar Alterações"}</span>
        </motion.button>
      </div>

      {/* Save / Error Feedback Toast */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Configurações salvas e sincronizadas com sucesso!</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid of 4 Settings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Radar & Varredura Automática */}
        <div className="rounded-[22px] bg-[#0a0a0a] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-5">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Varredura Automática</h2>
                <p className="text-xs text-white/40">Radar contínuo de peças em alta no catálogo</p>
              </div>
            </div>

            {/* Custom Pill Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoScan}
              onClick={() => setSettings({ ...settings, autoScan: !settings.autoScan })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                settings.autoScan ? "bg-purple-600" : "bg-[#222222]"
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoScan ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Intervalo em Minutos */}
            <div className="p-3.5 rounded-xl bg-[#111111] space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/70">Intervalo</label>
                <span className="text-[11px] font-bold text-purple-300">{settings.intervalMinutes}m</span>
              </div>
              <input
                type="number"
                min={10}
                max={240}
                value={settings.intervalMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, intervalMinutes: Number(e.target.value) })
                }
                className="w-full bg-[#161616] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              />
              <p className="text-[10px] text-white/30">Mínimo: 10m (segurança)</p>
            </div>

            {/* Páginas por Categoria */}
            <div className="p-3.5 rounded-xl bg-[#111111] space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/70">Profundidade</label>
                <span className="text-[11px] font-bold text-purple-300">{settings.pagesPerCategory} págs</span>
              </div>
              <input
                type="number"
                min={1}
                max={4}
                value={settings.pagesPerCategory}
                onChange={(e) =>
                  setSettings({ ...settings, pagesPerCategory: Number(e.target.value) })
                }
                className="w-full bg-[#161616] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              />
              <p className="text-[10px] text-white/30">Páginas por categoria (1 a 4)</p>
            </div>
          </div>

          {/* Categorias Monitoradas */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-white/70">Categorias Monitoradas</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((key) => {
                const active = settings.categories.includes(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => toggleCategory(key)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                      active
                        ? "bg-purple-500/20 text-purple-200 font-semibold"
                        : "bg-[#111111] text-white/40 hover:text-white hover:bg-[#161616]"
                    }`}
                  >
                    <span>{CATEGORY_LABEL[key]}</span>
                    {active ? (
                      <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Sensibilidade do Radar (Sliders unificados em roxo) */}
        <div className="rounded-[22px] bg-[#0a0a0a] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Sensibilidade do Radar</h2>
              <p className="text-xs text-white/40">Critérios para destacar peças em alta no feed</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Velocidade Mínima */}
            <div className="p-3.5 rounded-xl bg-[#111111] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/70">Velocidade Mínima</span>
                <span className="font-bold text-purple-300">{settings.alertMinVelocity} vendas/h</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={settings.alertMinVelocity}
                onChange={(e) =>
                  setSettings({ ...settings, alertMinVelocity: Number(e.target.value) })
                }
                className="w-full accent-purple-400 cursor-pointer"
              />
              <p className="text-[10px] text-white/30">Mínimo de vendas por hora para disparo de alerta</p>
            </div>

            {/* Aceleração Mínima */}
            <div className="p-3.5 rounded-xl bg-[#111111] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/70">Aceleração de Crescimento</span>
                <span className="font-bold text-purple-300">{settings.alertMinAcceleration}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.1}
                value={settings.alertMinAcceleration}
                onChange={(e) =>
                  setSettings({ ...settings, alertMinAcceleration: Number(e.target.value) })
                }
                className="w-full accent-purple-400 cursor-pointer"
              />
              <p className="text-[10px] text-white/30">Multiplicador de aceleração frente ao ciclo anterior</p>
            </div>

            {/* Afinidade do Nicho */}
            <div className="p-3.5 rounded-xl bg-[#111111] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/70">Afinidade do Nicho</span>
                <span className="font-bold text-purple-300">
                  {Math.round(settings.alertMinPurity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.alertMinPurity}
                onChange={(e) =>
                  setSettings({ ...settings, alertMinPurity: Number(e.target.value) })
                }
                className="w-full accent-purple-400 cursor-pointer"
              />
              <p className="text-[10px] text-white/30">Compatibilidade de tags com o estilo do seu catálogo</p>
            </div>
          </div>
        </div>

        {/* Card 3: Notificações Discord */}
        <div className="rounded-[22px] bg-[#0a0a0a] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Notificações Discord</h2>
              <p className="text-xs text-white/40">Alertas de vendas e novos uploads no canal</p>
            </div>
          </div>

          <p className="text-xs text-white/45 leading-relaxed">
            Cole a URL do Webhook do seu servidor Discord para receber notificações automáticas instantâneas a cada venda ou novo upload finalizado.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">URL do Webhook</label>
            <input
              type="url"
              value={settings.discordWebhook || ""}
              onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
              placeholder={
                settings.discordWebhookSet
                  ? "Webhook configurado (cole outro para substituir)"
                  : "https://discord.com/api/webhooks/..."
              }
              autoComplete="off"
              className="w-full bg-[#111111] rounded-xl p-3 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/35 pt-1">
            <span>Ao salvar um novo webhook, uma mensagem de teste é enviada.</span>
            {settings.discordWebhookSet && (
              <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                <Check className="w-3.5 h-3.5" /> Conectado
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Inteligência & Estratégia da Marca */}
        <div className="rounded-[22px] bg-[#0a0a0a] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Inteligência & Marca</h2>
              <p className="text-xs text-white/40">Diretrizes ativas para o crescimento no Roblox</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#111111] flex items-center justify-between">
              <span className="text-white/50">Modelo de IA</span>
              <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 font-semibold text-[11px]">
                Gemini 3.5 Flash
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#111111] flex items-center justify-between">
              <span className="text-white/50">Grupo Vinculado</span>
              <span className="text-white font-semibold text-[11px]">
                Catálogo Conectado &bull; Ativo
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111111] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/60 font-medium">Meta Diária Líquida</span>
                <span className="text-purple-300 font-bold text-xs">
                  1.000 Robux / dia
                </span>
              </div>
              <div className="text-[11px] text-white/40 space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <span>Venda Direta (30% retido pelo Roblox):</span>
                  <span className="text-white/70 font-mono">~286 vendas (3,5 R$ líq.)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Venda CAC / In-Game (40% afiliado + 30% Roblox):</span>
                  <span className="text-white/70 font-mono">~350–500 vendas (1,5 R$ líq.)</span>
                </div>
                <p className="text-[10px] text-white/30 pt-0.5">
                  Estimativas líquidas considerando retenção da plataforma, comissões de experiência e preços regionais.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#111111] flex items-center justify-between">
              <span className="text-white/50">Preço Mínimo Roblox</span>
              <span className="text-white font-semibold text-[11px]">
                5 Robux (roupas clássicas 2D)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#111111] flex items-center justify-between">
              <span className="text-white/50">Royalties de Limiteds</span>
              <span className="text-emerald-400 font-semibold text-[11px]">
                10% por revenda no marketplace
              </span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}


