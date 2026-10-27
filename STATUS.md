# STATUS — home-gym

**更新：2026-10-26**

## 核心任務
整理 YouTube 上「在家用彈力帶／彈力繩／壺鈴等器材健身」的影片，做成可依器材、部位、時長篩選的靜態網站。用 agy（Google Antigravity CLI）做分類整理。

## 現況（2026-10-26）
- **方向（使用者）**：首頁（原「戰情室」，2026-10-26 站名改為「我家也有健身房」）——挑想練的部位、存播放清單、每天打開跟著做；分「講解」與「跟著做的系列」兩類；不限國內，國外品質通常較好；**agy 收集素材、Claude 把關**；舊版 47 支「品質很差」（只是搜尋排序，沒篩）。
- **管線**：`search.py`（yt-dlp 搜尋＋依部位的英文查詢，粗篩觀看≥5萬）→ `enrich.py`（抓真實觀看／讚／訂閱／日期／說明／章節，快取 `tools/.cache/meta/`）→ `quality.py`（硬門檻：觀看≥5萬、頻道訂閱≥5萬、讚率≥0.8%、說明≥150字、≤9年、擋高齡／孕婦／減脂行銷；另算 0–100 品質分）→ `classify.py`（agy 看標題＋說明＋章節分類，`kind`=follow/guide；器材須在文字找到，否則 unverified）→ `export_content.py` → `content/*.json`（唯一手編處，加 `"hidden": true` 排除）→ `build_data.py` → `data/`。
- **每日課程**：`search_programs.py` 搜播放清單（標題像課程、≥5支、多數≥5分鐘）→ `classify_programs.py`；品質改用「頻道是否已通過影片閘門」判斷。目前通過 4 個（Workout With Roxanne 28 天壺鈴 SURGE／IGNITE、28 天啞鈴、ACHV PEAK 31 天彈力帶）。
- **現有資料**：163 支過品質閘門 → 157 支入庫（跟練 132、講解 25；70 個頻道；彈力帶 81、壺鈴 69）。
- **網站（hey-o 風格）**：戰情室（部位磁磚＋器材／時間／強度／程度，依品質排序，🎲隨機一支）、跟練系列（每日進度、第 N 天）、動作講解、我的清單（自訂播放清單、連續播放、播完自動記完成與連續天數）。狀態只存本機 localStorage。
- agy 1.4.7：模型用 `Gemini 3.8 Flash (High)`；prompt 須寫「不要使用任何工具」。

## 進展（2026-10-26 下半）
- **UI/UX 改版**（Opus 子代理做、我審查實測）：首屏「今天的訓練」入口＋大部位磁磚，條件收進「更多條件」；清單可排序、刪除可復原；無 emoji；`?demo=1` 注入假 cues 供測試（預設關閉）。
- **遠距離跟練面板**：使用者要求「不逐字翻譯、不預告下一動作，只強調目前動作的重點與注意事項，字要大」。已實作：動作名稱＋重點＋注意事項（空則整塊隱藏）、章節跳段、全螢幕。資料 `content/cues.json` → `data/cues.json`（`tools/cues.py`：時間來自 YouTube 章節，LLM 只寫中文名／重點／注意事項；動作段<2 的影片不收）。**123 支有 cues（跟練 105/132、講解 18/25）**，其餘沒有章節，面板退回只顯示影片＋摘要。cues 內容是 AI 依公認動作要領寫的，**不是影片內教練的原話**，有些偏通用（例：各種弓箭步都寫「前腳踩穩」）。
- **圖示**：使用者指定改用 **codex CLI** 生成（已 `npm i -g @openai/codex` 並登入，`tools/gen_icons.py` 走 `codex exec`，逐個並行，程式驗證只允許安全元素）。胸／背／肩／核心／全身／骰子／火焰／打勾可用；七個部位圖示已改由 `tools/body_icons.py` 以同一人形＋色塊繪製（codex 僅剩 dice／flame／check）。
- **agy 額度**：Gemini 3.8 Flash 與 Sonnet 4.6 皆 RESOURCE_EXHAUSTED，約 118–167 小時後重置；cues 後半段改用 codex（`cues.py --engine codex`）。

- **字幕預設開＋自動翻繁中**（2026-10-27）：`cc_load_policy` 開字幕，`zhCaptions()` 輪詢字幕清單，有中文軌就用、否則把第一條可翻譯軌翻成繁中。用的是 YouTube 未公開的 captions setOption，失敗時退回原字幕。已實測有字幕的影片；**很多健身影片根本沒有字幕軌**（抽樣第一支就沒有），那種只能維持無字幕。

## 卡在哪
- **YouTube 目前對本機 IP 要求登入驗證（bot check）**——連續抓太多觸發。**不要用 cookies 繞過**，等它自己解除（先 `yt-dlp --skip-download --print id <url>` 試一支）。影響：14 個每日課程候選（TIFF x DAN 6 Week Shred、Vera LaRo 8 Week 等）還沒驗證頻道品質，`tools/.cache/programs_q.json` 裡 `pass:false`。
- 未實測：手機版面、實際播放（IFrame API 播完自動下一支）、離線／PWA。

## 下一個具體動作
0. （已完成）部位圖示改成同一人形＋色塊，`tools/body_icons.py` 程式繪製；胸用斜面不用橢圓。手機實測時再看是否需微調。
1. 抽查 `content/videos.json`（157 支）、`content/cues.json` 與 4 個系列，不要的加 `"hidden": true`，重跑 `build_data.py`。
2. 解除限制後：對 14 個待驗證課程跑品質閘門（取第一天影片的 meta），通過的 `export_content.py` 收進來；再補搜尋「真正每天跟練」的系列（Caroline Girvan 的 EPIC／Power 等多週課程）。
3. （已上線 2026-10-26：https://gym.launchdock.app ，GitHub Pages＋Cloudflare 灰雲 CNAME，HTTPS 已強制；已上架 lab.launchdock.app，id `home-gym`，封面 codex 生成已上線）手機實測播放；PWA（pwa-offline）；清單／進度要跨裝置同步再考慮 firebase-web-sync。
