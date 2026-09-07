import * as THREE from 'three';
import type { Tex } from './textures';

/**
 * マリオ64のピーチ城 1階ホール（エントランスホール）を組み立てる。
 *
 * 参照した特徴:
 *  - 白黒チェックの床、中央に「橙と紫の光線」の太陽モザイク
 *  - 正面に赤い絨毯の大階段 → 中2階の踊り場に「大きな星の扉」
 *  - 壁の下部は石、上部は「青空・雲・緑の丘」の壁画
 *  - 入口側の左右に小さな階段付きの張り出し（左: ボム兵の戦場の部屋の扉 / 右: 水族館の扉）
 *  - 左右の壁に星の扉（左: 3★ さむいさむいマウンテン / 右: 1★ バッタンキングのとりで）
 *  - 階段左右の半柱の脇に地下への扉、中2階の右奥にピーチのかくれスライダーの扉
 *  - 入口の上にはピーチ姫のステンドグラス（ホール内側からも見える）
 *
 * 座標系: 入口が +Z（南）、奥の壁が -Z。X は入口から見て左が −。Y が上。単位はメートル相当。
 */
export const ROOM = {
  halfW: 14,
  zFront: 16,
  zBack: -14,
  ceil: 12,
  lower: 3.2, // 腰壁の高さ
  mez: 3.6, // 中2階の床の高さ
  balconyZ: -9, // 中2階の手前の縁
  stairBottomZ: -2,
  stairHalfW: 3,
  alcoveX: 9.5, // 張り出しの内側の縁（|x| がこれ以上）
  alcoveZ: 9.5, // 張り出しの奥の縁（z がこれ以上）
  alcoveH: 1.2,
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

export interface Castle {
  slots: Slot[];
  blockers: Blocker[];
  heightAt: (x: number, z: number) => number;
}

const CREAM = 0xf3e9d2;
const CREAM_DARK = 0xd9c9a6;
const GOLD = 0xd9a93a;

function planeMat(map: THREE.Texture, opts: Partial<THREE.MeshLambertMaterialParameters> = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map, ...opts });
}

export function buildCastle(scene: THREE.Scene, tex: Tex): Castle {
  const R = ROOM;
  const W = R.halfW * 2;
  const D = R.zFront - R.zBack;
  const blockers: Blocker[] = [];
  const cream = new THREE.MeshLambertMaterial({ color: CREAM });
  const creamDark = new THREE.MeshLambertMaterial({ color: CREAM_DARK });
  const gold = new THREE.MeshPhongMaterial({ color: GOLD, specular: 0xfff0b0, shininess: 70 });
  const carpetMat = planeMat(tex.carpet);

  const add = (m: THREE.Object3D) => scene.add(m);
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    add(m);
    return m;
  };

  // ---- 床（白黒チェック）と太陽のモザイク ----
  {
    const t = tex.floor.clone();
    t.needsUpdate = true;
    t.repeat.set(W / 2, D / 2); // 1枚のテクスチャ = 2m×2m（タイル1m角）
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), planeMat(t));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (R.zFront + R.zBack) / 2);
    add(floor);
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), planeMat(tex.sun, { transparent: true, alphaTest: 0.2 }));
    sun.rotation.x = -Math.PI / 2;
    sun.position.set(0, 0.015, 5.5);
    add(sun);
  }

  // ---- 天井 ----
  {
    const t = tex.ceiling.clone();
    t.needsUpdate = true;
    t.repeat.set(W / 4, D / 4);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), planeMat(t));
    c.rotation.x = Math.PI / 2;
    c.position.set(0, R.ceil, (R.zFront + R.zBack) / 2);
    add(c);
  }

  // ---- 壁（腰壁: 石 / 上部: 空と雲と丘の壁画）----
  const wall = (len: number, cx: number, cz: number, rotY: number) => {
    const lower = tex.wallLower.clone();
    lower.needsUpdate = true;
    lower.repeat.set(len / 4, R.lower / 2);
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(len, R.lower), planeMat(lower));
    lm.position.set(cx, R.lower / 2, cz);
    lm.rotation.y = rotY;
    add(lm);
    const upper = tex.wallUpper.clone();
    upper.needsUpdate = true;
    const uh = R.ceil - R.lower;
    upper.repeat.set(len / 24, uh / 9);
    const um = new THREE.Mesh(new THREE.PlaneGeometry(len, uh), planeMat(upper));
    um.position.set(cx, R.lower + uh / 2, cz);
    um.rotation.y = rotY;
    add(um);
    // 腰壁の上の見切り縁と、天井際の廻り縁
    const along = Math.abs(Math.sin(rotY)) > 0.5; // 側壁なら奥行き方向
    const g = new THREE.BoxGeometry(along ? 0.28 : len, 0.26, along ? len : 0.28);
    const cornice = new THREE.Mesh(g, cream);
    cornice.position.set(cx + (along ? Math.sin(rotY) * 0.1 : 0), R.lower + 0.13, cz + (along ? 0 : Math.cos(rotY) * 0.1));
    add(cornice);
    const crown = new THREE.Mesh(g.clone(), cream);
    crown.position.set(cx + (along ? Math.sin(rotY) * 0.1 : 0), R.ceil - 0.13, cz + (along ? 0 : Math.cos(rotY) * 0.1));
    add(crown);
  };
  wall(W, 0, R.zBack, 0); // 奥
  wall(W, 0, R.zFront, Math.PI); // 入口側
  wall(D, -R.halfW, (R.zFront + R.zBack) / 2, Math.PI / 2); // 左
  wall(D, R.halfW, (R.zFront + R.zBack) / 2, -Math.PI / 2); // 右

  // ---- 中2階（踊り場・バルコニー）----
  {
    const depth = R.balconyZ - R.zBack;
    const cz = (R.balconyZ + R.zBack) / 2;
    box(W, 0.3, depth, creamDark, 0, R.mez - 0.15, cz);
    const t = tex.floor.clone();
    t.needsUpdate = true;
    t.repeat.set(W / 2, depth / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), planeMat(t));
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, R.mez + 0.001, cz);
    add(top);
    // 星の扉までの赤い絨毯
    const c = tex.carpet.clone();
    c.needsUpdate = true;
    c.repeat.set(4, 5);
    const run = new THREE.Mesh(new THREE.PlaneGeometry(4, depth - 0.2), planeMat(c));
    run.rotation.x = -Math.PI / 2;
    run.position.set(0, R.mez + 0.01, cz - 0.1);
    add(run);
    box(0.1, 0.012, depth - 0.2, gold, -2, R.mez + 0.012, cz - 0.1);
    box(0.1, 0.012, depth - 0.2, gold, 2, R.mez + 0.012, cz - 0.1);
    // 手すり（階段の開口部を除く）
    for (const s of [-1, 1]) {
      const x0 = R.stairHalfW + 0.6;
      const x1 = R.halfW - 0.3;
      for (let x = x0; x <= x1; x += 1) box(0.12, 0.95, 0.12, cream, s * x, R.mez + 0.475, R.balconyZ - 0.12);
      box(x1 - x0 + 0.3, 0.12, 0.18, cream, (s * (x0 + x1)) / 2, R.mez + 0.98, R.balconyZ - 0.12);
      blockers.push({ minX: Math.min(s * x0, s * x1) - 0.2, maxX: Math.max(s * x0, s * x1) + 0.2, minZ: R.balconyZ - 0.4, maxZ: R.balconyZ + 0.1, minY: R.mez - 0.6, maxY: R.mez + 2 });
    }
  }

  // ---- 大階段（赤い絨毯）----
  {
    const steps = 12;
    const run = R.stairBottomZ - R.balconyZ; // 7
    const stepD = run / steps;
    const stepH = R.mez / steps;
    for (let i = 0; i < steps; i++) {
      const top = stepH * (i + 1);
      const cz = R.stairBottomZ - stepD * (i + 0.5);
      box(R.stairHalfW * 2, top, stepD, creamDark, 0, top / 2, cz);
      box(4, top + 0.012, stepD + 0.012, carpetMat, 0, top / 2 + 0.006, cz + 0.006);
    }
    // 段ごとの金の縁取り（絨毯の端）と、段々に高くなる石の手すり壁
    for (let i = 0; i < steps; i++) {
      const top = stepH * (i + 1);
      const cz = R.stairBottomZ - stepD * (i + 0.5);
      box(0.08, 0.02, stepD + 0.012, gold, -2, top + 0.02, cz + 0.006);
      box(0.08, 0.02, stepD + 0.012, gold, 2, top + 0.02, cz + 0.006);
      for (const s of [-1, 1]) {
        box(0.5, top + 0.9, stepD + 0.002, cream, s * (R.stairHalfW + 0.25), (top + 0.9) / 2, cz);
        box(0.6, 0.1, stepD + 0.002, creamDark, s * (R.stairHalfW + 0.25), top + 0.95, cz);
      }
    }
    for (const s of [-1, 1]) {
      // 親柱（下と上）
      box(0.7, 1.4, 0.7, cream, s * (R.stairHalfW + 0.25), 0.7, R.stairBottomZ + 0.35);
      box(0.76, 0.14, 0.76, creamDark, s * (R.stairHalfW + 0.25), 1.45, R.stairBottomZ + 0.35);
      box(0.7, 1.4, 0.7, cream, s * (R.stairHalfW + 0.25), R.mez + 0.7, R.balconyZ - 0.35);
      box(0.76, 0.14, 0.76, creamDark, s * (R.stairHalfW + 0.25), R.mez + 1.45, R.balconyZ - 0.35);
      blockers.push({ minX: Math.min(s * R.stairHalfW, s * (R.stairHalfW + 0.5)), maxX: Math.max(s * R.stairHalfW, s * (R.stairHalfW + 0.5)), minZ: R.balconyZ - 0.7, maxZ: R.stairBottomZ + 0.7, minY: -1, maxY: R.mez + 2 });
    }
  }

  // ---- 柱（中2階を支える柱と、階段脇の高い柱）----
  const pillar = (x: number, z: number, y0: number, y1: number, r = 0.42) => {
    const h = y1 - y0;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 18), cream);
    m.position.set(x, y0 + h / 2, z);
    add(m);
    box(r * 2.6, 0.22, r * 2.6, creamDark, x, y0 + 0.11, z);
    box(r * 2.6, 0.22, r * 2.6, creamDark, x, y1 - 0.11, z);
    box(r * 2.2, 0.12, r * 2.2, cream, x, y1 - 0.3, z);
    blockers.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: y0 - 1, maxY: y1 - 0.3 });
  };
  for (const s of [-1, 1]) {
    pillar(s * 3.9, R.balconyZ - 0.55, 0, R.mez);
    pillar(s * 9.6, R.balconyZ - 0.55, 0, R.mez);
    pillar(s * 3.9, R.balconyZ - 0.55, R.mez, R.ceil, 0.36);
    // 奥の壁の半柱（地下への扉の脇）
    box(0.7, R.mez, 0.35, cream, s * 9.6, R.mez / 2, R.zBack + 0.18);
    box(0.7, R.mez, 0.35, cream, s * 3.9, R.mez / 2, R.zBack + 0.18);
  }

  // ---- 入口側の左右の張り出し（小さな階段付き）----
  for (const s of [-1, 1]) {
    const w = R.halfW - R.alcoveX;
    const d = R.zFront - R.alcoveZ;
    const cx = s * (R.alcoveX + w / 2);
    const cz = R.alcoveZ + d / 2;
    box(w, R.alcoveH, d, creamDark, cx, R.alcoveH / 2, cz);
    const t = tex.floor.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 2, d / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), planeMat(t));
    top.rotation.x = -Math.PI / 2;
    top.position.set(cx, R.alcoveH + 0.001, cz);
    add(top);
    // 3段の階段（内側へ降りる）+ 絨毯
    for (let j = 0; j < 3; j++) {
      const topY = R.alcoveH - 0.3 * (j + 1);
      const sx = s * (R.alcoveX - 0.25 - 0.5 * j);
      box(0.5, topY, 4.5, creamDark, sx, topY / 2, 12.75);
      box(0.512, topY + 0.012, 3.0, carpetMat, sx - s * 0.006, topY / 2 + 0.006, 12.75);
    }
    const c = tex.carpet.clone();
    c.needsUpdate = true;
    c.repeat.set(3, 4.5);
    const run = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, 3.0), planeMat(c));
    run.rotation.x = -Math.PI / 2;
    run.position.set(cx, R.alcoveH + 0.01, 12.75);
    add(run);
    // 張り出しの手すり（入口側と内側の縁）
    for (let z = R.alcoveZ + 0.2; z < 10.4; z += 1) box(0.1, 0.8, 0.1, cream, s * (R.alcoveX + 0.05), R.alcoveH + 0.4, z);
    box(0.14, 0.1, 1.2, cream, s * (R.alcoveX + 0.05), R.alcoveH + 0.82, R.alcoveZ + 0.6);
    blockers.push({ minX: Math.min(s * R.alcoveX, s * (R.alcoveX + 0.15)) - 0.1, maxX: Math.max(s * R.alcoveX, s * (R.alcoveX + 0.15)) + 0.1, minZ: R.alcoveZ, maxZ: 10.5, minY: R.alcoveH - 0.5, maxY: R.alcoveH + 2 });
  }

  // ---- 扉 ----
  const door = (map: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), planeMat(map, { transparent: true, alphaTest: 0.5 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    add(m);
  };
  const E = 0.03; // 壁からの浮かせ量
  door(tex.door, 3.0, 6.0, 0, 3.0, R.zFront - E, Math.PI); // 玄関（両開き）
  door(tex.doorBig, 3.6, 6.0, 0, R.mez + 3.0, R.zBack + E, 0); // 大きな星の扉（8★）
  door(tex.doorStar, 2.0, 4.0, -R.halfW + E, 2.0, -4, Math.PI / 2); // 左: 3★ さむいさむいマウンテン
  door(tex.doorStar, 2.0, 4.0, R.halfW - E, 2.0, -4, -Math.PI / 2); // 右: 1★ バッタンキングのとりで
  door(tex.door, 1.6, 3.2, -6.6, 1.6, R.zBack + E, 0); // 地下への扉（左）
  door(tex.door, 1.6, 3.2, 6.6, 1.6, R.zBack + E, 0); // 地下への扉（右）
  door(tex.door, 1.8, 3.6, -R.halfW + E, R.alcoveH + 1.8, 13, Math.PI / 2); // 左の張り出し: ボム兵の戦場の部屋
  door(tex.door, 1.8, 3.6, R.halfW - E, R.alcoveH + 1.8, 13, -Math.PI / 2); // 右の張り出し: 水族館
  door(tex.doorStar, 1.8, 3.6, R.halfW - E, R.mez + 1.8, -11.5, -Math.PI / 2); // 中2階 右: ピーチのかくれスライダー(1★)
  door(tex.door, 1.8, 3.6, -R.halfW + E, R.mez + 1.8, -11.5, Math.PI / 2); // 中2階 左

  // ---- 窓とステンドグラス ----
  const win = (x: number, y: number, z: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0), new THREE.MeshBasicMaterial({ map: tex.window, transparent: true, alphaTest: 0.5 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    add(m);
    const light = new THREE.PointLight(0xcfe6ff, 0.5, 9, 2);
    light.position.set(x, y, z);
    add(light);
  };
  for (const s of [-1, 1]) {
    win(s * 4.6, 8.6, R.zFront - E, Math.PI);
    win(s * 12.2, 8.6, R.zFront - E, Math.PI);
    win(s * (R.halfW - E), 8.6, 4, s < 0 ? Math.PI / 2 : -Math.PI / 2);
    win(s * (R.halfW - E), 8.6, 11, s < 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.1), new THREE.MeshBasicMaterial({ map: tex.glass, transparent: true, alphaTest: 0.3 }));
    g.position.set(0, 9.1, R.zFront - E);
    g.rotation.y = Math.PI;
    add(g);
    const glow = new THREE.PointLight(0xffd6f0, 1.2, 14, 2);
    glow.position.set(0, 8.5, R.zFront - 1.5);
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
  slot(-9.8, R.mez + 2.9, bz, 0, 1, 2.8, 2.1); // 奥の壁 中2階（正面から見える一等地）
  slot(-5.8, R.mez + 2.9, bz, 0, 1, 2.8, 2.1);
  slot(5.8, R.mez + 2.9, bz, 0, 1, 2.8, 2.1);
  slot(9.8, R.mez + 2.9, bz, 0, 1, 2.8, 2.1);
  slot(lx, 2.6, 6.5, 1, 0, 2.6, 2.0); // 左の壁（1階）
  slot(lx, 2.6, 1.5, 1, 0, 2.6, 2.0);
  slot(rx, 2.6, 6.5, -1, 0, 2.6, 2.0); // 右の壁（1階）
  slot(rx, 2.6, 1.5, -1, 0, 2.6, 2.0);
  slot(-6.5, 2.7, fz, 0, -1, 2.6, 2.0); // 入口側の壁（1階）
  slot(6.5, 2.7, fz, 0, -1, 2.6, 2.0);
  slot(-8.4, 8.2, fz, 0, -1, 2.6, 2.0); // 入口側の壁（上部）
  slot(8.4, 8.2, fz, 0, -1, 2.6, 2.0);
  slot(-11.6, 1.75, bz, 0, 1, 2.0, 1.45); // 中2階の下（奥の壁）
  slot(11.6, 1.75, bz, 0, 1, 2.0, 1.45);
  slot(lx, 1.75, -11.5, 1, 0, 2.0, 1.45); // 中2階の下（左右の壁）
  slot(rx, 1.75, -11.5, -1, 0, 2.0, 1.45);

  // ---- 地面の高さ関数 ----
  const heightAt = (x: number, z: number): number => {
    let h = 0;
    if (Math.abs(x) <= R.stairHalfW && z <= R.stairBottomZ && z >= R.balconyZ) {
      h = Math.max(h, (R.mez * (R.stairBottomZ - z)) / (R.stairBottomZ - R.balconyZ));
    }
    if (z <= R.balconyZ) h = Math.max(h, R.mez);
    const ax = -Math.abs(x); // 左右対称なので左側で判定
    if (ax <= -R.alcoveX && z >= R.alcoveZ) h = Math.max(h, R.alcoveH);
    else if (ax > -R.alcoveX && ax <= -R.alcoveX + 1.5 && z >= 10.5 && z <= 15) {
      h = Math.max(h, (R.alcoveH * (-R.alcoveX + 1.5 - ax)) / 1.5);
    }
    return h;
  };

  return { slots, blockers, heightAt };
}
