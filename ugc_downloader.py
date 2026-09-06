#!/usr/bin/env python3
"""
    illusions.lol — Roblox UGC 3D Model & Texture Downloader
    Baixa automaticamente o modelo 3D (.OBJ) e a Textura (.PNG) de qualquer item UGC do catálogo.
    Suporta meshes v1 a v7 (incluindo compressão DRACO do Roblox), roupas 2D clássicas e cookies.
"""

import sys
import os
import re
import gzip
import json
import struct
import zipfile
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

try:
    import DracoPy
except ImportError:
    DracoPy = None

DEFAULT_HEADERS = {
    "User-Agent": "Roblox/WinInet"
}

ASSET_TYPES = {
    1: "Imagem",
    2: "Camiseta Clássica (2D)",
    3: "Áudio",
    4: "Mesh",
    8: "Chapéu / Hat (3D)",
    11: "Camisa Clássica / Shirt (2D)",
    12: "Calça Clássica / Pants (2D)",
    13: "Adesivo / Decal",
    18: "Rosto / Face",
    19: "Equipamento / Gear (3D)",
    24: "Animação",
    41: "Cabelo / Hair (3D)",
    42: "Acessório de Rosto (3D)",
    43: "Acessório de Pescoço (3D)",
    44: "Acessório de Ombro (3D)",
    45: "Acessório Frontal (3D)",
    46: "Acessório de Costas (3D)",
    47: "Acessório de Cintura (3D)",
    65: "Camiseta 3D (Layered)",
    66: "Camisa 3D (Layered)",
    67: "Calça 3D (Layered)",
    68: "Jaqueta 3D (Layered)",
    69: "Suéter 3D (Layered)",
    70: "Shorts 3D (Layered)",
    71: "Sapato Esquerdo 3D (Layered)",
    72: "Sapato Direito 3D (Layered)",
    73: "Vestido / Saia 3D (Layered)",
}

def extract_asset_id(input_str: str) -> str:
    """Extrai o ID numérico a partir de uma URL do catálogo ou string pura."""
    input_str = input_str.strip()
    match = re.search(r"/catalog/(\d+)", input_str)
    if match:
        return match.group(1)
    match = re.search(r"(\d{6,})", input_str)
    if match:
        return match.group(1)
    raise ValueError(f"Não foi possível identificar o Asset ID em: '{input_str}'. Certifique-se de colar o link do catálogo ou ID numérico.")

def fetch_bytes(url: str, cookie: str = None) -> bytes:
    """Faz requisição HTTP e descompacta GZIP se necessário."""
    headers = dict(DEFAULT_HEADERS)
    if cookie:
        headers["Cookie"] = f".ROBLOSECURITY={cookie}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    try:
        data = gzip.decompress(data)
    except Exception:
        pass
    return data

def get_item_info(asset_id: str) -> dict:
    """Busca informações oficiais do item via API do Roblox."""
    url = f"https://economy.roblox.com/v2/assets/{asset_id}/details"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            type_id = data.get("AssetTypeId", 0)
            return {
                "id": asset_id,
                "name": data.get("Name", f"Asset_{asset_id}"),
                "description": data.get("Description", ""),
                "asset_type_id": type_id,
                "asset_type_name": ASSET_TYPES.get(type_id, f"Tipo {type_id}"),
                "creator": data.get("Creator", {}).get("Name", "Roblox"),
                "is_clothing": type_id in (2, 11, 12),
                "is_3d": type_id in (8, 41, 42, 43, 44, 45, 46, 47, 65, 66, 67, 68, 69, 70, 71, 72, 73, 19)
            }
    except Exception:
        pass
    return {
        "id": asset_id,
        "name": f"Asset_{asset_id}",
        "description": "",
        "asset_type_id": 0,
        "asset_type_name": "Desconhecido",
        "creator": "Desconhecido",
        "is_clothing": False,
        "is_3d": True
    }

def get_thumbnail_url(asset_id: str) -> str:
    """Obtém a URL oficial do preview em alta resolução (420x420 PNG)."""
    url = f"https://thumbnails.roblox.com/v1/assets?assetIds={asset_id}&format=png&size=420x420"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req) as r:
            d = json.loads(r.read().decode("utf-8"))
            if d.get("data") and len(d["data"]) > 0:
                return d["data"][0].get("imageUrl")
    except Exception:
        pass
    return None

def convert_mesh_to_obj(data: bytes, mtl_name: str = "material.mtl") -> str:
    """Converte arquivo binário/ASCII de Roblox Mesh (v1 a v7) para padrão Wavefront OBJ."""
    if data.startswith(b"version 1.00") or data.startswith(b"version 1.01"):
        text = data.decode("utf-8", errors="ignore")
        lines = text.strip().splitlines()
        brackets = re.findall(r"\[([^\]]+)\]", "\n".join(lines[2:]))
        obj_lines = [
            f"mtllib {mtl_name}",
            "usemtl UGC_Texture",
            "s 1"
        ]
        total_verts = len(brackets) // 3
        for i in range(0, len(brackets), 3):
            pos = [float(x) for x in brackets[i].split(",")]
            norm = [float(x) for x in brackets[i+1].split(",")]
            uv = [float(x) for x in brackets[i+2].split(",")]
            obj_lines.append(f"v {pos[0]:.6f} {pos[1]:.6f} {pos[2]:.6f}")
            obj_lines.append(f"vn {norm[0]:.6f} {norm[1]:.6f} {norm[2]:.6f}")
            obj_lines.append(f"vt {uv[0]:.6f} {1.0 - uv[1]:.6f}")
        for f in range(0, total_verts, 3):
            obj_lines.append(f"f {f+1}/{f+1}/{f+1} {f+2}/{f+2}/{f+2} {f+3}/{f+3}/{f+3}")
        return "\n".join(obj_lines)

    elif data.startswith(b"version 2.") or data.startswith(b"version 3."):
        pos = data.find(b"\n") + 1
        h_size, v_size, f_size = struct.unpack("<HBB", data[pos:pos+4])
        num_verts = struct.unpack("<I", data[pos+8:pos+12])[0]
        num_faces = struct.unpack("<I", data[pos+12:pos+16])[0]
        header_end = pos + h_size
        stride = v_size if v_size > 0 else 40
        face_stride = f_size if f_size > 0 else 12

        v_lines, vn_lines, vt_lines, f_lines = [], [], [], []
        v_pos = header_end
        for _ in range(num_verts):
            px, py, pz, nx, ny, nz, u, v = struct.unpack("<ffffffff", data[v_pos:v_pos+32])
            v_lines.append(f"v {px:.6f} {py:.6f} {pz:.6f}")
            vn_lines.append(f"vn {nx:.6f} {ny:.6f} {nz:.6f}")
            vt_lines.append(f"vt {u:.6f} {1.0 - v:.6f}")
            v_pos += stride

        f_pos = header_end + (num_verts * stride)
        for _ in range(num_faces):
            i1, i2, i3 = struct.unpack("<III", data[f_pos:f_pos+12])
            f_lines.append(f"f {i1+1}/{i1+1}/{i1+1} {i2+1}/{i2+1}/{i2+1} {i3+1}/{i3+1}/{i3+1}")
            f_pos += face_stride

        header = [f"mtllib {mtl_name}", "usemtl UGC_Texture", "s 1"]
        return "\n".join(header) + "\n" + "\n".join(v_lines) + "\n" + "\n".join(vn_lines) + "\n" + "\n".join(vt_lines) + "\n" + "\n".join(f_lines)

    elif data.startswith(b"version 4.") or data.startswith(b"version 5."):
        pos = data.find(b"\n") + 1
        h_size = struct.unpack("<H", data[pos:pos+2])[0]
        num_verts = struct.unpack("<I", data[pos+4:pos+8])[0]
        num_faces = struct.unpack("<I", data[pos+8:pos+12])[0]
        header_end = pos + h_size
        stride = 40
        face_stride = 12

        v_lines, vn_lines, vt_lines, f_lines = [], [], [], []
        v_pos = header_end
        for _ in range(num_verts):
            px, py, pz, nx, ny, nz, u, v = struct.unpack("<ffffffff", data[v_pos:v_pos+32])
            v_lines.append(f"v {px:.6f} {py:.6f} {pz:.6f}")
            vn_lines.append(f"vn {nx:.6f} {ny:.6f} {nz:.6f}")
            vt_lines.append(f"vt {u:.6f} {1.0 - v:.6f}")
            v_pos += stride

        f_pos = header_end + (num_verts * stride)
        for _ in range(num_faces):
            i1, i2, i3 = struct.unpack("<III", data[f_pos:f_pos+12])
            f_lines.append(f"f {i1+1}/{i1+1}/{i1+1} {i2+1}/{i2+1}/{i2+1} {i3+1}/{i3+1}/{i3+1}")
            f_pos += face_stride

        header = [f"mtllib {mtl_name}", "usemtl UGC_Texture", "s 1"]
        return "\n".join(header) + "\n" + "\n".join(v_lines) + "\n" + "\n".join(vn_lines) + "\n" + "\n".join(vt_lines) + "\n" + "\n".join(f_lines)

    elif data.startswith(b"version 6.") or data.startswith(b"version 7.") or b"DRACO" in data:
        draco_pos = data.find(b"DRACO")
        if draco_pos != -1:
            try:
                import DracoPy
            except ImportError:
                try:
                    import subprocess, sys
                    print("[*] Dependência DracoPy ausente. Instalando automaticamente...")
                    subprocess.run([sys.executable, "-m", "pip", "install", "DracoPy", "--quiet"], timeout=30)
                    import DracoPy
                except Exception as pip_err:
                    print(f"[!] Não foi possível instalar DracoPy via pip: {pip_err}")

            try:
                import DracoPy
                mesh = DracoPy.decode(data[draco_pos:])
                obj_lines = [f"mtllib {mtl_name}", "usemtl UGC_Texture", "s 1"]
                for pt in mesh.points:
                    obj_lines.append(f"v {pt[0]:.6f} {pt[1]:.6f} {pt[2]:.6f}")

                has_uv = mesh.tex_coord is not None and len(mesh.tex_coord) > 0
                if has_uv:
                    for uv in mesh.tex_coord:
                        obj_lines.append(f"vt {uv[0]:.6f} {1.0 - uv[1]:.6f}")

                has_normals = mesh.normals is not None and len(mesh.normals) > 0
                if has_normals:
                    for norm in mesh.normals:
                        obj_lines.append(f"vn {norm[0]:.6f} {norm[1]:.6f} {norm[2]:.6f}")

                for f in mesh.faces:
                    i1, i2, i3 = f[0] + 1, f[1] + 1, f[2] + 1
                    if has_normals and has_uv:
                        obj_lines.append(f"f {i1}/{i1}/{i1} {i2}/{i2}/{i2} {i3}/{i3}/{i3}")
                    elif has_uv:
                        obj_lines.append(f"f {i1}/{i1} {i2}/{i2} {i3}/{i3}")
                    else:
                        obj_lines.append(f"f {i1} {i2} {i3}")

                return "\n".join(obj_lines)
            except Exception as e:
                print(f"Erro ao decodificar Draco Mesh: {e}")

    return None

def download_ugc_item(asset_id_or_url: str, output_dir: str = "downloads", cookie: str = None) -> dict:
    """Função principal: extrai o asset, identifica a malha 3D e textura, e salva tudo pronto."""
    asset_id = extract_asset_id(asset_id_or_url)
    info = get_item_info(asset_id)
    clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', info.get("name", f"Asset_{asset_id}"))
    thumbnail_url = get_thumbnail_url(asset_id)

    print(f"[*] Processando: {info.get('name')} | Tipo: {info.get('asset_type_name')} (ID: {asset_id})")

    # Garante caminho absoluto do diretório de downloads
    abs_output_dir = os.path.abspath(output_dir)
    item_dir = os.path.join(abs_output_dir, f"{clean_name}_{asset_id}")
    os.makedirs(item_dir, exist_ok=True)

    result = {
        "asset_id": asset_id,
        "name": info.get("name"),
        "type": info.get("asset_type_name"),
        "creator": info.get("creator"),
        "thumbnail_url": thumbnail_url,
        "is_clothing": info.get("is_clothing", False),
        "files": [],
        "notice": ""
    }

    # =========================================================
    # CASO 1: ROUPA 2D CLÁSSICA (CAMISAS / CALÇAS)
    # =========================================================
    if info.get("is_clothing"):
        pkg_data = None
        if cookie:
            try:
                pkg_url = f"https://assetdelivery.roblox.com/v1/asset/?id={asset_id}"
                pkg_data = fetch_bytes(pkg_url, cookie=cookie)
            except Exception:
                pass

        template_downloaded = False
        if pkg_data and (b"<roblox" in pkg_data or b"Shirt" in pkg_data or b"Pants" in pkg_data):
            for m in re.findall(r"<url>(.*?)</url>", pkg_data.decode("utf-8", errors="ignore")):
                match_id = re.search(r"(\d+)", m)
                if match_id and match_id.group(1) != asset_id:
                    try:
                        template_bytes = fetch_bytes(f"https://assetdelivery.roblox.com/v1/asset/?id={match_id.group(1)}", cookie=cookie)
                        if template_bytes.startswith(b"\x89PNG") or template_bytes.startswith(b"\xff\xd8\xff"):
                            tpl_path = os.path.join(item_dir, "template.png")
                            with open(tpl_path, "wb") as f:
                                f.write(template_bytes)
                            result["files"].append(tpl_path)
                            template_downloaded = True
                            print("[+] Molde/Template 2D original baixado com sucesso!")
                            break
                    except Exception:
                        pass

        # Se não baixou o template via cookie, baixa o preview oficial PNG do Roblox
        if not template_downloaded:
            if thumbnail_url:
                try:
                    req_img = urllib.request.Request(thumbnail_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req_img) as r:
                        thumb_bytes = r.read()
                    prev_path = os.path.join(item_dir, "preview.png")
                    with open(prev_path, "wb") as f:
                        f.write(thumb_bytes)
                    result["files"].append(prev_path)
                except Exception:
                    pass

            readme_path = os.path.join(item_dir, "LEIA-ME.txt")
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(f"Item: {info.get('name')}\n")
                f.write(f"ID: {asset_id}\n")
                f.write(f"Criador: {info.get('creator')}\n")
                f.write(f"Tipo: {info.get('asset_type_name')}\n\n")
                f.write("Aviso: Roupas 2D clássicas (Camisas/Calças) não possuem malha 3D (.OBJ).\n")
                f.write("O Roblox exige login (.ROBLOSECURITY) para fornecer o molde original das roupas.\n")
                f.write("O preview oficial em alta resolução (.PNG) foi empacotado neste ZIP!\n")
            result["files"].append(readme_path)
            result["notice"] = (
                f"Item 2D Clássico detectado ({info.get('asset_type_name')}). Roupas 2D não têm modelo 3D (.OBJ). "
                f"O preview PNG oficial foi salvo no ZIP! (Para baixar o molde completo de camisas, forneça seu cookie .ROBLOSECURITY nas Opções Avançadas)."
            )

    # =========================================================
    # CASO 2: ACESSÓRIO UGC 3D (CHAPÉUS, CABELOS, COSTAS, ETC.)
    # =========================================================
    else:
        pkg_url = f"https://assetdelivery.roblox.com/v1/asset/?id={asset_id}"
        try:
            pkg_data = fetch_bytes(pkg_url, cookie=cookie)
        except urllib.error.HTTPError as e:
            if e.code == 401:
                raise ValueError(
                    f"Roblox retornou Erro 401 (Acesso Restrito): O Roblox exige autenticação para baixar este asset específico. "
                    f"Cole seu cookie .ROBLOSECURITY nas Opções Avançadas para liberar o acesso a itens privados."
                )
            raise e

        # Localiza IDs de Mesh e Textura no pacote
        found_ids = set()
        for m in re.findall(rb"rbxassetid://(\d+)", pkg_data):
            found_ids.add(m.decode())
        for m in re.findall(rb"id=(\d+)", pkg_data):
            found_ids.add(m.decode())

        if pkg_data.startswith(b"<roblox"):
            text = pkg_data.decode("utf-8", errors="ignore")
            for m in re.findall(r"<url>(.*?)</url>", text):
                match_id = re.search(r"(\d+)", m)
                if match_id:
                    found_ids.add(match_id.group(1))

        found_ids.discard(asset_id)
        print(f"[*] IDs de sub-assets encontrados: {list(found_ids)}")

        mesh_data, texture_data = None, None
        mesh_id, texture_id = None, None

        for sub_id in found_ids:
            try:
                sub_bytes = fetch_bytes(f"https://assetdelivery.roblox.com/v1/asset/?id={sub_id}", cookie=cookie)
                if sub_bytes.startswith(b"version ") or b"COREMESH" in sub_bytes or b"DRACO" in sub_bytes:
                    mesh_data = sub_bytes
                    mesh_id = sub_id
                    print(f"   -> [Mesh 3D detectada] ID: {sub_id} (Tamanho: {len(sub_bytes)} bytes)")
                elif sub_bytes.startswith(b"\x89PNG") or sub_bytes.startswith(b"\xff\xd8\xff"):
                    texture_data = sub_bytes
                    texture_id = sub_id
                    print(f"   -> [Textura detectada] ID: {sub_id} (Tamanho: {len(sub_bytes)} bytes)")
            except Exception as e:
                print(f"   -> Aviso: Não foi possível carregar sub-asset {sub_id}: {e}")

        # Se não encontrou textura no pacote mas temos thumbnail, usa o thumbnail como fallback de textura
        if not texture_data and thumbnail_url:
            try:
                req_img = urllib.request.Request(thumbnail_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req_img) as r:
                    texture_data = r.read()
                print("   -> [Textura Fallback] Utilizando thumbnail oficial.")
            except Exception:
                pass

        result["mesh_id"] = mesh_id
        result["texture_id"] = texture_id

        # Salva textura
        tex_filename = "texture.png"
        if texture_data:
            tex_path = os.path.join(item_dir, tex_filename)
            with open(tex_path, "wb") as f:
                f.write(texture_data)
            result["files"].append(tex_path)

        # Gera MTL (Material para Blender)
        mtl_filename = "material.mtl"
        mtl_content = f"""newmtl UGC_Texture
Ka 1.000 1.000 1.000
Kd 1.000 1.000 1.000
Ks 0.000 0.000 0.000
d 1.0
illum 1
map_Kd {tex_filename}
"""
        mtl_path = os.path.join(item_dir, mtl_filename)
        with open(mtl_path, "w") as f:
            f.write(mtl_content)
        result["files"].append(mtl_path)

        # Converte e salva OBJ
        if mesh_data:
            raw_mesh_path = os.path.join(item_dir, "model.mesh")
            with open(raw_mesh_path, "wb") as f:
                f.write(mesh_data)
            result["files"].append(raw_mesh_path)

            obj_content = convert_mesh_to_obj(mesh_data, mtl_filename)
            if obj_content:
                obj_path = os.path.join(item_dir, f"{clean_name}.obj")
                with open(obj_path, "w", encoding="utf-8") as f:
                    f.write(obj_content)
                result["files"].append(obj_path)
                print(f"[+] Modelo 3D convertido para .OBJ com sucesso! ({len(obj_content)} caracteres)")

    # Gera pacote ZIP completo
    zip_path = os.path.join(abs_output_dir, f"{clean_name}_{asset_id}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in result["files"]:
            zf.write(file, os.path.basename(file))
    result["zip_path"] = zip_path
    print(f"[+] Pacote ZIP completo salvo em: {zip_path}\n")

    return result

# =========================================================
# SERVIDOR WEB EMBUTIDO (INTERFACE MODERNA)
# =========================================================
HTML_PAGE = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>illusions.lol — Roblox UGC 3D & Texture Ripper</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }
        body {
            background: #090d16;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            background-image: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15), transparent 50%);
        }
        .container {
            width: 100%;
            max-width: 580px;
        }
        .card {
            background: #111827;
            border: 1px solid #1f293d;
            border-radius: 20px;
            padding: 36px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.05);
            text-align: center;
            position: relative;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.3);
            color: #818cf8;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 5px 14px;
            border-radius: 999px;
            margin-bottom: 16px;
            letter-spacing: 1px;
        }
        h1 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #fff 40%, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p.subtitle {
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .quick-examples {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            margin-bottom: 20px;
        }
        .pill-btn {
            background: #1e293b;
            color: #cbd5e1;
            border: 1px solid #334155;
            padding: 6px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .pill-btn:hover {
            background: #334155;
            color: #fff;
            border-color: #6366f1;
            transform: translateY(-1px);
        }
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
        }
        input.main-input {
            flex: 1;
            padding: 14px 18px;
            border-radius: 12px;
            border: 1px solid #334155;
            background: #0b0f19;
            color: #fff;
            font-size: 15px;
            outline: none;
            transition: 0.2s;
        }
        input.main-input:focus {
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
        }
        button.btn-primary {
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            color: #fff;
            font-weight: 700;
            border: none;
            padding: 14px 24px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 15px;
            transition: 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }
        button.btn-primary:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }
        button.btn-primary:disabled {
            background: #334155;
            box-shadow: none;
            cursor: not-allowed;
            transform: none;
        }
        .advanced-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
            margin-bottom: 16px;
            transition: color 0.2s;
        }
        .advanced-toggle:hover {
            color: #94a3b8;
        }
        .advanced-box {
            display: none;
            background: #0b0f19;
            border: 1px solid #1f293d;
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            margin-bottom: 20px;
        }
        .advanced-box.active {
            display: block;
        }
        .advanced-box label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 6px;
        }
        .advanced-box input {
            width: 100%;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px solid #334155;
            background: #111827;
            color: #fff;
            font-size: 13px;
            outline: none;
        }
        .advanced-box p {
            font-size: 11px;
            color: #64748b;
            margin-top: 6px;
            line-height: 1.4;
        }
        .status-box {
            margin-top: 10px;
            font-size: 14px;
            min-height: 24px;
            word-break: break-word;
        }
        .result-card {
            display: none;
            background: #182234;
            border: 1px solid #233554;
            border-radius: 16px;
            padding: 20px;
            margin-top: 20px;
            text-align: left;
            animation: fadeIn 0.3s ease;
        }
        .result-card.active {
            display: block;
        }
        .result-header {
            display: flex;
            gap: 16px;
            align-items: center;
            margin-bottom: 16px;
        }
        .result-thumb {
            width: 80px;
            height: 80px;
            border-radius: 12px;
            background: #0b0f19;
            border: 1px solid #334155;
            object-fit: cover;
        }
        .result-meta {
            flex: 1;
        }
        .result-meta h3 {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 4px;
            color: #fff;
        }
        .result-meta p {
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 6px;
        }
        .type-tag {
            display: inline-block;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
        }
        .btn-download-zip {
            display: block;
            width: 100%;
            background: #10b981;
            color: #fff;
            text-decoration: none;
            text-align: center;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            transition: 0.2s;
            cursor: pointer;
        }
        .btn-download-zip:hover {
            background: #059669;
        }
        .notice-banner {
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 12px;
            line-height: 1.4;
            margin-top: 12px;
            margin-bottom: 14px;
        }
        .features {
            margin-top: 28px;
            border-top: 1px solid #1f293d;
            padding-top: 20px;
            text-align: left;
        }
        .feature-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 8px;
        }
        .feature-item span.icon {
            color: #10b981;
            font-weight: bold;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="badge">⚡ Roblox 3D Ripper</div>
            <h1>UGC Catalog Downloader</h1>
            <p class="subtitle">Insira o link ou ID de qualquer item UGC do Roblox para extrair o modelo 3D (.OBJ) com a textura (.PNG) pronta para o Blender.</p>

            <!-- Botões de Teste Rápido -->
            <div class="quick-examples">
                <button class="pill-btn" onclick="setExample('122105362767114')">👱 Blonde Hair (UGC 3D)</button>
                <button class="pill-btn" onclick="setExample('4849184439')">🦋 Butterfly Hat (3D)</button>
                <button class="pill-btn" onclick="setExample('6275932619')">🧝 Elf Ears (3D)</button>
                <button class="pill-btn" onclick="setExample('18112476810')">🎟️ Pass (3D)</button>
                <button class="pill-btn" onclick="setExample('12210536')">🥋 Dark Robes (2D)</button>
            </div>

            <!-- Input Principal -->
            <div class="input-group">
                <input type="text" class="main-input" id="urlInput" placeholder="Ex: https://www.roblox.com/catalog/122105362767114/..." autofocus>
                <button class="btn-primary" id="btnDownload" onclick="startDownload()">
                    <span id="btnText">Baixar 3D</span>
                </button>
            </div>

            <!-- Opções Avançadas (Cookie) -->
            <div class="advanced-toggle" onclick="toggleAdvanced()">
                <span>⚙️ Opções Avançadas (.ROBLOSECURITY Cookie)</span>
                <span id="advArrow">▼</span>
            </div>
            <div class="advanced-box" id="advBox">
                <label for="cookieInput">Cookie .ROBLOSECURITY (Opcional):</label>
                <input type="password" id="cookieInput" placeholder="_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow...">
                <p>Necessário para baixar itens com permissão restrita ou roupas 2D. Acessórios UGC 3D públicos não exigem cookie.</p>
            </div>

            <!-- Mensagem de Status -->
            <div class="status-box" id="statusMsg"></div>

            <!-- Card de Resultado -->
            <div class="result-card" id="resultCard">
                <div class="result-header">
                    <img src="" alt="Thumbnail" class="result-thumb" id="resultThumb">
                    <div class="result-meta">
                        <h3 id="resultName">Item</h3>
                        <p id="resultCreator">Criador: Roblox</p>
                        <span class="type-tag" id="resultType">Acessório 3D</span>
                    </div>
                </div>
                <div id="noticeContainer"></div>
                <button class="btn-download-zip" id="btnZipDownload" onclick="triggerDownload()">⬇️ Baixar Pacote (.ZIP)</button>
            </div>

            <!-- Funcionalidades -->
            <div class="features">
                <div class="feature-item"><span class="icon">✔</span> Suporte a malhas Roblox Mesh v1 até v7 (incluindo compressão DRACO)</div>
                <div class="feature-item"><span class="icon">✔</span> Conversão automática para .OBJ com coordenadas UV alinhadas para Blender</div>
                <div class="feature-item"><span class="icon">✔</span> Textura (.PNG) original em alta resolução e material .MTL</div>
                <div class="feature-item"><span class="icon">✔</span> Download direto sem bloqueios ou falhas de cabeçalho</div>
            </div>
        </div>
    </div>

    <script>
        let currentZipFile = "";

        const savedCookie = localStorage.getItem("roblox_cookie") || "";
        if (savedCookie) {
            document.getElementById("cookieInput").value = savedCookie;
        }

        document.getElementById("cookieInput").addEventListener("input", (e) => {
            localStorage.setItem("roblox_cookie", e.target.value.trim());
        });

        function toggleAdvanced() {
            const box = document.getElementById("advBox");
            const arrow = document.getElementById("advArrow");
            box.classList.toggle("active");
            arrow.textContent = box.classList.contains("active") ? "▲" : "▼";
        }

        function setExample(id) {
            document.getElementById("urlInput").value = id;
            startDownload();
        }

        function triggerDownload() {
            if (!currentZipFile) return;
            const link = document.createElement("a");
            link.href = `/api/get-zip?file=${encodeURIComponent(currentZipFile)}`;
            link.setAttribute("download", currentZipFile);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        async function startDownload() {
            const input = document.getElementById("urlInput").value.trim();
            const cookie = document.getElementById("cookieInput").value.trim();
            const btn = document.getElementById("btnDownload");
            const btnText = document.getElementById("btnText");
            const status = document.getElementById("statusMsg");
            const resultCard = document.getElementById("resultCard");

            if (!input) {
                status.style.color = "#f43f5e";
                status.textContent = "Por favor, insira o link ou ID do item!";
                return;
            }

            btn.disabled = true;
            btnText.textContent = "Processando...";
            status.style.color = "#38bdf8";
            status.textContent = "Extraindo modelo e texturas do Roblox...";
            resultCard.classList.remove("active");

            try {
                let apiUrl = `/api/download?url=${encodeURIComponent(input)}`;
                if (cookie) {
                    apiUrl += `&cookie=${encodeURIComponent(cookie)}`;
                }

                const response = await fetch(apiUrl);
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || "Erro ao processar item");
                }

                status.style.color = "#10b981";
                status.textContent = `Pronto! "${data.name}" processado com sucesso.`;

                document.getElementById("resultName").textContent = data.name;
                document.getElementById("resultCreator").textContent = `Criador: ${data.creator}`;
                document.getElementById("resultType").textContent = data.type;
                if (data.thumbnail_url) {
                    document.getElementById("resultThumb").src = data.thumbnail_url;
                }

                const noticeContainer = document.getElementById("noticeContainer");
                noticeContainer.innerHTML = "";
                if (data.notice) {
                    const noticeEl = document.createElement("div");
                    noticeEl.className = "notice-banner";
                    noticeEl.textContent = data.notice;
                    noticeContainer.appendChild(noticeEl);
                }

                currentZipFile = data.zip_file;
                const zipBtn = document.getElementById("btnZipDownload");
                zipBtn.textContent = `⬇️ Baixar ${data.zip_file}`;

                resultCard.classList.add("active");

                // Dispara o download com link nativo
                triggerDownload();

            } catch (e) {
                status.style.color = "#f43f5e";
                status.textContent = "Erro: " + e.message;
            } finally {
                btn.disabled = false;
                btnText.textContent = "Baixar 3D";
            }
        }
    </script>
</body>
</html>
"""

class WebHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
            return

        elif parsed.path == "/api/download":
            qs = parse_qs(parsed.query)
            target_url = qs.get("url", [None])[0]
            cookie = qs.get("cookie", [None])[0]

            if not target_url:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Parâmetro 'url' ausente"}).encode("utf-8"))
                return
            try:
                out = download_ugc_item(target_url, output_dir="downloads", cookie=cookie)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "name": out["name"],
                    "asset_id": out["asset_id"],
                    "type": out["type"],
                    "creator": out["creator"],
                    "thumbnail_url": out["thumbnail_url"],
                    "is_clothing": out["is_clothing"],
                    "notice": out.get("notice", ""),
                    "zip_file": os.path.basename(out["zip_path"])
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8"))
            return

        elif parsed.path == "/api/get-zip":
            qs = parse_qs(parsed.query)
            filename = qs.get("file", [None])[0]
            if not filename or ".." in filename:
                self.send_response(400)
                self.end_headers()
                return

            filepath = os.path.join(os.path.abspath("downloads"), filename)
            if os.path.exists(filepath):
                file_size = os.path.getsize(filepath)
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(file_size))
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                self.send_header("Connection", "close")
                self.end_headers()
                with open(filepath, "rb") as f:
                    while True:
                        chunk = f.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            else:
                self.send_response(404)
                self.end_headers()
            return

        self.send_response(404)
        self.end_headers()

def run_server(port: int = 5000):
    server = HTTPServer(("0.0.0.0", port), WebHandler)
    print(f"==================================================")
    print(f"  illusions.lol — Roblox UGC Downloader Web Server")
    print(f"  Acesse no navegador: http://localhost:{port}")
    print(f"==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Servidor encerrado.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg in ("--help", "-h"):
            print("Uso CLI: python ugc_downloader.py <URL_ou_ID> [--cookie <cookie>]")
            print("Ou inicie o site com: python ugc_downloader.py --server")
        elif arg in ("--server", "-s"):
            port = 5000
            if len(sys.argv) > 2 and sys.argv[2].isdigit():
                port = int(sys.argv[2])
            run_server(port)
        else:
            cookie = None
            output_dir = "downloads"
            as_json = False
            if "--cookie" in sys.argv:
                idx = sys.argv.index("--cookie")
                if idx + 1 < len(sys.argv):
                    cookie = sys.argv[idx + 1]
            if "--output" in sys.argv:
                idx = sys.argv.index("--output")
                if idx + 1 < len(sys.argv):
                    output_dir = sys.argv[idx + 1]
            if "--json" in sys.argv:
                as_json = True
            try:
                res = download_ugc_item(arg, output_dir=output_dir, cookie=cookie)
                if as_json:
                    print("\nJSON_RESULT:" + json.dumps({"success": True, "data": res}, ensure_ascii=False))
            except Exception as e:
                if as_json:
                    print("\nJSON_RESULT:" + json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
                else:
                    raise e
    else:
        print("Uso CLI: python ugc_downloader.py <URL_ou_ID_do_Catalogo>")
        print("Ou inicie o site com: python ugc_downloader.py --server")
