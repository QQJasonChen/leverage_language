// 改善的語言偵測，基於字符特徵和詞彙
function detectLanguage(text, preferredLanguage = null) {
  if (!text || text.length === 0) return { language: 'english', confidence: 'high' };
  
  // 移除空格和標點符號進行檢測
  const cleanText = text.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g, '');
  
  // 日文檢測 (平假名、片假名為最強指示)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(cleanText)) {
    return { language: 'japanese', confidence: 'high' };
  }
  
  // 韓文檢測 (韓文字符)
  if (/[\uac00-\ud7af]/.test(cleanText)) {
    return { language: 'korean', confidence: 'high' };
  }
  
  // 檢查是否為日文中的漢字 (更細緻的日文檢測)
  const hasKanji = /[\u4e00-\u9fff]/.test(cleanText);
  if (hasKanji) {
    // 日文常用詞彙 (包含漢字)
    const japaneseWords = [
      'です', 'である', 'した', 'して', 'する', 'なる', 'ある', 'いる', 'この', 'その', 'あの', 'どの',
      'こと', 'もの', 'ところ', 'とき', 'ひと', 'かた', 'たち', 'など', 'まで', 'から', 'より',
      '今日', '明日', '昨日', '今年', '去年', '来年', '今月', '先月', '来月', '今週', '先週', '来週',
      '時間', '時刻', '分間', '秒間', '午前', '午後', '朝', '昼', '夕方', '夜', '深夜',
      '日本', '東京', '大阪', '京都', '名古屋', '福岡', '仙台', '札幌', '広島', '神戸',
      '学校', '大学', '会社', '仕事', '勉強', '研究', '開発', '技術', '情報', 'システム',
      '問題', '課題', '解決', '方法', '手段', '手順', '過程', '結果', '成果', '効果',
      '重要', '必要', '可能', '不可能', '簡単', '複雑', '困難', '容易', '安全', '危険'
    ];
    
    const fullText = text.toLowerCase();
    const hasJapaneseWords = japaneseWords.some(word => fullText.includes(word));
    
    if (hasJapaneseWords) {
      return { language: 'japanese', confidence: 'high' };
    }
    
    // 日文語法模式檢測
    if (/[はがをにでとへのもよりまでから]/.test(text) || // 助詞
        /[だですであるました]/.test(text) || // 語尾
        /[という]/.test(text) || // 連接詞
        /[こそあど][のれ]/.test(text)) { // 指示詞
      return { language: 'japanese', confidence: 'high' };
    }
    
    // 如果包含中文字符但沒有明確的日文語法標誌，默認為日文 (99%的情況)
    // Chinese characters are 99% likely to be Japanese in this context
    return { language: 'japanese', confidence: 'medium' };
  }
  
  // 分割成詞彙進行檢測
  const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  
  // 荷蘭語特有詞彙 (高確定性)
  const dutchStrongWords = [
    'het', 'de', 'een', 'van', 'dat', 'die', 'zijn', 'hebben', 'worden', 'kunnen', 'moeten', 'willen', 'zullen',
    'naar', 'bij', 'uit', 'over', 'door', 'tegen', 'tussen', 'onder', 'zonder', 'tijdens', 'volgens', 'binnen',
    'buiten', 'vanaf', 'ondanks', 'behalve', 'naast', 'achter', 'voor', 'sinds', 'wegens', 'vanwege', 'dankzij',
    'waar', 'wanneer', 'waarom', 'wie', 'wat', 'welke', 'welk', 'hoe', 'hoeveel', 'hoeveelste',
    'gisteren', 'morgen', 'vandaag', 'vanavond', 'vannacht', 'vorige', 'volgende',
    'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag',
    'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december',
    'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf',
    'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien', 'twintig', 'dertig', 'veertig', 'vijftig',
    'zestig', 'zeventig', 'tachtig', 'negentig', 'honderd', 'duizend', 'miljoen', 'miljard',
    'ook', 'maar', 'want', 'dus', 'echter', 'daarom', 'bovendien', 'trouwens', 'namelijk', 'bijvoorbeeld',
    'misschien', 'waarschijnlijk', 'zeker', 'natuurlijk', 'inderdaad', 'eigenlijk', 'gewoon', 'helemaal',
    'iemand', 'niemand', 'iedereen', 'allemaal', 'niets', 'iets', 'alles', 'sommige', 'andere',
    'doen', 'gaan', 'komen', 'zien', 'weten', 'zeggen', 'maken', 'krijgen', 'geven', 'nemen', 'vinden',
    'denken', 'voelen', 'horen', 'kijken', 'lezen', 'schrijven', 'spreken', 'verstaan', 'begrijpen',
    'leren', 'werken', 'spelen', 'eten', 'drinken', 'slapen', 'wonen', 'leven',
    'ik', 'ben', 'bent', 'is', 'was', 'waren', 'geweest', 'mij', 'mijn', 'jij', 'jouw', 'hij', 'haar', 'huis',
    'gelukkig', 'mooi', 'groot', 'klein', 'goed', 'slecht', 'nieuw', 'oud', 'jong', 'veel', 'weinig'
  ];
  
  // 荷蘭語字符特徵
  const dutchCharacteristics = [
    /ij/g, /oe/g, /ui/g, /eu/g, /ou/g, /aa/g, /ee/g, /oo/g, /uu/g, // 雙母音
    /sch/g, /ng/g, /nk/g, /ch/g, /gh/g, // 子音組合
    /heid$/g, /lijk$/g, /baar$/g, /loos$/g, /vol$/g, // 後綴
    /ge.*d$/g, /ge.*t$/g, // 過去分詞
    /ver/g, /be/g, /ont/g, /her/g, /aan/g, /uit/g, /over/g, /door/g, /tegen/g, /onder/g // 前綴
  ];
  
  // 英語強烈指示詞
  const englishStrongWords = [
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
    'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
    'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'through', 'where', 'much', 'should', 'before', 'here', 'very', 'why', 'between', 'without', 'under', 'while', 'might',
    'something', 'someone', 'everyone', 'everything', 'nothing', 'anything', 'somewhere', 'anywhere', 'nowhere', 'everywhere',
    'are', 'is', 'was', 'were', 'been', 'being', 'am', 'children', 'playing', 'outside', 'house', 'store', 'happy'
  ];
  
  let dutchScore = 0;
  let englishScore = 0;
  
  // 檢查荷蘭語特有詞彙
  dutchStrongWords.forEach(word => {
    if (words.includes(word)) {
      dutchScore += 3; // 高權重
    }
  });
  
  // 檢查英語特有詞彙
  englishStrongWords.forEach(word => {
    if (words.includes(word)) {
      englishScore += 2; // 中等權重
    }
  });
  
  // 檢查荷蘭語字符特徵
  const fullText = text.toLowerCase();
  dutchCharacteristics.forEach(pattern => {
    const matches = fullText.match(pattern);
    if (matches) {
      dutchScore += matches.length * 1.5; // 字符特徵權重
    }
  });
  
  // 荷蘭語特有的雙母音和字符組合
  if (/\b\w*ij\w*\b/g.test(fullText)) dutchScore += 2;
  if (/\b\w*oe\w*\b/g.test(fullText)) dutchScore += 1.5;
  if (/\b\w*ui\w*\b/g.test(fullText)) dutchScore += 1.5;
  if (/\b\w*eu\w*\b/g.test(fullText)) dutchScore += 1.5;
  if (/\b\w*ou\w*\b/g.test(fullText)) dutchScore += 1;
  
  // 英語特有的模式
  if (/\b\w*ing\b/g.test(fullText)) englishScore += 1;
  if (/\b\w*ed\b/g.test(fullText)) englishScore += 1;
  if (/\b\w*tion\b/g.test(fullText)) englishScore += 1.5;
  if (/\b\w*ly\b/g.test(fullText)) englishScore += 1;
  if (/\bth\w+/g.test(fullText)) englishScore += 1;
  
  // 偏好語言加權 (當分數接近時給予額外權重)
  if (preferredLanguage && preferredLanguage !== 'none') {
    const scoreDifference = Math.abs(dutchScore - englishScore);
    
    // 如果分數接近（差異小於2），給偏好語言額外權重
    if (scoreDifference < 2) {
      const bonusWeight = 2 - scoreDifference; // 分數越接近，加權越多
      
      if (preferredLanguage === 'dutch') {
        dutchScore += bonusWeight;
      } else if (preferredLanguage === 'english') {
        englishScore += bonusWeight;
      }
    }
    
    // 特殊處理：如果偏好日語/韓語，且文本包含相關字符，提高檢測敏感度
    // 但只有在文本確實有亞洲語言特徵時才使用
    if (preferredLanguage === 'japanese' && hasKanji) {
      // 檢查是否有日語特徵
      const japaneseWords = [
        'です', 'である', 'した', 'して', 'する', 'なる', 'ある', 'いる', 'この', 'その', 'あの', 'どの',
        'こと', 'もの', 'ところ', 'とき', 'ひと', 'かた', 'たち', 'など', 'まで', 'から', 'より',
        '今日', '明日', '昨日', '今年', '去年', '来年', '今月', '先月', '来月', '今週', '先週', '来週',
        '時間', '時刻', '分間', '秒間', '午前', '午後', '朝', '昼', '夕方', '夜', '深夜',
        '日本', '東京', '大阪', '京都', '名古屋', '福岡', '仙台', '札幌', '広島', '神戸',
        '学校', '大学', '会社', '仕事', '勉強', '研究', '開発', '技術', '情報', 'システム',
        '問題', '課題', '解決', '方法', '手段', '手順', '過程', '結果', '成果', '効果',
        '重要', '必要', '可能', '不可能', '簡単', '複雑', '困難', '容易', '安全', '危険'
      ];
      
      const hasJapaneseFeatures = /[はがをにでとへのもよりまでから]/.test(text) || 
                                 /[だですであるました]/.test(text) || 
                                 /[という]/.test(text) || 
                                 /[こそあど][のれ]/.test(text) ||
                                 japaneseWords.some(word => text.includes(word));
      
      if (hasJapaneseFeatures) {
        return { language: 'japanese', confidence: 'high' };
      }
    }
    
    if (preferredLanguage === 'korean' && /[\uac00-\ud7af]/.test(text)) {
      return { language: 'korean', confidence: 'high' };
    }
  }
  
  // 決定語言（高信心檢測）
  if (dutchScore > englishScore && dutchScore > 1.5) {
    return { language: 'dutch', confidence: 'high' };
  }
  
  if (englishScore > dutchScore && englishScore > 1.5) {
    return { language: 'english', confidence: 'high' };
  }
  
  // 如果分數接近，使用額外的啟發式規則
  if (Math.abs(dutchScore - englishScore) < 1.5) {
    // 檢查是否有明顯的荷蘭語特徵
    if (/\b(het|de|een|van|dat|die|zijn|worden|kunnen|moeten|willen|zullen|ik|ben|gelukkig)\b/g.test(fullText)) {
      return { language: 'dutch', confidence: 'medium' };
    }
    
    // 檢查是否有明顯的英語特徵
    if (/\b(the|and|that|have|for|not|with|you|this|but|his|from|they|she|will|all|would|there|their|are|children|playing)\b/g.test(fullText)) {
      return { language: 'english', confidence: 'medium' };
    }
    
    // 如果還是無法確定，且有偏好語言，使用偏好語言
    // 但只有在文本沒有明顯其他語言特徵時才使用
    if (preferredLanguage && preferredLanguage !== 'none') {
      // 檢查是否有其他語言的明顯特徵
      const hasLatinScript = /[a-zA-Z]/.test(text);
      const hasKoreanScript = /[\uac00-\ud7af]/.test(text);
      const hasJapaneseScript = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
      
      // 如果偏好日語但文本主要是拉丁字母，不使用偏好語言
      if (preferredLanguage === 'japanese' && hasLatinScript && !hasJapaneseScript && !hasKanji) {
        return { language: 'uncertain', candidates: ['english', 'japanese', 'korean', 'dutch'], confidence: 'low' };
      }
      
      // 如果偏好韓語但文本主要是拉丁字母，不使用偏好語言
      if (preferredLanguage === 'korean' && hasLatinScript && !hasKoreanScript) {
        return { language: 'uncertain', candidates: ['english', 'japanese', 'korean', 'dutch'], confidence: 'low' };
      }
      
      return { language: preferredLanguage, confidence: 'medium' };
    }
    
    // 真正不確定的情況：返回不確定結果，讓用戶選擇所有可用語言
    return { language: 'uncertain', candidates: ['english', 'japanese', 'korean', 'dutch'], confidence: 'low' };
  }
  
  // 高信心檢測結果
  if (dutchScore > englishScore) {
    return { language: 'dutch', confidence: 'high' };
  } else {
    return { language: 'english', confidence: 'high' };
  }
}

// 匯出函數
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectLanguage };
} else if (typeof self !== 'undefined') {
  self.detectLanguage = detectLanguage;
} else {
  this.detectLanguage = detectLanguage;
}