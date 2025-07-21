// i18n helper functions for YouGlish extension

// Language message mappings
const languageMessages = {
  'en': {
    'extensionName': 'YouGlish Quick Search',
    'header_title': 'YouGlish Quick Search',
    'welcome_title': '🎯 YouGlish Quick Search',
    'welcome_description': 'Select text on any webpage, then:',
    'welcome_step1': '• Right-click and select "Search on YouGlish"',
    'welcome_step2': '• Or use the keyboard shortcut',
    'welcome_step3': '• Or click the extension icon to open this panel',
    'welcome_languages': 'Supports English, Japanese, Korean, Dutch',
    'welcome_shortcut_note': 'Shortcuts can be customized at chrome://extensions/shortcuts',
    'manual_search_placeholder': 'Enter text to search...',
    'search_button': 'Search',
    'smart_detection': 'Auto-detect',
    'language_english': 'English',
    'language_japanese': 'Japanese',
    'language_korean': 'Korean',
    'language_dutch': 'Dutch',
    'save_settings': 'Save Settings',
    'settings_button': 'Settings',
    'saving': 'Saving...',
    'settings_saved': 'Settings Saved',
    // Views and navigation
    'analysis_view': '📊 Analysis',
    'video_view': '🎥 Video',
    'history_view': '📚 History',
    'new_tab': '🔗 New Tab',
    'search_results_title': '📺 YouGlish Search Results',
    'search_again': '🔍 Search Other Content',
    'search_term_label': 'Search Term:',
    'language_label': 'Language:',
    'url_label': 'URL:',
    'click_to_open': 'Click to open',
    // History
    'history_empty_title': '📝 No search history yet',
    'history_empty_desc': 'Start searching for words or phrases to build your learning record!',
    'clear_history': 'Clear History',
    'export_history': 'Export History',
    'search_history': 'Search history...',
    'all_languages': 'All Languages',
    'all_tags': 'All Tags',
    'delete': 'Delete',
    'search_on_youglish': 'Search on YouGlish',
    // AI features
    'ai_analysis_title': '🤖 AI Language Analysis',
    'generate_analysis': '✨ Generate Analysis',
    'regenerate_analysis': '🔄 Regenerate',
    'ai_analysis_placeholder': 'Click \'Generate Analysis\' and AI will provide:',
    'ai_feature_pronunciation': '📢 Pronunciation guidance and IPA',
    'ai_feature_explanation': '📖 Vocabulary explanations and usage',
    'ai_feature_grammar': '📝 Grammar analysis and sentence structure',
    'ai_feature_culture': '🌍 Cultural context and usage scenarios',
    'ai_config_note': 'Configure AI API key in settings',
    'ai_analyzing': 'AI analyzing, please wait...',
    'ai_audio_title': '🔊 AI Voice Pronunciation',
    'generate_audio': '🎵 Generate Audio',
    'regenerate_audio': '🔄 Regenerate',
    'test_audio': '🧪 Test',
    'audio_placeholder': 'Click \'Generate Audio\' to get AI voice pronunciation',
    'audio_tech_note': 'Uses OpenAI TTS technology for natural speech',
    'generating_audio': 'Generating audio, please wait...',
    'play_audio': '▶️ Play',
    'download_audio': '💾 Download',
    'repeat_audio': '🔄 Repeat',
    'repeat_on': '🔁 Repeating',
    // Quick Search
    'quick_search_title': 'Quick Results',
    'quick_translation': 'Translation:',
    'quick_pronunciation': 'Pronunciation:',
    'quick_definition': 'Definition:',
    'quick_search_note': 'Complete AI analysis will be ready shortly...',
    // Additional UI elements
    'audio_not_supported': 'Your browser does not support audio playback',
    'pronunciation_sites_description': 'Choose the most suitable pronunciation website:',
    'site_descriptions_title': '📖 Website Descriptions',
    // History statistics
    'query_count': 'queries',
    'times_singular': 'time',
    'times_plural': 'times',
    'query_statistics': '📊 Query Statistics',
    'total_queries': 'Total queries:',
    'unique_words': 'Unique words:',
    'average_daily': 'Daily average:',
    'language_distribution': 'Language distribution:',
    'no_stats_data': 'No statistics available',
    // Time formatting
    'time_today': 'Today',
    'time_yesterday': 'Yesterday', 
    'time_days_ago': 'days ago',
    // Language selector
    'ui_language_auto': 'Auto',
    'ui_language_english': 'English',
    'ui_language_chinese': '中文',
    'ui_language_japanese': '日本語',
    'ui_language_korean': '한국어',
    'ui_language_dutch': 'Nederlands',
    'language_switch_tooltip': 'Switch interface language',
    // Saved Reports
    'saved_reports_view': '💾 Saved',
    'search_saved_reports': 'Search saved reports...',
    'export_reports': '💾 Export',
    'favorites_only': '⭐ Favorites Only',
    'saved_reports_empty_title': '📝 No saved reports yet',
    'saved_reports_empty_desc': 'Generate AI analysis to automatically save reports!',
    'view_report': 'View',
    'toggle_favorite': '⭐',
    'delete_report': 'Delete',
    'expand_preview': 'Show more',
    'collapse_preview': 'Show less',
    // Export Dialog
    'export_format_title': 'Choose Export Format',
    'export_heptabase': '🔗 HeptaBase Cards (.md) - Optimized card format',
    'export_markdown': '📝 Standard Markdown (.md) - Universal format',
    'export_csv': '📊 CSV (.csv) - For Notion Database Import',
    'export_json': '🔧 JSON (.json) - Complete Data Backup',
    'export_cancel': 'Cancel',
    'export_confirm': 'Export',
    // Auto-save toggle
    'auto_save_on': '💾 Auto-Save',
    'auto_save_off': '💾 Manual',
    'auto_save_toggle_tooltip': 'Toggle automatic saving of AI reports',
    'save_this_report': '💾 Save This Report'
  },
  'zh_TW': {
    'extensionName': 'YouGlish 快速搜尋',
    'header_title': 'YouGlish 快速搜尋',
    'welcome_title': '🎯 YouGlish 快速查詢',
    'welcome_description': '選取網頁上的文字，然後：',
    'welcome_step1': '• 按右鍵選擇「在 YouGlish 上搜尋」',
    'welcome_step2': '• 或使用快捷鍵',
    'welcome_step3': '• 或點擊擴充功能圖示開啟此面板',
    'welcome_languages': '支援英文、日文、韓文、荷蘭文',
    'welcome_shortcut_note': '快捷鍵可在 chrome://extensions/shortcuts 中自定義',
    'manual_search_placeholder': '輸入要查詢的文字...',
    'search_button': '搜尋',
    'smart_detection': '自動偵測',
    'language_english': '英文',
    'language_japanese': '日文',
    'language_korean': '韓文',
    'language_dutch': '荷蘭文',
    'save_settings': '儲存設定',
    'settings_button': '設定',
    'saving': '儲存中...',
    'settings_saved': '設定已儲存',
    // Views and navigation
    'analysis_view': '📊 分析',
    'video_view': '🎥 影片',
    'history_view': '📚 歷史',
    'new_tab': '🔗 新分頁',
    'search_results_title': '📺 YouGlish 查詢結果',
    'search_again': '🔍 搜尋其他內容',
    'search_term_label': '搜尋內容：',
    'language_label': '語言：',
    'url_label': '網址：',
    'click_to_open': '點擊開啟',
    // History
    'history_empty_title': '📝 還沒有查詢歷史記錄',
    'history_empty_desc': '開始搜尋單字或片語，建立您的學習記錄！',
    'clear_history': '清空歷史',
    'export_history': '匯出歷史',
    'search_history': '搜尋歷史記錄...',
    'all_languages': '所有語言',
    'all_tags': '所有標籤',
    'delete': '刪除',
    'search_on_youglish': '在 YouGlish 上搜尋',
    // AI features
    'ai_analysis_title': '🤖 AI 語言分析',
    'generate_analysis': '✨ 生成分析',
    'regenerate_analysis': '🔄 重新生成',
    'ai_audio_title': '🔊 AI 語音發音',
    'generate_audio': '🎵 生成語音',
    'regenerate_audio': '🔄 重新生成',
    'test_audio': '🧪 測試',
    'play_audio': '▶️ 播放',
    'download_audio': '💾 下載',
    'repeat_audio': '🔄 重複',
    'repeat_on': '🔁 重複中',
    // Quick Search
    'quick_search_title': '即時查詢結果',
    'quick_translation': '快速翻譯：',
    'quick_pronunciation': '發音：',
    'quick_definition': '簡要定義：',
    'quick_search_note': '完整 AI 分析即將完成，請稍候...',
    // Additional UI elements
    'audio_not_supported': '您的瀏覽器不支援音頻播放',
    'pronunciation_sites_description': '選擇最適合的發音網站：',
    'site_descriptions_title': '📖 網站說明',
    // History statistics
    'query_count': '查詢',
    'times_singular': '次',
    'times_plural': '次',
    'query_statistics': '📊 查詢統計',
    'total_queries': '總查詢次數:',
    'unique_words': '不同詞彙:',
    'average_daily': '平均每日查詢:',
    'language_distribution': '語言分布:',
    'no_stats_data': '無法載入統計資料',
    // Time formatting
    'time_today': '今天',
    'time_yesterday': '昨天',
    'time_days_ago': '天前',
    // Language selector
    'ui_language_auto': '自動',
    'ui_language_english': 'English',
    'ui_language_chinese': '中文',
    'ui_language_japanese': '日本語',
    'language_switch_tooltip': '切換界面語言',
    // Saved Reports
    'saved_reports_view': '💾 已保存',
    'search_saved_reports': '搜尋已保存的報告...',
    'export_reports': '💾 匯出',
    'favorites_only': '⭐ 僅收藏',
    'saved_reports_empty_title': '📝 還沒有保存的報告',
    'saved_reports_empty_desc': '生成 AI 分析以自動保存報告！',
    'view_report': '查看',
    'toggle_favorite': '⭐',
    'delete_report': '刪除',
    'expand_preview': '顯示更多',
    'collapse_preview': '顯示較少',
    // Export Dialog
    'export_format_title': '選擇匯出格式',
    'export_markdown': '📝 Markdown (.md) - 適用於 Notion、Obsidian、HeptaBase',
    'export_csv': '📊 CSV (.csv) - 適用於 Notion 資料庫匯入',
    'export_json': '🔧 JSON (.json) - 完整資料備份',
    'export_cancel': '取消',
    'export_confirm': '匯出',
    // Auto-save toggle
    'auto_save_on': '💾 自動保存',
    'auto_save_off': '💾 手動保存',
    'auto_save_toggle_tooltip': '切換AI報告自動保存功能',
    'save_this_report': '💾 保存此報告'
  },
  'ko': {
    'extensionName': 'YouGlish 빠른 검색',
    'header_title': 'YouGlish 빠른 검색',
    'welcome_title': '🎯 YouGlish 빠른 검색',
    'welcome_description': '웹페이지의 텍스트를 선택한 후:',
    'welcome_step1': '• 우클릭하여 "YouGlish에서 검색" 선택',
    'welcome_step2': '• 또는 키보드 단축키 사용',
    'welcome_step3': '• 또는 확장 프로그램 아이콘을 클릭하여 패널 열기',
    'welcome_languages': '영어, 일본어, 한국어, 네덜란드어 지원',
    'welcome_shortcut_note': '단축키는 chrome://extensions/shortcuts에서 사용자 정의할 수 있습니다',
    'manual_search_placeholder': '검색할 텍스트 입력...',
    'search_button': '검색',
    'smart_detection': '자동 감지',
    'language_english': '영어',
    'language_japanese': '일본어',
    'language_korean': '한국어',
    'language_dutch': '네덜란드어',
    'save_settings': '설정 저장',
    'settings_button': '설정',
    'saving': '저장 중...',
    'settings_saved': '설정이 저장되었습니다',
    // Views and navigation
    'analysis_view': '📊 분석',
    'video_view': '🎥 동영상',
    'history_view': '📚 기록',
    'new_tab': '🔗 새 탭',
    'search_results_title': '📺 YouGlish 검색 결과',
    'search_again': '🔍 다른 내용 검색',
    'search_term_label': '검색어:',
    'language_label': '언어:',
    'url_label': 'URL:',
    'click_to_open': '클릭하여 열기',
    // History
    'history_empty_title': '📝 검색 기록이 없습니다',
    'history_empty_desc': '단어나 구문을 검색하여 학습 기록을 만들어보세요!',
    'clear_history': '기록 지우기',
    'export_history': '기록 내보내기',
    'search_history': '기록 검색...',
    'all_languages': '모든 언어',
    'all_tags': '모든 태그',
    'delete': '삭제',
    'search_on_youglish': 'YouGlish에서 검색',
    // AI features
    'ai_analysis_title': '🤖 AI 언어 분석',
    'generate_analysis': '✨ 분석 생성',
    'regenerate_analysis': '🔄 다시 생성',
    'ai_analysis_placeholder': '\'분석 생성\'을 클릭하면 AI가 다음을 제공합니다:',
    'ai_feature_pronunciation': '📢 발음 가이드 및 IPA',
    'ai_feature_explanation': '📖 어휘 설명 및 사용법',
    'ai_feature_grammar': '📝 문법 분석 및 문장 구조',
    'ai_feature_culture': '🌍 문화적 맥락 및 사용 시나리오',
    'ai_config_note': '설정에서 AI API 키를 구성하세요',
    'ai_analyzing': 'AI가 분석 중입니다. 잠시만 기다려주세요...',
    'ai_audio_title': '🔊 AI 음성 발음',
    'generate_audio': '🎵 음성 생성',
    'regenerate_audio': '🔄 다시 생성',
    'test_audio': '🧪 테스트',
    'audio_placeholder': '\'음성 생성\'을 클릭하여 AI 음성 발음을 받으세요',
    'audio_tech_note': 'OpenAI TTS 기술을 사용하여 자연스러운 음성 생성',
    'generating_audio': '음성을 생성하고 있습니다. 잠시만 기다려주세요...',
    'play_audio': '▶️ 재생',
    'download_audio': '💾 다운로드',
    'repeat_audio': '🔄 반복',
    'repeat_on': '🔁 반복 중',
    // Additional UI elements
    'audio_not_supported': '브라우저가 오디오 재생을 지원하지 않습니다',
    'pronunciation_sites_description': '가장 적합한 발음 웹사이트를 선택하세요:',
    'site_descriptions_title': '📖 웹사이트 설명',
    // History statistics
    'query_count': '검색',
    'times_singular': '번',
    'times_plural': '번',
    'query_statistics': '📊 검색 통계',
    'total_queries': '총 검색 횟수:',
    'unique_words': '서로 다른 단어:',
    'average_daily': '일일 평균:',
    'language_distribution': '언어 분포:',
    'no_stats_data': '통계 데이터가 없습니다',
    // Time formatting
    'time_today': '오늘',
    'time_yesterday': '어제',
    'time_days_ago': '일 전',
    // Language selector
    'ui_language_auto': '자동',
    'ui_language_english': 'English',
    'ui_language_chinese': '中文',
    'ui_language_japanese': '日本語',
    'ui_language_korean': '한국어',
    'ui_language_dutch': 'Nederlands',
    'language_switch_tooltip': '인터페이스 언어 변경',
    // Saved Reports
    'saved_reports_view': '💾 저장됨',
    'search_saved_reports': '저장된 보고서 검색...',
    'export_reports': '💾 내보내기',
    'favorites_only': '⭐ 즐겨찾기만',
    'saved_reports_empty_title': '📝 저장된 보고서가 없습니다',
    'saved_reports_empty_desc': 'AI 분석을 생성하여 자동으로 보고서를 저장하세요!',
    'view_report': '보기',
    'toggle_favorite': '⭐',
    'delete_report': '삭제',
    'expand_preview': '더 보기',
    'collapse_preview': '적게 보기',
    // Export Dialog
    'export_format_title': '내보내기 형식 선택',
    'export_markdown': '📝 Markdown (.md) - Notion, Obsidian, HeptaBase용',
    'export_csv': '📊 CSV (.csv) - Notion 데이터베이스 가져오기용',
    'export_json': '🔧 JSON (.json) - 완전한 데이터 백업',
    'export_cancel': '취소',
    'export_confirm': '내보내기',
    // Auto-save toggle  
    'save_this_report': '💾 이 보고서 저장'
  },
  'nl': {
    'extensionName': 'YouGlish Snel Zoeken',
    'header_title': 'YouGlish Snel Zoeken',
    'welcome_title': '🎯 YouGlish Snel Zoeken',
    'welcome_description': 'Selecteer tekst op een webpagina en:',
    'welcome_step1': '• Klik rechts en selecteer "Zoeken op YouGlish"',
    'welcome_step2': '• Of gebruik de sneltoets',
    'welcome_step3': '• Of klik op het extensie-icoon om dit paneel te openen',
    'welcome_languages': 'Ondersteunt Engels, Japans, Koreaans, Nederlands',
    'welcome_shortcut_note': 'Sneltoetsen kunnen worden aangepast bij chrome://extensions/shortcuts',
    'manual_search_placeholder': 'Voer tekst in om te zoeken...',
    'search_button': 'Zoeken',
    'smart_detection': 'Automatisch detecteren',
    'language_english': 'Engels',
    'language_japanese': 'Japans',
    'language_korean': 'Koreaans',
    'language_dutch': 'Nederlands',
    'save_settings': 'Instellingen Opslaan',
    'settings_button': 'Instellingen',
    'saving': 'Opslaan...',
    'settings_saved': 'Instellingen Opgeslagen',
    // Views and navigation
    'analysis_view': '📊 Analyse',
    'video_view': '🎥 Video',
    'history_view': '📚 Geschiedenis',
    'new_tab': '🔗 Nieuw Tabblad',
    'search_results_title': '📺 YouGlish Zoekresultaten',
    'search_again': '🔍 Andere Inhoud Zoeken',
    'search_term_label': 'Zoekterm:',
    'language_label': 'Taal:',
    'url_label': 'URL:',
    'click_to_open': 'Klik om te openen',
    // History
    'history_empty_title': '📝 Nog geen zoekgeschiedenis',
    'history_empty_desc': 'Begin met zoeken naar woorden of zinnen om je leerhistorie op te bouwen!',
    'clear_history': 'Geschiedenis Wissen',
    'export_history': 'Geschiedenis Exporteren',
    'search_history': 'Zoek geschiedenis...',
    'all_languages': 'Alle Talen',
    'all_tags': 'Alle Tags',
    'delete': 'Verwijderen',
    'search_on_youglish': 'Zoeken op YouGlish',
    // AI features
    'ai_analysis_title': '🤖 AI Taalanalyse',
    'generate_analysis': '✨ Analyse Genereren',
    'regenerate_analysis': '🔄 Opnieuw Genereren',
    'ai_analysis_placeholder': 'Klik \'Analyse Genereren\' en AI zal het volgende bieden:',
    'ai_feature_pronunciation': '📢 Uitspraakgeleiding en IPA',
    'ai_feature_explanation': '📖 Woordenschat uitleg en gebruik',
    'ai_feature_grammar': '📝 Grammatica-analyse en zinsstructuur',
    'ai_feature_culture': '🌍 Culturele context en gebruiksscenario\'s',
    'ai_config_note': 'Configureer AI API-sleutel in instellingen',
    'ai_analyzing': 'AI analyseert, even geduld...',
    'ai_audio_title': '🔊 AI Spraakuitspraak',
    'generate_audio': '🎵 Audio Genereren',
    'regenerate_audio': '🔄 Opnieuw Genereren',
    'test_audio': '🧪 Test',
    'audio_placeholder': 'Klik \'Audio Genereren\' voor AI spraakuitspraak',
    'audio_tech_note': 'Gebruikt OpenAI TTS technologie voor natuurlijke spraak',
    'generating_audio': 'Audio genereren, even geduld...',
    'play_audio': '▶️ Afspelen',
    'download_audio': '💾 Downloaden',
    'repeat_audio': '🔄 Herhalen',
    'repeat_on': '🔁 Herhalend',
    // Additional UI elements
    'audio_not_supported': 'Uw browser ondersteunt geen audio-afspelen',
    'pronunciation_sites_description': 'Kies de meest geschikte uitspraakwebsite:',
    'site_descriptions_title': '📖 Website Beschrijvingen',
    // History statistics
    'query_count': 'zoekopdrachten',
    'times_singular': 'keer',
    'times_plural': 'keer',
    'query_statistics': '📊 Zoekstatistieken',
    'total_queries': 'Totale zoekopdrachten:',
    'unique_words': 'Unieke woorden:',
    'average_daily': 'Daggemiddelde:',
    'language_distribution': 'Taalverdeling:',
    'no_stats_data': 'Geen statistieken beschikbaar',
    // Time formatting
    'time_today': 'Vandaag',
    'time_yesterday': 'Gisteren',
    'time_days_ago': 'dagen geleden',
    // Language selector
    'ui_language_auto': 'Automatisch',
    'ui_language_english': 'English',
    'ui_language_chinese': '中文',
    'ui_language_japanese': '日本語',
    'ui_language_korean': '한국어',
    'ui_language_dutch': 'Nederlands',
    'language_switch_tooltip': 'Schakel interfacetaal',
    // Saved Reports
    'saved_reports_view': '💾 Opgeslagen',
    'search_saved_reports': 'Zoek opgeslagen rapporten...',
    'export_reports': '💾 Exporteren',
    'favorites_only': '⭐ Alleen favorieten',
    'saved_reports_empty_title': '📝 Nog geen opgeslagen rapporten',
    'saved_reports_empty_desc': 'Genereer AI-analyse om automatisch rapporten op te slaan!',
    'view_report': 'Bekijken',
    'toggle_favorite': '⭐',
    'delete_report': 'Verwijderen',
    'expand_preview': 'Meer tonen',
    'collapse_preview': 'Minder tonen',
    // Export Dialog
    'export_format_title': 'Kies Exportformaat',
    'export_markdown': '📝 Markdown (.md) - Voor Notion, Obsidian, HeptaBase',
    'export_csv': '📊 CSV (.csv) - Voor Notion Database Import',
    'export_json': '🔧 JSON (.json) - Volledige Data Backup',
    'export_cancel': 'Annuleren',
    'export_confirm': 'Exporteren',
    // Auto-save toggle
    'save_this_report': '💾 Dit Rapport Opslaan'
  },
  'ja': {
    'extensionName': 'YouGlish クイック検索',
    'header_title': 'YouGlish クイック検索',
    'welcome_title': '🎯 YouGlish クイック検索',
    'welcome_description': 'ウェブページ上のテキストを選択して：',
    'welcome_step1': '• 右クリックで「YouGlishで検索」を選択',
    'welcome_step2': '• またはキーボードショートカットを使用',
    'welcome_step3': '• または拡張機能アイコンをクリックしてパネルを開く',
    'welcome_languages': '英語、日本語、韓国語、オランダ語に対応',
    'welcome_shortcut_note': 'ショートカットは chrome://extensions/shortcuts でカスタマイズできます',
    'manual_search_placeholder': '検索するテキストを入力...',
    'search_button': '検索',
    'smart_detection': 'スマート検出',
    'language_english': '英語',
    'language_japanese': '日本語',
    'language_korean': '韓国語',
    'language_dutch': 'オランダ語',
    'save_settings': '設定を保存',
    'settings_button': '設定',
    'saving': '保存中...',
    'settings_saved': '設定が保存されました',
    // Views and navigation
    'analysis_view': '📊 分析',
    'video_view': '🎥 動画',
    'history_view': '📚 履歴',
    'new_tab': '🔗 新しいタブ',
    'search_results_title': '📺 YouGlish 検索結果',
    'search_again': '🔍 他のコンテンツを検索',
    'search_term_label': '検索語：',
    'language_label': '言語：',
    'url_label': 'URL：',
    'click_to_open': 'クリックして開く',
    // History
    'history_empty_title': '📝 検索履歴がありません',
    'history_empty_desc': '単語やフレーズを検索して学習記録を作成しましょう！',
    'clear_history': '履歴をクリア',
    'export_history': '履歴をエクスポート',
    'search_history': '履歴を検索...',
    'all_languages': 'すべての言語',
    'all_tags': 'すべてのタグ',
    'delete': '削除',
    'search_on_youglish': 'YouGlishで検索',
    // AI features
    'ai_analysis_title': '🤖 AI言語分析',
    'generate_analysis': '✨ 分析を生成',
    'regenerate_analysis': '🔄 再生成',
    'ai_audio_title': '🔊 AI音声発音',
    'generate_audio': '🎵 音声を生成',
    'regenerate_audio': '🔄 再生成',
    'test_audio': '🧪 テスト',
    'play_audio': '▶️ 再生',
    'download_audio': '💾 ダウンロード',
    'repeat_audio': '🔄 リピート',
    'repeat_on': '🔁 リピート中',
    // Additional UI elements
    'audio_not_supported': 'ブラウザがオーディオ再生をサポートしていません',
    'pronunciation_sites_description': '最適な発音ウェブサイトを選択してください：',
    'site_descriptions_title': '📖 ウェブサイト説明',
    // History statistics
    'query_count': '検索',
    'times_singular': '回',
    'times_plural': '回',
    'query_statistics': '📊 検索統計',
    'total_queries': '総検索数:',
    'unique_words': '異なる単語:',
    'average_daily': '日平均:',
    'language_distribution': '言語分布:',
    'no_stats_data': '統計データがありません',
    // Time formatting
    'time_today': '今日',
    'time_yesterday': '昨日',
    'time_days_ago': '日前',
    // Language selector
    'ui_language_auto': '自動',
    'ui_language_english': 'English',
    'ui_language_chinese': '中文',
    'ui_language_japanese': '日本語',
    'ui_language_korean': '한국어',
    'ui_language_dutch': 'Nederlands',
    'language_switch_tooltip': 'インターフェース言語を切り替え',
    // Saved Reports
    'saved_reports_view': '💾 保存済み',
    'search_saved_reports': '保存されたレポートを検索...',
    'export_reports': '💾 エクスポート',
    'favorites_only': '⭐ お気に入りのみ',
    'saved_reports_empty_title': '📝 保存されたレポートがありません',
    'saved_reports_empty_desc': 'AI分析を生成して自動的にレポートを保存しましょう！',
    'view_report': '表示',
    'toggle_favorite': '⭐',
    'delete_report': '削除',
    'expand_preview': 'もっと見る',
    'collapse_preview': '少なく表示',
    // Export Dialog
    'export_format_title': 'エクスポート形式を選択',
    'export_markdown': '📝 Markdown (.md) - Notion、Obsidian、HeptaBase用',
    'export_csv': '📊 CSV (.csv) - Notionデータベースインポート用',
    'export_json': '🔧 JSON (.json) - 完全なデータバックアップ',
    'export_cancel': 'キャンセル',
    'export_confirm': 'エクスポート',
    // Auto-save toggle
    'save_this_report': '💾 このレポートを保存'
  }
};

// Cache for performance
let cachedUILanguage = null;
let lastStorageCheck = 0;
const CACHE_DURATION = 30000; // 30 seconds cache

// Get current UI language with caching
function getCurrentUILanguage() {
  return new Promise((resolve) => {
    const now = Date.now();
    
    // Use cache if still valid
    if (cachedUILanguage && (now - lastStorageCheck) < CACHE_DURATION) {
      resolve(cachedUILanguage);
      return;
    }
    
    chrome.storage.sync.get(['uiLanguage'], (result) => {
      let detectedLang;
      
      if (result.uiLanguage && result.uiLanguage !== 'auto') {
        detectedLang = result.uiLanguage;
      } else {
        // Auto-detect from browser
        const browserLang = chrome.i18n.getUILanguage();
        if (browserLang.startsWith('zh')) {
          detectedLang = 'zh_TW';
        } else if (browserLang.startsWith('ja')) {
          detectedLang = 'ja';
        } else if (browserLang.startsWith('ko')) {
          detectedLang = 'ko';
        } else if (browserLang.startsWith('nl')) {
          detectedLang = 'nl';
        } else {
          detectedLang = 'en';
        }
      }
      
      // Update cache
      cachedUILanguage = detectedLang;
      lastStorageCheck = now;
      
      resolve(detectedLang);
    });
  });
}

// Function to clear language cache (useful when language is changed)
function clearLanguageCache() {
  cachedUILanguage = null;
  lastStorageCheck = 0;
}

// Get message in specified language
function getI18nMessage(key, language = null) {
  if (language && languageMessages[language] && languageMessages[language][key]) {
    return languageMessages[language][key];
  }
  
  // Fallback to Chrome's i18n
  const chromeMessage = chrome.i18n.getMessage(key);
  if (chromeMessage) {
    return chromeMessage;
  }
  
  // Fallback to English
  if (languageMessages['en'][key]) {
    return languageMessages['en'][key];
  }
  
  return key; // Return key if no translation found
}

// Optimized initialization with performance improvements
async function initializeI18n(forceUpdate = false) {
  try {
    const currentLang = await getCurrentUILanguage();
    
    // Check if we've already processed elements for this language
    const lastProcessedLang = document.body?.getAttribute('data-i18n-processed');
    if (!forceUpdate && lastProcessedLang === currentLang) {
      return; // Skip if already processed for current language
    }
    
    // Batch DOM queries for better performance
    const allElements = document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]');
    
    // Process elements in batches to avoid blocking UI
    const batchSize = 50;
    for (let i = 0; i < allElements.length; i += batchSize) {
      const batch = Array.from(allElements).slice(i, i + batchSize);
      
      // Process current batch
      batch.forEach(element => {
        // Handle data-i18n attribute
        const messageKey = element.getAttribute('data-i18n');
        if (messageKey) {
          const message = getI18nMessage(messageKey, currentLang);
          if (message && message !== messageKey) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              element.placeholder = message;
            } else {
              element.textContent = message;
            }
          }
        }
        
        // Handle data-i18n-placeholder attribute
        const placeholderKey = element.getAttribute('data-i18n-placeholder');
        if (placeholderKey) {
          const message = getI18nMessage(placeholderKey, currentLang);
          if (message && message !== placeholderKey) {
            element.placeholder = message;
          }
        }
        
        // Handle data-i18n-title attribute
        const titleKey = element.getAttribute('data-i18n-title');
        if (titleKey) {
          const message = getI18nMessage(titleKey, currentLang);
          if (message && message !== titleKey) {
            element.title = message;
          }
        }
      });
      
      // Yield to browser between batches for smoother performance
      if (i + batchSize < allElements.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Update document title
    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) {
      const title = getI18nMessage(titleKey, currentLang);
      if (title && title !== titleKey) {
        document.title = title;
      }
    }
    
    // Mark as processed for this language
    if (document.body) {
      document.body.setAttribute('data-i18n-processed', currentLang);
    }
    
  } catch (error) {
    console.error('Error initializing i18n:', error);
  }
}

// Function to refresh UI language
async function refreshUILanguage() {
  clearLanguageCache(); // Clear cache to force fresh language detection
  await initializeI18n(true); // Force update even if same language
}

// Create i18n helper object for backwards compatibility
const i18nHelper = {
  getCurrentUILanguage,
  getI18nMessage,
  refreshUILanguage,
  clearLanguageCache,
  
  // Method for switching language (saves to storage then refreshes)
  async switchLanguage(languageCode) {
    try {
      // Save to storage
      await new Promise((resolve) => {
        chrome.storage.sync.set({ uiLanguage: languageCode }, resolve);
      });
      
      // Clear cache and refresh UI
      clearLanguageCache();
      await initializeI18n(true);
      
      return true;
    } catch (error) {
      console.error('Error switching language:', error);
      return false;
    }
  }
};

// Export functions for use in other scripts
window.getCurrentUILanguage = getCurrentUILanguage;
window.getI18nMessage = getI18nMessage;
window.refreshUILanguage = refreshUILanguage;
window.clearLanguageCache = clearLanguageCache;
window.i18nHelper = i18nHelper;

// Initialize i18n when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeI18n);
} else {
  initializeI18n();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initializeI18n };
} else {
  window.initializeI18n = initializeI18n;
}