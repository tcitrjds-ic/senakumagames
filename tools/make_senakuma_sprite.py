#!/usr/bin/env python3
"""せなくまさんの描き起こしスプライトを生成する。

サムネイルを参照して描き起こした暫定スプライト（クマ耳・金髪ぱっつん・
赤い服のちびキャラ）。実画像の切り抜き（tools/cutout.py）が用意でき次第
差し替える前提。表情差分つき:

    player.png        通常（にっこり）
    player_jump.png   ジャンプ中（ウインク）
    player_hit.png    ヒット時（びっくり ・o・）
    player_happy.png  リザルト（にこにこ笑い）

使い方:
    pip install Pillow
    python tools/make_senakuma_sprite.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"

SS = 4  # スーパーサンプリング倍率（1024pxで描いて256pxへ縮小）

HAIR = (250, 216, 130, 255)
HAIR_DK = (216, 168, 82, 255)
HAIR_BACK = (238, 197, 105, 255)
SKIN = (255, 235, 218, 255)
EAR = (97, 66, 48, 255)
EAR_IN = (205, 156, 110, 255)
RED = (226, 80, 78, 255)
RED_DK = (178, 52, 56, 255)
EYE = (178, 72, 58, 255)
EYE_TOP = (140, 52, 44, 255)
LINE = (70, 40, 28, 255)
BLUSH = (255, 156, 172, 210)
MOUTH = (168, 72, 58, 255)
CREAM = (255, 246, 230, 255)


def ellipse(d, cx, cy, rx, ry, fill, outline=None, ow=0):
    if outline and ow:
        d.ellipse((cx - rx - ow, cy - ry - ow, cx + rx + ow, cy + ry + ow), fill=outline)
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def rrect(d, box, radius, fill, outline=None, ow=0):
    if outline and ow:
        x0, y0, x1, y1 = box
        d.rounded_rectangle((x0 - ow, y0 - ow, x1 + ow, y1 + ow), radius=radius + ow, fill=outline)
    d.rounded_rectangle(box, radius=radius, fill=fill)


def draw_eye_open(d, cx, cy):
    ellipse(d, cx, cy, 56, 74, EYE, outline=LINE, ow=10)
    ellipse(d, cx, cy - 32, 48, 34, EYE_TOP)          # 上側の陰
    ellipse(d, cx - 18, cy - 26, 24, 24, (255, 255, 255, 255))  # 大ハイライト
    ellipse(d, cx + 20, cy + 30, 11, 11, (255, 255, 255, 235))  # 小ハイライト


def draw_eye_closed(d, cx, cy):
    # にこっと閉じた目（n の字カーブ）
    d.arc((cx - 52, cy - 40, cx + 52, cy + 44), start=185, end=355, fill=LINE, width=18)


def make(expression: str, filename: str) -> None:
    img = Image.new("RGBA", (1024 * 1, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # --- クマ耳（髪より先に描き、根元は髪で隠す） ---
    for sx in (-1, 1):
        ellipse(d, 512 + sx * 235, 150, 105, 100, EAR, outline=LINE, ow=8)
        ellipse(d, 512 + sx * 235, 158, 56, 52, EAR_IN)

    # --- 後ろ髪 ---
    ellipse(d, 512, 430, 305, 298, HAIR_BACK, outline=HAIR_DK, ow=10)

    # --- 体（赤いパーカー） ---
    rrect(d, (360, 740, 664, 985), 95, RED, outline=RED_DK, ow=8)
    ellipse(d, 348, 850, 56, 66, RED, outline=RED_DK, ow=8)   # 腕
    ellipse(d, 676, 850, 56, 66, RED, outline=RED_DK, ow=8)
    ellipse(d, 448, 985, 52, 26, CREAM, outline=RED_DK, ow=6)  # 靴
    ellipse(d, 576, 985, 52, 26, CREAM, outline=RED_DK, ow=6)

    # --- 顔 ---
    ellipse(d, 512, 490, 262, 248, SKIN, outline=(232, 188, 160, 255), ow=8)

    # --- 前髪（ぱっつん。丸を並べて毛先を作る） ---
    ellipse(d, 512, 315, 298, 195, HAIR, outline=HAIR_DK, ow=10)
    for i, (bx, by) in enumerate([(292, 445), (400, 470), (512, 478), (624, 470), (732, 445)]):
        r = 72 if i in (1, 2, 3) else 62
        ellipse(d, bx, by, r, r, HAIR, outline=HAIR_DK, ow=8)
    # 毛先の輪郭線を消す（前髪の中を塗り直す）
    d.rectangle((225, 300, 799, 420), fill=HAIR)
    ellipse(d, 512, 315, 290, 188, HAIR)

    # --- サイドの髪（姫カット風に顔の横へ細く垂らす） ---
    for sx in (-1, 1):
        cx = 512 + sx * 268
        rrect(d, (cx - 48, 430, cx + 48, 855), 48, HAIR, outline=HAIR_DK, ow=8)
        ellipse(d, cx, 450, 52, 56, HAIR)  # 付け根をなめらかに

    # --- 表情 ---
    ly, ry_ = (387, 600), (637, 600)
    if expression == "wink":
        draw_eye_open(d, *ly)
        draw_eye_closed(d, *ry_)
    elif expression == "happy":
        draw_eye_closed(d, *ly)
        draw_eye_closed(d, *ry_)
    else:  # normal / surprised
        draw_eye_open(d, *ly)
        draw_eye_open(d, *ry_)

    ellipse(d, 316, 692, 58, 34, BLUSH)
    ellipse(d, 708, 692, 58, 34, BLUSH)

    if expression == "surprised":
        ellipse(d, 512, 705, 26, 32, MOUTH, outline=LINE, ow=6)  # ・o・
    elif expression in ("wink", "happy"):
        # 大きめの開いた口（にこにこ）
        d.pieslice((452, 665, 572, 758), start=0, end=180, fill=MOUTH)
        d.line((452, 710, 572, 710), fill=MOUTH, width=8)
    else:
        d.arc((470, 668, 554, 726), start=20, end=160, fill=MOUTH, width=12)

    out = img.resize((256, 256), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out.save(OUT_DIR / filename)
    print(f"wrote {OUT_DIR / filename}")


if __name__ == "__main__":
    make("normal", "player.png")
    make("wink", "player_jump.png")
    make("surprised", "player_hit.png")
    make("happy", "player_happy.png")
