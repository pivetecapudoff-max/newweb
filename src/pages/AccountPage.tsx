import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  connectAccount,
  disconnectAccount,
  fetchAccount,
  fetchDashboard,
  lookupGroupStore,
  type AccountPublic,
  type DashboardData,
  type GroupStore,
} from "../lib/api";
import { writeSession } from "../lib/session";
import {
  Users,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  Crown,
  RefreshCw,
  Search,
  Building2,
  Lock,
  ArrowRight,
  Coins,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { DotButton } from "../components/ui/DotButton";
import { CloudflareTurnstile } from "../components/CloudflareTurnstile";

export function AccountPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [account, setAccount] = useState<AccountPublic | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [groupStore, setGroupStore] = useState<GroupStore | null>(null);
  const [cookie, setCookie] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  const loadData = () => {
    fetchAccount()
      .then(setAccount)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    fetchDashboard()
      .then((next) => {
        setDashboard(next);
        const preferredId = localStorage.getItem("farol_selected_group_id");
        const group = next.groups.find((item) => String(item.id) === preferredId)
          || next.groups.find((item) => item.canPost)
          || next.groups[0];
        if (group) {
          lookupGroupStore(String(group.id)).then(setGroupStore).catch(() => setGroupStore(null));
        } else {
          setGroupStore(null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, [params]);

  const copyUserId = () => {
    const id = account?.userId || dashboard?.user?.id;
    if (id) {
      navigator.clipboard.writeText(String(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function onConnect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await connectAccount(cookie, turnstileToken);
      setAccount(next);
      setCookie("");
      writeSession(next.displayName || next.username || "creator");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (
      !window.confirm(
        "Deseja realmente desconectar esta conta? Você precisará inserir o cookie novamente para sincronizar o catálogo."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await disconnectAccount();
      setAccount(next);
      setDashboard(null);
      setGroupStore(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const user = dashboard?.user;
  const groups = (dashboard?.groups || []).filter(
    (g) => g.isOwner || g.canPost || g.canViewSales || g.rank === 255 || g.role.toLowerCase().includes("owner")
  );
  const kpis = dashboard?.kpis;
  const isConnected = Boolean(account?.connected);

  const baseGroups = groups;

  const filteredGroups = baseGroups.filter(
    (g) =>
      g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      String(g.id).includes(groupSearch) ||
      g.role.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const memberCount = groupStore?.memberCount ?? null;
  const primaryGroup = groups.find((group) => group.id === groupStore?.groupId) || groups[0] || null;
  const userId = user?.id || account?.userId || null;
  const displayName = user?.displayName || account?.displayName || account?.username || "Conta Roblox";
  const username = user?.name || account?.username || null;
  const roles = (groupStore?.roles || []).map((role) => ({
    ...role,
    requirement: `${role.memberCount.toLocaleString("pt-BR")} membros`,
    description: "Cargo sincronizado com o grupo Roblox",
    badgeColor: role.rank === 255
      ? "bg-amber-500/15 text-amber-300"
      : role.rank >= 100
      ? "bg-blue-600/15 text-blue-400"
      : "bg-white/10 text-white/70",
    dotColor: role.rank === 255 ? "bg-amber-400" : role.rank >= 100 ? "bg-blue-500" : "bg-white/40",
  }));

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6 pb-24 text-white select-none">
      {/* Top Title Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Perfil &amp; Contas</span>
          </h1>
          <p className="text-xs text-white/50 mt-1 font-medium">
            Gerenciamento de credenciais, permissões e estrutura da comunidade
          </p>
        </div>

        {isConnected && (
          <DotButton
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="px-4 py-2 rounded-full text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 gap-2 self-start sm:self-auto shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Desconectar Conta</span>
          </DotButton>
        )}
      </motion.div>

      {isConnected ? (
        <div className="space-y-6">
          {/* 1. Hero Creator Identity Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative rounded-[28px] bg-[#0a0a0a] p-6 sm:p-8 overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.45)]"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
            <div className="absolute right-40 -bottom-20 w-72 h-72 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left Side: Avatar + Details */}
              <div className="flex items-center gap-5 sm:gap-6">
                <div className="relative shrink-0">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-[#141414] shadow-2xl ring-2 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#141414] text-white/35 shadow-2xl ring-2 ring-white/10 sm:h-24 sm:w-24">
                      <Users className="h-8 w-8" />
                    </div>
                  )}
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-[#0a0a0a] flex items-center justify-center"
                    title="Sessão ativa"
                  >
                    <Check className="w-3 h-3 text-black stroke-[3]" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                      {displayName}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      <span>{primaryGroup?.role || "Conta conectada"}</span>
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-white/50 font-medium mt-0.5">
                    {username ? `@${username}` : "Nome de usuário indisponível"}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    <button
                      type="button"
                      onClick={copyUserId}
                      className="px-3 py-1.5 rounded-full bg-[#141414] hover:bg-[#1f1f1f] text-white/70 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Copiar ID"
                    >
                      <span>ID: {userId || "—"}</span>
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-white/40" />
                      )}
                    </button>

                    {userId && (
                      <a
                        href={`https://www.roblox.com/users/${userId}/profile`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-full bg-[#141414] hover:bg-[#1f1f1f] text-white/70 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        <span>Perfil Roblox</span>
                        <ExternalLink className="w-3 h-3 text-white/40" />
                      </a>
                    )}

                    {primaryGroup && (
                      <a
                        href={`https://www.roblox.com/groups/${primaryGroup.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <span>{primaryGroup.name}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {account?.discord && (
                      <div className="px-3 py-1.5 rounded-full bg-[#5865F2]/15 border border-[#5865F2]/30 text-[#8ea1e1] text-xs font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#5865F2]" />
                        <span>Discord: <b>@{account.discord.name}</b></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Quick Group Status Pill */}
              <div className="flex md:flex-col items-start md:items-end justify-between md:justify-center gap-2 bg-[#121212] md:bg-transparent p-4 md:p-0 rounded-2xl">
                <div className="text-left md:text-right">
                  <span className="text-[11px] text-white/40 font-medium block">Grupo Principal</span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {primaryGroup?.name || "Nenhum grupo detectado"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Sincronização Ativa</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 2. Key Operation Metrics (Sleek Borderless Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="rounded-[24px] bg-[#0a0a0a] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-[#0f0f0f] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50">Receita Total</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-3 [font-variant-numeric:tabular-nums]">
                {dashboard?.sources.sales === "live" || dashboard?.sources.sales === "empty" ? `${(kpis?.totalRevenue ?? 0).toLocaleString("pt-BR")} R$` : "—"}
              </p>
              <span className="text-[11px] text-emerald-400/80 font-medium block mt-1">
                Faturamento confirmado
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-[24px] bg-[#0a0a0a] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-[#0f0f0f] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50">Peças Vendidas</span>
                <div className="w-8 h-8 rounded-xl bg-blue-600/15 flex items-center justify-center text-blue-500">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-3 [font-variant-numeric:tabular-nums]">
                {dashboard?.sources.sales === "live" || dashboard?.sources.sales === "empty" ? (kpis?.totalSales ?? 0).toLocaleString("pt-BR") : "—"}
              </p>
              <span className="text-[11px] text-white/40 font-medium block mt-1">
                Roupas &amp; UGC no catálogo
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="rounded-[24px] bg-[#0a0a0a] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-[#0f0f0f] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50">Comunidade</span>
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-3 [font-variant-numeric:tabular-nums]">
                {memberCount == null ? "—" : memberCount.toLocaleString("pt-BR")}
              </p>
              <span className="text-[11px] text-white/40 font-medium block mt-1">
                Membros registrados
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="rounded-[24px] bg-[#0a0a0a] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:bg-[#0f0f0f] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50">Lojas Conectadas</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-3 [font-variant-numeric:tabular-nums]">
                {dashboard?.sources.groups === "live" || dashboard?.sources.groups === "empty" ? groups.filter((g) => g.canPost).length : "—"}
              </p>
              <span className="text-[11px] text-purple-300/80 font-medium block mt-1">
                Com permissão de upload
              </span>
            </motion.div>
          </div>

          {/* 3. Community Roles Hierarchy (Discord / Roblox VIP Style) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25 }}
            className="rounded-[28px] bg-[#0a0a0a] p-6 sm:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Hierarquia &amp; Cargos da Comunidade</span>
                </h3>
                <p className="text-xs text-white/40 mt-0.5 font-medium">
                  Cargos e quantidades retornados diretamente pelo grupo Roblox
                </p>
              </div>
              <span className="text-xs font-semibold text-white/30 self-start sm:self-auto">
                {roles.length} cargos ativos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {roles.map((role) => (
                <div
                  key={role.rank}
                  className="p-4 rounded-2xl bg-[#121212] hover:bg-[#181818] transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${role.badgeColor}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${role.dotColor}`} />
                      <span>{role.name}</span>
                    </span>
                    <span className="text-[11px] font-mono text-white/40">
                      Rank {role.rank}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {role.requirement}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed font-medium">
                      {role.description}
                    </p>
                  </div>
                </div>
              ))}
              {roles.length === 0 && (
                <div className="col-span-full rounded-2xl bg-[#121212] px-4 py-8 text-center text-xs text-white/35">
                  Os cargos do grupo estão indisponíveis no momento.
                </div>
              )}
            </div>
          </motion.div>

          {/* 4. Connected Groups (Modern Borderless List) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="rounded-[28px] bg-[#0a0a0a] p-6 sm:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span>Grupos Vinculados</span>
                  <span className="text-xs font-semibold text-white/40 ml-1">
                    ({filteredGroups.length})
                  </span>
                </h3>
                <p className="text-xs text-white/40 mt-0.5 font-medium">
                  Grupos do Roblox com permissão de criação, catálogo ou gerenciamento
                </p>
              </div>

              {/* Search Pill */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Buscar grupo por nome ou cargo..."
                  className="w-full bg-[#141414] focus:bg-[#1a1a1a] text-white placeholder-white/30 text-xs rounded-full pl-9 pr-4 py-2.5 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Groups Table / List */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                    <th className="pb-3 pl-2">Grupo</th>
                    <th className="pb-3 px-3">ID</th>
                    <th className="pb-3 px-3">Seu Cargo</th>
                    <th className="pb-3 px-3">Permissões</th>
                    <th className="pb-3 pr-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] text-xs">
                  {filteredGroups.map((g, idx) => {
                    const isOwner =
                      g.role.toLowerCase().includes("owner") ||
                      g.rank === 255;
                    const isMainStore = isOwner || idx === 0;

                    return (
                      <tr
                        key={g.id}
                        className="hover:bg-white/[0.03] transition-colors rounded-xl group"
                      >
                        <td className="py-3.5 pl-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                                isOwner
                                  ? "bg-amber-500/20 text-amber-300"
                                  : g.canPost
                                  ? "bg-purple-500/20 text-purple-300"
                                  : "bg-[#161616] text-white/50"
                              }`}
                            >
                              {g.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white truncate">
                                  {g.name}
                                </span>
                                {isMainStore && (
                                  <span className="px-2 py-0.2 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold shrink-0">
                                    Loja Principal
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 font-mono text-white/40">
                          {g.id}
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`font-medium ${
                              isOwner
                                ? "text-amber-300 font-bold"
                                : "text-white/80"
                            }`}
                          >
                            {g.role}
                          </span>
                          <span className="text-[10px] text-white/30 ml-1.5 font-mono">
                            (Rank {g.rank})
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {g.canPost ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                                Publicar UGC / Roupas
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-white/40 text-[10px] font-medium">
                                Visualização
                              </span>
                            )}
                            {g.canViewSales && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-400 text-[10px] font-semibold">
                                Ver Vendas
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 pr-2 text-right">
                          <a
                            href={`https://www.roblox.com/groups/${g.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white/70 hover:text-white bg-[#161616] hover:bg-[#202020] transition-all cursor-pointer"
                          >
                            <span>Abrir Loja</span>
                            <ExternalLink className="w-3 h-3 text-white/40" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      ) : (
        /* Disconnected State: Clean AMOLED Card */
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto mt-12 rounded-[28px] bg-[#0a0a0a] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.5)] space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/15 text-blue-500 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Conectar Conta Roblox</h2>
              <p className="text-xs text-white/40 mt-0.5 font-medium">
                Autentique sua conta do Roblox para gerenciar seus grupos e catálogo
              </p>
            </div>
          </div>

          <form onSubmit={onConnect} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-2">
                Cookie .ROBLOSECURITY
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                rows={4}
                placeholder="_|WARNING:-DO-NOT-SHARE-THIS.--..."
                className="w-full bg-[#121212] focus:bg-[#161616] text-white placeholder-white/20 text-xs font-mono rounded-2xl p-4 focus:outline-none transition-all"
              />

              {cookie.trim() && (
                <div className="mt-2 text-[11px]">
                  {cookie.trim().length >= 500 ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Tamanho compatível ({cookie.trim().length} caracteres)
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1 font-medium">
                      ⚠️ Tamanho curto ({cookie.trim().length} caracteres). Certifique-se de copiar todo o valor com Ctrl+A.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Step-by-Step Instructions Box */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-[11px] text-white/60 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-white/80">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Como copiar seu cookie sem truncar:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-white/50">
                <li>Abra o <strong className="text-white/80">roblox.com</strong> logado na sua conta.</li>
                <li>Pressione <strong className="text-white/80">F12</strong> &gt; aba <strong className="text-white/80">Application</strong> (ou Armazenamento) &gt; <strong className="text-white/80">Cookies</strong> &gt; <code className="text-purple-300">https://www.roblox.com</code>.</li>
                <li>Dê <strong className="text-white/80">dois cliques</strong> no valor de <strong className="text-white/80">.ROBLOSECURITY</strong>.</li>
                <li>Pressione <strong className="text-white/80">Ctrl + A</strong> (para selecionar tudo sem cortar) e <strong className="text-white/80">Ctrl + C</strong>.</li>
                <li>O valor deve começar com <code className="text-purple-300">_|WARNING:-DO-NOT-SHARE-THIS...</code> e ter mais de 800 caracteres.</li>
              </ol>
            </div>

            {account?.hosted && (
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300/80 leading-relaxed">
                💡 <strong>Dica de Conexão:</strong> Caso sua conta Roblox tenha bloqueio de IP por região, você também pode abrir o Illusions direto no seu computador em{" "}
                <a
                  href="http://127.0.0.1:5174/painel/conta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-200 underline font-semibold"
                >
                  http://127.0.0.1:5174
                </a>
                , onde a conexão usa seu IP residencial direto.
              </div>
            )}

            {/* Cloudflare Turnstile Anti-Bot Protection */}
            <CloudflareTurnstile
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken("")}
            />

            <DotButton
              type="submit"
              disabled={busy || !cookie.trim()}
              wrapperClassName="w-full"
              className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 gap-2 shadow-sm"
            >
              {busy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validando sessão no Roblox...</span>
                </>
              ) : (
                <>
                  <span>Conectar Conta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </DotButton>
          </form>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/15 text-rose-300 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
