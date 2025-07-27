// Transcript Restructurer Component
// Handles UI and interaction for restructuring YouTube subtitles

class TranscriptRestructurer {
  constructor(container, aiService) {
    this.container = container;
    this.aiService = aiService;
    
    // Check if YouTubeTranscriptFetcher is available
    if (typeof YouTubeTranscriptFetcher === 'undefined') {
      console.error('YouTubeTranscriptFetcher not found. Make sure youtube-transcript.js is loaded first.');
      throw new Error('YouTubeTranscriptFetcher dependency not found');
    }
    
    this.transcriptFetcher = new YouTubeTranscriptFetcher();
    this.currentTranscript = null;
    this.restructuredSentences = null;
    
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="transcript-restructurer">
        <div class="transcript-header">
          <h3>Transcript Restructurer</h3>
          <div class="header-buttons">
            <button class="check-captions-btn" title="Check if video has captions">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Check CC
            </button>
            <button class="list-tabs-btn" title="List all YouTube tabs">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              List Tabs
            </button>
            <button class="fetch-transcript-btn" title="Fetch and restructure transcript">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 12h16m0 0l-4-4m4 4l-4 4"/>
              </svg>
              Get Transcript
            </button>
          </div>
        </div>
        
        <div class="transcript-options">
          <label>
            <input type="checkbox" id="use-ai-restructure" checked>
            Use AI for better punctuation
          </label>
          <label>
            Pause threshold (seconds):
            <input type="number" id="pause-threshold" value="1.5" min="0.5" max="5" step="0.1">
          </label>
        </div>
        
        <div class="transcript-status"></div>
        
        <div class="transcript-content">
          <div class="original-transcript" style="display: none;">
            <h4>Original (Auto-generated)</h4>
            <div class="transcript-text"></div>
          </div>
          
          <div class="restructured-transcript" style="display: none;">
            <h4>Restructured</h4>
            <div class="transcript-sentences"></div>
          </div>
        </div>
        
        <div class="transcript-actions" style="display: none;">
          <button class="copy-transcript-btn">Copy All</button>
          <button class="export-transcript-btn">Export</button>
          <button class="toggle-view-btn">Toggle View</button>
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    this.addStyles();
  }

  attachEventListeners() {
    const checkBtn = this.container.querySelector('.check-captions-btn');
    const listTabsBtn = this.container.querySelector('.list-tabs-btn');
    const fetchBtn = this.container.querySelector('.fetch-transcript-btn');
    const copyBtn = this.container.querySelector('.copy-transcript-btn');
    const exportBtn = this.container.querySelector('.export-transcript-btn');
    const toggleBtn = this.container.querySelector('.toggle-view-btn');
    
    checkBtn.addEventListener('click', () => this.checkCaptions());
    listTabsBtn.addEventListener('click', () => this.listYouTubeTabs());
    fetchBtn.addEventListener('click', () => this.fetchAndRestructure());
    copyBtn.addEventListener('click', () => this.copyTranscript());
    exportBtn.addEventListener('click', () => this.exportTranscript());
    toggleBtn.addEventListener('click', () => this.toggleView());
    
    // Listen for sentence clicks to play from that point
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('sentence-text')) {
        const startTime = parseFloat(e.target.dataset.start);
        this.seekToTime(startTime);
      }
    });
  }

  async listYouTubeTabs() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Listing YouTube tabs...';
    statusEl.className = 'transcript-status loading';
    
    try {
      // Get all tabs
      const allTabs = await chrome.tabs.query({});
      const youtubeTabs = allTabs.filter(tab => tab.url && tab.url.includes('youtube.com/watch'));
      
      console.log('🎬 All YouTube video tabs:', youtubeTabs);
      
      if (youtubeTabs.length === 0) {
        statusEl.textContent = '❌ No YouTube video tabs found';
        statusEl.className = 'transcript-status error';
        return;
      }
      
      // Show list of YouTube tabs
      let tabList = `Found ${youtubeTabs.length} YouTube tab(s):\n`;
      youtubeTabs.forEach((tab, index) => {
        const isActive = tab.active ? ' (ACTIVE)' : '';
        tabList += `${index + 1}. ${tab.title}${isActive}\n`;
      });
      
      statusEl.innerHTML = tabList.replace(/\n/g, '<br>');
      statusEl.className = 'transcript-status success';
      
      console.log('📋 YouTube tabs found:', tabList);
      
    } catch (error) {
      console.error('❌ List tabs error:', error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  async checkCaptions() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Checking for captions...';
    statusEl.className = 'transcript-status loading';
    
    try {
      console.log('🔍 Checking tabs...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('📍 Found tabs:', tabs.length);
      
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      
      const tab = tabs[0];
      console.log('🎯 Current tab:', {
        id: tab.id,
        url: tab.url,
        title: tab.title
      });
      
      if (!tab.url.includes('youtube.com/watch')) {
        throw new Error(`Current tab is not a YouTube video. Tab URL: ${tab.url}`);
      }
      
      statusEl.textContent = `Checking captions on: ${tab.title}...`;
      
      // Send a test message to check caption availability
      console.log('📡 Sending message to tab:', tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getYouTubeTranscript' 
      });
      
      console.log('📨 Response received:', response);
      
      if (response && response.success) {
        statusEl.textContent = `✅ Captions available! Found ${response.transcript.length} segments via ${response.method}`;
        statusEl.className = 'transcript-status success';
      } else {
        statusEl.textContent = `❌ ${response?.error || 'No captions found'}`;
        statusEl.className = 'transcript-status error';
      }
      
    } catch (error) {
      console.error('❌ Check captions error:', error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  async fetchAndRestructure() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Fetching transcript...';
    statusEl.className = 'transcript-status loading';
    
    try {
      console.log('🎬 Starting transcript fetch...');
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      console.log('📍 Current tab URL:', tab.url);
      
      if (!tab.url.includes('youtube.com/watch')) {
        throw new Error('Please open a YouTube video first');
      }
      
      statusEl.textContent = 'Connecting to YouTube page...';
      
      // Send message to content script
      console.log('📡 Sending message to content script...');
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getYouTubeTranscript' });
      
      console.log('📨 Content script response:', response);
      
      if (!response || !response.success) {
        const errorMsg = response?.error || 'Failed to fetch transcript - no response from content script';
        console.error('❌ Transcript fetch failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!response.transcript || response.transcript.length === 0) {
        throw new Error('No transcript data found. Video may not have captions available.');
      }
      
      this.currentTranscript = response.transcript;
      console.log('✅ Transcript fetched:', this.currentTranscript.length, 'segments');
      statusEl.textContent = `Fetched ${this.currentTranscript.length} segments. Restructuring...`;
      
      // Restructure the transcript
      await this.restructureTranscript();
      
      console.log('✅ Restructuring complete:', this.restructuredSentences.length, 'sentences');
      statusEl.textContent = `Restructured into ${this.restructuredSentences.length} sentences`;
      statusEl.className = 'transcript-status success';
      
      // Display results
      this.displayTranscript();
      
    } catch (error) {
      console.error('❌ Transcript fetch error:', error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
      
      // Show more detailed error information
      if (error.message.includes('content script')) {
        statusEl.textContent += ' (Try refreshing the YouTube page)';
      }
    }
  }

  async restructureTranscript() {
    const useAI = this.container.querySelector('#use-ai-restructure').checked;
    const pauseThreshold = parseFloat(this.container.querySelector('#pause-threshold').value);
    
    this.restructuredSentences = await this.transcriptFetcher.restructureTranscript(
      this.currentTranscript,
      {
        useAI,
        aiService: useAI ? this.aiService : null,
        language: 'en' // TODO: Detect language
      }
    );
  }

  displayTranscript() {
    // Display original
    const originalContainer = this.container.querySelector('.original-transcript');
    const originalText = this.container.querySelector('.original-transcript .transcript-text');
    originalText.innerHTML = this.currentTranscript
      .map(seg => `<span class="segment" data-start="${seg.start}">${seg.text}</span>`)
      .join(' ');
    originalContainer.style.display = 'block';
    
    // Display restructured
    const restructuredContainer = this.container.querySelector('.restructured-transcript');
    const sentencesContainer = this.container.querySelector('.transcript-sentences');
    sentencesContainer.innerHTML = this.restructuredSentences
      .map((sentence, index) => `
        <div class="sentence" data-index="${index}">
          <span class="sentence-number">${index + 1}.</span>
          <span class="sentence-text" data-start="${sentence.start}" data-end="${sentence.end}">
            ${sentence.text}
          </span>
          <span class="sentence-time">${this.formatTime(sentence.start)}</span>
        </div>
      `)
      .join('');
    restructuredContainer.style.display = 'block';
    
    // Show actions
    this.container.querySelector('.transcript-actions').style.display = 'flex';
  }

  copyTranscript() {
    const text = this.restructuredSentences
      .map(s => s.text)
      .join('\n\n');
    
    navigator.clipboard.writeText(text).then(() => {
      const btn = this.container.querySelector('.copy-transcript-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = originalText, 2000);
    });
  }

  exportTranscript() {
    const data = {
      original: this.currentTranscript,
      restructured: this.restructuredSentences,
      metadata: {
        videoUrl: window.location.href,
        exportDate: new Date().toISOString()
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleView() {
    const original = this.container.querySelector('.original-transcript');
    const restructured = this.container.querySelector('.restructured-transcript');
    
    if (original.style.display === 'none') {
      original.style.display = 'block';
      restructured.style.display = 'none';
    } else {
      original.style.display = 'none';
      restructured.style.display = 'block';
    }
  }

  seekToTime(seconds) {
    // Send message to YouTube player to seek
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.executeScript(tabs[0].id, {
        code: `
          const player = document.querySelector('#movie_player');
          if (player && player.seekTo) {
            player.seekTo(${seconds});
            player.playVideo();
          }
        `
      });
    });
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .transcript-restructurer {
        padding: 15px;
        background: #f5f5f5;
        border-radius: 8px;
        margin: 10px 0;
      }
      
      .transcript-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .transcript-header h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .header-buttons {
        display: flex;
        gap: 10px;
      }
      
      .check-captions-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #34a853;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .check-captions-btn:hover {
        background: #2d8e47;
      }
      
      .list-tabs-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #ff9800;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .list-tabs-btn:hover {
        background: #f57c00;
      }
      
      .fetch-transcript-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 8px 15px;
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .fetch-transcript-btn:hover {
        background: #3367d6;
      }
      
      .transcript-options {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        font-size: 14px;
      }
      
      .transcript-options label {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .transcript-options input[type="number"] {
        width: 60px;
        padding: 2px 5px;
      }
      
      .transcript-status {
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        font-size: 14px;
      }
      
      .transcript-status.loading {
        background: #e3f2fd;
        color: #1976d2;
      }
      
      .transcript-status.success {
        background: #e8f5e9;
        color: #388e3c;
      }
      
      .transcript-status.error {
        background: #ffebee;
        color: #c62828;
      }
      
      .transcript-content {
        margin-bottom: 15px;
      }
      
      .original-transcript,
      .restructured-transcript {
        background: white;
        padding: 15px;
        border-radius: 4px;
        margin-bottom: 10px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .transcript-content h4 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #333;
      }
      
      .segment {
        color: #666;
        font-size: 14px;
      }
      
      .sentence {
        margin-bottom: 15px;
        display: flex;
        align-items: start;
        gap: 10px;
      }
      
      .sentence-number {
        color: #999;
        font-size: 12px;
        min-width: 30px;
      }
      
      .sentence-text {
        flex: 1;
        line-height: 1.6;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .sentence-text:hover {
        background: #f0f0f0;
        border-radius: 4px;
        padding: 2px 5px;
        margin: -2px -5px;
      }
      
      .sentence-time {
        color: #4285f4;
        font-size: 12px;
        cursor: pointer;
      }
      
      .transcript-actions {
        display: flex;
        gap: 10px;
      }
      
      .transcript-actions button {
        padding: 8px 15px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .transcript-actions button:hover {
        background: #f5f5f5;
      }
    `;
    document.head.appendChild(style);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptRestructurer;
} else {
  // Make available globally in browser
  window.TranscriptRestructurer = TranscriptRestructurer;
}