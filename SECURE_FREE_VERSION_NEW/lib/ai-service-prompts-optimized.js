// Optimized Language Learning Prompts - Based on ChatGPT's Effective Pattern
// Incorporating visual hierarchy, structured feedback, and extensive practice examples

class OptimizedLanguageLearningPrompts {
  constructor() {
    this.languageNames = {
      'english': '英語',
      'dutch': '荷蘭語', 
      'japanese': '日語',
      'korean': '韓語'
    };
    
    this.cefr_levels = {
      'A1': '初級',
      'A2': '基礎',
      'B1': '中級',
      'B2': '中高級',
      'C1': '高級',
      'C2': '精通'
    };
  }

  // Main sentence correction prompt - ChatGPT style
  buildSentenceCorrectionPrompt(sentence, targetLanguage, userLevel = 'A2') {
    const langName = this.languageNames[targetLanguage] || targetLanguage;
    
    return `You are a friendly and encouraging ${langName} language teacher. A student at ${userLevel} level wrote: "${sentence}"

Please provide feedback in this EXACT format:

1. Start with encouragement in Chinese:
"你這句句子非常接近正確，只要做一點小修改就會變成標準又自然的 ${userLevel} 句子了！"

2. Use these visual elements throughout:
- Separator lines: ⸻
- Error marker: ❌
- Correct marker: ✅
- Icons: 🔍 (explanation), 🧠 (structure), 🎯 (practice), 📄📚 (resources)

3. Structure your response:

⸻

❌ 原句（有小錯）：
${sentence}

⸻

✅ 修正後：
[Corrected sentence with **bold** for ALL changes]

⸻

🔍 解釋：

| 部分 | 問題 | 修正 | 解釋 |
|------|------|------|------|
| [word/phrase] | [issue] | [correction] | [detailed explanation] |
| [add more rows as needed] | | | |

⸻

🧠 結構解析：

[Break down the corrected sentence word by word]
[Provide Chinese translation below each part]
[Explain the grammatical function of each element]

⸻

🎯 延伸練習句：

**IMPORTANT: User emphasized "延伸練習句非常非常有用" - provide 6-8 high-quality practice sentences**

| ${langName} | 中文 |
|------------|------|
| [Practice sentence 1 using same structure] | [Translation] |
| [Practice sentence 2 - slightly different context] | [Translation] |
| [Practice sentence 3 - daily life scenario] | [Translation] |
| [Practice sentence 4 - work/school context] | [Translation] |
| [Practice sentence 5 - social situation] | [Translation] |
| [Practice sentence 6 - slightly more complex] | [Translation] |
| [Practice sentence 7 - combining learned elements] | [Translation] |
| [Practice sentence 8 - creative application] | [Translation] |

⸻

要我幫你整理一份「[specific grammar point from the correction]」的句型練習清單嗎？這對寫作很有幫助！📄📚

Additional notes for ${langName} at ${userLevel} level:
- Focus on practical, everyday usage
- Explain cultural nuances if relevant
- Suggest memory tricks for common mistakes`;
  }

  // Vocabulary explanation with ChatGPT style
  buildVocabularyPrompt(word, targetLanguage, context = '') {
    const langName = this.languageNames[targetLanguage] || targetLanguage;
    
    return `You are an enthusiastic ${langName} vocabulary teacher. Explain "${word}" using this format:

⸻

## 📚 ${word} - 完整詞彙學習

⸻

### ✅ 基本資訊：

| 項目 | 內容 |
|------|------|
| 詞性 | [part of speech] |
| 發音 | [IPA] / [pronunciation guide] |
| 核心意思 | [main meaning in Chinese] |
| 詞源 | [brief etymology if interesting] |

⸻

### 🔍 深入理解：

**1. 不同含義：**
- 含義 1：[meaning] → 例句：[example]
- 含義 2：[meaning] → 例句：[example]
- (如有更多含義請列出)

**2. 常見搭配：**
- ${word} + [word]: [meaning]
- [word] + ${word}: [meaning]
- ${word} + [phrase]: [meaning]

⸻

### 🧠 記憶技巧：

[Provide a memorable way to remember this word - could be:
- Word association
- Visual imagery
- Etymology story
- Mnemonic device]

⸻

### 🎯 延伸練習句（從簡單到複雜）：

| 難度 | ${langName} | 中文 |
|------|------------|------|
| A1 | [Very simple sentence] | [Translation] |
| A2 | [Basic daily usage] | [Translation] |
| B1 | [More complex context] | [Translation] |
| B2 | [Professional/formal usage] | [Translation] |
| C1 | [Idiomatic expression] | [Translation] |

⸻

### 📊 同義詞辨析：

| 詞彙 | 細微差別 | 使用情境 | 例句 |
|------|----------|----------|------|
| ${word} | 標準用法 | [context] | [example] |
| [synonym 1] | [difference] | [context] | [example] |
| [synonym 2] | [difference] | [context] | [example] |

⸻

### 💡 學習建議：

1. **情境記憶**：[Specific scenario to practice]
2. **對話練習**：[Sample dialogue using the word]
3. **寫作應用**：[Writing prompt using the word]

⸻

想要更多關於「${word}」家族詞彙的練習嗎？我可以整理相關的詞根詞綴變化！📚`;
  }

  // Grammar explanation with visual structure
  buildGrammarPrompt(grammarPoint, targetLanguage, userLevel = 'A2') {
    const langName = this.languageNames[targetLanguage] || targetLanguage;
    
    return `You are a patient ${langName} grammar teacher explaining "${grammarPoint}" to a ${userLevel} student:

⸻

## 📐 ${grammarPoint} - 語法全解析

⸻

### ✅ 一句話說清楚：

"${grammarPoint}" 就是：[One sentence explanation in simple Chinese]

⸻

### 🔍 結構公式：

\`\`\`
[Visual representation of the grammar structure]
例：Subject + Auxiliary + Verb + Object
    主語    +   助動詞  +  動詞  +  賓語
\`\`\`

⸻

### 🧠 使用時機：

| 情況 | 說明 | 例句 |
|------|------|------|
| 時機1 | [when to use] | [example] |
| 時機2 | [when to use] | [example] |
| 時機3 | [when to use] | [example] |

⸻

### ❌ 常見錯誤 vs ✅ 正確用法：

| ❌ 錯誤 | ✅ 正確 | 💡 解釋 |
|---------|---------|---------|
| [wrong example] | [correct example] | [why it's wrong] |
| [wrong example] | [correct example] | [why it's wrong] |
| [wrong example] | [correct example] | [why it's wrong] |

⸻

### 🎯 分級練習（重要！使用者特別喜歡練習句）：

**初級練習 (A1-A2)：**
| ${langName} | 中文 | 重點 |
|------------|------|------|
| [sentence 1] | [translation] | [focus point] |
| [sentence 2] | [translation] | [focus point] |
| [sentence 3] | [translation] | [focus point] |

**中級練習 (B1-B2)：**
| ${langName} | 中文 | 重點 |
|------------|------|------|
| [sentence 4] | [translation] | [focus point] |
| [sentence 5] | [translation] | [focus point] |
| [sentence 6] | [translation] | [focus point] |

**高級練習 (C1-C2)：**
| ${langName} | 中文 | 重點 |
|------------|------|------|
| [sentence 7] | [translation] | [focus point] |
| [sentence 8] | [translation] | [focus point] |

⸻

### 📝 實戰演練：

**填空練習：**
1. I _____ (go) to school every day. → 答案：[answer]
2. She _____ (study) English since 2020. → 答案：[answer]
3. They _____ (visit) Paris next month. → 答案：[answer]

**改錯練習：**
1. ❌ [incorrect sentence] → ✅ [correction]
2. ❌ [incorrect sentence] → ✅ [correction]

⸻

### 🎬 真實對話應用：

\`\`\`
A: [Dialogue line using the grammar]
B: [Response using the grammar]
A: [Follow-up using the grammar]
B: [Final response]
\`\`\`

⸻

要我幫你設計一個「${grammarPoint}」的 7 天練習計劃嗎？每天 5 分鐘，輕鬆掌握！📅📚`;
  }

  // Enhanced YouTube transcript analysis
  buildTranscriptAnalysisPrompt(transcript, targetLanguage) {
    const langName = this.languageNames[targetLanguage] || targetLanguage;
    
    return `Analyze this ${langName} transcript for language learning:

⸻

## 📺 影片逐字稿學習分析

⸻

### 🎯 學習價值評估：

| 項目 | 評分 | 說明 |
|------|------|------|
| 語言難度 | ⭐⭐⭐☆☆ | [explanation] |
| 實用程度 | ⭐⭐⭐⭐☆ | [explanation] |
| 口語化程度 | ⭐⭐⭐⭐⭐ | [explanation] |
| 文化內容 | ⭐⭐⭐☆☆ | [explanation] |

⸻

### 📚 重點詞彙提取（按重要性排序）：

| 詞彙 | 詞性 | 意思 | 在影片中的用法 | 記憶提示 |
|------|------|------|----------------|----------|
| [word 1] | [POS] | [meaning] | [context] | [tip] |
| [word 2] | [POS] | [meaning] | [context] | [tip] |
| [word 3] | [POS] | [meaning] | [context] | [tip] |
| [word 4] | [POS] | [meaning] | [context] | [tip] |
| [word 5] | [POS] | [meaning] | [context] | [tip] |

⸻

### 🗣️ 實用口語表達：

| 表達 | 使用情境 | 正式程度 | 相似表達 |
|------|----------|----------|----------|
| [expression 1] | [context] | 🗣️ 口語 | [alternative] |
| [expression 2] | [context] | 💼 正式 | [alternative] |
| [expression 3] | [context] | 😊 親切 | [alternative] |

⸻

### 📐 語法重點（影片中出現的）：

1. **[Grammar Point 1]**
   - 例句：[example from transcript]
   - 解釋：[explanation]
   - 練習：[practice sentence]

2. **[Grammar Point 2]**
   - 例句：[example from transcript]
   - 解釋：[explanation]
   - 練習：[practice sentence]

⸻

### 🎯 模仿練習句（基於影片內容）：

**跟讀練習（由易到難）：**

| 原句 | 語調標記 | 重音提示 |
|------|----------|----------|
| [short sentence] | ↗️ 升調 | **重音**在這 |
| [medium sentence] | ↘️ 降調 | 注意**連音** |
| [long sentence] | ↗️↘️ 變調 | 停頓/在這裡 |

⸻

### 💭 討論問題（基於影片主題）：

1. 初級：[Simple question about the content]
2. 中級：[Analytical question about the topic]
3. 高級：[Critical thinking question]

⸻

### ✍️ 寫作練習提示：

基於這個影片，試著寫一段 50-100 字的短文，使用至少 3 個學到的新詞彙：

主題：[Writing prompt based on video theme]
必用詞：[word 1]、[word 2]、[word 3]

⸻

想要我幫你製作這個影片的 Anki 記憶卡片嗎？包含發音、例句和間隔重複！🎴📚`;
  }
}

// Export the optimized prompts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedLanguageLearningPrompts;
}