import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState, latestCycle } from './store.js';
import { buildDashboard } from './dashboard.js';
import { lookupGroupStore } from './lookup.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const accountPath = path.join(rootDir, 'data', 'account.json');
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
    if (!fs.existsSync(accountPath)) return null;
    const acc = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
    return acc?.cookie || null;
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

// Enhanced Algorithmic Fallback Description Generator
export function generateEnhancedSeoDescription(title: string, assetType?: number | string): string {
  const t = title.toLowerCase();
  const isUgc =
    Number(assetType) >= 41 ||
    t.includes('hair') ||
    t.includes('cabelo') ||
    t.includes('hat') ||
    t.includes('beanie');

  let header = `⚡ ${title} ⚡`;
  let intro = 'Design exclusivo com caimento impecável para destacar seu avatar no Roblox.';
  let tags: string[] = ['#roblox', '#aesthetic', '#trendy', '#outfit', '#catalogavatarcreator'];

  if (t.includes('goth') || t.includes('vamp') || t.includes('emo') || t.includes('dark') || t.includes('skull')) {
    header = `🕷️ ${title} 🕷️`;
    intro = 'Estética gótica e sombria com textura premium. Perfeito para avatares dark e misteriosos.';
    tags.push('#goth', '#gothic', '#vampire', '#emo', '#grunge', '#drain', '#opium', '#altfashion', '#darkaesthetic');
  } else if (t.includes('cute') || t.includes('coquette') || t.includes('pink') || t.includes('sanrio') || t.includes('kawaii') || t.includes('bow')) {
    header = `୨୧ ${title} ୨୧`;
    intro = 'Super fofo e delicado com detalhes adoráveis. Combine para montar o look dos seus sonhos.';
    tags.push('#coquette', '#cute', '#kawaii', '#pastel', '#cutecore', '#softgirl', '#sanrio', '#ribbon', '#girly');
  } else if (t.includes('cargo') || t.includes('baggy') || t.includes('jeans') || t.includes('streetwear') || t.includes('hoodie')) {
    header = `🔥 ${title} 🔥`;
    intro = 'Caimento baggy e streetwear moderno de alta fidelidade. O fit essencial para qualquer drop.';
    tags.push('#streetwear', '#baggy', '#cargopants', '#hoodie', '#drip', '#oversized', '#urban', '#trifting');
  } else if (t.includes('cyber') || t.includes('y2k') || t.includes('star') || t.includes('retro')) {
    header = `⭐ ${title} ⭐`;
    intro = 'Vibe anos 2000 nostálgica e autêntica. Linhas limpas e presença marcante em qualquer jogo.';
    tags.push('#y2k', '#cyberpunk', '#2000s', '#mcbling', '#star', '#vintage', '#retroaesthetic', '#y2koutfit');
  } else {
    tags.push('#aesthetic', '#fashion', '#robloxfashion', '#cool', '#vibes', '#robloxtrend');
  }

  if (isUgc) {
    tags.push('#ugc', '#robloxugc', '#3daccessory', '#ugcitem');
  } else {
    tags.push('#5robux', '#cheapclothing', '#classicclothing');
  }

  const uniqueTags = Array.from(new Set(tags)).slice(0, 14);

  return `${header}

[🖤] • ${intro}
[✨] • Experimente agora mesmo no Catalog Avatar Creator (CAC) antes de comprar!
[💎] • Compre 5+ peças da nossa loja e comente no mural do grupo para garantir seu rank VIP!

${uniqueTags.join(' ')}`;
}

// Backward compatibility alias
export function generateSeoDescription(title: string, assetType?: number | string): string {
  return generateEnhancedSeoDescription(title, assetType);
}

// Ultra-Intelligent AI Description Generator (Powered by Gemini)
export async function generateAiItemDescription(
  title: string,
  assetType?: number | string,
  styleHint?: string
): Promise<string> {
  const isUgc =
    Number(assetType) >= 41 ||
    String(title).toLowerCase().includes('hair') ||
    String(title).toLowerCase().includes('cabelo') ||
    String(title).toLowerCase().includes('hat');

  const typeStr = isUgc ? 'Acessório UGC 3D' : 'Roupa Clássica 2D';

  const prompt = `Você é um copywriter de elite e especialista em SEO para o marketplace do Roblox.
Crie uma descrição de ALTA CONVERSÃO para o seguinte item de moda no Roblox:
- Peça: "${title}"
- Tipo: ${typeStr}
${styleHint ? `- Estilo sugerido: ${styleHint}` : ''}

DIRETRIZES DA DESCRIÇÃO:
1. Comece com um cabeçalho estético com o nome da peça e emojis/símbolos combinando com a vibe (ex: se for gótico/dark use ⚡/🖤/🕷️; se for cute/coquette use ୨୧/🎀/✨; se for streetwear/y2k use 💫/⭐/🔥).
2. Mini-parágrafo elegante (1-2 frases) destacando o design, caimento e autenticidade da peça.
3. Call to Action estratégica: incentive a testar no Catalog Avatar Creator (CAC) e a adquirir a peça para receber cargo/rank VIP no mural do grupo.
4. Bloco com 10 a 14 hashtags virais (#) altamente buscadas no catálogo do Roblox que combinem especificamente com a peça, cores e estilo.
5. Retorne APENAS a descrição final formatada, pronta para publicação no Roblox. Sem notas ou textos de sistema.`;

  try {
    const aiText = await callGemini(prompt, '', { effort: 'Rápida' });
    if (aiText && aiText.trim().length >= 35) {
      return aiText.trim();
    }
  } catch (err: any) {
    addLog('warn', 'AI_DESC_FALLBACK', `Gemini ocupado para "${title}": ${err.message}. Usando motor estético inteligente.`);
  }

  return generateEnhancedSeoDescription(title, assetType);
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
      const acc = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
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

      addLog('info', 'SEO_OPTIMIZE', `🤖 Gerando descrição de alta conversão com IA para "${asset.Name}" [ID: ${item.id}]...`);
      const newDesc = await generateAiItemDescription(asset.Name, asset.AssetTypeId);

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

  // Intent 1: Otimizar catálogo / descrições / tags
  if (
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
