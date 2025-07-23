// AI 服務整合模組 - 支援 Gemini 和 OpenAI
class AIService {
  constructor() {
    this.settings = null;
    this.isInitialized = false;
  }

  // 初始化 AI 服務
  async initialize() {
    try {
      const result = await chrome.storage.sync.get([
        'aiEnabled', 'aiProvider', 'apiKey', 'pronunciationGuide', 
        'wordExplanation', 'grammarAnalysis', 'culturalContext', 'audioPronunciation',
        'ttsVoice', 'speechSpeed', 'autoPlayAudio'
      ]);
      
      this.settings = {
        enabled: result.aiEnabled === 'true',
        provider: result.aiProvider || 'gemini',
        apiKey: result.apiKey || '',
        features: {
          pronunciationGuide: result.pronunciationGuide !== false,
          wordExplanation: result.wordExplanation !== false,
          grammarAnalysis: result.grammarAnalysis !== false, // 預設啟用語法分析
          culturalContext: result.culturalContext !== false, // 預設啟用文化背景
          audioPronunciation: result.audioPronunciation !== false
        },
        audio: {
          voice: result.ttsVoice || 'alloy',
          speed: parseFloat(result.speechSpeed) || 1.0,
          autoPlay: result.autoPlayAudio || false
        }
      };
      
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

  // 生成 AI 分析 - 增強錯誤處理和重試機制
  async generateAnalysis(text, language) {
    if (!this.isAvailable()) {
      throw new Error('AI 服務未啟用或未配置');
    }

    try {
      const prompt = this.buildPrompt(text, language);
      console.log('🎯 Generated prompt length:', prompt.length, 'characters');
      
      // 優先使用 Gemini，如果失敗則嘗試 OpenAI
      if (this.settings.provider === 'gemini' || this.settings.provider === 'openai') {
        try {
          if (this.settings.provider === 'gemini') {
            console.log('📡 Attempting Gemini API...');
            return await this.callGeminiAPI(prompt);
          } else {
            console.log('📡 Attempting OpenAI API...');
            return await this.callOpenAIAPI(prompt);
          }
        } catch (apiError) {
          console.error(`❌ ${this.settings.provider.toUpperCase()} API failed:`, apiError.message);
          
          // 如果是超時錯誤，嘗試簡化版本的提示詞
          if (apiError.message.includes('超時') || apiError.message.includes('timeout')) {
            console.log('⚡ 嘗試使用簡化提示詞重試...');
            try {
              const simplePrompt = this.buildSimplePrompt(text, language);
              if (this.settings.provider === 'gemini') {
                return await this.callGeminiAPI(simplePrompt);
              } else {
                return await this.callOpenAIAPI(simplePrompt);
              }
            } catch (retryError) {
              throw new Error(`AI 分析請求超時 - 建議：1) 檢查網路連線 2) 嘗試較短的文本 3) 稍後重試`);
            }
          }
          
          // 其他錯誤直接拋出
          throw apiError;
        }
      } else {
        throw new Error('不支援的 AI 服務提供商');
      }
    } catch (error) {
      console.error('🚨 AI 分析完全失敗:', error);
      throw error;
    }
  }

  // 建構提示詞 - 優化版本，提供語言特定分析
  buildPrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語',
      'japanese': '日語',
      'korean': '韓語'
    };

    const langName = languageNames[language] || '英語';
    const features = this.settings.features;
    const isWord = text.trim().split(/\s+/).length === 1;
    const isSentence = text.trim().split(/\s+/).length > 1;
    
    // 動態檢測文本複雜度
    const complexity = this.detectTextComplexity(text, language);
    
    let prompt = `請為${langName}${isWord ? '單詞' : '文本'}「${text}」提供語言學習分析（繁體中文）：\n\n`;

    // 🗣️ 發音指導 - 語言特定優化
    if (features.pronunciationGuide) {
      prompt += this.buildPronunciationSection(language, isWord, complexity);
    }

    // 📚 詞彙解釋 - 增強版本
    if (features.wordExplanation) {
      prompt += this.buildVocabularySection(language, isWord, isSentence);
    }

    // 📝 語法分析 - 大幅增強
    if (features.grammarAnalysis) {
      prompt += this.buildGrammarSection(language, isWord, isSentence, complexity);
    }

    // 🎯 句子結構分析 - 新增專門的句子分析
    if (isSentence) {
      prompt += this.buildSentenceAnalysisSection(language, complexity);
    }

    // 🌍 文化背景 - 語言特定優化
    if (features.culturalContext) {
      prompt += this.buildCulturalSection(language, isWord, complexity);
    }

    // 📈 學習建議 - 新增學習策略
    prompt += this.buildLearningTipsSection(language, isWord, complexity);

    // 最終指示 - 根據文本類型和複雜度調整
    prompt += this.buildFinalInstructions(language, isWord, complexity);

    return prompt;
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
        section += `- **國際音標（IPA）：** [提供完整準確的 IPA 標記，包含重音符號]\n`;
        section += `- **音節劃分：** [將單詞/短語按音節分解，標示重音位置]\n`;
        section += `- **發音技巧：** [具體的舌位、唇形、氣流控制要點]\n`;
        if (complexity !== 'beginner') {
          section += `- **語調模式：** [句子的升降調變化和語調核心]\n`;
          section += `- **連音現象：** [單詞間的連讀、省音、同化現象]\n`;
        }
        section += `- **常見錯誤：** [華語使用者易犯的發音錯誤及糾正方法]\n\n`;
        break;
        
      case 'dutch':
        section += `- **荷蘭語音標：** [使用荷蘭語音系統標記，注意特殊音素]\n`;
        section += `- **發音特點：** [荷蘭語特有的咽頭音 /x/、顫音 /r/ 等發音要領]\n`;
        section += `- **音長區別：** [長短元音對比，標示音長符號]\n`;
        section += `- **與英語對比：** [發音系統差異，易混淆音素分析]\n`;
        if (complexity !== 'beginner') {
          section += `- **語調特色：** [荷蘭語特有的語調模式和重音規律]\n`;
        }
        section += `- **學習建議：** [針對華語使用者的發音練習建議]\n\n`;
        break;
        
      case 'japanese':
        section += `- **假名標記：** [提供平假名和片假名標記]\n`;
        section += `- **羅馬音：** [標準羅馬字轉寫]\n`;
        section += `- **音調模式：** [東京音調的高低音調變化圖示]\n`;
        section += `- **特殊音素：** [促音、長音、拗音的發音要點]\n`;
        if (complexity !== 'beginner') {
          section += `- **語調助詞：** [助詞的音調變化和語調作用]\n`;
        }
        section += `- **發音注意：** [華語使用者需注意的日語發音特點]\n\n`;
        break;
        
      case 'korean':
        section += `- **韓文標記：** [한글 標準發音]\n`;
        section += `- **國際音標：** [精確的 IPA 轉寫]\n`;
        section += `- **音變規律：** [重要的音韻變化規則，如終聲規則]\n`;
        section += `- **發音要點：** [韓語特有的緊音、鬆音、送氣音區別]\n`;
        if (complexity !== 'beginner') {
          section += `- **語調規律：** [韓語語調模式和語氣變化]\n`;
        }
        section += `- **學習重點：** [華語使用者的韓語發音學習要點]\n\n`;
        break;
    }
    
    return section;
  }

  // 📚 詞彙解釋部分
  buildVocabularySection(language, isWord, isSentence) {
    let section = `## 📚 詞彙解釋\n`;
    
    if (isWord) {
      section += `- **詞彙分析：** [詞性 + 基本定義，如：名詞，表示...]\n`;
      section += `- **語義範圍：** [不同語境下的含義變化]\n`;
      section += `- **搭配用法：** [常見的詞彙搭配和固定短語]\n`;
      section += `- **近義詞群：** [意義相近詞彙的細微差別比較]\n`;
      section += `- **反義詞：** [對應的反義詞和相關詞群]\n`;
      section += `- **詞彙等級：** [使用頻率和正式程度]\n`;
    } else {
      section += `- **詞彙分析：** [逐詞解釋，格式：詞彙（詞性）- 含義]\n`;
      section += `- **詞彙難度：** [標示初中高級詞彙]\n`;
      section += `- **同義替換：** [可替換的同義詞選項]\n`;
    }
    
    section += `- **實用例句：** [3-4個不同語境的實用例句，含使用場景說明]\n`;
    section += `- **記憶技巧：** [詞根詞綴分析或聯想記憶方法]\n\n`;
    
    return section;
  }

  // 📝 語法分析部分 - 大幅增強
  buildGrammarSection(language, isWord, isSentence, complexity) {
    let section = `## 📝 語法分析\n`;
    
    if (isWord) {
      section += `- **詞彙語法：** [該詞的語法特性和使用規則]\n`;
      section += `- **變化形式：** [時態、語態、數量等變化形式]\n`;
      section += `- **句法功能：** [在句中可能承擔的語法角色]\n`;
      section += `- **搭配語法：** [與其他詞類的語法搭配規則]\n\n`;
    } else {
      // 句子的詳細語法分析
      section += `- **句型識別：** [判斷句型類別：陳述句、疑問句、祈使句等]\n`;
      section += `- **主謂結構：** [主語、謂語、賓語的詳細分析]\n`;
      section += `- **時態語態：** [具體時態形式及其表達的時間和動作狀態]\n`;
      
      if (language === 'english') {
        section += `- **從句分析：** [主句、從句關係，從句類型和功能]\n`;
        section += `- **語法成分：** [定語、狀語、補語等修飾成分分析]\n`;
        section += `- **語法重點：** [句中重要語法點和常考結構]\n`;
      } else if (language === 'dutch') {
        section += `- **語序規則：** [荷蘭語V2語序和從句語序規律]\n`;
        section += `- **動詞變位：** [動詞的人稱、時態變位分析]\n`;
        section += `- **格變規律：** [主格、賓格、所有格的使用]\n`;
      } else if (language === 'japanese') {
        section += `- **助詞分析：** [各助詞的功能和用法說明]\n`;
        section += `- **動詞活用：** [動詞的活用形和敬語變化]\n`;
        section += `- **語法模式：** [句型結構和語法模式識別]\n`;
      } else if (language === 'korean') {
        section += `- **語尾分析：** [動詞、形容詞語尾的變化和意義]\n`;
        section += `- **助詞功能：** [主題助詞、格助詞的作用分析]\n`;
        section += `- **敬語體系：** [敬語等級和使用場合]\n`;
      }
      
      section += `- **語法變換：** [同義句轉換和不同表達方式]\n`;
      section += `- **易錯分析：** [學習者常見語法錯誤和避免方法]\n\n`;
    }
    
    return section;
  }

  // 🎯 句子結構分析部分 - 新增
  buildSentenceAnalysisSection(language, complexity) {
    let section = `## 🎯 句子結構分析\n`;
    
    section += `- **句子架構：** [完整的句法樹狀結構分析]\n`;
    section += `- **語法層次：** [短語、從句的層次關係]\n`;
    section += `- **語義關係：** [句子內部的語義邏輯關係]\n`;
    section += `- **信息結構：** [主題、焦點、背景信息的分佈]\n`;
    
    if (complexity === 'advanced') {
      section += `- **修辭特色：** [句式的修辭效果和語體特點]\n`;
      section += `- **語用功能：** [句子的交際功能和語境適用性]\n`;
    }
    
    section += `- **改寫練習：** [句式變換和表達優化建議]\n\n`;
    
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
    
    section += `- **文化內涵：** [在${cultureName}中的特殊含義和文化象徵]\n`;
    section += `- **使用場景：** [正式度、親密度、社會階層等使用條件]\n`;
    section += `- **文化差異：** [與華語文化的主要差異和注意事項]\n`;
    section += `- **社會語言學：** [年齡、性別、地區使用習慣的差異]\n`;
    
    if (complexity !== 'beginner') {
      section += `- **語言變體：** [方言、俚語、網絡用語等變體形式]\n`;
      section += `- **歷史演變：** [詞彙或表達的歷史發展脈絡]\n`;
    }
    
    section += `- **跨文化交際：** [使用時的文化敏感度和禮貌策略]\n\n`;
    
    return section;
  }

  // 📈 學習建議部分 - 新增
  buildLearningTipsSection(language, isWord, complexity) {
    let section = `## 📈 學習建議\n`;
    
    section += `- **記憶策略：** [針對性的記憶方法和技巧]\n`;
    section += `- **練習重點：** [需要重點練習的語言技能]\n`;
    section += `- **常見陷阱：** [學習過程中容易出錯的地方]\n`;
    section += `- **拓展學習：** [相關的語言點和深入學習方向]\n`;
    
    if (complexity === 'advanced') {
      section += `- **高階應用：** [進階使用技巧和語言藝術]\n`;
    }
    
    section += `- **實用建議：** [日常使用和語言運用的實踐建議]\n\n`;
    
    return section;
  }

  // 最終指示部分
  buildFinalInstructions(language, isWord, complexity) {
    const complexityNote = {
      'beginner': '請用簡潔明了的語言解釋，適合初學者理解。',
      'intermediate': '請提供中等深度的分析，幫助中級學習者提升。',
      'advanced': '請進行深入分析，包含進階語言學概念。'
    };
    
    return `\n**重要說明：**\n` +
           `1. ${complexityNote[complexity]}\n` +
           `2. 所有例句都要提供語境說明和使用場合。\n` +
           `3. 語法術語要有簡潔的中文解釋。\n` +
           `4. 重點標示學習者最需要掌握的核心內容。\n` +
           `5. ${isWord ? '單詞分析要全面細致，包含詞彙的各個層面。' : '句子分析要層次清晰，語法解釋要具體準確。'}`;
  }

  // 建構簡化提示詞 - 超時時的備用方案
  buildSimplePrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    
    const langName = languageNames[language] || '英語';
    const isWord = text.trim().split(/\s+/).length === 1;
    
    return `請簡要分析${langName}${isWord ? '單詞' : '文本'}「${text}」：

## 🗣️ 發音
- 音標與發音要點

## 📚 詞彙  
- 基本含義與用法

## 📝 語法
- 語法特點與結構

請用繁體中文回應，內容簡潔實用。`;
  }

  // 調用 Gemini API
  async callGeminiAPI(prompt) {
    console.log('🤖 Calling Gemini API...');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for complex prompts
      
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
            maxOutputTokens: 4096, // 增加輸出長度以支援詳細分析
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📥 Gemini response received:', response.status);

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
        throw new Error('Gemini API 請求超時 - 請檢查網路連線');
      }
      console.error('❌ Gemini API call failed:', error);
      throw error;
    }
  }

  // 調用 OpenAI API
  async callOpenAIAPI(prompt) {
    console.log('🤖 Calling OpenAI API...');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for complex prompts
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.7,
          max_tokens: 4096 // 增加輸出長度以支援詳細分析
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📥 OpenAI response received:', response.status);

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
        throw new Error('OpenAI API 請求超時 - 請檢查網路連線');
      }
      console.error('❌ OpenAI API call failed:', error);
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
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
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
        throw new Error('請求超時 - 請檢查網路連線');
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