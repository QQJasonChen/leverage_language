// YouTube Transcript Fetcher and Restructurer

class YouTubeTranscriptFetcher {
  constructor() {
    this.cache = new Map();
  }

  // Extract video ID from YouTube URL
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Fetch transcript from YouTube
  async fetchTranscript(videoId) {
    // Check cache first
    if (this.cache.has(videoId)) {
      return this.cache.get(videoId);
    }

    try {
      // Method 1: Try YouTube's caption track
      const transcript = await this.fetchFromCaptionTrack(videoId);
      if (transcript) {
        this.cache.set(videoId, transcript);
        return transcript;
      }

      // Method 2: Try scraping from page
      const scrapedTranscript = await this.scrapeTranscript(videoId);
      if (scrapedTranscript) {
        this.cache.set(videoId, scrapedTranscript);
        return scrapedTranscript;
      }

      throw new Error('No transcript available');
    } catch (error) {
      console.error('Error fetching transcript:', error);
      throw error;
    }
  }

  // Fetch from YouTube's caption API
  async fetchFromCaptionTrack(videoId) {
    try {
      // First, get the video page to extract caption tracks
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await response.text();
      
      // Extract caption tracks from the page
      const captionRegex = /"captionTracks":(\[.*?\])/;
      const match = html.match(captionRegex);
      
      if (!match) return null;
      
      const captionTracks = JSON.parse(match[1]);
      if (!captionTracks || captionTracks.length === 0) return null;
      
      // Prefer auto-generated captions or first available
      const track = captionTracks.find(t => t.vssId && t.vssId.includes('.asr')) || captionTracks[0];
      
      // Fetch the actual caption data
      const captionResponse = await fetch(track.baseUrl);
      const captionXml = await captionResponse.text();
      
      // Parse XML to extract transcript
      return this.parseTranscriptXml(captionXml);
    } catch (error) {
      console.error('Error fetching caption track:', error);
      return null;
    }
  }

  // Parse YouTube caption XML
  parseTranscriptXml(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const texts = doc.querySelectorAll('text');
    
    const transcript = [];
    texts.forEach(text => {
      const start = parseFloat(text.getAttribute('start'));
      const duration = parseFloat(text.getAttribute('dur'));
      const content = text.textContent.replace(/\n/g, ' ').trim();
      
      if (content) {
        transcript.push({
          start: start,
          end: start + duration,
          duration: duration,
          text: content
        });
      }
    });
    
    return transcript;
  }

  // Fallback: Scrape transcript from page
  async scrapeTranscript(videoId) {
    try {
      // This is a simplified version - in production, you might need more robust scraping
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await response.text();
      
      // Look for transcript in initial data
      const ytInitialDataRegex = /var ytInitialData = ({.*?});/s;
      const match = html.match(ytInitialDataRegex);
      
      if (!match) return null;
      
      const data = JSON.parse(match[1]);
      // Navigate through YouTube's data structure to find transcripts
      // This path may change as YouTube updates their structure
      
      return null; // Placeholder - implement actual scraping logic
    } catch (error) {
      console.error('Error scraping transcript:', error);
      return null;
    }
  }

  // Group transcript segments by natural pauses
  groupByPauses(transcript, pauseThreshold = 1.5) {
    const groups = [];
    let currentGroup = [];
    
    for (let i = 0; i < transcript.length; i++) {
      currentGroup.push(transcript[i]);
      
      // Check if there's a pause before the next segment
      if (i < transcript.length - 1) {
        const currentEnd = transcript[i].end;
        const nextStart = transcript[i + 1].start;
        const pause = nextStart - currentEnd;
        
        // If pause is significant, start a new group
        if (pause > pauseThreshold) {
          groups.push(currentGroup);
          currentGroup = [];
        }
      }
    }
    
    // Add the last group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  // Apply basic punctuation rules
  applyBasicPunctuation(text) {
    // Capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);
    
    // Add period at end if missing
    if (!text.match(/[.!?]$/)) {
      text += '.';
    }
    
    // Capitalize after sentence endings
    text = text.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    // Common corrections
    text = text.replace(/\bi\b/g, 'I'); // Capitalize "I"
    text = text.replace(/\s+/g, ' '); // Remove extra spaces
    
    return text;
  }

  // Restructure transcript segments into sentences
  async restructureTranscript(transcript, options = {}) {
    const { useAI = false, aiService = null, language = 'en' } = options;
    
    console.log('📝 Starting transcript restructuring:', {
      segments: transcript.length,
      useAI,
      language
    });
    
    // Group by pauses
    const groups = this.groupByPauses(transcript);
    console.log('📁 Grouped into', groups.length, 'sentence groups');
    
    // Convert groups to sentences with non-blocking processing
    const sentences = [];
    
    // Process in batches to prevent browser freezing
    const batchSize = 5; // Process 5 sentences at a time
    const totalBatches = Math.ceil(groups.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, groups.length);
      const batch = groups.slice(startIdx, endIdx);
      
      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} sentences)`);
      
      // Process current batch
      const batchPromises = batch.map(async (group, groupIndex) => {
        const text = group.map(seg => seg.text).join(' ');
        const startTime = group[0].start;
        const endTime = group[group.length - 1].end;
        
        let sentence = text;
        
        // Apply basic punctuation first
        sentence = this.applyBasicPunctuation(sentence);
        
        // If AI is enabled and sentence is substantial, use AI for better restructuring
        if (useAI && aiService && sentence.trim().length > 10) {
          try {
            sentence = await this.restructureWithAI(sentence, aiService, language);
          } catch (error) {
            console.error(`❌ AI restructuring failed for sentence ${startIdx + groupIndex + 1}:`, error.message);
            // Continue with basic punctuation
          }
        }
        
        return {
          text: sentence,
          start: startTime,
          end: endTime,
          segments: group
        };
      });
      
      // Wait for current batch to complete
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Add successful results to sentences array
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            sentences.push(result.value);
          } else {
            console.error(`❌ Failed to process sentence ${startIdx + index + 1}:`, result.reason);
            // Add basic version as fallback
            const group = batch[index];
            const text = group.map(seg => seg.text).join(' ');
            sentences.push({
              text: this.applyBasicPunctuation(text),
              start: group[0].start,
              end: group[group.length - 1].end,
              segments: group
            });
          }
        });
        
        // Add small delay between batches to prevent overwhelming the browser
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, error);
        // Process batch without AI as fallback
        batch.forEach(group => {
          const text = group.map(seg => seg.text).join(' ');
          sentences.push({
            text: this.applyBasicPunctuation(text),
            start: group[0].start,
            end: group[group.length - 1].end,
            segments: group
          });
        });
      }
    }
    
    console.log(`✅ Transcript restructuring complete: ${sentences.length} sentences processed`);
    return sentences;
  }

  // Use AI to restructure sentences with timeout protection
  async restructureWithAI(text, aiService, language) {
    try {
      // Skip very short texts to reduce API calls
      if (text.trim().length < 10) {
        return text;
      }
      
      // Use the polishText method which is more efficient for this purpose
      const polishedText = await aiService.polishText(text);
      
      // Validate the result
      if (polishedText && polishedText.trim().length > 0) {
        return polishedText.trim();
      } else {
        console.warn('⚠️ AI returned empty result, using original text');
        return text;
      }
    } catch (error) {
      // Don't log full error details to avoid spam
      console.error('❌ AI restructuring failed:', error.message);
      return text; // Return original text if AI fails
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeTranscriptFetcher;
} else {
  // Make available globally in browser
  window.YouTubeTranscriptFetcher = YouTubeTranscriptFetcher;
}