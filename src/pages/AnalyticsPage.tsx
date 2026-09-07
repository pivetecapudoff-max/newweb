import React, { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  Coins,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Search,
  ChevronDown,
  Award,
  Calendar,
  Layers,
  Clock,
  User,
} from "lucide-react";
import { fetchAnalytics, type AnalyticsData } from "../lib/api";

export function AnalyticsPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    return localStorage.getItem("farol_selected_group_id") || "all";
  });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sales" | "revenue" | "recent">("sales");

  const loadData = async (gid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnalytics(gid ?? selectedGroupId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar as métricas de analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedGroupId);
  }, [selectedGroupId]);

  const handleGroupChange = (newGid: string) => {
    setSelectedGroupId(newGid);
    localStorage.setItem("farol_selected_group_id", newGid);
  };

  // Filtered & Sorted Bestsellers
  const filteredBestsellers = useMemo(() => {
    if (!data?.bestsellers) return [];
    let list = data.bestsellers.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || String(item.id).includes(q);
    });

    if (sortBy === "sales") {
      list = [...list].sort((a, b) => b.salesCount - a.salesCount);
    } else if (sortBy === "revenue") {
      list = [...list].sort((a, b) => b.totalRobux - a.totalRobux);
    } else if (sortBy === "recent") {
      list = [...list].sort((a, b) => new Date(b.lastSoldAt).getTime() - new Date(a.lastSoldAt).getTime());
    }
    return list;
  }, [data?.bestsellers, searchQuery, sortBy]);

  const k = data?.kpis;
  const top1 = data?.bestsellers?.[0] || null;

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Agora mesmo";
      if (mins < 60) return "há " + mins + "m";
      const hours = Math.floor(mins / 60);
      if (hours < 24) return "há " + hours + "h";
      const days = Math.floor(hours / 24);
      return "há " + days + "d";
    } catch {
      return "recente";
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-transparent p-6 md:p-8 space-y-6 pb-20 text-white select-none backdrop-blur-[2px]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.03em] text-white">
                Analytics &amp; Bestsellers
              </h1>
              <p className="text-xs sm:text-sm text-white/45 mt-0.5">
                Ranking detalhado do que mais vendeu, volume de peças e faturamento real do catálogo.
              </p>
            </div>
          </div>
        </div>

        {/* Group Selector & Refresh */}
        <div className="flex items-center gap-3">
          {/* Dynamic Group Switcher */}
          <div className="relative">
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="appearance-none bg-[#0a0a0a]/90 hover:bg-[#121212] border border-white/[0.08] text-white text-xs font-semibold py-2.5 pl-3.5 pr-8 rounded-xl cursor-pointer focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="all">Todas as Lojas (Consolidado)</option>
              {(data?.groups || []).map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name} ({g.id})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => loadData()}
            disabled={loading}
            title="Atualizar dados de vendas"
            className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={"w-4 h-4 " + (loading ? "animate-spin text-blue-400" : "")} />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[22px] bg-[#0a0a0a]/75 backdrop-blur-md border border-white/[0.08] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              Total de Vendas
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white block">
              {k?.totalSales?.toLocaleString("pt-BR") ?? 0}
            </span>
            <span className="text-[11px] font-medium text-blue-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{k?.todaySales ?? 0} vendas hoje</span>
            </span>
          </div>
        </motion.div>

        {/* Revenue in Robux */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[22px] bg-[#0a0a0a]/75 backdrop-blur-md border border-white/[0.08] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              Receita em Robux
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white block">
              {k?.totalRevenue?.toLocaleString("pt-BR") ?? 0} <span className="text-sm font-semibold text-amber-400">R$</span>
            </span>
            <span className="text-[11px] font-medium text-amber-400/90 mt-1 flex items-center gap-1">
              <span>{k?.todayRevenue ?? 0} R$ faturados hoje</span>
            </span>
          </div>
        </motion.div>

        {/* Average Ticket */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[22px] bg-[#0a0a0a]/75 backdrop-blur-md border border-white/[0.08] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              Ticket Médio
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white block">
              {k?.avgTicket ?? 5} <span className="text-sm font-semibold text-blue-400">R$</span>
            </span>
            <span className="text-[11px] font-medium text-white/40 mt-1 block">
              Média por peça vendida
            </span>
          </div>
        </motion.div>

        {/* Top 1 Seller */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[22px] bg-[#0a0a0a]/75 backdrop-blur-md border border-white/[0.08] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              #1 Mais Vendido
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-white block truncate">
              {top1 ? top1.name : "Nenhum item"}
            </span>
            <span className="text-[11px] font-medium text-amber-400 mt-1 flex items-center gap-1">
              {top1 ? (top1.salesCount + " vendas • " + top1.totalRobux + " R$") : "Aguardando transações"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Hero Spotlight: Top 1 Bestseller */}
      {top1 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-[24px] bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-[#0a0a0a]/80 backdrop-blur-xl border border-blue-500/20 p-6 shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-black/50 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
              {top1.thumbnailUrl ? (
                <img
                  src={top1.thumbnailUrl}
                  alt={top1.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <ShoppingBag className="w-10 h-10 text-white/20" />
              )}
              <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black tracking-wider flex items-center gap-1 shadow-md">
                <span>#1 TOP</span>
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                  Campeão do Catálogo
                </span>
                <span className="text-[11px] font-mono text-white/40">ID: {top1.id}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
                {top1.name}
              </h2>
              <div className="flex items-center gap-4 text-xs text-white/70 pt-1">
                <span>
                  <strong className="text-white font-bold">{top1.salesCount}</strong> unidades vendidas
                </span>
                <span>•</span>
                <span>
                  <strong className="text-amber-400 font-bold">{top1.totalRobux} R$</strong> faturados
                </span>
                <span>•</span>
                <span>
                  <strong className="text-blue-400 font-bold">{top1.shareOfTotal}%</strong> de participação
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
            <a
              href={top1.catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <span>Ver no Catálogo Roblox</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>
      )}

      {/* Main Section: Bestsellers Table ("O Que Vendeu Mais") */}
      <div className="rounded-[24px] bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.08] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-5">
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Ranking de Bestsellers</span>
              <span className="text-xs font-medium text-white/40">
                ({filteredBestsellers.length} itens com vendas registradas)
              </span>
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Lista ordenada dos produtos com maior volume de compradores e receita líquida.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar item ou ID..."
                className="bg-[#141414] hover:bg-[#181818] focus:bg-[#181818] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40 w-48 sm:w-60 transition-colors"
              />
            </div>

            {/* Sort Buttons */}
            <div className="flex items-center bg-[#141414] p-1 rounded-xl border border-white/[0.06] text-xs">
              <button
                onClick={() => setSortBy("sales")}
                className={"px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer " + (sortBy === "sales" ? "bg-white/15 text-white" : "text-white/40 hover:text-white")}
              >
                Vendas
              </button>
              <button
                onClick={() => setSortBy("revenue")}
                className={"px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer " + (sortBy === "revenue" ? "bg-white/15 text-white" : "text-white/40 hover:text-white")}
              >
                Robux
              </button>
              <button
                onClick={() => setSortBy("recent")}
                className={"px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer " + (sortBy === "recent" ? "bg-white/15 text-white" : "text-white/40 hover:text-white")}
              >
                Recentes
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading && !data ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
            <p className="text-xs text-white/40">Carregando transações e ranking do Roblox...</p>
          </div>
        ) : filteredBestsellers.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#111111]/40 rounded-2xl border border-white/[0.04]">
            <ShoppingBag className="w-10 h-10 text-white/20 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Nenhum item com vendas encontrado</h3>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              Nenhuma transação do tipo Sale foi retornada para o grupo selecionado ou nenhuma peça corresponde à sua busca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  <th className="pb-3 pl-3 w-16">Rank</th>
                  <th className="pb-3">Item / Roupa</th>
                  <th className="pb-3 text-right">Vendas</th>
                  <th className="pb-3 text-right">Receita Total</th>
                  <th className="pb-3 text-right">Preço Médio</th>
                  <th className="pb-3 text-right">Participação</th>
                  <th className="pb-3 text-right">Última Venda</th>
                  <th className="pb-3 pr-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredBestsellers.map((item, index) => {
                  const rank = index + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;

                  return (
                    <tr
                      key={item.id + "-" + index}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Rank Badge */}
                      <td className="py-3.5 pl-3">
                        <div
                          className={"w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs " + (
                            isTop1
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                              : isTop2
                              ? "bg-slate-300/20 text-slate-200 border border-slate-400/40"
                              : isTop3
                              ? "bg-amber-700/20 text-amber-500 border border-amber-600/40"
                              : "text-white/40 font-mono"
                          )}
                        >
                          {rank <= 3 ? "#" + rank : rank}
                        </div>
                      </td>

                      {/* Item Info with Thumbnail */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-white/30" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white text-xs block group-hover:text-blue-400 transition-colors truncate max-w-[280px]">
                              {item.name}
                            </span>
                            <span className="text-[10px] font-mono text-white/40 block mt-0.5">
                              ID: {item.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Units Sold */}
                      <td className="py-3.5 text-right font-bold text-white">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 text-xs font-mono font-bold">
                          {item.salesCount.toLocaleString("pt-BR")}
                        </span>
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3.5 text-right font-bold text-amber-400 font-mono">
                        {item.totalRobux.toLocaleString("pt-BR")} R$
                      </td>

                      {/* Avg Price */}
                      <td className="py-3.5 text-right text-white/70 font-mono">
                        {item.avgPrice} R$
                      </td>

                      {/* Share Progress Bar */}
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: Math.min(100, Math.max(5, item.shareOfTotal)) + "%" }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-white/50 w-8">
                            {item.shareOfTotal}%
                          </span>
                        </div>
                      </td>

                      {/* Last Sold At */}
                      <td className="py-3.5 text-right text-white/40 text-[11px]">
                        {formatRelativeTime(item.lastSoldAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 pr-3 text-right">
                        <a
                          href={item.catalogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir no Roblox"
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-white/60 hover:text-white inline-flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Section: Daily Sales History & Recent Sales Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <div className="rounded-[24px] bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.08] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Histórico Diário (14 Dias)</h3>
                <p className="text-[11px] text-white/40">Volume de transações por dia</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {data?.dailySales && data.dailySales.length > 0 ? (
              <div className="space-y-2">
                <div className="h-36 flex items-end gap-1.5 sm:gap-2 pt-4 px-1">
                  {(() => {
                    const maxSales = Math.max(1, ...data.dailySales.map((d) => d.sales));
                    return data.dailySales.map((d, i) => {
                      const heightPercent = Math.max(8, Math.round((d.sales / maxSales) * 100));
                      const isToday = i === data.dailySales.length - 1;

                      return (
                        <div
                          key={d.date}
                          className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                        >
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-black/90 border border-white/15 px-2 py-1 rounded text-[10px] text-white font-mono pointer-events-none whitespace-nowrap z-20 shadow-lg">
                            {d.date.slice(5)}: {d.sales} vendas ({d.revenue} R$)
                          </div>

                          <div
                            className={"w-full rounded-t-md transition-all " + (
                              isToday
                                ? "bg-gradient-to-t from-blue-600 to-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.5)]"
                                : d.sales > 0
                                ? "bg-blue-600/40 hover:bg-blue-600/70"
                                : "bg-white/[0.04]"
                            )}
                            style={{ height: heightPercent + "%" }}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Day Labels */}
                <div className="flex justify-between text-[10px] text-white/30 font-mono px-1">
                  <span>{data.dailySales[0]?.date.slice(5)}</span>
                  <span>Últimos 14 Dias</span>
                  <span className="text-blue-400 font-semibold">Hoje</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-white/30">Sem histórico diário disponível.</div>
            )}
          </div>
        </div>

        {/* Live Recent Transactions Feed */}
        <div className="rounded-[24px] bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.08] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Transações Recentes</h3>
                <p className="text-[11px] text-white/40">Feed em tempo real das compras de catálogo</p>
              </div>
            </div>
            <span className="text-[11px] text-white/40 font-medium">Recentes</span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {data?.recentSales && data.recentSales.length > 0 ? (
              data.recentSales.slice(0, 10).map((s, idx) => (
                <div
                  key={s.id + "-" + s.created + "-" + idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-white/[0.04]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {s.thumbnailUrl ? (
                        <img src={s.thumbnailUrl} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-3.5 h-3.5 text-white/30" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-white block truncate max-w-[200px]">
                        {s.name}
                      </span>
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        <span>@{s.buyer}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs text-blue-400 block font-mono">
                      +{s.amount} R$
                    </span>
                    <span className="text-[10px] text-white/35 block font-mono">
                      {formatRelativeTime(s.created)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-white/30">Nenhuma compra recente registrada.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
