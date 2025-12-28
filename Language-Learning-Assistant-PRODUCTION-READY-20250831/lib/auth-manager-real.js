// Real Authentication Manager using Supabase
// This replaces the simulated auth-manager.js in production

class AuthManagerReal {
  constructor() {
    this.supabase = window.supabaseClient;
    this.currentUser = null;
    this.profile = null;
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    console.log('🔐 Real AuthManager initializing...');
    
    // Wait for Supabase client to be ready
    if (!this.supabase) {
      console.warn('⚠️ Supabase client not available');
      return;
    }

    // Subscribe to auth state changes
    this.supabase.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (session) {
        this.currentUser = session.user;
        await this.loadProfile();
        
        // Handle specific events
        if (event === 'SIGNED_IN') {
          // Trigger initial sync
          if (window.cloudSyncManager) {
            window.cloudSyncManager.onAuthStateChanged(true);
          }
        }
      } else {
        this.currentUser = null;
        this.profile = null;
        
        if (event === 'SIGNED_OUT') {
          // Clear local data
          if (window.cloudSyncManager) {
            window.cloudSyncManager.onAuthStateChanged(false);
          }
        }
      }
    });

    // Check initial session
    const session = await this.supabase.checkSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
    }

    this.isInitialized = true;
    console.log('🔐 Real AuthManager initialized');
  }

  async loadProfile() {
    if (!this.currentUser) return;
    
    this.profile = await this.supabase.getProfile();
    console.log('Profile loaded:', this.profile);
  }

  // Google OAuth authentication
  async authenticateWithGoogle() {
    try {
      console.log('🔐 Starting Google authentication...');
      
      const result = await this.supabase.signInWithGoogle();
      
      if (result.success) {
        // Google OAuth will redirect, so we return success
        return {
          success: true,
          message: 'Redirecting to Google...'
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('❌ Google authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Email/Password authentication
  async authenticateWithEmail(email, password, isSignUp = false) {
    try {
      console.log(`📧 Starting email ${isSignUp ? 'sign up' : 'sign in'}...`);
      
      let result;
      if (isSignUp) {
        result = await this.supabase.signUpWithEmail(email, password);
      } else {
        result = await this.supabase.signInWithEmail(email, password);
      }

      if (result.success) {
        this.currentUser = result.user;
        await this.loadProfile();
        
        return {
          success: true,
          user: this.formatUserData(),
          message: result.message
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('❌ Email authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      console.log('🔐 Signing out...');
      
      const result = await this.supabase.signOut();
      
      if (result.success) {
        this.currentUser = null;
        this.profile = null;
      }
      
      return result;
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get formatted user data
  formatUserData() {
    if (!this.currentUser) return null;
    
    return {
      id: this.currentUser.id,
      email: this.currentUser.email,
      name: this.profile?.full_name || this.currentUser.email.split('@')[0],
      picture: this.profile?.avatar_url || this.currentUser.user_metadata?.avatar_url,
      createdAt: this.currentUser.created_at,
      lastLoginAt: new Date().toISOString(),
      subscription: {
        tier: this.profile?.subscription_tier || 'free',
        status: this.profile?.subscription_status || 'active',
        expiresAt: this.profile?.subscription_expires_at
      }
    };
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return this.supabase.isAuthenticated();
  }

  // Get current user
  getCurrentUser() {
    return this.formatUserData();
  }

  // Get subscription info
  getSubscriptionInfo() {
    if (!this.profile) return null;
    
    return {
      tier: this.profile.subscription_tier || 'free',
      status: this.profile.subscription_status || 'active',
      expiresAt: this.profile.subscription_expires_at,
      stripeCustomerId: this.profile.stripe_customer_id,
      stripeSubscriptionId: this.profile.stripe_subscription_id
    };
  }

  // Check if user has premium access
  hasPremiumAccess() {
    const subscription = this.getSubscriptionInfo();
    if (!subscription) return false;
    
    return ['pro', 'enterprise'].includes(subscription.tier) && 
           subscription.status === 'active';
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
        historyRetentionDays: -1,
        exportLimit: -1,
        cloudSync: true,
        advancedAnalytics: true
      };
    }
    
    // Enterprise
    return {
      aiAnalysesPerMonth: -1,
      historyRetentionDays: -1,
      exportLimit: -1,
      cloudSync: true,
      advancedAnalytics: true,
      classroomManagement: true
    };
  }

  // Update subscription (called after Stripe webhook)
  async updateSubscription(tier, status, expiresAt) {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };
    
    const result = await this.supabase.updateProfile({
      subscription_tier: tier,
      subscription_status: status,
      subscription_expires_at: expiresAt
    });
    
    if (result.success) {
      await this.loadProfile();
    }
    
    return result;
  }

  // Handle OAuth callback
  async handleAuthCallback() {
    try {
      const { data: { session }, error } = await this.supabase.supabase.auth.exchangeCodeForSession(window.location.href);
      
      if (error) throw error;
      
      if (session) {
        this.currentUser = session.user;
        await this.loadProfile();
        
        return {
          success: true,
          user: this.formatUserData()
        };
      }
      
      return { success: false, error: 'No session found' };
    } catch (error) {
      console.error('Auth callback error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
window.authManagerReal = new AuthManagerReal();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManagerReal;
}