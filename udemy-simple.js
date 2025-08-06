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
    console.log('🔍 Extracting Udemy course title...');
    
    const selectors = [
      '[data-purpose="course-header-title"]',
      '.udlite-heading-xl',
      '.course-title',
      '.course-header-title',
      '[data-testid="course-title"]',
      '.curriculum-item-title',
      'h1[class*="course"]',
      'h1',
      'h2'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        let title = element.textContent.trim();
        console.log(`✅ Found course title with selector "${selector}": "${title}"`);
        
        // Clean up common prefixes/suffixes  
        title = title.replace(/^Course:\s*/, '');
        title = title.replace(/\s*-\s*Udemy.*$/, '');
        title = title.replace(/\s*\|\s*Udemy.*$/, '');
        
        if (title.length > 3) {
          return title;
        }
      }
    }
    
    // Fallback: Extract from document title
    let docTitle = document.title;
    if (docTitle && docTitle !== 'Udemy') {
      console.log(`🔄 Using document title as course fallback: "${docTitle}"`);
      // Clean document title
      docTitle = docTitle.replace(/^Course:\s*/, '');
      docTitle = docTitle.replace(/\s*\|\s*Udemy.*$/, '');
      
      // Extract course name before " - " if present
      if (docTitle.includes(' - ')) {
        docTitle = docTitle.split(' - ')[0].trim();
      }
      
      if (docTitle.length > 5) {
        return docTitle;
      }
    }
    
    console.log('❌ No course title found, using default');
    return 'Udemy Course';
  }
  
  // Get lecture title
  function extractLectureTitle() {
    console.log('🔍 Extracting Udemy lecture title...');
    
    // Udemy lecture title selectors (in priority order)
    const selectors = [
      '[data-purpose="lecture-title"]',
      '.lecture-title h1',
      '.lecture-title',
      '.curriculum-item--title--zI5QT span',
      '.video-viewer--video-title--zEOyF',
      'h1[data-purpose="video-title"]',
      '.js-video-title',
      // Fallback selectors
      'h1',
      'h2'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        let title = element.textContent.trim();
        console.log(`✅ Found lecture title with selector "${selector}": "${title}"`);
        
        // Clean up common prefixes/suffixes
        title = title.replace(/^\d+\.\s*/, ''); // Remove numbering like "1. "
        title = title.replace(/\s*-\s*Udemy.*$/, ''); // Remove "- Udemy" suffix
        
        if (title.length > 3) {
          return title;
        }
      }
    }
    
    // Fallback: Extract from document title
    let docTitle = document.title;
    if (docTitle && docTitle !== 'Udemy') {
      // Clean document title
      docTitle = docTitle.replace(/\s*\|\s*Udemy.*$/, '');
      docTitle = docTitle.replace(/^Course:\s*/, '');
      
      if (docTitle.length > 5) {
        console.log(`🔄 Using document title as lecture fallback: "${docTitle}"`);
        return docTitle;
      }
    }
    
    console.log('❌ No lecture title found, using default');
    return 'Current Lecture';
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
    console.log('🔍 Udemy subtitle capture - ENHANCED DEBUG MODE');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Document title:', document.title);
    
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
    
    console.log('🔍 Udemy subtitle capture - checking', selectors.length, 'selectors...');
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const element = document.querySelector(selector);
      
      console.log(`🔍 Selector ${i+1}/${selectors.length}: "${selector}"`, element ? '✅ FOUND' : '❌ NOT FOUND');
      
      if (element) {
        const text = element.textContent?.trim() || '';
        const isVisible = element.offsetParent !== null;
        const computedStyle = window.getComputedStyle(element);
        const isDisplayed = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
        
        console.log(`   📝 Text content: "${text}"`);
        console.log(`   👁️ Visible: ${isVisible}, Displayed: ${isDisplayed}`);
        console.log(`   🎯 Element:`, element);
        
        if (text && text.length > 0) {
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
    }
    
    // Try a few more common selectors before giving up
    console.log('🔍 Trying additional common subtitle selectors...');
    
    const additionalSelectors = [
      '.vjs-text-track-display div',
      '[class*="text-track"]',
      '[class*="caption"] div',
      '[data-testid*="caption"]',
      '[role="region"] div',
      '.shaka-text-container div'
    ];
    
    for (let i = 0; i < additionalSelectors.length; i++) {
      const selector = additionalSelectors[i];
      const element = document.querySelector(selector);
      
      console.log(`🔍 Additional selector ${i+1}/${additionalSelectors.length}: "${selector}"`, element ? '✅ FOUND' : '❌ NOT FOUND');
      
      if (element) {
        const text = element.textContent?.trim() || '';
        console.log(`   📝 Text content: "${text}"`);
        
        if (text && text.length > 3) {
          console.log(`✅ Found subtitle with additional selector "${selector}": "${text}"`);
          return text;
        }
      }
    }
    
    console.log('❌ No Udemy subtitle found with any method');
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
          
        case 'captureCurrentSubtitle':
        case 'captureUdemySubtitle':
          console.log('🎯 UI BUTTON CAPTURE REQUEST - Enhanced Debug');
          const subtitle = captureCurrentSubtitle();
          const timestamp = getCurrentTimestamp();
          
          const response = {
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
          };
          
          console.log('📤 SENDING RESPONSE TO UI:');
          console.log('  - success:', response.success);
          console.log('  - data.text:', response.data.text);
          console.log('  - full response:', JSON.stringify(response, null, 2));
          
          sendResponse(response);
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
          
        case 'getUdemyVideoInfo':
          const videoInfo = {
            videoId: getUdemyVideoId(),
            courseTitle: getCourseTitle(),
            lectureTitle: extractLectureTitle(),
            url: window.location.href,
            platform: 'udemy'
          };
          
          console.log('📚 Sending Udemy video info:', videoInfo);
          
          sendResponse({
            success: true,
            data: videoInfo
          });
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