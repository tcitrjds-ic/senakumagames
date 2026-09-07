import Phaser from 'phaser';
import { FONT, W, H } from '../ui';
import { registerRipple } from '../ripple';
import { normalizeManifest, type RawManifest, type Room } from '../manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#1b1a2e');
    this.add
      .text(W / 2, H / 2 - 30, 'よみこみちゅう…', { fontFamily: FONT, fontSize: '28px', color: '#f3e2b0' })
      .setOrigin(0.5);
    const barBg = this.add.graphics();
    barBg.fillStyle(0x3a3050, 1).fillRoundedRect(300, 278, 360, 22, 11);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0xe8c56a, 1).fillRoundedRect(306, 282, 348 * v, 14, 7);
    });

    this.load.image('outside', 'assets/outside.png');
    this.load.image('foyer', 'assets/foyer.png');
    this.load.image('room', 'assets/room.png');
    this.load.image('frame', 'assets/frame.png');
    this.load.image('placeholder', 'assets/placeholder.png');
    this.load.image('star', 'assets/star.png');
    this.load.image('glass', 'assets/glass_peach.png');
    this.load.image('sparkle', 'assets/sparkle.png');
    this.load.image('vignette', 'assets/vignette.png');
    this.load.image('glow', 'assets/glow.png');
    this.load.image('senakuma', 'assets/player.png');
    this.load.image('face_laugh', 'assets/face_laugh.png');
    // 絵画マニフェスト（無くても既定の空きキャンバスで起動する）
    this.load.json('manifest', 'assets/paintings/manifest.json');
  }

  create(): void {
    registerRipple(this);
    const raw = this.cache.json.exists('manifest') ? (this.cache.json.get('manifest') as RawManifest) : undefined;
    const rooms: Room[] = normalizeManifest(raw);
    this.registry.set('rooms', rooms);

    // 第2段階: 絵画の画像を読み込む（読めなかったものは準備中キャンバスにフォールバック）
    const missing = new Set<string>();
    let count = 0;
    for (const r of rooms) {
      for (const p of r.paintings) {
        if (p.image) {
          this.load.image(p.key, `assets/paintings/${p.image}`);
          count += 1;
        }
      }
    }
    const go = () => {
      this.registry.set('missing', missing);
      this.scene.start('Outside');
    };
    if (count === 0) {
      go();
      return;
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) => missing.add(file.key));
    this.load.once('complete', go);
    this.load.start();
  }
}
