import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';

/**
 * アセット読み込みシーン。
 * player.png / player_jump.png を差し替えるだけでキャラクターが置き換わる。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#ffeef5');
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'よみこみちゅう…', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: '#c06a7a',
      })
      .setOrigin(0.5);

    const barBg = this.add.graphics();
    barBg.fillStyle(0xffffff, 1).fillRoundedRect(GAME_WIDTH / 2 - 180, GAME_HEIGHT / 2 + 8, 360, 22, 11);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0xf299ae, 1).fillRoundedRect(GAME_WIDTH / 2 - 174, GAME_HEIGHT / 2 + 12, 348 * v, 14, 7);
    });

    this.load.image('sky', 'assets/sky.png');
    this.load.image('sun', 'assets/sun.png');
    this.load.image('hills_far', 'assets/hills_far.png');
    this.load.image('hills_near', 'assets/hills_near.png');
    this.load.image('cloud', 'assets/cloud.png');
    this.load.image('ground', 'assets/ground.png');
    this.load.image('potato', 'assets/potato.png');
    this.load.image('rock', 'assets/rock.png');
    this.load.image('sparkle', 'assets/sparkle.png');
    this.load.image('dust', 'assets/dust.png');
    this.load.image('player', 'assets/player.png');
    this.load.image('player_jump', 'assets/player_jump.png');
    this.load.image('face_cry', 'assets/face_cry.png');
    this.load.image('face_laugh', 'assets/face_laugh.png');
  }

  create(): void {
    this.scene.start('Title');
  }
}
