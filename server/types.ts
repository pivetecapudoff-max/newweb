export type CatalogCategory = "shirts" | "pants" | "tshirts" | "characters" | "collectibles";
export type DataSource = "live";
export type Verdict = "subir" | "vale" | "olho" | "passar";
export type Badge = "ganhando_forca" | "achado" | "referencia";

export interface CatalogItem {
  id: number;
  itemType: "Asset" | "Bundle" | string;
  assetType?: number | null;
  name: string;
  creatorId: number;
  creatorName: string;
  createdAt: string | null;
  favoriteCount: number;
  price: number | null;
  category: CatalogCategory;
  thumbnailUrl: string | null;
  collectibleItemId?: string | null;
  itemRestrictions?: string[];
  saleCount: number | null;
  demandField: DemandField;
}

export type DemandField = "vendas" | "favoritos";

export interface ItemPreview {
  id: number;
  name: string;
  itemType: string;
  thumbnailUrl: string | null;
  saleCount: number | null;
  favoriteCount: number;
  demandField: DemandField;
}

export interface ClusterKeyword {
  term: string;
  weight: number;
}

export interface ClusterMetrics {
  size: number;
  uniqueCreators: number;
  velocity: number;
  velocityPerHour: number;
  previousVelocity: number | null;
  acceleration: number;
  purity: number;
  salesTotal: number;
  salesAvg: number;
  favoritesTotal: number;
  demandTotal: number;
  demandAvg: number;
  demandVelocity: number;
  previousDemandTotal: number | null;
  demandAcceleration: number;
  demandField: DemandField;
  itemsWithSales: number;
  topSellerName: string | null;
  topSellerDemand: number;
}

export interface ScoredCluster {
  id: string;
  label: string;
  keywords: ClusterKeyword[];
  category: CatalogCategory;
  verdict: Verdict;
  badges: Badge[];
  metrics: ClusterMetrics;
  itemIds: number[];
  sampleTitles: string[];
  previews: ItemPreview[];
  matchedIp: string | null;
  flagged: boolean;
}

export interface CycleSnapshot {
  id: string;
  startedAt: string;
  finishedAt: string;
  source: DataSource;
  itemCount: number;
  hoursSincePrevious: number | null;
  note: string | null;
  clusters: ScoredCluster[];
  itemIds: number[];
  items: CatalogItem[];
}

export interface AppSettings {
  autoScan: boolean;
  intervalMinutes: number;
  categories: CatalogCategory[];
  pagesPerCategory: number;
  alertMinVelocity: number;
  alertMinAcceleration: number;
  alertMinPurity: number;
  discordWebhook: string;
}

export interface HealthState {
  scanning: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  lastItemCount: number;
  lastSource: DataSource | null;
  lastDurationMs: number | null;
  lastReason: "manual" | "auto" | null;
}

export interface PersistedState {
  settings: AppSettings;
  health: HealthState;
  cycles: CycleSnapshot[];
  overlay: {
    fetchedAt: string | null;
    source: string;
    titles: string[];
  };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  subir: "Upload now",
  vale: "Worth uploading",
  olho: "Watching",
  passar: "Skip",
};

export const BADGE_LABEL: Record<Badge, string> = {
  ganhando_forca: "Gaining steam",
  achado: "Find",
  referencia: "Hot reference",
};

export const CATEGORY_LABEL: Record<CatalogCategory, string> = {
  shirts: "Shirts",
  pants: "Pants",
  tshirts: "T-shirts",
  characters: "Characters",
  collectibles: "Collectibles",
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoScan: true,
  intervalMinutes: 12,
  categories: ["shirts", "pants", "tshirts", "characters", "collectibles"],
  pagesPerCategory: 2,
  alertMinVelocity: 4,
  alertMinAcceleration: 1.3,
  alertMinPurity: 0.28,
  discordWebhook: "",
};

export const DEFAULT_HEALTH: HealthState = {
  scanning: false,
  lastRunAt: null,
  lastSuccessAt: null,
  nextRunAt: null,
  lastError: null,
  lastItemCount: 0,
  lastSource: null,
  lastDurationMs: null,
  lastReason: null,
};
