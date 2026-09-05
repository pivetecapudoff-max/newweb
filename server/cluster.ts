import {
  addVectors,
  cosine,
  documentFrequency,
  normalizeVector,
  scaleVector,
  tfidfVector,
  titleCase,
  tokenize,
} from "./nlp.js";
import type { CatalogCategory, CatalogItem, ClusterKeyword } from "./types.js";

const ASSIGN_THRESHOLD = 0.3;
const MERGE_THRESHOLD = 0.62;
const GENERIC = new Set([
  "cute",
  "cool",
  "love",
  "pretty",
  "aesthetic",
  "drip",
  "fire",
  "sigma",
  "img",
  "dsc",
  "photo",
  "edit",
  "style",
  "full",
  "zip",
  "fit",
]);
const WEAK_UNIGRAMS = new Set([
  "black",
  "white",
  "red",
  "blue",
  "pink",
  "green",
  "yellow",
  "purple",
  "orange",
  "brown",
  "gray",
  "grey",
]);

export interface RawCluster {
  id: string;
  label: string;
  keywords: ClusterKeyword[];
  category: CatalogCategory;
  items: CatalogItem[];
  centroid: Map<string, number>;
}

function majorityCategory(items: CatalogItem[]): CatalogCategory {
  const counts = new Map<CatalogCategory, number>();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function keywordScore(term: string, weight: number): number {
  const words = term.split(" ").length;
  return weight * (words > 1 ? 1.3 : 1);
}

function summarize(
  items: CatalogItem[],
  vectors: Map<string, number>[]
): { label: string; keywords: ClusterKeyword[] } {
  const sums = new Map<string, number>();
  for (const vec of vectors) {
    for (const [term, weight] of vec) {
      sums.set(term, (sums.get(term) || 0) + keywordScore(term, weight));
    }
  }

  const ranked = [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, weight]) => ({ term, weight: Number(weight.toFixed(4)) }));

  const bigram = ranked.find((row) => row.term.includes(" "));
  const unigram = ranked[0];
  const chosen =
    bigram && unigram && bigram.weight >= unigram.weight * 0.72
      ? bigram.term
      : unigram?.term || items[0].name;

  return { label: titleCase(chosen), keywords: ranked };
}

function fingerprint(keywords: ClusterKeyword[]): string {
  const key = keywords
    .slice(0, 3)
    .map((row) => row.term)
    .sort()
    .join("|");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const slug = (keywords[0]?.term || "tema")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `${slug || "tema"}-${hash.toString(16)}`;
}

function centroidOf(vectors: Map<string, number>[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const vec of vectors) addVectors(acc, vec);
  return normalizeVector(scaleVector(acc, 1 / Math.max(vectors.length, 1)));
}

function usefulTerm(term: string, df: number, n: number): boolean {
  if (GENERIC.has(term)) return false;
  if (!term.includes(" ") && WEAK_UNIGRAMS.has(term)) return false;
  if (df < 2 || df > Math.max(8, n * 0.35)) return false;
  return true;
}

function termPriority(term: string, df: number, n: number): number {
  const idf = Math.log((n + 1) / (df + 1)) + 1;
  const words = term.split(" ").length;
  return df * idf * (words > 1 ? 1.4 : 1);
}

export function clusterItems(items: CatalogItem[]): RawCluster[] {
  if (!items.length) return [];

  const tokenized = items.map((item) => tokenize(item.name));
  const df = documentFrequency(tokenized);
  const vectors = tokenized.map((tokens) => tfidfVector(tokens, df, items.length));
  const assigned = new Set<number>();
  const groups: number[][] = [];

  const termMembers = new Map<string, number[]>();
  tokenized.forEach((tokens, index) => {
    for (const term of new Set(tokens)) {
      if (!usefulTerm(term, df.get(term) || 0, items.length)) continue;
      const list = termMembers.get(term) || [];
      list.push(index);
      termMembers.set(term, list);
    }
  });

  const rankedTerms = [...termMembers.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort(
      (a, b) =>
        termPriority(b[0], df.get(b[0]) || 0, items.length) -
        termPriority(a[0], df.get(a[0]) || 0, items.length)
    );

  for (const [, members] of rankedTerms) {
    const free = members.filter((index) => !assigned.has(index));
    if (free.length < 2) continue;
    groups.push(free);
    free.forEach((index) => assigned.add(index));
  }

  const leftovers = items
    .map((_, index) => index)
    .filter((index) => !assigned.has(index))
    .sort((a, b) => tokenized[b].length - tokenized[a].length);

  const leftoverGroups: { indexes: number[]; centroid: Map<string, number> }[] = [];
  for (const index of leftovers) {
    const vec = vectors[index];
    let best = -1;
    let bestSim = 0;
    for (let g = 0; g < leftoverGroups.length; g += 1) {
      const sim = cosine(vec, leftoverGroups[g].centroid);
      if (sim > bestSim) {
        bestSim = sim;
        best = g;
      }
    }
    if (best >= 0 && bestSim >= ASSIGN_THRESHOLD) {
      leftoverGroups[best].indexes.push(index);
      leftoverGroups[best].centroid = centroidOf(
        leftoverGroups[best].indexes.map((i) => vectors[i])
      );
    } else {
      leftoverGroups.push({ indexes: [index], centroid: vec });
    }
  }

  for (const group of leftoverGroups) groups.push(group.indexes);

  const built = groups.map((indexes) => ({
    indexes,
    centroid: centroidOf(indexes.map((index) => vectors[index])),
  }));

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < built.length; i += 1) {
      for (let j = i + 1; j < built.length; j += 1) {
        if (cosine(built[i].centroid, built[j].centroid) >= MERGE_THRESHOLD) {
          built[i].indexes.push(...built[j].indexes);
          built[i].centroid = centroidOf(built[i].indexes.map((idx) => vectors[idx]));
          built.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return built
    .map((group) => {
      const members = group.indexes.map((index) => items[index]);
      const memberVecs = group.indexes.map((index) => vectors[index]);
      const summary = summarize(members, memberVecs);
      return {
        id: fingerprint(summary.keywords),
        label: summary.label,
        keywords: summary.keywords,
        category: majorityCategory(members),
        items: members,
        centroid: group.centroid,
      };
    })
    .sort((a, b) => b.items.length - a.items.length);
}

export function keywordOverlap(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  let inter = 0;
  for (const term of left) if (right.has(term)) inter += 1;
  const union = left.size + right.size - inter;
  return union ? inter / union : 0;
}
