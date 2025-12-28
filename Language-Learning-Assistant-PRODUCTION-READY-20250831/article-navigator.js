// Article Navigator - Handles navigation back to saved article sentences
class ArticleNavigator {
  constructor() {
    this.highlightClass = 'youglish-highlight';
    this.tooltipClass = 'youglish-tooltip';
  }

  // Navigate to an article and highlight the saved sentence
  async navigateToArticle(savedItem) {
    const { url, sentence, paragraph, savedAt, notes, sentenceIndex } = savedItem;
    
    // Open article in new tab
    const tab = await chrome.tabs.create({ url });
    
    // Wait for tab to load
    const self = this;
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Inject highlighting script
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: self.highlightSavedContent,
          args: [savedItem, self.highlightClass, self.tooltipClass]
        });
      }
    });
  }

  // Function to be injected into the article page
  highlightSavedContent(savedItem, highlightClass, tooltipClass) {
    const { sentence, paragraph, savedAt, notes, sentenceIndex } = savedItem;
    
    // Remove any existing highlights and tooltips
    document.querySelectorAll(`.${highlightClass}`).forEach(el => {
      el.classList.remove(highlightClass);
    });
    document.querySelectorAll(`.${tooltipClass}`).forEach(el => {
      el.remove();
    });

    // Try to find the paragraph containing the sentence
    let targetElement = null;
    let foundExactMatch = false;

    // Strategy 1: Look for exact paragraph match
    const allTextElements = document.querySelectorAll('p, div, article, section, span, li');
    for (const element of allTextElements) {
      const elementText = element.textContent.trim();
      
      // Check for exact paragraph match
      if (elementText === paragraph) {
        targetElement = element;
        foundExactMatch = true;
        break;
      }
      
      // Check if element contains the sentence
      if (!targetElement && elementText.includes(sentence)) {
        targetElement = element;
      }
    }

    // Strategy 2: If no exact match, use fuzzy matching
    if (!targetElement) {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      let bestMatch = null;
      let bestScore = 0;

      for (const element of allTextElements) {
        const elementText = element.textContent.toLowerCase();
        let matchScore = 0;
        
        // Calculate match score based on common words
        for (const word of sentenceWords) {
          if (word.length > 3 && elementText.includes(word)) {
            matchScore++;
          }
        }
        
        if (matchScore > bestScore && matchScore >= sentenceWords.length * 0.7) {
          bestScore = matchScore;
          bestMatch = element;
        }
      }
      
      targetElement = bestMatch;
    }

    if (targetElement) {
      // Scroll to the element
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight the entire paragraph
      targetElement.classList.add(highlightClass);
      
      // Try to highlight the specific sentence within the paragraph
      if (targetElement.textContent.includes(sentence)) {
        highlightSentenceInElement(targetElement, sentence, highlightClass);
      }
      
      // Create and show tooltip
      showTooltip(targetElement, savedAt, notes, tooltipClass);
      
      // Add CSS styles
      injectStyles(highlightClass, tooltipClass);
    } else {
      // Fallback: Show a notification if content not found
      showNotFoundNotification(sentence);
    }

    // Helper function to highlight specific sentence
    function highlightSentenceInElement(element, sentence, highlightClass) {
      const html = element.innerHTML;
      const escapedSentence = sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedSentence})`, 'gi');
      
      if (regex.test(element.textContent)) {
        // Create a temporary container to manipulate HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Walk through text nodes and highlight matches
        const walker = document.createTreeWalker(
          tempDiv,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent.includes(sentence)) {
            textNodes.push(node);
          }
        }
        
        // Replace text with highlighted version
        textNodes.forEach(textNode => {
          const span = document.createElement('span');
          span.innerHTML = textNode.textContent.replace(
            regex,
            `<mark class="${highlightClass}-sentence">$1</mark>`
          );
          textNode.parentNode.replaceChild(span, textNode);
        });
        
        element.innerHTML = tempDiv.innerHTML;
      }
    }

    // Helper function to show tooltip
    function showTooltip(element, savedAt, notes, tooltipClass) {
      const tooltip = document.createElement('div');
      tooltip.className = tooltipClass;
      
      const date = new Date(savedAt).toLocaleDateString();
      const time = new Date(savedAt).toLocaleTimeString();
      
      tooltip.innerHTML = `
        <div class="tooltip-header">
          <strong>Saved on:</strong> ${date} at ${time}
        </div>
        ${notes ? `<div class="tooltip-notes"><strong>Notes:</strong> ${notes}</div>` : ''}
        <div class="tooltip-hint">Click anywhere to dismiss</div>
      `;
      
      document.body.appendChild(tooltip);
      
      // Position tooltip near the element
      const rect = element.getBoundingClientRect();
      tooltip.style.position = 'fixed';
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
      tooltip.style.left = `${rect.left}px`;
      
      // Adjust position if tooltip goes off-screen
      if (tooltip.getBoundingClientRect().top < 0) {
        tooltip.style.top = `${rect.bottom + 10}px`;
      }
      
      // Auto-hide after 10 seconds or on click
      setTimeout(() => tooltip.remove(), 10000);
      document.addEventListener('click', () => tooltip.remove(), { once: true });
    }

    // Helper function to inject CSS styles
    function injectStyles(highlightClass, tooltipClass) {
      const styleId = 'youglish-article-navigator-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .${highlightClass} {
            background-color: rgba(255, 235, 59, 0.3) !important;
            border: 2px solid #FFD54F !important;
            padding: 4px !important;
            border-radius: 4px !important;
            transition: all 0.3s ease !important;
          }
          
          .${highlightClass}-sentence {
            background-color: #FFD54F !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            font-weight: 500 !important;
          }
          
          .${tooltipClass} {
            background: rgba(33, 33, 33, 0.95) !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
            font-size: 14px !important;
            max-width: 300px !important;
            z-index: 10000 !important;
            animation: fadeIn 0.3s ease !important;
          }
          
          .${tooltipClass} .tooltip-header {
            margin-bottom: 8px !important;
          }
          
          .${tooltipClass} .tooltip-notes {
            margin-bottom: 8px !important;
            padding-top: 8px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.2) !important;
          }
          
          .${tooltipClass} .tooltip-hint {
            font-size: 12px !important;
            opacity: 0.7 !important;
            margin-top: 8px !important;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Helper function to show not found notification
    function showNotFoundNotification(sentence) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
      `;
      
      notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">Content Not Found</div>
        <div style="font-size: 14px;">The saved sentence couldn't be located in the article.</div>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
          Looking for: "${sentence.substring(0, 50)}..."
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      // Remove after 5 seconds
      setTimeout(() => notification.remove(), 5000);
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArticleNavigator;
}