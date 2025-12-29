// Sidepanel Platform Handlers Module

class SidepanelPlatforms {
  constructor() {
    this.platformHandlers = new Map();
    this.setupPlatformHandlers();
  }

  logSafely(...args) {
    if (typeof window.SidepanelCore?.logSafely === 'function') {
      window.SidepanelCore.logSafely(...args);
    } else {
      console.log(...args);
    }
  }

  // Setup platform-specific handlers
  setupPlatformHandlers() {
    this.platformHandlers.set('youtube', this.handleYouTubeAnalysis.bind(this));
    this.platformHandlers.set('netflix', this.handleNetflixAnalysis.bind(this));
    this.platformHandlers.set('udemy', this.handleUdemyAnalysis.bind(this));
    this.platformHandlers.set('coursera', this.handleCourseraAnalysis.bind(this));
    this.platformHandlers.set('article', this.handleArticleAnalysis.bind(this));
  }

  // Check for platform analysis data when sidepanel opens
  checkForAnalysisData() {
    this.checkForYouTubeAnalysis();
    this.checkForNetflixAnalysis();
    this.checkForUdemyAnalysis();
    this.checkForArticleAnalysis();
  }

  // Check for YouTube analysis data
  async checkForYouTubeAnalysis() {
    try {
      const result = await chrome.storage.local.get(['pendingYouTubeAnalysis']);
      if (result.pendingYouTubeAnalysis) {
        this.logSafely('📺 Found pending YouTube analysis data');
        const data = result.pendingYouTubeAnalysis;
        
        // Clear the pending data
        await chrome.storage.local.remove(['pendingYouTubeAnalysis']);
        
        // Process the analysis
        await this.handleYouTubeAnalysis(data);
      }
    } catch (error) {
      console.error('❌ Failed to check YouTube analysis data:', error);
    }
  }

  // Check for Netflix analysis data
  async checkForNetflixAnalysis() {
    try {
      const result = await chrome.storage.local.get(['pendingNetflixAnalysis']);
      if (result.pendingNetflixAnalysis) {
        this.logSafely('🎬 Found pending Netflix analysis data');
        const data = result.pendingNetflixAnalysis;
        
        // Clear the pending data
        await chrome.storage.local.remove(['pendingNetflixAnalysis']);
        
        // Process the analysis
        await this.handleNetflixAnalysis(data);
      }
    } catch (error) {
      console.error('❌ Failed to check Netflix analysis data:', error);
    }
  }

  // Check for Udemy analysis data
  async checkForUdemyAnalysis() {
    try {
      const result = await chrome.storage.local.get(['pendingUdemyAnalysis']);
      if (result.pendingUdemyAnalysis) {
        this.logSafely('🎓 Found pending Udemy analysis data');
        const data = result.pendingUdemyAnalysis;
        
        // Clear the pending data
        await chrome.storage.local.remove(['pendingUdemyAnalysis']);
        
        // Process the analysis
        await this.handleUdemyAnalysis(data);
      }
    } catch (error) {
      console.error('❌ Failed to check Udemy analysis data:', error);
    }
  }

  // Check for article analysis data
  async checkForArticleAnalysis() {
    try {
      const result = await chrome.storage.local.get(['pendingArticleAnalysis']);
      if (result.pendingArticleAnalysis) {
        this.logSafely('📰 Found pending article analysis data');
        const data = result.pendingArticleAnalysis;
        
        // Clear the pending data
        await chrome.storage.local.remove(['pendingArticleAnalysis']);
        
        // Process the analysis
        await this.handleArticleAnalysis(data);
      }
    } catch (error) {
      console.error('❌ Failed to check article analysis data:', error);
    }
  }

  // Handle YouTube text analysis
  async handleYouTubeAnalysis(data) {
    this.logSafely('📺 Processing YouTube analysis:', data);
    
    try {
      const { text, url, title, timestamp } = data;
      
      // Update UI to show YouTube content
      this.updatePlatformUI('youtube', {
        title: title || 'YouTube Video',
        url: url,
        text: text,
        timestamp: timestamp
      });
      
      // Record learning activity
      if (typeof window.recordLearningSearch === 'function') {
        window.recordLearningSearch(text, 'auto', url, title, 'youtube');
      }
      
      // Trigger AI analysis if available
      if (typeof this.analyzeWithAI === 'function') {
        await this.analyzeWithAI(text, 'youtube');
      }
      
      // Update dashboard
      if (typeof window.updateLearningDashboard === 'function') {
        window.updateLearningDashboard();
      }
      
    } catch (error) {
      console.error('❌ YouTube analysis failed:', error);
    }
  }

  // Handle Netflix text analysis
  async handleNetflixAnalysis(data) {
    this.logSafely('🎬 Processing Netflix analysis:', data);
    
    try {
      const { text, url, title, timestamp } = data;
      
      // Update UI to show Netflix content
      this.updatePlatformUI('netflix', {
        title: title || 'Netflix Content',
        url: url,
        text: text,
        timestamp: timestamp
      });
      
      // Record learning activity
      if (typeof window.recordLearningSearch === 'function') {
        window.recordLearningSearch(text, 'auto', url, title, 'netflix');
      }
      
      // Trigger AI analysis
      if (typeof this.analyzeWithAI === 'function') {
        await this.analyzeWithAI(text, 'netflix');
      }
      
      // Update dashboard
      if (typeof window.updateLearningDashboard === 'function') {
        window.updateLearningDashboard();
      }
      
    } catch (error) {
      console.error('❌ Netflix analysis failed:', error);
    }
  }

  // Handle Udemy text analysis
  async handleUdemyAnalysis(data) {
    this.logSafely('🎓 Processing Udemy analysis:', data);
    
    try {
      const { text, url, title, courseTitle, timestamp } = data;
      
      // Update UI to show Udemy content
      this.updatePlatformUI('udemy', {
        title: title || 'Udemy Lecture',
        courseTitle: courseTitle,
        url: url,
        text: text,
        timestamp: timestamp
      });
      
      // Record learning activity
      if (typeof window.recordLearningSearch === 'function') {
        window.recordLearningSearch(text, 'auto', url, title, 'udemy', courseTitle);
      }
      
      // Trigger AI analysis
      if (typeof this.analyzeWithAI === 'function') {
        await this.analyzeWithAI(text, 'udemy');
      }
      
      // Update dashboard
      if (typeof window.updateLearningDashboard === 'function') {
        window.updateLearningDashboard();
      }
      
    } catch (error) {
      console.error('❌ Udemy analysis failed:', error);
    }
  }

  // Handle Coursera text analysis
  async handleCourseraAnalysis(data) {
    this.logSafely('🎓 Processing Coursera analysis:', data);
    
    try {
      const { text, url, title, courseTitle, timestamp } = data;
      
      // Update UI to show Coursera content
      this.updatePlatformUI('coursera', {
        title: title || 'Coursera Lecture',
        courseTitle: courseTitle,
        url: url,
        text: text,
        timestamp: timestamp
      });
      
      // Record learning activity
      if (typeof window.recordLearningSearch === 'function') {
        window.recordLearningSearch(text, 'auto', url, title, 'coursera', courseTitle);
      }
      
      // Trigger AI analysis
      if (typeof this.analyzeWithAI === 'function') {
        await this.analyzeWithAI(text, 'coursera');
      }
      
      // Update dashboard
      if (typeof window.updateLearningDashboard === 'function') {
        window.updateLearningDashboard();
      }
      
    } catch (error) {
      console.error('❌ Coursera analysis failed:', error);
    }
  }

  // Handle article text analysis
  async handleArticleAnalysis(data) {
    this.logSafely('📰 Processing article analysis:', data);
    
    try {
      const { text, url, title, timestamp } = data;
      
      // Update UI to show article content
      this.updatePlatformUI('article', {
        title: title || 'Article',
        url: url,
        text: text,
        timestamp: timestamp
      });
      
      // Record learning activity
      if (typeof window.recordLearningSearch === 'function') {
        window.recordLearningSearch(text, 'auto', url, title, 'article');
      }
      
      // Trigger AI analysis
      if (typeof this.analyzeWithAI === 'function') {
        await this.analyzeWithAI(text, 'article');
      }
      
      // Update dashboard
      if (typeof window.updateLearningDashboard === 'function') {
        window.updateLearningDashboard();
      }
      
    } catch (error) {
      console.error('❌ Article analysis failed:', error);
    }
  }

  // Update platform-specific UI
  updatePlatformUI(platform, data) {
    const platformInfo = document.getElementById('platform-info');
    const platformIcon = document.getElementById('platform-icon');
    const platformTitle = document.getElementById('platform-title');
    const platformText = document.getElementById('platform-text');
    
    if (!platformInfo) return;
    
    // Platform icons
    const icons = {
      youtube: '📺',
      netflix: '🎬',
      udemy: '🎓',
      coursera: '🎓',
      article: '📰'
    };
    
    // Platform colors
    const colors = {
      youtube: '#ff0000',
      netflix: '#e50914',
      udemy: '#a435f0',
      coursera: '#0056d3',
      article: '#1a73e8'
    };
    
    // Update UI elements
    if (platformIcon) {
      platformIcon.textContent = icons[platform] || '🌐';
      platformIcon.style.color = colors[platform] || '#666';
    }
    
    if (platformTitle) {
      let titleText = data.title;
      if (data.courseTitle) {
        titleText = `${data.courseTitle} - ${data.title}`;
      }
      platformTitle.textContent = titleText;
      platformTitle.title = data.url;
    }
    
    if (platformText) {
      platformText.textContent = data.text;
    }
    
    // Show platform info section
    platformInfo.style.display = 'block';
    
    // Add click handler to open original content
    if (data.url && platformTitle) {
      platformTitle.style.cursor = 'pointer';
      platformTitle.onclick = () => {
        window.open(data.url, '_blank');
      };
    }
  }

  // Analyze text with AI
  async analyzeWithAI(text, platform) {
    try {
      // Check if AI service is available
      if (typeof window.aiService === 'undefined') {
        this.logSafely('⚠️ AI service not available, skipping analysis');
        return;
      }
      
      this.logSafely(`🤖 Starting AI analysis for ${platform}:`, text);
      
      // Show loading state
      this.showAnalysisLoading(true);
      
      // Perform AI analysis
      const analysis = await window.aiService.analyzeText(text, {
        platform: platform,
        language: 'auto',
        includeTranslation: true,
        includeExplanation: true
      });
      
      // Hide loading state
      this.showAnalysisLoading(false);
      
      // Display results
      this.displayAnalysisResults(analysis);
      
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      this.showAnalysisLoading(false);
      this.showAnalysisError('AI 分析失敗，請稍後再試');
    }
  }

  // Show analysis loading state
  showAnalysisLoading(isLoading) {
    const loadingElement = document.getElementById('analysis-loading');
    const resultsElement = document.getElementById('analysis-results');
    
    if (loadingElement) {
      loadingElement.style.display = isLoading ? 'block' : 'none';
    }
    
    if (resultsElement) {
      resultsElement.style.display = isLoading ? 'none' : 'block';
    }
  }

  // Display analysis results
  displayAnalysisResults(analysis) {
    const resultsElement = document.getElementById('analysis-results');
    if (!resultsElement) return;
    
    resultsElement.innerHTML = `
      <div class="analysis-section">
        <h3>📝 AI 分析結果</h3>
        <div class="analysis-content">
          <div class="translation">
            <h4>翻譯</h4>
            <p>${analysis.translation || '翻譯不可用'}</p>
          </div>
          <div class="explanation">
            <h4>詳細解釋</h4>
            <p>${analysis.explanation || '解釋不可用'}</p>
          </div>
          ${analysis.grammar ? `
            <div class="grammar">
              <h4>語法重點</h4>
              <p>${analysis.grammar}</p>
            </div>
          ` : ''}
          ${analysis.vocabulary ? `
            <div class="vocabulary">
              <h4>重要詞彙</h4>
              <ul>
                ${analysis.vocabulary.map(word => `<li><strong>${word.word}</strong>: ${word.meaning}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Show analysis error
  showAnalysisError(message) {
    const resultsElement = document.getElementById('analysis-results');
    if (!resultsElement) return;
    
    resultsElement.innerHTML = `
      <div class="analysis-error">
        <p>❌ ${message}</p>
      </div>
    `;
  }

  // Get platform from URL
  detectPlatform(url) {
    if (!url) return 'other';
    
    if (url.includes('youtube.com')) return 'youtube';
    if (url.includes('netflix.com')) return 'netflix';
    if (url.includes('udemy.com')) return 'udemy';
    if (url.includes('coursera.org')) return 'coursera';
    
    return 'article';
  }

  // Process analysis data for any platform
  async processAnalysisData(data) {
    const platform = data.platform || this.detectPlatform(data.url);
    const handler = this.platformHandlers.get(platform);
    
    if (handler) {
      await handler(data);
    } else {
      this.logSafely(`⚠️ No handler found for platform: ${platform}`);
      await this.handleArticleAnalysis(data); // Fallback to article handler
    }
  }

  // Initialize platform checking
  init() {
    // Check for pending analysis data when module loads
    this.checkForAnalysisData();
    
    // Set up periodic checks for new analysis data
    setInterval(() => {
      this.checkForAnalysisData();
    }, 2000);
  }
}

// Create global platforms instance
const sidepanelPlatforms = new SidepanelPlatforms();

// Export legacy function names for backward compatibility
window.handleYouTubeTextAnalysis = (...args) => sidepanelPlatforms.handleYouTubeAnalysis(...args);
window.checkForYouTubeAnalysis = () => sidepanelPlatforms.checkForYouTubeAnalysis();
window.checkForNetflixAnalysis = () => sidepanelPlatforms.checkForNetflixAnalysis();
window.checkForUdemyAnalysis = () => sidepanelPlatforms.checkForUdemyAnalysis();
window.checkForArticleAnalysis = () => sidepanelPlatforms.checkForArticleAnalysis();

// Export for use by other modules
window.SidepanelPlatforms = sidepanelPlatforms;

// Auto-initialize
sidepanelPlatforms.init();