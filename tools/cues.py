#!/usr/bin/env python3
"""遠距離跟練用的「動作重點」：YouTube 章節（時間，程式取得）→ agy 寫動作中文名＋重點＋注意事項 → 程式驗證 → content/cues.json。
不逐字翻譯，只給「現在這個動作」的名稱與要領。時間一律來自章節，agy 不能改。
python3 tools/cues.py [--jobs 2] [--batch 4] [--limit N] [--model "Gemini 3.8 Flash (High)"]"""
import argparse, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "content", "cues.json")
TYPES = {"exercise", "rest", "intro", "warmup", "stretch"}
MIN_SEG = 6  # 短於 6 秒的章節（如「Exercise One」後 3 秒就換）併入下一段，面板才不會閃爍
SKIP = set()  # 判定不適合做動作面板的影片
HAN = re.compile(r"[一-鿿]")

PROMPT = """你是專業健身教練兼繁體中文編輯。不要使用任何工具、不要讀寫檔案或執行指令，直接在回覆中輸出結果。
下面是數支居家健身跟練影片的「章節」。使用者離螢幕 2–3 公尺在做動作，只看得到大字，所以每個章節要給：
- type: exercise（正式動作）/ rest（休息換邊）/ intro（開場）/ warmup（熱身）/ stretch（收操伸展）
- name: 動作的台灣常用中文名稱，≤ 8 個字（例：深蹲、彈力帶划船、壺鈴擺盪、臀橋）。章節標題若是英文縮寫或術語（如 TABATA、AMRAP）也要寫成中文（如「高強度間歇」）。章節標題不是動作時用 type 對應的簡短詞（開場／休息／熱身／收操）
- cue（重點）: 這個動作「最重要的一件事」，≤ 16 個字，祈使句，只寫該動作公認的標準要領（例：挺胸、核心收緊、用臀部推髖、肩膀下沉）。不確定就留空字串 ""，不要編造。rest/intro 可寫「喝水、調整呼吸」之類
- watch（注意事項）: 做這個動作最常見的錯誤或安全提醒，≤ 20 個字，寫「要避免什麼」（例：膝蓋不要內夾、腰不要過度反弓、別聳肩、別用手臂甩動）。只寫公認的常見錯誤；不確定、或 type 不是 exercise 就留空字串 ""
使用者離螢幕很遠，只看這個動作的名稱、重點與注意事項。不要預告下一個動作、不要逐字翻譯、不要加說明。只根據章節標題與說明欄判斷。

輸入（JSON 陣列；segments 的 i 是序號）：
{items}

只輸出一個 JSON 物件：key 是影片 id，value 是陣列，每個元素 {{"i": 序號, "type": …, "name": …, "cue": …, "watch": …}}，數量與順序必須和輸入的 segments 完全一致。不要輸出任何 JSON 以外的文字。"""


def segments(meta):
    chs = [c for c in meta.get("chapters") or []]
    segs = []
    for c in chs:
        t, e = c["start_time"], c.get("end_time") or meta["duration"]
        title = re.sub(r"<Untitled Chapter \d+>", "", c["title"]).strip()
        if segs and (e - t < MIN_SEG or segs[-1]["end"] - segs[-1]["t"] < MIN_SEG):
            segs[-1]["end"] = e  # 太短的併進前一段
            if title and not segs[-1]["en"]: segs[-1]["en"] = title
            continue
        segs.append({"t": round(t), "end": round(e), "en": title})
    return segs


ENGINE = "agy"


def call(batch, model):
    items = [{"id": vid, "title": d["title"], "context": d["desc"][:300],
              "segments": [{"i": i, "title": s["en"] or "(無標題)", "sec": s["end"] - s["t"]} for i, s in enumerate(d["segs"])]}
             for vid, d in batch.items()]
    prompt = PROMPT.format(items=json.dumps(items, ensure_ascii=False))
    if ENGINE == "codex":  # agy 額度用完時的備援：唯讀沙箱、不存 session
        cmd = ["codex", "exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "-C", CACHE] + (["-m", model] if model else []) + [prompt]
    else:
        cmd = ["agy", "-p", prompt, "--print-timeout", "10m", "--sandbox", "--model", model]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=720, cwd=CACHE)
    m = re.search(r"\{.*\}", r.stdout, re.S)
    if not m: raise RuntimeError("agy 沒有回傳 JSON：" + (r.stdout[-200:] or r.stderr[-200:]))
    return json.loads(m.group(0))


def check(d, rec):
    errs = []
    if not isinstance(rec, list) or len(rec) != len(d["segs"]): return [f"數量不符 {len(rec) if isinstance(rec, list) else '?'}≠{len(d['segs'])}"]
    for i, (s, r) in enumerate(zip(d["segs"], rec)):
        if r.get("i") != i: errs.append(f"#{i} 序號錯"); continue
        if r.get("type") not in TYPES: errs.append(f"#{i} type")
        if not (isinstance(r.get("name"), str) and 1 <= len(r["name"]) <= 12 and HAN.search(r["name"])): errs.append(f"#{i} name={r.get('name')!r}")
        if not isinstance(r.get("cue"), str) or len(r["cue"]) > 24: errs.append(f"#{i} cue")
        if not isinstance(r.get("watch", ""), str) or len(r.get("watch", "")) > 30: errs.append(f"#{i} watch")
        if r.get("type") != "exercise" and r.get("watch"): r["watch"] = ""  # 非動作段不放注意事項
    return errs


def run(args):
    batch, model = args
    for attempt in (1, 2):
        try: got = call(batch, model)
        except Exception as e: print(f"  ✗ agy 失敗 {e}", file=sys.stderr); continue
        ok = {}
        for vid, d in batch.items():
            errs = check(d, got.get(vid))
            if errs: print(f"  ✗ {vid} 第{attempt}次：{errs[:3]}", file=sys.stderr)
            else: ok[vid] = [{"t": s["t"], "end": s["end"], "type": r["type"], "name": r["name"].strip(), "cue": r["cue"].strip(), "watch": (r.get("watch") or "").strip(), "en": s["en"]}
                             for s, r in zip(d["segs"], got[vid])]
        for vid in [k for k, segs in ok.items() if sum(x["type"] == "exercise" for x in segs) < 2]:
            print(f"  ✗ {vid} 動作段不足 2 段（章節可能是課表分日），不收", file=sys.stderr); del ok[vid]; batch.pop(vid, None); SKIP.add(vid)
        batch = {k: v for k, v in batch.items() if k not in ok and k not in SKIP}
        if ok or not batch: return ok, batch
    return {}, batch


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--jobs", type=int, default=2); ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--limit", type=int); ap.add_argument("--engine", choices=["agy", "codex"], default="agy"); ap.add_argument("--model", default="Gemini 3.8 Flash (High)"); a = ap.parse_args()
    if a.engine == "codex" and a.model.startswith("Gemini"): a.model = ""
    global ENGINE; ENGINE = a.engine
    cues = json.load(open(OUT)) if os.path.exists(OUT) else {}
    todo = {}
    for v in json.load(open(os.path.join(ROOT, "content", "videos.json"))):
        if v.get("hidden") or v["id"] in cues: continue
        m = json.load(open(os.path.join(CACHE, "meta", v["id"] + ".json")))
        segs = segments(m)
        if len(segs) < 3: continue  # 沒章節：面板退回只顯示影片＋摘要
        todo[v["id"]] = {"title": v["title"], "desc": m.get("description") or "", "segs": segs}
    ids = list(todo)[: a.limit]
    batches = [({k: todo[k] for k in ids[i:i + a.batch]}, a.model) for i in range(0, len(ids), a.batch)]
    print(f"{len(ids)} 支需要產生 cues，{len(batches)} 批", file=sys.stderr)
    fail = {}
    with ThreadPoolExecutor(a.jobs) as ex:
        for ok, bad in ex.map(run, batches):
            cues.update(ok); fail.update(bad)
            json.dump(cues, open(OUT, "w"), ensure_ascii=False, indent=1)  # 每批存檔，可續跑
            print(f"進度 {len(cues)} 支", file=sys.stderr)
    print(f"完成：{len(cues)} 支有 cues，{len(fail)} 支失敗 {list(fail)[:5]} → {OUT}")


if __name__ == "__main__":
    main()
