// Udemy Simple Implementation - Just Works  
// Focused on core functionality without crashes

(function() {
  'use strict';
  
  console.log('📚 Udemy Simple Learning Extension loaded');
  
  // State variables
  let isCollecting = false;
  let collectedSegments = [];
  let collectionStartTime = null;
  let monitorInterval = null;
  let lastSubtitle = '';
  
  // Extract Udemy video/lecture ID
  function getUdemyVideoId() {
    const match = window.location.href.match(/lecture\/(\d+)/);
    return match ? match[1] : null;
  }
  
  // Get course title
  function getCourseTitle() {
    const selectors = [
      '[data-purpose="course-header-title"]',
      '.udlite-heading-xl',
      'h1'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return 'Udemy Course';
  }
  
  // Get current timestamp
  function getCurrentTimestamp() {
    // Try multiple video selectors
    const selectors = ['video[data-purpose="video-display"]', 'video'];
    
    for (const selector of selectors) {
      const video = document.querySelector(selector);
      if (video && !isNaN(video.currentTime)) {
        return Math.floor(video.currentTime);
      }
    }
    
    return 0;
  }
  
  // Capture current subtitle (with throttling to prevent crashes)
  function captureCurrentSubtitle() {
    // Updated Udemy subtitle selectors - more comprehensive
    const selectors = [
      // Current Udemy subtitle selectors (2024)
      '[data-purpose="captions-display"]',
      '.captions-display',
      '.closed-captions',
      '.video-captions',
      '.captions-cue-text',
      '.captionContainer',
      '.ud-video-caption',
      '.video-js .vjs-text-track-display',
      '.vjs-text-track-cue',
      '.vjs-text-track-cue-content',
      // Generic subtitle/captions classes
      '[class*="captions"]',
      '[class*="caption"]',
      '[class*="subtitle"]',
      '[aria-live="polite"]',
      // Video.js related selectors
      '.video-js [role="button"][aria-live]',
      '.video-viewer--content [data-testid*="caption"]',
      // Generic text overlays that might contain subtitles
      '[role="region"][aria-live]'
    ];
    
    console.log('🔍 Udemy subtitle capture - checking selectors...');
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        const text = element.textContent.trim();
        
        console.log(`✅ Found subtitle with selector "${selector}": "${text}"`);
        
        // Skip UI elements and navigation text
        if (text.includes('lecture') && text.includes('completed')) {
          console.log('⏭️ Skipping UI element:', text);
          continue;
        }
        
        // Skip very short text (likely UI elements)
        if (text.length < 3) {
          console.log('⏭️ Skipping short text:', text);
          continue;
        }
        
        // Skip common UI text patterns
        const skipPatterns = [
          'play', 'pause', 'mute', 'unmute', 'settings', 'fullscreen',
          'speed', 'quality', 'volume', 'closed captions', 'transcript'
        ];
        
        if (skipPatterns.some(pattern => text.toLowerCase().includes(pattern))) {
          console.log('⏭️ Skipping UI pattern:', text);
          continue;
        }
        
        return text;
      }
    }
    
    console.log('❌ No Udemy subtitle found with any selector');
    return null;
  }
  
  // Start continuous collection (with crash prevention)
  function startCollection() {
    if (isCollecting) return;
    
    console.log('📚 Starting Udemy subtitle collection...');
    isCollecting = true;
    collectedSegments = [];
    collectionStartTime = Date.now();
    lastSubtitle = '';
    
    // Monitor subtitles every 1 second (slower to prevent crashes)
    monitorInterval = setInterval(() => {
      try {
        const subtitle = captureCurrentSubtitle();
        
        if (subtitle && subtitle !== lastSubtitle && subtitle.length > 5) {
          const timestamp = getCurrentTimestamp();
          
          const segment = {
            text: subtitle,
            timestamp: timestamp,
            timestampDisplay: formatTime(timestamp),
            platform: 'udemy',
            videoId: getUdemyVideoId(),
            courseTitle: getCourseTitle()
          };
          
          collectedSegments.push(segment);
          lastSubtitle = subtitle;
          console.log(`📚 Collected: "${subtitle}" at ${formatTime(timestamp)}`);
        }
      } catch (error) {
        console.log('⚠️ Collection error (non-critical):', error.message);
      }
    }, 1000); // Slower interval to prevent browser crashes
  }
  
  // Stop collection
  function stopCollection() {
    if (!isCollecting) return;
    
    console.log('📚 Stopping Udemy collection...');
    isCollecting = false;
    
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
    
    return [...collectedSegments];
  }
  
  // Format timestamp as MM:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📚 Udemy message:', request.action);
    
    try {
      switch (request.action) {
        case 'ping':
          sendResponse({ 
            pong: true, 
            platform: 'udemy',
            isCollecting: isCollecting,
            videoId: getUdemyVideoId(),
            courseTitle: getCourseTitle()
          });
          break;
          
        case 'captureUdemySubtitle':
          const subtitle = captureCurrentSubtitle();
          const timestamp = getCurrentTimestamp();
          
          sendResponse({
            success: !!subtitle,
            data: {
              text: subtitle,
              timestamp: timestamp,
              timestampUrl: window.location.href,
              videoInfo: {
                videoId: getUdemyVideoId(),
                courseTitle: getCourseTitle(),
                platform: 'udemy'
              }
            }
          });
          break;
          
        case 'startUdemySubtitleCollection':
          startCollection();
          sendResponse({ success: true, isCollecting: true });
          break;
          
        case 'stopUdemySubtitleCollection':
          const segments = stopCollection();
          sendResponse({
            success: true,
            segments: segments,
            isCollecting: false
          });
          break;
          
        case 'seekUdemyVideo':
          // Simple tab switching instead of complex seeking
          sendResponse({ success: true, message: 'Udemy tab focused' });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.log('❌ Udemy error:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true;
  });
  
  console.log('📚 Udemy Simple extension ready');
})();