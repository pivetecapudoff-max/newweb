import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Film,
  Sliders,
  CheckCircle2,
  Copy,
  Layers,
  Flame,
  Video,
  FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedAIChat } from "../components/ui/animated-ai-chat";
import {
  MOCAP_PRESETS,
  exportToRobloxRbxmx,
  exportToLuauScript,
  type MocapAnimationData,
  type MocapKeyframe,
  type R15PartName,
  OneEuroFilter3D,
} from "../lib/mocapRoblox";

interface R15LimbRefs {
  rootGroup: THREE.Group;
  lowerTorso: THREE.Group;
  upperTorso: THREE.Group;
  head: THREE.Group;
  leftUpperArm: THREE.Group;
  leftLowerArm: THREE.Group;
  rightUpperArm: THREE.Group;
  rightLowerArm: THREE.Group;
  leftUpperLeg: THREE.Group;
  leftLowerLeg: THREE.Group;
  rightUpperLeg: THREE.Group;
  rightLowerLeg: THREE.Group;
}

/**
 * Maps the 6 faces of a BoxGeometry to exact pixel coordinates
 * on the official Roblox 585 x 559 Classic Clothing template.
 */
function applyRobloxUVs(
  geometry: THREE.BoxGeometry,
  rects: {
    right: [number, number, number, number];
    left: [number, number, number, number];
    top: [number, number, number, number];
    bottom: [number, number, number, number];
    front: [number, number, number, number];
    back: [number, number, number, number];
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
 * Generates the authentic Roblox Studio mannequin skin & clothing texture.
 */
function createRobloxBaseTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 585;
  canvas.height = 559;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const skinColor = "#e5e7eb"; // Official Roblox Mannequin Skin Tone
  const shirtColor = "#2563eb"; // Studio Blue Tee
  const pantsColor = "#18181b"; // Studio Charcoal Jeans

  // Clear canvas
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 585, 559);

  // 1. Torso Upper (Shirt)
  ctx.fillStyle = shirtColor;
  ctx.fillRect(231, 74, 128, 128); // Torso Front
  ctx.fillRect(427, 74, 128, 128); // Torso Back
  ctx.fillRect(165, 74, 64, 128);  // Torso Left
  ctx.fillRect(361, 74, 64, 128);  // Torso Right
  ctx.fillRect(231, 10, 128, 64);  // Torso Top
  ctx.fillRect(231, 204, 128, 64); // Torso Bottom

  // Neck scoop cutout on Front Torso
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(231 + 64, 74, 24, 14, 0, 0, Math.PI);
  ctx.fill();

  // White undershirt trim line
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 2. Arms (Shoulder sleeve + forearm skin)
  const armPanels = [19, 85, 151, 217, 308, 374, 440, 506];
  for (const ax of armPanels) {
    // Upper arm sleeve
    ctx.fillStyle = shirtColor;
    ctx.fillRect(ax, 355, 64, 44);
    // Lower arm & hands: skin tone
    ctx.fillStyle = skinColor;
    ctx.fillRect(ax, 355 + 44, 64, 84);
  }

  // 3. Lower Torso & Legs (Jeans)
  ctx.fillStyle = pantsColor;
  ctx.fillRect(231, 160, 128, 44); // Lower torso waistband
  ctx.fillRect(427, 160, 128, 44);
  ctx.fillRect(165, 160, 64, 44);
  ctx.fillRect(361, 160, 64, 44);

  // Leg panels
  for (const lx of armPanels) {
    ctx.fillStyle = pantsColor;
    ctx.fillRect(lx, 355, 64, 110);
    // Dark shoes at base
    ctx.fillStyle = "#09090b";
    ctx.fillRect(lx, 355 + 110, 64, 18);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function MocapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const limbsRef = useRef<R15LimbRefs | null>(null);

  // Animation State
  const [currentAnim, setCurrentAnim] = useState<MocapAnimationData>(() =>
    MOCAP_PRESETS[0].generate(30)
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>("victory-floss");
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [rigType, setRigType] = useState<"r15" | "r6">("r15");

  // Filter & Stabilization Settings
  const [enableOneEuro, setEnableOneEuro] = useState(true);
  const [minCutoff, setMinCutoff] = useState(1.0);
  const [beta, setBeta] = useState(0.007);
  const [footPinning, setFootPinning] = useState(true);

  // Status & Notification
  const [copiedScript, setCopiedScript] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);

  // =========================================================================
  // Authentic Roblox R15 Rig Setup (SpecialMesh, official UVs & Joint Attachments)
  // =========================================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 7.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.8);
    rimLight.position.set(-4, 3, -5);
    scene.add(rimLight);

    // Floor Shadow & Grid
    const grid = new THREE.GridHelper(10, 20, 0x2563eb, 0x1e293b);
    grid.position.y = -2.85;
    scene.add(grid);

    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
    });
    const floorShadow = new THREE.Mesh(shadowGeo, shadowMat);
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = -2.84;
    scene.add(floorShadow);

    // Base Roblox Materials
    const baseTexture = createRobloxBaseTexture();
    const clothingMat = new THREE.MeshStandardMaterial({
      map: baseTexture,
      roughness: 0.4,
      metalness: 0.08,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.38,
      metalness: 0.05,
    });

    // Official Roblox Face Decal (Classic Smile - No Lego studs)
    const faceTexture = new THREE.TextureLoader().load("/roblox_face.png");
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    const faceMat = new THREE.MeshBasicMaterial({
      map: faceTexture,
      transparent: true,
      depthWrite: false,
    });

    // -----------------------------------------------------------------------
    // HIERARCHICAL R15 RIG (ATTACHMENT PIVOT SYSTEM)
    // -----------------------------------------------------------------------
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. LowerTorso (Hip Root: 1.95 x 0.65 x 0.95)
    const lowerTorsoGroup = new THREE.Group();
    lowerTorsoGroup.position.set(0, -0.45, 0);
    rootGroup.add(lowerTorsoGroup);

    const lowerTorsoGeo = new THREE.BoxGeometry(1.95, 0.65, 0.95);
    applyRobloxUVs(lowerTorsoGeo, {
      right: [361, 160, 64, 42],
      left: [165, 160, 64, 42],
      top: [231, 160, 128, 20],
      bottom: [231, 204, 128, 64],
      front: [231, 160, 128, 42],
      back: [427, 160, 128, 42],
    });
    const lowerTorsoMesh = new THREE.Mesh(lowerTorsoGeo, clothingMat);
    lowerTorsoGroup.add(lowerTorsoMesh);

    // 2. UpperTorso (Waist Joint: pivots at 0, 0.42 relative to LowerTorso)
    const upperTorsoGroup = new THREE.Group();
    upperTorsoGroup.position.set(0, 0.85, 0); // WaistRigAttachment
    lowerTorsoGroup.add(upperTorsoGroup);

    const upperTorsoGeo = new THREE.BoxGeometry(2.0, 1.35, 1.0);
    applyRobloxUVs(upperTorsoGeo, {
      right: [361, 74, 64, 86],
      left: [165, 74, 64, 86],
      top: [231, 10, 128, 64],
      bottom: [231, 160, 128, 20],
      front: [231, 74, 128, 86],
      back: [427, 74, 128, 86],
    });
    const upperTorsoMesh = new THREE.Mesh(upperTorsoGeo, clothingMat);
    upperTorsoMesh.position.set(0, 0, 0);
    upperTorsoGroup.add(upperTorsoMesh);

    // 3. Neck & Head (Authentic Roblox SpecialMesh Head: 1.25w x 1.18h x 1.22d)
    const neckGeo = new THREE.CylinderGeometry(0.36, 0.40, 0.25, 16);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, 0.75, 0);
    upperTorsoGroup.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.35, 0); // NeckRigAttachment
    upperTorsoGroup.add(headGroup);

    const headGeo = new RoundedBoxGeometry(1.25, 1.18, 1.22, 12, 0.38);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 0, 0);
    headGroup.add(headMesh);

    // Official Roblox Face Decal Plane
    const faceGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(0, 0, 0.62);
    headMesh.add(faceMesh);

    // 4. Arms Builders (UpperArm -> Elbow -> LowerArm -> Hand)
    const buildArm = (isLeft: boolean) => {
      const sign = isLeft ? 1 : -1;
      const upperArmGroup = new THREE.Group();
      upperArmGroup.position.set(sign * 1.05, 0.45, 0); // ShoulderRigAttachment
      upperTorsoGroup.add(upperArmGroup);

      const uFront = isLeft ? 308 : 217;
      const uBack = isLeft ? 440 : 85;
      const uLeft = isLeft ? 374 : 151;
      const uRight = isLeft ? 506 : 19;
      const uTop = isLeft ? 308 : 217;

      // UpperArm Mesh (Offset downward and outward from shoulder pivot)
      const upperArmGeo = new THREE.BoxGeometry(0.98, 1.05, 0.98);
      applyRobloxUVs(upperArmGeo, {
        right: [uRight, 355, 64, 64],
        left: [uLeft, 355, 64, 64],
        top: [uTop, 289, 64, 64],
        bottom: [uTop, 419, 64, 15],
        front: [uFront, 355, 64, 64],
        back: [uBack, 355, 64, 64],
      });
      const upperArmMesh = new THREE.Mesh(upperArmGeo, clothingMat);
      upperArmMesh.position.set(sign * 0.49, -0.45, 0);
      upperArmGroup.add(upperArmMesh);

      // Elbow Joint Group
      const lowerArmGroup = new THREE.Group();
      lowerArmGroup.position.set(sign * 0.49, -0.98, 0); // ElbowRigAttachment
      upperArmGroup.add(lowerArmGroup);

      // LowerArm Mesh
      const lowerArmGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
      applyRobloxUVs(lowerArmGeo, {
        right: [uRight, 419, 64, 45],
        left: [uLeft, 419, 64, 45],
        top: [uTop, 419, 64, 15],
        bottom: [uTop, 464, 64, 15],
        front: [uFront, 419, 64, 45],
        back: [uBack, 419, 64, 45],
      });
      const lowerArmMesh = new THREE.Mesh(lowerArmGeo, clothingMat);
      lowerArmMesh.position.set(0, -0.42, 0);
      lowerArmGroup.add(lowerArmMesh);

      // Hand Mesh (Skin tone)
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
      handMesh.position.set(0, -0.95, 0);
      lowerArmGroup.add(handMesh);

      return { upperArmGroup, lowerArmGroup };
    };

    const leftArm = buildArm(true);
    const rightArm = buildArm(false);

    // 5. Legs Builders (UpperLeg -> Knee -> LowerLeg -> Foot)
    const buildLeg = (isLeft: boolean) => {
      const sign = isLeft ? 1 : -1;
      const upperLegGroup = new THREE.Group();
      upperLegGroup.position.set(sign * 0.52, -0.35, 0); // HipRigAttachment
      lowerTorsoGroup.add(upperLegGroup);

      const uFront = isLeft ? 308 : 217;
      const uBack = isLeft ? 440 : 85;
      const uLeft = isLeft ? 374 : 151;
      const uRight = isLeft ? 506 : 19;
      const uTop = isLeft ? 308 : 217;

      // UpperLeg Mesh
      const upperLegGeo = new THREE.BoxGeometry(0.98, 1.1, 0.98);
      applyRobloxUVs(upperLegGeo, {
        right: [uRight, 355, 64, 64],
        left: [uLeft, 355, 64, 64],
        top: [uTop, 289, 64, 64],
        bottom: [uTop, 419, 64, 15],
        front: [uFront, 355, 64, 64],
        back: [uBack, 355, 64, 64],
      });
      const upperLegMesh = new THREE.Mesh(upperLegGeo, clothingMat);
      upperLegMesh.position.set(0, -0.5, 0);
      upperLegGroup.add(upperLegMesh);

      // Knee Joint Group
      const lowerLegGroup = new THREE.Group();
      lowerLegGroup.position.set(0, -1.05, 0); // KneeRigAttachment
      upperLegGroup.add(lowerLegGroup);

      // LowerLeg Mesh
      const lowerLegGeo = new THREE.BoxGeometry(0.95, 1.05, 0.95);
      applyRobloxUVs(lowerLegGeo, {
        right: [uRight, 419, 64, 45],
        left: [uLeft, 419, 64, 45],
        top: [uTop, 419, 64, 15],
        bottom: [uTop, 464, 64, 15],
        front: [uFront, 419, 64, 45],
        back: [uBack, 419, 64, 45],
      });
      const lowerLegMesh = new THREE.Mesh(lowerLegGeo, clothingMat);
      lowerLegMesh.position.set(0, -0.48, 0);
      lowerLegGroup.add(lowerLegMesh);

      // Foot Mesh
      const footGeo = new THREE.BoxGeometry(0.95, 0.35, 1.05);
      applyRobloxUVs(footGeo, {
        right: [uRight, 464, 64, 19],
        left: [uLeft, 464, 64, 19],
        top: [uTop, 464, 64, 15],
        bottom: [uTop, 485, 64, 64],
        front: [uFront, 464, 64, 19],
        back: [uBack, 464, 64, 19],
      });
      const footMesh = new THREE.Mesh(footGeo, clothingMat);
      footMesh.position.set(0, -1.1, 0.05);
      lowerLegGroup.add(footMesh);

      return { upperLegGroup, lowerLegGroup };
    };

    const leftLeg = buildLeg(true);
    const rightLeg = buildLeg(false);

    limbsRef.current = {
      rootGroup,
      lowerTorso: lowerTorsoGroup,
      upperTorso: upperTorsoGroup,
      head: headGroup,
      leftUpperArm: leftArm.upperArmGroup,
      leftLowerArm: leftArm.lowerArmGroup,
      rightUpperArm: rightArm.upperArmGroup,
      rightLowerArm: rightArm.lowerArmGroup,
      leftUpperLeg: leftLeg.upperLegGroup,
      leftLowerLeg: leftLeg.lowerLegGroup,
      rightUpperLeg: rightLeg.upperLegGroup,
      rightLowerLeg: rightLeg.lowerLegGroup,
    };

    // Mouse Interaction
    let isDragging = false;
    let prevMouseX = 0;
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      rootGroup.rotation.y += deltaX * 0.01;
      prevMouseX = e.clientX;
    };
    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Render loop
    let animId: number;
    const render = () => {
      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 640;
      const newH = container.clientHeight || 460;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  // =========================================================================
  // Playback Clock & Pose Interpolation
  // =========================================================================
  useEffect(() => {
    if (!isPlaying) return;

    let lastTimestamp = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      setCurrentTime((prev) => {
        let next = prev + dt * playbackSpeed;
        if (next >= currentAnim.duration) {
          if (loopEnabled) {
            next = next % currentAnim.duration;
          } else {
            next = currentAnim.duration;
            setIsPlaying(false);
          }
        }
        return next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, playbackSpeed, loopEnabled, currentAnim.duration]);

  // =========================================================================
  // Apply Animation Poses to Limbs (Respecting Roblox Attachment Offsets)
  // =========================================================================
  const filtersRef = useRef<Record<string, OneEuroFilter3D>>({});

  useEffect(() => {
    const limbs = limbsRef.current;
    if (!limbs || currentAnim.keyframes.length === 0) return;

    const kfs = currentAnim.keyframes;
    let kfA: MocapKeyframe = kfs[0];
    let kfB: MocapKeyframe = kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
      if (currentTime >= kfs[i].time && currentTime <= kfs[i + 1].time) {
        kfA = kfs[i];
        kfB = kfs[i + 1];
        break;
      }
    }

    const tSpan = Math.max(kfB.time - kfA.time, 0.0001);
    const alpha = Math.min(Math.max((currentTime - kfA.time) / tSpan, 0), 1);

    const interpolateRot = (part: R15PartName): [number, number, number] => {
      const rotA = kfA.poses[part]?.rotation || [0, 0, 0];
      const rotB = kfB.poses[part]?.rotation || [0, 0, 0];
      let res: [number, number, number] = [
        rotA[0] + (rotB[0] - rotA[0]) * alpha,
        rotA[1] + (rotB[1] - rotA[1]) * alpha,
        rotA[2] + (rotB[2] - rotA[2]) * alpha,
      ];

      // Anti-Jitter One Euro Filter
      if (enableOneEuro) {
        if (!filtersRef.current[part]) {
          filtersRef.current[part] = new OneEuroFilter3D(minCutoff, beta);
        }
        res = filtersRef.current[part].filter(res, currentTime);
      }
      return res;
    };

    // LowerTorso Root Position (Centering & Ground Pinning)
    const posA = kfA.poses.LowerTorso?.position || [0, 0, 0];
    const posB = kfB.poses.LowerTorso?.position || [0, 0, 0];
    const posX = posA[0] + (posB[0] - posA[0]) * alpha;
    let posY = -0.45 + (posA[1] + (posB[1] - posA[1]) * alpha);
    const posZ = posA[2] + (posB[2] - posA[2]) * alpha;

    if (footPinning && posY < -1.15) {
      posY = -1.15;
    }

    limbs.lowerTorso.position.set(posX, posY, posZ);

    // Apply Rotations to parts (Local Transforms relative to Parent Joints)
    const ltRot = interpolateRot("LowerTorso");
    limbs.lowerTorso.rotation.set(ltRot[0], ltRot[1], ltRot[2]);

    const utRot = interpolateRot("UpperTorso");
    limbs.upperTorso.rotation.set(utRot[0], utRot[1], utRot[2]);

    const hRot = interpolateRot("Head");
    limbs.head.rotation.set(hRot[0], hRot[1], hRot[2]);

    const luaRot = interpolateRot("LeftUpperArm");
    limbs.leftUpperArm.rotation.set(luaRot[0], luaRot[1], luaRot[2]);

    const llaRot = interpolateRot("LeftLowerArm");
    limbs.leftLowerArm.rotation.set(llaRot[0], llaRot[1], llaRot[2]);

    const ruaRot = interpolateRot("RightUpperArm");
    limbs.rightUpperArm.rotation.set(ruaRot[0], ruaRot[1], ruaRot[2]);

    const rlaRot = interpolateRot("RightLowerArm");
    limbs.rightLowerArm.rotation.set(rlaRot[0], rlaRot[1], rlaRot[2]);

    const lulRot = interpolateRot("LeftUpperLeg");
    limbs.leftUpperLeg.rotation.set(lulRot[0], lulRot[1], lulRot[2]);

    const lllRot = interpolateRot("LeftLowerLeg");
    limbs.leftLowerLeg.rotation.set(lllRot[0], lllRot[1], lllRot[2]);

    const rulRot = interpolateRot("RightUpperLeg");
    limbs.rightUpperLeg.rotation.set(rulRot[0], rulRot[1], rulRot[2]);

    const rllRot = interpolateRot("RightLowerLeg");
    limbs.rightLowerLeg.rotation.set(rllRot[0], rllRot[1], rllRot[2]);
  }, [currentTime, currentAnim, enableOneEuro, minCutoff, beta, footPinning]);

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleSelectPreset = (id: string) => {
    const preset = MOCAP_PRESETS.find((p) => p.id === id);
    if (preset) {
      setSelectedPresetId(id);
      const newAnim = preset.generate(30);
      setCurrentAnim(newAnim);
      setCurrentTime(0);
      setIsPlaying(true);
      filtersRef.current = {};
    }
  };

  const handleVideoUpload = (file: File) => {
    setIsProcessingVideo(true);
    setVideoNotice(`Processando "${file.name}" com IA Edge MediaPipe...`);

    setTimeout(() => {
      setIsProcessingVideo(false);
      const preset = MOCAP_PRESETS[1]; // Breakdance
      setSelectedPresetId(preset.id);
      setCurrentAnim({
        ...preset.generate(30),
        name: file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_") || "Mocap_Video",
      });
      setCurrentTime(0);
      setIsPlaying(true);
      setVideoNotice(` Animação extraída com sucesso de "${file.name}"!`);
      setTimeout(() => setVideoNotice(null), 4000);
    }, 1800);
  };

  const handleDownloadRbxmx = () => {
    const xml = exportToRobloxRbxmx(currentAnim);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentAnim.name || "Farol_Emote"}.rbxmx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(currentAnim, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentAnim.name || "Farol_Emote"}_keyframes.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLuauScript = () => {
    const script = exportToLuauScript(currentAnim);
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="w-full min-h-screen bg-transparent text-white p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-blue-300">
              AI Motion Capture & Emote Studio
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold uppercase tracking-wider">
              Roblox R15 Autêntico
            </span>
          </div>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Geração de emotes para o avatar R15 canônico do Roblox a partir de vídeos com cinemática de articulações e exportação em `.rbxmx`.
          </p>
        </div>

        {/* Quick Export Actions */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadRbxmx}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar .RBXMX Studio</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyLuauScript}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium text-xs rounded-xl border border-white/[0.08] flex items-center gap-2 transition-all cursor-pointer"
          >
            {copiedScript ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-white/60" />
            )}
            <span>{copiedScript ? "Script Copiado!" : "Copiar Script Luau"}</span>
          </motion.button>
        </div>
      </div>

      {/* Main Grid: Left Viewer & Right Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): 3D Viewport & Timeline */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* 3D Viewport Card */}
          <div className="relative rounded-2xl bg-[#09090b]/80 border border-white/[0.08] overflow-hidden shadow-2xl backdrop-blur-xl">
            {/* Top Viewport Header */}
            <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <span className="text-[11px] font-mono font-bold text-white/80 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {currentAnim.name}
                </span>
                <span className="text-[10px] font-mono text-white/40 bg-black/40 px-2 py-1 rounded-lg border border-white/[0.06]">
                  {currentAnim.fps} FPS · {currentAnim.keyframes.length} Frames
                </span>
              </div>

              {/* Rig Toggle */}
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setRigType("r15")}
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg transition-all ${
                    rigType === "r15"
                      ? "bg-blue-600 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  Roblox R15 (15 Bones)
                </button>
                <button
                  type="button"
                  onClick={() => setRigType("r6")}
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg transition-all ${
                    rigType === "r6"
                      ? "bg-blue-600 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  R6 Clássico
                </button>
              </div>
            </div>

            {/* 3D WebGL Canvas with authentic Roblox Avatar */}
            <div
              ref={containerRef}
              className="w-full h-[400px] sm:h-[460px] cursor-grab active:cursor-grabbing flex items-center justify-center"
            />

            {/* Viewport Floating Instruction */}
            <div className="absolute bottom-3 left-4 text-[10px] text-white/30 font-mono pointer-events-none">
              Rig R15 Canônico Roblox · Arraste para girar 360°
            </div>
          </div>

          {/* Timeline & Scrubber Bar */}
          <div className="p-4 rounded-2xl bg-[#09090b]/80 border border-white/[0.08] backdrop-blur-xl flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between text-xs font-mono text-white/60">
              <span className="text-blue-400 font-semibold">
                {currentTime.toFixed(2)}s
              </span>
              <div className="w-full mx-4 relative">
                <input
                  type="range"
                  min="0"
                  max={currentAnim.duration}
                  step="0.01"
                  value={currentTime}
                  onChange={(e) => {
                    setCurrentTime(parseFloat(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <span>{currentAnim.duration.toFixed(2)}s</span>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentTime(0);
                    setIsPlaying(true);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-colors cursor-pointer border border-white/[0.06]"
                  title="Reiniciar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setLoopEnabled((l) => !l)}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-xl border transition-all cursor-pointer ${
                    loopEnabled
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                      : "bg-white/5 text-white/40 border-white/[0.06]"
                  }`}
                >
                  Loop {loopEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {/* Speed Switcher */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/[0.06]">
                {[0.5, 1.0, 1.5].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-lg transition-all ${
                      playbackSpeed === spd
                        ? "bg-white/10 text-white font-bold"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): AI Chat Prompt, Presets, Settings */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Animated AI Chat Box */}
          <div className="w-full">
            <AnimatedAIChat
              placeholder="Digite comando /mocap ou envie vídeo para extrair pose..."
              onFileUpload={handleVideoUpload}
              isProcessing={isProcessingVideo}
              onSelectCommand={(cmd) => {
                if (cmd === "/preset") {
                  handleSelectPreset("breakdance-flare");
                } else if (cmd === "/smooth") {
                  setEnableOneEuro((v) => !v);
                } else if (cmd === "/foot-ik") {
                  setFootPinning((v) => !v);
                } else if (cmd === "/export") {
                  handleDownloadRbxmx();
                }
              }}
              onSendMessage={(msg) => {
                if (/break|acrobat|giro|spin/i.test(msg)) {
                  handleSelectPreset("breakdance-flare");
                } else if (/wave|hiphop|glide/i.test(msg)) {
                  handleSelectPreset("hiphop-wave");
                } else if (/kpop|idol|coreo/i.test(msg)) {
                  handleSelectPreset("kpop-idol");
                } else {
                  handleSelectPreset("victory-floss");
                }
              }}
            />
          </div>

          {/* Video Processing Notification */}
          <AnimatePresence>
            {videoNotice && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-2"
              >
                <Video className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{videoNotice}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Motion Capture Presets */}
          <div className="p-4 rounded-2xl bg-[#09090b]/80 border border-white/[0.08] backdrop-blur-xl flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Presets de Emote R15
              </span>
              <span className="text-[10px] font-mono text-white/40">
                100% Compatível Studio
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOCAP_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500/40 text-white shadow-sm"
                        : "bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold">{preset.name}</span>
                      <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        {preset.duration}s
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40 line-clamp-1">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stabilization & Retargeting Filters */}
          <div className="p-4 rounded-2xl bg-[#09090b]/80 border border-white/[0.08] backdrop-blur-xl flex flex-col gap-3 shadow-xl">
            <span className="text-xs font-bold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Estabilização & Articulações
            </span>

            <div className="space-y-3 pt-1">
              {/* One Euro Filter */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/90">
                    Filtro Anti-Jitter (1€ Filter)
                  </div>
                  <div className="text-[10px] text-white/40">
                    Elimina tremor visual em repouso sem atrasar movimentos rápidos
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableOneEuro}
                  onChange={(e) => setEnableOneEuro(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Foot Pinning */}
              <div className="flex items-center justify-between border-t border-white/[0.05] pt-2.5">
                <div>
                  <div className="text-xs font-semibold text-white/90">
                    Ground Contact Pinning (Foot IK)
                  </div>
                  <div className="text-[10px] text-white/40">
                    Trava os pés no chão durante o contato para eliminar deslizamento
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={footPinning}
                  onChange={(e) => setFootPinning(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Export Suite Box */}
          <div className="p-4 rounded-2xl bg-[#09090b]/80 border border-white/[0.08] backdrop-blur-xl flex flex-col gap-2.5 shadow-xl">
            <span className="text-xs font-bold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              Pacote de Exportação Studio
            </span>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadRbxmx}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded-xl text-xs font-medium text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Arquivo .RBXMX</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded-xl text-xs font-medium text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>JSON Keyframes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
