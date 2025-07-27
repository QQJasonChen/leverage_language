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
  button.textContent = '📚 LEARN';
  button.title = 'YouTube Learning: Click=Copy | Shift+Click=Word Analysis | Alt+Click=Sentence Analysis';
  
  button.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    width: 90px !important;
    height: 45px !important;
    background-color: #ff4444 !important;
    color: white !important;
    border: 3px solid white !important;
    border-radius: 25px !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 14px !important;
    font-weight: bold !important;
    font-family: Arial, sans-serif !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    user-select: none !important;
    transition: all 0.2s ease !important;
  `;
  
  // Add hover effect
  button.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.05)';
    this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.6)';
  });
  
  button.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
  });
  
  button.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    isLearningEnabled = !isLearningEnabled;
    console.log('🔄 Learning mode:', isLearningEnabled ? 'ON' : 'OFF');
    
    // Notify user
    if (isLearningEnabled) {
      console.log('✅ Learning mode enabled! Select text to send to sidepanel.');
    } else {
      console.log('❌ Learning mode disabled.');
    }
    
    if (isLearningEnabled) {
      button.style.backgroundColor = '#44ff44';
      button.textContent = '✅ ON';
      enableTextLearning();
    } else {
      button.style.backgroundColor = '#ff4444';
      button.textContent = '📚 LEARN';
      disableTextLearning();
    }
  });
  
  learningButton = button;
  return button;
}

// Send text to extension
function sendToExtension(text) {
  console.log('📤 Sending to extension:', text);
  
  // In Manifest V3, injected page scripts cannot access chrome APIs directly
  // Always use postMessage to content script
  console.log('📡 Using postMessage to content script (Manifest V3 compliant)');
  
  const message = {
    type: 'YOUTUBE_LEARNING_TEXT',
    text: text,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
    language: 'english',
    source: 'youtube-learning'
  };
  
  console.log('📡 Posting message to content script:', message);
  window.postMessage(message, window.location.origin);
  
  // Show confirmation - determine type based on text length
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const confirmationType = words.length === 1 ? 'word-analyzed' : 'sentence-analyzed';
  showConfirmation(text, confirmationType);
}


// Copy to clipboard function
function copyToClipboard(text) {
  console.log('📋 Copying to clipboard:', text);
  
  // Try using the modern clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showConfirmation(text, 'copied');
    }).catch(() => {
      // Fallback to legacy method
      fallbackCopyToClipboard(text);
    });
  } else {
    // Fallback to legacy method
    fallbackCopyToClipboard(text);
  }
}

// Fallback copy method
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    showConfirmation(text, 'copied');
  } catch (err) {
    console.error('Failed to copy text:', err);
    showConfirmation('Copy failed', 'error');
  }
  
  document.body.removeChild(textArea);
}

// Add help tooltip to subtitles
function addHelpTooltip(subtitleElement) {
  const helpIcon = document.createElement('span');
  helpIcon.className = 'yt-help-icon';
  helpIcon.textContent = ' ❓';
  helpIcon.style.cssText = `
    cursor: help !important;
    opacity: 0.5 !important;
    font-size: 12px !important;
    margin-left: 4px !important;
  `;
  helpIcon.title = `YouTube Learning Controls:

Click Actions:
• Simple Click = Copy to clipboard (blue flash)
• Shift + Click = Send word to AI analysis (green flash)  
• Alt + Click = Send full sentence to AI analysis (orange flash)

Visual Feedback:
🔵 Blue = Copied to clipboard
🟢 Green = Word sent to AI
🟠 Orange = Sentence sent to AI

Tips:
• Enable subtitles/captions for best results
• Click the learning button to toggle mode
• Works with transcript panel too`;
  
  subtitleElement.appendChild(helpIcon);
}

// Show confirmation
function showConfirmation(text, type = 'sent') {
  const confirmation = document.createElement('div');
  
  const messages = {
    'sent': `📤 Sent to AI: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`,
    'copied': `📋 Copied: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`,
    'word-analyzed': `🔍 Word Analysis: "${text.length > 20 ? text.substring(0, 20) + '...' : text}"`,
    'sentence-analyzed': `📝 Sentence Analysis: "${text.length > 25 ? text.substring(0, 25) + '...' : text}"`,
    'error': `❌ ${text}`
  };
  
  const colors = {
    'sent': '#4CAF50',
    'copied': '#2196F3', 
    'word-analyzed': '#4CAF50',
    'sentence-analyzed': '#FF9800',
    'error': '#f44336'
  };
  
  confirmation.textContent = messages[type] || messages['sent'];
  confirmation.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    background: ${colors[type] || colors['sent']} !important;
    color: white !important;
    padding: 20px 30px !important;
    border-radius: 12px !important;
    font-size: 16px !important;
    font-weight: bold !important;
    z-index: 2147483647 !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
    border: 3px solid white !important;
    font-family: Arial, sans-serif !important;
    max-width: 300px !important;
    text-align: center !important;
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
    
    /* Highlight subtitles and transcript on hover to show they're interactive */
    .ytp-caption-segment:hover,
    .captions-text:hover,
    .ytd-transcript-segment-renderer:hover,
    .segment-text:hover,
    .ytd-transcript-body-renderer *:hover {
      background-color: rgba(255, 255, 0, 0.2) !important;
      cursor: pointer !important;
      border-radius: 3px !important;
      transition: background-color 0.2s !important;
    }
    
    .yt-word-selectable {
      padding: 2px 4px !important;
      margin: 0 1px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      display: inline-block !important;
      border: 1px solid transparent !important;
      position: relative !important;
    }
    
    .yt-word-selectable:hover {
      background-color: rgba(76, 175, 80, 0.3) !important;
      border-color: rgba(76, 175, 80, 0.8) !important;
      transform: scale(1.05) !important;
    }
    
    .yt-sentence-container {
      display: inline !important;
      margin: 0 2px !important;
    }
    
    .yt-sentence-container:hover .yt-word-selectable {
      background-color: rgba(255, 152, 0, 0.2) !important;
    }
    
    /* Enhanced subtitle indicators */
    [data-enhanced="true"] {
      border: 2px dashed rgba(76, 175, 80, 0.6) !important;
      padding: 4px 8px !important;
      margin: 2px 0 !important;
      border-radius: 6px !important;
      background: rgba(76, 175, 80, 0.1) !important;
      position: relative !important;
    }
    
    [data-enhanced="true"]:before {
      content: "✨ Enhanced" !important;
      position: absolute !important;
      top: -10px !important;
      left: 4px !important;
      background: #4CAF50 !important;
      color: white !important;
      font-size: 10px !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
      font-weight: bold !important;
    }
  `;
  document.head.appendChild(style);
  
  // Handle text selection
  document.addEventListener('mouseup', handleTextSelection);
  
  // Handle subtitle clicks - using proven working approach
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

// Handle subtitle clicks - Using proven working approach
function handleSubtitleClick(e) {
  if (!isLearningEnabled) return;
  
  const target = e.target;
  
  // Safety check: ensure target is an Element before calling matches
  if (!target || typeof target.matches !== 'function') return;
  
  console.log('🖱️ Click detected on:', {
    tagName: target.tagName,
    className: target.className,
    id: target.id,
    textContent: target.textContent?.substring(0, 50),
    parentClass: target.parentElement?.className,
    grandParentClass: target.parentElement?.parentElement?.className
  });
  
  // Comprehensive subtitle selectors for different YouTube layouts
  const subtitleSelectors = [
    // Live captions on video
    '.ytp-caption-segment',
    '.captions-text', 
    '.ytp-caption-window-container *',
    '.ytp-caption-window-bottom *',
    '.caption-window *',
    
    // Transcript panel selectors
    '.ytd-transcript-segment-renderer',
    '.ytd-transcript-segment-renderer *',
    '.segment-text',
    '.ytd-transcript-body-renderer *',
    '.ytd-transcript-search-panel-renderer *',
    
    // Auto-generated captions
    '.ytd-transcript-segment-list-renderer *',
    '.ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"] *',
    
    // Additional caption containers
    '[data-testid="transcript-segment"]',
    '[data-testid="transcript-segment"] *',
    '.transcript-segment',
    '.transcript-text'
  ];
  
  const selectorString = subtitleSelectors.join(', ');
  const isSubtitle = target.matches(selectorString) || target.closest(selectorString);
  
  console.log('🔍 Subtitle detection result:', isSubtitle);
  
  if (isSubtitle) {
    const subtitleElement = isSubtitle === true ? target : isSubtitle;
    const fullText = subtitleElement.textContent?.trim();
    
    console.log('📺 Subtitle found with text:', fullText);
    
    if (fullText && fullText.length > 0) {
      let selectedText = fullText; // Default to full text
      let selectionType = 'sentence';
      
      let actionType = 'copy'; // Default action
      
      // Determine action and selection based on modifier keys
      if (e.shiftKey) {
        // Shift + Click: Select word and send to AI analysis
        console.log('🔍 Shift+Click detected! Word selection for AI analysis...');
        try {
          const rect = subtitleElement.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          console.log('📍 Click position:', clickX, 'Element width:', rect.width);
          
          const selectedWord = getWordAtPosition(subtitleElement, clickX);
          console.log('🎯 Word detection result:', selectedWord);
          
          if (selectedWord && selectedWord.trim().length > 0) {
            selectedText = selectedWord.trim();
            selectionType = 'word';
            actionType = 'analyze';
            console.log('✅ Word selected for AI analysis (Shift+Click):', selectedText);
          } else {
            console.log('❌ Word detection failed, using full subtitle for analysis:', selectedText);
            actionType = 'analyze';
          }
        } catch (error) {
          console.log('❌ Word detection error:', error, 'using full subtitle for analysis:', selectedText);
          actionType = 'analyze';
        }
      } else if (e.altKey) {
        // Alt + Click: Full sentence to AI analysis
        console.log('📺 Alt+Click detected! Full sentence for AI analysis:', selectedText);
        selectionType = 'sentence';
        actionType = 'analyze';
      } else {
        // Simple Click: Copy to clipboard
        console.log('📋 Simple click detected! Copying to clipboard:', selectedText);
        selectionType = 'copy';
        actionType = 'copy';
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      // Visual feedback based on action type
      if (actionType === 'copy') {
        // Blue for copy action
        subtitleElement.style.backgroundColor = 'rgba(33, 150, 243, 0.7)';
        subtitleElement.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.5)';
      } else if (actionType === 'analyze') {
        if (selectionType === 'word') {
          // Green for word analysis
          subtitleElement.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';
          subtitleElement.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
        } else {
          // Orange for sentence analysis
          subtitleElement.style.backgroundColor = 'rgba(255, 152, 0, 0.7)';
          subtitleElement.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.5)';
        }
      }
      
      setTimeout(() => {
        subtitleElement.style.backgroundColor = '';
        subtitleElement.style.boxShadow = '';
      }, 800);
      
      // Perform the action
      if (actionType === 'copy') {
        console.log('📋 Copying to clipboard:', selectedText);
        copyToClipboard(selectedText);
        showConfirmation(selectedText, 'copied');
      } else if (actionType === 'analyze') {
        console.log('📨 Sending to AI analysis:', selectedText);
        sendToExtension(selectedText);
      }
    }
  }
}

// Get word at click position - from working version
function getWordAtPosition(element, clickX) {
  try {
    const text = element.textContent || '';
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 1) {
      return words[0];
    }
    
    // Create temporary spans to measure word positions (TrustedHTML safe)
    const originalText = element.textContent;
    const tempContainer = document.createElement('div');
    
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.setAttribute('data-word-index', index.toString());
      span.textContent = word;
      tempContainer.appendChild(span);
      if (index < words.length - 1) {
        tempContainer.appendChild(document.createTextNode(' '));
      }
    });
    
    // Replace element content temporarily
    const parent = element.parentNode;
    const nextSibling = element.nextSibling;
    parent.replaceChild(tempContainer, element);
    
    // Find which word was clicked
    let clickedWord = null;
    const spans = tempContainer.querySelectorAll('[data-word-index]');
    
    for (const span of spans) {
      const rect = span.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const spanLeft = rect.left - elementRect.left;
      const spanRight = rect.right - elementRect.left;
      
      if (clickX >= spanLeft && clickX <= spanRight) {
        clickedWord = span.textContent;
        break;
      }
    }
    
    // Restore original element
    element.textContent = originalText;
    parent.replaceChild(element, tempContainer);
    
    return clickedWord || words[0]; // Fallback to first word
  } catch (error) {
    console.error('Error in getWordAtPosition:', error);
    return element.textContent?.split(/\s+/)[0] || '';
  }
}

// Add help tooltip to enhanced subtitles
function addHelpTooltipIfNeeded(subtitleElement) {
  // Only add help tooltip once per element
  if (!subtitleElement.querySelector('.yt-help-icon')) {
    addHelpTooltip(subtitleElement);
  }
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
    el.textContent = text;
    delete el.dataset.enhanced;
  });
}

// Test communication function removed to avoid unwanted search messages

// Debug subtitle structure
function debugSubtitleStructure() {
  console.log('🔍 Debugging YouTube subtitle structure...');
  
  // Look for various subtitle selectors
  const selectors = [
    '.ytp-caption-segment',
    '.captions-text', 
    '.ytp-caption-window-container',
    '.caption-window',
    '.ytp-caption-window-bottom',
    '.ytp-caption-window-rollup',
    '.html5-video-container .captions-text',
    '[class*="caption"]',
    '[class*="subtitle"]'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
      elements.forEach((el, index) => {
        console.log(`   [${index}]:`, el.tagName, el.className, el.textContent?.substring(0, 50));
      });
    } else {
      console.log(`❌ No elements found for selector: ${selector}`);
    }
  });
  
  // Also check for any elements that might contain subtitle text
  const allElements = document.querySelectorAll('*');
  const possibleSubtitles = Array.from(allElements).filter(el => 
    el.textContent && 
    el.textContent.trim().length > 10 && 
    el.textContent.trim().length < 200 &&
    ((el.className || '').toLowerCase().includes('caption') || 
     (el.className || '').toLowerCase().includes('subtitle') ||
     (el.id || '').toLowerCase().includes('caption') ||
     (el.id || '').toLowerCase().includes('subtitle'))
  );
  
  if (possibleSubtitles.length > 0) {
    console.log('🎯 Possible subtitle elements found:');
    possibleSubtitles.forEach((el, index) => {
      console.log(`   [${index}]:`, el.tagName, el.className, el.id, el.textContent.substring(0, 50));
    });
  }
}

// Initialize
function initializeYouTubeLearning() {
  console.log('🚀 Initializing YouTube learning...');
  
  // Test communication removed to avoid unwanted search messages
  
  // Debug subtitle structure after 5 seconds to let YouTube load
  setTimeout(() => {
    console.log('🔍 Running subtitle structure debug...');
    debugSubtitleStructure();
  }, 5000);
  
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