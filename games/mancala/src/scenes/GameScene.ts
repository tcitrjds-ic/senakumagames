import Phaser from 'phaser';

const W = 960;
const H = 540;
const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", system-ui, sans-serif';

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

  private pitZones: Phaser.GameObjects.Ellipse[] = [];
  private seedLayers: Phaser.GameObjects.Container[] = [];
  private countLabels: Phaser.GameObjects.Text[] = [];
  private avatar!: Phaser.GameObjects.Image;
  private bubbleText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;

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
    this.pitZones = [];
    this.seedLayers = [];
    this.countLabels = [];

    this.buildBoard();
    this.buildHeader();
    for (let i = 0; i < 14; i++) this.refreshPit(i);
    this.showTitleOverlay();
  }

  private buildBoard(): void {
    const g = this.add.graphics();
    g.fillStyle(0xd9a066).fillRoundedRect(70, 195, 820, 310, 28);
    g.lineStyle(6, 0xb97f45).strokeRoundedRect(70, 195, 820, 310, 28);

    for (let i = 0; i < 14; i++) {
      const { x, y } = this.pitPos(i);
      const isStore = i === P_STORE || i === C_STORE;
      const rx = isStore ? 44 : 38;
      const ry = isStore ? 105 : 34;
      const pit = this.add.ellipse(x, y, rx * 2, ry * 2, 0xf3dfc3);
      pit.setStrokeStyle(4, 0xc9a06e);
      if (i <= 5) {
        pit.setInteractive({ useHandCursor: true });
        pit.on('pointerover', () => {
          if (!this.busy && this.board[i] > 0) pit.setFillStyle(0xffefcf);
        });
        pit.on('pointerout', () => pit.setFillStyle(0xf3dfc3));
        pit.on('pointerdown', () => this.onPitClick(i));
      }
      this.pitZones[i] = pit;
      this.seedLayers[i] = this.add.container(x, y).setDepth(5);

      const labelY = isStore ? y + 128 : i <= 5 ? y + 56 : y - 56;
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
      .text(150, 222, 'せなくま', { fontFamily: FONT, fontSize: '17px', color: '#7a4a2e' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5)
      .setDepth(6);
    this.add
      .text(810, 222, 'あなた', { fontFamily: FONT, fontSize: '17px', color: '#7a4a2e' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5)
      .setDepth(6);

    // まく方向のガイド（反時計まわり）
    this.add
      .text(480, 350, '→ したの列は みぎへ / うえの列は ひだりへ ←', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#a97c50',
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
  }

  private buildHeader(): void {
    this.avatar = this.add.image(95, 100, 'senakuma').setDepth(6);
    this.avatar.setScale(160 / this.avatar.height);

    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0xffffff, 0.95).fillRoundedRect(185, 40, 470, 115, 22);
    g.lineStyle(4, 0xf0b7c8).strokeRoundedRect(185, 40, 470, 115, 22);
    g.fillStyle(0xffffff, 0.95).fillTriangle(185, 90, 185, 120, 160, 105);

    this.bubbleText = this.add
      .text(205, 97, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#6b4632',
        wordWrap: { width: 430 },
        lineSpacing: 6,
      })
      .setOrigin(0, 0.5)
      .setDepth(6);

    this.turnText = this.add
      .text(810, 100, '', {
        fontFamily: FONT,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#5b8a3c',
      })
      .setOrigin(0.5)
      .setStroke('#ffffff', 8)
      .setDepth(6);
  }

  private say(text: string): void {
    this.bubbleText.setText(text);
  }

  private setAvatar(key: 'senakuma' | 'senakuma_wink', revertMs = 0): void {
    this.avatar.setTexture(key);
    this.avatar.setScale(160 / this.avatar.height);
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
          .setScale(0.16)
          .setAngle(((k * 47 + i * 31) % 60) - 30),
      );
    }
    this.countLabels[i].setText(String(n));
  }

  private showTitleOverlay(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.add.rectangle(W / 2, H / 2, W, H, 0x553a2e, 0.92).setDepth(50));
    items.push(
      this.add
        .text(W / 2, 120, 'せなくまとマンカラ', {
          fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#ffffff',
        })
        .setOrigin(0.5).setStroke('#8a5a44', 10).setDepth(51),
    );
    const rules = [
      '🍟 じぶんの列（した）のくぼみをタップして、ポテトを反時計まわりに1つずつまくよ',
      '🍟 さいごの1つが みぎのゴールに入ったら もういっかい！',
      '🍟 さいごの1つが じぶんの空きマスに入ったら、向かいのポテトを横取り！',
      '🍟 ゴールのポテトが多いほうの勝ち！',
    ].join('\n\n');
    items.push(
      this.add
        .text(W / 2, 290, rules, {
          fontFamily: FONT, fontSize: '20px', color: '#ffe9d6',
          wordWrap: { width: 700 }, lineSpacing: 4, align: 'left',
        })
        .setOrigin(0.5).setDepth(51),
    );
    const start = this.add
      .text(W / 2, 460, 'タップで スタート！', {
        fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffffff',
      })
      .setOrigin(0.5).setStroke('#5b8a3c', 8).setDepth(51);
    items.push(start);
    this.tweens.add({ targets: start, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => {
      items.forEach((o) => o.destroy());
      this.startPlayerTurn('きみが先手だよ！すきなくぼみを タップしてね');
    });
  }

  private startPlayerTurn(message: string): void {
    this.busy = false;
    this.turnText.setText('あなたのばん！').setColor('#5b8a3c');
    this.say(message);
  }

  private onPitClick(i: number): void {
    if (this.busy || this.over || this.board[i] === 0) return;
    this.busy = true;
    this.turnText.setText('');
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
        this.tweens.add({
          targets: fly,
          x: dst.x,
          y: dst.y,
          duration: 200,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            fly.destroy();
            this.display[target] += 1;
            this.refreshPit(target);
          },
        });
      });
    });

    const settleAt = stepMs * result.path.length + 320;
    this.time.delayedCall(settleAt, () => {
      let extraWait = 0;
      if (result.captured > 0) {
        extraWait = 750;
        for (const p of [result.captureFrom!, result.captureTo!]) {
          const pos = this.pitPos(p);
          const flash = this.add.ellipse(pos.x, pos.y, 90, 80, 0xffff99, 0.85).setDepth(25);
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
    this.turnText.setText('せなくまのばん…').setColor('#c06a7a');
    this.say('んー、どこにしようかな…');

    this.time.delayedCall(1000, () => {
      const pit = this.chooseCpuMove();
      const pos = this.pitPos(pit);
      const marker = this.add.ellipse(pos.x, pos.y, 86, 76, 0xffd0dc, 0.6).setDepth(4);
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
    this.turnText.setText('');

    const p = this.board[P_STORE];
    const c = this.board[C_STORE];
    this.time.delayedCall(700, () => this.showResult(p, c));
    return true;
  }

  private showResult(p: number, c: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x553a2e, 0.65).setDepth(50);

    const faceKey = p > c ? 'face_cry' : p < c ? 'face_laugh' : 'face_laugh';
    const face = this.add.image(W / 2, 150, faceKey).setDepth(51).setScale(0);
    face.setAngle(p < c ? 8 : -8);
    this.tweens.add({ targets: face, scale: 170 / face.height, duration: 400, ease: 'Back.easeOut' });

    const headline = p > c ? 'きみの かち！' : p < c ? 'せなくまの かち！' : 'ひきわけ！';
    const line = p > c ? 'まけた〜！きみ つよいね…！' : p < c ? 'やった〜！わたしの かち！' : 'いいしょうぶだったね〜！';
    this.say(line);

    this.add
      .text(W / 2, 300, headline, {
        fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#ffffff',
      })
      .setOrigin(0.5).setStroke('#8a5a44', 10).setDepth(51);
    this.add
      .text(W / 2, 370, `あなた ${p}  ×  ${c} せなくま`, {
        fontFamily: FONT, fontSize: '30px', color: '#ffe9a8',
      })
      .setOrigin(0.5).setStroke('#8a5a44', 8).setDepth(51);

    const retry = this.add
      .text(W / 2, 450, 'タップで もういちど！', {
        fontFamily: FONT, fontSize: '28px', color: '#ffffff',
      })
      .setOrigin(0.5).setStroke('#5b8a3c', 8).setDepth(51);
    this.tweens.add({ targets: retry, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    this.time.delayedCall(500, () => {
      this.input.once('pointerdown', () => this.scene.restart());
    });
  }
}
