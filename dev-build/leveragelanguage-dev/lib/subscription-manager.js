// Subscription Management System for LeverageLanguage
// Handles subscription tiers, usage tracking, and billing

class SubscriptionManager {
  constructor() {
    this.authManager = null;
    this.storageManager = null;
    this.isInitialized = false;
    
    // Subscription tiers configuration
    this.tiers = {
      free: {
        name: 'Free',
        price: 0,
        aiAnalysesPerMonth: 50,
        historyRetentionDays: 30,
        exportLimit: 10,
        cloudSync: false,
        advancedAnalytics: false,
        prioritySupport: false,
        features: [
          '50 AI analyses per month',
          '30 days history retention',
          'Basic export features',
          'Error detection & corrections',
          'Multi-language support'
        ]
      },
      pro: {
        name: 'Pro',
        price: 9.99,
        aiAnalysesPerMonth: -1, // unlimited
        historyRetentionDays: -1, // unlimited
        exportLimit: -1, // unlimited
        cloudSync: true,
        advancedAnalytics: true,
        prioritySupport: true,
        features: [
          'Unlimited AI analyses',
          'Unlimited history retention',
          'Advanced export options',
          'Cloud sync across devices',
          'Advanced analytics dashboard',
          'Learning progress insights',
          'Priority customer support',
          'Early access to new features'
        ]
      },
      enterprise: {
        name: 'Enterprise',
        price: 29.99,
        aiAnalysesPerMonth: -1,
        historyRetentionDays: -1,
        exportLimit: -1,
        cloudSync: true,
        advancedAnalytics: true,
        prioritySupport: true,
        classroomManagement: true,
        features: [
          'All Pro features',
          'Classroom management tools',
          'Student progress tracking',
          'Bulk user management',
          'Custom branding options',
          'API access',
          'Dedicated account manager',
          'Custom integrations'
        ]
      }
    };

    // Usage tracking
    this.usageTracking = {
      currentMonth: null,
      aiAnalysesUsed: 0,
      exportsUsed: 0,
      lastReset: null
    };

    this.init();
  }

  async init() {
    console.log('💳 SubscriptionManager initializing...');
    
    // Wait for dependencies
    await this.waitForDependencies();
    
    // Load usage data
    await this.loadUsageData();
    
    // Check if usage needs reset (new month)
    await this.checkUsageReset();
    
    this.isInitialized = true;
    console.log('💳 SubscriptionManager initialized');
  }

  async waitForDependencies() {
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
  }

  // Load usage data from storage
  async loadUsageData() {
    try {
      const result = await chrome.storage.local.get(['usageTracking']);
      
      if (result.usageTracking) {
        this.usageTracking = { ...this.usageTracking, ...result.usageTracking };
      } else {
        // Initialize usage tracking
        this.usageTracking.currentMonth = this.getCurrentMonth();
        this.usageTracking.lastReset = Date.now();
        await this.saveUsageData();
      }
      
      console.log('💳 Usage data loaded:', this.usageTracking);
    } catch (error) {
      console.error('❌ Failed to load usage data:', error);
    }
  }

  // Save usage data to storage
  async saveUsageData() {
    try {
      await chrome.storage.local.set({ usageTracking: this.usageTracking });
    } catch (error) {
      console.error('❌ Failed to save usage data:', error);
    }
  }

  // Check if usage should be reset for new month
  async checkUsageReset() {
    const currentMonth = this.getCurrentMonth();
    
    if (this.usageTracking.currentMonth !== currentMonth) {
      console.log('📅 New month detected, resetting usage counters');
      await this.resetMonthlyUsage();
    }
  }

  // Reset monthly usage counters
  async resetMonthlyUsage() {
    this.usageTracking = {
      currentMonth: this.getCurrentMonth(),
      aiAnalysesUsed: 0,
      exportsUsed: 0,
      lastReset: Date.now()
    };
    
    await this.saveUsageData();
    console.log('🔄 Monthly usage reset');
  }

  // Get current subscription info
  getSubscriptionInfo() {
    if (!this.authManager?.isUserAuthenticated()) {
      return null;
    }

    const user = this.authManager.getCurrentUser();
    return user?.subscription || {
      tier: 'free',
      status: 'active',
      expiresAt: null
    };
  }

  // Get subscription tier configuration
  getTierConfig(tierName = null) {
    if (!tierName) {
      const subscription = this.getSubscriptionInfo();
      tierName = subscription?.tier || 'free';
    }
    
    return this.tiers[tierName] || this.tiers.free;
  }

  // Check if user can perform an action based on limits
  async canPerformAction(action) {
    if (!this.authManager?.isUserAuthenticated()) {
      return { allowed: false, reason: 'Authentication required' };
    }

    const tierConfig = this.getTierConfig();
    const subscription = this.getSubscriptionInfo();

    // Check subscription status
    if (subscription.status !== 'active') {
      return { allowed: false, reason: 'Subscription not active' };
    }

    // Check expiration
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      return { allowed: false, reason: 'Subscription expired' };
    }

    switch (action) {
      case 'ai_analysis':
        if (tierConfig.aiAnalysesPerMonth === -1) {
          return { allowed: true, reason: 'Unlimited' };
        }
        
        if (this.usageTracking.aiAnalysesUsed >= tierConfig.aiAnalysesPerMonth) {
          return { 
            allowed: false, 
            reason: `Monthly limit of ${tierConfig.aiAnalysesPerMonth} AI analyses reached`,
            upgradeRequired: true
          };
        }
        
        return { 
          allowed: true, 
          remaining: tierConfig.aiAnalysesPerMonth - this.usageTracking.aiAnalysesUsed 
        };

      case 'export':
        if (tierConfig.exportLimit === -1) {
          return { allowed: true, reason: 'Unlimited' };
        }
        
        if (this.usageTracking.exportsUsed >= tierConfig.exportLimit) {
          return { 
            allowed: false, 
            reason: `Monthly limit of ${tierConfig.exportLimit} exports reached`,
            upgradeRequired: true
          };
        }
        
        return { 
          allowed: true, 
          remaining: tierConfig.exportLimit - this.usageTracking.exportsUsed 
        };

      case 'cloud_sync':
        if (!tierConfig.cloudSync) {
          return { 
            allowed: false, 
            reason: 'Cloud sync not available in current plan',
            upgradeRequired: true
          };
        }
        return { allowed: true };

      case 'advanced_analytics':
        if (!tierConfig.advancedAnalytics) {
          return { 
            allowed: false, 
            reason: 'Advanced analytics not available in current plan',
            upgradeRequired: true
          };
        }
        return { allowed: true };

      default:
        return { allowed: true };
    }
  }

  // Record usage for an action
  async recordUsage(action, count = 1) {
    await this.checkUsageReset(); // Ensure we're in the current month
    
    switch (action) {
      case 'ai_analysis':
        this.usageTracking.aiAnalysesUsed += count;
        break;
      case 'export':
        this.usageTracking.exportsUsed += count;
        break;
    }
    
    await this.saveUsageData();
    console.log(`📊 Usage recorded: ${action} +${count}`, this.usageTracking);
  }

  // Get usage statistics
  getUsageStats() {
    const tierConfig = this.getTierConfig();
    
    return {
      aiAnalyses: {
        used: this.usageTracking.aiAnalysesUsed,
        limit: tierConfig.aiAnalysesPerMonth,
        remaining: tierConfig.aiAnalysesPerMonth === -1 ? 
          'unlimited' : 
          Math.max(0, tierConfig.aiAnalysesPerMonth - this.usageTracking.aiAnalysesUsed),
        percentage: tierConfig.aiAnalysesPerMonth === -1 ? 
          0 : 
          Math.min(100, (this.usageTracking.aiAnalysesUsed / tierConfig.aiAnalysesPerMonth) * 100)
      },
      exports: {
        used: this.usageTracking.exportsUsed,
        limit: tierConfig.exportLimit,
        remaining: tierConfig.exportLimit === -1 ? 
          'unlimited' : 
          Math.max(0, tierConfig.exportLimit - this.usageTracking.exportsUsed),
        percentage: tierConfig.exportLimit === -1 ? 
          0 : 
          Math.min(100, (this.usageTracking.exportsUsed / tierConfig.exportLimit) * 100)
      },
      currentMonth: this.usageTracking.currentMonth,
      resetDate: this.getNextResetDate()
    };
  }

  // Simulate subscription upgrade
  async upgradeSubscription(newTier) {
    if (!this.authManager?.isUserAuthenticated()) {
      throw new Error('User must be authenticated to upgrade subscription');
    }

    if (!this.tiers[newTier]) {
      throw new Error('Invalid subscription tier');
    }

    const user = this.authManager.getCurrentUser();
    
    // Simulate payment processing
    console.log(`💳 Processing upgrade to ${newTier}...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update user subscription
    user.subscription = {
      tier: newTier,
      status: 'active',
      expiresAt: this.calculateExpirationDate(newTier),
      upgradeDate: new Date().toISOString(),
      paymentMethod: 'simulated'
    };

    // Save updated user data
    await this.authManager.saveAuthState();
    
    console.log('✅ Subscription upgraded successfully');
    return {
      success: true,
      newTier,
      features: this.tiers[newTier].features
    };
  }

  // Simulate subscription cancellation
  async cancelSubscription() {
    if (!this.authManager?.isUserAuthenticated()) {
      throw new Error('User must be authenticated');
    }

    const user = this.authManager.getCurrentUser();
    const currentSubscription = user.subscription;

    if (currentSubscription.tier === 'free') {
      throw new Error('Cannot cancel free subscription');
    }

    // Set subscription to expire at the end of current billing period
    user.subscription.status = 'cancelled';
    user.subscription.cancelledAt = new Date().toISOString();
    
    // Keep access until expiration date
    await this.authManager.saveAuthState();
    
    console.log('📋 Subscription cancelled');
    return {
      success: true,
      accessUntil: currentSubscription.expiresAt
    };
  }

  // Get subscription comparison data
  getSubscriptionComparison() {
    return {
      tiers: this.tiers,
      currentTier: this.getSubscriptionInfo()?.tier || 'free',
      usageStats: this.getUsageStats()
    };
  }

  // Check if upgrade is recommended based on usage
  shouldRecommendUpgrade() {
    const stats = this.getUsageStats();
    const currentTier = this.getSubscriptionInfo()?.tier || 'free';
    
    if (currentTier === 'enterprise') {
      return null; // Already on highest tier
    }

    const recommendations = [];

    // Check AI analysis usage
    if (stats.aiAnalyses.percentage > 80) {
      recommendations.push({
        reason: 'High AI analysis usage',
        message: `You've used ${stats.aiAnalyses.percentage.toFixed(0)}% of your monthly AI analyses`,
        suggestedTier: currentTier === 'free' ? 'pro' : 'enterprise'
      });
    }

    // Check export usage
    if (stats.exports.percentage > 80) {
      recommendations.push({
        reason: 'High export usage',
        message: `You've used ${stats.exports.percentage.toFixed(0)}% of your monthly exports`,
        suggestedTier: currentTier === 'free' ? 'pro' : 'enterprise'
      });
    }

    return recommendations.length > 0 ? recommendations[0] : null;
  }

  // Helper methods
  getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  calculateExpirationDate(tier) {
    const now = new Date();
    now.setMonth(now.getMonth() + 1); // 1 month from now
    return now.toISOString();
  }

  getNextResetDate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
  }

  // Format price for display
  formatPrice(price) {
    return price === 0 ? 'Free' : `$${price.toFixed(2)}/month`;
  }

  // Get billing history (simulated)
  getBillingHistory() {
    const subscription = this.getSubscriptionInfo();
    
    if (!subscription || subscription.tier === 'free') {
      return [];
    }

    // Simulate billing history
    return [
      {
        id: 'inv_001',
        date: subscription.upgradeDate || new Date().toISOString(),
        amount: this.tiers[subscription.tier].price,
        status: 'paid',
        description: `${this.tiers[subscription.tier].name} Plan - Monthly`
      }
    ];
  }

  // Handle subscription events
  onSubscriptionChange(callback) {
    // In a real implementation, this would listen for webhook events
    // For now, we'll simulate with a custom event
    window.addEventListener('subscription-change', callback);
  }

  // Dispatch subscription events
  dispatchSubscriptionEvent(eventType, data = {}) {
    const event = new CustomEvent('subscription-change', {
      detail: {
        type: eventType,
        ...data,
        timestamp: Date.now(),
        subscription: this.getSubscriptionInfo()
      }
    });
    
    window.dispatchEvent(event);
  }

  // Get feature availability
  getFeatureAvailability() {
    const tierConfig = this.getTierConfig();
    const usageStats = this.getUsageStats();
    
    return {
      aiAnalysis: {
        available: usageStats.aiAnalyses.remaining !== 0,
        limit: tierConfig.aiAnalysesPerMonth,
        used: usageStats.aiAnalyses.used,
        remaining: usageStats.aiAnalyses.remaining
      },
      export: {
        available: usageStats.exports.remaining !== 0,
        limit: tierConfig.exportLimit,
        used: usageStats.exports.used,
        remaining: usageStats.exports.remaining
      },
      cloudSync: {
        available: tierConfig.cloudSync
      },
      advancedAnalytics: {
        available: tierConfig.advancedAnalytics
      },
      prioritySupport: {
        available: tierConfig.prioritySupport
      }
    };
  }
}

// Global instance
window.subscriptionManager = new SubscriptionManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubscriptionManager;
}