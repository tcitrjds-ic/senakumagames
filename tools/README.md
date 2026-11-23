# 素材制作ツール

サムネイル取得 → 切り抜き → ゲームへの反映、という素材パイプラインのスクリプト集。

## ワークフロー

```
① 収集（手元のPCで実行 ※）
   python tools/fetch_thumbnails.py --channel https://www.youtube.com/@senakumadesu
   → assets/raw/ にサムネイルJPGと出典ログ(sources.txt)が保存される

② 切り抜き
   pip install rembg onnxruntime Pillow
   python tools/cutout.py --height 512
   → assets/sprites/ に背景除去済みの透過PNGが保存される

③ ゲームへ反映（一番よく撮れたものを選んでコピー）
   cp assets/sprites/〇〇.png games/runner-2d/public/assets/player.png
```

※ クラウド開発環境からは YouTube への接続が遮断されているため、①は手元のPCで実行する。
   サムネイル原本にはゲーム会社のロゴやキャラクターが写っていることが多いので、
   **原本（`assets/raw/thumb_*`）はコミットしない**（`.gitignore` 済み）。
   リポジトリに入れるのは、せなくまさんだけを切り抜いた結果（`assets/sprites/`）と出典の記録だけ。

## スクリプト一覧

| スクリプト | 役割 |
|---|---|
| `fetch_thumbnails.py` | チャンネルRSSから最新動画のサムネイルを一括ダウンロード。出典ログも記録 |
| `cutout.py` | rembg（`isnet-anime` モデル）で背景除去し、余白トリミングした透過PNGを出力 |
| `traced_masks.py` + `cut_traced.py` | rembgが使えない環境向けの手動トレース切り抜き（ポリゴン定義と実行） |
| `make_faces.py` | 顔アップ画像をサムネ風の丸型カットイン（白リング付き）に加工 |
| `make_game_assets.py` | せなくまランの素材一式を生成（白フチステッカー調の小物、空・丘・地面、パーティクル） |
| `make_mancala_assets.py` | マンカラの素材を生成（陰影を計算した木製の盤、ポテト石、フェルト、光る輪、落ち影）。要 `numpy`。`--preview` で確認用画像も出力 |
| `make_hero_sprite.py` | せなくまランの主人公ドット絵（`hero.png` + `hero.json`）を生成。頭・胴・腕・脚のパーツをコマごとに組み合わせる。`--preview` で確認用画像も出力 |
| `make_pixel_chars.py` | せなくま美術館の歩行キャラ（せなくま・ポテトくん・くまの学芸員・うさぎの絵かき・ひよこ）のドット絵シートを生成（正面/背面/横 の3行 × 立ち/歩きA/歩きB の3列。セルは既定24×32マス、せなくまは32×44マス）。住人はすべてオリジナル |
| `make_gallery_assets.py` | せなくま美術館の素材を生成（クマの頭の形をした建物の外観と、館内用の寄木の床・腰板・壁紙・格天井・天窓・敷物・ラグ・扉・窓・クマの紋章の丸窓）。すべてオリジナルデザイン。要 `numpy` |
| `clean_cutout_edges.py` | 切り抜き画像のふちに残った元サムネイルの背景の切れ端を、指定した範囲だけ取りのぞく |
| `verify_live.cjs` | 公開サイトを実際にブラウザで開いて確認する（ポータル・3ゲームの読み込み、素材、美術館の向きとカメラ）。デプロイのあとに実行する。`--shots 出力先` で各画面の画像も保存 |
| `make_senakuma_sprite.py` | （旧）描き起こしスプライトの生成。実画像切り抜き導入前の暫定版 |

## 切り抜きのコツ

- 元画像は **キャラクターが大きく写っていて、他のものと重なっていない** サムネイルを選ぶ
- イラストは既定の `isnet-anime` モデル、実写が混ざる画像は `--model u2net` を試す
- 細部が欠ける場合は解像度の高い元画像を使う（可能ならイラストレーターさんの元データが最高品質）
- 出力の高さを `--height 512` で揃えておくと、ゲーム側での見た目が安定する
