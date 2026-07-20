#!/usr/bin/env python3
"""せなくまラン主人公のドット絵スプライト（ビーズ作品に忠実・フラット版）。

方針（ユーザー確定）: アイロンビーズ作品に忠実。
  - フラット（べた塗り）の色。なめらかグラデは使わない
  - カクカクした大きめのドット（=ビーズ1粒）
  - 太い濃茶の輪郭
  - 小さめの点目（実際のせなくま寄り・素朴）
  - 大きな丸いクマ耳、金髪ボブ、赤いロンパース、茶のくつ
  - 頭:体 ≒ 4:6 のバランス、進行方向（右）向き、走り2コマ＋ジャンプ

各ドットを文字グリッドで手配置し、ビーズ風の丸みテクスチャを付けてから
NEAREST拡大する。

出力: player.png / player_run.png / player_jump.png
"""

from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
BEAD = 16  # 1ビーズの表示px

PAL = {
    ".": None,
    "K": (74, 51, 37, 255),     # 輪郭
    "E": (150, 101, 60, 255),   # 耳
    "e": (200, 154, 104, 255),  # 耳内
    "H": (236, 201, 106, 255),  # 髪
    "h": (208, 164, 74, 255),   # 髪影（最小限）
    "S": (250, 236, 216, 255),  # 肌
    "Y": (66, 47, 38, 255),     # 目（点）
    "P": (247, 166, 182, 255),  # ほっぺ
    "R": (202, 57, 55, 255),    # 服
    "r": (168, 41, 45, 255),    # 服影（最小限）
    "W": (248, 242, 230, 255),  # 襟
    "B": (112, 75, 48, 255),    # くつ
    "b": (84, 55, 36, 255),     # くつ影
    "M": (176, 84, 70, 255),    # 口
}

# ===== 頭（全ポーズ共通・幅22）=====
HEAD = [
    "..KKK.........KKK.....",
    ".KEEEK.......KEEEK....",
    ".KEeeK.......KEeeK....",
    ".KEeeKK.....KKEeeK....",
    ".KEEEKHHHHHHHKEEEK....",
    "..KKHHHHHHHHHHHKK.....",
    ".KHHHHHHHHHHHHHHHK....",
    ".KHHHHHHHHHHHHHHHK....",
    "KHHHHHHHHHHHHHHHHHK...",
    "KHHHHHHHHHHHHHHHHHK...",
    "KHHHHKKKKKKKKKHHHHK...",
    "KHHHKSSSSSSSSSKHHHK...",
    "KHHKSSSSSSSSSSSKHHK...",
    ".KHKSSSSSSSSSSSKHKh...",
    ".KKSSSSSSSSSSSSSKKh...",
    ".KSSSSYSSSSSYSSSSK....",
    ".KSSSSYSSSSSYSSSSK....",
    ".KSSSSSSSSSSSSSSSK....",
    ".KSPPSSSSSSSSSPPSK....",
    ".KSSSSSSSMMSSSSSSK....",
    "..KSSSSSSSSSSSSSK.....",
    "..KKSSSSSSSSSSSKK.....",
    "...KKSSSSSSSSSKK......",
]

# ===== 胴＋脚（ポーズ別・幅22）=====
BODY_A = [
    "....KKrRRRRRrKK......",
    "...KRRRRRRRRRRRK.....",
    "...KRWRRRRRRRWRK.....",
    "...KRRRRRRRRRRRRK....",
    "...KRRRRRRRRRRRRK....",
    "...KrRRRRRRRRRRrK....",
    "...KRRKKKKKKKKRRK....",
    "...KRRK.....KRRRK....",
    "..KSSK......KRRSK....",
    "..KSSK......KSSSK....",
    "..KBBBK.....KBBBK....",
    "..KbbbK.....KbbbK....",
    "...KKK.......KKK.....",
]
BODY_B = [
    "....KKrRRRRRrKK......",
    "...KRRRRRRRRRRRK.....",
    "...KRWRRRRRRRWRK.....",
    "...KRRRRRRRRRRRRK....",
    "...KRRRRRRRRRRRRK....",
    "...KrRRRRRRRRRRrK....",
    "...KRRKKKKKKKKRRK....",
    "....KRRRK..KRRK......",
    "....KRSSK..KSSK......",
    ".....KSSK..KSSK......",
    ".....KBBBK.KBBBK.....",
    ".....KbbbK.KbbbK.....",
    "......KKK...KKK......",
]
BODY_JUMP = [
    "..KK.KKrRRRRRrKK.....",
    ".KRRKKRRRRRRRRRK.....",
    ".KRRRRRWRRRRRWRK.....",
    "..KRRRRRRRRRRRRRK....",
    "...KrRRRRRRRRRRrK....",
    "....KRRRRRRRRRRK.....",
    "....KRRKKKKKKRRK.....",
    "...KRRK.....KRRRK....",
    "..KSSK.......KRSK....",
    "..KBBBK......KSSK....",
    "..KbbbK.....KBBBK....",
    "...KKK......KbbbK....",
    "............KKKK.....",
]


def bead_tile(col, small=False):
    """1ビーズ = 丸角の正方タイル（フラット＋左上に控えめなツヤ1点）"""
    t = Image.new("RGBA", (BEAD, BEAD), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    d.rounded_rectangle((0, 0, BEAD - 1, BEAD - 1), radius=4, fill=col)
    if small:
        return t  # 目・口など小さな要素はフラットな塗り潰し
    hl = tuple(min(255, c + 22) for c in col[:3]) + (110,)
    d.rounded_rectangle((3, 3, 6, 6), radius=2, fill=hl)   # 左上の小さなツヤ
    return t


def build(body, name):
    grid = HEAD + body
    w = max(len(r) for r in grid)
    h = len(grid)
    img = Image.new("RGBA", (w * BEAD, h * BEAD), (0, 0, 0, 0))
    cache = {}
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            col = PAL.get(ch)
            if not col:
                continue
            if ch not in cache:
                cache[ch] = bead_tile(col, small=(ch in "KYMPb"))
            img.alpha_composite(cache[ch], (x * BEAD, y * BEAD))
    bbox = img.getchannel("A").getbbox()
    img = img.crop(bbox)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name)
    print(f"wrote {OUT / name} ({img.width}x{img.height})")


if __name__ == "__main__":
    build(BODY_A, "player.png")
    build(BODY_B, "player_run.png")
    build(BODY_JUMP, "player_jump.png")
