import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_HEALTH,
  DEFAULT_SETTINGS,
  type AppSettings,
  type CycleSnapshot,
  type PersistedState,
} from "./types.js";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "data");
const statePath = path.join(dataDir, "state.json");
const MAX_CYCLES = 24;

function emptyState(): PersistedState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    health: { ...DEFAULT_HEALTH },
    cycles: [],
    overlay: { fetchedAt: null, source: "curated", titles: [] },
  };
}

function mergeState(raw: Partial<PersistedState>): PersistedState {
  const base = emptyState();
  const cycles = Array.isArray(raw.cycles)
    ? raw.cycles.filter((cycle) => cycle?.source === "live").slice(-MAX_CYCLES)
    : [];
  const health = { ...base.health, ...(raw.health || {}), scanning: false };
  const latest = cycles.length ? cycles[cycles.length - 1] : null;
  if (health.lastSource !== "live") {
    health.lastSource = latest ? "live" : null;
    health.lastSuccessAt = latest?.finishedAt || null;
    health.lastItemCount = latest?.itemCount || 0;
    health.lastError = null;
  }
  return {
    settings: { ...base.settings, ...(raw.settings || {}) },
    health,
    cycles,
    overlay: { ...base.overlay, ...(raw.overlay || {}) },
  };
}

export function loadState(): PersistedState {
  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8")) as PersistedState;
    return mergeState(raw);
  } catch {
    return emptyState();
  }
}

export function saveState(state: PersistedState): void {
  mkdirSync(dataDir, { recursive: true });
  const next = {
    ...state,
    cycles: state.cycles.slice(-MAX_CYCLES),
  };
  writeFileSync(statePath, JSON.stringify(next, null, 2), "utf8");
}

export function latestCycle(state: PersistedState): CycleSnapshot | null {
  return state.cycles.length ? state.cycles[state.cycles.length - 1] : null;
}

export function previousCycle(state: PersistedState): CycleSnapshot | null {
  return state.cycles.length > 1 ? state.cycles[state.cycles.length - 2] : null;
}

export function publicSettings(settings = loadState().settings) {
  return {
    autoScan: settings.autoScan,
    intervalMinutes: settings.intervalMinutes,
    categories: settings.categories,
    pagesPerCategory: settings.pagesPerCategory,
    alertMinVelocity: settings.alertMinVelocity,
    alertMinAcceleration: settings.alertMinAcceleration,
    alertMinPurity: settings.alertMinPurity,
    discordWebhook: "",
    discordWebhookSet: Boolean(settings.discordWebhook),
  };
}

export function patchSettings(
  state: PersistedState,
  patch: Partial<AppSettings>
): AppSettings {
  const previousHook = state.settings.discordWebhook;
  const nextHook = String(patch.discordWebhook || "").trim();
  const { discordWebhook: _ignored, ...rest } = patch;
  state.settings = { ...state.settings, ...rest };
  if (nextHook && /^https:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/webhooks\//i.test(nextHook)) {
    state.settings.discordWebhook = nextHook;
  } else {
    state.settings.discordWebhook = previousHook;
  }
  if (state.settings.intervalMinutes < 10) state.settings.intervalMinutes = 10;
  if (state.settings.pagesPerCategory < 1) state.settings.pagesPerCategory = 1;
  if (state.settings.pagesPerCategory > 4) state.settings.pagesPerCategory = 4;
  return state.settings;
}
