// Enhanced Storage Manager for YouGlish Extension
// Handles AI reports, history, and user data with export/import capabilities
// Now with IndexedDB support for large audio files

class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      AI_REPORTS: 'aiReports',
      SEARCH_HISTORY: 'searchHistory', 
      USER_SETTINGS: 'userSettings',
      LAST_SYNC: 'lastSync',
      MIGRATION_STATUS: 'indexedDBMigrationStatus'
    };
    this.MAX_REPORTS = 5000; // Increased limit for power users
    this.indexedDBManager = null;
    this.init();
  }

  async init() {
    // Ensure storage structure exists
    await this.ensureStorageStructure();
    
    // Initialize IndexedDB if available
    if (window.indexedDBManager) {
      this.indexedDBManager = window.indexedDBManager;
      console.log('✅ IndexedDB integration enabled');
      
      // Check if migration is needed
      await this.checkAndMigrateToIndexedDB();
    } else {
      console.log('⚠️ IndexedDB manager not available, using Chrome Storage only');
    }
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
        exportFormat: 'json',
        saveAudio: true, // Now enabled by default since we have IndexedDB
        maxAudioFiles: 1000 // Much higher limit with IndexedDB
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

    // IMPORTANT: Update existing user settings if needed
    if (result[this.STORAGE_KEYS.USER_SETTINGS]) {
      const currentSettings = result[this.STORAGE_KEYS.USER_SETTINGS];
      let needsUpdate = false;
      const updatedSettings = { ...currentSettings };
      
      // Upgrade maxReports from old limit
      if (currentSettings.maxReports === 100) {
        console.log('🔄 Upgrading user settings: increasing maxReports from 100 to 5000');
        updatedSettings.maxReports = this.MAX_REPORTS;
        needsUpdate = true;
      }
      
      // Enable audio saving for existing users now that we have IndexedDB
      if (currentSettings.saveAudio === false || currentSettings.saveAudio === undefined) {
        console.log('🔄 Upgrading user settings: enabling audio saving with IndexedDB');
        updatedSettings.saveAudio = true;
        updatedSettings.maxAudioFiles = 1000; // Increase limit too
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        toSet[this.STORAGE_KEYS.USER_SETTINGS] = updatedSettings;
      }
    }

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
    }
  }

  // AI Report Management
  async saveAIReport(searchText, language, analysisData, audioData = null, videoSource = null, updateExisting = true, detectionMethod = null) {
    try {
      // Check user settings for audio saving preference
      const settings = await this.getUserSettings();
      const shouldSaveAudio = settings.saveAudio && audioData;
      
      if (audioData && !settings.saveAudio) {
        console.log('🔇 Audio saving disabled in settings, skipping audio data');
        audioData = null;
      } else if (audioData && settings.saveAudio) {
        console.log('🔊 Audio saving enabled, will save audio data');
      }
      
      // Check storage usage before saving
      const stats = await this.getStorageStats();
      if (stats.isNearLimit) {
        console.warn('⚠️ Storage usage is near limit:', stats.usagePercentage + '%');
        console.warn('📊 Attempting automatic cleanup...');
        
        // Automatic cleanup when near storage limit
        await this.performAutoCleanup();
        
        // Recheck after cleanup
        const newStats = await this.getStorageStats();
        console.log('🧹 Post-cleanup usage:', newStats.usagePercentage + '%');
      }
      
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
        existingReport.analysisData = this.compressAnalysisData(analysisData);
        
        // Handle audio with IndexedDB
        if (audioData && this.indexedDBManager) {
          // Save to IndexedDB
          const audioId = `audio_${existingReport.id}`;
          await this.indexedDBManager.saveAudio({
            id: audioId,
            reportId: existingReport.id,
            audioUrl: audioData,
            text: normalizedText,
            language: normalizedLanguage,
            timestamp: Date.now()
          });
          existingReport.audioInIndexedDB = true;
          existingReport.audioId = audioId;
          // Don't store audio in Chrome Storage
          delete existingReport.audioData;
        } else if (audioData && !this.indexedDBManager) {
          // Fallback to Chrome Storage if IndexedDB not available
          existingReport.audioData = audioData;
        }
        if (videoSource) {
          existingReport.videoSource = videoSource;
          console.log('🎬 Updated existing report with video source:', videoSource);
        }
        if (detectionMethod) {
          existingReport.detectionMethod = detectionMethod;
          console.log('🔍 Updated existing report with detection method:', detectionMethod);
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
        
        // Compress large analysis data to save storage space
        const compressedAnalysisData = this.compressAnalysisData(analysisData);
        
        // Create new report with normalized data
        const newReport = {
          id: this.generateId(),
          searchText: normalizedText,
          language: normalizedLanguage,
          timestamp: Date.now(),
          analysisData: compressedAnalysisData,
          videoSource, // Include video source data
          detectionMethod, // Include detection method for source type identification
          tags: this.extractTags(normalizedText, analysisData),
          favorite: false,
          // Error detection fields
          hasErrors: errorAnalysis.hasErrors,
          errorTypes: errorAnalysis.errorTypes,
          errorCount: errorAnalysis.errorCount,
          isCorrect: !errorAnalysis.hasErrors
        };
        
        // Handle audio with IndexedDB
        if (audioData && this.indexedDBManager) {
          // Save to IndexedDB
          const audioId = `audio_${newReport.id}`;
          await this.indexedDBManager.saveAudio({
            id: audioId,
            reportId: newReport.id,
            audioUrl: audioData,
            text: normalizedText,
            language: normalizedLanguage,
            timestamp: Date.now()
          });
          newReport.audioInIndexedDB = true;
          newReport.audioId = audioId;
          // Don't store audio in Chrome Storage
        } else if (audioData && !this.indexedDBManager) {
          // Fallback to Chrome Storage if IndexedDB not available
          newReport.audioData = audioData;
        }
        
        if (videoSource) {
          console.log('🎬 Created new report with video source:', videoSource);
        }

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

      // Calculate storage usage for all data
      const allData = await chrome.storage.local.get(null);
      const totalSizeBytes = new TextEncoder().encode(JSON.stringify(allData)).length;
      const reportsSizeBytes = new TextEncoder().encode(JSON.stringify(reports)).length;
      const historySizeBytes = new TextEncoder().encode(JSON.stringify(history)).length;

      // Chrome storage quota is approximately 5MB for local storage
      const chromeQuotaBytes = 5 * 1024 * 1024; // 5MB
      const usagePercentage = (totalSizeBytes / chromeQuotaBytes) * 100;

      console.log('📊 Storage Usage Analysis:', {
        totalSize: this.formatBytes(totalSizeBytes),
        reportsSize: this.formatBytes(reportsSizeBytes),
        historySize: this.formatBytes(historySizeBytes),
        usagePercentage: `${usagePercentage.toFixed(1)}%`,
        reportsCount: reports.length,
        isNearLimit: usagePercentage > 80
      });

      return {
        totalReports: reports.length,
        totalHistory: history.length,
        storageUsed: this.formatBytes(totalSizeBytes),
        reportsSize: this.formatBytes(reportsSizeBytes),
        historySize: this.formatBytes(historySizeBytes),
        usagePercentage: usagePercentage.toFixed(1),
        isNearLimit: usagePercentage > 80,
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
    
    // CONSERVATIVE ERROR DETECTION - Only mark as incorrect when AI explicitly indicates errors
    
    // Very explicit error indicators - only these should mark as incorrect
    const explicitErrorIndicators = [
      '學習機會來了', '学习机会来了', // Professional prompt error marker
      '這是錯誤的', '这是错误的',
      '語法錯誤', '语法错误', 
      '拼寫錯誤', '拼写错误',
      '不正確', '不正确',
      '應該改為', '应该改为',
      '正確的說法是', '正确的说法是',
      '❌', '🚫' // Visual error markers
    ];
    
    let hasExplicitErrorIndicators = false;
    
    // Check for explicit error indicators only - much more conservative
    for (const indicator of explicitErrorIndicators) {
      if (analysisTextLower.includes(indicator)) {
        hasExplicitErrorIndicators = true;
        errorCount++;
        console.log('🚨 Found explicit error indicator:', indicator);
        break;
      }
    }
    
    // Professional prompt patterns for correct responses
    const professionalCorrectIndicators = [
      '太棒了！這是完全正確的', '太棒了！这是完全正确的',
      '太棒了！這句', '太棒了！这句', // Added to catch "太棒了！這句英文表達完全正確"
      '太棒了！這是', '太棒了！这是',
      '完全正確的表達', '完全正确的表达',
      '表達完全正確', '表达完全正确', // Added reverse pattern
      '完全正確的', '完全正确的',
      '這是一個完美的', '这是一个完美的',
      '英文表達完全正確', '英文表达完全正确', // Added specific pattern
      '表達完全沒有問題', '表达完全没有问题' // Added alternative positive pattern
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
    
    // CONSERVATIVE APPROACH: Only mark as incorrect with explicit error indicators
    // Default to correct unless there are very clear error signals
    
    // Only mark as having errors if:
    // 1. There are explicit error indicators AND
    // 2. No definitive correct indicators override them
    const hasErrors = hasExplicitErrorIndicators && !isDefinitivelyCorrect;
    
    // Log the decision for debugging
    if (hasExplicitErrorIndicators) {
      console.log('🔍 CONSERVATIVE: Found explicit error indicators');
    }
    if (isDefinitivelyCorrect) {
      console.log('🔍 CONSERVATIVE: Found definitive correct indicators');
    }
    if (!hasExplicitErrorIndicators && !isDefinitivelyCorrect) {
      console.log('🔍 CONSERVATIVE: No strong indicators found - defaulting to CORRECT');
    }
    
    if (hasErrors) {
      console.log('🔍 Errors detected:', detectedErrors);
    }
    
    // Log detailed debug information for debugging  
    console.log('🔍 CONSERVATIVE Error detection details:', {
      hasExplicitErrorIndicators,
      isDefinitivelyCorrect,
      finalResult: hasErrors,
      errorCount,
      detectedPatterns: detectedErrors,
      analysisPreview: analysisTextLower.substring(0, 200)
    });
    
    return {
      hasErrors,
      errorTypes: detectedErrors,
      errorCount: hasExplicitErrorIndicators ? Math.max(errorCount, 1) : 0
    };
  }

  // Compress analysis data to save storage space
  compressAnalysisData(analysisData) {
    if (!analysisData) return analysisData;
    
    if (typeof analysisData === 'string') {
      // If analysis is too long, truncate but keep essential parts
      if (analysisData.length > 2000) {
        // Keep first 1500 chars and last 500 chars with separator
        const firstPart = analysisData.substring(0, 1500);
        const lastPart = analysisData.substring(analysisData.length - 500);
        return firstPart + '\n\n...(compressed)...\n\n' + lastPart;
      }
      return analysisData;
    }
    
    if (typeof analysisData === 'object' && analysisData.content) {
      const content = analysisData.content;
      if (content.length > 2000) {
        return {
          ...analysisData,
          content: content.substring(0, 1500) + '\n\n...(compressed)...\n\n' + content.substring(content.length - 500),
          originalLength: content.length,
          compressed: true
        };
      }
    }
    
    return analysisData;
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

  // Migration function to add detectionMethod to existing reports  
  async migrateReportsDetectionMethod() {
    try {
      const reports = await this.getAIReports();
      let updatedCount = 0;
      
      console.log('🔄 Starting detection method migration for', reports.length, 'reports');
      
      // Process in batches to avoid freezing
      const batchSize = 50;
      for (let i = 0; i < reports.length; i += batchSize) {
        const batch = reports.slice(i, Math.min(i + batchSize, reports.length));
        
        batch.forEach(report => {
          if (!report.detectionMethod) {
            if (report.videoSource) {
              // Determine detection method based on video source characteristics
              const videoSource = report.videoSource;
              
              if (videoSource.url && !videoSource.url.includes('youtube.com') && !videoSource.url.includes('youtu.be') && !videoSource.url.includes('youglish.com')) {
                // Non-YouTube URL suggests article
                report.detectionMethod = 'article-learning';
                updatedCount++;
                console.log('🔄 Migrated report to article-learning (URL):', report.searchText.substring(0, 30) + '...');
              } else if (videoSource.domain && !videoSource.channel) {
                // Has domain but no channel suggests article
                report.detectionMethod = 'article-learning';
                updatedCount++;
                console.log('🔄 Migrated report to article-learning (domain):', report.searchText.substring(0, 30) + '...');
              } else if (videoSource.author && !videoSource.channel) {
                // Has author but no channel suggests article
                report.detectionMethod = 'article-learning';
                updatedCount++;
                console.log('🔄 Migrated report to article-learning (author):', report.searchText.substring(0, 30) + '...');
              } else if (videoSource.publishDate && !videoSource.videoTimestamp) {
                // Has publish date but no video timestamp suggests article
                report.detectionMethod = 'article-learning';
                updatedCount++;
                console.log('🔄 Migrated report to article-learning (publishDate):', report.searchText.substring(0, 30) + '...');
              } else if (videoSource.paragraph || videoSource.context) {
                // Has paragraph or context suggests article
                report.detectionMethod = 'article-learning';
                updatedCount++;
                console.log('🔄 Migrated report to article-learning (paragraph/context):', report.searchText.substring(0, 30) + '...');
              } else {
                // Default to video for YouTube URLs or if no article indicators
                report.detectionMethod = 'video-learning';
                updatedCount++;
                console.log('🔄 Migrated report to video-learning:', report.searchText.substring(0, 30) + '...');
              }
            } else {
              // No video source - default based on language
              report.detectionMethod = 'auto';
              updatedCount++;
              console.log('🔄 Migrated report to auto (no source):', report.searchText.substring(0, 30) + '...');
            }
          }
        });
        
        // Allow browser to breathe between batches
        if (i + batchSize < reports.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      if (updatedCount > 0) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: reports
        });
        console.log('✅ Migration completed:', updatedCount, 'reports updated');
      } else {
        console.log('✅ No migration needed - all reports already have detection methods');
      }
      
      return {
        success: true,
        updatedCount: updatedCount,
        totalReports: reports.length
      };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        error: error.message,
        updatedCount: 0
      };
    }
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

  // Automatic cleanup when storage is near limit
  async performAutoCleanup() {
    try {
      console.log('🧹 Starting automatic storage cleanup...');
      
      const reports = await this.getAIReports();
      const initialCount = reports.length;
      let savedSpace = 0;
      
      // Step 1: Remove audio data first (biggest space saver)
      console.log('🧹 Step 1: Removing audio data to save space...');
      const reportsWithAudio = reports.filter(r => r.audioData);
      console.log(`📊 Found ${reportsWithAudio.length} reports with audio data`);
      
      if (reportsWithAudio.length > 0) {
        // Remove audio from all but the 20 most recent reports
        const reportsToKeepAudio = reportsWithAudio
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 20);
        
        const reportsToRemoveAudio = reportsWithAudio
          .filter(r => !reportsToKeepAudio.includes(r));
        
        reportsToRemoveAudio.forEach(report => {
          if (report.audioData) {
            delete report.audioData;
            savedSpace++;
          }
        });
        
        console.log(`🗑️ Removed audio from ${savedSpace} reports, kept audio for ${reportsToKeepAudio.length} recent reports`);
      }
      
      // Step 2: Remove old reports without video sources (less valuable)
      const reportsWithVideo = reports.filter(r => r.videoSource && r.videoSource.url);
      const reportsWithoutVideo = reports.filter(r => !r.videoSource || !r.videoSource.url);
      
      // Keep more reports since we removed heavy audio data
      // Keep newest 4000 reports with video, newest 1500 without video
      const cleanedReports = [
        ...reportsWithVideo.slice(0, 4000),
        ...reportsWithoutVideo.slice(0, 1500)
      ].sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first
      
      if (cleanedReports.length < initialCount || savedSpace > 0) {
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: cleanedReports
        });
        
        const removedReports = initialCount - cleanedReports.length;
        console.log(`🧹 Cleanup completed:`);
        console.log(`   📊 Removed audio from ${savedSpace} reports`);
        console.log(`   🗑️ Removed ${removedReports} old reports`);
        console.log(`   📝 Kept ${cleanedReports.length} reports`);
        
        // Also cleanup old history if needed
        await this.cleanupOldHistory();
        
        return { 
          success: true, 
          removedReports: removedReports, 
          removedAudio: savedSpace,
          remainingReports: cleanedReports.length 
        };
      }
      
      return { success: true, removedReports: 0, removedAudio: 0, remainingReports: initialCount };
      
    } catch (error) {
      console.error('Error during auto cleanup:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Cleanup old history entries
  async cleanupOldHistory() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.SEARCH_HISTORY);
      const history = result[this.STORAGE_KEYS.SEARCH_HISTORY] || [];
      
      if (history.length > 500) {
        // Keep only newest 500 history entries
        const cleanedHistory = history.slice(0, 500);
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.SEARCH_HISTORY]: cleanedHistory
        });
        console.log(`🧹 History cleanup: Removed ${history.length - 500} old entries`);
      }
    } catch (error) {
      console.error('Error cleaning up history:', error);
    }
  }

  // Export all audio data as downloadable files (from both Chrome Storage and IndexedDB)
  async exportAllAudioData() {
    try {
      console.log('📦 Exporting all audio data...');
      
      const reports = await this.getAIReports();
      const audioToExport = [];
      
      // Collect audio from Chrome Storage
      const reportsWithChromeAudio = reports.filter(r => r.audioData);
      console.log(`📊 Found ${reportsWithChromeAudio.length} reports with audio in Chrome Storage`);
      
      // Collect audio from IndexedDB
      let indexedDBAudioCount = 0;
      if (this.indexedDBManager) {
        const reportsWithIndexedDBAudio = reports.filter(r => r.audioInIndexedDB && r.audioId);
        console.log(`📊 Found ${reportsWithIndexedDBAudio.length} reports with audio in IndexedDB`);
        
        for (const report of reportsWithIndexedDBAudio) {
          try {
            const audio = await this.indexedDBManager.getAudio(report.audioId);
            if (audio) {
              audioToExport.push({
                ...report,
                audioData: audio.audioUrl
              });
              indexedDBAudioCount++;
            }
          } catch (error) {
            console.error(`Failed to get audio for report ${report.id}:`, error);
          }
        }
      }
      
      // Add Chrome Storage audio
      audioToExport.push(...reportsWithChromeAudio);
      
      if (audioToExport.length === 0) {
        console.log('ℹ️ No audio data found to export');
        return { success: false, message: 'No audio data found to export' };
      }
      
      console.log(`📊 Total audio to export: ${audioToExport.length} (Chrome: ${reportsWithChromeAudio.length}, IndexedDB: ${indexedDBAudioCount})`);
      
      // Create export data structure
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalAudioFiles: audioToExport.length,
        audioFiles: audioToExport.map((report, index) => ({
          id: report.id,
          searchText: report.searchText,
          language: report.language,
          timestamp: report.timestamp,
          filename: `audio_${index + 1}_${this.sanitizeFilename(report.searchText)}.wav`,
          audioData: report.audioData
        }))
      };
      
      // Calculate total size
      const totalSizeBytes = new TextEncoder().encode(JSON.stringify(exportData.audioFiles)).length;
      console.log(`📊 Total audio export size: ${this.formatBytes(totalSizeBytes)}`);
      
      return {
        success: true,
        exportData: exportData,
        totalFiles: exportData.audioFiles.length,
        totalSize: this.formatBytes(totalSizeBytes)
      };
      
    } catch (error) {
      console.error('Error exporting audio data:', error);
      return { success: false, error: error.message };
    }
  }

  // Download audio export as JSON file (for backup)
  async downloadAudioExport() {
    try {
      const exportResult = await this.exportAllAudioData();
      
      if (!exportResult.success) {
        return exportResult;
      }
      
      // Create downloadable JSON file
      const jsonData = JSON.stringify(exportResult.exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `youglish_audio_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Audio export downloaded: ${exportResult.totalFiles} files, ${exportResult.totalSize}`);
      
      return {
        success: true,
        message: `Exported ${exportResult.totalFiles} audio files (${exportResult.totalSize})`,
        totalFiles: exportResult.totalFiles
      };
      
    } catch (error) {
      console.error('Error downloading audio export:', error);
      return { success: false, error: error.message };
    }
  }

  // Download individual audio files
  async downloadIndividualAudioFiles() {
    try {
      const exportResult = await this.exportAllAudioData();
      
      if (!exportResult.success) {
        return exportResult;
      }
      
      const audioFiles = exportResult.exportData.audioFiles;
      let downloadedCount = 0;
      
      // Download each audio file individually with delay to avoid browser blocking
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        
        try {
          // Convert base64 to blob
          const base64Data = file.audioData.split(',')[1]; // Remove data:audio/wav;base64, prefix
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let j = 0; j < binaryData.length; j++) {
            bytes[j] = binaryData.charCodeAt(j);
          }
          
          const blob = new Blob([bytes], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = file.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          downloadedCount++;
          
          // Add small delay between downloads to prevent browser blocking
          if (i < audioFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (fileError) {
          console.error(`Error downloading audio file ${file.filename}:`, fileError);
        }
      }
      
      console.log(`✅ Downloaded ${downloadedCount}/${audioFiles.length} audio files`);
      
      return {
        success: true,
        message: `Downloaded ${downloadedCount}/${audioFiles.length} audio files`,
        downloadedCount: downloadedCount,
        totalFiles: audioFiles.length
      };
      
    } catch (error) {
      console.error('Error downloading individual audio files:', error);
      return { success: false, error: error.message };
    }
  }

  // Export and then remove audio data (complete workflow)
  async exportAndClearAudioData() {
    try {
      console.log('🔄 Starting export and clear workflow...');
      
      // First, export the audio data
      const exportResult = await this.downloadAudioExport();
      
      if (!exportResult.success) {
        return { success: false, error: 'Export failed: ' + exportResult.error };
      }
      
      console.log('✅ Export completed, now clearing audio data...');
      
      // Wait a moment for download to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then remove the audio data from storage
      const clearResult = await this.removeAllAudioData();
      
      if (!clearResult.success) {
        return { 
          success: false, 
          error: 'Clear failed: ' + clearResult.error,
          exportSuccess: true,
          exportedFiles: exportResult.totalFiles
        };
      }
      
      return {
        success: true,
        message: `Successfully exported ${exportResult.totalFiles} audio files and cleared ${clearResult.removedAudio} reports`,
        exportedFiles: exportResult.totalFiles,
        clearedReports: clearResult.removedAudio
      };
      
    } catch (error) {
      console.error('Error in export and clear workflow:', error);
      return { success: false, error: error.message };
    }
  }

  // Sanitize filename for download
  sanitizeFilename(text) {
    return text
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50) // Limit length
      .toLowerCase();
  }

  // Remove audio data from all reports (from both Chrome Storage and IndexedDB)
  async removeAllAudioData() {
    try {
      console.log('🗑️ Removing all audio data to free up storage space...');
      
      const reports = await this.getAIReports();
      let removedCount = 0;
      
      // Remove from Chrome Storage
      const reportsWithChromeAudio = reports.filter(r => r.audioData);
      if (reportsWithChromeAudio.length > 0) {
        console.log(`🗑️ Removing ${reportsWithChromeAudio.length} audio files from Chrome Storage`);
        reportsWithChromeAudio.forEach(report => {
          delete report.audioData;
          removedCount++;
        });
      }
      
      // Remove from IndexedDB
      if (this.indexedDBManager) {
        const reportsWithIndexedDBAudio = reports.filter(r => r.audioInIndexedDB && r.audioId);
        if (reportsWithIndexedDBAudio.length > 0) {
          console.log(`🗑️ Removing ${reportsWithIndexedDBAudio.length} audio files from IndexedDB`);
          for (const report of reportsWithIndexedDBAudio) {
            try {
              await this.indexedDBManager.deleteAudio(report.audioId);
              delete report.audioInIndexedDB;
              delete report.audioId;
              removedCount++;
            } catch (error) {
              console.error(`Failed to delete audio ${report.audioId}:`, error);
            }
          }
        }
      }
      
      if (removedCount === 0) {
        console.log('ℹ️ No audio data found to remove');
        return { success: true, removedAudio: 0 };
      }
      
      // Save updated reports
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.AI_REPORTS]: reports
      });
      
      console.log(`✅ Removed audio data from ${removedCount} reports`);
      
      // Update settings to disable audio saving by default
      const settings = await this.getUserSettings();
      await this.updateUserSettings({ ...settings, saveAudio: false });
      
      return { success: true, removedAudio: removedCount };
      
    } catch (error) {
      console.error('Error removing audio data:', error);
      return { success: false, error: error.message };
    }
  }

  // Check and migrate audio data to IndexedDB
  async checkAndMigrateToIndexedDB() {
    try {
      // Check migration status
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.MIGRATION_STATUS);
      const migrationStatus = result[this.STORAGE_KEYS.MIGRATION_STATUS];
      
      if (migrationStatus?.completed) {
        console.log('✅ Audio already migrated to IndexedDB');
        return;
      }
      
      console.log('🔄 Starting migration to IndexedDB...');
      
      // Get all reports with audio
      const reports = await this.getAIReports();
      const reportsWithAudio = reports.filter(r => r.audioData);
      
      if (reportsWithAudio.length === 0) {
        console.log('ℹ️ No audio data to migrate');
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.MIGRATION_STATUS]: { completed: true, date: Date.now() }
        });
        return;
      }
      
      console.log(`📦 Found ${reportsWithAudio.length} reports with audio to migrate`);
      
      // Migrate audio data
      const migrationResult = await this.indexedDBManager.migrateFromChromeStorage(reports);
      
      if (migrationResult.success) {
        // Save updated reports (without audio data in Chrome Storage)
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.AI_REPORTS]: migrationResult.updatedReports,
          [this.STORAGE_KEYS.MIGRATION_STATUS]: {
            completed: true,
            date: Date.now(),
            migratedCount: migrationResult.migratedCount,
            failedCount: migrationResult.failedCount
          }
        });
        
        console.log(`✅ Migration complete: ${migrationResult.migratedCount} audio files moved to IndexedDB`);
        
        // Check new storage usage
        const stats = await this.getStorageStats();
        console.log(`📊 Chrome Storage usage after migration: ${stats.usagePercentage}%`);
      }
      
    } catch (error) {
      console.error('Migration failed:', error);
      // Don't mark as completed so it can retry next time
    }
  }
  
  // Get report with audio from IndexedDB if needed
  async getReportWithAudio(report) {
    if (!report) return null;
    
    // If audio is in IndexedDB, fetch it
    if (report.audioInIndexedDB && report.audioId && this.indexedDBManager) {
      try {
        const audio = await this.indexedDBManager.getAudio(report.audioId);
        if (audio) {
          return {
            ...report,
            audioData: audio.audioUrl
          };
        }
      } catch (error) {
        console.error('Failed to fetch audio from IndexedDB:', error);
      }
    }
    
    // Return report as-is (with Chrome Storage audio if available)
    return report;
  }
  
  // Get storage stats including IndexedDB
  async getStorageStatsWithIndexedDB() {
    const chromeStats = await this.getStorageStats();
    
    if (this.indexedDBManager) {
      try {
        const indexedDBStats = await this.indexedDBManager.getStorageStats();
        const availability = await this.indexedDBManager.checkAvailability();
        
        return {
          ...chromeStats,
          indexedDB: {
            available: availability.available,
            audioCount: indexedDBStats.audioCount,
            totalSize: this.formatBytes(indexedDBStats.totalSize),
            availableSpace: availability.availableSpace || availability.availableGB || '檢查中...'
          }
        };
      } catch (error) {
        console.error('Failed to get IndexedDB stats:', error);
      }
    }
    
    return chromeStats;
  }

  // Clear all data (for testing or user request)
  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      
      // Also clear IndexedDB if available
      if (this.indexedDBManager) {
        await this.indexedDBManager.clearAllAudio();
      }
      
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