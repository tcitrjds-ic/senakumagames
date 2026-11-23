#!/usr/bin/env python3
"""せなくま美術館の歩行キャラのドット絵スプライトシートを生成する。

各キャラを「正面・背面・横（右向き）」の3行 × 「立ち・歩きA・歩きB」の3列 = 9コマの
シートとして出力する（1マス=1px。ゲーム側で NEAREST 拡大）。住人のセルは 24×32 マス
（シート 72×96 px）。せなくまは せなくまランの主人公と同じ絵を使い、26×33 マス
（シート 78×99 px）。横向きの左向きはゲーム側で左右反転。
歩きコマは立ち絵から足の動きを機械生成する（正面・背面は片足を1行持ち上げ、横は前後の足を
開く／後ろ足を上げる。足のないキャラは legs_from=0 にすると裾を左右に揺らす）。

キャラ: せなくま（主人公。せなくまランと同じ、公式ビーズ作品を見本にした二頭身）、
        ポテトくん・くまの学芸員・うさぎの絵かき・ひよこ（館内を歩く住人。すべてオリジナル）

使い方:
    pip install Pillow
    python tools/make_pixel_chars.py [確認用コンタクトシート.png]
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

import make_hero_sprite as hero

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

# ================================================================ せなくま（主人公）
# せなくまランの主人公と同じ絵（公式のビーズ作品を見本にした二頭身）を使う。
# 正面はランナーの絵そのもの（tools/make_hero_sprite.py の頭・胴・腕・脚）で、
# ここでは美術館で必要な「背中」と「ななめ横（進む向きに顔を向けた姿）」だけを描き足す。
# 絵を2か所に持たないので、ランナー側を直せば美術館の正面も同じに直る。

# 背中: 頭の後ろは髪だけ。長い髪が背中まで下りる（頭の上12行は正面と同じ）
SENAKUMA_HEAD_BACK = hero.HEAD[:12] + [
    "KHHHHHHHHHHHHHHHHHHHHK",
    "KHHHHhHHHHHHHHHHhHHHHK",
    "KHHHHhHHHHHHHHHHhHHHHK",
    "KHHHHhHHHHHHHHHHhHHHHK",
    "KHHHHhHHHHHHHHHHhHHHHK",
    "KHHHHhHHHHHHHHHHhHHHHK",
    "KHHHHhHHHHHHHHHHhHHHHK",
    ".KHHHhHHHHHHHHHHhHHHK.",
    ".KHHHhHHHHHHHHHHhHHHK.",
    ".KHHHHHHHHHHHHHHHHHHK.",
    "..KKHHHHHHHHHHHHHHKK..",
    "....KKKKKKKKKKKKKK....",
]
SENAKUMA_BODY_BACK = [
    ".KRRRRRRRRK.",
    ".KRRRRRRRRK.",
] + hero.BODY[2:]

# ななめ横（右向き）: 顔を進む向きへ寄せ、手前の横髪は後ろへ流れる。目は2つとも見える
SENAKUMA_HEAD_SIDE = hero.HEAD[:12] + [
    "KHHHHHHHHHHSSHHHSSSHHK",
    "KHLHHHHHHHSSSSHSSSSSHK",
    "KHLHHHHHHSSSSSSSSSSSSK",
    "KHHHHHHHHSSSSSSSSSSSSK",
    "KHHHHHHHHSSSSSSSSSSSK.",
    ".KHHHHHHKSSSSSSSSSSK..",
    ".KHHHHHHHKKSSSSSSKK...",
    ".KHHHHHK...KKKKKK.....",
]
SENAKUMA_LOCKS_SIDE = [
    ".KHHHHK...............",
    ".KHHHHK...............",
    "..KKKK................",
]
SENAKUMA_FACE_SIDE = [(13, 14, ["K", "K"]), (18, 14, ["K", "K"]), (15, 16, ["PP"])]
SIDE_SHIFT = 2  # ななめ横では、体を顔の向きへ2マス寄せる

_L, _LU, _LK = hero.LEG, hero.LEG_UP, hero.LEG_KICK
SENAKUMA_POSES = {
    # 正面・背中: 片足ずつ持ち上げて とことこ歩く（持ち上げたとき体が1マス上がる）
    "front": [
        dict(dy=0, arms=hero.ARMS_DOWN, legs=[(_L, 6, 28), (_L, 12, 28)]),
        dict(dy=-1, arms=hero.ARMS_DOWN, legs=[(_LU, 6, 28), (_L, 12, 28)]),
        dict(dy=-1, arms=hero.ARMS_DOWN, legs=[(_L, 6, 28), (_LU, 12, 28)]),
    ],
    # ななめ横: ランナーの走りと同じ足運び（後ろ足を蹴り上げる → 反対の足）と腕ふり
    "side": [
        dict(dy=0, arms=hero.ARMS_DOWN, legs=[(_L, 6, 28), (_L, 12, 28)]),
        dict(dy=0, arms=[(hero.ARM_FWD_L, 4, 21), (hero.ARM_BACK_R, 15, 21)], legs=[(_LK, 3, 27), (_L, 12, 28)]),
        dict(dy=-1, arms=[(hero.ARM_BACK_L, 3, 21), (hero.ARM_FWD_R, 14, 21)], legs=[(_LU, 4, 28), (_L, 12, 28)]),
    ],
}
SENAKUMA_POSES["back"] = SENAKUMA_POSES["front"]


def senakuma_cell(view: str, pose: dict) -> Image.Image:
    """せなくまの1コマ（hero.CW x hero.FOOT_ROW マス。足の裏がコマの下端にくる）"""
    img = Image.new("RGBA", (hero.CW, hero.CH), (0, 0, 0, 0))
    px = img.load()
    bx = SIDE_SHIFT if view == "side" else 0
    ox, oy = hero.HEAD_X, hero.HEAD_Y + pose["dy"]
    # 脚は上下させない（地面に着いた足はそのまま、体だけが弾む）
    for part, x, y in pose["legs"]:
        hero.stamp(px, part, hero.HEAD_X + x + bx, hero.HEAD_Y + y)
    if view == "back":
        hero.stamp(px, SENAKUMA_BODY_BACK, ox + 5, oy + 20)
        for part, x, y in pose["arms"]:
            hero.stamp(px, part, ox + x, oy + y)
        hero.stamp(px, SENAKUMA_HEAD_BACK, ox, oy)  # 髪がいちばん手前（背中にかかる）
    else:
        hero.stamp(px, hero.BODY, ox + 5 + bx, oy + 20)
        if view == "side":
            hero.stamp(px, SENAKUMA_HEAD_SIDE, ox, oy)
            hero.stamp(px, SENAKUMA_LOCKS_SIDE, ox, oy + 20)
            face = SENAKUMA_FACE_SIDE
        else:
            hero.stamp(px, hero.HEAD, ox, oy)
            hero.stamp(px, hero.LOCKS["rest"], ox, oy + 20)
            face = hero.FACES["open"]
        for x, y, rows in face:
            hero.stamp(px, rows, ox + x, oy + y)
        for part, x, y in pose["arms"]:
            hero.stamp(px, part, ox + x + bx, oy + y)
    return img.crop((0, 0, hero.CW, hero.FOOT_ROW))


def render_senakuma() -> None:
    cw, ch = hero.CW, hero.FOOT_ROW
    sheet = Image.new("RGBA", (cw * 3, ch * 3), (0, 0, 0, 0))
    for row, view in enumerate(("front", "back", "side")):
        for col, pose in enumerate(SENAKUMA_POSES[view]):
            sheet.paste(senakuma_cell(view, pose), (col * cw, row * ch))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / "char_senakuma.png")
    print(f"wrote {OUT / 'char_senakuma.png'} ({sheet.width}x{sheet.height})")
    # タイトル画面用に、正面の立ち絵を大きく書き出す
    front = sheet.crop((0, 0, cw, ch))
    bbox = front.getbbox()
    front = front.crop(bbox).resize(((bbox[2] - bbox[0]) * 8, (bbox[3] - bbox[1]) * 8), Image.NEAREST)
    front.save(OUT / "senakuma_front.png")
    print(f"wrote {OUT / 'senakuma_front.png'} ({front.width}x{front.height})")


# ================================================================ 美術館の住人（すべてオリジナル）
# せなくまチャンネルのモチーフ（ポテト・クマ）から作った、この美術館だけのキャラクター。
# 正面・背面・横の3枚を 20マス幅で描く。足は最下段3行（左右2本）で、歩きコマは機械生成。

# ---------------------------------------------------------------- ポテトくん（歩くフライドポテト）
CHARS["potato"] = {
    "pal": {**BASE, "F": (250, 212, 92, 255), "f": (226, 172, 60, 255), "R": (222, 62, 54, 255), "r": (176, 40, 42, 255), "M": (110, 30, 30, 255)},
    "front": [
        "......KKKK..........",
        "......KFFKKKKK......",
        "...KKKKFFKFFKKKKK...",
        "...KFFKFFKFFKFFK....",
        "...KFFKFFKFFKFFK....",
        "...KFfKFfKFfKFfK....",
        "..KKKKKKKKKKKKKKKK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRYRRRRRRYRRRK..",
        "..KRRRYRRRRRRYRRRK..",
        "..KRRPRRRMMRRRPRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KRRRRRRRRRRRRRRK..",
        "...KRRRRRRRRRRRRK...",
        "...KrrrrrrrrrrrrK...",
        "....KKKKKKKKKKKK....",
        ".....KTTK..KTTK.....",
        ".....KBBK..KBBK.....",
        ".....KKKK..KKKK.....",
    ],
    "back": [
        "..........KKKK......",
        "......KKKKKFFK......",
        "...KKKKKFFKFFKKKK...",
        "....KFFKFFKFFKFFK...",
        "....KFFKFFKFFKFFK...",
        "....KfFKfFKfFKfFK...",
        "..KKKKKKKKKKKKKKKK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KRRRRRRRRRRRRRRK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KRRRRRRRRRRRRRRK..",
        "...KRRRRRRRRRRRRK...",
        "...KrrrrrrrrrrrrK...",
        "....KKKKKKKKKKKK....",
        ".....KTTK..KTTK.....",
        ".....KBBK..KBBK.....",
        ".....KKKK..KKKK.....",
    ],
    "side": [
        "........KKKK........",
        "........KFFKKKK.....",
        ".....KKKKFFKFFK.....",
        ".....KFFKFFKFFK.....",
        ".....KFFKFFKFFK.....",
        ".....KFfKFfKFfK.....",
        "....KKKKKKKKKKKK....",
        "....KRRRRRRRRRRK....",
        "....KRRRRRRRRRRK....",
        "....KRRRRRRRYRRK....",
        "....KRRRRRRRYRRK....",
        "....KRRRRRRRRRPK....",
        "....KRRRRRRRRRRK....",
        "....KWWWWWWWWWWK....",
        "....KWWWWWWWWWWK....",
        "....KRRRRRRRRRRK....",
        ".....KRRRRRRRRK.....",
        ".....KrrrrrrrrK.....",
        "......KKKKKKKK......",
        "......KTTK.KTTK.....",
        "......KBBK.KBBK.....",
        "......KKKK.KKKK.....",
    ],
    "legs_from": -3,
}

# ---------------------------------------------------------------- くまの学芸員（めがねとベスト）
CHARS["curator"] = {
    "pal": {**BASE, "E": (150, 102, 62, 255), "e": (206, 168, 124, 255), "V": (52, 78, 132, 255), "v": (36, 56, 100, 255), "D": (214, 72, 64, 255), "M": (96, 52, 36, 255)},
    "front": [
        "..KKK..........KKK..",
        ".KEEEK........KEEEK.",
        ".KEeEKKKKKKKKKKEeEK.",
        ".KEEKEEEEEEEEEEKEEK.",
        "..KKEEEEEEEEEEEEKK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEKKKKEEEEKKKKEK..",
        "..KEKWYKKKKKKYWKEK..",
        "..KEKKKKEeeEKKKKEK..",
        "..KEEEEeeYYeeEEEEK..",
        "..KEEEEeeeeeeEEEEK..",
        "...KEEEEeMMeEEEEK...",
        "....KKEEEEEEEEKK....",
        "....KVVKWDDWKVVK....",
        "...KEKVVWDDWVVKEK...",
        "...KEKVVVDDVVVKEK...",
        "...KEKVVVVVVVVKEK...",
        "....KKVVVVVVVVKK....",
        ".....KvvvvvvvvK.....",
        ".....KEEK..KEEK.....",
        ".....KBBK..KBBK.....",
        ".....KKKK..KKKK.....",
    ],
    "back": [
        "..KKK..........KKK..",
        ".KEEEK........KEEEK.",
        ".KEEEKKKKKKKKKKEEEK.",
        ".KEEKEEEEEEEEEEKEEK.",
        "..KKEEEEEEEEEEEEKK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "..KEEEEEEEEEEEEEEK..",
        "...KEEEEEEEEEEEEK...",
        "....KKEEEEEEEEKK....",
        "....KVVVVVVVVVVK....",
        "...KEKVVVVVVVVKEK...",
        "...KEKVVVVVVVVKEK...",
        "...KEKVVVVVVVVKEK...",
        "....KKVVVVVVVVKK....",
        ".....KvvvvvvvvK.....",
        ".....KEEK..KEEK.....",
        ".....KBBK..KBBK.....",
        ".....KKKK..KKKK.....",
    ],
    "side": [
        "......KKK...........",
        ".....KEEEK..........",
        ".....KEeEKKKKKK.....",
        ".....KEEEEEEEEEKK...",
        "....KEEEEEEEEEEEEK..",
        "....KEEEEEEEEEEEEK..",
        "....KEEEEEEEKKKKEK..",
        "....KEEEEEEEKYWKEKK.",
        "....KEEEEEEEKKKKeeYK",
        "....KEEEEEEEEEeeeeK.",
        "....KEEEEEEEEEeMMK..",
        ".....KEEEEEEEEEKK...",
        "......KKKEEEEKK.....",
        "......KVVVVWDK......",
        ".....KVVVEEVWDK.....",
        ".....KVVVEEVVVK.....",
        ".....KVVVEEVVVK.....",
        "......KVVVVVVK......",
        "......KvvvvvvK......",
        "......KEEK.KEEK.....",
        "......KBBK.KBBK.....",
        "......KKKK.KKKK.....",
    ],
    "legs_from": -3,
}

# ---------------------------------------------------------------- うさぎの絵かき（黄色いスモック）
CHARS["rabbit"] = {
    "pal": {**BASE, "W": (252, 250, 246, 255), "N": (236, 120, 140, 255), "G": (246, 204, 84, 255), "g": (214, 164, 56, 255), "D": (86, 150, 214, 255)},
    "front": [
        ".....KKK....KKK.....",
        "....KWWWK..KWWWK....",
        "....KWPWK..KWPWK....",
        "....KWPWK..KWPWK....",
        "....KWPWK..KWPWK....",
        "...KKWWWKKKKWWWKK...",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWYWWWWWWWWYWWK..",
        "..KWWYWWWWWWWWYWWK..",
        "..KWPPWWWNNWWWPPWK..",
        "..KWWWWWWKKWWWWWWK..",
        "...KWWWWWWWWWWWWK...",
        "....KKKKKKKKKKKK....",
        "....KGGGGDDGGGGK....",
        "...KWKGGGGGGGGKWK...",
        "...KWKGGGGGGGGKWK...",
        "....KKGGGGGGGGKK....",
        ".....KggggggggK.....",
        ".....KWWK..KWWK.....",
        ".....KWWK..KWWK.....",
        ".....KKKK..KKKK.....",
    ],
    "back": [
        ".....KKK....KKK.....",
        "....KWWWK..KWWWK....",
        "....KWWWK..KWWWK....",
        "....KWWWK..KWWWK....",
        "....KWWWK..KWWWK....",
        "...KKWWWKKKKWWWKK...",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "..KWWWWWWWWWWWWWWK..",
        "...KWWWWWWWWWWWWK...",
        "....KKKKKKKKKKKK....",
        "....KGGGGGGGGGGK....",
        "...KWKGGGGGGGGKWK...",
        "...KWKGGGWWGGGKWK...",
        "....KKGGGWWGGGKK....",
        ".....KggggggggK.....",
        ".....KWWK..KWWK.....",
        ".....KWWK..KWWK.....",
        ".....KKKK..KKKK.....",
    ],
    "side": [
        "......KKK...........",
        ".....KWWWK..........",
        ".....KWPWKK.........",
        ".....KWPWWK.........",
        ".....KWPWWK.........",
        "....KKWWWWKKKK......",
        "...KWWWWWWWWWWKK....",
        "...KWWWWWWWWWWWWK...",
        "...KWWWWWWWWWYWWK...",
        "...KWWWWWWWWWYWWNK..",
        "...KWWWWWWWWPPWWK...",
        "....KWWWWWWWWWWK....",
        ".....KKKKKKKKKK.....",
        "......KGGGGGDK......",
        ".....KGGGWWGGDK.....",
        ".....KGGGWWGGGK.....",
        "......KGGGGGGK......",
        "......KggggggK......",
        "......KWWK.KWWK.....",
        "......KWWK.KWWK.....",
        "......KKKK.KKKK.....",
    ],
    "legs_from": -3,
}

# ---------------------------------------------------------------- ひよこ（ちいさなお客さん）
CHARS["chick"] = {
    "pal": {**BASE, "Q": (252, 222, 96, 255), "q": (232, 186, 62, 255), "O": (242, 142, 48, 255)},
    "front": [
        ".........KK.........",
        "........KQQK........",
        "......KKQQQQKK......",
        "....KKQQQQQQQQKK....",
        "...KQQQQQQQQQQQQK...",
        "..KQQQQQQQQQQQQQQK..",
        "..KQQYQQQQQQQQYQQK..",
        "..KQQYQQQOOQQQYQQK..",
        "..KQPPQQOOOOQQPPQK..",
        "..KQQQQQQOOQQQQQQK..",
        ".KQQQQQQQQQQQQQQQQK.",
        ".KqQQQQQQQQQQQQQQqK.",
        ".KqQQQQQQQQQQQQQQqK.",
        "..KQQQQQQQQQQQQQQK..",
        "...KQQQQQQQQQQQQK...",
        "....KKqqqqqqqqKK....",
        "......KKKKKKKK......",
        "......KOK..KOK......",
        ".....KOOK..KOOK.....",
        ".....KKKK..KKKK.....",
    ],
    "back": [
        ".........KK.........",
        "........KQQK........",
        "......KKQQQQKK......",
        "....KKQQQQQQQQKK....",
        "...KQQQQQQQQQQQQK...",
        "..KQQQQQQQQQQQQQQK..",
        "..KQQQQQQQQQQQQQQK..",
        "..KQQQQQQQQQQQQQQK..",
        "..KQQQQQQQQQQQQQQK..",
        "..KQQQQQQQQQQQQQQK..",
        ".KQQQQQQQQQQQQQQQQK.",
        ".KqQQQQQQQQQQQQQQqK.",
        ".KqQQQQQQqqQQQQQQqK.",
        "..KQQQQQQqqQQQQQQK..",
        "...KQQQQQQQQQQQQK...",
        "....KKqqqqqqqqKK....",
        "......KKKKKKKK......",
        "......KOK..KOK......",
        ".....KOOK..KOOK.....",
        ".....KKKK..KKKK.....",
    ],
    "side": [
        ".......KK...........",
        "......KQQK..........",
        ".....KKQQQKKK.......",
        "....KQQQQQQQQKK.....",
        "...KQQQQQQQQQQQK....",
        "...KQQQQQQQQYQQK....",
        "...KQQQQQQQQYQQOOK..",
        "...KQQQQQQQPPQQOOOK.",
        "...KQQQQQQQQQQQOOK..",
        "..KQQqqqqQQQQQQK....",
        "..KQqqqqqqQQQQQK....",
        "..KQQqqqqQQQQQQK....",
        "...KQQQQQQQQQQK.....",
        "....KKqqqqqqKK......",
        "......KKKKKK........",
        "......KOK.KOK.......",
        ".....KOOK.KOOK......",
        ".....KKKK.KKKK......",
    ],
    "legs_from": -3,
}


def check_grids() -> None:
    """住人の絵は全行 20 マス幅にそろえる（ずれると輪郭が欠ける）"""
    for name, spec in CHARS.items():
        for view in ("front", "back", "side"):
            for y, row in enumerate(spec[view]):
                if len(row) != 20:
                    raise ValueError(f"{name}/{view} の {y} 行目が {len(row)} マス（20マスにそろえる）")


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


def contact_sheet(path: Path) -> None:
    """確認用: 全キャラのシートを8倍で並べる"""
    names = ["senakuma"] + list(CHARS)
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
    check_grids()
    render_senakuma()
    for name, spec in CHARS.items():
        render(name, spec)
    if len(sys.argv) > 1:
        contact_sheet(Path(sys.argv[1]))
