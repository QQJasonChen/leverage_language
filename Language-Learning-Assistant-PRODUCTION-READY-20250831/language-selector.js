// 語言選擇器的JavaScript邏輯
(function() {
    let selectedLanguage = null;
    let originalText = '';
    let tabId = null;

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        initializeSelector();
        setupEventListeners();
    });

    function initializeSelector() {
        // 從URL參數獲取文本和標籤ID
        const urlParams = new URLSearchParams(window.location.search);
        originalText = decodeURIComponent(urlParams.get('text') || '');
        tabId = parseInt(urlParams.get('tabId')) || null;
        
        // 顯示文本預覽
        const textPreview = document.getElementById('textPreview');
        if (originalText) {
            // 限制顯示長度，避免過長
            const previewText = originalText.length > 100 
                ? originalText.substring(0, 100) + '...'
                : originalText;
            textPreview.textContent = previewText;
        }
    }

    function setupEventListeners() {
        // 語言按鈕點擊事件
        const langButtons = document.querySelectorAll('.lang-btn');
        langButtons.forEach(button => {
            button.addEventListener('click', function() {
                selectLanguage(this.dataset.lang);
            });
        });

        // 確認按鈕
        document.getElementById('confirmBtn').addEventListener('click', function() {
            if (selectedLanguage) {
                confirmSelection();
            }
        });

        // 取消按鈕
        document.getElementById('cancelBtn').addEventListener('click', function() {
            cancelSelection();
        });

        // 鍵盤快捷鍵
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                cancelSelection();
            } else if (e.key === 'Enter' && selectedLanguage) {
                confirmSelection();
            } else if (e.key === '1') {
                selectLanguage('english');
            } else if (e.key === '2') {
                selectLanguage('dutch');
            }
        });
    }

    function selectLanguage(language) {
        selectedLanguage = language;
        
        // 更新按鈕狀態
        const langButtons = document.querySelectorAll('.lang-btn');
        langButtons.forEach(button => {
            button.classList.remove('selected');
            if (button.dataset.lang === language) {
                button.classList.add('selected');
            }
        });

        // 啟用確認按鈕
        document.getElementById('confirmBtn').disabled = false;
    }

    function confirmSelection() {
        if (!selectedLanguage) return;

        const rememberChoice = document.getElementById('rememberChoice').checked;
        
        // 發送結果到background script
        chrome.runtime.sendMessage({
            type: 'LANGUAGE_SELECTED',
            language: selectedLanguage,
            originalText: originalText,
            tabId: tabId,
            remember: rememberChoice
        }, function(response) {
            if (response && response.success) {
                // 關閉彈窗
                window.close();
            } else {
                console.error('Failed to process language selection');
            }
        });
    }

    function cancelSelection() {
        // 發送取消消息
        chrome.runtime.sendMessage({
            type: 'LANGUAGE_SELECTION_CANCELLED',
            tabId: tabId
        });
        
        // 關閉彈窗
        window.close();
    }

    // 處理來自background script的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'UPDATE_TEXT') {
            originalText = request.text;
            const textPreview = document.getElementById('textPreview');
            const previewText = originalText.length > 100 
                ? originalText.substring(0, 100) + '...'
                : originalText;
            textPreview.textContent = previewText;
        }
    });
})();