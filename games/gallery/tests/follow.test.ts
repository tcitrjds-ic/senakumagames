// 実行: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputBasis, followYaw, pickView, wrapAngle } from '../src/follow.ts';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('矢印キーの向きに体が向く: 上=背中 / 下=正面 / 右=右向き / 左=左向き(反転)', () => {
  // カメラは奥(-Z)を見ている
  const cam = [0, -1] as const;
  assert.deepEqual(pickView(0, -1, ...cam), { view: 'back', flip: false }); // ↑ 奥へ
  assert.deepEqual(pickView(0, 1, ...cam), { view: 'front', flip: false }); // ↓ 手前へ
  assert.deepEqual(pickView(1, 0, ...cam), { view: 'side', flip: false }); // → 右へ
  assert.deepEqual(pickView(-1, 0, ...cam), { view: 'side', flip: true }); // ← 左へ（修正前は反転が効かなかった）
});

test('カメラがどちらを向いていても、画面の左へ歩けば左向きになる', () => {
  for (const yaw of [0, 0.7, 1.9, -2.4, Math.PI]) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // カメラの前
    const lx = -Math.cos(yaw), lz = Math.sin(yaw); // カメラから見た左
    assert.deepEqual(pickView(lx, lz, fx, fz), { view: 'side', flip: true }, `yaw=${yaw}`);
    assert.deepEqual(pickView(-lx, -lz, fx, fz), { view: 'side', flip: false }, `yaw=${yaw}`);
  }
});

test('→ を押すと画面の右へ、↑ を押すと奥へ歩く', () => {
  const b = new InputBasis();
  let m = b.resolve(1, 0, 0, false);
  assert.ok(near(m.x, 1) && near(m.z, 0), `→: ${JSON.stringify(m)}`);
  m = b.resolve(0, 1, 0, false);
  assert.ok(near(m.x, 0) && near(m.z, -1), `↑: ${JSON.stringify(m)}`);
  m = b.resolve(0, 0, 0, false);
  assert.deepEqual(m, { x: 0, z: 0 });
});

test('横へ歩くとカメラが後ろへ回り込み、その間もまっすぐ歩き続ける（円を描かない）', () => {
  const b = new InputBasis();
  let yaw = 0;
  const dt = 1 / 60;
  let x = 0, z = 0;
  let first: { x: number; z: number } | null = null;
  for (let i = 0; i < 180; i++) { // → を3秒押し続ける
    const m = b.resolve(1, 0, yaw, false);
    first ??= m;
    assert.ok(near(m.x, first.x) && near(m.z, first.z), `${i}フレーム目で歩く向きが変わった`);
    x += m.x * 4.6 * dt;
    z += m.z * 4.6 * dt;
    yaw = followYaw(yaw, m.x, m.z, dt);
  }
  assert.ok(x > 13 && Math.abs(z) < 1e-6, `右へまっすぐ進む: (${x.toFixed(2)}, ${z.toFixed(2)})`);
  // 3秒後、カメラはほぼ真後ろ（右へ歩くなら、カメラは左側(-X)から右を見る = yaw -90度）
  assert.ok(Math.abs(wrapAngle(yaw - -Math.PI / 2)) < 0.1, `カメラの向き ${yaw.toFixed(3)}`);
});

test('斜め（右上）へ歩いてもカメラが回り込む', () => {
  let yaw = 0;
  const mx = Math.SQRT1_2, mz = -Math.SQRT1_2; // 右奥へ
  for (let i = 0; i < 180; i++) yaw = followYaw(yaw, mx, mz, 1 / 60);
  assert.ok(Math.abs(wrapAngle(yaw - -Math.PI / 4)) < 0.06, `カメラの向き ${yaw.toFixed(3)}`);
});

test('カメラのほうへ歩いてくるときは回り込まない（正面の顔を見せる）', () => {
  let yaw = 0.3;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  for (let i = 0; i < 180; i++) yaw = followYaw(yaw, -fx, -fz, 1 / 60);
  assert.ok(near(yaw, 0.3), `カメラの向き ${yaw}`);
});

test('押す向きを変えると、そのときのカメラから見た向きで歩き直す', () => {
  const b = new InputBasis();
  let yaw = 0;
  for (let i = 0; i < 180; i++) { // → を押し続けてカメラが後ろへ回る
    const m = b.resolve(1, 0, yaw, false);
    yaw = followYaw(yaw, m.x, m.z, 1 / 60);
  }
  // ここで ↑ に変える: 今のカメラ（右を見ている）から見た「奥」= 右(+X)へ進む
  const m = b.resolve(0, 1, yaw, false);
  assert.ok(m.x > 0.99 && Math.abs(m.z) < 0.1, `↑: ${JSON.stringify(m)}`);
});

test('手でカメラを回している間は、今のカメラから見た向きで歩く', () => {
  const b = new InputBasis();
  b.resolve(0, 1, 0, false); // ↑ を押し始める（基準は yaw=0）
  const m = b.resolve(0, 1, Math.PI / 2, true); // カメラを90度回した
  // yaw=90度のカメラの「奥」は -X
  assert.ok(near(m.x, -1) && Math.abs(m.z) < 1e-6, JSON.stringify(m));
});
