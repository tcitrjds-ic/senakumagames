export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** 地面タイルの高さ(px)。床の当たり判定もこの値を基準にする */
export const GROUND_HEIGHT = 96;
export const FLOOR_TOP = GAME_HEIGHT - GROUND_HEIGHT;

/** プレイヤーの立ち位置(x) */
export const PLAYER_X = 180;

/** 主人公スプライトの表示倍率（hero.png は 1マス7px。0.5倍 = 1マス3.5px） */
export const HERO_SCALE = 0.5;

/**
 * 当たり判定の大きさ(px)。見た目のスプライトとは別に固定サイズで持つ。
 * 体と顔の幅に合わせ、耳と髪のてっぺんは判定から外している（かすっただけではミスにしない）。
 */
export const HITBOX_WIDTH = 40;
export const HITBOX_HEIGHT = 92;

/** ジャンプの手ざわり（jump.ts の JumpTuning） */
export const JUMP_TUNING = {
  jumpVelocity: -750,
  cutVelocity: -260,
  minRiseMs: 140,
  bufferMs: 130,
  maxJumps: 2,
};

/**
 * キャンバスの外（スマホ縦持ち時の上下の余白など）が押された/離されたときに
 * game.events へ流すイベント名。main.ts が発行し、各シーンがジャンプや開始に使う。
 */
export const EVT_OUTSIDE_DOWN = 'outside-down';
export const EVT_OUTSIDE_UP = 'outside-up';

export const FONT_FAMILY =
  '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", system-ui, sans-serif';

export const HIGHSCORE_KEY = 'senakuma-run:highscore';

export function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGHSCORE_KEY, String(score));
  } catch {
    // プライベートモード等で保存できなくてもゲームは続行する
  }
}
