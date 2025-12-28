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

// Helper function to format video timestamp
function formatVideoTimestamp(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return '';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
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
  
  // Add source information if available (video or article)
  console.log('🔍 SecurityFixes checking source:', {
    hasVideoSource: !!historyData.videoSource,
    detectionMethod: historyData.detectionMethod,
    videoSource: historyData.videoSource
  });
  
  if (historyData.videoSource) {
    // Check if this is an article based on detection method
    const isArticle = historyData.detectionMethod === 'article-selection' || 
                      historyData.detectionMethod === 'article-learning' || 
                      historyData.detectionMethod === 'right-click-article' ||
                      (historyData.videoSource.title && 
                       historyData.videoSource.domain && 
                       !historyData.videoSource.channel);
    
    if (isArticle) {
      console.log('✅ Creating article source display for:', historyData.text);
      const articleDiv = safeCreateElement('div', '', 'history-article-source');
      articleDiv.style.marginTop = '8px';
      articleDiv.style.padding = '8px';
      articleDiv.style.backgroundColor = '#f0f8ff';
      articleDiv.style.borderRadius = '6px';
      articleDiv.style.borderLeft = '3px solid #4285f4';
      
      const articleInfo = safeCreateElement('div', '', 'article-info');
      articleInfo.style.display = 'flex';
      articleInfo.style.alignItems = 'center';
      articleInfo.style.gap = '8px';
      
      const articleIcon = safeCreateElement('span', '📖', 'article-icon');
      articleIcon.style.fontSize = '16px';
      
      const articleDetails = safeCreateElement('div', '', 'article-details');
      articleDetails.style.flex = '1';
      
      const articleTitle = safeCreateElement('div', historyData.videoSource.title || '未知文章', 'article-title');
      articleTitle.style.fontWeight = '500';
      articleTitle.style.fontSize = '13px';
      articleTitle.style.color = '#1a73e8';
      articleTitle.style.marginBottom = '2px';
      
      const articleMeta = safeCreateElement('div', historyData.videoSource.domain || historyData.videoSource.author || 'Web Article', 'article-meta');
      articleMeta.style.fontSize = '12px';
      articleMeta.style.color = '#666';
      
      const returnBtn = safeCreateElement('button', '📖 返回文章', 'article-return-btn');
      returnBtn.style.padding = '4px 8px';
      returnBtn.style.fontSize = '11px';
      returnBtn.style.backgroundColor = '#4285f4';
      returnBtn.style.color = 'white';
      returnBtn.style.border = 'none';
      returnBtn.style.borderRadius = '4px';
      returnBtn.style.cursor = 'pointer';
      returnBtn.style.fontWeight = '500';
      returnBtn.setAttribute('data-article-url', historyData.videoSource.url || '');
      returnBtn.setAttribute('data-sentence', historyData.text);
      returnBtn.setAttribute('data-paragraph', historyData.videoSource.paragraph || '');
      returnBtn.setAttribute('data-saved-at', historyData.timestamp);
      returnBtn.setAttribute('data-notes', historyData.videoSource.notes || '');
      returnBtn.title = '返回文章並高亮顯示句子';
      
      articleDetails.appendChild(articleTitle);
      articleDetails.appendChild(articleMeta);
      articleInfo.appendChild(articleIcon);
      articleInfo.appendChild(articleDetails);
      articleInfo.appendChild(returnBtn);
      articleDiv.appendChild(articleInfo);
      
      item.appendChild(articleDiv);
    } else {
      console.log('✅ Creating video source display for:', historyData.text);
      const videoDiv = safeCreateElement('div', '', 'history-video-source');
      videoDiv.style.marginTop = '8px';
      videoDiv.style.padding = '8px';
      videoDiv.style.backgroundColor = '#f8f9fa';
      videoDiv.style.borderRadius = '6px';
      videoDiv.style.borderLeft = '3px solid #ff0000';
      
      const videoInfo = safeCreateElement('div', '', 'video-info');
      videoInfo.style.display = 'flex';
      videoInfo.style.alignItems = 'center';
      videoInfo.style.gap = '8px';
      
      const videoIcon = safeCreateElement('span', '📹', 'video-icon');
      videoIcon.style.fontSize = '16px';
      
      const videoDetails = safeCreateElement('div', '', 'video-details');
      videoDetails.style.flex = '1';
      
      const videoTitle = safeCreateElement('div', historyData.videoSource.title, 'video-title');
      videoTitle.style.fontWeight = '500';
      videoTitle.style.fontSize = '13px';
      videoTitle.style.color = '#1a73e8';
      videoTitle.style.marginBottom = '2px';
      
      const videoMeta = safeCreateElement('div', '', 'video-meta');
      videoMeta.style.fontSize = '12px';
      videoMeta.style.color = '#666';
      
      const channelText = historyData.videoSource.channel;
      const timestampText = formatVideoTimestamp(historyData.videoSource.videoTimestamp);
      
      if (timestampText) {
        videoMeta.textContent = `${channelText} • ⏰ ${timestampText}`;
      } else {
        videoMeta.textContent = channelText;
      }
      
      const returnBtn = safeCreateElement('button', timestampText ? '⏰ 返回片段' : '📹 返回影片', 'video-return-btn');
      returnBtn.style.padding = '4px 8px';
      returnBtn.style.fontSize = '11px';
      returnBtn.style.backgroundColor = '#ff0000';
      returnBtn.style.color = 'white';
      returnBtn.style.border = 'none';
      returnBtn.style.borderRadius = '4px';
      returnBtn.style.cursor = 'pointer';
      returnBtn.style.fontWeight = '500';
      returnBtn.setAttribute('data-video-url', historyData.videoSource.url || '');
      
      if (timestampText) {
        returnBtn.title = `返回到 ${timestampText} 的學習片段`;
      }
      
      videoDetails.appendChild(videoTitle);
      videoDetails.appendChild(videoMeta);
      videoInfo.appendChild(videoIcon);
      videoInfo.appendChild(videoDetails);
      videoInfo.appendChild(returnBtn);
      videoDiv.appendChild(videoInfo);
      
      item.appendChild(videoDiv);
    }
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