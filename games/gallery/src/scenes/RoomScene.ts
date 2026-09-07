import Phaser from 'phaser';
import { AudioBox } from '../audio';
import { FONT, W, H, addCornerButtons, signboard, pillButton, courseTitleStyle } from '../ui';
import { attachRipple, type RipplePostFX } from '../ripple';
import type { Painting, Room } from '../manifest';

/** 額縁テクスチャ（frame.png 256px）の縁の太さ */
const FRAME_BORDER = 40;
/** 壁に掛かっているときの額縁の縮尺（縁が 20px 相当になる） */
const WALL_FRAME_SCALE = 0.5;
/** 壁に掛けるときのキャンバス最大サイズ */
const WALL_MAX = { w: 168, h: 126 };
/** 拡大表示のキャンバス最大サイズ */
const ZOOM_MAX = { w: 780, h: 380 };
const WALL_Y = 196;

type ViewerState = 'closed' | 'zooming' | 'zoomed' | 'titled' | 'laughed';

interface Hung {
  painting: Painting;
  x: number;
  y: number;
  innerW: number;
  innerH: number;
  textureKey: string;
  image: Phaser.GameObjects.Image;
  fx?: RipplePostFX;
}

/** 絵画の部屋。額をタップ → 拡大 → 題名 → 笑い声 → 閉じる */
export class RoomScene extends Phaser.Scene {
  private roomIndex = 0;
  private floor = 0;
  private room!: Room;
  private state: ViewerState = 'closed';
  private overlay?: Phaser.GameObjects.Container;
  private zoomed?: Phaser.GameObjects.Container;
  private zoomedImage?: Phaser.GameObjects.Image;
  private zoomedFx?: RipplePostFX;
  private titleBand?: Phaser.GameObjects.Container;
  private laughFace?: Phaser.GameObjects.Image;
  private current?: Hung;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fxTimers: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('Room');
  }

  init(data: { roomIndex?: number; floor?: number }): void {
    this.roomIndex = data?.roomIndex ?? 0;
    this.floor = data?.floor ?? 0;
    this.state = 'closed';
    this.overlay = undefined;
    this.zoomed = undefined;
    this.titleBand = undefined;
    this.laughFace = undefined;
    this.current = undefined;
    this.fxTimers = [];
  }

  create(): void {
    const rooms = this.registry.get('rooms') as Room[];
    this.room = rooms[this.roomIndex] ?? { name: 'へや', paintings: [] };
    const missing = (this.registry.get('missing') as Set<string> | undefined) ?? new Set<string>();

    this.add.image(W / 2, H / 2, 'room').setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(90).setAlpha(0.45);
    this.cameras.main.fadeIn(450, 0, 0, 0);

    signboard(this, W / 2, 34, this.room.name, 18, 30);

    const n = this.room.paintings.length;
    const xs = n >= 3 ? [250, 480, 710] : n === 2 ? [365, 595] : [480];
    this.room.paintings.slice(0, 3).forEach((p, i) => this.hang(p, xs[i], WALL_Y, missing));
    if (n === 0) {
      this.add
        .text(W / 2, WALL_Y, 'このへやには まだ 絵が ありません', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#6b4632' })
        .setOrigin(0.5);
    }

    this.sparkles = this.add
      .particles(0, 0, 'sparkle', {
        speed: { min: 90, max: 260 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 360 },
        lifespan: 600,
        gravityY: 200,
        tint: [0xfff1a8, 0xffffff, 0xffd166],
        emitting: false,
      })
      .setDepth(130);

    pillButton(this, 120, H - 40, 190, 44, '← ホールへ もどる', () => this.back(), 0x8a5a30, 0x5a3a1c, 18);
    addCornerButtons(this);
  }

  /** キャンバスを最大サイズに収める（縦横比維持） */
  private fit(w: number, h: number, max: { w: number; h: number }): { w: number; h: number } {
    const s = Math.min(max.w / w, max.h / h);
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }

  private hang(p: Painting, x: number, y: number, missing: Set<string>): void {
    const has = !!p.image && !missing.has(p.key) && this.textures.exists(p.key);
    const key = has ? p.key : 'placeholder';
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const inner = this.fit(src.width, src.height, WALL_MAX);
    const border = FRAME_BORDER * WALL_FRAME_SCALE;

    // 壁の影 → 黒い裏板 → 絵 → 額縁
    this.add.rectangle(x + 4, y + 8, inner.w + border * 2, inner.h + border * 2, 0x000000, 0.28).setDepth(9);
    this.add.rectangle(x, y, inner.w, inner.h, 0x0a0806, 1).setDepth(10);
    const image = this.add.image(x, y, key).setDisplaySize(inner.w, inner.h).setDepth(11);
    const fx = attachRipple(image);
    if (fx) fx.idle = 0;
    this.add
      .nineslice(x, y, 'frame', undefined, (inner.w + border * 2) / WALL_FRAME_SCALE, (inner.h + border * 2) / WALL_FRAME_SCALE, FRAME_BORDER, FRAME_BORDER, FRAME_BORDER, FRAME_BORDER)
      .setScale(WALL_FRAME_SCALE)
      .setDepth(12);
    if (!has) {
      this.add
        .text(x, y, `No.${p.no}\nじゅんびちゅう`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#a08a6a', align: 'center' })
        .setOrigin(0.5)
        .setDepth(12);
    }
    // 額の下の番号プレート
    const plate = this.add.graphics().setDepth(12);
    const py = y + inner.h / 2 + border + 14;
    plate.fillStyle(0x9a7230, 1).fillRoundedRect(x - 26, py - 9, 52, 18, 4);
    plate.fillStyle(0xe8c56a, 1).fillRoundedRect(x - 24, py - 8, 48, 14, 3);
    this.add.text(x, py - 1, `No.${p.no}`, { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#5a3a10' }).setOrigin(0.5).setDepth(13);

    const hung: Hung = { painting: p, x, y, innerW: inner.w, innerH: inner.h, textureKey: key, image, fx };
    const zone = this.add.zone(x, y, inner.w + border * 2, inner.h + border * 2).setDepth(15).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (fx) this.tweens.add({ targets: fx, idle: 1, duration: 300 });
    });
    zone.on('pointerout', () => {
      if (fx) this.tweens.add({ targets: fx, idle: 0, duration: 300 });
    });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.open(hung, pointer));
  }

  // ------------------------------------------------------------------
  // ビューア（拡大 → 題名 → 笑い声 → 閉じる）
  // ------------------------------------------------------------------
  private burst(fx: RipplePostFX | undefined, u: number, v: number, amp: number, seconds: number): void {
    if (!fx) return;
    fx.cx = u;
    fx.cy = v;
    fx.amp = amp;
    fx.time = 0;
    const tw = this.tweens.add({ targets: fx, time: seconds, duration: seconds * 1000, ease: 'Linear', onComplete: () => (fx.amp = 0) });
    this.fxTimers.push(tw);
  }

  private open(h: Hung, pointer: Phaser.Input.Pointer): void {
    if (this.state !== 'closed') return;
    this.state = 'zooming';
    this.current = h;
    AudioBox.play('warp');

    // 触れた場所から波紋が広がる（マリオ64の絵に飛び込む演出）
    const u = Phaser.Math.Clamp((pointer.worldX - (h.x - h.innerW / 2)) / h.innerW, 0, 1);
    const v = Phaser.Math.Clamp((pointer.worldY - (h.y - h.innerH / 2)) / h.innerH, 0, 1);
    this.burst(h.fx, u, v, 0.05, 2.2);
    this.sparkles.explode(18, pointer.worldX, pointer.worldY);

    const overlay = this.add.container(0, 0).setDepth(100);
    this.overlay = overlay;
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    overlay.add(backdrop);
    backdrop.on('pointerdown', (p: Phaser.Input.Pointer) => this.tap(p));
    this.tweens.add({ targets: backdrop, fillAlpha: 0.86, duration: 500, delay: 250 });

    // 拡大用のクローン（額つき）を壁の位置から中央へ
    const big = this.fit(h.innerW, h.innerH, ZOOM_MAX);
    const s0 = h.innerW / big.w;
    const cont = this.add.container(h.x, h.y).setDepth(110).setScale(s0);
    const back = this.add.rectangle(0, 0, big.w, big.h, 0x0a0806, 1);
    const img = this.add.image(0, 0, h.textureKey).setDisplaySize(big.w, big.h);
    const frame = this.add.nineslice(0, 0, 'frame', undefined, big.w + FRAME_BORDER * 2, big.h + FRAME_BORDER * 2, FRAME_BORDER, FRAME_BORDER, FRAME_BORDER, FRAME_BORDER);
    cont.add([back, img, frame]);
    this.zoomed = cont;
    this.zoomedImage = img;
    this.zoomedFx = attachRipple(img);
    this.burst(this.zoomedFx, u, v, 0.05, 2.6);

    const targetY = H / 2 - 8;
    this.tweens.add({
      targets: cont,
      x: W / 2,
      y: targetY,
      scale: 1,
      duration: 700,
      delay: 250,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.state = 'zoomed';
        this.hint('タップすると だいめいが でるよ');
      },
    });

    // 閉じるボタン
    const close = this.add.circle(W - 36, 36, 24, 0xfff8e8, 0.95).setStrokeStyle(3, 0xd8b45a).setInteractive({ useHandCursor: true });
    const closeText = this.add.text(W - 36, 36, '✕', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#7a5a2a' }).setOrigin(0.5);
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.close();
    });
    overlay.add([close, closeText]);
    overlay.setDepth(100);
    close.setDepth(140);
  }

  private hintText?: Phaser.GameObjects.Text;

  private hint(msg: string): void {
    this.hintText?.destroy();
    const t = this.add
      .text(W / 2, H - 28, msg, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#fff6dc', stroke: '#2a1a0a', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(135)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 300 });
    this.tweens.add({ targets: t, alpha: 0.5, duration: 700, yoyo: true, repeat: -1, delay: 300 });
    this.hintText = t;
  }

  private tap(pointer: Phaser.Input.Pointer): void {
    switch (this.state) {
      case 'zoomed':
        this.showTitle();
        break;
      case 'titled':
        this.laugh();
        break;
      case 'laughed':
        this.close();
        break;
      default:
        // ズーム中は波紋だけ追加
        if (this.zoomedFx && this.zoomed) {
          const b = this.zoomedImage!.getBounds();
          this.burst(this.zoomedFx, (pointer.worldX - b.x) / b.width, (pointer.worldY - b.y) / b.height, 0.03, 1.5);
        }
    }
  }

  private showTitle(): void {
    if (!this.current || !this.overlay) return;
    this.state = 'titled';
    AudioBox.play('chime');
    const p = this.current.painting;
    const title = p.title?.trim() || (p.image ? '（むだい）' : 'じゅんびちゅう');

    const band = this.add.container(W / 2, H / 2 + 20).setDepth(120).setScale(0.6).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.72).fillRect(-W / 2, -70, W, 140);
    g.lineStyle(3, 0xe8c56a, 1);
    g.lineBetween(-W / 2, -70, W / 2, -70);
    g.lineBetween(-W / 2, 70, W / 2, 70);
    const no = this.add.text(0, -40, `COURSE ${p.no}`, courseTitleStyle(22)).setOrigin(0.5);
    const t = this.add.text(0, 14, title, { ...courseTitleStyle(44), wordWrap: { width: 860 } }).setOrigin(0.5);
    if (t.height > 90) t.setFontSize(30);
    const starL = this.add.image(-t.width / 2 - 40, 14, 'star').setScale(0.3);
    const starR = this.add.image(t.width / 2 + 40, 14, 'star').setScale(0.3);
    band.add([g, no, t, starL, starR]);
    this.titleBand = band;
    this.tweens.add({ targets: band, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [starL, starR], angle: 360, duration: 4000, repeat: -1 });
    this.sparkles.explode(24, W / 2, H / 2 + 20);
    this.hint(p.laugh ? 'もういちど タップすると…？' : 'タップして とじる');
  }

  private laugh(): void {
    if (!this.current) return;
    this.state = 'laughed';
    const p = this.current.painting;
    if (p.laugh) {
      AudioBox.clip(`assets/paintings/${p.laugh}`);
    } else {
      AudioBox.play('pop');
    }

    // せなくまの笑い顔カットインが飛び出す
    const face = this.add.image(W - 130, H + 140, 'face_laugh').setDepth(125).setDisplaySize(230, 230).setAngle(-8);
    this.laughFace = face;
    this.tweens.add({ targets: face, y: H - 120, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: face, angle: 8, duration: 160, yoyo: true, repeat: -1, delay: 400, ease: 'Sine.easeInOut' });

    // 絵がぷるぷる揺れる
    if (this.zoomed) {
      const cx = this.zoomed.x;
      this.tweens.add({ targets: this.zoomed, x: cx + 7, duration: 60, yoyo: true, repeat: 9, onComplete: () => this.zoomed?.setX(cx) });
    }
    if (this.zoomedFx) this.burst(this.zoomedFx, 0.5, 0.5, 0.04, 2);

    // 「ｗｗｗ」が浮かび上がる
    for (let i = 0; i < 7; i++) {
      const x = 120 + Math.random() * (W - 240);
      const y = H / 2 + 120 + Math.random() * 60;
      const t = this.add
        .text(x, y, i % 2 ? 'ｗｗｗ' : 'あはは', { fontFamily: FONT, fontSize: `${22 + Math.random() * 16}px`, fontStyle: 'bold', color: '#fff6dc', stroke: '#4a2a10', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(126)
        .setAlpha(0);
      this.tweens.add({ targets: t, y: y - 160 - Math.random() * 80, alpha: { from: 1, to: 0 }, angle: (Math.random() - 0.5) * 30, delay: i * 140, duration: 1600, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    }
    this.sparkles.explode(30, W / 2, H / 2);
    this.hint(p.laugh ? 'タップして とじる' : '（わらいごえは まだ じゅんびちゅう）タップして とじる');
  }

  private close(): void {
    if (this.state === 'closed' || this.state === 'zooming') return;
    this.state = 'zooming';
    AudioBox.stopClip();
    AudioBox.play('back');
    this.hintText?.destroy();
    this.hintText = undefined;
    const h = this.current;
    const cont = this.zoomed;
    const overlay = this.overlay;
    const band = this.titleBand;
    const face = this.laughFace;
    if (band) this.tweens.add({ targets: band, alpha: 0, scale: 0.8, duration: 200, onComplete: () => band.destroy() });
    if (face) this.tweens.add({ targets: face, y: H + 160, duration: 300, ease: 'Back.easeIn', onComplete: () => face.destroy() });
    if (overlay) this.tweens.add({ targets: overlay.list, fillAlpha: 0, alpha: 0, duration: 380 });
    if (cont && h) {
      const s0 = h.innerW / (this.zoomedImage?.displayWidth ?? h.innerW);
      this.tweens.add({
        targets: cont,
        x: h.x,
        y: h.y,
        scale: s0,
        duration: 420,
        ease: 'Cubic.easeInOut',
        onComplete: () => this.finishClose(),
      });
    } else {
      this.finishClose();
    }
  }

  private finishClose(): void {
    this.zoomed?.destroy();
    this.overlay?.destroy();
    this.zoomed = undefined;
    this.zoomedImage = undefined;
    this.zoomedFx = undefined;
    this.overlay = undefined;
    this.titleBand = undefined;
    this.laughFace = undefined;
    this.current = undefined;
    this.state = 'closed';
  }

  private back(): void {
    if (this.state !== 'closed') {
      this.close();
      return;
    }
    AudioBox.stopClip();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Foyer', { floor: this.floor }));
  }
}
