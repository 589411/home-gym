#!/usr/bin/env python3
"""候選影片 → oEmbed 驗證 → agy 分類（批次）→ 程式把關 → tools/.cache/classified.json

python3 tools/classify.py [--batch 10] [--limit N] [--model "Gemini 3.8 Flash (High)"]
agy 只看標題／頻道／時長，輸出器材、部位、難度、中文摘要；
影片 ID 與時長以 yt-dlp 資料為準，器材標籤必須能在標題找到關鍵字，否則標 unverified。
"""
import argparse, json, os, re, subprocess, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
AGY = os.environ.get("AGY", "agy")

EQUIP = {  # 標籤 → 標題需出現的關鍵字（小寫比對）
    "resistance-band": ["彈力帶", "彈力繩", "阻力帶", "阻力繩", "拉力帶", "弹力带", "弹力绳", "阻力带", "拉力带", "resistance band", "bands", "band"],
    "kettlebell": ["壺鈴", "壶铃", "kettlebell", "kettle bell"],
    "dumbbell": ["啞鈴", "哑铃", "dumbbell"],
    "bodyweight": ["徒手", "自重", "bodyweight", "body weight", "no equipment"],
}
MUSCLES = {"chest", "back", "shoulders", "arms", "quads", "hamstrings", "glutes", "calves", "core"}
SPLIT = {"full-body", "upper", "lower", "push", "pull", "legs", "core"}  # 健身規劃的分化方式
STYLE = {"strength", "hiit", "cardio", "mobility", "warmup"}  # 訓練型態
LEVEL = {"beginner", "intermediate", "advanced"}  # 適合程度
# 強度 1–5：1 拉伸/熱身 2 輕度 3 中等肌力 4 高強度（超級組/HIIT） 5 極高強度


def oembed_ok(vid):
    u = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}")
    try:
        urllib.request.urlopen(u, timeout=15).read()
        return True
    except Exception:
        return False


def call_agy(prompt, model):
    cmd = [AGY, "-p", prompt, "--print-timeout", "10m", "--sandbox"]
    if model:
        cmd += ["--model", model]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=720, cwd=CACHE)
    open(os.path.join(CACHE, "last_agy.txt"), "w").write(r.stdout + "\n---STDERR---\n" + r.stderr)
    m = re.search(r"\[.*\]", r.stdout, re.S)  # 容忍前後雜訊或 ``` 圍欄
    if not m:
        raise RuntimeError("agy 沒有回傳 JSON：" + (r.stdout[-300:] or r.stderr[-300:]))
    return json.loads(m.group(0))


def build_prompt(batch):
    items = [{"id": c["id"], "title": c["title"], "channel": c["channel"], "minutes": round(c["duration"] / 60)} for c in batch]
    return f"""你是居家健身影片分類員。不要使用任何工具、不要讀寫檔案或執行指令，直接在回覆中輸出結果。
只根據下列資料判斷，不要編造；不確定就用 null 或空陣列。
輸入（JSON 陣列）：
{json.dumps(items, ensure_ascii=False)}

只輸出一個 JSON 陣列，每支影片一個物件、id 原樣照抄，欄位：
- id: 原樣
- equipment: 陣列，從 {sorted(EQUIP)} 選，只列標題明確提到的器材
- split: 陣列，訓練分化，從 {sorted(SPLIT)} 選（push=胸肩三頭推類，pull=背二頭拉類）
- muscles: 陣列，主要訓練肌群，從 {sorted(MUSCLES)} 選
- style: 陣列，從 {sorted(STYLE)} 選
- intensity: 整數 1–5（1 拉伸/熱身，2 輕度，3 中等肌力，4 高強度如超級組/HIIT，5 極高強度），標題沒線索就依型態與時長保守估計
- level: {sorted(LEVEL)} 之一，沒線索就 null
- homeFriendly: true/false
- summaryZh: 一句台灣繁體中文摘要（20–40 字），只根據標題
- lang: "zh" 或 "en"
不要輸出任何 JSON 以外的文字。"""


def validate(rec, cand):
    errs = []
    title = cand["title"].lower()
    eq = [e for e in rec.get("equipment") or [] if e in EQUIP]
    rec["equipment"] = [e for e in eq if any(k in title for k in EQUIP[e])]
    if len(rec["equipment"]) != len(rec.get("equipment") or []) or not rec["equipment"]:
        rec["unverified"] = True  # 器材沒在標題找到 → 要人工看
    for k, allowed in (("split", SPLIT), ("muscles", MUSCLES), ("style", STYLE)):
        rec[k] = [x for x in rec.get(k) or [] if x in allowed]
    if not (isinstance(rec.get("intensity"), int) and 1 <= rec["intensity"] <= 5):
        rec["intensity"] = None
    if rec.get("level") not in LEVEL:
        rec["level"] = None
    if not isinstance(rec.get("summaryZh"), str) or not rec["summaryZh"]:
        errs.append("缺 summaryZh")
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=10)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--model", default="Gemini 3.8 Flash (High)")
    a = ap.parse_args()
    cands = json.load(open(os.path.join(CACHE, "candidates.json")))[: a.limit]
    out_path = os.path.join(CACHE, "classified.json")
    done = {r["id"]: r for r in json.load(open(out_path))} if os.path.exists(out_path) else {}
    todo = [c for c in cands if c["id"] not in done]
    ok = []
    for c in todo:
        if oembed_ok(c["id"]):
            ok.append(c)
        else:
            print(f"✗ oEmbed 失敗，丟棄 {c['id']} {c['title'][:30]}", file=sys.stderr)
    by_id = {c["id"]: c for c in ok}
    for i in range(0, len(ok), a.batch):
        batch = ok[i : i + a.batch]
        print(f"agy 批次 {i // a.batch + 1}/{-(-len(ok) // a.batch)}（{len(batch)} 支）…", file=sys.stderr)
        try:
            recs = call_agy(build_prompt(batch), a.model)
        except Exception as e:
            print(f"  ✗ {e}", file=sys.stderr)
            continue
        for rec in recs:
            cand = by_id.get(rec.get("id"))
            if not cand:  # agy 給了不在輸入裡的 ID → 一律丟掉
                print(f"  ✗ 丟棄未知 ID {rec.get('id')}", file=sys.stderr)
                continue
            errs = validate(rec, cand)
            if errs:
                print(f"  ✗ {cand['id']}：{errs}", file=sys.stderr)
                continue
            done[cand["id"]] = {**cand, **{k: rec.get(k) for k in ("equipment", "split", "muscles", "style", "intensity", "level", "homeFriendly", "summaryZh", "lang", "unverified")}}
        json.dump(list(done.values()), open(out_path, "w"), ensure_ascii=False, indent=1)  # 每批存檔，可續跑
    print(f"完成：{len(done)}/{len(cands)} 支 → {out_path}")


if __name__ == "__main__":
    main()
