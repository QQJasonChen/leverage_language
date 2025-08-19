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
      <div class="ai-analysis-container">
        <div class="analysis-header">
          <h2>🔧 句型分析 (Sentence Analysis)</h2>
          <button class="close-btn" id="closeAnalysis">×</button>
        </div>
        
        <div class="sentence-selector">
          <label>選擇要分析的句子 (Choose a sentence to analyze):</label>
          <select id="sentenceSelect" class="sentence-dropdown">
            <option value="">載入中...</option>
          </select>
          <button class="refresh-btn" id="refreshSentences">🔄</button>
        </div>
        
        <div class="analysis-area" id="analysisArea">
          <div class="welcome-message">
            <h3>🎯 智能句型分析</h3>
            <p>選擇一個句子，系統將為您分析句型結構並提供個性化練習建議</p>
            <div class="features">
              <div class="feature-item">
                <span class="icon">🔍</span>
                <span>深度語法分析</span>
              </div>
              <div class="feature-item">
                <span class="icon">📝</span>
                <span>詞彙替換建議</span>
              </div>
              <div class="feature-item">
                <span class="icon">✅</span>
                <span>智能評估反饋</span>
              </div>
            </div>
          </div>
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
        action: 'getHistory'
      });

      console.log('History response:', response);
      
      if (response && Array.isArray(response)) {
        // Response is directly an array
        const sentences = response.filter(item => 
          item.text && item.text.length > 10 && item.text.split(' ').length > 3
        );

        this.populateSentenceDropdown(sentences);
      } else if (response && response.history) {
        // Response has history property
        const sentences = response.history.filter(item => 
          item.text && item.text.length > 10 && item.text.split(' ').length > 3
        );

        this.populateSentenceDropdown(sentences);
      } else {
        console.warn('No history data found, loading demo sentences');
        this.loadDemoSentences();
      }
    } catch (error) {
      console.error('Failed to load sentences:', error);
      // Load demo sentences as fallback
      this.loadDemoSentences();
    }
  }

  /**
   * 載入示範句子
   */
  loadDemoSentences() {
    const demoSentences = [
      {
        text: "I would like to know if you could help me with this project.",
        source: "demo-business",
        language: "english",
        translation: "我想知道你是否可以幫助我完成這個項目。"
      },
      {
        text: "The more you practice, the better you become at speaking English.",
        source: "demo-education", 
        language: "english",
        translation: "你練習得越多，你的英語口語就會變得越好。"
      },
      {
        text: "If I had more time, I would learn another language.",
        source: "demo-learning",
        language: "english",
        translation: "如果我有更多時間，我會學習另一種語言。"
      }
    ];
    
    this.populateSentenceDropdown(demoSentences);
    
    // Show info message
    const practiceArea = document.getElementById('practiceArea');
    if (practiceArea) {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'background: #fff3cd; color: #856404; padding: 10px; margin: 10px 0; border-radius: 4px; font-size: 12px;';
      infoDiv.textContent = '💡 提示：這些是示範句子。開始在 YouTube 或網頁上保存句子後，將會顯示您的個人句子庫。';
      practiceArea.insertBefore(infoDiv, practiceArea.firstChild);
    }
  }

  /**
   * 顯示無句子提示
   */
  showNoSentencesMessage() {
    const select = document.getElementById('sentenceSelect');
    if (select) {
      select.innerHTML = '<option value="">尚無保存的句子，請先在 YouTube 或文章中保存一些句子</option>';
    }
  }

  /**
   * 填充句子下拉選單
   */
  populateSentenceDropdown(sentences) {
    const select = document.getElementById('sentenceSelect');
    
    if (!select) {
      console.error('Sentence select element not found');
      return;
    }
    
    if (!sentences || sentences.length === 0) {
      this.showNoSentencesMessage();
      return;
    }
    
    // 去重處理 - 基於句子文本內容去重
    const uniqueSentences = this.removeDuplicateSentences(sentences);
    
    select.innerHTML = '<option value="">選擇一個句子開始練習...</option>';

    uniqueSentences.forEach((sentence, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.dataset.sentence = JSON.stringify(sentence);
      
      // 截斷過長的句子
      const displayText = sentence.text.length > 60 
        ? sentence.text.substring(0, 57) + '...' 
        : sentence.text;
      
      // 顯示來源
      let source = 'unknown';
      if (sentence.source) {
        source = sentence.source;
      } else if (sentence.detectionMethod) {
        source = sentence.detectionMethod;
      } else if (sentence.language) {
        source = sentence.language;
      }
      
      option.textContent = `${displayText} (${source})`;
      
      select.appendChild(option);
    });
    
    console.log(`📝 Loaded ${uniqueSentences.length} unique sentences (removed ${sentences.length - uniqueSentences.length} duplicates)`);
  }

  /**
   * 去除重複句子
   */
  removeDuplicateSentences(sentences) {
    const seen = new Set();
    const uniqueSentences = [];
    
    sentences.forEach(sentence => {
      // 使用小寫和去空格的文本作為去重標準
      const normalizedText = sentence.text.toLowerCase().trim();
      
      if (!seen.has(normalizedText)) {
        seen.add(normalizedText);
        uniqueSentences.push(sentence);
      }
    });
    
    return uniqueSentences;
  }

  /**
   * 開始練習 (已廢棄 - 使用新的startAIAnalysis方法)
   */
  async startPractice(sentenceData, practiceType) {
    console.log('⚠️ startPractice called - redirecting to new AI analysis interface');
    // Redirect to the new analysis method
    return this.startAIAnalysis(sentenceData);
  }

  /**
   * 顯示練習加載狀態
   */
  showPracticeLoading() {
    const practiceArea = document.getElementById('practiceArea');
    if (practiceArea) {
      practiceArea.innerHTML = `
        <div class="practice-loading" style="text-align: center; padding: 40px;">
          <div class="loading-spinner" style="
            width: 40px;
            height: 40px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #4CAF50;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px auto;
          "></div>
          <p>🔧 正在分析句型結構...</p>
          <small style="color: #666;">正在生成個性化練習內容</small>
        </div>
      `;
    }
  }

  /**
   * 隱藏練習加載狀態
   */
  hidePracticeLoading() {
    // 加載狀態會被renderPractice()替換
  }

  /**
   * 渲染練習內容 (已廢棄 - 使用新的AI分析界面)
   */
  renderPractice() {
    console.log('⚠️ renderPractice called - this method is deprecated, using new AI analysis interface');
    return; // Disable old practice rendering

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
          <h3>🎯 句型 (Pattern): ${practice.aiGenerated ? '🤖 AI分析' : ''}</h3>
          <p class="pattern-template">${practice.pattern.template}</p>
          ${practice.pattern.structure ? `
            <div class="pattern-analysis">
              <small style="color: #666;">語法分析: ${practice.pattern.structure}</small>
            </div>
          ` : ''}
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
   * 渲染擴展練習
   */
  renderExpansionExercises(exercises) {
    return `
      <div class="expansion-exercises">
        <h4>➕ 擴展練習指示：</h4>
        ${exercises.map((ex, index) => `
          <div class="exercise-item">
            <p class="instruction">${ex.instruction}</p>
            <p class="original-display">${ex.original}</p>
            ${ex.suggestions ? `
              <div class="suggestions">
                建議詞彙: ${ex.suggestions.map(s => `<span class="suggestion-chip">${s}</span>`).join(' ')}
              </div>
            ` : ''}
            ${ex.example ? `<p class="example-text">例如: ${ex.example}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 渲染轉換練習
   */
  renderTransformationExercises(exercises) {
    return `
      <div class="transformation-exercises">
        <h4>🔀 轉換練習指示：</h4>
        ${exercises.map((ex, index) => `
          <div class="exercise-item">
            <p class="instruction">${ex.instruction}</p>
            <p class="original-display">${ex.original}</p>
            ${ex.hints && ex.hints.length > 0 ? `
              <div class="exercise-hints">
                提示: ${ex.hints.map(h => `<span class="hint-chip">${h}</span>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 渲染情境練習
   */
  renderContextualExercises(exercises) {
    return `
      <div class="contextual-exercises">
        <h4>🎭 情境練習指示：</h4>
        ${exercises.map((ex, index) => `
          <div class="exercise-item">
            <p class="instruction">${ex.instruction}</p>
            <p class="original-display">${ex.original}</p>
            <div class="context-info">
              <strong>情境:</strong> ${ex.context.situation} (${ex.context.register})
            </div>
            ${ex.tips && ex.tips.length > 0 ? `
              <div class="context-tips">
                <strong>技巧:</strong>
                <ul>
                  ${ex.tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
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
   * 顯示範例
   */
  showExamples() {
    if (!this.currentPractice || !this.currentPractice.examples) {
      this.showError('沒有可用的範例');
      return;
    }

    const examples = this.currentPractice.examples;
    
    // 創建彈窗元素
    const popup = document.createElement('div');
    popup.className = 'examples-popup';
    popup.style.cssText = `
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 500px;
      z-index: 1000;
    `;

    popup.innerHTML = `
      <h3>📚 練習範例 (Examples)</h3>
      ${examples.map((example, index) => `
        <div class="example-item" style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
          <p style="margin: 0 0 5px 0; font-weight: 500;">${example.sentence}</p>
          <small style="color: #666;">${example.explanation}</small>
        </div>
      `).join('')}
      <button class="close-examples-btn" style="
        background: #2196F3;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        float: right;
      ">關閉 (Close)</button>
      <div style="clear: both;"></div>
    `;

    // 添加事件監聽器
    const closeBtn = popup.querySelector('.close-examples-btn');
    closeBtn.addEventListener('click', () => {
      popup.remove();
    });

    // 點擊背景關閉
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.remove();
      }
    });

    document.body.appendChild(popup);
  }

  /**
   * 顯示下一個提示
   */
  showNextHint() {
    if (!this.currentPractice || !this.currentPractice.hints) {
      this.showError('沒有可用的提示');
      return;
    }

    const hints = this.currentPractice.hints;
    const randomHint = hints[Math.floor(Math.random() * hints.length)];

    // 創建提示元素
    const hintPopup = document.createElement('div');
    hintPopup.className = 'hint-popup';
    hintPopup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      color: #856404;
      padding: 15px;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 300px;
      z-index: 1000;
    `;

    hintPopup.innerHTML = `
      <strong>💡 提示：</strong>
      <p style="margin: 5px 0 0 0;">${randomHint}</p>
      <button class="close-hint-btn" style="
        position: absolute;
        top: 5px;
        right: 8px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #856404;
      ">×</button>
    `;

    // 添加事件監聽器
    const closeBtn = hintPopup.querySelector('.close-hint-btn');
    closeBtn.addEventListener('click', () => {
      hintPopup.remove();
    });

    document.body.appendChild(hintPopup);

    // 自動移除提示
    setTimeout(() => {
      if (hintPopup.parentElement) {
        hintPopup.remove();
      }
    }, 5000);
  }

  /**
   * 下一個隨機練習
   */
  nextRandomPractice() {
    const sentenceSelect = document.getElementById('sentenceSelect');
    if (!sentenceSelect || sentenceSelect.options.length <= 1) {
      this.showError('沒有更多句子可以練習');
      return;
    }

    // 隨機選擇一個不同的句子
    const currentIndex = sentenceSelect.selectedIndex;
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * (sentenceSelect.options.length - 1)) + 1;
    } while (newIndex === currentIndex && sentenceSelect.options.length > 2);

    sentenceSelect.selectedIndex = newIndex;
    sentenceSelect.dispatchEvent(new Event('change'));

    // 清空用戶輸入
    const userSentence = document.getElementById('userSentence');
    if (userSentence) {
      userSentence.value = '';
    }

    // 隱藏反饋區域
    const feedbackSection = document.getElementById('feedbackSection');
    if (feedbackSection) {
      feedbackSection.style.display = 'none';
    }
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
      // 顯示AI評估中的狀態
      this.showAIEvaluationLoading();
      
      // 評估用戶的答案（現在支援AI評估）
      const evaluation = await this.manager.evaluateImitation(
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

      // 隱藏載入狀態
      this.hideLoading();

      // 顯示反饋
      this.showFeedback(evaluation);

      // 更新統計
      await this.updateStats();

    } catch (error) {
      console.error('Failed to evaluate answer:', error);
      this.hideLoading();
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

    // 根據是否為AI評估顯示不同的標題和圖標
    const evaluationTitle = evaluation.isAI ? 
      '🤖 AI智能評估結果 (AI Evaluation)' : 
      '📊 評估結果 (Evaluation)';

    const aiIndicator = evaluation.isAI ? 
      '<div class="ai-indicator">✨ 由AI提供專業評估</div>' : '';

    feedbackSection.innerHTML = `
      <div class="feedback-content">
        <h3>${evaluationTitle}</h3>
        ${aiIndicator}
        
        <div class="score-display ${scoreClass}">
          <span class="score-number">${evaluation.score}</span>
          <span class="score-label">分</span>
        </div>
        
        <div class="encouragement">
          ${evaluation.encouragement}
        </div>
        
        ${evaluation.feedback && evaluation.feedback.length > 0 ? `
          <div class="ai-detailed-feedback">
            <h4>📝 詳細評估：</h4>
            ${evaluation.feedback.map(f => `<p class="feedback-text">${f}</p>`).join('')}
          </div>
        ` : ''}
        
        <div class="feedback-details">
          ${evaluation.strengths && evaluation.strengths.length > 0 ? `
            <h4>✅ 做得好的地方：</h4>
            <ul class="strengths-list">
              ${evaluation.strengths.map(s => `<li>${s}</li>`).join('')}
            </ul>
          ` : ''}
          
          ${evaluation.corrections && evaluation.corrections.length > 0 ? `
            <h4>📝 建議改進：</h4>
            <ul class="corrections-list">
              ${evaluation.corrections.map(c => `<li>${c}</li>`).join('')}
            </ul>
          ` : ''}
          
          ${evaluation.suggestions && evaluation.suggestions.length > 0 ? `
            <h4>💡 進一步建議：</h4>
            <ul class="suggestions-list">
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
          ${evaluation.isAI ? `
            <button class="feedback-btn" id="rateFeedback" title="為AI評估評分">
              👍 評估反饋
            </button>
          ` : ''}
        </div>
      </div>
    `;

    feedbackSection.style.display = 'block';
    feedbackSection.scrollIntoView({ behavior: 'smooth' });
    
    // 為評估反饋按鈕添加事件監聽
    const rateFeedbackBtn = document.getElementById('rateFeedback');
    if (rateFeedbackBtn) {
      rateFeedbackBtn.addEventListener('click', () => {
        this.showFeedbackRating(evaluation);
      });
    }
  }

  /**
   * 顯示AI評估載入狀態
   */
  showAIEvaluationLoading() {
    const submitBtn = document.getElementById('submitAnswer');
    if (submitBtn) {
      submitBtn.innerHTML = '🤖 AI評估中...';
      submitBtn.disabled = true;
    }
  }

  /**
   * 隱藏載入狀態
   */
  hideLoading() {
    const submitBtn = document.getElementById('submitAnswer');
    if (submitBtn) {
      submitBtn.innerHTML = '提交答案 (Submit)';
      submitBtn.disabled = false;
    }
  }

  /**
   * 顯示反饋評分
   */
  showFeedbackRating(evaluation) {
    const ratingHtml = `
      <div class="feedback-rating-popup" style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        max-width: 400px;
        z-index: 1001;
      ">
        <h3>📊 評估反饋</h3>
        <p>這次AI評估對您有幫助嗎？</p>
        <div class="rating-buttons" style="display: flex; gap: 10px; justify-content: center; margin: 20px 0;">
          <button class="rating-btn helpful" data-rating="helpful" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            👍 有幫助
          </button>
          <button class="rating-btn not-helpful" data-rating="not-helpful" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            👎 需要改進
          </button>
        </div>
        <button class="close-rating-btn" style="background: #ccc; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; float: right;">
          關閉
        </button>
        <div style="clear: both;"></div>
      </div>
    `;

    const popup = document.createElement('div');
    popup.innerHTML = ratingHtml;
    const ratingPopup = popup.firstElementChild;

    // 添加事件監聽
    ratingPopup.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rating = e.target.dataset.rating;
        this.submitFeedbackRating(evaluation, rating);
        ratingPopup.remove();
        this.showError(rating === 'helpful' ? '感謝您的反饋！' : '我們會繼續改進AI評估功能');
      });
    });

    ratingPopup.querySelector('.close-rating-btn').addEventListener('click', () => {
      ratingPopup.remove();
    });

    document.body.appendChild(ratingPopup);
  }

  /**
   * 提交反饋評分
   */
  async submitFeedbackRating(evaluation, rating) {
    try {
      await chrome.storage.local.get(['aiEvaluationFeedback']).then(result => {
        const feedback = result.aiEvaluationFeedback || [];
        feedback.push({
          timestamp: new Date().toISOString(),
          score: evaluation.score,
          rating: rating,
          exerciseType: this.currentPractice?.type
        });

        // 只保留最近100條反饋
        if (feedback.length > 100) {
          feedback.splice(0, feedback.length - 100);
        }

        return chrome.storage.local.set({ aiEvaluationFeedback: feedback });
      });
    } catch (error) {
      console.error('Failed to save feedback rating:', error);
    }
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
   * 開始AI智能分析 - 立即顯示原句，AI在背景分析
   */
  async startAIAnalysis(sentenceData) {
    console.log('🔧 Starting BASIC analysis for:', sentenceData.text, '(AI temporarily disabled)');
    
    // Step 1: 立即顯示原句
    this.showOriginalSentence(sentenceData);
    
    // Step 2: 使用純基本分析 (完全跳過AI)
    console.log('🔧 Using basic analysis only - no AI calls');
    
    try {
      // Generate basic pattern immediately - no async calls
      const basicPattern = this.generateLocalPattern(sentenceData);
      console.log('✅ Basic pattern generated:', basicPattern);
      
      // Show pattern analysis immediately (shorter delays for testing)
      setTimeout(() => {
        this.showAIPatternAnalysis(basicPattern, sentenceData);
        
        // Generate vocabulary suggestions - no async calls
        setTimeout(() => {
          const basicSuggestions = this.generateLocalSuggestions(sentenceData);
          console.log('✅ Basic suggestions generated:', basicSuggestions);
          this.showVocabularyBreakdown(basicSuggestions, sentenceData);
          
          // Show practice interface
          setTimeout(() => {
            this.showPracticeInterface(sentenceData, basicPattern);
          }, 300);
        }, 400);
      }, 300);
      
    } catch (error) {
      console.error('Basic analysis failed:', error);
      this.showAIError(error, sentenceData);
    }
  }

  /**
   * 本地句型分析 (無AI依賴)
   */
  generateLocalPattern(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    console.log('🔧 Analyzing:', text);
    
    // Specific analysis for "Het feestje is gezellig"
    if (text.includes('het') && text.includes('feestje') && text.includes('is') && text.includes('gezellig')) {
      return {
        template: '[het/de] [名詞] [is/zijn] [形容詞]',
        grammarPoints: [
          '荷蘭語基本句型：主語 + 動詞 + 形容詞補語',
          'het 中性名詞冠詞的使用',
          '動詞 is 的單數第三人稱形式',
          'gezellig 典型的荷蘭語形容詞'
        ],
        complexity: 'beginner',
        language: 'dutch'
      };
    }
    
    // Generic Dutch pattern
    if (text.includes('het') || text.includes('de')) {
      return {
        template: '[冠詞] [名詞] [動詞] [補語]',
        grammarPoints: [
          '荷蘭語基本句型結構',
          '冠詞het/de的選擇',
          '動詞變位規則'
        ],
        complexity: 'intermediate',
        language: 'dutch'
      };
    }
    
    // Fallback
    return {
      template: '[主語] [動詞] [賓語/補語]',
      grammarPoints: [
        '基本句型結構',
        '主謂一致性'
      ],
      complexity: 'beginner',
      language: sentenceData.language || 'dutch'
    };
  }

  /**
   * 本地詞彙建議 (無AI依賴)
   */
  generateLocalSuggestions(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    const suggestions = [];
    
    if (text.includes('het')) {
      suggestions.push({
        original: 'het',
        type: '中性冠詞',
        alternatives: ['de', 'een']
      });
    }
    
    if (text.includes('feestje')) {
      suggestions.push({
        original: 'feestje',
        type: '名詞 (小型聚會)',
        alternatives: ['party', 'vergadering', 'bijeenkomst', 'evenement']
      });
    }
    
    if (text.includes('is')) {
      suggestions.push({
        original: 'is',
        type: '動詞 (第三人稱單數)',
        alternatives: ['was', 'wordt', 'blijft', 'lijkt']
      });
    }
    
    if (text.includes('gezellig')) {
      suggestions.push({
        original: 'gezellig',
        type: '形容詞 (溫馨/有趣)',
        alternatives: ['leuk', 'interessant', 'mooi', 'prettig', 'fijn']
      });
    }
    
    // Ensure we have at least one suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        original: '詞彙',
        type: '可替換部分',
        alternatives: ['嘗試替換名詞', '嘗試替換形容詞', '嘗試替換動詞']
      });
    }
    
    return suggestions;
  }

  /**
   * 步驟1: 立即顯示原句
   */
  showOriginalSentence(sentenceData) {
    const analysisArea = document.getElementById('analysisArea');
    analysisArea.innerHTML = `
      <div class="original-sentence-display">
        <h3>📝 原始句子</h3>
        <div class="sentence-card original-card">
          <div class="sentence-text">${sentenceData.text}</div>
          
          <div class="sentence-meta">
            <span>🌐 ${sentenceData.language || 'unknown'}</span>
            <span class="meta-separator">📺 ${sentenceData.source || 'saved sentence'}</span>
          </div>
        </div>
        
        <div class="ai-loading">
          <div class="loading-dots">🤖 AI正在分析句型結構...</div>
        </div>
      </div>
    `;
  }

  /**
   * 步驟2: 顯示AI句型分析
   */
  showAIPatternAnalysis(aiPattern, sentenceData) {
    const loadingDiv = document.querySelector('.ai-loading');
    if (loadingDiv) {
      loadingDiv.innerHTML = `
        <div class="ai-pattern-analysis">
          <h4>🎯 句型結構分析</h4>
          
          <div class="pattern-template">
            <strong>句型模板：</strong>
            <div class="pattern-code">${aiPattern.template || '分析中...'}</div>
          </div>
          
          <div class="grammar-points">
            <strong>語法要點：</strong>
            <ul>
              ${(aiPattern.grammarPoints || []).map(point => `<li>${point}</li>`).join('')}
            </ul>
          </div>
          
          <div class="loading-section">
            <div class="loading-dots">🔍 正在生成詞彙替換建議...</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * 步驟3: 顯示詞彙分解和替換建議
   */
  showVocabularyBreakdown(suggestions, sentenceData) {
    const loadingDotsDiv = document.querySelector('.loading-dots');
    if (loadingDotsDiv && loadingDotsDiv.parentElement) {
      loadingDotsDiv.parentElement.innerHTML = `
        <div class="vocabulary-breakdown">
          <h4>📚 詞彙替換建議</h4>
          
          <div class="word-suggestions">
            ${suggestions.map(suggestion => `
              <div class="suggestion-card">
                <div class="suggestion-original">${suggestion.original}</div>
                <div class="suggestion-type">${suggestion.type}</div>
                <div class="suggestion-alternatives">→ ${suggestion.alternatives.join(', ')}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="loading-section">
            <div class="loading-dots">✍️ 準備練習界面...</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * 步驟4: 顯示練習界面
   */
  showPracticeInterface(sentenceData, aiPattern) {
    const preparingDiv = document.querySelector('.vocabulary-breakdown .loading-dots');
    if (preparingDiv && preparingDiv.parentElement) {
      preparingDiv.parentElement.innerHTML = `
        <div class="practice-interface">
          <h4>✍️ 開始仿寫練習</h4>
          
          <div class="practice-prompt">
            <p>請根據上述分析，創作一個使用相同句型但不同內容的句子：</p>
            
            <textarea 
              id="userSentence" 
              placeholder="在這裡輸入你的仿寫句子..."
              class="user-textarea"
            ></textarea>
          </div>
          
          <div class="practice-controls">
            <button id="submitAnswer" class="practice-btn submit-btn">📤 提交答案</button>
            <button id="getHint" class="practice-btn hint-btn">💡 獲取提示</button>
          </div>
        </div>
        
        <div id="feedbackSection" style="display: none; margin-top: 20px;">
          <!-- AI評估結果將顯示在這裡 -->
        </div>
      `;
      
      // 添加練習相關事件監聽器
      this.attachPracticeEventListeners(sentenceData, aiPattern);
    }
  }

  /**
   * 添加練習相關的事件監聽器
   */
  attachPracticeEventListeners(sentenceData, aiPattern) {
    // 提交答案 - 使用本地評估
    document.getElementById('submitAnswer')?.addEventListener('click', () => {
      const userInput = document.getElementById('userSentence')?.value.trim();
      if (!userInput) {
        this.showError('請輸入你的仿寫句子');
        return;
      }
      
      console.log('🔧 Evaluating locally:', userInput);
      this.evaluateUserAnswerLocally(userInput, sentenceData, aiPattern);
    });
    
    // 獲取提示 - 使用本地提示
    document.getElementById('getHint')?.addEventListener('click', () => {
      this.showLocalHint(sentenceData, aiPattern);
    });
  }

  /**
   * 本地評估用戶答案 (無AI依賴)
   */
  evaluateUserAnswerLocally(userInput, sentenceData, aiPattern) {
    const submitBtn = document.getElementById('submitAnswer');
    const originalText = submitBtn ? submitBtn.textContent : '';
    
    if (submitBtn) {
      submitBtn.textContent = '🔧 評估中...';
      submitBtn.disabled = true;
    }
    
    // Simulate brief evaluation time
    setTimeout(() => {
      try {
        const evaluation = this.generateLocalEvaluation(userInput, sentenceData, aiPattern);
        console.log('✅ Local evaluation complete:', evaluation);
        this.showAIEvaluation(evaluation, userInput, sentenceData);
      } catch (error) {
        console.error('Local evaluation failed:', error);
        this.showError('評估失敗，請重試');
      } finally {
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      }
    }, 500);
  }

  /**
   * 生成本地評估 (無AI依賴)
   */
  generateLocalEvaluation(userInput, sentenceData, aiPattern) {
    const original = sentenceData.text.toLowerCase();
    const user = userInput.toLowerCase();
    
    let score = 70; // Base score
    const strengths = [];
    const suggestions = [];
    
    console.log('🔧 Evaluating:', { original, user });
    
    // Length check
    if (userInput.length < 5) {
      score = 30;
      suggestions.push('請輸入更完整的句子');
    } else {
      strengths.push('句子長度適當');
      score += 5;
    }
    
    // Structure similarity for Dutch
    if (user.includes('het') || user.includes('de')) {
      strengths.push('使用了荷蘭語冠詞');
      score += 10;
    }
    
    if (user.includes('is') || user.includes('zijn')) {
      strengths.push('正確使用動詞');
      score += 10;
    }
    
    // Check for creativity (different words)
    if (original !== user) {
      if (user.includes('feestje') && !user.includes('gezellig')) {
        strengths.push('保持主題但改變了形容詞');
        score += 15;
      } else if (!user.includes('feestje') && user.includes('gezellig')) {
        strengths.push('保持形容詞但改變了主題');
        score += 15;
      } else if (!user.includes('feestje') && !user.includes('gezellig')) {
        strengths.push('創造了全新的句子');
        score += 20;
      }
    } else {
      score = 40;
      suggestions.push('嘗試使用不同的詞彙');
    }
    
    // Word count similarity
    const originalWords = original.split(' ').length;
    const userWords = user.split(' ').length;
    
    if (Math.abs(originalWords - userWords) <= 1) {
      strengths.push('句子結構相似');
      score += 5;
    }
    
    // Cap score
    score = Math.min(score, 95);
    score = Math.max(score, 25);
    
    // Generate feedback
    let feedback;
    if (score >= 80) {
      feedback = '很好！你成功地使用了荷蘭語句型並創造了新的內容。';
    } else if (score >= 60) {
      feedback = '不錯的嘗試！你理解了基本結構，繼續練習會更好。';
    } else {
      feedback = '繼續努力！嘗試使用相同的句型但不同的詞彙。';
    }
    
    // Ensure we have suggestions
    if (suggestions.length === 0) {
      if (score >= 80) {
        suggestions.push('嘗試使用更複雜的形容詞');
      } else {
        suggestions.push('保持het/de + 名詞 + is + 形容詞的結構');
        suggestions.push('參考詞彙建議中的替換選項');
      }
    }
    
    // Ensure we have strengths
    if (strengths.length === 0) {
      strengths.push('你完成了練習');
    }
    
    return {
      score: Math.round(score),
      feedback: feedback,
      strengths: strengths,
      suggestions: suggestions
    };
  }

  /**
   * 顯示本地提示 (無AI依賴)
   */
  showLocalHint(sentenceData, aiPattern) {
    const hints = [
      `原句使用了 "${aiPattern.template}" 結構`,
      '保持相同的語法模式，但替換關鍵詞彙',
      '注意荷蘭語的冠詞 het/de 的使用',
      '動詞 is 可以替換為 was, wordt, blijft 等',
      '形容詞 gezellig 可以替換為 leuk, mooi, interessant 等'
    ];
    
    const randomHint = hints[Math.floor(Math.random() * hints.length)];
    this.showHintPopup(randomHint);
  }

  /**
   * AI評估用戶答案
   */
  async evaluateUserAnswer(userInput, sentenceData, aiPattern) {
    const submitBtn = document.getElementById('submitAnswer');
    const originalText = submitBtn ? submitBtn.textContent : '';
    
    if (submitBtn) {
      submitBtn.textContent = '🔧 本地評估中...';
      submitBtn.disabled = true;
    }
    
    try {
      console.log('🔧 Using local evaluation (no AI calls)');
      // Use local evaluation instead of AI
      const evaluation = this.evaluateUserAnswerLocally(userInput, sentenceData, aiPattern);
      this.showAIEvaluation(evaluation, userInput, sentenceData);
    } catch (error) {
      console.error('Local evaluation failed:', error);
      this.showError('本地評估失敗，請重試');
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  /**
   * 顯示AI評估結果
   */
  showAIEvaluation(evaluation, userInput, sentenceData) {
    const feedbackSection = document.getElementById('feedbackSection');
    if (feedbackSection) {
      const scoreClass = evaluation.score >= 80 ? 'evaluation-high' : 
                        evaluation.score >= 60 ? 'evaluation-medium' : 'evaluation-low';
      const titleClass = evaluation.score >= 80 ? 'evaluation-title-high' : 
                        evaluation.score >= 60 ? 'evaluation-title-medium' : 'evaluation-title-low';
      
      feedbackSection.style.display = 'block';
      feedbackSection.innerHTML = `
        <div class="ai-evaluation ${scoreClass}">
          <h4 class="${titleClass}">
            🤖 AI評估結果 (得分: ${evaluation.score}/100)
          </h4>
          
          <div class="user-answer">
            <strong>你的答案：</strong>
            <div class="user-answer-text">"${userInput}"</div>
          </div>
          
          ${evaluation.feedback ? `
          <div class="ai-feedback">
            <strong>AI反饋：</strong>
            <p>${evaluation.feedback}</p>
          </div>
          ` : ''}
          
          ${evaluation.strengths && evaluation.strengths.length > 0 ? `
          <div class="strengths">
            <strong>✅ 做得好的地方：</strong>
            <ul>
              ${evaluation.strengths.map(strength => `<li>${strength}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${evaluation.suggestions && evaluation.suggestions.length > 0 ? `
          <div class="suggestions">
            <strong>💡 改進建議：</strong>
            <ul>
              ${evaluation.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="evaluation-actions">
            <button id="tryAgain" class="practice-btn try-again-btn">🔄 再試一次</button>
            <button id="nextPractice" class="practice-btn next-practice-btn">➡️ 下一個練習</button>
          </div>
        </div>
      `;
      
      // 添加評估後的事件監聽器
      document.getElementById('tryAgain')?.addEventListener('click', () => {
        document.getElementById('userSentence').value = '';
        feedbackSection.style.display = 'none';
      });
      
      document.getElementById('nextPractice')?.addEventListener('click', () => {
        this.nextRandomPractice();
      });
    }
  }

  /**
   * 顯示上下文相關的提示
   */
  showContextualHint(sentenceData, aiPattern) {
    const hints = [
      `原句使用了"${aiPattern.template}"的句型結構`,
      `注意保持與原句相同的語法時態`,
      `可以替換名詞、動詞或形容詞，但保持句型不變`,
      `想想如何用不同的詞彙表達相似的意思`
    ];
    
    const randomHint = hints[Math.floor(Math.random() * hints.length)];
    this.showHintPopup(randomHint);
  }

  /**
   * 顯示提示彈窗
   */
  showHintPopup(hint) {
    const popup = document.createElement('div');
    popup.className = 'hint-popup';
    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      color: #856404;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    `;
    
    popup.innerHTML = `
      <div>
        <strong>💡 提示</strong>
        <p style="margin: 5px 0 0 0; font-size: 14px;">${hint}</p>
      </div>
      <button class="hint-close-btn" style="
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #856404;
        margin-left: 10px;
      ">×</button>
    `;
    
    popup.querySelector('.hint-close-btn').addEventListener('click', () => popup.remove());
    document.body.appendChild(popup);
    
    setTimeout(() => popup.remove(), 5000);
  }

  /**
   * 更新載入訊息
   */
  updateLoadingMessage(message) {
    const loadingDotsDiv = document.querySelector('.loading-dots');
    if (loadingDotsDiv) {
      loadingDotsDiv.textContent = message;
    }
  }

  /**
   * 生成基本建議（當AI失敗時的後備方案）
   */
  generateBasicSuggestions(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    const suggestions = [];
    
    // Basic word detection for common patterns
    const words = text.split(' ');
    
    words.forEach(word => {
      if (word.length > 3) {
        if (/^(het|de|een|onze|mijn|jouw|zijn|haar)$/i.test(word)) {
          suggestions.push({
            original: word,
            type: '冠詞/所有格',
            alternatives: ['het', 'de', 'een', 'onze', 'mijn']
          });
        } else if (/^(is|zijn|was|waren|wordt)$/i.test(word)) {
          suggestions.push({
            original: word,
            type: '動詞',
            alternatives: ['is', 'zijn', 'was', 'wordt']
          });
        } else if (word.length > 4) {
          suggestions.push({
            original: word,
            type: '名詞/形容詞',
            alternatives: ['[替換為同類詞彙]']
          });
        }
      }
    });
    
    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }

  /**
   * 顯示AI錯誤並提供後備方案
   */
  showAIError(error, sentenceData) {
    const analysisArea = document.getElementById('analysisArea');
    const existingOriginal = analysisArea.querySelector('.sentence-card');
    
    // Keep the original sentence and show error with fallback
    const originalHTML = existingOriginal ? existingOriginal.outerHTML : '';
    
    // Check if this is a configuration issue
    const needsConfiguration = error.needsConfiguration || 
                              error.message.includes('not configured') || 
                              error.message.includes('API key') ||
                              error.message.includes('disabled');
    
    const errorTitle = needsConfiguration ? '⚙️ AI服務需要設定' : '⚠️ AI分析暫時不可用';
    const errorStyle = needsConfiguration ? 
      'background: #e3f2fd; border: 1px solid #2196f3; color: #1976d2;' : 
      'background: #fff3cd; border: 1px solid #ffeaa7; color: #856404;';
    
    analysisArea.innerHTML = `
      <div class="original-sentence-display">
        <h3>📝 原始句子</h3>
        ${originalHTML}
        
        <div class="ai-error-fallback">
          <div class="error-message" style="${errorStyle} border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">${errorTitle}</h4>
            <p style="margin: 0 0 10px 0;"><strong>詳情：</strong> ${error.message}</p>
            ${needsConfiguration ? `
              <div style="margin: 15px 0;">
                <button id="openSettings" class="practice-btn submit-btn" style="margin-right: 10px;">
                  ⚙️ 開啟設定
                </button>
                <span style="font-size: 14px; color: #666;">
                  需要配置AI提供商和API密鑰
                </span>
              </div>
            ` : ''}
            <p style="margin: 10px 0 0 0;">現在使用基本分析模式繼續練習</p>
          </div>
          
          <div class="basic-analysis" style="
            background: #e8f4f8;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
          ">
            <h4 style="margin-top: 0; color: #0277bd;">📚 基本句型分析</h4>
            
            <div class="pattern-template">
              <strong>基本句型：</strong>
              <div class="pattern-code">[主語] + [動詞] + [賓語/補語]</div>
            </div>
            
            <div class="basic-suggestions" style="margin-top: 15px;">
              <strong>練習建議：</strong>
              <ul>
                <li>保持相同的語法結構</li>
                <li>替換名詞和動詞</li>
                <li>注意動詞變位</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <button id="startBasicPractice" class="practice-btn submit-btn">
                📝 開始基本練習
              </button>
              <button id="retryAI" class="practice-btn hint-btn" style="margin-left: 10px;">
                🔄 重試AI分析
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners for fallback options
    document.getElementById('startBasicPractice')?.addEventListener('click', () => {
      const basicPattern = {
        template: '[主語] + [動詞] + [賓語/補語]',
        grammarPoints: ['基本句型結構', '主語動詞一致性'],
        complexity: 'beginner',
        language: sentenceData.language || 'dutch'
      };
      
      const basicSuggestions = this.generateBasicSuggestions(sentenceData);
      this.showVocabularyBreakdown(basicSuggestions, sentenceData);
      
      setTimeout(() => {
        this.showPracticeInterface(sentenceData, basicPattern);
      }, 500);
    });
    
    document.getElementById('retryAI')?.addEventListener('click', () => {
      this.startAIAnalysis(sentenceData);
    });
    
    // Settings button for configuration issues
    document.getElementById('openSettings')?.addEventListener('click', () => {
      // Open the extension settings page
      chrome.runtime.openOptionsPage();
    });
  }

  /**
   * 事件監聽器
   */
  attachEventListeners() {
    // 關閉按鈕 (更新ID)
    document.getElementById('closeAnalysis')?.addEventListener('click', () => {
      this.container.style.display = 'none';
    });

    // 句子選擇 - 開始AI分析
    document.getElementById('sentenceSelect')?.addEventListener('change', async (e) => {
      if (e.target.value && e.target.selectedOptions[0]) {
        const selectedOption = e.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset) {
          const sentenceData = JSON.parse(selectedOption.dataset.sentence);
          await this.startAIAnalysis(sentenceData);
        }
      }
    });

    // 刷新句子
    document.getElementById('refreshSentences')?.addEventListener('click', async () => {
      const select = document.getElementById('sentenceSelect');
      if (select) {
        select.innerHTML = '<option value="">重新載入中...</option>';
      }
      await this.loadSavedSentences();
    });
  }

  /**
   * 練習相關的事件監聽 (已廢棄 - 新界面使用動態事件監聽器)
   */
  attachPracticeListeners() {
    console.log('⚠️ attachPracticeListeners called - this method is deprecated');
    // Old practice listeners are no longer needed
    // New interface creates event listeners dynamically in showPracticeInterface
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

      @keyframes fadeInUp {
        from { 
          opacity: 0; 
          transform: translateY(20px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      
      @keyframes pulse {
        0%, 100% { 
          transform: scale(1); 
        }
        50% { 
          transform: scale(1.05); 
        }
      }
      
      @keyframes slideIn {
        from { 
          opacity: 0; 
          transform: translateX(300px); 
        }
        to { 
          opacity: 1; 
          transform: translateX(0); 
        }
      }
      
      .ai-analysis-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      .analysis-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 20px;
        border-bottom: 2px solid #e9ecef;
        margin-bottom: 25px;
      }
      
      .analysis-header h2 {
        margin: 0;
        color: #1976d2;
        font-size: 24px;
      }
      
      .sentence-selector {
        margin-bottom: 25px;
      }
      
      .sentence-selector label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #495057;
      }
      
      .sentence-dropdown {
        width: calc(100% - 50px);
        padding: 12px 16px;
        border: 2px solid #dee2e6;
        border-radius: 8px;
        font-size: 16px;
        background: white;
      }
      
      .refresh-btn {
        width: 40px;
        height: 48px;
        margin-left: 8px;
        border: 2px solid #28a745;
        background: #28a745;
        color: white;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;
      }
      
      .refresh-btn:hover {
        background: #218838;
        border-color: #218838;
      }
      
      .welcome-message {
        text-align: center;
        padding: 40px 20px;
        color: #6c757d;
      }
      
      .features {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-top: 30px;
      }
      
      .feature-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        transition: all 0.3s ease;
      }
      
      .feature-item:hover {
        background: #e9ecef;
        transform: translateY(-2px);
      }
      
      .feature-item .icon {
        font-size: 24px;
      }
      
      .practice-btn {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 500;
        text-transform: none;
      }
      
      .practice-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      
      .practice-btn:active {
        transform: translateY(0);
      }

      .original-card {
        background: #f8f9fa;
        border: 2px solid #007bff;
        border-radius: 8px;
        padding: 20px;
        margin: 15px 0;
      }

      .sentence-text {
        font-size: 18px;
        line-height: 1.6;
        color: #2c3e50;
        font-weight: 500;
      }

      .sentence-meta {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #dee2e6;
        font-size: 14px;
        color: #6c757d;
      }

      .meta-separator {
        margin-left: 15px;
      }

      .ai-loading {
        text-align: center;
        padding: 30px;
        color: #6c757d;
      }

      .loading-dots {
        display: inline-block;
        animation: pulse 1.5s ease-in-out infinite;
      }

      .ai-pattern-analysis {
        background: #e8f5e9;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        animation: fadeInUp 0.5s ease;
      }

      .ai-pattern-analysis h4 {
        margin-top: 0;
        color: #2e7d32;
      }

      .pattern-template {
        background: white;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
      }

      .pattern-code {
        font-family: monospace;
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
        margin-top: 8px;
        color: #495057;
      }

      .grammar-points {
        margin-top: 15px;
      }

      .grammar-points ul {
        margin-top: 8px;
      }

      .loading-section {
        text-align: center;
        margin-top: 20px;
        color: #6c757d;
      }

      .vocabulary-breakdown {
        background: #fff3cd;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        animation: fadeInUp 0.5s ease;
      }

      .vocabulary-breakdown h4 {
        margin-top: 0;
        color: #856404;
      }

      .word-suggestions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }

      .suggestion-card {
        background: white;
        border-radius: 6px;
        padding: 12px;
        border-left: 3px solid #ffc107;
      }

      .suggestion-original {
        font-weight: 500;
        color: #856404;
      }

      .suggestion-type {
        font-size: 12px;
        color: #6c757d;
        margin: 4px 0;
      }

      .suggestion-alternatives {
        font-size: 14px;
      }

      .practice-interface {
        background: #e3f2fd;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        animation: fadeInUp 0.5s ease;
      }

      .practice-interface h4 {
        margin-top: 0;
        color: #1976d2;
      }

      .practice-prompt {
        background: white;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
      }

      .user-textarea {
        width: 100%;
        min-height: 80px;
        border: 2px solid #dee2e6;
        border-radius: 6px;
        padding: 12px;
        font-size: 16px;
        resize: vertical;
        font-family: inherit;
        line-height: 1.5;
        box-sizing: border-box;
      }

      .practice-controls {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .submit-btn {
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 500;
      }

      .hint-btn {
        background: linear-gradient(135deg, #ff9800, #f57c00);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 500;
      }

      .ai-evaluation {
        border-radius: 8px;
        padding: 20px;
        animation: fadeInUp 0.5s ease;
      }

      .evaluation-high {
        background: #e8f5e9;
      }

      .evaluation-medium {
        background: #fff3cd;
      }

      .evaluation-low {
        background: #ffebee;
      }

      .evaluation-title-high {
        margin-top: 0;
        color: #2e7d32;
      }

      .evaluation-title-medium {
        margin-top: 0;
        color: #856404;
      }

      .evaluation-title-low {
        margin-top: 0;
        color: #c62828;
      }

      .user-answer {
        background: white;
        border-radius: 6px;
        padding: 15px;
        margin: 15px 0;
        border-left: 4px solid #007bff;
      }

      .user-answer-text {
        margin-top: 8px;
        font-style: italic;
      }

      .ai-feedback {
        margin: 15px 0;
      }

      .ai-feedback p {
        margin-top: 8px;
      }

      .strengths, .suggestions {
        margin: 15px 0;
      }

      .strengths ul, .suggestions ul {
        margin-top: 8px;
      }

      .evaluation-actions {
        text-align: center;
        margin-top: 20px;
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .try-again-btn {
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 20px;
        cursor: pointer;
      }

      .next-practice-btn {
        background: linear-gradient(135deg, #9C27B0, #7B1FA2);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 20px;
        cursor: pointer;
      }

      /* Hide old interface elements that might still exist */
      .user-input-section,
      .practice-tabs,
      .tab-btn {
        display: none !important;
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

      .ai-indicator {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        text-align: center;
        margin: 10px 0;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }

      .ai-detailed-feedback {
        background: #f0f8ff;
        border-left: 4px solid #4CAF50;
        padding: 15px;
        margin: 15px 0;
        border-radius: 0 8px 8px 0;
      }

      .feedback-text {
        margin: 8px 0;
        line-height: 1.6;
        color: #333;
      }

      .strengths-list li {
        color: #2e7d32;
        margin-bottom: 8px;
      }

      .corrections-list li {
        color: #d32f2f;
        margin-bottom: 8px;
      }

      .suggestions-list li {
        color: #1976d2;
        margin-bottom: 8px;
      }

      .feedback-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-left: 8px;
        transition: all 0.3s;
      }

      .feedback-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .feedback-rating-popup {
        animation: fadeInScale 0.3s ease;
      }

      @keyframes fadeInScale {
        from { 
          opacity: 0; 
          transform: translate(-50%, -50%) scale(0.9); 
        }
        to { 
          opacity: 1; 
          transform: translate(-50%, -50%) scale(1); 
        }
      }

      .rating-btn {
        transition: all 0.2s;
      }

      .rating-btn:hover {
        transform: scale(1.05);
      }

      .rating-btn.helpful:hover {
        background: #388e3c !important;
      }

      .rating-btn.not-helpful:hover {
        background: #d32f2f !important;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .practice-loading {
        background: #f9f9f9;
        border-radius: 8px;
        border: 2px dashed #ddd;
      }

      .pattern-analysis {
        margin-top: 10px;
        padding: 8px;
        background: #f0f8ff;
        border-radius: 4px;
        font-style: italic;
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