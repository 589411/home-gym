# STATUS — home-gym

**更新：2026-10-26**

## 核心任務
整理 YouTube 上「在家用彈力帶／彈力繩／壺鈴等器材健身」的影片，做成可依器材、部位、時長篩選的靜態網站。用 agy（Google Antigravity CLI）做分類整理。

## 現況
- 已 `git init`。`tools/search.py`（yt-dlp 搜尋，過濾 3–60 分鐘）→ `tools/classify.py`（oEmbed 驗證 → agy 批次分類 → 程式把關）可跑通，47 支（彈力帶 26、壺鈴 21）全部分類完，結果在 `tools/.cache/classified.json`（gitignore，可重跑）。
- 分類軸（依使用者要求參考健身規劃）：`split` 分化（full-body/upper/lower/push/pull/legs/core）、`muscles` 肌群、`style` 型態（strength/hiit/cardio/mobility/warmup）、`intensity` 強度 1–5、`level` 適合程度、`equipment` 器材（須在標題找到關鍵字，含簡體，否則標 unverified）。
- agy 1.4.7 模型清單已變：`Gemini 3.1 Pro` 不存在，改用 `Gemini 3.8 Flash (High)`。prompt 要寫「不要使用任何工具」，否則無頭模式會因要執行指令被擋。

## 已知限制
- 強度／肌群只根據標題與時長推測（沒看字幕或內容），僅供篩選參考；split 有些為空（標題沒線索）。
- 標題時長與實際不符的情況存在（例：標 9 分鐘、實際 14 分鐘），以 yt-dlp 的 duration 為準。

## 卡在哪
- 無。

## 下一個具體動作
1. 人工抽查 classified.json，挑要收錄的影片 → 寫入 `content/*.json`。
2. 寫 `tools/build_data.py` 與靜態站（index.html + 篩選：器材／分化／強度／時長），可考慮加上「週訓練計畫」視圖（依分化排 3–5 天）。
3. 擴大搜尋：加關鍵字（壺鈴、彈力繩的分化專項，如「彈力帶 背」「壺鈴 臀」）補足 push/pull/legs 缺口。
