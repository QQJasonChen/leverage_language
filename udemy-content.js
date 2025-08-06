// Udemy Content Script - Language Learning Integration
// Provides subtitle extraction and learning analysis for Udemy courses

(function() {
    'use strict';
    
    console.log('📚 Udemy Language Learning Extension initialized');
    
    let currentVideoInfo = null;
    let lastKnownVideoId = null;
    let subtitleObserver = null;
    let videoObserver = null;
    let contextInvalidated = false;
    
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
    
    // Udemy-specific selectors and patterns
    const UDEMY_SELECTORS = {
        video: 'video[data-purpose="video-display"]',
        videoContainer: '[data-purpose="video-viewer"]',
        subtitleContainer: '[data-purpose="captions-display"]',
        courseTitle: '[data-purpose="course-header-title"]',
        lectureTitle: '[data-purpose="lecture-title"]',
        progressBar: '[data-purpose="progress-bar"]',
        playButton: '[data-purpose="play-button"]'
    };
    
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
        
        // Watch for dynamically loaded video content
        videoObserver = new MutationObserver((mutations) => {
            if (contextInvalidated) return;
            
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
        });
        
        videoObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
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
        
        subtitleObserver = new MutationObserver((mutations) => {
            if (contextInvalidated) return;
            
            const subtitleText = subtitleContainer.textContent?.trim();
            if (subtitleText && subtitleText.length > 0) {
                onSubtitleChange(subtitleText);
            }
        });
        
        subtitleObserver.observe(subtitleContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
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
    
    // Extract current subtitle text manually
    function getCurrentSubtitleText() {
        const subtitleContainer = document.querySelector(UDEMY_SELECTORS.subtitleContainer);
        return subtitleContainer?.textContent?.trim() || '';
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
                case 'captureUdemySubtitle':
                    const subtitleText = getCurrentSubtitleText();
                    const video = document.querySelector(UDEMY_SELECTORS.video);
                    const timestamp = video ? video.currentTime : 0;
                    
                    sendResponse({
                        success: true,
                        data: {
                            text: subtitleText,
                            timestamp: timestamp,
                            videoInfo: currentVideoInfo,
                            url: window.location.href
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
                    const videoElement = document.querySelector(UDEMY_SELECTORS.video);
                    if (videoElement && targetTime !== undefined) {
                        videoElement.currentTime = targetTime;
                        console.log(`⏭️ Seeking to ${targetTime}s`);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Cannot seek video' });
                    }
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
        console.log('🧹 Cleaning up Udemy content script');
        
        if (subtitleObserver) {
            subtitleObserver.disconnect();
            subtitleObserver = null;
        }
        
        if (videoObserver) {
            videoObserver.disconnect();
            videoObserver = null;
        }
        
        currentVideoInfo = null;
        lastKnownVideoId = null;
    }
    
    // Handle page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Initialize the extension
    initialize();
    
})();