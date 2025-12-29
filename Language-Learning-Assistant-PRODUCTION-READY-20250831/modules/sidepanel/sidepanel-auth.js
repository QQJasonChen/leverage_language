// Sidepanel Authentication Module

class SidepanelAuth {
  constructor() {
    this.currentUser = null;
    this.authManager = null;
    this.subscriptionManager = null;
    this.isInitialized = false;
    this.initializeAuthServices();
  }

  async initializeAuthServices() {
    // Wait for auth manager to be available
    const checkInterval = setInterval(() => {
      if (typeof AuthManager !== 'undefined') {
        this.authManager = new AuthManager();
        clearInterval(checkInterval);
        this.logSafely('✅ Auth manager initialized');
      }
    }, 100);

    // Wait for subscription manager to be available
    const subCheckInterval = setInterval(() => {
      if (typeof SubscriptionManager !== 'undefined') {
        this.subscriptionManager = new SubscriptionManager();
        clearInterval(subCheckInterval);
        this.logSafely('✅ Subscription manager initialized');
      }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      clearInterval(subCheckInterval);
      this.isInitialized = true;
    }, 5000);
  }

  logSafely(...args) {
    if (typeof window.SidepanelCore?.logSafely === 'function') {
      window.SidepanelCore.logSafely(...args);
    } else {
      console.log(...args);
    }
  }

  // Setup authentication UI
  setupAuthenticationUI() {
    this.logSafely('🔐 Setting up authentication UI');
    
    // Check for existing auth state
    this.checkAuthState();
    
    // Setup auth UI elements
    this.setupAuthButtons();
    this.setupSubscriptionUI();
    
    // Listen for auth state changes
    this.setupAuthListeners();
  }

  // Check current authentication state
  async checkAuthState() {
    try {
      if (this.authManager && typeof this.authManager.getCurrentUser === 'function') {
        const user = await this.authManager.getCurrentUser();
        if (user) {
          this.currentUser = user;
          this.updateAuthUI(user);
          this.logSafely('👤 User logged in:', user.email);
        } else {
          this.updateAuthUI(null);
          this.logSafely('👤 No user logged in');
        }
      }
    } catch (error) {
      console.error('❌ Failed to check auth state:', error);
    }
  }

  // Setup authentication buttons
  setupAuthButtons() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const registerBtn = document.getElementById('register-btn');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    if (registerBtn) {
      registerBtn.addEventListener('click', () => this.handleRegister());
    }
  }

  // Setup subscription UI
  setupSubscriptionUI() {
    const upgradeBtn = document.getElementById('upgrade-btn');
    const subscriptionInfo = document.getElementById('subscription-info');

    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.handleUpgrade());
    }

    // Update subscription info
    this.updateSubscriptionInfo();
  }

  // Setup authentication event listeners
  setupAuthListeners() {
    // Listen for auth state changes from auth manager
    document.addEventListener('authStateChanged', (event) => {
      this.currentUser = event.detail.user;
      this.updateAuthUI(event.detail.user);
    });

    // Listen for subscription changes
    document.addEventListener('subscriptionChanged', (event) => {
      this.updateSubscriptionInfo(event.detail.subscription);
    });
  }

  // Handle login
  async handleLogin() {
    try {
      this.logSafely('🔐 Starting login process...');
      
      if (this.authManager && typeof this.authManager.signIn === 'function') {
        const user = await this.authManager.signIn();
        if (user) {
          this.currentUser = user;
          this.updateAuthUI(user);
          this.showMessage('登入成功！', 'success');
          this.logSafely('✅ Login successful:', user.email);
        }
      } else {
        this.showMessage('認證服務暫時無法使用，請稍後再試', 'error');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      this.showMessage('登入失敗，請檢查網路連線', 'error');
    }
  }

  // Handle logout
  async handleLogout() {
    try {
      this.logSafely('🔐 Starting logout process...');
      
      if (this.authManager && typeof this.authManager.signOut === 'function') {
        await this.authManager.signOut();
        this.currentUser = null;
        this.updateAuthUI(null);
        this.showMessage('已成功登出', 'success');
        this.logSafely('✅ Logout successful');
      }
    } catch (error) {
      console.error('❌ Logout failed:', error);
      this.showMessage('登出時發生錯誤', 'error');
    }
  }

  // Handle registration
  async handleRegister() {
    try {
      this.logSafely('🔐 Starting registration process...');
      
      if (this.authManager && typeof this.authManager.signUp === 'function') {
        const user = await this.authManager.signUp();
        if (user) {
          this.currentUser = user;
          this.updateAuthUI(user);
          this.showMessage('註冊成功！歡迎加入！', 'success');
          this.logSafely('✅ Registration successful:', user.email);
        }
      } else {
        this.showMessage('註冊服務暫時無法使用，請稍後再試', 'error');
      }
    } catch (error) {
      console.error('❌ Registration failed:', error);
      this.showMessage('註冊失敗，請檢查輸入資訊', 'error');
    }
  }

  // Handle subscription upgrade
  async handleUpgrade() {
    try {
      this.logSafely('💳 Starting subscription upgrade...');
      
      if (this.subscriptionManager && typeof this.subscriptionManager.createCheckoutSession === 'function') {
        await this.subscriptionManager.createCheckoutSession();
        this.logSafely('✅ Redirecting to checkout...');
      } else {
        this.showMessage('訂閱服務暫時無法使用，請稍後再試', 'error');
      }
    } catch (error) {
      console.error('❌ Upgrade failed:', error);
      this.showMessage('升級失敗，請稍後再試', 'error');
    }
  }

  // Update authentication UI based on user state
  updateAuthUI(user) {
    const loginSection = document.getElementById('login-section');
    const userSection = document.getElementById('user-section');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');

    if (user) {
      // User is logged in
      if (loginSection) loginSection.style.display = 'none';
      if (userSection) userSection.style.display = 'block';
      if (userEmail) userEmail.textContent = user.email;
      if (userAvatar) {
        userAvatar.textContent = user.email.charAt(0).toUpperCase();
      }
    } else {
      // User is not logged in
      if (loginSection) loginSection.style.display = 'block';
      if (userSection) userSection.style.display = 'none';
    }

    // Update auth-dependent features
    this.updateAuthDependentFeatures(user);
  }

  // Update subscription information
  async updateSubscriptionInfo(subscription = null) {
    try {
      if (!subscription && this.subscriptionManager && typeof this.subscriptionManager.getSubscriptionStatus === 'function') {
        subscription = await this.subscriptionManager.getSubscriptionStatus();
      }

      const subscriptionElement = document.getElementById('subscription-status');
      const upgradeBtn = document.getElementById('upgrade-btn');

      if (subscription && subscription.active) {
        if (subscriptionElement) {
          subscriptionElement.innerHTML = `
            <div class="subscription-active">
              <span class="status-badge active">Pro</span>
              <span class="expires">到期：${new Date(subscription.current_period_end * 1000).toLocaleDateString()}</span>
            </div>
          `;
        }
        if (upgradeBtn) upgradeBtn.style.display = 'none';
      } else {
        if (subscriptionElement) {
          subscriptionElement.innerHTML = `
            <div class="subscription-free">
              <span class="status-badge free">免費版</span>
              <span class="limits">每日 ${subscription?.daily_limit || 10} 次 AI 分析</span>
            </div>
          `;
        }
        if (upgradeBtn) upgradeBtn.style.display = 'block';
      }
    } catch (error) {
      console.error('❌ Failed to update subscription info:', error);
    }
  }

  // Update features that depend on authentication
  updateAuthDependentFeatures(user) {
    const authRequiredElements = document.querySelectorAll('.auth-required');
    const premiumRequiredElements = document.querySelectorAll('.premium-required');

    authRequiredElements.forEach(element => {
      if (user) {
        element.classList.remove('disabled');
        element.removeAttribute('disabled');
      } else {
        element.classList.add('disabled');
        element.setAttribute('disabled', 'true');
      }
    });

    // Handle premium features
    if (user && user.subscription && user.subscription.active) {
      premiumRequiredElements.forEach(element => {
        element.classList.remove('disabled');
        element.removeAttribute('disabled');
      });
    } else {
      premiumRequiredElements.forEach(element => {
        element.classList.add('disabled');
        element.setAttribute('disabled', 'true');
      });
    }
  }

  // Show message to user
  showMessage(message, type = 'info') {
    if (typeof window.showMessage === 'function') {
      window.showMessage(message, type);
    } else {
      // Fallback to console
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Check if user has premium subscription
  hasPremium() {
    return this.currentUser && this.currentUser.subscription && this.currentUser.subscription.active;
  }

  // Get user subscription status
  getSubscriptionStatus() {
    if (this.hasPremium()) {
      return this.currentUser.subscription;
    }
    return null;
  }

  // Open authentication modal
  openAuthModal(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'block';
      
      // Switch to appropriate tab
      const loginTab = document.getElementById('login-tab');
      const registerTab = document.getElementById('register-tab');
      
      if (mode === 'register' && registerTab) {
        registerTab.click();
      } else if (loginTab) {
        loginTab.click();
      }
    }
  }

  // Close authentication modal
  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Initialize auth UI when DOM is ready
  init() {
    if (document.readyState === 'complete') {
      this.setupAuthenticationUI();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupAuthenticationUI();
      });
    }
  }
}

// Create global auth instance
const sidepanelAuth = new SidepanelAuth();

// Export legacy function names for backward compatibility
window.setupAuthenticationUI = () => sidepanelAuth.setupAuthenticationUI();
window.updateAuthUI = (user) => sidepanelAuth.updateAuthUI(user);
window.getCurrentUser = () => sidepanelAuth.getCurrentUser();

// Export for use by other modules
window.SidepanelAuth = sidepanelAuth;

// Auto-initialize
sidepanelAuth.init();