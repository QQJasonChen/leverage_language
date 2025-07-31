// AI 服務整合模組 - 支援 Gemini 和 OpenAI
class AIService {
  constructor() {
    this.settings = null;
    this.isInitialized = false;
  }

  // 檢查網路連線狀態
  async checkNetworkConnectivity() {
    try {
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      const duration = Date.now() - startTime;
      
      console.log(`🌐 Network check: ${response.status} (${duration}ms)`);
      return {
        connected: response.ok,
        latency: duration,
        status: response.status
      };
    } catch (error) {
      console.log(`❌ Network check failed: ${error.message}`);
      return {
        connected: false,
        latency: -1,
        error: error.message
      };
    }
  }

  // 初始化 AI 服務
  async initialize() {
    try {
      const result = await chrome.storage.sync.get([
        'aiEnabled', 'aiProvider', 'openaiModel', 'apiKey', 'pronunciationGuide', 
        'wordExplanation', 'grammarAnalysis', 'culturalContext', 'audioPronunciation',
        'errorDetection', 'ttsVoice', 'speechSpeed', 'autoPlayAudio', 'analysisComplexity'
      ]);
      
      this.settings = {
        enabled: result.aiEnabled === 'true',
        provider: result.aiProvider || 'gemini',
        openaiModel: this.migrateOpenAIModel(result.openaiModel), // Migrate deprecated models
        apiKey: result.apiKey || '',
        features: {
          pronunciationGuide: result.pronunciationGuide !== false,
          wordExplanation: result.wordExplanation !== false,
          grammarAnalysis: result.grammarAnalysis !== false, // 預設啟用語法分析
          culturalContext: result.culturalContext !== false, // 預設啟用文化背景
          audioPronunciation: result.audioPronunciation !== false,
          errorDetection: result.errorDetection === true // 預設關閉，需手動啟用
        },
        audio: {
          voice: result.ttsVoice || 'alloy',
          speed: parseFloat(result.speechSpeed) || 1.0,
          autoPlay: result.autoPlayAudio || false
        },
        analysisComplexity: result.analysisComplexity || 'auto' // auto, simple, medium, detailed
      };
      
      // Debug logging for error detection (only when enabled)
      if (this.settings.features.errorDetection) {
        console.log('🔧 AI Service - Error detection enabled');
      }
      
      this.isInitialized = true;
      return this.settings.enabled && this.settings.apiKey;
    } catch (error) {
      console.error('AI 服務初始化失敗:', error);
      return false;
    }
  }

  // 檢查是否可用
  isAvailable() {
    return this.isInitialized && this.settings.enabled && this.settings.apiKey;
  }

  // Migrate deprecated OpenAI models to current ones
  migrateOpenAIModel(savedModel) {
    // Default to gpt-4o-mini if no model saved
    if (!savedModel) {
      return 'gpt-4o-mini';
    }
    
    // Migrate deprecated models
    if (savedModel === 'gpt-3.5-turbo') {
      console.log('🔄 Migrating from deprecated gpt-3.5-turbo to gpt-4o-mini (better quality, 87% cheaper)');
      return 'gpt-4o-mini';
    }
    
    // Keep valid models
    if (savedModel === 'gpt-4o-mini' || savedModel === 'gpt-4o') {
      return savedModel;
    }
    
    // Unknown model, default to gpt-4o-mini
    console.log(`⚠️ Unknown OpenAI model "${savedModel}", defaulting to gpt-4o-mini`);
    return 'gpt-4o-mini';
  }

  // Build translation and simple breakdown section
  buildTranslationSection(text, language, langName, isWord) {
    let prompt = `## 🔤 翻譯與簡單解釋\n\n`;
    
    prompt += `### 📝 中文翻譯\n`;
    prompt += `請提供準確且自然的中文翻譯。\n\n`;
    
    if (!isWord) {
      prompt += `### 🧩 句子結構分解\n`;
      prompt += `請用簡單的方式解釋句子結構：\n`;
      prompt += `1. **逐詞翻譯**：將每個詞的意思列出\n`;
      prompt += `2. **語序說明**：解釋${langName}和中文語序的差異\n`;
      prompt += `3. **重點提示**：這句話最重要的是什麼？\n\n`;
    } else {
      prompt += `### 🔍 詞彙基本資訊\n`;
      prompt += `1. **詞性**：這是什麼詞性？\n`;
      prompt += `2. **基本含義**：最常用的意思是什麼？\n`;
      prompt += `3. **使用頻率**：日常生活中常用嗎？\n\n`;
    }
    
    prompt += `---\n\n`; // 分隔線
    return prompt;
  }

  // Professional pedagogical prompt builder
  buildProfessionalPrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語',
      'japanese': '日語',
      'korean': '韓語'
    };
    
    const langName = languageNames[language] || '英語';
    const features = this.settings.features;
    const isWord = text.trim().split(/\s+/).length === 1;
    const learnerLevel = this.estimateLearnerLevel(text);
    
    let prompt = `# 🌟 ${langName}學習小幫手 - 專業語言教師分析\n\n`;
    prompt += `您好！我是您的${langName}學習夥伴。讓我們一起探索「${text}」的奧妙！\n\n`;
    
    // ALWAYS start with translation and simple breakdown
    prompt += this.buildTranslationSection(text, language, langName, isWord);
    
    // Error detection with encouraging approach
    if (features.errorDetection) {
      prompt += this.buildProfessionalErrorDetection(text, language, langName);
    }
    
    // Core learning sections
    prompt += this.buildProfessionalCoreSections(text, language, langName, isWord, features, learnerLevel);
    
    // Closing with motivation
    prompt += this.buildProfessionalClosing(langName, learnerLevel);
    
    return prompt;
  }

  // Professional error detection with improved language detection
  buildProfessionalErrorDetection(text, language, langName) {
    let languageSpecificChecks = '';
    
    if (language === 'dutch') {
      languageSpecificChecks = `**🇳🇱 荷蘭語專業檢測標準：**\n` +
                               `- 純正性：每個詞必須是荷蘭語詞彙（非英語、德語）\n` +
                               `- 英語詞彙如 "the, one, book, at, leave, please, coffee, get, want" 等不屬於荷蘭語\n` +
                               `- 德語詞彙也不屬於荷蘭語，即使相似\n` +
                               `- 只接受荷蘭語母語者會自然使用的表達\n` +
                               `- 注意荷蘭語獨特的語序（V2規則）和詞彙選擇\n\n`;
    } else if (language === 'english') {
      languageSpecificChecks = `**🇺🇸 英語專業檢測標準：**\n` +
                               `- 純正性：每個詞必須是英語詞彙\n` +
                               `- 避免其他語言的詞彙混入\n` +
                               `- 注意英語特有的語法結構和慣用語\n` +
                               `- 檢查是否符合自然的英語表達習慣\n\n`;
    }
    
    return `## 🔍 首先，讓我們一起檢查這個${langName}表達\n\n` +
           `請用母語者的眼光仔細觀察：「${text}」\n\n` +
           languageSpecificChecks +
           `**🎯 嚴格錯誤檢測原則：**\n` +
           `🚫 **只有以下情況才算真正的錯誤：**\n` +
           `   • 明顯的語法錯誤（如時態錯誤、主謂不一致）\n` +
           `   • 拼寫錯誤（單詞拼寫不正確）\n` +
           `   • 語言混用（在${langName}中使用其他語言的詞彙）\n` +
           `   • 違反基本語言規則的表達\n\n` +
           `✅ **以下情況絕對不算錯誤，應判定為正確：**\n` +
           `   • 詞彙選擇差異（使用了不太常見但正確的詞彙）\n` +
           `   • 表達風格差異（正式vs非正式、口語vs書面語）\n` +
           `   • 句式變化（簡單句vs複雜句）\n` +
           `   • 語序偏好（多種正確語序中的一種）\n` +
           `   • 修辭選擇（比喻、強調等修辭手法的使用）\n\n` +
           `⚠️ **特別注意：寧可錯判為正確，也不要錯判為錯誤！**\n\n` +
           `**如果發現真正的錯誤（語法/拼寫/語言混用）：**\n` +
           `- 請以「學習機會」的角度溫和指出\n` +
           `- 解釋為什麼這是錯誤而非選擇差異\n` +
           `- 提供正確版本和記憶技巧\n\n` +
           `**如果表達正確（即使不是最佳選擇）：**\n` +
           `- 請明確說「太棒了！這是完全正確的${langName}表達！」\n` +
           `- 然後專注於深化理解和提供更多選擇\n\n`;
  }

  // Professional core learning sections
  buildProfessionalCoreSections(text, language, langName, isWord, features, level) {
    let prompt = `## 📚 深度學習分析\n\n`;
    
    // 1. Pronunciation - Practical approach
    if (features.pronunciationGuide) {
      prompt += `### 🗣️ 發音指導 - 說得像母語者\n`;
      prompt += `請提供：\n`;
      prompt += `1. **準確音標**：IPA音標 + 易懂的中文注音提示\n`;
      prompt += `2. **發音要訣**：最容易出錯的地方和改正方法\n`;
      prompt += `3. **語調節奏**：${!isWord ? '句子的重音位置和語調變化' : '在句中的重音變化'}\n`;
      prompt += `4. **實用練習**：2-3個簡單有效的發音練習方法\n`;
      prompt += `5. **常見錯誤**：中文母語者最常犯的發音錯誤\n\n`;
    }
    
    // 2. Vocabulary - Usage-focused
    if (features.wordExplanation) {
      prompt += `### 📖 詞彙掌握 - 活學活用\n`;
      if (isWord) {
        prompt += `請提供：\n`;
        prompt += `1. **核心含義**：用最簡單的中文解釋（一句話）\n`;
        prompt += `2. **生活例句**：3個日常對話中的實用例句\n`;
        prompt += `3. **情境變化**：正式/非正式場合的不同用法\n`;
        prompt += `4. **同義詞組**：2-3個相似詞彙及使用差異\n`;
        prompt += `5. **記憶訣竅**：一個有趣易記的聯想方法\n`;
        prompt += `6. **搭配詞彙**：最常見的5個詞彙搭配\n`;
      } else {
        prompt += `請挑選句中2-3個關鍵詞彙，提供：\n`;
        prompt += `1. **詞彙解析**：簡潔解釋 + 詞性標註\n`;
        prompt += `2. **固定搭配**：找出句中的片語或慣用語\n`;
        prompt += `3. **升級建議**：1-2個讓表達更地道的替換詞\n`;
      }
      prompt += `\n`;
    }
    
    // 3. Grammar - Simplified and practical
    if (features.grammarAnalysis) {
      prompt += `### 📐 語法解密 - 輕鬆理解\n`;
      prompt += `請用簡單易懂的方式解釋：\n`;
      if (!isWord) {
        prompt += `1. **句型公式**：用符號表示（如：S+V+O）\n`;
        prompt += `2. **時態說明**：為什麼用這個時態？表達什麼？\n`;
        prompt += `3. **關鍵語法**：1-2個值得掌握的語法點\n`;
        prompt += `4. **中式思維**：中文母語者容易犯的語法錯誤\n`;
        prompt += `5. **活用練習**：2個使用相同句型的實用例句\n`;
      } else {
        prompt += `1. **詞性功能**：這個詞可以怎麼用？\n`;
        prompt += `2. **變化形式**：重要的詞形變化表\n`;
        prompt += `3. **語法搭配**：前後需要什麼詞性？\n`;
      }
      prompt += `\n`;
    }
    
    // 4. Cultural Context - Real-world focused
    if (features.culturalContext) {
      prompt += `### 🌍 文化視角 - 道地表達\n`;
      prompt += `請說明：\n`;
      prompt += `1. **使用場景**：什麼時候說這句話最合適？\n`;
      prompt += `2. **禮貌程度**：對朋友/老師/陌生人說合適嗎？\n`;
      prompt += `3. **文化差異**：和中文表達習慣有何不同？\n`;
      prompt += `4. **地區差異**：美式/英式或其他地區差異\n`;
      prompt += `5. **實用建議**：一個避免文化誤解的小提示\n\n`;
    }
    
    // 5. Immediate Application
    prompt += `### 🎯 立即應用 - 現學現用\n`;
    prompt += `請提供：\n`;
    prompt += `1. **情境對話**：設計一個4-6句的實用對話，自然融入所學內容\n`;
    prompt += `2. **角色扮演**：建議一個可以練習的真實場景\n`;
    prompt += `3. **今日任務**：一個5分鐘內可完成的小練習\n`;
    prompt += `4. **延伸學習**：2個相關且實用的表達\n\n`;
    
    return prompt;
  }

  // Professional closing
  buildProfessionalClosing(langName, level) {
    const levelTips = {
      'beginner': '基礎穩固，進步看得見！',
      'intermediate': '持續練習，流利指日可待！',
      'advanced': '精益求精，母語水平在望！'
    };
    
    return `## 💪 學習鼓勵\n` +
           `${levelTips[level] || '每天進步一點點！'}\n` +
           `記住：犯錯是學習的養分，練習是進步的階梯。\n` +
           `今天學到的，明天就能用出來！\n\n` +
           `**🌈 回應要求：**\n` +
           `1. 保持友善、鼓勵、專業的語氣\n` +
           `2. 解釋簡單明瞭，避免學術術語\n` +
           `3. 重視實用性勝過理論完整性\n` +
           `4. 一次完成所有分析，結構清晰\n` +
           `5. 如發現錯誤，以建設性方式指正\n` +
           `6. 如完全正確，專注於延伸學習\n`;
  }

  // Estimate learner level
  estimateLearnerLevel(text) {
    const wordCount = text.trim().split(/\s+/).length;
    const avgWordLength = text.replace(/\s/g, '').length / wordCount;
    const hasComplexPunctuation = /[;:,\-\(\)\"\']/g.test(text);
    
    if (wordCount === 1 || (wordCount < 5 && avgWordLength < 6)) {
      return 'beginner';
    } else if (wordCount < 15 && !hasComplexPunctuation) {
      return 'intermediate';
    } else {
      return 'advanced';
    }
  }

  // 生成 AI 分析 - 增強錯誤處理和重試機制
  async generateAnalysis(text, language, retryCount = 0, maxRetries = 2) {
    if (!this.isAvailable()) {
      throw new Error('AI 服務未啟用或未配置');
    }

    // 在第一次嘗試時檢查網路連線
    if (retryCount === 0) {
      const networkStatus = await this.checkNetworkConnectivity();
      if (!networkStatus.connected) {
        throw new Error(`網路連線問題 - ${networkStatus.error || '無法連線到網際網路'}，請檢查您的網路設定`);
      }
      
      if (networkStatus.latency > 3000) {
        console.warn(`⚠️ 網路延遲較高: ${networkStatus.latency}ms - API 請求可能會比較慢`);
      }
    }

    try {
      const prompt = this.buildPrompt(text, language);
      console.log('🎯 Generated prompt length:', prompt.length, 'characters');
      
      return await this.attemptAnalysisWithFallback(prompt, text, language, retryCount, maxRetries);
    } catch (error) {
      console.error('🚨 AI 分析完全失敗:', error);
      throw error;
    }
  }

  // 嘗試 AI 分析，帶有備用方案和重試
  async attemptAnalysisWithFallback(prompt, text, language, retryCount, maxRetries) {
    const isRetry = retryCount > 0;
    const retryInfo = isRetry ? ` (第 ${retryCount + 1} 次嘗試)` : '';
    const complexity = this.getAnalysisComplexity(text);
    
    try {
      if (this.settings.provider === 'gemini') {
        console.log(`📡 Attempting Gemini API${retryInfo}...`);
        return await this.callGeminiAPI(prompt, complexity);
      } else if (this.settings.provider === 'openai') {
        console.log(`📡 Attempting OpenAI API${retryInfo}...`);
        return await this.callOpenAIAPI(prompt, complexity);
      } else {
        throw new Error('不支援的 AI 服務提供商');
      }
    } catch (apiError) {
      console.error(`❌ ${this.settings.provider.toUpperCase()} API failed${retryInfo}:`, apiError.message);
      
      // 判斷是否可以重試
      const canRetry = retryCount < maxRetries && this.shouldRetry(apiError);
      
      if (canRetry) {
        console.log(`🔄 準備重試... (${retryCount + 1}/${maxRetries})`);
        
        // 重試前等待一段時間（指數回退）
        const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // 嘗試簡化版本（第二次重試時）
        if (retryCount === 1 && this.isTimeoutError(apiError)) {
          console.log('⚡ 使用簡化提示詞重試...');
          const simplePrompt = this.buildSimplePrompt(text, language);
          return await this.attemptAnalysisWithFallback(simplePrompt, text, language, retryCount + 1, maxRetries);
        }
        
        return await this.attemptAnalysisWithFallback(prompt, text, language, retryCount + 1, maxRetries);
      }
      
      // 將錯誤轉換為更友善的用戶消息
      throw this.createUserFriendlyError(apiError, retryCount);
    }
  }

  // 判斷是否應該重試
  shouldRetry(error) {
    const retryableErrors = [
      '超時',
      'timeout', 
      '網路錯誤',
      'network error',
      '429', // Rate limit
      '500', // Server error
      '502', // Bad gateway
      '503', // Service unavailable
      '504'  // Gateway timeout
    ];
    
    return retryableErrors.some(errorType => 
      error.message.toLowerCase().includes(errorType.toLowerCase())
    );
  }

  // 判斷是否為超時錯誤
  isTimeoutError(error) {
    return error.message.includes('超時') || error.message.includes('timeout');
  }

  // 創建用戶友善的錯誤消息
  createUserFriendlyError(originalError, retryCount) {
    const maxRetryMessage = retryCount > 0 ? ` (已重試 ${retryCount} 次)` : '';
    
    if (this.isTimeoutError(originalError)) {
      return new Error(`AI 分析超時${maxRetryMessage} - 建議：1) 檢查網路連線 2) 嘗試較短的文本 3) 稍後重試`);
    }
    
    if (originalError.message.includes('429')) {
      return new Error(`API 調用限制${maxRetryMessage} - 請稍後再試或檢查 API 配額`);
    }
    
    if (originalError.message.includes('401')) {
      return new Error('API 金鑰無效 - 請檢查設定頁面中的 API 金鑰配置');
    }
    
    return new Error(`AI 分析失敗${maxRetryMessage}: ${originalError.message}`);
  }

  // 建構提示詞 - 用戶可選擇複雜度
  buildPrompt(text, language) {
    const complexity = this.getAnalysisComplexity(text);
    console.log(`📝 Using ${complexity} complexity analysis`);
    
    switch (complexity) {
      case 'simple':
        return this.buildSimplePrompt(text, language);
      case 'medium':
        return this.buildMediumPrompt(text, language);
      case 'detailed':
        return this.buildProfessionalPrompt(text, language);
      default:
        return this.buildSimplePrompt(text, language);
    }
  }

  // 根據用戶設定和文本判斷複雜度
  getAnalysisComplexity(text) {
    const userChoice = this.settings.analysisComplexity;
    
    // If user has made a specific choice, use it
    if (userChoice === 'simple' || userChoice === 'medium' || userChoice === 'detailed') {
      return userChoice;
    }
    
    // Auto mode: intelligent selection based on text
    if (userChoice === 'auto') {
      return this.isSimpleText(text) ? 'simple' : 'medium';
    }
    
    return 'simple'; // fallback
  }

  // 判斷是否為簡單文本
  isSimpleText(text) {
    const wordCount = text.trim().split(/\s+/).length;
    const charCount = text.length;
    
    // Simple criteria for using basic prompt
    return (
      wordCount <= 6 ||           // 6 words or less
      charCount <= 50 ||          // 50 characters or less  
      /^[a-zA-Z\s,.'!?-]{1,50}$/.test(text.trim()) // Simple words with basic punctuation
    );
  }

  // 建構簡化提示詞 - 快速簡潔版本
  buildSimplePrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    
    const langName = languageNames[language] || '英語';
    const isWord = text.trim().split(/\s+/).length === 1;
    
    if (isWord) {
      return `分析${langName}單詞「${text}」：

📝 **中文翻譯**：[翻譯]
🗣️ **發音**：[音標] 
📚 **詞性**：[名詞/動詞/形容詞等]
💡 **例句**：[1個簡單例句]

請簡潔回應，每項1-2句話即可。`;
    } else {
      return `分析${langName}句子「${text}」：

📝 **中文翻譯**：[翻譯]
🧩 **逐詞解釋**：[每個詞的意思]
📖 **使用場景**：[什麼時候用這句話]

請簡潔回應，每項1-2句話即可。`;
    }
  }

  // 建構中等複雜度提示詞 - 平衡速度與詳細度
  buildMediumPrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    
    const langName = languageNames[language] || '英語';
    const isWord = text.trim().split(/\s+/).length === 1;
    
    if (isWord) {
      return `分析${langName}單詞「${text}」：

📝 **中文翻譯**：[翻譯]
🗣️ **發音指導**：[IPA音標] + [發音要點]
📚 **詞性與用法**：[詞性] + [使用方式]
💡 **例句**：[2個實用例句]
🔍 **詞彙變化**：[重要變化形式]
🌍 **使用場景**：[正式/非正式場合]

請適度詳細，每項2-3句話。`;
    } else {
      return `分析${langName}句子「${text}」：

📝 **中文翻譯**：[翻譯]
🧩 **逐詞解釋**：[每個重要詞的意思]
📖 **語法結構**：[句型分析]
🗣️ **發音要點**：[重音和語調]
💡 **使用場景**：[什麼時候用這句話]
🌍 **文化背景**：[簡單的文化說明]

請適度詳細，每項2-3句話。`;
    }
  }

  // 調用 Gemini API
  async callGeminiAPI(prompt, complexity = 'simple') {
    const timeouts = {
      'simple': 8000,    // 8 seconds
      'medium': 15000,   // 15 seconds  
      'detailed': 45000  // 45 seconds - plenty of time for complex analysis
    };
    const tokens = {
      'simple': 512,
      'medium': 1024,
      'detailed': 4096
    };
    
    const timeoutDuration = timeouts[complexity] || 8000;
    const maxTokens = tokens[complexity] || 512;
    const startTime = Date.now();
    console.log(`🤖 Calling Gemini API (${complexity}) at ${new Date().toISOString()}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Gemini API timeout triggered after ${timeoutDuration/1000}s at ${new Date().toISOString()}`);
        controller.abort();
      }, timeoutDuration);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.settings.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: maxTokens, // Dynamic based on complexity
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(`📥 Gemini response received: ${response.status} (took ${duration}ms)`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API Error:', errorData);
        
        if (response.status === 401) {
          throw new Error('API 金鑰無效 - 請檢查 Gemini API 設定');
        } else if (response.status === 429) {
          throw new Error('API 調用次數超限 - 請稍後再試');
        } else if (response.status === 400) {
          throw new Error('請求格式錯誤 - 請檢查設定');
        } else {
          throw new Error(`Gemini API 錯誤 ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      console.log('✅ Gemini API success');
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Gemini API 回應格式錯誤');
      }

      return {
        content: data.candidates[0].content.parts[0].text,
        provider: 'gemini',
        timestamp: Date.now()
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        const duration = Date.now() - startTime;
        console.log(`❌ Gemini API aborted after ${duration}ms`);
        throw new Error(`Gemini API 請求超時 (${duration}ms/${timeoutDuration}ms) - 網路可能較慢或 Google 服務繁忙，請稍後重試`);
      }
      console.error('❌ Gemini API call failed:', error);
      throw error;
    }
  }

  // 調用 OpenAI API
  async callOpenAIAPI(prompt, complexity = 'simple') {
    const timeouts = {
      'simple': 8000,    // 8 seconds
      'medium': 15000,   // 15 seconds  
      'detailed': 45000  // 45 seconds - plenty of time for complex analysis
    };
    const tokens = {
      'simple': 512,
      'medium': 1024,
      'detailed': 4096
    };
    
    const timeoutDuration = timeouts[complexity] || 8000;
    const maxTokens = tokens[complexity] || 512;
    const modelToUse = this.settings.openaiModel || 'gpt-4o-mini';
    const startTime = Date.now();
    console.log(`🤖 Calling OpenAI API (${complexity}) with model: ${modelToUse} at ${new Date().toISOString()}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ OpenAI API timeout triggered after ${timeoutDuration/1000}s at ${new Date().toISOString()}`);
        controller.abort();
      }, timeoutDuration);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: modelToUse, // Use selected model, default to cheapest
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.7,
          max_tokens: maxTokens // Dynamic based on complexity
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(`📥 OpenAI response received: ${response.status} (took ${duration}ms)`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API Error:', errorData);
        
        if (response.status === 401) {
          throw new Error('API 金鑰無效 - 請檢查 OpenAI API 設定');
        } else if (response.status === 429) {
          throw new Error('API 調用次數超限 - 請稍後再試');
        } else if (response.status === 400) {
          throw new Error('請求格式錯誤 - 請檢查設定');
        } else {
          throw new Error(`OpenAI API 錯誤 ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      console.log('✅ OpenAI API success');
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('OpenAI API 回應格式錯誤');
      }

      return {
        content: data.choices[0].message.content,
        provider: 'openai',
        timestamp: Date.now(),
        usage: data.usage
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        const duration = Date.now() - startTime;
        console.log(`❌ OpenAI API aborted after ${duration}ms`);
        throw new Error(`OpenAI API 請求超時 (${duration}ms/${timeoutDuration}ms) - 網路可能較慢或 OpenAI 服務繁忙，請稍後重試`);
      }
      console.error('❌ OpenAI API call failed:', error);
      throw error;
    }
  }

  // 檢測文本複雜度
  detectTextComplexity(text, language) {
    const wordCount = text.trim().split(/\s+/).length;
    const hasComplexPunctuation = /[;:,\-\(\)\"\']/g.test(text);
    const hasMultipleClauses = /[,;]/.test(text) || wordCount > 8;
    
    if (wordCount === 1) return 'beginner';
    if (wordCount <= 5 && !hasComplexPunctuation) return 'beginner';
    if (wordCount <= 12 && !hasMultipleClauses) return 'intermediate';
    return 'advanced';
  }

  // 🗣️ 發音指導部分
  buildPronunciationSection(language, isWord, complexity) {
    let section = `## 🗣️ 發音指導\n`;
    
    
    switch (language) {
      case 'english':
        section += `- **國際音標（IPA）：** 提供完整準確的 IPA 標記，包含重音符號\n`;
        section += `- **音節劃分：** 將單詞/短語按音節分解，標示重音位置\n`;
        section += `- **發音技巧：** 說明具體的舌位、唇形、氣流控制要點\n`;
        if (complexity !== 'beginner') {
          section += `- **語調模式：** 解釋句子的升降調變化和語調核心\n`;
          section += `- **連音現象：** 說明單詞間的連讀、省音、同化現象\n`;
        }
        section += `- **常見錯誤：** 指出華語使用者易犯的發音錯誤及糾正方法\n\n`;
        break;
        
      case 'dutch':
        section += `- **荷蘭語音標：** 提供準確的IPA音標轉寫，標注重音位置\n`;
        section += `- **發音特點：** 詳細解釋荷蘭語特有音素（如咽頭音 /x/、顫音 /r/）的具體發音方法\n`;
        section += `- **音長區別：** 說明長短元音的具體差異，提供對比例子\n`;
        section += `- **與英語對比：** 指出與英語發音的具體差異，幫助華語學習者理解\n`;
        if (complexity !== 'beginner') {
          section += `- **語調特色：** 說明荷蘭語的語調模式和重音規律\n`;
        }
        section += `- **學習建議：** 提供針對華語使用者的具體發音練習方法\n\n`;
        break;
        
      case 'japanese':
        section += `- **假名標記：** 提供平假名和片假名標記\n`;
        section += `- **羅馬音：** 提供標準羅馬字轉寫\n`;
        section += `- **音調模式：** 說明東京音調的高低音調變化\n`;
        section += `- **特殊音素：** 解釋促音、長音、拗音的發音要點\n`;
        if (complexity !== 'beginner') {
          section += `- **語調助詞：** 說明助詞的音調變化和語調作用\n`;
        }
        section += `- **發音注意：** 指出華語使用者需注意的日語發音特點\n\n`;
        break;
        
      case 'korean':
        section += `- **韓文標記：** 提供한글標準發音\n`;
        section += `- **國際音標：** 提供精確的 IPA 轉寫\n`;
        section += `- **音變規律：** 說明重要的音韻變化規則，如終聲規則\n`;
        section += `- **發音要點：** 解釋韓語特有的緊音、鬆音、送氣音區別\n`;
        if (complexity !== 'beginner') {
          section += `- **語調規律：** 說明韓語語調模式和語氣變化\n`;
        }
        section += `- **學習重點：** 指出華語使用者的韓語發音學習要點\n\n`;
        break;
    }
    
    return section;
  }

  // 📚 詞彙解釋部分
  buildVocabularySection(language, isWord, isSentence) {
    let section = `## 📚 詞彙解釋\n`;
    
    
    if (isWord) {
      section += `- **詞彙分析：** 指出詞性和基本定義\n`;
      section += `- **語義範圍：** 說明不同語境下的含義變化\n`;
      section += `- **搭配用法：** 提供常見的詞彙搭配和固定短語\n`;
      section += `- **近義詞群：** 比較意義相近詞彙的細微差別\n`;
      section += `- **反義詞：** 列出對應的反義詞和相關詞群\n`;
      section += `- **詞彙等級：** 說明使用頻率和正式程度\n`;
    } else {
      section += `- **詞彙分析：** 逐詞解釋，格式：詞彙（詞性）- 含義\n`;
      section += `- **詞彙難度：** 標示初中高級詞彙\n`;
      section += `- **同義替換：** 提供可替換的同義詞選項\n`;
    }
    
    section += `- **實用例句：** 提供3-4個不同語境的實用例句，含使用場景說明\n`;
    section += `- **記憶技巧：** 提供詞根詞綴分析或聯想記憶方法\n\n`;
    
    return section;
  }

  // 📝 語法分析部分 - 大幅增強
  buildGrammarSection(language, isWord, isSentence, complexity) {
    let section = `## 📝 語法分析\n`;
    
    
    if (isWord) {
      section += `- **詞彙語法：** 說明該詞的語法特性和使用規則\n`;
      section += `- **變化形式：** 提供時態、語態、數量等變化形式\n`;
      section += `- **句法功能：** 說明在句中可能承擔的語法角色\n`;
      section += `- **搭配語法：** 說明與其他詞類的語法搭配規則\n\n`;
    } else {
      // 句子的詳細語法分析
      section += `- **句型識別：** 判斷句型類別：陳述句、疑問句、祈使句等\n`;
      section += `- **主謂結構：** 分析主語、謂語、賓語的詳細結構\n`;
      section += `- **時態語態：** 說明具體時態形式及其表達的時間和動作狀態\n`;
      
      if (language === 'english') {
        section += `- **從句分析：** 分析主句和從句的關係，識別從句類型（名詞從句、形容詞從句、副詞從句）及其功能\n`;
        section += `- **語法成分：** 詳細分析定語、狀語、補語等修飾成分在句中的作用和位置\n`;
        section += `- **語法重點：** 指出句中重要的語法點和常見考試結構，解釋其語法規則\n`;
      } else if (language === 'dutch') {
        section += `- **語序規則：** 說明荷蘭語V2語序規則和從句中的語序變化規律\n`;
        section += `- **動詞變位：** 詳細分析動詞的人稱變化和時態變位規則\n`;
        section += `- **格變規律：** 解釋主格、賓格、所有格的具體使用情況和變化規則\n`;
      } else if (language === 'japanese') {
        section += `- **助詞分析：** 詳細說明句中各助詞的語法功能和具體用法\n`;
        section += `- **動詞活用：** 分析動詞的各種活用形式和敬語變化規則\n`;
        section += `- **語法模式：** 識別並解釋句型結構和常見的語法模式\n`;
      } else if (language === 'korean') {
        section += `- **語尾分析：** 分析動詞和形容詞語尾的變化形式及其表達的意義\n`;
        section += `- **助詞功能：** 分析主題助詞和格助詞在句中的具體作用和語法功能\n`;
        section += `- **敬語體系：** 說明敬語的等級分類和不同場合的使用規則\n`;
      }
      
      section += `- **語法變換：** 提供同義句轉換和不同表達方式\n`;
      section += `- **易錯分析：** 指出學習者常見語法錯誤和避免方法\n\n`;
    }
    
    return section;
  }

  // 🎯 句子結構分析部分 - 新增
  buildSentenceAnalysisSection(language, complexity) {
    let section = `## 🎯 句子結構分析\n`;
    
    
    section += `- **句子架構：** 提供完整的句法樹狀結構分析\n`;
    section += `- **語法層次：** 說明短語、從句的層次關係\n`;
    section += `- **語義關係：** 分析句子內部的語義邏輯關係\n`;
    section += `- **信息結構：** 說明主題、焦點、背景信息的分佈\n`;
    
    if (complexity === 'advanced') {
      section += `- **修辭特色：** 分析句式的修辭效果和語體特點\n`;
      section += `- **語用功能：** 說明句子的交際功能和語境適用性\n`;
    }
    
    section += `- **改寫練習：** 提供句式變換和表達優化建議\n\n`;
    
    return section;
  }

  // 🌍 文化背景部分 - 語言特定優化
  buildCulturalSection(language, isWord, complexity) {
    let section = `## 🌍 文化背景\n`;
    
    
    const culturalLabels = {
      'english': '英語文化',
      'dutch': '荷蘭文化',
      'japanese': '日本文化',
      'korean': '韓國文化'
    };
    
    const cultureName = culturalLabels[language] || '目標語言文化';
    
    section += `- **文化內涵：** 說明在${cultureName}中的特殊含義和文化象徵\n`;
    section += `- **使用場景：** 說明正式度、親密度、社會階層等使用條件\n`;
    section += `- **文化差異：** 指出與華語文化的主要差異和注意事項\n`;
    section += `- **社會語言學：** 分析年齡、性別、地區使用習慣的差異\n`;
    
    if (complexity !== 'beginner') {
      section += `- **語言變體：** 介紹方言、俚語、網絡用語等變體形式\n`;
      section += `- **歷史演變：** 說明詞彙或表達的歷史發展脈絡\n`;
    }
    
    section += `- **跨文化交際：** 提供使用時的文化敏感度和禮貌策略\n\n`;
    
    return section;
  }

  // Note: buildErrorDetectionSection removed - error detection is now integrated into all analysis sections

  // 📈 學習建議部分 - 新增
  buildLearningTipsSection(language, isWord, complexity) {
    let section = `## 📈 學習建議\n`;
    
    
    section += `- **記憶策略：** 提供針對性的記憶方法和技巧\n`;
    section += `- **練習重點：** 指出需要重點練習的語言技能\n`;
    section += `- **常見陷阱：** 指出學習過程中容易出錯的地方\n`;
    section += `- **拓展學習：** 提供相關的語言點和深入學習方向\n`;
    
    if (complexity === 'advanced') {
      section += `- **高階應用：** 提供進階使用技巧和語言藝術\n`;
    }
    
    section += `- **實用建議：** 提供日常使用和語言運用的實踐建議\n\n`;
    
    return section;
  }

  // 最終指示部分
  buildFinalInstructions(language, isWord, complexity) {
    const complexityNote = {
      'beginner': '請用簡潔明了的語言解釋，適合初學者理解。',
      'intermediate': '請提供中等深度的分析，幫助中級學習者提升。',
      'advanced': '請進行深入分析，包含進階語言學概念。'
    };
    
    let instructions = `\n**🚨 重要分析要求 🚨：**\n` +
           `1. ${complexityNote[complexity]}\n` +
           `2. **絕對禁止使用占位符**：不要寫 [需要提供...]、[可以描述...]、[提供...]等方括號內容\n` +
           `3. **提供具體內容**：每個分析點都要有具體的實際內容，不能空泛或敷衍\n` +
           `4. **實際的音標和例句**：提供真實的IPA音標、具體的例句和使用場合\n` +
           `5. **詳細的語法解釋**：具體說明語法規則，不要只說概念名稱\n` +
           `6. **文化背景要具體**：提供實際的文化情境和使用習慣\n` +
           `7. ${isWord ? '單詞分析要全面細致，包含詞彙的各個層面。' : '句子分析要層次清晰，語法解釋要具體準確。'}\n` +
           `8. **如果不確定某個內容，寧可承認不確定，也不要用占位符敷衍**`;
           
    // Add error detection specific instructions if enabled
    if (this.settings.features.errorDetection) {
      instructions += `\n\n**🔍 錯誤檢測特別提醒：**\n` +
                     `- 如果您在第一步判斷文本有錯誤，請在每個分析部分專注於錯誤糾正\n` +
                     `- 如果您在第一步判斷文本完全正確，請完全忽略錯誤檢測，進行標準分析\n` +
                     `- 不要在正確文本的分析中添加任何錯誤檢測相關的內容`;
    }
    
    return instructions;
  }

  // 判斷是否為簡單文本
  isSimpleText(text) {
    const wordCount = text.trim().split(/\s+/).length;
    const charCount = text.length;
    
    // Simple criteria for using basic prompt
    return (
      wordCount <= 6 ||           // 6 words or less
      charCount <= 50 ||          // 50 characters or less  
      /^[a-zA-Z\s,.'!?-]{1,50}$/.test(text.trim()) // Simple words with basic punctuation
    );
  }

  // 建構簡化提示詞 - 快速簡潔版本
  buildSimplePrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    
    const langName = languageNames[language] || '英語';
    const isWord = text.trim().split(/\s+/).length === 1;
    
    if (isWord) {
      return `分析${langName}單詞「${text}」：

📝 **中文翻譯**：[翻譯]
🗣️ **發音**：[音標] 
📚 **詞性**：[名詞/動詞/形容詞等]
💡 **例句**：[1個簡單例句]

請簡潔回應，每項1-2句話即可。`;
    } else {
      return `分析${langName}句子「${text}」：

📝 **中文翻譯**：[翻譯]
🧩 **逐詞解釋**：[每個詞的意思]
📖 **使用場景**：[什麼時候用這句話]

請簡潔回應，每項1-2句話即可。`;
    }
  }

  // 建構中等複雜度提示詞 - 平衡速度與詳細度
  buildMediumPrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    
    const langName = languageNames[language] || '英語';
    const isWord = text.trim().split(/\s+/).length === 1;
    
    if (isWord) {
      return `分析${langName}單詞「${text}」：

📝 **中文翻譯**：[翻譯]
🗣️ **發音指導**：[IPA音標] + [發音要點]
📚 **詞性與用法**：[詞性] + [使用方式]
💡 **例句**：[2個實用例句]
🔍 **詞彙變化**：[重要變化形式]
🌍 **使用場景**：[正式/非正式場合]

請適度詳細，每項2-3句話。`;
    } else {
      return `分析${langName}句子「${text}」：

📝 **中文翻譯**：[翻譯]
🧩 **逐詞解釋**：[每個重要詞的意思]
📖 **語法結構**：[句型分析]
🗣️ **發音要點**：[重音和語調]
💡 **使用場景**：[什麼時候用這句話]
🌍 **文化背景**：[簡單的文化說明]

請適度詳細，每項2-3句話。`;
    }
  }

  // 調用 Gemini API
  async callGeminiAPI(prompt, complexity = 'simple') {
    const timeouts = {
      'simple': 8000,    // 8 seconds
      'medium': 15000,   // 15 seconds  
      'detailed': 45000  // 45 seconds - plenty of time for complex analysis
    };
    const tokens = {
      'simple': 512,
      'medium': 1024,
      'detailed': 4096
    };
    
    const timeoutDuration = timeouts[complexity] || 8000;
    const maxTokens = tokens[complexity] || 512;
    const startTime = Date.now();
    console.log(`🤖 Calling Gemini API (${complexity}) at ${new Date().toISOString()}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Gemini API timeout triggered after ${timeoutDuration/1000}s at ${new Date().toISOString()}`);
        controller.abort();
      }, timeoutDuration);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.settings.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: maxTokens, // Dynamic based on complexity
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(`📥 Gemini response received: ${response.status} (took ${duration}ms)`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API Error:', errorData);
        
        if (response.status === 401) {
          throw new Error('API 金鑰無效 - 請檢查 Gemini API 設定');
        } else if (response.status === 429) {
          throw new Error('API 調用次數超限 - 請稍後再試');
        } else if (response.status === 400) {
          throw new Error('請求格式錯誤 - 請檢查設定');
        } else {
          throw new Error(`Gemini API 錯誤 ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      console.log('✅ Gemini API success');
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Gemini API 回應格式錯誤');
      }

      return {
        content: data.candidates[0].content.parts[0].text,
        provider: 'gemini',
        timestamp: Date.now()
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        const duration = Date.now() - startTime;
        console.log(`❌ Gemini API aborted after ${duration}ms`);
        throw new Error(`Gemini API 請求超時 (${duration}ms/${timeoutDuration}ms) - 網路可能較慢或 Google 服務繁忙，請稍後重試`);
      }
      console.error('❌ Gemini API call failed:', error);
      throw error;
    }
  }


  // 測試 API 連接
  async testConnection() {
    if (!this.isAvailable()) {
      return { success: false, error: 'AI 服務未啟用或未配置' };
    }

    try {
      const testPrompt = 'Please respond with "Connection successful" to test the API.';
      
      if (this.settings.provider === 'gemini') {
        await this.callGeminiAPI(testPrompt);
      } else {
        await this.callOpenAIAPI(testPrompt);
      }
      
      return { success: true, provider: this.settings.provider };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 診斷網路和 API 狀態
  async runDiagnostics() {
    console.log('🔍 開始 AI 服務診斷...');
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // 1. 網路連線測試
    console.log('1️⃣ 測試網路連線...');
    const networkTest = await this.checkNetworkConnectivity();
    results.tests.network = {
      connected: networkTest.connected,
      latency: networkTest.latency,
      status: networkTest.status || 'failed',
      error: networkTest.error
    };
    console.log('網路測試結果:', networkTest);

    // 2. OpenAI API 直接測試
    if (this.settings.provider === 'openai') {
      console.log('2️⃣ 測試 OpenAI API 直接連線...');
      try {
        const startTime = Date.now();
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${this.settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        });
        const duration = Date.now() - startTime;
        
        results.tests.openai_direct = {
          success: response.ok,
          status: response.status,
          duration: duration,
          rate_limited: response.status === 429
        };
        console.log('OpenAI 直接測試結果:', results.tests.openai_direct);
      } catch (error) {
        results.tests.openai_direct = {
          success: false,
          error: error.message,
          timeout: error.name === 'TimeoutError'
        };
        console.log('OpenAI 直接測試失敗:', error.message);
      }
    }

    // 3. 簡單 API 調用測試
    console.log('3️⃣ 測試簡單 API 調用...');
    try {
      const startTime = Date.now();
      const result = await this.testConnection();
      const duration = Date.now() - startTime;
      
      results.tests.api_call = {
        success: result.success,
        duration: duration,
        provider: this.settings.provider,
        error: result.error
      };
      console.log('API 調用測試結果:', results.tests.api_call);
    } catch (error) {
      results.tests.api_call = {
        success: false,
        error: error.message,
        provider: this.settings.provider
      };
    }

    // 4. 產生診斷報告
    const report = this.generateDiagnosticReport(results);
    console.log('🏁 診斷完成:', report);
    return report;
  }

  // 產生診斷報告
  generateDiagnosticReport(results) {
    const { network, openai_direct, api_call } = results.tests;
    let diagnosis = '✅ 一切正常';
    let recommendations = [];

    // 網路問題
    if (!network.connected) {
      diagnosis = '❌ 網路連線問題';
      recommendations.push('檢查網路連線');
      recommendations.push('嘗試重新連線 WiFi');
      recommendations.push('檢查防火牆設定');
    } else if (network.latency > 3000) {
      diagnosis = '⚠️ 網路速度較慢';
      recommendations.push('網路延遲較高，可能影響 API 回應速度');
    }

    // OpenAI 特定問題
    if (openai_direct && !openai_direct.success) {
      if (openai_direct.rate_limited) {
        diagnosis = '⚠️ OpenAI API 使用量限制';
        recommendations.push('已達到 API 使用限制，請稍後再試');
        recommendations.push('考慮升級 OpenAI 方案');
      } else if (openai_direct.timeout) {
        diagnosis = '⚠️ OpenAI 服務回應緩慢';
        recommendations.push('OpenAI 服務可能繁忙，建議稍後再試');
        recommendations.push('考慮切換到 Gemini API');
      } else {
        diagnosis = '❌ OpenAI API 連線問題';
        recommendations.push('檢查 API 金鑰是否正確');
        recommendations.push('確認 OpenAI 帳戶狀態');
      }
    }

    // API 調用問題
    if (api_call && !api_call.success) {
      recommendations.push('嘗試重新載入頁面');
      recommendations.push('檢查瀏覽器擴充功能設定');
    }

    return {
      diagnosis,
      recommendations,
      raw_results: results,
      summary: {
        network_ok: network.connected,
        network_speed: network.latency < 3000 ? 'good' : 'slow',
        api_ok: api_call?.success || false,
        overall_status: diagnosis.includes('✅') ? 'healthy' : 
                       diagnosis.includes('⚠️') ? 'warning' : 'error'
      }
    };
  }

  // 文本潤飾 - 專門用於改善轉錄質量
  async polishText(text) {
    if (!this.isAvailable()) {
      console.log('AI service not available, using fallback cleaning');
      return this.fallbackTextPolish(text);
    }

    try {
      const prompt = `Please polish and improve this transcript text to make it more readable and grammatically correct. Fix any obvious errors, add proper punctuation, and improve clarity while maintaining the original meaning and style:

"${text}"

Return only the polished text, no explanations.`;

      console.log('✨ Polishing text with AI:', text.substring(0, 50) + '...');
      
      let result = null;
      
      if (this.settings.provider === 'gemini') {
        result = await this.callGeminiAPI(prompt);
      } else if (this.settings.provider === 'openai') {
        result = await this.callOpenAIAPI(prompt);
      }
      
      if (result && result.success) {
        console.log('✨ AI polish successful:', result.analysis.substring(0, 50) + '...');
        return result.analysis.trim();
      } else {
        throw new Error('AI polish failed');
      }
    } catch (error) {
      console.log('AI polish error, using fallback:', error.message);
      return this.fallbackTextPolish(text);
    }
  }

  // 備用文本潤飾方法
  fallbackTextPolish(text) {
    return text
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\b(\w+)\s+\1\b/g, '$1') // Remove word repetitions
      .replace(/\b(A\s+nd|I\s+m|the\s+y|a\s+bout|a\s+gain|so\s+ft)\b/gi, (match) => {
        return match.replace(/\s+/g, ''); // Fix broken words
      })
      .replace(/\b(don\s+t|can\s+t|won\s+t|isn\s+t|aren\s+t)\b/gi, (match) => {
        return match.replace(/\s+/g, '');
      })
      .replace(/\bamonth\b/gi, 'a month')
      .replace(/\breallyunderstand\b/gi, 'really understand') 
      .replace(/\brealmwhere\b/gi, 'realm where')
      .replace(/\bthisis\b/gi, 'this is')
      .replace(/\bmeaningfulrevenue\b/gi, 'meaningful revenue')
      .replace(/\beveryweek\b/gi, 'every week')
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between merged words
      .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => punct + ' ' + letter.toUpperCase())
      .trim()
      .replace(/^./, str => str.toUpperCase())
      .replace(/^(.{15,}[^.!?])$/, '$1.'); // Add period if needed
  }

  // 生成語音發音 - 簡化版本
  async generateAudio(text, language) {
    console.log('🎵 Starting audio generation...');
    
    if (!this.isAvailable() || !this.settings.features.audioPronunciation) {
      throw new Error('語音功能未啟用或不可用');
    }

    if (this.settings.provider !== 'openai') {
      throw new Error('語音功能需要 OpenAI API');
    }

    if (!this.settings.apiKey) {
      throw new Error('未配置 OpenAI API 金鑰');
    }

    try {
      const processedText = this.preprocessTextForTTS(text, language);
      console.log('🔤 Text to convert:', processedText);
      
      console.log('📡 Sending request to OpenAI...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for TTS
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: processedText,
          voice: this.settings.audio.voice || 'alloy',
          speed: this.settings.audio.speed || 1.0,
          response_format: 'mp3'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📥 Response received:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('API 金鑰無效 - 請檢查設定');
        } else if (response.status === 429) {
          throw new Error('API 調用次數超限 - 請稍後再試');
        } else {
          throw new Error(`API 錯誤 ${response.status}`);
        }
      }

      console.log('🔧 Converting to audio blob...');
      const audioBuffer = await response.arrayBuffer();
      
      if (audioBuffer.byteLength === 0) {
        throw new Error('收到空音頻數據');
      }
      
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('✅ Audio generation successful!', {
        size: audioBuffer.byteLength,
        url: audioUrl.substring(0, 50) + '...'
      });

      return {
        audioUrl,
        audioBlob,
        text: processedText,
        voice: this.settings.audio.voice || 'alloy',
        speed: this.settings.audio.speed || 1.0,
        timestamp: Date.now(),
        size: audioBuffer.byteLength
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('語音生成請求超時 (10秒) - 請檢查網路連線');
      }
      console.error('❌ Audio generation failed:', error);
      throw error;
    }
  }

  // 預處理文本以適合 TTS
  preprocessTextForTTS(text, language) {
    // 移除多餘的空白和特殊字符
    let processed = text.trim().replace(/\s+/g, ' ');
    
    // 針對不同語言進行優化
    switch (language) {
      case 'english':
      case 'dutch':
        // 拉丁字母語言，保持原樣但確保正確的句號
        if (!processed.match(/[.!?]$/)) {
          processed += '.';
        }
        break;
      case 'japanese':
        // 日語文本處理
        processed = processed.replace(/。$/, '');
        break;
      case 'korean':
        // 韓語文本處理
        processed = processed.replace(/\.$/, '');
        break;
    }

    // 限制長度以避免 API 限制
    if (processed.length > 4000) {
      processed = processed.substring(0, 4000) + '...';
    }

    return processed;
  }

  // 檢查是否支援語音功能
  isAudioAvailable() {
    return this.isAvailable() && 
           this.settings.features.audioPronunciation && 
           this.settings.provider === 'openai';
  }

  // 格式化分析結果為 HTML
  formatAnalysisHTML(analysis) {
    if (!analysis || !analysis.content) {
      return '<div class="ai-error">AI 分析失敗</div>';
    }

    // 將 Markdown 格式轉換為 HTML
    let html = analysis.content
      .replace(/^## (.*$)/gm, '<h3 class="ai-section-title">$1</h3>')
      .replace(/^\*\*(.*?):\*\*/gm, '<strong class="ai-label">$1:</strong>')
      .replace(/^\- (.*$)/gm, '<div class="ai-item">• $1</div>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    return `
      <div class="ai-analysis">
        <div class="ai-content">${html}</div>
        <div class="ai-footer">
          <small>由 ${analysis.provider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'} 生成 • ${new Date(analysis.timestamp).toLocaleTimeString()}</small>
        </div>
      </div>
    `;
  }

  // Generate concise flashcard content optimized for flashcard learning
  async generateFlashcardContent(text, language, retryCount = 0, maxRetries = 2) {
    if (!this.isAvailable()) {
      throw new Error('AI service not available or not configured');
    }

    try {
      const prompt = this.buildFlashcardPrompt(text, language);
      console.log('🃏 Generated flashcard prompt for:', text);
      
      return await this.attemptFlashcardAnalysisWithFallback(prompt, text, language, retryCount, maxRetries);
    } catch (error) {
      console.error('🚨 Flashcard content generation failed:', error);
      throw error;
    }
  }

  // Build concise prompt specifically for flashcard content
  buildFlashcardPrompt(text, language) {
    const detectedLanguage = language || this.detectLanguage(text);
    
    // Map language codes to user-friendly names
    const languageNames = {
      'english': 'English',
      'japanese': 'Japanese', 
      'korean': 'Korean',
      'dutch': 'Dutch',
      'chinese': 'Chinese'
    };

    const langName = languageNames[detectedLanguage] || detectedLanguage;
    
    // Determine target translation language based on source
    let targetLang = 'Traditional Chinese';
    if (detectedLanguage === 'chinese') {
      targetLang = 'English';
    }

    return `You are creating concise flashcard content for language learning. Keep responses brief and focused.

INPUT: "${text}" (${langName})

Generate ONLY the following, each on a separate line:

TRANSLATION: [Single best ${targetLang} translation - max 3 words if possible]
PRONUNCIATION: [IPA notation or phonetic guide - concise]
CONTEXT: [One short example sentence showing usage]
MEMORY_TIP: [Brief mnemonic or association to help remember - optional]

Requirements:
- Translation must be concise and practical for flashcards
- Pronunciation should be clear and accurate  
- Context sentence should be simple and natural
- Memory tip should be creative but brief
- Keep each line under 50 characters when possible
- Focus on the most common/useful meaning

Format exactly as shown above with the labels.`;
  }

  // Attempt flashcard content generation with fallback
  async attemptFlashcardAnalysisWithFallback(prompt, text, language, retryCount, maxRetries) {
    const startTime = Date.now();
    
    try {
      let result;
      
      if (this.settings.provider === 'gemini') {
        result = await this.callGeminiFlashcard(prompt);
      } else {
        result = await this.callOpenAIFlashcard(prompt); 
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Flashcard content generated in ${duration}ms`);
      
      return this.parseFlashcardResponse(result, text, language);
      
    } catch (error) {
      console.error(`❌ Flashcard generation attempt ${retryCount + 1} failed:`, error);
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying flashcard generation (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.attemptFlashcardAnalysisWithFallback(prompt, text, language, retryCount + 1, maxRetries);
      }
      
      throw error;
    }
  }

  // Call Gemini API for flashcard content
  async callGeminiFlashcard(prompt) {
    if (!this.settings?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.settings.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent results
          maxOutputTokens: 200, // Limit output for concise responses
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // Call OpenAI API for flashcard content  
  async callOpenAIFlashcard(prompt) {
    if (!this.settings?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.openaiModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for consistency
        max_tokens: 200, // Limit output for concise responses
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Parse the AI response into structured flashcard data
  parseFlashcardResponse(response, originalText, language) {
    console.log('🃏 Parsing flashcard response:', response);

    const result = {
      originalText,
      language,
      translation: '',
      pronunciation: '',
      context: '',
      memoryTip: '',
      timestamp: Date.now(),
      provider: this.settings.provider
    };

    try {
      const lines = response.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const cleaned = line.trim();
        
        if (cleaned.startsWith('TRANSLATION:')) {
          result.translation = cleaned.replace('TRANSLATION:', '').trim();
        } else if (cleaned.startsWith('PRONUNCIATION:')) {
          result.pronunciation = cleaned.replace('PRONUNCIATION:', '').trim();
        } else if (cleaned.startsWith('CONTEXT:')) {
          result.context = cleaned.replace('CONTEXT:', '').trim();
        } else if (cleaned.startsWith('MEMORY_TIP:')) {
          result.memoryTip = cleaned.replace('MEMORY_TIP:', '').trim();
        }
      }

      // Fallback if parsing failed
      if (!result.translation) {
        result.translation = response.substring(0, 30).trim() + '...';
      }

    } catch (error) {
      console.error('Failed to parse flashcard response:', error);
      result.translation = 'Parsing failed';
      result.context = response.substring(0, 50).trim();
    }

    return result;
  }
}

// 導出 AI 服務實例 - 確保全域可用
let aiService;
if (typeof window !== 'undefined') {
  // 瀏覽器環境
  window.AIService = AIService;
  aiService = new AIService();
  window.aiService = aiService;
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js 環境
  aiService = new AIService();
  module.exports = { AIService, aiService };
}