// Manual Caption Test - Run this directly in browser console
// This will help us understand what captions are actually available

console.log('🧪 MANUAL CAPTION TEST');
console.log('📍 URL:', window.location.href);
console.log('📹 Video ID:', window.location.href.match(/[?&]v=([^&]+)/)?.[1]);

// Test 1: Check CC button
const ccButton = document.querySelector('.ytp-subtitles-button');
console.log('📝 CC Button found:', !!ccButton);
if (ccButton) {
  console.log('📝 CC Button state:', ccButton.getAttribute('aria-pressed'));
  console.log('📝 CC Button title:', ccButton.getAttribute('title'));
}

// Test 2: Check if captions are currently visible
const captionElements = [
  '.ytp-caption-segment',
  '.captions-text', 
  '.ytp-caption-window-container .captions-text',
  '[class*="caption"]'
].map(selector => document.querySelectorAll(selector))
 .filter(nodeList => nodeList.length > 0);

console.log('👁️ Visible caption elements:', captionElements.length > 0);

// Test 3: Click CC button if not enabled
if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
  console.log('🔘 Enabling captions...');
  ccButton.click();
  
  setTimeout(() => {
    console.log('⏱️ After clicking CC button:');
    console.log('📝 CC Button state:', ccButton.getAttribute('aria-pressed'));
    
    const newCaptionElements = document.querySelectorAll('.ytp-caption-segment, .captions-text');
    console.log('👁️ Caption elements now visible:', newCaptionElements.length);
    
    if (newCaptionElements.length > 0) {
      console.log('✅ CAPTIONS ARE WORKING! Sample text:', newCaptionElements[0].textContent);
    }
  }, 2000);
}

// Test 4: Check settings menu for caption options
const settingsButton = document.querySelector('.ytp-settings-button');
if (settingsButton) {
  console.log('⚙️ Settings button found, clicking...');
  settingsButton.click();
  
  setTimeout(() => {
    const captionOption = Array.from(document.querySelectorAll('.ytp-menuitem')).find(item => 
      item.textContent.toLowerCase().includes('subtitle') || 
      item.textContent.toLowerCase().includes('caption') ||
      item.textContent.toLowerCase().includes('ondertitel') // Dutch
    );
    
    if (captionOption) {
      console.log('📝 Caption option found in settings:', captionOption.textContent);
      captionOption.click();
      
      setTimeout(() => {
        const languageOptions = document.querySelectorAll('.ytp-menuitem');
        console.log('🌐 Available caption languages:');
        languageOptions.forEach((option, index) => {
          console.log(`  ${index + 1}. ${option.textContent}`);
        });
        
        // Close settings
        document.querySelector('.ytp-settings-button')?.click();
      }, 1000);
    } else {
      console.log('❌ No caption option found in settings');
      // Close settings
      document.querySelector('.ytp-settings-button')?.click();
    }
  }, 1000);
}

// Test 5: Direct global variable check
setTimeout(() => {
  console.log('🌐 GLOBAL VARIABLES CHECK:');
  console.log('window.ytInitialPlayerResponse:', typeof window.ytInitialPlayerResponse);
  
  if (window.ytInitialPlayerResponse) {
    const captions = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    console.log('📝 Direct captions check:', captions ? `${captions.length} tracks` : 'No captions');
    
    if (captions) {
      console.log('📋 Available tracks:');
      captions.forEach((track, index) => {
        console.log(`  ${index + 1}. ${track.languageCode} - ${track.name?.simpleText} (${track.vssId})`);
      });
    }
  }
}, 3000);

console.log('⏳ Test running... check console in 5 seconds for full results');