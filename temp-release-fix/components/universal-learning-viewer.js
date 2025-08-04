// Universal Learning Viewer Component
// Combines YouTube transcripts and article sentences in one interface

class UniversalLearningViewer {
  constructor(container) {
    this.container = container;
    this.transcriptData = [];
    this.articleSelections = [];
    this.highlights = [];
    this.isEditMode = false;
    this.isBulkExportMode = false;
    this.currentFilter = 'all'; // 'all', 'youtube', 'articles', 'highlights'
    
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="universal-learning-viewer">
        <div class="viewer-header">
          <div class="viewer-title">
            <h3>📚 Learning Collection</h3>
            <div class="content-stats">
              <span class="youtube-count">0 videos</span>
              <span class="article-count">0 articles</span>
              <span class="highlight-count">0 highlights</span>
            </div>
          </div>
          
          <div class="viewer-controls">
            <button class="filter-btn active" data-filter="all">
              <span>All</span>
            </button>
            <button class="filter-btn" data-filter="youtube">
              <span>🎥 Videos</span>
            </button>
            <button class="filter-btn" data-filter="articles">
              <span>📰 Articles</span>
            </button>
            <button class="filter-btn" data-filter="highlights">
              <span>⭐ Highlights</span>
            </button>
            
            <div class="action-buttons">
              <button class="bulk-select-btn" title="Select multiple items">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
                <span>Select</span>
              </button>
              <button class="export-all-btn" title="Export all content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Bulk selection controls -->
        <div class="bulk-controls" style="display: none;">
          <div class="bulk-header">
            <div class="selection-info">
              <span class="selected-count">0 selected</span>
              <button class="select-all-btn">Select All</button>
              <button class="select-none-btn">Clear All</button>
            </div>
            <div class="bulk-actions">
              <button class="export-selected-btn" disabled>Export Selected</button>
              <button class="delete-selected-btn" disabled>Delete Selected</button>
              <button class="cancel-bulk-btn">Cancel</button>
            </div>
          </div>
        </div>
        
        <div class="content-container">
          <div class="loading-placeholder" style="display: none;">
            <div class="loading-spinner"></div>
            <p>Loading your learning content...</p>
          </div>
          
          <div class="empty-state" style="display: none;">
            <div class="empty-icon">📚</div>
            <h4>No learning content yet</h4>
            <p>Start collecting sentences from YouTube videos and articles!</p>
            <div class="quick-tips">
              <p><strong>YouTube:</strong> Use the transcript collector on any video</p>
              <p><strong>Articles:</strong> Select text on any webpage to save it</p>
            </div>
          </div>
          
          <div class="learning-timeline">
            <!-- Content will be populated here -->
          </div>
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    this.addStyles();
    this.loadContent();
  }

  attachEventListeners() {
    // Filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderContent();
      });
    });

    // Bulk selection
    const bulkSelectBtn = this.container.querySelector('.bulk-select-btn');
    const cancelBulkBtn = this.container.querySelector('.cancel-bulk-btn');
    const selectAllBtn = this.container.querySelector('.select-all-btn');
    const selectNoneBtn = this.container.querySelector('.select-none-btn');
    const exportSelectedBtn = this.container.querySelector('.export-selected-btn');
    const deleteSelectedBtn = this.container.querySelector('.delete-selected-btn');

    bulkSelectBtn.addEventListener('click', () => this.toggleBulkMode());
    cancelBulkBtn.addEventListener('click', () => this.toggleBulkMode());
    selectAllBtn.addEventListener('click', () => this.selectAll());
    selectNoneBtn.addEventListener('click', () => this.selectNone());
    exportSelectedBtn.addEventListener('click', () => this.exportSelected());
    deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());

    // Export all
    const exportAllBtn = this.container.querySelector('.export-all-btn');
    exportAllBtn.addEventListener('click', () => this.exportAll());
  }

  async loadContent() {
    this.showLoading();
    
    try {
      // Load from chrome storage
      const result = await chrome.storage.local.get(['learning-history', 'highlights']);
      
      // Parse learning history to separate YouTube and articles
      const learningHistory = result['learning-history'] || [];
      this.transcriptData = learningHistory.filter(item => 
        item.source === 'youtube' || item.method === 'youtube-transcript'
      );
      this.articleSelections = learningHistory.filter(item => 
        item.source === 'article' || item.method === 'article-selection'
      );
      this.highlights = result.highlights || [];
      
      this.updateStats();
      this.renderContent();
      
    } catch (error) {
      console.error('Error loading learning content:', error);
      this.showError('Failed to load learning content');
    }
  }

  showLoading() {
    this.container.querySelector('.loading-placeholder').style.display = 'block';
    this.container.querySelector('.learning-timeline').style.display = 'none';
    this.container.querySelector('.empty-state').style.display = 'none';
  }

  updateStats() {
    const youtubeCount = this.transcriptData.length;
    const articleCount = this.articleSelections.length;
    const highlightCount = this.highlights.length;
    
    this.container.querySelector('.youtube-count').textContent = `${youtubeCount} videos`;
    this.container.querySelector('.article-count').textContent = `${articleCount} articles`;
    this.container.querySelector('.highlight-count').textContent = `${highlightCount} highlights`;
  }

  renderContent() {
    this.container.querySelector('.loading-placeholder').style.display = 'none';
    
    let contentToShow = [];
    
    switch (this.currentFilter) {
      case 'youtube':
        contentToShow = this.transcriptData;
        break;
      case 'articles':
        contentToShow = this.articleSelections;
        break;
      case 'highlights':
        contentToShow = this.highlights;
        break;
      default: // 'all'
        contentToShow = [
          ...this.transcriptData.map(item => ({...item, type: 'youtube'})),
          ...this.articleSelections.map(item => ({...item, type: 'article'})),
          ...this.highlights.map(item => ({...item, type: 'highlight'}))
        ].sort((a, b) => (b.timestamp || b.created || 0) - (a.timestamp || a.created || 0));
    }
    
    const timeline = this.container.querySelector('.learning-timeline');
    const emptyState = this.container.querySelector('.empty-state');
    
    if (contentToShow.length === 0) {
      timeline.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    timeline.style.display = 'block';
    emptyState.style.display = 'none';
    
    timeline.innerHTML = contentToShow.map((item, index) => 
      this.createTimelineItem(item, index)
    ).join('');
    
    // Attach item event listeners
    this.attachItemEventListeners();
  }

  createTimelineItem(item, index) {
    const type = item.type || this.detectItemType(item);
    const date = new Date(item.timestamp || item.created || Date.now());
    const formattedDate = date.toLocaleDateString();
    
    let icon, title, subtitle, content, actionButton;
    
    switch (type) {
      case 'youtube':
        icon = '🎥';
        title = item.videoTitle || 'YouTube Video';
        subtitle = `${item.channelName || 'Unknown Channel'} • ${item.originalTimestamp || '0:00'}`;
        content = item.text || item.content || '';
        actionButton = `<button class="return-btn youtube" data-index="${index}" data-type="youtube" title="Return to video timestamp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="5 3 19 12 5 21"/>
          </svg>
          Watch
        </button>`;
        break;
        
      case 'article':
        icon = '📰';
        title = item.articleSource?.title || item.title || 'Web Article';
        subtitle = `${item.articleSource?.domain || new URL(item.url || '#').hostname} • ${formattedDate}`;
        content = item.text || item.content || '';
        actionButton = `<button class="return-btn article" data-index="${index}" data-type="article" title="Return to article">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Read
        </button>`;
        break;
        
      case 'highlight':
      default:
        icon = '⭐';
        title = 'Highlighted Text';
        subtitle = `Saved on ${formattedDate}`;
        content = item.text || item.content || '';
        actionButton = `<button class="return-btn highlight" data-index="${index}" data-type="highlight" title="View highlight">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        </button>`;
    }
    
    return `
      <div class="timeline-item ${type}" data-index="${index}" data-type="${type}">
        ${this.isBulkExportMode ? `
          <div class="bulk-checkbox-container">
            <input type="checkbox" class="item-checkbox" data-index="${index}">
          </div>
        ` : ''}
        <div class="timeline-icon">${icon}</div>
        <div class="timeline-content">
          <div class="item-header">
            <div class="item-info">
              <h4 class="item-title">${this.escapeHtml(title)}</h4>
              <p class="item-subtitle">${this.escapeHtml(subtitle)}</p>
            </div>
            <div class="item-actions">
              ${actionButton}
              <button class="more-btn" data-index="${index}" title="More options">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="5" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="item-content">
            <p class="content-text">${this.escapeHtml(content)}</p>
            ${item.notes ? `<p class="item-notes">📝 ${this.escapeHtml(item.notes)}</p>` : ''}
          </div>
          ${this.createItemMetadata(item, type)}
        </div>
      </div>
    `;
  }

  createItemMetadata(item, type) {
    const metadata = [];
    
    if (item.whisperTranscribed) metadata.push('🎙️ Whisper');
    if (item.aiPolished) metadata.push('✨ AI Enhanced');
    if (item.language && item.language !== 'en') metadata.push(`🌍 ${item.language.toUpperCase()}`);
    
    if (metadata.length === 0) return '';
    
    return `
      <div class="item-metadata">
        ${metadata.map(tag => `<span class="metadata-tag">${tag}</span>`).join('')}
      </div>
    `;
  }

  attachItemEventListeners() {
    // Return buttons
    const returnBtns = this.container.querySelectorAll('.return-btn');
    returnBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const type = btn.dataset.type;
        this.handleReturnToSource(index, type);
      });
    });

    // More options buttons
    const moreBtns = this.container.querySelectorAll('.more-btn');
    moreBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // TODO: Show context menu with options like delete, edit notes, etc.
        this.showItemContextMenu(btn);
      });
    });

    // Checkbox listeners for bulk mode
    if (this.isBulkExportMode) {
      const checkboxes = this.container.querySelectorAll('.item-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => this.updateBulkControls());
      });
    }
  }

  handleReturnToSource(index, type) {
    const allContent = this.getAllContent();
    const item = allContent[index];
    
    if (!item) return;
    
    switch (type) {
      case 'youtube':
        if (item.youtubeLink) {
          window.open(item.youtubeLink, '_blank');
        }
        break;
        
      case 'article':
        if (window.articleNavigator && item.articleSource?.url) {
          window.articleNavigator.navigateToArticle({
            text: item.text,
            articleSource: item.articleSource
          });
        }
        break;
        
      case 'highlight':
        // Show highlight details or return to source
        this.showHighlightDetails(item);
        break;
    }
  }

  getAllContent() {
    return [
      ...this.transcriptData.map(item => ({...item, type: 'youtube'})),
      ...this.articleSelections.map(item => ({...item, type: 'article'})),
      ...this.highlights.map(item => ({...item, type: 'highlight'}))
    ].sort((a, b) => (b.timestamp || b.created || 0) - (a.timestamp || a.created || 0));
  }

  detectItemType(item) {
    if (item.youtubeLink || item.videoTitle) return 'youtube';
    if (item.articleSource || item.url) return 'article';
    return 'highlight';
  }

  toggleBulkMode() {
    this.isBulkExportMode = !this.isBulkExportMode;
    
    const bulkControls = this.container.querySelector('.bulk-controls');
    bulkControls.style.display = this.isBulkExportMode ? 'block' : 'none';
    
    this.renderContent(); // Re-render to show/hide checkboxes
  }

  selectAll() {
    const checkboxes = this.container.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    this.updateBulkControls();
  }

  selectNone() {
    const checkboxes = this.container.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    this.updateBulkControls();
  }

  updateBulkControls() {
    const checkboxes = this.container.querySelectorAll('.item-checkbox');
    const checkedBoxes = this.container.querySelectorAll('.item-checkbox:checked');
    
    const selectedCount = this.container.querySelector('.selected-count');
    const exportBtn = this.container.querySelector('.export-selected-btn');
    const deleteBtn = this.container.querySelector('.delete-selected-btn');
    
    selectedCount.textContent = `${checkedBoxes.length} of ${checkboxes.length} selected`;
    exportBtn.disabled = checkedBoxes.length === 0;
    deleteBtn.disabled = checkedBoxes.length === 0;
  }

  exportSelected() {
    const checkedBoxes = this.container.querySelectorAll('.item-checkbox:checked');
    const allContent = this.getAllContent();
    const selectedItems = Array.from(checkedBoxes).map(cb => 
      allContent[parseInt(cb.dataset.index)]
    );
    
    this.performExport(selectedItems, 'selected items');
    this.toggleBulkMode();
  }

  exportAll() {
    const allContent = this.getAllContent();
    this.performExport(allContent, 'all learning content');
  }

  performExport(items, description) {
    const date = new Date().toLocaleDateString();
    let markdown = `# Learning Collection Export\n\n`;
    markdown += `**Date**: ${date}\n`;
    markdown += `**Items**: ${items.length} ${description}\n\n`;
    
    items.forEach((item, index) => {
      const type = this.detectItemType(item);
      const title = item.videoTitle || item.articleSource?.title || 'Saved Content';
      const text = item.text || item.content || '';
      const source = type === 'youtube' ? item.youtubeLink : 
                   type === 'article' ? item.articleSource?.url : '';
      
      markdown += `## ${index + 1}. ${this.escapeHtml(title)}\n\n`;
      markdown += `**Type**: ${type === 'youtube' ? '🎥 YouTube Video' : 
                                type === 'article' ? '📰 Article' : '⭐ Highlight'}\n`;
      if (source) markdown += `**Source**: ${source}\n`;
      markdown += `**Content**: ${this.escapeHtml(text)}\n\n`;
      if (item.notes) markdown += `**Notes**: ${this.escapeHtml(item.notes)}\n\n`;
      markdown += `---\n\n`;
    });
    
    // Copy to clipboard and download
    navigator.clipboard.writeText(markdown).then(() => {
      this.showToast(`✅ ${items.length} items exported to clipboard!`);
      this.downloadFile(markdown, `learning-collection-${date.replace(/\//g, '-')}.md`);
    }).catch(() => {
      this.downloadFile(markdown, `learning-collection-${date.replace(/\//g, '-')}.md`);
      this.showToast(`✅ ${items.length} items downloaded!`);
    });
  }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'learning-toast show';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    console.error(message);
    this.showToast(`❌ ${message}`);
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .universal-learning-viewer {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: white;
        border-radius: 8px;
        overflow: hidden;
      }

      .viewer-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px;
      }

      .viewer-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .viewer-title h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .content-stats {
        display: flex;
        gap: 12px;
        font-size: 12px;
        opacity: 0.9;
      }

      .viewer-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .filter-btn {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .filter-btn.active {
        background: white;
        color: #667eea;
      }

      .filter-btn:hover:not(.active) {
        background: rgba(255, 255, 255, 0.3);
      }

      .action-buttons {
        display: flex;
        gap: 8px;
      }

      .bulk-select-btn, .export-all-btn {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
      }

      .bulk-select-btn:hover, .export-all-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .bulk-controls {
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
        padding: 12px 16px;
      }

      .bulk-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .selection-info {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
      }

      .select-all-btn, .select-none-btn {
        background: none;
        border: 1px solid #dee2e6;
        color: #495057;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      }

      .bulk-actions {
        display: flex;
        gap: 8px;
      }

      .export-selected-btn, .delete-selected-btn, .cancel-bulk-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      }

      .export-selected-btn {
        background: #28a745;
        color: white;
      }

      .delete-selected-btn {
        background: #dc3545;
        color: white;
      }

      .cancel-bulk-btn {
        background: #6c757d;
        color: white;
      }

      .export-selected-btn:disabled, .delete-selected-btn:disabled {
        background: #6c757d;
        cursor: not-allowed;
      }

      .content-container {
        max-height: 600px;
        overflow-y: auto;
      }

      .loading-placeholder, .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #6c757d;
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .quick-tips {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-top: 16px;
        text-align: left;
      }

      .learning-timeline {
        padding: 16px;
      }

      .timeline-item {
        display: flex;
        gap: 12px;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 12px;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        transition: all 0.2s;
      }

      .timeline-item:hover {
        background: #e9ecef;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .timeline-item.youtube {
        border-left: 4px solid #ff0000;
      }

      .timeline-item.article {
        border-left: 4px solid #2196f3;
      }

      .timeline-item.highlight {
        border-left: 4px solid #ffeb3b;
      }

      .bulk-checkbox-container {
        display: flex;
        align-items: flex-start;
        padding-top: 2px;
      }

      .timeline-icon {
        font-size: 20px;
        line-height: 1;
        margin-top: 2px;
      }

      .timeline-content {
        flex: 1;
        min-width: 0;
      }

      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }

      .item-info {
        flex: 1;
        min-width: 0;
      }

      .item-title {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-subtitle {
        margin: 0;
        font-size: 12px;
        color: #6c757d;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }

      .return-btn, .more-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
      }

      .return-btn.youtube {
        color: #ff0000;
        border-color: #ffcdd2;
      }

      .return-btn.article {
        color: #2196f3;
        border-color: #bbdefb;
      }

      .return-btn.highlight {
        color: #ff9800;
        border-color: #ffe0b2;
      }

      .return-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .more-btn {
        color: #6c757d;
        padding: 4px;
      }

      .item-content {
        margin-bottom: 8px;
      }

      .content-text {
        margin: 0 0 8px 0;
        font-size: 13px;
        line-height: 1.4;
        color: #333;
      }

      .item-notes {
        margin: 0;
        font-size: 12px;
        color: #6c757d;
        font-style: italic;
      }

      .item-metadata {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .metadata-tag {
        background: rgba(0,0,0,0.05);
        color: #6c757d;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
      }

      .learning-toast {
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

      .learning-toast.show {
        transform: translateX(-50%) translateY(0);
      }
    `;
    document.head.appendChild(style);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalLearningViewer;
}