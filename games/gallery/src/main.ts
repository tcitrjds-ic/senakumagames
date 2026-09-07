import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import '@fontsource/m-plus-rounded-1c/800.css';
import * as THREE from 'three';
import { AudioBox } from './audio';
import { buildCastle, ROOM } from './castle';
import { Controls } from './controls';
import { normalizeManifest, type Painting, type RawManifest } from './manifest';
import { HungPainting, placeholderTexture } from './painting';
import { Player } from './player';
import { loadTexture, loadTextures } from './textures';
import { Viewer } from './viewer';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

async function main(): Promise<void> {
  // フォント（キャンバスに描く番号プレート等のため）
  await Promise.race([
    Promise.all([document.fonts.load('800 32px "M PLUS Rounded 1c"'), document.fonts.load('700 32px "M PLUS Rounded 1c"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  const canvas = $<HTMLCanvasElement>('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1a2e);
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 120);

  // 照明: 全体をやわらかく＋正面上からの光＋ステンドグラスの色
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
  if (assetMap) manager.setURLModifier((u) => assetMap[u] ?? u);
  manager.onProgress = (_u, loaded, total) => {
    enter.textContent = `よみこみちゅう… ${Math.round((loaded / Math.max(1, total)) * 100)}%`;
  };
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const [tex, raw] = await Promise.all([
    loadTextures(manager, aniso),
    fetch('assets/paintings/manifest.json')
      .then((r) => (r.ok ? (r.json() as Promise<RawManifest>) : undefined))
      .catch(() => undefined),
  ]);
  const paintings: Painting[] = normalizeManifest(raw);
  const loader = new THREE.TextureLoader(manager);
  const images = await Promise.all(
    paintings.map(async (p) => {
      if (!p.image) return null;
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

  // ---- 城と絵 ----
  const castle = buildCastle(scene, tex);
  const hung: HungPainting[] = [];
  paintings.forEach((p, i) => {
    const slot = castle.slots[i];
    if (!slot) {
      if (i === castle.slots.length) console.warn(`額を掛ける場所は ${castle.slots.length} か所までです。No.${p.no} 以降は表示されません`);
      return;
    }
    const t = images[i];
    const hp = new HungPainting(slot, p, t ?? placeholderTexture(p.no), !!t);
    scene.add(hp.group);
    hung.push(hp);
  });

  const player = new Player(scene, tex.playerIdle, tex.playerWalk, castle.blockers, castle.heightAt);
  const controls = new Controls($('joy'), $('joy-base'), $('joy-knob'), $('orbit'), $('btn-jump'), $('btn-look'));
  const clock = new THREE.Clock();
  let elapsed = 0;
  const viewer = new Viewer(camera, () => elapsed);

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
  let camYaw = 0; // 0 = 入口側から奥（-Z）を見る
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const CAM_DIST = 6.2;
  const CAM_H = 3.0;
  const updateCamera = (dt: number, moveDir: THREE.Vector3 | null, sinceOrbit: number, snap = false) => {
    // 進行方向がカメラの前方（画面奥）に近いときだけ、後ろへゆっくり回り込む。
    // 横移動で回すと入力方向が回転して螺旋になるので回さない。
    if (moveDir && sinceOrbit > 2.5) {
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const len = Math.hypot(moveDir.x, moveDir.z) || 1;
      const dot = (moveDir.x * fx + moveDir.z * fz) / len;
      if (dot > 0.6) {
        const want = Math.atan2(moveDir.x, moveDir.z) + Math.PI;
        let diff = want - camYaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        camYaw += diff * Math.min(1, dt * 1.0);
      }
    }
    const under = player.pos.z < ROOM.balconyZ && player.pos.y < ROOM.mez - 0.5;
    camTarget.set(player.pos.x, player.pos.y + 1.4, player.pos.z);
    // 目標位置へのレイが壁・床・天井（中2階の床板を含む）に当たる手前までカメラを寄せる
    const dir = new THREE.Vector3(Math.sin(camYaw) * CAM_DIST, CAM_H - 1.4, Math.cos(camYaw) * CAM_DIST);
    const margin = 0.45;
    let t = 1;
    const limit = (d: number, from: number, min: number, max: number) => {
      if (d > 1e-6) t = Math.min(t, (max - margin - from) / d);
      else if (d < -1e-6) t = Math.min(t, (min + margin - from) / d);
    };
    limit(dir.x, camTarget.x, -ROOM.halfW, ROOM.halfW);
    limit(dir.z, camTarget.z, ROOM.zBack, ROOM.zFront);
    limit(dir.y, camTarget.y, 0, under ? ROOM.mez - 0.3 : ROOM.ceil);
    // 1階にいて中2階の床板の下へカメラが潜るとき
    if (!under && player.pos.y < ROOM.mez - 0.5 && dir.z < 0) {
      const tz = (ROOM.balconyZ - camTarget.z) / dir.z; // 床板の縁を越える t
      if (tz > 0 && tz < t && camTarget.y + dir.y * tz < ROOM.mez + 0.5) t = Math.min(t, tz);
    }
    t = THREE.MathUtils.clamp(t, 0.25, 1);
    const desired = camTarget.clone().addScaledVector(dir, t);
    // 壁際で寄ったぶんだけ高い位置から見下ろす（キャラで画面が埋まらないように）
    if (t < 0.6) desired.y = Math.min(desired.y + (0.6 - t) * 4.5, (under ? ROOM.mez : ROOM.ceil) - 0.5);
    // 最後に必ず部屋の内側へ収める（壁の外や中2階の床板の中に出ない）
    desired.x = THREE.MathUtils.clamp(desired.x, -ROOM.halfW + 0.35, ROOM.halfW - 0.35);
    desired.z = THREE.MathUtils.clamp(desired.z, ROOM.zBack + 0.35, ROOM.zFront - 0.35);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.6, (under ? ROOM.mez - 0.3 : ROOM.ceil) - 0.35);
    if (!under && player.pos.y < ROOM.mez - 0.5 && desired.z < ROOM.balconyZ && desired.y > ROOM.mez - 0.5 && desired.y < ROOM.mez + 0.5) desired.y = ROOM.mez - 0.5;
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
  enter.textContent = 'おしろに はいる';
  let started = false;
  enter.addEventListener('click', () => {
    if (started) return;
    started = true;
    AudioBox.unlock();
    AudioBox.play('door');
    AudioBox.startMusic();
    $('title').classList.add('off');
    camYaw = 0; // 入口から正面（大階段）を見る向きで開始
    updateCamera(0, null, 999, true);
    window.setTimeout(() => (hint.style.opacity = '0'), 6000);
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // デバッグ用（E2Eテストが位置やフレームレートを読む）
  const dbg = { frames: 0, pos: player.pos, camYaw: () => camYaw, started: () => started };
  (window as unknown as { __gallery: typeof dbg }).__gallery = dbg;

  // ---- メインループ ----
  const fwd = new THREE.Vector3();
  const rightV = new THREE.Vector3();
  const move = new THREE.Vector3();
  let nearest: HungPainting | null = null;
  const loop = () => {
    const dt = Math.min(0.1, clock.getDelta());
    elapsed += dt;
    dbg.frames += 1;
    const input = controls.poll(dt);

    if (started && !viewer.isOpen) {
      camYaw += input.orbitDelta;
      // カメラ基準の前・右
      fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      rightV.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
      move.set(0, 0, 0).addScaledVector(fwd, input.stickY).addScaledVector(rightV, input.stickX);
      const moving = move.lengthSq() > 0.0025;
      player.update(dt, { mx: move.x, mz: move.z, jump: input.jumpPressed }, camYaw);
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
      sign.textContent = player.pos.y > ROOM.mez - 0.3 ? '中2階 おどりば' : player.pos.y > ROOM.alcoveH - 0.3 && player.pos.z > ROOM.alcoveZ ? '1F はりだし' : '1F ホール';
    } else {
      for (const hp of hung) hp.update(elapsed, player.pos);
      if (!started) {
        // タイトル中はゆっくり回るカメラで雰囲気を見せる
        camYaw += dt * 0.08;
        updateCamera(dt, null, 999);
      }
    }
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
