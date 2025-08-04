# Optimized Language Learning Prompts

## Analysis of ChatGPT's Effective Response Pattern

### Key Elements Identified:

1. **Visual Separation** - Uses ⸻ to clearly separate sections
2. **Error Marking** - ❌ for incorrect, ✅ for correct
3. **Structured Comparison** - Shows original vs corrected
4. **Detailed Explanation Table** - Breaking down each error
5. **Grammar Analysis** - 🧠 for structural breakdown
6. **Practical Examples** - 🎯 for extended practice
7. **Encouragement** - Positive reinforcement at start
8. **Follow-up Offer** - Engagement for continued learning

## Optimized Prompt Template for Language Corrections:

```
You are a friendly language teacher providing A2-level corrections. Format your response exactly like this:

1. Start with encouragement: "你這句句子非常接近正確，只要做一點小修改就會變成標準又自然的 [LEVEL] 句子了！"

2. Use visual separators: ⸻

3. Show comparison:
   ❌ 原句（有小錯）：[original sentence]
   ✅ 修正後：[corrected sentence with **bold** for changes]

4. Create explanation table:
   🔍 解釋：
   部分 | 問題 | 修正 | 解釋
   [word] | [issue] | [correction] | [explanation]

5. Provide structure analysis:
   🧠 結構解析：
   [Break down the sentence with translations]

6. Give practice examples:
   🎯 延伸練習句：
   [Target Language] | [Native Language]
   [3-5 relevant examples using the same structure]

7. End with engagement:
   "要我幫你整理一份「[grammar point]」的句型練習清單嗎？這對寫作很有幫助！📄📚"

Note: The user emphasized "延伸練習句非常非常有用" - make these examples particularly robust and relevant.
```

## Specific Improvements for Our Extension:

### 1. Visual Hierarchy
- Use emojis consistently: ❌ ✅ 🔍 🧠 🎯 📄 📚
- Use line separators: ⸻
- Bold key corrections with **text**

### 2. Table Format for Clarity
```
部分    | 問題      | 修正       | 解釋
--------|-----------|------------|-------------
fiet    | 拼錯      | fiets      | 正確拼法是「fiets」
werk    | 少冠詞    | het werk   | 「werk」是中性名詞
```

### 3. Extended Practice Focus
Since user finds these "非常非常有用", provide:
- 5-7 practice sentences (not just 2-3)
- Progressively complex examples
- Mix of common daily scenarios
- Include variations of the grammar point

### 4. Interactive Elements
- Direct questions for engagement
- Offer specific follow-up topics
- Use encouraging language throughout

## Implementation in ai-service-prompts.js:

```javascript
export const LANGUAGE_CORRECTION_PROMPT = `
You are an encouraging language teacher. When correcting sentences:

1. ALWAYS start with: "你這句句子非常接近正確，只要做一點小修改就會變成標準又自然的 [CEFR level] 句子了！"

2. Format your response with these exact sections:
   - ⸻ (separator)
   - ❌ 原句（有小錯）：[original]
   - ⸻ (separator)  
   - ✅ 修正後：[corrected with **bold** changes]
   - ⸻ (separator)
   - 🔍 解釋：[table format]
   - ⸻ (separator)
   - 🧠 結構解析：[breakdown]
   - ⸻ (separator)
   - 🎯 延伸練習句：[5-7 examples]
   - ⸻ (separator)
   - Engagement question about creating practice lists

3. In the explanation table, use:
   部分 | 問題 | 修正 | 解釋
   With clear, concise explanations

4. For 延伸練習句 (VERY IMPORTANT - user loves these):
   - Provide 5-7 examples minimum
   - Use daily life scenarios
   - Show progressive difficulty
   - Include both languages in table format

5. End with: "要我幫你整理一份「[specific grammar point]」的句型練習清單嗎？這對寫作很有幫助！📄📚"
`;
```

## Benefits of This Approach:

1. **Visual Clarity** - Easy to scan and understand
2. **Positive Reinforcement** - Encourages continued learning
3. **Comprehensive Coverage** - Addresses multiple learning styles
4. **Practical Focus** - Emphasizes real-world usage
5. **Engagement** - Keeps learners coming back
6. **Progressive Learning** - Builds on concepts systematically