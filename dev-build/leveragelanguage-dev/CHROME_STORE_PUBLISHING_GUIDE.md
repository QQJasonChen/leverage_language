# Chrome Web Store 發布指南 / Publishing Guide

## 📦 準備發布檔案 / Prepare Publishing Files

### 1. 建立發布包 / Create Release Package

```bash
# 1. 建立發布資料夾
mkdir -p release/youglish-extension-v1.0.0-alpha

# 2. 複製必要檔案（排除開發和測試檔案）
cp -r _locales article-*.js auth-ui.html background.js components content.js \
      icons language-selector.* lib manifest.json netflix-*.js \
      onboarding-flow.html options.* proxy.html sidepanel.* \
      styles subscription-ui.html youtube-*.js \
      release/youglish-extension-v1.0.0-alpha/

# 3. 複製授權和說明檔案
cp LICENSE ALPHA_TEST_README.md release/youglish-extension-v1.0.0-alpha/

# 4. 建立 ZIP 檔案
cd release
zip -r youglish-extension-v1.0.0-alpha.zip youglish-extension-v1.0.0-alpha
```

### 2. 準備商店資源 / Prepare Store Assets

需要準備以下圖片：

1. **商店圖示** (Store Icon)
   - 128x128 PNG

2. **宣傳圖片** (Promotional Images)
   - 小型宣傳磚塊：440x280 PNG
   - 大型宣傳磚塊：920x680 PNG（選用）
   - 橫幅：1400x560 PNG（選用）

3. **螢幕截圖** (Screenshots)
   - 1280x800 或 640x400 PNG
   - 至少 1 張，最多 5 張

## 🚀 發布到 Chrome Web Store / Publish to Chrome Web Store

### 第一步：註冊開發者帳號

1. 訪問 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 使用 Google 帳號登入
3. 支付一次性註冊費用 $5 USD
4. 填寫開發者資訊

### 第二步：建立新項目

1. 點擊「新增項目」
2. 上傳 ZIP 檔案：`youglish-extension-v1.0.0-alpha.zip`
3. 選擇發布選項：
   - **公開** - 所有人都可以搜尋和安裝
   - **不公開** - 只有知道連結的人可以安裝（推薦 Alpha 測試）

### 第三步：填寫商店資訊

#### 基本資訊
```
名稱：LeverageLanguage - AI Language Learning (Alpha Test)
簡短描述：AI 驅動的語言學習工具 - Alpha 測試版
類別：教育
語言：繁體中文、English
```

#### 詳細描述（範例）
```
🚨 Alpha 測試版本 - 功能可能不穩定，歡迎回報問題！

LeverageLanguage 是一個強大的語言學習擴充功能，整合 AI 技術提供：

✨ 主要功能：
• YouTube & Netflix 字幕擷取與分析
• AI 語言分析（支援 Gemini 和 OpenAI）
• 多語言支援：英文、日文、韓文、荷蘭文
• 發音指導、文法分析、文化背景解說
• 學習歷史記錄與字彙卡片生成

⚠️ Alpha 版本注意事項：
• 部分功能仍在優化中
• 可能遇到效能或穩定性問題
• 建議定期使用緊急清理功能

📧 問題回報：
GitHub: https://github.com/[your-username]/youglish-extension/issues

本擴充功能使用 MIT License 授權。
```

### 第四步：設定隱私權政策

建立簡單的隱私權政策：

```
隱私權政策

LeverageLanguage 尊重您的隱私：

1. 資料收集：
   - 僅在本地儲存學習記錄和設定
   - API 金鑰安全儲存在本地
   - 不會收集或傳送個人資料

2. 權限使用：
   - activeTab：存取當前頁面內容
   - storage：儲存設定和學習記錄
   - 其他權限僅用於核心功能

3. 第三方服務：
   - 使用 Google Gemini 或 OpenAI API（需用戶提供金鑰）
   - 不會將資料分享給其他第三方

最後更新：2025年8月2日
```

### 第五步：測試群組設定（推薦）

1. 建立測試群組：
   - 在「發布」頁面選擇「測試群組」
   - 建立新群組（例如：「Alpha 測試者」）
   - 新增測試者的 email

2. 分享測試連結：
   ```
   測試者安裝步驟：
   1. 接受測試邀請 email
   2. 點擊測試連結
   3. 安裝擴充功能
   4. 提供回饋
   ```

## 📝 發布檢查清單 / Publishing Checklist

- [ ] manifest.json 版本號已更新
- [ ] 所有語言檔案已更新為 Alpha 版本
- [ ] 已移除所有測試檔案
- [ ] 已建立 ZIP 檔案
- [ ] 已準備商店圖片資源
- [ ] 已撰寫商店描述
- [ ] 已準備隱私權政策
- [ ] 已設定適當的發布範圍

## 🔄 更新流程 / Update Process

當需要更新 Alpha 版本時：

1. 更新版本號：
   ```json
   "version": "1.0.1",
   "version_name": "1.0.1-alpha"
   ```

2. 更新 ALPHA_TEST_README.md

3. 建立新的 Git tag：
   ```bash
   git tag -a v1.0.1-alpha -m "Alpha update with bug fixes"
   ```

4. 重新打包並上傳

## 💡 提示 / Tips

1. **使用不公開發布**：Alpha 測試建議使用不公開發布，只分享給測試者
2. **收集回饋**：建立 Google 表單收集結構化的回饋
3. **版本管理**：保持清楚的版本記錄，方便追蹤問題
4. **測試群組**：使用 Chrome Web Store 的測試群組功能管理測試者

---

祝發布順利！如有問題請參考 [Chrome Web Store 開發者文檔](https://developer.chrome.com/docs/webstore/)