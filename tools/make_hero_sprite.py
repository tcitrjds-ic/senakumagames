#!/usr/bin/env python3
"""せなくまラン主人公スプライト（ビーズ作品のパターン転写版）。

assets/raw/senakuma_beads_reference.png の「立ち姿の青服せなくま」を
写真からビーズ単位でサンプリングして転写した（tools内の校正手順で
ピッチ2.3px/粒・回転8度を推定し、マスごとに色を分類）。
本体パターンは作品に忠実、服の色だけ 青 → 赤 に置き換えている。

作品から読み取れた構造:
  - もともと右向き（進行方向）のデザイン。髪は左、顔は右側
  - 後頭部側に大きな耳、前側に小さな耳
  - 頭:体 ≒ 2:1、スカートの裾から小さな足
  - 点目 + 右ほほにチーク（口は無し = 作品どおり）

描画は 1マス=ソリッドな正方ピクセル、NEAREST拡大のクリーンなドット絵。
出力: player.png（立ち/走りA） / player_run.png（走りB） / player_jump.png
"""

from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
SCALE = 12

PAL = {
    ".": None,
    "K": (64, 45, 33, 255),     # 輪郭（こげ茶）
    "E": (139, 94, 58, 255),    # クマ耳
    "H": (235, 200, 110, 255),  # 髪（金）
    "S": (252, 238, 216, 255),  # 肌
    "Y": (56, 42, 34, 255),     # 目（点）
    "P": (247, 166, 182, 255),  # ほほ
    "W": (250, 246, 235, 255),  # 襟（白）
    "R": (206, 60, 58, 255),    # 服（赤・作品の青を置換）
    "r": (170, 42, 46, 255),    # 服の影（腕側）
    "T": (205, 165, 115, 255),  # 足（タン）
}

# ===== 頭〜胴（全ポーズ共通・幅16）=====
# 写真から読み取り: 大きな後頭部の耳(左)+小さな前耳(右)、髪は上6割、
# 顔は右下に小さく、目は髪の際に1つ、ほほは前側、細身のワンピース
TOP = [
    "...KKK..........",
    "..KEEEK.........",
    ".KEEEEEK...KK...",
    ".KEEEEEK..KEEK..",
    ".KEEEEKHHKEEEEK.",
    "..KEEKHHHHKEEK..",
    "..KKHHHHHHHKK...",
    ".KHHHHHHHHHHHK..",
    "KHHHHHHHHHHHHHK.",
    "KHHHHHHHHHHHHHK.",
    "KHHHHHHHHHHHHHK.",
    "KHHHHHHHHHHHHHK.",
    "KHHHHHKSSSSSSSK.",
    "KHHHHKYSSSSSSSK.",
    "KHHHHKYSSSSSSSK.",
    ".KHHHKSSSSSPPSK.",
    ".KHHHKSSSSSSSSK.",
    "..KHHKSSSSSSSK..",
    "...KKKSSSSSKK...",
    "....KWWWWWWK....",
    "....KRRRRRRK....",
    "...KRRRRRRRRK...",
    "...KRRRRRRRrK...",
    "..KRRRRRRRRrrK..",
    "..KRRRRRRRRRrK..",
    "..KrRRRRRRRRrK..",
    "...KKRRRRRRKK...",
]

# ===== 足（ポーズ別・幅16）=====
FEET_A = [
    "....KTTK.KTTK...",
    "....KKKK.KKKK...",
]
FEET_B = [
    ".....KTTKKTTK...",
    ".....KKKK.KKKK..",
]
FEET_JUMP = [
    "...KTTK....KTTK.",
    "...KKKK....KKKK.",
]


def build(feet, name):
    grid = TOP + feet
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
    build(FEET_A, "player.png")
    build(FEET_B, "player_run.png")
    build(FEET_JUMP, "player_jump.png")
