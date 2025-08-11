/**
 * Simple Imitation Practice UI Component - Clean Rewrite
 * 簡化版仿寫練習界面 - 專注於核心功能
 */

class SimplePracticeUI {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager || new ImitationPracticeManager();
    this.currentSentence = null;
    this.currentPattern = null;
  }

  /**
   * 初始化UI
   */
  async initialize() {
    console.log('🚀 Initializing SimplePracticeUI');
    this.render();
    await this.loadSentences();
    this.attachListeners();
  }

  /**
   * 渲染主界面
   */
  render() {
    this.container.innerHTML = `
      <div class="simple-practice-container">
        <div class="practice-header">
          <h2>📝 句型仿寫練習</h2>
          <button class="close-btn" id="closePractice">×</button>
        </div>
        
        <div class="sentence-selection">
          <label>選擇句子開始練習：</label>
          <select id="sentenceSelect" class="sentence-dropdown">
            <option value="">載入中...</option>
          </select>
          <button id="refreshSentences">🔄</button>
        </div>
        
        <div class="practice-area" id="practiceArea">
          <div class="welcome-message">
            <p>👆 請先選擇一個句子開始練習</p>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
  }

  /**
   * 加載句子
   */
  async loadSentences() {
    try {
      console.log('📦 Loading sentences...');
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'getHistory'
      });

      console.log('📦 History response:', response);
      
      let sentences = [];
      if (Array.isArray(response)) {
        sentences = response;
      } else if (response && response.history) {
        sentences = response.history;
      }

      // Filter sentences
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

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    
    sentences.forEach(sentence => {
      const key = sentence.text.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(sentence);
      }
    });

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

    console.log(`📝 Populated dropdown with ${unique.length} sentences`);
  }

  /**
   * 事件監聽
   */
  attachListeners() {
    // Close button
    document.getElementById('closePractice')?.addEventListener('click', () => {
      this.container.style.display = 'none';
    });

    // Sentence selection
    document.getElementById('sentenceSelect')?.addEventListener('change', (e) => {
      if (e.target.value && e.target.selectedOptions[0]) {
        const option = e.target.selectedOptions[0];
        if (option.dataset.sentence) {
          const sentenceData = JSON.parse(option.dataset.sentence);
          this.startPractice(sentenceData);
        }
      }
    });

    // Refresh button
    document.getElementById('refreshSentences')?.addEventListener('click', () => {
      this.loadSentences();
    });
  }

  /**
   * 開始練習 - 核心方法
   */
  async startPractice(sentenceData) {
    console.log('🎯 Starting practice with:', sentenceData);
    
    this.currentSentence = sentenceData;
    
    // Step 1: Show original sentence immediately
    this.showStep1(sentenceData);
    
    // Step 2: Analyze pattern
    setTimeout(() => {
      this.showStep2(sentenceData);
    }, 500);
  }

  /**
   * 步驟1：顯示原句
   */
  showStep1(sentenceData) {
    const practiceArea = document.getElementById('practiceArea');
    practiceArea.innerHTML = `
      <div class="practice-step" id="step1">
        <h3>📝 步驟1：原始句子</h3>
        <div class="sentence-card">
          <div class="sentence-text">${sentenceData.text}</div>
          <div class="sentence-meta">
            <span>🌐 ${sentenceData.language || 'unknown'}</span>
            <span>📺 ${sentenceData.source || 'saved'}</span>
          </div>
        </div>
        <div class="loading">🔍 正在分析句型...</div>
      </div>
    `;
  }

  /**
   * 步驟2：顯示句型分析
   */
  showStep2(sentenceData) {
    console.log('🔍 Analyzing pattern for:', sentenceData.text);
    
    const pattern = this.analyzePattern(sentenceData);
    this.currentPattern = pattern;
    
    console.log('✅ Pattern analyzed:', pattern);

    const practiceArea = document.getElementById('practiceArea');
    practiceArea.innerHTML += `
      <div class="practice-step" id="step2">
        <h3>🎯 步驟2：句型分析</h3>
        <div class="pattern-card">
          <div class="pattern-template">
            <strong>句型模板：</strong> ${pattern.template}
          </div>
          <div class="grammar-points">
            <strong>語法要點：</strong>
            <ul>
              ${pattern.grammarPoints.map(point => `<li>${point}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="loading">💡 正在生成建議...</div>
      </div>
    `;

    // Step 3: Show suggestions
    setTimeout(() => {
      this.showStep3(sentenceData, pattern);
    }, 500);
  }

  /**
   * 步驟3：顯示詞彙建議
   */
  showStep3(sentenceData, pattern) {
    console.log('💡 Generating suggestions...');
    
    const suggestions = this.generateSuggestions(sentenceData);
    console.log('✅ Suggestions generated:', suggestions);

    const practiceArea = document.getElementById('practiceArea');
    practiceArea.innerHTML += `
      <div class="practice-step" id="step3">
        <h3>📚 步驟3：詞彙替換建議</h3>
        <div class="suggestions-grid">
          ${suggestions.map(s => `
            <div class="suggestion-card">
              <div class="word-original">${s.original}</div>
              <div class="word-type">${s.type}</div>
              <div class="word-alternatives">${s.alternatives.join(', ')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Step 4: Show practice input
    setTimeout(() => {
      this.showStep4(sentenceData, pattern);
    }, 500);
  }

  /**
   * 步驟4：練習輸入
   */
  showStep4(sentenceData, pattern) {
    console.log('✏️ Showing practice input...');

    const practiceArea = document.getElementById('practiceArea');
    practiceArea.innerHTML += `
      <div class="practice-step" id="step4">
        <h3>✏️ 步驟4：創造你的句子</h3>
        <div class="practice-input">
          <p>使用模板：<strong>${pattern.template}</strong></p>
          <textarea id="userAnswer" placeholder="在這裡輸入你的句子..." rows="3"></textarea>
          <div class="practice-buttons">
            <button id="submitAnswer" class="submit-btn">✅ 提交答案</button>
            <button id="showHint" class="hint-btn">💡 提示</button>
            <button id="tryAnother" class="next-btn">🔄 換一個句子</button>
          </div>
        </div>
        <div id="evaluation"></div>
      </div>
    `;

    this.attachPracticeListeners();
  }

  /**
   * 練習區事件監聽
   */
  attachPracticeListeners() {
    document.getElementById('submitAnswer')?.addEventListener('click', () => {
      const userAnswer = document.getElementById('userAnswer').value.trim();
      if (userAnswer) {
        this.evaluateAnswer(userAnswer);
      } else {
        this.showMessage('請先輸入你的句子！', 'warning');
      }
    });

    document.getElementById('showHint')?.addEventListener('click', () => {
      this.showHint();
    });

    document.getElementById('tryAnother')?.addEventListener('click', () => {
      document.getElementById('sentenceSelect').value = '';
      document.getElementById('practiceArea').innerHTML = `
        <div class="welcome-message">
          <p>👆 請選擇另一個句子開始練習</p>
        </div>
      `;
    });
  }

  /**
   * 句型分析
   */
  analyzePattern(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    const originalText = sentenceData.text;
    
    console.log('🔍 Analyzing sentence:');
    console.log('  - Original:', originalText);
    console.log('  - Lowercase:', text);
    console.log('  - Contains "na hoeveel":', text.includes('na hoeveel'));
    console.log('  - Contains "heeft":', text.includes('heeft'));
    console.log('  - Language:', sentenceData.language);
    console.log('  - IsDutch:', this.isDutch(text));
    
    // Dutch question pattern: "Na hoeveel lesdagen heeft..."
    if (text.includes('na hoeveel') && text.includes('heeft')) {
      console.log('✅ Matched Dutch question pattern');
      return {
        template: 'Na [時間詞] [動詞] [主語] [目標/結果] [動詞過去分詞]?',
        grammarPoints: [
          '荷蘭語疑問句：Na + 疑問詞 + 助動詞 + 主語 + 賓語 + 過去分詞',
          'Na hoeveel = 在多少...之後',
          'heeft...bereikt = 現在完成時結構',
          'V2規則：助動詞heeft在第二位置'
        ],
        complexity: 'intermediate',
        language: 'dutch'
      };
    }
    
    console.log('❌ Did not match specific Dutch question pattern, trying other patterns...');
    
    // Dutch simple sentence: "Het feestje is gezellig"
    if (text.includes('het') && text.includes('is') && !text.includes('?')) {
      return {
        template: '[het/de] [名詞] [is/zijn] [形容詞]',
        grammarPoints: [
          '荷蘭語基本句型：冠詞 + 名詞 + 動詞 + 形容詞',
          'het 是中性冠詞，用於中性名詞',
          'is 是第三人稱單數動詞',
          '形容詞作表語，位於句末'
        ],
        complexity: 'beginner',
        language: 'dutch'
      };
    }
    
    // Dutch general patterns
    if (sentenceData.language === 'dutch' || this.isDutch(text)) {
      if (text.includes('?')) {
        return {
          template: '[疑問詞] [助動詞] [主語] [賓語/補語]?',
          grammarPoints: [
            '荷蘭語疑問句結構',
            'V2規則：動詞在第二位置',
            '疑問詞置於句首'
          ],
          complexity: 'intermediate',
          language: 'dutch'
        };
      } else {
        return {
          template: '[主語] [動詞] [賓語/補語]',
          grammarPoints: [
            '荷蘭語陳述句：主語 + 動詞 + 其他成分',
            'V2規則：動詞在第二位置',
            '基本SVO語序'
          ],
          complexity: 'beginner',
          language: 'dutch'
        };
      }
    }

    // English analysis
    if (sentenceData.language === 'english' || /^[a-zA-Z\s.,!?]+$/.test(text)) {
      return {
        template: '[Subject] [Verb] [Object/Complement]',
        grammarPoints: [
          '英語基本句型：主語 + 動詞 + 賓語/補語',
          'SVO語序結構',
          '注意主謂一致'
        ],
        complexity: 'beginner',
        language: 'english'
      };
    }

    // Generic fallback
    return {
      template: '[詞彙1] [詞彙2] [詞彙3]',
      grammarPoints: ['基本句型結構分析'],
      complexity: 'intermediate',
      language: sentenceData.language || 'unknown'
    };
  }
  
  /**
   * 檢測是否為荷蘭語
   */
  isDutch(text) {
    const dutchWords = [
      'het', 'de', 'een', 'is', 'zijn', 'was', 'waren', 'heeft', 'hebben',
      'hoeveel', 'waar', 'wanneer', 'hoe', 'wat', 'wie', 'na', 'voor',
      'cursist', 'niveau', 'bereikt', 'lesdagen', 'gezellig', 'feestje'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const dutchWordCount = words.filter(word => dutchWords.includes(word)).length;
    
    // If more than 30% of words are Dutch, consider it Dutch
    return dutchWordCount / words.length > 0.3;
  }

  /**
   * 生成詞彙建議
   */
  generateSuggestions(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    
    console.log('💡 Generating suggestions for:', text);
    
    // Dutch question: "Na hoeveel lesdagen heeft een cursist A2 niveau bereikt?"
    if (text.includes('na hoeveel lesdagen heeft')) {
      return [
        {
          original: 'hoeveel',
          type: '疑問詞',
          alternatives: ['welke', 'welk aantal', 'hoe veel']
        },
        {
          original: 'lesdagen',
          type: '名詞',
          alternatives: ['weken', 'maanden', 'uren', 'sessies']
        },
        {
          original: 'cursist',
          type: '名詞',
          alternatives: ['student', 'leerling', 'deelnemer']
        },
        {
          original: 'A2 niveau',
          type: '名詞片語',
          alternatives: ['B1 niveau', 'beginnersniveau', 'basisniveau']
        },
        {
          original: 'bereikt',
          type: '過去分詞',
          alternatives: ['behaald', 'gekregen', 'verworven']
        }
      ];
    }
    
    // Dutch simple: "Het feestje is gezellig"
    if (text.includes('het feestje is gezellig')) {
      return [
        {
          original: 'Het',
          type: '冠詞',
          alternatives: ['De', 'Een']
        },
        {
          original: 'feestje',
          type: '名詞',
          alternatives: ['vergadering', 'concert', 'gesprek']
        },
        {
          original: 'is',
          type: '動詞',
          alternatives: ['was', 'wordt', 'blijft']
        },
        {
          original: 'gezellig',
          type: '形容詞',
          alternatives: ['leuk', 'interessant', 'saai']
        }
      ];
    }

    // Dutch general suggestions
    if (sentenceData.language === 'dutch' || this.isDutch(text)) {
      const words = sentenceData.text.split(' ').filter(w => w.length > 2);
      return words.slice(0, 5).map(word => {
        // Try to give better alternatives for common Dutch words
        const alternatives = this.getDutchAlternatives(word.toLowerCase());
        return {
          original: word,
          type: '詞彙',
          alternatives: alternatives
        };
      });
    }

    // Generic suggestions for other languages
    const words = sentenceData.text.split(' ').filter(w => w.length > 2);
    return words.slice(0, 4).map(word => ({
      original: word,
      type: '詞彙',
      alternatives: ['選項1', '選項2', '選項3']
    }));
  }
  
  /**
   * 獲取荷蘭語詞彙的替代選項
   */
  getDutchAlternatives(word) {
    const alternatives = {
      'het': ['de', 'een'],
      'de': ['het', 'een'],
      'is': ['was', 'wordt', 'blijft'],
      'zijn': ['waren', 'worden'],
      'heeft': ['had', 'krijgt', 'bezit'],
      'een': ['de', 'het'],
      'na': ['voor', 'tijdens', 'binnen'],
      'hoeveel': ['welke', 'wat voor', 'hoe veel'],
      'waar': ['wanneer', 'hoe', 'waarom'],
      'cursist': ['student', 'leerling', 'deelnemer'],
      'niveau': ['graad', 'stand', 'peil'],
      'bereikt': ['behaald', 'gekregen', 'verworven']
    };
    
    return alternatives[word] || ['alternatief1', 'alternatief2', 'alternatief3'];
  }

  /**
   * 評估答案
   */
  evaluateAnswer(userAnswer) {
    console.log('🧐 Evaluating answer:', userAnswer);
    
    const evaluationDiv = document.getElementById('evaluation');
    const originalWords = this.currentSentence.text.split(' ').length;
    const userWords = userAnswer.split(' ').length;
    
    let score = 50; // Base score
    let feedback = [];
    let suggestions = [];

    // Check word count
    if (userWords === originalWords) {
      score += 15;
      feedback.push('✅ 詞彙數量正確');
    } else {
      feedback.push(`⚠️ 詞彙數量：你用了${userWords}個詞，原句有${originalWords}個詞`);
    }

    // Check length
    if (userAnswer.length > 5) {
      score += 15;
      feedback.push('✅ 句子長度合理');
    }

    // Check if different from original
    if (userAnswer.toLowerCase() !== this.currentSentence.text.toLowerCase()) {
      score += 20;
      feedback.push('✅ 你創造了不同的句子');
    } else {
      feedback.push('ℹ️ 你使用了完全相同的句子');
    }

    // Add encouragement
    if (score >= 70) {
      suggestions.push('太棒了！你很好地掌握了這個句型');
    } else if (score >= 50) {
      suggestions.push('不錯的嘗試！繼續練習會更好');
    } else {
      suggestions.push('繼續努力！可以參考句型模板');
    }

    evaluationDiv.innerHTML = `
      <div class="evaluation-result ${score >= 70 ? 'good' : score >= 50 ? 'ok' : 'needs-work'}">
        <h4>📊 評估結果</h4>
        <div class="score">得分：${score}/100</div>
        <div class="your-answer">你的答案：「${userAnswer}」</div>
        <div class="feedback">
          <strong>反饋：</strong>
          <ul>${feedback.map(f => `<li>${f}</li>`).join('')}</ul>
        </div>
        <div class="suggestions">
          <strong>建議：</strong>
          <ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  /**
   * 顯示提示
   */
  showHint() {
    this.showMessage(`💡 提示：使用句型模板 "${this.currentPattern.template}" 來構造你的句子。試著替換其中的詞彙，保持相同的語法結構。`, 'info');
  }

  /**
   * 顯示消息
   */
  showMessage(message, type = 'info') {
    const evaluationDiv = document.getElementById('evaluation');
    evaluationDiv.innerHTML = `
      <div class="message ${type}">
        ${message}
      </div>
    `;
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
        <button onclick="location.reload()">🔄 重新載入</button>
      </div>
    `;
  }

  /**
   * 添加樣式
   */
  addStyles() {
    if (document.getElementById('simplePracticeStyles')) return;

    const style = document.createElement('style');
    style.id = 'simplePracticeStyles';
    style.textContent = `
      .simple-practice-container {
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
        margin-bottom: 20px;
      }
      
      .close-btn {
        background: #ff5722;
        color: white;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
      }
      
      .sentence-selection {
        background: #f9f9f9;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      
      .sentence-dropdown {
        width: calc(100% - 60px);
        padding: 8px 12px;
        font-size: 14px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .practice-step {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .sentence-card {
        background: #f0f8ff;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid #2196f3;
      }
      
      .sentence-text {
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 10px;
      }
      
      .sentence-meta {
        font-size: 12px;
        color: #666;
      }
      
      .sentence-meta span {
        margin-right: 15px;
      }
      
      .pattern-card {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid #4caf50;
      }
      
      .pattern-template {
        font-size: 16px;
        margin-bottom: 10px;
      }
      
      .suggestions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
      }
      
      .suggestion-card {
        background: #e8f5e8;
        padding: 12px;
        border-radius: 6px;
        text-align: center;
      }
      
      .word-original {
        font-weight: bold;
        font-size: 16px;
        margin-bottom: 5px;
      }
      
      .word-type {
        font-size: 12px;
        color: #666;
        margin-bottom: 8px;
      }
      
      .word-alternatives {
        font-size: 14px;
        color: #2e7d32;
      }
      
      .practice-input textarea {
        width: 100%;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 6px;
        font-size: 16px;
        resize: vertical;
        margin-bottom: 15px;
      }
      
      .practice-buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      .practice-buttons button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .submit-btn { background: #4caf50; color: white; }
      .hint-btn { background: #2196f3; color: white; }
      .next-btn { background: #ff9800; color: white; }
      
      .evaluation-result {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin-top: 15px;
        border-left: 4px solid #2196f3;
      }
      
      .evaluation-result.good { border-left-color: #4caf50; background: #f1f8e9; }
      .evaluation-result.ok { border-left-color: #ff9800; background: #fff8e1; }
      .evaluation-result.needs-work { border-left-color: #f44336; background: #ffebee; }
      
      .score {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 10px;
      }
      
      .your-answer {
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
      }
      
      .loading {
        text-align: center;
        color: #666;
        font-style: italic;
        margin-top: 10px;
      }
      
      .welcome-message {
        text-align: center;
        color: #666;
        padding: 40px;
        background: #fafafa;
        border-radius: 8px;
      }
      
      .error-message {
        background: #ffebee;
        color: #c62828;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
      }
      
      .message {
        padding: 15px;
        border-radius: 6px;
        margin: 10px 0;
      }
      
      .message.info { background: #e3f2fd; color: #1565c0; }
      .message.warning { background: #fff3e0; color: #e65100; }
      .message.error { background: #ffebee; color: #c62828; }
    `;
    
    document.head.appendChild(style);
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimplePracticeUI;
}