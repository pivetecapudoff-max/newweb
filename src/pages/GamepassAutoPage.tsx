import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gamepad2,
  ChevronDown,
  ExternalLink,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Zap,
  Play,
} from "lucide-react";
import {
  fetchGamepassAccount,
  fetchGamepassJobs,
  startGamepassAutomation,
  deleteGamepassJob,
  type GamepassAccountInfo,
  type GamepassAutomationJob,
} from "../lib/api";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  queued: { label: "Na Fila", color: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" },
  processing: { label: "Processando", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  completed: { label: "Concluído", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  failed: { label: "Falhou", color: "bg-rose-500/15 border-rose-500/30 text-rose-400" },
  partial: { label: "Parcial", color: "bg-amber-500/15 border-amber-500/30 text-amber-400" },
  pending: { label: "Pendente", color: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400" },
  success: { label: "Concluído", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  skipped_regional: { label: "Regional", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function GamepassAutoPage() {
  const [account, setAccount] = useState<GamepassAccountInfo | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [linksText, setLinksText] = useState("");
  const [payRegional, setPayRegional] = useState(false);
  const [useDelay, setUseDelay] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GamepassAutomationJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const loadAccount = useCallback(async () => {
    try {
      const data = await fetchGamepassAccount();
      setAccount(data);
      setAccountError(null);
    } catch (err: any) {
      setAccountError(err?.message || "Erro ao carregar conta.");
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchGamepassJobs();
      setJobs(data.jobs || []);
    } catch {
      // ignore
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
    loadJobs();
    const interval = setInterval(loadJobs, 4000);
    return () => clearInterval(interval);
  }, [loadAccount, loadJobs]);

  const handleStart = async () => {
    const links = linksText
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!links.length) {
      setSubmitError("Insira pelo menos um link ou ID de gamepass.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await startGamepassAutomation({
        links,
        payRegional,
        delayBetweenSeconds: useDelay ? delaySeconds : 0,
      });
      setLinksText("");
      await loadJobs();
    } catch (err: any) {
      setSubmitError(err?.message || "Erro ao iniciar automação.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGamepassJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {}
  };

  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "processing");
  const completedJobs = jobs.filter((j) => j.status !== "queued" && j.status !== "processing");

  return (
    <div className="min-h-screen bg-transparent p-6 lg:p-10 max-w-6xl mx-auto space-y-8 pb-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
          Gamepass Auto
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Pague um ou vários gamepasses usando uma conta cadastrada.
        </p>
      </div>

      {/* Nova Tarefa Card */}
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/[0.08] p-6 lg:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white">Nova tarefa</h2>
        </div>

        {/* Conta */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
            Conta
          </label>

          {account ? (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/[0.05] border border-white/[0.1] shrink-0">
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt={account.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-bold">
                    {account.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{account.displayName || account.name}</div>
                <div className="text-xs text-white/40 font-mono">
                  ID {account.id} — <span className="text-blue-400 font-semibold">{account.robux.toLocaleString("pt-BR")} Robux</span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
            </div>
          ) : accountError ? (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {accountError}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-white/40 animate-pulse">
              Carregando conta...
            </div>
          )}
        </div>

        {/* Links Gamepass */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
            Links gamepass
          </label>
          <textarea
            value={linksText}
            onChange={(e) => setLinksText(e.target.value)}
            placeholder="Para mais de uma gamepass, coloque em linhas separadas."
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all resize-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
        </div>

        {/* Toggle - Preço Regional */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-white">Pagar mesmo com preço regional ativado</div>
            <div className="text-xs text-white/40">{payRegional ? "Ativado" : "Desativado"}</div>
          </div>
          <button
            onClick={() => setPayRegional(!payRegional)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              payRegional ? "bg-purple-600" : "bg-white/10"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                payRegional ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Toggle - Delay */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-white">Tempo de pagamento entre cada pass</div>
            <div className="text-xs text-white/40">
              {useDelay ? `${delaySeconds}s entre cada compra` : "Desativado"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {useDelay && (
              <input
                type="number"
                min={1}
                max={120}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Math.max(1, Number(e.target.value) || 5))}
                className="w-16 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.1] text-xs text-white text-center focus:outline-none focus:border-blue-500/40"
              />
            )}
            <button
              onClick={() => setUseDelay(!useDelay)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                useDelay ? "bg-purple-600" : "bg-white/10"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  useDelay ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleStart}
          disabled={submitting || !account}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Prosseguir</span>
            </>
          )}
        </button>
      </div>

      {/* Automações em andamento */}
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/[0.08] p-6 lg:p-8 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Automações em andamento</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {jobs.length} tarefa(s)
            </p>
          </div>
          <button
            onClick={loadJobs}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/30">
            {loadingJobs ? "Carregando..." : "Nenhuma automação encontrada."}
          </div>
        ) : (
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">Data</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">Gamepass</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">Conta</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">Status</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">Progresso</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-white/40">URL</th>
                  <th className="pb-3 text-[10px] font-semibold uppercase tracking-wider text-white/40"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pr-4 text-white/60 whitespace-nowrap">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col gap-0.5">
                        {job.passes.slice(0, 2).map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            {p.thumbnailUrl && (
                              <img src={p.thumbnailUrl} alt="" className="w-5 h-5 rounded shrink-0" />
                            )}
                            <div>
                              <div className="text-white font-medium truncate max-w-[140px]">{p.name}</div>
                              <div className="text-[10px] text-white/30 font-mono">ID {p.id}</div>
                            </div>
                          </div>
                        ))}
                        {job.passes.length > 2 && (
                          <span className="text-[10px] text-white/30">+{job.passes.length - 2} mais</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        {job.account.avatarUrl ? (
                          <img src={job.account.avatarUrl} alt="" className="w-6 h-6 rounded-full border border-white/10" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-[9px] font-bold text-white">
                            {job.account.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-white/70 text-xs">{job.account.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_BADGE[job.status]?.color || STATUS_BADGE.pending.color}`}>
                        {STATUS_BADGE[job.status]?.label || job.status}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        {/* Progress circle */}
                        <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/[0.06]" />
                          <circle
                            cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"
                            className={`${job.status === "completed" ? "text-blue-500" : job.status === "failed" ? "text-rose-500" : "text-blue-500"}`}
                            strokeDasharray={`${job.totalPasses > 0 ? (job.completedPasses / job.totalPasses) * 50.26 : 0} 50.26`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-white/60 font-mono">{job.completedPasses}/{job.totalPasses}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      {job.passes[0]?.url && (
                        <a
                          href={job.passes[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-white/40 hover:text-white transition-colors flex items-center gap-1 truncate max-w-[160px]"
                        >
                          <span className="truncate text-[11px]">{job.passes[0].url.replace("https://www.", "")}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(job.id)}
                          title="Remover tarefa"
                          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
