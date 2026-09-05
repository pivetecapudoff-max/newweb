import { tokenize } from "./nlp.js";
import { keywordOverlap, type RawCluster } from "./cluster.js";
import { matchIp } from "./overlay.js";
import { demandOf } from "./sales.js";
import type {
  AppSettings,
  Badge,
  CatalogItem,
  CycleSnapshot,
  DemandField,
  ScoredCluster,
  Verdict,
} from "./types.js";

const RECENT_HOURS = 24;

function uniqueCreators(items: CatalogItem[]): number {
  return new Set(items.map((item) => item.creatorId || item.creatorName)).size;
}

function hoursAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const stamp = new Date(iso).getTime();
  if (!Number.isFinite(stamp)) return null;
  return (now - stamp) / 3_600_000;
}

function countCreatedBetween(
  items: CatalogItem[],
  now: number,
  startHours: number,
  endHours: number
): number {
  return items.filter((item) => {
    const age = hoursAgo(item.createdAt, now);
    if (age == null) return startHours === 0;
    return age >= startHours && age < endHours;
  }).length;
}

function purityOf(cluster: RawCluster): number {
  const top = cluster.keywords[0]?.term;
  if (!top || !cluster.items.length) return 0;
  const topParts = top.split(" ");
  let covered = 0;
  let density = 0;

  for (const item of cluster.items) {
    const tokens = new Set(tokenize(item.name));
    const hasTop = topParts.every((part) => tokens.has(part) || tokens.has(top));
    if (hasTop) covered += 1;
    const hits = cluster.keywords.filter((row) => {
      const parts = row.term.split(" ");
      return parts.every((part) => tokens.has(part)) || tokens.has(row.term);
    }).length;
    density += hits / Math.max(cluster.keywords.length, 1);
  }

  const coverage = covered / cluster.items.length;
  const keywordDensity = density / cluster.items.length;
  return Number(Math.min(1, coverage * 0.7 + keywordDensity * 0.3).toFixed(3));
}

function matchPrevious(
  cluster: RawCluster,
  previous: CycleSnapshot | null
): ScoredCluster | null {
  if (!previous) return null;
  const exact = previous.clusters.find((row) => row.id === cluster.id);
  if (exact) return exact;

  const terms = cluster.keywords.map((row) => row.term);
  let best: ScoredCluster | null = null;
  let bestScore = 0;
  for (const row of previous.clusters) {
    const score = keywordOverlap(
      terms,
      row.keywords.map((item) => item.term)
    );
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 0.34 ? best : null;
}

function verdictFor(input: {
  size: number;
  unique: number;
  velocity: number;
  acceleration: number;
  purity: number;
  hasHistory: boolean;
  demandTotal: number;
  demandField: DemandField;
  salesTotal: number;
}): Verdict {
  const weakDemand = input.demandTotal <= 0;
  if (weakDemand && input.size >= 6) return "olho";
  if (weakDemand && input.size >= 3) return "passar";

  const strong =
    input.demandField === "vendas" ? input.demandTotal >= 15 : input.demandTotal >= 18;
  const mid =
    input.demandField === "vendas" ? input.demandTotal >= 5 : input.demandTotal >= 8;

  if (
    input.size >= 5 &&
    input.unique >= 3 &&
    input.purity >= 0.28 &&
    strong &&
    (input.velocity >= 3 || (input.hasHistory && input.acceleration >= 1.3))
  ) {
    return "subir";
  }
  if (input.size >= 3 && input.unique >= 2 && input.purity >= 0.2 && mid) {
    return "vale";
  }
  if (
    input.size >= 4 &&
    input.unique >= 2 &&
    input.purity >= 0.22 &&
    input.velocity >= 3 &&
    input.demandTotal >= 3
  ) {
    return "vale";
  }
  if (input.size >= 2 && (input.velocity >= 1 || input.unique >= 2)) {
    return "olho";
  }
  return "passar";
}

function badgesFor(input: {
  velocity: number;
  acceleration: number;
  unique: number;
  purity: number;
  size: number;
  hasHistory: boolean;
  matchedIp: string | null;
  demandTotal: number;
}): Badge[] {
  const badges: Badge[] = [];
  if (input.hasHistory && input.acceleration >= 1.25 && input.velocity >= 2 && input.demandTotal > 0) {
    badges.push("ganhando_forca");
  }
  if (
    input.velocity >= 4 &&
    input.unique <= 5 &&
    input.purity >= 0.34 &&
    input.size <= 14 &&
    input.demandTotal >= 4
  ) {
    badges.push("achado");
  }
  if (input.matchedIp) badges.push("referencia");
  return badges;
}

export function scoreClusters(
  clusters: RawCluster[],
  previous: CycleSnapshot | null,
  hoursSincePrevious: number | null,
  overlayTitles: string[],
  settings: AppSettings
): ScoredCluster[] {
  const hasHistory = Boolean(
    previous && (hoursSincePrevious == null || hoursSincePrevious >= 0.25)
  );
  const now = Date.now();

  return clusters.map((cluster) => {
    const items = cluster.items;
    const unique = uniqueCreators(items);
    const velocity = countCreatedBetween(items, now, 0, RECENT_HOURS);
    const windowFromTime = countCreatedBetween(items, now, RECENT_HOURS, RECENT_HOURS * 2);
    const hours = hoursSincePrevious && hoursSincePrevious > 0.25 ? hoursSincePrevious : RECENT_HOURS;
    const velocityPerHour = Number((velocity / hours).toFixed(2));
    const prior = matchPrevious(cluster, previous);
    const priorVel = prior?.metrics.velocity;
    const usablePrior =
      typeof priorVel === "number" &&
      priorVel > 0 &&
      (hoursSincePrevious == null || hoursSincePrevious >= 0.25);
    const previousVelocity = usablePrior
      ? priorVel
      : windowFromTime > 0
        ? windowFromTime
        : null;
    const acceleration = Number(
      (velocity / Math.max(previousVelocity ?? velocity, 0.5)).toFixed(2)
    );
    const purity = purityOf(cluster);
    const salesTotal = items.reduce((sum, item) => sum + (item.saleCount || 0), 0);
    const favoritesTotal = items.reduce((sum, item) => sum + (item.favoriteCount || 0), 0);
    const itemsWithSales = items.filter((item) => (item.saleCount || 0) > 0).length;
    const demandField: DemandField = itemsWithSales > 0 ? "vendas" : "favoritos";
    const demandTotal = demandField === "vendas" ? salesTotal : favoritesTotal;
    const demandAvg = Number((demandTotal / Math.max(items.length, 1)).toFixed(2));
    const salesAvg = Number((salesTotal / Math.max(items.length, 1)).toFixed(2));
    const ranked = [...items].sort((a, b) => demandOf(b) - demandOf(a));
    const top = ranked[0];
    const previousDemand =
      prior && typeof prior.metrics.demandTotal === "number" ? prior.metrics.demandTotal : null;
    const usableDemandPrior =
      previousDemand != null &&
      previousDemand > 0 &&
      (hoursSincePrevious == null || hoursSincePrevious >= 0.25);
    const demandVelocity = usableDemandPrior
      ? Math.max(0, demandTotal - previousDemand)
      : demandTotal;
    const demandAcceleration = Number(
      (demandTotal / Math.max(usableDemandPrior ? previousDemand : demandTotal, 0.5)).toFixed(2)
    );
    const blob = `${cluster.label} ${items.map((item) => item.name).join(" ")}`;
    const matchedIp = matchIp(blob, overlayTitles);
    const skipNoise = /donation|thank you|thanks|giveaway/.test(blob);
    const verdict = skipNoise
      ? "passar"
      : verdictFor({
          size: items.length,
          unique,
          velocity,
          acceleration,
          purity,
          hasHistory,
          demandTotal,
          demandField,
          salesTotal,
        });
    const badges = badgesFor({
      velocity,
      acceleration,
      unique,
      purity,
      size: items.length,
      hasHistory,
      matchedIp,
      demandTotal,
    });
    const flagged =
      velocity >= settings.alertMinVelocity &&
      demandTotal >= 3 &&
      (hasHistory ? acceleration >= settings.alertMinAcceleration : true) &&
      purity >= settings.alertMinPurity;

    return {
      id: cluster.id,
      label: cluster.label,
      keywords: cluster.keywords,
      category: cluster.category,
      verdict,
      badges,
      metrics: {
        size: items.length,
        uniqueCreators: unique,
        velocity,
        velocityPerHour,
        previousVelocity,
        acceleration: hasHistory ? acceleration : 1,
        purity,
        salesTotal,
        salesAvg,
        favoritesTotal,
        demandTotal,
        demandAvg,
        demandVelocity,
        previousDemandTotal: usableDemandPrior ? previousDemand : null,
        demandAcceleration: hasHistory ? demandAcceleration : 1,
        demandField,
        itemsWithSales,
        topSellerName: top ? top.name : null,
        topSellerDemand: top ? demandOf(top) : 0,
      },
      itemIds: items.map((item) => item.id),
      sampleTitles: items.slice(0, 8).map((item) => item.name),
      previews: ranked.slice(0, 8).map((item) => ({
        id: item.id,
        name: item.name,
        itemType: item.itemType,
        thumbnailUrl: item.thumbnailUrl,
        saleCount: item.saleCount,
        favoriteCount: item.favoriteCount,
        demandField: item.demandField,
      })),
      matchedIp,
      flagged,
    };
  });
}

export function opportunity(cluster: ScoredCluster): number {
  const v = cluster.metrics;
  const verdictBoost =
    cluster.verdict === "subir" ? 8 : cluster.verdict === "vale" ? 5 : cluster.verdict === "olho" ? 2 : 0;
  return (
    v.size * 0.35 +
    v.uniqueCreators * 0.4 +
    v.velocity * 0.9 +
    v.acceleration * 2.2 +
    v.purity * 6 +
    Math.log10((v.demandTotal || 0) + 1) * 4.5 +
    (v.demandField === "vendas" ? 2 : 0) +
    verdictBoost +
    (cluster.flagged ? 3 : 0)
  );
}
