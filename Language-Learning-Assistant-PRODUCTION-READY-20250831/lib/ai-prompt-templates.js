/**
 * AI Prompt Templates for Different Interface Languages
 * Supports bilingual AI analysis responses
 */

class AIPromptTemplates {
  
  // Template data structure for different languages
  static templates = {
    // Traditional Chinese (existing)
    'zh_TW': {
      name: '繁體中文',
      
      // Common UI elements
      ui: {
        translation: '中文翻譯',
        pronunciation: '發音',
        partOfSpeech: '詞性',
        examples: '例句',
        grammar: '語法結構',
        usage: '使用情境',
        culture: '文化小知識',
        practice: '立即應用',
        similarExamples: '類似例句 - 延伸練習',
        dialogue: '情境對話',
        wordAnalysis: '逐詞解釋',
        useCase: '使用場景'
      },
      
      // Language analysis headers
      headers: {
        learningConsultant: '🌟 {langName}學習顧問 - 深度對話式分析',
        greeting: '嗨！我是你的{langName}學習夥伴。今天我們要一起深入探討「{text}」，我會用對話的方式讓學習變得更有趣！',
        wordAnalysis: '來深入了解一下{langName}單詞「{text}」吧！',
        sentenceAnalysis: '讓我們一起來拆解{langName}這句話「{text}」！'
      },
      
      // Instruction phrases
      instructions: {
        conciseResponse: '請簡潔回應，每項1-2句話即可。',
        conversationalTone: '請用對話的方式回答，就像朋友間聊天一樣自然！',
        friendlyTeacher: '請用友善對話的語調解釋，像老師和學生聊天一樣！',
        relaxedDiscussion: '請用輕鬆對話的方式回答，就像在和朋友討論語言學習心得！'
      }
    },
    
    // English
    'en': {
      name: 'English',
      
      // Common UI elements
      ui: {
        translation: 'Translation',
        pronunciation: 'Pronunciation',
        partOfSpeech: 'Part of Speech',
        examples: 'Examples',
        grammar: 'Grammar Structure',
        usage: 'Usage Context',
        culture: 'Cultural Notes',
        practice: 'Immediate Application',
        similarExamples: 'Similar Examples - Practice Extension',
        dialogue: 'Scenario Dialogue',
        wordAnalysis: 'Word-by-Word Analysis',
        useCase: 'Use Cases'
      },
      
      // Language analysis headers
      headers: {
        learningConsultant: '🌟 {langName} Learning Consultant - In-Depth Conversational Analysis',
        greeting: 'Hi! I\'m your {langName} learning partner. Today we\'ll explore "{text}" together in a conversational way to make learning more engaging!',
        wordAnalysis: 'Let\'s dive deep into the {langName} word "{text}"!',
        sentenceAnalysis: 'Let\'s break down this {langName} sentence "{text}" together!'
      },
      
      // Instruction phrases
      instructions: {
        conciseResponse: 'Please respond concisely, 1-2 sentences per item.',
        conversationalTone: 'Please respond conversationally, like chatting with a friend naturally!',
        friendlyTeacher: 'Please explain in a friendly conversational tone, like a teacher chatting with a student!',
        relaxedDiscussion: 'Please respond in a relaxed conversational way, like discussing language learning insights with a friend!'
      }
    }
  };
  
  // Language name mapping for content analysis
  static languageNames = {
    'zh_TW': {
      'english': '英語',
      'dutch': '荷蘭語',
      'japanese': '日語',
      'korean': '韓語'
    },
    'en': {
      'english': 'English',
      'dutch': 'Dutch', 
      'japanese': 'Japanese',
      'korean': 'Korean'
    }
  };
  
  // Get template for specific interface language
  static getTemplate(interfaceLanguage) {
    return this.templates[interfaceLanguage] || this.templates['zh_TW'];
  }
  
  // Get language name in specific interface language
  static getLanguageName(contentLanguage, interfaceLanguage) {
    const names = this.languageNames[interfaceLanguage] || this.languageNames['zh_TW'];
    return names[contentLanguage] || contentLanguage;
  }
  
  // Replace template variables
  static replaceVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
  
  // Get structured analysis sections for a specific language
  static getAnalysisSections(interfaceLanguage) {
    const template = this.getTemplate(interfaceLanguage);
    
    if (interfaceLanguage === 'en') {
      return {
        // Simple prompt sections
        simple: {
          word: {
            translation: `📝 **${template.ui.translation}**: [translation]`,
            pronunciation: `🗣️ **${template.ui.pronunciation}**: [pronunciation tips]`, 
            partOfSpeech: `📚 **${template.ui.partOfSpeech}**: [explain part of speech usage]`,
            example: `🌟 **One Life Example**: [practical example]`
          },
          sentence: {
            translation: `💬 **Natural ${template.ui.translation}**: In everyday language, this means...`,
            keyWords: `🔍 **Key Vocabulary**: [pick a few important words to explain]`,
            structure: `📐 **Sentence Structure**: Let's see how this sentence is organized`,
            useCase: `🌍 **When You'd Hear This**: [usage context]`
          }
        },
        
        // Medium prompt sections
        medium: {
          word: {
            translation: `💬 **${template.ui.translation} & Meaning**: Let me tell you what this word means...`,
            pronunciation: `🎵 **Pronunciation Tips**: [IPA phonetics] + pronunciation tricks`,
            partOfSpeech: `📚 **${template.ui.partOfSpeech} Analysis**: This is a [part of speech], typically used like this...`,
            examples: `🌟 **Practical Examples**: [2 life-like examples]`,
            variations: `🔄 **Word Forms**: [important variations, explained conversationally]`,
            timing: `💼 **When to Use**: What occasions are suitable...`,
            dutchOriginalMethod: `🇳🇱 **Dutch Original Text Method**:
   **✍️ Original Example**: "[Complete Dutch sentence showing actual usage context]"
   **🔤 Word-by-Word Analysis**: [break down each word, marking parts of speech and functions]
   **📖 Practical Sentence Pattern**: "When you want to [specific context], you can say: '[practical Dutch sentence]'"
   **💡 Memory Technique**: Suggest remembering it this way: [specific memory method]
   **🎭 Scene Recreation**: Next time when you..., naturally say "[Dutch application sentence]"`
          },
          sentence: {
            meaning: `💬 **Overall Meaning**: In natural Chinese, this means...`,
            keyWords: `🧩 **Key Vocabulary**: Let me explain the important words one by one...`,
            structure: `🗣️ **Pronunciation Focus**: Pay attention to the tone in these places...`,
            context: `🎯 **Usage Context**: When would you hear this sentence...`,
            culture: `🌏 **Cultural Knowledge**: About the background of this sentence...`
          }
        }
      };
    }
    
    // Default to Chinese sections (繁體中文)
    return {
      // Simple prompt sections for Chinese
      simple: {
        word: {
          translation: `📝 **${template.ui.translation}**: [翻譯內容]`,
          pronunciation: `🗣️ **${template.ui.pronunciation}**: [發音提示]`, 
          partOfSpeech: `📚 **${template.ui.partOfSpeech}**: [解釋詞性用途]`,
          example: `🌟 **一個生活例句**: [實用例句]`
        },
        sentence: {
          translation: `💬 **自然${template.ui.translation}**: 用日常用語來說就是...`,
          keyWords: `🔍 **重點詞彙**: [挑幾個重要的詞解釋]`,
          structure: `📐 **句子結構**: 讓我們看看這句話是怎麼組織的`,
          useCase: `🌍 **什麼時候會聽到這句**: [使用情境]`
        }
      },
      
      // Medium prompt sections for Chinese
      medium: {
        word: {
          translation: `💬 **${template.ui.translation}與含意**: 讓我告訴你這個詞的意思...`,
          pronunciation: `🎵 **發音秘訣**: [IPA音標] + 發音小技巧`,
          partOfSpeech: `📚 **${template.ui.partOfSpeech}解析**: 這是個[詞性]，通常這樣用...`,
          examples: `🌟 **實際例句**: [2個生活化例句]`,
          variations: `🔄 **詞形變化**: [重要變化，用對話方式說明]`,
          timing: `💼 **使用時機**: 什麼場合用比較合適...`,
          dutchOriginalMethod: `🇳🇱 **荷蘭語原文使用方法**:
   **✍️ 原文例句**: 「[荷蘭語完整例句，展示實際使用情境]」
   **🔤 逐詞解析**: [逐詞分解，標註詞性和功能]
   **📖 實用句型**: 「當你想要[具體情境]時，可以說：'[荷蘭語實用句子]'」
   **💡 記憶技巧**: 建議這樣記憶：[具體記憶方法，如聯想法、詞根法等]
   **🎭 場景重現**: 下次當你...時，自然地說出「[荷蘭語應用句]」`
        },
        sentence: {
          meaning: `💬 **整句意思**: 用自然的中文來說...`,
          keyWords: `🧩 **關鍵詞彙**: 讓我逐一解釋重要的詞...`,
          structure: `🗣️ **發音重點**: 注意這些地方的語調...`,
          context: `🎯 **使用情境**: 你會在什麼時候聽到這句話...`,
          culture: `🌏 **文化小知識**: 關於這句話的背景...`
        }
      }
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIPromptTemplates;
}