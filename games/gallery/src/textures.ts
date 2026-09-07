import * as THREE from 'three';

export interface Tex {
  floor: THREE.Texture;
  sun: THREE.Texture;
  wallLower: THREE.Texture;
  wallUpper: THREE.Texture;
  ceiling: THREE.Texture;
  door: THREE.Texture;
  doorStar: THREE.Texture;
  doorBig: THREE.Texture;
  window: THREE.Texture;
  carpet: THREE.Texture;
  glass: THREE.Texture;
  playerIdle: THREE.Texture;
  playerWalk: THREE.Texture;
}

const FILES: Record<keyof Tex, string> = {
  floor: 'tex_floor.png',
  sun: 'tex_sun.png',
  wallLower: 'tex_wall_lower.png',
  wallUpper: 'tex_wall_upper.png',
  ceiling: 'tex_ceiling.png',
  door: 'tex_door.png',
  doorStar: 'tex_door_star.png',
  doorBig: 'tex_door_big.png',
  window: 'tex_window.png',
  carpet: 'tex_carpet.png',
  glass: 'glass_peach.png',
  playerIdle: 'senakuma_idle.png',
  playerWalk: 'senakuma_walk.png',
};
const TILED: (keyof Tex)[] = ['floor', 'wallLower', 'wallUpper', 'ceiling', 'carpet'];
const PIXEL: (keyof Tex)[] = ['playerIdle', 'playerWalk'];

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
        t.minFilter = THREE.NearestMipmapLinearFilter;
      }
      out[k] = t;
    }),
  );
  return out as Tex;
}
