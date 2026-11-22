import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conflictDelay, isUnfairPair, arrivalTime,
  UNFAIR_BEFORE_MS, UNFAIR_AFTER_MS, BIRD_SPEED_FACTOR,
} from '../src/spawn.ts';
import type { Arrival } from '../src/spawn.ts';

test('岩の直後・直前に届く とり は不公平と判定する', () => {
  assert.equal(isUnfairPair(1000, 1240), true); // 岩の240ms後に とり（修正前に実際に起きた並び）
  assert.equal(isUnfairPair(1000, 1000), true);
  assert.equal(isUnfairPair(1000, 1000 + UNFAIR_AFTER_MS), false);
  assert.equal(isUnfairPair(1000, 1000 - UNFAIR_BEFORE_MS), false);
});

test('とり を遅らせて岩との間隔をあける', () => {
  const d = conflictDelay({ t: 1240, kind: 'bird' }, [{ t: 1000, kind: 'rock' }]);
  assert.equal(d, UNFAIR_AFTER_MS - 240);
});

test('同じ種類どうしは遅らせない（岩の連続・とり の連続は従来どおり）', () => {
  assert.equal(conflictDelay({ t: 1100, kind: 'rock' }, [{ t: 1000, kind: 'rock' }]), 0);
  assert.equal(conflictDelay({ t: 1100, kind: 'bird' }, [{ t: 1000, kind: 'bird' }]), 0);
});

test('ランダムな出現列でも、調整後は不公平な組が1つも残らない', () => {
  // 再現性のための簡易乱数（seed固定）
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 200; trial++) {
    const speed = 280 + rnd() * 340; // ゲームの速度域 280〜620px/s
    const arrivals: Arrival[] = [];
    let now = 0;
    for (let i = 0; i < 40; i++) {
      now += (750 + rnd() * 500) * (280 / speed); // 実ゲームの出現間隔
      const kind = rnd() < 0.5 ? 'rock' : 'bird';
      const v = kind === 'bird' ? speed * BIRD_SPEED_FACTOR : speed;
      const cand = { t: arrivalTime(now, 1040, 180, v), kind } as Arrival;
      cand.t += conflictDelay(cand, arrivals);
      arrivals.push(cand);
    }
    for (const a of arrivals) {
      for (const b of arrivals) {
        if (a.kind === 'rock' && b.kind === 'bird') {
          assert.equal(isUnfairPair(a.t, b.t), false, `trial ${trial}: rock ${a.t} / bird ${b.t}`);
        }
      }
    }
  }
});

test('調整なしだと不公平な組が実際に発生する（対照: このテストが検出力を持つことの確認）', () => {
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let unfair = 0;
  const arrivals: Arrival[] = [];
  let now = 0;
  for (let i = 0; i < 200; i++) {
    now += 750 + rnd() * 500;
    const kind = rnd() < 0.5 ? 'rock' : 'bird';
    arrivals.push({ t: arrivalTime(now, 1040, 180, kind === 'bird' ? 280 * BIRD_SPEED_FACTOR : 280), kind } as Arrival);
  }
  for (const a of arrivals) for (const b of arrivals) {
    if (a.kind === 'rock' && b.kind === 'bird' && isUnfairPair(a.t, b.t)) unfair += 1;
  }
  assert.ok(unfair > 0, '調整しない場合は不公平な組が出るはず');
});
