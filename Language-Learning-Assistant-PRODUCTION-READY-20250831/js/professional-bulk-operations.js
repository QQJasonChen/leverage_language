/**
 * Professional Bulk Operations Manager
 * Provides smart bulk selection, operations, and management like premium tools
 */

class ProfessionalBulkManager {
    constructor() {
        this.selectedItems = new Set();
        this.selectionMode = false;
        this.lastSelectedIndex = -1;
        this.currentTab = 'saved-reports'; // or 'history', 'flashcards'
        this.bulkActions = new Map();
        this.init();
    }

    init() {
        this.injectBulkStyles();
        this.setupBulkActions();
        this.observeDataChanges();
        this.setupGlobalBulkInterface();
        
        // Store reference globally
        window.professionalBulk = this;
    }

    /**
     * Enter selection mode with visual indicators
     */
    enterSelectionMode(tab = null) {
        this.selectionMode = true;
        this.currentTab = tab || this.getCurrentTab();
        this.selectedItems.clear();
        
        // Add selection UI to current tab
        this.addSelectionUI();
        
        // Add checkboxes to all items
        this.addCheckboxesToItems();
        
        // Show bulk action bar
        this.showBulkActionBar();
        
        // Add selection mode class to body
        document.body.classList.add('bulk-selection-mode');
    }

    /**
     * Exit selection mode and clean up
     */
    exitSelectionMode() {
        this.selectionMode = false;
        this.selectedItems.clear();
        this.lastSelectedIndex = -1;
        
        // Remove checkboxes
        this.removeCheckboxesFromItems();
        
        // Hide bulk action bar
        this.hideBulkActionBar();
        
        // Remove selection mode class
        document.body.classList.remove('bulk-selection-mode');
    }

    /**
     * Add selection UI elements
     */
    addSelectionUI() {
        const currentTabContent = this.getCurrentTabContent();
        if (!currentTabContent) return;

        // Add selection header if it doesn't exist
        if (!currentTabContent.querySelector('.bulk-selection-header')) {
            const headerHTML = `
                <div class="bulk-selection-header">
                    <div class="selection-info">
                        <span class="selection-count">0 items selected</span>
                        <button class="select-all-btn" onclick="window.professionalBulk.selectAll()">
                            Select All
                        </button>
                        <button class="select-none-btn" onclick="window.professionalBulk.selectNone()">
                            Clear
                        </button>
                    </div>
                    <div class="selection-actions">
                        <button class="exit-selection-btn" onclick="window.professionalBulk.exitSelectionMode()">
                            ✕ Exit Selection
                        </button>
                    </div>
                </div>
            `;
            
            currentTabContent.insertAdjacentHTML('afterbegin', headerHTML);
        }
    }

    /**
     * Add checkboxes to all selectable items
     */
    addCheckboxesToItems() {
        const items = this.getSelectableItems();
        
        items.forEach((item, index) => {
            if (!item.querySelector('.bulk-checkbox')) {
                const checkbox = this.createBulkCheckbox(index);
                item.insertAdjacentHTML('afterbegin', checkbox);
                
                // Add click handler for the entire item
                item.addEventListener('click', (e) => this.handleItemClick(e, index));
                
                // Add item selection styling
                item.classList.add('bulk-selectable');
            }
        });
    }

    /**
     * Remove checkboxes from items
     */
    removeCheckboxesFromItems() {
        const checkboxes = document.querySelectorAll('.bulk-checkbox');
        checkboxes.forEach(checkbox => checkbox.remove());
        
        const selectableItems = document.querySelectorAll('.bulk-selectable');
        selectableItems.forEach(item => {
            item.classList.remove('bulk-selectable', 'bulk-selected');
            // Remove click handlers (would need to track these separately for proper cleanup)
        });
        
        // Remove selection header
        const header = document.querySelector('.bulk-selection-header');
        if (header) header.remove();
    }

    /**
     * Create bulk checkbox HTML
     */
    createBulkCheckbox(index) {
        return `
            <div class="bulk-checkbox" data-index="${index}">
                <input type="checkbox" 
                       id="bulk-check-${index}" 
                       onchange="window.professionalBulk.toggleItem(${index}, this.checked)"
                       onclick="event.stopPropagation()">
                <label for="bulk-check-${index}" class="checkbox-label"></label>
            </div>
        `;
    }

    /**
     * Handle item click (with shift-click support)
     */
    handleItemClick(event, index) {
        if (!this.selectionMode) return;
        
        // Prevent default item actions when in selection mode
        event.preventDefault();
        event.stopPropagation();
        
        if (event.shiftKey && this.lastSelectedIndex >= 0) {
            // Shift-click: select range
            this.selectRange(this.lastSelectedIndex, index);
        } else {
            // Regular click: toggle single item
            this.toggleItem(index);
        }
        
        this.lastSelectedIndex = index;
    }

    /**
     * Toggle single item selection
     */
    toggleItem(index, forceState = null) {
        const isSelected = forceState !== null ? forceState : !this.selectedItems.has(index);
        
        if (isSelected) {
            this.selectedItems.add(index);
        } else {
            this.selectedItems.delete(index);
        }
        
        // Update checkbox state
        const checkbox = document.querySelector(`#bulk-check-${index}`);
        if (checkbox) {
            checkbox.checked = isSelected;
        }
        
        // Update item visual state
        const item = this.getSelectableItems()[index];
        if (item) {
            item.classList.toggle('bulk-selected', isSelected);
        }
        
        this.updateSelectionUI();
    }

    /**
     * Select range of items (shift-click)
     */
    selectRange(startIndex, endIndex) {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        
        for (let i = start; i <= end; i++) {
            this.toggleItem(i, true);
        }
    }

    /**
     * Select all items
     */
    selectAll() {
        const items = this.getSelectableItems();
        items.forEach((item, index) => {
            this.toggleItem(index, true);
        });
    }

    /**
     * Clear all selections
     */
    selectNone() {
        this.selectedItems.forEach(index => {
            this.toggleItem(index, false);
        });
        this.selectedItems.clear();
        this.updateSelectionUI();
    }

    /**
     * Update selection UI (count, buttons, etc.)
     */
    updateSelectionUI() {
        const count = this.selectedItems.size;
        const countElement = document.querySelector('.selection-count');
        
        if (countElement) {
            countElement.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        }
        
        // Update bulk action bar
        this.updateBulkActionBar();
        
        // Update button states
        const selectAllBtn = document.querySelector('.select-all-btn');
        const selectNoneBtn = document.querySelector('.select-none-btn');
        const totalItems = this.getSelectableItems().length;
        
        if (selectAllBtn) {
            selectAllBtn.textContent = count === totalItems ? 'All Selected' : 'Select All';
            selectAllBtn.disabled = count === totalItems;
        }
        
        if (selectNoneBtn) {
            selectNoneBtn.disabled = count === 0;
        }
    }

    /**
     * Show bulk action bar
     */
    showBulkActionBar() {
        // Remove existing bar
        const existingBar = document.querySelector('.bulk-action-bar');
        if (existingBar) existingBar.remove();
        
        const actionBarHTML = `
            <div class="bulk-action-bar">
                <div class="bulk-actions-left">
                    <span class="bulk-selection-summary">
                        <span class="selected-count">0</span> selected
                    </span>
                </div>
                <div class="bulk-actions-center">
                    ${this.renderBulkActions()}
                </div>
                <div class="bulk-actions-right">
                    <button class="bulk-action-btn secondary" onclick="window.professionalBulk.exitSelectionMode()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', actionBarHTML);
    }

    /**
     * Hide bulk action bar
     */
    hideBulkActionBar() {
        const actionBar = document.querySelector('.bulk-action-bar');
        if (actionBar) {
            actionBar.classList.add('bulk-action-bar-exit');
            setTimeout(() => actionBar.remove(), 300);
        }
    }

    /**
     * Update bulk action bar with current selection
     */
    updateBulkActionBar() {
        const selectedCount = document.querySelector('.bulk-action-bar .selected-count');
        if (selectedCount) {
            selectedCount.textContent = this.selectedItems.size;
        }
        
        // Enable/disable actions based on selection
        const actionButtons = document.querySelectorAll('.bulk-action-bar .bulk-action-btn:not(.secondary)');
        actionButtons.forEach(button => {
            button.disabled = this.selectedItems.size === 0;
        });
    }

    /**
     * Render bulk action buttons based on current tab
     */
    renderBulkActions() {
        const actions = this.getBulkActionsForTab(this.currentTab);
        
        return actions.map(action => `
            <button class="bulk-action-btn ${action.style || 'primary'}" 
                    onclick="window.professionalBulk.executeBulkAction('${action.id}')"
                    title="${action.description || action.name}">
                ${action.icon} ${action.name}
            </button>
        `).join('');
    }

    /**
     * Get available bulk actions for current tab
     */
    getBulkActionsForTab(tab) {
        const commonActions = [
            {
                id: 'export',
                name: 'Export',
                icon: '📥',
                description: 'Export selected items',
                style: 'primary'
            },
            {
                id: 'delete',
                name: 'Delete',
                icon: '🗑️',
                description: 'Delete selected items',
                style: 'danger'
            }
        ];
        
        const tabSpecificActions = {
            'saved-reports': [
                {
                    id: 'duplicate',
                    name: 'Duplicate',
                    icon: '📋',
                    description: 'Create copies of selected reports'
                },
                {
                    id: 'tag',
                    name: 'Add Tags',
                    icon: '🏷️',
                    description: 'Add tags to selected reports'
                },
                {
                    id: 'favorite',
                    name: 'Favorite',
                    icon: '⭐',
                    description: 'Mark selected reports as favorites'
                },
                {
                    id: 'create-flashcards',
                    name: 'Create Flashcards',
                    icon: '🃏',
                    description: 'Generate flashcards from selected reports'
                }
            ],
            'history': [
                {
                    id: 'reanalyze',
                    name: 'Re-analyze',
                    icon: '🔄',
                    description: 'Re-analyze selected history items'
                },
                {
                    id: 'save-reports',
                    name: 'Save as Reports',
                    icon: '💾',
                    description: 'Convert to saved reports'
                }
            ],
            'flashcards': [
                {
                    id: 'study',
                    name: 'Study Selected',
                    icon: '🎯',
                    description: 'Start study session with selected cards'
                },
                {
                    id: 'reset-progress',
                    name: 'Reset Progress',
                    icon: '↺',
                    description: 'Reset learning progress for selected cards'
                }
            ]
        };
        
        return [...(tabSpecificActions[tab] || []), ...commonActions];
    }

    /**
     * Execute bulk action
     */
    async executeBulkAction(actionId) {
        if (this.selectedItems.size === 0) {
            alert('No items selected');
            return;
        }
        
        const selectedData = this.getSelectedItemsData();
        const action = this.getBulkActionsForTab(this.currentTab).find(a => a.id === actionId) ||
                      this.getBulkActionsForTab('common').find(a => a.id === actionId);
        
        if (!action) {
            console.error('Unknown bulk action:', actionId);
            return;
        }
        
        // Show confirmation for destructive actions
        if (actionId === 'delete') {
            const confirmMessage = `Are you sure you want to delete ${this.selectedItems.size} item${this.selectedItems.size !== 1 ? 's' : ''}?`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        // Show progress for long operations
        const loadingId = window.professionalLoading?.showIntelligentLoading(
            'bulk-operation-result',
            `bulk-${actionId}`,
            {
                showSteps: true,
                showProgress: true
            }
        );
        
        try {
            await this.performBulkAction(actionId, selectedData);
            
            // Show success message
            this.showBulkActionResult('success', `${action.name} completed successfully`);
            
            // Refresh current tab data
            this.refreshCurrentTab();
            
            // Exit selection mode after successful action
            if (['delete', 'export'].includes(actionId)) {
                this.exitSelectionMode();
            }
            
        } catch (error) {
            console.error('Bulk action failed:', error);
            this.showBulkActionResult('error', `${action.name} failed: ${error.message}`);
        } finally {
            if (loadingId) {
                window.professionalLoading?.hideLoading(loadingId, 'success');
            }
        }
    }

    /**
     * Perform the actual bulk action
     */
    async performBulkAction(actionId, selectedData) {
        switch (actionId) {
            case 'export':
                await this.exportItems(selectedData);
                break;
                
            case 'delete':
                await this.deleteItems(selectedData);
                break;
                
            case 'duplicate':
                await this.duplicateItems(selectedData);
                break;
                
            case 'tag':
                await this.tagItems(selectedData);
                break;
                
            case 'favorite':
                await this.favoriteItems(selectedData);
                break;
                
            case 'create-flashcards':
                await this.createFlashcardsFromItems(selectedData);
                break;
                
            case 'reanalyze':
                await this.reanalyzeItems(selectedData);
                break;
                
            case 'save-reports':
                await this.saveAsReports(selectedData);
                break;
                
            case 'study':
                await this.studyFlashcards(selectedData);
                break;
                
            case 'reset-progress':
                await this.resetFlashcardProgress(selectedData);
                break;
                
            default:
                throw new Error(`Unknown action: ${actionId}`);
        }
    }

    // Bulk action implementations
    async exportItems(items) {
        const exportData = {
            type: this.currentTab,
            count: items.length,
            timestamp: new Date().toISOString(),
            data: items
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentTab}-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async deleteItems(items) {
        // This would integrate with the existing deletion functions
        for (const item of items) {
            if (this.currentTab === 'saved-reports') {
                // Call existing delete function
                if (window.deleteSavedReport) {
                    await window.deleteSavedReport(item.id);
                }
            } else if (this.currentTab === 'history') {
                // Delete from history
                // Implementation would depend on existing history management
            }
        }
    }

    async duplicateItems(items) {
        // Create copies of selected reports
        for (const item of items) {
            const duplicate = {
                ...item,
                id: `${item.id}_copy_${Date.now()}`,
                timestamp: Date.now(),
                searchText: `${item.searchText} (Copy)`
            };
            
            // Add to storage
            const reports = await this.getSavedReports();
            reports.unshift(duplicate);
            await chrome.storage.local.set({ aiReports: reports });
        }
    }

    async tagItems(items) {
        const tags = prompt('Enter tags (comma-separated):');
        if (!tags) return;
        
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        for (const item of items) {
            item.tags = [...(item.tags || []), ...tagArray];
            // Update in storage
            // Implementation would depend on existing data management
        }
    }

    async favoriteItems(items) {
        for (const item of items) {
            item.favorite = true;
            // Update in storage
            // Implementation would depend on existing data management
        }
    }

    async createFlashcardsFromItems(items) {
        const flashcards = [];
        
        for (const item of items) {
            // Extract key information for flashcard creation
            const front = item.searchText || item.text;
            const back = this.extractAnalysisForFlashcard(item.analysisData);
            
            if (front && back) {
                flashcards.push({
                    id: `fc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    front,
                    back,
                    language: item.language,
                    createdFrom: 'bulk-operation',
                    sourceReportId: item.id,
                    timestamp: Date.now(),
                    difficulty: 0,
                    nextReview: Date.now() + 24 * 60 * 60 * 1000 // 1 day
                });
            }
        }
        
        if (flashcards.length > 0) {
            const existingFlashcards = await this.getFlashcards();
            existingFlashcards.push(...flashcards);
            await chrome.storage.local.set({ flashcards: existingFlashcards });
        }
    }

    // Utility methods
    getCurrentTab() {
        const activeTab = document.querySelector('.view-button.active');
        if (!activeTab) return 'saved-reports';
        
        const tabText = activeTab.textContent.toLowerCase();
        if (tabText.includes('saved') || tabText.includes('已保存')) return 'saved-reports';
        if (tabText.includes('history') || tabText.includes('歷史')) return 'history';
        if (tabText.includes('flashcard') || tabText.includes('記憶卡')) return 'flashcards';
        
        return 'saved-reports';
    }

    getCurrentTabContent() {
        const tab = this.getCurrentTab();
        const selectors = {
            'saved-reports': '#saved-reports-content, .saved-reports-section',
            'history': '#history-content, .history-section',
            'flashcards': '#flashcards-content, .flashcards-section'
        };
        
        return document.querySelector(selectors[tab] || '.content-area:not([style*="display: none"])');
    }

    getSelectableItems() {
        const tab = this.getCurrentTab();
        const selectors = {
            'saved-reports': '.report-item, .saved-report-item',
            'history': '.history-item',
            'flashcards': '.flashcard-item'
        };
        
        return Array.from(document.querySelectorAll(selectors[tab] || '.report-item'));
    }

    getSelectedItemsData() {
        const items = this.getSelectableItems();
        const selectedData = [];
        
        this.selectedItems.forEach(index => {
            const item = items[index];
            if (item) {
                // Extract data from DOM element
                const data = this.extractItemData(item);
                if (data) {
                    selectedData.push(data);
                }
            }
        });
        
        return selectedData;
    }

    extractItemData(element) {
        // This would extract data based on the element structure
        // For now, return a basic structure
        return {
            id: element.dataset.reportId || element.dataset.itemId,
            text: element.querySelector('.report-text, .history-text, .flashcard-front')?.textContent,
            timestamp: Date.now()
        };
    }

    showBulkActionResult(type, message) {
        const resultHTML = `
            <div class="bulk-action-result ${type}">
                <div class="result-icon">${type === 'success' ? '✅' : '⚠️'}</div>
                <div class="result-message">${message}</div>
            </div>
        `;
        
        // Show temporary notification
        const notification = document.createElement('div');
        notification.innerHTML = resultHTML;
        notification.className = 'bulk-notification';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    refreshCurrentTab() {
        // Trigger refresh of current tab data
        const tab = this.getCurrentTab();
        
        if (tab === 'saved-reports' && window.loadSavedReports) {
            window.loadSavedReports();
        } else if (tab === 'history' && window.loadHistory) {
            window.loadHistory();
        } else if (tab === 'flashcards' && window.loadFlashcards) {
            window.loadFlashcards();
        }
    }

    // Data access methods
    async getSavedReports() {
        const result = await chrome.storage.local.get(['aiReports']);
        return result.aiReports || [];
    }

    async getFlashcards() {
        const result = await chrome.storage.local.get(['flashcards']);
        return result.flashcards || [];
    }

    extractAnalysisForFlashcard(analysisData) {
        if (!analysisData) return '';
        
        if (typeof analysisData === 'string') {
            // Extract key points from analysis text
            const lines = analysisData.split('\n').filter(line => line.trim());
            return lines.slice(0, 3).join('\n'); // First 3 key points
        }
        
        return analysisData.summary || analysisData.translation || '';
    }

    // Setup methods
    setupBulkActions() {
        // Add bulk selection toggle to each tab
        this.addBulkToggleButtons();
    }

    addBulkToggleButtons() {
        // Add bulk selection buttons to tabs that support it
        const supportedTabs = ['saved-reports', 'history', 'flashcards'];
        
        supportedTabs.forEach(tab => {
            const observer = new MutationObserver(() => {
                this.addBulkToggleToTab(tab);
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    addBulkToggleToTab(tab) {
        const tabContent = this.getCurrentTabContent();
        if (!tabContent || tabContent.querySelector('.bulk-toggle-btn')) return;
        
        const toggleHTML = `
            <button class="bulk-toggle-btn" onclick="window.professionalBulk.enterSelectionMode('${tab}')">
                ☑️ Select Items
            </button>
        `;
        
        // Add to tab header or appropriate location
        const insertPoint = tabContent.querySelector('.tab-header, .content-header') || tabContent;
        insertPoint.insertAdjacentHTML('beforeend', toggleHTML);
    }

    observeDataChanges() {
        // Observe for data changes to update selection state
        const observer = new MutationObserver((mutations) => {
            if (this.selectionMode) {
                // Check if items were added/removed
                const hasItemChanges = mutations.some(mutation => 
                    Array.from(mutation.addedNodes).some(node => 
                        node.classList?.contains('report-item') || 
                        node.classList?.contains('history-item') ||
                        node.classList?.contains('flashcard-item')
                    )
                );
                
                if (hasItemChanges) {
                    // Re-add checkboxes to new items
                    setTimeout(() => this.addCheckboxesToItems(), 100);
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    setupGlobalBulkInterface() {
        // Add global bulk operations interface
        // This could include a floating action button or menu
    }

    /**
     * Inject bulk operation styles
     */
    injectBulkStyles() {
        if (document.getElementById('professional-bulk-styles')) return;

        const styles = `
            <style id="professional-bulk-styles">
                /* Bulk Selection Mode */
                .bulk-selection-mode {
                    --bulk-primary: #1976d2;
                    --bulk-success: #2e7d32;
                    --bulk-danger: #d32f2f;
                    --bulk-warning: #f57c00;
                }

                .bulk-selection-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
                    border: 1px solid #1976d2;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    animation: slideInDown 0.3s ease;
                }

                .selection-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .selection-count {
                    font-weight: 600;
                    color: var(--bulk-primary);
                }

                .select-all-btn, .select-none-btn {
                    background: transparent;
                    border: 1px solid var(--bulk-primary);
                    color: var(--bulk-primary);
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .select-all-btn:hover, .select-none-btn:hover {
                    background: var(--bulk-primary);
                    color: white;
                }

                .select-all-btn:disabled, .select-none-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .exit-selection-btn {
                    background: #f5f5f5;
                    border: 1px solid #ddd;
                    color: #666;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .exit-selection-btn:hover {
                    background: #eeeeee;
                    color: #333;
                }

                /* Bulk Checkboxes */
                .bulk-checkbox {
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    z-index: 10;
                    animation: fadeIn 0.2s ease;
                }

                .bulk-checkbox input[type="checkbox"] {
                    display: none;
                }

                .checkbox-label {
                    display: block;
                    width: 20px;
                    height: 20px;
                    border: 2px solid #ddd;
                    border-radius: 4px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }

                .checkbox-label:hover {
                    border-color: var(--bulk-primary);
                    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
                }

                .bulk-checkbox input[type="checkbox"]:checked + .checkbox-label {
                    background: var(--bulk-primary);
                    border-color: var(--bulk-primary);
                }

                .bulk-checkbox input[type="checkbox"]:checked + .checkbox-label::after {
                    content: '✓';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                }

                /* Selectable Items */
                .bulk-selectable {
                    position: relative;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    padding-left: 40px !important; /* Make room for checkbox */
                }

                .bulk-selectable:hover {
                    background: rgba(25, 118, 210, 0.05);
                    border-color: rgba(25, 118, 210, 0.3);
                }

                .bulk-selected {
                    background: rgba(25, 118, 210, 0.1) !important;
                    border-color: var(--bulk-primary) !important;
                    box-shadow: inset 3px 0 0 var(--bulk-primary);
                }

                /* Bulk Action Bar */
                .bulk-action-bar {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    padding: 16px 24px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    z-index: 1000;
                    min-width: 500px;
                    animation: slideInUp 0.3s ease;
                }

                .bulk-action-bar-exit {
                    animation: slideOutDown 0.3s ease;
                }

                .bulk-actions-left {
                    font-weight: 500;
                    color: #333;
                }

                .bulk-actions-center {
                    display: flex;
                    gap: 8px;
                    flex: 1;
                    justify-content: center;
                }

                .bulk-actions-right {
                    display: flex;
                    gap: 8px;
                }

                .bulk-action-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .bulk-action-btn.primary {
                    background: var(--bulk-primary);
                    color: white;
                }

                .bulk-action-btn.primary:hover {
                    background: #1565c0;
                    transform: translateY(-1px);
                }

                .bulk-action-btn.danger {
                    background: var(--bulk-danger);
                    color: white;
                }

                .bulk-action-btn.danger:hover {
                    background: #c62828;
                    transform: translateY(-1px);
                }

                .bulk-action-btn.secondary {
                    background: #f5f5f5;
                    color: #666;
                    border: 1px solid #ddd;
                }

                .bulk-action-btn.secondary:hover {
                    background: #eeeeee;
                    color: #333;
                }

                .bulk-action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none !important;
                }

                .bulk-action-btn:disabled:hover {
                    transform: none !important;
                }

                /* Bulk Toggle Button */
                .bulk-toggle-btn {
                    background: linear-gradient(135deg, var(--bulk-primary) 0%, #1565c0 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin: 8px;
                }

                .bulk-toggle-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
                }

                /* Bulk Notifications */
                .bulk-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                }

                .bulk-notification.fade-out {
                    animation: slideOutRight 0.3s ease;
                }

                .bulk-action-result {
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 16px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    max-width: 400px;
                }

                .bulk-action-result.success {
                    border-left: 4px solid var(--bulk-success);
                    background: rgba(46, 125, 50, 0.05);
                }

                .bulk-action-result.error {
                    border-left: 4px solid var(--bulk-danger);
                    background: rgba(211, 47, 47, 0.05);
                }

                .result-icon {
                    font-size: 20px;
                }

                .result-message {
                    font-size: 14px;
                    color: #333;
                    font-weight: 500;
                }

                /* Animations */
                @keyframes slideInDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                @keyframes slideOutDown {
                    from {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                }

                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(20px);
                    }  
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                /* Mobile Responsiveness */
                @media (max-width: 768px) {
                    .bulk-action-bar {
                        left: 10px;
                        right: 10px;
                        transform: none;
                        min-width: auto;
                        flex-direction: column;
                        gap: 12px;
                    }

                    .bulk-actions-center {
                        justify-content: flex-start;
                        flex-wrap: wrap;
                    }

                    .bulk-action-btn {
                        font-size: 12px;
                        padding: 6px 12px;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// Initialize professional bulk manager
document.addEventListener('DOMContentLoaded', () => {
    new ProfessionalBulkManager();
});