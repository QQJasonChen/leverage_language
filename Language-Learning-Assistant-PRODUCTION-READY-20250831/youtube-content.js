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
        const rawTimestamp = Math.floor(video.currentTime);
        // Subtract 2 seconds to catch sentence beginning (but not below 0)
        const adjustedTimestamp = Math.max(0, rawTimestamp - 2);
        console.log('✅ Video timestamp from video element:', rawTimestamp, 'seconds');
        console.log('🎯 Adjusted timestamp (minus 2s for sentence start):', adjustedTimestamp, 'seconds');
        return adjustedTimestamp;
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
        const rawTimestamp = Math.floor(altVideo.currentTime);
        // Subtract 2 seconds to catch sentence beginning (but not below 0)
        const adjustedTimestamp = Math.max(0, rawTimestamp - 2);
        console.log(`✅ Video timestamp from ${selector}:`, rawTimestamp, 'seconds');
        console.log('🎯 Adjusted timestamp (minus 2s for sentence start):', adjustedTimestamp, 'seconds');
        return adjustedTimestamp;
      }
    }
    
    console.log('❌ No video timestamp could be determined');
    return null;
  } catch (error) {
    console.warn('⚠️ Could not get video timestamp:', error);
    return null;
  }
}

// Create timestamped URL for returning to exact moment
function createTimestampedUrl(baseUrl, timestamp) {
  try {
    // Clean the base URL - remove any existing timestamp parameters
    let cleanUrl = baseUrl;
    
    // Handle different YouTube URL formats
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      cleanUrl = cleanUrl.split('&t=')[0].split('?t=')[0].split('#t=')[0];
      
      const url = new URL(cleanUrl);
      
      // Only add timestamp if we have a valid one
      if (timestamp !== null && timestamp >= 0 && !isNaN(timestamp)) {
        url.searchParams.set('t', `${timestamp}s`);
        console.log('🔗 Created timestamped URL:', url.toString(), `(timestamp: ${timestamp}s)`);
        return url.toString();
      } else {
        console.log('🔗 No valid timestamp, returning clean URL:', cleanUrl);
        return cleanUrl;
      }
    }
    
    // For non-YouTube URLs, just return as-is
    return baseUrl;
  } catch (error) {
    console.warn('⚠️ Could not create timestamped URL:', error);
    return baseUrl;
  }
}

// Show user-friendly message when extension context is invalidated
function showContextInvalidatedMessage() {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: #ff9800 !important;
    color: white !important;
    padding: 12px 20px !important;
    border-radius: 8px !important;
    font-size: 14px !important;
    font-weight: bold !important;
    z-index: 9999999 !important;
    font-family: Arial, sans-serif !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
  `;
  notification.textContent = '📚 Extension updated! Please refresh the page to continue learning.';
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) {
    return; // Silently ignore other origins
  }
  
  // Filter out noise from other extensions and services
  if (!event.data || !event.data.type) {
    return; // Silently ignore messages without proper structure
  }
  
  // Only log our own messages to reduce console noise
  if (event.data.type === 'YOUTUBE_LEARNING_TEXT') {
    console.log('🔔 Content script received YouTube learning message:', event.data.text);
  } else {
    return; // Silently ignore non-learning messages
  }
  
  if (event.data && event.data.type === 'YOUTUBE_LEARNING_TEXT') {
    console.log('📨 Processing YouTube learning text:', event.data.text);
    
    // CRITICAL: Capture video timestamp
    const videoTimestamp = getCurrentVideoTimestamp();
    console.log('⏰ Captured video timestamp:', videoTimestamp);
    
    // Create timestamped URL for returning to exact moment
    const baseUrl = event.data.url || window.location.href;
    const timestampedUrl = createTimestampedUrl(baseUrl, videoTimestamp);
    
    // Validate timestamp URL format (like your example: t=615s)
    if (videoTimestamp !== null) {
      const expectedParam = `t=${videoTimestamp}s`;
      if (timestampedUrl.includes(expectedParam)) {
        console.log('✅ Timestamp URL validation passed:', expectedParam, '(adjusted for sentence start)');
      } else {
        console.warn('⚠️ Timestamp URL validation failed!', { videoTimestamp, expectedParam, timestampedUrl });
      }
    }
    
    // Prepare message with all data from page script
    const messageToBackground = {
      action: 'analyzeTextInSidepanel',
      text: event.data.text,
      url: timestampedUrl, // Use timestamped URL instead of original
      originalUrl: baseUrl, // Keep original URL for reference
      title: event.data.title || document.title,
      language: event.data.language || 'english',
      source: event.data.source || 'youtube-learning',
      timestamp: videoTimestamp // Raw timestamp in seconds
    };
    
    console.log('🚀 Sending to background script:', messageToBackground);
    
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.error('❌ Extension context invalid - chrome.runtime not available');
      showContextInvalidatedMessage();
      return;
    }
    
    // Additional check for runtime ID availability
    try {
      if (!chrome.runtime.id) {
        console.error('❌ Extension runtime ID not available - context invalidated');
        showContextInvalidatedMessage();
        return;
      }
    } catch (error) {
      console.error('❌ Cannot access chrome.runtime.id - context invalidated');
      showContextInvalidatedMessage();
      return;
    }
    
    // Send to background script with robust error handling
    try {
      chrome.runtime.sendMessage(messageToBackground, (response) => {
        // Check if runtime is still valid in callback
        if (!chrome.runtime || !chrome.runtime.lastError) {
          // Runtime might be invalidated but no lastError - check for response
          if (response === undefined && !chrome.runtime) {
            console.error('❌ Extension context invalidated during message sending');
            showContextInvalidatedMessage();
            return;
          }
        }
        
        if (chrome.runtime && chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          console.error('❌ Runtime error sending to background:', error);
          
          if (error.includes('Extension context invalidated') || error.includes('message port closed')) {
            console.log('🔄 Extension context invalidated - page needs reload');
            showContextInvalidatedMessage();
          } else {
            console.log('📝 Other runtime error, continuing...');
          }
        } else {
          console.log('✅ Successfully sent to background script:', response);
          console.log('📝 Message processed successfully');
        }
      });
    } catch (error) {
      console.error('❌ Failed to send message to background:', error);
      if (error.message.includes('Extension context invalidated') || 
          error.message.includes('message port closed') ||
          error.message.includes('runtime is not available')) {
        showContextInvalidatedMessage();
      }
    }
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