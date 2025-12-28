// 載入設定
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadCurrentShortcut();
  
  // 綁定儲存按鈕事件
  document.getElementById('saveButton').addEventListener('click', saveSettings);
  
  // 綁定快捷鍵設定按鈕事件
  document.getElementById('openShortcutSettings').addEventListener('click', openShortcutSettings);
  
  // 綁定預設語言選擇變更事件
  document.getElementById('defaultLanguage').addEventListener('change', togglePreferredLanguageGroup);
  
  // 綁定 AI 啟用變更事件
  document.getElementById('aiEnabled').addEventListener('change', toggleAiGroups);
  
  // 綁定 AI 提供商變更事件
  document.getElementById('aiProvider').addEventListener('change', toggleOpenAiModelGroup);
  
  // 綁定自訂提示詞變更事件
  document.getElementById('useCustomPrompt').addEventListener('change', toggleCustomPromptEditor);
  
  // 綁定 UI 語言變更事件
  document.getElementById('uiLanguage').addEventListener('change', handleUILanguageChange);
  
  // 初始化偏好語言群組顯示狀態
  togglePreferredLanguageGroup();
  
  // 初始化 AI 群組顯示狀態
  toggleAiGroups();
  
  // 初始化 OpenAI 模型群組顯示狀態
  toggleOpenAiModelGroup();
  
  // 初始化自訂提示詞編輯器顯示狀態
  toggleCustomPromptEditor();
});

// 載入設定
function loadSettings() {
  chrome.storage.sync.get([
    'uiLanguage', 'defaultLanguage', 'openMethod', 'preferredLanguage', 'uncertaintyHandling',
    'aiEnabled', 'autoAnalysis', 'aiProvider', 'openaiModel', 'apiKey', 'pronunciationGuide', 'wordExplanation', 
    'grammarAnalysis', 'culturalContext', 'errorDetection', 'audioPronunciation', 'ttsVoice', 
    'speechSpeed', 'autoPlayAudio', 'analysisComplexity', 'useCustomPrompt', 'customPromptTemplate'
  ], (result) => {
    document.getElementById('uiLanguage').value = result.uiLanguage || 'auto';
    document.getElementById('defaultLanguage').value = result.defaultLanguage || 'auto';
    document.getElementById('openMethod').value = result.openMethod || 'analysis-only';
    document.getElementById('preferredLanguage').value = result.preferredLanguage || 'none';
    document.getElementById('uncertaintyHandling').value = result.uncertaintyHandling || 'ask';
    
    // AI 設定
    document.getElementById('aiEnabled').value = result.aiEnabled || 'false';
    document.getElementById('autoAnalysis').value = result.autoAnalysis || 'true'; // Default to automatic
    document.getElementById('aiProvider').value = result.aiProvider || 'gemini';
    document.getElementById('openaiModel').value = result.openaiModel || 'gpt-5-mini'; // Default to newest and best cost-performance
    document.getElementById('apiKey').value = result.apiKey || '';
    document.getElementById('pronunciationGuide').checked = result.pronunciationGuide !== false;
    document.getElementById('wordExplanation').checked = result.wordExplanation !== false;
    document.getElementById('grammarAnalysis').checked = result.grammarAnalysis || false;
    document.getElementById('culturalContext').checked = result.culturalContext || false;
    document.getElementById('errorDetection').checked = result.errorDetection || false; // Default to false
    document.getElementById('audioPronunciation').checked = result.audioPronunciation !== false; // Default to true
    
    // AI 分析複雜度設定
    document.getElementById('analysisComplexity').value = result.analysisComplexity || 'auto';
    
    // 自訂提示詞設定
    document.getElementById('useCustomPrompt').value = result.useCustomPrompt || 'false';
    document.getElementById('customPromptTemplate').value = result.customPromptTemplate || getDefaultCustomPromptTemplate();
    
    // 語音設定
    document.getElementById('ttsVoice').value = result.ttsVoice || 'alloy';
    document.getElementById('speechSpeed').value = result.speechSpeed || '1.0';
    document.getElementById('autoPlayAudio').checked = result.autoPlayAudio || false;
  });
}

// 儲存設定
function saveSettings() {
  const uiLanguage = document.getElementById('uiLanguage').value;
  const defaultLanguage = document.getElementById('defaultLanguage').value;
  const openMethod = document.getElementById('openMethod').value;
  const preferredLanguage = document.getElementById('preferredLanguage').value;
  const uncertaintyHandling = document.getElementById('uncertaintyHandling').value;
  
  // AI 設定
  const aiEnabled = document.getElementById('aiEnabled').value;
  const autoAnalysis = document.getElementById('autoAnalysis').value;
  const aiProvider = document.getElementById('aiProvider').value;
  const openaiModel = document.getElementById('openaiModel').value;
  const apiKey = document.getElementById('apiKey').value;
  const pronunciationGuide = document.getElementById('pronunciationGuide').checked;
  const wordExplanation = document.getElementById('wordExplanation').checked;
  const grammarAnalysis = document.getElementById('grammarAnalysis').checked;
  const culturalContext = document.getElementById('culturalContext').checked;
  const errorDetection = document.getElementById('errorDetection').checked;
  const audioPronunciation = document.getElementById('audioPronunciation').checked;
  
  // AI 分析複雜度設定
  const analysisComplexity = document.getElementById('analysisComplexity').value;
  
  // 自訂提示詞設定
  const useCustomPrompt = document.getElementById('useCustomPrompt').value;
  const customPromptTemplate = document.getElementById('customPromptTemplate').value;
  
  // 語音設定
  const ttsVoice = document.getElementById('ttsVoice').value;
  const speechSpeed = document.getElementById('speechSpeed').value;
  const autoPlayAudio = document.getElementById('autoPlayAudio').checked;
  
  const saveButton = document.getElementById('saveButton');
  const statusMessage = document.getElementById('statusMessage');
  
  // 禁用按鈕
  saveButton.disabled = true;
  saveButton.textContent = chrome.i18n.getMessage('saving');
  
  // 儲存到 chrome.storage
  chrome.storage.sync.set({
    uiLanguage: uiLanguage,
    defaultLanguage: defaultLanguage,
    openMethod: openMethod,
    preferredLanguage: preferredLanguage,
    uncertaintyHandling: uncertaintyHandling,
    aiEnabled: aiEnabled,
    autoAnalysis: autoAnalysis,
    aiProvider: aiProvider,
    openaiModel: openaiModel,
    apiKey: apiKey,
    pronunciationGuide: pronunciationGuide,
    wordExplanation: wordExplanation,
    grammarAnalysis: grammarAnalysis,
    culturalContext: culturalContext,
    errorDetection: errorDetection,
    audioPronunciation: audioPronunciation,
    analysisComplexity: analysisComplexity,
    useCustomPrompt: useCustomPrompt,
    customPromptTemplate: customPromptTemplate,
    ttsVoice: ttsVoice,
    speechSpeed: speechSpeed,
    autoPlayAudio: autoPlayAudio
  }, () => {
    // 重新啟用按鈕
    saveButton.disabled = false;
    saveButton.textContent = chrome.i18n.getMessage('save_settings');
    
    // 顯示成功訊息
    showStatusMessage(chrome.i18n.getMessage('settings_saved'), 'success');
    
    // 3秒後隱藏訊息
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  });
}

// 顯示狀態訊息
function showStatusMessage(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';
}

// 載入當前快捷鍵
function loadCurrentShortcut() {
  chrome.commands.getAll((commands) => {
    const searchCommand = commands.find(cmd => cmd.name === 'search-youglish');
    if (searchCommand && searchCommand.shortcut) {
      document.getElementById('currentShortcut').textContent = searchCommand.shortcut;
    }
  });
}

// 開啟 Chrome 快捷鍵設定
function openShortcutSettings() {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
}

// 切換偏好語言群組的顯示狀態
function togglePreferredLanguageGroup() {
  const defaultLanguage = document.getElementById('defaultLanguage').value;
  const preferredLanguageGroup = document.getElementById('preferredLanguageGroup');
  
  if (defaultLanguage === 'auto') {
    preferredLanguageGroup.style.display = 'block';
  } else {
    preferredLanguageGroup.style.display = 'none';
  }
}

// 切換 AI 群組的顯示狀態
function toggleAiGroups() {
  // Always show all AI settings for better UX
  // Users can configure everything before enabling, or change settings without disabling/re-enabling
  const autoAnalysisGroup = document.getElementById('autoAnalysisGroup');
  const aiProviderGroup = document.getElementById('aiProviderGroup');
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  const aiOptionsGroup = document.getElementById('aiOptionsGroup');
  const audioOptionsGroup = document.getElementById('audioOptionsGroup');
  
  // Always show all groups
  autoAnalysisGroup.style.display = 'block';
  aiProviderGroup.style.display = 'block';
  apiKeyGroup.style.display = 'block';
  aiOptionsGroup.style.display = 'block';
  audioOptionsGroup.style.display = 'block';
  
  // OpenAI model group visibility still depends on provider
  toggleOpenAiModelGroup();
}

// 切換 OpenAI 模型群組的顯示狀態
function toggleOpenAiModelGroup() {
  const aiProvider = document.getElementById('aiProvider').value;
  const openaiModelGroup = document.getElementById('openaiModelGroup');
  
  // Show OpenAI model selection only when OpenAI is selected as provider
  // Regardless of whether AI is enabled or not
  if (aiProvider === 'openai') {
    openaiModelGroup.style.display = 'block';
  } else {
    openaiModelGroup.style.display = 'none';
  }
}

// 獲取預設自訂提示詞模板
function getDefaultCustomPromptTemplate() {
  return `你好！我是專業的 {{languageName}} 語言教師，專門幫助中文使用者學習。讓我來分析：「{{text}}」

## 🎯 語言分析

### 📝 中文翻譯
**翻譯：** [請提供準確的中文翻譯]

### 🗣️ 發音指導
**發音：** [IPA國際音標] 
**發音技巧：** [具體的發音要點和注意事項]

{{#isWord}}
### 📚 單詞分析
**詞性：** [名詞/動詞/形容詞/副詞等]
**用法：** [這個詞如何使用]
**例句：** [提供2-3個實用例句]
**記憶技巧：** [幫助記憶的方法]
{{/isWord}}

{{^isWord}}
### 📖 句子分析  
**語法結構：** [分析句子的語法模式]
**重點詞彙：** [句子中的關鍵詞彙解釋]
**語法要點：** [重要的語法規則]
**相似句型：** [提供2-3個類似的句子結構]
{{/isWord}}

### 💡 學習建議
**使用場景：** [什麼時候使用這個表達]
**學習重點：** [需要特別注意的地方]
**練習建議：** [如何練習使用]

### 🗣️ 實際對話應用
**對話情境：** [這個表達最常出現的對話場景]
**開始對話：** 
• 你可以這樣開始："[具體的對話開場白]"
• 對方可能會回應："[可能的回應]"
• 你接著可以說："[後續對話]"

**實用對話模板：**
{{#isWord}}
• 使用 "{{text}}" 的日常對話：
  - 情境：[具體場景，如餐廳、工作、購物等]
  - 你："[包含此詞的自然句子]"
  - 對方："[自然回應]"
{{/isWord}}
{{^isWord}}
• 使用 "{{text}}" 開啟對話：
  - 適合場合：[什麼時候說這句話]
  - 完整對話流程：
    - 你："{{text}}"
    - 對方："[可能的回應]" 
    - 你："[如何繼續對話]"
{{/isWord}}

**🎭 角色扮演練習：**
試著想像你是 [具體角色，如遊客、學生、同事]，在 [具體場景] 中會如何使用這個表達？

---
📊 分析詞數：{{wordCount}} | 🌍 目標語言：{{languageName}} | 🎯 複雜度：{{complexity}}

**🚀 行動建議：**
今天就試著在真實對話中使用一次！記住：多練習、多使用，你一定能學會！ 💪`;
}

// 切換自訂提示詞編輯器的顯示狀態
function toggleCustomPromptEditor() {
  const useCustomPrompt = document.getElementById('useCustomPrompt').value;
  const customPromptEditor = document.getElementById('customPromptEditor');
  
  if (useCustomPrompt === 'true') {
    customPromptEditor.style.display = 'block';
    
    // 如果模板是空的，自動載入預設範例
    const currentTemplate = document.getElementById('customPromptTemplate').value;
    if (!currentTemplate.trim()) {
      document.getElementById('customPromptTemplate').value = getDefaultCustomPromptTemplate();
    }
  } else {
    customPromptEditor.style.display = 'none';
  }
}

// 載入預設模板
function loadDefaultTemplate() {
  document.getElementById('customPromptTemplate').value = getDefaultCustomPromptTemplate();
  showStatusMessage('💬 已載入對話式教學模板！AI 現在會像真人老師一樣和您互動學習', 'success');
}

// 清空模板
function clearTemplate() {
  if (confirm('確定要清空自訂提示詞模板嗎？')) {
    document.getElementById('customPromptTemplate').value = '';
    showStatusMessage('🗑️ 模板已清空', 'success');
  }
}

// 處理 UI 語言變更
async function handleUILanguageChange() {
  const selectedLanguage = document.getElementById('uiLanguage').value;
  
  // 保存語言設定
  chrome.storage.sync.set({ uiLanguage: selectedLanguage }, () => {
    // 刷新頁面以應用新語言
    if (typeof window.refreshUILanguage === 'function') {
      window.refreshUILanguage();
    } else {
      // 如果刷新函數不可用，重新載入頁面
      location.reload();
    }
  });
}