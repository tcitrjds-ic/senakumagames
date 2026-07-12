import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

let started = false;
function boot(): void {
  if (started) return;
  started = true;
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#c3e9ff',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 1600 },
        debug: false,
      },
    },
    scene: [BootScene, TitleScene, GameScene, GameOverScene],
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
