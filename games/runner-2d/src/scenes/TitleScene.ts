import Phaser from 'phaser';
import {
  GAME_WIDTH,
  FLOOR_TOP,
  PLAYER_HEIGHT,
  FONT_FAMILY,
  loadHighScore,
} from '../constants';
import { AudioBox, addMuteButton } from '../audio';
import { buildBackground, pillButton } from '../ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    buildBackground(this);

    const player = this.add.image(GAME_WIDTH / 2, FLOOR_TOP - PLAYER_HEIGHT / 2 + 4, 'player');
    player.setScale(PLAYER_HEIGHT / player.height);
    this.tweens.add({
      targets: player,
      y: player.y - 12,
      angle: { from: -2.5, to: 2.5 },
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ロゴ（影 + 本体 + ポテト）
    const logoShadow = this.add
      .text(GAME_WIDTH / 2 + 4, 176, 'せなくまラン', {
        fontFamily: FONT_FAMILY, fontSize: '84px', fontStyle: 'bold', color: '#00000022',
      })
      .setOrigin(0.5);
    const logo = this.add
      .text(GAME_WIDTH / 2, 170, 'せなくまラン', {
        fontFamily: FONT_FAMILY, fontSize: '84px', fontStyle: 'bold', color: '#ff8fa8',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 14)
      .setShadow(0, 5, '#d4607a55', 8, false, true);
    const logoPotato = this.add.image(GAME_WIDTH / 2 + 292, 148, 'potato').setScale(0.62).setAngle(14);
    this.tweens.add({
      targets: logoPotato,
      angle: 26,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    for (const t of [logo, logoShadow]) t.setScale(0);
    this.tweens.add({ targets: [logo, logoShadow], scale: 1, duration: 450, ease: 'Back.easeOut' });

    this.add
      .text(GAME_WIDTH / 2, 236, '— ポテトをあつめて はしりつづけよう —', {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: '#a97c8c',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 6);

    const start = (): void => {
      AudioBox.startMusic();
      this.scene.start('Game');
    };
    pillButton(this, GAME_WIDTH / 2, 318, 340, 72, 'タップで スタート！', start);
    this.input.keyboard?.once('keydown-SPACE', () => {
      AudioBox.play('click');
      start();
    });

    const best = loadHighScore();
    if (best > 0) {
      const badge = this.add.container(GAME_WIDTH / 2, 384);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.9).fillRoundedRect(-120, -22, 240, 44, 22);
      g.lineStyle(3, 0xf5cf6e).strokeRoundedRect(-120, -22, 240, 44, 22);
      const icon = this.add.image(-86, 0, 'potato').setScale(0.26);
      const label = this.add
        .text(10, 0, `ハイスコア × ${best}`, {
          fontFamily: FONT_FAMILY, fontSize: '22px', fontStyle: 'bold', color: '#c99b2e',
        })
        .setOrigin(0.5);
      badge.add([g, icon, label]);
    }

    this.add
      .text(12, 526, '非公式ファンメイド / 画像は許諾を得て使用', {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: '#b08c96',
      })
      .setOrigin(0, 1)
      .setAlpha(0.9);

    addMuteButton(this, GAME_WIDTH - 36, 36);

    // 画面のどこをタップしてもスタートできる（ボタン類はstopPropagationで除外される）
    this.input.once('pointerdown', () => {
      AudioBox.play('click');
      start();
    });
  }
}
