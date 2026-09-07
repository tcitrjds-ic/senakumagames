import Phaser from 'phaser';
import { AudioBox } from './audio';

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", system-ui, sans-serif';

export const W = 960;
export const H = 540;

/** ホーム（ポータル）へ戻るボタン。デプロイ時は 1つ上の階層 = ポータル */
export function addHomeButton(scene: Phaser.Scene, x: number, y: number): void {
  const bg = scene.add.circle(x, y, 24, 0xfff8e8, 0.92).setDepth(60).setStrokeStyle(3, 0xd8b45a);
  scene.add.text(x, y + 1, '🏠', { fontSize: '22px' }).setOrigin(0.5).setDepth(61);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    AudioBox.play('click');
    window.location.href = '../';
  });
}

/** フルスクリーン切替ボタン（コーナーブラケットのアイコン） */
export function addFullscreenButton(scene: Phaser.Scene, x: number, y: number): void {
  const bg = scene.add.circle(x, y, 24, 0xfff8e8, 0.92).setDepth(60).setStrokeStyle(3, 0xd8b45a);
  const g = scene.add.graphics().setDepth(61);
  g.lineStyle(3.5, 0x7a5a2a);
  const s = 8;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.beginPath();
    g.moveTo(x + dx * s, y + dy * (s - 5));
    g.lineTo(x + dx * s, y + dy * s);
    g.lineTo(x + dx * (s - 5), y + dy * s);
    g.strokePath();
  }
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    AudioBox.play('click');
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
    else scene.scale.startFullscreen();
  });
}

/** 右上にまとめて置く共通ボタン列 */
export function addCornerButtons(scene: Phaser.Scene): void {
  addMuteButtonLazy(scene, W - 36, 36);
  addFullscreenButton(scene, W - 36, 92);
  addHomeButton(scene, W - 36, 148);
}

function addMuteButtonLazy(scene: Phaser.Scene, x: number, y: number): void {
  // 循環importを避けるため動的に呼び出す
  void import('./audio').then((m) => m.addMuteButton(scene, x, y));
}

/** 押すと沈む「ぷにっ」としたピルボタン */
export function pillButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  color = 0xc8462e,
  shade = 0x8e2e1c,
  fontSize = 24,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(55);
  const g = scene.add.graphics();
  g.fillStyle(shade).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, h / 2);
  const top = scene.add.graphics();
  top.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  top.fillStyle(0xffffff, 0.25).fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h / 2.6, h / 4);
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#ffffff' })
    .setOrigin(0.5);
  c.add([g, top, text]);
  c.setSize(w, h + 8);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    AudioBox.play('click');
    scene.tweens.add({
      targets: [top, text],
      y: 4,
      duration: 70,
      yoyo: true,
      onComplete: onClick,
    });
  });
  return c;
}

/** 木の看板（部屋名や案内に使う） */
export function signboard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  fontSize = 15,
  depth = 20,
): Phaser.GameObjects.Container {
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#fff6dc' })
    .setOrigin(0.5);
  const w = Math.max(70, text.width + 22);
  const h = text.height + 10;
  const g = scene.add.graphics();
  g.fillStyle(0x4a2c18, 1).fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 6);
  g.fillStyle(0x8a5a30, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
  g.lineStyle(2, 0xd8b45a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  const c = scene.add.container(x, y, [g, text]).setDepth(depth);
  c.setSize(w, h);
  return c;
}

/** マリオ64のコース名風の大きな文字（クリーム色＋濃い縁取り＋影） */
export function courseTitleStyle(fontSize: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${fontSize}px`,
    fontStyle: '800',
    color: '#fff3c4',
    stroke: '#4a2a10',
    strokeThickness: Math.max(6, Math.round(fontSize * 0.22)),
    shadow: { offsetX: 0, offsetY: Math.round(fontSize * 0.12), color: '#000000', blur: 0, fill: true, stroke: true },
    align: 'center',
  };
}
