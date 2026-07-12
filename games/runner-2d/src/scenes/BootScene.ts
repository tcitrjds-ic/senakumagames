import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';

/**
 * アセット読み込みシーン。
 * player.png を本物のせなくまさんの切り抜き画像に差し替えるだけで
 * ゲーム全体のキャラクターが置き換わる。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'よみこみちゅう…', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: '#8a6d5c',
      })
      .setOrigin(0.5);

    this.load.image('player', 'assets/player.png');
    this.load.image('player_jump', 'assets/player_jump.png');
    this.load.image('face_cry', 'assets/face_cry.png');
    this.load.image('face_laugh', 'assets/face_laugh.png');
    this.load.image('potato', 'assets/potato.png');
    this.load.image('rock', 'assets/rock.png');
    this.load.image('cloud', 'assets/cloud.png');
    this.load.image('ground', 'assets/ground.png');
  }

  create(): void {
    this.scene.start('Title');
  }
}
