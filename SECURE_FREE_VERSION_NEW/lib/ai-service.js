// AI 服務整合模組 - 支援 Gemini 和 OpenAI
// AI prompt templates should be loaded by background.js before this module

// Production-safe logging
const log = (...args) => {
  if (typeof PerformanceUtils !== 'undefined') {
    PerformanceUtils.log(...args);
  } else if (!chrome.runtime.getManifest().name.includes('Dev')) {
    return;
  } else {
    console.log(...args);
  }
};

class AIService {
  constructor() {
    this.settings = null;
    this.isInitialized = false;
    this.interfaceLanguage = 'zh_TW'; // Default to Traditional Chinese
    this.isFreeVersion = true; // Free version with secure API proxy
    this.dailyUsageLimit = 100; // 100 API calls per day limit
    this.apiProxyUrl = 'https://youglish-api-public.vercel.app/api/ai-analyze'; // Secure API endpoint
  }

  /**
   * 🆓 Free Version: Uses Secure API Proxy
   * No API key needed - all handled securely on server
   */
  getSecureApiUrl() {
    return this.apiProxyUrl;
  }

  /**
   * 🔒 Secure API Proxy Call - Free Version
   * Calls our secure serverless function instead of OpenAI directly
   */
  async callSecureProxy(prompt, complexity = 'simple') {
    // Detect if this is Japanese content (needs longer timeout)
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(prompt);
    const timeout = isJapanese ? 25000 : 15000; // 25s for Japanese, 15s for others
    const maxTokens = isJapanese ? (complexity === 'simple' ? 768 : 1536) : (complexity === 'simple' ? 512 : 1024);
    
    // Try user's API key FIRST if available (more reliable than proxy)
    if (this.settings && this.settings.apiKey && this.settings.apiProvider === 'openai') {
      console.log('🔑 User API key available, trying direct OpenAI call...');
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${this.settings.apiKey}`
          },
          body: JSON.stringify({
            model: this.settings.openaiModel || 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: prompt
            }],
            max_tokens: maxTokens,
            temperature: 0.7
          }),
          signal: AbortSignal.timeout(timeout)
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ User API key worked!');
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            return {
              content: data.choices[0].message.content,
              provider: 'openai-user',
              timestamp: Date.now(),
              usage: data.usage
            };
          }
        } else {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          console.warn(`⚠️ User API key failed with status: ${response.status}`);
          console.warn(`⚠️ Error response: ${errorText}`);
        }
      } catch (apiError) {
        console.warn('⚠️ User API key call failed:', apiError.message);
      }
    }
    
    // Fallback to proxy if user API key not available or failed
    console.log('🛡️ Attempting to call Secure API Proxy...');
    
    try {
      // Ensure UTF-8 encoding for Japanese and other Unicode characters
      const requestBody = JSON.stringify({
        messages: [{
          role: 'user',
          content: prompt
        }],
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        temperature: 0.7
      });
      
      console.log('📤 API Request body length:', requestBody.length, 'characters');
      console.log('📤 Contains Japanese chars:', isJapanese, '(timeout:', timeout + 'ms, tokens:', maxTokens + ')');
      
      const response = await fetch(this.getSecureApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        },
        body: requestBody,
        signal: AbortSignal.timeout(timeout)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Secure API Proxy success!');
        
        if (data.success && data.content) {
          return {
            content: data.content,
            provider: 'openai-proxy',
            timestamp: Date.now(),
            usage: data.usage_stats,
            freeUsage: data.usage
          };
        }
      } else {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.warn(`⚠️ Secure API Proxy failed with status: ${response.status}`);
        console.warn(`⚠️ Error response: ${errorText}`);
      }
    } catch (error) {
      console.warn('⚠️ Secure API Proxy call failed:', error.message);
      console.warn('⚠️ Full error:', error);
    }
    
    // Both user API key and proxy failed
    
    // Return error message instead of demo response
    console.log('❌ Both proxy and user API key failed');
    
    // Get UI language settings
    await this.getInterfaceLanguage();
    const isEnglishUI = this.interfaceLanguage === 'en';
    
    const errorMessage = isEnglishUI ? 
      `## ⚠️ API Connection Failed

**Free Version Limits**: 100 calls per day per user

**What happened**: The secure API proxy is currently unavailable, and no user API key is configured.

**Solutions**:
1. **Wait and retry**: The proxy might be temporarily down
2. **Add your API key**: Go to Settings → Add your OpenAI API key for unlimited usage
3. **Check network**: Ensure you have internet connection

**Get OpenAI API Key**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)` :
      `## ⚠️ API 連線失敗

**免費版限制**: 每位使用者每天 100 次呼叫

**問題**: 安全 API 代理目前無法使用，且未設定使用者 API 金鑰。

**解決方案**:
1. **等待重試**: 代理可能暫時故障
2. **添加 API 金鑰**: 前往設定 → 添加您的 OpenAI API 金鑰以無限制使用
3. **檢查網路**: 確保您有網路連線

**取得 OpenAI API 金鑰**: 造訪 [OpenAI Platform](https://platform.openai.com/api-keys)`;

    return {
      content: errorMessage,
      provider: 'error',
      timestamp: Date.now(),
      usage: { used: 0, remaining: 100, limit: 100 },
      error: true
    };
    
    /* Original API call code (temporarily disabled due to Vercel auth issues)
    const timeouts = {
      'simple': 15000,   // 15 seconds for proxy calls
      'medium': 30000,   // 30 seconds
      'detailed': 60000  // 60 seconds
    };
    const tokens = {
      'simple': 512,
      'medium': 1024,
      'detailed': 4096
    };
    
    const timeoutDuration = timeouts[complexity] || 15000;
    const maxTokens = tokens[complexity] || 512;
    const startTime = Date.now();
    
    console.log(`🛡️ Calling Secure API Proxy (${complexity}) - Free Version`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Secure API Proxy timeout after ${timeoutDuration/1000}s`);
        controller.abort();
      }, timeoutDuration);
      
      const response = await fetch(this.getSecureApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: prompt
          }],
          model: 'gpt-4o-mini',
          max_tokens: maxTokens,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(`📥 Secure API Proxy response: ${response.status} (${duration}ms)`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Secure API Proxy Error:', errorData);
        
        if (response.status === 429) {
          // Rate limited - user has exceeded daily limit
          throw new Error(errorData.message || '今日免費 AI 分析次數已達上限 (100 次)，請明天再試。');
        } else if (response.status >= 500) {
          throw new Error('AI 服務暫時不可用，請稍後再試。');
        } else {
          throw new Error(errorData.message || 'AI 分析發生錯誤，請稍後再試。');
        }
      }

      const data = await response.json();
      
      if (!data.success || !data.content) {
        throw new Error('AI 回應格式錯誤');
      }

      // Update local usage tracking if provided by the proxy
      if (data.usage) {
        console.log(`📊 Free Version Usage: ${data.usage.used}/${data.usage.limit} (${data.usage.remaining} remaining)`);
        
        // Store usage info locally for display
        try {
          const today = new Date().toDateString();
          await chrome.storage.local.set({
            freeUsage: {
              date: today,
              used: data.usage.used,
              limit: data.usage.limit,
              remaining: data.usage.remaining
            }
          });
        } catch (e) {
          console.warn('Could not store usage info:', e);
        }
      }

      console.log('✅ Secure API Proxy success - Free Version');
      
      return {
        content: data.content,
        provider: 'openai-proxy',
        timestamp: Date.now(),
        usage: data.usage_stats,
        freeUsage: data.usage
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        const duration = Date.now() - startTime;
        console.log(`❌ Secure API Proxy aborted after ${duration}ms`);
        throw new Error(`AI 請求超時 (${duration}ms) - 請檢查網路連線或稍後重試`);
      }
      console.error('❌ Secure API Proxy call failed:', error);
      throw error;
    }
    */
  }

  /**
   * 🎵 Secure Audio Proxy Call - Free Version
   * Calls our secure TTS serverless function instead of OpenAI directly
   */
  async callSecureAudioProxy(text, language) {
    console.log('🎵 Calling Secure Audio Proxy - Free Version');
    
    try {
      const processedText = this.preprocessTextForTTS(text, language);
      console.log('🔤 Text to convert:', processedText);
      
      const response = await fetch('https://youglish-api-public.vercel.app/api/audio-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: processedText,
          model: 'tts-1',
          voice: this.settings.audio.voice || 'alloy',
          response_format: 'mp3',
          speed: this.settings.audio.speed || 1.0
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - user has exceeded daily limit
          throw new Error('今日免費語音生成次數已達上限 (10 次)，請明天再試。');
        } else if (response.status >= 500) {
          throw new Error('語音服務暫時不可用，請稍後再試。');
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || '語音生成發生錯誤，請稍後再試。');
        }
      }

      // Get usage info from headers
      const usageUsed = response.headers.get('x-usage-count');
      const usageLimit = response.headers.get('x-usage-limit');
      const usageRemaining = response.headers.get('x-usage-remaining');
      
      if (usageUsed && usageLimit) {
        console.log(`🎵 Free Audio Usage: ${usageUsed}/${usageLimit} (${usageRemaining} remaining)`);
      }

      // Get audio data
      const audioArrayBuffer = await response.arrayBuffer();
      
      if (audioArrayBuffer.byteLength === 0) {
        throw new Error('收到空音頻數據');
      }
      
      const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('🎵 Secure Audio Proxy success - Free Version', {
        size: audioArrayBuffer.byteLength,
        url: audioUrl.substring(0, 50) + '...'
      });
      
      return {
        audioUrl,
        audioBlob,
        text: processedText,
        voice: this.settings.audio.voice || 'alloy',
        speed: this.settings.audio.speed || 1.0,
        timestamp: Date.now(),
        size: audioArrayBuffer.byteLength,
        usage: {
          used: parseInt(usageUsed) || 0,
          limit: parseInt(usageLimit) || 10,
          remaining: parseInt(usageRemaining) || 10
        }
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`❌ Secure Audio Proxy aborted`);
        throw new Error('語音生成超時 - 請檢查網路連線或稍後重試');
      }
      console.error('❌ Secure Audio Proxy call failed:', error);
      throw error;
    }
  }

  /**
   * 📊 Usage Tracking System for Alpha Test
   */
  async checkDailyUsage() {
    const today = new Date().toDateString();
    
    try {
      const result = await chrome.storage.local.get(['alphaUsage']);
      const usage = result.alphaUsage || {};
      
      // Reset counter if it's a new day
      if (usage.date !== today) {
        usage.date = today;
        usage.count = 0;
        await chrome.storage.local.set({ alphaUsage: usage });
      }
      
      return {
        used: usage.count || 0,
        remaining: Math.max(0, this.dailyUsageLimit - (usage.count || 0)),
        limit: this.dailyUsageLimit,
        date: today
      };
    } catch (error) {
      console.error('Error checking usage:', error);
      return { used: 0, remaining: this.dailyUsageLimit, limit: this.dailyUsageLimit, date: today };
    }
  }

  /**
   * 📈 Increment Usage Counter
   */
  async incrementUsage() {
    const today = new Date().toDateString();
    
    try {
      const result = await chrome.storage.local.get(['alphaUsage']);
      const usage = result.alphaUsage || { date: today, count: 0 };
      
      // Reset if new day
      if (usage.date !== today) {
        usage.date = today;
        usage.count = 0;
      }
      
      usage.count = (usage.count || 0) + 1;
      await chrome.storage.local.set({ alphaUsage: usage });
      
      console.log(`📊 Alpha Test Usage: ${usage.count}/${this.dailyUsageLimit} today`);
      
      return usage.count;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      return 1;
    }
  }

  // Get current interface language from storage
  async getInterfaceLanguage() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['uiLanguage', 'aiResponseLanguage'], resolve);
      });
      
      // Priority: aiResponseLanguage > uiLanguage > default
      let interfaceLang = result.aiResponseLanguage || result.uiLanguage || 'auto';
      
      // Convert 'auto' to actual language based on uiLanguage
      if (interfaceLang === 'auto') {
        interfaceLang = result.uiLanguage || 'zh_TW';
      }
      
      // Map interface language codes
      const langMap = {
        'auto': 'zh_TW',
        'zh': 'zh_TW',
        'zh-TW': 'zh_TW',
        'zh-CN': 'zh_TW', // Use Traditional Chinese for now
        'en': 'en',
        'ja': 'zh_TW', // Use Chinese for Japanese interface for now
        'ko': 'zh_TW', // Use Chinese for Korean interface for now  
        'nl': 'zh_TW'  // Use Chinese for Dutch interface for now
      };
      
      this.interfaceLanguage = langMap[interfaceLang] || 'zh_TW';
      console.log(`🌐 Interface language detected: ${interfaceLang} -> ${this.interfaceLanguage}`);
      
      return this.interfaceLanguage;
    } catch (error) {
      console.warn('Failed to get interface language:', error);
      return 'zh_TW';
    }
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

  // 初始化 AI 服務 - Free Version with Secure Proxy
  async initialize() {
    try {
      if (this.isFreeVersion) {
        // Free Version: No API key needed, uses secure proxy
        console.log('🆓 Initializing Free Version AI Service (Secure Proxy)');
        
        // Load basic user preferences
        const result = await chrome.storage.sync.get([
          'pronunciationGuide', 'wordExplanation', 'grammarAnalysis', 
          'culturalContext', 'audioPronunciation', 'errorDetection', 
          'ttsVoice', 'speechSpeed', 'autoPlayAudio', 'analysisComplexity'
        ]);
        
        this.settings = {
          enabled: true, // Always enabled for free version
          provider: 'openai-proxy', // Use secure proxy
          openaiModel: 'gpt-4o-mini', // Fixed cost-effective model
          apiKey: 'SECURE_PROXY', // Placeholder - actual key is on server
          features: {
            pronunciationGuide: result.pronunciationGuide !== false,
            wordExplanation: result.wordExplanation !== false,
            grammarAnalysis: result.grammarAnalysis !== false,
            culturalContext: result.culturalContext !== false,
            audioPronunciation: result.audioPronunciation !== false,
            errorDetection: result.errorDetection === true,
            contextualExamples: result.contextualExamples !== false
          },
          audio: {
            voice: result.ttsVoice || 'alloy',
            speed: parseFloat(result.speechSpeed) || 1.0,
            autoPlay: result.autoPlayAudio || false
          },
          analysisComplexity: result.analysisComplexity || 'auto'
        };
        
        // Get usage info from proxy server
        try {
          const localUsage = await chrome.storage.local.get(['freeUsage']);
          if (localUsage.freeUsage && localUsage.freeUsage.date === new Date().toDateString()) {
            console.log(`📊 Free Version Usage: ${localUsage.freeUsage.used}/${localUsage.freeUsage.limit}`);
          }
        } catch (e) {
          console.warn('Could not load usage info:', e);
        }
        
        console.log('✅ Free Version AI Service initialized successfully');
        this.isInitialized = true;
        return true;
      } else {
        // Fallback for non-free versions  
        console.log('🔄 Initializing standard AI service');
        
        // Load user settings like normal version
        const result = await chrome.storage.sync.get([
          'aiEnabled', 'aiProvider', 'openaiModel', 'apiKey', 'pronunciationGuide', 
          'wordExplanation', 'grammarAnalysis', 'culturalContext', 'audioPronunciation',
          'errorDetection', 'ttsVoice', 'speechSpeed', 'autoPlayAudio', 'analysisComplexity'
        ]);
        
        this.settings = {
          enabled: result.aiEnabled === 'true',
          provider: result.aiProvider || 'openai', // Default to OpenAI for alpha
          openaiModel: result.openaiModel || 'gpt-4o-mini', // Cost-effective default
          apiKey: result.apiKey || '', // User must provide API key
          features: {
            pronunciationGuide: result.pronunciationGuide !== false,
            wordExplanation: result.wordExplanation !== false,
            grammarAnalysis: result.grammarAnalysis !== false,
            culturalContext: result.culturalContext !== false,
            audioPronunciation: result.audioPronunciation !== false,
            errorDetection: result.errorDetection === true,
            contextualExamples: result.contextualExamples !== false
          },
          audio: {
            voice: result.ttsVoice || 'alloy',
            speed: parseFloat(result.speechSpeed) || 1.0,
            autoPlay: result.autoPlayAudio || false
          },
          analysisComplexity: result.analysisComplexity || 'auto'
        };
        
        if (!this.settings.apiKey) {
          throw new Error('🧪 Chrome Web Store Alpha: Please configure your OpenAI API key in settings');
        }
        
        console.log('✅ Chrome Web Store Alpha Test AI Service initialized successfully');
        
        // Debug logging for error detection (only when enabled)
        if (this.settings.features.errorDetection) {
          console.log('🔧 AI Service - Error detection enabled');
        }
      }
      
      this.isInitialized = true;
      return this.settings.enabled && (this.isFreeVersion || this.settings.apiKey);
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
    
    let prompt = `# 🌟 ${langName}學習顧問 - 深度對話式分析\n\n`;
    prompt += `嗨！我是你的${langName}學習夥伴。今天我們要一起深入探討「${text}」，我會用對話的方式讓學習變得更有趣！\n\n`;
    
    // ALWAYS start with translation and simple breakdown
    prompt += this.buildTranslationSection(text, language, langName, isWord);
    
    // Error detection with encouraging approach
    if (features.errorDetection) {
      prompt += this.buildProfessionalErrorDetection(text, language, langName);
    }
    
    // Add detailed structure guide for Dutch and Japanese
    if (!isWord && (language === 'dutch' || language === 'japanese')) {
      const structureGuide = 
        (language === 'dutch' ? `## 🇳🇱 荷蘭語深度結構對話

🎯 **V2規則解密**：為什麼動詞總是在第二位？這是荷蘭語的DNA！讓我用這句話示範...
📅 **TMP原理**：Time(時間)-Manner(方式)-Place(地點)，荷蘭人就是這樣思考的
🧩 **分離動詞的秘密**：前綴為什麼要跑到句尾？讓我用例子說明這個有趣現象...
🏗️ **主從句差異**：主句和從句的動詞位置完全不同，背後有什麼邏輯？

` :
         `## 🇯🇵 日語深度結構對話

🏗️ **SOV思維模式**：為什麼日語動詞在最後？這樣的語序有什麼好處？
📍 **修飾語位置規律**：修飾語永遠在被修飾語前面，就像疊積木一樣
⚡ **助詞系統解密**：は vs が 的微妙差別，を vs に 的使用時機
🎭 **敬語文化背景**：尊敬語、謙讓語、丁寧語反映了什麼社會關係？
🔄 **動詞活用邏輯**：為什麼同一個動詞有這麼多變化形式？

`);
      prompt += structureGuide;
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
        if (language === 'japanese') {
          prompt += `請提供日語單詞「${text}」的深度分析：\n`;
          prompt += `\n**📝 成分拆解**：\n`;
          prompt += `如果是複合詞或包含多個成分，請拆解每個部分：\n`;
          prompt += `- 每個漢字/假名的意思和讀音\n`;
          prompt += `- 詞素組合的邏輯（如：勉強 = 勉+強 = 努力+強迫 = 學習）\n`;
          prompt += `\n**🎌 詞彙詳解**：\n`;
          prompt += `1. **漢字寫法**：[漢字] + **假名讀音**：[平假名/片假名]\n`;
          prompt += `2. **詞性說明**：[名詞/動詞/形容詞等] + 具體語法特徵\n`;
          prompt += `3. **核心含義**：用最簡單的中文解釋\n`;
          prompt += `4. **語源探究**：詞彙的來源（和語/漢語/外來語）及演變\n`;
          prompt += `\n**🌸 使用情境**：\n`;
          prompt += `1. **日常對話例句**：3個生活化的實用例句（附中文翻譯）\n`;
          prompt += `2. **正式vs口語**：正式場合和朋友間的不同說法\n`;
          prompt += `3. **敬語變化**：如適用，提供尊敬語/謙讓語形式\n`;
          prompt += `\n**💡 學習要點**：\n`;
          prompt += `1. **易混淆點**：與相似詞彙的區別（如：見る vs 観る vs 診る）\n`;
          prompt += `2. **搭配用法**：常見的助詞搭配和動詞搭配\n`;
          prompt += `3. **記憶技巧**：漢字記憶法或聯想記憶\n`;
          prompt += `4. **文化背景**：相關的日本文化知識\n`;
        } else {
          prompt += `請提供：\n`;
          prompt += `1. **核心含義**：用最簡單的中文解釋（一句話）\n`;
          prompt += `2. **生活例句**：3個日常對話中的實用例句\n`;
          prompt += `3. **情境變化**：正式/非正式場合的不同用法\n`;
          prompt += `4. **同義詞組**：2-3個相似詞彙及使用差異\n`;
          prompt += `5. **記憶訣竅**：一個有趣易記的聯想方法\n`;
          prompt += `6. **搭配詞彙**：最常見的5個詞彙搭配\n`;
        }
      } else {
        if (language === 'japanese') {
          prompt += `請挑選句中3-4個關鍵詞彙，提供：\n`;
          prompt += `1. **詞彙解析**：漢字寫法 + 平假名讀音 + 詞性 + 中文意思\n`;
          prompt += `2. **語法功能**：在句中的語法作用和助詞搭配\n`;
          prompt += `3. **固定搭配**：常見的動詞、形容詞搭配和慣用語\n`;
          prompt += `4. **難點解析**：容易混淆的語法點和使用注意事項\n`;
          prompt += `5. **記憶技巧**：漢字記憶法或語法記憶訣竅\n`;
        } else {
          prompt += `請挑選句中2-3個關鍵詞彙，提供：\n`;
          prompt += `1. **詞彙解析**：簡潔解釋 + 詞性標註\n`;
          prompt += `2. **固定搭配**：找出句中的片語或慣用語\n`;
          prompt += `3. **升級建議**：1-2個讓表達更地道的替換詞\n`;
        }
      }
      prompt += `\n`;
    }
    
    // 3. Grammar - Simplified and practical with Dutch-specific analysis
    if (features.grammarAnalysis) {
      prompt += `### 📐 語法解密 - 輕鬆理解\n`;
      prompt += `請用簡單易懂的方式解釋：\n`;
      if (!isWord) {
        prompt += `1. **句型公式**：用符號表示（如：S+V+O）\n`;
        prompt += `2. **時態說明**：為什麼用這個時態？表達什麼？\n`;
        prompt += `3. **關鍵語法**：1-2個值得掌握的語法點\n`;
        
        // Dutch-specific structural analysis
        if (language === 'dutch') {
          prompt += `4. **🇳🇱 荷蘭語句型結構分析**：\n`;
          prompt += `   - **V2語序規則**：動詞是否在第二位？如果不是主句，語序如何變化？\n`;
          prompt += `   - **📅 Time-Manner-Place (TMP) 詞序分析**：\n`;
          prompt += `     * **Time (時間)**：句中的時間詞彙在哪個位置？(如: morgen, vandaag, gisteren)\n`;
          prompt += `     * **Manner (方式)**：表達方式的詞彙位置？(如: met de trein, snel, voorzichtig)\n`;
          prompt += `     * **Place (地點)**：地點詞彙的排列？(如: naar het park, in de stad, thuis)\n`;
          prompt += `     * **TMP順序邏輯**：為什麼這樣排列？符合荷蘭語TMP規則嗎？\n`;
          prompt += `     * **對比分析**：與中文/英文語序的差異和相似點\n`;
          prompt += `   - **從句結構**：是否有從句？動詞位置如何變化？\n`;
          prompt += `   - **分離動詞**：是否使用了分離動詞？前綴在哪裡？\n`;
          prompt += `   - **語氣語調**：疑問句/陳述句的語調特點\n`;
        } else if (language === 'german') {
          prompt += `4. **🇩🇪 德語句型結構分析**：\n`;
          prompt += `   - **V2語序規則**：動詞是否在第二位？\n`;
          prompt += `   - **📅 Time-Manner-Place (TMP) 詞序分析**：\n`;
          prompt += `     * **Time (時間)**：時間表達的位置 (如: heute, morgen, gestern)\n`;
          prompt += `     * **Manner (方式)**：方式副詞的位置 (如: schnell, mit dem Auto)\n`;
          prompt += `     * **Place (地點)**：地點表達的位置 (如: nach Hause, im Park)\n`;
          prompt += `   - **格變**：主格、賓格、與格、所有格的使用\n`;
        } else if (language === 'english') {
          prompt += `4. **🇺🇸 英語句型結構分析**：\n`;
          prompt += `   - **基本語序**：SVO結構的應用\n`;
          prompt += `   - **📅 副詞位置規律**：\n`;
          prompt += `     * **Time (時間)**：時間副詞的典型位置 (如: tomorrow, yesterday, now)\n`;
          prompt += `     * **Manner (方式)**：方式副詞的位置 (如: carefully, by car, with friends)\n`;
          prompt += `     * **Place (地點)**：地點副詞的位置 (如: to the park, at home)\n`;
          prompt += `   - **語序彈性**：英語中副詞位置的靈活性\n`;
        } else if (language === 'japanese') {
          prompt += `4. **🇯🇵 日語句型結構分析**：\n`;
          prompt += `   - **SOV語序規則**：主語-賓語-動詞的基本排列\n`;
          prompt += `   - **📍 修飾語位置規律**：\n`;
          prompt += `     * **時間表現**：時間詞的位置 (如: 今日、明日、昨日)\n`;
          prompt += `     * **場所表現**：場所助詞(で、に、へ)的使用\n`;
          prompt += `     * **方式表現**：方法や手段の表現位置\n`;
          prompt += `   - **助詞系統**：は、が、を、に、で等助詞的語法功能\n`;
          prompt += `   - **敬語使用**：敬語、謙讓語、丁寧語的適用場合\n`;
          prompt += `   - **詞彙解析**：逐個分析重要詞彙的讀音、意思、用法\n`;
          prompt += `   - **語尾變化**：動詞、形容詞的活用形分析\n`;
        } else {
          prompt += `4. **中式思維**：中文母語者容易犯的語法錯誤\n`;
        }
        
        // Add language-specific grammar points
        if (language === 'dutch') {
          prompt += `5. **荷蘭語特殊語法點**：\n`;
          prompt += `   - **定冠詞**：de/het的選擇邏輯\n`;
          prompt += `   - **形容詞變化**：形容詞是否有詞尾變化？為什麼？\n`;
          prompt += `   - **動詞變位**：現在時/過去時的變位規則\n`;
          prompt += `   - **介詞選擇**：為什麼用這個介詞而不是其他？\n`;
        }
        
        prompt += `${language === 'dutch' ? '6' : '5'}. **活用練習**：2個使用相同句型的實用例句\n`;
        
        // Additional sentence structure breakdown for Dutch language  
        if (language === 'dutch') {
          prompt += `\n**🔍 荷蘭語句子結構完整分析「${text}」：**\n`;
          prompt += `\n**📝 逐詞語法分析：**\n`;
          prompt += `請逐個單詞分析：[詞彙] - [詞性] - [在句中功能] - [語法作用]\n`;
          prompt += `範例格式：「Dit」- 指示詞 - 主語修飾 - 指向特定對象\n`;
          
          prompt += `\n**🏗️ 基礎句型識別：**\n`;
          prompt += `識別句子類型（如：Dit zijn + 複數名詞 + zoals + 列舉）\n`;
          prompt += `- **句型模式**: [主要結構模式，如 "這些是...，例如..."]\n`;
          prompt += `- **核心動詞**: [動詞及其功能，如 zijn = 系動詞，連接主語和賓語]\n`;
          prompt += `- **連接詞作用**: [zoals, en, etc. 的具體語法功能]\n`;
          
          prompt += `\n**⚡ 關鍵語法規則：**\n`;
          prompt += `- **詞序規律**: 分析符合的荷蘭語詞序規則（如V2規則等）\n`;
          prompt += `- **單複數一致**: 動詞與主語的呼應關係\n`;
          prompt += `- **修飾關係**: 形容詞、副詞等修飾成分的位置\n`;
          
          prompt += `\n**📋 TMP結構分析（如適用）：**\n`;
          prompt += `如果句子包含時間、方式、地點成分，請按TMP順序分析：\n`;
          prompt += `- **⏰ Time**: [時間成分及位置]\n`;
          prompt += `- **🚶 Manner**: [方式成分及位置]\n`;
          prompt += `- **📍 Place**: [地點成分及位置]\n`;
          
          prompt += `\n**🔄 句型應用：**\n`;
          prompt += `1. 此句型在什麼情況下使用？\n`;
          prompt += `2. 可以替換哪些成分來造出新句子？\n`;
          prompt += `3. 類似的句型變化有哪些？\n`;
        } else if (language === 'german') {
          prompt += `\n**🔍 特別說明「${text}」的德語TMP結構分析：**\n`;
          prompt += `請分析句子的Time-Manner-Place詞序和格變使用。\n`;
        } else if (language === 'english') {
          prompt += `\n**🔍 特別說明「${text}」的英語副詞位置分析：**\n`;
          prompt += `請分析時間、方式、地點副詞的位置選擇邏輯。\n`;
        } else if (language === 'japanese') {
          prompt += `\n**🔍 特別說明「${text}」的日語完整分析：**\n`;
          prompt += `\n**📝 成分拆解分析：**\n`;
          prompt += `請把「${text}」拆成最小的意義單位，逐一解釋每個部分：\n`;
          prompt += `格式範例：\n`;
          prompt += `- 「まじ」：副詞，真的/真正的意思，口語表達\n`;
          prompt += `- 「で」：助詞，表示判斷或強調\n`;
          prompt += `- 「よかった」：形容詞「いい」的過去式，表示「好」的過去狀態\n`;
          prompt += `- 「です」：丁寧語助動詞，表示禮貌\n`;
          prompt += `- 「よ」：終助詞，表示斷言或告知\n`;
          prompt += `- 「ね」：終助詞，尋求共鳴或確認\n`;
          
          prompt += `\n**🏗️ 語法結構深度解析：**\n`;
          prompt += `1. **動詞/形容詞活用**：解釋動詞或形容詞的原形、活用形式、時態\n`;
          prompt += `2. **助詞層疊邏輯**：當多個助詞連用時（如よね），解釋組合的意義\n`;
          prompt += `3. **口語vs書面語**：分析用語的正式程度和使用場合\n`;
          
          prompt += `\n**⚡ 文法重點詳解：**\n`;
          prompt += `- **SOV語序分析**：主語-賓語-動詞的位置（如適用）\n`;
          prompt += `- **省略成分推測**：日語常省略主語，推測省略了什麼\n`;
          prompt += `- **語感差異**：相似表達的細微差別（如よかった vs よかったです vs よかったですね）\n`;
          
          prompt += `\n**🎭 使用情境分析：**\n`;
          prompt += `- **敬語程度**：判斷敬語層次（敬語/謙讓語/丁寧語/普通語）\n`;
          prompt += `- **說話對象**：適合對誰使用（朋友/上司/陌生人）\n`;
          prompt += `- **語氣傳達**：表達什麼樣的情緒或態度\n`;
        }
      } else {
        prompt += `1. **詞性功能**：這個詞可以怎麼用？\n`;
        prompt += `2. **變化形式**：重要的詞形變化表\n`;
        prompt += `3. **語法搭配**：前後需要什麼詞性？\n`;
        
        // Dutch-specific word analysis
        if (language === 'dutch') {
          prompt += `4. **🇳🇱 荷蘭語詞彙特點**：\n`;
          prompt += `   - **性別系統**：這個詞是de詞還是het詞？如何記憶？\n`;
          prompt += `   - **複數變化**：複數形式是什麼？變化規則？\n`;
          prompt += `   - **詞根分析**：詞根來源和相關詞彙\n`;
          prompt += `   - **常見搭配**：最常見的動詞/形容詞搭配\n`;
        }
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
      // Get interface language for AI response
      await this.getInterfaceLanguage();
      
      const prompt = this.buildPrompt(text, language);
      console.log('🎯 Generated prompt length:', prompt.length, 'characters');
      console.log('🌐 AI response language:', this.interfaceLanguage);
      
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
      } else if (this.settings.provider === 'openai-proxy') {
        console.log(`📡 Attempting Secure API Proxy${retryInfo}...`);
        return await this.callSecureProxy(prompt, complexity);
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

  // 建構提示詞 - 用戶可選擇複雜度或自訂提示詞
  buildPrompt(text, language) {
    // Check if user wants to use custom prompt
    if (this.settings.useCustomPrompt === 'true' && this.settings.customPromptTemplate) {
      console.log(`🎨 Using CUSTOM user-defined prompt`);
      return this.buildCustomPrompt(text, language);
    }
    
    // Use default system prompts
    const complexity = this.getAnalysisComplexity(text);
    console.log(`⚙️ Using DEFAULT system prompt (${complexity} complexity)`);
    
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
    
    // Auto mode: intelligent selection based on text and API constraints
    if (userChoice === 'auto') {
      // For API proxy reliability, be more conservative with complexity
      if (this.isFreeVersion && !this.settings.apiKey) {
        // Free version using proxy - prioritize reliability
        return this.shouldUseSimpleForProxy(text) ? 'simple' : 'medium';
      } else {
        // User has API key - can handle more complex analysis
        return this.isSimpleText(text) ? 'simple' : 'medium';
      }
    }
    
    return 'simple'; // fallback
  }

  // 建構自訂提示詞 - 支援模板變數
  buildCustomPrompt(text, language) {
    const template = this.settings.customPromptTemplate;
    
    if (!template || !template.trim()) {
      console.warn('⚠️ Empty custom prompt template, falling back to simple prompt');
      return this.buildSimplePrompt(text, language);
    }

    try {
      // Security and validation checks
      if (!this.validateCustomPrompt(template)) {
        console.warn('⚠️ Custom prompt failed security validation, falling back to simple prompt');
        return this.buildSimplePrompt(text, language);
      }

      // Prepare template variables
      const variables = this.prepareTemplateVariables(text, language);
      
      // Replace template variables in the prompt
      let prompt = this.replaceTemplateVariables(template, variables);
      
      // Validate the result
      if (!prompt || prompt.length < 10) {
        console.warn('⚠️ Custom prompt result too short, falling back to simple prompt');
        return this.buildSimplePrompt(text, language);
      }

      // Check for reasonable length (avoid excessive token usage)
      if (prompt.length > 8000) {
        console.warn(`⚠️ Custom prompt is very long (${prompt.length} chars), this may increase API costs`);
      }

      console.log(`✅ Custom prompt built successfully (${prompt.length} characters)`);
      return prompt;
      
    } catch (error) {
      console.error('❌ Error building custom prompt:', error);
      console.log('🔄 Falling back to simple prompt');
      return this.buildSimplePrompt(text, language);
    }
  }

  // 驗證自訂提示詞的安全性和有效性
  validateCustomPrompt(template) {
    if (!template || typeof template !== 'string') {
      return false;
    }

    // Check for suspicious patterns that might indicate prompt injection
    const suspiciousPatterns = [
      /ignore\s+previous\s+instructions/i,
      /forget\s+everything/i,
      /system\s*:/i,
      /assistant\s*:/i,
      /\[system\]/i,
      /\[assistant\]/i,
      /pretend\s+you\s+are/i,
      /role.*play/i,
      /act\s+as\s+if/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(template)) {
        console.warn('🚨 Potential prompt injection detected in custom template');
        return false;
      }
    }

    // Check for reasonable length
    if (template.length > 10000) {
      console.warn('⚠️ Custom prompt template is extremely long, which may cause issues');
      return false;
    }

    // Must contain at least the basic text variable
    if (!template.includes('{{text}}')) {
      console.warn('⚠️ Custom prompt template should include {{text}} variable');
      return false;
    }

    return true;
  }

  // 準備模板變數
  prepareTemplateVariables(text, language) {
    const languageNames = {
      'english': 'English',
      'dutch': 'Dutch', 
      'japanese': 'Japanese',
      'korean': 'Korean',
      'german': 'German',
      'french': 'French',
      'spanish': 'Spanish'
    };

    const wordCount = text.trim().split(/\s+/).length;
    const isWord = wordCount === 1;

    return {
      text: text,
      language: language,
      languageName: languageNames[language] || 'English',
      isWord: isWord,
      wordCount: wordCount,
      complexity: this.getAnalysisComplexity(text)
    };
  }

  // 替換模板變數
  replaceTemplateVariables(template, variables) {
    let result = template;

    // Replace simple variables
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = String(variables[key]);
      result = result.split(placeholder).join(value);
    });

    // Handle conditional blocks (simplified Mustache-like logic)
    // {{#isWord}}...{{/isWord}} - show if isWord is true
    // {{^isWord}}...{{/isWord}} - show if isWord is false
    
    // Process positive conditionals {{#condition}}...{{/condition}}
    const positiveRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    result = result.replace(positiveRegex, (match, condition, content) => {
      if (variables[condition]) {
        return content;
      }
      return '';
    });

    // Process negative conditionals {{^condition}}...{{/condition}}
    const negativeRegex = /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    result = result.replace(negativeRegex, (match, condition, content) => {
      if (!variables[condition]) {
        return content;
      }
      return '';
    });

    return result;
  }

  // 專為 API Proxy 設計的簡化判斷（考量可靠性）
  shouldUseSimpleForProxy(text) {
    const trimmedText = text.trim();
    const sentences = trimmedText.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    const wordCount = trimmedText.split(/\s+/).length;
    const language = this.detectLanguageFromText(text);
    
    // Character count for different languages (some languages are more compact)
    const charCount = trimmedText.length;
    const isJapanese = language === 'japanese';
    const isKorean = language === 'korean';
    const isDutch = language === 'dutch';
    
    // For API proxy reliability, use more conservative thresholds
    const simpleThresholds = {
      // Japanese/Korean: Consider character density
      japanese: {
        maxChars: 15,    // Japanese is very dense
        maxWords: 4,
        maxSentences: 1
      },
      korean: {
        maxChars: 20,
        maxWords: 4, 
        maxSentences: 1
      },
      // Dutch: Needs structure analysis but keep simple for short content
      dutch: {
        maxChars: 25,
        maxWords: 3,     // Very conservative for Dutch
        maxSentences: 1
      },
      // English/other languages
      default: {
        maxChars: 35,
        maxWords: 5,
        maxSentences: 1
      }
    };
    
    const threshold = isJapanese ? simpleThresholds.japanese :
                     isKorean ? simpleThresholds.korean :
                     isDutch ? simpleThresholds.dutch :
                     simpleThresholds.default;
    
    // Use simple analysis if content is within conservative limits
    const isSimple = (
      charCount <= threshold.maxChars &&
      wordCount <= threshold.maxWords &&
      sentences.length <= threshold.maxSentences
    );
    
    console.log(`📊 Proxy complexity check (${language}): ${charCount} chars, ${wordCount} words, ${sentences.length} sentences → ${isSimple ? 'SIMPLE' : 'MEDIUM'}`);
    
    return isSimple;
  }

  // 判斷是否為簡單文本
  isSimpleText(text) {
    const wordCount = text.trim().split(/\s+/).length;
    const charCount = text.length;
    
    // Never use simple analysis for Dutch - Dutch needs structural analysis
    if (this.detectLanguageFromText(text) === 'dutch') {
      return false; // Always use medium or detailed analysis for Dutch
    }
    
    // Temporarily allow simple analysis for Japanese to test API proxy
    // TODO: Optimize Japanese detailed prompts to work with API proxy limits
    // if (this.detectLanguageFromText(text) === 'japanese') {
    //   return false; // Always use medium or detailed analysis for Japanese
    // }
    
    // Simple criteria for using basic prompt
    return (
      wordCount <= 4 ||           // 4 words or less (reduced from 6)
      (charCount <= 30 && wordCount <= 3) ||  // Very short and simple
      /^[a-zA-Z]{1,15}$/.test(text.trim()) // Single simple word
    );
  }
  
  // Simple language detection helper
  detectLanguageFromText(text) {
    // Check for Japanese characters (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
      return 'japanese';
    }
    
    // Check for Dutch
    const dutchWords = ['ik', 'wil', 'naar', 'mijn', 'huis', 'en', 'het', 'de', 'van', 'een', 'is', 'zijn', 'dat', 'die', 'met', 'voor', 'op', 'als', 'maar', 'hij', 'zij', 'kan', 'gaan', 'komen', 'hebben', 'worden', 'uitnodigen'];
    const words = text.toLowerCase().split(/\s+/);
    const dutchMatches = words.filter(word => dutchWords.includes(word)).length;
    
    if (dutchMatches >= 2 || dutchWords.includes(words[0])) {
      return 'dutch';
    }
    
    return 'english'; // default
  }

  // 建構簡化提示詞 - 快速簡潔版本
  buildSimplePrompt(text, language) {
    // Get language name based on interface language
    const langName = this.getLanguageName(language);
    const isWord = text.trim().split(/\s+/).length === 1;
    
    // Use templates based on interface language
    if (this.interfaceLanguage === 'en') {
      return this.buildEnglishSimplePrompt(text, language, langName, isWord);
    } else {
      return this.buildChineseSimplePrompt(text, language, langName, isWord);
    }
  }

  // Get language name based on interface language
  getLanguageName(language) {
    if (typeof AIPromptTemplates !== 'undefined') {
      return AIPromptTemplates.getLanguageName(language, this.interfaceLanguage);
    }
    
    // Fallback to Chinese names
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    return languageNames[language] || '英語';
  }

  // Build English simple prompt
  buildEnglishSimplePrompt(text, language, langName, isWord) {
    if (isWord) {
      return `Hi! Of course! Let's chat about the ${langName} word "${text}" together!

💬 **Conversational Translation**: This word means "[English meaning]", and in ${langName} it's also commonly used to refer to [specific usage or special meaning, if applicable].

🎯 **Simple Pronunciation Tips**: For pronunciation, you can break it down into parts: "[syllable breakdown]", pay attention to [special pronunciation rules], this will get you closer to the native sound!

🏠 **Connect to What You Know**: This word is like the English "[similar English concept]"[+ if applicable, add connections to other languages or life experiences, e.g., + the Japanese "○○" + that feeling you had when...].

🫀 **Body Resonance**: Imagine [specific sensory or emotional experience description], that [descriptive feeling] sensation is exactly ${text}.

📝 **What Part of Speech**: This is a [part of speech], typically used for [specific purpose explanation], but it can also be used in other contexts, like [other usage examples].

🌟 **One Life Example**: Imagine you're [set up a life scenario], you could say: "[natural example sentence containing the word]"

🎭 **Scene Recreation**: Next time when you [specific life situation], feel that atmosphere, then [practical usage suggestion, can be mixed languages or pure target language].

How's that? Is this explanation helpful? If you have any other questions, feel free to ask me anytime!

Please respond in a very friendly, conversational tone, like teaching a friend naturally and warmly! Pay special attention to "connecting the known" and "body resonance" descriptions to make vocabulary learning an experience!`;
    } else {
      const structureGuide = 
        (language === 'dutch' ? '\n🇳🇱 **Dutch Secret**: This sentence uses Dutch-specific word arrangement' :
         language === 'japanese' ? '\n🇯🇵 **Japanese Tip**: Japanese word order is very different from Chinese, with verbs at the end' :
         '\n💭 **Sentence Structure**: Let\'s see how this sentence is organized');
      
      let simplePrompt = `Hi! Let me help you understand this ${langName} sentence "${text}" in a conversational way!

💬 **Natural Translation**: In everyday language, this means...
🔍 **Key Vocabulary**: [pick a few important words to explain]
${structureGuide}
🌍 **When You'd Hear This**: [usage context]

`;
      
      // Add simplified examples and dialogue for Dutch
      if (language === 'dutch') {
        simplePrompt += `🎯 **Related Examples**:
1. [Simple Dutch example] → [English translation]
2. [Simple Dutch example] → [English translation] 
3. [Simple Dutch example] → [English translation]

💡 **Mini Dialogue**:
A: [Dutch]
B: [Dutch]

`;
      }
      
      simplePrompt += `Please respond in a relaxed conversational tone, like teaching a friend!`;
      return simplePrompt;
    }
  }

  // Build Chinese simple prompt (existing functionality)
  buildChineseSimplePrompt(text, language, langName, isWord) {
    
    if (isWord) {
      return `嗨！當然可以啊！讓我們一起來聊聊「${text}」這個詞吧！

💬 **聊天式翻譯**：這個詞的意思是「[中文意思]」，在${langName}中也常用來指[具體用法或特殊含義，如果有的話]。

🎯 **簡單發音提示**：發音上，可以把它分成幾個部分來念：「[音節分解]」，注意[特殊發音規則]，這樣念會更接近原音哦！

🏠 **已知連結**：這個詞就像中文的「[相似中文概念]」[+ 如果適用，加入其他語言或生活經驗的比喻，例如：+ 日文的「○○」+ 你小時候某某的感覺]。

🫀 **身體共鳴**：想像[具體的感官或情感體驗描述]，那種[感受形容詞]的感覺就是 ${text}。

📝 **它是什麼詞性**：這是一個[詞性]，通常用來[具體用途說明]，但也可以用在其他情境中，比如[其他用法舉例]。

🌟 **一個生活例句**：想像一下，[設置一個生活場景]，你可以說：「[包含該詞的自然例句]」

🎭 **場景重現**：下次當你[具體的生活情境]時，感受一下那個氛圍，然後[實際使用建議，可以中英混合或純外語]。

怎麼樣？這樣的介紹有幫助嗎？如果你有其他問題，隨時問我哦！

請用非常友善、對話式的語調回答，像是在教朋友一樣自然親切！特別注重「連結已知」和「身體共鳴」的描述，讓詞彙學習變成一種體驗！`;
    } else {
      const structureGuide = 
        (language === 'dutch' ? '\n🇳🇱 **荷蘭語小秘密**：這句話用了荷蘭語特有的排列方式' :
         language === 'japanese' ? '\n🇯🇵 **日語小提示**：日語的語序和中文很不一樣，動詞在最後面' :
         '\n💭 **句子結構**：讓我們看看這句話是怎麼組織的');
      
      let simplePrompt = `嗨！我來用聊天的方式幫你理解${langName}這句話「${text}」！

💬 **自然翻譯**：用日常用語來說就是...
🔍 **重點詞彙**：[挑幾個重要的詞解釋]
${structureGuide}
🌍 **什麼時候會聽到這句**：[使用情境]

`;
      
      // 為荷蘭語添加簡化版的例句和對話
      if (language === 'dutch') {
        simplePrompt += `🎯 **相關例句**：
1. [簡單的荷蘭語例句] → [中文翻譯]
2. [簡單的荷蘭語例句] → [中文翻譯]
3. [簡單的荷蘭語例句] → [中文翻譯]

💡 **迷你對話**：
A: [荷蘭語]
B: [荷蘭語]

`;
      }
      
      simplePrompt += `請用輕鬆對話的語調回答，像是在教朋友一樣！`;
      return simplePrompt;
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
      return `來深入了解一下${langName}單詞「${text}」吧！

💬 **翻譯與含意**：讓我告訴你這個詞的意思...
🎵 **發音秘訣**：[IPA音標] + 發音小技巧
🏠 **已知連結**：這個詞就像中文的「[相似中文概念]」[+ 如果適用，加入其他語言或生活經驗的比喻]。
🫀 **身體共鳴**：想像[具體的感官或情感體驗描述]，那種[感受形容詞]的感覺就是 ${text}。
📚 **詞性解析**：這是個[詞性]，通常這樣用...
🌟 **實際例句**：[2-3個生活化例句，展現不同使用情境]
🔄 **詞形變化**：[重要變化，用對話方式說明]
💼 **使用時機**：什麼場合用比較合適...
🎭 **場景重現**：下次當你[具體的生活情境]時，感受一下那個氛圍，然後[實際使用建議]。

請用友善對話的語調解釋，像老師和學生聊天一樣！特別注重「連結已知」和「身體共鳴」的描述！`;
    } else {
      const structureGuide = 
        (language === 'dutch' ? '\n🇳🇱 **荷蘭語結構聊天**：\n   💡 動詞位置：荷蘭語有個有趣的規則，動詞喜歡待在第二個位置\n   🕐 時間順序：注意時間、方式、地點是怎麼排列的\n   🔧 動詞分離：有些動詞會把前綴分開放，像拆開重組的積木' :
         language === 'japanese' ? '\n🇯🇵 **日語結構聊天**：\n   🍜 SOV順序：主語-賓語-動詞，就像「我拉麵吃」的感覺\n   ⚡ 助詞魔法：は、が、を這些小字很重要，它們標示詞彙的角色\n   🎭 敬語層次：日語有好幾種禮貌程度，要看對象選擇' :
         '\n💭 **語法結構對話**：\n   📐 句型分析：這句話的主要結構是...\n   🔗 詞彙關係：各個部分是如何連接的');
      let prompt = `讓我們一起來拆解${langName}這句話「${text}」！

💬 **整句意思**：用自然的中文來說...
🧩 **關鍵詞彙**：讓我逐一解釋重要的詞...
${structureGuide}
🗣️ **發音重點**：注意這些地方的語調...
🎯 **使用情境**：你會在什麼時候聽到這句話...
🌏 **文化小知識**：關於這句話的背景...

`;
      
      // 為荷蘭語添加類似例句和情境對話
      if (language === 'dutch') {
        prompt += `🎯 **類似例句 - 延伸練習**：
請提供 5-7 個使用相同語法結構的練習句：

1. [荷蘭語例句] → [中文翻譯]
2. [荷蘭語例句] → [中文翻譯]
3. [荷蘭語例句] → [中文翻譯]
4. [荷蘭語例句] → [中文翻譯]
5. [荷蘭語例句] → [中文翻譯]

💡 **情境對話**：設計一個4-6句的實用對話，自然融入所學內容
A: [荷蘭語對話]
B: [荷蘭語對話]
A: [荷蘭語對話]
B: [荷蘭語對話]

`;
      }
      
      prompt += `請用輕鬆對話的方式回答，就像在和朋友討論語言學習心得！`;
      return prompt;
    }
  }

  // Get language-specific structural analysis for medium complexity
  getLanguageSpecificStructure(language) {
    switch(language) {
      case 'dutch':
        return '\n🇳🇱 **荷蘭語TMP結構解析**：\n   - V2語序：動詞在第二位的規則\n   - 📅 Time-Manner-Place分析：時間、方式、地點的排列順序\n   - 分離動詞：前綴分離的邏輯\n   - 詞彙位置：為什麼這樣排列？符合TMP規則嗎？\n   - 語句類型：主句、從句結構特點';
      
      case 'japanese':
        return '\n🇯🇵 **日語SOV結構解析**：\n   - SOV語序：主語-賓語-動詞的基本順序\n   - 📍 修飾語位置：修飾語放在被修飾語前面的規則\n   - 助詞功能：は、が、を、に、で、から等助詞的作用\n   - 敬語層次：敬語、謙讓語、丁寧語的使用時機\n   - 語尾變化：動詞、形容詞的活用形式';
      
      case 'german':
        return '\n🇩🇪 **德語框架結構解析**：\n   - V2/框架結構：動詞框架(Verbklammer)的形成\n   - 📅 TMP語序：Zeit(時間)-Art(方式)-Ort(地點)排列\n   - 格變系統：四格系統的使用(主格、賓格、與格、所有格)\n   - 從句語序：從句中動詞移到句尾的規則';
      
      case 'english':
        return '\n🇺🇸 **英語SVO結構解析**：\n   - SVO語序：主語-動詞-賓語的基本排列\n   - 📍 副詞位置：副詞位置的靈活性和規律\n   - 助動詞：助動詞與主動詞的搭配規則\n   - 語序變化：疑問句、被動語態的語序調整';
      
      case 'korean':
        return '\n🇰🇷 **韓語SOV結構解析**：\n   - SOV語序：主語-賓語-動詞的基本排列\n   - 📝 助詞系統：主格助詞(이/가)、賓格助詞(을/를)等\n   - 敬語系統：尊敬語、謙讓語、丁寧語的層次\n   - 語尾變化：動詞語尾的豐富變化形式';
      
      default:
        return '';
    }
  }

  // 調用 Gemini API
  async callGeminiAPI(prompt, complexity = 'simple') {
    const timeouts = {
      'simple': 12000,   // 12 seconds (increased for better reliability)
      'medium': 25000,   // 25 seconds (increased for Dutch structural analysis)
      'detailed': 60000  // 60 seconds (increased for comprehensive analysis)
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

  // 調用安全 API 代理 - Free Version with Secure Proxy
  async callOpenAIAPI(prompt, complexity = 'simple') {
    // Free Version: Uses secure API proxy (no API key needed)
    if (this.isFreeVersion) {
      return await this.callSecureProxy(prompt, complexity);
    }
    
    // Fallback: Direct OpenAI API call (if not free version)
    console.log('🔄 Using direct OpenAI API call');
    
    const timeouts = {
      'simple': 12000,   // 12 seconds (increased for better reliability)
      'medium': 25000,   // 25 seconds (increased for Dutch structural analysis)
      'detailed': 60000  // 60 seconds (increased for comprehensive analysis)
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
      return `來深入了解一下${langName}單詞「${text}」吧！

💬 **翻譯與含意**：讓我告訴你這個詞的意思...
🎵 **發音秘訣**：[IPA音標] + 發音小技巧
🏠 **已知連結**：這個詞就像中文的「[相似中文概念]」[+ 如果適用，加入其他語言或生活經驗的比喻]。
🫀 **身體共鳴**：想像[具體的感官或情感體驗描述]，那種[感受形容詞]的感覺就是 ${text}。
📚 **詞性解析**：這是個[詞性]，通常這樣用...
🌟 **實際例句**：[2-3個生活化例句，展現不同使用情境]
🔄 **詞形變化**：[重要變化，用對話方式說明]
💼 **使用時機**：什麼場合用比較合適...
🎭 **場景重現**：下次當你[具體的生活情境]時，感受一下那個氛圍，然後[實際使用建議]。

請用友善對話的語調解釋，像老師和學生聊天一樣！特別注重「連結已知」和「身體共鳴」的描述！`;
    } else {
      const structureGuide = 
        (language === 'dutch' ? '\n🇳🇱 **荷蘭語結構聊天**：\n   💡 動詞位置：荷蘭語有個有趣的規則，動詞喜歡待在第二個位置\n   🕐 時間順序：注意時間、方式、地點是怎麼排列的\n   🔧 動詞分離：有些動詞會把前綴分開放，像拆開重組的積木' :
         language === 'japanese' ? '\n🇯🇵 **日語結構聊天**：\n   🍜 SOV順序：主語-賓語-動詞，就像「我拉麵吃」的感覺\n   ⚡ 助詞魔法：は、が、を這些小字很重要，它們標示詞彙的角色\n   🎭 敬語層次：日語有好幾種禮貌程度，要看對象選擇' :
         '\n💭 **語法結構對話**：\n   📐 句型分析：這句話的主要結構是...\n   🔗 詞彙關係：各個部分是如何連接的');
      let prompt = `讓我們一起來拆解${langName}這句話「${text}」！

💬 **整句意思**：用自然的中文來說...
🧩 **關鍵詞彙**：讓我逐一解釋重要的詞...
${structureGuide}
🗣️ **發音重點**：注意這些地方的語調...
🎯 **使用情境**：你會在什麼時候聽到這句話...
🌏 **文化小知識**：關於這句話的背景...

`;
      
      // 為荷蘭語添加類似例句和情境對話
      if (language === 'dutch') {
        prompt += `🎯 **類似例句 - 延伸練習**：
請提供 5-7 個使用相同語法結構的練習句：

1. [荷蘭語例句] → [中文翻譯]
2. [荷蘭語例句] → [中文翻譯]
3. [荷蘭語例句] → [中文翻譯]
4. [荷蘭語例句] → [中文翻譯]
5. [荷蘭語例句] → [中文翻譯]

💡 **情境對話**：設計一個4-6句的實用對話，自然融入所學內容
A: [荷蘭語對話]
B: [荷蘭語對話]
A: [荷蘭語對話]
B: [荷蘭語對話]

`;
      }
      
      prompt += `請用輕鬆對話的方式回答，就像在和朋友討論語言學習心得！`;
      return prompt;
    }
  }

  // Get language-specific structural analysis for medium complexity
  getLanguageSpecificStructure(language) {
    switch(language) {
      case 'dutch':
        return '\n🇳🇱 **荷蘭語TMP結構解析**：\n   - V2語序：動詞在第二位的規則\n   - 📅 Time-Manner-Place分析：時間、方式、地點的排列順序\n   - 分離動詞：前綴分離的邏輯\n   - 詞彙位置：為什麼這樣排列？符合TMP規則嗎？\n   - 語句類型：主句、從句結構特點';
      
      case 'japanese':
        return '\n🇯🇵 **日語SOV結構解析**：\n   - SOV語序：主語-賓語-動詞的基本順序\n   - 📍 修飾語位置：修飾語放在被修飾語前面的規則\n   - 助詞功能：は、が、を、に、で、から等助詞的作用\n   - 敬語層次：敬語、謙讓語、丁寧語的使用時機\n   - 語尾變化：動詞、形容詞的活用形式';
      
      case 'german':
        return '\n🇩🇪 **德語框架結構解析**：\n   - V2/框架結構：動詞框架(Verbklammer)的形成\n   - 📅 TMP語序：Zeit(時間)-Art(方式)-Ort(地點)排列\n   - 格變系統：四格系統的使用(主格、賓格、與格、所有格)\n   - 從句語序：從句中動詞移到句尾的規則';
      
      case 'english':
        return '\n🇺🇸 **英語SVO結構解析**：\n   - SVO語序：主語-動詞-賓語的基本排列\n   - 📍 副詞位置：副詞位置的靈活性和規律\n   - 助動詞：助動詞與主動詞的搭配規則\n   - 語序變化：疑問句、被動語態的語序調整';
      
      case 'korean':
        return '\n🇰🇷 **韓語SOV結構解析**：\n   - SOV語序：主語-賓語-動詞的基本排列\n   - 📝 助詞系統：主格助詞(이/가)、賓格助詞(을/를)等\n   - 敬語系統：尊敬語、謙讓語、丁寧語的層次\n   - 語尾變化：動詞語尾的豐富變化形式';
      
      default:
        return '';
    }
  }

  // 調用 Gemini API
  async callGeminiAPI(prompt, complexity = 'simple') {
    const timeouts = {
      'simple': 12000,   // 12 seconds (increased for better reliability)
      'medium': 25000,   // 25 seconds (increased for Dutch structural analysis)
      'detailed': 60000  // 60 seconds (increased for comprehensive analysis)
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
        success: result ? result.success : false,
        duration: duration,
        provider: this.settings.provider,
        error: result ? result.error : 'No result returned'
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

  // 生成語音發音 - 免費版本支持
  async generateAudio(text, language) {
    console.log('🎵 Starting audio generation...');
    
    if (!this.isAvailable() || !this.settings.features.audioPronunciation) {
      throw new Error('語音功能未啟用或不可用');
    }

    // Free version: use secure audio proxy
    if (this.isFreeVersion && this.settings.provider === 'openai-proxy') {
      return await this.callSecureAudioProxy(text, language);
    }

    // Standard version: requires direct OpenAI API
    if (this.settings.provider !== 'openai') {
      throw new Error('語音功能需要 OpenAI API - 當前設定: ' + this.settings.provider + '。請到選項頁面選擇 OpenAI 作為提供商');
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
           (this.settings.provider === 'openai' || 
            (this.isFreeVersion && this.settings.provider === 'openai-proxy'));
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

    return `You are creating flashcard content for language learning. The input is: "${text}" (${langName})

Create a flashcard where:
- FRONT = the original text
- BACK = natural ${targetLang} translation (full sentence/phrase as appropriate)
- Additional learning aids below

Generate ONLY the following, each on a separate line:

TRANSLATION: [Natural ${targetLang} translation of the complete input - maintain meaning and context]
PRONUNCIATION: [IPA notation or phonetic guide for the original text]
CONTEXT: [Brief explanation of usage or cultural context if relevant]
MEMORY_TIP: [Optional mnemonic or learning tip]

Rules:
- Translation should be complete and natural, not just key words
- For sentences, translate the full sentence naturally
- For phrases, translate the full phrase naturally  
- Keep pronunciation guides clear and accurate
- Context should explain usage, not provide another example
- Memory tips should help remember the translation

Format exactly as shown with the labels.`;
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

    // Add ultra-aggressive timeout for Chrome crash prevention
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timeout on successful response

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

    // Add ultra-aggressive timeout for Chrome crash prevention
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timeout on successful response

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Parse the AI response into structured flashcard data
  parseFlashcardResponse(response, originalText, language) {
    console.log('🃏 Parsing flashcard response:', response);
    
    // Safety check for response
    if (!response || typeof response !== 'string') {
      console.warn('⚠️ Invalid response for flashcard parsing:', response);
      return {
        originalText: originalText || '',
        language: language || 'english',
        translation: originalText || 'Translation unavailable',
        pronunciation: '',
        context: '',
        memoryTip: '',
        timestamp: Date.now(),
        provider: this.settings?.provider || 'unknown'
      };
    }

    const result = {
      originalText: originalText || '',
      language: language || 'english',
      translation: '',
      pronunciation: '',
      context: '',
      memoryTip: '',
      timestamp: Date.now(),
      provider: this.settings?.provider || 'unknown'
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