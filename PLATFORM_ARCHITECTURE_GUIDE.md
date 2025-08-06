# Platform Architecture Guide for Language Learning Extension

## 📋 Overview

This guide documents the proven architecture patterns for adding new platforms to our Chrome extension. Our current implementation supports **YouTube**, **Netflix**, and **Udemy** with consistent patterns that make adding new platforms straightforward and reliable.

## 🏗️ Core Architecture Patterns

### 1. Standard Content Script Structure

Every platform follows this proven IIFE (Immediately Invoked Function Expression) pattern:

```javascript
// template-content.js - Replace 'template' with your platform name
(function() {
  'use strict';
  
  console.log('🎬 [Platform Name] Language Learning Extension loaded');
  
  // ===== STATE MANAGEMENT =====
  let isCollecting = false;
  let collectedSegments = [];
  let collectionStartTime = null;
  let currentVideoInfo = null;
  let lastSubtitle = '';
  let lastSubtitleTime = 0;
  
  // ===== REQUIRED CORE FUNCTIONS =====
  
  // Extract platform-specific video/content ID
  function extractVideoId() {
    // Platform-specific URL pattern matching
    const match = window.location.href.match(/your-platform-pattern/);
    return match ? match[1] : null;
  }
  
  // Get content title using platform-specific selectors
  function getContentTitle() {
    const selectors = [
      '[data-testid="title"]',        // Primary
      '.video-title h1',              // Secondary  
      'h1'                            // Fallback
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return 'Platform Content'; // Default fallback
  }
  
  // Get current video timestamp
  function getCurrentTimestamp() {
    const videoSelectors = [
      'video[data-testid="video-player"]', // Platform-specific
      'video',                              // Generic fallback
    ];
    
    for (const selector of videoSelectors) {
      const video = document.querySelector(selector);
      if (video && !isNaN(video.currentTime)) {
        return Math.floor(video.currentTime);
      }
    }
    return 0;
  }
  
  // Core subtitle capture function
  function captureCurrentSubtitle() {
    const subtitleSelectors = [
      // Primary selectors (most reliable for this platform)
      '[data-testid="subtitle-display"]',
      '.subtitle-text',
      
      // Secondary selectors (common patterns)
      '.captions-display',
      '.video-captions',
      
      // Generic selectors (last resort)
      '[class*="subtitle"]',
      '[class*="caption"]',
      '[aria-live="polite"]'
    ];
    
    console.log('🔍 Platform subtitle capture - checking selectors...');
    
    for (const selector of subtitleSelectors) {
      const element = document.querySelector(selector);
      
      if (element) {
        const text = element.textContent?.trim() || '';
        
        if (text && text.length > 3) {
          // Skip UI elements (customize for platform)
          const skipPatterns = [
            'play', 'pause', 'mute', 'settings', 'fullscreen'
          ];
          
          if (!skipPatterns.some(pattern => text.toLowerCase().includes(pattern))) {
            console.log(`✅ Found subtitle: "${text}"`);
            return text;
          }
        }
      }
    }
    
    console.log('❌ No subtitle found');
    return null;
  }
  
  // ===== MESSAGE HANDLER =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Platform message:', request.action);
    
    try {
      switch (request.action) {
        case 'ping':
          sendResponse({
            pong: true,
            platform: 'yourplatform', // Replace with actual platform name
            isCollecting: isCollecting,
            videoId: extractVideoId(),
            contentTitle: getContentTitle()
          });
          break;
          
        case 'captureCurrentSubtitle':
          const subtitle = captureCurrentSubtitle();
          const timestamp = getCurrentTimestamp();
          
          sendResponse({
            success: !!subtitle,
            data: {
              text: subtitle,
              timestamp: timestamp,
              timestampUrl: window.location.href,
              videoInfo: {
                videoId: extractVideoId(),
                contentTitle: getContentTitle(),
                platform: 'yourplatform'
              }
            }
          });
          break;
          
        case 'startSubtitleCollection':
          startCollection();
          sendResponse({ success: true, isCollecting: true });
          break;
          
        case 'stopSubtitleCollection':
          const segments = stopCollection();
          sendResponse({
            success: true,
            segments: segments,
            isCollecting: false
          });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Platform error:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async responses
  });
  
  console.log('✅ Platform content script ready');
})();
```

## 📝 Step-by-Step Implementation Guide

### Step 1: Create Content Script

1. **File Name**: Use pattern `[platform]-content.js` (e.g., `coursera-content.js`)
2. **Copy Template**: Use the template above as your starting point
3. **Customize Selectors**: Research platform-specific DOM selectors
4. **Test Functions**: Verify each core function works on the target platform

### Step 2: Update Manifest.json

Add your platform to the content scripts array:

```json
{
  "matches": ["https://*.yourplatform.com/*"],
  "js": ["yourplatform-content.js"],
  "run_at": "document_start"
}
```

And add to `host_permissions`:
```json
"host_permissions": [
  "https://*.yourplatform.com/*"
]
```

### Step 3: Background Script Integration

Add platform handler to `background.js`:

```javascript
// Add to message listener in background.js
case 'analyzeTextInSidepanel':
  if (request.platform === 'yourplatform') {
    handleYourPlatformTextAnalysis(request, tabId);
  }
  break;

// Add new handler function
async function handleYourPlatformTextAnalysis(request, tabId) {
  const cleanText = request.text?.replace(/\s+/g, ' ').trim() || '';
  const language = request.language || 'english';
  
  // Generate URLs for analysis
  const urls = {
    primaryUrl: `https://youglish.com/pronounce/${encodeURIComponent(cleanText)}/${language}`,
    backupUrl: `https://forvo.com/search/${encodeURIComponent(cleanText)}/${language}/`
  };
  
  // Store analysis data
  await chrome.storage.local.set({
    yourplatformAnalysis: {
      url: urls.primaryUrl,
      text: cleanText,
      platform: 'yourplatform',
      videoId: request.videoId,
      timestamp: request.timestamp,
      originalUrl: request.originalUrl
    }
  });
  
  // Send to sidepanel
  chrome.runtime.sendMessage({
    action: 'updateSidePanel',
    source: 'yourplatform-learning',
    url: urls.primaryUrl,
    text: cleanText,
    language: language,
    title: request.title || 'Your Platform Content'
  });
}
```

### Step 4: UI Integration

Update `components/transcript-restructurer.js` to detect your platform:

```javascript
async detectPlatform() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tabs[0]?.url || '';
  
  if (currentUrl.includes('youtube.com')) return 'youtube';
  if (currentUrl.includes('netflix.com')) return 'netflix';  
  if (currentUrl.includes('udemy.com')) return 'udemy';
  if (currentUrl.includes('yourplatform.com')) return 'yourplatform'; // Add this line
  
  return 'youtube'; // Default fallback
}
```

## 🔧 Platform-Specific Customization Examples

### YouTube Pattern (Advanced)
- **Dual Scripts**: Content script + injected page script for deep API access
- **Timestamp Offset**: Subtracts 2 seconds for sentence context
- **Performance**: High-frequency updates (500ms intervals)

### Netflix Pattern (Performance-Optimized)  
- **Conservative Updates**: 3-second intervals to prevent freezing
- **Rich Metadata**: Episode info, cast, genre extraction
- **Error Recovery**: Extensive fallback mechanisms

### Udemy Pattern (Simplified)
- **Debug-Heavy**: Extensive logging for troubleshooting
- **Course Context**: Course and lecture information
- **Conservative Performance**: 1-second intervals, crash prevention

## 🚀 Quick Platform Addition Checklist

- [ ] **Content Script Created** (`platform-content.js`)
- [ ] **Core Functions Implemented** (extractVideoId, getCurrentTimestamp, captureCurrentSubtitle)
- [ ] **Message Handler Added** (ping, captureCurrentSubtitle, collection methods)
- [ ] **Manifest Updated** (content_scripts, host_permissions)
- [ ] **Background Handler Added** (handlePlatformTextAnalysis)
- [ ] **Platform Detection Added** (transcript-restructurer.js)
- [ ] **Selectors Researched** (subtitle, video, title selectors)
- [ ] **Testing Completed** (basic functionality, error cases)

## 🧪 Testing Your Implementation

Use this Node.js test pattern:

```javascript
// Test your platform content script
const fs = require('fs');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: function(callback) {
        // Test ping
        callback({ action: 'ping' }, {}, (response) => {
          console.log('Ping response:', response);
        });
        
        // Test subtitle capture
        callback({ action: 'captureCurrentSubtitle' }, {}, (response) => {
          console.log('Capture response:', response);
        });
      }
    }
  }
};

// Mock DOM
global.window = { 
  location: { href: 'https://yourplatform.com/content/123' },
  console: console 
};
global.document = { 
  querySelector: () => null,
  title: 'Test Content | Your Platform' 
};

// Load and test
const script = fs.readFileSync('yourplatform-content.js', 'utf8');
eval(script);
```

## 💡 Best Practices

### Selector Strategy
1. **Research First**: Study the platform's HTML structure
2. **Multiple Fallbacks**: Always provide 3-5 selector options
3. **Test Regularly**: Platform updates can break selectors
4. **Generic Last**: End with generic selectors as last resort

### Performance Considerations
1. **Interval Timing**: Start with 1-2 second intervals
2. **Throttling**: Prevent spam with timestamp checking
3. **Error Recovery**: Never let errors crash the script
4. **Memory Cleanup**: Clear intervals and event listeners

### Error Handling
1. **Graceful Degradation**: Script should work even with some failures
2. **User Feedback**: Provide clear error messages
3. **Debug Information**: Log useful debugging info
4. **Fallback Mechanisms**: Always have backup approaches

## 📚 Reference Implementation Files

Study these working examples:
- `youtube-content.js` - Advanced dual-script pattern
- `netflix-content.js` - Performance-optimized pattern  
- `udemy-simple.js` - Simplified, debug-heavy pattern
- `background.js` - Central message routing
- `components/transcript-restructurer.js` - UI platform detection

## 🔄 Architecture Evolution

This architecture has evolved through:
- **3 Platform Implementations** (YouTube, Netflix, Udemy)
- **Performance Optimization** (Netflix freezing prevention)
- **Error Recovery** (Extension reload handling)
- **User Experience** (Consistent UI across platforms)

The patterns documented here are battle-tested and ready for new platform extensions.

---

**Next Platform Targets**: Coursera, Khan Academy, Pluralsight, LinkedIn Learning