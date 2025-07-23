// Comprehensive Error Handling and Recovery System
class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.backoffMultiplier = 1.5;
    
    // Error categories
    this.errorTypes = {
      NETWORK: 'network',
      STORAGE: 'storage',
      API: 'api',
      VALIDATION: 'validation',
      PERMISSION: 'permission',
      QUOTA: 'quota',
      UNKNOWN: 'unknown'
    };
    
    // Recovery strategies
    this.recoveryStrategies = new Map();
    this.initializeRecoveryStrategies();
  }

  // Initialize error recovery strategies
  initializeRecoveryStrategies() {
    this.recoveryStrategies.set(this.errorTypes.NETWORK, {
      retry: true,
      fallback: 'offline_mode',
      userMessage: 'Network connection issue. Retrying...',
      action: 'retry_with_backoff'
    });

    this.recoveryStrategies.set(this.errorTypes.STORAGE, {
      retry: true,
      fallback: 'memory_storage',
      userMessage: 'Storage issue detected. Using temporary storage.',
      action: 'cleanup_and_retry'
    });

    this.recoveryStrategies.set(this.errorTypes.API, {
      retry: true,
      fallback: 'cached_response',
      userMessage: 'Service temporarily unavailable. Using cached data.',
      action: 'try_alternative_api'
    });

    this.recoveryStrategies.set(this.errorTypes.VALIDATION, {
      retry: false,
      fallback: 'sanitize_input',
      userMessage: 'Invalid input detected. Please check your data.',
      action: 'sanitize_and_retry'
    });

    this.recoveryStrategies.set(this.errorTypes.QUOTA, {
      retry: false,
      fallback: 'cleanup_old_data',
      userMessage: 'Storage limit reached. Cleaning up old data.',
      action: 'cleanup_storage'
    });
  }

  // Main error handling entry point
  async handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);
    this.logError(errorInfo);

    // Get recovery strategy
    const strategy = this.recoveryStrategies.get(errorInfo.type) || 
                    this.recoveryStrategies.get(this.errorTypes.UNKNOWN);

    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(errorInfo, strategy, context);
    
    // Notify user if needed
    if (strategy.userMessage && !recoveryResult.success) {
      this.notifyUser(strategy.userMessage, errorInfo.type);
    }

    return recoveryResult;
  }

  // Analyze error to determine type and severity
  analyzeError(error, context) {
    const errorInfo = {
      timestamp: Date.now(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: context,
      type: this.errorTypes.UNKNOWN,
      severity: 'medium',
      recoverable: true,
      originalError: error
    };

    // Determine error type
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      errorInfo.type = this.errorTypes.NETWORK;
    } else if (error.message.includes('storage') || error.message.includes('quota')) {
      errorInfo.type = this.errorTypes.STORAGE;
      if (error.message.includes('QUOTA_BYTES')) {
        errorInfo.type = this.errorTypes.QUOTA;
        errorInfo.severity = 'high';
      }
    } else if (error.message.includes('API') || error.status >= 400) {
      errorInfo.type = this.errorTypes.API;
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      errorInfo.type = this.errorTypes.VALIDATION;
      errorInfo.recoverable = false;
    } else if (error.message.includes('permission') || error.message.includes('denied')) {
      errorInfo.type = this.errorTypes.PERMISSION;
      errorInfo.severity = 'high';
    }

    return errorInfo;
  }

  // Attempt to recover from error
  async attemptRecovery(errorInfo, strategy, context) {
    const operationKey = `${errorInfo.type}_${context.operation || 'unknown'}`;
    const attempts = this.retryAttempts.get(operationKey) || 0;

    if (strategy.retry && attempts < this.maxRetries) {
      // Increment retry count
      this.retryAttempts.set(operationKey, attempts + 1);
      
      // Calculate backoff delay
      const delay = Math.pow(this.backoffMultiplier, attempts) * 1000;
      
      try {
        // Wait before retry
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Attempt recovery action
        const result = await this.executeRecoveryAction(errorInfo, strategy, context);
        
        if (result.success) {
          // Reset retry count on success
          this.retryAttempts.delete(operationKey);
          return result;
        }
      } catch (retryError) {
        // Log retry failure
        this.logError({
          ...errorInfo,
          message: `Retry failed: ${retryError.message}`,
          isRetry: true,
          attempt: attempts + 1
        });
      }
    }

    // If retries exhausted or not applicable, try fallback
    if (strategy.fallback) {
      return await this.executeFallback(errorInfo, strategy, context);
    }

    // No recovery possible
    return {
      success: false,
      error: errorInfo,
      message: 'No recovery strategy available',
      action: 'manual_intervention'
    };
  }

  // Execute specific recovery action
  async executeRecoveryAction(errorInfo, strategy, context) {
    switch (strategy.action) {
      case 'retry_with_backoff':
        return await this.retryOperation(context);

      case 'cleanup_and_retry':
        await this.cleanupStorage();
        return await this.retryOperation(context);

      case 'try_alternative_api':
        return await this.tryAlternativeAPI(context);

      case 'sanitize_and_retry':
        const sanitized = this.sanitizeInput(context);
        return await this.retryOperation({ ...context, ...sanitized });

      case 'cleanup_storage':
        await this.cleanupOldData();
        return await this.retryOperation(context);

      default:
        return { success: false, message: 'Unknown recovery action' };
    }
  }

  // Execute fallback strategy
  async executeFallback(errorInfo, strategy, context) {
    switch (strategy.fallback) {
      case 'offline_mode':
        return await this.enableOfflineMode(context);

      case 'memory_storage':
        return await this.useMemoryStorage(context);

      case 'cached_response':
        return await this.useCachedResponse(context);

      case 'sanitize_input':
        return await this.sanitizeAndProceed(context);

      case 'cleanup_old_data':
        await this.cleanupOldData();
        return { success: true, message: 'Storage cleaned up', fallback: true };

      default:
        return { success: false, message: 'Unknown fallback strategy' };
    }
  }

  // Specific recovery implementations
  async retryOperation(context) {
    // Add null check for context
    if (!context) {
      return { success: false, message: 'No context provided for retry operation' };
    }
    
    if (context.operation && context.retry) {
      try {
        const result = await context.retry();
        return { success: true, data: result, recovered: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, message: 'No retry operation available' };
  }

  async cleanupStorage() {
    try {
      // Remove old entries from storage
      const storage = await chrome.storage.local.get(null);
      const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const keysToRemove = [];
      Object.entries(storage).forEach(([key, value]) => {
        if (value && value.timestamp && value.timestamp < cutoff) {
          keysToRemove.push(key);
        }
      });

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      return { success: true, cleaned: keysToRemove.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async tryAlternativeAPI(context) {
    // Try different AI provider if available
    if (context.operation === 'ai_analysis') {
      const alternatives = ['gemini', 'openai'];
      const current = context.provider;
      const alternative = alternatives.find(p => p !== current);
      
      if (alternative && context.alternativeProvider) {
        try {
          const result = await context.alternativeProvider(alternative);
          return { success: true, data: result, provider: alternative };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    }

    return { success: false, message: 'No alternative API available' };
  }

  sanitizeInput(context) {
    if (context.input && typeof context.input === 'string') {
      return {
        input: context.input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .substring(0, 1000) // Limit length
          .trim()
      };
    }
    return context;
  }

  async enableOfflineMode(context) {
    // Use cached data or simplified functionality
    try {
      const cached = await this.getCachedData(context.cacheKey);
      if (cached) {
        return { 
          success: true, 
          data: cached, 
          offline: true,
          message: 'Using cached data due to network issues'
        };
      }
    } catch (error) {
      // Ignore cache errors
    }

    return { 
      success: true, 
      offline: true,
      message: 'Operating in offline mode. Some features may be limited.'
    };
  }

  async useMemoryStorage(context) {
    // Fallback to in-memory storage
    if (!window.memoryStorage) {
      window.memoryStorage = new Map();
    }

    if (context.operation === 'save') {
      window.memoryStorage.set(context.key, context.data);
      return { success: true, storage: 'memory', temporary: true };
    } else if (context.operation === 'load') {
      const data = window.memoryStorage.get(context.key);
      return { success: !!data, data, storage: 'memory' };
    }

    return { success: false, message: 'Unsupported memory storage operation' };
  }

  async useCachedResponse(context) {
    try {
      const cached = await this.getCachedData(context.cacheKey);
      if (cached) {
        return { 
          success: true, 
          data: cached, 
          cached: true,
          message: 'Using cached response'
        };
      }
    } catch (error) {
      // Cache access failed
    }

    return { success: false, message: 'No cached data available' };
  }

  async sanitizeAndProceed(context) {
    const sanitized = this.sanitizeInput(context);
    return { 
      success: true, 
      data: sanitized, 
      sanitized: true,
      message: 'Input sanitized and processed'
    };
  }

  async cleanupOldData() {
    try {
      const storage = await chrome.storage.local.get(null);
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      const keysToRemove = [];
      let savedSpace = 0;

      Object.entries(storage).forEach(([key, value]) => {
        if (key.startsWith('temp_') || 
            (value && value.lastAccessed && value.lastAccessed < cutoff)) {
          keysToRemove.push(key);
          savedSpace += JSON.stringify(value).length;
        }
      });

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      return { cleaned: keysToRemove.length, spaceSaved: savedSpace };
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  // Utility methods
  async getCachedData(cacheKey) {
    if (!cacheKey) return null;
    
    try {
      const result = await chrome.storage.local.get([cacheKey]);
      const cached = result[cacheKey];
      
      if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    } catch (error) {
      // Cache access failed
    }
    
    return null;
  }

  // Log error for debugging and monitoring
  logError(errorInfo) {
    this.errorLog.push(errorInfo);
    
    // Limit log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Log to console in development
    if (!this.isProduction()) {
      console.error('Error logged:', errorInfo);
    }

    // Optionally send to monitoring service
    this.sendToMonitoring(errorInfo);
  }

  // Notify user of error/recovery
  notifyUser(message, type) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `error-toast error-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'high' ? '#f44336' : '#ff9800'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  // Send error data to monitoring (if configured)
  sendToMonitoring(errorInfo) {
    // Only send critical errors to avoid spam
    if (errorInfo.severity === 'high') {
      // Implement monitoring service integration
      // e.g., Sentry, LogRocket, etc.
    }
  }

  // Check if running in production
  isProduction() {
    return !chrome.runtime.getManifest().name.includes('Dev');
  }

  // Get error statistics
  getErrorStatistics() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recent: this.errorLog.filter(e => Date.now() - e.timestamp < 24 * 60 * 60 * 1000).length
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  // Clear error log
  clearErrorLog() {
    this.errorLog = [];
    this.retryAttempts.clear();
  }
}

// Global error handler setup
if (typeof window !== 'undefined') {
  window.globalErrorHandler = new ErrorHandler();
  
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    window.globalErrorHandler.handleError(event.error, {
      operation: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    window.globalErrorHandler.handleError(event.reason, {
      operation: 'unhandled_promise',
      promise: true
    });
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}