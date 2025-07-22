// 導入語言偵測功能、歷史管理和 AI 服務
importScripts('lib/lang-detect.js');
importScripts('lib/history-manager.js');
importScripts('lib/ai-service.js');

// 初始化歷史管理器
const historyManager = new HistoryManager();

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  // 建立右鍵選單
  chrome.contextMenus.create({
    id: 'search-youglish',
    title: chrome.i18n.getMessage('searchOnYouglish', '%s'),
    contexts: ['selection']
  });
  
  // 設定預設語言
  chrome.storage.sync.set({ defaultLanguage: 'auto' });
});

// 處理右鍵選單點擊
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'search-youglish') {
    searchYouGlish(info.selectionText, tab.id);
  }
});

// 處理快捷鍵
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'search-youglish') {
    try {
      // 從內容腳本獲取選取的文字
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
      if (response && response.text && response.text.trim()) {
        searchYouGlish(response.text, tab.id);
      } else {
        // 沒有選取文字時，提示用戶
        console.log('沒有選取文字');
      }
    } catch (error) {
      console.error('快捷鍵處理錯誤:', error);
    }
  }
});

// 處理 action 按鈕點擊（開啟 Side Panel）
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 嘗試開啟 Side Panel
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('無法開啟 Side Panel:', error);
  }
});

// 處理來自內容腳本的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchYouGlish') {
    searchYouGlish(request.text, sender.tab.id);
  }
});

// 主要搜尋函數
async function searchYouGlish(text, tabId, source = 'selection', forcedOpenMethod = null) {
  if (!text || text.trim().length === 0) {
    return;
  }
  
  const cleanText = text.trim();
  
  // 獲取用戶設定的預設語言、偏好語言、開啟方式、自動分析和不確定處理方式
  const result = await chrome.storage.sync.get(['defaultLanguage', 'preferredLanguage', 'openMethod', 'autoAnalysis', 'uncertaintyHandling']);
  const defaultLang = result.defaultLanguage || 'auto';
  const preferredLang = result.preferredLanguage || 'none';
  // Allow forced openMethod (for manual searches) to override user setting
  const openMethod = forcedOpenMethod || result.openMethod || 'analysis-only';
  const autoAnalysis = result.autoAnalysis !== 'false'; // Default to true unless explicitly disabled
  const uncertaintyHandling = result.uncertaintyHandling || 'ask';
  
  // 偵測語言 (傳入偏好語言以提高準確度)
  const detectionResult = detectLanguage(cleanText, preferredLang);
  
  // 處理不確定的檢測結果
  if (typeof detectionResult === 'object' && detectionResult.language === 'uncertain') {
    let finalLanguage;
    
    switch (uncertaintyHandling) {
      case 'ask':
        // 開啟語言選擇器讓用戶選擇
        await showLanguageSelector(cleanText, tabId, detectionResult.candidates);
        return; // 等待用戶選擇
        
      case 'english':
        finalLanguage = 'english';
        break;
        
      case 'dutch':
        finalLanguage = 'dutch';
        break;
        
      case 'preferred':
        finalLanguage = preferredLang !== 'none' ? preferredLang : 'english';
        break;
        
      default:
        finalLanguage = 'english';
    }
    
    // 使用確定的語言繼續搜索
    const urls = generateLanguageUrls(cleanText, finalLanguage);
    await proceedWithSearch(cleanText, tabId, finalLanguage, urls, openMethod, 'auto-fallback');
    return;
  }
  
  // 選擇最終使用的語言
  const detectedLang = typeof detectionResult === 'object' ? detectionResult.language : detectionResult;
  const finalLang = defaultLang === 'auto' ? detectedLang : defaultLang;
  
  // 建立不同語言的 URL
  const encodedText = encodeURIComponent(cleanText);
  const urls = generateLanguageUrls(cleanText, finalLang);
  
  const primaryUrl = urls.primaryUrl;
  const secondaryUrl = urls.secondaryUrl;
  const tertiaryUrl = urls.tertiaryUrl;
  const allUrls = urls.allUrls;
  
  // 保存到歷史記錄
  try {
    const detectionMethod = defaultLang === 'auto' ? 
      (preferredLang !== 'none' ? 'auto-with-preference' : 'auto') : 
      'manual';
    
    await historyManager.addRecord(cleanText, finalLang, detectionMethod);
  } catch (error) {
    console.error('保存歷史記錄失敗:', error);
  }

  // 根據設定選擇開啟方式
  if (openMethod === 'analysis-only') {
    try {
      // 儲存查詢資訊到 storage 供 Side Panel 使用 (僅分析，不開啟 YouGlish)
      await chrome.storage.local.set({
        currentQuery: {
          primaryUrl: primaryUrl,
          secondaryUrl: secondaryUrl,
          tertiaryUrl: tertiaryUrl,
          allUrls: allUrls,
          text: cleanText,
          language: finalLang,
          source: source,
          analysisOnly: true,
          autoAnalysis: autoAnalysis
        }
      });
      
      // 開啟 Side Panel 僅顯示分析
      await chrome.sidePanel.open({ tabId });
      
    } catch (error) {
      console.log('Side Panel 開啟失敗:', error);
    }
  } else if (openMethod === 'sidepanel') {
    try {
      // 儲存查詢資訊到 storage 供 Side Panel 使用
      await chrome.storage.local.set({
        currentQuery: {
          primaryUrl: primaryUrl,
          secondaryUrl: secondaryUrl,
          tertiaryUrl: tertiaryUrl,
          allUrls: allUrls,
          text: cleanText,
          language: finalLang,
          source: source,
          analysisOnly: false,
          autoAnalysis: autoAnalysis
        }
      });
      
      // 開啟 Side Panel 顯示搜尋資訊
      await chrome.sidePanel.open({ tabId });
      
    } catch (error) {
      console.log('Side Panel 開啟失敗:', error);
      // Fallback 到新分頁
      chrome.tabs.create({ url: primaryUrl });
    }
  } else {
    // 直接開啟新分頁
    chrome.tabs.create({ url: primaryUrl });
  }
}

// 語言映射
const languageMap = {
  'english': 'english',
  'japanese': 'japanese',
  'korean': 'korean',
  'dutch': 'dutch'
};

// 生成所有語言學習網站的 URL
function generateLanguageUrls(text, language) {
  const encodedText = encodeURIComponent(text);
  const urls = {};
  
  switch (language) {
    case 'english':
      urls.primaryUrl = `https://youglish.com/pronounce/${encodedText}/english`;
      urls.secondaryUrl = `https://www.playphrase.me/#/search?language=en&q=${encodedText}`;
      urls.tertiaryUrl = `https://forvo.com/word/${encodedText}/#en`;
      urls.allUrls = {
        // 發音
        'YouGlish': `https://youglish.com/pronounce/${encodedText}/english`,
        'PlayPhrase.me': `https://www.playphrase.me/#/search?language=en&q=${encodedText}`,
        'Forvo': `https://forvo.com/word/${encodedText}/#en`,
        // 字典
        'Cambridge Dictionary': `https://dictionary.cambridge.org/dictionary/english/${encodedText}`,
        'Thesaurus.com': `https://www.thesaurus.com/browse/${encodedText}`,
        // 語境
        'Reverso Context': `https://context.reverso.net/translation/english-chinese/${encodedText}`,
        'Urban Dictionary': `https://www.urbandictionary.com/define.php?term=${encodedText}`,
        'Ludwig': `https://ludwig.guru/s/${encodedText}`
      };
      break;
      
    case 'japanese':
      urls.primaryUrl = `https://youglish.com/pronounce/${encodedText}/japanese`;
      urls.secondaryUrl = `https://www.playphrase.me/#/search?language=ja&q=${encodedText}`;
      urls.tertiaryUrl = `https://forvo.com/word/${encodedText}/#ja`;
      urls.allUrls = {
        // 發音
        'YouGlish': `https://youglish.com/pronounce/${encodedText}/japanese`,
        'PlayPhrase.me': `https://www.playphrase.me/#/search?language=ja&q=${encodedText}`,
        'Forvo': `https://forvo.com/word/${encodedText}/#ja`,
        // 字典
        'Jisho.org': `https://jisho.org/search/${encodedText}`,
        // 語境
        'Reverso Context': `https://context.reverso.net/translation/japanese-english/${encodedText}`,
        'Tatoeba': `https://tatoeba.org/en/sentences/search?from=jpn&to=eng&query=${encodedText}`,
        'HiNative': `https://hinative.com/questions?utf8=✓&query=${encodedText}&commit=Search`
      };
      break;
      
    case 'dutch':
      urls.primaryUrl = `https://youglish.com/pronounce/${encodedText}/dutch`;
      urls.secondaryUrl = `https://forvo.com/word/${encodedText}/#nl`;
      urls.tertiaryUrl = `https://www.google.com/search?q=${encodedText}+pronunciation+dutch`;
      urls.allUrls = {
        // 發音
        'YouGlish': `https://youglish.com/pronounce/${encodedText}/dutch`,
        'Forvo': `https://forvo.com/word/${encodedText}/#nl`,
        // 字典
        'Van Dale': `https://www.vandale.nl/gratis-woordenboek/nederlands/betekenis/${encodedText}`,
        // 語境
        'Linguee': `https://www.linguee.com/english-dutch/search?source=auto&query=${encodedText}`,
        'Reverso Context': `https://context.reverso.net/translation/dutch-english/${encodedText}`,
        'Google 搜尋': `https://www.google.com/search?q=${encodedText}+pronunciation+dutch`
      };
      break;
      
    case 'korean':
      urls.primaryUrl = `https://youglish.com/pronounce/${encodedText}/korean`;
      urls.secondaryUrl = `https://forvo.com/word/${encodedText}/#ko`;
      urls.tertiaryUrl = `https://www.google.com/search?q=${encodedText}+pronunciation+korean`;
      urls.allUrls = {
        // 發音
        'YouGlish': `https://youglish.com/pronounce/${encodedText}/korean`,
        'Forvo': `https://forvo.com/word/${encodedText}/#ko`,
        // 字典
        'Naver Dictionary': `https://dict.naver.com/search.nhn?dicQuery=${encodedText}&query=${encodedText}`,
        // 翻譯
        'Papago': `https://papago.naver.com/?sk=ko&tk=en&hn=0&st=${encodedText}`,
        // 社群
        'HiNative': `https://hinative.com/questions?utf8=✓&query=${encodedText}&commit=Search`,
        'Google 搜尋': `https://www.google.com/search?q=${encodedText}+pronunciation+korean`
      };
      break;
      
    default:
      urls.primaryUrl = `https://youglish.com/pronounce/${encodedText}/english`;
      urls.secondaryUrl = `https://www.playphrase.me/#/search?language=en&q=${encodedText}`;
      urls.tertiaryUrl = `https://forvo.com/word/${encodedText}/#en`;
      urls.allUrls = {
        'YouGlish': `https://youglish.com/pronounce/${encodedText}/english`,
        'PlayPhrase.me': `https://www.playphrase.me/#/search?language=en&q=${encodedText}`,
        'Forvo': `https://forvo.com/word/${encodedText}/#en`
      };
  }
  
  return urls;
}

// 儲存設定和處理歷史記錄
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(null, (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  // 歷史記錄相關處理
  if (request.action === 'getHistory') {
    historyManager.getHistory().then(history => {
      sendResponse({ success: true, history });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'searchHistory') {
    historyManager.searchHistory(request.query, request.language).then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'deleteHistoryRecord') {
    historyManager.deleteRecord(request.id).then(success => {
      sendResponse({ success });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'clearHistory') {
    historyManager.clearHistory().then(success => {
      sendResponse({ success });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'getHistoryStats') {
    historyManager.getHistoryStats().then(stats => {
      sendResponse({ success: true, stats });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'manualSearch') {
    // 獲取當前活動標籤頁
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        // Force analysis-only for manual searches to avoid intrusive tabs
        searchYouGlish(request.text, tabs[0].id, 'manual', 'analysis-only');
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  }
  
  // 處理語言選擇結果
  if (request.type === 'LANGUAGE_SELECTED') {
    handleLanguageSelection(request.language, request.originalText, request.tabId, request.remember);
    sendResponse({ success: true });
    return true;
  }
  
  // 處理語言選擇取消
  if (request.type === 'LANGUAGE_SELECTION_CANCELLED') {
    // 可以在這裡添加取消的處理邏輯
    console.log('語言選擇已取消');
    sendResponse({ success: true });
    return true;
  }
});

// 顯示語言選擇器
async function showLanguageSelector(text, tabId, candidates) {
  try {
    // 創建語言選擇器彈窗
    const url = chrome.runtime.getURL(`language-selector.html?text=${encodeURIComponent(text)}&tabId=${tabId}&candidates=${candidates.join(',')}`);
    
    // 創建新窗口顯示語言選擇器
    await chrome.windows.create({
      url: url,
      type: 'popup',
      width: 350,
      height: 400,
      focused: true
    });
  } catch (error) {
    console.error('無法顯示語言選擇器:', error);
    // 回退到預設語言
    await searchYouGlish(text, tabId, 'selection');
  }
}

// 處理用戶的語言選擇
async function handleLanguageSelection(selectedLanguage, originalText, tabId, rememberChoice) {
  try {
    // 如果用戶選擇記住選擇，可以保存到本地存儲
    if (rememberChoice) {
      // 這裡可以實現學習用戶偏好的邏輯
      // 例如：保存文本模式和對應的語言選擇
      console.log(`用戶選擇記住：${originalText} -> ${selectedLanguage}`);
    }
    
    // 使用選擇的語言進行搜索
    await executeSearchWithLanguage(originalText, tabId, selectedLanguage);
  } catch (error) {
    console.error('處理語言選擇時發生錯誤:', error);
  }
}

// 使用指定語言執行搜索
async function executeSearchWithLanguage(text, tabId, language) {
  const cleanText = text.trim();
  
  // 獲取用戶設定的開啟方式
  const result = await chrome.storage.sync.get(['openMethod']);
  const openMethod = result.openMethod || 'analysis-only';
  
  // 建立不同語言的 URL
  const urls = generateLanguageUrls(cleanText, language);
  
  // 保存到歷史記錄
  try {
    await historyManager.addRecord(cleanText, language, 'user-selected');
  } catch (error) {
    console.error('保存歷史記錄失敗:', error);
  }

  // 根據設定選擇開啟方式
  if (openMethod === 'analysis-only') {
    try {
      // 儲存查詢資訊到 storage 供 Side Panel 使用 (僅分析，不開啟 YouGlish)
      await chrome.storage.local.set({
        currentQuery: {
          primaryUrl: urls.primaryUrl,
          secondaryUrl: urls.secondaryUrl,
          tertiaryUrl: urls.tertiaryUrl,
          allUrls: urls.allUrls,
          text: cleanText,
          language: language,
          source: 'user-selected',
          analysisOnly: true,
          autoAnalysis: true
        }
      });
      
      // 開啟 Side Panel 僅顯示分析
      await chrome.sidePanel.open({ tabId });
      
    } catch (error) {
      console.log('Side Panel 開啟失敗:', error);
    }
  } else if (openMethod === 'sidepanel') {
    try {
      // 儲存查詢資訊到 storage 供 Side Panel 使用
      await chrome.storage.local.set({
        currentQuery: {
          primaryUrl: urls.primaryUrl,
          secondaryUrl: urls.secondaryUrl,
          tertiaryUrl: urls.tertiaryUrl,
          allUrls: urls.allUrls,
          text: cleanText,
          language: language,
          source: 'user-selected',
          analysisOnly: false,
          autoAnalysis: true
        }
      });
      
      // 開啟 Side Panel 顯示搜尋資訊
      await chrome.sidePanel.open({ tabId });
      
    } catch (error) {
      console.log('Side Panel 開啟失敗:', error);
      // 回退到新標籤頁方式
      chrome.tabs.create({ url: urls.primaryUrl });
    }
  } else {
    // 新標籤頁方式
    chrome.tabs.create({ url: urls.primaryUrl });
  }
}

// 通用的搜索執行函數
async function proceedWithSearch(text, tabId, language, urls, openMethod, source = 'auto') {
  try {
    // 保存到歷史記錄
    await historyManager.addRecord(text, language, source);
  } catch (error) {
    console.error('保存歷史記錄失敗:', error);
  }

  // 根據設定選擇開啟方式
  if (openMethod === 'analysis-only') {
    try {
      // 儲存查詢資訊到 storage 供 Side Panel 使用 (僅分析，不開啟 YouGlish)
      await chrome.storage.local.set({
        currentQuery: {
          primaryUrl: urls.primaryUrl,
          secondaryUrl: urls.secondaryUrl,
          tertiaryUrl: urls.tertiaryUrl,
          allUrls: urls.allUrls,
          text: text,
          language: language,
          source: source,
          analysisOnly: true,
          autoAnalysis: true
        }
      });
      
      // 開啟 Side Panel 僅顯示分析
      await chrome.sidePanel.open({ tabId });
      
    } catch (error) {
      console.log('Side Panel 開啟失敗:', error);
    }
  } else if (openMethod === 'sidepanel') {
    try {
      // 儲存查詢資訊到 storage 供 Side Panel 使用
      await chrome.storage.local.set({
        currentQuery: {
          primaryUrl: urls.primaryUrl,
          secondaryUrl: urls.secondaryUrl,
          tertiaryUrl: urls.tertiaryUrl,
          allUrls: urls.allUrls,
          text: text,
          language: language,
          source: source,
          analysisOnly: false,
          autoAnalysis: true
        }
      });
      
      // 開啟 Side Panel 顯示搜尋資訊
      await chrome.sidePanel.open({ tabId });
      
    } catch (error) {
      console.log('Side Panel 開啟失敗:', error);
      // 回退到新標籤頁方式
      chrome.tabs.create({ url: urls.primaryUrl });
    }
  } else {
    // 新標籤頁方式
    chrome.tabs.create({ url: urls.primaryUrl });
  }
}