// Integration Tests for Extension Workflow
class IntegrationTestSuite {
  constructor() {
    this.testResults = [];
    this.setupTime = 0;
  }

  async runIntegrationTests() {
    console.log('🔧 Starting Integration Tests...\n');
    
    const startTime = performance.now();
    
    // Setup test environment
    await this.setupTestEnvironment();
    
    // Run integration test scenarios
    await this.testModuleInitialization();
    await this.testMessageRouting();
    await this.testStorageOperations();
    await this.testLearningWorkflow();
    await this.testAuthenticationFlow();
    await this.testPlatformHandling();
    
    this.setupTime = performance.now() - startTime;
    
    // Generate integration report
    this.generateIntegrationReport();
    
    return this.testResults;
  }

  async setupTestEnvironment() {
    console.log('⚙️ Setting up test environment...');
    
    // Mock Chrome APIs if needed
    if (!window.chrome) {
      window.chrome = this.createChromeMock();
    }
    
    // Initialize test data
    await this.initializeTestData();
    
    console.log('  ✅ Test environment ready');
  }

  createChromeMock() {
    return {
      runtime: {
        getURL: (path) => `chrome-extension://test/${path}`,
        onMessage: {
          addListener: (callback) => {
            window._mockMessageListeners = window._mockMessageListeners || [];
            window._mockMessageListeners.push(callback);
          }
        }
      },
      storage: {
        local: {
          get: async (keys) => {
            return window._mockStorage || {};
          },
          set: async (data) => {
            window._mockStorage = { ...(window._mockStorage || {}), ...data };
          },
          remove: async (keys) => {
            if (window._mockStorage) {
              const keysArray = Array.isArray(keys) ? keys : [keys];
              keysArray.forEach(key => delete window._mockStorage[key]);
            }
          }
        },
        sync: {
          get: async (keys) => window._mockStorage || {},
          set: async (data) => {
            window._mockStorage = { ...(window._mockStorage || {}), ...data };
          }
        }
      }
    };
  }

  async initializeTestData() {
    // Initialize mock storage with test data
    window._mockStorage = {
      learningStats: {
        totalSearches: 5,
        todaySearches: 2,
        recentActivity: [
          {
            text: 'Hello world',
            language: 'english',
            url: 'https://youtube.com/test',
            title: 'Test Video',
            platform: 'youtube',
            timestamp: new Date().toISOString()
          }
        ],
        topVocabulary: [
          { word: 'hello', count: 3, language: 'english' },
          { word: 'world', count: 2, language: 'english' }
        ]
      }
    };
  }

  async testModuleInitialization() {
    const testName = 'Module Initialization';
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      // Test modular sidepanel initialization
      await this.loadScript('sidepanel-modular.js');
      
      // Wait for initialization
      await this.waitForCondition(() => window.ModularSidepanel, 5000);
      
      const modular = window.ModularSidepanel;
      const status = modular.getLoadStatus();
      
      // Verify initialization
      this.assert(modular.isInitialized, 'Modular sidepanel should be initialized');
      this.assert(status.loadedModules.length > 0, 'Some modules should be loaded');
      
      console.log(`  ✅ ${testName} passed`);
      this.testResults.push({ name: testName, passed: true });
      
    } catch (error) {
      console.log(`  ❌ ${testName} failed: ${error.message}`);
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }

  async testMessageRouting() {
    const testName = 'Message Routing';
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      // Load core module
      await this.loadScript('modules/sidepanel/sidepanel-core.js');
      
      // Wait for core to be available
      await this.waitForCondition(() => window.SidepanelCore, 3000);
      
      // Test message router
      const router = window.SidepanelCore.messageRouter;
      this.assert(router, 'Message router should be available');
      
      // Test handler registration
      let testHandlerCalled = false;
      router.registerHandler('test-action', () => {
        testHandlerCalled = true;
        return { success: true };
      });
      
      // Simulate message
      await router.handleMessage({ action: 'test-action' }, null, () => {});
      
      this.assert(testHandlerCalled, 'Test handler should be called');
      
      console.log(`  ✅ ${testName} passed`);
      this.testResults.push({ name: testName, passed: true });
      
    } catch (error) {
      console.log(`  ❌ ${testName} failed: ${error.message}`);
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }

  async testStorageOperations() {
    const testName = 'Storage Operations';
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      // Load storage module
      await this.loadScript('modules/sidepanel/sidepanel-storage.js');
      
      // Wait for storage to be available
      await this.waitForCondition(() => window.SidepanelStorage, 3000);
      
      const storage = window.SidepanelStorage;
      
      // Test storage stats check
      const stats = await storage.checkStorageUsage();
      // Should handle gracefully even if storage manager isn't fully initialized
      
      console.log(`  ✅ ${testName} passed`);
      this.testResults.push({ name: testName, passed: true });
      
    } catch (error) {
      console.log(`  ❌ ${testName} failed: ${error.message}`);
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }

  async testLearningWorkflow() {
    const testName = 'Learning Workflow';
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      // Load dashboard module
      await this.loadScript('modules/sidepanel/sidepanel-dashboard.js');
      
      // Wait for dashboard to be available
      await this.waitForCondition(() => window.SidepanelDashboard, 3000);
      
      const dashboard = window.SidepanelDashboard;
      
      // Test learning search recording
      dashboard.recordLearningSearch(
        'Integration test text',
        'english',
        'https://youtube.com/test',
        'Test Video',
        'youtube'
      );
      
      // Test stats retrieval
      const stats = dashboard.getStats();
      this.assert(stats.totalSearches > 0, 'Should have recorded searches');
      
      console.log(`  ✅ ${testName} passed`);
      this.testResults.push({ name: testName, passed: true });
      
    } catch (error) {
      console.log(`  ❌ ${testName} failed: ${error.message}`);
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }

  async testAuthenticationFlow() {
    const testName = 'Authentication Flow';
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      // Load auth module
      await this.loadScript('modules/sidepanel/sidepanel-auth.js');
      
      // Wait for auth to be available
      await this.waitForCondition(() => window.SidepanelAuth, 3000);
      
      const auth = window.SidepanelAuth;
      
      // Test authentication state
      const isAuthenticated = auth.isAuthenticated();
      this.assert(typeof isAuthenticated === 'boolean', 'Authentication status should be boolean');
      
      const hasPremium = auth.hasPremium();
      this.assert(typeof hasPremium === 'boolean', 'Premium status should be boolean');
      
      console.log(`  ✅ ${testName} passed`);
      this.testResults.push({ name: testName, passed: true });
      
    } catch (error) {
      console.log(`  ❌ ${testName} failed: ${error.message}`);
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }

  async testPlatformHandling() {
    const testName = 'Platform Handling';
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      // Load platforms module
      await this.loadScript('modules/sidepanel/sidepanel-platforms.js');
      
      // Wait for platforms to be available
      await this.waitForCondition(() => window.SidepanelPlatforms, 3000);
      
      const platforms = window.SidepanelPlatforms;
      
      // Test platform detection
      const youtubePlatform = platforms.detectPlatform('https://youtube.com/watch?v=123');
      this.assertEqual(youtubePlatform, 'youtube', 'Should detect YouTube platform');
      
      const netflixPlatform = platforms.detectPlatform('https://netflix.com/watch/123');
      this.assertEqual(netflixPlatform, 'netflix', 'Should detect Netflix platform');
      
      console.log(`  ✅ ${testName} passed`);
      this.testResults.push({ name: testName, passed: true });
      
    } catch (error) {
      console.log(`  ❌ ${testName} failed: ${error.message}`);
      this.testResults.push({ name: testName, passed: false, error: error.message });
    }
  }

  // Helper methods
  async loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async waitForCondition(condition, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timeout waiting for condition');
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
    }
  }

  generateIntegrationReport() {
    console.log('\n📊 INTEGRATION TEST REPORT');
    console.log('='.repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`📋 Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   🕐 Setup Time: ${this.setupTime.toFixed(1)}ms`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    const overallPass = failedTests === 0;
    console.log(`\n🎯 Overall Result: ${overallPass ? '✅ ALL INTEGRATION TESTS PASSED' : '❌ SOME INTEGRATION TESTS FAILED'}`);
    
    // Export detailed results
    console.log('\n📤 Detailed Results:');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { totalTests, passedTests, failedTests, setupTime: this.setupTime },
      results: this.testResults
    }, null, 2));
  }
}

// Make integration test suite globally available
window.IntegrationTestSuite = IntegrationTestSuite;

// Auto-run integration tests if loaded directly
if (window.location.pathname.includes('integration-tests')) {
  const integrationTests = new IntegrationTestSuite();
  integrationTests.runIntegrationTests();
}