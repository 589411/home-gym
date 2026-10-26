# home-gym — 給 AI 的 repo 規則
- 純靜態站（GitHub Pages），不要引入 build 工具或框架。
- 影片資料只改 `content/*.json`，再跑 build 產生 `data/`；不要手改 data。
- 影片 ID 一律由 yt-dlp 取得並驗證，不准讓 agy 憑印象給 ID。
- agy 只做分類／摘要，輸出要由程式驗證（器材標籤須在標題或描述找得到）。
- 中文用台灣繁體。
