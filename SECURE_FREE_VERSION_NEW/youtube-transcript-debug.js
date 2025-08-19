// Debug YouTube Transcript Content Script
// Shows detailed information about what's happening

(function() {
  'use strict';

  console.log('🎬 DEBUG YouTube transcript content script loaded');

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎬 DEBUG transcript content script received message:', request);
    
    // Handle ping test
    if (request.action === 'ping') {
      console.log('🏓 DEBUG Ping received, sending pong...');
      sendResponse({ 
        pong: true, 
        timestamp: Date.now(), 
        url: window.location.href,
        videoId: extractVideoId(),
        hasPlayer: !!document.querySelector('#movie_player'),
        hasCCButton: !!document.querySelector('.ytp-subtitles-button')
      });
      return false;
    }
    
    // Handle transcript requests
    if (request.action === 'getYouTubeTranscript') {
      console.log('🚀 DEBUG Processing transcript request...');
      getDebugTranscript().then(response => {
        console.log('📤 DEBUG Sending transcript response:', response);
        sendResponse(response);
      }).catch(error => {
        console.error('❌ DEBUG Error in getTranscript:', error);
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

  async function getDebugTranscript() {
    console.log('🔍 DEBUG Starting transcript extraction...');
    
    try {
      const videoId = extractVideoId();
      console.log('📹 DEBUG Video ID:', videoId);
      
      if (!videoId) {
        throw new Error('Could not extract video ID');
      }

      // Comprehensive debug of page content
      await debugPageContent();
      
      // Method 1: Exhaustive script search
      let transcript = await debugScriptSearch();
      if (transcript && transcript.length > 0) {
        console.log('✅ DEBUG Transcript found via script search:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'scriptSearch' };
      }

      // Method 2: Try different approaches
      transcript = await debugAlternativeMethods();
      if (transcript && transcript.length > 0) {
        console.log('✅ DEBUG Transcript found via alternative method:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'alternative' };
      }

      throw new Error('DEBUG: No captions found after exhaustive search');
      
    } catch (error) {
      console.error('❌ DEBUG transcript extraction failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function debugPageContent() {
    console.log('🔍 DEBUG Page content analysis...');
    
    // Check basic page elements
    const player = document.querySelector('#movie_player');
    const ccButton = document.querySelector('.ytp-subtitles-button');
    const settingsButton = document.querySelector('.ytp-settings-button');
    
    console.log('🎬 DEBUG Player found:', !!player);
    console.log('📝 DEBUG CC button found:', !!ccButton);
    console.log('⚙️ DEBUG Settings button found:', !!settingsButton);
    
    if (ccButton) {
      console.log('📝 DEBUG CC button state:', {
        ariaPressed: ccButton.getAttribute('aria-pressed'),
        title: ccButton.getAttribute('title'),
        className: ccButton.className
      });
    }
    
    // Check for global YouTube variables
    console.log('🌐 DEBUG Global variables:');
    console.log('  - window.ytInitialData:', typeof window.ytInitialData);
    console.log('  - window.ytInitialPlayerResponse:', typeof window.ytInitialPlayerResponse);
    console.log('  - window.ytplayer:', typeof window.ytplayer);
    console.log('  - window.yt:', typeof window.yt);
    
    // Try to access ytInitialPlayerResponse directly
    if (window.ytInitialPlayerResponse) {
      console.log('🎯 DEBUG ytInitialPlayerResponse found!');
      const captions = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captions) {
        console.log('📝 DEBUG Direct captions found:', captions.length);
        console.log('📋 DEBUG Direct caption tracks:', captions.map(c => ({
          vssId: c.vssId,
          languageCode: c.languageCode,
          name: c.name?.simpleText
        })));
      } else {
        console.log('❌ DEBUG No captions in ytInitialPlayerResponse');
        console.log('🔍 DEBUG ytInitialPlayerResponse structure:', Object.keys(window.ytInitialPlayerResponse));
      }
    }
  }

  async function debugScriptSearch() {
    console.log('🔍 DEBUG Script search method...');
    
    const scripts = Array.from(document.querySelectorAll('script'));
    console.log('📜 DEBUG Found', scripts.length, 'scripts on page');
    
    let scriptsWithCaptions = 0;
    let totalMatches = 0;
    
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const content = script.textContent || script.innerHTML;
      
      if (!content) continue;
      
      // Count scripts that mention captions
      if (content.includes('caption')) {
        scriptsWithCaptions++;
      }
      
      // Try multiple search patterns
      const patterns = [
        { name: 'ytInitialPlayerResponse', regex: /ytInitialPlayerResponse[^}]*"captionTracks":\s*(\[[^\]]*\])/ },
        { name: 'captionTracks direct', regex: /"captionTracks":\s*(\[[^\]]*\])/ },
        { name: 'playerCaptionsTracklistRenderer', regex: /"playerCaptionsTracklistRenderer":\s*{[^}]*"captionTracks":\s*(\[[^\]]*\])/ },
        { name: 'var ytInitialPlayerResponse', regex: /var ytInitialPlayerResponse\s*=\s*{[^}]*"captionTracks":\s*(\[[^\]]*\])/ },
        { name: 'window.ytInitialPlayerResponse', regex: /window\.ytInitialPlayerResponse[^}]*"captionTracks":\s*(\[[^\]]*\])/ }
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern.regex);
        if (match) {
          totalMatches++;
          console.log(`📝 DEBUG Found ${pattern.name} pattern in script ${i}`);
          console.log(`📄 DEBUG Match context:`, match[0].substring(0, 200) + '...');
          
          try {
            const captionTracks = JSON.parse(match[1]);
            if (captionTracks && captionTracks.length > 0) {
              console.log('🎯 DEBUG Successfully parsed caption tracks:', captionTracks.length);
              console.log('📋 DEBUG Track details:', captionTracks.map(c => ({
                vssId: c.vssId,
                languageCode: c.languageCode,
                name: c.name?.simpleText || c.name?.runs?.[0]?.text,
                hasBaseUrl: !!c.baseUrl
              })));
              
              // Try to fetch transcript from best track
              const track = selectBestTrack(captionTracks);
              if (track && track.baseUrl) {
                console.log('🚀 DEBUG Attempting to fetch transcript from:', track.baseUrl.substring(0, 100) + '...');
                const transcript = await fetchCaptionData(track.baseUrl);
                if (transcript && transcript.length > 0) {
                  return transcript;
                }
              } else {
                console.log('❌ DEBUG Selected track has no baseUrl');
              }
            }
          } catch (e) {
            console.log('❌ DEBUG Failed to parse tracks in script', i, ':', e.message);
          }
        }
      }
    }
    
    console.log(`📊 DEBUG Search summary:
      - Scripts with "caption": ${scriptsWithCaptions}
      - Pattern matches found: ${totalMatches}
      - Scripts searched: ${scripts.length}`);
    
    return null;
  }

  function selectBestTrack(tracks) {
    console.log('🎯 DEBUG Selecting best track from', tracks.length, 'options');
    
    // Try different selection strategies
    const strategies = [
      { name: 'Auto-generated (.asr)', filter: t => t.vssId && t.vssId.includes('.asr') },
      { name: 'Dutch (.nl)', filter: t => t.vssId && t.vssId.includes('.nl') },
      { name: 'Dutch language code', filter: t => t.languageCode === 'nl' },
      { name: 'English (.en)', filter: t => t.vssId && t.vssId.includes('.en') },
      { name: 'English language code', filter: t => t.languageCode === 'en' },
      { name: 'First available', filter: t => true }
    ];
    
    for (const strategy of strategies) {
      const track = tracks.find(strategy.filter);
      if (track) {
        console.log(`🎯 DEBUG Selected track using "${strategy.name}":`, {
          vssId: track.vssId,
          languageCode: track.languageCode,
          name: track.name?.simpleText,
          hasBaseUrl: !!track.baseUrl
        });
        return track;
      }
    }
    
    console.log('❌ DEBUG No suitable track found');
    return null;
  }

  async function fetchCaptionData(url) {
    console.log('📡 DEBUG Fetching caption data from:', url.substring(0, 100) + '...');
    
    try {
      const response = await fetch(url);
      console.log('📡 DEBUG Fetch response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      console.log('📄 DEBUG Received XML:', {
        length: xmlText.length,
        preview: xmlText.substring(0, 200) + '...'
      });
      
      return parseTranscriptXml(xmlText);
    } catch (error) {
      console.error('❌ DEBUG Failed to fetch caption data:', error);
      return null;
    }
  }

  function parseTranscriptXml(xml) {
    console.log('🔍 DEBUG Parsing transcript XML...');
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      // Check for XML parsing errors
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        console.error('❌ DEBUG XML parsing error:', errorNode.textContent);
        return null;
      }
      
      const texts = doc.querySelectorAll('text');
      console.log('📝 DEBUG Found', texts.length, 'text elements in XML');
      
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
          
          // Log first few segments for debugging
          if (index < 3) {
            console.log(`📝 DEBUG Segment ${index}:`, {
              start,
              duration,
              text: content.substring(0, 50) + (content.length > 50 ? '...' : '')
            });
          }
        }
      });
      
      console.log('✅ DEBUG Parsed transcript:', transcript.length, 'valid segments');
      return transcript;
    } catch (error) {
      console.error('❌ DEBUG XML parsing failed:', error);
      return null;
    }
  }

  async function debugAlternativeMethods() {
    console.log('🔍 DEBUG Trying alternative methods...');
    
    // Method: Check if captions are currently displayed
    const captionElements = document.querySelectorAll('.ytp-caption-segment, .captions-text');
    if (captionElements.length > 0) {
      console.log('📝 DEBUG Found active caption elements:', captionElements.length);
      // This would only give current caption, not full transcript
    }
    
    // Method: Try to trigger caption display
    const ccButton = document.querySelector('.ytp-subtitles-button');
    if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
      console.log('📝 DEBUG Trying to enable captions...');
      ccButton.click();
      await sleep(1000);
      
      // Check if captions are now available
      return await debugScriptSearch();
    }
    
    return null;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();