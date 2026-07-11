#!/usr/bin/env python3
"""イラスト画像からキャラクターを切り抜いてスプライト用の透過PNGを作る。

YouTubeサムネイル等から背景を自動除去し、被写体まわりの余白を
トリミングした透過PNGを assets/sprites/ に出力する。

事前準備:
    pip install rembg onnxruntime Pillow
    （初回実行時にモデルファイルを自動ダウンロードする）

使い方:
    python tools/cutout.py                       # assets/raw/ を一括処理
    python tools/cutout.py path/to/image.jpg     # 個別ファイルを処理
    python tools/cutout.py --height 512          # 出力の高さを512pxに揃える
    python tools/cutout.py --model u2net         # 写真向けモデルに切り替え

ゲームへの反映（プレイヤー画像の差し替え）:
    cp assets/sprites/〇〇.png games/runner-2d/public/assets/player.png
"""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "assets" / "raw"
SPRITES_DIR = REPO_ROOT / "assets" / "sprites"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def collect_inputs(inputs: list[str]) -> list[Path]:
    if not inputs:
        if not RAW_DIR.exists():
            sys.exit(f"入力ファイルの指定がなく、{RAW_DIR} も存在しません。")
        return sorted(p for p in RAW_DIR.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    files: list[Path] = []
    for raw in inputs:
        p = Path(raw)
        if p.is_dir():
            files.extend(sorted(q for q in p.iterdir() if q.suffix.lower() in IMAGE_EXTS))
        elif p.is_file():
            files.append(p)
        else:
            sys.exit(f"見つかりません: {p}")
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="*", help="入力画像またはディレクトリ（省略時は assets/raw/）")
    parser.add_argument("-o", "--out", default=str(SPRITES_DIR), help="出力ディレクトリ（既定: assets/sprites/）")
    parser.add_argument("--model", default="isnet-anime", help="rembgモデル名。イラストは isnet-anime、写真は u2net が向く")
    parser.add_argument("--pad", type=int, default=16, help="トリミング時に残す余白px（既定: 16）")
    parser.add_argument("--height", type=int, default=0, help="出力の最大高さpx。0で元サイズのまま（既定: 0）")
    args = parser.parse_args()

    try:
        from PIL import Image
        from rembg import new_session, remove
    except ImportError as e:
        sys.exit(f"依存パッケージが未インストールです（{e.name}）。次を実行してください:\n  pip install rembg onnxruntime Pillow")

    files = collect_inputs(args.inputs)
    if not files:
        sys.exit("処理対象の画像がありません。assets/raw/ にサムネイル画像を置いてください。")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    session = new_session(args.model)

    for path in files:
        img = Image.open(path).convert("RGBA")
        cut = remove(img, session=session)

        # 被写体のまわりの透明領域をトリミング
        bbox = cut.getchannel("A").getbbox()
        if bbox is None:
            print(f"skip {path.name}: 被写体を検出できませんでした")
            continue
        left, top, right, bottom = bbox
        cut = cut.crop((
            max(0, left - args.pad),
            max(0, top - args.pad),
            min(cut.width, right + args.pad),
            min(cut.height, bottom + args.pad),
        ))

        if args.height and cut.height > args.height:
            new_w = round(cut.width * args.height / cut.height)
            cut = cut.resize((new_w, args.height), Image.LANCZOS)

        out_path = out_dir / f"{path.stem}.png"
        cut.save(out_path)
        print(f"{path.name} -> {out_path} ({cut.width}x{cut.height})")


if __name__ == "__main__":
    main()
