import * as THREE from 'three';
import type { Blocker } from './castle';
import { AudioBox } from './audio';
import { Walker } from './walker';

export interface MoveInput {
  /** 移動ベクトル（ワールドXZ、長さ0〜1） */
  mx: number;
  mz: number;
  jump: boolean;
}

const SPEED = 4.6;
const JUMP_V = 7.2;

/** せなくま（操作キャラ） */
export class Player extends Walker {
  private stepT = 0;

  constructor(scene: THREE.Scene, sheet: THREE.Texture, blockers: Blocker[], heightAt: (x: number, z: number) => number) {
    super(scene, sheet, 1.8, blockers, heightAt, 0.42, [32, 44]);
    this.place(0, 12.5);
  }

  update(dt: number, input: MoveInput): void {
    const len = Math.hypot(input.mx, input.mz);
    if (len > 0.05) {
      const k = Math.min(1, len) * SPEED * dt;
      this.step((input.mx / len) * k, (input.mz / len) * k, dt);
      this.stepT += dt;
      if (this.grounded && this.stepT > 0.3) {
        this.stepT = 0;
        AudioBox.play('step');
      }
    } else {
      this.step(0, 0, dt);
    }
    if (input.jump && this.jump(JUMP_V)) AudioBox.play('jump');
    this.physics(dt);
  }
}
