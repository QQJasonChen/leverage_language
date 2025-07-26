// YouTube content script - handles communication with the extension
console.log('🎬 YouTube content script loaded');

// Get current video timestamp
function getCurrentVideoTimestamp() {
  try {
    console.log('🔍 Starting timestamp detection...');
    
    // Method 1: Try to get the YouTube video element (most reliable)
    const video = document.querySelector('video');
    console.log('🎬 Video element found:', !!video);
    
    if (video) {
      console.log('🎬 Video details:', {
        currentTime: video.currentTime,
        duration: video.duration,
        paused: video.paused,
        readyState: video.readyState
      });
      
      if (!isNaN(video.currentTime) && video.currentTime >= 0) {
        const timestamp = Math.floor(video.currentTime);
        console.log('✅ Video timestamp from video element:', timestamp, 'seconds');
        return timestamp;
      } else {
        console.log('⚠️ Video currentTime is invalid:', video.currentTime);
      }
    } else {
      console.log('❌ No video element found');
    }
    
    // Method 2: Try alternative video selectors
    const videoSelectors = [
      'video.html5-main-video',
      'video.video-stream', 
      '#movie_player video',
      '.html5-video-player video',
      '.ytp-html5-video',
      '#player video'
    ];
    
    for (const selector of videoSelectors) {
      const altVideo = document.querySelector(selector);
      console.log(`🔍 Checking selector ${selector}:`, !!altVideo);
      if (altVideo && !isNaN(altVideo.currentTime) && altVideo.currentTime >= 0) {
        const timestamp = Math.floor(altVideo.currentTime);
        console.log(`✅ Video timestamp from ${selector}:`, timestamp, 'seconds');
        return timestamp;
      }
    }
    
    console.log('❌ No video timestamp could be determined');
    return null;
  } catch (error) {
    console.warn('⚠️ Could not get video timestamp:', error);
    return null;
  }
}

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) {
    console.log('🚫 Ignoring message from different origin:', event.origin);
    return;
  }
  
  console.log('🔔 Content script received message:', event.data);
  
  if (event.data && event.data.type === 'YOUTUBE_LEARNING_TEXT') {
    console.log('📨 Processing YouTube learning text:', event.data.text);
    
    // CRITICAL: Capture video timestamp
    const videoTimestamp = getCurrentVideoTimestamp();
    console.log('⏰ Captured video timestamp:', videoTimestamp);
    
    // Prepare message with all data from page script
    const messageToBackground = {
      action: 'analyzeTextInSidepanel',
      text: event.data.text,
      url: event.data.url || window.location.href,
      title: event.data.title || document.title,
      language: event.data.language || 'english',
      source: event.data.source || 'youtube-learning',
      timestamp: videoTimestamp // ADD THE MISSING TIMESTAMP!
    };
    
    console.log('🚀 Sending to background script:', messageToBackground);
    
    // Send to background script
    chrome.runtime.sendMessage(messageToBackground, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Runtime error sending to background:', chrome.runtime.lastError.message);
        
        // Show user feedback on error
        console.log('📝 Showing error feedback to user');
      } else {
        console.log('✅ Successfully sent to background script:', response);
        
        // Optional: Send success confirmation back to page
        console.log('📝 Message processed successfully');
      }
    });
  } else {
    console.log('🤷 Unknown message type or missing data:', event.data);
  }
});

// Inject the YouTube learning script into the page context
function injectYouTubeLearning() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('youtube-page-script.js');
  script.onload = function() {
    console.log('✅ YouTube learning script injected');
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Wait for the page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectYouTubeLearning);
} else {
  injectYouTubeLearning();
}