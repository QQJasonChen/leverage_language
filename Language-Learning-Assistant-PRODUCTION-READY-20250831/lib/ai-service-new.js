// New AI Service - Backward compatible alias for testing
// This file imports the unified service and provides backward compatibility

// Import unified service
if (typeof importScripts !== 'undefined') {
  importScripts('./ai-service-unified.js');
}

// Create backward compatible AIService class
class AIService {
  constructor() {
    this.unifiedService = new UnifiedAIService();
    
    // Backward compatibility properties
    this.settings = null;
    this.isInitialized = false;
    this.interfaceLanguage = 'zh_TW';
    this.apiMode = 'free';
  }

  async initialize() {
    const result = await this.unifiedService.initialize();
    this.isInitialized = result;
    this.settings = this.unifiedService.settings;
    this.interfaceLanguage = this.unifiedService.interfaceLanguage;
    this.apiMode = this.unifiedService.apiMode;
    return result;
  }

  async analyzeText(text, options = {}) {
    return await this.unifiedService.analyzeText(text, options);
  }

  async getInterfaceLanguage() {
    return this.unifiedService.interfaceLanguage;
  }

  async switchMode(mode) {
    return await this.unifiedService.switchMode(mode);
  }

  // Legacy method names for compatibility
  async analyze(text, targetLanguage = 'auto', options = {}) {
    return await this.analyzeText(text, { ...options, targetLanguage });
  }

  getUsageStats() {
    return this.unifiedService.getUsageStats();
  }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}