import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';

interface GameOverData {
  score: number;
  best: number;
  isNewBest: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x553a2e, 0.55)
      .setOrigin(0.5);

    const player = this.add.image(GAME_WIDTH / 2, 150, 'face_laugh');
    player.setScale(170 / player.height).setAngle(8);
    this.tweens.add({
      targets: player,
      angle: -8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 260, 'おつかれさま！', {
        fontFamily: FONT_FAMILY,
        fontSize: '54px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#8a5a44', 10);

    const potato = this.add.image(GAME_WIDTH / 2 - 90, 330, 'potato').setScale(0.4);
    this.add
      .text(potato.x + 30, 330, `× ${data.score}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffe9a8',
      })
      .setOrigin(0, 0.5)
      .setStroke('#8a5a44', 8);

    this.add
      .text(
        GAME_WIDTH / 2,
        385,
        data.isNewBest ? '✨ ハイスコア更新！ ✨' : `ハイスコア ${data.best}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          color: data.isNewBest ? '#ffd700' : '#ffffff',
        },
      )
      .setOrigin(0.5)
      .setStroke('#8a5a44', 6);

    const retry = this.add
      .text(GAME_WIDTH / 2, 455, 'タップ / スペース で もういちど！', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#5b8a3c', 8);
    this.tweens.add({
      targets: retry,
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 事故連打ですぐリスタートしないよう、少し待ってから入力を受け付ける
    this.time.delayedCall(400, () => {
      this.input.once('pointerdown', () => this.scene.start('Game'));
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
    });
  }
}
