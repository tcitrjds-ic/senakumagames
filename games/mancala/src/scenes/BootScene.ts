import Phaser from 'phaser';

const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", system-ui, sans-serif';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#ffeef5');
    this.add
      .text(480, 240, 'よみこみちゅう…', {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#c06a7a',
      })
      .setOrigin(0.5);
    const barBg = this.add.graphics();
    barBg.fillStyle(0xffffff, 1).fillRoundedRect(300, 278, 360, 22, 11);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0xf299ae, 1).fillRoundedRect(306, 282, 348 * v, 14, 7);
    });

    this.load.image('bg', 'assets/bg.png');
    this.load.image('vignette', 'assets/vignette.png');
    this.load.image('board', 'assets/board.png');
    this.load.image('glow', 'assets/glow.png');
    this.load.image('sparkle', 'assets/sparkle.png');
    this.load.image('potato', 'assets/potato.png');
    this.load.image('senakuma', 'assets/player.png');
    this.load.image('senakuma_wink', 'assets/player_jump.png');
    this.load.image('face_cry', 'assets/face_cry.png');
    this.load.image('face_laugh', 'assets/face_laugh.png');
  }

  create(): void {
    this.scene.start('Game');
  }
}
