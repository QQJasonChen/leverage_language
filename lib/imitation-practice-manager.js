/**
 * Imitation Practice Manager
 * 仿寫練習管理器 - 利用保存的句子進行句型練習
 */

class ImitationPracticeManager {
  constructor() {
    this.patterns = new Map();
    this.practiceHistory = [];
    this.difficultyLevels = ['beginner', 'intermediate', 'advanced'];
    // 🔧 AI enabled for evaluation only (disabled for pattern analysis to prevent freezing)
    this.AI_ENABLED = true;
    this.AI_PATTERN_ANALYSIS_ENABLED = false; // Keep pattern analysis disabled
    
    // 🔧 Override AI calls if disabled to prevent any freezing
    this.originalSendMessage = chrome.runtime.sendMessage;
  }

  /**
   * 檢查是否可以使用AI
   */
  isAIAvailable() {
    return this.AI_ENABLED;
  }

  /**
   * 安全的AI調用包裝器 - 如果AI被禁用則立即返回null
   */
  async safeAICall(message) {
    // 檢查是否為句型分析相關的AI調用（這些仍然被禁用）
    if (message.context && (
      message.context.type === 'pattern_analysis' || 
      message.context.type === 'vocabulary_suggestions' ||
      message.context.type === 'hints_generation' ||
      message.context.type === 'examples_generation'
    )) {
      console.log('🔧 Pattern analysis AI call blocked to prevent freezing:', message.context.type);
      return { success: false, error: 'Pattern analysis AI disabled to prevent freezing' };
    }
    
    // 允許評估相關的AI調用
    if (!this.AI_ENABLED) {
      console.log('🔧 AI call blocked:', message.action);
      return { success: false, error: 'AI disabled' };
    }
    
    console.log('✅ Allowing AI call:', message.context?.type || message.action);
    return this.originalSendMessage(message);
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
      // 基本句型: Het/De + noun + is/zijn + adjective
      { regex: /^(Het|De) (.+) (is|zijn) (.+)$/i, template: '[article] [noun] [verb] [adjective]' },
      // 一般現在時: Subject + verb + object
      { regex: /^(Ik|Jij|Hij|Zij|Wij|Jullie) (.+) (.+)$/i, template: '[subject] [verb] [object/complement]' },
      // 時間表達: 時間 + V2結構
      { regex: /^(.+) (ga|gaat|ging) (.+) (naar|met|voor) (.+)$/i, template: '[subject] [verb] [time/manner] [preposition] [place]' },
      // 從句結構
      { regex: /^Omdat (.+), (.+)$/i, template: 'Omdat [reason], [result]' },
      // 分離動詞
      { regex: /^(.+) (.+) (.+) (op|uit|aan|af)$/i, template: '[subject] [verb stem] [object] [separable prefix]' },
      // 疑問句
      { regex: /^(Wat|Wie|Waar|Wanneer|Hoe) (.+)\?$/i, template: '[question word] [rest of question]?' }
    ];

    for (const { regex, template } of patterns) {
      if (regex.test(sentence)) {
        return template;
      }
    }

    // 針對荷蘭語進行更精確的通用提取
    return this.extractDutchGenericPattern(sentence);
  }

  /**
   * 荷蘭語通用句型提取
   */
  extractDutchGenericPattern(sentence) {
    const words = sentence.split(' ');
    const template = words.map(word => {
      // 荷蘭語冠詞
      if (/^(het|de|een)$/i.test(word)) return '[article]';
      // 荷蘭語人稱代詞
      if (/^(ik|jij|hij|zij|het|wij|jullie|ze)$/i.test(word)) return '[pronoun]';
      // 荷蘭語常見動詞
      if (/^(ben|bent|is|zijn|was|waren|heeft|hebben|had|hadden)$/i.test(word)) return '[verb]';
      // 荷蘭語介詞
      if (/^(in|op|aan|bij|van|voor|naar|met|door|over|onder|tussen)$/i.test(word)) return '[preposition]';
      // 荷蘭語形容詞（通常以-e結尾或常見形容詞）
      if (/e$|^(groot|klein|mooi|lelijk|goed|slecht|nieuw|oud|lang|kort|breed|smal|dik|dun|zwaar|licht|hard|zacht|warm|koud|nat|droog|schoon|vuil|vol|leeg|open|dicht|vrolijk|verdrietig|boos|blij|moe|wakker|ziek|gezond|rijk|arm|slim|dom|snel|langzaam|hoog|laag|diep|ondiep|ver|dichtbij|links|rechts|gezellig|saai|interessant|leuk|vervelend)$/i.test(word)) return '[adjective]';
      // 專有名詞（首字母大寫）
      if (/^[A-Z]/.test(word)) return '[proper noun]';
      // 保持原詞
      return word;
    }).join(' ');

    return template;
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
  async generatePractice(savedSentence, practiceType = 'substitution') {
    console.log('🤖 Starting practice generation for:', savedSentence.text);
    
    // 強制嘗試AI分析（優先級最高）
    let pattern;
    let aiGenerated = false;
    
    try {
      console.log('🤖 Attempting AI pattern generation...');
      const aiPattern = await this.generateAIPattern(savedSentence);
      if (aiPattern && aiPattern.template) {
        pattern = aiPattern;
        aiGenerated = true;
        console.log('✅ AI pattern generated successfully:', pattern.template);
      } else {
        console.warn('❌ AI pattern generation returned null or invalid result');
      }
    } catch (error) {
      console.error('❌ AI pattern generation failed with error:', error);
    }
    
    // 如果AI完全失敗，使用基本方法作為後備
    if (!pattern) {
      console.warn('⚠️ Falling back to basic pattern extraction');
      pattern = this.extractPattern(savedSentence.text, savedSentence.language);
      aiGenerated = false;
    }
    
    const practice = {
      id: Date.now().toString(),
      originalSentence: savedSentence,
      pattern: pattern,
      type: practiceType,
      exercises: [],
      hints: [],
      examples: [],
      aiGenerated: aiGenerated
    };

    // 生成練習內容
    try {
      if (aiGenerated) {
        console.log('🤖 Generating AI-powered exercises...');
        practice.exercises = await this.generateAIExercises(pattern, practiceType);
        practice.hints = await this.generateAIHints(pattern, practiceType);
        practice.examples = await this.generateAIExamples(pattern);
        console.log('✅ AI exercises generated:', practice.exercises.length, 'exercises');
      } else {
        console.log('⚠️ Using basic exercise generation');
        practice.exercises = this.generateBasicExercises(pattern, practiceType);
        practice.hints = this.generateHints(pattern, practiceType);
        practice.examples = this.generateExamples(pattern);
      }
    } catch (error) {
      console.error('❌ Exercise generation failed:', error);
      // 最後的後備方案
      practice.exercises = this.generateBasicExercises(pattern, practiceType);
      practice.hints = this.generateHints(pattern, practiceType);
      practice.examples = this.generateExamples(pattern);
      practice.aiGenerated = false;
    }

    console.log('✅ Practice generation completed. AI Generated:', practice.aiGenerated);
    return practice;
  }

  /**
   * 使用AI生成句型模板
   */
  async generateAIPattern(savedSentence) {
    // 🔧 Skip AI if disabled to prevent freezing
    if (!this.AI_ENABLED) {
      console.log('🔧 AI disabled, using generateLocalPattern instead');
      return this.generateLocalPattern(savedSentence);
    }
    
    const prompt = `你是專業的語言學習專家。請仔細分析以下句子的語法結構並生成準確的句型模板。

句子: "${savedSentence.text}"
語言: ${this.detectLanguage(savedSentence.text)}

**重要要求**:
1. 準確識別每個詞的詞性和功能
2. 區分所有格代詞(onze, mijn等)和形容詞
3. 識別複合句和並列句的結構
4. 只標記真正可以替換的部分

**例子說明**:
- "Onze docent heet Willem" 中:
  - "Onze" = [possessive_pronoun] (不是形容詞!)
  - "docent" = [noun]
  - "heet" = [verb] 
  - "Willem" = [proper_name]

**荷蘭語特別注意**:
- onze/mijn/jouw = 所有格代詞 [possessive_pronoun]
- de/het = 定冠詞 [definite_article]
- 動詞第二位規則 V2
- 複合句用句號分隔

請必須以JSON格式回答，不要有其他文字：
{
  "template": "準確的句型模板",
  "analysis": "詳細語法分析", 
  "language": "detected_language",
  "complexity": "simple/intermediate/advanced",
  "sentence_parts": ["句子1", "句子2"] 
}`;

    console.log('🤖 Sending AI pattern request for:', savedSentence.text);
    
    const response = await this.safeAICall({
      action: 'getAIResponse',
      prompt: prompt,
      context: {
        type: 'pattern_analysis',
        sentence: savedSentence.text,
        language: savedSentence.language
      }
    });

    console.log('🤖 AI pattern response:', response);

    if (response && response.success && response.text) {
      const result = this.parseAIPattern(response.text, savedSentence);
      console.log('🤖 Parsed AI pattern:', result);
      return result;
    }
    
    console.warn('🤖 AI pattern generation failed');
    return null;
  }

  /**
   * 簡單語言檢測
   */
  detectLanguage(text) {
    if (/\b(het|de|een|onze|mijn|jouw|zijn|haar|is|zijn|was|waren|heet|heten)\b/i.test(text)) {
      return 'dutch';
    }
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
      return 'japanese';
    }
    return 'english';
  }

  /**
   * 解析AI生成的句型
   */
  parseAIPattern(aiResponse, savedSentence) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          original: savedSentence.text,
          template: result.template,
          keyElements: [],
          structure: result.analysis || '',
          difficulty: result.complexity || 'intermediate',
          language: result.language || savedSentence.language,
          aiGenerated: true
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI pattern:', error);
    }
    
    return null;
  }

  /**
   * 使用AI生成句型分析 (帶有智能備用方案)
   */
  async generateAIPattern(sentenceData) {
    try {
      const prompt = `你是專業的語言學習專家。請仔細分析以下句子的語法結構並生成準確的句型模板。

句子: "${sentenceData.text}"
語言: ${this.detectLanguage(sentenceData.text)}

**分析要求**:
1. 識別句型結構和語法要點
2. 生成可重複使用的句型模板
3. 標記語法重點和關鍵詞彙
4. 考慮語言特性(例如荷蘭語V2規則、詞性變化等)

請以JSON格式回答，不要其他文字：
{
  "template": "句型模板，用[標記]表示可替換部分",
  "grammarPoints": ["語法要點1", "語法要點2"],
  "complexity": "beginner/intermediate/advanced",
  "language": "detected language"
}`;

      const response = await this.safeAICall({
        action: 'getAIResponse',
        prompt: prompt,
        context: {
          type: 'pattern_analysis',
          sentence: sentenceData.text
        }
      });

      if (response && response.success && response.text) {
        const aiResult = this.parseAIPattern(response.text, sentenceData);
        if (aiResult && aiResult.template) {
          console.log('✅ AI pattern generation successful');
          return aiResult;
        }
      }
      
      // Fall through to basic pattern if AI fails or returns invalid result
      console.warn('🤖 AI pattern generation failed or returned invalid result, using rule-based fallback');
    } catch (error) {
      console.warn('🤖 AI pattern generation error:', error.message);
    }

    // Smart rule-based fallback
    return this.generateBasicPattern(sentenceData);
  }

  /**
   * 智能基本句型分析 (不依賴AI)
   */
  generateBasicPattern(sentenceData) {
    const text = sentenceData.text;
    const language = this.detectLanguage(text);
    
    console.log('🔧 Generating basic pattern for:', text, 'Language:', language);
    
    if (language === 'dutch') {
      return this.analyzeDutchPattern(text);
    } else if (language === 'english') {
      return this.analyzeEnglishPattern(text);
    } else {
      return this.analyzeGenericPattern(text, language);
    }
  }

  /**
   * 荷蘭語句型分析
   */
  analyzeDutchPattern(text) {
    const words = text.toLowerCase().split(' ');
    
    // Common Dutch patterns
    if (words.includes('het') || words.includes('de')) {
      if (words.includes('is') || words.includes('zijn')) {
        return {
          template: '[冠詞] [名詞] [動詞] [形容詞/名詞]',
          grammarPoints: [
            '荷蘭語基本句型：主語 + 動詞 + 補語',
            '冠詞het/de的使用',
            '動詞is/zijn的變化'
          ],
          complexity: 'beginner',
          language: 'dutch'
        };
      }
    }
    
    if (words[0] && /^(ik|jij|hij|zij|wij|jullie|zij)$/.test(words[0])) {
      return {
        template: '[主語代詞] [動詞] [賓語/補語]',
        grammarPoints: [
          '荷蘭語人稱代詞句型',
          '主語-動詞一致性',
          'V2語序規則'
        ],
        complexity: 'intermediate',
        language: 'dutch'
      };
    }
    
    return {
      template: '[主語] [動詞] [賓語/補語]',
      grammarPoints: [
        '荷蘭語基本句型結構',
        '詞序規則',
        '動詞變位'
      ],
      complexity: 'intermediate',
      language: 'dutch'
    };
  }

  /**
   * 英語句型分析
   */
  analyzeEnglishPattern(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.startsWith('if ')) {
      return {
        template: 'If [條件], [結果]',
        grammarPoints: [
          '英語條件句結構',
          '從句與主句的關係',
          '動詞時態一致性'
        ],
        complexity: 'intermediate',
        language: 'english'
      };
    }
    
    if (lowerText.includes('used to')) {
      return {
        template: '[主語] used to [動詞], but now [現況]',
        grammarPoints: [
          'used to 表示過去習慣',
          '對比現在與過去',
          '時態轉換'
        ],
        complexity: 'intermediate',
        language: 'english'
      };
    }
    
    return {
      template: '[Subject] [Verb] [Object/Complement]',
      grammarPoints: [
        '英語基本句型結構',
        '主謂賓語序',
        '動詞變化'
      ],
      complexity: 'beginner',
      language: 'english'
    };
  }

  /**
   * 通用句型分析
   */
  analyzeGenericPattern(text, language) {
    return {
      template: '[主語] [動詞] [賓語/補語]',
      grammarPoints: [
        '基本句型結構',
        '詞序規則',
        '語法一致性'
      ],
      complexity: 'beginner',
      language: language
    };
  }

  /**
   * 生成詞彙替換建議 (智能備用方案)
   */
  async generateReplacementSuggestions(sentenceData, aiPattern) {
    // 🔧 Skip AI if disabled to prevent freezing
    if (!this.AI_ENABLED) {
      console.log('🔧 AI disabled, using generateLocalSuggestions instead');
      return this.generateLocalSuggestions(sentenceData);
    }
    
    try {
      const prompt = `基於句子分析，為每個重要詞彙生成替換建議。

原句: "${sentenceData.text}"
句型: "${aiPattern.template}"
語言: ${aiPattern.language || 'english'}

請為句子中的關鍵詞彙生成同類型的替換建議：

請以JSON格式回答，不要其他文字：
[
  {
    "original": "原詞彙",
    "type": "詞性(名詞/動詞/形容詞等)",
    "alternatives": ["替換詞1", "替換詞2", "替換詞3"]
  }
]`;

      const response = await this.safeAICall({
        action: 'getAIResponse',
        prompt: prompt,
        context: {
          type: 'vocabulary_suggestions',
          sentence: sentenceData.text
        }
      });

      if (response && response.success && response.text) {
        try {
          const jsonMatch = response.text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              console.log('✅ AI vocabulary suggestions successful');
              return suggestions;
            }
          }
        } catch (error) {
          console.warn('Failed to parse AI replacement suggestions:', error);
        }
      }
    } catch (error) {
      console.warn('🤖 AI vocabulary suggestions error:', error.message);
    }

    // Smart rule-based fallback
    console.log('🔧 Using rule-based vocabulary suggestions');
    return this.generateBasicReplacementSuggestions(sentenceData);
  }

  /**
   * 基於規則的詞彙替換建議
   */
  generateBasicReplacementSuggestions(sentenceData) {
    const text = sentenceData.text;
    const language = this.detectLanguage(text);
    const words = text.split(' ');
    const suggestions = [];

    if (language === 'dutch') {
      words.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[.,!?]$/, '');
        
        if (['het', 'de', 'een'].includes(cleanWord)) {
          suggestions.push({
            original: cleanWord,
            type: '冠詞',
            alternatives: ['het', 'de', 'een']
          });
        } else if (['is', 'zijn', 'was', 'waren'].includes(cleanWord)) {
          suggestions.push({
            original: cleanWord,
            type: '動詞',
            alternatives: ['is', 'zijn', 'was', 'waren', 'wordt']
          });
        } else if (['feestje', 'huis', 'school', 'werk'].includes(cleanWord)) {
          suggestions.push({
            original: cleanWord,
            type: '名詞',
            alternatives: ['feestje', 'huis', 'school', 'restaurant', 'park']
          });
        } else if (['gezellig', 'mooi', 'groot', 'klein'].includes(cleanWord) || word.length > 4) {
          suggestions.push({
            original: cleanWord,
            type: '形容詞',
            alternatives: ['gezellig', 'mooi', 'interessant', 'leuk', 'fijn']
          });
        }
      });
    } else if (language === 'english') {
      words.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[.,!?]$/, '');
        
        if (['the', 'a', 'an'].includes(cleanWord)) {
          suggestions.push({
            original: cleanWord,
            type: 'Article',
            alternatives: ['the', 'a', 'an']
          });
        } else if (['is', 'are', 'was', 'were'].includes(cleanWord)) {
          suggestions.push({
            original: cleanWord,
            type: 'Verb',
            alternatives: ['is', 'are', 'was', 'were', 'becomes']
          });
        } else if (word.length > 4 && !['with', 'have', 'been', 'they', 'this', 'that'].includes(cleanWord)) {
          if (['party', 'house', 'school', 'work'].includes(cleanWord)) {
            suggestions.push({
              original: cleanWord,
              type: 'Noun',
              alternatives: ['party', 'house', 'school', 'office', 'restaurant']
            });
          } else {
            suggestions.push({
              original: cleanWord,
              type: 'Adjective/Noun',
              alternatives: ['nice', 'interesting', 'beautiful', 'important']
            });
          }
        }
      });
    }

    // Ensure we have at least some suggestions
    if (suggestions.length === 0) {
      suggestions.push({
        original: '詞彙',
        type: '可替換詞彙',
        alternatives: ['替換為同類詞彙', '保持語法結構', '調整語境適當性']
      });
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }

  /**
   * 使用AI評估用戶答案 (智能備用方案)
   */
  async evaluateWithAI(userInput, sentenceData, aiPattern) {
    // 🔧 Skip AI if disabled to prevent freezing
    if (!this.AI_ENABLED) {
      console.log('🔧 AI disabled, using basic evaluation');
      return this.performBasicEvaluation(userInput, aiPattern, 'imitation');
    }
    
    try {
      const prompt = `作為語言學習評估專家，請評估學生的仿寫練習。

原句: "${sentenceData.text}"
句型模板: "${aiPattern.template}"
學生答案: "${userInput}"

評估標準：
1. 語法正確性 (35%)
2. 句型結構符合度 (25%)  
3. 詞彙使用適當性 (20%)
4. 創意和表達自然度 (20%)

請以JSON格式回答，不要其他文字：
{
  "score": 85,
  "feedback": "整體評估總結",
  "strengths": ["優點1", "優點2"],
  "suggestions": ["改進建議1", "改進建議2"]
}`;

      const response = await this.safeAICall({
        action: 'getAIResponse',
        prompt: prompt,
        context: {
          type: 'answer_evaluation',
          userInput: userInput,
          original: sentenceData.text
        }
      });

      if (response && response.success && response.text) {
        try {
          const jsonMatch = response.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const evaluation = JSON.parse(jsonMatch[0]);
            if (evaluation && typeof evaluation.score === 'number') {
              console.log('✅ AI evaluation successful');
              return evaluation;
            }
          }
        } catch (error) {
          console.warn('Failed to parse AI evaluation:', error);
        }
      }
    } catch (error) {
      console.warn('🤖 AI evaluation error:', error.message);
    }

    // Smart rule-based evaluation fallback
    console.log('🔧 Using rule-based evaluation');
    return this.generateBasicEvaluation(userInput, sentenceData, aiPattern);
  }

  /**
   * 基於規則的評估系統
   */
  generateBasicEvaluation(userInput, sentenceData, aiPattern) {
    const original = sentenceData.text.toLowerCase();
    const user = userInput.toLowerCase();
    const language = aiPattern.language || this.detectLanguage(userInput);
    
    let score = 60; // Base score
    const strengths = [];
    const suggestions = [];
    
    // Length check
    if (userInput.length < 5) {
      score = 30;
      suggestions.push('請輸入更完整的句子');
    } else {
      strengths.push('句子長度適當');
      score += 10;
    }
    
    // Word count comparison
    const originalWords = original.split(' ').length;
    const userWords = user.split(' ').length;
    
    if (Math.abs(originalWords - userWords) <= 2) {
      strengths.push('句子長度與原句相近');
      score += 10;
    } else if (userWords < originalWords - 3) {
      suggestions.push('可以嘗試添加更多細節');
    } else if (userWords > originalWords + 3) {
      suggestions.push('嘗試表達更簡潔');
    }
    
    // Structure similarity (basic)
    if (language === 'dutch') {
      if (user.includes('is') || user.includes('zijn')) {
        strengths.push('正確使用荷蘭語動詞');
        score += 10;
      }
      if (user.includes('het ') || user.includes('de ')) {
        strengths.push('使用了冠詞');
        score += 5;
      }
    } else if (language === 'english') {
      if (user.includes('the ') || user.includes('a ') || user.includes('an ')) {
        strengths.push('使用了英語冠詞');
        score += 5;
      }
    }
    
    // Creativity check (different words used)
    const originalWordsSet = new Set(original.split(' '));
    const userWordsSet = new Set(user.split(' '));
    const overlap = [...originalWordsSet].filter(word => userWordsSet.has(word)).length;
    const totalOriginalWords = originalWordsSet.size;
    
    if (overlap < totalOriginalWords * 0.5) {
      strengths.push('使用了新的詞彙');
      score += 10;
    }
    
    // Avoid identical sentences
    if (original === user) {
      score = 40;
      suggestions.push('嘗試使用不同的詞彙重寫句子');
    }
    
    // Cap the score
    score = Math.min(score, 95);
    score = Math.max(score, 25);
    
    // Generate appropriate feedback
    let feedback;
    if (score >= 80) {
      feedback = '很好的練習！你成功地模仿了句型結構並使用了適當的詞彙。';
    } else if (score >= 60) {
      feedback = '不錯的嘗試！繼續練習可以讓你的表達更加自然。';
    } else {
      feedback = '繼續努力！多練習可以幫助你更好地掌握這個句型。';
    }
    
    // Ensure we have some suggestions
    if (suggestions.length === 0) {
      if (score >= 80) {
        suggestions.push('嘗試使用更高級的詞彙');
      } else {
        suggestions.push('注意語法結構的一致性', '多讀類似的例句');
      }
    }
    
    // Ensure we have some strengths
    if (strengths.length === 0) {
      strengths.push('你嘗試完成了練習');
    }
    
    return {
      score: Math.round(score),
      feedback: feedback,
      strengths: strengths,
      suggestions: suggestions
    };
  }

  /**
   * 使用AI生成練習內容
   */
  async generateAIExercises(pattern, practiceType) {
    if (practiceType !== 'substitution') {
      return this.generateBasicExercises(pattern, practiceType);
    }

    const prompt = `基於句型模板生成替換練習。請為每個[標記]部分生成具體的練習指示和建議詞彙。

原句: "${pattern.original}"
模板: "${pattern.template}"
語言: ${pattern.language}

**要求**:
1. 為模板中每個[標記]生成一個練習
2. 提供準確的中英文替換指示
3. 給出3-5個語法正確、語境合適的建議詞彙
4. 考慮語言特性(荷蘭語V2規則、詞性變化等)

**荷蘭語詞彙建議參考**:
- [possessive_pronoun]: mijn, jouw, zijn, haar, onze, jullie
- [proper_name]: Jan, Marie, Peter, Anna, Thomas
- [noun]: docent, student, vriend, collega, buurman
- [verb]: is, was, wordt, blijft, lijkt
- [adjective]: lang, kort, groot, klein, jong, oud

請以JSON格式回答，不要其他文字：
{
  "exercises": [
    {
      "target": "[possessive_pronoun]",
      "instruction": "Replace [possessive_pronoun] with another possessive pronoun (替換所有格代詞):",
      "suggestions": ["mijn", "jouw", "zijn", "haar", "jullie"],
      "explanation": "These are Dutch possessive pronouns that show ownership"
    }
  ]
}`;

    console.log('🤖 Sending AI exercises request for pattern:', pattern.template);

    const response = await this.safeAICall({
      action: 'getAIResponse',
      prompt: prompt,
      context: {
        type: 'exercise_generation',
        pattern: pattern,
        exerciseType: practiceType
      }
    });

    console.log('🤖 AI exercises response:', response);

    if (response && response.success && response.text) {
      const result = this.parseAIExercises(response.text, pattern);
      console.log('🤖 Parsed AI exercises:', result);
      return result;
    }

    console.warn('🤖 AI exercise generation failed, using basic method');
    return this.generateBasicExercises(pattern, practiceType);
  }

  /**
   * 解析AI生成的練習
   */
  parseAIExercises(aiResponse, pattern) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.exercises.map((exercise, index) => ({
          instruction: exercise.instruction,
          template: pattern.template,
          targetBlank: index,
          suggestions: exercise.suggestions || [],
          difficulty: 'intermediate',
          explanation: exercise.explanation
        }));
      }
    } catch (error) {
      console.warn('Failed to parse AI exercises:', error);
    }

    return this.generateBasicExercises(pattern, 'substitution');
  }

  /**
   * 生成基本練習（原有邏輯）
   */
  generateBasicExercises(pattern, practiceType) {
    switch(practiceType) {
      case 'substitution':
        return this.generateSubstitutionExercises(pattern);
      case 'expansion':
        return this.generateExpansionExercises(pattern);
      case 'transformation':
        return this.generateTransformationExercises(pattern);
      case 'contextual':
        return this.generateContextualExercises(pattern);
      default:
        return [];
    }
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
        suggestions: this.getSubstitutionSuggestions(blank, this.detectLanguageFromPattern(pattern)),
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
  getSubstitutionSuggestions(blank, language = 'english') {
    const suggestionsByLanguage = {
      english: {
        '[verb]': ['make', 'create', 'develop', 'understand', 'learn'],
        '[noun]': ['idea', 'concept', 'solution', 'problem', 'opportunity'],
        '[adjective]': ['important', 'useful', 'interesting', 'challenging', 'effective'],
        '[pronoun]': ['I', 'you', 'we', 'they', 'someone'],
        '[time]': ['yesterday', 'today', 'tomorrow', 'last week', 'next month']
      },
      dutch: {
        '[article]': ['het', 'de', 'een'],
        '[verb]': ['is', 'was', 'wordt', 'blijft', 'lijkt'],
        '[adjective]': ['mooi', 'interessant', 'leuk', 'saai', 'gezellig', 'geweldig', 'fantastisch'],
        '[noun]': ['feest', 'concert', 'film', 'boek', 'verhaal', 'gesprek', 'avond'],
        '[subject]': ['Ik', 'Jij', 'Hij', 'Zij', 'Wij', 'Jullie'],
        '[pronoun]': ['ik', 'je', 'hij', 'zij', 'we', 'jullie'],
        '[preposition]': ['in', 'op', 'aan', 'bij', 'van', 'voor', 'naar', 'met']
      },
      japanese: {
        '[動詞ます形]': ['行き', '見', '聞き', '読み', '書き'],
        '[動詞辞書形]': ['行く', '見る', '聞く', '読む', '書く'],
        '[動詞て形]': ['行って', '見て', '聞いて', '読んで', '書いて']
      }
    };

    const languageSuggestions = suggestionsByLanguage[language] || suggestionsByLanguage.english;
    return languageSuggestions[blank] || ['example1', 'example2', 'example3'];
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
   * 使用AI生成智能提示
   */
  async generateAIHints(pattern, practiceType) {
    const prompt = `為以下語言練習生成3-5個具體實用的提示：

原句: "${pattern.original}"
模板: "${pattern.template}"
練習類型: ${practiceType}
語言: ${pattern.language}

請提供：
1. 具體的語法提示（不是泛泛而談）
2. 詞彙選擇的具體建議
3. 語言特定的語法規則提醒
4. 實用的記憶技巧

請以JSON格式回答：
{
  "hints": [
    "具體提示1",
    "具體提示2", 
    "具體提示3"
  ]
}`;

    const response = await this.safeAICall({
      action: 'getAIResponse',
      prompt: prompt,
      context: {
        type: 'hints_generation',
        pattern: pattern,
        exerciseType: practiceType
      }
    });

    if (response && response.success && response.text) {
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return result.hints || [];
        }
      } catch (error) {
        console.warn('Failed to parse AI hints:', error);
      }
    }

    return this.generateHints(pattern, practiceType);
  }

  /**
   * 使用AI生成智能範例
   */
  async generateAIExamples(pattern) {
    const prompt = `為以下句型生成3個具體的仿寫範例：

原句: "${pattern.original}"
模板: "${pattern.template}"
語言: ${pattern.language}

要求：
1. 範例必須遵循相同的語法結構
2. 使用不同但合適的詞彙
3. 保持語法正確性
4. 提供簡短解釋說明替換了什麼

請以JSON格式回答：
{
  "examples": [
    {
      "sentence": "範例句子1",
      "explanation": "解釋替換了什麼部分"
    },
    {
      "sentence": "範例句子2", 
      "explanation": "解釋替換了什麼部分"
    },
    {
      "sentence": "範例句子3",
      "explanation": "解釋替換了什麼部分"
    }
  ]
}`;

    const response = await this.safeAICall({
      action: 'getAIResponse',
      prompt: prompt,
      context: {
        type: 'examples_generation',
        pattern: pattern
      }
    });

    if (response && response.success && response.text) {
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return result.examples || [];
        }
      } catch (error) {
        console.warn('Failed to parse AI examples:', error);
      }
    }

    return this.generateExamples(pattern);
  }

  /**
   * 評估用戶的仿寫練習
   */
  async evaluateImitation(userSentence, pattern, exerciseType) {
    console.log('🔧 Using basic evaluation only (AI disabled)');
    
    // 只進行基本評估，跳過AI評估以避免凍結
    const basicEvaluation = this.performBasicEvaluation(userSentence, pattern, exerciseType);
    
    return basicEvaluation;
  }

  /**
   * 執行基本評估（非AI）
   */
  performBasicEvaluation(userSentence, pattern, exerciseType) {
    const evaluation = {
      score: 0,
      feedback: [],
      corrections: [],
      strengths: [],
      suggestions: [],
      isAI: false
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

    // 生成基本的優缺點分析
    evaluation.strengths = this.generateBasicStrengths(userSentence, pattern);
    evaluation.suggestions = this.generateBasicSuggestions(userSentence, pattern, exerciseType);

    // 生成鼓勵性反饋
    evaluation.encouragement = this.generateEncouragement(evaluation.score);

    return evaluation;
  }

  /**
   * 使用AI進行深度評估
   */
  async performAIEvaluation(userSentence, pattern, exerciseType) {
    // 構建AI評估提示
    const prompt = this.buildAIEvaluationPrompt(userSentence, pattern, exerciseType);
    
    // 發送到AI服務
    const response = await this.safeAICall({
      action: 'getAIResponse',
      prompt: prompt,
      context: {
        type: 'imitation_practice_evaluation',
        originalSentence: pattern.original,
        userSentence: userSentence,
        exerciseType: exerciseType
      }
    });

    if (response && response.success && response.text) {
      return this.parseAIEvaluation(response.text);
    }

    return null;
  }

  /**
   * 構建AI評估提示詞
   */
  buildAIEvaluationPrompt(userSentence, pattern, exerciseType) {
    const exerciseTypeNames = {
      substitution: '替換練習',
      expansion: '擴展練習', 
      transformation: '轉換練習',
      contextual: '情境練習'
    };

    const practiceType = exerciseTypeNames[exerciseType] || exerciseType;
    const language = this.detectLanguageFromPattern(pattern);
    const languageInstructions = this.getLanguageSpecificInstructions(language);

    return `你是一位專業的${language === 'dutch' ? '荷蘭語' : language === 'japanese' ? '日語' : '英語'}語言學習教師，請嚴格評估學生的仿寫練習答案。

**練習類型**: ${practiceType}
**語言**: ${language === 'dutch' ? '荷蘭語' : language === 'japanese' ? '日語' : '英語'}
**原始句子**: ${pattern.original}
**句型模板**: ${pattern.template}
**學生答案**: ${userSentence}

${languageInstructions}

**評估標準** (請嚴格評分)：
1. **語法正確性** (0-30分)：檢查語法錯誤、動詞時態、詞性搭配等
2. **句型符合度** (0-30分)：是否正確使用了原句的句型結構，保留了固定詞彙
3. **詞彙選擇** (0-20分)：詞彙是否恰當、是否符合語境
4. **表達流暢性** (0-20分)：句子是否自然流暢

**重要**: 如果學生答案與原句型結構差異很大，或者有明顯語法錯誤，請給予較低分數 (30-50分)。

請以JSON格式回答：
{
  "score": 45,
  "strengths": ["嘗試了練習", "部分詞彙正確"],
  "corrections": ["句型結構不符合原句", "語法錯誤：...", "應該保留固定結構詞"],
  "suggestions": ["請仔細觀察原句的固定結構", "建議重新練習句型模板"],
  "detailedFeedback": "答案與原句型結構差異較大，需要重新理解句型要求...",
  "encouragement": "繼續練習，注意保持原句的基本結構！"
}`;
  }

  /**
   * 獲取語言特定評估指導
   */
  getLanguageSpecificInstructions(language) {
    switch(language) {
      case 'dutch':
        return `**荷蘭語特別注意**:
- V2規則：動詞在第二個位置
- 語序：主語-動詞-賓語的基本順序
- 固定短語和慣用表達不應隨意更改
- 如果原句是疑問句或特殊句型，學生答案應保持相同結構`;
      
      case 'japanese':
        return `**日語特別注意**:
- SOV語序：主語-賓語-動詞
- 敬語和謙讓語的使用
- 動詞活用的正確性
- 助詞(は、が、を、に等)的正確使用`;
      
      default:
        return `**英語特別注意**:
- SVO語序：主語-動詞-賓語
- 時態一致性
- 冠詞使用(a, an, the)
- 主謂一致`;
    }
  }

  /**
   * 解析AI評估結果
   */
  parseAIEvaluation(aiResponse) {
    try {
      // 嘗試從回應中提取JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]);
        evaluation.isAI = true;
        evaluation.feedback = evaluation.detailedFeedback ? [evaluation.detailedFeedback] : [];
        return evaluation;
      }
    } catch (error) {
      console.warn('Failed to parse AI evaluation:', error);
    }
    
    // 如果JSON解析失敗，嘗試簡單文本分析
    return this.parseAITextResponse(aiResponse);
  }

  /**
   * 解析AI文字回應
   */
  parseAITextResponse(text) {
    const evaluation = {
      score: 75, // 預設分數
      strengths: [],
      corrections: [],
      suggestions: [],
      feedback: [text],
      encouragement: '很好的練習！',
      isAI: true
    };

    // 簡單的關鍵詞分析來估算分數
    if (text.includes('優秀') || text.includes('很好') || text.includes('正確')) {
      evaluation.score = 85;
    } else if (text.includes('錯誤') || text.includes('不正確') || text.includes('需要改進')) {
      evaluation.score = 60;
    }

    return evaluation;
  }

  /**
   * 合併AI評估和基本評估
   */
  mergeEvaluations(basicEval, aiEval) {
    return {
      score: aiEval.score || basicEval.score,
      strengths: aiEval.strengths && aiEval.strengths.length > 0 ? aiEval.strengths : basicEval.strengths,
      corrections: aiEval.corrections && aiEval.corrections.length > 0 ? aiEval.corrections : basicEval.corrections,
      suggestions: aiEval.suggestions && aiEval.suggestions.length > 0 ? aiEval.suggestions : basicEval.suggestions,
      feedback: aiEval.feedback && aiEval.feedback.length > 0 ? aiEval.feedback : basicEval.feedback,
      encouragement: aiEval.encouragement || basicEval.encouragement,
      isAI: true
    };
  }

  /**
   * 生成基本優點分析
   */
  generateBasicStrengths(userSentence, pattern) {
    const strengths = [];
    
    if (userSentence.length > 5) {
      strengths.push('句子長度適中');
    }
    
    if (userSentence.charAt(0) === userSentence.charAt(0).toUpperCase()) {
      strengths.push('正確使用大寫字母開頭');
    }
    
    if (/[.!?]$/.test(userSentence)) {
      strengths.push('正確使用標點符號');
    }
    
    if (userSentence.split(' ').length >= 3) {
      strengths.push('句子結構完整');
    }

    return strengths.length > 0 ? strengths : ['有勇氣嘗試練習'];
  }

  /**
   * 生成基本建議
   */
  generateBasicSuggestions(userSentence, pattern, exerciseType) {
    const suggestions = [];
    
    if (exerciseType === 'substitution') {
      suggestions.push('嘗試使用更多樣化的詞彙');
      suggestions.push('注意詞性的匹配');
    } else if (exerciseType === 'expansion') {
      suggestions.push('可以添加更多描述性的詞語');
      suggestions.push('嘗試加入時間或地點表達');
    } else if (exerciseType === 'transformation') {
      suggestions.push('檢查動詞時態的轉換是否正確');
      suggestions.push('注意句子結構的變化');
    } else if (exerciseType === 'contextual') {
      suggestions.push('考慮使用更符合情境的詞彙');
      suggestions.push('注意正式與非正式語調的差別');
    }
    
    return suggestions;
  }

  /**
   * 從句型模板檢測語言
   */
  detectLanguageFromPattern(pattern) {
    const original = pattern.original.toLowerCase();
    
    // 荷蘭語關鍵詞檢測
    if (original.match(/\b(het|de|een|is|zijn|mag|kan|wil|voorstellen|even)\b/)) {
      return 'dutch';
    }
    
    // 日語檢測
    if (original.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/)) {
      return 'japanese';
    }
    
    // 默認英語
    return 'english';
  }

  /**
   * 計算難度等級
   */
  calculateDifficulty(element) {
    // 基於元素類型判斷難度
    const difficultyMap = {
      '[verb phrase]': 'intermediate',
      '[past participle]': 'advanced',
      '[conditional]': 'advanced',
      '[comparative]': 'intermediate',
      '[pronoun]': 'beginner',
      '[noun]': 'beginner',
      '[adjective]': 'intermediate'
    };
    
    return difficultyMap[element] || 'intermediate';
  }

  /**
   * 基本語法檢查
   */
  checkGrammar(sentence) {
    const result = {
      score: 30, // 基本分數
      feedback: []
    };
    
    // 檢查基本格式
    if (sentence.length > 5 && sentence.includes(' ')) {
      result.score += 10;
      result.feedback.push('Sentence structure looks good');
    }
    
    // 檢查首字母大寫
    if (sentence[0] === sentence[0].toUpperCase()) {
      result.score += 5;
    }
    
    // 檢查標點符號
    if (sentence.match(/[.!?]$/)) {
      result.score += 5;
    }
    
    return result;
  }

  /**
   * 檢查句型匹配度
   */
  checkPatternMatch(userSentence, pattern) {
    const result = {
      score: 0,
      feedback: []
    };
    
    const language = this.detectLanguageFromPattern(pattern);
    const originalWords = pattern.original.toLowerCase().split(' ');
    const userWords = userSentence.toLowerCase().split(' ');
    const patternWords = pattern.template.split(' ').filter(w => !w.includes('['));
    
    // 檢查是否保留了固定的結構詞
    let structureMatchCount = 0;
    patternWords.forEach(word => {
      if (userWords.includes(word.toLowerCase())) {
        structureMatchCount++;
      }
    });
    
    // 如果結構詞匹配度太低，給予低分
    const structureMatchRatio = patternWords.length > 0 ? structureMatchCount / patternWords.length : 0;
    
    if (structureMatchRatio >= 0.8) {
      result.score += 25;
      result.feedback.push('Excellent pattern structure maintenance');
    } else if (structureMatchRatio >= 0.6) {
      result.score += 15;
      result.feedback.push('Good pattern structure');
    } else if (structureMatchRatio >= 0.3) {
      result.score += 8;
      result.feedback.push('Some pattern elements preserved');
    } else {
      result.score += 0;
      result.feedback.push('Pattern structure needs improvement');
    }
    
    // 語言特定檢查
    if (language === 'dutch') {
      result.score += this.checkDutchPatternMatch(userSentence, pattern);
    }
    
    return result;
  }

  /**
   * 荷蘭語特定的句型檢查
   */
  checkDutchPatternMatch(userSentence, pattern) {
    let additionalScore = 0;
    const userLower = userSentence.toLowerCase();
    const originalLower = pattern.original.toLowerCase();
    
    // 檢查基本荷蘭語語法
    if (originalLower.startsWith('mag ik') && !userLower.startsWith('mag')) {
      // 如果原句是"Mag ik..."但用戶沒有用"mag"開頭，嚴重扣分
      additionalScore -= 15;
    }
    
    // 檢查動詞位置 (V2規則)
    if (originalLower.includes('voorstellen') && !userLower.includes('voorstellen')) {
      // 如果原句的關鍵動詞被完全改變，扣分
      additionalScore -= 10;
    }
    
    return additionalScore;
  }

  /**
   * 根據練習類型檢查
   */
  checkByExerciseType(userSentence, pattern, exerciseType) {
    const result = {
      score: 10,
      feedback: []
    };
    
    switch(exerciseType) {
      case 'substitution':
        if (userSentence.split(' ').length >= pattern.original.split(' ').length - 2) {
          result.score += 10;
          result.feedback.push('Good substitution practice');
        }
        break;
      case 'expansion':
        if (userSentence.length > pattern.original.length) {
          result.score += 10;
          result.feedback.push('Nice expansion of the sentence');
        }
        break;
      case 'transformation':
        result.score += 10;
        result.feedback.push('Transformation attempted');
        break;
      case 'contextual':
        result.score += 10;
        result.feedback.push('Context adaptation noted');
        break;
    }
    
    return result;
  }

  /**
   * 生成鼓勵性反饋
   */
  generateEncouragement(score) {
    if (score >= 80) {
      return '🎉 Excellent work! Your sentence is very well constructed.';
    } else if (score >= 60) {
      return '👍 Good job! Keep practicing to improve further.';
    } else {
      return '💪 Keep trying! Practice makes perfect.';
    }
  }

  /**
   * 識別擴展點
   */
  identifyExpansionPoints(sentence) {
    const words = sentence.split(' ');
    const positions = [];
    
    // 在名詞前可以加形容詞
    words.forEach((word, index) => {
      if (index > 0 && /^[A-Z]/.test(word)) {
        positions.push({ index: index, type: 'adjective' });
      }
    });
    
    return positions;
  }

  /**
   * 獲取語域提示
   */
  getRegisterTips(register) {
    const tips = {
      formal: ['Use complete sentences', 'Avoid contractions', 'Use formal vocabulary'],
      informal: ['Can use contractions', 'Shorter sentences are OK', 'Casual expressions allowed'],
      academic: ['Use precise terminology', 'Cite sources if needed', 'Objective tone'],
      professional: ['Clear and concise', 'Action-oriented', 'Polite tone']
    };
    
    return tips[register] || [];
  }

  /**
   * 生成練習範例
   */
  generateExamples(pattern) {
    const examples = [];
    const template = pattern.template;
    const original = pattern.original;
    
    // 根據不同的句型生成具體範例
    if (template.includes('[article]') && template.includes('[noun]') && template.includes('[verb]') && template.includes('[adjective]')) {
      // 荷蘭語 "Het/De + noun + is/zijn + adjective" 句型
      examples.push({
        sentence: 'De film is interessant',
        explanation: '將 "feestje" 替換為 "film"，"gezellig" 替換為 "interessant"'
      });
      examples.push({
        sentence: 'Het boek is saai',
        explanation: '將 "feestje" 替換為 "boek"，"gezellig" 替換為 "saai"'
      });
      examples.push({
        sentence: 'De muziek is geweldig',
        explanation: '將 "feestje" 替換為 "muziek"，"gezellig" 替換為 "geweldig"'
      });
    } 
    else if (template.includes('[verb phrase]')) {
      // 英語動詞短語句型
      examples.push({
        sentence: template.replace('[verb phrase]', 'learn a new language'),
        explanation: '使用 "learn a new language" 作為動詞短語'
      });
      examples.push({
        sentence: template.replace('[verb phrase]', 'visit my family'),
        explanation: '使用 "visit my family" 作為動詞短語'
      });
    }
    else if (template.includes('[condition]') && template.includes('[result]')) {
      // 條件句句型
      examples.push({
        sentence: template.replace('[condition]', 'I have more time').replace('[result]', 'I will exercise regularly'),
        explanation: '條件句：有時間就會定期運動'
      });
      examples.push({
        sentence: template.replace('[condition]', 'the weather is nice').replace('[result]', 'we can go hiking'),
        explanation: '條件句：天氣好就可以去遠足'
      });
    }
    else if (template.includes('[comparative]')) {
      // 比較級句型
      examples.push({
        sentence: template.replace(/\[comparative\]/g, 'more').replace(/\[verb\]/g, 'study'),
        explanation: '比較級句型：學習越多，進步越大'
      });
    }
    else {
      // 通用範例 - 基於原句生成相似結構的例子
      const words = original.split(' ');
      if (words.length <= 4) {
        // 短句範例
        examples.push({
          sentence: '保持相同的語法結構，但改變具體內容',
          explanation: '例如：改變名詞、形容詞或動詞，但保持句子結構不變'
        });
        examples.push({
          sentence: '注意詞性匹配和語法一致性',
          explanation: '確保替換的詞語在語法上正確'
        });
      } else {
        // 長句範例
        examples.push({
          sentence: '分解句子結構，識別主要成分',
          explanation: '主語 + 謂語 + 賓語的基本結構'
        });
        examples.push({
          sentence: '保持時態和語態一致',
          explanation: '確保動詞時態與原句相符'
        });
      }
    }
    
    return examples.slice(0, 3); // 限制最多3個範例
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

  /**
   * 本地句型分析 (無AI依賴)
   */
  generateLocalPattern(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    console.log('🔧 Manager generating local pattern for:', text);
    
    // Specific analysis for "Het feestje is gezellig"
    if (text.includes('het') && text.includes('feestje') && text.includes('is') && text.includes('gezellig')) {
      return {
        template: '[het/de] [名詞] [is/zijn] [形容詞]',
        grammarPoints: [
          '荷蘭語基本句型: 冠詞 + 名詞 + 動詞 + 形容詞',
          '\"het\" 是中性冠詞，用於中性名詞',
          '\"is\" 是單數第三人稱動詞',
          '形容詞在句末作表語'
        ],
        language: 'dutch',
        complexity: 'beginner',
        analysis: '這是一個荷蘭語的基本敘述句，使用 het + 名詞 + is + 形容詞 的結構來描述事物的特徵。'
      };
    }
    
    // Generic Dutch pattern analysis
    if (sentenceData.language === 'dutch' || this.detectLanguage(text) === 'dutch') {
      return {
        template: '[主詞] [動詞] [補語]',
        grammarPoints: [
          '荷蘭語基本句型結構',
          'V2規則: 動詞在第二位置',
          '基本語序: 主詞-動詞-其他成分'
        ],
        language: 'dutch',
        complexity: 'intermediate',
        analysis: '這是荷蘭語的基本句型結構。'
      };
    }
    
    // English pattern
    if (sentenceData.language === 'english' || this.detectLanguage(text) === 'english') {
      return {
        template: '[Subject] [Verb] [Object/Complement]',
        grammarPoints: [
          '英語基本句型: 主詞 + 動詞 + 受詞/補語',
          'SVO語序結構',
          '注意主謂一致'
        ],
        language: 'english',
        complexity: 'beginner',
        analysis: '這是英語的基本句型結構。'
      };
    }
    
    // Default fallback
    return {
      template: '[詞彙1] [詞彙2] [詞彙3]',
      grammarPoints: ['基本句型分析'],
      language: 'unknown',
      complexity: 'intermediate',
      analysis: '基本句型結構分析。'
    };
  }

  /**
   * 本地詞彙建議生成 (無AI依賴)
   */
  generateLocalSuggestions(sentenceData) {
    const text = sentenceData.text.toLowerCase();
    console.log('🔧 Manager generating local suggestions for:', text);
    
    // Specific suggestions for "Het feestje is gezellig"
    if (text.includes('het') && text.includes('feestje') && text.includes('is') && text.includes('gezellig')) {
      return [
        {
          original: 'Het',
          type: '冠詞',
          alternatives: ['De', 'Een'],
          explanation: '荷蘭語冠詞 - het(中性), de(陽性/陰性), een(不定冠詞)'
        },
        {
          original: 'feestje',
          type: '名詞',
          alternatives: ['vergadering', 'gesprek', 'concert', 'evenement'],
          explanation: '可替換為其他活動名詞'
        },
        {
          original: 'is',
          type: '動詞',
          alternatives: ['was', 'wordt', 'blijft'],
          explanation: '連繫動詞，可用不同時態或狀態動詞'
        },
        {
          original: 'gezellig',
          type: '形容詞',
          alternatives: ['interessant', 'leuk', 'saai', 'druk'],
          explanation: '描述性形容詞，可用其他情感或特徵形容詞替換'
        }
      ];
    }
    
    // Generic Dutch suggestions
    if (sentenceData.language === 'dutch' || this.detectLanguage(text) === 'dutch') {
      const words = text.split(' ');
      return words.map((word, index) => ({
        original: word,
        type: '詞彙',
        alternatives: ['替代詞1', '替代詞2'],
        explanation: `第${index + 1}個詞彙的替換建議`
      }));
    }
    
    // Default fallback
    const words = text.split(' ');
    return words.map((word, index) => ({
      original: word,
      type: 'word',
      alternatives: ['alternative1', 'alternative2'],
      explanation: `Replacement suggestions for word ${index + 1}`
    }));
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImitationPracticeManager;
}