// Professional Language Learning Prompts
// Based on communicative language teaching principles and cognitive learning theory

class LanguageLearningPrompts {
  constructor() {
    this.languageNames = {
      'english': '英語',
      'dutch': '荷蘭語',
      'japanese': '日語',
      'korean': '韓語'
    };
  }

  // Main prompt builder - pedagogically optimized
  buildOptimizedPrompt(text, language, features, errorDetectionEnabled = false) {
    const langName = this.languageNames[language] || '英語';
    const isWord = text.trim().split(/\s+/).length === 1;
    const learnerLevel = this.estimateLearnerLevel(text);
    
    let prompt = `# 🌟 ${langName}學習小幫手 - 專業語言教師分析\n\n`;
    prompt += `您好！我是您的${langName}學習夥伴。讓我們一起探索「${text}」的奧妙！\n\n`;
    
    // Error detection with encouraging approach
    if (errorDetectionEnabled) {
      prompt += this.buildErrorDetectionPrompt(text, language, langName);
    }
    
    // Core learning sections
    prompt += this.buildCoreLearningPrompt(text, language, langName, isWord, features, learnerLevel);
    
    // Closing with motivation
    prompt += this.buildClosingMotivation(langName);
    
    return prompt;
  }

  // Gentle error detection prompt
  buildErrorDetectionPrompt(text, language, langName) {
    return `## 🔍 首先，讓我們一起檢查這個${langName}表達\n\n` +
           `請用母語者的眼光仔細觀察：「${text}」\n\n` +
           `**溫和評估標準：**\n` +
           `1. 🌐 語言純度：所有詞彙是否都屬於${langName}？\n` +
           `2. 🎯 自然程度：母語者是否會這樣表達？\n` +
           `3. ✨ 語法正確性：句子結構是否符合${langName}規範？\n\n` +
           `**分析方式：**\n` +
           `- 如果發現任何不自然之處，請以鼓勵的方式指出\n` +
           `- 重點在於幫助學習，而非批評錯誤\n` +
           `- 提供正確版本時，解釋為什麼這樣更好\n\n`;
  }

  // Core learning sections - pedagogically structured
  buildCoreLearningPrompt(text, language, langName, isWord, features, level) {
    let prompt = `## 📚 深度學習分析\n\n`;
    
    // 1. Pronunciation - Make it practical
    if (features.pronunciationGuide) {
      prompt += `### 🗣️ 發音指導 - 說得像母語者\n`;
      prompt += `- **準確音標**：提供IPA音標，並用中文注音輔助理解\n`;
      prompt += `- **發音要訣**：重點解釋最容易出錯的音素\n`;
      prompt += `- **連音技巧**：${!isWord ? '解釋句中的連音和語調變化\n' : '說明在句中的發音變化\n'}`;
      prompt += `- **實用練習**：提供3個簡單的發音練習技巧\n\n`;
    }
    
    // 2. Vocabulary - Focus on usage
    if (features.wordExplanation) {
      prompt += `### 📖 詞彙掌握 - 活學活用\n`;
      if (isWord) {
        prompt += `- **核心含義**：用最簡單的方式解釋基本意思\n`;
        prompt += `- **情境用法**：提供3個日常生活中的實用例句\n`;
        prompt += `- **同義詞辨析**：比較2-3個相似詞彙，說明使用差異\n`;
        prompt += `- **記憶妙招**：分享一個有趣的記憶方法或聯想\n`;
        prompt += `- **常見搭配**：列出最實用的3-5個詞彙搭配\n`;
      } else {
        prompt += `- **關鍵詞彙**：挑選2-3個最重要的詞彙深入解釋\n`;
        prompt += `- **片語學習**：找出句中的固定搭配或慣用語\n`;
        prompt += `- **詞彙升級**：建議1-2個可以讓表達更地道的替換詞\n`;
      }
      prompt += `\n`;
    }
    
    // 3. Grammar - Make it understandable
    if (features.grammarAnalysis) {
      prompt += `### 📐 語法解密 - 輕鬆理解\n`;
      if (!isWord) {
        prompt += `- **句型公式**：用簡單的公式表示句子結構（如：主語 + 動詞 + 賓語）\n`;
        prompt += `- **時態解析**：解釋為什麼使用這個時態，以及表達的具體含義\n`;
        prompt += `- **語法亮點**：指出1-2個值得學習的語法重點\n`;
        prompt += `- **常見錯誤**：提醒學習者容易犯的相關語法錯誤\n`;
        prompt += `- **舉一反三**：提供2個使用相同語法結構的例句\n`;
      } else {
        prompt += `- **詞性功能**：說明這個詞在句中能扮演的角色\n`;
        prompt += `- **變化規則**：列出重要的詞形變化（時態、複數等）\n`;
      }
      prompt += `\n`;
    }
    
    // 4. Cultural Context - Make it relevant
    if (features.culturalContext) {
      prompt += `### 🌍 文化視角 - 道地表達\n`;
      prompt += `- **使用情境**：在什麼場合下使用最合適？\n`;
      prompt += `- **文化內涵**：這個表達反映了什麼文化特點？\n`;
      prompt += `- **禮貌程度**：正式/非正式？對誰說合適？\n`;
      prompt += `- **地域差異**：不同地區的說法有何不同？\n`;
      prompt += `- **實用貼士**：一個避免文化誤解的小建議\n\n`;
    }
    
    // 5. Practical Application
    prompt += `### 🎯 實戰應用 - 立即可用\n`;
    prompt += `- **情境對話**：設計一個包含這個表達的簡短對話（3-4句）\n`;
    prompt += `- **練習建議**：提供一個5分鐘內可完成的練習活動\n`;
    prompt += `- **延伸學習**：推薦1-2個相關的表達供進階學習\n\n`;
    
    return prompt;
  }

  // Closing motivation
  buildClosingMotivation(langName) {
    return `## 💪 學習小貼士\n` +
           `記住：語言學習是一個旅程，每一次練習都讓您更接近目標！\n` +
           `今天學習的內容，明天就能用在實際對話中。加油！\n\n` +
           `**重要提醒：**\n` +
           `- 請一次性完成所有分析，不要分段回應\n` +
           `- 用鼓勵和支持的語氣，讓學習者感到有信心\n` +
           `- 重點是實用性，而非學術性\n` +
           `- 解釋要簡單明瞭，避免過多專業術語\n`;
  }

  // Estimate learner level based on text complexity
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

  // Special prompt for correct sentences - focus on deepening understanding
  buildCorrectSentencePrompt(text, language, langName, features) {
    let prompt = `# 🌟 太棒了！這是一個完美的${langName}表達！\n\n`;
    prompt += `「${text}」完全正確！讓我們深入探索，讓您的${langName}更上一層樓。\n\n`;
    
    prompt += `## 🎉 為什麼這個句子很棒？\n`;
    prompt += `- 語法完全正確 ✓\n`;
    prompt += `- 用詞地道自然 ✓\n`;
    prompt += `- 表達清晰流暢 ✓\n\n`;
    
    prompt += `## 📈 進階學習 - 從好到更好\n\n`;
    
    prompt += `### 🎨 表達變化 - 同樣意思的不同說法\n`;
    prompt += `- 提供3-4種表達相同意思的不同方式\n`;
    prompt += `- 說明每種表達的細微差別和使用場合\n\n`;
    
    prompt += `### 🌈 語言色彩 - 讓表達更豐富\n`;
    prompt += `- 如何加入情感色彩？\n`;
    prompt += `- 如何調整正式程度？\n`;
    prompt += `- 如何讓句子更生動有趣？\n\n`;
    
    prompt += `### 🔗 延伸學習 - 相關表達\n`;
    prompt += `- 3個使用類似句型的實用句子\n`;
    prompt += `- 2個可以接續這句話的自然回應\n\n`;
    
    return prompt;
  }

  // Special prompt for sentences with errors - gentle correction
  buildErrorCorrectionPrompt(text, language, langName, errorType) {
    let prompt = `# 🌱 學習機會來了！讓我們一起改進這個表達\n\n`;
    prompt += `您嘗試說：「${text}」\n`;
    prompt += `這顯示您正在積極學習${langName}，非常好！讓我幫您調整一下。\n\n`;
    
    prompt += `## 🔧 溫和改進建議\n\n`;
    
    prompt += `### ✏️ 正確的說法是：\n`;
    prompt += `- [提供正確版本]\n`;
    prompt += `- **為什麼這樣更好**：[簡單解釋原因]\n\n`;
    
    prompt += `### 💡 理解重點\n`;
    prompt += `- **容易混淆的地方**：[指出具體問題]\n`;
    prompt += `- **記憶技巧**：[提供一個幫助記憶的方法]\n`;
    prompt += `- **母語干擾**：[如果適用，解釋中文思維的影響]\n\n`;
    
    prompt += `### 📝 練習鞏固\n`;
    prompt += `- 用正確的形式造3個簡單句子\n`;
    prompt += `- 設計一個小對話場景來練習\n\n`;
    
    prompt += `### 🌟 鼓勵的話\n`;
    prompt += `犯錯是學習的必經之路！您已經掌握了[指出做對的部分]，\n`;
    prompt += `只要注意[具體建議]，您的${langName}會越來越好！\n\n`;
    
    return prompt;
  }
}

// Export for use in ai-service.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LanguageLearningPrompts;
}