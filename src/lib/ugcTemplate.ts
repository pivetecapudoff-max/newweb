// Roblox Official 2D Clothing Template Generator (585 x 559 px) & 3D Avatar Preview
export type UgcClothingKind = "shirt" | "pants" | "tshirt";

export interface UgcDesignSpec {
  title: string;
  kind: UgcClothingKind;
  shirtStyle?: "short_sleeve" | "long_sleeve" | "crop_top" | "hoodie";
  price: number;
  description: string;
  tags: string[];
  theme: string;
  graphicTheme?: string;
  graphicText?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern?: "solid" | "stripes" | "camo" | "plaid" | "grunge" | "acid_wash" | "stars";
  details?: string[];
  referenceImageDataUrl?: string;
}

export interface UgcRenderResult {
  templateDataUrl: string;
  avatarPreviewDataUrl: string;
}

/**
 * Generates both the pixel-accurate Roblox 585x559 template AND a realistic 3D avatar preview
 */
export async function renderRobloxTemplate(spec: UgcDesignSpec): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 585;
  canvas.height = 559;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D Canvas context.");

  // Clear with 100% transparency
  ctx.clearRect(0, 0, 585, 559);

  if (spec.kind === "tshirt") {
    return renderTshirtGraphic(spec);
  }

  if (spec.kind === "shirt") {
    await renderClassicRobloxShirt(ctx, spec);
  } else {
    await renderClassicRobloxPants(ctx, spec);
  }

  return canvas.toDataURL("image/png");
}

/**
 * Renders an authentic, wearable, clean Roblox Classic Shirt
 * Short sleeves default: forearms and hands are 100% transparent for avatar skin.
 * Crewneck collar with clean circular neck cutout on Torso_Top and front scoop.
 */
async function renderClassicRobloxShirt(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const baseColor = spec.primaryColor || "#111111";
  const collarColor = spec.secondaryColor || "#1f2937";
  const stitchColor = spec.accentColor || "#e4e4e7";
  const style = spec.shirtStyle || "short_sleeve";
  const isCrop = style === "crop_top";
  const isLong = style === "long_sleeve" || style === "hoodie";

  // 1. TORSO
  const tx = 231;
  const ty = 138;
  const torsoHeight = isCrop ? 76 : 128;

  // A. Torso_Top (231, 74, 128, 64) - Shoulders & Neck Hole
  ctx.fillStyle = baseColor;
  ctx.fillRect(231, 74, 128, 64);
  applyFabricTexture(ctx, 231, 74, 128, 64);

  // Cut transparent circular neck hole at center (295, 106)
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(295, 106, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw collar ribbing ring around neck hole
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(295, 106, 19.5, 0, Math.PI * 2);
  ctx.stroke();

  // Shoulder seam stitch lines
  drawDoubleStitch(ctx, 231, 75, 64, false, stitchColor);
  drawDoubleStitch(ctx, 358, 75, 64, false, stitchColor);

  // B. Torso_Front (231, 138, 128, torsoHeight)
  ctx.fillStyle = baseColor;
  ctx.fillRect(tx, ty, 128, torsoHeight);
  applyFabricTexture(ctx, tx, ty, 128, torsoHeight);

  // Crewneck scoop cutout at top center of front torso
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(295, 138, 18, 7, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // Crewneck ribbing trim along front scoop
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(295, 138, 19, 8, 0, 0, Math.PI);
  ctx.stroke();

  // C. Torso_Back (423, 138, 128, torsoHeight)
  ctx.fillStyle = baseColor;
  ctx.fillRect(423, ty, 128, torsoHeight);
  applyFabricTexture(ctx, 423, ty, 128, torsoHeight);

  // Subtle back collar trim curve
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(487, 138, 16, 3, 0, 0, Math.PI);
  ctx.stroke();

  // D. Torso_Left (367, 138, 64, torsoHeight) & Torso_Right (159, 138, 64, torsoHeight)
  for (const sx of [159, 367]) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(sx, ty, 64, torsoHeight);
    applyFabricTexture(ctx, sx, ty, 64, torsoHeight);
    // Armpit fold shading
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(sx, ty, 4, 20);
    ctx.fillRect(sx + 60, ty, 4, 20);
  }

  // E. Waist Hem: Double-needle stitched hem across bottom of torso
  const hemY = ty + torsoHeight - 3;
  for (const part of [{ x: 159, w: 64 }, { x: 231, w: 128 }, { x: 367, w: 64 }, { x: 423, w: 128 }]) {
    drawDoubleStitch(ctx, part.x, hemY, part.w, true, stitchColor);
  }

  // 2. ARMS & SLEEVES
  // Shoulder tops (R_Top: 85, 342, 64, 64 | L_Top: 341, 342, 64, 64)
  ctx.fillStyle = baseColor;
  ctx.fillRect(85, 342, 64, 64);
  ctx.fillRect(341, 342, 64, 64);
  applyFabricTexture(ctx, 85, 342, 64, 64);
  applyFabricTexture(ctx, 341, 342, 64, 64);

  // Arm vertical panels (Right arm: 21, 85, 149, 213 | Left arm: 277, 341, 405, 469)
  const armPanels = [21, 85, 149, 213, 277, 341, 405, 469];
  const sleeveHeight = isLong ? 116 : 46;

  for (const ax of armPanels) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(ax, 406, 64, sleeveHeight);
    applyFabricTexture(ctx, ax, 406, 64, sleeveHeight);

    // Sleeve Hem with double stitching
    drawDoubleStitch(ctx, ax, 406 + sleeveHeight - 3, 64, true, stitchColor);

    // Soft underarm fold shadow near top
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(ax, 406, 64, 8);
  }

  // 3. PATTERNS
  if (spec.pattern === "stripes") {
    ctx.strokeStyle = `${stitchColor}28`;
    ctx.lineWidth = 1.5;
    for (let lx = tx; lx < tx + 128; lx += 12) {
      ctx.beginPath();
      ctx.moveTo(lx, ty + 12);
      ctx.lineTo(lx, ty + torsoHeight);
      ctx.stroke();
    }
  } else if (spec.pattern === "stars") {
    ctx.fillStyle = `${spec.accentColor}28`;
    for (let i = 0; i < 4; i++) {
      const sx = tx + 20 + (i * 28);
      const sy = ty + 30 + (i % 2) * 16;
      drawStar(ctx, sx, sy, 4, 3, 1.5);
    }
  }

  // 4. HIGH-DEFINITION REFINED CHEST GRAPHIC (COMPACT & AESTHETIC)
  if (spec.referenceImageDataUrl) {
    try {
      await overlayReferenceImage(ctx, spec.referenceImageDataUrl);
    } catch {
      drawChestEmblem(ctx, spec);
    }
  } else {
    drawChestEmblem(ctx, spec);
  }

  // Subtle realistic edge shading
  applyRealisticShading(ctx, [
    { x: 231, y: 74, w: 128, h: 64 },
    { x: tx, y: ty, w: 128, h: torsoHeight },
    { x: 423, y: ty, w: 128, h: torsoHeight },
    { x: 159, y: ty, w: 64, h: torsoHeight },
    { x: 367, y: ty, w: 64, h: torsoHeight },
    { x: 85, y: 342, w: 64, h: 64 },
    { x: 341, y: 342, w: 64, h: 64 },
  ]);
}

/**
 * Renders authentic, clean Roblox Pants / Jeans / Cargo / Skirt
 */
async function renderClassicRobloxPants(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const baseColor = spec.primaryColor || "#18181b";
  const seamColor = spec.accentColor || "#d4d4d8";
  const waistColor = spec.secondaryColor || "#09090b";

  const tx = 231;
  const ty = 138;
  const t = (spec.title || "").toLowerCase();
  const d = spec.details || [];
  const isSkirt = d.some((i) => i.includes("skirt") || i.includes("pleated")) || t.includes("skirt") || t.includes("saia");
  const isMinion = t.includes("minion") || spec.theme.includes("minion");

  if (isMinion) {
    drawMinionPants(ctx, spec);
    return;
  }

  // Pelvis
  ctx.fillStyle = baseColor;
  ctx.fillRect(tx, ty, 128, 128);
  ctx.fillRect(423, ty, 128, 128);
  ctx.fillRect(159, ty, 64, 128);
  ctx.fillRect(367, ty, 64, 128);
  applyFabricTexture(ctx, tx, ty, 128, 128);

  // Waistband
  ctx.fillStyle = waistColor;
  ctx.fillRect(tx, ty, 128, 12);
  ctx.fillRect(423, ty, 128, 12);
  ctx.fillRect(159, ty, 64, 12);
  ctx.fillRect(367, ty, 64, 12);

  // Belt Buckle
  ctx.fillStyle = seamColor;
  ctx.fillRect(tx + 58, ty + 2, 12, 8);
  ctx.fillStyle = "#09090b";
  ctx.fillRect(tx + 61, ty + 3.5, 6, 5);

  // Fly Zipper & Front Pockets
  ctx.strokeStyle = `${seamColor}77`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx + 64, ty + 12);
  ctx.lineTo(tx + 64, ty + 60);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(tx + 22, ty + 12, 16, 0, 0.5 * Math.PI);
  ctx.arc(tx + 106, ty + 12, 16, 0.5 * Math.PI, Math.PI);
  ctx.stroke();

  // Legs
  const legPanels = [21, 85, 149, 213, 277, 341, 405, 469];
  const legHeight = isSkirt ? 56 : 110;

  for (const lx of legPanels) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(lx, 406, 64, legHeight);
    applyFabricTexture(ctx, lx, 406, 64, legHeight);

    // Ankle Cuff
    drawDoubleStitch(ctx, lx, 406 + legHeight - 3, 64, true, seamColor);

    // Side seam
    ctx.strokeStyle = `${seamColor}44`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx + 32, 406);
    ctx.lineTo(lx + 32, 406 + legHeight);
    ctx.stroke();
  }

  if (isSkirt) {
    ctx.strokeStyle = `${waistColor}cc`;
    ctx.lineWidth = 1.5;
    for (let px = tx + 12; px < tx + 116; px += 10) {
      ctx.beginPath();
      ctx.moveTo(px, ty + 12);
      ctx.lineTo(px, ty + 104);
      ctx.stroke();
    }
  }
}

/**
 * Draws refined, compact chest emblems that look aesthetic and proportional on avatars
 */
function drawChestEmblem(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const cx = 295; // Center of Torso_Front
  const cy = 182; // Positioned high on upper chest for perfect avatar fit
  const t = (spec.title || "").toLowerCase();
  const d = spec.details || [];
  const th = (spec.theme || "").toLowerCase();
  const gt = spec.graphicTheme || "";

  if (
    gt === "minion_face" ||
    t.includes("minion") ||
    th.includes("minion") ||
    d.some((i) => i.includes("minion"))
  ) {
    drawMinionChestGraphic(ctx, cx, cy);
  } else if (gt === "batman_logo" || t.includes("batman") || d.some((i) => i.includes("batman"))) {
    drawBatmanChestGraphic(ctx, cx, cy);
  } else if (gt === "spider_logo" || t.includes("spider") || d.some((i) => i.includes("spider"))) {
    drawSpidermanChestGraphic(ctx, cx, cy);
  } else if (gt === "hellokitty" || t.includes("hello kitty") || t.includes("hellokitty")) {
    drawHelloKittyGraphic(ctx, cx, cy);
  } else if (gt === "kuromi" || t.includes("kuromi")) {
    drawKuromiGraphic(ctx, cx, cy);
  } else if (
    gt === "chain_necklace" ||
    t.includes("y2k") ||
    t.includes("streetwear") ||
    t.includes("chain") ||
    t.includes("pajama") ||
    d.some((i) => i.includes("chain"))
  ) {
    drawStreetwearChainAndPocket(ctx, 231, 138);
  } else if (t.includes("skull") || d.some((i) => i.includes("skull"))) {
    drawSkullGraphic(ctx, cx, cy, spec.accentColor || "#e4e4e7");
  } else if (t.includes("heart") || d.some((i) => i.includes("heart"))) {
    drawHeartGraphic(ctx, cx, cy, spec.accentColor || "#f43f5e");
  } else if (t.includes("flame") || d.some((i) => i.includes("flame"))) {
    drawFlameGraphic(ctx, cx, cy, spec.accentColor || "#f97316");
  } else if (t.includes("butterfly") || d.some((i) => i.includes("butterfly"))) {
    drawButterflyGraphic(ctx, cx, cy, spec.accentColor || "#c084fc");
  } else if (t.includes("cat") || t.includes("gato") || d.some((i) => i.includes("cat"))) {
    drawCatChestGraphic(ctx, cx, cy, spec.accentColor || "#ffffff");
  } else {
    drawAestheticChestEmblem(ctx, cx, cy, spec.accentColor || "#c084fc");
  }
}

/**
 * Renders a delicate, compact, adorable Minion chest graphic (~30x34 px)
 * Perfectly sized for wearable Roblox shirts (not oversized/clunky)
 */
export function drawMinionChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  const mw = 30;
  const mh = 36;
  const mx = cx - mw / 2;
  const my = cy - mh / 2;

  // 1. Minion Pill Silhouette
  const yellowGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
  yellowGrad.addColorStop(0, "#fde047");
  yellowGrad.addColorStop(1, "#facc15");
  ctx.fillStyle = yellowGrad;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, [15, 15, 8, 8]);
  ctx.fill();
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 2. Tiny sprout hair
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 4, my + 3); ctx.lineTo(cx - 6, my - 3);
  ctx.moveTo(cx, my + 2); ctx.lineTo(cx, my - 4);
  ctx.moveTo(cx + 4, my + 3); ctx.lineTo(cx + 6, my - 3);
  ctx.stroke();

  // 3. Black Goggle Strap
  const strapY = my + 9;
  ctx.fillStyle = "#18181b";
  ctx.fillRect(mx + 1, strapY, mw - 2, 5.5);

  // 4. Dual Silver Metallic Goggles with Eyes
  const goggleY = strapY + 2.8;
  const eyeDistance = 6.5;
  for (const eyeX of [cx - eyeDistance, cx + eyeDistance]) {
    // Silver Rim
    const rimGrad = ctx.createLinearGradient(eyeX - 6.5, goggleY - 6.5, eyeX + 6.5, goggleY + 6.5);
    rimGrad.addColorStop(0, "#ffffff");
    rimGrad.addColorStop(0.5, "#cbd5e1");
    rimGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // White Sclera
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Brown Iris
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY + 0.3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY + 0.3, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Glint
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX - 0.8, goggleY - 0.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Friendly Smile
  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, my + 20, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // 6. Denim Bib
  const bibY = my + 26;
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(mx + 2, bibY, mw - 4, mh - 26);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(mx + 2, bibY, mw - 4, mh - 26);

  // Gru "G" Logo
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(cx, bibY + 5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 4.5px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("G", cx, bibY + 5);

  ctx.restore();
}

/**
 * Renders delicate silver curb chain + cute left pocket dino mascot (matching store reference)
 */
export function drawStreetwearChainAndPocket(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  ctx.save();
  // 1. Delicate silver curb-link chain hanging from collar
  const chainY = ty + 10;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(tx + 64, chainY, 22, 9, 0, 0, Math.PI);
  ctx.stroke();

  // Fine link highlights
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  for (let a = 0; a <= Math.PI; a += Math.PI / 6) {
    const lx = tx + 64 + Math.cos(a) * 22;
    const ly = chainY + Math.sin(a) * 9;
    ctx.strokeRect(lx - 1, ly - 1, 2, 2);
  }

  // 2. Compact pocket mascot on left chest
  const px = tx + 24;
  const py = ty + 38;

  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.roundRect(px, py, 16, 16, [7, 7, 3, 3]);
  ctx.fill();
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Spikes
  ctx.fillStyle = "#22c55e";
  ctx.beginPath(); ctx.arc(px - 1, py + 4, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px - 1, py + 9, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px - 1, py + 14, 1.8, 0, Math.PI * 2); ctx.fill();

  // Eyes
  ctx.fillStyle = "#ef4444";
  ctx.beginPath(); ctx.arc(px + 10, py + 5, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(px + 7, py + 10, 4, 1.2);

  ctx.restore();
}

/**
 * Renders compact Batman yellow oval emblem (~32x20 px)
 */
export function drawBatmanChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bat Silhouette
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx - 1.5, cy - 8);
  ctx.lineTo(cx - 2.5, cy - 5);
  ctx.quadraticCurveTo(cx - 10, cy - 9, cx - 15, cy - 2);
  ctx.quadraticCurveTo(cx - 11, cy + 1, cx - 8, cy + 4);
  ctx.quadraticCurveTo(cx - 5, cy + 5, cx - 2.5, cy + 3);
  ctx.lineTo(cx, cy + 6.5);
  ctx.lineTo(cx + 2.5, cy + 3);
  ctx.quadraticCurveTo(cx + 5, cy + 5, cx + 8, cy + 4);
  ctx.quadraticCurveTo(cx + 11, cy + 1, cx + 15, cy - 2);
  ctx.quadraticCurveTo(cx + 10, cy - 9, cx + 2.5, cy - 5);
  ctx.lineTo(cx + 1.5, cy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders compact Spider-Man chest emblem
 */
export function drawSpidermanChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 0.8;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    ctx.stroke();
  }
  for (const r of [7, 13, 18]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spider Body
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 3.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.4;
  const legCoords = [
    [-2, -3, -9, -10, -14, -8],
    [-3, -1, -11, -4, -15, -1],
    [-3, 1, -11, 4, -15, 7],
    [-2, 3, -9, 10, -13, 13],
    [2, -3, 9, -10, 14, -8],
    [3, -1, 11, -4, 15, -1],
    [3, 1, 11, 4, 15, 7],
    [2, 3, 9, 10, 13, 13],
  ];
  for (const [x1, y1, x2, y2, x3, y3] of legCoords) {
    ctx.beginPath();
    ctx.moveTo(cx + x1, cy + y1);
    ctx.lineTo(cx + x2, cy + y2);
    ctx.lineTo(cx + x3, cy + y3);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders compact Hello Kitty face
 */
export function drawHelloKittyGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Ears
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 6); ctx.lineTo(cx - 13, cy - 14); ctx.lineTo(cx - 4, cy - 9); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 6); ctx.lineTo(cx + 13, cy - 14); ctx.lineTo(cx + 4, cy - 9); ctx.fill(); ctx.stroke();

  // Red Bow
  drawRibbonBow(ctx, cx + 9, cy - 10, "#ef4444");

  // Eyes
  ctx.fillStyle = "#09090b";
  ctx.beginPath(); ctx.ellipse(cx - 5, cy, 1.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 5, cy, 1.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();

  // Nose
  ctx.fillStyle = "#facc15";
  ctx.beginPath(); ctx.ellipse(cx, cy + 2.5, 2, 1.3, 0, 0, Math.PI * 2); ctx.fill();

  // Whiskers
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy); ctx.lineTo(cx - 17, cy - 1);
  ctx.moveTo(cx - 9, cy + 2.5); ctx.lineTo(cx - 17, cy + 2.5);
  ctx.moveTo(cx + 9, cy); ctx.lineTo(cx + 17, cy - 1);
  ctx.moveTo(cx + 9, cy + 2.5); ctx.lineTo(cx + 17, cy + 2.5);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders compact Kuromi face
 */
export function drawKuromiGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jester Ears
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 6); ctx.quadraticCurveTo(cx - 15, cy - 17, cx - 13, cy - 20); ctx.quadraticCurveTo(cx - 8, cy - 15, cx - 3, cy - 10); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 6); ctx.quadraticCurveTo(cx + 15, cy - 17, cx + 13, cy - 20); ctx.quadraticCurveTo(cx + 8, cy - 15, cx + 3, cy - 10); ctx.fill();

  // Pink Skull
  drawSkullGraphic(ctx, cx, cy - 6, "#f472b6");

  // Face
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(cx, cy + 3, 9, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#09090b";
  ctx.beginPath(); ctx.ellipse(cx - 3.5, cy + 2, 1.5, 2.2, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 3.5, cy + 2, 1.5, 2.2, 0.3, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

/**
 * Renders Minion Denim Pants
 */
export function drawMinionPants(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const tx = 231;
  const ty = 138;

  const denimGrad = ctx.createLinearGradient(tx, ty, tx, ty + 128);
  denimGrad.addColorStop(0, "#2563eb");
  denimGrad.addColorStop(1, "#1d4ed8");

  ctx.fillStyle = denimGrad;
  ctx.fillRect(tx, ty, 128, 128);
  ctx.fillRect(423, ty, 128, 128);
  ctx.fillRect(159, ty, 64, 128);
  ctx.fillRect(367, ty, 64, 128);

  ctx.fillStyle = "#1e40af";
  ctx.fillRect(tx, ty, 128, 12);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, ty, 128, 12);

  const legPanels = [21, 85, 149, 213, 277, 341, 405, 469];
  for (const lx of legPanels) {
    ctx.fillStyle = denimGrad;
    ctx.fillRect(lx, 406, 64, 110);

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx + 32, 406); ctx.lineTo(lx + 32, 406 + 96); ctx.stroke();

    ctx.fillStyle = "#facc15";
    ctx.fillRect(lx, 406 + 96, 64, 14);
    ctx.strokeStyle = "#fbbf24";
    ctx.strokeRect(lx, 406 + 96, 64, 14);
  }
}

/**
 * Renders compact Cat Face Graphic
 */
export function drawCatChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 5); ctx.lineTo(cx - 11, cy - 14); ctx.lineTo(cx - 2, cy - 8); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy - 5); ctx.lineTo(cx + 11, cy - 14); ctx.lineTo(cx + 2, cy - 8); ctx.fill();

  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy); ctx.lineTo(cx - 12, cy - 1);
  ctx.moveTo(cx - 3, cy + 2.5); ctx.lineTo(cx - 11, cy + 3.5);
  ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 12, cy - 1);
  ctx.moveTo(cx + 3, cy + 2.5); ctx.lineTo(cx + 11, cy + 3.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders compact Skull Emblem
 */
export function drawSkullGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy - 2.5, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillRect(cx - 5, cy + 4, 10, 6.5);
  ctx.strokeRect(cx - 5, cy + 4, 10, 6.5);

  ctx.fillStyle = "#09090b";
  ctx.beginPath(); ctx.ellipse(cx - 3, cy - 2, 2.2, 3, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 3, cy - 2, 2.2, 3, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Renders compact Heart Graphic
 */
export function drawHeartGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff44";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 9);
  ctx.bezierCurveTo(cx - 12, cy - 2, cx - 14, cy - 12, cx, cy - 6);
  ctx.bezierCurveTo(cx + 14, cy - 12, cx + 12, cy - 2, cx, cy + 9);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders compact Butterfly Graphic
 */
export function drawButterflyGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff44";
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(cx - 7, cy - 4, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + 7, cy - 4, 8, 5, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/**
 * Renders compact Flame Graphic
 */
export function drawFlameGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, _color: string) {
  ctx.save();
  const flameGrad = ctx.createLinearGradient(cx, cy + 12, cx, cy - 12);
  flameGrad.addColorStop(0, "#ef4444");
  flameGrad.addColorStop(0.5, "#f97316");
  flameGrad.addColorStop(1, "#facc15");
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.quadraticCurveTo(cx + 4, cy - 5, cx + 10, cy - 2);
  ctx.quadraticCurveTo(cx + 5, cy + 4, cx + 12, cy + 10);
  ctx.quadraticCurveTo(cx, cy + 15, cx - 12, cy + 10);
  ctx.quadraticCurveTo(cx - 5, cy + 4, cx - 10, cy - 2);
  ctx.quadraticCurveTo(cx - 4, cy - 5, cx, cy - 14);
  ctx.fill();
  ctx.restore();
}

/**
 * Renders compact Ribbon Bow
 */
export function drawRibbonBow(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff55";
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - 10, cy - 7, cx - 10, cy + 7, cx, cy);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + 10, cy - 7, cx + 10, cy + 7, cx, cy);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Renders compact Aesthetic Star/Cross
 */
export function drawAestheticChestEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, accent: string) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}22`;
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.quadraticCurveTo(cx + 3, cy - 3, cx + 12, cy);
  ctx.quadraticCurveTo(cx + 3, cy + 3, cx, cy + 12);
  ctx.quadraticCurveTo(cx - 3, cy + 3, cx - 12, cy);
  ctx.quadraticCurveTo(cx - 3, cy - 3, cx, cy - 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

export function drawDoubleStitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  horizontal: boolean,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = `${color}38`;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 2]);

  if (horizontal) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x, y + 2); ctx.lineTo(x + len, y + 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y + len);
    ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

export function applyFabricTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.012)";
  const step = 6;
  for (let px = x; px < x + w; px += step) {
    for (let py = y; py < y + h; py += step) {
      if ((px + py) % (step * 2) === 0) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  ctx.restore();
}

export function applyRealisticShading(
  ctx: CanvasRenderingContext2D,
  sections: Array<{ x: number; y: number; w: number; h: number }>
) {
  for (const s of sections) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  }
}

export async function overlayReferenceImage(
  ctx: CanvasRenderingContext2D,
  dataUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.save();
      const targetW = 44;
      const targetH = 44;
      const targetX = 231 + (128 - targetW) / 2;
      const targetY = 138 + 24;

      ctx.beginPath();
      ctx.roundRect(targetX, targetY, targetW, targetH, 3);
      ctx.clip();
      ctx.drawImage(img, targetX, targetY, targetW, targetH);
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function renderTshirtGraphic(spec: UgcDesignSpec): string {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = spec.primaryColor || "#09090b";
  ctx.fillRect(0, 0, 512, 512);

  drawAestheticChestEmblem(ctx, 256, 256, spec.accentColor || "#38bdf8");

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(spec.title.toUpperCase(), 256, 420);

  return canvas.toDataURL("image/png");
}

/**
 * Generates an authentic 3D Avatar Mannequin Thumbnail wearing the shirt
 * Matching the exact look of official Roblox catalog thumbnails!
 */
export async function renderAvatarPreview(
  templateDataUrl: string,
  kind: UgcClothingKind = "shirt"
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(templateDataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // 1. Sleek studio background
      const bgGrad = ctx.createRadialGradient(150, 140, 20, 150, 150, 180);
      bgGrad.addColorStop(0, "#181824");
      bgGrad.addColorStop(0.7, "#09090d");
      bgGrad.addColorStop(1, "#040407");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 300, 300);

      // Floor reflection / shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.ellipse(150, 266, 68, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Avatar Skin tone (Clean Studio White/Light Gray)
      const skinColor = "#e5e7eb";

      // 2. Head (centered at x: 150, y: 44, w: 48, h: 48)
      ctx.save();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.roundRect(126, 26, 48, 48, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Minimalist Roblox Avatar Face
      ctx.fillStyle = "#1e293b";
      ctx.beginPath(); ctx.arc(141, 48, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(159, 48, 2.5, 0, Math.PI * 2); ctx.fill();
      // Smile
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(150, 56, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();

      // 3. Torso (x: 116, y: 76, w: 68, h: 72)
      ctx.save();
      // Soft shadow behind torso
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      if (kind === "shirt" || kind === "tshirt") {
        // Draw front torso slice from template: (231, 138, 128, 128) -> (116, 76, 68, 72)
        ctx.drawImage(img, 231, 138, 128, 128, 116, 76, 68, 72);
      } else {
        // Pants: Torso front pelvis
        ctx.drawImage(img, 231, 138, 128, 128, 116, 76, 68, 72);
      }
      ctx.restore();

      // 4. Arms (Avatar Right: 76, 76, 36, 72 | Avatar Left: 188, 76, 36, 72)
      // Right Arm (Screen Left)
      ctx.save();
      ctx.fillStyle = skinColor;
      ctx.fillRect(76, 76, 36, 72); // Base bare arm
      if (kind === "shirt") {
        // Short sleeve: only top 28px
        ctx.drawImage(img, 85, 406, 64, 48, 76, 76, 36, 28);
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(76, 76, 36, 72);
      ctx.restore();

      // Left Arm (Screen Right)
      ctx.save();
      ctx.fillStyle = skinColor;
      ctx.fillRect(188, 76, 36, 72); // Base bare arm
      if (kind === "shirt") {
        // Short sleeve: only top 28px
        ctx.drawImage(img, 341, 406, 64, 48, 188, 76, 36, 28);
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(188, 76, 36, 72);
      ctx.restore();

      // 5. Legs (Left: 116, 150, 33, 86 | Right: 151, 150, 33, 86)
      ctx.save();
      const legColor = kind === "pants" ? "#1e293b" : "#f1f5f9";
      ctx.fillStyle = legColor;
      ctx.fillRect(116, 150, 33, 86);
      ctx.fillRect(151, 150, 33, 86);

      if (kind === "pants") {
        ctx.drawImage(img, 85, 406, 64, 112, 116, 150, 33, 86);
        ctx.drawImage(img, 341, 406, 64, 112, 151, 150, 33, 86);
      }

      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(116, 150, 33, 86);
      ctx.strokeRect(151, 150, 33, 86);
      ctx.restore();

      // Subtle ambient 3D lighting vignette
      ctx.save();
      const lightGrad = ctx.createLinearGradient(100, 40, 200, 260);
      lightGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      lightGrad.addColorStop(1, "rgba(0, 0, 0, 0.25)");
      ctx.fillStyle = lightGrad;
      ctx.fillRect(76, 26, 148, 210);
      ctx.restore();

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(templateDataUrl);
    img.src = templateDataUrl;
  });
}
