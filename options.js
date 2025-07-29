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
  
  // 綁定 UI 語言變更事件
  document.getElementById('uiLanguage').addEventListener('change', handleUILanguageChange);
  
  // 初始化偏好語言群組顯示狀態
  togglePreferredLanguageGroup();
  
  // 初始化 AI 群組顯示狀態
  toggleAiGroups();
  
  // 初始化 OpenAI 模型群組顯示狀態
  toggleOpenAiModelGroup();
});

// 載入設定
function loadSettings() {
  chrome.storage.sync.get([
    'uiLanguage', 'defaultLanguage', 'openMethod', 'preferredLanguage', 'uncertaintyHandling',
    'aiEnabled', 'autoAnalysis', 'aiProvider', 'openaiModel', 'apiKey', 'pronunciationGuide', 'wordExplanation', 
    'grammarAnalysis', 'culturalContext', 'errorDetection', 'audioPronunciation', 'ttsVoice', 
    'speechSpeed', 'autoPlayAudio', 'analysisComplexity'
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
    document.getElementById('openaiModel').value = result.openaiModel || 'gpt-4o-mini'; // Default to cheapest and best
    document.getElementById('apiKey').value = result.apiKey || '';
    document.getElementById('pronunciationGuide').checked = result.pronunciationGuide !== false;
    document.getElementById('wordExplanation').checked = result.wordExplanation !== false;
    document.getElementById('grammarAnalysis').checked = result.grammarAnalysis || false;
    document.getElementById('culturalContext').checked = result.culturalContext || false;
    document.getElementById('errorDetection').checked = result.errorDetection || false; // Default to false
    document.getElementById('audioPronunciation').checked = result.audioPronunciation !== false; // Default to true
    
    // AI 分析複雜度設定
    document.getElementById('analysisComplexity').value = result.analysisComplexity || 'auto';
    
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