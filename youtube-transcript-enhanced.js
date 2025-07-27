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

      // Method 3: Direct page injection to access player
      transcript = await getFromDirectPageAccess();
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript from direct page access:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'directPageAccess' };
      }

      // Method 4: Scrape from subtitle elements
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
              console.log('📋 All available tracks:', captions.map(c => ({
                vssId: c.vssId,
                languageCode: c.languageCode,
                name: c.name?.simpleText,
                isTranslatable: c.isTranslatable
              })));
              
              // Prefer auto-generated captions in any language
              let track = captions.find(c => c.vssId && c.vssId.includes('.asr')) || // Auto-generated
                         captions.find(c => c.vssId && c.vssId.includes('.nl')) ||  // Dutch
                         captions.find(c => c.vssId && c.vssId.includes('.en')) ||  // English
                         captions.find(c => c.languageCode === 'nl') ||              // Dutch by code
                         captions[0]; // Fallback to first available
              
              console.log('🎯 Selected track:', track);
              console.log('🔍 Track details:', {
                vssId: track.vssId,
                languageCode: track.languageCode,
                baseUrl: track.baseUrl?.substring(0, 100) + '...'
              });
              
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
        console.log('📊 Found ytInitialData');
        const data = window.ytInitialData;
        // Navigate through the data structure to find captions
        // This path might change as YouTube updates
        const watchContent = data?.contents?.twoColumnWatchNextResults;
        // Add more specific navigation here based on YouTube's current structure
      }

      // Also check for ytInitialPlayerResponse global
      if (window.ytInitialPlayerResponse) {
        console.log('📊 Found ytInitialPlayerResponse global');
        const data = window.ytInitialPlayerResponse;
        const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (captions && captions.length > 0) {
          console.log('📝 Found captions in global data:', captions.length);
          console.log('📋 Global tracks:', captions.map(c => ({
            vssId: c.vssId,
            languageCode: c.languageCode,
            name: c.name?.simpleText
          })));
          
          let track = captions.find(c => c.vssId && c.vssId.includes('.asr')) || 
                     captions.find(c => c.languageCode === 'nl') ||
                     captions[0];
          
          console.log('🎯 Selected global track:', track);
          return await fetchCaptionData(track.baseUrl);
        }
      }

      // Try alternative script search patterns
      console.log('🔍 Searching for alternative script patterns...');
      const scriptTexts = Array.from(document.querySelectorAll('script')).map(s => s.textContent);
      
      for (const scriptText of scriptTexts) {
        if (scriptText.includes('captionTracks')) {
          console.log('📜 Found script with captionTracks');
          // Try different regex patterns
          const patterns = [
            /"captionTracks":\s*(\[[^\]]*\])/,
            /'captionTracks':\s*(\[[^\]]*\])/,
            /captionTracks:\s*(\[[^\]]*\])/
          ];
          
          for (const pattern of patterns) {
            const match = scriptText.match(pattern);
            if (match) {
              console.log('✅ Found captions with pattern:', pattern);
              try {
                const captions = JSON.parse(match[1]);
                if (captions && captions.length > 0) {
                  console.log('📝 Alternative pattern captions:', captions.length);
                  let track = captions.find(c => c.vssId && c.vssId.includes('.asr')) || 
                             captions.find(c => c.languageCode === 'nl') ||
                             captions[0];
                  return await fetchCaptionData(track.baseUrl);
                }
              } catch (e) {
                console.log('❌ Failed to parse alternative pattern:', e);
              }
            }
          }
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
          
          // Look for transcript option in menu (multiple languages)
          const transcriptButton = Array.from(document.querySelectorAll('yt-formatted-string, span'))
            .find(el => el.textContent && (
              el.textContent.toLowerCase().includes('transcript') ||
              el.textContent.toLowerCase().includes('transcriptie') || // Dutch
              el.textContent.toLowerCase().includes('transkript') ||   // German
              el.textContent.toLowerCase().includes('transcription')   // French
            ));
          
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

  async function getFromDirectPageAccess() {
    console.log('🎯 Method 3: Direct page access...');
    
    try {
      // Inject script to access page globals directly
      const script = document.createElement('script');
      script.textContent = `
        window.__getYouTubePlayerData = function() {
          try {
            // Try multiple ways to get player data
            const player = document.querySelector('#movie_player');
            
            // Method 1: Direct player access
            if (player && player.getVideoData) {
              const videoData = player.getVideoData();
              if (window.ytInitialPlayerResponse) {
                return {
                  videoId: videoData.video_id,
                  captions: window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
                };
              }
            }
            
            // Method 2: Check ytplayer global
            if (window.ytplayer && window.ytplayer.config) {
              return {
                captions: window.ytplayer.config.args?.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks
              };
            }
            
            // Method 3: Search for yt object
            if (window.yt && window.yt.config_) {
              return {
                captions: window.yt.config_.EXPERIMENT_FLAGS?.web_player_caption_tracks
              };
            }
            
            return null;
          } catch (e) {
            return { error: e.message };
          }
        };
      `;
      
      document.head.appendChild(script);
      await sleep(100);
      
      // Call the injected function
      const result = window.__getYouTubePlayerData?.();
      console.log('📊 Direct page access result:', result);
      
      if (result && result.captions && result.captions.length > 0) {
        console.log('📝 Found captions via direct access:', result.captions.length);
        console.log('📋 Direct access tracks:', result.captions.map(c => ({
          vssId: c.vssId,
          languageCode: c.languageCode,
          name: c.name?.simpleText
        })));
        
        let track = result.captions.find(c => c.vssId && c.vssId.includes('.asr')) || 
                   result.captions.find(c => c.languageCode === 'nl') ||
                   result.captions[0];
        
        console.log('🎯 Selected direct access track:', track);
        return await fetchCaptionData(track.baseUrl);
      }
      
      // Clean up
      script.remove();
      delete window.__getYouTubePlayerData;
      
    } catch (error) {
      console.error('❌ Method 3 failed:', error);
    }
    
    return null;
  }

  async function getFromSubtitleElements() {
    console.log('🎯 Method 4: Checking subtitle elements...');
    
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