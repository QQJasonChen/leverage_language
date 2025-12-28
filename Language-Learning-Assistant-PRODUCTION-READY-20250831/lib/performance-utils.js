// Performance utilities for optimization and monitoring
class PerformanceUtils {
  static isProduction = !chrome.runtime.getManifest().name.includes('Dev');
  
  // Replace console.log with conditional logging
  static log(...args) {
    if (!this.isProduction) {
      console.log(...args);
    }
  }

  static error(...args) {
    console.error(...args); // Always log errors
  }

  static warn(...args) {
    if (!this.isProduction) {
      console.warn(...args);
    }
  }

  // Debounce function for frequent operations
  static debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Throttle function for performance-critical operations
  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Batch DOM operations
  static batchDOMUpdates(operations) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        operations();
        resolve();
      });
    });
  }

  // Memory cleanup utility
  static cleanup = {
    eventListeners: new Map(),
    timeouts: new Set(),
    intervals: new Set(),

    addEventListenerWithCleanup(element, event, handler, options) {
      element.addEventListener(event, handler, options);
      
      const key = `${element.tagName}-${event}-${Date.now()}`;
      this.eventListeners.set(key, { element, event, handler, options });
      
      return key;
    },

    removeEventListener(key) {
      const listener = this.eventListeners.get(key);
      if (listener) {
        listener.element.removeEventListener(listener.event, listener.handler, listener.options);
        this.eventListeners.delete(key);
      }
    },

    setTimeout(callback, delay) {
      const id = setTimeout(callback, delay);
      this.timeouts.add(id);
      return id;
    },

    clearTimeout(id) {
      clearTimeout(id);
      this.timeouts.delete(id);
    },

    setInterval(callback, delay) {
      const id = setInterval(callback, delay);
      this.intervals.add(id);
      return id;
    },

    clearInterval(id) {
      clearInterval(id);
      this.intervals.delete(id);
    },

    // Clean up all registered resources
    cleanupAll() {
      // Clear all event listeners
      this.eventListeners.forEach((listener, key) => {
        this.removeEventListener(key);
      });

      // Clear all timeouts
      this.timeouts.forEach(id => clearTimeout(id));
      this.timeouts.clear();

      // Clear all intervals  
      this.intervals.forEach(id => clearInterval(id));
      this.intervals.clear();
    }
  };

  // Performance monitoring
  static monitor = {
    timings: new Map(),

    start(label) {
      this.timings.set(label, performance.now());
    },

    end(label) {
      const start = this.timings.get(label);
      if (start) {
        const duration = performance.now() - start;
        PerformanceUtils.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        this.timings.delete(label);
        return duration;
      }
      return 0;
    },

    // Monitor API response times
    async wrapAsyncOperation(operation, label) {
      this.start(label);
      try {
        const result = await operation();
        this.end(label);
        return { success: true, data: result };
      } catch (error) {
        this.end(label);
        PerformanceUtils.error(`❌ ${label} failed:`, error);
        return { success: false, error: error.message };
      }
    }
  };

  // Storage optimization
  static storage = {
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    async getCached(key) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
      return null;
    },

    setCached(key, data) {
      this.cache.set(key, {
        data: data,
        timestamp: Date.now()
      });
    },

    clearCache() {
      this.cache.clear();
    },

    // Batch storage operations
    batchOperations: [],

    addToBatch(operation) {
      this.batchOperations.push(operation);
    },

    async executeBatch() {
      if (this.batchOperations.length === 0) return;

      const operations = [...this.batchOperations];
      this.batchOperations = [];

      const results = await Promise.allSettled(operations.map(op => op()));
      return results.map(result => ({
        success: result.status === 'fulfilled',
        data: result.value,
        error: result.reason
      }));
    }
  };
}

// Global cleanup on extension unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    PerformanceUtils.cleanup.cleanupAll();
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceUtils;
}