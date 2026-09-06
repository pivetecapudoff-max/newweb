// Roblox Official 2D Clothing Template Generator (585 x 559 px)
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

/**
 * Generates a high-quality, pixel-accurate Roblox 585x559 clothing template PNG
 */
export async function renderRobloxTemplate(spec: UgcDesignSpec): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 585;
  canvas.height = 559;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D Canvas context.");

  // Clear with 100% transparency
  ctx.clearRect(0, 0, 585, 559);

  // If tshirt: Roblox T-shirt is a single 512x512 graphic or 128x128 chest decal
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

  // ----------------------------------------------------
  // 1. TORSO (231, 74) to (551, 266)
  // ----------------------------------------------------
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
  ctx.arc(295, 106, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw collar ribbing ring around neck hole
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(295, 106, 21.5, 0, Math.PI * 2);
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
  ctx.ellipse(295, 138, 22, 9, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // Crewneck ribbing trim along front scoop
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(295, 138, 23, 10, 0, 0, Math.PI);
  ctx.stroke();

  // C. Torso_Back (423, 138, 128, torsoHeight)
  ctx.fillStyle = baseColor;
  ctx.fillRect(423, ty, 128, torsoHeight);
  applyFabricTexture(ctx, 423, ty, 128, torsoHeight);

  // Subtle back collar trim curve
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(487, 138, 20, 4, 0, 0, Math.PI);
  ctx.stroke();

  // D. Torso_Left (367, 138, 64, torsoHeight) & Torso_Right (159, 138, 64, torsoHeight)
  for (const sx of [159, 367]) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(sx, ty, 64, torsoHeight);
    applyFabricTexture(ctx, sx, ty, 64, torsoHeight);
    // Armpit fold shading
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(sx, ty, 6, 24);
    ctx.fillRect(sx + 58, ty, 6, 24);
  }

  // E. Waist Hem: Double-needle stitched hem across bottom of torso
  const hemY = ty + torsoHeight - 4;
  for (const part of [{ x: 159, w: 64 }, { x: 231, w: 128 }, { x: 367, w: 64 }, { x: 423, w: 128 }]) {
    drawDoubleStitch(ctx, part.x, hemY, part.w, true, stitchColor);
  }

  // Notice: Torso_Bottom (231, 274, 128, 64) is left 100% TRANSPARENT so legs show cleanly.

  // ----------------------------------------------------
  // 2. ARMS & SLEEVES (Right Arm: 21-276 | Left Arm: 277-532)
  // ----------------------------------------------------
  // Shoulder tops (R_Top: 85, 342, 64, 64 | L_Top: 341, 342, 64, 64)
  ctx.fillStyle = baseColor;
  ctx.fillRect(85, 342, 64, 64);
  ctx.fillRect(341, 342, 64, 64);
  applyFabricTexture(ctx, 85, 342, 64, 64);
  applyFabricTexture(ctx, 341, 342, 64, 64);

  // Arm vertical panels (Right arm: 21, 85, 149, 213 | Left arm: 277, 341, 405, 469)
  const armPanels = [21, 85, 149, 213, 277, 341, 405, 469];
  // Basic T-shirt sleeve height = ~48px (y: 406 to y: 454)
  // Long sleeve height = 116px (down to wrist y: 522)
  const sleeveHeight = isLong ? 116 : 48;

  for (const ax of armPanels) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(ax, 406, 64, sleeveHeight);
    applyFabricTexture(ctx, ax, 406, 64, sleeveHeight);

    // Sleeve Hem with double stitching
    drawDoubleStitch(ctx, ax, 406 + sleeveHeight - 4, 64, true, stitchColor);

    // Soft underarm fold shadow near top
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(ax, 406, 64, 10);
  }

  // IMPORTANT: For short sleeves, lower arms (y: 454 to 534) and hands (R_Bottom, L_Bottom)
  // ARE 100% TRANSPARENT so avatar skin shows! No pajama/glove bug!

  // ----------------------------------------------------
  // 3. PATTERNS (If user requested stripes, stars, acid wash)
  // ----------------------------------------------------
  if (spec.pattern === "stripes") {
    ctx.strokeStyle = `${stitchColor}33`;
    ctx.lineWidth = 2;
    for (let lx = tx; lx < tx + 128; lx += 10) {
      ctx.beginPath();
      ctx.moveTo(lx, ty + 12);
      ctx.lineTo(lx, ty + torsoHeight);
      ctx.stroke();
    }
  } else if (spec.pattern === "stars") {
    ctx.fillStyle = `${spec.accentColor}33`;
    for (let i = 0; i < 5; i++) {
      const sx = tx + 16 + (i * 22);
      const sy = ty + 30 + (i % 2) * 20;
      drawStar(ctx, sx, sy, 4, 4, 2);
    }
  }

  // ----------------------------------------------------
  // 4. HIGH-DEFINITION CHEST GRAPHIC PRINT
  // ----------------------------------------------------
  if (spec.referenceImageDataUrl) {
    try {
      await overlayReferenceImage(ctx, spec.referenceImageDataUrl);
    } catch {
      drawChestEmblem(ctx, spec);
    }
  } else {
    drawChestEmblem(ctx, spec);
  }

  // Subtle realistic edge shading for the fabric
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

  // 1. Torso Pelvis (231, 138, 128, 128)
  ctx.fillStyle = baseColor;
  ctx.fillRect(tx, ty, 128, 128);
  ctx.fillRect(423, ty, 128, 128); // Back
  ctx.fillRect(159, ty, 64, 128);  // Right
  ctx.fillRect(367, ty, 64, 128);  // Left
  applyFabricTexture(ctx, tx, ty, 128, 128);

  // Waistband & Belt
  ctx.fillStyle = waistColor;
  ctx.fillRect(tx, ty, 128, 14);
  ctx.fillRect(423, ty, 128, 14);
  ctx.fillRect(159, ty, 64, 14);
  ctx.fillRect(367, ty, 64, 14);

  // Belt Buckle & Loops
  ctx.fillStyle = seamColor;
  ctx.fillRect(tx + 56, ty + 2, 16, 10);
  ctx.fillStyle = "#09090b";
  ctx.fillRect(tx + 60, ty + 4, 8, 6);

  // Front Pockets & Fly Zipper
  ctx.strokeStyle = `${seamColor}88`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tx + 64, ty + 14);
  ctx.lineTo(tx + 64, ty + 68);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(tx + 24, ty + 14, 20, 0, 0.5 * Math.PI);
  ctx.arc(tx + 104, ty + 14, 20, 0.5 * Math.PI, Math.PI);
  ctx.stroke();

  // 2. Legs (Right leg: 21, 85, 149, 213 | Left leg: 277, 341, 405, 469)
  const legPanels = [21, 85, 149, 213, 277, 341, 405, 469];
  const legHeight = isSkirt ? 60 : 112; // Skirt stops at thigh, pants down to ankles

  for (const lx of legPanels) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(lx, 406, 64, legHeight);
    applyFabricTexture(ctx, lx, 406, 64, legHeight);

    // Ankle Cuff / Hem
    drawDoubleStitch(ctx, lx, 406 + legHeight - 4, 64, true, seamColor);

    // Side seam
    ctx.strokeStyle = `${seamColor}55`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx + 32, 406);
    ctx.lineTo(lx + 32, 406 + legHeight);
    ctx.stroke();
  }

  // If skirt: draw pleats
  if (isSkirt) {
    ctx.strokeStyle = `${waistColor}cc`;
    ctx.lineWidth = 2;
    for (let px = tx + 12; px < tx + 116; px += 10) {
      ctx.beginPath();
      ctx.moveTo(px, ty + 14);
      ctx.lineTo(px, ty + 110);
      ctx.stroke();
    }
  }

  // NOTE: Feet (R_Bottom, L_Bottom) remain 100% transparent for player's shoes.
}

/**
 * Draws the high-definition centered chest emblem matching the theme
 */
function drawChestEmblem(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const cx = 295; // Center of Torso_Front (231 + 64)
  const cy = 195; // Center of chest (138 + 57)
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
 * Renders an adorable, high-definition Minion character graphic on the chest
 */
export function drawMinionChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  const mw = 52;
  const mh = 62;
  const mx = cx - mw / 2;
  const my = cy - mh / 2;

  // 1. Minion Pill-shaped Yellow Body Silhouette
  const yellowGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
  yellowGrad.addColorStop(0, "#fde047");
  yellowGrad.addColorStop(1, "#facc15");
  ctx.fillStyle = yellowGrad;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, [26, 26, 16, 16]);
  ctx.fill();
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Sprout Hair Strands at the top
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, my + 6);
  ctx.quadraticCurveTo(cx - 10, my - 4, cx - 14, my - 6);
  ctx.moveTo(cx, my + 4);
  ctx.lineTo(cx, my - 8);
  ctx.moveTo(cx + 8, my + 6);
  ctx.quadraticCurveTo(cx + 10, my - 4, cx + 14, my - 6);
  ctx.stroke();

  // 3. Black Goggle Strap
  const strapY = my + 16;
  ctx.fillStyle = "#18181b";
  ctx.fillRect(mx + 1, strapY, mw - 2, 9);
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 1, strapY, mw - 2, 9);

  // 4. Dual Silver Metallic Goggles with Eyes
  const goggleY = strapY + 4.5;
  const eyeDistance = 11;
  for (const eyeX of [cx - eyeDistance, cx + eyeDistance]) {
    // Outer Metallic Rim
    const rimGrad = ctx.createLinearGradient(eyeX - 11, goggleY - 11, eyeX + 11, goggleY + 11);
    rimGrad.addColorStop(0, "#ffffff");
    rimGrad.addColorStop(0.3, "#cbd5e1");
    rimGrad.addColorStop(0.7, "#94a3b8");
    rimGrad.addColorStop(1, "#475569");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rivets on goggle rim
    ctx.fillStyle = "#1e293b";
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const rx = eyeX + Math.cos(a) * 9.2;
      const ry = goggleY + Math.sin(a) * 9.2;
      ctx.beginPath();
      ctx.arc(rx, ry, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inner White Sclera
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Hazel / Brown Iris
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY + 0.5, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Black Pupil
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY + 0.5, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Catchlight Glint
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX - 1.5, goggleY - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Friendly Smile
  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, my + 34, 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // 6. Denim Bib with Gru Logo
  const bibY = my + 44;
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(mx + 4, bibY, mw - 8, mh - 44);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 4, bibY, mw - 8, mh - 44);

  // Gru "G" Logo
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(cx, bibY + 9, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 6.5px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("G", cx, bibY + 9);

  ctx.restore();
}

/**
 * Renders silver chain necklace + cute pocket dino mascot
 * Matching the bestselling style uploaded in reference
 */
export function drawStreetwearChainAndPocket(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  ctx.save();
  // 1. Silver curb-link chain necklace hanging from collar
  const chainY = ty + 12;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(tx + 64, chainY, 32, 14, 0, 0, Math.PI);
  ctx.stroke();

  // Highlights on chain links
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  for (let a = 0; a <= Math.PI; a += Math.PI / 8) {
    const lx = tx + 64 + Math.cos(a) * 32;
    const ly = chainY + Math.sin(a) * 14;
    ctx.strokeRect(lx - 1.5, ly - 1.5, 3, 3);
  }

  // 2. Cute pocket mascot on left chest (matches nightmay1000 store reference)
  const px = tx + 24;
  const py = ty + 42;

  // Green dino pocket creature
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.roundRect(px, py + 2, 20, 20, [10, 10, 4, 4]);
  ctx.fill();
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Spikes on dino back
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(px - 1, py + 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px - 1, py + 12, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px - 1, py + 18, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes and expression
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(px + 13, py + 8, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(px + 9, py + 14, 5, 1.5);

  ctx.restore();
}

/**
 * Renders the iconic Batman yellow oval with black bat silhouette
 */
export function drawBatmanChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Yellow Oval
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Black Bat Silhouette
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx - 2, cy - 12);
  ctx.lineTo(cx - 4, cy - 8);
  ctx.quadraticCurveTo(cx - 16, cy - 14, cx - 24, cy - 4);
  ctx.quadraticCurveTo(cx - 18, cy, cx - 14, cy + 6);
  ctx.quadraticCurveTo(cx - 8, cy + 8, cx - 4, cy + 5);
  ctx.lineTo(cx, cy + 10);
  ctx.lineTo(cx + 4, cy + 5);
  ctx.quadraticCurveTo(cx + 8, cy + 8, cx + 14, cy + 6);
  ctx.quadraticCurveTo(cx + 18, cy, cx + 24, cy - 4);
  ctx.quadraticCurveTo(cx + 16, cy - 14, cx + 4, cy - 8);
  ctx.lineTo(cx + 2, cy - 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders the iconic Spider-Man web and chest spider emblem
 */
export function drawSpidermanChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Spider-web lines radiating from center
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
    ctx.stroke();
  }
  for (const r of [12, 22, 32]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Black Spider Silhouette in Center
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spider legs
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2.2;
  const legCoords = [
    [-4, -6, -18, -18, -26, -14],
    [-5, -2, -20, -8, -28, -2],
    [-5, 2, -20, 8, -28, 14],
    [-4, 6, -18, 18, -24, 24],
    [4, -6, 18, -18, 26, -14],
    [5, -2, 20, -8, 28, -2],
    [5, 2, 20, 8, 28, 14],
    [4, 6, 18, 18, 24, 24],
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
 * Renders Hello Kitty face emblem
 */
export function drawHelloKittyGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // White Head
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Ears
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 10);
  ctx.lineTo(cx - 20, cy - 22);
  ctx.lineTo(cx - 6, cy - 14);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 10);
  ctx.lineTo(cx + 20, cy - 22);
  ctx.lineTo(cx + 6, cy - 14);
  ctx.fill();
  ctx.stroke();

  // Red Ribbon Bow on right ear
  drawRibbonBow(ctx, cx + 14, cy - 16, "#ef4444");

  // Black Oval Eyes
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy - 1, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy - 1, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Yellow Nose
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 1);
  ctx.lineTo(cx - 26, cy - 3);
  ctx.moveTo(cx - 14, cy + 3);
  ctx.lineTo(cx - 26, cy + 3);
  ctx.moveTo(cx + 14, cy - 1);
  ctx.lineTo(cx + 26, cy - 3);
  ctx.moveTo(cx + 14, cy + 3);
  ctx.lineTo(cx + 26, cy + 3);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders Kuromi dark gothic face emblem
 */
export function drawKuromiGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Black Jester Hood
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jester Ears
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 10);
  ctx.quadraticCurveTo(cx - 24, cy - 26, cx - 20, cy - 30);
  ctx.quadraticCurveTo(cx - 12, cy - 24, cx - 4, cy - 16);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 10);
  ctx.quadraticCurveTo(cx + 24, cy - 26, cx + 20, cy - 30);
  ctx.quadraticCurveTo(cx + 12, cy - 24, cx + 4, cy - 16);
  ctx.fill();

  // Pink Skull Emblem on forehead
  drawSkullGraphic(ctx, cx, cy - 10, "#f472b6");

  // Cute White Face
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 15, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Slanted Emo Eyes
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy + 2, 2.5, 3.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 6, cy + 2, 2.5, 3.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renders Minion Denim Pants
 */
export function drawMinionPants(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const tx = 231;
  const ty = 138;

  // Blue denim base fill
  const denimGrad = ctx.createLinearGradient(tx, ty, tx, ty + 128);
  denimGrad.addColorStop(0, "#2563eb");
  denimGrad.addColorStop(1, "#1d4ed8");

  // Torso Pelvis (231, 138, 128, 128)
  ctx.fillStyle = denimGrad;
  ctx.fillRect(tx, ty, 128, 128);
  ctx.fillRect(423, ty, 128, 128);
  ctx.fillRect(159, ty, 64, 128);
  ctx.fillRect(367, ty, 64, 128);

  // Waistband & yellow stitch
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(tx, ty, 128, 14);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, ty, 128, 14);

  // Front Pockets with yellow stitching
  for (const px of [tx + 10, tx + 82]) {
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px + 18, ty + 14, 22, 0, 0.5 * Math.PI);
    ctx.stroke();
  }

  // Pants Legs (Right: 21-276 | Left: 277-532)
  const legPanels = [21, 85, 149, 213, 277, 341, 405, 469];
  for (const lx of legPanels) {
    ctx.fillStyle = denimGrad;
    ctx.fillRect(lx, 406, 64, 112);

    // Denim side seam
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx + 32, 406);
    ctx.lineTo(lx + 32, 406 + 96);
    ctx.stroke();

    // Rolled-up Minion Yellow Cuffs at the ankle
    ctx.fillStyle = "#facc15";
    ctx.fillRect(lx, 406 + 96, 64, 16);
    ctx.strokeStyle = "#fbbf24";
    ctx.strokeRect(lx, 406 + 96, 64, 16);
  }
}

/**
 * Renders cute Cat Face Graphic
 */
export function drawCatChestGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - 8);
  ctx.lineTo(cx - 16, cy - 22);
  ctx.lineTo(cx - 2, cy - 13);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 12, cy - 8);
  ctx.lineTo(cx + 16, cy - 22);
  ctx.lineTo(cx + 2, cy - 13);
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 1);
  ctx.lineTo(cx - 18, cy);
  ctx.moveTo(cx - 5, cy + 4);
  ctx.lineTo(cx - 17, cy + 5);
  ctx.moveTo(cx + 5, cy + 1);
  ctx.lineTo(cx + 18, cy);
  ctx.moveTo(cx + 5, cy + 4);
  ctx.lineTo(cx + 17, cy + 5);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders Skull Emblem
 */
export function drawSkullGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Jaw
  ctx.fillRect(cx - 8, cy + 6, 16, 10);
  ctx.strokeRect(cx - 8, cy + 6, 16, 10);

  // Hollow Eyes
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 3, 3.5, 4.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy - 3, 3.5, 4.5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Teeth
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.2;
  for (let tx = cx - 5; tx <= cx + 5; tx += 3.5) {
    ctx.beginPath();
    ctx.moveTo(tx, cy + 7);
    ctx.lineTo(tx, cy + 15);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders Heart Graphic
 */
export function drawHeartGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff66";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 12);
  ctx.bezierCurveTo(cx - 16, cy - 2, cx - 18, cy - 16, cx, cy - 8);
  ctx.bezierCurveTo(cx + 18, cy - 16, cx + 16, cy - 2, cx, cy + 12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders Butterfly Graphic
 */
export function drawButterflyGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff66";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy - 6, 12, 8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + 10, cy - 6, 12, 8, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders Flame Graphic
 */
export function drawFlameGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  _color: string
) {
  ctx.save();
  const flameGrad = ctx.createLinearGradient(cx, cy + 18, cx, cy - 18);
  flameGrad.addColorStop(0, "#ef4444");
  flameGrad.addColorStop(0.5, "#f97316");
  flameGrad.addColorStop(1, "#facc15");
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.quadraticCurveTo(cx + 6, cy - 8, cx + 14, cy - 4);
  ctx.quadraticCurveTo(cx + 8, cy + 6, cx + 18, cy + 14);
  ctx.quadraticCurveTo(cx, cy + 22, cx - 18, cy + 14);
  ctx.quadraticCurveTo(cx - 8, cy + 6, cx - 14, cy - 4);
  ctx.quadraticCurveTo(cx - 6, cy - 8, cx, cy - 20);
  ctx.fill();
  ctx.restore();
}

/**
 * Renders Ribbon Bow
 */
export function drawRibbonBow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff66";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - 14, cy - 10, cx - 14, cy + 10, cx, cy);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + 14, cy - 10, cx + 14, cy + 10, cx, cy);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 2);
  ctx.lineTo(cx - 8, cy + 14);
  ctx.moveTo(cx + 2, cy + 2);
  ctx.lineTo(cx + 8, cy + 14);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders Aesthetic Cyber Cross / Star Emblem
 */
export function drawAestheticChestEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accent: string
) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}22`;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(cx, cy - 18);
  ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 18, cy);
  ctx.quadraticCurveTo(cx + 4, cy + 4, cx, cy + 18);
  ctx.quadraticCurveTo(cx - 4, cy + 4, cx - 18, cy);
  ctx.quadraticCurveTo(cx - 4, cy - 4, cx, cy - 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws crisp 4-pointed or 5-pointed stars
 */
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

/**
 * Draws a clean double-needle seam stitch
 */
export function drawDoubleStitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  horizontal: boolean,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = `${color}44`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  if (horizontal) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.moveTo(x, y + 2.5);
    ctx.lineTo(x + len, y + 2.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.moveTo(x + 2.5, y);
    ctx.lineTo(x + 2.5, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Applies subtle cotton/jersey weave texture
 */
export function applyFabricTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
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

/**
 * Applies realistic edge seams and corner shading
 */
export function applyRealisticShading(
  ctx: CanvasRenderingContext2D,
  sections: Array<{ x: number; y: number; w: number; h: number }>
) {
  for (const s of sections) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(s.x + 0.6, s.y + 0.6, s.w - 1.2, s.h - 1.2);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
  }
}

/**
 * Composites reference image onto the front torso
 */
export async function overlayReferenceImage(
  ctx: CanvasRenderingContext2D,
  dataUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Bounded centered on Torso Front (231, 138, 128, 128)
      ctx.save();
      const targetW = 76;
      const targetH = 76;
      const targetX = 231 + (128 - targetW) / 2;
      const targetY = 138 + 26;

      ctx.beginPath();
      ctx.roundRect(targetX, targetY, targetW, targetH, 4);
      ctx.clip();
      ctx.drawImage(img, targetX, targetY, targetW, targetH);
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Renders Roblox 2D T-Shirt Decal (512x512)
 */
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
