# senakumagames

YouTuber「せなくま」さん（[せなくまチャンネル](https://www.youtube.com/@senakumadesu)）を主人公とした2D・3Dファンゲームのプロジェクトです。

## ドキュメント

- **[GAME_PLAN.md](./GAME_PLAN.md)** — プロジェクト全体の大枠プラン（企画・素材パイプライン・技術スタック・ロードマップ）

## 成果物と進捗

1. **せなくまラン 🍟** — 2D横スクロールランナー（Phaser 3）… **プレイ可能なMVP完成** ✅
2. **せなくまアイランド 🏝️** — 3D箱庭探索ゲーム（Three.js + VRM）… 未着手
3. **Webポータル** — 両ゲームの入口となるページ（GitHub Pagesで公開予定）… 未着手

## 開発の始め方

```bash
npm install
npm run dev      # せなくまランの開発サーバーを起動
npm run build    # 本番ビルド（games/runner-2d/dist/）
```

## キャラクター画像の差し替え

現在のプレイヤーはプレースホルダー（仮のクマ）です。せなくまさんの
イラスト切り抜きに差し替えるには、透過PNGを1枚用意して:

```bash
cp 切り抜き画像.png games/runner-2d/public/assets/player.png
```

だけでゲーム全体に反映されます（縦横比は自動調整）。切り抜きの作り方は
[tools/README.md](./tools/README.md) を参照。

> キャラクター画像は権利者（せなくまさん）の許諾を得て使用します。素材を追加する際は
> `assets/raw/sources.txt` に出典を記録してください（詳細は GAME_PLAN.md セクション2参照）。
