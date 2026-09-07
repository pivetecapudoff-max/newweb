import React, { useEffect, useState, useRef } from "react";
import { fetchDashboard, lookupGroupStore, type DashboardData, type GroupStore } from "../lib/api";
import { WaveChart } from "../components/WaveChart";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { DotButton } from "../components/ui/DotButton";
import {
  BarChart3,
  Users,
  ShoppingBag,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Calendar,
  Sparkles,
  Terminal,
  ShieldCheck,
  Copy,
  Check,
  X,
  Zap,
  ArrowRight,
  Layers,
  ChevronDown,
  Building2,
  Search,
} from "lucide-react";

interface AiLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  action: string;
  message: string;
  details?: any;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [groupStore, setGroupStore] = useState<GroupStore | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Modals & Optimization State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeStatus, setOptimizeStatus] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<{
    total?: number;
    updated?: number;
    errors?: number;
  } | null>(null);
  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })
      );
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Group selection state
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return localStorage.getItem("farol_selected_group_id") || "all";
  });
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowGroupDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadDashboard = (gid = selectedGroupId) => {
    fetchDashboard(gid)
      .then(setData)
      .catch(() => {});
  };

  useEffect(() => {
    loadDashboard(selectedGroupId);
    const interval = setInterval(() => loadDashboard(selectedGroupId), 15000);
    return () => clearInterval(interval);
  }, [selectedGroupId]);

  useEffect(() => {
    const targetGid = selectedGroupId === "all"
      ? (data?.groups.find((g) => g.canPost)?.id || data?.groups[0]?.id)
      : selectedGroupId;

    if (!targetGid) {
      setGroupStore(null);
      return;
    }
    const loadGroupStore = () => {
      lookupGroupStore(String(targetGid)).then(setGroupStore).catch(() => setGroupStore(null));
    };
    loadGroupStore();
    const interval = setInterval(loadGroupStore, 120000);
    return () => clearInterval(interval);
  }, [selectedGroupId, data?.groups]);

  const handleSelectGroup = (gid: string) => {
    setSelectedGroupId(gid);
    localStorage.setItem("farol_selected_group_id", gid);
    setShowGroupDropdown(false);
    loadDashboard(gid);
  };

  // Fetch logs from backend
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/ai/logs");
      if (res.ok) {
        const json = await res.json();
        if (json.logs && Array.isArray(json.logs)) {
          setLogs(json.logs);
        }
      }
    } catch {}
  };

  // Auto-scroll to bottom of logs when new logs arrive or modal opens
  useEffect(() => {
    if (showLogsModal && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showLogsModal]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Triggered by "Otimizar Catálogo" button
  const handleOpenOptimize = () => {
    if (optimizing) {
      // If already running, open logs modal directly to view progress
      setShowLogsModal(true);
    } else {
      // Show confirmation popup first
      setShowConfirmModal(true);
    }
  };

  // Confirmed: start real optimization and open live logs
  const handleConfirmOptimization = async () => {
    setShowConfirmModal(false);
    setShowLogsModal(true);
    setOptimizing(true);
    setOptimizeResult(null);
    setOptimizeStatus("Iniciando varredura e otimização do catálogo...");

    // Fetch initial logs immediately
    await fetchLogs();

    // Start live polling every 800ms
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(fetchLogs, 800);

    try {
      const gidToUse = selectedGroupId === "all"
        ? data?.groups.find((group) => group.canPost)?.id
        : Number(selectedGroupId);
      if (!gidToUse) {
        setOptimizeStatus("⚠️ Nenhum grupo com permissão de upload está selecionado.");
        return;
      }
      const res = await fetch("/api/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: gidToUse }),
      });
      const json = await res.json();
      await fetchLogs();

      if (res.ok && json.success) {
        setOptimizeResult(json.result);
        setOptimizeStatus(
          `✅ ${json.result?.updated ?? 0} de ${json.result?.total ?? 0} itens atualizados; ${json.result?.errors ?? 0} erro(s).`
        );
        loadDashboard();
      } else {
        setOptimizeStatus(`⚠️ Erro: ${json.error || "Falha ao otimizar"}`);
      }
    } catch (err: any) {
      setOptimizeStatus(`❌ Erro de conexão: ${err.message}`);
    } finally {
      setOptimizing(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      await fetchLogs();
    }
  };

  const handleCopyLogs = () => {
    const displayList = [...logs].reverse();
    const text = displayList
      .map(
        (l) =>
          `[${l.timestamp}] [${(l.action || l.level).toUpperCase()}] ${l.message}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Group metadata & resolution: only include groups where the user has management/economy permissions
  const allGroups = (data?.groups?.length ? data.groups : []).filter(
    (g) => g.isOwner || g.canPost || g.canViewSales || g.rank === 255 || g.role.toLowerCase().includes("owner")
  );

  const isAllGroups = selectedGroupId === "all";
  const activeGroup = isAllGroups
    ? null
    : allGroups.find((g) => String(g.id) === String(selectedGroupId)) || null;

  const activeGroupName = isAllGroups
    ? "Todos os Grupos"
    : activeGroup?.name || groupStore?.groupName || "Grupo selecionado";
  const activeGroupId = isAllGroups ? "Consolidado" : String(activeGroup?.id || selectedGroupId || "—");
  const activeGroupRole = isAllGroups ? "Visão Global" : activeGroup?.role || "Cargo indisponível";

  const filteredGroups = allGroups.filter((g) => {
    if (!groupSearch.trim()) return true;
    const q = groupSearch.toLowerCase();
    return g.name.toLowerCase().includes(q) || String(g.id).includes(q) || g.role.toLowerCase().includes(q);
  });

  const k = data?.kpis;
  const salesAvailable = data?.sources.sales === "live" || data?.sources.sales === "empty";
  const todayRev = salesAvailable ? k?.todayRevenue ?? 0 : null;
  const todaySales = salesAvailable ? k?.todaySales ?? 0 : null;
  const weeklyRev = data?.weekly?.reduce((acc, w) => acc + (w.revenue || 0), 0) ?? 0;
  const totalRev = salesAvailable ? k?.totalRevenue ?? 0 : null;
  const totalSales = salesAvailable ? k?.totalSales ?? 0 : null;
  const totalMembers = isAllGroups
    ? (allGroups.reduce((acc, g) => acc + (g.memberCount || 0), 0) || groupStore?.memberCount || null)
    : (activeGroup?.memberCount ?? groupStore?.memberCount ?? null);
  const totalItems = groupStore?.itemCount ?? null;
  const clothingCount = groupStore?.items.filter((item) => [2, 11, 12].includes(item.assetTypeId)).length ?? null;
  const ugcCount = groupStore && clothingCount != null ? groupStore.itemCount - clothingCount : null;

  const userName = data?.user?.displayName || data?.user?.name || "Conta Roblox";

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, delay: i * 0.08, ease: "easeOut" as const },
    }),
  };

  const recentSales = (data?.recentSales || []).map((sale, index) => {
    const sourceGroupId = sale.source.startsWith("group:") ? sale.source.slice(6) : null;
    const sourceGroup = sourceGroupId
      ? allGroups.find((group) => String(group.id) === sourceGroupId)
      : null;
    return {
      id: `${sale.created}-${index}`,
      name: sale.name,
      type: "Venda",
      origin: sourceGroup?.name || (sale.source === "user" ? "Conta Roblox" : "Roblox"),
      time: new Date(sale.created).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      amount: sale.amount,
    };
  });

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6 pb-16 text-white select-none">
      {/* Title & Top Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between gap-4"
      >
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight animate-shiny inline-block"
            style={{
              backgroundImage:
                "linear-gradient(to right, #2563eb 0%, #3b82f6 20%, #60a5fa 35%, #bfdbfe 50%, #60a5fa 65%, #3b82f6 80%, #2563eb 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
            }}
          >
            Dashboard &bull; Welcome, {userName}
          </h1>
          <p className="text-xs text-white/40 mt-1 font-medium flex items-center gap-2 flex-wrap">
            <span className="text-white/80 font-bold">{activeGroupName}</span>
            <span>&bull;</span>
            <span>{isAllGroups ? "Todas as Lojas" : `ID: ${activeGroupId}`}</span>
            <span>&bull;</span>
            <span className="px-2 py-0.2 rounded-full bg-white/5 text-white/60 text-[10px]">
              {activeGroupRole}
            </span>
          </p>
        </div>

        {/* Top Action Bar: Group Selector Dropdown & Optimize Button */}
        <div className="flex items-center gap-3">
          {/* Group Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowGroupDropdown(!showGroupDropdown)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#111111] hover:bg-[#1a1a1a] active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm border-none"
              title="Trocar grupo do Roblox ativo na dashboard"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600/15 flex items-center justify-center text-blue-500 shrink-0">
                <Building2 className="w-3 h-3" />
              </div>
              <div className="text-left max-w-[120px] sm:max-w-[170px] truncate">
                <span className="block truncate text-white leading-tight font-bold">
                  {activeGroupName}
                </span>
                <span className="block text-[10px] text-white/40 leading-tight">
                  {isAllGroups ? "Todas as Lojas" : `ID: ${activeGroupId}`}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 shrink-0 ${
                  showGroupDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Floating AMOLED Dropdown Panel */}
            <AnimatePresence>
              {showGroupDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#0a0a0a] p-3 text-white shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 overflow-hidden"
                  style={{ border: "none" }}
                >
                  {/* Search Bar */}
                  <div className="relative mb-2.5">
                    <Search className="w-3.5 h-3.5 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Buscar entre seus grupos..."
                      className="w-full bg-[#141414] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-semibold text-white/40 uppercase tracking-wider px-2 py-1">
                    <span>Grupos Disponíveis</span>
                    <span>{allGroups.length}</span>
                  </div>

                  {/* Groups Scrollable List */}
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {/* Option: All Groups */}
                    <button
                      type="button"
                      onClick={() => handleSelectGroup("all")}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        isAllGroups
                          ? "bg-blue-600/15 text-blue-400 font-bold"
                          : "hover:bg-white/[0.04] text-white/70 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/70 shrink-0">
                          🌐
                        </div>
                        <div className="truncate">
                          <span className="block truncate font-semibold">Todos os Grupos</span>
                          <span className="block text-[10px] text-white/40">Visão consolidada</span>
                        </div>
                      </div>
                      {isAllGroups && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    </button>

                    {/* Filtered Groups */}
                    {filteredGroups.map((g) => {
                      const isSelected = String(g.id) === String(selectedGroupId);
                      const isOwner = g.reason === "Owner" || g.rank === 255 || g.role.toLowerCase().includes("owner");

                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleSelectGroup(String(g.id))}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                            isSelected
                              ? "bg-blue-600/15 text-blue-400 font-bold"
                              : "hover:bg-white/[0.04] text-white/80 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                isOwner
                                  ? "bg-amber-500/15 text-amber-300"
                                  : g.canPost
                                  ? "bg-blue-500/15 text-blue-300"
                                  : "bg-white/5 text-white/50"
                              }`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="truncate font-semibold text-white">{g.name}</span>
                                {isOwner && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 shrink-0 font-bold">
                                    Owner
                                  </span>
                                )}
                              </div>
                              <span className="block text-[10px] text-white/40">
                                ID: {g.id} &bull; {g.role}
                              </span>
                            </div>
                          </div>

                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Button: Dot Border Effect */}
          <DotButton
            onClick={handleOpenOptimize}
            className="px-5 py-2.5 rounded-full font-semibold text-xs text-black bg-white hover:bg-white/90 gap-2 shrink-0 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${optimizing ? "animate-spin" : ""}`} />
            <span>{optimizing ? "Otimizando..." : "Otimizar Catálogo"}</span>
          </DotButton>
        </div>
      </motion.div>

      {/* Optimization Banner Feedback */}
      {optimizeStatus && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 transition-all cursor-pointer ${
            optimizeStatus.includes("✅")
              ? "bg-blue-500/15 text-blue-300"
              : optimizeStatus.includes("⚠️") || optimizeStatus.includes("❌")
              ? "bg-rose-500/15 text-rose-300"
              : "bg-blue-600/15 text-blue-400"
          }`}
          onClick={() => setShowLogsModal(true)}
        >
          <div className="flex items-center gap-2.5">
            {optimizeStatus.includes("✅") ? (
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <span className="font-medium">{optimizeStatus}</span>
          </div>
          <span className="text-[11px] underline opacity-80 shrink-0">Ver Logs &rarr;</span>
        </motion.div>
      )}

      {/* Row of 4 Stat Cards with Real Roblox Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Revenue in Robux */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3 }}
          className="relative rounded-[22px] bg-[#0a0a0a] p-5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all"
        >
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-blue-600/10 blur-xl pointer-events-none" />

          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white/70">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white/60">Receita Robux</span>
          </div>

          <div>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {totalRev == null ? "—" : `${totalRev.toLocaleString("pt-BR")} R$`}
            </h3>
            <p className="text-[11px] text-white/35 mt-1 font-medium">
              {todayRev == null ? "Dados de vendas indisponíveis" : `+${todayRev} R$ hoje · ${weeklyRev} R$ (7 dias)`}
            </p>
          </div>
        </motion.div>

        {/* Card 2: Group Members */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3 }}
          className="relative rounded-[22px] bg-[#0a0a0a] p-5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white/70">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white/60">Membros do Grupo</span>
          </div>

          <div>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {totalMembers == null ? "—" : totalMembers.toLocaleString("pt-BR")}
            </h3>
            <p className="text-[11px] text-white/35 mt-1 font-medium">
              {isAllGroups
                ? `${allGroups.length} ${allGroups.length === 1 ? "grupo vinculado" : "grupos vinculados"} · Visão Global`
                : `${activeGroupName} • ${activeGroupRole}`}
            </p>
            <p className="text-[10px] text-white/20 mt-0.5">
              {isAllGroups ? "Total consolidado de membros" : "Grupo oficial no Roblox"}
            </p>
          </div>
        </motion.div>

        {/* Card 3: Orders / Clothing & UGC Sold */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3 }}
          className="relative rounded-[22px] bg-[#0a0a0a] p-5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white/70">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white/60">Vendas (Roupas & UGC)</span>
          </div>

          <div>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {totalSales == null ? "—" : totalSales.toLocaleString("pt-BR")}
            </h3>
            <p className="text-[11px] text-white/35 mt-1 font-medium">
              {todaySales == null ? "Dados de vendas indisponíveis" : `+${todaySales} hoje · transações Roblox`}
            </p>
            <p className="text-[10px] text-white/20 mt-0.5">
              Histórico acumulado de vendas
            </p>
          </div>
        </motion.div>

        {/* Card 4: Active Catalog (Clothing + UGC) */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3 }}
          className="relative rounded-[22px] bg-[#0a0a0a] p-5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white/70">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white/60">Catálogo Ativo</span>
          </div>

          <div>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              {totalItems == null ? "—" : `${totalItems} peças`}
            </h3>
            <p className="text-[11px] text-white/35 mt-1 font-medium">
              {clothingCount == null || ugcCount == null
                ? (isAllGroups && allGroups.length === 0 ? "Nenhum grupo com catálogo" : "Catálogo indisponível")
                : `${clothingCount} roupas 2D · ${ugcCount} itens 3D`}
            </p>
            <p className="text-[10px] text-white/20 mt-0.5">
              {isAllGroups && groupStore
                ? `Catálogo do grupo principal (${groupStore.groupName})`
                : "Contagem retornada pelo catálogo Roblox"}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Wave Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
      >
        <WaveChart
          title="Receita Robux"
          onOptimizeClick={handleOpenOptimize}
          weeklyData={data?.weekly}
        />
      </motion.div>

      {/* Recent Activity Table with UGC and Clothing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="rounded-[24px] bg-[#0a0a0a] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.45)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Atividades Recentes de Vendas</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 font-semibold">
                Transações Roblox
              </span>
            </h2>
            <span className="text-xs text-white/35 font-medium">
              Sincronizado &bull; {activeGroupName}
            </span>
          </div>

          <div className="rounded-full bg-[#141414] px-3 py-1.5 text-[11px] font-medium text-white/60 self-start sm:self-auto">
            {recentSales.length} registros carregados
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-white/40 text-xs font-medium">
                <th className="pb-3 px-3">Item / Atividade</th>
                <th className="pb-3 px-3">Tipo</th>
                <th className="pb-3 px-3">Origem</th>
                <th className="pb-3 px-3">Horário</th>
                <th className="pb-3 px-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3 text-white/90 font-medium">
                    <span className="truncate max-w-[220px] sm:max-w-none block">{sale.name}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="rounded-full bg-blue-600/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                      {sale.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-white/60">{sale.origin}</td>
                  <td className="py-3.5 px-3 text-white/50">{sale.time}</td>
                  <td className="py-3.5 px-3 text-right font-semibold">
                    <span className="text-blue-400">
                      +{sale.amount} R$
                    </span>
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-white/35">
                    {salesAvailable ? "Nenhuma venda retornada para este filtro." : "A Roblox não disponibilizou as transações desta conta."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* MODAL 1: Confirmação & Explicação ("Tem certeza? O que faz") */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-xl rounded-[28px] bg-[#0a0a0a] p-6 sm:p-7 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden"
              style={{ border: "none" }}
            >
              {/* Subtle background aura */}
              <div className="absolute -top-24 -right-24 w-52 h-52 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                      Otimizar Catálogo com IA
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      {activeGroupName} &bull; ID: {activeGroupId} &bull; {totalItems == null ? "Catálogo indisponível" : `${totalItems} peças`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-8 h-8 rounded-full bg-[#141414] hover:bg-[#202020] text-white/50 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Detailed Explanation ("Falar o que faz") */}
              <div className="space-y-3.5 mb-6">
                <p className="text-xs text-white/70 leading-relaxed">
                  Tem certeza que deseja iniciar a otimização de catálogo? Veja exatamente o que será executado:
                </p>

                <div className="bg-[#111111] rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-600/15 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block">1. Varredura Completa</span>
                      <span className="text-white/50 text-[11px] leading-relaxed">
                        Analisa todas as peças ativas do grupo {activeGroupName} diretamente no catálogo do Roblox.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block">2. IA & Tags Virais (SEO Roupas & UGC)</span>
                      <span className="text-white/50 text-[11px] leading-relaxed">
                        Reescreve títulos e descrições inserindo termos em alta (<span className="text-blue-400">#Aesthetic, #RobloxUGC, #UGCHair, #Y2K, #Streetwear</span>) para multiplicar o tráfego orgânico.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block">3. Otimização para o CAC & Busca</span>
                      <span className="text-white/50 text-[11px] leading-relaxed">
                        Formata palavras-chave que aumentam a relevância nos provadores do <span className="text-blue-300">Catalog Avatar Creator</span> e na busca nativa do Roblox.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block">4. Sincronização Segura via API</span>
                      <span className="text-white/50 text-[11px] leading-relaxed">
                        Aplica as alterações via API oficial do Roblox com pausas automáticas para prevenir rate-limits (HTTP 429).
                      </span>
                    </div>
                  </div>
                </div>

                {/* Safe badge note */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-600/5 text-blue-400/80 text-[11px]">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                  <span>
                    Seus preços, texturas e designs visuais <strong>não são alterados</strong>. Apenas metadados de SEO para vender mais.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-white/60 bg-[#141414] hover:bg-[#1f1f1f] hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <DotButton
                  type="button"
                  onClick={handleConfirmOptimization}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-black bg-white hover:bg-white/90 gap-2 shadow-lg shadow-white/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sim, Iniciar Otimização</span>
                </DotButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Console de Logs em Tempo Real ("Ver se tá dando certo") */}
      <AnimatePresence>
        {showLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-3xl rounded-[28px] bg-[#0a0a0a] p-6 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col max-h-[88vh] overflow-hidden"
              style={{ border: "none" }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-4 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#141414] flex items-center justify-center text-blue-500 shrink-0">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      <span>Console de Execução em Tempo Real</span>
                    </h2>
                    <p className="text-xs text-white/40">
                      Sincronização com a API do Roblox &bull; {activeGroupName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Status badge */}
                  {optimizing ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/15 text-blue-400 text-xs font-semibold">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>Em Execução...</span>
                    </div>
                  ) : optimizeResult ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-300 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Concluído com Sucesso!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pronto</span>
                    </div>
                  )}

                  <button
                    onClick={() => setShowLogsModal(false)}
                    className="w-8 h-8 rounded-full bg-[#141414] hover:bg-[#202020] text-white/50 hover:text-white flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mini Status telemetry strip */}
              <div className="grid grid-cols-3 gap-3 mb-4 shrink-0 text-xs">
                <div className="bg-[#111111] rounded-xl p-3">
                  <span className="text-white/40 block text-[10px] uppercase tracking-wider font-semibold">
                    Catálogo do Grupo
                  </span>
                  <span className="text-white font-bold text-sm mt-0.5 block truncate">
                    {totalItems == null ? "Indisponível" : `${totalItems} peças`}
                  </span>
                  <span className="text-[10px] text-white/40 block mt-0.5 truncate">
                    {activeGroupRole || "Roblox Store"}
                  </span>
                </div>
                <div className="bg-[#111111] rounded-xl p-3">
                  <span className="text-white/40 block text-[10px] uppercase tracking-wider font-semibold">
                    Status da IA
                  </span>
                  <span className="text-blue-400 font-bold text-sm mt-0.5 block">
                    {optimizing ? "Processando SEO..." : optimizeResult ? "Finalizado" : "Aguardando"}
                  </span>
                  <span className="text-[10px] text-white/40 block mt-0.5">Tags & Provador CAC</span>
                </div>
                <div className="bg-[#111111] rounded-xl p-3">
                  <span className="text-white/40 block text-[10px] uppercase tracking-wider font-semibold">
                    Itens Otimizados
                  </span>
                  <span className="text-blue-400 font-bold text-sm mt-0.5 block">
                    {optimizeResult ? `${optimizeResult.updated ?? 0} / ${optimizeResult.total ?? 0}` : optimizing ? "Em andamento..." : "Ainda não executado"}
                  </span>
                  <span className="text-[10px] text-white/40 block mt-0.5">Resultado da última execução</span>
                </div>
              </div>

              {/* Terminal Logs Window (pure AMOLED black, monospace, auto-scroll) */}
              <div className="bg-[#050505] rounded-2xl p-4 overflow-y-auto flex-1 font-mono text-[11px] sm:text-[11.5px] leading-relaxed space-y-2 select-text shadow-inner min-h-[280px]">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs font-sans py-12">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-white/20" />
                      <span>Aguardando primeiros logs do servidor...</span>
                    </div>
                  </div>
                ) : (
                  [...logs].reverse().map((entry, idx) => {
                    const isInfo = entry.level === "info";
                    const isSuccess = entry.level === "success";
                    const isWarn = entry.level === "warn";
                    const isError = entry.level === "error";

                    return (
                      <div
                        key={entry.id || idx}
                        className="flex items-start gap-2.5 py-0.5 px-1 rounded hover:bg-white/[0.02] transition"
                      >
                        {/* Timestamp */}
                        <span className="text-white/30 text-[10.5px] shrink-0 pt-0.5">
                          {entry.timestamp}
                        </span>

                        {/* Action Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold tracking-wider shrink-0 uppercase ${
                            isSuccess
                              ? "bg-blue-500/20 text-blue-300"
                              : isWarn
                              ? "bg-amber-500/20 text-amber-300"
                              : isError
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-blue-600/15 text-blue-400"
                          }`}
                        >
                          {entry.action || entry.level}
                        </span>

                        {/* Message */}
                        <span
                          className={`flex-1 break-words ${
                            isSuccess
                              ? "text-blue-300 font-medium"
                              : isWarn
                              ? "text-amber-300 font-medium"
                              : isError
                              ? "text-rose-400 font-medium"
                              : "text-white/80"
                          }`}
                        >
                          {entry.message}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between gap-4 pt-4 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white/70 bg-[#141414] hover:bg-[#202020] hover:text-white transition flex items-center gap-2 cursor-pointer"
                  >
                    {copiedLogs ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-blue-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Logs</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-white/30">
                    {logs.length} eventos registrados
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {optimizing ? (
                    <button
                      type="button"
                      onClick={() => setShowLogsModal(false)}
                      className="px-5 py-2 rounded-full text-xs font-semibold text-white/60 bg-[#141414] hover:bg-[#202020] hover:text-white transition cursor-pointer"
                    >
                      Minimizar (Continuar em 2º plano)
                    </button>
                  ) : (
                    <DotButton
                      type="button"
                      onClick={() => {
                        setShowLogsModal(false);
                        loadDashboard();
                      }}
                      className="px-6 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-white/90 shadow-sm"
                    >
                      Concluir & Fechar
                    </DotButton>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
