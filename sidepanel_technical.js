// Technical implementation of YouTube Learning Sidepanel
// This file contains only the core technical functionality

// Message listener for YouTube text analysis
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSidePanel' && request.source === 'youtube-learning') {
    console.log('📖 Received YouTube learning text:', request.text);
    handleYouTubeTextAnalysis(request.text, request.url, request.title);
  }
});

// Handle YouTube text analysis
function handleYouTubeTextAnalysis(text, url, title) {
  console.log('📖 Handling YouTube text analysis:', text);
  
  const analysisSection = document.getElementById('analysisSection');
  if (!analysisSection) return;
  
  // Update UI with selected text
  analysisSection.innerHTML = `
    <div style="padding: 20px;">
      <h3>📖 YouTube Language Learning</h3>
      <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <strong>Selected Text:</strong> "${text}"
      </div>
      <div id="analysisResults">
        <p>🔄 Processing text analysis...</p>
      </div>
      <div style="margin-top: 15px;">
        <button onclick="speakText('${text.replace(/'/g, "\\'")}')">🔊 Speak</button>
        <button onclick="saveToVocabulary('${text.replace(/'/g, "\\'")}')">💾 Save</button>
      </div>
    </div>
  `;
  
  // Simulate analysis (in real implementation, this would call AI service)
  setTimeout(() => {
    const resultsDiv = document.getElementById('analysisResults');
    if (resultsDiv) {
      const isWord = text.split(' ').length === 1;
      resultsDiv.innerHTML = `
        <div style="background: #e8f5e9; padding: 12px; border-radius: 6px;">
          <strong>${isWord ? '📖 Word' : '📝 Text'} Analysis:</strong>
          <ul>
            <li>Type: ${isWord ? 'Single word' : 'Phrase/Sentence'}</li>
            <li>Length: ${text.length} characters</li>
            <li>Words: ${text.split(' ').length}</li>
          </ul>
        </div>
      `;
    }
  }, 1000);
}

// Text-to-speech function
window.speakText = function(text) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Speech error:', error);
  }
};

// Save to vocabulary function
window.saveToVocabulary = function(text) {
  const vocabulary = JSON.parse(localStorage.getItem('vocabulary') || '[]');
  if (!vocabulary.find(item => item.text === text)) {
    vocabulary.push({
      text: text,
      date: new Date().toISOString(),
      source: 'youtube'
    });
    localStorage.setItem('vocabulary', JSON.stringify(vocabulary));
    alert(`"${text}" saved to vocabulary!`);
  } else {
    alert(`"${text}" is already in your vocabulary.`);
  }
};

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  document.body.innerHTML = `
    <div id="analysisSection" style="font-family: Arial, sans-serif;">
      <div style="padding: 20px; text-align: center;">
        <h3>🎯 YouTube Language Learning</h3>
        <p>Select text from YouTube subtitles to begin learning!</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <strong>How to use:</strong><br>
          1. Go to YouTube and play a video<br>
          2. Enable subtitles (CC button)<br>
          3. Click the "📚 LEARN" button<br>
          4. Click on any word in the subtitles
        </div>
      </div>
    </div>
  `;
});