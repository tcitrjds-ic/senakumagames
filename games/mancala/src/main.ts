import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

let started = false;
function boot(): void {
  if (started) return;
  started = true;
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 540,
    backgroundColor: '#ffeef5',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene],
  });
}

// Canvasに描く前にWebフォントを読み込む（失敗してもフォールバックで起動）
const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
Promise.race([
  Promise.all([
    document.fonts.load('700 32px "M PLUS Rounded 1c"'),
    document.fonts.load('400 24px "M PLUS Rounded 1c"'),
  ]),
  timeout,
]).then(boot, boot);
