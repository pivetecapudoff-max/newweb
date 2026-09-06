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

  const isOffShoulder = d.some((item) => item.includes("shoulder")) || t.includes("off shoulder") || t.includes("off-shoulder");
  const hasBow = d.some((item) => item.includes("bow") || item.includes("ribbon") || item.includes("୨୧")) || t.includes("bow") || spec.theme === "moe" || spec.theme === "jiraikei" || spec.theme === "coquette";
  const hasLace = d.some((item) => item.includes("lace") || item.includes("ruffles")) || spec.theme === "jiraikei" || spec.theme === "vkei";
  const hasArmWarmers = d.some((item) => item.includes("warmers") || item.includes("sleeve")) || t.includes("arm") || spec.theme === "vkei" || spec.theme === "emogirl";
  const isCat = t.includes("cat") || t.includes("gatinho") || d.some((item) => item.includes("cat"));

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

  // Chest Graphic / Logo / Aesthetic Emblem
  if (isCat) {
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
