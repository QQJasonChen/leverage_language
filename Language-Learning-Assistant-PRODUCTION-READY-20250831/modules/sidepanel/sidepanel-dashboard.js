// Sidepanel Learning Dashboard Module

class SidepanelDashboard {
  constructor() {
    this.learningStats = {
      totalSearches: 0,
      todaySearches: 0,
      recentActivity: [],
      topVocabulary: [],
      aiInsights: [],
      lastUpdated: new Date().toISOString()
    };
    this.loadLearningStats();
  }

  logSafely(...args) {
    if (typeof window.SidepanelCore?.logSafely === 'function') {
      window.SidepanelCore.logSafely(...args);
    } else {
      console.log(...args);
    }
  }

  // Load learning statistics from storage
  async loadLearningStats() {
    try {
      const result = await chrome.storage.local.get(['learningStats']);
      if (result.learningStats) {
        this.learningStats = { ...this.learningStats, ...result.learningStats };
        this.logSafely('📊 Learning stats loaded:', this.learningStats);
      }
    } catch (error) {
      console.error('❌ Failed to load learning stats:', error);
    }
  }

  // Save learning statistics to storage
  async saveLearningStats() {
    try {
      await chrome.storage.local.set({ learningStats: this.learningStats });
      this.logSafely('💾 Learning stats saved');
    } catch (error) {
      console.error('❌ Failed to save learning stats:', error);
    }
  }

  // Record learning search function
  recordLearningSearch(text, language, url, title, platform = null, courseTitle = null) {
    // Detect platform from URL if not provided
    let detectedPlatform = platform;
    if (!detectedPlatform) {
      if (url && url.includes('youtube.com')) {
        detectedPlatform = 'youtube';
      } else if (url && url.includes('netflix.com')) {
        detectedPlatform = 'netflix';
      } else if (url && url.includes('udemy.com')) {
        detectedPlatform = 'udemy';
      } else if (url && url.includes('coursera.org')) {
        detectedPlatform = 'coursera';
      } else {
        detectedPlatform = 'other';
      }
    }

    const searchEntry = {
      text: text,
      language: language,
      url: url,
      title: title || '',
      videoTitle: title || '',
      platform: detectedPlatform,
      courseTitle: courseTitle || null,
      timestamp: new Date().toISOString(),
      date: new Date().toDateString()
    };
    
    // Update stats
    this.learningStats.totalSearches++;
    this.learningStats.lastUpdated = new Date().toISOString();
    
    // Check if today's search
    const today = new Date().toDateString();
    if (searchEntry.date === today) {
      this.learningStats.todaySearches++;
    }
    
    // Add to recent activity (keep last 10)
    this.learningStats.recentActivity.unshift(searchEntry);
    if (this.learningStats.recentActivity.length > 10) {
      this.learningStats.recentActivity = this.learningStats.recentActivity.slice(0, 10);
    }
    
    // Update vocabulary tracking
    this.updateVocabularyTracking(text, language);
    
    // Add to learning queue based on platform
    this.addToLearningQueue(url, title, detectedPlatform, text, courseTitle);
    
    // Save to storage
    this.saveLearningStats();
    
    this.logSafely('📚 Learning search recorded:', searchEntry);
  }

  // Update vocabulary tracking
  updateVocabularyTracking(text, language) {
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    words.forEach(word => {
      const existing = this.learningStats.topVocabulary.find(v => v.word === word);
      if (existing) {
        existing.count++;
        existing.lastSeen = new Date().toISOString();
      } else {
        this.learningStats.topVocabulary.push({
          word: word,
          language: language,
          count: 1,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      }
    });
    
    // Sort by count and keep top 50
    this.learningStats.topVocabulary.sort((a, b) => b.count - a.count);
    if (this.learningStats.topVocabulary.length > 50) {
      this.learningStats.topVocabulary = this.learningStats.topVocabulary.slice(0, 50);
    }
  }

  // Add content to learning queue
  addToLearningQueue(url, title, platform, text, courseTitle = null) {
    if (!url) return;

    const videoTitle = title || `${platform} Content`;
    const channelName = this.getChannelName(platform, url);
    const wordCount = text.split(/\s+/).length;
    const isSentence = wordCount > 3;

    switch (platform) {
      case 'youtube':
        this.addVideoToQueue(url, videoTitle, channelName, isSentence);
        break;
      case 'netflix':
        this.addNetflixToQueue(url, videoTitle, channelName, isSentence);
        break;
      case 'udemy':
        this.addUdemyToQueue(url, videoTitle, channelName, isSentence, courseTitle);
        break;
      case 'coursera':
        this.addCourseraToQueue(url, videoTitle, channelName, isSentence, courseTitle);
        break;
    }
  }

  // Get channel name based on platform
  getChannelName(platform, url) {
    switch (platform) {
      case 'youtube':
        return this.extractChannelFromYouTubeUrl(url) || 'Unknown Channel';
      case 'netflix':
        return 'Netflix';
      case 'udemy':
        return 'Udemy';
      case 'coursera':
        return 'Coursera';
      default:
        return 'Unknown';
    }
  }

  // Extract channel from YouTube URL
  extractChannelFromYouTubeUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.includes('channel')) {
        const channelIndex = pathParts.indexOf('channel');
        return pathParts[channelIndex + 1] || 'Unknown Channel';
      }
      return 'YouTube';
    } catch {
      return 'YouTube';
    }
  }

  // Update learning dashboard
  updateLearningDashboard() {
    this.updateRecentActivity();
    this.updateTopVocabulary();
    this.updateAIInsights();
    this.updateStats();
  }

  // Update recent activity display
  updateRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) return;

    if (this.learningStats.recentActivity.length === 0) {
      container.innerHTML = '<p class="no-data">開始學習後，這裡會顯示你的最近活動！</p>';
      return;
    }

    const activityHTML = this.learningStats.recentActivity.map(activity => {
      const timeAgo = this.getTimeAgo(new Date(activity.timestamp));
      const platformIcon = this.getPlatformIcon(activity.platform);
      
      return `
        <div class="activity-item">
          <div class="activity-icon">${platformIcon}</div>
          <div class="activity-content">
            <div class="activity-text">${this.escapeHtml(activity.text)}</div>
            <div class="activity-meta">
              <span class="platform">${activity.platform}</span>
              <span class="time">${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = activityHTML;
  }

  // Update top vocabulary display
  updateTopVocabulary() {
    const container = document.getElementById('top-vocabulary');
    if (!container) return;

    if (this.learningStats.topVocabulary.length === 0) {
      container.innerHTML = '<p class="no-data">開始學習後，這裡會顯示你的常用詞彙！</p>';
      return;
    }

    const topWords = this.learningStats.topVocabulary.slice(0, 10);
    const vocabularyHTML = topWords.map((vocab, index) => {
      return `
        <div class="vocabulary-item">
          <span class="rank">${index + 1}</span>
          <span class="word">${this.escapeHtml(vocab.word)}</span>
          <span class="count">${vocab.count}次</span>
        </div>
      `;
    }).join('');

    container.innerHTML = vocabularyHTML;
  }

  // Update AI insights
  updateAIInsights() {
    const container = document.getElementById('ai-insights');
    if (!container) return;

    // Generate insights based on learning data
    const insights = this.generateLearningInsights();
    
    if (insights.length === 0) {
      container.innerHTML = '<p class="no-data">累積更多學習數據後，AI 會為你生成個人化的學習建議！</p>';
      return;
    }

    const insightsHTML = insights.map(insight => {
      return `
        <div class="insight-item">
          <div class="insight-icon">${insight.icon}</div>
          <div class="insight-content">
            <h4>${insight.title}</h4>
            <p>${insight.description}</p>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = insightsHTML;
  }

  // Update statistics display
  updateStats() {
    const totalElement = document.getElementById('total-searches');
    const todayElement = document.getElementById('today-searches');
    const vocabularyElement = document.getElementById('vocabulary-count');

    if (totalElement) {
      totalElement.textContent = this.learningStats.totalSearches;
    }
    if (todayElement) {
      todayElement.textContent = this.learningStats.todaySearches;
    }
    if (vocabularyElement) {
      vocabularyElement.textContent = this.learningStats.topVocabulary.length;
    }
  }

  // Generate learning insights
  generateLearningInsights() {
    const insights = [];

    if (this.learningStats.totalSearches > 0) {
      insights.push({
        icon: '🎯',
        title: '學習進度',
        description: `你已經進行了 ${this.learningStats.totalSearches} 次學習搜索，繼續保持！`
      });
    }

    if (this.learningStats.todaySearches > 5) {
      insights.push({
        icon: '🔥',
        title: '今日活躍',
        description: `今天已經學習了 ${this.learningStats.todaySearches} 次，學習熱忱很棒！`
      });
    }

    if (this.learningStats.topVocabulary.length > 10) {
      insights.push({
        icon: '📚',
        title: '詞彙積累',
        description: `已收集 ${this.learningStats.topVocabulary.length} 個詞彙，建議進行複習鞏固。`
      });
    }

    return insights;
  }

  // Utility functions
  getPlatformIcon(platform) {
    const icons = {
      'youtube': '📺',
      'netflix': '🎬', 
      'udemy': '🎓',
      'coursera': '🎓',
      'other': '🌐'
    };
    return icons[platform] || '🌐';
  }

  getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小時前`;
    if (minutes > 0) return `${minutes} 分鐘前`;
    return '剛剛';
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Public methods for external access
  getStats() {
    return this.learningStats;
  }

  resetTodayStats() {
    this.learningStats.todaySearches = 0;
    this.saveLearningStats();
  }

  exportLearningData() {
    const dataStr = JSON.stringify(this.learningStats, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `learning-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Placeholder methods for platform-specific queue additions
  addVideoToQueue(url, title, channel, isSentence) {
    this.logSafely('📺 Added to YouTube queue:', { url, title, channel, isSentence });
  }

  addNetflixToQueue(url, title, channel, isSentence) {
    this.logSafely('🎬 Added to Netflix queue:', { url, title, channel, isSentence });
  }

  addUdemyToQueue(url, title, channel, isSentence, courseTitle) {
    this.logSafely('🎓 Added to Udemy queue:', { url, title, channel, isSentence, courseTitle });
  }

  addCourseraToQueue(url, title, channel, isSentence, courseTitle) {
    this.logSafely('🎓 Added to Coursera queue:', { url, title, channel, isSentence, courseTitle });
  }
}

// Create global dashboard instance
const sidepanelDashboard = new SidepanelDashboard();

// Export legacy function names for backward compatibility
window.recordLearningSearch = (...args) => sidepanelDashboard.recordLearningSearch(...args);
window.updateLearningDashboard = () => sidepanelDashboard.updateLearningDashboard();
window.updateVocabularyTracking = (...args) => sidepanelDashboard.updateVocabularyTracking(...args);
window.updateRecentActivity = () => sidepanelDashboard.updateRecentActivity();
window.updateTopVocabulary = () => sidepanelDashboard.updateTopVocabulary();
window.updateAIInsights = () => sidepanelDashboard.updateAIInsights();
window.exportLearningData = () => sidepanelDashboard.exportLearningData();

// Export for use by other modules
window.SidepanelDashboard = sidepanelDashboard;