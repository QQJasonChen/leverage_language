# Chrome Web Store Alpha 測試版上架完整指南

## 📋 上架前檢查清單

- [ ] 已建立發布版本 ZIP：`release/leveragelanguage-v1.0.0-alpha.zip`
- [ ] 已準備開發者帳號（需要 $5 USD 一次性費用）
- [ ] 已準備好測試者的 Gmail 信箱列表

## 🚀 Step-by-Step 上架流程

### Step 1: 註冊開發者帳號（如果還沒有）

1. 前往 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 使用您的 Google 帳號登入
3. 第一次需要支付 $5 USD 註冊費（一次性）
4. 填寫開發者資訊：
   - 開發者名稱：您的名字或團隊名稱
   - 聯絡 Email
   - 同意服務條款

### Step 2: 建立新項目

1. 在 Dashboard 點擊「**新增項目**」(New Item)
2. 選擇「**擴充功能**」(Extension)
3. 上傳 ZIP 檔案：
   - 點擊「選擇檔案」
   - 選擇 `release/leveragelanguage-v1.0.0-alpha.zip`
   - 等待上傳完成（會自動驗證）

### Step 3: 填寫商店資訊

#### 3.1 基本資訊
```
擴充功能名稱：LeverageLanguage - AI Language Learning (Alpha Test)
簡短描述（132字元內）：AI-powered language learning assistant for YouTube, Netflix and web content (ALPHA TEST)
類別：教育 (Education)
語言：繁體中文 + English
```

#### 3.2 詳細描述（建議內容）
```
🚨 ALPHA TEST VERSION - 功能可能不穩定，歡迎回報問題！
🚨 ALPHA TEST VERSION - Features may be unstable, feedback welcome!

LeverageLanguage 是一個 AI 驅動的語言學習助手，幫助您從任何網路內容中學習語言。

✨ 主要功能 / Key Features:
• 🤖 AI 語言分析（支援 Gemini 和 OpenAI）/ AI language analysis
• 📺 YouTube & Netflix 字幕智能擷取 / Smart subtitle capture
• 🌍 多語言支援：英、日、韓、荷蘭文 / Multi-language support
• 📝 多句子同時分析（最多 5 句）/ Multi-sentence analysis
• 🎯 發音指導、文法分析、文化解說 / Pronunciation, grammar, culture
• 💾 學習歷史與匯出功能 / Learning history & export

⚠️ Alpha 版本注意事項 / Alpha Version Notes:
• 部分功能仍在優化中 / Some features still being optimized
• 可能遇到效能問題 / May encounter performance issues
• 建議使用緊急清理功能 / Use emergency cleanup when needed

📧 問題回報 / Bug Reports:
GitHub: https://github.com/[your-username]/youglish-extension/issues

🔒 隱私權 / Privacy:
• 所有資料儲存在本地 / All data stored locally
• API 金鑰安全加密 / API keys securely encrypted
• 不收集個人資料 / No personal data collection

📄 授權 / License: MIT License
```

#### 3.3 圖片資源

需要準備：
1. **商店圖示** - 128x128 PNG（必須）
2. **螢幕截圖** - 1280x800 或 640x400 PNG（至少 1 張，最多 5 張）
3. **宣傳圖片**（選用）：
   - 小型宣傳磚塊：440x280 PNG
   - 大型宣傳磚塊：920x680 PNG

### Step 4: 設定發布選項 ⭐重要

#### 4.1 選擇「私人」發布（推薦用於 Alpha 測試）

1. 在「發布」(Distribution) 頁面
2. 選擇「**私人**」(Private) 
3. 選項說明：
   - ✅ **私人** - 只有您邀請的人可以安裝
   - ❌ **公開** - 所有人都可以搜尋安裝（不建議 Alpha 版）

#### 4.2 建立測試群組

1. 選擇「**群組發布**」(Group Publishing)
2. 點擊「**建立新群組**」
3. 群組設定：
   ```
   群組名稱：Alpha Testers
   描述：早期測試使用者
   ```
4. 新增測試者：
   - 點擊「新增成員」
   - 輸入測試者的 Gmail（每行一個）
   - 最多可加 100 個測試者

### Step 5: 隱私權政策

建立簡單的隱私權政策頁面，或使用以下範本：

```
隱私權政策 / Privacy Policy

最後更新：2025年8月3日

LeverageLanguage 尊重您的隱私：

1. 資料收集 / Data Collection:
   - 僅在本地儲存學習記錄 / Learning data stored locally only
   - 不上傳個人資料到伺服器 / No personal data uploaded

2. 權限使用 / Permissions:
   - activeTab: 分析當前頁面內容 / Analyze current page
   - storage: 儲存設定和學習記錄 / Store settings and history
   - 其他權限僅用於核心功能 / Other permissions for core features only

3. 第三方服務 / Third-party Services:
   - 使用者自行提供 API 金鑰 / Users provide their own API keys
   - 不會分享資料給第三方 / No data sharing with third parties

聯絡方式 / Contact: [your-email]
```

### Step 6: 提交審核

1. 檢查所有必填欄位 ✅
2. 點擊「**儲存草稿**」先保存
3. 預覽商店頁面
4. 確認無誤後點擊「**提交審核**」

### Step 7: 等待審核

- 通常需要 **1-3 個工作天**
- 如果被拒絕，會收到詳細原因
- Alpha/測試版通常較容易通過

### Step 8: 發布後分享

審核通過後，您會收到：
1. **私人安裝連結**（類似這樣）：
   ```
   https://chrome.google.com/webstore/detail/[extension-id]?authuser=[number]
   ```

2. **分享給測試者**：
   ```
   嗨！我的 Chrome 擴充功能 Alpha 測試版已經上架！
   
   安裝步驟：
   1. 點擊這個連結：[您的私人連結]
   2. 點擊「加到 Chrome」
   3. 開始使用並提供回饋
   
   注意：這是 Alpha 測試版，可能有 bug
   問題回報：[您的回報方式]
   
   感謝參與測試！🙏
   ```

## 💡 重要提醒

### DO ✅
- 使用「私人」發布模式
- 建立測試群組管理測試者
- 在描述中清楚標示「Alpha 測試版」
- 提供問題回報方式

### DON'T ❌
- 不要選擇「公開」發布
- 不要忘記隱私權政策
- 不要使用開發版 ZIP（要用 release 版）

## 🔄 更新版本

當需要更新時：
1. 修改 `manifest.json` 的版本號
2. 重新執行 `./build-alpha-release.sh`
3. 在 Dashboard 上傳新的 ZIP
4. 等待審核（更新通常更快）

## 📊 查看數據

在 Developer Dashboard 可以看到：
- 安裝人數
- 使用統計
- 錯誤報告
- 使用者評論（如果有）

---

祝您的 Alpha 測試順利！有問題隨時查看 [Chrome Web Store 官方文檔](https://developer.chrome.com/docs/webstore/)