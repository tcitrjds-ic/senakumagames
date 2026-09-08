# senakumagames

YouTuber「せなくま」さん（[せなくまチャンネル](https://www.youtube.com/@senakumadesu)）を主人公とした2D・3Dファンゲームのプロジェクトです。

## ドキュメント

- **[GAME_PLAN.md](./GAME_PLAN.md)** — プロジェクト全体の大枠プラン（企画・素材パイプライン・技術スタック・ロードマップ）

## 成果物と進捗

1. **せなくまラン 🍟** — 2D横スクロールランナー（Phaser 3）… **プレイ可能** ✅
2. **せなくまとマンカラ 🥔** — せなくまと対戦するマンカラ（カラハ・ルール）… **プレイ可能** ✅
3. **せなくま美術館 🏰** — マリオ64のピーチ城を模した3Dの城内ホールを せなくまで歩き回り、壁の絵を鑑賞するゲーム（Three.js）… **枠は完成・絵の投入待ち** 🖼️
4. **せなくまアイランド 🏝️** — 3D箱庭探索ゲーム（Three.js + VRM）… 未着手
5. **Webポータル** — 各ゲームの入口となるページ（GitHub Pagesで公開予定）… 未着手

## 開発の始め方

```bash
npm install
npm run dev            # せなくまラン の開発サーバー
npm run dev:mancala    # せなくまとマンカラ の開発サーバー
npm run dev:gallery    # せなくま美術館 の開発サーバー
npm run build          # 全ゲームの本番ビルド（games/*/dist/）
```

## 公開（GitHub Pages）

`.github/workflows/deploy.yml` が、ポータル（`portal/`）と各ゲームを
まとめてGitHub Pagesへデプロイします。サイト構成は
`/`（ポータル）→ `/runner/`・`/mancala/`・`/gallery/`（各ゲーム）。

初回のみ設定が必要です:

1. リポジトリの **Settings → Pages → Source** を「**GitHub Actions**」にする
2. このブランチを `main` にマージする（以降は `main` へのpushで自動デプロイ）
   - すぐ試す場合は **Actions → Deploy to GitHub Pages → Run workflow** で
     このブランチを選んで手動実行もできます

公開URL: `https://<ユーザー名>.github.io/senakumagames/`

## せなくま美術館に絵を飾る

`games/gallery/public/assets/paintings/` にスクリーンショット（絵）と笑い声の音声を置き、
同じ場所の `manifest.json` にファイル名と題名を書くだけで城内ホールの壁に掛かります（コード変更不要）。
書き方は [games/gallery/public/assets/paintings/README.md](./games/gallery/public/assets/paintings/README.md) を参照。

- 操作: 左半分のバーチャルスティックで歩く／右半分ドラッグでカメラ回転／A でジャンプ（PC は WASD・矢印・Q/E・Space）
- 絵に近づいて「みる」（または絵をタップ）→ 波紋つきで拡大 → タップで題名 → タップで笑い声 → タップで閉じる
- 掛けられる場所は 16 か所（大階段の上の奥の壁 → 左右の壁 → 入口側の壁 → 中2階の下 の順に埋まる）
- 城の外観画像と3D用テクスチャ（チェック床・太陽のモザイク・石壁・空と丘の壁画・扉・窓）は `tools/make_gallery_assets.py` で生成
- 歩くキャラ（せなくま・キノピオ・マリオ・ルイージ・ピーチ）のドット絵は `tools/make_pixel_chars.py` で生成（3方向×3コマのシート）。住人は城内を自動で歩き回り、近づくとこちらを向く

## キャラクター画像

プレイヤーは**本物のサムネイルから切り抜いた実画像**（ピクセル無加工）です。
権利者の許諾を得て使用しています。

| ゲーム内ファイル | 内容 | 元画像 |
|---|---|---|
| `player.png` | 通常（走り・タイトル） | 名場面切り抜き集2026 サムネ |
| `player_jump.png` | ジャンプ中（ウインク） | リズム天国 体験版サムネ |
| `face_cry.png` | 被弾時の丸型カットイン | TotK実況サムネ（泣き顔） |
| `face_laugh.png` | リザルトの丸型カットイン | TotK実況サムネ（笑い顔） |

切り抜きは手動トレースポリゴン方式（`tools/traced_masks.py` + `tools/cut_traced.py`、
ネットワーク制限でrembgのモデルが取得できない環境向け）。丸型カットインは
`tools/make_faces.py` で生成。より高解像度の元イラストが用意できたら、
同じ手順で差し替えられます。

> キャラクター画像は権利者（せなくまさん）の許諾を得て使用します。素材を追加する際は
> `assets/raw/sources.txt` に出典を記録してください（詳細は GAME_PLAN.md セクション2参照）。
