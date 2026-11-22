// 実行: npm test（Node 22.18+ の型ストリップで TS をそのまま実行する）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JumpController } from '../src/jump.ts';

const TUNING = { jumpVelocity: -750, cutVelocity: -260, minRiseMs: 140, bufferMs: 130, maxJumps: 2 };
const GRAVITY = 1600;
const DT = 1000 / 60;

/** 押下スケジュールを与えて物理を回し、最高到達点(px)と跳んだ回数を返す簡易シミュレータ */
function simulate(events: { at: number; type: 'press' | 'release' }[], durationMs = 3000) {
  const jc = new JumpController(TUNING);
  let y = 0; // 地面=0, 上が正
  let vy = 0; // 上向きが負（ゲームと同じ向き）
  let apex = 0;
  let jumps = 0;
  let cuts = 0;
  const jumpTimes: number[] = [];
  const landings: number[] = [];
  let wasAir = false;
  const queue = [...events].sort((a, b) => a.at - b.at);
  for (let now = 0; now <= durationMs; now += DT) {
    while (queue.length && queue[0].at <= now) {
      const e = queue.shift()!;
      if (e.type === 'press') jc.press(now);
      else jc.release();
    }
    const onFloor = y <= 0 && vy >= 0;
    if (wasAir && onFloor) landings.push(now);
    wasAir = !onFloor;
    const step = jc.step(now, onFloor, vy);
    if (step.jump) {
      vy = TUNING.jumpVelocity;
      jumps += 1;
      jumpTimes.push(now);
    } else if (step.cut) {
      vy = TUNING.cutVelocity;
      cuts += 1;
    }
    vy += GRAVITY * (DT / 1000);
    y -= vy * (DT / 1000);
    if (y <= 0) {
      y = 0;
      if (vy > 0) vy = 0;
    }
    apex = Math.max(apex, y);
  }
  return { apex, jumps, cuts, jumpTimes, landings };
}

test('押し続けるとフルジャンプ、すぐ離すと低いジャンプになる', () => {
  const hold = simulate([{ at: 100, type: 'press' }, { at: 1500, type: 'release' }]);
  const tap = simulate([{ at: 100, type: 'press' }, { at: 150, type: 'release' }]);
  assert.equal(hold.jumps, 1);
  assert.equal(tap.jumps, 1);
  assert.equal(hold.cuts, 0);
  assert.equal(tap.cuts, 1);
  assert.ok(hold.apex > 165 && hold.apex < 185, `フルジャンプの高さ ${hold.apex}`);
  assert.ok(tap.apex < hold.apex - 40, `タップ ${tap.apex} はホールド ${hold.apex} より十分低い`);
});

test('一瞬のタップでも、いちばん大きい岩(約70px)を越えられる高さは出る', () => {
  const tap = simulate([{ at: 100, type: 'press' }, { at: 101, type: 'release' }]);
  assert.ok(tap.apex >= 95, `最低ジャンプの高さ ${tap.apex}`);
});

test('空中でもう1回だけ跳べる（3回目は無視）', () => {
  const r = simulate([
    { at: 100, type: 'press' }, { at: 1000, type: 'release' },
    { at: 400, type: 'press' }, // 2段目
    { at: 600, type: 'press' }, // 3回目: 無効
  ], 900);
  assert.equal(r.jumps, 2);
});

test('先行入力: 着地の直前(130ms以内)に押すと着地と同時に跳ぶ', () => {
  // 2段ジャンプを使い切る入力。まずは先行入力なしで着地時刻を測る
  const twoJumps = [{ at: 100, type: 'press' as const }, { at: 300, type: 'press' as const }];
  const base = simulate(twoJumps);
  assert.equal(base.jumps, 2);
  const landing = base.landings[0];
  assert.ok(landing > 300, `着地時刻 ${landing}`);

  // 着地100ms前に押す: 空中では跳べないが、覚えておいて着地した瞬間に跳ぶ
  const early = simulate([...twoJumps, { at: landing - 100, type: 'press' }], landing + 200);
  assert.equal(early.jumps, 3, '先行入力が効いて着地直後に3回目のジャンプ');
  assert.ok(Math.abs(early.jumpTimes[2] - landing) <= DT * 2, `着地 ${landing} とほぼ同時に跳ぶ: ${early.jumpTimes[2]}`);

  // 着地400ms前の入力は古すぎるので捨てる（着地後に勝手に跳ばない）
  const tooEarly = simulate([...twoJumps, { at: landing - 400, type: 'press' }], landing + 200);
  assert.equal(tooEarly.jumps, 2, '古すぎる先行入力では跳ばない');
});

test('reset すると先行入力と押しっぱなし状態を持ち越さない', () => {
  const jc = new JumpController(TUNING);
  jc.press(0);
  jc.reset();
  assert.equal(jc.step(10, true, 0).jump, false);
});
