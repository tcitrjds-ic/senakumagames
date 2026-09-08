import * as THREE from 'three';

/**
 * 3方向 × 3コマのドット絵シート（tools/make_pixel_chars.py の出力）を
 * ビルボードのスプライトとして表示する。
 * 行: 0=正面 1=背面 2=横（右向き。左向きは反転）／ 列: 0=立ち 1=歩きA 2=歩きB
 */
export type View = 'front' | 'back' | 'side';
const ROW: Record<View, number> = { front: 0, back: 1, side: 2 };

export class PixelSprite {
  readonly sprite: THREE.Sprite;
  private readonly tex: THREE.Texture;
  private readonly w: number;
  private view: View = 'front';
  private frame = 0;
  private flip = false;

  constructor(sheet: THREE.Texture, cellHeight: number, cellW = 24, cellH = 32) {
    this.tex = sheet.clone();
    this.tex.needsUpdate = true;
    this.tex.repeat.set(1 / 3, 1 / 3);
    this.tex.offset.set(0, 2 / 3);
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.3 });
    this.sprite = new THREE.Sprite(mat);
    this.w = (cellHeight * cellW) / cellH;
    this.sprite.scale.set(this.w, cellHeight, 1);
    this.sprite.center.set(0.5, 0);
  }

  setFrame(view: View, frame: number, flip: boolean): void {
    if (view !== this.view || frame !== this.frame) {
      this.view = view;
      this.frame = frame;
      this.tex.offset.set(frame / 3, 1 - (ROW[view] + 1) / 3);
    }
    if (flip !== this.flip) {
      this.flip = flip;
      this.sprite.scale.x = flip ? -this.w : this.w;
    }
  }

  /** キャラの向きとカメラの向き（どちらもXZ平面）から、表示する面と反転を決める */
  static viewFor(facing: THREE.Vector3, camFwd: THREE.Vector3): { view: View; flip: boolean } {
    const dot = facing.x * camFwd.x + facing.z * camFwd.z;
    if (dot > 0.55) return { view: 'back', flip: false };
    if (dot < -0.55) return { view: 'front', flip: false };
    // カメラの右ベクトル = (-fz, fx)。右を向いていれば反転なし
    const right = facing.x * -camFwd.z + facing.z * camFwd.x;
    return { view: 'side', flip: right < 0 };
  }
}
