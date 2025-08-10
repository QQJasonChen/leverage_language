// 語言名稱映射
const languageNames = {
  'english': '英文',
  'japanese': '日文',
  'korean': '韓文',
  'dutch': '荷蘭文'
};

// Initialize security and performance utils
let securityUtils, performanceUtils, errorHandler;

// Safe logging wrapper
const logSafely = (...args) => {
  if (typeof PerformanceUtils !== 'undefined') {
    PerformanceUtils.log(...args);
  }
};

// Safe error handling wrapper
const handleError = async (error, context = {}) => {
  if (typeof window !== 'undefined' && window.globalErrorHandler && typeof window.globalErrorHandler.handleError === 'function') {
    return await window.globalErrorHandler.handleError(error, context);
  }
  console.error('Error:', error);
  return { success: false, error: error.message };
};

// 監聽來自背景腳本的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔔 Sidepanel received message:', request.action, request.source);
  
  // Handle Netflix learning recording from transcript collection
  if (request.action === 'recordNetflixLearning') {
    console.log('🎭 Recording Netflix learning segment:', request.data);
    const data = request.data;
    recordLearningSearch(
      data.text, 
      data.language, 
      data.url, 
      data.title, 
      'netflix', 
      null // courseTitle not applicable for Netflix
    );
    updateLearningDashboard();
    sendResponse({ success: true });
    return;
  }
  
  // Handle Udemy learning recording from transcript collection  
  if (request.action === 'recordUdemyLearning') {
    console.log('📚 Recording Udemy learning segment:', request.data);
    const data = request.data;
    recordLearningSearch(
      data.text, 
      data.language, 
      data.url, 
      data.title, 
      'udemy', 
      data.courseTitle // Udemy has course titles
    );
    updateLearningDashboard();
    sendResponse({ success: true });
    return;
  }
  
  // Handle Coursera learning recording from transcript collection
  if (request.action === 'recordCourseraLearning') {
    console.log('🎓 Recording Coursera learning segment:', request.data);
    const data = request.data;
    recordLearningSearch(
      data.text, 
      data.language, 
      data.url, 
      data.title, 
      'coursera', 
      data.courseTitle // Coursera has course titles
    );
    updateLearningDashboard();
    sendResponse({ success: true });
    return;
  }
  
  if (request.action === 'updateSidePanel') {
    // Check if this is from YouTube learning
    if (request.source === 'youtube-learning') {
      console.log('📖 Received YouTube learning text:', request.text);
      
      // Switch to video tab if not already there
      const videoBtn = document.getElementById('showVideoBtn');
      if (videoBtn) {
        videoBtn.click();
      }
      
      // Handle the analysis in the video tab
      setTimeout(() => {
        recordLearningSearch(request.text, request.language, request.url, request.title, request.platform, request.courseTitle);
        updateLearningDashboard();
        handleYouTubeTextAnalysis(request.text, request.url, request.title);
      }, 200);
      
      // Also trigger the normal analysis for the Analysis tab
      loadYouGlish(request.url, request.text, request.language);
    } else {
      // Regular analysis
      loadYouGlish(request.url, request.text, request.language);
    }
  }

  // Switch to AI Analysis tab after analysis
  if (request.action === 'switchToAIAnalysisTab') {
    console.log('🎯 Switching to AI Analysis tab after analyzing:', request.text);
    
    // Switch to Analysis tab
    const analysisBtn = document.getElementById('showAnalysisBtn');
    if (analysisBtn) {
      analysisBtn.click();
      console.log('✅ Successfully switched to AI Analysis tab');
      
      // Small delay to ensure tab is loaded, then trigger analysis display
      setTimeout(() => {
        // The analysis should already be completed and stored
        // This will refresh the analysis view to show the latest result
        const analysisContent = document.getElementById('analysis-content');
        if (analysisContent) {
          // Trigger a refresh of the analysis content
          const event = new CustomEvent('refreshAnalysisView', { 
            detail: { text: request.text } 
          });
          document.dispatchEvent(event);
        }
      }, 300);
      
    } else {
      console.error('❌ Could not find Analysis tab button');
    }
    
    return;
  }
});

// 儲存當前的查詢數據
let currentQueryData = {};
let currentAIAnalysis = null;
let lastProcessedQuery = null;

// Extension resource management and crash prevention
let flashcardCreationCount = 0;
let lastFlashcardCreationTime = 0;
const FLASHCARD_CREATION_LIMIT = 2; // Ultra-conservative: 2 per minute
const FLASHCARD_COOLDOWN_PERIOD = 60000; // 1 minute
window.audioCache = new Map(); // Track audio for cleanup - make global
let memoryCleanupInterval = null;

// Chrome crash prevention measures
let extensionResourceMonitor = {
  activeOperations: 0,
  memoryPressure: false,
  maxConcurrentOps: 1, // Only 1 operation at a time
  lastCleanup: Date.now()
};

// Check for YouTube analysis data when sidepanel opens
async function checkForYouTubeAnalysis() {
  try {
    const result = await chrome.storage.local.get('youtubeAnalysis');
    if (result.youtubeAnalysis) {
      const data = result.youtubeAnalysis;
      // Check if data is recent (within last 5 minutes)
      if (Date.now() - data.timestamp < 5 * 60 * 1000) {
        console.log('📺 Found recent YouTube analysis data:', data.text);
        
        // Switch to video tab
        const videoBtn = document.getElementById('showVideoBtn');
        if (videoBtn) {
          videoBtn.click();
        }
        
        // Process the YouTube data
        setTimeout(() => {
          recordLearningSearch(data.text, data.language, data.originalUrl, data.title);
          updateLearningDashboard();
          handleYouTubeTextAnalysis(data.text, data.originalUrl, data.title);
        }, 500);
        
        // Load in analysis tab
        loadYouGlish(data.url, data.text, data.language);
        
        // Clear the data after processing
        chrome.storage.local.remove('youtubeAnalysis');
      }
    }
  } catch (error) {
    console.error('Error checking YouTube analysis:', error);
  }
}

// Check for Netflix analysis data when sidepanel opens
async function checkForNetflixAnalysis() {
  try {
    const result = await chrome.storage.local.get('netflixAnalysis');
    if (result.netflixAnalysis) {
      const data = result.netflixAnalysis;
      // Check if data is recent (within last 5 minutes)
      if (Date.now() - data.timestamp < 5 * 60 * 1000) {
        console.log('🎭 Found recent Netflix analysis data:', data.text);
        
        // Switch to video tab
        const videoBtn = document.getElementById('showVideoBtn');
        if (videoBtn) {
          videoBtn.click();
        }
        
        // Process the Netflix data
        setTimeout(() => {
          recordLearningSearch(data.text, data.language, data.originalUrl, data.title, 'netflix');
          updateLearningDashboard();
          handleNetflixTextAnalysis(data.text, data.originalUrl, data.title, data.videoId, data.movieId);
        }, 500);
        
        // Load in analysis tab
        loadYouGlish(data.url, data.text, data.language);
        
        // Clear the data after processing
        chrome.storage.local.remove('netflixAnalysis');
      }
    }
  } catch (error) {
    console.error('Error checking Netflix analysis:', error);
  }
}

// Check for Udemy analysis data when sidepanel opens
async function checkForUdemyAnalysis() {
  try {
    const result = await chrome.storage.local.get('udemyAnalysis');
    if (result.udemyAnalysis) {
      const data = result.udemyAnalysis;
      // Check if data is recent (within last 5 minutes)
      if (Date.now() - data.timestamp < 5 * 60 * 1000) {
        console.log('📚 Found recent Udemy analysis data:', data.text);
        
        // Switch to video tab
        const videoBtn = document.getElementById('showVideoBtn');
        if (videoBtn) {
          videoBtn.click();
        }
        
        // Process the Udemy data
        setTimeout(() => {
          recordLearningSearch(data.text, data.language, data.originalUrl, data.title, 'udemy', data.courseTitle);
          updateLearningDashboard();
          handleUdemyTextAnalysis(data.text, data.originalUrl, data.title, data.courseTitle, data.lectureTitle, data.videoId);
        }, 500);
        
        // Clean up the stored data
        chrome.storage.local.remove('udemyAnalysis');
      }
    }
  } catch (error) {
    console.error('Error checking Udemy analysis:', error);
  }
}

// Check for article analysis data when sidepanel opens
async function checkForArticleAnalysis() {
  try {
    console.log('📰 Checking for article analysis data...');
    const result = await chrome.storage.local.get('articleAnalysis');
    console.log('📰 Storage result:', result);
    
    if (result.articleAnalysis) {
      const data = result.articleAnalysis;
      console.log('📰 Found article analysis data:', data);
      
      // Check if data is recent (within last 5 minutes)
      const ageMs = Date.now() - data.timestamp;
      const ageMinutes = ageMs / (1000 * 60);
      console.log('📰 Data age:', ageMinutes, 'minutes');
      
      if (ageMs < 5 * 60 * 1000) {
        console.log('📰 Data is recent, processing...', data.text);
        
        // Switch to analysis tab explicitly
        const analysisBtn = document.getElementById('showAnalysisBtn');
        if (analysisBtn) {
          console.log('📰 Switching to Analysis tab for article content');
          analysisBtn.click();
        }
        
        // Set currentQueryData with article analysis data (similar to YouTube)
        currentQueryData = {
          text: data.text,
          language: data.language,
          source: data.source,
          url: data.url,
          originalUrl: data.originalUrl,
          allUrls: data.allUrls,
          title: data.title,
          articleMetadata: data.articleMetadata,
          paragraph: data.paragraph,
          context: data.context,
          detectionMethod: data.source || 'article-selection', // Use actual source as detection method
          videoSource: data.videoSource // Include videoSource for display
        };
        
        console.log('📰 Set currentQueryData:', currentQueryData);
        
        // Load in analysis tab for immediate AI analysis
        loadYouGlish(data.url, data.text, data.language);
        
        // Trigger AI analysis with article context
        setTimeout(() => {
          console.log('📰 Triggering AI analysis...');
          generateAIAnalysis();
        }, 500);
        
        // Clear the data after processing
        chrome.storage.local.remove('articleAnalysis');
        console.log('📰 Cleared articleAnalysis from storage');
      } else {
        console.log('📰 Data is too old, ignoring');
      }
    } else {
      console.log('📰 No article analysis data found');
    }
  } catch (error) {
    console.error('Error checking article analysis:', error);
  }
}

// Initialize storage manager and analytics
let storageManager = null;

// Storage diagnostic function
async function checkStorageUsage() {
  try {
    if (storageManager && typeof storageManager.getStorageStats === 'function') {
      const stats = await storageManager.getStorageStats();
      console.log('💾 Current Storage Usage:', stats);
      
      if (stats.isNearLimit) {
        console.warn('⚠️ Storage is near limit! Consider cleanup.');
        return stats;
      }
      return stats;
    }
  } catch (error) {
    console.error('Failed to check storage usage:', error);
  }
  return null;
}

// Emergency storage cleanup function (removes all audio data)
async function fixStorageIssue() {
  try {
    console.log('🚨 Running emergency storage cleanup...');
    
    if (storageManager && typeof storageManager.removeAllAudioData === 'function') {
      const result = await storageManager.removeAllAudioData();
      
      if (result.success) {
        console.log(`✅ Emergency cleanup completed!`);
        console.log(`🗑️ Removed audio data from ${result.removedAudio} reports`);
        console.log(`💾 Audio saving has been disabled to prevent future issues`);
        
        // Check storage usage after cleanup
        const newStats = await checkStorageUsage();
        if (newStats) {
          console.log(`📊 New storage usage: ${newStats.usagePercentage}%`);
        }
        
        return result;
      } else {
        console.error('❌ Emergency cleanup failed:', result.error);
      }
    }
  } catch (error) {
    console.error('❌ Emergency cleanup error:', error);
  }
  return null;
}

// Export all audio data as backup before clearing (recommended workflow)
async function exportAndClearAudio() {
  try {
    console.log('📦 Starting export and clear audio workflow...');
    
    if (storageManager && typeof storageManager.exportAndClearAudioData === 'function') {
      const result = await storageManager.exportAndClearAudioData();
      
      if (result.success) {
        console.log(`✅ Export and clear completed!`);
        console.log(`📦 Exported ${result.exportedFiles} audio files`);
        console.log(`🗑️ Cleared audio data from ${result.clearedReports} reports`);
        
        // Show user notification
        if (typeof showNotification === 'function') {
          showNotification(`Audio export completed: ${result.exportedFiles} files saved, ${result.clearedReports} reports cleaned`, 'success');
        }
        
        // Check storage usage after cleanup
        const newStats = await checkStorageUsage();
        if (newStats) {
          console.log(`📊 New storage usage: ${newStats.usagePercentage}%`);
        }
        
        return result;
      } else {
        console.error('❌ Export and clear failed:', result.error);
      }
    }
  } catch (error) {
    console.error('❌ Export and clear error:', error);
  }
  return null;
}

// Export audio data only (without clearing)
async function exportAudioOnly() {
  try {
    console.log('📦 Exporting audio data only...');
    
    if (storageManager && typeof storageManager.downloadAudioExport === 'function') {
      const result = await storageManager.downloadAudioExport();
      
      if (result.success) {
        console.log(`✅ Audio export completed!`);
        console.log(`📦 Exported ${result.totalFiles} audio files as JSON backup`);
        
        // Show user notification
        if (typeof showNotification === 'function') {
          showNotification(`Audio export completed: ${result.totalFiles} files saved as backup`, 'success');
        }
        
        return result;
      } else {
        console.error('❌ Audio export failed:', result.error);
      }
    }
  } catch (error) {
    console.error('❌ Audio export error:', error);
  }
  return null;
}

// Download individual audio files as .wav files
async function downloadAudioFiles() {
  try {
    console.log('🎵 Downloading individual audio files...');
    
    if (storageManager && typeof storageManager.downloadIndividualAudioFiles === 'function') {
      const result = await storageManager.downloadIndividualAudioFiles();
      
      if (result.success) {
        console.log(`✅ Audio download completed!`);
        console.log(`🎵 Downloaded ${result.downloadedCount}/${result.totalFiles} individual audio files`);
        
        // Show user notification
        if (typeof showNotification === 'function') {
          showNotification(`Audio download completed: ${result.downloadedCount}/${result.totalFiles} files`, 'success');
        }
        
        return result;
      } else {
        console.error('❌ Audio download failed:', result.error);
      }
    }
  } catch (error) {
    console.error('❌ Audio download error:', error);
  }
  return null;
}

// Check how much audio data you have
async function checkAudioData() {
  try {
    console.log('📊 Checking audio data...');
    
    if (storageManager && typeof storageManager.exportAllAudioData === 'function') {
      const result = await storageManager.exportAllAudioData();
      
      if (result.success) {
        console.log(`📊 Audio data summary:`);
        console.log(`🎵 Total audio files: ${result.totalFiles}`);
        console.log(`💾 Total size: ${result.totalSize}`);
        
        return result;
      } else {
        console.log('ℹ️ No audio data found');
      }
    }
  } catch (error) {
    console.error('❌ Audio check error:', error);
  }
  return null;
}

// Update storage display in UI
async function updateStorageDisplay() {
  try {
    const audioDataInfo = document.getElementById('audioDataInfo');
    const audioManagementActions = document.getElementById('audioManagementActions');
    
    if (!storageManager) {
      if (audioDataInfo) audioDataInfo.textContent = '儲存管理器未載入';
      return;
    }
    
    // Get storage stats with IndexedDB info
    const stats = await storageManager.getStorageStatsWithIndexedDB();
    if (!stats) {
      if (audioDataInfo) audioDataInfo.textContent = '無法取得儲存資訊';
      return;
    }
    
    // Check audio data
    const audioResult = await checkAudioData();
    let totalAudioFiles = 0;
    
    // Count total audio files
    if (audioResult && audioResult.success && audioResult.totalFiles > 0) {
      totalAudioFiles += audioResult.totalFiles;
    }
    if (stats.indexedDB && stats.indexedDB.available && stats.indexedDB.audioCount > 0) {
      totalAudioFiles += stats.indexedDB.audioCount;
    }
    
    // Display simple, user-friendly info
    if (audioDataInfo) {
      const availableSpace = stats.indexedDB?.availableSpace || '檢查中...';
      
      if (totalAudioFiles > 0) {
        audioDataInfo.innerHTML = `
          <div style="font-weight: 500; margin-bottom: 4px;">🎵 已儲存 ${totalAudioFiles} 個音檔</div>
          <div style="font-size: 12px; opacity: 0.8;">可用空間：${availableSpace}</div>
        `;
        
        // Show management actions if there are audio files
        if (audioManagementActions) {
          audioManagementActions.style.display = 'block';
        }
      } else {
        audioDataInfo.innerHTML = `
          <div style="font-weight: 500; margin-bottom: 4px;">📂 尚未儲存音檔</div>
          <div style="font-size: 12px; opacity: 0.8;">可用空間：${availableSpace}</div>
        `;
        
        // Hide management actions if no audio files
        if (audioManagementActions) {
          audioManagementActions.style.display = 'none';
        }
      }
    }
    
    console.log('📊 Storage display updated:', {
      totalAudioFiles,
      availableSpace: stats.indexedDB?.availableSpace || 'Unknown'
    });
    
  } catch (error) {
    console.error('Error updating storage display:', error);
  }
}

// Show message to user
function showMessage(text, type = 'info') {
  // Create toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  
  // Set background color based on type
  switch (type) {
    case 'success':
      toast.style.background = '#4CAF50';
      break;
    case 'error':
      toast.style.background = '#f44336';
      break;
    case 'warning':
      toast.style.background = '#ff9800';
      break;
    default:
      toast.style.background = '#2196F3';
  }
  
  toast.textContent = text;
  document.body.appendChild(toast);
  
  // Remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Expose audio management functions to global scope for console access
window.checkAudioData = checkAudioData;
window.exportAndClearAudio = exportAndClearAudio;
window.exportAudioOnly = exportAudioOnly;
window.downloadAudioFiles = downloadAudioFiles;
window.fixStorageIssue = fixStorageIssue;
window.updateStorageDisplay = updateStorageDisplay;

// Learning dashboard data
let learningStats = {
  totalSearches: 0,
  vocabularyCount: 0,
  todaySearches: 0,
  recentActivity: [],
  topVocabulary: [],
  lastUpdated: new Date().toISOString()
};

// Load learning stats from storage
async function loadLearningStats() {
  try {
    const result = await chrome.storage.local.get('learningStats');
    if (result.learningStats) {
      learningStats = { ...learningStats, ...result.learningStats };
      console.log('📚 Loaded learning stats:', learningStats.totalSearches, 'searches,', learningStats.vocabularyCount, 'vocabulary');
    }
  } catch (error) {
    console.error('Error loading learning stats:', error);
  }
}

// Save learning stats to storage
async function saveLearningStats() {
  try {
    await chrome.storage.local.set({ learningStats: learningStats });
    console.log('💾 Learning stats saved');
  } catch (error) {
    console.error('Error saving learning stats:', error);
  }
}

// Record learning search function
function recordLearningSearch(text, language, url, title, platform = null, courseTitle = null) {
  // Detect platform from URL if not provided
  let detectedPlatform = platform;
  if (!detectedPlatform) {
    if (url && url.includes('youtube.com')) {
      detectedPlatform = 'youtube';
    } else if (url && url.includes('netflix.com')) {
      detectedPlatform = 'netflix';
    } else if (url && url.includes('udemy.com')) {
      detectedPlatform = 'udemy';
    } else {
      detectedPlatform = 'youtube'; // Default fallback
    }
  }

  const searchEntry = {
    text: text,
    language: language,
    url: url,
    title: title || '',
    videoTitle: title || '', // ✅ Add videoTitle for consistency with viewer
    platform: detectedPlatform,
    courseTitle: courseTitle || null,
    timestamp: new Date().toISOString(),
    date: new Date().toDateString()
  };
  
  // Update stats
  learningStats.totalSearches++;
  learningStats.lastUpdated = new Date().toISOString();
  
  // Check if today's search
  const today = new Date().toDateString();
  if (searchEntry.date === today) {
    learningStats.todaySearches++;
  }
  
  // Add to recent activity (keep last 10)
  learningStats.recentActivity.unshift(searchEntry);
  if (learningStats.recentActivity.length > 10) {
    learningStats.recentActivity = learningStats.recentActivity.slice(0, 10);
  }
  
  // Update vocabulary tracking
  updateVocabularyTracking(text, language);
  
  // Add video to learning queue if it's a YouTube URL
  if (url && url.includes('youtube.com')) {
    const videoTitle = title || 'YouTube Video';
    const channelName = extractChannelFromYouTubeUrl(url) || 'Unknown Channel';
    const wordCount = text.split(/\s+/).length;
    const isSentence = wordCount > 3; // Consider 4+ words as a sentence
    addVideoToQueue(url, videoTitle, channelName, isSentence);
  }
  
  // Add Netflix content to learning queue
  if (url && url.includes('netflix.com')) {
    const videoTitle = title || 'Netflix Content';
    const channelName = 'Netflix';
    const wordCount = text.split(/\s+/).length;
    const isSentence = wordCount > 3; // Consider 4+ words as a sentence
    addNetflixToQueue(url, videoTitle, channelName, isSentence);
  }

  // Add Udemy content to learning queue
  if (url && url.includes('udemy.com')) {
    const videoTitle = courseTitle || title || 'Udemy Course';
    const channelName = 'Udemy';
    const wordCount = text.split(/\s+/).length;
    const isSentence = wordCount > 3; // Consider 4+ words as a sentence
    addUdemyToQueue(url, videoTitle, channelName, isSentence, courseTitle);
  }
  
  // Save to storage
  saveLearningStats();
  
  console.log('📚 Learning search recorded:', searchEntry);
}

// Update vocabulary tracking
function updateVocabularyTracking(text, language) {
  const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  words.forEach(word => {
    const existing = learningStats.topVocabulary.find(v => v.word === word);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date().toISOString();
    } else {
      learningStats.topVocabulary.push({
        word: word,
        language: language,
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
    }
  });
  
  // Sort by count and keep top 20
  learningStats.topVocabulary.sort((a, b) => b.count - a.count);
  learningStats.topVocabulary = learningStats.topVocabulary.slice(0, 20);
  learningStats.vocabularyCount = learningStats.topVocabulary.length;
}

// Update learning dashboard function
function updateLearningDashboard() {
  // Update quick stats
  const totalSearchesEl = document.getElementById('quickTotalSearches');
  const vocabularyCountEl = document.getElementById('quickUniqueWords');
  const todaySearchesEl = document.getElementById('quickTodaySearches');
  
  if (totalSearchesEl) totalSearchesEl.textContent = learningStats.totalSearches;
  if (vocabularyCountEl) vocabularyCountEl.textContent = learningStats.vocabularyCount;
  if (todaySearchesEl) todaySearchesEl.textContent = learningStats.todaySearches;
  
  // Update recent activity
  updateRecentActivity();
  
  // Update top vocabulary
  updateTopVocabulary();
  
  // Update AI analysis insights
  updateAIInsights();
  
  console.log('📊 Learning dashboard updated');
}

// Update recent activity section
function updateRecentActivity() {
  console.log('🔄 Updating recent activity, found', learningStats.recentActivity.length, 'activities');
  const activityList = document.getElementById('quickHistoryList');
  if (!activityList) {
    console.log('❌ quickHistoryList element not found');
    return;
  }
  
  activityList.innerHTML = '';
  
  if (learningStats.recentActivity.length === 0) {
    console.log('📝 No learning activity, showing empty state');
    activityList.innerHTML = '<div class="activity-empty">開始學習後，這裡會顯示您的學習記錄</div>';
    return;
  }
  
  console.log('📋 Displaying', learningStats.recentActivity.length, 'learning activities');
  
  learningStats.recentActivity.forEach(activity => {
    const activityEl = document.createElement('div');
    activityEl.className = 'activity-item';
    activityEl.style.cssText = `
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.2s;
    `;
    
    const timeAgo = getTimeAgo(new Date(activity.timestamp));
    
    activityEl.innerHTML = `
      <div style="flex: 1;">
        <div style="font-weight: 500; color: #333; margin-bottom: 4px;">${activity.text}</div>
        <div style="font-size: 12px; color: #666;">${activity.language} • ${timeAgo}</div>
      </div>
      <div style="display: flex; gap: 6px;">
        ${activity.url && activity.url.includes('youtube.com') ? `
          <button class="replay-video-btn" data-video-url="${activity.url}" 
                  style="background: #ff0000; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;" 
                  title="返回影片">
            ⏰
          </button>
        ` : ''}
        <button class="reanalyze-btn" data-text="${activity.text}" data-language="${activity.language}"
                style="background: #1a73e8; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer;">
          重新分析
        </button>
      </div>
    `;
    
    // Add event listener for the reanalyze button
    const reanalyzeBtn = activityEl.querySelector('.reanalyze-btn');
    if (reanalyzeBtn) {
      reanalyzeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = reanalyzeBtn.dataset.text;
        const language = reanalyzeBtn.dataset.language;
        reAnalyzeFromHistory(text, language);
      });
    }
    
    // Add event listener for the replay video button
    const replayBtn = activityEl.querySelector('.replay-video-btn');
    if (replayBtn) {
      replayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const videoUrl = replayBtn.dataset.videoUrl;
        if (videoUrl) {
          console.log('🎬 VIDEO TAB - Opening video from recent activity:', videoUrl);
          window.open(videoUrl, '_blank');
        }
      });
    }
    
    activityEl.addEventListener('mouseenter', () => {
      activityEl.style.backgroundColor = '#f8f9ff';
      activityEl.style.transform = 'translateX(4px) scale(1.01)';
      activityEl.style.boxShadow = '0 2px 12px rgba(26, 115, 232, 0.1)';
      activityEl.style.borderLeft = '3px solid #1a73e8';
      activityEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
    
    activityEl.addEventListener('mouseleave', () => {
      activityEl.style.backgroundColor = '';
      activityEl.style.transform = '';
      activityEl.style.boxShadow = '';
      activityEl.style.borderLeft = '';
    });
    
    activityList.appendChild(activityEl);
  });
}

// Update top vocabulary section
function updateTopVocabulary() {
  const vocabularyList = document.getElementById('quickVocabList');
  if (!vocabularyList) return;
  
  vocabularyList.innerHTML = '';
  
  if (learningStats.topVocabulary.length === 0) {
    vocabularyList.innerHTML = '<div class="vocabulary-empty">開始查詢詞彙後，這裡會顯示您的熱門詞彙</div>';
    return;
  }
  
  learningStats.topVocabulary.slice(0, 10).forEach((vocab, index) => {
    const vocabEl = document.createElement('div');
    vocabEl.className = 'vocabulary-item';
    vocabEl.style.cssText = `
      padding: 10px 12px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.2s;
    `;
    
    vocabEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="background: #1a73e8; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500;">
          ${index + 1}
        </span>
        <div>
          <div style="font-weight: 500; color: #333;">${vocab.word}</div>
          <div style="font-size: 12px; color: #666;">${vocab.language}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: 500; color: #1a73e8;">${vocab.count}次</div>
        <div style="font-size: 12px; color: #666;">${getTimeAgo(new Date(vocab.lastSeen))}</div>
      </div>
    `;
    
    vocabEl.addEventListener('mouseenter', () => {
      vocabEl.style.backgroundColor = '#f0f8ff';
      vocabEl.style.transform = 'translateX(6px) scale(1.02)';
      vocabEl.style.boxShadow = '0 3px 15px rgba(26, 115, 232, 0.15)';
      vocabEl.style.borderLeft = '4px solid #1a73e8';
      vocabEl.style.borderRadius = '0 8px 8px 0';
      vocabEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      
      // Add pulse effect to the rank number
      const rankSpan = vocabEl.querySelector('span');
      if (rankSpan) {
        rankSpan.style.animation = 'pulse 1s ease-in-out';
      }
    });
    
    vocabEl.addEventListener('mouseleave', () => {
      vocabEl.style.backgroundColor = '';
      vocabEl.style.transform = '';
      vocabEl.style.boxShadow = '';
      vocabEl.style.borderLeft = '';
      vocabEl.style.borderRadius = '';
      
      // Remove pulse effect
      const rankSpan = vocabEl.querySelector('span');
      if (rankSpan) {
        rankSpan.style.animation = '';
      }
    });
    
    vocabEl.addEventListener('click', () => {
      // Quick analyze this vocabulary
      reAnalyzeFromHistory(vocab.word, vocab.language);
    });
    
    vocabularyList.appendChild(vocabEl);
  });
}

// Update AI insights section
function updateAIInsights() {
  const insightsList = document.getElementById('aiInsightsList');
  if (!insightsList) return;
  
  const insights = generateLearningInsights();
  insightsList.innerHTML = '';
  
  insights.forEach(insight => {
    const insightEl = document.createElement('div');
    insightEl.className = 'insight-item';
    insightEl.style.cssText = `
      padding: 12px;
      background: ${insight.color};
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 4px solid ${insight.borderColor};
    `;
    
    insightEl.innerHTML = `
      <div style="font-weight: 500; color: #333; margin-bottom: 4px;">${insight.title}</div>
      <div style="font-size: 13px; color: #666; line-height: 1.4;">${insight.description}</div>
      <div style="margin-top: 8px;">
        <div style="background: #fff; height: 4px; border-radius: 2px; overflow: hidden;">
          <div style="background: ${insight.borderColor}; height: 100%; width: ${insight.progress}%; transition: width 0.3s;"></div>
        </div>
        <div style="font-size: 11px; color: #666; margin-top: 4px;">${insight.progress}% 完成</div>
      </div>
    `;
    
    insightsList.appendChild(insightEl);
  });
}

// Generate learning insights
function generateLearningInsights() {
  const insights = [];
  
  // Daily learning progress
  const todayProgress = Math.min((learningStats.todaySearches / 10) * 100, 100);
  insights.push({
    title: '今日學習進度',
    description: `今天已完成 ${learningStats.todaySearches} 次查詢，繼續保持！`,
    progress: todayProgress,
    color: '#e8f5e8',
    borderColor: '#4caf50'
  });
  
  // Vocabulary mastery
  const vocabularyProgress = Math.min((learningStats.vocabularyCount / 50) * 100, 100);
  insights.push({
    title: '詞彙掌握度',
    description: `已掌握 ${learningStats.vocabularyCount} 個詞彙，距離下一個里程碑還需 ${Math.max(0, 50 - learningStats.vocabularyCount)} 個`,
    progress: vocabularyProgress,
    color: '#e3f2fd',
    borderColor: '#2196f3'
  });
  
  // Learning consistency
  const consistencyProgress = Math.min((learningStats.totalSearches / 100) * 100, 100);
  insights.push({
    title: '學習一致性',
    description: `總共完成 ${learningStats.totalSearches} 次學習，保持規律學習很重要！`,
    progress: consistencyProgress,
    color: '#fff3e0',
    borderColor: '#ff9800'
  });
  
  return insights;
}

// Helper function to get time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '剛剛';
  if (diffMins < 60) return `${diffMins}分鐘前`;
  if (diffHours < 24) return `${diffHours}小時前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-TW');
}

// Re-analyze from history
function reAnalyzeFromHistory(text, language) {
  console.log('🔄 Re-analyzing from history:', text, language);
  
  // Switch to analysis tab
  const analysisBtn = document.getElementById('showAnalysisBtn');
  if (analysisBtn) analysisBtn.click();
  
  // Perform analysis
  setTimeout(() => {
    loadYouGlish('', text, language);
  }, 100);
}

// Quick action functions
function startPracticeSession() {
  console.log('🎯 Starting practice session');
  // Switch to vocabulary/flashcard tab if available
  const websiteBtn = document.getElementById('showWebsiteBtn');
  if (websiteBtn) websiteBtn.click();
}

function reviewVocabulary() {
  console.log('📚 Reviewing vocabulary');
  // Focus on top vocabulary
  updateTopVocabulary();
}

function exportLearningData() {
  console.log('💾 Exporting learning data');
  const dataToExport = {
    stats: learningStats,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `youglish-learning-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
let learningAnalytics = null; // Disabled analytics functionality
let studySessionGenerator = null;

// Authentication UI handlers
let authManager = null;
let cloudSyncManager = null;
let analyticsManager = null;
let subscriptionManager = null;

// Authentication UI setup
function setupAuthenticationUI() {
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userInfo = document.getElementById('userInfo');
  const userAvatar = document.getElementById('userAvatar');
  const userEmail = document.getElementById('userEmail');

  // Sign In button click
  signInBtn.addEventListener('click', () => {
    // Open authentication popup
    const authUrl = chrome.runtime.getURL('auth-ui.html');
    const popup = window.open(authUrl, 'auth', 'width=500,height=700,scrollbars=yes,resizable=yes');
    
    // Listen for authentication success
    window.addEventListener('message', (event) => {
      if (event.data.type === 'auth-success') {
        updateAuthUI(event.data.user);
        popup.close();
      }
    });
  });

  // Sign Out button click
  signOutBtn.addEventListener('click', async () => {
    if (authManager) {
      const result = await authManager.signOut();
      if (result.success) {
        updateAuthUI(null);
      }
    }
  });

  // Check initial auth state
  setTimeout(() => {
    if (authManager?.isUserAuthenticated()) {
      updateAuthUI(authManager.getCurrentUser());
    }
  }, 1000);
}

// Update authentication UI based on user state
function updateAuthUI(user) {
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userInfo = document.getElementById('userInfo');
  const userAvatar = document.getElementById('userAvatar');
  const userEmail = document.getElementById('userEmail');

  if (user) {
    // User is signed in
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'block';
    userInfo.style.display = 'flex';
    
    userAvatar.src = user.picture || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    userEmail.textContent = user.name || user.email;
    
    // Update subscription status
    const subscription = user.subscription;
    if (subscription && subscription.tier !== 'free') {
      signOutBtn.textContent = `👑 ${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}`;
      signOutBtn.title = `Signed in as ${user.email} (${subscription.tier} plan)`;
    } else {
      signOutBtn.textContent = '👤 Sign Out';
      signOutBtn.title = `Signed in as ${user.email} (Free plan)`;
    }
  } else {
    // User is signed out
    signInBtn.style.display = 'block';
    signOutBtn.style.display = 'none';
    userInfo.style.display = 'none';
  }
}

// Initialize services when scripts load
window.addEventListener('load', async () => {
  try {
    // 🚨 EMERGENCY: Run cleanup IMMEDIATELY on page load
    if (typeof emergencyCleanup === 'function') {
      emergencyCleanup();
    }
    
    if (typeof StorageManager !== 'undefined') {
      storageManager = new StorageManager();
    }
    
    // Analytics functionality disabled
    
    // Study session generator disabled (requires analytics)

    // Initialize authentication managers
    if (typeof window.authManager !== 'undefined') {
      authManager = window.authManager;
      log('Auth Manager initialized');
    }
    
    if (typeof window.cloudSyncManager !== 'undefined') {
      cloudSyncManager = window.cloudSyncManager;
      log('Cloud Sync Manager initialized');
    }
    
    if (typeof window.analyticsManager !== 'undefined') {
      analyticsManager = window.analyticsManager;
      log('Analytics Manager initialized');
    }
    
    if (typeof window.subscriptionManager !== 'undefined') {
      subscriptionManager = window.subscriptionManager;
      log('Subscription Manager initialized');
    }

    // Setup authentication UI
    setupAuthenticationUI();
    
    log('All services initialized successfully');
    
    // Add global event delegation for CSP-compliant event handling
    document.addEventListener('click', (e) => {
      // Handle audio badges with data-report-id
      const audioBadge = e.target.closest('[data-report-id]');
      if (audioBadge && audioBadge.classList.contains('audio-badge')) {
        e.preventDefault();
        const reportId = audioBadge.getAttribute('data-report-id');
        playReportAudio(reportId);
        return;
      }
      
      // Handle buttons with data-action attributes
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.preventDefault();
        const action = actionBtn.getAttribute('data-action');
        
        // Execute the action function if it exists
        if (typeof window[action] === 'function') {
          console.log('Executing action:', action);
          try {
            // Add timeout protection for flashcard-related actions
            if (action.includes('createFlashcard') || action.includes('flashcard')) {
              const actionTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Action timeout')), 10000);
              });
              
              const actionPromise = Promise.resolve(window[action]());
              
              Promise.race([actionPromise, actionTimeout]).catch(error => {
                console.error('Flashcard action failed or timed out:', action, error);
                if (error.message.includes('timeout')) {
                  showMessage('建立記憶卡超時，請重試', 'error');
                } else {
                  showMessage('建立記憶卡失敗', 'error');
                }
              });
            } else {
              // Normal execution for non-flashcard actions
              window[action]();
            }
          } catch (error) {
            console.error('Action execution failed:', action, error);
            showMessage('操作失敗，請重試', 'error');
          }
        } else if (action.includes('(')) {
          // Handle function calls with parameters (security-limited)
          try {
            // Only allow safe, predefined function calls
            if (action === 'loadAnalyticsView()') {
              loadAnalyticsView();
            }
          } catch (error) {
            console.error('Action execution failed:', error);
          }
        }
        return;
      }
    });
    
  } catch (error) {
    await handleError(error, { operation: 'service_initialization' });
  }
});

// 顯示搜尋結果
function showSearchResult(queryData) {
  log('showSearchResult called with:', queryData);
  
  // Track vocabulary interaction
  if (learningAnalytics && queryData.text && queryData.language) {
    learningAnalytics.recordVocabularyInteraction(
      queryData.text, 
      queryData.language, 
      'lookup', 
      { webpage: window.location.href }
    );
  }
  
  const welcome = document.getElementById('welcome');
  const searchInfo = document.getElementById('searchInfo');
  const searchResult = document.getElementById('searchResult');
  const searchTerm = document.getElementById('searchTerm');
  const searchLanguage = document.getElementById('searchLanguage');
  const languageBadge = document.getElementById('languageBadge');
  const openInNewTabBtn = document.getElementById('openInNewTabBtn');
  
  log('Elements found:', {
    welcome: !!welcome,
    searchInfo: !!searchInfo,
    searchResult: !!searchResult,
    searchTerm: !!searchTerm,
    searchLanguage: !!searchLanguage,
    languageBadge: !!languageBadge,
    openInNewTabBtn: !!openInNewTabBtn
  });
  
  // 檢查是否為新的搜尋查詢
  const queryKey = `${queryData.text}_${queryData.language}`;
  const isNewQuery = !lastProcessedQuery || lastProcessedQuery !== queryKey;
  
  // 儲存當前查詢數據
  currentQueryData = queryData;
  
  // 如果是新查詢，清空之前的分析結果並更新追蹤
  // 但不要清空已設定的分析結果 (例如重播時的快取結果)
  if (isNewQuery) {
    if (!currentAIAnalysis || queryData.autoAnalysis !== false) {
      currentAIAnalysis = null;
    }
    lastProcessedQuery = queryKey;
  }
  
  // 隱藏歡迎畫面
  welcome.style.display = 'none';
  
  // 更新搜尋資訊
  searchTerm.textContent = queryData.text;
  searchLanguage.textContent = languageNames[queryData.language] || queryData.language;
  languageBadge.textContent = (queryData.language || '').toUpperCase();
  searchInfo.style.display = 'block';
  
  // 顯示新分頁按鈕
  openInNewTabBtn.style.display = 'inline-block';
  
  // 更新搜尋結果面板
  document.getElementById('resultText').textContent = queryData.text;
  document.getElementById('resultLanguage').textContent = languageNames[queryData.language] || queryData.language;
  
  // 顯示搜尋結果
  searchResult.style.display = 'block';
  
  // 初始化視圖切換
  initializeViewControls();
  
  // 確保分析視圖是預設顯示的，並且AI分析區域可見
  const analysisView = document.getElementById('analysisView');
  const videoView = document.getElementById('videoView');
  const historyView = document.getElementById('historyView');
  const savedReportsView = document.getElementById('savedReportsView');
  const flashcardsView = document.getElementById('flashcardsView');
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  
  if (analysisView) {
    analysisView.style.display = 'block';
    // 確保AI分析區域也是可見的
    const aiAnalysisSection = document.getElementById('aiAnalysisSection');
    if (aiAnalysisSection) {
      aiAnalysisSection.style.display = 'block';
      // Update prompt type indicator when AI section is shown
      updatePromptTypeIndicator();
    }
  }
  if (videoView) videoView.style.display = 'none';
  if (historyView) historyView.style.display = 'none';
  if (savedReportsView) savedReportsView.style.display = 'none';
  if (flashcardsView) flashcardsView.style.display = 'none';
  
  // 設定分析按鈕為活動狀態
  document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
  if (showAnalysisBtn) showAnalysisBtn.classList.add('active');
  
  log('Analysis view set as default active view');
  
  // 載入多個發音網站選項
  loadPronunciationSites(queryData);
  
  // 只對新查詢觸發自動分析和發音 (如果啟用且服務可用)
  if (isNewQuery && queryData.autoAnalysis === true) {
    setTimeout(async () => {
      try {
        log('Auto-analysis requested for:', queryData.text);
        
        // Ensure aiService is initialized first
        if (typeof aiService !== 'undefined' && aiService && !aiService.isInitialized) {
          log('Initializing AI service for auto-generation...');
          await aiService.initialize();
        }
        
        if (typeof generateAIAnalysis === 'function' && typeof aiService !== 'undefined' && aiService) {
          // Auto-generate AI analysis
          generateAIAnalysis().catch(err => log('Auto-analysis failed quietly:', err));
          
          // Auto-generate and cache audio for future flashcard use
          setTimeout(async () => {
            if (currentQueryData.text && currentQueryData.language) {
              try {
                log('🔊 Auto-generating and caching audio for:', currentQueryData.text);
                // Try OpenAI TTS first (just cache, don't play)
                const audioData = await generateOpenAIAudio(
                  currentQueryData.text, 
                  currentQueryData.language, 
                  false // Don't play immediately, just cache
                );
                
                if (audioData) {
                  log('✅ Audio cached for future flashcard use');
                  
                  // Update existing saved report with audio data if auto-save is enabled
                  if (autoSaveEnabled && storageManager && typeof storageManager.getAIReports === 'function') {
                    try {
                      // Find and update the existing report with audio data
                      const reports = await storageManager.getAIReports();
                      const matchingReport = reports.find(r => 
                        r.searchText === currentQueryData.text && 
                        r.language === currentQueryData.language
                      );
                      
                      if (matchingReport && !matchingReport.audioData) {
                        // Update the report with audio data
                        matchingReport.audioData = {
                          audioUrl: audioData.audioUrl,
                          size: audioData.size,
                          voice: audioData.voice || 'OpenAI TTS'
                        };
                        
                        // Save the updated report back
                        await storageManager.saveAIReport(
                          matchingReport.searchText,
                          matchingReport.language,
                          matchingReport.analysis,
                          matchingReport.audioData,
                          matchingReport.videoSource,
                          true, // updateExisting = true
                          matchingReport.detectionMethod
                        );
                        
                        log('🔄 Updated saved report with audio data');
                        
                        // Refresh the saved reports display if we're on that tab
                        const saveTab = document.getElementById('saveTab');
                        if (saveTab && saveTab.style.display !== 'none') {
                          loadSavedReports();
                        }
                      }
                    } catch (error) {
                      log('⚠️ Failed to update report with audio:', error);
                    }
                  }
                } else if (aiService && aiService.isAudioAvailable && aiService.isAudioAvailable()) {
                  // Fallback to original audio generation
                  log('⚠️ OpenAI TTS not available, using fallback audio generation');
                  generateAudioPronunciation().catch(err => log('Auto-audio failed quietly:', err));
                } else {
                  log('Auto-audio skipped: no audio service available');
                }
              } catch (error) {
                log('Auto-audio caching failed:', error);
                // Fallback to original method if available
                if (aiService && aiService.isAudioAvailable && aiService.isAudioAvailable()) {
                  generateAudioPronunciation().catch(err => log('Auto-audio failed quietly:', err));
                }
              }
            }
          }, 3000); // 3 second delay to let AI analysis finish first
          
        } else {
          log('Auto-generation skipped: AI service not available or not initialized');
          log('Debug info:', {
            generateAIAnalysisExists: typeof generateAIAnalysis === 'function',
            aiServiceExists: typeof aiService !== 'undefined',
            aiServiceValue: !!aiService,
            isInitialized: aiService?.isInitialized
          });
        }
      } catch (error) {
        log('Auto-analysis error (non-blocking):', error);
      }
    }, 2000); // Longer delay to ensure everything is loaded
  }
  
  // AI analysis section should be visible by default in analysis view
}

// 初始化視圖控制
function initializeViewControls() {
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  const showVideoBtn = document.getElementById('showVideoBtn');
  const showWebsitesBtn = document.getElementById('showWebsitesBtn');
  const showHistoryBtn = document.getElementById('showHistoryBtn');
  const showSavedReportsBtn = document.getElementById('showSavedReportsBtn');
  const showFlashcardsBtn = document.getElementById('showFlashcardsBtn');
  // Analytics button removed
  const showTranscriptBtn = document.getElementById('showTranscriptBtn');
  const openNewTabBtn = document.getElementById('openNewTabBtn');
  const analysisView = document.getElementById('analysisView');
  const videoView = document.getElementById('videoView');
  const websitesView = document.getElementById('websitesView');
  const historyView = document.getElementById('historyView');
  const savedReportsView = document.getElementById('savedReportsView');
  const flashcardsView = document.getElementById('flashcardsView');
  // Analytics view removed
  const transcriptView = document.getElementById('transcriptView');
  
  // 分析視圖按鈕
  if (showAnalysisBtn) {
    showAnalysisBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showAnalysisBtn.classList.add('active');
      
      // Show analysis view, hide all others
      if (analysisView) analysisView.style.display = 'block';
      if (videoView) videoView.style.display = 'none';
      if (websitesView) websitesView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      // Analytics view removed
      if (transcriptView) transcriptView.style.display = 'none';
      
      log('Switched to analysis view');
    };
  }
  
  // 影片視圖按鈕
  if (showVideoBtn) {
    showVideoBtn.onclick = () => {
      console.log('🎥 VIDEO TAB CLICKED! Loading pronunciation sites');
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showVideoBtn.classList.add('active');
      
      // Show video view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'block';
      if (websitesView) websitesView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      // Analytics view removed
      if (transcriptView) transcriptView.style.display = 'none';
      
      // Initialize learning dashboard for video tab
      console.log('📹 Video tab clicked - Initializing learning dashboard');
      
      // Update learning dashboard with current stats
      updateLearningDashboard();
      
      // Don't initialize video learning controls as they override the HTML dashboard
      // The video tab should show the learning dashboard from HTML, not dynamic content
      
      log('Switched to video view');
    };
  }
  
  // 網站視圖按鈕
  if (showWebsitesBtn) {
    showWebsitesBtn.onclick = () => {
      console.log('🌐 WEBSITES TAB CLICKED! Loading pronunciation sites');
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showWebsitesBtn.classList.add('active');
      
      // Show websites view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (websitesView) websitesView.style.display = 'block';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      // Analytics view removed
      if (transcriptView) transcriptView.style.display = 'none';
      
      // Load pronunciation sites for current query
      console.log('🌐 Website tab clicked. currentQueryData:', currentQueryData);
      
      const queryToUse = (currentQueryData && currentQueryData.text) ? 
        currentQueryData : 
        { text: 'hello', language: 'english' };
        
      console.log('🌐 Loading pronunciation sites for:', queryToUse.text);
      
      // Load pronunciation sites for websites view
      loadWebsitePronunciationSites(queryToUse);
      
      log('Switched to websites view');
    };
  }
  
  // 歷史記錄視圖按鈕
  if (showHistoryBtn) {
    showHistoryBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showHistoryBtn.classList.add('active');
      
      // Show history view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (websitesView) websitesView.style.display = 'none';
      if (historyView) historyView.style.display = 'block';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      // Analytics view removed
      if (transcriptView) transcriptView.style.display = 'none';
      
      loadHistoryView();
      console.log('Switched to history view');
    };
  }
  
  // 已保存報告視圖按鈕
  if (showSavedReportsBtn) {
    showSavedReportsBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showSavedReportsBtn.classList.add('active');
      
      // Show saved reports view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (websitesView) websitesView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'block';
      if (flashcardsView) flashcardsView.style.display = 'none';
      // Analytics view removed
      
      loadSavedReports();
      console.log('Switched to saved reports view');
    };
  }
  
  // 記憶卡視圖按鈕
  if (showFlashcardsBtn) {
    showFlashcardsBtn.onclick = () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showFlashcardsBtn.classList.add('active');
      
      // Show flashcards view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (websitesView) websitesView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      // Analytics view removed
      if (flashcardsView) flashcardsView.style.display = 'block';
      
      loadFlashcardsView();
      console.log('Switched to flashcards view');
    };
  }

  // Analytics view button removed

  // Transcript view button
  if (showTranscriptBtn) {
    showTranscriptBtn.onclick = async () => {
      // Remove active from all view buttons
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showTranscriptBtn.classList.add('active');
      
      // Show transcript view, hide all others
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (websitesView) websitesView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      if (savedReportsView) savedReportsView.style.display = 'none';
      if (flashcardsView) flashcardsView.style.display = 'none';
      // Analytics view removed
      // Show transcript view
      if (transcriptView) transcriptView.style.display = 'block';
      
      await loadTranscriptView();
      console.log('Switched to transcript view');
    };
  }
  
  // 新分頁按鈕
  if (openNewTabBtn) {
    openNewTabBtn.onclick = () => {
      if (currentQueryData.primaryUrl) {
        chrome.tabs.create({ url: currentQueryData.primaryUrl });
      }
    };
  }
  
  // searchAgainBtn removed - was causing UI conflicts
}

// 載入發音網站選項 - 從 amazing copy 複製的完整版本
function loadPronunciationSites(queryData) {
  const pronunciationOptions = document.getElementById('pronunciationOptions');
  const siteDescriptions = document.getElementById('siteDescriptions');
  
  // 清空現有內容
  // Clear content safely
  if (pronunciationOptions) {
    while (pronunciationOptions.firstChild) {
      pronunciationOptions.removeChild(pronunciationOptions.firstChild);
    }
  }
  if (siteDescriptions) {
    while (siteDescriptions.firstChild) {
      siteDescriptions.removeChild(siteDescriptions.firstChild);
    }
  }
  
  // 根據語言定義網站選項
  const siteConfigs = getSiteConfigs(queryData.language);
  
  // 按類別分組網站
  const categories = {
    'pronunciation': { name: '🎯 發音學習', sites: [] },
    'dictionary': { name: '📚 字典查詢', sites: [] },
    'context': { name: '💭 語境例句', sites: [] },
    'translation': { name: '🌐 翻譯服務', sites: [] },
    'examples': { name: '📝 例句資料庫', sites: [] },
    'community': { name: '👥 社群問答', sites: [] },
    'academic': { name: '🎓 學術寫作', sites: [] },
    'slang': { name: '🏙️ 俚語俗語', sites: [] },
    'search': { name: '🔍 搜尋引擎', sites: [] }
  };
  
  // 分類網站 with priority assignments
  siteConfigs.forEach((config, index) => {
    const category = config.category || 'pronunciation';
    const url = queryData.allUrls && queryData.allUrls[config.name] ? 
                queryData.allUrls[config.name] : 
                generateUrlForSite(config.name, queryData.text, queryData.language);
    
    // Assign priority based on site name and category
    let priority = 'recommended';
    if (config.name === 'YouGlish' || (config.category === 'pronunciation' && index === 0)) {
      priority = 'primary';
    } else if (config.name === 'PlayPhrase.me' || (config.category === 'pronunciation' && index === 1)) {
      priority = 'secondary';
    } else if ((config.category === 'pronunciation' && index === 2) || config.name === 'Forvo') {
      priority = 'tertiary';
    }
    
    categories[category].sites.push({
      ...config,
      url: url,
      isPrimary: priority === 'primary',
      isSecondary: priority === 'secondary',
      isTertiary: priority === 'tertiary',
      priority: priority
    });
  });
  
  // 生成分類顯示
  Object.keys(categories).forEach(categoryKey => {
    const category = categories[categoryKey];
    if (category.sites.length === 0) return;
    
    // 創建分類標題
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';
    // Use SecurityUtils for safe DOM manipulation
    if (window.SecurityFixes) {
      window.SecurityFixes.safeClearElement(categoryHeader);
      const h4 = window.SecurityFixes.safeCreateElement('h4', category.name);
      const span = window.SecurityFixes.safeCreateElement('span', `${category.sites.length} 個網站`, 'category-count');
      categoryHeader.appendChild(h4);
      categoryHeader.appendChild(span);
    } else {
      categoryHeader.innerHTML = `
        <h4>${category.name}</h4>
        <span class="category-count">${category.sites.length} 個網站</span>
      `;
    }
    if (pronunciationOptions) pronunciationOptions.appendChild(categoryHeader);
    
    // 生成該分類的網站選項
    category.sites.forEach(site => {
      const option = document.createElement('div');
      option.className = `pronunciation-option ${site.isPrimary ? 'primary' : ''}`;
      
      let badgeText = '推薦開啟';
      let badgeClass = 'recommended';
      
      switch(site.priority) {
        case 'primary':
          badgeText = '主要開啟';
          badgeClass = 'primary';
          break;
        case 'secondary':
          badgeText = '備選開啟';
          badgeClass = 'secondary';
          break;
        case 'tertiary':
          badgeText = '其他開啟';
          badgeClass = 'tertiary';
          break;
        default:
          badgeText = '推薦開啟';
          badgeClass = 'recommended';
      }
      
      // Use SecurityUtils for safe DOM manipulation
      if (window.SecurityFixes) {
        window.SecurityFixes.safeClearElement(option);
        
        const infoDiv = window.SecurityFixes.safeCreateElement('div', '', 'option-info');
        const iconSpan = window.SecurityFixes.safeCreateElement('span', site.icon, 'option-icon');
        const detailsDiv = window.SecurityFixes.safeCreateElement('div', '', 'option-details');
        const nameH5 = window.SecurityFixes.safeCreateElement('h5', site.name);
        const descP = window.SecurityFixes.safeCreateElement('p', site.description);
        
        detailsDiv.appendChild(nameH5);
        detailsDiv.appendChild(descP);
        infoDiv.appendChild(iconSpan);
        infoDiv.appendChild(detailsDiv);
        
        const actionDiv = window.SecurityFixes.safeCreateElement('div', '', 'option-actions');
        const badgeSpan = window.SecurityFixes.safeCreateElement('span', badgeText, `option-badge ${badgeClass}`);
        
        actionDiv.appendChild(badgeSpan);
        option.appendChild(infoDiv);
        option.appendChild(actionDiv);
      } else {
        option.innerHTML = `
          <div class="option-info">
            <span class="option-icon">${site.icon}</span>
            <div class="option-details">
              <h5>${site.name}</h5>
              <p>${site.description}</p>
            </div>
          </div>
          <div class="option-actions">
            <span class="option-badge ${badgeClass}">${badgeText}</span>
          </div>
        `;
      }
      
      // Add click handler for the entire option
      option.addEventListener('click', () => {
        chrome.tabs.create({ url: site.url });
        // Add visual feedback
        option.style.backgroundColor = '#e3f2fd';
        setTimeout(() => {
          option.style.backgroundColor = '';
        }, 300);
      });

      if (pronunciationOptions) {
        pronunciationOptions.appendChild(option);
      }
    });
  });
  
  // 生成網站描述
  if (siteDescriptions) {
    siteConfigs.forEach(config => {
      const li = document.createElement('li');
      // Use SecurityUtils for safe text content
      if (window.SecurityFixes) {
        window.SecurityFixes.safeClearElement(li);
        const strong = window.SecurityFixes.safeCreateElement('strong', config.name);
        const description = document.createTextNode(`: ${config.longDescription || config.description}`);
        li.appendChild(strong);
        li.appendChild(description);
      } else {
        li.innerHTML = `<strong>${config.name}</strong>: ${config.longDescription || config.description}`;
      }
      siteDescriptions.appendChild(li);
    });
  }
}

// 載入網站
function loadSite(url) {
  if (!url) return;
  
  const iframe = document.getElementById('youglishFrame');
  const loading = document.getElementById('loading');
  
  if (iframe && loading) {
    loading.style.display = 'block';
    iframe.src = url;
    
    iframe.onload = () => {
      loading.style.display = 'none';
    };
    
    iframe.onerror = () => {
      loading.style.display = 'none';
      console.error('Failed to load URL:', url);
    };
  }
}

// 根據語言獲取網站配置 - 從 amazing copy 複製的完整版本
function getSiteConfigs(language) {
  const configs = {
    english: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 影片發音範例',
        longDescription: '基於 YouTube 影片的發音範例，涵蓋各種口音和情境',
        category: 'pronunciation'
      },
      {
        name: 'PlayPhrase.me',
        icon: '🎬',
        description: '電影片段中的真實發音',
        longDescription: '從電影和電視劇中提取真實的發音片段，適合學習自然語調',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '多國母語者發音字典',
        longDescription: '由母語者錄製的標準發音，支援多種口音和方言',
        category: 'pronunciation'
      },
      {
        name: 'Cambridge Dictionary',
        icon: '📖',
        description: '權威英語字典',
        longDescription: '劍橋大學出版的權威英語字典，包含詳細定義、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Thesaurus.com',
        icon: '🔤',
        description: '英語同義詞字典',
        longDescription: '豐富的同義詞、反義詞和相關詞彙，幫助擴展詞彙量',
        category: 'dictionary'
      },
      {
        name: 'Reverso Context',
        icon: '🌐',
        description: '真實語境例句',
        longDescription: '來自網絡和文檔的真實使用例句，了解詞彙的實際用法',
        category: 'context'
      },
      {
        name: 'Urban Dictionary',
        icon: '🏙️',
        description: '英語俚語字典',
        longDescription: '現代英語俚語、網絡用語和非正式表達的字典',
        category: 'slang'
      },
      {
        name: 'Ludwig',
        icon: '🎓',
        description: '學術寫作範例',
        longDescription: '學術和專業寫作的範例，適合提高正式英語寫作水平',
        category: 'academic'
      }
    ],
    japanese: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 日語發音範例',
        longDescription: '基於 YouTube 影片的日語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'PlayPhrase.me',
        icon: '🎬',
        description: '影視劇日語發音',
        longDescription: '從電影和電視劇中查找日語詞彙的真實發音和使用情境',
        category: 'pronunciation'
      },
      {
        name: 'Immersion Kit',
        icon: '🎌',
        description: '日語動漫例句',
        longDescription: '從日語動漫、電影中提取真實的日語例句和發音',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '日語母語者發音',
        longDescription: '由日語母語者錄製的標準發音',
        category: 'pronunciation'
      },
      {
        name: 'Jisho.org',
        icon: '📚',
        description: '最佳日語字典',
        longDescription: '最全面的線上日語字典，包含漢字、讀音、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Reverso Context',
        icon: '🌐',
        description: '日語語境例句',
        longDescription: '真實的日語使用例句，幫助理解詞彙和語法的實際用法',
        category: 'context'
      },
      {
        name: 'Tatoeba',
        icon: '💬',
        description: '日語例句資料庫',
        longDescription: '大量的日語例句和翻譯，適合學習日語表達方式',
        category: 'examples'
      },
      {
        name: 'HiNative',
        icon: '🗣️',
        description: '日語母語者問答',
        longDescription: '向日語母語者提問，獲得專業的語言使用建議',
        category: 'community'
      }
    ],
    dutch: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 荷蘭語範例',
        longDescription: '基於 YouTube 影片的荷蘭語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '荷蘭語母語者發音',
        longDescription: '由荷蘭語母語者錄製的標準發音，最適合荷蘭語學習',
        category: 'pronunciation'
      },
      {
        name: 'Van Dale',
        icon: '📖',
        description: '權威荷蘭語字典',
        longDescription: '荷蘭最權威的字典，包含詳細定義、語法和用法',
        category: 'dictionary'
      },
      {
        name: 'Linguee',
        icon: '🔍',
        description: '荷蘭語翻譯與例句',
        longDescription: '基於真實文檔的翻譯和例句，了解荷蘭語的實際用法',
        category: 'context'
      },
      {
        name: 'Reverso Context',
        icon: '🌐',
        description: '荷蘭語語境例句',
        longDescription: '真實的荷蘭語使用例句，幫助理解詞彙的實際用法',
        category: 'context'
      },
      {
        name: 'Google 搜尋',
        icon: '🔍',
        description: '荷蘭語發音搜尋',
        longDescription: '使用 Google 搜尋荷蘭語發音相關資源',
        category: 'search'
      }
    ],
    korean: [
      {
        name: 'YouGlish',
        icon: '📺',
        description: 'YouTube 韓語發音範例',
        longDescription: '基於 YouTube 影片的韓語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        icon: '🔊',
        description: '韓語母語者發音',
        longDescription: '由韓語母語者錄製的標準發音',
        category: 'pronunciation'
      },
      {
        name: 'Naver Dictionary',
        icon: '📚',
        description: '韓語權威字典',
        longDescription: '韓國最權威的線上字典，包含詳細定義、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Papago',
        icon: '🔄',
        description: 'Naver 翻譯服務',
        longDescription: '韓國 Naver 開發的高品質翻譯服務，特別適合韓語',
        category: 'translation'
      },
      {
        name: 'HiNative',
        icon: '🗣️',
        description: '韓語母語者問答',
        longDescription: '向韓語母語者提問，獲得專業的語言使用建議',
        category: 'community'
      },
      {
        name: 'Google 搜尋',
        icon: '🔍',
        description: '韓語發音搜尋',
        longDescription: '使用 Google 搜尋韓語發音相關資源',
        category: 'search'
      }
    ]
  };
  
  return configs[language] || configs.english;
}

// 為網站生成 URL
function generateUrlForSite(siteName, text, language) {
  const encodedText = encodeURIComponent(text);
  
  // Handle language-specific URLs
  if (siteName === 'PlayPhrase.me') {
    // Language-specific PlayPhrase.me URLs
    const languageMap = {
      'japanese': 'ja',
      'korean': 'ko',
      'dutch': 'nl',
      'english': 'en'
    };
    
    const langCode = languageMap[language];
    if (langCode && langCode !== 'en') {
      return `https://www.playphrase.me/#/search?q=${encodedText}&language=${langCode}`;
    }
    
    // Default English PlayPhrase.me (no language parameter needed)
    return `https://www.playphrase.me/#/search?q=${encodedText}`;
  }
  
  if (siteName === 'Immersion Kit') {
    // Japanese sentence examples from anime/movies
    return `https://www.immersionkit.com/dictionary?keyword=${encodedText}`;
  }
  
  if (siteName === 'Reverso Context') {
    // Language-specific Reverso Context
    const reverseLangMap = {
      'english': 'english-chinese',
      'japanese': 'japanese-chinese', 
      'korean': 'korean-chinese',
      'dutch': 'dutch-chinese'
    };
    const reverseLang = reverseLangMap[language] || 'english-chinese';
    return `https://context.reverso.net/translation/${reverseLang}/${encodedText}`;
  }
  
  if (siteName === 'Papago') {
    // Language-specific Papago
    const papagoLangMap = {
      'english': '?sk=en&tk=zh-TW',
      'japanese': '?sk=ja&tk=zh-TW',
      'korean': '?sk=ko&tk=zh-TW',
      'dutch': '?sk=nl&tk=zh-TW'
    };
    const papagoLang = papagoLangMap[language] || '?sk=en&tk=zh-TW';
    return `https://papago.naver.com/${papagoLang}&st=${encodedText}`;
  }
  
  if (siteName === 'Google 搜尋') {
    // Language-specific Google search
    const searchTerms = {
      'english': `${encodedText}+pronunciation`,
      'japanese': `${encodedText}+発音+読み方`,
      'korean': `${encodedText}+발음`,
      'dutch': `${encodedText}+uitspraak`
    };
    const searchTerm = searchTerms[language] || `${encodedText}+pronunciation`;
    return `https://www.google.com/search?q=${searchTerm}`;
  }
  
  // Default URL mapping
  const urlMaps = {
    'YouGlish': `https://youglish.com/pronounce/${encodedText}/${language}`,
    'Forvo': `https://forvo.com/word/${encodedText}/`,
    'Cambridge Dictionary': `https://dictionary.cambridge.org/dictionary/english/${encodedText}`,
    'Thesaurus.com': `https://www.thesaurus.com/browse/${encodedText}`,
    'Urban Dictionary': `https://www.urbandictionary.com/define.php?term=${encodedText}`,
    'Ludwig': `https://ludwig.guru/s/${encodedText}`,
    'Jisho.org': `https://jisho.org/search/${encodedText}`,
    'Tatoeba': `https://tatoeba.org/en/sentences/search?query=${encodedText}`,
    'HiNative': `https://hinative.com/questions?search=${encodedText}`,
    'Van Dale': `https://www.vandale.nl/gratis-woordenboek/nederlands/betekenis/${encodedText}`,
    'Linguee': `https://www.linguee.com/english-dutch/search?source=dutch&query=${encodedText}`,
    'Naver Dictionary': `https://en.dict.naver.com/#/search?query=${encodedText}`
  };
  
  return urlMaps[siteName] || `https://youglish.com/pronounce/${encodedText}/${language}`;
}

// 載入網站視圖的發音網站選項
function loadWebsitePronunciationSites(queryData) {
  const pronunciationOptions = document.getElementById('websitePronunciationOptions');
  const siteDescriptions = document.getElementById('websiteSiteDescriptions');
  
  // Clear existing content safely
  if (pronunciationOptions) {
    while (pronunciationOptions.firstChild) {
      pronunciationOptions.removeChild(pronunciationOptions.firstChild);
    }
  }
  
  if (siteDescriptions) {
    while (siteDescriptions.firstChild) {
      siteDescriptions.removeChild(siteDescriptions.firstChild);
    }
  }
  
  // Get site configurations based on language
  const siteConfigs = getSiteConfigs(queryData.language);
  
  // Group sites by category
  const categories = {
    'pronunciation': { name: '🎯 發音學習', sites: [] },
    'dictionary': { name: '📚 字典查詢', sites: [] },
    'context': { name: '💭 語境例句', sites: [] },
    'slang': { name: '🏙️ 俚語俗語', sites: [] },
    'academic': { name: '🎓 學術寫作', sites: [] },
    'examples': { name: '📝 例句資料庫', sites: [] },
    'translation': { name: '🌐 翻譯服務', sites: [] },
    'search': { name: '🔍 搜尋引擎', sites: [] }
  };
  
  // Categorize sites with priority assignments
  siteConfigs.forEach((config, index) => {
    const category = config.category || 'pronunciation';
    const url = queryData.allUrls && queryData.allUrls[config.name] ? 
                queryData.allUrls[config.name] : 
                generateUrlForSite(config.name, queryData.text, queryData.language);
    
    // Assign priority based on site name and category
    let priority = 'recommended';
    if (config.name === 'YouGlish' || (config.category === 'pronunciation' && index === 0)) {
      priority = 'primary';
    } else if (config.name === 'PlayPhrase.me' || (config.category === 'pronunciation' && index === 1)) {
      priority = 'secondary';
    } else if ((config.category === 'pronunciation' && index === 2) || config.name === 'Forvo') {
      priority = 'tertiary';
    }
    
    categories[category].sites.push({
      ...config,
      url: url,
      index: index,
      priority: priority
    });
  });
  
  // Generate category sections
  Object.entries(categories).forEach(([categoryKey, category]) => {
    if (category.sites.length === 0) return;
    
    // Create category header with count
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';
    categoryHeader.innerHTML = `
      <h4>${category.name}</h4>
      <span class="category-count">${category.sites.length} 個網站</span>
    `;
    
    if (pronunciationOptions) pronunciationOptions.appendChild(categoryHeader);
    
    // Create site options for this category
    category.sites.forEach(site => {
      const option = document.createElement('div');
      option.className = `pronunciation-option ${site.priority === 'primary' ? 'primary' : ''}`;
      
      // Determine badge text and class
      let badgeText = '推薦開啟';
      let badgeClass = 'recommended';
      
      switch(site.priority) {
        case 'primary':
          badgeText = '主要開啟';
          badgeClass = 'primary';
          break;
        case 'secondary':
          badgeText = '備選開啟';
          badgeClass = 'secondary';
          break;
        case 'tertiary':
          badgeText = '其他開啟';
          badgeClass = 'tertiary';
          break;
        default:
          badgeText = '推薦開啟';
          badgeClass = 'recommended';
      }
      
      option.innerHTML = `
        <div class="option-info">
          <span class="option-icon">${site.icon}</span>
          <div class="option-details">
            <h5>${site.name}</h5>
            <p>${site.description}</p>
          </div>
        </div>
        <div class="option-actions">
          <span class="option-badge ${badgeClass}">${badgeText}</span>
          <button class="open-new-tab-btn" title="在新標籤頁開啟" style="background: none; border: none; cursor: pointer; padding: 4px; margin-left: 8px; color: #666;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
          </button>
        </div>
      `;
      
      // Handle click on the main option
      option.addEventListener('click', (e) => {
        // Don't trigger if clicking the new tab button
        if (e.target.closest('.open-new-tab-btn')) return;
        
        console.log(`🌐 Opening ${site.name}: ${site.url}`);
        loadWebsiteInFrame(site.url, site.name);
        
        // Add visual feedback
        option.style.backgroundColor = '#e3f2fd';
        option.style.transform = 'scale(0.98)';
        option.style.transition = 'all 0.2s';
        
        // Show active state
        document.querySelectorAll('.pronunciation-option').forEach(opt => {
          opt.classList.remove('active');
          opt.style.borderColor = '';
        });
        option.classList.add('active');
        option.style.borderColor = '#1a73e8';
        option.style.borderWidth = '2px';
        
        setTimeout(() => {
          option.style.backgroundColor = '';
          option.style.transform = '';
        }, 300);
      });
      
      // Handle new tab button click
      const newTabBtn = option.querySelector('.open-new-tab-btn');
      if (newTabBtn) {
        newTabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log(`🚀 Opening ${site.name} in new tab`);
          window.open(site.url, '_blank');
          
          // Visual feedback
          newTabBtn.style.color = '#1a73e8';
          setTimeout(() => {
            newTabBtn.style.color = '#666';
          }, 300);
        });
      }
      
      if (pronunciationOptions) {
        pronunciationOptions.appendChild(option);
      }
      
      // Add to descriptions
      if (siteDescriptions) {
        const descItem = document.createElement('li');
        descItem.innerHTML = `<strong>${site.name}:</strong> ${site.longDescription || site.description}`;
        siteDescriptions.appendChild(descItem);
      }
    });
  });
}

// 在網站框架中載入網站
function loadWebsiteInFrame(url, siteName) {
  const frame = document.getElementById('websiteFrame');
  const loading = document.getElementById('websiteLoading');
  const error = document.getElementById('websiteError');
  const frameContainer = document.getElementById('websiteIframeContainer');
  
  // Show loading state
  if (loading) loading.style.display = 'block';
  if (error) error.style.display = 'none';
  if (frameContainer) frameContainer.style.display = 'block';
  
  if (frame) {
    // Clear previous content
    frame.src = 'about:blank';
    
    // Set new source
    setTimeout(() => {
      frame.src = url;
      console.log(`🚀 Loading ${siteName}: ${url}`);
    }, 100);
    
    frame.onload = () => {
      if (loading) loading.style.display = 'none';
      console.log(`✅ Successfully loaded ${siteName}`);
      
      // Update the current site display
      const currentSiteEl = document.getElementById('currentWebsiteName');
      if (currentSiteEl) {
        currentSiteEl.textContent = `當前網站: ${siteName}`;
        currentSiteEl.style.display = 'block';
      }
    };
    
    frame.onerror = () => {
      if (loading) loading.style.display = 'none';
      if (error) {
        error.style.display = 'block';
        error.innerHTML = `
          <div>❌ 無法載入 ${siteName}</div>
          <div style="font-size: 12px; margin-top: 8px;">請檢查網絡連接或嘗試其他網站</div>
          <button class="retry-load-btn" data-url="${url}" data-site-name="${siteName}" style="margin-top: 8px; padding: 4px 12px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">
            重試
          </button>
        `;
        
        // Add event listener for retry button
        const retryBtn = error.querySelector('.retry-load-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            const retryUrl = retryBtn.dataset.url;
            const retrySiteName = retryBtn.dataset.siteName;
            loadWebsiteInFrame(retryUrl, retrySiteName);
          });
        }
      }
      console.error(`❌ Failed to load ${siteName}`);
    };
  }
}

// 載入 YouGlish
function loadYouGlish(url, text, language) {
  const queryData = {
    text: text,
    language: language,
    primaryUrl: url,
    secondaryUrl: '',
    tertiaryUrl: '',
    allUrls: { 'YouGlish': url },
    autoAnalysis: true // Enable auto-analysis for YouTube learning
  };
  
  showSearchResult(queryData);
  loadSite(url);
  
  // 保存查詢到本地儲存 (both current and historical)
  const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const storageData = {
    text: text,
    language: language,
    url: url,
    primaryUrl: url,
    timestamp: Date.now()
  };
  
  // Save current query
  chrome.storage.local.set({
    currentQuery: storageData,
    [queryId]: storageData // Also save as historical entry
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save query:', chrome.runtime.lastError);
    } else {
      console.log('Query saved successfully:', storageData);
    }
  });
  
  // Also maintain a persistent history list
  chrome.storage.local.get(['searchHistory'], (result) => {
    let history = result.searchHistory || [];
    
    // Check if this query already exists (avoid duplicates)
    const exists = history.some(item => 
      item.text === text && item.language === language
    );
    
    if (!exists) {
      // Add new query to the beginning
      history.unshift(storageData);
      
      // Keep only the last 50 entries
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      // Save updated history
      chrome.storage.local.set({ searchHistory: history }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save history:', chrome.runtime.lastError);
        } else {
          console.log('History updated, total items:', history.length);
        }
      });
    }
  });
}

// 載入歷史記錄視圖
async function loadHistoryView() {
  const historyContainer = document.getElementById('historyList');
  const historyStats = document.getElementById('historyStats');
  const historyEmpty = document.getElementById('historyEmpty');
  
  if (!historyContainer) {
    console.error('History container not found');
    return;
  }
  
  log('Loading history view...');
  
  try {
    // Get both history and AI reports to match error status
    const [historyResponse, reportsResponse] = await Promise.all([
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getHistory' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('📚 History response received:', response);
            resolve(response);
          }
        });
      }),
      storageManager ? storageManager.getAIReports() : Promise.resolve([])
    ]);
    
    if (historyResponse && historyResponse.success) {
      const history = historyResponse.history || [];
      const reports = reportsResponse || [];
      
      console.log('✅ Successfully loaded history from HistoryManager:', history.length, 'items');
      console.log('History data:', history);
      log('Loaded history from HistoryManager:', history.length, 'items');
      log('Loaded AI reports for error status:', reports.length, 'items');
      
      if (history.length === 0) {
        // Show empty state
        if (historyContainer) {
          if (window.SecurityFixes) {
            window.SecurityFixes.safeClearElement(historyContainer);
          } else {
            historyContainer.innerHTML = '';
          }
        }
        if (historyEmpty) historyEmpty.style.display = 'block';
        if (historyStats) {
          if (window.SecurityFixes) {
            window.SecurityFixes.safeUpdateStats(historyStats, '📊 沒有搜尋記錄');
          } else {
            historyStats.innerHTML = '<p>📊 沒有搜尋記錄</p>';
          }
        }
        return;
      }
      
      // Hide empty state
      if (historyEmpty) historyEmpty.style.display = 'none';
      
      // Temporarily bypass complex matching to fix display issue
      // Just add null error status to all items to maintain structure
      const historyWithErrorStatus = history.map(historyItem => ({
        ...historyItem,
        hasErrors: null,
        isCorrect: null,
        errorTypes: [],
        errorCount: 0
      }));
      
      // Update stats with error information
      if (historyStats) {
        const totalQueries = historyWithErrorStatus.reduce((sum, item) => sum + (item.queryCount || 1), 0);
        const languageStats = {};
        historyWithErrorStatus.forEach(item => {
          languageStats[item.language] = (languageStats[item.language] || 0) + 1;
        });
        
        // Add error statistics
        const itemsWithAnalysis = historyWithErrorStatus.filter(item => item.hasErrors !== null);
        const correctItems = itemsWithAnalysis.filter(item => item.isCorrect);
        const errorItems = itemsWithAnalysis.filter(item => item.hasErrors);
        
        let statsText = `📊 總共 ${historyWithErrorStatus.length} 個搜尋詞，${totalQueries} 次查詢`;
        if (itemsWithAnalysis.length > 0) {
          statsText += ` | ✅ 正確: ${correctItems.length} ❌ 錯誤: ${errorItems.length}`;
        }
        statsText += ` | 語言分布: ${Object.entries(languageStats).map(([lang, count]) => `${languageNames[lang] || lang}: ${count}`).join(', ')}`;
        
        if (window.SecurityFixes) {
          window.SecurityFixes.safeUpdateStats(historyStats, statsText);
        } else {
          historyStats.innerHTML = `<p>${statsText}</p>`;
        }
      }
      
      // Store history data for filtering
      if (window.setCurrentHistoryData) {
        window.setCurrentHistoryData(historyWithErrorStatus);
      }
      
      // Display history items with error status
      console.log('📊 About to display history items:', historyWithErrorStatus.length);
      displayHistoryItems(historyWithErrorStatus);
      
    } else {
      console.error('Failed to load history:', historyResponse);
      console.error('Response details:', historyResponse?.error);
      // Fallback to old method
      loadHistoryViewFallback();
    }
  } catch (error) {
    console.error('Error loading history:', error);
    // Fallback to old method
    loadHistoryViewFallback();
  }
}

// Fallback method using old storage approach
function loadHistoryViewFallback() {
  console.log('Using fallback history loading method...');
  
  chrome.storage.local.get(['searchHistory', 'currentQuery'], (data) => {
    console.log('Loading history fallback, storage data:', data);
    
    let queries = [];
    
    // First try to get from the persistent history list
    if (data.searchHistory && Array.isArray(data.searchHistory)) {
      queries = data.searchHistory.filter(item => item && item.text);
      console.log('Loaded from searchHistory:', queries.length, 'items');
    }
    
    // If no persistent history, fall back to old method
    if (queries.length === 0) {
      console.log('No persistent history found, using oldest fallback method');
      
      // Check for current query
      if (data.currentQuery && data.currentQuery.text) {
        queries.push({
          text: data.currentQuery.text,
          language: data.currentQuery.language,
          url: data.currentQuery.url || data.currentQuery.primaryUrl,
          timestamp: data.currentQuery.timestamp || Date.now()
        });
      }
      
      // Get all storage data to find old queries
      chrome.storage.local.get(null, (allData) => {
        Object.keys(allData).forEach(key => {
          if (key.startsWith('query_')) {
            const query = allData[key];
            if (query && query.text) {
              queries.push({
                text: query.text,
                language: query.language,
                url: query.url || query.primaryUrl,
                timestamp: query.timestamp || Date.now()
              });
            }
          }
        });
        
        console.log('🔍 Before deduplication:', queries.length, 'items');
        
        // Remove true duplicates (same text, language, and timestamp) but preserve different occurrences
        const uniqueQueries = queries.filter((query, index, self) => 
          index === self.findIndex(q => 
            q.text === query.text && 
            q.language === query.language && 
            q.timestamp === query.timestamp
          )
        );
        
        console.log('🔍 After deduplication:', uniqueQueries.length, 'items');
        console.log('Unique queries:', uniqueQueries);
        
        uniqueQueries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        displayHistoryItems(uniqueQueries);
      });
      return; // Exit early for fallback method
    }
    
    // 按時間排序 (already should be sorted, but just in case)
    queries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    log('Found queries:', queries.length);
    displayHistoryItems(queries);
  });
}

// Helper function to format video timestamp
function formatVideoTimestamp(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return '';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Language-aware text for return buttons
const returnButtonText = {
  video: {
    'en': 'Return to Video',
    'zh': '返回影片',
    'zh-TW': '返回影片', 
    'zh-CN': '返回视频',
    'ja': '動画に戻る',
    'ko': '비디오로 돌아가기',
    'es': 'Volver al Video',
    'fr': 'Retour à la Vidéo',
    'de': 'Zurück zum Video',
    'it': 'Torna al Video',
    'pt': 'Voltar ao Vídeo',
    'ru': 'Вернуться к Видео'
  },
  youtube: {
    'en': 'YouTube Video',
    'zh': 'YouTube 影片',
    'zh-TW': 'YouTube 影片', 
    'zh-CN': 'YouTube 视频',
    'ja': 'YouTube 動画',
    'ko': 'YouTube 비디오',
    'es': 'YouTube Video',
    'fr': 'Vidéo YouTube',
    'de': 'YouTube Video',
    'it': 'Video YouTube',
    'pt': 'Vídeo YouTube',
    'ru': 'YouTube Видео'
  },
  netflix: {
    'en': 'Netflix',
    'zh': 'Netflix',
    'zh-TW': 'Netflix', 
    'zh-CN': 'Netflix',
    'ja': 'Netflix',
    'ko': 'Netflix',
    'es': 'Netflix',
    'fr': 'Netflix',
    'de': 'Netflix',
    'it': 'Netflix',
    'pt': 'Netflix',
    'ru': 'Netflix'
  },
  article: {
    'en': 'Return to Article',
    'zh': '回到文章',
    'zh-TW': '回到文章',
    'zh-CN': '回到文章', 
    'ja': '記事に戻る',
    'ko': '기사로 돌아가기',
    'es': 'Volver al Artículo',
    'fr': 'Retour à l\'Article',
    'de': 'Zurück zum Artikel',
    'it': 'Torna all\'Articolo',
    'pt': 'Voltar ao Artigo',
    'ru': 'Вернуться к Статье'
  },
  segment: {
    'en': 'Return to Segment',
    'zh': '返回片段',
    'zh-TW': '返回片段',
    'zh-CN': '返回片段',
    'ja': 'セグメントに戻る', 
    'ko': '구간으로 돌아가기',
    'es': 'Volver al Segmento',
    'fr': 'Retour au Segment',
    'de': 'Zurück zum Segment',
    'it': 'Torna al Segmento',
    'pt': 'Voltar ao Segmento',
    'ru': 'Вернуться к Сегменту'
  }
};

// Helper function to get localized return button text
function getReturnButtonText(sourceType, language, hasTimestamp = false) {
  const lang = language || 'zh'; // Default to Chinese
  const fallbackLang = 'zh';
  
  if (sourceType === 'article') {
    return returnButtonText.article[lang] || returnButtonText.article[fallbackLang];
  } else if (hasTimestamp) {
    return returnButtonText.segment[lang] || returnButtonText.segment[fallbackLang];
  } else if (sourceType === 'netflix') {
    return returnButtonText.netflix[lang] || returnButtonText.netflix[fallbackLang];
  } else if (sourceType === 'youtube') {
    return returnButtonText.youtube[lang] || returnButtonText.youtube[fallbackLang];
  } else {
    return returnButtonText.video[lang] || returnButtonText.video[fallbackLang];
  }
}

// Helper function to determine source type
function getSourceType(query) {
  console.log('🔍 getSourceType called with:', {
    detectionMethod: query.detectionMethod,
    videoSourceUrl: query.videoSource?.url,
    videoSourcePlatform: query.videoSource?.platform,
    videoSourceDomain: query.videoSource?.domain,
    videoSourceAuthor: query.videoSource?.author,
    videoSourceChannel: query.videoSource?.channel,
    hasVideoSource: !!query.videoSource,
    fullQuery: query
  });

  // PRIORITY 1: Check for article-specific detection methods
  if (query.detectionMethod === 'article-selection' || 
      query.detectionMethod === 'article-learning' || 
      query.detectionMethod === 'right-click-article') {
    console.log('🔍 -> ✅ FOUND ARTICLE via detectionMethod:', query.detectionMethod);
    return 'article';
  }
  
  // EXPLICIT CHECK: If detectionMethod contains 'article' anywhere
  if (query.detectionMethod && query.detectionMethod.includes('article')) {
    console.log('🔍 -> ✅ FOUND ARTICLE via detectionMethod contains "article":', query.detectionMethod);
    return 'article';
  }
  
  // PRIORITY 2: Check if videoSource exists and check platform first
  if (query.videoSource) {
    const videoSource = query.videoSource;
    
    // Check for platform-specific video sources FIRST (highest priority)
    console.log('🔍 Checking Netflix detection:', {
      platform: videoSource.platform,
      url: videoSource.url,
      hasNetflixInUrl: videoSource.url && videoSource.url.includes('netflix.com')
    });
    
    if (videoSource.platform === 'netflix' || videoSource.url && videoSource.url.includes('netflix.com')) {
      console.log('🔍 -> ✅ FOUND NETFLIX VIDEO via platform/URL:', videoSource.platform || videoSource.url);
      return 'netflix';
    }
    
    if (videoSource.platform === 'youtube' || videoSource.url && 
        (videoSource.url.includes('youtube.com') || videoSource.url.includes('youtu.be'))) {
      console.log('🔍 -> ✅ FOUND YOUTUBE VIDEO via platform/URL:', videoSource.platform || videoSource.url);
      return 'youtube';
    }
    
    // Then check for article metadata indicators
    console.log('🔍 Checking article detection:', {
      author: videoSource.author,
      channel: videoSource.channel,
      hasAuthorButNoChannel: videoSource.author && !videoSource.channel,
      publishDate: videoSource.publishDate,
      domain: videoSource.domain
    });
    
    // Check for article author (but not YouTube channel)
    if (videoSource.author && !videoSource.channel && videoSource.author !== '未知作者') {
      console.log('🔍 -> ✅ FOUND ARTICLE via author field:', videoSource.author);
      return 'article';
    }
    
    // Check for article publish date
    if (videoSource.publishDate) {
      console.log('🔍 -> ✅ FOUND ARTICLE via publishDate field:', videoSource.publishDate);
      return 'article';
    }
    
    // Check for article domain without YouTube URL
    if (videoSource.domain && !videoSource.url) {
      console.log('🔍 -> ✅ FOUND ARTICLE via domain only:', videoSource.domain);
      return 'article';
    }
    
    // Check for non-video URLs (articles)
    if (videoSource.url && 
        !videoSource.url.includes('youtube.com') && 
        !videoSource.url.includes('youtu.be') &&
        !videoSource.url.includes('youglish.com') &&
        !videoSource.url.includes('netflix.com')) {
      console.log('🔍 -> ✅ FOUND ARTICLE via non-video URL:', videoSource.url);
      return 'article';
    }
  }
  
  console.log('🔍 -> ❌ DEFAULTING TO VIDEO - detectionMethod was:', query.detectionMethod);
  return 'video';
}

// Helper function to get appropriate icon
function getSourceIcon(sourceType) {
  if (sourceType === 'article') return '📖';
  if (sourceType === 'netflix') return '🎭';
  if (sourceType === 'youtube') return '📺';
  return '📹'; // Default for other video types
}

// Helper function to get platform-specific colors
function getPlatformColors(sourceType) {
  if (sourceType === 'article') return { border: '#28a745', button: '#28a745', hover: '#1e7e34' };
  if (sourceType === 'netflix') return { border: '#e50914', button: '#e50914', hover: '#b8070e' };
  if (sourceType === 'youtube') return { border: '#ff0000', button: '#ff0000', hover: '#e60000' };
  return { border: '#ff0000', button: '#ff0000', hover: '#e60000' }; // Default
}

// Helper function to generate video source HTML
function getVideoSourceHtml(query) {
  const sourceType = getSourceType(query);
  const sourceIcon = getSourceIcon(sourceType);
  const hasTimestamp = sourceType === 'netflix' ? null : formatVideoTimestamp(query.videoSource.videoTimestamp);
  const returnText = getReturnButtonText(sourceType, query.language, !!hasTimestamp);
  const colors = getPlatformColors(sourceType);
  const borderColor = colors.border;
  const buttonColor = colors.button;
  
  return `
    <div class="history-video-source" style="margin-top: 8px; padding: 8px; background-color: #f8f9fa; border-radius: 6px; border-left: 3px solid ${borderColor};">
      <div class="video-info" style="display: flex; align-items: center; gap: 8px;">
        <span class="video-icon" style="font-size: 16px;">${sourceIcon}</span>
        <div class="video-details" style="flex: 1;">
          <div class="video-title" style="font-weight: 500; font-size: 13px; color: #1a73e8; margin-bottom: 2px;">${query.videoSource.title}</div>
          <div class="video-meta" style="font-size: 12px; color: #666;">
            ${query.videoSource.channel || query.videoSource.domain || ''}${hasTimestamp ? ` • ⏰ ${hasTimestamp}` : ''}
          </div>
        </div>
        <button class="video-return-btn" data-video-url="${query.videoSource.url || ''}" style="padding: 4px 8px; font-size: 11px; background-color: ${buttonColor}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;" title="${hasTimestamp ? `返回到 ${hasTimestamp} 的學習片段` : returnText}">${hasTimestamp ? '⏰ 返回片段' : `${sourceIcon} ${returnText}`}</button>
      </div>
    </div>
  `;
}

// Helper function for report return button
function getReportReturnButton(report) {
  const sourceType = getSourceType(report);
  const sourceIcon = getSourceIcon(sourceType);
  const hasTimestamp = sourceType === 'netflix' ? null : formatVideoTimestamp(report.videoSource.videoTimestamp);
  const returnText = getReturnButtonText(sourceType, report.language, !!hasTimestamp);
  const colors = getPlatformColors(sourceType);
  const buttonColor = colors.button;
  
  // For articles, use url or originalUrl or articleUrl
  const returnUrl = report.videoSource.url || report.videoSource.originalUrl || report.videoSource.articleUrl || '#';
  
  return `<button class="report-action-btn video-return-btn" data-video-url="${returnUrl}" title="${hasTimestamp ? `返回到 ${hasTimestamp} 的學習片段` : returnText}" style="background-color: ${buttonColor}; color: white;">
    ${hasTimestamp ? '⏰' : sourceIcon}
  </button>`;
}

// Helper function for report video info
function getReportVideoInfo(report) {
  const sourceType = getSourceType(report);
  const sourceIcon = getSourceIcon(sourceType);
  const colors = getPlatformColors(sourceType);
  const borderColor = colors.border;
  const hasTimestamp = sourceType === 'netflix' ? null : formatVideoTimestamp(report.videoSource.videoTimestamp);
  const returnText = getReturnButtonText(sourceType, report.language, !!hasTimestamp);
  const buttonColor = colors.button;
  const hoverColor = colors.hover;
  
  // For articles, use url or originalUrl or articleUrl
  const returnUrl = report.videoSource.url || report.videoSource.originalUrl || report.videoSource.articleUrl || '#';
  
  return `<div class="saved-report-video-info" style="margin: 8px 0; padding: 8px; background-color: #f8f9fa; border-radius: 6px; border-left: 3px solid ${borderColor};">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">${sourceIcon}</span>
      <div style="flex: 1;">
        <div style="font-weight: 500; font-size: 13px; color: #1a73e8; margin-bottom: 2px;">${report.videoSource.title || (sourceType === 'article' ? '文章學習' : '影片學習')}</div>
        <div style="font-size: 12px; color: #666;">
          ${report.videoSource.channel || report.videoSource.author || report.videoSource.domain || ''}${hasTimestamp ? ` • ⏰ ${hasTimestamp}` : ''}
        </div>
      </div>
      <button class="video-return-btn-large" data-video-url="${returnUrl}" style="padding: 8px 16px; font-size: 13px; background-color: ${buttonColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(${sourceType === 'article' ? '40, 167, 69' : '255, 0, 0'}, 0.3); transition: all 0.2s;" title="${hasTimestamp ? `返回到 ${hasTimestamp} 的學習片段` : returnText}" onmouseover="this.style.backgroundColor='${hoverColor}'; this.style.transform='translateY(-1px)'" onmouseout="this.style.backgroundColor='${buttonColor}'; this.style.transform='translateY(0)'">${hasTimestamp ? '⏰ 返回片段' : `${sourceIcon} ${returnText}`}</button>
    </div>
  </div>`;
}

// Extract display logic into separate function
function displayHistoryItems(queries) {
  console.log('🎯 displayHistoryItems called with:', queries?.length || 0, 'items');
  
  const historyContainer = document.getElementById('historyList');
  if (!historyContainer) {
    console.error('❌ History container not found!');
    return;
  }
  
  // 清空容器
  if (window.SecurityFixes) {
    window.SecurityFixes.safeClearElement(historyContainer);
  } else {
    historyContainer.innerHTML = '';
  }
  
  if (queries.length === 0) {
    if (window.SecurityFixes) {
      const emptyDiv = window.SecurityFixes.safeCreateElement('div', '', 'history-empty');
      const p1 = window.SecurityFixes.safeCreateElement('p', '📝 沒有搜尋歷史');
      const p2 = window.SecurityFixes.safeCreateElement('p', '開始搜尋單字或短語來建立學習記錄！');
      p2.style.color = '#666';
      p2.style.fontSize = '12px';
      emptyDiv.appendChild(p1);
      emptyDiv.appendChild(p2);
      historyContainer.appendChild(emptyDiv);
    } else {
      historyContainer.innerHTML = '<div class="history-empty"><p>📝 沒有搜尋歷史</p><p style="color: #666; font-size: 12px;">開始搜尋單字或短語來建立學習記錄！</p></div>';
    }
    return;
  }
  
  // 顯示查詢歷史
  console.log('📋 Processing queries, limiting to 50 items');
  let successCount = 0;
  let errorCount = 0;
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  queries.slice(0, 50).forEach((query, index) => {
    try {
      if (index < 5) { // Only log first 5 to avoid console spam
        console.log(`Processing item ${index + 1}:`, query.text);
      }
    
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const timestamp = query.timestamp || Date.now();
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('zh-TW') + ' ' + date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    
    // Handle both old format (query.url) and HistoryManager format
    const queryCount = query.queryCount || 1;
    const detectionMethod = query.detectionMethod || 'auto';
    const websitesUsed = query.websitesUsed || [];
    
    // Ensure query.detectionMethod is set for getSourceType function
    if (!query.detectionMethod) {
      query.detectionMethod = detectionMethod;
    }
    
    // Enhanced debugging: Check what data we have for this record
    if (query.videoSource) {
      console.log('📊 History record has videoSource:', {
        url: query.videoSource.url,
        title: query.videoSource.title,
        domain: query.videoSource.domain,
        author: query.videoSource.author,
        channel: query.videoSource.channel,
        videoTimestamp: query.videoSource.videoTimestamp,
        hasTimestamp: query.videoSource.videoTimestamp !== null && query.videoSource.videoTimestamp !== undefined
      });
      
      // 🎯 DEBUG: Specific timestamp verification for user's question
      console.log('⏰ TIMESTAMP DEBUG - Saved videoTimestamp value:', {
        value: query.videoSource.videoTimestamp,
        type: typeof query.videoSource.videoTimestamp,
        isNull: query.videoSource.videoTimestamp === null,
        isUndefined: query.videoSource.videoTimestamp === undefined,
        formatted: formatVideoTimestamp(query.videoSource.videoTimestamp)
      });
    } else {
      console.log('⚠️ History record has NO videoSource - this will show as video by default');
    }
    
    // Debug: log the query data to see what we're working with  
    console.log('🔍 History item debug:', {
      text: query.text?.substring(0, 30) + '...',
      detectionMethod: query.detectionMethod,
      hasVideoSource: !!query.videoSource,
      videoSourceUrl: query.videoSource?.url,
      videoSourceDomain: query.videoSource?.domain,
      videoSourceAuthor: query.videoSource?.author,
      videoSourceChannel: query.videoSource?.channel,
      videoSourcePublishDate: query.videoSource?.publishDate,
      fullVideoSource: query.videoSource,
      sourceType: getSourceType(query)
    });
    
    // Create history item using SecurityUtils with error status
    if (window.SecurityFixes) {
      window.SecurityFixes.safeCreateHistoryItem(item, {
        text: query.text || 'Unknown',
        language: languageNames[query.language] || query.language || 'Unknown',
        timestamp: query.timestamp,
        queryCount: queryCount,
        detectionMethod: detectionMethod,
        websitesUsed: websitesUsed,
        id: query.id,
        // Error status information
        hasErrors: query.hasErrors,
        isCorrect: query.isCorrect,
        errorTypes: query.errorTypes,
        errorCount: query.errorCount,
        // Video source information
        videoSource: query.videoSource
      });
    } else {
      // Fallback to innerHTML (unsafe)
      item.innerHTML = `
        <div class="history-item-header">
          <div class="history-text">${query.text || 'Unknown'}</div>
          <div class="history-actions">
            <button class="history-action-btn replay" data-text="${query.text}" data-language="${query.language}" data-id="${query.id || ''}">重播</button>
            <button class="history-action-btn audio" data-text="${query.text}" data-language="${query.language}" title="播放語音">🔊</button>
            ${query.id ? `<button class="history-action-btn delete" data-id="${query.id}">刪除</button>` : ''}
          </div>
        </div>
${query.videoSource ? getVideoSourceHtml(query) : ''}
        <div class="history-meta">
          <span class="history-language">${languageNames[query.language] || query.language || 'Unknown'}</span>
          <span class="history-date">${dateStr}</span>
          ${queryCount > 1 ? `<span class="history-count">${queryCount}次查詢</span>` : ''}
          <span class="history-method">${detectionMethod === 'auto' ? '自動' : detectionMethod === 'manual' ? '手動' : detectionMethod}</span>
          ${websitesUsed.length > 0 ? `<span class="history-websites">${websitesUsed.join(', ')}</span>` : ''}
        </div>
      `;
    }
    
    fragment.appendChild(item);
    successCount++;
    
    // Add event listeners
    const replayButton = item.querySelector('.history-action-btn.replay');
    const audioButton = item.querySelector('.history-action-btn.audio');
    const deleteButton = item.querySelector('.history-action-btn.delete');
    const videoReturnButton = item.querySelector('.video-return-btn');
    
    if (replayButton) {
      replayButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = replayButton.dataset.text;
        const language = replayButton.dataset.language;
        console.log('Replaying query:', { text, language });
        if (text && language) {
          await replayQuery(text, language);
        }
      });
    }
    
    if (audioButton) {
      audioButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = audioButton.dataset.text;
        const language = audioButton.dataset.language;
        console.log('Playing history audio:', { text, language });
        if (text && language) {
          await playHistoryAudio(text, language, audioButton);
        }
      });
    }
    
    if (deleteButton) {
      deleteButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = deleteButton.dataset.id;
        if (id && confirm('確定要刪除這個搜尋記錄嗎？')) {
          try {
            console.log('🗑️ Deleting history record:', id);
            const response = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({ action: 'deleteHistoryRecord', id }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('❌ Chrome runtime error during delete:', chrome.runtime.lastError);
                  reject(chrome.runtime.lastError);
                } else {
                  console.log('🗑️ Delete response:', response);
                  resolve(response);
                }
              });
            });
            if (response && response.success) {
              console.log('✅ History record deleted successfully:', id);
              loadHistoryView(); // Reload the view
            } else {
              console.error('❌ Failed to delete history record:', response?.error);
              alert('刪除失敗: ' + (response?.error || '未知錯誤'));
            }
          } catch (error) {
            console.error('Error deleting history record:', error);
            alert('刪除失敗');
          }
        }
      });
    }
    
    if (videoReturnButton) {
      videoReturnButton?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const videoUrl = videoReturnButton.dataset.videoUrl;
        if (videoUrl) {
          console.log('📹 HISTORY TAB - Returning to video:', videoUrl);
          console.log('🔍 HISTORY TAB - URL analysis:', {
            isYouTube: videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'),
            isYouGlish: videoUrl.includes('youglish.com'),
            hasTimestamp: videoUrl.includes('&t=') || videoUrl.includes('?t='),
            fullUrl: videoUrl
          });
          try {
            // Open the video URL in a new tab
            chrome.tabs.create({ url: videoUrl });
          } catch (error) {
            console.error('❌ Failed to open video:', error);
            // Fallback to window.open
            window.open(videoUrl, '_blank');
          }
        }
      });
    }
    
    // Article return button event listener
    const articleReturnButton = item.querySelector('.article-return-btn');
    if (articleReturnButton) {
      articleReturnButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const articleUrl = articleReturnButton.dataset.articleUrl;
        const sentence = articleReturnButton.dataset.sentence;
        const paragraph = articleReturnButton.dataset.paragraph;
        const savedAt = articleReturnButton.dataset.savedAt;
        const notes = articleReturnButton.dataset.notes;
        
        if (articleUrl && sentence && window.articleNavigator) {
          console.log('📄 Navigating to article sentence:', {
            url: articleUrl,
            sentence: sentence,
            paragraph: paragraph
          });
          
          try {
            await window.articleNavigator.navigateToArticle({
              url: articleUrl,
              sentence: sentence,
              paragraph: paragraph,
              savedAt: savedAt,
              notes: notes
            });
          } catch (error) {
            console.error('❌ Failed to navigate to article:', error);
            alert('無法打開文章，請檢查URL是否有效');
          }
        }
      });
    }
    
    // Make the whole item clickable (except buttons)
    item.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('history-action-btn') && !e.target.classList.contains('video-return-btn')) {
        const text = query.text;
        const language = query.language;
        if (text && language) {
          await replayQuery(text, language);
        }
      }
    });
    } catch (error) {
      errorCount++;
      console.error(`❌ Error processing item ${index + 1}:`, error);
    }
  });
  
  // Append all items at once for better performance
  historyContainer.appendChild(fragment);
  
  console.log(`✅ Successfully displayed ${successCount} items, ❌ Failed: ${errorCount}, Total processed: ${queries.slice(0, 50).length}`);
  
  // Check if items were actually added to the DOM
  const actualItems = historyContainer.querySelectorAll('.history-item').length;
  console.log(`🔍 Actual items in DOM: ${actualItems}`);
}

// 重播查詢
async function replayQuery(text, language, url) {
  console.log('Replaying query:', { text, language, url });
  
  // If no URL, create a default YouGlish URL
  if (!url) {
    url = `https://youglish.com/pronounce/${encodeURIComponent(text)}/${language}`;
  }
  
  // Check for existing AI analysis first
  let existingAnalysis = null;
  let autoAnalysis = true;
  
  try {
    if (storageManager) {
      const reports = await storageManager.getAIReports({
        language: language,
        searchText: text
      });
      
      // Find exact match for the text and language
      const exactMatch = reports.find(report => 
        report.searchText.toLowerCase() === text.toLowerCase() && 
        report.language === language
      );
      
      if (exactMatch && exactMatch.analysisData) {
        console.log('Found existing AI analysis for replay:', exactMatch.id);
        existingAnalysis = exactMatch.analysisData;
        autoAnalysis = false; // Don't generate new analysis
        
        // Also restore cached audio if available
        if (exactMatch.audioData && exactMatch.audioData.audioUrl) {
          const cacheKey = `${text.toLowerCase()}_${language}`;
          const cachedAudioData = {
            text: text,
            language: language,
            audioUrl: exactMatch.audioData.audioUrl,
            blobUrl: exactMatch.audioData.audioUrl, // Use audioUrl as fallback for blobUrl
            size: exactMatch.audioData.size || 0,
            voice: exactMatch.audioData.voice || 'OpenAI TTS',
            timestamp: Date.now()
          };
          
          window.audioCache.set(cacheKey, cachedAudioData);
          console.log('🎯 Restored cached audio for replay:', text, 'from saved report');
        } else if (exactMatch.audioInIndexedDB && exactMatch.audioId && storageManager) {
          // Load audio from IndexedDB
          try {
            const reportWithAudio = await storageManager.getReportWithAudio(exactMatch);
            if (reportWithAudio && reportWithAudio.audioData) {
              const cacheKey = `${text.toLowerCase()}_${language}`;
              const cachedAudioData = {
                text: text,
                language: language,
                audioUrl: reportWithAudio.audioData,
                blobUrl: reportWithAudio.audioData,
                size: 0,
                voice: 'OpenAI TTS',
                timestamp: Date.now()
              };
              
              window.audioCache.set(cacheKey, cachedAudioData);
              console.log('🎯 Restored cached audio from IndexedDB for replay:', text);
            }
          } catch (error) {
            console.error('Failed to load audio from IndexedDB:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking for existing analysis:', error);
    // Continue with new analysis on error
  }
  
  // Create query data object
  const queryData = {
    text: text,
    language: language,
    primaryUrl: url,
    secondaryUrl: '',
    tertiaryUrl: '',
    allUrls: { 'YouGlish': url },
    autoAnalysis: autoAnalysis
  };
  
  // For replays with existing analysis, work like saved reports
  if (existingAnalysis) {
    console.log('Displaying cached AI analysis for replay');
    currentAIAnalysis = existingAnalysis;
    
    // Show search result first
    showSearchResult(queryData);
    
    // Then immediately show the cached analysis
    showAIResult(existingAnalysis);
  } else {
    // Normal flow for new queries
    showSearchResult(queryData);
  }
  
  // Switch to analysis view by default (instead of video view)
  const showAnalysisBtn = document.getElementById('showAnalysisBtn');
  if (showAnalysisBtn) {
    showAnalysisBtn.click();
  }
}

// 開啟設定頁面
function openSettings() {
  showSettingsDialog();
}

// Show settings dialog for TTS configuration
function showSettingsDialog() {
  // Create modal dialog
  const dialog = document.createElement('div');
  dialog.id = 'settingsDialog';
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  dialog.innerHTML = `
    <div style="
      background: white;
      padding: 24px;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <h3 style="margin-top: 0; color: #1976d2;">🔧 語音設定</h3>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">
          OpenAI API Key (可選 - 提供更自然的語音)
        </label>
        <input 
          type="password" 
          id="openaiApiKeyInput" 
          placeholder="sk-..." 
          style="
            width: 100%; 
            padding: 8px 12px; 
            border: 1px solid #ddd; 
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          "
        >
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          提供 OpenAI API Key 將使用更自然的語音合成。留空則使用瀏覽器內建語音。
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin-bottom: 8px;">🎯 語音品質對比</h4>
        <div style="font-size: 14px; line-height: 1.4;">
          • <strong>瀏覽器語音</strong>：免費，機械感較重<br>
          • <strong>OpenAI 語音</strong>：自然流暢，支援多語言，需要 API key
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancelSettingsBtn" style="
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        ">取消</button>
        <button id="saveSettingsBtn" style="
          padding: 8px 16px;
          background: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">儲存</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Load current API key
  loadCurrentApiKey();

  // Add event listeners
  document.getElementById('cancelSettingsBtn').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('openaiApiKeyInput').value.trim();
    
    try {
      // Save to Chrome storage
      await new Promise((resolve) => {
        chrome.storage.sync.set({ openaiApiKey: apiKey }, resolve);
      });
      
      showMessage(apiKey ? 'OpenAI API Key 已儲存' : 'API Key 已清除，將使用瀏覽器語音', 'success');
      document.body.removeChild(dialog);
    } catch (error) {
      console.error('Failed to save API key:', error);
      showMessage('儲存失敗', 'error');
    }
  });

  // Close on outside click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog);
    }
  });
}

// Load current API key into the input
async function loadCurrentApiKey() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['openaiApiKey'], resolve);
    });
    
    const input = document.getElementById('openaiApiKeyInput');
    if (input && result.openaiApiKey) {
      input.value = result.openaiApiKey;
    }
  } catch (error) {
    console.error('Failed to load API key:', error);
  }
}

// 在新分頁開啟當前頁面
function openCurrentInNewTab() {
  if (currentQueryData && currentQueryData.primaryUrl) {
    chrome.tabs.create({ url: currentQueryData.primaryUrl });
  }
}

// 初始化
// This section was moved to the main DOMContentLoaded section below

// AI Analysis Functions (missing functions)
async function generateAIAnalysis(forceRefresh = false) {
  // Try to get text and language from currentQueryData first
  let text = currentQueryData.text;
  let language = currentQueryData.language;
  
  // If currentQueryData is empty, try to get from UI elements
  if (!text || !language) {
    const searchTermElement = document.getElementById('searchTerm');
    const searchLanguageElement = document.getElementById('searchLanguage');
    
    if (searchTermElement && searchTermElement.textContent.trim()) {
      text = searchTermElement.textContent.trim();
    }
    
    if (searchLanguageElement && searchLanguageElement.textContent.trim()) {
      const languageText = searchLanguageElement.textContent.trim();
      // Convert display language back to code
      const languageMap = {
        '英文': 'english',
        '日文': 'japanese', 
        '韓文': 'korean',
        '荷蘭文': 'dutch'
      };
      language = languageMap[languageText] || 'english';
    }
    
    // Update currentQueryData with recovered values
    if (text && language) {
      currentQueryData = { text, language };
      console.log('🔄 Recovered query data from UI:', { text, language });
    }
  }
  
  if (!text || !language) {
    showAIError('沒有可分析的文本 - 請先搜索一個詞或句子');
    return;
  }

  // 如果已有分析結果且不是強制刷新，直接顯示
  if (currentAIAnalysis && !forceRefresh) {
    showAIResult(currentAIAnalysis);
    return;
  }

  try {
    // 顯示載入狀態（帶取消按鈕）
    showAILoadingWithCancel(text, language);
    
    // 快速搜索結果和 AI 分析並行執行（不阻塞）
    showQuickSearchResults(text, language); // 非阻塞，在背景執行
    
    // 等待 AI 服務載入完成
    await waitForAIService();
    
    // 初始化 AI 服務
    const isAvailable = await aiService.initialize();
    if (!isAvailable) {
      throw new Error('AI 服務未配置或未啟用 - 請檢查設定頁面是否已正確配置 API 金鑰');
    }

    // 生成分析（非阻塞，帶超時保護和重試機制）
    const analysis = await generateAnalysisWithTimeout(aiService, text, language);
    currentAIAnalysis = analysis;
    
    // 顯示結果
    showAIResult(analysis);
    
    // 自動保存 AI 分析報告到存储管理器 (only if auto-save is enabled)
    if (autoSaveEnabled && storageManager && typeof storageManager.saveAIReport === 'function') {
      try {
        // Get cached audio data if available
        const cachedAudio = getCachedAudio(text, language);
        const audioData = cachedAudio ? {
          audioUrl: cachedAudio.audioUrl,
          size: cachedAudio.size,
          voice: cachedAudio.voice || 'OpenAI TTS'
        } : null;
        
        // Get video source data - check currentQueryData first, then YouTube analysis
        let videoSource = null;
        
        // First check if currentQueryData has videoSource (for articles)
        if (currentQueryData && currentQueryData.videoSource) {
          videoSource = currentQueryData.videoSource;
          console.log('📰 Using article video source for auto-save:', videoSource);
        } else {
          // Check for both YouTube and Netflix analysis for video sources
          try {
            const result = await chrome.storage.local.get(['youtubeAnalysis', 'netflixAnalysis']);
            
            // First check Netflix analysis
            if (result.netflixAnalysis) {
              const netflixData = result.netflixAnalysis;
              console.log('🔍 Netflix analysis data found:', {
                text: netflixData.text?.substring(0, 30) + '...',
                title: netflixData.title,
                videoTimestamp: netflixData.videoTimestamp,
                originalUrl: netflixData.originalUrl,
                url: netflixData.url,
                timestamp: netflixData.timestamp,
                dataAge: Math.round((Date.now() - netflixData.timestamp) / 1000) + 's ago',
                textMatches: netflixData.text === text,
                allFields: Object.keys(netflixData)
              });
              
              // Check if this is recent data (within last 2 minutes) and matches current text
              if (Date.now() - netflixData.timestamp < 2 * 60 * 1000 && netflixData.text === text) {
                const netflixUrl = netflixData.originalUrl || netflixData.url; // Prefer original Netflix URL
                videoSource = {
                  url: netflixUrl, // Use Netflix URL (with timestamp)
                  originalUrl: netflixUrl,
                  title: netflixData.title,
                  channel: netflixData.title || 'Netflix',
                  videoTimestamp: netflixData.videoTimestamp,
                  timestamp: Date.now(),
                  learnedAt: new Date().toISOString(),
                  platform: 'netflix'
                };
                console.log('🎬 Found Netflix source data for auto-save:', videoSource);
                console.log('💾 Netflix title being saved:', netflixData.title);
                console.log('⏰ Netflix videoTimestamp being saved:', netflixData.videoTimestamp);
              } else {
                console.log('⚠️ Netflix data not used - reasons:', {
                  isRecent: Date.now() - netflixData.timestamp < 2 * 60 * 1000,
                  textMatches: netflixData.text === text,
                  expectedText: text?.substring(0, 30) + '...',
                  actualText: netflixData.text?.substring(0, 30) + '...'
                });
              }
            }
            
            // If no Netflix data, fallback to YouTube analysis
            if (!videoSource && result.youtubeAnalysis) {
              const ytData = result.youtubeAnalysis;
              // Check if this is recent data (within last 2 minutes) and matches current text
              if (Date.now() - ytData.timestamp < 2 * 60 * 1000 && ytData.text === text) {
                const youtubeUrl = ytData.youtubeUrl || ytData.originalUrl; // Prefer explicit youtubeUrl
                videoSource = {
                  url: youtubeUrl, // Use YouTube URL (with timestamp)
                  originalUrl: youtubeUrl,
                  title: ytData.title,
                  channel: ytData.title ? ytData.title.split(' - ')[0] : '未知頻道',
                  videoTimestamp: ytData.videoTimestamp, // Use correct field for video playback time
                  timestamp: Date.now(),
                  learnedAt: new Date().toISOString(),
                  platform: 'youtube'
                };
                console.log('🎬 Found YouTube source data for auto-save:', videoSource);
                console.log('🔗 YouTube URL vs YouGlish URL:', {
                  youtubeUrl: youtubeUrl,
                  youglishUrl: ytData.url,
                  usingUrl: videoSource.url,
                  availableFields: Object.keys(ytData)
                });
              }
            }
          } catch (error) {
            console.log('⚠️ Could not get video source data:', error);
          }
        }
        
        await storageManager.saveAIReport(
          text,
          language,
          analysis,
          audioData, // Include cached audio data
          videoSource, // Include video source data
          true, // updateExisting
          currentQueryData.detectionMethod || 'auto' // Include detection method
        );
        
        if (audioData) {
          console.log('🎯 AI report auto-saved with cached audio:', Math.round(audioData.size / 1024), 'KB');
        } else {
          console.log('AI analysis report saved automatically (no audio)');
        }
        
        // Show user-visible feedback for auto-save success
        showAutoSaveSuccess();
      } catch (error) {
        const result = await handleError(error, { operation: 'save_ai_report', context: 'auto_save' });
        log('Failed to save AI report:', result.success ? 'recovered' : error.message);
      }
    } else if (!autoSaveEnabled) {
      console.log('Auto-save is disabled, not saving AI report');
    } else if (!storageManager) {
      console.error('❌ StorageManager not initialized - AI report not saved');
    } else if (typeof storageManager.saveAIReport !== 'function') {
      console.error('❌ StorageManager.saveAIReport function not available - AI report not saved');
    }
    
  } catch (error) {
    const result = await handleError(error, { 
      operation: 'ai_analysis',
      context: 'generate_analysis',
      retry: () => generateAIAnalysis(forceRefresh),
      cacheKey: `ai_analysis_${text}_${language}`
    });
    
    if (result.success && result.data) {
      // Use cached or recovered data
      showAIAnalysis(result.data);
    } else {
      log('AI 分析失敗:', error.message);
      showAIError(`分析失敗: ${error.message}`);
    }
  }
}

// 等待 AI 服務載入
function waitForAIService() {
  return new Promise((resolve) => {
    const checkService = () => {
      if (typeof aiService !== 'undefined') {
        resolve();
      } else {
        setTimeout(checkService, 100);
      }
    };
    checkService();
  });
}

// 顯示 AI 載入狀態
function showAILoading() {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  const quickSearch = document.getElementById('quickSearchResults');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'block';
  if (result) result.style.display = 'none';
  // Keep quick search results visible during AI loading
  if (quickSearch) quickSearch.style.display = 'block';
}

// 顯示 AI 分析結果
function showAIResult(analysis) {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  const quickSearch = document.getElementById('quickSearchResults');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (quickSearch) quickSearch.style.display = 'none'; // Hide quick search when full analysis is ready
  if (result) {
    result.style.display = 'block';
    
    // Handle different types of analysis data
    let displayContent = '';
    let rawContent = '';
    
    if (typeof analysis === 'string') {
      rawContent = analysis;
    } else if (analysis && typeof analysis === 'object') {
      // If it's an object, try to extract meaningful content
      if (analysis.content) {
        rawContent = analysis.content;
      } else if (analysis.text) {
        rawContent = analysis.text;
      } else if (analysis.analysis) {
        rawContent = analysis.analysis;
      } else if (analysis.result) {
        rawContent = analysis.result;
      } else if (analysis.source === 'youtube-transcript-viewer' && analysis.example) {
        // Handle transcript segments - extract text and show analysis interface
        console.log('📺 Detected transcript segment data, extracting text for analysis');
        const extractedText = analysis.example;
        
        // Set up for new analysis instead of showing JSON
        displayContent = `
          <div class="analysis-prompt" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <div style="font-weight: bold; margin-bottom: 12px; color: #007bff;">
              🤖 AI Language Analysis
            </div>
            <div style="margin-bottom: 15px; font-size: 16px; color: #333; background: white; padding: 12px; border-radius: 6px; border: 1px solid #ddd;">
              "${extractedText}"
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <button id="generateAnalysisBtn" class="generate-analysis-btn" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                ✨ Generate Analysis
              </button>
              <button id="autoSaveBtn" class="auto-save-btn" style="background: #17a2b8; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                💾 Auto-Save
              </button>
              <button id="errorDetectionBtn" class="error-detection-btn" style="background: #fd7e14; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                🔍 錯誤檢測
              </button>
            </div>
            ${analysis.replayFunction && analysis.replayFunction.canReplay ? `
              <div style="margin-top: 15px; padding: 10px; background: #e7f3ff; border-radius: 6px; border-left: 3px solid #007bff;">
                <div style="font-size: 14px; color: #666; margin-bottom: 8px;">📺 YouTube Segment • ${analysis.replayFunction.displayTime}</div>
                <button class="replay-video-btn" data-video-url="${analysis.replayFunction.directUrl}" style="background: #ff0000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                  ⏰ 返回片段
                </button>
              </div>
            ` : ''}
          </div>
        `;
        
        // Update currentQueryData with the extracted text
        currentQueryData = {
          text: extractedText,
          language: 'english',
          url: analysis.youtubeLink || analysis.replayFunction?.directUrl || '',
          title: `YouTube Segment - ${analysis.timestamp || ''}`,
          source: 'transcript-segment'
        };
        
        // Show search result for the extracted text
        setTimeout(() => {
          showSearchResult(currentQueryData);
        }, 100);
        
      } else {
        // If no recognizable content field, format as JSON (fallback)
        displayContent = '<pre>' + JSON.stringify(analysis, null, 2) + '</pre>';
      }
    } else {
      displayContent = 'No analysis content available';
    }
    
    // Format the content for better readability
    if (rawContent) {
      displayContent = formatAIAnalysis(rawContent);
    }
    
    // Use SecurityUtils for safe content display
    if (window.SecurityFixes && typeof displayContent === 'string') {
      window.SecurityFixes.safeSetHTML(result, displayContent);
    } else {
      result.innerHTML = displayContent;
    }
    
    // Add event listeners for transcript segment buttons
    if (analysis && analysis.source === 'youtube-transcript-viewer') {
      setTimeout(() => {
        // Generate Analysis button
        const generateBtn = document.getElementById('generateAnalysisBtn');
        if (generateBtn) {
          generateBtn.addEventListener('click', async () => {
            console.log('🤖 Generating analysis for transcript segment:', currentQueryData.text);
            generateBtn.textContent = '⏳ Generating...';
            generateBtn.disabled = true;
            
            try {
              await generateAIAnalysis();
              console.log('✅ Analysis generated successfully');
            } catch (error) {
              console.error('❌ Analysis generation failed:', error);
              generateBtn.textContent = '❌ Failed - Try Again';
              generateBtn.disabled = false;
            }
          });
        }
        
        // Auto-Save button  
        const autoSaveBtn = document.getElementById('autoSaveBtn');
        if (autoSaveBtn) {
          autoSaveBtn.addEventListener('click', () => {
            console.log('💾 Auto-save clicked for transcript segment');
            // Toggle auto-save or trigger save
            if (typeof toggleAutoSave === 'function') {
              toggleAutoSave();
            }
          });
        }
        
        // Error Detection button
        const errorBtn = document.getElementById('errorDetectionBtn');
        if (errorBtn) {
          errorBtn.addEventListener('click', async () => {
            console.log('🔍 Error detection clicked for transcript segment');
            errorBtn.textContent = '⏳ Checking...';
            errorBtn.disabled = true;
            
            try {
              // Enable error detection and generate analysis
              if (window.aiService) {
                await window.aiService.initialize();
                window.aiService.settings.features.errorDetection = true;
                await generateAIAnalysis();
              }
            } catch (error) {
              console.error('❌ Error detection failed:', error);
              errorBtn.textContent = '❌ Failed';
              setTimeout(() => {
                errorBtn.textContent = '🔍 錯誤檢測';
                errorBtn.disabled = false;
              }, 2000);
            }
          });
        }
        
        // Replay video button
        const replayBtn = document.querySelector('.replay-video-btn');
        if (replayBtn) {
          replayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const videoUrl = replayBtn.dataset.videoUrl;
            console.log('⏰ Opening YouTube segment:', videoUrl);
            if (videoUrl) {
              window.open(videoUrl, '_blank');
            }
          });
        }
      }, 100);
    }
    log('AI analysis displayed:', typeof analysis, analysis);
    
    // Also show the audio section when analysis is displayed
    const audioSection = document.getElementById('aiAudioSection');
    log('Checking audio section visibility:', {
      audioSection: !!audioSection,
      aiService: !!aiService,
      isInitialized: aiService?.isInitialized,
      isAvailable: aiService?.isAvailable(),
      isAudioAvailable: aiService?.isAudioAvailable(),
      provider: aiService?.settings?.provider,
      audioPronunciation: aiService?.settings?.features?.audioPronunciation
    });
    
    if (audioSection) {
      audioSection.style.display = 'block';
      const audioContent = document.getElementById('audioContent');
      
      // First check if we have cached audio for the current query
      if (currentQueryData?.text && currentQueryData?.language) {
        const cachedAudio = getCachedAudio(currentQueryData.text, currentQueryData.language);
        
        if (cachedAudio && cachedAudio.audioUrl) {
          console.log('Found cached audio for current query, showing play button');
          if (audioContent) {
            audioContent.innerHTML = `
              <div class="audio-ready">
                ✅ 語音已準備 (${Math.round((cachedAudio.size || 0) / 1024)} KB) - ${cachedAudio.voice || 'OpenAI TTS'}
                <br>
                <button id="playCachedAudioBtn" style="
                  background: #1976d2; 
                  color: white; 
                  border: none; 
                  padding: 8px 16px; 
                  border-radius: 4px; 
                  cursor: pointer; 
                  margin: 8px 0;
                  font-size: 14px;
                ">🔊 播放語音</button>
              </div>
            `;
            
            // Add event listener for the play button
            setTimeout(() => {
              const playBtn = document.getElementById('playCachedAudioBtn');
              if (playBtn) {
                playBtn.addEventListener('click', async () => {
                  const originalText = playBtn.textContent;
                  playBtn.textContent = '播放中...';
                  playBtn.disabled = true;
                  
                  try {
                    await playCachedAudio(cachedAudio);
                  } catch (error) {
                    console.error('Failed to play cached audio:', error);
                    showMessage('播放語音失敗', 'error');
                  } finally {
                    playBtn.textContent = originalText;
                    playBtn.disabled = false;
                  }
                });
              }
            }, 100);
          }
          return; // Exit early since we found cached audio
        }
      }
      
      // If no cached audio, show service status
      if (aiService && aiService.isAudioAvailable()) {
        console.log('Showing audio section - audio service available but no cached audio');
        if (audioContent) {
          audioContent.innerHTML = `
            <div class="audio-info">
              🎵 語音功能已啟用
              <br><small style="color: #666;">語音將在生成後自動顯示</small>
            </div>
          `;
        }
      } else {
        console.log('Audio section shown with service status message');
        if (audioContent) {
          if (!aiService) {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, 'AI 服務載入中...', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">AI 服務載入中...</div>';
            }
          } else if (!aiService.isInitialized) {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, 'AI 服務初始化中...', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">AI 服務初始化中...</div>';
            }
          } else if (!aiService.isAvailable()) {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, '請先在設定頁面配置 API 金鑰', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">請先在設定頁面配置 API 金鑰</div>';
            }
          } else if (aiService.settings?.provider !== 'openai') {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, '語音功能需要 OpenAI API', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">語音功能需要 OpenAI API</div>';
            }
          } else {
            if (window.SecurityFixes) {
              window.SecurityFixes.safeUpdateAudioContent(audioContent, '語音功能未啟用', true);
            } else {
              audioContent.innerHTML = '<div class="audio-error">語音功能未啟用</div>';
            }
          }
        }
      }
    }
  }
  
  // Update manual save button visibility after showing analysis
  updateAutoSaveButtonUI();
}

// Format AI analysis for better readability (render markdown for display)
function formatAIAnalysis(content, context = 'main') {
  if (!content) return '';
  
  // First escape HTML to prevent XSS
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Render markdown formatting for better display
  formatted = formatted
    // Headers (##, ###, ####)
    .replace(/^####\s+(.+)$/gm, '<h4 style="color: #1976d2; font-size: 16px; font-weight: 600; margin: 16px 0 8px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;">$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3 style="color: #1976d2; font-size: 18px; font-weight: 600; margin: 20px 0 12px 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px;">$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2 style="color: #1565c0; font-size: 20px; font-weight: 700; margin: 24px 0 16px 0; border-bottom: 2px solid #1976d2; padding-bottom: 8px;">$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1 style="color: #0d47a1; font-size: 24px; font-weight: 700; margin: 32px 0 20px 0; border-bottom: 3px solid #1976d2; padding-bottom: 10px;">$1</h1>')
    
    // Bold text (**text**)
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1976d2;">$1</strong>')
    
    // Italic text (*text*)
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em style="font-style: italic; color: #666;">$1</em>')
    
    // Code blocks (```code```)
    .replace(/```([^`]+)```/g, '<pre style="background: #f5f5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #1976d2; margin: 12px 0; font-family: monospace; overflow-x: auto; font-size: 13px;"><code>$1</code></pre>')
    
    // Inline code (`code`)
    .replace(/`([^`]+)`/g, '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; color: #d32f2f;">$1</code>')
    
    // Unordered list items (- item)
    .replace(/^-\s+(.+)$/gm, '<li style="margin: 4px 0; padding-left: 8px; color: #333;">$1</li>')
    
    // Convert consecutive list items into proper ul tags
    .replace(/(<li[^>]*>.*<\/li>\s*)+/gs, '<ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">$&</ul>')
    
    // Line breaks
    .replace(/\n/g, '<br>');
  
  // Different font sizes for different contexts
  const fontSize = context === 'saved-tab' ? '12px' : '14px';
  const lineHeight = context === 'saved-tab' ? '1.5' : '1.6';
  
  return `<div style="color: #333; font-size: ${fontSize}; line-height: ${lineHeight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 100%; word-wrap: break-word;">${formatted}</div>`;
}

// 顯示 AI 錯誤
function showAIError(message) {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  
  if (placeholder) placeholder.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (result) {
    result.style.display = 'block';
    if (window.SecurityFixes) {
      window.SecurityFixes.safeClearElement(result);
      const errorDiv = window.SecurityFixes.safeCreateElement('div', `❌ ${message}`, 'ai-error');
      result.appendChild(errorDiv);
    } else {
      result.innerHTML = `<div class="ai-error">❌ ${message}</div>`;
    }
  }
}

// Show AI placeholder with generate button for transcript-saved sentences
function showAIPlaceholderWithButton() {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  const quickSearch = document.getElementById('quickSearchResults');
  
  if (loading) loading.style.display = 'none';
  if (result) result.style.display = 'none';
  if (quickSearch) quickSearch.style.display = 'none';
  
  if (placeholder && currentQueryData && currentQueryData.text) {
    placeholder.style.display = 'block';
    placeholder.innerHTML = `
      <div class="analysis-prompt" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
        <div style="font-weight: bold; margin-bottom: 12px; color: #007bff;">
          🤖 AI Language Analysis
        </div>
        <div style="margin-bottom: 15px; font-size: 16px; color: #333; background: white; padding: 12px; border-radius: 6px; border: 1px solid #ddd;">
          "${currentQueryData.text}"
        </div>
        <div style="margin-bottom: 10px; color: #666; font-size: 14px;">
          📝 This sentence was saved from transcript but hasn't been analyzed yet.
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <button id="generateAnalysisBtn" class="generate-analysis-btn" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
            ✨ Generate Analysis
          </button>
        </div>
      </div>
    `;
    
    // Add event listener for generate button
    setTimeout(() => {
      const generateBtn = document.getElementById('generateAnalysisBtn');
      if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
          console.log('🤖 Generating analysis for transcript-saved sentence:', currentQueryData.text);
          generateBtn.textContent = '⏳ Generating...';
          generateBtn.disabled = true;
          
          try {
            await generateAIAnalysis();
            console.log('✅ Analysis generated successfully');
          } catch (error) {
            console.error('❌ Analysis generation failed:', error);
            generateBtn.textContent = '❌ Failed - Try Again';
            generateBtn.disabled = false;
          }
        });
      }
    }, 100);
  }
}

// A2 Test Usage Guidance Function
async function generateA2TestUsage() {
  if (!currentQueryData || !currentQueryData.text || !currentQueryData.language) {
    console.log('❌ No analysis data available for A2 test usage');
    return;
  }

  const a2TestUsageBtn = document.getElementById('a2TestUsageBtn');
  if (a2TestUsageBtn) {
    a2TestUsageBtn.disabled = true;
    a2TestUsageBtn.textContent = '⏳ Generating A2 Guidance...';
  }

  try {
    console.log('🎯 Generating A2 test usage guidance for:', currentQueryData.text);
    
    // Initialize AI service
    if (typeof aiService === 'undefined' || !aiService) {
      window.aiService = new AIService();
    }
    const initialized = await aiService.initialize();
    if (!initialized) {
      throw new Error('AI service not available');
    }

    // Create A2-specific prompt
    const a2Prompt = buildA2TestUsagePrompt(currentQueryData.text, currentQueryData.language);
    
    // Get A2 guidance from AI
    const a2Guidance = await aiService.getAnalysis(a2Prompt, 'medium');
    
    // Display the A2 guidance in a modal or expand the analysis section
    showA2TestUsageResult(a2Guidance);
    
  } catch (error) {
    console.error('❌ A2 test usage generation failed:', error);
    showA2TestUsageError(error.message);
  } finally {
    if (a2TestUsageBtn) {
      a2TestUsageBtn.disabled = false;
      a2TestUsageBtn.textContent = '📝 A2 Test Usage';
    }
  }
}

function buildA2TestUsagePrompt(text, language) {
  const languageNames = {
    'english': 'English',
    'dutch': 'Dutch',
    'german': 'German',
    'spanish': 'Spanish',
    'french': 'French',
    'italian': 'Italian',
    'portuguese': 'Portuguese',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'korean': 'Korean'
  };
  
  const languageName = languageNames[language] || language;
  
  return `請為以下${languageName}句子提供A2語言測驗使用指導：

句子: "${text}"

請提供以下內容：

## 📝 A2寫作測驗使用指導
1. **寫作情境**: 這個句子適合用在什麼A2寫作情境？（如：自我介紹、描述日常活動、簡單書信等）
2. **句型結構**: 說明這個句子的結構，以及A2學習者如何運用這個結構
3. **替換練習**: 提供3-4個類似結構的變化例句供A2學習者練習
4. **常見錯誤**: A2學習者使用這個句型時容易犯的錯誤

## 🗣️ A2口說測驗使用指導  
1. **口說情境**: 這個句子適合用在什麼A2口說情境？（如：介紹自己、描述圖片、日常對話等）
2. **發音重點**: 標出需要注意的發音重點和重音位置
3. **對話練習**: 提供2-3個包含這個句子的簡單對話範例
4. **表達技巧**: 說明如何自然地在A2口說中使用這個句子

## 🎯 A2程度適用性評估
1. **難度評級**: 評估這個句子對A2學習者的難度（簡單/適中/稍難）
2. **關鍵詞彙**: 標出A2學習者需要掌握的核心詞彙
3. **語法點**: 說明涉及的A2語法點
4. **學習建議**: 給A2學習者的具體學習建議

請用繁體中文回答，並用清楚的結構呈現。`;
}

function showA2TestUsageResult(guidance) {
  // Create or get A2 guidance result container
  let a2ResultContainer = document.getElementById('a2TestUsageResult');
  if (!a2ResultContainer) {
    // Create new container after the main analysis result
    const analysisResult = document.getElementById('aiAnalysisResult');
    if (analysisResult && analysisResult.parentNode) {
      a2ResultContainer = document.createElement('div');
      a2ResultContainer.id = 'a2TestUsageResult';
      a2ResultContainer.className = 'a2-test-usage-result';
      a2ResultContainer.style.cssText = `
        margin-top: 20px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #28a745;
        display: none;
      `;
      analysisResult.parentNode.insertBefore(a2ResultContainer, analysisResult.nextSibling);
    }
  }
  
  if (a2ResultContainer) {
    // Format and display the guidance
    const formattedGuidance = formatAIAnalysis(guidance, 'a2-guidance');
    a2ResultContainer.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
        <h3 style="color: #28a745; margin: 0; font-size: 18px;">
          🎯 A2 Test Usage Guidance
        </h3>
        <button id="closeA2Guidance" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;" title="Close A2 guidance">
          ×
        </button>
      </div>
      <div class="a2-guidance-content">
        ${formattedGuidance}
      </div>
    `;
    
    a2ResultContainer.style.display = 'block';
    
    // Add close button functionality
    const closeBtn = document.getElementById('closeA2Guidance');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        a2ResultContainer.style.display = 'none';
      });
    }
    
    // Scroll to the guidance
    a2ResultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showA2TestUsageError(errorMessage) {
  // Show error in a simple alert or notification
  alert(`A2 測驗指導生成失敗: ${errorMessage}`);
}

// Quick Search Results Functions
function showQuickSearchResults(text, language) {
  const quickSearchDiv = document.getElementById('quickSearchResults');
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  
  if (!quickSearchDiv) return;
  
  // Hide placeholder and show quick search results
  if (placeholder) placeholder.style.display = 'none';
  quickSearchDiv.style.display = 'block';
  
  // Start loading quick results in background (non-blocking)
  populateQuickSearchResults(text, language).catch(error => {
    console.error('ℹ️ Quick search failed, but AI analysis continues:', error);
  });
}

async function populateQuickSearchResults(text, language) {
  const translationDiv = document.getElementById('quickTranslation');
  const pronunciationDiv = document.getElementById('quickPronunciation');
  const definitionDiv = document.getElementById('quickDefinition');
  
  // Show loading state
  if (translationDiv) translationDiv.textContent = '載入中...';
  if (pronunciationDiv) pronunciationDiv.textContent = '載入中...';
  if (definitionDiv) definitionDiv.textContent = '載入中...';
  
  // Load results in parallel with timeouts to avoid blocking
  const loadWithTimeout = async (fn, fallback, timeoutMs = 5000) => {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]);
      return result || fallback;
    } catch (error) {
      console.log(`Quick search timeout/error: ${error.message}`);
      return fallback;
    }
  };
  
  try {
    // Load all results in parallel with timeouts
    const [translation, pronunciation, definition] = await Promise.allSettled([
      loadWithTimeout(() => getQuickTranslation(text, language), '翻譯服務不可用'),
      loadWithTimeout(() => getQuickPronunciation(text, language), '發音服務不可用'),
      loadWithTimeout(() => getQuickDefinition(text, language), '定義服務不可用')
    ]);
    
    // Update UI with results (even if some failed)
    if (translationDiv && translation.status === 'fulfilled') {
      translationDiv.textContent = translation.value;
    }
    
    if (pronunciationDiv && pronunciation.status === 'fulfilled') {
      pronunciationDiv.textContent = pronunciation.value;
    }
    
    if (definitionDiv && definition.status === 'fulfilled') {
      definitionDiv.textContent = definition.value;
    }
    
  } catch (error) {
    console.error('Error loading quick search results:', error);
    
    // Show error state
    if (translationDiv) translationDiv.textContent = '載入失敗';
    if (pronunciationDiv) pronunciationDiv.textContent = '載入失敗';
    if (definitionDiv) definitionDiv.textContent = '載入失敗';
  }
}

// 全域 AI 分析取消控制器
let currentAnalysisController = null;

// 帶超時保護和重試機制的非阻塞 AI 分析
async function generateAnalysisWithTimeout(aiService, text, language, timeoutMs = 45000) {
  const maxRetries = 3;
  const baseTimeout = Math.min(timeoutMs, 30000); // 基礎超時不超過30秒
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 取消之前的請求
    if (currentAnalysisController) {
      currentAnalysisController.abort();
    }
    
    // 創建新的控制器
    currentAnalysisController = new AbortController();
    
    // 漸進式超時：第一次30秒，第二次45秒，第三次60秒
    const currentTimeout = baseTimeout + (attempt - 1) * 15000;
    
    console.log(`🔄 AI 分析嘗試 ${attempt}/${maxRetries}，超時設定: ${currentTimeout/1000}秒`);
    
    // 顯示重試狀態（如果不是第一次嘗試）
    if (attempt > 1) {
      const statusDiv = document.querySelector('.ai-analysis .status-message');
      if (statusDiv) {
        statusDiv.innerHTML = `🔄 重試中... (${attempt}/${maxRetries}) - 延長超時至 ${currentTimeout/1000}秒`;
        statusDiv.className = 'status-message warning';
      }
    }
    
    try {
      const result = await new Promise((resolve, reject) => {
        // 設置超時
        const timeoutId = setTimeout(() => {
          if (currentAnalysisController) {
            currentAnalysisController.abort();
          }
          
          // 提供更詳細的錯誤信息
          let errorMsg = `AI 分析超時 (${currentTimeout / 1000}秒)`;
          if (attempt < maxRetries) {
            errorMsg += ` - 準備重試 (${attempt}/${maxRetries})`;
          } else {
            errorMsg += `\n\n💡 建議:\n• 檢查網路連線是否穩定\n• 嘗試使用較短的文字\n• 等待片刻後重新分析\n• 如持續失敗，請重新載入頁面`;
          }
          
          reject(new Error(errorMsg));
        }, currentTimeout);
        
        // 執行 AI 分析（非阻塞）
        aiService.generateAnalysis(text, language)
          .then(result => {
            clearTimeout(timeoutId);
            currentAnalysisController = null;
            console.log(`✅ AI 分析成功 (第 ${attempt} 次嘗試)`);
            resolve(result);
          })
          .catch(error => {
            clearTimeout(timeoutId);
            currentAnalysisController = null;
            reject(error);
          });
      });
      
      return result; // 成功時返回結果
      
    } catch (error) {
      console.warn(`⚠️ AI 分析第 ${attempt} 次嘗試失敗:`, error.message);
      
      // 如果是最後一次嘗試，拋出錯誤
      if (attempt === maxRetries) {
        // 檢測可能的連線問題
        const connectionStatus = await checkConnectionQuality();
        let enhancedError = error.message;
        
        if (!connectionStatus.isOnline) {
          enhancedError += '\n\n🌐 網路連線問題：請檢查網路連線';
        } else if (connectionStatus.isSlowConnection) {
          enhancedError += '\n\n🐌 網路較慢：建議等待網路改善或使用較短文字';
        } else if (error.message.includes('AbortError')) {
          enhancedError = '請求被取消 - 請重新分析';
        } else if (error.message.includes('429')) {
          enhancedError = 'API 使用次數超限 - 請稍後5分鐘再試';
        } else if (error.message.includes('500') || error.message.includes('502')) {
          enhancedError += '\n\n🔧 伺服器暫時無法回應，請稍後重試';
        }
        
        throw new Error(enhancedError);
      }
      
      // 指數退避：等待時間隨嘗試次數增加
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s (最多5s)
      console.log(`⏳ 等待 ${delayMs}ms 後重試...`);
      
      const statusDiv = document.querySelector('.ai-analysis .status-message');
      if (statusDiv) {
        statusDiv.innerHTML = `⏳ 等待 ${delayMs/1000}秒後重試...`;
        statusDiv.className = 'status-message warning';
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// 檢測網路連線品質
async function checkConnectionQuality() {
  try {
    const start = Date.now();
    const response = await fetch('https://www.google.com/favicon.ico', { 
      mode: 'no-cors',
      cache: 'no-cache'
    });
    const end = Date.now();
    const latency = end - start;
    
    return {
      isOnline: true,
      isSlowConnection: latency > 3000, // 超過3秒視為慢速連線
      latency: latency
    };
  } catch (error) {
    return {
      isOnline: false,
      isSlowConnection: true,
      latency: 9999
    };
  }
}

// 取消當前 AI 分析
function cancelCurrentAnalysis() {
  if (currentAnalysisController) {
    currentAnalysisController.abort();
    currentAnalysisController = null;
    console.log('🚫 用戶取消了 AI 分析');
    
    // 顯示取消狀態
    showAIError('分析已取消');
    return true;
  }
  return false;
}

// 顯示 AI 載入狀態（帶取消按鈕）
function showAILoadingWithCancel(text, language) {
  const placeholder = document.getElementById('aiAnalysisPlaceholder');
  const loading = document.getElementById('aiAnalysisLoading');
  const result = document.getElementById('aiAnalysisResult');
  const quickSearch = document.getElementById('quickSearchResults');
  
  if (placeholder) placeholder.style.display = 'none';
  if (result) result.style.display = 'none';
  if (quickSearch) quickSearch.style.display = 'block';
  
  if (loading) {
    loading.style.display = 'block';
    loading.innerHTML = `
      <div class="ai-loading-enhanced" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        color: white;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      ">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">
          🤖 AI 正在分析中...
        </div>
        
        <div style="margin-bottom: 16px; opacity: 0.9; font-size: 14px;">
          正在處理: "${text.length > 50 ? text.substring(0, 50) + '...' : text}"
        </div>
        
        <div class="loading-spinner" style="
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 16px auto;
        "></div>
        
        <div style="font-size: 12px; opacity: 0.8; margin-bottom: 16px;">
          預計等待時間: 10-15 秒
        </div>
        
        <button id="cancelAnalysisBtn" style="
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          ✖ 取消分析
        </button>
      </div>
      
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    // 添加取消按鈕事件監聽
    setTimeout(() => {
      const cancelBtn = document.getElementById('cancelAnalysisBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          if (cancelCurrentAnalysis()) {
            cancelBtn.textContent = '已取消';
            cancelBtn.disabled = true;
            cancelBtn.style.background = 'rgba(255,0,0,0.3)';
          }
        });
      }
    }, 100);
  }
}

// Quick translation using real translation APIs
async function getQuickTranslation(text, language) {
  try {
    // Try multiple translation services
    let translation = null;
    
    // First try: Google Translate API (free tier)
    translation = await getGoogleTranslation(text, language);
    if (translation) return translation;
    
    // Second try: Microsoft Translator (backup)
    translation = await getMicrosoftTranslation(text, language);
    if (translation) return translation;
    
    // Third try: Built-in dictionary for common words
    if (language === 'english') {
      translation = await getBuiltInTranslation(text);
      if (translation) return translation;
    }
    
    // Last resort: Basic language info
    const langNames = {
      'english': '英語詞彙',
      'japanese': '日語詞彙', 
      'korean': '韓語詞彙',
      'dutch': '荷蘭語詞彙'
    };
    
    return `${langNames[language] || '外語詞彙'} - 正在查詢翻譯...`;
    
  } catch (error) {
    console.error('Quick translation error:', error);
    return '翻譯服務暫時無法使用';
  }
}

// Google Translate API (using public endpoint)
async function getGoogleTranslation(text, fromLang) {
  try {
    // Map our language codes to Google's
    const langMap = {
      'english': 'en',
      'japanese': 'ja', 
      'korean': 'ko',
      'dutch': 'nl'
    };
    
    const sourceLang = langMap[fromLang] || 'auto';
    const targetLang = 'zh-TW'; // Traditional Chinese
    
    // Use Google Translate's public API endpoint with timeout
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('Google Translate API failed');
    
    const data = await response.json();
    
    // Parse Google Translate response
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      const translatedText = data[0][0][0];
      return translatedText;
    }
    
    return null;
  } catch (error) {
    console.error('Google translation failed:', error);
    return null;
  }
}

// Microsoft Translator (backup service)
async function getMicrosoftTranslation(text, fromLang) {
  try {
    // Map languages for Microsoft Translator
    const langMap = {
      'english': 'en',
      'japanese': 'ja',
      'korean': 'ko', 
      'dutch': 'nl'
    };
    
    const sourceLang = langMap[fromLang] || 'en';
    
    // Use Microsoft Translator's public endpoint with timeout
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sourceLang}&to=zh-Hant`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ text: text }]),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('Microsoft Translator failed');
    
    const data = await response.json();
    
    if (data && data[0] && data[0].translations && data[0].translations[0]) {
      return data[0].translations[0].text;
    }
    
    return null;
  } catch (error) {
    console.error('Microsoft translation failed:', error);
    return null;
  }
}

// Get pronunciation guide
async function getQuickPronunciation(text, language) {
  try {
    if (language === 'english') {
      // Try to provide basic IPA or pronunciation guide
      const pronunciation = await getBasicPronunciation(text);
      if (pronunciation) return pronunciation;
      
      // Fallback: simple phonetic guide
      return `/${text.toLowerCase()}/`;
    } else if (language === 'japanese') {
      return '假名読み方を確認してください';
    } else if (language === 'korean') {
      return '한글 발음을 확인해주세요';
    } else if (language === 'dutch') {
      return 'Nederlandse uitspraak';
    }
    
    return '發音資訊需要完整分析';
  } catch (error) {
    console.error('Quick pronunciation error:', error);
    return '發音資訊載入失敗';
  }
}

// Get basic definition using free dictionary APIs
async function getQuickDefinition(text, language) {
  try {
    if (language === 'english') {
      // ✅ FIX: Extract first meaningful word for dictionary lookup
      const words = text.trim().split(/\s+/).filter(word => 
        word.length > 2 && /^[a-zA-Z]+$/.test(word)
      );
      
      if (words.length > 0) {
        // Try to get real English definition for the first word
        let definition = await getFreeDictionaryDefinition(words[0]);
        if (definition) return `${words[0]}: ${definition}`;
        
        // Fallback to built-in dictionary
        definition = await getBuiltInDefinition(words[0]);
        if (definition) return `${words[0]}: ${definition}`;
      }
    }
    
    // For other languages, try to get basic info
    const langNames = {
      'english': '英語單字',
      'japanese': '日語詞彙',
      'korean': '韓語詞彙', 
      'dutch': '荷蘭語詞彙'
    };
    
    return `${langNames[language] || '外語詞彙'} - 等待完整 AI 分析取得詳細定義`;
  } catch (error) {
    console.error('Quick definition error:', error);
    return '定義載入中...';
  }
}

// Get definition from Free Dictionary API
async function getFreeDictionaryDefinition(word) {
  try {
    // Validate input
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return null;
    }
    
    const cleanWord = word.trim().toLowerCase();
    
    // ✅ FIX: Only lookup single words, not sentences
    const wordCount = cleanWord.split(/\s+/).length;
    if (wordCount > 1) {
      console.log(`⚠️ Skipping dictionary lookup for multi-word phrase: "${cleanWord}"`);
      return null;
    }
    
    // Skip very short words or non-alphabetic content
    if (cleanWord.length < 2 || !/^[a-zA-Z]+$/.test(cleanWord)) {
      return null;
    }
    
    // Use the free dictionary API
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`📚 Dictionary: No definition found for word: ${cleanWord}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
      const meaning = data[0].meanings[0];
      const partOfSpeech = meaning.partOfSpeech || '';
      const definition = meaning.definitions && meaning.definitions[0] && meaning.definitions[0].definition;
      
      if (definition) {
        // Return simplified definition in Traditional Chinese where possible
        let result = `(${partOfSpeech}) ${definition}`;
        
        // Limit length for quick display
        if (result.length > 100) {
          result = result.substring(0, 97) + '...';
        }
        
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Free dictionary lookup failed:', error.message || error);
    // Don't treat this as a critical error - just return null for graceful fallback
    return null;
  }
}

// Built-in translation database (expanded common words)
async function getBuiltInTranslation(word) {
  const basicTranslations = {
    // Greetings & Basic
    'hello': '你好',
    'hi': '嗨',
    'bye': '再見',
    'goodbye': '再見',
    'thanks': '謝謝',
    'thank': '謝謝',
    'please': '請',
    'sorry': '抱歉',
    'excuse': '藉口',
    'yes': '是',
    'no': '否',
    
    // Common Verbs
    'have': '有',
    'do': '做',
    'go': '去',
    'come': '來',
    'see': '看見',
    'get': '得到',
    'make': '製作',
    'take': '拿取',
    'give': '給予',
    'think': '思考',
    'know': '知道',
    'feel': '感覺',
    'want': '想要',
    'need': '需要',
    'like': '喜歡',
    'love': '愛',
    'eat': '吃',
    'drink': '喝',
    'sleep': '睡覺',
    'work': '工作',
    'study': '學習',
    'play': '玩耍',
    'read': '閱讀',
    'write': '寫',
    'speak': '說話',
    'listen': '聽',
    'walk': '走路',
    'run': '跑步',
    'sit': '坐',
    'stand': '站',
    
    // Common Nouns
    'world': '世界',
    'people': '人們',
    'person': '人',
    'man': '男人',
    'woman': '女人',
    'child': '孩子',
    'family': '家庭',
    'friend': '朋友',
    'home': '家',
    'house': '房子',
    'school': '學校',
    'work': '工作',
    'office': '辦公室',
    'car': '汽車',
    'food': '食物',
    'water': '水',
    'money': '錢',
    'book': '書',
    'computer': '電腦',
    'phone': '電話',
    'music': '音樂',
    'movie': '電影',
    
    // Time
    'time': '時間',
    'day': '日子',
    'night': '夜晚',
    'morning': '早晨',
    'afternoon': '下午',
    'evening': '晚上',
    'today': '今天',
    'tomorrow': '明天',
    'yesterday': '昨天',
    'week': '星期',
    'month': '月',
    'year': '年',
    
    // Adjectives
    'good': '好的',
    'bad': '壞的',
    'big': '大的',
    'small': '小的',
    'new': '新的',
    'old': '舊的',
    'young': '年輕的',
    'happy': '快樂的',
    'sad': '悲傷的',
    'beautiful': '美麗的',
    'ugly': '醜陋的',
    'hot': '熱的',
    'cold': '冷的',
    'easy': '容易的',
    'difficult': '困難的',
    'hard': '困難的',
    'important': '重要的',
    'interesting': '有趣的',
    'boring': '無聊的',
    'fun': '有趣的',
    'great': '很棒的',
    'wonderful': '很棒的',
    'amazing': '驚人的',
    'awesome': '很棒的',
    
    // Colors
    'red': '紅色',
    'blue': '藍色',
    'green': '綠色',
    'yellow': '黃色',
    'black': '黑色',
    'white': '白色',
    'brown': '棕色',
    'pink': '粉紅色',
    'purple': '紫色',
    'orange': '橙色',
    
    // Numbers
    'one': '一',
    'two': '二',
    'three': '三',
    'four': '四',
    'five': '五',
    'six': '六',
    'seven': '七',
    'eight': '八',
    'nine': '九',
    'ten': '十'
  };
  
  const lowerWord = word.toLowerCase().trim();
  return basicTranslations[lowerWord] || null;
}

// Basic pronunciation for common words
async function getBasicPronunciation(word) {
  const basicPronunciations = {
    'hello': '/həˈloʊ/',
    'world': '/wɜːrld/',
    'good': '/ɡʊd/',
    'beautiful': '/ˈbjuːtɪfəl/',
    'interesting': '/ˈɪntrəstɪŋ/',
    'water': '/ˈwɔːtər/',
    'house': '/haʊs/',
    'school': '/skuːl/',
    'friend': '/frend/',
    'family': '/ˈfæməli/'
  };
  
  const lowerWord = word.toLowerCase().trim();
  return basicPronunciations[lowerWord] || null;
}

// Basic definition for common words  
async function getBuiltInDefinition(word) {
  const basicDefinitions = {
    'hello': '問候語，用於見面時的招呼',
    'world': '地球，世界',
    'good': '好的，良好的',
    'beautiful': '美麗的，漂亮的',
    'interesting': '有趣的，引人入勝的',
    'water': '水，無色無味的液體',
    'house': '房子，住宅',
    'school': '學校，教育機構',
    'friend': '朋友，友人',
    'family': '家庭，家人'
  };
  
  const lowerWord = word.toLowerCase().trim();
  return basicDefinitions[lowerWord] || null;
}

// ================================
// Load transcript view
async function loadTranscriptView() {
  try {
    console.log('🎬 Loading transcript view...');
    const container = document.getElementById('transcriptRestructurerContainer');
    if (!container) {
      console.error('❌ Transcript container not found');
      showTranscriptError();
      return;
    }

    console.log('✅ Container found:', container);
    console.log('🔍 Checking TranscriptRestructurer class:', typeof window.TranscriptRestructurer);
    console.log('🔍 Checking YouTubeTranscriptFetcher class:', typeof window.YouTubeTranscriptFetcher);

    // Initialize transcript restructurer if not already done
    if (!window.transcriptRestructurer) {
      if (window.TranscriptRestructurer) {
        console.log('🚀 Creating new TranscriptRestructurer...');
        window.transcriptRestructurer = new TranscriptRestructurer(container, aiService);
        console.log('✅ TranscriptRestructurer created successfully');
      } else {
        console.error('❌ TranscriptRestructurer class not available');
        showTranscriptError();
        return;
      }
    } else {
      console.log('♻️ Using existing TranscriptRestructurer');
      // ✅ NEW: Refresh platform detection when reusing existing instance
      if (window.transcriptRestructurer && window.transcriptRestructurer.refreshPlatform) {
        console.log('🔄 Refreshing platform detection for existing TranscriptRestructurer...');
        await window.transcriptRestructurer.refreshPlatform();
      }
    }
    
    console.log('✅ Transcript view loaded successfully');
  } catch (error) {
    console.error('❌ Error loading transcript view:', error);
    showTranscriptError();
  }
}

function showTranscriptError() {
  const transcriptView = document.getElementById('transcriptView');
  if (transcriptView) {
    transcriptView.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <h3>無法載入字幕重構功能</h3>
        <p>字幕重構服務目前無法使用。請確保：</p>
        <ul style="text-align: left; max-width: 300px; margin: 0 auto;">
          <li>正在YouTube影片頁面</li>
          <li>影片有可用的字幕</li>
          <li>已開啟AI服務</li>
        </ul>
        <button onclick="loadTranscriptView()" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 16px;
        ">重試</button>
      </div>
    `;
  }
}

// Saved reports functionality
async function viewSavedReport(reportId) {
  console.log('Viewing saved report:', reportId);
  
  try {
    let report = null;
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      const reports = await storageManager.getAIReports();
      report = reports.find(r => r.id === reportId);
    } else {
      // Fallback: get from storage directly
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          const reports = data.aiReports || [];
          resolve(reports.find(r => r.id === reportId));
        });
      });
      report = result;
    }
    
    if (report) {
      console.log('Found saved report:', report);
      
      // Load the saved report into the current view
      currentQueryData = {
        text: report.searchText,
        language: report.language,
        primaryUrl: `https://youglish.com/pronounce/${encodeURIComponent(report.searchText)}/${report.language}`,
        autoAnalysis: false // Don't auto-generate new analysis
      };

      // Check if this is a transcript-saved sentence with no actual analysis
      const hasActualAnalysis = report.analysisData && (
        typeof report.analysisData === 'string' || // Old format: string analysis
        (report.analysisData.analysis && report.analysisData.analysis !== null) || // New format: has analysis content
        (report.analysisData.content && report.analysisData.content.trim()) // Alternative content field
      );

      if (hasActualAnalysis) {
        // Has real analysis data - display it
        currentAIAnalysis = report.analysisData;
        // Show search result with the report data
        showSearchResult(currentQueryData);
        // Display the saved analysis
        showAIResult(report.analysisData);
      } else {
        // No actual analysis (transcript-saved sentence) - clear analysis and show generate button
        console.log('📝 Transcript-saved sentence detected - no analysis data, showing generate button');
        currentAIAnalysis = null; // Clear to allow generation
        // Show search result with the report data
        showSearchResult(currentQueryData);
        // Show placeholder with generate button instead of empty result
        showAIPlaceholderWithButton();
      }
      
      // Switch to analysis view
      const analysisBtn = document.getElementById('showAnalysisBtn');
      if (analysisBtn) analysisBtn.click();
      
      console.log('Loaded saved report:', report.searchText, 'Has analysis:', hasActualAnalysis);
    } else {
      console.error('Report not found:', reportId);
      showAIError('找不到已保存的報告');
    }
  } catch (error) {
    console.error('Failed to load saved report:', error);
    showAIError('載入報告時發生錯誤');
  }
}

// Load saved reports view
async function loadSavedReports() {
  console.log('Loading saved reports...');
  
  const reportsList = document.getElementById('savedReportsList');
  const reportsEmpty = document.getElementById('savedReportsEmpty');
  const reportsStats = document.getElementById('savedReportsStats');
  
  if (!reportsList) {
    console.error('Saved reports list container not found');
    return;
  }
  
  try {
    let reports = [];
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      reports = await storageManager.getAIReports();
      console.log('Loaded reports from storage manager:', reports.length, 'reports');
      
      // Check if we need to re-analyze reports (detect reports with missing error analysis)
      const needsReAnalysis = reports.some(report => 
        report.analysisData && (report.hasErrors === undefined || report.hasErrors === null)
      );
      
      console.log('🔍 Checking if re-analysis needed:', needsReAnalysis);
      console.log('🔍 Reports without error analysis:', reports.filter(r => 
        r.analysisData && (r.hasErrors === undefined || r.hasErrors === null)
      ).map(r => ({ text: r.searchText, hasErrors: r.hasErrors })));
      
      if (needsReAnalysis && storageManager.reAnalyzeAllReports) {
        console.log('🔄 Re-analyzing existing reports with updated error detection...');
        const result = await storageManager.reAnalyzeAllReports();
        if (result.success && result.updatedCount > 0) {
          console.log(`✅ Updated ${result.updatedCount} reports`);
          // Reload reports after re-analysis
          reports = await storageManager.getAIReports();
        }
      }
      
      // Check if detection method migration is needed
      const needsDetectionMethodMigration = reports.some(report => 
        !report.detectionMethod && report.videoSource
      );
      
      console.log('🔍 Checking if detection method migration needed:', needsDetectionMethodMigration);
      console.log('🔍 Reports without detection method:', reports.filter(r => 
        !r.detectionMethod && r.videoSource
      ).length);
      
      if (needsDetectionMethodMigration && storageManager.migrateReportsDetectionMethod) {
        console.log('🔄 Migrating existing reports with detection methods...');
        const migrationResult = await storageManager.migrateReportsDetectionMethod();
        if (migrationResult.success && migrationResult.updatedCount > 0) {
          console.log(`✅ Migrated ${migrationResult.updatedCount} reports with detection methods`);
          // Reload reports after migration
          reports = await storageManager.getAIReports();
        }
      }
    } else {
      // Fallback: get reports directly from storage
      console.log('Using fallback storage method');
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      reports = result;
    }
    
    if (reports.length === 0) {
      if (reportsList) reportsList.style.display = 'none';
      if (reportsEmpty) reportsEmpty.style.display = 'block';
      if (reportsStats) reportsStats.innerHTML = '<p>📊 Total reports: 0</p>';
      return;
    }
    
    // Hide empty state
    if (reportsEmpty) reportsEmpty.style.display = 'none';
    if (reportsList) reportsList.style.display = 'block';
    
    // Update stats - clean version based on history tab format
    if (reportsStats) {
      // Count categories
      const itemsWithAnalysis = reports.filter(report => report.hasErrors !== null && report.hasErrors !== undefined);
      const correctItems = reports.filter(report => report.isCorrect === true);
      const errorItems = reports.filter(report => report.hasErrors === true);
      
      // Count language distribution
      const languageStats = {};
      reports.forEach(report => {
        const lang = report.language || 'unknown';
        languageStats[lang] = (languageStats[lang] || 0) + 1;
      });
      
      let statsText = `📊 總共 ${reports.length} 個分析報告`;
      if (itemsWithAnalysis.length > 0) {
        statsText += ` | ✅ 正確: ${correctItems.length} ❌ 錯誤: ${errorItems.length}`;
      }
      statsText += ` | 語言分布: ${Object.entries(languageStats).map(([lang, count]) => `${languageNames[lang] || lang}: ${count}`).join(', ')}`;
      
      if (window.SecurityFixes) {
        window.SecurityFixes.safeUpdateStats(reportsStats, statsText);
      } else {
        reportsStats.innerHTML = `<p>${statsText}</p>`;
      }
    }
    
    // Populate tag filter dropdown
    populateTagFilter(reports);
    
    // Initialize saved reports filters
    initializeSavedReportsFilters(reports);
    
    // Generate reports HTML with improved design and buttons
    if (reportsList) {
      // Debug: Check video source data in saved reports
      const reportsWithVideo = reports.filter(r => r.videoSource && (r.videoSource.url || r.videoSource.originalUrl || r.videoSource.articleUrl || r.videoSource.domain));
      const reportsWithTimestamp = reports.filter(r => r.videoSource && (r.videoSource.url || r.videoSource.originalUrl || r.videoSource.articleUrl) && r.videoSource.videoTimestamp);
      
      console.log(`📊 SAVED TAB - Reports Display Debug:`, {
        totalReports: reports.length,
        withVideo: reportsWithVideo.length,
        withTimestamp: reportsWithTimestamp.length,
        limitIncreased: 'MAX_REPORTS increased from 100 to 5000',
        showingAll: reports.length < 5000 ? 'Yes' : 'Might be limited',
        reportsWithVideoDetails: reportsWithVideo.map(r => ({
          text: r.searchText,
          hasUrl: !!r.videoSource.url,
          hasTimestamp: !!r.videoSource.videoTimestamp,
          timestamp: r.videoSource.videoTimestamp,
          url: r.videoSource.url?.substring(0, 50) + '...'
        }))
      });
      
      // Build notification HTML
      let notificationHtml = '';
      
      // Show in UI if no source data found
      if (reportsWithVideo.length === 0 && reports.length > 0) {
        console.warn(`⚠️ NO SOURCE DATA FOUND in ${reports.length} saved reports!`);
        console.log(`💡 To get "返回片段" buttons:
        1. Go to YouTube
        2. Click "📚 LEARN" button 
        3. Alt+Click on subtitle text (not video)
        4. Generate analysis with auto-save ON
        5. Check saved tab for red video buttons`);
        
        // Add visual notification in the UI
        notificationHtml = `
          <div style="margin: 10px 0; padding: 12px; background: linear-gradient(135deg, #fff3cd, #ffeaa7); border: 1px solid #ffc107; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 18px;">ℹ️</span>
              <strong style="color: #856404;">為什麼我看不到 "⏰ 返回片段" 按鈕？</strong>
            </div>
            <div style="font-size: 13px; color: #856404; line-height: 1.4;">
              您的 ${reports.length} 個已保存報告都沒有影片數據。<br>
              <strong>要獲得 "返回片段" 功能：</strong><br>
              1. 前往 YouTube 影片 → 2. 點擊 "📚 LEARN" → 3. Alt+點擊字幕文字 → 4. 生成分析
            </div>
          </div>
        `;
        
      }
      
      // Build the complete HTML with notification + reports
      const reportsHtml = reports.map(report => {
        const truncatedAnalysis = typeof report.analysisData === 'string' 
          ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
          : (report.analysisData && report.analysisData.content 
              ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
              : 'No analysis preview available');
        
        return `
          <div class="saved-report-item" data-report-id="${report.id}">
            <div class="saved-report-header">
              <div class="report-main-info">
                <span class="report-text">${report.searchText}</span>
                <div class="report-badges">
                  <span class="report-language">${languageNames[report.language] || (report.language || '').toUpperCase()}</span>
                  ${report.favorite ? '<span class="favorite-badge">⭐ 最愛</span>' : ''}
                  ${report.audioData || report.audioInIndexedDB ? `<span class="audio-badge" data-report-id="${report.id}" style="cursor: pointer;" title="點擊播放語音">🔊 語音</span>` : ''}
                  ${report.hasErrors ? 
                    `<span class="error-badge" title="檢測到錯誤：${report.errorTypes ? report.errorTypes.join(', ') : ''}">❌ 有錯誤</span>` : 
                    report.isCorrect === true ? '<span class="correct-badge" title="語法正確">✅ 正確</span>' : ''
                  }
                </div>
              </div>
              <div class="report-actions">
                <button class="report-action-btn create-flashcard-btn" data-id="${report.id}" title="建立記憶卡">
                  🃏
                </button>
                <button class="report-action-btn favorite-btn ${report.favorite ? 'active' : ''}" data-id="${report.id}" title="${report.favorite ? '取消最愛' : '加入最愛'}">
                  ${report.favorite ? '⭐' : '☆'}
                </button>
                <button class="report-action-btn edit-tags-btn" data-id="${report.id}" title="編輯標籤">
                  🏷️
                </button>
                <button class="report-action-btn delete-btn" data-id="${report.id}" title="刪除報告">
                  🗑️
                </button>
                ${report.videoSource ? getReportReturnButton(report) : `
                  <button class="report-action-btn video-return-btn-disabled" disabled title="此報告沒有來源數據 - 請從 YouTube 字幕或文章學習以獲得返回功能" style="background-color: #ccc; color: #666; cursor: not-allowed;">
                    🚫
                  </button>
                `}
              </div>
            </div>
            ${report.videoSource ? getReportVideoInfo(report) : ''}
            <div class="report-meta">
              <span class="report-date">📅 ${new Date(report.timestamp).toLocaleDateString('zh-TW')} ${new Date(report.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
              <div class="report-tags-container">
                <div class="report-tags-display">
                  ${report.tags && report.tags.length > 0 ? 
                    `🏷️ ${report.tags.map(tag => `<span class="tag-chip">#${tag}</span>`).join('')}` : 
                    '<span class="no-tags">無標籤</span>'}
                </div>
                <div class="report-tags-edit" style="display: none;">
                  <input type="text" class="tags-input" placeholder="輸入標籤，用逗號分隔..." value="${report.tags ? report.tags.join(', ') : ''}" />
                  <div class="tags-edit-actions">
                    <button class="save-tags-btn" data-id="${report.id}">儲存</button>
                    <button class="cancel-tags-btn" data-id="${report.id}">取消</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="report-preview">
              <div class="preview-text">${truncatedAnalysis}</div>
              <button class="preview-expand" data-expanded="false">展開</button>
            </div>
          </div>`;
      }).join('');
      
      // Assign the complete HTML to the reports list
      reportsList.innerHTML = notificationHtml + reportsHtml;
      
      // Add event listeners
      reportsList.querySelectorAll('.saved-report-item').forEach(item => {
        const reportId = item.dataset.reportId;
        
        // Main item click (view report)
        const mainArea = item.querySelector('.report-main-info');
        if (mainArea) {
          mainArea.addEventListener('click', () => {
            console.log('Viewing report:', reportId);
            viewSavedReport(reportId);
          });
          mainArea.style.cursor = 'pointer';
        }
        
        // Favorite button
        const favoriteBtn = item.querySelector('.favorite-btn');
        if (favoriteBtn) {
          favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              const newFavoriteState = await toggleFavoriteReport(reportId);
              favoriteBtn.classList.toggle('active', newFavoriteState);
              favoriteBtn.textContent = newFavoriteState ? '⭐' : '☆';
              favoriteBtn.title = newFavoriteState ? '取消最愛' : '加入最愛';
              
              // Update the favorite badge in the header
              const favoriteBadge = item.querySelector('.favorite-badge');
              const reportBadges = item.querySelector('.report-badges');
              if (newFavoriteState && !favoriteBadge) {
                if (window.SecurityFixes) {
                  const badge = window.SecurityFixes.safeCreateElement('span', '⭐ 最愛', 'favorite-badge');
                  reportBadges.appendChild(badge);
                } else {
                  reportBadges.insertAdjacentHTML('beforeend', '<span class="favorite-badge">⭐ 最愛</span>');
                }
              } else if (!newFavoriteState && favoriteBadge) {
                favoriteBadge.remove();
              }
              
              // Track analytics
              if (learningAnalytics) {
                const report = reports.find(r => r.id === reportId);
                if (report) {
                  learningAnalytics.recordVocabularyInteraction(
                    report.searchText,
                    report.language,
                    newFavoriteState ? 'favorite_added' : 'favorite_removed',
                    { from: 'saved_reports' }
                  );
                }
              }
            } catch (error) {
              console.error('Failed to toggle favorite:', error);
            }
          });
        }
        
        // Create flashcard button
        const createFlashcardBtn = item.querySelector('.create-flashcard-btn');
        if (createFlashcardBtn) {
          createFlashcardBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // Disable button during processing
            createFlashcardBtn.disabled = true;
            const originalText = createFlashcardBtn.textContent;
            createFlashcardBtn.textContent = '⏳';
            
            try {
              const report = reports.find(r => r.id === reportId);
              if (report) {
                // Add timeout to prevent freeze
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Flashcard creation timeout')), 10000);
                });
                
                await Promise.race([
                  createFlashcardFromReport(report),
                  timeoutPromise
                ]);
                
                showMessage(`已為「${report.searchText}」建立記憶卡！`, 'success');
                
                // Track analytics
                if (learningAnalytics) {
                  learningAnalytics.recordVocabularyInteraction(
                    report.searchText,
                    report.language,
                    'flashcard_creation',
                    { from: 'saved_reports' }
                  );
                }
              }
            } catch (error) {
              console.error('Failed to create flashcard from report:', error);
              const report = reports.find(r => r.id === reportId);
              if (error.message.includes('already exists')) {
                const searchText = report?.searchText || '此項目';
                showMessage(`記憶卡「${searchText}」已存在`, 'warning');
              } else if (error.message.includes('timeout')) {
                showMessage('操作超時，請重試', 'error');
              } else {
                showMessage('建立記憶卡失敗', 'error');
              }
            } finally {
              // Restore button state
              createFlashcardBtn.disabled = false;
              createFlashcardBtn.textContent = originalText;
            }
          });
        }
        
        // Delete button
        const deleteBtn = item.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reportText = item.querySelector('.report-text').textContent;
            if (confirm(`確定要刪除「${reportText}」的分析報告嗎？`)) {
              try {
                const success = await deleteSavedReport(reportId);
                if (success) {
                  // Track analytics before removing
                  if (learningAnalytics) {
                    const report = reports.find(r => r.id === reportId);
                    if (report) {
                      learningAnalytics.recordVocabularyInteraction(
                        report.searchText,
                        report.language,
                        'report_deleted',
                        { from: 'saved_reports' }
                      );
                    }
                  }
                  
                  item.remove();
                  // Update stats
                  const remaining = reportsList.children.length;
                  if (reportsStats) {
                    if (window.SecurityFixes) {
                      window.SecurityFixes.safeUpdateStats(reportsStats, `📊 總共 ${remaining} 份報告`);
                    } else {
                      reportsStats.innerHTML = `<p>📊 總共 ${remaining} 份報告</p>`;
                    }
                  }
                  if (remaining === 0) {
                    loadSavedReports(); // Reload to show empty state
                  }
                }
              } catch (error) {
                console.error('Failed to delete report:', error);
                alert('刪除失敗');
              }
            }
          });
        }
        
        // Edit tags button
        const editTagsBtn = item.querySelector('.edit-tags-btn');
        if (editTagsBtn) {
          editTagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTagEditing(reportId, item);
          });
        }
        
        // Video return buttons (both small and large)
        const videoReturnBtns = item.querySelectorAll('.video-return-btn, .video-return-btn-large');
        videoReturnBtns.forEach(btn => {
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const videoUrl = btn.dataset.videoUrl;
              if (videoUrl) {
                console.log('🎬 SAVED TAB - Opening video:', videoUrl);
                console.log('🔍 SAVED TAB - URL analysis:', {
                  isYouTube: videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'),
                  isYouGlish: videoUrl.includes('youglish.com'),
                  hasTimestamp: videoUrl.includes('&t=') || videoUrl.includes('?t='),
                  fullUrl: videoUrl
                });
                window.open(videoUrl, '_blank');
                
                // Track analytics
                if (learningAnalytics) {
                  const report = reports.find(r => r.id === reportId);
                  if (report) {
                    learningAnalytics.recordVocabularyInteraction(
                      report.searchText,
                      report.language,
                      'video_return',
                      { 
                        from: 'saved_reports',
                        hasTimestamp: !!formatVideoTimestamp(report.videoSource?.videoTimestamp),
                        videoUrl: videoUrl
                      }
                    );
                  }
                }
              }
            });
          }
        });
        
        // Save tags button
        const saveTagsBtn = item.querySelector('.save-tags-btn');
        if (saveTagsBtn) {
          saveTagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            saveReportTags(reportId, item);
          });
        }
        
        // Cancel tags button
        const cancelTagsBtn = item.querySelector('.cancel-tags-btn');
        if (cancelTagsBtn) {
          cancelTagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelTagEditing(reportId, item);
          });
        }
        
        // Preview expand button
        const expandBtn = item.querySelector('.preview-expand');
        if (expandBtn) {
          expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const previewText = item.querySelector('.preview-text');
            const report = reports.find(r => r.id === reportId);
            const isExpanded = expandBtn.dataset.expanded === 'true';
            
            if (!isExpanded) {
              const fullAnalysis = typeof report.analysisData === 'string' 
                ? report.analysisData 
                : (report.analysisData && report.analysisData.content 
                    ? report.analysisData.content 
                    : 'No analysis available');
              
              // 使用 formatAIAnalysis 來格式化完整分析內容 (小字體)
              const formattedAnalysis = formatAIAnalysis(fullAnalysis, 'saved-tab');
              if (window.SecurityFixes) {
                window.SecurityFixes.safeSetHTML(previewText, formattedAnalysis);
              } else {
                previewText.innerHTML = formattedAnalysis;
              }
              expandBtn.textContent = '收合';
              expandBtn.dataset.expanded = 'true';
            } else {
              const truncatedAnalysis = typeof report.analysisData === 'string' 
                ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
                : (report.analysisData && report.analysisData.content 
                    ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
                    : 'No analysis preview available');
              previewText.textContent = truncatedAnalysis;
              expandBtn.textContent = '展開';
              expandBtn.dataset.expanded = 'false';
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('Failed to load saved reports:', error);
    if (reportsEmpty) {
      reportsEmpty.style.display = 'block';
      reportsEmpty.innerHTML = '<p>❌ 無法載入已保存的報告</p>';
    }
  }
}

// Missing function for updating result display
function updateResultDisplay() {
  // Basic implementation to prevent errors
  console.log('updateResultDisplay called');
}

// Saved Reports Helper Functions
async function toggleFavoriteReport(reportId) {
  try {
    if (storageManager && typeof storageManager.toggleFavorite === 'function') {
      const newState = await storageManager.toggleFavorite(reportId);
      console.log('Toggled favorite for report:', reportId, 'New state:', newState);
      return newState;
    } else {
      // Fallback: direct storage manipulation
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      const reports = result;
      const report = reports.find(r => r.id === reportId);
      if (report) {
        report.favorite = !report.favorite;
        await new Promise((resolve) => {
          chrome.storage.local.set({ aiReports: reports }, resolve);
        });
        return report.favorite;
      }
      return false;
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    throw error;
  }
}

async function deleteSavedReport(reportId) {
  try {
    if (storageManager && typeof storageManager.deleteAIReport === 'function') {
      const success = await storageManager.deleteAIReport(reportId);
      console.log('Deleted report:', reportId, 'Success:', success);
      return success;
    } else {
      // Fallback: direct storage manipulation
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      const reports = result;
      const filteredReports = reports.filter(r => r.id !== reportId);
      await new Promise((resolve) => {
        chrome.storage.local.set({ aiReports: filteredReports }, resolve);
      });
      return true;
    }
  } catch (error) {
    console.error('Failed to delete report:', error);
    throw error;
  }
}

// Cleanup duplicate reports
async function cleanupDuplicateReports() {
  try {
    const cleanupBtn = document.getElementById('cleanupDuplicatesBtn');
    if (cleanupBtn) {
      cleanupBtn.disabled = true;
      cleanupBtn.textContent = '🔄 Cleaning...';
    }
    
    if (storageManager && typeof storageManager.cleanupDuplicateReports === 'function') {
      const result = await storageManager.cleanupDuplicateReports();
      
      if (result.removed > 0) {
        alert(`✅ Cleanup complete!\nRemoved ${result.removed} duplicate reports.\nRemaining: ${result.remaining} unique reports.`);
        // Reload the saved reports view to reflect changes
        loadSavedReports();
      } else {
        alert('✅ No duplicates found! All reports are unique.');
      }
    } else {
      throw new Error('Storage manager not available');
    }
  } catch (error) {
    console.error('Failed to cleanup duplicates:', error);
    alert(`❌ Cleanup failed: ${error.message}`);
  } finally {
    const cleanupBtn = document.getElementById('cleanupDuplicatesBtn');
    if (cleanupBtn) {
      cleanupBtn.disabled = false;
      cleanupBtn.textContent = '🗂️ Clean Duplicates';
    }
  }
}

// Populate tag filter dropdown with available tags
function populateTagFilter(reports) {
  const tagFilter = document.getElementById('savedReportsTagFilter');
  if (!tagFilter) return;
  
  // Get all unique tags from all reports
  const allTags = new Set();
  reports.forEach(report => {
    if (report.tags && Array.isArray(report.tags)) {
      report.tags.forEach(tag => {
        if (tag && tag.trim()) {
          allTags.add(tag.trim());
        }
      });
    }
  });
  
  // Sort tags alphabetically
  const sortedTags = Array.from(allTags).sort();
  
  // Save current selection
  const currentSelection = tagFilter.value;
  
  // Clear existing options except the "All Tags" option
  const allTagsOption = tagFilter.querySelector('option[value=""]');
  tagFilter.innerHTML = '';
  if (allTagsOption) {
    tagFilter.appendChild(allTagsOption);
  } else {
    // Create "All Tags" option if it doesn't exist
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Tags';
    allOption.setAttribute('data-i18n', 'all_tags');
    tagFilter.appendChild(allOption);
  }
  
  // Add tag options
  sortedTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = `#${tag}`;
    tagFilter.appendChild(option);
  });
  
  // Restore previous selection if it still exists
  if (currentSelection && sortedTags.includes(currentSelection)) {
    tagFilter.value = currentSelection;
  }
  
  console.log(`Populated tag filter with ${sortedTags.length} tags:`, sortedTags);
}

// Tag editing functions
function toggleTagEditing(reportId, reportItem) {
  const tagsDisplay = reportItem.querySelector('.report-tags-display');
  const tagsEdit = reportItem.querySelector('.report-tags-edit');
  
  if (tagsDisplay && tagsEdit) {
    const isEditing = tagsEdit.style.display !== 'none';
    
    if (isEditing) {
      // Cancel editing
      tagsDisplay.style.display = 'block';
      tagsEdit.style.display = 'none';
    } else {
      // Start editing
      tagsDisplay.style.display = 'none';
      tagsEdit.style.display = 'block';
      
      // Focus on the input and add keyboard shortcuts
      const tagsInput = tagsEdit.querySelector('.tags-input');
      if (tagsInput) {
        tagsInput.focus();
        tagsInput.select();
        
        // Add keyboard event listener
        tagsInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveReportTags(reportId, reportItem);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelTagEditing(reportId, reportItem);
          }
        });
      }
    }
  }
}

function cancelTagEditing(reportId, reportItem) {
  const tagsDisplay = reportItem.querySelector('.report-tags-display');
  const tagsEdit = reportItem.querySelector('.report-tags-edit');
  
  if (tagsDisplay && tagsEdit) {
    tagsDisplay.style.display = 'block';
    tagsEdit.style.display = 'none';
  }
}

async function saveReportTags(reportId, reportItem) {
  const tagsInput = reportItem.querySelector('.tags-input');
  if (!tagsInput) return;
  
  const tagText = tagsInput.value.trim();
  const newTags = tagText ? tagText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
  
  try {
    // Update the report with new tags
    let success = false;
    
    // Use direct storage approach for updating tags to avoid complications
    {
      // Direct storage manipulation for tag updates
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      const reports = result;
      const reportIndex = reports.findIndex(r => r.id === reportId);
      
      if (reportIndex !== -1) {
        reports[reportIndex].tags = newTags;
        
        await new Promise((resolve) => {
          chrome.storage.local.set({ aiReports: reports }, resolve);
        });
        
        success = true;
      }
    }
    
    if (success) {
      // Update the display
      const tagsDisplay = reportItem.querySelector('.report-tags-display');
      if (tagsDisplay) {
        if (newTags.length > 0) {
          tagsDisplay.innerHTML = `🏷️ ${newTags.map(tag => `<span class="tag-chip">#${tag}</span>`).join('')}`;
        } else {
          tagsDisplay.innerHTML = '<span class="no-tags">無標籤</span>';
        }
      }
      
      // Hide edit interface
      cancelTagEditing(reportId, reportItem);
      
      // Refresh tag filter dropdown
      setTimeout(() => {
        loadSavedReports(); // This will repopulate the tag filter
      }, 100);
      
      console.log('Tags updated for report:', reportId, newTags);
    } else {
      throw new Error('Failed to update report');
    }
    
  } catch (error) {
    console.error('Error saving tags:', error);
    alert('儲存標籤失敗: ' + error.message);
  }
}

// Auto-save functionality
let autoSaveEnabled = true; // Default to enabled

async function loadAutoSaveSetting() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['autoSaveReports'], resolve);
    });
    
    autoSaveEnabled = result.autoSaveReports !== false; // Default to true if not set
    updateAutoSaveButtonUI();
  } catch (error) {
    console.error('Failed to load auto-save setting:', error);
    autoSaveEnabled = true; // Default to enabled
    updateAutoSaveButtonUI();
  }
}

async function toggleAutoSave() {
  try {
    autoSaveEnabled = !autoSaveEnabled;
    
    // Save to storage
    await new Promise((resolve) => {
      chrome.storage.sync.set({ autoSaveReports: autoSaveEnabled }, resolve);
    });
    
    updateAutoSaveButtonUI();
    console.log('Auto-save toggled:', autoSaveEnabled ? 'ON' : 'OFF');
    
  } catch (error) {
    console.error('Failed to toggle auto-save:', error);
    // Revert on error
    autoSaveEnabled = !autoSaveEnabled;
    updateAutoSaveButtonUI();
  }
}

function updateAutoSaveButtonUI() {
  const autoSaveBtn = document.getElementById('autoSaveToggleBtn');
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  
  if (!autoSaveBtn) return;
  
  if (autoSaveEnabled) {
    autoSaveBtn.classList.add('active');
    autoSaveBtn.classList.remove('inactive');
    
    // Update text using i18n
    if (typeof window.getI18nMessage !== 'undefined') {
      autoSaveBtn.textContent = window.getI18nMessage('auto_save_on');
      autoSaveBtn.title = window.getI18nMessage('auto_save_toggle_tooltip');
    } else {
      autoSaveBtn.textContent = '💾 Auto-Save';
      autoSaveBtn.title = 'Click to toggle auto-save';
    }
    
    // Hide manual save button when auto-save is enabled
    if (manualSaveBtn) {
      manualSaveBtn.style.display = 'none';
    }
  } else {
    autoSaveBtn.classList.remove('active');
    autoSaveBtn.classList.add('inactive');
    
    // Update text using i18n
    if (typeof window.getI18nMessage !== 'undefined') {
      autoSaveBtn.textContent = window.getI18nMessage('auto_save_off');
      autoSaveBtn.title = window.getI18nMessage('auto_save_toggle_tooltip');
    } else {
      autoSaveBtn.textContent = '💾 Manual';
      autoSaveBtn.title = 'Click to toggle auto-save';
    }
    
    // Show manual save button when auto-save is disabled AND analysis exists
    if (manualSaveBtn) {
      const hasAnalysis = currentAIAnalysis && currentQueryData.text && currentQueryData.language;
      manualSaveBtn.style.display = hasAnalysis ? 'inline-block' : 'none';
      
      // Update manual save button text
      if (typeof window.getI18nMessage !== 'undefined') {
        manualSaveBtn.textContent = window.getI18nMessage('save_this_report');
      } else {
        manualSaveBtn.textContent = '💾 Save This Report';
      }
    }
    
    // Show A2 test usage button when analysis exists
    const a2TestUsageBtn = document.getElementById('a2TestUsageBtn');
    if (a2TestUsageBtn) {
      const hasAnalysis = currentAIAnalysis && currentQueryData.text && currentQueryData.language;
      a2TestUsageBtn.style.display = hasAnalysis ? 'inline-block' : 'none';
    }
  }
}

// 錯誤檢測狀態變數
let errorDetectionEnabled = false;

// 載入錯誤檢測設定
async function loadErrorDetectionSetting() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['errorDetection'], (data) => {
        resolve(data.errorDetection === true);
      });
    });
    
    errorDetectionEnabled = result;
    updateErrorDetectionButtonUI();
  } catch (error) {
    console.error('Failed to load error detection setting:', error);
    errorDetectionEnabled = false; // Default to disabled
    updateErrorDetectionButtonUI();
  }
}

// 切換錯誤檢測功能
async function toggleErrorDetection() {
  try {
    errorDetectionEnabled = !errorDetectionEnabled;
    
    // Save to storage
    await new Promise((resolve) => {
      chrome.storage.sync.set({ errorDetection: errorDetectionEnabled }, resolve);
    });
    
    updateErrorDetectionButtonUI();
    console.log('Error detection toggled:', errorDetectionEnabled ? 'ON' : 'OFF');
    
    // Reinitialize AI service to pick up the new setting
    if (window.aiService) {
      await window.aiService.initialize();
    }
    
  } catch (error) {
    console.error('Failed to toggle error detection:', error);
    // Revert on error
    errorDetectionEnabled = !errorDetectionEnabled;
    updateErrorDetectionButtonUI();
  }
}

// 更新錯誤檢測按鈕 UI
function updateErrorDetectionButtonUI() {
  const errorDetectionBtn = document.getElementById('errorDetectionToggleBtn');
  
  if (!errorDetectionBtn) return;
  
  if (errorDetectionEnabled) {
    errorDetectionBtn.classList.add('active');
    errorDetectionBtn.classList.remove('inactive');
    errorDetectionBtn.textContent = '🔍 錯誤檢測 ✓';
    errorDetectionBtn.title = '錯誤檢測已啟用（會增加分析時間）- 點擊關閉';
  } else {
    errorDetectionBtn.classList.remove('active');
    errorDetectionBtn.classList.add('inactive');
    errorDetectionBtn.textContent = '🔍 錯誤檢測';
    errorDetectionBtn.title = '啟用錯誤檢測功能（會增加分析時間）- 點擊啟用';
  }
}

// Toggle between default and custom prompts
async function togglePromptType() {
  try {
    // Get current setting
    const result = await chrome.storage.sync.get(['useCustomPrompt']);
    const currentIsCustom = result.useCustomPrompt === 'true';
    const newIsCustom = !currentIsCustom;
    
    // Save new setting
    await chrome.storage.sync.set({ useCustomPrompt: newIsCustom.toString() });
    
    // Update UI
    updatePromptTypeIndicator();
    
    // Reinitialize AI service to pick up the new setting
    if (window.aiService) {
      await window.aiService.initialize();
    }
    
    // Show feedback
    const message = newIsCustom ? 'Switched to Custom prompt' : 'Switched to Default prompt';
    console.log('🔄 Prompt type toggled:', message);
    
    // Visual feedback on the toggle button
    const toggleBtn = document.getElementById('promptToggleBtn');
    if (toggleBtn) {
      const originalText = toggleBtn.textContent;
      toggleBtn.textContent = '✓ Done';
      toggleBtn.style.background = '#4caf50';
      toggleBtn.style.color = 'white';
      
      setTimeout(() => {
        toggleBtn.textContent = originalText;
        toggleBtn.style.background = '#f1f3f4';
        toggleBtn.style.color = '#5f6368';
      }, 1000);
    }
    
  } catch (error) {
    console.error('Failed to toggle prompt type:', error);
    
    // Visual error feedback on the toggle button
    const toggleBtn = document.getElementById('promptToggleBtn');
    if (toggleBtn) {
      const originalText = toggleBtn.textContent;
      toggleBtn.textContent = '✗ Error';
      toggleBtn.style.background = '#f44336';
      toggleBtn.style.color = 'white';
      
      setTimeout(() => {
        toggleBtn.textContent = originalText;
        toggleBtn.style.background = '#f1f3f4';
        toggleBtn.style.color = '#5f6368';
      }, 1500);
    }
  }
}

// Show auto-save success feedback
function showAutoSaveSuccess() {
  const autoSaveBtn = document.getElementById('autoSaveToggleBtn');
  if (autoSaveBtn && autoSaveEnabled) {
    const originalText = autoSaveBtn.textContent;
    const originalBackground = autoSaveBtn.style.background;
    
    // Show success feedback
    autoSaveBtn.textContent = '✅ Saved';
    autoSaveBtn.style.background = '#4CAF50';
    autoSaveBtn.style.color = 'white';
    
    // Revert after 2 seconds
    setTimeout(() => {
      autoSaveBtn.textContent = originalText;
      autoSaveBtn.style.background = originalBackground;
      autoSaveBtn.style.color = '';
    }, 2000);
  }
}

// Manual save function for when auto-save is disabled
async function manualSaveReport() {
  if (!currentAIAnalysis || !currentQueryData.text || !currentQueryData.language) {
    alert('沒有可保存的分析報告');
    return;
  }
  
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  
  try {
    if (manualSaveBtn) {
      manualSaveBtn.disabled = true;
      manualSaveBtn.textContent = '💾 保存中...';
    }
    
    if (storageManager && typeof storageManager.saveAIReport === 'function') {
      // Get cached audio data if available
      const cachedAudio = getCachedAudio(currentQueryData.text, currentQueryData.language);
      const audioData = cachedAudio ? {
        audioUrl: cachedAudio.audioUrl,
        size: cachedAudio.size,
        voice: cachedAudio.voice || 'OpenAI TTS'
      } : null;
      
      // Get video source data for manual save - check currentQueryData first, then YouTube analysis
      let videoSource = null;
      
      // First check if currentQueryData has videoSource (for articles)
      if (currentQueryData && currentQueryData.videoSource) {
        videoSource = currentQueryData.videoSource;
        console.log('📰 Using article video source for manual save:', videoSource);
      } else {
        // Check for both YouTube and Netflix analysis for video sources
        try {
          const result = await chrome.storage.local.get(['youtubeAnalysis', 'netflixAnalysis']);
          
          // First check Netflix analysis
          if (result.netflixAnalysis) {
            const netflixData = result.netflixAnalysis;
            // Check if this is recent data and matches current text
            if (Date.now() - netflixData.timestamp < 2 * 60 * 1000 && netflixData.text === currentQueryData.text) {
              const netflixUrl = netflixData.originalUrl || netflixData.url; // Prefer original Netflix URL
              videoSource = {
                url: netflixUrl, // Use Netflix URL (with timestamp)
                originalUrl: netflixUrl,
                title: netflixData.title,
                channel: netflixData.title || 'Netflix',
                videoTimestamp: netflixData.videoTimestamp,
                timestamp: Date.now(),
                learnedAt: new Date().toISOString(),
                platform: 'netflix'
              };
              console.log('🎬 Found Netflix source data for manual save:', videoSource);
            }
          }
          
          // If no Netflix data, fallback to YouTube analysis
          if (!videoSource && result.youtubeAnalysis) {
            const ytData = result.youtubeAnalysis;
            // Check if this is recent data and matches current text
            if (Date.now() - ytData.timestamp < 2 * 60 * 1000 && ytData.text === currentQueryData.text) {
              const youtubeUrl = ytData.youtubeUrl || ytData.originalUrl; // Prefer explicit youtubeUrl
              videoSource = {
                url: youtubeUrl, // Use YouTube URL (with timestamp)
                originalUrl: youtubeUrl,
                title: ytData.title,
                channel: ytData.title ? ytData.title.split(' - ')[0] : '未知頻道',
                videoTimestamp: ytData.videoTimestamp, // Use correct field for video playback time
                timestamp: Date.now(),
                learnedAt: new Date().toISOString(),
                platform: 'youtube'
              };
              console.log('🎬 Found YouTube source data for manual save:', videoSource);
              console.log('🔗 Manual save - YouTube URL vs YouGlish URL:', {
                youtubeUrl: youtubeUrl,
                youglishUrl: ytData.url,
                usingUrl: videoSource.url,
                availableFields: Object.keys(ytData)
              });
            }
          }
        } catch (error) {
          console.log('⚠️ Could not get video source data for manual save:', error);
        }
      }
      
      await storageManager.saveAIReport(
        currentQueryData.text,
        currentQueryData.language,
        currentAIAnalysis,
        audioData, // Include cached audio data
        videoSource, // Include video source data
        true, // updateExisting
        currentQueryData.detectionMethod || 'auto' // Include detection method
      );
      
      if (audioData) {
        console.log('🎯 AI report saved with cached audio:', Math.round(audioData.size / 1024), 'KB');
      } else {
        console.log('AI analysis report saved manually (no audio)');
      }
      console.log('AI analysis report saved manually');
      
      // Show success feedback
      if (manualSaveBtn) {
        manualSaveBtn.textContent = '✅ 已保存';
        manualSaveBtn.style.background = '#4CAF50';
        
        // Revert button after 2 seconds
        setTimeout(() => {
          manualSaveBtn.disabled = false;
          manualSaveBtn.style.background = '';
          updateAutoSaveButtonUI(); // This will set the correct text
        }, 2000);
      }
      
      // Show success message
      alert('✅ 報告已保存到「💾 已保存」標籤頁');
      
    } else {
      throw new Error('Storage manager not available');
    }
    
  } catch (error) {
    console.error('Failed to save report manually:', error);
    alert('❌ 保存失敗: ' + error.message);
    
    // Restore button state
    if (manualSaveBtn) {
      manualSaveBtn.disabled = false;
      updateAutoSaveButtonUI();
    }
  }
}

// Audio pronunciation functions - 簡化版本
async function generateAudioPronunciation(forceRefresh = false) {
  if (!currentQueryData.text || !currentQueryData.language) {
    showAudioError('沒有可生成語音的文本');
    return;
  }
  
  console.log('🎵 Audio generation requested for:', currentQueryData.text);
  showAudioLoading();
  
  try {
    // Simple checks
    if (!aiService) {
      throw new Error('AI 服務未載入');
    }
    
    // Initialize if needed
    if (!aiService.isInitialized) {
      console.log('🔧 Initializing AI service...');
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new Error('請先在選項頁面配置 OpenAI API 金鑰');
      }
    }
    
    // Simple availability check - specifically for OpenAI TTS
    if (!aiService.isAudioAvailable()) {
      const provider = aiService.settings?.provider;
      if (provider !== 'openai') {
        throw new Error(`語音功能需要 OpenAI API - 當前設定: ${provider || '未設定'}。請到選項頁面選擇 OpenAI 作為提供商`);
      } else {
        throw new Error('OpenAI API 未正確配置 - 請檢查 API 金鑰設定');
      }
    }
    
    console.log('✅ Using OpenAI TTS for audio generation');
    
    console.log('🚀 Starting audio generation...');
    const startTime = Date.now();
    
    // Direct call without Promise.race complexity
    const audioData = await aiService.generateAudio(currentQueryData.text, currentQueryData.language);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Audio completed in ${duration}ms`);
    
    showAudioResult(audioData);
    
  } catch (error) {
    console.error('❌ Audio generation error:', error);
    
    // User-friendly error messages
    let errorMessage = error.message;
    if (errorMessage.includes('401')) {
      errorMessage = '無效的 API 金鑰 - 請檢查設定';
    } else if (errorMessage.includes('429')) {
      errorMessage = 'API 使用次數超限 - 請稍後再試';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('超時')) {
      errorMessage = '生成超時 - 請檢查網路或重試';
    } else if (errorMessage.includes('AbortError')) {
      errorMessage = '請求被取消 - 請重新嘗試';
    }
    
    showAudioError(errorMessage);
  }
}

function playAudio() {
  console.log('🔊 playAudio() called');
  const audioElement = document.getElementById('pronunciationAudio');
  
  console.log('Audio element found:', !!audioElement);
  console.log('Audio element src:', audioElement?.src);
  console.log('Audio element readyState:', audioElement?.readyState);
  
  if (audioElement && audioElement.src) {
    console.log('▶️ Starting audio playback...');
    audioElement.play().then(() => {
      console.log('✅ Audio playback started successfully');
    }).catch(err => {
      console.error('❌ Audio playback failed:', err);
      showAudioError(`音頻播放失敗: ${err.message}`);
    });
  } else {
    console.log('❌ No audio available - element:', !!audioElement, 'src:', audioElement?.src);
    
    if (!audioElement) {
      showAudioError('找不到音頻元素 - 請重新整理頁面');
    } else if (!audioElement.src) {
      showAudioError('音頻未載入 - 請重新生成語音');
    } else {
      showAudioError('沒有可播放的音頻');
    }
  }
}

function downloadAudio() {
  const audioElement = document.getElementById('pronunciationAudio');
  if (audioElement && audioElement.src) {
    const link = document.createElement('a');
    link.href = audioElement.src;
    link.download = `${currentQueryData.text || 'pronunciation'}_audio.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    console.log('No audio available to download');
    showAudioError('沒有可下載的音頻');
  }
}

// Audio UI functions
function showAudioLoading() {
  const audioContent = document.getElementById('audioContent');
  console.log('showAudioLoading called, audioContent element:', !!audioContent);
  if (audioContent) {
    audioContent.innerHTML = `
      <div class="audio-loading">
        🎵 正在生成語音...
        <br><small style="color: #666; margin-top: 8px; display: block;">預期 5-10 秒完成，如果超過 15 秒可能有問題</small>
      </div>`;
    console.log('Audio loading UI updated');
  } else {
    console.error('audioContent element not found!');
  }
}

function showAudioResult(audioData) {
  console.log('🔊 Displaying audio result:', audioData);
  
  const audioContent = document.getElementById('audioContent');
  
  if (audioContent && audioData && audioData.audioUrl) {
    // Create a new audio element directly in the content (simpler approach)
    audioContent.innerHTML = `
      <div class="audio-ready">
        ✅ 語音已生成 (${Math.round(audioData.size / 1024)} KB) - OpenAI TTS
        <br>
        <audio id="generatedAudio" controls preload="metadata" style="width: 100%; margin: 8px 0;">
          <source src="${audioData.audioUrl}" type="audio/mpeg">
          您的瀏覽器不支援音頻播放
        </audio>
        <br>
        <button id="playAudioDirectBtn" style="margin-top: 4px; padding: 4px 8px; background: #1976d2; color: white; border: none; border-radius: 3px; cursor: pointer;">
          ▶️ 播放
        </button>
        <button id="downloadAudioDirectBtn" style="margin: 4px 0 0 8px; padding: 4px 8px; background: #666; color: white; border: none; border-radius: 3px; cursor: pointer;">
          📥 下載
        </button>
      </div>`;
    
    // Add event listeners for direct control
    const playBtn = document.getElementById('playAudioDirectBtn');
    const downloadBtn = document.getElementById('downloadAudioDirectBtn');
    const audioElement = document.getElementById('generatedAudio');
    
    if (playBtn && audioElement) {
      playBtn.addEventListener('click', () => {
        console.log('🎯 Playing audio directly...');
        audioElement.play().then(() => {
          console.log('✅ Audio playing successfully');
        }).catch(err => {
          console.error('❌ Direct audio play failed:', err);
          showAudioError(`播放失敗: ${err.message}`);
        });
      });
    }
    
    if (downloadBtn && audioData.audioUrl) {
      downloadBtn.addEventListener('click', () => {
        console.log('📥 Downloading audio...');
        const link = document.createElement('a');
        link.href = audioData.audioUrl;
        link.download = `${currentQueryData.text || 'pronunciation'}_audio.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
    
    // Show regenerate button
    const regenerateBtn = document.getElementById('regenerateAudioBtn');
    if (regenerateBtn) regenerateBtn.style.display = 'inline-block';
    
    log('✅ Audio UI created with direct controls');
    
  } else {
    if (!audioContent) {
      log('❌ audioContent element not found');
      return;
    }
    if (!audioData || !audioData.audioUrl) {
      log('❌ Invalid audio data:', audioData);
      if (window.SecurityFixes) {
        window.SecurityFixes.safeUpdateAudioContent(audioContent, '無效的音頻數據', true);
      } else {
        audioContent.innerHTML = '<div class="audio-error">❌ 無效的音頻數據</div>';
      }
    }
  }
}

function showAudioError(message) {
  const audioContent = document.getElementById('audioContent');
  if (audioContent) {
    if (window.SecurityFixes) {
      window.SecurityFixes.safeUpdateAudioContent(audioContent, message, true);
    } else {
      audioContent.innerHTML = `<div class="audio-error">❌ ${message}</div>`;
    }
  }
}

// Play audio from saved report
async function playReportAudio(reportId) {
  try {
    const reports = await storageManager.getAIReports();
    let report = reports.find(r => r.id === reportId);
    
    if (!report) {
      showMessage('找不到報告', 'error');
      return;
    }
    
    // Get audio from IndexedDB if needed
    if (report.audioInIndexedDB && !report.audioData) {
      report = await storageManager.getReportWithAudio(report);
    }
    
    if (!report || !report.audioData || (typeof report.audioData === 'object' && !report.audioData.audioUrl)) {
      showMessage('此報告沒有語音數據', 'warning');
      return;
    }
    
    console.log('🔊 Playing audio from saved report:', report.searchText);
    
    // Handle different audio data structures
    const audioUrl = typeof report.audioData === 'string' ? report.audioData : report.audioData.audioUrl;
    const audio = new Audio(audioUrl);
    
    // Show feedback
    const audioBadge = document.querySelector(`span[data-report-id="${reportId}"]`);
    if (audioBadge) {
      const originalText = audioBadge.textContent;
      audioBadge.textContent = '🔊 播放中...';
      
      audio.onended = () => {
        audioBadge.textContent = originalText;
      };
      
      audio.onerror = () => {
        audioBadge.textContent = originalText;
        showMessage('語音播放失敗', 'error');
      };
    }
    
    await audio.play();
    console.log('✅ Report audio playing:', report.searchText);
    
  } catch (error) {
    console.error('Failed to play report audio:', error);
    showMessage('播放語音失敗', 'error');
  }
}

// Play audio from history (cached audio)
async function playHistoryAudio(text, language, buttonElement) {
  try {
    // Check if we have cached audio first
    const cachedAudio = getCachedAudio(text, language);
    
    if (cachedAudio && cachedAudio.audioUrl) {
      console.log('🔊 Playing cached audio from history:', text);
      
      // Show feedback on button
      const originalText = buttonElement.textContent;
      buttonElement.textContent = '播放中...';
      buttonElement.disabled = true;
      
      const audio = new Audio(cachedAudio.blobUrl || cachedAudio.audioUrl);
      
      audio.onended = () => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
      };
      
      audio.onerror = () => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
        showMessage('語音播放失敗', 'error');
      };
      
      await audio.play();
      console.log('✅ History audio playing:', text);
      
    } else {
      // Try to check saved reports for audio
      if (storageManager) {
        const reports = await storageManager.getAIReports({
          language: language,
          searchText: text
        });
        
        const exactMatch = reports.find(report => 
          report.searchText.toLowerCase() === text.toLowerCase() && 
          report.language === language &&
          report.audioData && report.audioData.audioUrl
        );
        
        if (exactMatch) {
          console.log('🔊 Playing audio from saved report for history:', text);
          
          // Show feedback on button
          const originalText = buttonElement.textContent;
          buttonElement.textContent = '播放中...';
          buttonElement.disabled = true;
          
          const audio = new Audio(exactMatch.audioData.audioUrl);
          
          audio.onended = () => {
            buttonElement.textContent = originalText;
            buttonElement.disabled = false;
          };
          
          audio.onerror = () => {
            buttonElement.textContent = originalText;
            buttonElement.disabled = false;
            showMessage('語音播放失敗', 'error');
          };
          
          await audio.play();
          console.log('✅ History audio from saved report playing:', text);
          
          // Also cache this audio for future use
          const cacheKey = `${text.toLowerCase()}_${language}`;
          const cachedAudioData = {
            text: text,
            language: language,
            audioUrl: exactMatch.audioData.audioUrl,
            blobUrl: exactMatch.audioData.audioUrl,
            size: exactMatch.audioData.size || 0,
            voice: exactMatch.audioData.voice || 'OpenAI TTS',
            timestamp: Date.now()
          };
          window.audioCache.set(cacheKey, cachedAudioData);
          
        } else {
          // No audio available - try to generate it
          console.log('⚠️ No cached or saved audio found, generating new audio:', text);
          await generateOpenAIAudio(text, language, true);
        }
      } else {
        showMessage('此歷史項目沒有語音數據', 'warning');
      }
    }
    
  } catch (error) {
    console.error('Failed to play history audio:', error);
    showMessage('播放語音失敗', 'error');
    
    // Reset button state
    if (buttonElement) {
      buttonElement.textContent = '🔊';
      buttonElement.disabled = false;
    }
  }
}

// Export functions (basic implementations)
async function exportToMarkdown(reports) {
  console.log('Exporting to markdown:', reports);
  return 'Markdown export not fully implemented';
}

async function exportToHeptaBase(reports) {
  console.log('Exporting to HeptaBase:', reports);
  return 'HeptaBase export not fully implemented';  
}

// Initialize TTS voices
function initializeTTSVoices() {
  if ('speechSynthesis' in window) {
    // Load voices - some browsers need this to be called to populate voices
    speechSynthesis.getVoices();
    
    // Handle voice loading event
    speechSynthesis.addEventListener('voiceschanged', () => {
      const voices = speechSynthesis.getVoices();
      console.log('TTS voices loaded:', voices.length, 'voices available');
      
      // Log available voices for debugging
      voices.forEach((voice, index) => {
        if (voice.lang.startsWith('en') || voice.lang.startsWith('ja') || voice.lang.startsWith('ko') || voice.lang.startsWith('zh') || voice.lang.startsWith('nl')) {
          console.log(`Voice ${index}: ${voice.name} (${voice.lang}) - Local: ${voice.localService}`);
        }
      });
    });
  }

}

// Initialize error status filter functionality
function initializeHistoryFilters() {
  console.log('🔧 Initializing history filters');
  const filterButtons = document.querySelectorAll('.filter-btn');
  let currentHistoryData = [];
  
  // Store reference to history data when it's loaded - make this global first
  window.setCurrentHistoryData = (data) => {
    console.log('📊 Setting current history data:', data?.length || 0, 'items');
    currentHistoryData = data || [];
  };
  
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log('🔘 Filter clicked:', button.getAttribute('data-filter'));
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');
      
      const filterType = button.getAttribute('data-filter');
      applyHistoryFilter(filterType, currentHistoryData);
    });
  });
}

// Apply filter to history items
function applyHistoryFilter(filterType, historyData) {
  console.log('🎯 Applying filter:', filterType, 'to', historyData?.length || 0, 'items');
  
  if (!historyData || historyData.length === 0) {
    console.log('⚠️ No history data to filter');
    return;
  }
  
  let filteredData = [];
  
  try {
    switch (filterType) {
      case 'all':
        filteredData = historyData;
        break;
      case 'correct':
        filteredData = historyData.filter(item => item.isCorrect === true);
        break;
      case 'error':
        filteredData = historyData.filter(item => item.hasErrors === true);
        break;
      case 'unanalyzed':
        filteredData = historyData.filter(item => item.hasErrors === null);
        break;
      case 'youtube':
        filteredData = historyData.filter(item => 
          (item.videoSource && item.videoSource.url && item.videoSource.url.includes('youtube.com')) ||
          (item.url && item.url.includes('youtube.com'))
        );
        break;
      default:
        filteredData = historyData;
    }
    
    console.log('✅ Filter applied, showing', filteredData.length, 'items');
    displayHistoryItems(filteredData);
  } catch (error) {
    console.error('❌ Error applying filter:', error);
    // Fallback to showing all data
    displayHistoryItems(historyData);
  }
}

// Initialize saved reports filter functionality
function initializeSavedReportsFilters(reports) {
  const filterButtons = document.querySelectorAll('[id^="reportsFilter"]');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');
      
      const filterType = button.getAttribute('data-filter');
      applySavedReportsFilter(filterType, reports);
    });
  });
}

// Apply filter to saved reports
function applySavedReportsFilter(filterType, reports) {
  if (!reports || reports.length === 0) {
    return;
  }
  
  let filteredReports = [];
  
  switch (filterType) {
    case 'all':
      filteredReports = reports;
      break;
    case 'correct':
      filteredReports = reports.filter(report => report.isCorrect === true);
      break;
    case 'error':
      filteredReports = reports.filter(report => report.hasErrors === true);
      break;
    case 'unanalyzed':
      filteredReports = reports.filter(report => report.hasErrors === null);
      break;
    case 'youtube':
      filteredReports = reports.filter(report => 
        (report.videoSource && report.videoSource.url && report.videoSource.url.includes('youtube.com')) ||
        (report.originalUrl && report.originalUrl.includes('youtube.com'))
      );
      break;
    default:
      filteredReports = reports;
  }
  
  // Re-render the reports list with filtered data
  displayFilteredSavedReports(filteredReports);
}

// Display filtered saved reports
function displayFilteredSavedReports(reports) {
  const reportsList = document.getElementById('savedReportsList');
  if (!reportsList) return;
  
  if (reports.length === 0) {
    reportsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">沒有符合篩選條件的報告</div>';
    return;
  }
  
  // Generate reports HTML (same as in loadSavedReports)
  reportsList.innerHTML = reports.map(report => {
    const truncatedAnalysis = typeof report.analysisData === 'string' 
      ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
      : (report.analysisData && report.analysisData.content 
          ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
          : 'No analysis preview available');
    
    return `
      <div class="saved-report-item" data-report-id="${report.id}">
        <div class="saved-report-header">
          <div class="report-main-info">
            <span class="report-text">${report.searchText}</span>
            <div class="report-badges">
              <span class="report-language">${languageNames[report.language] || (report.language || '').toUpperCase()}</span>
              ${report.favorite ? '<span class="favorite-badge">⭐ 最愛</span>' : ''}
              ${report.audioData || report.audioInIndexedDB ? `<span class="audio-badge" data-report-id="${report.id}" style="cursor: pointer;" title="點擊播放語音">🔊 語音</span>` : ''}
              ${report.hasErrors ? 
                `<span class="error-badge" title="檢測到錯誤：${report.errorTypes ? report.errorTypes.join(', ') : ''}">❌ 有錯誤</span>` : 
                report.isCorrect === true ? '<span class="correct-badge" title="語法正確">✅ 正確</span>' : ''
              }
            </div>
          </div>
          <div class="report-actions">
            <button class="report-action-btn create-flashcard-btn" data-id="${report.id}" title="建立記憶卡">
              🃏
            </button>
            <button class="report-action-btn favorite-btn ${report.favorite ? 'active' : ''}" data-id="${report.id}" title="${report.favorite ? '取消最愛' : '加入最愛'}">
              ${report.favorite ? '⭐' : '☆'}
            </button>
            <button class="report-action-btn edit-tags-btn" data-id="${report.id}" title="編輯標籤">
              🏷️
            </button>
            <button class="report-action-btn delete-btn" data-id="${report.id}" title="刪除報告">
              🗑️
            </button>
          </div>
        </div>
        <div class="saved-report-meta">
          <span class="report-date">${new Date(report.timestamp).toLocaleDateString('zh-TW')}</span>
          ${report.tags && report.tags.length > 0 ? `<span class="report-tags">${report.tags.map(tag => `<span class="tag-chip">#${tag}</span>`).join('')}</span>` : ''}
        </div>
        <div class="saved-report-preview">
          <p>${truncatedAnalysis}</p>
        </div>
        <div class="saved-report-actions">
          <button class="action-button show-full-btn" data-id="${report.id}">📖 查看完整分析</button>
          <button class="action-button secondary export-single-btn" data-id="${report.id}">📧 Email Export</button>
          <button class="action-button secondary replay-btn" data-text="${report.searchText}" data-language="${report.language}">🔄 Replay</button>
        </div>
      </div>
    `;
  }).join('');
}

// Update prompt type indicator
async function updatePromptTypeIndicator() {
  try {
    const indicator = document.getElementById('promptTypeIndicator');
    const textSpan = document.getElementById('promptTypeText');
    
    if (!indicator || !textSpan) return;
    
    // Get current settings
    const result = await chrome.storage.sync.get(['useCustomPrompt']);
    const isCustom = result.useCustomPrompt === 'true';
    
    // Update indicator
    if (isCustom) {
      textSpan.textContent = '🎨 Custom';
      textSpan.className = 'prompt-type-text custom';
    } else {
      textSpan.textContent = '⚙️ Default';
      textSpan.className = 'prompt-type-text default';
    }
    
    indicator.style.display = 'block';
  } catch (error) {
    console.error('Failed to update prompt type indicator:', error);
  }
}

// Initialize all buttons and features
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize memory cleanup first
  initializeMemoryCleanup();
  
  // Set up emergency shutdown monitoring
  setupEmergencyMonitoring();
  
  // Initialize history filters first to ensure window.setCurrentHistoryData is available
  initializeHistoryFilters();
  
  // Initialize TTS voices
  initializeTTSVoices();
  
  // Initialize audio search
  initializeAudioSearch();
  
  // Load learning stats from storage
  await loadLearningStats();
  
  // Add some sample data if no learning stats exist (for testing)
  if (learningStats.totalSearches === 0) {
    console.log('🧪 Adding sample learning data for testing');
    recordLearningSearch('hello world', 'english', 'https://youtube.com/watch?v=test', 'Sample YouTube Video');
    recordLearningSearch('pronunciation', 'english', 'https://youtube.com/watch?v=test2', 'Another Sample Video');
    recordLearningSearch('learning', 'english', 'https://youtube.com/watch?v=test3', 'Learning Video');
    
    // Update dashboard after adding sample data
    console.log('🔄 Updating dashboard with sample data');
    updateLearningDashboard();
  }
  
  // Check for YouTube analysis data
  checkForYouTubeAnalysis();
  
  // Check for Netflix analysis data
  checkForNetflixAnalysis();
  
  // Check for Udemy analysis data
  checkForUdemyAnalysis();
  
  // Check for article analysis data
  checkForArticleAnalysis();
  
  // Settings button
  const settingsBtn = document.querySelector('.settings-button');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
  
  // Header language selector
  const headerLanguageSelect = document.getElementById('headerLanguageSelect');
  if (headerLanguageSelect) {
    // Load current language setting (use the correct storage key)
    chrome.storage.sync.get(['uiLanguage'], (result) => {
      const currentLang = result.uiLanguage || 'auto';
      headerLanguageSelect.value = currentLang;
    });
    
    // Handle language change
    headerLanguageSelect.addEventListener('change', async (e) => {
      const selectedLang = e.target.value;
      console.log('Language changed to:', selectedLang);
      
      try {
        // Save to storage with the correct key (uiLanguage, not interfaceLanguage)
        await new Promise((resolve) => {
          chrome.storage.sync.set({ uiLanguage: selectedLang }, resolve);
        });
        
        console.log('Interface language saved:', selectedLang);
        
        // Apply language change immediately using available methods
        if (typeof window.i18nHelper !== 'undefined' && window.i18nHelper.switchLanguage) {
          await window.i18nHelper.switchLanguage(selectedLang);
          console.log('✅ Language switched to:', selectedLang, 'via i18nHelper');
        } else if (typeof window.refreshUILanguage !== 'undefined') {
          await window.refreshUILanguage();
          console.log('✅ Language switched to:', selectedLang, 'via refreshUILanguage');
        } else {
          console.log('⚠️ No i18n helpers available, reloading page...');
          // Fallback: reload the page to apply new language
          window.location.reload();
        }
      } catch (error) {
        console.error('Error switching language:', error);
        // Fallback: reload on error
        window.location.reload();
      }
    });
  }
  
  // New tab button
  const newTabBtn = document.getElementById('openInNewTabBtn');
  if (newTabBtn) {
    newTabBtn.addEventListener('click', openCurrentInNewTab);
  }
  
  // Quick action buttons in video tab
  const practiceBtn = document.getElementById('practiceTopWords');
  if (practiceBtn) {
    practiceBtn.addEventListener('click', startPracticeSession);
  }
  
  const reviewBtn = document.getElementById('reviewRecentWords');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', reviewVocabulary);
  }
  
  const exportBtn = document.getElementById('quickExportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportLearningData);
  }
  
  // Storage Management buttons
  const checkStorageBtn = document.getElementById('checkStorageBtn');
  const exportAudioBtn = document.getElementById('exportAudioBtn');
  const emergencyCleanBtn = document.getElementById('emergencyCleanBtn');
  
  if (checkStorageBtn) {
    checkStorageBtn.addEventListener('click', async () => {
      console.log('🔍 Checking storage usage...');
      await updateStorageDisplay();
    });
  }
  
  if (exportAudioBtn) {
    exportAudioBtn.addEventListener('click', async () => {
      console.log('📦 Exporting audio data...');
      const result = await exportAndClearAudio();
      if (result && result.success) {
        showMessage(`匯出完成：${result.exportedFiles} 個音檔已下載，空間已釋放`, 'success');
        await updateStorageDisplay();
      } else {
        showMessage('沒有音檔需要匯出', 'info');
      }
    });
  }
  
  if (emergencyCleanBtn) {
    emergencyCleanBtn.addEventListener('click', async () => {
      if (confirm('⚠️ 確定要刪除所有音檔嗎？此操作無法復原！')) {
        console.log('🗑️ Clearing all audio...');
        const result = await fixStorageIssue();
        if (result && result.removedAudio > 0) {
          showMessage(`已清除 ${result.removedAudio} 個音檔`, 'success');
          await updateStorageDisplay();
        } else {
          showMessage('沒有音檔需要清除', 'info');
        }
      }
    });
  }
  
  // Emergency cleanup button
  const emergencyCleanupBtn = document.getElementById('emergencyCleanupBtn');
  if (emergencyCleanupBtn) {
    emergencyCleanupBtn.addEventListener('click', () => {
      console.log('🚨 Emergency cleanup button clicked');
      emergencyCleanup();
      alert('✅ Emergency cleanup completed! Audio cache cleared.');
    });
  }
  
  // Initialize storage display
  updateStorageDisplay();

  // AI Analysis buttons
  const generateBtn = document.getElementById('generateAiAnalysisBtn');
  const refreshBtn = document.getElementById('refreshAiAnalysisBtn');
  
  if (generateBtn) {
    generateBtn.addEventListener('click', () => generateAIAnalysis());
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => generateAIAnalysis(true));
  }
  
  // Auto-save toggle button
  const autoSaveToggleBtn = document.getElementById('autoSaveToggleBtn');
  if (autoSaveToggleBtn) {
    // Load current auto-save setting
    loadAutoSaveSetting();
    
    autoSaveToggleBtn.addEventListener('click', () => toggleAutoSave());
  }
  
  // Error detection toggle button
  const errorDetectionToggleBtn = document.getElementById('errorDetectionToggleBtn');
  if (errorDetectionToggleBtn) {
    // Load current error detection setting
    loadErrorDetectionSetting();
    
    errorDetectionToggleBtn.addEventListener('click', () => toggleErrorDetection());
  }
  
  // A2 Test Usage button
  const a2TestUsageBtn = document.getElementById('a2TestUsageBtn');
  if (a2TestUsageBtn) {
    a2TestUsageBtn.addEventListener('click', () => generateA2TestUsage());
  }
  
  // Prompt Toggle button
  const promptToggleBtn = document.getElementById('promptToggleBtn');
  if (promptToggleBtn) {
    promptToggleBtn.addEventListener('click', () => togglePromptType());
    // Add hover effects
    promptToggleBtn.addEventListener('mouseover', () => {
      promptToggleBtn.style.background = '#e8eaed';
    });
    promptToggleBtn.addEventListener('mouseout', () => {
      promptToggleBtn.style.background = '#f1f3f4';
    });
  }
  
  // Save audio toggle button
  const saveAudioToggleBtn = document.getElementById('saveAudioToggleBtn');
  if (saveAudioToggleBtn) {
    // Load current save audio setting
    loadSaveAudioSetting();
    
    saveAudioToggleBtn.addEventListener('click', () => toggleSaveAudio());
  }
  
  // Migrate articles button
  const migrateArticlesBtn = document.getElementById('migrateArticlesBtn');
  if (migrateArticlesBtn) {
    migrateArticlesBtn.addEventListener('click', async () => {
      if (!storageManager || !storageManager.migrateReportsDetectionMethod) {
        alert('Storage manager not available');
        return;
      }
      
      const originalText = migrateArticlesBtn.textContent;
      migrateArticlesBtn.textContent = '🔧 修復中...';
      migrateArticlesBtn.disabled = true;
      
      try {
        console.log('🔧 Starting manual article migration...');
        const result = await storageManager.migrateReportsDetectionMethod();
        console.log('🔧 Migration result:', result);
        
        if (result.success) {
          alert(`✅ 修復完成！已更新 ${result.updatedCount} 個報告的文章標記`);
          // Reload the saved reports view
          loadSavedReports();
        } else {
          console.error('Migration failed:', result);
          alert(`❌ 修復失敗：${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Migration error:', error);
        alert(`❌ 修復失敗：${error.message}`);
      } finally {
        migrateArticlesBtn.textContent = originalText;
        migrateArticlesBtn.disabled = false;
      }
    });
  }
  
  // Re-analyze reports button
  const reAnalyzeReportsBtn = document.getElementById('reAnalyzeReportsBtn');
  if (reAnalyzeReportsBtn) {
    reAnalyzeReportsBtn.addEventListener('click', async () => {
      if (!storageManager || !storageManager.reAnalyzeAllReports) {
        alert('Storage manager not available');
        return;
      }
      
      const originalText = reAnalyzeReportsBtn.textContent;
      reAnalyzeReportsBtn.textContent = '🔄 分析中...';
      reAnalyzeReportsBtn.disabled = true;
      
      try {
        console.log('🔄 Starting manual re-analysis...');
        const result = await storageManager.reAnalyzeAllReports();
        console.log('🔄 Re-analysis result:', result);
        
        if (result.success) {
          alert(`✅ 重新分析完成！更新了 ${result.updatedCount} 個報告的錯誤狀態`);
          // Reload the saved reports view
          loadSavedReports();
        } else {
          console.error('Re-analysis failed:', result);
          alert(`❌ 重新分析失敗：${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Re-analysis error:', error);
        alert(`❌ 重新分析失敗：${error.message}`);
      } finally {
        reAnalyzeReportsBtn.textContent = originalText;
        reAnalyzeReportsBtn.disabled = false;
      }
    });
  }
  
  
  // Manual save button
  const manualSaveBtn = document.getElementById('manualSaveBtn');
  if (manualSaveBtn) {
    manualSaveBtn.addEventListener('click', () => manualSaveReport());
  }
  
  // Audio generation buttons
  const generateAudioBtn = document.getElementById('generateAudioBtn');
  const regenerateAudioBtn = document.getElementById('regenerateAudioBtn');
  const playAudioBtn = document.getElementById('playAudioBtn');
  const downloadAudioBtn = document.getElementById('downloadAudioBtn');
  const testAudioBtn = document.getElementById('testAudioBtn');
  
  if (generateAudioBtn) {
    generateAudioBtn.addEventListener('click', () => generateAudioPronunciation());
  }
  
  if (regenerateAudioBtn) {
    regenerateAudioBtn.addEventListener('click', () => generateAudioPronunciation(true));
  }
  
  if (playAudioBtn) {
    playAudioBtn.addEventListener('click', playAudio);
  }
  
  if (downloadAudioBtn) {
    downloadAudioBtn.addEventListener('click', downloadAudio);
  }
  
  // Test audio button for debugging
  if (testAudioBtn) {
    testAudioBtn.addEventListener('click', () => {
      console.log('=== AUDIO TEST DEBUG ===');
      console.log('aiService:', aiService);
      console.log('aiService type:', typeof aiService);
      console.log('currentQueryData:', currentQueryData);
      
      if (aiService) {
        console.log('AI Service initialized:', aiService.isInitialized);
        console.log('AI Service available:', aiService.isAvailable());
        console.log('Audio available:', aiService.isAudioAvailable());
        console.log('Settings:', aiService.settings);
        
        // Try to initialize if not already done
        if (!aiService.isInitialized) {
          console.log('Attempting to initialize AI service...');
          aiService.initialize().then(result => {
            console.log('Initialization result:', result);
            console.log('After init - Audio available:', aiService.isAudioAvailable());
            console.log('After init - Settings:', aiService.settings);
          }).catch(err => {
            console.error('Initialization failed:', err);
          });
        }
      } else {
        console.error('aiService is not defined!');
        console.log('window.aiService:', window.aiService);
        console.log('typeof window.aiService:', typeof window.aiService);
      }
      console.log('=== END AUDIO TEST ===');
    });
  }
  
  // History controls
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('確定要清空所有搜尋歷史嗎？這個操作無法復原。')) {
        try {
          console.log('🧹 Clearing all history...');
          const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'clearHistory' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('❌ Chrome runtime error during clear:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else {
                console.log('🧹 Clear response:', response);
                resolve(response);
              }
            });
          });
          if (response && response.success) {
            console.log('✅ History cleared successfully');
            loadHistoryView(); // Reload the view
          } else {
            console.error('❌ Failed to clear history:', response?.error);
            alert('清空失敗: ' + (response?.error || '未知錯誤'));
          }
        } catch (error) {
          console.error('Error clearing history:', error);
          alert('清空失敗');
        }
      }
    });
  }
  
  // History search functionality
  const historySearchInput = document.getElementById('historySearchInput');
  const historyLanguageFilter = document.getElementById('historyLanguageFilter');
  
  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      filterHistoryView();
    });
  }
  
  if (historyLanguageFilter) {
    historyLanguageFilter.addEventListener('change', () => {
      filterHistoryView();
    });
  }
  
  // Saved reports search and filter functionality
  const savedReportsSearchInput = document.getElementById('savedReportsSearchInput');
  const savedReportsLanguageFilter = document.getElementById('savedReportsLanguageFilter');
  const savedReportsTagFilter = document.getElementById('savedReportsTagFilter');
  const savedReportsDateFilter = document.getElementById('savedReportsDateFilter');
  const dateRangeInputs = document.getElementById('dateRangeInputs');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  const favoritesOnlyFilter = document.getElementById('favoritesOnlyFilter');
  const exportReportsBtn = document.getElementById('exportReportsBtn');
  const exportDropdown = document.getElementById('exportDropdown');
  
  if (savedReportsSearchInput) {
    savedReportsSearchInput.addEventListener('input', () => {
      filterSavedReports();
    });
  }
  
  if (savedReportsLanguageFilter) {
    savedReportsLanguageFilter.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  if (savedReportsTagFilter) {
    savedReportsTagFilter.addEventListener('change', (e) => {
      console.log('🎯 Tag filter changed! New value:', e.target.value);
      filterSavedReports();
    });
  }
  
  if (savedReportsDateFilter) {
    savedReportsDateFilter.addEventListener('change', () => {
      // Show/hide custom date range inputs
      if (savedReportsDateFilter.value === 'custom') {
        dateRangeInputs.style.display = 'block';
      } else {
        dateRangeInputs.style.display = 'none';
      }
      filterSavedReports();
    });
  }
  
  if (startDate) {
    startDate.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  if (endDate) {
    endDate.addEventListener('change', () => {
      filterSavedReports();
    });
  }

  if (favoritesOnlyFilter) {
    favoritesOnlyFilter.addEventListener('change', () => {
      filterSavedReports();
    });
  }
  
  // Cleanup duplicates button
  const cleanupDuplicatesBtn = document.getElementById('cleanupDuplicatesBtn');
  if (cleanupDuplicatesBtn) {
    cleanupDuplicatesBtn.addEventListener('click', async () => {
      await cleanupDuplicateReports();
    });
  }

  // Bulk flashcard creation
  const createAllFlashcardsBtn = document.getElementById('createAllFlashcardsBtn');
  if (createAllFlashcardsBtn) {
    createAllFlashcardsBtn.addEventListener('click', async () => {
      await createAllFlashcardsFromReports();
    });
  }

  // Notion sync button
  const syncToNotionBtn = document.getElementById('syncToNotionBtn');
  if (syncToNotionBtn) {
    syncToNotionBtn.addEventListener('click', async () => {
      await syncFilteredReportsToNotion();
    });
  }
  
  // Export dropdown functionality
  if (exportReportsBtn) {
    exportReportsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = exportReportsBtn.closest('.export-dropdown');
      dropdown.classList.toggle('show');
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-dropdown')) {
      const dropdowns = document.querySelectorAll('.export-dropdown.show');
      dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    }
  });
  
  // Export format handlers
  const exportHandlers = {
    'exportMarkdown': () => exportSavedReports('markdown'),
    'exportHeptabase': () => exportSavedReports('heptabase'),
    'exportObsidian': () => exportSavedReports('obsidian'),
    'exportNotion': () => exportSavedReports('notion-api'),
    'exportEmail': () => exportSavedReports('email'),
    'exportJSON': () => exportSavedReports('json')
  };
  
  Object.entries(exportHandlers).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        // Close dropdown
        document.querySelectorAll('.export-dropdown.show').forEach(d => d.classList.remove('show'));
        handler();
      });
    }
  });

  // Extension loaded - ready for user searches
  console.log('✅ YouGlish extension loaded and ready');
  
  // Manual search
  const manualSearchBtn = document.getElementById('manualSearchBtn');
  const manualSearchInput = document.getElementById('manualSearchInput');
  
  if (manualSearchBtn) {
    manualSearchBtn.addEventListener('click', performManualSearch);
  }
  
  if (manualSearchInput) {
    manualSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performManualSearch();
      }
    });
  }
  
  // Check for current query and ensure welcome screen shows if no query
  chrome.storage.local.get(['currentQuery'], (result) => {
    console.log('Loading current query on startup:', result.currentQuery);
    
    if (result.currentQuery && result.currentQuery.text) {
      // Create proper query data structure
      const queryData = {
        text: result.currentQuery.text,
        language: result.currentQuery.language,
        primaryUrl: result.currentQuery.url || result.currentQuery.primaryUrl,
        secondaryUrl: result.currentQuery.secondaryUrl || '',
        tertiaryUrl: result.currentQuery.tertiaryUrl || '',
        allUrls: result.currentQuery.allUrls || { 'YouGlish': result.currentQuery.url || result.currentQuery.primaryUrl },
        autoAnalysis: result.currentQuery.autoAnalysis !== false, // Respect the setting from background.js
        analysisOnly: result.currentQuery.analysisOnly // Pass through analysisOnly flag
      };
      
      showSearchResult(queryData);
      log('Loaded current query:', queryData);
    } else {
      // Ensure welcome screen is visible
      console.log('No current query found, showing welcome screen');
      const welcome = document.getElementById('welcome');
      const searchResult = document.getElementById('searchResult');
      const searchInfo = document.getElementById('searchInfo');
      
      if (welcome) welcome.style.display = 'block';
      if (searchResult) searchResult.style.display = 'none';
      if (searchInfo) searchInfo.style.display = 'none';
    }
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.currentQuery && changes.currentQuery.newValue) {
      const currentQuery = changes.currentQuery.newValue;
      console.log('Current query changed:', currentQuery);
      
      if (currentQuery && currentQuery.text) {
        // Create proper query data structure
        const queryData = {
          text: currentQuery.text,
          language: currentQuery.language,
          primaryUrl: currentQuery.url || currentQuery.primaryUrl,
          secondaryUrl: '',
          tertiaryUrl: '',
          allUrls: { 'YouGlish': currentQuery.url || currentQuery.primaryUrl },
          autoAnalysis: true // Enable auto analysis for new queries
        };
        
        showSearchResult(queryData);
      }
    }
    
    // Listen for article analysis data changes
    if (namespace === 'local' && changes.articleAnalysis) {
      console.log('📰 Article analysis storage changed:', changes.articleAnalysis);
      if (changes.articleAnalysis.newValue) {
        console.log('📰 New article analysis data detected, processing...');
        setTimeout(() => {
          checkForArticleAnalysis();
        }, 100); // Small delay to ensure data is fully written
      }
    }
  });
  
  // Search Again button removed - it was causing UI issues
  
  // Add saved reports button handler
  const showSavedReportsBtn = document.getElementById('showSavedReportsBtn');
  if (showSavedReportsBtn) {
    showSavedReportsBtn.onclick = () => {
      // Switch to saved reports view
      const savedReportsView = document.getElementById('savedReportsView');
      const analysisView = document.getElementById('analysisView');
      const videoView = document.getElementById('videoView');
      const historyView = document.getElementById('historyView');
      
      // Hide other views
      if (analysisView) analysisView.style.display = 'none';
      if (videoView) videoView.style.display = 'none';
      if (historyView) historyView.style.display = 'none';
      
      // Show saved reports view
      if (savedReportsView) {
        savedReportsView.style.display = 'block';
        loadSavedReports();
      }
      
      // Update button states
      document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
      showSavedReportsBtn.classList.add('active');
    };
  }
  // Enhanced Video Tab Functionality
  setupVideoTabFeatures();
});

// Enhanced Video Tab Features
function setupVideoTabFeatures() {
  // Video Learning Queue Management
  const clearVideoQueueBtn = document.getElementById('clearVideoQueueBtn');
  const refreshVideoQueueBtn = document.getElementById('refreshVideoQueueBtn');
  const startQuickReviewBtn = document.getElementById('startQuickReviewBtn');
  const openYouTubeBtn = document.getElementById('openYouTubeBtn');
  const practiceRecentBtn = document.getElementById('practiceRecentBtn');

  // Clear video learning queue
  if (clearVideoQueueBtn) {
    clearVideoQueueBtn.addEventListener('click', async () => {
      if (confirm('確定要清除所有學習影片記錄嗎？')) {
        try {
          await chrome.storage.local.remove(['videoLearningQueue']);
          refreshVideoQueue();
          console.log('✅ Video learning queue cleared');
        } catch (error) {
          console.error('❌ Failed to clear video queue:', error);
        }
      }
    });
  }

  // Refresh video queue
  if (refreshVideoQueueBtn) {
    refreshVideoQueueBtn.addEventListener('click', () => {
      refreshVideoQueue();
    });
  }

  // Netflix Learning Queue Management
  const clearNetflixQueueBtn = document.getElementById('clearNetflixQueueBtn');
  const refreshNetflixQueueBtn = document.getElementById('refreshNetflixQueueBtn');

  // Clear Netflix learning queue
  if (clearNetflixQueueBtn) {
    clearNetflixQueueBtn.addEventListener('click', async () => {
      if (confirm('確定要清除所有 Netflix 學習記錄嗎？')) {
        try {
          await chrome.storage.local.remove(['netflixLearningQueue']);
          refreshNetflixQueue();
          console.log('✅ Netflix learning queue cleared');
        } catch (error) {
          console.error('❌ Failed to clear Netflix queue:', error);
        }
      }
    });
  }

  // Refresh Netflix queue
  if (refreshNetflixQueueBtn) {
    refreshNetflixQueueBtn.addEventListener('click', () => {
      refreshNetflixQueue();
    });
  }

  // View all achievements
  const viewAllAchievementsBtn = document.getElementById('viewAllAchievementsBtn');
  if (viewAllAchievementsBtn) {
    viewAllAchievementsBtn.addEventListener('click', () => {
      showAchievementsModal();
    });
  }

  // Open YouTube
  if (openYouTubeBtn) {
    openYouTubeBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.youtube.com' });
    });
  }

  // View progress (switch to analytics tab)
  const viewProgressBtn = document.getElementById('viewProgressBtn');
  if (viewProgressBtn) {
    viewProgressBtn.addEventListener('click', () => {
      const analyticsBtn = document.getElementById('showAnalyticsBtn');
      if (analyticsBtn) {
        analyticsBtn.click();
      }
    });
  }

  // Initialize video tab data
  updateVideoTabStats();
  refreshVideoQueue();
  refreshNetflixQueue();
  
  // Set up event delegation for manual analysis buttons
  setupManualAnalysisButtons();
}

// Refresh video learning queue
async function refreshVideoQueue() {
  const queueContainer = document.getElementById('videoLearningQueue');
  if (!queueContainer) return;

  try {
    // Get YouTube learning history from storage
    const result = await chrome.storage.local.get(['videoLearningQueue']);
    const videoQueue = result.videoLearningQueue || [];

    if (videoQueue.length === 0) {
      // Show empty state with helpful links
      queueContainer.innerHTML = `
        <div style="text-align: center; color: #999; padding: 30px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🎬</div>
          <div style="font-size: 14px; margin-bottom: 8px; color: #666;">尚無學習影片</div>
          <div style="font-size: 12px; color: #ccc; margin-bottom: 16px;">在 YouTube 影片中點擊字幕開始學習</div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
            <a href="https://www.youtube.com/results?search_query=english+learning" target="_blank" 
               style="display: flex; align-items: center; text-decoration: none; color: #1a73e8; font-size: 12px; padding: 8px; border-radius: 4px; background: #f8f9fa; border: 1px solid #e0e0e0; transition: all 0.2s;">
              <span style="margin-right: 8px;">🎓</span>
              <span>推薦英語學習影片</span>
            </a>
            <a href="https://www.youtube.com/results?search_query=english+conversation+practice" target="_blank" 
               style="display: flex; align-items: center; text-decoration: none; color: #1a73e8; font-size: 12px; padding: 8px; border-radius: 4px; background: #f8f9fa; border: 1px solid #e0e0e0; transition: all 0.2s;">
              <span style="margin-right: 8px;">💬</span>
              <span>會話練習影片</span>
            </a>
          </div>
        </div>
      `;
    } else {
      // Display video queue with enhanced statistics
      queueContainer.innerHTML = videoQueue.map((video, index) => {
        const wordsCount = video.wordsLearned || 0;
        const sentencesCount = video.sentencesLearned || 0;
        const sessionsCount = video.sessionsCount || 1;
        const totalLearned = wordsCount + sentencesCount;
        
        return `
        <div class="video-queue-item" data-video-url="${video.url}" data-video-index="${index}" 
             style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; border-radius: 8px; margin-bottom: 8px; background: #fafafa;">
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 500; color: #333; margin-bottom: 6px; line-height: 1.3;">${video.title}</div>
            <div style="font-size: 11px; color: #666; margin-bottom: 4px;">
              ${video.channel} • ${new Date(video.timestamp).toLocaleDateString()}
            </div>
            <div style="display: flex; gap: 12px; font-size: 10px; color: #888;">
              <span style="background: #e3f2fd; color: #1565c0; padding: 2px 6px; border-radius: 10px;">📝 ${wordsCount} 個詞彙</span>
              <span style="background: #f3e5f5; color: #7b1fa2; padding: 2px 6px; border-radius: 10px;">💬 ${sentencesCount} 個句子</span>
              <span style="background: #e8f5e8; color: #2e7d32; padding: 2px 6px; border-radius: 10px;">🎯 總共 ${totalLearned} 項學習</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <button class="replay-video-btn" data-video-url="${video.url}" 
                    style="background: #ff0000; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;" 
                    title="返回影片">
              ⏰ 返回
            </button>
            <div style="font-size: 9px; color: #999;">${sessionsCount} 次學習</div>
          </div>
        </div>
        `;
      }).join('');
      
      // Add event listeners to video queue items
      queueContainer.querySelectorAll('.video-queue-item').forEach(item => {
        item.addEventListener('click', (e) => {
          // Don't trigger if clicking on replay button
          if (e.target.closest('.replay-video-btn')) return;
          
          const videoUrl = item.dataset.videoUrl;
          if (videoUrl) {
            openYouTubeVideo(videoUrl);
          }
        });
        
        // Add event listener for replay button
        const replayBtn = item.querySelector('.replay-video-btn');
        if (replayBtn) {
          replayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const videoUrl = replayBtn.dataset.videoUrl;
            if (videoUrl) {
              console.log('🎬 VIDEO TAB - Opening video from learning queue:', videoUrl);
              window.open(videoUrl, '_blank');
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('❌ Failed to load video queue:', error);
  }
}

// Add video to learning queue
async function addVideoToQueue(videoUrl, videoTitle, channel, isSentence = false) {
  try {
    const result = await chrome.storage.local.get(['videoLearningQueue']);
    const queue = result.videoLearningQueue || [];
    
    // Check if video already exists
    const existingIndex = queue.findIndex(v => v.url === videoUrl);
    
    if (existingIndex >= 0) {
      // Update existing entry with enhanced tracking
      queue[existingIndex].timestamp = Date.now();
      if (isSentence) {
        queue[existingIndex].sentencesLearned = (queue[existingIndex].sentencesLearned || 0) + 1;
      } else {
        queue[existingIndex].wordsLearned = (queue[existingIndex].wordsLearned || 0) + 1;
      }
      queue[existingIndex].sessionsCount = (queue[existingIndex].sessionsCount || 1) + 1;
      queue[existingIndex].lastActivity = new Date().toISOString();
    } else {
      // Add new video with enhanced data tracking
      queue.unshift({
        url: videoUrl,
        title: videoTitle || 'YouTube Video',
        channel: channel || 'Unknown Channel',
        timestamp: Date.now(),
        firstLearned: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        wordsLearned: isSentence ? 0 : 1,
        sentencesLearned: isSentence ? 1 : 0, // Track sentences separately
        sessionsCount: 1,    // Track how many times user learned from this video
        totalTimeSpent: 0    // Could track time spent learning
      });
    }
    
    // Keep only latest 10 videos
    if (queue.length > 10) {
      queue.splice(10);
    }
    
    await chrome.storage.local.set({ videoLearningQueue: queue });
    refreshVideoQueue();
  } catch (error) {
    console.error('❌ Failed to add video to queue:', error);
  }
}

// Add Netflix content to learning queue
async function addNetflixToQueue(netflixUrl, contentTitle, channel, isSentence = false) {
  try {
    const result = await chrome.storage.local.get(['netflixLearningQueue']);
    const queue = result.netflixLearningQueue || [];
    
    // Check if Netflix content already exists
    const existingIndex = queue.findIndex(v => v.url === netflixUrl);
    
    if (existingIndex >= 0) {
      // Update existing entry with enhanced tracking
      queue[existingIndex].timestamp = Date.now();
      if (isSentence) {
        queue[existingIndex].sentencesLearned = (queue[existingIndex].sentencesLearned || 0) + 1;
      } else {
        queue[existingIndex].wordsLearned = (queue[existingIndex].wordsLearned || 0) + 1;
      }
      queue[existingIndex].sessionsCount = (queue[existingIndex].sessionsCount || 1) + 1;
      queue[existingIndex].lastActivity = new Date().toISOString();
    } else {
      // Add new Netflix content with enhanced data tracking
      queue.unshift({
        url: netflixUrl,
        title: contentTitle || 'Netflix Content',
        channel: channel || 'Netflix',
        platform: 'netflix',
        timestamp: Date.now(),
        firstLearned: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        wordsLearned: isSentence ? 0 : 1,
        sentencesLearned: isSentence ? 1 : 0,
        sessionsCount: 1,
        totalTimeSpent: 0,
        contentType: extractNetflixContentType(netflixUrl),
        movieId: extractNetflixMovieId(netflixUrl)
      });
    }
    
    // Keep only latest 10 Netflix contents
    if (queue.length > 10) {
      queue.splice(10);
    }
    
    await chrome.storage.local.set({ netflixLearningQueue: queue });
    refreshNetflixQueue();
  } catch (error) {
    console.error('❌ Failed to add Netflix content to queue:', error);
  }
}

// Add Udemy content to learning queue
async function addUdemyToQueue(udemyUrl, contentTitle, channel, isSentence = false, courseTitle = null) {
  try {
    const result = await chrome.storage.local.get(['udemyLearningQueue']);
    const queue = result.udemyLearningQueue || [];
    
    // Check if Udemy content already exists
    const existingIndex = queue.findIndex(v => v.url === udemyUrl);
    
    if (existingIndex >= 0) {
      // Update existing entry with enhanced tracking
      queue[existingIndex].timestamp = Date.now();
      if (isSentence) {
        queue[existingIndex].sentencesLearned = (queue[existingIndex].sentencesLearned || 0) + 1;
      } else {
        queue[existingIndex].wordsLearned = (queue[existingIndex].wordsLearned || 0) + 1;
      }
      queue[existingIndex].sessionsCount = (queue[existingIndex].sessionsCount || 1) + 1;
      queue[existingIndex].lastActivity = new Date().toISOString();
      // Update course title if provided and different
      if (courseTitle && courseTitle !== 'Udemy Course') {
        queue[existingIndex].courseTitle = courseTitle;
      }
    } else {
      // Add new Udemy content with enhanced data tracking
      queue.unshift({
        url: udemyUrl,
        title: contentTitle || 'Udemy Course',
        courseTitle: courseTitle || contentTitle || 'Udemy Course',
        channel: channel || 'Udemy',
        platform: 'udemy',
        timestamp: Date.now(),
        firstLearned: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        wordsLearned: isSentence ? 0 : 1,
        sentencesLearned: isSentence ? 1 : 0,
        sessionsCount: 1,
        totalTimeSpent: 0,
        contentType: 'course',
        videoId: extractUdemyVideoId(udemyUrl)
      });
    }
    
    // Keep only latest 10 Udemy contents
    if (queue.length > 10) {
      queue.splice(10);
    }
    
    await chrome.storage.local.set({ udemyLearningQueue: queue });
    refreshUdemyQueue();
  } catch (error) {
    console.error('❌ Failed to add Udemy content to queue:', error);
  }
}

// Helper function to extract Udemy video ID
function extractUdemyVideoId(url) {
  const match = url.match(/lecture\/(\d+)/);
  return match ? match[1] : null;
}

// Placeholder function for refreshing Udemy queue
function refreshUdemyQueue() {
  // This would refresh the UI to show updated Udemy queue
  console.log('🔄 Udemy queue refreshed');
}

// Helper functions for Netflix content
function extractNetflixContentType(url) {
  if (url.includes('/title/')) return 'series';
  if (url.includes('/watch/')) return 'movie';
  return 'content';
}

function extractNetflixMovieId(url) {
  const match = url.match(/(?:watch|title)\/(\d+)/);
  return match ? match[1] : null;
}

// Refresh Netflix queue display (similar to refreshVideoQueue)
async function refreshNetflixQueue() {
  try {
    const result = await chrome.storage.local.get(['netflixLearningQueue']);
    const queue = result.netflixLearningQueue || [];
    
    const netflixQueueContainer = document.getElementById('netflixLearningQueue');
    if (!netflixQueueContainer) return;
    
    if (queue.length === 0) {
      netflixQueueContainer.innerHTML = '<p style="color: #666; font-style: italic;">🎭 No Netflix content in learning queue yet</p>';
      return;
    }
    
    const queueHTML = queue.map(item => `
      <div class="netflix-queue-item" style="
        background: linear-gradient(135deg, #141414 0%, #2a2a2a 100%);
        border: 1px solid #e50914;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        color: white;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="font-weight: bold; color: #e50914;">🎭 ${item.title}</div>
          <div style="font-size: 12px; color: #999;">${item.contentType}</div>
        </div>
        <div style="font-size: 12px; color: #ccc; margin-bottom: 6px;">
          📺 ${item.channel} • 🕐 ${new Date(item.timestamp).toLocaleDateString()}
        </div>
        <div style="display: flex; gap: 12px; font-size: 11px; color: #aaa;">
          <span>💬 Words: ${item.wordsLearned || 0}</span>
          <span>📝 Sentences: ${item.sentencesLearned || 0}</span>
          <span>🔄 Sessions: ${item.sessionsCount || 1}</span>
        </div>
        <div style="margin-top: 8px;">
          <a href="${item.url}" target="_blank" style="
            color: #e50914;
            text-decoration: none;
            font-size: 11px;
            padding: 4px 8px;
            border: 1px solid #e50914;
            border-radius: 4px;
            display: inline-block;
          ">
            🎬 Rewatch
          </a>
        </div>
      </div>
    `).join('');
    
    netflixQueueContainer.innerHTML = queueHTML;
  } catch (error) {
    console.error('❌ Failed to refresh Netflix queue:', error);
  }
}

// Update video tab statistics
async function updateVideoTabStats() {
  try {
    // Get learning stats, video queue, and Netflix queue
    const result = await chrome.storage.local.get(['learningStats', 'videoLearningQueue', 'netflixLearningQueue']);
    const stats = result.learningStats || { totalSearches: 0, vocabularyCount: 0, todaySearches: 0 };
    const videoQueue = result.videoLearningQueue || [];
    const netflixQueue = result.netflixLearningQueue || [];
    
    // Update main counters
    const todayCount = document.getElementById('todayLearningCount');
    const weekCount = document.getElementById('weekStreakCount');
    
    if (todayCount) todayCount.textContent = stats.todaySearches || 0;
    if (weekCount) weekCount.textContent = Math.min(7, Math.floor((stats.totalSearches || 0) / 5)); // Rough calculation
    
    // Update mini dashboard stats (combine YouTube and Netflix content)
    const totalVideoCountEl = document.getElementById('totalVideoCount');
    const accuracyRateEl = document.getElementById('accuracyRate');
    const learningStreakEl = document.getElementById('learningStreak');
    
    if (totalVideoCountEl) {
      const totalContent = videoQueue.length + netflixQueue.length;
      totalVideoCountEl.textContent = totalContent;
      totalVideoCountEl.title = `YouTube: ${videoQueue.length}, Netflix: ${netflixQueue.length}`;
    }
    
    // Calculate accuracy rate from saved reports
    if (accuracyRateEl) {
      try {
        if (storageManager && typeof storageManager.getAIReports === 'function') {
          const reports = await storageManager.getAIReports();
          const analyzedReports = reports.filter(r => r.hasErrors !== null && r.hasErrors !== undefined);
          const correctReports = reports.filter(r => r.isCorrect === true);
          const accuracyRate = analyzedReports.length > 0 ? Math.round((correctReports.length / analyzedReports.length) * 100) : 0;
          accuracyRateEl.textContent = `${accuracyRate}%`;
        } else {
          accuracyRateEl.textContent = '0%';
        }
      } catch (error) {
        accuracyRateEl.textContent = '0%';
      }
    }
    
    // Calculate learning streak (rough estimation based on activity)
    if (learningStreakEl) {
      const streak = calculateLearningStreak(stats);
      learningStreakEl.textContent = streak;
    }
    
    // Update achievements
    await updateRecentAchievements(stats, videoQueue);
    
  } catch (error) {
    console.error('❌ Failed to update video tab stats:', error);
  }
}

// Calculate learning streak
function calculateLearningStreak(stats) {
  if (!stats.recentActivity || stats.recentActivity.length === 0) return 0;
  
  // Simple streak calculation based on recent activity
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
  
  const todayActivity = stats.recentActivity.some(a => new Date(a.timestamp).toDateString() === today);
  const yesterdayActivity = stats.recentActivity.some(a => new Date(a.timestamp).toDateString() === yesterday);
  
  if (todayActivity && yesterdayActivity) return 2;
  if (todayActivity) return 1;
  return 0;
}

// Update recent achievements
async function updateRecentAchievements(stats, videoQueue) {
  const achievementsList = document.getElementById('recentAchievementsList');
  if (!achievementsList) return;
  
  const achievements = [];
  
  // Check for various achievements
  if (stats.totalSearches >= 10) {
    achievements.push({
      icon: '🌟',
      title: '初學者',
      description: '完成了 10 次學習搜尋',
      earned: true
    });
  }
  
  if (stats.vocabularyCount >= 50) {
    achievements.push({
      icon: '📚',
      title: '詞彙收集者',
      description: '學習了 50 個不同詞彙',
      earned: true
    });
  }
  
  if (videoQueue.length >= 5) {
    achievements.push({
      icon: '🎬',
      title: '影片愛好者',
      description: '從 5 個不同影片學習',
      earned: true
    });
  }
  
  if (stats.todaySearches >= 5) {
    achievements.push({
      icon: '🔥',
      title: '今日活躍',
      description: '今天學習了 5 次',
      earned: true
    });
  }
  
  if (achievements.length === 0) {
    achievementsList.innerHTML = `
      <div style="text-align: center; color: #999; padding: 20px; font-size: 12px;">
        開始學習來解鎖成就！
      </div>
    `;
  } else {
    achievementsList.innerHTML = achievements.map(achievement => `
      <div style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0;">
        <span style="font-size: 16px; margin-right: 8px;">${achievement.icon}</span>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 500; color: #333;">${achievement.title}</div>
          <div style="font-size: 10px; color: #666;">${achievement.description}</div>
        </div>
        <span style="color: #4CAF50; font-size: 12px;">✓</span>
      </div>
    `).join('');
  }
}

// Show achievements modal
function showAchievementsModal() {
  // For now, just show a simple alert - can be enhanced later
  alert('🏆 成就系統\n\n查看您的學習成就和進度。\n這個功能可以在未來版本中進一步增強！');
}

// Load review items
async function loadReviewItems() {
  const reviewContainer = document.getElementById('reviewItemsList');
  if (!reviewContainer) return;

  try {
    // Get recent learning items that need review
    const historyResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getHistory' }, resolve);
    });

    if (historyResponse && historyResponse.success) {
      const recentItems = historyResponse.history
        .filter(item => item.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        .slice(0, 5); // Top 5 items

      if (recentItems.length === 0) {
        reviewContainer.innerHTML = `
          <div style="text-align: center; color: #999; padding: 20px; font-size: 12px;">
            暫無待複習項目
          </div>
        `;
      } else {
        reviewContainer.innerHTML = recentItems.map((item, index) => `
          <div class="review-item" data-text="${item.text}" data-language="${item.language}" data-item-index="${index}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid #f0f0f0; cursor: pointer;">
            <div style="flex: 1;">
              <div style="font-size: 11px; font-weight: 500; color: #333;">${item.text}</div>
              <div style="font-size: 10px; color: #666;">${languageNames[item.language] || item.language}</div>
            </div>
            <div style="color: #4CAF50; font-size: 10px;">▶️</div>
          </div>
        `).join('');
        
        // Add event listeners to review items
        reviewContainer.querySelectorAll('.review-item').forEach(item => {
          item.addEventListener('click', () => {
            const text = item.dataset.text;
            const language = item.dataset.language;
            if (text && language) {
              reviewItem(text, language);
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to load review items:', error);
  }
}

// Start quick review
function startQuickReview() {
  // Switch to analysis view and start review mode
  const analysisBtn = document.getElementById('showAnalysisBtn');
  if (analysisBtn) {
    analysisBtn.click();
    // Could add special review mode logic here
  }
}

// Start practice mode
function startPracticeMode() {
  // Switch to flashcards view
  const flashcardsBtn = document.getElementById('showFlashcardsBtn');
  if (flashcardsBtn) {
    flashcardsBtn.click();
  }
}

// Review specific item
function reviewItem(text, language) {
  // Load the item for analysis
  const queryData = {
    text: text,
    language: language,
    primaryUrl: `https://youglish.com/pronounce/${encodeURIComponent(text)}/${language}`,
    autoAnalysis: true
  };
  
  // Switch to analysis view
  const analysisBtn = document.getElementById('showAnalysisBtn');
  if (analysisBtn) {
    analysisBtn.click();
    // Load the item
    setTimeout(() => {
      showSearchResult(queryData);
    }, 200);
  }
}

// Open YouTube video
function openYouTubeVideo(url) {
  chrome.tabs.create({ url: url });
}

// Set up event delegation for manual analysis buttons
function setupManualAnalysisButtons() {
  // Use event delegation to handle dynamically created buttons
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('manual-analysis-btn')) {
      const text = event.target.dataset.text;
      const url = event.target.dataset.url;
      const title = event.target.dataset.title;
      
      if (text && typeof triggerManualAnalysis === 'function') {
        triggerManualAnalysis(text, url, title);
      }
    }
  });
}

// Extract channel name from YouTube URL (helper function)
function extractChannelFromYouTubeUrl(url) {
  try {
    // This is a simple approach - in practice you might want to use YouTube API
    // For now, we'll use document title from the page if available
    if (typeof document !== 'undefined' && document.title) {
      // YouTube title format is usually "Video Title - Channel Name - YouTube"
      const parts = document.title.split(' - ');
      if (parts.length >= 2) {
        return parts[parts.length - 2]; // Second to last part is usually channel
      }
    }
    return 'YouTube Channel';
  } catch (error) {
    return 'Unknown Channel';
  }
}

// Filter saved reports based on search, language, tags, date, and favorites
async function filterSavedReports() {
  console.log('🚨 filterSavedReports() called!');
  
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const dateFilter = document.getElementById('savedReportsDateFilter')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  console.log('🔧 All filter values:', { searchQuery, languageFilter, tagFilter, dateFilter, startDate, endDate, favoritesOnly });
  
  // Debug tag filter
  if (tagFilter) {
    console.log('🏷️ Tag filter active:', `"${tagFilter}"`);
    console.log('🏷️ Tag filter length:', tagFilter.length);
    console.log('🏷️ Tag filter char codes:', Array.from(tagFilter).map(c => c.charCodeAt(0)));
  } else {
    console.log('❌ No tag filter detected');
  }
  
  try {
    let reports = [];
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      // Use the storage manager's built-in filtering
      const filter = {};
      if (languageFilter) filter.language = languageFilter;
      if (searchQuery) filter.searchText = searchQuery;
      if (favoritesOnly) filter.favorites = true;
      
      reports = await storageManager.getAIReports(filter);
    } else {
      // Fallback: get all reports and filter manually
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      reports = result;
      
      // Apply filters manually
      if (searchQuery) {
        reports = reports.filter(report => 
          report.searchText.toLowerCase().includes(searchQuery) ||
          (report.tags && report.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
        );
      }
      
      if (languageFilter) {
        reports = reports.filter(report => report.language === languageFilter);
      }
      
      if (tagFilter) {
        console.log('🔍 DETAILED TAG FILTER DEBUG:');
        console.log('  Filter value:', `"${tagFilter}"`);
        console.log('  Total reports before filtering:', reports.length);
        
        // Check what tags actually exist in reports
        const allFoundTags = [];
        reports.forEach(report => {
          if (report.tags && Array.isArray(report.tags)) {
            report.tags.forEach(tag => allFoundTags.push(`"${tag}"`));
          }
        });
        console.log('  All tags found in reports:', allFoundTags);
        
        const filteredReports = reports.filter(report => {
          console.log(`\n  📋 Checking report: "${report.searchText}"`);
          console.log(`    Report tags:`, report.tags);
          console.log(`    Has tags array:`, report.tags && Array.isArray(report.tags));
          
          if (!report.tags || !Array.isArray(report.tags)) {
            console.log(`    ❌ No valid tags array`);
            return false;
          }
          
          const matches = report.tags.some(tag => {
            console.log(`    🏷️ Comparing tag: "${tag}"`);
            if (!tag) {
              console.log(`      ❌ Tag is null/undefined`);
              return false;
            }
            const cleanTag = tag.trim().toLowerCase();
            const cleanFilter = tagFilter.trim().toLowerCase();
            const isMatch = cleanTag === cleanFilter;
            console.log(`      Clean tag: "${cleanTag}"`);
            console.log(`      Clean filter: "${cleanFilter}"`);
            console.log(`      Match: ${isMatch}`);
            return isMatch;
          });
          
          console.log(`    Final result for "${report.searchText}": ${matches}`);
          return matches;
        });
        
        reports = filteredReports;
        console.log(`\n  ✅ Final filtered count: ${reports.length}`);
        console.log('  END TAG FILTER DEBUG\n');
      }
      
      if (favoritesOnly) {
        reports = reports.filter(report => report.favorite);
      }
    }
    
    // Apply date filtering
    if (dateFilter) {
      const now = new Date();
      let startDateTime, endDateTime;
      
      switch (dateFilter) {
        case 'today':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
          
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
          startOfWeek.setHours(0, 0, 0, 0);
          startDateTime = startOfWeek;
          endDateTime = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
          
        case 'month':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), 1);
          endDateTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
          
        case 'custom':
          if (startDate) {
            startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
          }
          if (endDate) {
            endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
          }
          break;
      }
      
      if (startDateTime || endDateTime) {
        reports = reports.filter(report => {
          if (!report.timestamp) return true; // Keep reports without timestamp
          
          const reportDate = new Date(report.timestamp);
          
          if (startDateTime && reportDate < startDateTime) return false;
          if (endDateTime && reportDate > endDateTime) return false;
          
          return true;
        });
      }
    }
    
    // Apply error status filter (check active filter button)
    const activeFilterBtn = document.querySelector('[id^="reportsFilter"].active');
    if (activeFilterBtn) {
      const filterType = activeFilterBtn.getAttribute('data-filter');
      switch (filterType) {
        case 'correct':
          reports = reports.filter(report => report.isCorrect === true);
          break;
        case 'error':
          reports = reports.filter(report => report.hasErrors === true);
          break;
        case 'unanalyzed':
          reports = reports.filter(report => report.hasErrors === null);
          break;
        case 'youtube':
          reports = reports.filter(report => 
            (report.videoSource && report.videoSource.url && report.videoSource.url.includes('youtube.com')) ||
            (report.originalUrl && report.originalUrl.includes('youtube.com'))
          );
          break;
        // 'all' case - no additional filtering needed
      }
    }
    
    // Update the display with filtered results
    const reportsList = document.getElementById('savedReportsList');
    const reportsEmpty = document.getElementById('savedReportsEmpty');
    const reportsStats = document.getElementById('savedReportsStats');
    
    if (reports.length === 0) {
      if (reportsList) reportsList.innerHTML = '';
      if (reportsEmpty) {
        reportsEmpty.style.display = 'block';
        reportsEmpty.innerHTML = '<p>📝 沒有符合條件的報告</p><p style="color: #666; font-size: 12px;">調整搜尋條件或新增更多AI分析報告</p>';
      }
      if (reportsStats) reportsStats.innerHTML = '<p>📊 找到 0 份報告</p>';
    } else {
      if (reportsEmpty) reportsEmpty.style.display = 'none';
      if (reportsStats) reportsStats.innerHTML = `<p>📊 找到 ${reports.length} 份報告</p>`;
      
      // Reuse the display logic from loadSavedReports
      displayFilteredReports(reports);
    }
    
  } catch (error) {
    console.error('Error filtering saved reports:', error);
  }
}

// Display filtered reports (extracted from loadSavedReports)
function displayFilteredReports(reports) {
  const reportsList = document.getElementById('savedReportsList');
  if (!reportsList) return;
  
  // Use the same HTML generation logic as in loadSavedReports
  reportsList.innerHTML = reports.map(report => {
    const truncatedAnalysis = typeof report.analysisData === 'string' 
      ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
      : (report.analysisData && report.analysisData.content 
          ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
          : 'No analysis preview available');
    
    return `
      <div class="saved-report-item" data-report-id="${report.id}">
        <div class="saved-report-header">
          <div class="report-main-info">
            <span class="report-text">${report.searchText}</span>
            <div class="report-badges">
              <span class="report-language">${languageNames[report.language] || (report.language || '').toUpperCase()}</span>
              ${report.favorite ? '<span class="favorite-badge">⭐ 最愛</span>' : ''}
              ${report.audioData || report.audioInIndexedDB ? `<span class="audio-badge" data-report-id="${report.id}" style="cursor: pointer;" title="點擊播放語音">🔊 語音</span>` : ''}
            </div>
          </div>
          <div class="report-actions">
            <button class="report-action-btn favorite-btn ${report.favorite ? 'active' : ''}" data-id="${report.id}" title="${report.favorite ? '取消最愛' : '加入最愛'}">
              ${report.favorite ? '⭐' : '☆'}
            </button>
            <button class="report-action-btn delete-btn" data-id="${report.id}" title="刪除報告">
              🗑️
            </button>
          </div>
        </div>
        <div class="report-meta">
          <span class="report-date">📅 ${new Date(report.timestamp).toLocaleDateString('zh-TW')} ${new Date(report.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
          ${report.tags && report.tags.length > 0 ? `<span class="report-tags">🏷️ ${report.tags.join(', ')}</span>` : ''}
        </div>
        <div class="report-preview">
          <div class="preview-text">${truncatedAnalysis}</div>
          <button class="preview-expand" data-expanded="false">展開</button>
        </div>
      </div>`;
  }).join('');
  
  // Re-add event listeners (same logic as in loadSavedReports)
  reportsList.querySelectorAll('.saved-report-item').forEach(item => {
    const reportId = item.dataset.reportId;
    
    // Main item click (view report)
    const mainArea = item.querySelector('.report-main-info');
    if (mainArea) {
      mainArea.addEventListener('click', () => {
        viewSavedReport(reportId);
      });
      mainArea.style.cursor = 'pointer';
    }
    
    // Favorite button
    const favoriteBtn = item.querySelector('.favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const newFavoriteState = await toggleFavoriteReport(reportId);
          favoriteBtn.classList.toggle('active', newFavoriteState);
          favoriteBtn.textContent = newFavoriteState ? '⭐' : '☆';
          favoriteBtn.title = newFavoriteState ? '取消最愛' : '加入最愛';
          
          const favoriteBadge = item.querySelector('.favorite-badge');
          const reportBadges = item.querySelector('.report-badges');
          if (newFavoriteState && !favoriteBadge) {
            reportBadges.insertAdjacentHTML('beforeend', '<span class="favorite-badge">⭐ 最愛</span>');
          } else if (!newFavoriteState && favoriteBadge) {
            favoriteBadge.remove();
          }
          
          // Re-filter if favorites-only is enabled
          if (document.getElementById('favoritesOnlyFilter')?.checked) {
            setTimeout(filterSavedReports, 100);
          }
        } catch (error) {
          console.error('Failed to toggle favorite:', error);
        }
      });
    }
    
    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const reportText = item.querySelector('.report-text').textContent;
        if (confirm(`確定要刪除「${reportText}」的分析報告嗎？`)) {
          try {
            const success = await deleteSavedReport(reportId);
            if (success) {
              filterSavedReports(); // Refresh the filtered view
            }
          } catch (error) {
            console.error('Failed to delete report:', error);
            alert('刪除失敗');
          }
        }
      });
    }
    
    // Preview expand button (same logic as before)
    const expandBtn = item.querySelector('.preview-expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const previewText = item.querySelector('.preview-text');
        const report = reports.find(r => r.id === reportId);
        const isExpanded = expandBtn.dataset.expanded === 'true';
        
        if (!isExpanded) {
          const fullAnalysis = typeof report.analysisData === 'string' 
            ? report.analysisData 
            : (report.analysisData && report.analysisData.content 
                ? report.analysisData.content 
                : 'No analysis available');
          
          // 使用 formatAIAnalysis 來格式化完整分析內容 (小字體)
          const formattedAnalysis = formatAIAnalysis(fullAnalysis, 'saved-tab');
          if (window.SecurityFixes) {
            window.SecurityFixes.safeSetHTML(previewText, formattedAnalysis);
          } else {
            previewText.innerHTML = formattedAnalysis;
          }
          expandBtn.textContent = '收合';
          expandBtn.dataset.expanded = 'true';
        } else {
          const truncatedAnalysis = typeof report.analysisData === 'string' 
            ? report.analysisData.substring(0, 150) + (report.analysisData.length > 150 ? '...' : '')
            : (report.analysisData && report.analysisData.content 
                ? report.analysisData.content.substring(0, 150) + (report.analysisData.content.length > 150 ? '...' : '')
                : 'No analysis preview available');
          previewText.textContent = truncatedAnalysis;
          expandBtn.textContent = '展開';
          expandBtn.dataset.expanded = 'false';
        }
      });
    }
  });
}

// Export saved reports functionality with multiple formats - respects current filters
async function exportSavedReports(format = 'json') {
  try {
    // Get reports that match current filters
    let reports = await getCurrentlyFilteredReports();
    
    if (reports.length === 0) {
      // Check if no reports exist or just filtered out
      const allReports = await getAllReports();
      if (allReports.length === 0) {
        alert('沒有可匯出的報告');
      } else {
        alert(`目前的篩選條件沒有符合的報告。所有報告: ${allReports.length}，符合條件: 0`);
      }
      return;
    }
    
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Add filter info to export
    const filterInfo = getCurrentFilterInfo();
    console.log(`Exporting ${reports.length} reports (${filterInfo}) in ${format} format`);
    
    switch (format) {
      case 'markdown':
        await exportMarkdown(reports, dateStr, filterInfo);
        break;
      case 'heptabase':
        await exportHeptabase(reports, dateStr, filterInfo);
        break;
      case 'obsidian':
        await exportObsidian(reports, dateStr, filterInfo);
        break;
      case 'notion':
        await exportNotion(reports, dateStr, filterInfo);
        break;
      case 'notion-api':
        await exportNotionAPI(reports, dateStr, filterInfo);
        break;
      case 'email':
        await exportEmail(reports, dateStr, filterInfo);
        break;
      case 'json':
      default:
        await exportJSON(reports, dateStr, filterInfo);
        break;
    }
    
    console.log(`Successfully exported ${reports.length} reports in ${format} format`);
    
    // Show success message with filter info
    const message = `匯出完成！\n格式: ${format.toUpperCase()}\n報告數量: ${reports.length}\n篩選條件: ${filterInfo}`;
    alert(message);
    
  } catch (error) {
    console.error('Export failed:', error);
    alert(`匯出失敗: ${error.message}`);
  }
}

// Get currently filtered reports based on UI state
async function getCurrentlyFilteredReports() {
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const dateFilter = document.getElementById('savedReportsDateFilter')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  try {
    let reports = [];
    
    if (storageManager && typeof storageManager.getAIReports === 'function') {
      // Use the storage manager's built-in filtering
      const filter = {};
      if (languageFilter) filter.language = languageFilter;
      if (searchQuery) filter.searchText = searchQuery;
      if (favoritesOnly) filter.favorites = true;
      
      reports = await storageManager.getAIReports(filter);
    } else {
      // Fallback: get all reports and filter manually
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['aiReports'], (data) => {
          resolve(data.aiReports || []);
        });
      });
      
      reports = result;
      
      // Apply filters manually
      if (searchQuery) {
        reports = reports.filter(report => 
          report.searchText.toLowerCase().includes(searchQuery) ||
          (report.tags && report.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
        );
      }
      
      if (languageFilter) {
        reports = reports.filter(report => report.language === languageFilter);
      }
      
      if (tagFilter) {
        console.log('🔍 DETAILED TAG FILTER DEBUG:');
        console.log('  Filter value:', `"${tagFilter}"`);
        console.log('  Total reports before filtering:', reports.length);
        
        // Check what tags actually exist in reports
        const allFoundTags = [];
        reports.forEach(report => {
          if (report.tags && Array.isArray(report.tags)) {
            report.tags.forEach(tag => allFoundTags.push(`"${tag}"`));
          }
        });
        console.log('  All tags found in reports:', allFoundTags);
        
        const filteredReports = reports.filter(report => {
          console.log(`\n  📋 Checking report: "${report.searchText}"`);
          console.log(`    Report tags:`, report.tags);
          console.log(`    Has tags array:`, report.tags && Array.isArray(report.tags));
          
          if (!report.tags || !Array.isArray(report.tags)) {
            console.log(`    ❌ No valid tags array`);
            return false;
          }
          
          const matches = report.tags.some(tag => {
            console.log(`    🏷️ Comparing tag: "${tag}"`);
            if (!tag) {
              console.log(`      ❌ Tag is null/undefined`);
              return false;
            }
            const cleanTag = tag.trim().toLowerCase();
            const cleanFilter = tagFilter.trim().toLowerCase();
            const isMatch = cleanTag === cleanFilter;
            console.log(`      Clean tag: "${cleanTag}"`);
            console.log(`      Clean filter: "${cleanFilter}"`);
            console.log(`      Match: ${isMatch}`);
            return isMatch;
          });
          
          console.log(`    Final result for "${report.searchText}": ${matches}`);
          return matches;
        });
        
        reports = filteredReports;
        console.log(`\n  ✅ Final filtered count: ${reports.length}`);
        console.log('  END TAG FILTER DEBUG\n');
      }
      
      if (favoritesOnly) {
        reports = reports.filter(report => report.favorite);
      }
    }
    
    // Apply date filtering
    if (dateFilter) {
      const now = new Date();
      let startDateTime, endDateTime;
      
      switch (dateFilter) {
        case 'today':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
          
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
          startOfWeek.setHours(0, 0, 0, 0);
          startDateTime = startOfWeek;
          endDateTime = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
          
        case 'month':
          startDateTime = new Date(now.getFullYear(), now.getMonth(), 1);
          endDateTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
          
        case 'custom':
          if (startDate) {
            startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
          }
          if (endDate) {
            endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
          }
          break;
      }
      
      if (startDateTime || endDateTime) {
        reports = reports.filter(report => {
          if (!report.timestamp) return true; // Keep reports without timestamp
          
          const reportDate = new Date(report.timestamp);
          
          if (startDateTime && reportDate < startDateTime) return false;
          if (endDateTime && reportDate > endDateTime) return false;
          
          return true;
        });
      }
    }
    
    return reports;
    
  } catch (error) {
    console.error('Error getting filtered reports:', error);
    return [];
  }
}

// Get all reports without filters
async function getAllReports() {
  if (storageManager && typeof storageManager.getAIReports === 'function') {
    return await storageManager.getAIReports();
  } else {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['aiReports'], (data) => {
        resolve(data.aiReports || []);
      });
    });
    return result;
  }
}

// Get current filter information for display
function getCurrentFilterInfo() {
  const searchQuery = document.getElementById('savedReportsSearchInput')?.value.trim() || '';
  const languageFilter = document.getElementById('savedReportsLanguageFilter')?.value || '';
  const tagFilter = document.getElementById('savedReportsTagFilter')?.value || '';
  const dateFilter = document.getElementById('savedReportsDateFilter')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';
  const favoritesOnly = document.getElementById('favoritesOnlyFilter')?.checked || false;
  
  const filters = [];
  
  if (searchQuery) {
    filters.push(`搜尋: "${searchQuery}"`);
  }
  
  if (languageFilter) {
    const languageName = languageNames[languageFilter] || languageFilter;
    filters.push(`語言: ${languageName}`);
  }
  
  if (tagFilter) {
    filters.push(`標籤: #${tagFilter}`);
  }
  
  if (dateFilter) {
    switch (dateFilter) {
      case 'today':
        filters.push('日期: 今天');
        break;
      case 'week':
        filters.push('日期: 本週');
        break;
      case 'month':
        filters.push('日期: 本月');
        break;
      case 'custom':
        if (startDate && endDate) {
          filters.push(`日期: ${startDate} 到 ${endDate}`);
        } else if (startDate) {
          filters.push(`日期: 從 ${startDate}`);
        } else if (endDate) {
          filters.push(`日期: 到 ${endDate}`);
        }
        break;
    }
  }
  
  if (favoritesOnly) {
    filters.push('僅最愛');
  }
  
  return filters.length > 0 ? filters.join(', ') : '全部報告';
}

// Export functions for different formats - with filter info
async function exportMarkdown(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const markdown = ExportTemplates.generateMarkdown(reports, filterInfo);
  const filename = getFilteredFilename('youglish-vocabulary', dateStr, filterInfo, 'md');
  
  downloadFile(markdown, filename, 'text/markdown');
}

async function exportHeptabase(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const heptabaseMarkdown = ExportTemplates.generateHeptabase(reports, filterInfo);
  const filename = getFilteredFilename('youglish-heptabase-whiteboard', dateStr, filterInfo, 'md');
  
  // Download as a single Markdown file optimized for Heptabase import
  downloadFile(
    heptabaseMarkdown, 
    filename,
    'text/markdown'
  );
}

async function exportObsidian(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const obsidianFiles = ExportTemplates.generateObsidian(reports, filterInfo);
  
  // Create a zip file with all the markdown files
  const zip = await createZipFile(obsidianFiles);
  const filename = getFilteredFilename('youglish-obsidian-vault', dateStr, filterInfo, 'zip');
  
  downloadBlob(zip, filename);
}

async function exportNotion(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const notionData = ExportTemplates.generateNotion(reports, filterInfo);
  
  // Create a CSV file that can be imported into Notion
  const csvContent = convertNotionToCSV(notionData);
  const csvFilename = getFilteredFilename('youglish-notion', dateStr, filterInfo, 'csv');
  
  downloadFile(csvContent, csvFilename, 'text/csv');
  
  // Also provide JSON version with instructions
  const jsonWithInstructions = {
    instructions: "Import the CSV file into Notion, or use this JSON data to create a database manually",
    exportInfo: {
      date: dateStr,
      filters: filterInfo,
      count: reports.length
    },
    ...notionData
  };
  
  const jsonFilename = getFilteredFilename('youglish-notion', dateStr, filterInfo, 'json');
  downloadFile(
    JSON.stringify(jsonWithInstructions, null, 2),
    jsonFilename,
    'application/json'
  );
}

async function exportJSON(reports, dateStr, filterInfo = '全部報告') {
  // Create export data with filter information
  const exportData = {
    exportInfo: {
      date: dateStr,
      filters: filterInfo,
      count: reports.length,
      exportedAt: new Date().toISOString()
    },
    reports: reports.map(report => ({
      searchText: report.searchText,
      language: report.language,
      timestamp: new Date(report.timestamp).toISOString(),
      favorite: report.favorite || false,
      tags: report.tags || [],
      analysis: typeof report.analysisData === 'string' ? report.analysisData : 
                (report.analysisData?.content || 'No analysis available'),
      hasAudio: !!report.audioData
    }))
  };
  
  const filename = getFilteredFilename('youglish-reports', dateStr, filterInfo, 'json');
  downloadFile(
    JSON.stringify(exportData, null, 2),
    filename,
    'application/json'
  );
}

// Email export - opens email client with vocabulary content
async function exportEmail(reports, dateStr, filterInfo = '全部報告') {
  if (typeof ExportTemplates === 'undefined') {
    throw new Error('Export templates not loaded');
  }
  
  const emailData = ExportTemplates.generateEmail(reports, filterInfo);
  
  // Create mailto link with pre-filled email containing vocabulary
  const encodedSubject = encodeURIComponent(emailData.subject);
  const encodedBody = encodeURIComponent(emailData.body);
  
  // Check if body is too long for mailto (most email clients have ~8000 char limit for URLs, but we'll be conservative)
  if (encodedBody.length > 6000) {
    // If too long, show dialog to choose what to do
    const choice = prompt(
      `📧 Your vocabulary export has ${reports.length} words and is quite large.\n\n` +
      `Choose an option:\n` +
      `1 - Open email with truncated content + download full file\n` +
      `2 - Try to send full content in email (may not work in all email clients)\n` +
      `3 - Copy full vocabulary content to clipboard\n\n` +
      `Enter 1, 2, or 3:`,
      '1'
    );
    
    if (choice === '1') {
      // Option 1: Truncated email + download full file
      const maxBodyLength = 5000; // Leave some room for encoding
      let trimmedBody = emailData.body;
      
      if (emailData.body.length > maxBodyLength) {
        // Find a good cut-off point (end of a word entry)
        trimmedBody = emailData.body.substring(0, maxBodyLength);
        const lastNewline = trimmedBody.lastIndexOf('\n\n');
        if (lastNewline > 0) {
          trimmedBody = trimmedBody.substring(0, lastNewline);
        }
        trimmedBody += '\n\n... [Content truncated - full vocabulary list downloaded as text file] ...\n';
      }
      
      const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodeURIComponent(trimmedBody)}`;
      
      // Download the full content as a text file
      const filename = `youglish-vocabulary-${dateStr.replace(/\s+/g, '-').toLowerCase()}.txt`;
      downloadFile(
        emailData.body,
        filename,
        'text/plain'
      );
      
      // Open email client
      window.open(mailtoLink);
      
      showMessage('📧 Email opened with summary. Full vocabulary downloaded as text file!', 'success');
    } else if (choice === '2') {
      // Option 2: Try to send full content in email
      const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
      window.open(mailtoLink);
      showMessage('📧 Email opened with full vocabulary content! (May be truncated by email client)', 'success');
    } else if (choice === '3') {
      // Option 3: Copy to clipboard
      navigator.clipboard.writeText(emailData.body).then(() => {
        showMessage('📋 Vocabulary content copied to clipboard! You can paste it into any email.', 'success');
      }).catch(err => {
        // Fallback: download as text file
        downloadFile(emailData.body, 'vocabulary-email-content.txt', 'text/plain');
        showMessage('📄 Vocabulary content downloaded as text file!', 'success');
      });
    }
  } else {
    // Content is short enough for direct email
    const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
    window.open(mailtoLink);
    showMessage('📧 Email opened with your vocabulary content!', 'success');
  }
}

// Notion API export - direct integration with Notion
async function exportNotionAPI(reports, dateStr, filterInfo = '全部報告') {
  if (!window.notionIntegration) {
    window.notionIntegration = new NotionIntegration();
  }

  const notion = window.notionIntegration;
  
  // Check if Notion is configured
  const isConfigured = await notion.initialize();
  
  if (!isConfigured) {
    // Show configuration dialog
    await notion.showConfigDialog();
    
    // Check again after configuration
    const isNowConfigured = await notion.initialize();
    if (!isNowConfigured) {
      showMessage('Notion integration not configured', 'warning');
      return;
    }
  }

  // Show progress dialog
  const progressDialog = document.createElement('div');
  progressDialog.className = 'export-progress-dialog';
  progressDialog.innerHTML = `
    <div class="progress-content">
      <h3>📄 Exporting to Notion...</h3>
      <div class="progress-bar">
        <div class="progress-fill" id="notion-progress-fill" style="width: 0%"></div>
      </div>
      <p id="notion-progress-text">Preparing export...</p>
      <button id="cancel-notion-export" style="display: none;">Cancel</button>
    </div>
  `;
  
  // Add progress dialog styles
  if (!document.getElementById('export-progress-styles')) {
    const styles = document.createElement('style');
    styles.id = 'export-progress-styles';
    styles.textContent = `
      .export-progress-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        padding: 24px;
        z-index: 1001;
        min-width: 300px;
      }
      .progress-content h3 {
        margin: 0 0 16px 0;
        color: #333;
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .progress-fill {
        height: 100%;
        background: #1a73e8;
        transition: width 0.3s ease;
      }
      #notion-progress-text {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 14px;
      }
      #cancel-notion-export {
        background: #f44336;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(styles);
  }
  
  document.body.appendChild(progressDialog);

  try {
    // Update progress
    progressDialog.querySelector('#notion-progress-text').textContent = `Exporting ${reports.length} words to Notion...`;
    
    // Export to Notion
    const results = await notion.exportToNotion(reports);
    
    // Remove progress dialog
    progressDialog.remove();
    
    // Show results
    let message = '';
    if (results.success > 0 && results.failed === 0) {
      message = `✅ Successfully exported ${results.success} words to Notion!`;
      showMessage(message, 'success');
    } else if (results.success > 0 && results.failed > 0) {
      message = `⚠️ Exported ${results.success} words, ${results.failed} failed.\n\nErrors:\n${results.errors.slice(0, 3).join('\n')}`;
      alert(message);
    } else {
      message = `❌ Export failed. ${results.errors[0] || 'Unknown error'}`;
      alert(message);
    }
    
  } catch (error) {
    progressDialog.remove();
    console.error('Notion export failed:', error);
    
    if (error.message.includes('No database selected')) {
      // Show configuration dialog
      await notion.showConfigDialog();
    } else {
      alert(`❌ Export failed: ${error.message}`);
    }
  }
}

// Sync filtered reports to Notion (direct button)
async function syncFilteredReportsToNotion() {
  try {
    // Get currently filtered reports
    const reports = await getCurrentlyFilteredReports();
    
    if (reports.length === 0) {
      showMessage('沒有可同步的報告', 'warning');
      return;
    }

    // Disable button during sync
    const syncBtn = document.getElementById('syncToNotionBtn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = '🔄 同步中...';
    }

    // Use the existing Notion export function
    const dateStr = new Date().toISOString().split('T')[0];
    const filterInfo = getCurrentFilterInfo();
    
    await exportNotionAPI(reports, dateStr, filterInfo);

  } catch (error) {
    console.error('Notion sync failed:', error);
    showMessage('同步到 Notion 失敗', 'error');
  } finally {
    // Re-enable button
    const syncBtn = document.getElementById('syncToNotionBtn');
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = '📄 Sync to Notion';
    }
  }
}

// Generate filename that reflects current filters
function getFilteredFilename(baseName, dateStr, filterInfo, extension) {
  let filename = `${baseName}-${dateStr}`;
  
  // Add filter info to filename if not all reports
  if (filterInfo !== '全部報告') {
    const filterSlug = filterInfo
      .replace(/搜尋: "([^"]+)"/g, 'search-$1')
      .replace(/語言: ([^,]+)/g, 'lang-$1')
      .replace(/僅最愛/g, 'favorites')
      .replace(/[^\w\-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    
    if (filterSlug) {
      filename += `-${filterSlug}`;
    }
  }
  
  return `${filename}.${extension}`;
}

// Helper functions
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function createZipFile(files) {
  // Simple zip creation using the built-in compression
  // For a more robust solution, you'd want to use a library like JSZip
  const zipContent = files.map(file => 
    `=== ${file.filename} ===\n${file.content}\n\n`
  ).join('');
  
  return new Blob([zipContent], { type: 'text/plain' });
}

function convertNotionToCSV(notionData) {
  const headers = Object.keys(notionData.database.properties).join(',');
  const rows = notionData.rows.map(row => {
    return Object.values(row).map(value => {
      if (typeof value === 'string') {
        // Escape quotes and wrap in quotes if contains comma/quotes
        return value.includes(',') || value.includes('"') ? 
               `"${value.replace(/"/g, '""')}"` : value;
      } else if (Array.isArray(value)) {
        return `"${value.join('; ')}"`;
      } else {
        return String(value);
      }
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

// Filter history view based on search and language filters
async function filterHistoryView() {
  const searchQuery = document.getElementById('historySearchInput')?.value.trim().toLowerCase() || '';
  const languageFilter = document.getElementById('historyLanguageFilter')?.value || '';
  
  console.log('Filtering history:', { searchQuery, languageFilter });
  
  try {
    if (searchQuery) {
      // Use HistoryManager's search functionality
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'searchHistory', 
          query: searchQuery, 
          language: languageFilter || null 
        }, resolve);
      });
      
      if (response && response.success) {
        displayHistoryItems(response.results || []);
      } else {
        console.error('Search failed:', response?.error);
      }
    } else {
      // No search query, load all history and filter by language if needed
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getHistory' }, resolve);
      });
      
      if (response && response.success) {
        let history = response.history || [];
        
        // Apply language filter if specified
        if (languageFilter) {
          history = history.filter(item => item.language === languageFilter);
        }
        
        // Apply error status filter (check active filter button)
        const activeFilterBtn = document.querySelector('.history-filters .filter-btn.active');
        if (activeFilterBtn) {
          const filterType = activeFilterBtn.getAttribute('data-filter');
          switch (filterType) {
            case 'correct':
              history = history.filter(item => item.isCorrect === true);
              break;
            case 'error':
              history = history.filter(item => item.hasErrors === true);
              break;
            case 'unanalyzed':
              history = history.filter(item => item.hasErrors === null);
              break;
            case 'youtube':
              history = history.filter(item => 
                (item.videoSource && item.videoSource.url && item.videoSource.url.includes('youtube.com')) ||
                (item.url && item.url.includes('youtube.com'))
              );
              break;
            // 'all' case - no additional filtering needed
          }
        }
        
        displayHistoryItems(history);
      }
    }
  } catch (error) {
    console.error('Error filtering history:', error);
  }
}

// Manual search function
function performManualSearch() {
  const manualSearchInput = document.getElementById('manualSearchInput');
  if (!manualSearchInput) {
    console.error('Manual search input not found');
    return;
  }
  
  const text = manualSearchInput.value.trim();
  
  if (!text) {
    alert('請輸入要搜尋的文字');
    return;
  }
  
  // Get selected language from dropdown
  const manualLanguageSelect = document.getElementById('manualLanguageSelect');
  const selectedLanguage = manualLanguageSelect ? manualLanguageSelect.value : 'english';
  
  console.log('Performing manual search for:', text, 'in language:', selectedLanguage);
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'manualSearch',
    text: text,
    language: selectedLanguage
  }, (response) => {
    if (response && response.success) {
      manualSearchInput.value = '';
      console.log('Manual search successful');
    } else {
      console.error('Manual search failed:', response?.error);
      alert('搜尋失敗，請稍後再試');
    }
  });
}

// Make performManualSearch globally accessible for transcript capture
window.performManualSearch = performManualSearch;

// ================================
// AUDIO SEARCH FUNCTIONALITY
// ================================

let audioSearchService = null;

// Initialize audio search
function initializeAudioSearch() {
  if (typeof AudioSearchService === 'undefined') {
    console.warn('⚠️ AudioSearchService not loaded');
    return;
  }

  audioSearchService = new AudioSearchService();
  console.log('🎤 Audio search initialized');

  // Add event listeners
  const audioSearchBtn = document.getElementById('audioSearchBtn');
  const audioSettingsModal = document.getElementById('audioSettingsModal');
  const closeAudioSettings = document.getElementById('closeAudioSettings');
  const cancelAudioSettings = document.getElementById('cancelAudioSettings');
  const saveAudioSettings = document.getElementById('saveAudioSettings');
  const audioProvider = document.getElementById('audioProvider');

  if (audioSearchBtn) {
    audioSearchBtn.addEventListener('click', handleAudioSearchClick);
    
    // Right-click to open settings
    audioSearchBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showAudioSettings();
    });
  }
  
  // Audio settings button
  const audioSettingsBtn = document.getElementById('audioSettingsBtn');
  if (audioSettingsBtn) {
    audioSettingsBtn.addEventListener('click', showAudioSettings);
  }

  if (closeAudioSettings) {
    closeAudioSettings.addEventListener('click', hideAudioSettings);
  }

  if (cancelAudioSettings) {
    cancelAudioSettings.addEventListener('click', hideAudioSettings);
  }

  if (saveAudioSettings) {
    saveAudioSettings.addEventListener('click', saveAudioSettingsAndClose);
  }

  if (audioProvider) {
    audioProvider.addEventListener('change', toggleWhisperApiField);
  }

  // Load saved settings
  loadAudioSettings();
}

// Handle audio search button click
async function handleAudioSearchClick() {
  if (!audioSearchService) {
    console.error('❌ Audio search service not initialized');
    return;
  }

  const btn = document.getElementById('audioSearchBtn');
  const manualSearchInput = document.getElementById('manualSearchInput');

  if (audioSearchService.isRecording) {
    // Stop recording
    audioSearchService.stopVoiceSearch();
    updateAudioSearchButton('idle');
    showAudioStatus('🛑 Recording stopped', 'info');
  } else {
    // Start recording
    try {
      updateAudioSearchButton('recording');
      
      await audioSearchService.startVoiceSearch(
        // onResult
        (result) => {
          console.log('🎤 Voice search result:', result);
          
          if (result.text) {
            // Fill the search input with the recognized text
            if (manualSearchInput) {
              manualSearchInput.value = result.text;
            }
            
            // Auto-perform search if text is recognized
            performManualSearch();
            
            showAudioStatus(`✅ Recognized: "${result.text}"`, 'success');
          } else {
            showAudioStatus('❌ No speech recognized', 'error');
          }
          
          updateAudioSearchButton('idle');
        },
        // onError
        (error) => {
          console.error('❌ Voice search error:', error);
          showAudioStatus(`❌ ${error}`, 'error');
          updateAudioSearchButton('idle');
        },
        // onStatusUpdate
        (status) => {
          showAudioStatus(status, 'info');
        }
      );
    } catch (error) {
      console.error('❌ Failed to start voice search:', error);
      showAudioStatus(`❌ ${error.message}`, 'error');
      updateAudioSearchButton('idle');
    }
  }
}

// Update audio search button state
function updateAudioSearchButton(state) {
  const btn = document.getElementById('audioSearchBtn');
  if (!btn) return;

  btn.classList.remove('recording', 'processing');
  
  switch (state) {
    case 'recording':
      btn.classList.add('recording');
      btn.textContent = '🛑';
      btn.title = 'Stop Recording (Click to stop)';
      btn.disabled = false;
      break;
    case 'processing':
      btn.classList.add('processing');
      btn.textContent = '⏳';
      btn.title = 'Processing...';
      btn.disabled = true;
      break;
    case 'idle':
    default:
      btn.textContent = '🎤';
      btn.title = 'Voice Search (Click to speak, right-click for settings)';
      btn.disabled = false;
      break;
  }
}

// Show audio search status
function showAudioStatus(message, type = 'info') {
  const statusDiv = document.getElementById('audioSearchStatus');
  const statusText = document.getElementById('audioStatusText');
  
  if (!statusDiv || !statusText) return;

  statusText.textContent = message;
  statusDiv.className = `audio-search-status show ${type}`;
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

// Show audio settings modal
function showAudioSettings() {
  const modal = document.getElementById('audioSettingsModal');
  if (modal) {
    modal.classList.add('show');
  }
}

// Hide audio settings modal
function hideAudioSettings() {
  const modal = document.getElementById('audioSettingsModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Toggle Whisper API key field visibility
function toggleWhisperApiField() {
  const provider = document.getElementById('audioProvider');
  const whisperGroup = document.getElementById('whisperApiGroup');
  
  if (provider && whisperGroup) {
    whisperGroup.style.display = provider.value === 'whisper' ? 'block' : 'none';
  }
}

// Load audio settings from storage
async function loadAudioSettings() {
  if (!audioSearchService) return;

  await audioSearchService.loadSettings();
  
  // Update UI with loaded settings
  const provider = document.getElementById('audioProvider');
  const whisperApiKey = document.getElementById('whisperApiKey');
  const audioLanguage = document.getElementById('audioLanguage');
  const audioQuality = document.getElementById('audioQuality');
  const maxRecordingTime = document.getElementById('maxRecordingTime');

  if (provider) {
    provider.value = audioSearchService.settings.useWhisper ? 'whisper' : 'webSpeech';
    toggleWhisperApiField();
  }

  if (whisperApiKey) {
    whisperApiKey.value = audioSearchService.settings.whisperApiKey;
  }

  if (audioLanguage) {
    audioLanguage.value = audioSearchService.settings.language;
  }

  if (audioQuality) {
    audioQuality.value = audioSearchService.settings.audioQuality;
  }

  if (maxRecordingTime) {
    maxRecordingTime.value = audioSearchService.settings.maxRecordingTime.toString();
  }
}

// Save audio settings and close modal
async function saveAudioSettingsAndClose() {
  if (!audioSearchService) return;

  const provider = document.getElementById('audioProvider');
  const whisperApiKey = document.getElementById('whisperApiKey');
  const audioLanguage = document.getElementById('audioLanguage');
  const audioQuality = document.getElementById('audioQuality');
  const maxRecordingTime = document.getElementById('maxRecordingTime');

  const newSettings = {
    useWhisper: provider ? provider.value === 'whisper' : false,
    whisperApiKey: whisperApiKey ? whisperApiKey.value.trim() : '',
    language: audioLanguage ? audioLanguage.value : 'auto',
    audioQuality: audioQuality ? audioQuality.value : 'medium',
    maxRecordingTime: maxRecordingTime ? parseInt(maxRecordingTime.value) : 30000
  };

  await audioSearchService.saveSettings(newSettings);
  hideAudioSettings();
  showAudioStatus('✅ Settings saved', 'success');
}

// ================================
// ANALYTICS FUNCTIONALITY  
// ================================

// Load analytics view
async function loadAnalyticsView() {
  if (!learningAnalytics) {
    console.error('Learning analytics not initialized');
    showAnalyticsError();
    return;
  }

  try {
    // Initialize flashcard manager if not already done
    if (!window.flashcardManager) {
      if (typeof FlashcardManager !== 'undefined') {
        window.flashcardManager = new FlashcardManager();
        await window.flashcardManager.initialize();
      }
    }

    // Get analytics data using the correct methods
    const insights = learningAnalytics.getInsights();
    const recommendations = learningAnalytics.generateRecommendations();

    console.log('Analytics insights:', insights);
    console.log('Analytics recommendations:', recommendations);

    // Update UI with statistics
    await updateAnalyticsUI(insights, recommendations);

    // Set up refresh button
    const refreshBtn = document.getElementById('refreshAnalyticsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadAnalyticsView());
    }

    // Set up study plan generation
    const generateStudyBtn = document.getElementById('generateStudyBtn');
    if (generateStudyBtn) {
      generateStudyBtn.addEventListener('click', async () => {
        await generatePersonalizedStudyPlan();
      });
    }

    // Set up analytics detail event listeners (CSP compliant)
    // Analytics view removed
    if (analyticsView) {
      // Event delegation for metric cards with data-detail attribute
      analyticsView.addEventListener('click', (e) => {
        const metricCard = e.target.closest('[data-detail]');
        if (metricCard) {
          const detailType = metricCard.getAttribute('data-detail');
          showAnalyticsDetail(detailType);
        }
        
        // Handle audio badges
        const audioBadge = e.target.closest('[data-report-id]');
        if (audioBadge && audioBadge.classList.contains('audio-badge')) {
          const reportId = audioBadge.getAttribute('data-report-id');
          playReportAudio(reportId);
        }
        
        // Handle data-action buttons
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.getAttribute('data-action');
          if (action === 'loadAnalyticsView') {
            loadAnalyticsView();
          }
          // Add other actions as needed
        }
      });
    }

    console.log('Analytics view loaded successfully');
  } catch (error) {
    console.error('Error loading analytics view:', error);
    showAnalyticsError();
  }
}

// Update analytics UI with data
async function updateAnalyticsUI(insights, recommendations) {
  // Get flashcard statistics for comparison
  let flashcardStats = null;
  if (window.flashcardManager) {
    flashcardStats = window.flashcardManager.getStats();
  }

  // Update metrics with clear descriptions and debug info
  const totalVocab = document.getElementById('totalVocab');
  const currentStreak = document.getElementById('currentStreak');
  const retentionRate = document.getElementById('retentionRate');

  // Debug logging
  console.log('📊 Analytics Debug:', {
    insights,
    flashcardStats,
    vocabularySize: insights.totalVocabulary,
    streakCurrent: insights.currentStreak,
    retentionRate: insights.retentionRate
  });

  if (totalVocab) {
    const vocabCount = flashcardStats ? flashcardStats.totalCards : (insights.totalVocabulary || 0);
    totalVocab.textContent = vocabCount;
    
    // Add detail info
    const detail = document.getElementById('totalVocabDetail');
    if (detail && flashcardStats) {
      detail.innerHTML = `新: ${flashcardStats.newCards} | 學習中: ${flashcardStats.learningCards} | 熟練: ${flashcardStats.reviewCards}`;
    }
  }
  
  if (currentStreak) {
    const streakDays = insights.currentStreak || 0;
    currentStreak.textContent = streakDays;
    
    // Add detail info
    const detail = document.getElementById('streakDetail');
    if (detail) {
      if (streakDays === 0) {
        detail.innerHTML = `還未開始學習記錄`;
      } else {
        detail.innerHTML = `最長紀錄: ${insights.longestStreak || streakDays} 天`;
      }
    }
  }
  
  if (retentionRate) {
    const retention = insights.retentionRate || 0;
    retentionRate.textContent = `${retention}%`;
    
    // Add detail info
    const detail = document.getElementById('retentionDetail');
    if (detail) {
      const totalReviews = getTotalReviewCount();
      if (totalReviews === 0) {
        detail.innerHTML = `還未進行複習`;
      } else {
        detail.innerHTML = `總複習次數: ${totalReviews}`;
      }
    }
  }

  // Add additional flashcard-specific metrics
  if (flashcardStats) {
    updateFlashcardMetrics(flashcardStats);
  }

  // Update recommendations with better formatting
  const recommendationsList = document.getElementById('recommendationsList');
  if (recommendationsList && recommendations && recommendations.length > 0) {
    recommendationsList.innerHTML = recommendations.map(rec => `
      <div class="recommendation-item" style="
        display: flex; 
        align-items: flex-start; 
        margin-bottom: 16px; 
        padding: 16px; 
        background: #f8f9fa; 
        border-radius: 8px;
        border-left: 4px solid ${getPriorityColor(rec.priority)};
      ">
        <div class="recommendation-icon" style="font-size: 24px; margin-right: 12px;">
          ${getRecommendationIcon(rec.type)}
        </div>
        <div class="recommendation-content" style="flex: 1;">
          <h5 style="margin: 0 0 8px 0; color: #333;">${rec.title}</h5>
          <p style="margin: 0; color: #666; line-height: 1.4;">${rec.description}</p>
          ${rec.action ? `
            <button class="recommendation-btn" data-action="${rec.action}" style="
              margin-top: 12px; 
              background: #1976d2; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 4px; 
              cursor: pointer;
              font-size: 14px;
            ">${rec.actionText || '開始行動'}</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } else {
    recommendationsList.innerHTML = `
      <div style="text-align: center; padding: 32px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
        <p>繼續學習以獲得個人化建議！</p>
      </div>
    `;
  }
}

// Get total review count for debugging
function getTotalReviewCount() {
  if (!window.flashcardManager || !window.flashcardManager.flashcards) {
    return 0;
  }
  
  return window.flashcardManager.flashcards.reduce((total, card) => {
    return total + (card.reviews || 0);
  }, 0);
}

// Show detailed analytics information
function showAnalyticsDetail(type) {
  let message = '';
  
  if (type === 'cards') {
    const stats = window.flashcardManager ? window.flashcardManager.getStats() : null;
    if (stats) {
      message = `📊 記憶卡詳情：\n\n` +
                `• 總計: ${stats.totalCards} 張\n` +
                `• 新卡片: ${stats.newCards} 張（未學習過）\n` +
                `• 學習中: ${stats.learningCards} 張（正在學習）\n` +
                `• 熟練: ${stats.reviewCards} 張（已掌握）\n` +
                `• 待複習: ${stats.dueCards} 張（需要複習）`;
    } else {
      message = '還沒有記憶卡數據。請先建立一些記憶卡！';
    }
  } else if (type === 'streak') {
    const analytics = learningAnalytics ? learningAnalytics.getInsights() : null;
    if (analytics) {
      message = `🔥 學習連續天數：\n\n` +
                `• 目前連續: ${analytics.currentStreak} 天\n` +
                `• 最長紀錄: ${analytics.longestStreak} 天\n` +
                `• 學習建議: 每天至少學習幾張卡片保持連續記錄`;
    } else {
      message = '還沒有學習記錄。開始學習記憶卡來累積連續天數！';
    }
  } else if (type === 'retention') {
    const totalReviews = getTotalReviewCount();
    const analytics = learningAnalytics ? learningAnalytics.getInsights() : null;
    
    if (totalReviews === 0) {
      message = '📈 複習答對率：\n\n' +
                '還沒有複習記錄。\n\n' +
                '如何累積數據：\n' +
                '1. 建立記憶卡\n' +
                '2. 點擊「開始學習」\n' +
                '3. 在學習時選擇難易度\n' +
                '4. 完成學習後查看統計';
    } else {
      message = `📈 複習答對率：\n\n` +
                `• 答對率: ${analytics ? analytics.retentionRate : 0}%\n` +
                `• 總複習次數: ${totalReviews}\n` +
                `• 學習會話: ${analytics ? analytics.studySessions : 0} 次`;
    }
  }
  
  alert(message);
}

// Update flashcard-specific metrics
function updateFlashcardMetrics(stats) {
  // Add or update additional metric display
  const analyticsOverview = document.querySelector('.analytics-overview');
  if (analyticsOverview) {
    // Check if we already have additional metrics
    let additionalMetrics = document.getElementById('additionalMetrics');
    if (!additionalMetrics) {
      additionalMetrics = document.createElement('div');
      additionalMetrics.id = 'additionalMetrics';
      analyticsOverview.appendChild(additionalMetrics);
    }
    
    additionalMetrics.innerHTML = `
      <div class="metric-card">
        <span class="metric-value">${stats.dueCards || 0}</span>
        <span class="metric-label">待複習</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${stats.newCards || 0}</span>
        <span class="metric-label">新卡片</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${stats.studyProgress || 0}%</span>
        <span class="metric-label">學習進度</span>
      </div>
    `;
  }
}

// Get priority color for recommendations
function getPriorityColor(priority) {
  const colors = {
    'high': '#f44336',
    'medium': '#ff9800',
    'low': '#4caf50'
  };
  return colors[priority] || '#2196f3';
}

// Get icon for recommendation type
function getRecommendationIcon(type) {
  const icons = {
    'schedule': '📅',
    'review': '🔄',
    'focus': '🎯',
    'motivation': '⭐',
    'study': '📚'
  };
  return icons[type] || '💡';
}

// Show analytics error
function showAnalyticsError() {
  // Analytics view removed
  if (analyticsView) {
    analyticsView.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
        <h3>無法載入學習統計</h3>
        <p>學習分析服務目前無法使用。請稍後再試。</p>
        <button data-action="loadAnalyticsView" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 16px;
        ">重新載入</button>
      </div>
    `;
  }
}

// Generate personalized study plan
async function generatePersonalizedStudyPlan() {
  if (!studySessionGenerator) {
    alert('學習計劃生成器未初始化');
    return;
  }

  try {
    const generateBtn = document.getElementById('generateStudyBtn');
    if (generateBtn) {
      generateBtn.textContent = '⏳ 生成中...';
      generateBtn.disabled = true;
    }

    // Generate optimal study session based on user's learning data
    const studySession = await studySessionGenerator.generateOptimalSession({
      duration: 20, // 20 minutes
      sessionType: 'auto', // Let AI choose the best type
      maxWords: 20,
      difficulty: 'adaptive'
    });

    if (studySession && studySession.words && studySession.words.length > 0) {
      // Display the generated study session info
      alert(`🎯 已生成個人化學習計劃！
      
📊 計劃詳情:
• 類型: ${studySession.config.title}
• 單字數量: ${studySession.words.length} 個
• 預估時間: ${studySession.estimatedDuration} 分鐘
• 說明: ${studySession.config.description}

點擊確定開始學習！`);
      
      // Switch to flashcards view and start study
      document.getElementById('showFlashcardsBtn')?.click();
      setTimeout(() => {
        // Start the study session
        startStudyMode();
      }, 500);
    } else {
      alert('目前沒有足夠的數據生成學習計劃。請先添加一些記憶卡。');
    }

  } catch (error) {
    console.error('Error generating study plan:', error);
    alert('學習計劃生成失敗，請稍後再試。');
  } finally {
    const generateBtn = document.getElementById('generateStudyBtn');
    if (generateBtn) {
      generateBtn.textContent = '📚 智能學習計劃';
      generateBtn.disabled = false;
    }
  }
}

// ================================
// FLASHCARDS FUNCTIONALITY
// ================================

// Initialize flashcard manager
let currentStudySession = null;

// Save Audio Setting Management
let saveAudioEnabled = true; // Default to enabled with IndexedDB

async function loadSaveAudioSetting() {
  try {
    if (storageManager && typeof storageManager.getUserSettings === 'function') {
      const settings = await storageManager.getUserSettings();
      saveAudioEnabled = settings.saveAudio !== false; // Default to true
    }
    updateSaveAudioButtonUI();
  } catch (error) {
    console.error('Failed to load save audio setting:', error);
    saveAudioEnabled = true; // Default to enabled
    updateSaveAudioButtonUI();
  }
}

async function toggleSaveAudio() {
  try {
    if (!storageManager || typeof storageManager.updateUserSettings !== 'function') {
      console.error('Storage manager not available');
      return;
    }
    
    saveAudioEnabled = !saveAudioEnabled;
    
    // Update storage manager settings
    await storageManager.updateUserSettings({ saveAudio: saveAudioEnabled });
    
    updateSaveAudioButtonUI();
    console.log('Save audio toggled:', saveAudioEnabled ? 'ON' : 'OFF');
    
    // Show feedback
    showMessage(
      saveAudioEnabled ? '語音儲存已啟用 🔊' : '語音儲存已停用 🔇', 
      'info'
    );
    
  } catch (error) {
    console.error('Failed to toggle save audio:', error);
    // Revert on error
    saveAudioEnabled = !saveAudioEnabled;
    updateSaveAudioButtonUI();
    showMessage('設定更新失敗', 'error');
  }
}

function updateSaveAudioButtonUI() {
  const saveAudioBtn = document.getElementById('saveAudioToggleBtn');
  if (!saveAudioBtn) return;
  
  if (saveAudioEnabled) {
    saveAudioBtn.classList.add('active');
    saveAudioBtn.classList.remove('inactive');
    saveAudioBtn.textContent = '🔊 儲存語音';
    saveAudioBtn.title = '語音會自動儲存到報告中（點擊關閉）';
  } else {
    saveAudioBtn.classList.remove('active');
    saveAudioBtn.classList.add('inactive');
    saveAudioBtn.textContent = '🔇 不存語音';
    saveAudioBtn.title = '語音不會儲存（點擊開啟）';
  }
}

// Initialize flashcard system
window.addEventListener('load', async () => {
  try {
    if (typeof FlashcardManager !== 'undefined') {
      window.flashcardManager = new FlashcardManager();
      await window.flashcardManager.initialize();
      console.log('🃏 Flashcard manager initialized with', window.flashcardManager.flashcards.length, 'cards');
    } else {
      console.error('FlashcardManager class not found');
    }
  } catch (error) {
    console.error('Failed to initialize flashcard manager:', error);
  }
});

// Load flashcards view
async function loadFlashcardsView() {
  if (!window.flashcardManager) {
    console.error('Flashcard manager not initialized');
    return;
  }

  const flashcardsView = document.getElementById('flashcardsView');
  const flashcardsList = document.getElementById('flashcardsList');
  const flashcardsEmpty = document.getElementById('flashcardsEmpty');
  
  if (!flashcardsView || !flashcardsList || !flashcardsEmpty) {
    console.error('Flashcard view elements not found');
    return;
  }

  // Update statistics
  await updateFlashcardStats();

  // Load flashcards and sort by creation date (newest first)
  let flashcards = [...window.flashcardManager.flashcards].sort((a, b) => {
    return (b.created || 0) - (a.created || 0);
  });
  console.log('Loading flashcards:', flashcards.length, 'cards found, sorted by newest first');
  
  // Apply difficulty filter
  const difficultyFilter = document.getElementById('difficultyFilter')?.value || 'all';
  if (difficultyFilter !== 'all') {
    flashcards = filterFlashcardsByDifficulty(flashcards, difficultyFilter);
    console.log('After filtering by difficulty:', flashcards.length, 'cards remaining');
  }
  
  if (flashcards.length === 0) {
    // Show empty state
    flashcardsList.style.display = 'none';
    flashcardsEmpty.style.display = 'block';
    
    // Add event listener for create first card button
    const createFirstCardBtn = document.getElementById('createFirstCardBtn');
    if (createFirstCardBtn) {
      createFirstCardBtn.addEventListener('click', () => showCreateFlashcardDialog());
    }
  } else {
    // Show flashcards list
    flashcardsEmpty.style.display = 'none';
    flashcardsList.style.display = 'block';
    displayFlashcardsList(flashcards);
  }

  // Initialize event listeners
  initializeFlashcardEventListeners();
}

// Update flashcard statistics display
async function updateFlashcardStats() {
  if (!flashcardManager) return;

  const stats = window.flashcardManager.getStats();
  
  const totalCards = document.getElementById('totalCards');
  const studyProgress = document.getElementById('studyProgress');
  const todayReviews = document.getElementById('todayReviews');
  
  if (totalCards) totalCards.textContent = `總卡片: ${stats.totalCards}`;
  if (studyProgress) studyProgress.textContent = `學習進度: ${stats.studyProgress}%`;
  if (todayReviews) todayReviews.textContent = `今日複習: ${stats.todayReviews}`;
}

// Display flashcards list
function displayFlashcardsList(flashcards) {
  const flashcardsList = document.getElementById('flashcardsList');
  if (!flashcardsList) {
    console.error('Flashcards list element not found');
    return;
  }

  if (!flashcards || !Array.isArray(flashcards)) {
    console.error('Invalid flashcards data:', flashcards);
    flashcardsList.innerHTML = '<div class="flashcard-item error">無法載入記憶卡數據</div>';
    return;
  }

  console.log('Rendering flashcards:', flashcards.length, 'cards');

  flashcardsList.innerHTML = flashcards.map((card, index) => {
    try {
    const nextReviewDate = new Date(card.nextReview);
    const isOverdue = nextReviewDate.getTime() < Date.now();
    const difficultyLabels = ['新卡片', '學習中', '複習', '熟練'];
    const difficultyClasses = ['new', 'learning', 'review', 'mature'];
    
    // Ensure difficulty is a valid number
    const cardDifficulty = typeof card.difficulty === 'number' ? card.difficulty : 0;
    const safeDifficulty = Math.max(0, Math.min(3, cardDifficulty)); // Clamp between 0-3
    
    const difficultyClass = difficultyClasses[safeDifficulty];
    const difficultyLabel = difficultyLabels[safeDifficulty];
    
    return `
      <div class="flashcard-item" data-id="${card.id}" style="background: #ffffff !important; color: #333333 !important; border: 2px solid #e8e8e8 !important;">
        <div class="card-difficulty ${difficultyClass}">
          ${difficultyLabel}
        </div>
        
        <div class="flashcard-header">
          <div>
            <div class="card-front-text" style="color: #1565c0 !important;">
              ${card.front || 'No front text'}
              <button class="pronunciation-btn" data-id="${card.id}" title="播放發音">
                🔊
              </button>
            </div>
            <div class="card-back-text" style="color: #424242 !important;">${card.back || 'No translation'}</div>
            ${card.pronunciation ? `<div class="card-pronunciation" style="color: #757575 !important;">[${card.pronunciation}]</div>` : ''}
            ${card.definition ? `<div class="card-definition" style="color: #616161 !important;">${card.definition}</div>` : ''}
          </div>
        </div>
        
        <div class="card-meta" style="color: #666666 !important;">
          <span class="card-language">${languageNames[card.language] || card.language || 'unknown'}</span>
          <span class="card-reviews" style="color: #666666 !important;">
            📊 ${card.reviews || 0} 次複習
          </span>
          <span class="card-next-review ${isOverdue ? 'overdue' : ''}" style="color: #666666 !important;">
            ${isOverdue ? '🔴 需要複習' : `📅 ${nextReviewDate.toLocaleDateString()}`}
          </span>
        </div>
        
        ${card.tags && card.tags.length > 0 ? 
          `<div class="card-tags" style="margin-top: 8px;">
            ${card.tags.map(tag => `<span class="tag-chip" style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 8px; font-size: 10px; margin-right: 4px;">#${tag}</span>`).join('')}
          </div>` : ''
        }
        
        <div class="flashcard-actions">
          <button class="card-action-btn study" data-id="${card.id}" title="學習這張卡片">
            🎯 學習
          </button>
          <button class="card-action-btn edit" data-id="${card.id}" title="編輯卡片">
            ✏️ 編輯
          </button>
          <button class="card-action-btn delete" data-id="${card.id}" title="刪除卡片">
            🗑️ 刪除
          </button>
        </div>
        
        <div class="flashcard-progress-indicator">
          <div class="progress-bar-fill ${difficultyClass}"></div>
        </div>
      </div>
    `;
    } catch (error) {
      console.error(`Error rendering flashcard ${index}:`, error, card);
      return `<div class="flashcard-item error">Error rendering card: ${error.message}</div>`;
    }
  }).join('');

  // Add event listeners to card action buttons
  addFlashcardItemEventListeners();
}

// Filter flashcards by difficulty
function filterFlashcardsByDifficulty(flashcards, difficulty) {
  switch (difficulty) {
    case 'new':
      return flashcards.filter(card => card.difficulty === 0);
    case 'learning':
      return flashcards.filter(card => card.difficulty === 1);
    case 'review':
      return flashcards.filter(card => card.difficulty === 2);
    case 'difficult':
      // Cards that are new or learning (having trouble)
      return flashcards.filter(card => card.difficulty <= 1);
    default:
      return flashcards;
  }
}

// Initialize flashcard event listeners
function initializeFlashcardEventListeners() {
  // Difficulty filter
  const difficultyFilter = document.getElementById('difficultyFilter');
  if (difficultyFilter) {
    difficultyFilter.addEventListener('change', () => {
      loadFlashcardsView(); // Reload with new filter
    });
  }
  
  // Create flashcard button
  const createFlashcardBtn = document.getElementById('createFlashcardBtn');
  if (createFlashcardBtn) {
    createFlashcardBtn.addEventListener('click', () => showCreateFlashcardDialog());
  }

  // Study mode button
  const studyModeBtn = document.getElementById('studyModeBtn');
  if (studyModeBtn) {
    studyModeBtn.addEventListener('click', () => startStudyMode());
  }


  // Study controls in study interface
  initializeStudyInterfaceListeners();
}

// Add event listeners to flashcard items
function addFlashcardItemEventListeners() {
  // Study card buttons
  document.querySelectorAll('.card-action-btn.study').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      studySingleCard(cardId);
    });
  });

  // Edit card buttons
  document.querySelectorAll('.card-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      editFlashcard(cardId);
    });
  });

  // Delete card buttons
  document.querySelectorAll('.card-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      if (confirm('確定要刪除這張記憶卡嗎？')) {
        deleteFlashcard(cardId);
      }
    });
  });

  // Add click handlers for flashcard items (for quick preview)
  document.querySelectorAll('.flashcard-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Only if not clicking on action buttons or pronunciation button
      if (!e.target.closest('.card-action-btn') && !e.target.closest('.pronunciation-btn')) {
        const cardId = item.getAttribute('data-id');
        previewFlashcard(cardId);
      }
    });
  });

  // Add pronunciation button listeners
  document.querySelectorAll('.pronunciation-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-id');
      
      // Show loading state
      const originalText = btn.textContent;
      btn.textContent = '⏳';
      btn.disabled = true;
      
      try {
        const success = await window.flashcardManager.playPronunciation(cardId);
        if (!success) {
          // Show error briefly
          btn.textContent = '❌';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1000);
        } else {
          // Show success briefly
          btn.textContent = '✅';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1000);
        }
      } catch (error) {
        console.error('Error playing pronunciation:', error);
        btn.textContent = '❌';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1000);
      }
    });
  });
}

// Preview flashcard in a modal or expanded view
async function previewFlashcard(cardId) {
  if (!window.flashcardManager) return;
  
  const card = window.flashcardManager.flashcards.find(c => c.id === cardId);
  if (!card) return;
  
  // Create a modal with ONLY inline styles (no CSS classes to avoid conflicts)
  const modal = document.createElement('div');
  // Don't use any CSS classes that might be overridden
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(245, 245, 245, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  `;
  
  const difficultyLabels = ['新卡片', '學習中', '複習', '熟練'];
  const difficultyClasses = ['new', 'learning', 'review', 'mature'];
  const cardDifficulty = typeof card.difficulty === 'number' ? card.difficulty : 0;
  const safeDifficulty = Math.max(0, Math.min(3, cardDifficulty));
  const nextReview = new Date(card.nextReview);
  
  modal.innerHTML = `
    <div style="
      background: #ffffff;
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      border: 3px solid #ddd;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #1976d2; font-size: 18px; font-weight: 600;">記憶卡預覽</h3>
        <button data-action="close" style="
          background: #f5f5f5;
          border: 1px solid #ddd;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          padding: 8px 12px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="color: #1976d2; font-size: 24px; font-weight: 600; margin-bottom: 12px;">
          ${card.front || 'No front text'}
        </div>
        <div style="color: #333; font-size: 18px; font-weight: 500; margin-bottom: 10px;">
          ${card.back || 'No translation'}
        </div>
        ${card.pronunciation ? `<div style="color: #666; font-style: italic; font-family: 'Courier New', monospace; margin-bottom: 8px;">[${card.pronunciation}]</div>` : ''}
        ${card.definition ? `<div style="color: #555; font-size: 14px; margin-bottom: 12px;">${card.definition}</div>` : ''}
      </div>
      
      <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px;">
        <span style="background: #1976d2; color: white; padding: 4px 8px; border-radius: 8px; font-size: 12px;">
          ${languageNames[card.language] || card.language || 'unknown'}
        </span>
        <span style="background: #e8f5e8; color: #2e7d2e; padding: 4px 8px; border-radius: 8px; font-size: 12px;">
          ${difficultyLabels[safeDifficulty]}
        </span>
        <span style="color: #666; font-size: 12px;">📊 ${card.reviews || 0} 次複習</span>
        <span style="color: #666; font-size: 12px;">📅 ${nextReview.toLocaleDateString()}</span>
      </div>
      
      ${card.tags && card.tags.length > 0 ? `
        <div style="margin-bottom: 20px;">
          ${card.tags.map(tag => `
            <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-size: 11px; margin-right: 8px;">
              #${tag}
            </span>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button data-action="study" data-card-id="${card.id}" style="
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">🎯 開始學習</button>
        <button data-action="edit" data-card-id="${card.id}" style="
          background: #4caf50;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">✏️ 編輯</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners without inline handlers
  const closeBtn = modal.querySelector('[data-action="close"]');
  const studyBtn = modal.querySelector('[data-action="study"]');
  const editBtn = modal.querySelector('[data-action="edit"]');
  
  // Close modal handlers
  closeBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // Action button handlers
  studyBtn.addEventListener('click', () => {
    studySingleCard(card.id);
    modal.remove();
  });
  
  editBtn.addEventListener('click', () => {
    editFlashcard(card.id);
    modal.remove();
  });
  
  // ESC key to close
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Initialize study interface listeners
function initializeStudyInterfaceListeners() {
  // Flip card button
  const flipCardBtn = document.getElementById('flipCardBtn');
  if (flipCardBtn) {
    flipCardBtn.addEventListener('click', () => flipCurrentCard());
  }

  // Answer buttons
  ['againBtn', 'hardBtn', 'goodBtn', 'easyBtn'].forEach((btnId, quality) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => processStudyAnswer(quality));
    }
  });

  // Navigation buttons
  const exitStudyBtn = document.getElementById('exitStudyBtn');
  if (exitStudyBtn) {
    exitStudyBtn.addEventListener('click', () => exitStudyMode());
  }

  // Audio play button
  const audioPlayBtn = document.getElementById('audioPlayBtn');
  if (audioPlayBtn) {
    audioPlayBtn.addEventListener('click', () => playCardAudio());
  }
}

// Show create flashcard dialog
function showCreateFlashcardDialog() {
  // Create a simple dialog interface
  const dialog = document.createElement('div');
  dialog.className = 'flashcard-dialog-overlay';
  dialog.innerHTML = `
    <div class="flashcard-dialog">
      <div class="dialog-header">
        <h3>✨ 建立新記憶卡</h3>
        <button class="close-dialog">✕</button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label>單字或問題 *</label>
          <input type="text" id="flashcard-front" placeholder="輸入要記憶的單字或問題" required>
        </div>
        <div class="form-group">
          <label>翻譯或答案 *</label>
          <input type="text" id="flashcard-back" placeholder="輸入翻譯或答案" required>
        </div>
        <div class="form-group">
          <label>發音 (可選)</label>
          <input type="text" id="flashcard-pronunciation" placeholder="例：/həˈloʊ/ 或注音">
        </div>
        <div class="form-group">
          <label>定義說明 (可選)</label>
          <textarea id="flashcard-definition" placeholder="輸入詳細定義或說明"></textarea>
        </div>
        <div class="form-group">
          <label>語言</label>
          <select id="flashcard-language">
            <option value="english">English</option>
            <option value="japanese">Japanese</option>
            <option value="korean">Korean</option>
            <option value="dutch">Dutch</option>
          </select>
        </div>
        <div class="form-group">
          <label>標籤 (用逗號分隔)</label>
          <input type="text" id="flashcard-tags" placeholder="例：vocabulary, important, manual">
        </div>
      </div>
      <div class="dialog-actions">
        <button class="cancel-btn">取消</button>
        <button class="create-btn">建立記憶卡</button>
      </div>
    </div>
  `;

  // Add styles
  if (!document.getElementById('flashcard-dialog-styles')) {
    const styles = document.createElement('style');
    styles.id = 'flashcard-dialog-styles';
    styles.textContent = `
      .flashcard-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .flashcard-dialog {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        max-width: 400px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .dialog-header {
        background: #1a73e8;
        color: white;
        padding: 16px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .dialog-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .close-dialog {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
      }
      .dialog-content {
        padding: 20px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #333;
        font-size: 14px;
      }
      .form-group input, .form-group textarea, .form-group select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
      }
      .form-group textarea {
        height: 60px;
        resize: vertical;
      }
      .dialog-actions {
        padding: 16px 20px 20px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      .dialog-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .cancel-btn {
        background: #f5f5f5;
        color: #666;
      }
      .create-btn {
        background: #1a73e8;
        color: white;
      }
      .create-btn:hover {
        background: #1557b0;
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(dialog);

  // Event listeners
  const closeDialog = () => {
    dialog.remove();
  };

  dialog.querySelector('.close-dialog').addEventListener('click', closeDialog);
  dialog.querySelector('.cancel-btn').addEventListener('click', closeDialog);
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  dialog.querySelector('.create-btn').addEventListener('click', async () => {
    const front = dialog.querySelector('#flashcard-front').value.trim();
    const back = dialog.querySelector('#flashcard-back').value.trim();
    
    if (!front || !back) {
      alert('請輸入必填項目：單字和翻譯');
      return;
    }

    const pronunciation = dialog.querySelector('#flashcard-pronunciation').value.trim();
    const definition = dialog.querySelector('#flashcard-definition').value.trim();
    const language = dialog.querySelector('#flashcard-language').value;
    const tagsInput = dialog.querySelector('#flashcard-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : ['manual'];

    await createFlashcard({
      front: front,
      back: back,
      pronunciation: pronunciation,
      definition: definition,
      language: language,
      tags: tags
    });

    closeDialog();
  });

  // Focus on first input
  setTimeout(() => {
    dialog.querySelector('#flashcard-front').focus();
  }, 100);
}

// Create flashcard (with cached audio support and enhanced protection)
async function createFlashcard(data) {
  console.log('📝 Creating flashcard with data:', {
    front: data.front,
    language: data.language,
    hasAudio: !!data.audioUrl
  });
  
  // Throttling check
  const now = Date.now();
  if (now - lastFlashcardCreationTime > FLASHCARD_COOLDOWN_PERIOD) {
    // Reset counter after cooldown period
    flashcardCreationCount = 0;
  }
  
  if (flashcardCreationCount >= FLASHCARD_CREATION_LIMIT) {
    const remainingTime = Math.ceil((FLASHCARD_COOLDOWN_PERIOD - (now - lastFlashcardCreationTime)) / 1000);
    console.warn(`⚠️ Flashcard creation rate limit reached. Wait ${remainingTime}s`);
    throw new Error(`請等待 ${remainingTime} 秒後再建立記憶卡`);
  }
  
  if (!flashcardManager) {
    console.error('❌ FlashcardManager not available');
    throw new Error('FlashcardManager not available');
  }

  try {
    // Add ultra-aggressive timeout protection (3 seconds)
    const createTimeout = new Promise((_, reject) => {
      setTimeout(() => {
        console.error('⏰ Flashcard creation timeout after 3 seconds');
        performMemoryCleanup(); // Clean up on timeout
        reject(new Error('Flashcard creation timeout'));
      }, 3000); // Ultra-short timeout to prevent freezing
    });

    const createProcess = (async () => {
      // Check if we have cached audio for this word
      const cachedAudio = getCachedAudio(data.front, data.language || 'english');
      if (cachedAudio && cachedAudio.audioUrl) {
        data.audioUrl = cachedAudio.audioUrl;
        console.log('🎯 Added cached audio to flashcard:', data.front);
      }

      console.log('💾 Calling flashcardManager.createFlashcard...');
      const card = await window.flashcardManager.createFlashcard(data);
      console.log('✅ Flashcard created with ID:', card?.id);
      
      return card;
    })();

    const card = await Promise.race([createProcess, createTimeout]);
    
    // Update throttling counters on successful creation
    flashcardCreationCount++;
    lastFlashcardCreationTime = now;
    console.log(`📊 Flashcard creation count: ${flashcardCreationCount}/${FLASHCARD_CREATION_LIMIT}`);
    
    // Immediate memory cleanup after successful creation
    performMemoryCleanup();
    
    // Defer UI updates to prevent blocking
    setTimeout(async () => {
      try {
        // Only refresh view if we're in flashcards view
        const flashcardsView = document.getElementById('flashcardsView');
        if (flashcardsView && flashcardsView.style.display !== 'none') {
          await loadFlashcardsView();
        }
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh flashcards view:', refreshError);
      }
    }, 200);
    
    // Show success message with throttling info
    const remaining = FLASHCARD_CREATION_LIMIT - flashcardCreationCount;
    if (remaining <= 1) {
      showMessage(`記憶卡建立成功！(剩餘 ${remaining} 次)`, 'success');
    } else {
      showMessage('記憶卡建立成功！', 'success');
    }
    
    return card;
    
  } catch (error) {
    console.error('❌ Failed to create flashcard:', error);
    
    if (error.message.includes('timeout')) {
      showMessage('建立記憶卡超時，請重試', 'error');
    } else if (error.message.includes('already exists')) {
      showMessage('記憶卡已存在，無需重複建立', 'warning');
    } else {
      showMessage('建立記憶卡失敗', 'error');
    }
    
    throw error; // Re-throw for calling functions to handle
  }
}

// Create flashcard from current word with safety protection
async function createFlashcardFromCurrentWord() {
  console.log('🃏 Creating flashcard from current word:', currentQueryData?.text);
  
  if (!flashcardManager) {
    console.error('❌ FlashcardManager not available');
    showMessage('記憶卡管理器未就緒', 'error');
    return;
  }
  
  if (!currentQueryData?.text) {
    console.log('⚠️ No current query text available');
    showMessage('沒有當前查詢的單字', 'warning');
    return;
  }

  try {
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Current word flashcard creation timeout')), 8000);
    });

    const createPromise = (async () => {
      // Get translation from quick search if available
      const translation = document.getElementById('quickTranslation')?.textContent || 
                         await getQuickTranslation(currentQueryData.text, currentQueryData.language);
      
      const pronunciation = document.getElementById('quickPronunciation')?.textContent || '';
      const definition = document.getElementById('quickDefinition')?.textContent || '';

      const flashcardData = {
        front: currentQueryData.text,
        back: translation,
        pronunciation: pronunciation,
        definition: definition,
        language: currentQueryData.language,
        tags: ['current-word']
      };

      console.log('📝 Creating flashcard from current word with data:', flashcardData);
      return await createFlashcard(flashcardData);
    })();

    await Promise.race([createPromise, timeoutPromise]);
    console.log('✅ Current word flashcard created successfully');
    
  } catch (error) {
    console.error('❌ Failed to create flashcard from current word:', error);
    if (error.message.includes('timeout')) {
      showMessage('建立記憶卡超時，請重試', 'error');
    } else if (error.message.includes('already exists')) {
      showMessage('此單字的記憶卡已存在', 'warning');
    } else {
      showMessage('建立記憶卡失敗', 'error');
    }
  }
}

// Aggressive memory cleanup functions
function performMemoryCleanup() {
  console.log('🧹 Performing aggressive memory cleanup...');
  
  try {
    // 🚨 EMERGENCY: Much more aggressive audio cache cleanup
    if (window.audioCache.size > 3) { // Reduced from 10 to 3
      console.log(`🚨 EMERGENCY: Audio cache too large - forcing cleanup of ${window.audioCache.size} items`);
      window.audioCache.forEach((audioData, key) => {
        try {
          if (audioData && audioData.blobUrl && audioData.blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioData.blobUrl);
          }
          if (audioData && audioData.audioUrl && audioData.audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioData.audioUrl);
          }
        } catch (e) {
          console.warn('Failed to revoke audio URL:', e);
        }
      });
      window.audioCache.clear();
      console.log('✅ Emergency audio cache cleanup completed');
    }
    
    // Clear temporary DOM elements
    const tempElements = document.querySelectorAll('[data-temp="true"]');
    tempElements.forEach(el => el.remove());
    
    // Clear any hanging audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      if (audio.src && audio.src.startsWith('blob:')) {
        audio.pause();
        audio.src = '';
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      }
    });
    
    // Force garbage collection if available (Chrome dev tools)
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
      console.log('🗑️ Forced garbage collection');
    }
    
    console.log('✅ Memory cleanup completed');
  } catch (error) {
    console.error('❌ Memory cleanup failed:', error);
  }
}

// 🚨 EMERGENCY: Immediate cleanup function
function emergencyCleanup() {
  console.log('🚨 EMERGENCY: Running immediate cleanup to prevent crashes');
  
  try {
    // Force clear all audio cache immediately
    if (window.audioCache && window.audioCache.size > 0) {
      console.log(`🚨 EMERGENCY: Clearing ALL ${window.audioCache.size} audio cache items`);
      window.audioCache.forEach((audioData, key) => {
        try {
          if (audioData && audioData.blobUrl && audioData.blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioData.blobUrl);
          }
          if (audioData && audioData.audioUrl && audioData.audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioData.audioUrl);
          }
        } catch (e) {
          // Ignore individual failures, just continue cleanup
        }
      });
      window.audioCache.clear();
      console.log('✅ EMERGENCY: All audio cache cleared');
    }
    
    // Clear all audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      try {
        audio.pause();
        audio.src = '';
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      } catch (e) {
        // Ignore individual failures
      }
    });
    
    // Force garbage collection if available
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
      console.log('🗑️ EMERGENCY: Forced garbage collection');
    }
    
    console.log('✅ EMERGENCY cleanup completed');
  } catch (error) {
    console.error('❌ EMERGENCY cleanup failed:', error);
  }
}

// Initialize memory cleanup interval
function initializeMemoryCleanup() {
  // 🚨 EMERGENCY: Run immediate cleanup first
  emergencyCleanup();
  
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
  }
  
  // 🚨 EMERGENCY: More frequent cleanup every 10 seconds
  memoryCleanupInterval = setInterval(() => {
    performMemoryCleanup();
  }, 10000); // Reduced from 30000 to 10000
  
  console.log('🧹 Memory cleanup interval initialized');
}

// Resource monitoring for Chrome crash prevention
function checkResourcePressure() {
  const now = Date.now();
  const timeSinceLastCleanup = now - extensionResourceMonitor.lastCleanup;
  
  // 🚨 EMERGENCY: Force cleanup every 10 seconds regardless
  if (timeSinceLastCleanup > 10000) { // Reduced from 30000 to 10000
    performMemoryCleanup();
    extensionResourceMonitor.lastCleanup = now;
  }
  
  // 🚨 EMERGENCY: Much more aggressive memory pressure detection
  if (window.audioCache.size > 2) { // Reduced from 5 to 2
    extensionResourceMonitor.memoryPressure = true;
    console.warn('🚨 EMERGENCY: Audio cache too large - forcing cleanup');
    performMemoryCleanup();
  } else {
    extensionResourceMonitor.memoryPressure = false;
  }
  
  return extensionResourceMonitor.memoryPressure;
}

// Operation semaphore to prevent Chrome overload
async function acquireOperationLock(operationName) {
  if (extensionResourceMonitor.activeOperations >= extensionResourceMonitor.maxConcurrentOps) {
    console.warn(`🚦 ${operationName} blocked - too many concurrent operations`);
    throw new Error('Extension busy - please wait before retrying');
  }
  
  if (checkResourcePressure()) {
    console.warn(`🚨 ${operationName} blocked - memory pressure detected`);
    throw new Error('Extension under memory pressure - operation cancelled');
  }
  
  extensionResourceMonitor.activeOperations++;
  console.log(`🔓 ${operationName} started (${extensionResourceMonitor.activeOperations} active)`);
}

function releaseOperationLock(operationName) {
  extensionResourceMonitor.activeOperations = Math.max(0, extensionResourceMonitor.activeOperations - 1);
  console.log(`🔒 ${operationName} completed (${extensionResourceMonitor.activeOperations} active)`);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  performMemoryCleanup();
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
  }
  
  // Emergency cleanup
  extensionResourceMonitor.activeOperations = 0;
  try {
    if (window.audioCache) window.audioCache.clear();
  } catch (e) {
    console.warn('Emergency cleanup failed:', e);
  }
});

// Emergency monitoring to prevent Chrome crashes
function setupEmergencyMonitoring() {
  console.log('🛡️ Setting up emergency monitoring for Chrome crash prevention');
  
  // Monitor for excessive memory usage
  setInterval(() => {
    const now = Date.now();
    
    // Force cleanup if operations are stuck
    if (extensionResourceMonitor.activeOperations > 0) {
      const timeSinceLastOp = now - extensionResourceMonitor.lastCleanup;
      if (timeSinceLastOp > 60000) { // 1 minute stuck
        console.error('🚨 EMERGENCY: Operations stuck for 1+ minute - forcing reset');
        extensionResourceMonitor.activeOperations = 0;
        performMemoryCleanup();
      }
    }
    
    // Monitor audio cache size
    if (window.audioCache && window.audioCache.size > 3) {
      console.warn('🚨 EMERGENCY: Audio cache too large - forcing cleanup');
      performMemoryCleanup();
    }
    
    // Monitor flashcard creation rate
    if (flashcardCreationCount > FLASHCARD_CREATION_LIMIT) {
      console.warn('🚨 EMERGENCY: Flashcard creation rate exceeded - resetting');
      flashcardCreationCount = 0;
      lastFlashcardCreationTime = now;
    }
    
  }, 15000); // Check every 15 seconds
  
  // Emergency error handler
  window.addEventListener('error', (event) => {
    console.error('🚨 EMERGENCY: Unhandled error detected:', event.error);
    
    // If it's related to our extension, force cleanup
    if (event.error?.stack?.includes('createFlashcardFromReport') ||
        event.error?.stack?.includes('aiService') ||
        event.error?.stack?.includes('audioCache')) {
      console.error('🚨 EMERGENCY: Extension-related error - forcing cleanup');
      extensionResourceMonitor.activeOperations = 0;
      performMemoryCleanup();
    }
  });
  
  console.log('✅ Emergency monitoring active');
}

// Create flashcard from saved report with AI enhancement and safety checks
async function createFlashcardFromReport(report) {
  const operationName = `FlashcardCreation[${report?.searchText?.substring(0, 20) || 'unknown'}]`;
  
  try {
    // Acquire operation lock to prevent Chrome overload
    await acquireOperationLock(operationName);
    
    console.log('🃏 Starting createFlashcardFromReport for:', report?.searchText);
    
    if (!flashcardManager) {
      console.error('❌ FlashcardManager not available');
      throw new Error('FlashcardManager not initialized');
    }
    
    if (!report || !report.searchText || !report.language) {
      console.error('❌ Invalid or incomplete report provided:', report);
      throw new Error('Invalid report data - missing searchText or language');
    }

  try {
    // First try AI-enhanced flashcard creation with timeout
    if (window.aiService && window.aiService.isAvailable()) {
      console.log('🤖 Attempting AI-enhanced flashcard creation...');
      
      try {
        // Add timeout protection for AI enhancement
        const aiTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI flashcard generation timeout')), 8000);
        });

        const result = await Promise.race([
          window.flashcardManager.createEnhancedFromReport(report),
          aiTimeout
        ]);

        console.log('✅ AI-enhanced flashcard created successfully:', result?.id);
        return result;

      } catch (aiError) {
        console.warn('⚠️ AI enhancement failed, falling back to manual extraction:', aiError.message);
        // Continue to fallback method below
      }
    } else {
      console.log('ℹ️ AI service not available, using manual extraction');
    }

    // Fallback: Manual extraction from existing analysis (like before)
    console.log('🔄 Using manual content extraction...');
    
    const analysisText = typeof report.analysisData === 'string' 
      ? report.analysisData 
      : (report.analysisData && report.analysisData.content 
          ? report.analysisData.content 
          : '');

    let translation = '';
    let pronunciation = '';
    let definition = '';

    if (analysisText) {
      // Extract Chinese translation
      const chineseMatch = analysisText.match(/中文[：:\s]*([^\n]+)/i) ||
                          analysisText.match(/翻譯[：:\s]*([^\n]+)/i) ||
                          analysisText.match(/意思[：:\s]*([^\n]+)/i);
      if (chineseMatch) translation = chineseMatch[1].trim();

      // Extract pronunciation
      const pronMatch = analysisText.match(/發音[：:\s]*([^\n]+)/i) ||
                       analysisText.match(/\[([^\]]+)\]/);
      if (pronMatch) pronunciation = pronMatch[1].trim();

      // Extract definition
      const defMatch = analysisText.match(/定義[：:\s]*([^\n]+)/i) ||
                      analysisText.match(/解釋[：:\s]*([^\n]+)/i);
      if (defMatch) definition = defMatch[1].trim();
    }

    // Fallback extraction if nothing found
    if (!translation && analysisText) {
      translation = analysisText.substring(0, 100) + '...';
    }

    const flashcardData = {
      front: report.searchText,
      back: translation || 'Translation needed',
      definition: definition || 'Definition needed',
      pronunciation: pronunciation,
      language: report.language,
      tags: (report.tags || []).concat(['from-report', 'manual-extraction'])
    };

    console.log('📝 Creating flashcard with manually extracted data:', flashcardData);

    // Include audio if available
    const cachedAudio = getCachedAudio(report.searchText, report.language);
    if (cachedAudio && cachedAudio.audioUrl) {
      flashcardData.audioUrl = cachedAudio.audioUrl;
      console.log('🔊 Added cached audio to flashcard');
    }

    // Create flashcard with manual extraction
    console.log('💾 Calling flashcardManager.createFlashcard with manual data...');
    const result = await window.flashcardManager.createFlashcard(flashcardData, false);
    console.log('✅ Manual flashcard created successfully:', result?.id);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in createFlashcardFromReport:', error);
    throw error;
  } finally {
    // Always release the operation lock
    releaseOperationLock(operationName);
  }
  
  } catch (lockError) {
    // Handle operation lock acquisition failure
    console.error('❌ Failed to acquire operation lock:', lockError);
    throw lockError;
  }
}


// Create flashcards from all saved reports
async function createAllFlashcardsFromReports() {
  if (!flashcardManager) {
    showMessage('記憶卡管理器未就緒', 'error');
    return;
  }

  try {
    // Get all reports based on current filters
    const filteredReports = await getCurrentlyFilteredReports();
    
    if (filteredReports.length === 0) {
      showMessage('沒有可用的報告來建立記憶卡', 'warning');
      return;
    }

    const confirmMessage = `確定要為 ${filteredReports.length} 個報告建立記憶卡嗎？`;
    if (!confirm(confirmMessage)) {
      return;
    }

    // Disable the button and show progress
    const createAllBtn = document.getElementById('createAllFlashcardsBtn');
    if (createAllBtn) {
      createAllBtn.disabled = true;
      createAllBtn.textContent = '🔄 建立中...';
    }

    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;

    // Create flashcards for each report
    for (let i = 0; i < filteredReports.length; i++) {
      const report = filteredReports[i];
      
      try {
        // Add timeout protection for bulk creation
        const createTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Bulk flashcard timeout')), 5000);
        });
        
        await Promise.race([
          createFlashcardFromReport(report),
          createTimeout
        ]);
        
        successCount++;

        // Show progress
        if (createAllBtn) {
          createAllBtn.textContent = `🔄 建立中 ${i + 1}/${filteredReports.length}`;
        }

        // More aggressive delay and cleanup every 3 cards
        if (i % 3 === 0) {
          performMemoryCleanup();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay every 3 cards
        } else {
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between cards
        }
      } catch (error) {
        console.error(`Failed to create flashcard for ${report.searchText}:`, error);
        if (error.message && error.message.includes('already exists')) {
          duplicateCount++;
          console.log(`Skipped duplicate: ${report.searchText} (${report.language})`);
        } else {
          failCount++;
        }
      }
    }

    // Show detailed completion message
    let message = '';
    const total = filteredReports.length;
    
    if (successCount > 0) {
      message = `✅ 成功建立 ${successCount} 張新記憶卡！`;
      if (duplicateCount > 0) {
        message += ` (跳過 ${duplicateCount} 張重複)`;
      }
      if (failCount > 0) {
        message += ` (${failCount} 張失敗)`;
      }
    } else if (duplicateCount > 0) {
      message = `ℹ️ 所有 ${duplicateCount} 張記憶卡都已存在，跳過重複建立`;
    } else if (failCount > 0) {
      message = `❌ 建立失敗，共 ${failCount} 張`;
    } else {
      message = '沒有處理任何記憶卡';
    }

    // Add summary if there were mixed results
    if (total > 1 && (successCount + duplicateCount + failCount) > 0) {
      message += `\n總計處理: ${total} 個項目`;
    }

    showMessage(message, successCount > 0 ? 'success' : (duplicateCount > 0 ? 'info' : 'warning'));

    // Refresh flashcards view if it's currently active
    const flashcardsView = document.getElementById('flashcardsView');
    if (flashcardsView && flashcardsView.style.display !== 'none') {
      await loadFlashcardsView();
    }

  } catch (error) {
    console.error('Failed to create bulk flashcards:', error);
    showMessage('批量建立記憶卡失敗', 'error');
  } finally {
    // Re-enable the button
    const createAllBtn = document.getElementById('createAllFlashcardsBtn');
    if (createAllBtn) {
      createAllBtn.disabled = false;
      createAllBtn.textContent = '🃏 Create All Flashcards';
    }
  }
}

// Start study mode
function startStudyMode() {
  if (!flashcardManager) return;

  const studyMode = document.getElementById('studyModeSelect')?.value || 'word-to-translation';
  const difficulty = document.getElementById('difficultyFilter')?.value || 'all';

  const session = window.flashcardManager.startStudySession({
    mode: studyMode,
    difficulty: difficulty,
    maxCards: 20
  });

  if (!session || session.cards.length === 0) {
    showMessage('沒有需要複習的卡片', 'info');
    return;
  }

  currentStudySession = session;
  showStudyInterface();
  loadCurrentCard();
}

// Show study interface
function showStudyInterface() {
  const flashcardsList = document.getElementById('flashcardsList');
  const flashcardsEmpty = document.getElementById('flashcardsEmpty');
  const studyInterface = document.getElementById('studyInterface');

  if (flashcardsList) flashcardsList.style.display = 'none';
  if (flashcardsEmpty) flashcardsEmpty.style.display = 'none';
  if (studyInterface) studyInterface.style.display = 'block';
}

// Load current card in study session
function loadCurrentCard() {
  if (!currentStudySession) return;

  const card = window.flashcardManager.getCurrentCard();
  if (!card) {
    // Study session completed
    completeStudySession();
    return;
  }

  const progress = window.flashcardManager.getStudyProgress();
  updateStudyProgress(progress);

  // Reset card state
  const flashcard = document.getElementById('flashcard');
  const frontText = document.getElementById('frontText');
  const backText = document.getElementById('backText');
  const cardDefinition = document.getElementById('cardDefinition');
  const cardPronunciation = document.getElementById('cardPronunciation');
  const flipCardBtn = document.getElementById('flipCardBtn');
  const answerButtons = document.getElementById('answerButtons');
  const audioPlayBtn = document.getElementById('audioPlayBtn');

  if (flashcard) flashcard.classList.remove('flipped');
  if (frontText) frontText.textContent = card.front || 'No front text';
  if (backText) {
    // Use the concise translation for flashcard back
    backText.textContent = card.back || 'No translation available';
    console.log('Setting back text:', card.back);
  }
  
  // Enhanced display for AI-generated content
  if (cardDefinition) {
    // Show context sentence if available
    if (card.definition) {
      cardDefinition.textContent = card.definition;
      
      // Add visual indicator for AI-enhanced cards
      if (card.aiGenerated) {
        cardDefinition.classList.add('ai-enhanced');
        cardDefinition.style.fontStyle = 'italic';
        cardDefinition.style.opacity = '0.9';
      }
    } else {
      cardDefinition.textContent = '';
    }
  }

  // Display memory tip separately if available
  const cardMemoryTip = document.getElementById('cardMemoryTip');
  if (cardMemoryTip) {
    if (card.memoryTip) {
      cardMemoryTip.textContent = `💡 ${card.memoryTip}`;
      cardMemoryTip.style.display = 'block';
    } else {
      cardMemoryTip.style.display = 'none';
    }
  }
  
  if (cardPronunciation) {
    const pronunciationText = card.pronunciation ? `[${card.pronunciation}]` : '';
    cardPronunciation.textContent = pronunciationText;
    
    // Style pronunciation for better visibility
    if (pronunciationText) {
      cardPronunciation.style.color = '#666';
      cardPronunciation.style.fontSize = '14px';
      cardPronunciation.style.marginTop = '4px';
    }
  }
  if (flipCardBtn) {
    flipCardBtn.style.display = 'block';
    flipCardBtn.textContent = '翻轉卡片';
  }
  if (answerButtons) answerButtons.style.display = 'none';

  // Enhanced audio integration
  if (audioPlayBtn) {
    const hasAudio = card.audioUrl || card.audioData;
    audioPlayBtn.style.display = hasAudio ? 'block' : 'none';
    
    if (hasAudio) {
      // Style the audio button for better visibility
      audioPlayBtn.classList.add('enhanced');
      audioPlayBtn.title = 'Play pronunciation audio';
      
      // Add visual indicator for AI-generated audio
      if (card.tags && card.tags.includes('with-audio')) {
        audioPlayBtn.innerHTML = '🔊 Play Audio';
      } else {
        audioPlayBtn.innerHTML = '🔊 Play';
      }
      
      // Enhanced click handler for audio
      audioPlayBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          audioPlayBtn.style.opacity = '0.7';
          audioPlayBtn.innerHTML = '⏳ Playing...';
          
          // Use flashcard manager's audio playback
          if (window.flashcardManager && typeof window.flashcardManager.playPronunciation === 'function') {
            await window.flashcardManager.playPronunciation(card.id);
          } else {
            // Fallback to direct audio playback
            if (card.audioUrl) {
              const audio = new Audio(card.audioUrl);
              await audio.play();
            }
          }
          
        } catch (error) {
          console.error('❌ Failed to play audio:', error);
          audioPlayBtn.innerHTML = '❌ Error';
          setTimeout(() => {
            audioPlayBtn.innerHTML = '🔊 Play';
          }, 2000);
        } finally {
          setTimeout(() => {
            audioPlayBtn.style.opacity = '1';
            audioPlayBtn.innerHTML = '🔊 Play';
          }, 1000);
        }
      };
    }
  }

  // Configure display based on study mode
  const studyMode = currentStudySession.mode;
  const cardFront = document.querySelector('.card-front');
  const cardBack = document.querySelector('.card-back');
  
  // Configure card display and content based on study mode
  if (studyMode === 'translation-to-word') {
    // Show translation first, word on back
    if (frontText) frontText.textContent = card.back || card.definition || 'No translation available';
    if (backText) backText.textContent = card.front || 'No word available';
  } else if (studyMode === 'audio-to-meaning') {
    // Show audio button prominently, meaning on back
    if (frontText) {
      frontText.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔊</div>
          <div style="margin-bottom: 16px; font-size: 18px;">聆聽發音</div>
          <button id="studyModePlayBtn" style="
            background: #1976d2; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 6px; 
            font-size: 16px;
            cursor: pointer;
          ">播放發音</button>
        </div>
      `;
      
      // Add event listener for the play button (CSP compliant)
      setTimeout(() => {
        const playBtn = document.getElementById('studyModePlayBtn');
        if (playBtn) {
          playBtn.addEventListener('click', () => playCardPronunciation());
          
          // Auto-play the pronunciation when entering audio-to-meaning mode
          setTimeout(() => {
            playCardPronunciation();
          }, 500);
        }
      }, 10);
    }
    if (backText) backText.textContent = `${card.front} - ${card.back || card.definition}`;
  } else if (studyMode === 'mixed') {
    // Random mode selection for each card
    const modes = ['word-to-translation', 'translation-to-word', 'audio-to-meaning'];
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    currentStudySession.currentCardMode = randomMode;
    
    if (randomMode === 'translation-to-word') {
      if (frontText) frontText.textContent = card.back || card.definition || 'No translation available';
      if (backText) backText.textContent = card.front || 'No word available';
    } else if (randomMode === 'audio-to-meaning') {
      if (frontText) {
        frontText.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🔊</div>
            <div style="margin-bottom: 16px; font-size: 18px;">聆聽發音</div>
            <button id="studyModePlayBtn" style="
              background: #1976d2; 
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 6px; 
              font-size: 16px;
              cursor: pointer;
            ">播放發音</button>
          </div>
        `;
        
        // Add event listener for the play button (CSP compliant)
        setTimeout(() => {
          const playBtn = document.getElementById('studyModePlayBtn');
          if (playBtn) {
            playBtn.addEventListener('click', () => playCardPronunciation());
            
            // Auto-play the pronunciation when entering audio-to-meaning mode
            setTimeout(() => {
              playCardPronunciation();
            }, 500);
          }
        }, 10);
      }
      if (backText) backText.textContent = `${card.front} - ${card.back || card.definition}`;
    } else {
      // Default word-to-translation
      if (frontText) frontText.textContent = card.front || 'No front text';
      if (backText) backText.textContent = card.back || 'No translation available';
    }
  } else {
    // Default: word-to-translation
    if (frontText) frontText.textContent = card.front || 'No front text';
    if (backText) backText.textContent = card.back || 'No translation available';
  }
  
  if (cardFront) cardFront.style.display = 'flex';
  if (cardBack) cardBack.style.display = 'none';
}

// Update study progress
function updateStudyProgress(progress) {
  const progressFill = document.getElementById('progressFill');
  const cardCounter = document.getElementById('cardCounter');

  if (progressFill) {
    progressFill.style.width = `${progress.percentage}%`;
  }

  if (cardCounter) {
    cardCounter.textContent = `${progress.current} / ${progress.total}`;
  }
}

// Flip current card
function flipCurrentCard() {
  const flashcard = document.getElementById('flashcard');
  const flipCardBtn = document.getElementById('flipCardBtn');
  const answerButtons = document.getElementById('answerButtons');
  const cardFront = document.querySelector('.card-front');
  const cardBack = document.querySelector('.card-back');

  if (flashcard && !flashcard.classList.contains('flipped')) {
    flashcard.classList.add('flipped');
    
    // Explicitly show/hide the card sides
    if (cardFront) cardFront.style.display = 'none';
    if (cardBack) cardBack.style.display = 'flex';
    
    if (flipCardBtn) flipCardBtn.style.display = 'none';
    if (answerButtons) answerButtons.style.display = 'flex';

    // Update answer button timings based on card difficulty
    updateAnswerButtonTimings();
    
    console.log('Card flipped - back side should now be visible');
  }
}

// Update answer button timings
function updateAnswerButtonTimings() {
  const card = window.flashcardManager.getCurrentCard();
  if (!card) return;

  // Calculate next intervals for each answer quality
  const intervals = [
    '< 1分鐘',  // Again
    '< 6分鐘',  // Hard  
    `${Math.max(1, Math.round(card.interval * 0.6))} 天`, // Good
    `${Math.max(4, Math.round(card.interval * card.easeFactor))} 天`  // Easy
  ];

  ['againBtn', 'hardBtn', 'goodBtn', 'easyBtn'].forEach((btnId, index) => {
    const btn = document.getElementById(btnId);
    const timeSpan = btn?.querySelector('.btn-time');
    if (timeSpan) {
      timeSpan.textContent = intervals[index];
    }
  });
}

// Process study answer
async function processStudyAnswer(quality) {
  if (!flashcardManager || !currentStudySession) return;

  const card = window.flashcardManager.getCurrentCard();
  
  const success = await window.flashcardManager.processAnswer(quality);
  
  if (success && card) {
    // Record vocabulary interaction in learning analytics
    if (learningAnalytics) {
      try {
        const action = quality >= 3 ? 'correct_answer' : 'incorrect_answer';
        learningAnalytics.recordVocabularyInteraction(
          card.front,
          card.language,
          action,
          { 
            studyMode: currentStudySession.mode,
            quality: quality,
            timestamp: Date.now()
          }
        );
        console.log('📝 Recorded vocabulary interaction:', card.front, action, quality);
      } catch (error) {
        console.error('Failed to record vocabulary interaction:', error);
      }
    }

    // Move to next card after a short delay
    setTimeout(() => {
      loadCurrentCard();
    }, 800);

    // Show feedback
    const feedbackMessages = ['再試一次！', '有點困難', '做得好！', '太簡單了！'];
    showMessage(feedbackMessages[quality], quality >= 2 ? 'success' : 'warning');

    // Update stats
    await updateFlashcardStats();
  }
}

// Complete study session
async function completeStudySession() {
  if (!flashcardManager) return;

  const results = window.flashcardManager.endStudySession();
  const studyInterface = document.getElementById('studyInterface');
  
  if (studyInterface) studyInterface.style.display = 'none';
  
  // Show results
  const cardsStudied = results.cardsStudied;
  const accuracy = results.accuracy;
  const duration = Math.round(results.duration / 1000 / 60); // minutes

  // Update learning analytics with the completed study session
  if (learningAnalytics && results && cardsStudied > 0) {
    try {
      learningAnalytics.recordStudySession(
        'flashcard', 
        results.duration, 
        cardsStudied, 
        accuracy / 100 // Convert percentage to 0-1 scale
      );
      console.log('📊 Recorded study session:', {
        type: 'flashcard',
        duration: results.duration,
        cardsStudied,
        accuracy: accuracy / 100
      });
    } catch (error) {
      console.error('Failed to record study session:', error);
    }
  }

  showMessage(
    `學習完成！複習了 ${cardsStudied} 張卡片，準確率 ${accuracy}%，用時 ${duration} 分鐘`,
    'success'
  );

  // Update analytics view if it's currently displayed
  // Analytics view removed
  if (analyticsView && analyticsView.style.display !== 'none') {
    await loadAnalyticsView();
  }

  // Return to flashcards list
  loadFlashcardsView();
}

// Exit study mode
function exitStudyMode() {
  if (currentStudySession) {
    const confirmed = confirm('確定要退出學習模式嗎？進度將不會保存。');
    if (!confirmed) return;
  }

  currentStudySession = null;
  
  const studyInterface = document.getElementById('studyInterface');
  if (studyInterface) studyInterface.style.display = 'none';
  
  loadFlashcardsView();
}

// Study single card
function studySingleCard(cardId) {
  if (!flashcardManager) return;

  // Find the card
  const card = window.flashcardManager.flashcards.find(c => c.id === cardId);
  if (!card) return;

  // Create a single-card study session
  currentStudySession = {
    cards: [card],
    currentIndex: 0,
    mode: 'word-to-translation',
    startTime: new Date().getTime(),
    answers: []
  };

  window.flashcardManager.currentStudySession = currentStudySession;
  
  showStudyInterface();
  loadCurrentCard();
}

// Edit flashcard
function editFlashcard(cardId) {
  if (!flashcardManager) return;

  const card = window.flashcardManager.flashcards.find(c => c.id === cardId);
  if (!card) return;

  const front = prompt('編輯單字/問題:', card.front);
  if (front === null) return;

  const back = prompt('編輯翻譯/答案:', card.back);
  if (back === null) return;

  const pronunciation = prompt('編輯發音:', card.pronunciation);
  if (pronunciation === null) return;

  const definition = prompt('編輯定義:', card.definition);
  if (definition === null) return;

  // Update card
  window.flashcardManager.updateFlashcard(cardId, {
    front: front,
    back: back,
    pronunciation: pronunciation || '',
    definition: definition || ''
  });

  // Refresh view
  loadFlashcardsView();
  showMessage('卡片更新成功！', 'success');
}

// Delete flashcard
async function deleteFlashcard(cardId) {
  if (!flashcardManager) return;

  const confirmed = confirm('確定要刪除這張記憶卡嗎？');
  if (!confirmed) return;

  try {
    await window.flashcardManager.deleteFlashcard(cardId);
    await loadFlashcardsView();
    showMessage('記憶卡已刪除', 'success');
  } catch (error) {
    console.error('Failed to delete flashcard:', error);
    showMessage('刪除失敗', 'error');
  }
}


// Play card audio
function playCardAudio() {
  const card = window.flashcardManager.getCurrentCard();
  if (!card || !card.audioUrl) return;

  const audio = new Audio(card.audioUrl);
  audio.play().catch(error => {
    console.error('Failed to play audio:', error);
    showMessage('播放音頻失敗', 'error');
  });
}

// Play card pronunciation using enhanced TTS with OpenAI support
async function playCardPronunciation() {
  const card = window.flashcardManager.getCurrentCard();
  if (!card) {
    showMessage('沒有卡片可播放', 'error');
    return;
  }

  console.log('Playing pronunciation for card:', card.front, 'language:', card.language);

  // Update button state
  const playBtn = document.getElementById('studyModePlayBtn');
  if (playBtn) {
    playBtn.textContent = '生成中...';
    playBtn.disabled = true;
  }

  try {
    // Try OpenAI TTS first for better quality
    const audioSuccess = await generateOpenAIAudio(card.front, card.language);
    
    if (audioSuccess) {
      console.log('✅ Used OpenAI TTS for pronunciation');
      return;
    }
    
    // Fallback to Web Speech API
    console.log('⚠️ Falling back to Web Speech API');
    await playWithWebSpeechAPI(card);
    
  } catch (error) {
    console.error('TTS error:', error);
    showMessage('語音播放失敗', 'error');
    
    // Try Web Speech API as final fallback
    try {
      await playWithWebSpeechAPI(card);
    } catch (fallbackError) {
      console.error('Fallback TTS also failed:', fallbackError);
      showMessage('語音系統無法使用', 'error');
    }
  } finally {
    // Reset button state
    if (playBtn) {
      playBtn.textContent = '播放發音';
      playBtn.disabled = false;
    }
  }
}

// Global audio cache to reuse generated audio
window.audioCache = window.audioCache || new Map();

// Cleanup function to prevent memory leaks
function cleanupFlashcardMemory() {
  // Clear audio cache if it gets too large (>50 items)
  if (window.audioCache && window.audioCache.size > 50) {
    console.log('🧹 Cleaning up audio cache...');
    const entries = Array.from(window.audioCache.entries());
    // Keep only the 25 most recent entries
    window.audioCache.clear();
    entries.slice(-25).forEach(([key, value]) => {
      window.audioCache.set(key, value);
    });
  }
  
  // Force garbage collection if available
  if (window.gc) {
    window.gc();
  }
}

// Run cleanup periodically
setInterval(cleanupFlashcardMemory, 30000); // Every 30 seconds

// Generate audio using OpenAI TTS API (with caching)
async function generateOpenAIAudio(text, language, playImmediately = true) {
  try {
    // Check cache first
    const cacheKey = `${text.toLowerCase()}_${language}`;
    if (window.audioCache.has(cacheKey)) {
      const cachedAudio = window.audioCache.get(cacheKey);
      console.log('🎯 Using cached audio for:', text);
      
      if (playImmediately) {
        return await playCachedAudio(cachedAudio);
      } else {
        return cachedAudio; // Return cached audio data
      }
    }

    // Get OpenAI API key from storage or environment
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      console.log('No OpenAI API key found, skipping OpenAI TTS');
      return false;
    }

    // Map our language codes to OpenAI voice options
    const voiceMap = {
      'english': 'alloy',    // Clear, natural English voice
      'japanese': 'nova',    // Works well for Japanese
      'korean': 'echo',      // Good for Korean
      'dutch': 'fable',      // European languages
      'chinese': 'onyx'      // Works for Chinese
    };

    const voice = voiceMap[language] || 'alloy';
    
    console.log('🎙️ Requesting OpenAI TTS:', text, 'voice:', voice);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 0.9  // Slightly slower for learning
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS API error:', response.status, errorText);
      return false;
    }

    // Convert response to audio blob and create data URL for persistent storage
    const audioBlob = await response.blob();
    const audioDataUrl = await blobToDataURL(audioBlob);
    
    // Cache the audio data
    const audioData = {
      text: text,
      language: language,
      audioUrl: audioDataUrl, // Data URL for persistent storage
      blobUrl: URL.createObjectURL(audioBlob), // Blob URL for immediate playback
      size: audioBlob.size,
      timestamp: Date.now()
    };
    
    window.audioCache.set(cacheKey, audioData);
    console.log('💾 Cached audio for:', text, 'size:', Math.round(audioBlob.size / 1024), 'KB');
    
    // 🚨 EMERGENCY: Immediate cleanup check after adding audio
    if (window.audioCache.size > 2) {
      console.log('🚨 EMERGENCY: Audio cache exceeded limit after adding - forcing cleanup');
      performMemoryCleanup();
    }
    
    // Update audio section if it's currently displayed for this query
    if (currentQueryData?.text === text && currentQueryData?.language === language) {
      updateAudioSection();
    }
    
    if (playImmediately) {
      return await playCachedAudio(audioData);
    } else {
      return audioData; // Return audio data without playing
    }

  } catch (error) {
    console.error('OpenAI TTS generation failed:', error);
    return false;
  }
}

// Play cached audio
async function playCachedAudio(audioData) {
  const audio = new Audio(audioData.blobUrl || audioData.audioUrl);
  
  return new Promise((resolve) => {
    audio.onloadeddata = () => {
      console.log('🔊 Playing cached OpenAI audio');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放中...';
        playBtn.disabled = true;
      }
      
      audio.play()
        .then(() => {
          console.log('✅ Cached audio playing successfully');
          resolve(true);
        })
        .catch(error => {
          console.error('Failed to play cached audio:', error);
          resolve(false);
        });
    };
    
    audio.onended = () => {
      console.log('🎵 Cached audio finished');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放發音';
        playBtn.disabled = false;
      }
    };
    
    audio.onerror = (error) => {
      console.error('Cached audio playback error:', error);
      resolve(false);
    };
  });
}

// Convert blob to data URL for persistent storage
function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Update audio section when new audio becomes available
function updateAudioSection() {
  const audioSection = document.getElementById('aiAudioSection');
  const audioContent = document.getElementById('audioContent');
  
  if (!audioSection || !audioContent || !currentQueryData?.text || !currentQueryData?.language) {
    return;
  }
  
  const cachedAudio = getCachedAudio(currentQueryData.text, currentQueryData.language);
  
  if (cachedAudio && cachedAudio.audioUrl) {
    console.log('🔄 Updating audio section with newly cached audio');
    
    audioContent.innerHTML = `
      <div class="audio-ready">
        ✅ 語音已準備 (${Math.round((cachedAudio.size || 0) / 1024)} KB) - ${cachedAudio.voice || 'OpenAI TTS'}
        <br>
        <button id="playCachedAudioBtn" style="
          background: #1976d2; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 4px; 
          cursor: pointer; 
          margin: 8px 0;
          font-size: 14px;
        ">🔊 播放語音</button>
      </div>
    `;
    
    // Add event listener for the play button
    setTimeout(() => {
      const playBtn = document.getElementById('playCachedAudioBtn');
      if (playBtn) {
        playBtn.addEventListener('click', async () => {
          const originalText = playBtn.textContent;
          playBtn.textContent = '播放中...';
          playBtn.disabled = true;
          
          try {
            await playCachedAudio(cachedAudio);
          } catch (error) {
            console.error('Failed to play cached audio:', error);
            showMessage('播放語音失敗', 'error');
          } finally {
            playBtn.textContent = originalText;
            playBtn.disabled = false;
          }
        });
      }
    }, 100);
  }
}

// Get cached audio for flashcard creation
function getCachedAudio(text, language) {
  const cacheKey = `${text.toLowerCase()}_${language}`;
  return window.audioCache.get(cacheKey) || null;
}

// Get OpenAI API key from storage
async function getOpenAIApiKey() {
  try {
    // First try to get from Chrome storage
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['openaiApiKey'], resolve);
    });
    
    if (result.openaiApiKey) {
      return result.openaiApiKey;
    }
    
    // Fallback: check if there's a global variable or config
    if (typeof window.OPENAI_API_KEY !== 'undefined') {
      return window.OPENAI_API_KEY;
    }
    
    console.log('No OpenAI API key configured');
    return null;
  } catch (error) {
    console.error('Failed to retrieve OpenAI API key:', error);
    return null;
  }
}

// Fallback to Web Speech API (enhanced version)
async function playWithWebSpeechAPI(card) {
  if (!('speechSynthesis' in window)) {
    throw new Error('Web Speech API not supported');
  }

  // Cancel any ongoing speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(card.front);
  
  // Enhanced language mapping
  const langMap = {
    'english': 'en-US',
    'japanese': 'ja-JP', 
    'korean': 'ko-KR',
    'dutch': 'nl-NL',
    'chinese': 'zh-CN'
  };
  
  utterance.lang = langMap[card.language] || 'en-US';
  utterance.rate = 0.75;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  // Select best voice
  const voices = speechSynthesis.getVoices();
  const preferredVoice = selectBestVoice(voices, utterance.lang, card.language);
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    console.log('Using voice:', preferredVoice.name);
  }
  
  return new Promise((resolve, reject) => {
    utterance.onstart = () => {
      console.log('🔊 Playing Web Speech API audio');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放中...';
        playBtn.disabled = true;
      }
    };
    
    utterance.onend = () => {
      console.log('✅ Web Speech API finished');
      const playBtn = document.getElementById('studyModePlayBtn');
      if (playBtn) {
        playBtn.textContent = '播放發音';
        playBtn.disabled = false;
      }
      resolve();
    };
    
    utterance.onerror = (event) => {
      console.error('Web Speech API error:', event.error);
      reject(new Error('Web Speech API error: ' + event.error));
    };
    
    speechSynthesis.speak(utterance);
  });
}

// Select the best available voice for the language
function selectBestVoice(voices, langCode, cardLanguage) {
  if (!voices || voices.length === 0) return null;
  
  // Filter voices by language
  const matchingVoices = voices.filter(voice => voice.lang.startsWith(langCode.split('-')[0]));
  
  if (matchingVoices.length === 0) return null;
  
  // Language-specific voice preferences (more natural sounding voices)
  const voicePreferences = {
    'english': ['Microsoft Zira', 'Google US English', 'Alex', 'Daniel', 'Karen', 'Moira', 'Samantha'],
    'japanese': ['Microsoft Haruka', 'Google 日本語', 'Kyoko', 'Otoya', 'O-ren'],
    'korean': ['Microsoft Heami', 'Google 한국의', 'Yuna'],
    'dutch': ['Microsoft Frank', 'Google Nederlands', 'Ellen', 'Xander'],
    'chinese': ['Microsoft Huihui', 'Google 中文', 'Ting-Ting', 'Sin-ji']
  };
  
  const preferences = voicePreferences[cardLanguage] || [];
  
  // Try to find a preferred voice
  for (const prefName of preferences) {
    const voice = matchingVoices.find(v => v.name.includes(prefName));
    if (voice) return voice;
  }
  
  // Prefer local voices over remote ones
  const localVoices = matchingVoices.filter(v => v.localService);
  if (localVoices.length > 0) {
    return localVoices[0];
  }
  
  // Return first matching voice
  return matchingVoices[0];
}

// Show message (utility function)
function showMessage(message, type = 'info') {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    max-width: 300px;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;

  // Set background color based on type
  const colors = {
    'info': '#2196f3',
    'success': '#4caf50',
    'warning': '#ff9800',
    'error': '#f44336'
  };
  toast.style.backgroundColor = colors[type] || colors.info;

  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// FIXED: Add missing function to prevent browser freeze
function initializeVideoLearningControls() {
  console.log('🎬 Video learning controls initialized (sidepanel context)');
  
  const videoView = document.getElementById('videoView');
  if (videoView) {
    videoView.innerHTML = `
      <div style="padding: 20px;">
        <h3 style="text-align: center; margin-bottom: 20px;">📖 YouTube AI Learning</h3>
        
        <!-- Current Analysis Section -->
        <div id="currentAnalysisSection" style="display: none;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <div style="font-weight: bold; margin-bottom: 8px;">📝 Analyzing:</div>
            <div id="currentAnalysisText" style="font-size: 16px; word-wrap: break-word;"></div>
            <div id="analysisStatus" style="font-size: 12px; margin-top: 8px; opacity: 0.9;">🔄 Preparing AI analysis...</div>
          </div>
          
          <!-- AI Analysis Results -->
          <div id="aiAnalysisResults" style="margin-bottom: 20px;"></div>
          
          <!-- Settings and Options -->
          <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <label style="font-size: 13px; font-weight: bold; color: #333;">🤖 Auto AI Analysis:</label>
              <label class="toggle-switch" style="position: relative; display: inline-block; width: 50px; height: 24px;">
                <input type="checkbox" id="autoAnalysisToggle" style="opacity: 0; width: 0; height: 0;" checked>
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; background-color: #2196F3;"></span>
                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; transform: translateX(26px);"></span>
              </label>
            </div>
            <div style="font-size: 11px; color: #666;">Enable to automatically analyze text with AI when sent from YouTube</div>
          </div>
          
          <!-- Quick Actions -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
            <button id="speakCurrentText" style="padding: 8px 12px; background: #4285f4; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">🔊 Speak</button>
            <button id="saveCurrentText" style="padding: 8px 12px; background: #34a853; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">💾 Save</button>
            <button id="analyzeAgain" style="padding: 8px 12px; background: #ea4335; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">🔄 Re-analyze</button>
          </div>
        </div>
        
        <!-- Waiting State -->
        <div id="waitingForText" style="text-align: center;">
          <div style="background: #f5f5f5; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h4 style="color: #666; margin-bottom: 15px;">🎯 Ready for Learning!</h4>
            <p style="color: #888; margin-bottom: 15px;">Select text from YouTube to get AI-powered analysis here.</p>
          </div>
          
          <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; text-align: left; margin: 15px 0;">
            <strong>📋 How to use:</strong><br>
            1. ✅ Go to any YouTube video<br>
            2. ✅ Click the red "📚 LEARN" button (top-right)<br>
            3. ✅ Turn on YouTube subtitles (CC button)<br>
            4. ✅ Click "📚 LEARN" to turn it green "✅ ON"<br>
            5. ✅ Hover and click subtitles, or select any text<br>
            6. ✅ Analysis appears here automatically! 🎉
          </div>
          
          <div style="background: #fff3cd; padding: 12px; border-radius: 6px; font-size: 13px; margin: 10px 0;">
            <strong>💡 Pro Tip:</strong> Works with subtitles, descriptions, comments, and any YouTube text!
          </div>
        </div>
      </div>
    `;
    
    // Add event handlers for the action buttons
    setupVideoLearningHandlers();
    const statusDiv = document.getElementById('learnerStatus');
    
    enableButton.onclick = async () => {
      console.log('🚀 Enabling Simple Learner from sidepanel...');
      
      try {
        // Update UI to show loading
        enableButton.textContent = '⏳ Enabling...';
        enableButton.disabled = true;
        statusText.textContent = 'Enabling Simple Learner...';
        
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url.includes('youtube.com')) {
          throw new Error('Please navigate to a YouTube video page first');
        }
        
        // Send message to content script to enable Simple Learner
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'enableSimpleLearner'
        });
        
        if (response && response.success) {
          // Success
          enableButton.textContent = '✅ Enabled!';
          statusText.textContent = 'Simple Learner is active! Look for the 📖 button on YouTube.';
          statusDiv.style.background = '#d4edda';
          statusDiv.style.borderColor = '#c3e6cb';
          
          setTimeout(() => {
            enableButton.textContent = '🚀 Enable on YouTube';
            enableButton.disabled = false;
          }, 3000);
          
        } else {
          throw new Error(response?.error || 'Failed to enable Simple Learner');
        }
        
      } catch (error) {
        console.error('❌ Failed to enable Simple Learner:', error);
        
        // Show error
        enableButton.textContent = '❌ Failed';
        statusText.textContent = error.message || 'Failed to enable. Try refreshing the YouTube page.';
        statusDiv.style.background = '#f8d7da';
        statusDiv.style.borderColor = '#f5c6cb';
        
        setTimeout(() => {
          enableButton.textContent = '🚀 Enable on YouTube';
          enableButton.disabled = false;
        }, 3000);
      }
    };
  }
}

// 載入發音網站選項 - Video tab functionality  
function loadPronunciationSites(queryData) {
  console.log('🎯 loadPronunciationSites called with:', queryData);
  const pronunciationOptions = document.getElementById('pronunciationOptions');
  const siteDescriptions = document.getElementById('siteDescriptions');
  
  console.log('🎯 Elements found:', {
    pronunciationOptions: !!pronunciationOptions,
    siteDescriptions: !!siteDescriptions
  });
  
  // Clear existing content safely
  if (pronunciationOptions) {
    while (pronunciationOptions.firstChild) {
      pronunciationOptions.removeChild(pronunciationOptions.firstChild);
    }
  }
  if (siteDescriptions) {
    while (siteDescriptions.firstChild) {
      siteDescriptions.removeChild(siteDescriptions.firstChild);
    }
  }
  
  // Get site configurations based on language
  const siteConfigs = getSiteConfigs(queryData.language);
  console.log('🎯 Site configs loaded:', siteConfigs);
  
  // Group sites by category
  const categories = {
    'pronunciation': { name: '🎯 發音學習', sites: [] },
    'dictionary': { name: '📚 字典查詢', sites: [] },
    'context': { name: '💭 語境例句', sites: [] },
    'slang': { name: '🏙️ 俚語俗語', sites: [] },
    'academic': { name: '🎓 學術寫作', sites: [] },
    'examples': { name: '📝 例句資料庫', sites: [] },
    'translation': { name: '🌐 翻譯服務', sites: [] },
    'search': { name: '🔍 搜尋引擎', sites: [] }
  };
  
  // Categorize sites
  siteConfigs.forEach((config, index) => {
    const category = config.category || 'pronunciation';
    const url = queryData.allUrls && queryData.allUrls[config.name] ? 
                queryData.allUrls[config.name] : 
                generateUrlForSite(config.name, queryData.text, queryData.language);
    
    categories[category].sites.push({
      ...config,
      url: url,
      index: index
    });
  });
  
  // Generate category sections
  console.log('🎯 Categories after processing:', categories);
  Object.entries(categories).forEach(([categoryKey, category]) => {
    console.log(`🎯 Processing category ${categoryKey}:`, category);
    if (category.sites.length === 0) return;
    
    // Create category header
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';
    categoryHeader.innerHTML = `<h5>${category.name}</h5>`;
    categoryHeader.style.cssText = `
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e0e0e0;
      color: #1a73e8;
      font-size: 13px;
    `;
    
    if (pronunciationOptions) pronunciationOptions.appendChild(categoryHeader);
    
    // Create site options for this category
    category.sites.forEach(site => {
      const option = document.createElement('div');
      option.className = 'pronunciation-option';
      option.innerHTML = `
        <div class="site-icon">${site.icon}</div>
        <div class="site-info">
          <div class="site-name">${site.displayName}</div>
          <div class="site-description">${site.description}</div>
        </div>
      `;
      
      option.style.cssText = `
        display: flex;
        align-items: center;
        padding: 12px;
        margin: 4px 0;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
      `;
      
      option.addEventListener('mouseenter', () => {
        option.style.borderColor = '#1a73e8';
        option.style.backgroundColor = '#f8f9ff';
      });
      
      option.addEventListener('mouseleave', () => {
        option.style.borderColor = '#e0e0e0';
        option.style.backgroundColor = 'white';
      });
      
      option.addEventListener('click', () => {
        loadSiteInFrame(site.url, site.displayName);
        option.style.backgroundColor = '#e3f2fd';
      });
      
      if (pronunciationOptions) {
        pronunciationOptions.appendChild(option);
      }
      
      // Add to descriptions
      if (siteDescriptions) {
        const descItem = document.createElement('li');
        descItem.innerHTML = `<strong>${site.displayName}:</strong> ${site.longDescription || site.description}`;
        siteDescriptions.appendChild(descItem);
      }
    });
  });
}

// Generate URL for specific site (from main version)
function generateUrlForSite(siteName, text, language) {
  const encodedText = encodeURIComponent(text);
  
  // Handle language-specific URLs
  if (siteName === 'PlayPhrase.me') {
    // Language-specific PlayPhrase.me URLs
    const languageMap = {
      'japanese': 'ja',
      'korean': 'ko',
      'dutch': 'nl',
      'english': 'en'
    };
    
    const langCode = languageMap[language];
    if (langCode && langCode !== 'en') {
      return `https://www.playphrase.me/#/search?q=${encodedText}&language=${langCode}`;
    }
    
    // Default English PlayPhrase.me (no language parameter needed)
    return `https://www.playphrase.me/#/search?q=${encodedText}`;
  }
  
  if (siteName === 'Immersion Kit') {
    // Japanese sentence examples from anime/movies
    return `https://www.immersionkit.com/dictionary?keyword=${encodedText}`;
  }
  
  if (siteName === 'Reverso Context') {
    // Language-specific Reverso Context
    const reverseLangMap = {
      'english': 'english-chinese',
      'japanese': 'japanese-chinese', 
      'korean': 'korean-chinese',
      'dutch': 'dutch-chinese'
    };
    const reverseLang = reverseLangMap[language] || 'english-chinese';
    return `https://context.reverso.net/translation/${reverseLang}/${encodedText}`;
  }
  
  if (siteName === 'Google 搜尋') {
    // Language-specific Google search
    const searchTerms = {
      'english': `${encodedText}+pronunciation`,
      'japanese': `${encodedText}+発音+読み方`,
      'korean': `${encodedText}+발음`,
      'dutch': `${encodedText}+uitspraak`
    };
    const searchTerm = searchTerms[language] || `${encodedText}+pronunciation`;
    return `https://www.google.com/search?q=${searchTerm}`;
  }
  
  // Default URL mapping
  const urlMaps = {
    'YouGlish': `https://youglish.com/pronounce/${encodedText}/${language}`,
    'Forvo': `https://forvo.com/word/${encodedText}/`,
    'Cambridge Dictionary': `https://dictionary.cambridge.org/dictionary/english/${encodedText}`,
    'Thesaurus.com': `https://www.thesaurus.com/browse/${encodedText}`,
    'Urban Dictionary': `https://www.urbandictionary.com/define.php?term=${encodedText}`,
    'Ludwig': `https://ludwig.guru/s/${encodedText}`,
    'Jisho.org': `https://jisho.org/search/${encodedText}`,
    'Tatoeba': `https://tatoeba.org/en/sentences/search?query=${encodedText}`,
    'HiNative': `https://hinative.com/questions?search=${encodedText}`,
    'Van Dale': `https://www.vandale.nl/gratis-woordenboek/nederlands/betekenis/${encodedText}`,
    'Linguee': `https://www.linguee.com/english-dutch/search?source=dutch&query=${encodedText}`,
    'Naver Dictionary': `https://en.dict.naver.com/#/search?query=${encodedText}`
  };
  
  return urlMaps[siteName] || `https://youglish.com/pronounce/${encodedText}/${language}`;
}

// Get site configurations based on language (from main version)
function getSiteConfigs(language) {
  const configs = {
    english: [
      {
        name: 'YouGlish',
        displayName: 'YouGlish',
        icon: '📺',
        description: 'YouTube 影片發音範例',
        longDescription: '基於 YouTube 影片的發音範例，涵蓋各種口音和情境',
        category: 'pronunciation'
      },
      {
        name: 'PlayPhrase.me',
        displayName: 'PlayPhrase.me',
        icon: '🎬',
        description: '電影片段中的真實發音',
        longDescription: '從電影和電視劇中提取真實的發音片段，適合學習自然語調',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        displayName: 'Forvo',
        icon: '🔊',
        description: '多國母語者發音字典',
        longDescription: '由母語者錄製的標準發音，支援多種口音和方言',
        category: 'pronunciation'
      },
      {
        name: 'Cambridge Dictionary',
        displayName: 'Cambridge Dictionary',
        icon: '📖',
        description: '權威英語字典',
        longDescription: '劍橋大學出版的權威英語字典，包含詳細定義、例句和語法',
        category: 'dictionary'
      },
      {
        name: 'Thesaurus.com',
        displayName: 'Thesaurus.com',
        icon: '🔤',
        description: '英語同義詞字典',
        longDescription: '豐富的同義詞、反義詞和相關詞彙，幫助擴展詞彙量',
        category: 'dictionary'
      },
      {
        name: 'Reverso Context',
        displayName: 'Reverso Context',
        icon: '🌐',
        description: '真實語境例句',
        longDescription: '來自網絡和文檔的真實使用例句，了解詞彙的實際用法',
        category: 'context'
      },
      {
        name: 'Urban Dictionary',
        displayName: 'Urban Dictionary',
        icon: '🏙️',
        description: '英語俚語字典',
        longDescription: '現代英語俚語、網絡用語和非正式表達的字典',
        category: 'slang'
      },
      {
        name: 'Ludwig',
        displayName: 'Ludwig',
        icon: '🎓',
        description: '學術寫作範例',
        longDescription: '學術和專業寫作的範例，適合提高正式英語寫作水平',
        category: 'academic'
      }
    ],
    japanese: [
      {
        name: 'YouGlish',
        displayName: 'YouGlish',
        icon: '📺',
        description: 'YouTube 日語發音範例',
        longDescription: '基於 YouTube 影片的日語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'PlayPhrase.me',
        displayName: 'PlayPhrase.me',
        icon: '🎬',
        description: '影視劇日語發音',
        longDescription: '從電影和電視劇中查找日語詞彙的真實發音和使用情境',
        category: 'pronunciation'
      },
      {
        name: 'Immersion Kit',
        displayName: 'Immersion Kit',
        icon: '🎌',
        description: '日語動漫例句',
        longDescription: '從日語動漫、電影中提取真實的日語例句和發音',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        displayName: 'Forvo',
        icon: '🔊',
        description: '日語母語者發音',
        longDescription: '由日語母語者錄製的標準發音',
        category: 'pronunciation'
      },
      {
        name: 'Jisho.org',
        displayName: 'Jisho.org',
        icon: '📚',
        description: '最佳日語字典',
        longDescription: '最全面的線上日語字典，包含漢字、讀音、例句和語法',
        category: 'dictionary'
      }
    ],
    dutch: [
      {
        name: 'YouGlish',
        displayName: 'YouGlish',
        icon: '📺',
        description: 'YouTube 荷蘭語範例',
        longDescription: '基於 YouTube 影片的荷蘭語發音範例',
        category: 'pronunciation'
      },
      {
        name: 'Forvo',
        displayName: 'Forvo',
        icon: '🔊',
        description: '荷蘭語母語者發音',
        longDescription: '由荷蘭語母語者錄製的標準發音，最適合荷蘭語學習',
        category: 'pronunciation'
      },
      {
        name: 'Van Dale',
        displayName: 'Van Dale',
        icon: '📖',
        description: '權威荷蘭語字典',
        longDescription: '荷蘭最權威的字典，包含詳細定義、語法和用法',
        category: 'dictionary'
      }
    ]
  };
  
  // Return sites for the specified language, fallback to english
  return configs[language] || configs.english || [];
}

// Load site in iframe
function loadSiteInFrame(url, siteName) {
  const frame = document.getElementById('youglishFrame');
  const loading = document.getElementById('loading');
  
  if (loading) loading.style.display = 'block';
  
  if (frame) {
    frame.src = url;
    frame.onload = () => {
      if (loading) loading.style.display = 'none';
      console.log(`Loaded ${siteName}: ${url}`);
    };
    frame.onerror = () => {
      if (loading) loading.style.display = 'none';
      console.error(`Failed to load ${siteName}`);
    };
  }
}

// Setup handlers for video learning functionality
function setupVideoLearningHandlers() {
  console.log('🎬 Setting up video learning handlers');
  
  // Current text being analyzed
  let currentText = '';
  
  // Speak current text
  const speakBtn = document.getElementById('speakCurrentText');
  if (speakBtn) {
    speakBtn.onclick = () => {
      if (currentText) {
        try {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(currentText);
          utterance.lang = 'en-US';
          utterance.rate = 0.8;
          speechSynthesis.speak(utterance);
          console.log('🔊 Speaking:', currentText);
        } catch (error) {
          console.error('❌ Speech error:', error);
        }
      }
    };
  }
  
  // Save current text
  const saveBtn = document.getElementById('saveCurrentText');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (currentText) {
        try {
          const saved = JSON.parse(localStorage.getItem('ytLearningVocab') || '[]');
          const newEntry = {
            text: currentText,
            date: new Date().toISOString(),
            url: window.location.href,
            source: 'youtube-learning'
          };
          
          const exists = saved.some(item => item.text.toLowerCase() === currentText.toLowerCase());
          if (!exists) {
            saved.push(newEntry);
            localStorage.setItem('ytLearningVocab', JSON.stringify(saved));
            saveBtn.textContent = '✅ Saved!';
            setTimeout(() => {
              saveBtn.textContent = '💾 Save';
            }, 2000);
          } else {
            saveBtn.textContent = '📝 Already saved';
            setTimeout(() => {
              saveBtn.textContent = '💾 Save';
            }, 2000);
          }
        } catch (error) {
          console.error('❌ Save error:', error);
        }
      }
    };
  }
  
  // Re-analyze current text
  const analyzeBtn = document.getElementById('analyzeAgain');
  if (analyzeBtn) {
    analyzeBtn.onclick = () => {
      if (currentText) {
        console.log('🔄 Re-analyzing:', currentText);
        handleYouTubeTextAnalysis(currentText, window.location.href, document.title, true);
      }
    };
  }
  
  // Auto-analysis toggle handler
  const autoToggle = document.getElementById('autoAnalysisToggle');
  if (autoToggle) {
    // Load saved setting
    const savedSetting = localStorage.getItem('youglish-auto-analysis');
    autoToggle.checked = savedSetting !== 'false'; // Default to true
    
    // Update visual state
    updateToggleVisual(autoToggle);
    
    autoToggle.addEventListener('change', function() {
      const enabled = this.checked;
      localStorage.setItem('youglish-auto-analysis', enabled.toString());
      updateToggleVisual(this);
      
      console.log('🤖 Auto AI Analysis:', enabled ? 'ENABLED' : 'DISABLED');
      
      // Show feedback
      const feedback = enabled ? '✅ Auto AI Analysis enabled' : '⏸️ Auto AI Analysis disabled';
      if (currentText && window.setCurrentAnalysisText) {
        // Show brief status update
        const analysisStatus = document.getElementById('analysisStatus');
        if (analysisStatus) {
          const originalText = analysisStatus.textContent;
          analysisStatus.textContent = feedback;
          setTimeout(() => {
            analysisStatus.textContent = originalText;
          }, 2000);
        }
      }
    });
  }
  
  // Update toggle visual appearance
  function updateToggleVisual(toggle) {
    const slider = toggle.nextElementSibling;
    const knob = slider?.nextElementSibling;
    
    if (toggle.checked) {
      if (slider) slider.style.backgroundColor = '#2196F3';
      if (knob) knob.style.transform = 'translateX(26px)';
    } else {
      if (slider) slider.style.backgroundColor = '#ccc';
      if (knob) knob.style.transform = 'translateX(0px)';
    }
  }
  
  // Store reference to current text for the handlers
  window.setCurrentAnalysisText = (text) => {
    currentText = text;
  };
}

// Handle YouTube text analysis in sidepanel
function handleYouTubeTextAnalysis(text, url, title, forceReAnalysis = false) {
  console.log('📖 Handling YouTube text analysis:', text);
  
  const currentAnalysisSection = document.getElementById('currentAnalysisSection');
  const waitingSection = document.getElementById('waitingForText');
  const analysisTextDiv = document.getElementById('currentAnalysisText');
  const analysisStatus = document.getElementById('analysisStatus');
  const aiResultsDiv = document.getElementById('aiAnalysisResults');
  
  if (!currentAnalysisSection || !waitingSection) {
    console.log('❌ Video learning UI not initialized');
    return;
  }
  
  // Show analysis section, hide waiting section
  currentAnalysisSection.style.display = 'block';
  waitingSection.style.display = 'none';
  
  // Update text and status
  if (analysisTextDiv) {
    analysisTextDiv.textContent = text;
  }
  
  if (analysisStatus) {
    analysisStatus.textContent = '🔄 Analyzing with AI...';
  }
  
  // Store current text for handlers
  if (window.setCurrentAnalysisText) {
    window.setCurrentAnalysisText(text);
  }
  
  // Trigger existing analysis system
  const queryData = {
    text: text,
    url: url || '',
    title: title || '',
    language: 'english',
    source: 'youtube-learning',
    autoAnalysis: true,
    timestamp: new Date().toISOString()
  };
  
  // Trigger comprehensive AI analysis with proper setup
  setTimeout(async () => {
    try {
      console.log('🤖 Starting analysis for:', text);
      
      // Always load the basic YouGlish data first
      loadYouGlish(url, text, 'english');
      
      // Set up query data
      currentQueryData = {
        text: text,
        url: url || '',
        title: title || '',
        language: 'english',
        source: 'youtube-learning',
        autoAnalysis: true,
        timestamp: new Date().toISOString()
      };
      
      // Check if auto-analysis is enabled (unless forced)
      const autoAnalysisEnabled = forceReAnalysis || localStorage.getItem('youglish-auto-analysis') !== 'false';
      
      if (!autoAnalysisEnabled) {
        console.log('⏸️ Auto AI Analysis is disabled, showing manual trigger option');
        
        if (analysisStatus) {
          analysisStatus.innerHTML = `
            🤖 AI Analysis available 
            <button class="manual-analysis-btn" data-text="${text.replace(/'/g, "\\\\")}'" data-url="${url}" data-title="${title}"
                    style="margin-left: 8px; padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
              ▶️ Analyze Now
            </button>
          `;
        }
        
        if (aiResultsDiv) {
          showManualAnalysisPrompt(text);
        }
        
        return; // Skip automatic AI analysis
      }
      
      // Update status to show AI processing
      if (analysisStatus) {
        analysisStatus.textContent = '🤖 AI is analyzing... Please wait...';
      }
      
      // Check multiple ways to access AI service and trigger analysis
      let aiAnalysisCompleted = false;
      
      // Method 1: Direct AI service access
      if (typeof window.aiService !== 'undefined' && window.aiService) {
        console.log('🤖 Direct AI Service found, starting analysis...');
        
        try {
          const analysis = await window.aiService.analyzeText(text, {
            language: 'english',
            includeDefinitions: true,
            includeExamples: true,
            includeGrammar: true,
            includePronunciation: true
          });
          
          if (analysis && analysis.success) {
            console.log('✅ Direct AI Analysis completed:', analysis);
            aiAnalysisCompleted = true;
            
            // Update status
            if (analysisStatus) {
              analysisStatus.textContent = '✅ AI Analysis complete! 🎉';
            }
            
            // Display AI results in the video tab
            if (aiResultsDiv) {
              displayAIAnalysisResults(analysis, text);
            }
            
            // Also trigger automatic audio if available
            if (analysis.pronunciation && window.speechSynthesis) {
              setTimeout(() => {
                speakTextWithAI(text, analysis.pronunciation);
              }, 1000);
            }
          }
          
        } catch (aiError) {
          console.log('⚠️ Direct AI Service error:', aiError);
        }
      }
      
      // Method 2: Try existing AI analysis trigger mechanisms
      if (!aiAnalysisCompleted) {
        console.log('🔄 Trying existing AI analysis triggers...');
        
        // Try to trigger existing AI analysis via the existing mechanisms
        try {
          // Set auto-analysis flag and simulate existing flow
          const autoAnalysisEnabled = localStorage.getItem('youglish-auto-analysis') !== 'false';
          
          if (autoAnalysisEnabled && typeof window.performAnalysis === 'function') {
            console.log('🎯 Using existing performAnalysis function');
            await window.performAnalysis(text, 'english');
            aiAnalysisCompleted = true;
            
            if (analysisStatus) {
              analysisStatus.textContent = '✅ Analysis complete via existing system!';
            }
          }
          
          // Try alternative AI service paths
          if (!aiAnalysisCompleted && typeof window.aiGenerateGrammarAnalysis === 'function') {
            console.log('🎯 Using grammar analysis function');
            await window.aiGenerateGrammarAnalysis(text);
            aiAnalysisCompleted = true;
            
            if (analysisStatus) {
              analysisStatus.textContent = '✅ Grammar analysis complete!';
            }
          }
          
        } catch (existingError) {
          console.log('⚠️ Existing AI triggers failed:', existingError);
        }
      }
      
      // Method 3: Force trigger by mimicking user interaction
      if (!aiAnalysisCompleted) {
        console.log('🔄 Force triggering AI analysis...');
        
        setTimeout(async () => {
          try {
            // Find and click the AI analysis button if it exists
            const aiButton = document.querySelector('#aiAnalysisBtn, .ai-analysis-btn, [data-action="ai-analysis"]');
            if (aiButton && !aiButton.disabled) {
              console.log('🎯 Clicking AI analysis button');
              aiButton.click();
              aiAnalysisCompleted = true;
              
              if (analysisStatus) {
                analysisStatus.textContent = '✅ AI analysis triggered via button click!';
              }
            }
            
            // Alternative: Try to trigger via existing event system
            if (!aiAnalysisCompleted) {
              console.log('🔄 Triggering via event system...');
              
              // Create and dispatch a custom event to trigger AI analysis
              const aiEvent = new CustomEvent('triggerAIAnalysis', {
                detail: { text: text, language: 'english', autoTrigger: true }
              });
              
              document.dispatchEvent(aiEvent);
              window.dispatchEvent(aiEvent);
              
              if (analysisStatus) {
                analysisStatus.textContent = '✅ AI analysis requested via events!';
              }
            }
            
          } catch (forceError) {
            console.log('⚠️ Force trigger failed:', forceError);
          }
        }, 500);
      }
      
      // Fallback if nothing worked
      if (!aiAnalysisCompleted) {
        setTimeout(() => {
          if (analysisStatus && analysisStatus.textContent.includes('analyzing')) {
            console.log('⚠️ No AI analysis triggered, showing fallback');
            showFallbackAnalysis(text);
          }
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Analysis error:', error);
      if (analysisStatus) {
        analysisStatus.textContent = '❌ Analysis failed. Please try again.';
      }
    }
  }, 300);
}

// Handle Netflix text analysis in sidepanel
function handleNetflixTextAnalysis(text, url, title, videoId, movieId, forceReAnalysis = false) {
  console.log('🎭 Handling Netflix text analysis:', text, {
    url, title, videoId, movieId
  });
  
  const currentAnalysisSection = document.getElementById('currentAnalysisSection');
  const waitingSection = document.getElementById('waitingForText');
  const analysisTextDiv = document.getElementById('currentAnalysisText');
  const analysisStatus = document.getElementById('analysisStatus');
  const aiResultsDiv = document.getElementById('aiAnalysisResults');
  
  if (!currentAnalysisSection || !waitingSection) {
    console.log('❌ Video learning UI not initialized');
    return;
  }
  
  // Show analysis section, hide waiting section
  currentAnalysisSection.style.display = 'block';
  waitingSection.style.display = 'none';
  
  // Update text and status
  if (analysisTextDiv) {
    analysisTextDiv.textContent = text;
  }
  
  if (analysisStatus) {
    analysisStatus.textContent = '🎭 Analyzing Netflix content with AI...';
  }
  
  // Store current text for handlers
  if (window.setCurrentAnalysisText) {
    window.setCurrentAnalysisText(text);
  }
  
  // Trigger existing analysis system
  const queryData = {
    text: text,
    url: url || '',
    title: title || '',
    videoId: videoId,
    movieId: movieId,
    language: 'english',
    source: 'netflix-learning',
    platform: 'netflix',
    autoAnalysis: true,
    timestamp: new Date().toISOString()
  };
  
  // Trigger comprehensive AI analysis with proper setup
  setTimeout(async () => {
    try {
      console.log('🤖 Starting Netflix analysis for:', text);
      
      // Always load the basic YouGlish data first
      loadYouGlish(url, text, 'english');
      
      // Set up query data
      currentQueryData = {
        text: text,
        url: url || '',
        title: title || '',
        videoId: videoId,
        movieId: movieId,
        language: 'english',
        source: 'netflix-learning',
        platform: 'netflix',
        autoAnalysis: true,
        timestamp: new Date().toISOString()
      };
      
      // Check if auto-analysis is enabled (unless forced)
      const autoAnalysisEnabled = forceReAnalysis || localStorage.getItem('youglish-auto-analysis') !== 'false';
      
      if (!autoAnalysisEnabled) {
        console.log('⏸️ Auto AI Analysis is disabled, showing manual trigger option');
        
        if (analysisStatus) {
          analysisStatus.innerHTML = `
            🎭 Netflix AI Analysis available 
            <button class="manual-analysis-btn" data-text="${text.replace(/'/g, "\\\\'")}" data-url="${url}" data-title="${title}"
                    style="margin-left: 8px; padding: 4px 8px; background: #e50914; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
              ▶️ Analyze Now
            </button>
          `;
        }
        
        if (aiResultsDiv) {
          showManualAnalysisPrompt(text);
        }
        
        return; // Skip automatic AI analysis
      }
      
      // Update status to show AI processing
      if (analysisStatus) {
        analysisStatus.textContent = '🎭 Netflix AI is analyzing... Please wait...';
      }
      
      // Check multiple ways to access AI service and trigger analysis
      let aiAnalysisCompleted = false;
      
      // Method 1: Direct AI service access
      if (typeof window.aiService !== 'undefined' && window.aiService) {
        console.log('🤖 Direct AI Service found, starting Netflix analysis...');
        
        try {
          const analysis = await window.aiService.analyzeText(text, {
            language: 'english',
            complexity: 'enhanced',
            source: 'netflix-learning',
            platform: 'netflix'
          });
          
          if (analysis && analysis.content) {
            console.log('✅ Netflix AI analysis completed via direct service');
            displayAIAnalysisResults(analysis, text);
            aiAnalysisCompleted = true;
            
            if (analysisStatus) {
              analysisStatus.textContent = '✅ Netflix AI analysis completed!';
            }
          }
        } catch (error) {
          console.error('❌ Direct Netflix AI service failed:', error);
        }
      }
      
      // Method 2: Fallback to basic analysis if direct method failed
      if (!aiAnalysisCompleted) {
        console.log('🔄 Using fallback Netflix analysis method...');
        
        if (analysisStatus) {
          analysisStatus.textContent = '🎭 Netflix analysis using fallback method...';
        }
        
        // Trigger a basic analysis for Netflix content
        setTimeout(() => {
          if (analysisStatus) {
            analysisStatus.textContent = '✅ Netflix basic analysis completed!';
          }
          
          // Show a basic Netflix analysis result
          if (aiResultsDiv) {
            aiResultsDiv.innerHTML = `
              <div class="netflix-analysis-result" style="background: #2a2a2a; color: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h3 style="color: #e50914; margin-top: 0;">🎭 Netflix Content Analysis</h3>
                <p><strong>Selected Text:</strong> "${text}"</p>
                <p><strong>Source:</strong> ${title || 'Netflix Content'}</p>
                <div style="margin-top: 10px; padding: 10px; background: rgba(229, 9, 20, 0.1); border-radius: 4px;">
                  <p style="margin: 0;"><strong>Note:</strong> Full AI analysis requires configuration. This text has been added to your learning history and you can use YouGlish search above to find pronunciation examples.</p>
                </div>
              </div>
            `;
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ Netflix text analysis error:', error);
      
      if (analysisStatus) {
        analysisStatus.textContent = '❌ Netflix analysis failed';
      }
    }
  }, 300);
}

// Handle Udemy text analysis in sidepanel
function handleUdemyTextAnalysis(text, url, title, courseTitle, lectureTitle, videoId, forceReAnalysis = false) {
  console.log('📚 Handling Udemy text analysis:', text, {
    url, title, courseTitle, lectureTitle, videoId
  });
  
  const currentAnalysisSection = document.getElementById('currentAnalysisSection');
  const waitingSection = document.getElementById('waitingForText');
  const analysisTextDiv = document.getElementById('currentAnalysisText');
  const analysisStatus = document.getElementById('analysisStatus');
  const aiResultsDiv = document.getElementById('aiAnalysisResults');
  
  // Show analysis section
  if (currentAnalysisSection && waitingSection) {
    currentAnalysisSection.style.display = 'block';
    waitingSection.style.display = 'none';
  }
  
  // Update text display
  if (analysisTextDiv) {
    analysisTextDiv.innerHTML = `
      <strong style="color: #a435f0; font-size: 14px;">📚 ${courseTitle}</strong><br>
      <span style="color: #666; font-size: 12px;">${lectureTitle}</span><br><br>
      <span style="font-size: 16px; font-weight: 500;">${text}</span>
    `;
  }
  
  // Create return button with course context
  const returnButtonContainer = document.getElementById('returnToVideoBtn');
  if (returnButtonContainer && url) {
    const courseName = courseTitle || 'Udemy Course';
    returnButtonContainer.innerHTML = `
      <button onclick="window.open('${url}', '_blank')" style="
        background: #a435f0; 
        color: white; 
        border: none; 
        padding: 10px 16px; 
        border-radius: 6px; 
        cursor: pointer; 
        font-size: 14px; 
        display: flex; 
        align-items: center; 
        gap: 8px;
      ">
        📚 Return to ${courseName}
      </button>
    `;
  }
  
  // Update with enhanced context for learning
  const enhancedQuery = {
    text: text,
    language: 'english',
    source: 'udemy-learning',
    platform: 'udemy',
    autoAnalysis: true,
    timestamp: new Date().toISOString()
  };
  
  // Check if auto-analysis is enabled (unless forced)
  const autoAnalysisEnabled = forceReAnalysis || localStorage.getItem('youglish-auto-analysis') !== 'false';
  
  if (!autoAnalysisEnabled) {
    console.log('⏸️ Auto AI Analysis is disabled, showing manual trigger option');
    
    if (analysisStatus) {
      analysisStatus.innerHTML = `
        📚 Udemy AI Analysis available 
        <button class="manual-analysis-btn" data-text="${text.replace(/'/g, "\\\\'")}" data-url="${url}" data-title="${title}"
                style="margin-left: 8px; padding: 4px 8px; background: #a435f0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
          ▶️ Analyze Now
        </button>
      `;
    }
    
    if (aiResultsDiv) {
      showManualAnalysisPrompt(text);
    }
    
    return; // Skip automatic AI analysis
  }
  
  // Update status to show AI processing
  if (analysisStatus) {
    analysisStatus.textContent = '📚 Udemy AI is analyzing... Please wait...';
  }
  
  // Check multiple ways to access AI service and trigger analysis
  let aiAnalysisCompleted = false;
  
  // Method 1: Direct AI service access
  if (typeof window.aiService !== 'undefined' && window.aiService) {
    console.log('🤖 Direct AI Service found, starting Udemy analysis...');
    
    try {
      window.aiService.analyzeText(text, {
        language: 'english',
        complexity: 'enhanced',
        source: 'udemy-learning',
        platform: 'udemy'
      }).then(analysis => {
        if (analysis && analysis.content) {
          console.log('✅ Direct Udemy AI analysis completed');
          displayAIAnalysisResults(analysis, text);
          aiAnalysisCompleted = true;
          if (analysisStatus) {
            analysisStatus.textContent = '✅ Udemy AI Analysis completed';
          }
        }
      }).catch(error => {
        console.error('❌ Direct Udemy AI analysis failed:', error);
      });
    } catch (error) {
      console.error('❌ Error calling direct Udemy AI service:', error);
    }
  }
  
  // Method 2: Try message-based approach as fallback
  if (!aiAnalysisCompleted) {
    setTimeout(() => {
      if (!aiAnalysisCompleted && currentQuery && currentQuery.text === text) {
        console.log('📚 Direct AI failed, trying message-based approach for Udemy analysis...');
        
        try {
          if (window.getCurrentQuery) {
            const query = window.getCurrentQuery();
            if (query && query.text === text) {
              console.log('✅ Message-based Udemy AI analysis might be running');
              setTimeout(() => {
                if (analysisStatus && analysisStatus.textContent.includes('analyzing')) {
                  analysisStatus.textContent = '✅ Udemy AI Analysis completed';
                }
              }, 3000);
            }
          }
        } catch (error) {
          console.error('❌ Error with message-based Udemy analysis:', error);
        }
      }
    }, 1000);
  }
  
  // Update global query for other components to access
  window.currentQuery = enhancedQuery;
  if (typeof window.getCurrentQuery === 'function') {
    window.currentQuery = enhancedQuery;
  }
  
  // Trigger analysis update after a brief delay
  setTimeout(() => {
    if (typeof updateCurrentAnalysis === 'function') {
      updateCurrentAnalysis();
    }
  }, 300);
}

// Display comprehensive AI analysis results in video tab
function displayAIAnalysisResults(analysis, text) {
  const aiResultsDiv = document.getElementById('aiAnalysisResults');
  if (!aiResultsDiv) return;
  
  // Clear any existing content to prevent transcript data from showing
  aiResultsDiv.innerHTML = '';
  
  // Filter out analysis that contains transcript-like content
  if (analysis && analysis.content && typeof analysis.content === 'string') {
    // If analysis contains multiple segments or timestamp-like patterns, it might be transcript data
    const suspiciousPatterns = [
      /\d+:\d+/g, // Timestamp patterns like 5:23
      /\d+\s+segments?/gi, // References to segments
      /transcript|subtitle|caption/gi, // Direct references to transcript
      /<tr|<td|<table/gi // HTML table elements that might be transcript viewer
    ];
    
    const hasSuspiciousContent = suspiciousPatterns.some(pattern => 
      pattern.test(analysis.content)
    );
    
    if (hasSuspiciousContent || analysis.content.length > 2000) {
      console.log('🚫 Filtering out suspected transcript data from AI analysis');
      // Show a clean error message instead
      showFallbackAnalysis(text);
      return;
    }
  }
  
  const isWord = text.split(' ').length === 1;
  
  let resultHTML = `
    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #28a745;">
      <div style="font-weight: bold; margin-bottom: 12px; color: #28a745; font-size: 16px;">
        🤖 ${isWord ? 'AI Word Analysis' : 'AI Text Analysis'}
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">"${text}"</div>
  `;
  
  // Add definitions if available (filter out transcript-like content)
  if (analysis.definitions && analysis.definitions.length > 0) {
    // Filter out definitions that look like transcript segments
    const cleanDefinition = analysis.definitions[0];
    if (cleanDefinition && !cleanDefinition.includes('timestamp') && cleanDefinition.length < 500) {
      resultHTML += `
        <div style="margin-bottom: 12px;">
          <strong>📚 Definition:</strong>
          <div style="color: #666; margin-top: 4px;">${cleanDefinition}</div>
        </div>
      `;
    }
  }
  
  // Add pronunciation if available
  if (analysis.pronunciation) {
    resultHTML += `
      <div style="margin-bottom: 12px;">
        <strong>🔊 Pronunciation:</strong>
        <span style="color: #666; margin-left: 8px;">${analysis.pronunciation}</span>
        <button class="speak-ai-btn" data-text="${text}" data-pronunciation="${analysis.pronunciation}" style="margin-left: 10px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🔊 Play</button>
      </div>
    `;
  }
  
  // Add examples if available (filter out transcript-like content)
  if (analysis.examples && analysis.examples.length > 0) {
    // Filter out examples that look like transcript segments
    const cleanExample = analysis.examples[0];
    if (cleanExample && !cleanExample.includes('timestamp') && cleanExample.length < 300) {
      resultHTML += `
        <div style="margin-bottom: 12px;">
          <strong>💡 Example:</strong>
          <div style="color: #666; font-style: italic; margin-top: 4px;">"${cleanExample}"</div>
        </div>
      `;
    }
  }
  
  resultHTML += `
      </div>
      <div style="font-size: 14px; color: #888; text-align: center;">
        ✨ Switch to <strong>Analysis</strong> tab for complete AI insights with grammar, usage, and more examples!
      </div>
    </div>
  `;
  
  aiResultsDiv.innerHTML = resultHTML;
  
  // Add event listeners for speak AI buttons (after innerHTML is set)
  const speakBtns = aiResultsDiv.querySelectorAll('.speak-ai-btn');
  speakBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text;
      const pronunciation = btn.dataset.pronunciation;
      speakTextWithAI(text, pronunciation);
    });
  });
}

// Fallback analysis when AI is not available
function showFallbackAnalysis(text) {
  const aiResultsDiv = document.getElementById('aiAnalysisResults');
  const analysisStatus = document.getElementById('analysisStatus');
  
  if (analysisStatus) {
    analysisStatus.textContent = '✅ Basic analysis ready. Full AI analysis available in Analysis tab.';
  }
  
  if (aiResultsDiv) {
    const isWord = text.split(' ').length === 1;
    aiResultsDiv.innerHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-weight: bold; margin-bottom: 8px;">
          ${isWord ? '📖 Basic Word Analysis' : '📝 Basic Text Analysis'}
        </div>
        <div style="margin-bottom: 10px; color: #666;">
          "${text}"
        </div>
        <div style="font-size: 14px; color: #888;">
          ✨ Full AI analysis with definitions, examples, and grammar is available in the <strong>Analysis</strong> tab above.
          <br>💡 The system will automatically trigger comprehensive AI analysis there!
        </div>
      </div>
    `;
  }
}

// Enhanced speech with AI pronunciation data
function speakTextWithAI(text, pronunciation = null) {
  console.log('🔊 Speaking with AI enhancement:', text, pronunciation);
  
  try {
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.7; // Slightly slower for learning
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Use AI pronunciation data if available
    if (pronunciation) {
      console.log('🎯 Using AI pronunciation guide:', pronunciation);
      // Note: Most browsers don't support IPA directly, but we log it for learning
    }
    
    utterance.onstart = () => {
      console.log('🔊 AI-enhanced speech started');
      const speakBtn = document.getElementById('speakCurrentText');
      if (speakBtn) {
        speakBtn.textContent = '🔊 Playing...';
        speakBtn.disabled = true;
      }
    };
    
    utterance.onend = () => {
      console.log('✅ AI-enhanced speech completed');
      const speakBtn = document.getElementById('speakCurrentText');
      if (speakBtn) {
        speakBtn.textContent = '🔊 Speak';
        speakBtn.disabled = false;
      }
    };
    
    utterance.onerror = (e) => {
      console.error('❌ Speech error:', e);
      const speakBtn = document.getElementById('speakCurrentText');
      if (speakBtn) {
        speakBtn.textContent = '🔊 Speak';
        speakBtn.disabled = false;
      }
    };
    
    speechSynthesis.speak(utterance);
    
  } catch (error) {
    console.error('❌ Speech synthesis error:', error);
  }
}

// Make speakTextWithAI globally available
window.speakTextWithAI = speakTextWithAI;

// Manual analysis trigger function
window.triggerManualAnalysis = function(text, url, title) {
  console.log('🎯 Manual AI analysis triggered for:', text);
  
  // Show loading state
  const analysisStatus = document.getElementById('analysisStatus');
  if (analysisStatus) {
    analysisStatus.textContent = '🤖 AI is analyzing... Please wait...';
  }
  
  // Trigger analysis with force flag
  handleYouTubeTextAnalysis(text, url, title, true);
};

// Show manual analysis prompt
function showManualAnalysisPrompt(text) {
  const aiResultsDiv = document.getElementById('aiAnalysisResults');
  if (!aiResultsDiv) return;
  
  const isWord = text.split(' ').length === 1;
  
  aiResultsDiv.innerHTML = `
    <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #ff9800; text-align: center;">
      <div style="font-weight: bold; margin-bottom: 12px; color: #e65100; font-size: 16px;">
        🤖 ${isWord ? 'AI Word Analysis' : 'AI Text Analysis'} Available
      </div>
      <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">"${text}"</div>
        <div style="color: #666; font-size: 14px; margin-bottom: 12px;">
          AI analysis is available but auto-analysis is currently disabled.
        </div>
        <button class="manual-analysis-btn" data-text="${text.replace(/'/g, "\\\\'")}" data-url="${window.location.href}" data-title="${document.title}"
                style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin: 5px;">
          🤖 Analyze with AI
        </button>
      </div>
      <div style="font-size: 12px; color: #666;">
        💡 Enable "Auto AI Analysis" above to automatically analyze all selected text
      </div>
    </div>
  `;
}

// Console-accessible AI diagnostics function - NON-BLOCKING VERSION
window.runAIDiagnostics = async function() {
  console.log('🔍 Starting non-blocking AI diagnostics...');
  
  try {
    // Initialize AI service if needed
    if (!window.aiService) {
      console.log('🔧 Initializing AI service...');
      const { default: AIService } = await import('./lib/ai-service.js');
      window.aiService = new AIService();
      await window.aiService.initialize();
    }
    
    // Run diagnostics with timeout protection to prevent browser freezing
    console.log('⏱️ Running diagnostics with 10-second timeout...');
    const diagnosticsPromise = window.aiService.runDiagnostics();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Diagnostics timeout after 10 seconds')), 10000)
    );
    
    const diagnosticsResult = await Promise.race([diagnosticsPromise, timeoutPromise]);
    
    console.log('✅ Diagnostics completed successfully!');
    console.log('📊 Full diagnostic report:', diagnosticsResult);
    
    // Show summary in a user-friendly format
    console.log('\n' + '='.repeat(50));
    console.log('🎯 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(50));
    
    if (diagnosticsResult.tests.network) {
      const network = diagnosticsResult.tests.network;
      console.log(`🌐 Network: ${network.connected ? '✅ Connected' : '❌ Failed'}`);
      if (network.connected) {
        console.log(`   Latency: ${network.latency}ms ${network.latency > 2000 ? '(Slow)' : '(Good)'}`);
      } else {
        console.log(`   Error: ${network.error}`);
      }
    }
    
    if (diagnosticsResult.tests.openai) {
      const openai = diagnosticsResult.tests.openai;
      console.log(`🤖 OpenAI API: ${openai.accessible ? '✅ Working' : '❌ Failed'}`);
      if (!openai.accessible) {
        console.log(`   Error: ${openai.error}`);
      }
    }
    
    if (diagnosticsResult.tests.analysis) {
      const analysis = diagnosticsResult.tests.analysis;
      console.log(`🧠 AI Analysis: ${analysis.success ? '✅ Working' : '❌ Failed'}`);
      if (!analysis.success) {
        console.log(`   Error: ${analysis.error}`);
      }
    }
    
    console.log('='.repeat(50));
    
    // Provide troubleshooting guidance
    if (diagnosticsResult.tests.network && !diagnosticsResult.tests.network.connected) {
      console.log('🔧 TROUBLESHOOTING: Network issues detected');
      console.log('   1. Check your internet connection');
      console.log('   2. Try refreshing the page');
      console.log('   3. Check if you\'re behind a firewall or proxy');
    } else if (diagnosticsResult.tests.openai && !diagnosticsResult.tests.openai.accessible) {
      console.log('🔧 TROUBLESHOOTING: OpenAI API issues detected');
      console.log('   1. Check OpenAI service status: https://status.openai.com');
      console.log('   2. Verify your API key is valid');
      console.log('   3. Check if you have sufficient API credits');
      console.log('   4. Try the OpenAI playground: https://platform.openai.com/playground');
    } else if (diagnosticsResult.tests.analysis && !diagnosticsResult.tests.analysis.success) {
      console.log('🔧 TROUBLESHOOTING: AI analysis issues detected');
      console.log('   1. This might be a temporary issue with OpenAI');
      console.log('   2. Try again in a few minutes');
      console.log('   3. Check if the issue persists across different texts');
    } else {
      console.log('✅ All systems appear to be working normally');
      console.log('   If you\'re still experiencing issues, it might be:');
      console.log('   - Temporary OpenAI service congestion');
      console.log('   - Regional network issues');
      console.log('   - Browser-specific problems (try refreshing)');
    }
    
    console.log('\n💡 To test OpenAI directly:');
    console.log('   1. Visit: https://status.openai.com');
    console.log('   2. Test at: https://platform.openai.com/playground');
    console.log('   3. Check your API usage: https://platform.openai.com/usage');
    
    return diagnosticsResult;
    
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
    
    // If it's a timeout, provide specific guidance
    if (error.message.includes('timeout')) {
      console.log('\n⚠️ TIMEOUT DETECTED - This suggests the issue is with OpenAI or network');
      console.log('🔧 Recommended actions:');
      console.log('   1. Check OpenAI status: https://status.openai.com');
      console.log('   2. The 10-second timeout means OpenAI is likely slow/down');
      console.log('   3. Try again in 5-10 minutes');
      console.log('   4. Consider switching to Gemini temporarily');
    } else {
      console.log('\n🔧 Basic troubleshooting steps:');
      console.log('   1. Refresh the page and try again');
      console.log('   2. Check your internet connection');
      console.log('   3. Verify your AI settings in the extension options');
      console.log('   4. Check OpenAI service status: https://status.openai.com');
    }
    
    return { success: false, error: error.message };
  }
};

console.log('🔧 Diagnostic tool loaded! Run window.runAIDiagnostics() to test AI services');