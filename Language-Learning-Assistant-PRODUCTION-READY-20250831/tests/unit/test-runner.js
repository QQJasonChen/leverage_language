// Simple Test Runner for Extension Modules
class ExtensionTestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  // Add a test case
  test(name, testFunction) {
    this.tests.push({ name, testFunction });
  }

  // Run all tests
  async runAll() {
    console.log('🧪 Starting Extension Unit Tests...\n');
    
    for (const { name, testFunction } of this.tests) {
      await this.runTest(name, testFunction);
    }
    
    this.generateTestReport();
    return this.results;
  }

  // Run individual test
  async runTest(name, testFunction) {
    const startTime = performance.now();
    let result = {
      name,
      passed: false,
      error: null,
      duration: 0
    };
    
    try {
      console.log(`⏳ Running: ${name}`);
      
      await testFunction();
      
      result.passed = true;
      result.duration = performance.now() - startTime;
      
      console.log(`  ✅ ${name} (${result.duration.toFixed(1)}ms)`);
      this.results.passed++;
      
    } catch (error) {
      result.passed = false;
      result.error = error.message;
      result.duration = performance.now() - startTime;
      
      console.log(`  ❌ ${name} - ${error.message} (${result.duration.toFixed(1)}ms)`);
      this.results.failed++;
    }
    
    this.results.total++;
    this.results.details.push(result);
  }

  // Generate test report
  generateTestReport() {
    console.log('\n📊 TEST REPORT');
    console.log('='.repeat(40));
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    const overallPass = this.results.failed === 0;
    console.log(`\n🎯 Overall Result: ${overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  }

  // Assertion helpers
  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message = 'Values are not equal') {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
    }
  }

  assertNotNull(value, message = 'Value is null') {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
  }

  assertType(value, expectedType, message = 'Type mismatch') {
    if (typeof value !== expectedType) {
      throw new Error(`${message}. Expected: ${expectedType}, Actual: ${typeof value}`);
    }
  }
}

// Create global test runner instance
const testRunner = new ExtensionTestRunner();

// Test Suite for Core Modules
testRunner.test('Production Logger Availability', async () => {
  // Check if production logger loads correctly
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('lib/production-logger.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      testRunner.assertNotNull(window.logger || window.ProductionLogger, 'Production logger not available');
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load production logger'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading production logger')), 2000);
  });
});

testRunner.test('Sidepanel Core Module', async () => {
  // Test core module loading and basic functionality
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('modules/sidepanel/sidepanel-core.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      // Check if core module is available
      testRunner.assertNotNull(window.SidepanelCore, 'Sidepanel core not available');
      
      // Check core components
      testRunner.assertNotNull(window.SidepanelCore.languageNames, 'Language names not available');
      testRunner.assertType(window.SidepanelCore.logSafely, 'function', 'LogSafely is not a function');
      testRunner.assertType(window.SidepanelCore.handleError, 'function', 'HandleError is not a function');
      
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load sidepanel core'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading sidepanel core')), 2000);
  });
});

testRunner.test('Storage Module Functionality', async () => {
  // Test storage module
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('modules/sidepanel/sidepanel-storage.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      testRunner.assertNotNull(window.SidepanelStorage, 'Sidepanel storage not available');
      
      // Check storage methods
      testRunner.assertType(window.checkStorageUsage, 'function', 'checkStorageUsage not available');
      testRunner.assertType(window.exportAudioOnly, 'function', 'exportAudioOnly not available');
      
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load storage module'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading storage module')), 2000);
  });
});

testRunner.test('Dashboard Module Functionality', async () => {
  // Test dashboard module
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('modules/sidepanel/sidepanel-dashboard.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      testRunner.assertNotNull(window.SidepanelDashboard, 'Sidepanel dashboard not available');
      
      // Check dashboard methods
      testRunner.assertType(window.recordLearningSearch, 'function', 'recordLearningSearch not available');
      testRunner.assertType(window.updateLearningDashboard, 'function', 'updateLearningDashboard not available');
      
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load dashboard module'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading dashboard module')), 2000);
  });
});

testRunner.test('Auth Module Functionality', async () => {
  // Test auth module
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('modules/sidepanel/sidepanel-auth.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      testRunner.assertNotNull(window.SidepanelAuth, 'Sidepanel auth not available');
      
      // Check auth methods
      testRunner.assertType(window.setupAuthenticationUI, 'function', 'setupAuthenticationUI not available');
      testRunner.assertType(window.SidepanelAuth.isAuthenticated, 'function', 'isAuthenticated not available');
      
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load auth module'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading auth module')), 2000);
  });
});

testRunner.test('Platforms Module Functionality', async () => {
  // Test platforms module
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('modules/sidepanel/sidepanel-platforms.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      testRunner.assertNotNull(window.SidepanelPlatforms, 'Sidepanel platforms not available');
      
      // Check platform methods
      testRunner.assertType(window.checkForYouTubeAnalysis, 'function', 'checkForYouTubeAnalysis not available');
      testRunner.assertType(window.SidepanelPlatforms.detectPlatform, 'function', 'detectPlatform not available');
      
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load platforms module'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading platforms module')), 2000);
  });
});

testRunner.test('Modular Loading System', async () => {
  // Test the modular loading system
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('sidepanel-modular.js');
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      testRunner.assertNotNull(window.ModularSidepanel, 'Modular sidepanel not available');
      
      const modular = window.ModularSidepanel;
      testRunner.assertType(modular.loadModule, 'function', 'loadModule not available');
      testRunner.assertType(modular.getLoadStatus, 'function', 'getLoadStatus not available');
      
      // Check load status
      const status = modular.getLoadStatus();
      testRunner.assertType(status.loadedModules, 'object', 'LoadedModules not available');
      
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load modular system'));
    document.head.appendChild(script);
    
    setTimeout(() => reject(new Error('Timeout loading modular system')), 2000);
  });
});

testRunner.test('Chrome API Availability', async () => {
  // Test Chrome extension APIs
  testRunner.assertNotNull(chrome, 'Chrome API not available');
  testRunner.assertNotNull(chrome.runtime, 'Chrome runtime API not available');
  testRunner.assertNotNull(chrome.storage, 'Chrome storage API not available');
  
  // Test basic API functionality
  testRunner.assertType(chrome.runtime.getURL, 'function', 'getURL not available');
  testRunner.assertType(chrome.storage.local.get, 'function', 'storage.local.get not available');
  
  // Test getting extension URL
  const url = chrome.runtime.getURL('manifest.json');
  testRunner.assert(url.startsWith('chrome-extension://'), 'Invalid extension URL format');
});

// Export test runner
window.ExtensionTestRunner = testRunner;

// Auto-run tests if this script is loaded directly
if (document.readyState === 'complete') {
  // Add a small delay to ensure modules can load
  setTimeout(() => testRunner.runAll(), 1000);
} else {
  window.addEventListener('load', () => {
    setTimeout(() => testRunner.runAll(), 1000);
  });
}