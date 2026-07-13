import Phaser from 'phaser';
import { AudioBox, addMuteButton } from '../audio';
import { FONT, pillButton, addFullscreenButton, addHomeButton } from '../ui';

const W = 960;
const H = 540;

// マス割り: 0-5 あなたのくぼみ / 6 あなたのゴール / 7-12 せなくまのくぼみ / 13 せなくまのゴール
const P_STORE = 6;
const C_STORE = 13;
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
  private hovered = -1;
  private pulse = { v: 0 };
  private aiLevel: 0 | 1 | 2 = 1; // よわい / ふつう / つよい
  private cpuMarker?: Phaser.GameObjects.Image;
  private previewGlow!: Phaser.GameObjects.Image;
  private previewTag!: Phaser.GameObjects.Text;

  private pitZones: Phaser.GameObjects.Ellipse[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
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

  private pitPos(i: number): { x: number; y: number } {
    if (i === P_STORE) return { x: 810, y: 350 };
    if (i === C_STORE) return { x: 150, y: 350 };
    if (i <= 5) return { x: 250 + i * 84, y: 435 };
    return { x: 670 - (i - 7) * 84, y: 265 };
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
    this.pulse = { v: 0 };
    this.pitZones = [];
    this.glows = [];
    this.seedLayers = [];
    this.countLabels = [];

    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(90).setAlpha(0.8);
    this.cameras.main.fadeIn(280, 255, 238, 245);
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
    this.showTitleOverlay();
  }

  private buildBoard(): void {
    // 盤テクスチャ（ステッカー余白ぶんオフセットして重ねる）
    this.add.image(49, 174, 'board').setOrigin(0, 0).setScale(0.5).setDepth(1);

    for (let i = 0; i < 14; i++) {
      const { x, y } = this.pitPos(i);
      const isStore = i === P_STORE || i === C_STORE;
      const rx = isStore ? 44 : 38;
      const ry = isStore ? 105 : 34;
      const pit = this.add.ellipse(x, y, rx * 2 + 14, ry * 2 + 14, 0xffffff, 0).setDepth(4);
      if (i <= 5) {
        const glow = this.add.image(x, y, 'glow').setDepth(2).setAlpha(0).setScale(0.72);
        this.glows[i] = glow;
        pit.setInteractive({ useHandCursor: true });
        pit.on('pointerover', () => {
          this.hovered = i;
          this.showPreview(i);
        });
        pit.on('pointerout', () => {
          if (this.hovered === i) this.hovered = -1;
          this.hidePreview();
        });
        pit.on('pointerdown', () => this.onPitClick(i));
      }
      this.pitZones[i] = pit;
      this.seedLayers[i] = this.add.container(x, y).setDepth(5);

      const labelY = isStore ? y + 128 : i <= 5 ? y + 58 : y - 58;
      this.countLabels[i] = this.add
        .text(x, labelY, '', {
          fontFamily: FONT,
          fontSize: isStore ? '26px' : '20px',
          fontStyle: 'bold',
          color: '#7a4a2e',
        })
        .setOrigin(0.5)
        .setStroke('#ffffff', 6)
        .setDepth(6);
    }

    this.add
      .text(150, 218, 'せなくま', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#8a5a44' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5)
      .setDepth(6);
    this.add
      .text(810, 218, 'あなた', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#8a5a44' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5)
      .setDepth(6);

    // まく方向のガイド（反時計まわり）
    this.add
      .text(480, 350, '→ したの列は みぎへ ／ うえの列は ひだりへ ←', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#8a5a44',
      })
      .setOrigin(0.5)
      .setAlpha(0.55)
      .setDepth(4);

    // 手のプレビュー（ホバーで最後のポテトの着地点と結果を先に見せる）
    this.previewGlow = this.add.image(0, 0, 'glow').setDepth(3).setVisible(false).setScale(0.62).setTint(0xa8e6a1);
    this.previewTag = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
  }

  private showPreview(i: number): void {
    if (this.busy || this.over || this.board[i] === 0) return;
    const r = computeMove(this.board, i, 'player');
    const last = r.path[r.path.length - 1];
    const pos = this.pitPos(last);
    this.previewGlow.setPosition(pos.x, pos.y).setVisible(true).setAlpha(0.6);
    const isStore = last === P_STORE || last === C_STORE;
    if (r.extraTurn) {
      this.previewTag.setText('もういっかい！').setStroke('#5b8a3c', 7);
    } else if (r.captured > 0) {
      this.previewTag.setText(`よこどり ${r.captured}こ！`).setStroke('#e07a90', 7);
    } else {
      this.previewTag.setVisible(false);
      return;
    }
    this.previewTag.setPosition(pos.x, pos.y - (isStore ? 128 : 56)).setVisible(true);
  }

  private hidePreview(): void {
    this.previewGlow.setVisible(false);
    this.previewTag.setVisible(false);
  }

  private buildHeader(): void {
    // アバターカード
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x8a5a44, 0.18).fillRoundedRect(24, 26, 158, 158, 24);
    g.fillStyle(0xffffff, 0.95).fillRoundedRect(20, 20, 158, 158, 24);
    g.lineStyle(4, 0xf0b7c8).strokeRoundedRect(20, 20, 158, 158, 24);
    this.avatar = this.add.image(99, 88, 'senakuma').setDepth(6);
    this.avatar.setScale(118 / this.avatar.height);
    g.fillStyle(0xff8fa8, 1).fillRoundedRect(44, 144, 110, 28, 14);
    this.add
      .text(99, 158, 'せなくま', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(6);

    // 吹き出し
    const b = this.add.graphics().setDepth(5);
    b.fillStyle(0x8a5a44, 0.15).fillRoundedRect(202, 46, 452, 110, 20);
    b.fillStyle(0xffffff, 0.97).fillRoundedRect(198, 40, 452, 110, 20);
    b.lineStyle(4, 0xf0b7c8).strokeRoundedRect(198, 40, 452, 110, 20);
    b.fillStyle(0xffffff, 0.97).fillTriangle(198, 86, 198, 116, 176, 100);
    b.lineStyle(4, 0xf0b7c8).strokeTriangle(199, 86, 199, 116, 176, 100);
    b.fillStyle(0xffffff, 1).fillRect(198, 86, 6, 30);

    this.bubbleText = this.add
      .text(220, 95, '', {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#6b4632',
        wordWrap: { width: 412, useAdvancedWrap: true },
        lineSpacing: 6,
      })
      .setOrigin(0, 0.5)
      .setDepth(6);

    // 手番バナー
    this.turnPill = this.add.graphics().setDepth(6);
    this.turnLabel = this.add
      .text(790, 82, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(7);

    addMuteButton(this, W - 36, 36);
    addFullscreenButton(this, W - 36, 92);
    addHomeButton(this, W - 36, 148);
  }

  private setTurnBanner(label: string, color?: number): void {
    this.turnPill.clear();
    this.turnLabel.setText(label);
    if (label && color !== undefined) {
      const w = this.turnLabel.width + 44;
      this.turnPill.fillStyle(0x8a5a44, 0.18).fillRoundedRect(790 - w / 2 + 3, 61 + 4, w, 42, 21);
      this.turnPill.fillStyle(color, 1).fillRoundedRect(790 - w / 2, 61, w, 42, 21);
    }
  }

  private say(text: string): void {
    this.bubbleText.setText(text);
  }

  private setAvatar(key: 'senakuma' | 'senakuma_wink', revertMs = 0): void {
    this.avatar.setTexture(key);
    this.avatar.setScale(118 / this.avatar.height);
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
    const isStore = i === P_STORE || i === C_STORE;
    const shown = Math.min(n, isStore ? 24 : 12);
    for (let k = 0; k < shown; k++) {
      // 黄金角で自然にばらけさせる（マスごとに向きを変える）
      const r = 5 + (isStore ? 13 : 9) * Math.sqrt(k);
      const a = k * 2.39996 + i * 1.7;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * (isStore ? 2.1 : 0.8);
      layer.add(
        this.add
          .image(px, py, 'potato')
          .setScale(0.17)
          .setAngle(((k * 47 + i * 31) % 60) - 30),
      );
    }
    this.countLabels[i].setText(String(n));
  }

  update(): void {
    // 選べるくぼみを淡く光らせ、ホバー中は強調する
    for (let i = 0; i < 6; i++) {
      const glow = this.glows[i];
      if (!glow) continue;
      const clickable = !this.busy && !this.over && this.board[i] > 0;
      glow.setAlpha(clickable ? (this.hovered === i ? 0.85 : 0.2 + 0.3 * this.pulse.v) : 0);
    }
  }

  private showTitleOverlay(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.add.rectangle(W / 2, H / 2, W, H, 0x553a2e, 0.62).setDepth(50));

    const logoShadow = this.add
      .text(W / 2 + 4, 96, 'せなくまとマンカラ', {
        fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#00000033',
      })
      .setOrigin(0.5).setDepth(51);
    const logo = this.add
      .text(W / 2, 92, 'せなくまとマンカラ', {
        fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#ffb0c2',
      })
      .setOrigin(0.5).setStroke('#ffffff', 12).setDepth(51);
    items.push(logo, logoShadow);

    const panel = this.add.graphics().setDepth(51);
    panel.fillStyle(0xfffdf8, 0.97).fillRoundedRect(150, 142, 660, 216, 24);
    panel.lineStyle(4, 0xf0b7c8).strokeRoundedRect(150, 142, 660, 216, 24);
    items.push(panel);
    const rules = [
      '🍟 じぶんの列（した）のくぼみをタップして、ポテトを反時計まわりに1つずつまく',
      '🍟 さいごの1つが みぎのゴールに入ったら もういっかい！',
      '🍟 さいごの1つが じぶんの空きマスなら、向かいのポテトを横取り！',
      '🍟 ゴールのポテトが多いほうの勝ち！',
    ].join('\n\n');
    items.push(
      this.add
        .text(178, 250, rules, {
          fontFamily: FONT, fontSize: '17px', color: '#6b4632',
          wordWrap: { width: 604, useAdvancedWrap: true }, lineSpacing: 2,
        })
        .setOrigin(0, 0.5).setDepth(52),
    );

    // つよさ選択
    items.push(
      this.add
        .text(258, 392, 'せなくまの つよさ：', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(1, 0.5).setStroke('#8a5a44', 6).setDepth(52),
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
        g.fillStyle(selected ? 0xff8fa8 : 0xffffff, 1).fillRoundedRect(-56, -22, 112, 44, 22);
        g.lineStyle(3, selected ? 0xe07a90 : 0xe8cdd6).strokeRoundedRect(-56, -22, 112, 44, 22);
        const t = this.add
          .text(0, 0, lv.label, {
            fontFamily: FONT, fontSize: '19px', fontStyle: 'bold',
            color: selected ? '#ffffff' : '#a97c8c',
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

    let begun = false;
    const begin = (): void => {
      if (begun) return;
      begun = true;
      items.forEach((o) => o.destroy());
      chips.forEach((c) => c.destroy());
      btn.destroy();
      AudioBox.startMusic();
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
  }

  private startPlayerTurn(message: string): void {
    this.busy = false;
    this.setTurnBanner('あなたのばん！', 0x5b8a3c);
    this.say(message);
  }

  private onPitClick(i: number): void {
    if (this.busy || this.over || this.board[i] === 0) return;
    this.busy = true;
    this.setTurnBanner('', undefined);
    this.hidePreview();
    this.cpuMarker?.destroy();
    this.cpuMarker = undefined;
    AudioBox.play('click');
    this.playMove(i, 'player');
  }

  /** ポテト1個が放物線を描いて飛ぶ */
  private flySeed(from: { x: number; y: number }, to: { x: number; y: number }, onLand: () => void): void {
    const fly = this.add.image(from.x, from.y, 'potato').setScale(0.2).setDepth(30);
    const holder = { t: 0 };
    this.tweens.add({
      targets: holder,
      t: 1,
      duration: 240,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        fly.x = from.x + (to.x - from.x) * holder.t;
        fly.y = from.y + (to.y - from.y) * holder.t - Math.sin(holder.t * Math.PI) * 70;
      },
      onComplete: () => {
        fly.destroy();
        AudioBox.play('tick');
        onLand();
      },
    });
  }

  /** 1手ぶんのアニメーションと盤面反映、次の手番への引き継ぎ */
  private playMove(pit: number, who: Who): void {
    const result = computeMove(this.board, pit, who);
    const src = this.pitPos(pit);

    this.display[pit] = 0;
    this.refreshPit(pit);

    const stepMs = 150;
    result.path.forEach((target, k) => {
      this.time.delayedCall(stepMs * k, () => {
        const dst = this.pitPos(target);
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
          const pos = this.pitPos(p);
          this.sparkles.explode(8, pos.x, pos.y);
        }
        this.display[result.captureFrom!] = 0;
        this.display[result.captureTo!] = 0;
        this.refreshPit(result.captureFrom!);
        this.refreshPit(result.captureTo!);
        const dst = this.pitPos(ownStore);
        for (let k = 0; k < flights; k++) {
          const from = this.pitPos(fromPits[k % 2]);
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
    this.setTurnBanner('せなくまのばん…', 0xe07a90);
    this.say('んー、どこにしようかな…');

    this.cpuMarker?.destroy();
    this.cpuMarker = undefined;
    this.time.delayedCall(1000, () => {
      const pit = this.chooseCpuMove();
      const pos = this.pitPos(pit);
      const marker = this.add.image(pos.x, pos.y, 'glow').setDepth(3).setAlpha(0.9).setScale(0.72);
      this.say('ここ！');
      this.time.delayedCall(500, () => {
        marker.setAlpha(0.35); // どこを選んだか、次の自分の手番まで薄く残す
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
        const from = this.pitPos(pit);
        const dst = this.pitPos(store);
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
    this.add.rectangle(W / 2, H / 2, W, H, 0x553a2e, 0.55).setDepth(50);

    const card = this.add.container(W / 2, H / 2 + 30).setDepth(51);
    const g = this.add.graphics();
    g.fillStyle(0x8a5a44, 0.35).fillRoundedRect(-250, -162, 500, 352, 30);
    g.fillStyle(0xfffdf8, 1).fillRoundedRect(-245, -170, 490, 348, 30);
    g.lineStyle(5, 0xf0b7c8).strokeRoundedRect(-245, -170, 490, 348, 30);
    card.add(g);

    const playerWon = p > c;
    const headline = playerWon ? 'きみの かち！' : p < c ? 'せなくまの かち！' : 'ひきわけ！';
    const line = playerWon ? 'まけた〜！きみ つよいね…！' : p < c ? 'やった〜！わたしの かち！' : 'いいしょうぶだったね〜！';
    this.say(line);
    AudioBox.play(playerWon ? 'win' : p < c ? 'lose' : 'capture');

    card.add(
      this.add
        .text(0, -96, headline, {
          fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: '#8a5a44',
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(0, -34, `あなた ${p}  ×  ${c} せなくま`, {
          fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#e2504d',
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(0, 20, line, {
          fontFamily: FONT, fontSize: '20px', color: '#a97c8c',
        })
        .setOrigin(0.5),
    );

    const faceKey = playerWon ? 'face_cry' : 'face_laugh';
    const face = this.add.image(W / 2, H / 2 - 140, faceKey).setDepth(52).setScale(0);
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

    const again = (): void => {
      this.cameras.main.fadeOut(240, 255, 238, 245);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
    };
    pillButton(this, W / 2, H / 2 + 118, 280, 62, 'もういちど！', again);
    this.time.delayedCall(600, () => {
      this.input.once('pointerdown', again);
    });
  }
}
