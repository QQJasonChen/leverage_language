// Fixed YouTube Transcript Content Script
// Uses alternative methods to get transcript data

(function() {
  'use strict';

  console.log('🎬 FIXED YouTube transcript content script loaded');

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎬 FIXED transcript content script received message:', request);
    
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
      console.log('🚀 FIXED Processing transcript request...');
      getFixedTranscript().then(response => {
        console.log('📤 FIXED Sending transcript response:', response);
        sendResponse(response);
      }).catch(error => {
        console.error('❌ FIXED Error in getTranscript:', error);
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

  async function getFixedTranscript() {
    console.log('🔍 FIXED Starting transcript extraction...');
    
    try {
      const videoId = extractVideoId();
      if (!videoId) {
        throw new Error('Could not extract video ID');
      }
      
      console.log('📹 FIXED Video ID:', videoId);

      // Method 1: Use transcript panel (most reliable)
      let transcript = await useTranscriptPanel();
      if (transcript && transcript.length > 0) {
        console.log('✅ FIXED Transcript via panel:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'transcriptPanel' };
      }

      // Method 2: Use modified URL approach
      transcript = await useModifiedUrl(videoId);
      if (transcript && transcript.length > 0) {
        console.log('✅ FIXED Transcript via modified URL:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'modifiedUrl' };
      }

      // Method 3: Extract from currently displayed captions
      transcript = await extractFromDisplayedCaptions();
      if (transcript && transcript.length > 0) {
        console.log('✅ FIXED Transcript via displayed captions:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'displayedCaptions' };
      }

      throw new Error('No accessible captions found. Try enabling captions manually first.');
      
    } catch (error) {
      console.error('❌ FIXED transcript extraction failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function useTranscriptPanel() {
    console.log('🔍 FIXED Method 1: Using transcript panel...');
    
    try {
      // First, try to find and click the "Show transcript" option
      let transcriptOpened = false;
      
      // Look for existing transcript panel
      let transcriptPanel = document.querySelector('ytd-transcript-renderer, [aria-label*="transcript" i]');
      
      if (!transcriptPanel) {
        // Try multiple ways to open transcript
        const transcriptSelectors = [
          // YouTube's standard more menu
          'button[aria-label*="More" i]',
          'button[aria-label*="Show more" i]',
          '#expand',
          // Three dots menu
          'button[aria-label*="actions" i]',
          '.ytp-more-button',
          // Direct transcript button (sometimes visible)
          'button[aria-label*="transcript" i]',
          // Description area expand
          '#description-content button',
          '#expand-description-button'
        ];
        
        let moreButton = null;
        for (const selector of transcriptSelectors) {
          moreButton = document.querySelector(selector);
          if (moreButton) {
            console.log('🔘 FIXED Found button with selector:', selector);
            break;
          }
        }
        
        if (moreButton) {
          console.log('🔘 FIXED Clicking more/expand button...');
          moreButton.click();
          await sleep(800);
          
          // Look for transcript option with multiple strategies
          const transcriptSearches = [
            // Text-based search
            () => Array.from(document.querySelectorAll('*')).find(el => {
              const text = el.textContent?.toLowerCase() || '';
              return text.includes('show transcript') || 
                     text.includes('transcript') || 
                     text.includes('transcriptie') ||
                     text.includes('字幕');
            }),
            // Menu item search
            () => document.querySelector('[role="menuitem"] *'),
            // Button search
            () => Array.from(document.querySelectorAll('button, [role="button"]')).find(el => {
              const text = el.textContent?.toLowerCase() || '';
              return text.includes('transcript');
            })
          ];
          
          let transcriptButton = null;
          for (const searchFn of transcriptSearches) {
            transcriptButton = searchFn();
            if (transcriptButton && transcriptButton.tagName !== 'SCRIPT') {
              console.log('📝 FIXED Found transcript button via search strategy');
              break;
            }
          }
          
          if (transcriptButton) {
            console.log('📝 FIXED Clicking transcript button...');
            transcriptButton.click();
            await sleep(1500);
            transcriptOpened = true;
          } else {
            console.log('❌ FIXED No transcript button found in menu');
          }
        } else {
          console.log('❌ FIXED No more/expand button found');
        }
      } else {
        transcriptOpened = true;
      }
      
      if (transcriptOpened || transcriptPanel) {
        // Look for transcript segments
        const selectors = [
          'ytd-transcript-segment-renderer',
          '[role="button"][tabindex="0"]', // Common for transcript segments
          '.ytd-transcript-segment-renderer',
          '.segment-timestamp'
        ];
        
        let segments = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`📝 FIXED Found ${elements.length} elements with selector: ${selector}`);
            segments = Array.from(elements);
            break;
          }
        }
        
        if (segments.length > 0) {
          return extractFromTranscriptSegments(segments);
        }
      }
      
      console.log('❌ FIXED Could not open or find transcript panel');
      return null;
      
    } catch (error) {
      console.error('❌ FIXED Transcript panel method failed:', error);
      return null;
    }
  }

  function extractFromTranscriptSegments(segments) {
    console.log('🔍 FIXED Extracting from', segments.length, 'transcript segments');
    
    const transcript = [];
    
    segments.forEach((segment, index) => {
      try {
        // Try different ways to extract time and text
        let timeText = '';
        let captionText = '';
        
        // Method 1: Look for timestamp in segment
        const timeElement = segment.querySelector('.segment-timestamp, [class*="timestamp"]');
        if (timeElement) {
          timeText = timeElement.textContent?.trim() || '';
        }
        
        // Method 2: Look for text in segment
        const textElement = segment.querySelector('.segment-text, [class*="text"]');
        if (textElement) {
          captionText = textElement.textContent?.trim() || '';
        }
        
        // Method 3: If no specific elements, use the segment's own text
        if (!timeText || !captionText) {
          const fullText = segment.textContent?.trim() || '';
          const timeMatch = fullText.match(/(\d{1,2}):(\d{2})/);
          
          if (timeMatch) {
            timeText = timeMatch[0];
            captionText = fullText.replace(timeMatch[0], '').trim();
          }
        }
        
        if (timeText && captionText) {
          const startTime = parseTimestamp(timeText);
          if (!isNaN(startTime)) {
            transcript.push({
              start: startTime,
              end: startTime + 3, // Approximate duration
              duration: 3,
              text: captionText
            });
            
            // Log first few for debugging
            if (index < 3) {
              console.log(`📝 FIXED Segment ${index}:`, {
                time: timeText,
                start: startTime,
                text: captionText.substring(0, 50) + '...'
              });
            }
          }
        }
      } catch (e) {
        console.log(`❌ FIXED Error processing segment ${index}:`, e);
      }
    });
    
    console.log(`✅ FIXED Extracted ${transcript.length} valid segments`);
    return transcript;
  }

  async function useModifiedUrl(videoId) {
    console.log('🔍 FIXED Method 2: Trying modified URL approach...');
    
    try {
      // Find caption tracks from page data
      const tracks = await findCaptionTracks();
      if (!tracks || tracks.length === 0) {
        console.log('❌ FIXED No tracks found for modified URL approach');
        return null;
      }
      
      console.log('📝 FIXED Found', tracks.length, 'tracks for URL modification');
      
      // Select best track
      const track = selectBestTrack(tracks);
      if (!track || !track.baseUrl) {
        console.log('❌ FIXED No suitable track with baseUrl');
        return null;
      }
      
      // Modify the URL to try different parameters
      const modifiedUrls = [
        track.baseUrl,
        track.baseUrl + '&fmt=json3',
        track.baseUrl + '&fmt=srv3',
        track.baseUrl.replace('&caps=asr', ''),
        track.baseUrl.replace(/&opi=[^&]*/, ''),
        track.baseUrl.replace(/&ei=[^&]*/, '')
      ];
      
      for (const url of modifiedUrls) {
        console.log('🌐 FIXED Trying URL:', url.substring(0, 100) + '...');
        
        try {
          const response = await fetch(url, {
            credentials: 'same-origin',
            headers: {
              'Accept': 'text/plain, application/xml, text/xml'
            }
          });
          
          if (response.ok) {
            const text = await response.text();
            if (text && text.trim().length > 0) {
              console.log('✅ FIXED Got non-empty response:', text.length, 'characters');
              
              // Try to parse as XML
              const transcript = parseTranscriptXml(text);
              if (transcript && transcript.length > 0) {
                return transcript;
              }
              
              // Try to parse as JSON
              try {
                const jsonData = JSON.parse(text);
                const transcript = parseJsonTranscript(jsonData);
                if (transcript && transcript.length > 0) {
                  return transcript;
                }
              } catch (e) {
                // Not JSON, continue
              }
            }
          }
        } catch (e) {
          console.log('❌ FIXED URL failed:', e.message);
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ FIXED Modified URL method failed:', error);
      return null;
    }
  }

  async function findCaptionTracks() {
    // Check global variables first
    if (window.ytInitialPlayerResponse) {
      const captions = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captions && captions.length > 0) {
        return captions;
      }
    }
    
    // Search in scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      if (content && content.includes('captionTracks')) {
        const match = content.match(/"captionTracks":\s*(\[[^\]]*\])/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            // Continue searching
          }
        }
      }
    }
    
    return null;
  }

  function selectBestTrack(tracks) {
    // Priority: auto-generated > original language > English > first available
    return tracks.find(t => t.vssId && t.vssId.includes('.asr')) ||
           tracks.find(t => t.languageCode === 'nl') ||
           tracks.find(t => t.languageCode === 'en') ||
           tracks[0];
  }

  async function extractFromDisplayedCaptions() {
    console.log('🔍 FIXED Method 3: Extract from displayed captions...');
    
    try {
      // Enable captions if not already enabled
      const ccButton = document.querySelector('.ytp-subtitles-button');
      if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
        console.log('🔘 FIXED Enabling captions...');
        ccButton.click();
        await sleep(2000);
      }
      
      // Try to get current video position and some context
      const player = document.querySelector('#movie_player');
      let currentTime = 0;
      if (player && player.getCurrentTime) {
        currentTime = player.getCurrentTime();
      }
      
      // Check if captions are visible
      const captionElements = document.querySelectorAll('.ytp-caption-segment, .captions-text, .caption-visual-line');
      if (captionElements.length > 0) {
        console.log('👁️ FIXED Found', captionElements.length, 'visible caption elements');
        
        // Extract current caption text
        const currentCaptions = Array.from(captionElements).map(el => el.textContent?.trim()).filter(text => text);
        
        if (currentCaptions.length > 0) {
          console.log('📝 FIXED Current caption text:', currentCaptions);
          
          // Create a basic transcript entry from current captions
          const transcript = currentCaptions.map((text, index) => ({
            start: currentTime + (index * 3),
            end: currentTime + ((index + 1) * 3),
            duration: 3,
            text: text
          }));
          
          // Add a helpful message about limitations
          transcript.push({
            start: currentTime + (currentCaptions.length * 3),
            end: currentTime + ((currentCaptions.length + 1) * 3),
            duration: 3,
            text: 'Note: This is a sample from currently visible captions. For full transcript, YouTube\'s transcript panel method is needed.'
          });
          
          return transcript;
        }
      }
      
      // If no captions visible, return a helpful message
      console.log('❌ FIXED No visible captions found');
      return [{
        start: 0,
        end: 5,
        duration: 5,
        text: 'No captions currently visible. Try opening the transcript panel manually (click "..." button below video, then "Show transcript") or ensure captions are enabled.'
      }];
      
    } catch (error) {
      console.error('❌ FIXED Displayed captions method failed:', error);
      return null;
    }
  }

  function parseTranscriptXml(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        return null;
      }
      
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
      
      return transcript;
    } catch (error) {
      console.error('❌ FIXED XML parsing failed:', error);
      return null;
    }
  }

  function parseJsonTranscript(jsonData) {
    // Handle different JSON formats that YouTube might return
    try {
      if (jsonData.events) {
        // Format 1: events array
        const transcript = [];
        jsonData.events.forEach(event => {
          if (event.segs) {
            event.segs.forEach(seg => {
              if (seg.utf8) {
                transcript.push({
                  start: (event.tStartMs || 0) / 1000,
                  end: ((event.tStartMs || 0) + (event.dDurationMs || 3000)) / 1000,
                  duration: (event.dDurationMs || 3000) / 1000,
                  text: seg.utf8
                });
              }
            });
          }
        });
        return transcript;
      }
      
      return null;
    } catch (error) {
      console.error('❌ FIXED JSON parsing failed:', error);
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