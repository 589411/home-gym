#!/usr/bin/env python3
"""agy 生成 SVG 圖示 → 程式驗證（只允許安全元素、無腳本/外連）→ js/icons.js ＋ 預覽頁。
python3 tools/gen_icons.py [--model "Claude Opus 4.6 (Thinking)"] [--only chest,back]"""
import argparse, json, os, re, subprocess, sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "js", "icons.js")
RAW = os.path.join(CACHE, "icons_raw.json")
ALLOWED = {"svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"}
NEED = {
    "chest": "胸肌（正面上身輪廓，胸大肌區塊強調）", "back": "背部（背面上身輪廓，V 字背闊肌）",
    "shoulders": "肩膀（雙肩三角肌，上身正面）", "arms": "手臂（彎舉的二頭肌手臂）",
    "lower": "臀腿（下半身：臀部與大腿輪廓）", "core": "核心腹肌（腹部六塊肌）", "full": "全身（站立人形，雙臂微張）",
    "dice": "骰子（隨機挑一支）", "flame": "火焰（連續練習天數）", "check": "打勾（完成）",
}
PROMPT = """你是 UI 圖示設計師。不要使用任何工具、不要讀寫檔案或執行指令，直接在回覆中輸出結果。
為健身 App 設計一組風格一致的 SVG 線條圖示，主題：
{need}

規格（嚴格遵守）：
- 每個圖示：<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">…</svg>
- 只用 path、circle、ellipse、rect、line、polyline、polygon、g；不要 style、script、text、image、use、渐变、濾鏡、外部連結
- 一律用 currentColor 描邊；可用 fill="currentColor" 並搭配 opacity="0.2" 做局部強調（要訓練的肌群區塊用這個強調）
- 風格：極簡、圓潤、同一套筆畫粗細，一眼看得出是什麼；身體類圖示要清楚標出「該部位」被強調
- 每個圖示的 path 指令總長度不要超過 600 字元

只輸出一個 JSON 物件：key 是 {keys}，value 是該圖示的完整 SVG 字串。不要輸出任何 JSON 以外的文字。"""


def validate(name, svg):
    errs = []
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as e:
        return [f"XML 錯誤 {e}"]
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag not in ALLOWED: errs.append(f"不允許的元素 <{tag}>")
        for k, v in el.attrib.items():
            kk = k.split("}")[-1].lower()
            if kk.startswith("on") or kk in ("href", "style", "src"): errs.append(f"不允許的屬性 {k}")
            if re.search(r"(javascript:|url\(|http)", v) and kk != "xmlns": errs.append(f"可疑的值 {k}={v[:30]}")
    if root.attrib.get("viewBox") != "0 0 48 48": errs.append("viewBox 不是 0 0 48 48")
    if len(svg) > 4000: errs.append(f"太長 {len(svg)}")
    if "currentColor" not in svg: errs.append("沒用 currentColor")
    return errs


def call(keys, model, note=""):
    prompt = PROMPT.format(need="\n".join(f"- {k}: {NEED[k]}" for k in keys), keys=json.dumps(keys)) + ("\n\n上一版的審查回饋（必須修正）：\n" + note if note else "")
    r = subprocess.run(["agy", "-p", prompt, "--print-timeout", "6m", "--sandbox", "--model", model],
                       capture_output=True, text=True, timeout=420, cwd=CACHE)
    m = re.search(r"\{.*\}", r.stdout, re.S)
    if not m: raise RuntimeError("agy 沒有回傳 JSON：" + (r.stdout[-200:] or r.stderr[-200:]))
    return json.loads(m.group(0))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--model", default="Claude Opus 4.6 (Thinking)"); ap.add_argument("--only"); ap.add_argument("--note", default=""); ap.add_argument("--jobs", type=int, default=1); a = ap.parse_args()
    keys = a.only.split(",") if a.only else list(NEED)
    raw = json.load(open(RAW)) if os.path.exists(RAW) else {}
    if a.jobs > 1:  # 一個圖示一次呼叫，並行；單支逾時/失敗不拖垮其他
        from concurrent.futures import ThreadPoolExecutor
        def one(k):
            try: return call([k], a.model, a.note)
            except Exception as e: print(f"✗ {k} agy 失敗：{str(e)[:80]}", file=sys.stderr); return {}
        with ThreadPoolExecutor(a.jobs) as ex:
            for r in ex.map(one, keys): raw.update(r)
    else:
        raw.update(call(keys, a.model, a.note))
    json.dump(raw, open(RAW, "w"), ensure_ascii=False, indent=1)
    good = {}
    for k in NEED:
        errs = validate(k, raw[k]) if k in raw else ["缺少"]
        if errs: print(f"✗ {k}: {'；'.join(errs)}", file=sys.stderr)
        else: good[k] = re.sub(r"\s+", " ", raw[k]).strip()
    open(OUT, "w").write("// 由 tools/gen_icons.py 產生（agy 繪製、程式驗證），勿手改\nconst ICONS = " + json.dumps(good, ensure_ascii=False, indent=1) + ";\n")
    prev = "<body style='font:14px sans-serif;display:grid;grid-template-columns:repeat(5,160px);gap:16px;padding:16px'>" + "".join(
        f"<div style='text-align:center'><div style='width:96px;height:96px;margin:auto;color:#FF6B3D'>{s}</div>{k}</div>" for k, s in good.items())
    open(os.path.join(CACHE, "icons_preview.html"), "w").write(prev)
    print(f"{len(good)}/{len(NEED)} 個通過驗證 → {OUT}")


if __name__ == "__main__":
    main()
