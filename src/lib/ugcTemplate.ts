// Roblox Official 2D Clothing Template Generator (585 x 559 px) & 3D Avatar Preview
import * as THREE from "three";
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
  const ty = 74;
  const torsoHeight = isCrop ? 76 : 128;

  // A. Torso_Top (231, 8, 128, 64) - Shoulders & Neck Hole
  ctx.fillStyle = baseColor;
  ctx.fillRect(231, 8, 128, 64);
  applyFabricTexture(ctx, 231, 8, 128, 64);

  // Cut transparent circular neck hole at center of Torso_Top (295, 40)
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(295, 40, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw collar ribbing ring around neck hole
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(295, 40, 19.5, 0, Math.PI * 2);
  ctx.stroke();

  // Shoulder seam stitch lines
  drawDoubleStitch(ctx, 231, 8, 64, false, stitchColor);
  drawDoubleStitch(ctx, 358, 8, 64, false, stitchColor);

  // B. Torso_Front (231, 74, 128, torsoHeight)
  ctx.fillStyle = baseColor;
  ctx.fillRect(tx, ty, 128, torsoHeight);
  applyFabricTexture(ctx, tx, ty, 128, torsoHeight);

  // Crewneck scoop cutout at top center of front torso (295, 74)
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(295, 74, 18, 7, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // Crewneck ribbing trim along front scoop
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(295, 74, 19, 8, 0, 0, Math.PI);
  ctx.stroke();

  // C. Torso_Back (427, 74, 128, torsoHeight)
  ctx.fillStyle = baseColor;
  ctx.fillRect(427, ty, 128, torsoHeight);
  applyFabricTexture(ctx, 427, ty, 128, torsoHeight);

  // Subtle back collar trim curve
  ctx.strokeStyle = collarColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(491, 74, 16, 3, 0, 0, Math.PI);
  ctx.stroke();

  // D. Torso_Left (361, 74, 64, torsoHeight) & Torso_Right (165, 74, 64, torsoHeight)
  for (const sx of [165, 361]) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(sx, ty, 64, torsoHeight);
    applyFabricTexture(ctx, sx, ty, 64, torsoHeight);
    // Armpit fold shading
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(sx, ty, 4, 20);
    ctx.fillRect(sx + 60, ty, 4, 20);
  }

  // Torso_Down (underside/waist: 231, 204, 128, 64)
  if (!isCrop) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(231, 204, 128, 64);
    applyFabricTexture(ctx, 231, 204, 128, 64);
  }

  // E. Waist Hem: Double-needle stitched hem across bottom of torso
  const hemY = ty + torsoHeight - 3;
  for (const part of [{ x: 165, w: 64 }, { x: 231, w: 128 }, { x: 361, w: 64 }, { x: 427, w: 128 }]) {
    drawDoubleStitch(ctx, part.x, hemY, part.w, true, stitchColor);
  }

  // 2. ARMS & SLEEVES
  // Shoulder tops (R_Top: 217, 289, 64, 64 | L_Top: 308, 289, 64, 64)
  ctx.fillStyle = baseColor;
  ctx.fillRect(217, 289, 64, 64);
  ctx.fillRect(308, 289, 64, 64);
  applyFabricTexture(ctx, 217, 289, 64, 64);
  applyFabricTexture(ctx, 308, 289, 64, 64);

  // Arm vertical panels (Right arm: 19, 85, 151, 217 | Left arm: 308, 374, 440, 506)
  const armPanels = [19, 85, 151, 217, 308, 374, 440, 506];
  const sleeveHeight = isLong ? 128 : 52;

  for (const ax of armPanels) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(ax, 355, 64, sleeveHeight);
    applyFabricTexture(ctx, ax, 355, 64, sleeveHeight);

    // Sleeve Hem with double stitching
    drawDoubleStitch(ctx, ax, 355 + sleeveHeight - 3, 64, true, stitchColor);

    // Soft underarm fold shadow near top
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(ax, 355, 64, 8);
  }

  // If long sleeve or hoodie, fill hand/wrist bottom (Down): 217, 485, 64, 64 and 308, 485, 64, 64
  if (isLong) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(217, 485, 64, 64);
    ctx.fillRect(308, 485, 64, 64);
    applyFabricTexture(ctx, 217, 485, 64, 64);
    applyFabricTexture(ctx, 308, 485, 64, 64);
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
    { x: 231, y: 8, w: 128, h: 64 },
    { x: tx, y: ty, w: 128, h: torsoHeight },
    { x: 427, y: ty, w: 128, h: torsoHeight },
    { x: 165, y: ty, w: 64, h: torsoHeight },
    { x: 361, y: ty, w: 64, h: torsoHeight },
    { x: 217, y: 289, w: 64, h: 64 },
    { x: 308, y: 289, w: 64, h: 64 },
  ]);
}

/**
 * Draws a realistic metallic safety pin (alfinete de segurança)
 */
function drawDetailedSafetyPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angleRad: number,
  color: string = "#e4e4e7"
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Metallic shadow
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(2, 6);
  ctx.lineTo(2, h - 4);
  ctx.stroke();

  // Pin wire (needle & back bar)
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  // Back bar
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, h - 4);
  ctx.stroke();

  // Needle bar
  ctx.beginPath();
  ctx.moveTo(w - 2, 8);
  ctx.lineTo(0, h - 4);
  ctx.stroke();

  // Coiled spring loop at base
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, h - 3, 3, 0, Math.PI * 2);
  ctx.stroke();

  // Chrome head clasp
  const headGrad = ctx.createLinearGradient(0, 0, w, 7);
  headGrad.addColorStop(0, "#ffffff");
  headGrad.addColorStop(0.3, color);
  headGrad.addColorStop(0.8, "#71717a");
  headGrad.addColorStop(1, "#3f3f46");
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.roundRect(-2, 0, w + 3, 7, 2);
  ctx.fill();

  // Clasp latch slit
  ctx.fillStyle = "#09090b";
  ctx.fillRect(w - 3, 2, 2, 4);

  // Shiny metallic glint
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(1, 2.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a draped metallic ball/link chain in an elegant arc
 */
function drawDrapedChain(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  sag: number,
  color: string = "#e4e4e7"
) {
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = startX + (endX - startX) * t;
    const cy = startY + (endY - startY) * t + Math.sin(t * Math.PI) * sag;

    // Chain link shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = i % 2 === 0 ? color : "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws a cute satin ribbon bow (Jirai Kei / Coquette style)
 */
function drawJiraiKeiBow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accentColor: string = "#e4e4e7"
) {
  ctx.save();
  ctx.fillStyle = "#09090b";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;

  // Left loop
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy, 7, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Right loop
  ctx.beginPath();
  ctx.ellipse(cx + 7, cy, 7, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tails
  ctx.fillStyle = "#0c0c0e";
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 2);
  ctx.lineTo(cx - 6, cy + 12);
  ctx.lineTo(cx - 1, cy + 8);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 2, cy + 2);
  ctx.lineTo(cx + 6, cy + 12);
  ctx.lineTo(cx + 1, cy + 8);
  ctx.fill();

  // Center metallic jewel
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - 0.7, cy - 0.7, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renders a high-fashion, pixel-accurate Roblox Pleated Skirt (Jirai Kei / Goth / Y2K)
 * Covers lower torso (Y: 124..202) and upper thighs with pleats, double belt, safety pins & meias 7/8
 */
export async function drawPleatedSkirt(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const pColor = spec.primaryColor || "#111111"; // Deep black/charcoal fabric
  const metalColor = spec.accentColor || "#e4e4e7"; // Polished chrome / silver
  const waistColor = spec.secondaryColor || "#18181b"; // Leather belt / trim
  const skinColor = "#f0d0be"; // Realistic natural avatar thigh skin
  const sockColor = "#0d0d0f"; // Black thigh-high socks

  const t = (spec.title || "").toLowerCase();
  const d = (spec.details || []).map((x) => x.toLowerCase());
  const isJiraiKei = t.includes("jirai") || t.includes("goth") || t.includes("y2k") || d.some((i) => i.includes("jirai") || i.includes("goth"));
  const hasPins = t.includes("alfinete") || t.includes("pin") || d.some((i) => i.includes("pin") || i.includes("alfinete")) || isJiraiKei;
  const hasChains = t.includes("cinto") || t.includes("corrente") || t.includes("chain") || isJiraiKei;

  // Waist starts at high-waist position (Y = 124)
  // Chest (Y = 74..123) is 100% TRANSPARENT so avatar shirt/skin is preserved
  const waistY = 124;
  const waistH = 14;
  const skirtH = 202 - waistY; // ~78px down to lower torso bottom (Y = 202)

  // 1. SKIRT BODY ON TORSO (Torso Front: 231, Back: 427, Right: 165, Left: 361)
  const torsoPanels = [
    { x: 165, w: 64, name: "right" },
    { x: 231, w: 128, name: "front" },
    { x: 361, w: 64, name: "left" },
    { x: 427, w: 128, name: "back" },
  ];

  for (const p of torsoPanels) {
    // Fill skirt base fabric
    ctx.fillStyle = pColor;
    ctx.fillRect(p.x, waistY, p.w, skirtH);

    // Apply fabric texture & soft vertical shading
    applyFabricTexture(ctx, p.x, waistY, p.w, skirtH);

    // Render Crisp 3D Knife Pleats (Pregas Plissadas)
    const pleatWidth = 11;
    for (let px = p.x; px < p.x + p.w; px += pleatWidth) {
      const curW = Math.min(pleatWidth, p.x + p.w - px);

      // Pleat face gradient
      const pleatGrad = ctx.createLinearGradient(px, waistY, px + curW, waistY);
      pleatGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      pleatGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
      pleatGrad.addColorStop(0.9, "rgba(0, 0, 0, 0.45)");
      pleatGrad.addColorStop(1, "rgba(0, 0, 0, 0.7)");
      ctx.fillStyle = pleatGrad;
      ctx.fillRect(px, waistY + waistH, curW, skirtH - waistH);

      // Sharp highlight on fold ridge
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, waistY + waistH);
      ctx.lineTo(px, waistY + skirtH);
      ctx.stroke();

      // Deep shadow in the crease
      ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + curW - 0.5, waistY + waistH);
      ctx.lineTo(px + curW - 0.5, waistY + skirtH);
      ctx.stroke();
    }

    // Hem Lace Frill (Renda no babado da saia)
    const hemY = waistY + skirtH;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (let lx = p.x; lx < p.x + p.w; lx += 4) {
      ctx.beginPath();
      ctx.arc(lx + 2, hemY - 2, 2, 0, Math.PI);
      ctx.fill();
    }

    // High Waistband (Cós alto de couro com costura dupla)
    ctx.fillStyle = waistColor;
    ctx.fillRect(p.x, waistY, p.w, waistH);
    drawDoubleStitch(ctx, p.x, waistY + 1, p.w, true, "rgba(255, 255, 255, 0.15)");
    drawDoubleStitch(ctx, p.x, waistY + waistH - 2, p.w, true, "rgba(255, 255, 255, 0.15)");

    // Belt loops
    for (let bx = p.x + 8; bx < p.x + p.w; bx += 24) {
      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(bx, waistY, 3, waistH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeRect(bx, waistY, 3, waistH);
    }
  }

  // Underside / Petticoat shorts (231, 204, 128, 64)
  ctx.fillStyle = "#0c0c0e";
  ctx.fillRect(231, 204, 128, 64);
  applyFabricTexture(ctx, 231, 204, 128, 64);

  // 2. FRONT TORSO HARDWARE: Belt Buckle, Grommets, Safety Pins, Chains & Ribbon
  const frontX = 231;
  const frontY = waistY;

  // Double Leather Belt across front
  ctx.fillStyle = "#0d0d0f";
  ctx.fillRect(frontX + 10, frontY + 3, 108, 8);

  // Silver Grommets (ilhoses metálicos) along the belt
  for (let gx = frontX + 16; gx <= frontX + 112; gx += 12) {
    ctx.strokeStyle = metalColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(gx, frontY + 7, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#050507";
    ctx.beginPath();
    ctx.arc(gx, frontY + 7, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silver Belt Buckle at center
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(frontX + 57, frontY + 1.5, 14, 11);
  ctx.fillStyle = metalColor;
  ctx.fillRect(frontX + 63, frontY + 4, 2, 6); // Prong

  // SAFETY PINS (Alfinetes de Segurança) - Specifically requested!
  if (hasPins) {
    // Large prominent safety pin on Left-Front hip (X: 250..266, Y: 140..172)
    drawDetailedSafetyPin(ctx, frontX + 26, frontY + 18, 14, 28, -0.2, metalColor);
    // Second interlocking mini safety pin
    drawDetailedSafetyPin(ctx, frontX + 34, frontY + 30, 10, 20, 0.35, metalColor);
  }

  // AESTHETIC CHAINS (Correntes drapeadas Jirai Kei)
  if (hasChains) {
    drawDrapedChain(ctx, frontX + 44, frontY + 11, frontX + 84, frontY + 11, 16, metalColor);
    drawDrapedChain(ctx, frontX + 48, frontY + 11, frontX + 80, frontY + 11, 24, metalColor);
  }

  // Silk ribbon bow at center waist
  drawJiraiKeiBow(ctx, frontX + 64, frontY + 14, metalColor);

  // 3. LEGS: Skirt Flare, Thigh Skin, Thigh-High Socks (Meias 7/8), and Platform Shoes
  // Leg Top Panels (217, 289, 64, 64) and (308, 289, 64, 64)
  for (const tx of [217, 308]) {
    // Upper thigh base skin
    ctx.fillStyle = skinColor;
    ctx.fillRect(tx, 289, 64, 64);
    // Skirt shadow on top of thighs
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(tx, 289, 64, 20);
  }

  // 8 Leg Panels:
  // Right Leg: 19, 85, 151, 217
  // Left Leg: 308, 374, 440, 506
  const allLegPanels = [19, 85, 151, 217, 308, 374, 440, 506];

  for (const lx of allLegPanels) {
    // Upper thigh: exposed skin (Y: 355..400)
    ctx.fillStyle = skinColor;
    ctx.fillRect(lx, 355, 64, 45);
    applyFabricTexture(ctx, lx, 355, 64, 45);

    // Skirt flare overlap on top of thighs (Y: 355..372)
    ctx.fillStyle = pColor;
    ctx.fillRect(lx, 355, 64, 18);
    // Skirt pleat shadows on thigh
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    for (let sx = lx; sx < lx + 64; sx += 11) {
      ctx.strokeRect(sx, 355, 11, 18);
    }
    // Lace trim along skirt hem
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let fx = lx; fx < lx + 64; fx += 4) {
      ctx.beginPath();
      ctx.arc(fx + 2, 372, 2, 0, Math.PI);
      ctx.fill();
    }

    // Soft thigh shadow under skirt
    const shadowGrad = ctx.createLinearGradient(lx, 373, lx, 385);
    shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.35)");
    shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(lx, 373, 64, 12);

    // THIGH-HIGH SOCKS (Meias 7/8 Pretas): Y: 400..495
    // Lace garter cuff at top of sock (Y: 400..408)
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(lx, 400, 64, 4);
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(lx, 404, 64, 4);

    // Sock Body (Y: 408..495)
    ctx.fillStyle = sockColor;
    ctx.fillRect(lx, 408, 64, 87);
    applyFabricTexture(ctx, lx, 408, 64, 87);

    // Ribbed sock vertical weave
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let rx = lx + 4; rx < lx + 64; rx += 5) {
      ctx.beginPath();
      ctx.moveTo(rx, 408);
      ctx.lineTo(rx, 495);
      ctx.stroke();
    }

    // PLATFORM MARY JANE SHOES (Y: 495..535)
    ctx.fillStyle = "#050507"; // Glossy black leather shoe
    ctx.fillRect(lx, 495, 64, 40);
    // Platform sole
    ctx.fillStyle = "#121216";
    ctx.fillRect(lx, 525, 64, 10);
    // White sock cuff peeking or silver shoe buckle
    ctx.fillStyle = metalColor;
    ctx.fillRect(lx + 24, 502, 16, 4);
  }

  // Feet Bottoms (R: 217, 485 | L: 308, 485)
  for (const bx of [217, 308]) {
    ctx.fillStyle = "#050507";
    ctx.fillRect(bx, 485, 64, 64);
  }
}

/**
 * Renders authentic, highly detailed Y2K / Streetwear Baggy Cargo Pants
 * with realistic 3D bellows utility pockets, chrome chains, D-rings,
 * dual-grommet eyelet belt, baggy fabric creases/folds, and platform skate shoes.
 */
export async function drawCargoBaggyPants(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const pColor = spec.primaryColor || "#101014"; // Jet black matte cargo fabric
  const metalColor = spec.accentColor || "#e2e8f0"; // Polished chrome hardware
  const waistColor = spec.secondaryColor || "#09090b";
  const seamColor = "rgba(255, 255, 255, 0.12)";

  const waistY = 130;
  const pelvisH = 202 - waistY; // 72px
  const waistH = 14;

  const torsoPanels = [
    { x: 231, w: 128 }, // Front
    { x: 427, w: 128 }, // Back
    { x: 165, w: 64 },  // Right
    { x: 361, w: 64 },  // Left
  ];

  // 1. LOWER TORSO PANELS (Pelvis: Y = 130..202)
  for (const p of torsoPanels) {
    // Fill deep cargo fabric
    ctx.fillStyle = pColor;
    ctx.fillRect(p.x, waistY, p.w, pelvisH);
    applyFabricTexture(ctx, p.x, waistY, p.w, pelvisH);

    // Subtle vertical fabric shading
    const grad = ctx.createLinearGradient(p.x, waistY, p.x + p.w, waistY);
    grad.addColorStop(0, "rgba(0,0,0,0.2)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.03)");
    grad.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, waistY, p.w, pelvisH);

    // Skater Waistband
    ctx.fillStyle = waistColor;
    ctx.fillRect(p.x, waistY, p.w, waistH);
    drawDoubleStitch(ctx, p.x, waistY + 1, p.w, true, seamColor);
    drawDoubleStitch(ctx, p.x, waistY + waistH - 2, p.w, true, seamColor);

    // Belt Loops
    for (let bx = p.x + 10; bx < p.x + p.w; bx += 26) {
      ctx.fillStyle = "#050507";
      ctx.fillRect(bx, waistY, 4, waistH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeRect(bx, waistY, 4, waistH);
    }
  }

  // Underside crotch
  ctx.fillStyle = "#09090b";
  ctx.fillRect(231, 204, 128, 64);
  applyFabricTexture(ctx, 231, 204, 128, 64);

  // FRONT TORSO HARDWARE (Belt, Dual Grommets, Roller Buckle, Chrome Chains, Riveted Hand Pockets, Fly Zipper)
  const frontX = 231;
  const frontY = waistY;

  // Front Skater Belt
  ctx.fillStyle = "#070709";
  ctx.fillRect(frontX + 8, frontY + 3, 112, 8);

  // Dual rows of chrome eyelets/grommets along belt
  for (let gx = frontX + 16; gx <= frontX + 112; gx += 10) {
    for (const gy of [frontY + 4.5, frontY + 8.5]) {
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(gx, gy, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Silver Roller Buckle at center
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(frontX + 56, frontY + 2, 16, 10);
  ctx.fillStyle = metalColor;
  ctx.fillRect(frontX + 63, frontY + 3.5, 2.5, 7); // Center prong

  // Fly Zipper with metal slider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(frontX + 64, frontY + waistH);
  ctx.lineTo(frontX + 64, frontY + 54);
  ctx.stroke();

  // Curved Deep Hand Pockets with chrome rivets
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(frontX + 16, frontY + waistH, 22, 0, 0.45 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(frontX + 112, frontY + waistH, 22, 0.55 * Math.PI, Math.PI);
  ctx.stroke();

  // Pocket corner chrome rivets
  for (const [rx, ry] of [
    [frontX + 16 + Math.cos(0.45 * Math.PI) * 22, frontY + waistH + Math.sin(0.45 * Math.PI) * 22],
    [frontX + 112 + Math.cos(0.55 * Math.PI) * 22, frontY + waistH + Math.sin(0.55 * Math.PI) * 22],
    [frontX + 37, frontY + waistH + 1],
    [frontX + 91, frontY + waistH + 1],
  ]) {
    ctx.fillStyle = metalColor;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heavy Chrome Curb Chain (Draping diagonally across right front thigh)
  drawDrapedChain(ctx, frontX + 36, frontY + 7, frontX + 18, frontY + 48, 14, metalColor);
  drawDrapedChain(ctx, frontX + 38, frontY + 7, frontX + 22, frontY + 48, 22, metalColor);

  // Silver D-ring hanging from left belt loop
  ctx.strokeStyle = metalColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(frontX + 90, frontY + waistH + 1, 6, 6);

  // Hanging nylon utility strap with white stitch
  ctx.fillStyle = "#0c0c0e";
  ctx.fillRect(frontX + 91, frontY + waistH + 7, 4, 20);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(frontX + 91, frontY + waistH + 7, 4, 20);
  ctx.fillStyle = metalColor;
  ctx.fillRect(frontX + 90, frontY + waistH + 26, 6, 3);

  // BACK TORSO PANELS (X: 427): 2 Large Utility Back Pockets
  const backX = 427;
  const backY = waistY;
  for (const px of [backX + 14, backX + 70]) {
    ctx.fillStyle = "#0c0c0e";
    ctx.fillRect(px, backY + 20, 44, 40);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, backY + 20, 44, 40);

    ctx.fillStyle = "#141418";
    ctx.fillRect(px - 1, backY + 16, 46, 10);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.strokeRect(px - 1, backY + 16, 46, 10);

    ctx.fillStyle = metalColor;
    ctx.beginPath();
    ctx.arc(px + 22, backY + 21, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. THIGH TOPS (217 & 308 at Y = 289..353)
  for (const tx of [217, 308]) {
    ctx.fillStyle = pColor;
    ctx.fillRect(tx, 289, 64, 64);
    applyFabricTexture(ctx, tx, 289, 64, 64);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx + 0.5, 289.5, 63, 63);
  }

  // 3. LEGS: 8 Panels at Y = 355..483
  const allLegPanels = [19, 85, 151, 217, 308, 374, 440, 506];

  for (const lx of allLegPanels) {
    ctx.fillStyle = pColor;
    ctx.fillRect(lx, 355, 64, 128);
    applyFabricTexture(ctx, lx, 355, 64, 128);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx + 32, 355);
    ctx.lineTo(lx + 32, 355 + 128);
    ctx.stroke();

    const isOuter = lx === 19 || lx === 151 || lx === 374 || lx === 506;
    const isFront = lx === 217 || lx === 308;

    if (isOuter) {
      // 3D BELLOWS CARGO POCKET
      const pkX = lx + 9;
      const pkY = 384;
      const pkW = 46;
      const pkH = 46;

      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(pkX + 2, pkY + 2, pkW, pkH);

      ctx.fillStyle = "#121217";
      ctx.fillRect(pkX, pkY, pkW, pkH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 1;
      ctx.strokeRect(pkX, pkY, pkW, pkH);

      ctx.fillStyle = "#0a0a0d";
      ctx.fillRect(pkX + 19, pkY, 8, pkH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.strokeRect(pkX + 19, pkY, 8, pkH);

      ctx.fillStyle = "#1a1a22";
      ctx.fillRect(pkX - 2, pkY - 4, pkW + 4, 13);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.strokeRect(pkX - 2, pkY - 4, pkW + 4, 13);

      ctx.fillStyle = metalColor;
      ctx.beginPath();
      ctx.arc(pkX + 10, pkY + 2.5, 2, 0, Math.PI * 2);
      ctx.arc(pkX + pkW - 10, pkY + 2.5, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#09090b";
      ctx.fillRect(pkX + 20, pkY + pkH, 6, 18);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.strokeRect(pkX + 20, pkY + pkH, 6, 18);

      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pkX + 19, pkY + pkH + 18, 8, 5);

      ctx.fillStyle = "#0f0f13";
      ctx.fillRect(pkX + 4, 444, 38, 22);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeRect(pkX + 4, 444, 38, 22);
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(pkX + 7, 448);
      ctx.lineTo(pkX + 39, 448);
      ctx.stroke();
    }

    if (isFront) {
      const fX = lx + 10;
      ctx.fillStyle = "#121217";
      ctx.fillRect(fX, 368, 44, 26);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.strokeRect(fX, 368, 44, 26);
      drawDoubleStitch(ctx, fX, 372, 44, true, seamColor);

      // KNEE ARTICULATION DARTS & BAGGY FOLD WRINKLES
      const folds = [
        { y: 408, deep: true },
        { y: 416, deep: false },
        { y: 424, deep: true },
        { y: 432, deep: false },
      ];

      for (const fold of folds) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.lineWidth = fold.deep ? 2.0 : 1.2;
        ctx.beginPath();
        ctx.moveTo(lx + 4, fold.y);
        ctx.quadraticCurveTo(lx + 32, fold.y + 4, lx + 60, fold.y);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + 4, fold.y - 1.5);
        ctx.quadraticCurveTo(lx + 32, fold.y + 2.5, lx + 60, fold.y - 1.5);
        ctx.stroke();
      }

      // SHIN STACKING WRINKLES
      const shinFolds = [446, 455, 464, 472];
      for (const sy of shinFolds) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(lx + 6, sy);
        ctx.quadraticCurveTo(lx + 32, sy + 3, lx + 58, sy);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(lx + 6, sy - 1.2);
        ctx.quadraticCurveTo(lx + 32, sy + 1.8, lx + 58, sy - 1.2);
        ctx.stroke();
      }

      ctx.fillStyle = "#0c0c0e";
      ctx.fillRect(lx, 478, 64, 5);
      drawDoubleStitch(ctx, lx, 478, 64, true, seamColor);

      ctx.fillStyle = metalColor;
      ctx.fillRect(lx + 50, 479, 4, 3);
    }

    // HEAVY PLATFORM SKATE SHOES
    ctx.fillStyle = "#070709";
    ctx.fillRect(lx, 485, 64, 50);

    ctx.fillStyle = "#18181c";
    ctx.fillRect(lx, 518, 64, 16);

    ctx.fillStyle = "#000000";
    for (let tx = lx; tx < lx + 64; tx += 8) {
      ctx.fillRect(tx + 2, 528, 4, 6);
    }

    if (isFront) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.2;
      for (let ly = 492; ly <= 512; ly += 5) {
        ctx.beginPath();
        ctx.moveTo(lx + 20, ly);
        ctx.lineTo(lx + 44, ly + 2.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lx + 44, ly);
        ctx.lineTo(lx + 20, ly + 2.5);
        ctx.stroke();
      }
    }
  }

  for (const bx of [217, 308]) {
    ctx.fillStyle = "#070709";
    ctx.fillRect(bx, 485, 64, 64);
    ctx.fillStyle = "#18181c";
    for (let gx = bx + 6; gx < bx + 58; gx += 12) {
      for (let gy = 491; gy < 543; gy += 12) {
        ctx.fillRect(gx, gy, 8, 8);
      }
    }
  }
}

/**
 * Renders authentic, clean Roblox Pants / Jeans / Cargo / Skirt
 */
async function renderClassicRobloxPants(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const t = (spec.title || "").toLowerCase();
  const d = (spec.details || []).map((x) => x.toLowerCase());
  const isSkirt = d.some((i) => i.includes("skirt") || i.includes("saia") || i.includes("pleat")) || t.includes("skirt") || t.includes("saia") || t.includes("jirai");
  const isMinion = t.includes("minion") || spec.theme.includes("minion");

  if (isMinion) {
    drawMinionPants(ctx, spec);
    return;
  }

  if (isSkirt) {
    await drawPleatedSkirt(ctx, spec);
    return;
  }

  // All streetwear, baggy, cargo or dark pants render with the rich Baggy Cargo engine!
  await drawCargoBaggyPants(ctx, spec);
}


/**
 * Draws refined, compact chest emblems that look aesthetic and proportional on avatars
 */
function drawChestEmblem(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const cx = 295; // Center of Torso_Front
  const cy = 118; // Upper chest (Torso_Front Y: 74..202, collar scoop is 74..81)
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
    drawStreetwearChainAndPocket(ctx, 231, 74);
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
  const ty = 74;

  const denimGrad = ctx.createLinearGradient(tx, ty, tx, ty + 128);
  denimGrad.addColorStop(0, "#2563eb");
  denimGrad.addColorStop(1, "#1d4ed8");

  ctx.fillStyle = denimGrad;
  ctx.fillRect(tx, ty, 128, 128);
  ctx.fillRect(427, ty, 128, 128);
  ctx.fillRect(165, ty, 64, 128);
  ctx.fillRect(361, ty, 64, 128);
  ctx.fillRect(231, 204, 128, 64); // Crotch underside

  ctx.fillStyle = "#1e40af";
  ctx.fillRect(tx, ty, 128, 12);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, ty, 128, 12);

  // Thigh tops
  ctx.fillStyle = denimGrad;
  ctx.fillRect(217, 289, 64, 64);
  ctx.fillRect(308, 289, 64, 64);

  const legPanels = [19, 85, 151, 217, 308, 374, 440, 506];
  for (const lx of legPanels) {
    ctx.fillStyle = denimGrad;
    ctx.fillRect(lx, 355, 64, 104);

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx + 32, 355); ctx.lineTo(lx + 32, 355 + 104); ctx.stroke();

    // Yellow sock / cuff
    ctx.fillStyle = "#facc15";
    ctx.fillRect(lx, 355 + 104, 64, 24);
    ctx.strokeStyle = "#fbbf24";
    ctx.strokeRect(lx, 355 + 104, 64, 24);
  }

  // Black shoes bottom
  ctx.fillStyle = "#18181b";
  ctx.fillRect(217, 485, 64, 64);
  ctx.fillRect(308, 485, 64, 64);
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
      const targetY = 74 + 20;

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
 * Maps the 6 faces of a Three.js BoxGeometry to exact pixel coordinates
 * on the official Roblox 585 x 559 Classic Clothing template.
 */
function applyBoxGeometryRobloxUVs(
  geometry: THREE.BoxGeometry,
  rects: {
    right: [number, number, number, number];  // Face 0 (+X)
    left: [number, number, number, number];   // Face 1 (-X)
    top: [number, number, number, number];    // Face 2 (+Y)
    bottom: [number, number, number, number]; // Face 3 (-Y)
    front: [number, number, number, number];  // Face 4 (+Z)
    back: [number, number, number, number];   // Face 5 (-Z)
  }
) {
  const uvAttr = geometry.attributes.uv;
  const faces = [rects.right, rects.left, rects.top, rects.bottom, rects.front, rects.back];

  for (let f = 0; f < 6; f++) {
    const r = faces[f];
    const [px, py, pw, ph] = r;
    const u0 = px / 585;
    const u1 = (px + pw) / 585;
    const vTop = 1.0 - py / 559;
    const vBottom = 1.0 - (py + ph) / 559;

    const base = f * 4;
    uvAttr.setXY(base + 0, u0, vTop);
    uvAttr.setXY(base + 1, u1, vTop);
    uvAttr.setXY(base + 2, u0, vBottom);
    uvAttr.setXY(base + 3, u1, vBottom);
  }
  uvAttr.needsUpdate = true;
}

/**
 * Creates the classic Roblox smiley face texture
 */
function createRobloxClassicFace(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.ellipse(82, 98, 14, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(174, 98, 14, 21, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(77, 90, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(169, 90, 5.5, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(128, 136, 44, 0.18 * Math.PI, 0.82 * Math.PI, false);
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.arc(88, 160, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(168, 160, 5, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds composite texture for avatar mannequin
 */
async function buildAvatarCompositeTexture(
  templateDataUrl: string,
  kind: UgcClothingKind = "shirt"
): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = 585;
  canvas.height = 559;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const skinColor = "#e5e7eb";

  if (kind === "pants") {
    ctx.fillStyle = skinColor;
    ctx.fillRect(231, 74, 128, 56);
    ctx.fillRect(427, 74, 128, 56);
    ctx.fillRect(165, 74, 64, 56);
    ctx.fillRect(361, 74, 64, 56);
    ctx.fillRect(231, 10, 128, 64);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(231, 74, 128, 38);
    ctx.fillRect(427, 74, 128, 38);
    ctx.fillRect(165, 74, 64, 38);
    ctx.fillRect(361, 74, 64, 38);

    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(231 + 64, 74, 22, 12, 0, 0, Math.PI);
    ctx.fill();

    const armPanels = [19, 85, 151, 217, 308, 374, 440, 506];
    ctx.fillStyle = skinColor;
    for (const ax of armPanels) {
      ctx.fillRect(ax, 355, 64, 128);
    }
  } else if (kind === "shirt") {
    ctx.fillStyle = "#18181b";
    const legPanels = [19, 85, 151, 217, 308, 374, 440, 506];
    for (const lx of legPanels) {
      ctx.fillRect(lx, 355, 64, 128);
    }
    ctx.fillStyle = skinColor;
    for (const lx of legPanels) {
      ctx.fillRect(lx, 355 + 104, 64, 24);
    }
  } else {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(231, 74, 128, 128);
    ctx.fillRect(427, 74, 128, 128);
    ctx.fillRect(165, 74, 64, 128);
    ctx.fillRect(361, 74, 64, 128);
  }

  if (templateDataUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 585, 559);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = templateDataUrl;
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Generates an authentic 3D Avatar Roblox R6 Mannequin Thumbnail wearing the clothing
 * Matching the exact look of official Roblox catalog thumbnails!
 */
export async function renderAvatarPreview(
  templateDataUrl: string,
  kind: UgcClothingKind = "shirt"
): Promise<string> {
  if (typeof window === "undefined" || !document) return templateDataUrl;

  try {
    const width = 320;
    const height = 320;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.4, 7.0);
    camera.lookAt(0, 0.1, 0);

    // Studio Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(4, 6, 5);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x60a5fa, 0.7);
    rim.position.set(-4, 3, -5);
    scene.add(rim);

    // Ground Shadow Disc
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext("2d");
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.6)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.25)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -2.99;
    scene.add(shadowMesh);

    // Avatar Group
    const avatar = new THREE.Group();
    avatar.rotation.y = 0.35; // Classic 3/4 catalog angle
    scene.add(avatar);

    // Head
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.35, metalness: 0.05 });
    const faceTex = createRobloxClassicFace();
    const headMat = [
      skinMat, skinMat, skinMat, skinMat,
      new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.35, metalness: 0.05 }),
      skinMat
    ];
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), headMat);
    head.position.set(0, 1.625, 0);
    avatar.add(head);

    const stud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.1 })
    );
    stud.position.set(0, 2.34, 0);
    avatar.add(stud);

    // Composite Clothing Texture
    const compTex = await buildAvatarCompositeTexture(templateDataUrl, kind);
    const clothingMat = new THREE.MeshStandardMaterial({ map: compTex, roughness: 0.4, metalness: 0.08 });

    // Torso, Arms, Legs with Roblox UVs
    const torsoGeo = new THREE.BoxGeometry(2, 2, 1);
    applyBoxGeometryRobloxUVs(torsoGeo, {
      right: [361, 74, 64, 128],
      left: [165, 74, 64, 128],
      top: [231, 10, 128, 64],
      bottom: [231, 204, 128, 64],
      front: [231, 74, 128, 128],
      back: [427, 74, 128, 128],
    });
    const torso = new THREE.Mesh(torsoGeo, clothingMat);
    avatar.add(torso);

    const rArmGeo = new THREE.BoxGeometry(1, 2, 1);
    applyBoxGeometryRobloxUVs(rArmGeo, {
      right: [19, 355, 64, 128],
      left: [151, 355, 64, 128],
      top: [217, 289, 64, 64],
      bottom: [217, 485, 64, 64],
      front: [217, 355, 64, 128],
      back: [85, 355, 64, 128],
    });
    const rArm = new THREE.Mesh(rArmGeo, clothingMat);
    rArm.position.set(-1.5, 0, 0);
    avatar.add(rArm);

    const lArmGeo = new THREE.BoxGeometry(1, 2, 1);
    applyBoxGeometryRobloxUVs(lArmGeo, {
      right: [374, 355, 64, 128],
      left: [506, 355, 64, 128],
      top: [308, 289, 64, 64],
      bottom: [308, 485, 64, 64],
      front: [308, 355, 64, 128],
      back: [440, 355, 64, 128],
    });
    const lArm = new THREE.Mesh(lArmGeo, clothingMat);
    lArm.position.set(1.5, 0, 0);
    avatar.add(lArm);

    const rLegGeo = new THREE.BoxGeometry(1, 2, 1);
    applyBoxGeometryRobloxUVs(rLegGeo, {
      right: [19, 355, 64, 128],
      left: [151, 355, 64, 128],
      top: [217, 289, 64, 64],
      bottom: [217, 485, 64, 64],
      front: [217, 355, 64, 128],
      back: [85, 355, 64, 128],
    });
    const rLeg = new THREE.Mesh(rLegGeo, clothingMat);
    rLeg.position.set(-0.5, -2, 0);
    avatar.add(rLeg);

    const lLegGeo = new THREE.BoxGeometry(1, 2, 1);
    applyBoxGeometryRobloxUVs(lLegGeo, {
      right: [374, 355, 64, 128],
      left: [506, 355, 64, 128],
      top: [308, 289, 64, 64],
      bottom: [308, 485, 64, 64],
      front: [308, 355, 64, 128],
      back: [440, 355, 64, 128],
    });
    const lLeg = new THREE.Mesh(lLegGeo, clothingMat);
    lLeg.position.set(0.5, -2, 0);
    avatar.add(lLeg);

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL("image/png");

    renderer.dispose();
    torsoGeo.dispose();
    rArmGeo.dispose();
    lArmGeo.dispose();
    rLegGeo.dispose();
    lLegGeo.dispose();

    return dataUrl;
  } catch (err) {
    console.warn("3D Avatar preview generation fallback:", err);
    return templateDataUrl;
  }
}
