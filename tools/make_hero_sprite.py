#!/usr/bin/env python3
"""せなくまラン主人公のドット絵スプライト（クリーン・ソリッドピクセル版）。

方針: アイロンビーズ作品のパターンに忠実だが、描画は「きれいなドット絵」。
  - 1マス = ソリッドな正方形ピクセル（テクスチャ・粒模様は入れない）
  - フラットな配色 + 最小限の影1段
  - 小さめの点目 / 大きな丸いクマ耳 / 金髪ボブ / 赤い服 / 茶のくつ
  - 顔まわりのパーツを1マスぶん右へ寄せて進行方向（右）を示す
  - 頭:体 ≒ 表参照どおり大きめの頭

出力: player.png / player_run.png / player_jump.png
"""

from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
SCALE = 12  # 1マス=12px

PAL = {
    ".": None,
    "K": (70, 48, 34, 255),     # 輪郭（こげ茶）
    "E": (140, 95, 58, 255),    # クマ耳
    "e": (200, 152, 102, 255),  # クマ耳・内側
    "H": (238, 202, 108, 255),  # 髪
    "h": (206, 164, 76, 255),   # 髪の影（サイドのみ）
    "S": (252, 238, 218, 255),  # 肌
    "Y": (56, 42, 34, 255),     # 目（点）
    "P": (248, 168, 184, 255),  # ほっぺ
    "M": (176, 88, 72, 255),    # 口
    "R": (206, 60, 58, 255),    # 服（赤）
    "r": (170, 42, 46, 255),    # 服の影
    "W": (250, 245, 233, 255),  # 襟
    "B": (110, 72, 46, 255),    # くつ
}

# ===== 頭（全ポーズ共通・幅24）=====
HEAD = [
    "...KKK..........KKK.....",
    "..KEEEK........KEEEK....",
    ".KEeeeEK......KEeeeEK...",
    ".KEeeeEKKKKKKKEeeeEK....",
    ".KEEeEKHHHHHHHKEeEEK....",
    "..KKKHHHHHHHHHHHHKKK....",
    ".KHHHHHHHHHHHHHHHHHHK...",
    ".KHHHHHHHHHHHHHHHHHHK...",
    "KHHHHHHHHHHHHHHHHHHHHK..",
    "KHHHHHHHHHHHHHHHHHHHHK..",
    "KHHHHhSSSSSSSSSShHHHHK..",
    "KHHHhSSSSSSSSSSSShHHHK..",
    ".KHHhSSSSSSSSSSSShHHK...",
    ".KHhSSSSSSSSSSSSSShHK...",
    ".KHSSSSYYSSSSSSYYSHK....",
    ".KHSSSSYYSSSSSSYYSHK....",
    ".KSSSPPSSSSSSSSPPSSK....",
    ".KSSSSSSSSSMMSSSSSSK....",
    "..KSSSSSSSSSSSSSSSK.....",
    "...KKSSSSSSSSSSSKK......",
]

# ===== 胴＋脚（ポーズ別・幅24）=====
BODY_A = [
    ".....KKWWWWWWWWKK.......",
    "....KRRRRRRRRRRRRK......",
    "...KRRRRRRRRRRRRRRK.....",
    "..KRRRRRRRRRRRRRRRRK....",
    "..KSRRRRRRRRRRRRRRSK....",
    "...KrRRRRRRRRRRRRrK.....",
    "....KKRRRRRRRRRRKK......",
    ".....KRRK....KRRK.......",
    "....KSSK......KSSK......",
    "...KSSK........KSSK.....",
    "..KBBBBK......KBBBBK....",
    "..KKKKK........KKKKK....",
]
BODY_B = [
    ".....KKWWWWWWWWKK.......",
    "....KRRRRRRRRRRRRK......",
    "...KRRRRRRRRRRRRRRK.....",
    "..KRRRRRRRRRRRRRRRRK....",
    "..KSRRRRRRRRRRRRRRSK....",
    "...KrRRRRRRRRRRRRrK.....",
    "....KKRRRRRRRRRRKK......",
    "......KRRK..KRRK........",
    "......KSSK..KSSK........",
    ".......KSSK.KSSK........",
    "......KBBBBKKBBBBK......",
    "......KKKKK..KKKKK......",
]
BODY_JUMP = [
    ".....KKWWWWWWWWKK.......",
    "....KRRRRRRRRRRRRK......",
    "...KRRRRRRRRRRRRRRK.....",
    "..KRRRRRRRRRRRRRRRRK....",
    "..KSRRRRRRRRRRRRRRSK....",
    "...KrRRRRRRRRRRRRrK.....",
    "....KKRRRRRRRRRRKK......",
    "...KRRK........KRRK.....",
    "..KSSK..........KSSK....",
    "..KBBBK.........KSSK....",
    "..KKKKK........KBBBBK...",
    "................KKKKK...",
]


def build(body, name):
    grid = HEAD + body
    w = max(len(r) for r in grid)
    h = len(grid)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            col = PAL.get(ch)
            if col:
                px[x, y] = col
    bbox = img.getchannel("A").getbbox()
    img = img.crop(bbox)
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    OUT.mkdir(parents=True, exist_ok=True)
    big.save(OUT / name)
    print(f"wrote {OUT / name} ({big.width}x{big.height})")


if __name__ == "__main__":
    build(BODY_A, "player.png")
    build(BODY_B, "player_run.png")
    build(BODY_JUMP, "player_jump.png")
