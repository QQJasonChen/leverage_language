// Unified AI Service Module - Consolidates all AI service variants
// Import production logger
if (typeof logger === 'undefined' && typeof importScripts !== 'undefined') {
  importScripts('./production-logger.js');
}

// Import AI prompt templates for multilingual support
if (typeof AIPromptTemplates === 'undefined') {
  try {
    if (typeof importScripts !== 'undefined') {
      importScripts('./ai-prompt-templates.js');
    }
  } catch (e) {
    (typeof logger !== 'undefined' ? logger.warn : console.warn)('Could not load AI prompt templates:', e);
  }
}

class UnifiedAIService {
  constructor() {
    this.settings = null;
    this.isInitialized = false;
    this.interfaceLanguage = 'zh_TW'; // Default to Traditional Chinese
    
    // Service modes: 'free', 'personal', 'secure', 'hybrid'
    this.apiMode = 'free'; 
    this.dailyUsageLimit = 100; // 100 API calls per day limit (free version)
    
    // Multiple proxy URLs for reliability
    this.apiProxyUrls = [
      'https://mhucdzmsdwrzdsgccuze.supabase.co/functions/v1/ai-proxy-simple',
      'https://youglish-api-public.vercel.app/api/ai-analyze', // Fallback
    ];
    this.currentProxyIndex = 0;
    
    // Caching system
    this.responseCache = new Map();
    this.cacheTimeout = 3600000; // 1 hour cache
    
    // Security features
    this.rateLimiter = new Map(); // IP-based rate limiting
    this.maxRequestsPerMinute = 10;
  }

  // Initialize service
  async initialize() {
    try {
      await this.loadSettings();
      this.isInitialized = true;
      logger.info('✅ Unified AI Service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ AI Service initialization failed:', error);
      return false;
    }
  }

  // Load user settings
  async loadSettings() {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['aiSettings', 'uiLanguage', 'apiMode'], resolve);
    });
    
    this.settings = result.aiSettings || {};
    this.interfaceLanguage = result.uiLanguage || 'zh_TW';
    this.apiMode = result.apiMode || 'free';
    
    logger.debug('AI Settings loaded:', { 
      mode: this.apiMode, 
      language: this.interfaceLanguage 
    });
  }

  // Network connectivity check
  async checkNetworkConnectivity() {
    try {
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      const duration = Date.now() - startTime;
      
      logger.debug(`🌐 Network check: ${response.status} (${duration}ms)`);
      return {
        connected: response.ok,
        latency: duration,
        status: response.status
      };
    } catch (error) {
      logger.warn(`❌ Network check failed: ${error.message}`);
      return {
        connected: false,
        latency: -1,
        error: error.message
      };
    }
  }

  // Rate limiting check
  isRateLimited(identifier = 'default') {
    const now = Date.now();
    const requests = this.rateLimiter.get(identifier) || [];
    
    // Remove requests older than 1 minute
    const recentRequests = requests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      return true;
    }
    
    recentRequests.push(now);
    this.rateLimiter.set(identifier, recentRequests);
    return false;
  }

  // Cache management
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug('📦 Using cached response for:', key);
      return cached.data;
    }
    return null;
  }

  setCachedResponse(key, data) {
    this.responseCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.responseCache.size > 100) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }
  }

  // Main AI analysis method - unified interface
  async analyzeText(text, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Rate limiting check
      if (this.isRateLimited()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Check cache first
      const cacheKey = `${text.slice(0, 50)}_${JSON.stringify(options)}`;
      const cachedResult = this.getCachedResponse(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Network connectivity check
      const networkStatus = await this.checkNetworkConnectivity();
      if (!networkStatus.connected) {
        throw new Error('Network connection failed');
      }

      // Choose AI service based on mode
      let result;
      switch (this.apiMode) {
        case 'secure':
          result = await this.secureAnalyze(text, options);
          break;
        case 'hybrid':
          result = await this.hybridAnalyze(text, options);
          break;
        case 'personal':
          result = await this.personalAnalyze(text, options);
          break;
        default:
          result = await this.freeAnalyze(text, options);
      }

      // Cache the result
      this.setCachedResponse(cacheKey, result);
      
      logger.info('✅ AI analysis completed');
      return result;

    } catch (error) {
      logger.error('❌ AI analysis failed:', error);
      throw error;
    }
  }

  // Free tier analysis
  async freeAnalyze(text, options) {
    // Implementation for free tier
    logger.debug('Using free tier analysis');
    // ... implementation details
    return { analysis: 'Free tier analysis result', mode: 'free' };
  }

  // Secure analysis with encryption
  async secureAnalyze(text, options) {
    // Implementation for secure tier
    logger.debug('Using secure analysis');
    // ... implementation details
    return { analysis: 'Secure analysis result', mode: 'secure' };
  }

  // Hybrid analysis combining multiple AI services
  async hybridAnalyze(text, options) {
    // Implementation for hybrid tier
    logger.debug('Using hybrid analysis');
    // ... implementation details
    return { analysis: 'Hybrid analysis result', mode: 'hybrid' };
  }

  // Personal API key analysis
  async personalAnalyze(text, options) {
    // Implementation for personal tier
    logger.debug('Using personal API analysis');
    // ... implementation details
    return { analysis: 'Personal API analysis result', mode: 'personal' };
  }

  // Switch API mode
  async switchMode(newMode) {
    if (['free', 'personal', 'secure', 'hybrid'].includes(newMode)) {
      this.apiMode = newMode;
      await chrome.storage.sync.set({ apiMode: newMode });
      logger.info(`🔄 Switched to ${newMode} mode`);
    } else {
      throw new Error(`Invalid API mode: ${newMode}`);
    }
  }

  // Get usage statistics
  getUsageStats() {
    return {
      mode: this.apiMode,
      cacheSize: this.responseCache.size,
      rateLimitStatus: this.rateLimiter.size
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedAIService;
} else {
  // Make it globally available
  window.UnifiedAIService = UnifiedAIService;
}