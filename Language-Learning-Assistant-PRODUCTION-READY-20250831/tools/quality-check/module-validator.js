// Module Validator - Quality Check Tool for Modular Architecture
class ModuleValidator {
  constructor() {
    this.results = {
      modules: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    this.requiredModules = [
      'lib/production-logger.js',
      'modules/sidepanel/sidepanel-core.js',
      'modules/sidepanel/sidepanel-storage.js',
      'modules/sidepanel/sidepanel-dashboard.js',
      'modules/sidepanel/sidepanel-auth.js',
      'modules/sidepanel/sidepanel-platforms.js'
    ];
  }

  // Start validation process
  async validateExtension() {
    console.log('🔍 Starting Extension Quality Validation...\n');
    
    // Check manifest
    await this.validateManifest();
    
    // Check module structure
    await this.validateModuleStructure();
    
    // Check code quality
    await this.validateCodeQuality();
    
    // Check dependencies
    await this.validateDependencies();
    
    // Check performance
    await this.validatePerformance();
    
    // Generate report
    this.generateReport();
    
    return this.results;
  }

  // Validate manifest.json
  async validateManifest() {
    console.log('📋 Validating manifest.json...');
    const result = { passed: true, errors: [], warnings: [] };
    
    try {
      const response = await fetch(chrome.runtime.getURL('manifest.json'));
      const manifest = await response.json();
      
      // Check required fields
      const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          result.errors.push(`Missing required field: ${field}`);
          result.passed = false;
        }
      }
      
      // Check manifest version
      if (manifest.manifest_version !== 3) {
        result.warnings.push('Consider upgrading to Manifest V3');
      }
      
      // Check permissions
      const permissions = manifest.permissions || [];
      const suspiciousPermissions = ['<all_urls>', 'tabs', 'history'];
      for (const perm of suspiciousPermissions) {
        if (permissions.includes(perm)) {
          result.warnings.push(`Broad permission detected: ${perm}`);
        }
      }
      
      console.log('  ✅ Manifest validation completed');
      
    } catch (error) {
      result.errors.push(`Failed to load manifest: ${error.message}`);
      result.passed = false;
    }
    
    this.results.modules['manifest'] = result;
    this.updateSummary(result);
  }

  // Validate module structure
  async validateModuleStructure() {
    console.log('🏗️ Validating module structure...');
    
    for (const modulePath of this.requiredModules) {
      const result = { passed: true, errors: [], warnings: [] };
      
      try {
        // Check if module file exists
        const response = await fetch(chrome.runtime.getURL(modulePath));
        if (!response.ok) {
          result.errors.push(`Module file not found: ${modulePath}`);
          result.passed = false;
          continue;
        }
        
        const moduleCode = await response.text();
        
        // Check module structure
        await this.validateModuleCode(modulePath, moduleCode, result);
        
        console.log(`  ✅ ${modulePath} validated`);
        
      } catch (error) {
        result.errors.push(`Failed to validate ${modulePath}: ${error.message}`);
        result.passed = false;
      }
      
      this.results.modules[modulePath] = result;
      this.updateSummary(result);
    }
  }

  // Validate individual module code
  async validateModuleCode(modulePath, code, result) {
    // Check for class definition
    if (modulePath.includes('sidepanel-')) {
      const className = this.getExpectedClassName(modulePath);
      if (!code.includes(`class ${className}`)) {
        result.warnings.push(`Missing expected class: ${className}`);
      }
    }
    
    // Check for proper exports
    if (!code.includes('window.') && !code.includes('module.exports')) {
      result.warnings.push('Module may not be properly exported');
    }
    
    // Check for error handling
    if (!code.includes('try') && !code.includes('catch')) {
      result.warnings.push('No error handling detected');
    }
    
    // Check for console.log usage (should use logger)
    const consoleMatches = code.match(/console\.(log|warn|error)/g);
    if (consoleMatches && consoleMatches.length > 5) {
      result.warnings.push(`${consoleMatches.length} console statements found (should use production logger)`);
    }
    
    // Check for TODO/FIXME comments
    const todoMatches = code.match(/TODO|FIXME|BUG|HACK/g);
    if (todoMatches) {
      result.warnings.push(`${todoMatches.length} TODO/FIXME comments found`);
    }
    
    // Check file size
    const sizeKB = (code.length / 1024).toFixed(1);
    if (code.length > 50000) { // 50KB threshold
      result.warnings.push(`Large module size: ${sizeKB}KB`);
    }
  }

  // Get expected class name from module path
  getExpectedClassName(modulePath) {
    const fileName = modulePath.split('/').pop().replace('.js', '');
    return fileName.split('-').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
  }

  // Validate code quality
  async validateCodeQuality() {
    console.log('🎯 Validating code quality...');
    const result = { passed: true, errors: [], warnings: [] };
    
    try {
      // Check for modular loading
      const modularResponse = await fetch(chrome.runtime.getURL('sidepanel-modular.js'));
      if (modularResponse.ok) {
        const modularCode = await modularResponse.text();
        
        // Check modular architecture implementation
        if (!modularCode.includes('loadModule')) {
          result.warnings.push('Modular loading mechanism not found');
        }
        
        if (!modularCode.includes('initializeModules')) {
          result.warnings.push('Module initialization not found');
        }
        
        console.log('  ✅ Modular architecture validated');
      } else {
        result.errors.push('Modular architecture file not found');
        result.passed = false;
      }
      
    } catch (error) {
      result.errors.push(`Code quality check failed: ${error.message}`);
      result.passed = false;
    }
    
    this.results.modules['code-quality'] = result;
    this.updateSummary(result);
  }

  // Validate dependencies
  async validateDependencies() {
    console.log('🔗 Validating dependencies...');
    const result = { passed: true, errors: [], warnings: [] };
    
    try {
      // Check if all required libraries are available
      const requiredGlobals = ['chrome', 'window', 'document'];
      for (const global of requiredGlobals) {
        if (typeof window[global] === 'undefined') {
          result.errors.push(`Required global not available: ${global}`);
          result.passed = false;
        }
      }
      
      // Check Chrome API availability
      const requiredAPIs = ['chrome.runtime', 'chrome.storage', 'chrome.tabs'];
      for (const api of requiredAPIs) {
        const apiParts = api.split('.');
        let current = window;
        for (const part of apiParts) {
          if (!current[part]) {
            result.errors.push(`Chrome API not available: ${api}`);
            result.passed = false;
            break;
          }
          current = current[part];
        }
      }
      
      console.log('  ✅ Dependencies validated');
      
    } catch (error) {
      result.errors.push(`Dependency check failed: ${error.message}`);
      result.passed = false;
    }
    
    this.results.modules['dependencies'] = result;
    this.updateSummary(result);
  }

  // Validate performance
  async validatePerformance() {
    console.log('⚡ Validating performance...');
    const result = { passed: true, errors: [], warnings: [] };
    
    try {
      // Measure module load times
      const loadTimes = {};
      
      for (const modulePath of this.requiredModules) {
        const startTime = performance.now();
        
        try {
          const response = await fetch(chrome.runtime.getURL(modulePath));
          await response.text();
          
          const loadTime = performance.now() - startTime;
          loadTimes[modulePath] = loadTime;
          
          if (loadTime > 100) { // 100ms threshold
            result.warnings.push(`Slow module load: ${modulePath} (${loadTime.toFixed(1)}ms)`);
          }
        } catch (error) {
          result.warnings.push(`Failed to measure load time for ${modulePath}`);
        }
      }
      
      // Calculate total load time
      const totalLoadTime = Object.values(loadTimes).reduce((sum, time) => sum + time, 0);
      console.log(`  📊 Total module load time: ${totalLoadTime.toFixed(1)}ms`);
      
      if (totalLoadTime > 500) { // 500ms threshold
        result.warnings.push(`Total load time high: ${totalLoadTime.toFixed(1)}ms`);
      }
      
      console.log('  ✅ Performance validation completed');
      
    } catch (error) {
      result.errors.push(`Performance check failed: ${error.message}`);
      result.passed = false;
    }
    
    this.results.modules['performance'] = result;
    this.updateSummary(result);
  }

  // Update summary statistics
  updateSummary(result) {
    this.results.summary.total++;
    if (result.passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    if (result.warnings && result.warnings.length > 0) {
      this.results.summary.warnings += result.warnings.length;
    }
  }

  // Generate validation report
  generateReport() {
    console.log('\n📊 VALIDATION REPORT');
    console.log('='.repeat(50));
    
    // Summary
    console.log(`📋 Summary:`);
    console.log(`   Total Modules: ${this.results.summary.total}`);
    console.log(`   ✅ Passed: ${this.results.summary.passed}`);
    console.log(`   ❌ Failed: ${this.results.summary.failed}`);
    console.log(`   ⚠️  Warnings: ${this.results.summary.warnings}`);
    
    // Overall status
    const overallPass = this.results.summary.failed === 0;
    console.log(`\n🎯 Overall Status: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
    
    // Detailed results
    console.log('\n📝 Detailed Results:');
    for (const [module, result] of Object.entries(this.results.modules)) {
      console.log(`\n${result.passed ? '✅' : '❌'} ${module}`);
      
      if (result.errors && result.errors.length > 0) {
        console.log('   Errors:');
        result.errors.forEach(error => console.log(`     ❌ ${error}`));
      }
      
      if (result.warnings && result.warnings.length > 0) {
        console.log('   Warnings:');
        result.warnings.forEach(warning => console.log(`     ⚠️  ${warning}`));
      }
    }
    
    // Recommendations
    this.generateRecommendations();
    
    // Export report
    this.exportReport();
  }

  // Generate recommendations
  generateRecommendations() {
    console.log('\n💡 RECOMMENDATIONS');
    console.log('='.repeat(50));
    
    const recommendations = [];
    
    if (this.results.summary.warnings > 10) {
      recommendations.push('Consider addressing the warnings to improve code quality');
    }
    
    if (this.results.summary.failed > 0) {
      recommendations.push('Fix failing modules before deployment');
    }
    
    // Performance recommendations
    const perfResult = this.results.modules['performance'];
    if (perfResult && perfResult.warnings && perfResult.warnings.length > 0) {
      recommendations.push('Optimize module loading for better performance');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Great job! Your extension passes all quality checks');
    }
    
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }

  // Export detailed report
  exportReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      modules: this.results.modules,
      metadata: {
        validator_version: '1.0.0',
        total_modules_checked: this.requiredModules.length
      }
    };
    
    // In browser context, we'll log the JSON for manual export
    console.log('\n📤 Detailed Report (JSON):');
    console.log(JSON.stringify(reportData, null, 2));
  }
}

// Make validator globally available
window.ModuleValidator = ModuleValidator;

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleValidator;
}