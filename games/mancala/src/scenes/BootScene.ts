import Phaser from 'phaser';
import { W, H, COLOR } from '../layout';
import { FONT, setupCamera } from '../ui';

/** アセット読み込みシーン。盤まわりの素材は tools/make_mancala_assets.py が生成する */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    setupCamera(this);
    this.cameras.main.setBackgroundColor('#1d3f35');
    this.add
      .text(W / 2, H / 2 - 30, 'よみこみちゅう…', {
        fontFamily: FONT,
        fontSize: '26px',
        color: COLOR.ivoryText,
      })
      .setOrigin(0.5);
    const barBg = this.add.graphics();
    barBg.fillStyle(0x0c211b, 0.6).fillRoundedRect(W / 2 - 180, H / 2 + 8, 360, 20, 10);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0xe2b04a, 1).fillRoundedRect(W / 2 - 176, H / 2 + 12, 352 * v, 12, 6);
    });

    this.load.image('felt', 'assets/felt.png');
    this.load.image('light', 'assets/light.png');
    this.load.image('vignette', 'assets/vignette.png');
    this.load.image('board', 'assets/board.png');
    this.load.spritesheet('seeds', 'assets/seeds.png', { frameWidth: 52, frameHeight: 52 });
    this.load.image('seed_shadow', 'assets/seed_shadow.png');
    this.load.image('ring_pit', 'assets/ring_pit.png');
    this.load.image('ring_store', 'assets/ring_store.png');
    this.load.image('panel_shadow', 'assets/panel_shadow.png');
    this.load.image('sparkle', 'assets/sparkle.png');
    this.load.image('senakuma', 'assets/player.png');
    this.load.image('senakuma_wink', 'assets/player_jump.png');
    this.load.image('face_cry', 'assets/face_cry.png');
    this.load.image('face_laugh', 'assets/face_laugh.png');
  }

  create(): void {
    this.scene.start('Game');
  }
}
