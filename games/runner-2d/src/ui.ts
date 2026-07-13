import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT, FLOOR_TOP, FONT_FAMILY } from './constants';
import { AudioBox } from './audio';

export interface Parallax {
  hillsFar: Phaser.GameObjects.TileSprite;
  hillsNear: Phaser.GameObjects.TileSprite;
  clouds: Phaser.GameObjects.TileSprite;
  ground: Phaser.GameObjects.TileSprite;
  sun: Phaser.GameObjects.Image;
  skySunset?: Phaser.GameObjects.Image;
  skyNight?: Phaser.GameObjects.Image;
  stars?: Phaser.GameObjects.TileSprite;
  moon?: Phaser.GameObjects.Image;
}

/**
 * 空・太陽・丘2層・雲・地面のパララックス背景を組み立てる。
 * withCycle=true で夕焼け/夜の空・星・月のレイヤーも重ねる（走行距離で遷移）。
 */
export function buildBackground(scene: Phaser.Scene, withCycle = false): Parallax {
  scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'sky').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
  let skySunset: Phaser.GameObjects.Image | undefined;
  let skyNight: Phaser.GameObjects.Image | undefined;
  let stars: Phaser.GameObjects.TileSprite | undefined;
  let moon: Phaser.GameObjects.Image | undefined;
  if (withCycle) {
    skySunset = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'sky_sunset').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0);
    skyNight = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'sky_night').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0);
    stars = scene.add.tileSprite(GAME_WIDTH / 2, 170, GAME_WIDTH, 340, 'stars').setAlpha(0);
  }
  const sun = scene.add.image(795, 92, 'sun').setScale(1.15);
  if (withCycle) moon = scene.add.image(795, 96, 'moon').setAlpha(0);
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
  // 画面四隅をほんのり暗くして映画っぽく
  scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(90);
  return { hillsFar, hillsNear, clouds, ground, sun, skySunset, skyNight, stars, moon };
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

/** ホーム（ポータル）へ戻るボタン。デプロイ時は 1つ上の階層 = ポータル */
export function addHomeButton(scene: Phaser.Scene, x: number, y: number): void {
  const bg = scene.add.circle(x, y, 24, 0xffffff, 0.9).setDepth(60).setStrokeStyle(3, 0xf0b7c8);
  scene.add.text(x, y + 1, '🏠', { fontSize: '22px' }).setOrigin(0.5).setDepth(61);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    AudioBox.play('click');
    window.location.href = '../'; // /runner/・/mancala/ から 1つ上 = ポータル
  });
}

/** フルスクリーン切替ボタン（コーナーブラケットのアイコン） */
export function addFullscreenButton(scene: Phaser.Scene, x: number, y: number): void {
  const bg = scene.add.circle(x, y, 24, 0xffffff, 0.9).setDepth(60).setStrokeStyle(3, 0xf0b7c8);
  const g = scene.add.graphics().setDepth(61);
  g.lineStyle(3.5, 0x8a5a44);
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

/** フェードアウトしてからシーンを切り替える（ぶつ切り遷移をなくす） */
export function fadeStart(scene: Phaser.Scene, key: string, data?: object): void {
  scene.cameras.main.fadeOut(240, 255, 238, 245);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

/** HUD用の白い半透明ピル */
export function hudPill(scene: Phaser.Scene, x: number, y: number, w: number, h: number): void {
  const g = scene.add.graphics().setDepth(9);
  g.fillStyle(0x8a5a44, 0.18).fillRoundedRect(x + 3, y + 5, w, h, h / 2);
  g.fillStyle(0xffffff, 0.92).fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(3, 0xf0d9c4).strokeRoundedRect(x, y, w, h, h / 2);
}
