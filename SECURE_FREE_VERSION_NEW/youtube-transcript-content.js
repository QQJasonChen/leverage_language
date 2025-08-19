// YouTube Content Script - Netflix-Style Manual Caption Collection
// EXACT copy of Netflix approach for YouTube

(function() {
  'use strict';

  // Silence verbose logs in production
  try { if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    const n = chrome.runtime.getManifest().name || '';
    if (!n.toLowerCase().includes('dev')) {
      console.log = function(){}; console.info = function(){}; console.debug = function(){}; console.warn = function(){};
    }
  } } catch (e) {}

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

  // Detect if current captions are automatic vs manual
  function detectTranscriptType() {
    try {
      // Method 1: Check ytInitialPlayerResponse for caption tracks
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('ytInitialPlayerResponse')) {
          const patterns = [
            /ytInitialPlayerResponse[^}]*"captionTracks":\s*(\[[^\]]*\])/,
            /"captionTracks":\s*(\[[^\]]*\])/,
            /"playerCaptionsTracklistRenderer":\s*{[^}]*"captionTracks":\s*(\[[^\]]*\])/
          ];
          
          for (const pattern of patterns) {
            const match = script.textContent.match(pattern);
            if (match) {
              try {
                const tracks = JSON.parse(match[1]);
                // Look for currently active track
                for (const track of tracks) {
                  if (track.vssId) {
                    // Auto-generated tracks contain '.asr' in vssId
                    if (track.vssId.includes('.asr')) {
                      console.log('🤖 Detected automatic transcript:', track.vssId);
                      return { type: 'automatic', vssId: track.vssId, name: track.name };
                    }
                  }
                }
                // If we found tracks but none were auto-generated
                if (tracks.length > 0) {
                  console.log('👤 Detected manual transcript');
                  return { type: 'manual', vssId: tracks[0].vssId, name: tracks[0].name };
                }
              } catch (parseError) {
                console.log('Failed to parse caption tracks:', parseError);
              }
            }
          }
        }
      }
      
      // Method 2: Check DOM for auto-generated caption indicators
      const autoSegments = document.querySelectorAll('.ytp-caption-segment');
      if (autoSegments.length > 0) {
        console.log('🤖 Detected automatic transcript (DOM method)');
        return { type: 'automatic', method: 'dom' };
      }
      
      // Method 3: Look for caption window containers
      const captionContainers = document.querySelectorAll('.ytp-caption-window-container');
      if (captionContainers.length > 0) {
        console.log('👤 Detected manual transcript (DOM fallback)');
        return { type: 'manual', method: 'dom' };
      }
      
      // Default: assume manual if captions are present
      console.log('❓ Unknown transcript type, defaulting to manual');
      return { type: 'manual', method: 'default' };
      
    } catch (error) {
      console.log('⚠️ Error detecting transcript type:', error);
      return { type: 'manual', method: 'error' };
    }
  }

  // Enhanced YouTube caption capture with transcript type detection
  function captureCurrentYouTubeCaption() {
    try {
      console.log('🎬 Manual YouTube caption capture with transcript type detection');
      
      // Detect transcript type first
      const transcriptInfo = detectTranscriptType();
      
      // YouTube caption selectors (more specific to avoid UI elements)
      const captionSelectors = [
        // Most specific YouTube caption containers (prioritize these)
        '.ytp-caption-window-container .captions-text',
        '.ytp-caption-segment',
        '.html5-captions-text',
        
        // Standard caption containers  
        '.caption-window .captions-text',
        '.ytp-caption-window-bottom .captions-text',
        '.ytp-caption-window-rollup .captions-text',
        '.html5-captions-container .captions-text',
        
        // Fallback selectors (only if above don't work)
        '.captions-text',
        '.subtitle-text',
        
        // Last resort - but check these are actually caption containers
        '.ytp-caption-window-container',
        '.caption-window'
      ];

      for (const selector of captionSelectors) {
        const captionElement = document.querySelector(selector);
        if (captionElement && captionElement.textContent.trim()) {
          const text = captionElement.textContent.trim();
          
          // Debug logging to see what we're capturing
          console.log(`🔍 Selector: ${selector}`);
          console.log(`📝 Text found: "${text}"`);
          console.log(`🎯 Element classes:`, captionElement.className);
          console.log(`📍 Element position:`, captionElement.getBoundingClientRect());
          
          // Enhanced filtering - must be actual subtitle content
          const isValidSubtitle = 
            // Basic length check
            text.length > 3 && text.length < 500 &&
            
            // Not UI elements (English)
            !text.includes('No captions visible') && 
            !text.includes('Waiting for captions') &&
            !text.includes('Post comment') &&
            !text.includes('Add a comment') &&
            !text.includes('Comment') &&
            !text.includes('Like') &&
            !text.includes('Dislike') &&
            !text.includes('Share') &&
            !text.includes('Save') &&
            !text.includes('Subscribe') &&
            !text.includes('View replies') &&
            !text.includes('Show more') &&
            !text.includes('Show less') &&
            
            // Not UI elements (Chinese)
            !text.includes('搜尋') && 
            !text.includes('分享') &&
            !text.includes('發表留言') &&
            !text.includes('按讚') &&
            !text.includes('不喜歡') &&
            !text.includes('訂閱') &&
            !text.includes('儲存') &&
            !text.includes('查看回覆') &&
            !text.includes('顯示更多') &&
            !text.includes('顯示較少') &&
            
            // Not view counts or numbers
            !text.match(/^\d+\s*(views?|次觀看|watching|人在觀看)/) &&
            !text.match(/^\d+\s*(likes?|個讚|dislikes?|個不喜歡)/) &&
            !text.match(/^[0-9,]+\s*(subscribers?|位訂閱者)/) &&
            
            // Not pure timestamps or formatting
            !text.match(/^[0-9:]+$/) &&
            !text.match(/^[\s\.\-_•]+$/) &&
            
            // Not empty or whitespace-only
            text.trim().length > 0 &&
            
            // Should contain actual words (letters/characters)
            text.match(/[a-zA-Z\u4e00-\u9fff\u0100-\u017f\u0180-\u024f]/);
          
          if (isValidSubtitle) {
            // Additional check: make sure element is in the video area, not sidebar/comments
            const rect = captionElement.getBoundingClientRect();
            const isInMainVideoArea = rect.top > 0 && rect.top < window.innerHeight * 0.8;
            
            if (isInMainVideoArea) {
              console.log('🎬 Captured YouTube caption:', text);
              console.log('📋 Transcript type:', transcriptInfo.type);
              
              // Return enhanced data with transcript type
              return {
                text: text,
                transcriptType: transcriptInfo.type,
                transcriptInfo: transcriptInfo
              };
            } else {
              console.log('❌ Element not in main video area, skipping');
            }
          } else {
            console.log('❌ Text filtered out as UI element:', text);
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
            console.log('📋 Transcript type:', transcriptInfo.type);
            
            // Return enhanced data with transcript type
            return {
              text: text,
              transcriptType: transcriptInfo.type,
              transcriptInfo: transcriptInfo
            };
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
          console.log('🎬 Manual YouTube caption capture requested with transcript type detection');
          const capturedData = captureCurrentYouTubeCaption();
          if (capturedData) {
            let timestamp = getCurrentTimestamp();
            
            // Apply -1 second correction for automatic transcripts
            if (capturedData.transcriptType === 'automatic') {
              timestamp = Math.max(0, timestamp - 1); // Ensure timestamp doesn't go negative
              console.log('🤖 Applied -1 second correction for automatic transcript:', timestamp);
            } else {
              console.log('👤 No correction needed for manual transcript:', timestamp);
            }
            
            sendResponse({ 
              success: true, 
              text: capturedData.text,
              timestamp: timestamp,
              transcriptType: capturedData.transcriptType,
              transcriptInfo: capturedData.transcriptInfo,
              videoInfo: getVideoInfo()
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'No caption text found. Make sure captions are enabled and visible.' 
            });
          }
          break;

        case 'quickAnalyzeLastCapture':
          console.log('⌨️ Quick analyze triggered from global shortcut on YouTube');
          // Forward to transcript restructurer if available
          if (window.transcriptRestructurer && typeof window.transcriptRestructurer.analyzeLastAndSwitchTab === 'function') {
            window.transcriptRestructurer.analyzeLastAndSwitchTab();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Transcript restructurer not available' });
          }
          return true;

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