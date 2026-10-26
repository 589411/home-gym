#!/usr/bin/env python3
"""部位圖示：同一個人形，只把要練的部位塗上品牌色塊。覆寫 js/icons.js 的七個部位鍵，其餘（dice/flame/check）不動。
python3 tools/body_icons.py   （純程式繪製，不用 LLM）"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "js", "icons.js")
HL = "var(--brand,#e8590c)"

# 人形（正面站姿）：頭、軀幹、雙臂、雙腿；整組一起半透明，避免重疊處變深
BODY = ('<g opacity="0.22" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
        '<circle cx="24" cy="6.5" r="4.2" stroke="none"/>'
        '<path d="M15.5 12.5Q24 10.5 32.5 12.5L30 29Q24 31 18 29Z" stroke-width="2"/>'
        '<path d="M13 14L9 23L8 31M35 14L39 23L40 31" fill="none" stroke-width="4"/>'
        '<path d="M20.5 29L19.5 38L19.5 45.5M27.5 29L28.5 38L28.5 45.5" fill="none" stroke-width="5"/></g>')

def hl(inner):  # 色塊
    return f'<g fill="{HL}" stroke="{HL}" stroke-linecap="round" stroke-linejoin="round">{inner}</g>'

PARTS = {
    "chest": hl('<path d="M23 14.6L16.6 15L16 18.2L19.6 20.8L23 20Z" stroke-width="1.2"/><path d="M25 14.6L31.4 15L32 18.2L28.4 20.8L25 20Z" stroke-width="1.2"/>'),
    "back": hl('<path d="M16.5 13.8L23 14.8L23 26L19 26Z" stroke-width="1.5"/><path d="M31.5 13.8L25 14.8L25 26L29 26Z" stroke-width="1.5"/>'),
    "shoulders": hl('<circle cx="15" cy="14" r="3.6" stroke="none"/><circle cx="33" cy="14" r="3.6" stroke="none"/>'),
    "arms": hl('<path d="M13 15.5L9 23L8 31M35 15.5L39 23L40 31" fill="none" stroke-width="4.6"/>'),
    "core": hl('<rect x="19.2" y="19.5" width="9.6" height="9.5" rx="3" stroke="none"/>'),
    "lower": hl('<path d="M20.5 29L19.5 38L19.5 45.5M27.5 29L28.5 38L28.5 45.5" fill="none" stroke-width="5.4"/><ellipse cx="24" cy="28" rx="6.5" ry="2.8" stroke="none"/>'),
    "full": hl('<circle cx="24" cy="6.5" r="4.2" stroke="none"/><path d="M15.5 12.5Q24 10.5 32.5 12.5L30 29Q24 31 18 29Z" stroke-width="2"/>'
               '<path d="M13 14L9 23L8 31M35 14L39 23L40 31" fill="none" stroke-width="4"/><path d="M20.5 29L19.5 38L19.5 45.5M27.5 29L28.5 38L28.5 45.5" fill="none" stroke-width="5"/>'),
}

def svg(k):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">{BODY}{PARTS[k]}</svg>'

src = open(OUT).read()
icons = json.loads(re.search(r"const ICONS = (\{.*\});", src, re.S).group(1))
for k in PARTS: icons[k] = svg(k)
open(OUT, "w").write("// 部位圖示由 tools/body_icons.py 產生；dice/flame/check 來自 tools/gen_icons.py。勿手改\nconst ICONS = " + json.dumps(icons, ensure_ascii=False, indent=1) + ";\n")
# 預覽
html = "<body style='display:flex;gap:16px;padding:20px;color:#444;--brand:#e8590c'>" + "".join(f"<div style='width:120px;text-align:center'>{svg(k)}<br>{k}</div>" for k in PARTS)
open(os.path.join(ROOT, "tools", ".cache", "body_icons_preview.html"), "w").write(html)
print("ok", list(PARTS))
