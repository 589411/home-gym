# STATUS — home-gym

**更新：2026-10-26**

## 核心任務
整理 YouTube 上「在家用彈力帶／彈力繩／壺鈴等器材健身」的影片，做成可依器材、部位、時長篩選的靜態網站。用 agy（Google Antigravity CLI）做分類整理。

## 現況
- 已 `git init`。`tools/search.py`（yt-dlp 搜尋，過濾 3–60 分鐘）→ `tools/classify.py`（oEmbed 驗證 → agy 批次分類 → 程式把關）可跑通，47 支（彈力帶 26、壺鈴 21）全部分類完，結果在 `tools/.cache/classified.json`（gitignore，可重跑）。
- 分類軸（依使用者要求參考健身規劃）：`split` 分化（full-body/upper/lower/push/pull/legs/core）、`muscles` 肌群、`style` 型態（strength/hiit/cardio/mobility/warmup）、`intensity` 強度 1–5、`level` 適合程度、`equipment` 器材（須在標題找到關鍵字，含簡體，否則標 unverified）。
- agy 1.4.7 模型清單已變：`Gemini 3.1 Pro` 不存在，改用 `Gemini 3.8 Flash (High)`。prompt 要寫「不要使用任何工具」，否則無頭模式會因要執行指令被擋。

- 篩選網站已完成（純靜態，`index.html`＋`css/app.css`＋`js/app.js`）：器材／部位／肌群／型態／強度／程度／時長／語言，組內 OR、組間 AND，標題／頻道搜尋，篩選狀態寫入網址 hash 可分享，點卡片以 youtube-nocookie 嵌入播放，支援深色模式。資料流：`content/videos.json`（唯一手編處，加 `"hidden": true` 可排除）→ `python3 tools/build_data.py` → `data/videos.json`。
- 本機實測（Chrome＋http.server）：載入 47 支、壺鈴篩出 21、壺鈴＋強度 4 剩 5、清除回 47、搜尋 Caroline 剩 3、開關播放視窗正常、主控台無錯誤。**未實測**：手機版面、實際影片播放（背景視窗無法播放）、PWA／離線（尚未做）。

## 已知限制
- 強度／肌群只根據標題與時長推測（沒看字幕或內容），僅供篩選參考；split 有些為空（標題沒線索）。
- 標題時長與實際不符的情況存在（例：標 9 分鐘、實際 14 分鐘），以 yt-dlp 的 duration 為準。

## 卡在哪
- 無。

## 下一個具體動作
1. 人工抽查 `content/videos.json`（47 支），不要的加 `"hidden": true` 後重跑 build_data.py。
2. 手機實測版面與播放；確認後建 GitHub repo、開 Pages（參考 skill static-site-deploy）。
3. 擴大搜尋補 push/pull/legs 缺口（「彈力帶 背」「壺鈴 臀」等）→ search.py → classify.py → 併入 content。
4. 視需要加 PWA（skill pwa-offline）與「週訓練計畫」視圖。
