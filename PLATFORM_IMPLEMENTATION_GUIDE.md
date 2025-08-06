# 🏗️ Platform Implementation Guide

This guide provides a systematic approach for adding new educational platforms (Coursera, Khan Academy, edX, etc.) to the language learning extension.

## 📋 Implementation Checklist

### 1. Platform Analysis Phase
- [ ] **Identify Platform**: Choose target platform (e.g., Coursera, Khan Academy, edX)
- [ ] **Domain Analysis**: Study the platform's URL structure and video page patterns
- [ ] **Video Player Inspection**: Find CSS selectors for video elements and subtitle containers
- [ ] **Subtitle System Analysis**: Understand how subtitles are displayed and updated
- [ ] **Course/Video Metadata**: Identify how to extract course titles, video titles, and IDs

### 2. Manifest Configuration
**File: `manifest.json`**

- [ ] **Host Permissions**: Add platform domain to `host_permissions` array
```json
"host_permissions": [
  "https://*.coursera.org/*"  // Add new platform domain
]
```

- [ ] **Content Scripts**: Register platform content scripts
```json
{
  "matches": ["https://*.coursera.org/*"],
  "js": ["coursera-content.js"],
  "run_at": "document_start"
}
```

- [ ] **Exclude Matches**: Add platform to article-collector exclusions

### 3. Content Script Implementation
**Create: `{platform}-content.js`**

#### Required Interface Methods:
- [ ] **`extractVideoId()`** - Extract unique video identifier
- [ ] **`extractCourseTitle()`** - Get course/content title  
- [ ] **`getCurrentSubtitleText()`** - Get currently displayed subtitle
- [ ] **`createTimestampUrl()`** - Generate URL with timestamp parameter
- [ ] **`getVideoInfo()`** - Return comprehensive video metadata
- [ ] **`handleMessage()`** - Process extension messages

#### Standard Message Actions to Implement:
- [ ] **`ping`** - Health check and collection status
- [ ] **`captureCurrentSubtitle`** - Manual subtitle extraction
- [ ] **`getVideoInfo`** - Video metadata request
- [ ] **`seekVideo`** - Jump to specific timestamp
- [ ] **`startSubtitleCollection`** - Begin continuous collection
- [ ] **`stopSubtitleCollection`** - End collection and return segments

#### Content Script Template Structure:
```javascript
// Platform Content Script Template
(function() {
    'use strict';
    
    console.log('🎓 Platform Extension initialized');
    
    // State variables
    let currentVideoInfo = null;
    let subtitleObserver = null;
    let isCollecting = false;
    let collectedSegments = [];
    
    // Platform-specific selectors
    const PLATFORM_SELECTORS = {
        video: 'video.platform-video',
        subtitleContainer: '.subtitle-display',
        courseTitle: '.course-title',
        videoTitle: '.video-title'
    };
    
    // Required interface methods
    function extractVideoId() { /* Platform-specific */ }
    function getCurrentSubtitleText() { /* Platform-specific */ }
    function createTimestampUrl() { /* Platform-specific */ }
    
    // Message handler
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Initialize platform integration
    initialize();
})();
```

### 4. Background Script Integration
**File: `background.js`**

- [ ] **Message Handlers**: Add platform-specific message routing
```javascript
// Platform-specific message handlers
if (request.action === 'platformSubtitleUpdate') {
  handlePlatformTextAnalysis(request.data, sender.tab.id)
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
}
```

- [ ] **Handler Function**: Create platform-specific analysis handler
```javascript
async function handlePlatformTextAnalysis(data, tabId) {
  // Similar to handleYouTubeTextAnalysis but with platform-specific metadata
  // Store in chrome.storage with platform-specific keys
}
```

### 5. UI Integration (transcript-restructurer.js)

- [ ] **Platform Detection**: Add URL detection in `detectPlatform()`
```javascript
} else if (url.includes('platform.com')) {
  console.log('✅ Detected Platform');
  return 'platform';
```

- [ ] **UI Customization**: Add platform-specific UI elements
```javascript
const platformIcon = this.currentPlatform === 'platform' ? '🎓' : '📺';
const platformName = this.currentPlatform === 'platform' ? 'Platform' : 'YouTube';
```

- [ ] **Button Configuration**: Add collection/capture buttons for platform
- [ ] **CSS Styling**: Add platform-specific color scheme and styling
- [ ] **Keyboard Shortcuts**: Ensure shortcuts work on new platform
- [ ] **Timestamp Navigation**: Implement click-to-seek functionality

### 6. Message Flow Integration

#### Content Script → Background Script:
- [ ] **Subtitle Updates**: `platformSubtitleUpdate`
- [ ] **Video Events**: `platformVideoLoaded`, `platformVideoPlay`
- [ ] **Collection Events**: `platformCollectionStart`, `platformCollectionEnd`

#### UI → Background Script:
- [ ] **Analysis Requests**: Forward platform subtitle text for AI analysis
- [ ] **Storage Operations**: Platform-specific data storage and retrieval

#### Background Script → Side Panel:
- [ ] **Analysis Results**: Send processed platform content to UI
- [ ] **Status Updates**: Collection progress and completion notifications

### 7. Testing Checklist

- [ ] **Basic Functionality**:
  - [ ] Extension loads on platform pages
  - [ ] Platform detection works correctly
  - [ ] Subtitle text extraction works
  - [ ] Video timestamp extraction works
  
- [ ] **UI Features**:
  - [ ] Platform-specific UI elements display
  - [ ] Collection button functionality
  - [ ] Keyboard shortcuts work
  - [ ] Timestamp clicking works
  
- [ ] **Data Flow**:
  - [ ] Messages sent/received correctly
  - [ ] Subtitle text reaches analysis system
  - [ ] Platform metadata stored properly
  - [ ] Error handling works

## 🔧 Implementation Patterns

### URL Structure Analysis
Each platform has unique URL patterns:
- **YouTube**: `youtube.com/watch?v=VIDEO_ID&t=TIMESTAMP`
- **Netflix**: `netflix.com/watch/TITLE_ID`  
- **Udemy**: `udemy.com/course/COURSE_ID/learn/lecture/LECTURE_ID?start=TIMESTAMP`
- **Coursera**: `coursera.org/learn/COURSE_ID/lecture/LECTURE_ID`

### Timestamp URL Generation
```javascript
function createTimestampUrl(timestamp) {
  const baseUrl = window.location.href.split('?')[0];
  // Platform-specific timestamp parameter
  return `${baseUrl}?t=${Math.floor(timestamp)}s`; // YouTube style
  // OR
  return `${baseUrl}?start=${Math.floor(timestamp)}`; // Udemy style
}
```

### Subtitle Detection Patterns
```javascript
// Try multiple selectors for robustness
const subtitleSelectors = [
  '.primary-subtitle-selector',
  '.fallback-subtitle-selector',
  '[data-testid="subtitle-text"]',
  '.generic-caption-class'
];

for (const selector of subtitleSelectors) {
  const element = document.querySelector(selector);
  if (element && element.textContent?.trim()) {
    return element.textContent.trim();
  }
}
```

## 📚 Examples for Popular Platforms

### Coursera Implementation
```javascript
// coursera-content.js
const COURSERA_SELECTORS = {
  video: 'video.vjs-tech',
  subtitleContainer: '.rc-CaptionsRenderer',
  courseTitle: '[data-test="course-title"]',
  lectureTitle: '.lecture-name-text'
};

function extractVideoId() {
  const match = window.location.href.match(/\/lecture\/([^\/]+)/);
  return match ? match[1] : null;
}

function createTimestampUrl(timestamp) {
  return `${window.location.href.split('?')[0]}?t=${Math.floor(timestamp)}`;
}
```

### Khan Academy Implementation  
```javascript
// khan-content.js
const KHAN_SELECTORS = {
  video: 'video[data-test-id="video-player"]',
  subtitleContainer: '.captions-text',
  courseTitle: '.breadcrumbs-subject',
  videoTitle: 'h1[data-test-id="exercise-title"]'
};

function extractVideoId() {
  const match = window.location.pathname.match(/\/([^\/]+)$/);
  return match ? match[1] : null;
}
```

## 🎯 Success Metrics

A successful platform integration should achieve:
- ✅ **100% Platform Detection** - Correctly identifies platform from URL
- ✅ **Subtitle Extraction** - Captures visible subtitle text reliably  
- ✅ **Timestamp Navigation** - Click timestamps to jump to video moments
- ✅ **Continuous Collection** - Batch capture multiple subtitles
- ✅ **UI Consistency** - Matches design patterns of existing platforms
- ✅ **Keyboard Shortcuts** - All shortcuts (C, B, A, E, D, H) work
- ✅ **Error Handling** - Graceful degradation when features unavailable

## 🔄 Maintenance Considerations

- **DOM Changes**: Platforms update their HTML structure regularly
- **Selector Robustness**: Use multiple fallback selectors
- **Performance**: Monitor for memory leaks in observers
- **Cross-Platform Testing**: Ensure changes don't break existing platforms
- **Feature Parity**: New platforms should match capabilities of existing ones

## 📞 Support Resources

- **Architecture Overview**: See detailed comments in existing files
- **Content Script Template**: Copy `udemy-content.js` structure
- **Message Flow**: Reference `background.js` routing patterns
- **UI Integration**: Follow `transcript-restructurer.js` platform sections
- **Testing**: Use browser dev tools to inspect platform HTML structure