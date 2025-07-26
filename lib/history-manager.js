// 歷史記錄管理模組
class HistoryManager {
  constructor() {
    this.STORAGE_KEY = 'queryHistory';
    this.MAX_HISTORY_SIZE = 1000;
  }

  // 添加新的查詢記錄
  async addRecord(text, language, detectionMethod = 'auto', websitesUsed = [], videoSource = null) {
    try {
      const record = {
        id: this.generateId(),
        text: text.trim(),
        language: language,
        timestamp: Date.now(),
        detectionMethod: detectionMethod, // 'auto', 'manual', 'preferred'
        websitesUsed: websitesUsed,
        queryCount: 1,
        videoSource: videoSource // { url, title, channel, timestamp }
      };

      const history = await this.getHistory();
      
      // 檢查是否已存在相同的查詢
      const existingIndex = history.findIndex(item => 
        item.text === record.text && item.language === record.language
      );

      if (existingIndex !== -1) {
        // 更新現有記錄
        history[existingIndex].timestamp = record.timestamp;
        history[existingIndex].queryCount += 1;
        history[existingIndex].websitesUsed = [...new Set([...history[existingIndex].websitesUsed, ...websitesUsed])];
        
        // 更新影片來源資訊（如果提供了新的影片來源）
        if (videoSource) {
          if (!history[existingIndex].videoSources) {
            history[existingIndex].videoSources = [];
          }
          // 添加新的影片來源，避免重複
          const existingVideoIndex = history[existingIndex].videoSources.findIndex(v => v.url === videoSource.url);
          if (existingVideoIndex === -1) {
            history[existingIndex].videoSources.push(videoSource);
          } else {
            // 更新現有影片的時間戳
            history[existingIndex].videoSources[existingVideoIndex].timestamp = videoSource.timestamp;
          }
          
          // 保持最新的影片來源作為主要來源
          history[existingIndex].videoSource = videoSource;
        }
      } else {
        // 添加新記錄
        if (videoSource) {
          record.videoSources = [videoSource]; // 初始化影片來源陣列
        }
        history.unshift(record);
      }

      // 保持記錄數量在限制範圍內
      if (history.length > this.MAX_HISTORY_SIZE) {
        history.splice(this.MAX_HISTORY_SIZE);
      }

      await this.saveHistory(history);
      return record;
    } catch (error) {
      console.error('添加歷史記錄失敗:', error);
      throw error;
    }
  }

  // 獲取歷史記錄
  async getHistory() {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('獲取歷史記錄失敗:', error);
      return [];
    }
  }

  // 保存歷史記錄
  async saveHistory(history) {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: history
      });
    } catch (error) {
      console.error('保存歷史記錄失敗:', error);
      throw error;
    }
  }

  // 搜尋歷史記錄
  async searchHistory(query, language = null) {
    try {
      const history = await this.getHistory();
      const lowerQuery = query.toLowerCase();
      
      return history.filter(record => {
        const matchesText = record.text.toLowerCase().includes(lowerQuery);
        const matchesLanguage = !language || record.language === language;
        return matchesText && matchesLanguage;
      });
    } catch (error) {
      console.error('搜尋歷史記錄失敗:', error);
      return [];
    }
  }

  // 按語言獲取歷史記錄
  async getHistoryByLanguage(language) {
    try {
      const history = await this.getHistory();
      return history.filter(record => record.language === language);
    } catch (error) {
      console.error('按語言獲取歷史記錄失敗:', error);
      return [];
    }
  }

  // 獲取最近的查詢記錄
  async getRecentHistory(limit = 50) {
    try {
      const history = await this.getHistory();
      return history.slice(0, limit);
    } catch (error) {
      console.error('獲取最近歷史記錄失敗:', error);
      return [];
    }
  }

  // 獲取最常查詢的詞彙
  async getMostQueried(limit = 10) {
    try {
      const history = await this.getHistory();
      const sortedByCount = history.sort((a, b) => b.queryCount - a.queryCount);
      return sortedByCount.slice(0, limit);
    } catch (error) {
      console.error('獲取最常查詢詞彙失敗:', error);
      return [];
    }
  }

  // 刪除特定記錄
  async deleteRecord(id) {
    try {
      const history = await this.getHistory();
      const filteredHistory = history.filter(record => record.id !== id);
      await this.saveHistory(filteredHistory);
      return true;
    } catch (error) {
      console.error('刪除歷史記錄失敗:', error);
      return false;
    }
  }

  // 清空歷史記錄
  async clearHistory() {
    try {
      await chrome.storage.local.remove([this.STORAGE_KEY]);
      return true;
    } catch (error) {
      console.error('清空歷史記錄失敗:', error);
      return false;
    }
  }

  // 獲取歷史統計
  async getHistoryStats() {
    try {
      const history = await this.getHistory();
      const stats = {
        totalQueries: history.length,
        totalQueryCount: history.reduce((sum, record) => sum + record.queryCount, 0),
        languageStats: {},
        averageQueriesPerDay: 0,
        mostActiveDay: null
      };

      // 語言統計
      history.forEach(record => {
        if (!stats.languageStats[record.language]) {
          stats.languageStats[record.language] = {
            count: 0,
            queryCount: 0
          };
        }
        stats.languageStats[record.language].count++;
        stats.languageStats[record.language].queryCount += record.queryCount;
      });

      // 每日查詢統計
      if (history.length > 0) {
        const oldestRecord = history[history.length - 1];
        const daysSinceFirst = Math.ceil((Date.now() - oldestRecord.timestamp) / (1000 * 60 * 60 * 24));
        stats.averageQueriesPerDay = Math.round(stats.totalQueryCount / Math.max(daysSinceFirst, 1));
      }

      return stats;
    } catch (error) {
      console.error('獲取歷史統計失敗:', error);
      return null;
    }
  }

  // 生成唯一ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 格式化時間戳
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `今天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    }
  }
}

// 匯出 HistoryManager
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryManager;
} else if (typeof self !== 'undefined') {
  self.HistoryManager = HistoryManager;
} else {
  this.HistoryManager = HistoryManager;
}