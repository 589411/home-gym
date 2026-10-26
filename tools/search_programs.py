#!/usr/bin/env python3
"""搜尋「每日課程」播放清單：標題要像課程（N 天/週、挑戰、課表、Program），
且影片數 ≥ 5、多數影片 ≥ 5 分鐘。結果 → tools/.cache/programs_raw.json

python3 tools/search_programs.py [-n 15]
"""
import argparse, json, os, re, subprocess, sys, urllib.parse

YTDLP = os.environ.get("YTDLP", "yt-dlp")
OUT = os.path.join(os.path.dirname(__file__), ".cache", "programs_raw.json")
QUERIES = {
    "resistance-band": ["彈力帶 30天 挑戰", "彈力帶 課表 週 訓練計畫", "resistance band 30 day challenge", "resistance band program weeks"],
    "kettlebell": ["壺鈴 30天 挑戰", "壺鈴 課表 週 訓練計畫", "kettlebell 30 day challenge", "kettlebell program weeks"],
}
LOOKS_LIKE_PROGRAM = re.compile(r"\d+\s*[-‐ ]?\s*(天|日|週|周|day|days|week|weeks|wk)|挑戰|挑战|challenge|program|課表|课表|計畫|计划|plan", re.I)


def run(args):
    return subprocess.run([YTDLP, *args], capture_output=True, text=True, timeout=180).stdout


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("-n", type=int, default=15); a = ap.parse_args()
    seen, out = set(), []
    for eq, qs in QUERIES.items():
        for q in qs:
            url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIQAw%3D%3D"
            for line in run([url, "--flat-playlist", "--playlist-end", str(a.n), "--dump-json"]).splitlines():
                try: pl = json.loads(line)
                except ValueError: continue
                pid, title = pl.get("id"), pl.get("title") or ""
                if pid in seen or not LOOKS_LIKE_PROGRAM.search(title): continue
                seen.add(pid)
                try:
                    d = json.loads(run([f"https://www.youtube.com/playlist?list={pid}", "--flat-playlist", "-J"]))
                except ValueError: continue
                es = [e for e in d.get("entries") or [] if e and e.get("duration")]
                if len(es) < 5 or sum(e["duration"] >= 300 for e in es) < 0.7 * len(es): continue
                out.append({"id": pid, "title": title, "channel": d.get("channel") or d.get("uploader"), "searchEquipment": eq,
                            "days": [{"id": e["id"], "title": e["title"], "duration": e["duration"]} for e in es]})
                print(f"✓ [{eq}] {title[:40]}（{len(es)} 支）", file=sys.stderr)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"{len(out)} 個課程 → {OUT}")


if __name__ == "__main__":
    main()
