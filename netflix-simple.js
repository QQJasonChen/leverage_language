// Netflix Simple Implementation - Just Works
// Focused on core functionality without bloat

(function() {
  'use strict';
  
  console.log('🎭 Netflix Simple Learning Extension loaded');
  
  // State variables
  let isCollecting = false;
  let collectedSegments = [];
  let collectionStartTime = null;
  let monitorInterval = null;
  
  // Extract Netflix video ID
  function getNetflixVideoId() {
    const match = window.location.href.match(/watch\/(\d+)/);
    return match ? match[1] : null;
  }
  
  // Get video title
  function getVideoTitle() {
    // Try Netflix title selectors
    const selectors = [
      'h1[data-uia="video-title"]',
      '.video-title h1',
      'h1'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return document.title.replace(' - Netflix', '').trim() || 'Netflix Video';
  }
  
  // Get current timestamp
  function getCurrentTimestamp() {
    const video = document.querySelector('video');
    if (video && !isNaN(video.currentTime)) {
      return Math.floor(video.currentTime);
    }
    return 0;
  }
  
  // Capture current subtitle
  function captureCurrentSubtitle() {
    // Netflix subtitle selectors (most common)
    const selectors = [
      '.player-timedtext-text-container',
      '[data-uia="player-subtitle-text"]',
      '.timedtext span',
      '[class*="timedtext"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return null;
  }
  
  // Start continuous collection
  function startCollection() {
    if (isCollecting) return;
    
    console.log('🎭 Starting Netflix subtitle collection...');
    isCollecting = true;
    collectedSegments = [];
    collectionStartTime = Date.now();
    
    // Monitor subtitles every 500ms
    monitorInterval = setInterval(() => {
      const subtitle = captureCurrentSubtitle();
      if (subtitle) {
        const timestamp = getCurrentTimestamp();
        
        // Avoid duplicates
        const lastSegment = collectedSegments[collectedSegments.length - 1];
        if (!lastSegment || lastSegment.text !== subtitle) {
          
          const segment = {
            text: subtitle,
            timestamp: timestamp,
            timestampDisplay: formatTime(timestamp),
            platform: 'netflix',
            videoId: getNetflixVideoId(),
            title: getVideoTitle()
          };
          
          collectedSegments.push(segment);
          console.log(`🎭 Collected: "${subtitle}" at ${formatTime(timestamp)}`);
        }
      }
    }, 500);
  }
  
  // Stop collection
  function stopCollection() {
    if (!isCollecting) return;
    
    console.log('🎭 Stopping Netflix collection...');
    isCollecting = false;
    
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
    
    return [...collectedSegments]; // Return copy
  }
  
  // Format timestamp as MM:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎭 Netflix message:', request.action);
    
    switch (request.action) {
      case 'ping':
        sendResponse({ 
          pong: true, 
          platform: 'netflix',
          isCollecting: isCollecting,
          videoId: getNetflixVideoId(),
          title: getVideoTitle()
        });
        break;
        
      case 'captureCurrentSubtitle':
        const subtitle = captureCurrentSubtitle();
        sendResponse({
          success: !!subtitle,
          text: subtitle,
          timestamp: getCurrentTimestamp(),
          videoInfo: {
            videoId: getNetflixVideoId(),
            title: getVideoTitle(),
            platform: 'netflix'
          }
        });
        break;
        
      case 'startNetflixSubtitleCollection':
        startCollection();
        sendResponse({ success: true, isCollecting: true });
        break;
        
      case 'stopNetflixSubtitleCollection':
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
    
    return true;
  });
  
  console.log('🎭 Netflix Simple extension ready');
})();