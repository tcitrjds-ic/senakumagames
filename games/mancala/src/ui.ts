import Phaser from 'phaser';
import { AudioBox } from './audio';
import { W, H, RES, COLOR } from './layout';

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", system-ui, sans-serif';

/** カメラを RES 倍に拡大し、ゲーム座標 (0,0)-(W,H) がちょうど画面に収まるようにする */
export function setupCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
}

/**
 * やわらかい落ち影（9スライス）。パネルや札の下に敷く。
 * (x, y, w, h) は影を付けたい四角。影は少し下にずらして置く。
 */
export function softShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  alpha = 1,
): Phaser.GameObjects.NineSlice {
  const pad = 24; // 影テクスチャが四角のまわりに持つ余白（ゲーム座標）
  const cut = 90; // 四隅として固定する幅（テクスチャのpx）
  return scene.add
    .nineslice(x + w / 2, y + h / 2 + 5, 'panel_shadow', undefined, (w + pad * 2) * 2, (h + pad * 2) * 2, cut, cut, cut, cut)
    .setScale(0.5)
    .setDepth(depth)
    .setAlpha(alpha);
}

/** 象牙色のパネル（真ちゅう色の枠＋内側の細線）。g に描き足すので、同じ Graphics に続けて描ける */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number): void {
  g.fillStyle(COLOR.ivory, 1).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(3, COLOR.line, 1).strokeRoundedRect(x, y, w, h, radius);
  g.lineStyle(1.5, COLOR.lineSoft, 1).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, radius - 5));
}

/**
 * 象牙色の丸ボタンの土台。見た目は半径 radius のまま、押せる範囲だけ一回り広げてある
 * （スマホでは画面が縮小表示されるので、見た目どおりの判定だと指で押しにくい）。
 */
export function roundButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onClick: () => void,
  radius = 24,
): Phaser.GameObjects.Arc {
  scene.add.circle(x + 1, y + 3, radius + 1, 0x06140f, 0.28).setDepth(59);
  const bg = scene.add.circle(x, y, radius, COLOR.ivory, 1).setDepth(60).setStrokeStyle(3, COLOR.line);
  bg.setInteractive({
    hitArea: new Phaser.Geom.Circle(radius, radius, radius + 10),
    hitAreaCallback: Phaser.Geom.Circle.Contains,
    useHandCursor: true,
  });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    onClick();
  });
  return bg;
}

/** ホーム（ポータル）へ戻るボタン。デプロイ時は 1つ上の階層 = ポータル */
export function addHomeButton(scene: Phaser.Scene, x: number, y: number): void {
  roundButton(scene, x, y, () => {
    AudioBox.play('click');
    window.location.href = '../'; // /runner/・/mancala/ から 1つ上 = ポータル
  });
  // 家のアイコン（絵文字は端末ごとに見た目が変わるので線で描く）
  const g = scene.add.graphics().setDepth(61);
  g.fillStyle(COLOR.brown);
  g.fillTriangle(x - 11, y - 1, x, y - 11, x + 11, y - 1);
  g.fillRoundedRect(x - 7.5, y - 2, 15, 11, 2);
  g.fillStyle(COLOR.ivory).fillRoundedRect(x - 2.5, y + 2, 5, 7, 1.5);
}

/** フルスクリーン切替ボタン（コーナーブラケットのアイコン） */
export function addFullscreenButton(scene: Phaser.Scene, x: number, y: number): void {
  roundButton(scene, x, y, () => {
    AudioBox.play('click');
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
    else scene.scale.startFullscreen();
  });
  const g = scene.add.graphics().setDepth(61);
  g.lineStyle(3.5, COLOR.brown);
  const s = 8;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.beginPath();
    g.moveTo(x + dx * s, y + dy * (s - 5));
    g.lineTo(x + dx * s, y + dy * s);
    g.lineTo(x + dx * (s - 5), y + dy * s);
    g.strokePath();
  }
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
  color = 0x5b8a3c,
  shade = 0x426b2a,
  fontSize = 28,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(55);
  const shadow = scene.add
    .nineslice(0, 9, 'panel_shadow', undefined, (w + 48) * 2, (h + 48) * 2, 90, 90, 90, 90)
    .setScale(0.5);
  const g = scene.add.graphics();
  g.fillStyle(shade).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, h / 2);
  const top = scene.add.graphics();
  top.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  top.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 5, w - 20, h / 2.6, h / 4);
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#ffffff' })
    .setOrigin(0.5)
    .setShadow(0, 2, '#00000055', 3, false, true);
  c.add([shadow, g, top, text]);
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

/** 画面全体を覆う暗幕（タイトル・結果のときに盤を沈ませる） */
export function dimmer(scene: Phaser.Scene, alpha: number, depth: number): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(W / 2, H / 2, W, H, COLOR.feltDark, alpha).setDepth(depth);
}
