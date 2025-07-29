// Article Collector Content Script
// Collects selected text from any webpage with context and metadata

(function() {
  'use strict';

  console.log('📰 Article collector content script loaded on:', window.location.hostname);

  // Check if we should run on this site
  const currentHost = window.location.hostname;
  if (currentHost.includes('youtube.com') || currentHost.includes('youglish.com')) {
    console.log('📰 Article collector disabled on YouTube/YouGlish');
    return;
  }
  
  // Check for common news sites that might need special handling
  const isNewssite = currentHost.includes('cnn.com') || 
                     currentHost.includes('nhk.or.jp') ||
                     currentHost.includes('bbc.com') ||
                     currentHost.includes('nytimes.com');
  
  if (isNewssite) {
    console.log('📰 Detected news site:', currentHost);
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

  // Create the floating save button with shadow DOM fallback
  function createFloatingButton() {
    if (state.floatingButton) return state.floatingButton;

    // Check if we're on a problematic site that needs regular DOM
    const isProblematicSite = window.location.hostname.includes('notion.com') ||
                              window.location.hostname.includes('figma.com') ||
                              window.location.hostname.includes('miro.com') ||
                              window.location.hostname.includes('cnn.com') ||
                              window.location.hostname.includes('nhk.or.jp') ||
                              window.location.hostname.includes('bbc.com') ||
                              window.location.hostname.includes('nytimes.com');

    let button;
    if (isProblematicSite) {
      console.log('📝 Detected problematic site, using regular DOM button');
      button = createRegularButton();
    } else {
      // Try creating shadow DOM button first for maximum isolation
      button = createShadowButton();
      if (!button) {
        // Fallback to regular DOM with aggressive styles
        button = createRegularButton();
      }
    }
    
    state.floatingButton = button;
    return button;
  }

  // Create button using Shadow DOM for maximum CSS isolation
  function createShadowButton() {
    try {
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: transparent !important;
      `;
      
      const shadow = container.attachShadow({ mode: 'closed' });
      
      const style = document.createElement('style');
      style.textContent = `
        :host {
          all: initial !important;
          position: fixed !important;
          z-index: 2147483647 !important;
        }
        
        .save-button {
          all: initial !important;
          position: fixed !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          padding: 8px 16px !important;
          background: #4285f4 !important;
          color: white !important;
          border: none !important;
          border-radius: 20px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          box-shadow: 0 4px 20px rgba(66, 133, 244, 0.4) !important;
          z-index: 2147483647 !important;
          transition: all 0.2s ease !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          line-height: 1 !important;
          text-decoration: none !important;
          text-transform: none !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          text-align: center !important;
          vertical-align: baseline !important;
          white-space: nowrap !important;
          box-sizing: border-box !important;
          pointer-events: auto !important;
          transform: none !important;
          margin: 0 !important;
          min-width: auto !important;
          min-height: auto !important;
          max-width: none !important;
          max-height: none !important;
          width: auto !important;
          height: auto !important;
          overflow: visible !important;
          clip: auto !important;
          clip-path: none !important;
        }
        
        .save-button:hover {
          background: #3367d6;
          box-shadow: 0 6px 24px rgba(66, 133, 244, 0.5);
          transform: translateY(-2px);
        }
        
        .save-button:active {
          transform: translateY(0);
        }
        
        .save-button.saving {
          background: #34a853;
          pointer-events: none;
        }
        
        .save-button.saving span {
          display: none;
        }
        
        .save-button.saving::after {
          content: 'Saved!';
        }
        
        .save-button svg {
          width: 16px;
          height: 16px;
          pointer-events: none;
        }
        
        .save-button * {
          pointer-events: none;
        }
      `;
      
      const button = document.createElement('button');
      button.className = 'save-button';
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <span>Save</span>
      `;
      
      shadow.appendChild(style);
      shadow.appendChild(button);
      document.body.appendChild(container);
      
      // Handle button click with enhanced event handling
      button.addEventListener('click', (e) => {
        console.log('📝 Shadow button clicked');
        e.preventDefault();
        e.stopPropagation();
        handleSaveClick(e);
      });
      button.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text deselection
        e.stopPropagation();
        console.log('📝 Shadow button mousedown event');
      });
      button.addEventListener('mouseup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📝 Shadow button mouseup event');
      });
      
      // Create wrapper object that mimics regular button interface
      const shadowWrapper = {
        shadowContainer: container,
        shadowButton: button,
        style: {
          get display() { return button.style.display; },
          set display(value) { button.style.display = value; },
          get visibility() { return button.style.visibility; },
          set visibility(value) { button.style.visibility = value; },
          get opacity() { return button.style.opacity; },
          set opacity(value) { button.style.opacity = value; },
          get pointerEvents() { return button.style.pointerEvents; },
          set pointerEvents(value) { button.style.pointerEvents = value; },
          get zIndex() { return button.style.zIndex; },
          set zIndex(value) { button.style.zIndex = value; },
          get top() { return button.style.top; },
          set top(value) { button.style.top = value; },
          get left() { return button.style.left; },
          set left(value) { button.style.left = value; },
          get position() { return 'fixed'; },
          set position(value) { /* Shadow DOM position is fixed */ },
          get transition() { return button.style.transition; },
          set transition(value) { button.style.transition = value; },
          get transform() { return button.style.transform; },
          set transform(value) { button.style.transform = value; }
        },
        classList: button.classList,
        querySelector: (selector) => button.querySelector(selector),
        getBoundingClientRect: () => button.getBoundingClientRect(),
        addEventListener: (event, handler) => button.addEventListener(event, handler),
        __isShadowButton: true
      };
      
      console.log('✨ Created shadow DOM button for maximum isolation');
      return shadowWrapper;
      
    } catch (error) {
      console.log('📝 Shadow DOM creation failed:', error);
      return null;
    }
  }

  // Fallback: Create regular button with same styling as working test button
  function createRegularButton() {
    const button = document.createElement('div'); // Use div like test button
    button.className = 'youglish-save-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      <span style="margin-left: 4px;">Save</span>
    `;

    // Use same styling approach as test button (which works)
    button.style.cssText = `
      position: fixed !important;
      background: #4285f4 !important;
      color: white !important;
      padding: 8px 16px !important;
      border-radius: 20px !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      display: flex !important;
      align-items: center !important;
      visibility: visible !important;
      opacity: 1 !important;
      border: 2px solid rgba(255, 255, 255, 0.3) !important;
      box-shadow: 0 4px 20px rgba(66, 133, 244, 0.6) !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      transition: all 0.2s ease !important;
      transform: none !important;
      margin: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      text-transform: none !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      text-align: center !important;
      vertical-align: baseline !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
      width: auto !important;
      height: auto !important;
      min-width: auto !important;
      min-height: auto !important;
      max-width: none !important;
      max-height: none !important;
      overflow: visible !important;
      clip: auto !important;
      clip-path: none !important;
    `;

    // Add hover effect with event listeners (since CSS might be overridden)
    button.addEventListener('mouseenter', () => {
      button.style.background = '#3367d6 !important';
      button.style.transform = 'translateY(-2px) !important';
      button.style.boxShadow = '0 6px 24px rgba(66, 133, 244, 0.8) !important';
    });
    
    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('saving')) {
        button.style.background = '#4285f4 !important';
        button.style.transform = 'none !important';
        button.style.boxShadow = '0 4px 20px rgba(66, 133, 244, 0.6) !important';
      }
    });
    
    // Try multiple insertion methods
    try {
      document.body.appendChild(button);
      console.log('📝 Regular button added to body', {
        buttonExists: !!button,
        buttonInDOM: document.contains(button),
        buttonClassList: button.className,
        bodyChildCount: document.body.children.length
      });
    } catch (error) {
      try {
        document.documentElement.appendChild(button);
        console.log('📝 Regular button added to documentElement');
      } catch (error2) {
        document.getElementsByTagName('html')[0].appendChild(button);
        console.log('📝 Regular button added to html');
      }
    }

    // Handle button click with enhanced event handling
    button.addEventListener('click', (e) => {
      console.log('📝 Regular button clicked');
      e.preventDefault();
      e.stopPropagation();
      handleSaveClick(e);
    });
    button.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent text deselection
      e.stopPropagation();
      console.log('📝 Button mousedown event');
    });
    button.addEventListener('mouseup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📝 Button mouseup event');
    });

    // Add pointer-events to ensure clickability
    button.style.pointerEvents = 'auto !important';
    button.style.userSelect = 'none !important';

    return button;
  }

  // Show the floating button
  function showFloatingButton() {
    if (state.floatingButton) {
      console.log('📝 Making button visible');
      state.floatingButton.style.display = 'flex';
      
      // Force visibility on problematic sites
      state.floatingButton.style.visibility = 'visible';
      state.floatingButton.style.opacity = '1';
      state.floatingButton.style.pointerEvents = 'auto';
      
      // Ensure it's on top
      state.floatingButton.style.zIndex = '2147483647';
      
      // Handle shadow DOM button re-attachment
      if (state.floatingButton.__isShadowButton) {
        const container = state.floatingButton.shadowContainer;
        if (!document.contains(container)) {
          console.log('📝 Shadow button container was removed from DOM, re-adding');
          document.body.appendChild(container);
        }
      } else {
        // Regular button re-attachment
        if (!document.contains(state.floatingButton)) {
          console.log('📝 Button was removed from DOM, re-adding');
          document.body.appendChild(state.floatingButton);
        }
      }
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

  // Fix button clickability when blocked by other elements
  function fixButtonClickability(button, blockingElement, buttonRect) {
    console.log('🔧 Attempting to fix button clickability...');
    
    const actualButton = button.__isShadowButton ? button.shadowButton : button;
    
    // Method 1: Increase z-index even higher
    const maxZIndex = Math.max(
      2147483647,
      getMaxZIndexOnPage() + 1000
    );
    actualButton.style.zIndex = `${maxZIndex} !important`;
    
    // Method 2: If blocked by iframe, try to move outside iframe area
    if (blockingElement && blockingElement.tagName === 'IFRAME') {
      console.log('🔧 Button blocked by iframe, repositioning...');
      const iframeRect = blockingElement.getBoundingClientRect();
      
      // Try positioning to the right of iframe
      if (iframeRect.right + buttonRect.width < window.innerWidth) {
        actualButton.style.left = `${iframeRect.right + 10}px !important`;
      } else if (iframeRect.left - buttonRect.width > 0) {
        // Try positioning to the left of iframe
        actualButton.style.left = `${iframeRect.left - buttonRect.width - 10}px !important`;
      } else {
        // Position above iframe
        actualButton.style.top = `${Math.max(10, iframeRect.top - buttonRect.height - 10)}px !important`;
      }
    }
    
    // Method 3: Force interaction styles
    actualButton.style.pointerEvents = 'auto !important';
    actualButton.style.userSelect = 'none !important';
    actualButton.style.touchAction = 'manipulation !important';
    
    // Method 4: Add click capture to override blocking
    if (blockingElement && blockingElement !== actualButton) {
      addClickCapture(actualButton, blockingElement);
    }
    
    // Method 5: Make button bigger and more visible if still blocked
    actualButton.style.minWidth = '100px !important';
    actualButton.style.minHeight = '40px !important';
    actualButton.style.fontSize = '16px !important';
    actualButton.style.fontWeight = 'bold !important';
    actualButton.style.border = '3px solid #fff !important';
    actualButton.style.boxShadow = '0 0 20px rgba(66, 133, 244, 0.8), 0 0 40px rgba(66, 133, 244, 0.4) !important';
    
    console.log('🔧 Applied clickability fixes');
  }
  
  // Get maximum z-index on the page
  function getMaxZIndexOnPage() {
    let maxZ = 0;
    const elements = document.querySelectorAll('*');
    
    elements.forEach(el => {
      const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
      if (zIndex > maxZ) maxZ = zIndex;
    });
    
    return maxZ;
  }
  
  // Add click capture to handle blocked buttons
  function addClickCapture(button, blockingElement) {
    if (blockingElement && blockingElement.addEventListener) {
      blockingElement.addEventListener('click', (e) => {
        const buttonRect = button.getBoundingClientRect();
        const clickX = e.clientX;
        const clickY = e.clientY;
        
        // Check if click was meant for our button
        if (clickX >= buttonRect.left && clickX <= buttonRect.right &&
            clickY >= buttonRect.top && clickY <= buttonRect.bottom) {
          console.log('📝 Captured click meant for button from blocking element');
          e.preventDefault();
          e.stopPropagation();
          button.click();
          return false;
        }
      }, { capture: true, once: false });
      
      console.log('📝 Added click capture to blocking element:', blockingElement.tagName);
    }
  }

  // Position the floating button near the selection with magnetic attraction
  function positionFloatingButton(selection) {
    if (!state.floatingButton || !selection.rangeCount) {
      console.log('📝 Cannot position button - missing button or selection');
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    console.log('📝 Selection rect:', rect);

    const button = state.floatingButton;
    
    // Make button visible to measure it accurately
    button.style.display = 'flex';
    button.style.position = 'fixed';
    button.style.visibility = 'hidden';
    button.style.top = '0px';
    button.style.left = '0px';
    
    // Force reflow to get accurate dimensions
    const buttonRect = button.getBoundingClientRect();
    console.log('📝 Button dimensions:', buttonRect.width, 'x', buttonRect.height);
    
    // Enhanced positioning with magnetic attraction to selection boundaries
    let top, left;
    const margin = 8;
    const magneticThreshold = 20; // Distance for magnetic attraction
    
    // Check available space in all directions
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;
    
    // Priority positions in order of preference
    const positions = [
      // Above selection (preferred)
      {
        top: rect.top - buttonRect.height - margin,
        left: rect.left + (rect.width / 2) - (buttonRect.width / 2),
        space: spaceAbove,
        name: 'above-center'
      },
      // Below selection
      {
        top: rect.bottom + margin,
        left: rect.left + (rect.width / 2) - (buttonRect.width / 2),
        space: spaceBelow,
        name: 'below-center'
      },
      // Right side of selection
      {
        top: rect.top + (rect.height / 2) - (buttonRect.height / 2),
        left: rect.right + margin,
        space: spaceRight,
        name: 'right-center'
      },
      // Left side of selection
      {
        top: rect.top + (rect.height / 2) - (buttonRect.height / 2),
        left: rect.left - buttonRect.width - margin,
        space: spaceLeft,
        name: 'left-center'
      },
      // Above-right corner
      {
        top: rect.top - buttonRect.height - margin,
        left: rect.right - buttonRect.width,
        space: Math.min(spaceAbove, spaceRight),
        name: 'above-right'
      },
      // Above-left corner
      {
        top: rect.top - buttonRect.height - margin,
        left: rect.left,
        space: Math.min(spaceAbove, spaceLeft),
        name: 'above-left'
      }
    ];
    
    // Find best position that fits
    let bestPosition = null;
    for (const pos of positions) {
      if (pos.space >= buttonRect.height + margin * 2 || pos.space >= buttonRect.width + margin * 2) {
        // Check if position is within viewport
        if (pos.top >= 0 && pos.top + buttonRect.height <= window.innerHeight &&
            pos.left >= 0 && pos.left + buttonRect.width <= window.innerWidth) {
          bestPosition = pos;
          break;
        }
      }
    }
    
    if (bestPosition) {
      top = bestPosition.top;
      left = bestPosition.left;
      console.log('📝 Using optimal position:', bestPosition.name);
    } else {
      // Fallback: smart positioning within viewport
      top = Math.max(margin, Math.min(rect.top - buttonRect.height - margin, 
                                      window.innerHeight - buttonRect.height - margin));
      left = Math.max(margin, Math.min(rect.left + (rect.width / 2) - (buttonRect.width / 2),
                                       window.innerWidth - buttonRect.width - margin));
      console.log('📝 Using fallback position within viewport');
    }
    
    // Magnetic attraction to selection boundaries
    const distanceToRight = Math.abs(left - rect.right);
    const distanceToLeft = Math.abs(left + buttonRect.width - rect.left);
    
    if (distanceToRight < magneticThreshold && left > rect.right - magneticThreshold) {
      left = rect.right + margin;
      console.log('📝 Applied magnetic attraction to right boundary');
    } else if (distanceToLeft < magneticThreshold && left + buttonRect.width < rect.left + magneticThreshold) {
      left = rect.left - buttonRect.width - margin;
      console.log('📝 Applied magnetic attraction to left boundary');
    }
    
    // Final bounds check
    left = Math.max(margin, Math.min(left, window.innerWidth - buttonRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - buttonRect.height - margin));
    
    console.log('📝 Final position:', { top, left });
    
    // Apply position and make visible with enhanced animation
    button.style.top = `${Math.round(top)}px`;
    button.style.left = `${Math.round(left)}px`;
    button.style.visibility = 'visible';
    
    // Force visibility for problematic sites like Notion
    button.style.display = 'flex !important';
    button.style.visibility = 'visible !important';
    button.style.opacity = '1 !important';
    button.style.pointerEvents = 'auto !important';
    button.style.zIndex = '2147483647 !important';
    
    // Notion-specific fixes
    if (window.location.hostname.includes('notion.com')) {
      console.log('📝 Applying Notion-specific layering fixes');
      // Notion uses high z-indexes, so we need to be even higher
      button.style.zIndex = '2147483647 !important';
      button.style.position = 'fixed !important';
      
      // Force the button to the top of the stacking context
      if (button.parentElement && button.parentElement !== document.body) {
        button.parentElement.style.zIndex = '2147483647 !important';
      }
      
      // Add a click capture phase listener for Notion
      button.addEventListener('click', (e) => {
        console.log('📝 Notion button click captured');
        e.stopImmediatePropagation();
      }, true);
    }
    
    // Force maximum visibility - no animations that could interfere
    button.style.opacity = '1 !important';
    button.style.transform = 'none !important';
    button.style.transition = 'none !important';
    
    // Ensure button is clickable with enhanced settings
    button.style.pointerEvents = 'auto !important';
    button.style.cursor = 'pointer !important';
    button.style.userSelect = 'none !important';
    button.style.touchAction = 'manipulation !important';
    
    // Use highest possible z-index
    const maxZIndex = Math.max(2147483647, getMaxZIndexOnPage() + 1000);
    button.style.zIndex = `${maxZIndex} !important`;
    
    // Add enhanced visibility styling
    button.style.outline = '2px solid rgba(255,255,255,0.8) !important';
    button.style.outlineOffset = '2px !important';
    button.style.boxShadow = '0 0 20px rgba(66, 133, 244, 0.8), 0 0 40px rgba(66, 133, 244, 0.4), 0 0 0 1px rgba(255,255,255,0.5) !important';
    
    // Verify button is actually visible and add aggressive debugging
    setTimeout(() => {
      const actualButton = button.__isShadowButton ? button.shadowButton : button;
      const computedStyle = window.getComputedStyle(actualButton);
      const rect = actualButton.getBoundingClientRect();
      const isVisible = computedStyle.display !== 'none' && 
                       computedStyle.visibility !== 'hidden' && 
                       computedStyle.opacity !== '0';
      
      console.log('📝 Button visibility check:', {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        transform: computedStyle.transform,
        zIndex: computedStyle.zIndex,
        isVisible: isVisible,
        isShadow: button.__isShadowButton,
        rect: rect,
        hasWidth: rect.width > 0,
        hasHeight: rect.height > 0,
        inViewport: rect.top >= 0 && rect.left >= 0 && 
                   rect.bottom <= window.innerHeight && 
                   rect.right <= window.innerWidth
      });
      
      // Force extreme visibility if still not working
      if (isVisible && rect.width > 0 && rect.height > 0) {
        // Make button flash to confirm it's there
        let flashCount = 0;
        const flash = () => {
          if (flashCount < 6) {
            actualButton.style.background = flashCount % 2 === 0 ? '#ff0000 !important' : '#4285f4 !important';
            flashCount++;
            setTimeout(flash, 200);
          } else {
            actualButton.style.background = '#4285f4 !important';
            // Remove debug outline after flashing
            setTimeout(() => {
              actualButton.style.outline = 'none !important';
            }, 1000);
          }
        };
        flash();
        console.log('📝 Button should be flashing red/blue now to confirm visibility');
      }
      
      if (!isVisible && button.__isShadowButton) {
        console.log('📝 Shadow DOM button not visible, forcing regular DOM fallback');
        // Remove shadow button and create regular one
        if (button.shadowContainer) {
          button.shadowContainer.remove();
        }
        state.floatingButton = null;
        const regularButton = createRegularButton();
        state.floatingButton = regularButton;
        
        // Reposition the new button with extreme visibility
        regularButton.style.top = `${Math.round(top)}px`;
        regularButton.style.left = `${Math.round(left)}px`;
        regularButton.style.display = 'flex !important';
        regularButton.style.visibility = 'visible !important';
        regularButton.style.opacity = '1 !important';
        regularButton.style.background = '#ff0000 !important'; // Make it red for debugging
        regularButton.style.outline = '5px solid yellow !important';
        console.log('📝 Switched to regular DOM button with extreme visibility');
      }
    }, 100);
    
    // Skip animation for now - just make it immediately visible
    console.log('📝 Button should be visible now at position:', { top, left });
    
    // Test if button is truly clickable and fix if blocked
    setTimeout(() => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      
      let isClickable = false;
      if (button.__isShadowButton) {
        // For shadow DOM button, check if we hit the shadow host
        isClickable = elementAtPoint === button.shadowContainer || 
                     button.shadowContainer.contains(elementAtPoint);
      } else {
        // For regular button
        isClickable = elementAtPoint === button || button.contains(elementAtPoint);
      }
      
      console.log('📝 Button clickability test:', {
        isClickable,
        elementAtPoint: elementAtPoint?.tagName,
        elementAtPointClass: elementAtPoint?.className,
        buttonRect: rect,
        centerPoint: { x: centerX, y: centerY },
        blockingElement: elementAtPoint
      });
      
      if (!isClickable) {
        console.warn('📝 Button may not be clickable! Element at center:', elementAtPoint);
        
        // Try to fix clickability issues
        fixButtonClickability(button, elementAtPoint, rect);
      }
    }, 100);
  }

  // DEBUG: Create a test button in a fixed position
  function createTestButton() {
    const testButton = document.createElement('div');
    testButton.innerHTML = 'TEST BUTTON - YOUGLISH EXTENSION';
    testButton.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: #ff0000 !important;
      color: white !important;
      padding: 10px 20px !important;
      border-radius: 5px !important;
      z-index: 2147483647 !important;
      font-family: Arial, sans-serif !important;
      font-size: 14px !important;
      font-weight: bold !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      border: 3px solid yellow !important;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.8) !important;
      cursor: pointer !important;
      pointer-events: auto !important;
    `;
    
    testButton.addEventListener('click', () => {
      alert('Test button clicked! Extension is working.');
      testButton.remove();
    });
    
    document.body.appendChild(testButton);
    console.log('🧪 Test button created in top-right corner');
    
    // Remove test button after 10 seconds
    setTimeout(() => {
      if (document.contains(testButton)) {
        testButton.remove();
        console.log('🧪 Test button auto-removed');
      }
    }, 10000);
  }

  // (Duplicate function removed - using the one defined later)

  // Handle save button click
  async function handleSaveClick(event) {
    console.log('📰 Save button clicked');
    console.log('📰 Current state:', {
      isProcessing: state.isProcessing,
      hasSelectedData: !!state.selectedData,
      selectedText: state.selectedData?.text?.substring(0, 50) + '...'
    });
    
    if (state.isProcessing || !state.selectedData) {
      console.log('📰 Cannot save - processing or no data');
      return;
    }

    state.isProcessing = true;
    
    // Add saving state
    const buttonElement = state.floatingButton.__isShadowButton ? 
                         state.floatingButton.shadowButton : 
                         state.floatingButton;
    buttonElement.classList.add('saving');
    buttonElement.style.background = '#34a853 !important';
    const span = buttonElement.querySelector('span');
    if (span) span.textContent = 'Saving...';

    try {
      // Send the data to background script for saving
      const response = await chrome.runtime.sendMessage({
        action: 'saveArticleSelection',
        data: state.selectedData
      });

      if (response.success) {
        console.log('📰 Selection saved successfully');
        
        // No need to send separate analysis message - handleArticleTextAnalysis 
        // in background.js now handles everything including opening sidepanel
        console.log('📰 Article data sent to background for processing');
        
        // Show success state briefly
        const buttonElement = state.floatingButton.__isShadowButton ? 
                             state.floatingButton.shadowButton : 
                             state.floatingButton;
        buttonElement.style.background = '#34a853 !important';
        const span = buttonElement.querySelector('span');
        if (span) span.textContent = 'Saved!';
        
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
      const buttonElement = state.floatingButton.__isShadowButton ? 
                           state.floatingButton.shadowButton : 
                           state.floatingButton;
      buttonElement.style.background = '#ea4335 !important';
      const span = buttonElement.querySelector('span');
      if (span) span.textContent = 'Error';
      
      setTimeout(() => {
        buttonElement.style.background = '#4285f4 !important';
        if (span) span.textContent = 'Save';
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
      const detectedLanguage = state.articleMetadata?.language || 
                              document.documentElement.lang || 
                              document.querySelector('meta[http-equiv="content-language"]')?.content ||
                              'en';
                              
      state.selectedData = {
        text: selectedText,
        language: detectedLanguage.substring(0, 2), // Ensure we only use language code, not locale
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
      
      console.log('📰 Prepared selection data:', {
        text: selectedText.substring(0, 50) + '...',
        language: state.selectedData.language,
        hasMetadata: !!state.articleMetadata,
        hasParagraph: !!paragraphInfo
      });

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

    // Add keyboard shortcut for saving (Ctrl/Cmd + S)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && state.selectedData) {
        e.preventDefault();
        console.log('⌨️ Keyboard shortcut triggered for save');
        handleSaveClick();
      }
    });

    // Hide button on click outside - but only after a delay to prevent accidental hiding
    document.addEventListener('click', (event) => {
      const isButtonClick = state.floatingButton && (
        event.target === state.floatingButton ||
        (state.floatingButton.__isShadowButton && 
         state.floatingButton.shadowContainer.contains(event.target)) ||
        (!state.floatingButton.__isShadowButton && 
         state.floatingButton.contains && state.floatingButton.contains(event.target))
      );
      
      // Only hide if clicking far from the button or selected text
      if (!isButtonClick && state.selectedData) {
        // Check if click is near the selected text or button
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // Keep button visible if there's still selected text
        if (selectedText && selectedText.length >= 3) {
          return; // Don't hide the button
        }
        
        // Hide with a small delay to prevent accidental hiding
        setTimeout(() => {
          const stillSelected = window.getSelection().toString().trim();
          if (!stillSelected || stillSelected.length < 3) {
            hideFloatingButton();
          }
        }, 100);
      }
    });

    // Reposition button on scroll (don't hide it)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      // Don't hide immediately, just reposition if needed
      if (state.floatingButton && state.selectedData) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          // Re-position button if there's still a selection
          const selection = window.getSelection();
          if (selection.toString().trim()) {
            handleSelection(); // This will reposition the button
          } else {
            hideFloatingButton(); // Only hide if no selection
          }
        }, 200); // Shorter delay for better UX
      }
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

    console.log('📰 Article collector initialized with keyboard shortcut (Ctrl/Cmd+S)');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    console.log('📰 Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    console.log('📰 DOM already loaded, initializing immediately');
    // Add a small delay for news sites that might have late-loading content
    if (isNewssite) {
      console.log('📰 Adding delay for news site initialization');
      setTimeout(initialize, 1000);
    } else {
      initialize();
    }
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
    
    if (request.action === 'debugArticleCollector') {
      // Debug information for troubleshooting
      const debugInfo = {
        hostname: window.location.hostname,
        initialized: !!state.floatingButton,
        hasSelection: !!window.getSelection().toString(),
        buttonInDOM: state.floatingButton ? document.contains(state.floatingButton) : false,
        paragraphCount: state.paragraphMap.size,
        isNewssite: isNewssite,
        error: null
      };
      
      // Try to create test button if not exists
      if (!state.floatingButton) {
        try {
          createTestButton();
          debugInfo.testButtonCreated = true;
        } catch (error) {
          debugInfo.error = error.message;
        }
      }
      
      console.log('📰 Debug info:', debugInfo);
      sendResponse(debugInfo);
      return false;
    }
  });

})();