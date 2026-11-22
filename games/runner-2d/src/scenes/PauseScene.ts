import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';
import { AudioBox, addMuteButton } from '../audio';
import { pillButton, addFullscreenButton, addHomeButton } from '../ui';

/**
 * ポーズ画面。GameScene の上に重ねて起動され、その間 GameScene は丸ごと止まる
 * （物理・タイマー・アニメ・入力がまとめて止まるので、個別に止め忘れることがない）。
 * 再開はカウントダウンを挟む（再開した瞬間に障害物へぶつからないように）。
 */
export class PauseScene extends Phaser.Scene {
  private menu: Phaser.GameObjects.GameObject[] = [];
  private leaving = false;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.leaving = false;
    this.menu = [];
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x553a2e, 0.55);

    const title = this.add
      .text(GAME_WIDTH / 2, 118, 'ポーズ', {
        fontFamily: FONT_FAMILY, fontSize: '52px', fontStyle: 'bold', color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#8a5a44', 10);
    const resume = pillButton(this, GAME_WIDTH / 2, 222, 320, 68, 'つづける', () => this.resumeGame());
    const retry = pillButton(this, GAME_WIDTH / 2, 312, 280, 56, 'さいしょから', () => this.leave('Game'), 0xe8956a, 0xc77347, 24);
    const toTitle = pillButton(this, GAME_WIDTH / 2, 388, 280, 56, 'タイトルへ', () => this.leave('Title'), 0xb59aa6, 0x957a86, 24);
    const hint = this.add
      .text(GAME_WIDTH / 2, 456, 'スペース / P / Esc でも さいかい', {
        fontFamily: FONT_FAMILY, fontSize: '17px', color: '#ffe9d6',
      })
      .setOrigin(0.5);
    this.menu.push(title, resume, retry, toTitle, hint);

    addHomeButton(this, 40, 40);
    addMuteButton(this, GAME_WIDTH - 36, 36);
    addFullscreenButton(this, GAME_WIDTH - 36, 92);

    const kb = this.input.keyboard;
    if (kb) {
      for (const code of ['SPACE', 'ENTER', 'P', 'ESC']) {
        kb.on(`keydown-${code}`, (e: KeyboardEvent) => {
          if (!e.repeat) this.resumeGame();
        });
      }
    }
  }

  /** 3・2・1 と数えてからゲームを再開する */
  private resumeGame(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.menu.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    const count = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, '', {
        fontFamily: FONT_FAMILY, fontSize: '120px', fontStyle: 'bold', color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#8a5a44', 14);
    let n = 3;
    const tick = (): void => {
      if (n === 0) {
        this.scene.resume('Game');
        this.scene.stop();
        return;
      }
      count.setText(String(n));
      AudioBox.play('tick');
      this.tweens.add({ targets: count, scale: { from: 1.3, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      n -= 1;
      this.time.delayedCall(330, tick);
    };
    tick();
  }

  /** ゲームを打ち切って別のシーンへ（さいしょから / タイトルへ） */
  private leave(target: 'Game' | 'Title'): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 255, 238, 245);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (target !== 'Game') this.scene.stop('Game');
      this.scene.start(target); // 自分(Pause)は止まり、target が最初から始まる
    });
  }
}
