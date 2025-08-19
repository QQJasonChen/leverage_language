/**
 * Clean Imitation Practice UI - 清爽版仿寫練習
 * 簡化流程：選擇句子 → 直接進入練習界面 → AI評估
 */

class CleanPracticeUI {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager || new ImitationPracticeManager();
    this.currentSentence = null;
    this.currentAutoComplete = null; // 用於 Tab 自動完成
    this.keyboardListenersAttached = false; // 防止重複綁定
  }

  /**
   * 初始化
   */
  async initialize() {
    console.log('🚀 Initializing CleanPracticeUI');
    this.render();
    await this.loadSentences();
    this.attachListeners();
  }

  /**
   * 渲染主界面
   */
  render() {
    this.container.innerHTML = `
      <div class="clean-practice-container">
        <div class="practice-header">
          <h2>📝 句型仿寫練習</h2>
          <button class="close-btn" id="closePractice">×</button>
        </div>
        
        <div class="sentence-selection">
          <label>選擇一個句子開始練習：</label>
          <select id="sentenceSelect" class="sentence-dropdown">
            <option value="">載入中...</option>
          </select>
        </div>
        
        <div class="practice-area" id="practiceArea">
          <div class="welcome-message">
            <div class="welcome-icon">🎯</div>
            <h3>句型仿寫練習</h3>
            <p>選擇一個句子，然後創造你自己的版本</p>
            <div class="features">
              <div>📝 參考原句結構</div>
              <div>🔄 替換詞彙內容</div>
              <div>✅ AI智能評估</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
  }

  /**
   * 載入句子
   */
  async loadSentences() {
    try {
      console.log('📦 Loading sentences...');
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'getHistory'
      });

      let sentences = [];
      if (Array.isArray(response)) {
        sentences = response;
      } else if (response && response.history) {
        sentences = response.history;
      }

      // 過濾有效句子
      const validSentences = sentences.filter(item => 
        item.text && item.text.length > 10 && item.text.split(' ').length > 2
      );

      console.log(`📦 Found ${validSentences.length} valid sentences`);
      this.populateDropdown(validSentences);

    } catch (error) {
      console.error('❌ Failed to load sentences:', error);
      this.showError('無法載入句子，請稍後再試');
    }
  }

  /**
   * 填充下拉選單
   */
  populateDropdown(sentences) {
    const select = document.getElementById('sentenceSelect');
    if (!select) return;

    // 去重複
    const unique = this.removeDuplicates(sentences);

    select.innerHTML = '<option value="">選擇一個句子...</option>';

    unique.forEach((sentence, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = sentence.text.length > 50 
        ? sentence.text.substring(0, 47) + '...' 
        : sentence.text;
      option.dataset.sentence = JSON.stringify(sentence);
      select.appendChild(option);
    });

    console.log(`📝 Loaded ${unique.length} sentences`);
  }

  /**
   * 去重複句子
   */
  removeDuplicates(sentences) {
    const seen = new Set();
    return sentences.filter(sentence => {
      const key = sentence.text.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 事件監聽
   */
  attachListeners() {
    // 關閉按鈕
    document.getElementById('closePractice')?.addEventListener('click', () => {
      this.container.style.display = 'none';
    });

    // 句子選擇
    document.getElementById('sentenceSelect')?.addEventListener('change', (e) => {
      if (e.target.value && e.target.selectedOptions[0]) {
        const option = e.target.selectedOptions[0];
        if (option.dataset.sentence) {
          const sentenceData = JSON.parse(option.dataset.sentence);
          this.startPractice(sentenceData);
        }
      }
    });

    // 全局鍵盤快捷鍵
    this.attachGlobalKeyboardShortcuts();
  }

  /**
   * 全局鍵盤快捷鍵
   */
  attachGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // ESC 關閉練習視窗
      if (e.key === 'Escape') {
        const container = this.container;
        if (container && container.style.display !== 'none') {
          container.style.display = 'none';
          e.preventDefault();
        }
      }

      // Ctrl+H 顯示提示
      if (e.ctrlKey && e.key === 'h') {
        const hintBtn = document.getElementById('getHint');
        if (hintBtn && !hintBtn.disabled) {
          hintBtn.click();
          e.preventDefault();
        }
      }

      // Ctrl+N 下一個句子
      if (e.ctrlKey && e.key === 'n') {
        const tryAnotherBtn = document.getElementById('tryAnother');
        if (tryAnotherBtn) {
          tryAnotherBtn.click();
          e.preventDefault();
        }
      }

      // Alt+數字 快速選擇句子（1-9）
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const select = document.getElementById('sentenceSelect');
        if (select && select.options.length > parseInt(e.key)) {
          select.selectedIndex = parseInt(e.key);
          select.dispatchEvent(new Event('change'));
          e.preventDefault();
        }
      }

      // ? 鍵顯示快捷鍵幫助（當沒有在輸入框中時）
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        this.toggleShortcutsHelp();
        e.preventDefault();
      }
    });
  }

  /**
   * 切換快捷鍵幫助視窗
   */
  toggleShortcutsHelp() {
    let helpModal = document.getElementById('shortcutsHelpModal');
    
    if (helpModal) {
      helpModal.remove();
      return;
    }

    helpModal = document.createElement('div');
    helpModal.id = 'shortcutsHelpModal';
    helpModal.className = 'shortcuts-help-modal';
    helpModal.innerHTML = `
      <div class="shortcuts-help-content">
        <h3>⌨️ 鍵盤快捷鍵</h3>
        <button class="close-help-btn" onclick="this.parentElement.parentElement.remove()">×</button>
        
        <div class="shortcuts-list">
          <div class="shortcut-group">
            <h4>基本操作</h4>
            <div class="shortcut-row">
              <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
              <span class="shortcut-desc">提交答案進行AI評估</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-keys"><kbd>Esc</kbd></span>
              <span class="shortcut-desc">關閉練習視窗</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-keys"><kbd>?</kbd></span>
              <span class="shortcut-desc">顯示/隱藏此幫助</span>
            </div>
          </div>
          
          <div class="shortcut-group">
            <h4>練習操作</h4>
            <div class="shortcut-row">
              <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>H</kbd></span>
              <span class="shortcut-desc">顯示提示</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
              <span class="shortcut-desc">切換到下一個句子</span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>1-9</kbd></span>
              <span class="shortcut-desc">快速選擇句子</span>
            </div>
          </div>
        </div>
        
        <div class="help-footer">
          <p>💡 提示：將游標放在按鈕上也可看到對應的快捷鍵</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(helpModal);
    
    // 點擊背景關閉
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.remove();
      }
    });
  }

  /**
   * 開始練習 - 直接進入練習模式
   */
  startPractice(sentenceData) {
    console.log('🎯 Starting practice with:', sentenceData.text);
    
    this.currentSentence = sentenceData;
    
    const practiceArea = document.getElementById('practiceArea');
    practiceArea.innerHTML = `
      <div class="practice-interface">
        <!-- 原句展示 -->
        <div class="original-sentence">
          <h3>📖 參考句子</h3>
          <div class="sentence-display">
            <div class="sentence-text">${sentenceData.text}</div>
            <div class="sentence-info">
              <span class="language-tag">${this.getLanguageDisplay(sentenceData.language)}</span>
              <span class="source-tag">${sentenceData.source || '已保存'}</span>
            </div>
          </div>
        </div>

        <!-- 練習區域 -->
        <div class="practice-section">
          <h3>✏️ 創造你的句子</h3>
          <p class="instruction">
            參考上面的句子結構，創造一個新的句子。你可以：
            <br>• 替換名詞、形容詞、動詞等詞彙
            <br>• 保持相似的語法結構
            <br>• 表達不同的內容
          </p>
          
          <textarea 
            id="userAnswer" 
            placeholder="在這裡輸入你的句子..." 
            rows="3"
          ></textarea>
          
          <div class="input-info">
            <span id="charCount" class="char-count">0 字元</span>
            <span class="input-hints">按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交</span>
          </div>
          
          <div class="practice-buttons">
            <button id="submitAnswer" class="primary-btn" title="提交答案 (Ctrl+Enter)">🤖 AI評估</button>
            <button id="getHint" class="secondary-btn" title="顯示提示 (Ctrl+H)">💡 提示</button>
            <button id="tryAnother" class="secondary-btn" title="換句子 (Ctrl+N)">🔄 換句子</button>
          </div>
          
          <div class="keyboard-shortcuts-hint">
            <span class="shortcut-item">💡 快捷鍵：</span>
            <span class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交</span>
            <span class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>H</kbd> 提示</span>
            <span class="shortcut-item"><kbd>Ctrl</kbd>+<kbd>N</kbd> 下一句</span>
            <span class="shortcut-item"><kbd>Esc</kbd> 關閉</span>
            <span class="shortcut-item"><kbd>?</kbd> 幫助</span>
          </div>
        </div>

        <!-- 結果區域 -->
        <div id="resultArea" class="result-area" style="display: none;"></div>
      </div>
    `;

    this.attachPracticeListeners();
  }

  /**
   * 練習事件監聽
   */
  attachPracticeListeners() {
    // 提交答案
    document.getElementById('submitAnswer')?.addEventListener('click', () => {
      const userAnswer = document.getElementById('userAnswer').value.trim();
      if (userAnswer) {
        this.evaluateAnswer(userAnswer);
      } else {
        this.showMessage('請先輸入你的句子！', 'warning');
      }
    });

    // 顯示提示
    document.getElementById('getHint')?.addEventListener('click', () => {
      this.showHint();
    });

    // 換句子
    document.getElementById('tryAnother')?.addEventListener('click', () => {
      document.getElementById('sentenceSelect').value = '';
      this.render();
      this.loadSentences();
      this.attachListeners();
    });

    // 文字輸入區域的鍵盤快捷鍵
    const userAnswerTextarea = document.getElementById('userAnswer');
    
    // 字元計數和輸入監聽
    userAnswerTextarea?.addEventListener('input', (e) => {
      this.updateCharCount(e.target.value);
    });
    
    userAnswerTextarea?.addEventListener('keydown', (e) => {
      // Ctrl+Enter 提交答案
      if (e.key === 'Enter' && e.ctrlKey) {
        document.getElementById('submitAnswer').click();
        e.preventDefault();
      }
      
      // Tab 鍵自動完成提示（如果有的話）
      if (e.key === 'Tab' && this.currentAutoComplete) {
        e.preventDefault();
        const cursorPos = e.target.selectionStart;
        const textBefore = e.target.value.substring(0, cursorPos);
        const textAfter = e.target.value.substring(cursorPos);
        e.target.value = textBefore + this.currentAutoComplete + textAfter;
        e.target.selectionStart = e.target.selectionEnd = cursorPos + this.currentAutoComplete.length;
        this.currentAutoComplete = null;
      }
    });

    // 顯示快捷鍵提示
    this.addKeyboardShortcutTooltips();
  }

  /**
   * AI評估答案
   */
  async evaluateAnswer(userAnswer) {
    const submitBtn = document.getElementById('submitAnswer');
    const originalText = submitBtn.textContent;
    const resultArea = document.getElementById('resultArea');
    
    // 顯示載入狀態
    submitBtn.textContent = '🤖 AI評估中...';
    submitBtn.disabled = true;
    resultArea.style.display = 'block';
    resultArea.innerHTML = `
      <div class="loading-evaluation">
        <div class="spinner"></div>
        <p>AI正在評估你的句子...</p>
      </div>
    `;

    try {
      console.log('🤖 Starting AI evaluation...');
      
      // 使用AI服務評估
      const evaluation = await this.getAIEvaluation(userAnswer);
      
      this.showEvaluationResult(evaluation, userAnswer);
      
    } catch (error) {
      console.error('❌ AI evaluation failed:', error);
      // 降級到基本評估
      const basicEvaluation = this.getBasicEvaluation(userAnswer);
      this.showEvaluationResult(basicEvaluation, userAnswer);
      
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  /**
   * AI評估服務 - 增強版包含錯誤修正
   */
  async getAIEvaluation(userAnswer) {
    const languageSpecificInstructions = this.getLanguageInstructions();
    
    const prompt = `你是專業的語言學習評估專家。請仔細評估學生的仿寫練習：

**原句：** ${this.currentSentence.text}
**學生答案：** ${userAnswer}
**語言：** ${this.currentSentence.language || 'unknown'}

${languageSpecificInstructions}

請完成以下任務：

1. **錯誤檢測** - 找出語法、拼寫、用詞錯誤
2. **提供修正** - 如果有錯誤，提供正確的版本
3. **評分** - 根據語法正確性、結構合理性、創意表達給分
4. **具體建議** - 給出改進建議

評分標準：
- 90-100分：語法完全正確，結構優秀，富有創意
- 70-89分：語法大致正確，可能有小錯誤  
- 50-69分：有明顯錯誤但能理解意思
- 30-49分：多處錯誤，結構有問題
- 0-29分：錯誤嚴重，難以理解

**必須以JSON格式回答：**
{
  "score": 65,
  "hasErrors": true,
  "correctedVersion": "Mijn dokter is aardig",
  "strengths": ["保持了基本句型結構", "有創意"],
  "errors": [
    "拼寫錯誤：'doctored' 應該是 'dokter'",
    "語言混用：'good' 是英語，荷蘭語應該用 'goed' 或 'aardig'"
  ],
  "suggestions": [
    "檢查拼寫：荷蘭語中醫生是 'dokter'",
    "避免語言混用，使用荷蘭語形容詞如 'goed', 'aardig', 'vriendelijk'"
  ],
  "overallFeedback": "句型結構正確，但需要注意拼寫和語言一致性"
}`;

    console.log('🤖 Sending enhanced AI evaluation request...');
    
    try {
      // 直接調用 chrome.runtime.sendMessage，因為 manager.safeAICall 可能有問題
      const response = await chrome.runtime.sendMessage({
        action: 'getAIResponse',
        prompt: prompt,
        context: { type: 'practice_evaluation' }
      });

      console.log('🤖 AI response received:', response);

      if (response && response.success && response.text) {
        const evaluation = this.parseAIEvaluation(response.text);
        console.log('✅ Successfully got AI evaluation:', evaluation);
        return evaluation;
      } else {
        console.warn('⚠️ AI response failed:', response);
        throw new Error(`AI service failed: ${response?.error || 'No response'}`);
      }
    } catch (error) {
      console.error('❌ AI evaluation error:', error);
      throw error;
    }
  }

  /**
   * 獲取語言特定的評估指導
   */
  getLanguageInstructions() {
    const language = this.currentSentence.language;
    
    if (language === 'dutch') {
      return `**荷蘭語語法要點：**
- 冠詞系統：het(中性)、de(陽性/陰性)、een(不定冠詞)
- 動詞變位：單數第三人稱 -t 結尾
- V2規則：動詞在第二位置
- 常見錯誤：冠詞性別混淆、動詞變位錯誤

特別檢查學生是否正確使用了：
- 冠詞的性別搭配（如feestje用het，不是de）
- 動詞的人稱變位
- 基本語序規則`;
    }
    
    if (language === 'english') {
      return `**英語語法要點：**
- 主謂一致
- 冠詞使用 (a, an, the)
- 動詞時態一致性
- 基本SVO語序`;
    }
    
    return '請檢查基本語法規則和句型結構。';
  }

  /**
   * 解析AI評估結果
   */
  parseAIEvaluation(aiResponse) {
    console.log('🔍 Parsing AI response:', aiResponse.substring(0, 500) + '...');
    
    try {
      // 嘗試解析JSON格式
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed JSON:', parsed);
        
        return {
          score: parsed.score || 70,
          feedback: this.formatAIFeedback(parsed),
          isAI: true,
          errors: parsed.errors || [],
          suggestions: parsed.suggestions || []
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse JSON, trying text parsing:', error);
    }
    
    // 降級到文本解析
    const scoreMatch = aiResponse.match(/分數[：:]\s*(\d+)|score[：:]\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : 70;
    
    return {
      score: score,
      feedback: aiResponse,
      isAI: true
    };
  }

  /**
   * 格式化AI反饋 - 包含修正建議
   */
  formatAIFeedback(parsed) {
    let feedback = '';
    
    // 如果有修正版本，優先顯示
    if (parsed.correctedVersion && parsed.hasErrors) {
      feedback += '🔧 **修正建議：**\n';
      feedback += `正確版本：「${parsed.correctedVersion}」\n\n`;
    }
    
    if (parsed.strengths && parsed.strengths.length > 0) {
      feedback += '✅ **優點：**\n';
      parsed.strengths.forEach(strength => {
        feedback += `• ${strength}\n`;
      });
      feedback += '\n';
    }
    
    if (parsed.errors && parsed.errors.length > 0) {
      feedback += '❌ **錯誤分析：**\n';
      parsed.errors.forEach(error => {
        feedback += `• ${error}\n`;
      });
      feedback += '\n';
    }
    
    if (parsed.suggestions && parsed.suggestions.length > 0) {
      feedback += '💡 **改進建議：**\n';
      parsed.suggestions.forEach(suggestion => {
        feedback += `• ${suggestion}\n`;
      });
      feedback += '\n';
    }
    
    if (parsed.overallFeedback) {
      feedback += `**總評：** ${parsed.overallFeedback}`;
    }
    
    return feedback || parsed.feedback || '評估完成';
  }

  /**
   * 基本評估（降級方案）- 包含語法檢查
   */
  getBasicEvaluation(userAnswer) {
    console.log('🔍 Running enhanced basic evaluation for:', userAnswer);
    
    const originalLength = this.currentSentence.text.split(' ').length;
    const userLength = userAnswer.split(' ').length;
    
    let score = 50;
    let feedback = '📝 **增強基本評估：**\n\n';
    let errors = [];
    let strengths = [];
    
    // 檢查句子長度
    if (Math.abs(originalLength - userLength) <= 2) {
      score += 15;
      strengths.push('句子長度適中');
    } else {
      errors.push(`句子長度差異較大（原句${originalLength}詞，你的句子${userLength}詞）`);
    }
    
    // 檢查基本內容
    if (userAnswer.length > 10) {
      score += 10;
      strengths.push('內容豐富');
    }
    
    // 檢查創意性
    if (userAnswer.toLowerCase() !== this.currentSentence.text.toLowerCase()) {
      score += 10;
      strengths.push('有創意，與原句不同');
    } else {
      errors.push('與原句完全相同，缺乏創意');
    }
    
    // 荷蘭語特定檢查
    if (this.currentSentence.language === 'dutch') {
      const dutchErrors = this.checkDutchGrammar(userAnswer, this.currentSentence.text);
      if (dutchErrors.length > 0) {
        errors.push(...dutchErrors);
        score -= dutchErrors.length * 10; // 每個錯誤扣10分
      } else {
        score += 10;
        strengths.push('基本荷蘭語語法正確');
      }
    }
    
    // 確保分數在合理範圍內
    score = Math.max(0, Math.min(100, score));
    
    // 格式化反饋
    if (strengths.length > 0) {
      feedback += '✅ **優點：**\n';
      strengths.forEach(strength => {
        feedback += `• ${strength}\n`;
      });
      feedback += '\n';
    }
    
    if (errors.length > 0) {
      feedback += '❌ **需要注意：**\n';
      errors.forEach(error => {
        feedback += `• ${error}\n`;
      });
      feedback += '\n';
    }
    
    feedback += '💡 **建議：** 嘗試使用不同的詞彙，但保持類似的句子結構。';
    feedback += '\n\n⚠️ *這是基本評估，建議使用AI評估獲得更準確的反饋。*';
    
    return {
      score: score,
      feedback: feedback,
      isAI: false,
      errors: errors,
      strengths: strengths
    };
  }
  
  /**
   * 檢查荷蘭語語法錯誤
   */
  checkDutchGrammar(userAnswer, originalSentence) {
    const errors = [];
    const userLower = userAnswer.toLowerCase();
    const originalLower = originalSentence.toLowerCase();
    
    console.log('🔍 Checking Dutch grammar for:', userAnswer);
    
    // 檢查常見的冠詞錯誤
    // 如果原句用het，學生用de，可能是錯誤的
    if (originalLower.includes('het feestje') && userLower.includes('de feestje')) {
      errors.push('冠詞錯誤：feestje是中性名詞，應該用"het"而不是"de"');
    }
    
    if (originalLower.includes('het concert') && userLower.includes('de concert')) {
      errors.push('冠詞錯誤：concert是中性名詞，應該用"het"而不是"de"');
    }
    
    // 檢查動詞變位
    if (originalLower.includes(' is ') && userLower.includes(' zijn ')) {
      errors.push('動詞變位錯誤：單數主語應該用"is"，複數主語才用"zijn"');
    }
    
    // 檢查英語混用
    const englishWords = ['good', 'nice', 'bad', 'beautiful', 'big', 'small'];
    englishWords.forEach(word => {
      if (userLower.includes(word)) {
        errors.push(`語言混用：在荷蘭語句子中使用了英語單詞"${word}"`);
      }
    });
    
    // 檢查基本語序（非常簡單的檢查）
    if (userLower.split(' ').length >= 3) {
      const words = userLower.split(' ');
      // 如果句子以動詞開始（除了疑問句），可能有語序問題
      const commonVerbs = ['is', 'zijn', 'heeft', 'hebben', 'gaat', 'gaan'];
      if (commonVerbs.includes(words[0]) && !userAnswer.includes('?')) {
        errors.push('語序可能有誤：荷蘭語陳述句通常以主語開始');
      }
    }
    
    console.log('🔍 Found Dutch grammar errors:', errors);
    return errors;
  }

  /**
   * 顯示評估結果
   */
  showEvaluationResult(evaluation, userAnswer) {
    const resultArea = document.getElementById('resultArea');
    
    const scoreClass = evaluation.score >= 80 ? 'excellent' : 
                      evaluation.score >= 60 ? 'good' : 'needs-improvement';
    
    resultArea.innerHTML = `
      <div class="evaluation-result ${scoreClass}">
        <div class="evaluation-header">
          <h4>📊 評估結果</h4>
          <div class="score-badge">${evaluation.score}/100</div>
        </div>
        
        <div class="user-answer">
          <strong>你的答案：</strong>
          <div class="answer-text">"${userAnswer}"</div>
        </div>
        
        <div class="feedback-content">
          <strong>${evaluation.isAI ? '🤖 AI評估' : '📝 基本評估'}：</strong>
          <div class="feedback-text">${evaluation.feedback.replace(/\n/g, '<br>')}</div>
        </div>
        
        <div class="action-buttons">
          <button id="tryAgain" class="secondary-btn">🔄 再試一次</button>
          <button id="nextSentence" class="primary-btn">➡️ 下一個句子</button>
        </div>
      </div>
    `;

    // 結果按鈕事件
    document.getElementById('tryAgain')?.addEventListener('click', () => {
      document.getElementById('userAnswer').value = '';
      document.getElementById('userAnswer').focus();
      resultArea.style.display = 'none';
    });
    
    document.getElementById('nextSentence')?.addEventListener('click', () => {
      document.getElementById('tryAnother').click();
    });
  }

  /**
   * AI智能提示系統
   */
  async showHint() {
    const resultArea = document.getElementById('resultArea');
    resultArea.style.display = 'block';
    
    // 先顯示載入狀態
    resultArea.innerHTML = `
      <div class="hint-box">
        <h4>🤖 AI正在分析句子結構...</h4>
        <div class="loading-hint">
          <div class="spinner"></div>
          <p>正在生成個性化提示...</p>
        </div>
      </div>
    `;

    try {
      const aiHint = await this.getAIHint();
      this.displayAIHint(aiHint);
    } catch (error) {
      console.error('AI提示失敗:', error);
      // Include debug information about the error
      const debugInfo = `錯誤類型: ${error.name}<br>錯誤訊息: ${error.message}`;
      this.displayBasicHint(debugInfo);
    }
  }

  /**
   * 獲取AI智能提示 - 增強版錯誤處理
   */
  async getAIHint() {
    // 針對具體句子的分析提示
    const languageSpecific = this.getLanguageSpecificHintPrompt();
    
    const prompt = `作為語言學習專家，請分析以下句子並為學生提供詳細的仿寫指導：

**原句：** ${this.currentSentence.text}
**語言：** ${this.currentSentence.language || 'unknown'}

${languageSpecific}

請提供以下分析：

1. **句子結構分析** - 詳細解釋語法結構
2. **關鍵詞彙分析** - 說明每個重要詞彙的作用和可替換選項  
3. **仿寫策略** - 具體的創作建議和方法
4. **實用例句** - 提供2-3個仿寫範例

**必須以純JSON格式回答（不要包含任何其他文字）：**
{
  "structure": "句子遵循 [冠詞] + [名詞] + [動詞] + [形容詞] 的結構",
  "vocabularyAnalysis": [
    {
      "word": "原詞彙（如：hoeveel）",
      "type": "詞性（如：疑問副詞）",
      "alternatives": ["同語言的替換詞1", "同語言的替換詞2", "同語言的替換詞3"],
      "explanation": "用中文簡短解釋詞彙意思和用法"
    }
  ],
  "writingStrategy": [
    "保持句型結構，替換關鍵詞彙",
    "使用同義詞豐富表達",
    "注意語法規則"
  ],
  "examples": [
    "完整的目標語言例句1",
    "完整的目標語言例句2",
    "完整的目標語言例句3"
  ],
  "tips": "用中文提供創作建議，但包含目標語言的具體詞彙例子"
}`;

    console.log('🤖 Requesting enhanced AI hint analysis...');
    console.log('🤖 Hint prompt preview:', prompt.substring(0, 300) + '...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAIResponse',
        prompt: prompt,
        context: { type: 'hint_analysis' }
      });

      console.log('🤖 AI hint response received:', response);

      if (response && response.success && response.text) {
        console.log('✅ AI hint successful, parsing response...');
        return this.parseAIHint(response.text);
      } else {
        console.warn('⚠️ AI hint response failed:', response);
        
        // 檢查是否需要配置
        if (response && response.needsConfiguration) {
          throw new Error('AI服務需要配置API密鑰，請檢查設置。點擊擴充功能圖示 → 設置 → AI設置');
        } else {
          throw new Error(`AI提示服務響應失敗: ${response?.error || '未知錯誤'}`);
        }
      }
    } catch (error) {
      console.error('❌ AI hint request failed:', error);
      
      // 改善錯誤信息
      if (error.message.includes('API key') || error.message.includes('not configured')) {
        throw new Error('AI服務未配置：請在擴充功能設置中配置API密鑰');
      } else if (error.message.includes('timeout')) {
        throw new Error('AI服務響應超時，請稍後再試');
      } else {
        throw new Error(`AI提示服務暫時不可用: ${error.message}`);
      }
    }
  }

  /**
   * 獲取語言特定的提示指導
   */
  getLanguageSpecificHintPrompt() {
    const language = this.currentSentence.language;
    const text = this.currentSentence.text;
    
    if (language === 'dutch') {
      return `**荷蘭語學習重點分析要求：**

**重要：** 所有詞彙替換選項必須是荷蘭語詞彙，不要提供中文翻譯作為替換選項！

請針對荷蘭語句子分析：
1. **詞彙分析** - 每個關鍵詞提供3-4個荷蘭語同義詞或近義詞
2. **語法特點** - 荷蘭語V2語序、冠詞系統（het/de）、動詞變位
3. **實用替換** - 提供可直接替換使用的荷蘭語詞彙

**荷蘭語常見詞彙組合：**
- 疑問詞：hoeveel → hoelang, hoevaak, wanneer, waar
- 名詞：student → leerling, cursist, deelnemer
- 動詞：bereiken → behalen, krijgen, verkrijgen
- 形容詞：goed → uitstekend, prima, fantastisch
- 時間：dag → week, maand, jaar, uur

確保所有 "alternatives" 數組只包含目標語言（荷蘭語）的詞彙！`;
    }
    
    if (language === 'english') {
      return `**English Learning Analysis Requirements:**

**Important:** All vocabulary alternatives must be in English, not Chinese translations!

Please analyze:
1. **Vocabulary** - Provide 3-4 English synonyms for each key word
2. **Grammar** - English sentence patterns, tenses, word order
3. **Practical alternatives** - English words that can be directly substituted

Ensure all "alternatives" arrays contain only English vocabulary!`;
    }
    
    return '請重點分析句子的基本結構，並提供目標語言的詞彙替換選項（不是中文翻譯）。';
  }

  /**
   * 解析AI提示回應
   */
  parseAIHint(aiResponse) {
    console.log('🔍 Parsing AI hint response type:', typeof aiResponse);
    console.log('🔍 Response length:', aiResponse ? aiResponse.length : 0);
    console.log('🔍 First 500 chars:', aiResponse ? aiResponse.substring(0, 500) : 'null/undefined');
    
    try {
      // Check if response is already an object
      if (typeof aiResponse === 'object' && aiResponse !== null) {
        console.log('📦 Response is already an object:', aiResponse);
        return this.validateHintObject(aiResponse);
      }
      
      // Handle string responses
      if (typeof aiResponse !== 'string') {
        throw new Error(`Invalid response type: ${typeof aiResponse}`);
      }
      
      // Try to parse as direct JSON first
      let parsed;
      
      // Remove any markdown code blocks if present
      const cleanedResponse = aiResponse
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      
      console.log('🧹 Cleaned response preview:', cleanedResponse.substring(0, 200));
      
      try {
        parsed = JSON.parse(cleanedResponse);
      } catch (e) {
        console.log('📌 Direct JSON parse failed, trying to extract JSON...');
        
        // Try multiple JSON extraction patterns
        const jsonPatterns = [
          /\{[\s\S]*\}/,  // Standard JSON object
          /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/  // Nested JSON objects
        ];
        
        let jsonMatch = null;
        for (const pattern of jsonPatterns) {
          jsonMatch = cleanedResponse.match(pattern);
          if (jsonMatch) {
            console.log('🎯 JSON pattern matched');
            break;
          }
        }
        
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.error('❌ JSON extraction failed:', e2);
            throw new Error('Found JSON but could not parse it');
          }
        } else {
          // Check if the response contains hint-like content without JSON
          if (cleanedResponse.includes('structure') || cleanedResponse.includes('vocabulary')) {
            console.log('📝 Response has hint content but no valid JSON');
          }
          throw new Error('No valid JSON structure found in response');
        }
      }
      
      console.log('✅ Successfully parsed AI hint:', parsed);
      return this.validateHintObject(parsed);
      
    } catch (error) {
      console.error('❌ AI hint parsing failed:', error.message);
      console.error('📄 Full response:', aiResponse);
      
      // Try to extract useful content from non-JSON response
      let fallbackStructure = '無法解析AI回應，使用基本分析';
      if (aiResponse && typeof aiResponse === 'string') {
        // Look for structure-related content
        const structureMatch = aiResponse.match(/結構[：:]\s*([^\n]+)/);
        if (structureMatch) {
          fallbackStructure = structureMatch[1].trim();
        }
      }
      
      // Enhanced fallback with better error handling
      return {
        structure: fallbackStructure,
        vocabularyAnalysis: [],
        writingStrategy: [
          '參考原句結構',
          '替換關鍵詞彙',
          '保持語法正確性'
        ],
        examples: [],
        tips: `AI解析失敗（${error.message}），建議手動分析句子結構後進行仿寫練習`
      };
    }
  }
  
  /**
   * 驗證和標準化提示物件
   */
  validateHintObject(parsed) {
    // Ensure all required fields exist with proper defaults
    const validated = {
      structure: parsed.structure || '句子結構分析中...',
      vocabularyAnalysis: Array.isArray(parsed.vocabularyAnalysis) ? parsed.vocabularyAnalysis : [],
      writingStrategy: Array.isArray(parsed.writingStrategy) ? parsed.writingStrategy : 
                      parsed.writingStrategies ? parsed.writingStrategies : // Handle alternate naming
                      ['參考原句結構', '替換關鍵詞彙'],
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      tips: parsed.tips || parsed.tip || '建議保持原句結構，替換關鍵詞彙來創作新句子'
    };
    
    console.log('✅ Validated hint object:', validated);
    return validated;
  }

  /**
   * 顯示AI提示結果
   */
  displayAIHint(hint) {
    const resultArea = document.getElementById('resultArea');
    
    let vocabularySection = '';
    if (hint.vocabularyAnalysis && hint.vocabularyAnalysis.length > 0) {
      vocabularySection = `
        <div class="vocabulary-analysis">
          <h5>📚 詞彙分析：</h5>
          ${hint.vocabularyAnalysis.map(item => `
            <div class="vocab-item">
              <strong>${item.word}</strong> (${item.type})
              <div class="alternatives">替換選項: ${item.alternatives ? item.alternatives.join(', ') : '無'}</div>
              <div class="explanation">${item.explanation || ''}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    let examplesSection = '';
    if (hint.examples && hint.examples.length > 0) {
      examplesSection = `
        <div class="examples-section">
          <h5>📝 仿寫範例：</h5>
          <ul class="examples-list">
            ${hint.examples.map(example => `<li>「${example}」</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    resultArea.innerHTML = `
      <div class="ai-hint-box">
        <h4>🤖 AI智能分析提示</h4>
        
        <div class="structure-analysis">
          <h5>🏗️ 句子結構：</h5>
          <p>${hint.structure}</p>
        </div>
        
        ${vocabularySection}
        
        <div class="strategy-section">
          <h5>✍️ 仿寫策略：</h5>
          <ul>
            ${(hint.writingStrategy || []).map(strategy => `<li>${strategy}</li>`).join('')}
          </ul>
        </div>
        
        ${examplesSection}
        
        <div class="tips-section">
          <h5>💡 重要提醒：</h5>
          <p class="tips-content">${hint.tips}</p>
        </div>
        
        <div class="hint-actions">
          <button id="closeHint" class="secondary-btn">關閉提示</button>
          <button id="startWriting" class="primary-btn">開始創作</button>
        </div>
      </div>
    `;
    
    // 綁定事件處理器
    this.bindHintActionEvents();
  }

  /**
   * 顯示基本提示（降級方案）- 智能化基本分析
   */
  displayBasicHint(debugInfo = null) {
    const intelligentHint = this.generateIntelligentBasicHint();
    
    const resultArea = document.getElementById('resultArea');
    
    // Add debug information in development mode
    const debugSection = debugInfo ? `
      <div class="debug-info" style="background: #ffebee; padding: 10px; margin-bottom: 10px; border-radius: 4px; font-size: 12px;">
        <strong>Debug Info:</strong><br>
        ${debugInfo}
      </div>
    ` : '';
    
    resultArea.innerHTML = `
      <div class="hint-box">
        <h4>💡 智能基本提示 <small>(AI暫時不可用)</small></h4>
        ${debugSection}
        <div class="hint-content">
          <p><strong>原句：</strong> ${this.currentSentence.text}</p>
          
          <div class="basic-analysis">
            <h5>📋 句子結構：</h5>
            <p>${intelligentHint.structure}</p>
          </div>
          
          <div class="vocabulary-hints">
            <h5>📚 詞彙替換建議：</h5>
            ${intelligentHint.vocabulary.map(item => `
              <div class="vocab-hint">
                <strong>${item.word}</strong> → ${item.alternatives.join(', ')}
              </div>
            `).join('')}
          </div>
          
          <div class="strategy-hints">
            <h5>✍️ 創作策略：</h5>
            <ul>
              ${intelligentHint.strategies.map(strategy => `<li>${strategy}</li>`).join('')}
            </ul>
          </div>
          
          <div class="example-hints">
            <h5>📝 範例：</h5>
            <ul>
              ${intelligentHint.examples.map(example => `<li>「${example}」</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="hint-actions">
          <button id="closeHint" class="secondary-btn">關閉提示</button>
          <button id="startWriting" class="primary-btn">開始創作</button>
        </div>
      </div>
    `;
    
    // 綁定事件處理器
    this.bindHintActionEvents();
  }

  /**
   * 綁定提示動作事件
   */
  bindHintActionEvents() {
    const closeHintBtn = document.getElementById('closeHint');
    const startWritingBtn = document.getElementById('startWriting');
    
    if (closeHintBtn) {
      closeHintBtn.addEventListener('click', () => {
        const resultArea = document.getElementById('resultArea');
        if (resultArea) {
          resultArea.style.display = 'none';
        }
      });
    }
    
    if (startWritingBtn) {
      startWritingBtn.addEventListener('click', () => {
        const userAnswer = document.getElementById('userAnswer');
        if (userAnswer) {
          userAnswer.focus();
        }
      });
    }
  }

  /**
   * 生成智能化的基本提示
   */
  generateIntelligentBasicHint() {
    const text = this.currentSentence.text;
    const language = this.currentSentence.language;
    
    // 荷蘭語句子的智能分析
    if (language === 'dutch') {
      // 問句模式：Hoeveel ... 
      if (text.includes('Hoeveel')) {
        return {
          structure: 'Hoeveel + 名詞 + 動詞 + 主語 + 動詞 + 賓語 (荷蘭語疑問句)',
          vocabulary: [
            { word: 'Hoeveel', alternatives: ['Hoelang', 'Hoevaak', 'Wanneer'] },
            { word: 'lesdagen', alternatives: ['lessen', 'weken', 'maanden'] },
            { word: 'cursist', alternatives: ['student', 'leerling', 'deelnemer'] },
            { word: 'niveau', alternatives: ['graad', 'fase', 'stadium'] },
            { word: 'bereikt', alternatives: ['behaald', 'gekregen', 'verkregen'] }
          ],
          strategies: [
            '保持疑問詞 + 名詞 + 助動詞 + 主語 的結構',
            '替換疑問詞改變問題類型',
            '替換名詞改變詢問對象', 
            '使用不同的動詞表達成就'
          ],
          examples: [
            'Hoelang heeft de student gestudeerd?',
            'Hoevaak heeft een leerling getraind?',
            'Wanneer heeft de cursist A2 niveau behaald?'
          ]
        };
      }
      
      // 描述句模式：Het/De ... is ...
      if (text.includes('Het') || text.includes('De')) {
        return {
          structure: 'het/de + 名詞 + is/zijn + 形容詞 (荷蘭語基本描述句)',
          vocabulary: [
            { word: 'Het/De', alternatives: ['Een', 'Deze', 'Die'] },
            { word: text.split(' ')[1], alternatives: ['concert', 'vergadering', 'gesprek', 'boek'] },
            { word: 'is/zijn', alternatives: ['was/waren', 'wordt/worden', 'blijft/blijven'] }
          ],
          strategies: [
            '保持 冠詞 + 名詞 + 動詞 + 形容詞 的基本結構',
            '注意 het/de 的性別搭配',
            '替換形容詞改變描述',
            '可以改變時態（is → was → wordt）'
          ],
          examples: [
            'Het concert is fantastisch',
            'De vergadering was saai', 
            'Een gesprek wordt interessant'
          ]
        };
      }
    }
    
    // 所有格句模式：Mijn/Jouw ... is een ...
    if (language === 'dutch' && (text.includes('Mijn') || text.includes('Jouw')) && text.includes('is een')) {
      return {
        structure: '所有格代詞 + 名詞 + is een + 職業/身分 (荷蘭語所有格描述句)',
        vocabulary: [
          { word: 'Mijn/Jouw', alternatives: ['Zijn', 'Haar', 'Onze', 'Jullie'] },
          { word: 'broer/zus', alternatives: ['vader', 'moeder', 'opa', 'oma'] },
          { word: 'leraar', alternatives: ['dokter', 'ingenieur', 'verpleegster', 'advocaat'] },
          { word: 'is een', alternatives: ['was een', 'wordt een', 'blijft een'] }
        ],
        strategies: [
          '保持 所有格代詞 + 名詞 + is een + 職業 的結構',
          '替換所有格代詞改變人稱', 
          '替換家庭成員或人物角色',
          '替換職業或身分名稱',
          '可以改變時態和動詞'
        ],
        examples: [
          'Zijn vader is een dokter',
          'Haar zus was een ingenieur', 
          'Onze opa wordt een vrijwilliger'
        ]
      };
    }
    
    // 通用分析 - 基於語言提供合適的建議
    const words = text.split(' ').filter(w => w.length > 2);
    
    if (language === 'dutch') {
      return {
        structure: '荷蘭語基本句子結構',
        vocabulary: words.slice(0, 3).map(word => ({
          word: word,
          alternatives: this.getDutchAlternatives(word)
        })),
        strategies: [
          '保持荷蘭語語序（V2規則）',
          '注意動詞變位和冠詞性別',
          '替換同類詞彙保持語法正確',
          '可嘗試改變時態或人稱'
        ],
        examples: [
          '使用相同句型但不同荷蘭語詞彙',
          '保持語法結構，替換核心內容'
        ]
      };
    }
    
    if (language === 'english') {
      return {
        structure: 'English basic sentence structure',
        vocabulary: words.slice(0, 3).map(word => ({
          word: word,
          alternatives: this.getEnglishAlternatives(word)
        })),
        strategies: [
          'Keep the SVO word order',
          'Replace key vocabulary with synonyms',
          'Maintain grammatical consistency', 
          'Try different tenses or forms'
        ],
        examples: [
          'Use similar structure with different English words',
          'Keep the pattern but change the content'
        ]
      };
    }
    
    // 其他語言的通用處理
    return {
      structure: '基本句子結構分析',
      vocabulary: words.slice(0, 3).map(word => ({
        word: word,
        alternatives: ['同類詞1', '同類詞2', '同類詞3']
      })),
      strategies: [
        '保持相似的句子結構',
        '替換關鍵詞彙',
        '確保語法正確',
        '表達相關但不同的內容'
      ],
      examples: [
        '參考原句創建類似句子',
        '使用相同結構但不同詞彙'
      ]
    };
  }

  /**
   * 獲取荷蘭語詞彙替換選項
   */
  getDutchAlternatives(word) {
    const dutchAlternatives = {
      // 疑問詞
      'hoeveel': ['hoelang', 'hoevaak', 'wanneer'],
      'waar': ['wanneer', 'hoe', 'waarom'],
      
      // 人物
      'student': ['leerling', 'cursist', 'deelnemer'],
      'leraar': ['docent', 'instructeur', 'trainer'],
      'cursist': ['student', 'leerling', 'deelnemer'],
      
      // 時間
      'dag': ['week', 'maand', 'jaar'],
      'week': ['dag', 'maand', 'periode'],
      'jaar': ['maand', 'semester', 'periode'],
      
      // 動詞
      'is': ['was', 'wordt', 'blijft'],
      'heeft': ['had', 'krijgt', 'neemt'],
      'bereikt': ['behaald', 'verkregen', 'gehaald'],
      
      // 形容詞
      'goed': ['prima', 'uitstekend', 'fantastisch'],
      'mooi': ['prachtig', 'fraai', 'schitterend'],
      'groot': ['enorm', 'gigantisch', 'reusachtig'],
      
      // 冠詞
      'het': ['de', 'een'],
      'de': ['het', 'een'],
      
      // 介詞
      'in': ['op', 'bij', 'aan'],
      'op': ['in', 'aan', 'bij']
    };
    
    const lowerWord = word.toLowerCase();
    return dutchAlternatives[lowerWord] || ['vergelijkbaar woord', 'synoniem', 'alternatief'];
  }

  /**
   * 獲取英語詞彙替換選項
   */
  getEnglishAlternatives(word) {
    const englishAlternatives = {
      // Question words
      'how': ['why', 'when', 'where'],
      'what': ['which', 'who', 'where'],
      'when': ['how', 'why', 'where'],
      
      // People
      'student': ['learner', 'pupil', 'participant'],
      'teacher': ['instructor', 'educator', 'tutor'],
      'person': ['individual', 'someone', 'people'],
      
      // Time
      'day': ['week', 'month', 'year'],
      'week': ['day', 'month', 'period'],
      'year': ['month', 'semester', 'period'],
      
      // Verbs
      'is': ['was', 'becomes', 'remains'],
      'has': ['had', 'gets', 'takes'],
      'reached': ['achieved', 'obtained', 'gained'],
      
      // Adjectives
      'good': ['great', 'excellent', 'fantastic'],
      'beautiful': ['gorgeous', 'lovely', 'stunning'],
      'big': ['large', 'huge', 'enormous'],
      
      // Articles
      'the': ['a', 'an', 'this'],
      'a': ['the', 'one', 'some'],
      
      // Prepositions
      'in': ['on', 'at', 'by'],
      'on': ['in', 'at', 'by']
    };
    
    const lowerWord = word.toLowerCase();
    return englishAlternatives[lowerWord] || ['similar word', 'synonym', 'alternative'];
  }

  /**
   * 更新字元計數
   */
  updateCharCount(text) {
    const charCountElement = document.getElementById('charCount');
    if (!charCountElement) return;
    
    const length = text.length;
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // 更新字元計數
    charCountElement.textContent = `${length} 字元 / ${wordCount} 詞`;
    
    // 根據長度改變顏色
    if (length === 0) {
      charCountElement.className = 'char-count empty';
    } else if (length < 10) {
      charCountElement.className = 'char-count too-short';
    } else if (length > 100) {
      charCountElement.className = 'char-count too-long';
    } else {
      charCountElement.className = 'char-count good';
    }
  }

  /**
   * 添加快捷鍵提示到按鈕
   */
  addKeyboardShortcutTooltips() {
    // 為所有支援快捷鍵的元素添加視覺提示
    const shortcuts = {
      'submitAnswer': 'Ctrl+Enter',
      'getHint': 'Ctrl+H', 
      'tryAnother': 'Ctrl+N',
      'closePractice': 'Esc'
    };

    Object.entries(shortcuts).forEach(([id, shortcut]) => {
      const element = document.getElementById(id);
      if (element) {
        // 添加快捷鍵到 title
        const currentTitle = element.getAttribute('title') || '';
        if (!currentTitle.includes(shortcut)) {
          element.setAttribute('title', currentTitle ? `${currentTitle} (${shortcut})` : shortcut);
        }
      }
    });
  }

  /**
   * 顯示消息
   */
  showMessage(message, type = 'info') {
    const resultArea = document.getElementById('resultArea');
    resultArea.style.display = 'block';
    resultArea.innerHTML = `
      <div class="message-box ${type}">
        ${message}
        <div class="message-hint">按 <kbd>Esc</kbd> 關閉視窗</div>
      </div>
    `;
    
    setTimeout(() => {
      resultArea.style.display = 'none';
    }, 3000);
  }

  /**
   * 語言顯示
   */
  getLanguageDisplay(language) {
    const langMap = {
      'dutch': '🇳🇱 荷蘭語',
      'english': '🇺🇸 英語',
      'japanese': '🇯🇵 日語',
      'korean': '🇰🇷 韓語'
    };
    return langMap[language] || `🌐 ${language}`;
  }

  /**
   * 顯示錯誤
   */
  showError(message) {
    const practiceArea = document.getElementById('practiceArea');
    practiceArea.innerHTML = `
      <div class="error-message">
        <h3>❌ 錯誤</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="primary-btn">🔄 重新載入</button>
      </div>
    `;
  }

  /**
   * 添加樣式
   */
  addStyles() {
    if (document.getElementById('cleanPracticeStyles')) return;

    const style = document.createElement('style');
    style.id = 'cleanPracticeStyles';
    style.textContent = `
      .clean-practice-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .practice-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #e0e0e0;
        padding-bottom: 15px;
        margin-bottom: 25px;
      }
      
      .practice-header h2 {
        margin: 0;
        color: #1976d2;
      }
      
      .close-btn {
        background: #f44336;
        color: white;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .sentence-selection {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 25px;
      }
      
      .sentence-selection label {
        display: block;
        font-weight: 500;
        margin-bottom: 10px;
        color: #333;
      }
      
      .sentence-dropdown {
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        background: white;
        cursor: pointer;
      }
      
      .sentence-dropdown:focus {
        outline: none;
        border-color: #1976d2;
        box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
      }
      
      .welcome-message {
        text-align: center;
        padding: 60px 20px;
        background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
        border-radius: 15px;
        color: #333;
      }
      
      .welcome-icon {
        font-size: 48px;
        margin-bottom: 20px;
      }
      
      .welcome-message h3 {
        margin: 0 0 15px 0;
        color: #1976d2;
      }
      
      .features {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-top: 25px;
        flex-wrap: wrap;
      }
      
      .features div {
        background: rgba(255, 255, 255, 0.7);
        padding: 8px 15px;
        border-radius: 20px;
        font-size: 14px;
      }
      
      .practice-interface {
        display: flex;
        flex-direction: column;
        gap: 25px;
      }
      
      .original-sentence {
        background: #f0f8ff;
        padding: 20px;
        border-radius: 12px;
        border-left: 4px solid #2196f3;
      }
      
      .original-sentence h3 {
        margin: 0 0 15px 0;
        color: #1976d2;
      }
      
      .sentence-display {
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      
      .sentence-text {
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 10px;
        line-height: 1.4;
      }
      
      .sentence-info {
        display: flex;
        gap: 10px;
        font-size: 12px;
      }
      
      .language-tag, .source-tag {
        background: #e3f2fd;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
      }
      
      .practice-section {
        background: white;
        padding: 25px;
        border-radius: 12px;
        border: 2px solid #e0e0e0;
      }
      
      .practice-section h3 {
        margin: 0 0 15px 0;
        color: #333;
      }
      
      .instruction {
        color: #666;
        line-height: 1.5;
        margin-bottom: 20px;
      }
      
      .practice-section textarea {
        width: 100%;
        padding: 15px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        line-height: 1.5;
        resize: vertical;
        font-family: inherit;
        margin-bottom: 20px;
      }
      
      .practice-section textarea:focus {
        outline: none;
        border-color: #1976d2;
        box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
      }
      
      .practice-buttons {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      
      .primary-btn {
        background: #1976d2;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .primary-btn:hover:not(:disabled) {
        background: #1565c0;
      }
      
      .primary-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      
      .secondary-btn {
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .secondary-btn:hover {
        background: #e0e0e0;
      }
      
      .keyboard-shortcuts-hint {
        margin-top: 15px;
        padding: 10px;
        background: #f0f8ff;
        border-radius: 6px;
        font-size: 12px;
        color: #666;
        text-align: center;
      }
      
      .shortcut-item {
        margin: 0 8px;
        white-space: nowrap;
      }
      
      kbd {
        display: inline-block;
        padding: 2px 6px;
        font-size: 11px;
        line-height: 1.4;
        color: #444;
        background-color: #fafafa;
        border: 1px solid #ccc;
        border-radius: 3px;
        box-shadow: 0 1px 0 rgba(0,0,0,0.1);
        font-family: monospace;
      }
      
      .result-area {
        margin-top: 20px;
      }
      
      .loading-evaluation {
        background: #f8f9fa;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
      }
      
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #1976d2;
        border-radius: 50%;
        margin: 0 auto 15px auto;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .evaluation-result {
        background: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border-left: 4px solid #2196f3;
      }
      
      .evaluation-result.excellent { border-left-color: #4caf50; }
      .evaluation-result.good { border-left-color: #ff9800; }
      .evaluation-result.needs-improvement { border-left-color: #f44336; }
      
      .evaluation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      
      .evaluation-header h4 {
        margin: 0;
        color: #333;
      }
      
      .score-badge {
        background: #1976d2;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 500;
        font-size: 18px;
      }
      
      .excellent .score-badge { background: #4caf50; }
      .good .score-badge { background: #ff9800; }
      .needs-improvement .score-badge { background: #f44336; }
      
      .user-answer {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      
      .answer-text {
        font-style: italic;
        color: #1976d2;
        font-size: 16px;
        margin-top: 8px;
      }
      
      .feedback-content {
        margin-bottom: 20px;
      }
      
      .feedback-text {
        background: #f0f8ff;
        padding: 15px;
        border-radius: 8px;
        line-height: 1.6;
        margin-top: 10px;
      }
      
      .action-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .hint-box {
        background: #fff9c4;
        padding: 20px;
        border-radius: 12px;
        border-left: 4px solid #ffc107;
      }
      
      .hint-box h4 {
        margin: 0 0 15px 0;
        color: #f57f17;
      }
      
      .hint-content ul {
        padding-left: 20px;
      }
      
      .hint-content li {
        margin-bottom: 5px;
      }
      
      .basic-analysis {
        background: rgba(255,255,255,0.8);
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        border-left: 3px solid #ff9800;
      }
      
      .vocabulary-hints {
        background: rgba(255,255,255,0.8);
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        border-left: 3px solid #4caf50;
      }
      
      .vocab-hint {
        background: #f0f8ff;
        padding: 6px 10px;
        margin: 6px 0;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .vocab-hint strong {
        color: #1976d2;
      }
      
      .strategy-hints {
        background: rgba(255,255,255,0.8);
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        border-left: 3px solid #2196f3;
      }
      
      .example-hints {
        background: rgba(255,255,255,0.8);
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 12px;
        border-left: 3px solid #9c27b0;
      }
      
      .basic-analysis h5, .vocabulary-hints h5, .strategy-hints h5, .example-hints h5 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #333;
        font-weight: 600;
      }
      
      .ai-hint-box {
        background: linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 100%);
        padding: 25px;
        border-radius: 15px;
        border-left: 4px solid #4caf50;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      .ai-hint-box h4 {
        margin: 0 0 20px 0;
        color: #2e7d32;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .ai-hint-box h5 {
        color: #1976d2;
        margin: 15px 0 10px 0;
        font-size: 16px;
      }
      
      .structure-analysis {
        background: rgba(255,255,255,0.7);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
      }
      
      .vocabulary-analysis {
        background: rgba(255,255,255,0.7);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
      }
      
      .vocab-item {
        background: white;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 10px;
        border-left: 3px solid #2196f3;
      }
      
      .vocab-item strong {
        color: #1976d2;
        font-size: 16px;
      }
      
      .alternatives {
        color: #4caf50;
        font-size: 14px;
        margin: 5px 0;
        font-weight: 500;
      }
      
      .explanation {
        color: #666;
        font-size: 13px;
        font-style: italic;
      }
      
      .strategy-section {
        background: rgba(255,255,255,0.7);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
      }
      
      .strategy-section ul {
        padding-left: 20px;
      }
      
      .strategy-section li {
        margin-bottom: 8px;
        line-height: 1.4;
      }
      
      .examples-section {
        background: rgba(255,255,255,0.7);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
      }
      
      .examples-list {
        list-style: none;
        padding: 0;
      }
      
      .examples-list li {
        background: #e3f2fd;
        padding: 8px 12px;
        margin: 8px 0;
        border-radius: 6px;
        border-left: 3px solid #2196f3;
        font-style: italic;
        color: #1976d2;
      }
      
      .tips-section {
        background: rgba(255,255,255,0.7);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      
      .tips-section p {
        margin: 0;
        line-height: 1.5;
        color: #d84315;
        font-weight: 500;
      }
      
      .hint-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .loading-hint {
        text-align: center;
        padding: 20px;
      }
      
      .loading-hint .spinner {
        width: 24px;
        height: 24px;
        margin: 0 auto 15px auto;
      }
      
      .message-box {
        padding: 15px;
        border-radius: 8px;
        text-align: center;
      }
      
      .message-box.warning {
        background: #fff3e0;
        color: #ef6c00;
        border: 1px solid #ffb74d;
      }
      
      .message-box.info {
        background: #e3f2fd;
        color: #1976d2;
        border: 1px solid #90caf9;
      }
      
      .message-hint {
        margin-top: 8px;
        font-size: 11px;
        opacity: 0.8;
      }
      
      .input-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        font-size: 12px;
        color: #666;
      }
      
      .char-count {
        font-weight: 500;
        transition: color 0.2s;
      }
      
      .char-count.empty {
        color: #999;
      }
      
      .char-count.too-short {
        color: #ff9800;
      }
      
      .char-count.good {
        color: #4caf50;
      }
      
      .char-count.too-long {
        color: #f44336;
      }
      
      .input-hints {
        color: #999;
      }
      
      .error-message {
        text-align: center;
        padding: 40px;
        background: #ffebee;
        border-radius: 12px;
        color: #c62828;
      }
      
      .tips-section {
        background: rgba(255,255,255,0.8);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        border-left: 3px solid #ff9800;
      }
      
      .tips-content {
        line-height: 1.6;
        color: #333;
        font-size: 14px;
        word-wrap: break-word;
        white-space: pre-wrap;
        max-height: 200px;
        overflow-y: auto;
      }
      
      .hint-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 20px;
      }
      
      .hint-actions button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .primary-btn {
        background: #1976d2;
        color: white;
      }
      
      .primary-btn:hover {
        background: #1565c0;
        transform: translateY(-1px);
      }
      
      .secondary-btn {
        background: #e0e0e0;
        color: #333;
      }
      
      .secondary-btn:hover {
        background: #d0d0d0;
        transform: translateY(-1px);
      }
      
      /* 快捷鍵幫助模態框 */
      .shortcuts-help-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .shortcuts-help-content {
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        position: relative;
        animation: slideIn 0.3s ease;
      }
      
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .shortcuts-help-content h3 {
        margin: 0 0 20px 0;
        color: #1976d2;
        font-size: 24px;
      }
      
      .close-help-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        background: #f44336;
        color: white;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      
      .close-help-btn:hover {
        background: #d32f2f;
      }
      
      .shortcuts-list {
        margin: 20px 0;
      }
      
      .shortcut-group {
        margin-bottom: 25px;
      }
      
      .shortcut-group h4 {
        margin: 0 0 15px 0;
        color: #666;
        font-size: 16px;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }
      
      .shortcut-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f5f5f5;
      }
      
      .shortcut-keys {
        flex: 0 0 150px;
        font-family: monospace;
      }
      
      .shortcut-desc {
        flex: 1;
        color: #666;
        padding-left: 20px;
      }
      
      .help-footer {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #eee;
        text-align: center;
        color: #666;
        font-size: 14px;
      }
      
      @media (max-width: 600px) {
        .clean-practice-container {
          padding: 15px;
        }
        
        .features {
          flex-direction: column;
          gap: 10px;
        }
        
        .practice-buttons, .action-buttons {
          flex-direction: column;
        }
        
        .evaluation-header {
          flex-direction: column;
          gap: 15px;
          text-align: center;
        }
        
        .keyboard-shortcuts-hint {
          font-size: 11px;
        }
        
        .shortcut-item {
          display: block;
          margin: 4px 0;
        }
        
        .shortcuts-help-content {
          padding: 20px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CleanPracticeUI;
}

// Also export to window for browser usage
if (typeof window !== 'undefined') {
  window.CleanPracticeUI = CleanPracticeUI;
}