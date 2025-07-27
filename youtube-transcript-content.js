// YouTube Transcript Content Script
// This runs in the YouTube page context to access transcript data

(function() {
  'use strict';

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getYouTubeTranscript') {
      getTranscript().then(sendResponse);
      return true; // Keep message channel open for async response
    }
  });

  // Extract transcript from YouTube player
  async function getTranscript() {
    try {
      // Method 1: Try to get from YouTube's player API
      const player = document.querySelector('#movie_player');
      if (player && player.getVideoData) {
        const videoData = player.getVideoData();
        const videoId = videoData.video_id;
        
        // Try to access caption tracks
        const captionTracks = await getCaptionTracks();
        if (captionTracks && captionTracks.length > 0) {
          const transcript = await fetchCaptionTrack(captionTracks[0]);
          return { success: true, transcript, videoId };
        }
      }

      // Method 2: Try to extract from page data
      const transcriptData = await extractFromPageData();
      if (transcriptData) {
        return { success: true, transcript: transcriptData };
      }

      // Method 3: Try the transcript button
      const transcriptFromButton = await clickTranscriptButton();
      if (transcriptFromButton) {
        return { success: true, transcript: transcriptFromButton };
      }

      return { success: false, error: 'No transcript available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get available caption tracks
  async function getCaptionTracks() {
    try {
      // Look for caption data in page
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content.includes('captionTracks')) {
          const match = content.match(/"captionTracks":\s*(\[[^\]]*\])/);
          if (match) {
            return JSON.parse(match[1]);
          }
        }
      }
    } catch (error) {
      console.error('Error getting caption tracks:', error);
    }
    return null;
  }

  // Fetch caption track data
  async function fetchCaptionTrack(track) {
    try {
      const response = await fetch(track.baseUrl);
      const xml = await response.text();
      return parseTranscriptXml(xml);
    } catch (error) {
      console.error('Error fetching caption track:', error);
      return null;
    }
  }

  // Parse transcript XML
  function parseTranscriptXml(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const texts = doc.querySelectorAll('text');
    
    const transcript = [];
    texts.forEach(text => {
      const start = parseFloat(text.getAttribute('start'));
      const duration = parseFloat(text.getAttribute('dur')) || 0;
      const content = text.textContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
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
    
    return transcript;
  }

  // Extract transcript from page data
  async function extractFromPageData() {
    try {
      // Look for ytInitialPlayerResponse
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            const data = JSON.parse(match[1]);
            const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (captions && captions.length > 0) {
              // Prefer auto-generated captions
              const caption = captions.find(c => c.vssId && c.vssId.includes('.asr')) || captions[0];
              return await fetchCaptionTrack(caption);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error extracting from page data:', error);
    }
    return null;
  }

  // Click transcript button and extract
  async function clickTranscriptButton() {
    try {
      // Find and click the "Show transcript" button
      const moreButton = document.querySelector('button[aria-label*="More actions"]');
      if (moreButton) {
        moreButton.click();
        await sleep(500);
        
        const transcriptButton = Array.from(document.querySelectorAll('yt-formatted-string'))
          .find(el => el.textContent.includes('Show transcript'));
        
        if (transcriptButton) {
          transcriptButton.click();
          await sleep(1000);
          
          // Extract transcript from panel
          const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
          const transcript = [];
          
          transcriptSegments.forEach(segment => {
            const timeEl = segment.querySelector('.segment-timestamp');
            const textEl = segment.querySelector('.segment-text');
            
            if (timeEl && textEl) {
              const time = parseTimestamp(timeEl.textContent);
              transcript.push({
                start: time,
                end: time + 5, // Approximate
                text: textEl.textContent.trim()
              });
            }
          });
          
          // Close the panel
          const closeButton = document.querySelector('button[aria-label*="Close transcript"]');
          if (closeButton) closeButton.click();
          
          return transcript;
        }
      }
    } catch (error) {
      console.error('Error clicking transcript button:', error);
    }
    return null;
  }

  // Parse timestamp like "1:23" to seconds
  function parseTimestamp(timestamp) {
    const parts = timestamp.trim().split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }

  // Sleep helper
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Also inject a function into the page context to access player
  const script = document.createElement('script');
  script.textContent = `
    window.getYouTubePlayerData = function() {
      const player = document.querySelector('#movie_player');
      if (player && player.getVideoData) {
        return {
          videoData: player.getVideoData(),
          captionTracks: player.getOption ? player.getOption('captions', 'tracklist') : null
        };
      }
      return null;
    };
  `;
  document.head.appendChild(script);
})();