/**
 * Professional Search & Shortcuts Manager
 * Provides global search, command palette, and keyboard shortcuts like premium tools
 */

class ProfessionalSearchManager {
    constructor() {
        this.searchIndex = new Map();
        this.searchHistory = [];
        this.isSearchOpen = false;
        this.isCommandPaletteOpen = false;
        this.currentResults = [];
        this.selectedIndex = 0;
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        this.injectSearchStyles();
        this.setupKeyboardShortcuts();
        this.setupGlobalSearch();
        this.setupCommandPalette();
        this.buildSearchIndex();
        this.setupSearchObserver();
    }

    /**
     * Setup keyboard shortcuts like professional tools
     */
    setupKeyboardShortcuts() {
        // Global shortcuts
        this.registerShortcut('cmd+f', () => this.openGlobalSearch());
        this.registerShortcut('ctrl+f', () => this.openGlobalSearch());
        this.registerShortcut('cmd+k', () => this.openCommandPalette());
        this.registerShortcut('ctrl+k', () => this.openCommandPalette());
        this.registerShortcut('cmd+s', () => this.saveCurrentItem());
        this.registerShortcut('ctrl+s', () => this.saveCurrentItem());
        this.registerShortcut('cmd+/', () => this.showShortcutsHelp());
        this.registerShortcut('ctrl+/', () => this.showShortcutsHelp());
        this.registerShortcut('escape', () => this.closeAllOverlays());
        
        // Navigation shortcuts
        this.registerShortcut('cmd+1', () => this.switchToTab(0));
        this.registerShortcut('cmd+2', () => this.switchToTab(1));
        this.registerShortcut('cmd+3', () => this.switchToTab(2));
        this.registerShortcut('cmd+4', () => this.switchToTab(3));
        this.registerShortcut('cmd+5', () => this.switchToTab(4));
        this.registerShortcut('cmd+6', () => this.switchToTab(5));
        
        // Bulk operations
        this.registerShortcut('cmd+a', () => this.selectAllItems());
        this.registerShortcut('ctrl+a', () => this.selectAllItems());
        this.registerShortcut('delete', () => this.deleteSelectedItems());
        this.registerShortcut('cmd+shift+e', () => this.exportSelectedItems());
        
        // Setup global key listener
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    /**
     * Register a keyboard shortcut
     */
    registerShortcut(combination, callback) {
        this.shortcuts.set(combination.toLowerCase(), callback);
    }

    /**
     * Handle keyboard events
     */
    handleKeyDown(e) {
        // Build key combination string
        const keys = [];
        if (e.ctrlKey || e.metaKey) keys.push(e.metaKey ? 'cmd' : 'ctrl');
        if (e.shiftKey) keys.push('shift');
        if (e.altKey) keys.push('alt');
        
        // Add the main key
        if (e.key.length === 1) {
            keys.push(e.key.toLowerCase());
        } else {
            keys.push(e.key.toLowerCase());
        }
        
        const combination = keys.join('+');
        
        // Check if this combination is registered
        const callback = this.shortcuts.get(combination);
        if (callback) {
            e.preventDefault();
            e.stopPropagation();
            callback();
            return;
        }
        
        // Handle search navigation
        if (this.isSearchOpen || this.isCommandPaletteOpen) {
            this.handleSearchNavigation(e);
        }
    }

    /**
     * Handle search navigation keys
     */
    handleSearchNavigation(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateResults(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateResults(-1);
                break;
            case 'Enter':
                e.preventDefault();
                this.selectCurrentResult();
                break;
            case 'Escape':
                e.preventDefault();
                this.closeAllOverlays();
                break;
        }
    }

    /**
     * Open global search overlay
     */
    openGlobalSearch() {
        if (this.isSearchOpen) return;
        
        this.isSearchOpen = true;
        this.selectedIndex = 0;
        
        const searchHTML = `
            <div class="professional-search-overlay" id="globalSearchOverlay">
                <div class="search-container">
                    <div class="search-header">
                        <div class="search-icon">🔍</div>
                        <input type="text" 
                               class="search-input" 
                               placeholder="Search across all data... (Type to search)" 
                               id="globalSearchInput"
                               autocomplete="off">
                        <div class="search-shortcuts">
                            <span class="shortcut-hint">↑↓ navigate</span>
                            <span class="shortcut-hint">⏎ select</span>
                            <span class="shortcut-hint">esc close</span>
                        </div>
                    </div>
                    <div class="search-results" id="globalSearchResults">
                        <div class="search-recent">
                            <div class="recent-title">Recent Searches</div>
                            ${this.renderRecentSearches()}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', searchHTML);
        
        // Focus and setup input
        const input = document.getElementById('globalSearchInput');
        input.focus();
        input.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
        
        // Setup overlay click to close
        document.getElementById('globalSearchOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'globalSearchOverlay') {
                this.closeAllOverlays();
            }
        });
    }

    /**
     * Open command palette
     */
    openCommandPalette() {
        if (this.isCommandPaletteOpen) return;
        
        this.isCommandPaletteOpen = true;
        this.selectedIndex = 0;
        
        const commands = this.getAvailableCommands();
        
        const paletteHTML = `
            <div class="professional-command-palette" id="commandPaletteOverlay">
                <div class="command-container">
                    <div class="command-header">
                        <div class="command-icon">⚡</div>
                        <input type="text" 
                               class="command-input" 
                               placeholder="Type a command..." 
                               id="commandPaletteInput"
                               autocomplete="off">
                        <div class="command-shortcuts">
                            <span class="shortcut-hint">↑↓ navigate</span>
                            <span class="shortcut-hint">⏎ execute</span>
                        </div>
                    </div>
                    <div class="command-results" id="commandPaletteResults">
                        ${this.renderCommands(commands)}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', paletteHTML);
        
        // Focus and setup input
        const input = document.getElementById('commandPaletteInput');
        input.focus();
        input.addEventListener('input', (e) => this.handleCommandInput(e.target.value));
        
        // Setup overlay click to close
        document.getElementById('commandPaletteOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'commandPaletteOverlay') {
                this.closeAllOverlays();
            }
        });
    }

    /**
     * Handle search input
     */
    async handleSearchInput(query) {
        if (!query.trim()) {
            this.showRecentSearches();
            return;
        }
        
        const results = await this.performGlobalSearch(query);
        this.currentResults = results;
        this.selectedIndex = 0;
        this.renderSearchResults(results, query);
    }

    /**
     * Perform global search across all data
     */
    async performGlobalSearch(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // Search in saved reports
        const savedReports = await this.getSavedReports();
        savedReports.forEach((report, index) => {
            if (this.matchesSearch(report, lowerQuery)) {
                results.push({
                    type: 'saved-report',
                    title: report.searchText || report.text,
                    subtitle: this.getReportSubtitle(report),
                    data: report,
                    action: () => this.openSavedReport(report.id),
                    tab: 'Saved Reports',
                    icon: '💾',
                    relevance: this.calculateRelevance(report, lowerQuery)
                });
            }
        });
        
        // Search in history
        const history = await this.getSearchHistory();
        history.forEach((item, index) => {
            if (this.matchesSearch(item, lowerQuery)) {
                results.push({
                    type: 'history',
                    title: item.text || item.searchText,
                    subtitle: this.getHistorySubtitle(item),
                    data: item,
                    action: () => this.openHistoryItem(item),
                    tab: 'History',
                    icon: '📚',
                    relevance: this.calculateRelevance(item, lowerQuery)
                });
            }
        });
        
        // Search in flashcards
        const flashcards = await this.getFlashcards();
        flashcards.forEach((card, index) => {
            if (this.matchesSearch(card, lowerQuery)) {
                results.push({
                    type: 'flashcard',
                    title: card.front || card.question,
                    subtitle: card.back || card.answer,
                    data: card,
                    action: () => this.openFlashcard(card.id),
                    tab: 'Flashcards',
                    icon: '🃏',
                    relevance: this.calculateRelevance(card, lowerQuery)
                });
            }
        });
        
        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);
        
        return results.slice(0, 50); // Limit to 50 results
    }

    /**
     * Check if item matches search query
     */
    matchesSearch(item, query) {
        const searchFields = [
            item.text,
            item.searchText,
            item.analysisData,
            item.front,
            item.back,
            item.question,
            item.answer,
            item.tags?.join(' '),
            item.videoSource?.title,
            item.videoSource?.domain
        ];
        
        return searchFields.some(field => 
            field && field.toLowerCase().includes(query)
        );
    }

    /**
     * Calculate search relevance score
     */
    calculateRelevance(item, query) {
        let score = 0;
        const text = (item.text || item.searchText || '').toLowerCase();
        
        // Exact match in title gets highest score
        if (text.includes(query)) {
            score += 100;
            
            // Bonus for exact match at start
            if (text.startsWith(query)) {
                score += 50;
            }
        }
        
        // Match in analysis gets medium score
        const analysis = (item.analysisData || '').toLowerCase();
        if (analysis.includes(query)) {
            score += 25;
        }
        
        // Recent items get bonus
        if (item.timestamp) {
            const daysSince = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 20 - daysSince);
        }
        
        // Favorite items get bonus
        if (item.favorite) {
            score += 10;
        }
        
        return score;
    }

    /**
     * Render search results
     */
    renderSearchResults(results, query) {
        const resultsContainer = document.getElementById('globalSearchResults');
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <div class="no-results-title">No results found</div>
                    <div class="no-results-subtitle">Try a different search term</div>
                </div>
            `;
            return;
        }
        
        const groupedResults = this.groupResultsByType(results);
        
        let html = '';
        for (const [type, items] of groupedResults) {
            html += `
                <div class="result-group">
                    <div class="result-group-title">${this.getGroupTitle(type)} (${items.length})</div>
                    ${items.map((result, index) => this.renderSearchResult(result, index)).join('')}
                </div>
            `;
        }
        
        resultsContainer.innerHTML = html;
        this.highlightSelectedResult();
    }

    /**
     * Render individual search result
     */
    renderSearchResult(result, globalIndex) {
        return `
            <div class="search-result-item" data-index="${globalIndex}" onclick="window.professionalSearch.selectResult(${globalIndex})">
                <div class="result-icon">${result.icon}</div>
                <div class="result-content">
                    <div class="result-title">${this.highlightQuery(result.title)}</div>
                    <div class="result-subtitle">${result.subtitle}</div>
                    <div class="result-tab">${result.tab}</div>
                </div>
                <div class="result-actions">
                    <span class="result-shortcut">⏎</span>
                </div>
            </div>
        `;
    }

    /**
     * Get available commands for command palette
     */
    getAvailableCommands() {
        return [
            {
                name: 'Switch to Analysis Tab',
                description: 'Go to AI analysis view',
                action: () => this.switchToTab(0),
                icon: '📊',
                keywords: ['analysis', 'ai', 'switch', 'tab']
            },
            {
                name: 'Switch to History Tab',
                description: 'View search history',
                action: () => this.switchToTab(3),
                icon: '📚',
                keywords: ['history', 'switch', 'tab']
            },
            {
                name: 'Switch to Saved Reports',
                description: 'View saved AI reports',
                action: () => this.switchToTab(4),
                icon: '💾',
                keywords: ['saved', 'reports', 'switch', 'tab']
            },
            {
                name: 'Generate AI Analysis',
                description: 'Analyze current text with AI',
                action: () => this.triggerAIAnalysis(),
                icon: '✨',
                keywords: ['ai', 'analysis', 'generate', 'analyze']
            },
            {
                name: 'Generate Audio',
                description: 'Create audio for current text',
                action: () => this.triggerAudioGeneration(),
                icon: '🎵',
                keywords: ['audio', 'generate', 'speech', 'voice']
            },
            {
                name: 'Export All Data',
                description: 'Export all reports and history',
                action: () => this.exportAllData(),
                icon: '📥',
                keywords: ['export', 'download', 'backup', 'data']
            },
            {
                name: 'Clear History',
                description: 'Delete all search history',
                action: () => this.clearAllHistory(),
                icon: '🗑️',
                keywords: ['clear', 'delete', 'history', 'clean']
            },
            {
                name: 'Show Keyboard Shortcuts',
                description: 'Display all available shortcuts',
                action: () => this.showShortcutsHelp(),
                icon: '⌨️',
                keywords: ['shortcuts', 'keyboard', 'help', 'commands']
            }
        ];
    }

    /**
     * Handle command palette input
     */
    handleCommandInput(query) {
        const commands = this.getAvailableCommands();
        
        if (!query.trim()) {
            this.renderCommands(commands);
            return;
        }
        
        const filtered = commands.filter(cmd => 
            cmd.name.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description.toLowerCase().includes(query.toLowerCase()) ||
            cmd.keywords.some(keyword => keyword.includes(query.toLowerCase()))
        );
        
        this.currentResults = filtered;
        this.selectedIndex = 0;
        this.renderCommands(filtered);
    }

    /**
     * Render commands in palette
     */
    renderCommands(commands) {
        const resultsContainer = document.getElementById('commandPaletteResults');
        
        if (commands.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-commands">
                    <div class="no-commands-icon">⚡</div>
                    <div class="no-commands-title">No commands found</div>
                </div>
            `;
            return;
        }
        
        const html = commands.map((cmd, index) => `
            <div class="command-item" data-index="${index}" onclick="window.professionalSearch.executeCommand(${index})">
                <div class="command-icon">${cmd.icon}</div>
                <div class="command-content">
                    <div class="command-name">${cmd.name}</div>
                    <div class="command-description">${cmd.description}</div>
                </div>
                <div class="command-shortcut">⏎</div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = html;
        this.highlightSelectedResult();
    }

    /**
     * Navigate through results
     */
    navigateResults(direction) {
        this.selectedIndex += direction;
        
        if (this.selectedIndex < 0) {
            this.selectedIndex = Math.max(0, this.currentResults.length - 1);
        } else if (this.selectedIndex >= this.currentResults.length) {
            this.selectedIndex = 0;
        }
        
        this.highlightSelectedResult();
    }

    /**
     * Highlight selected result
     */
    highlightSelectedResult() {
        // Remove previous highlights
        document.querySelectorAll('.search-result-item.selected, .command-item.selected')
            .forEach(item => item.classList.remove('selected'));
        
        // Highlight current selection
        const selector = this.isCommandPaletteOpen ? '.command-item' : '.search-result-item';
        const items = document.querySelectorAll(selector);
        
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].classList.add('selected');
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Select current result
     */
    selectCurrentResult() {
        if (this.isCommandPaletteOpen) {
            this.executeCommand(this.selectedIndex);
        } else {
            this.selectResult(this.selectedIndex);
        }
    }

    /**
     * Execute command from palette
     */
    executeCommand(index) {
        const commands = this.currentResults.length > 0 ? this.currentResults : this.getAvailableCommands();
        const command = commands[index];
        
        if (command) {
            this.closeAllOverlays();
            command.action();
        }
    }

    /**
     * Select search result
     */
    selectResult(index) {
        const result = this.currentResults[index];
        
        if (result) {
            // Add to recent searches
            this.addToRecentSearches(result.title);
            
            this.closeAllOverlays();
            result.action();
        }
    }

    /**
     * Close all overlays
     */
    closeAllOverlays() {
        // Close search
        const searchOverlay = document.getElementById('globalSearchOverlay');
        if (searchOverlay) {
            searchOverlay.remove();
            this.isSearchOpen = false;
        }
        
        // Close command palette
        const commandOverlay = document.getElementById('commandPaletteOverlay');
        if (commandOverlay) {
            commandOverlay.remove();
            this.isCommandPaletteOpen = false;
        }
        
        this.currentResults = [];
        this.selectedIndex = 0;
    }

    /**
     * Show shortcuts help
     */
    showShortcutsHelp() {
        const shortcuts = [
            { keys: 'Cmd/Ctrl + F', description: 'Global Search' },
            { keys: 'Cmd/Ctrl + K', description: 'Command Palette' },
            { keys: 'Cmd/Ctrl + S', description: 'Save Current Item' },
            { keys: 'Cmd/Ctrl + /', description: 'Show This Help' },
            { keys: 'Cmd + 1-6', description: 'Switch to Tab 1-6' },
            { keys: 'Cmd/Ctrl + A', description: 'Select All Items' },
            { keys: 'Delete', description: 'Delete Selected Items' },
            { keys: 'Cmd/Ctrl + Shift + E', description: 'Export Selected' },
            { keys: 'Escape', description: 'Close Overlays' },
            { keys: '↑↓', description: 'Navigate Results' },
            { keys: 'Enter', description: 'Select/Execute' }
        ];
        
        const helpHTML = `
            <div class="shortcuts-help-overlay" onclick="this.remove()">
                <div class="shortcuts-help-container" onclick="event.stopPropagation()">
                    <div class="shortcuts-help-header">
                        <h3>Keyboard Shortcuts</h3>
                        <button class="shortcuts-close" onclick="this.closest('.shortcuts-help-overlay').remove()">✕</button>
                    </div>
                    <div class="shortcuts-help-content">
                        ${shortcuts.map(shortcut => `
                            <div class="shortcut-item">
                                <div class="shortcut-keys">${shortcut.keys}</div>
                                <div class="shortcut-description">${shortcut.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', helpHTML);
    }

    // Data fetching methods (integrate with existing data sources)
    async getSavedReports() {
        try {
            const result = await chrome.storage.local.get(['aiReports']);
            return result.aiReports || [];
        } catch (error) {
            console.error('Error fetching saved reports:', error);
            return [];
        }
    }

    async getSearchHistory() {
        try {
            const result = await chrome.storage.local.get(['searchHistory']);
            return result.searchHistory || [];
        } catch (error) {
            console.error('Error fetching search history:', error);
            return [];
        }
    }

    async getFlashcards() {
        try {
            const result = await chrome.storage.local.get(['flashcards']);
            return result.flashcards || [];
        } catch (error) {
            console.error('Error fetching flashcards:', error);
            return [];
        }
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
        if (button && button.onclick) {
            button.onclick();
        }
    }

    triggerAudioGeneration() {
        const button = document.getElementById('generateAudioBtn');
        if (button && button.onclick) {
            button.onclick();
        }
    }

    saveCurrentItem() {
        // Try to save current analysis or add to saved reports
        const saveButton = document.getElementById('manualSaveBtn') || document.getElementById('autoSaveToggleBtn');
        if (saveButton && saveButton.onclick) {
            saveButton.onclick();
        }
    }

    exportAllData() {
        const exportButton = document.getElementById('exportReportsBtn');
        if (exportButton && exportButton.onclick) {
            exportButton.onclick();
        }
    }

    clearAllHistory() {
        const clearButton = document.getElementById('clearHistoryBtn');
        if (clearButton && clearButton.onclick) {
            if (confirm('Are you sure you want to clear all history?')) {
                clearButton.onclick();
            }
        }
    }

    selectAllItems() {
        // Implement bulk selection
        window.professionalBulk?.selectAll();
    }

    deleteSelectedItems() {
        // Implement bulk deletion
        window.professionalBulk?.deleteSelected();
    }

    exportSelectedItems() {
        // Implement bulk export
        window.professionalBulk?.exportSelected();
    }

    // Utility methods
    addToRecentSearches(query) {
        this.searchHistory.unshift(query);
        this.searchHistory = this.searchHistory.slice(0, 10); // Keep last 10
    }

    renderRecentSearches() {
        if (this.searchHistory.length === 0) {
            return '<div class="no-recent">No recent searches</div>';
        }
        
        return this.searchHistory.map((search, index) => `
            <div class="recent-item" onclick="document.getElementById('globalSearchInput').value = '${search}'; window.professionalSearch.handleSearchInput('${search}')">
                <div class="recent-icon">🕒</div>
                <div class="recent-text">${search}</div>
            </div>
        `).join('');
    }

    highlightQuery(text, query = '') {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    groupResultsByType(results) {
        const groups = new Map();
        results.forEach(result => {
            if (!groups.has(result.type)) {
                groups.set(result.type, []);
            }
            groups.get(result.type).push(result);
        });
        return groups;
    }

    getGroupTitle(type) {
        const titles = {
            'saved-report': 'Saved Reports',
            'history': 'Search History',
            'flashcard': 'Flashcards'
        };
        return titles[type] || type;
    }

    getReportSubtitle(report) {
        const date = new Date(report.timestamp).toLocaleDateString();
        const language = report.language || 'Unknown';
        return `${language} • ${date}`;
    }

    getHistorySubtitle(item) {
        const date = new Date(item.timestamp).toLocaleDateString();
        const source = item.videoSource?.domain || 'Manual';
        return `${source} • ${date}`;
    }

    // Integration methods
    openSavedReport(id) {
        // Switch to saved reports tab and highlight the report
        this.switchToTab(4);
        setTimeout(() => {
            const reportElement = document.querySelector(`[data-report-id="${id}"]`);
            if (reportElement) {
                reportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                reportElement.classList.add('highlight-flash');
                setTimeout(() => reportElement.classList.remove('highlight-flash'), 2000);
            }
        }, 300);
    }

    openHistoryItem(item) {
        // Switch to history tab and highlight the item
        this.switchToTab(3);
        setTimeout(() => {
            const historyElement = document.querySelector(`[data-history-text="${item.text}"]`);
            if (historyElement) {
                historyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                historyElement.classList.add('highlight-flash');
                setTimeout(() => historyElement.classList.remove('highlight-flash'), 2000);
            }
        }, 300);
    }

    openFlashcard(id) {
        // Switch to flashcards tab and open the specific card
        this.switchToTab(5);
        setTimeout(() => {
            const cardElement = document.querySelector(`[data-card-id="${id}"]`);
            if (cardElement) {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                cardElement.classList.add('highlight-flash');
                setTimeout(() => cardElement.classList.remove('highlight-flash'), 2000);
            }
        }, 300);
    }

    // Build search index for faster searching
    buildSearchIndex() {
        // This could be enhanced with a proper search index like Fuse.js
        // For now, we'll use the direct search approach
    }

    setupSearchObserver() {
        // Observe data changes to rebuild search index
        // This would watch for new saved reports, history items, etc.
    }

    setupGlobalSearch() {
        // Setup search functionality
        window.professionalSearch = this;
    }

    /**
     * Inject search and shortcut styles
     */
    injectSearchStyles() {
        if (document.getElementById('professional-search-styles')) return;

        const styles = `
            <style id="professional-search-styles">
                /* Global Search Overlay */
                .professional-search-overlay {
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
                    animation: fadeIn 0.2s ease;
                }

                .search-container, .command-container {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 70vh;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    overflow: hidden;
                    animation: slideIn 0.3s ease;
                }

                .search-header, .command-header {
                    display: flex;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #f8f9fa;
                }

                .search-icon, .command-icon {
                    font-size: 20px;
                    margin-right: 12px;
                    color: #1976d2;
                }

                .search-input, .command-input {
                    flex: 1;
                    border: none;
                    outline: none;
                    font-size: 16px;
                    background: transparent;
                    color: #212121;
                }

                .search-input::placeholder, .command-input::placeholder {
                    color: #9e9e9e;
                }

                .search-shortcuts, .command-shortcuts {
                    display: flex;
                    gap: 8px;
                    margin-left: 12px;
                }

                .shortcut-hint {
                    background: rgba(25, 118, 210, 0.1);
                    color: #1976d2;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                }

                .search-results, .command-results {
                    max-height: 50vh;
                    overflow-y: auto;
                    padding: 8px 0;
                }

                /* Search Results */
                .result-group {
                    margin-bottom: 16px;
                }

                .result-group-title {
                    padding: 8px 20px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    background: #f8f9fa;
                    border-bottom: 1px solid #e0e0e0;
                }

                .search-result-item, .command-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 20px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border-left: 3px solid transparent;
                }

                .search-result-item:hover, .command-item:hover,
                .search-result-item.selected, .command-item.selected {
                    background: #f3f7ff;
                    border-left-color: #1976d2;
                }

                .result-icon, .command-icon {
                    font-size: 18px;
                    margin-right: 12px;
                    width: 24px;
                    text-align: center;
                }

                .result-content, .command-content {
                    flex: 1;
                    min-width: 0;
                }

                .result-title, .command-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: #212121;
                    margin-bottom: 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .result-subtitle, .command-description {
                    font-size: 12px;
                    color: #666;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .result-tab {
                    font-size: 10px;
                    color: #1976d2;
                    font-weight: 500;
                    margin-top: 2px;
                }

                .result-actions {
                    margin-left: 12px;
                }

                .result-shortcut, .command-shortcut {
                    background: #e0e0e0;
                    color: #666;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                }

                /* Recent searches */
                .search-recent {
                    padding: 12px 20px;
                }

                .recent-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                }

                .recent-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 0;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border-radius: 6px;
                    padding: 8px 12px;
                    margin: 2px 0;
                }

                .recent-item:hover {
                    background: #f5f5f5;
                }

                .recent-icon {
                    font-size: 14px;
                    margin-right: 8px;
                    color: #999;
                }

                .recent-text {
                    font-size: 14px;
                    color: #424242;
                }

                /* No results states */
                .no-results, .no-commands, .no-recent {
                    text-align: center;
                    padding: 40px 20px;
                    color: #999;
                }

                .no-results-icon, .no-commands-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }

                .no-results-title, .no-commands-title {
                    font-size: 16px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                .no-results-subtitle {
                    font-size: 14px;
                }

                /* Command Palette */
                .professional-command-palette {
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
                    padding-top: 15vh;
                    animation: fadeIn 0.2s ease;
                }

                /* Shortcuts Help */
                .shortcuts-help-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease;
                }

                .shortcuts-help-container {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    overflow: hidden;
                    animation: slideIn 0.3s ease;
                }

                .shortcuts-help-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #f8f9fa;
                }

                .shortcuts-help-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #212121;
                }

                .shortcuts-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    color: #666;
                }

                .shortcuts-close:hover {
                    background: #e0e0e0;
                    color: #212121;
                }

                .shortcuts-help-content {
                    padding: 20px;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .shortcut-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid #f0f0f0;
                }

                .shortcut-item:last-child {
                    border-bottom: none;
                }

                .shortcut-keys {
                    font-family: Monaco, 'Courier New', monospace;
                    background: #f5f5f5;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #424242;
                    border: 1px solid #e0e0e0;
                }

                .shortcut-description {
                    font-size: 14px;
                    color: #424242;
                    flex: 1;
                    margin-left: 16px;
                }

                /* Highlight animations */
                .highlight-flash {
                    animation: highlightFlash 2s ease;
                }

                @keyframes highlightFlash {
                    0% { background-color: rgba(25, 118, 210, 0.3); }
                    100% { background-color: transparent; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from { 
                        opacity: 0; 
                        transform: translateY(-20px) scale(0.95); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1); 
                    }
                }

                /* Search highlighting */
                mark {
                    background-color: rgba(25, 118, 210, 0.2);
                    padding: 1px 2px;
                    border-radius: 2px;
                    font-weight: 500;
                }

                /* Scrollbar for search results */
                .search-results::-webkit-scrollbar,
                .command-results::-webkit-scrollbar,
                .shortcuts-help-content::-webkit-scrollbar {
                    width: 6px;
                }

                .search-results::-webkit-scrollbar-track,
                .command-results::-webkit-scrollbar-track,
                .shortcuts-help-content::-webkit-scrollbar-track {
                    background: #f5f5f5;
                }

                .search-results::-webkit-scrollbar-thumb,
                .command-results::-webkit-scrollbar-thumb,
                .shortcuts-help-content::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 3px;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// Initialize professional search manager
document.addEventListener('DOMContentLoaded', () => {
    new ProfessionalSearchManager();
});