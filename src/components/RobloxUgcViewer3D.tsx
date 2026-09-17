import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RotateCw, RotateCcw, ZoomIn, ZoomOut, Box, Sparkles, Grid } from "lucide-react";

export interface UgcMeshGeometry {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export interface RobloxUgcViewer3DProps {
  geometry: UgcMeshGeometry | null;
  textureUrl?: string | null;
  accessoryType?: string;
  multiBodyView?: "classic" | "slender" | "rthro";
  className?: string;
  onReplaceClick?: () => void;
}

export const RobloxUgcViewer3D: React.FC<RobloxUgcViewer3DProps> = ({
  geometry,
  textureUrl,
  accessoryType = "Hair",
  multiBodyView = "classic",
  className = "",
  onReplaceClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [bodyType, setBodyType] = useState<"classic" | "slender" | "rthro">(multiBodyView);

  // Sync prop changes
  useEffect(() => {
    setBodyType(multiBodyView);
  }, [multiBodyView]);

  // Refs for 3D state & interaction
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const accessoryMeshRef = useRef<THREE.Mesh | null>(null);
  const isDraggingRef = useRef(false);
  const previousPointerRef = useRef({ x: 0, y: 0 });
  const rotationVelocityRef = useRef({ x: 0, y: 0 });
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 420;
    const height = container.clientHeight || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color("#050508");

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 5.2);
    camera.lookAt(0, 1.3, 0);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. Lighting Suite (Studio 3-Point with Cyber Blue Rim)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Key Light (Main soft white light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(3.5, 5, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Soft Fill Light (Neutral cool)
    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.6);
    fillLight.position.set(-3.5, 2.5, 2);
    scene.add(fillLight);

    // Rim Light (Cyber Blue Neon Outline)
    const rimLight = new THREE.DirectionalLight(0x3b82f6, 1.8);
    rimLight.position.set(0, 3.5, -4.5);
    scene.add(rimLight);

    // Top Halo Light for Hair Shine
    const topLight = new THREE.DirectionalLight(0x60a5fa, 0.7);
    topLight.position.set(0, 6, 0);
    scene.add(topLight);

    // 5. Studio Pedestal / Platform with Glowing Cyber Ring
    const platformGroup = new THREE.Group();
    scene.add(platformGroup);

    // Dark Base Cylinder
    const baseGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.18, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0f,
      roughness: 0.6,
      metalness: 0.2,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -1.9, 0);
    baseMesh.receiveShadow = true;
    platformGroup.add(baseMesh);

    // Neon Glow Ring
    const ringGeo = new THREE.RingGeometry(1.58, 1.66, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, -1.805, 0);
    platformGroup.add(ringMesh);

    // Subtle Radial Grid on Floor
    const gridHelper = new THREE.GridHelper(3.2, 8, 0x2563eb, 0x1e293b);
    gridHelper.position.set(0, -1.8, 0);
    platformGroup.add(gridHelper);

    // 6. Avatar Mannequin Group
    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);
    avatarGroupRef.current = avatarGroup;

    // Base Mannequin Materials (Refined studio slate)
    const mannequinSkinMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.05,
    });

    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.45,
      metalness: 0.1,
    });

    // Authentic Roblox Head (Rounded corners, no Lego studs!)
    const headWidth = bodyType === "slender" ? 1.75 : 2.0;
    const headHeight = 1.25;
    const headDepth = 1.25;
    const headGeo = new RoundedBoxGeometry(headWidth, headHeight, headDepth, 6, 0.22);
    const headMesh = new THREE.Mesh(headGeo, mannequinSkinMat);
    headMesh.position.set(0, 1.72, 0);
    avatarGroup.add(headMesh);

    // Official Roblox Face Smile Decal
    const faceTexLoader = new THREE.TextureLoader();
    faceTexLoader.load("/roblox_face.png", (faceTex) => {
      faceTex.colorSpace = THREE.SRGBColorSpace;
      const faceMat = new THREE.MeshBasicMaterial({
        map: faceTex,
        transparent: true,
        depthWrite: false,
      });
      const faceGeo = new THREE.PlaneGeometry(1.15, 1.15);
      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      faceMesh.position.set(0, 0, (headDepth / 2) + 0.01);
      headMesh.add(faceMesh);
    });

    // Authentic Roblox Torso & Limbs
    if (bodyType === "slender") {
      // Slender / Woman Fit (Slimmer waist and limbs)
      const upperTorsoGeo = new RoundedBoxGeometry(1.6, 1.3, 0.85, 4, 0.1);
      const upperTorso = new THREE.Mesh(upperTorsoGeo, torsoMat);
      upperTorso.position.set(0, 0.45, 0);
      avatarGroup.add(upperTorso);

      const lowerTorsoGeo = new RoundedBoxGeometry(1.4, 0.65, 0.8, 4, 0.08);
      const lowerTorso = new THREE.Mesh(lowerTorsoGeo, torsoMat);
      lowerTorso.position.set(0, -0.42, 0);
      avatarGroup.add(lowerTorso);

      // Slender Arms
      for (const sign of [-1, 1]) {
        const armGeo = new RoundedBoxGeometry(0.75, 2.0, 0.75, 4, 0.1);
        const armMesh = new THREE.Mesh(armGeo, mannequinSkinMat);
        armMesh.position.set(sign * 1.25, 0.05, 0);
        armMesh.rotation.z = sign * -0.06;
        avatarGroup.add(armMesh);
      }

      // Slender Legs
      for (const sign of [-1, 1]) {
        const legGeo = new RoundedBoxGeometry(0.78, 2.0, 0.78, 4, 0.1);
        const legMesh = new THREE.Mesh(legGeo, torsoMat);
        legMesh.position.set(sign * 0.45, -1.75, 0);
        avatarGroup.add(legMesh);
      }
    } else {
      // Classic Roblox Blocky R6/R15
      const upperTorsoGeo = new THREE.BoxGeometry(2.0, 1.35, 1.0);
      const upperTorso = new THREE.Mesh(upperTorsoGeo, torsoMat);
      upperTorso.position.set(0, 0.42, 0);
      avatarGroup.add(upperTorso);

      const lowerTorsoGeo = new THREE.BoxGeometry(1.95, 0.65, 0.95);
      const lowerTorso = new THREE.Mesh(lowerTorsoGeo, torsoMat);
      lowerTorso.position.set(0, -0.45, 0);
      avatarGroup.add(lowerTorso);

      // Arms
      for (const sign of [-1, 1]) {
        const armGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
        const armMesh = new THREE.Mesh(armGeo, mannequinSkinMat);
        armMesh.position.set(sign * 1.5, 0.05, 0);
        armMesh.rotation.z = sign * -0.07;
        avatarGroup.add(armMesh);
      }

      // Legs
      for (const sign of [-1, 1]) {
        const legGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
        const legMesh = new THREE.Mesh(legGeo, torsoMat);
        legMesh.position.set(sign * 0.5, -1.75, 0);
        avatarGroup.add(legMesh);
      }
    }

    // 7. Mount UGC Accessory Mesh onto Avatar
    if (geometry && geometry.positions.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(geometry.positions, 3));
      if (geometry.normals && geometry.normals.length) {
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(geometry.normals, 3));
      }
      if (geometry.uvs && geometry.uvs.length) {
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(geometry.uvs, 2));
      }
      if (geometry.indices && geometry.indices.length) {
        geo.setIndex(geometry.indices);
      }
      geo.computeVertexNormals();
      geo.computeBoundingBox();

      // Compute bounding box and alignment
      const bbox = geo.boundingBox || new THREE.Box3();

      // Texture loader with proper double-side and alphaTest for hair strands
      const mat = new THREE.MeshStandardMaterial({
        color: textureUrl ? 0xffffff : 0xf1f5f9,
        roughness: 0.45,
        metalness: 0.04,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.03,
        depthWrite: true,
        wireframe,
      });

      if (textureUrl) {
        const texLoader = new THREE.TextureLoader();
        texLoader.load(
          textureUrl,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false;
            mat.map = tex;
            mat.needsUpdate = true;
          },
          undefined,
          () => {
            // Fallback: try with flipY true if inverted
            texLoader.load(textureUrl, (fallbackTex) => {
              fallbackTex.colorSpace = THREE.SRGBColorSpace;
              fallbackTex.flipY = true;
              mat.map = fallbackTex;
              mat.needsUpdate = true;
            });
          }
        );
      }

      const accessoryMesh = new THREE.Mesh(geo, mat);
      accessoryMeshRef.current = accessoryMesh;
      accessoryMesh.castShadow = true;

      // Smart Alignment Logic:
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      const centerY = (bbox.min.y + bbox.max.y) / 2;
      const centerZ = (bbox.min.z + bbox.max.z) / 2;
      const topY = bbox.max.y;

      let posX = 0;
      let posY = 0;
      let posZ = 0;

      if (accessoryType === "Hair" || accessoryType === "Hat") {
        // In Roblox character coordinates, top of head is at y = 2.345 (head is 1.72 + 1.25/2)
        if (topY > 1.2 && topY < 3.8) {
          // Modeled in character coordinates: snap crown over head skull & center over head
          const crownDelta = 2.38 - topY;
          posY = Math.abs(crownDelta) < 0.6 ? crownDelta : 0;
          posX = -centerX;
          posZ = -centerZ;
        } else {
          // Modeled at origin: place crown atop head
          posY = 2.345 - bbox.min.y;
          posX = -centerX;
          posZ = -centerZ;
        }
      } else if (accessoryType === "Face") {
        posX = -centerX;
        posY = 1.72 - centerY;
        posZ = (headDepth / 2) + 0.05;
      } else if (accessoryType === "Neck") {
        posX = -centerX;
        posY = 1.15 - centerY;
        posZ = -centerZ;
      } else if (accessoryType === "Shoulder") {
        posX = 1.5 - centerX;
        posY = 1.0 - centerY;
        posZ = -centerZ;
      } else if (accessoryType === "Back") {
        posX = -centerX;
        posY = 0.45 - centerY;
        posZ = -0.55;
      } else if (accessoryType === "Front") {
        posX = -centerX;
        posY = 0.45 - centerY;
        posZ = 0.55;
      } else if (accessoryType === "Waist") {
        posX = -centerX;
        posY = -0.45 - centerY;
        posZ = -centerZ;
      } else {
        posX = -centerX;
        posY = 1.72 + 0.35 - centerY;
        posZ = -centerZ;
      }

      accessoryMesh.position.set(posX, posY, posZ);
      avatarGroup.add(accessoryMesh);
    }

    // 8. Resize Observer
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth || 420;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 9. Animation & Render Loop
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Auto-Rotation
      if (autoRotate && avatarGroupRef.current) {
        avatarGroupRef.current.rotation.y += delta * 0.75;
      } else if (avatarGroupRef.current) {
        // Inertia damping after drag
        avatarGroupRef.current.rotation.y += rotationVelocityRef.current.y;
        avatarGroupRef.current.rotation.x += rotationVelocityRef.current.x;
        avatarGroupRef.current.rotation.x = Math.max(-0.6, Math.min(0.6, avatarGroupRef.current.rotation.x));
        rotationVelocityRef.current.x *= 0.92;
        rotationVelocityRef.current.y *= 0.92;
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Initial angle
    avatarGroup.rotation.y = 0.35;

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [geometry, textureUrl, accessoryType, bodyType, wireframe]);

  // Handle Zoom adjustments
  useEffect(() => {
    if (!cameraRef.current) return;
    const baseDistance = 5.2;
    const targetDistance = Math.max(2.4, Math.min(8.0, baseDistance - zoomLevel * 0.8));
    cameraRef.current.position.z = targetDistance;
  }, [zoomLevel]);

  // Pointer Drag Orbit Handling
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    previousPointerRef.current = { x: e.clientX, y: e.clientY };
    rotationVelocityRef.current = { x: 0, y: 0 };
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !avatarGroupRef.current) return;
    const deltaX = e.clientX - previousPointerRef.current.x;
    const deltaY = e.clientY - previousPointerRef.current.y;
    previousPointerRef.current = { x: e.clientX, y: e.clientY };

    avatarGroupRef.current.rotation.y += deltaX * 0.012;
    avatarGroupRef.current.rotation.x += deltaY * 0.008;
    avatarGroupRef.current.rotation.x = Math.max(-0.6, Math.min(0.6, avatarGroupRef.current.rotation.x));

    rotationVelocityRef.current = {
      x: deltaY * 0.003,
      y: deltaX * 0.005,
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

  const resetView = () => {
    if (avatarGroupRef.current) {
      avatarGroupRef.current.rotation.set(0, 0.35, 0);
      rotationVelocityRef.current = { x: 0, y: 0 };
    }
    setZoomLevel(0);
  };

  return (
    <div
      className={`relative w-full h-full min-h-[380px] select-none overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050508] shadow-2xl ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Top Header: Body Fitting Switcher */}
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/80 border border-white/10 rounded-xl p-1 backdrop-blur-md z-10 shadow-lg">
        <span className="text-[10px] font-bold text-white/40 uppercase px-2 tracking-wider flex items-center gap-1">
          <Box className="w-3 h-3 text-blue-400" />
          Fitting:
        </span>
        <button
          type="button"
          onClick={() => setBodyType("classic")}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-all uppercase ${
            bodyType === "classic"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          Classic Blocky
        </button>
        <button
          type="button"
          onClick={() => setBodyType("slender")}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-all uppercase ${
            bodyType === "slender"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          Slender / Woman
        </button>
      </div>

      {/* Floating Replace Button (if handler passed) */}
      {onReplaceClick && (
        <button
          type="button"
          onClick={onReplaceClick}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white/70 hover:text-white text-xs font-semibold backdrop-blur-md transition-all shadow-md flex items-center gap-1.5 z-10"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Substituir Arquivos
        </button>
      )}

      {/* Bottom Right Toolbar */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/80 border border-white/10 p-1 rounded-xl backdrop-blur-md shadow-xl z-10">
        <button
          type="button"
          onClick={() => setWireframe((w) => !w)}
          title={wireframe ? "Desativar Wireframe" : "Inspecionar Triângulos / Wireframe"}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            wireframe
              ? "text-blue-400 bg-blue-500/20 border border-blue-500/30"
              : "text-white/40 hover:text-white/90 hover:bg-white/5"
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          title={autoRotate ? "Pausar Rotação" : "Girar Automaticamente 360°"}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            autoRotate
              ? "text-blue-400 bg-blue-500/20 border border-blue-500/30"
              : "text-white/40 hover:text-white/90 hover:bg-white/5"
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Resetar Câmera Frontal"
          className="p-1.5 rounded-lg text-xs text-white/40 hover:text-white/90 hover:bg-white/5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <div className="h-4 w-px bg-white/10 mx-0.5" />
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(3, z + 1))}
          title="Aproximar Zoom"
          className="p-1.5 rounded-lg text-xs text-white/40 hover:text-white/90 hover:bg-white/5 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(-2, z - 1))}
          title="Afastar Zoom"
          className="p-1.5 rounded-lg text-xs text-white/40 hover:text-white/90 hover:bg-white/5 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtle bottom drag hint */}
      <div className="absolute bottom-3 left-3 text-[10px] text-white/30 font-mono pointer-events-none z-10 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Arraste com o mouse para girar 360°
      </div>
    </div>
  );
};
