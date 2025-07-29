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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'search-youglish') {
    console.log('📝 Right-click search triggered for:', info.selectionText);
    console.log('📝 Tab info:', { id: tab.id, url: tab.url });
    
    // Check if we're on a page that supports article metadata
    const currentUrl = tab.url;
    const isArticlePage = currentUrl && 
      !currentUrl.includes('youtube.com') && 
      !currentUrl.includes('youglish.com') && 
      !currentUrl.startsWith('chrome://') &&
      !currentUrl.startsWith('chrome-extension://');
    
    if (isArticlePage) {
      console.log('📝 Detected article page, trying to get metadata...');
      // Try to get article metadata from the current page
      try {
        const articleData = await chrome.tabs.sendMessage(tab.id, { 
          action: 'getArticleMetadata' 
        });
        console.log('📝 Article data response:', articleData);
        
        if (articleData && articleData.success && articleData.metadata) {
          console.log('📰 Got article metadata from right-click context');
          
          // Create article selection data similar to Save button
          const selectionData = {
            text: info.selectionText,
            metadata: articleData.metadata,
            paragraph: null, // We don't have paragraph context from right-click
            context: null,   // We don't have surrounding context
            timestamp: Date.now(),
            source: 'right-click-selection'
          };
          
          // Process as article selection with website info (for Saved tab)
          console.log('📝 Calling handleArticleTextAnalysis...');
          await handleArticleTextAnalysis(selectionData, tab.id);
          
          // Also do regular YouGlish search (for website opening), but skip history save to avoid duplicates
          console.log('📝 Also opening YouGlish website for right-click with article metadata');
          await searchYouGlish(info.selectionText, tab.id, 'right-click', 'newtab', true);
          console.log('📝 Both article analysis and YouGlish search completed');
          return; // Now we've done both
        }
      } catch (error) {
        console.log('📝 Could not get article metadata:', error.message);
      }
    }
    
    // Fallback to regular YouGlish search for all other cases
    console.log('📝 Using regular YouGlish search (fallback)');
    // Force to open YouGlish website (not just analysis)
    await searchYouGlish(info.selectionText, tab.id, 'right-click', 'newtab');
    console.log('📝 Fallback YouGlish search completed');
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
      // 更好的錯誤處理，避免 "Receiving end does not exist" 錯誤
      if (error.message.includes('Receiving end does not exist')) {
        console.log('內容腳本尚未載入，無法獲取選取文字');
      } else {
        console.error('快捷鍵處理錯誤:', error);
      }
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
// Consolidated message handler for all actions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔔 Background script received message:', request.action, 'from tab:', sender.tab?.id);
  
  // YouTube and YouGlish actions
  if (request.action === 'searchYouGlish') {
    console.log('🔍 Processing YouGlish search for:', request.text);
    
    // Handle async function properly
    searchYouGlish(request.text, sender.tab.id)
      .then(() => {
        sendResponse({ success: true, message: 'YouGlish search initiated' });
      })
      .catch((error) => {
        console.error('🔍 Error processing YouGlish search:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  } 
  
  if (request.action === 'analyzeTextInSidepanel') {
    console.log('📖 Processing YouTube learning text analysis for:', request.text);
    
    // Handle async function properly
    handleYouTubeTextAnalysis(request, sender.tab.id)
      .then(() => {
        sendResponse({ success: true, message: 'Text sent to sidepanel for analysis' });
      })
      .catch((error) => {
        console.error('📖 Error processing YouTube text analysis:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  // Settings actions
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
  
  // History actions
  if (request.action === 'getHistory') {
    historyManager.getHistory().then(history => {
      sendResponse({ success: true, history });
    }).catch(error => {
      console.error('Error getting history:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'searchHistory') {
    console.log('🔍 Searching history:', request.query, request.language);
    historyManager.searchHistory(request.query, request.language).then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      console.error('❌ Error searching history:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'deleteHistoryRecord') {
    console.log('🗑️ Deleting history record:', request.id);
    historyManager.deleteRecord(request.id).then(success => {
      console.log('🗑️ Delete result:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('❌ Error deleting history record:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'clearHistory') {
    console.log('🧹 Clearing all history...');
    historyManager.clearHistory().then(success => {
      console.log('🧹 Clear result:', success);
      sendResponse({ success });
    }).catch(error => {
      console.error('❌ Error clearing history:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'getHistoryStats') {
    console.log('📊 Getting history stats...');
    historyManager.getHistoryStats().then(stats => {
      console.log('📊 Stats retrieved:', stats);
      sendResponse({ success: true, stats });
    }).catch(error => {
      console.error('❌ Error getting history stats:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'manualSearch') {
    // Handle async function properly
    chrome.tabs.query({active: true, currentWindow: true})
      .then((tabs) => {
        if (tabs[0]) {
          // Force analysis-only for manual searches to avoid intrusive tabs
          return searchYouGlish(request.text, tabs[0].id, 'manual', 'analysis-only');
        } else {
          throw new Error('No active tab found');
        }
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('❌ Error processing manual search:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  // Language selection actions
  if (request.type === 'LANGUAGE_SELECTED') {
    handleLanguageSelection(request.language, request.originalText, request.tabId, request.remember);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'LANGUAGE_SELECTION_CANCELLED') {
    console.log('語言選擇已取消');
    sendResponse({ success: true });
    return true;
  }
  
  // Article selection actions
  if (request.action === 'saveArticleSelection') {
    console.log('📰 Background received saveArticleSelection:', request.data);
    
    // Handle async function properly
    handleArticleTextAnalysis(request.data, sender.tab.id)
      .then(() => {
        sendResponse({ success: true, message: 'Article sent to sidepanel for analysis' });
        console.log('📰 Article processing completed successfully');
      })
      .catch((error) => {
        console.error('📰 Error processing article:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  // Unknown action
  console.log('❓ Unknown action:', request.action);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// 主要搜尋函數
async function searchYouGlish(text, tabId, source = 'selection', forcedOpenMethod = null, skipHistorySave = false) {
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
  
  // 保存到歷史記錄 (unless explicitly skipped)
  if (!skipHistorySave) {
    try {
      const detectionMethod = defaultLang === 'auto' ? 
        (preferredLang !== 'none' ? 'auto-with-preference' : 'auto') : 
        'manual';
      
      await historyManager.addRecord(cleanText, finalLang, detectionMethod);
    } catch (error) {
      console.error('保存歷史記錄失敗:', error);
    }
  } else {
    console.log('📝 Skipping history save for searchYouGlish (already saved by article handler)');
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
    // 直接開啟新分頁 (newtab mode)
    chrome.tabs.create({ url: primaryUrl });
    
    // Also store query for analysis if needed
    if (autoAnalysis) {
      try {
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
        
        // Open Side Panel for analysis too
        await chrome.sidePanel.open({ tabId });
      } catch (error) {
        console.log('Side Panel analysis failed:', error);
      }
    }
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
// Duplicate message listener removed - consolidated into main handler above

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

// 從 YouTube 標題中提取頻道名稱的輔助函數
function extractChannelFromTitle(title) {
  if (!title) return null;
  
  try {
    // YouTube 標題格式通常是: "Video Title - Channel Name - YouTube"
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      // 去除最後的 "YouTube" 部分，返回頻道名稱
      const channelName = parts[parts.length - 2].trim();
      if (channelName && channelName !== 'YouTube') {
        return channelName;
      }
    }
    
    // 如果標準格式不匹配，嘗試其他常見格式
    if (title.includes(' | ')) {
      const pipeparts = title.split(' | ');
      if (pipeparts.length >= 2) {
        return pipeparts[pipeparts.length - 1].trim();
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting channel from title:', error);
    return null;
  }
}

// 處理文章文本分析
async function handleArticleTextAnalysis(data, tabId) {
  try {
    console.log('📰 handleArticleTextAnalysis called with:', { 
      text: data.text?.substring(0, 50) + '...', 
      tabId: tabId,
      hasMetadata: !!data.metadata 
    });
    
    const cleanText = data.text.trim();
    if (!cleanText) return;
    
    // 獲取語言設定
    const result = await chrome.storage.sync.get(['defaultLanguage', 'preferredLanguage']);
    const defaultLang = result.defaultLanguage || 'auto';
    const preferredLang = result.preferredLanguage || 'none';
    
    // 偵測語言
    const detectionResult = detectLanguage(cleanText, preferredLang);
    const language = typeof detectionResult === 'string' ? detectionResult : 
                    (detectionResult.language !== 'uncertain' ? detectionResult.language : 'english');
    
    // 生成語言學習 URLs
    const urls = generateLanguageUrls(cleanText, language);
    
    // Create article source info first (outside try block to avoid scope issues)
    const articleSource = {
      url: data.metadata?.url || data.url,
      title: data.metadata?.title || '未知文章',
      author: data.metadata?.author || '未知作者',
      publishDate: data.metadata?.publishDate || '',
      domain: data.metadata?.domain || new URL(data.metadata?.url || 'https://example.com').hostname,
      paragraph: data.paragraph,
      context: data.context,
      timestamp: Date.now(),
      learnedAt: new Date().toISOString()
    };
    
    // 保存到歷史記錄（包含文章來源資訊）
    try {
      console.log('💾 Saving article learning to history:', cleanText, language);
      
      console.log('📄 Article source info:', articleSource);
      
      // Use appropriate detection method based on source
      const detectionMethod = data.source === 'right-click-selection' ? 'right-click-article' : 'article-learning';
      
      const savedRecord = await historyManager.addRecord(
        cleanText, 
        language, 
        detectionMethod, 
        [], 
        articleSource
      );
      console.log('✅ Article learning saved to history');
    } catch (error) {
      console.error('❌ Failed to save article learning to history:', error);
    }
    
    // 儲存到 local storage 供 sidepanel 使用
    await chrome.storage.local.set({
      articleAnalysis: {
        url: urls.primaryUrl, // YouGlish URL for search
        text: cleanText,
        language: language,
        source: data.source === 'right-click-selection' ? 'right-click-article' : 'article-learning',
        title: data.metadata?.title || 'Article Learning',
        originalUrl: data.metadata?.url, // Article URL
        articleUrl: data.metadata?.url, // Explicit article URL field
        allUrls: urls.allUrls,
        timestamp: Date.now(),
        articleMetadata: data.metadata,
        paragraph: data.paragraph,
        context: data.context,
        // Add videoSource for display compatibility in history view
        videoSource: articleSource
      }
    });
    
    console.log('🔗 Article analysis data saved for sidepanel');
    
    // 開啟 sidepanel (如果尚未開啟)
    try {
      await chrome.sidePanel.open({ tabId });
      console.log('📱 Sidepanel opened for article learning');
    } catch (error) {
      console.log('📱 Sidepanel might already be open:', error.message);
    }

    // ✅ Data saved to chrome.storage for sidepanel to pick up
    console.log('💾 Article learning data saved to storage for automatic AI analysis');
    console.log('🔗 Full article analysis data saved:', {
      url: urls.primaryUrl,
      text: cleanText.substring(0, 50) + '...',
      language: language,
      source: 'article-learning',
      hasVideoSource: !!articleSource,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error handling article text analysis:', error);
  }
}

// 處理 YouTube 學習文本分析
async function handleYouTubeTextAnalysis(request, tabId) {
  try {
    console.log('🎬 Processing YouTube learning text:', request.text);
    
    const cleanText = request.text.trim();
    if (!cleanText) return;
    
    // 獲取語言設定
    const result = await chrome.storage.sync.get(['defaultLanguage', 'preferredLanguage']);
    const defaultLang = result.defaultLanguage || 'auto';
    const preferredLang = result.preferredLanguage || 'none';
    
    // 偵測語言
    const detectionResult = detectLanguage(cleanText, preferredLang);
    const language = typeof detectionResult === 'string' ? detectionResult : 
                    (detectionResult.language !== 'uncertain' ? detectionResult.language : 'english');
    
    // 生成語言學習 URLs
    const urls = generateLanguageUrls(cleanText, language);
    
    // 保存到歷史記錄（包含影片來源資訊）
    try {
      console.log('💾 Saving YouTube learning to history:', cleanText, language);
      
      // 創建影片來源資訊
      console.log('🔍 Raw request data from YouTube:', {
        url: request.url,
        originalUrl: request.originalUrl, 
        title: request.title,
        timestamp: request.timestamp,
        timestampType: typeof request.timestamp
      });
      
      console.log('🔍 CRITICAL DEBUG - Background received timestamp:', {
        timestamp: request.timestamp,
        timestampType: typeof request.timestamp,
        timestampNull: request.timestamp === null,
        timestampUndefined: request.timestamp === undefined,
        timestampNaN: isNaN(request.timestamp),
        rawRequest: JSON.stringify(request, null, 2)
      });
      
      const videoSource = {
        url: request.url || null,
        originalUrl: request.originalUrl || request.url || null,
        title: request.title || '未知影片',
        channel: extractChannelFromTitle(request.title) || '未知頻道',
        videoTimestamp: request.timestamp || null, // Video playback time in seconds
        timestamp: Date.now(), // When this was learned
        learnedAt: new Date().toISOString()
      };
      
      console.log('🎯 Final videoSource object:', {
        hasTimestamp: videoSource.videoTimestamp !== null,
        videoTimestamp: videoSource.videoTimestamp,
        url: videoSource.url,
        title: videoSource.title
      });
      
      console.log('📹 Video source info:', videoSource);
      console.log('📹 Video source details:', JSON.stringify(videoSource, null, 2));
      
      const savedRecord = await historyManager.addRecord(cleanText, language, 'youtube-learning', [], videoSource);
      console.log('✅ YouTube learning saved to history with video source');
      console.log('💾 Saved record details:', JSON.stringify(savedRecord, null, 2));
    } catch (error) {
      console.error('❌ Failed to save YouTube learning to history:', error);
    }
    
    // 儲存到 local storage 供 sidepanel 使用
    await chrome.storage.local.set({
      youtubeAnalysis: {
        url: urls.primaryUrl, // YouGlish URL for search
        text: cleanText,
        language: language,
        source: request.source || 'youtube-learning',
        title: request.title || 'YouTube Learning',
        originalUrl: request.url, // YouTube URL with timestamp
        youtubeUrl: request.url, // Explicit YouTube URL field  
        allUrls: urls.allUrls,
        timestamp: Date.now(),
        videoTimestamp: request.timestamp || null // Include video playback timestamp
      }
    });
    
    console.log('🔗 URL mapping debug:', {
      youglishUrl: urls.primaryUrl,
      youtubeUrl: request.url,
      originalUrl: request.originalUrl,
      timestamp: request.timestamp
    });
    
    // 開啟 sidepanel (如果尚未開啟)
    try {
      await chrome.sidePanel.open({ tabId });
      console.log('📱 Sidepanel opened for YouTube learning');
    } catch (error) {
      console.log('📱 Sidepanel might already be open:', error.message);
    }

    // ✅ Data already saved to chrome.storage for sidepanel to pick up
    // Using storage-based approach instead of direct messaging to avoid connection errors
    console.log('💾 YouTube learning data saved to storage for sidepanel to automatically load');
    
  } catch (error) {
    console.error('❌ Error handling YouTube text analysis:', error);
  }
}
