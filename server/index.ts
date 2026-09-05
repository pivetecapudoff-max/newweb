import "./env.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearAccount,
  loadAccount,
  publicAccount,
  cookieFromBody,
  saveAccount,
} from "./account.js";
import {
  processAiMessage,
  getLogs,
  clearLogs,
  optimizeGroupCatalog,
  generateExecutiveMarketReport,
  searchLiveRobloxGroups,
  searchLiveRobloxCatalog,
  generateAiItemDescription,
} from "./ai.js";
import { isHosted, listenTarget } from "./host.js";
import {
  authContext,
  authStatus,
  finishDiscordLogin,
  logoutSession,
  startDiscordLogin,
} from "./auth.js";
import { buildDashboard, bustDashboardCache, validateCookie } from "./dashboard.js";
import { buildAnalytics } from "./analytics.js";
import { ripUgcAsset } from "./copy.js";
import {
  createGamepassJob,
  deleteGamepassJob,
  fetchGamepassAccount,
  fetchGamePassInfo,
  loadGamepassJobs,
} from "./gamepass.js";
import { bustGroupCache } from "./groups.js";
import {
  enqueueUpload,
  getJob,
  listJobs,
  listUploadGroups,
  pumpQueue,
  removeJob,
  retryJob,
} from "./upload.js";
import {
  debounceKey,
  isDiscordWebhook,
  notifyDiscord,
  pingDiscordWebhook,
} from "./discord.js";
import { applySchedule, bootScheduler, runScan } from "./engine.js";
import { opportunity } from "./score.js";
import {
  expandQuery,
  looksViral,
  matchQuality,
  searchRank,
} from "./search.js";
import { lookupAsset, lookupGroupStore } from "./lookup.js";
import { latestCycle, loadState, patchSettings, publicSettings, saveState } from "./store.js";
import {
  BADGE_LABEL,
  CATEGORY_LABEL,
  VERDICT_LABEL,
  type Badge,
  type CatalogCategory,
  type CatalogItem,
  type ScoredCluster,
  type Verdict,
} from "./types.js";

function withPreviews(cluster: ScoredCluster, items: CatalogItem[]): ScoredCluster {
  if (cluster.previews?.length) return cluster;
  const members = items.filter((item) => cluster.itemIds.includes(item.id));
  return {
    ...cluster,
    previews: members.slice(0, 8).map((item) => ({
      id: item.id,
      name: item.name,
      itemType: item.itemType,
      thumbnailUrl: item.thumbnailUrl || null,
      saleCount: item.saleCount ?? null,
      favoriteCount: item.favoriteCount || 0,
      demandField: item.demandField || "favoritos",
    })),
  };
}

const app = express();
const { port, host: bindHost } = listenTarget();
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, next) {
      const allowed = new Set(
        [
          "http://127.0.0.1:5174",
          "http://localhost:5174",
          "http://127.0.0.1:8788",
          "http://127.0.0.1:4174",
          String(process.env.APP_PUBLIC_URL || "").replace(/\/$/, ""),
        ].filter(Boolean)
      );
      if (!origin || allowed.has(origin) || isHosted()) {
        next(null, true);
        return;
      }
      try {
        const incoming = new URL(origin);
        const configured = process.env.APP_PUBLIC_URL
          ? new URL(process.env.APP_PUBLIC_URL)
          : null;
        if (
          configured &&
          incoming.hostname.replace(/^www\./, "") ===
            configured.hostname.replace(/^www\./, "")
        ) {
          next(null, true);
          return;
        }
      } catch {
        // ignore bad origin
      }
      next(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "16mb" }));
app.use(authContext);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' https:",
      "connect-src 'self' http://127.0.0.1:8788 http://127.0.0.1:5174 ws://127.0.0.1:5174",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  const blocked = req.path.match(
    /^\/(data|server|src|node_modules|\.git|vite\.config|tsconfig)\b/i
  );
  const hiddenFile = /\.(map|ts|tsx|env|json)$/i.test(req.path) && !req.path.startsWith("/api");
  if (blocked || hiddenFile || req.path.includes("..")) {
    res.status(404).end();
    return;
  }
  next();
});

function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseBound(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function filterClusters(
  clusters: ScoredCluster[],
  query: express.Request["query"],
  items: CatalogItem[] = []
): ScoredCluster[] {
  const q = String(query.q || "").trim();
  const queryTokens = q ? expandQuery(q) : [];
  const verdict = String(query.verdict || "") as Verdict | "";
  const category = String(query.category || "") as CatalogCategory | "";
  const badge = String(query.badge || "") as Badge | "";
  const sort = String(query.sort || "oportunidade");
  const flaggedOnly = String(query.flagged || "") === "1";
  const isolados = String(query.minSize || "2") === "1";
  const minSize = isolados ? 1 : 2;
  const minSales = parseBound(query.minSales);
  const maxSales = parseBound(query.maxSales);
  const minFavorites = parseBound(query.minFavorites);
  const membersById = new Map(items.map((item) => [item.id, item]));

  let rows = clusters.slice();
  const qualities = new Map<string, number>();

  if (queryTokens.length) {
    rows = rows.filter((row) => {
      const members = row.itemIds
        .map((id) => membersById.get(id))
        .filter((item): item is CatalogItem => Boolean(item));
      const quality = matchQuality(queryTokens, row, members);
      if (quality <= 0) return false;
      qualities.set(row.id, quality);
      return true;
    });
  }

  if (minSales != null) {
    rows = rows.filter((row) => (row.metrics.salesTotal || 0) >= minSales);
  }
  if (maxSales != null) {
    rows = rows.filter((row) => (row.metrics.salesTotal || 0) <= maxSales);
  }
  if (minFavorites != null) {
    rows = rows.filter((row) => (row.metrics.favoritesTotal || 0) >= minFavorites);
  }
  if (verdict) rows = rows.filter((row) => row.verdict === verdict);
  if (category) rows = rows.filter((row) => row.category === category);
  if (badge) rows = rows.filter((row) => row.badges.includes(badge));
  if (flaggedOnly) rows = rows.filter((row) => row.flagged);

  rows = rows.filter((row) => {
    if (row.metrics.size >= minSize) return true;
    if (minSales != null && (row.metrics.salesTotal || 0) >= minSales) return true;
    if (queryTokens.length && qualities.has(row.id) && looksViral(row)) return true;
    return false;
  });

  if (queryTokens.length) {
    rows.sort((a, b) => {
      const qa = qualities.get(a.id) || 0;
      const qb = qualities.get(b.id) || 0;
      return searchRank(b, qb) - searchRank(a, qa);
    });
    return rows;
  }

  const sorters: Record<string, (a: ScoredCluster, b: ScoredCluster) => number> = {
    oportunidade: (a, b) => opportunity(b) - opportunity(a),
    tamanho: (a, b) => b.metrics.size - a.metrics.size,
    velocidade: (a, b) => b.metrics.velocity - a.metrics.velocity,
    aceleracao: (a, b) => b.metrics.acceleration - a.metrics.acceleration,
    pureza: (a, b) => b.metrics.purity - a.metrics.purity,
    criadores: (a, b) => b.metrics.uniqueCreators - a.metrics.uniqueCreators,
    vendas: (a, b) => (b.metrics.salesTotal || 0) - (a.metrics.salesTotal || 0),
  };
  rows.sort(sorters[sort] || sorters.oportunidade);
  return rows;
}

app.get("/api/status", (_req, res) => {
  const state = loadState();
  res.json({
    health: state.health,
    settings: publicSettings(state.settings),
    cycleCount: state.cycles.length,
    overlay: {
      source: state.overlay.source,
      titleCount: state.overlay.titles.length,
      fetchedAt: state.overlay.fetchedAt,
    },
    latest: latestCycle(state)
      ? {
          id: latestCycle(state)!.id,
          finishedAt: latestCycle(state)!.finishedAt,
          source: latestCycle(state)!.source,
          itemCount: latestCycle(state)!.itemCount,
          clusterCount: latestCycle(state)!.clusters.length,
          note: latestCycle(state)!.note,
        }
      : null,
  });
});

// --- AI Chatbot & Execution Logs Endpoints ---
app.post("/api/ai/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const effort = ["Rápida", "Detalhada", "Profunda"].includes(req.body?.effort)
      ? req.body.effort
      : "Detalhada";
    const attachments = (Array.isArray(req.body?.attachments) ? req.body.attachments : [])
      .filter(
        (item: any) =>
          item &&
          typeof item.name === "string" &&
          ["image/png", "image/jpeg", "image/webp"].includes(item.mimeType) &&
          typeof item.data === "string" &&
          item.data.length <= 2_800_000
      )
      .slice(0, 3);
    if (!message && attachments.length === 0) {
      res.status(400).json({ error: "Mensagem é obrigatória" });
      return;
    }
    const result = await processAiMessage(message || "Analise as imagens anexadas.", { effort, attachments });
    res.json({ reply: result.reply, actionTaken: result.actionTaken, logs: getLogs() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro no processamento da IA" });
  }
});

app.get("/api/ai/logs", (_req, res) => {
  res.json({ logs: getLogs() });
});

app.delete("/api/ai/logs", (_req, res) => {
  clearLogs();
  res.json({ success: true, logs: getLogs() });
});

app.post("/api/ai/optimize", async (req, res) => {
  try {
    const groupId = req.body?.groupId ? Number(req.body.groupId) : undefined;
    const result = await optimizeGroupCatalog(groupId);
    res.json({ success: true, result, logs: getLogs() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Falha na otimização" });
  }
});

app.post("/api/ai/report", async (req, res) => {
  try {
    const customPrompt = req.body?.prompt ? String(req.body.prompt) : undefined;
    const reportData = await generateExecutiveMarketReport(customPrompt);
    res.json(reportData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro ao gerar relatório de inteligência com IA." });
  }
});

app.post("/api/ai/describe", async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const assetType = req.body?.assetType;
    const styleHint = req.body?.styleHint;
    if (!title) {
      res.status(400).json({ error: "Título do item é obrigatório." });
      return;
    }
    const description = await generateAiItemDescription(title, assetType, styleHint);
    res.json({ description });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro ao gerar descrição inteligente com IA." });
  }
});

app.get("/api/groups/live-search", async (req, res) => {
  try {
    const q = String(req.query.q || req.query.keyword || "clothing aesthetic").trim();
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const groups = await searchLiveRobloxGroups(q, limit);
    res.json({ groups });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro ao buscar grupos ao vivo." });
  }
});

app.get("/api/feed", (req, res) => {
  const state = loadState();
  const cycle = latestCycle(state);
  const salesTotal = cycle
    ? cycle.items.reduce((sum, item) => sum + (item.saleCount || 0), 0)
    : 0;
  const favoritesTotal = cycle
    ? cycle.items.reduce((sum, item) => sum + (item.favoriteCount || 0), 0)
    : 0;
  res.json({
    health: state.health,
    settings: publicSettings(state.settings),
    overlaySource: state.overlay.source,
    demand: cycle
      ? {
          salesTotal,
          favoritesTotal,
          field: salesTotal > 0 ? "vendas" : "favoritos",
          label:
            salesTotal > 0
              ? "Sales (saleCount / marketplace sales)"
              : "Favorites — the public catalog sent no saleCount this cycle",
        }
      : null,
    cycle: cycle
      ? {
          id: cycle.id,
          finishedAt: cycle.finishedAt,
          source: cycle.source,
          itemCount: cycle.itemCount,
          hoursSincePrevious: cycle.hoursSincePrevious,
          note: cycle.note,
          clusters: filterClusters(cycle.clusters, req.query, cycle.items).map((row) =>
            withPreviews(row, cycle.items)
          ),
        }
      : null,
  });
  const q = String(req.query.q || "").trim();
  const interesting = Boolean(
    q ||
      req.query.minSales ||
      req.query.verdict ||
      req.query.badge ||
      req.query.category ||
      req.query.minFavorites
  );
  if (interesting && debounceKey(`feed:${q}:${req.query.minSales}:${req.query.verdict}`, 8000)) {
    const count = cycle
      ? filterClusters(cycle.clusters, req.query, cycle.items).length
      : 0;
    void notifyDiscord({
      title: "Feed search",
      body: q ? `Query: ${q}` : "Filters applied",
      fields: [
        { name: "Min sales", value: String(req.query.minSales || "any"), inline: true },
        { name: "Verdict", value: String(req.query.verdict || "all"), inline: true },
        { name: "Results", value: String(count), inline: true },
      ],
    });
  }
});

app.get("/api/clusters/:id", (req, res) => {
  const state = loadState();
  const cycle = latestCycle(state);
  if (!cycle) {
    res.status(404).json({ error: "No scan yet." });
    return;
  }
  const cluster = cycle.clusters.find((row) => row.id === req.params.id);
  if (!cluster) {
    res.status(404).json({ error: "Theme not found in this scan." });
    return;
  }

  const items = cycle.items.filter((item) => cluster.itemIds.includes(item.id));
  const history = state.cycles
    .map((snap) => {
      const match = snap.clusters.find((row) => row.id === cluster.id);
      if (!match) return null;
      return {
        cycleId: snap.id,
        finishedAt: snap.finishedAt,
        source: snap.source,
        metrics: match.metrics,
        verdict: match.verdict,
      };
    })
    .filter(Boolean);

  res.json({
    cluster: withPreviews(cluster, items),
    items,
    history,
    overlaySource: state.overlay.source,
  });
  void notifyDiscord({
    title: "Theme opened",
    body: cluster.label,
    fields: [
      { name: "Verdict", value: cluster.verdict, inline: true },
      { name: "Items", value: String(items.length), inline: true },
      { name: "Demand", value: String(cluster.metrics.demandTotal ?? 0), inline: true },
    ],
  });
});

app.post("/api/scan", async (_req, res) => {
  try {
    const cycle = await runScan("manual");
    const state = loadState();
    applySchedule();
    res.json({
      ok: true,
      cycleId: cycle.id,
      source: cycle.source,
      itemCount: cycle.itemCount,
      clusterCount: cycle.clusters.length,
      note: cycle.note,
      health: state.health,
    });
  } catch (error) {
    const state = loadState();
    state.health.scanning = false;
    state.health.lastError = error instanceof Error ? error.message : String(error);
    saveState(state);
    void notifyDiscord({
      title: "Scan failed",
      body: state.health.lastError || "unknown",
      color: 0xb45555,
    });
    res.status(500).json({ error: state.health.lastError });
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json(authStatus(req));
});
app.get("/api/auth/discord", startDiscordLogin);
app.get("/api/auth/discord/callback", (req, res) => {
  void finishDiscordLogin(req, res);
});
app.post("/api/auth/logout", logoutSession);

app.get("/api/account", (_req, res) => {
  res.json(publicAccount());
});

app.post("/api/account", async (req, res) => {
  const identity = publicAccount();
  if (identity.discordEnabled && !identity.discord) {
    res.status(401).json({ error: "Sign in with Discord first." });
    return;
  }
  const cookie = cookieFromBody(req.body);
  if (!cookie || cookie.length < 20) {
    res.status(400).json({ error: "Paste your own .ROBLOSECURITY cookie value." });
    return;
  }
  try {
    const user = await validateCookie(cookie);
    const previous = publicAccount();
    await saveAccount({
      cookie,
      userId: user.id,
      username: user.name,
      displayName: user.displayName || user.name,
      connectedAt: new Date().toISOString(),
      ops: previous.ops,
    });
    bustDashboardCache();
    bustGroupCache();
    void notifyDiscord({
      title: "Account connected",
      body: `${user.displayName || user.name} (@${user.name})`,
      fields: [{ name: "User id", value: String(user.id), inline: true }],
    });
    res.json(publicAccount());
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Roblox rejected that session.",
    });
    void notifyDiscord({
      title: "Account connect failed",
      body: "Roblox rejected the session (cookie not stored in this log).",
      color: 0xb45555,
    });
  }
});

app.delete("/api/account", async (_req, res) => {
  const previous = publicAccount();
  await clearAccount();
  bustDashboardCache();
  bustGroupCache();
  if (previous.connected) {
    void notifyDiscord({
      title: "Account disconnected",
      body: previous.displayName || previous.username || "session cleared",
    });
  }
  res.json(publicAccount());
});

app.get("/api/uploads", async (_req, res) => {
  try {
    const groups = await listUploadGroups();
    res.json({
      connected: Boolean(loadAccount()),
      jobs: listJobs().map((job) => ({
        ...job,
        filePath: undefined,
      })),
      groups,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Could not load the upload queue.",
    });
  }
});

app.post("/api/uploads", async (req, res) => {
  try {
    const groupId = req.body?.groupId ? Number(req.body.groupId) : null;
    if (groupId) {
      const allowed = await listUploadGroups();
      if (!allowed.some((group) => group.id === groupId && group.canPost)) {
        res.status(400).json({
          error: "That group is not one you can post clothing to.",
        });
        return;
      }
    }
    const job = enqueueUpload({
      name: req.body?.name,
      description: req.body?.description,
      kind: req.body?.kind,
      price: req.body?.price,
      groupId,
      fileName: req.body?.fileName,
      image: req.body?.image,
    });
    res.status(202).json({
      ...job,
      filePath: undefined,
    });
    void notifyDiscord({
      title: "Upload queued",
      body: job.name,
      fields: [
        { name: "Type", value: job.kind, inline: true },
        { name: "Price", value: `R$ ${job.price}`, inline: true },
        { name: "Group", value: job.groupId ? String(job.groupId) : "My account", inline: true },
      ],
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not queue that file.",
    });
    void notifyDiscord({
      title: "Upload rejected",
      body: error instanceof Error ? error.message : "Could not queue that file.",
      color: 0xb45555,
    });
  }
});

app.get("/api/uploads/:id/file", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).type("text/plain").send("Upload not found.");
    return;
  }
  const safe = path.basename(job.fileName || "template.png").replace(/[^\w.\-]+/g, "_");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
  res.type(job.mime || "application/octet-stream");
  res.sendFile(job.filePath, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
  void notifyDiscord({
    title: "Upload file downloaded",
    body: job.name,
    fields: [{ name: "File", value: job.fileName }],
  });
});

app.get("/api/group-store", async (req, res) => {
  try {
    const store = await lookupGroupStore(String(req.query.q || req.query.id || ""));
    if (!store) {
      res.status(404).json({ error: "No public Roblox group for that link." });
      return;
    }
    res.json(store);
  } catch {
    res.status(502).json({ error: "Roblox did not return that group store." });
  }
});

app.get("/api/lookup", async (req, res) => {
  try {
    const item = await lookupAsset(String(req.query.q || req.query.id || ""));
    if (!item) {
      res.status(404).json({ error: "No public Roblox asset for that id or link." });
      return;
    }
    res.json(item);
  } catch {
    res.status(502).json({ error: "Roblox did not return that asset." });
  }
});

app.get("/api/items/:id/preview", async (req, res) => {
  const id = Number(req.params.id);
  const cycle = latestCycle(loadState());
  const item = cycle?.items.find((row) => row.id === id);
  if (!item?.thumbnailUrl) {
    res.status(404).type("text/plain").send("No public preview for that item.");
    return;
  }
  try {
    const image = await fetch(item.thumbnailUrl, {
      headers: { Accept: "image/*,*/*" },
    });
    if (!image.ok) {
      res.status(404).type("text/plain").send("Preview is gone.");
      return;
    }
    const type = image.headers.get("content-type") || "image/png";
    const ext = type.includes("jpeg") ? "jpg" : "png";
    const bytes = Buffer.from(await image.arrayBuffer());
    const safe = item.name.replace(/[^\w.\-]+/g, "_").slice(0, 60) || `item-${id}`;
    res.setHeader("Content-Disposition", `attachment; filename="${safe}-preview.${ext}"`);
    res.type(type);
    res.send(bytes);
    void notifyDiscord({
      title: "Preview downloaded",
      body: item.name,
      fields: [{ name: "Asset", value: String(item.id), inline: true }],
    });
  } catch {
    res.status(502).type("text/plain").send("Could not fetch that preview.");
  }
});

app.post("/api/uploads/:id/retry", (req, res) => {
  try {
    const job = retryJob(req.params.id);
    void notifyDiscord({ title: "Upload retry", body: job.name });
    res.json({ ...job, filePath: undefined });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Upload not found.",
    });
  }
});

app.delete("/api/uploads/:id", (req, res) => {
  const job = getJob(req.params.id);
  removeJob(req.params.id);
  void notifyDiscord({ title: "Upload removed", body: job?.name || req.params.id });
  res.json({ ok: true });
});

app.post("/api/uploads/pump", (_req, res) => {
  void pumpQueue();
  res.json({ ok: true });
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const data = await buildDashboard(String(req.query.groupId || ""));
    res.json(data);
    if (debounceKey("dashboard", 45000)) {
      void notifyDiscord({
        title: "Dashboard loaded",
        body: data.user ? `${data.user.displayName} (@${data.user.name})` : "No cookie session",
        fields: [
          { name: "Today", value: `R$ ${data.kpis.todayRevenue} · ${data.kpis.todaySales} sales`, inline: true },
          { name: "Total", value: `R$ ${data.kpis.totalRevenue} · ${data.kpis.totalSales} sales`, inline: true },
          { name: "Groups", value: String(data.groups.length), inline: true },
          { name: "Queue", value: `${data.queue.status} · ${data.queue.pending} pending`, inline: true },
        ],
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Dashboard failed.",
    });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const data = await buildAnalytics(String(req.query.groupId || ""));
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Analytics failed.",
    });
  }
});

app.get("/api/settings", (_req, res) => {
  res.json(publicSettings());
});

app.put("/api/settings", async (req, res) => {
  const state = loadState();
  const previousHook = state.settings.discordWebhook;
  const settings = patchSettings(state, req.body || {});
  if (settings.discordWebhook && !isDiscordWebhook(settings.discordWebhook)) {
    res.status(400).json({ error: "That is not a Discord webhook URL." });
    return;
  }
  saveState(state);
  applySchedule();
  if (settings.discordWebhook && settings.discordWebhook !== previousHook) {
    try {
      await pingDiscordWebhook(settings.discordWebhook);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Discord rejected that webhook.",
      });
      return;
    }
  }
  void notifyDiscord({
    title: "Settings saved",
    body: `Scan ${settings.autoScan ? "on" : "off"} · every ${settings.intervalMinutes} min`,
    fields: [
      { name: "Categories", value: settings.categories.join(", ") },
      { name: "Discord log", value: settings.discordWebhook ? "on" : "off", inline: true },
    ],
  });
  res.json(publicSettings(settings));
});

app.get("/api/export.csv", (req, res) => {
  const state = loadState();
  const cycle = latestCycle(state);
  if (!cycle) {
    res.status(404).type("text/plain").send("No scan to export.");
    return;
  }
  const rows = filterClusters(cycle.clusters, req.query, cycle.items);
  const header = [
    "theme",
    "verdict",
    "category",
    "size",
    "creators",
    "velocity",
    "vel_per_hour",
    "acceleration",
    "purity",
    "sales",
    "favorites",
    "demand",
    "signal",
    "alert",
    "badges",
    "keywords",
    "reference",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        csvEscape(row.label),
        csvEscape(VERDICT_LABEL[row.verdict]),
        csvEscape(CATEGORY_LABEL[row.category]),
        row.metrics.size,
        row.metrics.uniqueCreators,
        row.metrics.velocity,
        row.metrics.velocityPerHour,
        row.metrics.acceleration,
        row.metrics.purity,
        row.metrics.salesTotal ?? 0,
        row.metrics.favoritesTotal ?? 0,
        row.metrics.demandTotal ?? 0,
        csvEscape(row.metrics.demandField || "favoritos"),
        row.flagged ? "sim" : "nao",
        csvEscape(row.badges.map((badge) => BADGE_LABEL[badge]).join(" | ")),
        csvEscape(row.keywords.map((k) => k.term).join(" | ")),
        csvEscape(row.matchedIp),
      ].join(",")
    ),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="illusions-${cycle.id}.csv"`);
  res.send(`\uFEFF${lines.join("\n")}`);
  void notifyDiscord({
    title: "CSV exported",
    body: `${rows.length} themes from ${cycle.id}`,
  });
});

const downloadsDir = path.join(rootDir, "public", "downloads");
app.use("/downloads", express.static(downloadsDir));

app.post("/api/copy/download", async (req, res) => {
  try {
    const input = req.body?.urlOrId || req.body?.url || req.body?.assetId;
    const cookie = req.body?.cookie;
    if (!input) {
      res.status(400).json({ error: "URL ou Asset ID é obrigatório." });
      return;
    }
    const result = await ripUgcAsset({ urlOrId: String(input), cookie });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao ripar item UGC.",
    });
  }
});

// Gamepass Auto Endpoints
app.get("/api/gamepass/account", async (_req, res) => {
  try {
    const data = await fetchGamepassAccount();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao carregar conta do Gamepass.",
    });
  }
});

app.post("/api/gamepass/preview", async (req, res) => {
  try {
    const links: string[] = Array.isArray(req.body?.links)
      ? req.body.links
      : String(req.body?.links || "")
          .split(/[\r\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);

    if (links.length === 0) {
      res.status(400).json({ error: "Nenhum link ou ID de gamepass fornecido." });
      return;
    }

    const items = await Promise.all(
      links.map(async (l) => {
        try {
          return await fetchGamePassInfo(l);
        } catch (e) {
          return {
            id: l,
            name: `Gamepass ${l}`,
            description: "",
            price: 0,
            productId: 0,
            sellerId: 0,
            isForSale: false,
            hasRegionalPrice: false,
            thumbnailUrl: null,
            url: l.startsWith("http") ? l : `https://www.roblox.com/game-pass/${l}`,
            error: e instanceof Error ? e.message : "Não encontrado",
          };
        }
      })
    );

    res.json({ items });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao consultar gamepasses.",
    });
  }
});

app.get("/api/gamepass/jobs", (_req, res) => {
  try {
    const jobs = loadGamepassJobs();
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao listar tarefas.",
    });
  }
});

app.post("/api/gamepass/start", async (req, res) => {
  try {
    const { links, payRegional, delayBetweenSeconds } = req.body || {};
    const parsedLinks = Array.isArray(links)
      ? links
      : String(links || "")
          .split(/[\r\n]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);

    if (!parsedLinks.length) {
      res.status(400).json({ error: "Forneça ao menos um link ou ID de gamepass." });
      return;
    }

    const job = await createGamepassJob({
      links: parsedLinks,
      payRegional: Boolean(payRegional),
      delayBetweenSeconds: Number(delayBetweenSeconds) || 0,
    });

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao iniciar automação.",
    });
  }
});

app.delete("/api/gamepass/jobs/:id", async (req, res) => {
  try {
    await deleteGamepassJob(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao deletar tarefa.",
    });
  }
});

const distDir = path.join(rootDir, "dist");
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

bootScheduler();
void pumpQueue();

app.listen(port, bindHost, () => {
  console.log(`Farol API em http://${bindHost}:${port}`);
  void notifyDiscord({
    title: "Illusions online",
    body: `API listening on ${port}`,
  });
});
