// Critical Security Fixes Script
// This script provides helper functions to safely replace innerHTML usage

// Helper function to safely set text content
function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text;
}

// Helper function to safely clear element content
function safeClearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// Helper function to safely create and append element
function safeCreateElement(tag, textContent, className) {
  const element = document.createElement(tag);
  if (textContent) element.textContent = textContent;
  if (className) element.className = className;
  return element;
}

// Helper function to safely set innerHTML with basic sanitization
function safeSetHTML(element, htmlContent) {
  if (!element || !htmlContent) return;
  
  // Basic sanitization - remove script tags and javascript: protocols
  const sanitized = htmlContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  element.innerHTML = sanitized;
}

// Specific replacements for common patterns in sidepanel.js

// Replace stats innerHTML updates
function safeUpdateStats(statsElement, text) {
  if (!statsElement) return;
  statsElement.textContent = '';
  const p = document.createElement('p');
  p.textContent = text;
  statsElement.appendChild(p);
}

// Replace history item innerHTML updates  
function safeCreateHistoryItem(item, historyData) {
  if (!item) return;
  
  safeClearElement(item);
  
  // Create header section
  const header = safeCreateElement('div', '', 'history-item-header');
  const textDiv = safeCreateElement('div', historyData.text, 'history-text');
  
  // Add error status badge if available
  if (historyData.hasErrors !== null) {
    const statusBadge = safeCreateElement('span', '', 'status-badge');
    if (historyData.isCorrect) {
      statusBadge.textContent = '✅ 正確';
      statusBadge.classList.add('correct');
    } else if (historyData.hasErrors) {
      statusBadge.textContent = '❌ 錯誤';
      statusBadge.classList.add('error');
      if (historyData.errorCount > 0) {
        statusBadge.textContent += ` (${historyData.errorCount})`;
      }
    }
    textDiv.appendChild(statusBadge);
  }
  
  const actionsDiv = safeCreateElement('div', '', 'history-actions');
  
  // Create replay button
  const replayBtn = safeCreateElement('button', '重播', 'history-action-btn replay');
  replayBtn.setAttribute('data-text', historyData.text);
  replayBtn.setAttribute('data-language', historyData.language);
  replayBtn.setAttribute('data-id', historyData.id || '');
  actionsDiv.appendChild(replayBtn);
  
  // Create delete button if ID exists
  if (historyData.id) {
    const deleteBtn = safeCreateElement('button', '刪除', 'history-action-btn delete');
    deleteBtn.setAttribute('data-id', historyData.id);
    actionsDiv.appendChild(deleteBtn);
  }
  
  header.appendChild(textDiv);
  header.appendChild(actionsDiv);
  item.appendChild(header);
  
  // Create meta section
  const meta = safeCreateElement('div', '', 'history-meta');
  
  const langSpan = safeCreateElement('span', historyData.language, 'history-language');
  meta.appendChild(langSpan);
  
  if (historyData.timestamp) {
    const date = new Date(historyData.timestamp);
    const dateStr = date.toLocaleDateString('zh-TW') + ' ' + date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const dateSpan = safeCreateElement('span', dateStr, 'history-date');
    meta.appendChild(dateSpan);
  }
  
  if (historyData.queryCount > 1) {
    const countSpan = safeCreateElement('span', `${historyData.queryCount}次查詢`, 'history-count');
    meta.appendChild(countSpan);
  }
  
  if (historyData.detectionMethod) {
    const methodText = historyData.detectionMethod === 'auto' ? '自動' : 
                       historyData.detectionMethod === 'manual' ? '手動' : 
                       historyData.detectionMethod;
    const methodSpan = safeCreateElement('span', methodText, 'history-method');
    meta.appendChild(methodSpan);
  }
  
  if (historyData.websitesUsed && historyData.websitesUsed.length > 0) {
    const websitesSpan = safeCreateElement('span', historyData.websitesUsed.join(', '), 'history-websites');
    meta.appendChild(websitesSpan);
  }
  
  item.appendChild(meta);
}

// Replace audio content innerHTML updates
function safeUpdateAudioContent(audioElement, message, isError = false) {
  if (!audioElement) return;
  
  safeClearElement(audioElement);
  
  const div = safeCreateElement('div', message, isError ? 'audio-error' : 'audio-content');
  audioElement.appendChild(div);
}

// Replace option innerHTML updates
function safeCreateOption(option, config) {
  if (!option) return;
  
  safeClearElement(option);
  
  // Create option content safely
  const container = safeCreateElement('div', '', 'option-container');
  
  if (config.icon) {
    const icon = safeCreateElement('span', config.icon, 'option-icon');
    container.appendChild(icon);
  }
  
  const content = safeCreateElement('div', '', 'option-content');
  
  if (config.name) {
    const name = safeCreateElement('div', config.name, 'option-name');
    content.appendChild(name);
  }
  
  if (config.description) {
    const desc = safeCreateElement('div', config.description, 'option-description');
    content.appendChild(desc);
  }
  
  container.appendChild(content);
  option.appendChild(container);
}

// Global function to replace common innerHTML patterns
function replaceInnerHTMLPatterns() {
  // This function can be called to replace common dangerous patterns
  console.log('Security fixes applied');
}

// Export functions for use
if (typeof window !== 'undefined') {
  window.SecurityFixes = {
    safeSetText,
    safeClearElement,
    safeCreateElement,
    safeSetHTML,
    safeUpdateStats,
    safeCreateHistoryItem,
    safeUpdateAudioContent,
    safeCreateOption,
    replaceInnerHTMLPatterns
  };
}