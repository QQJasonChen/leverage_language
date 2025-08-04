# 版本管理指南 / Version Management Guide

## 🎯 版本區分策略

### 1. 開發版本 (Development Version) - 自己使用
**檔案**: `leveragelanguage-DEV-*.zip`
**用途**: 個人開發測試使用
**特點**:
- ✅ 包含所有測試檔案
- ✅ 包含開發工具和腳本
- ✅ 包含 debug 功能
- ✅ manifest.json 顯示 "Development Build"
- ⚠️ 不要上傳到 Chrome Web Store

**建立方式**:
```bash
chmod +x build-dev-version.sh
./build-dev-version.sh
```

### 2. Alpha 測試版本 (Production Alpha) - 給同學測試
**檔案**: `leveragelanguage-v1.0.0-alpha.zip`
**用途**: Chrome Web Store 發布用
**特點**:
- ✅ 排除測試檔案
- ✅ 優化過的版本
- ✅ manifest.json 顯示 "Alpha Test Version"
- ✅ 適合上傳到 Chrome Web Store

**建立方式**:
```bash
chmod +x build-alpha-release.sh
./build-alpha-release.sh
```

## 📁 目錄結構

```
youglish-extension/
├── release/                    # 生產版本 (給其他人用)
│   └── leveragelanguage-v1.0.0-alpha.zip
├── dev-build/                  # 開發版本 (自己用)
│   └── leveragelanguage-DEV-20250802-214500.zip
└── (source files...)
```

## 🔍 如何區分版本

### 方法 1: 檔名區分
- **開發版**: `leveragelanguage-DEV-*.zip` (有時間戳記)
- **發布版**: `leveragelanguage-v1.0.0-alpha.zip` (版本號)

### 方法 2: 安裝後查看
1. 安裝擴充功能
2. 到 chrome://extensions/
3. 查看版本名稱：
   - 開發版顯示: "1.0.0-dev (Development Build)"
   - 發布版顯示: "1.0.0-alpha (Early Test Version)"

### 方法 3: 檔案大小
- 開發版通常較大（包含測試檔案）
- 發布版較小（已優化）

## 🚀 使用流程

### 日常開發
1. 直接在原始碼目錄開發
2. 使用 Chrome「載入未封裝項目」測試
3. 需要打包時用 `./build-dev-version.sh`

### 準備發布
1. 完成功能開發
2. 執行 `./build-alpha-release.sh`
3. 測試 release 版本
4. 上傳到 Chrome Web Store

## ⚠️ 重要提醒

1. **不要混淆版本**
   - dev-build/ 資料夾的檔案只給自己用
   - release/ 資料夾的檔案才能發布

2. **Git 管理**
   - .gitignore 已設定忽略 release/ 和 dev-build/
   - 原始碼才需要進入版本控制

3. **隱私保護**
   - 開發版可能包含敏感測試資料
   - 只分享 release 版本給他人

## 📝 版本號規則

- **開發版**: 1.0.0-dev
- **Alpha 版**: 1.0.0-alpha
- **Beta 版**: 1.0.0-beta (未來)
- **正式版**: 1.0.0 (未來)

## 🔧 自訂設定

如需修改版本標識，編輯對應的建構腳本：
- `build-dev-version.sh`: 開發版設定
- `build-alpha-release.sh`: 發布版設定