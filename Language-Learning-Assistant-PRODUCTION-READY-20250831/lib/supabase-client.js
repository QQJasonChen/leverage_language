// Supabase Client for LeverageLanguage
// Handles all real database and authentication operations

import { createClient } from '@supabase/supabase-js';

class SupabaseClient {
  constructor() {
    // These will be replaced with your actual values
    this.supabaseUrl = 'YOUR_SUPABASE_URL'; // From .env
    this.supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // From .env
    
    this.supabase = null;
    this.currentUser = null;
    this.authStateListeners = [];
    
    this.init();
  }

  init() {
    // Initialize Supabase client
    this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      this.currentUser = session?.user || null;
      
      // Notify all listeners
      this.authStateListeners.forEach(listener => {
        listener(event, session);
      });
    });

    // Check initial session
    this.checkSession();
  }

  async checkSession() {
    const { data: { session } } = await this.supabase.auth.getSession();
    this.currentUser = session?.user || null;
    return session;
  }

  // Authentication Methods
  async signInWithGoogle() {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
          scopes: 'email profile'
        }
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  async signInWithEmail(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Email sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  async signUpWithEmail(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`
        }
      });

      if (error) throw error;
      
      // Check if email confirmation is required
      if (data.user && !data.session) {
        return { 
          success: true, 
          user: data.user,
          message: 'Please check your email to confirm your account'
        };
      }
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Email sign up error:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      
      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  // User Profile Methods
  async getProfile() {
    if (!this.currentUser) return null;

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  async updateProfile(updates) {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', this.currentUser.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  }

  // AI Reports Methods
  async saveReport(report) {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    try {
      // Check usage limit first
      const canSave = await this.checkUsageLimit('ai_analysis');
      if (!canSave.allowed) {
        return { success: false, error: canSave.reason, upgradeRequired: true };
      }

      // Save the report
      const { data, error } = await this.supabase
        .from('ai_reports')
        .insert({
          user_id: this.currentUser.id,
          search_text: report.searchText,
          language: report.language,
          analysis_data: report.analysisData,
          audio_data: report.audioData,
          tags: report.tags,
          has_errors: report.hasErrors,
          error_types: report.errorTypes,
          error_count: report.errorCount,
          is_correct: report.isCorrect
        })
        .select()
        .single();

      if (error) throw error;

      // Increment usage
      await this.incrementUsage('ai_analysis');

      return { success: true, data };
    } catch (error) {
      console.error('Save report error:', error);
      return { success: false, error: error.message };
    }
  }

  async getReports(filters = {}) {
    if (!this.currentUser) return [];

    try {
      let query = this.supabase
        .from('ai_reports')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.language) {
        query = query.eq('language', filters.language);
      }
      if (filters.hasErrors !== undefined) {
        query = query.eq('has_errors', filters.hasErrors);
      }
      if (filters.favorite !== undefined) {
        query = query.eq('favorite', filters.favorite);
      }
      if (filters.searchText) {
        query = query.ilike('search_text', `%${filters.searchText}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get reports error:', error);
      return [];
    }
  }

  async updateReport(reportId, updates) {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await this.supabase
        .from('ai_reports')
        .update(updates)
        .eq('id', reportId)
        .eq('user_id', this.currentUser.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update report error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteReport(reportId) {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await this.supabase
        .from('ai_reports')
        .delete()
        .eq('id', reportId)
        .eq('user_id', this.currentUser.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Delete report error:', error);
      return { success: false, error: error.message };
    }
  }

  // Usage Tracking Methods
  async checkUsageLimit(action) {
    if (!this.currentUser) return { allowed: false, reason: 'Not authenticated' };

    try {
      const { data, error } = await this.supabase
        .rpc('check_usage_limit', {
          p_user_id: this.currentUser.id,
          p_action: action
        });

      if (error) throw error;
      return data || { allowed: false };
    } catch (error) {
      console.error('Check usage limit error:', error);
      return { allowed: true }; // Allow on error to not block users
    }
  }

  async incrementUsage(action, count = 1) {
    if (!this.currentUser) return;

    try {
      await this.supabase.rpc('increment_usage', {
        p_user_id: this.currentUser.id,
        p_action: action,
        p_count: count
      });
    } catch (error) {
      console.error('Increment usage error:', error);
    }
  }

  async getUsageStats() {
    if (!this.currentUser) return null;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      
      const { data, error } = await this.supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .eq('month', currentMonth)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors
      
      return data || {
        ai_analyses_used: 0,
        exports_used: 0,
        audio_generations_used: 0
      };
    } catch (error) {
      console.error('Get usage stats error:', error);
      return null;
    }
  }

  // Learning Analytics Methods
  async saveAnalytics(analyticsData) {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      const { data, error } = await this.supabase
        .from('learning_analytics')
        .upsert({
          user_id: this.currentUser.id,
          date: today,
          ...analyticsData
        }, {
          onConflict: 'user_id,date'
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Save analytics error:', error);
      return { success: false, error: error.message };
    }
  }

  async getAnalytics(days = 30) {
    if (!this.currentUser) return [];

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('learning_analytics')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get analytics error:', error);
      return [];
    }
  }

  // Real-time Subscriptions
  subscribeToReports(callback) {
    if (!this.currentUser) return null;

    const subscription = this.supabase
      .channel('reports')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ai_reports',
        filter: `user_id=eq.${this.currentUser.id}`
      }, callback)
      .subscribe();

    return subscription;
  }

  // Helper Methods
  onAuthStateChange(callback) {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
    };
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUser() {
    return this.currentUser;
  }
}

// Create singleton instance
const supabaseClient = new SupabaseClient();

// Export for use in extension
window.supabaseClient = supabaseClient;

export default supabaseClient;