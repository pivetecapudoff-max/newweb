import { clusterItems } from "./cluster.js";
import { refreshOverlay } from "./overlay.js";
import { fetchRecentCatalog } from "./roblox.js";
import { scoreClusters } from "./score.js";
import { latestCycle, loadState, saveState } from "./store.js";
import { attachSales } from "./sales.js";
import { attachThumbnails } from "./thumbnails.js";
import type { CatalogItem, CycleSnapshot, PersistedState } from "./types.js";
import { notifyDiscord } from "./discord.js";

const DEFAULT_INTERVAL = 12;

let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<CycleSnapshot> | null = null;

function hoursBetween(from: string | null, to: string): number | null {
  if (!from) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Number((ms / 3600_000).toFixed(2));
}

function intervalMs(state: PersistedState): number {
  return Math.max(state.settings.intervalMinutes, 10) * 60_000;
}

function schedule(state: PersistedState): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!state.settings.autoScan) {
    state.health.nextRunAt = null;
    saveState(state);
    return;
  }

  const ms = intervalMs(state);
  state.health.nextRunAt = new Date(Date.now() + ms).toISOString();
  saveState(state);
  timer = setTimeout(() => {
    runScan("auto").catch(() => undefined).finally(() => schedule(loadState()));
  }, ms);
}

export function enableContinuousScan(state: PersistedState): void {
  state.settings.autoScan = true;
  if (!state.settings.intervalMinutes || state.settings.intervalMinutes === 30) {
    state.settings.intervalMinutes = DEFAULT_INTERVAL;
  }
  if (state.settings.intervalMinutes < 10) state.settings.intervalMinutes = 10;
  if (!state.settings.categories.includes("collectibles")) {
    state.settings.categories = [...state.settings.categories, "collectibles"];
  }
}

export function bootScheduler(): void {
  const state = loadState();
  state.health.scanning = false;
  enableContinuousScan(state);
  saveState(state);
  console.log(
    `Farol: varredura contínua ligada (a cada ${state.settings.intervalMinutes} min)`
  );
  runScan("auto").catch(() => undefined).finally(() => schedule(loadState()));
}

export function applySchedule(): void {
  const state = loadState();
  if (state.settings.autoScan && !running && !state.health.scanning) {
    schedule(state);
    return;
  }
  schedule(state);
}

export async function runScan(reason: "manual" | "auto" = "manual"): Promise<CycleSnapshot> {
  if (running) return running;

  running = (async () => {
    const state = loadState();
    const startedAt = new Date().toISOString();
    state.health.scanning = true;
    state.health.lastRunAt = startedAt;
    state.health.lastReason = reason;
    state.health.lastError = null;
    saveState(state);
    void notifyDiscord({
      title: reason === "auto" ? "Scan started" : "Manual scan started",
      body: `Categories: ${state.settings.categories.join(", ")}`,
    });

    const previous = latestCycle(state);
    const source: CycleSnapshot["source"] = "live";
    const note: string | null =
      reason === "auto" ? "Automatic cycle from the live scan." : null;
    let items: CatalogItem[];

    try {
      items = await fetchRecentCatalog(
        state.settings.categories,
        state.settings.pagesPerCategory
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.health.scanning = false;
      state.health.lastError = message;
      state.health.lastDurationMs = Date.now() - new Date(startedAt).getTime();
      state.health.lastReason = reason;
      saveState(state);
      void notifyDiscord({
        title: reason === "auto" ? "Automatic scan failed" : "Manual scan failed",
        body: message,
        color: 0xb45555,
      });
      throw error instanceof Error ? error : new Error(message);
    }

    try {
      await attachThumbnails(items);
    } catch {
      // previews are optional; names still land
    }

    try {
      await attachSales(items);
    } catch {
      // demand still falls back to favoriteCount from the catalog search
    }

    try {
      await refreshOverlay(state);
    } catch {
      // overlay is optional
    }

    const finishedAt = new Date().toISOString();
    const hoursSincePrevious = hoursBetween(previous?.finishedAt || null, finishedAt);
    const clustered = clusterItems(items);
    const scored = scoreClusters(
      clustered,
      previous,
      hoursSincePrevious,
      state.overlay.titles,
      state.settings
    );

    const cycle: CycleSnapshot = {
      id: `ciclo-${finishedAt.slice(0, 19).replace(/[:T]/g, "")}`,
      startedAt,
      finishedAt,
      source,
      itemCount: items.length,
      hoursSincePrevious,
      note,
      clusters: scored,
      itemIds: items.map((item) => item.id),
      items,
    };

    state.cycles.push(cycle);
    state.health.scanning = false;
    state.health.lastSuccessAt = finishedAt;
    state.health.lastItemCount = items.length;
    state.health.lastSource = source;
    state.health.lastDurationMs = Date.now() - new Date(startedAt).getTime();
    state.health.lastError = null;
    state.health.lastReason = reason;
    saveState(state);
    const counts = scored.reduce(
      (bag, row) => {
        bag[row.verdict] = (bag[row.verdict] || 0) + 1;
        return bag;
      },
      {} as Record<string, number>
    );
    const ranked = scored
      .slice()
      .sort((a, b) => (b.metrics.demandTotal || 0) - (a.metrics.demandTotal || 0));
    const top = ranked
      .slice(0, 15)
      .map(
        (row) =>
          `${row.label} · ${row.verdict} · demand ${row.metrics.demandTotal ?? 0} · accel ${row.metrics.acceleration.toFixed(2)}`
      )
      .join("\n");
    void notifyDiscord({
      title: reason === "auto" ? "Scan finished" : "Manual scan finished",
      body: `${items.length} items · ${scored.length} themes · ${source}`,
      fields: [
        {
          name: "Verdicts",
          value: `upload now ${counts.subir || 0} · worth ${counts.vale || 0} · watch ${counts.olho || 0} · skip ${counts.passar || 0}`,
        },
        { name: "Themes", value: top || "None" },
        { name: "Duration", value: `${Math.round((state.health.lastDurationMs || 0) / 1000)}s`, inline: true },
      ],
    });
    return cycle;
  })();

  try {
    return await running;
  } finally {
    running = null;
  }
}
