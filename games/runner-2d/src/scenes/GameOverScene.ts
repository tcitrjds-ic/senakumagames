import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';
import { AudioBox, addMuteButton } from '../audio';
import { buildBackground, pillButton } from '../ui';

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
    buildBackground(this);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x553a2e, 0.45);

    // リザルトカード
    const card = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30).setDepth(50);
    const g = this.add.graphics();
    g.fillStyle(0x8a5a44, 0.35).fillRoundedRect(-250, -162, 500, 352, 30);
    g.fillStyle(0xfffdf8, 1).fillRoundedRect(-245, -170, 490, 348, 30);
    g.lineStyle(5, 0xf0b7c8).strokeRoundedRect(-245, -170, 490, 348, 30);
    card.add(g);

    const title = this.add
      .text(0, -100, 'おつかれさま！', {
        fontFamily: FONT_FAMILY, fontSize: '42px', fontStyle: 'bold', color: '#8a5a44',
      })
      .setOrigin(0.5);
    const potato = this.add.image(-72, -38, 'potato').setScale(0.4);
    const score = this.add
      .text(-30, -38, `× ${data.score}`, {
        fontFamily: FONT_FAMILY, fontSize: '40px', fontStyle: 'bold', color: '#e2504d',
      })
      .setOrigin(0, 0.5);
    const bestLine = this.add
      .text(0, 18, data.isNewBest ? '✨ ハイスコア更新！ ✨' : `ハイスコア ${data.best}`, {
        fontFamily: FONT_FAMILY, fontSize: '24px', fontStyle: 'bold',
        color: data.isNewBest ? '#e5a715' : '#a97c8c',
      })
      .setOrigin(0.5);
    card.add([title, potato, score, bestLine]);

    // 笑い顔カットイン（カード上端に重ねる）
    const face = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, 'face_laugh').setDepth(51).setScale(0);
    this.tweens.add({
      targets: face,
      scale: 130 / face.height,
      angle: { from: -10, to: -4 },
      duration: 420,
      ease: 'Back.easeOut',
    });

    pillButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 118, 280, 62, 'もういちど！', () => this.scene.start('Game'));
    const toTitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 176, 'タイトルへもどる', {
        fontFamily: FONT_FAMILY, fontSize: '19px', color: '#a97c8c',
      })
      .setOrigin(0.5)
      .setDepth(55);
    toTitle.setInteractive({ useHandCursor: true });
    toTitle.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      AudioBox.play('click');
      this.scene.start('Title');
    });

    addMuteButton(this, GAME_WIDTH - 36, 36);

    AudioBox.play(data.isNewBest ? 'win' : 'lose');
    if (data.isNewBest) {
      const confetti = this.add.particles(0, 0, 'sparkle', {
        x: { min: 0, max: GAME_WIDTH },
        y: -30,
        speedY: { min: 120, max: 260 },
        speedX: { min: -40, max: 40 },
        scale: { start: 0.5, end: 0.1 },
        rotate: { min: 0, max: 360 },
        lifespan: 2400,
        frequency: 60,
      }).setDepth(60);
      this.time.delayedCall(2200, () => confetti.stop());
    }

    // 少し待ってから、画面のどこをタップしてもリトライできるように
    this.time.delayedCall(600, () => {
      this.input.once('pointerdown', () => this.scene.start('Game'));
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
    });
  }
}
