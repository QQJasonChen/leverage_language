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
        existingReport.timestamp = Date.now();
        existingReport.analysisData = analysisData;
        if (audioData) {
          existingReport.audioData = audioData;
        }
        existingReport.tags = this.extractTags(normalizedText, analysisData);
        
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
        // Create new report with normalized data
        const newReport = {
          id: this.generateId(),
          searchText: normalizedText,
          language: normalizedLanguage,
          timestamp: Date.now(),
          analysisData,
          audioData,
          tags: this.extractTags(normalizedText, analysisData),
          favorite: false
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

  // Utility functions
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  extractTags(searchText, analysisData) {
    const tags = [searchText.toLowerCase()];
    
    // Extract keywords from AI analysis
    if (analysisData && typeof analysisData === 'string') {
      const words = analysisData.toLowerCase().match(/\b\w{3,}\b/g) || [];
      const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'run', 'too', 'any', 'ask', 'big', 'box', 'eat', 'end', 'far', 'fun', 'let', 'own', 'put', 'say', 'she', 'try', 'use', 'way', 'win', 'yes'];
      
      words.forEach(word => {
        if (word.length > 3 && !commonWords.includes(word) && !tags.includes(word)) {
          tags.push(word);
        }
      });
    }

    return tags.slice(0, 10); // Limit tags
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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