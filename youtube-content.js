// YouTube content script - handles communication with the extension
console.log('🎬 YouTube content script loaded');

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
    
    // Prepare message with all data from page script
    const messageToBackground = {
      action: 'analyzeTextInSidepanel',
      text: event.data.text,
      url: event.data.url || window.location.href,
      title: event.data.title || document.title,
      language: event.data.language || 'english',
      source: event.data.source || 'youtube-learning'
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