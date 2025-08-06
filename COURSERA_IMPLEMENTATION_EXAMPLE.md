# Coursera Implementation Example

## 📋 Complete Implementation Guide

This document shows exactly how to add **Coursera** support following our proven architecture patterns. Use this as a template for any new platform.

## 🔍 Step 1: Research Platform Structure

### Coursera URL Patterns
```
https://www.coursera.org/learn/course-name/lecture/video-id/video-title
https://www.coursera.org/specializations/specialization-name/
https://www.coursera.org/learn/course-name/home/week/1
```

### DOM Structure Research
Based on Coursera's current structure:

**Video Element**:
```html
<video data-testid="video-player" class="video-js">
```

**Subtitle Elements**:
```html
<div class="rc-CaptionsRenderer">
  <div class="caption-line">Subtitle text here</div>
</div>
```

**Course Title**:
```html
<h1 data-testid="course-header-title">Course Name</h1>
```

## 🔧 Step 2: Create Content Script

**File**: `coursera-content.js`

```javascript
// Coursera Content Script - Language Learning Extension
// Handles Coursera video interaction and subtitle capture

(function() {
  'use strict';
  
  console.log('🎓 Coursera Language Learning Extension loaded');
  
  // ===== STATE MANAGEMENT =====
  let isCollecting = false;
  let collectedSegments = [];
  let collectionStartTime = null;
  let lastSubtitle = '';
  let lastSubtitleTime = 0;
  let collectionMonitorInterval = null;
  
  // ===== COURSERA-SPECIFIC FUNCTIONS =====
  
  /**
   * Extract Coursera video/lecture ID from URL
   * @returns {string|null} Video ID or null if not found
   */
  function extractCourseraVideoId() {
    // Coursera patterns:
    // https://www.coursera.org/learn/course-name/lecture/ABC123/lecture-title
    const match = window.location.href.match(/\/lecture\/([^\/]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Extract course and lecture information
   * @returns {Object} Course metadata
   */
  function getCourseInfo() {
    console.log('🔍 Coursera course info extraction...');
    
    // Course title selectors (in priority order)
    const courseTitleSelectors = [
      '[data-testid="course-header-title"]',
      '.course-title h1',
      '.banner-title h1',
      'h1'
    ];
    
    // Lecture title selectors
    const lectureTitleSelectors = [
      '[data-testid="lecture-title"]',
      '.lecture-title',
      '.video-title h2',
      'h2'
    ];
    
    let courseTitle = 'Coursera Course';
    let lectureTitle = 'Current Lecture';
    
    // Extract course title
    for (const selector of courseTitleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        courseTitle = element.textContent.trim();
        console.log(`✅ Found course title: "${courseTitle}"`);
        break;
      }
    }
    
    // Extract lecture title  
    for (const selector of lectureTitleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        lectureTitle = element.textContent.trim();
        console.log(`✅ Found lecture title: "${lectureTitle}"`);
        break;
      }
    }
    
    return {
      courseTitle: courseTitle,
      lectureTitle: lectureTitle,
      fullTitle: `${courseTitle} - ${lectureTitle}`
    };
  }
  
  /**
   * Get current video timestamp
   * @returns {number} Current timestamp in seconds
   */
  function getCurrentTimestamp() {
    console.log('🔍 Coursera timestamp extraction...');
    
    // Coursera video selectors (in priority order)
    const videoSelectors = [
      'video[data-testid="video-player"]',
      '.video-js video',
      'video.vjs-tech',
      'video'
    ];
    
    for (const selector of videoSelectors) {
      const video = document.querySelector(selector);
      if (video && !isNaN(video.currentTime)) {
        const timestamp = Math.floor(video.currentTime);
        console.log(`✅ Found Coursera video timestamp: ${timestamp}s`);
        return timestamp;
      }
    }
    
    console.log('❌ No Coursera video found, returning 0');
    return 0;
  }
  
  /**
   * Create timestamped URL (Coursera doesn't support URL timestamps natively)
   * @param {number} timestamp - Timestamp in seconds
   * @returns {string} URL with fragment identifier
   */
  function createTimestampedUrl(timestamp = null) {
    const videoId = extractCourseraVideoId();
    if (!videoId) return window.location.href;
    
    const currentTimestamp = timestamp || getCurrentTimestamp();
    return `${window.location.href}#t=${currentTimestamp}s`;
  }
  
  /**
   * Capture current subtitle/caption from Coursera video
   * @returns {string|null} Current subtitle text or null if not found
   */
  function captureCurrentSubtitle() {
    console.log('🔍 Coursera subtitle capture - ENHANCED DEBUG MODE');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Document title:', document.title);
    
    // Coursera subtitle selectors (research-based, in priority order)
    const subtitleSelectors = [
      // Primary Coursera selectors
      '.rc-CaptionsRenderer .caption-line',
      '.vjs-text-track-cue',
      '[data-testid="video-caption"]',
      
      // Secondary selectors (Coursera variations)
      '.coursera-caption-text',
      '.video-captions .caption',
      '.subtitle-display',
      
      // Video.js standard selectors (Coursera uses Video.js)
      '.vjs-text-track-display div',
      '.video-js .vjs-text-track-cue',
      
      // Generic selectors (fallback)
      '[class*="caption"]',
      '[class*="subtitle"]',
      '[aria-live="polite"]',
      '[role="region"][aria-live]'
    ];
    
    console.log(`🔍 Checking ${subtitleSelectors.length} Coursera subtitle selectors...`);
    
    for (let i = 0; i < subtitleSelectors.length; i++) {
      const selector = subtitleSelectors[i];
      const element = document.querySelector(selector);
      
      console.log(`🔍 Selector ${i+1}/${subtitleSelectors.length}: "${selector}"`, 
                  element ? '✅ FOUND' : '❌ NOT FOUND');
      
      if (element) {
        const text = element.textContent?.trim() || '';
        const isVisible = element.offsetParent !== null;
        const computedStyle = window.getComputedStyle(element);
        const isDisplayed = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
        
        console.log(`   📝 Text content: "${text}"`);
        console.log(`   👁️ Visible: ${isVisible}, Displayed: ${isDisplayed}`);
        
        if (text && text.length > 3) {
          // Skip UI elements and navigation text (Coursera-specific)
          const skipPatterns = [
            'play', 'pause', 'mute', 'unmute', 'settings', 'fullscreen',
            'speed', 'quality', 'volume', 'closed captions', 'transcript',
            'previous', 'next', 'lesson', 'course', 'week', 'module'
          ];
          
          if (!skipPatterns.some(pattern => text.toLowerCase().includes(pattern))) {
            console.log(`✅ Found Coursera subtitle: "${text}"`);
            return text;
          } else {
            console.log('⏭️ Skipping UI element:', text);
          }
        }
      }
    }
    
    console.log('❌ No Coursera subtitle found with any method');
    return null;
  }
  
  /**
   * Start continuous subtitle collection
   */
  function startCollection() {
    if (isCollecting) return;
    
    console.log('🎓 Starting Coursera subtitle collection...');
    isCollecting = true;
    collectedSegments = [];
    collectionStartTime = Date.now();
    lastSubtitle = '';
    
    // Monitor subtitles every 2 seconds (balanced performance)
    collectionMonitorInterval = setInterval(() => {
      try {
        const subtitle = captureCurrentSubtitle();
        const now = Date.now();
        
        if (subtitle && subtitle !== lastSubtitle && (now - lastSubtitleTime) > 1500) {
          const timestamp = getCurrentTimestamp();
          const courseInfo = getCourseInfo();
          
          const segment = {
            text: subtitle,
            timestamp: timestamp,
            timestampDisplay: formatTime(timestamp),
            platform: 'coursera',
            videoId: extractCourseraVideoId(),
            courseTitle: courseInfo.courseTitle,
            lectureTitle: courseInfo.lectureTitle,
            url: createTimestampedUrl(timestamp)
          };
          
          collectedSegments.push(segment);
          lastSubtitle = subtitle;
          lastSubtitleTime = now;
          console.log(`🎓 Collected: "${subtitle}" at ${formatTime(timestamp)}`);
        }
      } catch (error) {
        console.log('⚠️ Collection error (non-critical):', error.message);
      }
    }, 2000); // 2-second intervals for balanced performance
  }
  
  /**
   * Stop subtitle collection
   * @returns {Array} Collected segments
   */
  function stopCollection() {
    if (!isCollecting) return [];
    
    console.log('🎓 Stopping Coursera collection...');
    isCollecting = false;
    
    if (collectionMonitorInterval) {
      clearInterval(collectionMonitorInterval);
      collectionMonitorInterval = null;
    }
    
    return [...collectedSegments];
  }
  
  /**
   * Format timestamp as MM:SS
   * @param {number} seconds - Timestamp in seconds
   * @returns {string} Formatted timestamp
   */
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // ===== MESSAGE HANDLER =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎓 Coursera message:', request.action);
    
    try {
      switch (request.action) {
        case 'ping':
          const courseInfo = getCourseInfo();
          sendResponse({
            pong: true,
            platform: 'coursera',
            isCollecting: isCollecting,
            videoId: extractCourseraVideoId(),
            courseTitle: courseInfo.courseTitle,
            lectureTitle: courseInfo.lectureTitle
          });
          break;
          
        case 'captureCurrentSubtitle':
        case 'captureCourseraSubtitle':
          const subtitle = captureCurrentSubtitle();
          const timestamp = getCurrentTimestamp();
          const courseData = getCourseInfo();
          
          sendResponse({
            success: !!subtitle,
            data: {
              text: subtitle,
              timestamp: timestamp,
              timestampUrl: createTimestampedUrl(timestamp),
              videoInfo: {
                videoId: extractCourseraVideoId(),
                courseTitle: courseData.courseTitle,
                lectureTitle: courseData.lectureTitle,
                platform: 'coursera'
              }
            }
          });
          break;
          
        case 'startCourseraSubtitleCollection':
          startCollection();
          sendResponse({ success: true, isCollecting: true });
          break;
          
        case 'stopCourseraSubtitleCollection':
          const segments = stopCollection();
          sendResponse({
            success: true,
            segments: segments,
            isCollecting: false
          });
          break;
          
        case 'getCourseraVideoInfo':
          const info = getCourseInfo();
          sendResponse({
            success: true,
            data: {
              videoId: extractCourseraVideoId(),
              courseTitle: info.courseTitle,
              lectureTitle: info.lectureTitle,
              timestamp: getCurrentTimestamp(),
              url: window.location.href
            }
          });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Coursera error:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async responses
  });
  
  console.log('🎓 Coursera Language Learning Extension ready');
})();
```

## 📝 Step 3: Update Manifest.json

Add to the `content_scripts` array:

```json
{
  "matches": ["https://*.coursera.org/*"],
  "js": ["coursera-content.js"],
  "run_at": "document_start"
}
```

Add to `host_permissions`:
```json
"https://*.coursera.org/*"
```

Update `exclude_matches` in the article collector:
```json
"exclude_matches": [
  "https://*.youtube.com/*",
  "https://*.netflix.com/*", 
  "https://*.udemy.com/*",
  "https://*.coursera.org/*",
  "https://youglish.com/*"
]
```

## 🔧 Step 4: Background Script Integration

Add to `background.js`:

```javascript
// Add to the main message listener
case 'analyzeTextInSidepanel':
  if (request.platform === 'coursera') {
    handleCourseraTextAnalysis(request, tabId);
  }
  // ... existing platform handlers
  break;

// Add new handler function
async function handleCourseraTextAnalysis(request, tabId) {
  try {
    console.log('🎓 Processing Coursera text analysis:', request);
    
    const cleanText = request.text?.replace(/\s+/g, ' ').trim() || '';
    const language = request.language || 'english';
    
    if (!cleanText) {
      console.log('❌ No text provided for Coursera analysis');
      return;
    }
    
    // Generate analysis URLs
    const urls = generateAnalysisUrls(cleanText, language);
    
    // Store Coursera analysis data
    await chrome.storage.local.set({
      courseraAnalysis: {
        url: urls.primaryUrl,
        text: cleanText,
        platform: 'coursera',
        videoId: request.videoId || null,
        courseTitle: request.courseTitle || 'Coursera Course',
        lectureTitle: request.lectureTitle || 'Lecture',
        timestamp: request.timestamp || 0,
        originalUrl: request.originalUrl || request.url,
        language: language,
        createdAt: new Date().toISOString()
      }
    });
    
    console.log('✅ Coursera analysis data stored successfully');
    
    // Record in learning history
    await recordLearningActivity({
      text: cleanText,
      language: language,
      platform: 'coursera',
      url: request.originalUrl || request.url,
      title: `${request.courseTitle || 'Coursera'} - ${request.lectureTitle || 'Lecture'}`,
      videoId: request.videoId,
      timestamp: request.timestamp
    });
    
    // Send to sidepanel for display
    chrome.runtime.sendMessage({
      action: 'updateSidePanel',
      source: 'coursera-learning',
      url: urls.primaryUrl,
      text: cleanText,
      language: language,
      title: request.lectureTitle || 'Coursera Lecture',
      platform: 'coursera'
    });
    
    console.log('✅ Coursera text analysis completed');
    
  } catch (error) {
    console.error('❌ Error in Coursera text analysis:', error);
  }
}
```

## 🎯 Step 5: UI Integration

Update `components/transcript-restructurer.js`:

```javascript
// Add to detectPlatform() function
async detectPlatform() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tabs[0]?.url || '';
  
  if (currentUrl.includes('youtube.com')) return 'youtube';
  if (currentUrl.includes('netflix.com')) return 'netflix';
  if (currentUrl.includes('udemy.com')) return 'udemy';
  if (currentUrl.includes('coursera.org')) return 'coursera'; // Add this line
  
  return 'youtube'; // Default fallback
}

// Add to captureCurrentSubtitle() function
async captureCurrentSubtitle() {
  // ... existing code ...
  
  } else if (this.currentPlatform === 'coursera') {
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'captureCurrentSubtitle' 
      });
      
      if (response && response.success && response.data) {
        const result = {
          success: true,
          text: response.data.text,
          timestamp: response.data.timestamp,
          url: response.data.timestampUrl,
          videoInfo: response.data.videoInfo
        };
        
        console.log('✅ Coursera subtitle captured:', result);
        return result;
      } else {
        return { success: false, error: 'No Coursera subtitle found' };
      }
    } catch (error) {
      console.error('❌ Coursera capture error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ... rest of function
}
```

## 🧪 Step 6: Testing

Create a test file `test-coursera.js`:

```javascript
const fs = require('fs');

console.log('🧪 Testing Coursera Implementation...');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: function(callback) {
        console.log('✅ Message listener registered');
        
        // Test ping
        callback({ action: 'ping' }, {}, (response) => {
          console.log('📤 Ping Response:', response);
        });
        
        // Test subtitle capture
        callback({ action: 'captureCurrentSubtitle' }, {}, (response) => {
          console.log('📤 Capture Response:', response);
        });
      }
    }
  }
};

// Mock Coursera DOM
global.window = {
  location: { href: 'https://www.coursera.org/learn/machine-learning/lecture/RKFpn/what-is-machine-learning' },
  console: console,
  getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
};

global.document = {
  querySelector: function(selector) {
    console.log('🔍 Testing selector:', selector);
    
    // Simulate some elements being found
    if (selector === '[data-testid="course-header-title"]') {
      return { textContent: '   Machine Learning Course   ' };
    }
    
    return null; // Most selectors won't find elements in test
  },
  title: 'What is Machine Learning? | Coursera'
};

// Load and test the content script
try {
  const script = fs.readFileSync('coursera-content.js', 'utf8');
  eval(script);
  console.log('✅ Coursera content script test completed successfully!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
}
```

Run the test:
```bash
node test-coursera.js
```

## 📊 Expected Output

```
🧪 Testing Coursera Implementation...
🎓 Coursera Language Learning Extension loaded
✅ Message listener registered
🎓 Coursera message: ping
🔍 Coursera course info extraction...
🔍 Testing selector: [data-testid="course-header-title"]
✅ Found course title: "Machine Learning Course"
🔍 Testing selector: [data-testid="lecture-title"]
🔍 Testing selector: .lecture-title
🔍 Testing selector: .video-title h2
🔍 Testing selector: h2
🔍 Coursera timestamp extraction...
🔍 Testing selector: video[data-testid="video-player"]
🔍 Testing selector: .video-js video
🔍 Testing selector: video.vjs-tech
🔍 Testing selector: video
❌ No Coursera video found, returning 0
📤 Ping Response: {
  pong: true,
  platform: 'coursera',
  isCollecting: false,
  videoId: 'RKFpn',
  courseTitle: 'Machine Learning Course',
  lectureTitle: 'Current Lecture'
}
```

## ✅ Implementation Complete!

Following this exact pattern, you now have:

- ✅ **Content Script**: Full Coursera integration
- ✅ **Manifest Updates**: Proper registration and permissions  
- ✅ **Background Integration**: Message handling and analysis
- ✅ **UI Integration**: Platform detection and capture
- ✅ **Testing**: Validation of core functionality

This implementation follows all the proven patterns from YouTube, Netflix, and Udemy, ensuring consistency and reliability across the extension.