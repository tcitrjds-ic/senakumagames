import Phaser from 'phaser';
import { AudioBox } from './audio';

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", system-ui, sans-serif';

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
