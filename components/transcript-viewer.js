// Transcript Viewer Component with Highlighting
// Allows users to read transcripts, highlight text, and jump to video timestamps

class TranscriptViewer {
  constructor(container, transcriptData) {
    this.container = container;
    this.transcriptData = transcriptData || [];
    this.highlights = [];
    this.videoId = this.getVideoId();
    this.selectedText = null;
    
    this.init();
    this.loadSavedHighlights();
  }

  init() {
    this.container.innerHTML = `
      <div class="transcript-viewer">
        <div class="transcript-header">
          <h3>📖 Transcript Reader</h3>
          <div class="transcript-actions">
            <button class="export-highlights-btn" title="Export saved sentences">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Export</span>
            </button>
          </div>
        </div>
        
        <div class="transcript-stats">
          <span class="segment-count">0 segments</span>
          <span class="highlight-count">0 highlights</span>
          <span class="duration">0:00</span>
        </div>
        
        <div class="transcript-content"></div>
        
        <div class="highlight-tooltip" style="display: none;">
          <button class="highlight-btn" title="Highlight (Cmd+Opt+H)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            Highlight
          </button>
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    this.addStyles();
    this.renderTranscript();
  }

  getVideoId() {
    // ✅ FIX: Enhanced video ID detection for sidepanel context
    
    // Method 1: Check if we have videoId in transcript data
    if (this.transcriptData && this.transcriptData.length > 0) {
      const firstSegment = this.transcriptData[0];
      if (firstSegment.videoId) {
        console.log('📺 Using videoId from transcript data:', firstSegment.videoId);
        return firstSegment.videoId;
      }
      
      // Extract from youtubeLink if available
      if (firstSegment.youtubeLink) {
        const match = firstSegment.youtubeLink.match(/[?&]v=([^&]+)/);
        if (match) {
          console.log('📺 Extracted videoId from youtubeLink:', match[1]);
          return match[1];
        }
      }
    }
    
    // Method 2: Try to get from current URL (works if we're on YouTube)
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    if (match) {
      console.log('📺 Extracted videoId from current URL:', match[1]);
      return match[1];
    }
    
    // Method 3: Try to get from active YouTube tab (async - will update later)
    this.getVideoIdFromTabs();
    
    console.log('❌ Could not extract video ID from any source');
    return null;
  }

  async getVideoIdFromTabs() {
    try {
      const tabs = await chrome.tabs.query({ url: "https://*.youtube.com/watch*" });
      if (tabs && tabs.length > 0) {
        const tab = tabs.find(t => t.active) || tabs[0];
        const tabMatch = tab.url.match(/[?&]v=([^&]+)/);
        if (tabMatch) {
          console.log('📺 Found videoId from YouTube tab:', tabMatch[1]);
          this.videoId = tabMatch[1]; // Cache it for future use
          return tabMatch[1];
        }
      }
    } catch (e) {
      console.log('❌ Could not query YouTube tabs:', e.message);
    }
    return null;
  }

  // ✅ NEW: Helper method to extract video ID from YouTube URL
  getVideoIdFromUrl(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  createYouTubeLink(timestampInSeconds) {
    const videoId = this.videoId || this.getVideoId();
    console.log('🔗 Creating YouTube link - videoId:', videoId, 'timestamp:', timestampInSeconds);
    
    if (!videoId) {
      console.log('❌ No video ID available for YouTube link generation');
      return '#';
    }
    
    const seconds = Math.floor(timestampInSeconds);
    const link = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
    console.log('✅ Generated YouTube link:', link);
    return link;
  }

  // Convert MM:SS timestamp to seconds
  convertTimestampToSeconds(timestamp) {
    if (typeof timestamp === 'number') return timestamp;
    
    // Handle MM:SS format (e.g., "10:50" -> 650 seconds)
    if (typeof timestamp === 'string' && timestamp.includes(':')) {
      const parts = timestamp.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0]) || 0;
        const seconds = parseInt(parts[1]) || 0;
        return (minutes * 60) + seconds;
      }
      // Handle H:MM:SS format (e.g., "1:10:50" -> 4250 seconds)
      if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        return (hours * 3600) + (minutes * 60) + seconds;
      }
    }
    
    return parseInt(timestamp) || 0;
  }

  // ✅ FIX: Enhanced grouping logic for better segment and chunk detection
  groupSegmentsByTimeGaps(segments) {
    if (!segments || segments.length === 0) return [];
    
    const groups = [];
    let currentGroup = null;
    const timeGapThreshold = 30; // seconds
    
    segments.forEach((segment, index) => {
      const segmentTime = segment.start || 0;
      
      // ✅ FIX: More precise group detection
      let shouldStartNewGroup = false;
      let groupType = 'continuation';
      
      if (!currentGroup) {
        // First segment always starts a new group
        shouldStartNewGroup = true;
        groupType = 'initial';
      } else if (segment.isNewTimeSegment) {
        // User jumped to different section - this is the most important grouping
        shouldStartNewGroup = true;
        groupType = 'time-segment';
        console.log(`🆕 NEW TIME SEGMENT detected at ${segment.originalTimestamp} - gap: ${segment.timeGapFromPrevious}s`);
      } else if (segment.isNewChunk) {
        // Automatic chunking within same viewing session
        shouldStartNewGroup = true;
        groupType = 'auto-chunk';
        console.log(`📦 NEW AUTO-CHUNK detected at ${segment.originalTimestamp} - chunk #${segment.chunkNumber}`);
      } else if (index > 0) {
        // Fallback: check actual time gap between consecutive segments
        const actualTimeGap = Math.abs(segmentTime - segments[index - 1].start);
        if (actualTimeGap > timeGapThreshold) {
          shouldStartNewGroup = true;
          groupType = 'time-gap';
          console.log(`⏱️ LARGE TIME GAP detected: ${actualTimeGap}s between segments`);
        }
      }
      
      if (shouldStartNewGroup) {
        currentGroup = {
          id: groups.length + 1,
          segments: [segment],
          startTime: segmentTime,
          endTime: segmentTime,
          startTimestamp: segment.originalTimestamp || this.formatTime(segmentTime),
          chunkNumber: segment.chunkNumber || 0,
          chunkStartTimestamp: segment.chunkStartTimestamp,
          groupType: groupType,
          isTimeSegment: groupType === 'time-segment',
          isAutoChunk: groupType === 'auto-chunk',
          timeGapFromPrevious: segment.timeGapFromPrevious || 0
        };
        groups.push(currentGroup);
      } else {
        currentGroup.segments.push(segment);
        currentGroup.endTime = segmentTime;
      }
    });
    
    console.log(`📊 ENHANCED GROUPING: ${segments.length} segments → ${groups.length} groups:`, 
      groups.map(g => `${g.startTimestamp} (${g.segments.length} sentences, type: ${g.groupType}${g.timeGapFromPrevious ? `, gap: ${Math.floor(g.timeGapFromPrevious)}s` : ''})`).join(', '));
    
    return groups;
  }

  async loadSavedHighlights() {
    if (!this.videoId) return;
    
    try {
      const result = await chrome.storage.local.get(`highlights_${this.videoId}`);
      this.highlights = result[`highlights_${this.videoId}`] || [];
      this.updateHighlightCount();
      this.applyHighlights();
    } catch (error) {
      console.error('Failed to load highlights:', error);
    }
  }

  async saveHighlights() {
    if (!this.videoId) return;
    
    try {
      await chrome.storage.local.set({
        [`highlights_${this.videoId}`]: this.highlights
      });
    } catch (error) {
      console.error('Failed to save highlights:', error);
    }
  }

  attachEventListeners() {
    const content = this.container.querySelector('.transcript-content');
    const highlightBtn = this.container.querySelector('.highlight-btn');
    const exportBtn = this.container.querySelector('.export-highlights-btn');
    
    // Text selection handling
    content.addEventListener('mouseup', (e) => this.handleTextSelection(e));
    content.addEventListener('touchend', (e) => this.handleTextSelection(e));
    
    // Highlight button
    highlightBtn.addEventListener('click', () => this.highlightSelection());
    
    // Keyboard shortcut (Cmd+Opt+H or Ctrl+Alt+H)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'h') {
        e.preventDefault();
        this.highlightSelection();
      }
    });
    
    // Table interaction handlers
    content.addEventListener('click', (e) => {
      // Handle edit mode clicks on text cells
      if (this.editMode && e.target.closest('.text-cell') && !e.target.closest('.edit-interface')) {
        e.preventDefault();
        e.stopPropagation();
        const textCell = e.target.closest('.text-cell');
        const segmentId = textCell.dataset.segmentId;
        if (segmentId !== null && segmentId !== undefined) {
          this.startEditingSegment(parseInt(segmentId));
        }
        return;
      }
      
      // Handle timestamp button clicks
      if (e.target.classList.contains('timestamp-btn')) {
        e.preventDefault();
        e.stopPropagation();
        
        const row = e.target.closest('.transcript-row');
        const startTime = parseFloat(row.dataset.start);
        
        // ✅ FIX: Add safety checks to prevent freezing
        if (isNaN(startTime) || startTime < 0) {
          console.error('Invalid timestamp:', startTime);
          return;
        }
        
        console.log('🎯 Seeking to time:', startTime);
        this.seekToTime(startTime);
        return;
      }
      
      // Handle save sentence button clicks
      if (e.target.classList.contains('save-sentence-btn')) {
        const text = e.target.dataset.text;
        const timestamp = e.target.dataset.timestamp;
        const link = e.target.dataset.link;
        const timestampInSeconds = this.convertTimestampToSeconds(timestamp);
        this.saveSentenceToHistory(text, timestamp, link, timestampInSeconds);
        return;
      }

      // ✅ FIX: Handle YouTube link button clicks
      if (e.target.classList.contains('youtube-link-btn')) {
        e.preventDefault();
        e.stopPropagation();
        
        const youtubeUrl = e.target.dataset.youtubeUrl;
        console.log('🎬 YouTube button clicked, URL:', youtubeUrl);
        console.log('🎬 Button element:', e.target);
        console.log('🎬 All datasets:', e.target.dataset);
        
        if (youtubeUrl && youtubeUrl !== '#' && youtubeUrl.startsWith('https://')) {
          console.log('✅ Opening YouTube at:', youtubeUrl);
          
          // ✅ FIX: Enhanced YouTube link opening - like saved tab functionality
          try {
            // First try to find existing YouTube tab with same video
            chrome.tabs.query({ url: `*youtube.com/watch?v=${this.getVideoIdFromUrl(youtubeUrl)}*` }, (existingTabs) => {
              if (existingTabs && existingTabs.length > 0) {
                // Found existing tab - update it and activate
                const existingTab = existingTabs[0];
                console.log('📺 Found existing YouTube tab, updating URL and activating');
                
                chrome.tabs.update(existingTab.id, { 
                  url: youtubeUrl, 
                  active: true 
                }, (updatedTab) => {
                  if (chrome.runtime.lastError) {
                    console.error('❌ Tab update failed:', chrome.runtime.lastError);
                    // Fallback to new tab
                    chrome.tabs.create({ url: youtubeUrl, active: true });
                  } else {
                    console.log('✅ Updated existing YouTube tab with timestamp');
                    this.showToast(`🎬 Jumped to YouTube at timestamp`);
                  }
                });
              } else {
                // No existing tab - create new one
                chrome.tabs.create({ url: youtubeUrl, active: true }, (tab) => {
                  if (chrome.runtime.lastError) {
                    console.error('❌ Chrome tabs.create failed:', chrome.runtime.lastError);
                    // Fallback to window.open
                    window.open(youtubeUrl, '_blank');
                  } else {
                    console.log('✅ Created new YouTube tab:', tab.id);
                    this.showToast(`🎬 Opened YouTube at timestamp`);
                  }
                });
              }
            });
          } catch (error) {
            console.error('❌ Failed to open YouTube tab:', error);
            // Fallback to window.open
            window.open(youtubeUrl, '_blank');
          }
        } else {
          console.error('❌ Invalid YouTube URL:', youtubeUrl);
          this.showToast('❌ Invalid YouTube URL');
        }
        return;
      }
      
      // Legacy segment click for old format
      const segment = e.target.closest('.transcript-segment');
      if (segment && !window.getSelection().toString()) {
        const startTime = parseFloat(segment.dataset.start);
        this.seekToTime(startTime);
      }
    });
    
    // Export highlights
    exportBtn.addEventListener('click', () => this.exportHighlights());
    
    // Remove tooltip on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.highlight-tooltip') && !window.getSelection().toString()) {
        this.hideHighlightTooltip();
      }
    });
  }

  handleTextSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      // Get selection range and position
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Find which segments are selected
      const segments = this.getSelectedSegments(range);
      
      if (segments.length > 0) {
        this.selectedText = {
          text: selectedText,
          segments: segments,
          range: range
        };
        
        this.showHighlightTooltip(rect);
      }
    } else {
      this.hideHighlightTooltip();
    }
  }

  getSelectedSegments(range) {
    const segments = [];
    const segmentElements = this.container.querySelectorAll('.transcript-segment');
    
    segmentElements.forEach(el => {
      if (range.intersectsNode(el)) {
        segments.push({
          index: parseInt(el.dataset.index),
          start: parseFloat(el.dataset.start),
          end: parseFloat(el.dataset.end),
          text: el.textContent
        });
      }
    });
    
    return segments;
  }

  showHighlightTooltip(rect) {
    const tooltip = this.container.querySelector('.highlight-tooltip');
    
    // Position tooltip above selection
    tooltip.style.display = 'block';
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
    
    // Adjust if tooltip goes off screen
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.left < 0) {
      tooltip.style.left = '10px';
    } else if (tooltipRect.right > window.innerWidth) {
      tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
    }
    
    if (tooltipRect.top < 0) {
      tooltip.style.top = `${rect.bottom + 10}px`;
    }
  }

  hideHighlightTooltip() {
    const tooltip = this.container.querySelector('.highlight-tooltip');
    tooltip.style.display = 'none';
  }

  highlightSelection() {
    if (!this.selectedText) return;
    
    // Extract timestamp and YouTube link info from selected segments
    const firstSegment = this.selectedText.segments[0];
    const segmentData = this.transcriptData[firstSegment.index];
    
    const highlight = {
      id: Date.now(),
      text: this.selectedText.text,
      segments: this.selectedText.segments,
      color: '#ffeb3b',
      created: new Date().toISOString(),
      // Learning-focused metadata
      timestamp: segmentData?.start || 0,
      originalTimestamp: segmentData?.originalTimestamp,
      youtubeLink: segmentData?.youtubeLink || this.createYouTubeLink(segmentData?.start || 0),
      videoId: this.videoId
    };
    
    this.highlights.push(highlight);
    this.applyHighlight(highlight);
    this.updateHighlightCount();
    this.saveHighlights();
    
    // Clear selection
    window.getSelection().removeAllRanges();
    this.hideHighlightTooltip();
    this.selectedText = null;
    
    // Show confirmation
    this.showToast('✅ Highlight saved!');
  }

  applyHighlights() {
    this.highlights.forEach(highlight => {
      this.applyHighlight(highlight);
    });
  }

  applyHighlight(highlight) {
    highlight.segments.forEach(segment => {
      const segmentEl = this.container.querySelector(`.transcript-segment[data-index="${segment.index}"]`);
      if (segmentEl) {
        // Mark as highlighted
        segmentEl.classList.add('has-highlight');
        
        // Store highlight ID for reference
        const existingHighlights = segmentEl.dataset.highlights ? 
          segmentEl.dataset.highlights.split(',') : [];
        existingHighlights.push(highlight.id);
        segmentEl.dataset.highlights = existingHighlights.join(',');
      }
    });
  }

  renderTranscript() {
    const content = this.container.querySelector('.transcript-content');
    
    if (!this.transcriptData || this.transcriptData.length === 0) {
      content.innerHTML = '<p class="no-transcript">No transcript available</p>';
      return;
    }
    
    // ✅ FIX: Group segments by time gaps to show separate collections
    const groupedSegments = this.groupSegmentsByTimeGaps(this.transcriptData);
    
    // Clean and prepare transcript segments
    const cleanedSegments = groupedSegments.map((group, groupIndex) => {
      return group.segments.map((segment, index) => {
        const timestampDisplay = segment.originalTimestamp || this.formatTime(segment.start);
        
        // Convert timestamp to seconds for proper YouTube links
        const timestampInSeconds = this.convertTimestampToSeconds(timestampDisplay);
        const youtubeLink = segment.youtubeLink || this.createYouTubeLink(timestampInSeconds);
        
        // Clean text: remove embedded timestamps and fragments
        let cleanText = segment.text
          .replace(/\d{1,2}:\d{2}/g, '') // Remove all timestamps
          .replace(/\s+/g, ' ') // Normalize spaces
          .replace(/^\s*[•·]\s*/, '') // Remove bullet points
          .replace(/got \d+/g, '') // Remove "got 14" fragments
          .replace(/Turning the Outline Into.*?(Quick.*?Dirty)/g, '') // Remove title fragments
          .replace(/sources \d+ searches/g, '') // Remove search info
          .replace(/CAGR|outpacing/g, '') // Remove business jargon fragments
          .trim();
        
        return {
          ...segment,
          index,
          groupIndex,
          timestampDisplay,
          timestampInSeconds,
          cleanText,
          youtubeLink,
          isGroupStart: index === 0,
          groupStartTime: group.startTime,
          groupEndTime: group.endTime,
          groupSegmentCount: group.segments.length
        };
      }).filter(seg => seg.cleanText && seg.cleanText.length > 10);
    }).flat();
    
    // Create table format
    const html = `
      <div class="transcript-table-container">
        <table class="transcript-table">
          <thead>
            <tr>
              <th class="timestamp-column">Timestamp</th>
              <th class="text-column">Transcript</th>
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${cleanedSegments.map((segment) => `
              ${segment.isGroupStart ? `
                <tr class="group-header-row">
                  <td colspan="3" class="group-header">
                    <div class="group-info">
                      ${this.getGroupHeaderText(groupedSegments[segment.groupIndex], segment)}
                      <span class="group-duration">(${segment.groupSegmentCount} 個句子)</span>
                      ${this.getGroupIndicator(groupedSegments[segment.groupIndex])}
                    </div>
                  </td>
                </tr>
              ` : ''}
              <tr class="transcript-row" 
                  data-index="${segment.index}"
                  data-start="${segment.timestampInSeconds}" 
                  data-timestamp="${segment.timestampDisplay}"
                  data-youtube-link="${segment.youtubeLink}"
                  data-group="${segment.groupIndex}">
                <td class="timestamp-cell">
                  <button class="timestamp-btn" title="Replay in extension">
                    ${segment.timestampDisplay}
                  </button>
                </td>
                <td class="text-cell" data-segment-id="${index}">
                  <span class="clean-text">${this.escapeHtml(segment.cleanText)}</span>
                  ${this.editMode ? '<div class="edit-indicator">✏️ Click to edit</div>' : ''}
                </td>
                <td class="actions-cell">
                  <button class="save-sentence-btn" title="Save to learning history" data-text="${this.escapeHtml(segment.cleanText)}" data-timestamp="${segment.timestampDisplay}" data-link="${segment.youtubeLink}">
                    💾
                  </button>
                  <button class="youtube-link-btn" data-youtube-url="${segment.youtubeLink && segment.youtubeLink !== '#' ? segment.youtubeLink : this.createYouTubeLink(segment.start)}" title="Jump to YouTube at ${segment.timestampDisplay}">
                    ⏰
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    content.innerHTML = html;
    
    // Update stats
    this.updateStats();
  }

  updateStats() {
    const segmentCount = this.container.querySelector('.segment-count');
    const duration = this.container.querySelector('.duration');
    
    segmentCount.textContent = `${this.transcriptData.length} segments`;
    
    if (this.transcriptData.length > 0) {
      const lastSegment = this.transcriptData[this.transcriptData.length - 1];
      duration.textContent = this.formatTime(lastSegment.end);
    }
  }

  updateHighlightCount() {
    const highlightCount = this.container.querySelector('.highlight-count');
    highlightCount.textContent = `${this.highlights.length} highlights`;
  }

  // ✅ NEW: Method to update transcript data and re-render
  updateTranscriptData(newTranscriptData) {
    console.log('🔄 Updating transcript data:', newTranscriptData.length, 'segments');
    this.transcriptData = newTranscriptData || [];
    
    // Update video ID if available
    if (this.transcriptData.length > 0 && this.transcriptData[0].videoId) {
      this.videoId = this.transcriptData[0].videoId;
    }
    
    // Re-render the transcript with new data
    this.renderTranscript();
    
    console.log('✅ Transcript viewer updated successfully');
  }

  // ✅ NEW: Helper method to get appropriate group header text
  getGroupHeaderText(group, segment) {
    if (!group) return `📁 收集片段 #${segment.groupIndex + 1}`;
    
    const startTimeText = segment.groupStartTime ? this.formatTime(segment.groupStartTime) : segment.timestampDisplay;
    
    switch (group.groupType) {
      case 'time-segment':
        return `🎯 學習片段 #${segment.groupIndex + 1} - 開始時間: ${startTimeText}`;
      case 'auto-chunk':
        return `📦 自動分段 #${segment.groupIndex + 1} - 開始時間: ${startTimeText}`;
      case 'time-gap':
        return `⏱️ 時間間隔片段 #${segment.groupIndex + 1} - 開始時間: ${startTimeText}`;
      default:
        return `📁 收集片段 #${segment.groupIndex + 1} - 開始時間: ${startTimeText}`;
    }
  }

  // ✅ NEW: Helper method to get group type indicator
  getGroupIndicator(group) {
    if (!group) return '';
    
    switch (group.groupType) {
      case 'time-segment':
        return `<span class="segment-indicator">🎯 跳轉片段</span>`;
      case 'auto-chunk':
        return `<span class="chunk-indicator">⏱️ 自動分塊</span>`;
      case 'time-gap':
        return `<span class="gap-indicator">⏭️ 時間間隔</span>`;
      default:
        return '';
    }
  }

  seekToTime(seconds) {
    // ✅ FIX: Add additional safety checks and debouncing to prevent freezing
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      console.error('❌ Invalid timestamp for seek:', seconds);
      this.showToast('❌ Invalid timestamp');
      return;
    }

    // ✅ FIX: Debounce rapid clicks to prevent browser freezing
    if (this.lastSeekTime && Date.now() - this.lastSeekTime < 1000) {
      console.log('⏸️ Debouncing rapid seek requests');
      return;
    }
    this.lastSeekTime = Date.now();
    
    console.log('🎯 Seeking to time:', seconds);
    
    try {
      // ✅ FIX: Query for YouTube tabs specifically
      chrome.tabs.query({ url: "https://*.youtube.com/*" }, (tabs) => {
        if (tabs && tabs.length > 0) {
          // Find the active YouTube tab or use the first one
          const activeTab = tabs.find(tab => tab.active) || tabs[0];
          
          console.log('📺 Sending seek message to YouTube tab:', activeTab.id);
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'seekToTime',
            time: Math.floor(seconds) // Ensure integer seconds
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Seek message failed:', chrome.runtime.lastError);
              this.showToast('❌ Failed to communicate with YouTube tab');
            } else if (response && response.success) {
              console.log('✅ Seek successful to', response.time);
              this.showToast(`✅ Jumped to ${this.formatTime(seconds)}`);
            } else {
              console.error('❌ Seek failed - no response or failed response');
              this.showToast('❌ Seek failed');
            }
          });
        } else {
          console.error('❌ No YouTube tabs found');
          this.showToast('❌ No YouTube tab found - open video in YouTube first');
        }
      });
      
    } catch (error) {
      console.error('❌ Seek error:', error);
      this.showToast('❌ Seek failed: ' + error.message);
    }
  }

  exportHighlights() {
    if (this.highlights.length === 0) {
      this.showToast('❌ No highlights to export');
      return;
    }
    
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent || 'YouTube Video';
    const videoUrl = window.location.href;
    
    let markdown = `# ${videoTitle}\n\n`;
    markdown += `**Video**: ${videoUrl}\n`;
    markdown += `**Date**: ${new Date().toLocaleDateString()}\n\n`;
    markdown += `## Highlights\n\n`;
    
    this.highlights.forEach((highlight, index) => {
      // Use stored YouTube link if available, otherwise create one
      const youtubeLink = highlight.youtubeLink || this.createYouTubeLink(highlight.timestamp);
      const timestampDisplay = highlight.originalTimestamp || this.formatTime(highlight.timestamp);
      const createdDate = new Date(highlight.created).toLocaleDateString();
      
      markdown += `${index + 1}. **[${timestampDisplay}](${youtubeLink})** - ${highlight.text}\n`;
      markdown += `   *Saved: ${createdDate}*\n\n`;
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(markdown).then(() => {
      this.showToast('✅ Highlights copied to clipboard!');
    });
  }

  async saveSentenceToHistory(text, timestamp, youtubeLink, timestampInSeconds) {
    try {
      console.log('💾 Saving sentence to learning history:', { text, timestamp, youtubeLink, timestampInSeconds });
      
      // Prepare learning data with timestamp and replay functionality
      const learningData = {
        searchText: text,
        language: 'english', // Default to English, can be detected later
        analysisData: {
          type: 'youtube_sentence',
          timestamp: timestamp,
          timestampInSeconds: timestampInSeconds,
          youtubeLink: youtubeLink,
          videoId: this.videoId,
          analysis: `YouTube Learning Sentence - ${timestamp}`,
          pronunciation: '', // Will be filled by AI if requested
          definition: '', // Will be filled by AI if requested
          example: text,
          source: 'youtube-transcript-viewer',
          hasReplayFunction: true,
          replayUrl: youtubeLink // For easy access in learning history
        },
        videoSource: youtubeLink,
        timestamp: timestamp,
        timestampInSeconds: timestampInSeconds
      };
      
      // Save using the existing storage manager (if available)
      if (window.storageManager) {
        await window.storageManager.saveAIReport(
          learningData.searchText,
          learningData.language,
          learningData.analysisData,
          null, // No audio for now
          learningData.videoSource,
          false // Don't update existing
        );
        
        console.log('✅ Successfully saved to learning history');
        this.showToast(`💾 Saved: "${text.substring(0, 30)}..." with timestamp ${timestamp}`);
        
        // Animate the save button to show success
        const saveBtn = document.querySelector(`[data-text="${text}"]`);
        if (saveBtn) {
          saveBtn.textContent = '✅';
          saveBtn.style.background = '#4CAF50';
          setTimeout(() => {
            saveBtn.textContent = '💾';
            saveBtn.style.background = '';
          }, 2000);
        }
        
      } else {
        // Fallback: Use chrome storage directly
        const result = await chrome.storage.local.get('aiReports');
        const reports = result.aiReports || [];
        
        reports.unshift({
          id: Date.now(),
          searchText: learningData.searchText,
          language: learningData.language,
          analysis: learningData.analysisData,
          timestamp: new Date().toISOString(),
          source: 'youtube-transcript-viewer'
        });
        
        await chrome.storage.local.set({ aiReports: reports });
        console.log('✅ Saved using fallback storage method');
        this.showToast(`💾 Saved: "${text.substring(0, 30)}..." - check your learning history!`);
      }
      
    } catch (error) {
      console.error('❌ Failed to save sentence:', error);
      this.showToast('❌ Failed to save sentence. Please try again.');
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'transcript-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .transcript-viewer {
        background: #f5f5f5;
        border-radius: 8px;
        padding: 15px;
        max-height: 600px;
        display: flex;
        flex-direction: column;
      }
      
      .transcript-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .transcript-header h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .transcript-actions {
        display: flex;
        gap: 8px;
      }
      
      .transcript-actions button {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .transcript-actions button:hover {
        background: #f0f0f0;
      }
      
      .transcript-actions button.active {
        background: #e3f2fd;
        border-color: #2196f3;
      }
      
      .transcript-stats {
        display: flex;
        gap: 15px;
        margin-bottom: 10px;
        font-size: 12px;
        color: #666;
      }
      
      .transcript-content {
        flex: 1;
        overflow-y: auto;
        background: white;
        border-radius: 4px;
        padding: 15px;
      }
      
      .transcript-segment {
        margin-bottom: 12px;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
      }
      
      .transcript-segment:hover {
        background: #f5f5f5;
      }
      
      .transcript-segment.has-highlight {
        background: #fff9c4;
      }
      
      .transcript-segment.has-highlight:hover {
        background: #fff59d;
      }
      
      .segment-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        opacity: 0.8;
      }
      
      .segment-timestamp {
        color: #2196f3;
        font-size: 11px;
        font-weight: 600;
        background: rgba(33, 150, 243, 0.1);
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .segment-timestamp:hover {
        background: rgba(33, 150, 243, 0.2);
        transform: scale(1.05);
      }
      
      .youtube-link {
        display: inline-flex;
        align-items: center;
        color: #ff0000;
        text-decoration: none;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s;
        opacity: 0.7;
      }
      
      .youtube-link:hover {
        opacity: 1;
        background: rgba(255, 0, 0, 0.1);
        transform: scale(1.1);
      }
      
      .youtube-link svg {
        width: 12px;
        height: 12px;
      }
      
      .transcript-content.show-timestamps .segment-header {
        display: flex;
      }
      
      .transcript-content:not(.show-timestamps) .segment-header {
        display: none;
      }
      
      .segment-text {
        line-height: 1.6;
        color: #333;
        font-size: 14px;
      }
      
      /* Table Format Styles */
      .transcript-table-container {
        max-height: 500px;
        overflow-y: auto;
        border-radius: 8px;
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .transcript-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      
      .transcript-table thead {
        background: #f8f9fa;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .transcript-table th {
        padding: 12px 8px;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
        font-weight: 600;
        color: #495057;
      }
      
      .timestamp-column {
        width: 80px;
        min-width: 80px;
      }
      
      .actions-column {
        width: 80px;
        min-width: 80px;
      }
      
      .text-column {
        width: auto;
      }
      
      .transcript-row {
        border-bottom: 1px solid #e9ecef;
        transition: background 0.2s;
      }
      
      .transcript-row:hover {
        background: #f8f9fa;
      }
      
      .transcript-table td {
        padding: 12px 8px;
        vertical-align: top;
      }
      
      .timestamp-btn {
        background: #e3f2fd;
        border: 1px solid #2196f3;
        color: #1976d2;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        transition: all 0.2s;
      }
      
      .timestamp-btn:hover {
        background: #2196f3;
        color: white;
        transform: scale(1.05);
      }
      
      .clean-text {
        line-height: 1.5;
        color: #333;
      }
      
      .actions-cell {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .save-sentence-btn {
        background: #4CAF50;
        border: none;
        padding: 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
      }
      
      .save-sentence-btn:hover {
        background: #45a049;
        transform: scale(1.1);
      }
      
      .youtube-link {
        color: #ff0000;
        text-decoration: none;
        font-size: 16px;
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
      }
      
      .youtube-link:hover {
        transform: scale(1.2);
      }
      
      /* ✅ NEW: Group header styling */
      .group-header-row {
        background: #e3f2fd !important;
        border-top: 3px solid #1976d2;
      }
      
      .group-header {
        padding: 12px 16px !important;
        background: linear-gradient(135deg, #e3f2fd, #bbdefb);
        border-left: 4px solid #1976d2;
      }
      
      .group-info {
        font-weight: 600;
        color: #1565c0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .group-duration {
        font-size: 12px;
        color: #666;
        font-weight: normal;
      }
      
      .chunk-indicator {
        font-size: 11px;
        background: #4CAF50;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 8px;
        font-weight: normal;
      }
      
      .segment-indicator {
        font-size: 11px;
        background: #ff9800;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 8px;
        font-weight: normal;
      }
      
      .gap-indicator {
        font-size: 11px;
        background: #9c27b0;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 8px;
        font-weight: normal;
      }
      
      /* ✅ NEW: YouTube link button styling */
      .youtube-link-btn {
        background: #ff4444;
        border: none;
        padding: 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        color: white;
      }
      
      .youtube-link-btn:hover {
        background: #ff6666;
        transform: scale(1.1);
      }
      
      /* Row grouping visual separation */
      .transcript-row[data-group]:not([data-group="0"]) {
        position: relative;
      }
      
      .transcript-row[data-group]:not([data-group="0"]):first-of-type {
        border-top: 2px solid #e0e0e0;
      }
      
      .highlight-tooltip {
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
      }
      
      .highlight-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #ffeb3b;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      }
      
      .highlight-btn:hover {
        background: #fdd835;
      }
      
      .transcript-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #333;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-size: 14px;
        transition: transform 0.3s;
        z-index: 10000;
      }
      
      .transcript-toast.show {
        transform: translateX(-50%) translateY(0);
      }
      
      .no-transcript {
        text-align: center;
        color: #999;
        padding: 40px;
      }
      
      ::selection {
        background: #b3d4fc;
      }
      
      /* Edit Mode Styles */
      .edit-mode-btn.active {
        background: #2196F3 !important;
        color: white !important;
      }
      
      .transcript-content.edit-mode .text-cell {
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .transcript-content.edit-mode .text-cell:hover {
        background-color: rgba(33, 150, 243, 0.1);
      }
      
      .edit-indicator {
        font-size: 10px;
        color: #666;
        opacity: 0.7;
        margin-top: 2px;
      }
      
      .edit-interface {
        width: 100%;
      }
      
      .edit-textarea {
        width: 100%;
        min-height: 60px;
        border: 2px solid #2196F3;
        border-radius: 4px;
        padding: 8px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
        background: white;
        box-sizing: border-box;
      }
      
      .edit-actions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        justify-content: flex-end;
      }
      
      .edit-actions button {
        padding: 4px 8px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        min-width: 24px;
        height: 24px;
      }
      
      .save-edit-btn {
        background: #4CAF50;
        color: white;
      }
      
      .ai-polish-btn {
        background: #FF9800;
        color: white;
      }
      
      .cancel-edit-btn {
        background: #f44336;
        color: white;
      }
      
      .edit-actions button:hover {
        transform: scale(1.05);
        opacity: 0.9;
      }
      
      .edit-actions button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
    `;
    document.head.appendChild(style);
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    const editBtn = this.container.querySelector('.edit-mode-btn');
    const content = this.container.querySelector('.transcript-content');
    
    if (this.editMode) {
      editBtn.classList.add('active');
      editBtn.querySelector('span').textContent = 'Exit Edit';
      content.classList.add('edit-mode');
      this.renderTranscript(); // Re-render to show edit indicators
      console.log('✏️ Edit mode enabled - click any segment to edit');
    } else {
      editBtn.classList.remove('active');
      editBtn.querySelector('span').textContent = 'Edit';
      content.classList.remove('edit-mode');
      this.exitEditingSegment();
      this.renderTranscript(); // Re-render to hide edit indicators
      console.log('✏️ Edit mode disabled');
    }
  }

  startEditingSegment(segmentIndex) {
    console.log('✏️ Starting to edit segment:', segmentIndex);
    
    // Exit any current editing
    this.exitEditingSegment();
    
    const segment = this.transcriptData[segmentIndex];
    if (!segment) return;
    
    this.editingSegmentId = segmentIndex;
    
    // Find the row and replace text with input
    const textCell = this.container.querySelector(`[data-segment-id="${segmentIndex}"]`);
    if (!textCell) return;
    
    const originalText = segment.text || segment.cleanText || '';
    
    // Create edit interface
    textCell.innerHTML = `
      <div class="edit-interface">
        <textarea class="edit-textarea" rows="3">${this.escapeHtml(originalText)}</textarea>
        <div class="edit-actions">
          <button class="save-edit-btn" title="Save changes">✓</button>
          <button class="ai-polish-btn" title="Polish with AI">✨</button>
          <button class="cancel-edit-btn" title="Cancel editing">✖</button>
        </div>
      </div>
    `;
    
    // Add event listeners for edit actions
    const textarea = textCell.querySelector('.edit-textarea');
    const saveBtn = textCell.querySelector('.save-edit-btn');
    const aiBtn = textCell.querySelector('.ai-polish-btn');
    const cancelBtn = textCell.querySelector('.cancel-edit-btn');
    
    textarea.focus();
    textarea.select();
    
    saveBtn.addEventListener('click', () => this.saveEdit(segmentIndex, textarea.value));
    aiBtn.addEventListener('click', () => this.polishWithAI(segmentIndex, textarea.value));
    cancelBtn.addEventListener('click', () => this.exitEditingSegment());
    
    // Save on Enter (Shift+Enter for multiline)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.saveEdit(segmentIndex, textarea.value);
      } else if (e.key === 'Escape') {
        this.exitEditingSegment();
      }
    });
  }

  exitEditingSegment() {
    if (this.editingSegmentId === null) return;
    
    // Restore original text display
    const textCell = this.container.querySelector(`[data-segment-id="${this.editingSegmentId}"]`);
    if (textCell) {
      const segment = this.transcriptData[this.editingSegmentId];
      const displayText = segment.text || segment.cleanText || '';
      textCell.innerHTML = `
        <span class="clean-text">${this.escapeHtml(displayText)}</span>
        ${this.editMode ? '<div class="edit-indicator">✏️ Click to edit</div>' : ''}
      `;
    }
    
    this.editingSegmentId = null;
  }

  saveEdit(segmentIndex, newText) {
    if (!newText.trim()) return;
    
    console.log('✅ Saving edit for segment:', segmentIndex, 'New text:', newText);
    
    // Update the segment data
    const segment = this.transcriptData[segmentIndex];
    segment.text = newText.trim();
    segment.cleanText = newText.trim();
    segment.editedManually = true;
    segment.editedAt = new Date().toISOString();
    
    // Update the display
    this.exitEditingSegment();
    
    // Optional: Save to storage for persistence
    this.saveEditToStorage(segmentIndex, newText);
    
    console.log('✅ Edit saved successfully');
  }

  async polishWithAI(segmentIndex, currentText) {
    if (!currentText.trim()) return;
    
    const aiBtn = this.container.querySelector('.ai-polish-btn');
    const textarea = this.container.querySelector('.edit-textarea');
    
    if (!aiBtn || !textarea) return;
    
    // Show loading state
    aiBtn.innerHTML = '⏳';
    aiBtn.disabled = true;
    
    try {
      console.log('✨ Polishing text with AI:', currentText);
      
      // Use the existing AI service from the extension
      if (window.aiService && typeof window.aiService.polishText === 'function') {
        const polishedText = await window.aiService.polishText(currentText);
        textarea.value = polishedText;
        console.log('✨ AI polishing complete:', polishedText);
      } else {
        // Fallback: Basic cleaning if AI service not available
        const cleaned = this.basicTextCleaning(currentText);
        textarea.value = cleaned;
        console.log('🧽 Basic cleaning applied:', cleaned);
      }
    } catch (error) {
      console.error('⚠️ AI polishing failed:', error);
      // Show user-friendly error
      textarea.value = this.basicTextCleaning(currentText);
    } finally {
      // Restore button state
      aiBtn.innerHTML = '✨';
      aiBtn.disabled = false;
    }
  }

  basicTextCleaning(text) {
    // Basic cleaning as fallback when AI is not available
    return text
      .replace(/\s+/g, ' ')
      .replace(/\b(\w+)\s+\1\b/g, '$1') // Remove word repetitions
      .replace(/([.!?])\s*([a-z])/g, (match, punct, letter) => punct + ' ' + letter.toUpperCase())
      .trim()
      .replace(/^./, str => str.toUpperCase());
  }

  saveEditToStorage(segmentIndex, newText) {
    // Save edit to local storage for persistence
    const editKey = `edit_${this.videoId}_${segmentIndex}`;
    chrome.storage.local.set({
      [editKey]: {
        originalIndex: segmentIndex,
        editedText: newText,
        timestamp: Date.now(),
        videoId: this.videoId
      }
    });
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptViewer;
} else {
  window.TranscriptViewer = TranscriptViewer;
}