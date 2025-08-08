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
      
      // 雙重保險：確保 history 是數組
      if (!Array.isArray(history)) {
        console.error('⚠️ getHistory() did not return an array:', typeof history, history);
        throw new Error('History data is corrupted, cannot add record');
      }
      
      // 檢查是否已存在相同的查詢
      // For YouTube learning with timestamps, treat each timestamp as a unique entry
      let existingIndex = -1;
      
      if (videoSource && videoSource.videoTimestamp !== null && videoSource.videoTimestamp !== undefined) {
        // For video learning: check text + language + video URL + timestamp
        existingIndex = history.findIndex(item => 
          item.text === record.text && 
          item.language === record.language &&
          item.videoSource?.url === videoSource.url &&
          item.videoSource?.videoTimestamp === videoSource.videoTimestamp
        );
      } else if (detectionMethod === 'article-selection') {
        // For article selections: treat each as unique - don't deduplicate
        // Each article selection should be its own entry even if same text
        existingIndex = -1;
      } else {
        // For regular queries: treat each as a new entry to preserve full history
        // This allows users to see all their search history, not just unique terms
        existingIndex = -1;
      }

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
      
      // 🎯 DEBUG: Show complete saved record structure for timestamp verification
      console.log('💾 SAVED RECORD DEBUG - Complete structure:', JSON.stringify(record, null, 2));
      console.log('⏰ SAVED RECORD DEBUG - Timestamp details:', {
        hasVideoSource: !!record.videoSource,
        videoTimestamp: record.videoSource?.videoTimestamp,
        timestampType: typeof record.videoSource?.videoTimestamp,
        timestampIsNull: record.videoSource?.videoTimestamp === null,
        timestampIsUndefined: record.videoSource?.videoTimestamp === undefined
      });
      
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
      const history = result[this.STORAGE_KEY];
      
      // 驗證和修復數據
      if (!history) {
        console.log('📝 History not found, initializing empty array');
        return [];
      }
      
      if (!Array.isArray(history)) {
        console.error('⚠️ History data is corrupted (not an array):', typeof history);
        console.log('📊 Corrupted data sample:', JSON.stringify(history).substring(0, 200) + '...');
        
        let recoveredItems = [];
        
        // 嘗試修復：如果是對象，嘗試多種恢復方法
        if (typeof history === 'object' && history !== null) {
          console.log('🔧 Attempting to recover history from object format...');
          
          // Method 1: Try to extract from Object.values()
          try {
            const entries = Object.values(history);
            console.log(`📋 Found ${entries.length} entries in object values`);
            
            const validEntries = entries.filter(item => {
              return item && 
                     typeof item === 'object' && 
                     typeof item.text === 'string' && 
                     typeof item.language === 'string' &&
                     typeof item.timestamp === 'number';
            });
            
            if (validEntries.length > 0) {
              console.log(`✅ Recovered ${validEntries.length} valid entries from object values`);
              recoveredItems = validEntries;
            }
          } catch (error) {
            console.warn('⚠️ Method 1 (Object.values) failed:', error);
          }
          
          // Method 2: If object has array-like properties (0, 1, 2...)
          if (recoveredItems.length === 0) {
            try {
              const keys = Object.keys(history).filter(key => /^\d+$/.test(key));
              if (keys.length > 0) {
                console.log(`🔍 Found ${keys.length} numeric keys, attempting array-like recovery`);
                
                const arrayLikeItems = keys.map(key => history[key]).filter(item => {
                  return item && 
                         typeof item === 'object' && 
                         typeof item.text === 'string';
                });
                
                if (arrayLikeItems.length > 0) {
                  console.log(`✅ Recovered ${arrayLikeItems.length} items from array-like object`);
                  recoveredItems = arrayLikeItems;
                }
              }
            } catch (error) {
              console.warn('⚠️ Method 2 (array-like) failed:', error);
            }
          }
          
          // Method 3: Look for nested arrays
          if (recoveredItems.length === 0) {
            try {
              for (const [key, value] of Object.entries(history)) {
                if (Array.isArray(value) && value.length > 0) {
                  console.log(`🔍 Found array in key "${key}" with ${value.length} items`);
                  const validItems = value.filter(item => 
                    item && typeof item === 'object' && item.text
                  );
                  if (validItems.length > 0) {
                    console.log(`✅ Recovered ${validItems.length} items from nested array`);
                    recoveredItems = validItems;
                    break;
                  }
                }
              }
            } catch (error) {
              console.warn('⚠️ Method 3 (nested arrays) failed:', error);
            }
          }
        }
        
        // If recovery successful, save and return recovered data
        if (recoveredItems.length > 0) {
          console.log(`🎉 Successfully recovered ${recoveredItems.length} history items!`);
          await this.saveHistory(recoveredItems);
          return recoveredItems;
        }
        
        // 無法修復，重置為空數組
        console.log('🔄 No recovery possible, resetting corrupted history to empty array');
        await this.clearHistory();
        return [];
      }
      
      // 驗證數組中的項目
      const validHistory = history.filter(item => {
        if (!item || typeof item !== 'object') {
          console.warn('⚠️ Removing invalid history item:', item);
          return false;
        }
        if (!item.text || !item.language || !item.timestamp) {
          console.warn('⚠️ Removing incomplete history item:', item);
          return false;
        }
        return true;
      });
      
      // 如果過濾後的數據與原數據不同，保存清理後的版本
      if (validHistory.length !== history.length) {
        console.log(`🔧 Cleaned history: ${history.length} → ${validHistory.length} items`);
        await this.saveHistory(validHistory);
      }
      
      return validHistory;
    } catch (error) {
      console.error('獲取歷史記錄失敗:', error);
      return [];
    }
  }

  // 保存歷史記錄
  async saveHistory(history) {
    try {
      // 驗證輸入數據
      if (!Array.isArray(history)) {
        console.error('⚠️ Attempting to save non-array as history:', typeof history);
        throw new Error('Cannot save non-array data as history');
      }
      
      // 確保所有項目都是有效的歷史記錄
      const validHistory = history.filter((item, index) => {
        if (!item || typeof item !== 'object') {
          console.warn(`⚠️ Removing invalid item at index ${index}: not an object`);
          return false;
        }
        
        if (typeof item.text !== 'string' || !item.text.trim()) {
          console.warn(`⚠️ Removing item at index ${index}: invalid text`);
          return false;
        }
        
        if (typeof item.language !== 'string' || !item.language.trim()) {
          console.warn(`⚠️ Removing item at index ${index}: invalid language`);
          return false;
        }
        
        if (typeof item.timestamp !== 'number' || item.timestamp <= 0) {
          console.warn(`⚠️ Removing item at index ${index}: invalid timestamp`);
          return false;
        }
        
        // Ensure required fields exist
        if (!item.id) {
          console.warn(`⚠️ Item at index ${index} missing ID, generating new one`);
          item.id = this.generateId();
        }
        
        if (typeof item.queryCount !== 'number' || item.queryCount <= 0) {
          console.warn(`⚠️ Item at index ${index} has invalid queryCount, setting to 1`);
          item.queryCount = 1;
        }
        
        return true;
      });
      
      if (validHistory.length !== history.length) {
        console.warn(`⚠️ Filtered out ${history.length - validHistory.length} invalid history items`);
      }
      
      // Double-check: make sure we're still saving an array
      if (!Array.isArray(validHistory)) {
        console.error('⚠️ validHistory is not an array after filtering!');
        throw new Error('Data corruption during validation');
      }
      
      // Create backup before saving if this is a significant change
      if (validHistory.length > 0 && history.length - validHistory.length > 5) {
        console.log('🔄 Creating backup due to significant data changes...');
        await chrome.storage.local.set({
          [`${this.STORAGE_KEY}_backup_${Date.now()}`]: history
        });
      }
      
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: validHistory
      });
      
      console.log(`✅ Saved ${validHistory.length} history records successfully`);
      
      // Verify the save was successful
      const verification = await chrome.storage.local.get([this.STORAGE_KEY]);
      const savedData = verification[this.STORAGE_KEY];
      
      if (!Array.isArray(savedData)) {
        console.error('❌ CRITICAL: Data corrupted immediately after save!');
        console.error('Saved data type:', typeof savedData);
        console.error('Saved data:', savedData);
        throw new Error('Data corruption detected immediately after save');
      }
      
      console.log(`🔍 Save verification passed: ${savedData.length} items confirmed`);
      
    } catch (error) {
      console.error('保存歷史記錄失敗:', error);
      throw error;
    }
  }

  // 搜尋歷史記錄
  async searchHistory(query, language = null) {
    try {
      const history = await this.getHistory();
      if (!Array.isArray(history)) {
        console.error('⚠️ searchHistory: history is not an array');
        return [];
      }
      
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
      if (!Array.isArray(history)) {
        console.error('⚠️ getHistoryByLanguage: history is not an array');
        return [];
      }
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
      if (!Array.isArray(history)) {
        console.error('⚠️ getRecentHistory: history is not an array');
        return [];
      }
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
      if (!Array.isArray(history)) {
        console.error('⚠️ getMostQueried: history is not an array');
        return [];
      }
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
      if (!Array.isArray(history)) {
        console.error('⚠️ deleteRecord: history is not an array');
        return false;
      }
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
      console.log('🗑️ History cleared successfully');
      return true;
    } catch (error) {
      console.error('清空歷史記錄失敗:', error);
      return false;
    }
  }

  // 診斷歷史記錄數據狀態
  async diagnoseHistory() {
    try {
      console.log('🔍 Starting history diagnosis...');
      
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const rawHistory = result[this.STORAGE_KEY];
      
      const diagnosis = {
        exists: rawHistory !== undefined,
        type: typeof rawHistory,
        isArray: Array.isArray(rawHistory),
        isEmpty: !rawHistory,
        keys: [],
        sampleData: null,
        corruptionType: 'none'
      };
      
      if (rawHistory) {
        if (typeof rawHistory === 'object') {
          diagnosis.keys = Object.keys(rawHistory);
          diagnosis.sampleData = JSON.stringify(rawHistory).substring(0, 300);
          
          if (!Array.isArray(rawHistory)) {
            // Determine corruption type
            const keys = Object.keys(rawHistory);
            const hasNumericKeys = keys.some(key => /^\d+$/.test(key));
            const hasNestedArrays = Object.values(rawHistory).some(value => Array.isArray(value));
            
            if (hasNumericKeys) {
              diagnosis.corruptionType = 'array-like-object';
            } else if (hasNestedArrays) {
              diagnosis.corruptionType = 'nested-arrays';
            } else {
              diagnosis.corruptionType = 'unknown-object';
            }
          }
        }
      }
      
      console.log('📊 History diagnosis result:', diagnosis);
      return diagnosis;
    } catch (error) {
      console.error('❌ History diagnosis failed:', error);
      return { error: error.message };
    }
  }

  // 修復損壞的歷史記錄數據
  async repairHistory() {
    try {
      console.log('🔧 Starting history repair...');
      
      // 先診斷問題
      const diagnosis = await this.diagnoseHistory();
      console.log('🔍 Diagnosis:', diagnosis);
      
      // 強制重新加載和驗證歷史記錄
      const history = await this.getHistory();
      
      if (!Array.isArray(history)) {
        console.log('🔄 History was not an array, clearing...');
        await this.clearHistory();
        return { 
          repaired: true, 
          recordsRecovered: 0, 
          diagnosis,
          action: 'cleared-corrupted-data'
        };
      }
      
      const originalLength = history.length;
      
      // 重新保存會觸發驗證和清理
      await this.saveHistory(history);
      
      const newHistory = await this.getHistory();
      const finalLength = newHistory.length;
      
      console.log(`✅ History repair completed: ${originalLength} → ${finalLength} records`);
      
      return {
        repaired: true,
        originalRecords: originalLength,
        recordsRecovered: finalLength,
        recordsRemoved: originalLength - finalLength,
        diagnosis,
        action: 'cleaned-and-validated'
      };
    } catch (error) {
      console.error('❌ History repair failed:', error);
      return { repaired: false, error: error.message };
    }
  }

  // 獲取歷史統計
  async getHistoryStats() {
    try {
      const history = await this.getHistory();
      if (!Array.isArray(history)) {
        console.error('⚠️ getHistoryStats: history is not an array');
        return null;
      }
      
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