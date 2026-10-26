#!/usr/bin/env python3
"""classified.json + quality.json + programs_q.json → content/videos.json、content/programs.json（唯一手編處）。
把關規則：器材須在標題/說明/章節找到（unverified 不收）、kind 須判得出來。已有的 hidden 標記會保留。"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "tools", ".cache"); OUT = os.path.join(ROOT, "content")
KEEP = ("id", "title", "channel", "duration", "views", "kind", "equipment", "split", "muscles", "style", "intensity",
        "level", "homeFriendly", "summaryZh", "lang", "quality")


def merge(path, new):
    old = {r["id"]: r for r in json.load(open(path))} if os.path.exists(path) else {}
    for r in new:
        if old.get(r["id"], {}).get("hidden"): r["hidden"] = True
    json.dump(new, open(path, "w"), ensure_ascii=False, indent=1)


def main():
    os.makedirs(OUT, exist_ok=True)
    cl = json.load(open(os.path.join(C, "classified.json")))
    vids, drop = [], {"unverified": 0, "no-kind": 0, "not-home": 0}
    for r in cl:
        if r.get("unverified"): drop["unverified"] += 1; continue
        if not r.get("kind"): drop["no-kind"] += 1; continue
        if r.get("homeFriendly") is False: drop["not-home"] += 1; continue
        vids.append({k: r.get(k) for k in KEEP})
    merge(os.path.join(OUT, "videos.json"), vids)
    pr = [p for p in json.load(open(os.path.join(C, "programs_q.json"))) if p.get("pass") and p.get("equipment")]
    merge(os.path.join(OUT, "programs.json"), pr)
    print(f"影片 {len(vids)}（淘汰 {drop}）、系列 {len(pr)}")


if __name__ == "__main__":
    main()
