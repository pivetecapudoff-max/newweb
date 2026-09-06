// Roblox Official 2D Clothing Template Generator (585 x 559 px)
export type UgcClothingKind = "shirt" | "pants" | "tshirt";

export interface UgcDesignSpec {
  title: string;
  kind: UgcClothingKind;
  price: number;
  description: string;
  tags: string[];
  theme: string;
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

  // Clear with transparency
  ctx.clearRect(0, 0, 585, 559);

  // If tshirt: Roblox T-shirt is a single 512x512 graphic or 128x128 chest decal
  if (spec.kind === "tshirt") {
    return renderTshirtGraphic(spec);
  }

  // Draw UV Sections for Shirt or Pants
  // 1. Torso
  const torsoSections = [
    { name: "Torso_Top", x: 231, y: 74, w: 128, h: 64 },
    { name: "Torso_Front", x: 231, y: 138, w: 128, h: 128 },
    { name: "Torso_Back", x: 423, y: 138, w: 128, h: 128 },
    { name: "Torso_Left", x: 367, y: 138, w: 64, h: 128 },
    { name: "Torso_Right", x: 159, y: 138, w: 64, h: 128 },
    { name: "Torso_Bottom", x: 231, y: 274, w: 128, h: 64 },
  ];

  // 2. Right Arm / Right Leg
  const rightLimbSections = [
    { name: "R_Top", x: 85, y: 342, w: 64, h: 64 },
    { name: "R_Front", x: 85, y: 406, w: 64, h: 128 },
    { name: "R_Back", x: 213, y: 406, w: 64, h: 128 },
    { name: "R_Left", x: 149, y: 406, w: 64, h: 128 },
    { name: "R_Right", x: 21, y: 406, w: 64, h: 128 },
    { name: "R_Bottom", x: 85, y: 478, w: 64, h: 64 },
  ];

  // 3. Left Arm / Left Leg
  const leftLimbSections = [
    { name: "L_Top", x: 341, y: 342, w: 64, h: 64 },
    { name: "L_Front", x: 341, y: 406, w: 64, h: 128 },
    { name: "L_Back", x: 469, y: 406, w: 64, h: 128 },
    { name: "L_Left", x: 405, y: 406, w: 64, h: 128 },
    { name: "L_Right", x: 277, y: 406, w: 64, h: 128 },
    { name: "L_Bottom", x: 341, y: 478, w: 64, h: 64 },
  ];

  const allSections = [...torsoSections, ...rightLimbSections, ...leftLimbSections];

  // Fill each section with base primary color + texture
  for (const s of allSections) {
    drawSectionBase(ctx, s.x, s.y, s.w, s.h, spec);
  }

  // Draw specialized clothing details based on kind & theme
  if (spec.kind === "shirt") {
    drawShirtDetails(ctx, spec);
  } else {
    drawPantsDetails(ctx, spec);
  }

  // If user provided a reference image, composite it tastefully on the torso front
  if (spec.referenceImageDataUrl) {
    try {
      await overlayReferenceImage(ctx, spec.referenceImageDataUrl);
    } catch {
      // ignore image load error and use synthetic design
    }
  }

  // Add realistic clothing shading, folds, seams and stitch lines
  applyRealisticShading(ctx, allSections);

  return canvas.toDataURL("image/png");
}

function drawSectionBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spec: UgcDesignSpec
) {
  // Base fill
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, spec.primaryColor || "#18181b");
  grad.addColorStop(1, spec.secondaryColor || "#09090b");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Pattern overlays
  if (spec.pattern === "stripes") {
    ctx.strokeStyle = `${spec.accentColor}33`;
    ctx.lineWidth = 2;
    for (let lx = x; lx < x + w; lx += 8) {
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, y + h);
      ctx.stroke();
    }
  } else if (spec.pattern === "stars") {
    ctx.fillStyle = `${spec.accentColor}44`;
    for (let i = 0; i < 6; i++) {
      const sx = x + Math.random() * (w - 10);
      const sy = y + Math.random() * (h - 10);
      drawStar(ctx, sx, sy, 3, 5, 2);
    }
  } else if (spec.pattern === "acid_wash" || spec.pattern === "grunge") {
    // Noise/splatter effect
    for (let i = 0; i < 25; i++) {
      const nx = x + Math.random() * w;
      const ny = y + Math.random() * h;
      const radius = 2 + Math.random() * 5;
      ctx.fillStyle = `${spec.accentColor}18`;
      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawShirtDetails(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  // Torso Front (231, 138, 128, 128)
  const tx = 231;
  const ty = 138;
  const t = (spec.title || "").toLowerCase();
  const d = spec.details || [];
  const th = (spec.theme || "").toLowerCase();

  const isMinion =
    t.includes("minion") ||
    d.some((item) => item.includes("minion") || item.includes("goggle")) ||
    th.includes("minion");

  const isOffShoulder = d.some((item) => item.includes("shoulder")) || t.includes("off shoulder") || t.includes("off-shoulder");

  // Minion Shirt takes full thematic control over torso and limbs
  if (isMinion) {
    drawMinionShirt(ctx, tx, ty, spec, isOffShoulder);
    return;
  }

  const hasBow = d.some((item) => item.includes("bow") || item.includes("ribbon") || item.includes("୨୧")) || t.includes("bow") || spec.theme === "moe" || spec.theme === "jiraikei" || spec.theme === "coquette";
  const hasLace = d.some((item) => item.includes("lace") || item.includes("ruffles")) || spec.theme === "jiraikei" || spec.theme === "vkei";
  const hasArmWarmers = d.some((item) => item.includes("warmers") || item.includes("sleeve")) || t.includes("arm") || spec.theme === "vkei" || spec.theme === "emogirl";

  const isBatman = t.includes("batman") || d.some((item) => item.includes("batman") || item.includes("bat-"));
  const isSpiderman = t.includes("spiderman") || t.includes("spider-man") || t.includes("spider") || d.some((item) => item.includes("spider"));
  const isHelloKitty = t.includes("hello kitty") || t.includes("hellokitty") || (t.includes("kitty") && !t.includes("cat")) || d.some((item) => item.includes("kitty"));
  const isKuromi = t.includes("kuromi") || d.some((item) => item.includes("kuromi"));
  const isCat = t.includes("cat") || t.includes("gatinho") || d.some((item) => item.includes("cat"));
  const isHeart = t.includes("heart") || t.includes("coração") || t.includes("coracao") || d.some((item) => item.includes("heart"));
  const isSkull = t.includes("skull") || t.includes("caveira") || d.some((item) => item.includes("skull"));
  const isButterfly = t.includes("butterfly") || t.includes("borboleta") || d.some((item) => item.includes("butterfly"));
  const isFlame = t.includes("flame") || t.includes("fire") || t.includes("fogo") || d.some((item) => item.includes("flame"));

  // Neckline & Shoulders
  if (isOffShoulder) {
    // Off-shoulder cut: low horizontal neckline exposing shoulders
    ctx.fillStyle = "#050508";
    ctx.beginPath();
    ctx.ellipse(tx + 64, ty + 18, 48, 14, 0, 0, Math.PI);
    ctx.fill();

    // Delicate spaghetti straps
    ctx.strokeStyle = spec.accentColor || "#f4f4f5";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(tx + 32, ty);
    ctx.lineTo(tx + 36, ty + 24);
    ctx.moveTo(tx + 96, ty);
    ctx.lineTo(tx + 92, ty + 24);
    ctx.stroke();

    // Choker / Collar
    ctx.fillStyle = spec.secondaryColor || "#09090b";
    ctx.fillRect(tx + 44, ty + 4, 40, 6);
    ctx.strokeStyle = spec.accentColor || "#a855f7";
    ctx.strokeRect(tx + 44, ty + 4, 40, 6);
  } else {
    // Standard Collar
    ctx.fillStyle = "#09090b";
    ctx.beginPath();
    ctx.ellipse(tx + 64, ty + 12, 28, 14, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = spec.accentColor || "#a855f7";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Scalloped Lace Trim
  if (hasLace) {
    ctx.fillStyle = spec.accentColor || "#ffffff";
    const laceY = isOffShoulder ? ty + 22 : ty + 14;
    for (let lx = tx + 24; lx <= tx + 104; lx += 8) {
      ctx.beginPath();
      ctx.arc(lx, laceY, 2.5, 0, Math.PI);
      ctx.fill();
    }
  }

  // Center zipper or jacket cut
  if (d.some((item) => item.includes("zipper") || item.includes("jacket") || item.includes("puffer"))) {
    ctx.strokeStyle = "#71717a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx + 64, ty + 26);
    ctx.lineTo(tx + 64, ty + 128);
    ctx.stroke();

    ctx.fillStyle = spec.accentColor || "#e4e4e7";
    ctx.fillRect(tx + 62, ty + 40, 4, 6);
  }

  // Syn night shop signature Bow Ribbon
  if (hasBow) {
    drawRibbonBow(ctx, tx + 64, isOffShoulder ? ty + 30 : ty + 24, spec.accentColor || "#f472b6");
  }

  // Chest Graphic / Character Logo / Aesthetic Emblem
  if (isBatman) {
    drawBatmanChestGraphic(ctx, tx + 64, ty + 64);
  } else if (isSpiderman) {
    drawSpidermanChestGraphic(ctx, tx + 64, ty + 64);
  } else if (isHelloKitty) {
    drawHelloKittyGraphic(ctx, tx + 64, ty + 64);
  } else if (isKuromi) {
    drawKuromiGraphic(ctx, tx + 64, ty + 64);
  } else if (isSkull) {
    drawSkullGraphic(ctx, tx + 64, ty + 64, spec.accentColor || "#e4e4e7");
  } else if (isHeart) {
    drawHeartGraphic(ctx, tx + 64, ty + 64, spec.accentColor || "#f43f5e");
  } else if (isButterfly) {
    drawButterflyGraphic(ctx, tx + 64, ty + 64, spec.accentColor || "#c084fc");
  } else if (isFlame) {
    drawFlameGraphic(ctx, tx + 64, ty + 64, spec.accentColor || "#f97316");
  } else if (isCat) {
    drawCatChestGraphic(ctx, tx + 64, ty + 64, spec.accentColor || "#ffffff");
  } else {
    drawAestheticChestEmblem(ctx, tx + 64, ty + 64, spec.accentColor || "#c084fc");
  }

  // Arm Warmers / Sleeves
  if (hasArmWarmers) {
    // Striped gothic/emo arm warmers on lower arms
    const drawArmWarmerStripes = (lx: number, ly: number) => {
      ctx.fillStyle = spec.secondaryColor || "#000000";
      ctx.fillRect(lx, ly + 50, 64, 78);
      ctx.strokeStyle = `${spec.accentColor || "#ffffff"}55`;
      ctx.lineWidth = 3;
      for (let sy = ly + 56; sy < ly + 120; sy += 12) {
        ctx.beginPath();
        ctx.moveTo(lx, sy);
        ctx.lineTo(lx + 64, sy);
        ctx.stroke();
      }
    };
    drawArmWarmerStripes(85, 406);
    drawArmWarmerStripes(341, 406);
    drawArmWarmerStripes(21, 406);
    drawArmWarmerStripes(277, 406);
  } else {
    // Normal Sleeve cuffs
    ctx.fillStyle = spec.secondaryColor || "#000000";
    ctx.fillRect(85, 406 + 118, 64, 10);
    ctx.fillRect(341, 406 + 118, 64, 10);
    ctx.fillRect(21, 406 + 118, 64, 10);
    ctx.fillRect(277, 406 + 118, 64, 10);

    ctx.strokeStyle = spec.accentColor || "#c084fc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(85, 406 + 118);
    ctx.lineTo(85 + 64, 406 + 118);
    ctx.moveTo(341, 406 + 118);
    ctx.lineTo(341 + 64, 406 + 118);
    ctx.stroke();
  }
}

function drawPantsDetails(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const tx = 231;
  const ty = 138;
  const t = (spec.title || "").toLowerCase();
  const d = spec.details || [];
  const th = (spec.theme || "").toLowerCase();

  const isMinion =
    t.includes("minion") ||
    d.some((item) => item.includes("minion") || item.includes("goggle")) ||
    th.includes("minion");

  if (isMinion) {
    drawMinionPants(ctx, spec);
    return;
  }

  const isSkirt = d.some((item) => item.includes("skirt") || item.includes("pleated")) || t.includes("skirt") || t.includes("saia");
  const isPjs = d.some((item) => item.includes("pj") || item.includes("pajama")) || t.includes("pj") || t.includes("pajama");

  // Waistband & Belt
  ctx.fillStyle = "#09090b";
  ctx.fillRect(tx, ty, 128, 14);
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, ty, 128, 14);

  // Belt Loops & Buckle
  ctx.fillStyle = spec.accentColor || "#d4d4d8";
  ctx.fillRect(tx + 56, ty + 2, 16, 10);
  ctx.fillStyle = "#09090b";
  ctx.fillRect(tx + 60, ty + 4, 8, 6);

  if (isSkirt) {
    // Pleated Jirai Kei / Emo Skirt Lines
    ctx.strokeStyle = `${spec.secondaryColor || "#000000"}cc`;
    ctx.lineWidth = 2;
    for (let px = tx + 12; px < tx + 116; px += 10) {
      ctx.beginPath();
      ctx.moveTo(px, ty + 14);
      ctx.lineTo(px, ty + 110);
      ctx.stroke();
    }
    // Safety pin accent
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx + 28, ty + 40);
    ctx.lineTo(tx + 40, ty + 36);
    ctx.lineTo(tx + 30, ty + 48);
    ctx.stroke();
  } else if (isPjs) {
    // Cozy cute repeating stars/bats for PJs
    ctx.fillStyle = `${spec.accentColor}44`;
    for (const [lx, ly] of [[85, 406], [341, 406]]) {
      for (let i = 0; i < 5; i++) {
        drawStar(ctx, lx + 15 + (i % 2) * 28, ly + 20 + i * 20, 4, 4, 2);
      }
    }
  } else {
    // Cargo Pockets on Thighs
    const drawCargoPocket = (px: number, py: number) => {
      ctx.fillStyle = spec.secondaryColor || "#18181b";
      ctx.fillRect(px + 12, py + 35, 40, 48);
      ctx.strokeStyle = `${spec.accentColor}66`;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(px + 12, py + 35, 40, 48);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(px + 10, py + 32, 44, 10);
      ctx.strokeRect(px + 10, py + 32, 44, 10);

      ctx.fillStyle = spec.accentColor || "#e4e4e7";
      ctx.beginPath();
      ctx.arc(px + 32, py + 37, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    drawCargoPocket(85, 406);
    drawCargoPocket(341, 406);
  }

  // Chain detail hanging from belt
  ctx.strokeStyle = spec.accentColor || "#e4e4e7";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx + 30, ty + 12);
  ctx.bezierCurveTo(tx + 45, ty + 45, tx + 75, ty + 48, tx + 95, ty + 12);
  ctx.stroke();

  // Shoe cuffs at bottom
  ctx.fillStyle = "#09090b";
  ctx.fillRect(85, 406 + 120, 64, 8);
  ctx.fillRect(341, 406 + 120, 64, 8);
}

function drawRibbonBow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff66";
  ctx.lineWidth = 1;

  // Left loop
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - 14, cy - 10, cx - 14, cy + 10, cx, cy);
  ctx.fill();
  ctx.stroke();

  // Right loop
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + 14, cy - 10, cx + 14, cy + 10, cx, cy);
  ctx.fill();
  ctx.stroke();

  // Center knot
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Hanging ribbons
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

function drawCatChestGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;

  // Cat Head
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  // Ears
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
  ctx.lineTo(cx - 20, cy);
  ctx.moveTo(cx - 5, cy + 4);
  ctx.lineTo(cx - 19, cy + 6);
  ctx.moveTo(cx + 5, cy + 1);
  ctx.lineTo(cx + 20, cy);
  ctx.moveTo(cx + 5, cy + 4);
  ctx.lineTo(cx + 19, cy + 6);
  ctx.stroke();

  ctx.restore();
}

function drawAestheticChestEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accent: string
) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}22`;
  ctx.lineWidth = 1.5;

  // Aesthetic Cyber 4-point star / cross emblem
  ctx.beginPath();
  ctx.moveTo(cx, cy - 18);
  ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 18, cy);
  ctx.quadraticCurveTo(cx + 4, cy + 4, cx, cy + 18);
  ctx.quadraticCurveTo(cx - 4, cy + 4, cx - 18, cy);
  ctx.quadraticCurveTo(cx - 4, cy - 4, cx, cy - 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Small inner star
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renders the unmistakable official Minion shirt with goggles, eyes, smile, overalls and black gloves
 */
function drawMinionShirt(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  spec: UgcDesignSpec,
  isOffShoulder: boolean
) {
  const cx = tx + 64;
  const cy = ty + 64;

  // 1. Torso Front: Minion Yellow Body
  const yellowGrad = ctx.createLinearGradient(tx, ty, tx, ty + 128);
  yellowGrad.addColorStop(0, "#fde047");
  yellowGrad.addColorStop(1, "#facc15");
  ctx.fillStyle = yellowGrad;
  ctx.fillRect(tx, ty, 128, 128);

  // 2. Off-shoulder or collar cut
  if (isOffShoulder) {
    ctx.fillStyle = "#050508";
    ctx.beginPath();
    ctx.ellipse(cx, ty + 14, 44, 12, 0, 0, Math.PI);
    ctx.fill();

    // Spaghetti straps
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx + 28, ty); ctx.lineTo(tx + 32, ty + 18);
    ctx.moveTo(tx + 100, ty); ctx.lineTo(tx + 96, ty + 18);
    ctx.stroke();
  }

  // 3. Sprout Hair Strands at the top
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 10, ty + 14); ctx.quadraticCurveTo(cx - 12, ty + 4, cx - 16, ty + 2);
  ctx.moveTo(cx, ty + 12); ctx.lineTo(cx, ty);
  ctx.moveTo(cx + 10, ty + 14); ctx.quadraticCurveTo(cx + 12, ty + 4, cx + 16, ty + 2);
  ctx.stroke();

  // 4. Black Goggle Strap running horizontally across Torso Front
  const strapY = ty + 36;
  ctx.fillStyle = "#18181b";
  ctx.fillRect(tx, strapY, 128, 16);
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, strapY, 128, 16);

  // 5. Minion Goggles with Two Large Expressive Eyes
  const goggleY = strapY + 8;
  const eyeDistance = 17;
  for (const eyeX of [cx - eyeDistance, cx + eyeDistance]) {
    // Outer Metallic Silver Rim
    const rimGrad = ctx.createLinearGradient(eyeX - 17, goggleY - 17, eyeX + 17, goggleY + 17);
    rimGrad.addColorStop(0, "#ffffff");
    rimGrad.addColorStop(0.4, "#d1d5db");
    rimGrad.addColorStop(0.8, "#9ca3af");
    rimGrad.addColorStop(1, "#4b5563");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 17, 0, Math.PI * 2);
    ctx.fill();

    // 4 Rivets on each rim
    ctx.fillStyle = "#374151";
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const rx = eyeX + Math.cos(angle) * 14.5;
      const ry = goggleY + Math.sin(angle) * 14.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inner eye shadow
    ctx.fillStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 13.5, 0, Math.PI * 2);
    ctx.fill();

    // White Sclera
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 12.5, 0, Math.PI * 2);
    ctx.fill();

    // Warm Amber/Hazel Iris
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark Pupil
    ctx.fillStyle = "#09090b";
    ctx.beginPath();
    ctx.arc(eyeX, goggleY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Specular Light Glint
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX + 2, goggleY - 2.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX - 2, goggleY + 2.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silver Goggle Bridge connecting the two rims
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(cx - 3, goggleY - 4, 6, 8);
  ctx.strokeStyle = "#4b5563";
  ctx.strokeRect(cx - 3, goggleY - 4, 6, 8);

  // 6. Cute Minion Smile
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, goggleY + 14, 11, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Cheek lines
  ctx.beginPath();
  ctx.moveTo(cx - 10, goggleY + 20); ctx.lineTo(cx - 8, goggleY + 24);
  ctx.moveTo(cx + 10, goggleY + 20); ctx.lineTo(cx + 8, goggleY + 24);
  ctx.stroke();

  // 7. Classic Blue Denim Overalls on lower torso
  const overallY = ty + 70;
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(tx, overallY, 128, 58);

  // Yellow Stitch line across top of overalls
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tx, overallY);
  ctx.lineTo(tx + 128, overallY);
  ctx.stroke();

  // Overalls Suspender Straps coming from shoulders down to overalls
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(tx + 14, ty + 12, 18, overallY - (ty + 12));
  ctx.fillRect(tx + 96, ty + 12, 18, overallY - (ty + 12));
  // Yellow stitching on suspenders
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 14, ty + 12, 18, overallY - (ty + 12));
  ctx.strokeRect(tx + 96, ty + 12, 18, overallY - (ty + 12));

  // Metallic Buttons on suspenders
  for (const bx of [tx + 23, tx + 105]) {
    ctx.fillStyle = "#e5e7eb";
    ctx.beginPath(); ctx.arc(bx, overallY - 5, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath(); ctx.arc(bx, overallY - 5, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // Front Overalls Pocket
  const pox = tx + 46;
  const poy = overallY + 10;
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(pox, poy, 36, 32);
  ctx.strokeStyle = "#fbbf24";
  ctx.strokeRect(pox, poy, 36, 32);

  // Gru "G" Logo in black circle on pocket
  ctx.fillStyle = "#0f172a";
  ctx.beginPath(); ctx.arc(pox + 18, poy + 16, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("G", pox + 18, poy + 16);

  // 8. Torso Back (423, 138, 128, 128)
  const bx = 423;
  const by = 138;
  ctx.fillStyle = yellowGrad;
  ctx.fillRect(bx, by, 128, 128);
  // Continuing goggle strap across the back
  ctx.fillStyle = "#18181b";
  ctx.fillRect(bx, strapY, 128, 16);
  ctx.strokeStyle = "#09090b";
  ctx.strokeRect(bx, strapY, 128, 16);
  // Denim Overalls on Back
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(bx, overallY, 128, 58);
  ctx.strokeStyle = "#fbbf24";
  ctx.strokeRect(bx, overallY, 128, 58);
  // Crossed Overalls Straps in Back
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(bx + 18, by + 12); ctx.lineTo(bx + 110, overallY);
  ctx.moveTo(bx + 110, by + 12); ctx.lineTo(bx + 18, overallY);
  ctx.stroke();

  // 9. Torso Sides (159, 138) and (367, 138)
  for (const sx of [159, 367]) {
    ctx.fillStyle = yellowGrad;
    ctx.fillRect(sx, ty, 64, 128);
    // Continuing goggle strap
    ctx.fillStyle = "#18181b";
    ctx.fillRect(sx, strapY, 64, 16);
    // Continuing overalls
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(sx, overallY, 64, 58);
  }

  // 10. Arms / Sleeves (Right Arm: 85, 406 | Left Arm: 341, 406)
  const armSections = [
    { x: 85, y: 406 }, { x: 21, y: 406 }, { x: 149, y: 406 }, { x: 213, y: 406 },
    { x: 341, y: 406 }, { x: 277, y: 406 }, { x: 405, y: 406 }, { x: 469, y: 406 },
  ];
  for (const arm of armSections) {
    // Yellow sleeve
    ctx.fillStyle = "#facc15";
    ctx.fillRect(arm.x, arm.y, 64, 128);
    // Black glove cuff at the bottom (26px)
    ctx.fillStyle = "#18181b";
    ctx.fillRect(arm.x, arm.y + 102, 64, 26);
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.strokeRect(arm.x, arm.y + 102, 64, 26);
  }
}

/**
 * Renders the official Minion denim overalls pants with yellow cuffs
 */
function drawMinionPants(ctx: CanvasRenderingContext2D, spec: UgcDesignSpec) {
  const tx = 231;
  const ty = 138;

  // Blue denim base fill
  const denimGrad = ctx.createLinearGradient(tx, ty, tx, ty + 128);
  denimGrad.addColorStop(0, "#2563eb");
  denimGrad.addColorStop(1, "#1d4ed8");

  // Torso Bottom / Waist (231, 138, 128, 128)
  ctx.fillStyle = denimGrad;
  ctx.fillRect(tx, ty, 128, 128);

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

  // Pants Legs (Right: 85, 406 | Left: 341, 406)
  const legSections = [
    { x: 85, y: 406 }, { x: 21, y: 406 }, { x: 149, y: 406 }, { x: 213, y: 406 },
    { x: 341, y: 406 }, { x: 277, y: 406 }, { x: 405, y: 406 }, { x: 469, y: 406 },
  ];
  for (const leg of legSections) {
    ctx.fillStyle = denimGrad;
    ctx.fillRect(leg.x, leg.y, 64, 128);

    // Denim side seam
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leg.x + 32, leg.y);
    ctx.lineTo(leg.x + 32, leg.y + 110);
    ctx.stroke();

    // Rolled-up Minion Yellow Cuffs at the ankle
    ctx.fillStyle = "#facc15";
    ctx.fillRect(leg.x, leg.y + 110, 64, 18);
    ctx.strokeStyle = "#fbbf24";
    ctx.strokeRect(leg.x, leg.y + 110, 64, 18);
  }
}

/**
 * Renders the iconic Batman yellow oval with black bat silhouette
 */
function drawBatmanChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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
  ctx.moveTo(cx, cy - 8); // Head
  ctx.lineTo(cx - 2, cy - 12); // Left ear
  ctx.lineTo(cx - 4, cy - 8);
  ctx.quadraticCurveTo(cx - 16, cy - 14, cx - 24, cy - 4); // Left wing top
  ctx.quadraticCurveTo(cx - 18, cy, cx - 14, cy + 6); // Left wing scallop 1
  ctx.quadraticCurveTo(cx - 8, cy + 8, cx - 4, cy + 5); // Left wing scallop 2
  ctx.lineTo(cx, cy + 10); // Tail
  ctx.lineTo(cx + 4, cy + 5); // Right wing scallop 2
  ctx.quadraticCurveTo(cx + 8, cy + 8, cx + 14, cy + 6); // Right wing scallop 1
  ctx.quadraticCurveTo(cx + 18, cy, cx + 24, cy - 4); // Right wing top
  ctx.quadraticCurveTo(cx + 16, cy - 14, cx + 4, cy - 8);
  ctx.lineTo(cx + 2, cy - 12); // Right ear
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders the iconic Spider-Man web and chest spider emblem
 */
function drawSpidermanChestGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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

  // Black Spider Emblem
  ctx.fillStyle = "#09090b";
  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy, 4, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - 11, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.6;
  for (const dir of [-1, 1]) {
    // Upper legs
    ctx.beginPath(); ctx.moveTo(cx + dir * 3, cy - 6); ctx.lineTo(cx + dir * 14, cy - 18); ctx.lineTo(cx + dir * 18, cy - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + dir * 3, cy - 3); ctx.lineTo(cx + dir * 16, cy - 8); ctx.lineTo(cx + dir * 20, cy - 3); ctx.stroke();
    // Lower legs
    ctx.beginPath(); ctx.moveTo(cx + dir * 3, cy + 2); ctx.lineTo(cx + dir * 16, cy + 10); ctx.lineTo(cx + dir * 14, cy + 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + dir * 3, cy + 6); ctx.lineTo(cx + dir * 12, cy + 18); ctx.lineTo(cx + dir * 10, cy + 24); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders Hello Kitty face with iconic red/pink bow and yellow nose
 */
function drawHelloKittyGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // White Head Oval
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Left & Right Ears
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 8); ctx.lineTo(cx - 20, cy - 22); ctx.lineTo(cx - 8, cy - 15); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 18, cy - 8); ctx.lineTo(cx + 20, cy - 22); ctx.lineTo(cx + 8, cy - 15); ctx.fill(); ctx.stroke();

  // Red Ribbon Bow on Left Ear
  drawRibbonBow(ctx, cx - 14, cy - 16, "#ef4444");

  // Eyes
  ctx.fillStyle = "#09090b";
  ctx.beginPath(); ctx.ellipse(cx - 8, cy + 1, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 8, cy + 1, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();

  // Yellow Nose
  ctx.fillStyle = "#facc15";
  ctx.beginPath(); ctx.ellipse(cx, cy + 4, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

  // Whiskers
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.2;
  for (const dir of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + dir * 14, cy + 1); ctx.lineTo(cx + dir * 26, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + dir * 14, cy + 5); ctx.lineTo(cx + dir * 26, cy + 6); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders Kuromi face with black jester hat and pink skull
 */
function drawKuromiGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Black Jester Hat
  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  // Pointy floppy ears
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 10); ctx.lineTo(cx - 26, cy - 30); ctx.lineTo(cx - 6, cy - 20); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 10); ctx.lineTo(cx + 26, cy - 30); ctx.lineTo(cx + 6, cy - 20); ctx.fill();

  // White Face
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 17, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pink Skull on Hat
  ctx.fillStyle = "#f472b6";
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#09090b";
  ctx.beginPath(); ctx.arc(cx - 1.5, cy - 8, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 1.5, cy - 8, 1, 0, Math.PI * 2); ctx.fill();

  // Mischievous Eyes & Blush
  ctx.fillStyle = "#09090b";
  ctx.beginPath(); ctx.ellipse(cx - 7, cy + 5, 2, 3, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 7, cy + 5, 2, 3, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f472b6";
  ctx.beginPath(); ctx.arc(cx - 10, cy + 10, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 10, cy + 10, 2.5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

/**
 * Renders an aesthetic chrome / gothic heart
 */
function drawHeartGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff44";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 12);
  ctx.bezierCurveTo(cx - 18, cy - 2, cx - 22, cy - 18, cx, cy - 8);
  ctx.bezierCurveTo(cx + 22, cy - 18, cx + 18, cy - 2, cx, cy + 12);
  ctx.fill();
  ctx.stroke();

  // Glossy highlight curve
  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx - 8, cy - 7, 5, 0.8 * Math.PI, 1.6 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders a gothic emo skull with crossbones
 */
function drawSkullGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  // Skull Cranium
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
  ctx.beginPath(); ctx.ellipse(cx - 5, cy - 3, 3.5, 4.5, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 5, cy - 3, 3.5, 4.5, 0.2, 0, Math.PI * 2); ctx.fill();
  // Nose
  ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx - 2, cy + 5); ctx.lineTo(cx + 2, cy + 5); ctx.fill();
  // Teeth
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 1.2;
  for (let tx = cx - 5; tx <= cx + 5; tx += 3.5) {
    ctx.beginPath(); ctx.moveTo(tx, cy + 7); ctx.lineTo(tx, cy + 15); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders Y2K butterfly wings
 */
function drawButterflyGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff66";
  ctx.lineWidth = 1.2;
  // Left wings
  ctx.beginPath(); ctx.ellipse(cx - 10, cy - 6, 12, 8, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx - 8, cy + 6, 8, 6, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Right wings
  ctx.beginPath(); ctx.ellipse(cx + 10, cy - 6, 12, 8, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + 8, cy + 6, 8, 6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Body & Antennas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 1.5, cy - 10, 3, 20);
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(cx - 1, cy - 10); ctx.lineTo(cx - 6, cy - 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 1, cy - 10); ctx.lineTo(cx + 6, cy - 18); ctx.stroke();
  ctx.restore();
}

/**
 * Renders streetwear flame tongues
 */
function drawFlameGraphic(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
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

function drawStar(
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

function applyRealisticShading(
  ctx: CanvasRenderingContext2D,
  sections: Array<{ x: number; y: number; w: number; h: number }>
) {
  for (const s of sections) {
    // Subtle inner shadow along borders
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(s.x + 0.75, s.y + 0.75, s.w - 1.5, s.h - 1.5);

    // Subtle edge highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
  }
}

async function overlayReferenceImage(
  ctx: CanvasRenderingContext2D,
  dataUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Place centered on Torso Front (231, 138, 128, 128)
      ctx.save();
      ctx.beginPath();
      ctx.rect(231 + 16, 138 + 24, 96, 80);
      ctx.clip();
      ctx.drawImage(img, 231 + 16, 138 + 24, 96, 80);
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function renderTshirtGraphic(spec: UgcDesignSpec): string {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Pure dark background with glowing emblem
  ctx.fillStyle = spec.primaryColor || "#09090b";
  ctx.fillRect(0, 0, 512, 512);

  // Large center graphic
  drawAestheticChestEmblem(ctx, 256, 256, spec.accentColor || "#38bdf8");

  // Title text at bottom
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(spec.title.toUpperCase(), 256, 420);

  return canvas.toDataURL("image/png");
}
