/**
 * 障害物の出現タイミングの公平性チェック（Phaser に依存しない純粋ロジック。
 * tests/spawn.test.ts で検証）。
 *
 * 「とり」は岩より速く飛ぶため、あとから出た とり が先に出た岩に追いつき、
 * プレイヤーの位置でほぼ同時に重なることがある。岩はジャンプで、とり は
 * 地上を走ってくぐるのが基本の避け方なので、同時に来ると2段ジャンプで
 * 両方を飛び越える以外に避けられない。そうならないよう、プレイヤー位置への
 * 到達時刻が近すぎる岩と とり の組は、あとから出すほうを遅らせる。
 */
export type ObstacleKind = 'rock' | 'bird';

export interface Arrival {
  /** プレイヤー位置に届く予想時刻(ms) */
  t: number;
  kind: ObstacleKind;
}

/** とり は岩の何倍の速さで流れるか */
export const BIRD_SPEED_FACTOR = 1.18;

/** 岩の「この時間だけ前」から とり が来てはいけない（くぐった直後は岩を跳べない） */
export const UNFAIR_BEFORE_MS = 550;
/** 岩の「この時間だけ後」まで とり が来てはいけない（岩を跳んだ直後はくぐれない） */
export const UNFAIR_AFTER_MS = 700;

/** 岩と とり の到達時刻の組が「避けられない近さ」かどうか */
export function isUnfairPair(rockT: number, birdT: number): boolean {
  const d = birdT - rockT;
  return d > -UNFAIR_BEFORE_MS && d < UNFAIR_AFTER_MS;
}

/**
 * candidate を何ms遅らせれば、既存のどの障害物とも不公平な組にならないか。
 * 遅らせる必要がなければ 0。
 */
export function conflictDelay(candidate: Arrival, existing: readonly Arrival[]): number {
  let delay = 0;
  // 1回の押し出しで別の組にぶつかることがあるので、落ち着くまで繰り返す
  for (let guard = 0; guard <= existing.length; guard++) {
    const t = candidate.t + delay;
    let need = 0;
    for (const e of existing) {
      if (e.kind === candidate.kind) continue;
      const rockT = candidate.kind === 'rock' ? t : e.t;
      const birdT = candidate.kind === 'bird' ? t : e.t;
      if (!isUnfairPair(rockT, birdT)) continue;
      const d = birdT - rockT;
      // とり を遅らせるなら岩の UNFAIR_AFTER_MS 後まで、岩を遅らせるなら とり の UNFAIR_BEFORE_MS 後まで
      need = Math.max(need, candidate.kind === 'bird' ? UNFAIR_AFTER_MS - d : d + UNFAIR_BEFORE_MS);
    }
    if (need === 0) break;
    delay += need;
  }
  return delay;
}

/** 出現位置 x から、速さ speed(px/s) で流れてプレイヤー位置 playerX に届く時刻 */
export function arrivalTime(now: number, x: number, playerX: number, speed: number): number {
  return now + ((x - playerX) / speed) * 1000;
}
