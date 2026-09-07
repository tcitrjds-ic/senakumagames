import Phaser from 'phaser';
import { AudioBox } from '../audio';
import { FONT, W, H, addCornerButtons, courseTitleStyle, pillButton } from '../ui';

/** 城の外観。玄関の扉をタップすると城内ホールへ */
export class OutsideScene extends Phaser.Scene {
  private entering = false;

  constructor() {
    super('Outside');
  }

  create(): void {
    this.entering = false;
    this.add.image(W / 2, H / 2, 'outside').setDisplaySize(W, H);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // タイトル
    this.add.text(W / 2, 54, 'せなくま美術館', courseTitleStyle(50)).setOrigin(0.5).setDepth(30);
    this.add
      .text(W / 2, 100, '〜 おしろの なかに 絵が かざってあるよ 〜', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fffaf0',
        stroke: '#4a2a10',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);

    // 玄関の扉（光って知らせる）
    const doorX = W / 2;
    const doorY = 356;
    const glow = this.add.image(doorX, doorY, 'glow').setDepth(5).setScale(0.9).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.15, scale: 0.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const hint = this.add
      .text(doorX, 300, '▼ とびらを タップ', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#fff6dc', stroke: '#4a2a10', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(31);
    this.tweens.add({ targets: hint, y: 294, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const zone = this.add.zone(doorX, doorY, 70, 90).setDepth(40).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.enter());

    // せなくま（橋のたもとで案内）
    const guide = this.add.image(330, 470, 'senakuma').setDepth(20);
    guide.setDisplaySize(guide.width * (120 / guide.height), 120);
    this.tweens.add({ targets: guide, y: 462, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    pillButton(this, W / 2, 496, 250, 52, 'おしろに はいる', () => this.enter());
    addCornerButtons(this);
  }

  private enter(): void {
    if (this.entering) return;
    this.entering = true;
    AudioBox.play('door');
    AudioBox.startMusic();
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Foyer', { floor: 0 });
    });
  }
}
