#!/usr/bin/env python3
"""切り抜き画像のふちに残った「元サムネイルの背景の切れ端」を取りのぞく。

手でなぞって切り抜いた画像は、輪郭の外側に元画像の背景（ほかの絵やロゴの一部）が
数ピクセル残ることがある。せなくまさんの絵そのものではない部分なので、公開前に落とす。

やり方: 指定した範囲の中だけで、透明部分に接している画素から内側へたどり、キャラクターの
色合い（髪の金・耳の茶・肌・服の赤 = どれも赤みが強い暖色、または輪郭線の暗い色）でない画素を
透明にする。

範囲を必ず指定するのは、切り口に輪郭線がない場所（白い耳や手が画像の端で切れている所など）では
「キャラクターの白」と「背景の白」を色だけでは見分けられず、絵そのものを削ってしまうため。
切れ端がある場所を目で見て、その四角だけを渡す。

使い方:
    python3 tools/clean_cutout_edges.py 画像.png x0,y0,x1,y1 [x0,y0,x1,y1 ...]   # 上書き保存
    python3 tools/clean_cutout_edges.py --check 画像.png x0,y0,x1,y1 ...          # 何画素落ちるかだけ表示
"""

import sys

import numpy as np
from PIL import Image

DEPTH = 18  # 透明部分から何pxまでたどるか


def clean(path: str, regions: list[tuple[int, int, int, int]], write: bool) -> int:
    img = Image.open(path).convert("RGBA")
    a = np.asarray(img).astype(np.int16)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    opaque = alpha > 40
    mx = np.maximum(np.maximum(r, g), b)
    warm = (r >= g - 4) & (g >= b - 4) & (r - b >= 22)      # 髪・耳・肌・服
    dark = mx < 105                                          # 輪郭線
    vivid_yellow = (r > 200) & (g > 170) & (b < 80)          # 髪より鮮やかすぎる黄（背景の色）
    inside = np.zeros_like(opaque)
    for x0, y0, x1, y1 in regions:
        inside[y0:y1, x0:x1] = True
    candidate = opaque & inside & (~(warm | dark) | vivid_yellow)   # 範囲内の、キャラクターの色ではない画素

    def grow(mask: np.ndarray) -> np.ndarray:
        """上下左右に1px広げる（画像の外は透明として扱う）"""
        m = np.pad(mask, 1, constant_values=True)
        return m[1:-1, 1:-1] | m[:-2, 1:-1] | m[2:, 1:-1] | m[1:-1, :-2] | m[1:-1, 2:]

    reached = ~opaque
    drop = np.zeros_like(opaque)
    for _ in range(DEPTH):
        new = grow(reached) & candidate & ~reached
        if not new.any():
            break
        reached |= new
        drop |= new
    n = int(drop.sum())
    if write and n:
        out = np.asarray(img).copy()
        out[drop] = (0, 0, 0, 0)
        Image.fromarray(out, "RGBA").save(path)
    return n


if __name__ == "__main__":
    args = sys.argv[1:]
    write = "--check" not in args
    rest = [x for x in args if not x.startswith("--")]
    if len(rest) < 2:
        sys.exit(__doc__)
    path = rest[0]
    regions = [tuple(int(v) for v in r.split(",")) for r in rest[1:]]
    print(f"{path}: {'removed' if write else 'would remove'} {clean(path, regions, write)} px")
