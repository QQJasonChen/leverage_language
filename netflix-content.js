// Netflix Content Script - Language Learning Extension
// Handles Netflix video interaction and learning functionality

(function() {
  'use strict';

  console.log('🎬 Netflix Language Learning extension loaded');

  let contextInvalidated = false;
  let lastKnownVideoId = null;
  let lastKnownTitle = null;
  let currentVideoInfo = null;
  
  // Collection state variables (similar to Udemy)
  let isCollecting = false;
  let collectedSegments = [];
  let collectionStartTime = null;
  let lastSubtitleText = '';
  let lastSubtitleTime = 0;
  let collectionMonitorInterval = null;

  // Netflix video ID patterns and extraction
  function extractNetflixVideoId() {
    // Netflix uses different URL patterns:
    // https://www.netflix.com/watch/81234567
    // https://www.netflix.com/title/81234567
    const match = window.location.href.match(/(?:watch|title)\/(\d+)/);
    return match ? match[1] : null;
  }

  function extractVideoTitle() {
    // Try multiple selectors for Netflix title
    const titleSelectors = [
      'h1[data-uia="video-title"]',
      '[data-uia="title-text"]',
      '.video-title h1',
      '.previewModal-info h1',
      '.PlayerControlsNeo__layout .PlayerControlsNeo__button-control-row h4',
      '[data-uia="player-title"]',
      '.watch-video h1',
      'h1',
      '.episode-title'
    ];

    console.log('🔍 Netflix title extraction - trying selectors...');
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        const title = element.textContent.trim();
        console.log(`✅ Found Netflix title with selector "${selector}": "${title}"`);
        return title;
      }
    }

    // Fallback to document title
    const title = document.title;
    console.log(`🔄 Checking document title: "${title}"`);
    if (title && title !== 'Netflix') {
      const cleanTitle = title.replace(' - Netflix', '').trim();
      console.log(`🔄 Using document title as fallback: "${cleanTitle}"`);
      return cleanTitle;
    }

    console.log('❌ No Netflix title found, using default fallback');
    return 'Netflix Video';
  }

  function getCurrentTimestamp() {
    try {
      // Netflix video player selector attempts
      const playerSelectors = [
        'video',
        '[data-uia="video-canvas"] video',
        '.VideoContainer video',
        '.watch-video video'
      ];

      console.log('🔍 Netflix timestamp extraction - trying selectors...');
      
      for (const selector of playerSelectors) {
        const video = document.querySelector(selector);
        if (video && video.currentTime !== undefined) {
          const timestamp = Math.floor(video.currentTime);
          console.log(`✅ Found Netflix video with selector "${selector}", timestamp: ${timestamp}s`);
          return timestamp;
        }
      }

      console.log('❌ No Netflix video element found, returning 0');
      return 0;
    } catch (error) {
      console.log('⚠️ Could not get Netflix timestamp:', error);
      return 0;
    }
  }

  function createTimestampedUrl(timestamp = null) {
    const videoId = extractNetflixVideoId();
    if (!videoId) return window.location.href;

    const currentTimestamp = timestamp || getCurrentTimestamp();
    const baseUrl = `https://www.netflix.com/watch/${videoId}`;
    
    // Netflix doesn't use URL fragments for timestamps like YouTube
    // We'll store the timestamp for internal use
    return `${baseUrl}#t=${currentTimestamp}s`;
  }

  function extractDetailedVideoInfo() {
    const videoId = extractNetflixVideoId();
    const title = extractVideoTitle();
    const timestamp = getCurrentTimestamp();
    
    // Extract additional metadata
    const metadata = {
      videoId,
      title,
      timestamp,
      url: createTimestampedUrl(timestamp),
      platform: 'netflix',
      contentType: detectContentType(),
      episodeInfo: extractEpisodeInfo(),
      duration: getVideoDuration(),
      playbackState: getPlaybackState(),
      availableLanguages: getAvailableAudioLanguages(),
      subtitleLanguages: getAvailableSubtitleLanguages(),
      quality: getVideoQuality(),
      genre: extractGenre(),
      year: extractYear(),
      maturityRating: extractMaturityRating(),
      cast: extractCastInfo(),
      description: extractDescription()
    };

    return metadata;
  }

  function detectContentType() {
    // Try to determine if it's a movie, series episode, documentary, etc.
    const url = window.location.href;
    
    // Check for episode indicators
    const episodeSelectors = [
      '[data-uia="episode-title"]',
      '.episode-title',
      '[data-uia="season-episode"]',
      '.watch-video [data-uia*="episode"]'
    ];
    
    for (const selector of episodeSelectors) {
      if (document.querySelector(selector)) {
        return 'episode';
      }
    }

    // Check for documentary indicators
    if (document.querySelector('[data-uia*="documentary"]') || 
        document.title.toLowerCase().includes('documentary')) {
      return 'documentary';
    }

    // Check for limited series
    if (document.querySelector('[data-uia*="limited"]') || 
        document.title.toLowerCase().includes('limited series')) {
      return 'limited-series';
    }

    // Default to movie
    return 'movie';
  }

  function extractTitle() {
    // Extract content title from Netflix page with enhanced selectors
    const titleSelectors = [
      '[data-uia="video-title"]',
      '.video-title h1',
      '.video-title',
      '.previewModal--player .previewModal--detailsMetadata h3',
      '.title-logo img[alt]',
      'h1.title',
      '.watchVideo .title',
      '[data-uia*="title"]',
      // Additional Netflix-specific selectors for title extraction
      '.watch-video--player-view .video-title',
      '.watch-video--back-to-browsing .video-title', 
      '.ltr-1bt0omd', // Netflix's current title class
      '.watch-video--bottom-controls-container [data-uia*="title"]',
      '.evidence-overlay .evidence-overlay-text .evidence-overlay-title',
      // Series-specific selectors
      '[data-uia="series-title"]',
      '.series-title',
      // Episode title selectors  
      '[data-uia="episode-title"]',
      '.episode-title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        let title;
        if (element.tagName === 'IMG' && element.alt) {
          title = element.alt;
        } else {
          title = element.textContent?.trim();
        }
        
        if (title && title.length > 2 && !title.includes('Netflix') && !title.includes('Watch')) {
          // Get episode info for better title formatting
          const episodeInfo = extractEpisodeInfo();
          if (episodeInfo && episodeInfo.episodeTitle) {
            return `${title} - ${episodeInfo.episodeTitle}`;
          }
          return title;
        }
      }
    }

    // Fallback to document title with better parsing
    let title = document.title;
    if (title && title !== 'Netflix') {
      // Clean up Netflix suffixes and extract meaningful title
      title = title.replace(/\s*-\s*Netflix$/, '').trim();
      
      // If title contains "Watch", extract the show name
      const watchMatch = title.match(/Watch\s+(.+)$/);
      if (watchMatch) {
        title = watchMatch[1].trim();
      }
      
      if (title && title.length > 2) {
        return title;
      }
    }

    // Final fallback - try to get from URL
    const urlMatch = window.location.href.match(/\/title\/(\d+)/);
    if (urlMatch) {
      return `Netflix Content (ID: ${urlMatch[1]})`;
    }

    return 'Netflix Content';
  }

  function extractEpisodeInfo() {
    try {
      const episodeInfo = {};
      
      // Try to extract season and episode numbers
      const seasonEpisodeSelectors = [
        '[data-uia="season-episode"]',
        '.episode-metadata',
        '.watch-video .episode-title',
        '[data-uia*="episode-selector"]'
      ];

      for (const selector of seasonEpisodeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent;
          
          // Parse "S1:E5" format
          const seasonEpisodeMatch = text.match(/S(\d+):E(\d+)/i);
          if (seasonEpisodeMatch) {
            episodeInfo.season = parseInt(seasonEpisodeMatch[1]);
            episodeInfo.episode = parseInt(seasonEpisodeMatch[2]);
            break;
          }
          
          // Parse "Season 1 Episode 5" format
          const seasonMatch = text.match(/Season\s+(\d+)/i);
          const episodeMatch = text.match(/Episode\s+(\d+)/i);
          if (seasonMatch) episodeInfo.season = parseInt(seasonMatch[1]);
          if (episodeMatch) episodeInfo.episode = parseInt(episodeMatch[1]);
        }
      }

      // Try to get episode title
      const episodeTitleElement = document.querySelector('[data-uia="episode-title"], .episode-title h3, .episode-title span');
      if (episodeTitleElement) {
        episodeInfo.episodeTitle = episodeTitleElement.textContent.trim();
      }

      return Object.keys(episodeInfo).length > 0 ? episodeInfo : null;
    } catch (error) {
      console.log('⚠️ Error extracting episode info:', error);
      return null;
    }
  }

  function getVideoDuration() {
    try {
      const video = document.querySelector('video');
      if (video && video.duration && !isNaN(video.duration)) {
        return Math.floor(video.duration);
      }
      
      // Try to get duration from UI elements
      const durationSelectors = [
        '[data-uia="video-duration"]',
        '.duration-text',
        '.time-remaining'
      ];
      
      for (const selector of durationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const durationText = element.textContent;
          const durationMatch = durationText.match(/(\d+):(\d+)/);
          if (durationMatch) {
            return parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
          }
        }
      }
      
      return 0;
    } catch (error) {
      console.log('⚠️ Error getting duration:', error);
      return 0;
    }
  }

  function getPlaybackState() {
    try {
      const video = document.querySelector('video');
      if (video) {
        return {
          paused: video.paused,
          currentTime: video.currentTime,
          volume: video.volume,
          playbackRate: video.playbackRate,
          buffered: video.buffered.length > 0 ? video.buffered.end(0) : 0
        };
      }
      return null;
    } catch (error) {
      console.log('⚠️ Error getting playback state:', error);
      return null;
    }
  }

  function getAvailableAudioLanguages() {
    try {
      const languages = [];
      const audioSelectors = [
        '[data-uia="audio-track-selector"] option',
        '.audio-subtitle-controller .audio-tracks option',
        '[data-uia*="audio"] [data-uia*="language"]'
      ];

      for (const selector of audioSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const lang = element.textContent.trim();
          if (lang && !languages.includes(lang)) {
            languages.push(lang);
          }
        });
      }

      return languages;
    } catch (error) {
      console.log('⚠️ Error getting audio languages:', error);
      return [];
    }
  }

  function getAvailableSubtitleLanguages() {
    try {
      const languages = [];
      const subtitleSelectors = [
        '[data-uia="subtitle-track-selector"] option',
        '.audio-subtitle-controller .subtitle-tracks option',
        '[data-uia*="subtitle"] [data-uia*="language"]'
      ];

      for (const selector of subtitleSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const lang = element.textContent.trim();
          if (lang && !languages.includes(lang)) {
            languages.push(lang);
          }
        });
      }

      return languages;
    } catch (error) {
      console.log('⚠️ Error getting subtitle languages:', error);
      return [];
    }
  }

  function getVideoQuality() {
    try {
      const video = document.querySelector('video');
      if (video) {
        return {
          width: video.videoWidth,
          height: video.videoHeight,
          quality: video.videoHeight >= 2160 ? '4K' : 
                   video.videoHeight >= 1080 ? 'HD' : 
                   video.videoHeight >= 720 ? 'HD' : 'SD'
        };
      }
      return null;
    } catch (error) {
      console.log('⚠️ Error getting video quality:', error);
      return null;
    }
  }

  function extractGenre() {
    try {
      const genreSelectors = [
        '[data-uia="genre"]',
        '.video-metadata .genre',
        '.title-info-metadata .genre',
        '[data-uia*="genre"]'
      ];

      for (const selector of genreSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting genre:', error);
      return null;
    }
  }

  function extractYear() {
    try {
      const yearSelectors = [
        '[data-uia="video-year"]',
        '.video-metadata .year',
        '.title-info-metadata .year'
      ];

      for (const selector of yearSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const yearMatch = element.textContent.match(/(\d{4})/);
          if (yearMatch) {
            return parseInt(yearMatch[1]);
          }
        }
      }
      
      // Try extracting from title
      const title = document.title;
      const titleYearMatch = title.match(/\((\d{4})\)/);
      if (titleYearMatch) {
        return parseInt(titleYearMatch[1]);
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting year:', error);
      return null;
    }
  }

  function extractMaturityRating() {
    try {
      const ratingSelectors = [
        '[data-uia="maturity-rating"]',
        '.video-metadata .maturity-rating',
        '.title-info-metadata .rating',
        '[data-uia*="rating"]'
      ];

      for (const selector of ratingSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting maturity rating:', error);
      return null;
    }
  }

  function extractCastInfo() {
    try {
      const cast = [];
      const castSelectors = [
        '[data-uia="cast-info"] span',
        '.video-metadata .cast',
        '.title-info-metadata .cast'
      ];

      for (const selector of castSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const castMember = element.textContent.trim();
          if (castMember && !cast.includes(castMember)) {
            cast.push(castMember);
          }
        });
      }

      return cast.length > 0 ? cast : null;
    } catch (error) {
      console.log('⚠️ Error extracting cast info:', error);
      return null;
    }
  }

  function extractDescription() {
    try {
      const descriptionSelectors = [
        '[data-uia="video-synopsis"]',
        '.video-metadata .synopsis',
        '.title-info-metadata .description',
        '[data-uia*="synopsis"]'
      ];

      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting description:', error);
      return null;
    }
  }

  function getVideoInfo() {
    const videoId = extractNetflixVideoId();
    const title = extractVideoTitle();
    const timestamp = getCurrentTimestamp();

    if (videoId) {
      return {
        videoId,
        title,
        timestamp,
        url: createTimestampedUrl(timestamp),
        platform: 'netflix'
      };
    }
    return null;
  }

  // Get comprehensive video information
  function getComprehensiveVideoInfo() {
    const videoId = extractNetflixVideoId();
    if (videoId) {
      return extractDetailedVideoInfo();
    }
    return null;
  }

  // Enhanced language detection for Netflix content
  function detectLanguage() {
    try {
      // Check for language indicators in Netflix UI
      const langSelectors = [
        '[data-uia="audio-track-selector"] [aria-selected="true"]',
        '[data-uia="subtitle-track-selector"] [aria-selected="true"]',
        '.audio-subtitle-controller .language-selected',
        '[data-uia*="language"] [aria-selected="true"]',
        '.selected-language',
        '.active-track'
      ];

      for (const selector of langSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.toLowerCase();
          const lang = mapLanguageText(text);
          if (lang) return lang;
        }
      }

      // Try to get language from track attributes
      const activeTrack = document.querySelector('[data-uia*="track"][aria-selected="true"]');
      if (activeTrack) {
        const langAttr = activeTrack.getAttribute('data-language') || 
                        activeTrack.getAttribute('lang') ||
                        activeTrack.getAttribute('data-lang');
        if (langAttr) {
          return mapLanguageCode(langAttr);
        }
      }

      // Check video element track attributes
      const video = document.querySelector('video');
      if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          if (track.mode === 'showing' && track.language) {
            return mapLanguageCode(track.language);
          }
        }
      }

      // Fallback to browser language
      return navigator.language.split('-')[0] || 'en';
    } catch (error) {
      console.log('⚠️ Language detection failed:', error);
      return 'en';
    }
  }

  // Map language text to language codes
  function mapLanguageText(text) {
    const languageMap = {
      // English variants
      'english': 'en', 'inglés': 'en', 'anglais': 'en', 'englisch': 'en',
      
      // Spanish variants  
      'spanish': 'es', 'español': 'es', 'espagnol': 'es', 'spanisch': 'es',
      'castilian': 'es', 'castellano': 'es',
      
      // French variants
      'french': 'fr', 'français': 'fr', 'francés': 'fr', 'französisch': 'fr',
      
      // German variants
      'german': 'de', 'deutsch': 'de', 'allemand': 'de', 'alemán': 'de',
      
      // Japanese variants
      'japanese': 'ja', 'japonés': 'ja', 'japonais': 'ja', 'japanisch': 'ja',
      '日本語': 'ja', 'にほんご': 'ja',
      
      // Korean variants
      'korean': 'ko', 'coreano': 'ko', 'coréen': 'ko', 'koreanisch': 'ko',
      '한국어': 'ko', '한글': 'ko',
      
      // Chinese variants
      'chinese': 'zh', 'chino': 'zh', 'chinois': 'zh', 'chinesisch': 'zh',
      'mandarin': 'zh', 'cantonese': 'zh',
      '中文': 'zh', '中国话': 'zh', '普通话': 'zh', '广东话': 'zh',
      
      // Portuguese variants
      'portuguese': 'pt', 'português': 'pt', 'portugués': 'pt', 'portugiesisch': 'pt',
      'brazilian': 'pt', 'brasileiro': 'pt',
      
      // Italian variants
      'italian': 'it', 'italiano': 'it', 'italien': 'it', 'italienisch': 'it',
      
      // Dutch variants
      'dutch': 'nl', 'holandés': 'nl', 'néerlandais': 'nl', 'niederländisch': 'nl',
      'nederlands': 'nl',
      
      // Russian variants
      'russian': 'ru', 'ruso': 'ru', 'russe': 'ru', 'russisch': 'ru',
      'русский': 'ru',
      
      // Arabic variants
      'arabic': 'ar', 'árabe': 'ar', 'arabe': 'ar', 'arabisch': 'ar',
      'العربية': 'ar',
      
      // Hindi variants
      'hindi': 'hi', 'हिन्दी': 'hi'
    };

    for (const [key, value] of Object.entries(languageMap)) {
      if (text.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  // Map language codes to standardized codes
  function mapLanguageCode(code) {
    const codeMap = {
      'en-US': 'en', 'en-GB': 'en', 'en-AU': 'en', 'en-CA': 'en',
      'es-ES': 'es', 'es-MX': 'es', 'es-AR': 'es', 'es-CL': 'es',
      'fr-FR': 'fr', 'fr-CA': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr',
      'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'zh-CN': 'zh', 'zh-TW': 'zh', 'zh-HK': 'zh',
      'pt-BR': 'pt', 'pt-PT': 'pt',
      'it-IT': 'it',
      'nl-NL': 'nl', 'nl-BE': 'nl',
      'ru-RU': 'ru',
      'ar-SA': 'ar', 'ar-EG': 'ar',
      'hi-IN': 'hi'
    };

    return codeMap[code] || code.split('-')[0] || 'en';
  }

  // Capture current Netflix subtitle text manually
  function captureCurrentNetflixSubtitle() {
    try {
      console.log('🔍 Starting Netflix subtitle capture...');
      
      // Netflix subtitle selectors (multiple attempts)
      const subtitleSelectors = [
        '.player-timedtext-text-container',
        '.ltr-11vo9g5', // Netflix subtitle container
        '[data-uia="player-subtitle-text"]',
        '.subtitle-text',
        '.PlayerSubtitles',
        '.player-timedtext',
        '.timedtext',
        '[class*="subtitle"]',
        '[class*="timedtext"]'
      ];

      console.log('🔍 Trying', subtitleSelectors.length, 'Netflix subtitle selectors...');
      
      for (const selector of subtitleSelectors) {
        const subtitleElement = document.querySelector(selector);
        console.log(`🔍 Selector "${selector}":`, subtitleElement ? 'Found element' : 'Not found');
        
        if (subtitleElement) {
          const text = subtitleElement.textContent?.trim();
          console.log(`📝 Text content: "${text || '(empty)'}"`);
          
          if (text) {
            console.log('✅ Netflix subtitle captured:', text);
            return text;
          }
        }
      }

      // Also try to find any visible text elements that might be subtitles
      console.log('🔍 Trying fallback method - scanning all text elements...');
      const allTextElements = document.querySelectorAll('div, span, p');
      console.log(`🔍 Found ${allTextElements.length} text elements to check`);
      
      let potentialSubtitles = [];
      
      for (const element of allTextElements) {
        if (element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim();
          // Check if element is positioned like a subtitle (bottom of screen)
          const rect = element.getBoundingClientRect();
          const isBottomPositioned = rect.bottom > window.innerHeight * 0.7;
          const isReasonableLength = text.length > 5 && text.length < 200;
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (isBottomPositioned && isReasonableLength && isVisible) {
            potentialSubtitles.push({text, element, rect});
            console.log('🎯 Potential subtitle found:', text.substring(0, 50) + '...');
          }
        }
      }
      
      console.log(`🔍 Found ${potentialSubtitles.length} potential subtitles`);
      
      if (potentialSubtitles.length > 0) {
        // Return the first potential subtitle
        const subtitle = potentialSubtitles[0];
        console.log('✅ Using fallback subtitle:', subtitle.text);
        return subtitle.text;
      }

      console.log('❌ No Netflix subtitle text found with any method');
      return null;
    } catch (error) {
      console.log('⚠️ Error capturing Netflix subtitle:', error);
      return null;
    }
  }

  // Check subtitle collection status by communicating with subtitle extractor
  async function checkSubtitleCollectionStatus() {
    try {
      // Try to get status from the subtitle extractor script
      return new Promise((resolve) => {
        // Send a message to the subtitle extractor to check status
        const event = new CustomEvent('netflixStatusCheck', {
          detail: { action: 'getCollectionStatus' }
        });
        
        const statusHandler = (event) => {
          if (event.detail && event.detail.action === 'collectionStatus') {
            window.removeEventListener('netflixStatusResponse', statusHandler);
            resolve(event.detail.isCollecting || false);
          }
        };
        
        window.addEventListener('netflixStatusResponse', statusHandler);
        window.dispatchEvent(event);
        
        // Timeout after 100ms
        setTimeout(() => {
          window.removeEventListener('netflixStatusResponse', statusHandler);
          resolve(false);
        }, 100);
      });
    } catch (error) {
      console.log('⚠️ Error checking collection status:', error);
      return false;
    }
  }

  // Collection monitoring functions
  function startSubtitleMonitoring() {
    if (collectionMonitorInterval) {
      clearInterval(collectionMonitorInterval);
    }
    
    console.log('🎭 Starting Netflix subtitle monitoring for collection...');
    
    collectionMonitorInterval = setInterval(() => {
      console.log('⏰ Collection monitor tick - isCollecting:', isCollecting);
      
      if (!isCollecting) {
        stopSubtitleMonitoring();
        return;
      }
      
      const subtitleText = captureCurrentNetflixSubtitle();
      console.log('📝 Monitor captured text:', subtitleText ? `"${subtitleText}"` : 'null');
      
      if (subtitleText && subtitleText.trim().length > 0) {
        // Throttle subtitle changes to prevent duplicates
        const now = Date.now();
        if (subtitleText !== lastSubtitleText || (now - lastSubtitleTime) > 1000) {
          lastSubtitleText = subtitleText;
          lastSubtitleTime = now;
          
          const currentTime = getCurrentTimestamp();
          const segment = {
            text: subtitleText,
            cleanText: subtitleText,
            start: currentTime,
            timestamp: formatTimestamp(currentTime),
            timestampDisplay: formatTimestamp(currentTime),
            timestampInSeconds: currentTime,
            source: 'netflix-collection',
            platform: 'netflix',
            videoInfo: getVideoInfo(),
            url: window.location.href,
            segmentIndex: collectedSegments.length,
            groupIndex: 0
          };
          
          // Check for duplicates
          const lastSegment = collectedSegments[collectedSegments.length - 1];
          const isDuplicate = lastSegment && lastSegment.text === subtitleText && 
            Math.abs(currentTime - lastSegment.timestampInSeconds) <= 2;
          
          if (!isDuplicate) {
            collectedSegments.push(segment);
            console.log(`🎭 ✅ Collected Netflix segment ${collectedSegments.length}: "${subtitleText}" at ${formatTimestamp(currentTime)}`);
          } else {
            console.log(`🎭 ⏭️ Skipping duplicate: "${subtitleText}"`);
          }
        }
      }
    }, 500); // Check every 500ms
  }
  
  function stopSubtitleMonitoring() {
    if (collectionMonitorInterval) {
      console.log('🎭 Stopping Netflix subtitle monitoring');
      clearInterval(collectionMonitorInterval);
      collectionMonitorInterval = null;
    }
  }
  
  // Helper function to format timestamp (MM:SS)
  function formatTimestamp(seconds) {
    // Handle invalid input
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      console.log('⚠️ Invalid timestamp value:', seconds, 'using 0 as fallback');
      seconds = 0;
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const result = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    console.log(`⏰ Formatted timestamp: ${seconds}s → ${result}`);
    return result;
  }

  // Message handling
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (contextInvalidated) {
      sendResponse({ error: 'Context invalidated' });
      return;
    }

    console.log('🎬 Netflix content script received message:', request);

    try {
      switch (request.action) {
        case 'ping':
          console.log('🏓 Netflix ping received');
          
          // Return the current collection state from our new collection system
          sendResponse({ 
            pong: true, 
            platform: 'netflix',
            isCollecting: isCollecting, // Use our new collection state variable
            videoId: extractNetflixVideoId(),
            title: extractVideoTitle(),
            timestamp: getCurrentTimestamp(),
            url: window.location.href
          });
          return true; // Keep the message channel open for async response
          break;

        case 'getTimestamp':
          const timestamp = getCurrentTimestamp();
          console.log('⏰ Netflix timestamp requested:', timestamp);
          sendResponse({ 
            success: true, 
            timestamp,
            url: createTimestampedUrl(timestamp)
          });
          break;

        case 'getVideoInfo':
          const videoInfo = getVideoInfo();
          const title = extractTitle();
          const episodeInfo = extractEpisodeInfo();
          console.log('📱 Netflix video info requested:', videoInfo, 'title:', title);
          sendResponse({
            success: !!videoInfo,
            videoInfo: {
              ...videoInfo,
              title: title,
              displayTitle: title,
              episodeInfo: episodeInfo
            }
          });
          break;

        case 'getNetflixTitle':
          console.log('🎭 Getting Netflix video title');
          const netflixTitle = extractTitle();
          const netflixEpisodeInfo = extractEpisodeInfo();
          sendResponse({
            success: true,
            title: netflixTitle,
            episodeInfo: netflixEpisodeInfo,
            url: window.location.href
          });
          break;

        case 'getComprehensiveVideoInfo':
          const comprehensiveInfo = getComprehensiveVideoInfo();
          console.log('📊 Netflix comprehensive video info requested:', comprehensiveInfo);
          sendResponse({
            success: !!comprehensiveInfo,
            videoInfo: comprehensiveInfo,
            metadata: comprehensiveInfo
          });
          break;

        case 'analyzeTextInSidepanel':
          const currentVideoInfo = getVideoInfo();
          if (currentVideoInfo) {
            console.log('📝 Sending Netflix text to sidepanel for analysis');
            
            chrome.runtime.sendMessage({
              action: 'analyzeTextInSidepanel',
              text: request.text,
              url: currentVideoInfo.url,
              title: currentVideoInfo.title,
              language: detectLanguage(),
              source: 'netflix-learning',
              platform: 'netflix',
              videoId: currentVideoInfo.videoId,
              timestamp: currentVideoInfo.timestamp
            }).then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              console.error('❌ Failed to send to sidepanel:', error);
              sendResponse({ success: false, error: error.message });
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'Could not extract Netflix video information' 
            });
          }
          break;

        case 'captureCurrentSubtitle':
          console.log('🎭 Manual Netflix subtitle capture requested');
          const capturedText = captureCurrentNetflixSubtitle();
          if (capturedText) {
            sendResponse({ 
              success: true, 
              text: capturedText,
              timestamp: getCurrentTimestamp(),
              videoInfo: getVideoInfo()
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'No subtitle text found. Make sure subtitles are enabled and visible.' 
            });
          }
          break;

        case 'getCurrentVideoTime':
          console.log('🎭 Getting current Netflix video time');
          const currentTime = getCurrentTimestamp();
          sendResponse({ 
            success: true, 
            currentTime: currentTime,
            timestamp: currentTime,
            url: window.location.href
          });
          break;

        case 'startNetflixSubtitleCollection':
          console.log('🎭 Starting Netflix subtitle collection...');
          console.log('🔍 Current collection state:', { isCollecting, collectedSegments: collectedSegments.length });
          
          if (!isCollecting) {
            isCollecting = true;
            // DON'T clear collectedSegments - preserve existing captures
            // collectedSegments = []; // ← REMOVED: This was causing override behavior
            if (collectedSegments.length === 0) {
              collectionStartTime = Date.now(); // Only set start time if no existing segments
            }
            startSubtitleMonitoring(); // Start the monitoring
            console.log('✅ Netflix collection started successfully');
            sendResponse({ success: true, isCollecting: true, existingSegments: collectedSegments.length });
          } else {
            console.log('⚠️ Already collecting - returning current state');
            sendResponse({ success: true, isCollecting: true, message: 'Already collecting', existingSegments: collectedSegments.length });
          }
          break;
          
        case 'stopNetflixSubtitleCollection':
          console.log('🎭 Stopping Netflix subtitle collection...');
          if (isCollecting) {
            isCollecting = false;
            stopSubtitleMonitoring(); // Stop the monitoring
            const segments = [...collectedSegments]; // Copy array
            console.log(`🎭 Collection stopped. Collected ${segments.length} segments`);
            
            sendResponse({ 
              success: true, 
              segments: segments,
              isCollecting: false,
              collectionTime: Date.now() - collectionStartTime
            });
            
            // Reset collection data
            collectedSegments = [];
            collectionStartTime = null;
          } else {
            sendResponse({ success: true, isCollecting: false, segments: [] });
          }
          break;

        default:
          console.log('❓ Unknown action for Netflix:', request.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Netflix content script error:', error);
      sendResponse({ error: error.message });
    }

    return true; // Keep message channel open for async responses
  });

  // Context invalidation handling
  chrome.runtime.onConnect.addListener(() => {
    // Connection established - reset invalidation flag
    contextInvalidated = false;
  });

  // Handle context invalidation
  function handleContextInvalidation() {
    contextInvalidated = true;
    console.log('⚠️ Netflix extension context invalidated');
  }

  chrome.runtime.id && chrome.runtime.onMessage.addListener(() => {
    // Test if context is still valid
  });

  // Monitor for video changes
  let currentUrl = window.location.href;
  
  function handleUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('🔄 Netflix URL changed:', currentUrl);
      
      // Update video info
      const newVideoInfo = getVideoInfo();
      const comprehensiveInfo = getComprehensiveVideoInfo();
      
      if (newVideoInfo && newVideoInfo.videoId !== lastKnownVideoId) {
        lastKnownVideoId = newVideoInfo.videoId;
        lastKnownTitle = newVideoInfo.title;
        currentVideoInfo = comprehensiveInfo || newVideoInfo;
        
        console.log('🎬 Netflix video changed:', newVideoInfo);
        console.log('📊 Netflix comprehensive info:', comprehensiveInfo);
        
        // Notify background script of video change with comprehensive info
        chrome.runtime.sendMessage({
          action: 'netflixVideoChanged',
          videoInfo: newVideoInfo,
          comprehensiveInfo: comprehensiveInfo
        }).catch(handleContextInvalidation);
      }
    }
  }

  // Monitor URL changes (Netflix is SPA)
  setInterval(handleUrlChange, 1000);

  // Monitor for Netflix-specific events
  function setupNetflixEventListeners() {
    // Listen for video player events
    document.addEventListener('click', (event) => {
      // Handle clicks on subtitle/language controls
      const target = event.target;
      if (target.closest('[data-uia*="subtitle"]') || 
          target.closest('[data-uia*="audio"]') ||
          target.closest('.audio-subtitle-controller')) {
        
        setTimeout(() => {
          const newLang = detectLanguage();
          console.log('🌐 Netflix language may have changed:', newLang);
        }, 500);
      }
    });

    // Monitor for player state changes
    const observer = new MutationObserver((mutations) => {
      // Check for video element changes
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          const hasVideo = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === 1 && 
            (node.tagName === 'VIDEO' || node.querySelector('video'))
          );
          
          if (hasVideo) {
            console.log('🎥 Netflix video element detected');
            handleUrlChange(); // Update video info
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('👂 Netflix event listeners set up');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNetflixEventListeners);
  } else {
    setupNetflixEventListeners();
  }

  // Initialize video info
  setTimeout(() => {
    const initialInfo = getVideoInfo();
    const comprehensiveInfo = getComprehensiveVideoInfo();
    
    if (initialInfo) {
      lastKnownVideoId = initialInfo.videoId;
      lastKnownTitle = initialInfo.title;
      currentVideoInfo = comprehensiveInfo || initialInfo;
      console.log('🎬 Initial Netflix video info:', initialInfo);
      console.log('📊 Initial Netflix comprehensive info:', comprehensiveInfo);
      
      // Notify background script of initial video info
      chrome.runtime.sendMessage({
        action: 'netflixVideoInitialized',
        videoInfo: initialInfo,
        comprehensiveInfo: comprehensiveInfo
      }).catch(handleContextInvalidation);
    }
  }, 1000);

  console.log('✅ Netflix content script initialized');

  // ========== DIRECT VIDEO CAPTURE OVERLAY ==========
  
  let floatingOverlay = null;
  let lastDisplayedSubtitle = '';
  let subtitleCheckInterval = null;
  let overlayVisible = false;
  
  // Create floating capture overlay
  function createFloatingCaptureOverlay() {
    if (floatingOverlay) return;
    
    floatingOverlay = document.createElement('div');
    floatingOverlay.id = 'netflix-learning-overlay';
    floatingOverlay.innerHTML = `
      <div class="overlay-content">
        <div class="subtitle-display">
          <div class="subtitle-text" id="overlay-subtitle-text">Waiting for subtitles...</div>
        </div>
        <div class="capture-controls">
          <button class="capture-btn" id="overlay-capture-btn" title="Capture this subtitle (Cmd+Opt+Ctrl+C)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 21h8"/>
              <path d="M12 17v4"/>
              <path d="M5.5 17h13a2 2 0 0 0 1.8-2.9L14.6 3.1a2 2 0 0 0-3.2 0L5.7 14.1A2 2 0 0 0 7.5 17z"/>
            </svg>
            Capture
          </button>
          <button class="toggle-overlay-btn" id="overlay-toggle-btn" title="Hide overlay (Cmd+Opt+Ctrl+H)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Add styles
    floatingOverlay.style.cssText = `
      position: fixed;
      bottom: 120px;
      right: 20px;
      width: 350px;
      max-width: 90vw;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border-radius: 12px;
      padding: 16px;
      font-family: Netflix Sans, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      z-index: 99999;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(20px);
    `;
    
    // Add internal styles
    const style = document.createElement('style');
    style.textContent = `
      #netflix-learning-overlay .overlay-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      #netflix-learning-overlay .subtitle-display {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        min-height: 60px;
        display: flex;
        align-items: center;
      }
      
      #netflix-learning-overlay .subtitle-text {
        font-size: 16px;
        line-height: 1.5;
        text-align: center;
        width: 100%;
        font-weight: 500;
      }
      
      #netflix-learning-overlay .subtitle-text.empty {
        opacity: 0.6;
        font-style: italic;
      }
      
      #netflix-learning-overlay .capture-controls {
        display: flex;
        gap: 8px;
        justify-content: space-between;
      }
      
      #netflix-learning-overlay .capture-btn {
        flex: 1;
        background: #e50914;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
      }
      
      #netflix-learning-overlay .capture-btn:hover {
        background: #f40612;
        transform: translateY(-1px);
      }
      
      #netflix-learning-overlay .capture-btn:active {
        transform: translateY(0);
      }
      
      #netflix-learning-overlay .capture-btn:disabled {
        background: rgba(255, 255, 255, 0.2);
        cursor: not-allowed;
        transform: none;
      }
      
      #netflix-learning-overlay .toggle-overlay-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      #netflix-learning-overlay .toggle-overlay-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      #netflix-learning-overlay.visible {
        opacity: 1;
        transform: translateY(0);
      }
      
      #netflix-learning-overlay.capturing {
        border-color: #4CAF50;
        background: rgba(76, 175, 80, 0.2);
      }
      
      #netflix-learning-overlay.error {
        border-color: #f44336;
        background: rgba(244, 67, 54, 0.2);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(floatingOverlay);
    
    // Add event listeners
    setupOverlayEventListeners();
    
    console.log('🎭 Floating capture overlay created');
  }
  
  // Setup overlay event listeners
  function setupOverlayEventListeners() {
    const captureBtn = document.getElementById('overlay-capture-btn');
    const toggleBtn = document.getElementById('overlay-toggle-btn');
    
    if (captureBtn) {
      captureBtn.addEventListener('click', handleOverlayCapture);
    }
    
    if (toggleBtn) {
      toggleBtn.addEventListener('click', hideOverlay);
    }
    
    // Hotkey support
    document.addEventListener('keydown', handleOverlayHotkeys);
  }
  
  // Handle overlay hotkeys
  function handleOverlayHotkeys(event) {
    // Cmd+Opt+Ctrl+C: Capture subtitle (Mac-friendly)
    if (event.metaKey && event.altKey && event.ctrlKey && event.code === 'KeyC') {
      event.preventDefault();
      handleOverlayCapture();
    }
    
    // Cmd+Opt+Ctrl+H: Toggle overlay (Mac-friendly)
    if (event.metaKey && event.altKey && event.ctrlKey && event.code === 'KeyH') {
      event.preventDefault();
      toggleOverlay();
    }
    
    // Cmd+Opt+Ctrl+S: Show overlay (Mac-friendly)
    if (event.metaKey && event.altKey && event.ctrlKey && event.code === 'KeyS') {
      event.preventDefault();
      showOverlay();
    }
  }
  
  // Handle overlay capture
  async function handleOverlayCapture() {
    console.log('🎯 === OVERLAY CAPTURE STARTED ===');
    const captureBtn = document.getElementById('overlay-capture-btn');
    const subtitleText = document.getElementById('overlay-subtitle-text');
    
    console.log('🔍 Capture button:', !!captureBtn);
    console.log('🔍 Subtitle element:', !!subtitleText);
    
    if (!captureBtn || !subtitleText) {
      console.error('❌ Missing UI elements');
      return;
    }
    
    const currentText = lastDisplayedSubtitle.trim();
    console.log('📝 Current text to capture:', currentText);
    console.log('📝 Length:', currentText.length);
    
    if (!currentText || currentText === 'Waiting for subtitles...' || currentText === 'No subtitles visible') {
      console.error('❌ No valid subtitle text');
      showCaptureError('No subtitle text to capture');
      return;
    }
    
    // Visual feedback - capturing state
    captureBtn.disabled = true;
    captureBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="16 12 12 8 8 12"/>
        <line x1="12" y1="16" x2="12" y2="8"/>
      </svg>
      Capturing...
    `;
    
    floatingOverlay.classList.add('capturing');
    
    try {
      console.log('🎯 Direct capture overlay requesting:', currentText);
      
      // Use the exact same method as the working sidepanel capture
      // Send a message to our own content script's analyzeTextInSidepanel case
      const currentVideoInfo = getVideoInfo();
      if (!currentVideoInfo) {
        throw new Error('Could not get Netflix video information');
      }
      
      console.log('📱 Current video info:', currentVideoInfo);
      console.log('📝 Sending Netflix text to sidepanel for analysis (direct capture)');
      
      // Use the exact same chrome.runtime.sendMessage approach as the working case
      chrome.runtime.sendMessage({
        action: 'analyzeTextInSidepanel',
        text: currentText,
        url: currentVideoInfo.url,
        title: currentVideoInfo.title,
        language: detectLanguage(),
        source: 'netflix-direct-capture',
        platform: 'netflix',
        videoId: currentVideoInfo.videoId,
        timestamp: currentVideoInfo.timestamp
      }).then(() => {
        console.log('✅ Direct capture successful - text sent to sidepanel');
        showCaptureSuccess();
      }).catch(error => {
        console.error('❌ Failed to send to sidepanel:', error);
        
        // Try the internal message approach as fallback
        console.log('🔄 Trying internal message approach...');
        
        // Create a mock request/response like the working analyzeTextInSidepanel case
        const mockRequest = {
          action: 'analyzeTextInSidepanel',
          text: currentText
        };
        const mockSender = { tab: { id: null } };
        const mockSendResponse = (response) => {
          if (response && response.success) {
            console.log('✅ Internal message successful');
            showCaptureSuccess();
          } else {
            console.error('❌ Internal message failed:', response?.error);
            showCaptureError(response?.error || 'Internal processing failed');
          }
        };
        
        // Simulate the exact logic from the working analyzeTextInSidepanel case
        const videoInfo = getVideoInfo();
        if (videoInfo) {
          console.log('📝 Sending Netflix text to sidepanel for analysis (internal)');
          
          chrome.runtime.sendMessage({
            action: 'analyzeTextInSidepanel',
            text: currentText,
            url: videoInfo.url,
            title: videoInfo.title,
            language: detectLanguage(),
            source: 'netflix-direct-capture-internal',
            platform: 'netflix',
            videoId: videoInfo.videoId,
            timestamp: videoInfo.timestamp
          }).then(() => {
            mockSendResponse({ success: true });
          }).catch(internalError => {
            console.error('❌ Internal method also failed:', internalError);
            mockSendResponse({ success: false, error: internalError.message });
          });
        } else {
          mockSendResponse({ 
            success: false, 
            error: 'Could not extract Netflix video information' 
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Direct capture completely failed:', error);
      showCaptureError('Capture failed - check console for details');
    }
  }
  
  // Show capture success
  function showCaptureSuccess() {
    const captureBtn = document.getElementById('overlay-capture-btn');
    const overlay = floatingOverlay;
    
    if (captureBtn) {
      captureBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        Captured!
      `;
      captureBtn.style.background = '#4CAF50';
    }
    
    overlay.classList.remove('capturing', 'error');
    overlay.style.borderColor = '#4CAF50';
    
    // Reset after delay
    setTimeout(() => {
      resetCaptureButton();
      overlay.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }, 2000);
  }
  
  // Show capture error
  function showCaptureError(message) {
    const captureBtn = document.getElementById('overlay-capture-btn');
    const overlay = floatingOverlay;
    
    if (captureBtn) {
      captureBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        ${message.length > 20 ? 'Error' : message}
      `;
      captureBtn.style.background = '#f44336';
    }
    
    overlay.classList.remove('capturing');
    overlay.classList.add('error');
    
    // Reset after delay
    setTimeout(() => {
      resetCaptureButton();
      overlay.classList.remove('error');
    }, 3000);
  }
  
  // Reset capture button
  function resetCaptureButton() {
    const captureBtn = document.getElementById('overlay-capture-btn');
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 21h8"/>
          <path d="M12 17v4"/>
          <path d="M5.5 17h13a2 2 0 0 0 1.8-2.9L14.6 3.1a2 2 0 0 0-3.2 0L5.7 14.1A2 2 0 0 0 7.5 17z"/>
        </svg>
        Capture
      `;
      captureBtn.style.background = '#e50914';
    }
  }
  
  // Show overlay
  function showOverlay() {
    if (!floatingOverlay) {
      createFloatingCaptureOverlay();
    }
    
    overlayVisible = true;
    floatingOverlay.classList.add('visible');
    startSubtitleMonitoring();
    
    console.log('👁️ Netflix overlay shown');
  }
  
  // Hide overlay
  function hideOverlay() {
    if (floatingOverlay) {
      overlayVisible = false;
      floatingOverlay.classList.remove('visible');
      stopSubtitleMonitoring();
      
      console.log('🙈 Netflix overlay hidden');
    }
  }
  
  // Toggle overlay
  function toggleOverlay() {
    if (overlayVisible) {
      hideOverlay();
    } else {
      showOverlay();
    }
  }
  
  // Start monitoring subtitles for overlay
  function startSubtitleMonitoring() {
    if (subtitleCheckInterval) return;
    
    subtitleCheckInterval = setInterval(() => {
      if (!overlayVisible) return;
      
      const currentSubtitle = captureCurrentNetflixSubtitle();
      const subtitleElement = document.getElementById('overlay-subtitle-text');
      const captureBtn = document.getElementById('overlay-capture-btn');
      
      if (subtitleElement) {
        if (currentSubtitle && currentSubtitle !== lastDisplayedSubtitle) {
          lastDisplayedSubtitle = currentSubtitle;
          subtitleElement.textContent = currentSubtitle;
          subtitleElement.classList.remove('empty');
          
          if (captureBtn) {
            captureBtn.disabled = false;
          }
        } else if (!currentSubtitle && lastDisplayedSubtitle !== 'No subtitles visible') {
          lastDisplayedSubtitle = 'No subtitles visible';
          subtitleElement.textContent = 'No subtitles visible';
          subtitleElement.classList.add('empty');
          
          if (captureBtn) {
            captureBtn.disabled = true;
          }
        }
      }
    }, 500); // Check every 500ms
    
    console.log('👂 Started subtitle monitoring for overlay');
  }
  
  // Stop monitoring subtitles
  function stopSubtitleMonitoring() {
    if (subtitleCheckInterval) {
      clearInterval(subtitleCheckInterval);
      subtitleCheckInterval = null;
      console.log('🛑 Stopped subtitle monitoring');
    }
  }
  
  // Auto-show overlay when on Netflix watch page
  function autoShowOverlayOnNetflix() {
    if (window.location.href.includes('/watch/')) {
      setTimeout(() => {
        showOverlay();
      }, 3000); // Wait for Netflix to fully load
    }
  }
  
  // Initialize direct capture functionality
  setTimeout(() => {
    if (window.location.href.includes('netflix.com')) {
      console.log('🎭 Initializing Netflix direct capture overlay');
      autoShowOverlayOnNetflix();
      
      // Add debug function to window for testing
      window.debugNetflixCapture = function() {
        console.log('🔧 === DEBUG NETFLIX CAPTURE ===');
        console.log('Current subtitle:', lastDisplayedSubtitle);
        console.log('Video info:', getVideoInfo());
        console.log('Language:', detectLanguage());
        console.log('Overlay visible:', overlayVisible);
        console.log('Chrome runtime available:', !!chrome?.runtime);
        
        // Test direct capture with current subtitle
        if (lastDisplayedSubtitle && lastDisplayedSubtitle !== 'Waiting for subtitles...' && lastDisplayedSubtitle !== 'No subtitles visible') {
          console.log('🧪 Testing capture with:', lastDisplayedSubtitle);
          handleOverlayCapture();
        } else {
          console.log('❌ No valid subtitle to test with');
        }
      };
      
      console.log('🔧 Debug function added: window.debugNetflixCapture()');
    }
  }, 2000);

})();