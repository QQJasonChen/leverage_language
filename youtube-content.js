// YouTube content script - handles communication with the extension
console.log('🎬 YouTube content script loaded');

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;
  
  if (event.data && event.data.type === 'YOUTUBE_LEARNING_TEXT') {
    console.log('📨 Received text from YouTube page:', event.data.text);
    
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'analyzeTextInSidepanel',
      text: event.data.text,
      url: window.location.href,
      title: document.title,
      source: 'youtube-learning'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('⚠️ Expected error:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ Text sent to background:', response);
      }
    });
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