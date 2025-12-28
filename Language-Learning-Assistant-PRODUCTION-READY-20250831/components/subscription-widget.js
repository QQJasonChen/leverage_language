// Subscription Widget Component
// Handles UI for subscription status, usage, and upgrades

class SubscriptionWidget {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.subscriptionManager = null;
    this.authManager = null;
    this.isInitialized = false;
    
    // UI state
    this.currentView = 'status'; // status, plans, processing
    this.isLoading = false;
    
    this.init();
  }

  async init() {
    console.log('🎯 SubscriptionWidget initializing...');
    
    // Wait for dependencies
    await this.waitForDependencies();
    
    // Initial render
    await this.render();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    console.log('🎯 SubscriptionWidget initialized');
  }

  async waitForDependencies() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      if (window.subscriptionManager && window.authManager) {
        this.subscriptionManager = window.subscriptionManager;
        this.authManager = window.authManager;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.subscriptionManager || !this.authManager) {
      console.error('❌ SubscriptionWidget: Dependencies not found');
    }
  }

  async render() {
    if (!this.container) {
      console.error('❌ SubscriptionWidget: Container not found');
      return;
    }

    try {
      this.container.innerHTML = this.getWidgetHTML();
      this.attachEventListeners();
    } catch (error) {
      console.error('❌ SubscriptionWidget render error:', error);
      this.container.innerHTML = `
        <div class="subscription-widget error">
          <p>❌ Error loading subscription widget</p>
          <button onclick="location.reload()">Reload</button>
        </div>
      `;
    }
  }

  getWidgetHTML() {
    if (!this.authManager?.isUserAuthenticated()) {
      return this.getLoginPromptHTML();
    }

    const subscription = this.subscriptionManager?.getSubscriptionInfo();
    const usageStats = this.subscriptionManager?.getUsageStats();
    const tierConfig = this.subscriptionManager?.getTierConfig();

    switch (this.currentView) {
      case 'plans':
        return this.getPlansHTML();
      case 'processing':
        return this.getProcessingHTML();
      default:
        return this.getStatusHTML(subscription, usageStats, tierConfig);
    }
  }

  getLoginPromptHTML() {
    return `
      <div class="subscription-widget login-prompt">
        <div class="widget-header">
          <h3>🔐 Account Required</h3>
        </div>
        <div class="widget-content">
          <p>Sign in to access premium features and usage tracking.</p>
          <button class="btn-primary" id="show-login">Sign In</button>
          <button class="btn-secondary" id="show-register">Create Account</button>
        </div>
      </div>
    `;
  }

  getStatusHTML(subscription, usageStats, tierConfig) {
    const isFreeTier = !subscription || subscription.tier === 'free';
    const upgradeRecommendation = this.subscriptionManager?.shouldRecommendUpgrade();

    return `
      <div class="subscription-widget">
        <div class="widget-header">
          <div class="tier-badge ${subscription?.tier || 'free'}">
            ${tierConfig?.name || 'Free'}
          </div>
          ${!isFreeTier ? `
            <button class="btn-link" id="manage-subscription" title="Manage subscription">
              ⚙️
            </button>
          ` : ''}
        </div>
        
        <div class="widget-content">
          ${this.getUsageDisplayHTML(usageStats)}
          
          ${upgradeRecommendation ? `
            <div class="upgrade-notification">
              <p>💡 ${upgradeRecommendation.message}</p>
              <button class="btn-upgrade" id="show-plans">Upgrade Now</button>
            </div>
          ` : ''}
          
          ${isFreeTier ? `
            <div class="upgrade-cta">
              <p>Get unlimited access with Pro!</p>
              <button class="btn-primary" id="show-plans">View Plans</button>
            </div>
          ` : ''}
          
          ${subscription?.status === 'cancelled' ? `
            <div class="cancellation-notice">
              <p>⚠️ Subscription cancelled. Access until ${new Date(subscription.expiresAt).toLocaleDateString()}</p>
              <button class="btn-primary" id="reactivate">Reactivate</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  getUsageDisplayHTML(usageStats) {
    if (!usageStats) return '';

    const aiAnalysis = usageStats.aiAnalyses;
    const exports = usageStats.exports;

    return `
      <div class="usage-display">
        <div class="usage-item">
          <div class="usage-header">
            <span>AI Analyses</span>
            <span class="usage-count">
              ${aiAnalysis.used}${aiAnalysis.limit === -1 ? '' : `/${aiAnalysis.limit}`}
            </span>
          </div>
          ${aiAnalysis.limit !== -1 ? `
            <div class="usage-bar">
              <div class="usage-fill" style="width: ${aiAnalysis.percentage}%"></div>
            </div>
          ` : '<div class="unlimited-badge">Unlimited</div>'}
        </div>

        <div class="usage-item">
          <div class="usage-header">
            <span>Exports</span>
            <span class="usage-count">
              ${exports.used}${exports.limit === -1 ? '' : `/${exports.limit}`}
            </span>
          </div>
          ${exports.limit !== -1 ? `
            <div class="usage-bar">
              <div class="usage-fill" style="width: ${exports.percentage}%"></div>
            </div>
          ` : '<div class="unlimited-badge">Unlimited</div>'}
        </div>

        <div class="reset-info">
          Resets: ${new Date(usageStats.resetDate).toLocaleDateString()}
        </div>
      </div>
    `;
  }

  getPlansHTML() {
    const comparison = this.subscriptionManager?.getSubscriptionComparison();
    if (!comparison) return '<div>Error loading plans</div>';

    const { tiers, currentTier } = comparison;

    return `
      <div class="subscription-widget plans-view">
        <div class="widget-header">
          <button class="btn-back" id="back-to-status">← Back</button>
          <h3>Choose Your Plan</h3>
        </div>
        
        <div class="plans-container">
          ${Object.entries(tiers).map(([tierKey, tier]) => `
            <div class="plan-card ${tierKey === currentTier ? 'current' : ''} ${tierKey === 'pro' ? 'recommended' : ''}">
              ${tierKey === 'pro' ? '<div class="recommended-badge">Most Popular</div>' : ''}
              
              <div class="plan-header">
                <h4>${tier.name}</h4>
                <div class="plan-price">${this.subscriptionManager.formatPrice(tier.price)}</div>
              </div>
              
              <ul class="plan-features">
                ${tier.features.map(feature => `<li>✓ ${feature}</li>`).join('')}
              </ul>
              
              <div class="plan-actions">
                ${tierKey === currentTier ? 
                  '<button class="btn-current" disabled>Current Plan</button>' :
                  tierKey === 'free' ? 
                    '<button class="btn-secondary" disabled>Downgrade</button>' :
                    `<button class="btn-upgrade" data-tier="${tierKey}" data-price="${this.getPriceId(tierKey)}">
                      ${currentTier === 'free' ? 'Upgrade' : 'Switch Plan'}
                    </button>`
                }
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="plans-footer">
          <p>✅ Cancel anytime • 💳 Secure payment • 🔒 30-day money back guarantee</p>
        </div>
      </div>
    `;
  }

  getProcessingHTML() {
    return `
      <div class="subscription-widget processing-view">
        <div class="processing-spinner"></div>
        <h3>Processing...</h3>
        <p>Please wait while we set up your subscription.</p>
      </div>
    `;
  }

  attachEventListeners() {
    // Back button
    const backBtn = this.container.querySelector('#back-to-status');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.currentView = 'status';
        this.render();
      });
    }

    // Show plans
    const showPlansBtn = this.container.querySelector('#show-plans');
    if (showPlansBtn) {
      showPlansBtn.addEventListener('click', () => {
        this.currentView = 'plans';
        this.render();
      });
    }

    // Login/Register buttons
    const loginBtn = this.container.querySelector('#show-login');
    const registerBtn = this.container.querySelector('#show-register');
    
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.showAuthModal('login'));
    }
    
    if (registerBtn) {
      registerBtn.addEventListener('click', () => this.showAuthModal('register'));
    }

    // Manage subscription
    const manageBtn = this.container.querySelector('#manage-subscription');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.openCustomerPortal());
    }

    // Upgrade buttons
    const upgradeButtons = this.container.querySelectorAll('.btn-upgrade[data-tier]');
    upgradeButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tier = e.target.dataset.tier;
        const priceId = e.target.dataset.price;
        await this.handleUpgrade(tier, priceId);
      });
    });

    // Reactivate button
    const reactivateBtn = this.container.querySelector('#reactivate');
    if (reactivateBtn) {
      reactivateBtn.addEventListener('click', () => this.handleReactivation());
    }
  }

  async handleUpgrade(tier, priceId) {
    try {
      this.setLoading(true);
      
      const result = await this.subscriptionManager.createCheckoutSession(priceId);
      
      if (result.success && result.url) {
        // Open Stripe Checkout in new tab
        chrome.tabs?.create({ url: result.url }) || window.open(result.url, '_blank');
      } else {
        throw new Error('Failed to create checkout session');
      }
      
    } catch (error) {
      console.error('❌ Upgrade error:', error);
      this.showError(this.subscriptionManager.handleSubscriptionError(error).error);
    } finally {
      this.setLoading(false);
    }
  }

  async openCustomerPortal() {
    try {
      this.setLoading(true);
      
      const result = await this.subscriptionManager.createPortalSession();
      
      if (result.success && result.url) {
        // Open customer portal in new tab
        chrome.tabs?.create({ url: result.url }) || window.open(result.url, '_blank');
      } else {
        throw new Error('Failed to open customer portal');
      }
      
    } catch (error) {
      console.error('❌ Portal error:', error);
      this.showError(this.subscriptionManager.handleSubscriptionError(error).error);
    } finally {
      this.setLoading(false);
    }
  }

  showAuthModal(mode = 'login') {
    // Dispatch event for auth modal
    window.dispatchEvent(new CustomEvent('show-auth-modal', {
      detail: { mode }
    }));
  }

  setLoading(loading) {
    this.isLoading = loading;
    
    if (loading) {
      this.currentView = 'processing';
      this.render();
    }
  }

  showError(message) {
    // Create temporary error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'subscription-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span>❌ ${message}</span>
        <button onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    `;
    
    this.container.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  getPriceId(tier) {
    // Map tier to Stripe price IDs
    const priceIds = {
      pro: 'price_1S1VylDuJ5D01noYssELJbfu',
      enterprise: 'price_enterprise_monthly'
    };
    
    return priceIds[tier] || '';
  }

  setupEventListeners() {
    // Listen for subscription changes
    this.subscriptionManager?.onSubscriptionChange((event) => {
      console.log('🔄 Subscription changed:', event.detail);
      this.render();
    });

    // Listen for auth changes
    window.addEventListener('auth-change', () => {
      this.render();
    });

    // Listen for usage updates
    window.addEventListener('usage-updated', () => {
      if (this.currentView === 'status') {
        this.render();
      }
    });
  }

  // Public method to check and record usage
  async checkAndRecordUsage() {
    if (!this.subscriptionManager) {
      throw new Error('Subscription manager not available');
    }

    const canUse = await this.subscriptionManager.canPerformAction('ai_analysis');
    
    if (!canUse.allowed) {
      if (canUse.upgradeRequired) {
        this.showUpgradeNotification(canUse.reason);
      }
      throw new Error(canUse.reason);
    }

    await this.subscriptionManager.recordUsage('ai_analysis');
    this.updateUsageDisplay();
    
    return true;
  }

  showUpgradeNotification(message) {
    // Show upgrade modal or notification
    const notification = document.createElement('div');
    notification.className = 'upgrade-notification-modal';
    notification.innerHTML = `
      <div class="notification-content">
        <h3>Upgrade Required</h3>
        <p>${message}</p>
        <div class="notification-actions">
          <button class="btn-primary" onclick="window.subscriptionWidget.showPlans(); this.parentElement.parentElement.parentElement.remove();">
            View Plans
          </button>
          <button class="btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove();">
            Cancel
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
  }

  showPlans() {
    this.currentView = 'plans';
    this.render();
  }

  async updateUsageDisplay() {
    if (this.currentView === 'status') {
      await this.render();
    }
  }

  // Method to update widget after external changes
  async refresh() {
    await this.render();
  }
}

// CSS for the widget (inject if not present)
if (!document.querySelector('#subscription-widget-styles')) {
  const styles = document.createElement('style');
  styles.id = 'subscription-widget-styles';
  styles.textContent = `
    .subscription-widget {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .tier-badge {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }

    .tier-badge.pro {
      background: linear-gradient(45deg, #FFD700, #FFA500);
      color: #333;
    }

    .usage-display {
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
      margin: 12px 0;
    }

    .usage-item {
      margin-bottom: 12px;
    }

    .usage-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .usage-bar {
      height: 6px;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      overflow: hidden;
    }

    .usage-fill {
      height: 100%;
      background: linear-gradient(90deg, #4ade80, #22c55e);
      transition: width 0.3s ease;
    }

    .unlimited-badge {
      font-size: 12px;
      color: #4ade80;
      font-weight: 600;
    }

    .upgrade-cta, .upgrade-notification, .cancellation-notice {
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
      margin: 12px 0;
      text-align: center;
    }

    .btn-primary, .btn-upgrade {
      background: #ffffff;
      color: #667eea;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-primary:hover, .btn-upgrade:hover {
      background: #f0f0f0;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
    }

    .btn-link {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }

    .btn-link:hover {
      background: rgba(255,255,255,0.1);
    }

    .plans-container {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      margin: 16px 0;
    }

    .plan-card {
      background: white;
      color: #333;
      border-radius: 12px;
      padding: 20px;
      position: relative;
      border: 2px solid transparent;
    }

    .plan-card.recommended {
      border-color: #667eea;
      transform: scale(1.05);
    }

    .plan-card.current {
      border-color: #4ade80;
    }

    .recommended-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .plan-price {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      margin: 8px 0;
    }

    .plan-features {
      list-style: none;
      padding: 0;
      margin: 16px 0;
    }

    .plan-features li {
      padding: 4px 0;
      font-size: 14px;
    }

    .processing-view {
      text-align: center;
      padding: 40px 20px;
    }

    .processing-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .subscription-error {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .error-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .upgrade-notification-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    }

    .notification-content {
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      text-align: center;
    }

    .notification-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 16px;
    }
  `;
  document.head.appendChild(styles);
}

// Global instance
window.SubscriptionWidget = SubscriptionWidget;