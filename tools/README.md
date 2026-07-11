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

※ クラウド開発環境からは YouTube への接続が遮断されているため、①は手元のPCで実行し、
   結果を `assets/raw/` にコミットして共有する。画像をチャットで受け渡してもOK。

## スクリプト一覧

| スクリプト | 役割 |
|---|---|
| `fetch_thumbnails.py` | チャンネルRSSから最新動画のサムネイルを一括ダウンロード。出典ログも記録 |
| `cutout.py` | rembg（`isnet-anime` モデル）で背景除去し、余白トリミングした透過PNGを出力 |
| `make_placeholder_assets.py` | 仮素材（クマのプレースホルダー、ポテト、岩、雲、地面）を生成 |

## 切り抜きのコツ

- 元画像は **キャラクターが大きく写っていて、他のものと重なっていない** サムネイルを選ぶ
- イラストは既定の `isnet-anime` モデル、実写が混ざる画像は `--model u2net` を試す
- 細部が欠ける場合は解像度の高い元画像を使う（可能ならイラストレーターさんの元データが最高品質）
- 出力の高さを `--height 512` で揃えておくと、ゲーム側での見た目が安定する
