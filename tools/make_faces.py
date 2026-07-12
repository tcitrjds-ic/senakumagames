#!/usr/bin/env python3
"""TotKサムネの顔アップを丸型カットイン画像にする。

顔部分を円形に切り出し、白いリング（実況サムネ風のステッカー縁）を
付けた透過PNGを出力する。画像のピクセル自体は無加工（円形の切り出しのみ）。
円の位置はタイムスタンプ表示（画面右下の黒帯）を避けて選んである。

使い方:
    python tools/make_faces.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[1]
SPRITES_DIR = REPO_ROOT / "assets" / "sprites"
SCALE = 2
RING = 10  # 白リングの太さ（拡大後px）

# (元画像, 円の中心, 半径, 出力名)
JOBS = [
    ("assets/raw/thumb_totk_cry.png", (62, 80), 50, "face_cry.png"),
    ("assets/raw/thumb_totk_laugh.png", (66, 84), 48, "face_laugh.png"),
]


def make(src: str, center, radius, out_name: str) -> None:
    im = Image.open(REPO_ROOT / src).convert("RGBA")
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    cx, cy, r = center[0] * SCALE, center[1] * SCALE, radius * SCALE

    size = 2 * (r + RING) + 8
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mid = size // 2

    # 白リング（円の外周）
    ring = Image.new("L", (size, size), 0)
    ImageDraw.Draw(ring).ellipse((mid - r - RING, mid - r - RING, mid + r + RING, mid + r + RING), fill=255)
    ring = ring.filter(ImageFilter.GaussianBlur(1.2))
    white = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    white.putalpha(ring)
    out.alpha_composite(white)

    # 顔の円形切り出し
    face = im.crop((cx - r, cy - r, cx + r, cy + r))
    mask = Image.new("L", face.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, face.width, face.height), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    face.putalpha(mask)
    out.alpha_composite(face, (mid - r, mid - r))

    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    out.save(SPRITES_DIR / out_name)
    print(f"wrote {SPRITES_DIR / out_name} ({size}x{size})")


if __name__ == "__main__":
    for src, center, radius, out_name in JOBS:
        make(src, center, radius, out_name)
