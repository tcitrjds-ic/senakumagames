import * as THREE from 'three';
import { ROOM, type Blocker } from './castle';
import { PixelSprite } from './sprites';

const GRAVITY = 20;
const STEP_UP = 0.65; // これ以上の段差は壁扱い

/** 歩くキャラの共通部分: 段差・壁の当たり判定、重力、影、ドット絵の向きとコマ送り */
export class Walker {
  readonly pixel: PixelSprite;
  readonly shadow: THREE.Mesh;
  readonly pos = new THREE.Vector3();
  readonly facing = new THREE.Vector3(0, 0, -1);
  protected vy = 0;
  protected grounded = true;
  protected walkT = 0;
  protected moving = false;
  readonly radius: number;

  constructor(
    scene: THREE.Scene,
    sheet: THREE.Texture,
    cellHeight: number,
    protected readonly blockers: Blocker[],
    protected readonly heightAt: (x: number, z: number) => number,
    radius = 0.42,
  ) {
    this.radius = radius;
    this.pixel = new PixelSprite(sheet, cellHeight);
    scene.add(this.pixel.sprite);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  /** 位置を直接置く（初期配置用） */
  place(x: number, z: number): void {
    this.pos.set(x, this.heightAt(x, z), z);
    this.vy = 0;
    this.grounded = true;
  }

  /** dx,dz だけ歩く（壁で止まる）。実際に進めたら true */
  step(dx: number, dz: number, dt: number): boolean {
    const len = Math.hypot(dx, dz);
    this.moving = len > 1e-4;
    if (!this.moving) {
      this.walkT = 0;
      return false;
    }
    const x0 = this.pos.x;
    const z0 = this.pos.z;
    this.tryMove(dx, 0);
    this.tryMove(0, dz);
    this.facing.set(dx / len, 0, dz / len);
    this.walkT += dt * 9 * Math.min(1, len / (dt * 4.6));
    return Math.hypot(this.pos.x - x0, this.pos.z - z0) > 1e-4;
  }

  jump(v: number): boolean {
    if (!this.grounded) return false;
    this.vy = v;
    this.grounded = false;
    return true;
  }

  /** 重力と着地 */
  physics(dt: number): void {
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
  }

  private tryMove(dx: number, dz: number): void {
    const r = this.radius;
    const nx = THREE.MathUtils.clamp(this.pos.x + dx, -ROOM.halfW + r, ROOM.halfW - r);
    const nz = THREE.MathUtils.clamp(this.pos.z + dz, ROOM.zBack + r, ROOM.zFront - r);
    const h = this.heightAt(nx, nz);
    if (h > this.pos.y + STEP_UP) return;
    const midY = this.pos.y + 0.6;
    for (const b of this.blockers) {
      if (midY < b.minY || midY > b.maxY) continue;
      if (nx + r > b.minX && nx - r < b.maxX && nz + r > b.minZ && nz - r < b.maxZ) return;
    }
    this.pos.x = nx;
    this.pos.z = nz;
    if (this.grounded && h < this.pos.y - 0.01) this.grounded = false;
    if (this.grounded && h > this.pos.y) this.pos.y = h;
  }

  /** スプライトと影を現在位置へ。camFwd はカメラの向き（XZ・正規化） */
  render(camFwd: THREE.Vector3): void {
    const { view, flip } = PixelSprite.viewFor(this.facing, camFwd);
    let frame = 0;
    if (!this.grounded) frame = 1;
    else if (this.moving) frame = [1, 0, 2, 0][Math.floor(this.walkT) % 4];
    this.pixel.setFrame(view, frame, flip);
    const bob = this.moving && this.grounded ? Math.abs(Math.sin(this.walkT * Math.PI)) * 0.04 : 0;
    this.pixel.sprite.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    const ground = this.heightAt(this.pos.x, this.pos.z);
    this.shadow.position.set(this.pos.x, ground + 0.02, this.pos.z);
    const air = THREE.MathUtils.clamp(1 - (this.pos.y - ground) / 3, 0.3, 1);
    this.shadow.scale.setScalar(air);
  }
}

let shadowTex: THREE.CanvasTexture | null = null;
function shadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
