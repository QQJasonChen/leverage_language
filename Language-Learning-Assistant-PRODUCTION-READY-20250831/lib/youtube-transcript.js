// Simple YouTube Transcript Fetcher
// Focused on basic functionality that works reliably

class YouTubeTranscriptFetcher {
  constructor() {
    this.cache = new Map();
    console.log('🎬 Simple YouTubeTranscriptFetcher initialized');
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

  // Main fetch method - simplified and reliable
  async fetchTranscript(videoId) {
    console.log('🚀 Fetching transcript for video:', videoId);
    
    // Check cache first
    if (this.cache.has(videoId)) {
      console.log('📋 Using cached transcript');
      return this.cache.get(videoId);
    }

    try {
      // Get transcript from active YouTube tab
      const transcript = await this.getTranscriptFromActiveTab();
      
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript obtained:', transcript.length, 'segments');
        this.cache.set(videoId, transcript);
        return transcript;
      } else {
        throw new Error('No transcript available');
      }
    } catch (error) {
      console.error('❌ Error fetching transcript:', error);
      throw error;
    }
  }

  // Get transcript from the active YouTube tab  
  async getTranscriptFromActiveTab() {
    return new Promise((resolve, reject) => {
      try {
        console.log('📤 Requesting transcript from YouTube content script...');
        
        // Get active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || tabs.length === 0) {
            reject(new Error('No active tab found'));
            return;
          }
          
          const activeTab = tabs[0];
          console.log('📋 Active tab:', activeTab.url);
          
          // Check if it's a YouTube tab
          if (!activeTab.url.includes('youtube.com')) {
            reject(new Error('Not a YouTube tab'));
            return;
          }
          
          // Send message to content script
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'getYouTubeTranscript'
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Runtime error:', chrome.runtime.lastError);
              reject(new Error('Failed to communicate with YouTube tab'));
              return;
            }
            
            console.log('📥 Response from content script:', response);
            
            if (response && response.success) {
              const transcript = response.transcript || [];
              console.log('✅ Transcript received:', transcript.length, 'segments');
              resolve(transcript);
            } else {
              const error = response ? response.error : 'Unknown error';
              reject(new Error(`Transcript fetch failed: ${error}`));
            }
          });
        });
      } catch (error) {
        console.error('❌ Error in getTranscriptFromActiveTab:', error);
        reject(error);
      }
    });
  }

  // Fallback method - return a basic transcript structure
  createFallbackTranscript() {
    console.log('🔄 Creating fallback transcript...');
    return [
      {
        text: 'Transcript not available for this video.',
        start: 0,
        end: 5
      },
      {
        text: 'Please make sure the video has captions enabled.',
        start: 5,
        end: 10
      },
      {
        text: 'You can try refreshing the page and trying again.',
        start: 10,
        end: 15
      }
    ];
  }

  // Simple restructure method 
  async restructureTranscript(transcript) {
    if (!transcript || transcript.length === 0) {
      return this.createFallbackTranscript();
    }
    
    console.log('🔧 Restructuring transcript:', transcript.length, 'segments');
    
    // Basic restructuring - combine short segments
    const restructured = [];
    let currentSentence = '';
    let currentStart = 0;
    let currentEnd = 0;
    
    for (let i = 0; i < transcript.length; i++) {
      const segment = transcript[i];
      
      if (!currentSentence) {
        currentSentence = segment.text;
        currentStart = segment.start || 0;
        currentEnd = segment.end || (segment.start + 3);
      } else {
        currentSentence += ' ' + segment.text;
        currentEnd = segment.end || (segment.start + 3);
      }
      
      // End sentence on punctuation or if it gets too long
      if (segment.text.match(/[.!?]$/) || currentSentence.length > 100 || i === transcript.length - 1) {
        restructured.push({
          text: currentSentence.trim(),
          start: currentStart,
          end: currentEnd
        });
        currentSentence = '';
      }
    }
    
    console.log('✅ Restructured into', restructured.length, 'sentences');
    return restructured;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Transcript cache cleared');
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.YouTubeTranscriptFetcher = YouTubeTranscriptFetcher;
}

// Also for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeTranscriptFetcher;
}