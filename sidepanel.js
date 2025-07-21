// 語言名稱映射
const languageNames = {
  'english': '英文',
  'japanese': '日文',
  'korean': '韓文',
  'dutch': '荷蘭文'
};

// 監聽來自背景腳本的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSidePanel') {
    loadYouGlish(request.url, request.text, request.language);
  }
});

// 儲存當前的查詢數據
let currentQueryData = {};
let currentAIAnalysis = null;
let lastProcessedQuery = null;

// Initialize storage manager
let storageManager = null;

// Initialize services when scripts load
window.addEventListener('load', () => {
  if (typeof StorageManager !== 'undefined') {
    storageManager = new StorageManager();
  }
});

// 顯示搜尋結果
function showSearchResult(queryData) {
  console.log('showSearchResult called with:', queryData);
  
  const welcome = document.getElementById('welcome');
  const searchInfo = document.getElementById('searchInfo');
  const searchResult = document.getElementById('searchResult');
  const searchTerm = document.getElementById('searchTerm');
  const searchLanguage = document.getElementById('searchLanguage');
  const languageBadge = document.getElementById('languageBadge');
  const openInNewTabBtn = document.getElementById('openInNewTabBtn');
  
  console.log('Elements found:', {
    welcome: !!welcome,
    searchInfo: !!searchInfo,
    searchResult: !!searchResult,
    searchTerm: !!searchTerm,
    searchLanguage: !!searchLanguage,
    languageBadge: !!languageBadge,
    openInNewTabBtn: !!openInNewTabBtn
  });
  
  // 檢查是否為新的搜尋查詢
  const queryKey = `${queryData.text}_${queryData.language}`;
  const isNewQuery = !lastProcessedQuery || lastProcessedQuery !== queryKey;
  
  // 儲存當前查詢數據
  currentQueryData = queryData;
  
  // 如果是新查詢，清空之前的分析結果並更新追蹤
  if (isNewQuery) {
    currentAIAnalysis = null;
    lastProcessedQuery = queryKey;
  }
  
  // 隱藏歡迎畫面
  welcome.style.display = 'none';
  
  // 更新搜尋資訊
  searchTerm.textContent = queryData.text;
  searchLanguage.textContent = languageNames[queryData.language] || queryData.language;
  languageBadge.textContent = queryData.language.toUpperCase();
  searchInfo.style.display = 'block';
  
  // 顯示新分頁按鈕
  openInNewTabBtn.style.display = 'inline-block';
  
  // 更新搜尋結果面板
  document.getElementById('resultText').textContent = queryData.text;
  document.getElementById('resultLanguage').textContent = languageNames[queryData.language] || queryData.language;
  
  // 顯示搜尋結果
  searchResult.style.display = 'block';
  
  // 初始化視圖切換
  initializeViewControls();
  
  // 確保分析視圖是預設顯示的，並且AI分析區域可見
  const analysisView = document.getElementById('analysisView');
  const videoView = document.getElementById('videoView');
  const historyView = document.getElementById('historyView');
  const savedReportsView = document.getElementById('savedReportsView');
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  
  if (analysisView) {
    analysisView.style.display = 'block';
    // 確保AI分析區域也是可見的
    const aiAnalysisSection = document.getElementById('aiAnalysisSection');
    if (aiAnalysisSection) {
      aiAnalysisSection.style.display = 'block';
    }
  }
  if (videoView) videoView.style.display = 'none';
  if (historyView) historyView.style.display = 'none';
  if (savedReportsView) savedReportsView.style.display = 'none';
  
  // 設定分析按鈕為活動狀態
  document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
  if (showAnalysisBtn) showAnalysisBtn.classList.add('active');
  
  console.log('Analysis view set as default active view');
  
  // 載入多個發音網站選項
  loadPronunciationSites(queryData);
  
  // 只對新查詢觸發自動分析和發音 (如果啟用且服務可用)
  if (isNewQuery && queryData.autoAnalysis) {
    setTimeout(() => {
      try {
        console.log('Auto-analysis requested for:', queryData.text);
        if (typeof generateAIAnalysis === 'function' && typeof aiService !== 'undefined' && aiService) {
          // Auto-generate AI analysis
          generateAIAnalysis().catch(err => console.log('Auto-analysis failed quietly:', err));
          
          // Auto-generate audio after a short delay (so it doesn't interfere with AI analysis)
          setTimeout(() => {
            if (aiService && aiService.isAudioAvailable()) {
              console.log('🔊 Auto-generating audio for new search...');
              generateAudioPronunciation().catch(err => console.log('Auto-audio failed quietly:', err));
            } else {
              console.log('Auto-audio skipped: audio not available');
            }
          }, 3000); // 3 second delay to let AI analysis finish first
          
        } else {
          console.log('Auto-generation skipped: AI service not available');
        }
      } catch (error) {
        console.log('Auto-analysis error (non-blocking):', error);
      }
    }, 2000); // Longer delay to ensure everything is loaded
  }
  
  // AI analysis section should be visible by default in analysis view
}

// 初始化視圖控制
function initializeViewControls() {
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  const showVideoBtn = document.getElementById('showVideoBtn');
  const showHistoryBtn = document.getElementById('showHistoryBtn');
  const openNewTabBtn = document.getElementById('openNewTabBtn');
  const analysisView = document.getElementById('analysisView');
  const videoView = document.getElementById('videoView');
  const historyView = document.getElementById('historyView');
  
  // 分析視圖按鈕
  if (showAnalysisBtn) {
    showAnalysisBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showAnalysisBtn.classList.add('active');
      
      // Hide all views
      if (analysisView) analysisView.style.display = 'block';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      const savedReportsView = document.getElementById('savedReportsView');
      if (savedReportsView) savedReportsView.style.display = 'none';
      
      console.log('Switched to analysis view');
    };
  }
  
  // 影片視圖按鈕
  if (showVideoBtn) {
    showVideoBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showVideoBtn.classList.add('active');
      
      // Hide all views
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'block';
      if (historyView) historyView.style.display = 'none';
      const savedReportsView = document.getElementById('savedReportsView');
      if (savedReportsView) savedReportsView.style.display = 'none';
      
      console.log('Switched to video view');
    };
  }
  
  // 歷史記錄視圖按鈕
  if (showHistoryBtn) {
    showHistoryBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showHistoryBtn.classList.add('active');
      
      // Hide all views
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'block';
      const savedReportsView = document.getElementById('savedReportsView');
      if (savedReportsView) savedReportsView.style.display = 'none';
      
      loadHistoryView();
      console.log('Switched to history view');
    };
  }
  
  // 新分頁按鈕
  if (openNewTabBtn) {
    openNewTabBtn.onclick = () => {
      if (currentQueryData.primaryUrl) {
        chrome.tabs.create({ url: currentQueryData.primaryUrl });
      }
    };
  }
  
  // searchAgainBtn removed - was causing UI conflicts
}

// 載入發音網站選項 - 從 amazing copy 複製的完整版本
function loadPronunciationSites(queryData) {
  const pronunciationOptions = document.getElementById('pronunciationOptions');
  const siteDescriptions = document.getElementById('siteDescriptions');
  
  // 清空現有內容
  if (pronunciationOptions) pronunciationOptions.innerHTML = '';
  if (siteDescriptions) siteDescriptions.innerHTML = '';
  
  // 根據語言定義網站選項
  const siteConfigs = getSiteConfigs(queryData.language);
  
  // 按類別分組網站
  const categories = {
    'pronunciation': { name: '發音學習', sites: [] },
    'dictionary': { name: '字典查詢', sites: [] },
    'context': { name: '語境例句', sites: [] },
    'translation': { name: '翻譯服務', sites: [] },
    'examples': { name: '例句資料庫', sites: [] },
    'community': { name: '社群問答', sites: [] },
    'academic': { name: '學術寫作', sites: [] },
    'slang': { name: '俚語俗語', sites: [] },
    'search': { name: '搜尋引擎', sites: [] }
  };
  
  // 分類網站
  siteConfigs.forEach((config, index) => {
    const category = config.category || 'pronunciation';
    const url = queryData.allUrls && queryData.allUrls[config.name] ? 
                queryData.allUrls[config.name] : 
                generateUrlForSite(config.name, queryData.text, queryData.language);
    
    categories[category].sites.push({
      ...config,
      url: url,
      isPrimary: index === 0,
      isSecondary: index === 1,
      isTertiary: index === 2
    });
  });
  
  // 生成分類顯示
  Object.keys(categories).forEach(categoryKey => {
    const category = categories[categoryKey];
    if (category.sites.length === 0) return;
    
    // 創建分類標題
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';
    categoryHeader.innerHTML = `
      <h4>${category.name}</h4>
      <span class="category-count">${category.sites.length} 個網站</span>
    `;
    if (pronunciationOptions) pronunciationOptions.appendChild(categoryHeader);
    
    // 生成該分類的網站選項
    category.sites.forEach(site => {
      const option = document.createElement('div');
      option.className = `pronunciation-option ${site.isPrimary ? 'primary' : ''}`;
      
      let badgeText = '推薦';
      let badgeClass = 'recommended';
      
      if (site.isPrimary) {
        badgeText = '主要';
        badgeClass = 'primary';
      } else if (site.isSecondary) {
        badgeText = '備選';
        badgeClass = 'secondary';
      } else if (site.isTertiary) {
        badgeText = '其他';
        badgeClass = 'tertiary';
      }
      
      option.innerHTML = `
        <div class="option-info">
          <span class="option-icon">${site.icon}</span>
          <div class="option-details">
            <h5>${site.name}</h5>
            <p>${site.description}</p>
          </div>
        </div>
        <div>
          <span class="option-badge ${badgeClass}">${badgeText}</span>
          <button class="option-button" data-url="${site.url}">開啟</button>
        </div>
      `;
      
      if (pronunciationOptions) {
        pronunciationOptions.appendChild(option);
        
        // Add event listener for the option button
        const optionButton = option.querySelector('.option-button');
        if (optionButton) {
          optionButton.addEventListener('click', () => {
            const url = optionButton.dataset.url;
            if (url) {
              chrome.tabs.create({ url: url });
            }
          });
        }
      }
    });
  });
  
  // 生成網站描述
  if (siteDescriptions) {
    siteConfigs.forEach(config => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${config.name}</strong>: ${config.longDescription || config.description}`;
      siteDescriptions.appendChild(li);
    });
  }
}

// 載入網站
function loadSite(url) {
  if (!url) return;
  
  const iframe = document.getElementById('youglishFrame');
  const loading = document.getElementById('loading');
  
  if (iframe && loading) {
    loading.style.display = 'block';
    iframe.src = url;
    
    iframe.onload = () => {
      loading.style.display = 'none';
    };
    
    iframe.onerror = () => {
      loading.style.display = 'none';
      console.error('Failed to load URL:', url);
    };
  }
}

// 根據語言獲取網站配置 - 從 amazing copy 複製的完整版本
function getSiteConfigs(language) {
  const configs = {
    english: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 影片發音範例',
        longDescription: '基於 YouTube 影片的發音範例，涵蓋各種口音和情境',
        category: 'pronunciation'
      },
      {
        name: 'PlayPhrase.me',
        icon: '🎬',
        description: '電影片段中的真實發音',
        longDescription: '從電影和電視劇中提取真實的發音片段，適合學習自然語調',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '多國母語者發音字典',
        longDescription: '由母語者錄製的標準發音，支援多種口音和方言',
        category: 'pronunciation'
      },
      {
        name: 'Cambridge Dictionary',
        icon: '📖',
        description: '權威英語字典',
        longDescription: '劍橋大學出版的權威英語字典，包含詳細定義、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Thesaurus.com',
        icon: '🔤',
        description: '英語同義詞字典',
        longDescription: '豐富的同義詞、反義詞和相關詞彙，幫助擴展詞彙量',
        category: 'dictionary'
      },
      {
        name: 'Reverso Context',
        icon: '🌐',
        description: '真實語境例句',
        longDescription: '來自網絡和文檔的真實使用例句，了解詞彙的實際用法',
        category: 'context'
      },
      {
        name: 'Urban Dictionary',
        icon: '🏙️',
        description: '英語俚語字典',
        longDescription: '現代英語俚語、網絡用語和非正式表達的字典',
        category: 'slang'
      },
      {
        name: 'Ludwig',
        icon: '🎓',
        description: '學術寫作範例',
        longDescription: '學術和專業寫作的範例，適合提高正式英語寫作水平',
        category: 'academic'
      }
    ],
    japanese: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 日語發音範例',
        longDescription: '基於 YouTube 影片的日語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'PlayPhrase.me',
        icon: '🎌',
        description: '日語影片片段發音',
        longDescription: '從日語電影和動畫中提取真實的發音片段',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '日語母語者發音',
        longDescription: '由日語母語者錄製的標準發音',
        category: 'pronunciation'
      },
      {
        name: 'Jisho.org',
        icon: '📚',
        description: '最佳日語字典',
        longDescription: '最全面的線上日語字典，包含漢字、讀音、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Reverso Context',
        icon: '🌐',
        description: '日語語境例句',
        longDescription: '真實的日語使用例句，幫助理解詞彙和語法的實際用法',
        category: 'context'
      },
      {
        name: 'Tatoeba',
        icon: '💬',
        description: '日語例句資料庫',
        longDescription: '大量的日語例句和翻譯，適合學習日語表達方式',
        category: 'examples'
      },
      {
        name: 'HiNative',
        icon: '🗣️',
        description: '日語母語者問答',
        longDescription: '向日語母語者提問，獲得專業的語言使用建議',
        category: 'community'
      }
    ],
    dutch: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 荷蘭語範例',
        longDescription: '基於 YouTube 影片的荷蘭語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '荷蘭語母語者發音',
        longDescription: '由荷蘭語母語者錄製的標準發音，最適合荷蘭語學習',
        category: 'pronunciation'
      },
      {
        name: 'Van Dale',
        icon: '📖',
        description: '權威荷蘭語字典',
        longDescription: '荷蘭最權威的字典，包含詳細定義、語法和用法',
        category: 'dictionary'
      },
      {
        name: 'Linguee',
        icon: '🔍',
        description: '荷蘭語翻譯與例句',
        longDescription: '基於真實文檔的翻譯和例句，了解荷蘭語的實際用法',
        category: 'context'
      },
      {
        name: 'Reverso Context',
        icon: '🌐',
        description: '荷蘭語語境例句',
        longDescription: '真實的荷蘭語使用例句，幫助理解詞彙的實際用法',
        category: 'context'
      },
      {
        name: 'Google 搜尋',
        icon: '🔍',
        description: '荷蘭語發音搜尋',
        longDescription: '使用 Google 搜尋荷蘭語發音相關資源',
        category: 'search'
      }
    ],
    korean: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 韓語發音範例',
        longDescription: '基於 YouTube 影片的韓語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '韓語母語者發音',
        longDescription: '由韓語母語者錄製的標準發音',
        category: 'pronunciation'
      },
      {
        name: 'Naver Dictionary',
        icon: '📚',
        description: '韓語權威字典',
        longDescription: '韓國最權威的線上字典，包含詳細定義、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Papago',
        icon: '🔄',
        description: 'Naver 翻譯服務',
        longDescription: '韓國 Naver 開發的高品質翻譯服務，特別適合韓語',
        category: 'translation'
      },
      {
        name: 'HiNative',
        icon: '🗣️',
        description: '韓語母語者問答',
        longDescription: '向韓語母語者提問，獲得專業的語言使用建議',
        category: 'community'
      },
      {
        name: 'Google 搜尋',
        icon: '🔍',
        description: '韓語發音搜尋',
        longDescription: '使用 Google 搜尋韓語發音相關資源',
        category: 'search'
      }
    ]
  };
  
  return configs[language] || configs.english;
}

// 為網站生成 URL
function generateUrlForSite(siteName, text, language) {
  const encodedText = encodeURIComponent(text);
  
  const urlMaps = {
    'YouGlish': `https://youglish.com/pronounce/${encodedText}/${language}`,
    'PlayPhrase.me': `https://www.playphrase.me/#/search?q=${encodedText}`,
    'Forvo': `https://forvo.com/word/${encodedText}/`,
    'Cambridge Dictionary': `https://dictionary.cambridge.org/dictionary/english/${encodedText}`,
    'Thesaurus.com': `https://www.thesaurus.com/browse/${encodedText}`,
    'Reverso Context': `https://context.reverso.net/translation/english-chinese/${encodedText}`,
    'Urban Dictionary': `https://www.urbandictionary.com/define.php?term=${encodedText}`,
    'Ludwig': `https://ludwig.guru/s/${encodedText}`,
    'Jisho.org': `https://jisho.org/search/${encodedText}`,
    'Tatoeba': `https://tatoeba.org/en/sentences/search?query=${encodedText}`,
    'HiNative': `https://hinative.com/questions?search=${encodedText}`,
    'Van Dale': `https://www.vandale.nl/gratis-woordenboek/nederlands/betekenis/${encodedText}`,
    'Linguee': `https://www.linguee.com/english-dutch/search?source=dutch&query=${encodedText}`,
    'Naver Dictionary': `https://en.dict.naver.com/#/search?query=${encodedText}`,
    'Papago': `https://papago.naver.com/?sk=en&tk=ko&st=${encodedText}`,
    'Google 搜尋': `https://www.google.com/search?q=${encodedText}+pronunciation`
  };
  
  return urlMaps[siteName] || `https://youglish.com/pronounce/${encodedText}/${language}`;
}

// 載入 YouGlish
function loadYouGlish(url, text, language) {
  const queryData = {
    text: text,
    language: language,
    primaryUrl: url,
    secondaryUrl: '',
    tertiaryUrl: '',
    allUrls: { 'YouGlish': url }
  };
  
  showSearchResult(queryData);
  loadSite(url);
  
  // 保存查詢到本地儲存 (both current and historical)
  const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const storageData = {
    text: text,
    language: language,
    url: url,
    primaryUrl: url,
    timestamp: Date.now()
  };
  
  // Save current query
  chrome.storage.local.set({
    currentQuery: storageData,
    [queryId]: storageData // Also save as historical entry
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save query:', chrome.runtime.lastError);
    } else {
      console.log('Query saved successfully:', storageData);
    }
  });
  
  // Also maintain a persistent history list
  chrome.storage.local.get(['searchHistory'], (result) => {
    let history = result.searchHistory || [];
    
    // Check if this query already exists (avoid duplicates)
    const exists = history.some(item => 
      item.text === text && item.language === language
    );
    
    if (!exists) {
      // Add new query to the beginning
      history.unshift(storageData);
      
      // Keep only the last 50 entries
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      // Save updated history
      chrome.storage.local.set({ searchHistory: history }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save history:', chrome.runtime.lastError);
        } else {
          console.log('History updated, total items:', history.length);
        }
      });
    }
  });
}

// 載入歷史記錄視圖
async function loadHistoryView() {
  const historyContainer = document.getElementById('historyList');
  const historyStats = document.getElementById('historyStats');
  const historyEmpty = document.getElementById('historyEmpty');
  
  if (!historyContainer) {
    console.error('History container not found');
    return;
  }
  
  console.log('Loading history view...');
  
  try {
    // Use chrome.runtime.sendMessage to get history from background script's HistoryManager
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getHistory' }, resolve);
    });
    
    if (response && response.success) {
      const history = response.history || [];
      console.log('Loaded history from HistoryManager:', history.length, 'items');
      
      if (history.length === 0) {
        // Show empty state
        if (historyContainer) historyContainer.innerHTML = '';
        if (historyEmpty) historyEmpty.style.display = 'block';
        if (historyStats) historyStats.innerHTML = '<p>📊 沒有搜尋記錄</p>';
        return;
      }
      
      // Hide empty state
      if (historyEmpty) historyEmpty.style.display = 'none';
      
      // Update stats
      if (historyStats) {
        const totalQueries = history.reduce((sum, item) => sum + (item.queryCount || 1), 0);
        const languageStats = {};
        history.forEach(item => {
          languageStats[item.language] = (languageStats[item.language] || 0) + 1;
        });
        
        const statsText = `📊 總共 ${history.length} 個搜尋詞，${totalQueries} 次查詢 | 語言分布: ${Object.entries(languageStats).map(([lang, count]) => `${languageNames[lang] || lang}: ${count}`).join(', ')}`;
        historyStats.innerHTML = `<p>${statsText}</p>`;
      }
      
      // Display history items using the new format
      displayHistoryItems(history);
      
    } else {
      console.error('Failed to load history:', response?.error);
      // Fallback to old method
      loadHistoryViewFallback();
    }
  } catch (error) {
    console.error('Error loading history:', error);
    // Fallback to old method
    loadHistoryViewFallback();
  }
}

// Fallback method using old storage approach
function loadHistoryViewFallback() {
  console.log('Using fallback history loading method...');
  
  chrome.storage.local.get(['searchHistory', 'currentQuery'], (data) => {
    console.log('Loading history fallback, storage data:', data);
    
    let queries = [];
    
    // First try to get from the persistent history list
    if (data.searchHistory && Array.isArray(data.searchHistory)) {
      queries = data.searchHistory.filter(item => item && item.text);
      console.log('Loaded from searchHistory:', queries.length, 'items');
    }
    
    // If no persistent history, fall back to old method
    if (queries.length === 0) {
      console.log('No persistent history found, using oldest fallback method');
      
      // Check for current query
      if (data.currentQuery && data.currentQuery.text) {
        queries.push({
          text: data.currentQuery.text,
          language: data.currentQuery.language,
          url: data.currentQuery.url || data.currentQuery.primaryUrl,
          timestamp: data.currentQuery.timestamp || Date.now()
        });
      }
      
      // Get all storage data to find old queries
      chrome.storage.local.get(null, (allData) => {
        Object.keys(allData).forEach(key => {
          if (key.startsWith('query_')) {
            const query = allData[key];
            if (query && query.text) {
              queries.push({
                text: query.text,
                language: query.language,
                url: query.url || query.primaryUrl,
                timestamp: query.timestamp || Date.now()
              });
            }
          }
        });
        
        // Remove duplicates and sort
        const uniqueQueries = queries.filter((query, index, self) => 
          index === self.findIndex(q => q.text === query.text && q.language === query.language)
        );
        
        uniqueQueries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        displayHistoryItems(uniqueQueries);
      });
      return; // Exit early for fallback method
    }
    
    // 按時間排序 (already should be sorted, but just in case)
    queries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    console.log('Found queries:', queries.length);
    displayHistoryItems(queries);
  });
}

// Extract display logic into separate function
function displayHistoryItems(queries) {
  const historyContainer = document.getElementById('historyList');
  if (!historyContainer) return;
  
  // 清空容器
  historyContainer.innerHTML = '';
  
  if (queries.length === 0) {
    historyContainer.innerHTML = '<div class="history-empty"><p>📝 沒有搜尋歷史</p><p style="color: #666; font-size: 12px;">開始搜尋單字或短語來建立學習記錄！</p></div>';
    return;
  }
  
  // 顯示查詢歷史
  queries.slice(0, 50).forEach(query => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const date = new Date(query.timestamp || Date.now());
    const dateStr = new Date(query.timestamp).toLocaleDateString('zh-TW') + ' ' + new Date(query.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    
    // Handle both old format (query.url) and HistoryManager format
    const queryCount = query.queryCount || 1;
    const detectionMethod = query.detectionMethod || 'auto';
    const websitesUsed = query.websitesUsed || [];
    
    // Create more detailed history item with HistoryManager data
    item.innerHTML = `
      <div class="history-item-header">
        <div class="history-text">${query.text || 'Unknown'}</div>
        <div class="history-actions">
          <button class="history-action-btn replay" data-text="${query.text}" data-language="${query.language}" data-id="${query.id || ''}">重播</button>
          ${query.id ? `<button class="history-action-btn delete" data-id="${query.id}">刪除</button>` : ''}
        </div>
      </div>
      <div class="history-meta">
        <span class="history-language">${languageNames[query.language] || query.language || 'Unknown'}</span>
        <span class="history-date">${dateStr}</span>
        ${queryCount > 1 ? `<span class="history-count">${queryCount}次查詢</span>` : ''}
        <span class="history-method">${detectionMethod === 'auto' ? '自動' : detectionMethod === 'manual' ? '手動' : detectionMethod}</span>
        ${websitesUsed.length > 0 ? `<span class="history-websites">${websitesUsed.join(', ')}</span>` : ''}
      </div>
    `;
    
    historyContainer.appendChild(item);
    
    // Add event listeners
    const replayButton = item.querySelector('.history-action-btn.replay');
    const deleteButton = item.querySelector('.history-action-btn.delete');
    
    if (replayButton) {
      replayButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = replayButton.dataset.text;
        const language = replayButton.dataset.language;
        console.log('Replaying query:', { text, language });
        if (text && language) {
          replayQuery(text, language);
        }
      });
    }
    
    if (deleteButton) {
      deleteButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = deleteButton.dataset.id;
        if (id && confirm('確定要刪除這個搜尋記錄嗎？')) {
          try {
            const response = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ action: 'deleteHistoryRecord', id }, resolve);
            });
            if (response && response.success) {
              console.log('History record deleted:', id);
              loadHistoryView(); // Reload the view
            } else {
              console.error('Failed to delete history record:', response?.error);
              alert('刪除失敗');
            }
          } catch (error) {
            console.error('Error deleting history record:', error);
            alert('刪除失敗');
          }
        }
      });
    }
    
    // Make the whole item clickable (except buttons)
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('history-action-btn')) {
        const text = query.text;
        const language = query.language;
        if (text && language) {
          replayQuery(text, language);
        }
      }
    });
  });
  
  console.log(`Displayed ${queries.length} history items`);
}

// 重播查詢
function replayQuery(text, language, url) {
  console.log('Replaying query:', { text, language, url });
  
  // If no URL, create a default YouGlish URL
  if (!url) {
    url = `https://youglish.com/pronounce/${encodeURIComponent(text)}/${language}`;
  }
  
  // Create query data object
  const queryData = {
    text: text,
    language: language,
    primaryUrl: url,
    secondaryUrl: '',
    tertiaryUrl: '',
    allUrls: { 'YouGlish': url },
    autoAnalysis: true // Enable auto analysis for replayed queries
  };
  
  // Show the search result
  showSearchResult(queryData);
  
  // Switch to analysis view by default (instead of video view)
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  if (showAnalysisBtn) {
    showAnalysisBtn.click();
  }
}

// 開啟設定頁面
function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
}

// 在新分頁開啟當前頁面
function openCurrentInNewTab() {
  if (currentQueryData && currentQueryData.primaryUrl) {
    chrome.tabs.create({ url: currentQueryData.primaryUrl });
  }
}

// 初始化
// This section was moved to the main DOMContentLoaded section below

// AI Analysis Functions (missing functions)
async function generateAIAnalysis(forceRefresh = false) {
  if (!currentQueryData.text || !currentQueryData.language) {
    showAIError('沒有可分析的文本');
    return;
  }

  // 如果已有分析結果且不是強制刷新，直接顯示
  if (currentAIAnalysis && !forceRefresh) {
    showAIResult(currentAIAnalysis);
    return;
  }

  try {
    // 顯示載入狀態
    showAILoading();
    
    // 等待 AI 服務載入完成
    await waitForAIService();
    
    // 初始化 AI 服務
    const isAvailable = await aiService.initialize();
    if (!isAvailable) {
      throw new Error('AI 服務未配置或未啟用 - 請檢查設定頁面是否已正確配置 API 金鑰');
    }

    // 生成分析
    const analysis = await aiService.generateAnalysis(currentQueryData.text, currentQueryData.language);
    currentAIAnalysis = analysis;
    
    // 顯示結果
    showAIResult(analysis);
    
    // 自動保存 AI 分析報告到存储管理器 (only if auto-save is enabled)
    if (autoSaveEnabled && storageManager && typeof storageManager.saveAIReport === 'function') {
      try {
        await storageManager.saveAIReport(
          currentQueryData.text,
          currentQueryData.language,
          analysis,
          null // No audio data yet
        );
        console.log('AI analysis report saved automatically');
      } catch (error) {
        console.log('Failed to save AI report:', error);
      }
    } else if (!autoSaveEnabled) {
      console.log('Auto-save is disabled, not saving AI report');
    }
    
  } catch (error) {
    console.error('AI 分析失敗:', error);
    showAIError(`分析失敗: ${error.message}`);
  }
}

// 等待 AI 服務載入
function waitForAIService() {
  return new Promise((resolve) => {
    const checkService = () => {
      if (typeof aiService !== 'undefined') {
        resolve();
      } else {
        setTimeout(checkService, 100);
      }
    };
    checkService();
  });
}

// 顯示 AI 載入狀態
function showAILoading() {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'block';
  if (result) result.style.display = 'none';
}

// 顯示 AI 分析結果
function showAIResult(analysis) {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (result) {
    result.style.display = 'block';
    
    // Handle different types of analysis data
    let displayContent = '';
    let rawContent = '';
    
    if (typeof analysis === 'string') {
      rawContent = analysis;
    } else if (analysis && typeof analysis === 'object') {
      // If it's an object, try to extract meaningful content
      if (analysis.content) {
        rawContent = analysis.content;
      } else if (analysis.text) {
        rawContent = analysis.text;
      } else if (analysis.analysis) {
        rawContent = analysis.analysis;
      } else if (analysis.result) {
        rawContent = analysis.result;
      } else {
        // If no recognizable content field, format as JSON
        displayContent = '<pre>' + JSON.stringify(analysis, null, 2) + '</pre>';
      }
    } else {
      displayContent = 'No analysis content available';
    }
    
    // Format the content for better readability
    if (rawContent) {
      displayContent = formatAIAnalysis(rawContent);
    }
    
    result.innerHTML = displayContent;
    console.log('AI analysis displayed:', typeof analysis, analysis);
    
    // Also show the audio section when analysis is displayed
    const audioSection = document.getElementById('aiAudioSection');
    console.log('Checking audio section visibility:', {
      audioSection: !!audioSection,
      aiService: !!aiService,
      isInitialized: aiService?.isInitialized,
      isAvailable: aiService?.isAvailable(),
      isAudioAvailable: aiService?.isAudioAvailable(),
      provider: aiService?.settings?.provider,
      audioPronunciation: aiService?.settings?.features?.audioPronunciation
    });
    
    if (audioSection) {
      if (aiService && aiService.isAudioAvailable()) {
        console.log('Showing audio section - audio is available');
        audioSection.style.display = 'block';
      } else {
        console.log('Audio section hidden - audio not available or service not ready');
        // Show audio section anyway but with a disabled state or message
        audioSection.style.display = 'block';
        const audioContent = document.getElementById('audioContent');
        if (audioContent) {
          if (!aiService) {
            audioContent.innerHTML = '<div class="audio-error">AI 服務載入中...</div>';
          } else if (!aiService.isInitialized) {
            audioContent.innerHTML = '<div class="audio-error">AI 服務初始化中...</div>';
          } else if (!aiService.isAvailable()) {
            audioContent.innerHTML = '<div class="audio-error">請先在設定頁面配置 API 金鑰</div>';
          } else if (aiService.settings?.provider !== 'openai') {
            audioContent.innerHTML = '<div class="audio-error">語音功能需要 OpenAI API</div>';
          } else {
            audioContent.innerHTML = '<div class="audio-error">語音功能未啟用</div>';
          }
        }
      }
    }
  }
  
  // Update manual save button visibility after showing analysis
  updateAutoSaveButtonUI();
}

// Format AI analysis for better readability
function formatAIAnalysis(content) {
  if (!content) return '';
  
  // Simply escape HTML and preserve line breaks
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  
  return `<div style="color: #333; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${formatted}</div>`;
}

// 顯示 AI 錯誤
function showAIError(message) {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (result) {
    result.style.display = 'block';
    result.innerHTML = `<div class="ai-error">❌ ${message}</div>`;
  }
}

// Saved reports functionality
async function viewSavedReport(reportId) {
  console.log('Viewing saved report:', reportId);
  
  try {
    let report = null;
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      const reports = await storageManager.getAIReports();
      report = reports.find(r => r.id === reportId);
    } else {
      // Fallback: get from storage directly
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          const reports = data.aiReports || [];
          resolve(reports.find(r => r.id === reportId));
        });
      });
      report = result;
    }
    
    if (report) {
      console.log('Found saved report:', report);
      
      // Load the saved report into the current view
      currentQueryData = {
        text: report.searchText,
        language: report.language,
        primaryUrl: `https://youglish.com/pronounce/${encodeURIComponent(report.searchText)}/${report.language}`,
        autoAnalysis: false // Don't auto-generate new analysis
      };
      currentAIAnalysis = report.analysisData;
      
      // Show search result with the report data
      showSearchResult(currentQueryData);
      
      // Display the saved analysis
      showAIResult(report.analysisData);
      
      // Switch to analysis view
      const analysisBtn = document.getElementById('showAnalysisBtn');
      if (analysisBtn) analysisBtn.click();
      
      console.log('Loaded saved report:', report.searchText);
    } else {
      console.error('Report not found:', reportId);
      showAIError('找不到已保存的報告');
    }
  } catch (error) {
    console.error('Failed to load saved report:', error);
    showAIError('載入報告時發生錯誤');
  }
}

// Load saved reports view
async function loadSavedReports() {
  console.log('Loading saved reports...');
  
  const reportsList = document.getElementById('savedReportsList');
  const reportsEmpty = document.getElementById('savedReportsEmpty');
  const reportsStats = document.getElementById('savedReportsStats');
  
  if (!reportsList) {
    console.error('Saved reports list container not found');
    return;
  }
  
  try {
    let reports = [];
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      reports = await storageManager.getAIReports();
      console.log('Loaded reports from storage manager:', reports);
    } else {
      // Fallback: get reports directly from storage
      console.log('Using fallback storage method');
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      reports = result;
    }
    
    if (reports.length === 0) {
      if (reportsList) reportsList.style.display = 'none';
      if (reportsEmpty) reportsEmpty.style.display = 'block';
      if (reportsStats) reportsStats.innerHTML = '<p>📊 Total reports: 0</p>';
      return;
    }
    
    // Hide empty state
    if (reportsEmpty) reportsEmpty.style.display = 'none';
    if (reportsList) reportsList.style.display = 'block';
    
    // Update stats
    if (reportsStats) {
      reportsStats.innerHTML = `<p>📊 Total reports: ${reports.length}</p>`;
    }
    
    // Populate tag filter dropdown
    populateTagFilter(reports);
    
    // Generate reports HTML with improved design and buttons
    if (reportsList) {
      reportsList.innerHTML = reports.map(report => {
        const truncatedAnalysis = typeof report.analysisData === 'string' 
          ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
          : (report.analysisData && report.analysisData.content 
              ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
              : 'No analysis preview available');
        
        return `
          <div class="saved-report-item" data-report-id="${report.id}">
            <div class="saved-report-header">
              <div class="report-main-info">
                <span class="report-text">${report.searchText}</span>
                <div class="report-badges">
                  <span class="report-language">${languageNames[report.language] || report.language.toUpperCase()}</span>
                  ${report.favorite ? '<span class="favorite-badge">⭐ 最愛</span>' : ''}
                  ${report.audioData ? '<span class="audio-badge">🔊 語音</span>' : ''}
                </div>
              </div>
              <div class="report-actions">
                <button class="report-action-btn favorite-btn ${report.favorite ? 'active' : ''}" data-id="${report.id}" title="${report.favorite ? '取消最愛' : '加入最愛'}">
                  ${report.favorite ? '⭐' : '☆'}
                </button>
                <button class="report-action-btn edit-tags-btn" data-id="${report.id}" title="編輯標籤">
                  🏷️
                </button>
                <button class="report-action-btn delete-btn" data-id="${report.id}" title="刪除報告">
                  🗑️
                </button>
              </div>
            </div>
            <div class="report-meta">
              <span class="report-date">📅 ${new Date(report.timestamp).toLocaleDateString('zh-TW')} ${new Date(report.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
              <div class="report-tags-container">
                <div class="report-tags-display">
                  ${report.tags && report.tags.length > 0 ? 
                    `🏷️ ${report.tags.map(tag => `<span class="tag-chip">#${tag}</span>`).join('')}` : 
                    '<span class="no-tags">無標籤</span>'}
                </div>
                <div class="report-tags-edit" style="display: none;">
                  <input type="text" class="tags-input" placeholder="輸入標籤，用逗號分隔..." value="${report.tags ? report.tags.join(', ') : ''}" />
                  <div class="tags-edit-actions">
                    <button class="save-tags-btn" data-id="${report.id}">儲存</button>
                    <button class="cancel-tags-btn" data-id="${report.id}">取消</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="report-preview">
              <div class="preview-text">${truncatedAnalysis}</div>
              <button class="preview-expand" data-expanded="false">展開</button>
            </div>
          </div>`;
      }).join('');
      
      // Add event listeners
      reportsList.querySelectorAll('.saved-report-item').forEach(item => {
        const reportId = item.dataset.reportId;
        
        // Main item click (view report)
        const mainArea = item.querySelector('.report-main-info');
        if (mainArea) {
          mainArea.addEventListener('click', () => {
            console.log('Viewing report:', reportId);
            viewSavedReport(reportId);
          });
          mainArea.style.cursor = 'pointer';
        }
        
        // Favorite button
        const favoriteBtn = item.querySelector('.favorite-btn');
        if (favoriteBtn) {
          favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              const newFavoriteState = await toggleFavoriteReport(reportId);
              favoriteBtn.classList.toggle('active', newFavoriteState);
              favoriteBtn.textContent = newFavoriteState ? '⭐' : '☆';
              favoriteBtn.title = newFavoriteState ? '取消最愛' : '加入最愛';
              
              // Update the favorite badge in the header
              const favoriteBadge = item.querySelector('.favorite-badge');
              const reportBadges = item.querySelector('.report-badges');
              if (newFavoriteState && !favoriteBadge) {
                reportBadges.insertAdjacentHTML('beforeend', '<span class="favorite-badge">⭐ 最愛</span>');
              } else if (!newFavoriteState && favoriteBadge) {
                favoriteBadge.remove();
              }
            } catch (error) {
              console.error('Failed to toggle favorite:', error);
            }
          });
        }
        
        // Delete button
        const deleteBtn = item.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reportText = item.querySelector('.report-text').textContent;
            if (confirm(`確定要刪除「${reportText}」的分析報告嗎？`)) {
              try {
                const success = await deleteSavedReport(reportId);
                if (success) {
                  item.remove();
                  // Update stats
                  const remaining = reportsList.children.length;
                  if (reportsStats) {
                    reportsStats.innerHTML = `<p>📊 總共 ${remaining} 份報告</p>`;
                  }
                  if (remaining === 0) {
                    loadSavedReports(); // Reload to show empty state
                  }
                }
              } catch (error) {
                console.error('Failed to delete report:', error);
                alert('刪除失敗');
              }
            }
          });
        }
        
        // Edit tags button
        const editTagsBtn = item.querySelector('.edit-tags-btn');
        if (editTagsBtn) {
          editTagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTagEditing(reportId, item);
          });
        }
        
        // Save tags button
        const saveTagsBtn = item.querySelector('.save-tags-btn');
        if (saveTagsBtn) {
          saveTagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            saveReportTags(reportId, item);
          });
        }
        
        // Cancel tags button
        const cancelTagsBtn = item.querySelector('.cancel-tags-btn');
        if (cancelTagsBtn) {
          cancelTagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelTagEditing(reportId, item);
          });
        }
        
        // Preview expand button
        const expandBtn = item.querySelector('.preview-expand');
        if (expandBtn) {
          expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const previewText = item.querySelector('.preview-text');
            const report = reports.find(r => r.id === reportId);
            const isExpanded = expandBtn.dataset.expanded === 'true';
            
            if (!isExpanded) {
              const fullAnalysis = typeof report.analysisData === 'string' 
                ? report.analysisData 
                : (report.analysisData && report.analysisData.content 
                    ? report.analysisData.content 
                    : 'No analysis available');
              previewText.textContent = fullAnalysis;
              expandBtn.textContent = '收合';
              expandBtn.dataset.expanded = 'true';
            } else {
              const truncatedAnalysis = typeof report.analysisData === 'string' 
                ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
                : (report.analysisData && report.analysisData.content 
                    ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
                    : 'No analysis preview available');
              previewText.textContent = truncatedAnalysis;
              expandBtn.textContent = '展開';
              expandBtn.dataset.expanded = 'false';
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('Failed to load saved reports:', error);
    if (reportsEmpty) {
      reportsEmpty.style.display = 'block';
      reportsEmpty.innerHTML = '<p>❌ 無法載入已保存的報告</p>';
    }
  }
}

// Missing function for updating result display
function updateResultDisplay() {
  // Basic implementation to prevent errors
  console.log('updateResultDisplay called');
}

// Saved Reports Helper Functions
async function toggleFavoriteReport(reportId) {
  try {
    if (storageManager && typeof storageManager.toggleFavorite === 'function') {
      const newState = await storageManager.toggleFavorite(reportId);
      console.log('Toggled favorite for report:', reportId, 'New state:', newState);
      return newState;
    } else {
      // Fallback: direct storage manipulation
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      const reports = result;
      const report = reports.find(r => r.id === reportId);
      if (report) {
        report.favorite = !report.favorite;
        await new Promise((resolve) => {
          chrome.storage.local.set({ aiReports: reports }, resolve);
        });
        return report.favorite;
      }
      return false;
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    throw error;
  }
}

async function deleteSavedReport(reportId) {
  try {
    if (storageManager && typeof storageManager.deleteAIReport === 'function') {
      const success = await storageManager.deleteAIReport(reportId);
      console.log('Deleted report:', reportId, 'Success:', success);
      return success;
    } else {
      // Fallback: direct storage manipulation
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      const reports = result;
      const filteredReports = reports.filter(r => r.id !== reportId);
      await new Promise((resolve) => {
        chrome.storage.local.set({ aiReports: filteredReports }, resolve);
      });
      return true;
    }
  } catch (error) {
    console.error('Failed to delete report:', error);
    throw error;
  }
}

// Cleanup duplicate reports
async function cleanupDuplicateReports() {
  try {
    const cleanupBtn = document.getElementById('cleanupDuplicatesBtn');
    if (cleanupBtn) {
      cleanupBtn.disabled = true;
      cleanupBtn.textContent = '🔄 Cleaning...';
    }
    
    if (storageManager && typeof storageManager.cleanupDuplicateReports === 'function') {
      const result = await storageManager.cleanupDuplicateReports();
      
      if (result.removed > 0) {
        alert(`✅ Cleanup complete!\nRemoved ${result.removed} duplicate reports.\nRemaining: ${result.remaining} unique reports.`);
        // Reload the saved reports view to reflect changes
        loadSavedReports();
      } else {
        alert('✅ No duplicates found! All reports are unique.');
      }
    } else {
      throw new Error('Storage manager not available');
    }
  } catch (error) {
    console.error('Failed to cleanup duplicates:', error);
    alert(`❌ Cleanup failed: ${error.message}`);
  } finally {
    const cleanupBtn = document.getElementById('cleanupDuplicatesBtn');
    if (cleanupBtn) {
      cleanupBtn.disabled = false;
      cleanupBtn.textContent = '🗂️ Clean Duplicates';
    }
  }
}

// Populate tag filter dropdown with available tags
function populateTagFilter(reports) {
  const tagFilter = document.getElementById('savedReportsTagFilter');
  if (!tagFilter) return;
  
  // Get all unique tags from all reports
  const allTags = new Set();
  reports.forEach(report => {
    if (report.tags && Array.isArray(report.tags)) {
      report.tags.forEach(tag => {
        if (tag && tag.trim()) {
          allTags.add(tag.trim());
        }
      });
    }
  });
  
  // Sort tags alphabetically
  const sortedTags = Array.from(allTags).sort();
  
  // Save current selection
  const currentSelection = tagFilter.value;
  
  // Clear existing options except the "All Tags" option
  const allTagsOption = tagFilter.querySelector('option[value=""]');
  tagFilter.innerHTML = '';
  if (allTagsOption) {
    tagFilter.appendChild(allTagsOption);
  } else {
    // Create "All Tags" option if it doesn't exist
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Tags';
    allOption.setAttribute('data-i18n', 'all_tags');
    tagFilter.appendChild(allOption);
  }
  
  // Add tag options
  sortedTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = `#${tag}`;
    tagFilter.appendChild(option);
  });
  
  // Restore previous selection if it still exists
  if (currentSelection && sortedTags.includes(currentSelection)) {
    tagFilter.value = currentSelection;
  }
  
  console.log(`Populated tag filter with ${sortedTags.length} tags:`, sortedTags);
}

// Tag editing functions
function toggleTagEditing(reportId, reportItem) {
  const tagsDisplay = reportItem.querySelector('.report-tags-display');
  const tagsEdit = reportItem.querySelector('.report-tags-edit');
  
  if (tagsDisplay && tagsEdit) {
    const isEditing = tagsEdit.style.display !== 'none';
    
    if (isEditing) {
      // Cancel editing
      tagsDisplay.style.display = 'block';
      tagsEdit.style.display = 'none';
    } else {
      // Start editing
      tagsDisplay.style.display = 'none';
      tagsEdit.style.display = 'block';
      
      // Focus on the input and add keyboard shortcuts
      const tagsInput = tagsEdit.querySelector('.tags-input');
      if (tagsInput) {
        tagsInput.focus();
        tagsInput.select();
        
        // Add keyboard event listener
        tagsInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveReportTags(reportId, reportItem);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelTagEditing(reportId, reportItem);
          }
        });
      }
    }
  }
}

function cancelTagEditing(reportId, reportItem) {
  const tagsDisplay = reportItem.querySelector('.report-tags-display');
  const tagsEdit = reportItem.querySelector('.report-tags-edit');
  
  if (tagsDisplay && tagsEdit) {
    tagsDisplay.style.display = 'block';
    tagsEdit.style.display = 'none';
  }
}

async function saveReportTags(reportId, reportItem) {
  const tagsInput = reportItem.querySelector('.tags-input');
  if (!tagsInput) return;
  
  const tagText = tagsInput.value.trim();
  const newTags = tagText ? tagText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
  
  try {
    // Update the report with new tags
    let success = false;
    
    // Use direct storage approach for updating tags to avoid complications
    {
      // Direct storage manipulation for tag updates
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      const reports = result;
      const reportIndex = reports.findIndex(r => r.id === reportId);
      
      if (reportIndex !== -1) {
        reports[reportIndex].tags = newTags;
        
        await new Promise((resolve) => {
          chrome.storage.local.set({ aiReports: reports }, resolve);
        });
        
        success = true;
      }
    }
    
    if (success) {
      // Update the display
      const tagsDisplay = reportItem.querySelector('.report-tags-display');
      if (tagsDisplay) {
        if (newTags.length > 0) {
          tagsDisplay.innerHTML = `🏷️ ${newTags.map(tag => `<span class="tag-chip">#${tag}</span>`).join('')}`;
        } else {
          tagsDisplay.innerHTML = '<span class="no-tags">無標籤</span>';
        }
      }
      
      // Hide edit interface
      cancelTagEditing(reportId, reportItem);
      
      // Refresh tag filter dropdown
      setTimeout(() => {
        loadSavedReports(); // This will repopulate the tag filter
      }, 100);
      
      console.log('Tags updated for report:', reportId, newTags);
    } else {
      throw new Error('Failed to update report');
    }
    
  } catch (error) {
    console.error('Error saving tags:', error);
    alert('儲存標籤失敗: ' + error.message);
  }
}

// Auto-save functionality
let autoSaveEnabled = true; // Default to enabled

async function loadAutoSaveSetting() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['autoSaveReports'], resolve);
    });
    
    autoSaveEnabled = result.autoSaveReports !== false; // Default to true if not set
    updateAutoSaveButtonUI();
  } catch (error) {
    console.error('Failed to load auto-save setting:', error);
    autoSaveEnabled = true; // Default to enabled
    updateAutoSaveButtonUI();
  }
}

async function toggleAutoSave() {
  try {
    autoSaveEnabled = !autoSaveEnabled;
    
    // Save to storage
    await new Promise((resolve) => {
      chrome.storage.sync.set({ autoSaveReports: autoSaveEnabled }, resolve);
    });
    
    updateAutoSaveButtonUI();
    console.log('Auto-save toggled:', autoSaveEnabled ? 'ON' : 'OFF');
    
  } catch (error) {
    console.error('Failed to toggle auto-save:', error);
    // Revert on error
    autoSaveEnabled = !autoSaveEnabled;
    updateAutoSaveButtonUI();
  }
}

function updateAutoSaveButtonUI() {
  const autoSaveBtn = document.getElementById('autoSaveToggleBtn');
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  
  if (!autoSaveBtn) return;
  
  if (autoSaveEnabled) {
    autoSaveBtn.classList.add('active');
    autoSaveBtn.classList.remove('inactive');
    
    // Update text using i18n
    if (typeof window.getI18nMessage !== 'undefined') {
      autoSaveBtn.textContent = window.getI18nMessage('auto_save_on');
      autoSaveBtn.title = window.getI18nMessage('auto_save_toggle_tooltip');
    } else {
      autoSaveBtn.textContent = '💾 Auto-Save';
      autoSaveBtn.title = 'Click to toggle auto-save';
    }
    
    // Hide manual save button when auto-save is enabled
    if (manualSaveBtn) {
      manualSaveBtn.style.display = 'none';
    }
  } else {
    autoSaveBtn.classList.remove('active');
    autoSaveBtn.classList.add('inactive');
    
    // Update text using i18n
    if (typeof window.getI18nMessage !== 'undefined') {
      autoSaveBtn.textContent = window.getI18nMessage('auto_save_off');
      autoSaveBtn.title = window.getI18nMessage('auto_save_toggle_tooltip');
    } else {
      autoSaveBtn.textContent = '💾 Manual';
      autoSaveBtn.title = 'Click to toggle auto-save';
    }
    
    // Show manual save button when auto-save is disabled AND analysis exists
    if (manualSaveBtn) {
      const hasAnalysis = currentAIAnalysis && currentQueryData.text && currentQueryData.language;
      manualSaveBtn.style.display = hasAnalysis ? 'inline-block' : 'none';
      
      // Update manual save button text
      if (typeof window.getI18nMessage !== 'undefined') {
        manualSaveBtn.textContent = window.getI18nMessage('save_this_report');
      } else {
        manualSaveBtn.textContent = '💾 Save This Report';
      }
    }
  }
}

// Manual save function for when auto-save is disabled
async function manualSaveReport() {
  if (!currentAIAnalysis || !currentQueryData.text || !currentQueryData.language) {
    alert('沒有可保存的分析報告');
    return;
  }
  
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  
  try {
    if (manualSaveBtn) {
      manualSaveBtn.disabled = true;
      manualSaveBtn.textContent = '💾 保存中...';
    }
    
    if (storageManager && typeof storageManager.saveAIReport === 'function') {
      await storageManager.saveAIReport(
        currentQueryData.text,
        currentQueryData.language,
        currentAIAnalysis,
        null // No audio data yet
      );
      console.log('AI analysis report saved manually');
      
      // Show success feedback
      if (manualSaveBtn) {
        manualSaveBtn.textContent = '✅ 已保存';
        manualSaveBtn.style.background = '#4CAF50';
        
        // Revert button after 2 seconds
        setTimeout(() => {
          manualSaveBtn.disabled = false;
          manualSaveBtn.style.background = '';
          updateAutoSaveButtonUI(); // This will set the correct text
        }, 2000);
      }
      
      // Show success message
      alert('✅ 報告已保存到「💾 已保存」標籤頁');
      
    } else {
      throw new Error('Storage manager not available');
    }
    
  } catch (error) {
    console.error('Failed to save report manually:', error);
    alert('❌ 保存失敗: ' + error.message);
    
    // Restore button state
    if (manualSaveBtn) {
      manualSaveBtn.disabled = false;
      updateAutoSaveButtonUI();
    }
  }
}

// Audio pronunciation functions - 簡化版本
async function generateAudioPronunciation(forceRefresh = false) {
  if (!currentQueryData.text || !currentQueryData.language) {
    showAudioError('沒有可生成語音的文本');
    return;
  }
  
  console.log('🎵 Audio generation requested for:', currentQueryData.text);
  showAudioLoading();
  
  try {
    // Simple checks
    if (!aiService) {
      throw new Error('AI 服務未載入');
    }
    
    // Initialize if needed
    if (!aiService.isInitialized) {
      console.log('🔧 Initializing AI service...');
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new Error('請先在選項頁面配置 OpenAI API 金鑰');
      }
    }
    
    // Simple availability check - specifically for OpenAI TTS
    if (!aiService.isAudioAvailable()) {
      const provider = aiService.settings?.provider;
      if (provider !== 'openai') {
        throw new Error(`語音功能需要 OpenAI API - 當前設定: ${provider || '未設定'}。請到選項頁面選擇 OpenAI 作為提供商`);
      } else {
        throw new Error('OpenAI API 未正確配置 - 請檢查 API 金鑰設定');
      }
    }
    
    console.log('✅ Using OpenAI TTS for audio generation');
    
    console.log('🚀 Starting audio generation...');
    const startTime = Date.now();
    
    // Direct call without Promise.race complexity
    const audioData = await aiService.generateAudio(currentQueryData.text, currentQueryData.language);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Audio completed in ${duration}ms`);
    
    showAudioResult(audioData);
    
  } catch (error) {
    console.error('❌ Audio generation error:', error);
    
    // User-friendly error messages
    let errorMessage = error.message;
    if (errorMessage.includes('401')) {
      errorMessage = '無效的 API 金鑰 - 請檢查設定';
    } else if (errorMessage.includes('429')) {
      errorMessage = 'API 使用次數超限 - 請稍後再試';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('超時')) {
      errorMessage = '生成超時 - 請檢查網路或重試';
    } else if (errorMessage.includes('AbortError')) {
      errorMessage = '請求被取消 - 請重新嘗試';
    }
    
    showAudioError(errorMessage);
  }
}

function playAudio() {
  console.log('🔊 playAudio() called');
  const audioElement = document.getElementById('pronunciationAudio');
  
  console.log('Audio element found:', !!audioElement);
  console.log('Audio element src:', audioElement?.src);
  console.log('Audio element readyState:', audioElement?.readyState);
  
  if (audioElement && audioElement.src) {
    console.log('▶️ Starting audio playback...');
    audioElement.play().then(() => {
      console.log('✅ Audio playback started successfully');
    }).catch(err => {
      console.error('❌ Audio playback failed:', err);
      showAudioError(`音頻播放失敗: ${err.message}`);
    });
  } else {
    console.log('❌ No audio available - element:', !!audioElement, 'src:', audioElement?.src);
    
    if (!audioElement) {
      showAudioError('找不到音頻元素 - 請重新整理頁面');
    } else if (!audioElement.src) {
      showAudioError('音頻未載入 - 請重新生成語音');
    } else {
      showAudioError('沒有可播放的音頻');
    }
  }
}

function downloadAudio() {
  const audioElement = document.getElementById('pronunciationAudio');
  if (audioElement && audioElement.src) {
    const link = document.createElement('a');
    link.href = audioElement.src;
    link.download = `${currentQueryData.text || 'pronunciation'}_audio.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    console.log('No audio available to download');
    showAudioError('沒有可下載的音頻');
  }
}

// Audio UI functions
function showAudioLoading() {
  const audioContent = document.getElementById('audioContent');
  console.log('showAudioLoading called, audioContent element:', !!audioContent);
  if (audioContent) {
    audioContent.innerHTML = `
      <div class="audio-loading">
        🎵 正在生成語音...
        <br><small style="color: #666; margin-top: 8px; display: block;">預期 5-10 秒完成，如果超過 15 秒可能有問題</small>
      </div>`;
    console.log('Audio loading UI updated');
  } else {
    console.error('audioContent element not found!');
  }
}

function showAudioResult(audioData) {
  console.log('🔊 Displaying audio result:', audioData);
  
  const audioContent = document.getElementById('audioContent');
  
  if (audioContent && audioData && audioData.audioUrl) {
    // Create a new audio element directly in the content (simpler approach)
    audioContent.innerHTML = `
      <div class="audio-ready">
        ✅ 語音已生成 (${Math.round(audioData.size / 1024)} KB) - OpenAI TTS
        <br>
        <audio id="generatedAudio" controls preload="metadata" style="width: 100%; margin: 8px 0;">
          <source src="${audioData.audioUrl}" type="audio/mpeg">
          您的瀏覽器不支援音頻播放
        </audio>
        <br>
        <button id="playAudioDirectBtn" style="margin-top: 4px; padding: 4px 8px; background: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer;">
          ▶️ 播放
        </button>
        <button id="downloadAudioDirectBtn" style="margin: 4px 0 0 8px; padding: 4px 8px; background: #666; color: white; border: none; border-radius: 3px; cursor: pointer;">
          📥 下載
        </button>
      </div>`;
    
    // Add event listeners for direct control
    const playBtn = document.getElementById('playAudioDirectBtn');
    const downloadBtn = document.getElementById('downloadAudioDirectBtn');
    const audioElement = document.getElementById('generatedAudio');
    
    if (playBtn && audioElement) {
      playBtn.addEventListener('click', () => {
        console.log('🎯 Playing audio directly...');
        audioElement.play().then(() => {
          console.log('✅ Audio playing successfully');
        }).catch(err => {
          console.error('❌ Direct audio play failed:', err);
          showAudioError(`播放失敗: ${err.message}`);
        });
      });
    }
    
    if (downloadBtn && audioData.audioUrl) {
      downloadBtn.addEventListener('click', () => {
        console.log('📥 Downloading audio...');
        const link = document.createElement('a');
        link.href = audioData.audioUrl;
        link.download = `${currentQueryData.text || 'pronunciation'}_audio.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
    
    // Show regenerate button
    const regenerateBtn = document.getElementById('regenerateAudioBtn');
    if (regenerateBtn) regenerateBtn.style.display = 'inline-block';
    
    console.log('✅ Audio UI created with direct controls');
    
  } else {
    if (!audioContent) {
      console.error('❌ audioContent element not found');
      return;
    }
    if (!audioData || !audioData.audioUrl) {
      console.error('❌ Invalid audio data:', audioData);
      audioContent.innerHTML = '<div class="audio-error">❌ 無效的音頻數據</div>';
    }
  }
}

function showAudioError(message) {
  const audioContent = document.getElementById('audioContent');
  if (audioContent) {
    audioContent.innerHTML = `<div class="audio-error">❌ ${message}</div>`;
  }
}

// Export functions (basic implementations)
async function exportToMarkdown(reports) {
  console.log('Exporting to markdown:', reports);
  return 'Markdown export not fully implemented';
}

async function exportToHeptaBase(reports) {
  console.log('Exporting to HeptaBase:', reports);
  return 'HeptaBase export not fully implemented';  
}

// Initialize all buttons and features
document.addEventListener('DOMContentLoaded', () => {
  // Settings button
  const settingsBtn = document.querySelector('.settings-button');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
  
  // Header language selector
  const headerLanguageSelect = document.getElementById('headerLanguageSelect');
  if (headerLanguageSelect) {
    // Load current language setting (use the correct storage key)
    chrome.storage.sync.get(['uiLanguage'], (result) => {
      const currentLang = result.uiLanguage || 'auto';
      headerLanguageSelect.value = currentLang;
    });
    
    // Handle language change
    headerLanguageSelect.addEventListener('change', async (e) => {
      const selectedLang = e.target.value;
      console.log('Language changed to:', selectedLang);
      
      try {
        // Save to storage with the correct key (uiLanguage, not interfaceLanguage)
        await new Promise((resolve) => {
          chrome.storage.sync.set({ uiLanguage: selectedLang }, resolve);
        });
        
        console.log('Interface language saved:', selectedLang);
        
        // Apply language change immediately using available methods
        if (typeof window.i18nHelper !== 'undefined' && window.i18nHelper.switchLanguage) {
          await window.i18nHelper.switchLanguage(selectedLang);
          console.log('✅ Language switched to:', selectedLang, 'via i18nHelper');
        } else if (typeof window.refreshUILanguage !== 'undefined') {
          await window.refreshUILanguage();
          console.log('✅ Language switched to:', selectedLang, 'via refreshUILanguage');
        } else {
          console.log('⚠️ No i18n helpers available, reloading page...');
          // Fallback: reload the page to apply new language
          window.location.reload();
        }
      } catch (error) {
        console.error('Error switching language:', error);
        // Fallback: reload on error
        window.location.reload();
      }
    });
  }
  
  // New tab button
  const newTabBtn = document.getElementById('openInNewTabBtn');
  if (newTabBtn) {
    newTabBtn.addEventListener('click', openCurrentInNewTab);
  }
  
  // AI Analysis buttons
  const generateBtn = document.getElementById('generateAiAnalysisBtn');
  const refreshBtn = document.getElementById('refreshAiAnalysisBtn');
  
  if (generateBtn) {
    generateBtn.addEventListener('click', () => generateAIAnalysis());
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => generateAIAnalysis(true));
  }
  
  // Auto-save toggle button
  const autoSaveToggleBtn = document.getElementById('autoSaveToggleBtn');
  if (autoSaveToggleBtn) {
    // Load current auto-save setting
    loadAutoSaveSetting();
    
    autoSaveToggleBtn.addEventListener('click', () => toggleAutoSave());
  }
  
  // Manual save button
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  if (manualSaveBtn) {
    manualSaveBtn.addEventListener('click', () => manualSaveReport());
  }
  
  // Audio generation buttons
  const generateAudioBtn = document.getElementById('generateAudioBtn');
  const regenerateAudioBtn = document.getElementById('regenerateAudioBtn');
  const playAudioBtn = document.getElementById('playAudioBtn');
  const downloadAudioBtn = document.getElementById('downloadAudioBtn');
  const testAudioBtn = document.getElementById('testAudioBtn');
  
  if (generateAudioBtn) {
    generateAudioBtn.addEventListener('click', () => generateAudioPronunciation());
  }
  
  if (regenerateAudioBtn) {
    regenerateAudioBtn.addEventListener('click', () => generateAudioPronunciation(true));
  }
  
  if (playAudioBtn) {
    playAudioBtn.addEventListener('click', playAudio);
  }
  
  if (downloadAudioBtn) {
    downloadAudioBtn.addEventListener('click', downloadAudio);
  }
  
  // Test audio button for debugging
  if (testAudioBtn) {
    testAudioBtn.addEventListener('click', () => {
      console.log('=== AUDIO TEST DEBUG ===');
      console.log('aiService:', aiService);
      console.log('aiService type:', typeof aiService);
      console.log('currentQueryData:', currentQueryData);
      
      if (aiService) {
        console.log('AI Service initialized:', aiService.isInitialized);
        console.log('AI Service available:', aiService.isAvailable());
        console.log('Audio available:', aiService.isAudioAvailable());
        console.log('Settings:', aiService.settings);
        
        // Try to initialize if not already done
        if (!aiService.isInitialized) {
          console.log('Attempting to initialize AI service...');
          aiService.initialize().then(result => {
            console.log('Initialization result:', result);
            console.log('After init - Audio available:', aiService.isAudioAvailable());
            console.log('After init - Settings:', aiService.settings);
          }).catch(err => {
            console.error('Initialization failed:', err);
          });
        }
      } else {
        console.error('aiService is not defined!');
        console.log('window.aiService:', window.aiService);
        console.log('typeof window.aiService:', typeof window.aiService);
      }
      console.log('=== END AUDIO TEST ===');
    });
  }
  
  // History controls
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('確定要清空所有搜尋歷史嗎？這個操作無法復原。')) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'clearHistory' }, resolve);
          });
          if (response && response.success) {
            console.log('History cleared successfully');
            loadHistoryView(); // Reload the view
          } else {
            console.error('Failed to clear history:', response?.error);
            alert('清空失敗');
          }
        } catch (error) {
          console.error('Error clearing history:', error);
          alert('清空失敗');
        }
      }
    });
  }
  
  // History search functionality
  const historySearchInput = document.getElementById('historySearchInput');
  const historyLanguageFilter = document.getElementById('historyLanguageFilter');
  
  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      filterHistoryView();
    });
  }
  
  if (historyLanguageFilter) {
    historyLanguageFilter.addEventListener('change', () => {
      filterHistoryView();
    });
  }
  
  // Saved reports search and filter functionality
  const savedReportsSearchInput = document.getElementById('savedReportsSearchInput');
  const savedReportsLanguageFilter = document.getElementById('savedReportsLanguageFilter');
  const savedReportsTagFilter = document.getElementById('savedReportsTagFilter');
  const favoritesOnlyFilter = document.getElementById('favoritesOnlyFilter');
  const exportReportsBtn = document.getElementById('exportReportsBtn');
  const exportDropdown = document.getElementById('exportDropdown');
  
  if (savedReportsSearchInput) {
    savedReportsSearchInput.addEventListener('input', () => {
      filterSavedReports();
    });
  }
  
  if (savedReportsLanguageFilter) {
    savedReportsLanguageFilter.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  if (savedReportsTagFilter) {
    savedReportsTagFilter.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  if (favoritesOnlyFilter) {
    favoritesOnlyFilter.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  // Cleanup duplicates button
  const cleanupDuplicatesBtn = document.getElementById('cleanupDuplicatesBtn');
  if (cleanupDuplicatesBtn) {
    cleanupDuplicatesBtn.addEventListener('click', async () => {
      await cleanupDuplicateReports();
    });
  }
  
  // Export dropdown functionality
  if (exportReportsBtn) {
    exportReportsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = exportReportsBtn.closest('.export-dropdown');
      dropdown.classList.toggle('show');
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-dropdown')) {
      const dropdowns = document.querySelectorAll('.export-dropdown.show');
      dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    }
  });
  
  // Export format handlers
  const exportHandlers = {
    'exportMarkdown': () => exportSavedReports('markdown'),
    'exportHeptabase': () => exportSavedReports('heptabase'),
    'exportObsidian': () => exportSavedReports('obsidian'),
    'exportNotion': () => exportSavedReports('notion'),
    'exportJSON': () => exportSavedReports('json')
  };
  
  Object.entries(exportHandlers).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        // Close dropdown
        document.querySelectorAll('.export-dropdown.show').forEach(d => d.classList.remove('show'));
        handler();
      });
    }
  });

  // Extension loaded - ready for user searches
  console.log('✅ YouGlish extension loaded and ready');
  
  // Manual search
  const manualSearchBtn = document.getElementById('manualSearchBtn');
  const manualSearchInput = document.getElementById('manualSearchInput');
  
  if (manualSearchBtn) {
    manualSearchBtn.addEventListener('click', performManualSearch);
  }
  
  if (manualSearchInput) {
    manualSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performManualSearch();
      }
    });
  }
  
  // Check for current query and ensure welcome screen shows if no query
  chrome.storage.local.get(['currentQuery'], (result) => {
    console.log('Loading current query on startup:', result.currentQuery);
    
    if (result.currentQuery && result.currentQuery.text) {
      // Create proper query data structure
      const queryData = {
        text: result.currentQuery.text,
        language: result.currentQuery.language,
        primaryUrl: result.currentQuery.url || result.currentQuery.primaryUrl,
        secondaryUrl: '',
        tertiaryUrl: '',
        allUrls: { 'YouGlish': result.currentQuery.url || result.currentQuery.primaryUrl },
        autoAnalysis: true // Enable auto analysis for loaded queries
      };
      
      showSearchResult(queryData);
      console.log('Loaded current query:', queryData);
    } else {
      // Ensure welcome screen is visible
      console.log('No current query found, showing welcome screen');
      const welcome = document.getElementById('welcome');
      const searchResult = document.getElementById('searchResult');
      const searchInfo = document.getElementById('searchInfo');
      
      if (welcome) welcome.style.display = 'block';
      if (searchResult) searchResult.style.display = 'none';
      if (searchInfo) searchInfo.style.display = 'none';
    }
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.currentQuery && changes.currentQuery.newValue) {
      const currentQuery = changes.currentQuery.newValue;
      console.log('Current query changed:', currentQuery);
      
      if (currentQuery && currentQuery.text) {
        // Create proper query data structure
        const queryData = {
          text: currentQuery.text,
          language: currentQuery.language,
          primaryUrl: currentQuery.url || currentQuery.primaryUrl,
          secondaryUrl: '',
          tertiaryUrl: '',
          allUrls: { 'YouGlish': currentQuery.url || currentQuery.primaryUrl },
          autoAnalysis: true // Enable auto analysis for new queries
        };
        
        showSearchResult(queryData);
      }
    }
  });
  
  // Search Again button removed - it was causing UI issues
  
  // Add saved reports button handler
  const showSavedReportsBtn = document.getElementById('showSavedReportsBtn');
  if (showSavedReportsBtn) {
    showSavedReportsBtn.addEventListener('click', () => {
      // Switch to saved reports view
      const savedReportsView = document.getElementById('savedReportsView');
      const analysisView = document.getElementById('analysisView');
      const videoView = document.getElementById('videoView');
      const historyView = document.getElementById('historyView');
      
      // Hide other views
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      
      // Show saved reports view
      if (savedReportsView) {
        savedReportsView.style.display = 'block';
        loadSavedReports();
      }
      
      // Update button states
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showSavedReportsBtn.classList.add('active');
    });
  }
});

// Filter saved reports based on search, language, tags, and favorites
async function filterSavedReports() {
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  console.log('Filtering saved reports:', { searchQuery, languageFilter, tagFilter, favoritesOnly });
  
  try {
    let reports = [];
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      // Use the storage manager's built-in filtering
      const filter = {};
      if (languageFilter) filter.language = languageFilter;
      if (searchQuery) filter.searchText = searchQuery;
      if (favoritesOnly) filter.favorites = true;
      
      reports = await storageManager.getAIReports(filter);
    } else {
      // Fallback: get all reports and filter manually
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      reports = result;
      
      // Apply filters manually
      if (searchQuery) {
        reports = reports.filter(report => 
          report.searchText.toLowerCase().includes(searchQuery) ||
          (report.tags && report.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
        );
      }
      
      if (languageFilter) {
        reports = reports.filter(report => report.language === languageFilter);
      }
      
      if (tagFilter) {
        reports = reports.filter(report => 
          report.tags && report.tags.some(tag => 
            tag.toLowerCase().includes(tagFilter.toLowerCase())
          )
        );
      }
      
      if (favoritesOnly) {
        reports = reports.filter(report => report.favorite);
      }
    }
    
    // Update the display with filtered results
    const reportsList = document.getElementById('savedReportsList');
    const reportsEmpty = document.getElementById('savedReportsEmpty');
    const reportsStats = document.getElementById('savedReportsStats');
    
    if (reports.length === 0) {
      if (reportsList) reportsList.innerHTML = '';
      if (reportsEmpty) {
        reportsEmpty.style.display = 'block';
        reportsEmpty.innerHTML = '<p>📝 沒有符合條件的報告</p><p style="color: #666; font-size: 12px;">調整搜尋條件或新增更多AI分析報告</p>';
      }
      if (reportsStats) reportsStats.innerHTML = '<p>📊 找到 0 份報告</p>';
    } else {
      if (reportsEmpty) reportsEmpty.style.display = 'none';
      if (reportsStats) reportsStats.innerHTML = `<p>📊 找到 ${reports.length} 份報告</p>`;
      
      // Reuse the display logic from loadSavedReports
      displayFilteredReports(reports);
    }
    
  } catch (error) {
    console.error('Error filtering saved reports:', error);
  }
}

// Display filtered reports (extracted from loadSavedReports)
function displayFilteredReports(reports) {
  const reportsList = document.getElementById('savedReportsList');
  if (!reportsList) return;
  
  // Use the same HTML generation logic as in loadSavedReports
  reportsList.innerHTML = reports.map(report => {
    const truncatedAnalysis = typeof report.analysisData === 'string' 
      ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
      : (report.analysisData && report.analysisData.content 
          ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
          : 'No analysis preview available');
    
    return `
      <div class="saved-report-item" data-report-id="${report.id}">
        <div class="saved-report-header">
          <div class="report-main-info">
            <span class="report-text">${report.searchText}</span>
            <div class="report-badges">
              <span class="report-language">${languageNames[report.language] || report.language.toUpperCase()}</span>
              ${report.favorite ? '<span class="favorite-badge">⭐ 最愛</span>' : ''}
              ${report.audioData ? '<span class="audio-badge">🔊 語音</span>' : ''}
            </div>
          </div>
          <div class="report-actions">
            <button class="report-action-btn favorite-btn ${report.favorite ? 'active' : ''}" data-id="${report.id}" title="${report.favorite ? '取消最愛' : '加入最愛'}">
              ${report.favorite ? '⭐' : '☆'}
            </button>
            <button class="report-action-btn delete-btn" data-id="${report.id}" title="刪除報告">
              🗑️
            </button>
          </div>
        </div>
        <div class="report-meta">
          <span class="report-date">📅 ${new Date(report.timestamp).toLocaleDateString('zh-TW')} ${new Date(report.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
          ${report.tags && report.tags.length > 0 ? `<span class="report-tags">🏷️ ${report.tags.join(', ')}</span>` : ''}
        </div>
        <div class="report-preview">
          <div class="preview-text">${truncatedAnalysis}</div>
          <button class="preview-expand" data-expanded="false">展開</button>
        </div>
      </div>`;
  }).join('');
  
  // Re-add event listeners (same logic as in loadSavedReports)
  reportsList.querySelectorAll('.saved-report-item').forEach(item => {
    const reportId = item.dataset.reportId;
    
    // Main item click (view report)
    const mainArea = item.querySelector('.report-main-info');
    if (mainArea) {
      mainArea.addEventListener('click', () => {
        viewSavedReport(reportId);
      });
      mainArea.style.cursor = 'pointer';
    }
    
    // Favorite button
    const favoriteBtn = item.querySelector('.favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const newFavoriteState = await toggleFavoriteReport(reportId);
          favoriteBtn.classList.toggle('active', newFavoriteState);
          favoriteBtn.textContent = newFavoriteState ? '⭐' : '☆';
          favoriteBtn.title = newFavoriteState ? '取消最愛' : '加入最愛';
          
          const favoriteBadge = item.querySelector('.favorite-badge');
          const reportBadges = item.querySelector('.report-badges');
          if (newFavoriteState && !favoriteBadge) {
            reportBadges.insertAdjacentHTML('beforeend', '<span class="favorite-badge">⭐ 最愛</span>');
          } else if (!newFavoriteState && favoriteBadge) {
            favoriteBadge.remove();
          }
          
          // Re-filter if favorites-only is enabled
          if (document.getElementById('favoritesOnlyFilter')?.checked) {
            setTimeout(filterSavedReports, 100);
          }
        } catch (error) {
          console.error('Failed to toggle favorite:', error);
        }
      });
    }
    
    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reportText = item.querySelector('.report-text').textContent;
        if (confirm(`確定要刪除「${reportText}」的分析報告嗎？`)) {
          try {
            const success = await deleteSavedReport(reportId);
            if (success) {
              filterSavedReports(); // Refresh the filtered view
            }
          } catch (error) {
            console.error('Failed to delete report:', error);
            alert('刪除失敗');
          }
        }
      });
    }
    
    // Preview expand button (same logic as before)
    const expandBtn = item.querySelector('.preview-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const previewText = item.querySelector('.preview-text');
        const report = reports.find(r => r.id === reportId);
        const isExpanded = expandBtn.dataset.expanded === 'true';
        
        if (!isExpanded) {
          const fullAnalysis = typeof report.analysisData === 'string' 
            ? report.analysisData 
            : (report.analysisData && report.analysisData.content 
                ? report.analysisData.content 
                : 'No analysis available');
          previewText.textContent = fullAnalysis;
          expandBtn.textContent = '收合';
          expandBtn.dataset.expanded = 'true';
        } else {
          const truncatedAnalysis = typeof report.analysisData === 'string' 
            ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
            : (report.analysisData && report.analysisData.content 
                ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
                : 'No analysis preview available');
          previewText.textContent = truncatedAnalysis;
          expandBtn.textContent = '展開';
          expandBtn.dataset.expanded = 'false';
        }
      });
    }
  });
}

// Export saved reports functionality with multiple formats - respects current filters
async function exportSavedReports(format = 'json') {
  try {
    // Get reports that match current filters
    let reports = await getCurrentlyFilteredReports();
    
    if (reports.length === 0) {
      // Check if no reports exist or just filtered out
      const allReports = await getAllReports();
      if (allReports.length === 0) {
        alert('沒有可匯出的報告');
      } else {
        alert(`目前的篩選條件沒有符合的報告。所有報告: ${allReports.length}，符合條件: 0`);
      }
      return;
    }
    
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Add filter info to export
    const filterInfo = getCurrentFilterInfo();
    console.log(`Exporting ${reports.length} reports (${filterInfo}) in ${format} format`);
    
    switch (format) {
      case 'markdown':
        await exportMarkdown(reports, dateStr, filterInfo);
        break;
      case 'heptabase':
        await exportHeptabase(reports, dateStr, filterInfo);
        break;
      case 'obsidian':
        await exportObsidian(reports, dateStr, filterInfo);
        break;
      case 'notion':
        await exportNotion(reports, dateStr, filterInfo);
        break;
      case 'json':
      default:
        await exportJSON(reports, dateStr, filterInfo);
        break;
    }
    
    console.log(`Successfully exported ${reports.length} reports in ${format} format`);
    
    // Show success message with filter info
    const message = `匯出完成！\n格式: ${format.toUpperCase()}\n報告數量: ${reports.length}\n篩選條件: ${filterInfo}`;
    alert(message);
    
  } catch (error) {
    console.error('Export failed:', error);
    alert(`匯出失敗: ${error.message}`);
  }
}

// Get currently filtered reports based on UI state
async function getCurrentlyFilteredReports() {
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  try {
    let reports = [];
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      // Use the storage manager's built-in filtering
      const filter = {};
      if (languageFilter) filter.language = languageFilter;
      if (searchQuery) filter.searchText = searchQuery;
      if (favoritesOnly) filter.favorites = true;
      
      reports = await storageManager.getAIReports(filter);
    } else {
      // Fallback: get all reports and filter manually
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      reports = result;
      
      // Apply filters manually
      if (searchQuery) {
        reports = reports.filter(report => 
          report.searchText.toLowerCase().includes(searchQuery) ||
          (report.tags && report.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
        );
      }
      
      if (languageFilter) {
        reports = reports.filter(report => report.language === languageFilter);
      }
      
      if (tagFilter) {
        reports = reports.filter(report => 
          report.tags && report.tags.some(tag => 
            tag.toLowerCase().includes(tagFilter.toLowerCase())
          )
        );
      }
      
      if (favoritesOnly) {
        reports = reports.filter(report => report.favorite);
      }
    }
    
    return reports;
    
  } catch (error) {
    console.error('Error getting filtered reports:', error);
    return [];
  }
}

// Get all reports without filters
async function getAllReports() {
  if (storageManager && typeof storageManager.getAIReports === 'function') {
    return await storageManager.getAIReports();
  } else {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['aiReports'], (data) => {
        resolve(data.aiReports || []);
      });
    });
    return result;
  }
}

// Get current filter information for display
function getCurrentFilterInfo() {
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  const filters = [];
  
  if (searchQuery) {
    filters.push(`搜尋: "${searchQuery}"`);
  }
  
  if (languageFilter) {
    const languageName = languageNames[languageFilter] || languageFilter;
    filters.push(`語言: ${languageName}`);
  }
  
  if (tagFilter) {
    filters.push(`標籤: #${tagFilter}`);
  }
  
  if (favoritesOnly) {
    filters.push('僅最愛');
  }
  
  return filters.length > 0 ? filters.join(', ') : '全部報告';
}

// Export functions for different formats - with filter info
async function exportMarkdown(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const markdown = ExportTemplates.generateMarkdown(reports, filterInfo);
  const filename = getFilteredFilename('youglish-vocabulary', dateStr, filterInfo, 'md');
  
  downloadFile(markdown, filename, 'text/markdown');
}

async function exportHeptabase(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const heptabaseData = ExportTemplates.generateHeptabase(reports, filterInfo);
  const filename = getFilteredFilename('youglish-heptabase', dateStr, filterInfo, 'json');
  
  // Create a JSON file with Heptabase-compatible structure
  downloadFile(
    JSON.stringify(heptabaseData, null, 2), 
    filename,
    'application/json'
  );
  
  // Also create individual markdown files for each card
  const zip = await createZipFile(heptabaseData.cards.map(card => ({
    filename: `${card.title.replace(/[^\w\s-]/g, '').trim()}.md`,
    content: card.content
  })));
  
  const zipFilename = getFilteredFilename('youglish-heptabase-cards', dateStr, filterInfo, 'zip');
  downloadBlob(zip, zipFilename);
}

async function exportObsidian(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const obsidianFiles = ExportTemplates.generateObsidian(reports, filterInfo);
  
  // Create a zip file with all the markdown files
  const zip = await createZipFile(obsidianFiles);
  const filename = getFilteredFilename('youglish-obsidian-vault', dateStr, filterInfo, 'zip');
  
  downloadBlob(zip, filename);
}

async function exportNotion(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const notionData = ExportTemplates.generateNotion(reports, filterInfo);
  
  // Create a CSV file that can be imported into Notion
  const csvContent = convertNotionToCSV(notionData);
  const csvFilename = getFilteredFilename('youglish-notion', dateStr, filterInfo, 'csv');
  
  downloadFile(csvContent, csvFilename, 'text/csv');
  
  // Also provide JSON version with instructions
  const jsonWithInstructions = {
    instructions: "Import the CSV file into Notion, or use this JSON data to create a database manually",
    exportInfo: {
      date: dateStr,
      filters: filterInfo,
      count: reports.length
    },
    ...notionData
  };
  
  const jsonFilename = getFilteredFilename('youglish-notion', dateStr, filterInfo, 'json');
  downloadFile(
    JSON.stringify(jsonWithInstructions, null, 2),
    jsonFilename,
    'application/json'
  );
}

async function exportJSON(reports, dateStr, filterInfo = '全部報告') {
  // Create export data with filter information
  const exportData = {
    exportInfo: {
      date: dateStr,
      filters: filterInfo,
      count: reports.length,
      exportedAt: new Date().toISOString()
    },
    reports: reports.map(report => ({
      searchText: report.searchText,
      language: report.language,
      timestamp: new Date(report.timestamp).toISOString(),
      favorite: report.favorite || false,
      tags: report.tags || [],
      analysis: typeof report.analysisData === 'string' ? report.analysisData : 
                (report.analysisData?.content || 'No analysis available'),
      hasAudio: !!report.audioData
    }))
  };
  
  const filename = getFilteredFilename('youglish-reports', dateStr, filterInfo, 'json');
  downloadFile(
    JSON.stringify(exportData, null, 2),
    filename,
    'application/json'
  );
}

// Generate filename that reflects current filters
function getFilteredFilename(baseName, dateStr, filterInfo, extension) {
  let filename = `${baseName}-${dateStr}`;
  
  // Add filter info to filename if not all reports
  if (filterInfo !== '全部報告') {
    const filterSlug = filterInfo
      .replace(/搜尋: "([^"]+)"/g, 'search-$1')
      .replace(/語言: ([^,]+)/g, 'lang-$1')
      .replace(/僅最愛/g, 'favorites')
      .replace(/[^\w\-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    
    if (filterSlug) {
      filename += `-${filterSlug}`;
    }
  }
  
  return `${filename}.${extension}`;
}

// Helper functions
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function createZipFile(files) {
  // Simple zip creation using the built-in compression
  // For a more robust solution, you'd want to use a library like JSZip
  const zipContent = files.map(file => 
    `=== ${file.filename} ===\n${file.content}\n\n`
  ).join('');
  
  return new Blob([zipContent], { type: 'text/plain' });
}

function convertNotionToCSV(notionData) {
  const headers = Object.keys(notionData.database.properties).join(',');
  const rows = notionData.rows.map(row => {
    return Object.values(row).map(value => {
      if (typeof value === 'string') {
        // Escape quotes and wrap in quotes if contains comma/quotes
        return value.includes(',') || value.includes('"') ? 
               `"${value.replace(/"/g, '""')}"` : value;
      } else if (Array.isArray(value)) {
        return `"${value.join('; ')}"`;
      } else {
        return String(value);
      }
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

// Filter history view based on search and language filters
async function filterHistoryView() {
  const searchQuery = document.getElementById('historySearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('historyLanguageFilter')?.value || '';
  
  console.log('Filtering history:', { searchQuery, languageFilter });
  
  try {
    if (searchQuery) {
      // Use HistoryManager's search functionality
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'searchHistory', 
          query: searchQuery, 
          language: languageFilter || null 
        }, resolve);
      });
      
      if (response && response.success) {
        displayHistoryItems(response.results || []);
      } else {
        console.error('Search failed:', response?.error);
      }
    } else {
      // No search query, load all history and filter by language if needed
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getHistory' }, resolve);
      });
      
      if (response && response.success) {
        let history = response.history || [];
        
        // Apply language filter if specified
        if (languageFilter) {
          history = history.filter(item => item.language === languageFilter);
        }
        
        displayHistoryItems(history);
      }
    }
  } catch (error) {
    console.error('Error filtering history:', error);
  }
}

// Manual search function
function performManualSearch() {
  const manualSearchInput = document.getElementById('manualSearchInput');
  if (!manualSearchInput) {
    console.error('Manual search input not found');
    return;
  }
  
  const text = manualSearchInput.value.trim();
  
  if (!text) {
    alert('請輸入要搜尋的文字');
    return;
  }
  
  console.log('Performing manual search for:', text);
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'manualSearch',
    text: text
  }, (response) => {
    if (response && response.success) {
      manualSearchInput.value = '';
      console.log('Manual search successful');
    } else {
      console.error('Manual search failed:', response?.error);
      alert('搜尋失敗，請稍後再試');
    }
  });
}