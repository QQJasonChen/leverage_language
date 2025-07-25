// YouTube Standalone Learning - No inline script injection
// Direct content script implementation to avoid CSP violations

console.log('🎓 YouTube Standalone Learning loading...');

// Only run on YouTube
if (window.location.href.includes('youtube.com')) {
  console.log('✅ On YouTube - creating learning system');
  
  // Global state
  let isLearningEnabled = false;
  let mouseUpHandler = null;
  let subtitleHoverHandler = null;
  let subtitleClickHandler = null;
  let subtitleLeaveHandler = null;
  let learningButton = null;
  let buttonObserver = null;
  
  // Create persistent learning button
  function createYouTubeLearningButton() {
    console.log('🔘 Creating YouTube learning button...');
    
    // Remove any existing button
    const existing = document.querySelector('#yt-learning-btn');
    if (existing) {
      console.log('🗑️ Removing existing button');
      existing.remove();
    }
    
    const button = document.createElement('div');
    button.id = 'yt-learning-btn';
    button.innerHTML = '📚 LEARN';
    button.title = 'Click to enable text selection learning';
    
    // Apply strong styling
    button.style.cssText = `
      position: fixed !important;
      top: 10px !important;
      right: 10px !important;
      width: 80px !important;
      height: 40px !important;
      background-color: #ff4444 !important;
      color: white !important;
      border: 3px solid white !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 12px !important;
      font-weight: bold !important;
      font-family: Arial, sans-serif !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
      user-select: none !important;
      pointer-events: auto !important;
    `;
    
    // Button click handler
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      
      isLearningEnabled = !isLearningEnabled;
      console.log('🔄 Learning mode:', isLearningEnabled ? 'ON' : 'OFF');
      
      if (isLearningEnabled) {
        button.style.backgroundColor = '#44ff44';
        button.innerHTML = '✅ ON';
        enableTextLearning();
      } else {
        button.style.backgroundColor = '#ff4444';
        button.innerHTML = '📚 LEARN';
        disableTextLearning();
      }
    });
    
    learningButton = button;
    return button;
  }
  
  function enableTextLearning() {
    console.log('🎯 Enabling text learning...');
    
    // Enable text selection on descriptions, comments, etc.
    const style = document.createElement('style');
    style.id = 'yt-learning-styles';
    style.textContent = `
      ytd-video-description-content-section-renderer,
      #meta-contents,
      #content-text,
      yt-formatted-string,
      #comments,
      ytd-comment-thread-renderer {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        pointer-events: auto !important;
      }
      
      /* Highlight subtitles on hover to show they're interactive */
      .ytp-caption-segment:hover,
      .captions-text:hover {
        background-color: rgba(255, 255, 0, 0.2) !important;
        cursor: pointer !important;
        border-radius: 3px !important;
      }
    `;
    document.head.appendChild(style);
    
    // Handle text selection for descriptions, comments, etc.
    mouseUpHandler = function(e) {
      if (!isLearningEnabled) return;
      
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text && text.length > 0) {
          console.log('📝 Text selected:', text);
          showTextPopup(text, e.clientX, e.clientY);
        }
      }, 50);
    };
    
    // Handle hover for subtitles with enhanced word/sentence detection
    subtitleHoverHandler = function(e) {
      if (!isLearningEnabled) return;
      
      const target = e.target;
      const isSubtitle = target.matches('.ytp-caption-segment, .captions-text') || 
                        target.closest('.ytp-caption-segment, .captions-text');
      
      if (isSubtitle) {
        const subtitleElement = isSubtitle === true ? target : isSubtitle;
        
        if (!subtitleElement.dataset.processed) {
          enhanceSubtitleForPreciseSelection(subtitleElement);
        }
      }
    };
    
    // Handle clicks on subtitles (fallback for non-enhanced subtitles)
    subtitleClickHandler = function(e) {
      if (!isLearningEnabled) return;
      
      const target = e.target;
      
      // Skip if this is already an enhanced word span
      if (target.classList.contains('yt-word-selectable')) {
        return; // Let the word's own click handler handle it
      }
      
      const isSubtitle = target.matches('.ytp-caption-segment, .captions-text') || 
                        target.closest('.ytp-caption-segment, .captions-text');
      
      if (isSubtitle) {
        const subtitleElement = isSubtitle === true ? target : isSubtitle;
        
        // If not enhanced yet, enhance it first
        if (!subtitleElement.dataset.processed) {
          enhanceSubtitleForPreciseSelection(subtitleElement);
          return; // Let user click again on the enhanced version
        }
        
        // Fallback: analyze full text if clicked on background
        const text = subtitleElement.dataset.originalText || subtitleElement.textContent.trim();
        
        if (text && text.length > 0) {
          console.log('📺 Subtitle background clicked (full sentence):', text);
          
          e.preventDefault();
          e.stopPropagation();
          
          // Get click position
          const rect = subtitleElement.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.bottom + 10;
          
          showTextPopup(text, x, y);
        }
      }
    };
    
    // Handle mouse leave to remove hover effect
    subtitleLeaveHandler = function(e) {
      const target = e.target;
      const isSubtitle = target.matches('.ytp-caption-segment, .captions-text') || 
                        target.closest('.ytp-caption-segment, .captions-text');
      
      if (isSubtitle) {
        const subtitleElement = isSubtitle === true ? target : isSubtitle;
        subtitleElement.style.backgroundColor = '';
        subtitleElement.style.borderRadius = '';
        subtitleElement.title = '';
      }
    };
    
    document.addEventListener('mouseup', mouseUpHandler, true);
    document.addEventListener('mouseover', subtitleHoverHandler, true);
    document.addEventListener('click', subtitleClickHandler, true);
    document.addEventListener('mouseleave', subtitleLeaveHandler, true);
  }
  
  // Enhanced subtitle processing for precise word/sentence selection
  function enhanceSubtitleForPreciseSelection(subtitleElement) {
    const originalText = subtitleElement.textContent.trim();
    if (!originalText) return;
    
    console.log('🔧 Enhancing subtitle for precise selection:', originalText);
    
    // Mark as processed to avoid re-processing
    subtitleElement.dataset.processed = 'true';
    subtitleElement.dataset.originalText = originalText;
    
    // Split text into words while preserving punctuation
    const words = originalText.split(/(\s+|[.,!?;:])/);
    const validWords = words.filter(word => word.trim() && !/^\s*$/.test(word));
    
    // Clear and rebuild subtitle with enhanced word elements
    subtitleElement.innerHTML = '';
    
    validWords.forEach((word, index) => {
      if (/^\s+$/.test(word)) {
        // Just whitespace - add as text node
        subtitleElement.appendChild(document.createTextNode(word));
      } else if (/^[.,!?;:]$/.test(word.trim())) {
        // Punctuation - add as text node
        subtitleElement.appendChild(document.createTextNode(word));
      } else {
        // Actual word - create enhanced span
        const wordSpan = document.createElement('span');
        wordSpan.textContent = word;
        wordSpan.className = 'yt-word-selectable';
        wordSpan.dataset.word = word.trim();
        wordSpan.dataset.fullText = originalText;
        
        // Enhanced word styling with better visual feedback
        wordSpan.style.cssText = `
          padding: 3px 6px;
          margin: 1px 2px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          display: inline-block;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(1px);
          position: relative;
        `;
        
        // Enhanced word hover effects with better UX
        wordSpan.addEventListener('mouseenter', function() {
          this.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
          this.style.borderColor = 'rgba(255, 255, 255, 0.8)';
          this.style.transform = 'scale(1.08) translateY(-1px)';
          this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
          this.style.color = 'white';
          this.style.fontWeight = 'bold';
          
          // Enhanced tooltip with better styling
          this.title = '';
          
          // Create custom tooltip
          const tooltip = document.createElement('div');
          tooltip.className = 'yt-word-tooltip';
          tooltip.innerHTML = `
            <div style="font-size: 11px; margin-bottom: 2px;">📖 <strong>${this.dataset.word}</strong></div>
            <div style="font-size: 9px; opacity: 0.9;">Click: Single word | Ctrl+Click: Full sentence</div>
          `;
          tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
            z-index: 9999;
            margin-bottom: 5px;
            animation: tooltipFadeIn 0.2s ease-out;
          `;
          
          // Add tooltip animation
          if (!document.querySelector('#yt-tooltip-animations')) {
            const style = document.createElement('style');
            style.id = 'yt-tooltip-animations';
            style.textContent = `
              @keyframes tooltipFadeIn {
                from { opacity: 0; transform: translateX(-50%) translateY(5px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
              }
            `;
            document.head.appendChild(style);
          }
          
          this.appendChild(tooltip);
        });
        
        wordSpan.addEventListener('mouseleave', function() {
          this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          this.style.borderColor = 'transparent';
          this.style.transform = '';
          this.style.boxShadow = '';
          this.style.color = '';
          this.style.fontWeight = '';
          
          // Remove tooltip
          const tooltip = this.querySelector('.yt-word-tooltip');
          if (tooltip) {
            tooltip.remove();
          }
        });
        
        // Enhanced word click handler with success feedback
        wordSpan.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          
          let textToAnalyze;
          let selectionType;
          
          if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Click = analyze full sentence
            textToAnalyze = this.dataset.fullText;
            selectionType = 'sentence';
            console.log('📝 Full sentence selected:', textToAnalyze);
          } else {
            // Regular click = analyze single word
            textToAnalyze = this.dataset.word;
            selectionType = 'word';
            console.log('📖 Single word selected:', textToAnalyze);
          }
          
          // Add success animation to the clicked word
          this.style.animation = 'successPulse 0.6s ease-out';
          this.style.backgroundColor = 'rgba(76, 175, 80, 1)';
          
          // Add success animation to the whole subtitle
          const subtitle = this.closest('[data-processed="true"]');
          if (subtitle) {
            subtitle.classList.add('yt-subtitle-success');
            setTimeout(() => {
              subtitle.classList.remove('yt-subtitle-success');
            }, 600);
          }
          
          // Get click position for enhanced confirmation
          const rect = this.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.bottom + 10;
          
          // Show enhanced confirmation with selection type
          showEnhancedConfirmation(textToAnalyze, selectionType, x, y);
          
          // Send to sidepanel
          showTextPopup(textToAnalyze, x, y);
          
          // Reset word styling after animation
          setTimeout(() => {
            this.style.animation = '';
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }, 600);
        });
        
        subtitleElement.appendChild(wordSpan);
      }
      
      // Add space after each element except the last
      if (index < validWords.length - 1 && !(/^\s/.test(validWords[index + 1]))) {
        subtitleElement.appendChild(document.createTextNode(' '));
      }
    });
    
    // Enhanced overall subtitle styling
    subtitleElement.style.cssText += `
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(33, 33, 33, 0.8) 100%) !important;
      padding: 12px 16px !important;
      border-radius: 12px !important;
      border: 2px solid rgba(76, 175, 80, 0.6) !important;
      backdrop-filter: blur(4px) !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      position: relative !important;
      transition: all 0.3s ease !important;
      margin: 4px 0 !important;
    `;
    
    // Add enhanced visual indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      height: 3px;
      background: linear-gradient(90deg, #4CAF50, #81C784, #4CAF50);
      border-radius: 12px 12px 0 0;
      animation: shimmer 2s infinite;
    `;
    
    // Add shimmer animation
    if (!document.querySelector('#yt-subtitle-animations')) {
      const style = document.createElement('style');
      style.id = 'yt-subtitle-animations';
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        
        @keyframes successPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); border-color: rgba(76, 175, 80, 1); }
          100% { transform: scale(1); }
        }
        
        .yt-subtitle-success {
          animation: successPulse 0.6s ease-out !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    subtitleElement.insertBefore(indicator, subtitleElement.firstChild);
    
    // Add instruction tooltip for the whole subtitle with better styling
    subtitleElement.title = '🎯 Enhanced Learning Mode: Hover over individual words to select them precisely!';
  }
  
  function disableTextLearning() {
    // Remove all event handlers
    if (mouseUpHandler) {
      document.removeEventListener('mouseup', mouseUpHandler, true);
      mouseUpHandler = null;
    }
    
    if (subtitleHoverHandler) {
      document.removeEventListener('mouseover', subtitleHoverHandler, true);
      subtitleHoverHandler = null;
    }
    
    if (subtitleClickHandler) {
      document.removeEventListener('click', subtitleClickHandler, true);
      subtitleClickHandler = null;
    }
    
    if (subtitleLeaveHandler) {
      document.removeEventListener('mouseleave', subtitleLeaveHandler, true);
      subtitleLeaveHandler = null;
    }
    
    // Remove selection styles
    const styles = document.querySelector('#yt-learning-styles');
    if (styles) {
      styles.remove();
    }
    
    // Clean up enhanced subtitles
    cleanupEnhancedSubtitles();
    
    closeAllLearningPopups();
  }
  
  // Clean up enhanced subtitles and restore original text
  function cleanupEnhancedSubtitles() {
    console.log('🧹 Cleaning up enhanced subtitles...');
    
    const enhancedSubtitles = document.querySelectorAll('[data-processed="true"]');
    enhancedSubtitles.forEach(subtitle => {
      const originalText = subtitle.dataset.originalText;
      if (originalText) {
        subtitle.innerHTML = originalText;
        subtitle.style.cssText = '';
        subtitle.title = '';
        delete subtitle.dataset.processed;
        delete subtitle.dataset.originalText;
      }
    });
    
    // Remove any remaining word spans
    const wordSpans = document.querySelectorAll('.yt-word-selectable');
    wordSpans.forEach(span => span.remove());
    
    console.log('✅ Enhanced subtitles cleaned up');
  }
  
  function showTextPopup(text, x, y) {
    console.log('📨 Sending text to sidepanel:', text);
    
    // Send text to sidepanel instead of showing popup
    sendToSidepanel(text);
    
    // Show a brief confirmation that text was sent
    showBriefConfirmation(text, x, y);
  }
  
  function sendToSidepanel(text) {
    try {
      // Send message to background script to update sidepanel
      chrome.runtime.sendMessage({
        action: 'analyzeTextInSidepanel',
        text: text,
        url: window.location.href,
        title: document.title,
        source: 'youtube-learning'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('📨 Message sent via content script communication');
        } else {
          console.log('✅ Text sent to sidepanel successfully:', response);
        }
      });
    } catch (error) {
      console.error('❌ Failed to send to sidepanel:', error);
    }
  }
  
  function showBriefConfirmation(text, x, y) {
    // This is the fallback - showEnhancedConfirmation is used instead
    showEnhancedConfirmation(text, 'text', x, y);
  }
  
  function showEnhancedConfirmation(text, selectionType, x, y) {
    const confirmation = document.createElement('div');
    confirmation.className = 'yt-learning-confirmation-enhanced';
    
    const displayText = text.length > 25 ? text.substring(0, 25) + '...' : text;
    const typeIcon = selectionType === 'word' ? '📖' : selectionType === 'sentence' ? '📝' : '📨';
    const typeLabel = selectionType === 'word' ? 'Word' : selectionType === 'sentence' ? 'Sentence' : 'Text';
    
    confirmation.style.cssText = `
      position: fixed !important;
      left: ${Math.max(10, Math.min(x - 150, window.innerWidth - 320))}px !important;
      top: ${Math.max(10, Math.min(y + 15, window.innerHeight - 120))}px !important;
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%) !important;
      color: white !important;
      border-radius: 12px !important;
      padding: 16px 20px !important;
      box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4) !important;
      z-index: 2147483647 !important;
      font-family: Arial, sans-serif !important;
      font-size: 14px !important;
      max-width: 300px !important;
      text-align: center !important;
      border: 2px solid rgba(255, 255, 255, 0.3) !important;
      backdrop-filter: blur(10px) !important;
      animation: enhancedPopIn 2.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    `;
    
    confirmation.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
        <div style="font-size: 20px; margin-right: 8px;">${typeIcon}</div>
        <div style="font-weight: bold; font-size: 16px;">✅ ${typeLabel} Selected!</div>
      </div>
      <div style="background: rgba(255, 255, 255, 0.2); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: 500;">"${displayText}"</div>
      </div>
      <div style="font-size: 11px; opacity: 0.9; display: flex; align-items: center; justify-content: center;">
        <div style="margin-right: 6px;">🚀</div>
        <div>Analyzing in Sidepanel...</div>
      </div>
    `;
    
    // Add enhanced animation styles
    if (!document.querySelector('#yt-enhanced-animations')) {
      const style = document.createElement('style');
      style.id = 'yt-enhanced-animations';
      style.textContent = `
        @keyframes enhancedPopIn {
          0% { 
            opacity: 0; 
            transform: scale(0.3) translateY(-20px); 
            filter: blur(10px);
          }
          15% { 
            opacity: 1; 
            transform: scale(1.1) translateY(0); 
            filter: blur(0px);
          }
          25% { 
            transform: scale(1) translateY(0); 
          }
          85% { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
          100% { 
            opacity: 0; 
            transform: scale(0.8) translateY(-10px); 
            filter: blur(5px);
          }
        }
        
        @keyframes successPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); border-color: rgba(76, 175, 80, 1); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(confirmation);
    
    // Remove after animation completes
    setTimeout(() => {
      if (confirmation.parentElement) {
        confirmation.remove();
      }
    }, 2500);
  }
  
  function closeAllLearningPopups() {
    const popups = document.querySelectorAll('.yt-learning-popup');
    popups.forEach(popup => popup.remove());
  }
  
  // Action functions
  async function defineWord(text) {
    console.log('🔍 Defining word:', text);
    
    try {
      // Show loading message
      const loadingAlert = `🔍 Looking up "${text}"...\n\nPlease wait...`;
      
      // For single words, use dictionary API
      if (text.split(' ').length === 1) {
        try {
          const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text.toLowerCase())}`);
          
          if (response.ok) {
            const data = await response.json();
            const entry = data[0];
            
            let definition = `📖 **${entry.word}**\n\n`;
            
            if (entry.phonetics && entry.phonetics[0] && entry.phonetics[0].text) {
              definition += `🔊 Pronunciation: ${entry.phonetics[0].text}\n\n`;
            }
            
            if (entry.meanings && entry.meanings.length > 0) {
              entry.meanings.slice(0, 3).forEach((meaning, i) => {
                definition += `**${meaning.partOfSpeech}**\n`;
                if (meaning.definitions && meaning.definitions[0]) {
                  definition += `${meaning.definitions[0].definition}\n`;
                  if (meaning.definitions[0].example) {
                    definition += `Example: "${meaning.definitions[0].example}"\n`;
                  }
                }
                definition += '\n';
              });
            }
            
            alert(definition);
            closeAllLearningPopups();
            return;
          }
        } catch (apiError) {
          console.log('📝 Dictionary API failed, using fallback:', apiError);
        }
      }
      
      // Fallback definitions for common words or phrases
      const definitions = {
        'hello': 'A greeting used when meeting someone',
        'world': 'The earth and all its inhabitants',  
        'language': 'A system of communication used by people',
        'learn': 'To gain knowledge or skill by studying or experience',
        'video': 'A recording of moving visual images',
        'youtube': 'A video-sharing platform owned by Google',
        'the': 'Used to refer to one or more people or things',
        'and': 'Used to connect words or phrases together',
        'is': 'Third person singular present of "be"',
        'are': 'Present plural of "be"',
        'this': 'Used to identify something close to the speaker',
        'that': 'Used to identify something at a distance',
        'with': 'Accompanied by; in the company of',
        'for': 'In favor of; intended to belong to',
        'from': 'Indicating the point in space at which a journey begins',
        'can': 'Be able to; have the possibility of',
        'will': 'Expressing the future tense',
        'have': 'Possess, own, or hold',
        'they': 'Used to refer to two or more people',
        'we': 'Used by a speaker to refer to themselves and others',
        'you': 'Used to refer to the person being addressed',
        'it': 'Used to refer to a thing previously mentioned',
        'he': 'Used to refer to a man, boy, or male animal',
        'she': 'Used to refer to a woman, girl, or female animal'
      };
      
      const fallbackDefinition = definitions[text.toLowerCase()];
      
      if (fallbackDefinition) {
        alert(`📖 Definition of "${text}":\n\n${fallbackDefinition}\n\n💡 Basic definition provided.`);
      } else {
        alert(`📖 "${text}"\n\nSorry, no definition found for this word/phrase.\n\n💡 Try selecting individual words for better results.`);
      }
      
    } catch (error) {
      console.error('❌ Define error:', error);
      alert(`❌ Error looking up "${text}"\n\nPlease try again or check your internet connection.`);
    }
    
    closeAllLearningPopups();
  }
  
  async function translateText(text) {
    console.log('🌐 Translating text:', text);
    
    try {
      // For now, provide some basic translations to common languages
      const basicTranslations = {
        'hello': {
          'spanish': 'hola',
          'french': 'bonjour',
          'german': 'hallo',
          'chinese': '你好',
          'japanese': 'こんにちは'
        },
        'thank you': {
          'spanish': 'gracias',
          'french': 'merci',
          'german': 'danke',
          'chinese': '谢谢',
          'japanese': 'ありがとう'
        },
        'yes': {
          'spanish': 'sí',
          'french': 'oui',
          'german': 'ja',
          'chinese': '是的',
          'japanese': 'はい'
        },
        'no': {
          'spanish': 'no',
          'french': 'non',
          'german': 'nein',
          'chinese': '不',
          'japanese': 'いいえ'
        }
      };
      
      const translations = basicTranslations[text.toLowerCase()];
      
      if (translations) {
        let result = `🌐 Translations of "${text}":\n\n`;
        Object.entries(translations).forEach(([lang, trans]) => {
          result += `${lang.charAt(0).toUpperCase() + lang.slice(1)}: ${trans}\n`;
        });
        result += '\n💡 Basic translations provided.';
        alert(result);
      } else {
        alert(`🌐 Translation for "${text}"\n\nFull translation service would be available in the complete version.\n\n💡 Currently showing basic translations for common words only.`);
      }
      
    } catch (error) {
      console.error('❌ Translation error:', error);
      alert(`❌ Error translating "${text}"\n\nPlease try again.`);
    }
    
    closeAllLearningPopups();
  }
  
  function speakText(text) {
    console.log('🔊 Speaking text:', text);
    
    try {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      speechSynthesis.speak(utterance);
      
      utterance.onstart = () => console.log('🔊 Speech started');
      utterance.onend = () => console.log('✅ Speech completed');
      utterance.onerror = (e) => {
        console.error('❌ Speech error:', e);
        alert('Speech synthesis failed. Please try again.');
      };
      
    } catch (error) {
      console.error('❌ Speech synthesis error:', error);
      alert('Text-to-speech is not available in this browser.');
    }
    
    closeAllLearningPopups();
  }
  
  function saveWord(text) {
    console.log('💾 Saving word:', text);
    
    try {
      const saved = JSON.parse(localStorage.getItem('ytLearningVocab') || '[]');
      const newEntry = {
        text: text,
        date: new Date().toISOString(),
        url: window.location.href,
        title: document.title
      };
      
      // Check if already exists
      const exists = saved.some(item => item.text.toLowerCase() === text.toLowerCase());
      
      if (!exists) {
        saved.push(newEntry);
        localStorage.setItem('ytLearningVocab', JSON.stringify(saved));
        alert(`✅ "${text}" saved to vocabulary!\n\nTotal saved words: ${saved.length}\n\n💡 Your vocabulary is saved locally in your browser.`);
      } else {
        alert(`ℹ️ "${text}" is already in your vocabulary.\n\nTotal saved words: ${saved.length}`);
      }
      
    } catch (error) {
      console.error('❌ Save error:', error);
      alert('❌ Failed to save word. Please try again.');
    }
    
    closeAllLearningPopups();
  }
  
  // Initialize when page is ready
  function initializeYouTubeLearning() {
    console.log('🚀 Initializing YouTube learning...');
    
    if (!document.body) {
      console.log('⏳ Waiting for document.body...');
      setTimeout(initializeYouTubeLearning, 100);
      return;
    }
    
    const button = createYouTubeLearningButton();
    document.body.appendChild(button);
    console.log('✅ YouTube learning button added to page');
    
    // Monitor for button removal and re-add if needed
    buttonObserver = new MutationObserver(() => {
      if (!document.body.contains(button)) {
        console.log('🔄 Button was removed, re-adding...');
        document.body.appendChild(button);
      }
    });
    
    buttonObserver.observe(document.body, { childList: true, subtree: true });
    
    console.log('✅ YouTube learning system ready!');
  }
  
  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeYouTubeLearning);
  } else {
    setTimeout(initializeYouTubeLearning, 500);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (buttonObserver) {
      buttonObserver.disconnect();
    }
    if (mouseUpHandler) {
      document.removeEventListener('mouseup', mouseUpHandler, true);
    }
    if (subtitleHoverHandler) {
      document.removeEventListener('mouseover', subtitleHoverHandler, true);
    }
    if (subtitleClickHandler) {
      document.removeEventListener('click', subtitleClickHandler, true);
    }
    if (subtitleLeaveHandler) {
      document.removeEventListener('mouseleave', subtitleLeaveHandler, true);
    }
  });
  
} else {
  console.log('🚫 Not on YouTube, skipping injection');
}

console.log('🎓 YouTube Standalone Learning complete');