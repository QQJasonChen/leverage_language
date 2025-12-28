// Notion API Integration for YouGlish Extension
class NotionIntegration {
  constructor() {
    this.apiKey = null;
    this.databases = [];
    this.selectedDatabaseId = null;
    this.isConfigured = false;
  }

  // Initialize Notion integration
  async initialize() {
    try {
      // Load saved configuration
      const config = await this.loadConfig();
      if (config.apiKey) {
        this.apiKey = config.apiKey;
        this.selectedDatabaseId = config.selectedDatabaseId;
        this.isConfigured = true;
        
        // Test the connection
        const isValid = await this.testConnection();
        if (!isValid) {
          this.isConfigured = false;
          return false;
        }
      }
      return this.isConfigured;
    } catch (error) {
      console.error('Failed to initialize Notion integration:', error);
      return false;
    }
  }

  // Save configuration
  async saveConfig(apiKey, databaseId) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({
        notionApiKey: apiKey,
        notionDatabaseId: databaseId
      }, () => {
        this.apiKey = apiKey;
        this.selectedDatabaseId = databaseId;
        this.isConfigured = true;
        resolve(true);
      });
    });
  }

  // Load configuration
  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId'], (data) => {
        resolve({
          apiKey: data.notionApiKey || null,
          selectedDatabaseId: data.notionDatabaseId || null
        });
      });
    });
  }

  // Test connection to Notion API
  async testConnection() {
    if (!this.apiKey) return false;

    try {
      const response = await fetch('https://api.notion.com/v1/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }

  // Get list of databases
  async getDatabases() {
    if (!this.apiKey) {
      throw new Error('Notion API key not configured');
    }

    try {
      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            value: 'database',
            property: 'object'
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch databases: ${response.statusText}`);
      }

      const data = await response.json();
      this.databases = data.results.map(db => ({
        id: db.id,
        title: db.title[0]?.plain_text || 'Untitled Database',
        icon: db.icon,
        url: db.url,
        properties: db.properties
      }));

      return this.databases;
    } catch (error) {
      console.error('Failed to fetch Notion databases:', error);
      throw error;
    }
  }

  // Create or update database schema for vocabulary
  async ensureVocabularyDatabase(databaseId) {
    if (!databaseId) {
      throw new Error('No database selected');
    }

    try {
      // Get current database schema
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get database: ${response.statusText}`);
      }

      const database = await response.json();
      const properties = database.properties;

      // Check if required properties exist
      const requiredProperties = ['Word', 'Language', 'Translation', 'Analysis', 'Tags', 'Favorite', 'Date Added'];
      const existingProperties = Object.keys(properties);
      const missingProperties = requiredProperties.filter(prop => !existingProperties.includes(prop));

      if (missingProperties.length > 0) {
        // Update database schema with missing properties
        const updateData = {
          properties: {}
        };

        // Add missing properties
        if (!properties['Word']) {
          updateData.properties['Word'] = { title: {} };
        }
        if (!properties['Language']) {
          updateData.properties['Language'] = { 
            select: {
              options: [
                { name: 'English', color: 'blue' },
                { name: 'Japanese', color: 'red' },
                { name: 'Korean', color: 'green' },
                { name: 'Dutch', color: 'orange' }
              ]
            }
          };
        }
        if (!properties['Translation']) {
          updateData.properties['Translation'] = { rich_text: {} };
        }
        if (!properties['Analysis']) {
          updateData.properties['Analysis'] = { rich_text: {} };
        }
        if (!properties['Tags']) {
          updateData.properties['Tags'] = { multi_select: {} };
        }
        if (!properties['Favorite']) {
          updateData.properties['Favorite'] = { checkbox: {} };
        }
        if (!properties['Date Added']) {
          updateData.properties['Date Added'] = { date: {} };
        }

        // Update database if needed
        if (Object.keys(updateData.properties).length > 0) {
          const updateResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          });

          if (!updateResponse.ok) {
            console.warn('Failed to update database schema:', await updateResponse.text());
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to ensure database schema:', error);
      throw error;
    }
  }

  // Export vocabulary to Notion
  async exportToNotion(reports, databaseId = null) {
    const targetDatabaseId = databaseId || this.selectedDatabaseId;
    
    if (!targetDatabaseId) {
      throw new Error('No database selected');
    }

    if (!this.apiKey) {
      throw new Error('Notion API key not configured');
    }

    try {
      // Ensure database has correct schema
      await this.ensureVocabularyDatabase(targetDatabaseId);

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Create pages for each report
      for (const report of reports) {
        try {
          const pageData = this.createPageData(report, targetDatabaseId);
          
          const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(pageData)
          });

          if (response.ok) {
            results.success++;
          } else {
            const error = await response.text();
            results.failed++;
            results.errors.push(`${report.searchText}: ${error}`);
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.failed++;
          results.errors.push(`${report.searchText}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to export to Notion:', error);
      throw error;
    }
  }

  // Create page data for Notion API
  createPageData(report, databaseId) {
    // Extract translation from analysis
    let translation = '';
    let pronunciation = '';
    
    if (report.analysisData) {
      const analysisText = typeof report.analysisData === 'string' 
        ? report.analysisData 
        : (report.analysisData.content || '');
      
      // Try to extract Chinese translation
      const translationMatch = analysisText.match(/中文[：:\s]*([^\n]+)/i) ||
                              analysisText.match(/翻譯[：:\s]*([^\n]+)/i);
      if (translationMatch) {
        translation = translationMatch[1].trim();
      }
      
      // Try to extract pronunciation
      const pronunciationMatch = analysisText.match(/\[([^\]]+)\]/) ||
                                analysisText.match(/\/([^\/]+)\//);
      if (pronunciationMatch) {
        pronunciation = pronunciationMatch[0];
      }
    }

    const properties = {
      'Word': {
        title: [
          {
            text: {
              content: report.searchText
            }
          }
        ]
      }
    };

    // Add Language if exists
    if (report.language) {
      properties['Language'] = {
        select: {
          name: this.getLanguageName(report.language)
        }
      };
    }

    // Add Translation
    properties['Translation'] = {
      rich_text: [
        {
          text: {
            content: translation || 'No translation available'
          }
        }
      ]
    };

    // Add Analysis
    const analysisContent = typeof report.analysisData === 'string' 
      ? report.analysisData 
      : (report.analysisData?.content || 'No analysis available');
    
    properties['Analysis'] = {
      rich_text: [
        {
          text: {
            content: analysisContent.substring(0, 2000) // Notion has limits
          }
        }
      ]
    };

    // Add Tags
    if (report.tags && report.tags.length > 0) {
      properties['Tags'] = {
        multi_select: report.tags.map(tag => ({ name: tag }))
      };
    }

    // Add Favorite
    properties['Favorite'] = {
      checkbox: report.favorite || false
    };

    // Add Date
    properties['Date Added'] = {
      date: {
        start: new Date(report.timestamp).toISOString().split('T')[0]
      }
    };

    return {
      parent: {
        database_id: databaseId
      },
      properties: properties
    };
  }

  // Get language display name
  getLanguageName(code) {
    const names = {
      'english': 'English',
      'japanese': 'Japanese',
      'korean': 'Korean',
      'dutch': 'Dutch'
    };
    return names[code] || code;
  }

  // Show configuration dialog
  async showConfigDialog() {
    const currentConfig = await this.loadConfig();
    
    // Create dialog UI
    const dialog = document.createElement('div');
    dialog.className = 'notion-config-dialog-overlay';
    dialog.innerHTML = `
      <div class="notion-config-dialog">
        <div class="dialog-header">
          <h3>📄 Notion Integration Setup</h3>
          <button class="close-dialog">✕</button>
        </div>
        <div class="dialog-content">
          <div class="config-step">
            <h4>🔗 Quick Setup (2 minutes)</h4>
            <div class="setup-steps">
              <div class="step-item">
                <span class="step-number">1</span>
                <div>
                  <p><strong>Create Integration:</strong></p>
                  <p>Click → <a href="https://www.notion.so/my-integrations" target="_blank" class="setup-link">Notion Integrations</a></p>
                  <p>→ Click "New integration" → Name it "YouGlish" → Submit</p>
                </div>
              </div>
              <div class="step-item">
                <span class="step-number">2</span>
                <div>
                  <p><strong>Copy API Key:</strong></p>
                  <p>→ Copy the "Internal Integration Token" (starts with secret_...)</p>
                </div>
              </div>
              <div class="step-item">
                <span class="step-number">3</span>
                <div>
                  <p><strong>Grant Access:</strong></p>
                  <p>→ Go to your Notion database → Click "..." → Add connections → Add "YouGlish"</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label>Notion API Key:</label>
            <input type="password" id="notion-api-key" placeholder="secret_..." value="${currentConfig.apiKey || ''}">
            <button id="test-connection">Test Connection</button>
          </div>
          
          <div class="config-step" id="database-selection" style="display: ${currentConfig.apiKey ? 'block' : 'none'};">
            <h4>Step 2: Select Database</h4>
            <p>Choose which database to save vocabulary to:</p>
            
            <div class="database-list" id="database-list">
              <div class="loading">Loading databases...</div>
            </div>
            
            <button id="refresh-databases">🔄 Refresh Databases</button>
          </div>
          
          <div class="form-group">
            <label>Selected Database ID:</label>
            <input type="text" id="selected-database-id" readonly value="${currentConfig.selectedDatabaseId || ''}">
          </div>
        </div>
        <div class="future-note">
          <p>💡 <strong>Future Update:</strong> One-click OAuth authentication coming soon! For now, the API key method is secure and works great.</p>
        </div>
        
        <div class="dialog-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="save-btn" id="save-notion-config">Save Configuration</button>
        </div>
      </div>
    `;

    // Add styles
    this.addConfigDialogStyles();
    document.body.appendChild(dialog);

    // Event handlers
    const closeDialog = () => dialog.remove();
    
    dialog.querySelector('.close-dialog').onclick = closeDialog;
    dialog.querySelector('.cancel-btn').onclick = closeDialog;
    dialog.onclick = (e) => {
      if (e.target === dialog) closeDialog();
    };

    // Test connection
    dialog.querySelector('#test-connection').onclick = async () => {
      const apiKey = dialog.querySelector('#notion-api-key').value.trim();
      if (!apiKey) {
        alert('Please enter your Notion API key');
        return;
      }

      this.apiKey = apiKey;
      const isValid = await this.testConnection();
      
      if (isValid) {
        alert('✅ Connection successful!');
        dialog.querySelector('#database-selection').style.display = 'block';
        await this.loadDatabaseList(dialog);
      } else {
        alert('❌ Connection failed. Please check your API key.');
      }
    };

    // Refresh databases
    dialog.querySelector('#refresh-databases').onclick = async () => {
      await this.loadDatabaseList(dialog);
    };

    // Save configuration
    dialog.querySelector('#save-notion-config').onclick = async () => {
      const apiKey = dialog.querySelector('#notion-api-key').value.trim();
      const databaseId = dialog.querySelector('#selected-database-id').value.trim();
      
      if (!apiKey) {
        alert('Please enter your Notion API key');
        return;
      }
      
      if (!databaseId) {
        alert('Please select a database');
        return;
      }

      await this.saveConfig(apiKey, databaseId);
      alert('✅ Notion configuration saved!');
      closeDialog();
    };

    // Load databases if API key exists
    if (currentConfig.apiKey) {
      this.apiKey = currentConfig.apiKey;
      await this.loadDatabaseList(dialog);
    }
  }

  // Load database list in dialog
  async loadDatabaseList(dialog) {
    const listContainer = dialog.querySelector('#database-list');
    listContainer.innerHTML = '<div class="loading">Loading databases...</div>';

    try {
      const databases = await this.getDatabases();
      
      if (databases.length === 0) {
        listContainer.innerHTML = '<p>No databases found. Make sure your integration has access to at least one database.</p>';
        return;
      }

      listContainer.innerHTML = databases.map(db => `
        <div class="database-item" data-id="${db.id}">
          <div class="database-icon">${db.icon?.emoji || '📄'}</div>
          <div class="database-info">
            <div class="database-title">${db.title}</div>
            <div class="database-id">${db.id}</div>
          </div>
        </div>
      `).join('');

      // Add click handlers
      listContainer.querySelectorAll('.database-item').forEach(item => {
        item.onclick = () => {
          // Remove previous selection
          listContainer.querySelectorAll('.database-item').forEach(i => i.classList.remove('selected'));
          
          // Add selection
          item.classList.add('selected');
          const databaseId = item.getAttribute('data-id');
          dialog.querySelector('#selected-database-id').value = databaseId;
        };
      });

      // Select current database if exists
      const currentId = dialog.querySelector('#selected-database-id').value;
      if (currentId) {
        const currentItem = listContainer.querySelector(`[data-id="${currentId}"]`);
        if (currentItem) currentItem.classList.add('selected');
      }
    } catch (error) {
      listContainer.innerHTML = `<p class="error">Failed to load databases: ${error.message}</p>`;
    }
  }

  // Add configuration dialog styles
  addConfigDialogStyles() {
    if (document.getElementById('notion-config-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'notion-config-styles';
    styles.textContent = `
      .notion-config-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .notion-config-dialog {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .config-step {
        background: #f7f7f7;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      .config-step h4 {
        margin: 0 0 12px 0;
        color: #333;
      }
      .config-step p {
        margin: 8px 0;
        color: #666;
        font-size: 14px;
      }
      .config-step a {
        color: #1a73e8;
        text-decoration: none;
        font-weight: 500;
      }
      .setup-steps {
        margin: 16px 0;
      }
      .step-item {
        display: flex;
        align-items: flex-start;
        margin-bottom: 20px;
        padding: 12px;
        background: white;
        border-radius: 8px;
        border-left: 3px solid #1a73e8;
      }
      .step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: #1a73e8;
        color: white;
        border-radius: 50%;
        font-weight: bold;
        font-size: 14px;
        margin-right: 16px;
        flex-shrink: 0;
        margin-top: 4px;
      }
      .step-item div {
        flex: 1;
      }
      .step-item p {
        margin: 4px 0;
        line-height: 1.4;
      }
      .step-item strong {
        color: #333;
      }
      .setup-link {
        background: #1a73e8;
        color: white !important;
        padding: 4px 8px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 13px;
        display: inline-block;
        margin: 0 4px;
      }
      .setup-link:hover {
        background: #1557b0;
      }
      .database-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 8px;
        margin: 12px 0;
      }
      .database-item {
        display: flex;
        align-items: center;
        padding: 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        transition: background 0.2s;
      }
      .database-item:hover {
        background: #f5f5f5;
      }
      .database-item.selected {
        background: #e3f2fd;
        border-left: 3px solid #1a73e8;
      }
      .database-icon {
        font-size: 24px;
        margin-right: 12px;
      }
      .database-info {
        flex: 1;
      }
      .database-title {
        font-weight: 500;
        color: #333;
      }
      .database-id {
        font-size: 12px;
        color: #999;
        margin-top: 4px;
      }
      #test-connection, #refresh-databases {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 8px;
      }
      #test-connection:hover, #refresh-databases:hover {
        background: #1557b0;
      }
      .loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .error {
        color: #d32f2f;
        padding: 20px;
        text-align: center;
      }
      .future-note {
        background: #e3f2fd;
        border: 1px solid #2196f3;
        border-radius: 8px;
        padding: 12px 16px;
        margin: 16px 20px;
      }
      .future-note p {
        margin: 0;
        color: #1565c0;
        font-size: 13px;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotionIntegration;
}