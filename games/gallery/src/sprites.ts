import * as THREE from 'three';
import { pickView, type View } from './follow';

/**
 * 3方向 × 3コマのドット絵シート（tools/make_pixel_chars.py の出力）を
 * ビルボードのスプライトとして表示する。
 * 行: 0=正面 1=背面 2=横（右向き。左向きは反転）／ 列: 0=立ち 1=歩きA 2=歩きB
 */
export type { View };
const ROW: Record<View, number> = { front: 0, back: 1, side: 2 };

export class PixelSprite {
  readonly sprite: THREE.Sprite;
  private readonly tex: THREE.Texture;
  private view: View = 'front';
  private frame = 0;
  private flip = false;

  constructor(sheet: THREE.Texture, cellHeight: number) {
    this.tex = sheet.clone();
    this.tex.needsUpdate = true;
    this.tex.repeat.set(1 / 3, 1 / 3);
    this.tex.offset.set(0, 2 / 3);
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.3 });
    this.sprite = new THREE.Sprite(mat);
    // 3×3 のシートなので、シート全体の縦横比＝1コマの縦横比
    const img = sheet.image as { width?: number; height?: number } | undefined;
    const aspect = img && img.width && img.height ? img.width / img.height : 0.75;
    this.sprite.scale.set(cellHeight * aspect, cellHeight, 1);
    this.sprite.center.set(0.5, 0);
  }

  setFrame(view: View, frame: number, flip: boolean): void {
    if (view === this.view && frame === this.frame && flip === this.flip) return;
    this.view = view;
    this.frame = frame;
    this.flip = flip;
    // 左右反転は「絵を右端から左へ読む」ことで行う。
    // スプライトは拡大率の符号を無視して描かれるため、scale.x を負にしても反転しない。
    this.tex.repeat.x = flip ? -1 / 3 : 1 / 3;
    this.tex.offset.set(flip ? (frame + 1) / 3 : frame / 3, 1 - (ROW[view] + 1) / 3);
  }

  /** キャラの向きとカメラの向き（どちらもXZ平面）から、表示する面と反転を決める */
  static viewFor(facing: THREE.Vector3, camFwd: THREE.Vector3): { view: View; flip: boolean } {
    return pickView(facing.x, facing.z, camFwd.x, camFwd.z);
  }
}
