import * as THREE from 'three';
import type { Blocker } from './castle';
import { Walker } from './walker';

export interface Zone {
  x: [number, number];
  z: [number, number];
}

export interface NpcSpec {
  name: string;
  cellHeight: number;
  speed: number;
  /** 歩き回る範囲（この中からランダムに目的地を選ぶ） */
  zones: Zone[];
  /** 入ってはいけない範囲（大階段など） */
  avoid?: Zone[];
  start: [number, number];
}

type State = 'walk' | 'wait';

/** 城内を歩き回る住人（キノピオ・マリオ・ルイージ・ピーチ） */
export class Npc extends Walker {
  private state: State = 'wait';
  private timer = 1 + Math.random() * 2;
  private target = new THREE.Vector2();
  private stuckT = 0;
  private lastX = 0;
  private lastZ = 0;

  constructor(
    scene: THREE.Scene,
    sheet: THREE.Texture,
    readonly spec: NpcSpec,
    blockers: Blocker[],
    heightAt: (x: number, z: number) => number,
  ) {
    super(scene, sheet, spec.cellHeight, blockers, heightAt, 0.38);
    this.place(spec.start[0], spec.start[1]);
    this.facing.set(0, 0, 1);
  }

  private inZone(x: number, z: number, zones: Zone[] | undefined): boolean {
    return !!zones && zones.some((zn) => x >= zn.x[0] && x <= zn.x[1] && z >= zn.z[0] && z <= zn.z[1]);
  }

  private pickTarget(): void {
    for (let i = 0; i < 20; i++) {
      const zn = this.spec.zones[Math.floor(Math.random() * this.spec.zones.length)];
      const x = THREE.MathUtils.lerp(zn.x[0], zn.x[1], Math.random());
      const z = THREE.MathUtils.lerp(zn.z[0], zn.z[1], Math.random());
      if (this.inZone(x, z, this.spec.avoid)) continue;
      // 目的地が今いる高さと違う場所（階段の先など）は選ばない
      if (Math.abs(this.heightAt(x, z) - this.pos.y) > 0.3) continue;
      this.target.set(x, z);
      return;
    }
    this.target.set(this.pos.x, this.pos.z);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.state === 'wait') {
      this.timer -= dt;
      this.step(0, 0, dt);
      // 近くに来た せなくま のほうを向く
      const dx = playerPos.x - this.pos.x;
      const dz = playerPos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 && d > 0.01) this.facing.set(dx / d, 0, dz / d);
      if (this.timer <= 0) {
        this.pickTarget();
        this.state = 'walk';
        this.stuckT = 0;
        this.lastX = this.pos.x;
        this.lastZ = this.pos.z;
      }
    } else {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.y - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25) {
        this.state = 'wait';
        this.timer = 1 + Math.random() * 3;
        this.step(0, 0, dt);
      } else {
        const k = Math.min(d, this.spec.speed * dt);
        this.step((dx / d) * k, (dz / d) * k, dt);
        this.stuckT += dt;
        if (this.stuckT > 0.6) {
          // 壁などで進めていなければ目的地を選び直す
          if (Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ) < 0.15) {
            this.state = 'wait';
            this.timer = 0.4;
          }
          this.stuckT = 0;
          this.lastX = this.pos.x;
          this.lastZ = this.pos.z;
        }
      }
    }
    this.physics(dt);
  }
}
