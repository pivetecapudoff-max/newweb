import * as THREE from "three";

export async function renderUgcMeshPreview(
  geometry: {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
  },
  textureDataUrl: string
): Promise<string> {
  if (typeof window === "undefined" || !document) return textureDataUrl;

  const width = 320;
  const height = 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.55, 4.2);
  camera.lookAt(0, 0.55, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.15, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.4 })
  );
  head.position.set(0, 0.2, 0);
  scene.add(head);

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.8, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.5 })
  );
  torso.position.set(0, -1.15, 0);
  scene.add(torso);

  const texture = await new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      textureDataUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        resolve(tex);
      },
      undefined,
      () => resolve(new THREE.Texture())
    );
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(geometry.positions, 3));
  if (geometry.normals.length) {
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(geometry.normals, 3));
  }
  if (geometry.uvs.length) {
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(geometry.uvs, 2));
  }
  if (geometry.indices.length) geo.setIndex(geometry.indices);
  geo.computeVertexNormals();

  const item = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.05 })
  );
  item.position.set(0, 0.55, 0);
  scene.add(item);

  renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL("image/png");
  renderer.dispose();
  geo.dispose();
  texture.dispose();
  return dataUrl;
}
