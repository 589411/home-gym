#!/usr/bin/env python3
"""content/{videos,programs}.json → data/（略過 hidden，影片依品質排序）。data/ 勿手改。"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
for name, key in (("videos", lambda v: -(v.get("quality") or 0)), ("programs", lambda p: p["title"])):
    p = os.path.join(ROOT, "content", name + ".json")
    rows = [r for r in (json.load(open(p)) if os.path.exists(p) else []) if not r.get("hidden")]
    rows.sort(key=key)
    json.dump(rows, open(os.path.join(ROOT, "data", name + ".json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{name}: {len(rows)} 筆")
