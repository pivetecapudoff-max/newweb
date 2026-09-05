const STOP = new Set([
  "a", "ao", "aos", "as", "ate", "até", "com", "como", "da", "das", "de", "do", "dos",
  "e", "em", "era", "essa", "esse", "esta", "este", "eu", "foi", "in", "la", "lá",
  "mais", "mas", "me", "meu", "minha", "na", "nas", "no", "nos", "o", "os", "ou",
  "para", "por", "pra", "que", "se", "sem", "sua", "seu", "um", "uma", "uns",
  "the", "and", "for", "with", "from", "this", "that", "your", "you", "are", "was",
  "not", "new", "best", "free", "sale", "off", "only", "very", "just", "all",
  "shirt", "shirts", "pants", "pant", "tshirt", "tshirts", "tee", "tees",
  "camisa", "camisas", "calca", "calcas", "calça", "calças", "camiseta",
  "hoodie", "jacket", "item", "items", "ugc", "roblox", "limited", "original",
  "version", "style", "fit", "fits", "custom", "edit", "made", "by",
  "cute", "cool", "love", "pretty", "aesthetic", "drip", "img", "dsc",
  "top", "bottom",
]);

export function tokenize(title: string): string[] {
  const cleaned = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/[\[(][+\-][\])]/g, " ")
    .replace(/\bimg[_\s-]?\d+\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ");

  const parts = cleaned
    .split(/[\s/_-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !STOP.has(part) && !/^\d+$/.test(part));

  const tokens = [...parts];
  for (let i = 0; i < parts.length - 1; i += 1) {
    tokens.push(`${parts[i]} ${parts[i + 1]}`);
  }
  return tokens;
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
  return tf;
}

export function documentFrequency(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tokens of docs) {
    for (const token of new Set(tokens)) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }
  return df;
}

export function tfidfVector(
  tokens: string[],
  df: Map<string, number>,
  docCount: number
): Map<string, number> {
  const tf = termFrequency(tokens);
  const vec = new Map<string, number>();
  let norm = 0;
  const length = Math.max(tokens.length, 1);

  for (const [term, count] of tf) {
    const idf = Math.log((docCount + 1) / ((df.get(term) || 0) + 1)) + 1;
    const weight = (count / length) * idf;
    vec.set(term, weight);
    norm += weight * weight;
  }

  const scale = Math.sqrt(norm) || 1;
  for (const [term, weight] of vec) vec.set(term, weight / scale);
  return vec;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) dot += weight * other;
  }
  return dot;
}

export function addVectors(target: Map<string, number>, extra: Map<string, number>): void {
  for (const [term, weight] of extra) {
    target.set(term, (target.get(term) || 0) + weight);
  }
}

export function scaleVector(vec: Map<string, number>, factor: number): Map<string, number> {
  const next = new Map<string, number>();
  for (const [term, weight] of vec) next.set(term, weight * factor);
  return next;
}

export function normalizeVector(vec: Map<string, number>): Map<string, number> {
  let norm = 0;
  for (const weight of vec.values()) norm += weight * weight;
  const scale = Math.sqrt(norm) || 1;
  const next = new Map<string, number>();
  for (const [term, weight] of vec) next.set(term, weight / scale);
  return next;
}

export function titleCase(term: string): string {
  return term
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}
