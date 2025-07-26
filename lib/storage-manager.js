// Enhanced Storage Manager for YouGlish Extension
// Handles AI reports, history, and user data with export/import capabilities

class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      AI_REPORTS: 'aiReports',
      SEARCH_HISTORY: 'searchHistory', 
      USER_SETTINGS: 'userSettings',
      LAST_SYNC: 'lastSync'
    };
    this.MAX_REPORTS = 100; // Limit for free users
    this.init();
  }

  async init() {
    // Ensure storage structure exists
    await this.ensureStorageStructure();
  }

  async ensureStorageStructure() {
    const keys = Object.values(this.STORAGE_KEYS);
    const result = await chrome.storage.local.get(keys);
    
    const defaults = {
      [this.STORAGE_KEYS.AI_REPORTS]: [],
      [this.STORAGE_KEYS.SEARCH_HISTORY]: [],
      [this.STORAGE_KEYS.USER_SETTINGS]: {
        maxReports: this.MAX_REPORTS,
        autoSave: true,
        exportFormat: 'json'
      },
      [this.STORAGE_KEYS.LAST_SYNC]: null
    };

    // Set defaults for missing keys
    const toSet = {};
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (!(key in result)) {
        toSet[key] = defaultValue;
      }
    }

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
    }
  }

  // AI Report Management
  async saveAIReport(searchText, language, analysisData, audioData = null, updateExisting = true) {
    try {
      const reports = await this.getAIReports();
      
      // Normalize text for comparison (trim and lowercase)
      const normalizedText = searchText.trim();
      const normalizedLanguage = language.toLowerCase();
      
      // Check for existing report with same text and language (case-insensitive)
      const existingIndex = reports.findIndex(report => 
        report.searchText.trim().toLowerCase() === normalizedText.toLowerCase() && 
        report.language.toLowerCase() === normalizedLanguage
      );
      
      if (existingIndex !== -1 && updateExisting) {
        // Update existing report
        const existingReport = reports[existingIndex];
        const errorAnalysis = this.analyzeForErrors(analysisData);
        
        existingReport.timestamp = Date.now();
        existingReport.analysisData = analysisData;
        if (audioData) {
          existingReport.audioData = audioData;
        }
        existingReport.tags = this.extractTags(normalizedText, analysisData);
        
        // Update error detection fields
        console.log('🔄 Updating existing report error analysis for:', existingReport.searchText);
        console.log('🔄 Error analysis result:', errorAnalysis);
        existingReport.hasErrors = errorAnalysis.hasErrors;
        existingReport.errorTypes = errorAnalysis.errorTypes;
        existingReport.errorCount = errorAnalysis.errorCount;
        existingReport.isCorrect = !errorAnalysis.hasErrors;
        
        // Normalize the stored text to prevent casing inconsistencies
        existingReport.searchText = normalizedText;
        existingReport.language = normalizedLanguage;
        
        // Move updated report to the beginning
        reports.splice(existingIndex, 1);
        reports.unshift(existingReport);
        
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: reports
        });
        
        console.log('AI Report updated (normalized):', existingReport.id, existingReport.searchText);
        return existingReport;
      } else if (existingIndex !== -1 && !updateExisting) {
        // Found existing but don't update - return the existing one
        console.log('AI Report already exists:', reports[existingIndex].id, reports[existingIndex].searchText);
        return reports[existingIndex];
      } else {
        // Analyze for errors in the content
        console.log('🆕 Creating new report for:', normalizedText);
        const errorAnalysis = this.analyzeForErrors(analysisData);
        console.log('🆕 New report error analysis result:', errorAnalysis);
        
        // Create new report with normalized data
        const newReport = {
          id: this.generateId(),
          searchText: normalizedText,
          language: normalizedLanguage,
          timestamp: Date.now(),
          analysisData,
          audioData,
          tags: this.extractTags(normalizedText, analysisData),
          favorite: false,
          // Error detection fields
          hasErrors: errorAnalysis.hasErrors,
          errorTypes: errorAnalysis.errorTypes,
          errorCount: errorAnalysis.errorCount,
          isCorrect: !errorAnalysis.hasErrors
        };

        // Add to beginning of array
        reports.unshift(newReport);
        
        // Trim to max limit
        const settings = await this.getUserSettings();
        if (reports.length > settings.maxReports) {
          reports.splice(settings.maxReports);
        }

        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: reports
        });

        console.log('AI Report saved:', newReport.id);
        return newReport;
      }

    } catch (error) {
      console.error('Error saving AI report:', error);
      throw error;
    }
  }

  async getAIReports(filter = {}) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.AI_REPORTS);
      let reports = result[this.STORAGE_KEYS.AI_REPORTS] || [];

      // Apply filters
      if (filter.language) {
        reports = reports.filter(r => r.language === filter.language);
      }
      if (filter.searchText) {
        const search = filter.searchText.toLowerCase();
        reports = reports.filter(r => 
          r.searchText.toLowerCase().includes(search) ||
          r.tags.some(tag => tag.toLowerCase().includes(search))
        );
      }
      if (filter.favorites) {
        reports = reports.filter(r => r.favorite);
      }

      return reports;
    } catch (error) {
      console.error('Error getting AI reports:', error);
      return [];
    }
  }

  async deleteAIReport(reportId) {
    try {
      const reports = await this.getAIReports();
      const filtered = reports.filter(r => r.id !== reportId);
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.AI_REPORTS]: filtered
      });

      return true;
    } catch (error) {
      console.error('Error deleting AI report:', error);
      return false;
    }
  }

  async toggleFavorite(reportId) {
    try {
      const reports = await this.getAIReports();
      const report = reports.find(r => r.id === reportId);
      
      if (report) {
        report.favorite = !report.favorite;
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: reports
        });
      }

      return report?.favorite || false;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  }

  // Cleanup and maintenance functions
  async cleanupDuplicateReports() {
    try {
      const reports = await this.getAIReports();
      const seen = new Map();
      const uniqueReports = [];
      
      reports.forEach(report => {
        const key = `${report.searchText.trim().toLowerCase()}_${report.language.toLowerCase()}`;
        
        if (!seen.has(key)) {
          // Keep the first occurrence (most recent due to unshift ordering)
          seen.set(key, true);
          // Normalize the data while we're at it
          report.searchText = report.searchText.trim();
          report.language = report.language.toLowerCase();
          uniqueReports.push(report);
        } else {
          console.log('Removing duplicate:', report.searchText, report.language);
        }
      });
      
      if (uniqueReports.length < reports.length) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: uniqueReports
        });
        
        const removed = reports.length - uniqueReports.length;
        console.log(`Cleanup complete: Removed ${removed} duplicate reports`);
        return { removed, remaining: uniqueReports.length };
      }
      
      return { removed: 0, remaining: reports.length };
      
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      throw error;
    }
  }

  // Export/Import functionality
  async exportAllData() {
    try {
      const [reports, history, settings] = await Promise.all([
        this.getAIReports(),
        this.getSearchHistory(),
        this.getUserSettings()
      ]);

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          aiReports: reports,
          searchHistory: history,
          userSettings: settings
        },
        metadata: {
          totalReports: reports.length,
          totalHistory: history.length,
          languages: [...new Set(reports.map(r => r.language))]
        }
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(importData) {
    try {
      if (!importData.version || !importData.data) {
        throw new Error('Invalid import data format');
      }

      const { aiReports, searchHistory, userSettings } = importData.data;

      // Validate data
      if (aiReports && Array.isArray(aiReports)) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: aiReports
        });
      }

      if (searchHistory && Array.isArray(searchHistory)) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.SEARCH_HISTORY]: searchHistory
        });
      }

      if (userSettings && typeof userSettings === 'object') {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.USER_SETTINGS]: { ...await this.getUserSettings(), ...userSettings }
        });
      }

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  // Search History (enhanced)
  async getSearchHistory() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.SEARCH_HISTORY);
      return result[this.STORAGE_KEYS.SEARCH_HISTORY] || [];
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }

  // User Settings
  async getUserSettings() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.USER_SETTINGS);
      return result[this.STORAGE_KEYS.USER_SETTINGS] || {};
    } catch (error) {
      console.error('Error getting user settings:', error);
      return {};
    }
  }

  async updateUserSettings(newSettings) {
    try {
      const currentSettings = await this.getUserSettings();
      const updated = { ...currentSettings, ...newSettings };
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.USER_SETTINGS]: updated
      });

      return updated;
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  // Storage Statistics
  async getStorageStats() {
    try {
      const [reports, history] = await Promise.all([
        this.getAIReports(),
        this.getSearchHistory()
      ]);

      // Calculate storage usage
      const data = { reports, history };
      const sizeBytes = new TextEncoder().encode(JSON.stringify(data)).length;

      return {
        totalReports: reports.length,
        totalHistory: history.length,
        storageUsed: this.formatBytes(sizeBytes),
        languages: [...new Set(reports.map(r => r.language))],
        favorites: reports.filter(r => r.favorite).length,
        oldestReport: reports.length > 0 ? new Date(Math.min(...reports.map(r => r.timestamp))) : null,
        newestReport: reports.length > 0 ? new Date(Math.max(...reports.map(r => r.timestamp))) : null
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {};
    }
  }

  // Analyze AI analysis for error detection
  analyzeForErrors(analysisData) {
    if (!analysisData) {
      console.log('🔍 analyzeForErrors: No analysis data');
      return { hasErrors: false, errorTypes: [], errorCount: 0 };
    }
    
    // Handle different data types
    let analysisText = '';
    if (typeof analysisData === 'string') {
      analysisText = analysisData;
    } else if (typeof analysisData === 'object' && analysisData.content) {
      analysisText = analysisData.content;
    } else if (typeof analysisData === 'object' && analysisData.analysis) {
      analysisText = analysisData.analysis;
    } else {
      console.log('🔍 analyzeForErrors: Unsupported data type:', typeof analysisData, analysisData);
      return { hasErrors: false, errorTypes: [], errorCount: 0 };
    }
    
    console.log('🔍 analyzeForErrors: Processing analysis text (type:', typeof analysisData, ', length:', analysisText.length, ')');
    console.log('🔍 analyzeForErrors: Preview:', analysisText.substring(0, 100));
    
    const analysisTextLower = analysisText.toLowerCase();
    const errorIndicators = {
      'language_mixing': [
        '語言混用', '语言混用', 'language mixing', '混用了', '非荷蘭語詞彙', '非英語詞彙', 
        '非日語詞彙', '非韓語詞彙', '英語詞彙', '德語詞彙', '混用錯誤', '语言干扰',
        '是英語詞彙', '是英语词汇', '不屬於荷蘭語', '不属于荷兰语', '不屬於英語', '不属于英语',
        '不屬於日語', '不属于日语', '不屬於韓語', '不属于韩语', 'english word', 'not dutch',
        'not english', 'not japanese', 'not korean', '英文詞彙', '英文词汇'
      ],
      'grammar': [
        '語法錯誤', '语法错误', 'grammar error', '動詞位置錯誤', '语序错误', 
        '語序錯誤', 'v2規則', 'v2规则', 'word order', '動詞變位錯誤', '語法不正確',
        '语法不正确', 'grammatically incorrect', '文法錯誤', '文法错误'
      ],
      'spelling': [
        '拼寫錯誤', '拼写错误', 'spelling error', 'misspelled', '拼寫', '拼写'
      ],
      'pronunciation': [
        '發音錯誤', '发音错误', 'pronunciation error', '發音', '发音'
      ],
      'usage': [
        '用詞錯誤', '用词错误', 'usage error', '用法錯誤', '用法错误'
      ],
      'structure': [
        '句子結構', '句子结构', 'sentence structure', '結構錯誤', '结构错误',
        '表達方式', '表达方式', '不自然', '不符合', '不符合習慣', '不符合习惯'
      ]
    };
    
    const detectedErrors = [];
    let errorCount = 0;
    
    // Check for error indicators
    for (const [errorType, indicators] of Object.entries(errorIndicators)) {
      for (const indicator of indicators) {
        if (analysisTextLower.includes(indicator)) {
          if (!detectedErrors.includes(errorType)) {
            detectedErrors.push(errorType);
          }
          errorCount++;
          break; // Only count once per error type
        }
      }
    }
    
    // Professional prompt patterns for error responses
    const professionalErrorIndicators = [
      '學習機會來了', '学习机会来了',
      '學習機會', '学习机会',
      '讓我們一起改進', '让我们一起改进',
      '小調整建議', '小调整建议',
      '可以這樣改進', '可以这样改进'
    ];
    
    // Also check for explicit error markers and patterns
    const errorMarkers = ['❌', '🚫', '錯誤', '错误', 'error', 'incorrect', 'wrong'];
    let hasErrorMarkers = false;
    let hasProfessionalErrorIndicators = false;
    
    // Check professional error patterns
    for (const indicator of professionalErrorIndicators) {
      if (analysisTextLower.includes(indicator)) {
        hasProfessionalErrorIndicators = true;
        errorCount++;
        break;
      }
    }
    
    // Check traditional error markers
    for (const marker of errorMarkers) {
      if (analysisTextLower.includes(marker)) {
        hasErrorMarkers = true;
        errorCount++;
        break;
      }
    }
    
    // Check for specific error analysis patterns from the AI
    const errorPatterns = [
      '存在.*錯誤', '存在.*错误', '存在一些錯誤', '存在一些错误',
      '❌.*錯誤版本', '❌.*错误版本', '✅.*正確版本', '✅.*正确版本',
      '錯誤分析', '错误分析', '詳細解釋.*錯誤', '详细解释.*错误',
      '應該使用', '应该使用', '正確的說法', '正确的说法',
      '修正後的版本', '修正后的版本'
    ];
    
    let hasErrorPatterns = false;
    for (const pattern of errorPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(analysisTextLower)) {
        hasErrorPatterns = true;
        errorCount++;
        break;
      }
    }
    
    // Professional prompt patterns for correct responses
    const professionalCorrectIndicators = [
      '太棒了！這是完全正確的', '太棒了！这是完全正确的',
      '太棒了！這是', '太棒了！这是',
      '完全正確的表達', '完全正确的表达',
      '完全正確的', '完全正确的',
      '這是一個完美的', '这是一个完美的'
    ];
    
    // Traditional correct indicators - must be definitive statements
    const strongCorrectIndicators = [
      '因此，這個文本是正確的，沒有錯誤', '因此，这个文本是正确的，没有错误',
      '這個文本是正確的，沒有錯誤', '这个文本是正确的，没有错误',
      '✅ 此文本語法正確', '✅ 此文本语法正确', 
      '沒有錯誤', '没有错误', 'no errors found', 'text is correct'
    ];
    
    // Combine all correct indicators
    const allCorrectIndicators = [...professionalCorrectIndicators, ...strongCorrectIndicators];
    const isDefinitivelyCorrect = allCorrectIndicators.some(indicator => analysisTextLower.includes(indicator));
    
    // Priority logic: Strong error indicators override weaker correct indicators
    const hasStrongErrorIndicators = hasErrorMarkers || hasErrorPatterns || detectedErrors.length > 0 || hasProfessionalErrorIndicators;
    
    const hasErrors = hasStrongErrorIndicators && !isDefinitivelyCorrect;
    
    if (hasErrors) {
      console.log('🔍 Errors detected:', detectedErrors);
    }
    
    // Log detailed debug information for debugging
    console.log('🔍 Error detection details:', {
      detectedErrors,
      hasErrorMarkers,
      hasErrorPatterns,
      hasProfessionalErrorIndicators,
      hasStrongErrorIndicators,
      isDefinitivelyCorrect,
      finalResult: hasErrors,
      errorCount,
      analysisPreview: analysisTextLower.substring(0, 200)
    });
    
    return {
      hasErrors,
      errorTypes: detectedErrors,
      errorCount: Math.max(errorCount, (hasErrorMarkers || hasErrorPatterns || hasProfessionalErrorIndicators) ? 1 : 0)
    };
  }

  // Utility functions
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  extractTags(searchText, analysisData) {
    // Start with empty tags - let users assign their own tags
    const tags = [];
    
    // Extract meaningful keywords from AI analysis only (no automatic word-name tag)
    if (analysisData && typeof analysisData === 'string') {
      const words = analysisData.toLowerCase().match(/\b\w{3,}\b/g) || [];
      const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'run', 'too', 'any', 'ask', 'big', 'box', 'eat', 'end', 'far', 'fun', 'let', 'own', 'put', 'say', 'she', 'try', 'use', 'way', 'win', 'yes'];
      
      // Only add meaningful keywords from analysis, not the search word itself
      words.forEach(word => {
        if (word.length > 3 && 
            !commonWords.includes(word) && 
            !tags.includes(word) && 
            word !== searchText.toLowerCase()) { // Don't add the search word itself
          tags.push(word);
        }
      });
    }

    return tags.slice(0, 5); // Reduce to 5 suggested tags max, let users customize
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Re-analyze all existing reports for error detection
  async reAnalyzeAllReports() {
    try {
      const reports = await this.getAIReports();
      let updatedCount = 0;
      
      const updatedReports = reports.map(report => {
        if (report.analysisData) {
          const errorAnalysis = this.analyzeForErrors(report.analysisData);
          const oldHasErrors = report.hasErrors;
          
          // Update error fields
          report.hasErrors = errorAnalysis.hasErrors;
          report.errorTypes = errorAnalysis.errorTypes;
          report.errorCount = errorAnalysis.errorCount;
          report.isCorrect = !errorAnalysis.hasErrors;
          
          if (oldHasErrors !== errorAnalysis.hasErrors) {
            updatedCount++;
            console.log(`🔄 Updated error status for "${report.searchText}": ${oldHasErrors} → ${errorAnalysis.hasErrors}`);
          }
        }
        return report;
      });
      
      if (updatedCount > 0) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: updatedReports
        });
        console.log(`✅ Re-analyzed ${updatedCount} reports with updated error detection`);
      }
      
      return { success: true, updatedCount };
    } catch (error) {
      console.error('Error re-analyzing reports:', error);
      return { success: false, error: error.message };
    }
  }

  // Clear all data (for testing or user request)
  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      await this.ensureStorageStructure();
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }
}

// Create global instance
window.storageManager = new StorageManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}