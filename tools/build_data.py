#!/usr/bin/env python3
"""content/videos.json → data/videos.json（略過 hidden，依觀看數排序）。data/ 勿手改。"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vs = [v for v in json.load(open(os.path.join(ROOT, "content", "videos.json"))) if not v.get("hidden")]
vs.sort(key=lambda v: -(v.get("views") or 0))
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
json.dump(vs, open(os.path.join(ROOT, "data", "videos.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(vs)} 支 → data/videos.json")
