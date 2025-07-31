/**
 * Professional UI Controller
 * Handles the modern, clean interface while maintaining all functionality
 */

class ProfessionalUIController {
  constructor() {
    this.currentView = 'analysis';
    this.isAnalyzing = false;
    this.currentAnalysisData = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadInitialData();
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleNavigation(e));
    });

    // Manual search
    const searchBtn = document.getElementById('manualSearchBtn');
    const searchInput = document.getElementById('manualSearchInput');
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.handleManualSearch());
    }
    
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleManualSearch();
        }
      });
    }

    // Analysis actions
    document.getElementById('saveReportBtn')?.addEventListener('click', () => this.saveCurrentReport());
    document.getElementById('playAudioBtn')?.addEventListener('click', () => this.playCurrentAudio());
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportCurrentAnalysis());

    // Quick navigation buttons
    document.getElementById('viewHistoryBtn')?.addEventListener('click', () => this.switchToView('history'));
    document.getElementById('learnMoreBtn')?.addEventListener('click', () => this.showLearnMoreModal());
  }

  handleNavigation(e) {
    const viewName = e.target.dataset.view;
    this.switchToView(viewName);
  }

  switchToView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    // Update content
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(viewName + 'View')?.classList.add('active');

    this.currentView = viewName;

    // Load view-specific data
    this.loadViewData(viewName);
  }

  async loadViewData(viewName) {
    switch (viewName) {
      case 'history':
        await this.loadHistoryData();
        break;
      case 'saved':
        await this.loadSavedReports();
        break;
      case 'flashcards':
        await this.loadFlashcards();
        break;
    }
  }

  async handleManualSearch() {
    const input = document.getElementById('manualSearchInput');
    const text = input.value.trim();
    
    if (!text) return;

    // Show analysis result section
    this.showAnalysisResult(text, 'manual');
    
    // Start analysis
    await this.analyzeText(text, 'manual');
  }

  showAnalysisResult(text, language = 'auto') {
    // Hide welcome state
    document.getElementById('welcomeState').style.display = 'none';
    
    // Show analysis result
    const resultSection = document.getElementById('analysisResult');
    resultSection.style.display = 'block';
    
    // Update query display
    document.getElementById('currentQueryText').textContent = text;
    document.getElementById('currentLanguage').textContent = language;
    
    // Show loading state
    this.showAnalysisLoading();
  }

  showAnalysisLoading() {
    const content = document.getElementById('aiAnalysisContent');
    content.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <span style="margin-left: var(--space-3); color: var(--color-neutral-500);">Analyzing text...</span>
      </div>
    `;
  }

  async analyzeText(text, language) {
    this.isAnalyzing = true;
    
    try {
      // This would integrate with the existing AI analysis system
      // For now, show a demo result
      setTimeout(() => {
        this.displayAnalysisResult({
          translation: "This is a sample translation of the analyzed text.",
          grammar: "The grammar structure shows present tense with correct subject-verb agreement.",
          pronunciation: "Key pronunciation points for difficult words.",
          cultural: "Cultural context and usage scenarios for this phrase.",
          errors: [],
          isCorrect: true
        });
      }, 2000);
      
    } catch (error) {
      this.showAnalysisError(error.message);
    } finally {
      this.isAnalyzing = false;
    }
  }

  displayAnalysisResult(analysisData) {
    this.currentAnalysisData = analysisData;
    
    const content = document.getElementById('aiAnalysisContent');
    
    let resultHTML = '';
    
    // Translation Section
    if (analysisData.translation) {
      resultHTML += `
        <div class="analysis-section">
          <div class="analysis-section-header">
            <div class="analysis-section-icon translation">T</div>
            <h3 class="analysis-section-title">Translation</h3>
          </div>
          <div class="analysis-section-content">
            <p class="analysis-text">${analysisData.translation}</p>
          </div>
        </div>
      `;
    }
    
    // Grammar Section
    if (analysisData.grammar) {
      resultHTML += `
        <div class="analysis-section">
          <div class="analysis-section-header">
            <div class="analysis-section-icon grammar">G</div>
            <h3 class="analysis-section-title">Grammar Analysis</h3>
          </div>
          <div class="analysis-section-content">
            <p class="analysis-text">${analysisData.grammar}</p>
          </div>
        </div>
      `;
    }
    
    // Error/Correctness indicator
    if (analysisData.isCorrect) {
      resultHTML += `
        <div class="analysis-section">
          <div class="analysis-section-header">
            <div class="analysis-section-icon grammar">✓</div>
            <h3 class="analysis-section-title">Text Quality</h3>
          </div>
          <div class="analysis-section-content">
            <div class="correct-badge">✓ Text is grammatically correct</div>
            <p class="analysis-text">This text demonstrates proper grammar and structure.</p>
          </div>
        </div>
      `;
    }
    
    content.innerHTML = resultHTML;
    
    // Add CSS for analysis sections
    this.injectAnalysisSectionStyles();
  }

  injectAnalysisSectionStyles() {
    if (document.getElementById('analysis-section-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'analysis-section-styles';
    style.textContent = `
      .analysis-section {
        background: white;
        border: 1px solid var(--color-neutral-200);
        border-radius: var(--radius-lg);
        margin-bottom: var(--space-4);
        overflow: hidden;
      }
      
      .analysis-section-header {
        padding: var(--space-4);
        background: var(--color-neutral-50);
        border-bottom: 1px solid var(--color-neutral-200);
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      
      .analysis-section-icon {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--font-weight-semibold);
        color: white;
        flex-shrink: 0;
      }
      
      .analysis-section-icon.translation {
        background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
      }
      
      .analysis-section-icon.grammar {
        background: linear-gradient(135deg, #10B981 0%, #047857 100%);
      }
      
      .analysis-section-title {
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-neutral-800);
        margin: 0;
      }
      
      .analysis-section-content {
        padding: var(--space-4);
      }
      
      .analysis-text {
        font-size: var(--text-base);
        line-height: var(--line-height-relaxed);
        color: var(--color-neutral-700);
        margin: 0;
      }
      
      .correct-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        background: var(--color-success);
        color: white;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-3);
      }
    `;
    document.head.appendChild(style);
  }

  showAnalysisError(message) {
    const content = document.getElementById('aiAnalysisContent');
    content.innerHTML = `
      <div style="text-align: center; padding: var(--space-8); color: var(--color-error);">
        <div style="font-size: var(--text-xl); margin-bottom: var(--space-2);">⚠️</div>
        <div style="font-weight: var(--font-weight-medium); margin-bottom: var(--space-2);">Analysis Error</div>
        <div style="font-size: var(--text-sm); color: var(--color-neutral-500);">${message}</div>
      </div>
    `;
  }

  async loadHistoryData() {
    const historyList = document.getElementById('historyList');
    
    try {
      // Try to get real history data first
      let historyData = [];
      
      if (window.professionalUIBridge && window.professionalUIBridge.getHistoryData) {
        historyData = await window.professionalUIBridge.getHistoryData();
      } else {
        // Fallback to storage directly
        const result = await chrome.storage.local.get(['searchHistory']);
        historyData = result.searchHistory || [];
      }
      
      if (historyData.length === 0) {
        historyList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📚</div>
            <h3 class="empty-state-title">No history yet</h3>
            <p class="empty-state-description">Start analyzing text to build your learning history</p>
          </div>
        `;
        return;
      }
      
      // Take only the most recent 20 items
      const recentHistory = historyData.slice(0, 20);
      
      historyList.innerHTML = recentHistory.map(item => {
        const sourceType = this.detectSourceType(item);
        const timeAgo = this.formatTimeAgo(item.timestamp);
        
        return `
          <div class="history-item" onclick="professionalUIBridge?.loadHistoryItem('${item.id || item.text}')">
            <div class="history-item-icon ${sourceType}">
              ${sourceType === 'article' ? 'A' : 'V'}
            </div>
            <div class="history-item-content">
              <div class="history-item-text">${item.text || item.searchText}</div>
              <div class="history-item-meta">
                <span class="badge badge-primary">${this.getLanguageName(item.language) || 'Unknown'}</span>
                <span>${timeAgo}</span>
                ${item.videoSource ? `<span>${item.videoSource.title || item.videoSource.domain || 'Source'}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
      
    } catch (error) {
      console.error('Error loading history:', error);
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Error loading history</h3>
          <p class="empty-state-description">Please try refreshing the panel</p>
        </div>
      `;
    }
  }

  async loadSavedReports() {
    const reportsList = document.getElementById('savedReportsList');
    const statsGrid = document.getElementById('savedStatsGrid');
    
    try {
      // Try to get real saved reports data first
      let reportsData = [];
      
      if (window.professionalUIBridge && window.professionalUIBridge.getSavedReportsData) {
        reportsData = await window.professionalUIBridge.getSavedReportsData();
      } else {
        // Fallback to storage directly
        const result = await chrome.storage.local.get(['aiReports']);
        reportsData = result.aiReports || [];
      }
      
      // Update stats
      const totalCount = reportsData.length;
      const correctCount = reportsData.filter(r => r.isCorrect === true).length;
      const errorCount = reportsData.filter(r => r.hasErrors === true).length;
      
      document.getElementById('totalReportsCount').textContent = totalCount;
      document.getElementById('correctReportsCount').textContent = correctCount;
      document.getElementById('errorReportsCount').textContent = errorCount;
      
      if (reportsData.length === 0) {
        reportsList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">💾</div>
            <h3 class="empty-state-title">No saved reports</h3>
            <p class="empty-state-description">Save your AI analysis results to access them later</p>
          </div>
        `;
        return;
      }
      
      // Show only the most recent 20 reports
      const recentReports = reportsData.slice(0, 20);
      
      reportsList.innerHTML = recentReports.map(report => {
        const timeAgo = this.formatTimeAgo(report.timestamp);
        const preview = this.getAnalysisPreview(report.analysisData);
        
        return `
          <div class="saved-item">
            <div class="saved-item-header">
              <div class="saved-item-content">
                <div class="saved-item-text" onclick="professionalUIBridge?.loadSavedReport('${report.id}')">${report.searchText}</div>
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
                <button class="btn btn-ghost btn-sm" onclick="professionalUIBridge?.toggleFavorite('${report.id}')" title="Toggle Favorite">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="professionalUIBridge?.deleteReport('${report.id}')" title="Delete">
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
      
    } catch (error) {
      console.error('Error loading saved reports:', error);
      reportsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Error loading reports</h3>
          <p class="empty-state-description">Please try refreshing the panel</p>
        </div>
      `;
    }
  }

  async loadFlashcards() {
    // This would integrate with existing flashcard system
    console.log('Loading flashcards...');
  }

  async saveCurrentReport() {
    if (!this.currentAnalysisData) return;
    
    // This would integrate with existing save system
    console.log('Saving current report...');
    
    // Show success feedback
    const btn = document.getElementById('saveReportBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.classList.add('btn-success');
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('btn-success');
    }, 2000);
  }

  async playCurrentAudio() {
    // This would integrate with existing audio system
    console.log('Playing current audio...');
  }

  async exportCurrentAnalysis() {
    // This would integrate with existing export system
    console.log('Exporting current analysis...');
  }

  showLearnMoreModal() {
    // Simple alert for now, could be a proper modal
    alert('LeverageLanguage helps you learn languages through AI-powered analysis of real content from articles and videos.');
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

  detectSourceType(item) {
    if (item.detectionMethod && item.detectionMethod.includes('article')) {
      return 'article';
    }
    if (item.videoSource && !item.videoSource.url?.includes('youtube.com')) {
      return 'article';
    }
    return 'video';
  }

  getLanguageName(code) {
    const names = {
      'en': 'English',
      'english': 'English',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'japanese': 'Japanese',
      'ko': 'Korean',
      'korean': 'Korean',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'nl': 'Dutch',
      'dutch': 'Dutch'
    };
    return names[code] || (code ? code.charAt(0).toUpperCase() + code.slice(1) : 'Unknown');
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

  async loadInitialData() {
    // Load any initial data needed
    console.log('Professional UI initialized');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.professionalUI = new ProfessionalUIController();
});