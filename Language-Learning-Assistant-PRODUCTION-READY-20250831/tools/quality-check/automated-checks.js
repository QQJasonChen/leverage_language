// Automated Quality Checks - Run before deployment
class AutomatedQualityChecker {
  constructor() {
    this.checkResults = {
      codeQuality: null,
      security: null,
      performance: null,
      compatibility: null,
      deployment: null
    };
    this.overallScore = 0;
  }

  // Run all automated checks
  async runAllChecks() {
    console.log('🔍 Starting Automated Quality Checks...\n');
    
    const startTime = performance.now();
    
    await this.checkCodeQuality();
    await this.checkSecurity();
    await this.checkPerformance();
    await this.checkCompatibility();
    await this.checkDeploymentReadiness();
    
    const totalTime = performance.now() - startTime;
    
    this.calculateOverallScore();
    this.generateFinalReport(totalTime);
    
    return {
      score: this.overallScore,
      results: this.checkResults,
      recommendation: this.getRecommendation()
    };
  }

  // Code Quality Checks
  async checkCodeQuality() {
    console.log('📝 Checking Code Quality...');
    const result = { passed: true, score: 100, issues: [] };
    
    try {
      // Check for proper module structure
      const moduleFiles = [
        'modules/sidepanel/sidepanel-core.js',
        'modules/sidepanel/sidepanel-storage.js',
        'modules/sidepanel/sidepanel-dashboard.js',
        'modules/sidepanel/sidepanel-auth.js',
        'modules/sidepanel/sidepanel-platforms.js'
      ];
      
      for (const file of moduleFiles) {
        const response = await fetch(chrome.runtime.getURL(file));
        if (!response.ok) {
          result.issues.push(`Missing module: ${file}`);
          result.score -= 15;
          continue;
        }
        
        const code = await response.text();
        
        // Check for console.log usage
        const consoleCount = (code.match(/console\.(log|warn)/g) || []).length;
        if (consoleCount > 3) {
          result.issues.push(`${file}: ${consoleCount} console statements (should use logger)`);
          result.score -= 5;
        }
        
        // Check for error handling
        if (!code.includes('try') || !code.includes('catch')) {
          result.issues.push(`${file}: No error handling detected`);
          result.score -= 10;
        }
        
        // Check for proper exports
        if (!code.includes('window.') && !code.includes('module.exports')) {
          result.issues.push(`${file}: No proper exports found`);
          result.score -= 5;
        }
      }
      
      // Check for production logger usage
      const loggerResponse = await fetch(chrome.runtime.getURL('lib/production-logger.js'));
      if (!loggerResponse.ok) {
        result.issues.push('Production logger not found');
        result.score -= 20;
      }
      
      console.log(`  ✅ Code quality: ${result.score}/100`);
      
    } catch (error) {
      result.issues.push(`Code quality check failed: ${error.message}`);
      result.score = 0;
      result.passed = false;
    }
    
    this.checkResults.codeQuality = result;
  }

  // Security Checks
  async checkSecurity() {
    console.log('🔒 Checking Security...');
    const result = { passed: true, score: 100, issues: [] };
    
    try {
      // Check manifest permissions
      const manifestResponse = await fetch(chrome.runtime.getURL('manifest.json'));
      const manifest = await manifestResponse.json();
      
      const permissions = manifest.permissions || [];
      const hostPermissions = manifest.host_permissions || [];
      
      // Check for overly broad permissions
      if (permissions.includes('<all_urls>')) {
        result.issues.push('Broad permission: <all_urls>');
        result.score -= 30;
      }
      
      if (permissions.includes('tabs')) {
        result.issues.push('Broad permission: tabs');
        result.score -= 15;
      }
      
      // Check host permissions
      const suspiciousHosts = hostPermissions.filter(host => 
        host.includes('*://*/*') || host.includes('<all_urls>')
      );
      if (suspiciousHosts.length > 0) {
        result.issues.push(`Broad host permissions: ${suspiciousHosts.join(', ')}`);
        result.score -= 20;
      }
      
      // Check for security utilities
      const securityResponse = await fetch(chrome.runtime.getURL('lib/security-utils.js'));
      if (!securityResponse.ok) {
        result.issues.push('Security utilities not found');
        result.score -= 25;
      } else {
        const securityCode = await securityResponse.text();
        
        // Check for XSS protection
        if (!securityCode.includes('innerHTML') || !securityCode.includes('sanitiz')) {
          result.issues.push('XSS protection may be insufficient');
          result.score -= 15;
        }
        
        // Check for input validation
        if (!securityCode.includes('validate')) {
          result.issues.push('Input validation functions not found');
          result.score -= 10;
        }
      }
      
      console.log(`  ✅ Security: ${result.score}/100`);
      
    } catch (error) {
      result.issues.push(`Security check failed: ${error.message}`);
      result.score = 0;
      result.passed = false;
    }
    
    this.checkResults.security = result;
  }

  // Performance Checks
  async checkPerformance() {
    console.log('⚡ Checking Performance...');
    const result = { passed: true, score: 100, issues: [], metrics: {} };
    
    try {
      const loadTimes = {};
      const fileSizes = {};
      
      // Check module load times and sizes
      const moduleFiles = [
        'sidepanel-modular.js',
        'lib/production-logger.js',
        'modules/sidepanel/sidepanel-core.js'
      ];
      
      for (const file of moduleFiles) {
        const startTime = performance.now();
        const response = await fetch(chrome.runtime.getURL(file));
        const loadTime = performance.now() - startTime;
        
        if (response.ok) {
          const text = await response.text();
          const sizeKB = (text.length / 1024).toFixed(1);
          
          loadTimes[file] = loadTime;
          fileSizes[file] = parseFloat(sizeKB);
          
          // Check load time
          if (loadTime > 50) {
            result.issues.push(`${file}: Slow load time ${loadTime.toFixed(1)}ms`);
            result.score -= 10;
          }
          
          // Check file size
          if (parseFloat(sizeKB) > 100) {
            result.issues.push(`${file}: Large file size ${sizeKB}KB`);
            result.score -= 10;
          }
        }
      }
      
      // Check for old monolithic file
      try {
        const sidepanelResponse = await fetch(chrome.runtime.getURL('sidepanel.js'));
        if (sidepanelResponse.ok) {
          const sidepanelText = await sidepanelResponse.text();
          const sidepanelSizeKB = (sidepanelText.length / 1024).toFixed(1);
          
          if (parseFloat(sidepanelSizeKB) > 200) {
            result.issues.push(`Legacy sidepanel.js is still large: ${sidepanelSizeKB}KB`);
            result.score -= 20;
          }
        }
      } catch (e) {
        // It's okay if the old file doesn't exist
      }
      
      result.metrics = { loadTimes, fileSizes };
      
      console.log(`  ✅ Performance: ${result.score}/100`);
      
    } catch (error) {
      result.issues.push(`Performance check failed: ${error.message}`);
      result.score = 0;
      result.passed = false;
    }
    
    this.checkResults.performance = result;
  }

  // Compatibility Checks
  async checkCompatibility() {
    console.log('🔄 Checking Compatibility...');
    const result = { passed: true, score: 100, issues: [] };
    
    try {
      // Check manifest version
      const manifestResponse = await fetch(chrome.runtime.getURL('manifest.json'));
      const manifest = await manifestResponse.json();
      
      if (manifest.manifest_version !== 3) {
        result.issues.push('Not using Manifest V3');
        result.score -= 30;
      }
      
      // Check for deprecated APIs
      const deprecatedAPIs = [
        'chrome.extension.',
        'chrome.app.',
        'webkitRequestFileSystem'
      ];
      
      const coreFiles = [
        'background.js',
        'content.js',
        'sidepanel-modular.js'
      ];
      
      for (const file of coreFiles) {
        try {
          const response = await fetch(chrome.runtime.getURL(file));
          if (response.ok) {
            const code = await response.text();
            
            for (const api of deprecatedAPIs) {
              if (code.includes(api)) {
                result.issues.push(`${file}: Uses deprecated API ${api}`);
                result.score -= 15;
              }
            }
          }
        } catch (e) {
          // File might not exist, continue
        }
      }
      
      // Check Chrome API usage
      const requiredAPIs = ['chrome.runtime', 'chrome.storage', 'chrome.tabs'];
      for (const api of requiredAPIs) {
        if (!this.checkAPIAvailability(api)) {
          result.issues.push(`Required API not available: ${api}`);
          result.score -= 20;
        }
      }
      
      console.log(`  ✅ Compatibility: ${result.score}/100`);
      
    } catch (error) {
      result.issues.push(`Compatibility check failed: ${error.message}`);
      result.score = 0;
      result.passed = false;
    }
    
    this.checkResults.compatibility = result;
  }

  // Deployment Readiness Checks
  async checkDeploymentReadiness() {
    console.log('🚀 Checking Deployment Readiness...');
    const result = { passed: true, score: 100, issues: [] };
    
    try {
      // Check for test files in production build
      const testFiles = [
        'test-runner.html',
        'tests/unit/test-runner.js',
        'tests/integration/integration-tests.js'
      ];
      
      // In production, test files should not be accessible
      // For now, we'll just warn if they exist
      for (const file of testFiles) {
        try {
          const response = await fetch(chrome.runtime.getURL(file));
          if (response.ok) {
            result.issues.push(`Test file accessible in production: ${file}`);
            result.score -= 5;
          }
        } catch (e) {
          // Good, test file not accessible
        }
      }
      
      // Check for debug code
      const productionFiles = [
        'background.js',
        'sidepanel-modular.js',
        'lib/production-logger.js'
      ];
      
      for (const file of productionFiles) {
        try {
          const response = await fetch(chrome.runtime.getURL(file));
          if (response.ok) {
            const code = await response.text();
            
            // Check for debug statements
            const debugCount = (code.match(/console\.(log|debug)/g) || []).length;
            if (debugCount > 2) {
              result.issues.push(`${file}: ${debugCount} debug statements in production`);
              result.score -= 5;
            }
            
            // Check for TODO comments
            const todoCount = (code.match(/TODO|FIXME|HACK/g) || []).length;
            if (todoCount > 0) {
              result.issues.push(`${file}: ${todoCount} TODO comments remaining`);
              result.score -= 3;
            }
          }
        } catch (e) {
          // File might not exist
        }
      }
      
      // Check version consistency
      const manifestResponse = await fetch(chrome.runtime.getURL('manifest.json'));
      const manifest = await manifestResponse.json();
      
      if (!manifest.version || !manifest.version.match(/^\d+\.\d+\.\d+/)) {
        result.issues.push('Invalid or missing version number');
        result.score -= 20;
      }
      
      console.log(`  ✅ Deployment readiness: ${result.score}/100`);
      
    } catch (error) {
      result.issues.push(`Deployment check failed: ${error.message}`);
      result.score = 0;
      result.passed = false;
    }
    
    this.checkResults.deployment = result;
  }

  // Helper method to check API availability
  checkAPIAvailability(apiPath) {
    const parts = apiPath.split('.');
    let current = window;
    
    for (const part of parts) {
      if (!current[part]) {
        return false;
      }
      current = current[part];
    }
    
    return true;
  }

  // Calculate overall score
  calculateOverallScore() {
    const weights = {
      codeQuality: 0.25,
      security: 0.3,
      performance: 0.2,
      compatibility: 0.15,
      deployment: 0.1
    };
    
    let totalScore = 0;
    
    for (const [category, weight] of Object.entries(weights)) {
      const result = this.checkResults[category];
      if (result && result.score !== null) {
        totalScore += result.score * weight;
      }
    }
    
    this.overallScore = Math.round(totalScore);
  }

  // Get deployment recommendation
  getRecommendation() {
    if (this.overallScore >= 95) {
      return 'READY FOR DEPLOYMENT - Excellent quality!';
    } else if (this.overallScore >= 85) {
      return 'READY FOR DEPLOYMENT - Minor issues should be addressed';
    } else if (this.overallScore >= 70) {
      return 'NEEDS IMPROVEMENT - Address major issues before deployment';
    } else {
      return 'NOT READY - Significant issues must be fixed';
    }
  }

  // Generate final report
  generateFinalReport(totalTime) {
    console.log('\n🎯 AUTOMATED QUALITY REPORT');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Check Time: ${totalTime.toFixed(1)}ms`);
    console.log(`📊 Overall Score: ${this.overallScore}/100`);
    console.log(`🚀 Recommendation: ${this.getRecommendation()}`);
    
    console.log('\n📋 Category Breakdown:');
    for (const [category, result] of Object.entries(this.checkResults)) {
      if (result) {
        console.log(`  ${category}: ${result.score}/100 ${result.passed ? '✅' : '❌'}`);
        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            console.log(`    - ${issue}`);
          });
        }
      }
    }
    
    console.log('\n💡 Next Steps:');
    if (this.overallScore >= 95) {
      console.log('• Your extension is ready for production deployment!');
      console.log('• Consider setting up automated CI/CD pipeline');
    } else if (this.overallScore >= 85) {
      console.log('• Address minor issues listed above');
      console.log('• Run tests one more time before deployment');
    } else {
      console.log('• Fix major issues before proceeding');
      console.log('• Run quality checks again after fixes');
      console.log('• Consider additional testing');
    }
    
    // Export detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      overallScore: this.overallScore,
      recommendation: this.getRecommendation(),
      checkResults: this.checkResults,
      totalTime: totalTime
    };
    
    console.log('\n📤 Detailed Report (JSON):');
    console.log(JSON.stringify(reportData, null, 2));
  }
}

// Make automated checker globally available
window.AutomatedQualityChecker = AutomatedQualityChecker;

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutomatedQualityChecker;
}