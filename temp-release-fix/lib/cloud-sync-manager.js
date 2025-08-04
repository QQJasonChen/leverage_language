// Cloud Sync Manager for Cross-Device Data Synchronization
// Handles syncing user data, reports, and settings across devices
// Works with Firebase and provides offline support

class CloudSyncManager {
  constructor() {
    this.authManager = null;
    this.storageManager = null;
    this.firebaseApp = null;
    this.firestore = null;
    this.isInitialized = false;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.offlineQueue = [];
    
    // Sync configuration
    this.config = {
      autoSyncInterval: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      retryDelay: 2000,
      batchSize: 10
    };

    this.init();
  }

  async init() {
    console.log('☁️ CloudSyncManager initializing...');
    
    // Wait for dependencies to be available
    await this.waitForDependencies();
    
    // Load last sync time
    await this.loadSyncState();
    
    // Setup auto-sync if user is authenticated
    if (this.authManager?.isUserAuthenticated()) {
      await this.setupAutoSync();
    }
    
    this.isInitialized = true;
    console.log('☁️ CloudSyncManager initialized');
  }

  async waitForDependencies() {
    // Wait for auth and storage managers to be available
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      if (window.authManager && window.storageManager) {
        this.authManager = window.authManager;
        this.storageManager = window.storageManager;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.authManager || !this.storageManager) {
      console.warn('⚠️ CloudSyncManager: Dependencies not available');
    }
  }

  // Load sync state from storage
  async loadSyncState() {
    try {
      const result = await chrome.storage.local.get(['lastSyncTime', 'offlineQueue']);
      this.lastSyncTime = result.lastSyncTime || null;
      this.offlineQueue = result.offlineQueue || [];
      
      console.log('☁️ Sync state loaded:', {
        lastSync: this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString() : 'never',
        queueSize: this.offlineQueue.length
      });
    } catch (error) {
      console.error('❌ Failed to load sync state:', error);
    }
  }

  // Save sync state to storage
  async saveSyncState() {
    try {
      await chrome.storage.local.set({
        lastSyncTime: this.lastSyncTime,
        offlineQueue: this.offlineQueue
      });
    } catch (error) {
      console.error('❌ Failed to save sync state:', error);
    }
  }

  // Initialize Firebase connection
  async initializeFirebase() {
    if (!this.authManager?.isUserAuthenticated()) {
      console.warn('⚠️ Cannot initialize Firebase: User not authenticated');
      return false;
    }

    try {
      // In a real implementation, you would initialize Firebase SDK here
      // For now, we'll simulate the connection
      console.log('🔥 Firebase connection established');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      return false;
    }
  }

  // Setup automatic sync
  async setupAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.authManager?.isUserAuthenticated() && !this.isSyncing) {
        await this.performIncrementalSync();
      }
    }, this.config.autoSyncInterval);

    console.log('⏰ Auto-sync enabled');
  }

  // Perform full sync (upload and download all data)
  async performFullSync() {
    if (!this.authManager?.isUserAuthenticated()) {
      throw new Error('User must be authenticated to sync');
    }

    if (this.isSyncing) {
      console.warn('⚠️ Sync already in progress');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting full sync...');

    try {
      // Initialize Firebase if needed
      await this.initializeFirebase();

      // Process offline queue first
      await this.processOfflineQueue();

      // Upload local data
      await this.uploadLocalData();

      // Download remote data
      await this.downloadRemoteData();

      // Update sync timestamp
      this.lastSyncTime = Date.now();
      await this.saveSyncState();

      console.log('✅ Full sync completed successfully');
      
      // Dispatch sync event
      this.dispatchSyncEvent('sync-complete', { type: 'full' });

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      this.dispatchSyncEvent('sync-error', { error: error.message });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Perform incremental sync (only changed data)
  async performIncrementalSync() {
    if (!this.authManager?.isUserAuthenticated()) {
      return;
    }

    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting incremental sync...');

    try {
      // Process offline queue
      await this.processOfflineQueue();

      // Sync only changed data since last sync
      const lastSync = this.lastSyncTime || 0;
      await this.syncChangedData(lastSync);

      this.lastSyncTime = Date.now();
      await this.saveSyncState();

      console.log('✅ Incremental sync completed');
      this.dispatchSyncEvent('sync-complete', { type: 'incremental' });

    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      // Don't throw error for incremental sync failures
    } finally {
      this.isSyncing = false;
    }
  }

  // Upload local data to cloud
  async uploadLocalData() {
    try {
      console.log('⬆️ Uploading local data...');

      // Get all local data
      const [reports, settings] = await Promise.all([
        this.storageManager.getAIReports(),
        this.storageManager.getUserSettings()
      ]);

      const userId = this.authManager.getCurrentUser()?.id;
      if (!userId) {
        throw new Error('User ID not available');
      }

      // Simulate cloud upload (in real implementation, use Firebase)
      const uploadData = {
        userId,
        reports: reports.map(report => ({
          ...report,
          lastModified: report.timestamp || Date.now()
        })),
        settings: {
          ...settings,
          lastModified: Date.now()
        },
        uploadedAt: Date.now()
      };

      // In real implementation:
      // await this.firestore.collection('users').doc(userId).set(uploadData, { merge: true });
      
      console.log('✅ Local data uploaded:', {
        reports: reports.length,
        settings: Object.keys(settings).length
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  // Download remote data from cloud
  async downloadRemoteData() {
    try {
      console.log('⬇️ Downloading remote data...');

      const userId = this.authManager.getCurrentUser()?.id;
      if (!userId) {
        throw new Error('User ID not available');
      }

      // Simulate cloud download (in real implementation, use Firebase)
      // const remoteData = await this.firestore.collection('users').doc(userId).get();
      
      // For now, simulate empty remote data
      const remoteData = {
        reports: [],
        settings: {},
        lastModified: Date.now()
      };

      // Merge remote data with local data
      await this.mergeRemoteData(remoteData);

      console.log('✅ Remote data downloaded and merged');

    } catch (error) {
      console.error('❌ Download failed:', error);
      throw error;
    }
  }

  // Merge remote data with local data
  async mergeRemoteData(remoteData) {
    try {
      // Get local data
      const [localReports, localSettings] = await Promise.all([
        this.storageManager.getAIReports(),
        this.storageManager.getUserSettings()
      ]);

      // Merge reports (prefer newer timestamp)
      const mergedReports = this.mergeReports(localReports, remoteData.reports || []);
      
      // Merge settings (prefer newer lastModified)
      const mergedSettings = this.mergeSettings(localSettings, remoteData.settings || {});

      // Save merged data
      await chrome.storage.local.set({
        aiReports: mergedReports,
        userSettings: mergedSettings
      });

      console.log('✅ Data merged successfully:', {
        reports: mergedReports.length,
        settings: Object.keys(mergedSettings).length
      });

    } catch (error) {
      console.error('❌ Data merge failed:', error);
      throw error;
    }
  }

  // Merge reports arrays, handling conflicts
  mergeReports(localReports, remoteReports) {
    const reportMap = new Map();

    // Add local reports
    localReports.forEach(report => {
      const key = `${report.searchText}_${report.language}`;
      reportMap.set(key, report);
    });

    // Merge remote reports (prefer newer)
    remoteReports.forEach(remoteReport => {
      const key = `${remoteReport.searchText}_${remoteReport.language}`;
      const localReport = reportMap.get(key);

      if (!localReport || (remoteReport.lastModified > (localReport.lastModified || localReport.timestamp))) {
        reportMap.set(key, remoteReport);
      }
    });

    return Array.from(reportMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  // Merge settings objects
  mergeSettings(localSettings, remoteSettings) {
    const localModified = localSettings.lastModified || 0;
    const remoteModified = remoteSettings.lastModified || 0;

    if (remoteModified > localModified) {
      return { ...localSettings, ...remoteSettings };
    }

    return localSettings;
  }

  // Sync only data changed since last sync
  async syncChangedData(since) {
    try {
      // Get reports modified since last sync
      const reports = await this.storageManager.getAIReports();
      const changedReports = reports.filter(report => 
        (report.timestamp || 0) > since || (report.lastModified || 0) > since
      );

      if (changedReports.length > 0) {
        console.log(`🔄 Syncing ${changedReports.length} changed reports`);
        // Upload changed reports
        await this.uploadChangedReports(changedReports);
      }

      // Check for remote changes
      await this.downloadChangedData(since);

    } catch (error) {
      console.error('❌ Changed data sync failed:', error);
      throw error;
    }
  }

  // Upload only changed reports
  async uploadChangedReports(reports) {
    const userId = this.authManager.getCurrentUser()?.id;
    if (!userId) return;

    // In real implementation, batch upload to Firebase
    console.log('⬆️ Uploading changed reports:', reports.length);
  }

  // Download data changed on remote since timestamp
  async downloadChangedData(since) {
    const userId = this.authManager.getCurrentUser()?.id;
    if (!userId) return;

    // In real implementation, query Firebase for changes since timestamp
    console.log('⬇️ Checking for remote changes since:', new Date(since).toLocaleString());
  }

  // Process offline queue
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log(`📤 Processing ${this.offlineQueue.length} offline operations...`);

    const processed = [];
    const failed = [];

    for (const operation of this.offlineQueue) {
      try {
        await this.executeOfflineOperation(operation);
        processed.push(operation);
      } catch (error) {
        console.error('❌ Offline operation failed:', operation, error);
        
        // Retry logic
        operation.retries = (operation.retries || 0) + 1;
        if (operation.retries < this.config.maxRetries) {
          failed.push(operation);
        }
      }
    }

    // Update offline queue
    this.offlineQueue = failed;
    await this.saveSyncState();

    console.log(`✅ Processed ${processed.length} offline operations, ${failed.length} failed`);
  }

  // Execute an offline operation
  async executeOfflineOperation(operation) {
    switch (operation.type) {
      case 'create_report':
        await this.uploadReport(operation.data);
        break;
      case 'update_report':
        await this.updateReport(operation.data);
        break;
      case 'delete_report':
        await this.deleteReport(operation.data.id);
        break;
      case 'update_settings':
        await this.uploadSettings(operation.data);
        break;
      default:
        console.warn('⚠️ Unknown offline operation type:', operation.type);
    }
  }

  // Add operation to offline queue
  async queueOfflineOperation(type, data) {
    this.offlineQueue.push({
      id: this.generateOperationId(),
      type,
      data,
      timestamp: Date.now(),
      retries: 0
    });

    await this.saveSyncState();
    console.log('📥 Queued offline operation:', type);
  }

  // Generate unique operation ID
  generateOperationId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Cloud operations (simulated)
  async uploadReport(report) {
    // Simulate cloud upload
    console.log('⬆️ Uploading report:', report.searchText);
  }

  async updateReport(report) {
    // Simulate cloud update
    console.log('🔄 Updating report:', report.searchText);
  }

  async deleteReport(reportId) {
    // Simulate cloud deletion
    console.log('🗑️ Deleting report:', reportId);
  }

  async uploadSettings(settings) {
    // Simulate settings upload
    console.log('⬆️ Uploading settings');
  }

  // Public API methods
  async enableSync() {
    if (!this.authManager?.isUserAuthenticated()) {
      throw new Error('User must be authenticated to enable sync');
    }

    await this.setupAutoSync();
    console.log('✅ Sync enabled');
  }

  async disableSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('⏹️ Sync disabled');
  }

  // Get sync status
  getSyncStatus() {
    return {
      isEnabled: !!this.syncInterval,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastSyncFormatted: this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString() : 'never',
      offlineQueueSize: this.offlineQueue.length,
      isAuthenticated: this.authManager?.isUserAuthenticated() || false
    };
  }

  // Force sync now
  async syncNow() {
    if (!this.authManager?.isUserAuthenticated()) {
      throw new Error('User must be authenticated to sync');
    }

    await this.performIncrementalSync();
  }

  // Clear sync data
  async clearSyncData() {
    this.lastSyncTime = null;
    this.offlineQueue = [];
    await this.saveSyncState();
    console.log('🧹 Sync data cleared');
  }

  // Dispatch sync events
  dispatchSyncEvent(eventType, data = {}) {
    const event = new CustomEvent(eventType, {
      detail: {
        ...data,
        timestamp: Date.now(),
        syncStatus: this.getSyncStatus()
      }
    });
    
    window.dispatchEvent(event);
  }

  // Handle user authentication changes
  async onAuthStateChanged(isAuthenticated) {
    if (isAuthenticated) {
      console.log('👤 User authenticated, enabling sync...');
      await this.enableSync();
      // Trigger initial sync after a short delay
      setTimeout(() => {
        this.performFullSync().catch(console.error);
      }, 1000);
    } else {
      console.log('👤 User signed out, disabling sync...');
      await this.disableSync();
      await this.clearSyncData();
    }
  }

  // Get sync statistics
  async getSyncStatistics() {
    const status = this.getSyncStatus();
    const settings = await this.storageManager.getUserSettings();
    const reports = await this.storageManager.getAIReports();

    return {
      ...status,
      totalReports: reports.length,
      totalSettings: Object.keys(settings).length,
      storageUsed: this.formatBytes(JSON.stringify({ reports, settings }).length),
      syncEnabled: settings.syncEnabled || false
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Global instance
window.cloudSyncManager = new CloudSyncManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudSyncManager;
}