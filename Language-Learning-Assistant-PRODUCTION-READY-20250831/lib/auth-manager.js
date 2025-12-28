// User Authentication and Account Management System
// Supports Google OAuth and Email/Password authentication

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.authToken = null;
    this.refreshToken = null;
    this.authProvider = null; // 'google' or 'email'
    this.syncEnabled = false;
    
    // Firebase config (to be set by user or environment)
    this.firebaseConfig = null;
    this.firebase = null;
    
    this.init();
  }

  async init() {
    console.log('🔐 AuthManager initializing...');
    
    // Load stored auth state
    await this.loadAuthState();
    
    // Initialize Firebase if config is available
    await this.initializeFirebase();
    
    // Check if current session is valid
    if (this.authToken) {
      await this.validateSession();
    }
    
    console.log('🔐 AuthManager initialized. Authenticated:', this.isAuthenticated);
  }

  // Load authentication state from storage
  async loadAuthState() {
    try {
      const result = await chrome.storage.local.get([
        'authToken', 'refreshToken', 'currentUser', 'authProvider', 'syncEnabled', 'firebaseConfig'
      ]);
      
      this.authToken = result.authToken || null;
      this.refreshToken = result.refreshToken || null;
      this.currentUser = result.currentUser || null;
      this.authProvider = result.authProvider || null;
      this.syncEnabled = result.syncEnabled || false;
      this.firebaseConfig = result.firebaseConfig || null;
      this.isAuthenticated = !!(this.authToken && this.currentUser);
      
      console.log('🔐 Auth state loaded:', {
        hasToken: !!this.authToken,
        provider: this.authProvider,
        user: this.currentUser?.email || 'none',
        syncEnabled: this.syncEnabled
      });
    } catch (error) {
      console.error('❌ Failed to load auth state:', error);
    }
  }

  // Save authentication state to storage
  async saveAuthState() {
    try {
      await chrome.storage.local.set({
        authToken: this.authToken,
        refreshToken: this.refreshToken,
        currentUser: this.currentUser,
        authProvider: this.authProvider,
        syncEnabled: this.syncEnabled,
        firebaseConfig: this.firebaseConfig
      });
      console.log('💾 Auth state saved');
    } catch (error) {
      console.error('❌ Failed to save auth state:', error);
    }
  }

  // Initialize Firebase
  async initializeFirebase() {
    if (!this.firebaseConfig) {
      console.log('⚠️ Firebase config not available');
      return false;
    }

    try {
      // In a real implementation, you would import Firebase SDK
      // For now, we'll simulate the Firebase connection
      console.log('🔥 Firebase initialized with config');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      return false;
    }
  }

  // Google OAuth authentication
  async authenticateWithGoogle() {
    try {
      console.log('🔐 Starting Google authentication...');
      
      // Use Chrome Identity API for OAuth
      const authResult = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        });
      });

      if (!authResult) {
        throw new Error('No auth token received');
      }

      // Get user profile information
      const userInfo = await this.fetchGoogleUserInfo(authResult);
      
      // Set authentication state
      this.authToken = authResult;
      this.currentUser = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        subscription: {
          tier: 'free',
          status: 'active',
          expiresAt: null
        }
      };
      this.authProvider = 'google';
      this.isAuthenticated = true;
      this.syncEnabled = true;

      await this.saveAuthState();

      console.log('✅ Google authentication successful:', this.currentUser.email);
      
      // Trigger sync after successful authentication
      await this.triggerInitialSync();
      
      return {
        success: true,
        user: this.currentUser
      };

    } catch (error) {
      console.error('❌ Google authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Fetch Google user information
  async fetchGoogleUserInfo(token) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to fetch Google user info:', error);
      throw error;
    }
  }

  // Email/Password authentication (simulated - would need backend)
  async authenticateWithEmail(email, password, isSignUp = false) {
    try {
      console.log('📧 Starting email authentication...');
      
      // In a real implementation, this would call your backend API
      // For now, we'll simulate the authentication
      
      if (isSignUp) {
        // Simulate user creation
        if (!this.isValidEmail(email) || password.length < 8) {
          throw new Error('Invalid email or password too short');
        }
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create user object
      this.authToken = this.generateToken();
      this.currentUser = {
        id: this.generateUserId(),
        email: email,
        name: email.split('@')[0],
        picture: this.generateAvatarUrl(email),
        createdAt: isSignUp ? new Date().toISOString() : '2024-01-01T00:00:00Z',
        lastLoginAt: new Date().toISOString(),
        subscription: {
          tier: 'free',
          status: 'active',
          expiresAt: null
        }
      };
      this.authProvider = 'email';
      this.isAuthenticated = true;
      this.syncEnabled = true;

      await this.saveAuthState();

      console.log('✅ Email authentication successful:', this.currentUser.email);
      
      // Trigger sync after successful authentication
      await this.triggerInitialSync();

      return {
        success: true,
        user: this.currentUser
      };

    } catch (error) {
      console.error('❌ Email authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sign out user
  async signOut() {
    try {
      console.log('🔐 Signing out user...');

      // Revoke Google auth token if using Google
      if (this.authProvider === 'google' && this.authToken) {
        try {
          await new Promise((resolve) => {
            chrome.identity.removeCachedAuthToken({ token: this.authToken }, resolve);
          });
        } catch (error) {
          console.warn('⚠️ Failed to revoke Google token:', error);
        }
      }

      // Clear authentication state
      this.authToken = null;
      this.refreshToken = null;
      this.currentUser = null;
      this.authProvider = null;
      this.isAuthenticated = false;
      this.syncEnabled = false;

      // Clear stored state
      await chrome.storage.local.remove([
        'authToken', 'refreshToken', 'currentUser', 'authProvider', 'syncEnabled'
      ]);

      console.log('✅ Sign out successful');
      
      return { success: true };

    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate current session
  async validateSession() {
    if (!this.authToken || !this.currentUser) {
      this.isAuthenticated = false;
      return false;
    }

    try {
      // For Google auth, validate token
      if (this.authProvider === 'google') {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Token validation failed');
        }
      }

      // Update last login time
      this.currentUser.lastLoginAt = new Date().toISOString();
      await this.saveAuthState();

      this.isAuthenticated = true;
      return true;

    } catch (error) {
      console.warn('⚠️ Session validation failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  // Trigger initial data sync after authentication
  async triggerInitialSync() {
    if (!this.isAuthenticated || !this.syncEnabled) {
      return;
    }

    try {
      console.log('🔄 Starting initial data sync...');
      
      // This would trigger the CloudSyncManager
      if (window.cloudSyncManager) {
        await window.cloudSyncManager.performFullSync();
      }
      
      console.log('✅ Initial sync completed');
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
    }
  }

  // Get current user info
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  // Get subscription info
  getSubscriptionInfo() {
    return this.currentUser?.subscription || null;
  }

  // Check if user has premium features
  hasPremiumAccess() {
    const subscription = this.getSubscriptionInfo();
    return subscription && ['pro', 'enterprise'].includes(subscription.tier) && subscription.status === 'active';
  }

  // Get usage limits based on subscription
  getUsageLimits() {
    const subscription = this.getSubscriptionInfo();
    
    if (!subscription || subscription.tier === 'free') {
      return {
        aiAnalysesPerMonth: 50,
        historyRetentionDays: 30,
        exportLimit: 10,
        cloudSync: false,
        advancedAnalytics: false
      };
    }
    
    if (subscription.tier === 'pro') {
      return {
        aiAnalysesPerMonth: -1, // unlimited
        historyRetentionDays: -1, // unlimited
        exportLimit: -1, // unlimited
        cloudSync: true,
        advancedAnalytics: true
      };
    }
    
    return {
      aiAnalysesPerMonth: -1,
      historyRetentionDays: -1,
      exportLimit: -1,
      cloudSync: true,
      advancedAnalytics: true,
      classroomManagement: true
    };
  }

  // Utility functions
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  generateToken() {
    return 'auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateAvatarUrl(email) {
    // Generate a simple avatar URL based on email
    const hash = email.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `https://api.dicebear.com/7.x/initials/svg?seed=${Math.abs(hash)}`;
  }

  // Configure Firebase (for advanced users)
  async configureFirebase(config) {
    this.firebaseConfig = config;
    await this.saveAuthState();
    return await this.initializeFirebase();
  }
}

// Global instance
window.authManager = new AuthManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}