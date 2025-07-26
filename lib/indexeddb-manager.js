// IndexedDB Manager for YouGlish Extension
// Handles large data storage (audio files, videos) with unlimited capacity

class IndexedDBManager {
  constructor() {
    this.dbName = 'YouGlishExtensionDB';
    this.dbVersion = 1;
    this.db = null;
    
    // Object store names
    this.stores = {
      AUDIO: 'audioFiles',
      REPORTS: 'largeReports',
      CACHE: 'mediaCache',
      SETTINGS: 'userSettings'
    };
    
    // Initialize on creation
    this.initPromise = this.initialize();
  }
  
  // Initialize IndexedDB
  async initialize() {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onerror = () => {
          console.error('IndexedDB initialization failed:', request.error);
          reject(request.error);
        };
        
        request.onsuccess = () => {
          this.db = request.result;
          console.log('✅ IndexedDB initialized successfully');
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains(this.stores.AUDIO)) {
            const audioStore = db.createObjectStore(this.stores.AUDIO, { keyPath: 'id' });
            audioStore.createIndex('reportId', 'reportId', { unique: false });
            audioStore.createIndex('timestamp', 'timestamp', { unique: false });
            audioStore.createIndex('language', 'language', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(this.stores.REPORTS)) {
            const reportsStore = db.createObjectStore(this.stores.REPORTS, { keyPath: 'id' });
            reportsStore.createIndex('timestamp', 'timestamp', { unique: false });
            reportsStore.createIndex('language', 'language', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(this.stores.CACHE)) {
            const cacheStore = db.createObjectStore(this.stores.CACHE, { keyPath: 'key' });
            cacheStore.createIndex('expires', 'expires', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(this.stores.SETTINGS)) {
            db.createObjectStore(this.stores.SETTINGS, { keyPath: 'key' });
          }
          
          console.log('✅ IndexedDB object stores created');
        };
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }
  
  // Ensure database is ready
  async ensureReady() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }
  
  // Save audio data
  async saveAudio(audioData) {
    try {
      await this.ensureReady();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readwrite');
        const store = transaction.objectStore(this.stores.AUDIO);
        
        const audioRecord = {
          id: audioData.id || this.generateId(),
          reportId: audioData.reportId,
          audioUrl: audioData.audioUrl,
          text: audioData.text,
          language: audioData.language,
          timestamp: audioData.timestamp || Date.now(),
          size: audioData.size || this.calculateSize(audioData.audioUrl)
        };
        
        const request = store.put(audioRecord);
        
        request.onsuccess = () => {
          console.log('✅ Audio saved to IndexedDB:', audioRecord.id);
          resolve(audioRecord);
        };
        
        request.onerror = () => {
          console.error('Failed to save audio:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error saving audio:', error);
      throw error;
    }
  }
  
  // Get audio by ID
  async getAudio(audioId) {
    try {
      await this.ensureReady();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readonly');
        const store = transaction.objectStore(this.stores.AUDIO);
        const request = store.get(audioId);
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting audio:', error);
      throw error;
    }
  }
  
  // Get all audio for a report
  async getAudioByReportId(reportId) {
    try {
      await this.ensureReady();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readonly');
        const store = transaction.objectStore(this.stores.AUDIO);
        const index = store.index('reportId');
        const request = index.getAll(reportId);
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting audio by report ID:', error);
      throw error;
    }
  }
  
  // Delete audio
  async deleteAudio(audioId) {
    try {
      await this.ensureReady();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readwrite');
        const store = transaction.objectStore(this.stores.AUDIO);
        const request = store.delete(audioId);
        
        request.onsuccess = () => {
          console.log('✅ Audio deleted from IndexedDB:', audioId);
          resolve(true);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error deleting audio:', error);
      throw error;
    }
  }
  
  // Get storage statistics
  async getStorageStats() {
    try {
      await this.ensureReady();
      
      const stats = {
        audioCount: 0,
        totalSize: 0,
        reportCount: 0,
        oldestItem: null,
        newestItem: null
      };
      
      // Count audio files
      const audioCount = await this.countRecords(this.stores.AUDIO);
      stats.audioCount = audioCount;
      
      // Get all audio to calculate size
      const allAudio = await this.getAllAudio();
      stats.totalSize = allAudio.reduce((sum, audio) => sum + (audio.size || 0), 0);
      
      // Find oldest and newest
      if (allAudio.length > 0) {
        const sorted = allAudio.sort((a, b) => a.timestamp - b.timestamp);
        stats.oldestItem = new Date(sorted[0].timestamp);
        stats.newestItem = new Date(sorted[sorted.length - 1].timestamp);
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }
  
  // Get all audio files
  async getAllAudio() {
    try {
      await this.ensureReady();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readonly');
        const store = transaction.objectStore(this.stores.AUDIO);
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting all audio:', error);
      throw error;
    }
  }
  
  // Clear all audio data
  async clearAllAudio() {
    try {
      await this.ensureReady();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readwrite');
        const store = transaction.objectStore(this.stores.AUDIO);
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log('✅ All audio cleared from IndexedDB');
          resolve(true);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error clearing audio:', error);
      throw error;
    }
  }
  
  // Clean up old audio (older than days specified)
  async cleanupOldAudio(daysToKeep = 30) {
    try {
      await this.ensureReady();
      
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.stores.AUDIO], 'readwrite');
        const store = transaction.objectStore(this.stores.AUDIO);
        const index = store.index('timestamp');
        
        const range = IDBKeyRange.upperBound(cutoffTime);
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`✅ Cleaned up ${deletedCount} old audio files`);
            resolve(deletedCount);
          }
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error cleaning up old audio:', error);
      throw error;
    }
  }
  
  // Migrate audio from Chrome Storage to IndexedDB
  async migrateFromChromeStorage(reports) {
    try {
      let migratedCount = 0;
      let failedCount = 0;
      
      console.log(`🔄 Starting migration of ${reports.length} reports...`);
      
      for (const report of reports) {
        if (report.audioData) {
          try {
            // Save audio to IndexedDB
            await this.saveAudio({
              id: `audio_${report.id}`,
              reportId: report.id,
              audioUrl: report.audioData,
              text: report.searchText,
              language: report.language,
              timestamp: report.timestamp
            });
            
            migratedCount++;
            
            // Mark report as having audio in IndexedDB
            report.audioInIndexedDB = true;
            delete report.audioData; // Remove from Chrome Storage
            
          } catch (error) {
            console.error(`Failed to migrate audio for report ${report.id}:`, error);
            failedCount++;
          }
        }
      }
      
      console.log(`✅ Migration complete: ${migratedCount} succeeded, ${failedCount} failed`);
      
      return {
        success: true,
        migratedCount,
        failedCount,
        updatedReports: reports
      };
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
  
  // Utility functions
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  calculateSize(dataUrl) {
    if (!dataUrl) return 0;
    // Rough estimate: base64 is ~1.33x original size
    return Math.floor(dataUrl.length * 0.75);
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  async countRecords(storeName) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
  
  // Check if IndexedDB is available and has enough space
  async checkAvailability() {
    try {
      if (!('indexedDB' in window)) {
        return { available: false, reason: 'IndexedDB not supported' };
      }
      
      // Check storage quota
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const availableGB = ((estimate.quota - estimate.usage) / 1024 / 1024 / 1024).toFixed(2);
        
        return {
          available: true,
          quota: this.formatBytes(estimate.quota),
          usage: this.formatBytes(estimate.usage),
          available: this.formatBytes(estimate.quota - estimate.usage),
          availableGB: `${availableGB} GB`
        };
      }
      
      return { available: true, reason: 'Storage quota API not available' };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }
}

// Create singleton instance
window.indexedDBManager = new IndexedDBManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IndexedDBManager;
}