#!/usr/bin/env python3
"""せなくまラン主人公のドット絵スプライトを生成する（プロ品質版）。

アイロンビーズ作品（assets/raw/senakuma_beads_reference.png）の赤い服の
せなくまを参照に、陰影ランプ・立体感・表情を作り込んだ本格ドット絵に描き起こす。

技法:
  - 各素材に 3〜4段階の色ランプ（ハイライト/中間/影/最暗）
  - 光源は左上。上左に光、下右に影
  - シルエットは濃い茶の縁取り（純黒は使わない）
  - 目にハイライト＆下反射光、まつ毛、ほお、口
  - 論理解像度で描き、NEAREST拡大でくっきりしたドット絵に

進行方向（右）を向く3/4ビュー。走り2コマ＋ジャンプ。

出力: player.png / player_run.png / player_jump.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
W, Hh = 48, 56
SCALE = 8

# ---- 色ランプ ----
OUT_C = (58, 40, 30, 255)       # シルエット輪郭
# 髪（金）
HL = (250, 231, 156, 255)
HM = (235, 201, 104, 255)
HS = (205, 162, 70, 255)
HD = (172, 130, 56, 255)
# 肌
SL = (255, 245, 230, 255)
SM = (250, 233, 210, 255)
SS = (233, 203, 176, 255)
SD = (210, 176, 148, 255)
# クマ耳
EL = (178, 130, 86, 255)
EM = (144, 99, 60, 255)
ED = (110, 74, 44, 255)
EIN = (208, 160, 112, 255)
# 服（赤）
RL = (223, 98, 92, 255)
RM = (202, 58, 56, 255)
RS = (168, 40, 44, 255)
RD = (132, 28, 38, 255)
# 白（襟・そで）
WL = (255, 255, 252, 255)
WM = (238, 230, 216, 255)
# くつ
BM = (116, 78, 50, 255)
BD = (84, 55, 36, 255)
# 目
EYE = (54, 40, 34, 255)
EYE2 = (92, 66, 54, 255)
WHITE = (255, 255, 255, 255)
REFL = (196, 224, 236, 255)
BLUSH = (247, 168, 182, 255)
MOUTH = (176, 84, 70, 255)


def ell(d, cx, cy, rx, ry, col):
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=col)


def draw_head(im):
    d = ImageDraw.Draw(im)
    cx = 24  # 顔まわりの基準。右向きなので顔パーツは少し右へ

    # ===== クマ耳（頭より先に）=====
    for ex, ey, r, far in [(15, 9, 5.5, False), (33, 8, 4.8, True)]:
        ell(d, ex, ey, r, r, EM)
        ell(d, ex, ey + 1.2, r * 0.9, r * 0.85, EM)
        ell(d, ex, ey + r * 0.35, r * 0.66, r * 0.6, EIN)     # 内側タン
        ell(d, ex - r * 0.35, ey - r * 0.35, r * 0.42, r * 0.4, EL)  # 上左ハイライト
        d.arc((ex - r, ey - r + 1, ex + r, ey + r + 1), 20, 160, fill=ED, width=1)  # 下の影

    # ===== 髪ベース =====
    ell(d, cx - 1, 20, 17, 16, HM)
    ell(d, 9, 24, 5, 8, HM)        # 左サイド毛
    ell(d, 38, 23, 4.5, 7, HM)     # 右サイド毛（奥・細め）

    # ===== 顔（右に寄せる）=====
    ell(d, cx + 1, 25, 12.5, 12, SM)
    ell(d, cx + 1, 28, 11, 9.5, SM)

    # 顔の陰影（控えめに・濁らせない）
    ell(d, cx - 3, 22, 7, 4, SL)               # 上左ハイライト
    d.pieslice((cx - 6, 31, cx + 12, 39), 20, 150, fill=SS)   # 下あごのやわらか影
    ell(d, cx + 10, 27, 2.4, 4, SS)            # 右ほほ影（奥）

    # ===== 前髪（ぱっつん・中央わけ、顔の上を覆う）=====
    d.rounded_rectangle((cx - 15, 11, cx + 15, 21), radius=6, fill=HM)
    for bx, by, br in [(cx - 13, 21, 4.5), (cx - 7, 23, 5.5), (cx - 1, 22, 3.2),
                       (cx + 5, 23, 5.5), (cx + 12, 22, 4.5)]:
        ell(d, bx, by, br, br, HM)
    # 中央わけ（V字に肌を少しのぞかせる）
    d.polygon([(cx - 1, 19), (cx - 3, 23), (cx + 1, 23)], fill=SM)
    # サイド髪を顔の横に垂らす
    ell(d, cx - 13, 26, 3.5, 9, HM)
    ell(d, cx + 14, 25, 3.2, 8, HM)

    # 髪ハイライト＆影（立体・線は使わず面で）
    ell(d, cx - 6, 13, 9, 2.4, HL)       # 上のツヤ帯
    ell(d, cx - 13, 13, 4, 2, HL)
    ell(d, cx - 12, 25, 2.4, 6, HS)      # 左サイド影
    ell(d, cx + 13, 24, 2.2, 6, HS)      # 右サイド影
    ell(d, cx - 8, 20, 6, 1.4, HS)       # 前髪の毛先ライン（自然な段）
    ell(d, cx + 6, 20, 5, 1.4, HS)
    # 前髪が顔に落とす影（毛先のすぐ下、薄く）
    d.pieslice((cx - 11, 20, cx + 12, 27), 200, 340, fill=SS)

    # ===== 目（右向き＝右寄り。左=手前で大きめ）=====
    for (ex, ey, w2, h2) in [(cx - 2, 27, 2.6, 3.6), (cx + 8, 27, 2.2, 3.2)]:
        ell(d, ex, ey, w2, h2, EYE)
        ell(d, ex, ey + h2 * 0.45, w2 * 0.72, h2 * 0.45, EYE2)     # 下側やや明るく
        d.point((int(ex - w2 * 0.45), int(ey - h2 * 0.45)), fill=WHITE)   # 上ハイライト
        d.point((int(ex - w2 * 0.45) + 1, int(ey - h2 * 0.45)), fill=WHITE)
        d.point((int(ex + w2 * 0.35), int(ey + h2 * 0.55)), fill=REFL)    # 下反射光
        d.point((int(ex - w2 - 1), int(ey - h2 + 0.5)), fill=EYE)         # まつ毛

    # ===== ほお・鼻・口 =====
    ell(d, cx - 6, 31, 3, 2, BLUSH)
    ell(d, cx + 11, 31, 2.4, 1.8, BLUSH)
    d.point((int(cx + 13), int(29)), fill=SD)          # 右シルエットの鼻先
    d.line((cx + 2, 32, cx + 4, 33), fill=MOUTH, width=1)
    d.line((cx + 4, 33, cx + 6, 32), fill=MOUTH, width=1)


def draw_body(im, pose):
    d = ImageDraw.Draw(im)
    cx = 24

    # ---- 脚（胴より先）----
    def leg(hx, hy, dx, front):
        c = RM if front else RS
        s = BM if front else BD
        fx = hx + dx
        d.line((hx, hy, fx, hy + 5), fill=c, width=3)
        d.line((hx, hy, fx, hy + 5), fill=(RL if front else RS), width=1)
        ell(d, fx + 1, hy + 6, 3, 2, s)
        d.point((int(fx), int(hy + 5)), fill=(RD if not front else RS))

    if pose == 'a':
        leg(cx + 4, 44, 4, True); leg(cx - 3, 44, -3, False)
    elif pose == 'b':
        leg(cx + 1, 44, -3, True); leg(cx - 1, 44, 4, False)
    else:
        leg(cx + 6, 42, 5, True); leg(cx - 2, 43, -4, False)

    # ---- 胴（赤いロンパース）----
    d.rounded_rectangle((cx - 10, 35, cx + 10, 47), radius=7, fill=RM)
    ell(d, cx, 46, 10, 4, RM)
    # 立体: 左上ハイライト / 右下影 / 最暗
    d.rounded_rectangle((cx - 9, 36, cx - 3, 44), radius=3, fill=RL)
    ell(d, cx + 7, 44, 3.4, 4, RS)
    d.arc((cx - 10, 40, cx + 10, 52), 20, 160, fill=RD, width=1)
    # 襟（白・影つき）
    ell(d, cx + 1, 36, 5, 2.2, WL)
    d.point((int(cx + 4), int(37)), fill=WM)

    # ---- 腕（先に手の肌）----
    def arm(ax, ay, front):
        c = RM if front else RS
        ell(d, ax, ay, 2.2, 3.2, c)
        ell(d, ax - 0.6, ay - 0.6, 1, 1.4, (RL if front else RM))  # 上のハイライト
        ell(d, ax, ay + 3, 1.6, 1.4, SM)                           # 手（肌）
    if pose == 'a':
        arm(cx + 11, 40, True); arm(cx - 11, 41, False)
    elif pose == 'b':
        arm(cx + 10, 41, True); arm(cx - 10, 40, False)
    else:
        arm(cx + 12, 38, True); arm(cx - 11, 43, False)


def build(pose, name):
    im = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
    draw_body(im, pose)
    draw_head(im)

    # ---- シルエット輪郭（アルファ膨張・濃い茶）----
    alpha = im.getchannel("A")
    ring = alpha.filter(ImageFilter.MaxFilter(3))
    base = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ol = Image.new("RGBA", im.size, OUT_C)
    ol.putalpha(ring)
    base.alpha_composite(ol)
    base.alpha_composite(im)
    im = base

    bbox = im.getchannel("A").getbbox()
    im = im.crop(bbox)
    big = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
    OUT.mkdir(parents=True, exist_ok=True)
    big.save(OUT / name)
    print(f"wrote {OUT / name} ({big.width}x{big.height})")


if __name__ == "__main__":
    build('a', "player.png")
    build('b', "player_run.png")
    build('jump', "player_jump.png")
