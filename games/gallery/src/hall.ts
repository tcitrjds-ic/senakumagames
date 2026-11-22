import * as THREE from 'three';
import type { Tex } from './textures';

/**
 * せなくま美術館の展示ホールを組み立てる（間取りも内装もこの美術館だけのオリジナル）。
 *
 * つくり:
 *  - 寄木の床の長いホール。玄関から奥へローズ色の敷物がのびる
 *  - まんなかに丸いラグと「金のポテトの像」
 *  - 左右に、両面に絵を掛けられる つい立ての壁
 *  - 壁ぎわに細い柱がならぶ
 *  - いちばん奥は 3段あがった展示ステージ（特別展示の壁）
 *  - 白い腰板とミント色の壁紙、天井には天窓、玄関の上にクマの紋章の丸窓
 *
 * 座標系: 玄関が +Z（手前）、奥の壁が -Z。X は玄関から見て左が −。Y が上。単位はメートル相当。
 */
export const ROOM = {
  halfW: 13,
  zFront: 15,
  zBack: -15,
  ceil: 9,
  wainscot: 1.4, // 腰板の高さ
  stage: 0.9, // 展示ステージの高さ
  stageZ: -8, // ステージの手前の縁（これより奥がステージ）
  stepsZ: -6.2, // 段のいちばん下（これより手前は床）
};

export interface Slot {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  maxW: number;
  maxH: number;
}

export interface Blocker {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export interface Hall {
  slots: Slot[];
  blockers: Blocker[];
  /** (x, z) の床の高さ。fromY（いまの足元の高さ）は将来 2階を足すときのために受け取るだけで、いまは使わない */
  heightAt: (x: number, z: number, fromY?: number) => number;
}

/** これ以上の段差は登れない（壁扱い） */
export const STEP_UP = 0.65;

/** まんなかの像（台座の中心と半径）。住人の通り道を決めるのにも使う */
export const STATUE = { x: 0, z: 3.5, r: 1.15 };
/** つい立ての壁（左右対称。中心の |x|、Z の範囲、厚み、高さ） */
export const PARTITION = { x: 6.2, z0: -3.4, z1: 3.4, thick: 0.36, height: 3.3 };

const WHITE = 0xfffaf0;
const WHITE_SHADE = 0xe9dfcc;
const GOLD = 0xe2b44e;
const PARTITION_COLOR = 0xf7e9e4;

function planeMat(map: THREE.Texture, opts: Partial<THREE.MeshLambertMaterialParameters> = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map, ...opts });
}

/** テクスチャを繰り返し数だけ変えた複製にする */
function tiled(src: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const t = src.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}

export function buildHall(scene: THREE.Scene, tex: Tex): Hall {
  const R = ROOM;
  const W = R.halfW * 2;
  const D = R.zFront - R.zBack;
  const midZ = (R.zFront + R.zBack) / 2;
  const blockers: Blocker[] = [];
  const white = new THREE.MeshLambertMaterial({ color: WHITE });
  const whiteShade = new THREE.MeshLambertMaterial({ color: WHITE_SHADE });
  const gold = new THREE.MeshPhongMaterial({ color: GOLD, specular: 0xfff2c0, shininess: 80 });
  const carpetMat = planeMat(tex.carpet);

  const add = (m: THREE.Object3D) => scene.add(m);
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    add(m);
    return m;
  };
  /** 床に寝かせた板（敷物・ラグ・床） */
  const flat = (w: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    add(m);
    return m;
  };

  // ---- 床（寄木）----
  flat(W, D, planeMat(tiled(tex.floor, W / 4, D / 4)), 0, 0, midZ);

  // ---- 天井（格天井）と天窓 ----
  {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), planeMat(tiled(tex.ceiling, W / 2, D / 2)));
    c.rotation.x = Math.PI / 2;
    c.position.set(0, R.ceil, midZ);
    add(c);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 13.5), new THREE.MeshBasicMaterial({ map: tex.skylight }));
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, R.ceil - 0.02, 2.5);
    add(sky);
    const light = new THREE.PointLight(0xffffff, 0.9, 22, 1.6);
    light.position.set(0, R.ceil - 1, 2.5);
    add(light);
  }

  // ---- 壁（腰板 + 壁紙）と縁どり ----
  const wall = (len: number, cx: number, cz: number, rotY: number) => {
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(len, R.wainscot), planeMat(tiled(tex.wallLower, len / 2.8, 1)));
    lm.position.set(cx, R.wainscot / 2, cz);
    lm.rotation.y = rotY;
    add(lm);
    const uh = R.ceil - R.wainscot;
    const um = new THREE.Mesh(new THREE.PlaneGeometry(len, uh), planeMat(tiled(tex.wallUpper, len / 4, uh / 4)));
    um.position.set(cx, R.wainscot + uh / 2, cz);
    um.rotation.y = rotY;
    add(um);
    // 腰板の上の見切り縁と、天井ぎわの廻り縁
    const along = Math.abs(Math.sin(rotY)) > 0.5; // 側壁なら奥行き方向
    const nx = along ? Math.sin(rotY) * 0.08 : 0;
    const nz = along ? 0 : Math.cos(rotY) * 0.08;
    for (const [y, h] of [[R.wainscot + 0.06, 0.12], [R.ceil - 0.15, 0.3]] as const) {
      const g = new THREE.BoxGeometry(along ? 0.2 : len, h, along ? len : 0.2);
      const m = new THREE.Mesh(g, white);
      m.position.set(cx + nx, y, cz + nz);
      add(m);
    }
  };
  wall(W, 0, R.zBack, 0); // 奥
  wall(W, 0, R.zFront, Math.PI); // 玄関側
  wall(D, -R.halfW, midZ, Math.PI / 2); // 左
  wall(D, R.halfW, midZ, -Math.PI / 2); // 右

  // ---- 奥の展示ステージ（3段）----
  {
    const depth = R.stageZ - R.zBack;
    const cz = (R.stageZ + R.zBack) / 2;
    box(W, R.stage, depth, whiteShade, 0, R.stage / 2, cz);
    flat(W, depth, planeMat(tiled(tex.floor, W / 4, depth / 4)), 0, R.stage + 0.002, cz);
    const steps = 3;
    const stepD = (R.stepsZ - R.stageZ) / steps;
    const stepH = R.stage / steps;
    for (let i = 0; i < steps; i++) {
      const top = stepH * (i + 1);
      // i=0 がいちばん下（手前）の段。奥の段ほど高い
      box(W, top, stepD, i % 2 ? whiteShade : white, 0, top / 2, R.stepsZ - stepD * (i + 0.5));
    }
  }

  // ---- 敷物（玄関 → ラグの手前、ラグの奥 → ステージの奥の壁）とラグ ----
  {
    const RUN_W = 3.2;
    const rugR = 4.2;
    const strip = (z0: number, z1: number, y: number) => {
      const len = Math.abs(z1 - z0);
      flat(RUN_W, len, planeMat(tiled(tex.carpet, RUN_W / 1.6, len / 1.6)), 0, y, (z0 + z1) / 2);
      for (const s of [-1, 1]) box(0.09, 0.012, len, gold, s * (RUN_W / 2), y + 0.004, (z0 + z1) / 2);
    };
    strip(R.zFront - 0.4, STATUE.z + rugR - 0.2, 0.012);
    strip(STATUE.z - rugR + 0.2, R.stepsZ, 0.012);
    strip(R.stageZ, R.zBack + 0.3, R.stage + 0.012);
    // 段の上にも敷物をのせる
    const steps = 3;
    const stepD = (R.stepsZ - R.stageZ) / steps;
    const stepH = R.stage / steps;
    for (let i = 0; i < steps; i++) {
      const top = stepH * (i + 1);
      box(RUN_W, 0.02, stepD + 0.02, carpetMat, 0, top + 0.01, R.stepsZ - stepD * (i + 0.5));
    }
    flat(rugR * 2, rugR * 2, planeMat(tex.rug, { transparent: true, alphaTest: 0.3 }), STATUE.x, 0.02, STATUE.z);
  }

  // ---- まんなかの像: 金のポテト ----
  {
    const { x, z, r } = STATUE;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.5, 28), white);
    base.position.set(x, 0.25, z);
    add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, 0.3, 28), whiteShade);
    cap.position.set(x, 0.65, z);
    add(cap);
    // 箱（上が広い台形）と、そこから立つポテト
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.44, 1.05, 4, 1), gold);
    cup.rotation.y = Math.PI / 4;
    cup.scale.set(1, 1, 0.62);
    cup.position.set(x, 0.8 + 0.525, z);
    add(cup);
    const sticks: [number, number, number][] = [[-0.3, 0.74, -0.06], [-0.1, 1.0, 0.07], [0.1, 0.9, -0.08], [0.3, 0.78, 0.06], [0, 0.62, 0.0]];
    for (const [dx, h, dz] of sticks) {
      const m = box(0.15, h, 0.15, gold, x + dx, 0.8 + 1.0 + h / 2, z + dz);
      m.rotation.z = -dx * 0.5;
    }
    blockers.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: -1, maxY: 3.2 });
    const spot = new THREE.PointLight(0xfff0c8, 0.8, 9, 2);
    spot.position.set(x, 4.2, z + 1.5);
    add(spot);
  }

  // ---- つい立ての壁（左右）----
  {
    const P = PARTITION;
    const len = P.z1 - P.z0;
    const mat = new THREE.MeshLambertMaterial({ color: PARTITION_COLOR });
    for (const s of [-1, 1]) {
      const x = s * P.x;
      box(P.thick, P.height, len, mat, x, P.height / 2, (P.z0 + P.z1) / 2);
      box(P.thick + 0.12, 0.14, len + 0.12, white, x, P.height + 0.07, (P.z0 + P.z1) / 2); // 笠木
      box(P.thick + 0.1, 0.22, len + 0.1, whiteShade, x, 0.11, (P.z0 + P.z1) / 2); // 巾木
      blockers.push({ minX: x - P.thick / 2, maxX: x + P.thick / 2, minZ: P.z0, maxZ: P.z1, minY: -1, maxY: P.height });
    }
  }

  // ---- 柱（壁ぎわにならぶ細い円柱）----
  const pillar = (x: number, z: number, y0: number) => {
    const r = 0.3;
    const h = R.ceil - y0;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 20), white);
    m.position.set(x, y0 + h / 2, z);
    add(m);
    box(r * 2.8, 0.26, r * 2.8, whiteShade, x, y0 + 0.13, z);
    box(r * 2.6, 0.2, r * 2.6, whiteShade, x, R.ceil - 0.4, z);
    blockers.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: -1, maxY: R.ceil });
  };
  for (const s of [-1, 1]) {
    for (const z of [11.5, 6, 0.5, -5]) pillar(s * 10.4, z, 0);
    pillar(s * 10.4, -11.5, R.stage);
  }

  // ---- 植木ばち（四隅）----
  {
    const pot = new THREE.MeshLambertMaterial({ color: 0xd9a37c });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x7fb878 });
    for (const [x, z, y0] of [[-11.9, 13.9, 0], [11.9, 13.9, 0], [-11.9, -13.9, R.stage], [11.9, -13.9, R.stage]] as const) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.6, 16), pot);
      p.position.set(x, y0 + 0.3, z);
      add(p);
      for (const [dy, rr] of [[1.0, 0.62], [1.55, 0.5], [2.0, 0.34]] as const) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 10), leaf);
        b.position.set(x, y0 + dy, z);
        add(b);
      }
      blockers.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, minY: -1, maxY: y0 + 2.4 });
    }
  }

  // ---- 扉 ----
  const door = (map: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), planeMat(map, { transparent: true, alphaTest: 0.5 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    add(m);
  };
  const E = 0.03; // 壁からの浮かせ量
  door(tex.door, 3.3, 4.4, 0, 2.2, R.zFront - E, Math.PI); // 玄関（両開き・ガラス入り）
  door(tex.doorSide, 1.5, 3.0, -R.halfW + E, 1.5, 12.2, Math.PI / 2); // 通用口（左）
  door(tex.doorSide, 1.5, 3.0, R.halfW - E, 1.5, 12.2, -Math.PI / 2); // 通用口（右）

  // ---- 窓（左右の壁の高い位置）と、玄関の上のクマの丸窓 ----
  const win = (x: number, y: number, z: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0), new THREE.MeshBasicMaterial({ map: tex.window, transparent: true, alphaTest: 0.5 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    add(m);
  };
  for (const s of [-1, 1]) {
    for (const z of [8.8, 3.2, -2.3]) win(s * (R.halfW - E), 6.4, z, s < 0 ? Math.PI / 2 : -Math.PI / 2);
    const light = new THREE.PointLight(0xdcefff, 0.55, 14, 2);
    light.position.set(s * (R.halfW - 1), 6.4, 3.2);
    add(light);
  }
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshBasicMaterial({ map: tex.emblem, transparent: true, alphaTest: 0.3 }));
    g.position.set(0, 6.7, R.zFront - E);
    g.rotation.y = Math.PI;
    add(g);
    const glow = new THREE.PointLight(0xffe6dc, 0.9, 12, 2);
    glow.position.set(0, 6.4, R.zFront - 1.5);
    add(glow);
  }

  // ---- 額を掛ける場所（優先順）----
  const slots: Slot[] = [];
  const slot = (x: number, y: number, z: number, nx: number, nz: number, maxW: number, maxH: number) => {
    slots.push({ pos: new THREE.Vector3(x, y, z), normal: new THREE.Vector3(nx, 0, nz), maxW, maxH });
  };
  const bz = R.zBack + 0.08;
  const fz = R.zFront - 0.08;
  const lx = -R.halfW + 0.08;
  const rx = R.halfW - 0.08;
  const P = PARTITION;
  const pIn = P.x - P.thick / 2 - 0.02; // つい立ての内側（ホール中央を向く面）
  const pOut = P.x + P.thick / 2 + 0.02; // つい立ての外側（壁を向く面）
  // 1. 奥のステージの壁（玄関から正面に見える特別展示）
  for (const x of [-3.9, 3.9, -9.2, 9.2]) slot(x, R.stage + 3.3, bz, 0, 1, 3.4, 2.4);
  // 2. つい立ての内側
  slot(-pIn, 1.95, 0, 1, 0, 3.0, 2.0);
  slot(pIn, 1.95, 0, -1, 0, 3.0, 2.0);
  // 3. 左右の壁（腰板の見切り縁より上）
  for (const z of [8.8, 3.2]) {
    slot(lx, 3.1, z, 1, 0, 2.8, 2.0);
    slot(rx, 3.1, z, -1, 0, 2.8, 2.0);
  }
  // 4. つい立ての外側
  slot(-pOut, 1.95, 0, -1, 0, 3.0, 2.0);
  slot(pOut, 1.95, 0, 1, 0, 3.0, 2.0);
  // 5. 玄関側の壁
  slot(-6.6, 3.1, fz, 0, -1, 2.8, 2.0);
  slot(6.6, 3.1, fz, 0, -1, 2.8, 2.0);
  // 6. 左右の壁の奥より
  slot(lx, 3.1, -2.3, 1, 0, 2.8, 2.0);
  slot(rx, 3.1, -2.3, -1, 0, 2.8, 2.0);

  // ---- 床の高さ ----
  const heightAt = (_x: number, z: number): number => {
    if (z <= R.stageZ) return R.stage;
    if (z < R.stepsZ) return (R.stage * (R.stepsZ - z)) / (R.stepsZ - R.stageZ);
    return 0;
  };

  return { slots, blockers, heightAt };
}
