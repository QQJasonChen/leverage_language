/**
 * Simple Keyboard Shortcuts - Lightweight and functional
 * Only adds shortcuts without breaking existing functionality
 */

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initKeyboardShortcuts);
    } else {
        initKeyboardShortcuts();
    }
    
    function initKeyboardShortcuts() {
        console.log('🎹 Initializing keyboard shortcuts...');
        
        // Simple keyboard shortcuts without complex observers
    let shortcuts = {
        'meta+1': () => clickTab(0), // Analysis
        'meta+2': () => clickTab(1), // Video
        'meta+3': () => clickTab(2), // Websites
        'meta+4': () => clickTab(3), // History
        'meta+5': () => clickTab(4), // Saved Reports
        'meta+6': () => clickTab(5), // Flashcards
        'meta+7': () => clickTab(6), // Transcript
        'ctrl+1': () => clickTab(0),
        'ctrl+2': () => clickTab(1),
        'ctrl+3': () => clickTab(2),
        'ctrl+4': () => clickTab(3),
        'ctrl+5': () => clickTab(4),
        'ctrl+6': () => clickTab(5),
        'ctrl+7': () => clickTab(6),
        'meta+/': () => showShortcutsHelp(),
        'ctrl+/': () => showShortcutsHelp()
    };
    
        function clickTab(index) {
            console.log(`🎹 Clicking tab ${index + 1}`);
            const tabs = document.querySelectorAll('.view-button');
            console.log(`🎹 Found ${tabs.length} tabs:`, Array.from(tabs).map(tab => tab.textContent));
            
            if (tabs[index]) {
                tabs[index].click();
                console.log(`🎹 Successfully clicked tab: ${tabs[index].textContent}`);
            } else {
                console.log(`🎹 Tab ${index + 1} not found`);
            }
        }
        
        function showShortcutsHelp() {
            const helpText = `
Keyboard Shortcuts:

⌘/Ctrl + 1-7  Switch to tabs 1-7
⌘/Ctrl + /    Show this help

Available tabs:
1. Analysis
2. Video  
3. Websites
4. History
5. Saved Reports
6. Flashcards
7. Transcript
            `;
            
            alert(helpText.trim());
        }
        
        // Single keydown listener
        document.addEventListener('keydown', function(e) {
            // Don't interfere with input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            const key = [];
            if (e.ctrlKey) key.push('ctrl');
            if (e.metaKey) key.push('meta');
            if (e.shiftKey) key.push('shift');
            key.push(e.key.toLowerCase());
            
            const shortcut = key.join('+');
            const handler = shortcuts[shortcut];
            
            console.log(`🎹 Key pressed: ${shortcut}, handler found: ${!!handler}`);
            
            if (handler) {
                e.preventDefault();
                e.stopPropagation();
                handler();
            }
        });
        
        // Add subtle indicator
        addShortcutIndicator();
        
        console.log('🎹 Keyboard shortcuts initialized successfully');
    }
    
    function addShortcutIndicator() {
        if (document.querySelector('.shortcut-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'shortcut-indicator';
        indicator.innerHTML = '⌨️';
        indicator.title = 'Keyboard shortcuts available (⌘/Ctrl + /)';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 32px;
            height: 32px;
            background: rgba(37, 99, 235, 0.9);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: pointer;
            z-index: 1000;
            opacity: 0.7;
            transition: opacity 0.2s ease;
        `;
        
        indicator.addEventListener('mouseenter', () => indicator.style.opacity = '1');
        indicator.addEventListener('mouseleave', () => indicator.style.opacity = '0.7');
        indicator.addEventListener('click', () => {
            const helpText = `
Keyboard Shortcuts:

⌘/Ctrl + 1-7  Switch to tabs 1-7
⌘/Ctrl + /    Show this help

Available tabs:
1. Analysis
2. Video  
3. Websites
4. History
5. Saved Reports
6. Flashcards
7. Transcript
            `;
            alert(helpText.trim());
        });
        
        document.body.appendChild(indicator);
    }
    
})();