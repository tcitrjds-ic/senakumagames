import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_HEIGHT,
  FLOOR_TOP,
  PLAYER_HEIGHT,
  FONT_FAMILY,
  loadHighScore,
} from '../constants';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.add.tileSprite(GAME_WIDTH / 2, 130, GAME_WIDTH, 128, 'cloud').setAlpha(0.9);
    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT, 'ground');

    const player = this.add.image(GAME_WIDTH / 2, FLOOR_TOP - PLAYER_HEIGHT / 2, 'player');
    player.setScale(PLAYER_HEIGHT / player.height);
    this.tweens.add({
      targets: player,
      y: player.y - 14,
      angle: { from: -3, to: 3 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 190, 'せなくまラン', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#8a5a44',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 10)
      .setShadow(0, 4, '#00000022', 6, false, true);

    this.add
      .image(GAME_WIDTH / 2 + 250, 175, 'potato')
      .setScale(0.55)
      .setAngle(12);

    const start = this.add
      .text(GAME_WIDTH / 2, 300, 'タップ / スペース で スタート！', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        color: '#5b8a3c',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 8);
    this.tweens.add({
      targets: start,
      alpha: 0.35,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const best = loadHighScore();
    if (best > 0) {
      this.add
        .text(GAME_WIDTH / 2, 350, `ハイスコア 🍟×${best}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '22px',
          color: '#b8860b',
        })
        .setOrigin(0.5)
        .setStroke('#ffffff', 6);
    }

    this.input.once('pointerdown', () => this.scene.start('Game'));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
  }
}
