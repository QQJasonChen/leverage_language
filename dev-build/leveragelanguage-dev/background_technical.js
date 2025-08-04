// Technical implementation of background service worker
// Handles message routing between YouTube content script and sidepanel

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // YouTube learning text analysis
  if (request.action === 'analyzeTextInSidepanel') {
    console.log('📨 Routing text to sidepanel:', request.text);
    
    // Open sidepanel and send the text
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
      // Send text to sidepanel after it opens
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'updateSidePanel',
          text: request.text,
          url: request.url,
          title: request.title,
          source: 'youtube-learning'
        });
      }, 300);
    }).catch(error => {
      // Sidepanel already open, send directly
      chrome.runtime.sendMessage({
        action: 'updateSidePanel',
        text: request.text,
        url: request.url,
        title: request.title,
        source: 'youtube-learning'
      });
    });
    
    sendResponse({ success: true });
    return false;
  }
  
});

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Language Learning Extension installed');
});