# Quick Platform Reference Guide

## 🚀 5-Minute Platform Addition Checklist

### Core Files to Modify
1. **`[platform]-content.js`** - New content script (copy template)
2. **`manifest.json`** - Add content_scripts entry and host_permissions
3. **`background.js`** - Add platform handler function
4. **`components/transcript-restructurer.js`** - Add platform detection

### Required Functions in Content Script
```javascript
✅ extractVideoId()           // Platform-specific ID extraction
✅ getCurrentTimestamp()      // Video playback time  
✅ captureCurrentSubtitle()   // Subtitle text extraction
✅ getContentTitle()          // Video/course title
✅ Message handler           // Chrome runtime listener
```

### Required Message Types
```javascript
✅ 'ping'                    // Platform identification
✅ 'captureCurrentSubtitle'  // Manual subtitle capture
✅ 'startSubtitleCollection' // Begin monitoring (optional)
✅ 'stopSubtitleCollection'  // End monitoring (optional)
```

## 📋 Copy-Paste Code Snippets

### 1. Manifest.json Addition
```json
{
  "matches": ["https://*.PLATFORM.com/*"],
  "js": ["PLATFORM-content.js"],
  "run_at": "document_start"
}
```

### 2. Host Permissions
```json
"https://*.PLATFORM.com/*"
```

### 3. Platform Detection (transcript-restructurer.js)
```javascript
if (currentUrl.includes('PLATFORM.com')) return 'PLATFORM';
```

### 4. Background Handler Template
```javascript
async function handlePLATFORMTextAnalysis(request, tabId) {
  const cleanText = request.text?.replace(/\s+/g, ' ').trim() || '';
  const language = request.language || 'english';
  
  const urls = generateAnalysisUrls(cleanText, language);
  
  await chrome.storage.local.set({
    PLATFORMAnalysis: {
      url: urls.primaryUrl,
      text: cleanText,
      platform: 'PLATFORM',
      videoId: request.videoId,
      timestamp: request.timestamp,
      originalUrl: request.originalUrl
    }
  });
  
  chrome.runtime.sendMessage({
    action: 'updateSidePanel',
    source: 'PLATFORM-learning',
    url: urls.primaryUrl,
    text: cleanText,
    language: language,
    title: request.title
  });
}
```

## 🎯 Platform-Specific Selector Research

### Common Subtitle Selectors to Try
```javascript
const subtitleSelectors = [
  // Platform-specific (research required)
  '[data-testid="subtitle"]',
  '.platform-captions',
  
  // Video.js standard
  '.vjs-text-track-cue',
  '.vjs-text-track-display div',
  
  // Generic fallbacks
  '[class*="subtitle"]',
  '[class*="caption"]',
  '[aria-live="polite"]'
];
```

### Common Video Selectors
```javascript
const videoSelectors = [
  'video[data-testid="video-player"]',
  '.video-js video',
  'video.vjs-tech',
  'video'
];
```

## 🧪 Quick Test Template

```javascript
// test-PLATFORM.js
const fs = require('fs');

global.chrome = {
  runtime: {
    onMessage: {
      addListener: (callback) => {
        callback({ action: 'ping' }, {}, console.log);
      }
    }
  }
};

global.window = { 
  location: { href: 'https://PLATFORM.com/test' },
  console: console 
};
global.document = { 
  querySelector: () => null,
  title: 'Test | Platform' 
};

const script = fs.readFileSync('PLATFORM-content.js', 'utf8');
eval(script);
```

## 📊 Success Metrics

After implementation, verify:
- ✅ Content script loads without JavaScript errors
- ✅ `ping` message returns correct platform info  
- ✅ `captureCurrentSubtitle` returns structured response
- ✅ Video ID extraction works for platform URLs
- ✅ Timestamp extraction returns valid numbers
- ✅ Manifest.json passes JSON validation

## 🔍 Debugging Checklist

### Common Issues & Fixes

**❌ "Cannot connect to content script"**
- Check manifest.json host_permissions
- Verify content_scripts matches pattern
- Ensure run_at timing is correct

**❌ "Subtitle selectors not working"**
- Open browser DevTools on target platform
- Inspect subtitle elements during playback
- Update selectors array with correct patterns
- Test with multiple videos/courses

**❌ "Video timestamp always returns 0"**
- Check if platform uses custom video player
- Try different video element selectors
- Verify video.currentTime is accessible

**❌ "Extension popup shows wrong platform"**
- Update detectPlatform() in transcript-restructurer.js
- Check URL matching patterns
- Clear extension storage and reload

## 📚 Reference Documentation

- **Full Architecture Guide**: `PLATFORM_ARCHITECTURE_GUIDE.md`
- **Complete Example**: `COURSERA_IMPLEMENTATION_EXAMPLE.md`
- **Working Examples**: `youtube-content.js`, `netflix-content.js`, `udemy-simple.js`

## ⚡ Speed Development Tips

1. **Start with Template**: Copy `udemy-simple.js` for basic implementation
2. **Research First**: Spend 15 minutes studying platform DOM structure  
3. **Test Early**: Run Node.js test after basic functions are implemented
4. **Iterate Selectors**: Start with 3-5 selectors, expand based on testing
5. **Follow Patterns**: Match existing code style and error handling

---

**Estimated Development Time**: 2-4 hours per platform (including testing)