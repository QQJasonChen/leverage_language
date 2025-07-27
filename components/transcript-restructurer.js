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
          <!-- ✅ SIMPLIFIED: Only reader mode container -->
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    this.addStyles();
  }

  attachEventListeners() {
    const collectBtn = this.container.querySelector('.start-collection-btn');
    
    collectBtn.addEventListener('click', () => this.toggleCollection());
    
    // ✅ SIMPLIFIED: Reader mode handles its own interactions
    // No more classic view buttons to attach
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
    
    let cleaned = text;
    
    // Step 1: Handle exact sentence repetitions (like "I'm very excited. I'm very excited. I'm very excited.")
    cleaned = this.removeExactSentenceRepetitions(cleaned);
    
    // Step 2: Handle partial sentence repetitions (like "And because of our meal program, And because of our meal program,")
    cleaned = this.removePartialSentenceRepetitions(cleaned);
    
    // Step 3: Find and eliminate phrase-level repetitive patterns
    const words = cleaned.split(' ');
    const patterns = new Map();
    
    // Find all 3-15 word patterns and count them (extended range)
    for (let len = 3; len <= 15; len++) {
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
    
    // Step 4: Remove immediate word repetitions
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
    
    // Step 5: Normalize whitespace  
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    console.log('✨ Cleaning reduced text from', text.length, 'to', cleaned.length, 'characters');
    
    return cleaned;
  }

  removeExactSentenceRepetitions(text) {
    console.log('🎯 Removing exact sentence repetitions...');
    
    // Split by sentence-ending punctuation, but keep the punctuation
    const sentences = text.split(/([.!?]+\s*)/).filter(s => s.trim());
    const cleanedSentences = [];
    const seenSentences = new Set();
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i]?.trim();
      const punctuation = sentences[i + 1] || '';
      
      if (sentence && sentence.length > 5) {
        // Normalize sentence for comparison (remove extra spaces, convert to lowercase)
        const normalizedSentence = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
        
        if (!seenSentences.has(normalizedSentence)) {
          seenSentences.add(normalizedSentence);
          cleanedSentences.push(sentence + punctuation);
        } else {
          console.log('🗑️ Removed duplicate sentence:', sentence.substring(0, 50) + '...');
        }
      }
    }
    
    return cleanedSentences.join(' ');
  }

  removePartialSentenceRepetitions(text) {
    console.log('🎯 Removing partial sentence repetitions...');
    
    // Handle patterns like "And because of our meal program, And because of our meal program,"
    let cleaned = text;
    
    // Split into potential sentence fragments by commas and periods
    const fragments = cleaned.split(/([,.]\s*)/);
    const processedFragments = [];
    
    for (let i = 0; i < fragments.length; i += 2) {
      const fragment = fragments[i]?.trim();
      const separator = fragments[i + 1] || '';
      
      if (fragment && fragment.length > 10) {
        // Check if this fragment appears immediately again
        const nextFragment = fragments[i + 2]?.trim();
        
        if (nextFragment && this.areSimilarFragments(fragment, nextFragment)) {
          // Skip the repetition, keep only the first occurrence
          console.log('🗑️ Removed duplicate fragment:', fragment.substring(0, 30) + '...');
          processedFragments.push(fragment + separator);
          i += 2; // Skip the next fragment since it's a duplicate
        } else {
          processedFragments.push(fragment + separator);
        }
      } else if (fragment) {
        processedFragments.push(fragment + separator);
      }
    }
    
    return processedFragments.join('');
  }

  areSimilarFragments(fragment1, fragment2) {
    // Check if two fragments are similar enough to be considered duplicates
    const norm1 = fragment1.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm2 = fragment2.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // Check if one is a subset of the other (for partial repetitions)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const similarity = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
      return similarity > 0.8; // 80% similarity threshold
    }
    
    return false;
  }

  extractMeaningfulContent(text) {
    console.log('✨ Extracting meaningful content from cleaned text...');
    
    // Step 1: Split into natural sentences first
    const naturalSentences = this.splitIntoNaturalSentences(text);
    console.log('📝 Found', naturalSentences.length, 'natural sentences');
    
    // Step 2: Filter and clean each sentence
    const meaningfulSentences = [];
    const seenNormalizedSentences = new Set();
    
    for (const sentence of naturalSentences) {
      const cleanedSentence = this.cleanSentence(sentence);
      
      if (cleanedSentence.length < 10) continue; // Too short
      
      // Normalize for duplicate detection
      const normalized = cleanedSentence.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      if (seenNormalizedSentences.has(normalized)) {
        console.log('🗑️ Skipped duplicate sentence:', cleanedSentence.substring(0, 40) + '...');
        continue;
      }
      
      // Validate sentence quality
      if (this.isHighQualitySentence(cleanedSentence)) {
        meaningfulSentences.push(cleanedSentence);
        seenNormalizedSentences.add(normalized);
      } else {
        console.log('🗑️ Filtered low quality sentence:', cleanedSentence.substring(0, 40) + '...');
      }
    }
    
    console.log('✅ Extracted', meaningfulSentences.length, 'high-quality sentences');
    return meaningfulSentences.slice(0, 15); // Allow up to 15 good sentences
  }

  splitIntoNaturalSentences(text) {
    // Split by strong sentence boundaries but preserve the structure
    const sentences = [];
    
    // First split by clear sentence endings
    const parts = text.split(/([.!?]+\s+)/);
    
    let currentSentence = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.match(/[.!?]+\s+/)) {
        // This is punctuation + space
        currentSentence += part.replace(/\s+$/, ''); // Remove trailing space
        if (currentSentence.trim().length > 5) {
          sentences.push(currentSentence.trim());
        }
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    }
    
    // Add any remaining content
    if (currentSentence.trim().length > 5) {
      sentences.push(currentSentence.trim());
    }
    
    // If we got very few sentences, try splitting by other methods
    if (sentences.length < 3) {
      console.log('🔄 Few sentences found, trying alternative splitting...');
      return this.splitByAlternativeMethod(text);
    }
    
    return sentences;
  }

  splitByAlternativeMethod(text) {
    // Alternative splitting when punctuation is poor
    const words = text.split(' ').filter(w => w.trim());
    const sentences = [];
    
    // Create sentences of reasonable length (10-20 words)
    for (let i = 0; i < words.length; i += 12) {
      const sentenceWords = words.slice(i, i + 15);
      if (sentenceWords.length >= 4) {
        const sentence = sentenceWords.join(' ').trim();
        sentences.push(sentence);
      }
    }
    
    return sentences;
  }

  cleanSentence(sentence) {
    return sentence
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^[^\w]+/, '') // Remove leading non-word characters
      .replace(/[^\w]+$/, '') // Remove trailing non-word characters  
      .trim();
  }

  isHighQualitySentence(sentence) {
    const words = sentence.split(' ').filter(w => w.trim());
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
    
    // Quality checks
    const hasGoodLength = words.length >= 4 && words.length <= 30;
    const hasGoodUniqueness = uniqueWords.size >= Math.floor(words.length * 0.6); // 60% unique words
    const hasReasonableLength = sentence.length >= 15 && sentence.length <= 250;
    const notTooRepetitive = !this.isTooRepetitive(sentence);
    
    return hasGoodLength && hasGoodUniqueness && hasReasonableLength && notTooRepetitive;
  }

  isTooRepetitive(sentence) {
    const words = sentence.toLowerCase().split(' ');
    const wordCounts = {};
    
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 2) {
        wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
      }
    }
    
    // Check if any significant word appears too many times
    for (const [word, count] of Object.entries(wordCounts)) {
      if (count > 2 && word.length > 3) {
        return true; // Too repetitive
      }
    }
    
    return false;
  }

  cleanCollectedSegments(segments) {
    console.log('🧹 Cleaning collected segments...');
    
    if (!segments || segments.length === 0) return [];
    
    // Step 1: Clean individual segment texts first
    const textCleanedSegments = segments.map(segment => ({
      ...segment,
      text: this.cleanSingleSegmentText(segment.text)
    })).filter(segment => segment.text && segment.text.length > 3);
    
    // Step 2: Remove exact duplicate segments
    const uniqueSegments = this.removeExactDuplicateSegments(textCleanedSegments);
    
    // Step 3: Group and merge similar segments
    const mergedSegments = this.mergeRepetitiveSegments(uniqueSegments);
    
    console.log(`📊 Segment cleaning: ${segments.length} → ${textCleanedSegments.length} → ${uniqueSegments.length} → ${mergedSegments.length}`);
    
    return mergedSegments;
  }

  cleanSingleSegmentText(text) {
    if (!text) return '';
    
    // Remove exact repetitions within the same text
    // Pattern: "word word word" -> "word"
    let cleaned = text.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
    
    // Remove phrase repetitions: "hello world hello world" -> "hello world"
    const words = cleaned.split(' ');
    const halfLength = Math.floor(words.length / 2);
    
    // Check if first half matches second half (common pattern)
    if (halfLength > 2) {
      const firstHalf = words.slice(0, halfLength).join(' ');
      const secondHalf = words.slice(halfLength).join(' ');
      
      if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
        console.log('🗑️ Removed half-repetition:', firstHalf);
        cleaned = firstHalf;
      }
    }
    
    // Check for 3-part repetitions: "A A A" -> "A"
    const thirdLength = Math.floor(words.length / 3);
    if (thirdLength > 2) {
      const firstThird = words.slice(0, thirdLength).join(' ');
      const secondThird = words.slice(thirdLength, thirdLength * 2).join(' ');
      const thirdThird = words.slice(thirdLength * 2).join(' ');
      
      if (firstThird.toLowerCase() === secondThird.toLowerCase() && 
          firstThird.toLowerCase() === thirdThird.toLowerCase()) {
        console.log('🗑️ Removed triple-repetition:', firstThird);
        cleaned = firstThird;
      }
    }
    
    return cleaned.trim();
  }

  removeExactDuplicateSegments(segments) {
    const uniqueSegments = [];
    const seenTexts = new Set();
    
    for (const segment of segments) {
      const normalizedText = segment.text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      if (!seenTexts.has(normalizedText) && normalizedText.length > 5) {
        seenTexts.add(normalizedText);
        uniqueSegments.push(segment);
      } else {
        console.log('🗑️ Removed duplicate segment:', segment.text.substring(0, 40) + '...');
      }
    }
    
    return uniqueSegments;
  }

  mergeRepetitiveSegments(segments) {
    const mergedSegments = [];
    
    for (let i = 0; i < segments.length; i++) {
      const currentSegment = segments[i];
      let mergedText = currentSegment.text;
      
      // Look ahead for similar segments to merge
      let j = i + 1;
      while (j < segments.length && j < i + 3) { // Only look 3 segments ahead
        const nextSegment = segments[j];
        
        if (this.areSegmentsSimilar(currentSegment.text, nextSegment.text)) {
          console.log('🔗 Merging similar segments:', currentSegment.text.substring(0, 30), 'with', nextSegment.text.substring(0, 30));
          // Take the longer, more complete text
          if (nextSegment.text.length > mergedText.length) {
            mergedText = nextSegment.text;
          }
          j++;
        } else {
          break;
        }
      }
      
      // Create merged segment
      mergedSegments.push({
        ...currentSegment,
        text: mergedText
      });
      
      // Skip the segments we merged
      i = j - 1;
    }
    
    return mergedSegments;
  }

  areSegmentsSimilar(text1, text2) {
    const norm1 = text1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = text2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Check if one contains the other (partial duplicates)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const similarity = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
      return similarity > 0.7; // 70% similarity
    }
    
    return false;
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
    // ✅ SIMPLIFIED: Only show reader view - no more classic view toggle
    this.showReaderView();
  }


  showReaderView() {
    // ✅ SIMPLIFIED: Only reader view exists now
    
    // Create reader container if not exists
    let readerContainer = this.container.querySelector('.transcript-reader-container');
    if (!readerContainer) {
      readerContainer = document.createElement('div');
      readerContainer.className = 'transcript-reader-container';
      this.container.querySelector('.transcript-content').appendChild(readerContainer);
      
      // Initialize TranscriptViewer with current transcript data
      if (typeof TranscriptViewer !== 'undefined') {
        // ✅ FIX: Use current transcript (real-time collected) if available, otherwise restructured
        const dataToUse = this.currentTranscript && this.currentTranscript.length > 0 ? 
          this.currentTranscript : 
          (this.restructuredSentences || []);
        
        console.log('📖 Initializing TranscriptViewer with', dataToUse.length, 'items');
        this.transcriptViewer = new TranscriptViewer(readerContainer, dataToUse);
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
    } else {
      // ✅ FIX: If reader container exists, update it with latest data
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        const dataToUse = this.currentTranscript && this.currentTranscript.length > 0 ? 
          this.currentTranscript : 
          (this.restructuredSentences || []);
        
        console.log('🔄 Updating existing transcript viewer with', dataToUse.length, 'items');
        this.transcriptViewer.updateTranscriptData(dataToUse);
      }
    }
    
    readerContainer.style.display = 'block';
  }

  // ✅ REMOVED: copyTranscript and exportTranscript - reader mode handles these features

  // ✅ REMOVED: toggleView - no longer needed with single reader mode

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
          console.log('🧹 Starting deduplication of collected segments...');
          
          // ✅ FIX: Apply cleaning to collected segments first
          const cleanedSegments = this.cleanCollectedSegments(result.segments);
          console.log(`✨ Cleaned segments: ${result.segments.length} → ${cleanedSegments.length}`);
          
          this.currentTranscript = cleanedSegments;
          statusEl.textContent = `✅ Collection stopped. Captured ${cleanedSegments.length} clean segments in ${result.duration.toFixed(1)}s`;
          statusEl.className = 'transcript-status success';
          
          // ✅ FIX: Update the transcript viewer immediately with cleaned data
          if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
            console.log('🔄 Updating transcript viewer with cleaned collection data');
            this.transcriptViewer.updateTranscriptData(cleanedSegments);
          }
          
          // Update button back to play state
          collectBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10,8 16,12 10,16"/>
            </svg>
            Collect
          `;
          
          // Restructure and display (for classic view)
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
      
      /* ✅ SIMPLIFIED: Only reader mode styles needed */
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