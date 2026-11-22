import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, EVT_OUTSIDE_DOWN, EVT_OUTSIDE_UP } from './constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { PauseScene } from './scenes/PauseScene';

let started = false;
function boot(): void {
  if (started) return;
  started = true;
  const game = new Phaser.Game({
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
    scene: [BootScene, TitleScene, GameScene, GameOverScene, PauseScene],
  });
  // キャンバスの外を押してもジャンプ・スタートできるようにする。
  // スマホを縦に持つとゲーム画面は細い帯になり、その外（指を置きやすい下側）が広く余るため。
  document.addEventListener('pointerdown', (e) => {
    if (e.target instanceof HTMLCanvasElement) return; // キャンバス上は Phaser が処理する
    game.events.emit(EVT_OUTSIDE_DOWN, e.pointerId);
  });
  // 離すほうは場所を問わず流す（外で押してキャンバス上で離しても、押しっぱなし扱いが残らないように）
  const outsideUp = (e: PointerEvent): void => {
    game.events.emit(EVT_OUTSIDE_UP, e.pointerId);
  };
  document.addEventListener('pointerup', outsideUp);
  document.addEventListener('pointercancel', outsideUp);

  // 開発時だけ、動作確認スクリプトから状態を読めるようにする（本番ビルドには含まれない）
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
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
