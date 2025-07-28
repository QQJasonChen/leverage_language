// Article Collector Content Script
// Collects selected text from any webpage with context and metadata

(function() {
  'use strict';

  console.log('📰 Article collector content script loaded');

  // Check if we should run on this site
  const currentHost = window.location.hostname;
  if (currentHost.includes('youtube.com') || currentHost.includes('youglish.com')) {
    console.log('📰 Article collector disabled on YouTube/YouGlish');
    return;
  }

  // State management
  let state = {
    floatingButton: null,
    selectedData: null,
    isProcessing: false,
    lastSelection: '',
    selectionTimeout: null,
    paragraphMap: new Map(), // Track paragraphs by ID
    articleMetadata: null
  };

  // Create unique IDs for paragraphs
  function generateParagraphId(element, index) {
    const text = element.textContent.trim();
    // ✅ FIX: Use simple hash instead of btoa to avoid encoding issues
    let hash = 0;
    const simpleText = text.substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '');
    for (let i = 0; i < simpleText.length; i++) {
      const char = simpleText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `para-${Math.abs(hash)}-${index}-${text.length}`.substring(0, 20);
  }

  // Extract article metadata
  function extractArticleMetadata() {
    const metadata = {
      url: window.location.href,
      domain: window.location.hostname,
      pathname: window.location.pathname,
      title: '',
      author: '',
      publishDate: '',
      description: '',
      language: document.documentElement.lang || 'en',
      extractedAt: Date.now()
    };

    // Try to get title
    metadata.title = document.title || 
                    document.querySelector('h1')?.textContent?.trim() ||
                    document.querySelector('[property="og:title"]')?.getAttribute('content') ||
                    document.querySelector('[name="twitter:title"]')?.getAttribute('content') ||
                    '';

    // Try to get author
    metadata.author = document.querySelector('[name="author"]')?.getAttribute('content') ||
                     document.querySelector('[property="article:author"]')?.getAttribute('content') ||
                     document.querySelector('[rel="author"]')?.textContent?.trim() ||
                     document.querySelector('.author-name')?.textContent?.trim() ||
                     document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
                     '';

    // Try to get publish date
    metadata.publishDate = document.querySelector('[property="article:published_time"]')?.getAttribute('content') ||
                          document.querySelector('[name="publish_date"]')?.getAttribute('content') ||
                          document.querySelector('time[datetime]')?.getAttribute('datetime') ||
                          document.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
                          '';

    // Try to get description
    metadata.description = document.querySelector('[name="description"]')?.getAttribute('content') ||
                          document.querySelector('[property="og:description"]')?.getAttribute('content') ||
                          document.querySelector('[name="twitter:description"]')?.getAttribute('content') ||
                          '';

    return metadata;
  }

  // Find and tag all paragraphs on the page
  function tagParagraphs() {
    state.paragraphMap.clear();
    
    // Select common paragraph containers
    const paragraphSelectors = [
      'p',
      'article p',
      'main p',
      '[role="main"] p',
      '.content p',
      '.article-content p',
      '.post-content p',
      '.entry-content p',
      'section p'
    ];

    const paragraphs = document.querySelectorAll(paragraphSelectors.join(', '));
    
    paragraphs.forEach((p, index) => {
      // Skip empty or very short paragraphs
      if (p.textContent.trim().length < 20) return;
      
      const id = generateParagraphId(p, index);
      p.setAttribute('data-paragraph-id', id);
      
      state.paragraphMap.set(id, {
        element: p,
        index: index,
        text: p.textContent.trim(),
        html: p.innerHTML
      });
    });

    console.log(`📰 Tagged ${state.paragraphMap.size} paragraphs`);
  }

  // Find the paragraph containing the selection
  function findContainingParagraph(selection) {
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;
    
    // If it's a text node, get its parent element
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }

    // Walk up the DOM tree to find a paragraph
    while (element && element !== document.body) {
      if (element.hasAttribute('data-paragraph-id')) {
        return {
          id: element.getAttribute('data-paragraph-id'),
          element: element,
          data: state.paragraphMap.get(element.getAttribute('data-paragraph-id'))
        };
      }
      element = element.parentElement;
    }

    // If no tagged paragraph found, try to find any paragraph element
    element = range.commonAncestorContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }

    while (element && element !== document.body) {
      if (element.tagName && element.tagName.toLowerCase() === 'p') {
        // Create a temporary ID for this paragraph
        const tempId = 'temp-' + generateParagraphId(element, -1);
        element.setAttribute('data-paragraph-id', tempId);
        
        const paragraphData = {
          element: element,
          index: -1,
          text: element.textContent.trim(),
          html: element.innerHTML
        };
        
        state.paragraphMap.set(tempId, paragraphData);
        
        return {
          id: tempId,
          element: element,
          data: paragraphData
        };
      }
      element = element.parentElement;
    }

    return null;
  }

  // Get surrounding context (previous and next paragraphs)
  function getSurroundingContext(paragraphId) {
    const context = {
      previous: null,
      next: null
    };

    const paragraph = state.paragraphMap.get(paragraphId);
    if (!paragraph) return context;

    // Try to find previous paragraph
    let prevElement = paragraph.element.previousElementSibling;
    while (prevElement) {
      if (prevElement.hasAttribute('data-paragraph-id')) {
        const prevData = state.paragraphMap.get(prevElement.getAttribute('data-paragraph-id'));
        if (prevData) {
          context.previous = {
            id: prevElement.getAttribute('data-paragraph-id'),
            text: prevData.text
          };
          break;
        }
      }
      prevElement = prevElement.previousElementSibling;
    }

    // Try to find next paragraph
    let nextElement = paragraph.element.nextElementSibling;
    while (nextElement) {
      if (nextElement.hasAttribute('data-paragraph-id')) {
        const nextData = state.paragraphMap.get(nextElement.getAttribute('data-paragraph-id'));
        if (nextData) {
          context.next = {
            id: nextElement.getAttribute('data-paragraph-id'),
            text: nextData.text
          };
          break;
        }
      }
      nextElement = nextElement.nextElementSibling;
    }

    return context;
  }

  // Create the floating save button
  function createFloatingButton() {
    if (state.floatingButton) return state.floatingButton;

    const button = document.createElement('button');
    button.className = 'youglish-save-button';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      <span>Save</span>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .youglish-save-button {
        position: fixed;
        display: none;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 999999;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .youglish-save-button:hover {
        background: #3367d6;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateY(-1px);
      }

      .youglish-save-button:active {
        transform: translateY(0);
      }

      .youglish-save-button.saving {
        background: #34a853;
        pointer-events: none;
      }

      .youglish-save-button.saving span {
        display: none;
      }

      .youglish-save-button.saving::after {
        content: 'Saved!';
      }

      .youglish-save-button svg {
        width: 16px;
        height: 16px;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(button);
    
    state.floatingButton = button;

    // Handle button click
    button.addEventListener('click', handleSaveClick);

    return button;
  }

  // Show the floating button
  function showFloatingButton() {
    if (state.floatingButton) {
      console.log('📝 Making button visible');
      state.floatingButton.style.display = 'flex';
    }
  }

  // Hide the floating button
  function hideFloatingButton() {
    if (state.floatingButton) {
      console.log('📝 Hiding button');
      state.floatingButton.style.display = 'none';
      state.floatingButton.classList.remove('saving');
    }
  }

  // Position the floating button near the selection
  function positionFloatingButton(selection) {
    if (!state.floatingButton || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate position
    const button = state.floatingButton;
    const buttonRect = button.getBoundingClientRect();
    
    // Position above the selection by default
    let top = rect.top + window.scrollY - buttonRect.height - 10;
    let left = rect.left + window.scrollX + (rect.width - buttonRect.width) / 2;

    // Adjust if button would be off-screen
    if (top < window.scrollY) {
      top = rect.bottom + window.scrollY + 10;
    }

    if (left < 0) {
      left = 10;
    } else if (left + buttonRect.width > window.innerWidth) {
      left = window.innerWidth - buttonRect.width - 10;
    }

    button.style.top = `${top}px`;
    button.style.left = `${left}px`;
    button.style.display = 'flex';
  }

  // (Duplicate function removed - using the one defined later)

  // Handle save button click
  async function handleSaveClick() {
    if (state.isProcessing || !state.selectedData) return;

    state.isProcessing = true;
    state.floatingButton.classList.add('saving');

    try {
      // Send the data to background script
      const response = await chrome.runtime.sendMessage({
        action: 'saveArticleSelection',
        data: state.selectedData
      });

      if (response.success) {
        console.log('📰 Selection saved successfully');
        
        // Show success state briefly
        setTimeout(() => {
          hideFloatingButton();
          state.selectedData = null;
          state.isProcessing = false;
        }, 1500);
      } else {
        throw new Error(response.error || 'Failed to save selection');
      }
    } catch (error) {
      console.error('📰 Error saving selection:', error);
      state.floatingButton.classList.remove('saving');
      state.isProcessing = false;
      
      // Show error state
      state.floatingButton.style.background = '#ea4335';
      state.floatingButton.querySelector('span').textContent = 'Error';
      
      setTimeout(() => {
        state.floatingButton.style.background = '';
        state.floatingButton.querySelector('span').textContent = 'Save';
      }, 2000);
    }
  }

  // Handle text selection
  function handleSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Clear previous timeout
    if (state.selectionTimeout) {
      clearTimeout(state.selectionTimeout);
    }

    // Hide button if no text selected
    if (!selectedText || selectedText.length < 3) {
      hideFloatingButton();
      state.selectedData = null;
      return;
    }

    // Don't show for very long selections (probably not learning content)
    if (selectedText.length > 500) {
      hideFloatingButton();
      state.selectedData = null;
      return;
    }

    // Delay showing button to avoid flickering
    state.selectionTimeout = setTimeout(() => {
      // Get paragraph and context information
      const paragraphInfo = findContainingParagraph(selection);
      const context = paragraphInfo ? getSurroundingContext(paragraphInfo.id) : null;

      // Prepare the data to save
      state.selectedData = {
        text: selectedText,
        language: state.articleMetadata?.language || document.documentElement.lang || 'en',
        metadata: state.articleMetadata,
        paragraph: paragraphInfo ? {
          id: paragraphInfo.id,
          text: paragraphInfo.data.text,
          index: paragraphInfo.data.index
        } : null,
        context: context,
        selection: {
          anchorOffset: selection.anchorOffset,
          focusOffset: selection.focusOffset,
          rangeCount: selection.rangeCount
        },
        timestamp: Date.now()
      };

      // Show the floating button
      console.log('📝 Creating and positioning floating button');
      createFloatingButton();
      showFloatingButton();
      positionFloatingButton(selection);
    }, 100);
  }

  // Initialize the collector
  function initialize() {
    // Extract metadata on page load
    state.articleMetadata = extractArticleMetadata();
    console.log('📰 Article metadata:', state.articleMetadata);

    // Tag all paragraphs
    tagParagraphs();

    // Listen for selection changes - multiple event types for better compatibility
    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', (e) => {
      // Handle keyboard selections
      if (e.shiftKey || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setTimeout(handleSelection, 50);
      }
    });

    // Hide button on click outside
    document.addEventListener('click', (event) => {
      if (event.target !== state.floatingButton && !state.floatingButton?.contains(event.target)) {
        hideFloatingButton();
      }
    });

    // Hide button on scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      hideFloatingButton();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Re-show button if there's still a selection
        const selection = window.getSelection();
        if (selection.toString().trim()) {
          handleSelection();
        }
      }, 500);
    });

    // Re-tag paragraphs if DOM changes significantly
    const observer = new MutationObserver((mutations) => {
      const shouldRetag = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 5
      );

      if (shouldRetag) {
        console.log('📰 DOM changed significantly, re-tagging paragraphs');
        tagParagraphs();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('📰 Article collector initialized');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Listen for messages from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getArticleMetadata') {
      sendResponse({
        success: true,
        metadata: state.articleMetadata,
        paragraphCount: state.paragraphMap.size
      });
      return false;
    }

    if (request.action === 'refreshArticleData') {
      state.articleMetadata = extractArticleMetadata();
      tagParagraphs();
      sendResponse({
        success: true,
        metadata: state.articleMetadata,
        paragraphCount: state.paragraphMap.size
      });
      return false;
    }
  });

})();