import Phaser from 'phaser';
import { AudioBox, addMuteButton } from '../audio';
import { FONT, pillButton, addFullscreenButton, addHomeButton, setupCamera, softShadow, drawPanel, dimmer } from '../ui';
import { W, H, P_STORE, C_STORE, BOARD, BOARD_MARGIN, PIT_R, STORE_R, COLOR, pitPos, isStore, seedSpot } from '../layout';

const SEEDS_PER_PIT = 4;

type Who = 'player' | 'cpu';

interface MoveResult {
  board: number[];
  path: number[];
  captured: number;
  captureFrom?: number;
  captureTo?: number;
  extraTurn: boolean;
}

/** カラハ・ルールで1手を計算する（元の盤面は変更しない） */
export function computeMove(board: number[], pit: number, who: Who): MoveResult {
  const b = board.slice();
  const skip = who === 'player' ? C_STORE : P_STORE;
  const ownStore = who === 'player' ? P_STORE : C_STORE;
  let seeds = b[pit];
  b[pit] = 0;
  let idx = pit;
  const path: number[] = [];
  while (seeds > 0) {
    idx = (idx + 1) % 14;
    if (idx === skip) continue;
    b[idx] += 1;
    path.push(idx);
    seeds -= 1;
  }
  const last = path[path.length - 1];
  const extraTurn = last === ownStore;

  let captured = 0;
  let captureFrom: number | undefined;
  let captureTo: number | undefined;
  const ownSide = who === 'player' ? last >= 0 && last <= 5 : last >= 7 && last <= 12;
  if (!extraTurn && ownSide && b[last] === 1 && b[12 - last] > 0) {
    captured = b[12 - last] + 1;
    b[ownStore] += captured;
    b[last] = 0;
    b[12 - last] = 0;
    captureFrom = 12 - last;
    captureTo = last;
  }
  return { board: b, path, captured, captureFrom, captureTo, extraTurn };
}

export class GameScene extends Phaser.Scene {
  private board: number[] = [];
  private display: number[] = [];
  private busy = true;
  private over = false;
  /** いま選んでいる（光らせている）くぼみ。マウスを乗せた / 指で触れている / キーで選んだ */
  private hovered = -1;
  /** 押している最中のくぼみ。ここで離すと決定、外へずらして離すとキャンセル */
  private armed = -1;
  /** くぼみの上で押し始めたか（指をすべらせて別のくぼみを選び直せるように） */
  private pressing = false;
  /** タイトル・結果画面で Enter / スペースを押したときの動作 */
  private confirmAction?: () => void;
  private pulse = { v: 0 };
  private aiLevel: 0 | 1 | 2 = 1; // よわい / ふつう / つよい
  private cpuMarker?: Phaser.GameObjects.Image;
  /** 着地点を示す光の輪（くぼみ用・ゴール用） */
  private previewRing!: Phaser.GameObjects.Image;
  private previewStoreRing!: Phaser.GameObjects.Image;
  private previewTag!: Phaser.GameObjects.Text;
  private previewTagBg!: Phaser.GameObjects.Graphics;

  private pitZones: Phaser.GameObjects.Ellipse[] = [];
  /** 選べるくぼみのふちを光らせる輪 */
  private rings: Phaser.GameObjects.Image[] = [];
  private seedLayers: Phaser.GameObjects.Container[] = [];
  private countLabels: Phaser.GameObjects.Text[] = [];
  private avatar!: Phaser.GameObjects.Image;
  private bubbleText!: Phaser.GameObjects.Text;
  private turnPill!: Phaser.GameObjects.Graphics;
  private turnLabel!: Phaser.GameObjects.Text;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Game');
  }

  create(): void {
    this.board = Array(14).fill(0);
    for (let i = 0; i < 6; i++) {
      this.board[i] = SEEDS_PER_PIT;
      this.board[i + 7] = SEEDS_PER_PIT;
    }
    this.display = this.board.slice();
    this.busy = true;
    this.over = false;
    this.hovered = -1;
    this.armed = -1;
    this.pressing = false;
    this.confirmAction = undefined;
    this.pulse = { v: 0 };
    this.pitZones = [];
    this.rings = [];
    this.seedLayers = [];
    this.countLabels = [];

    setupCamera(this);
    // テーブル: フェルト → 卓上ライトの明かり（盤のあたりが明るい） → 四隅の落ち込み
    this.add.tileSprite(W / 2, H / 2, W, H, 'felt').setTileScale(0.5);
    this.add
      .image(W / 2, BOARD.y + BOARD.h / 2, 'light')
      .setDisplaySize(W * 1.15, H * 1.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.2);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(90).setTint(0x04120d).setAlpha(1);
    this.cameras.main.fadeIn(320, 12, 33, 27);
    this.buildBoard();
    this.buildHeader();
    this.sparkles = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      rotate: { min: 0, max: 360 },
      lifespan: 500,
      gravityY: 300,
      emitting: false,
    }).setDepth(30);
    this.tweens.add({ targets: this.pulse, v: 1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    for (let i = 0; i < 14; i++) this.refreshPit(i);
    this.setupInput();
    this.showTitleOverlay();
  }

  /** くぼみ以外で指を離したときの後始末と、キーボード操作 */
  private setupInput(): void {
    // くぼみの上で離した場合は、くぼみ側の pointerup が先に処理してから ここに来る
    const release = (): void => {
      this.pressing = false;
      this.armed = -1;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    const kb = this.input.keyboard;
    if (!kb) return;
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    kb.on('keydown-LEFT', () => this.moveSelection(-1));
    kb.on('keydown-RIGHT', () => this.moveSelection(1));
    const confirm = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (this.confirmAction) this.confirmAction();
      else if (this.hovered >= 0) this.onPitClick(this.hovered);
    };
    kb.on('keydown-ENTER', confirm);
    kb.on('keydown-SPACE', confirm);
    // 1〜6 で左から何番目のくぼみかを直接えらぶ（1回目で選択＋プレビュー、同じ数字をもう1回で決定）
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((name, i) => {
      kb.on(`keydown-${name}`, (e: KeyboardEvent) => {
        if (e.repeat || this.busy || this.over || this.confirmAction || this.board[i] === 0) return;
        if (this.hovered === i) this.onPitClick(i);
        else this.select(i);
      });
    });
  }

  /** くぼみを選択状態にして、手のプレビューを出す */
  private select(i: number): void {
    this.hovered = i;
    this.hidePreview();
    this.showPreview(i);
  }

  /** ←→ で、ポテトが入っているくぼみを順にたどる */
  private moveSelection(dir: -1 | 1): void {
    if (this.busy || this.over || this.confirmAction) return;
    let i = this.hovered;
    if (i < 0) i = dir > 0 ? -1 : 6;
    for (let n = 0; n < 6; n++) {
      i = (i + dir + 6) % 6;
      if (this.board[i] > 0) {
        AudioBox.play('tick');
        this.select(i);
        return;
      }
    }
  }

  private buildBoard(): void {
    // 盤（画像は板のまわりに落ち影ぶんの余白を持つ）
    this.add
      .image(BOARD.x - BOARD_MARGIN, BOARD.y - BOARD_MARGIN, 'board')
      .setOrigin(0, 0)
      .setScale(0.5)
      .setDepth(1);

    for (let i = 0; i < 14; i++) {
      const { x, y } = pitPos(i);
      const r = isStore(i) ? STORE_R : PIT_R;
      const pit = this.add.ellipse(x, y, r.x * 2 + 14, r.y * 2 + 14, 0xffffff, 0).setDepth(4);
      if (i <= 5) {
        this.rings[i] = this.addRing(x, y, 'ring_pit', COLOR.gold);
        pit.setInteractive({ useHandCursor: true });
        // 押した瞬間ではなく「離したとき」に決定する。
        // スマホでも 触れる→結果のプレビューを見る→離して決定 / 外へずらしてキャンセル ができる
        pit.on('pointerover', () => {
          this.select(i);
          if (this.pressing) this.armed = i; // 押したまま別のくぼみへすべらせたら選び直し
        });
        pit.on('pointerout', () => {
          if (this.hovered === i) this.hovered = -1;
          if (this.armed === i) this.armed = -1;
          this.hidePreview();
        });
        pit.on('pointerdown', () => {
          this.pressing = true;
          this.armed = i;
          this.select(i);
        });
        pit.on('pointerup', () => {
          if (this.armed === i) this.onPitClick(i);
        });
      }
      this.pitZones[i] = pit;
      this.seedLayers[i] = this.add.container(x, y).setDepth(5);
      this.countLabels[i] = this.addCountBadge(i, x, y);
    }

    this.addNamePlate(pitPos(C_STORE).x, pitPos(C_STORE).y - STORE_R.y - 19, 'せなくま', COLOR.rose);
    this.addNamePlate(pitPos(P_STORE).x, pitPos(P_STORE).y - STORE_R.y - 19, 'あなた', COLOR.green);
    // まく向き（反時計まわり）の矢印は、盤そのものに彫ってある

    // 手のプレビュー（最後のポテトの着地点と結果を、決める前に見せる）
    this.previewRing = this.addRing(0, 0, 'ring_pit', COLOR.mint).setVisible(false);
    this.previewStoreRing = this.addRing(0, 0, 'ring_store', COLOR.mint).setVisible(false);
    this.previewTagBg = this.add.graphics().setDepth(31).setVisible(false);
    this.previewTag = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(32)
      .setVisible(false);
  }

  /** くぼみのふちに沿って光る輪。加算合成で、木の上に明かりが乗ったように見せる */
  private addRing(x: number, y: number, key: 'ring_pit' | 'ring_store', tint: number): Phaser.GameObjects.Image {
    return this.add
      .image(x, y, key)
      .setScale(0.5)
      .setDepth(3)
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
  }

  /** 個数を示す象牙色の丸い札。くぼみは外側（自分の列は下、せなくまの列は上）、ゴールは下に置く */
  private addCountBadge(i: number, x: number, y: number): Phaser.GameObjects.Text {
    const store = isStore(i);
    const by = store ? y + STORE_R.y + 19 : i <= 5 ? y + PIT_R.y + 13 : y - PIT_R.y - 13;
    const r = store ? 15 : 10;
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x2c1a0c, 0.38).fillCircle(x + 0.8, by + 1.8, r + 0.6);
    g.fillStyle(COLOR.ivory, 1).fillCircle(x, by, r);
    g.lineStyle(1.5, COLOR.line, 1).strokeCircle(x, by, r);
    return this.add
      .text(x, by, '', {
        fontFamily: FONT,
        fontSize: store ? '19px' : '13px',
        fontStyle: 'bold',
        color: COLOR.brownText,
      })
      .setOrigin(0.5)
      .setDepth(7);
  }

  /** ゴールの上に置く名札 */
  private addNamePlate(x: number, y: number, label: string, color: number): void {
    const t = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(7);
    const w = t.width + 20;
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x2c1a0c, 0.35).fillRoundedRect(x - w / 2 + 0.8, y - 10 + 1.8, w, 20, 10);
    g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - 10, w, 20, 10);
    g.lineStyle(1.2, 0xffffff, 0.35).strokeRoundedRect(x - w / 2 + 1.5, y - 8.5, w - 3, 17, 8.5);
  }

  private showPreview(i: number): void {
    if (this.busy || this.over || this.confirmAction || this.board[i] === 0) return;
    const r = computeMove(this.board, i, 'player');
    const last = r.path[r.path.length - 1];
    const pos = pitPos(last);
    const store = isStore(last);
    (store ? this.previewStoreRing : this.previewRing).setPosition(pos.x, pos.y).setVisible(true).setAlpha(0.95);
    let label = '';
    let color: number = COLOR.green;
    if (r.extraTurn) {
      label = 'もういっかい！';
    } else if (r.captured > 0) {
      label = `よこどり ${r.captured}こ！`;
      color = COLOR.rose;
    } else {
      return;
    }
    // 結果の札: くぼみならすぐ上に、ゴールなら名札の位置に重ねて出す
    const ty = store ? pos.y - STORE_R.y - 19 : pos.y - PIT_R.y - 22;
    this.previewTag.setText(label).setPosition(pos.x, ty).setVisible(true);
    const w = this.previewTag.width + 22;
    this.previewTagBg.clear().setVisible(true);
    this.previewTagBg.fillStyle(0x06140f, 0.32).fillRoundedRect(pos.x - w / 2 + 1, ty - 13 + 3, w, 26, 13);
    this.previewTagBg.fillStyle(color, 1).fillRoundedRect(pos.x - w / 2, ty - 13, w, 26, 13);
    this.previewTagBg.lineStyle(1.5, 0xffffff, 0.5).strokeRoundedRect(pos.x - w / 2 + 1.5, ty - 11.5, w - 3, 23, 11.5);
  }

  private hidePreview(): void {
    this.previewRing.setVisible(false);
    this.previewStoreRing.setVisible(false);
    this.previewTag.setVisible(false);
    this.previewTagBg.setVisible(false);
  }

  private buildHeader(): void {
    // アバターカード
    softShadow(this, 20, 20, 158, 158, 4);
    const g = this.add.graphics().setDepth(5);
    drawPanel(g, 20, 20, 158, 158, 22);
    this.avatar = this.add.image(99, 88, 'senakuma').setDepth(6);
    this.fitAvatar();
    // 名札は切り抜き画像の下端（y=147）にかぶせて、切り口を隠す
    g.fillStyle(COLOR.rose, 1).fillRoundedRect(44, 143, 110, 28, 14);
    g.lineStyle(1.2, 0xffffff, 0.4).strokeRoundedRect(45.5, 144.5, 107, 25, 12.5);
    this.add
      .text(99, 157, 'せなくま', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(6);

    // 吹き出し（しっぽはアバターのほうへ）
    softShadow(this, 198, 40, 452, 110, 4);
    const b = this.add.graphics().setDepth(5);
    drawPanel(b, 198, 40, 452, 110, 20);
    b.fillStyle(COLOR.ivory, 1).fillTriangle(200, 88, 200, 114, 178, 101);
    b.fillRect(196.4, 89.6, 3.4, 22.8); // しっぽの付け根で枠線を切る
    b.lineStyle(3, COLOR.line, 1).lineBetween(199.6, 88, 178, 101).lineBetween(178, 101, 199.6, 114);

    this.bubbleText = this.add
      .text(222, 95, '', {
        fontFamily: FONT,
        fontSize: '21px',
        color: COLOR.brownText,
        wordWrap: { width: 408, useAdvancedWrap: true },
        lineSpacing: 6,
      })
      .setOrigin(0, 0.5)
      .setDepth(6);

    // 手番の札
    this.turnPill = this.add.graphics().setDepth(6);
    this.turnLabel = this.add
      .text(790, 82, '', { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(7);

    addMuteButton(this, W - 36, 36, { fill: COLOR.ivory, stroke: COLOR.line, icon: COLOR.brown });
    addFullscreenButton(this, W - 36, 92);
    addHomeButton(this, W - 36, 148);
  }

  private setTurnBanner(label: string, color?: number): void {
    this.turnPill.clear();
    this.turnLabel.setText(label);
    if (label && color !== undefined) {
      const w = this.turnLabel.width + 44;
      const x = 790 - w / 2;
      this.turnPill.fillStyle(0x06140f, 0.3).fillRoundedRect(x + 1, 61 + 4, w, 42, 21);
      this.turnPill.fillStyle(color, 1).fillRoundedRect(x, 61, w, 42, 21);
      this.turnPill.fillStyle(0xffffff, 0.16).fillRoundedRect(x + 8, 61 + 4, w - 16, 15, 7.5);
      this.turnPill.lineStyle(1.5, 0xffffff, 0.45).strokeRoundedRect(x + 2, 63, w - 4, 38, 19);
    }
  }

  /** アバターをカードの大きさに合わせる。通常絵は元画像の下端に黒い帯が残っているので切り落とす */
  private fitAvatar(): void {
    const frame = this.avatar.frame;
    const trim = this.avatar.texture.key === 'senakuma' ? 9 : 0;
    this.avatar.setCrop(0, 0, frame.width, frame.height - trim);
    this.avatar.setScale(118 / frame.height);
  }

  private say(text: string): void {
    this.bubbleText.setText(text);
  }

  private setAvatar(key: 'senakuma' | 'senakuma_wink', revertMs = 0): void {
    this.avatar.setTexture(key);
    this.fitAvatar();
    if (revertMs > 0) {
      this.time.delayedCall(revertMs, () => {
        if (!this.over) this.setAvatar('senakuma');
      });
    }
  }

  private refreshPit(i: number): void {
    const layer = this.seedLayers[i];
    layer.removeAll(true);
    const n = this.display[i];
    // 見せる石の数には上限を置く（それ以上は山が大きくならないだけで、個数は札の数字で分かる）
    const shown = Math.min(n, isStore(i) ? 44 : 16);
    // あとから入った石ほど上に重なる。影は自分の直前に描くので、下の石にも落ちる
    for (let k = 0; k < shown; k++) {
      const s = seedSpot(i, k, shown);
      layer.add(this.add.image(s.x + 1.6, s.y + 2.6, 'seed_shadow').setScale(0.5));
      layer.add(this.add.image(s.x, s.y, 'seeds', s.frame).setScale(0.5).setAngle(s.angle));
    }
    this.countLabels[i].setText(String(n));
  }

  update(): void {
    // 選べるくぼみのふちを淡く光らせ、選択中は強く光らせる
    for (let i = 0; i < 6; i++) {
      const ring = this.rings[i];
      if (!ring) continue;
      const clickable = !this.busy && !this.over && !this.confirmAction && this.board[i] > 0;
      const strong = this.armed === i ? 1 : 0.9; // 押している間はいちばん明るく
      ring.setAlpha(clickable ? (this.hovered === i ? strong : 0.36 + 0.3 * this.pulse.v) : 0);
    }
  }

  private showTitleOverlay(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(dimmer(this, 0.7, 50));

    const logo = this.add
      .text(W / 2, 88, 'せなくまとマンカラ', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#fff3d2',
      })
      .setOrigin(0.5).setStroke('#4a2f1c', 12).setShadow(0, 5, '#00000066', 6, true, false).setDepth(51);
    items.push(logo);

    items.push(softShadow(this, 150, 142, 660, 216, 51));
    const panel = this.add.graphics().setDepth(51);
    drawPanel(panel, 150, 142, 660, 216, 22);
    items.push(panel);
    const rules = [
      'したの列の くぼみを えらぶと、ポテトを 反時計まわりに 1つずつ まく',
      'さいごの1つが みぎのゴールに 入ったら、もういっかい！',
      'さいごの1つが じぶんの 空きマスなら、向かいのポテトを よこどり！',
      'ゴールの ポテトが 多いほうの かち！',
    ];
    rules.forEach((line, k) => {
      const y = 180 + k * 46.5;
      items.push(this.add.image(190, y + 2.5, 'seed_shadow').setScale(0.5).setDepth(52));
      items.push(this.add.image(188, y, 'seeds', k % 4).setScale(0.5).setAngle(-20 + k * 35).setDepth(52));
      items.push(
        this.add
          .text(212, y, line, { fontFamily: FONT, fontSize: '17px', color: COLOR.brownText })
          .setOrigin(0, 0.5).setDepth(52),
      );
      if (k < rules.length - 1) {
        const sep = this.add.graphics().setDepth(52);
        sep.lineStyle(1, COLOR.lineSoft, 1).lineBetween(176, y + 23, 784, y + 23);
        items.push(sep);
      }
    });

    // つよさ選択
    items.push(
      this.add
        .text(258, 392, 'せなくまの つよさ：', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: COLOR.ivoryText })
        .setOrigin(1, 0.5).setStroke('#3a2414', 6).setDepth(52),
    );
    const levels: { label: string; v: 0 | 1 | 2 }[] = [
      { label: 'よわい', v: 0 },
      { label: 'ふつう', v: 1 },
      { label: 'つよい', v: 2 },
    ];
    const chips: Phaser.GameObjects.Container[] = [];
    const renderChips = (): void => {
      chips.forEach((c) => c.destroy());
      chips.length = 0;
      levels.forEach((lv, i) => {
        const x = 330 + i * 130;
        const selected = this.aiLevel === lv.v;
        const chip = this.add.container(x, 392).setDepth(52);
        const g = this.add.graphics();
        g.fillStyle(0x06140f, 0.3).fillRoundedRect(-55, -18, 112, 44, 22);
        g.fillStyle(selected ? COLOR.brown : COLOR.ivory, 1).fillRoundedRect(-56, -22, 112, 44, 22);
        g.lineStyle(2.5, selected ? 0xe2b04a : COLOR.line).strokeRoundedRect(-56, -22, 112, 44, 22);
        const t = this.add
          .text(0, 0, lv.label, {
            fontFamily: FONT, fontSize: '19px', fontStyle: 'bold',
            color: selected ? COLOR.ivoryText : COLOR.brownSoftText,
          })
          .setOrigin(0.5);
        chip.add([g, t]);
        chip.setSize(112, 44);
        chip.setInteractive({ useHandCursor: true });
        chip.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          AudioBox.play('click');
          this.aiLevel = lv.v;
          renderChips();
        });
        chips.push(chip);
        items.push(chip);
      });
    };
    renderChips();

    items.push(
      this.add
        .text(W / 2, 426, 'キーボード：←→ でえらぶ ／ Enter でけってい ／ 1〜6 でちょくせつ えらぶ', {
          fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: COLOR.ivoryText,
        })
        .setOrigin(0.5).setStroke('#3a2414', 5).setDepth(52),
    );

    let begun = false;
    const begin = (): void => {
      if (begun) return;
      begun = true;
      this.confirmAction = undefined;
      items.forEach((o) => o.destroy());
      chips.forEach((c) => c.destroy());
      btn.destroy();
      AudioBox.startMusic();
      AudioBox.voice('start'); // ボイスが配置されていれば「スタート！」
      // 開幕: ポテトがぽんっぽんっと順番に現れる
      const order = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
      order.forEach((pit, k) => {
        this.seedLayers[pit].setScale(0);
        this.tweens.add({
          targets: this.seedLayers[pit],
          scale: 1,
          duration: 260,
          delay: k * 70,
          ease: 'Back.easeOut',
          onStart: () => AudioBox.play('tick'),
        });
      });
      this.time.delayedCall(order.length * 70 + 300, () =>
        this.startPlayerTurn('きみが先手だよ！すきなくぼみを タップしてね'),
      );
    };
    const btn = pillButton(this, W / 2, 472, 300, 62, 'あそぶ！', begin);
    this.confirmAction = begin; // Enter / スペースでも開始
  }

  private startPlayerTurn(message: string): void {
    this.busy = false;
    this.setTurnBanner('あなたのばん！', COLOR.green);
    this.say(message);
    // マウスや指が乗ったままのくぼみ・キーで選んでいたくぼみは、そのまま次の手のプレビューを出す
    if (this.hovered >= 0 && this.board[this.hovered] > 0) this.showPreview(this.hovered);
    else this.hovered = -1;
  }

  private onPitClick(i: number): void {
    if (this.busy || this.over || this.confirmAction || this.board[i] === 0) return;
    this.busy = true;
    this.armed = -1;
    this.pressing = false;
    this.setTurnBanner('', undefined);
    this.hidePreview();
    this.cpuMarker?.destroy();
    this.cpuMarker = undefined;
    AudioBox.play('click');
    this.playMove(i, 'player');
  }

  /** ポテト1個が持ち上がって運ばれ、置かれる（真上から見ているので、高いほど大きく・影は遠く薄く） */
  private flySeed(from: { x: number; y: number }, to: { x: number; y: number }, onLand: () => void): void {
    const shadow = this.add.image(from.x, from.y, 'seed_shadow').setScale(0.5).setDepth(29);
    const fly = this.add
      .image(from.x, from.y, 'seeds', Phaser.Math.Between(0, 3))
      .setScale(0.5)
      .setDepth(30)
      .setAngle(Phaser.Math.Between(0, 359));
    const spin = Phaser.Math.Between(-90, 90);
    const startAngle = fly.angle;
    const holder = { t: 0 };
    this.tweens.add({
      targets: holder,
      t: 1,
      duration: 240,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = from.x + (to.x - from.x) * holder.t;
        const y = from.y + (to.y - from.y) * holder.t;
        const lift = Math.sin(holder.t * Math.PI); // 0=盤の上, 1=いちばん高い
        fly.setPosition(x - lift * 6, y - lift * 26).setScale(0.5 * (1 + 0.3 * lift));
        fly.angle = startAngle + spin * holder.t;
        shadow.setPosition(x + 1.6 + lift * 9, y + 2.6 + lift * 12).setScale(0.5 * (1 + 0.6 * lift)).setAlpha(1 - 0.55 * lift);
      },
      onComplete: () => {
        fly.destroy();
        shadow.destroy();
        AudioBox.play('tick');
        onLand();
      },
    });
  }

  /** 1手ぶんのアニメーションと盤面反映、次の手番への引き継ぎ */
  private playMove(pit: number, who: Who): void {
    const result = computeMove(this.board, pit, who);
    const src = pitPos(pit);

    this.display[pit] = 0;
    this.refreshPit(pit);

    const stepMs = 150;
    result.path.forEach((target, k) => {
      this.time.delayedCall(stepMs * k, () => {
        const dst = pitPos(target);
        this.flySeed(src, dst, () => {
          this.display[target] += 1;
          this.refreshPit(target);
          this.tweens.add({
            targets: this.seedLayers[target],
            scale: { from: 1.15, to: 1 },
            duration: 120,
            ease: 'Sine.easeOut',
          });
          if (target === P_STORE || target === C_STORE) {
            // ゴールに入った時だけ、きらっと光らせて数字を弾ませる
            this.sparkles.explode(6, dst.x, dst.y);
            this.tweens.add({
              targets: this.countLabels[target],
              scale: { from: 1.5, to: 1 },
              duration: 220,
              ease: 'Back.easeOut',
            });
          }
        });
      });
    });

    const settleAt = stepMs * result.path.length + 320;
    this.time.delayedCall(settleAt, () => {
      let extraWait = 0;
      if (result.captured > 0) {
        // 横取り: 両マスのポテトが実際にゴールへ飛んでいく
        const ownStore = who === 'player' ? P_STORE : C_STORE;
        const flights = Math.min(result.captured, 10);
        extraWait = flights * 60 + 520;
        AudioBox.play('capture');
        const fromPits = [result.captureFrom!, result.captureTo!];
        for (const p of fromPits) {
          const pos = pitPos(p);
          this.sparkles.explode(8, pos.x, pos.y);
        }
        this.display[result.captureFrom!] = 0;
        this.display[result.captureTo!] = 0;
        this.refreshPit(result.captureFrom!);
        this.refreshPit(result.captureTo!);
        const dst = pitPos(ownStore);
        for (let k = 0; k < flights; k++) {
          const from = pitPos(fromPits[k % 2]);
          this.time.delayedCall(k * 60, () =>
            this.flySeed(from, dst, () => {
              this.display[ownStore] += 1;
              this.refreshPit(ownStore);
            }),
          );
        }
        if (who === 'player') {
          this.say(`あーっ！${result.captured}こ 横取りされちゃった〜！`);
          if (result.captured >= 4) {
            // 大量横取りされたら泣き顔カットイン
            const cry = this.add.image(99, 88, 'face_cry').setDepth(40).setScale(0);
            this.tweens.add({ targets: cry, scale: 0.62, duration: 300, ease: 'Back.easeOut' });
            this.time.delayedCall(1500, () =>
              this.tweens.add({ targets: cry, alpha: 0, scale: 0.45, duration: 250, onComplete: () => cry.destroy() }),
            );
          }
        } else {
          this.say(`いただき〜！${result.captured}こ ゲット！`);
          this.setAvatar('senakuma_wink', 1200);
        }
      }

      this.time.delayedCall(extraWait, () => {
        this.board = result.board;
        this.display = this.board.slice();
        for (let i = 0; i < 14; i++) this.refreshPit(i);

        if (this.checkGameEnd()) return;

        if (result.extraTurn) {
          if (who === 'player') {
            this.startPlayerTurn('ゴールにぴったり！もういっかい どうぞ！');
          } else {
            this.say('ゴールにぴったり！もういっかい いくよ〜');
            this.setAvatar('senakuma_wink', 1000);
            this.time.delayedCall(1100, () => this.cpuTurn());
          }
        } else if (who === 'player') {
          this.time.delayedCall(300, () => this.cpuTurn());
        } else {
          this.startPlayerTurn('きみのばん！');
        }
      });
    });
  }

  private cpuTurn(): void {
    if (this.over) return;
    this.busy = true;
    this.setTurnBanner('せなくまのばん…', COLOR.rose);
    this.say('んー、どこにしようかな…');

    this.cpuMarker?.destroy();
    this.cpuMarker = undefined;
    this.time.delayedCall(1000, () => {
      const pit = this.chooseCpuMove();
      const pos = pitPos(pit);
      const marker = this.addRing(pos.x, pos.y, 'ring_pit', COLOR.pink).setAlpha(1);
      this.say('ここ！');
      this.time.delayedCall(500, () => {
        marker.setAlpha(0.45); // どこを選んだか、次の自分の手番まで薄く残す
        this.cpuMarker = marker;
        this.playMove(pit, 'cpu');
      });
    });
  }

  private chooseCpuMove(): number {
    const options: { pit: number; r: MoveResult }[] = [];
    for (let pit = 7; pit <= 12; pit++) {
      if (this.board[pit] === 0) continue;
      options.push({ pit, r: computeMove(this.board, pit, 'cpu') });
    }

    // よわい: 基本ランダム（ときどきだけ「もういっかい」に気づく）
    if (this.aiLevel === 0) {
      if (Math.random() < 0.3) {
        const et = options.find((o) => o.r.extraTurn);
        if (et) return et.pit;
      }
      return Phaser.Math.RND.pick(options).pit;
    }

    // ふつう: 1手の利得だけ見る貪欲法
    const greedy = (o: { r: MoveResult }): number =>
      (o.r.extraTurn ? 100 : 0) + o.r.captured * 10 + (o.r.board[C_STORE] - this.board[C_STORE]) + Math.random();
    if (this.aiLevel === 1) {
      return options.sort((a, b) => greedy(b) - greedy(a))[0].pit;
    }

    // つよい: 相手の最善応手（貪欲）まで読んで差し引きで評価
    const deep = (o: { r: MoveResult }): number => {
      let s = (o.r.board[C_STORE] - this.board[C_STORE]) * 3 + (o.r.extraTurn ? 6 : 0);
      if (!o.r.extraTurn) {
        let bestReply = 0;
        for (let p = 0; p <= 5; p++) {
          if (o.r.board[p] === 0) continue;
          const rr = computeMove(o.r.board, p, 'player');
          const gain = rr.board[P_STORE] - o.r.board[P_STORE] + (rr.extraTurn ? 4 : 0);
          bestReply = Math.max(bestReply, gain);
        }
        s -= bestReply * 2.5;
      }
      return s + Math.random() * 0.5;
    };
    return options.sort((a, b) => deep(b) - deep(a))[0].pit;
  }

  /** どちらかの列が空になったら残りを各自のゴールへ飛ばして終了 */
  private checkGameEnd(): boolean {
    const playerEmpty = this.board.slice(0, 6).every((n) => n === 0);
    const cpuEmpty = this.board.slice(7, 13).every((n) => n === 0);
    if (!playerEmpty && !cpuEmpty) return false;

    this.over = true;
    this.busy = true;
    this.setTurnBanner('', undefined);
    this.cpuMarker?.destroy();
    this.say('のこりは それぞれのゴールへ！');

    // 残ったポテトが順番に各自のゴールへ飛んで集まる
    let delay = 200;
    for (let i = 0; i < 6; i++) {
      for (const [pit, store] of [[i, P_STORE], [i + 7, C_STORE]] as const) {
        const n = this.board[pit];
        if (n === 0) continue;
        this.board[store] += n;
        this.board[pit] = 0;
        const from = pitPos(pit);
        const dst = pitPos(store);
        const flights = Math.min(n, 6);
        this.time.delayedCall(delay, () => {
          this.display[pit] = 0;
          this.refreshPit(pit);
        });
        for (let k = 0; k < flights; k++) {
          this.time.delayedCall(delay, () =>
            this.flySeed(from, dst, () => {
              this.display[store] += 1;
              this.refreshPit(store);
            }),
          );
          delay += 55;
        }
      }
    }

    const p = this.board[P_STORE];
    const c = this.board[C_STORE];
    this.time.delayedCall(delay + 500, () => {
      this.display = this.board.slice();
      for (let i = 0; i < 14; i++) this.refreshPit(i);
      this.time.delayedCall(250, () => this.showResult(p, c));
    });
    return true;
  }

  private showResult(p: number, c: number): void {
    dimmer(this, 0.62, 50);
    softShadow(this, W / 2 - 245, H / 2 + 30 - 170, 490, 348, 50.5);

    const card = this.add.container(W / 2, H / 2 + 30).setDepth(51);
    const g = this.add.graphics();
    drawPanel(g, -245, -170, 490, 348, 28);
    card.add(g);

    const playerWon = p > c;
    const headline = playerWon ? 'きみの かち！' : p < c ? 'せなくまの かち！' : 'ひきわけ！';
    const line = playerWon ? 'まけた〜！きみ つよいね…！' : p < c ? 'やった〜！わたしの かち！' : 'いいしょうぶだったね〜！';
    this.say(line);
    AudioBox.play(playerWon ? 'win' : p < c ? 'lose' : 'capture');
    // せなくま視点のボイス: 負けたら cry、勝ったら yay（配置されていれば）
    if (playerWon) AudioBox.voice('cry');
    else if (p < c) AudioBox.voice('yay');

    card.add(
      this.add
        .text(0, -96, headline, {
          fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: COLOR.brownText,
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(0, -34, `あなた ${p}  ×  ${c} せなくま`, {
          fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#b8502f',
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(0, 20, line, {
          fontFamily: FONT, fontSize: '20px', color: COLOR.brownSoftText,
        })
        .setOrigin(0.5),
    );

    const faceKey = playerWon ? 'face_cry' : 'face_laugh';
    // 見出しの文字にかからない高さに置く
    const face = this.add.image(W / 2, H / 2 - 154, faceKey).setDepth(52).setScale(0);
    this.tweens.add({
      targets: face,
      scale: 130 / face.height,
      angle: { from: -10, to: -4 },
      duration: 420,
      ease: 'Back.easeOut',
    });

    if (playerWon) {
      const confetti = this.add.particles(0, 0, 'sparkle', {
        x: { min: 0, max: W },
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

    let leaving = false;
    const again = (): void => {
      if (leaving) return; // タップとキーが同時でも1回だけ
      leaving = true;
      this.cameras.main.fadeOut(240, 12, 33, 27);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
    };
    pillButton(this, W / 2, H / 2 + 118, 280, 62, 'もういちど！', again);
    this.time.delayedCall(600, () => {
      this.input.once('pointerdown', again);
      this.confirmAction = again; // Enter / スペースでも もういちど
    });
  }
}
