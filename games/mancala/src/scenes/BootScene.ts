import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.add
      .text(480, 270, 'よみこみちゅう…', {
        fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif',
        fontSize: '28px',
        color: '#8a6d5c',
      })
      .setOrigin(0.5);

    this.load.image('senakuma', 'assets/player.png');
    this.load.image('senakuma_wink', 'assets/player_jump.png');
    this.load.image('face_cry', 'assets/face_cry.png');
    this.load.image('face_laugh', 'assets/face_laugh.png');
    this.load.image('potato', 'assets/potato.png');
  }

  create(): void {
    this.scene.start('Game');
  }
}
