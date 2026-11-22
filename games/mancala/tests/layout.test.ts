// 実行: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedSpot, pitPos, isStore, PIT_R, STORE_R, P_STORE, C_STORE, BOARD } from '../src/layout.ts';

/** 石の絵の半分の大きさ(px)。中心がこのぶん ふちより内側にあれば、石はくぼみからはみ出さない */
const SEED_HALF = 6;

test('石は何個入っていても、くぼみ・ゴールの中に収まる', () => {
  for (let pit = 0; pit < 14; pit++) {
    const r = isStore(pit) ? STORE_R : PIT_R;
    const shownMax = isStore(pit) ? 44 : 16; // GameScene.refreshPit が描く上限
    for (let n = 1; n <= shownMax; n++) {
      for (let k = 0; k < n; k++) {
        const s = seedSpot(pit, k, n);
        const d = (s.x / (r.x - SEED_HALF)) ** 2 + (s.y / (r.y - SEED_HALF)) ** 2;
        assert.ok(d <= 1, `pit ${pit}: ${n}個中の${k}番目が外に出ている (${s.x.toFixed(1)}, ${s.y.toFixed(1)})`);
      }
    }
  }
});

test('少ないうちは、石が増えても先に入っていた石は動かない', () => {
  for (const pit of [0, 7, P_STORE, C_STORE]) {
    for (let n = 1; n < 4; n++) {
      for (let k = 0; k < n; k++) {
        const a = seedSpot(pit, k, n);
        const b = seedSpot(pit, k, n + 1);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.01, `pit ${pit}: ${n}→${n + 1}個で${k}番目が動いた`);
      }
    }
  }
});

test('同じ引数なら毎回同じ置き場所になる（再描画で石が動かない）', () => {
  assert.deepEqual(seedSpot(3, 5, 9), seedSpot(3, 5, 9));
});

test('ゴールにたくさん入ると、縦長に広がって山になる', () => {
  const few = Array.from({ length: 6 }, (_, k) => seedSpot(P_STORE, k, 6));
  const many = Array.from({ length: 40 }, (_, k) => seedSpot(P_STORE, k, 40));
  const spanY = (a: { y: number }[]) => Math.max(...a.map((s) => s.y)) - Math.min(...a.map((s) => s.y));
  const spanX = (a: { x: number }[]) => Math.max(...a.map((s) => s.x)) - Math.min(...a.map((s) => s.x));
  assert.ok(spanY(few) < 70, `6個のうちは中心にかたまる: 縦 ${spanY(few).toFixed(0)}px`);
  assert.ok(spanY(many) > 140 && spanY(many) > spanX(many) * 2, `40個なら縦長に広がる: 縦 ${spanY(many).toFixed(0)} / 横 ${spanX(many).toFixed(0)}`);
});

test('くぼみはすべて盤の板の内側にある', () => {
  for (let pit = 0; pit < 14; pit++) {
    const { x, y } = pitPos(pit);
    const r = isStore(pit) ? STORE_R : PIT_R;
    assert.ok(x - r.x > BOARD.x && x + r.x < BOARD.x + BOARD.w, `pit ${pit} の左右`);
    assert.ok(y - r.y > BOARD.y && y + r.y < BOARD.y + BOARD.h, `pit ${pit} の上下`);
  }
});

test('盤の画像を描くツールと、ゲーム側の配置の数値がそろっている', async () => {
  // 盤の絵（くぼみの位置）は tools/make_mancala_assets.py が、当たり判定と石の位置は layout.ts が決める。
  // 片方だけ変えると絵と判定がずれるので、数値の一致を機械的に確かめる。
  const { readFile } = await import('node:fs/promises');
  const { BOARD_MARGIN } = await import('../src/layout.ts');
  const py = await readFile(new URL('../../../tools/make_mancala_assets.py', import.meta.url), 'utf8');
  const num = (name: string): number => {
    const m = py.match(new RegExp(`\\b${name}\\s*=\\s*(\\d+)`));
    assert.ok(m, `${name} が make_mancala_assets.py に見つからない`);
    return Number(m[1]);
  };
  assert.deepEqual(
    { x: num('board_x'), y: num('board_y'), w: num('board_w'), h: num('board_h') },
    BOARD,
  );
  assert.deepEqual({ x: num('pit_rx'), y: num('pit_ry') }, PIT_R);
  assert.deepEqual({ x: num('store_rx'), y: num('store_ry') }, STORE_R);
  assert.equal(num('MARGIN'), BOARD_MARGIN);
  // くぼみの中心（式の形のまま書かれているので、式の文字列で照合する）
  assert.ok(py.includes('player_pits=[(250 + i * 84, 435) for i in range(6)]'));
  assert.ok(py.includes('cpu_pits=[(670 - i * 84, 265) for i in range(6)]'));
  assert.ok(py.includes('player_store=(810, 350), cpu_store=(150, 350)'));
  assert.deepEqual([pitPos(0), pitPos(5), pitPos(7), pitPos(12)], [
    { x: 250, y: 435 }, { x: 670, y: 435 }, { x: 670, y: 265 }, { x: 250, y: 265 },
  ]);
  assert.deepEqual([pitPos(P_STORE), pitPos(C_STORE)], [{ x: 810, y: 350 }, { x: 150, y: 350 }]);
});
