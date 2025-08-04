/**
 * Optimized Professional Core
 * High-performance professional enhancements without DOM thrashing
 */

class OptimizedProfessionalCore {
    constructor() {
        this.isInitialized = false;
        this.shortcuts = new Map();
        this.searchCache = new Map();
        this.observers = [];
        this.debounceTimers = new Map();
        
        // Performance settings
        this.DEBOUNCE_DELAY = 300;
        this.CACHE_TTL = 60000; // 1 minute
        this.MAX_RESULTS = 20;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.waitForDOM();
            this.setupCore();
            this.setupKeyboardShortcuts();
            this.setupSmartSearch();
            this.setupLoadingEnhancements();
            this.injectStyles();
            
            this.isInitialized = true;
            console.log('🚀 Professional enhancements loaded successfully');
            
        } catch (error) {
            console.error('❌ Professional enhancements failed to load:', error);
        }
    }

    async waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            } else {
                resolve();
            }
        });
    }

    setupCore() {
        // Create global reference
        window.professionalCore = this;
        
        // Add professional indicator
        this.addProfessionalIndicator();
        
        // Setup cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    addProfessionalIndicator() {
        const header = document.querySelector('.header h1');
        if (header && !header.querySelector('.pro-badge')) {
            header.insertAdjacentHTML('afterend', `
                <div class="pro-badge" title="Professional mode active">
                    ⚡ PRO
                </div>
            `);
        }
    }

    /**
     * Setup lightweight keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.registerShortcut('cmd+f', () => this.openQuickSearch());
        this.registerShortcut('ctrl+f', () => this.openQuickSearch());
        this.registerShortcut('cmd+k', () => this.openCommandCenter());
        this.registerShortcut('ctrl+k', () => this.openCommandCenter());
        this.registerShortcut('cmd+/', () => this.showShortcutsHelp());
        this.registerShortcut('escape', () => this.closeOverlays());
        
        // Tab switching
        for (let i = 1; i <= 6; i++) {
            this.registerShortcut(`cmd+${i}`, () => this.switchToTab(i - 1));
        }

        // Single global keydown listener
        document.addEventListener('keydown', (e) => this.handleKeyDown(e), { passive: false });
    }

    registerShortcut(combination, callback) {
        this.shortcuts.set(combination.toLowerCase(), callback);
    }

    handleKeyDown(e) {
        const keys = [];
        if (e.ctrlKey || e.metaKey) keys.push(e.metaKey ? 'cmd' : 'ctrl');
        if (e.shiftKey) keys.push('shift');
        if (e.altKey) keys.push('alt');
        
        const mainKey = e.key.toLowerCase();
        if (mainKey !== 'control' && mainKey !== 'meta' && mainKey !== 'shift' && mainKey !== 'alt') {
            keys.push(mainKey);
        }
        
        const combination = keys.join('+');
        const callback = this.shortcuts.get(combination);
        
        if (callback) {
            e.preventDefault();
            e.stopPropagation();
            callback();
        }
    }

    /**
     * Quick Search - Lightweight global search
     */
    openQuickSearch() {
        if (document.getElementById('quickSearchOverlay')) return;
        
        const overlay = this.createOverlay('quickSearchOverlay', `
            <div class="quick-search-container">
                <div class="search-header">
                    <div class="search-icon">🔍</div>
                    <input type="text" 
                           class="search-input" 
                           placeholder="Search everything..." 
                           id="globalSearchInput"
                           autocomplete="off">
                    <div class="search-hint">⌘F</div>
                </div>
                <div class="search-results" id="quickSearchResults">
                    <div class="search-placeholder">Type to search across all your data</div>
                </div>
            </div>
        `);
        
        const input = overlay.querySelector('#globalSearchInput');
        input.focus();
        
        input.addEventListener('input', this.debounce((e) => {
            this.performQuickSearch(e.target.value);
        }, this.DEBOUNCE_DELAY));
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeOverlays();
        });
    }

    async performQuickSearch(query) {
        if (!query.trim()) {
            document.getElementById('quickSearchResults').innerHTML = 
                '<div class="search-placeholder">Type to search across all your data</div>';
            return;
        }

        const cacheKey = `search_${query.toLowerCase()}`;
        const cached = this.searchCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            this.displaySearchResults(cached.results, query);
            return;
        }

        try {
            const results = await this.searchAllData(query);
            
            // Cache results
            this.searchCache.set(cacheKey, {
                results,
                timestamp: Date.now()
            });
            
            this.displaySearchResults(results, query);
            
        } catch (error) {
            console.error('Search error:', error);
            document.getElementById('quickSearchResults').innerHTML = 
                '<div class="search-error">Search temporarily unavailable</div>';
        }
    }

    async searchAllData(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        // Search saved reports
        try {
            const reports = await this.getStorageData('aiReports');
            reports?.forEach((report, index) => {
                if (this.matchesQuery(report, lowerQuery)) {
                    results.push({
                        type: 'report',
                        title: report.searchText || 'Untitled Report',
                        subtitle: this.formatDate(report.timestamp),
                        data: report,
                        action: () => this.openReport(report.id)
                    });
                }
            });
        } catch (e) { /* Silent fail */ }
        
        // Search history
        try {
            const history = await this.getStorageData('searchHistory');
            history?.forEach((item, index) => {
                if (this.matchesQuery(item, lowerQuery)) {
                    results.push({
                        type: 'history',
                        title: item.text || item.searchText || 'Untitled',
                        subtitle: this.formatDate(item.timestamp),
                        data: item,
                        action: () => this.openHistoryItem(item)
                    });
                }
            });
        } catch (e) { /* Silent fail */ }
        
        return results.slice(0, this.MAX_RESULTS);
    }

    matchesQuery(item, query) {
        const searchFields = [
            item.text,
            item.searchText,
            item.analysisData,
            item.videoSource?.title,
            item.videoSource?.domain
        ].filter(Boolean);
        
        return searchFields.some(field => 
            field.toLowerCase().includes(query)
        );
    }

    displaySearchResults(results, query) {
        const container = document.getElementById('quickSearchResults');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <div>No results for "${query}"</div>
                </div>
            `;
            return;
        }
        
        const html = results.map((result, index) => `
            <div class="search-result" onclick="professionalCore.selectSearchResult(${index})">
                <div class="result-icon">${this.getResultIcon(result.type)}</div>
                <div class="result-content">
                    <div class="result-title">${this.highlightQuery(result.title, query)}</div>
                    <div class="result-subtitle">${result.subtitle}</div>
                </div>
                <div class="result-type">${result.type}</div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        this.currentSearchResults = results;
    }

    selectSearchResult(index) {
        const result = this.currentSearchResults?.[index];
        if (result) {
            this.closeOverlays();
            result.action();
        }
    }

    /**
     * Command Center - Quick actions
     */
    openCommandCenter() {
        if (document.getElementById('commandCenterOverlay')) return;
        
        const commands = [
            { name: 'Generate AI Analysis', icon: '🧠', action: () => this.triggerAIAnalysis() },
            { name: 'Generate Audio', icon: '🎵', action: () => this.triggerAudioGeneration() },
            { name: 'Export All Data', icon: '📥', action: () => this.exportData() },
            { name: 'Switch to Analysis', icon: '📊', action: () => this.switchToTab(0) },
            { name: 'Switch to History', icon: '📚', action: () => this.switchToTab(3) },
            { name: 'Switch to Saved Reports', icon: '💾', action: () => this.switchToTab(4) },
            { name: 'Clear All History', icon: '🗑️', action: () => this.clearHistory() },
            { name: 'Show Shortcuts', icon: '⌨️', action: () => this.showShortcutsHelp() }
        ];
        
        const overlay = this.createOverlay('commandCenterOverlay', `
            <div class="command-center-container">
                <div class="command-header">
                    <div class="command-icon">⚡</div>
                    <h3>Command Center</h3>
                    <div class="command-hint">⌘K</div>
                </div>
                <div class="command-list">
                    ${commands.map((cmd, index) => `
                        <div class="command-item" onclick="professionalCore.executeCommand(${index})">
                            <div class="cmd-icon">${cmd.icon}</div>
                            <div class="cmd-name">${cmd.name}</div>
                            <div class="cmd-shortcut">⏎</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
        
        this.currentCommands = commands;
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeOverlays();
        });
    }

    executeCommand(index) {
        const command = this.currentCommands?.[index];
        if (command) {
            this.closeOverlays();
            command.action();
        }
    }

    /**
     * Smart Loading States - Minimal DOM manipulation
     */
    setupLoadingEnhancements() {
        // Override common loading scenarios with lightweight versions
        this.enhanceExistingButtons();
    }

    enhanceExistingButtons() {
        // Find and enhance key buttons without heavy observation
        const buttons = {
            'generateAiAnalysisBtn': { text: 'Analyzing...', icon: '🧠' },
            'generateAudioBtn': { text: 'Generating...', icon: '🎵' },
            'manualSearchBtn': { text: 'Searching...', icon: '🔍' }
        };
        
        Object.entries(buttons).forEach(([id, config]) => {
            const button = document.getElementById(id);
            if (button && !button.dataset.enhanced) {
                button.dataset.enhanced = 'true';
                this.enhanceButton(button, config);
            }
        });
    }

    enhanceButton(button, config) {
        const originalClick = button.onclick;
        const originalText = button.textContent;
        
        button.onclick = function(e) {
            // Show loading state
            button.classList.add('loading');
            button.textContent = `${config.icon} ${config.text}`;
            button.disabled = true;
            
            // Call original function
            if (originalClick) {
                originalClick.call(this, e);
            }
            
            // Reset after 5 seconds (fallback)
            setTimeout(() => {
                button.classList.remove('loading');
                button.textContent = originalText;
                button.disabled = false;
            }, 5000);
        };
    }

    /**
     * Utility Methods
     */
    createOverlay(id, content) {
        this.closeOverlays(); // Close any existing overlays first
        
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'professional-overlay';
        overlay.innerHTML = content;
        
        document.body.appendChild(overlay);
        
        // Trigger animation
        requestAnimationFrame(() => overlay.classList.add('show'));
        
        return overlay;
    }

    closeOverlays() {
        const overlays = document.querySelectorAll('.professional-overlay');
        overlays.forEach(overlay => {
            overlay.classList.add('hide');
            setTimeout(() => overlay.remove(), 200);
        });
    }

    async getStorageData(key) {
        try {
            const result = await chrome.storage.local.get([key]);
            return result[key] || [];
        } catch (error) {
            console.error(`Error getting ${key}:`, error);
            return [];
        }
    }

    debounce(func, delay) {
        return (...args) => {
            const key = func.toString();
            clearTimeout(this.debounceTimers.get(key));
            this.debounceTimers.set(key, setTimeout(() => func.apply(this, args), delay));
        };
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        return new Date(timestamp).toLocaleDateString();
    }

    highlightQuery(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    getResultIcon(type) {
        const icons = {
            report: '💾',
            history: '📚',
            flashcard: '🃏'
        };
        return icons[type] || '📄';
    }

    // Action methods
    switchToTab(index) {
        const tabs = document.querySelectorAll('.view-button');
        if (tabs[index]) {
            tabs[index].click();
        }
    }

    triggerAIAnalysis() {
        const button = document.getElementById('generateAiAnalysisBtn');
        if (button?.onclick) button.onclick();
    }

    triggerAudioGeneration() {
        const button = document.getElementById('generateAudioBtn');
        if (button?.onclick) button.onclick();
    }

    exportData() {
        const button = document.getElementById('exportReportsBtn');
        if (button?.onclick) button.onclick();
    }

    clearHistory() {
        if (confirm('Clear all search history?')) {
            const button = document.getElementById('clearHistoryBtn');
            if (button?.onclick) button.onclick();
        }
    }

    openReport(id) {
        this.switchToTab(4); // Saved reports tab
        setTimeout(() => {
            const element = document.querySelector(`[data-report-id="${id}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
                element.classList.add('highlight-flash');
                setTimeout(() => element.classList.remove('highlight-flash'), 2000);
            }
        }, 300);
    }

    openHistoryItem(item) {
        this.switchToTab(3); // History tab
        setTimeout(() => {
            // Find and highlight the history item
            const historyItems = document.querySelectorAll('.history-item');
            for (const element of historyItems) {
                if (element.textContent.includes(item.text || item.searchText)) {
                    element.scrollIntoView({ behavior: 'smooth' });
                    element.classList.add('highlight-flash');
                    setTimeout(() => element.classList.remove('highlight-flash'), 2000);
                    break;
                }
            }
        }, 300);
    }

    showShortcutsHelp() {
        const shortcuts = [
            { keys: '⌘F', desc: 'Global Search' },
            { keys: '⌘K', desc: 'Command Center' },
            { keys: '⌘1-6', desc: 'Switch Tabs' },
            { keys: '⌘/', desc: 'Show Shortcuts' },
            { keys: 'Esc', desc: 'Close Overlays' }
        ];
        
        const overlay = this.createOverlay('shortcutsOverlay', `
            <div class="shortcuts-container">
                <div class="shortcuts-header">
                    <h3>⌨️ Keyboard Shortcuts</h3>
                </div>
                <div class="shortcuts-list">
                    ${shortcuts.map(s => `
                        <div class="shortcut-row">
                            <div class="shortcut-keys">${s.keys}</div>
                            <div class="shortcut-desc">${s.desc}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeOverlays();
        });
    }

    cleanup() {
        // Clean up timers and observers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.observers.forEach(observer => observer.disconnect());
        this.searchCache.clear();
    }

    /**
     * Inject optimized styles
     */
    injectStyles() {
        if (document.getElementById('optimized-professional-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'optimized-professional-styles';
        styles.textContent = `
            /* Professional Badge */
            .pro-badge {
                position: absolute;
                top: 8px;
                right: 16px;
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: bold;
                letter-spacing: 0.5px;
                animation: glow 2s ease-in-out infinite alternate;
            }

            @keyframes glow {
                from { box-shadow: 0 0 5px rgba(76, 175, 80, 0.5); }
                to { box-shadow: 0 0 15px rgba(76, 175, 80, 0.8); }
            }

            /* Professional Overlays */
            .professional-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                z-index: 10000;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 10vh;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .professional-overlay.show {
                opacity: 1;
            }

            .professional-overlay.hide {
                opacity: 0;
            }

            /* Quick Search */
            .quick-search-container {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                max-height: 70vh;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                transform: translateY(-20px);
                transition: transform 0.3s ease;
            }

            .professional-overlay.show .quick-search-container {
                transform: translateY(0);
            }

            .search-header {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
            }

            .search-icon {
                font-size: 18px;
                margin-right: 12px;
                color: #1976d2;
            }

            .search-input {
                flex: 1;
                border: none;
                outline: none;
                font-size: 16px;
                background: transparent;
                color: #212121;
            }

            .search-hint {
                background: rgba(25, 118, 210, 0.1);
                color: #1976d2;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-family: monospace;
            }

            .search-results {
                max-height: 50vh;
                overflow-y: auto;
                padding: 8px 0;
            }

            .search-placeholder, .search-error, .no-results {
                text-align: center;
                padding: 40px 20px;
                color: #666;
            }

            .no-results-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }

            .search-result {
                display: flex;
                align-items: center;
                padding: 12px 20px;
                cursor: pointer;
                transition: background 0.15s ease;
                border-left: 3px solid transparent;
            }

            .search-result:hover {
                background: #f3f7ff;
                border-left-color: #1976d2;
            }

            .result-icon {
                font-size: 16px;
                margin-right: 12px;
                width: 20px;
                text-align: center;
            }

            .result-content {
                flex: 1;
                min-width: 0;
            }

            .result-title {
                font-size: 14px;
                font-weight: 500;
                color: #212121;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .result-subtitle {
                font-size: 12px;
                color: #666;
            }

            .result-type {
                font-size: 10px;
                color: #1976d2;
                text-transform: uppercase;
                font-weight: 500;
                padding: 2px 6px;
                background: rgba(25, 118, 210, 0.1);
                border-radius: 4px;
            }

            /* Command Center */
            .command-center-container {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                transform: translateY(-20px);
                transition: transform 0.3s ease;
            }

            .professional-overlay.show .command-center-container {
                transform: translateY(0);
            }

            .command-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px;
                background: linear-gradient(135deg, #1976d2, #1565c0);
                color: white;
            }

            .command-icon {
                font-size: 20px;
                margin-right: 12px;
            }

            .command-header h3 {
                margin: 0;
                flex: 1;
                font-size: 18px;
            }

            .command-hint {
                background: rgba(255, 255, 255, 0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-family: monospace;
            }

            .command-list {
                padding: 12px 0;
            }

            .command-item {
                display: flex;
                align-items: center;
                padding: 12px 20px;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .command-item:hover {
                background: #f3f7ff;
                transform: translateX(4px);
            }

            .cmd-icon {
                font-size: 16px;
                margin-right: 12px;
                width: 20px;
                text-align: center;
            }

            .cmd-name {
                flex: 1;
                font-size: 14px;
                color: #212121;
            }

            .cmd-shortcut {
                font-size: 10px;
                color: #666;
                background: #f0f0f0;
                padding: 2px 6px;
                border-radius: 4px;
            }

            /* Shortcuts Help */
            .shortcuts-container {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            }

            .shortcuts-header {
                padding: 20px;
                background: #f8f9fa;
                border-bottom: 1px solid #e0e0e0;
            }

            .shortcuts-header h3 {
                margin: 0;
                color: #212121;
                font-size: 18px;
            }

            .shortcuts-list {
                padding: 20px;
            }

            .shortcut-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }

            .shortcut-row:last-child {
                border-bottom: none;
            }

            .shortcut-keys {
                font-family: monospace;
                background: #f5f5f5;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                color: #424242;
                border: 1px solid #e0e0e0;
            }

            .shortcut-desc {
                font-size: 14px;
                color: #424242;
            }

            /* Enhanced Loading States */
            .loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }

            .loading::after {
                content: "";
                position: absolute;
                width: 16px;
                height: 16px;
                margin: auto;
                border: 2px solid transparent;
                border-top-color: #1976d2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
            }

            @keyframes spin {
                0% { transform: translateY(-50%) rotate(0deg); }
                100% { transform: translateY(-50%) rotate(360deg); }
            }

            /* Highlight Flash */
            .highlight-flash {
                animation: highlightFlash 2s ease;
            }

            @keyframes highlightFlash {
                0% { background-color: rgba(25, 118, 210, 0.3); }
                100% { background-color: transparent; }
            }

            /* Search highlighting */
            mark {
                background: rgba(25, 118, 210, 0.2);
                padding: 1px 2px;
                border-radius: 2px;
                color: inherit;
            }

            /* Scrollbar */
            .search-results::-webkit-scrollbar {
                width: 6px;
            }

            .search-results::-webkit-scrollbar-track {
                background: #f5f5f5;
            }

            .search-results::-webkit-scrollbar-thumb {
                background: #ccc;
                border-radius: 3px;
            }
        `;

        document.head.appendChild(styles);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new OptimizedProfessionalCore());
} else {
    new OptimizedProfessionalCore();
}