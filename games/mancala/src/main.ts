import '@fontsource/m-plus-rounded-1c/400.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { W, H, RES } from './layout';

// 文字は RES 倍の解像度で描く（カメラを RES 倍に拡大して映すので、等倍のままだとぼやける）。
// すべての this.add.text(...) に効かせるため、生成口をここで1か所だけ差し替える。
const factory = Phaser.GameObjects.GameObjectFactory.prototype;
const addText = factory.text;
factory.text = function (x, y, text, style) {
  return addText.call(this, x, y, text, { resolution: RES, ...style });
};

let started = false;
function boot(): void {
  if (started) return;
  started = true;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W * RES,
    height: H * RES,
    backgroundColor: '#1d3f35',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene],
  });
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
