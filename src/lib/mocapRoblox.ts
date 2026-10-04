/**
 * Farol AI Motion Capture & Retargeting Engine for Roblox R15 & R6
 * Converts video landmarks / tracking data to Roblox KeyframeSequence (RBXMX),
 * JSON tracks, and Luau executable animation scripts.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type R15PartName =
  | "HumanoidRootPart"
  | "LowerTorso"
  | "UpperTorso"
  | "Head"
  | "LeftUpperArm"
  | "LeftLowerArm"
  | "LeftHand"
  | "RightUpperArm"
  | "RightLowerArm"
  | "RightHand"
  | "LeftUpperLeg"
  | "LeftLowerLeg"
  | "LeftFoot"
  | "RightUpperLeg"
  | "RightLowerLeg"
  | "RightFoot";

export interface MocapPoseTransform {
  position?: [number, number, number];
  rotation: [number, number, number]; // Euler angles (radians): pitch (X), yaw (Y), roll (Z)
}

export interface MocapKeyframe {
  time: number; // in seconds (e.g., 0.0, 0.033, 0.066...)
  poses: Partial<Record<R15PartName, MocapPoseTransform>>;
}

export interface MocapAnimationData {
  name: string;
  duration: number; // in seconds
  fps: number;
  loop: boolean;
  keyframes: MocapKeyframe[];
}

// =============================================================================
// One Euro Filter (Anti-Jitter for Mocap tracking)
// =============================================================================

export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private smoothingFactor(te: number, cutoff: number): number {
    const r = 2 * Math.PI * cutoff * te;
    return r / (r + 1);
  }

  public filter(x: number, t: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      this.dxPrev = 0;
      return x;
    }

    const te = Math.max(t - this.tPrev, 0.0001);
    const aD = this.smoothingFactor(te, this.dCutoff);
    const dx = (x - this.xPrev) / te;
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.smoothingFactor(te, cutoff);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;

    return xHat;
  }

  public reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

export class OneEuroFilter3D {
  private fx: OneEuroFilter1D;
  private fy: OneEuroFilter1D;
  private fz: OneEuroFilter1D;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.fx = new OneEuroFilter1D(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter1D(minCutoff, beta, dCutoff);
    this.fz = new OneEuroFilter1D(minCutoff, beta, dCutoff);
  }

  public filter(v: [number, number, number], t: number): [number, number, number] {
    return [
      this.fx.filter(v[0], t),
      this.fy.filter(v[1], t),
      this.fz.filter(v[2], t),
    ];
  }

  public reset() {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}

// =============================================================================
// Math Helpers: CFrame Matrix Calculation & Normalization
// =============================================================================

export function eulerToRotationMatrix(rx: number, ry: number, rz: number): number[] {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  // Tait-Bryan angles: Z * Y * X
  const r00 = cy * cz;
  const r01 = -cy * sz;
  const r02 = sy;

  const r10 = cx * sz + sx * sy * cz;
  const r11 = cx * cz - sx * sy * sz;
  const r12 = -sx * cy;

  const r20 = sx * sz - cx * sy * cz;
  const r21 = sx * cz + cx * sy * sz;
  const r22 = cx * cy;

  return [r00, r01, r02, r10, r11, r12, r20, r21, r22];
}

export function formatCFrameXml(pos: [number, number, number], rot: [number, number, number]): string {
  const [px, py, pz] = pos;
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = eulerToRotationMatrix(rot[0], rot[1], rot[2]);

  return `
    <CoordinateFrame name="CFrame">
      <X>${px.toFixed(5)}</X>
      <Y>${py.toFixed(5)}</Y>
      <Z>${pz.toFixed(5)}</Z>
      <R00>${r00.toFixed(5)}</R00>
      <R01>${r01.toFixed(5)}</R01>
      <R02>${r02.toFixed(5)}</R02>
      <R10>${r10.toFixed(5)}</R10>
      <R11>${r11.toFixed(5)}</R11>
      <R12>${r12.toFixed(5)}</R12>
      <R20>${r20.toFixed(5)}</R20>
      <R21>${r21.toFixed(5)}</R21>
      <R22>${r22.toFixed(5)}</R22>
    </CoordinateFrame>
  `.trim();
}

// =============================================================================
// RBXMX XML Serializer for KeyframeSequence
// =============================================================================

function generatePoseXml(
  name: string,
  transform: MocapPoseTransform | undefined,
  childrenXml: string = ""
): string {
  const pos: [number, number, number] = transform?.position || [0, 0, 0];
  const rot: [number, number, number] = transform?.rotation || [0, 0, 0];
  const cframeXml = formatCFrameXml(pos, rot);

  return `
    <Item class="Pose">
      <Properties>
        <string name="Name">${name}</string>
        <float name="Weight">1</float>
        <token name="EasingStyle">0</token>
        <token name="EasingDirection">0</token>
        ${cframeXml}
      </Properties>
      ${childrenXml}
    </Item>
  `;
}

/**
 * Builds the canonical R15 hierarchical Pose tree for a given keyframe:
 * HumanoidRootPart
 *   └── LowerTorso
 *         ├── UpperTorso
 *         │     ├── Head
 *         │     ├── LeftUpperArm
 *         │     │     └── LeftLowerArm
 *         │     │           └── LeftHand
 *         │     └── RightUpperArm
 *         │           └── RightLowerArm
 *         │                 └── RightHand
 *         ├── LeftUpperLeg
 *         │     └── LeftLowerLeg
 *         │           └── LeftFoot
 *         └── RightUpperLeg
 *               └── RightLowerLeg
 *                     └── RightFoot
 */
export function buildR15PoseHierarchy(poses: Partial<Record<R15PartName, MocapPoseTransform>>): string {
  const leftHand = generatePoseXml("LeftHand", poses.LeftHand);
  const leftLowerArm = generatePoseXml("LeftLowerArm", poses.LeftLowerArm, leftHand);
  const leftUpperArm = generatePoseXml("LeftUpperArm", poses.LeftUpperArm, leftLowerArm);

  const rightHand = generatePoseXml("RightHand", poses.RightHand);
  const rightLowerArm = generatePoseXml("RightLowerArm", poses.RightLowerArm, rightHand);
  const rightUpperArm = generatePoseXml("RightUpperArm", poses.RightUpperArm, rightLowerArm);

  const head = generatePoseXml("Head", poses.Head);

  const upperTorso = generatePoseXml("UpperTorso", poses.UpperTorso, `${head}\n${leftUpperArm}\n${rightUpperArm}`);

  const leftFoot = generatePoseXml("LeftFoot", poses.LeftFoot);
  const leftLowerLeg = generatePoseXml("LeftLowerLeg", poses.LeftLowerLeg, leftFoot);
  const leftUpperLeg = generatePoseXml("LeftUpperLeg", poses.LeftUpperLeg, leftLowerLeg);

  const rightFoot = generatePoseXml("RightFoot", poses.RightFoot);
  const rightLowerLeg = generatePoseXml("RightLowerLeg", poses.RightLowerLeg, rightFoot);
  const rightUpperLeg = generatePoseXml("RightUpperLeg", poses.RightUpperLeg, rightLowerLeg);

  const lowerTorso = generatePoseXml(
    "LowerTorso",
    poses.LowerTorso,
    `${upperTorso}\n${leftUpperLeg}\n${rightUpperLeg}`
  );

  return generatePoseXml("HumanoidRootPart", poses.HumanoidRootPart, lowerTorso);
}

/**
 * Serializes the animation into an official Roblox RBXMX XML KeyframeSequence
 * Ready to drag into Roblox Studio or import via Animation Editor.
 */
export function exportToRobloxRbxmx(anim: MocapAnimationData): string {
  const keyframesXml = anim.keyframes
    .map((kf) => {
      const poseHierarchy = buildR15PoseHierarchy(kf.poses);
      return `
    <Item class="Keyframe">
      <Properties>
        <string name="Name">Keyframe</string>
        <float name="Time">${kf.time.toFixed(4)}</float>
      </Properties>
      ${poseHierarchy}
    </Item>
      `;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <Item class="KeyframeSequence">
    <Properties>
      <string name="Name">${anim.name || "Farol_Mocap_Emote"}</string>
      <bool name="Loop">${anim.loop ? "true" : "false"}</bool>
      <token name="Priority">2</token> <!-- Action Priority -->
    </Properties>
    ${keyframesXml}
  </Item>
</roblox>
`;
}

/**
 * Generates a self-contained Luau script for Roblox Studio
 * Developers can simply copy & paste this into the Studio Command Bar to generate the KeyframeSequence.
 */
export function exportToLuauScript(anim: MocapAnimationData): string {
  const kfJson = JSON.stringify(
    anim.keyframes.map((k) => ({
      t: Number(k.time.toFixed(3)),
      p: k.poses,
    }))
  );

  return `--[[
  Farol AI Motion Capture -> Roblox Studio Generator
  Emote Name: ${anim.name}
  Total Frames: ${anim.keyframes.length} | Duration: ${anim.duration.toFixed(2)}s | Loop: ${anim.loop}
  Paste this into the Roblox Studio Command Bar (View > Command Bar)
--]]

local HttpService = game:GetService("HttpService")
local animData = HttpService:JSONDecode([===[${kfJson}]===])

local kfs = Instance.new("KeyframeSequence")
kfs.Name = "${anim.name.replace(/[^a-zA-Z0-9_]/g, "_")}"
kfs.Loop = ${anim.loop}
kfs.Priority = Enum.AnimationPriority.Action

local function createPose(name, cf)
    local p = Instance.new("Pose")
    p.Name = name
    p.Weight = 1
    p.CFrame = cf or CFrame.new()
    return p
end

for _, kfInfo in ipairs(animData) do
    local kf = Instance.new("Keyframe")
    kf.Time = kfInfo.t
    
    local poses = kfInfo.p
    local root = createPose("HumanoidRootPart")
    
    local ltData = poses.LowerTorso or {}
    local ltPos = ltData.position or {0, 0, 0}
    local ltRot = ltData.rotation or {0, 0, 0}
    local ltCf = CFrame.new(ltPos[1], ltPos[2], ltPos[3]) * CFrame.Angles(ltRot[1], ltRot[2], ltRot[3])
    local lowerTorso = createPose("LowerTorso", ltCf)
    lowerTorso.Parent = root
    
    local utData = poses.UpperTorso or {}
    local utRot = utData.rotation or {0, 0, 0}
    local upperTorso = createPose("UpperTorso", CFrame.Angles(utRot[1], utRot[2], utRot[3]))
    upperTorso.Parent = lowerTorso
    
    -- Head
    local hData = poses.Head or {}
    local hRot = hData.rotation or {0, 0, 0}
    createPose("Head", CFrame.Angles(hRot[1], hRot[2], hRot[3])).Parent = upperTorso
    
    -- Arms
    local luaData = poses.LeftUpperArm or {}
    local luaRot = luaData.rotation or {0, 0, 0}
    local lua = createPose("LeftUpperArm", CFrame.Angles(luaRot[1], luaRot[2], luaRot[3]))
    lua.Parent = upperTorso
    
    local llaData = poses.LeftLowerArm or {}
    local llaRot = llaData.rotation or {0, 0, 0}
    local lla = createPose("LeftLowerArm", CFrame.Angles(llaRot[1], llaRot[2], llaRot[3]))
    lla.Parent = lua
    
    local lhData = poses.LeftHand or {}
    local lhRot = lhData.rotation or {0, 0, 0}
    createPose("LeftHand", CFrame.Angles(lhRot[1], lhRot[2], lhRot[3])).Parent = lla
    
    local ruaData = poses.RightUpperArm or {}
    local ruaRot = ruaData.rotation or {0, 0, 0}
    local rua = createPose("RightUpperArm", CFrame.Angles(ruaRot[1], ruaRot[2], ruaRot[3]))
    rua.Parent = upperTorso
    
    local rlaData = poses.RightLowerArm or {}
    local rlaRot = rlaData.rotation or {0, 0, 0}
    local rla = createPose("RightLowerArm", CFrame.Angles(rlaRot[1], rlaRot[2], rlaRot[3]))
    rla.Parent = rua
    
    local rhData = poses.RightHand or {}
    local rhRot = rhData.rotation or {0, 0, 0}
    createPose("RightHand", CFrame.Angles(rhRot[1], rhRot[2], rhRot[3])).Parent = rla
    
    -- Legs
    local lulData = poses.LeftUpperLeg or {}
    local lulRot = lulData.rotation or {0, 0, 0}
    local lul = createPose("LeftUpperLeg", CFrame.Angles(lulRot[1], lulRot[2], lulRot[3]))
    lul.Parent = lowerTorso
    
    local lllData = poses.LeftLowerLeg or {}
    local lllRot = lllData.rotation or {0, 0, 0}
    local lll = createPose("LeftLowerLeg", CFrame.Angles(lllRot[1], lllRot[2], lllRot[3]))
    lll.Parent = lul
    
    local lfData = poses.LeftFoot or {}
    local lfRot = lfData.rotation or {0, 0, 0}
    createPose("LeftFoot", CFrame.Angles(lfRot[1], lfRot[2], lfRot[3])).Parent = lll
    
    local rulData = poses.RightUpperLeg or {}
    local rulRot = rulData.rotation or {0, 0, 0}
    local rul = createPose("RightUpperLeg", CFrame.Angles(rulRot[1], rulRot[2], rulRot[3]))
    rul.Parent = lowerTorso
    
    local rllData = poses.RightLowerLeg or {}
    local rllRot = rllData.rotation or {0, 0, 0}
    local rll = createPose("RightLowerLeg", CFrame.Angles(rllRot[1], rllRot[2], rllRot[3]))
    rll.Parent = rul
    
    local rfData = poses.RightFoot or {}
    local rfRot = rfData.rotation or {0, 0, 0}
    createPose("RightFoot", CFrame.Angles(rfRot[1], rfRot[2], rfRot[3])).Parent = rll
    
    root.Parent = kf
    kf.Parent = kfs
end

kfs.Parent = workspace
print(" Farol Mocap: KeyframeSequence '" .. kfs.Name .. "' criado com sucesso no Workspace!")
`;
}

// =============================================================================
// High-Fidelity Motion Capture Presets (Studio Demos)
// =============================================================================

export interface MocapPreset {
  id: string;
  name: string;
  category: "Dance" | "Emote" | "Acrobatic" | "Groove";
  description: string;
  duration: number;
  bpm: number;
  generate: (fps?: number) => MocapAnimationData;
}

export const MOCAP_PRESETS: MocapPreset[] = [
  {
    id: "victory-floss",
    name: "Victory Floss (Hype Dance)",
    category: "Dance",
    description: "Emote rítmico clássico com oscilação contínua de quadris e braços alternados.",
    duration: 2.4,
    bpm: 120,
    generate: (fps = 30) => {
      const framesCount = Math.round(2.4 * fps);
      const keyframes: MocapKeyframe[] = [];

      for (let i = 0; i <= framesCount; i++) {
        const t = (i / framesCount) * 2.4;
        const phase = t * Math.PI * 4; // 2 full cycles

        const hipSway = Math.sin(phase) * 0.35;
        const armSwingX = Math.sin(phase) * 0.85;
        const armSwingZ = Math.cos(phase) * 0.45;

        keyframes.push({
          time: t,
          poses: {
            LowerTorso: {
              position: [Math.sin(phase) * 0.15, -0.05 + Math.abs(Math.sin(phase * 2)) * 0.08, 0],
              rotation: [0, 0, hipSway],
            },
            UpperTorso: {
              rotation: [0, 0, -hipSway * 0.6],
            },
            Head: {
              rotation: [0.05, 0, -hipSway * 0.3],
            },
            LeftUpperArm: {
              rotation: [0.2, armSwingX, -armSwingZ - 0.4],
            },
            LeftLowerArm: {
              rotation: [0.35, 0, -0.2],
            },
            RightUpperArm: {
              rotation: [0.2, armSwingX, armSwingZ + 0.4],
            },
            RightLowerArm: {
              rotation: [0.35, 0, 0.2],
            },
            LeftUpperLeg: {
              rotation: [0, 0, -hipSway * 0.5],
            },
            RightUpperLeg: {
              rotation: [0, 0, -hipSway * 0.5],
            },
          },
        });
      }

      return {
        name: "Victory_Floss_Farol",
        duration: 2.4,
        fps,
        loop: true,
        keyframes,
      };
    },
  },

  {
    id: "breakdance-flare",
    name: "Breakdance Power Move",
    category: "Acrobatic",
    description: "Movimento de chão com giros angulares, transição de peso e inversão dinâmica.",
    duration: 3.2,
    bpm: 110,
    generate: (fps = 30) => {
      const framesCount = Math.round(3.2 * fps);
      const keyframes: MocapKeyframe[] = [];

      for (let i = 0; i <= framesCount; i++) {
        const t = (i / framesCount) * 3.2;
        const spin = (t / 3.2) * Math.PI * 4; // 720 degrees
        const dip = Math.sin(spin * 2) * 0.4;

        keyframes.push({
          time: t,
          poses: {
            LowerTorso: {
              position: [Math.cos(spin) * 0.4, -0.8 + dip * 0.3, Math.sin(spin) * 0.4],
              rotation: [0.6 * Math.sin(spin), spin, 0.4 * Math.cos(spin)],
            },
            UpperTorso: {
              rotation: [0.3, 0, 0.2],
            },
            Head: {
              rotation: [-0.2, -Math.sin(spin) * 0.5, 0],
            },
            LeftUpperArm: {
              rotation: [-0.8 + Math.sin(spin) * 0.6, 0.4, -1.2],
            },
            LeftLowerArm: {
              rotation: [1.2, 0, 0],
            },
            RightUpperArm: {
              rotation: [1.1 + Math.cos(spin) * 0.5, -0.3, 0.9],
            },
            RightLowerArm: {
              rotation: [0.8, 0, 0],
            },
            LeftUpperLeg: {
              rotation: [-0.8 + Math.cos(spin) * 1.1, 0.3, -0.6],
            },
            LeftLowerLeg: {
              rotation: [0.7, 0, 0],
            },
            RightUpperLeg: {
              rotation: [0.9 + Math.sin(spin) * 1.1, -0.4, 0.8],
            },
            RightLowerLeg: {
              rotation: [0.4, 0, 0],
            },
          },
        });
      }

      return {
        name: "Breakdance_PowerMove_Farol",
        duration: 3.2,
        fps,
        loop: true,
        keyframes,
      };
    },
  },

  {
    id: "hiphop-wave",
    name: "Hip-Hop Wave & Glide",
    category: "Groove",
    description: "Onda corporal estilo pop-and-lock fluindo do braço direito pelo peito até o braço esquerdo.",
    duration: 2.8,
    bpm: 95,
    generate: (fps = 30) => {
      const framesCount = Math.round(2.8 * fps);
      const keyframes: MocapKeyframe[] = [];

      for (let i = 0; i <= framesCount; i++) {
        const t = (i / framesCount) * 2.8;
        const cycle = (t / 2.8) * Math.PI * 2;

        const waveLeft = Math.max(0, Math.sin(cycle));
        const waveChest = Math.max(0, Math.sin(cycle - 0.8));
        const waveRight = Math.max(0, Math.sin(cycle - 1.6));

        keyframes.push({
          time: t,
          poses: {
            LowerTorso: {
              position: [Math.sin(cycle) * 0.1, -0.05 + waveChest * 0.08, 0],
              rotation: [0.1, Math.sin(cycle) * 0.2, 0],
            },
            UpperTorso: {
              rotation: [-waveChest * 0.25, 0, Math.sin(cycle) * 0.15],
            },
            Head: {
              rotation: [waveChest * 0.2, 0, 0],
            },
            LeftUpperArm: {
              rotation: [0.1, 0, -0.4 - waveLeft * 1.1],
            },
            LeftLowerArm: {
              rotation: [0.2 + waveLeft * 1.4, 0, 0],
            },
            LeftHand: {
              rotation: [0, 0, waveLeft * 0.7],
            },
            RightUpperArm: {
              rotation: [0.1, 0, 0.4 + waveRight * 1.1],
            },
            RightLowerArm: {
              rotation: [0.2 + waveRight * 1.4, 0, 0],
            },
            RightHand: {
              rotation: [0, 0, -waveRight * 0.7],
            },
            LeftUpperLeg: {
              rotation: [-0.1, 0, 0.05],
            },
            RightUpperLeg: {
              rotation: [-0.1, 0, -0.05],
            },
          },
        });
      }

      return {
        name: "HipHop_WaveGlide_Farol",
        duration: 2.8,
        fps,
        loop: true,
        keyframes,
      };
    },
  },

  {
    id: "kpop-idol",
    name: "K-Pop Idol Point & Turn",
    category: "Dance",
    description: "Coreografia energética com sincronismo pontual de dedos, giros de ombros e pose de finalização.",
    duration: 3.0,
    bpm: 128,
    generate: (fps = 30) => {
      const framesCount = Math.round(3.0 * fps);
      const keyframes: MocapKeyframe[] = [];

      for (let i = 0; i <= framesCount; i++) {
        const t = (i / framesCount) * 3.0;
        const beat = (t * 128) / 60; // Beat counter
        const bounce = Math.abs(Math.sin(beat * Math.PI)) * 0.12;
        const shoulderTilt = Math.sin(beat * Math.PI) * 0.25;

        keyframes.push({
          time: t,
          poses: {
            LowerTorso: {
              position: [0, -bounce, 0],
              rotation: [0.05, Math.sin(beat * 0.5 * Math.PI) * 0.2, 0],
            },
            UpperTorso: {
              rotation: [0, 0, shoulderTilt],
            },
            Head: {
              rotation: [-0.08, -shoulderTilt * 0.4, 0],
            },
            LeftUpperArm: {
              rotation: [0.8 + Math.sin(beat * Math.PI) * 0.4, 0.2, -0.8],
            },
            LeftLowerArm: {
              rotation: [1.2, 0, 0],
            },
            RightUpperArm: {
              rotation: [-0.5 + Math.cos(beat * Math.PI) * 0.5, -0.3, 0.6],
            },
            RightLowerArm: {
              rotation: [0.9, 0, 0],
            },
            LeftUpperLeg: {
              rotation: [bounce * 1.5, 0, 0.05],
            },
            RightUpperLeg: {
              rotation: [-bounce * 0.8, 0, -0.05],
            },
          },
        });
      }

      return {
        name: "KPop_IdolDance_Farol",
        duration: 3.0,
        fps,
        loop: true,
        keyframes,
      };
    },
  },
];
