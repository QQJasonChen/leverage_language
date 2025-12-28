// Script to batch update console.log statements to use production logger
// This script replaces console.log/warn/error with logger equivalents

const fs = require('fs');
const path = require('path');

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip files that already use production logger
    if (content.includes('production-logger.js') || filePath.includes('production-logger.js')) {
      console.log(`Skipping ${filePath} - already updated or is logger itself`);
      return false;
    }
    
    let modified = false;
    const originalContent = content;
    
    // Add logger import at the top (for content scripts and other JS files)
    if (!content.includes('importScripts') && !content.includes('logger')) {
      const loggerImport = `// Import production logger
if (typeof logger === 'undefined') {
  try {
    if (typeof importScripts !== 'undefined') {
      importScripts('./lib/production-logger.js');
    } else {
      // For content scripts, load logger differently
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('lib/production-logger.js');
      document.head.appendChild(script);
    }
  } catch (e) {
    console.warn('Could not load production logger:', e);
  }
}

`;
      content = loggerImport + content;
      modified = true;
    }
    
    // Replace console statements with logger equivalents
    content = content.replace(
      /console\.log\(/g, 
      '(typeof logger !== "undefined" ? logger.log : console.log)('
    );
    
    content = content.replace(
      /console\.warn\(/g, 
      '(typeof logger !== "undefined" ? logger.warn : console.warn)('
    );
    
    content = content.replace(
      /console\.error\(/g, 
      '(typeof logger !== "undefined" ? logger.error : console.error)('
    );
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Get all JS files
const jsFiles = [
  'background.js',
  'content.js', 
  'sidepanel.js',
  'options.js'
];

// Update each file
let updatedCount = 0;
jsFiles.forEach(file => {
  if (updateFile(file)) {
    updatedCount++;
  }
});

console.log(`\n📊 Summary: Updated ${updatedCount} files`);