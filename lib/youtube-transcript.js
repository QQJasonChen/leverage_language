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
    
    // Group by pauses
    const groups = this.groupByPauses(transcript);
    
    // Convert groups to sentences
    const sentences = [];
    
    for (const group of groups) {
      const text = group.map(seg => seg.text).join(' ');
      const startTime = group[0].start;
      const endTime = group[group.length - 1].end;
      
      let sentence = text;
      
      // Apply basic punctuation
      sentence = this.applyBasicPunctuation(sentence);
      
      // If AI is enabled, use it for better restructuring
      if (useAI && aiService) {
        try {
          sentence = await this.restructureWithAI(sentence, aiService, language);
        } catch (error) {
          console.error('AI restructuring failed, using basic punctuation:', error);
        }
      }
      
      sentences.push({
        text: sentence,
        start: startTime,
        end: endTime,
        segments: group
      });
    }
    
    return sentences;
  }

  // Use AI to restructure sentences
  async restructureWithAI(text, aiService, language) {
    const prompt = `Please restructure this auto-generated transcript into a properly punctuated sentence. 
    Keep the exact same words but add proper punctuation and capitalization.
    Language: ${language}
    Transcript: "${text}"
    
    Return only the restructured sentence, nothing else.`;
    
    const response = await aiService.generateResponse(prompt);
    return response.trim();
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