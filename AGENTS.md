# AGENTS.md — Farol (Illusions AI) & Desktop App

Este documento contém todo o conhecimento arquitetural, operacional e funcional do **Farol** para que o assistente Antigravity conheça e opere perfeitamente o aplicativo.

---

## 1. Visão Geral do Projeto

* **Nome do Projeto**: Farol (também referenciado como Illusions AI).
* **Propósito**: Plataforma all-in-one para criadores, designers UGC e operadores de lojas e frotas no Roblox. Permite criação, ripping/cópia, otimização SEO com IA, validação 3D pré-upload, publicação direta na API do Roblox e gestão de catálogo.
* **Repositórios/Diretórios**:
  * `farol/`: Código-fonte principal da aplicação e aplicativo desktop Electron.
  * `farol-deploy/`: Espelho de deploy e produção sincronizado com o repositório remoto GitHub (`pivetecapudoff-max/newweb`). **Todas as alterações feitas em `farol` devem ser sincronizadas com `farol-deploy`**.

---

## 2. Aplicativo Desktop (`farol/desktop`)

O Farol possui um aplicativo desktop nativo empacotado em **Electron**:

* **Executável / Launcher**: `farol/Farol.bat` (roda `npm run app`).
* **Estrutura Desktop**:
  * `farol/desktop/main.mjs`: Script principal do Electron.
    * Inicializa o backend TypeScript (`npx tsx server/index.ts`) na porta `8788`.
    * Inicializa o frontend Vite (`npx vite --host 127.0.0.1 --port 5174`).
    * Aguarda o probe de liveness em `http://127.0.0.1:5174/api/status`.
    * Cria a `BrowserWindow` com resolução 1440x920, fundo AMOLED `#02010A`, `contextIsolation: true` e `nodeIntegration: false`.
    * Abre direto na rota `/painel/upload`.
  * `farol/desktop/preload.cjs`: Bridge seguro de IPC para o contexto do navegador.
* **Comandos do Desktop**:
  * Iniciar app desktop: `Farol.bat` ou `npm run app` dentro de `farol/`.
  * Iniciar stack dev comum: `npm run dev` (roda `concurrently` servidor + web).

---

## 3. Módulos & Funcionalidades Principais

### A. Publicar UGC 3D (Pipeline Tectonic)
* **Localização**: `src/pages/UploadPage.tsx` (Aba: **Publicar UGC 3D (Tectonic)**).
* **Equiparado a**: Tectonic da Avalanche Labs (`avalanchelabs.cc/tectonic`).
* **Pipeline de 5 Estágios**:
  1. **Ingest**: Suporte a drag-and-drop de arquivos `.obj`, `.mesh` e texturas `.png`/`.jpg`.
  2. **Pre-Flight Validator**:
     * **Triangle Budget**: Limite oficial de 4.000 triângulos para acessórios rígidos. Medidor visual em tempo real com status `PASS` ou `OVER BUDGET`.
     * **Texture Compliance**: Teto de 1024×1024 px e proporção 1:1.
     * **Bounding Box**: Dimensões reais em studs (`width × height × depth`) conforme o slot.
     * **UV Integrity**: Validação das coordenadas UV [0, 1].
     * **Rejeição Local**: Avisa antes do envio para não queimar Robux na API.
  3. **Auto-Repair Suite**:
     * Decimação inteligente por agrupamento de vértices (`vertex clustering`) mantendo a silhueta da malha para < 4.000 triângulos.
     * Redimensionamento automático de texturas 2K/4K para 1024px.
  4. **Attachment Solver & Multi-Body Fitting**:
     * Resolução automática do socket (`HatAttachment`, `HairAttachment`, `FaceFrontAttachment`, `NeckAttachment`, etc.) sem precisar abrir o Roblox Studio.
     * Seletor de preview multi-corpo: **Classic (R6/R15 Blocky)**, **Slender** e **Rthro**.
  5. **Fee Ledger & Economics**:
     * Taxa de publicação (750 R$ ou taxa de Limited).
     * Calculadora de Break-Even de vendas para cobrir o custo e gerar lucro líquido (70%).
     * Desk de UGC Limiteds com controle de estoque total.

### B. Copy & Cloner de Catálogo (Avalanche Cloner)
* **Localização**: `src/pages/CopyPage.tsx` e `server/copy.ts`.
* **Equiparado a**: Template Copying & Cloning do Avalanche.
* **Recursos**:
  * Ripa roupas 2D clássicas (molde 585×559) e acessórios UGC 3D (.OBJ, .MTL e .PNG).
  * **Visualização no Avatar Roblox**: Roupas clássicas renderizam no `RobloxAvatar3D` autêntico.
  * **Mutação Anti-Ban de Hash (Escalating Image Mutation)**: Micro-alteração de pixels e carimbo EXIF que gera um novo hash SHA-256 para evitar ban por cópia duplicada.
  * **Pipeline Direto em 1 Clique**:
    * Botão "Enviar para Publicar Roupa (2D)": Transfere template para publicação 2D.
    * Botão "Enviar para Publicar UGC 3D (Tectonic)": Transfere OBJ e textura direto para o Pre-Flight Validator.

### C. Avatar 3D Autêntico do Roblox (`RobloxAvatar3D.tsx`)
* **Localização**: `src/components/RobloxAvatar3D.tsx`.
* **Características**:
  * **Sem studs/pinos de Lego na cabeça**: Proporções e curvatura oficial de SpecialMesh do Roblox.
  * **Face Oficial**: Decal frontal com o sorriso clássico extraído da instalação oficial do Roblox (`public/roblox_face.png`).
  * **Alternador R6 & R15**:
    * **R6**: 6 partes em bloco clássico.
    * **R15**: 15 partes articuladas com pose idle relaxada oficial do Roblox.
  * **Mapeamento UV**: Mapeamento 585×559 perfeitamente alinhado em ambos os rigs.

### D. Identidade Visual AMOLED & Efeitos Neon
* **Fundo**: Preto absoluto AMOLED `#000000` (cards em `#0a0a0a` e `#0f0f0f`).
* **Cores de Destaque**: Azul cyber `#2563eb`, `#3b82f6` e `#60a5fa`.
* **Classes Globais de Efeito**:
  * `.text-shiny-blue`: Gradiente azul animado em loop correndo pelo texto.
  * `.blur-glow-aura`: Aura neon azulada com desfoque de 24px posicionada atrás dos títulos.

---

## 4. Regras Obrigatórias para o Agente

1. **Sempre sincronizar `farol` e `farol-deploy`**: Qualquer alteração em `farol/` deve ser imediatamente copiada para `farol-deploy/` e verificada com `npm run build`.
2. **Respostas Diretas**: Falar de forma objetiva, em português, sem rodeios ou loops infinitos de análise.
3. **Preservar Assets Oficiais**: Nunca substituir o `RobloxAvatar3D` por bonecos genéricos tipo Lego.
