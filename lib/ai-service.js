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
          grammarAnalysis: result.grammarAnalysis || false,
          culturalContext: result.culturalContext || false,
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

  // 生成 AI 分析
  async generateAnalysis(text, language) {
    if (!this.isAvailable()) {
      throw new Error('AI 服務未啟用或未配置');
    }

    try {
      const prompt = this.buildPrompt(text, language);
      
      if (this.settings.provider === 'gemini') {
        return await this.callGeminiAPI(prompt);
      } else if (this.settings.provider === 'openai') {
        return await this.callOpenAIAPI(prompt);
      } else {
        throw new Error('不支援的 AI 服務提供商');
      }
    } catch (error) {
      console.error('AI 分析失敗:', error);
      throw error;
    }
  }

  // 建構提示詞
  buildPrompt(text, language) {
    const languageNames = {
      'english': '英語',
      'dutch': '荷蘭語',
      'japanese': '日語',
      'korean': '韓語'
    };

    const langName = languageNames[language] || '英語';
    const features = this.settings.features;
    
    let prompt = `請為以下${langName}文本提供詳細的語言學習分析：\n\n"${text}"\n\n請按照以下格式回應（使用繁體中文）：\n\n`;

    if (features.pronunciationGuide) {
      prompt += `## 🗣️ 發音指導\n`;
      if (language === 'english') {
        prompt += `- **國際音標（IPA）：** [提供準確的國際音標]\n`;
        prompt += `- **發音技巧：** [詳細的發音要點，包括重音、音節劃分]\n`;
        prompt += `- **常見錯誤：** [學習者容易犯的發音錯誤]\n\n`;
      } else if (language === 'dutch') {
        prompt += `- **荷蘭語音標：** [提供準確的音標]\n`;
        prompt += `- **發音技巧：** [荷蘭語特有的發音要點]\n`;
        prompt += `- **與英語差異：** [與英語發音的主要差別]\n\n`;
      }
    }

    if (features.wordExplanation) {
      prompt += `## 📚 詞彙解釋\n`;
      prompt += `- **主要含義：** [詳細解釋每個重要詞彙的含義]\n`;
      prompt += `- **詞性分析：** [標註詞性（名詞、動詞等）]\n`;
      prompt += `- **使用場合：** [正式/非正式場合的使用]\n`;
      prompt += `- **例句：** [提供2-3個實用例句]\n`;
      prompt += `- **同義詞/反義詞：** [相關詞彙擴展]\n\n`;
    }

    if (features.grammarAnalysis) {
      prompt += `## 📝 語法分析\n`;
      prompt += `- **句型結構：** [分析句子的語法結構]\n`;
      prompt += `- **時態分析：** [解釋使用的時態和語態]\n`;
      prompt += `- **語法重點：** [重要的語法規則]\n`;
      prompt += `- **句法變化：** [可能的句式變換]\n\n`;
    }

    if (features.culturalContext) {
      prompt += `## 🌍 文化背景\n`;
      prompt += `- **文化含義：** [詞彙或表達的文化背景]\n`;
      prompt += `- **使用情境：** [適合使用的社會場合]\n`;
      prompt += `- **地區差異：** [不同地區的使用差異]\n`;
      prompt += `- **慣用表達：** [相關的慣用語或俚語]\n\n`;
    }

    prompt += `請確保回應內容準確、實用，適合語言學習者使用。如果文本很短（如單個詞），請提供更詳細的詞彙分析。`;

    return prompt;
  }

  // 調用 Gemini API
  async callGeminiAPI(prompt) {
    console.log('🤖 Calling Gemini API...');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
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
            maxOutputTokens: 2048,
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
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
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
          max_tokens: 2048
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