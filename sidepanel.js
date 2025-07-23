// 語言名稱映射
const languageNames = {
  'english': '英文',
  'japanese': '日文',
  'korean': '韓文',
  'dutch': '荷蘭文'
};

// Initialize security and performance utils
let securityUtils, performanceUtils, errorHandler;

// Safe logging wrapper
const log = (...args) => {
  if (typeof PerformanceUtils !== 'undefined') {
    PerformanceUtils.log(...args);
  }
};

// Safe error handling wrapper
const handleError = async (error, context = {}) => {
  if (typeof window !== 'undefined' && window.globalErrorHandler) {
    return await window.globalErrorHandler.handleError(error, context);
  }
  console.error('Error:', error);
  return { success: false, error: error.message };
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

// Initialize storage manager and analytics
let storageManager = null;
let learningAnalytics = null;
let studySessionGenerator = null;

// Initialize services when scripts load
window.addEventListener('load', async () => {
  try {
    if (typeof StorageManager !== 'undefined') {
      storageManager = new StorageManager();
    }
    
    // Initialize learning analytics
    if (typeof LearningAnalytics !== 'undefined') {
      learningAnalytics = new LearningAnalytics();
      const initialized = await learningAnalytics.initialize();
      log('Learning Analytics initialized:', initialized);
    }
    
    // Initialize study session generator
    if (learningAnalytics && typeof StudySessionGenerator !== 'undefined') {
      studySessionGenerator = new StudySessionGenerator(learningAnalytics, window.flashcardManager);
      log('Study Session Generator initialized');
    }
    
    log('All services initialized successfully');
    
    // Add global event delegation for CSP-compliant event handling
    document.addEventListener('click', (e) => {
      // Handle audio badges with data-report-id
      const audioBadge = e.target.closest('[data-report-id]');
      if (audioBadge && audioBadge.classList.contains('audio-badge')) {
        e.preventDefault();
        const reportId = audioBadge.getAttribute('data-report-id');
        playReportAudio(reportId);
        return;
      }
      
      // Handle buttons with data-action attributes
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.preventDefault();
        const action = actionBtn.getAttribute('data-action');
        
        // Execute the action function if it exists
        if (typeof window[action] === 'function') {
          window[action]();
        } else if (action.includes('(')) {
          // Handle function calls with parameters (security-limited)
          try {
            // Only allow safe, predefined function calls
            if (action === 'loadAnalyticsView()') {
              loadAnalyticsView();
            }
          } catch (error) {
            console.error('Action execution failed:', error);
          }
        }
        return;
      }
    });
    
  } catch (error) {
    await handleError(error, { operation: 'service_initialization' });
  }
});

// 顯示搜尋結果
function showSearchResult(queryData) {
  log('showSearchResult called with:', queryData);
  
  // Track vocabulary interaction
  if (learningAnalytics && queryData.text && queryData.language) {
    learningAnalytics.recordVocabularyInteraction(
      queryData.text, 
      queryData.language, 
      'lookup', 
      { webpage: window.location.href }
    );
  }
  
  const welcome = document.getElementById('welcome');
  const searchInfo = document.getElementById('searchInfo');
  const searchResult = document.getElementById('searchResult');
  const searchTerm = document.getElementById('searchTerm');
  const searchLanguage = document.getElementById('searchLanguage');
  const languageBadge = document.getElementById('languageBadge');
  const openInNewTabBtn = document.getElementById('openInNewTabBtn');
  
  log('Elements found:', {
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
  const flashcardsView = document.getElementById('flashcardsView');
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
  if (flashcardsView) flashcardsView.style.display = 'none';
  
  // 設定分析按鈕為活動狀態
  document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
  if (showAnalysisBtn) showAnalysisBtn.classList.add('active');
  
  log('Analysis view set as default active view');
  
  // 載入多個發音網站選項
  loadPronunciationSites(queryData);
  
  // 只對新查詢觸發自動分析和發音 (如果啟用且服務可用)
  if (isNewQuery && queryData.autoAnalysis) {
    setTimeout(async () => {
      try {
        log('Auto-analysis requested for:', queryData.text);
        
        // Ensure aiService is initialized first
        if (typeof aiService !== 'undefined' && aiService && !aiService.isInitialized) {
          log('Initializing AI service for auto-generation...');
          await aiService.initialize();
        }
        
        if (typeof generateAIAnalysis === 'function' && typeof aiService !== 'undefined' && aiService) {
          // Auto-generate AI analysis
          generateAIAnalysis().catch(err => log('Auto-analysis failed quietly:', err));
          
          // Auto-generate and cache audio for future flashcard use
          setTimeout(async () => {
            if (currentQueryData.text && currentQueryData.language) {
              try {
                log('🔊 Auto-generating and caching audio for:', currentQueryData.text);
                // Try OpenAI TTS first (just cache, don't play)
                const audioData = await generateOpenAIAudio(
                  currentQueryData.text, 
                  currentQueryData.language, 
                  false // Don't play immediately, just cache
                );
                
                if (audioData) {
                  log('✅ Audio cached for future flashcard use');
                } else if (aiService && aiService.isAudioAvailable && aiService.isAudioAvailable()) {
                  // Fallback to original audio generation
                  log('⚠️ OpenAI TTS not available, using fallback audio generation');
                  generateAudioPronunciation().catch(err => log('Auto-audio failed quietly:', err));
                } else {
                  log('Auto-audio skipped: no audio service available');
                }
              } catch (error) {
                log('Auto-audio caching failed:', error);
                // Fallback to original method if available
                if (aiService && aiService.isAudioAvailable && aiService.isAudioAvailable()) {
                  generateAudioPronunciation().catch(err => log('Auto-audio failed quietly:', err));
                }
              }
            }
          }, 3000); // 3 second delay to let AI analysis finish first
          
        } else {
          log('Auto-generation skipped: AI service not available or not initialized');
          log('Debug info:', {
            generateAIAnalysisExists: typeof generateAIAnalysis === 'function',
            aiServiceExists: typeof aiService !== 'undefined',
            aiServiceValue: !!aiService,
            isInitialized: aiService?.isInitialized
          });
        }
      } catch (error) {
        log('Auto-analysis error (non-blocking):', error);
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
  const showSavedReportsBtn = document.getElementById('showSavedReportsBtn');
  const showFlashcardsBtn = document.getElementById('showFlashcardsBtn');
  const showAnalyticsBtn = document.getElementById('showAnalyticsBtn');
  const openNewTabBtn = document.getElementById('openNewTabBtn');
  const analysisView = document.getElementById('analysisView');
  const videoView = document.getElementById('videoView');
  const historyView = document.getElementById('historyView');
  const savedReportsView = document.getElementById('savedReportsView');
  const flashcardsView = document.getElementById('flashcardsView');
  const analyticsView = document.getElementById('analyticsView');
  
  // 分析視圖按鈕
  if (showAnalysisBtn) {
    showAnalysisBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showAnalysisBtn.classList.add('active');
      
      // Show analysis view, hide all others
      if (analysisView) analysisView.style.display = 'block';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      if (analyticsView) analyticsView.style.display = 'none';
      
      log('Switched to analysis view');
    };
  }
  
  // 影片視圖按鈕
  if (showVideoBtn) {
    showVideoBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showVideoBtn.classList.add('active');
      
      // Show video view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'block';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      if (analyticsView) analyticsView.style.display = 'none';
      
      log('Switched to video view');
    };
  }
  
  // 歷史記錄視圖按鈕
  if (showHistoryBtn) {
    showHistoryBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showHistoryBtn.classList.add('active');
      
      // Show history view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'block';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      if (analyticsView) analyticsView.style.display = 'none';
      
      loadHistoryView();
      console.log('Switched to history view');
    };
  }
  
  // 已保存報告視圖按鈕
  if (showSavedReportsBtn) {
    showSavedReportsBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showSavedReportsBtn.classList.add('active');
      
      // Show saved reports view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'block';
      if (flashcardsView) flashcardsView.style.display = 'none';
      if (analyticsView) analyticsView.style.display = 'none';
      
      loadSavedReports();
      console.log('Switched to saved reports view');
    };
  }
  
  // 記憶卡視圖按鈕
  if (showFlashcardsBtn) {
    showFlashcardsBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showFlashcardsBtn.classList.add('active');
      
      // Show flashcards view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (analyticsView) analyticsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'block';
      
      loadFlashcardsView();
      console.log('Switched to flashcards view');
    };
  }

  // Analytics view button
  if (showAnalyticsBtn) {
    showAnalyticsBtn.onclick = async () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showAnalyticsBtn.classList.add('active');
      
      // Show analytics view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      if (analyticsView) analyticsView.style.display = 'block';
      
      await loadAnalyticsView();
      console.log('Switched to analytics view');
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
  // Clear content safely
  if (pronunciationOptions) {
    while (pronunciationOptions.firstChild) {
      pronunciationOptions.removeChild(pronunciationOptions.firstChild);
    }
  }
  if (siteDescriptions) {
    while (siteDescriptions.firstChild) {
      siteDescriptions.removeChild(siteDescriptions.firstChild);
    }
  }
  
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
    // Use SecurityUtils for safe DOM manipulation
    if (window.SecurityFixes) {
      window.SecurityFixes.safeClearElement(categoryHeader);
      const h4 = window.SecurityFixes.safeCreateElement('h4', category.name);
      const span = window.SecurityFixes.safeCreateElement('span', `${category.sites.length} 個網站`, 'category-count');
      categoryHeader.appendChild(h4);
      categoryHeader.appendChild(span);
    } else {
      categoryHeader.innerHTML = `
        <h4>${category.name}</h4>
        <span class="category-count">${category.sites.length} 個網站</span>
      `;
    }
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
      
      // Use SecurityUtils for safe DOM manipulation
      if (window.SecurityFixes) {
        window.SecurityFixes.safeClearElement(option);
        
        const infoDiv = window.SecurityFixes.safeCreateElement('div', '', 'option-info');
        const iconSpan = window.SecurityFixes.safeCreateElement('span', site.icon, 'option-icon');
        const detailsDiv = window.SecurityFixes.safeCreateElement('div', '', 'option-details');
        const nameH5 = window.SecurityFixes.safeCreateElement('h5', site.name);
        const descP = window.SecurityFixes.safeCreateElement('p', site.description);
        
        detailsDiv.appendChild(nameH5);
        detailsDiv.appendChild(descP);
        infoDiv.appendChild(iconSpan);
        infoDiv.appendChild(detailsDiv);
        
        const actionDiv = window.SecurityFixes.safeCreateElement('div', '');
        const badgeSpan = window.SecurityFixes.safeCreateElement('span', badgeText, `option-badge ${badgeClass}`);
        const button = window.SecurityFixes.safeCreateElement('button', '開啟', 'option-button');
        button.setAttribute('data-url', site.url);
        
        actionDiv.appendChild(badgeSpan);
        actionDiv.appendChild(button);
        option.appendChild(infoDiv);
        option.appendChild(actionDiv);
      } else {
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
      }
      
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
      // Use SecurityUtils for safe text content
      if (window.SecurityFixes) {
        window.SecurityFixes.safeClearElement(li);
        const strong = window.SecurityFixes.safeCreateElement('strong', config.name);
        const description = document.createTextNode(`: ${config.longDescription || config.description}`);
        li.appendChild(strong);
        li.appendChild(description);
      } else {
        li.innerHTML = `<strong>${config.name}</strong>: ${config.longDescription || config.description}`;
      }
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
        icon: '🎬',
        description: '影視劇日語發音',
        longDescription: '從電影和電視劇中查找日語詞彙的真實發音和使用情境',
        category: 'pronunciation'
      },
      {
        name: 'Immersion Kit',
        icon: '🎌',
        description: '日語動漫例句',
        longDescription: '從日語動漫、電影中提取真實的日語例句和發音',
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
  
  // Handle language-specific URLs
  if (siteName === 'PlayPhrase.me') {
    // Language-specific PlayPhrase.me URLs
    const languageMap = {
      'japanese': 'ja',
      'korean': 'ko',
      'dutch': 'nl',
      'english': 'en'
    };
    
    const langCode = languageMap[language];
    if (langCode && langCode !== 'en') {
      return `https://www.playphrase.me/#/search?q=${encodedText}&language=${langCode}`;
    }
    
    // Default English PlayPhrase.me (no language parameter needed)
    return `https://www.playphrase.me/#/search?q=${encodedText}`;
  }
  
  if (siteName === 'Immersion Kit') {
    // Japanese sentence examples from anime/movies
    return `https://www.immersionkit.com/dictionary?keyword=${encodedText}`;
  }
  
  if (siteName === 'Reverso Context') {
    // Language-specific Reverso Context
    const reverseLangMap = {
      'english': 'english-chinese',
      'japanese': 'japanese-chinese', 
      'korean': 'korean-chinese',
      'dutch': 'dutch-chinese'
    };
    const reverseLang = reverseLangMap[language] || 'english-chinese';
    return `https://context.reverso.net/translation/${reverseLang}/${encodedText}`;
  }
  
  if (siteName === 'Papago') {
    // Language-specific Papago
    const papagoLangMap = {
      'english': '?sk=en&tk=zh-TW',
      'japanese': '?sk=ja&tk=zh-TW',
      'korean': '?sk=ko&tk=zh-TW',
      'dutch': '?sk=nl&tk=zh-TW'
    };
    const papagoLang = papagoLangMap[language] || '?sk=en&tk=zh-TW';
    return `https://papago.naver.com/${papagoLang}&st=${encodedText}`;
  }
  
  if (siteName === 'Google 搜尋') {
    // Language-specific Google search
    const searchTerms = {
      'english': `${encodedText}+pronunciation`,
      'japanese': `${encodedText}+発音+読み方`,
      'korean': `${encodedText}+발음`,
      'dutch': `${encodedText}+uitspraak`
    };
    const searchTerm = searchTerms[language] || `${encodedText}+pronunciation`;
    return `https://www.google.com/search?q=${searchTerm}`;
  }
  
  // Default URL mapping
  const urlMaps = {
    'YouGlish': `https://youglish.com/pronounce/${encodedText}/${language}`,
    'Forvo': `https://forvo.com/word/${encodedText}/`,
    'Cambridge Dictionary': `https://dictionary.cambridge.org/dictionary/english/${encodedText}`,
    'Thesaurus.com': `https://www.thesaurus.com/browse/${encodedText}`,
    'Urban Dictionary': `https://www.urbandictionary.com/define.php?term=${encodedText}`,
    'Ludwig': `https://ludwig.guru/s/${encodedText}`,
    'Jisho.org': `https://jisho.org/search/${encodedText}`,
    'Tatoeba': `https://tatoeba.org/en/sentences/search?query=${encodedText}`,
    'HiNative': `https://hinative.com/questions?search=${encodedText}`,
    'Van Dale': `https://www.vandale.nl/gratis-woordenboek/nederlands/betekenis/${encodedText}`,
    'Linguee': `https://www.linguee.com/english-dutch/search?source=dutch&query=${encodedText}`,
    'Naver Dictionary': `https://en.dict.naver.com/#/search?query=${encodedText}`
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
  
  log('Loading history view...');
  
  try {
    // Use chrome.runtime.sendMessage to get history from background script's HistoryManager
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getHistory' }, resolve);
    });
    
    if (response && response.success) {
      const history = response.history || [];
      log('Loaded history from HistoryManager:', history.length, 'items');
      
      if (history.length === 0) {
        // Show empty state
        if (historyContainer) {
          if (window.SecurityFixes) {
            window.SecurityFixes.safeClearElement(historyContainer);
          } else {
            historyContainer.innerHTML = '';
          }
        }
        if (historyEmpty) historyEmpty.style.display = 'block';
        if (historyStats) {
          if (window.SecurityFixes) {
            window.SecurityFixes.safeUpdateStats(historyStats, '📊 沒有搜尋記錄');
          } else {
            historyStats.innerHTML = '<p>📊 沒有搜尋記錄</p>';
          }
        }
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
        if (window.SecurityFixes) {
          window.SecurityFixes.safeUpdateStats(historyStats, statsText);
        } else {
          historyStats.innerHTML = `<p>${statsText}</p>`;
        }
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
    
    log('Found queries:', queries.length);
    displayHistoryItems(queries);
  });
}

// Extract display logic into separate function
function displayHistoryItems(queries) {
  const historyContainer = document.getElementById('historyList');
  if (!historyContainer) return;
  
  // 清空容器
  if (window.SecurityFixes) {
    window.SecurityFixes.safeClearElement(historyContainer);
  } else {
    historyContainer.innerHTML = '';
  }
  
  if (queries.length === 0) {
    if (window.SecurityFixes) {
      const emptyDiv = window.SecurityFixes.safeCreateElement('div', '', 'history-empty');
      const p1 = window.SecurityFixes.safeCreateElement('p', '📝 沒有搜尋歷史');
      const p2 = window.SecurityFixes.safeCreateElement('p', '開始搜尋單字或短語來建立學習記錄！');
      p2.style.color = '#666';
      p2.style.fontSize = '12px';
      emptyDiv.appendChild(p1);
      emptyDiv.appendChild(p2);
      historyContainer.appendChild(emptyDiv);
    } else {
      historyContainer.innerHTML = '<div class="history-empty"><p>📝 沒有搜尋歷史</p><p style="color: #666; font-size: 12px;">開始搜尋單字或短語來建立學習記錄！</p></div>';
    }
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
    
    // Create history item using SecurityUtils
    if (window.SecurityFixes) {
      window.SecurityFixes.safeCreateHistoryItem(item, {
        text: query.text || 'Unknown',
        language: languageNames[query.language] || query.language || 'Unknown',
        timestamp: query.timestamp,
        queryCount: queryCount,
        detectionMethod: detectionMethod,
        websitesUsed: websitesUsed,
        id: query.id
      });
    } else {
      // Fallback to innerHTML (unsafe)
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
    }
    
    historyContainer.appendChild(item);
    
    // Add event listeners
    const replayButton = item.querySelector('.history-action-btn.replay');
    const deleteButton = item.querySelector('.history-action-btn.delete');
    
    if (replayButton) {
      replayButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = replayButton.dataset.text;
        const language = replayButton.dataset.language;
        console.log('Replaying query:', { text, language });
        if (text && language) {
          await replayQuery(text, language);
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
    item.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('history-action-btn')) {
        const text = query.text;
        const language = query.language;
        if (text && language) {
          await replayQuery(text, language);
        }
      }
    });
  });
  
  console.log(`Displayed ${queries.length} history items`);
}

// 重播查詢
async function replayQuery(text, language, url) {
  console.log('Replaying query:', { text, language, url });
  
  // If no URL, create a default YouGlish URL
  if (!url) {
    url = `https://youglish.com/pronounce/${encodeURIComponent(text)}/${language}`;
  }
  
  // Check for existing AI analysis first
  let existingAnalysis = null;
  let autoAnalysis = true;
  
  try {
    if (storageManager) {
      const reports = await storageManager.getAIReports({
        language: language,
        searchText: text
      });
      
      // Find exact match for the text and language
      const exactMatch = reports.find(report => 
        report.searchText.toLowerCase() === text.toLowerCase() && 
        report.language === language
      );
      
      if (exactMatch && exactMatch.analysisData) {
        console.log('Found existing AI analysis for replay:', exactMatch.id);
        existingAnalysis = exactMatch.analysisData;
        autoAnalysis = false; // Don't generate new analysis
      }
    }
  } catch (error) {
    console.error('Error checking for existing analysis:', error);
    // Continue with new analysis on error
  }
  
  // Create query data object
  const queryData = {
    text: text,
    language: language,
    primaryUrl: url,
    secondaryUrl: '',
    tertiaryUrl: '',
    allUrls: { 'YouGlish': url },
    autoAnalysis: autoAnalysis
  };
  
  // Set current AI analysis if we found one
  if (existingAnalysis) {
    currentAIAnalysis = existingAnalysis;
  }
  
  // Show the search result
  showSearchResult(queryData);
  
  // If we have existing analysis, show it immediately
  if (existingAnalysis) {
    console.log('Displaying cached AI analysis for replay');
    showAIResult(existingAnalysis);
  }
  
  // Switch to analysis view by default (instead of video view)
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  if (showAnalysisBtn) {
    showAnalysisBtn.click();
  }
}

// 開啟設定頁面
function openSettings() {
  showSettingsDialog();
}

// Show settings dialog for TTS configuration
function showSettingsDialog() {
  // Create modal dialog
  const dialog = document.createElement('div');
  dialog.id = 'settingsDialog';
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  dialog.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <h3 style="margin-top: 0; color: #1976d2;">🔧 語音設定</h3>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">
          OpenAI API Key (可選 - 提供更自然的語音)
        </label>
        <input 
          type="password" 
          id="openaiApiKeyInput" 
          placeholder="sk-..." 
          style="
            width: 100%; 
            padding: 8px 12px; 
            border: 1px solid #ddd; 
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          "
        >
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          提供 OpenAI API Key 將使用更自然的語音合成。留空則使用瀏覽器內建語音。
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin-bottom: 8px;">🎯 語音品質對比</h4>
        <div style="font-size: 14px; line-height: 1.4;">
          • <strong>瀏覽器語音</strong>：免費，機械感較重<br>
          • <strong>OpenAI 語音</strong>：自然流暢，支援多語言，需要 API key
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancelSettingsBtn" style="
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        ">取消</button>
        <button id="saveSettingsBtn" style="
          padding: 8px 16px;
          background: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">儲存</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Load current API key
  loadCurrentApiKey();

  // Add event listeners
  document.getElementById('cancelSettingsBtn').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('openaiApiKeyInput').value.trim();
    
    try {
      // Save to Chrome storage
      await new Promise((resolve) => {
        chrome.storage.sync.set({ openaiApiKey: apiKey }, resolve);
      });
      
      showMessage(apiKey ? 'OpenAI API Key 已儲存' : 'API Key 已清除，將使用瀏覽器語音', 'success');
      document.body.removeChild(dialog);
    } catch (error) {
      console.error('Failed to save API key:', error);
      showMessage('儲存失敗', 'error');
    }
  });

  // Close on outside click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog);
    }
  });
}

// Load current API key into the input
async function loadCurrentApiKey() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['openaiApiKey'], resolve);
    });
    
    const input = document.getElementById('openaiApiKeyInput');
    if (input && result.openaiApiKey) {
      input.value = result.openaiApiKey;
    }
  } catch (error) {
    console.error('Failed to load API key:', error);
  }
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
    // 立即顯示快速搜索結果
    await showQuickSearchResults(currentQueryData.text, currentQueryData.language);
    
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
        // Get cached audio data if available
        const cachedAudio = getCachedAudio(currentQueryData.text, currentQueryData.language);
        const audioData = cachedAudio ? {
          audioUrl: cachedAudio.audioUrl,
          size: cachedAudio.size,
          voice: cachedAudio.voice || 'OpenAI TTS'
        } : null;
        
        await storageManager.saveAIReport(
          currentQueryData.text,
          currentQueryData.language,
          analysis,
          audioData // Include cached audio data
        );
        
        if (audioData) {
          console.log('🎯 AI report auto-saved with cached audio:', Math.round(audioData.size / 1024), 'KB');
        } else {
          console.log('AI analysis report saved automatically (no audio)');
        }
      } catch (error) {
        const result = await handleError(error, { operation: 'save_ai_report', context: 'auto_save' });
        log('Failed to save AI report:', result.success ? 'recovered' : error.message);
      }
    } else if (!autoSaveEnabled) {
      console.log('Auto-save is disabled, not saving AI report');
    }
    
  } catch (error) {
    const result = await handleError(error, { 
      operation: 'ai_analysis',
      context: 'generate_analysis',
      retry: () => generateAIAnalysis(forceRefresh),
      cacheKey: `ai_analysis_${currentQueryData.text}_${currentQueryData.language}`
    });
    
    if (result.success && result.data) {
      // Use cached or recovered data
      showAIAnalysis(result.data);
    } else {
      log('AI 分析失敗:', error.message);
      showAIError(`分析失敗: ${error.message}`);
    }
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
  const quickSearch = document.getElementById('quickSearchResults');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'block';
  if (result) result.style.display = 'none';
  // Keep quick search results visible during AI loading
  if (quickSearch) quickSearch.style.display = 'block';
}

// 顯示 AI 分析結果
function showAIResult(analysis) {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  const quickSearch = document.getElementById('quickSearchResults');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (quickSearch) quickSearch.style.display = 'none'; // Hide quick search when full analysis is ready
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
    
    // Use SecurityUtils for safe content display
    if (window.SecurityFixes && typeof displayContent === 'string') {
      window.SecurityFixes.safeSetHTML(result, displayContent);
    } else {
      result.innerHTML = displayContent;
    }
    log('AI analysis displayed:', typeof analysis, analysis);
    
    // Also show the audio section when analysis is displayed
    const audioSection = document.getElementById('aiAudioSection');
    log('Checking audio section visibility:', {
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
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, 'AI 服務載入中...', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">AI 服務載入中...</div>';
            }
          } else if (!aiService.isInitialized) {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, 'AI 服務初始化中...', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">AI 服務初始化中...</div>';
            }
          } else if (!aiService.isAvailable()) {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, '請先在設定頁面配置 API 金鑰', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">請先在設定頁面配置 API 金鑰</div>';
            }
          } else if (aiService.settings?.provider !== 'openai') {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, '語音功能需要 OpenAI API', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">語音功能需要 OpenAI API</div>';
            }
          } else {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, '語音功能未啟用', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">語音功能未啟用</div>';
            }
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
    if (window.SecurityFixes) {
      window.SecurityFixes.safeClearElement(result);
      const errorDiv = window.SecurityFixes.safeCreateElement('div', `❌ ${message}`, 'ai-error');
      result.appendChild(errorDiv);
    } else {
      result.innerHTML = `<div class="ai-error">❌ ${message}</div>`;
    }
  }
}

// Quick Search Results Functions
async function showQuickSearchResults(text, language) {
  const quickSearchDiv = document.getElementById('quickSearchResults');
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  
  if (!quickSearchDiv) return;
  
  // Hide placeholder and show quick search results
  if (placeholder) placeholder.style.display = 'none';
  quickSearchDiv.style.display = 'block';
  
  // Start loading quick results immediately
  populateQuickSearchResults(text, language);
}

async function populateQuickSearchResults(text, language) {
  const translationDiv = document.getElementById('quickTranslation');
  const pronunciationDiv = document.getElementById('quickPronunciation');
  const definitionDiv = document.getElementById('quickDefinition');
  
  // Show loading state
  if (translationDiv) translationDiv.textContent = '載入中...';
  if (pronunciationDiv) pronunciationDiv.textContent = '載入中...';
  if (definitionDiv) definitionDiv.textContent = '載入中...';
  
  try {
    // Get quick translation (Traditional Chinese)
    const translation = await getQuickTranslation(text, language);
    if (translationDiv) {
      translationDiv.textContent = translation || '無法取得翻譯';
    }
    
    // Get pronunciation guide
    const pronunciation = await getQuickPronunciation(text, language);
    if (pronunciationDiv) {
      pronunciationDiv.textContent = pronunciation || '無法取得發音';
    }
    
    // Get basic definition
    const definition = await getQuickDefinition(text, language);
    if (definitionDiv) {
      definitionDiv.textContent = definition || '無法取得定義';
    }
    
  } catch (error) {
    console.error('Error loading quick search results:', error);
    
    // Show error state
    if (translationDiv) translationDiv.textContent = '載入失敗';
    if (pronunciationDiv) pronunciationDiv.textContent = '載入失敗';
    if (definitionDiv) definitionDiv.textContent = '載入失敗';
  }
}

// Quick translation using real translation APIs
async function getQuickTranslation(text, language) {
  try {
    // Try multiple translation services
    let translation = null;
    
    // First try: Google Translate API (free tier)
    translation = await getGoogleTranslation(text, language);
    if (translation) return translation;
    
    // Second try: Microsoft Translator (backup)
    translation = await getMicrosoftTranslation(text, language);
    if (translation) return translation;
    
    // Third try: Built-in dictionary for common words
    if (language === 'english') {
      translation = await getBuiltInTranslation(text);
      if (translation) return translation;
    }
    
    // Last resort: Basic language info
    const langNames = {
      'english': '英語詞彙',
      'japanese': '日語詞彙', 
      'korean': '韓語詞彙',
      'dutch': '荷蘭語詞彙'
    };
    
    return `${langNames[language] || '外語詞彙'} - 正在查詢翻譯...`;
    
  } catch (error) {
    console.error('Quick translation error:', error);
    return '翻譯服務暫時無法使用';
  }
}

// Google Translate API (using public endpoint)
async function getGoogleTranslation(text, fromLang) {
  try {
    // Map our language codes to Google's
    const langMap = {
      'english': 'en',
      'japanese': 'ja', 
      'korean': 'ko',
      'dutch': 'nl'
    };
    
    const sourceLang = langMap[fromLang] || 'auto';
    const targetLang = 'zh-TW'; // Traditional Chinese
    
    // Use Google Translate's public API endpoint
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Google Translate API failed');
    
    const data = await response.json();
    
    // Parse Google Translate response
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      const translatedText = data[0][0][0];
      return translatedText;
    }
    
    return null;
  } catch (error) {
    console.error('Google translation failed:', error);
    return null;
  }
}

// Microsoft Translator (backup service)
async function getMicrosoftTranslation(text, fromLang) {
  try {
    // Map languages for Microsoft Translator
    const langMap = {
      'english': 'en',
      'japanese': 'ja',
      'korean': 'ko', 
      'dutch': 'nl'
    };
    
    const sourceLang = langMap[fromLang] || 'en';
    
    // Use Microsoft Translator's public endpoint (no key required for basic usage)
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sourceLang}&to=zh-Hant`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ text: text }])
    });
    
    if (!response.ok) throw new Error('Microsoft Translator failed');
    
    const data = await response.json();
    
    if (data && data[0] && data[0].translations && data[0].translations[0]) {
      return data[0].translations[0].text;
    }
    
    return null;
  } catch (error) {
    console.error('Microsoft translation failed:', error);
    return null;
  }
}

// Get pronunciation guide
async function getQuickPronunciation(text, language) {
  try {
    if (language === 'english') {
      // Try to provide basic IPA or pronunciation guide
      const pronunciation = await getBasicPronunciation(text);
      if (pronunciation) return pronunciation;
      
      // Fallback: simple phonetic guide
      return `/${text.toLowerCase()}/`;
    } else if (language === 'japanese') {
      return '假名読み方を確認してください';
    } else if (language === 'korean') {
      return '한글 발음을 확인해주세요';
    } else if (language === 'dutch') {
      return 'Nederlandse uitspraak';
    }
    
    return '發音資訊需要完整分析';
  } catch (error) {
    console.error('Quick pronunciation error:', error);
    return '發音資訊載入失敗';
  }
}

// Get basic definition using free dictionary APIs
async function getQuickDefinition(text, language) {
  try {
    if (language === 'english') {
      // Try to get real English definition
      let definition = await getFreeDictionaryDefinition(text);
      if (definition) return definition;
      
      // Fallback to built-in dictionary
      definition = await getBuiltInDefinition(text);
      if (definition) return definition;
    }
    
    // For other languages, try to get basic info
    const langNames = {
      'english': '英語單字',
      'japanese': '日語詞彙',
      'korean': '韓語詞彙', 
      'dutch': '荷蘭語詞彙'
    };
    
    return `${langNames[language] || '外語詞彙'} - 等待完整 AI 分析取得詳細定義`;
  } catch (error) {
    console.error('Quick definition error:', error);
    return '定義載入中...';
  }
}

// Get definition from Free Dictionary API
async function getFreeDictionaryDefinition(word) {
  try {
    // Use the free dictionary API
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Dictionary API failed');
    
    const data = await response.json();
    
    if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
      const meaning = data[0].meanings[0];
      const partOfSpeech = meaning.partOfSpeech || '';
      const definition = meaning.definitions && meaning.definitions[0] && meaning.definitions[0].definition;
      
      if (definition) {
        // Return simplified definition in Traditional Chinese where possible
        let result = `(${partOfSpeech}) ${definition}`;
        
        // Limit length for quick display
        if (result.length > 100) {
          result = result.substring(0, 97) + '...';
        }
        
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Free dictionary lookup failed:', error);
    return null;
  }
}

// Built-in translation database (expanded common words)
async function getBuiltInTranslation(word) {
  const basicTranslations = {
    // Greetings & Basic
    'hello': '你好',
    'hi': '嗨',
    'bye': '再見',
    'goodbye': '再見',
    'thanks': '謝謝',
    'thank': '謝謝',
    'please': '請',
    'sorry': '抱歉',
    'excuse': '藉口',
    'yes': '是',
    'no': '否',
    
    // Common Verbs
    'have': '有',
    'do': '做',
    'go': '去',
    'come': '來',
    'see': '看見',
    'get': '得到',
    'make': '製作',
    'take': '拿取',
    'give': '給予',
    'think': '思考',
    'know': '知道',
    'feel': '感覺',
    'want': '想要',
    'need': '需要',
    'like': '喜歡',
    'love': '愛',
    'eat': '吃',
    'drink': '喝',
    'sleep': '睡覺',
    'work': '工作',
    'study': '學習',
    'play': '玩耍',
    'read': '閱讀',
    'write': '寫',
    'speak': '說話',
    'listen': '聽',
    'walk': '走路',
    'run': '跑步',
    'sit': '坐',
    'stand': '站',
    
    // Common Nouns
    'world': '世界',
    'people': '人們',
    'person': '人',
    'man': '男人',
    'woman': '女人',
    'child': '孩子',
    'family': '家庭',
    'friend': '朋友',
    'home': '家',
    'house': '房子',
    'school': '學校',
    'work': '工作',
    'office': '辦公室',
    'car': '汽車',
    'food': '食物',
    'water': '水',
    'money': '錢',
    'book': '書',
    'computer': '電腦',
    'phone': '電話',
    'music': '音樂',
    'movie': '電影',
    
    // Time
    'time': '時間',
    'day': '日子',
    'night': '夜晚',
    'morning': '早晨',
    'afternoon': '下午',
    'evening': '晚上',
    'today': '今天',
    'tomorrow': '明天',
    'yesterday': '昨天',
    'week': '星期',
    'month': '月',
    'year': '年',
    
    // Adjectives
    'good': '好的',
    'bad': '壞的',
    'big': '大的',
    'small': '小的',
    'new': '新的',
    'old': '舊的',
    'young': '年輕的',
    'happy': '快樂的',
    'sad': '悲傷的',
    'beautiful': '美麗的',
    'ugly': '醜陋的',
    'hot': '熱的',
    'cold': '冷的',
    'easy': '容易的',
    'difficult': '困難的',
    'hard': '困難的',
    'important': '重要的',
    'interesting': '有趣的',
    'boring': '無聊的',
    'fun': '有趣的',
    'great': '很棒的',
    'wonderful': '很棒的',
    'amazing': '驚人的',
    'awesome': '很棒的',
    
    // Colors
    'red': '紅色',
    'blue': '藍色',
    'green': '綠色',
    'yellow': '黃色',
    'black': '黑色',
    'white': '白色',
    'brown': '棕色',
    'pink': '粉紅色',
    'purple': '紫色',
    'orange': '橙色',
    
    // Numbers
    'one': '一',
    'two': '二',
    'three': '三',
    'four': '四',
    'five': '五',
    'six': '六',
    'seven': '七',
    'eight': '八',
    'nine': '九',
    'ten': '十'
  };
  
  const lowerWord = word.toLowerCase().trim();
  return basicTranslations[lowerWord] || null;
}

// Basic pronunciation for common words
async function getBasicPronunciation(word) {
  const basicPronunciations = {
    'hello': '/həˈloʊ/',
    'world': '/wɜːrld/',
    'good': '/ɡʊd/',
    'beautiful': '/ˈbjuːtɪfəl/',
    'interesting': '/ˈɪntrəstɪŋ/',
    'water': '/ˈwɔːtər/',
    'house': '/haʊs/',
    'school': '/skuːl/',
    'friend': '/frend/',
    'family': '/ˈfæməli/'
  };
  
  const lowerWord = word.toLowerCase().trim();
  return basicPronunciations[lowerWord] || null;
}

// Basic definition for common words  
async function getBuiltInDefinition(word) {
  const basicDefinitions = {
    'hello': '問候語，用於見面時的招呼',
    'world': '地球，世界',
    'good': '好的，良好的',
    'beautiful': '美麗的，漂亮的',
    'interesting': '有趣的，引人入勝的',
    'water': '水，無色無味的液體',
    'house': '房子，住宅',
    'school': '學校，教育機構',
    'friend': '朋友，友人',
    'family': '家庭，家人'
  };
  
  const lowerWord = word.toLowerCase().trim();
  return basicDefinitions[lowerWord] || null;
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
                  ${report.audioData ? `<span class="audio-badge" data-report-id="${report.id}" style="cursor: pointer;" title="點擊播放語音">🔊 語音</span>` : ''}
                </div>
              </div>
              <div class="report-actions">
                <button class="report-action-btn create-flashcard-btn" data-id="${report.id}" title="建立記憶卡">
                  🃏
                </button>
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
                if (window.SecurityFixes) {
                  const badge = window.SecurityFixes.safeCreateElement('span', '⭐ 最愛', 'favorite-badge');
                  reportBadges.appendChild(badge);
                } else {
                  reportBadges.insertAdjacentHTML('beforeend', '<span class="favorite-badge">⭐ 最愛</span>');
                }
              } else if (!newFavoriteState && favoriteBadge) {
                favoriteBadge.remove();
              }
              
              // Track analytics
              if (learningAnalytics) {
                const report = reports.find(r => r.id === reportId);
                if (report) {
                  learningAnalytics.recordVocabularyInteraction(
                    report.searchText,
                    report.language,
                    newFavoriteState ? 'favorite_added' : 'favorite_removed',
                    { from: 'saved_reports' }
                  );
                }
              }
            } catch (error) {
              console.error('Failed to toggle favorite:', error);
            }
          });
        }
        
        // Create flashcard button
        const createFlashcardBtn = item.querySelector('.create-flashcard-btn');
        if (createFlashcardBtn) {
          createFlashcardBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              const report = reports.find(r => r.id === reportId);
              if (report) {
                await createFlashcardFromReport(report);
                showMessage(`已為「${report.searchText}」建立記憶卡！`, 'success');
                
                // Track analytics
                if (learningAnalytics) {
                  learningAnalytics.recordVocabularyInteraction(
                    report.searchText,
                    report.language,
                    'flashcard_creation',
                    { from: 'saved_reports' }
                  );
                }
              }
            } catch (error) {
              console.error('Failed to create flashcard from report:', error);
              if (error.message.includes('already exists')) {
                showMessage(`記憶卡「${report.searchText}」已存在`, 'warning');
              } else {
                showMessage('建立記憶卡失敗', 'error');
              }
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
                  // Track analytics before removing
                  if (learningAnalytics) {
                    const report = reports.find(r => r.id === reportId);
                    if (report) {
                      learningAnalytics.recordVocabularyInteraction(
                        report.searchText,
                        report.language,
                        'report_deleted',
                        { from: 'saved_reports' }
                      );
                    }
                  }
                  
                  item.remove();
                  // Update stats
                  const remaining = reportsList.children.length;
                  if (reportsStats) {
                    if (window.SecurityFixes) {
                      window.SecurityFixes.safeUpdateStats(reportsStats, `📊 總共 ${remaining} 份報告`);
                    } else {
                      reportsStats.innerHTML = `<p>📊 總共 ${remaining} 份報告</p>`;
                    }
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
      // Get cached audio data if available
      const cachedAudio = getCachedAudio(currentQueryData.text, currentQueryData.language);
      const audioData = cachedAudio ? {
        audioUrl: cachedAudio.audioUrl,
        size: cachedAudio.size,
        voice: cachedAudio.voice || 'OpenAI TTS'
      } : null;
      
      await storageManager.saveAIReport(
        currentQueryData.text,
        currentQueryData.language,
        currentAIAnalysis,
        audioData // Include cached audio data
      );
      
      if (audioData) {
        console.log('🎯 AI report saved with cached audio:', Math.round(audioData.size / 1024), 'KB');
      } else {
        console.log('AI analysis report saved manually (no audio)');
      }
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
    
    log('✅ Audio UI created with direct controls');
    
  } else {
    if (!audioContent) {
      log('❌ audioContent element not found');
      return;
    }
    if (!audioData || !audioData.audioUrl) {
      log('❌ Invalid audio data:', audioData);
      if (window.SecurityFixes) {
        window.SecurityFixes.safeUpdateAudioContent(audioContent, '無效的音頻數據', true);
      } else {
        audioContent.innerHTML = '<div class="audio-error">❌ 無效的音頻數據</div>';
      }
    }
  }
}

function showAudioError(message) {
  const audioContent = document.getElementById('audioContent');
  if (audioContent) {
    if (window.SecurityFixes) {
      window.SecurityFixes.safeUpdateAudioContent(audioContent, message, true);
    } else {
      audioContent.innerHTML = `<div class="audio-error">❌ ${message}</div>`;
    }
  }
}

// Play audio from saved report
async function playReportAudio(reportId) {
  try {
    const reports = await storageManager.getAIReports();
    const report = reports.find(r => r.id === reportId);
    
    if (!report || !report.audioData || !report.audioData.audioUrl) {
      showMessage('此報告沒有語音數據', 'warning');
      return;
    }
    
    console.log('🔊 Playing audio from saved report:', report.searchText);
    
    const audio = new Audio(report.audioData.audioUrl);
    
    // Show feedback
    const audioBadge = document.querySelector(`span[data-report-id="${reportId}"]`);
    if (audioBadge) {
      const originalText = audioBadge.textContent;
      audioBadge.textContent = '🔊 播放中...';
      
      audio.onended = () => {
        audioBadge.textContent = originalText;
      };
      
      audio.onerror = () => {
        audioBadge.textContent = originalText;
        showMessage('語音播放失敗', 'error');
      };
    }
    
    await audio.play();
    console.log('✅ Report audio playing:', report.searchText);
    
  } catch (error) {
    console.error('Failed to play report audio:', error);
    showMessage('播放語音失敗', 'error');
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

// Initialize TTS voices
function initializeTTSVoices() {
  if ('speechSynthesis' in window) {
    // Load voices - some browsers need this to be called to populate voices
    speechSynthesis.getVoices();
    
    // Handle voice loading event
    speechSynthesis.addEventListener('voiceschanged', () => {
      const voices = speechSynthesis.getVoices();
      console.log('TTS voices loaded:', voices.length, 'voices available');
      
      // Log available voices for debugging
      voices.forEach((voice, index) => {
        if (voice.lang.startsWith('en') || voice.lang.startsWith('ja') || voice.lang.startsWith('ko') || voice.lang.startsWith('zh') || voice.lang.startsWith('nl')) {
          console.log(`Voice ${index}: ${voice.name} (${voice.lang}) - Local: ${voice.localService}`);
        }
      });
    });
  }
}

// Initialize all buttons and features
document.addEventListener('DOMContentLoaded', () => {
  // Initialize TTS voices
  initializeTTSVoices();
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
  const savedReportsDateFilter = document.getElementById('savedReportsDateFilter');
  const dateRangeInputs = document.getElementById('dateRangeInputs');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
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
  
  if (savedReportsDateFilter) {
    savedReportsDateFilter.addEventListener('change', () => {
      // Show/hide custom date range inputs
      if (savedReportsDateFilter.value === 'custom') {
        dateRangeInputs.style.display = 'block';
      } else {
        dateRangeInputs.style.display = 'none';
      }
      filterSavedReports();
    });
  }
  
  if (startDate) {
    startDate.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  if (endDate) {
    endDate.addEventListener('change', () => {
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

  // Bulk flashcard creation
  const createAllFlashcardsBtn = document.getElementById('createAllFlashcardsBtn');
  if (createAllFlashcardsBtn) {
    createAllFlashcardsBtn.addEventListener('click', async () => {
      await createAllFlashcardsFromReports();
    });
  }

  // Notion sync button
  const syncToNotionBtn = document.getElementById('syncToNotionBtn');
  if (syncToNotionBtn) {
    syncToNotionBtn.addEventListener('click', async () => {
      await syncFilteredReportsToNotion();
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
    'exportNotion': () => exportSavedReports('notion-api'),
    'exportEmail': () => exportSavedReports('email'),
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
        secondaryUrl: result.currentQuery.secondaryUrl || '',
        tertiaryUrl: result.currentQuery.tertiaryUrl || '',
        allUrls: result.currentQuery.allUrls || { 'YouGlish': result.currentQuery.url || result.currentQuery.primaryUrl },
        autoAnalysis: result.currentQuery.autoAnalysis !== false, // Respect the setting from background.js
        analysisOnly: result.currentQuery.analysisOnly // Pass through analysisOnly flag
      };
      
      showSearchResult(queryData);
      log('Loaded current query:', queryData);
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
    showSavedReportsBtn.onclick = () => {
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
    };
  }
});

// Filter saved reports based on search, language, tags, date, and favorites
async function filterSavedReports() {
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const dateFilter = document.getElementById('savedReportsDateFilter')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  console.log('Filtering saved reports:', { searchQuery, languageFilter, tagFilter, dateFilter, startDate, endDate, favoritesOnly });
  
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
    
    // Apply date filtering
    if (dateFilter) {
      const now = new Date();
      let startDateTime, endDateTime;
      
      switch (dateFilter) {
        case 'today':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
          
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
          startOfWeek.setHours(0, 0, 0, 0);
          startDateTime = startOfWeek;
          endDateTime = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
          
        case 'month':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), 1);
          endDateTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
          
        case 'custom':
          if (startDate) {
            startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
          }
          if (endDate) {
            endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
          }
          break;
      }
      
      if (startDateTime || endDateTime) {
        reports = reports.filter(report => {
          if (!report.timestamp) return true; // Keep reports without timestamp
          
          const reportDate = new Date(report.timestamp);
          
          if (startDateTime && reportDate < startDateTime) return false;
          if (endDateTime && reportDate > endDateTime) return false;
          
          return true;
        });
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
              ${report.audioData ? `<span class="audio-badge" data-report-id="${report.id}" style="cursor: pointer;" title="點擊播放語音">🔊 語音</span>` : ''}
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
      case 'notion-api':
        await exportNotionAPI(reports, dateStr, filterInfo);
        break;
      case 'email':
        await exportEmail(reports, dateStr, filterInfo);
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
  const dateFilter = document.getElementById('savedReportsDateFilter')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';
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
    
    // Apply date filtering
    if (dateFilter) {
      const now = new Date();
      let startDateTime, endDateTime;
      
      switch (dateFilter) {
        case 'today':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
          
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
          startOfWeek.setHours(0, 0, 0, 0);
          startDateTime = startOfWeek;
          endDateTime = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
          
        case 'month':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), 1);
          endDateTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
          
        case 'custom':
          if (startDate) {
            startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
          }
          if (endDate) {
            endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
          }
          break;
      }
      
      if (startDateTime || endDateTime) {
        reports = reports.filter(report => {
          if (!report.timestamp) return true; // Keep reports without timestamp
          
          const reportDate = new Date(report.timestamp);
          
          if (startDateTime && reportDate < startDateTime) return false;
          if (endDateTime && reportDate > endDateTime) return false;
          
          return true;
        });
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
  const dateFilter = document.getElementById('savedReportsDateFilter')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';
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
  
  if (dateFilter) {
    switch (dateFilter) {
      case 'today':
        filters.push('日期: 今天');
        break;
      case 'week':
        filters.push('日期: 本週');
        break;
      case 'month':
        filters.push('日期: 本月');
        break;
      case 'custom':
        if (startDate && endDate) {
          filters.push(`日期: ${startDate} 到 ${endDate}`);
        } else if (startDate) {
          filters.push(`日期: 從 ${startDate}`);
        } else if (endDate) {
          filters.push(`日期: 到 ${endDate}`);
        }
        break;
    }
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
  
  const heptabaseMarkdown = ExportTemplates.generateHeptabase(reports, filterInfo);
  const filename = getFilteredFilename('youglish-heptabase-whiteboard', dateStr, filterInfo, 'md');
  
  // Download as a single Markdown file optimized for Heptabase import
  downloadFile(
    heptabaseMarkdown, 
    filename,
    'text/markdown'
  );
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

// Email export - opens email client with vocabulary content
async function exportEmail(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const emailData = ExportTemplates.generateEmail(reports, filterInfo);
  
  // Create mailto link with pre-filled email containing vocabulary
  const encodedSubject = encodeURIComponent(emailData.subject);
  const encodedBody = encodeURIComponent(emailData.body);
  
  // Check if body is too long for mailto (most email clients have ~2000 char limit for URLs)
  if (encodedBody.length > 1800) {
    // If too long, show dialog to choose what to do
    const choice = confirm(
      `📧 Your vocabulary export has ${reports.length} words and is too large for direct email.\n\n` +
      `Click OK to:\n` +
      `• Open email with summary (${reports.length} words)\n` +
      `• Download full export as attachment\n\n` +
      `Click Cancel to:\n` +
      `• Copy vocabulary content to clipboard instead`
    );
    
    if (choice) {
      // Option 1: Try to include as much vocabulary as possible in email
      // Use the actual vocabulary content but trim if needed
      const maxBodyLength = 1500; // Leave some room for encoding
      let trimmedBody = emailData.body;
      
      if (emailData.body.length > maxBodyLength) {
        // Find a good cut-off point (end of a word entry)
        trimmedBody = emailData.body.substring(0, maxBodyLength);
        const lastNewline = trimmedBody.lastIndexOf('\n\n');
        if (lastNewline > 0) {
          trimmedBody = trimmedBody.substring(0, lastNewline);
        }
        trimmedBody += '\n\n... [Content truncated - see attachment for full list] ...\n';
      }
      
      const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodeURIComponent(trimmedBody)}`;
      
      // Download the full content as attachment
      downloadFile(
        emailData.attachment.content,
        emailData.attachment.filename,
        emailData.attachment.type
      );
      
      // Open email client
      window.open(mailtoLink);
      
      showMessage('📧 Email opened with summary. Full vocabulary downloaded as attachment!', 'success');
    } else {
      // Option 2: Copy to clipboard
      navigator.clipboard.writeText(emailData.body).then(() => {
        showMessage('📋 Vocabulary content copied to clipboard! You can paste it into any email.', 'success');
      }).catch(err => {
        // Fallback: download as text file
        downloadFile(emailData.body, 'vocabulary-email-content.txt', 'text/plain');
        showMessage('📄 Vocabulary content downloaded as text file!', 'success');
      });
    }
  } else {
    // Content is short enough for direct email
    const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
    window.open(mailtoLink);
    showMessage('📧 Email opened with your vocabulary content!', 'success');
  }
}

// Notion API export - direct integration with Notion
async function exportNotionAPI(reports, dateStr, filterInfo = '全部報告') {
  if (!window.notionIntegration) {
    window.notionIntegration = new NotionIntegration();
  }

  const notion = window.notionIntegration;
  
  // Check if Notion is configured
  const isConfigured = await notion.initialize();
  
  if (!isConfigured) {
    // Show configuration dialog
    await notion.showConfigDialog();
    
    // Check again after configuration
    const isNowConfigured = await notion.initialize();
    if (!isNowConfigured) {
      showMessage('Notion integration not configured', 'warning');
      return;
    }
  }

  // Show progress dialog
  const progressDialog = document.createElement('div');
  progressDialog.className = 'export-progress-dialog';
  progressDialog.innerHTML = `
    <div class="progress-content">
      <h3>📄 Exporting to Notion...</h3>
      <div class="progress-bar">
        <div class="progress-fill" id="notion-progress-fill" style="width: 0%"></div>
      </div>
      <p id="notion-progress-text">Preparing export...</p>
      <button id="cancel-notion-export" style="display: none;">Cancel</button>
    </div>
  `;
  
  // Add progress dialog styles
  if (!document.getElementById('export-progress-styles')) {
    const styles = document.createElement('style');
    styles.id = 'export-progress-styles';
    styles.textContent = `
      .export-progress-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        padding: 24px;
        z-index: 1001;
        min-width: 300px;
      }
      .progress-content h3 {
        margin: 0 0 16px 0;
        color: #333;
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .progress-fill {
        height: 100%;
        background: #1a73e8;
        transition: width 0.3s ease;
      }
      #notion-progress-text {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 14px;
      }
      #cancel-notion-export {
        background: #f44336;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(styles);
  }
  
  document.body.appendChild(progressDialog);

  try {
    // Update progress
    progressDialog.querySelector('#notion-progress-text').textContent = `Exporting ${reports.length} words to Notion...`;
    
    // Export to Notion
    const results = await notion.exportToNotion(reports);
    
    // Remove progress dialog
    progressDialog.remove();
    
    // Show results
    let message = '';
    if (results.success > 0 && results.failed === 0) {
      message = `✅ Successfully exported ${results.success} words to Notion!`;
      showMessage(message, 'success');
    } else if (results.success > 0 && results.failed > 0) {
      message = `⚠️ Exported ${results.success} words, ${results.failed} failed.\n\nErrors:\n${results.errors.slice(0, 3).join('\n')}`;
      alert(message);
    } else {
      message = `❌ Export failed. ${results.errors[0] || 'Unknown error'}`;
      alert(message);
    }
    
  } catch (error) {
    progressDialog.remove();
    console.error('Notion export failed:', error);
    
    if (error.message.includes('No database selected')) {
      // Show configuration dialog
      await notion.showConfigDialog();
    } else {
      alert(`❌ Export failed: ${error.message}`);
    }
  }
}

// Sync filtered reports to Notion (direct button)
async function syncFilteredReportsToNotion() {
  try {
    // Get currently filtered reports
    const reports = await getCurrentlyFilteredReports();
    
    if (reports.length === 0) {
      showMessage('沒有可同步的報告', 'warning');
      return;
    }

    // Disable button during sync
    const syncBtn = document.getElementById('syncToNotionBtn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = '🔄 同步中...';
    }

    // Use the existing Notion export function
    const dateStr = new Date().toISOString().split('T')[0];
    const filterInfo = getCurrentFilterInfo();
    
    await exportNotionAPI(reports, dateStr, filterInfo);

  } catch (error) {
    console.error('Notion sync failed:', error);
    showMessage('同步到 Notion 失敗', 'error');
  } finally {
    // Re-enable button
    const syncBtn = document.getElementById('syncToNotionBtn');
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = '📄 Sync to Notion';
    }
  }
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

// ================================
// ANALYTICS FUNCTIONALITY  
// ================================

// Load analytics view
async function loadAnalyticsView() {
  if (!learningAnalytics) {
    console.error('Learning analytics not initialized');
    showAnalyticsError();
    return;
  }

  try {
    // Initialize flashcard manager if not already done
    if (!window.flashcardManager) {
      if (typeof FlashcardManager !== 'undefined') {
        window.flashcardManager = new FlashcardManager();
        await window.flashcardManager.initialize();
      }
    }

    // Get analytics data using the correct methods
    const insights = learningAnalytics.getInsights();
    const recommendations = learningAnalytics.generateRecommendations();

    console.log('Analytics insights:', insights);
    console.log('Analytics recommendations:', recommendations);

    // Update UI with statistics
    await updateAnalyticsUI(insights, recommendations);

    // Set up refresh button
    const refreshBtn = document.getElementById('refreshAnalyticsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadAnalyticsView());
    }

    // Set up study plan generation
    const generateStudyBtn = document.getElementById('generateStudyBtn');
    if (generateStudyBtn) {
      generateStudyBtn.addEventListener('click', async () => {
        await generatePersonalizedStudyPlan();
      });
    }

    // Set up analytics detail event listeners (CSP compliant)
    const analyticsView = document.getElementById('analyticsView');
    if (analyticsView) {
      // Event delegation for metric cards with data-detail attribute
      analyticsView.addEventListener('click', (e) => {
        const metricCard = e.target.closest('[data-detail]');
        if (metricCard) {
          const detailType = metricCard.getAttribute('data-detail');
          showAnalyticsDetail(detailType);
        }
        
        // Handle audio badges
        const audioBadge = e.target.closest('[data-report-id]');
        if (audioBadge && audioBadge.classList.contains('audio-badge')) {
          const reportId = audioBadge.getAttribute('data-report-id');
          playReportAudio(reportId);
        }
        
        // Handle data-action buttons
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.getAttribute('data-action');
          if (action === 'loadAnalyticsView') {
            loadAnalyticsView();
          }
          // Add other actions as needed
        }
      });
    }

    console.log('Analytics view loaded successfully');
  } catch (error) {
    console.error('Error loading analytics view:', error);
    showAnalyticsError();
  }
}

// Update analytics UI with data
async function updateAnalyticsUI(insights, recommendations) {
  // Get flashcard statistics for comparison
  let flashcardStats = null;
  if (window.flashcardManager) {
    flashcardStats = window.flashcardManager.getStats();
  }

  // Update metrics with clear descriptions and debug info
  const totalVocab = document.getElementById('totalVocab');
  const currentStreak = document.getElementById('currentStreak');
  const retentionRate = document.getElementById('retentionRate');

  // Debug logging
  console.log('📊 Analytics Debug:', {
    insights,
    flashcardStats,
    vocabularySize: insights.totalVocabulary,
    streakCurrent: insights.currentStreak,
    retentionRate: insights.retentionRate
  });

  if (totalVocab) {
    const vocabCount = flashcardStats ? flashcardStats.totalCards : (insights.totalVocabulary || 0);
    totalVocab.textContent = vocabCount;
    
    // Add detail info
    const detail = document.getElementById('totalVocabDetail');
    if (detail && flashcardStats) {
      detail.innerHTML = `新: ${flashcardStats.newCards} | 學習中: ${flashcardStats.learningCards} | 熟練: ${flashcardStats.reviewCards}`;
    }
  }
  
  if (currentStreak) {
    const streakDays = insights.currentStreak || 0;
    currentStreak.textContent = streakDays;
    
    // Add detail info
    const detail = document.getElementById('streakDetail');
    if (detail) {
      if (streakDays === 0) {
        detail.innerHTML = `還未開始學習記錄`;
      } else {
        detail.innerHTML = `最長紀錄: ${insights.longestStreak || streakDays} 天`;
      }
    }
  }
  
  if (retentionRate) {
    const retention = insights.retentionRate || 0;
    retentionRate.textContent = `${retention}%`;
    
    // Add detail info
    const detail = document.getElementById('retentionDetail');
    if (detail) {
      const totalReviews = getTotalReviewCount();
      if (totalReviews === 0) {
        detail.innerHTML = `還未進行複習`;
      } else {
        detail.innerHTML = `總複習次數: ${totalReviews}`;
      }
    }
  }

  // Add additional flashcard-specific metrics
  if (flashcardStats) {
    updateFlashcardMetrics(flashcardStats);
  }

  // Update recommendations with better formatting
  const recommendationsList = document.getElementById('recommendationsList');
  if (recommendationsList && recommendations && recommendations.length > 0) {
    recommendationsList.innerHTML = recommendations.map(rec => `
      <div class="recommendation-item" style="
        display: flex; 
        align-items: flex-start; 
        margin-bottom: 16px; 
        padding: 16px; 
        background: #f8f9fa; 
        border-radius: 8px;
        border-left: 4px solid ${getPriorityColor(rec.priority)};
      ">
        <div class="recommendation-icon" style="font-size: 24px; margin-right: 12px;">
          ${getRecommendationIcon(rec.type)}
        </div>
        <div class="recommendation-content" style="flex: 1;">
          <h5 style="margin: 0 0 8px 0; color: #333;">${rec.title}</h5>
          <p style="margin: 0; color: #666; line-height: 1.4;">${rec.description}</p>
          ${rec.action ? `
            <button class="recommendation-btn" data-action="${rec.action}" style="
              margin-top: 12px; 
              background: #1976d2; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 4px; 
              cursor: pointer;
              font-size: 14px;
            ">${rec.actionText || '開始行動'}</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } else {
    recommendationsList.innerHTML = `
      <div style="text-align: center; padding: 32px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
        <p>繼續學習以獲得個人化建議！</p>
      </div>
    `;
  }
}

// Get total review count for debugging
function getTotalReviewCount() {
  if (!window.flashcardManager || !window.flashcardManager.flashcards) {
    return 0;
  }
  
  return window.flashcardManager.flashcards.reduce((total, card) => {
    return total + (card.reviews || 0);
  }, 0);
}

// Show detailed analytics information
function showAnalyticsDetail(type) {
  let message = '';
  
  if (type === 'cards') {
    const stats = window.flashcardManager ? window.flashcardManager.getStats() : null;
    if (stats) {
      message = `📊 記憶卡詳情：\n\n` +
                `• 總計: ${stats.totalCards} 張\n` +
                `• 新卡片: ${stats.newCards} 張（未學習過）\n` +
                `• 學習中: ${stats.learningCards} 張（正在學習）\n` +
                `• 熟練: ${stats.reviewCards} 張（已掌握）\n` +
                `• 待複習: ${stats.dueCards} 張（需要複習）`;
    } else {
      message = '還沒有記憶卡數據。請先建立一些記憶卡！';
    }
  } else if (type === 'streak') {
    const analytics = learningAnalytics ? learningAnalytics.getInsights() : null;
    if (analytics) {
      message = `🔥 學習連續天數：\n\n` +
                `• 目前連續: ${analytics.currentStreak} 天\n` +
                `• 最長紀錄: ${analytics.longestStreak} 天\n` +
                `• 學習建議: 每天至少學習幾張卡片保持連續記錄`;
    } else {
      message = '還沒有學習記錄。開始學習記憶卡來累積連續天數！';
    }
  } else if (type === 'retention') {
    const totalReviews = getTotalReviewCount();
    const analytics = learningAnalytics ? learningAnalytics.getInsights() : null;
    
    if (totalReviews === 0) {
      message = '📈 複習答對率：\n\n' +
                '還沒有複習記錄。\n\n' +
                '如何累積數據：\n' +
                '1. 建立記憶卡\n' +
                '2. 點擊「開始學習」\n' +
                '3. 在學習時選擇難易度\n' +
                '4. 完成學習後查看統計';
    } else {
      message = `📈 複習答對率：\n\n` +
                `• 答對率: ${analytics ? analytics.retentionRate : 0}%\n` +
                `• 總複習次數: ${totalReviews}\n` +
                `• 學習會話: ${analytics ? analytics.studySessions : 0} 次`;
    }
  }
  
  alert(message);
}

// Update flashcard-specific metrics
function updateFlashcardMetrics(stats) {
  // Add or update additional metric display
  const analyticsOverview = document.querySelector('.analytics-overview');
  if (analyticsOverview) {
    // Check if we already have additional metrics
    let additionalMetrics = document.getElementById('additionalMetrics');
    if (!additionalMetrics) {
      additionalMetrics = document.createElement('div');
      additionalMetrics.id = 'additionalMetrics';
      analyticsOverview.appendChild(additionalMetrics);
    }
    
    additionalMetrics.innerHTML = `
      <div class="metric-card">
        <span class="metric-value">${stats.dueCards || 0}</span>
        <span class="metric-label">待複習</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${stats.newCards || 0}</span>
        <span class="metric-label">新卡片</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${stats.studyProgress || 0}%</span>
        <span class="metric-label">學習進度</span>
      </div>
    `;
  }
}

// Get priority color for recommendations
function getPriorityColor(priority) {
  const colors = {
    'high': '#f44336',
    'medium': '#ff9800',
    'low': '#4caf50'
  };
  return colors[priority] || '#2196f3';
}

// Get icon for recommendation type
function getRecommendationIcon(type) {
  const icons = {
    'schedule': '📅',
    'review': '🔄',
    'focus': '🎯',
    'motivation': '⭐',
    'study': '📚'
  };
  return icons[type] || '💡';
}

// Show analytics error
function showAnalyticsError() {
  const analyticsView = document.getElementById('analyticsView');
  if (analyticsView) {
    analyticsView.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
        <h3>無法載入學習統計</h3>
        <p>學習分析服務目前無法使用。請稍後再試。</p>
        <button data-action="loadAnalyticsView" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 16px;
        ">重新載入</button>
      </div>
    `;
  }
}

// Generate personalized study plan
async function generatePersonalizedStudyPlan() {
  if (!studySessionGenerator) {
    alert('學習計劃生成器未初始化');
    return;
  }

  try {
    const generateBtn = document.getElementById('generateStudyBtn');
    if (generateBtn) {
      generateBtn.textContent = '⏳ 生成中...';
      generateBtn.disabled = true;
    }

    // Generate optimal study session based on user's learning data
    const studySession = await studySessionGenerator.generateOptimalSession({
      duration: 20, // 20 minutes
      sessionType: 'auto', // Let AI choose the best type
      maxWords: 20,
      difficulty: 'adaptive'
    });

    if (studySession && studySession.words && studySession.words.length > 0) {
      // Display the generated study session info
      alert(`🎯 已生成個人化學習計劃！
      
📊 計劃詳情:
• 類型: ${studySession.config.title}
• 單字數量: ${studySession.words.length} 個
• 預估時間: ${studySession.estimatedDuration} 分鐘
• 說明: ${studySession.config.description}

點擊確定開始學習！`);
      
      // Switch to flashcards view and start study
      document.getElementById('showFlashcardsBtn')?.click();
      setTimeout(() => {
        // Start the study session
        startStudyMode();
      }, 500);
    } else {
      alert('目前沒有足夠的數據生成學習計劃。請先添加一些記憶卡。');
    }

  } catch (error) {
    console.error('Error generating study plan:', error);
    alert('學習計劃生成失敗，請稍後再試。');
  } finally {
    const generateBtn = document.getElementById('generateStudyBtn');
    if (generateBtn) {
      generateBtn.textContent = '📚 智能學習計劃';
      generateBtn.disabled = false;
    }
  }
}

// ================================
// FLASHCARDS FUNCTIONALITY
// ================================

// Initialize flashcard manager
let currentStudySession = null;

// Initialize flashcard system
window.addEventListener('load', async () => {
  try {
    if (typeof FlashcardManager !== 'undefined') {
      window.flashcardManager = new FlashcardManager();
      await window.flashcardManager.initialize();
      console.log('🃏 Flashcard manager initialized with', window.flashcardManager.flashcards.length, 'cards');
    } else {
      console.error('FlashcardManager class not found');
    }
  } catch (error) {
    console.error('Failed to initialize flashcard manager:', error);
  }
});

// Load flashcards view
async function loadFlashcardsView() {
  if (!window.flashcardManager) {
    console.error('Flashcard manager not initialized');
    return;
  }

  const flashcardsView = document.getElementById('flashcardsView');
  const flashcardsList = document.getElementById('flashcardsList');
  const flashcardsEmpty = document.getElementById('flashcardsEmpty');
  
  if (!flashcardsView || !flashcardsList || !flashcardsEmpty) {
    console.error('Flashcard view elements not found');
    return;
  }

  // Update statistics
  await updateFlashcardStats();

  // Load flashcards and sort by creation date (newest first)
  let flashcards = [...window.flashcardManager.flashcards].sort((a, b) => {
    return (b.created || 0) - (a.created || 0);
  });
  console.log('Loading flashcards:', flashcards.length, 'cards found, sorted by newest first');
  
  // Apply difficulty filter
  const difficultyFilter = document.getElementById('difficultyFilter')?.value || 'all';
  if (difficultyFilter !== 'all') {
    flashcards = filterFlashcardsByDifficulty(flashcards, difficultyFilter);
    console.log('After filtering by difficulty:', flashcards.length, 'cards remaining');
  }
  
  if (flashcards.length === 0) {
    // Show empty state
    flashcardsList.style.display = 'none';
    flashcardsEmpty.style.display = 'block';
    
    // Add event listener for create first card button
    const createFirstCardBtn = document.getElementById('createFirstCardBtn');
    if (createFirstCardBtn) {
      createFirstCardBtn.addEventListener('click', () => showCreateFlashcardDialog());
    }
  } else {
    // Show flashcards list
    flashcardsEmpty.style.display = 'none';
    flashcardsList.style.display = 'block';
    displayFlashcardsList(flashcards);
  }

  // Initialize event listeners
  initializeFlashcardEventListeners();
}

// Update flashcard statistics display
async function updateFlashcardStats() {
  if (!flashcardManager) return;

  const stats = window.flashcardManager.getStats();
  
  const totalCards = document.getElementById('totalCards');
  const studyProgress = document.getElementById('studyProgress');
  const todayReviews = document.getElementById('todayReviews');
  
  if (totalCards) totalCards.textContent = `總卡片: ${stats.totalCards}`;
  if (studyProgress) studyProgress.textContent = `學習進度: ${stats.studyProgress}%`;
  if (todayReviews) todayReviews.textContent = `今日複習: ${stats.todayReviews}`;
}

// Display flashcards list
function displayFlashcardsList(flashcards) {
  const flashcardsList = document.getElementById('flashcardsList');
  if (!flashcardsList) {
    console.error('Flashcards list element not found');
    return;
  }

  if (!flashcards || !Array.isArray(flashcards)) {
    console.error('Invalid flashcards data:', flashcards);
    flashcardsList.innerHTML = '<div class="flashcard-item error">無法載入記憶卡數據</div>';
    return;
  }

  console.log('Rendering flashcards:', flashcards.length, 'cards');

  flashcardsList.innerHTML = flashcards.map((card, index) => {
    try {
    const nextReviewDate = new Date(card.nextReview);
    const isOverdue = nextReviewDate.getTime() < Date.now();
    const difficultyLabels = ['新卡片', '學習中', '複習', '熟練'];
    const difficultyClasses = ['new', 'learning', 'review', 'mature'];
    
    // Ensure difficulty is a valid number
    const cardDifficulty = typeof card.difficulty === 'number' ? card.difficulty : 0;
    const safeDifficulty = Math.max(0, Math.min(3, cardDifficulty)); // Clamp between 0-3
    
    const difficultyClass = difficultyClasses[safeDifficulty];
    const difficultyLabel = difficultyLabels[safeDifficulty];
    
    return `
      <div class="flashcard-item" data-id="${card.id}" style="background: #ffffff !important; color: #333333 !important; border: 2px solid #e8e8e8 !important;">
        <div class="card-difficulty ${difficultyClass}">
          ${difficultyLabel}
        </div>
        
        <div class="flashcard-header">
          <div>
            <div class="card-front-text" style="color: #1565c0 !important;">
              ${card.front || 'No front text'}
              <button class="pronunciation-btn" data-id="${card.id}" title="播放發音">
                🔊
              </button>
            </div>
            <div class="card-back-text" style="color: #424242 !important;">${card.back || 'No translation'}</div>
            ${card.pronunciation ? `<div class="card-pronunciation" style="color: #757575 !important;">[${card.pronunciation}]</div>` : ''}
            ${card.definition ? `<div class="card-definition" style="color: #616161 !important;">${card.definition}</div>` : ''}
          </div>
        </div>
        
        <div class="card-meta" style="color: #666666 !important;">
          <span class="card-language">${languageNames[card.language] || card.language || 'unknown'}</span>
          <span class="card-reviews" style="color: #666666 !important;">
            📊 ${card.reviews || 0} 次複習
          </span>
          <span class="card-next-review ${isOverdue ? 'overdue' : ''}" style="color: #666666 !important;">
            ${isOverdue ? '🔴 需要複習' : `📅 ${nextReviewDate.toLocaleDateString()}`}
          </span>
        </div>
        
        ${card.tags && card.tags.length > 0 ? 
          `<div class="card-tags" style="margin-top: 8px;">
            ${card.tags.map(tag => `<span class="tag-chip" style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 8px; font-size: 10px; margin-right: 4px;">#${tag}</span>`).join('')}
          </div>` : ''
        }
        
        <div class="flashcard-actions">
          <button class="card-action-btn study" data-id="${card.id}" title="學習這張卡片">
            🎯 學習
          </button>
          <button class="card-action-btn edit" data-id="${card.id}" title="編輯卡片">
            ✏️ 編輯
          </button>
          <button class="card-action-btn delete" data-id="${card.id}" title="刪除卡片">
            🗑️ 刪除
          </button>
        </div>
        
        <div class="flashcard-progress-indicator">
          <div class="progress-bar-fill ${difficultyClass}"></div>
        </div>
      </div>
    `;
    } catch (error) {
      console.error(`Error rendering flashcard ${index}:`, error, card);
      return `<div class="flashcard-item error">Error rendering card: ${error.message}</div>`;
    }
  }).join('');

  // Add event listeners to card action buttons
  addFlashcardItemEventListeners();
}

// Filter flashcards by difficulty
function filterFlashcardsByDifficulty(flashcards, difficulty) {
  switch (difficulty) {
    case 'new':
      return flashcards.filter(card => card.difficulty === 0);
    case 'learning':
      return flashcards.filter(card => card.difficulty === 1);
    case 'review':
      return flashcards.filter(card => card.difficulty === 2);
    case 'difficult':
      // Cards that are new or learning (having trouble)
      return flashcards.filter(card => card.difficulty <= 1);
    default:
      return flashcards;
  }
}

// Initialize flashcard event listeners
function initializeFlashcardEventListeners() {
  // Difficulty filter
  const difficultyFilter = document.getElementById('difficultyFilter');
  if (difficultyFilter) {
    difficultyFilter.addEventListener('change', () => {
      loadFlashcardsView(); // Reload with new filter
    });
  }
  
  // Create flashcard button
  const createFlashcardBtn = document.getElementById('createFlashcardBtn');
  if (createFlashcardBtn) {
    createFlashcardBtn.addEventListener('click', () => showCreateFlashcardDialog());
  }

  // Study mode button
  const studyModeBtn = document.getElementById('studyModeBtn');
  if (studyModeBtn) {
    studyModeBtn.addEventListener('click', () => startStudyMode());
  }


  // Study controls in study interface
  initializeStudyInterfaceListeners();
}

// Add event listeners to flashcard items
function addFlashcardItemEventListeners() {
  // Study card buttons
  document.querySelectorAll('.card-action-btn.study').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      studySingleCard(cardId);
    });
  });

  // Edit card buttons
  document.querySelectorAll('.card-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      editFlashcard(cardId);
    });
  });

  // Delete card buttons
  document.querySelectorAll('.card-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      if (confirm('確定要刪除這張記憶卡嗎？')) {
        deleteFlashcard(cardId);
      }
    });
  });

  // Add click handlers for flashcard items (for quick preview)
  document.querySelectorAll('.flashcard-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Only if not clicking on action buttons or pronunciation button
      if (!e.target.closest('.card-action-btn') && !e.target.closest('.pronunciation-btn')) {
        const cardId = item.getAttribute('data-id');
        previewFlashcard(cardId);
      }
    });
  });

  // Add pronunciation button listeners
  document.querySelectorAll('.pronunciation-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      
      // Show loading state
      const originalText = btn.textContent;
      btn.textContent = '⏳';
      btn.disabled = true;
      
      try {
        const success = await window.flashcardManager.playPronunciation(cardId);
        if (!success) {
          // Show error briefly
          btn.textContent = '❌';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1000);
        } else {
          // Show success briefly
          btn.textContent = '✅';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1000);
        }
      } catch (error) {
        console.error('Error playing pronunciation:', error);
        btn.textContent = '❌';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1000);
      }
    });
  });
}

// Preview flashcard in a modal or expanded view
async function previewFlashcard(cardId) {
  if (!window.flashcardManager) return;
  
  const card = window.flashcardManager.flashcards.find(c => c.id === cardId);
  if (!card) return;
  
  // Create a modal with ONLY inline styles (no CSS classes to avoid conflicts)
  const modal = document.createElement('div');
  // Don't use any CSS classes that might be overridden
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(245, 245, 245, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  `;
  
  const difficultyLabels = ['新卡片', '學習中', '複習', '熟練'];
  const difficultyClasses = ['new', 'learning', 'review', 'mature'];
  const cardDifficulty = typeof card.difficulty === 'number' ? card.difficulty : 0;
  const safeDifficulty = Math.max(0, Math.min(3, cardDifficulty));
  const nextReview = new Date(card.nextReview);
  
  modal.innerHTML = `
    <div style="
      background: #ffffff;
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      border: 3px solid #ddd;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #1976d2; font-size: 18px; font-weight: 600;">記憶卡預覽</h3>
        <button data-action="close" style="
          background: #f5f5f5;
          border: 1px solid #ddd;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          padding: 8px 12px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="color: #1976d2; font-size: 24px; font-weight: 600; margin-bottom: 12px;">
          ${card.front || 'No front text'}
        </div>
        <div style="color: #333; font-size: 18px; font-weight: 500; margin-bottom: 10px;">
          ${card.back || 'No translation'}
        </div>
        ${card.pronunciation ? `<div style="color: #666; font-style: italic; font-family: 'Courier New', monospace; margin-bottom: 8px;">[${card.pronunciation}]</div>` : ''}
        ${card.definition ? `<div style="color: #555; font-size: 14px; margin-bottom: 12px;">${card.definition}</div>` : ''}
      </div>
      
      <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px;">
        <span style="background: #1976d2; color: white; padding: 4px 8px; border-radius: 8px; font-size: 12px;">
          ${languageNames[card.language] || card.language || 'unknown'}
        </span>
        <span style="background: #e8f5e8; color: #2e7d2e; padding: 4px 8px; border-radius: 8px; font-size: 12px;">
          ${difficultyLabels[safeDifficulty]}
        </span>
        <span style="color: #666; font-size: 12px;">📊 ${card.reviews || 0} 次複習</span>
        <span style="color: #666; font-size: 12px;">📅 ${nextReview.toLocaleDateString()}</span>
      </div>
      
      ${card.tags && card.tags.length > 0 ? `
        <div style="margin-bottom: 20px;">
          ${card.tags.map(tag => `
            <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-size: 11px; margin-right: 8px;">
              #${tag}
            </span>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button data-action="study" data-card-id="${card.id}" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">🎯 開始學習</button>
        <button data-action="edit" data-card-id="${card.id}" style="
          background: #4caf50;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">✏️ 編輯</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners without inline handlers
  const closeBtn = modal.querySelector('[data-action="close"]');
  const studyBtn = modal.querySelector('[data-action="study"]');
  const editBtn = modal.querySelector('[data-action="edit"]');
  
  // Close modal handlers
  closeBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // Action button handlers
  studyBtn.addEventListener('click', () => {
    studySingleCard(card.id);
    modal.remove();
  });
  
  editBtn.addEventListener('click', () => {
    editFlashcard(card.id);
    modal.remove();
  });
  
  // ESC key to close
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Initialize study interface listeners
function initializeStudyInterfaceListeners() {
  // Flip card button
  const flipCardBtn = document.getElementById('flipCardBtn');
  if (flipCardBtn) {
    flipCardBtn.addEventListener('click', () => flipCurrentCard());
  }

  // Answer buttons
  ['againBtn', 'hardBtn', 'goodBtn', 'easyBtn'].forEach((btnId, quality) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => processStudyAnswer(quality));
    }
  });

  // Navigation buttons
  const exitStudyBtn = document.getElementById('exitStudyBtn');
  if (exitStudyBtn) {
    exitStudyBtn.addEventListener('click', () => exitStudyMode());
  }

  // Audio play button
  const audioPlayBtn = document.getElementById('audioPlayBtn');
  if (audioPlayBtn) {
    audioPlayBtn.addEventListener('click', () => playCardAudio());
  }
}

// Show create flashcard dialog
function showCreateFlashcardDialog() {
  // Create a simple dialog interface
  const dialog = document.createElement('div');
  dialog.className = 'flashcard-dialog-overlay';
  dialog.innerHTML = `
    <div class="flashcard-dialog">
      <div class="dialog-header">
        <h3>✨ 建立新記憶卡</h3>
        <button class="close-dialog">✕</button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label>單字或問題 *</label>
          <input type="text" id="flashcard-front" placeholder="輸入要記憶的單字或問題" required>
        </div>
        <div class="form-group">
          <label>翻譯或答案 *</label>
          <input type="text" id="flashcard-back" placeholder="輸入翻譯或答案" required>
        </div>
        <div class="form-group">
          <label>發音 (可選)</label>
          <input type="text" id="flashcard-pronunciation" placeholder="例：/həˈloʊ/ 或注音">
        </div>
        <div class="form-group">
          <label>定義說明 (可選)</label>
          <textarea id="flashcard-definition" placeholder="輸入詳細定義或說明"></textarea>
        </div>
        <div class="form-group">
          <label>語言</label>
          <select id="flashcard-language">
            <option value="english">English</option>
            <option value="japanese">Japanese</option>
            <option value="korean">Korean</option>
            <option value="dutch">Dutch</option>
          </select>
        </div>
        <div class="form-group">
          <label>標籤 (用逗號分隔)</label>
          <input type="text" id="flashcard-tags" placeholder="例：vocabulary, important, manual">
        </div>
      </div>
      <div class="dialog-actions">
        <button class="cancel-btn">取消</button>
        <button class="create-btn">建立記憶卡</button>
      </div>
    </div>
  `;

  // Add styles
  if (!document.getElementById('flashcard-dialog-styles')) {
    const styles = document.createElement('style');
    styles.id = 'flashcard-dialog-styles';
    styles.textContent = `
      .flashcard-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .flashcard-dialog {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        max-width: 400px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .dialog-header {
        background: #1a73e8;
        color: white;
        padding: 16px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .dialog-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .close-dialog {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
      }
      .dialog-content {
        padding: 20px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #333;
        font-size: 14px;
      }
      .form-group input, .form-group textarea, .form-group select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
      }
      .form-group textarea {
        height: 60px;
        resize: vertical;
      }
      .dialog-actions {
        padding: 16px 20px 20px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      .dialog-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .cancel-btn {
        background: #f5f5f5;
        color: #666;
      }
      .create-btn {
        background: #1a73e8;
        color: white;
      }
      .create-btn:hover {
        background: #1557b0;
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(dialog);

  // Event listeners
  const closeDialog = () => {
    dialog.remove();
  };

  dialog.querySelector('.close-dialog').addEventListener('click', closeDialog);
  dialog.querySelector('.cancel-btn').addEventListener('click', closeDialog);
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  dialog.querySelector('.create-btn').addEventListener('click', async () => {
    const front = dialog.querySelector('#flashcard-front').value.trim();
    const back = dialog.querySelector('#flashcard-back').value.trim();
    
    if (!front || !back) {
      alert('請輸入必填項目：單字和翻譯');
      return;
    }

    const pronunciation = dialog.querySelector('#flashcard-pronunciation').value.trim();
    const definition = dialog.querySelector('#flashcard-definition').value.trim();
    const language = dialog.querySelector('#flashcard-language').value;
    const tagsInput = dialog.querySelector('#flashcard-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : ['manual'];

    await createFlashcard({
      front: front,
      back: back,
      pronunciation: pronunciation,
      definition: definition,
      language: language,
      tags: tags
    });

    closeDialog();
  });

  // Focus on first input
  setTimeout(() => {
    dialog.querySelector('#flashcard-front').focus();
  }, 100);
}

// Create flashcard (with cached audio support)
async function createFlashcard(data) {
  if (!flashcardManager) return;

  try {
    // Check if we have cached audio for this word
    const cachedAudio = getCachedAudio(data.front, data.language || 'english');
    if (cachedAudio && cachedAudio.audioUrl) {
      data.audioUrl = cachedAudio.audioUrl;
      console.log('🎯 Added cached audio to flashcard:', data.front);
    }

    const card = await window.flashcardManager.createFlashcard(data);
    console.log('📇 Created new flashcard:', card);
    
    // Refresh the flashcards view
    await loadFlashcardsView();
    
    // Show success message
    showMessage('記憶卡建立成功！', 'success');
  } catch (error) {
    console.error('Failed to create flashcard:', error);
    if (error.message.includes('already exists')) {
      showMessage('記憶卡已存在，無需重複建立', 'warning');
    } else {
      showMessage('建立記憶卡失敗', 'error');
    }
  }
}

// Create flashcard from current word
async function createFlashcardFromCurrentWord() {
  if (!currentQueryData.text) {
    showMessage('沒有當前查詢的單字', 'warning');
    return;
  }

  // Get translation from quick search if available
  const translation = document.getElementById('quickTranslation')?.textContent || 
                     await getQuickTranslation(currentQueryData.text, currentQueryData.language);
  
  const pronunciation = document.getElementById('quickPronunciation')?.textContent || '';
  const definition = document.getElementById('quickDefinition')?.textContent || '';

  const flashcardData = {
    front: currentQueryData.text,
    back: translation,
    pronunciation: pronunciation,
    definition: definition,
    language: currentQueryData.language,
    tags: ['current-word']
  };

  await createFlashcard(flashcardData);
}

// Create flashcard from saved report
async function createFlashcardFromReport(report) {
  if (!flashcardManager || !report) return;

  try {
    // Extract information from the report
    const analysisText = typeof report.analysisData === 'string' 
      ? report.analysisData 
      : (report.analysisData && report.analysisData.content 
          ? report.analysisData.content 
          : '');

    // Try to extract translation, pronunciation, and definition
    let translation = '';
    let pronunciation = '';
    let definition = '';

    if (analysisText) {
      // Extract Chinese translation
      const chineseMatch = analysisText.match(/中文[：:\s]*([^\n]+)/i) ||
                          analysisText.match(/翻譯[：:\s]*([^\n]+)/i) ||
                          analysisText.match(/Translation[：:\s]*([^\n]+)/i);
      if (chineseMatch) {
        translation = chineseMatch[1].trim();
      }

      // Extract pronunciation (IPA or phonetic)
      const pronunciationMatch = analysisText.match(/\[([^\]]+)\]/) ||
                                analysisText.match(/\/([^\/]+)\//) ||
                                analysisText.match(/發音[：:\s]*([^\n]+)/i) ||
                                analysisText.match(/Pronunciation[：:\s]*([^\n]+)/i);
      if (pronunciationMatch) {
        pronunciation = pronunciationMatch[1].trim();
      }

      // Extract definition
      const definitionMatch = analysisText.match(/定義[：:\s]*([^\n]+)/i) ||
                             analysisText.match(/Definition[：:\s]*([^\n]+)/i) ||
                             analysisText.match(/含義[：:\s]*([^\n]+)/i) ||
                             analysisText.match(/Meaning[：:\s]*([^\n]+)/i);
      if (definitionMatch) {
        definition = definitionMatch[1].trim();
      }

      // If no specific translation found, use first line as translation
      if (!translation) {
        const lines = analysisText.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          translation = lines[0].trim();
        }
      }
    }

    // Fallback to basic information if extraction failed
    if (!translation) {
      translation = `${report.language} word: ${report.searchText}`;
    }

    const flashcardData = {
      front: report.searchText,
      back: translation,
      pronunciation: pronunciation,
      definition: definition,
      language: report.language,
      tags: [...(report.tags || []), 'from-report']
    };

    // Check if we have cached audio for this word
    const cachedAudio = getCachedAudio(report.searchText, report.language);
    if (cachedAudio && cachedAudio.audioUrl) {
      flashcardData.audioUrl = cachedAudio.audioUrl;
      console.log('🎯 Added cached audio to flashcard:', report.searchText);
    }

    const card = await window.flashcardManager.createFlashcard(flashcardData);
    console.log('📇 Created flashcard from report:', card);
    
    return card;
  } catch (error) {
    console.error('Failed to create flashcard from report:', error);
    throw error;
  }
}

// Create flashcards from all saved reports
async function createAllFlashcardsFromReports() {
  if (!flashcardManager) {
    showMessage('記憶卡管理器未就緒', 'error');
    return;
  }

  try {
    // Get all reports based on current filters
    const filteredReports = await getCurrentlyFilteredReports();
    
    if (filteredReports.length === 0) {
      showMessage('沒有可用的報告來建立記憶卡', 'warning');
      return;
    }

    const confirmMessage = `確定要為 ${filteredReports.length} 個報告建立記憶卡嗎？`;
    if (!confirm(confirmMessage)) {
      return;
    }

    // Disable the button and show progress
    const createAllBtn = document.getElementById('createAllFlashcardsBtn');
    if (createAllBtn) {
      createAllBtn.disabled = true;
      createAllBtn.textContent = '🔄 建立中...';
    }

    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;

    // Create flashcards for each report
    for (let i = 0; i < filteredReports.length; i++) {
      const report = filteredReports[i];
      
      try {
        await createFlashcardFromReport(report);
        successCount++;

        // Show progress
        if (createAllBtn) {
          createAllBtn.textContent = `🔄 建立中 ${i + 1}/${filteredReports.length}`;
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to create flashcard for ${report.searchText}:`, error);
        if (error.message && error.message.includes('already exists')) {
          duplicateCount++;
          console.log(`Skipped duplicate: ${report.searchText} (${report.language})`);
        } else {
          failCount++;
        }
      }
    }

    // Show detailed completion message
    let message = '';
    const total = filteredReports.length;
    
    if (successCount > 0) {
      message = `✅ 成功建立 ${successCount} 張新記憶卡！`;
      if (duplicateCount > 0) {
        message += ` (跳過 ${duplicateCount} 張重複)`;
      }
      if (failCount > 0) {
        message += ` (${failCount} 張失敗)`;
      }
    } else if (duplicateCount > 0) {
      message = `ℹ️ 所有 ${duplicateCount} 張記憶卡都已存在，跳過重複建立`;
    } else if (failCount > 0) {
      message = `❌ 建立失敗，共 ${failCount} 張`;
    } else {
      message = '沒有處理任何記憶卡';
    }

    // Add summary if there were mixed results
    if (total > 1 && (successCount + duplicateCount + failCount) > 0) {
      message += `\n總計處理: ${total} 個項目`;
    }

    showMessage(message, successCount > 0 ? 'success' : (duplicateCount > 0 ? 'info' : 'warning'));

    // Refresh flashcards view if it's currently active
    const flashcardsView = document.getElementById('flashcardsView');
    if (flashcardsView && flashcardsView.style.display !== 'none') {
      await loadFlashcardsView();
    }

  } catch (error) {
    console.error('Failed to create bulk flashcards:', error);
    showMessage('批量建立記憶卡失敗', 'error');
  } finally {
    // Re-enable the button
    const createAllBtn = document.getElementById('createAllFlashcardsBtn');
    if (createAllBtn) {
      createAllBtn.disabled = false;
      createAllBtn.textContent = '🃏 Create All Flashcards';
    }
  }
}

// Start study mode
function startStudyMode() {
  if (!flashcardManager) return;

  const studyMode = document.getElementById('studyModeSelect')?.value || 'word-to-translation';
  const difficulty = document.getElementById('difficultyFilter')?.value || 'all';

  const session = window.flashcardManager.startStudySession({
    mode: studyMode,
    difficulty: difficulty,
    maxCards: 20
  });

  if (!session || session.cards.length === 0) {
    showMessage('沒有需要複習的卡片', 'info');
    return;
  }

  currentStudySession = session;
  showStudyInterface();
  loadCurrentCard();
}

// Show study interface
function showStudyInterface() {
  const flashcardsList = document.getElementById('flashcardsList');
  const flashcardsEmpty = document.getElementById('flashcardsEmpty');
  const studyInterface = document.getElementById('studyInterface');

  if (flashcardsList) flashcardsList.style.display = 'none';
  if (flashcardsEmpty) flashcardsEmpty.style.display = 'none';
  if (studyInterface) studyInterface.style.display = 'block';
}

// Load current card in study session
function loadCurrentCard() {
  if (!currentStudySession) return;

  const card = window.flashcardManager.getCurrentCard();
  if (!card) {
    // Study session completed
    completeStudySession();
    return;
  }

  const progress = window.flashcardManager.getStudyProgress();
  updateStudyProgress(progress);

  // Reset card state
  const flashcard = document.getElementById('flashcard');
  const frontText = document.getElementById('frontText');
  const backText = document.getElementById('backText');
  const cardDefinition = document.getElementById('cardDefinition');
  const cardPronunciation = document.getElementById('cardPronunciation');
  const flipCardBtn = document.getElementById('flipCardBtn');
  const answerButtons = document.getElementById('answerButtons');
  const audioPlayBtn = document.getElementById('audioPlayBtn');

  if (flashcard) flashcard.classList.remove('flipped');
  if (frontText) frontText.textContent = card.front || 'No front text';
  if (backText) {
    backText.textContent = card.back || 'No translation available';
    console.log('Setting back text:', card.back);
  }
  if (cardDefinition) cardDefinition.textContent = card.definition || '';
  if (cardPronunciation) cardPronunciation.textContent = card.pronunciation ? `[${card.pronunciation}]` : '';
  if (flipCardBtn) {
    flipCardBtn.style.display = 'block';
    flipCardBtn.textContent = '翻轉卡片';
  }
  if (answerButtons) answerButtons.style.display = 'none';

  // Show audio button if available
  if (audioPlayBtn) {
    audioPlayBtn.style.display = card.audioUrl ? 'block' : 'none';
  }

  // Configure display based on study mode
  const studyMode = currentStudySession.mode;
  const cardFront = document.querySelector('.card-front');
  const cardBack = document.querySelector('.card-back');
  
  // Configure card display and content based on study mode
  if (studyMode === 'translation-to-word') {
    // Show translation first, word on back
    if (frontText) frontText.textContent = card.back || card.definition || 'No translation available';
    if (backText) backText.textContent = card.front || 'No word available';
  } else if (studyMode === 'audio-to-meaning') {
    // Show audio button prominently, meaning on back
    if (frontText) {
      frontText.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔊</div>
          <div style="margin-bottom: 16px; font-size: 18px;">聆聽發音</div>
          <button id="studyModePlayBtn" style="
            background: #1976d2; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 6px; 
            font-size: 16px;
            cursor: pointer;
          ">播放發音</button>
        </div>
      `;
      
      // Add event listener for the play button (CSP compliant)
      setTimeout(() => {
        const playBtn = document.getElementById('studyModePlayBtn');
        if (playBtn) {
          playBtn.addEventListener('click', () => playCardPronunciation());
          
          // Auto-play the pronunciation when entering audio-to-meaning mode
          setTimeout(() => {
            playCardPronunciation();
          }, 500);
        }
      }, 10);
    }
    if (backText) backText.textContent = `${card.front} - ${card.back || card.definition}`;
  } else if (studyMode === 'mixed') {
    // Random mode selection for each card
    const modes = ['word-to-translation', 'translation-to-word', 'audio-to-meaning'];
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    currentStudySession.currentCardMode = randomMode;
    
    if (randomMode === 'translation-to-word') {
      if (frontText) frontText.textContent = card.back || card.definition || 'No translation available';
      if (backText) backText.textContent = card.front || 'No word available';
    } else if (randomMode === 'audio-to-meaning') {
      if (frontText) {
        frontText.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🔊</div>
            <div style="margin-bottom: 16px; font-size: 18px;">聆聽發音</div>
            <button id="studyModePlayBtn" style="
              background: #1976d2; 
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 6px; 
              font-size: 16px;
              cursor: pointer;
            ">播放發音</button>
          </div>
        `;
        
        // Add event listener for the play button (CSP compliant)
        setTimeout(() => {
          const playBtn = document.getElementById('studyModePlayBtn');
          if (playBtn) {
            playBtn.addEventListener('click', () => playCardPronunciation());
            
            // Auto-play the pronunciation when entering audio-to-meaning mode
            setTimeout(() => {
              playCardPronunciation();
            }, 500);
          }
        }, 10);
      }
      if (backText) backText.textContent = `${card.front} - ${card.back || card.definition}`;
    } else {
      // Default word-to-translation
      if (frontText) frontText.textContent = card.front || 'No front text';
      if (backText) backText.textContent = card.back || 'No translation available';
    }
  } else {
    // Default: word-to-translation
    if (frontText) frontText.textContent = card.front || 'No front text';
    if (backText) backText.textContent = card.back || 'No translation available';
  }
  
  if (cardFront) cardFront.style.display = 'flex';
  if (cardBack) cardBack.style.display = 'none';
}

// Update study progress
function updateStudyProgress(progress) {
  const progressFill = document.getElementById('progressFill');
  const cardCounter = document.getElementById('cardCounter');

  if (progressFill) {
    progressFill.style.width = `${progress.percentage}%`;
  }

  if (cardCounter) {
    cardCounter.textContent = `${progress.current} / ${progress.total}`;
  }
}

// Flip current card
function flipCurrentCard() {
  const flashcard = document.getElementById('flashcard');
  const flipCardBtn = document.getElementById('flipCardBtn');
  const answerButtons = document.getElementById('answerButtons');
  const cardFront = document.querySelector('.card-front');
  const cardBack = document.querySelector('.card-back');

  if (flashcard && !flashcard.classList.contains('flipped')) {
    flashcard.classList.add('flipped');
    
    // Explicitly show/hide the card sides
    if (cardFront) cardFront.style.display = 'none';
    if (cardBack) cardBack.style.display = 'flex';
    
    if (flipCardBtn) flipCardBtn.style.display = 'none';
    if (answerButtons) answerButtons.style.display = 'flex';

    // Update answer button timings based on card difficulty
    updateAnswerButtonTimings();
    
    console.log('Card flipped - back side should now be visible');
  }
}

// Update answer button timings
function updateAnswerButtonTimings() {
  const card = window.flashcardManager.getCurrentCard();
  if (!card) return;

  // Calculate next intervals for each answer quality
  const intervals = [
    '< 1分鐘',  // Again
    '< 6分鐘',  // Hard  
    `${Math.max(1, Math.round(card.interval * 0.6))} 天`, // Good
    `${Math.max(4, Math.round(card.interval * card.easeFactor))} 天`  // Easy
  ];

  ['againBtn', 'hardBtn', 'goodBtn', 'easyBtn'].forEach((btnId, index) => {
    const btn = document.getElementById(btnId);
    const timeSpan = btn?.querySelector('.btn-time');
    if (timeSpan) {
      timeSpan.textContent = intervals[index];
    }
  });
}

// Process study answer
async function processStudyAnswer(quality) {
  if (!flashcardManager || !currentStudySession) return;

  const card = window.flashcardManager.getCurrentCard();
  
  const success = await window.flashcardManager.processAnswer(quality);
  
  if (success && card) {
    // Record vocabulary interaction in learning analytics
    if (learningAnalytics) {
      try {
        const action = quality >= 3 ? 'correct_answer' : 'incorrect_answer';
        learningAnalytics.recordVocabularyInteraction(
          card.front,
          card.language,
          action,
          { 
            studyMode: currentStudySession.mode,
            quality: quality,
            timestamp: Date.now()
          }
        );
        console.log('📝 Recorded vocabulary interaction:', card.front, action, quality);
      } catch (error) {
        console.error('Failed to record vocabulary interaction:', error);
      }
    }

    // Move to next card after a short delay
    setTimeout(() => {
      loadCurrentCard();
    }, 800);

    // Show feedback
    const feedbackMessages = ['再試一次！', '有點困難', '做得好！', '太簡單了！'];
    showMessage(feedbackMessages[quality], quality >= 2 ? 'success' : 'warning');

    // Update stats
    await updateFlashcardStats();
  }
}

// Complete study session
async function completeStudySession() {
  if (!flashcardManager) return;

  const results = window.flashcardManager.endStudySession();
  const studyInterface = document.getElementById('studyInterface');
  
  if (studyInterface) studyInterface.style.display = 'none';
  
  // Show results
  const cardsStudied = results.cardsStudied;
  const accuracy = results.accuracy;
  const duration = Math.round(results.duration / 1000 / 60); // minutes

  // Update learning analytics with the completed study session
  if (learningAnalytics && results && cardsStudied > 0) {
    try {
      learningAnalytics.recordStudySession(
        'flashcard', 
        results.duration, 
        cardsStudied, 
        accuracy / 100 // Convert percentage to 0-1 scale
      );
      console.log('📊 Recorded study session:', {
        type: 'flashcard',
        duration: results.duration,
        cardsStudied,
        accuracy: accuracy / 100
      });
    } catch (error) {
      console.error('Failed to record study session:', error);
    }
  }

  showMessage(
    `學習完成！複習了 ${cardsStudied} 張卡片，準確率 ${accuracy}%，用時 ${duration} 分鐘`,
    'success'
  );

  // Update analytics view if it's currently displayed
  const analyticsView = document.getElementById('analyticsView');
  if (analyticsView && analyticsView.style.display !== 'none') {
    await loadAnalyticsView();
  }

  // Return to flashcards list
  loadFlashcardsView();
}

// Exit study mode
function exitStudyMode() {
  if (currentStudySession) {
    const confirmed = confirm('確定要退出學習模式嗎？進度將不會保存。');
    if (!confirmed) return;
  }

  currentStudySession = null;
  
  const studyInterface = document.getElementById('studyInterface');
  if (studyInterface) studyInterface.style.display = 'none';
  
  loadFlashcardsView();
}

// Study single card
function studySingleCard(cardId) {
  if (!flashcardManager) return;

  // Find the card
  const card = window.flashcardManager.flashcards.find(c => c.id === cardId);
  if (!card) return;

  // Create a single-card study session
  currentStudySession = {
    cards: [card],
    currentIndex: 0,
    mode: 'word-to-translation',
    startTime: new Date().getTime(),
    answers: []
  };

  window.flashcardManager.currentStudySession = currentStudySession;
  
  showStudyInterface();
  loadCurrentCard();
}

// Edit flashcard
function editFlashcard(cardId) {
  if (!flashcardManager) return;

  const card = window.flashcardManager.flashcards.find(c => c.id === cardId);
  if (!card) return;

  const front = prompt('編輯單字/問題:', card.front);
  if (front === null) return;

  const back = prompt('編輯翻譯/答案:', card.back);
  if (back === null) return;

  const pronunciation = prompt('編輯發音:', card.pronunciation);
  if (pronunciation === null) return;

  const definition = prompt('編輯定義:', card.definition);
  if (definition === null) return;

  // Update card
  window.flashcardManager.updateFlashcard(cardId, {
    front: front,
    back: back,
    pronunciation: pronunciation || '',
    definition: definition || ''
  });

  // Refresh view
  loadFlashcardsView();
  showMessage('卡片更新成功！', 'success');
}

// Delete flashcard
async function deleteFlashcard(cardId) {
  if (!flashcardManager) return;

  const confirmed = confirm('確定要刪除這張記憶卡嗎？');
  if (!confirmed) return;

  try {
    await window.flashcardManager.deleteFlashcard(cardId);
    await loadFlashcardsView();
    showMessage('記憶卡已刪除', 'success');
  } catch (error) {
    console.error('Failed to delete flashcard:', error);
    showMessage('刪除失敗', 'error');
  }
}


// Play card audio
function playCardAudio() {
  const card = window.flashcardManager.getCurrentCard();
  if (!card || !card.audioUrl) return;

  const audio = new Audio(card.audioUrl);
  audio.play().catch(error => {
    console.error('Failed to play audio:', error);
    showMessage('播放音頻失敗', 'error');
  });
}

// Play card pronunciation using enhanced TTS with OpenAI support
async function playCardPronunciation() {
  const card = window.flashcardManager.getCurrentCard();
  if (!card) {
    showMessage('沒有卡片可播放', 'error');
    return;
  }

  console.log('Playing pronunciation for card:', card.front, 'language:', card.language);

  // Update button state
  const playBtn = document.getElementById('studyModePlayBtn');
  if (playBtn) {
    playBtn.textContent = '生成中...';
    playBtn.disabled = true;
  }

  try {
    // Try OpenAI TTS first for better quality
    const audioSuccess = await generateOpenAIAudio(card.front, card.language);
    
    if (audioSuccess) {
      console.log('✅ Used OpenAI TTS for pronunciation');
      return;
    }
    
    // Fallback to Web Speech API
    console.log('⚠️ Falling back to Web Speech API');
    await playWithWebSpeechAPI(card);
    
  } catch (error) {
    console.error('TTS error:', error);
    showMessage('語音播放失敗', 'error');
    
    // Try Web Speech API as final fallback
    try {
      await playWithWebSpeechAPI(card);
    } catch (fallbackError) {
      console.error('Fallback TTS also failed:', fallbackError);
      showMessage('語音系統無法使用', 'error');
    }
  } finally {
    // Reset button state
    if (playBtn) {
      playBtn.textContent = '播放發音';
      playBtn.disabled = false;
    }
  }
}

// Global audio cache to reuse generated audio
window.audioCache = window.audioCache || new Map();

// Generate audio using OpenAI TTS API (with caching)
async function generateOpenAIAudio(text, language, playImmediately = true) {
  try {
    // Check cache first
    const cacheKey = `${text.toLowerCase()}_${language}`;
    if (window.audioCache.has(cacheKey)) {
      const cachedAudio = window.audioCache.get(cacheKey);
      console.log('🎯 Using cached audio for:', text);
      
      if (playImmediately) {
        return await playCachedAudio(cachedAudio);
      } else {
        return cachedAudio; // Return cached audio data
      }
    }

    // Get OpenAI API key from storage or environment
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      console.log('No OpenAI API key found, skipping OpenAI TTS');
      return false;
    }

    // Map our language codes to OpenAI voice options
    const voiceMap = {
      'english': 'alloy',    // Clear, natural English voice
      'japanese': 'nova',    // Works well for Japanese
      'korean': 'echo',      // Good for Korean
      'dutch': 'fable',      // European languages
      'chinese': 'onyx'      // Works for Chinese
    };

    const voice = voiceMap[language] || 'alloy';
    
    console.log('🎙️ Requesting OpenAI TTS:', text, 'voice:', voice);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 0.9  // Slightly slower for learning
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS API error:', response.status, errorText);
      return false;
    }

    // Convert response to audio blob and create data URL for persistent storage
    const audioBlob = await response.blob();
    const audioDataUrl = await blobToDataURL(audioBlob);
    
    // Cache the audio data
    const audioData = {
      text: text,
      language: language,
      audioUrl: audioDataUrl, // Data URL for persistent storage
      blobUrl: URL.createObjectURL(audioBlob), // Blob URL for immediate playback
      size: audioBlob.size,
      timestamp: Date.now()
    };
    
    window.audioCache.set(cacheKey, audioData);
    console.log('💾 Cached audio for:', text, 'size:', Math.round(audioBlob.size / 1024), 'KB');
    
    if (playImmediately) {
      return await playCachedAudio(audioData);
    } else {
      return audioData; // Return audio data without playing
    }

  } catch (error) {
    console.error('OpenAI TTS generation failed:', error);
    return false;
  }
}

// Play cached audio
async function playCachedAudio(audioData) {
  const audio = new Audio(audioData.blobUrl || audioData.audioUrl);
  
  return new Promise((resolve) => {
    audio.onloadeddata = () => {
      console.log('🔊 Playing cached OpenAI audio');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放中...';
        playBtn.disabled = true;
      }
      
      audio.play()
        .then(() => {
          console.log('✅ Cached audio playing successfully');
          resolve(true);
        })
        .catch(error => {
          console.error('Failed to play cached audio:', error);
          resolve(false);
        });
    };
    
    audio.onended = () => {
      console.log('🎵 Cached audio finished');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放發音';
        playBtn.disabled = false;
      }
    };
    
    audio.onerror = (error) => {
      console.error('Cached audio playback error:', error);
      resolve(false);
    };
  });
}

// Convert blob to data URL for persistent storage
function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Get cached audio for flashcard creation
function getCachedAudio(text, language) {
  const cacheKey = `${text.toLowerCase()}_${language}`;
  return window.audioCache.get(cacheKey) || null;
}

// Get OpenAI API key from storage
async function getOpenAIApiKey() {
  try {
    // First try to get from Chrome storage
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['openaiApiKey'], resolve);
    });
    
    if (result.openaiApiKey) {
      return result.openaiApiKey;
    }
    
    // Fallback: check if there's a global variable or config
    if (typeof window.OPENAI_API_KEY !== 'undefined') {
      return window.OPENAI_API_KEY;
    }
    
    console.log('No OpenAI API key configured');
    return null;
  } catch (error) {
    console.error('Failed to retrieve OpenAI API key:', error);
    return null;
  }
}

// Fallback to Web Speech API (enhanced version)
async function playWithWebSpeechAPI(card) {
  if (!('speechSynthesis' in window)) {
    throw new Error('Web Speech API not supported');
  }

  // Cancel any ongoing speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(card.front);
  
  // Enhanced language mapping
  const langMap = {
    'english': 'en-US',
    'japanese': 'ja-JP', 
    'korean': 'ko-KR',
    'dutch': 'nl-NL',
    'chinese': 'zh-CN'
  };
  
  utterance.lang = langMap[card.language] || 'en-US';
  utterance.rate = 0.75;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  // Select best voice
  const voices = speechSynthesis.getVoices();
  const preferredVoice = selectBestVoice(voices, utterance.lang, card.language);
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    console.log('Using voice:', preferredVoice.name);
  }
  
  return new Promise((resolve, reject) => {
    utterance.onstart = () => {
      console.log('🔊 Playing Web Speech API audio');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放中...';
        playBtn.disabled = true;
      }
    };
    
    utterance.onend = () => {
      console.log('✅ Web Speech API finished');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放發音';
        playBtn.disabled = false;
      }
      resolve();
    };
    
    utterance.onerror = (event) => {
      console.error('Web Speech API error:', event.error);
      reject(new Error('Web Speech API error: ' + event.error));
    };
    
    speechSynthesis.speak(utterance);
  });
}

// Select the best available voice for the language
function selectBestVoice(voices, langCode, cardLanguage) {
  if (!voices || voices.length === 0) return null;
  
  // Filter voices by language
  const matchingVoices = voices.filter(voice => voice.lang.startsWith(langCode.split('-')[0]));
  
  if (matchingVoices.length === 0) return null;
  
  // Language-specific voice preferences (more natural sounding voices)
  const voicePreferences = {
    'english': ['Microsoft Zira', 'Google US English', 'Alex', 'Daniel', 'Karen', 'Moira', 'Samantha'],
    'japanese': ['Microsoft Haruka', 'Google 日本語', 'Kyoko', 'Otoya', 'O-ren'],
    'korean': ['Microsoft Heami', 'Google 한국의', 'Yuna'],
    'dutch': ['Microsoft Frank', 'Google Nederlands', 'Ellen', 'Xander'],
    'chinese': ['Microsoft Huihui', 'Google 中文', 'Ting-Ting', 'Sin-ji']
  };
  
  const preferences = voicePreferences[cardLanguage] || [];
  
  // Try to find a preferred voice
  for (const prefName of preferences) {
    const voice = matchingVoices.find(v => v.name.includes(prefName));
    if (voice) return voice;
  }
  
  // Prefer local voices over remote ones
  const localVoices = matchingVoices.filter(v => v.localService);
  if (localVoices.length > 0) {
    return localVoices[0];
  }
  
  // Return first matching voice
  return matchingVoices[0];
}

// Show message (utility function)
function showMessage(message, type = 'info') {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    max-width: 300px;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;

  // Set background color based on type
  const colors = {
    'info': '#2196f3',
    'success': '#4caf50',
    'warning': '#ff9800',
    'error': '#f44336'
  };
  toast.style.backgroundColor = colors[type] || colors.info;

  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}