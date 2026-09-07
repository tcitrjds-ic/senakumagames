import * as THREE from 'three';
import { ROOM, type Blocker } from './castle';
import { AudioBox } from './audio';

export interface MoveInput {
  /** 移動ベクトル（ワールドXZ、長さ0〜1） */
  mx: number;
  mz: number;
  jump: boolean;
}

const RADIUS = 0.42;
const SPEED = 4.6;
const GRAVITY = 20;
const JUMP_V = 7.2;
const STEP_UP = 0.65; // これ以上の段差は壁扱い

/** せなくま（ビルボードのスプライト）。歩く・跳ぶ・段差と壁の当たり判定 */
export class Player {
  readonly sprite: THREE.Sprite;
  readonly shadow: THREE.Mesh;
  readonly pos = new THREE.Vector3(0, 0, 12.5);
  private vy = 0;
  private grounded = true;
  private walkT = 0;
  private stepT = 0;
  private facing = 1;
  readonly height = 1.7;

  constructor(
    scene: THREE.Scene,
    private readonly texIdle: THREE.Texture,
    private readonly texWalk: THREE.Texture,
    private readonly blockers: Blocker[],
    private readonly heightAt: (x: number, z: number) => number,
  ) {
    const texture = texIdle;
    const img = texture.image as { width: number; height: number };
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.2 });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set((this.height * img.width) / img.height, this.height, 1);
    this.sprite.center.set(0.5, 0);
    scene.add(this.sprite);

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const st = new THREE.CanvasTexture(c);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
    this.place();
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  update(dt: number, input: MoveInput, camYaw: number): void {
    const len = Math.hypot(input.mx, input.mz);
    const moving = len > 0.05;
    if (moving) {
      const k = Math.min(1, len) * SPEED * dt;
      const nx = input.mx / len;
      const nz = input.mz / len;
      this.tryMove(nx * k, 0);
      this.tryMove(0, nz * k);
      // カメラから見て左右どちらへ動いているかで向きを変える
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);
      const side = nx * rightX + nz * rightZ;
      if (Math.abs(side) > 0.3) this.facing = side > 0 ? 1 : -1;
      this.walkT += dt * 14 * Math.min(1, len);
      this.stepT += dt;
      if (this.grounded && this.stepT > 0.32) {
        this.stepT = 0;
        AudioBox.play('step');
      }
    } else {
      this.walkT = 0;
    }

    if (input.jump && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
      AudioBox.play('jump');
    }
    // 重力と着地
    const ground = this.heightAt(this.pos.x, this.pos.z);
    if (!this.grounded || this.pos.y > ground + 0.01) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      this.pos.y = ground;
    }
    this.place();
  }

  private tryMove(dx: number, dz: number): void {
    const nx = THREE.MathUtils.clamp(this.pos.x + dx, -ROOM.halfW + RADIUS, ROOM.halfW - RADIUS);
    const nz = THREE.MathUtils.clamp(this.pos.z + dz, ROOM.zBack + RADIUS, ROOM.zFront - RADIUS);
    // 段差: 高すぎる段は壁として扱う（空中では通過可）
    const h = this.heightAt(nx, nz);
    if (h > this.pos.y + STEP_UP) return;
    const midY = this.pos.y + 0.6;
    for (const b of this.blockers) {
      if (midY < b.minY || midY > b.maxY) continue;
      if (nx + RADIUS > b.minX && nx - RADIUS < b.maxX && nz + RADIUS > b.minZ && nz - RADIUS < b.maxZ) {
        return; // 壁・柱・手すりにぶつかる
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;
    if (this.grounded && h < this.pos.y - 0.01) this.grounded = false; // 段から降りる
    if (this.grounded && h > this.pos.y) this.pos.y = h; // 小さな段を上る
  }

  private place(): void {
    const bob = this.walkT > 0 ? Math.abs(Math.sin(this.walkT)) * 0.07 : 0;
    const tilt = this.walkT > 0 ? Math.sin(this.walkT) * 0.04 : 0;
    // 歩行アニメ: 2枚のドット絵を交互に（空中では足を上げた絵）
    const frame = !this.grounded || (this.walkT > 0 && Math.sin(this.walkT) > 0) ? this.texWalk : this.texIdle;
    if (this.sprite.material.map !== frame) {
      this.sprite.material.map = frame;
      this.sprite.material.needsUpdate = true;
    }
    this.sprite.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    this.sprite.material.rotation = tilt;
    const sx = Math.abs(this.sprite.scale.x) * this.facing;
    this.sprite.scale.x = sx;
    const ground = this.heightAt(this.pos.x, this.pos.z);
    this.shadow.position.set(this.pos.x, ground + 0.02, this.pos.z);
    const air = THREE.MathUtils.clamp(1 - (this.pos.y - ground) / 3, 0.3, 1);
    this.shadow.scale.setScalar(air);
  }
}
