// Modular Sidepanel Entry Point
// This file replaces the monolithic sidepanel.js with a modular approach

class ModularSidepanel {
  constructor() {
    this.modules = [];
    this.isInitialized = false;
    this.loadedModules = new Set();
  }

  // Load a module dynamically
  async loadModule(modulePath) {
    return new Promise((resolve, reject) => {
      if (this.loadedModules.has(modulePath)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(modulePath);
      script.onload = () => {
        this.loadedModules.add(modulePath);
        console.log(`✅ Loaded module: ${modulePath}`);
        resolve();
      };
      script.onerror = (error) => {
        console.error(`❌ Failed to load module: ${modulePath}`, error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  // Initialize all core modules
  async initializeModules() {
    try {
      console.log('🚀 Initializing modular sidepanel...');

      // Load core modules in order
      const coreModules = [
        'lib/production-logger.js',
        'modules/sidepanel/sidepanel-core.js',
        'modules/sidepanel/sidepanel-storage.js'
      ];

      // Load core modules first
      for (const modulePath of coreModules) {
        await this.loadModule(modulePath);
      }

      // Wait for DOM to be ready
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          window.addEventListener('load', resolve);
        });
      }

      // Initialize module instances
      await this.initializeModuleInstances();

      this.isInitialized = true;
      console.log('✅ Modular sidepanel initialized successfully');
      
      // Dispatch initialization complete event
      document.dispatchEvent(new CustomEvent('sidepanelReady'));

    } catch (error) {
      console.error('❌ Failed to initialize modular sidepanel:', error);
    }
  }

  // Initialize instances of loaded modules
  async initializeModuleInstances() {
    // Core utilities should already be available
    if (typeof window.SidepanelCore !== 'undefined') {
      console.log('✅ Core utilities loaded');
    }

    // Storage manager should be ready
    if (typeof window.SidepanelStorage !== 'undefined') {
      console.log('✅ Storage manager loaded');
    }

    // Initialize any additional module setup here
  }

  // Load additional modules on demand
  async loadOnDemandModule(moduleName) {
    const moduleMap = {
      'dashboard': 'modules/sidepanel/sidepanel-dashboard.js',
      'auth': 'modules/sidepanel/sidepanel-auth.js',
      'platforms': 'modules/sidepanel/sidepanel-platforms.js'
    };

    const modulePath = moduleMap[moduleName];
    if (modulePath && !this.loadedModules.has(modulePath)) {
      await this.loadModule(modulePath);
      return true;
    }
    return false;
  }

  // Load all feature modules
  async loadAllModules() {
    try {
      console.log('📦 Loading all feature modules...');
      
      const featureModules = [
        'dashboard',
        'auth', 
        'platforms'
      ];

      // Load all feature modules
      for (const moduleName of featureModules) {
        await this.loadOnDemandModule(moduleName);
      }

      console.log('✅ All feature modules loaded');
      
      // Dispatch all modules loaded event
      document.dispatchEvent(new CustomEvent('allModulesLoaded'));
      
    } catch (error) {
      console.error('❌ Failed to load all modules:', error);
    }
  }

  // Get module load status
  getLoadStatus() {
    return {
      initialized: this.isInitialized,
      loadedModules: Array.from(this.loadedModules),
      totalModules: this.loadedModules.size
    };
  }
}

// Initialize modular sidepanel
const modularSidepanel = new ModularSidepanel();

// Auto-initialize when script loads
modularSidepanel.initializeModules().then(() => {
  console.log('🎉 Modular sidepanel is ready!');
  
  // Load all feature modules after core initialization
  return modularSidepanel.loadAllModules();
}).then(() => {
  console.log('🚀 All modules fully loaded and ready!');
}).catch(error => {
  console.error('💥 Modular sidepanel initialization failed:', error);
});

// Make it globally available for debugging
window.ModularSidepanel = modularSidepanel;

// Legacy support - load remaining functions from original sidepanel.js if needed
window.loadLegacyFunctions = async () => {
  try {
    // This would load the remaining parts of the original sidepanel.js
    // For now, we'll implement the most critical functions here
    console.log('📦 Loading legacy functions...');
    
    // Placeholder for critical functions that haven't been modularized yet
    window.showMessage = window.showMessage || function(text, type = 'info') {
      console.log(`[${type.toUpperCase()}] ${text}`);
    };
    
    window.loadYouGlish = window.loadYouGlish || function(url, text, language) {
      console.log('🔍 Loading YouGlish:', { url, text, language });
    };
    
    console.log('✅ Legacy functions loaded');
  } catch (error) {
    console.error('❌ Failed to load legacy functions:', error);
  }
};