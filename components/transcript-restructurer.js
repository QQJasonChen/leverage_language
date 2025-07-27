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
            <button class="start-collection-btn" title="Start real-time caption collection">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10,8 16,12 10,16"/>
              </svg>
              Collect
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
          <label>
            ✅ Chunk duration (seconds):
            <input type="number" id="chunk-duration" value="45" min="20" max="120" step="5" title="Automatically create new chunks every X seconds">
          </label>
        </div>
        
        <div class="transcript-status"></div>
        
        <div class="transcript-content">
          <div class="restructured-transcript" style="display: none;">
            <h4>Clean Transcript</h4>
            <div class="transcript-sentences"></div>
          </div>
        </div>
        
        <div class="transcript-actions" style="display: none;">
          <button class="copy-transcript-btn">Copy All</button>
          <button class="export-transcript-btn">Export</button>
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    this.addStyles();
  }

  attachEventListeners() {
    const collectBtn = this.container.querySelector('.start-collection-btn');
    const copyBtn = this.container.querySelector('.copy-transcript-btn');
    const exportBtn = this.container.querySelector('.export-transcript-btn');
    
    collectBtn.addEventListener('click', () => this.toggleCollection());
    copyBtn.addEventListener('click', () => this.copyTranscript());
    exportBtn.addEventListener('click', () => this.exportTranscript());
    
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

  async testConnection() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Testing content script connection...';
    statusEl.className = 'transcript-status loading';
    
    try {
      // Get current YouTube tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      console.log('🧪 Testing connection to tab:', {
        id: tab.id,
        url: tab.url,
        title: tab.title
      });
      
      if (!tab.url.includes('youtube.com')) {
        statusEl.textContent = `❌ Not on YouTube. Current: ${new URL(tab.url).hostname}`;
        statusEl.className = 'transcript-status error';
        return;
      }
      
      // Test simple ping message
      console.log('📡 Sending ping message...');
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'ping' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      
      console.log('📨 Ping response:', response);
      
      if (response && response.pong) {
        statusEl.textContent = '✅ Content script connected successfully!';
        statusEl.className = 'transcript-status success';
      } else {
        statusEl.textContent = '❌ Content script not responding. Try refreshing YouTube page.';
        statusEl.className = 'transcript-status error';
      }
      
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      
      if (error.message.includes('Receiving end does not exist')) {
        statusEl.textContent = '❌ Content script not loaded. Refresh YouTube page and try again.';
      } else if (error.message === 'Timeout') {
        statusEl.textContent = '❌ Content script timeout. Refresh YouTube page.';
      } else {
        statusEl.textContent = `❌ Connection failed: ${error.message}`;
      }
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
      console.log('📋 Current state:', {
        hasTranscriptViewer: typeof TranscriptViewer !== 'undefined',
        hasYouTubeTranscriptFetcher: typeof YouTubeTranscriptFetcher !== 'undefined',
        currentTranscript: this.currentTranscript?.length || 0,
        restructuredSentences: this.restructuredSentences?.length || 0
      });
      
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
      
      // Check if we only got metadata
      if (response.method === 'metadataOnly' && response.warning) {
        statusEl.textContent = '⚠️ ' + response.warning;
        statusEl.className = 'transcript-status warning';
        
        // Add helper buttons for alternative methods
        const actionsHtml = `
          <div style="margin-top: 10px;">
            <p style="font-size: 12px; margin-bottom: 8px;">No real captions found. Try these alternatives:</p>
            <button class="alt-method-btn" onclick="document.querySelector('.start-collection-btn').click()">
              🔴 Use Real-time Collection
            </button>
            <button class="alt-method-btn" onclick="window.open('https://www.youtube.com/watch?v=${response.videoId}', '_blank')">
              📝 Open YouTube Transcript Panel
            </button>
          </div>
        `;
        
        // Add styles for helper buttons
        if (!document.querySelector('#alt-method-styles')) {
          const style = document.createElement('style');
          style.id = 'alt-method-styles';
          style.textContent = `
            .alt-method-btn {
              margin: 4px;
              padding: 6px 12px;
              background: #ff5722;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            .alt-method-btn:hover {
              background: #e64a19;
            }
            .transcript-status.warning {
              background: #fff3cd;
              color: #856404;
              border: 1px solid #ffeeba;
            }
          `;
          document.head.appendChild(style);
        }
        
        statusEl.innerHTML += actionsHtml;
      }
      
      this.currentTranscript = response.transcript;
      console.log('✅ Transcript fetched:', this.currentTranscript.length, 'segments via', response.method);
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
    
    // Clean up duplicates first
    const cleanedTranscript = this.removeDuplicateSegments(this.currentTranscript);
    console.log(`🧹 Cleaned transcript: ${this.currentTranscript.length} → ${cleanedTranscript.length} segments`);
    
    // Ensure AI service is available and properly initialized
    let aiServiceToUse = null;
    if (useAI) {
      if (this.aiService && typeof this.aiService.generateAnalysis === 'function') {
        aiServiceToUse = this.aiService;
      } else if (window.aiService && typeof window.aiService.generateAnalysis === 'function') {
        aiServiceToUse = window.aiService;
      } else {
        console.warn('⚠️ AI service not available, using basic punctuation only');
      }
    }
    
    this.restructuredSentences = await this.transcriptFetcher.restructureTranscript(
      cleanedTranscript,
      {
        useAI: !!aiServiceToUse,
        aiService: aiServiceToUse,
        language: this.detectLanguage() || 'en'
      }
    );
  }

  removeDuplicateSegments(segments) {
    if (!segments || segments.length === 0) return [];
    
    console.log('🧹 Starting cleanup of', segments.length, 'segments');
    
    // Step 1: Get all text and apply super aggressive cleaning
    const allText = segments.map(s => s.text).join(' ');
    console.log('📝 Original combined text length:', allText.length);
    
    // Step 2: Ultra-aggressive pattern removal
    const cleanedText = this.superAggressiveClean(allText);  
    console.log('🔥 After super aggressive clean:', cleanedText.length);
    
    // Step 3: Extract meaningful content
    const meaningfulSentences = this.extractMeaningfulContent(cleanedText);
    console.log('✨ Meaningful sentences found:', meaningfulSentences.length);
    
    // Step 4: Create clean segments 
    if (meaningfulSentences.length === 0) {
      return [{
        start: segments[0]?.start || 0,
        end: segments[0]?.start + 5 || 5,
        duration: 5,
        text: "Could not extract meaningful content from repetitive captions. Try using 'Collect' feature while playing the video."
      }];
    }
    
    const avgDuration = segments.length > 0 ? 
      Math.max((segments[segments.length - 1].start - segments[0].start) / meaningfulSentences.length, 3) : 3;
    
    return meaningfulSentences.map((text, index) => ({
      start: (segments[0]?.start || 0) + (index * avgDuration),
      end: (segments[0]?.start || 0) + ((index + 1) * avgDuration),
      duration: avgDuration,
      text: text
    }));
  }

  superAggressiveClean(text) {
    console.log('🔥 Starting super aggressive cleaning...');
    
    // Step 1: Find and eliminate the most repetitive patterns
    let cleaned = text;
    
    // Remove patterns that repeat more than once
    const words = text.split(' ');
    const patterns = new Map();
    
    // Find all 4-12 word patterns and count them
    for (let len = 4; len <= 12; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const pattern = words.slice(i, i + len).join(' ');
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    }
    
    // Remove patterns that occur more than once, keeping only first occurrence
    const sortedPatterns = Array.from(patterns.entries())
      .filter(([pattern, count]) => count > 1)
      .sort(([a], [b]) => b.length - a.length); // Longer patterns first
    
    console.log('🎯 Found', sortedPatterns.length, 'repetitive patterns');
    
    for (const [pattern, count] of sortedPatterns) {
      if (count > 1) {
        // Replace all but first occurrence with empty string
        const regex = new RegExp(this.escapeRegex(pattern), 'g');
        let replacements = 0;
        cleaned = cleaned.replace(regex, (match) => {
          replacements++;
          return replacements === 1 ? match : '';
        });
      }
    }
    
    // Step 2: Remove immediate word repetitions
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
    
    // Step 3: Normalize whitespace  
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    console.log('✨ Cleaning reduced text from', text.length, 'to', cleaned.length, 'characters');
    
    return cleaned;
  }

  extractMeaningfulContent(text) {
    const sentences = [];
    const words = text.split(' ').filter(w => w.trim());
    
    if (words.length === 0) return [];
    
    let currentSentence = [];
    const usedWords = new Set();
    
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      
      // Skip very short words or already heavily used words
      if (cleanWord.length < 2) continue;
      
      currentSentence.push(word);
      usedWords.add(cleanWord);
      
      // Form sentences of reasonable length
      if (currentSentence.length >= 8 && (
          word.match(/[.!?]$/) || 
          currentSentence.length >= 15 ||
          Math.random() < 0.3 // Add some randomness to break up monotony
        )) {
        
        const sentence = currentSentence.join(' ').trim();
        
        // Validate sentence quality
        if (this.isGoodSentence(sentence)) {
          sentences.push(sentence);
        }
        
        currentSentence = [];
      }
    }
    
    // Add remaining words as final sentence
    if (currentSentence.length >= 4) {
      const sentence = currentSentence.join(' ').trim();
      if (this.isGoodSentence(sentence)) {
        sentences.push(sentence);
      }
    }
    
    return sentences.slice(0, 10); // Limit to max 10 sentences
  }

  isGoodSentence(sentence) {
    const words = sentence.split(' ');
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
    
    return (
      words.length >= 4 && 
      words.length <= 25 &&
      uniqueWords.size >= Math.floor(words.length * 0.6) && // At least 60% unique words
      sentence.length >= 20 &&
      sentence.length <= 200
    );
  }

  extractSentences(text) {
    console.log('🔍 Original text length:', text.length);
    
    // Step 1: Aggressive deduplication - split by pattern repetitions
    const patterns = this.findRepetitivePatterns(text);
    let cleanText = text;
    
    // Remove the most obvious repetitive patterns
    for (const pattern of patterns) {
      const regex = new RegExp(this.escapeRegex(pattern) + '\\s*', 'g');
      const matches = cleanText.match(regex);
      if (matches && matches.length > 2) {
        // Keep only first occurrence
        cleanText = cleanText.replace(regex, pattern + ' ');
      }
    }
    
    console.log('🧹 After pattern removal:', cleanText.length);
    
    // Step 2: Extract meaningful phrases
    const meaningfulPhrases = this.extractMeaningfulPhrases(cleanText);
    console.log('📝 Meaningful phrases found:', meaningfulPhrases.length);
    
    return meaningfulPhrases;
  }

  findRepetitivePatterns(text) {
    const patterns = new Set();
    const words = text.split(' ');
    
    // Look for 3-8 word patterns that repeat
    for (let len = 3; len <= 8; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const pattern = words.slice(i, i + len).join(' ');
        const count = (text.match(new RegExp(this.escapeRegex(pattern), 'g')) || []).length;
        
        if (count >= 3) {
          patterns.add(pattern);
        }
      }
    }
    
    // Sort by length (longer patterns first)
    return Array.from(patterns).sort((a, b) => b.length - a.length);
  }

  extractMeaningfulPhrases(text) {
    const phrases = [];
    const words = text.split(' ');
    let currentPhrase = [];
    const seenPhrases = new Set();
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].trim();
      if (!word) continue;
      
      currentPhrase.push(word);
      
      // End phrase when we hit punctuation or reach reasonable length
      if (word.match(/[.!?]$/) || currentPhrase.length >= 12) {
        let phrase = currentPhrase.join(' ').trim();
        
        // Clean the phrase
        phrase = this.cleanPhrase(phrase);
        
        // Only add if it's new and meaningful
        if (phrase.length > 10 && !seenPhrases.has(phrase.toLowerCase())) {
          const words = phrase.split(' ');
          const uniqueWords = new Set(words.map(w => w.toLowerCase()));
          
          // Good ratio of unique words (avoid repetitive phrases)
          if (uniqueWords.size / words.length > 0.7) {
            phrases.push(phrase);
            seenPhrases.add(phrase.toLowerCase());
          }
        }
        
        currentPhrase = [];
      }
    }
    
    // Add final phrase if exists
    if (currentPhrase.length > 2) {
      let phrase = this.cleanPhrase(currentPhrase.join(' ').trim());
      if (phrase.length > 10 && !seenPhrases.has(phrase.toLowerCase())) {
        phrases.push(phrase);
      }
    }
    
    return phrases;
  }

  cleanPhrase(phrase) {
    return phrase
      .replace(/\b(\w+)(\s+\1)+/g, '$1') // Remove word repetitions
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^[^a-zA-Z]+/, '') // Remove leading non-letters
      .trim();
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  isValidSentence(sentence) {
    // Basic validation for reasonable sentences
    const wordCount = sentence.split(' ').length;
    const hasRepeatedPhrases = /(.{10,})\1/.test(sentence.toLowerCase());
    const tooManyRepeats = (sentence.match(/\b\w+\b/g) || []).length !== 
                          [...new Set(sentence.toLowerCase().match(/\b\w+\b/g) || [])].length * 1.5;
    
    return wordCount >= 3 && wordCount <= 50 && !hasRepeatedPhrases && !tooManyRepeats;
  }

  detectLanguage() {
    // Try to detect language from current transcript
    if (!this.currentTranscript || this.currentTranscript.length === 0) {
      return 'en';
    }
    
    const sampleText = this.currentTranscript.slice(0, 3).map(t => t.text).join(' ').toLowerCase();
    
    // Simple language detection based on common words
    if (sampleText.includes('het ') || sampleText.includes('de ') || sampleText.includes('een ')) {
      return 'nl';
    } else if (sampleText.includes('the ') || sampleText.includes('and ') || sampleText.includes('is ')) {
      return 'en';
    }
    
    return 'en'; // Default to English
  }

  displayTranscript() {
    // Create a toggle between old view and new reader view
    const viewToggle = document.createElement('div');
    viewToggle.className = 'view-toggle';
    viewToggle.innerHTML = `
      <button class="view-btn active" data-view="classic">Classic View</button>
      <button class="view-btn" data-view="reader">📖 Reader Mode</button>
    `;
    
    // Insert toggle if not exists
    if (!this.container.querySelector('.view-toggle')) {
      const header = this.container.querySelector('.transcript-header');
      header.appendChild(viewToggle);
    }
    
    // Handle view toggle
    viewToggle.addEventListener('click', (e) => {
      if (e.target.classList.contains('view-btn')) {
        const view = e.target.dataset.view;
        viewToggle.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        if (view === 'reader') {
          this.showReaderView();
        } else {
          this.showClassicView();
        }
      }
    });
    
    // Default to classic view
    this.showClassicView();
  }

  showClassicView() {
    // Hide reader view if exists
    const readerContainer = this.container.querySelector('.transcript-reader-container');
    if (readerContainer) {
      readerContainer.style.display = 'none';
    }
    
    // Display only restructured/clean transcript
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

  showReaderView() {
    // Hide classic views
    this.container.querySelector('.restructured-transcript').style.display = 'none';
    this.container.querySelector('.transcript-actions').style.display = 'none';
    
    // Create reader container if not exists
    let readerContainer = this.container.querySelector('.transcript-reader-container');
    if (!readerContainer) {
      readerContainer = document.createElement('div');
      readerContainer.className = 'transcript-reader-container';
      this.container.querySelector('.transcript-content').appendChild(readerContainer);
      
      // Initialize TranscriptViewer with cleaned transcript
      if (typeof TranscriptViewer !== 'undefined') {
        console.log('📖 Initializing TranscriptViewer with', this.restructuredSentences.length, 'sentences');
        // Use restructured sentences for cleaner reading experience
        this.transcriptViewer = new TranscriptViewer(readerContainer, this.restructuredSentences);
        console.log('✅ TranscriptViewer initialized successfully');
      } else {
        console.error('❌ TranscriptViewer not loaded - check if transcript-viewer.js is included');
        readerContainer.innerHTML = `
          <div style="color: red; padding: 20px; text-align: center;">
            <p>❌ Reader mode not available</p>
            <p style="font-size: 12px;">TranscriptViewer component not loaded</p>
          </div>
        `;
      }
    }
    
    readerContainer.style.display = 'block';
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

  async toggleCollection() {
    const collectBtn = this.container.querySelector('.start-collection-btn');
    const statusEl = this.container.querySelector('.transcript-status');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab.url.includes('youtube.com/watch')) {
        statusEl.textContent = '❌ Please open a YouTube video first';
        statusEl.className = 'transcript-status error';
        return;
      }
      
      // Check if collection is already in progress
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      
      if (response.isCollecting) {
        // Stop collection
        statusEl.textContent = 'Stopping real-time collection...';
        statusEl.className = 'transcript-status loading';
        
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'stopCaptionCollection' });
        
        if (result.success && result.segments.length > 0) {
          this.currentTranscript = result.segments;
          statusEl.textContent = `✅ Collection stopped. Captured ${result.segments.length} segments in ${result.duration.toFixed(1)}s`;
          statusEl.className = 'transcript-status success';
          
          // ✅ FIX: Update the transcript viewer with new data
          if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
            console.log('🔄 Updating transcript viewer with new collection data');
            this.transcriptViewer.updateTranscriptData(result.segments);
          }
          
          // Update button back to play state
          collectBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10,8 16,12 10,16"/>
            </svg>
            Collect
          `;
          
          // Restructure and display
          await this.restructureTranscript();
          this.displayTranscript();
          
        } else {
          statusEl.textContent = '❌ No captions collected. Try playing the video with captions enabled.';
          statusEl.className = 'transcript-status error';
          
          // Reset button state even on error
          collectBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10,8 16,12 10,16"/>
            </svg>
            Collect
          `;
        }
        
      } else {
        // Start collection
        statusEl.textContent = 'Starting real-time caption collection...';
        statusEl.className = 'transcript-status loading';
        
        // ✅ NEW: Get chunk duration setting from UI
        const chunkDurationInput = this.container.querySelector('#chunk-duration');
        const chunkDuration = chunkDurationInput ? parseInt(chunkDurationInput.value) || 45 : 45;
        
        const result = await chrome.tabs.sendMessage(tab.id, { 
          action: 'startCaptionCollection',
          chunkDuration: chunkDuration 
        });
        
        if (result.success) {
          statusEl.textContent = '🔴 Real-time collection active. Play the video and captions will be captured.';
          statusEl.className = 'transcript-status success';
          
          // Update button to show stop state
          collectBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <rect x="9" y="9" width="6" height="6"/>
            </svg>
            Stop
          `;
          
        } else {
          statusEl.textContent = '❌ Failed to start collection. Try refreshing the page.';
          statusEl.className = 'transcript-status error';
        }
      }
      
    } catch (error) {
      console.error('❌ Toggle collection error:', error);
      statusEl.textContent = `❌ Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  seekToTime(seconds) {
    // Send message to content script to seek video
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'seekToTime',
        time: seconds
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
      
      .test-connection-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #9c27b0;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .test-connection-btn:hover {
        background: #7b1fa2;
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
      
      .start-collection-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #ff5722;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }
      
      .start-collection-btn:hover {
        background: #e64a19;
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
      
      .view-toggle {
        display: flex;
        gap: 8px;
        margin-left: auto;
      }
      
      .view-btn {
        padding: 6px 12px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .view-btn:hover {
        background: #f5f5f5;
      }
      
      .view-btn.active {
        background: #2196f3;
        color: white;
        border-color: #2196f3;
      }
      
      .transcript-reader-container {
        margin-top: 10px;
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