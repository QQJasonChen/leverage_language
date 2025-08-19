// 🏗️ ARCHITECTURE: Platform Content Script Template
// This file demonstrates the standard structure for platform-specific content scripts.
// When creating new platform content scripts, follow this template:
//
// 📋 CHECKLIST FOR NEW PLATFORMS:
// 1. Update platform name and selectors (lines 30-40)
// 2. Implement required interface methods (lines 150-290)
// 3. Add platform-specific message handlers (lines 325-475)
// 4. Configure subtitle/video monitoring (lines 90-150)
// 5. Test all standard actions: ping, getVideoInfo, captureSubtitle, seek
//
// 🔧 STANDARD INTERFACE METHODS (implement for each platform):
// - extractVideoId() - Unique video identifier from URL/DOM
// - extractCourseTitle() / extractVideoTitle() - Content title
// - getCurrentSubtitleText() - Current visible subtitle
// - createTimestampUrl() - URL with timestamp parameter
// - handleMessage() - Process extension messages
//
// 🚀 COPY THIS TEMPLATE for new platforms: coursera-content.js, khan-content.js, etc.

// Udemy Content Script - Language Learning Integration
// Provides subtitle extraction and learning analysis for Udemy courses

(function() {
    'use strict';
    
    console.log('📚 Udemy Language Learning Extension initialized');
    
    // 🔧 PATTERN: Standard state variables for all platform content scripts
    let currentVideoInfo = null;
    let lastKnownVideoId = null;
    let subtitleObserver = null;
    let videoObserver = null;
    let subtitleMonitorInterval = null; // Use interval instead of observer for stability
    let contextInvalidated = false;
    let isCollecting = false;
    let collectedSegments = [];
    let collectionStartTime = null;
    let lastSubtitleText = '';
    let lastSubtitleTime = 0;
    
    // Crash prevention limits
    let observerErrorCount = 0;
    const MAX_OBSERVER_ERRORS = 5;
    
    // Check for context invalidation
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (chrome.runtime.lastError) {
            console.log('🔄 Udemy context invalidated');
            contextInvalidated = true;
            cleanup();
            return;
        }
        return handleMessage(request, sender, sendResponse);
    });
    
    // 🎯 PLATFORM: Udemy-specific selectors and patterns
    // This is the most critical part for each platform - CSS selectors that find video
    // and subtitle elements. When adding new platforms:
    //
    // 1. Inspect the platform's HTML structure
    // 2. Find video element selector (usually <video> tag)
    // 3. Find subtitle/caption container selector  
    // 4. Find course/video title selectors
    // 5. Test selectors work on different pages/videos
    //
    // 🚀 FUTURE: Create similar selector objects for new platforms
    const UDEMY_SELECTORS = {
        video: 'video[data-purpose="video-display"]',        // Main video element
        videoContainer: '[data-purpose="video-viewer"]',     // Video player container
        subtitleContainer: '[data-purpose="captions-display"]', // Subtitle text container
        courseTitle: '[data-purpose="course-header-title"]', // Course name
        lectureTitle: '[data-purpose="lecture-title"]',      // Individual lecture title
        progressBar: '[data-purpose="progress-bar"]',        // Progress indicator
        playButton: '[data-purpose="play-button"]'           // Play/pause control
    };
    // 📝 EXAMPLE: Coursera selectors might be:
    // const COURSERA_SELECTORS = {
    //     video: 'video.vjs-tech',
    //     subtitleContainer: '.rc-CaptionsRenderer',
    //     courseTitle: '[data-test="course-title"]',
    // };
    
    // Initialize Udemy integration
    function initialize() {
        if (contextInvalidated) return;
        
        console.log('🎓 Initializing Udemy learning integration...');
        
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupUdemyWatcher);
        } else {
            setupUdemyWatcher();
        }
    }
    
    // Set up watchers for Udemy video changes
    function setupUdemyWatcher() {
        if (contextInvalidated) return;
        
        // Look for video element
        const video = document.querySelector(UDEMY_SELECTORS.video);
        if (video) {
            console.log('🎥 Udemy video detected');
            initializeVideoWatcher(video);
            extractCourseInfo();
        }
        
        // Watch for dynamically loaded video content (with error handling)
        try {
            videoObserver = new MutationObserver((mutations) => {
                if (contextInvalidated) return;
                
                try {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const video = node.querySelector?.(UDEMY_SELECTORS.video) || 
                                             (node.matches?.(UDEMY_SELECTORS.video) ? node : null);
                                if (video && video !== document.querySelector(UDEMY_SELECTORS.video)) {
                                    console.log('🔄 New Udemy video detected');
                                    initializeVideoWatcher(video);
                                    extractCourseInfo();
                                }
                            }
                        });
                    });
                } catch (error) {
                    observerErrorCount++;
                    console.log(`⚠️ Video observer error ${observerErrorCount}:`, error.message);
                    
                    if (observerErrorCount >= MAX_OBSERVER_ERRORS) {
                        console.log('🛑 Too many observer errors, disabling video monitoring');
                        videoObserver.disconnect();
                    }
                }
            });
            
            videoObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (error) {
            console.log('❌ Failed to set up video observer:', error.message);
        }
    }
    
    // Initialize video-specific watchers
    function initializeVideoWatcher(video) {
        if (contextInvalidated) return;
        
        // Extract video information
        currentVideoInfo = {
            videoElement: video,
            videoId: extractVideoId(),
            courseTitle: extractCourseTitle(),
            lectureTitle: extractLectureTitle(),
            duration: video.duration || 0,
            currentTime: video.currentTime || 0,
            url: window.location.href,
            platform: 'udemy'
        };
        
        // Set up subtitle monitoring
        setupSubtitleWatcher();
        
        // Monitor video events
        video.addEventListener('loadedmetadata', onVideoMetadataLoaded);
        video.addEventListener('timeupdate', onVideoTimeUpdate);
        video.addEventListener('play', onVideoPlay);
        video.addEventListener('pause', onVideoPause);
        
        console.log('📊 Udemy video watcher initialized:', currentVideoInfo);
    }
    
    // Set up subtitle text monitoring
    function setupSubtitleWatcher() {
        if (contextInvalidated) return;
        
        const subtitleContainer = document.querySelector(UDEMY_SELECTORS.subtitleContainer);
        if (!subtitleContainer) {
            console.log('⚠️ No subtitle container found, will retry...');
            // Retry subtitle detection after a delay
            setTimeout(() => {
                if (!contextInvalidated) setupSubtitleWatcher();
            }, 2000);
            return;
        }
        
        console.log('📝 Setting up Udemy subtitle watcher');
        
        // Monitor subtitle changes
        if (subtitleObserver) {
            subtitleObserver.disconnect();
        }
        
        // Use interval-based monitoring instead of MutationObserver to prevent crashes
        if (subtitleMonitorInterval) {
            clearInterval(subtitleMonitorInterval);
        }
        
        subtitleMonitorInterval = setInterval(() => {
            if (contextInvalidated) return;
            
            try {
                const subtitleText = subtitleContainer.textContent?.trim();
                if (subtitleText && subtitleText.length > 0) {
                    // Throttle subtitle changes to prevent browser crashes
                    const now = Date.now();
                    if (subtitleText !== lastSubtitleText && (now - lastSubtitleTime) > 1000) { // Increased to 1 second
                        lastSubtitleText = subtitleText;
                        lastSubtitleTime = now;
                        onSubtitleChange(subtitleText);
                    }
                }
            } catch (error) {
                observerErrorCount++;
                console.log(`⚠️ Subtitle monitoring error ${observerErrorCount}:`, error.message);
                
                if (observerErrorCount >= MAX_OBSERVER_ERRORS) {
                    console.log('🛑 Too many subtitle errors, stopping monitoring');
                    clearInterval(subtitleMonitorInterval);
                    subtitleMonitorInterval = null;
                }
            }
        }, 1000); // Check every 1 second to prevent crashes
        
        console.log('⚡ Udemy subtitle monitoring started with 1-second interval (crash-safe)');
    }
    
    // Extract video ID from URL
    function extractVideoId() {
        const url = window.location.href;
        const match = url.match(/\/lecture\/(\d+)/);
        return match ? match[1] : `udemy_${Date.now()}`;
    }
    
    // Extract course title
    function extractCourseTitle() {
        const titleElement = document.querySelector(UDEMY_SELECTORS.courseTitle);
        return titleElement?.textContent?.trim() || 'Unknown Course';
    }
    
    // Extract lecture title
    function extractLectureTitle() {
        const titleElement = document.querySelector(UDEMY_SELECTORS.lectureTitle);
        return titleElement?.textContent?.trim() || 'Unknown Lecture';
    }
    
    // Handle subtitle changes
    function onSubtitleChange(subtitleText) {
        if (contextInvalidated || !currentVideoInfo) return;
        
        console.log('📝 Udemy subtitle:', subtitleText);
        
        const video = currentVideoInfo.videoElement;
        const currentTime = video ? video.currentTime : 0;
        
        // If collecting, add to collected segments
        if (isCollecting && subtitleText && subtitleText.length > 0) {
            console.log(`🔍 Collection active - processing subtitle: "${subtitleText}"`);
            
            const segment = {
                text: subtitleText,
                cleanText: subtitleText,
                start: currentTime,
                timestamp: formatTimestamp(currentTime),
                timestampDisplay: formatTimestamp(currentTime),
                timestampInSeconds: currentTime,
                source: 'udemy-collection',
                platform: 'udemy',
                videoInfo: currentVideoInfo,
                courseTitle: currentVideoInfo.courseTitle,
                lectureTitle: currentVideoInfo.lectureTitle,
                url: window.location.href,
                segmentIndex: collectedSegments.length,
                groupIndex: 0
            };
            
            // Check for duplicates (avoid collecting the same subtitle repeatedly)
            const lastSegment = collectedSegments[collectedSegments.length - 1];
            const isDuplicate = lastSegment && lastSegment.text === subtitleText && (currentTime - lastSegment.timestampInSeconds) <= 2;
            
            if (!isDuplicate) {
                collectedSegments.push(segment);
                console.log(`📚 ✅ Collected segment ${collectedSegments.length}: "${subtitleText}" at ${formatTimestamp(currentTime)}`);
            } else {
                console.log(`📚 ⏭️ Skipping duplicate: "${subtitleText}"`);
            }
        } else if (isCollecting) {
            console.log(`🔍 Collection active but no subtitle text: "${subtitleText}"`);
        }
        
        // Send subtitle data to extension
        sendMessage({
            action: 'udemySubtitleUpdate',
            data: {
                text: subtitleText,
                timestamp: currentTime,
                videoInfo: currentVideoInfo,
                url: window.location.href
            }
        });
    }
    
    // Format timestamp for display (MM:SS)
    function formatTimestamp(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Video event handlers
    function onVideoMetadataLoaded(event) {
        if (contextInvalidated) return;
        
        console.log('🎥 Udemy video metadata loaded');
        if (currentVideoInfo) {
            currentVideoInfo.duration = event.target.duration;
            sendMessage({
                action: 'udemyVideoLoaded',
                data: currentVideoInfo
            });
        }
    }
    
    function onVideoTimeUpdate(event) {
        if (contextInvalidated || !currentVideoInfo) return;
        
        currentVideoInfo.currentTime = event.target.currentTime;
    }
    
    function onVideoPlay(event) {
        if (contextInvalidated) return;
        
        console.log('▶️ Udemy video playing');
        sendMessage({
            action: 'udemyVideoPlay',
            data: { timestamp: event.target.currentTime, videoInfo: currentVideoInfo }
        });
    }
    
    function onVideoPause(event) {
        if (contextInvalidated) return;
        
        console.log('⏸️ Udemy video paused');
        sendMessage({
            action: 'udemyVideoPause',
            data: { timestamp: event.target.currentTime, videoInfo: currentVideoInfo }
        });
    }
    
    // Create timestamp URL for Udemy navigation
    function createUdemyTimestampUrl(timestamp) {
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('?')[0]; // Remove existing query params
        const urlParams = new URLSearchParams(window.location.search);
        
        // Update or add the start parameter with timestamp in seconds
        urlParams.set('start', Math.floor(timestamp).toString());
        
        return `${baseUrl}?${urlParams.toString()}`;
    }
    
    // Extract current subtitle text manually
    function getCurrentSubtitleText() {
        console.log('🔍 Searching for Udemy subtitles...');
        
        // Try multiple possible subtitle selectors
        const possibleSelectors = [
            '[data-purpose="captions-display"]',
            '[data-purpose="captions"]', 
            '.captions-display',
            '.video-viewer--captions-container',
            '.vjs-text-track-display',
            '.shaka-text-container',
            '[class*="captions"]',
            '[class*="subtitle"]',
            '[class*="caption-display"]'
        ];
        
        for (const selector of possibleSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent?.trim();
                console.log(`🔍 Found element with selector "${selector}":`, element);
                console.log(`📝 Text content: "${text}"`);
                if (text && text.length > 0) {
                    console.log(`✅ Using subtitle from "${selector}": "${text}"`);
                    return text;
                }
            }
        }
        
        // Fallback: look for any element containing subtitle-like content
        console.log('🔍 Trying fallback subtitle detection...');
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
            const text = div.textContent?.trim();
            if (text && 
                text.length > 5 && 
                text.length < 500 && // Reasonable subtitle length
                !text.includes('http') && // Not a URL
                !div.querySelector('button') && // Not containing buttons
                !div.querySelector('input')) { // Not containing inputs
                
                const computedStyle = window.getComputedStyle(div);
                const isVisible = computedStyle.display !== 'none' && 
                                computedStyle.visibility !== 'hidden' &&
                                computedStyle.opacity !== '0';
                
                if (isVisible && div.offsetParent !== null) {
                    console.log('🔍 Potential subtitle div found:', div, 'text:', text);
                }
            }
        }
        
        console.log('❌ No subtitle text found with any method');
        return '';
    }
    
    // Extract comprehensive course information
    function extractCourseInfo() {
        if (contextInvalidated) return;
        
        const courseInfo = {
            courseTitle: extractCourseTitle(),
            lectureTitle: extractLectureTitle(),
            url: window.location.href,
            videoId: extractVideoId(),
            timestamp: Date.now(),
            platform: 'udemy'
        };
        
        console.log('📊 Extracted Udemy course info:', courseInfo);
        
        sendMessage({
            action: 'udemyCourseInfo',
            data: courseInfo
        });
        
        return courseInfo;
    }
    
    // Handle messages from extension
    function handleMessage(request, sender, sendResponse) {
        if (contextInvalidated) {
            sendResponse({ success: false, error: 'Context invalidated' });
            return false;
        }
        
        console.log('📨 Udemy content script received message:', request.action);
        
        try {
            switch (request.action) {
                case 'captureCurrentSubtitle':
                case 'captureUdemySubtitle':
                    const subtitleText = getCurrentSubtitleText();
                    
                    // Try multiple video selectors and log findings
                    console.log('🔍 Searching for Udemy video element...');
                    const possibleVideoSelectors = [
                        'video[data-purpose="video-display"]',
                        'video',
                        '.video-js video',
                        '[data-purpose="video-viewer"] video'
                    ];
                    
                    let video = null;
                    let timestamp = 0;
                    
                    for (const selector of possibleVideoSelectors) {
                        const foundVideo = document.querySelector(selector);
                        if (foundVideo) {
                            console.log(`🎥 Found video with selector "${selector}":`, foundVideo);
                            console.log(`⏰ Video currentTime: ${foundVideo.currentTime}`);
                            console.log(`⏰ Video duration: ${foundVideo.duration}`);
                            console.log(`▶️ Video paused: ${foundVideo.paused}`);
                            
                            if (foundVideo.currentTime > 0 || !video) {
                                video = foundVideo;
                                timestamp = foundVideo.currentTime;
                            }
                        }
                    }
                    
                    // Fallback: try to extract timestamp from URL
                    if (timestamp === 0) {
                        const urlParams = new URLSearchParams(window.location.search);
                        const startParam = urlParams.get('start');
                        if (startParam) {
                            timestamp = parseInt(startParam, 10) || 0;
                            console.log(`🔗 Using timestamp from URL: ${timestamp}s`);
                        }
                    }
                    
                    // Create timestamp URL for Udemy (similar to YouTube)
                    const timestampUrl = createUdemyTimestampUrl(timestamp);
                    
                    console.log(`📚 Captured Udemy subtitle: "${subtitleText}" at ${timestamp}s`);
                    console.log(`🔗 Timestamp URL: ${timestampUrl}`);
                    
                    sendResponse({
                        success: true,
                        data: {
                            text: subtitleText,
                            timestamp: timestamp,
                            timestampUrl: timestampUrl,
                            videoInfo: {
                                ...currentVideoInfo,
                                currentTime: timestamp,
                                platform: 'udemy' // Explicitly set platform
                            },
                            url: window.location.href,
                            platform: 'udemy' // Also set at top level
                        }
                    });
                    break;
                    
                case 'getUdemyVideoInfo':
                    sendResponse({
                        success: true,
                        data: currentVideoInfo || extractCourseInfo()
                    });
                    break;
                    
                case 'seekUdemyVideo':
                    const targetTime = request.time;
                    console.log(`🔍 Udemy seek request: ${targetTime}s`);
                    
                    // Use the same selectors that work for video detection during capture
                    const possibleVideoSelectors = [
                        'video[data-purpose="video-display"]',
                        'video',
                        '.video-js video',
                        '[data-purpose="video-viewer"] video'
                    ];
                    
                    let videoElement = null;
                    for (const selector of possibleVideoSelectors) {
                        videoElement = document.querySelector(selector);
                        if (videoElement) {
                            console.log(`🎥 Found video element with selector "${selector}"`);
                            break;
                        }
                    }
                    
                    console.log(`🔍 Video element found:`, !!videoElement);
                    console.log(`🔍 Video element details:`, videoElement);
                    
                    if (videoElement && targetTime !== undefined) {
                        console.log(`🔍 Current video time before seek: ${videoElement.currentTime}s`);
                        videoElement.currentTime = targetTime;
                        console.log(`⏭️ Seeking to ${targetTime}s`);
                        console.log(`🔍 Video time after seek: ${videoElement.currentTime}s`);
                        sendResponse({ success: true, time: targetTime });
                    } else {
                        console.log(`❌ Seek failed - videoElement: ${!!videoElement}, targetTime: ${targetTime}`);
                        sendResponse({ success: false, error: 'Cannot seek video - element not found or invalid time' });
                    }
                    break;
                    
                case 'startUdemySubtitleCollection':
                    console.log('📚 Starting Udemy subtitle collection...');
                    console.log('🔍 Current collection state:', { isCollecting, collectedSegments: collectedSegments.length });
                    
                    if (!isCollecting) {
                        isCollecting = true;
                        collectedSegments = [];
                        collectionStartTime = Date.now();
                        console.log('✅ Udemy collection started successfully');
                        sendResponse({ success: true, isCollecting: true });
                    } else {
                        console.log('⚠️ Already collecting - returning current state');
                        sendResponse({ success: true, isCollecting: true, message: 'Already collecting' });
                    }
                    break;
                    
                case 'stopUdemySubtitleCollection':
                    console.log('📚 Stopping Udemy subtitle collection...');
                    if (isCollecting) {
                        isCollecting = false;
                        const segments = [...collectedSegments]; // Copy array
                        console.log(`📚 Collection stopped. Collected ${segments.length} segments`);
                        
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
                    
                case 'ping':
                    sendResponse({ success: true, isCollecting: isCollecting });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('❌ Error handling Udemy message:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // Keep message channel open for async response
    }
    
    // Send message to background script
    function sendMessage(message) {
        if (contextInvalidated) return;
        
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('🔄 Message sending failed, context may be invalidated');
                    contextInvalidated = true;
                    cleanup();
                }
            });
        } catch (error) {
            console.log('🔄 Failed to send message, extension context invalidated');
            contextInvalidated = true;
            cleanup();
        }
    }
    
    // Cleanup function
    function cleanup() {
        console.log('🧹 Cleaning up Udemy content script (crash-safe)');
        contextInvalidated = true;
        
        try {
            if (subtitleMonitorInterval) {
                clearInterval(subtitleMonitorInterval);
                subtitleMonitorInterval = null;
                console.log('⏹️ Subtitle monitoring interval cleared');
            }
            
            if (subtitleObserver) {
                subtitleObserver.disconnect();
                subtitleObserver = null;
            }
            
            if (videoObserver) {
                videoObserver.disconnect();
                videoObserver = null;
            }
        } catch (error) {
            console.log('⚠️ Cleanup error (non-critical):', error.message);
        }
        
        currentVideoInfo = null;
        lastKnownVideoId = null;
        
        console.log('✅ Udemy content script cleanup completed');
    }
    
    // Handle page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Initialize the extension
    initialize();
    
})();