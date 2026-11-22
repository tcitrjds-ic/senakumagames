import * as THREE from 'three';

export interface Tex {
  floor: THREE.Texture;
  rug: THREE.Texture;
  wallLower: THREE.Texture;
  wallUpper: THREE.Texture;
  ceiling: THREE.Texture;
  skylight: THREE.Texture;
  door: THREE.Texture;
  doorSide: THREE.Texture;
  window: THREE.Texture;
  carpet: THREE.Texture;
  emblem: THREE.Texture;
  charSenakuma: THREE.Texture;
  charPotato: THREE.Texture;
  charCurator: THREE.Texture;
  charRabbit: THREE.Texture;
  charChick: THREE.Texture;
}

const FILES: Record<keyof Tex, string> = {
  floor: 'tex_floor.jpg',
  rug: 'tex_rug.png',
  wallLower: 'tex_wall_lower.jpg',
  wallUpper: 'tex_wall_upper.jpg',
  ceiling: 'tex_ceiling.jpg',
  skylight: 'tex_skylight.png',
  door: 'tex_door.png',
  doorSide: 'tex_door_side.png',
  window: 'tex_window.png',
  carpet: 'tex_carpet.jpg',
  emblem: 'glass_emblem.png',
  charSenakuma: 'char_senakuma.png',
  charPotato: 'char_potato.png',
  charCurator: 'char_curator.png',
  charRabbit: 'char_rabbit.png',
  charChick: 'char_chick.png',
};
const TILED: (keyof Tex)[] = ['floor', 'wallLower', 'wallUpper', 'ceiling', 'carpet'];
const PIXEL: (keyof Tex)[] = ['charSenakuma', 'charPotato', 'charCurator', 'charRabbit', 'charChick'];

export function loadTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

export async function loadTextures(manager: THREE.LoadingManager, anisotropy: number): Promise<Tex> {
  const loader = new THREE.TextureLoader(manager);
  const out: Partial<Tex> = {};
  await Promise.all(
    (Object.keys(FILES) as (keyof Tex)[]).map(async (k) => {
      const t = await loadTexture(loader, `assets/${FILES[k]}`);
      t.anisotropy = anisotropy;
      if (TILED.includes(k)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (PIXEL.includes(k)) {
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
      }
      out[k] = t;
    }),
  );
  return out as Tex;
}
