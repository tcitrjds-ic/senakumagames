import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT, FLOOR_TOP, FONT_FAMILY } from './constants';
import { AudioBox } from './audio';

export interface Parallax {
  hillsFar: Phaser.GameObjects.TileSprite;
  hillsNear: Phaser.GameObjects.TileSprite;
  clouds: Phaser.GameObjects.TileSprite;
  ground: Phaser.GameObjects.TileSprite;
}

/** 空・太陽・丘2層・雲・地面のパララックス背景を組み立てる */
export function buildBackground(scene: Phaser.Scene): Parallax {
  scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'sky').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
  scene.add.image(795, 92, 'sun').setScale(1.15);
  const clouds = scene.add.tileSprite(GAME_WIDTH / 2, 108, GAME_WIDTH, 128, 'cloud').setAlpha(0.95);
  const hillsFar = scene.add.tileSprite(GAME_WIDTH / 2, FLOOR_TOP - 100, GAME_WIDTH, 200, 'hills_far');
  const hillsNear = scene.add.tileSprite(GAME_WIDTH / 2, FLOOR_TOP - 85, GAME_WIDTH, 170, 'hills_near');
  const ground = scene.add.tileSprite(
    GAME_WIDTH / 2,
    GAME_HEIGHT - GROUND_HEIGHT / 2,
    GAME_WIDTH,
    GROUND_HEIGHT,
    'ground',
  );
  return { hillsFar, hillsNear, clouds, ground };
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
  shade = 0x47702f,
  fontSize = 28,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(55);
  const g = scene.add.graphics();
  g.fillStyle(shade).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, h / 2);
  const top = scene.add.graphics();
  top.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  top.fillStyle(0xffffff, 0.25).fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h / 2.6, h / 4);
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT_FAMILY, fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#ffffff' })
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

/** HUD用の白い半透明ピル */
export function hudPill(scene: Phaser.Scene, x: number, y: number, w: number, h: number): void {
  const g = scene.add.graphics().setDepth(9);
  g.fillStyle(0x8a5a44, 0.18).fillRoundedRect(x + 3, y + 5, w, h, h / 2);
  g.fillStyle(0xffffff, 0.92).fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(3, 0xf0d9c4).strokeRoundedRect(x, y, w, h, h / 2);
}
