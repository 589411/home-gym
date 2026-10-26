#!/usr/bin/env python3
"""品質閘門：用真實數據（enrich.py 抓的 meta）決定哪些影片值得收錄，並給品質分數。
不靠標題、不靠 LLM。每支被擋掉都印原因，方便檢討門檻。
python3 tools/quality.py [--report]   → tools/.cache/quality.json"""
import argparse, datetime, glob, json, math, os, sys

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
TODAY = datetime.date(2026, 10, 26)
# 硬門檻（任一不過就淘汰）
MIN_VIEWS, MIN_SUBS, MIN_LIKE_PCT, MIN_DESC = 50_000, 50_000, 0.8, 150
MAX_AGE_YEARS = 9
# 非目標內容：高齡／復健／孕婦／行銷標題（標題或說明命中就擋）
OFF_TOPIC = ["高齡", "中高齡", "銀髮", "長者", "老人", "復健", "孕婦", "pregnan", "senior", "seniors", "elderly", "physical therapy", "手肘痛", "減脂", "瘦肚子", "瘦手臂"]


def evaluate(m):
    why = []
    v, l, subs = m.get("view_count") or 0, m.get("like_count") or 0, m.get("channel_follower_count") or 0
    lp = l / v * 100 if v else 0
    age = (TODAY - datetime.datetime.strptime(m["upload_date"], "%Y%m%d").date()).days / 365 if m.get("upload_date") else 99
    desc = m.get("description") or ""
    text = (m["title"] + " " + desc[:400]).lower()
    if m.get("live_status") not in (None, "not_live", "was_live"): why.append("直播/未發布")
    if m.get("playable_in_embed") is False: why.append("不可嵌入")
    if v < MIN_VIEWS: why.append(f"觀看 {v//1000}k < {MIN_VIEWS//1000}k")
    if subs < MIN_SUBS: why.append(f"頻道訂閱 {subs//1000}k < {MIN_SUBS//1000}k")
    if v >= 10_000 and lp < MIN_LIKE_PCT: why.append(f"讚率 {lp:.1f}% < {MIN_LIKE_PCT}%")
    if len(desc) < MIN_DESC: why.append(f"說明欄只有 {len(desc)} 字（用心程度低）")
    if age > MAX_AGE_YEARS: why.append(f"{age:.0f} 年前的影片")
    for k in OFF_TOPIC:
        if k in text: why.append(f"非目標內容（{k}）"); break
    ch = len(m.get("chapters") or [])
    # 品質分數 0–100：觀看(對數)30 + 讚率20 + 頻道規模20 + 章節20 + 說明10
    score = (min(math.log10(max(v, 1)) / 7, 1) * 30 + min(lp / 2.5, 1) * 20 + min(math.log10(max(subs, 1)) / 6.5, 1) * 20
             + min(ch / 8, 1) * 20 + min(len(desc) / 1500, 1) * 10)
    return {"pass": not why, "why": why, "score": round(score), "likePct": round(lp, 2), "chapters": ch, "subs": subs}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--report", action="store_true"); a = ap.parse_args()
    cand = {c["id"]: c for c in json.load(open(os.path.join(CACHE, "candidates.json")))}
    res = {}
    for f in glob.glob(os.path.join(CACHE, "meta", "*.json")):
        m = json.load(open(f))
        if m["id"] in cand: res[m["id"]] = {**evaluate(m), "title": m["title"], "channel": m["channel"]}
    json.dump(res, open(os.path.join(CACHE, "quality.json"), "w"), ensure_ascii=False, indent=1)
    ok = [r for r in res.values() if r["pass"]]
    print(f"通過 {len(ok)} / {len(res)}", file=sys.stderr)
    if a.report:
        for r in sorted(res.values(), key=lambda r: (not r["pass"], -r["score"])):
            print("✓" if r["pass"] else "✗", r["score"], r["channel"][:18], "|", r["title"][:34], "|", "；".join(r["why"]))


if __name__ == "__main__":
    main()
