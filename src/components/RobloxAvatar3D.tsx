import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { UgcClothingKind } from "../lib/ugcTemplate";

interface RobloxAvatar3DProps {
  templateDataUrl: string;
  kind?: UgcClothingKind;
  className?: string;
  title?: string;
}

/**
 * Creates the classic Roblox smiley face on an offscreen canvas
 */
function createRobloxFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Studio light gray head background
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, 256, 256);

  // Classic Roblox Face: Shiny oval eyes with circular catchlight
  ctx.fillStyle = "#111827";

  // Left Eye (avatar perspective: avatar's right, screen left)
  ctx.beginPath();
  ctx.ellipse(82, 98, 14, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  // Right Eye (avatar perspective: avatar's left, screen right)
  ctx.beginPath();
  ctx.ellipse(174, 98, 14, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  // White twinkle highlights in eyes
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(77, 90, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(169, 90, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Iconic Roblox Smile Arc
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(128, 136, 44, 0.18 * Math.PI, 0.82 * Math.PI, false);
  ctx.stroke();

  // Cheerful upturned smile dimples
  ctx.beginPath();
  ctx.arc(88, 160, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(168, 160, 5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Maps the 6 faces of a Three.js BoxGeometry to exact pixel coordinates
 * on the official Roblox 585 x 559 Classic Clothing template.
 */
function applyRobloxUVs(
  geometry: THREE.BoxGeometry,
  rects: {
    right: [number, number, number, number];  // Face 0 (+X)
    left: [number, number, number, number];   // Face 1 (-X)
    top: [number, number, number, number];    // Face 2 (+Y)
    bottom: [number, number, number, number]; // Face 3 (-Y)
    front: [number, number, number, number];  // Face 4 (+Z)
    back: [number, number, number, number];   // Face 5 (-Z)
  },
  texW = 585,
  texH = 559
) {
  const uvAttr = geometry.attributes.uv;
  const faces = [rects.right, rects.left, rects.top, rects.bottom, rects.front, rects.back];

  for (let f = 0; f < 6; f++) {
    const r = faces[f];
    const [px, py, pw, ph] = r;
    const u0 = px / texW;
    const u1 = (px + pw) / texW;
    const vTop = 1.0 - py / texH;
    const vBottom = 1.0 - (py + ph) / texH;

    const base = f * 4;
    uvAttr.setXY(base + 0, u0, vTop);
    uvAttr.setXY(base + 1, u1, vTop);
    uvAttr.setXY(base + 2, u0, vBottom);
    uvAttr.setXY(base + 3, u1, vBottom);
  }
  uvAttr.needsUpdate = true;
}

/**
 * Composites the clothing template onto a clean base avatar body
 * so that transparent clothing areas reveal realistic skin and basic undershirt
 */
async function buildCompositeTexture(
  templateDataUrl: string,
  kind: UgcClothingKind = "shirt"
): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement("canvas");
  canvas.width = 585;
  canvas.height = 559;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Avatar skin tone (Classic studio light gray)
  const skinColor = "#e5e7eb";

  // Fill limbs and torso with default base textures
  if (kind === "pants") {
    // Torso upper chest (Y: 74..128) - Skin & White Studio Undershirt/Camisole
    ctx.fillStyle = skinColor;
    ctx.fillRect(231, 74, 128, 56);
    ctx.fillRect(427, 74, 128, 56);
    ctx.fillRect(165, 74, 64, 56);
    ctx.fillRect(361, 74, 64, 56);
    // Torso top shoulders
    ctx.fillRect(231, 10, 128, 64);

    // Clean white camisole on chest
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(231, 74, 128, 38);
    ctx.fillRect(427, 74, 128, 38);
    ctx.fillRect(165, 74, 64, 38);
    ctx.fillRect(361, 74, 64, 38);

    // Scoop neck cutout
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(231 + 64, 74, 22, 12, 0, 0, Math.PI);
    ctx.fill();

    // Arms: Base Mannequin Skin
    const armPanels = [19, 85, 151, 217, 308, 374, 440, 506];
    ctx.fillStyle = skinColor;
    for (const ax of armPanels) {
      ctx.fillRect(ax, 355, 64, 128);
    }
  } else if (kind === "shirt") {
    // Legs: Dark charcoal studio jeans
    ctx.fillStyle = "#18181b";
    const legPanels = [19, 85, 151, 217, 308, 374, 440, 506];
    for (const lx of legPanels) {
      ctx.fillRect(lx, 355, 64, 128);
    }
    // Lower hands: skin tone
    ctx.fillStyle = skinColor;
    for (const lx of [19, 85, 151, 217, 308, 374, 440, 506]) {
      ctx.fillRect(lx, 355 + 104, 64, 24);
    }
  } else {
    // T-shirt: Base dark tee + denim pants
    ctx.fillStyle = "#18181b";
    ctx.fillRect(231, 74, 128, 128);
    ctx.fillRect(427, 74, 128, 128);
    ctx.fillRect(165, 74, 64, 128);
    ctx.fillRect(361, 74, 64, 128);
  }

  // Draw the generated Roblox clothing template on top!
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
  texture.needsUpdate = true;
  return texture;
}

export const RobloxAvatar3D: React.FC<RobloxAvatar3DProps> = ({
  templateDataUrl,
  kind = "shirt",
  className = "",
  title: _title = "Roblox Avatar 3D",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqIdRef = useRef<number>(0);

  // Interaction State
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotationVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 280;
    const height = container.clientHeight || 280;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera (perspective centered on Roblox avatar)
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 7.0 - zoomLevel * 0.8);
    camera.lookAt(0, 0.1, 0);
    cameraRef.current = camera;

    // 3. Renderer with transparent background
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. Lighting (Roblox Studio Key + Rim + Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Key Light (warm studio spotlight from top-right)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    // Rim Light (cool blue studio highlight from rear-left)
    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    rimLight.position.set(-4, 3, -5);
    scene.add(rimLight);

    // Fill Light (soft front-low illumination)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fillLight.position.set(0, -3, 4);
    scene.add(fillLight);

    // Floor Shadow Disc (Iconic soft Roblox avatar ground shadow)
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext("2d");
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.55)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.25)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const floorShadow = new THREE.Mesh(shadowGeo, shadowMat);
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = -2.99;
    scene.add(floorShadow);

    // 5. Build Roblox R6 Avatar Group
    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;
    scene.add(avatarGroup);

    // Base skin plastic material
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.35,
      metalness: 0.05,
    });

    // 5.1 HEAD (Roblox R6 classic head: 1.25 x 1.25 x 1.25 with top stud)
    const headMatArray = [
      skinMat, // +X (avatar left)
      skinMat, // -X (avatar right)
      skinMat, // +Y (top)
      skinMat, // -Y (bottom)
      new THREE.MeshStandardMaterial({
        map: createRobloxFaceTexture(),
        roughness: 0.35,
        metalness: 0.05,
      }), // +Z (Front with classic face)
      skinMat, // -Z (back)
    ];

    const headGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
    const headMesh = new THREE.Mesh(headGeo, headMatArray);
    headMesh.position.set(0, 1.625, 0);
    avatarGroup.add(headMesh);

    // Top Head Stud (The signature Roblox cylinder on top of the head)
    const studGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 24);
    const studMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.3,
      metalness: 0.1,
    });
    const studMesh = new THREE.Mesh(studGeo, studMat);
    studMesh.position.set(0, 2.34, 0);
    avatarGroup.add(studMesh);

    // 5.2 TORSO (2.0 x 2.0 x 1.0)
    const torsoGeo = new THREE.BoxGeometry(2.0, 2.0, 1.0);
    applyRobloxUVs(torsoGeo, {
      right: [361, 74, 64, 128],  // +X (avatar left side)
      left: [165, 74, 64, 128],   // -X (avatar right side)
      top: [231, 10, 128, 64],    // +Y (top shoulders)
      bottom: [231, 204, 128, 64],// -Y (crotch underside)
      front: [231, 74, 128, 128], // +Z (front torso)
      back: [427, 74, 128, 128],  // -Z (back torso)
    });

    // 5.3 RIGHT ARM (-1.5, 0, 0)
    const rightArmGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
    applyRobloxUVs(rightArmGeo, {
      right: [19, 355, 64, 128],   // +X (inner side)
      left: [151, 355, 64, 128],   // -X (outer side)
      top: [217, 289, 64, 64],     // +Y (top shoulder)
      bottom: [217, 485, 64, 64],  // -Y (bottom wrist)
      front: [217, 355, 64, 128],  // +Z (front)
      back: [85, 355, 64, 128],    // -Z (back)
    });

    // 5.4 LEFT ARM (+1.5, 0, 0)
    const leftArmGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
    applyRobloxUVs(leftArmGeo, {
      right: [374, 355, 64, 128],  // +X (outer side)
      left: [506, 355, 64, 128],   // -X (inner side)
      top: [308, 289, 64, 64],     // +Y (top shoulder)
      bottom: [308, 485, 64, 64],  // -Y (bottom wrist)
      front: [308, 355, 64, 128],  // +Z (front)
      back: [440, 355, 64, 128],   // -Z (back)
    });

    // 5.5 RIGHT LEG (-0.5, -2.0, 0)
    const rightLegGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
    applyRobloxUVs(rightLegGeo, {
      right: [19, 355, 64, 128],   // +X (inner side)
      left: [151, 355, 64, 128],   // -X (outer side)
      top: [217, 289, 64, 64],     // +Y (top thigh)
      bottom: [217, 485, 64, 64],  // -Y (sole of foot)
      front: [217, 355, 64, 128],  // +Z (front)
      back: [85, 355, 64, 128],    // -Z (back)
    });

    // 5.6 LEFT LEG (+0.5, -2.0, 0)
    const leftLegGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
    applyRobloxUVs(leftLegGeo, {
      right: [374, 355, 64, 128],  // +X (outer side)
      left: [506, 355, 64, 128],   // -X (inner side)
      top: [308, 289, 64, 64],     // +Y (top thigh)
      bottom: [308, 485, 64, 64],  // -Y (sole of foot)
      front: [308, 355, 64, 128],  // +Z (front)
      back: [440, 355, 64, 128],   // -Z (back)
    });

    // Build Meshes with Placeholder Material
    const defaultClothingMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.45,
      metalness: 0.1,
    });

    const torsoMesh = new THREE.Mesh(torsoGeo, defaultClothingMat);
    torsoMesh.position.set(0, 0, 0);
    avatarGroup.add(torsoMesh);

    const rightArmMesh = new THREE.Mesh(rightArmGeo, defaultClothingMat);
    rightArmMesh.position.set(-1.5, 0, 0);
    avatarGroup.add(rightArmMesh);

    const leftArmMesh = new THREE.Mesh(leftArmGeo, defaultClothingMat);
    leftArmMesh.position.set(1.5, 0, 0);
    avatarGroup.add(leftArmMesh);

    const rightLegMesh = new THREE.Mesh(rightLegGeo, defaultClothingMat);
    rightLegMesh.position.set(-0.5, -2.0, 0);
    avatarGroup.add(rightLegMesh);

    const leftLegMesh = new THREE.Mesh(leftLegGeo, defaultClothingMat);
    leftLegMesh.position.set(0.5, -2.0, 0);
    avatarGroup.add(leftLegMesh);

    // Initial slight 3/4 catalog angle
    avatarGroup.rotation.y = 0.35;

    // Load composite clothing texture
    buildCompositeTexture(templateDataUrl, kind).then((texture) => {
      const clothingMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.08,
      });

      torsoMesh.material = clothingMat;
      rightArmMesh.material = clothingMat;
      leftArmMesh.material = clothingMat;
      rightLegMesh.material = clothingMat;
      leftLegMesh.material = clothingMat;
    });

    // 6. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Subtle breathing idle animation
      const breath = Math.sin(elapsedTime * 2.2) * 0.012;
      torsoMesh.position.y = breath;
      headMesh.position.y = 1.625 + breath * 1.3;
      studMesh.position.y = 2.34 + breath * 1.3;
      rightArmMesh.position.y = breath * 0.6;
      leftArmMesh.position.y = breath * 0.6;

      // Auto-rotation when not actively dragging
      if (autoRotate && !isDraggingRef.current) {
        avatarGroup.rotation.y += 0.009;
      }

      // Inertia drag damping
      if (!isDraggingRef.current) {
        avatarGroup.rotation.y += rotationVelocityRef.current.y;
        avatarGroup.rotation.x += rotationVelocityRef.current.x;
        rotationVelocityRef.current.x *= 0.92;
        rotationVelocityRef.current.y *= 0.92;
      }

      // Clamp vertical pitch so avatar stays upright
      avatarGroup.rotation.x = Math.max(-0.35, Math.min(0.45, avatarGroup.rotation.x));

      renderer.render(scene, camera);
    };

    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (nw > 0 && nh > 0) {
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(reqIdRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      torsoGeo.dispose();
      headGeo.dispose();
      studGeo.dispose();
      rightArmGeo.dispose();
      leftArmGeo.dispose();
      rightLegGeo.dispose();
      leftLegGeo.dispose();
      shadowGeo.dispose();
    };
  }, [templateDataUrl, kind]);

  // Handle Zoom change
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.position.z = 7.0 - zoomLevel * 0.8;
    }
  }, [zoomLevel]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    rotationVelocityRef.current = { x: 0, y: 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !avatarGroupRef.current) return;
    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const rotSpeedY = 0.012;
    const rotSpeedX = 0.008;

    avatarGroupRef.current.rotation.y += deltaX * rotSpeedY;
    avatarGroupRef.current.rotation.x += deltaY * rotSpeedX;

    rotationVelocityRef.current = {
      x: deltaY * rotSpeedX * 0.35,
      y: deltaX * rotSpeedY * 0.35,
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const resetRotation = () => {
    if (avatarGroupRef.current) {
      avatarGroupRef.current.rotation.set(0, 0.35, 0);
      rotationVelocityRef.current = { x: 0, y: 0 };
    }
  };

  return (
    <div
      className={`relative w-full h-full select-none overflow-hidden touch-none flex items-center justify-center ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Roblox R6 Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 border border-white/10 backdrop-blur-md pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-[10px] font-bold tracking-wider text-blue-300 uppercase">Roblox R6 3D</span>
      </div>

      {/* 3D Interaction Control Toolbar */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 border border-white/10 p-1 rounded-lg backdrop-blur-md shadow-xl">
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          title={autoRotate ? "Pausar Rotação" : "Girar Automaticamente"}
          className={`p-1 rounded transition-colors ${
            autoRotate
              ? "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={resetRotation}
          title="Resetar Posição Frontal"
          className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(2, z + 1))}
          title="Aproximar Zoom"
          className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(-1, z - 1))}
          title="Afastar Zoom"
          className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtle bottom drag hint */}
      <div className="absolute bottom-2 left-2 text-[9px] text-white/30 font-mono pointer-events-none">
        Arraste para girar 360°
      </div>
    </div>
  );
};
