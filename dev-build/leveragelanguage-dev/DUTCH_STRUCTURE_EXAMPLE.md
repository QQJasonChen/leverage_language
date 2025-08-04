# 🇳🇱 Dutch Structure Analysis Enhancement Example

## Current Enhancement

I've enhanced the AI analysis system to provide specialized Dutch sentence structure analysis for your example "Vraag wat hij vanavond gaat doen".

### Enhanced Dutch Analysis Features

#### **🏗️ Detailed Grammar Analysis (Professional Mode)**
When using the detailed analysis complexity, Dutch sentences now get:

1. **V2語序規則** (V2 Word Order Rule)
   - Analyzes if the verb is in the second position
   - Explains how word order changes in subordinate clauses
   
2. **詞彙順序** (Word Order Patterns)
   - Time-Manner-Place (TMP) rule application
   - Word position logic explanation

3. **從句結構** (Subordinate Clause Structure)
   - Identifies subordinate clauses
   - Explains how verb position changes

4. **分離動詞** (Separable Verbs)
   - Detects separable verbs and prefix placement
   - Explains why prefixes are separated

5. **荷蘭語特殊語法點** (Dutch-Specific Grammar Points)
   - **de/het** article selection logic
   - Adjective inflection rules
   - Verb conjugation patterns
   - Preposition selection reasoning

#### **🔍 Sentence Structure Breakdown**
For your example "Vraag wat hij vanavond gaat doen":

```
Vraag (imperative verb) + wat (question word) + hij (subject) + vanavond (time) + gaat (auxiliary verb) + doen (infinitive)
```

The analysis will explain:
- Why "Vraag" comes first (imperative)
- How "wat hij vanavond gaat doen" forms an embedded question
- Why "gaat" comes before "doen" (auxiliary + infinitive)
- Time placement ("vanavond") in the middle field

#### **🎯 Medium Complexity Enhancement**
Even in medium complexity mode, Dutch sentences get:
- Basic word order analysis
- Verb position explanation
- Article choice logic
- Common structural patterns

## How to Use

1. **Set Analysis Complexity**: Go to extension settings
   - Choose "Detailed" for comprehensive Dutch structure analysis
   - Choose "Medium" for balanced analysis with Dutch features
   - "Auto" will intelligently select based on sentence complexity

2. **Analyze Dutch Text**: 
   - Paste your Dutch sentence into the extension
   - The AI will automatically detect it's Dutch
   - You'll receive specialized structural analysis

3. **Language Detection**: 
   - The system automatically detects Dutch vs other languages
   - Dutch-specific analysis only applies to Dutch text
   - Other languages get their appropriate analysis

## Example Analysis Output

For "Vraag wat hij vanavond gaat doen":

### 🇳🇱 荷蘭語句型結構分析：
- **V2語序規則**：主句中"Vraag"在第一位（祈使句），"wat hij vanavond gaat doen"是嵌入式疑問句，動詞"gaat"在從句中的位置符合荷蘭語語序規則
- **詞彙順序**：時間詞"vanavond"放在中間區域，符合荷蘭語Time-Manner-Place規則
- **從句結構**：包含嵌入式疑問句"wat hij ... gaat doen"，動詞"gaat"位置正確
- **動詞組合**：使用"gaat + 不定式"結構表達未來意圖

### 🔍 特別說明「Vraag wat hij vanavond gaat doen」的荷蘭語結構特色：
逐字分析：
- **Vraag** (祈使動詞) - 位於句首，祈使語氣
- **wat** (疑問詞) - 引導嵌入式疑問句
- **hij** (主語) - 嵌入句主語
- **vanavond** (時間副詞) - 置於中間區域，典型的荷蘭語時間詞位置
- **gaat** (助動詞) - 表達未來，配合不定式使用
- **doen** (不定式) - 動作動詞，位於句末

## Technical Implementation

The enhancement is added to the AI service (`lib/ai-service.js`) in these sections:

1. **Professional Prompt Builder** - Adds comprehensive Dutch analysis
2. **Medium Complexity Prompt** - Adds basic Dutch structure analysis  
3. **Language Detection** - Ensures Dutch-specific features only apply to Dutch text

This gives you much more detailed insight into Dutch sentence structure patterns that are often challenging for learners!