// Enhanced YouTube Transcript Content Script
// Specifically designed to handle auto-generated captions

(function() {
  'use strict';

  console.log('🎬 Enhanced YouTube transcript content script loaded');

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getYouTubeTranscript') {
      console.log('🚀 Processing enhanced transcript request...');
      getEnhancedTranscript().then(response => {
        console.log('📤 Sending enhanced transcript response:', response);
        sendResponse(response);
      }).catch(error => {
        console.error('❌ Error in enhanced getTranscript:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
  });

  async function getEnhancedTranscript() {
    console.log('🔍 Starting enhanced transcript extraction...');
    
    try {
      // Method 1: Direct API approach - get video ID and fetch captions
      const videoId = extractVideoId();
      if (!videoId) {
        throw new Error('Could not extract video ID');
      }
      
      console.log('📹 Video ID extracted:', videoId);

      // Method 1a: Try to get captions from ytInitialPlayerResponse
      let transcript = await getFromInitialPlayerResponse();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript from ytInitialPlayerResponse:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'initialPlayerResponse' };
      }

      // Method 1b: Try to get from current page's embedded data
      transcript = await getFromEmbeddedData();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript from embedded data:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'embeddedData' };
      }

      // Method 2: Use the visual transcript panel
      transcript = await getFromTranscriptPanel();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript from panel:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'transcriptPanel' };
      }

      // Method 3: Scrape from subtitle elements
      transcript = await getFromSubtitleElements();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript from subtitle elements:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'subtitleElements' };
      }

      throw new Error('No captions found. Video may not have auto-generated or manual captions available.');
      
    } catch (error) {
      console.error('❌ Enhanced transcript extraction failed:', error);
      return { success: false, error: error.message };
    }
  }

  function extractVideoId() {
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  async function getFromInitialPlayerResponse() {
    console.log('🎯 Method 1a: Checking ytInitialPlayerResponse...');
    
    try {
      // Look for ytInitialPlayerResponse in page scripts
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/var ytInitialPlayerResponse = ({.+?});/);
          if (match) {
            const data = JSON.parse(match[1]);
            const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            
            if (captions && captions.length > 0) {
              console.log('📝 Found caption tracks:', captions.length);
              
              // Prefer auto-generated English captions
              let track = captions.find(c => c.vssId && c.vssId.includes('.en')) ||
                         captions.find(c => c.vssId && c.vssId.includes('.asr')) ||
                         captions[0];
              
              console.log('🎯 Using track:', track);
              return await fetchCaptionData(track.baseUrl);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Method 1a failed:', error);
    }
    
    return null;
  }

  async function getFromEmbeddedData() {
    console.log('🎯 Method 1b: Checking embedded data...');
    
    try {
      // Check if there's ytInitialData
      if (window.ytInitialData) {
        const data = window.ytInitialData;
        // Navigate through the data structure to find captions
        // This path might change as YouTube updates
        const watchContent = data?.contents?.twoColumnWatchNextResults;
        // Add more specific navigation here based on YouTube's current structure
      }

      // Also check for ytInitialPlayerResponse global
      if (window.ytInitialPlayerResponse) {
        const data = window.ytInitialPlayerResponse;
        const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (captions && captions.length > 0) {
          let track = captions.find(c => c.vssId && c.vssId.includes('.asr')) || captions[0];
          return await fetchCaptionData(track.baseUrl);
        }
      }
    } catch (error) {
      console.error('❌ Method 1b failed:', error);
    }
    
    return null;
  }

  async function getFromTranscriptPanel() {
    console.log('🎯 Method 2: Trying transcript panel...');
    
    try {
      // First check if transcript panel is already open
      let transcriptPanel = document.querySelector('[aria-label*="transcript" i], [aria-label*="Show transcript" i]');
      
      if (!transcriptPanel) {
        // Try to open it
        console.log('🔍 Looking for transcript button...');
        
        // Look for the three-dot menu first
        const moreButton = document.querySelector('button[aria-label*="More actions" i]');
        if (moreButton) {
          moreButton.click();
          await sleep(500);
          
          // Look for transcript option in menu
          const transcriptButton = Array.from(document.querySelectorAll('yt-formatted-string, span'))
            .find(el => el.textContent && el.textContent.toLowerCase().includes('transcript'));
          
          if (transcriptButton) {
            transcriptButton.click();
            await sleep(1000);
          }
        }
      }
      
      // Now try to extract from the transcript panel
      await sleep(1000);
      const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
      
      if (segments.length > 0) {
        console.log('📝 Found transcript segments:', segments.length);
        const transcript = [];
        
        segments.forEach(segment => {
          const timeEl = segment.querySelector('.segment-timestamp');
          const textEl = segment.querySelector('.segment-text');
          
          if (timeEl && textEl) {
            const timeStr = timeEl.textContent.trim();
            const time = parseTimestamp(timeStr);
            const text = textEl.textContent.trim();
            
            transcript.push({
              start: time,
              end: time + 3, // Approximate duration
              text: text
            });
          }
        });
        
        return transcript;
      }
    } catch (error) {
      console.error('❌ Method 2 failed:', error);
    }
    
    return null;
  }

  async function getFromSubtitleElements() {
    console.log('🎯 Method 3: Checking subtitle elements...');
    
    try {
      // Look for current subtitle display
      const subtitleContainers = [
        '.ytp-caption-segment',
        '.captions-text',
        '.ytp-caption-window-container',
        '.caption-window'
      ];
      
      for (const selector of subtitleContainers) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log('📝 Found subtitle elements:', elements.length);
          // This would only get current subtitle, not full transcript
          // More useful for real-time enhancement
        }
      }
    } catch (error) {
      console.error('❌ Method 3 failed:', error);
    }
    
    return null;
  }

  async function fetchCaptionData(url) {
    console.log('📡 Fetching caption data from:', url);
    
    try {
      const response = await fetch(url);
      const xmlText = await response.text();
      return parseTranscriptXml(xmlText);
    } catch (error) {
      console.error('❌ Failed to fetch caption data:', error);
      return null;
    }
  }

  function parseTranscriptXml(xml) {
    console.log('🔍 Parsing transcript XML...');
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const texts = doc.querySelectorAll('text');
      
      const transcript = [];
      texts.forEach(text => {
        const start = parseFloat(text.getAttribute('start'));
        const duration = parseFloat(text.getAttribute('dur')) || 3;
        const content = text.textContent
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\n/g, ' ')
          .trim();
        
        if (content) {
          transcript.push({
            start: start,
            end: start + duration,
            duration: duration,
            text: content
          });
        }
      });
      
      console.log('✅ Parsed transcript:', transcript.length, 'segments');
      return transcript;
    } catch (error) {
      console.error('❌ XML parsing failed:', error);
      return null;
    }
  }

  function parseTimestamp(timestamp) {
    const parts = timestamp.trim().split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();