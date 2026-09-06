import type { Badge, Category, Verdict } from "./labels";

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
  demandField: "vendas" | "favoritos";
  itemsWithSales: number;
  topSellerName: string | null;
  topSellerDemand: number;
}

export interface Cluster {
  id: string;
  label: string;
  keywords: ClusterKeyword[];
  category: Category;
  verdict: Verdict;
  badges: Badge[];
  metrics: ClusterMetrics;
  itemIds: number[];
  sampleTitles: string[];
  previews: {
    id: number;
    name: string;
    itemType: string;
    thumbnailUrl: string | null;
    saleCount: number | null;
    favoriteCount: number;
    demandField: "vendas" | "favoritos";
  }[];
  matchedIp: string | null;
  flagged: boolean;
}

export interface Health {
  scanning: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  lastItemCount: number;
  lastSource: "live" | null;
  lastDurationMs: number | null;
  lastReason: "manual" | "auto" | null;
}

export interface Settings {
  autoScan: boolean;
  intervalMinutes: number;
  categories: Category[];
  pagesPerCategory: number;
  alertMinVelocity: number;
  alertMinAcceleration: number;
  alertMinPurity: number;
  discordWebhook: string;
  discordWebhookSet?: boolean;
}

export interface FeedResponse {
  health: Health;
  settings: Settings;
  overlaySource: string;
  demand: {
    salesTotal: number;
    favoritesTotal: number;
    field: "vendas" | "favoritos";
    label: string;
  } | null;
  cycle: {
    id: string;
    finishedAt: string;
    source: "live";
    itemCount: number;
    hoursSincePrevious: number | null;
    note: string | null;
    clusters: Cluster[];
  } | null;
}

export interface CatalogItem {
  id: number;
  itemType: string;
  name: string;
  creatorName: string;
  createdAt: string | null;
  favoriteCount: number;
  price: number | null;
  category: Category;
  thumbnailUrl?: string | null;
  saleCount?: number | null;
  demandField?: "vendas" | "favoritos";
}

export interface ClusterDetail {
  cluster: Cluster;
  items: CatalogItem[];
  history: {
    cycleId: string;
    finishedAt: string;
    source: "live";
    metrics: ClusterMetrics;
    verdict: Verdict;
  }[];
  overlaySource: string;
}

export interface FeedQuery {
  q?: string;
  verdict?: string;
  category?: string;
  badge?: string;
  sort?: string;
  flagged?: boolean;
  isolados?: boolean;
  minSales?: number | "";
  maxSales?: number | "";
  minFavorites?: number | "";
}

function qs(query: FeedQuery = {}): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.verdict) params.set("verdict", query.verdict);
  if (query.category) params.set("category", query.category);
  if (query.badge) params.set("badge", query.badge);
  if (query.sort) params.set("sort", query.sort);
  if (query.flagged) params.set("flagged", "1");
  if (query.minSales !== "" && query.minSales != null) {
    params.set("minSales", String(query.minSales));
  }
  if (query.maxSales !== "" && query.maxSales != null) {
    params.set("maxSales", String(query.maxSales));
  }
  if (query.minFavorites !== "" && query.minFavorites != null) {
    params.set("minFavorites", String(query.minFavorites));
  }
  params.set("minSize", query.isolados ? "1" : "2");
  const text = params.toString();
  return text ? `?${text}` : "";
}

function api(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { credentials: "same-origin", ...init });
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function fetchFeed(query: FeedQuery = {}): Promise<FeedResponse> {
  return api(`/api/feed${qs(query)}`).then((res) => readJson<FeedResponse>(res));
}

export function fetchCluster(id: string): Promise<ClusterDetail> {
  return api(`/api/clusters/${encodeURIComponent(id)}`).then((res) =>
    readJson<ClusterDetail>(res)
  );
}

export function startScan(): Promise<{ source: string; itemCount: number; note: string | null }> {
  return api("/api/scan", { method: "POST" }).then((res) =>
    readJson<{ source: string; itemCount: number; note: string | null }>(res)
  );
}

export function fetchSettings(): Promise<Settings> {
  return api("/api/settings").then((res) => readJson<Settings>(res));
}

export function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return api("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((res) => readJson<Settings>(res));
}

export function exportHref(query: FeedQuery = {}): string {
  return `/api/export.csv${qs(query)}`;
}

export function itemPreviewHref(id: number): string {
  return `/api/items/${id}/preview`;
}

export interface AssetLook {
  id: number;
  name: string;
  description: string;
  assetTypeId: number;
  assetType: string;
  creatorName: string | null;
  creatorType: string | null;
  createdAt: string | null;
  thumbnailUrl: string | null;
  storeUrl: string;
  catalogUrl: string;
  sales?: number | null;
  favorites?: number | null;
  price?: number | null;
  demandField?: "sales" | "favorites";
}

export function lookupAsset(query: string): Promise<AssetLook> {
  return api(`/api/lookup?q=${encodeURIComponent(query)}`).then((res) =>
    readJson<AssetLook>(res)
  );
}

export interface GroupStore {
  groupId: number;
  groupName: string;
  memberCount: number | null;
  itemCount: number;
  roles: { id: number; name: string; rank: number; memberCount: number }[];
  items: AssetLook[];
}

export function lookupGroupStore(query: string): Promise<GroupStore> {
  return api(`/api/group-store?q=${encodeURIComponent(query)}`).then((res) =>
    readJson<GroupStore>(res)
  );
}

export function uploadFileHref(id: string): string {
  return `/api/uploads/${id}/file`;
}

export interface DiscordIdentity {
  id: string;
  name: string;
  avatar: string | null;
}

export interface AccountPublic {
  connected: boolean;
  userId: number | null;
  username: string | null;
  displayName: string | null;
  connectedAt: string | null;
  ops: {
    sessionUploads: number;
    failed: number;
    moderated: number;
  };
  discordEnabled?: boolean;
  discord?: DiscordIdentity | null;
  hosted?: boolean;
}

export interface DashboardData {
  connected: boolean;
  user: {
    id: number;
    name: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  groupId: number | "all";
  groups: {
    id: number;
    name: string;
    role: string;
    rank: number;
    isOwner?: boolean;
    canPost?: boolean;
    canViewSales?: boolean;
    reason?: "Owner" | "Create items" | null;
    memberCount?: number;
  }[];
  kpis: {
    todayRevenue: number;
    todaySales: number;
    totalRevenue: number;
    totalSales: number;
    sessionUploads: number;
    failed: number;
    moderated: number;
    uptimeSeconds: number;
  };
  totalsExact: boolean;
  queue: {
    pending: number;
    processing: number;
    status: "idle" | "processing";
    note: string;
  };
  weekly: { date: string; revenue: number; sales: number }[];
  recentSales: { created: string; amount: number; name: string; source: string }[];
  keywords: { term: string; count: number; robux: number }[];
  notes: string[];
  sources: {
    user: "live" | "none" | "error";
    sales: "live" | "empty" | "forbidden" | "none";
    groups: "live" | "empty" | "forbidden" | "none";
  };
}

export function fetchAccount(): Promise<AccountPublic> {
  return api("/api/account").then((res) => readJson<AccountPublic>(res));
}

function packSession(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function connectAccount(
  cookie: string,
  turnstileToken?: string
): Promise<AccountPublic> {
  return api("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: packSession(cookie),
      turnstileToken: turnstileToken || undefined,
    }),
  }).then((res) => readJson<AccountPublic>(res));
}

export function disconnectAccount(): Promise<AccountPublic> {
  return api("/api/account", { method: "DELETE" }).then((res) =>
    readJson<AccountPublic>(res)
  );
}

export function logoutSession(): Promise<void> {
  return api("/api/auth/logout", { method: "POST" }).then((res) => {
    if (!res.ok) throw new Error("Could not sign out.");
  });
}

export function discordLoginHref(): string {
  return "/api/auth/discord";
}

export function fetchDashboard(groupId?: string): Promise<DashboardData> {
  const q = groupId && groupId !== "all" ? `?groupId=${encodeURIComponent(groupId)}` : "";
  return api(`/api/dashboard${q}`).then((res) => readJson<DashboardData>(res));
}

export type ClothingKind = "shirt" | "pants" | "tshirt";
export type UploadStatus = "queued" | "uploading" | "live" | "failed" | "moderated";

export interface UploadJob {
  id: string;
  name: string;
  description: string;
  kind: ClothingKind;
  price: number;
  groupId: number | null;
  fileName: string;
  mime: string;
  status: UploadStatus;
  assetId: number | null;
  catalogUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadGroup {
  id: number;
  name: string;
  role: string;
  rank: number;
  canPost?: boolean;
  reason?: "Owner" | "Create items" | null;
}

export interface UploadBoard {
  connected: boolean;
  jobs: UploadJob[];
  groups: UploadGroup[];
}

export function fetchUploads(): Promise<UploadBoard> {
  return api("/api/uploads").then((res) => readJson<UploadBoard>(res));
}

export function queueUpload(body: {
  name: string;
  description?: string;
  kind: ClothingKind;
  price: number;
  groupId: number | null;
  fileName: string;
  image: string;
}): Promise<UploadJob> {
  return api("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => readJson<UploadJob>(res));
}

export function retryUpload(id: string): Promise<UploadJob> {
  return api(`/api/uploads/${id}/retry`, { method: "POST" }).then((res) =>
    readJson<UploadJob>(res)
  );
}

export function deleteUpload(id: string): Promise<void> {
  return api(`/api/uploads/${id}`, { method: "DELETE" }).then((res) => {
    if (!res.ok) throw new Error("Could not remove that upload.");
  });
}

export interface BestsellerItem {
  id: number;
  name: string;
  salesCount: number;
  totalRobux: number;
  avgPrice: number;
  lastSoldAt: string;
  thumbnailUrl: string | null;
  catalogUrl: string;
  shareOfTotal: number;
}

export interface RecentSaleItem {
  id: number;
  name: string;
  amount: number;
  buyer: string;
  created: string;
  thumbnailUrl: string | null;
}

export interface AnalyticsData {
  connected: boolean;
  groupId: number | "all";
  groupName: string;
  groups: { id: number; name: string; role: string; canViewSales: boolean }[];
  kpis: {
    totalSales: number;
    totalRevenue: number;
    avgTicket: number;
    todaySales: number;
    todayRevenue: number;
    topItem: {
      name: string;
      id: number;
      salesCount: number;
      totalRobux: number;
      thumbnailUrl: string | null;
    } | null;
  };
  bestsellers: BestsellerItem[];
  recentSales: RecentSaleItem[];
  dailySales: { date: string; sales: number; revenue: number }[];
}

export function fetchAnalytics(groupId?: string): Promise<AnalyticsData> {
  const query = groupId && groupId !== "all" ? `?groupId=${encodeURIComponent(groupId)}` : "";
  return api(`/api/analytics${query}`).then((res) => readJson<AnalyticsData>(res));
}

export interface UgcRipResult {
  success: boolean;
  assetId: string;
  name: string;
  type: string;
  creator: string;
  thumbnailUrl: string;
  isClothing: boolean;
  meshId?: string;
  textureId?: string;
  notice?: string;
  zipUrl: string;
  textureUrl?: string;
  objUrl?: string;
  files: {
    name: string;
    url: string;
    type: "zip" | "texture" | "obj" | "mtl" | "mesh" | "other";
  }[];
  logs: string[];
}

export function ripUgcItem(params: { urlOrId: string; cookie?: string }): Promise<UgcRipResult> {
  return api("/api/copy/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((res) => readJson<UgcRipResult>(res));
}

export interface GamepassAccountInfo {
  id: number;
  name: string;
  displayName: string;
  robux: number;
  avatarUrl: string | null;
}

export interface GamepassAutomationPass {
  id: string;
  url: string;
  name: string;
  price: number;
  productId?: number;
  sellerId?: number;
  thumbnailUrl?: string;
  status: "pending" | "processing" | "success" | "failed" | "skipped_regional";
  error?: string;
  purchasedAt?: string;
}

export interface GamepassAutomationJob {
  id: string;
  createdAt: string;
  updatedAt: string;
  account: {
    id: number;
    name: string;
    displayName: string;
    avatarUrl: string | null;
  };
  payRegional: boolean;
  delayBetweenSeconds: number;
  status: "queued" | "processing" | "completed" | "failed" | "partial";
  totalPasses: number;
  completedPasses: number;
  passes: GamepassAutomationPass[];
  error?: string;
}

export function fetchGamepassAccount(): Promise<GamepassAccountInfo> {
  return api("/api/gamepass/account").then((res) => readJson<GamepassAccountInfo>(res));
}

export function fetchGamepassJobs(): Promise<{ jobs: GamepassAutomationJob[] }> {
  return api("/api/gamepass/jobs").then((res) => readJson<{ jobs: GamepassAutomationJob[] }>(res));
}

export function startGamepassAutomation(data: {
  links: string[];
  payRegional: boolean;
  delayBetweenSeconds: number;
}): Promise<{ success: boolean; job: GamepassAutomationJob }> {
  return api("/api/gamepass/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => readJson<{ success: boolean; job: GamepassAutomationJob }>(res));
}

export function deleteGamepassJob(id: string): Promise<{ success: boolean }> {
  return api(`/api/gamepass/jobs/${id}`, { method: "DELETE" }).then((res) =>
    readJson<{ success: boolean }>(res)
  );
}

export interface ExecutiveReportResponse {
  report: string;
  generatedAt: string;
  topNiches: { name: string; verdict: string; opportunity: number; demand: string }[];
  suggestedDrops: { name: string; type: string; price: number; tags: string[] }[];
}

export interface LiveGroupItem {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  hasVerifiedBadge?: boolean;
}

export function generateAiMarketReport(prompt?: string): Promise<ExecutiveReportResponse> {
  return api("/api/ai/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  }).then((res) => readJson<ExecutiveReportResponse>(res));
}

export function searchLiveGroups(query: string, limit: number = 10): Promise<{ groups: LiveGroupItem[] }> {
  return api(`/api/groups/live-search?q=${encodeURIComponent(query)}&limit=${limit}`).then((res) =>
    readJson<{ groups: LiveGroupItem[] }>(res)
  );
}

export interface CreateUgcPayload {
  prompt: string;
  attachments?: Array<{ name: string; mimeType: string; data: string }>;
  effort?: "Rápida" | "Detalhada" | "Profunda";
  groupId?: number | null;
  groupName?: string | null;
  stylePreset?: string | null;
}

export interface UgcDesignResponse {
  success: boolean;
  design: {
    title: string;
    kind: "shirt" | "pants" | "tshirt";
    price: number;
    theme: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    pattern: "solid" | "stripes" | "camo" | "plaid" | "grunge" | "acid_wash" | "stars";
    shirtStyle?: "short_sleeve" | "long_sleeve" | "crop_top" | "hoodie";
    graphicTheme?: string;
    graphicText?: string;
    details: string[];
    description: string;
    reply: string;
    catalogResearch?: Array<{
      id: number;
      name: string;
      creatorName: string;
      favoriteCount: number;
      url: string;
    }>;
  };
}

export function createUgcWithAi(payload: CreateUgcPayload): Promise<UgcDesignResponse> {
  return api("/api/ai/ugc-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => readJson<UgcDesignResponse>(res));
}

export interface MarketScanParams {
  strategy?: "bestselling" | "favorited" | "recent" | "sales" | "price_asc";
  timePeriod?: "all" | "day" | "week" | "month";
  keywords?: string;
  groupId?: string | number;
  scanMode?: "fixed" | "rotation";
  limit?: number;
  assetType?: "both" | "shirts" | "pants" | "tshirts" | "ugc";
  shirtPantsRatio?: number;
  rotationKeywords?: string[];
}

export interface ScannedMarketItem {
  id: number;
  itemType: string;
  assetType: number | null;
  name: string;
  description: string;
  creatorId: number;
  creatorName: string;
  creatorType: string;
  createdAt: string | null;
  favoriteCount: number;
  price: number | null;
  thumbnailUrl: string | null;
  category: string;
  assetTypeName: string;
  collectibleItemId?: string | null;
}

export interface MarketScanResult {
  ok: boolean;
  items: ScannedMarketItem[];
  total: number;
  summary: {
    avgPrice: number;
    totalFavorites: number;
    shirtCount: number;
    pantsCount: number;
    ugcCount: number;
    topKeywords: string[];
  };
  options: MarketScanParams;
}

export function scanMarketCatalog(params: MarketScanParams): Promise<MarketScanResult> {
  return api("/api/market-scanner/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((res) => readJson<MarketScanResult>(res));
}

export interface GroupSalesAnalysis {
  group: {
    id: number;
    name: string;
    memberCount: number;
    description: string;
  };
  metrics: {
    totalItems: number;
    sellingItemsCount: number;
    stagnantItemsCount: number;
    totalFavorites: number;
    avgPrice: number;
    healthScore: number;
    overpricedCount: number;
    vagueTitleCount: number;
    shortDescCount: number;
  };
  topSellingItems: Array<{
    id: number;
    name: string;
    price: number;
    favorites: number;
    assetType: string;
    reasonsForSuccess: string[];
  }>;
  stagnantItems: Array<{
    id: number;
    name: string;
    price: number;
    favorites: number;
    assetType: string;
    reasonsWhyItFails: string[];
    suggestedFix: string;
  }>;
  aiDiagnosis: string;
  actionPlan: string[];
}

export function analyzeGroupSales(groupId?: number): Promise<{ success: boolean; analysis: GroupSalesAnalysis }> {
  return api("/api/ai/analyze-group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  }).then((res) => readJson<{ success: boolean; analysis: GroupSalesAnalysis }>(res));
}

export function optimizeCatalog(groupId?: number): Promise<{ success: boolean; result: any; logs: any[] }> {
  return api("/api/ai/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  }).then((res) => readJson<{ success: boolean; result: any; logs: any[] }>(res));
}

export interface CloneAssetParams {
  assetId: number;
  name?: string;
  kind?: "shirt" | "pants" | "tshirt";
  price?: number;
  groupId?: number | null;
  mode?: "original" | "ai_remake";
}

export interface CloneAssetResponse {
  ok: boolean;
  job?: UploadJob | null;
  uploadError?: string | null;
  templateDataUrl?: string;
  item?: {
    id: number;
    name: string;
    kind: string;
    price: number;
    groupId: number | null;
  };
  message?: string;
  error?: string;
}

export function cloneAssetToGroup(params: CloneAssetParams): Promise<CloneAssetResponse> {
  return api("/api/market-scanner/clone-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((res) => readJson<CloneAssetResponse>(res));
}



