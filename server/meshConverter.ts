import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
// @ts-ignore
import draco3d from "draco3d";

let cachedDecoderModule: any = null;

async function getDracoDecoder() {
  if (!cachedDecoderModule) {
    cachedDecoderModule = await draco3d.createDecoderModule({});
  }
  return cachedDecoderModule;
}

/**
 * Converts any Roblox binary/ASCII mesh file (version 1.00 to 7.00, CoreMesh, Draco)
 * into a standard Wavefront OBJ format string ready for Blender, Studio, and 3D viewers.
 */
export async function convertRobloxMeshToObj(
  meshBytes: Buffer,
  mtlName = "material.mtl"
): Promise<string | null> {
  if (!meshBytes || meshBytes.length < 12) return null;

  const headerStr = meshBytes.slice(0, 32).toString("utf-8");

  // 1. Version 1.00 / 1.01 (ASCII Format)
  if (headerStr.startsWith("version 1.00") || headerStr.startsWith("version 1.01")) {
    try {
      const text = meshBytes.toString("utf-8");
      const lines = text.trim().split(/\r?\n/);
      const brackets = text.match(/\[([^\]]+)\]/g) || [];
      const objLines = [`mtllib ${mtlName}`, "usemtl UGC_Texture", "s 1"];
      const totalVerts = Math.floor(brackets.length / 3);
      for (let i = 0; i < brackets.length; i += 3) {
        const pos = brackets[i].slice(1, -1).split(",").map(Number);
        const norm = brackets[i + 1].slice(1, -1).split(",").map(Number);
        const uv = brackets[i + 2].slice(1, -1).split(",").map(Number);
        objLines.push(`v ${pos[0].toFixed(6)} ${pos[1].toFixed(6)} ${pos[2].toFixed(6)}`);
        objLines.push(`vn ${norm[0].toFixed(6)} ${norm[1].toFixed(6)} ${norm[2].toFixed(6)}`);
        objLines.push(`vt ${uv[0].toFixed(6)} ${(1.0 - uv[1]).toFixed(6)}`);
      }
      for (let f = 0; f < totalVerts; f += 3) {
        objLines.push(
          `f ${f + 1}/${f + 1}/${f + 1} ${f + 2}/${f + 2}/${f + 2} ${f + 3}/${f + 3}/${f + 3}`
        );
      }
      return objLines.join("\n");
    } catch (err) {
      console.warn("[MeshConverter] Failed to parse ASCII mesh v1:", err);
    }
  }

  // 2. Version 6.00 / 7.00 / COREMESH / DRACO (Google Draco compressed bitstream)
  const dracoPos = meshBytes.indexOf("DRACO");
  if (dracoPos !== -1 || headerStr.startsWith("version 6.") || headerStr.startsWith("version 7.")) {
    const bitstreamOffset = dracoPos !== -1 ? dracoPos : meshBytes.indexOf("\n") + 1;
    if (bitstreamOffset > 0 && bitstreamOffset < meshBytes.length) {
      try {
        const decoderModule = await getDracoDecoder();
        const dracoData = meshBytes.slice(bitstreamOffset);

        const buffer = new decoderModule.DecoderBuffer();
        buffer.Init(new Int8Array(dracoData), dracoData.length);

        const decoder = new decoderModule.Decoder();
        const geometryType = decoder.GetEncodedGeometryType(buffer);

        if (geometryType === decoderModule.TRIANGULAR_MESH) {
          const mesh = new decoderModule.Mesh();
          const status = decoder.DecodeBufferToMesh(buffer, mesh);

          if (status.ok()) {
            const numPoints = mesh.num_points();
            const numFaces = mesh.num_faces();

            // Positions
            const posAttrId = decoder.GetAttributeId(mesh, decoderModule.POSITION);
            const posAttr = decoder.GetAttribute(mesh, posAttrId);
            const posData = new Float32Array(numPoints * 3);
            const posArray = new decoderModule.DracoFloat32Array();
            decoder.GetAttributeFloatForAllPoints(mesh, posAttr, posArray);
            for (let i = 0; i < numPoints * 3; i++) {
              posData[i] = posArray.GetValue(i);
            }

            // Normals
            const normAttrId = decoder.GetAttributeId(mesh, decoderModule.NORMAL);
            let normData: Float32Array | null = null;
            if (normAttrId !== -1) {
              const normAttr = decoder.GetAttribute(mesh, normAttrId);
              const normArray = new decoderModule.DracoFloat32Array();
              decoder.GetAttributeFloatForAllPoints(mesh, normAttr, normArray);
              normData = new Float32Array(numPoints * 3);
              for (let i = 0; i < numPoints * 3; i++) {
                normData[i] = normArray.GetValue(i);
              }
            }

            // Texture coords (UV)
            const texAttrId = decoder.GetAttributeId(mesh, decoderModule.TEX_COORD);
            let texData: Float32Array | null = null;
            if (texAttrId !== -1) {
              const texAttr = decoder.GetAttribute(mesh, texAttrId);
              const texArray = new decoderModule.DracoFloat32Array();
              decoder.GetAttributeFloatForAllPoints(mesh, texAttr, texArray);
              texData = new Float32Array(numPoints * 2);
              for (let i = 0; i < numPoints * 2; i++) {
                texData[i] = texArray.GetValue(i);
              }
            }

            // Assemble OBJ
            const objLines = [`mtllib ${mtlName}`, "usemtl UGC_Texture", "s 1"];

            for (let i = 0; i < numPoints; i++) {
              const x = posData[i * 3].toFixed(6);
              const y = posData[i * 3 + 1].toFixed(6);
              const z = posData[i * 3 + 2].toFixed(6);
              objLines.push(`v ${x} ${y} ${z}`);
            }

            if (normData) {
              for (let i = 0; i < numPoints; i++) {
                const nx = normData[i * 3].toFixed(6);
                const ny = normData[i * 3 + 1].toFixed(6);
                const nz = normData[i * 3 + 2].toFixed(6);
                objLines.push(`vn ${nx} ${ny} ${nz}`);
              }
            }

            if (texData) {
              for (let i = 0; i < numPoints; i++) {
                const u = texData[i * 2].toFixed(6);
                const v = (1.0 - texData[i * 2 + 1]).toFixed(6);
                objLines.push(`vt ${u} ${v}`);
              }
            }

            const faceArray = new decoderModule.DracoInt32Array();
            for (let i = 0; i < numFaces; i++) {
              decoder.GetFaceFromMesh(mesh, i, faceArray);
              const i1 = faceArray.GetValue(0) + 1;
              const i2 = faceArray.GetValue(1) + 1;
              const i3 = faceArray.GetValue(2) + 1;
              if (normData && texData) {
                objLines.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
              } else if (texData) {
                objLines.push(`f ${i1}/${i1} ${i2}/${i2} ${i3}/${i3}`);
              } else {
                objLines.push(`f ${i1} ${i2} ${i3}`);
              }
            }

            return objLines.join("\n");
          }
        }
      } catch (dracoErr) {
        console.warn("[MeshConverter] Draco decoding failed, trying binary fallback:", dracoErr);
      }
    }
  }

  // 3. Version 2.00, 3.00, 4.00, 4.01, 5.00 (Binary Mesh Format)
  try {
    const newlinePos = meshBytes.indexOf(0x0a);
    if (newlinePos !== -1) {
      const pos = newlinePos + 1;
      let headerSize: number;
      let numVerts: number;
      let numFaces: number;
      let stride = 40;
      let faceStride = 12;

      if (headerStr.startsWith("version 2.") || headerStr.startsWith("version 3.")) {
        headerSize = meshBytes.readUInt16LE(pos);
        const vSize = meshBytes.readUInt8(pos + 2);
        const fSize = meshBytes.readUInt8(pos + 3);
        numVerts = meshBytes.readUInt32LE(pos + 8);
        numFaces = meshBytes.readUInt32LE(pos + 12);
        stride = vSize > 0 ? vSize : 40;
        faceStride = fSize > 0 ? fSize : 12;
      } else if (headerStr.startsWith("version 4.") || headerStr.startsWith("version 5.")) {
        headerSize = meshBytes.readUInt16LE(pos);
        numVerts = meshBytes.readUInt32LE(pos + 4);
        numFaces = meshBytes.readUInt32LE(pos + 8);
      } else {
        return null;
      }

      const headerEnd = pos + headerSize;
      const objLines = [`mtllib ${mtlName}`, "usemtl UGC_Texture", "s 1"];

      const vLines: string[] = [];
      const vnLines: string[] = [];
      const vtLines: string[] = [];
      let vPos = headerEnd;

      for (let i = 0; i < numVerts; i++) {
        if (vPos + 32 > meshBytes.length) break;
        const px = meshBytes.readFloatLE(vPos);
        const py = meshBytes.readFloatLE(vPos + 4);
        const pz = meshBytes.readFloatLE(vPos + 8);
        const nx = meshBytes.readFloatLE(vPos + 12);
        const ny = meshBytes.readFloatLE(vPos + 16);
        const nz = meshBytes.readFloatLE(vPos + 20);
        const u = meshBytes.readFloatLE(vPos + 24);
        const v = meshBytes.readFloatLE(vPos + 28);
        vLines.push(`v ${px.toFixed(6)} ${py.toFixed(6)} ${pz.toFixed(6)}`);
        vnLines.push(`vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`);
        vtLines.push(`vt ${u.toFixed(6)} ${(1.0 - v).toFixed(6)}`);
        vPos += stride;
      }

      const fLines: string[] = [];
      let fPos = headerEnd + numVerts * stride;
      for (let i = 0; i < numFaces; i++) {
        if (fPos + 12 > meshBytes.length) break;
        const i1 = meshBytes.readUInt32LE(fPos) + 1;
        const i2 = meshBytes.readUInt32LE(fPos + 4) + 1;
        const i3 = meshBytes.readUInt32LE(fPos + 8) + 1;
        fLines.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
        fPos += faceStride;
      }

      return objLines.concat(vLines, vnLines, vtLines, fLines).join("\n");
    }
  } catch (binErr) {
    console.warn("[MeshConverter] Binary mesh decoding failed:", binErr);
  }

  return null;
}

/**
 * Re-packages a download folder into a clean ZIP file containing all extracted files
 */
export async function repackZip(itemDir: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    const files = fs.readdirSync(itemDir);
    for (const file of files) {
      const fullPath = path.join(itemDir, file);
      if (fs.statSync(fullPath).isFile()) {
        archive.file(fullPath, { name: file });
      }
    }

    archive.finalize();
  });
}
