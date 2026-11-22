#!/usr/bin/env python3
"""せなくまラン主人公スプライト（ビーズ作品準拠・正面顔＋アニメーション付き）。

assets/raw/senakuma_beads_reference.png の「立ち姿のせなくま」を見本に、
1マス=ビーズ1粒のドット絵として描き起こしている。

見本から拾った特徴:
  - 正面向きの二頭身。左右にクマ耳、金髪はぱっつん前髪＋肩まで下がる横髪
  - 縦長の点目が2つ、目の間の少し下にピンクの口
  - 横髪に白いハイライトが1粒ずつ
  - 白い襟＋リボン、ワンピース（ゲームでは赤）、白い靴下＋茶色の靴
  - アクリルキーホルダーらしい白フチ

頭・胴・腕・脚を別パーツとして持ち、フレームごとに位置と差分を変えて合成する。
フレーム（atlas のフレーム名）:
  idle_0 / idle_1(まばたき)
  run_0..run_3   とてとて走り（脚の入れ替え＋上下動＋横髪ゆれ＋腕ふり）
  jump           上昇中（ばんざい・にこにこ目）
  fall           下降中（髪とスカートがふわっと浮く）
  hurt           ミス（＞＜の目）

出力: games/runner-2d/public/assets/hero.png + hero.json（Phaser の atlas 形式）
使い方: python3 tools/make_hero_sprite.py [--preview out.png]
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"

SCALE = 7      # 1マスを何pxで出力するか（ゲーム内では 1/2 に縮小 = 1マス3.5px で表示）
BORDER = 5     # 白フチの太さ(px, 出力解像度)
CW, CH = 26, 35  # 1フレームのマス数（全フレーム共通）
HEAD_X, HEAD_Y = 2, 2  # 基準姿勢での頭パーツの左上
FOOT_ROW = HEAD_Y + 31  # 足の裏の行（これより下は空き）

PAL = {
    "K": (64, 45, 33, 255),     # 輪郭（こげ茶）
    "E": (139, 94, 58, 255),    # クマ耳
    "e": (112, 74, 46, 255),    # クマ耳の内側
    "H": (236, 202, 112, 255),  # 髪（金）
    "h": (214, 176, 90, 255),   # 髪の影
    "L": (255, 246, 214, 255),  # 髪のハイライト
    "S": (252, 238, 216, 255),  # 肌
    "P": (247, 160, 176, 255),  # 口・ほほ（ピンク）
    "M": (176, 70, 78, 255),    # あけた口
    "W": (250, 246, 235, 255),  # 襟・靴下（白）
    "B": (86, 58, 44, 255),     # リボン
    "R": (206, 60, 58, 255),    # 服（赤）
    "r": (170, 42, 46, 255),    # 服の影
    "T": (150, 110, 70, 255),   # 靴
}

# ===== 頭（幅22）。目・口は後から差分で描く =====
HEAD = [
    "...KKKK........KKKK...",
    "..KEEEEK......KEEEEK..",
    ".KEEEEEEKKKKKKEEEEEEK.",
    ".KEeeEEKHHHHHHKEEeeEK.",
    ".KEeeEKHHHHHHHHKEeeEK.",
    "..KEEKHHHHHHHHHHKEEK..",
    "..KKHHHHHHHHHHHHHHKK..",
    ".KHHHHHHHHHHHHHHHHHHK.",
    ".KHHHHHHHHHHHHHHHHHHK.",
    "KHHHHHHHHHHHHHHHHHHHHK",
    "KHHHHHHHHHHHHHHHHHHHHK",
    "KHHHHHHHHHHHHHHHHHHHHK",
    "KHHHHHHSSHHHHSSSHHHHHK",
    "KHLHHHSSSSHSSSSSSSHHHK",
    "KHLHHSSSSSSSSSSSSSHLHK",
    "KHHHHSSSSSSSSSSSSSHLHK",
    "KHHHHSSSSSSSSSSSSSHHHK",
    ".KHHHKSSSSSSSSSSSKHHK.",
    ".KHHHHKKSSSSSSSKKHHHK.",
    ".KHHHK..KKKKKKK..KHHK.",
]

# 横髪の先（頭の下に続く。走りで左右にゆれ、落下でふわっと浮く）
LOCKS = {
    "rest": [
        ".KHHK............KHHK.",
        ".KHHK............KHHK.",
        "..KK..............KK..",
    ],
    "sway": [
        ".KHHK............KHHK.",
        "KHHK............KHHK..",
        ".KK.............KK....",
    ],
    "up": [
        "KHHHK............KHHHK",
        ".KKK..............KKK.",
        "......................",
    ],
}

# 顔の差分: (頭内x, 頭内y, 行のリスト)。'.' は上書きしない
FACES = {
    "open": [(7, 14, ["K", "K"]), (15, 14, ["K", "K"]), (10, 16, ["PP"])],
    "blink": [(6, 15, ["KK"]), (15, 15, ["KK"]), (10, 16, ["PP"])],
    "happy": [(6, 14, [".K.", "K.K"]), (14, 14, [".K.", "K.K"]), (10, 16, ["MM"]), (5, 16, ["P"]), (17, 16, ["P"])],
    "wide": [(7, 13, ["K", "K", "K"]), (15, 13, ["K", "K", "K"]), (10, 16, ["MM"])],
    "hurt": [(6, 13, ["K..", ".K.", "K.."]), (14, 13, ["..K", ".K.", "..K"]), (10, 16, ["MM"]), (10, 17, ["MM"])],
}

# ===== 胴（幅12。頭内x=5 に置く）。両肩の輪郭は下ろした腕の内側の輪郭を兼ねる =====
BODY = [
    ".KRWWBBWWRK.",
    ".KRRWBBWRRK.",
    ".KRRRRRRRRK.",
    ".KRRRRRRRRK.",
    "KRRRRRRRRRRK",
    "KRRRRRRRRRrK",
    "KrRRRRRRRrrK",
    ".KKKKKKKKKK.",
]
# 落下中: すそがふわっと広がる（幅14。頭内x=4 に置く）
BODY_FLARE = [
    "..KRWWBBWWRK..",
    "..KRRWBBWRRK..",
    "..KRRRRRRRRK..",
    ".KRRRRRRRRRRK.",
    "KRRRRRRRRRRRRK",
    "KRRRRRRRRRRRrK",
    "KKrRRRRRRRrrKK",
    "..KKKKKKKKKK..",
]

# ===== 腕（そで＋手）=====
ARM_DOWN = ["KRK", "KRK", "KSK", ".K."]
ARM_FWD_L = ["KRK.", "KRRK", ".KSK", "..K."]   # 左腕を前（体の前）へ
ARM_FWD_R = [".KRK", "KRRK", "KSK.", ".K.."]   # 右腕を前へ
ARM_BACK_L = [".KRK", "KRK.", "KSK.", ".K.."]  # 左腕を後ろ（外）へ
ARM_BACK_R = ["KRK.", ".KRK", ".KSK", "..K."]  # 右腕を後ろへ
ARM_UP_L = [".KK...", "KSSK..", "KSSK..", ".KRRK.", "..KRRK", "...KKK"]  # 斜め上にあげる（手は大きめ）
ARM_UP_R = ["...KK.", "..KSSK", "..KSSK", ".KRRK.", "KRRK..", "KKK..."]

# ===== 脚（靴下＋靴）=====
LEG = ["KWWK", "KTTK", "KKKK"]
LEG_UP = ["KTTK", "KKKK"]                    # 持ち上げた足（地面から1マス浮く）
LEG_KICK = [".KWWK", "KTTKK", "KKKK."]       # 後ろへ蹴り上げた足
LEG_TUCK_L = ["KWWK.", ".KTTK", ".KKKK"]     # 空中で内側にたたむ
LEG_TUCK_R = [".KWWK", "KTTK.", "KKKK."]

ARMS_DOWN = [(ARM_DOWN, 4, 21), (ARM_DOWN, 15, 21)]
ARMS_UP = [(ARM_UP_L, 0, 16), (ARM_UP_R, 16, 16)]

# フレーム定義:
#   dy     … 頭と胴の上下動（マイナスで上。脚は地面に残る）
#   face   … FACES のキー
#   locks  … LOCKS のキー
#   body   … "normal" / "flare"
#   arms   … [(パーツ, 頭内x, 頭内y), …]
#   legs   … [(パーツ, 頭内x, 頭内y), …]
FRAMES = {
    "idle_0": dict(dy=0, face="open", locks="rest", body="normal", arms=ARMS_DOWN,
                   legs=[(LEG, 6, 28), (LEG, 12, 28)]),
    "idle_1": dict(dy=0, face="blink", locks="rest", body="normal", arms=ARMS_DOWN,
                   legs=[(LEG, 6, 28), (LEG, 12, 28)]),
    # 踏み出し: 後ろ足を蹴り上げ、前足を進行方向（右）へ
    "run_0": dict(dy=0, face="open", locks="rest", body="normal",
                  arms=[(ARM_FWD_L, 4, 21), (ARM_BACK_R, 15, 21)],
                  legs=[(LEG_KICK, 3, 27), (LEG, 12, 28)]),
    # 両足が体の下で入れ替わる（体がいちばん高い）
    "run_1": dict(dy=-1, face="open", locks="sway", body="normal", arms=ARMS_DOWN,
                  legs=[(LEG_UP, 7, 28), (LEG, 11, 28)]),
    # 反対の足で踏み出し（腕の振りが入れ替わる）
    "run_2": dict(dy=0, face="open", locks="rest", body="normal",
                  arms=[(ARM_BACK_L, 3, 21), (ARM_FWD_R, 14, 21)],
                  legs=[(LEG_UP, 4, 28), (LEG, 12, 28)]),
    "run_3": dict(dy=-1, face="open", locks="sway", body="normal", arms=ARMS_DOWN,
                  legs=[(LEG, 7, 28), (LEG_UP, 11, 28)]),
    # 上昇中: 右手を突き上げて にこにこ
    "jump": dict(dy=0, face="happy", locks="rest", body="normal",
                 arms=[(ARM_DOWN, 4, 21), (ARM_UP_R, 16, 16)],
                 legs=[(LEG_TUCK_L, 6, 27), (LEG_TUCK_R, 11, 27)]),
    # 下降中: 髪とすそが浮いて ばんざい
    "fall": dict(dy=0, face="wide", locks="up", body="flare", arms=ARMS_UP,
                 legs=[(LEG, 5, 28), (LEG, 13, 28)]),
    # ミス: ＞＜の目で手足をばたばた
    "hurt": dict(dy=0, face="hurt", locks="up", body="normal", arms=ARMS_UP,
                 legs=[(LEG_KICK, 3, 27), (LEG_TUCK_R, 12, 27)]),
}
ORDER = ["idle_0", "idle_1", "run_0", "run_1", "run_2", "run_3", "jump", "fall", "hurt"]


def stamp(px, rows, x0, y0):
    """パーツを (x0, y0) に重ねる。'.' は透明（下を残す）。"""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == ".":
                continue
            x, y = x0 + dx, y0 + dy
            if not (0 <= x < CW and 0 <= y < CH):
                raise ValueError(f"パーツがフレーム外にはみ出した: ({x},{y})")
            px[x, y] = PAL[ch]


def check_shapes():
    for name, rows in [("HEAD", HEAD), ("BODY", BODY), ("BODY_FLARE", BODY_FLARE)] + [
        (f"LOCKS[{k}]", v) for k, v in LOCKS.items()
    ]:
        widths = {len(r) for r in rows}
        if len(widths) != 1:
            raise ValueError(f"{name} の行幅が不揃い: {sorted(widths)}")


def compose(spec):
    """1フレームぶんを CW x CH マスの画像として合成する。"""
    img = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    px = img.load()
    ox, oy = HEAD_X, HEAD_Y + spec["dy"]
    # 脚は上下動させない（接地している足は地面に残り、体だけが弾む）。重ね順: 脚 → 胴 → 頭 → 横髪 → 腕
    for part, x, y in spec["legs"]:
        stamp(px, part, HEAD_X + x, HEAD_Y + y)
    if spec["body"] == "flare":
        stamp(px, BODY_FLARE, ox + 4, oy + 20)
    else:
        stamp(px, BODY, ox + 5, oy + 20)
    stamp(px, HEAD, ox, oy)
    stamp(px, LOCKS[spec["locks"]], ox, oy + 20)
    for x, y, rows in FACES[spec["face"]]:
        stamp(px, rows, ox + x, oy + y)
    for part, x, y in spec["arms"]:
        stamp(px, part, ox + x, oy + y)
    return img


def render(img):
    """マス画像を SCALE 倍し、白フチ（キーホルダー風）を付ける。"""
    big = img.resize((CW * SCALE, CH * SCALE), Image.NEAREST)
    pad = Image.new("RGBA", (big.width + BORDER * 2, big.height + BORDER * 2), (0, 0, 0, 0))
    pad.paste(big, (BORDER, BORDER))
    alpha = pad.getchannel("A")
    # 円形に膨張させて角を丸めた白フチにする
    grown = alpha.filter(ImageFilter.MaxFilter(BORDER * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    grown = grown.point(lambda v: 255 if v > 110 else int(v * 255 / 110))
    out = Image.new("RGBA", pad.size, (255, 253, 246, 0))
    out.putalpha(grown)
    out.alpha_composite(pad)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="確認用のコンタクトシートを書き出すパス")
    args = ap.parse_args()

    check_shapes()
    frames = [render(compose(FRAMES[name])) for name in ORDER]
    fw, fh = frames[0].size
    gap = 2  # フレーム間の透明な余白（縮小時のにじみ防止）
    sheet = Image.new("RGBA", ((fw + gap) * len(frames) - gap, fh), (0, 0, 0, 0))
    atlas = {"frames": {}, "meta": {
        "image": "hero.png", "format": "RGBA8888", "scale": "1",
        "size": {"w": sheet.width, "h": sheet.height},
        # ゲーム側が位置合わせに使う値（px, 出力解像度）
        "cell": SCALE, "footY": FOOT_ROW * SCALE + BORDER,
    }}
    for i, (name, fr) in enumerate(zip(ORDER, frames)):
        x = i * (fw + gap)
        sheet.paste(fr, (x, 0))
        atlas["frames"][name] = {
            "frame": {"x": x, "y": 0, "w": fw, "h": fh},
            "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
            "sourceSize": {"w": fw, "h": fh},
        }
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / "hero.png")
    (OUT / "hero.json").write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT / 'hero.png'} ({sheet.width}x{sheet.height}, frame {fw}x{fh}, {len(frames)} frames)")
    print(f"wrote {OUT / 'hero.json'}")

    if args.preview:
        bg = Image.new("RGBA", (sheet.width + 40, sheet.height + 40), (176, 214, 160, 255))
        bg.alpha_composite(sheet, (20, 20))
        bg.save(args.preview)
        print(f"wrote {args.preview}")


if __name__ == "__main__":
    main()
