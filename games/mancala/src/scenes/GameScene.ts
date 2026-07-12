import Phaser from 'phaser';
import { AudioBox, addMuteButton } from '../audio';
import { FONT, pillButton } from '../ui';

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
        pit.on('pointerover', () => (this.hovered = i));
        pit.on('pointerout', () => (this.hovered = this.hovered === i ? -1 : this.hovered));
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
        wordWrap: { width: 412 },
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
    panel.fillStyle(0xfffdf8, 0.97).fillRoundedRect(150, 150, 660, 250, 24);
    panel.lineStyle(4, 0xf0b7c8).strokeRoundedRect(150, 150, 660, 250, 24);
    items.push(panel);
    const rules = [
      '🍟 じぶんの列（した）のくぼみをタップして、ポテトを反時計まわりに1つずつまく',
      '🍟 さいごの1つが みぎのゴールに入ったら もういっかい！',
      '🍟 さいごの1つが じぶんの空きマスに入ったら、向かいのポテトを横取り！',
      '🍟 ゴールのポテトが多いほうの勝ち！',
    ].join('\n\n');
    items.push(
      this.add
        .text(180, 275, rules, {
          fontFamily: FONT, fontSize: '19px', color: '#6b4632',
          wordWrap: { width: 600 }, lineSpacing: 3,
        })
        .setOrigin(0, 0.5).setDepth(52),
    );

    let begun = false;
    const begin = (): void => {
      if (begun) return;
      begun = true;
      items.forEach((o) => o.destroy());
      btn.destroy();
      AudioBox.startMusic();
      this.startPlayerTurn('きみが先手だよ！すきなくぼみを タップしてね');
    };
    const btn = pillButton(this, W / 2, 462, 320, 66, 'あそぶ！', begin);
    this.input.once('pointerdown', begin);
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
    AudioBox.play('click');
    this.playMove(i, 'player');
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
        const fly = this.add.image(src.x, src.y, 'potato').setScale(0.2).setDepth(30);
        const holder = { t: 0 };
        this.tweens.add({
          targets: holder,
          t: 1,
          duration: 230,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            fly.x = src.x + (dst.x - src.x) * holder.t;
            fly.y = src.y + (dst.y - src.y) * holder.t - Math.sin(holder.t * Math.PI) * 70;
          },
          onComplete: () => {
            fly.destroy();
            this.display[target] += 1;
            this.refreshPit(target);
            AudioBox.play('tick');
            this.tweens.add({
              targets: this.seedLayers[target],
              scale: { from: 1.15, to: 1 },
              duration: 120,
              ease: 'Sine.easeOut',
            });
          },
        });
      });
    });

    const settleAt = stepMs * result.path.length + 320;
    this.time.delayedCall(settleAt, () => {
      let extraWait = 0;
      if (result.captured > 0) {
        extraWait = 800;
        AudioBox.play('capture');
        for (const p of [result.captureFrom!, result.captureTo!]) {
          const pos = this.pitPos(p);
          this.sparkles.explode(10, pos.x, pos.y);
          const flash = this.add.ellipse(pos.x, pos.y, 92, 82, 0xffff99, 0.8).setDepth(25);
          this.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 650, onComplete: () => flash.destroy() });
        }
        if (who === 'player') {
          this.say(`あーっ！${result.captured}こ 横取りされちゃった〜！`);
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

    this.time.delayedCall(1000, () => {
      const pit = this.chooseCpuMove();
      const pos = this.pitPos(pit);
      const marker = this.add.image(pos.x, pos.y, 'glow').setDepth(3).setAlpha(0.85).setScale(0.72);
      this.say('ここ！');
      this.time.delayedCall(500, () => {
        marker.destroy();
        this.playMove(pit, 'cpu');
      });
    });
  }

  private chooseCpuMove(): number {
    const candidates: { pit: number; score: number }[] = [];
    for (let pit = 7; pit <= 12; pit++) {
      if (this.board[pit] === 0) continue;
      const r = computeMove(this.board, pit, 'cpu');
      const storeGain = r.board[C_STORE] - this.board[C_STORE];
      const score = (r.extraTurn ? 100 : 0) + r.captured * 10 + storeGain + Math.random();
      candidates.push({ pit, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].pit;
  }

  /** どちらかの列が空になったら残りを各自のゴールへ集めて終了 */
  private checkGameEnd(): boolean {
    const playerEmpty = this.board.slice(0, 6).every((n) => n === 0);
    const cpuEmpty = this.board.slice(7, 13).every((n) => n === 0);
    if (!playerEmpty && !cpuEmpty) return false;

    for (let i = 0; i < 6; i++) {
      this.board[P_STORE] += this.board[i];
      this.board[i] = 0;
      this.board[C_STORE] += this.board[i + 7];
      this.board[i + 7] = 0;
    }
    this.display = this.board.slice();
    for (let i = 0; i < 14; i++) this.refreshPit(i);

    this.over = true;
    this.busy = true;
    this.setTurnBanner('', undefined);

    const p = this.board[P_STORE];
    const c = this.board[C_STORE];
    this.time.delayedCall(700, () => this.showResult(p, c));
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

    pillButton(this, W / 2, H / 2 + 118, 280, 62, 'もういちど！', () => this.scene.restart());
    this.time.delayedCall(600, () => {
      this.input.once('pointerdown', () => this.scene.restart());
    });
  }
}
