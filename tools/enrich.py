#!/usr/bin/env python3
"""候選影片 → yt-dlp 抓真實詮釋資料（觀看/讚/訂閱/日期/說明/章節），逐支快取到 tools/.cache/meta/。
品質判斷用這些數據，不靠標題。可續跑；429 會退避。
python3 tools/enrich.py [--jobs 3]"""
import argparse, json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

YTDLP = os.environ.get("YTDLP", "yt-dlp")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
META = os.path.join(CACHE, "meta")
KEEP = ("id", "title", "channel", "channel_id", "channel_follower_count", "view_count", "like_count", "comment_count",
        "duration", "upload_date", "description", "chapters", "live_status", "availability", "playable_in_embed", "tags")


def fetch(vid):
    path = os.path.join(META, vid + ".json")
    if os.path.exists(path):
        return vid, True
    for wait in (0, 20, 60):
        time.sleep(wait)
        r = subprocess.run([YTDLP, "--skip-download", "-J", "--no-warnings", f"https://www.youtube.com/watch?v={vid}"],
                           capture_output=True, text=True, timeout=120)
        if r.stdout.strip():
            d = json.loads(r.stdout)
            if not d:  # 影片已移除/私人，yt-dlp 回傳 null
                break
            json.dump({k: d.get(k) for k in KEEP}, open(path, "w"), ensure_ascii=False)
            return vid, True
        if "429" not in r.stderr:
            break
    print(f"✗ {vid}: {r.stderr.strip()[-120:]}", file=sys.stderr)
    return vid, False


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--jobs", type=int, default=3); a = ap.parse_args()
    os.makedirs(META, exist_ok=True)
    ids = [c["id"] for c in json.load(open(os.path.join(CACHE, "candidates.json")))]
    with ThreadPoolExecutor(a.jobs) as ex:
        ok = sum(1 for _, g in ex.map(fetch, ids) if g)
    print(f"{ok}/{len(ids)} 支取得詮釋資料 → {META}")


if __name__ == "__main__":
    main()
