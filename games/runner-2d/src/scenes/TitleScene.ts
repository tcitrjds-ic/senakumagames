import Phaser from 'phaser';
import {
  GAME_WIDTH,
  FLOOR_TOP,
  PLAYER_HEIGHT,
  FONT_FAMILY,
  loadHighScore,
} from '../constants';
import { AudioBox, addMuteButton } from '../audio';
import { buildBackground, pillButton, fadeStart } from '../ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    buildBackground(this);
    this.cameras.main.fadeIn(280, 255, 238, 245);

    // タイトルのアンビエント: ポテトがゆっくり降る
    this.add.particles(0, 0, 'potato', {
      x: { min: 0, max: GAME_WIDTH },
      y: -40,
      speedY: { min: 35, max: 70 },
      speedX: { min: -12, max: 12 },
      scale: { min: 0.14, max: 0.22 },
      alpha: 0.55,
      rotate: { min: -40, max: 40 },
      lifespan: 12000,
      frequency: 900,
    });

    this.add.image(GAME_WIDTH / 2, FLOOR_TOP + 8, 'shadow').setAlpha(0.4);
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

    // デザインロゴ: 1文字ずつ色を変えてアーチ状に並べ、波打たせる
    const chars = ['せ', 'な', 'く', 'ま', 'ラ', 'ン'];
    const colors = ['#ff8fa8', '#ffb85c', '#8fd177', '#7ec3f0', '#c39bf0', '#ff8fa8'];
    const spacing = 88;
    const startX = GAME_WIDTH / 2 - (spacing * (chars.length - 1)) / 2;
    chars.forEach((ch, i) => {
      const arcY = 170 - Math.sin((i / (chars.length - 1)) * Math.PI) * 16;
      const t = this.add
        .text(startX + i * spacing, arcY, ch, {
          fontFamily: FONT_FAMILY, fontSize: '86px', fontStyle: 'bold', color: colors[i],
        })
        .setOrigin(0.5)
        .setStroke('#ffffff', 14)
        .setShadow(0, 6, '#d4607a44', 6, false, true)
        .setAngle(i % 2 === 0 ? -3 : 3)
        .setScale(0);
      this.tweens.add({ targets: t, scale: 1, duration: 420, delay: i * 60, ease: 'Back.easeOut' });
      this.tweens.add({
        targets: t,
        y: arcY - 8,
        duration: 900,
        delay: i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    const logoPotato = this.add.image(GAME_WIDTH / 2 + 296, 136, 'potato').setScale(0.6).setAngle(14);
    this.tweens.add({
      targets: logoPotato,
      angle: 26,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 236, '— ポテトをあつめて はしりつづけよう —', {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: '#a97c8c',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 6);

    const start = (): void => {
      AudioBox.startMusic();
      fadeStart(this, 'Game');
    };
    pillButton(this, GAME_WIDTH / 2, 318, 340, 72, 'タップで スタート！', start);
    this.input.keyboard?.once('keydown-SPACE', () => {
      AudioBox.play('click');
      start();
    });

    this.add
      .text(GAME_WIDTH / 2, 372, 'タップ＝ジャンプ ／ 2かいタップで 2だんジャンプ', {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: '#7d95ab',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5);

    const best = loadHighScore();
    if (best > 0) {
      const badge = this.add.container(GAME_WIDTH / 2, 44);
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
