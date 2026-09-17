import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAccount } from "./account.js";
import { convertRobloxMeshToObj, repackZip } from "./meshConverter.js";
import { buildAccessoryRbxmx } from "./ugcAssembler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(rootDir, "..");
const candidates = [
  path.resolve(rootDir, "ugc_downloader.py"),
  path.resolve(__dirname, "ugc_downloader.py"),
  path.resolve(repoRoot, "ugc_downloader.py"),
];
const pythonScriptPath = candidates.find((p) => fs.existsSync(p)) || candidates[0];
const downloadsDir = path.resolve(rootDir, "public", "downloads");

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

export interface UgcRipResult {
  success: boolean;
  assetId: string;
  name: string;
  type: string;
  creator: string;
  thumbnailUrl: string;
  isClothing: boolean;
  meshId?: string;
  textureId?: string;
  notice?: string;
  zipUrl: string;
  textureUrl?: string;
  objUrl?: string;
  rbxmxUrl?: string;
  files: {
    name: string;
    url: string;
    type: "zip" | "texture" | "obj" | "mtl" | "mesh" | "rbxmx" | "other";
  }[];
  logs: string[];
}

export async function ripUgcAsset(params: {
  urlOrId: string;
  cookie?: string;
}): Promise<UgcRipResult> {
  const { urlOrId } = params;
  if (!urlOrId || !urlOrId.trim()) {
    throw new Error("Informe a URL ou o ID numérico do item do catálogo.");
  }

  // Resolve cookie: provided or fallback to stored account
  let cookie = params.cookie?.trim();
  if (!cookie) {
    try {
      const account = await loadAccount();
      if (account?.cookie) {
        cookie = account.cookie;
      }
    } catch {
      // ignore
    }
  }

  // Construct args for python ugc_downloader.py
  const args = [
    pythonScriptPath,
    urlOrId.trim(),
    "--output",
    downloadsDir,
    "--json",
  ];

  if (cookie) {
    args.push("--cookie", cookie);
  }

  const pyCmd = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");

  return new Promise((resolve, reject) => {
    let py: any;
    try {
      py = spawn(pyCmd, args, {
        cwd: path.dirname(pythonScriptPath),
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
    } catch (err: any) {
      return reject(new Error(`Falha ao iniciar processo Python: ${err.message}`));
    }

    py.on("error", (err: any) => {
      reject(new Error(`Interpretador Python (${pyCmd}) não pôde ser executado: ${err.message}`));
    });

    const logs: string[] = [];
    let stdoutBuffer = "";
    let stderrBuffer = "";

    py.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      stdoutBuffer += text;
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith("JSON_RESULT:")) {
          logs.push(line);
        }
      }
    });

    py.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      stderrBuffer += text;
      logs.push(`[stderr] ${text}`);
    });

    py.on("close", async (code) => {
      const jsonMatch = stdoutBuffer.match(/JSON_RESULT:(.+)$/m);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (!parsed.success) {
            return reject(new Error(parsed.error || "Falha ao baixar asset."));
          }

          const d = parsed.data;

          // Check if a 3D mesh was extracted but NO .obj was generated (e.g. DracoPy missing in Python)
          if (Array.isArray(d.files)) {
            const hasObj = d.files.some((f: string) => f.toLowerCase().endsWith(".obj"));
            const meshFile = d.files.find((f: string) => f.toLowerCase().endsWith(".mesh"));

            if (!hasObj && meshFile && fs.existsSync(meshFile)) {
              try {
                const meshBuf = fs.readFileSync(meshFile);
                const cleanName = (d.name || `Asset_${d.asset_id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
                const itemDir = path.dirname(meshFile);
                const objFileName = `${cleanName}.obj`;
                const objFilePath = path.join(itemDir, objFileName);

                const objContent = await convertRobloxMeshToObj(meshBuf, "material.mtl");
                if (objContent) {
                  fs.writeFileSync(objFilePath, objContent, "utf-8");
                  d.files.push(objFilePath);
                  logs.push(`[+] Modelo 3D convertido para .OBJ com sucesso via WASM/Draco (${objContent.length} chars)`);

                  // Ensure material.mtl includes map_d for Blender transparency
                  const mtlPath = path.join(itemDir, "material.mtl");
                  if (fs.existsSync(mtlPath)) {
                    let mtlContent = fs.readFileSync(mtlPath, "utf-8");
                    if (!mtlContent.includes("map_d") && mtlContent.includes("map_Kd")) {
                      mtlContent = mtlContent.replace(/map_Kd\s+(.+)/, "map_Kd $1\nmap_d $1");
                      fs.writeFileSync(mtlPath, mtlContent, "utf-8");
                    }
                  }

                  // Re-package zip to ensure the .obj file is inside!
                  if (d.zip_path && fs.existsSync(itemDir)) {
                    await repackZip(itemDir, d.zip_path);
                    logs.push(`[+] Pacote ZIP atualizado com o arquivo 3D .OBJ`);
                  }
                }
              } catch (convErr: any) {
                logs.push(`[!] Falha na conversão de mesh para OBJ: ${convErr?.message}`);
              }
            }
          }

          // Generate Studio-Ready .rbxmx accessory file for 3D items if applicable
          let rbxmxUrl: string | undefined;
          if (!d.is_clothing && Array.isArray(d.files) && d.files.length > 0) {
            try {
              const itemDir = path.dirname(d.files[0]);
              const cleanName = (d.name || `Asset_${d.asset_id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
              const rbxmxName = `${cleanName}.rbxmx`;
              const rbxmxPath = path.join(itemDir, rbxmxName);

              const rawType = String(d.type || "").toLowerCase();
              let accType: any = "Hat";
              if (rawType.includes("hair") || rawType.includes("cabelo")) accType = "Hair";
              else if (rawType.includes("face") || rawType.includes("rosto")) accType = "Face";
              else if (rawType.includes("neck") || rawType.includes("pescoço")) accType = "Neck";
              else if (rawType.includes("shoulder") || rawType.includes("ombro")) accType = "Shoulder";
              else if (rawType.includes("front") || rawType.includes("frontal")) accType = "Front";
              else if (rawType.includes("back") || rawType.includes("costas")) accType = "Back";
              else if (rawType.includes("waist") || rawType.includes("cintura")) accType = "Waist";

              const rbxmxContent = buildAccessoryRbxmx({
                name: d.name || `Asset_${d.asset_id}`,
                accessoryType: accType,
                meshId: d.mesh_id || d.asset_id,
                textureId: d.texture_id || d.asset_id,
                handle: { x: 2, y: 2, z: 2 },
                attachY: 0.5,
              });

              fs.writeFileSync(rbxmxPath, rbxmxContent, "utf-8");
              if (!d.files.includes(rbxmxPath)) {
                d.files.push(rbxmxPath);
              }
              if (d.zip_path && fs.existsSync(itemDir)) {
                await repackZip(itemDir, d.zip_path);
              }
              logs.push(`[+] Arquivo Studio-Ready (.RBXMX) gerado com sucesso para importação direta no Roblox Studio!`);
            } catch (rbxmxErr: any) {
              logs.push(`[!] Aviso ao gerar .rbxmx: ${rbxmxErr?.message}`);
            }
          }

          const zipFileName = path.basename(d.zip_path);
          const zipUrl = `/downloads/${encodeURIComponent(zipFileName)}`;

          const filesList: UgcRipResult["files"] = [];
          let textureUrl: string | undefined;
          let objUrl: string | undefined;

          if (Array.isArray(d.files)) {
            for (const f of d.files) {
              const rel = path.relative(downloadsDir, f).replace(/\\/g, "/");
              const fileUrl = `/downloads/${rel}`;
              const baseName = path.basename(f);
              const lower = baseName.toLowerCase();

              let fileType: UgcRipResult["files"][number]["type"] = "other";
              if (lower.endsWith(".zip")) fileType = "zip";
              else if (lower.endsWith(".png") || lower.endsWith(".jpg")) {
                fileType = "texture";
                if (!textureUrl || lower.includes("texture") || lower.includes("template")) {
                  textureUrl = fileUrl;
                }
              } else if (lower.endsWith(".obj")) {
                fileType = "obj";
                objUrl = fileUrl;
              } else if (lower.endsWith(".rbxmx") || lower.endsWith(".rbxm")) {
                fileType = "rbxmx";
                rbxmxUrl = fileUrl;
              } else if (lower.endsWith(".mtl")) {
                fileType = "mtl";
              } else if (lower.endsWith(".mesh")) {
                fileType = "mesh";
              }

              filesList.push({
                name: baseName,
                url: fileUrl,
                type: fileType,
              });
            }
          }

          resolve({
            success: true,
            assetId: d.asset_id,
            name: d.name,
            type: d.type,
            creator: d.creator,
            thumbnailUrl: d.thumbnail_url,
            isClothing: Boolean(d.is_clothing),
            meshId: d.mesh_id,
            textureId: d.texture_id,
            notice: d.notice,
            zipUrl,
            textureUrl,
            objUrl,
            rbxmxUrl,
            files: filesList,
            logs,
          });
          return;
        } catch (err) {
          return reject(
            new Error(`Erro ao interpretar resposta do downloader: ${err}`)
          );
        }
      }

      if (code !== 0) {
        return reject(
          new Error(
            `Processo falhou (código ${code}): ${stderrBuffer || stdoutBuffer || "Erro desconhecido"}`
          )
        );
      }

      reject(new Error("Nenhuma saída válida recebida do script."));
    });

    py.on("error", (err) => {
      reject(new Error(`Erro ao iniciar Python: ${err.message}`));
    });
  });
}
