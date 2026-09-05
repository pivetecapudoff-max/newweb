import type { PersistedState } from "./types.js";

const CURATED_IPS = [
  "naruto", "sasuke", "one piece", "luffy", "zoro", "goku", "vegeta", "dragon ball",
  "jujutsu", "gojo", "sukuna", "demon slayer", "tanjiro", "nezuko", "bleach",
  "ichigo", "solo leveling", "sung jinwoo", "blue lock", "isagi", "bachira",
  "chainsaw", "denji", "makima", "spy x family", "anya", "attack on titan",
  "eren", "mikasa", "my hero", "deku", "bakugo", "todoroki", "sailor moon",
  "pokemon", "pikachu", "sonic", "shadow", "mario", "luigi", "kirby",
  "batman", "joker", "spiderman", "spider-man", "venom", "iron man",
  "deadpool", "wolverine", "superman", "wonder woman", "star wars",
  "darth vader", "minecraft", "creeper", "hello kitty", "kuromi",
  "cinnamoroll", "sanrio", "hatsune miku", "vocaloid", "undertale",
  "sans", "deltarune", "fnaf", "chucky", "wednesday", "addams",
  "labubu", "sonny angel", "kpop", "bts", "blackpink", "valorant",
  "jett", "sage", "fortnite", "among us", "squid game", "arcane",
  "jinx", "vi", "league of legends", "genshin", "hutao", "raiden",
  "ben 10", "steven universe", "adventure time", "gravity falls",
];

interface AniTitle {
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
}

function pushTitle(bucket: Set<string>, value?: string | null): void {
  if (!value) return;
  const clean = value.toLowerCase().trim();
  if (clean.length >= 3) bucket.add(clean);
}

async function fetchAniListTrending(): Promise<string[]> {
  const query = `
    query {
      Page(page: 1, perPage: 40) {
        media(type: ANIME, sort: TRENDING_DESC) {
          title { romaji english native }
        }
      }
    }
  `;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Farol/1.0 (+local UGC research)",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const payload = (await res.json()) as { data?: { Page?: { media?: AniTitle[] } } };
  const titles = new Set<string>();
  for (const media of payload.data?.Page?.media || []) {
    pushTitle(titles, media.title?.romaji);
    pushTitle(titles, media.title?.english);
  }
  return [...titles];
}

async function fetchJikanFallback(): Promise<string[]> {
  const res = await fetch("https://api.jikan.moe/v4/top/anime?filter=airing&limit=20", {
    headers: {
      Accept: "application/json",
      "User-Agent": "Farol/1.0 (+local UGC research)",
    },
  });
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const payload = (await res.json()) as {
    data?: { title?: string; title_english?: string }[];
  };
  const titles = new Set<string>();
  for (const row of payload.data || []) {
    pushTitle(titles, row.title);
    pushTitle(titles, row.title_english);
  }
  return [...titles];
}

export async function refreshOverlay(state: PersistedState): Promise<string[]> {
  const ageMs = state.overlay.fetchedAt
    ? Date.now() - new Date(state.overlay.fetchedAt).getTime()
    : Number.POSITIVE_INFINITY;

  if (state.overlay.titles.length && ageMs < 12 * 60 * 60 * 1000) {
    return state.overlay.titles;
  }

  const titles = new Set(CURATED_IPS);
  let source = "lista curada local";

  try {
    const live = await fetchAniListTrending();
    live.forEach((title) => titles.add(title));
    source = "AniList (trending) + lista curada";
  } catch {
    try {
      const live = await fetchJikanFallback();
      live.forEach((title) => titles.add(title));
      source = "Jikan/MAL (top airing) + lista curada";
    } catch {
      source = "lista curada local (APIs de anime indisponíveis neste ambiente)";
    }
  }

  state.overlay = {
    fetchedAt: new Date().toISOString(),
    source,
    titles: [...titles],
  };
  return state.overlay.titles;
}

export function matchIp(text: string, titles: string[]): string | null {
  const hay = ` ${text.toLowerCase()} `;
  let best: string | null = null;
  for (const title of titles) {
    if (title.length < 3) continue;
    const needle = ` ${title} `;
    if (hay.includes(needle) || hay.includes(title)) {
      if (!best || title.length > best.length) best = title;
    }
  }
  return best;
}
