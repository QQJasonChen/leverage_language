// YouTube page script - runs in the page context
console.log('🎓 YouTube page learning script loaded');

// Global state
let isLearningEnabled = false;
let learningButton = null;

// Create learning button
function createYouTubeLearningButton() {
  console.log('🔘 Creating YouTube learning button...');
  
  // Remove existing button
  const existing = document.querySelector('#yt-learning-btn');
  if (existing) existing.remove();
  
  const button = document.createElement('div');
  button.id = 'yt-learning-btn';
  button.innerHTML = '📚 LEARN';
  button.title = 'Click to enable text selection learning';
  
  button.style.cssText = `
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    width: 80px !important;
    height: 40px !important;
    background-color: #ff4444 !important;
    color: white !important;
    border: 3px solid white !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 12px !important;
    font-weight: bold !important;
    font-family: Arial, sans-serif !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    user-select: none !important;
  `;
  
  button.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    isLearningEnabled = !isLearningEnabled;
    console.log('🔄 Learning mode:', isLearningEnabled ? 'ON' : 'OFF');
    
    if (isLearningEnabled) {
      button.style.backgroundColor = '#44ff44';
      button.innerHTML = '✅ ON';
      enableTextLearning();
    } else {
      button.style.backgroundColor = '#ff4444';
      button.innerHTML = '📚 LEARN';
      disableTextLearning();
    }
  });
  
  learningButton = button;
  return button;
}

// Send text to extension
function sendToExtension(text) {
  console.log('📤 Sending to extension:', text);
  
  // Send message to content script via postMessage
  window.postMessage({
    type: 'YOUTUBE_LEARNING_TEXT',
    text: text
  }, window.location.origin);
  
  // Show confirmation
  showConfirmation(text);
}

// Show confirmation
function showConfirmation(text) {
  const confirmation = document.createElement('div');
  confirmation.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%) !important;
    color: white !important;
    padding: 20px 30px !important;
    border-radius: 12px !important;
    font-size: 16px !important;
    font-weight: bold !important;
    z-index: 2147483647 !important;
    box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4) !important;
    animation: popIn 0.3s ease-out !important;
  `;
  
  const displayText = text.length > 30 ? text.substring(0, 30) + '...' : text;
  confirmation.innerHTML = `
    ✅ Text Selected!<br>
    <span style="font-size: 14px; opacity: 0.9;">"${displayText}"</span><br>
    <span style="font-size: 12px; opacity: 0.8;">Open extension to analyze</span>
  `;
  
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.style.opacity = '0';
    confirmation.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => confirmation.remove(), 300);
  }, 2000);
}

// Enable learning features
function enableTextLearning() {
  console.log('🎯 Enabling text learning...');
  
  // Add styles
  const style = document.createElement('style');
  style.id = 'yt-learning-styles';
  style.textContent = `
    @keyframes popIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    
    ytd-video-description-content-section-renderer,
    #meta-contents,
    #content-text,
    yt-formatted-string,
    #comments,
    ytd-comment-thread-renderer {
      user-select: text !important;
      -webkit-user-select: text !important;
      cursor: text !important;
    }
    
    .ytp-caption-segment:hover,
    .captions-text:hover {
      background-color: rgba(76, 175, 80, 0.3) !important;
      cursor: pointer !important;
      border-radius: 4px !important;
      transition: background-color 0.2s !important;
    }
    
    .yt-word-selectable {
      padding: 2px 4px !important;
      margin: 0 1px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      display: inline-block !important;
    }
    
    .yt-word-selectable:hover {
      background-color: rgba(76, 175, 80, 0.5) !important;
      transform: scale(1.05) !important;
    }
  `;
  document.head.appendChild(style);
  
  // Handle text selection
  document.addEventListener('mouseup', handleTextSelection);
  
  // Handle subtitle clicks
  document.addEventListener('click', handleSubtitleClick, true);
}

// Handle text selection
function handleTextSelection(e) {
  if (!isLearningEnabled) return;
  
  // Skip if clicking on our UI elements
  if (e.target.closest('#yt-learning-btn')) return;
  
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.length > 0) {
      console.log('📝 Text selected:', text);
      sendToExtension(text);
      
      // Clear selection
      selection.removeAllRanges();
    }
  }, 50);
}

// Handle subtitle clicks
function handleSubtitleClick(e) {
  if (!isLearningEnabled) return;
  
  const target = e.target;
  
  // Check if clicking on subtitle
  const isSubtitle = target && (
    (target.classList && target.classList.contains('ytp-caption-segment')) ||
    (target.classList && target.classList.contains('captions-text')) ||
    (target.closest && target.closest('.ytp-caption-segment, .captions-text'))
  );
  
  if (isSubtitle) {
    e.preventDefault();
    e.stopPropagation();
    
    const subtitleElement = target.classList.contains('ytp-caption-segment') || 
                           target.classList.contains('captions-text') ? 
                           target : target.closest('.ytp-caption-segment, .captions-text');
    
    if (subtitleElement) {
      const text = subtitleElement.textContent.trim();
      if (text) {
        console.log('📺 Subtitle clicked:', text);
        enhanceSubtitle(subtitleElement);
      }
    }
  }
}

// Enhance subtitle for word selection
function enhanceSubtitle(subtitleElement) {
  const text = subtitleElement.textContent.trim();
  if (!text || subtitleElement.dataset.enhanced) return;
  
  console.log('🔧 Enhancing subtitle:', text);
  subtitleElement.dataset.enhanced = 'true';
  
  // Split into words
  const words = text.split(/\s+/);
  subtitleElement.innerHTML = '';
  
  words.forEach((word, index) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'yt-word-selectable';
    wordSpan.textContent = word;
    wordSpan.dataset.fullText = text;
    
    wordSpan.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      
      const textToSend = e.ctrlKey || e.metaKey ? this.dataset.fullText : word;
      console.log('📖 Word clicked:', textToSend);
      sendToExtension(textToSend);
      
      // Visual feedback
      this.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
      setTimeout(() => {
        this.style.backgroundColor = '';
      }, 300);
    });
    
    subtitleElement.appendChild(wordSpan);
    if (index < words.length - 1) {
      subtitleElement.appendChild(document.createTextNode(' '));
    }
  });
}

// Disable learning features
function disableTextLearning() {
  console.log('🔚 Disabling text learning...');
  
  // Remove styles
  const style = document.querySelector('#yt-learning-styles');
  if (style) style.remove();
  
  // Remove event listeners
  document.removeEventListener('mouseup', handleTextSelection);
  document.removeEventListener('click', handleSubtitleClick, true);
  
  // Clean up enhanced subtitles
  document.querySelectorAll('[data-enhanced="true"]').forEach(el => {
    const text = el.textContent;
    el.innerHTML = text;
    delete el.dataset.enhanced;
  });
}

// Initialize
function initializeYouTubeLearning() {
  console.log('🚀 Initializing YouTube learning...');
  
  if (!document.body) {
    setTimeout(initializeYouTubeLearning, 100);
    return;
  }
  
  const button = createYouTubeLearningButton();
  document.body.appendChild(button);
  
  // Keep button visible
  const observer = new MutationObserver(() => {
    if (!document.body.contains(button)) {
      document.body.appendChild(button);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  console.log('✅ YouTube learning ready!');
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeYouTubeLearning);
} else {
  setTimeout(initializeYouTubeLearning, 500);
}