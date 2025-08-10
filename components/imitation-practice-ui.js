/**
 * Imitation Practice UI Component
 * 仿寫練習界面組件
 */

class ImitationPracticeUI {
  constructor(container, manager) {
    this.container = container;
    this.manager = manager || new ImitationPracticeManager();
    this.currentPractice = null;
    this.userInput = '';
    this.startTime = null;
  }

  /**
   * 初始化UI
   */
  async initialize() {
    this.render();
    await this.loadSavedSentences();
  }

  /**
   * 渲染主界面
   */
  render() {
    this.container.innerHTML = `
      <div class="imitation-practice-container">
        <div class="practice-header">
          <h2>✍️ 仿寫練習 (Imitation Practice)</h2>
          <button class="close-btn" id="closePractice">×</button>
        </div>
        
        <div class="practice-tabs">
          <button class="tab-btn active" data-type="substitution">
            🔄 替換練習
          </button>
          <button class="tab-btn" data-type="expansion">
            ➕ 擴展練習
          </button>
          <button class="tab-btn" data-type="transformation">
            🔀 轉換練習
          </button>
          <button class="tab-btn" data-type="contextual">
            🎭 情境練習
          </button>
        </div>
        
        <div class="sentence-selector">
          <label>選擇句子 (Choose a sentence):</label>
          <select id="sentenceSelect" class="sentence-dropdown">
            <option value="">載入中...</option>
          </select>
          <button class="refresh-btn" id="refreshSentences">🔄</button>
        </div>
        
        <div class="practice-area" id="practiceArea">
          <!-- Dynamic content will be loaded here -->
        </div>
        
        <div class="practice-stats" id="practiceStats">
          <!-- Stats will be displayed here -->
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.applyStyles();
  }

  /**
   * 載入保存的句子
   */
  async loadSavedSentences() {
    try {
      // 從歷史記錄中獲取句子
      const response = await chrome.runtime.sendMessage({ 
        action: 'getLearningHistory',
        filter: { hasText: true, limit: 50 }
      });

      if (response && response.history) {
        const sentences = response.history.filter(item => 
          item.text && item.text.length > 10 && item.text.split(' ').length > 3
        );

        this.populateSentenceDropdown(sentences);
      }
    } catch (error) {
      console.error('Failed to load sentences:', error);
      this.showError('無法載入句子，請重試');
    }
  }

  /**
   * 填充句子下拉選單
   */
  populateSentenceDropdown(sentences) {
    const select = document.getElementById('sentenceSelect');
    select.innerHTML = '<option value="">選擇一個句子開始練習...</option>';

    sentences.forEach((sentence, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.dataset.sentence = JSON.stringify(sentence);
      
      // 截斷過長的句子
      const displayText = sentence.text.length > 60 
        ? sentence.text.substring(0, 57) + '...' 
        : sentence.text;
      
      // 顯示來源
      const source = sentence.source || 'unknown';
      option.textContent = `${displayText} (${source})`;
      
      select.appendChild(option);
    });
  }

  /**
   * 開始練習
   */
  startPractice(sentenceData, practiceType) {
    this.startTime = Date.now();
    this.currentPractice = this.manager.generatePractice(sentenceData, practiceType);
    this.renderPractice();
  }

  /**
   * 渲染練習內容
   */
  renderPractice() {
    const practiceArea = document.getElementById('practiceArea');
    
    if (!this.currentPractice) {
      practiceArea.innerHTML = '<p class="no-practice">請選擇一個句子開始練習</p>';
      return;
    }

    const practice = this.currentPractice;
    
    practiceArea.innerHTML = `
      <div class="practice-content">
        <div class="original-sentence">
          <h3>📝 原句 (Original):</h3>
          <p class="sentence-display">${practice.originalSentence.text}</p>
          ${practice.originalSentence.translation ? 
            `<p class="translation">${practice.originalSentence.translation}</p>` : ''}
        </div>
        
        <div class="pattern-info">
          <h3>🎯 句型 (Pattern):</h3>
          <p class="pattern-template">${practice.pattern.template}</p>
        </div>
        
        <div class="exercise-section">
          ${this.renderExercises(practice.exercises, practice.type)}
        </div>
        
        <div class="hints-section">
          <h4>💡 提示 (Hints):</h4>
          <ul class="hints-list">
            ${practice.hints.map(hint => `<li>${hint}</li>`).join('')}
          </ul>
        </div>
        
        <div class="user-input-section">
          <h4>✍️ 你的句子 (Your sentence):</h4>
          <textarea 
            id="userSentence" 
            class="user-input"
            placeholder="在這裡寫下你的句子..."
            rows="3"
          ></textarea>
          
          <div class="action-buttons">
            <button class="submit-btn" id="submitAnswer">
              提交答案 (Submit)
            </button>
            <button class="example-btn" id="showExamples">
              查看範例 (Examples)
            </button>
            <button class="hint-btn" id="getHint">
              獲取提示 (Get Hint)
            </button>
          </div>
        </div>
        
        <div class="feedback-section" id="feedbackSection" style="display: none;">
          <!-- Feedback will be displayed here -->
        </div>
      </div>
    `;

    this.attachPracticeListeners();
  }

  /**
   * 渲染練習題
   */
  renderExercises(exercises, type) {
    switch(type) {
      case 'substitution':
        return this.renderSubstitutionExercises(exercises);
      case 'expansion':
        return this.renderExpansionExercises(exercises);
      case 'transformation':
        return this.renderTransformationExercises(exercises);
      case 'contextual':
        return this.renderContextualExercises(exercises);
      default:
        return '<p>練習載入中...</p>';
    }
  }

  /**
   * 渲染替換練習
   */
  renderSubstitutionExercises(exercises) {
    return `
      <div class="substitution-exercises">
        <h4>🔄 替換練習指示：</h4>
        ${exercises.map((ex, index) => `
          <div class="exercise-item">
            <p class="instruction">${ex.instruction}</p>
            <p class="template-display">${this.highlightBlank(ex.template, ex.targetBlank)}</p>
            <div class="suggestions">
              建議詞彙: ${ex.suggestions.map(s => `<span class="suggestion-chip">${s}</span>`).join(' ')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 高亮顯示填空位置
   */
  highlightBlank(template, targetIndex) {
    const blanks = template.match(/\[([^\]]+)\]/g) || [];
    let result = template;
    
    blanks.forEach((blank, index) => {
      if (index === targetIndex) {
        result = result.replace(blank, `<span class="highlight-blank">${blank}</span>`);
      }
    });
    
    return result;
  }

  /**
   * 提交答案並評估
   */
  async submitAnswer() {
    const userSentence = document.getElementById('userSentence').value.trim();
    
    if (!userSentence) {
      this.showError('請輸入你的句子');
      return;
    }

    // 顯示載入狀態
    this.showLoading();

    try {
      // 評估用戶的答案
      const evaluation = this.manager.evaluateImitation(
        userSentence, 
        this.currentPractice.pattern, 
        this.currentPractice.type
      );

      // 計算花費時間
      const timeSpent = Math.round((Date.now() - this.startTime) / 1000);

      // 保存練習記錄
      await this.manager.savePracticeRecord(
        this.currentPractice,
        userSentence,
        { ...evaluation, timeSpent }
      );

      // 顯示反饋
      this.showFeedback(evaluation);

      // 更新統計
      await this.updateStats();

    } catch (error) {
      console.error('Failed to evaluate answer:', error);
      this.showError('評估失敗，請重試');
    }
  }

  /**
   * 顯示評估反饋
   */
  showFeedback(evaluation) {
    const feedbackSection = document.getElementById('feedbackSection');
    
    const scoreClass = evaluation.score >= 80 ? 'high-score' : 
                      evaluation.score >= 60 ? 'medium-score' : 'low-score';

    feedbackSection.innerHTML = `
      <div class="feedback-content">
        <h3>📊 評估結果 (Evaluation):</h3>
        
        <div class="score-display ${scoreClass}">
          <span class="score-number">${evaluation.score}</span>
          <span class="score-label">分</span>
        </div>
        
        <div class="encouragement">
          ${evaluation.encouragement}
        </div>
        
        <div class="feedback-details">
          <h4>✅ 做得好的地方：</h4>
          <ul>
            ${evaluation.strengths.map(s => `<li>${s}</li>`).join('')}
          </ul>
          
          ${evaluation.corrections.length > 0 ? `
            <h4>📝 建議改進：</h4>
            <ul>
              ${evaluation.corrections.map(c => `<li>${c}</li>`).join('')}
            </ul>
          ` : ''}
          
          ${evaluation.suggestions.length > 0 ? `
            <h4>💡 進一步建議：</h4>
            <ul>
              ${evaluation.suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
        
        <div class="next-actions">
          <button class="try-again-btn" id="tryAgain">
            再試一次 (Try Again)
          </button>
          <button class="next-practice-btn" id="nextPractice">
            下一個練習 (Next)
          </button>
        </div>
      </div>
    `;

    feedbackSection.style.display = 'block';
    feedbackSection.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * 更新統計信息
   */
  async updateStats() {
    const stats = await this.manager.getPracticeStats();
    
    if (!stats) return;

    const statsDiv = document.getElementById('practiceStats');
    statsDiv.innerHTML = `
      <div class="stats-summary">
        <div class="stat-item">
          <span class="stat-label">總練習次數</span>
          <span class="stat-value">${stats.totalPractices}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平均得分</span>
          <span class="stat-value">${stats.averageScore}分</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最常練習</span>
          <span class="stat-value">${this.getMostPracticedType(stats.practicesByType)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 事件監聽器
   */
  attachEventListeners() {
    // 關閉按鈕
    document.getElementById('closePractice')?.addEventListener('click', () => {
      this.container.style.display = 'none';
    });

    // 標籤切換
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const selectedSentence = document.getElementById('sentenceSelect').selectedOptions[0];
        if (selectedSentence && selectedSentence.value) {
          const sentenceData = JSON.parse(selectedSentence.dataset.sentence);
          this.startPractice(sentenceData, e.target.dataset.type);
        }
      });
    });

    // 句子選擇
    document.getElementById('sentenceSelect')?.addEventListener('change', (e) => {
      if (e.target.value) {
        const sentenceData = JSON.parse(e.target.selectedOptions[0].dataset.sentence);
        const activeType = document.querySelector('.tab-btn.active').dataset.type;
        this.startPractice(sentenceData, activeType);
      }
    });

    // 刷新句子
    document.getElementById('refreshSentences')?.addEventListener('click', () => {
      this.loadSavedSentences();
    });
  }

  /**
   * 練習相關的事件監聽
   */
  attachPracticeListeners() {
    // 提交答案
    document.getElementById('submitAnswer')?.addEventListener('click', () => {
      this.submitAnswer();
    });

    // 顯示範例
    document.getElementById('showExamples')?.addEventListener('click', () => {
      this.showExamples();
    });

    // 獲取提示
    document.getElementById('getHint')?.addEventListener('click', () => {
      this.showNextHint();
    });

    // 再試一次
    document.getElementById('tryAgain')?.addEventListener('click', () => {
      document.getElementById('userSentence').value = '';
      document.getElementById('feedbackSection').style.display = 'none';
      document.getElementById('userSentence').focus();
    });

    // 下一個練習
    document.getElementById('nextPractice')?.addEventListener('click', () => {
      this.nextRandomPractice();
    });
  }

  /**
   * 應用樣式
   */
  applyStyles() {
    if (document.getElementById('imitationPracticeStyles')) return;

    const style = document.createElement('style');
    style.id = 'imitationPracticeStyles';
    style.textContent = `
      .imitation-practice-container {
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        max-width: 800px;
        margin: 0 auto;
      }

      .practice-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .practice-header h2 {
        margin: 0;
        color: #333;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
      }

      .practice-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }

      .tab-btn {
        padding: 10px 20px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.3s;
      }

      .tab-btn:hover {
        background: #f0f0f0;
      }

      .tab-btn.active {
        background: #4CAF50;
        color: white;
        border-color: #4CAF50;
      }

      .sentence-selector {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 20px;
      }

      .sentence-dropdown {
        flex: 1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
      }

      .refresh-btn {
        padding: 8px 12px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .practice-area {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .original-sentence {
        margin-bottom: 20px;
        padding: 15px;
        background: #e3f2fd;
        border-radius: 4px;
      }

      .sentence-display {
        font-size: 18px;
        font-weight: 500;
        margin: 10px 0;
      }

      .translation {
        color: #666;
        font-style: italic;
      }

      .pattern-info {
        margin-bottom: 20px;
        padding: 15px;
        background: #fff3e0;
        border-radius: 4px;
      }

      .pattern-template {
        font-family: monospace;
        font-size: 16px;
        color: #e65100;
      }

      .user-input-section {
        margin-top: 20px;
      }

      .user-input {
        width: 100%;
        padding: 10px;
        border: 2px solid #ddd;
        border-radius: 4px;
        font-size: 16px;
        resize: vertical;
      }

      .user-input:focus {
        border-color: #4CAF50;
        outline: none;
      }

      .action-buttons {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }

      .submit-btn {
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      }

      .example-btn, .hint-btn {
        background: #2196F3;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .feedback-section {
        margin-top: 20px;
        padding: 20px;
        background: #f5f5f5;
        border-radius: 8px;
      }

      .score-display {
        font-size: 48px;
        font-weight: bold;
        text-align: center;
        margin: 20px 0;
      }

      .high-score { color: #4CAF50; }
      .medium-score { color: #ff9800; }
      .low-score { color: #f44336; }

      .suggestion-chip {
        display: inline-block;
        padding: 4px 12px;
        background: #e0e0e0;
        border-radius: 16px;
        margin: 2px;
        font-size: 14px;
      }

      .highlight-blank {
        background: #ffeb3b;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: bold;
      }

      .stats-summary {
        display: flex;
        justify-content: space-around;
        margin-top: 20px;
        padding: 15px;
        background: #e8f5e9;
        border-radius: 8px;
      }

      .stat-item {
        text-align: center;
      }

      .stat-label {
        display: block;
        font-size: 14px;
        color: #666;
      }

      .stat-value {
        display: block;
        font-size: 24px;
        font-weight: bold;
        color: #2e7d32;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 輔助方法
   */
  showError(message) {
    // 顯示錯誤提示
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
  }

  showLoading() {
    const submitBtn = document.getElementById('submitAnswer');
    submitBtn.textContent = '評估中...';
    submitBtn.disabled = true;
  }

  getMostPracticedType(practicesByType) {
    const types = {
      substitution: '替換練習',
      expansion: '擴展練習',
      transformation: '轉換練習',
      contextual: '情境練習'
    };

    let maxCount = 0;
    let mostPracticed = '無';

    for (const [type, count] of Object.entries(practicesByType)) {
      if (count > maxCount) {
        maxCount = count;
        mostPracticed = types[type] || type;
      }
    }

    return mostPracticed;
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImitationPracticeUI;
}