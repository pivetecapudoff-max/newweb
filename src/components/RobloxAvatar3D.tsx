import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RotateCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { UgcClothingKind } from "../lib/ugcTemplate";

interface RobloxAvatar3DProps {
  templateDataUrl: string;
  kind?: UgcClothingKind;
  className?: string;
  title?: string;
}

export type AvatarRigType = "r6" | "r15";

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

  // Avatar skin tone (Classic studio light gray mannequin)
  const skinColor = "#e5e7eb";

  // Fill limbs and torso with default base textures
  if (kind === "pants") {
    // Torso upper chest (Y: 74..128) - Skin & White Studio Undershirt
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

  // Draw the generated Roblox clothing template on top
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
  const [rigType, setRigType] = useState<AvatarRigType>("r6");
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
    camera.position.set(0, 0.35, 7.0 - zoomLevel * 0.8);
    camera.lookAt(0, 0.05, 0);
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    // Rim Light
    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    rimLight.position.set(-4, 3, -5);
    scene.add(rimLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fillLight.position.set(0, -3, 4);
    scene.add(fillLight);

    // Floor Shadow Disc
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

    // 5. Build Avatar Root Group
    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;
    scene.add(avatarGroup);

    // Official Skin Material (Roblox Studio Mannequin)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.38,
      metalness: 0.05,
    });

    // Default Clothing Material
    const defaultClothingMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.45,
      metalness: 0.08,
    });

    // Official Roblox Face Decal Texture
    const faceTexture = new THREE.TextureLoader().load("/roblox_face.png");
    faceTexture.colorSpace = THREE.SRGBColorSpace;

    // Track all meshes for animation and cleanup
    const animatedParts: {
      head?: THREE.Object3D;
      torso?: THREE.Object3D;
      arms?: THREE.Object3D[];
    } = {};
    const createdGeometries: THREE.BufferGeometry[] = [shadowGeo];

    // ==========================================
    // RIG BUILDERS: R6 vs R15
    // ==========================================
    if (rigType === "r6") {
      // ---------------- R6 RIG (Official Roblox Dimensions: NO LEGO STUD) ----------------
      // 1. Head (Official Roblox SpecialMesh dimensions: 2.0w x 1.25h x 1.25d, smooth beveled)
      const headGeo = new RoundedBoxGeometry(2.0, 1.25, 1.25, 6, 0.22);
      const headMesh = new THREE.Mesh(headGeo, skinMat);
      headMesh.position.set(0, 1.625, 0);
      avatarGroup.add(headMesh);
      createdGeometries.push(headGeo);

      // Face Decal Plane (Official Roblox Default Smile)
      const faceMat = new THREE.MeshBasicMaterial({
        map: faceTexture,
        transparent: true,
        depthWrite: false,
      });
      const faceGeo = new THREE.PlaneGeometry(1.15, 1.15);
      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      faceMesh.position.set(0, 0, 0.635);
      headMesh.add(faceMesh);
      createdGeometries.push(faceGeo);

      // 2. Torso (2.0 x 2.0 x 1.0)
      const torsoGeo = new THREE.BoxGeometry(2.0, 2.0, 1.0);
      applyRobloxUVs(torsoGeo, {
        right: [361, 74, 64, 128],
        left: [165, 74, 64, 128],
        top: [231, 10, 128, 64],
        bottom: [231, 204, 128, 64],
        front: [231, 74, 128, 128],
        back: [427, 74, 128, 128],
      });
      const torsoMesh = new THREE.Mesh(torsoGeo, defaultClothingMat);
      torsoMesh.position.set(0, 0, 0);
      avatarGroup.add(torsoMesh);
      createdGeometries.push(torsoGeo);

      // 3. Right Arm (-1.5, 0, 0)
      const rightArmGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
      applyRobloxUVs(rightArmGeo, {
        right: [19, 355, 64, 128],
        left: [151, 355, 64, 128],
        top: [217, 289, 64, 64],
        bottom: [217, 485, 64, 64],
        front: [217, 355, 64, 128],
        back: [85, 355, 64, 128],
      });
      const rightArmMesh = new THREE.Mesh(rightArmGeo, defaultClothingMat);
      rightArmMesh.position.set(-1.5, 0, 0);
      rightArmMesh.rotation.z = 0.05;
      avatarGroup.add(rightArmMesh);
      createdGeometries.push(rightArmGeo);

      // 4. Left Arm (+1.5, 0, 0)
      const leftArmGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
      applyRobloxUVs(leftArmGeo, {
        right: [374, 355, 64, 128],
        left: [506, 355, 64, 128],
        top: [308, 289, 64, 64],
        bottom: [308, 485, 64, 64],
        front: [308, 355, 64, 128],
        back: [440, 355, 64, 128],
      });
      const leftArmMesh = new THREE.Mesh(leftArmGeo, defaultClothingMat);
      leftArmMesh.position.set(1.5, 0, 0);
      leftArmMesh.rotation.z = -0.05;
      avatarGroup.add(leftArmMesh);
      createdGeometries.push(leftArmGeo);

      // 5. Right Leg (-0.5, -2.0, 0)
      const rightLegGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
      applyRobloxUVs(rightLegGeo, {
        right: [19, 355, 64, 128],
        left: [151, 355, 64, 128],
        top: [217, 289, 64, 64],
        bottom: [217, 485, 64, 64],
        front: [217, 355, 64, 128],
        back: [85, 355, 64, 128],
      });
      const rightLegMesh = new THREE.Mesh(rightLegGeo, defaultClothingMat);
      rightLegMesh.position.set(-0.5, -2.0, 0);
      avatarGroup.add(rightLegMesh);
      createdGeometries.push(rightLegGeo);

      // 6. Left Leg (+0.5, -2.0, 0)
      const leftLegGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
      applyRobloxUVs(leftLegGeo, {
        right: [374, 355, 64, 128],
        left: [506, 355, 64, 128],
        top: [308, 289, 64, 64],
        bottom: [308, 485, 64, 64],
        front: [308, 355, 64, 128],
        back: [440, 355, 64, 128],
      });
      const leftLegMesh = new THREE.Mesh(leftLegGeo, defaultClothingMat);
      leftLegMesh.position.set(0.5, -2.0, 0);
      avatarGroup.add(leftLegMesh);
      createdGeometries.push(leftLegGeo);

      animatedParts.head = headMesh;
      animatedParts.torso = torsoMesh;
      animatedParts.arms = [rightArmMesh, leftArmMesh];

      // Texture Binding
      buildCompositeTexture(templateDataUrl, kind).then((tex) => {
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.4,
          metalness: 0.08,
        });
        torsoMesh.material = mat;
        rightArmMesh.material = mat;
        leftArmMesh.material = mat;
        rightLegMesh.material = mat;
        leftLegMesh.material = mat;
      });
    } else {
      // ---------------- R15 RIG (15 Articulated Parts with Official Idle Stance) ----------------
      // 1. Head
      const headGeo = new RoundedBoxGeometry(2.0, 1.25, 1.25, 6, 0.22);
      const headMesh = new THREE.Mesh(headGeo, skinMat);
      headMesh.position.set(0, 1.72, 0);
      avatarGroup.add(headMesh);
      createdGeometries.push(headGeo);

      // Face Decal Plane
      const faceMat = new THREE.MeshBasicMaterial({
        map: faceTexture,
        transparent: true,
        depthWrite: false,
      });
      const faceGeo = new THREE.PlaneGeometry(1.15, 1.15);
      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      faceMesh.position.set(0, 0, 0.635);
      headMesh.add(faceMesh);
      createdGeometries.push(faceGeo);

      // 2. UpperTorso (2.0 x 1.35 x 1.0)
      const upperTorsoGeo = new THREE.BoxGeometry(2.0, 1.35, 1.0);
      applyRobloxUVs(upperTorsoGeo, {
        right: [361, 74, 64, 86],
        left: [165, 74, 64, 86],
        top: [231, 10, 128, 64],
        bottom: [231, 160, 128, 20],
        front: [231, 74, 128, 86],
        back: [427, 74, 128, 86],
      });
      const upperTorsoMesh = new THREE.Mesh(upperTorsoGeo, defaultClothingMat);
      upperTorsoMesh.position.set(0, 0.42, 0);
      avatarGroup.add(upperTorsoMesh);
      createdGeometries.push(upperTorsoGeo);

      // 3. LowerTorso (1.95 x 0.65 x 0.95)
      const lowerTorsoGeo = new THREE.BoxGeometry(1.95, 0.65, 0.95);
      applyRobloxUVs(lowerTorsoGeo, {
        right: [361, 160, 64, 42],
        left: [165, 160, 64, 42],
        top: [231, 160, 128, 20],
        bottom: [231, 204, 128, 64],
        front: [231, 160, 128, 42],
        back: [427, 160, 128, 42],
      });
      const lowerTorsoMesh = new THREE.Mesh(lowerTorsoGeo, defaultClothingMat);
      lowerTorsoMesh.position.set(0, -0.45, 0);
      avatarGroup.add(lowerTorsoMesh);
      createdGeometries.push(lowerTorsoGeo);

      // Limbs Containers
      const clothingMeshes: THREE.Mesh[] = [upperTorsoMesh, lowerTorsoMesh];

      // Arm Builder (UpperArm, LowerArm, Hand)
      const buildArm = (isLeft: boolean) => {
        const armGroup = new THREE.Group();
        const sign = isLeft ? 1 : -1;
        armGroup.position.set(sign * 1.5, 0.85, 0);

        // Natural R15 idle stance angles
        armGroup.rotation.z = sign * -0.12;
        armGroup.rotation.x = -0.06;

        const uFront = isLeft ? 308 : 217;
        const uBack = isLeft ? 440 : 85;
        const uLeft = isLeft ? 374 : 151;
        const uRight = isLeft ? 506 : 19;
        const uTop = isLeft ? 308 : 217;

        // UpperArm
        const upperArmGeo = new THREE.BoxGeometry(0.98, 1.05, 0.98);
        applyRobloxUVs(upperArmGeo, {
          right: [uRight, 355, 64, 64],
          left: [uLeft, 355, 64, 64],
          top: [uTop, 289, 64, 64],
          bottom: [uTop, 419, 64, 15],
          front: [uFront, 355, 64, 64],
          back: [uBack, 355, 64, 64],
        });
        const upperArmMesh = new THREE.Mesh(upperArmGeo, defaultClothingMat);
        upperArmMesh.position.set(0, -0.45, 0);
        armGroup.add(upperArmMesh);
        clothingMeshes.push(upperArmMesh);
        createdGeometries.push(upperArmGeo);

        // Elbow Joint Group
        const elbowGroup = new THREE.Group();
        elbowGroup.position.set(0, -0.98, 0);
        elbowGroup.rotation.x = 0.22; // subtle forward elbow bend
        elbowGroup.rotation.z = sign * 0.05;
        armGroup.add(elbowGroup);

        // LowerArm
        const lowerArmGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
        applyRobloxUVs(lowerArmGeo, {
          right: [uRight, 419, 64, 45],
          left: [uLeft, 419, 64, 45],
          top: [uTop, 419, 64, 15],
          bottom: [uTop, 464, 64, 15],
          front: [uFront, 419, 64, 45],
          back: [uBack, 419, 64, 45],
        });
        const lowerArmMesh = new THREE.Mesh(lowerArmGeo, defaultClothingMat);
        lowerArmMesh.position.set(0, -0.42, 0);
        elbowGroup.add(lowerArmMesh);
        clothingMeshes.push(lowerArmMesh);
        createdGeometries.push(lowerArmGeo);

        // Hand
        const handGeo = new THREE.BoxGeometry(0.92, 0.35, 0.92);
        applyRobloxUVs(handGeo, {
          right: [uRight, 464, 64, 19],
          left: [uLeft, 464, 64, 19],
          top: [uTop, 464, 64, 15],
          bottom: [uTop, 485, 64, 64],
          front: [uFront, 464, 64, 19],
          back: [uBack, 464, 64, 19],
        });
        const handMesh = new THREE.Mesh(handGeo, skinMat);
        handMesh.position.set(0, -1.02, 0);
        elbowGroup.add(handMesh);
        createdGeometries.push(handGeo);

        avatarGroup.add(armGroup);
        return armGroup;
      };

      const rightArmGroup = buildArm(false);
      const leftArmGroup = buildArm(true);

      // Leg Builder (UpperLeg, LowerLeg, Foot)
      const buildLeg = (isLeft: boolean) => {
        const legGroup = new THREE.Group();
        const sign = isLeft ? 1 : -1;
        legGroup.position.set(sign * 0.52, -0.78, 0);

        const uFront = isLeft ? 308 : 217;
        const uBack = isLeft ? 440 : 85;
        const uLeft = isLeft ? 374 : 151;
        const uRight = isLeft ? 506 : 19;
        const uTop = isLeft ? 308 : 217;

        // UpperLeg
        const upperLegGeo = new THREE.BoxGeometry(0.98, 1.1, 0.98);
        applyRobloxUVs(upperLegGeo, {
          right: [uRight, 355, 64, 64],
          left: [uLeft, 355, 64, 64],
          top: [uTop, 289, 64, 64],
          bottom: [uTop, 419, 64, 15],
          front: [uFront, 355, 64, 64],
          back: [uBack, 355, 64, 64],
        });
        const upperLegMesh = new THREE.Mesh(upperLegGeo, defaultClothingMat);
        upperLegMesh.position.set(0, -0.5, 0);
        legGroup.add(upperLegMesh);
        clothingMeshes.push(upperLegMesh);
        createdGeometries.push(upperLegGeo);

        // Knee Joint Group
        const kneeGroup = new THREE.Group();
        kneeGroup.position.set(0, -1.05, 0);
        legGroup.add(kneeGroup);

        // LowerLeg
        const lowerLegGeo = new THREE.BoxGeometry(0.95, 1.05, 0.95);
        applyRobloxUVs(lowerLegGeo, {
          right: [uRight, 419, 64, 45],
          left: [uLeft, 419, 64, 45],
          top: [uTop, 419, 64, 15],
          bottom: [uTop, 464, 64, 15],
          front: [uFront, 419, 64, 45],
          back: [uBack, 419, 64, 45],
        });
        const lowerLegMesh = new THREE.Mesh(lowerLegGeo, defaultClothingMat);
        lowerLegMesh.position.set(0, -0.48, 0);
        kneeGroup.add(lowerLegMesh);
        clothingMeshes.push(lowerLegMesh);
        createdGeometries.push(lowerLegGeo);

        // Foot
        const footGeo = new THREE.BoxGeometry(0.95, 0.35, 1.05);
        applyRobloxUVs(footGeo, {
          right: [uRight, 464, 64, 19],
          left: [uLeft, 464, 64, 19],
          top: [uTop, 464, 64, 15],
          bottom: [uTop, 485, 64, 64],
          front: [uFront, 464, 64, 19],
          back: [uBack, 464, 64, 19],
        });
        const footMesh = new THREE.Mesh(footGeo, defaultClothingMat);
        footMesh.position.set(0, -1.1, 0.05);
        kneeGroup.add(footMesh);
        clothingMeshes.push(footMesh);
        createdGeometries.push(footGeo);

        avatarGroup.add(legGroup);
        return legGroup;
      };

      buildLeg(false);
      buildLeg(true);

      animatedParts.head = headMesh;
      animatedParts.torso = upperTorsoMesh;
      animatedParts.arms = [rightArmGroup, leftArmGroup];

      // Texture Binding for R15
      buildCompositeTexture(templateDataUrl, kind).then((tex) => {
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.4,
          metalness: 0.08,
        });
        for (const m of clothingMeshes) {
          m.material = mat;
        }
      });
    }

    // Initial slight 3/4 catalog angle
    avatarGroup.rotation.y = 0.35;

    // 6. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle breathing idle animation
      const breath = Math.sin(elapsedTime * 2.2) * 0.012;
      if (animatedParts.torso) animatedParts.torso.position.y += breath * 0.05;
      if (animatedParts.head) animatedParts.head.position.y += breath * 0.08;
      if (animatedParts.arms) {
        animatedParts.arms.forEach((arm) => {
          arm.position.y += breath * 0.04;
        });
      }

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
      createdGeometries.forEach((g) => g.dispose());
    };
  }, [templateDataUrl, kind, rigType]);

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

      {/* Floating R6 vs R15 Toggle Switch */}
      <div className="absolute top-2 left-2 flex items-center bg-black/80 border border-white/10 rounded-lg p-0.5 backdrop-blur-md z-10 shadow-lg">
        <button
          type="button"
          onClick={() => setRigType("r6")}
          className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider transition-all uppercase ${
            rigType === "r6"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          Roblox R6
        </button>
        <button
          type="button"
          onClick={() => setRigType("r15")}
          className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider transition-all uppercase ${
            rigType === "r15"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          Roblox R15
        </button>
      </div>

      {/* 3D Interaction Control Toolbar */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 border border-white/10 p-1 rounded-lg backdrop-blur-md shadow-xl z-10">
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
      <div className="absolute bottom-2 left-2 text-[9px] text-white/30 font-mono pointer-events-none z-10">
        Arraste para girar 360°
      </div>
    </div>
  );
};
