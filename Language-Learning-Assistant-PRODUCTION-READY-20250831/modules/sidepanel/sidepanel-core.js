// Sidepanel Core Utilities Module
// Import production logger
if (typeof logger === 'undefined') {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('lib/production-logger.js');
    document.head.appendChild(script);
  } catch (e) {
    console.warn('Could not load production logger:', e);
  }
}

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
  if (typeof logger !== 'undefined') {
    logger.info(...args);
  } else if (typeof PerformanceUtils !== 'undefined') {
    PerformanceUtils.log(...args);
  } else {
    console.log(...args);
  }
};

// Safe error handling wrapper
const handleError = async (error, context = {}) => {
  if (typeof window !== 'undefined' && window.globalErrorHandler && typeof window.globalErrorHandler.handleError === 'function') {
    return await window.globalErrorHandler.handleError(error, context);
  }
  if (typeof logger !== 'undefined') {
    logger.error('Error:', error);
  } else {
    console.error('Error:', error);
  }
  return { success: false, error: error.message };
};

// Core message handler router
class SidepanelMessageRouter {
  constructor() {
    this.handlers = new Map();
    this.setupDefaultHandlers();
  }

  // Register message handlers
  registerHandler(action, handler) {
    this.handlers.set(action, handler);
  }

  // Setup default message handlers
  setupDefaultHandlers() {
    this.registerHandler('recordNetflixLearning', this.handleNetflixLearning.bind(this));
    this.registerHandler('recordUdemyLearning', this.handleUdemyLearning.bind(this));
    this.registerHandler('recordCourseraLearning', this.handleCourseraLearning.bind(this));
    this.registerHandler('updateSidePanel', this.handleUpdateSidePanel.bind(this));
    this.registerHandler('switchToAIAnalysisTab', this.handleSwitchToAnalysisTab.bind(this));
  }

  // Handle incoming messages
  async handleMessage(request, sender, sendResponse) {
    logSafely('🔔 Sidepanel received message:', request.action, request.source);
    
    const handler = this.handlers.get(request.action);
    if (handler) {
      try {
        const result = await handler(request, sender);
        sendResponse(result || { success: true });
      } catch (error) {
        const errorResult = await handleError(error, { action: request.action });
        sendResponse(errorResult);
      }
    } else {
      logSafely('⚠️ No handler found for action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  // Netflix learning handler
  async handleNetflixLearning(request) {
    logSafely('🎭 Recording Netflix learning segment:', request.data);
    const data = request.data;
    
    // Import dashboard functions if not available
    if (typeof recordLearningSearch === 'function') {
      recordLearningSearch(data.text, data.language, data.url, data.title, 'netflix', null);
    }
    if (typeof updateLearningDashboard === 'function') {
      updateLearningDashboard();
    }
    
    return { success: true };
  }

  // Udemy learning handler
  async handleUdemyLearning(request) {
    logSafely('📚 Recording Udemy learning segment:', request.data);
    const data = request.data;
    
    if (typeof recordLearningSearch === 'function') {
      recordLearningSearch(data.text, data.language, data.url, data.title, 'udemy', data.courseTitle);
    }
    if (typeof updateLearningDashboard === 'function') {
      updateLearningDashboard();
    }
    
    return { success: true };
  }

  // Coursera learning handler
  async handleCourseraLearning(request) {
    logSafely('🎓 Recording Coursera learning segment:', request.data);
    const data = request.data;
    
    if (typeof recordLearningSearch === 'function') {
      recordLearningSearch(data.text, data.language, data.url, data.title, 'coursera', data.courseTitle);
    }
    if (typeof updateLearningDashboard === 'function') {
      updateLearningDashboard();
    }
    
    return { success: true };
  }

  // Update sidepanel handler
  async handleUpdateSidePanel(request) {
    if (request.source === 'youtube-learning') {
      logSafely('📖 Received YouTube learning text:', request.text);
      
      // Switch to video tab if not already there
      const videoBtn = document.getElementById('showVideoBtn');
      if (videoBtn) {
        videoBtn.click();
      }
      
      // Handle the analysis in the video tab
      setTimeout(() => {
        if (typeof recordLearningSearch === 'function') {
          recordLearningSearch(request.text, request.language, request.url, request.title, request.platform, request.courseTitle);
        }
        if (typeof updateLearningDashboard === 'function') {
          updateLearningDashboard();
        }
        if (typeof handleYouTubeTextAnalysis === 'function') {
          handleYouTubeTextAnalysis(request.text, request.url, request.title);
        }
      }, 200);
      
      // Also trigger the normal analysis for the Analysis tab
      if (typeof loadYouGlish === 'function') {
        loadYouGlish(request.url, request.text, request.language);
      }
    } else {
      // Regular analysis
      if (typeof loadYouGlish === 'function') {
        loadYouGlish(request.url, request.text, request.language);
      }
    }
    
    return { success: true };
  }

  // Switch to AI Analysis tab handler
  async handleSwitchToAnalysisTab(request) {
    logSafely('🎯 Switching to AI Analysis tab after analyzing:', request.text);
    
    // Switch to Analysis tab
    const analysisBtn = document.getElementById('showAnalysisBtn');
    if (analysisBtn) {
      analysisBtn.click();
      logSafely('✅ Successfully switched to AI Analysis tab');
      
      // Small delay to ensure tab is loaded, then trigger analysis display
      setTimeout(() => {
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
      logSafely('❌ Could not find Analysis tab button');
    }
    
    return { success: true };
  }
}

// Initialize message router
const messageRouter = new SidepanelMessageRouter();

// Set up global message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  messageRouter.handleMessage(request, sender, sendResponse);
  return true; // Keep message channel open for async response
});

// Export for use by other modules
window.SidepanelCore = {
  languageNames,
  logSafely,
  handleError,
  messageRouter
};