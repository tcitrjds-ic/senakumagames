#!/usr/bin/env python3
"""せなくまラン主人公のドット絵スプライトを生成する（プロ品質・正プロポーション版）。

アイロンビーズ作品（assets/raw/senakuma_beads_reference.png）の せなくま を
参照に描き起こす。参照の立ち姿（青キャラ）から得た知見を反映:
  - 頭：体 ≒ 4：6 のスリムなプロポーション（頭でっかちにしない）
  - 流れのある金髪＋縦のツヤ、ぱっつん前髪、小さな顔
  - 体には胴・腕・脚がしっかりあり、走りが分かる
  - 赤いロンパース、茶色のくつ

技法: 各素材3〜4段階の色ランプ、左上光源の立体陰影、表情のある目、
      濃い茶の縁取り。論理解像度→NEAREST拡大。進行方向（右）向き。

出力: player.png / player_run.png / player_jump.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
W, Hh = 42, 60
SCALE = 9

OUT_C = (58, 40, 30, 255)
# 髪
HL = (250, 231, 156, 255); HM = (235, 201, 104, 255); HS = (203, 160, 68, 255); HD = (170, 128, 54, 255)
# 肌
SL = (255, 246, 232, 255); SM = (250, 233, 210, 255); SS = (233, 203, 176, 255); SD = (210, 176, 148, 255)
# 耳
EL = (178, 130, 86, 255); EM = (142, 97, 58, 255); ED = (108, 72, 42, 255); EIN = (208, 160, 112, 255)
# 赤い服
RL = (223, 98, 92, 255); RM = (202, 58, 56, 255); RS = (166, 40, 44, 255); RD = (130, 28, 38, 255)
# 白
WL = (255, 255, 252, 255); WM = (236, 228, 214, 255)
# くつ
BM = (116, 78, 50, 255); BD = (84, 55, 36, 255)
# 目
EYE = (54, 40, 34, 255); EYE2 = (94, 68, 56, 255); WHITE = (255, 255, 255, 255); REFL = (196, 224, 236, 255)
BLUSH = (247, 168, 182, 255); MOUTH = (176, 84, 70, 255)


def ell(d, cx, cy, rx, ry, col):
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=col)


def draw_head(im):
    d = ImageDraw.Draw(im)
    cx = 21  # 顔中心

    # ===== クマ耳 =====
    for ex, ey, r, far in [(13, 6, 4.6, False), (28, 5, 4.0, True)]:
        ell(d, ex, ey, r, r, EM)
        ell(d, ex, ey + r * 0.35, r * 0.62, r * 0.56, EIN)
        ell(d, ex - r * 0.35, ey - r * 0.4, r * 0.4, r * 0.36, EL)
        d.arc((ex - r, ey - r + 1, ex + r, ey + r + 1), 20, 160, fill=ED, width=1)

    # ===== 髪ベース（頭〜サイド） =====
    ell(d, cx, 15, 13, 12, HM)
    ell(d, 9, 20, 4.5, 8, HM)       # 左サイド毛（頬まで）
    ell(d, 32, 19, 4, 7, HM)        # 右サイド毛（奥）

    # ===== 顔（小さめ・右寄せ・陰影は最小限でクリーンに） =====
    ell(d, cx + 1, 20, 10, 10, SM)
    ell(d, cx + 1, 22, 9, 8.5, SM)
    ell(d, cx - 3, 17, 5, 2.6, SL)                       # 上左ハイライトのみ
    ell(d, cx + 9, 23, 1.8, 3, SS)                       # 右ほほ奥の影（控えめ）

    # ===== 前髪（ぱっつん・中央わけ） =====
    d.rounded_rectangle((cx - 13, 8, cx + 13, 17), radius=6, fill=HM)
    for bx, by, br in [(cx - 11, 16, 4), (cx - 6, 18, 5), (cx - 1, 17, 3), (cx + 4, 18, 5), (cx + 10, 17, 4)]:
        ell(d, bx, by, br, br, HM)
    d.polygon([(cx - 1, 14), (cx - 3, 18), (cx + 1, 18)], fill=SM)   # 中央わけ
    ell(d, cx - 12, 22, 2.4, 7, HM)                       # 左サイド前（細め）
    ell(d, cx + 12, 21, 2.2, 6, HM)                       # 右サイド前

    # 髪のツヤ＆影（面で・顔にはかけない）
    ell(d, cx - 4, 10, 8, 2, HL)                          # 上のツヤ帯
    ell(d, cx - 10, 11, 3, 1.4, HL)
    ell(d, cx - 12, 22, 1.6, 4, HS); ell(d, cx + 12, 21, 1.6, 4, HS)  # サイド影
    ell(d, cx - 7, 15, 4, 1.0, HS); ell(d, cx + 5, 15, 3.5, 1.0, HS)  # 毛先の段（目にかからない高さ）

    # ===== 目（右寄り・左が手前で少し大きめ・クリーンな肌の上に） =====
    for (ex, ey, w2, h2) in [(cx - 2, 21, 2.2, 3.0), (cx + 7, 21, 1.9, 2.7)]:
        ell(d, ex, ey, w2, h2, EYE)
        ell(d, ex, ey + h2 * 0.5, w2 * 0.7, h2 * 0.4, EYE2)
        d.point((int(round(ex - w2 * 0.45)), int(round(ey - h2 * 0.45))), fill=WHITE)   # 上ハイライト
        d.point((int(round(ex + w2 * 0.35)), int(round(ey + h2 * 0.55))), fill=REFL)    # 下反射光

    # ===== ほお・鼻・口 =====
    ell(d, cx - 5, 25, 2.6, 1.7, BLUSH)
    ell(d, cx + 10, 24, 2.0, 1.5, BLUSH)
    d.point((int(cx + 11), int(23)), fill=SD)
    d.line((cx + 2, 26, cx + 4, 27), fill=MOUTH, width=1)
    d.line((cx + 4, 27, cx + 6, 26), fill=MOUTH, width=1)


def draw_body(im, pose):
    d = ImageDraw.Draw(im)
    cx = 21
    hipY = 44

    # ---- 脚（胴より先。走りストライド）----
    def leg(hx, dx, front):
        c = RM if front else RS
        s = BM if front else BD
        fx = hx + dx
        # もも〜すね（赤ロンパースの裾→肌のすね）
        d.line((hx, hipY, hx + dx * 0.5, hipY + 4), fill=c, width=3)
        d.line((hx + dx * 0.5, hipY + 4, fx, hipY + 8), fill=SM, width=3)   # 肌のすね
        d.line((hx + dx * 0.5, hipY + 4, fx, hipY + 8), fill=SS, width=1)
        ell(d, fx + (1 if front else -1), hipY + 9, 3, 2, s)               # くつ
        d.point((int(fx), int(hipY + 8)), fill=BD)

    if pose == 'a':
        leg(cx + 3, 5, True); leg(cx - 3, -4, False)
    elif pose == 'b':
        leg(cx + 2, -3, True); leg(cx - 2, 5, False)
    else:  # jump: 前脚を前へ、後脚をたたむ
        leg(cx + 5, 6, True); leg(cx - 3, -2, False)

    # ---- 胴（赤ロンパース・少しくびれ）----
    d.polygon([(cx - 6, 28), (cx + 6, 28), (cx + 8, 44), (cx - 8, 44)], fill=RM)
    ell(d, cx, 44, 8, 3, RM)
    # 立体
    d.polygon([(cx - 6, 28), (cx - 2, 28), (cx - 4, 44), (cx - 8, 44)], fill=RL)  # 左ハイライト
    d.polygon([(cx + 4, 30), (cx + 6, 28), (cx + 8, 44), (cx + 5, 44)], fill=RS)  # 右影
    d.arc((cx - 8, 40, cx + 8, 50), 20, 160, fill=RD, width=1)
    # 襟（白・すっきり）
    ell(d, cx, 28, 4.5, 1.8, WL)
    d.point((int(cx + 2), int(29)), fill=WM)

    # ---- 首（短く）----
    d.rectangle((cx - 2, 26, cx + 2, 29), fill=SS)

    # ---- 腕（振り）----
    def arm(ax, ay, front):
        c = RM if front else RS
        d.line((ax - (2 if front else -2), 30, ax, ay), fill=c, width=3)
        ell(d, ax, ay + 1, 1.8, 1.8, SM)   # 手（肌）
        d.point((int(ax), int(ay + 2)), fill=SS)
    if pose == 'a':
        arm(cx + 9, 38, True); arm(cx - 9, 40, False)
    elif pose == 'b':
        arm(cx + 8, 40, True); arm(cx - 8, 37, False)
    else:
        arm(cx + 10, 34, True); arm(cx - 9, 41, False)


def build(pose, name):
    im = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
    draw_body(im, pose)
    draw_head(im)

    alpha = im.getchannel("A")
    ring = alpha.filter(ImageFilter.MaxFilter(3))
    base = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ol = Image.new("RGBA", im.size, OUT_C); ol.putalpha(ring)
    base.alpha_composite(ol); base.alpha_composite(im)
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
