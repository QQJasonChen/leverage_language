// Production Logger - Safe logging for extension
class ProductionLogger {
  constructor() {
    this.isDevelopment = !chrome.runtime.getManifest().name.includes('Production');
    this.logLevel = this.isDevelopment ? 'debug' : 'error';
  }

  log(...args) {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  warn(...args) {
    if (this.isDevelopment) {
      console.warn(...args);
    }
  }

  error(...args) {
    // Always log errors, even in production
    console.error(...args);
  }

  debug(...args) {
    if (this.isDevelopment && this.logLevel === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args) {
    if (this.isDevelopment) {
      console.log('[INFO]', ...args);
    }
  }
}

// Create global instance
const logger = new ProductionLogger();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
}