#!/usr/bin/env python3
"""せなくまラン主人公のドット絵スプライトを生成する（高品質版）。

アップロードされたアイロンビーズ作品（assets/raw/senakuma_beads_reference.png）の
赤い服のキャラクターを参照デザインとして、進行方向（右向き）の
クリーンでかわいいドット絵に描き起こす。
クマ耳・金髪ボブ＆ぱっつん前髪・大きな瞳・赤い服。陰影つき。

パーツを小さなキャンバスに重ねて描き、太めの黒縁取りを付けてから
NEAREST拡大することで、くっきりした「ドット絵の主人公」に仕上げる。

出力（games/runner-2d/public/assets/）:
    player.png       走りA（右向き・接地）
    player_run.png   走りB（右向き・接地、脚が入れ替わる）
    player_jump.png  ジャンプ（右向き・前傾）
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "games" / "runner-2d" / "public" / "assets"
W, H = 46, 58          # 論理解像度（1ドット単位で描く）
SCALE = 8              # 拡大率
OUTLINE = (54, 38, 28, 255)

# パレット（アイロンビーズの色に寄せる）
EAR = (122, 84, 50, 255)
EAR_IN = (180, 132, 86, 255)
HAIR = (233, 198, 100, 255)
HAIR_HI = (247, 226, 158, 255)
HAIR_SH = (198, 158, 66, 255)
SKIN = (248, 235, 216, 255)
SKIN_SH = (233, 206, 180, 255)
EYE = (66, 46, 34, 255)
EYE_HI = (255, 255, 255, 255)
BLUSH = (247, 168, 184, 255)
MOUTH = (176, 86, 70, 255)
RED = (204, 58, 56, 255)
RED_HI = (226, 96, 92, 255)
RED_SH = (162, 38, 42, 255)
COLLAR = (248, 242, 230, 255)
SHOE = (92, 62, 42, 255)
SHOE_SH = (68, 44, 30, 255)


def disc(d, cx, cy, r, col):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)


def ell(d, cx, cy, rx, ry, col):
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=col)


def draw_head(d):
    """頭部（耳・髪・顔・前髪・目・ほっぺ・口）。3/4右向き。"""
    cx = 24  # 顔の中心（やや右寄せで右向き感）

    # --- クマ耳（頭より先に。左=手前で大きめ、右=奥で小さめ）---
    ell(d, cx - 10, 8, 6, 6, EAR)
    ell(d, cx - 10, 8, 3, 3, EAR_IN)
    ell(d, cx + 11, 7, 5, 5, EAR)
    ell(d, cx + 11, 7, 2, 2, EAR_IN)

    # --- 髪ベース（頭の丸み）---
    ell(d, cx, 20, 15, 15, HAIR)
    # 後頭部を左に少し伸ばす（3/4）
    ell(d, cx - 4, 20, 13, 14, HAIR)

    # --- 顔（肌）。前髪の下にのぞく ---
    ell(d, cx + 1, 26, 12, 12, SKIN)
    # あご下の肌影
    ell(d, cx + 1, 31, 10, 7, SKIN)

    # --- 前髪（ぱっつん。中央わけ）---
    # おでこ上の帯
    d.rectangle((cx - 13, 10, cx + 14, 22), fill=HAIR)
    # 前髪の毛先（ぎざっと下がる）
    for bx, by, br in [(cx - 11, 22, 4), (cx - 5, 24, 5), (cx + 2, 24, 5), (cx + 9, 23, 4), (cx + 13, 21, 3)]:
        disc(d, bx, by, br, HAIR)
    # 中央の分け目を少しあける（肌をのぞかせる）
    disc(d, cx + 1, 23, 2, SKIN)
    # サイドの髪（顔の横に垂れる）
    ell(d, cx - 12, 27, 3, 8, HAIR)
    ell(d, cx + 13, 26, 3, 7, HAIR)

    # --- 髪のハイライト＆影 ---
    ell(d, cx - 2, 14, 8, 3, HAIR_HI)
    ell(d, cx - 11, 22, 3, 5, HAIR_SH)
    ell(d, cx + 12, 21, 2, 5, HAIR_SH)

    # --- 目（右向きなので右寄り・少し寄せる。左=手前で大きめ）---
    lx, rx, ey = cx, cx + 8, 28
    ell(d, lx, ey, 2, 3, EYE)
    ell(d, rx, ey, 2, 3, EYE)
    d.point((lx - 1, ey - 1), fill=EYE_HI)
    d.point((rx - 1, ey - 1), fill=EYE_HI)

    # --- ほっぺ ---
    ell(d, cx - 2, 32, 3, 2, BLUSH)
    ell(d, cx + 10, 32, 2, 2, BLUSH)

    # --- 口（小さな笑み）---
    d.line((cx + 4, 33, cx + 6, 34), fill=MOUTH)
    d.line((cx + 6, 34, cx + 8, 33), fill=MOUTH)

    # --- 鼻先（右シルエットの小さな出っ張り）---
    ell(d, cx + 13, 29, 1, 2, SKIN)
    d.point((cx + 14, 29), fill=SKIN_SH)


def draw_body(d, pose):
    """胴体・腕・脚。pose: 'a'|'b'|'jump'。頭は y2-35、胴は y37-46、脚は y46-。"""
    cx = 24

    # 脚（胴より先に描いて胴で付け根を隠す）
    if pose == 'a':
        _leg(d, cx + 4, 46, 4, front=True)    # 前脚（右）を踏み出す
        _leg(d, cx - 3, 46, -3, front=False)  # 後脚（左）を蹴る
    elif pose == 'b':
        _leg(d, cx + 1, 46, -3, front=True)   # 前脚を引く
        _leg(d, cx - 1, 46, 4, front=False)   # 後脚を前へ
    else:  # jump: 前脚を前上へ、後脚をたたむ
        _leg(d, cx + 6, 44, 5, front=True)
        _leg(d, cx - 2, 45, -4, front=False)

    # 胴（赤い服・ロンパース風）
    d.rounded_rectangle((cx - 9, 36, cx + 9, 47), radius=6, fill=RED)
    # 立体感（左に光、右下に影）
    d.rounded_rectangle((cx - 8, 37, cx - 4, 45), radius=3, fill=RED_HI)
    ell(d, cx + 7, 44, 3, 4, RED_SH)
    # 襟（白）
    ell(d, cx + 1, 37, 5, 2, COLLAR)

    # 腕（そで口は白）
    if pose == 'a':
        ell(d, cx + 10, 40, 2, 3, RED); d.point((cx + 11, 42), fill=COLLAR)
        ell(d, cx - 10, 41, 2, 3, RED_SH)
    elif pose == 'b':
        ell(d, cx + 9, 41, 2, 3, RED); d.point((cx + 10, 43), fill=COLLAR)
        ell(d, cx - 9, 40, 2, 3, RED_SH)
    else:  # jump
        ell(d, cx + 11, 38, 2, 3, RED); d.point((cx + 12, 39), fill=COLLAR)
        ell(d, cx - 10, 43, 2, 3, RED_SH)


def _leg(d, hip_x, hip_y, dx, front):
    """脚（赤）+ くつ（茶）。front=Falseは奥脚で暗め。"""
    leg_col = RED if front else RED_SH
    shoe_col = SHOE if front else SHOE_SH
    foot_x = hip_x + dx
    foot_y = hip_y + 6
    # ふともも〜すね
    d.line((hip_x, hip_y, foot_x, foot_y - 1), fill=leg_col, width=3)
    # くつ（前を向くので右にふくらむ）
    ell(d, foot_x + 1, foot_y, 3, 2, shoe_col)


def build(pose, name):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 脚→胴→頭 の順（頭を前面に）
    draw_body(d, pose)
    draw_head(d)

    # --- 黒の縁取り（アルファを膨張させて背面に敷く）---
    alpha = img.getchannel("A")
    ring = alpha.filter(ImageFilter.MaxFilter(3))
    outline = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ol = Image.new("RGBA", img.size, OUTLINE)
    ol.putalpha(ring)
    outline.alpha_composite(ol)
    outline.alpha_composite(img)
    img = outline

    bbox = img.getchannel("A").getbbox()
    img = img.crop(bbox)
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    OUT.mkdir(parents=True, exist_ok=True)
    big.save(OUT / name)
    print(f"wrote {OUT / name} ({big.width}x{big.height})")


if __name__ == "__main__":
    build('a', "player.png")
    build('b', "player_run.png")
    build('jump', "player_jump.png")
