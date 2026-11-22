/**
 * 画面の寸法・盤の配置・色。
 * 盤の画像は tools/make_mancala_assets.py が同じ数値（LAYOUT）で描くので、変えるときは両方そろえる。
 */

/** ゲーム内の座標系（この大きさで配置を考える） */
export const W = 960;
export const H = 540;

/**
 * 描画解像度の倍率。キャンバスは W*RES x H*RES で持ち、カメラを RES 倍に拡大して映す。
 * 高精細な画面（スマホ・Retina）や大きなウィンドウでは 2 にして、盤の木目や文字がぼやけないようにする。
 * 等倍で足りる画面では 1 のまま（描く画素が4分の1で済む）。起動時に1度だけ決める。
 */
export const RES = pickResolution();

function pickResolution(): 1 | 2 {
  if (typeof window === 'undefined') return 1; // テスト（Node）から読み込まれたとき
  // 画面に収めたときの表示倍率 × 画面の精細さ = 実際に1ゲームpxが占める画素数
  const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
  const density = fit * (window.devicePixelRatio || 1);
  return density > 1.15 ? 2 : 1;
}

// マス割り: 0-5 あなたのくぼみ / 6 あなたのゴール / 7-12 せなくまのくぼみ / 13 せなくまのゴール
export const P_STORE = 6;
export const C_STORE = 13;

/** 盤（板）の左上と大きさ */
export const BOARD = { x: 70, y: 195, w: 820, h: 310 };
/** board.png が板のまわりに持っている余白（落ち影のぶん） */
export const BOARD_MARGIN = 48;

/** くぼみ・ゴールの半径 */
export const PIT_R = { x: 38, y: 34 };
export const STORE_R = { x: 44, y: 105 };

export function isStore(i: number): boolean {
  return i === P_STORE || i === C_STORE;
}

/** マス i の中心 */
export function pitPos(i: number): { x: number; y: number } {
  if (i === P_STORE) return { x: 810, y: 350 };
  if (i === C_STORE) return { x: 150, y: 350 };
  if (i <= 5) return { x: 250 + i * 84, y: 435 };
  return { x: 670 - (i - 7) * 84, y: 265 };
}

/** 色。木とフェルトの卓に合わせた、象牙・こげ茶・真ちゅう色 */
export const COLOR = {
  ivory: 0xfff7e6,
  ivoryText: '#fff7e6',
  line: 0xb5894e, // 枠線（真ちゅう色）
  lineSoft: 0xe6d0a2, // 枠の内側の細線
  brown: 0x5f3f27,
  brownText: '#5f3f27',
  brownSoftText: '#8a6a4c',
  green: 0x5b8a3c, // あなた
  rose: 0xd9708a, // せなくま
  feltDark: 0x0c211b, // 暗転に使う深い緑
  gold: 0xffdf8a, // 選べるくぼみの光
  mint: 0x9cf0a0, // 着地点の光
  pink: 0xffa3ba, // せなくまが選んだくぼみの光
};

/** 石1個ぶんの置き場所（マス中心からのずれ・向き・絵柄） */
export interface SeedSpot {
  x: number;
  y: number;
  angle: number;
  frame: number;
}

/** 0〜1 の決まった乱数（同じ引数なら毎回同じ値。石が再描画のたびに動かないように） */
function hash(a: number, b: number, c: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

/** 石どうしが重ならずに並ぶときの、うずまきの広がり具合（px） */
const SEED_SPACING = 9.5;

/**
 * マス pit に n 個の石があるときの k 番目の置き場所。
 * ひまわりの種の並び（黄金角のうずまき）で中心から外へ詰め、少しだけ位置をゆらす。
 *
 * 少ないうちは中心に丸くかたまる（個数が増えても既存の石は動かない）。
 * 丸のままでは横幅に収まらなくなったら、同じ広さのまま縦長のだ円に伸ばす（ゴールは縦に長い）。
 * それでも収まらない数になったら、だ円の中で石が重なり合って山になる。
 */
export function seedSpot(pit: number, k: number, n: number): SeedSpot {
  const store = isStore(pit);
  const maxX = store ? 29 : 24; // 石の中心が収まる範囲（ふちから石の半分ぶん内側）
  const maxY = store ? 86 : 20;
  const disc = SEED_SPACING * Math.sqrt(n); // n個がゆったり収まる丸の半径
  const sx = Math.min(maxX, disc);
  const sy = Math.min(maxY, (disc * disc) / sx);
  const u = Math.sqrt((k + 0.45) / n);
  const a = k * 2.39996 + pit * 1.7;
  const jx = (hash(pit, k, 1) - 0.5) * 4;
  const jy = (hash(pit, k, 2) - 0.5) * 4;
  return {
    x: Math.cos(a) * u * sx + jx,
    y: Math.sin(a) * u * sy + jy,
    angle: hash(pit, k, 3) * 360,
    frame: Math.floor(hash(pit, k, 4) * 4),
  };
}
