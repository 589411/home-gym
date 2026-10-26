#!/usr/bin/env python3
"""關鍵字 → YouTube 候選影片清單（yt-dlp 確定性搜尋，去重）。

python3 tools/search.py                 # 每個關鍵字 10 支
python3 tools/search.py -n 20 --equipment kettlebell
結果寫入 tools/.cache/candidates.json
"""
import argparse, json, os, subprocess, sys

YTDLP = os.environ.get("YTDLP", "yt-dlp")
OUT = os.path.join(os.path.dirname(__file__), ".cache", "candidates.json")

QUERIES = {
    "resistance-band": ["彈力帶 居家 全身訓練", "彈力繩 居家 訓練", "resistance band home workout full body"],
    "kettlebell": ["壺鈴 居家 訓練", "壺鈴 全身 初學者", "kettlebell home workout full body"],
}
GUIDE_QUERIES = {  # 動作講解／教學（不是拿來跟練的）
    "resistance-band": ["彈力帶 動作教學 入門", "彈力帶 正確姿勢 常見錯誤", "resistance band exercises form tutorial beginners"],
    "kettlebell": ["壺鈴 擺盪 教學", "壺鈴 入門 動作教學 姿勢", "kettlebell swing form tutorial beginners"],
}
# 依訓練部位的搜尋（戰情室用「想練哪裡」挑影片）；國外頻道品質通常較好，英文為主
EQ_EN = {"resistance-band": "resistance band", "kettlebell": "kettlebell"}
PARTS_EN = ["glutes and legs", "back", "shoulders", "arms biceps triceps", "chest", "core abs", "full body"]
for _eq, _en in EQ_EN.items():
    QUERIES[_eq] += [f"{_en} {p} workout at home follow along" for p in PARTS_EN]
MIN_SEC, MAX_SEC = 120, 3600
MIN_VIEWS = 50_000  # 搜尋階段的粗篩；精細品質閘門在 quality.py  # 太短是 Shorts、太長是直播/合輯


def search(q, n):
    r = subprocess.run([YTDLP, f"ytsearch{n}:{q}", "--flat-playlist", "--dump-json"],
                       capture_output=True, text=True, timeout=120)
    for line in r.stdout.splitlines():
        try:
            yield json.loads(line)
        except ValueError:
            continue


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=10)
    ap.add_argument("--equipment", choices=list(QUERIES))
    a = ap.parse_args()
    found = {}
    for eq, qs in QUERIES.items():
        if a.equipment and eq != a.equipment:
            continue
        for q in qs + GUIDE_QUERIES[eq]:
            for v in search(q, a.n):
                dur = v.get("duration") or 0
                if not (MIN_SEC <= dur <= MAX_SEC) or (v.get("view_count") or 0) < MIN_VIEWS or v["id"] in found:
                    continue
                found[v["id"]] = {
                    "id": v["id"], "title": v.get("title"), "channel": v.get("channel"),
                    "duration": dur, "views": v.get("view_count"),
                    "searchEquipment": eq, "query": q,
                }
            print(f"[{eq}] {q}: 累計 {len(found)}", file=sys.stderr)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(list(found.values()), f, ensure_ascii=False, indent=1)
    print(f"寫入 {len(found)} 支 → {OUT}")


if __name__ == "__main__":
    main()
