/**
 * Imitation Practice Manager
 * 仿寫練習管理器 - 利用保存的句子進行句型練習
 */

class ImitationPracticeManager {
  constructor() {
    this.patterns = new Map();
    this.practiceHistory = [];
    this.difficultyLevels = ['beginner', 'intermediate', 'advanced'];
  }

  /**
   * 從保存的句子中提取句型模板
   * @param {string} sentence - 原始句子
   * @param {string} language - 語言類型
   * @returns {Object} 句型模板和關鍵元素
   */
  extractPattern(sentence, language = 'english') {
    const pattern = {
      original: sentence,
      template: '',
      keyElements: [],
      structure: '',
      difficulty: 'intermediate'
    };

    // 基於不同語言的句型提取規則
    switch(language) {
      case 'english':
        pattern.template = this.extractEnglishPattern(sentence);
        break;
      case 'dutch':
        pattern.template = this.extractDutchPattern(sentence);
        break;
      case 'japanese':
        pattern.template = this.extractJapanesePattern(sentence);
        break;
      default:
        pattern.template = this.extractGenericPattern(sentence);
    }

    return pattern;
  }

  /**
   * 提取英語句型模板
   */
  extractEnglishPattern(sentence) {
    // 識別常見句型
    const patterns = [
      // 條件句
      { regex: /^If (.+), (.+)$/i, template: 'If [condition], [result]' },
      // 比較級
      { regex: /^The (.+) you (.+), the (.+) you (.+)$/i, template: 'The [comparative] you [verb], the [comparative] you [verb]' },
      // Would like to
      { regex: /^I would like to (.+)$/i, template: 'I would like to [verb phrase]' },
      // Present perfect
      { regex: /^I have (.+) since (.+)$/i, template: 'I have [past participle] since [time]' },
      // Used to
      { regex: /^I used to (.+) but now (.+)$/i, template: 'I used to [verb] but now [verb]' }
    ];

    for (const { regex, template } of patterns) {
      if (regex.test(sentence)) {
        return template;
      }
    }

    // 如果沒有匹配特定模式，使用通用提取
    return this.extractGenericPattern(sentence);
  }

  /**
   * 提取荷蘭語句型模板（考慮V2規則和TMP結構）
   */
  extractDutchPattern(sentence) {
    // 荷蘭語特殊句型
    const patterns = [
      // V2 規則
      { regex: /^(.+) (ga|gaat|ging) (.+) (naar|met|voor) (.+)$/i, template: '[Subject] [verb] [time/manner] [preposition] [place]' },
      // 從句結構
      { regex: /^Omdat (.+), (.+)$/i, template: 'Omdat [reason], [result]' },
      // 分離動詞
      { regex: /^Ik (.+) (.+) (op|uit|aan|af)$/i, template: 'Ik [verb stem] [object] [separable prefix]' }
    ];

    for (const { regex, template } of patterns) {
      if (regex.test(sentence)) {
        return template;
      }
    }

    return this.extractGenericPattern(sentence);
  }

  /**
   * 提取日語句型模板
   */
  extractJapanesePattern(sentence) {
    // 日語句型提取（簡化版）
    const patterns = [
      // ～たい (want to)
      { regex: /(.+)たいです$/i, template: '[動詞ます形]たいです' },
      // ～ことができる (can do)
      { regex: /(.+)ことができます$/i, template: '[動詞辞書形]ことができます' },
      // ～てください (please do)
      { regex: /(.+)てください$/i, template: '[動詞て形]てください' }
    ];

    for (const { regex, template } of patterns) {
      if (regex.test(sentence)) {
        return template;
      }
    }

    return this.extractGenericPattern(sentence);
  }

  /**
   * 通用句型提取
   */
  extractGenericPattern(sentence) {
    // 標記主要詞性
    const words = sentence.split(' ');
    const template = words.map(word => {
      // 簡單的詞性標記（實際應用中可以使用NLP庫）
      if (/^(I|you|he|she|it|we|they)$/i.test(word)) return '[pronoun]';
      if (/^(is|am|are|was|were|have|has|had)$/i.test(word)) return '[auxiliary]';
      if (/^(the|a|an)$/i.test(word)) return '[article]';
      if (/^(in|on|at|to|from|with|by)$/i.test(word)) return '[preposition]';
      if (/^[A-Z]/.test(word)) return '[proper noun]';
      return word;
    }).join(' ');

    return template;
  }

  /**
   * 生成仿寫練習
   * @param {Object} savedSentence - 保存的句子數據
   * @param {string} practiceType - 練習類型
   * @returns {Object} 練習內容
   */
  generatePractice(savedSentence, practiceType = 'substitution') {
    const pattern = this.extractPattern(savedSentence.text, savedSentence.language);
    
    const practice = {
      id: Date.now().toString(),
      originalSentence: savedSentence,
      pattern: pattern,
      type: practiceType,
      exercises: [],
      hints: [],
      examples: []
    };

    switch(practiceType) {
      case 'substitution':
        practice.exercises = this.generateSubstitutionExercises(pattern);
        break;
      case 'expansion':
        practice.exercises = this.generateExpansionExercises(pattern);
        break;
      case 'transformation':
        practice.exercises = this.generateTransformationExercises(pattern);
        break;
      case 'contextual':
        practice.exercises = this.generateContextualExercises(pattern);
        break;
    }

    practice.hints = this.generateHints(pattern, practiceType);
    practice.examples = this.generateExamples(pattern);

    return practice;
  }

  /**
   * 生成替換練習
   */
  generateSubstitutionExercises(pattern) {
    const exercises = [];
    
    // 基於模板生成填空題
    const blanks = pattern.template.match(/\[([^\]]+)\]/g) || [];
    
    blanks.forEach((blank, index) => {
      exercises.push({
        instruction: `Replace ${blank} with an appropriate word or phrase:`,
        template: pattern.template,
        targetBlank: index,
        suggestions: this.getSubstitutionSuggestions(blank),
        difficulty: this.calculateDifficulty(blank)
      });
    });

    return exercises;
  }

  /**
   * 生成擴展練習
   */
  generateExpansionExercises(pattern) {
    return [
      {
        instruction: 'Add an adjective to make the sentence more descriptive:',
        original: pattern.original,
        targetPositions: this.identifyExpansionPoints(pattern.original)
      },
      {
        instruction: 'Add a time expression to the sentence:',
        original: pattern.original,
        suggestions: ['yesterday', 'last week', 'tomorrow', 'usually']
      },
      {
        instruction: 'Add a reason or explanation using "because":',
        original: pattern.original,
        example: pattern.original + ' because...'
      }
    ];
  }

  /**
   * 生成轉換練習
   */
  generateTransformationExercises(pattern) {
    return [
      {
        instruction: 'Change the sentence to past tense:',
        original: pattern.original,
        hints: ['Look for verbs and change them to past form']
      },
      {
        instruction: 'Make the sentence negative:',
        original: pattern.original,
        hints: ['Add "not" or change to negative form']
      },
      {
        instruction: 'Turn the sentence into a question:',
        original: pattern.original,
        hints: ['Move auxiliary verb to the beginning']
      }
    ];
  }

  /**
   * 生成情境練習
   */
  generateContextualExercises(pattern) {
    const contexts = [
      { situation: 'formal business meeting', register: 'formal' },
      { situation: 'casual conversation with friends', register: 'informal' },
      { situation: 'academic presentation', register: 'academic' },
      { situation: 'email to colleague', register: 'professional' }
    ];

    return contexts.map(context => ({
      instruction: `Rewrite the sentence for a ${context.situation}:`,
      original: pattern.original,
      context: context,
      tips: this.getRegisterTips(context.register)
    }));
  }

  /**
   * 獲取替換建議
   */
  getSubstitutionSuggestions(blank) {
    const suggestions = {
      '[verb]': ['make', 'create', 'develop', 'understand', 'learn'],
      '[noun]': ['idea', 'concept', 'solution', 'problem', 'opportunity'],
      '[adjective]': ['important', 'useful', 'interesting', 'challenging', 'effective'],
      '[pronoun]': ['I', 'you', 'we', 'they', 'someone'],
      '[time]': ['yesterday', 'today', 'tomorrow', 'last week', 'next month']
    };

    return suggestions[blank] || ['example1', 'example2', 'example3'];
  }

  /**
   * 生成提示
   */
  generateHints(pattern, practiceType) {
    const hints = {
      substitution: [
        'Keep the same grammatical structure',
        'Make sure the new word fits the context',
        'Check verb agreement with the subject'
      ],
      expansion: [
        'Adjectives usually come before nouns',
        'Time expressions often go at the beginning or end',
        'Use commas to separate added information'
      ],
      transformation: [
        'Remember to change all verbs in the sentence',
        'Word order might change in questions',
        'Some words have irregular past forms'
      ],
      contextual: [
        'Formal language uses longer words and complete sentences',
        'Informal language can use contractions',
        'Consider your audience and purpose'
      ]
    };

    return hints[practiceType] || [];
  }

  /**
   * 評估用戶的仿寫練習
   */
  evaluateImitation(userSentence, pattern, exerciseType) {
    const evaluation = {
      score: 0,
      feedback: [],
      corrections: [],
      strengths: [],
      suggestions: []
    };

    // 基本語法檢查
    const grammarCheck = this.checkGrammar(userSentence);
    evaluation.score += grammarCheck.score;
    evaluation.feedback.push(...grammarCheck.feedback);

    // 句型符合度檢查
    const patternMatch = this.checkPatternMatch(userSentence, pattern);
    evaluation.score += patternMatch.score;
    evaluation.feedback.push(...patternMatch.feedback);

    // 根據練習類型的特定檢查
    const typeSpecificCheck = this.checkByExerciseType(userSentence, pattern, exerciseType);
    evaluation.score += typeSpecificCheck.score;
    evaluation.feedback.push(...typeSpecificCheck.feedback);

    // 總分標準化（0-100）
    evaluation.score = Math.min(100, Math.round(evaluation.score));

    // 生成鼓勵性反饋
    evaluation.encouragement = this.generateEncouragement(evaluation.score);

    return evaluation;
  }

  /**
   * 保存練習記錄
   */
  async savePracticeRecord(practice, userResponse, evaluation) {
    const record = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      practice: practice,
      userResponse: userResponse,
      evaluation: evaluation,
      timeSpent: 0, // 可以通過前端計算
      completed: true
    };

    this.practiceHistory.push(record);

    // 保存到 chrome.storage
    try {
      const result = await chrome.storage.local.get(['imitationPracticeHistory']);
      const history = result.imitationPracticeHistory || [];
      history.push(record);
      
      // 只保留最近100條記錄
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }

      await chrome.storage.local.set({ imitationPracticeHistory: history });
      return record;
    } catch (error) {
      console.error('Failed to save practice record:', error);
      return null;
    }
  }

  /**
   * 獲取練習統計
   */
  async getPracticeStats() {
    try {
      const result = await chrome.storage.local.get(['imitationPracticeHistory']);
      const history = result.imitationPracticeHistory || [];

      const stats = {
        totalPractices: history.length,
        averageScore: 0,
        practicesByType: {},
        recentProgress: [],
        strengths: [],
        weaknesses: []
      };

      if (history.length > 0) {
        // 計算平均分
        const totalScore = history.reduce((sum, record) => sum + record.evaluation.score, 0);
        stats.averageScore = Math.round(totalScore / history.length);

        // 按類型統計
        history.forEach(record => {
          const type = record.practice.type;
          stats.practicesByType[type] = (stats.practicesByType[type] || 0) + 1;
        });

        // 最近進度（最近7次練習）
        stats.recentProgress = history
          .slice(-7)
          .map(record => ({
            date: record.timestamp,
            score: record.evaluation.score,
            type: record.practice.type
          }));
      }

      return stats;
    } catch (error) {
      console.error('Failed to get practice stats:', error);
      return null;
    }
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImitationPracticeManager;
}