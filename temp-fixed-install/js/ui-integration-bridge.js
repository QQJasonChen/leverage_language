/**
 * UI Integration Bridge
 * Connects the professional UI with existing functionality
 */

class UIIntegrationBridge {
  constructor() {
    this.originalFunctions = {};
    this.professionalUI = null;
    this.init();
  }

  init() {
    // Wait for both systems to be ready
    this.waitForSystems().then(() => {
      this.setupIntegration();
    });
  }

  async waitForSystems() {
    // Wait for professional UI
    while (!window.professionalUI) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.professionalUI = window.professionalUI;

    // Wait for original sidepanel functions
    while (!window.loadYouGlish && !window.loadSavedReports) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  setupIntegration() {
    console.log('🔗 Setting up UI integration bridge...');
    
    // Override key functions to work with professional UI
    this.integrateAnalysisFunction();
    this.integrateHistoryFunction();
    this.integrateSavedReportsFunction();
    this.integrateAudioFunction();
    this.setupMessageListeners();
    
    console.log('✅ UI integration bridge ready');
  }

  integrateAnalysisFunction() {
    // Store original function
    if (window.loadYouGlish) {
      this.originalFunctions.loadYouGlish = window.loadYouGlish;
      
      // Override to work with professional UI
      window.loadYouGlish = (url, text, language) => {
        console.log('🎯 Professional UI: Loading analysis for:', text);
        
        // Switch to analysis view
        this.professionalUI.switchToView('analysis');
        
        // Show analysis result
        this.professionalUI.showAnalysisResult(text, language || 'auto');
        
        // Start analysis with integration to existing AI service
        this.startIntegratedAnalysis(text, language, url);
      };
    }
  }

  async startIntegratedAnalysis(text, language, url) {
    try {
      // Use existing AI analysis if available
      if (window.aiService && window.aiService.analyzeText) {
        const result = await window.aiService.analyzeText(text, language);
        this.displayProfessionalAnalysis(result);
      } else {
        // Fallback to calling original function
        if (this.originalFunctions.loadYouGlish) {
          this.originalFunctions.loadYouGlish(url, text, language);
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
      this.professionalUI.showAnalysisError(error.message);
    }
  }

  displayProfessionalAnalysis(analysisResult) {
    if (!analysisResult) return;

    // Convert existing analysis format to professional UI format
    const professionalFormat = this.convertAnalysisFormat(analysisResult);
    this.professionalUI.displayAnalysisResult(professionalFormat);
  }

  convertAnalysisFormat(originalResult) {
    // Convert the existing analysis format to our professional format
    let converted = {
      translation: '',
      grammar: '', 
      pronunciation: '',
      cultural: '',
      errors: [],
      isCorrect: true
    };

    if (typeof originalResult === 'string') {
      // If it's just a string, parse it intelligently
      const content = originalResult;
      
      // Look for translation section
      const translationMatch = content.match(/\*\*中文翻譯\*\*[：:]\s*(.+?)(?=\n\n|\*\*|$)/s);
      if (translationMatch) {
        converted.translation = translationMatch[1].trim();
      }
      
      // Look for grammar section
      const grammarMatch = content.match(/\*\*語法結構\*\*[：:]\s*(.+?)(?=\n\n|\*\*|$)/s);
      if (grammarMatch) {
        converted.grammar = grammarMatch[1].trim();
      }
      
      // Look for pronunciation section
      const pronunciationMatch = content.match(/\*\*發音要點\*\*[：:]\s*(.+?)(?=\n\n|\*\*|$)/s);
      if (pronunciationMatch) {
        converted.pronunciation = pronunciationMatch[1].trim();
      }
      
      // Look for cultural context
      const culturalMatch = content.match(/\*\*文化背景\*\*[：:]\s*(.+?)(?=\n\n|\*\*|$)/s);
      if (culturalMatch) {
        converted.cultural = culturalMatch[1].trim();
      }
      
      // If no structured content found, use the whole thing as general analysis
      if (!converted.translation && !converted.grammar) {
        converted.grammar = content;
      }
    }

    return converted;
  }

  integrateHistoryFunction() {
    if (window.loadHistory) {
      this.originalFunctions.loadHistory = window.loadHistory;
      
      window.loadHistory = async () => {
        console.log('🕒 Professional UI: Loading history');
        
        // Get history data from original function
        try {
          const historyData = await this.getHistoryData();
          this.displayProfessionalHistory(historyData);
        } catch (error) {
          console.error('History loading error:', error);
        }
      };
    }
  }

  async getHistoryData() {
    // Try to get history from existing system
    if (window.historyManager && window.historyManager.getRecentRecords) {
      return await window.historyManager.getRecentRecords(50);
    }
    
    // Fallback to storage
    return new Promise((resolve) => {
      chrome.storage.local.get(['searchHistory'], (data) => {
        resolve(data.searchHistory || []);
      });
    });
  }

  displayProfessionalHistory(historyData) {
    const historyList = document.getElementById('historyList');
    if (!historyList || !historyData.length) {
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <h3 class="empty-state-title">No history yet</h3>
          <p class="empty-state-description">Start analyzing text to build your learning history</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = historyData.map(item => {
      const sourceType = this.detectSourceType(item);
      const timeAgo = this.formatTimeAgo(item.timestamp);
      
      return `
        <div class="history-item" onclick="professionalUIBridge.loadHistoryItem('${item.id || item.text}')">
          <div class="history-item-icon ${sourceType}">
            ${sourceType === 'article' ? 'A' : 'V'}
          </div>
          <div class="history-item-content">
            <div class="history-item-text">${item.text || item.searchText}</div>
            <div class="history-item-meta">
              <span class="badge badge-primary">${item.language || 'Unknown'}</span>
              <span>${timeAgo}</span>
              ${item.videoSource ? `<span>${item.videoSource.title || item.videoSource.domain || 'Source'}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  integrateSavedReportsFunction() {
    if (window.loadSavedReports) {
      this.originalFunctions.loadSavedReports = window.loadSavedReports;
      
      window.loadSavedReports = async () => {
        console.log('💾 Professional UI: Loading saved reports');
        
        try {
          const reportsData = await this.getSavedReportsData();
          this.displayProfessionalSavedReports(reportsData);
        } catch (error) {
          console.error('Saved reports loading error:', error);
        }
      };
    }
  }

  async getSavedReportsData() {
    // Try to get from storage manager first
    if (window.storageManager && window.storageManager.getAIReports) {
      return await window.storageManager.getAIReports();
    }
    
    // Fallback to direct storage
    return new Promise((resolve) => {
      chrome.storage.local.get(['aiReports'], (data) => {
        resolve(data.aiReports || []);
      });
    });
  }

  displayProfessionalSavedReports(reportsData) {
    // Update stats
    const totalCount = reportsData.length;
    const correctCount = reportsData.filter(r => r.isCorrect === true).length;
    const errorCount = reportsData.filter(r => r.hasErrors === true).length;
    
    document.getElementById('totalReportsCount').textContent = totalCount;
    document.getElementById('correctReportsCount').textContent = correctCount;
    document.getElementById('errorReportsCount').textContent = errorCount;
    
    const reportsList = document.getElementById('savedReportsList');
    
    if (!reportsData.length) {
      reportsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💾</div>
          <h3 class="empty-state-title">No saved reports</h3>
          <p class="empty-state-description">Save your AI analysis results to access them later</p>
        </div>
      `;
      return;
    }

    reportsList.innerHTML = reportsData.slice(0, 20).map(report => {
      const timeAgo = this.formatTimeAgo(report.timestamp);
      const preview = this.getAnalysisPreview(report.analysisData);
      
      return `
        <div class="saved-item">
          <div class="saved-item-header">
            <div class="saved-item-content">
              <div class="saved-item-text" onclick="professionalUIBridge.loadSavedReport('${report.id}')">${report.searchText}</div>
              <div class="saved-item-badges">
                <span class="badge badge-primary">${this.getLanguageName(report.language)}</span>
                ${report.isCorrect ? '<span class="badge badge-success">✓ Correct</span>' : ''}
                ${report.hasErrors ? '<span class="badge badge-danger">⚠ Has Errors</span>' : ''}
                ${report.favorite ? '<span class="badge badge-neutral">⭐ Favorite</span>' : ''}
                ${this.getSourceBadge(report)}
              </div>
              <div class="saved-item-meta">
                Saved ${timeAgo} ${report.tags && report.tags.length ? `• ${report.tags.join(', ')}` : ''}
              </div>
            </div>
            <div class="saved-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="professionalUIBridge.toggleFavorite('${report.id}')" title="Toggle Favorite">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
              <button class="btn btn-ghost btn-sm" onclick="professionalUIBridge.deleteReport('${report.id}')" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18l-2 13H5L3 6zM3 6l-.5-3H1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="saved-item-preview">
            ${preview}
          </div>
        </div>
      `;
    }).join('');
  }

  integrateAudioFunction() {
    // Integrate audio playback functionality
    if (window.playAudio) {
      this.originalFunctions.playAudio = window.playAudio;
    }
  }

  setupMessageListeners() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'showAnalysis') {
        this.professionalUI.switchToView('analysis');
        this.professionalUI.showAnalysisResult(request.text, request.language);
        sendResponse({ success: true });
      }
    });
  }

  // Utility functions
  detectSourceType(item) {
    if (item.detectionMethod && item.detectionMethod.includes('article')) {
      return 'article';
    }
    if (item.videoSource && !item.videoSource.url?.includes('youtube.com')) {
      return 'article';
    }
    return 'video';
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  getLanguageName(code) {
    const names = {
      'en': 'English',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'nl': 'Dutch'
    };
    return names[code] || code.toUpperCase();
  }

  getAnalysisPreview(analysisData) {
    if (!analysisData) return 'No analysis available';
    
    let text = '';
    if (typeof analysisData === 'string') {
      text = analysisData;
    } else if (analysisData.content) {
      text = analysisData.content;
    } else {
      text = JSON.stringify(analysisData);
    }
    
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  }

  getSourceBadge(report) {
    if (!report.videoSource) return '';
    
    const sourceType = this.detectSourceType(report);
    if (sourceType === 'article') {
      return '<span class="badge badge-success">📄 Article</span>';
    } else {
      return '<span class="badge badge-danger">🎥 Video</span>';
    }
  }

  // Public methods for UI interactions
  async loadHistoryItem(itemId) {
    console.log('Loading history item:', itemId);
    // Implementation would load and display the specific history item
  }

  async loadSavedReport(reportId) {
    console.log('Loading saved report:', reportId);
    // Implementation would load and display the specific saved report
    if (window.viewSavedReport) {
      window.viewSavedReport(reportId);
    }
  }

  async toggleFavorite(reportId) {
    console.log('Toggling favorite for report:', reportId);
    // Implementation would toggle favorite status
    if (window.toggleFavoriteReport) {
      await window.toggleFavoriteReport(reportId);
      // Refresh the display
      window.loadSavedReports();
    }
  }

  async deleteReport(reportId) {
    if (confirm('Are you sure you want to delete this report?')) {
      console.log('Deleting report:', reportId);
      if (window.deleteSavedReport) {
        await window.deleteSavedReport(reportId);
        // Refresh the display
        window.loadSavedReports();
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.professionalUIBridge = new UIIntegrationBridge();
});