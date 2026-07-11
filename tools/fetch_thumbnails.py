#!/usr/bin/env python3
"""YouTubeチャンネルの最新動画サムネイルを assets/raw/ に一括保存する。

※ クラウド開発環境からは YouTube への接続が遮断されているため、
   このスクリプトはネットワーク制限のない手元のPCで実行する想定。
   取得した画像は assets/raw/ にコミットして共有する。

使い方:
    python tools/fetch_thumbnails.py --channel https://www.youtube.com/@senakumadesu
    python tools/fetch_thumbnails.py --video-ids AAAAAAAAAAA,BBBBBBBBBBB
"""

import argparse
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "assets" / "raw"
HEADERS = {"User-Agent": "Mozilla/5.0 (fan-game asset fetcher)"}


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def resolve_channel_id(channel_url: str) -> str:
    html = http_get(channel_url).decode("utf-8", "ignore")
    m = re.search(r'"channelId":"(UC[0-9A-Za-z_-]{22})"', html)
    if not m:
        sys.exit("チャンネルIDを特定できませんでした。--video-ids で動画IDを直接指定してください。")
    return m.group(1)


def list_video_ids(channel_id: str) -> list[str]:
    xml = http_get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}").decode("utf-8", "ignore")
    return re.findall(r"<yt:videoId>([^<]+)</yt:videoId>", xml)


def download_thumbnail(video_id: str, log: list[str]) -> bool:
    # 高解像度から順に試す（maxresdefault はない動画もある）
    for name in ("maxresdefault", "sddefault", "hqdefault"):
        url = f"https://i.ytimg.com/vi/{video_id}/{name}.jpg"
        try:
            data = http_get(url)
        except Exception:
            continue
        if len(data) < 2000:  # 存在しない場合に返る小さなプレースホルダ画像を除外
            continue
        path = RAW_DIR / f"{video_id}.jpg"
        path.write_bytes(data)
        log.append(f"{path.name}\t{url}\t取得日:{date.today()}")
        print(f"saved {path} ({name}, {len(data) // 1024}KB)")
        return True
    print(f"skip {video_id}: サムネイルを取得できませんでした")
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--channel", help="チャンネルURL（例: https://www.youtube.com/@senakumadesu）")
    parser.add_argument("--video-ids", help="カンマ区切りの動画ID（--channel の代わりに直接指定）")
    parser.add_argument("--max", type=int, default=15, help="最大取得件数（既定: 15）")
    args = parser.parse_args()

    if args.video_ids:
        video_ids = [v.strip() for v in args.video_ids.split(",") if v.strip()]
    elif args.channel:
        video_ids = list_video_ids(resolve_channel_id(args.channel))
    else:
        parser.error("--channel か --video-ids のどちらかを指定してください。")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    log: list[str] = []
    for video_id in video_ids[: args.max]:
        download_thumbnail(video_id, log)

    # 出典の記録（権利管理のため、どの画像をいつどこから取得したか残す）
    if log:
        sources = RAW_DIR / "sources.txt"
        with sources.open("a", encoding="utf-8") as f:
            f.write("\n".join(log) + "\n")
        print(f"出典ログを {sources} に追記しました。")


if __name__ == "__main__":
    main()
