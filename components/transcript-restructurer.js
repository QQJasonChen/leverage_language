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
            <input type="number" id="pause-threshold" value="2.2" min="0.5" max="5" step="0.1">
          </label>
          <label>
            ✅ Chunk duration (seconds):
            <input type="number" id="chunk-duration" value="75" min="20" max="120" step="5" title="Automatically create new chunks every X seconds">
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
    
    // ✅ NEW: Detect if this looks like auto-generated captions
    if (this.isAutoGeneratedPattern(segments) || this.hasAutoGeneratedMarkers(segments)) {
      console.log('🤖 Detected auto-generated captions - using enhanced stream reconstruction');
      const reconstructed = this.reconstructAutoGeneratedStream(segments);
      // Apply additional master cleanup for auto-generated content
      return this.masterCleanupSegments(reconstructed);
    }
    
    // Enhanced cleaning for manual captions
    const textCleanedSegments = segments.map(segment => ({
      ...segment,
      text: this.cleanSingleSegmentText(segment.text)
    })).filter(segment => segment.text && segment.text.length > 3);
    
    const uniqueSegments = this.removeExactDuplicateSegments(textCleanedSegments);
    const mergedSegments = this.mergeRepetitiveSegments(uniqueSegments);
    
    console.log(`📊 Segment cleaning: ${segments.length} → ${textCleanedSegments.length} → ${uniqueSegments.length} → ${mergedSegments.length}`);
    
    return mergedSegments;
  }

  isAutoGeneratedPattern(segments) {
    if (segments.length < 3) return false;
    
    // Check for cascading overlap pattern
    let overlapCount = 0;
    for (let i = 1; i < Math.min(segments.length, 5); i++) {
      const current = segments[i].text.toLowerCase();
      const previous = segments[i-1].text.toLowerCase();
      
      // Check if current segment contains significant portion of previous
      const words1 = previous.split(' ');
      const words2 = current.split(' ');
      
      if (words1.length > 3 && words2.length > 3) {
        const lastWords = words1.slice(-3).join(' ');
        if (current.includes(lastWords)) {
          overlapCount++;
        }
      }
    }
    
    // If 60%+ segments show overlap pattern, likely auto-generated
    return overlapCount / Math.min(segments.length - 1, 4) > 0.6;
  }

  reconstructAutoGeneratedStream(segments) {
    console.log('🔄 Reconstructing auto-generated stream from', segments.length, 'segments');
    
    // Step 1: Build continuous text stream with timing info
    let streamText = '';
    let wordTimings = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const cleanText = segment.text.replace(/[^\w\s.!?]/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (i === 0) {
        // First segment - add everything
        streamText += cleanText + ' ';
        const words = cleanText.split(' ');
        words.forEach(word => {
          if (word.length > 0) {
            wordTimings.push({
              word: word,
              time: segment.start,
              originalIndex: i
            });
          }
        });
      } else {
        // Find what's new in this segment
        const newContent = this.extractNewContent(streamText, cleanText);
        if (newContent && newContent.length > 2) {
          streamText += newContent + ' ';
          const newWords = newContent.split(' ');
          newWords.forEach(word => {
            if (word.length > 0) {
              wordTimings.push({
                word: word,
                time: segment.start,
                originalIndex: i
              });
            }
          });
        }
      }
    }
    
    console.log('📝 Reconstructed stream:', streamText.substring(0, 100) + '...');
    
    // Step 2: Break into proper sentences
    const sentences = this.intelligentSentenceSegmentation(streamText, wordTimings);
    
    console.log('✅ Reconstructed', sentences.length, 'proper sentences');
    return sentences;
  }

  extractNewContent(existingText, newSegmentText) {
    const existing = existingText.toLowerCase();
    const newText = newSegmentText.toLowerCase();
    
    // Find the longest matching suffix of existing with prefix of new
    let bestOverlapLength = 0;
    let bestStartPos = 0;
    
    const existingWords = existing.split(' ');
    const newWords = newText.split(' ');
    
    // Look for overlap in last 10 words of existing text
    for (let overlapLen = 1; overlapLen <= Math.min(10, existingWords.length, newWords.length); overlapLen++) {
      const existingSuffix = existingWords.slice(-overlapLen).join(' ');
      const newPrefix = newWords.slice(0, overlapLen).join(' ');
      
      if (existingSuffix === newPrefix && overlapLen > bestOverlapLength) {
        bestOverlapLength = overlapLen;
        bestStartPos = overlapLen;
      }
    }
    
    // Return the non-overlapping part
    const uniqueWords = newWords.slice(bestStartPos);
    return uniqueWords.join(' ');
  }

  intelligentSentenceSegmentation(text, wordTimings) {
    // Clean up text first
    let cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Add periods at natural break points (simple heuristic)
    cleanText = cleanText.replace(/\b(and|but|so|then|now|well|okay|right)\s+/gi, (match, word, offset) => {
      // Don't break if it's at the start or if there's already punctuation nearby
      if (offset < 10 || /[.!?]\s*$/.test(cleanText.substring(Math.max(0, offset - 10), offset))) {
        return match;
      }
      return '. ' + match.charAt(0).toUpperCase() + match.slice(1);
    });
    
    // Split into sentences
    const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    // Create segments with estimated timings
    const segments = [];
    let wordIndex = 0;
    const wordsPerSentence = Math.floor(wordTimings.length / Math.max(sentences.length, 1));
    
    sentences.forEach((sentence, index) => {
      const sentenceWords = sentence.split(' ').length;
      const startWordIndex = Math.floor((wordIndex / wordTimings.length) * wordTimings.length);
      const endWordIndex = Math.min(startWordIndex + sentenceWords, wordTimings.length - 1);
      
      const startTime = wordTimings[startWordIndex]?.time || 0;
      const endTime = wordTimings[endWordIndex]?.time || startTime + 5;
      
      // Capitalize first word
      const capitalizedSentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      
      segments.push({
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
        text: capitalizedSentence,
        timestamp: Date.now(),
        reconstructed: true,
        originalSegments: Math.floor(sentenceWords / 3) // Rough estimate
      });
      
      wordIndex += sentenceWords;
    });
    
    return segments;
  }

  cleanSingleSegmentText(text) {
    if (!text) return '';
    
    console.log('🧽 Cleaning segment text:', text.substring(0, 100) + '...');
    
    let cleaned = text;
    
    // Step 1: Remove word-level repetitions: "word word word" -> "word"
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
    
    // Step 2: Ultra-aggressive pattern matching for complex repetitions
    cleaned = this.removeComplexRepetitions(cleaned);
    
    // Step 3: Remove phrase repetitions: "hello world hello world" -> "hello world"
    const words = cleaned.split(' ').filter(w => w.trim());
    
    // Check various repetition patterns
    cleaned = this.detectAndRemovePatternRepetitions(words);
    
    console.log('✨ Cleaned result:', cleaned.substring(0, 100) + '...');
    return cleaned.trim();
  }

  removeComplexRepetitions(text) {
    // Handle patterns like "families but let me start going after families but let me start going after weddings"
    let cleaned = text;
    
    // Find all sequences of 3-15 words and remove repetitions
    const words = text.split(' ').filter(w => w.trim());
    
    for (let patternLength = 3; patternLength <= Math.min(15, Math.floor(words.length / 2)); patternLength++) {
      for (let i = 0; i <= words.length - patternLength * 2; i++) {
        const pattern = words.slice(i, i + patternLength);
        const patternText = pattern.join(' ');
        
        // Check if this pattern repeats immediately after
        const nextPattern = words.slice(i + patternLength, i + patternLength * 2);
        const nextPatternText = nextPattern.join(' ');
        
        if (this.arePatternsSimilar(patternText, nextPatternText)) {
          // Found repetition - remove all but first occurrence
          const beforePattern = words.slice(0, i).join(' ');
          const afterPattern = words.slice(i + patternLength * 2).join(' ');
          
          console.log('🗑️ Removed complex repetition:', patternText);
          cleaned = [beforePattern, patternText, afterPattern].filter(p => p.trim()).join(' ');
          
          // Re-split for next iteration
          words.splice(0, words.length, ...cleaned.split(' ').filter(w => w.trim()));
          break;
        }
      }
    }
    
    return cleaned;
  }

  detectAndRemovePatternRepetitions(words) {
    if (words.length < 6) return words.join(' ');
    
    // Strategy 1: Check if first half matches second half
    const halfLength = Math.floor(words.length / 2);
    if (halfLength >= 3) {
      const firstHalf = words.slice(0, halfLength);
      const secondHalf = words.slice(halfLength, halfLength * 2);
      
      if (this.areWordArraysSimilar(firstHalf, secondHalf)) {
        console.log('🗑️ Removed half-repetition:', firstHalf.join(' '));
        return firstHalf.join(' ');
      }
    }
    
    // Strategy 2: Check for triple repetitions
    const thirdLength = Math.floor(words.length / 3);
    if (thirdLength >= 3) {
      const firstThird = words.slice(0, thirdLength);
      const secondThird = words.slice(thirdLength, thirdLength * 2);
      const thirdThird = words.slice(thirdLength * 2, thirdLength * 3);
      
      if (this.areWordArraysSimilar(firstThird, secondThird) && 
          this.areWordArraysSimilar(firstThird, thirdThird)) {
        console.log('🗑️ Removed triple-repetition:', firstThird.join(' '));
        return firstThird.join(' ');
      }
    }
    
    // Strategy 3: Look for any repeating subsequences
    for (let patternLength = 4; patternLength <= Math.floor(words.length / 2); patternLength++) {
      for (let start = 0; start <= words.length - patternLength * 2; start++) {
        const pattern = words.slice(start, start + patternLength);
        const nextPattern = words.slice(start + patternLength, start + patternLength * 2);
        
        if (this.areWordArraysSimilar(pattern, nextPattern)) {
          // Found repetition - keep only the first occurrence
          const before = words.slice(0, start);
          const after = words.slice(start + patternLength * 2);
          
          console.log('🗑️ Removed pattern repetition:', pattern.join(' '));
          return [...before, ...pattern, ...after].join(' ');
        }
      }
    }
    
    return words.join(' ');
  }

  arePatternsSimilar(pattern1, pattern2) {
    const norm1 = pattern1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = pattern2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // High similarity (90%+ overlap)
    if (norm1.length > 10 && norm2.length > 10) {
      const similarity = this.calculateSimilarity(norm1, norm2);
      return similarity > 0.9;
    }
    
    return false;
  }

  areWordArraysSimilar(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    
    const norm1 = arr1.map(w => w.toLowerCase().replace(/[^\w]/g, '')).join(' ');
    const norm2 = arr2.map(w => w.toLowerCase().replace(/[^\w]/g, '')).join(' ');
    
    return norm1 === norm2;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
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

  showAIPolishButton(segments) {
    // Remove existing AI polish button if any
    const existingBtn = this.container.querySelector('.ai-polish-btn');
    if (existingBtn) existingBtn.remove();
    
    // Calculate estimated cost and word count
    const totalWords = segments.map(s => s.text.split(' ').length).reduce((a, b) => a + b, 0);
    const estimatedCost = this.calculateAICost(totalWords);
    
    // Create AI Polish button
    const statusEl = this.container.querySelector('.transcript-status');
    const aiPolishBtn = document.createElement('button');
    aiPolishBtn.className = 'ai-polish-btn';
    aiPolishBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      🤖 AI Polish (~$${estimatedCost}, ${totalWords} words)
    `;
    aiPolishBtn.title = `Use AI to improve grammar and remove any remaining repetitions. Estimated cost: $${estimatedCost}`;
    
    // Insert after status
    statusEl.parentNode.insertBefore(aiPolishBtn, statusEl.nextSibling);
    
    // Add click handler
    aiPolishBtn.addEventListener('click', () => this.performAIPolish(segments, aiPolishBtn));
  }

  calculateAICost(wordCount) {
    // Estimate tokens (roughly 0.75 tokens per word)
    const estimatedTokens = Math.ceil(wordCount * 0.75);
    
    // Use Gemini Flash pricing (cheapest option)
    const inputCost = (estimatedTokens / 1000000) * 0.075; // $0.075 per 1M tokens
    const outputCost = (estimatedTokens / 1000000) * 0.30;  // $0.30 per 1M tokens (assuming similar output size)
    
    const totalCost = inputCost + outputCost;
    return totalCost.toFixed(4);
  }

  async performAIPolish(segments, button) {
    const originalText = button.innerHTML;
    button.innerHTML = '🤖 AI Polishing...';
    button.disabled = true;
    
    try {
      console.log('🤖 Starting AI polish of', segments.length, 'segments');
      
      // Check if AI service is available
      let aiService = null;
      if (this.aiService && typeof this.aiService.generateAnalysis === 'function') {
        aiService = this.aiService;
      } else if (window.aiService && typeof window.aiService.generateAnalysis === 'function') {
        aiService = window.aiService;
      } else {
        throw new Error('AI service not available. Please configure OpenAI or Gemini API in settings.');
      }
      
      // ✅ FIX: Process each segment individually to preserve count
      const polishedSegments = [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        button.innerHTML = `🤖 AI Polishing... (${Math.floor((i/segments.length)*100)}%)`;
        
        // Only polish if the segment has repetitive patterns or poor grammar
        if (this.needsAIPolish(segment.text)) {
          try {
            const polishedText = await this.polishSingleSentence(segment.text, aiService);
            polishedSegments.push({
              ...segment,
              text: polishedText.trim(),
              aiPolished: true
            });
          } catch (error) {
            console.log('⚠️ Failed to polish segment, keeping original:', error.message);
            // Keep original if AI fails for this segment
            polishedSegments.push(segment);
          }
        } else {
          // Keep original if it doesn't need polishing
          polishedSegments.push(segment);
        }
        
        // Small delay to prevent API rate limiting (every 5 segments)
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log('✅ AI polish completed:', polishedSegments.length, 'segments (same count preserved)');
      
      // Update the transcript data
      this.currentTranscript = polishedSegments;
      
      // Update the reader view
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        this.transcriptViewer.updateTranscriptData(polishedSegments);
      }
      
      // Update status
      const statusEl = this.container.querySelector('.transcript-status');
      statusEl.textContent = `✨ AI Polish completed! Enhanced ${polishedSegments.length} segments (preserved original count)`;
      statusEl.className = 'transcript-status success';
      
      // Remove the AI polish button (already done)
      button.remove();
      
    } catch (error) {
      console.error('❌ AI polish failed:', error);
      
      // Restore button
      button.innerHTML = originalText;
      button.disabled = false;
      
      // Show error
      const statusEl = this.container.querySelector('.transcript-status');
      statusEl.textContent = `❌ AI Polish failed: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  needsAIPolish(text) {
    // Check if text has issues that need AI polishing
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const issues = [
      // Has repetitive words (3+ times)
      /\b(\w+)\s+\1\s+\1\b/i.test(text),
      
      // ✅ FIX: Detect sentence-level repetitions like your examples
      this.hasSentenceRepetition(normalizedText),
      
      // Has very poor grammar (multiple issues)
      text.split(' ').length > 15 && !/[.!?]$/.test(text.trim()),
      
      // Still has some repetitive patterns the rules missed
      /(.{10,})\s+\1/.test(text),
      
      // Has obvious transcript artifacts
      /\b(um|uh|like|you know)\s+(um|uh|like|you know)\b/i.test(text),
      
      // ✅ NEW: Detect phrase repetitions
      this.hasPhraseRepetition(normalizedText),
      
      // ✅ NEW: Detect word duplications within sentence
      this.hasWordDuplication(normalizedText)
    ];
    
    return issues.some(issue => issue);
  }

  hasSentenceRepetition(normalizedText) {
    // Check if the sentence is essentially repeated
    // Example: "this is how they all looked like at some point this is how they all looked like at some point"
    
    const words = normalizedText.split(' ');
    const length = words.length;
    
    // Check if first half matches second half (90%+ similarity)
    if (length >= 8) { // Only check for sentences with 8+ words
      const halfLength = Math.floor(length / 2);
      const firstHalf = words.slice(0, halfLength).join(' ');
      const secondHalf = words.slice(-halfLength).join(' ');
      
      // Calculate similarity
      const similarity = this.calculateTextSimilarity(firstHalf, secondHalf);
      if (similarity > 0.85) {
        console.log('🔍 Detected sentence repetition:', firstHalf, '≈', secondHalf);
        return true;
      }
    }
    
    return false;
  }

  hasPhraseRepetition(normalizedText) {
    // Check for repeated phrases of 4-8 words
    const words = normalizedText.split(' ');
    
    for (let phraseLength = 4; phraseLength <= 8; phraseLength++) {
      for (let i = 0; i <= words.length - phraseLength * 2; i++) {
        const phrase1 = words.slice(i, i + phraseLength).join(' ');
        const phrase2 = words.slice(i + phraseLength, i + phraseLength * 2).join(' ');
        
        if (this.calculateTextSimilarity(phrase1, phrase2) > 0.9) {
          console.log('🔍 Detected phrase repetition:', phrase1);
          return true;
        }
      }
    }
    
    return false;
  }

  hasWordDuplication(normalizedText) {
    // Check for immediate word duplications that rules might have missed
    const patterns = [
      /\b(\w{3,})\s+\1\b/g, // Same word repeated immediately
      /\b(\w+)\s+(\w+)\s+\1\s+\2\b/g, // Two-word pattern repeated
    ];
    
    return patterns.some(pattern => pattern.test(normalizedText));
  }

  calculateTextSimilarity(text1, text2) {
    if (text1 === text2) return 1;
    if (!text1 || !text2) return 0;
    
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    // Simple similarity: count matching characters in order
    let matches = 0;
    const minLength = Math.min(text1.length, text2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (text1[i] === text2[i]) matches++;
    }
    
    return matches / longer.length;
  }

  async polishSingleSentence(text, aiService) {
    // ✅ Pre-clean obvious issues before sending to AI
    let preCleanedText = this.preCleanSentence(text);
    
    // If pre-cleaning already fixed everything, don't waste AI call
    if (preCleanedText !== text && !this.needsAIPolish(preCleanedText)) {
      console.log('✅ Pre-cleaning fixed issues:', text.substring(0, 40), '→', preCleanedText.substring(0, 40));
      return preCleanedText;
    }
    
    const prompt = `Fix this transcript sentence. It may have spacing issues, repetitions, or poor grammar.

EXAMPLES:
- "changea family" → "change a family"
- "and each home is going to change a family's life. and each home is going to change a family's life." → "And each home is going to change a family's life."
- "This is how they alllooked like at some point. This is how they all looked like at some point." → "This is how they all looked like at some point."

RULES:
1. Fix spacing issues (like "changea" → "change a", "alllooked" → "all looked")
2. If sentence repeats itself completely, keep only ONE copy
3. Remove duplicate phrases within the sentence
4. Fix grammar, punctuation, and capitalization
5. Return ONLY the fixed sentence, nothing else

Sentence to fix: "${preCleanedText}"`;

    try {
      const response = await aiService.generateAnalysis(prompt, 'en');
      let cleaned = response.content || response.text || response;
      
      // Clean up the AI response
      cleaned = this.cleanAIResponse(cleaned);
      
      // ✅ Additional validation for your specific patterns
      if (this.isValidCleanedSentence(preCleanedText, cleaned)) {
        console.log('✅ AI polished:', preCleanedText.substring(0, 40), '→', cleaned.substring(0, 40));
        return cleaned;
      } else {
        console.log('⚠️ AI response invalid, using pre-cleaned:', preCleanedText.substring(0, 40));
        return preCleanedText;
      }
      
    } catch (error) {
      console.error('AI polish error:', error);
      // Return pre-cleaned version if AI fails
      return preCleanedText;
    }
  }

  preCleanSentence(text) {
    let cleaned = text;
    
    // Fix common spacing issues in transcripts
    cleaned = cleaned
      .replace(/\b(\w+)([a-z])(\s+)([A-Z])/g, '$1$2 $4') // "changea family" → "change a family"
      .replace(/\b(\w+)([a-z]{2,})([A-Z]\w+)/g, '$1$2 $3') // "alllooked" → "all looked"
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Fix missing spaces between words
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Handle exact sentence repetitions
    const sentences = cleaned.split(/([.!?]+)/).filter(s => s.trim());
    if (sentences.length >= 4) { // At least 2 sentences
      const firstSentence = (sentences[0] + (sentences[1] || '')).trim();
      const secondSentence = (sentences[2] + (sentences[3] || '')).trim();
      
      if (this.areSentencesSimilar(firstSentence, secondSentence)) {
        cleaned = firstSentence;
        console.log('🧹 Pre-cleaned repetition:', text.substring(0, 40), '→', cleaned.substring(0, 40));
      }
    }
    
    return cleaned;
  }

  areSentencesSimilar(sent1, sent2) {
    const norm1 = sent1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = sent2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Check exact match or very high similarity
    if (norm1 === norm2) return true;
    
    const similarity = this.calculateTextSimilarity(norm1, norm2);
    return similarity > 0.9;
  }

  cleanAIResponse(response) {
    let cleaned = response;
    
    // Remove common AI response patterns
    cleaned = cleaned
      .replace(/^["'`]|["'`]$/g, '') // Remove quotes
      .replace(/^(cleaned|result|fixed|answer):\s*/i, '') // Remove prefixes
      .replace(/\n.*$/s, '') // Remove everything after first line
      .trim();
    
    // Ensure proper capitalization
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned;
  }

  isValidCleanedSentence(original, cleaned) {
    // Validate that the AI response is reasonable
    if (!cleaned || cleaned.length < 5) return false;
    
    // Length should be 30%-150% of original (allowing for repetition removal)
    if (cleaned.length < original.length * 0.3 || cleaned.length > original.length * 1.5) {
      return false;
    }
    
    // Should still contain some key words from original
    const originalWords = original.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const cleanedWords = cleaned.toLowerCase().match(/\b\w{4,}\b/g) || [];
    
    if (originalWords.length > 0) {
      const commonWords = originalWords.filter(word => cleanedWords.includes(word));
      const overlap = commonWords.length / originalWords.length;
      
      // At least 50% of significant words should remain
      if (overlap < 0.5) return false;
    }
    
    return true;
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
          
          // ✅ NEW: Show AI Polish button after successful collection
          this.showAIPolishButton(cleanedSegments);
          
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
          // ✅ NEW: Show caption type in status
          const captionTypeText = result.captionType === 'auto-generated' ? 
            '🤖 Auto-generated captions detected - using smart stream processing' : 
            '📝 Manual captions detected - using standard collection';
          
          statusEl.textContent = `🔴 ${captionTypeText}. Play the video to capture captions.`;
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
      
      /* ✅ NEW: AI Polish button styling */
      .ai-polish-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        margin: 10px 0;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }
      
      .ai-polish-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      
      .ai-polish-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
      }
      
      .ai-polish-btn svg {
        flex-shrink: 0;
        animation: sparkle 2s ease-in-out infinite;
      }
      
      @keyframes sparkle {
        0%, 100% { transform: scale(1) rotate(0deg); }
        50% { transform: scale(1.1) rotate(5deg); }
      }
    `;
    document.head.appendChild(style);
  }

  fixIncompleteSegments(text) {
    // Fix common incomplete segment patterns
    return text
      // Fix "where it's like come you" -> "where it's like, come on, you"
      .replace(/\b(where|what|how)\s+(it's|that's|this)\s+like\s+(\w+)\s+(you|we|they)\b/gi, 
        (match, question, pronoun, word, subject) => {
          // Try to make sense of fragmented thoughts
          if (word === 'come') {
            return `${question} ${pronoun} like, come on, ${subject}`;
          }
          return `${question} ${pronoun} like ${word}, ${subject}`;
        })
      // Fix "meaningful revenue meaningful" -> "meaningful revenue"
      .replace(/\b(\w+)\s+(\w+)\s+\1\b/gi, '$1 $2')
      // Fix other common auto-generated errors
      .replace(/\b(the|a|an)\s+(the|a|an)\b/gi, '$1')
      .replace(/\b(is|are|was|were)\s+(is|are|was|were)\b/gi, '$1')
      .replace(/\b(and|or|but)\s+(and|or|but)\b/gi, '$1');
  }

  mergeShortSentences(sentences) {
    const merged = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const current = sentences[i];
      const next = sentences[i + 1];
      
      // If current sentence is very short and next exists, merge them
      if (current.split(' ').length <= 4 && next && next.split(' ').length <= 15) {
        merged.push(current + ' ' + next);
        i++; // Skip next since we merged it
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }

  createYouTubeLink(timeInSeconds) {
    // Helper to create YouTube timestamp links
    const videoId = this.getVideoIdFromPage();
    if (videoId) {
      return `https://youtube.com/watch?v=${videoId}&t=${Math.floor(timeInSeconds)}s`;
    }
    return '#';
  }

  getVideoIdFromPage() {
    // Extract video ID from current page or extension context
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  hasAutoGeneratedMarkers(segments) {
    // Check if segments have auto-generated markers
    return segments.some(segment => 
      segment.autoGenerated || 
      segment.streamReconstructed ||
      (segment.text && segment.text.length > 100 && !segment.text.includes('.'))
    );
  }

  masterCleanupSegments(segments) {
    // Master cleanup function for final processing (mirror of hybrid script function)
    console.log('🧹 Running master cleanup on', segments.length, 'segments');
    
    if (!segments || segments.length === 0) return [];
    
    // Step 1: Enhanced text cleaning for each segment
    let cleaned = segments.map(segment => {
      let cleanedText = segment.text || '';
      
      // Normalize spaces and fix word merging
      cleanedText = cleanedText
        .replace(/\s+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Fix common merged patterns
        .replace(/\b(\w+)(month|year|day|week|time|where|when|what|how|this|that|like|once)\b/gi, '$1 $2')
        .replace(/\b(once|the|a|an|is|are|was|were|and|or|but|so|then|now)(\w+)\b/gi, '$1 $2')
        // Remove immediate word repetitions
        .replace(/\b(\w+)\s+\1\b/g, '$1')
        .replace(/\b(\w{2,})\s+\1\s+\1\b/g, '$1')
        .trim();
      
      // Remove phrase repetitions within the segment
      cleanedText = this.removePhraseRepetitions(cleanedText);
      
      return {
        ...segment,
        text: cleanedText
      };
    }).filter(segment => segment.text && segment.text.length > 5);
    
    // Step 2: Remove duplicates based on text similarity
    const unique = [];
    for (const segment of cleaned) {
      const isDuplicate = unique.some(existing => 
        this.calculateTextSimilarity(segment.text.toLowerCase(), existing.text.toLowerCase()) > 0.85
      );
      if (!isDuplicate) {
        unique.push(segment);
      }
    }
    
    // Step 3: Merge very short segments with adjacent ones
    const merged = [];
    for (let i = 0; i < unique.length; i++) {
      const current = unique[i];
      const next = unique[i + 1];
      
      if (current.text.split(' ').length <= 3 && next && 
          Math.abs(next.start - current.end) < 5) {
        // Merge short segment with next
        merged.push({
          ...current,
          text: current.text + ' ' + next.text,
          end: next.end,
          duration: next.end - current.start
        });
        i++; // Skip next since we merged it
      } else {
        merged.push(current);
      }
    }
    
    console.log(`📊 Master cleanup: ${segments.length} → ${cleaned.length} → ${unique.length} → ${merged.length}`);
    return merged;
  }

  calculateTextSimilarity(text1, text2) {
    // Calculate text similarity using word overlap
    const words1 = text1.split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(w => set2.has(w)));
    
    return intersection.size / Math.max(set1.size, set2.size);
  }

  removePhraseRepetitions(text) {
    // Remove phrase-level repetitions within a single segment
    const words = text.split(/\s+/);
    if (words.length < 6) return text;
    
    // Check for repeated phrases of various lengths
    for (let phraseLen = 3; phraseLen <= Math.floor(words.length / 2); phraseLen++) {
      for (let i = 0; i <= words.length - phraseLen * 2; i++) {
        const phrase1 = words.slice(i, i + phraseLen).join(' ');
        const phrase2 = words.slice(i + phraseLen, i + phraseLen * 2).join(' ');
        
        if (phrase1.toLowerCase() === phrase2.toLowerCase()) {
          // Found repetition - remove the second occurrence
          const before = words.slice(0, i + phraseLen);
          const after = words.slice(i + phraseLen * 2);
          console.log('🗑️ Removed phrase repetition:', phrase1);
          return [...before, ...after].join(' ');
        }
      }
    }
    
    return text;
  }

  updateTranscriptData(newTranscriptData) {
    // ✅ NEW: Method to update transcript data and re-render
    console.log('🔄 Updating transcript data with', newTranscriptData.length, 'segments');
    this.transcriptData = newTranscriptData;
    this.renderTranscript();
    this.updateStats();
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptRestructurer;
} else {
  // Make available globally in browser
  window.TranscriptRestructurer = TranscriptRestructurer;
}