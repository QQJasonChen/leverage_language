// YouTube Content Script - Netflix-Style Manual Caption Collection
// EXACT copy of Netflix approach for YouTube

(function() {
  'use strict';

  console.log('🎬 YouTube Netflix-style manual caption collection loaded');

  let contextInvalidated = false;
  let lastKnownVideoId = null;
  let lastKnownTitle = null;
  let currentVideoInfo = null;

  // YouTube video ID extraction (same as Netflix)
  function extractYouTubeVideoId() {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = window.location.href.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function extractVideoTitle() {
    // Try multiple selectors for YouTube title (same pattern as Netflix)
    const titleSelectors = [
      'h1.ytd-video-primary-info-renderer',
      'h1.title.style-scope.ytd-video-primary-info-renderer',
      '.ytd-video-primary-info-renderer h1',
      '#title h1',
      'h1[class*="title"]',
      '.watch-main-col h1',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback to document title
    const title = document.title;
    if (title && title !== 'YouTube') {
      return title.replace(' - YouTube', '').trim();
    }

    return 'YouTube Video';
  }

  function getCurrentTimestamp() {
    try {
      // YouTube video player selectors (same pattern as Netflix)
      const playerSelectors = [
        'video.html5-main-video',
        'video.video-stream',
        '#movie_player video',
        '.html5-video-player video',
        'video'
      ];

      for (const selector of playerSelectors) {
        const video = document.querySelector(selector);
        if (video && video.currentTime !== undefined) {
          return Math.floor(video.currentTime);
        }
      }

      return 0;
    } catch (error) {
      console.log('⚠️ Could not get YouTube timestamp:', error);
      return 0;
    }
  }

  function createTimestampedUrl(timestamp = null) {
    const videoId = extractYouTubeVideoId();
    if (!videoId) return window.location.href;

    const currentTimestamp = timestamp || getCurrentTimestamp();
    return `https://www.youtube.com/watch?v=${videoId}&t=${currentTimestamp}s`;
  }

  function getVideoInfo() {
    return {
      videoId: extractYouTubeVideoId(),
      title: extractVideoTitle(),
      timestamp: getCurrentTimestamp(),
      url: createTimestampedUrl(),
      platform: 'youtube'
    };
  }

  // EXACT COPY of Netflix's captureCurrentNetflixSubtitle function
  function captureCurrentYouTubeCaption() {
    try {
      console.log('🎬 Manual YouTube caption capture (Netflix-style)');
      
      // YouTube caption selectors (comprehensive list like Netflix)
      const captionSelectors = [
        // Standard YouTube caption containers
        '.caption-window .captions-text',
        '.caption-window',
        '.ytp-caption-window-container .captions-text', 
        '.ytp-caption-window-container',
        
        // Auto-generated captions
        '.ytp-caption-segment',
        '.html5-captions-text',
        '.html5-captions-container .captions-text',
        
        // Alternative selectors
        '[class*="caption"] [class*="text"]',
        '[class*="subtitle"] [class*="text"]',
        '.captions-text',
        '.subtitle-text',
        
        // Modern YouTube selectors
        '.ytp-caption-window-bottom .captions-text',
        '.ytp-caption-window-rollup .captions-text',
        
        // Generic caption containers
        '[class*="caption"]',
        '[class*="subtitle"]',
        '[class*="captions"]'
      ];

      for (const selector of captionSelectors) {
        const captionElement = document.querySelector(selector);
        if (captionElement && captionElement.textContent.trim()) {
          const text = captionElement.textContent.trim();
          // Filter out extension UI elements
          if (!text.includes('No captions visible') && 
              !text.includes('Waiting for captions') &&
              !text.includes('搜尋') && 
              !text.includes('分享') &&
              text.length > 3) {
            console.log('🎬 Captured YouTube caption:', text);
            return text;
          }
        }
      }

      // EXACT COPY of Netflix's fallback approach
      const allTextElements = document.querySelectorAll('div, span, p');
      for (const element of allTextElements) {
        if (element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim();
          // Check if element is positioned like a caption (bottom of screen)
          const rect = element.getBoundingClientRect();
          const isBottomPositioned = rect.bottom > window.innerHeight * 0.7;
          const isReasonableLength = text.length > 5 && text.length < 200;
          const isVisible = rect.width > 0 && rect.height > 0;
          
          // Additional YouTube-specific filters
          if (isBottomPositioned && isReasonableLength && isVisible && 
              !text.includes('搜尋') && !text.includes('分享') && 
              !text.includes('YouTube') && !text.includes('訂閱')) {
            console.log('🎬 Found potential YouTube caption:', text);
            return text;
          }
        }
      }

      console.log('⚠️ No YouTube caption text found');
      return null;
    } catch (error) {
      console.log('⚠️ Error capturing YouTube caption:', error);
      return null;
    }
  }

  // EXACT COPY of Netflix's message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (contextInvalidated) {
      sendResponse({ error: 'Context invalidated' });
      return;
    }

    console.log('🎬 YouTube content script received message:', request);

    try {
      switch (request.action) {
        case 'ping':
          console.log('🏓 YouTube ping received');
          sendResponse({ 
            pong: true, 
            platform: 'youtube',
            videoId: extractYouTubeVideoId(),
            title: extractVideoTitle(),
            timestamp: getCurrentTimestamp()
          });
          break;

        case 'captureCurrentSubtitle':
          console.log('🎬 Manual YouTube caption capture requested (Netflix-style)');
          const capturedText = captureCurrentYouTubeCaption();
          if (capturedText) {
            sendResponse({ 
              success: true, 
              text: capturedText,
              timestamp: getCurrentTimestamp(),
              videoInfo: getVideoInfo()
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'No caption text found. Make sure captions are enabled and visible.' 
            });
          }
          break;

        case 'getCurrentVideoTime':
          console.log('🎬 Getting current YouTube video time');
          const currentTime = getCurrentTimestamp();
          sendResponse({ 
            success: true, 
            currentTime: currentTime,
            timestamp: currentTime,
            url: window.location.href
          });
          break;

        case 'getVideoInfo':
          console.log('🎬 Getting YouTube video info');
          sendResponse({
            success: true,
            videoInfo: getVideoInfo()
          });
          break;

        case 'seekToTime':
          console.log('🎬 Seeking YouTube video to timestamp:', request.timestamp);
          const playerSelectors = [
            'video.html5-main-video',
            'video.video-stream',
            '#movie_player video',
            '.html5-video-player video',
            'video'
          ];

          let video = null;
          for (const selector of playerSelectors) {
            video = document.querySelector(selector);
            if (video) break;
          }

          if (video) {
            video.currentTime = request.timestamp;
            sendResponse({ success: true, timestamp: request.timestamp });
          } else {
            sendResponse({ success: false, error: 'Video player not found' });
          }
          break;

        case 'analyzeTextInSidepanel':
          const currentVideoInfo = getVideoInfo();
          if (currentVideoInfo) {
            console.log('📝 Sending YouTube text to sidepanel for analysis');
            
            chrome.runtime.sendMessage({
              action: 'analyzeTextInSidepanel',
              text: request.text,
              url: currentVideoInfo.url,
              title: currentVideoInfo.title,
              language: 'english', // Default for YouTube
              source: 'youtube-learning',
              platform: 'youtube',
              videoId: currentVideoInfo.videoId,
              timestamp: currentVideoInfo.timestamp
            }).then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              console.error('❌ Failed to send to sidepanel:', error);
              sendResponse({ success: false, error: error.message });
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'Could not extract YouTube video information' 
            });
          }
          break;

        default:
          console.log('❓ Unknown action for YouTube:', request.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ YouTube content script error:', error);
      sendResponse({ error: error.message });
    }

    return true; // Keep message channel open for async responses
  });

  // Context invalidation handling (same as Netflix)
  chrome.runtime.onConnect.addListener(() => {
    contextInvalidated = false;
  });

  function handleContextInvalidation() {
    contextInvalidated = true;
    console.log('⚠️ YouTube extension context invalidated');
  }

  chrome.runtime.id && chrome.runtime.onMessage.addListener(() => {
    // Test if context is still valid
  });

  // Monitor for video changes (same as Netflix)
  let currentUrl = window.location.href;
  
  function handleUrlChange() {
    if (window.location.href !== currentUrl) {
      console.log('🔄 YouTube URL changed:', window.location.href);
      currentUrl = window.location.href;
      lastKnownVideoId = null;
      lastKnownTitle = null;
      currentVideoInfo = null;
    }
  }

  // Set up URL monitoring
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(history, arguments);
    setTimeout(handleUrlChange, 100);
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    setTimeout(handleUrlChange, 100);
  };
  
  window.addEventListener('popstate', handleUrlChange);

  console.log('✅ YouTube Netflix-style content script ready');

})();