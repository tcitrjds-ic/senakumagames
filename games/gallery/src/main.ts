import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import '@fontsource/m-plus-rounded-1c/800.css';
import * as THREE from 'three';
import { AudioBox } from './audio';
import { buildHall, ROOM, STATUE, PARTITION } from './hall';
import { InputBasis, followYaw } from './follow';
import { Controls } from './controls';
import { normalizeManifest, type Painting, type RawManifest } from './manifest';
import { HungPainting, placeholderTexture } from './painting';
import { Player } from './player';
import { Npc, type NpcSpec } from './npc';
import { loadTexture, loadTextures } from './textures';
import { Viewer } from './viewer';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

async function main(): Promise<void> {
  // フォント（キャンバスに描く番号プレート等のため）。読み込みは先に始めて、
  // 文字を描くところ（額の番号プレート・空きキャンバス）の直前まで待たない。
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('800 32px "M PLUS Rounded 1c"'), document.fonts.load('700 32px "M PLUS Rounded 1c"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  const canvas = $<HTMLCanvasElement>('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3ece0);
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 120);

  // 照明: 全体をやわらかく＋正面上からの光（天窓や窓の明かりは hall.ts で足す）
  scene.add(new THREE.HemisphereLight(0xfff6e4, 0x7a6a56, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(6, 14, 18);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  // ---- 読み込み（テクスチャ・マニフェスト・絵）----
  const enter = $<HTMLButtonElement>('enter');
  const manager = new THREE.LoadingManager();
  // 単一HTMLに固めた配布物（アーティファクト等）では、素材URLを data URI に差し替える
  const assetMap = (window as unknown as { __ASSET_MAP?: Record<string, string> }).__ASSET_MAP;
  const resolveAsset = (u: string): string => assetMap?.[u] ?? u;
  if (assetMap) manager.setURLModifier(resolveAsset);
  manager.onProgress = (_u, loaded, total) => {
    enter.textContent = `よみこみちゅう… ${Math.round((loaded / Math.max(1, total)) * 100)}%`;
  };
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const [tex, raw] = await Promise.all([
    loadTextures(manager, aniso),
    fetch(resolveAsset('assets/paintings/manifest.json'))
      .then((r) => (r.ok ? (r.json() as Promise<RawManifest>) : undefined))
      .catch(() => undefined),
  ]);
  const paintings: Painting[] = normalizeManifest(raw);

  // ---- ホールと絵 ----
  const hall = buildHall(scene, tex);
  const loader = new THREE.TextureLoader(manager);
  // 額を掛ける場所の数より後ろの絵は表示しないので読み込まない
  const images = await Promise.all(
    paintings.map(async (p, i) => {
      if (!p.image || i >= hall.slots.length) return null;
      try {
        const t = await loadTexture(loader, `assets/paintings/${p.image}`);
        t.anisotropy = aniso;
        return t;
      } catch {
        console.warn(`絵が読めませんでした: ${p.image}`);
        return null;
      }
    }),
  );

  // 文字を描くキャンバス（番号プレート・空きキャンバス）を作る前にフォントを待つ
  await fontsReady;
  const hung: HungPainting[] = [];
  paintings.forEach((p, i) => {
    const slot = hall.slots[i];
    if (!slot) {
      if (i === hall.slots.length) console.warn(`額を掛ける場所は ${hall.slots.length} か所までです。No.${p.no} 以降は表示されません`);
      return;
    }
    const t = images[i];
    const hp = new HungPainting(slot, p, t ?? placeholderTexture(p.no), !!t);
    scene.add(hp.group);
    hung.push(hp);
  });

  const player = new Player(scene, tex.charSenakuma, hall.blockers, hall.heightAt);

  // ---- 館内の住人（歩き回る）----
  type Box = { x: [number, number]; z: [number, number] };
  const statueBox: Box = { x: [STATUE.x - STATUE.r - 0.8, STATUE.x + STATUE.r + 0.8], z: [STATUE.z - STATUE.r - 0.8, STATUE.z + STATUE.r + 0.8] };
  const partitions: Box[] = [-1, 1].map((sgn) => ({
    x: [sgn * PARTITION.x - 0.9, sgn * PARTITION.x + 0.9] as [number, number],
    z: [PARTITION.z0 - 0.7, PARTITION.z1 + 0.7] as [number, number],
  }));
  const specs: { spec: NpcSpec; sheet: THREE.Texture }[] = [
    // ポテトくん: 玄関まわりで お客さんを出むかえる
    { sheet: tex.charPotato, spec: { name: 'ポテトくん', cellHeight: 1.5, speed: 1.7, zones: [{ x: [-8.5, 8.5], z: [8.2, 13.6] }], start: [-3.5, 10.5] } },
    // くまの学芸員: 奥のステージで特別展示を見まわる
    { sheet: tex.charCurator, spec: { name: 'くまの学芸員', cellHeight: 1.85, speed: 1.3, zones: [{ x: [-10.5, 10.5], z: [-13.6, -9.2] }], start: [4.5, -11.5] } },
    // うさぎの絵かき: ホールの左がわを歩く
    { sheet: tex.charRabbit, spec: { name: 'うさぎの絵かき', cellHeight: 1.75, speed: 2.0, zones: [{ x: [-9.2, -1.8], z: [-5.2, 7.5] }], avoid: [statueBox, ...partitions], start: [-3.2, -1] } },
    // ひよこ: ホールの右がわを ちょこちょこ歩く
    { sheet: tex.charChick, spec: { name: 'ひよこ', cellHeight: 1.2, speed: 2.3, zones: [{ x: [1.8, 9.2], z: [-5.2, 7.5] }], avoid: [statueBox, ...partitions], start: [3.4, 0.5] } },
  ];
  const npcs = specs.map(({ spec, sheet }) => new Npc(scene, sheet, spec, hall.blockers, hall.heightAt));
  // 絵の拡大表示中は、Enter / Space / F などの入力をビューアに任せる
  const controls = new Controls($('joy'), $('joy-base'), $('joy-knob'), $('orbit'), $('btn-jump'), $('btn-look'), {
    isBlocked: () => viewer.blocksInput,
  });
  const clock = new THREE.Clock();
  let elapsed = 0;
  const viewer = new Viewer(camera, () => elapsed, resolveAsset);

  // ---- HUD ----
  const toastEl = $('toast');
  let toastTimer = 0;
  const toast = (msg: string) => {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.style.opacity = '0'), 1400);
  };
  const lookBtn = $('btn-look');
  const hint = $('hint');
  const sign = $('sign');
  const muteBtn = $('btn-mute');
  muteBtn.textContent = AudioBox.muted ? '🔇' : '🔊';
  muteBtn.addEventListener('pointerup', () => {
    muteBtn.textContent = AudioBox.toggleMute() ? '🔇' : '🔊';
    AudioBox.play('click');
  });
  $('btn-full').addEventListener('pointerup', () => {
    AudioBox.play('click');
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  });
  $('btn-home').addEventListener('pointerup', () => {
    AudioBox.play('click');
    window.location.href = '../';
  });

  // ---- カメラ（せなくまの後ろから追いかける。右側ドラッグで回せる）----
  let camYaw = 0; // 0 = 玄関側から奥（-Z）を見る
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const CAM_DIST = 6.2;
  const CAM_H = 3.0;
  const updateCamera = (dt: number, moveDir: THREE.Vector3 | null, sinceOrbit: number, snap = false) => {
    // 歩いている向きの後ろへ回り込む（前進・横・斜めのどれでも。詳細は follow.ts）。
    // 手でカメラを回した直後は、その向きを尊重してしばらく回さない。
    if (moveDir && sinceOrbit > 1.5) camYaw = followYaw(camYaw, moveDir.x, moveDir.z, dt);
    camTarget.set(player.pos.x, player.pos.y + 1.4, player.pos.z);
    // 目標位置へのレイが壁・床・天井に当たる手前までカメラを寄せる
    const dir = new THREE.Vector3(Math.sin(camYaw) * CAM_DIST, CAM_H - 1.4, Math.cos(camYaw) * CAM_DIST);
    const margin = 0.45;
    let t = 1;
    const limit = (d: number, from: number, min: number, max: number) => {
      if (d > 1e-6) t = Math.min(t, (max - margin - from) / d);
      else if (d < -1e-6) t = Math.min(t, (min + margin - from) / d);
    };
    limit(dir.x, camTarget.x, -ROOM.halfW, ROOM.halfW);
    limit(dir.z, camTarget.z, ROOM.zBack, ROOM.zFront);
    limit(dir.y, camTarget.y, 0, ROOM.ceil);
    t = THREE.MathUtils.clamp(t, 0.25, 1);
    const desired = camTarget.clone().addScaledVector(dir, t);
    // 壁際で寄ったぶんだけ高い位置から見下ろす（キャラで画面が埋まらないように）
    if (t < 0.6) desired.y = Math.min(desired.y + (0.6 - t) * 4.5, ROOM.ceil - 0.5);
    // 最後に必ず部屋の内側へ収める
    desired.x = THREE.MathUtils.clamp(desired.x, -ROOM.halfW + 0.35, ROOM.halfW - 0.35);
    desired.z = THREE.MathUtils.clamp(desired.z, ROOM.zBack + 0.35, ROOM.zFront - 0.35);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.6, ROOM.ceil - 0.35);
    if (snap) camPos.copy(desired);
    else camPos.lerp(desired, Math.min(1, dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  };
  updateCamera(0, null, 999, true);

  // ---- 絵のタップ（レイキャスト）----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (x: number, y: number): { hp: HungPainting; uv: THREE.Vector2 } | null => {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hung.map((h) => h.canvas), false);
    if (hits.length === 0) return null;
    const hp = hits[0].object.userData.hung as HungPainting;
    return { hp, uv: hits[0].uv ?? new THREE.Vector2(0.5, 0.5) };
  };
  const REACH = 4.2;

  // ---- 開始 ----
  enter.disabled = false;
  enter.textContent = 'びじゅつかんに はいる';
  let started = false;
  enter.addEventListener('click', () => {
    if (started) return;
    started = true;
    AudioBox.unlock();
    AudioBox.play('door');
    AudioBox.startMusic();
    $('title').classList.add('off');
    camYaw = 0; // 玄関から正面（奥のステージ）を見る向きで開始
    updateCamera(0, null, 999, true);
    window.setTimeout(() => (hint.style.opacity = '0'), 6000);
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // デバッグ用（E2Eテストが位置やフレームレートを読む）
  const dbg = { frames: 0, pos: player.pos, facing: player.facing, sprite: player.pixel, npcs, camYaw: () => camYaw, started: () => started, grounded: () => (player as unknown as { grounded: boolean }).grounded };
  (window as unknown as { __gallery: typeof dbg }).__gallery = dbg;

  // ---- メインループ ----
  const basis = new InputBasis();
  const move = new THREE.Vector3();
  const camFwd = new THREE.Vector3(0, 0, -1);
  let nearest: HungPainting | null = null;
  const loop = () => {
    const dt = Math.min(0.1, clock.getDelta());
    elapsed += dt;
    dbg.frames += 1;
    const input = controls.poll(dt);

    if (started && !viewer.isOpen) {
      camYaw += input.orbitDelta;
      // 入力をカメラから見た向きで解釈する（同じ向きに押し続ける間は基準を固定。follow.ts）
      const m = basis.resolve(input.stickX, input.stickY, camYaw, input.orbitDelta !== 0);
      move.set(m.x, 0, m.z);
      const moving = move.lengthSq() > 0.0025;
      player.update(dt, { mx: move.x, mz: move.z, jump: input.jumpPressed });
      updateCamera(dt, moving ? move : null, input.sinceOrbit);

      // 近くの絵を探す
      let best: HungPainting | null = null;
      let bestD = REACH;
      for (const hp of hung) {
        const d = hp.update(elapsed, player.pos);
        if (d < bestD) {
          bestD = d;
          best = hp;
        }
      }
      if (best !== nearest) {
        nearest = best;
        lookBtn.classList.toggle('on', !!best);
      }
      if (input.lookPressed && nearest) viewer.open(nearest);
      if (input.tap) {
        const hit = pick(input.tap.x, input.tap.y);
        if (hit) {
          if (hit.hp.slot.pos.distanceTo(player.pos) <= REACH) viewer.open(hit.hp, hit.uv);
          else {
            hit.hp.burst(hit.uv.x, hit.uv.y, 0.03, elapsed);
            toast('もっと ちかづいてね');
          }
        }
      }
      sign.textContent = player.pos.y > ROOM.stage - 0.2 ? 'とくべつ展示ステージ' : 'てんじホール';
    } else {
      for (const hp of hung) hp.update(elapsed, player.pos);
      if (!started) {
        // タイトル中はゆっくり回るカメラで雰囲気を見せる
        camYaw += dt * 0.08;
        updateCamera(dt, null, 999);
      }
    }
    for (const n of npcs) n.update(dt, player.pos);
    camFwd.set(camTarget.x - camera.position.x, 0, camTarget.z - camera.position.z).normalize();
    player.render(camFwd);
    for (const n of npcs) n.render(camFwd);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

main().catch((e) => {
  console.error(e);
  const enter = $<HTMLButtonElement>('enter');
  enter.textContent = 'よみこみに しっぱいしました';
});
