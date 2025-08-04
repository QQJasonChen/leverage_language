// Production-safe logging
const log = (...args) => {
  if (typeof PerformanceUtils !== "undefined") {
    PerformanceUtils.log(...args);
  } else if (!chrome.runtime.getManifest().name.includes("Dev")) {
    return;
  } else {
    console.log(...args);
  }
};
// Trial API Manager for Alpha Testers
// Provides limited free API usage using developer's keys

class TrialAPIManager {
  constructor() {
    this.isInitialized = false;
    this.trialConfig = {
      enabled: true, // Enable trial mode for alpha version
      maxUsage: 20, // Maximum 20 API calls per user per day
      resetPeriod: 24 * 60 * 60 * 1000, // Reset every 24 hours (daily)
      // Developer's API keys for trial usage (encrypted/obfuscated)
      trialKeys: {
        gemini: this.getTrialGeminiKey(),
        openai: this.getTrialOpenAIKey()
      }
    };
  }

  // Initialize trial system
  async initialize() {
    try {
      const result = await chrome.storage.local.get([
        'trialUsage', 
        'trialStartDate',
        'trialUserId'
      ]);

      // Generate unique user ID for trial tracking
      if (!result.trialUserId) {
        const userId = this.generateUserId();
        await chrome.storage.local.set({ trialUserId: userId });
      }

      // Initialize trial usage if first time
      if (!result.trialUsage || !result.trialStartDate) {
        await this.resetTrialUsage();
      }

      // Check if trial period has expired and reset if needed
      const daysSinceStart = (Date.now() - result.trialStartDate) / (24 * 60 * 60 * 1000);
      if (daysSinceStart >= 7) {
        await this.resetTrialUsage();
      }

      this.isInitialized = true;
      log('🆓 Trial API Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Trial API Manager:', error);
      return false;
    }
  }

  // Get trial API key (obfuscated for basic security)
  getTrialGeminiKey() {
    // Obfuscated alpha testing Gemini API key
    const parts = [
      'AIzaSyDOhlaPCBnZ3X2L',
      'IQAC-UHdTeUQ',
      'lDUpQ7Y'
    ];
    return parts.join('');
  }

  getTrialOpenAIKey() {
    // Obfuscated alpha testing OpenAI API key (limited usage)
    const prefix = 'sk-';
    const middle = [
      'kwOihIfNYx8RzEbN',
      'rA8hNH9GIBBHyR4',
      '-ET1_FyNa4T3Blb',
      'kFJTj8UQXd-sna1',
      'Ndvwd9yClAhJjk-',
      '_3Z90qtqt80lOoA'
    ];
    return prefix + middle.join('');
  }

  // Generate unique user ID for trial tracking
  generateUserId() {
    return 'trial_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Reset trial usage (called weekly or on first use)
  async resetTrialUsage() {
    await chrome.storage.local.set({
      trialUsage: 0,
      trialStartDate: Date.now()
    });
    log('🔄 Trial usage reset - 20 free API calls available');
  }

  // Check if trial usage is available
  async canUseTrial() {
    if (!this.trialConfig.enabled) return false;

    const result = await chrome.storage.local.get(['trialUsage']);
    const currentUsage = result.trialUsage || 0;
    
    return currentUsage < this.trialConfig.maxUsage;
  }

  // Get remaining trial usage
  async getRemainingUsage() {
    const result = await chrome.storage.local.get(['trialUsage']);
    const currentUsage = result.trialUsage || 0;
    return Math.max(0, this.trialConfig.maxUsage - currentUsage);
  }

  // Increment trial usage
  async incrementUsage() {
    const result = await chrome.storage.local.get(['trialUsage']);
    const currentUsage = result.trialUsage || 0;
    await chrome.storage.local.set({ trialUsage: currentUsage + 1 });
    
    const remaining = this.trialConfig.maxUsage - (currentUsage + 1);
    log(`🆓 Trial API used. Remaining: ${remaining}/${this.trialConfig.maxUsage}`);
    
    return remaining;
  }

  // Get trial statistics
  async getTrialStats() {
    const result = await chrome.storage.local.get([
      'trialUsage', 
      'trialStartDate'
    ]);

    const usage = result.trialUsage || 0;
    const startDate = result.trialStartDate || Date.now();
    const daysRemaining = Math.max(0, 7 - Math.floor((Date.now() - startDate) / (24 * 60 * 60 * 1000)));

    return {
      used: usage,
      remaining: this.trialConfig.maxUsage - usage,
      total: this.trialConfig.maxUsage,
      daysRemaining: daysRemaining,
      resetDate: new Date(startDate + (7 * 24 * 60 * 60 * 1000))
    };
  }

  // Check if user should be encouraged to get own API key
  async shouldShowAPIKeyReminder() {
    const remaining = await this.getRemainingUsage();
    // Show reminder when 5 or fewer uses remaining
    return remaining <= 5 && remaining > 0;
  }

  // Get trial API key for specific provider
  getTrialAPIKey(provider) {
    if (!this.trialConfig.enabled) return null;
    
    switch (provider) {
      case 'gemini':
        return this.trialConfig.trialKeys.gemini;
      case 'openai':
        return this.trialConfig.trialKeys.openai;
      default:
        return null;
    }
  }

  // Format trial status message for UI
  async getTrialStatusMessage() {
    const stats = await this.getTrialStats();
    
    if (stats.remaining <= 0) {
      return {
        type: 'warning',
        title: '🚫 Trial Limit Reached',
        message: `You've used all ${stats.total} free AI analyses. Trial resets in ${stats.daysRemaining} days or you can add your own API key in settings.`,
        action: 'Get API Key'
      };
    } else if (stats.remaining <= 5) {
      return {
        type: 'info',
        title: '⚠️ Trial Almost Finished',
        message: `${stats.remaining} free AI analyses remaining. Consider getting your own API key for unlimited usage.`,
        action: 'Get API Key'
      };
    } else {
      return {
        type: 'success',
        title: '🆓 Free Trial Active',
        message: `${stats.remaining}/${stats.total} free AI analyses remaining. Resets in ${stats.daysRemaining} days.`,
        action: null
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrialAPIManager;
} else {
  window.TrialAPIManager = TrialAPIManager;
}