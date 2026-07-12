#!/usr/bin/env python3
"""traced_masks.py の手動トレースポリゴンでキャラクターを切り抜く。

rembg が使えない環境向けの決定的な切り抜き。元画像を4倍に拡大してから
ポリゴンマスク（軽いフェザー付き）を適用するので、輪郭が滑らかに出る。
出力は assets/sprites/ の透過PNG。

使い方:
    python tools/cut_traced.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

import traced_masks as tm

REPO_ROOT = Path(__file__).resolve().parents[1]
SPRITES_DIR = REPO_ROOT / "assets" / "sprites"
SCALE = 4  # 拡大率（滑らかなエッジのため）

JOBS = [
    ("assets/raw/thumb_meibamen2026.png", tm.NORMAL_CROP, tm.NORMAL_OUTER, tm.NORMAL_HOLES, "senakuma_normal.png"),
    ("assets/raw/thumb_rhythm_pair.png", tm.WINK_CROP, tm.WINK_OUTER, tm.WINK_HOLES, "senakuma_wink.png"),
]


def cut(src: str, box, outer, holes, out_name: str) -> Image.Image:
    im = Image.open(REPO_ROOT / src).convert("RGBA").crop(box)
    big = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)

    mask = Image.new("L", big.size, 0)
    d = ImageDraw.Draw(mask)
    d.polygon([(x * SCALE, y * SCALE) for x, y in outer], fill=255)
    for hole in holes:
        d.polygon([(x * SCALE, y * SCALE) for x, y in hole], fill=0)
    # 端に残る背景を軽く削ってから、エッジを滑らかにする
    mask = mask.filter(ImageFilter.MinFilter(5))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.5))

    big.putalpha(mask)
    bbox = big.getchannel("A").getbbox()
    big = big.crop(bbox)

    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    out_path = SPRITES_DIR / out_name
    big.save(out_path)
    print(f"wrote {out_path} ({big.width}x{big.height})")
    return big


def checker_preview(sprite: Image.Image, out_path: Path) -> None:
    board = Image.new("RGBA", sprite.size, (255, 255, 255, 255))
    d = ImageDraw.Draw(board)
    step = 16
    for y in range(0, sprite.height, step):
        for x in range(0, sprite.width, step):
            if (x // step + y // step) % 2 == 0:
                d.rectangle((x, y, x + step - 1, y + step - 1), fill=(200, 200, 205, 255))
    board.alpha_composite(sprite)
    board.save(out_path)


if __name__ == "__main__":
    import sys

    preview_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    for src, box, outer, holes, out_name in JOBS:
        sprite = cut(src, box, outer, holes, out_name)
        if preview_dir:
            checker_preview(sprite, preview_dir / f"check_{out_name}")
