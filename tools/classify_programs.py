#!/usr/bin/env python3
"""programs_raw.json → agy 分類 → 程式把關 → tools/.cache/programs.json
器材標籤須在課程標題或 ≥30% 的單日影片標題找到關鍵字；找不到的整個課程丟掉（離題）。"""
import json, os
from classify import CACHE, EQUIP, SPLIT, STYLE, LEVEL, call_agy

PROMPT = """你是居家健身課程分類員。不要使用任何工具、不要讀寫檔案或執行指令，直接在回覆中輸出結果。
只根據下列資料判斷，不要編造。輸入（JSON 陣列，days 為前 5 日標題）：
{items}

只輸出一個 JSON 陣列，每個課程一個物件、id 原樣照抄，欄位：
- id: 原樣
- equipment: 陣列，從 {eq} 選，只列標題明確提到的器材
- split: 陣列，從 {sp} 選（整個課程的主要訓練分化）
- style: 陣列，從 {st} 選
- intensity: 整數 1–5（3 中等肌力，4 高強度，5 極高）
- level: {lv} 之一，沒線索就 null
- homeFriendly: true/false
- summaryZh: 一句台灣繁體中文摘要（20–40 字），只根據標題
- lang: "zh" 或 "en"
不要輸出任何 JSON 以外的文字。"""


def main():
    raw = json.load(open(os.path.join(CACHE, "programs_raw.json")))
    by = {r["id"]: r for r in raw}
    items = [{"id": r["id"], "title": r["title"], "channel": r["channel"], "videos": len(r["days"]),
              "days": [d["title"] for d in r["days"][:5]]} for r in raw]
    out = []
    for i in range(0, len(items), 10):
        recs = call_agy(PROMPT.format(items=json.dumps(items[i:i+10], ensure_ascii=False), eq=sorted(EQUIP),
                        sp=sorted(SPLIT), st=sorted(STYLE), lv=sorted(LEVEL)), "Gemini 3.8 Flash (High)")
        for rec in recs:
            r = by.get(rec.get("id"))
            if not r: continue
            keys = lambda e: EQUIP[e]
            def hit(e):
                ks = EQUIP[e]
                if any(k in r["title"].lower() for k in ks): return True
                n = sum(any(k in d["title"].lower() for k in ks) for d in r["days"])
                return n >= 0.3 * len(r["days"])
            eq = [e for e in rec.get("equipment") or [] if e in EQUIP and hit(e)]
            if not eq:
                print("✗ 離題丟棄：", r["title"][:40]); continue
            out.append({**r, "equipment": eq, "split": [x for x in rec.get("split") or [] if x in SPLIT],
                        "style": [x for x in rec.get("style") or [] if x in STYLE],
                        "intensity": rec["intensity"] if isinstance(rec.get("intensity"), int) and 1 <= rec["intensity"] <= 5 else None,
                        "level": rec.get("level") if rec.get("level") in LEVEL else None,
                        "homeFriendly": rec.get("homeFriendly"), "summaryZh": rec.get("summaryZh"), "lang": rec.get("lang")})
    json.dump(out, open(os.path.join(CACHE, "programs.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(out)}/{len(raw)} 個課程 → programs.json")


if __name__ == "__main__":
    main()
