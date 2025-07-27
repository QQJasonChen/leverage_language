// Simplified YouTube Transcript Content Script
// Focuses on working methods without CSP violations

(function() {
  'use strict';

  console.log('🎬 Simple YouTube transcript content script loaded');

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎬 Simple transcript content script received message:', request);
    
    // Handle ping test
    if (request.action === 'ping') {
      console.log('🏓 Ping received, sending pong...');
      sendResponse({ 
        pong: true, 
        timestamp: Date.now(), 
        url: window.location.href,
        videoId: extractVideoId(),
        hasPlayer: !!document.querySelector('#movie_player')
      });
      return false;
    }
    
    // Handle transcript requests
    if (request.action === 'getYouTubeTranscript') {
      console.log('🚀 Processing simple transcript request...');
      getSimpleTranscript().then(response => {
        console.log('📤 Sending simple transcript response:', response);
        sendResponse(response);
      }).catch(error => {
        console.error('❌ Error in simple getTranscript:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
  });

  function extractVideoId() {
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  async function getSimpleTranscript() {
    console.log('🔍 Starting simple transcript extraction...');
    
    try {
      const videoId = extractVideoId();
      if (!videoId) {
        throw new Error('Could not extract video ID');
      }
      
      console.log('📹 Video ID:', videoId);

      // Method 1: Search page scripts for caption data (most reliable)
      let transcript = await searchPageScripts();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript via page scripts:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'pageScripts' };
      }

      // Method 2: Try to open transcript panel and scrape
      transcript = await openTranscriptPanel();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript via panel:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'transcriptPanel' };
      }

      // Method 3: Try YouTube's API approach
      transcript = await tryYouTubeAPI(videoId);
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript via API:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'youtubeAPI' };
      }

      throw new Error('No captions found. Video may not have auto-generated or manual captions available.');
      
    } catch (error) {
      console.error('❌ Simple transcript extraction failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function searchPageScripts() {
    console.log('🔍 Method 1: Searching page scripts...');
    
    try {
      // Get all script contents
      const scripts = Array.from(document.querySelectorAll('script'));
      console.log('📜 Found', scripts.length, 'scripts on page');
      
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        const content = script.textContent || script.innerHTML;
        
        if (!content) continue;
        
        // Look for various caption patterns
        const patterns = [
          // Pattern 1: captionTracks in ytInitialPlayerResponse
          /ytInitialPlayerResponse[^}]*"captionTracks":\s*(\[[^\]]*\])/,
          // Pattern 2: Direct captionTracks
          /"captionTracks":\s*(\[[^\]]*\])/,
          // Pattern 3: playerCaptionsTracklistRenderer
          /"playerCaptionsTracklistRenderer":\s*{[^}]*"captionTracks":\s*(\[[^\]]*\])/
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            console.log('📝 Found caption pattern in script', i);
            try {
              const captionTracks = JSON.parse(match[1]);
              if (captionTracks && captionTracks.length > 0) {
                console.log('🎯 Caption tracks found:', captionTracks.length);
                console.log('📋 Available tracks:', captionTracks.map(c => ({
                  vssId: c.vssId,
                  languageCode: c.languageCode,
                  name: c.name?.simpleText || c.name?.runs?.[0]?.text
                })));
                
                // Select best track (prioritize auto-generated)
                let track = selectBestTrack(captionTracks);
                if (track) {
                  console.log('🎯 Selected track:', {
                    vssId: track.vssId,
                    languageCode: track.languageCode,
                    baseUrl: track.baseUrl?.substring(0, 100) + '...'
                  });
                  
                  const transcript = await fetchCaptionData(track.baseUrl);
                  if (transcript && transcript.length > 0) {
                    return transcript;
                  }
                }
              }
            } catch (e) {
              console.log('❌ Failed to parse caption tracks:', e.message);
            }
          }
        }
      }
      
      console.log('❌ No caption tracks found in page scripts');
      return null;
      
    } catch (error) {
      console.error('❌ Script search failed:', error);
      return null;
    }
  }

  function selectBestTrack(tracks) {
    // Priority order:
    // 1. Auto-generated in any language (.asr)
    // 2. Dutch language (.nl or languageCode: 'nl')
    // 3. English as fallback (.en)
    // 4. First available track
    
    let track = tracks.find(t => t.vssId && t.vssId.includes('.asr'));
    if (track) {
      console.log('🎯 Found auto-generated track (.asr)');
      return track;
    }
    
    track = tracks.find(t => t.vssId && t.vssId.includes('.nl'));
    if (track) {
      console.log('🎯 Found Dutch track (.nl)');
      return track;
    }
    
    track = tracks.find(t => t.languageCode === 'nl');
    if (track) {
      console.log('🎯 Found Dutch track (languageCode)');
      return track;
    }
    
    track = tracks.find(t => t.vssId && t.vssId.includes('.en'));
    if (track) {
      console.log('🎯 Found English track (.en)');
      return track;
    }
    
    console.log('🎯 Using first available track');
    return tracks[0];
  }

  async function fetchCaptionData(url) {
    console.log('📡 Fetching caption data...');
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const xmlText = await response.text();
      console.log('📄 Received XML:', xmlText.length, 'characters');
      
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
      
      console.log('📝 Found', texts.length, 'text elements');
      
      const transcript = [];
      texts.forEach((text, index) => {
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
        
        if (content && !isNaN(start)) {
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

  async function openTranscriptPanel() {
    console.log('🔍 Method 2: Trying transcript panel...');
    
    try {
      // Look for transcript button or three-dot menu
      const moreButton = document.querySelector('[aria-label*="More" i]');
      if (moreButton) {
        console.log('🔘 Clicking more actions button...');
        moreButton.click();
        await sleep(500);
        
        // Look for transcript option
        const transcriptButtons = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.toLowerCase().includes('transcript') || 
                 text.toLowerCase().includes('transcriptie') ||
                 text.toLowerCase().includes('字幕');
        });
        
        if (transcriptButtons.length > 0) {
          console.log('📝 Found transcript button, clicking...');
          transcriptButtons[0].click();
          await sleep(1000);
          
          // Try to extract from transcript panel
          const segments = document.querySelectorAll('[role="button"]').filter(el => {
            return el.textContent && /\d+:\d+/.test(el.textContent);
          });
          
          if (segments.length > 0) {
            console.log('📝 Found', segments.length, 'transcript segments');
            return extractFromSegments(segments);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Transcript panel method failed:', error);
      return null;
    }
  }

  function extractFromSegments(segments) {
    const transcript = [];
    segments.forEach(segment => {
      const text = segment.textContent;
      const timeMatch = text.match(/(\d+):(\d+)/);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1]);
        const seconds = parseInt(timeMatch[2]);
        const startTime = minutes * 60 + seconds;
        
        const content = text.replace(/\d+:\d+/, '').trim();
        if (content) {
          transcript.push({
            start: startTime,
            end: startTime + 3,
            duration: 3,
            text: content
          });
        }
      }
    });
    
    return transcript;
  }

  async function tryYouTubeAPI(videoId) {
    console.log('🔍 Method 3: Trying YouTube API approach...');
    
    try {
      // This method would require API key, so we'll skip for now
      console.log('⏭️ Skipping API method (requires API key)');
      return null;
    } catch (error) {
      console.error('❌ YouTube API method failed:', error);
      return null;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();