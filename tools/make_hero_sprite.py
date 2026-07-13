#!/usr/bin/env python3
"""せなくまラン主人公のドット絵スプライトを生成する（ビーズ忠実版）。

アップロードされたアイロンビーズ作品（assets/raw/senakuma_beads_reference.png）の
赤い服のキャラクターに忠実な、チャンキーで平坦色のドット絵に描き起こす。
ビーズ作品の特徴を再現:
  - 大きく丸いクマ耳（茶＋タン内側）
  - ボリュームのある金髪ボブ、顔は髪の中から小さくのぞく
  - フラット（べた塗り）の色。濃い茶色のビーズ輪郭
  - 赤い服・茶色のくつ

各ドットを文字グリッドで手配置し、NEAREST拡大でくっきり見せる。
進行方向（右）を向く。走り2コマ＋ジャンプの3ポーズ。

出力（games/runner-2d/public/assets/）: player.png / player_run.png / player_jump.png
"""

from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
SCALE = 11  # 1ドットを何pxに拡大するか（大きめでビーズらしいチャンキーさ）

# フラットなビーズ配色
PALETTE = {
    ".": None,
    "K": (72, 50, 36, 255),     # 輪郭（濃い茶）
    "E": (150, 101, 60, 255),   # クマ耳（茶）
    "e": (199, 154, 105, 255),  # クマ耳（内・タン）
    "H": (236, 201, 106, 255),  # 髪（金・べた）
    "h": (207, 163, 72, 255),   # 髪（影・少しだけ）
    "S": (250, 237, 217, 255),  # 肌
    "N": (232, 205, 178, 255),  # 肌影（鼻・あご）
    "Y": (74, 52, 40, 255),     # 目
    "P": (247, 167, 183, 255),  # ほっぺ
    "R": (202, 57, 55, 255),    # 服（赤）
    "r": (167, 40, 44, 255),    # 服（濃い赤）
    "W": (248, 242, 230, 255),  # 襟・そで口
    "B": (112, 75, 48, 255),    # くつ
}

# ---- 頭（全ポーズ共通）幅24 ----
# 大きな耳・ボリュームある髪・小さくのぞく顔（右向き＝目と鼻を右寄せ）
HEAD = [
    "....KK.........KK.......",
    "...KEEK.......KEEK......",
    "..KEeeEK.....KEeEK......",
    "..KEeeEK.KKK.KEeEK......",
    "..KEEEKKHHHHHKEEEK......",
    "..KKKKHHHHHHHHKKKK......",
    ".KHHHHHHHHHHHHHHHHK.....",
    ".KHHHHHHHHHHHHHHHHK.....",
    ".KHHHHHHHHHHHHHHHHHK....",
    ".KHHHHhHHHHHHHHHHHHK....",
    ".KHHHHKSSSSSSSSKHHHK....",
    ".KHHHKSSSSSSSSSSKHHK....",
    "..KHHKSSSSSSSSSSSKHKN...",
    "..KHKSSSSSSSSSSSSSKKN...",
    "..KKSSSSSYYSSSSYYSSKN...",
    "...KSSSSSYYSSSSYYSSK....",
    "...KSSSSSSSSSSSSSSSK....",
    "...KSSPPSSSSSSSPPSSK....",
    "...KSSSSSSSKKSSSSSSK....",
    "....KSSSSSSSSSSSSSK.....",
    ".....KKSSSSSSSSKK.......",
]

# ---- 胴＋脚（ポーズ別）----
BODY_A = [
    "......KrRRRRRRrK........",
    ".....KRRRRRRRRRRK.......",
    ".....KWRRRRRRRRWK.......",
    ".....KRRRRRRRRRRK.......",
    "....KRRRRRRRRRRRRK......",
    "....KrRRRRRRRRRRrK......",
    ".....KRRKKKKKKRRK.......",
    ".....KRK....KRRRK.......",
    "....KRRK....KBBBK.......",
    "....KBBBK...KBBBK.......",
    "....KBBBK....KKK........",
    ".....KKK................",
]
BODY_B = [
    "......KrRRRRRRrK........",
    ".....KRRRRRRRRRRK.......",
    ".....KWRRRRRRRRWK.......",
    ".....KRRRRRRRRRRK.......",
    "....KRRRRRRRRRRRRK......",
    "....KrRRRRRRRRRRrK......",
    ".....KRRKKKKKKRRK.......",
    "......KRRRK.KRK.........",
    "......KBBBK.KRRK........",
    ".......KBBBK.KBBBK......",
    "........KKK..KBBBK......",
    ".............KKK........",
]
BODY_JUMP = [
    "..KK..KrRRRRRRrK........",
    ".KRRKKKRRRRRRRRRK.......",
    ".KRRRRRWRRRRRRRWK.......",
    "..KRRRRRRRRRRRRRRK......",
    "...KKrRRRRRRRRRRrK......",
    ".....KRRRRRRRRRRK.......",
    "....KRRKKKKKKKRRK.......",
    "...KRRK......KRRRK......",
    "..KBBBK.......KRRK......",
    "..KBBBK.......KBBBK.....",
    "...KKK........KBBBK.....",
    ".............. KKK......",
]


def build(body, name):
    grid = HEAD + body
    h = len(grid)
    w = max(len(r) for r in grid)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            col = PALETTE.get(ch)
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
