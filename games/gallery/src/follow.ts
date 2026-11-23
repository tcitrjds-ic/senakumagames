/**
 * 歩く向き・カメラの回り込み・キャラの見せる面を決める計算（Three.js に依存しない。tests/follow.test.ts で検証）。
 *
 * 座標: X は右、Z は手前が正（玄関が +Z）。カメラの向き yaw は「0 = 奥(-Z)を見る」。
 */

/** 角度を -π〜π に直す */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** これより小さい入力は「押していない」扱い */
const DEADZONE = 0.05;
/** 押している向きがこれ以上変わったら、基準の向きを取り直す（ラジアン。約20度） */
const RELATCH = 0.35;
/**
 * カメラが後ろへ回り込む速さ（大きいほど速い。1/秒）。
 * 真横へ歩き出すと、約0.5秒は横向きの姿が見え、2秒ほどでほぼ真後ろに回る。
 * これより速いと向きを変えるたびに画面が振り回され、遅いと「ついてこない」と感じる。
 */
const FOLLOW_RATE = 1.1;

/**
 * スティック／矢印キーの入力を、ホールの中の歩く向きに直す。
 *
 * 入力は「カメラから見た向き」で解釈する（→ を押せば画面の右へ歩く）。ただしカメラは歩く向きの
 * 後ろへ自動で回り込むので、毎フレーム今のカメラで解釈し直すと、→ を押し続けるだけで
 * 向きが変わり続けて円を描いてしまう。そこで、同じ向きに押し続けている間は
 * 「押し始めたときのカメラの向き」を基準に固定し、まっすぐ歩けるようにする。
 * 押す向きを変えたとき・手でカメラを回したときに、基準を今のカメラに取り直す。
 */
export class InputBasis {
  private yaw = 0;
  private held: number | null = null;

  resolve(stickX: number, stickY: number, camYaw: number, orbiting: boolean): { x: number; z: number } {
    if (Math.hypot(stickX, stickY) < DEADZONE) {
      this.held = null;
      return { x: 0, z: 0 };
    }
    const angle = Math.atan2(stickX, stickY);
    if (this.held === null || orbiting || Math.abs(wrapAngle(angle - this.held)) > RELATCH) {
      this.yaw = camYaw;
      this.held = angle;
    }
    // 基準の向きから見た「前」と「右」
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    return { x: fx * stickY + rx * stickX, z: fz * stickY + rz * stickX };
  }
}

/**
 * 歩いている向きの後ろへ、カメラをなめらかに回り込ませる。新しい yaw を返す。
 * 前進だけでなく、横や斜めへ歩くときも回り込む。
 * カメラのほう（手前）へ歩いてくるときだけは回さない（正面の顔が見えるように。
 * ここで回すと 180度ぐるりと回って酔いやすい）。
 */
export function followYaw(camYaw: number, moveX: number, moveZ: number, dt: number): number {
  const len = Math.hypot(moveX, moveZ);
  if (len < 1e-4) return camYaw;
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const ahead = (moveX * fx + moveZ * fz) / len; // 1 = 奥へ / 0 = 真横 / -1 = 手前へ
  const weight = smoothstep(-0.75, -0.2, ahead);
  if (weight <= 0) return camYaw;
  const want = Math.atan2(moveX, moveZ) + Math.PI; // 歩く向きの真後ろ
  const diff = wrapAngle(want - camYaw);
  return camYaw + diff * Math.min(1, dt * FOLLOW_RATE * weight);
}

export type View = 'front' | 'back' | 'side';

/**
 * キャラの向きとカメラの向き（どちらもXZ平面・長さ1）から、見せる面と左右反転を決める。
 * 横向きの絵は右向きで描いてあるので、画面の左へ向いているときに反転する。
 */
export function pickView(facingX: number, facingZ: number, camFwdX: number, camFwdZ: number): { view: View; flip: boolean } {
  const away = facingX * camFwdX + facingZ * camFwdZ; // 1 = カメラに背を向けている
  if (away > 0.55) return { view: 'back', flip: false };
  if (away < -0.55) return { view: 'front', flip: false };
  // カメラの右ベクトル = (-fz, fx)
  const toRight = facingX * -camFwdZ + facingZ * camFwdX;
  return { view: 'side', flip: toRight < 0 };
}
