/**
 * ジャンプの入力処理（Phaser に依存しない純粋ロジック。tests/jump.test.ts で検証）。
 *
 * - 先行入力: 着地の少し前に押しても、着地した瞬間に跳ぶ
 * - 可変ジャンプ: すぐ離すと低く、押し続けると高く跳ぶ
 * - 2段ジャンプ: 空中でもう1回だけ跳べる
 */
export interface JumpTuning {
  /** ジャンプの初速（上向きなので負の値, px/s） */
  jumpVelocity: number;
  /** 早く離したとき、上昇速度をこの値まで落とす（負の値, px/s） */
  cutVelocity: number;
  /** 跳んでからこの時間は離しても減速しない（最低ジャンプ高さの保証, ms） */
  minRiseMs: number;
  /** 先行入力を覚えておく時間(ms) */
  bufferMs: number;
  /** 着地なしで跳べる回数（2 = 2段ジャンプ） */
  maxJumps: number;
}

export interface JumpStep {
  /** このフレームで跳ぶ（速度を jumpVelocity にする） */
  jump: boolean;
  /** このフレームで上昇を打ち切る（速度を cutVelocity にする） */
  cut: boolean;
  /** 地上からの1段目か、空中での2段目か（演出の出し分け用） */
  airJump: boolean;
}

export class JumpController {
  private tuning: JumpTuning;
  private jumpsLeft: number;
  private pressedAt = Number.NEGATIVE_INFINITY;
  private jumpedAt = Number.NEGATIVE_INFINITY;
  private holding = false;
  private rising = false;

  constructor(tuning: JumpTuning) {
    this.tuning = tuning;
    this.jumpsLeft = tuning.maxJumps;
  }

  /** ジャンプボタンが押された（キーリピートは呼び出し側で除くこと） */
  press(now: number): void {
    this.pressedAt = now;
    this.holding = true;
  }

  /** ジャンプボタンがすべて離された */
  release(): void {
    this.holding = false;
  }

  /** 入力を捨てる（ポーズ復帰時など、押しっぱなし判定を持ち越さないため） */
  reset(): void {
    this.pressedAt = Number.NEGATIVE_INFINITY;
    this.holding = false;
    this.rising = false;
  }

  /**
   * 毎フレーム呼ぶ。
   * @param now 現在時刻(ms)
   * @param onFloor 接地しているか
   * @param velocityY 現在の縦速度（上向きが負）
   */
  step(now: number, onFloor: boolean, velocityY: number): JumpStep {
    const t = this.tuning;
    if (onFloor && velocityY >= 0) {
      this.jumpsLeft = t.maxJumps;
      this.rising = false;
    }

    const buffered = now - this.pressedAt <= t.bufferMs;
    if (buffered && this.jumpsLeft > 0) {
      const airJump = !onFloor;
      // 空中で初めて押した場合も「1段目を使った」扱いにして、残りは1回だけ
      if (airJump && this.jumpsLeft === t.maxJumps) this.jumpsLeft -= 1;
      this.jumpsLeft -= 1;
      this.pressedAt = Number.NEGATIVE_INFINITY;
      this.jumpedAt = now;
      this.rising = true;
      return { jump: true, cut: false, airJump };
    }

    if (this.rising) {
      if (velocityY >= t.cutVelocity) {
        // もう十分ゆっくり（または下降中）: 打ち切る必要なし
        this.rising = false;
      } else if (!this.holding && now - this.jumpedAt >= t.minRiseMs) {
        this.rising = false;
        return { jump: false, cut: true, airJump: false };
      }
    }
    return { jump: false, cut: false, airJump: false };
  }
}
