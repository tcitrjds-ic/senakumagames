export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** 地面タイルの高さ(px)。床の当たり判定もこの値を基準にする */
export const GROUND_HEIGHT = 96;
export const FLOOR_TOP = GAME_HEIGHT - GROUND_HEIGHT;

/** プレイヤー表示の高さ(px)。差し替えた画像も縦横比を保ってこの高さに揃える */
export const PLAYER_HEIGHT = 110;

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
