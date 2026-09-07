import Phaser from 'phaser';
import { AudioBox } from '../audio';
import { FONT, W, H, addCornerButtons, signboard, pillButton } from '../ui';
import { floorsOf, floorLabel, type Room } from '../manifest';

interface DoorSpot {
  x: number;
  y: number;
  w: number;
  h: number;
  signY: number;
}

/** 奥壁の扉の位置（foyer.png の描画と一致させる） */
const DOORS: DoorSpot[] = [
  { x: 300, y: 293, w: 46, h: 78, signY: 246 },
  { x: 660, y: 293, w: 46, h: 78, signY: 246 },
  { x: 300, y: 178, w: 40, h: 68, signY: 132 },
  { x: 660, y: 178, w: 40, h: 68, signY: 132 },
];
const STAR_DOOR: DoorSpot = { x: 480, y: 184, w: 70, h: 100, signY: 108 };

/** 城内ホール。扉をタップすると絵画の部屋へ、星の扉で上の階へ */
export class FoyerScene extends Phaser.Scene {
  private floor = 0;
  private busy = false;

  constructor() {
    super('Foyer');
  }

  init(data: { floor?: number }): void {
    this.floor = data?.floor ?? 0;
    this.busy = false;
  }

  create(): void {
    const rooms = this.registry.get('rooms') as Room[];
    const floors = floorsOf(rooms);
    const here = floors[this.floor] ?? [];

    this.add.image(W / 2, H / 2, 'foyer').setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(90).setAlpha(0.5);
    this.cameras.main.fadeIn(450, 0, 0, 0);

    signboard(this, 90, 36, `${floorLabel(this.floor)} ホール`, 18, 30);

    DOORS.forEach((spot, i) => {
      const room = here[i];
      const zone = this.add.zone(spot.x, spot.y, spot.w, spot.h).setDepth(40).setInteractive({ useHandCursor: true });
      const glow = this.add.image(spot.x, spot.y, 'glow').setDepth(5).setAlpha(0).setScale(spot.h / 130).setBlendMode(Phaser.BlendModes.ADD);
      zone.on('pointerover', () => this.tweens.add({ targets: glow, alpha: 0.6, duration: 150 }));
      zone.on('pointerout', () => this.tweens.add({ targets: glow, alpha: 0, duration: 200 }));
      if (room) {
        signboard(this, spot.x, spot.signY, room.name, 13, 30);
        zone.on('pointerdown', () => this.openRoom(rooms.indexOf(room), spot));
      } else {
        zone.on('pointerdown', () => this.toast('このへやは まだ じゅんびちゅう'));
      }
    });

    // 大きな星の扉 → 次の階（部屋がまだあるとき）
    const hasNext = floors.length > this.floor + 1;
    const starZone = this.add.zone(STAR_DOOR.x, STAR_DOOR.y, STAR_DOOR.w, STAR_DOOR.h).setDepth(40).setInteractive({ useHandCursor: true });
    const starGlow = this.add.image(STAR_DOOR.x, STAR_DOOR.y, 'glow').setDepth(5).setAlpha(0).setScale(0.9).setBlendMode(Phaser.BlendModes.ADD);
    starZone.on('pointerover', () => this.tweens.add({ targets: starGlow, alpha: 0.6, duration: 150 }));
    starZone.on('pointerout', () => this.tweens.add({ targets: starGlow, alpha: 0, duration: 200 }));
    if (hasNext) {
      signboard(this, STAR_DOOR.x, STAR_DOOR.signY, `★ ${floorLabel(this.floor + 1)} へ`, 14, 30);
      starZone.on('pointerdown', () => this.goFloor(this.floor + 1));
    } else {
      starZone.on('pointerdown', () => this.toast('★ この さきは まだ じゅんびちゅう ★'));
    }
    if (this.floor > 0) {
      pillButton(this, 120, H - 40, 190, 44, `▼ ${floorLabel(this.floor - 1)} へ おりる`, () => this.goFloor(this.floor - 1), 0x8a5a30, 0x5a3a1c, 18);
    }

    // せなくま（案内役）
    const guide = this.add.image(W - 120, 440, 'senakuma').setDepth(20);
    guide.setDisplaySize(guide.width * (140 / guide.height), 140);
    this.tweens.add({ targets: guide, y: 434, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bubble(W - 262, 392, 'すきな へやの\nとびらを タップしてね');

    pillButton(this, W - 120, H - 40, 190, 44, '← そとへ でる', () => this.goOutside(), 0x8a5a30, 0x5a3a1c, 18);
    addCornerButtons(this);
  }

  private bubble(x: number, y: number, text: string): void {
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#6b4632', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    const w = t.width + 26;
    const h = t.height + 18;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillTriangle(w / 2 - 6, 4, w / 2 - 18, -8, w / 2 + 14, -2);
    g.lineStyle(2, 0xf0d8a0, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.add.container(x, y, [g, t]).setDepth(21);
  }

  private toast(msg: string): void {
    AudioBox.play('pop');
    const t = this.add
      .text(W / 2, H - 92, msg, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#fff6dc', backgroundColor: 'rgba(40,24,12,0.85)', padding: { x: 16, y: 8 } })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({ targets: t, y: H - 104, alpha: 0, delay: 900, duration: 500, onComplete: () => t.destroy() });
  }

  private openRoom(roomIndex: number, spot: DoorSpot): void {
    if (this.busy) return;
    this.busy = true;
    AudioBox.play('door');
    // 扉へズームしながら暗転
    this.cameras.main.pan(spot.x, spot.y, 450, 'Sine.easeIn');
    this.cameras.main.zoomTo(2.2, 450, 'Sine.easeIn');
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Room', { roomIndex, floor: this.floor });
    });
  }

  private goFloor(floor: number): void {
    if (this.busy) return;
    this.busy = true;
    AudioBox.play('door');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Foyer', { floor }));
  }

  private goOutside(): void {
    if (this.busy) return;
    this.busy = true;
    AudioBox.play('back');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Outside'));
  }
}
