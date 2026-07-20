#!/usr/bin/env python3
"""せなくまボイスの切り出しツール（手元のPCで実行する）。

このクラウド開発環境からは動画サイトへ接続できないため、本スクリプトは
ネットワーク制限のない手元のPCで実行する想定。

★重要: 権利者（せなくまさん）の許諾を得たクリップのみを扱うこと。
        取得したクリップは assets/raw/voice_sources.txt に出典を自動記録する。

前提:
    pip install yt-dlp
    ffmpeg をインストールして PATH を通しておく

使い方（例: 12分34.5秒〜12分35.8秒の「やったー！」を yay として切り出し）:
    python tools/extract_voice.py --url <動画URL> --start 12:34.5 --end 12:35.8 --name yay
    python tools/extract_voice.py --url <動画URL> --start 3:05 --end 3:06.2 --name cry --denoise

出力:
    games/runner-2d/public/assets/voice/<name>.ogg
    games/mancala/public/assets/voice/<name>.ogg
    （両ゲームに同じファイルを配置。ゲームは存在するボイスだけ自動で再生する）

ゲームが参照するファイル名:
    start.ogg … ゲーム開始時（「スタート！」など）
    yay.ogg   … ハイスコア更新・せなくまの勝ち（「やったー！」など）
    cry.ogg   … ミス・せなくまの負け（「あーっ」「くやしい〜」など）
"""

import argparse
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CACHE = REPO / "assets" / "raw" / "voice_cache"
LOG = REPO / "assets" / "raw" / "voice_sources.txt"
DESTS = [
    REPO / "games" / "runner-2d" / "public" / "assets" / "voice",
    REPO / "games" / "mancala" / "public" / "assets" / "voice",
]


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd))
    res = subprocess.run(cmd)
    if res.returncode != 0:
        sys.exit(f"コマンドが失敗しました: {cmd[0]} (exit {res.returncode})")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", required=True, help="動画URL（許諾を得たもの）")
    p.add_argument("--start", required=True, help="開始位置（例 12:34.5）")
    p.add_argument("--end", required=True, help="終了位置（例 12:35.8）")
    p.add_argument("--name", required=True, help="出力名（start / yay / cry など）")
    p.add_argument("--denoise", action="store_true", help="ノイズ除去(afftdn)を掛ける")
    args = p.parse_args()

    # 1) 動画IDを取得し、音声をキャッシュへダウンロード（既にあれば再利用）
    vid = subprocess.run(
        ["yt-dlp", "--get-id", "--no-playlist", args.url],
        capture_output=True, text=True,
    )
    if vid.returncode != 0:
        sys.exit("yt-dlp で動画IDを取得できませんでした。URLとyt-dlpの導入を確認してください。")
    video_id = vid.stdout.strip().splitlines()[-1]

    CACHE.mkdir(parents=True, exist_ok=True)
    wav = CACHE / f"{video_id}.wav"
    if not wav.exists():
        run([
            "yt-dlp", "-x", "--audio-format", "wav", "--no-playlist",
            "-o", str(CACHE / "%(id)s.%(ext)s"), args.url,
        ])
    if not wav.exists():
        sys.exit(f"音声ファイルが見つかりません: {wav}")

    # 2) 区間を切り出し、音量正規化（+必要ならノイズ除去）して ogg へ
    filters = "afftdn=nf=-25,loudnorm=I=-16:TP=-1.5" if args.denoise else "loudnorm=I=-16:TP=-1.5"
    out_first = DESTS[0] / f"{args.name}.ogg"
    DESTS[0].mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y", "-ss", args.start, "-to", args.end, "-i", str(wav),
        "-af", filters, "-ac", "1", str(out_first),
    ])

    # 3) もう一方のゲームにも同じものを配置
    for dest in DESTS[1:]:
        dest.mkdir(parents=True, exist_ok=True)
        (dest / f"{args.name}.ogg").write_bytes(out_first.read_bytes())

    # 4) 出典ログ
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"{args.name}.ogg\t{args.url}\t{args.start}-{args.end}\t取得日:{date.today()}\t権利者許諾済み\n")

    print(f"\n完了: {args.name}.ogg を両ゲームに配置し、出典を {LOG} に記録しました。")
    print("git add → commit → push で反映してください。")


if __name__ == "__main__":
    main()
