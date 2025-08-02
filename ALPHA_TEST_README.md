# LeverageLanguage Alpha Test Version 1.0.0-alpha

## 🚨 重要提醒 / Important Notice

這是一個 **Alpha 測試版本**，主要用於收集早期使用者回饋。部分功能可能不穩定或未完全優化。

This is an **ALPHA TEST VERSION** designed for early user feedback. Some features may be unstable or not fully optimized.

## 📋 Alpha 版本特性 / Alpha Features

### ✅ 已實現功能 / Implemented Features

1. **YouTube & Netflix 字幕擷取**
   - YouTube 即時字幕收集
   - Netflix 字幕直接擷取（需要在影片頁面使用）
   - 多句子擷取功能（最多 5 句）

2. **AI 語言分析**
   - 支援 Google Gemini 和 OpenAI GPT
   - 多語言支援：英文、日文、韓文、荷蘭文
   - 荷蘭語 TMP (Time-Manner-Place) 結構分析
   - A2 測試使用指導

3. **音頻功能**
   - AI 語音合成（需要 OpenAI API）
   - 緊急音頻快取清理（防止瀏覽器當機）

4. **學習功能**
   - 學習歷史記錄
   - 字彙卡片生成
   - 多格式匯出（Markdown、Notion、Obsidian）

### ⚠️ 已知限制 / Known Limitations

1. **效能問題**
   - 音頻快取可能導致記憶體使用過高
   - 建議定期使用「🚨 Emergency Cleanup」按鈕

2. **平台限制**
   - Netflix 時間戳記無法回放
   - 某些網站的文章收集功能不穩定

3. **UI 問題**
   - 某些按鈕可能顯示不正確的圖示
   - Transcript 標籤頁有時會出現在其他頁面下方

## 🐛 問題回報 / Bug Reporting

如果遇到問題，請提供以下資訊：

1. **問題描述**：詳細說明遇到的問題
2. **重現步驟**：如何重現這個問題
3. **瀏覽器資訊**：Chrome 版本號
4. **錯誤訊息**：如果有錯誤訊息，請截圖或複製

回報方式：
- GitHub Issues: https://github.com/QQJasonChen/youglish-extension/issues
- Email: [您的聯絡信箱]

## 🔧 安裝說明 / Installation

### 從 Chrome Web Store 安裝（推薦）
1. 訪問 Chrome Web Store 頁面
2. 點擊「加到 Chrome」
3. 確認權限並安裝

### 開發者模式安裝
1. 下載並解壓縮擴充功能檔案
2. 打開 Chrome 瀏覽器
3. 進入 `chrome://extensions/`
4. 開啟右上角的「開發人員模式」
5. 點擊「載入未封裝項目」
6. 選擇解壓縮的資料夾

## 🚀 快速開始 / Quick Start

### 1. 設定 AI API（選用）
1. 點擊擴充功能圖示 → 設定
2. 啟用 AI 分析
3. 選擇 AI 提供商（Gemini 或 OpenAI）
4. 輸入 API 金鑰

### 2. 使用 YouTube 字幕擷取
1. 在 YouTube 影片頁面
2. 開啟 Side Panel
3. 切換到 Transcript 標籤
4. 點擊「Start caption collection」

### 3. 使用 Netflix 字幕擷取
1. 在 Netflix 影片頁面
2. 使用快捷鍵：
   - Cmd+Opt+Ctrl+C：擷取目前字幕
   - Cmd+Opt+Ctrl+H：隱藏/顯示浮動視窗
   - Cmd+Opt+Ctrl+S：儲存到學習歷史

## 📝 版本歷史 / Version History

### v1.0.0-alpha (2025-08-02)
- 首個 Alpha 測試版本
- 實現基本的 YouTube 和 Netflix 支援
- 加入多語言 AI 分析
- 實現緊急音頻清理功能
- 支援多句子擷取（最多 5 句）

## 📄 授權 / License

本專案採用 MIT License 授權。詳見 [LICENSE](LICENSE) 檔案。

Copyright (c) 2025 QQJasonChen

---

**感謝您參與 Alpha 測試！您的回饋對我們非常重要。**

**Thank you for participating in the Alpha test! Your feedback is invaluable to us.**