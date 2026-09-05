export const VERDICT_LABEL = {
  subir: "Upload now",
  vale: "Worth uploading",
  olho: "Watching",
  passar: "Skip",
} as const;

export const BADGE_LABEL = {
  ganhando_forca: "Gaining steam",
  achado: "Find",
  referencia: "Hot reference",
} as const;

export const CATEGORY_LABEL = {
  shirts: "Shirts",
  pants: "Pants",
  tshirts: "T-shirts",
  characters: "Characters",
  collectibles: "Collectibles",
} as const;

export type Verdict = keyof typeof VERDICT_LABEL;
export type Badge = keyof typeof BADGE_LABEL;
export type Category = keyof typeof CATEGORY_LABEL;

export function demandCaption(field: "vendas" | "favoritos" | undefined): string {
  return field === "vendas" ? "Sales (Economy API)" : "Favorites (sales not public)";
}

export function formatDemand(count: number, field: "vendas" | "favoritos" | undefined): string {
  const n = Number.isFinite(count) ? count : 0;
  return field === "vendas" ? `${n} sales` : `${n} fav`;
}

export function demandNoun(field: "vendas" | "favoritos" | undefined): string {
  return field === "vendas" ? "Sales" : "Favorites";
}
