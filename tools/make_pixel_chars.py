#!/usr/bin/env python3
"""せなくま美術館の歩行キャラのドット絵スプライトシートを生成する。

各キャラを「正面・背面・横（右向き）」の3行 × 「立ち・歩きA・歩きB」の3列 = 9コマの
シートとして出力する（1マス=1px。ゲーム側で NEAREST 拡大）。セルは既定 24×32 マス
（シート 72×96 px）で、キャラごとに "cell" で上書きできる（せなくまは 32×44 マス →
シート 96×132 px）。横向きの左向きはゲーム側で左右反転。
歩きコマは立ち絵から足の動きを機械生成する（正面・背面は片足を1行持ち上げ、横は前後の足を
開く／後ろ足を上げる。ピーチはドレスなので裾を左右に揺らす）。

キャラ: せなくま（主人公・アイロンビーズ作品の意匠を踏襲: クマ耳・金髪ボブ・赤いワンピース）、
        キノピオ・マリオ・ルイージ・ピーチ（城内を歩く住人）

使い方:
    pip install Pillow
    python tools/make_pixel_chars.py [確認用コンタクトシート.png]
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "games" / "gallery" / "public" / "assets"
CW, CH = 24, 32  # 既定のセル（キャラごとに "cell" で上書き可）

BASE = {
    ".": None,
    "K": (64, 45, 33, 255),     # 輪郭（こげ茶）
    "S": (252, 232, 208, 255),  # 肌
    "s": (236, 204, 176, 255),  # 肌の影
    "Y": (56, 42, 34, 255),     # 目
    "P": (247, 166, 182, 255),  # ほほ
    "W": (250, 246, 235, 255),  # 白
    "w": (218, 212, 198, 255),  # 白の影
    "B": (104, 66, 38, 255),    # 靴
    "T": (205, 165, 115, 255),  # 足（タン）
    "G": (240, 196, 60, 255),   # 金
}

# 立ち絵の定義: (正面, 背面, 横) の3枚。行数は自由（セル内で下揃え・中央揃え）
CHARS: dict[str, dict] = {}

# ---------------------------------------------------------------- せなくま
# 実イラスト（サムネイルの切り抜き assets/sprites/senakuma_normal.png）に忠実に:
#   金髪ロング（肩下まで）・ぱっつん前髪・頭頂に白いツヤのハイライト・こげ茶の丸いクマ耳
#   大きな茶色の瞳（白いハイライト＋上下のまつ毛）・丸いピンクのほほ・小さな笑った口
#   白い丸襟（フリル）の赤い服。他キャラより細かい 32×44 マスで描く
CHARS["senakuma"] = {
    "cell": (32, 44),
    "pal": {**BASE,
            "E": (122, 80, 48, 255), "e": (162, 112, 68, 255),
            "H": (241, 205, 112, 255), "h": (216, 172, 86, 255), "k": (170, 120, 58, 255), "L": (253, 249, 238, 255),
            "S": (254, 238, 226, 255), "s": (243, 210, 192, 255),
            "Y": (74, 40, 28, 255), "y": (146, 76, 52, 255), "W": (255, 255, 255, 255),
            "P": (250, 160, 172, 255), "M": (200, 84, 92, 255),
            "R": (208, 50, 54, 255), "r": (164, 32, 40, 255), "C": (251, 248, 241, 255), "c": (222, 215, 202, 255)},
    "front": [
        "........KKKK........KKKK........",
        ".......KEEEEK......KEEEEK.......",
        "......KEeeeEEK....KEEeeeEK......",
        "......KEeeeEEKKKKKKEEeeeEK......",
        "......KEEEEKHHHHHHHHKEEEEK......",
        ".....KEEEKHHHHLLLLLHHHHKEEEK....",
        "....KKKKHHHHLLHHHHLLLHHHHKKKK...",
        "...KHHHHHHHLHHHHHHHHHLLHHHHHK...",
        "...KHHHHHHHHHHHHHHHHHHHLHHHHK...",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHhHHHhHHHHhHHHHhHHhHHHHK..",
        "..KHHHHhHHHhHHHHhHHHHhHHhHHHHK..",
        "..KHHHHkHHHkHHHHkHHHHkHHkHHHHK..",
        "..KHHHKkSSSkSSSSkSSSSkSSkKHHHK..",
        "..KHHHKSSSSSSSSSSSSSSSSSSKHHHK..",
        "..KHHHKSSKKKKSSSSSSKKKKSSKHHHK..",
        "..KHHHKSKYWYYKSSSSKYYWYKSKHHHK..",
        "..KHHHKSKYYyyKSSSSKyyYYKSKHHHK..",
        "..KHHHKSKyyWyKSSSSKyWyyKSKHHHK..",
        "..KHHHKSSKKKKSSSSSSKKKKSSKHHHK..",
        "..KHHHKSPPSSSSSSSSSSSSPPSKHHHK..",
        "..KHHHKSPPSSSSMSSMSSSSPPSKHHHK..",
        "..KHHHKSSSSSSSSMMSSSSSSSSKHHHK..",
        "..KHHHKsSSSSSSSSSSSSSSSSsKHHHK..",
        "..KHHHHKKsSSSSSSSSSSSSsKKHHHHK..",
        "..KHHHHHKKKSSSSSSSSSSKKKHHHHHK..",
        "..KHHHHHHHKKSSSSSSSSKKHHHHHHHK..",
        "..KHHHHHHKCCCCCCCCCCCCKHHHHHHK..",
        "..KHHHHHKCCCcKRRRRKcCCCKHHHHHK..",
        "...KHHHHKKcKRRRRRRRRKcKKHHHHK...",
        "...KHHHKRRKRRRRRRRRRRKRRKHHHK...",
        "....KHHKRRKRRRRRRRRRRKRRKHHK....",
        ".....KKKRRKRRRRRRRRRRKRRKKK.....",
        ".......KrRKRRRRRRRRRRKRrK.......",
        ".......KSSKRRRRRRRRRRKSSK.......",
        ".......KSSKRRRRRRRRRRKSSK.......",
        "........KKKRRRRRRRRRRKKK........",
        "..........KRRRRRRRRRRK..........",
        "..........KrrrrrrrrrrK..........",
        "...........KSSK..KSSK...........",
        "...........KBBK..KBBK...........",
        "...........KKKK..KKKK...........",
    ],
    "back": [
        "........KKKK........KKKK........",
        ".......KEEEEK......KEEEEK.......",
        "......KEEEEEEK....KEEEEEEK......",
        "......KEEEEEEKKKKKKEEEEEEK......",
        "......KEEEEKHHHHHHHHKEEEEK......",
        ".....KEEEKHHHHLLLLLHHHHKEEEK....",
        "....KKKKHHHHLLHHHHLLLHHHHKKKK...",
        "...KHHHHHHHLHHHHHHHHHLLHHHHHK...",
        "...KHHHHHHHHHHHHHHHHHHHLHHHHK...",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "..KHHHHHHHhHHHHHHHHHHhHHHHHHHK..",
        "...KHHHHHHHHHHHHHHHHHHHHHHHHK...",
        "...KHHHKRRKHHHHHHHHHHKRRKHHHK...",
        "....KHHKRRKHHHHHHHHHHKRRKHHK....",
        ".....KKKRRKHHHHHHHHHHKRRKKK.....",
        ".......KrRKhhhhhhhhhhKRrK.......",
        ".......KSSKRRRRRRRRRRKSSK.......",
        ".......KSSKRRRRRRRRRRKSSK.......",
        "........KKKRRRRRRRRRRKKK........",
        "..........KRRRRRRRRRRK..........",
        "..........KrrrrrrrrrrK..........",
        "...........KSSK..KSSK...........",
        "...........KBBK..KBBK...........",
        "...........KKKK..KKKK...........",
    ],
    "side": [
        ".......KKKK...........KKKK......",
        "......KEEEEK.........KEEEEK.....",
        ".....KEeeeEEK.......KEeeeEK.....",
        ".....KEeeeEEKKKKKKKKKEeeeEK.....",
        ".....KEEEEKHHHHHHHHHHKEEEEK.....",
        "....KEEEKHHHHHLLLLLHHHHKEEK.....",
        "....KKKKHHHHHLLHHHHLLLHHHKKK....",
        "...KHHHHHHHHHLHHHHHHHHLLHHHHK...",
        "...KHHHHHHHHHHHHHHHHHHHHLHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHHHhHHHHhHHHHK..",
        "..KHHHHHHHHHHHHHHHHhHHHHhHHHHK..",
        "..KHHHHHHHHHHHHHHHHkHHHHkHHHHK..",
        "..KHHHHHHHHHHHHHHHKkSSSkSSSSkK..",
        "..KHHHHHHHHHHHHHHHKSSSSSSSSSSK..",
        "..KHHHHHHHHHHHHHHHKSSSSSKKKKSK..",
        "..KHHHHHHHHHHHHHHHKSSSKYWYYKSK..",
        "..KHHHHHHHHHHHHHHHKSSSKYYyyKSK..",
        "..KHHHHHHHHHHHHHHHKSSSKyyWyKSK..",
        "..KHHHHHHHHHHHHHHHKSSSSKKKKSSK..",
        "..KHHHHHHHHHHHHHHHKSSSSSSSPPSK..",
        "..KHHHHHHHHHHHHHHHKSSSSSSMPPSK..",
        "..KHHHHHHHHHHHHHHHKSSSSSSSMSSK..",
        "..KHHHHHHHHHHHHHHHKsSSSSSSSSsK..",
        "..KHHHHHHHHHHHHHHHKKsSSSSSSsK...",
        "...KHHHHHHHHHHHHHHKKKSSSSSSKK...",
        "...KHHHHHHHHHHHHHHHKKKSSSSKK....",
        "...KHHHHHHHHHHHHHHHHKCCCCCCK....",
        "....KHHHHHHHHHHHHHHKCCcRRRcK....",
        "....KHHHHHHHHHHHHHKKcRRRRRcK....",
        ".....KHHHHHHHHHHHHKRRRRRRRK.....",
        "......KHHHHHHHHHHKKRRRKRRRK.....",
        ".......KKKKKKKKKKKKRRRKRrRK.....",
        "..................KRRRKSSRK.....",
        "..................KRRRKSSRK.....",
        "..................KRRRRKKRK.....",
        "..................KRRRRRRRK.....",
        "..................KRRRRRRRK.....",
        "..................KrrrrrrrK.....",
        "..................KSSK.KSSK.....",
        "..................KBBK.KBBK.....",
        "..................KKKK.KKKK.....",
    ],
    "legs_from": -3,
}

# ---------------------------------------------------------------- キノピオ
CHARS["toad"] = {
    "pal": {**BASE, "C": (250, 250, 248, 255), "c": (222, 220, 214, 255), "D": (222, 56, 48, 255), "V": (58, 96, 196, 255), "v": (40, 70, 150, 255)},
    "front": [
        "......KKKKKKKK......",
        "....KKCCCDDDDCCKK...",
        "...KCCCCDDDDDDCCCK..",
        "..KCCCCCDDDDDDCCCCK.",
        "..KCCCCCCDDDDCCCCCK.",
        ".KCDDDCCCCCCCCCDDDCK",
        ".KDDDDDCCCCCCCDDDDDK",
        ".KDDDDDCCCCCCCDDDDDK",
        ".KDDDDDCCCCCCCDDDDDK",
        ".KCDDDCCCCCCCCCDDDCK",
        ".KCCCCCCCCCCCCCCCCCK",
        ".KCCCCCCCCCCCCCCCCCK",
        "..KcccccccccccccccK.",
        "...KKKKKKKKKKKKKKK..",
        "....KSSSSSSSSSSSK...",
        "....KSYSSSSSSSYSK...",
        "....KSYSSSSSSSYSK...",
        "....KSPSSSSSSSSPK...",
        ".....KSSSSSSSSSK....",
        "......KKKKKKKKK.....",
        "....KKVVKWWKVVKK....",
        "...KSKVVKWWKVVKSK...",
        "...KSKVVVWWVVVKSK...",
        "....KKVVVWWVVVKK....",
        ".....KWWWWWWWWK.....",
        ".....KWWWK.KWWWK....",
        "....KBBBK..KBBBK....",
        "....KKKKK..KKKKK....",
    ],
    "back": [
        "......KKKKKKKK......",
        "....KKCCCDDDDCCKK...",
        "...KCCCCDDDDDDCCCK..",
        "..KCCCCCDDDDDDCCCCK.",
        "..KCCCCCCDDDDCCCCCK.",
        ".KCDDDCCCCCCCCCDDDCK",
        ".KDDDDDCCCCCCCDDDDDK",
        ".KDDDDDCCCCCCCDDDDDK",
        ".KDDDDDCCCCCCCDDDDDK",
        ".KCDDDCCCCCCCCCDDDCK",
        ".KCCCCCCCCCCCCCCCCCK",
        ".KCCCCCCCCCCCCCCCCCK",
        "..KcccccccccccccccK.",
        "...KKKKKKKKKKKKKKK..",
        "....KSSSSSSSSSSSK...",
        "....KSSSSSSSSSSSK...",
        "....KSSSSSSSSSSSK...",
        "....KSSSSSSSSSSSK...",
        ".....KSSSSSSSSSK....",
        "......KKKKKKKKK.....",
        "....KKVVVVVVVVKK....",
        "...KSKVVVVVVVVKSK...",
        "...KSKVVVVVVVVKSK...",
        "....KKvvvvvvvvKK....",
        ".....KWWWWWWWWK.....",
        ".....KWWWK.KWWWK....",
        "....KBBBK..KBBBK....",
        "....KKKKK..KKKKK....",
    ],
    "side": [
        "......KKKKKKKK......",
        "....KKCCCCDDDDCKK...",
        "...KCCCCCCDDDDDCCK..",
        "..KCCCCCCCDDDDDCCCK.",
        "..KCDDDCCCCDDDCCCCK.",
        ".KCDDDDDCCCCCCCCCCCK",
        ".KDDDDDDDCCCCCCCDDCK",
        ".KDDDDDDDCCCCCCDDDDK",
        ".KCDDDDDCCCCCCCDDDDK",
        ".KCCDDDCCCCCCCCCDDCK",
        ".KCCCCCCCCCCCCCCCCCK",
        ".KCCCCCCCCCCCCCCCCCK",
        "..KcccccccccccccccK.",
        "...KKKKKKKKKKKKKKK..",
        "......KSSSSSSSSSK...",
        "......KSSSSSSYSSK...",
        "......KSSSSSSYSSK...",
        "......KSSSSSSSSPK...",
        ".......KSSSSSSSK....",
        "........KKKKKKK.....",
        "......KKVVVVWWKK....",
        ".....KSKVVVVWWKSK...",
        ".....KSKVVVVWWKSK...",
        "......KKVVVVWWKK....",
        ".......KWWWWWWWK....",
        ".......KWWK.KWWK....",
        ".......KBBK.KBBK....",
        ".......KKKK.KKKK....",
    ],
    "legs_from": -3,
}

# ---------------------------------------------------------------- マリオ / ルイージ（共通形状・色違い）
def plumber(cap, cap_shade, shirt, overalls, overalls_shade, tall: bool):
    front = [
        "......KKKKKKKK......",
        ".....KAAAAAAAAK.....",
        "....KAAAAWWWAAAAK...",
        "....KAAAAWMWAAAAK...",
        "...KAAAAAWWWAAAAAK..",
        "..KKKKKKKKKKKKKKKKK.",
        "..KaaaaaaaaaaaaaaaK.",
        "...KNNSSSSSSSSSNNK..",
        "...KNNSSSSSSSSSNNK..",
        "...KNKSYSSSSSYSKNK..",
        "...KNKSYSSsSSYSKNK..",
        "...KNKSSSsssSSSKNK..",
        "....KKSSSsssSSSKK...",
        "....KSUUUUsUUUUSK...",
        "....KSUUUUUUUUUSK...",
        ".....KSSUUUUUSSK....",
        "......KSSSSSSSK.....",
        ".......KKKKKKK......",
        "....KKAAAAAAAAKK....",
        "...KAAKOOAAAAOOKAAK.",
        "...KAAKOOOOOOOOKAAK.",
        "...KAAKOGOOOOGOKAAK.",
        "...KWWKOOOOOOOOKWWK.",
        "...KWWKOOOOOOOOKWWK.",
        "....KKKOOOOOOOOKKK..",
        "......KOOOOOOOOK....",
        "......KOOOOOOOOK....",
        "......KooooooooK....",
        ".....KBBBK.KBBBK....",
        ".....KBBBK.KBBBK....",
        ".....KKKKK.KKKKK....",
    ]
    back = [
        "......KKKKKKKK......",
        ".....KAAAAAAAAK.....",
        "....KAAAAAAAAAAK....",
        "....KAAAAAAAAAAK....",
        "...KAAAAAAAAAAAAK...",
        "...KAAAAAAAAAAAAK...",
        "...KNNNNNNNNNNNNK...",
        "...KNNNNNNNNNNNNK...",
        "...KNNNNNNNNNNNNK...",
        "...KNNNNNNNNNNNNK...",
        "...KNNNNNNNNNNNNK...",
        "...KNnNNNNNNNNnNK...",
        "....KNNNNNNNNNNK....",
        "....KSSNNNNNNSSK....",
        ".....KSSSSSSSSK.....",
        "......KSSSSSSK......",
        "......KSSSSSSK......",
        ".......KKKKKK.......",
        "....KKAAAAAAAAKK....",
        "...KAAKOOOOOOOOKAAK.",
        "...KAAKOOOOOOOOKAAK.",
        "...KAAKOOOOOOOOKAAK.",
        "...KWWKOOOOOOOOKWWK.",
        "...KWWKOOOOOOOOKWWK.",
        "....KKKOOOOOOOOKKK..",
        "......KOOOOOOOOK....",
        "......KOOOOOOOOK....",
        "......KooooooooK....",
        ".....KBBBK.KBBBK....",
        ".....KBBBK.KBBBK....",
        ".....KKKKK.KKKKK....",
    ]
    side = [
        "......KKKKKKKK......",
        ".....KAAAAAAAAK.....",
        "....KAAAAAAAAAAK....",
        "....KAAAAAAAAAAK....",
        "...KAAAAAAAAAAAAK...",
        "...KKKKKKKKKKKKKKKK.",
        "...KNNNNNNNaaaaaaaK.",
        "...KNNNNNNSSSSSKKK..",
        "...KNNNNNSSSSSSSK...",
        "...KNNNNKSSSSYSSK...",
        "...KNNNNKSSSSYSsK...",
        "...KNNNNKSSSSSssssK.",
        "....KNNNKSSSSSSsssK.",
        "....KNNNKSSSUUUUUK..",
        ".....KKKKSSUUUUUUK..",
        "......KSSSSUUUUUK...",
        ".......KSSSSSSSK....",
        "........KKKKKK......",
        "......KKAAAAAAKK....",
        ".....KAAKOOOOOOKK...",
        ".....KAAKOOOOOOOK...",
        ".....KAAKOOOOGOOK...",
        ".....KWWKOOOOOOOK...",
        ".....KWWKOOOOOOOK...",
        "......KKKOOOOOOOK...",
        "........KOOOOOOK....",
        "........KOOOOOOK....",
        "........KooooooK....",
        ".......KBBK.KBBK....",
        ".......KBBK.KBBK....",
        ".......KKKK.KKKK....",
    ]
    if tall:
        # ルイージ: 胴を1行、足を1行のばす
        front = front[:24] + [front[24]] + front[24:]
        back = back[:24] + [back[24]] + back[24:]
        side = side[:24] + [side[24]] + side[24:]
    pal = {**BASE, "A": cap, "a": cap_shade, "M": cap, "N": (92, 58, 32, 255), "n": (70, 44, 24, 255), "U": (60, 38, 20, 255), "O": overalls, "o": overalls_shade}
    return {"pal": pal, "front": front, "back": back, "side": side, "legs_from": -3}


CHARS["mario"] = plumber((222, 48, 40, 255), (170, 32, 28, 255), (222, 48, 40, 255), (48, 84, 196, 255), (32, 60, 150, 255), tall=False)
CHARS["luigi"] = plumber((56, 170, 70, 255), (36, 120, 50, 255), (56, 170, 70, 255), (36, 64, 160, 255), (24, 44, 120, 255), tall=True)

# ---------------------------------------------------------------- ピーチ
CHARS["peach"] = {
    "pal": {**BASE, "H": (248, 220, 110, 255), "h": (224, 190, 90, 255), "R": (244, 126, 178, 255), "r": (214, 92, 146, 255), "J": (74, 140, 230, 255), "L": (232, 80, 110, 255)},
    "front": [
        ".......GKGKG........",
        ".......KGGGK........",
        ".....KKKGGGKKK......",
        "....KHHHHHHHHHHK....",
        "...KHHHHHHHHHHHHK...",
        "..KHHHHHHHHHHHHHHK..",
        "..KHHHHhHHHHHHHHHK..",
        ".KHHHKSSSSSSSSKHHHK.",
        ".KHHHKSSSSSSSSKHHHK.",
        ".KHHHKSYSSSSYSKHHHK.",
        ".KHHHKSYSSSSYSKHHHK.",
        ".KHHHKSPSSSSPSKHHHK.",
        ".KHHHKSSSSLLSSKHHHK.",
        ".KHHHKsSSSSSSsKHHHK.",
        ".KHHHHKKSSSSKKHHHHK.",
        ".KHHHHHHKKKKHHHHHHK.",
        ".KhHHHHKRRRRKHHHHhK.",
        ".KHHHHKRRJJRRKHHHHK.",
        ".KHHHHKRRJJRRKHHHHK.",
        "..KHHKRRRRRRRRKHHK..",
        "..KKKKRRRRRRRRKKKK..",
        "..KWWKRRRRRRRRKWWK..",
        "..KWWKRRRRRRRRKWWK..",
        "...KKRRRRRRRRRRKK...",
        "....KRRRRRRRRRRK....",
        "....KRRRRRRRRRRK....",
        "...KRRRRRRRRRRRRK...",
        "...KRRRRRRRRRRRRK...",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        ".KrrrrrrrrrrrrrrrrK.",
        ".KKKKKKKKKKKKKKKKKK.",
    ],
    "back": [
        ".......GKGKG........",
        ".......KGGGK........",
        ".....KKKGGGKKK......",
        "....KHHHHHHHHHHK....",
        "...KHHHHHHHHHHHHK...",
        "..KHHHHHHHHHHHHHHK..",
        "..KHHHHHHHHHHHHHHK..",
        ".KHHHHHHHHHHHHHHHHK.",
        ".KHHHHHHHHHHHHHHHHK.",
        ".KHHHHHHHHHHHHHHHHK.",
        ".KHHHHhHHHHHHhHHHHK.",
        ".KHHHHhHHHHHHhHHHHK.",
        ".KHHHHHHHHHHHHHHHHK.",
        ".KHHHHHHHHHHHHHHHHK.",
        ".KHHHHHHHHHHHHHHHHK.",
        ".KHHHHHHHhhHHHHHHHK.",
        ".KhHHHHHHHHHHHHHHhK.",
        ".KHHHHKHHHHHHKHHHHK.",
        ".KHHHHKHHHHHHKHHHHK.",
        "..KHHKRRRRRRRRKHHK..",
        "..KKKKRRRRRRRRKKKK..",
        "..KWWKRRRRRRRRKWWK..",
        "..KWWKRRRRRRRRKWWK..",
        "...KKRRRRRRRRRRKK...",
        "....KRRRRRRRRRRK....",
        "....KRRRRRRRRRRK....",
        "...KRRRRRRRRRRRRK...",
        "...KRRRRRRRRRRRRK...",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        ".KrrrrrrrrrrrrrrrrK.",
        ".KKKKKKKKKKKKKKKKKK.",
    ],
    "side": [
        ".......GKGKG........",
        ".......KGGGK........",
        ".....KKKGGGKKK......",
        "....KHHHHHHHHHK.....",
        "...KHHHHHHHHHHHK....",
        "..KHHHHHHHHHHHHHK...",
        "..KHHHHHHHHHHHHHK...",
        ".KHHHHHHHHKSSSSSK...",
        ".KHHHHHHHHKSSSSSK...",
        ".KHHHHHHHHKSSYSSK...",
        ".KHHHHHHHHKSSYSSK...",
        ".KHHHHHHHHKSSSSPK...",
        ".KHHHHHHHHKSSSLSK...",
        ".KHHHHHHHHKsSSSK....",
        ".KHHHHHHHHHKKKK.....",
        ".KHHHHHHHHHKRRK.....",
        ".KhHHHHHHHKRRRRK....",
        ".KHHHHHHHHKRJRRK....",
        ".KHHHHHHHHKRRRRK....",
        "..KHHHHHHKRRRRRSK...",
        "..KKKKKKKRRRRRWWK...",
        ".......KRRRRRRWWK...",
        ".......KRRRRRRKK....",
        ".......KRRRRRRRK....",
        "......KRRRRRRRRK....",
        "......KRRRRRRRRK....",
        ".....KRRRRRRRRRRK...",
        ".....KRRRRRRRRRRK...",
        "....KRRRRRRRRRRRRK..",
        "....KRRRRRRRRRRRRK..",
        "...KrrrrrrrrrrrrrrK.",
        "...KKKKKKKKKKKKKKKK.",
    ],
    "legs_from": 0,  # ドレスなので足の歩きは無し（裾を揺らす）
}


def to_grid(rows: list[str], CW: int = CW, CH: int = CH) -> list[list[str]]:
    w = max(len(r) for r in rows)
    assert w <= CW and len(rows) <= CH, (w, len(rows))
    g = [list(r.ljust(w, ".")) for r in rows]
    # セル内で下揃え・中央揃え
    left = (CW - w) // 2
    top = CH - len(rows)
    out = [["."] * CW for _ in range(CH)]
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            out[top + y][left + x] = ch
    return out


def leg_columns(grid, legs_from: int) -> list[tuple[int, int]]:
    """足の行にある不透明な列を、左右の足の範囲に分ける"""
    if legs_from == 0:
        return []
    rows = grid[legs_from:]
    cols = [x for x in range(len(grid[0])) if any(r[x] != "." for r in rows)]
    ranges: list[list[int]] = []
    for c in cols:
        if ranges and c == ranges[-1][-1] + 1:
            ranges[-1].append(c)
        else:
            ranges.append([c])
    return [(r[0], r[-1]) for r in ranges]


def lift_leg(grid, legs_from, rng):
    """指定の列範囲の足を1行持ち上げる（正面・背面の歩き）"""
    g = [row[:] for row in grid]
    CH = len(grid)
    x0, x1 = rng
    for y in range(CH + legs_from, CH - 1):
        for x in range(x0, x1 + 1):
            g[y][x] = grid[y + 1][x]
    for x in range(x0, x1 + 1):
        g[CH - 1][x] = "."
    return g


def spread_legs(grid, legs_from, ranges, d):
    """横向き: 後ろ足を -d、前足を +d 列ずらす"""
    g = [row[:] for row in grid]
    CH, CW = len(grid), len(grid[0])
    for y in range(CH + legs_from, CH):
        for x in range(CW):
            g[y][x] = "."
    for i, (x0, x1) in enumerate(ranges[:2]):
        shift = -d if i == 0 else d
        for y in range(CH + legs_from, CH):
            for x in range(x0, x1 + 1):
                nx = x + shift
                if 0 <= nx < CW and grid[y][x] != ".":
                    g[y][nx] = grid[y][x]
    return g


def sway_hem(grid, d):
    """ドレス: 最下段2行を左右にずらして裾を揺らす"""
    g = [row[:] for row in grid]
    CH, CW = len(grid), len(grid[0])
    for y in (CH - 2, CH - 1):
        g[y] = ["."] * CW
        for x in range(CW):
            nx = x + d
            if 0 <= nx < CW:
                g[y][nx] = grid[y][x]
    return g


def frames_for(spec, view: str) -> list[list[list[str]]]:
    cw, ch = spec.get("cell", (CW, CH))
    grid = to_grid(spec[view], cw, ch)
    lf = spec["legs_from"]
    if lf == 0:
        return [grid, sway_hem(grid, -1), sway_hem(grid, 1)]
    ranges = leg_columns(grid, lf)
    if view == "side":
        return [grid, spread_legs(grid, lf, ranges, 1), lift_leg(grid, lf, ranges[0])]
    if len(ranges) >= 2:
        return [grid, lift_leg(grid, lf, ranges[0]), lift_leg(grid, lf, ranges[-1])]
    return [grid, grid, grid]


def render(name: str, spec) -> None:
    CW, CH = spec.get("cell", (24, 32))
    sheet = Image.new("RGBA", (CW * 3, CH * 3), (0, 0, 0, 0))
    pal = spec["pal"]
    for row, view in enumerate(("front", "back", "side")):
        for col, grid in enumerate(frames_for(spec, view)):
            for y in range(CH):
                for x in range(CW):
                    c = pal.get(grid[y][x])
                    if c is None:
                        if grid[y][x] != ".":
                            raise KeyError(f"{name}/{view}: unknown color '{grid[y][x]}' at {x},{y}")
                        continue
                    sheet.putpixel((col * CW + x, row * CH + y), c)
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"char_{name}.png"
    sheet.save(p)
    print(f"wrote {p} ({sheet.width}x{sheet.height})")
    if name == "senakuma":
        # タイトル画面用に正面立ち絵を大きく書き出す
        front = sheet.crop((0, 0, CW, CH))
        bbox = front.getbbox()
        front = front.crop(bbox).resize(((bbox[2] - bbox[0]) * 8, (bbox[3] - bbox[1]) * 8), Image.NEAREST)
        front.save(OUT / "senakuma_front.png")
        print(f"wrote {OUT / 'senakuma_front.png'} ({front.width}x{front.height})")


def contact_sheet(path: Path) -> None:
    """確認用: 全キャラのシートを8倍で並べる"""
    names = list(CHARS)
    imgs = [Image.open(OUT / f"char_{n}.png") for n in names]
    k = 8
    sheet = Image.new("RGBA", (sum(i.width * k + 16 for i in imgs), max(i.height for i in imgs) * k), (90, 120, 160, 255))
    x = 0
    for im in imgs:
        sheet.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST), (x, 0))
        x += im.width * k + 16
    sheet.save(path)


if __name__ == "__main__":
    import sys
    for name, spec in CHARS.items():
        render(name, spec)
    if len(sys.argv) > 1:
        contact_sheet(Path(sys.argv[1]))
