import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState, latestCycle } from './store.js';
import { buildDashboard } from './dashboard.js';
import { lookupGroupStore } from './lookup.js';
import { loadAccount } from './account.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const geminiConfigPath = path.join(rootDir, 'data', 'gemini.json');

export interface AiLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  action: string;
  message: string;
  details?: any;
}

export interface AiImageAttachment {
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  data: string;
}

export interface AiMessageOptions {
  effort?: 'Rápida' | 'Detalhada' | 'Profunda';
  attachments?: AiImageAttachment[];
}

export interface LiveCatalogItem {
  id: number;
  name: string;
  price: number | null;
  creatorName: string | null;
  creatorType: string | null;
  favoriteCount: number | null;
  assetType?: number;
  itemType?: string;
  url: string;
}

export interface LiveRobloxGroup {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  hasVerifiedBadge?: boolean;
}

export interface ExecutiveReportData {
  report: string;
  generatedAt: string;
  topNiches: { name: string; verdict: string; opportunity: number; demand: string }[];
  suggestedDrops: { name: string; type: string; price: number; tags: string[] }[];
}

const MAX_LOGS = 300;
const logs: AiLog[] = [
  {
    id: 'init-1',
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    level: 'info',
    action: 'SYSTEM',
    message: 'Assistente de Inteligência e Radar de Mercado Roblox inicializados com sucesso.',
  },
];

export function addLog(
  level: 'info' | 'success' | 'warn' | 'error',
  action: string,
  message: string,
  details?: any
): AiLog {
  const entry: AiLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    level,
    action,
    message,
    details,
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();
  return entry;
}

export function getLogs(): AiLog[] {
  return logs;
}

export function clearLogs(): void {
  logs.length = 0;
  addLog('info', 'SYSTEM', 'Logs limpos pelo usuário.');
}

function getCookie(): string | null {
  try {
    return loadAccount()?.cookie || null;
  } catch {
    return null;
  }
}

function getGeminiConfig(): { apiKey: string; model: string } {
  try {
    if (fs.existsSync(geminiConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(geminiConfigPath, 'utf8'));
      if (cfg?.apiKey) {
        return {
          apiKey: cfg.apiKey,
          model: cfg.model || 'gemini-flash-lite-latest',
        };
      }
    }
  } catch {}
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-flash-lite-latest',
  };
}

// ----------------------------------------------------
// LIVE ROBLOX SEARCH ENGINES (CATALOG & GROUPS)
// ----------------------------------------------------

export async function searchLiveRobloxCatalog(params: {
  keyword: string;
  category?: 'Clothing' | 'Accessories' | 'All';
  limit?: number;
}): Promise<LiveCatalogItem[]> {
  try {
    const category = params.category || 'Clothing';
    const limit = [10, 28, 30].includes(params.limit || 10) ? params.limit || 10 : 10;
    const url = `https://catalog.roblox.com/v1/search/items/details?Category=${encodeURIComponent(
      category
    )}&keyword=${encodeURIComponent(params.keyword)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: any[] };
    return (data.data || []).map((item) => ({
      id: item.id,
      name: item.name || `Item ${item.id}`,
      price: typeof item.price === 'number' ? item.price : null,
      creatorName: item.creatorName || 'Desconhecido',
      creatorType: item.creatorType || 'Group',
      favoriteCount: typeof item.favoriteCount === 'number' ? item.favoriteCount : 0,
      assetType: item.assetType,
      itemType: item.itemType,
      url: `https://www.roblox.com/catalog/${item.id}`,
    }));
  } catch (err: any) {
    addLog('warn', 'ROBLOX_CATALOG_SEARCH', `Falha ao buscar catálogo ao vivo: ${err.message}`);
    return [];
  }
}

export async function searchLiveRobloxGroups(
  keyword: string,
  limit: number = 10
): Promise<LiveRobloxGroup[]> {
  try {
    const validLimit = limit <= 10 ? 10 : limit <= 25 ? 25 : limit <= 50 ? 50 : 100;
    const url = `https://groups.roblox.com/v1/groups/search?keyword=${encodeURIComponent(keyword)}&limit=${validLimit}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: any[] };
    return (data.data || []).map((grp) => ({
      id: grp.id,
      name: grp.name,
      description: (grp.description || '').slice(0, 300),
      memberCount: grp.memberCount || 0,
      hasVerifiedBadge: Boolean(grp.hasVerifiedBadge),
    }));
  } catch (err: any) {
    addLog('warn', 'ROBLOX_GROUP_SEARCH', `Falha ao buscar grupos ao vivo: ${err.message}`);
    return [];
  }
}

// Enhanced Algorithmic Fallback Description Generator (High-Converting English SEO - Multi-Group Universal)
export function generateEnhancedSeoDescription(
  title: string,
  assetType?: number | string,
  groupName?: string
): string {
  const t = title.toLowerCase();
  const isUgc =
    Number(assetType) >= 41 ||
    t.includes('hair') ||
    t.includes('cabelo') ||
    t.includes('hat') ||
    t.includes('beanie');

  let header = `⋆ ˚｡⋆୨୧˚ ${title} ˚୨୧⋆｡˚ ⋆`;
  let intro = 'High quality aesthetic fit with clean custom shading, delicate ribbon bows and off-shoulder styling.';
  let tagList = [
    'aesthetic',
    'trendy',
    'outfit',
    'drip',
    'style',
    'clean',
    'catalogavatarcreator',
    'roblox',
    'moe',
    'jiraikei',
    'vkei',
    'darkkawaii',
    'gothdoll',
    'altoutfit',
    'matching',
    'cutefit',
    '5robux',
    'cheap',
  ];

  // Dynamically inject the user's specific group tag
  const storeName = groupName && groupName.trim() ? groupName.trim() : null;
  if (storeName) {
    const cleanGroupTag = storeName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanGroupTag && cleanGroupTag.length >= 2) {
      tagList.unshift(cleanGroupTag);
    }
  }

  if (t.includes('goth') || t.includes('vamp') || t.includes('emo') || t.includes('dark') || t.includes('skull') || t.includes('opium') || t.includes('misa') || t.includes('death note')) {
    header = `⋆ ˚｡⋆୨୧˚ ${title} ˚୨୧⋆｡˚ ⋆`;
    intro = 'Premium dark gothic aesthetic with high-fidelity shading, lace straps, choker and arm warmers.';
    tagList.push('goth', 'gothic', 'vamp', 'vampire', 'emo', 'grunge', 'drain', 'opium', 'alt', 'darkaesthetic', 'cyber', 'punk', 'emogirl', 'misa', 'deathnote');
  } else if (t.includes('cute') || t.includes('coquette') || t.includes('pink') || t.includes('sanrio') || t.includes('kawaii') || t.includes('bow') || t.includes('uwu') || t.includes('cat')) {
    header = `⋆ ˚｡⋆୨୧˚ ${title} ˚୨୧⋆｡˚ ⋆`;
    intro = 'Super cute and delicate aesthetic with soft details, ribbon bow ୨୧ and off-shoulder neckline.';
    tagList.push('coquette', 'cute', 'kawaii', 'pastel', 'cutecore', 'softgirl', 'sanrio', 'ribbon', 'girly', 'preppy', 'fairy', 'cat', 'uwu', 'offshoulder');
  } else if (t.includes('pj') || t.includes('pajama') || t.includes('batman') || t.includes('spiderman')) {
    header = `⋆ ˚｡⋆୨୧˚ ${title} ˚୨୧⋆｡˚ ⋆`;
    intro = 'Comfy cozy cute pajama fit for Da Hood and hangouts. Perfect matching couple aesthetic.';
    tagList.push('pjs', 'pajamas', 'dahood', 'da hood', 'cozy', 'sleepwear', 'matching', 'couple', 'couplefit');
  } else if (t.includes('cargo') || t.includes('baggy') || t.includes('jeans') || t.includes('streetwear') || t.includes('hoodie')) {
    header = `─── ⋆⋅☆⋅⋆ ── ${title} ── ⋆⋅☆⋅⋆ ───`;
    intro = 'Modern baggy streetwear fit with realistic wrinkles. The essential drip for your avatar wardrobe.';
    tagList.push('streetwear', 'baggy', 'cargopants', 'hoodie', 'drip', 'oversized', 'urban', 'vintage', 'skate', 'thrift');
  } else if (t.includes('cyber') || t.includes('y2k') || t.includes('star') || t.includes('retro')) {
    header = `⭐ ⋆ ˚｡⋆ ${title} ⋆ ˚｡⋆ ⭐`;
    intro = 'Authentic 2000s Y2K nostalgia with clean cyber accents. Stands out in any Roblox experience.';
    tagList.push('y2k', 'cyberpunk', '2000s', 'mcbling', 'star', 'vintage', 'retro', 'y2koutfit', 'futuristic');
  } else {
    tagList.push('fashion', 'robloxfashion', 'cool', 'vibes', 'popular', 'matching', 'casual');
  }

  if (isUgc) {
    tagList.push('ugc', 'robloxugc', '3daccessory', 'ugcitem');
  } else {
    tagList.push('5robux', 'cheap', 'classic', 'shirt', 'pants');
  }

  const uniqueTags = Array.from(new Set(tagList)).slice(0, 24);

  const welcomeLine = storeName
    ? `♡ Welcome to ${storeName} !`
    : `♡ Welcome to our official Roblox store !`;
  const rankLine = storeName
    ? `♡ Buy 5+ clothes for special rank rewards in our group!`
    : `♡ Buy 5+ clothes to support our drops and unlock matching outfits!`;

  return `${header}

${welcomeLine}
${rankLine}
♡ Matching outfits & daily aesthetic drops.
★ ${intro}
★ Try it on in Catalog Avatar Creator (CAC)!

tags: ${uniqueTags.join(' ')}`;
}

// Backward compatibility alias
export function generateSeoDescription(title: string, assetType?: number | string, groupName?: string): string {
  return generateEnhancedSeoDescription(title, assetType, groupName);
}

// Fetch Roblox Asset Thumbnail as Base64 for Multimodal Vision
export async function fetchAssetThumbnailBase64(
  assetId: number | string
): Promise<{ mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string } | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png&isCircular=false`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const imageUrl = json.data?.[0]?.imageUrl;
    if (!imageUrl || json.data?.[0]?.state !== 'Completed') return null;

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const arrayBuffer = await imgRes.arrayBuffer();
    return {
      mimeType: 'image/png',
      data: Buffer.from(arrayBuffer).toString('base64'),
    };
  } catch (err: any) {
    addLog('warn', 'THUMB_FETCH', `Não foi possível baixar thumbnail do asset ${assetId}: ${err.message}`);
    return null;
  }
}

export async function fetchImageBase64FromUrl(
  url: string
): Promise<{ mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string } | null> {
  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'image/jpeg'
      : contentType.includes('webp')
      ? 'image/webp'
      : 'image/png';
    const arrayBuffer = await imgRes.arrayBuffer();
    return {
      mimeType,
      data: Buffer.from(arrayBuffer).toString('base64'),
    };
  } catch {
    return null;
  }
}

export interface SeoOptimizationResult {
  visualAnalysis: string;
  strongKeywords: string[];
  titleOptions: { title: string; score: number; reason: string }[];
  bestTitle: string;
  finalDescription: string;
  tags: string[];
  rawText: string;
}

// Multimodal Visual SEO & Title Optimizer (Roblox Marketplace Specialist)
export async function optimizeItemSeoMultimodal(options: {
  assetId?: number | string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  title?: string;
  groupName?: string;
  styleHint?: string;
}): Promise<SeoOptimizationResult> {
  let attachment: AiImageAttachment | null = null;

  if (options.imageBase64) {
    const cleanBase64 = options.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    attachment = {
      name: 'item_preview.png',
      mimeType: options.mimeType || 'image/png',
      data: cleanBase64,
    };
  } else if (options.imageUrl) {
    const fetched = await fetchImageBase64FromUrl(options.imageUrl);
    if (fetched) {
      attachment = {
        name: 'item_preview.png',
        mimeType: fetched.mimeType,
        data: fetched.data,
      };
    }
  } else if (options.assetId) {
    const fetched = await fetchAssetThumbnailBase64(options.assetId);
    if (fetched) {
      attachment = {
        name: `asset_${options.assetId}.png`,
        mimeType: fetched.mimeType,
        data: fetched.data,
      };
    }
  }

  const prompt = `Você é especialista em Roblox UGC, Marketplace, SEO, tendências de avatar e otimização de títulos para aumentar descoberta e vendas.

Sua tarefa é criar um TÍTULO e uma DESCRIÇÃO com o maior potencial possível de descoberta no Roblox Marketplace.

Analise a imagem anexada cuidadosamente antes de responder.
Quero que você pense como um especialista em marketing de UGC, não apenas descreva literalmente o item.

Contexto adicional:
- Título/Nome atual ou referência: "${options.title || 'Roblox UGC Item'}"
- Loja/Grupo: "${options.groupName || 'Roblox Store'}"
${options.styleHint ? `- Dica de estilo: "${options.styleHint}"` : ''}

REGRAS OBRIGATÓRIAS:

1. Analise visualmente:
- tipo do item
- cor
- estilo
- formato
- estética
- características mais chamativas
- público que provavelmente usaria
- possíveis estilos relacionados (anime, kawaii, Y2K, cute, doll, soft etc.), mas SOMENTE se realmente combinarem com a imagem.

2. Pense em como usuários realmente pesquisariam esse tipo de item no Roblox.

3. O título deve:
- estar preferencialmente em inglês, porque o Marketplace é global
- ter no máximo 50 caracteres
- colocar as palavras mais importantes primeiro
- usar palavras que descrevam exatamente o item
- ser fácil de pesquisar
- parecer natural
- NÃO usar palavras irrelevantes apenas para SEO
- NÃO usar emoji no título
- NÃO desperdiçar caracteres
- NÃO fazer clickbait enganoso

4. A descrição deve:
- começar com uma frase curta e atraente
- explicar o estilo do item
- mencionar estéticas realmente compatíveis
- conter naturalmente palavras que podem ajudar na busca
- terminar com algumas tags relevantes
- evitar spam de palavras
- não colocar tags que não tenham relação com o item
- Pode usar símbolos como ♡ ou ⋆ na descrição, mas não no título.

5. Gere 5 opções de título. Depois dê uma nota de 0 a 10 para cada uma considerando:
- potencial de busca
- clareza
- aparência profissional
- compatibilidade com a imagem
- potencial comercial

6. Escolha UMA opção como vencedora e explique rapidamente por que ela é melhor.

FORMATO OBRIGATÓRIO DA RESPOSTA:

ANÁLISE VISUAL:
[análise visual detalhada do item e da imagem]

PALAVRAS-CHAVE MAIS FORTES:
[keywords separadas por vírgula]

TÍTULOS:
1. [Título 1] - Nota: X/10 - [motivo]
2. [Título 2] - Nota: X/10 - [motivo]
3. [Título 3] - Nota: X/10 - [motivo]
4. [Título 4] - Nota: X/10 - [motivo]
5. [Título 5] - Nota: X/10 - [motivo]

MELHOR TÍTULO:
[título vencedor de até 50 caracteres, em inglês, sem emoji]

DESCRIÇÃO FINAL:
[descrição formatada completa pronta para publicar no Roblox]

TAGS:
[tags relevantes separadas por espaço]

Priorize a combinação entre SEO + tendência + fidelidade à imagem + chance de clique.`;

  const attachments = attachment ? [attachment] : [];
  const rawText = await callGemini(prompt, '', { effort: 'Detalhada', attachments });

  let visualAnalysis = '';
  let strongKeywords: string[] = [];
  const titleOptions: { title: string; score: number; reason: string }[] = [];
  let bestTitle = '';
  let finalDescription = '';
  let tags: string[] = [];

  const analysisMatch = rawText.match(/ANÁLISE VISUAL:\s*([\s\S]*?)(?=PALAVRAS-CHAVE MAIS FORTES:|$)/i);
  if (analysisMatch) visualAnalysis = analysisMatch[1].trim();

  const keywordsMatch = rawText.match(/PALAVRAS-CHAVE MAIS FORTES:\s*([\s\S]*?)(?=TÍTULOS:|$)/i);
  if (keywordsMatch) {
    strongKeywords = keywordsMatch[1]
      .split(/[,;\n]+/)
      .map((s) => s.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);
  }

  const titlesMatch = rawText.match(/TÍTULOS:\s*([\s\S]*?)(?=MELHOR TÍTULO:|$)/i);
  if (titlesMatch) {
    const lines = titlesMatch[1].split('\n').map((l) => l.trim()).filter((l) => /^\d+\./.test(l));
    for (const line of lines) {
      const parts = line.replace(/^\d+\.\s*/, '');
      const noteMatch = parts.match(/^(.*?)(?:\s*[-–—]\s*Nota:\s*(\d+(?:\.\d+)?)\/10)?(?:\s*[-–—]\s*(.*))?$/i);
      if (noteMatch) {
        titleOptions.push({
          title: noteMatch[1].trim().replace(/^["']|["']$/g, ''),
          score: noteMatch[2] ? parseFloat(noteMatch[2]) : 9,
          reason: noteMatch[3]?.trim() || '',
        });
      } else {
        titleOptions.push({ title: parts, score: 9, reason: '' });
      }
    }
  }

  const bestMatch = rawText.match(/MELHOR TÍTULO:\s*([\s\S]*?)(?=DESCRIÇÃO FINAL:|$)/i);
  if (bestMatch) {
    bestTitle = bestMatch[1].trim().replace(/^["']|["']$/g, '').slice(0, 50);
  } else if (titleOptions.length > 0) {
    bestTitle = titleOptions[0].title.slice(0, 50);
  } else {
    bestTitle = (options.title || 'Roblox UGC Item').slice(0, 50);
  }

  const descMatch = rawText.match(/DESCRIÇÃO FINAL:\s*([\s\S]*?)(?=TAGS:|$)/i);
  if (descMatch) {
    finalDescription = descMatch[1].trim();
  } else {
    finalDescription = rawText.trim();
  }

  const tagsMatch = rawText.match(/TAGS:\s*([\s\S]*?)$/i);
  if (tagsMatch) {
    tags = tagsMatch[1]
      .split(/[\s,]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
  }

  return {
    visualAnalysis,
    strongKeywords,
    titleOptions,
    bestTitle,
    finalDescription,
    tags,
    rawText,
  };
}

// Ultra-Intelligent AI Description Generator (Powered by Gemini, English High-Converting SEO)
export async function generateAiItemDescription(
  title: string,
  assetType?: number | string,
  styleHint?: string,
  groupName?: string,
  assetId?: number | string,
  imageUrl?: string
): Promise<string> {
  // If asset ID or image URL is available, leverage multimodal visual SEO!
  if (assetId || imageUrl) {
    try {
      const visualSeo = await optimizeItemSeoMultimodal({
        assetId,
        imageUrl,
        title,
        groupName,
        styleHint,
      });
      if (visualSeo.finalDescription && visualSeo.finalDescription.length >= 35) {
        return visualSeo.finalDescription;
      }
    } catch (err: any) {
      addLog('warn', 'AI_DESC_VISION_FALLBACK', `Fallback textual ativado para "${title}": ${err.message}`);
    }
  }

  const isUgc =
    Number(assetType) >= 41 ||
    String(title).toLowerCase().includes('hair') ||
    String(title).toLowerCase().includes('cabelo') ||
    String(title).toLowerCase().includes('hat');

  const typeStr = isUgc ? '3D UGC Accessory' : 'Classic 2D Clothing';

  const prompt = `You are a top-tier Roblox clothing designer & SEO specialist whose items consistently hit the Roblox trending catalog and Catalog Avatar Creator (CAC) top charts.
Write an authentic, highly aesthetic and viral description in ENGLISH for this Roblox clothing/UGC item:
- Item Title: "${title}"
- Type: ${typeStr}
- Store/Group Name: "${groupName || 'our Roblox store'}"
${styleHint ? `- Style Hint: ${styleHint}` : ''}

STRICT FORMAT RULES:
1. Header: Clean title with aesthetic Unicode symbols (e.g. "⋆ ˚｡⋆୨୧˚ ${title} ˚୨୧⋆｡˚ ⋆" or "─── ⋆⋅☆⋅⋆ ── ${title} ── ⋆⋅☆⋅⋆ ───").
2. Welcome line tailored to the creator's store: "${groupName ? `♡ Welcome to ${groupName} !` : '♡ Welcome to our official store !'}"
3. Call to action for member rank: "${groupName ? '♡ Buy 5+ clothes for special rank rewards in our group!' : '♡ Buy 5+ clothes to support our drops!'}"
4. 2 short, stylish English hook sentences explaining the fit, clean shading, and aesthetic appeal.
5. Catalog Avatar Creator (CAC) call-to-action: "★ Try it on in Catalog Avatar Creator (CAC)!"
6. A rich, high-density block of 15 to 22 lowercase viral search tags without '#' (including the store tag "${groupName ? groupName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'roblox'}" and aesthetic keywords).
7. Output ONLY the final description. Do not include markdown asterisks '**', quotes, explanations, or notes. Must be 100% in ENGLISH.`;

  try {
    const aiText = await callGemini(prompt, '', { effort: 'Rápida' });
    if (aiText && aiText.trim().length >= 35) {
      return aiText.trim();
    }
  } catch (err: any) {
    addLog('warn', 'AI_DESC_FALLBACK', `Gemini busy for "${title}": ${err.message}. Using English aesthetic SEO fallback.`);
  }

  return generateEnhancedSeoDescription(title, assetType, groupName);
}

// Full Roblox Group Catalog Optimization (Clothing 2D + UGC 3D)
export async function optimizeGroupCatalog(groupId?: number): Promise<{
  total: number;
  updated: number;
  errors: number;
}> {
  const cookie = getCookie();
  if (!cookie) {
    throw new Error('Nenhum cookie do Roblox encontrado. Conecte sua conta primeiro.');
  }

  let targetGroupId = groupId;
  if (!targetGroupId) {
    try {
      const acc = loadAccount() as any;
      targetGroupId = acc?.groupId || acc?.groups?.[0]?.id;
    } catch {
      targetGroupId = undefined;
    }
  }

  if (!targetGroupId) {
    throw new Error('Nenhum grupo ativo encontrado para otimização. Selecione ou conecte um grupo.');
  }

  addLog('info', 'ROBLOX_AUTH', 'Validando sessão e obtendo token CSRF...');

  let csrf = '';
  const initialRes = await fetch('https://auth.roblox.com/v2/login', {
    method: 'POST',
    headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
  });
  csrf = initialRes.headers.get('x-csrf-token') || '';

  if (!csrf) {
    throw new Error('Não foi possível obter token CSRF. O cookie pode estar expirado.');
  }

  addLog('success', 'ROBLOX_AUTH', 'Token CSRF obtido com sucesso. Buscando catálogo (Roupas & UGC)...');

  let allItems: any[] = [];
  let cursor = '';
  while (true) {
    const url = `https://catalog.roblox.com/v1/search/items?creatorTargetId=${targetGroupId}&creatorType=2&limit=30${cursor ? '&cursor=' + cursor : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.data || !data.data.length) break;
    allItems = allItems.concat(data.data);
    cursor = data.nextPageCursor;
    if (!cursor) break;
  }

  addLog('info', 'ROBLOX_CATALOG', `Encontrados ${allItems.length} itens no catálogo do grupo ID ${targetGroupId} (Roupas 2D & UGC 3D).`);

  let updated = 0;
  let errorCount = 0;

  for (const item of allItems) {
    try {
      const getRes = await fetch(`https://economy.roblox.com/v2/assets/${item.id}/details`);
      if (!getRes.ok) {
        addLog('warn', 'ASSET_FETCH', `Erro HTTP ${getRes.status} ao inspecionar item ${item.id}`);
        continue;
      }

      const asset = await getRes.json();
      const currentDesc = asset.Description || '';
      const needsUpdate =
        currentDesc.includes('High quality clothing item') || currentDesc.length < 15;

      if (!needsUpdate) continue;

      addLog('info', 'SEO_OPTIMIZE', `🤖 Analisando imagem e gerando SEO multimodal com IA para "${asset.Name}" [ID: ${item.id}]...`);
      const newDesc = await generateAiItemDescription(asset.Name, asset.AssetTypeId, undefined, undefined, item.id);

      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const metadata = JSON.stringify({
        assetId: Number(item.id),
        description: newDesc,
      });

      let payload = '--' + boundary + '\r\n';
      payload += 'Content-Disposition: form-data; name="request"\r\n\r\n';
      payload += metadata + '\r\n';
      payload += '--' + boundary + '--\r\n';

      let itemSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        // Attempt 1: develop.roblox.com (Standard for Classic Clothing: Shirts, Pants, T-Shirts)
        let patchRes = await fetch(`https://develop.roblox.com/v1/assets/${item.id}`, {
          method: 'PATCH',
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            'x-csrf-token': csrf,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: newDesc,
          }),
        });

        // Attempt 2: apis.roblox.com Open Cloud (For UGC 3D Accessories)
        if (!patchRes.ok && patchRes.status !== 429) {
          patchRes = await fetch(
            `https://apis.roblox.com/assets/user-auth/v1/assets/${item.id}?updateMask=description`,
            {
              method: 'PATCH',
              headers: {
                Cookie: `.ROBLOSECURITY=${cookie}`,
                'x-csrf-token': csrf,
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
              },
              body: payload,
            }
          );
        }

        if (patchRes.ok) {
          addLog('success', 'SEO_OPTIMIZE', `✅ "${asset.Name}" atualizado com sucesso no Roblox!`);
          updated++;
          itemSuccess = true;
          break;
        } else if (patchRes.status === 429) {
          addLog(
            'warn',
            'ROBLOX_RATE_LIMIT',
            `⏳ Rate limit (429) em "${asset.Name}". Tentativa ${attempt}/3. Pausando 5s...`
          );
          await new Promise((r) => setTimeout(r, 5000));
        } else {
          const errBody = await patchRes.text();
          if (patchRes.status === 403 || patchRes.status === 401) {
            addLog('error', 'SEO_OPTIMIZE', `❌ Sem permissão (HTTP ${patchRes.status}) em "${asset.Name}". A conta Roblox precisa de cargo com permissão "Configurar itens do grupo".`);
          } else {
            addLog('error', 'SEO_OPTIMIZE', `❌ Erro HTTP ${patchRes.status} em "${asset.Name}": ${errBody}`);
          }
          errorCount++;
          break;
        }
      }

      if (!itemSuccess) errorCount++;
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      addLog('error', 'ASSET_UPDATE', `Exceção no item ${item.id}: ${err.message}`);
      errorCount++;
    }
  }

  addLog(
    'success',
    'CATALOG_BATCH',
    `Concluído! ${updated} itens otimizados, ${errorCount} pendências.`
  );

  return { total: allItems.length, updated, errors: errorCount };
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

export async function analyzeGroupSalesPerformance(groupId?: number): Promise<GroupSalesAnalysis> {
  let targetGroupId = groupId;
  if (!targetGroupId) {
    try {
      const acc = loadAccount() as any;
      targetGroupId = acc?.groupId || acc?.groups?.[0]?.id;
    } catch {
      targetGroupId = undefined;
    }
  }
  if (!targetGroupId) {
    targetGroupId = 35320581; // default group fallback
  }

  addLog('info', 'GROUP_ANALYSIS', `Iniciando auditoria de catálogo e vendas do grupo ID ${targetGroupId}...`);

  // 1. Fetch group metadata
  let groupName = "Roblox Fashion Group";
  let memberCount = 0;
  let groupDesc = "";
  try {
    const gRes = await fetch(`https://groups.roblox.com/v1/groups/${targetGroupId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (gRes.ok) {
      const gData = await gRes.json();
      groupName = gData.name || groupName;
      memberCount = gData.memberCount || 0;
      groupDesc = gData.description || "";
    }
  } catch (err: any) {
    addLog('warn', 'GROUP_FETCH', `Não foi possível obter dados básicos do grupo: ${err.message}`);
  }

  // 2. Fetch items details
  let items: any[] = [];
  try {
    const catUrl = `https://catalog.roblox.com/v1/search/items/details?creatorTargetId=${targetGroupId}&creatorType=Group&limit=30`;
    const catRes = await fetch(catUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Farol/1.0 (+local UGC research; polite catalog reads)",
      },
    });
    if (catRes.ok) {
      const catData = await catRes.json();
      items = catData.data || [];
    }
  } catch (err: any) {
    addLog('error', 'CATALOG_FETCH', `Erro ao buscar itens do grupo: ${err.message}`);
  }

  if (items.length === 0) {
    try {
      const fallbackUrl = `https://catalog.roblox.com/v1/search/items?creatorTargetId=${targetGroupId}&creatorType=2&limit=30`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const baseItems = fallbackData.data || [];
        for (const it of baseItems.slice(0, 15)) {
          try {
            const dRes = await fetch(`https://economy.roblox.com/v2/assets/${it.id}/details`);
            if (dRes.ok) {
              const dJson = await dRes.json();
              items.push({
                id: it.id,
                name: dJson.Name || it.name,
                description: dJson.Description || "",
                price: dJson.PriceInRobux ?? it.price ?? 5,
                favoriteCount: 0,
                assetType: dJson.AssetTypeId || 11,
              });
            }
          } catch {}
        }
      }
    } catch {}
  }

  const highIntentKeywords = [
    'y2k', 'baggy', 'cargo', 'grunge', 'cyber', 'cyberpunk', 'goth', 'gothic',
    'star', 'hoodie', 'vintage', 'cropped', 'jacket', 'streetwear', 'anime',
    'emo', 'cute', 'off shoulder', 'top', 'skirt', 'rap', 'hiphop', 'drain',
    'techwear', 'vamp', 'preppy', 'flare', 'jeans'
  ];

  const genericWords = ['dots', 'sleep', 'whatever', 'shirt', 'calca', 'calça', 'roupa', 'teste', 'item', 'test', 'grey', 'black', 'white'];

  let totalFavorites = 0;
  let totalPrice = 0;
  let overpricedCount = 0;
  let vagueTitleCount = 0;
  let shortDescCount = 0;

  const analyzed = items.map((item) => {
    const name = String(item.name || '').trim();
    const desc = String(item.description || '').trim();
    const price = typeof item.price === 'number' ? item.price : 5;
    const favorites = Number(item.favoriteCount) || 0;
    const assetType = item.assetType === 12 ? 'Calça 2D' : item.assetType === 2 ? 'T-Shirt 2D' : item.assetType === 11 ? 'Camisa 2D' : 'Acessório UGC';

    totalFavorites += favorites;
    totalPrice += price;

    const isOverpriced = price > 5;
    if (isOverpriced) overpricedCount++;

    const lowerName = name.toLowerCase();
    const words = lowerName.split(/\s+/).filter(Boolean);
    const hasIntentKeyword = highIntentKeywords.some((kw) => lowerName.includes(kw));
    const isVague = words.length <= 2 && (!hasIntentKeyword || genericWords.includes(words[0]));
    if (isVague) vagueTitleCount++;

    const isShortDesc = desc.length < 35 || (!desc.includes('#') && !desc.includes('tags'));
    if (isShortDesc) shortDescCount++;

    const isSelling = favorites > 0 || (price === 5 && hasIntentKeyword && !isShortDesc);

    const reasonsForSuccess: string[] = [];
    if (price === 5) reasonsForSuccess.push('Preço ideal de 5 Robux (piso do Roblox, sem fricção de compra)');
    if (hasIntentKeyword) reasonsForSuccess.push('Título com palavras-chave de alta busca orgânica no Catalog Avatar Creator (CAC)');
    if (!isShortDesc) reasonsForSuccess.push('Descrição estruturada com tags virais indexadas no mecanismo de recomendação');
    if (favorites > 0) reasonsForSuccess.push(`Engajamento comprovado (${favorites} favoritos no catálogo)`);

    const reasonsWhyItFails: string[] = [];
    if (isOverpriced) reasonsWhyItFails.push(`Preço (${price} R$) acima do piso de 5 R$, sendo ignorado por 95% dos compradores de roupas 2D`);
    if (isVague) reasonsWhyItFails.push(`Título vago ("${name}"), invisível para quem pesquisa termos de estilo no Roblox`);
    if (isShortDesc) reasonsWhyItFails.push('Descrição curta sem bloco de tags (#y2k, #aesthetic) para o algoritmo do CAC');
    if (reasonsWhyItFails.length === 0) reasonsWhyItFails.push('Falta de conjunto combinado (venda como peça avulsa sem Top/Bottom)');

    let suggestedFix = 'Ajustar para 5 R$ e adicionar tags virais na descrição';
    if (isOverpriced && isVague) {
      suggestedFix = `Reduzir preço de ${price} R$ para 5 R$ e renomear para algo como "${name} Y2K Grunge Baggy Streetwear"`;
    } else if (isOverpriced) {
      suggestedFix = `Reduzir preço para 5 Robux para entrar nos filtros de pesquisa mais acessados`;
    } else if (isVague) {
      suggestedFix = `Expandir o título com estética e palavras-chave de nicho (ex: "${name} Aesthetic Y2K Vintage")`;
    } else if (isShortDesc) {
      suggestedFix = `Injetar bloco com 15 tags estratégicas (#y2k #grunge #aesthetic #baggy) na descrição`;
    }

    return {
      id: item.id,
      name,
      price,
      favorites,
      assetType,
      isSelling,
      reasonsForSuccess: reasonsForSuccess.length > 0 ? reasonsForSuccess : ['Boa apresentação visual'],
      reasonsWhyItFails,
      suggestedFix,
      hasIntentKeyword,
      isOverpriced,
      isVague,
      isShortDesc,
    };
  });

  const avgPrice = items.length > 0 ? Number((totalPrice / items.length).toFixed(1)) : 5;

  const sorted = [...analyzed].sort((a, b) => b.favorites - a.favorites);
  const topSelling = sorted.filter((i) => i.isSelling).slice(0, 6);
  const stagnant = sorted.filter((i) => !i.isSelling).slice(0, 6);

  const finalStagnant = stagnant.length > 0 ? stagnant : sorted.slice(-4);
  const finalTopSelling = topSelling.length > 0 ? topSelling : sorted.slice(0, 4);

  let healthScore = 75;
  if (items.length > 0) {
    const penaltyOverpriced = (overpricedCount / items.length) * 35;
    const penaltyVague = (vagueTitleCount / items.length) * 25;
    const penaltyDesc = (shortDescCount / items.length) * 15;
    healthScore = Math.max(15, Math.min(98, Math.round(100 - penaltyOverpriced - penaltyVague - penaltyDesc)));
  }

  let aiDiagnosis = '';
  try {
    const promptForGemini = `Você é o maior especialista em economia do catálogo do Roblox e consultor oficial de moda virtual.
Faça um diagnóstico cirúrgico do catálogo do grupo "${groupName}" (ID ${targetGroupId}, ${memberCount} membros) com base nestes dados reais coletados da API da Roblox:

DADOS ESTATÍSTICOS:
- Total de itens analisados: ${items.length}
- Preço médio: ${avgPrice} Robux (Preço padrão da comunidade para roupas 2D: 5 Robux)
- Itens com preço acima de 5 Robux (obstáculo de compra): ${overpricedCount}
- Itens com títulos vagos/incompletos: ${vagueTitleCount}
- Itens sem tags de SEO na descrição: ${shortDescCount}
- Score de Saúde do Catálogo: ${healthScore}/100

ITENS QUE MAIS VENDEM OU TÊM MAIOR ENGAJAMENTO:
${finalTopSelling.map((i) => `- "${i.name}" (${i.price} R$, ${i.favorites} favs, ${i.assetType})`).join('\n')}

ITENS PARADOS OU COM ZERO TRAÇÃO:
${finalStagnant.map((i) => `- "${i.name}" (${i.price} R$, ${i.favorites} favs, ${i.assetType})`).join('\n')}

ESTRUTURE SUA RESPOSTA EM 3 PARTES CLARAS:
1. 🏆 **POR QUE ALGUNS ITENS VENDEM:** Explique os fatores exatos que fazem os melhores itens converterem (palavras-chave no CAC, precificação a 5 R$, nichos em alta).
2. ⚠️ **POR QUE OUTROS ITENS NÃO VENDEM:** Destaque os 3 maiores gargalos das peças paradas (ex: preços a 6, 7 ou 10 R$ que afastam 95% do público, títulos como "dots" ou "sleep (g)" que são invisíveis na busca, e falta de tags virais).
3. 🚀 **PLANO DE RESGATE EM 3 ETAPAS:** O que o criador deve fazer hoje para reativar o catálogo e multiplicar suas vendas.

Responda em formato markdown profissional, assertivo e focado em lucro líquido de Robux.`;

    aiDiagnosis = await callGemini(promptForGemini, `Auditoria ao vivo do grupo ${groupName}`);
  } catch (err: any) {
    addLog('warn', 'GEMINI_DIAGNOSIS', `Fallback heurístico ativado: ${err.message}`);
    aiDiagnosis = `### 📊 Diagnóstico Estratégico de Catálogo: Grupo "${groupName}"

**Score de Saúde Comercial: ${healthScore}/100**
Analisamos ${items.length} peças do catálogo do seu grupo. Aqui está o motivo exato de por que algumas peças vendem e outras ficam totalmente paradas:

---

### 🏆 1. Por que os itens de sucesso vendem:
- **Preço no Piso Oficial (5 Robux):** As peças que respeitam o valor de 5 R$ não geram atrito psicológico no comprador do Roblox. Cerca de 95% dos jogadores usam o filtro de preço máximo de 5 R$ ao montar skins no *Catalog Avatar Creator (CAC)*.
- **Termos de Busca Ativos:** Títulos que contêm termos procurados (ex: *y2k, off shoulder, top, retro*) garantem indexação orgânica direta sem depender de anúncios caros.
- **Incentivo de Rank no Grupo:** Peças com chamada para ação ("Compre 5+ para cargo angel") aumentam o ticket médio e fidelizam membros.

---

### ⚠️ 2. Por que outros itens NÃO vendem (Gargalos Identificados):
1. **Preços Acima de 5 Robux (${overpricedCount} peças afetadas):** Roupas clássicas 2D listadas a 6, 7 ou 10 Robux perdem até 90% da visibilidade orgânica. A comunidade do Roblox raramente paga mais de 5 R$ por uma camisa comum.
2. **Títulos Vagos e Invisíveis (${vagueTitleCount} peças afetadas):** Nomes como *"dots"*, *"sleep (g)"* ou *"whatever"* não contêm nenhuma palavra que um jogador digita na barra de pesquisa. No algoritmo do Roblox, se a palavra-chave não está no título ou tags, o item é virtualmente inexistente.
3. **Falta de Tags Estruturadas (#SEO):** Peças com descrições curtas não aparecem nos feeds automatizados de avatares do CAC, perdendo milhares de impressões diárias.
4. **Venda Descasada (Falta de Conjunto):** Vender apenas camisas sem a calça/saia combinando reduz a chance de compra completa em mais de 70%.

---

### 🚀 3. Plano de Ação Imediato:
1. **Padronizar Todos os Preços para 5 Robux:** Ajuste imediato das peças acima de 5 R$ para destravar as compras por impulso.
2. **Renomear e Otimizar Tags:** Aplicar a IA de Otimização de Catálogo para renomear os itens vagos e injetar 15 tags virais na descrição.
3. **Completar os Conjuntos no Criador UGC:** Usar a aba de Criação com IA para gerar as calças e partes inferiores que combinam com suas camisas de melhor desempenho.`;
  }

  const actionPlan = [
    `Padronizar as ${overpricedCount} peças com preço acima de 5 R$ para o valor ideal de 5 Robux`,
    `Atualizar títulos vagos (${vagueTitleCount} peças) com palavras-chave de alta procura (Y2K, Grunge, Baggy, Cyber)`,
    `Injetar bloco de 15 tags virais nas descrições para indexação automática no Catalog Avatar Creator`,
    `Criar as peças complementares (calças/saias) das camisas mais vendidas para formar conjuntos completos`,
  ];

  addLog('success', 'GROUP_ANALYSIS', `Auditoria concluída com sucesso para "${groupName}". Score: ${healthScore}/100.`);

  return {
    group: {
      id: targetGroupId,
      name: groupName,
      memberCount,
      description: groupDesc,
    },
    metrics: {
      totalItems: items.length,
      sellingItemsCount: finalTopSelling.length,
      stagnantItemsCount: finalStagnant.length,
      totalFavorites,
      avgPrice,
      healthScore,
      overpricedCount,
      vagueTitleCount,
      shortDescCount,
    },
    topSellingItems: finalTopSelling.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      favorites: i.favorites,
      assetType: i.assetType,
      reasonsForSuccess: i.reasonsForSuccess,
    })),
    stagnantItems: finalStagnant.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      favorites: i.favorites,
      assetType: i.assetType,
      reasonsWhyItFails: i.reasonsWhyItFails,
      suggestedFix: i.suggestedFix,
    })),
    aiDiagnosis,
    actionPlan,
  };
}

// Call Google Gemini with full Persona, System Instructions, High Token Budget and Fallbacks
export async function callGemini(
  userPrompt: string,
  contextData: string = '',
  options: AiMessageOptions = {}
): Promise<string> {
  const { apiKey, model } = getGeminiConfig();

  const systemInstructionText = `Você é o estrategista de inteligência artificial de elite e consultor oficial de criadores de moda e UGC no Roblox dentro desta plataforma SaaS.

CONHECIMENTO GERAL DO NEGÓCIO & PLATAFORMA SAAS (MULTI-TENANT):
- Cada usuário/criador tem a sua própria marca, grupo e catálogo. NUNCA cite nomes de grupos de terceiros como se fossem o grupo padrão. Trate o usuário como dono do seu próprio império no Roblox.
- Missão: Acelerar vendas, volume de vendas e faturamento líquido em Robux (Roupas clássicas 2D e Acessórios UGC 3D).
- Preço padrão de Roupas 2D: 5 Robux por peça (mínimo do Roblox, maximiza volume e algoritmo de recomendação).
- Preços de Acessórios UGC 3D: Cabelos (~85 R$), Chapéus (~65 R$), Acessórios de Costas (~100 R$), gerando margens de lucro muito maiores.
- Meta Diária Recomendada: 1.000 Robux líquidos por dia.

A MATEMÁTICA REAL DA META DE 1.000 ROBUX LÍQUIDOS/DIA:
- Com roupas a 5 Robux:
  * Vendas Diretas no Catálogo (Roblox retém 30% padrão): o criador recebe 3,5 Robux líquidos por peça. Para atingir 1.000 Robux LÍQUIDOS por dia em vendas diretas, são necessárias **~286 vendas/dia** (286 × 3,5 R$ = 1.001 R$).
  * Vendas In-Game / Experiências (como Catalog Avatar Creator e Pls Donate): O dono da experiência ganha até 40% de comissão de afiliado, a plataforma Roblox retém 30%, e o criador original recebe apenas 30% (1,5 Robux líquido por peça de 5 R$). Se o volume vier majoritariamente do CAC, são necessárias **~350 a 500 vendas/dia** para bater a meta limpa.
  * Preços Regionais (Regional & Dynamic Pricing da Roblox): Os valores podem ser ajustados pela plataforma de acordo com a moeda e o poder de compra do país do usuário, gerando pequenas variações de receita líquida por transação.

SEU CONHECIMENTO COMPLETO SOBRE UGC NO ROBLOX (USER-GENERATED CONTENT):
1. **Diferença entre UGC 2D (Classic) e UGC 3D (Acessórios) e Taxas Atualizadas da Roblox**:
   - **UGC 2D Clássico**: Shirts, Pants e T-shirts aplicados na malha do avatar via template 2D (585×559 px).
     * ATUALIZAÇÃO DE TAXAS ROBLOX: O upload custa **80 Robux de taxa de upload/moderação** por envio + **10 Robux de Publishing Advance (adiantamento reembolsável ao vender)**, totalizando **90 Robux** para listar no catálogo.
     * Preço mínimo de venda continua sendo 5 Robux (com 3,5 Robux líquidos após a taxa de 30% da plataforma).
   - **UGC 3D (Acessórios & Layered Clothing)**: Cabelos, chapéus, asas, bolsas, óculos e roupas em camadas 3D modeladas no Blender. Requer conta verificada com ID + Roblox Premium/Plus.
2. **Custos, Regras e Preços Mínimos de UGC 3D**:
   - Taxa de Envio 3D: Custa **80 Robux de upload/moderação** (500 R$ para itens emissivos) + **Publishing Advance** (adiantamento de publicação reembolsável conforme as vendas atingem a cota, variando de ~750 a 4.000 Robux por categoria).
   - Preços Mínimos (Price Floors): Cabelos custam no mínimo ~85 Robux, chapéus ~65 Robux, acessórios de costas ~100 Robux, faces/máscaras ~40-60 Robux. A margem por venda é muito maior (ganha 70% de 85 Robux = ~60 Robux limpos por venda).
3. **UGC Limiteds (Edições Limitadas)**:
   - Itens com estoque finito (ex: apenas 500 ou 1.000 unidades disponíveis).
   - Geram escassez e FOMO (medo de perder).
   - **Royalties Secundários**: Toda vez que um jogador revende o seu item Limited no mercado do Roblox, você (o criador original) recebe 10% de comissão de todas as revendas para sempre!
4. **Ferramentas de Criação de UGC 3D**:
   - **Blender**: Software gratuito padrão da indústria para modelagem 3D, UV Unwrap e texturização.
   - **Roblox Studio**: Plugin nativo "Accessory Fitting Tool" para encaixar o modelo no avatar e "Avatar Setup" para Layered Clothing.
   - **Polígonos & Limites**: Máximo de 4.000 triângulos (tris) por acessório e textura de 1024×1024 px.
5. **Estratégia Híbrida de Escala**:
   - Fase 1: Dominar roupas 2D a 5 Robux para construir base de fãs, volume diário e capital de Robux.
   - Fase 2: Criar 1 a 2 acessórios 3D exclusivos do seu catálogo (ex: gorro beanie aesthetic, bolsa lateral y2k ou asas de anjo cyberpunk) a 65-85 Robux. Com apenas 12 vendas de um acessório 3D por dia, já bate 1.000 Robux diários!

SEU PLAYBOOK ESTRATÉGICO PARA BATER A META:
1. **Catalog Avatar Creator (CAC) — O Maior Canal Orgânico**:
   - Montar avatares completos (Community Outfits) dentro do jogo Catalog Avatar Creator combinando as peças do catálogo com tags virais (#y2k, #aesthetic, #streetwear, #coquette).
   - Publicar no CAC com o nome da sua marca. Os jogadores que experimentam o avatar compram todas as roupas com 1 clique direto no jogo!
2. **TikTok, Reels e YouTube Shorts (Vídeos de 10-15s)**:
   - Formatos virais: "Avatares Aesthetic por apenas 5 Robux no Roblox", "Looks combinando para casais/duos", "Steal My Fit".
   - Usar sons em alta no TikTok, gravar avatares andando no Roblox Studio ou Catalog Avatar Creator, e fixar o link do grupo e o ID da roupa nos comentários.
3. **Packs & Looks Combinando (Duo Fits / Matching)**:
   - Drops de peças duplas (ex: top feminino + calça cargo combinando, ou camisa de casal). Isso faz o mesmo cliente comprar 2 a 3 peças de uma vez (10 a 15 Robux por comprador).
4. **Gamificação de Cargos no Mural**:
   - Avisar no shout do grupo: "Compre 5+ roupas e comente no mural para ganhar o cargo VIP!". Isso eleva o ticket médio dos membros de 5 R$ para 25 R$ por pessoa.
5. **Cadência de Drops**:
   - Lançar 2 a 3 peças novas toda semana, com foco nas noites de sexta e sábado (pico de jogadores ativos no Roblox).

INSTRUÇÕES OBRIGATÓRIAS DE RESPOSTA:
- Use os DADOS REAIS FORNECIDOS NO CONTEXTO (nomes de peças, IDs, criadores, contagem de favoritos, preços e estatísticas de grupos).
- Responda SEMPRE de forma completa, estruturada e aprofundada. NUNCA pare ou corte a frase pela metade.
- NÃO use cabeçalhos de raciocínio, notas de sistema ou metadados. Responda direto ao criador.
- Use tom confiante, inteligente, estratégico, focado em vendas e lucro. Use bullet points e negrito para organizar as etapas.
${contextData ? '\nCONTEXTO REAL OBTIDO AO VIVO NO ROBLOX:\n' + contextData : ''}
${options.effort ? `\nNÍVEL DE ANÁLISE SOLICITADO: ${options.effort}.` : ''}
${options.attachments?.length ? '\nO usuário anexou imagens de referência. Analise o conteúdo visual delas junto com a pergunta e mencione observações concretas que estejam visíveis.' : ''}`;

  // Candidate models with fallback if primary is busy
  const candidateModels = Array.from(
    new Set([model, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash-preview'])
  );

  let lastError: any = null;

  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      addLog('info', 'GEMINI_CALL', `Consultando modelo ${m}...`);

      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstructionText }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              { text: userPrompt },
              ...(options.attachments || []).map((attachment) => ({
                inlineData: {
                  mimeType: attachment.mimeType,
                  data: attachment.data,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        addLog('warn', 'GEMINI_FALLBACK', `Instabilidade temporária no modelo ${m} (HTTP ${response.status}). Acionando redundância...`);
        lastError = new Error(`Falha no provedor de IA (código ${response.status})`);
        continue;
      }

      const data = await response.json();
      let reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        addLog('warn', 'GEMINI_FALLBACK', `Modelo ${m} não retornou texto válido.`);
        continue;
      }

      // Clean up any accidental meta text
      reply = reply
        .replace(/^\(?\(?[a-zA-Z\s\-]+persona[^\n]*\)?\*?\*?:?\n?/gi, '')
        .replace(/^(\*|\-)\s*tone:[^\n]*\n?/gim, '')
        .replace(/^(\*|\-)\s*inject[^\n]*\n?/gim, '')
        .trim();

      addLog('success', 'GEMINI_RESPONSE', `Resposta gerada com sucesso via ${m} (${reply.length} chars).`);
      return reply;
    } catch (err: any) {
      lastError = err;
      addLog('warn', 'GEMINI_FALLBACK', `Falha ao consultar ${m}: ${err.message}`);
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini respondeu.');
}

// ----------------------------------------------------
// EXECUTIVE REPORT GENERATOR FOR REPORTS TAB
// ----------------------------------------------------

export async function generateExecutiveMarketReport(customPrompt?: string): Promise<ExecutiveReportData> {
  addLog('info', 'AI_REPORT', 'Iniciando compilação do Relatório de Inteligência Executiva de Mercado...');

  const state = loadState();
  const cycle = latestCycle(state);
  const clusters = cycle?.clusters || [];

  // 1. Live market search for fresh trending benchmark
  const [clothingTrend, ugcTrend, topGroups] = await Promise.all([
    searchLiveRobloxCatalog({ keyword: 'aesthetic', category: 'Clothing', limit: 10 }),
    searchLiveRobloxCatalog({ keyword: 'aesthetic', category: 'Accessories', limit: 10 }),
    searchLiveRobloxGroups('clothing aesthetic', 6),
  ]);

  const marketContext = `DADOS DO MERCADO ROBLOX (TEMPO REAL):
- Total de Clusters Identificados no Catálogo: ${clusters.length}
- Clusters de Maior Destaque:
${clusters
  .slice(0, 8)
  .map(
    (c) =>
      `  * Nicho: "${c.label}" | Veredito: ${c.verdict} | Oportunidade: ${c.scores?.opportunity ?? 'N/A'} | Velocidade: ${c.scores?.velocity ?? 'N/A'}`
  )
  .join('\n')}

- Top Peças de Roupas 2D em Alta no Catálogo:
${clothingTrend.slice(0, 5).map((i) => `  * "${i.name}" por ${i.creatorName} (${i.price} R$, ${i.favoriteCount} favs, ID: ${i.id})`).join('\n')}

- Top Acessórios UGC 3D em Alta no Catálogo:
${ugcTrend.slice(0, 5).map((i) => `  * "${i.name}" por ${i.creatorName} (${i.price} R$, ${i.favoriteCount} favs, ID: ${i.id})`).join('\n')}

- Grupos Concorrentes/Referência no Mercado:
${topGroups.slice(0, 4).map((g) => `  * "${g.name}" (ID: ${g.id}) com ${g.memberCount.toLocaleString('pt-BR')} membros`).join('\n')}`;

  const reportPrompt = customPrompt || `Gere um RELATÓRIO EXECUTIVO DE INTELIGÊNCIA DE MERCADO (UGC & ROUPAS ROBLOX) profissional, acionável e estruturado para o criador.

O relatório deve conter as seguintes seções bem detalhadas:
1. 📊 **Panorama Geral do Mercado & Diagnóstico** (onde o volume está concentrado hoje e dinâmicas de 2D vs 3D).
2. 🚀 **Top 3 Nichos de Alta Oportunidade (Oceano Azul)** (nichos com alta procura e menor saturação de criadores concorrentes).
3. 💡 **Blueprints Prontos para Drops Imediatos (Próximas 48h)**:
   - Indicar 3 peças específicas para criar agora (1 Roupas 2D a 5 R$, 1 Par/Duo Fit e 1 Acessório UGC 3D a 65-85 R$).
   - Incluir nome ideal da peça, paleta de cores e tags SEO recomendadas.
4. 🏢 **Análise de Concorrentes & Estratégia de Grupo** (como os grupos líderes estão convertendo membros em clientes fiéis com cargos de mural e VIP).
5. 🎮 **Tática de Alavancagem no Catalog Avatar Creator (CAC)** (como montar outfits para gerar vendas automáticas in-game).

Use formatação rica em Markdown (negrito, listas, badges visuais com emojis e números concretos).`;

  const reportText = await callGemini(reportPrompt, marketContext, { effort: 'Profunda' });

  // Top niches for structured display
  const topNiches = clusters.slice(0, 4).map((c) => ({
    name: c.label,
    verdict: c.verdict,
    opportunity: Math.round((c.scores?.opportunity || 0.5) * 100),
    demand: (c.scores?.velocity || 0) > 0.5 ? 'Alta Aceleração' : 'Estável',
  }));

  const suggestedDrops = [
    {
      name: 'Y2K Cyberpunk Grunge Zip Hoodie',
      type: 'Classic Shirt (2D)',
      price: 5,
      tags: ['#y2k', '#grunge', '#streetwear', '#cyberpunk', '#robloxclothing', '#5robux'],
    },
    {
      name: 'Coquette Lace Velvet Corset & Skirt Duo',
      type: 'Classic Pants / Skirt (2D)',
      price: 5,
      tags: ['#coquette', '#lace', '#duofit', '#matching', '#aesthetic', '#cute'],
    },
    {
      name: 'Aesthetic Spooky Beanie with Silver Pins',
      type: 'Hat Accessory (UGC 3D)',
      price: 65,
      tags: ['#ugc', '#beanie', '#3daccessory', '#robloxugc', '#spooky', '#goth'],
    },
  ];

  return {
    report: reportText,
    generatedAt: new Date().toISOString(),
    topNiches,
    suggestedDrops,
  };
}

// ----------------------------------------------------
// AI MESSAGE PROCESSOR WITH DEEP ROBLOX LIVE SEARCH
// ----------------------------------------------------

export async function processAiMessage(
  userPrompt: string,
  options: AiMessageOptions = {}
): Promise<{
  reply: string;
  actionTaken?: string;
}> {
  const p = userPrompt.toLowerCase().trim();
  const promptSnippet = userPrompt.length > 25 ? `${userPrompt.slice(0, 25)}... (${userPrompt.length} chars)` : userPrompt;
  addLog('info', 'AI_PROMPT', `Prompt recebido: [${promptSnippet.replace(/[\r\n]+/g, " ")}]`);

  let contextData = '';
  let actionTaken: string | undefined;

  // Intent 0: Diagnóstico de Vendas do Grupo (Por que alguns itens vendem e outros não)
  if (
    p.includes('analis') ||
    p.includes('por que') ||
    p.includes('porque') ||
    p.includes('desempenho') ||
    p.includes('diagnostico') ||
    p.includes('diagnóstico') ||
    (p.includes('vende') && (p.includes('item') || p.includes('peça') || p.includes('roupa') || p.includes('grupo') || p.includes('não') || p.includes('nao') || p.includes('outros')))
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Diagnóstico Profundo de Vendas do Grupo (IA)');
    try {
      const analysis = await analyzeGroupSalesPerformance();
      actionTaken = 'analyze_group_sales';
      contextData = `DADOS REAIS DA AUDITORIA DE VENDAS DO GRUPO "${analysis.group.name}" (ID ${analysis.group.id}, ${analysis.group.memberCount} membros):
- Total de itens analisados: ${analysis.metrics.totalItems}
- Score de Saúde Comercial: ${analysis.metrics.healthScore}/100
- Preço Médio: ${analysis.metrics.avgPrice} Robux (Padrão da comunidade: 5 Robux)
- Peças com preço > 5 R$ (obstáculo grave de compra): ${analysis.metrics.overpricedCount}
- Peças com títulos vagos/invisíveis: ${analysis.metrics.vagueTitleCount}
- Peças sem tags de SEO na descrição: ${analysis.metrics.shortDescCount}

TOP ITENS COM MAIS TRAÇÃO / VENDAS:
${analysis.topSellingItems.map((i) => `* "${i.name}" (${i.price} R$, ${i.favorites} favs, ${i.assetType}) -> Motivo: ${i.reasonsForSuccess.join(', ')}`).join('\n')}

ITENS ESTAGNADOS / PARADOS (SEM VENDAS):
${analysis.stagnantItems.map((i) => `* "${i.name}" (${i.price} R$, ${i.favorites} favs, ${i.assetType}) -> Por que não vende: ${i.reasonsWhyItFails.join(', ')} | Correção sugerida: ${i.suggestedFix}`).join('\n')}

DIAGNÓSTICO ESTRATÉGICO COMPLETO:
${analysis.aiDiagnosis}`;
    } catch (err: any) {
      actionTaken = 'analyze_group_error';
      contextData = `Erro na auditoria do grupo: ${err.message}`;
    }
  }

  // Intent 1: Otimizar catálogo / descrições / tags
  else if (
    p.includes('otimiz') ||
    p.includes('descriç') ||
    p.includes('mudar') ||
    p.includes('tags')
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Otimização em Lote de Catálogo (SEO)');
    try {
      const result = await optimizeGroupCatalog();
      actionTaken = 'optimize_catalog';
      contextData = `AÇÃO REAL EXECUTADA NO ROBLOX: Otimização de Catálogo realizada com sucesso. Total de itens no grupo: ${result.total}, Itens atualizados com novas tags e ranks: ${result.updated}, Erros/alertas: ${result.errors}.`;
    } catch (err: any) {
      actionTaken = 'optimize_catalog_failed';
      contextData = `AÇÃO REAL: Tentativa de otimização falhou com o erro: ${err.message}.`;
    }
  }

  // Intent 2: Grupos no Roblox (Pesquisa Profunda de Grupos Concorrentes e Lojas)
  else if (
    p.includes('grupo') ||
    p.includes('concorrên') ||
    p.includes('concorrente') ||
    p.includes('marcas') ||
    p.includes('loja')
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Busca Profunda de Grupos no Roblox (Live API)');
    try {
      // Extract query term or default to relevant keywords
      let searchKeyword = 'clothing aesthetic';
      if (p.includes('y2k')) searchKeyword = 'y2k clothing';
      else if (p.includes('goth') || p.includes('emo')) searchKeyword = 'goth clothing';
      else if (p.includes('anime')) searchKeyword = 'anime clothing';
      else if (p.includes('streetwear')) searchKeyword = 'streetwear';
      else if (p.includes('ugc')) searchKeyword = 'ugc';

      const groups = await searchLiveRobloxGroups(searchKeyword, 8);
      actionTaken = 'search_groups_live';

      contextData = `BUSCA PROFUNDA DE GRUPOS AO VIVO NO ROBLOX (Termo: "${searchKeyword}"):
${groups
  .map(
    (g, idx) =>
      `${idx + 1}. "${g.name}" (ID: ${g.id}) | Membros: ${g.memberCount.toLocaleString('pt-BR')} | Descrição: "${g.description || 'Sem descrição'}"`
  )
  .join('\n')}

DADOS DE ESTRATÉGIA DE GRUPOS:
- Grupos líderes de moda utilizam mural ativo com rank VIP para quem compra 5+ peças.
- Foco em nomes limpos, estética visual bem definida e lançamentos frequentes para manter engajamento dos membros.`;
    } catch (err: any) {
      actionTaken = 'search_groups_error';
      contextData = `Erro ao buscar grupos ao vivo: ${err.message}`;
    }
  }

  // Intent 3: Roupas 2D / Catálogo / Camisas / Calças (Busca Profunda ao Vivo no Catálogo)
  else if (
    p.includes('roupa') ||
    p.includes('camisa') ||
    p.includes('calça') ||
    p.includes('shirt') ||
    p.includes('pants') ||
    p.includes('2d')
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Busca Profunda de Roupas 2D no Catálogo Roblox (Live API)');
    try {
      let keyword = 'aesthetic';
      if (p.includes('y2k')) keyword = 'y2k';
      else if (p.includes('goth') || p.includes('vamp')) keyword = 'goth';
      else if (p.includes('anime')) keyword = 'anime';
      else if (p.includes('cargo') || p.includes('baggy')) keyword = 'cargo';
      else if (p.includes('halloween')) keyword = 'halloween';

      const liveShirts = await searchLiveRobloxCatalog({ keyword, category: 'Clothing', limit: 10 });
      actionTaken = 'search_clothing_live';

      contextData = `BUSCA AO VIVO NO CATÁLOGO DO ROBLOX — ROUPAS 2D (Termo: "${keyword}"):
${liveShirts
  .slice(0, 8)
  .map(
    (i, idx) =>
      `${idx + 1}. "${i.name}" por ${i.creatorName} | Preço: ${i.price} R$ | Favoritos: ${i.favoriteCount?.toLocaleString('pt-BR')} | Link: ${i.url}`
  )
  .join('\n')}

INSIGHTS ESTRATÉGICOS:
- Peças com maior volume de favoritos combinam estilo clean, preço acessível de 5 R$ e títulos otimizados para busca.
- Looks combinando (top + calça) aumentam o ticket médio por comprador.`;
    } catch (err: any) {
      actionTaken = 'search_clothing_error';
      contextData = `Erro ao buscar catálogo de roupas: ${err.message}`;
    }
  }

  // Intent 4: UGC 3D / Acessórios / Cabelos / Chapéus (Busca Profunda ao Vivo)
  else if (
    p.includes('ugc') ||
    p.includes('3d') ||
    p.includes('cabelo') ||
    p.includes('hair') ||
    p.includes('chapéu') ||
    p.includes('hat') ||
    p.includes('acessóri')
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Busca Profunda de UGC 3D no Catálogo Roblox (Live API)');
    try {
      let keyword = 'aesthetic';
      if (p.includes('cabelo') || p.includes('hair')) keyword = 'hair';
      else if (p.includes('beanie') || p.includes('chapéu') || p.includes('hat')) keyword = 'hat';
      else if (p.includes('y2k')) keyword = 'y2k accessory';
      else if (p.includes('goth')) keyword = 'goth accessory';

      const liveAccessories = await searchLiveRobloxCatalog({ keyword, category: 'Accessories', limit: 10 });
      actionTaken = 'search_ugc_live';

      contextData = `BUSCA AO VIVO NO CATÁLOGO DO ROBLOX — ACESSÓRIOS UGC 3D (Termo: "${keyword}"):
${liveAccessories
  .slice(0, 8)
  .map(
    (i, idx) =>
      `${idx + 1}. "${i.name}" por ${i.creatorName} | Preço: ${i.price} R$ | Favoritos: ${i.favoriteCount?.toLocaleString('pt-BR')} | Link: ${i.url}`
  )
  .join('\n')}

INSIGHTS DE UGC 3D:
- Cabelos e chapéus têm o maior volume de busca no marketplace.
- Preço mínimo de cabelos é ~85 Robux e chapéus ~65 Robux, com retenção líquida de 70% para o criador (~60 e ~45 Robux por venda).`;
    } catch (err: any) {
      actionTaken = 'search_ugc_error';
      contextData = `Erro ao buscar catálogo UGC 3D: ${err.message}`;
    }
  }

  // Intent 5: Vendas, Faturamento, Robux
  else if (
    p.includes('quanto') ||
    p.includes('venda') ||
    p.includes('saldo') ||
    p.includes('robux') ||
    p.includes('faturamento') ||
    p.includes('ganh')
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Consulta Financeira e Vendas');
    try {
      const cookie = getCookie();
      if (cookie) {
        const dash = await buildDashboard(cookie);
        const today = dash.kpis?.todayRevenue ?? 0;
        const sales = dash.kpis?.todaySales ?? 0;
        const weekly =
          dash.weekly?.reduce((acc: number, cur: any) => acc + (cur.revenue || 0), 0) ?? 0;
        actionTaken = 'check_sales';
        contextData = `DADOS REAIS DE VENDAS: Faturamento hoje: ${today} Robux (${sales} vendas hoje). Faturamento dos últimos 7 dias: ${weekly} Robux. Total histórico: ${dash.kpis?.totalSales ?? 0} vendas.`;
      }
    } catch (err: any) {
      actionTaken = 'check_sales_error';
      contextData = `DADOS DE VENDAS: Erro ao consultar vendas: ${err.message}.`;
    }
  }

  // Intent 6: Tendências Gerais do Catálogo & Ideias de Drops
  else if (
    p.includes('tendênc') ||
    p.includes('alta') ||
    p.includes('criar') ||
    p.includes('drop') ||
    p.includes('ideia') ||
    p.includes('o que fazer')
  ) {
    addLog('info', 'AI_INTENT', 'Ação disparada: Análise Global de Tendências do Catálogo com Dados ao Vivo');
    try {
      const state = loadState();
      const cycle = latestCycle(state);
      const clusters = (cycle?.clusters || []).slice(0, 6);

      // Fetch live benchmark in parallel
      const [liveClothing, liveUgc] = await Promise.all([
        searchLiveRobloxCatalog({ keyword: 'aesthetic', category: 'Clothing', limit: 10 }),
        searchLiveRobloxCatalog({ keyword: 'aesthetic', category: 'Accessories', limit: 10 }),
      ]);

      actionTaken = 'catalog_trends_deep';
      contextData = `TENDÊNCIAS EM ALTA NO CATÁLOGO DO ROBLOX (RADAR ATIVO):
${clusters.map((c) => `- Nicho "${c.label}" (Veredito: ${c.verdict}, Oportunidade: ${c.scores?.opportunity ?? 'N/A'})`).join('\n')}

AMOSTRA DE BESTSELLERS AO VIVO:
- Roupas 2D:
${liveClothing.slice(0, 4).map((i) => `  * "${i.name}" por ${i.creatorName} (${i.favoriteCount} favs, ${i.price} R$)`).join('\n')}
- Acessórios 3D:
${liveUgc.slice(0, 4).map((i) => `  * "${i.name}" por ${i.creatorName} (${i.favoriteCount} favs, ${i.price} R$)`).join('\n')}`;
    } catch {}
  }

  // Now invoke Google Gemini with full context and strict persona
  try {
    const reply = await callGemini(userPrompt, contextData, options);
    return { reply, actionTaken };
  } catch (geminiError: any) {
    addLog('error', 'AI_PROCESSOR', `Fallback ativado devido a erro no Gemini: ${geminiError.message}`);
    if (contextData) {
      return {
        reply: `✨ **Dados em Tempo Real Obtidos no Roblox:**\n\n${contextData}\n\n*(Nota: O modelo Gemini reportou: ${geminiError.message})*`,
        actionTaken,
      };
    }
    return {
      reply: `⚠️ Desculpe, tive uma instabilidade temporária ao comunicar com o modelo de inteligência: **${geminiError.message}**.\nVerifique a aba **Status e logs** para mais detalhes.`,
      actionTaken: 'gemini_error',
    };
  }
}

export interface GeneratedUgcDesign {
  title: string;
  kind: 'shirt' | 'pants' | 'tshirt';
  price: number;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: 'solid' | 'stripes' | 'camo' | 'plaid' | 'grunge' | 'acid_wash' | 'stars';
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
  shirtStyle?: 'short_sleeve' | 'long_sleeve' | 'crop_top' | 'hoodie';
  graphicTheme?: string;
  graphicText?: string;
}

export interface GenerateUgcOptions {
  groupId?: number;
  groupName?: string;
  stylePreset?: string;
}

export async function generateUgcDesignData(
  userPrompt: string,
  attachments?: AiImageAttachment[],
  effort: string = 'Detalhada',
  options?: GenerateUgcOptions
): Promise<GeneratedUgcDesign> {
  const targetGroupName = options?.groupName?.trim() || '';
  const hasTargetGroup = Boolean(targetGroupName);
  const brandName = hasTargetGroup ? targetGroupName : 'sua loja';
  const stylePreset = options?.stylePreset || 'basic_casual';

  // 1. LIVE ROBLOX CATALOG RESEARCH
  // Extract core topic keyword from prompt to research real bestselling items
  const cleanSubject = userPrompt
    .toLowerCase()
    .replace(/cria(r)?|fazer|faz|falei|pra mim|roupa(s)?|calça(s)?|camisa(s)?|shirt(s)?|pants|tshirt|uma|um|cade|o|ai|por favor|quero|desenha(r)?|estilo|modelo/gi, ' ')
    .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  let searchKeyword = 'aesthetic roblox';
  const pLower = userPrompt.toLowerCase();
  if (pLower.includes('saia') || pLower.includes('skirt')) {
    if (pLower.includes('jirai')) searchKeyword = 'jirai kei skirt';
    else if (pLower.includes('plissada') || pLower.includes('pleated')) searchKeyword = 'pleated skirt';
    else if (pLower.includes('goth')) searchKeyword = 'goth skirt';
    else if (pLower.includes('y2k')) searchKeyword = 'y2k skirt';
    else searchKeyword = 'pleated skirt aesthetic';
  } else if (pLower.includes('calça') || pLower.includes('pants') || pLower.includes('cargo') || pLower.includes('baggy')) {
    if (pLower.includes('cargo')) searchKeyword = 'baggy cargo pants';
    else if (pLower.includes('y2k')) searchKeyword = 'y2k pants';
    else if (pLower.includes('goth')) searchKeyword = 'goth pants';
    else searchKeyword = 'baggy pants';
  } else if (pLower.includes('minion')) searchKeyword = 'minion';
  else if (pLower.includes('batman')) searchKeyword = 'batman';
  else if (pLower.includes('spider') || pLower.includes('aranha')) searchKeyword = 'spiderman';
  else if (pLower.includes('hello kitty') || pLower.includes('hellokitty')) searchKeyword = 'hello kitty';
  else if (pLower.includes('kuromi')) searchKeyword = 'kuromi';
  else if (pLower.includes('moletom') || pLower.includes('hoodie')) searchKeyword = 'oversized hoodie';
  else if (pLower.includes('cropped') || pLower.includes('crop')) searchKeyword = 'crop top';
  else if (pLower.includes('streetwear') || pLower.includes('y2k')) searchKeyword = 'y2k streetwear';
  else if (pLower.includes('anime')) searchKeyword = 'anime shirt';
  else if (pLower.includes('goth') || pLower.includes('gothic')) searchKeyword = 'goth clothing';
  else if (cleanSubject) searchKeyword = cleanSubject;

  let catalogResearch: Array<{ id: number; name: string; creatorName: string; favoriteCount: number; url: string }> = [];
  try {
    const rawCatalog = await searchLiveRobloxCatalog({
      keyword: searchKeyword,
      category: 'Clothing',
      limit: 10,
    });
    catalogResearch = rawCatalog
      .sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        name: item.name,
        creatorName: item.creatorName,
        favoriteCount: item.favoriteCount || 0,
        url: item.url,
      }));
  } catch (err: any) {
    addLog('warn', 'AI_UGC_RESEARCH', `Falha na pesquisa ao vivo de catálogo: ${err.message}`);
  }

  const catalogSummary = catalogResearch.length > 0
    ? catalogResearch.map((item, idx) => `${idx + 1}. "${item.name}" por ${item.creatorName} (${item.favoriteCount.toLocaleString()} favoritos)`).join('\n')
    : 'Nenhum item específico encontrado na busca rápida, usando tendências globais de vendas.';

  const prompt = `Você é um estilista sênior e diretor de moda Roblox Marketplace especializado em roupas clássicas 2D (585x559 px).

O usuário quer criar a seguinte peça:
"${userPrompt}"
${attachments?.length ? 'O usuário anexou fotos de referência. Analise minuciosamente os cortes, cores, caimento e detalhes da imagem.' : ''}

CONTEXTO DO CRIADOR & MULTI-GRUPOS:
- Loja/Grupo de Destino: ${hasTargetGroup ? `"${targetGroupName}" (ID: ${options?.groupId || 'N/A'})` : 'Loja pessoal do usuário'}
- Preset de Estilo Ativo: ${stylePreset}

TENDÊNCIAS EM ALTA NO CATÁLOGO ROBLOX PARA "${searchKeyword}":
${catalogSummary}

DIRETRIZES DE DESIGN TÉCNICO (MUITO IMPORTANTE):
1. IDENTIFICAÇÃO DO TIPO DE PEÇA:
   - SE FOR SAIA ("saia", "skirt", "plissada", "pleated", "jirai"):
     * kind: ESTRITAMENTE "pants" (no Roblox, saias são sempre do tipo Pants clássica 2D).
     * details: inclua sempre as características pedidas como "pleated-skirt", "safety-pin" (se pediu alfinete), "double-belt", "chains", "thigh-high-socks", "lace-trim".
     * theme: "jirai_kei", "goth" ou "y2k".
     * pattern: "pleated".
   - SE FOR CALÇA ("calça", "pants", "cargo", "baggy", "jeans"):
     * kind: "pants".
     * details: ["baggy-cargo", "side-pockets", "straps", "chains"].
   - SE FOR CAMISA/PARTE DE CIMA ("camisa", "shirt", "t-shirt", "moletom", "cropped", "jaqueta"):
     * kind: "shirt" (ou "tshirt" apenas se for estampa pura).
     * shirtStyle: "short_sleeve", "long_sleeve", "crop_top" ou "hoodie" conforme o pedido.

2. NENHUMA MENÇÃO A TERCEIROS:
   - O sistema é 100% universal para a loja do criador: "${brandName}".
   - NUNCA mencione grupos ou lojas de terceiros nos títulos ou descrições.
   - A descrição DEVE dar boas-vindas para o grupo/loja DELE:
     * Com grupo: "♡ Welcome to ${targetGroupName} !" e "♡ Buy 5+ clothes for special member rank rewards in our group!"
     * Sem grupo: "♡ Welcome to my Roblox store !" e "♡ Buy 5+ clothes to support our drops!"
   - A tag do grupo deve ser incluída em minúsculo: "${hasTargetGroup ? targetGroupName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'roblox'}".

3. PREÇO: ESTRITAMENTE 5 Robux (padrão oficial clássico para estimular compras em lote).

4. RESPOSTA AO USUÁRIO (reply):
   Em português NATURAL, DIRETO E HUMANO.
   NUNCA use frases robóticas ou clichês de IA como "🔍 Pesquisei as tendências do catálogo e criei a peça...".
   Responda de forma profissional e direta destacando os detalhes que você aplicou na peça.
   Exemplo: "Desenvolvi a [Nome da Peça] com pregas plissadas, cinto duplo e alfinetes de segurança no estilo Jirai Kei pronta para sua loja!"

5. TEMAS E PERSONAGENS:
   - Jirai Kei / Goth: primaryColor: "#111111", accentColor: "#e4e4e7", theme: "jirai_kei", pattern: "pleated", details: ["pleated-skirt", "safety-pin", "double-belt", "chains", "thigh-high-socks"]
   - Minions: primaryColor: "#111111" ou "#facc15", graphicTheme: "minion_face", details: ["short-sleeve", "crewneck", "minion-graphic"]
   - Batman: primaryColor: "#0f172a", graphicTheme: "batman_logo", details: ["short-sleeve", "crewneck", "batman-logo"]
   - Spiderman: primaryColor: "#111111" ou "#dc2626", graphicTheme: "spider_logo", details: ["short-sleeve", "crewneck", "spider-logo"]
   - Hello Kitty: primaryColor: "#ffffff" ou "#111111", graphicTheme: "hellokitty", details: ["short-sleeve", "crewneck", "hellokitty-graphic"]
   - Y2K / Streetwear: primaryColor: "#111111", graphicTheme: "chain_necklace", details: ["chains", "streetwear"]

RETORNE ESTRITAMENTE UM JSON VÁLIDO no seguinte formato (sem texto adicional fora do JSON):
{
  "title": "⋆ ˚｡⋆୨୧˚ jirai kei pleated skirt w/ safety pin ˚୨୧⋆｡˚ ⋆",
  "kind": "shirt" | "pants" | "tshirt",
  "shirtStyle": "short_sleeve" | "long_sleeve" | "crop_top" | "hoodie",
  "price": 5,
  "theme": "jirai_kei" | "goth" | "streetwear" | "y2k" | "coquette" | "casual",
  "graphicTheme": "chain_necklace" | "safety_pin" | "none",
  "graphicText": "",
  "primaryColor": "#111111",
  "secondaryColor": "#18181b",
  "accentColor": "#e4e4e7",
  "pattern": "pleated" | "solid" | "stripes" | "grunge" | "stars",
  "details": ["pleated-skirt", "safety-pin", "double-belt", "chains"],
  "description": "...",
  "reply": "Desenvolvi a [Nome da Peça] com pregas plissadas, cinto duplo e alfinetes de segurança pronta para a sua loja!"
}`;

  try {
    const rawAi = await callGemini(prompt, '', { effort: effort as any, attachments });
    const jsonMatch = rawAi.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title && parsed.kind) {
        return {
          title: parsed.title,
          kind: ['shirt', 'pants', 'tshirt'].includes(parsed.kind) ? parsed.kind : 'shirt',
          shirtStyle: parsed.shirtStyle || 'short_sleeve',
          price: 5,
          theme: parsed.theme || 'casual',
          graphicTheme: parsed.graphicTheme || (pLower.includes('minion') ? 'minion_face' : undefined),
          graphicText: parsed.graphicText || '',
          primaryColor: parsed.primaryColor || '#111111',
          secondaryColor: parsed.secondaryColor || '#27272a',
          accentColor: parsed.accentColor || '#f472b6',
          pattern: parsed.pattern || 'solid',
          details: Array.isArray(parsed.details) ? parsed.details : ['short-sleeve', 'crewneck'],
          description: parsed.description || generateEnhancedSeoDescription(parsed.title, undefined, targetGroupName),
          reply: parsed.reply || `Desenvolvi a peça **${parsed.title}** personalizada para sua loja!`,
          catalogResearch,
        };
      }
    }
  } catch (err: any) {
    addLog('warn', 'AI_UGC_CREATE', `Gemini fallback para criação UGC: ${err.message}`);
  }

  // High-fidelity algorithmic fallback tuned for basic shirts and live catalog results
  const p = userPrompt.toLowerCase();
  const isPants = p.includes('calça') || p.includes('pants') || p.includes('cargo') || p.includes('saia') || p.includes('skirt');
  const isTshirt = p.includes('tshirt') || p.includes('estampa') || p.includes('decal');
  const kind = isPants ? 'pants' : isTshirt ? 'tshirt' : 'shirt';
  const shirtStyle: 'short_sleeve' | 'long_sleeve' | 'crop_top' | 'hoodie' =
    p.includes('moletom') || p.includes('hoodie') ? 'hoodie' :
    p.includes('longa') || p.includes('long sleeve') ? 'long_sleeve' :
    p.includes('cropped') || p.includes('crop') ? 'crop_top' : 'short_sleeve';

  let title = `⋆ ˚｡⋆୨୧˚ basic aesthetic tee black ˚୨୧⋆｡˚ ⋆`;
  let theme = 'casual';
  let details = ['short-sleeve', 'crewneck'];
  let primaryColor = '#111111';
  let secondaryColor = '#27272a';
  let accentColor = '#e4e4e7';
  let pattern: 'solid' | 'stripes' | 'camo' | 'plaid' | 'grunge' | 'acid_wash' | 'stars' = 'solid';
  let graphicTheme: string = 'chain_necklace';

  if (p.includes('minion')) {
    title = isPants ? `minion denim classic pants` : `⋆ ˚｡⋆୨୧˚ minion cute basic tee ˚୨୧⋆｡˚ ⋆`;
    theme = 'minion';
    graphicTheme = 'minion_face';
    details = ['short-sleeve', 'crewneck', 'minion-graphic'];
    primaryColor = '#111111';
    secondaryColor = '#1f2937';
    accentColor = '#facc15';
    pattern = 'solid';
  } else if (p.includes('batman')) {
    title = `batman classic basic logo tee (black)`;
    theme = 'batman';
    graphicTheme = 'batman_logo';
    details = ['short-sleeve', 'crewneck', 'batman-logo'];
    primaryColor = '#0f172a';
    secondaryColor = '#1e293b';
    accentColor = '#facc15';
    pattern = 'solid';
  } else if (p.includes('spiderman') || p.includes('spider') || p.includes('aranha')) {
    title = `spiderman web classic basic tee`;
    theme = 'spiderman';
    graphicTheme = 'spider_logo';
    details = ['short-sleeve', 'crewneck', 'spider-logo'];
    primaryColor = '#111111';
    secondaryColor = '#1e1b4b';
    accentColor = '#dc2626';
    pattern = 'solid';
  } else if (p.includes('hello kitty') || p.includes('hellokitty')) {
    title = `⋆ ˚｡⋆୨୧˚ hello kitty cute basic tee ˚୨୧⋆｡˚ ⋆`;
    theme = 'coquette';
    graphicTheme = 'hellokitty';
    details = ['short-sleeve', 'crewneck', 'hellokitty-graphic'];
    primaryColor = '#ffffff';
    secondaryColor = '#f4f4f5';
    accentColor = '#ef4444';
  } else if (p.includes('kuromi')) {
    title = `kuromi dark basic aesthetic tee`;
    theme = 'goth';
    graphicTheme = 'kuromi';
    details = ['short-sleeve', 'crewneck', 'kuromi-graphic'];
    primaryColor = '#09090b';
    secondaryColor = '#18181b';
    accentColor = '#f472b6';
  } else if (p.includes('cat') || p.includes('gato') || p.includes('gatinho')) {
    title = `⋆ ˚｡⋆୨୧˚ cute cat basic pocket tee ˚୨୧⋆｡˚ ⋆`;
    theme = 'casual';
    graphicTheme = 'cat';
    details = ['short-sleeve', 'crewneck', 'cat-graphic'];
    primaryColor = '#18181b';
    accentColor = '#ffffff';
  } else if (p.includes('streetwear') || p.includes('y2k') || p.includes('hood')) {
    title = `─── ⋆⋅☆⋅⋆ ── y2k vintage basic tee ── ⋆⋅☆⋅⋆ ───`;
    theme = 'streetwear';
    graphicTheme = 'chain_necklace';
    details = ['short-sleeve', 'crewneck', 'chains'];
    primaryColor = '#111111';
    secondaryColor = '#18181b';
    accentColor = '#d4d4d8';
  } else if (isPants) {
    if (p.includes('saia') || p.includes('skirt')) {
      title = `⋆ ˚｡⋆୨୧˚ pleated skirt with pins ˚୨୧⋆｡˚ ⋆`;
      theme = 'casual';
      details = ['pleated-skirt', 'safety-pins'];
      accentColor = '#e4e4e7';
    } else {
      title = `─── ⋆⋅☆⋅⋆ ── baggy cargo alt pants ── ⋆⋅☆⋅⋆ ───`;
      theme = 'y2k';
      details = ['pockets', 'chains'];
      accentColor = '#d4d4d8';
    }
  }

  const cleanInput = userPrompt.replace(/cria|fazer|roupa|calça|camisa|uma|pra mim/gi, '').trim();
  if (cleanInput.length > 2 && !cleanInput.includes('http')) {
    if (isPants) {
      if (p.includes('saia') || p.includes('skirt')) {
        title = `⋆ ˚｡⋆୨୧˚ ${cleanInput.slice(0, 32)} skirt ˚୨୧⋆｡˚ ⋆`;
      } else {
        title = `─── ⋆⋅☆⋅⋆ ── ${cleanInput.slice(0, 32)} baggy pants ── ⋆⋅☆⋅⋆ ───`;
      }
    } else {
      title = `⋆ ˚｡⋆୨୧˚ ${cleanInput.slice(0, 32)} ˚୨୧⋆｡˚ ⋆`;
    }
  }

  const researchReply = isPants
    ? (p.includes('saia') || p.includes('skirt')
        ? `Desenvolvi a **${title}** com pregas plissadas, alfinetes de segurança e cinto duplo Y2K pronta para a sua loja!`
        : `Desenvolvi a **${title}** com caimento baggy streetwear, bolsos utilitários e correntes metálicas pronta para a sua loja!`)
    : `Desenvolvi a **${title}** com acabamento de alta definição para o catálogo Roblox por 5 Robux!`;

  return {
    title,
    kind,
    shirtStyle,
    price: 5,
    theme,
    graphicTheme,
    primaryColor,
    secondaryColor,
    accentColor,
    pattern,
    details,
    catalogResearch,
    description: generateEnhancedSeoDescription(title, undefined, targetGroupName),
    reply: researchReply,
  };
}
