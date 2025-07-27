// Test Dutch Caption Detection
// Run this in browser console on YouTube video page

console.log('🧪 Testing Dutch Caption Detection...');

// Check if we're on the right page
if (!window.location.href.includes('youtube.com/watch')) {
  console.error('❌ Not on YouTube video page');
} else {
  console.log('✅ On YouTube video page');
  
  // Check for player
  const player = document.querySelector('#movie_player');
  console.log('🎬 Player found:', !!player);
  
  // Check for CC button
  const ccButton = document.querySelector('.ytp-subtitles-button');
  console.log('📝 CC button found:', !!ccButton);
  console.log('📝 CC button state:', ccButton?.ariaPressed || 'unknown');
  
  // Search for caption data in scripts
  console.log('🔍 Searching for caption data...');
  
  let found = false;
  const scripts = document.querySelectorAll('script');
  
  for (let i = 0; i < scripts.length; i++) {
    const content = scripts[i].textContent;
    if (content && content.includes('captionTracks')) {
      console.log(`📜 Script ${i} contains captionTracks`);
      
      // Try to extract caption tracks
      const patterns = [
        /"captionTracks":\s*(\[[^\]]*\])/,
        /ytInitialPlayerResponse[^}]*"captionTracks":\s*(\[[^\]]*\])/
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          try {
            const tracks = JSON.parse(match[1]);
            console.log('✅ Found caption tracks:', tracks.length);
            console.log('📋 Track details:');
            tracks.forEach((track, idx) => {
              console.log(`  ${idx + 1}. ${track.vssId} (${track.languageCode}) - ${track.name?.simpleText || 'No name'}`);
            });
            
            // Check for Dutch or auto-generated
            const dutchTrack = tracks.find(t => t.languageCode === 'nl' || t.vssId?.includes('.nl'));
            const autoTrack = tracks.find(t => t.vssId?.includes('.asr'));
            
            console.log('🇳🇱 Dutch track:', dutchTrack ? 'FOUND' : 'NOT FOUND');
            console.log('🤖 Auto-generated track:', autoTrack ? 'FOUND' : 'NOT FOUND');
            
            if (dutchTrack) {
              console.log('🎯 Dutch track details:', {
                vssId: dutchTrack.vssId,
                languageCode: dutchTrack.languageCode,
                name: dutchTrack.name?.simpleText,
                hasBaseUrl: !!dutchTrack.baseUrl
              });
            }
            
            if (autoTrack) {
              console.log('🎯 Auto track details:', {
                vssId: autoTrack.vssId,
                languageCode: autoTrack.languageCode,
                name: autoTrack.name?.simpleText,
                hasBaseUrl: !!autoTrack.baseUrl
              });
            }
            
            found = true;
            break;
          } catch (e) {
            console.log('❌ Failed to parse tracks in script', i);
          }
        }
      }
      
      if (found) break;
    }
  }
  
  if (!found) {
    console.log('❌ No caption tracks found in any script');
    console.log('💡 Try enabling captions manually first (click CC button)');
  }
}

console.log('🧪 Test complete');