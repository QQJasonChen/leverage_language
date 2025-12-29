// Sidepanel Storage Management Module

class SidepanelStorageManager {
  constructor() {
    this.storageManager = null;
    this.initializeStorageManager();
  }

  async initializeStorageManager() {
    // Wait for storage manager to be available
    const checkInterval = setInterval(() => {
      if (typeof StorageManager !== 'undefined') {
        this.storageManager = new StorageManager();
        clearInterval(checkInterval);
        this.logSafely('✅ Storage manager initialized');
      }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => clearInterval(checkInterval), 5000);
  }

  logSafely(...args) {
    if (typeof window.SidepanelCore?.logSafely === 'function') {
      window.SidepanelCore.logSafely(...args);
    } else {
      console.log(...args);
    }
  }

  // Storage diagnostic function
  async checkStorageUsage() {
    try {
      if (this.storageManager && typeof this.storageManager.getStorageStats === 'function') {
        const stats = await this.storageManager.getStorageStats();
        this.logSafely('💾 Current Storage Usage:', stats);
        
        if (stats.isNearLimit) {
          this.logSafely('⚠️ Storage is near limit! Consider cleanup.');
          return stats;
        }
        return stats;
      }
    } catch (error) {
      console.error('Failed to check storage usage:', error);
    }
    return null;
  }

  // Emergency storage cleanup function (removes all audio data)
  async fixStorageIssue() {
    try {
      this.logSafely('🚨 Running emergency storage cleanup...');
      
      if (this.storageManager && typeof this.storageManager.removeAllAudioData === 'function') {
        const result = await this.storageManager.removeAllAudioData();
        
        if (result.success) {
          this.logSafely(`✅ Emergency cleanup completed!`);
          this.logSafely(`🗑️ Removed audio data from ${result.removedAudio} reports`);
          this.logSafely(`💾 Audio saving has been disabled to prevent future issues`);
          
          // Check storage usage after cleanup
          const newStats = await this.checkStorageUsage();
          if (newStats) {
            this.logSafely(`📊 New storage usage: ${newStats.usagePercentage}%`);
          }
          
          return result;
        } else {
          console.error('❌ Emergency cleanup failed:', result.error);
        }
      }
    } catch (error) {
      console.error('❌ Emergency cleanup error:', error);
    }
    return null;
  }

  // Export all audio data as backup before clearing (recommended workflow)
  async exportAndClearAudio() {
    try {
      this.logSafely('📦 Starting export and clear audio workflow...');
      
      if (this.storageManager && typeof this.storageManager.exportAndClearAudioData === 'function') {
        const result = await this.storageManager.exportAndClearAudioData();
        
        if (result.success) {
          this.logSafely(`✅ Export and clear completed!`);
          this.logSafely(`📦 Exported ${result.exportedFiles} audio files`);
          this.logSafely(`🗑️ Cleared audio data from ${result.clearedReports} reports`);
          
          // Show user notification
          if (typeof showNotification === 'function') {
            showNotification(`Audio export completed: ${result.exportedFiles} files saved, ${result.clearedReports} reports cleaned`, 'success');
          }
          
          // Check storage usage after cleanup
          const newStats = await this.checkStorageUsage();
          if (newStats) {
            this.logSafely(`📊 New storage usage: ${newStats.usagePercentage}%`);
          }
          
          return result;
        } else {
          console.error('❌ Export and clear failed:', result.error);
        }
      }
    } catch (error) {
      console.error('❌ Export and clear error:', error);
    }
    return null;
  }

  // Export audio data only (without clearing)
  async exportAudioOnly() {
    try {
      this.logSafely('📦 Exporting audio data only...');
      
      if (this.storageManager && typeof this.storageManager.downloadAudioExport === 'function') {
        const result = await this.storageManager.downloadAudioExport();
        
        if (result.success) {
          this.logSafely(`✅ Audio export completed!`);
          this.logSafely(`📦 Exported ${result.totalFiles} audio files as JSON backup`);
          
          // Show user notification
          if (typeof showNotification === 'function') {
            showNotification(`Audio export completed: ${result.totalFiles} files saved as backup`, 'success');
          }
          
          return result;
        } else {
          console.error('❌ Audio export failed:', result.error);
        }
      }
    } catch (error) {
      console.error('❌ Audio export error:', error);
    }
    return null;
  }

  // Download individual audio files as .wav files
  async downloadAudioFiles() {
    try {
      this.logSafely('🎵 Downloading individual audio files...');
      
      if (this.storageManager && typeof this.storageManager.downloadIndividualAudioFiles === 'function') {
        const result = await this.storageManager.downloadIndividualAudioFiles();
        
        if (result.success) {
          this.logSafely(`✅ Audio download completed!`);
          this.logSafely(`🎵 Downloaded ${result.downloadedCount}/${result.totalFiles} individual audio files`);
          
          // Show user notification
          if (typeof showNotification === 'function') {
            showNotification(`Audio download completed: ${result.downloadedCount}/${result.totalFiles} files`, 'success');
          }
          
          return result;
        } else {
          console.error('❌ Audio download failed:', result.error);
        }
      }
    } catch (error) {
      console.error('❌ Audio download error:', error);
    }
    return null;
  }

  // Check how much audio data you have
  async checkAudioData() {
    try {
      this.logSafely('📊 Checking audio data...');
      
      if (this.storageManager && typeof this.storageManager.exportAllAudioData === 'function') {
        const result = await this.storageManager.exportAllAudioData();
        
        if (result.success) {
          this.logSafely(`📊 Audio data summary:`);
          this.logSafely(`🎵 Total audio files: ${result.totalFiles}`);
          this.logSafely(`💾 Total size: ${result.totalSize}`);
          
          return result;
        } else {
          this.logSafely('ℹ️ No audio data found');
        }
      }
    } catch (error) {
      console.error('❌ Audio check error:', error);
    }
    return null;
  }

  // Update storage display in UI
  async updateStorageDisplay() {
    try {
      const stats = await this.checkStorageUsage();
      if (stats) {
        // Update UI elements if they exist
        const storageInfo = document.getElementById('storage-info');
        if (storageInfo) {
          storageInfo.textContent = `Storage: ${stats.usagePercentage}% used (${stats.usedSpace} / ${stats.totalSpace})`;
          
          // Add warning class if near limit
          if (stats.isNearLimit) {
            storageInfo.classList.add('storage-warning');
          } else {
            storageInfo.classList.remove('storage-warning');
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to update storage display:', error);
    }
  }

  // Get storage statistics
  async getStorageStats() {
    return await this.checkStorageUsage();
  }

  // Clear all data with confirmation
  async clearAllDataWithConfirmation() {
    const confirmed = confirm('⚠️ This will permanently delete all learning data, audio files, and history. Are you sure?');
    if (confirmed) {
      const doubleConfirmed = confirm('🚨 Last chance! This action cannot be undone. All your learning progress will be lost. Continue?');
      if (doubleConfirmed) {
        return await this.fixStorageIssue();
      }
    }
    return null;
  }
}

// Create global storage manager instance
const sidepanelStorage = new SidepanelStorageManager();

// Export legacy function names for backward compatibility
window.checkStorageUsage = () => sidepanelStorage.checkStorageUsage();
window.fixStorageIssue = () => sidepanelStorage.fixStorageIssue();
window.exportAndClearAudio = () => sidepanelStorage.exportAndClearAudio();
window.exportAudioOnly = () => sidepanelStorage.exportAudioOnly();
window.downloadAudioFiles = () => sidepanelStorage.downloadAudioFiles();
window.checkAudioData = () => sidepanelStorage.checkAudioData();
window.updateStorageDisplay = () => sidepanelStorage.updateStorageDisplay();

// Export for use by other modules
window.SidepanelStorage = sidepanelStorage;